// app.js
window.addEventListener('DOMContentLoaded', async () => {
  console.debug('App: DOMContentLoaded');

  // --- 0. Debug console (eruda) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => {
    eruda.init();
    console.debug('App: eruda initialized');
  };
  document.body.appendChild(erudaScript);

  // --- 1. IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) {
    console.error('App: idb-keyval not found');
    return;
  }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // --- 2. State & Defaults ---
  let students        = await get('students')        || [];
  let attendanceData  = await get('attendanceData')  || {};
  let finesData       = await get('finesData')       || {};
  let paymentsData    = await get('paymentsData')    || {};
  let lastAdmNo       = await get('lastAdmissionNo') || 0;
  let fineRates       = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct  = await get('eligibilityPct')  || 75;
  console.debug('App: State & Defaults loaded', { students, attendanceData, finesData, paymentsData, lastAdmNo, fineRates, eligibilityPct });

  // --- 2.5. STATUS CODES & LABELS ---
  const statusNames = {
    P : 'Present',
    A : 'Absent',
    Lt: 'Late',
    HD: 'Half Day',
    L : 'Leave'
  };
  console.debug('App: statusNames defined', statusNames);

  // --- 2.6. Admission Number Generator ---
  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 3. DOM Helpers ---
  const $    = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- 4. SETTINGS: Fines & Eligibility ---
  console.debug('App: initSettingsSection');
  (function initSettingsSection() {
    const formDiv = $('financialForm');
    const saveBtn = $('saveSettings');
    const inputs  = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map($);
    const settingsCard = document.createElement('div');
    settingsCard.id = 'settingsCard'; settingsCard.className = 'card hidden';
    const editBtn = document.createElement('button');
    editBtn.id = 'editSettings'; editBtn.className = 'btn no-print hidden';
    editBtn.textContent = 'Edit Settings';
    formDiv.parentNode.appendChild(settingsCard);
    formDiv.parentNode.appendChild(editBtn);

    // populate
    $('fineAbsent').value     = fineRates.A;
    $('fineLate').value       = fineRates.Lt;
    $('fineLeave').value      = fineRates.L;
    $('fineHalfDay').value    = fineRates.HD;
    $('eligibilityPct').value = eligibilityPct;

    saveBtn.onclick = async () => {
      console.debug('Settings: saveSettings clicked');
      fineRates = {
        A : Number($('fineAbsent').value)   || 0,
        Lt: Number($('fineLate').value)     || 0,
        L : Number($('fineLeave').value)    || 0,
        HD: Number($('fineHalfDay').value)  || 0,
      };
      eligibilityPct = Number($('eligibilityPct').value) || 0;
      await Promise.all([ save('fineRates', fineRates), save('eligibilityPct', eligibilityPct) ]);
      settingsCard.innerHTML = `
        <div class="card-content">
          <p><strong>Fine–Absent:</strong> PKR ${fineRates.A}</p>
          <p><strong>Fine–Late:</strong> PKR ${fineRates.Lt}</p>
          <p><strong>Fine–Leave:</strong> PKR ${fineRates.L}</p>
          <p><strong>Fine–Half-Day:</strong> PKR ${fineRates.HD}</p>
          <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
        </div>`;
      hide(formDiv, ...inputs, saveBtn);
      show(settingsCard, editBtn);
    };
    editBtn.onclick = () => {
      console.debug('Settings: editSettings clicked');
      hide(settingsCard, editBtn);
      show(formDiv, ...inputs, saveBtn);
    };
  })();

  // --- 5. SETUP: School, Class & Section ---
  console.debug('App: initSetup');
  (async function initSetup() {
    async function loadSetup() {
      const [sc, cl, sec] = await Promise.all([
        get('schoolName'), get('teacherClass'), get('teacherSection')
      ]);
      if (sc && cl && sec) {
        $('schoolNameInput').value      = sc;
        $('teacherClassSelect').value   = cl;
        $('teacherSectionSelect').value = sec;
        $('setupText').textContent      = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
        hide($('setupForm')); show($('setupDisplay'));
        renderStudents(); updateCounters(); resetViews();
        console.debug('Setup loaded', { school: sc, class: cl, section: sec });
      }
    }
    $('saveSetup').onclick = async e => {
      e.preventDefault();
      console.debug('Setup: saveSetup clicked');
      const sc = $('schoolNameInput').value.trim(),
            cl = $('teacherClassSelect').value,
            sec= $('teacherSectionSelect').value;
      if (!sc||!cl||!sec) { alert('Complete setup'); return; }
      await Promise.all([
        save('schoolName', sc),
        save('teacherClass', cl),
        save('teacherSection', sec)
      ]);
      await loadSetup();
    };
    $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
    await loadSetup();
  })();

  // --- 6. COUNTERS & UTILS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target, step = Math.max(1, target/100);
      let count = 0;
      (function upd() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(upd);
      })();
    });
  }
  function updateCounters() {
    const cl  = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cl).length;
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
  $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- 7. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody'); tbody.innerHTML = ''; let idx = 0;
    students.forEach((s,i) => {
      if (s.cls!==cl||s.sec!==sec) return;
      idx++;
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(r=> stats[r[s.adm]||'A']++);
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid      = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out       = totalFine - paid;
      const totalDays = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct       = totalDays ? (stats.P/totalDays)*100 : 0;
      const status    = (out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr = document.createElement('tr'); tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>
        <td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${out}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>`;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false; toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }
  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any; $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e=> e.target.classList.contains('sel') && toggleButtons());
  $('selectAllStudents').onclick = ()=> {
    document.querySelectorAll('.sel').forEach(c=>c.checked=$('selectAllStudents').checked);
    toggleButtons();
  };

  $('addStudent').onclick = async e => {
    e.preventDefault();
    console.debug('Registration: addStudent clicked');
    const n = $('studentName').value.trim(),
          p = $('parentName').value.trim(),
          c = $('parentContact').value.trim(),
          o = $('parentOccupation').value.trim(),
          a = $('parentAddress').value.trim(),
          cl= $('teacherClassSelect').value,
          sec=$('teacherSectionSelect').value;
    if (!n||!p||!c||!o||!a) { alert('All fields required'); return; }
    if (!/^\d{7,15}$/.test(c)) { alert('Contact 7–15 digits'); return; }
    const adm = await genAdmNo();
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec });
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };

  $('editSelected').onclick = () => {
    console.debug('Registration: editSelected clicked');
    document.querySelectorAll('.sel:checked').forEach(cb=>{
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
        <td colspan="3"></td>`;
    });
    hide($('editSelected')); show($('doneEditing'));
  };
  $('doneEditing').onclick = async () => {
    console.debug('Registration: doneEditing clicked');
    document.querySelectorAll('#studentsBody tr').forEach(tr=>{
      const inputs = [...tr.querySelectorAll('input:not(.sel)')];
      if (inputs.length===5) {
        const [n,p,c,o,a] = inputs.map(i=>i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(s=>s.adm===adm);
        if (idx>-1) students[idx] = { ...students[idx], name:n, parent:p, contact:c, occupation:o, address:a };
      }
    });
    await save('students', students);
    hide($('doneEditing')); show($('editSelected'), $('deleteSelected'), $('saveRegistration'));
    renderStudents(); updateCounters();
  };
  $('deleteSelected').onclick = async () => {
    console.debug('Registration: deleteSelected clicked');
    if(!confirm('Delete?')) return;
    const toDel = [...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students = students.filter((_,i)=>!toDel.includes(i));
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
  };
  $('saveRegistration').onclick = async () => {
    console.debug('Registration: saveRegistration clicked');
    if(!$('doneEditing').classList.contains('hidden')) { alert('Finish editing'); return; }
    await save('students', students);
    hide(
      document.querySelector('#student-registration .row-inline'),
      $('selectAllStudents'), $('editSelected'), $('deleteSelected'), $('saveRegistration'));
    show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  $('editRegistration').onclick = ()=> {
    console.debug('Registration: editRegistration clicked');
    show(
      document.querySelector('#student-registration .row-inline'),
      $('selectAllStudents'), $('editSelected'), $('deleteSelected'), $('saveRegistration'));
    hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  $('shareRegistration').onclick = ()=> {
    console.debug('Registration: shareRegistration clicked');
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students.filter(s=>s.cls===cl&&s.sec===sec).map(s=>{
      const tf = (finesData[s.adm]||[]).reduce((a,f)=>a+f.amount,0);
      const tp = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out= tf-tp;
      const days=Object.keys(attendanceData).length;
      const pres=Object.values(attendanceData).filter(r=>r[s.adm]==='P').length;
      const pct= days?(pres/days)*100:0;
      const st= (out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: PKR ${out}\nStatus: ${st}`;
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`, '_blank');
  };
  $('downloadRegistrationPDF').onclick = ()=>{
    console.debug('Registration: downloadRegistrationPDF clicked');
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Student List',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#studentsTable' });
    doc.save('registration.pdf');
  };

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm){ 
    console.debug('Payment: openPaymentModal for', adm);
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('savePayment').onclick = async ()=> {
    console.debug('Payment: savePayment clicked for', $('payAdm').textContent);
    const adm = $('payAdm').textContent, amt = Number($('paymentAmount').value)||0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ date: new Date().toISOString().split('T')[0], amount: amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal')); renderStudents();
  };
  $('cancelPayment').onclick = () => {
    console.debug('Payment: cancelPayment clicked');
    hide($('paymentModal'));
  };

  // --- 9. MARK ATTENDANCE ---
  console.debug('App: setting up attendance handlers');
  const dateInput              = $('dateInput'),
        loadAttendance         = $('loadAttendance'),
        saveAttendance         = $('saveAttendance'),
        resetAttendance        = $('resetAttendance'),
        downloadAttendancePDF  = $('downloadAttendancePDF'),
        shareAttendanceSummary = $('shareAttendanceSummary'),
        attendanceBody         = $('attendanceBody'),
        attendanceSummary      = $('attendanceSummary');

  loadAttendance.onclick = () => {
    console.debug('Attendance: loadAttendance clicked for date', dateInput.value);
    attendanceBody.innerHTML = '';
    attendanceSummary.innerHTML = '';
    const roster = students.filter(s=>s.cls===$('teacherClassSelect').value && s.sec===$('teacherSectionSelect').value);
    roster.forEach((s,i)=>{
      const row = document.createElement('div');
      row.className = 'attendance-row';
      const nm  = document.createElement('div');
      nm.className = 'attendance-name';
      nm.textContent = s.name;
      const btns = document.createElement('div');
      btns.className = 'attendance-buttons';
      Object.keys(statusNames).forEach(code=>{
        const b = document.createElement('button');
        b.className = 'att-btn';
        b.textContent = code;
        b.onclick = () => {
          btns.querySelectorAll('.att-btn').forEach(x=>{ x.classList.remove('selected'); x.style=''; });
          b.classList.add('selected');
          b.style.background = '#2196F3';
          b.style.color = '#fff';
        };
        btns.appendChild(b);
      });
      row.append(nm, btns);
      attendanceBody.appendChild(row);
    });
    show(attendanceBody, saveAttendance);
    hide(resetAttendance, downloadAttendancePDF, shareAttendanceSummary, attendanceSummary);
  };

  saveAttendance.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert('Pick date'); return; }
    console.debug('Attendance: saveAttendance clicked, saving for', date);
    attendanceData[date] = {};
    const roster = students.filter(s=>s.cls===$('teacherClassSelect').value && s.sec===$('teacherSectionSelect').value);
    roster.forEach((s,i)=>{
      const sel = attendanceBody.children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = sel ? sel.textContent : 'A';
    });
    await save('attendanceData', attendanceData);
    attendanceSummary.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement('table');
    tbl.innerHTML = '<tr><th>Adm#</th><th>Name</th><th>Status</th></tr>';
    roster.forEach(s => {
      const st = attendanceData[date][s.adm];
      tbl.innerHTML += `<tr><td>${s.adm}</td><td>${s.name}</td><td>${statusNames[st]}</td></tr>`;
    });
    attendanceSummary.appendChild(tbl);
    hide(attendanceBody, saveAttendance);
    show(resetAttendance, downloadAttendancePDF, shareAttendanceSummary, attendanceSummary);
  };

  resetAttendance.onclick = () => {
    console.debug('Attendance: resetAttendance clicked');
    show(attendanceBody, saveAttendance);
    hide(resetAttendance, downloadAttendancePDF, shareAttendanceSummary, attendanceSummary);
  };

  downloadAttendancePDF.onclick = () => {
    console.debug('Attendance: downloadAttendancePDF clicked for', dateInput.value);
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#attendanceSummary table' });
    doc.save(`attendance_${dateInput.value}.pdf`);
  };

  shareAttendanceSummary.onclick = () => {
    console.debug('Attendance: shareAttendanceSummary clicked for', dateInput.value);
    const date = dateInput.value;
    const roster = students.filter(s=>s.cls===$('teacherClassSelect').value && s.sec===$('teacherSectionSelect').value);
    const lines = roster.map(s =>
      `Reg#: *${s.adm}*\nName: *${s.name}*\nMonthly Attendance: Present ${Object.values(attendanceData).filter(r=>r[s.adm]==='P').length} days, Absent ${Object.values(attendanceData).filter(r=>r[s.adm]==='A').length} days`
    ).join('\n\n');
    const header = `*Attendance Analytics Report*\nReport Date: ${date}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`, '_blank');
  };

  // --- 10. ANALYTICS UI CONTROL (target/type toggles) ---
  console.debug('App: analytics UI control setup');
  $('analyticsTarget').onchange = () => {
    const t = $('analyticsTarget').value;
    $('analyticsType').disabled = false;
    ['analyticsSectionSelect','analyticsSearch'].forEach(id=>$(id).classList.add('hidden'));
    if (t === 'section') $('analyticsSectionSelect').classList.remove('hidden');
    if (t === 'student') $('analyticsSearch').classList.remove('hidden');
  };
  $('analyticsType').onchange = () => {
    ['analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart'].forEach(id=>$(id).classList.add('hidden'));
    const v = $('analyticsType').value;
    if (v==='date') $('analyticsDate').classList.remove('hidden');
    if (v==='month') $('analyticsMonth').classList.remove('hidden');
    if (v==='semester') ['semesterStart','semesterEnd'].forEach(id=>$(id).classList.remove('hidden'));
    if (v==='year') $('yearStart').classList.remove('hidden');
    hide($('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'));
    show($('resetAnalytics'));
  };
  $('resetAnalytics').onclick = e => {
    e.preventDefault();
    console.debug('Analytics: resetAnalytics clicked');
    $('analyticsType').value = '';
    ['analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart','instructions','analyticsContainer','graphs','analyticsActions']
      .forEach(id=>$(id).classList.add('hidden'));
    hide($('resetAnalytics'));
  };

  // --- 11. ANALYTICS REPORT GENERATION ---
  let lastAnalyticsResults = [];
  $('loadAnalytics').onclick = () => {
    console.debug('Analytics: loadAnalytics clicked');

    const target = $('analyticsTarget').value;
    const type   = $('analyticsType').value;
    const cls    = $('teacherClassSelect').value;
    const datesAll = Object.keys(attendanceData);

    let dates = datesAll.filter(d => {
      const dt = new Date(d);
      if (type==='date') {
        return d === $('analyticsDate').value;
      }
      if (type==='month') {
        const [y,m] = $('analyticsMonth').value.split('-').map(Number);
        return dt.getFullYear()===y && dt.getMonth()+1===m;
      }
      if (type==='semester') {
        const start = new Date($('semesterStart').value);
        const end   = new Date($('semesterEnd').value);
        return dt>=start && dt<=end;
      }
      if (type==='year') {
        return dt.getFullYear()===Number($('yearStart').value);
      }
      return false;
    }).sort();

    if (!dates.length) { alert('No records for selected range'); return; }

    lastAnalyticsResults = [];
    if (target==='section') {
      const sec = $('analyticsSectionSelect').value;
      const roster = students.filter(s=>s.cls===cls&&s.sec===sec);
      roster.forEach(s=>{
        const stats={P:0,A:0,Lt:0,HD:0,L:0};
        dates.forEach(d=>{
          const code = attendanceData[d]?.[s.adm]||'A';
          stats[code]++;
        });
        const pct = dates.length ? ((stats.P/dates.length)*100).toFixed(1) : '0.0';
        lastAnalyticsResults.push({ adm:s.adm, name:s.name, ...stats, pct });
      });
    } else {
      const query = $('analyticsSearch').value.trim().toLowerCase();
      const student = students.find(s=>s.adm===query||s.name.toLowerCase().includes(query));
      if (!student) { alert('Student not found'); return; }
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      dates.forEach(d=>{
        const code = attendanceData[d]?.[student.adm]||'A';
        stats[code]++;
      });
      const pct = dates.length ? ((stats.P/dates.length)*100).toFixed(1) : '0.0';
      lastAnalyticsResults.push({ adm:student.adm, name:student.name, ...stats, pct });
    }

    const container = $('analyticsContainer');
    container.innerHTML = '';
    const tbl = document.createElement('table');
    tbl.innerHTML = `
      <tr><th>Adm#</th><th>Name</th><th>Present</th><th>Absent</th><th>Late</th><th>Half-Day</th><th>Leave</th><th>% Present</th></tr>`;
    lastAnalyticsResults.forEach(r=>{
      tbl.innerHTML+=`
        <tr>
          <td>${r.adm}</td><td>${r.name}</td><td>${r.P}</td><td>${r.A}</td>
          <td>${r.Lt}</td><td>${r.HD}</td><td>${r.L}</td><td>${r.pct}%</td>
        </tr>`;
    });
    container.appendChild(tbl);
    hide($('instructions'));
    show($('analyticsContainer'), $('analyticsActions'));
  };

  $('shareAnalytics').onclick = () => {
    if (!lastAnalyticsResults.length) { alert('Generate analytics first'); return; }
    const header = `*Attendance Analytics*\nClass ${$('teacherClassSelect').value}`;
    const lines = lastAnalyticsResults.map(r=>
      `Adm#: ${r.adm}\nName: ${r.name}\nPresent: ${r.P}, Absent: ${r.A}, Late: ${r.Lt}, Half-Day: ${r.HD}, Leave: ${r.L}, %: ${r.pct}%`
    ).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`, '_blank);
  };

  $('downloadAnalytics').onclick = () => {
    if (!lastAnalyticsResults.length) { alert('Generate analytics first'); return; }
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Analytics Report',14,16);
    doc.autoTable({
      startY:24,
      head:[['Adm#','Name','Present','Absent','Late','Half-Day','Leave','% Present']],
      body:lastAnalyticsResults.map(r=>[r.adm,r.name,r.P,r.A,r.Lt,r.HD,r.L,`${r.pct}%`])
    });
    const now = new Date().toISOString().slice(0,10);
    doc.save(`analytics_${now}.pdf`);
  };

  // --- 13. ATTENDANCE REGISTER ---
  let lastRegisterDates = [];
  let lastRegisterStudents = [];

  $('loadRegister').onclick = () => {
    console.debug('Register: loadRegister clicked');
    const cls   = $('teacherClassSelect').value;
    const sec   = $('teacherSectionSelect').value;
    const monthDate = dateInput.value;
    if (!monthDate) { alert('Pick a date in the month for register'); return; }
    const [year, month] = monthDate.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dates = Array.from({length: daysInMonth}, (_, i) => {
      const d = i+1;
      return `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    });
    const roster = students.filter(s => s.cls===cls && s.sec===sec);
    lastRegisterDates = dates;
    lastRegisterStudents = roster;

    const wrapper = $('registerTableWrapper');
    wrapper.innerHTML = '';
    const tbl = document.createElement('table');
    tbl.id = 'registerTable';
    // header
    tbl.innerHTML = `<tr><th>Adm#</th><th>Name</th>${dates.map(d=>`<th>${d.slice(8)}</th>`).join('')}</tr>`;
    // rows
    roster.forEach(s => {
      let row = `<tr><td>${s.adm}</td><td>${s.name}</td>`;
      dates.forEach(d => {
        const code = attendanceData[d]?.[s.adm] || 'A';
        row += `<td data-date="${d}" data-adm="${s.adm}">${code}</td>`;
      });
      row += `</tr>`;
      tbl.innerHTML += row;
    });

    wrapper.appendChild(tbl);
    show(wrapper, $('changeRegister'), $('downloadRegister'), $('shareRegister'));
    hide($('loadRegister'), $('saveRegister'));
  };

  $('changeRegister').onclick = () => {
    console.debug('Register: changeRegister clicked');
    document.querySelectorAll('#registerTable td[data-date]').forEach(td => {
      const code = td.textContent;
      const select = document.createElement('select');
      Object.keys(statusNames).forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        if (k === code) opt.selected = true;
        select.appendChild(opt);
      });
      td.innerHTML = '';
      td.appendChild(select);
    });
    show($('saveRegister'));
    hide($('changeRegister'));
  };

  $('saveRegister').onclick = async () => {
    console.debug('Register: saveRegister clicked');
    document.querySelectorAll('#registerTable td[data-date]').forEach(td => {
      const date = td.dataset.date;
      const adm  = td.dataset.adm;
      const code = td.querySelector('select').value;
      attendanceData[date] = attendanceData[date] || {};
      attendanceData[date][adm] = code;
      td.textContent = code;
    });
    await save('attendanceData', attendanceData);
    show($('changeRegister'));
    hide($('saveRegister'));
  };

  $('downloadRegister').onclick = () => {
    console.debug('Register: downloadRegister clicked');
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Register',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#registerTable' });
    const filename = `register_${dateInput.value.slice(0,7)}.pdf`;
    doc.save(filename);
  };

  $('shareRegister').onclick = () => {
    console.debug('Register: shareRegister clicked');
    if (!lastRegisterStudents.length) { alert('Load register first'); return; }
    const header = `*Attendance Register*\nClass ${$('teacherClassSelect').value} Section ${$('teacherSectionSelect').value}`;
    const lines = lastRegisterStudents.map(s => {
      const entries = lastRegisterDates.map(d => {
        const code = attendanceData[d]?.[s.adm] || 'A';
        return `${d.slice(8)}: ${statusNames[code]}`;
      });
      return `*${s.name}* (Adm#: ${s.adm})\n` + entries.join(', ');
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // --- 14. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(() => console.debug('App: service worker registered'))
      .catch(console.error);
  }

}); // end DOMContentLoaded
