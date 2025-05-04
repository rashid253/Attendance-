// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- 0. Eruda Debug Console ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- 1. IndexedDB Helpers ---
  if (!window.idbKeyval) return console.error('idb-keyval not found');
  const { get, set } = window.idbKeyval;
  const save = (key, val) => set(key, val);

  // --- 2. State & Defaults ---
  let students       = await get('students')        || [];
  let attendanceData = await get('attendanceData')  || {};
  let paymentsData   = await get('paymentsData')    || {};
  let lastAdmNo      = await get('lastAdmissionNo') || 0;
  let fineRates      = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct = await get('eligibilityPct')  || 75;

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 3. DOM Helpers ---
  const $    = id => document.getElementById(id);
  const show = (...els) => els.forEach(e=>e&&e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e=>e&&e.classList.add('hidden'));

  // --- 4. Fines & Eligibility ---
  const formDiv      = $('financialForm');
  const saveBtn      = $('saveSettings');
  const settingsCard = document.createElement('div');
        settingsCard.id        = 'settingsCard';
        settingsCard.className = 'card hidden';
  const editBtn      = document.createElement('button');
        editBtn.id             = 'editSettings';
        editBtn.className      = 'btn no-print hidden';
        editBtn.innerHTML      = '<i class="fas fa-edit"></i> Edit Settings';
  formDiv.parentNode.append(settingsCard, editBtn);

  // Populate form
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveBtn.onclick = async () => {
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
    settingsCard.innerHTML = `
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
      </div>`;
    hide(formDiv, saveBtn);
    show(settingsCard, editBtn);
  };

  editBtn.onclick = () => {
    hide(settingsCard, editBtn);
    show(formDiv, saveBtn);
  };

  // --- 5. SETUP ---
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
      renderStudents();
      updateCounters();
      resetViews();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc  = $('schoolNameInput').value.trim();
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!sc||!cl||!sec) return alert('Complete setup');
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

  // --- 6. COUNTERS & RESET VIEWS ---
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
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  function resetViews() {
    hide(
      $('attendanceBody'),
      $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'),
      $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('instructions'),
      $('analyticsContainer'), $('graphs'), $('analyticsActions'),
      $('registerTableWrapper'),
      $('changeRegister'), $('saveRegister'),
      $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }
  $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- 7. STUDENT REGISTRATION & PAYMENT ---
  function renderStudents() {
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx = 0;
    students.forEach((s,i) => {
      if (s.cls!==cl || s.sec!==sec) return;
      idx++;
      // compute stats
      const stats = { P:0,A:0,Lt:0,HD:0,L:0 };
      Object.values(attendanceData).forEach(rec => stats[rec[s.adm]||'A']++);
      const totalFine   = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid        = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const outstanding = totalFine - paid;
      const totalDays   = Object.values(stats).reduce((a,v)=>a+v,0);
      const pct         = totalDays ? (stats.P/totalDays)*100 : 0;
      const status      = (outstanding>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';

      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td>
        <td>${s.name}</td>
        <td>${s.adm}</td>
        <td>${s.parent}</td>
        <td>${s.contact}</td>
        <td>${s.occupation}</td>
        <td>${s.address}</td>
        <td>PKR ${outstanding.toFixed(0)}</td>
        <td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleRegButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }
  function toggleRegButtons() {
    const any = !!document.querySelector('#studentsBody .sel:checked');
    $('editSelected').disabled   = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleRegButtons();
  });
  $('selectAllStudents').onclick = () => {
    const checked = $('selectAllStudents').checked;
    document.querySelectorAll('#studentsBody .sel').forEach(c=>c.checked=checked);
    toggleRegButtons();
  };

  // Add new → clear form
  $('addStudent').onclick = async e => {
    e.preventDefault();
    const name   = $('studentName').value.trim();
    const parent = $('parentName').value.trim();
    const contact= $('parentContact').value.trim();
    const occ    = $('parentOccupation').value.trim();
    const addr   = $('parentAddress').value.trim();
    const cl     = $('teacherClassSelect').value;
    const sec    = $('teacherSectionSelect').value;
    if (!name||!parent||!contact||!occ||!addr) return alert('All fields required');
    const adm = await genAdmNo();
    students.push({ name, adm, parent, contact, occupation:occ, address:addr, cls:cl, sec });
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value = '');
  };

  // Edit selected
  $('editSelected').onclick = () => {
    document.querySelectorAll('#studentsBody .sel:checked').forEach(cb => {
      const tr = cb.closest('tr');
      const i  = +tr.dataset.index;
      const s  = students[i];
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" checked></td>
        <td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"></td>
        <td>${s.adm}</td>
        <td><input value="${s.parent}"></td>
        <td><input value="${s.contact}"></td>
        <td><input value="${s.occupation}"></td>
        <td><input value="${s.address}"></td>
        <td colspan="3"></td>
      `;
    });
    hide($('editSelected'));
    show($('doneEditing'));
  };

  // Done editing
  $('doneEditing').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach(tr => {
      const inputs = [...tr.querySelectorAll('input:not(.sel)')];
      if (inputs.length === 5) {
        const [n,p,c,o,a] = inputs.map(i=>i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(s=>s.adm===adm);
        if (idx > -1) {
          students[idx] = { ...students[idx], name:n, parent:p, contact:c, occupation:o, address:a };
        }
      }
    });
    await save('students', students);
    hide($('doneEditing'));
    show($('editSelected'), $('deleteSelected'), $('saveRegistration'));
    renderStudents(); updateCounters();
  };

  // Delete selected
  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected students?')) return;
    const toDel = [...document.querySelectorAll('#studentsBody .sel:checked')]
      .map(cb=>+cb.closest('tr').dataset.index);
    students = students.filter((_,i)=>!toDel.includes(i));
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
  };

  // Save registration (lock)
  $('saveRegistration').onclick = async () => {
    await save('students', students);
    hide(
      document.querySelector('#student-registration .row-inline'),
      $('selectAllStudents'),
      $('editSelected'),
      $('deleteSelected'),
      $('saveRegistration')
    );
    show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
  };

  // Re-open registration
  $('editRegistration').onclick = () => {
    show(
      document.querySelector('#student-registration .row-inline'),
      $('selectAllStudents'),
      $('editSelected'),
      $('deleteSelected'),
      $('saveRegistration')
    );
    hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
  };

  // Share registration
  $('shareRegistration').onclick = () => {
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const header = `*Student List*\nClass ${cl} Section ${sec}`;
    const lines = students
      .filter(s=>s.cls===cl&&s.sec===sec)
      .map(s=>{
        const stats = { P:0,A:0,Lt:0,HD:0,L:0 };
        Object.values(attendanceData).forEach(r=>stats[r[s.adm]||'A']++);
        const totalFine   = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
        const paid        = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
        const outstanding = totalFine - paid;
        const totalDays   = Object.values(stats).reduce((a,v)=>a+v,0);
        const pct         = totalDays? (stats.P/totalDays)*100:0;
        const status      = (outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
        return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: PKR ${outstanding.toFixed(0)}\nStatus: ${status}`;
      })
      .join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`,'_blank');
  };

  // Download registration PDF
  $('downloadRegistrationPDF').onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Student List',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#studentsTable' });
    doc.save('registration.pdf');
  };

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
    renderStudents();
  };
  $('cancelPayment').onclick       = () => hide($('paymentModal'));
  $('paymentModalClose').onclick   = () => hide($('paymentModal'));

  // --- 9. MARK ATTENDANCE ---
  $('loadAttendance').onclick = () => {
    const body   = $('attendanceBody');
    body.innerHTML = '';
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((s,i)=>{
      const row = document.createElement('div');
      row.className = 'attendance-row';
      const nameDiv = document.createElement('div');
      nameDiv.className = 'attendance-name';
      nameDiv.textContent = s.name;
      const btnsDiv = document.createElement('div');
      btnsDiv.className = 'attendance-buttons';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const btn = document.createElement('button');
        btn.className = 'att-btn';
        btn.textContent = code;
        btn.onclick = ()=>{
          btnsDiv.querySelectorAll('.att-btn').forEach(b=>{
            b.classList.remove('selected');
            b.style.background=''; b.style.color='';
          });
          btn.classList.add('selected');
          const colors = { P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)' };
          btn.style.background=colors[code]; btn.style.color='#fff';
        };
        btnsDiv.appendChild(btn);
      });
      row.append(nameDiv, btnsDiv);
      body.appendChild(row);
    });
    show($('attendanceBody'), $('saveAttendance'));
    hide($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), $('attendanceSummary'));
  };

  $('saveAttendance').onclick = async () => {
    const date = $('dateInput').value;
    if (!date) return alert('Pick a date');
    attendanceData[date] = {};
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((s,i)=>{
      const btn = $('attendanceBody').children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = btn?btn.textContent:'A';
    });
    await save('attendanceData', attendanceData);

    const summary = $('attendanceSummary');
    summary.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement('table');
    tbl.innerHTML = `<tr><th>Name</th><th>Status</th><th>Share</th></tr>`;
    roster.forEach(s=>{
      const code  = attendanceData[date][s.adm];
      const label = {P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'}[code];
      tbl.innerHTML += `<tr>
        <td>${s.name}</td>
        <td>${label}</td>
        <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
      </tr>`;
    });
    summary.appendChild(tbl);
    summary.querySelectorAll('.share-individual').forEach(ic=>{
      ic.onclick=()=>{
        const adm   = ic.dataset.adm;
        const st    = students.find(x=>x.adm===adm);
        const code  = attendanceData[date][adm];
        const label = {P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'}[code];
        const msg   = `Dear Parent, your child was ${label} on ${date}.`;
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
    const doc  = new jspdf.jsPDF();
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
      .map(s=>{
        const code  = attendanceData[date][s.adm];
        const label = {P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'}[code];
        return `*${s.name}*: ${label}`;
      }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`,'_blank');
  };

  // --- 10. ANALYTICS SECTION ---
  const atg     = $('analyticsTarget'),
        asel    = $('analyticsSectionSelect'),
        asearch = $('analyticsSearch'),
        atype   = $('analyticsType'),
        adate   = $('analyticsDate'),
        amonth  = $('analyticsMonth'),
        sems    = $('semesterStart'),
        seme    = $('semesterEnd'),
        ayear   = $('yearStart'),
        loadA   = $('loadAnalytics'),
        resetA  = $('resetAnalytics');

  $('analyticsFilterBtn').onclick   = () => show($('analyticsFilterModal'));
  $('analyticsFilterClose').onclick = () => hide($('analyticsFilterModal'));
  $('applyAnalyticsFilter').onclick = () => {
    analyticsFilter = Array.from(
      document.querySelectorAll('#analyticsFilterForm input[type="checkbox"]:checked')
    ).map(cb=>cb.value) || ['all'];
    analyticsDownload = document.querySelector(
      '#analyticsFilterForm input[name="downloadMode"]:checked'
    ).value;
    hide($('analyticsFilterModal'));
    if (analyticsStats.length) renderAnalytics(analyticsStats, analyticsRange.from, analyticsRange.to);
  };

  atg.onchange = () => {
    atype.disabled = false;
    asel.classList.add('hidden');
    asearch.classList.add('hidden');
    if (atg.value === 'section') asel.classList.remove('hidden');
    if (atg.value === 'student') asearch.classList.remove('hidden');
  };

  atype.onchange = () => {
    [adate, amonth, sems, seme, ayear].forEach(x => x.classList.add('hidden'));
    resetA.classList.remove('hidden');
    if (atype.value === 'date')       adate.classList.remove('hidden');
    else if (atype.value === 'month') amonth.classList.remove('hidden');
    else if (atype.value === 'semester') { sems.classList.remove('hidden'); seme.classList.remove('hidden'); }
    else if (atype.value === 'year')  ayear.classList.remove('hidden');
  };

  resetA.onclick = e => {
    e.preventDefault();
    atype.value = '';
    [adate, amonth, sems, seme, ayear, $('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions')]
      .forEach(x => x.classList.add('hidden'));
    resetA.classList.add('hidden');
  };

  loadA.onclick = () => {
    if (atg.value === 'student' && !asearch.value.trim()) {
      return alert('Enter admission number or name');
    }
    // determine date range
    let from, to;
    const type = atype.value;
    if (type === 'date') {
      from = to = adate.value;
    } else if (type === 'month') {
      const [y, m] = amonth.value.split('-');
      from = `${y}-${m}-01`;
      to   = `${y}-${m}-${String(new Date(+y, +m, 0).getDate()).padStart(2, '0')}`;
    } else if (type === 'semester') {
      const [sy, sm] = sems.value.split('-').map(Number);
      const [ey, em] = seme.value.split('-').map(Number);
      from = `${sems.value}-01`;
      to   = `${seme.value}-${String(new Date(ey, em, 0).getDate()).padStart(2, '0')}`;
    } else if (type === 'year') {
      const y = ayear.value;
      from = `${y}-01-01`;
      to   = `${y}-12-31`;
    } else {
      return alert('Select a period');
    }

    // filter pool
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    let pool = students.filter(s => s.cls === cl && s.sec === sec);
    if (atg.value === 'section') pool = pool.filter(s => s.sec === asel.value);
    if (atg.value === 'student') {
      const q = asearch.value.trim().toLowerCase();
      pool = pool.filter(s => s.adm === q || s.name.toLowerCase().includes(q));
    }

    analyticsStats = pool.map(s => {
      const st = calcStats(s);
      return { adm: s.adm, name: s.name, ...st };
    });
    analyticsRange = { from, to };
    renderAnalytics(analyticsStats, from, to);
  };

  function renderAnalytics(stats, from, to) {
    const tbody = $('analyticsBody');
    tbody.innerHTML = '';
    stats.forEach((st, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${st.adm}</td>
        <td>${st.name}</td>
        <td>${st.P}</td>
        <td>${st.A}</td>
        <td>${st.Lt}</td>
        <td>${st.HD}</td>
        <td>${st.L}</td>
        <td>${st.total}</td>
        <td>${st.pct.toFixed(1)}%</td>
        <td>PKR ${st.outstanding.toFixed(0)}</td>
        <td>${st.status}</td>
      `;
      tbody.appendChild(tr);
    });
    $('instructions').textContent = `Period: ${from} to ${to}`;
    show($('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'));

    // Bar chart for % Present
    if (window.barChart) window.barChart.destroy();
    window.barChart = new Chart($('barChart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: stats.map(s => s.name),
        datasets: [{ label: '% Present', data: stats.map(s => s.total ? (s.P / s.total * 100) : 0) }]
      },
      options: { scales: { y: { beginAtZero: true, max: 100 } } }
    });

    // Pie chart for total outstanding
    if (window.pieChart) window.pieChart.destroy();
    window.pieChart = new Chart($('pieChart').getContext('2d'), {
      type: 'pie',
      data: {
        labels: ['Outstanding'],
        datasets: [{ data: [stats.reduce((sum, s) => sum + s.outstanding, 0)] }]
      }
    });
  }

  $('downloadAnalytics').onclick = () => {
    const filtered = analyticsStats.filter(st => {
      if (analyticsFilter.includes('all')) return true;
      return analyticsFilter.some(opt => {
        switch (opt) {
          case 'registered': return true;
          case 'attendance':  return st.total > 0;
          case 'fine':        return st.A > 0 || st.Lt > 0 || st.L > 0 || st.HD > 0;
          case 'cleared':     return st.outstanding === 0;
          case 'debarred':    return st.status === 'Debarred';
          case 'eligible':    return st.status === 'Eligible';
        }
      });
    });

    if (analyticsDownload === 'combined') {
      const doc = new jspdf.jsPDF();
      doc.setFontSize(18); doc.text('Analytics Report', 14, 16);
      doc.setFontSize(12); doc.text(`Period: ${analyticsRange.from} to ${analyticsRange.to}`, 14, 24);
      const body = filtered.map((st, i) => ([
        i+1, st.adm, st.name, st.P, st.A, st.Lt, st.HD, st.L, st.total,
        `${st.pct.toFixed(1)}%`, `PKR ${st.outstanding.toFixed(0)}`, st.status
      ]));
      doc.autoTable({
        startY: 32,
        head: [['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']],
        body,
        styles: { fontSize: 10 }
      });
      doc.save('analytics_report.pdf');
    } else {
      filtered.forEach((st, i) => {
        const doc = new jspdf.jsPDF();
        doc.setFontSize(16); doc.text(`Report for ${st.name} (${st.adm})`, 14, 16);
        doc.setFontSize(12);
        const rows = [
          ['Present', st.P],
          ['Absent', st.A],
          ['Late', st.Lt],
          ['Half-Day', st.HD],
          ['Leave', st.L],
          ['Total', st.total],
          ['% Present', `${st.pct.toFixed(1)}%`],
          ['Outstanding', `PKR ${st.outstanding.toFixed(0)}`],
          ['Status', st.status]
        ];
        doc.autoTable({
          startY: 24,
          head: [['Metric','Value']],
          body: rows,
          styles: { fontSize: 10 }
        });
        doc.save(`report_${st.adm}.pdf`);
      });
    }
  };

  $('shareAnalytics').onclick = () => {
    const text = analyticsStats.map((st, i) =>
      `${i+1}. ${st.adm} ${st.name}: ${st.pct.toFixed(1)}% / PKR ${st.outstanding.toFixed(0)}`
    ).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent('Analytics Report\n'+text)}`, '_blank');
  };

  // --- 11. ATTENDANCE REGISTER ---
  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value;
    if (!m) return alert('Pick a month');
    const [y, mm] = m.split('-').map(Number);
    const days = new Date(y, mm, 0).getDate();
    const rh = $('registerHeader'), rb = $('registerBody');
    rh.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
      [...Array(days)].map((_,i) => `<th>${i+1}</th>`).join('');
    rb.innerHTML = '';

    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s => s.cls===cl && s.sec===sec);
    roster.forEach((s, i) => {
      let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1; d<=days; d++) {
        const key = `${m}-${String(d).padStart(2,'0')}`;
        const code = (attendanceData[key]||{})[s.adm] || 'A';
        const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };
        const style = code==='A' ? '' : `style="background:${colors[code]};color:#fff"`;
        row += `<td class="reg-cell" ${style}><span class="status-text">${code}</span></td>`;
      }
      const tr = document.createElement('tr');
      tr.innerHTML = row;
      rb.appendChild(tr);
    });

    rb.querySelectorAll('.reg-cell').forEach(cell => {
      cell.onclick = () => {
        const span = cell.querySelector('.status-text');
        const codes = ['A','P','Lt','HD','L'];
        let idx = codes.indexOf(span.textContent);
        idx = (idx + 1) % codes.length;
        const code = codes[idx];
        span.textContent = code;
        if (code==='A') {
          cell.style.background=''; cell.style.color='';
        } else {
          const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };
          cell.style.background = colors[code];
          cell.style.color = '#fff';
        }
      };
    });

    show($('registerTableWrapper'), $('saveRegister'));
    hide($('loadRegister'), $('changeRegister'), $('downloadRegister'), $('shareRegister'));
  };

  $('saveRegister').onclick = async () => {
    const m = $('registerMonth').value;
    const [y, mm] = m.split('-').map(Number);
    const days = new Date(y, mm, 0).getDate();
    const rb = $('registerBody');
    Array.from(rb.children).forEach(tr => {
      const adm = tr.children[1].textContent;
      for (let d=1; d<=days; d++) {
        const code = tr.children[3 + d - 1].querySelector('.status-text').textContent;
        const key = `${m}-${String(d).padStart(2,'0')}`;
        attendanceData[key] = attendanceData[key] || {};
        attendanceData[key][adm] = code;
      }
    });
    await save('attendanceData', attendanceData);

    show($('changeRegister'), $('downloadRegister'), $('shareRegister'));
    hide($('saveRegister'));
  };

  $('changeRegister').onclick = () => {
    hide($('registerTableWrapper'), $('changeRegister'), $('downloadRegister'), $('shareRegister'));
    show($('loadRegister'));
  };

  $('downloadRegister').onclick = () => {
    const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    doc.setFontSize(18); doc.text('Attendance Register', 14, 16);
    doc.setFontSize(12); doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 32, html: '#registerTable', tableWidth: 'auto', styles: { fontSize: 10 } });
    doc.save('attendance_register.pdf');
  };

  $('shareRegister').onclick = () => {
    const header = `Attendance Register\n${$('setupText').textContent}`;
    const rows = Array.from($('registerBody').children).map(tr =>
      Array.from(tr.children).map(td => {
        const span = td.querySelector('.status-text');
        return span ? span.textContent : td.textContent;
      }).join(' ')
    ).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows)}`, '_blank');
  };

  // --- 12. SERVICE WORKER ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }

  // --- INITIAL RENDER ---
  renderStudents();
  updateCounters();
  resetViews();
