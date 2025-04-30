// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- 0. Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- 1. IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) { console.error('idb-keyval not found'); return; }
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
      hide(settingsCard, editBtn);
      show(formDiv, ...inputs, saveBtn);
    };
  })();

  // --- 5. SETUP: School, Class & Section ---
  (async function initSetup() {
    async function loadSetup() {
      const [sc, cl, sec] = await Promise.all([
        get('schoolName'), get('teacherClass'), get('teacherSection')
      ]);
      if (sc && cl && sec) {
        $('schoolNameInput').value      = sc;
        $('teacherClassSelect').value   = cl;
        $('teacherSectionSelect').value = sec;
        $('setupText').textContent = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
        hide($('setupForm')); show($('setupDisplay'));
        renderStudents(); updateCounters(); resetViews();
      }
    }
    $('saveSetup').onclick = async e => {
      e.preventDefault();
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
    if(!confirm('Delete?')) return;
    const toDel = [...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students = students.filter((_,i)=>!toDel.includes(i));
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
  };
  $('saveRegistration').onclick = async () => {
    if(!$('doneEditing').classList.contains('hidden')) { alert('Finish editing'); return; }
    await save('students', students);
    hide(
      document.querySelector('#student-registration .row-inline'),
      $('selectAllStudents'), $('editSelected'), $('deleteSelected'), $('saveRegistration'));
    show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  $('editRegistration').onclick = ()=> {
    show(
      document.querySelector('#student-registration .row-inline'),
      $('selectAllStudents'), $('editSelected'), $('deleteSelected'), $('saveRegistration'));
    hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  $('shareRegistration').onclick = ()=> {
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
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`,'_blank');
  };
  $('downloadRegistrationPDF').onclick = ()=>{
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Student List',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#studentsTable' });
    doc.save('registration.pdf');
  };

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm){ $('payAdm').textContent=adm; $('paymentAmount').value=''; show($('paymentModal')); }
  $('savePayment').onclick = async ()=> {
    const adm = $('payAdm').textContent, amt = Number($('paymentAmount').value)||0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ date: new Date().toISOString().split('T')[0], amount: amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal')); renderStudents();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));

  // --- 9. MARK ATTENDANCE ---
  const dateInput      = $('dateInput'),
        loadAttendance = $('loadAttendance'),
        saveAttendance = $('saveAttendance'),
        resetAttendance= $('resetAttendance'),
        downloadAttendancePDF = $('downloadAttendancePDF'),
        shareAttendanceSummary= $('shareAttendanceSummary'),
        attendanceBody = $('attendanceBody'),
        attendanceSummary = $('attendanceSummary');
  loadAttendance.onclick = () => {
    attendanceBody.innerHTML=''; attendanceSummary.innerHTML='';
    const roster = students.filter(s=>s.cls===$('teacherClassSelect').value && s.sec===$('teacherSectionSelect').value);
    roster.forEach((s,i)=>{
      const row=document.createElement('div'); row.className='attendance-row';
      const nm=document.createElement('div'); nm.className='attendance-name'; nm.textContent=s.name;
      const btns=document.createElement('div'); btns.className='attendance-buttons';
      Object.keys(statusNames).forEach(code=>{
        const b=document.createElement('button'); b.className='att-btn'; b.textContent=code;
        b.onclick=()=>{ btns.querySelectorAll('.att-btn').forEach(x=>{x.classList.remove('selected');x.style='';}); b.classList.add('selected'); b.style.background='#2196F3'; b.style.color='#fff'; };
        btns.appendChild(b);
      });
      row.append(nm,btns); attendanceBody.appendChild(row);
    });
    show(attendanceBody, saveAttendance); hide(resetAttendance, downloadAttendancePDF, shareAttendanceSummary, attendanceSummary);
  };
  saveAttendance.onclick = async ()=>{
    const date = dateInput.value; if(!date){ alert('Pick date'); return; }
    attendanceData[date]={};
    const roster = students.filter(s=>s.cls===$('teacherClassSelect').value && s.sec===$('teacherSectionSelect').value);
    roster.forEach((s,i)=>{
      const sel = attendanceBody.children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = sel?sel.textContent:'A';
    });
    await save('attendanceData', attendanceData);
    attendanceSummary.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl=document.createElement('table');
    tbl.innerHTML='<tr><th>Adm#</th><th>Name</th><th>Status</th></tr>';
    roster.forEach(s=>{
      const st=attendanceData[date][s.adm];
      tbl.innerHTML+=`<tr><td>${s.adm}</td><td>${s.name}</td><td>${statusNames[st]}</td></tr>`;
    });
    attendanceSummary.appendChild(tbl);
    hide(attendanceBody, saveAttendance);
    show(resetAttendance, downloadAttendancePDF, shareAttendanceSummary, attendanceSummary);
  };
  resetAttendance.onclick=()=>{ show(attendanceBody, saveAttendance); hide(resetAttendance, downloadAttendancePDF, shareAttendanceSummary, attendanceSummary); };
  downloadAttendancePDF.onclick = ()=>{
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#attendanceSummary table' });
    doc.save(`attendance_${dateInput.value}.pdf`);
  };
  shareAttendanceSummary.onclick=()=>{
    const date=dateInput.value;
    const roster=students.filter(s=>s.cls===$('teacherClassSelect').value && s.sec===$('teacherSectionSelect').value);
    const lines=roster.map(s=>
      `Reg#: *${s.adm}*\nName: *${s.name}*\nMonthly Attendance: Present ${Object.values(attendanceData).filter(r=>r[s.adm]==='P').length} days, Absent ${Object.values(attendanceData).filter(r=>r[s.adm]==='A').length} days`
    ).join('\n\n');
    const header=`*Attendance Analytics Report*\nReport Date: ${date}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`,'_blank');
  };

  // --- 10. ANALYTICS UI CONTROL (target/type toggles) ---
  $('analyticsTarget').onchange = () => {
    const t = $('analyticsTarget').value;
    $('analyticsType').disabled = false;
    ['analyticsSectionSelect','analyticsSearch'].forEach(id=>$(id).classList.add('hidden'));
    if(t==='section') $('analyticsSectionSelect').classList.remove('hidden');
    if(t==='student') $('analyticsSearch').classList.remove('hidden');
  };
  $('analyticsType').onchange = () => {
    ['analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart'].forEach(id=>$(id).classList.add('hidden'));
    const v = $('analyticsType').value;
    if(v==='date') $('analyticsDate').classList.remove('hidden');
    if(v==='month') $('analyticsMonth').classList.remove('hidden');
    if(v==='semester') ['semesterStart','semesterEnd'].forEach(id=>$(id).classList.remove('hidden'));
    if(v==='year') $('yearStart').classList.remove('hidden');
    hide($('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'));
    show($('resetAnalytics'));
  };
  $('resetAnalytics').onclick = e => {
    e.preventDefault();
    $('analyticsType').value='';
    ['analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart','instructions','analyticsContainer','graphs','analyticsActions']
      .forEach(id=>$(id).classList.add('hidden'));
    hide($('resetAnalytics'));
  };

  // --- 11. ANALYTICS REPORT GENERATION ---
  $('loadAnalytics').onclick = () => {
    // (Implementation as above in previous message)
  };

  // --- 12. Analytics Share & Download ---
  $('shareAnalytics').onclick = () => {
    // (Implementation as above)
  };
  $('downloadAnalytics').onclick = () => {
    // (Implementation as above)
  };

  // --- 13. ATTENDANCE REGISTER ---
  $('loadRegister').onclick = () => {
    // (Implementation as above)
  };
  $('saveRegister').onclick = async () => {
    // (Implementation as above)
  };
  $('changeRegister').onclick = () => {
    // (Implementation as above)
  };
  $('downloadRegister').onclick = () => {
    // (Implementation as above)
  };
  $('shareRegister').onclick = () => {
    // (Implementation as above)
  };

  // --- 14. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
