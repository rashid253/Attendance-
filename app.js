// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- 0. Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- 1. IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) {
    console.error('idb-keyval not found');
    return;
  }
  const { get, set } = window.idbKeyval;
  const save = (key, val) => set(key, val);

  // --- 2. State & Defaults ---
  let students        = await get('students')        || [];
  let attendanceData  = await get('attendanceData')  || {};
  let paymentsData    = await get('paymentsData')    || {};
  let lastAdmNo       = await get('lastAdmissionNo') || 0;
  let fineRates       = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct  = await get('eligibilityPct')  || 75;

  let financialDisplay = null;

  let analyticsStats    = [];
  let analyticsRange    = { from: null, to: null };
  let analyticsFilter   = ['all'];
  let analyticsDownload = 'combined';

  // --- 3. Helpers ---
  const $    = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  function getFineMode() {
    return document.querySelector('input[name="fineMode"]:checked')?.value || 'advance';
  }

  // --- 4. SETTINGS: Fines & Eligibility ---
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  $('saveSettings').onclick = async () => {
    fineRates = {
      A : +$('fineAbsent').value   || 0,
      Lt: +$('fineLate').value     || 0,
      L : +$('fineLeave').value    || 0,
      HD: +$('fineHalfDay').value  || 0,
    };
    eligibilityPct = +$('eligibilityPct').value || 0;
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);

    // Hide form & radios
    hide($('financialForm'), $('fineModeFieldset'), $('saveSettings'));

    // Insert static summary
    if (financialDisplay) financialDisplay.remove();
    financialDisplay = document.createElement('div');
    financialDisplay.id = 'financialDisplay';
    financialDisplay.className = 'summary-box';
    financialDisplay.innerHTML = `
      <h3><i class="fas fa-wallet"></i> Fines & Eligibility</h3>
      <p>Absent Fine: PKR ${fineRates.A}</p>
      <p>Late Fine: PKR ${fineRates.Lt}</p>
      <p>Leave Fine: PKR ${fineRates.L}</p>
      <p>Half‑Day Fine: PKR ${fineRates.HD}</p>
      <p>Eligibility Threshold: ${eligibilityPct}%</p>
      <button id="editSettings" class="no-print"><i class="fas fa-edit"></i> Edit</button>
    `;
    document.getElementById('financial-settings').appendChild(financialDisplay);
    show(financialDisplay);

    // Edit restores form
    $('editSettings').onclick = () => {
      financialDisplay.remove();
      financialDisplay = null;
      show($('financialForm'), $('fineModeFieldset'), $('saveSettings'));
    };
  };

  // --- 5. SETUP: School, Class & Section ---
  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([
      get('schoolName'),
      get('teacherClass'),
      get('teacherSection')
    ]);
    if (sc && cl && sec) {
      $('schoolNameInput').value      = sc;
      $('teacherClassSelect').value   = cl;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent      = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderAll();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc  = $('schoolNameInput').value.trim();
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!sc || !cl || !sec) { alert('Complete setup'); return; }
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => {
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };
  await loadSetup();

  // --- 6. COUNTERS & UTILS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target / 100);
      (function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
      })();
    });
  }
  function updateCounters() {
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s => s.cls===cl && s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s => s.cls===cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }

  function resetViews() {
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'),
      $('registerTableWrapper'), $('changeRegister'), $('saveRegister'),
      $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }

  $('teacherClassSelect').onchange   = renderAll;
  $('teacherSectionSelect').onchange = renderAll;

  // --- 7. STUDENT REGISTRATION ---
  function clearForm() {
    ['studentName','parentName','parentContact','parentOccupation','parentAddress','admissionDate']
      .forEach(id => $(id).value = '');
  }
  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n = $('studentName').value.trim(),
          p = $('parentName').value.trim(),
          c = $('parentContact').value.trim(),
          o = $('parentOccupation').value.trim(),
          a = $('parentAddress').value.trim(),
          cl= $('teacherClassSelect').value,
          sec=$('teacherSectionSelect').value,
          admDate=$('admissionDate').value||null;
    if (!n||!p||!c||!o||!a) { alert('All fields required'); return; }
    const adm = await genAdmNo();
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec, admissionDate:admDate });
    await save('students', students);
    clearForm();
    renderStudents();
    updateCounters();
    resetViews();
  };

  $('selectAllStudents').onclick = () => {
    const c = $('selectAllStudents').checked;
    document.querySelectorAll('#studentsBody .sel').forEach(cb => cb.checked = c);
    toggleButtons();
  };

  function toggleButtons() {
    const any = !!document.querySelector('#studentsBody .sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
    $('saveRegistration').disabled = !any;
  }

  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleButtons();
  });

  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach(cb => {
      const tr = cb.closest('tr'), i = +tr.dataset.index, s = students[i];
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" checked></td>
        <td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"></td>
        <td>${s.adm}</td>
        <td><input value="${s.parent}"></td>
        <td><input value="${s.contact}"></td>
        <td><input value="${s.occupation}"></td>
        <td><input value="${s.address}"></td>
        <td colspan="2"></td>
      `;
    });
    hide($('editSelected'), $('deleteSelected'), $('selectAllStudents'));
    show($('saveRegistration'));
  };

  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected?')) return;
    const toDel = [...document.querySelectorAll('.sel:checked')].map(cb => +cb.closest('tr').dataset.index);
    students = students.filter((_,i) => !toDel.includes(i));
    await save('students', students);
    renderStudents();
  };

  $('saveRegistration').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach(tr => {
      const inputs = [...tr.querySelectorAll('input')].filter(i => !i.classList.contains('sel'));
      if (inputs.length === 5) {
        const [n,p,c,o,a] = inputs.map(i => i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(s => s.adm === adm);
        students[idx] = { ...students[idx], name:n, parent:p, contact:c, occupation:o, address:a };
      }
    });
    await save('students', students);
    hide($('editSelected'), $('deleteSelected'), $('saveRegistration'));
    show($('downloadRegistrationPDF'), $('shareRegistration'), $('editRegistration'));
    renderStudents();
  };

  // assume downloadRegistrationPDF, shareRegistration, editRegistration exist

  function renderStudents() {
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    students.filter(s => s.cls===cl && s.sec===sec).forEach((s,i) => {
      const st = calcStats(s);
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${i+1}</td>
        <td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>
        <td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${st.outstanding.toFixed(0)}</td><td>${st.status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    document.querySelectorAll('.add-payment-btn').forEach(b => b.onclick = () => openPaymentModal(b.dataset.adm));
  }

  function calcStats(s) {
    const dates = Object.keys(attendanceData).filter(d => !s.admissionDate || d >= s.admissionDate);
    const stats = { P:0,A:0,Lt:0,HD:0,L:0,total:0 };
    dates.forEach(d => {
      const code = (attendanceData[d]||{})[s.adm] || 'A';
      stats[code]++; stats.total++;
    });
    const auto = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
    const fine = getFineMode()==='advance'
      ? (dates.length*fineRates.A - auto) : auto;
    const paid = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
    const outstanding = fine - paid;
    const pct = stats.total ? (stats.P/stats.total*100) : 0;
    const status = (outstanding>0||pct<eligibilityPct) ? 'Debarred' : 'Eligible';
    return { ...stats, outstanding, pct, status };
  }

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm; $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent, amt = +$('paymentAmount').value||0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderAll();
  };
  $('cancelPayment').onclick     = () => hide($('paymentModal'));
  $('paymentModalClose').onclick = () => hide($('paymentModal'));
  
  // --- 9. MARK ATTENDANCE ---
  $('loadAttendance').onclick = () => {
    const attendanceBody = $('attendanceBody');
    attendanceBody.innerHTML = '';
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((stu,i) => {
      const row = document.createElement('div');
      row.className = 'attendance-row';
      const nameDiv = document.createElement('div');
      nameDiv.className = 'attendance-name';
      nameDiv.textContent = stu.name;
      const btnsDiv = document.createElement('div');
      btnsDiv.className = 'attendance-buttons';
      const codes = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };
      ['P','A','Lt','HD','L'].forEach(code => {
        const btn = document.createElement('button');
        btn.className = 'att-btn';
        btn.textContent = code;
        btn.onclick = () => {
          btnsDiv.querySelectorAll('.att-btn').forEach(b=>{
            b.classLconst cl      = $('teacherClassSelect').value;
    const sec     = $('teacherSectionSelect').value;
    const admDate = $('admissionDate').value || null;
    if (!n||!p||!c||!o||!a){ alert('All fields required'); return; }
    const adm = await genAdmNo();
    students.push({
      name: n, adm,
      parent: p, contact: c,
      occupation: o, address: a,
      cls: cl, sec,
      admissionDate: admDate
    });
    await save('students', students);
    renderAll();
  };

  // Restore registration buttons functionality
  document.getElementById('selectAllStudents').onclick = () => {
    const checked = document.getElementById('selectAllStudents').checked;
    document.querySelectorAll('#studentsBody .sel').forEach(c => c.checked = checked);
    toggleRegButtons();
  };
  function toggleRegButtons() {
    const any = !!document.querySelector('#studentsBody .sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
    $('saveRegistration').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleRegButtons();
  });
  $('editSelected').onclick = () => { /* implement edit selected rows */ };
  $('deleteSelected').onclick = async () => { /* implement delete selected */ };
  $('saveRegistration').onclick = async () => { /* implement save edited */ };

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent;
    const amt = +$('paymentAmount').value || 0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ date: new Date().toISOString().split('T')[0], amount: amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderAll();
  };
  $('cancelPayment').onclick     = () => hide($('paymentModal'));
  $('paymentModalClose').onclick = () => hide($('paymentModal'));

  // --- 9. MARK ATTENDANCE ---
  $('loadAttendance').onclick = () => {
    const attendanceBody = $('attendanceBody');
    attendanceBody.innerHTML = '';
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((stu,i) => {
      const row = document.createElement('div');
      row.className = 'attendance-row';
      const nameDiv = document.createElement('div');
      nameDiv.className = 'attendance-name';
      nameDiv.textContent = stu.name;
      const btnsDiv = document.createElement('div');
      btnsDiv.className = 'attendance-buttons';
      const codes = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };
      ['P','A','Lt','HD','L'].forEach(code => {
        const btn = document.createElement('button');
        btn.className = 'att-btn';
        btn.textContent = code;
        btn.onclick = () => {
          btnsDiv.querySelectorAll('.att-btn').forEach(b=>{
            b.classList.remove('selected');
            b.style.background = '';
            b.style.color = 'ist.remove('selected');
            b.style.background = '';
            b.style.color = '';
          });
          btn.classList.add('selected');
          btn.style.background = codes[code];
          btn.style.color = '#fff';
        };
        btnsDiv.appendChild(btn);
      });
      row.append(nameDiv, btnsDiv);
      attendanceBody.appendChild(row);
    });
    show($('attendanceBody'), $('saveAttendance'));
    hide($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), $('attendanceSummary'));
  };
  $('saveAttendance').onclick = async () => {
    const date = $('dateInput').value;
    if (!date) { alert('Please pick a date'); return; }
    attendanceData[date] = {};
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((s,i) => {
      const btn = $('attendanceBody').children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = btn ? btn.textContent : 'A';
    });
    await save('attendanceData', attendanceData);
    // build summary
    const summary = $('attendanceSummary');
    summary.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement('table');
    tbl.innerHTML = `<tr><th>Name</th><th>Status</th><th>Share</th></tr>`;
    roster.forEach(s => {
      const code = attendanceData[date][s.adm];
      const label = {P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'}[code];
      tbl.innerHTML += `<tr>
        <td>${s.name}</td><td>${label}</td>
        <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
      </tr>`;
    });
    summary.appendChild(tbl);
    summary.querySelectorAll('.share-individual').forEach(ic => {
      ic.onclick = () => {
        const adm = ic.dataset.adm;
        const st  = students.find(x=>x.adm===adm);
        const code = attendanceData[date][adm];
        const label = {P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'}[code];
        const msg = `Dear Parent, your child was ${label} on ${date}.`;
        window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`,'_blank');
      };
    });
    hide($('attendanceBody'), $('saveAttendance'));
    show($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), summary);
  };
  $('resetAttendance').onclick = () => {
    show($('attendanceBody'), $('saveAttendance'));
    hide($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), $('attendanceSummary'));
  };
  $('downloadAttendancePDF').onclick = () => {
    const date = $('dateInput').value;
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#attendanceSummary table' });
    doc.save(`attendance_${date}.pdf`);
  };
  $('shareAttendanceSummary').onclick = () => {
    const date = $('dateInput').value;
    const cl   = $('teacherClassSelect').value;
    const sec  = $('teacherSectionSelect').value;
    const header = `Attendance Report\nClass ${cl} Section ${sec} - ${date}`;
    const lines = students.filter(s=>s.cls===cl&&s.sec===sec)
      .map(s => {
        const code = attendanceData[date][s.adm];
        const label = {P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'}[code];
        return `*${s.name}*: ${label}`;
      }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`,'_blank');
  };

  // --- 10. Analytics Helpers ---
  function calcStats(s) {
    // filter dates from admissionDate onward
    const allDates = Object.keys(attendanceData)
      .filter(d => !s.admissionDate || d >= s.admissionDate);
    const stats = { P:0, A:0, Lt:0, HD:0, L:0, total:0 };
    allDates.forEach(date => {
      const recs = attendanceData[date] || {};
      const code = recs[s.adm] || 'A';
      stats[code]++; stats.total++;
    });
    // compute fine differently by mode
    const autoFine = stats.A*fineRates.A
                   + stats.Lt*fineRates.Lt
                   + stats.L*fineRates.L
                   + stats.HD*fineRates.HD;
    let fine;
    if (getFineMode() === 'advance') {
      // advance: start with full-month advance on first period
      const periodDays = allDates.length;
      const initial = periodDays * fineRates.A;
      fine = initial - autoFine;
    } else {
      // prorata: just accumulate fines
      fine = autoFine;
    }
    const paid = (paymentsData[s.adm] || []).reduce((sum,p)=>sum+p.amount,0);
    const outstanding = fine - paid;
    const pct = stats.total ? (stats.P/stats.total)*100 : 0;
    const status = (outstanding>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';
    return { ...stats, fine, outstanding, pct, status };
  }

  // --- 11. Student & Analytics Rendering ---
  function renderStudents() {
    updateCounters();
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    students.filter(s=>s.cls===cl&&s.sec===sec).forEach((s,i) => {
      const st = calcStats(s);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${i+1}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td>
        <td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${st.outstanding.toFixed(0)}</td><td>${st.status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    document.querySelectorAll('.add-payment-btn').forEach(btn=>btn.onclick=()=>openPaymentModal(btn.dataset.adm));
  }
  function renderAll() {
    renderStudents();
    if (analyticsStats.length) renderAnalytics(analyticsStats, analyticsRange.from, analyticsRange.to);
    resetViews();
  }

  // --- 12. Analytics Section ---
  $('analyticsFilterBtn').onclick   = () => show($('analyticsFilterModal'));
  $('analyticsFilterClose').onclick = () => hide($('analyticsFilterModal'));
  $('applyAnalyticsFilter').onclick = () => {
    analyticsFilter = Array.from(
      document.querySelectorAll('#analyticsFilterForm input[type="checkbox"]:checked')
    ).map(cb=>cb.value)||['all'];
    analyticsDownload = document.querySelector(
      '#analyticsFilterForm input[name="downloadMode"]:checked'
    ).value;
    hide($('analyticsFilterModal'));
    if (analyticsStats.length) renderAnalytics(analyticsStats, analyticsRange.from, analyticsRange.to);
  };
  const atg     = $('analyticsTarget'),
        asel    = $('analyticsSectionSelect'),
        atype   = $('analyticsType'),
        adate   = $('analyticsDate'),
        amonth  = $('analyticsMonth'),
        sems    = $('semesterStart'),
        seme    = $('semesterEnd'),
        ayear   = $('yearStart'),
        asearch = $('analyticsSearch'),
        loadA   = $('loadAnalytics'),
        resetA  = $('resetAnalytics');
  atg.onchange = () => {
    atype.disabled = false;
    [asel,asearch].forEach(x=>x.classList.add('hidden'));
    if (atg.value==='section') asel.classList.remove('hidden');
    if (atg.value==='student') asearch.classList.remove('hidden');
  };
  atype.onchange = () => {
    [adate,amonth,sems,seme,ayear].forEach(x=>x.classList.add('hidden'));
    resetA.classList.remove('hidden');
    if (atype.value==='date') adate.classList.remove('hidden');
    if (atype.value==='month') amonth.classList.remove('hidden');
    if (atype.value==='semester') { sems.classList.remove('hidden'); seme.classList.remove('hidden'); }
    if (atype.value==='year') ayear.classList.remove('hidden');
  };
  resetA.onclick = e => {
    e.preventDefault();
    atype.value = '';
    [adate,amonth,sems,seme,ayear, $('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions')].forEach(x=>x.classList.add('hidden'));
    resetA.classList.add('hidden');
  };
  loadA.onclick = () => {
    if (atg.value==='student' && !asearch.value.trim()) { alert('Enter adm# or name'); return; }
    // determine range
    let from, to;
    const type = atype.value;
    if (type==='date') {
      from = to = adate.value;
    } else if (type==='month') {
      const m = amonth.value, [y,mm]=m.split('-').map(Number);
      from = `${m}-01`;
      to   = `${m}-${String(new Date(y,mm,0).getDate()).padStart(2,'0')}`;
    } else if (type==='semester') {
      const s = sems.value, e = seme.value;
      const [sy,sm]=s.split('-').map(Number), [ey,em]=e.split('-').map(Number);
      from = `${s}-01`;
      to   = `${e}-${String(new Date(ey,em,0).getDate()).padStart(2,'0')}`;
    } else if (type==='year') {
      const y = ayear.value;
      from = `${y}-01-01`;
      to   = `${y}-12-31`;
    } else {
      alert('Select period'); return;
    }
    // build pool
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    let pool = students.filter(s=>s.cls===cl&&s.sec===sec);
    if (atg.value==='section') pool = pool.filter(s=>s.sec===asel.value);
    if (atg.value==='student') {
      const q = asearch.value.trim().toLowerCase();
      pool = pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));
    }
    analyticsStats = pool.map(s=>{
      const st = calcStats(s);
      return { adm: s.adm, name: s.name, ...st };
    });
    analyticsRange = { from, to };
    renderAnalytics(analyticsStats, from, to);
  };
  function renderAnalytics(stats, from, to) {
    const tbody = $('analyticsBody');
    tbody.innerHTML = '';
    stats.forEach((st,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td>
        <td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td>
        <td>${st.pct.toFixed(1)}%</td><td>PKR ${st.outstanding.toFixed(0)}</td><td>${st.status}</td>
      `;
      tbody.appendChild(tr);
    });
    $('instructions').textContent = `Period: ${from} to ${to}`;
    show($('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'));
    if (window.barChart) window.barChart.destroy();
    window.barChart = new Chart($('barChart').getContext('2d'), {
      type:'bar',
      data:{ labels:stats.map(s=>s.name), datasets:[{ label:'% Present', data:stats.map(s=>s.total?s.P/s.total*100:0) }] },
      options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
    });
    if (window.pieChart) window.pieChart.destroy();
    window.pieChart = new Chart($('pieChart').getContext('2d'), {
      type:'pie',
      data:{ labels:['Outstanding'], datasets:[{ data:[stats.reduce((sum,s)=>sum+s.outstanding,0)] }] }
    });
  }
  $('downloadAnalytics').onclick = () => {
    const filtered = analyticsStats.filter(st=>{
      if (analyticsFilter.includes('all')) return true;
      return analyticsFilter.some(opt=>{
        switch(opt){
          case 'registered': return true;
          case 'attendance':  return st.total>0;
          case 'fine':        return st.A>0||st.Lt>0||st.L>0||st.HD>0;
          case 'cleared':     return st.outstanding===0;
          case 'debarred':    return st.status==='Debarred';
          case 'eligible':    return st.status==='Eligible';
          default:            return false;
        }
      });
    });
    if (analyticsDownload==='combined') {
      const doc = new jspdf.jsPDF();
      doc.setFontSize(18); doc.text('Analytics Report',14,16);
      doc.setFontSize(12); doc.text(`Period: ${analyticsRange.from} to ${analyticsRange.to}`,14,24);
      const body = filtered.map((st,i)=>[
        i+1,st.adm,st.name,st.P,st.A,st.Lt,st.HD,st.L,st.total,
        `${st.pct.toFixed(1)}%`,`PKR ${st.outstanding.toFixed(0)}`,st.status
      ]);
      doc.autoTable({ startY:32, head:[['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']], body, styles:{fontSize:10} });
      doc.save('analytics_report.pdf');
    } else {
      filtered.forEach(st=>{
        const doc = new jspdf.jsPDF();
        doc.setFontSize(16); doc.text(`Report for ${st.name} (${st.adm})`,14,16);
        doc.setFontSize(12);
        const rows = [
          ['Present',st.P],['Absent',st.A],['Late',st.Lt],
          ['Half-Day',st.HD],['Leave',st.L],['Total',st.total],
          ['% Present',`${st.pct.toFixed(1)}%`],['Outstanding',`PKR ${st.outstanding.toFixed(0)}`],
          ['Status',st.status]
        ];
        doc.autoTable({ startY:24, head:[['Metric','Value']], body:rows, styles:{fontSize:10} });
        doc.save(`report_${st.adm}.pdf`);
      });
    }
  };
  $('shareAnalytics').onclick = () => {
    const text = analyticsStats.map((st,i)=>`${i+1}. ${st.adm} ${st.name}: ${st.pct.toFixed(1)}% / PKR ${st.outstanding.toFixed(0)}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent('Analytics Report\n'+text)}`,'_blank');
  };

  // --- 13. ATTENDANCE REGISTER ---
  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value; if (!m) { alert('Pick month'); return; }
    const [y,mm] = m.split('-').map(Number);
    const days = new Date(y,mm,0).getDate();
    const rh = $('registerHeader'), rb = $('registerBody');
    rh.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` + [...Array(days)].map((_,i)=>`<th>${i+1}</th>`).join('');
    rb.innerHTML = '';
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((s,i)=>{
      let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1; d<=days; d++){
        const key = `${m}-${String(d).padStart(2,'0')}`;
        const code = (attendanceData[key]||{})[s.adm] || 'A';
        const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };
        const style = code==='A'?'':`style="background:${colors[code]};color:#fff"`;
        row += `<td class="reg-cell" ${style}><span class="status-text">${code}</span></td>`;
      }
      const tr = document.createElement('tr'); tr.innerHTML = row; rb.appendChild(tr);
    });
    rb.querySelectorAll('.reg-cell').forEach(cell=>{
      cell.onclick = () => {
        const span = cell.querySelector('.status-text');
        const codes = ['A','P','Lt','HD','L'];
        let idx = codes.indexOf(span.textContent);
        idx = (idx+1) % codes.length;
        const code = codes[idx];
        span.textContent = code;
        if (code==='A') { cell.style.background=''; cell.style.color=''; }
        else { const colors = { P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)' }; cell.style.background=colors[code]; cell.style.color='#fff'; }
      };
    });
    show($('registerTableWrapper'), $('saveRegister'));
    hide($('loadRegister'), $('changeRegister'), $('downloadRegister'), $('shareRegister'));
  };
  $('saveRegister').onclick = async () => {
    const m = $('registerMonth').value, [y,mm] = m.split('-').map(Number);
    const days = new Date(y,mm,0).getDate();
    const rb = $('registerBody');
    Array.from(rb.children).forEach(tr=>{
      const adm = tr.children[1].textContent;
      for (let d=1; d<=days; d++){
        const code = tr.children[3+d-1].querySelector('.status-text').textContent;
        const key = `${m}-${String(d).padStart(2,'0')}`;
        attendanceData[key] = attendanceData[key]||{};
        attendanceData[key][adm] = code;
      }
    });
    await save('attendanceData', attendanceData);
    show($('changeRegister'), $('downloadRegister'), $('shareRegister'));
    hide($('saveRegister'));
  };
  $('changeRegister').onclick  = () => { hide($('registerTableWrapper'), $('changeRegister'), $('downloadRegister'), $('shareRegister')); show($('loadRegister')); };
  $('downloadRegister').onclick= () => {
    const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    doc.setFontSize(18); doc.text('Attendance Register',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#registerTable', tableWidth:'auto', styles:{fontSize:10} });
    doc.save('attendance_register.pdf');
  };
  $('shareRegister').onclick   = () => {
    const header = `Attendance Register\n${$('setupText').textContent}`;
    const rows = Array.from($('registerBody').children).map(tr =>
      Array.from(tr.children).map(td =>
        td.querySelector('.status-text') ? td.querySelector('.status-text').textContent : td.textContent
      ).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+rows.join('\n'))}`,'_blank');
  };

  // --- 14. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }

  // Initial render
  renderAll();
});
