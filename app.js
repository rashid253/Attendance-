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

  let analyticsFilterOptions = ['all'];
  let analyticsDownloadMode  = 'combined';
  let lastAnalyticsStats     = [];
  let lastAnalyticsRange     = { from: null, to: null };
  let lastAnalyticsShare     = '';

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 3. DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- 4. SETTINGS: Fines & Eligibility ---
  const formDiv      = $('financialForm');
  const saveSettings = $('saveSettings');
  const inputs       =
  ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct']
    .map(id => $(id));
  const settingsCard = document.createElement('div');
  settingsCard.id    = 'settingsCard';
  settingsCard.className = 'card hidden';
  const editSettings = document.createElement('button');
  editSettings.id    = 'editSettings';
  editSettings.className = 'btn no-print hidden';
  editSettings.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editSettings);

  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveSettings.onclick = async () => {
    fineRates = {
      A : Number($('fineAbsent').value)   || 0,
      Lt: Number($('fineLate').value)     || 0,
      L : Number($('fineLeave').value)    || 0,
      HD: Number($('fineHalfDay').value)  || 0,
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;
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
      </div>
    `;
    hide(formDiv, saveSettings, ...inputs);
    show(settingsCard, editSettings);
  };

  editSettings.onclick = () => {
    hide(settingsCard, editSettings);
    show(formDiv, saveSettings, ...inputs);
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
    if (!sc || !cl || !sec) { alert('Complete setup'); return; }
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- 6. COUNTERS & UTILS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target/100);
      (function upd(){
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(upd);
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
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('downloadAttendancePDF'),
      $('shareAttendanceSummary'),
      $('instructions'), $('analyticsContainer'), $('graphs'),
      $('analyticsActions'),
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
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx = 0;
    students.forEach((s,i) => {
      if (s.cls!==cl || s.sec!==sec) return;
      idx++;
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.entries(attendanceData).forEach(([d,recs]) => {
        const c = recs[s.adm] || 'A';
        stats[c]++;
      });
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid       = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      const outstanding= totalFine - paid;
      const totalDays  = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct        = totalDays ? (stats.P/totalDays)*100 : 0;
      const status     = (outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>
        <td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${outstanding}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false; toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }
  function toggleButtons(){
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e =>
    e.target.classList.contains('sel') && toggleButtons()
  );
  $('selectAllStudents').onclick = () => {
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
    if(!n||!p||!c||!o||!a){alert('All fields required');return;}
    if(!/^\d{7,15}$/.test(c)){alert('Contact 7–15 digits');return;}
    const adm=await genAdmNo();
    students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls:cl,sec});
    await save('students',students);
    renderStudents();updateCounters();resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress']
      .forEach(id=>$(id).value='');
  };
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
        <td colspan="3"></td>
      `;
    });
    hide($('editSelected')); show($('doneEditing'));
  };
  $('doneEditing').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach(tr => {
      const inputs = [...tr.querySelectorAll('input:not(.sel)')];
      if(inputs.length===5){
        const [n,p,c,o,a] = inputs.map(i=>i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(x=>x.adm===adm);
        if(idx>-1) students[idx] = {...students[idx],name:n,parent:p,contact:c,occupation:o,address:a};
      }
    });
    await save('students', students);
    hide($('doneEditing'));
    show($('editSelected'), $('deleteSelected'), $('saveRegistration'));
    renderStudents(); updateCounters();
  };
  $('deleteSelected').onclick = async () => {
    if(!confirm('Delete?')) return;
    const toDel = [...document.querySelectorAll('.sel:checked')]
      .map(cb=>+cb.closest('tr').dataset.index);
    students = students.filter((_,i)=>!toDel.includes(i));
    await save('students',students);
    renderStudents(); updateCounters(); resetViews();
  };
  $('saveRegistration').onclick = async () => {
    if(!$('doneEditing').classList.contains('hidden')){ alert('Finish editing'); return; }
    await save('students',students);
    hide(document.querySelector('#student-registration .row-inline'),
         $('editSelected'), $('deleteSelected'), $('selectAllStudents'), $('saveRegistration'));
    show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  $('editRegistration').onclick = () => {
    show(document.querySelector('#student-registration .row-inline'),
         $('selectAllStudents'), $('editSelected'), $('deleteSelected'), $('saveRegistration'));
    hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  $('shareRegistration').onclick = () => {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students.filter(s=>s.cls===cl&&s.sec===sec).map(s=>{
      const tf = (Object.entries(attendanceData)
                    .reduce((a,[d,recs])=>a + (recs[s.adm]==='A'?fineRates.A:0),0) +
                  Object.entries(attendanceData)
                    .reduce((a,[d,recs])=>a + (recs[s.adm]==='Lt'?fineRates.Lt:0),0) +
                  Object.entries(attendanceData)
                    .reduce((a,[d,recs])=>a + (recs[s.adm]==='L'?fineRates.L:0),0) +
                  Object.entries(attendanceData)
                    .reduce((a,[d,recs])=>a + (recs[s.adm]==='HD'?fineRates.HD:0),0));
      const tp = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out = tf - tp;
      const totalDays = Object.keys(attendanceData).length;
      const pres = Object.values(attendanceData).filter(r=>r[s.adm]==='P').length;
      const pct = totalDays? (pres/totalDays)*100:0;
      const st = (out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: PKR ${out}\nStatus: ${st}`;
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`,'_blank');
  };
  $('downloadRegistrationPDF').onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Student List',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#studentsTable' });
    doc.save('registration.pdf');
    // Auto-share via Web Share API
    if (navigator.share && navigator.canShare) {
      const blob = doc.output('blob');
      const file = new File([blob], 'registration.pdf', { type: 'application/pdf' });
      navigator.share({ files: [file], title: 'Student List', text: $('setupText').textContent }).catch(console.error);
    }
  };

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('paymentModalClose').onclick = () => hide($('paymentModal'));
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent;
    const amt = Number($('paymentAmount').value) || 0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ date: new Date().toISOString().split('T')[0], amount: amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));

  // --- 9. MARK ATTENDANCE ---
  const dateInput             = $('dateInput');
  const loadAttendanceBtn     = $('loadAttendance');
  const saveAttendanceBtn     = $('saveAttendance');
  const resetAttendanceBtn    = $('resetAttendance');
  const downloadAttendanceBtn = $('downloadAttendancePDF');
  const shareAttendanceBtn    = $('shareAttendanceSummary');
  const attendanceBodyDiv     = $('attendanceBody');
  const attendanceSummaryDiv  = $('attendanceSummary');
  const statusNames           = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' };
  const statusColors          = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = '';
    attendanceSummaryDiv.innerHTML = '';
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((stu,i)=>{
      const row = document.createElement('div');
      row.className = 'attendance-row';
      const nameDiv = document.createElement('div');
      nameDiv.className = 'attendance-name';
      nameDiv.textContent = stu.name;
      const btnsDiv = document.createElement('div');
      btnsDiv.className = 'attendance-buttons';
      Object.keys(statusNames).forEach(code=>{
        const btn = document.createElement('button');
        btn.className = 'att-btn';
        btn.textContent = code;
        btn.onclick = ()=>{
          btnsDiv.querySelectorAll('.att-btn').forEach(b=>{
            b.classList.remove('selected'); b.style.background=''; b.style.color='';
          });
          btn.classList.add('selected');
          btn.style.background = statusColors[code];
          btn.style.color = '#fff';
        };
        btnsDiv.appendChild(btn);
      });
      row.append(nameDiv, btnsDiv);
      attendanceBodyDiv.appendChild(row);
    });
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert('Please pick a date'); return; }
    attendanceData[date] = {};
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((s,i)=>{
      const btn = attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = btn ? btn.textContent : 'A';
    });
    await save('attendanceData', attendanceData);
    attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement('table');
    tbl.innerHTML = `<tr><th>Name</th><th>Status</th><th>Share</th></tr>`;
    roster.forEach(s=>{
      const code = attendanceData[date][s.adm];
      tbl.innerHTML += `<tr>
        <td>${s.name}</td>
        <td>${statusNames[code]}</td>
        <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
      </tr>`;
    });
    attendanceSummaryDiv.appendChild(tbl);
    attendanceSummaryDiv.querySelectorAll('.share-individual').forEach(ic=>{
      ic.onclick = ()=>{
        const adm = ic.dataset.adm;
        const st = students.find(x=>x.adm===adm);
        const code = attendanceData[date][adm];
        const msg = `Dear Parent, your child was ${statusNames[code]} on ${date}.`;
        window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`,'_blank');
      };
    });
    hide(attendanceBodyDiv, saveAttendanceBtn);
    show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  resetAttendanceBtn.onclick = () => {
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  downloadAttendanceBtn.onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#attendanceSummary table' });
    doc.save(`attendance_${dateInput.value}.pdf`);
    // Auto-share via Web Share API
    if (navigator.share && navigator.canShare) {
      const blob = doc.output('blob');
      const file = new File([blob], `attendance_${dateInput.value}.pdf`, { type: 'application/pdf' });
      navigator.share({ files: [file], title: 'Attendance Report', text: $('setupText').textContent }).catch(console.error);
    }
  };

  shareAttendanceBtn.onclick = () => {
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const date = dateInput.value;
    const header = `*Attendance Report*\nClass ${cl} Section ${sec} - ${date}`;
    const lines = students.filter(s=>s.cls===cl&&s.sec===sec)
      .map(s=>`*${s.name}*: ${statusNames[attendanceData[date][s.adm]]}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines.join('\n'))}`,'_blank');
  };

  // --- 10. ANALYTICS ---
  const atg      = $('analyticsTarget');
  const asel     = $('analyticsSectionSelect');
  const atype    = $('analyticsType');
  const adate    = $('analyticsDate');
  const amonth   = $('analyticsMonth');
  const sems     = $('semesterStart');
  const seme     = $('semesterEnd');
  const ayear    = $('yearStart');
  const asearch  = $('analyticsSearch');
  const loadA    = $('loadAnalytics');
  const resetA   = $('resetAnalytics');
  const instr    = $('instructions');
  const acont    = $('analyticsContainer');
  const barCtx   = $('barChart').getContext('2d');
  const pieCtx   = $('pieChart').getContext('2d');
  let barChart, pieChart;

  $('analyticsFilterBtn').onclick   = () => show($('analyticsFilterModal'));
  $('analyticsFilterClose').onclick = () => hide($('analyticsFilterModal'));
  $('applyAnalyticsFilter').onclick = () => {
    analyticsFilterOptions =
      Array.from(document.querySelectorAll('#analyticsFilterForm input[type="checkbox"]:checked'))
           .map(cb=>cb.value)||['all'];
    analyticsDownloadMode = document.querySelector('#analyticsFilterForm input[name="downloadMode"]:checked').value;
    hide($('analyticsFilterModal'));
    if (lastAnalyticsStats.length) renderAnalytics(lastAnalyticsStats, lastAnalyticsRange.from, lastAnalyticsRange.to);
  };

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearch].forEach(x=>x.classList.add('hidden'));
    [instr, acont, resetA].forEach(x=>x.classList.add('hidden'));
    if(atg.value==='section') asel.classList.remove('hidden');
    if(atg.value==='student') asearch.classList.remove('hidden');
  };

  atype.onchange = () => {
    [adate, amonth, sems, seme, ayear].forEach(x=>x.classList.add('hidden'));
    [instr, acont, resetA].forEach(x=>x.classList.add('hidden'));
    switch(atype.value){
      case 'date':     adate.classList.remove('hidden'); break;
      case 'month':    amonth.classList.remove('hidden'); break;
      case 'semester': sems.classList.remove('hidden'); seme.classList.remove('hidden'); break;
      case 'year':     ayear.classList.remove('hidden'); break;
    }
  };

  resetA.onclick = e => {
    e.preventDefault();
    atype.value = '';
    [adate, amonth, sems, seme, ayear, instr, acont, resetA].forEach(x=>x.classList.add('hidden'));
  };

  loadA.onclick = () => {
    // 1) Validate
    if(atg.value==='student' && !asearch.value.trim()){
      alert('Please enter an admission number or name');
      return;
    }
    // 2) Range
    let from, to;
    if(atype.value==='date'){
      from = to = adate.value;
    } else if(atype.value==='month'){
      const [y,m] = amonth.value.split('-').map(Number);
      from = `${amonth.value}-01`;
      to   = `${amonth.value}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
    } else if(atype.value==='semester'){
      const [sy,sm] = sems.value.split('-').map(Number);
      const [ey,em] = seme.value.split('-').map(Number);
      from = `${sems.value}-01`;
      to   = `${seme.value}-${String(new Date(ey,em,0).getDate()).padStart(2,'0')}`;
    } else if(atype.value==='year'){
      from = `${ayear.value}-01-01`;
      to   = `${ayear.value}-12-31`;
    } else {
      alert('Select a period');
      return;
    }
    // 3) Pool
    const cls = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    let pool = students.filter(s=>s.cls===cls&&s.sec===sec);
    if(atg.value==='section') pool = pool.filter(s=>s.sec===asel.value);
    if(atg.value==='student'){
      const q = asearch.value.trim().toLowerCase();
      pool = pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));
    }
    // 4) Stats
    const stats = pool.map(s=>({ adm:s.adm, name:s.name, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      if(d<from||d>to) return;
      stats.forEach(st=>{
        const c = recs[st.adm]||'A';
        st[c]++; st.total++;
      });
    });
    stats.forEach(st=>{
      const tf = st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
      const tp = (paymentsData[st.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      st.outstanding = tf - tp;
      const pct = st.total?(st.P/st.total)*100:0;
      st.status = (st.outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
    });
    lastAnalyticsStats = stats;
    lastAnalyticsRange = { from, to };
    renderAnalytics(stats, from, to);
  };

  function renderAnalytics(stats, from, to){
    let filtered = stats;
    if(!analyticsFilterOptions.includes('all')){
      filtered = stats.filter(st=>analyticsFilterOptions.some(opt=>{
        switch(opt){
          case 'registered': return true;
          case 'attendance':  return st.total>0;
          case 'fine':        return (st.A>0||st.Lt>0||st.L>0||st.HD>0);
          case 'cleared':     return st.outstanding===0;
          case 'debarred':    return st.status==='Debarred';
          case 'eligible':    return st.status==='Eligible';
          default:            return false;
        }
      }));
    }
    const thead = $('analyticsTable').querySelector('thead tr');
    thead.innerHTML =
      ['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']
      .map(h=>`<th>${h}</th>`).join('');
    const tbody = $('analyticsBody');
    tbody.innerHTML = '';
    filtered.forEach((st,i)=>{
      const pct = st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td>
        <td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td>
        <td>${pct}%</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>
      `;
      tbody.appendChild(tr);
    });
    instr.textContent = `Period: ${from} to ${to}`;
    show(instr, acont);
    barChart?.destroy();
    barChart = new Chart(barCtx,{ type:'bar', data:{
      labels:filtered.map(st=>st.name),
      datasets:[{ label:'% Present', data:filtered.map(st=>st.total?(st.P/st.total)*100:0) }]
    }, options:{ scales:{ y:{ beginAtZero:true, max:100 } } } });
    pieChart?.destroy();
    pieChart = new Chart(pieCtx,{ type:'pie', data:{
      labels:['Outstanding'],
      datasets:[{ data:[filtered.reduce((sum,st)=>sum+st.outstanding,0)] }]
    } });
    lastAnalyticsShare = `Analytics (${from} to ${to})\n` +
      filtered.map((st,i)=>`${i+1}. ${st.adm} ${st.name}: ${((st.P/st.total)*100).toFixed(1)}% / PKR ${st.outstanding}`).join('\n');
    show($('downloadAnalytics'), $('shareAnalytics'));
  }

  $('downloadAnalytics').onclick = () => {
    const filtered = lastAnalyticsStats.filter(st=>{
      if(analyticsFilterOptions.includes('all')) return true;
      return analyticsFilterOptions.some(opt=>{
        switch(opt){
          case 'registered': return true;
          case 'attendance':  return st.total>0;
          case 'fine':        return (st.A>0||st.Lt>0||st.L>0||st.HD>0);
          case 'cleared':     return st.outstanding===0;
          case 'debarred':    return st.status==='Debarred';
          case 'eligible':    return st.status==='Eligible';
          default:            return false;
        }
      });
    });
    if(analyticsDownloadMode==='combined'){
      const doc = new jspdf.jsPDF();
      doc.setFontSize(18); doc.text('Analytics Report',14,16);
      doc.setFontSize(12); doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`,14,24);
      const body = filtered.map((st,i)=>[
        i+1, st.adm, st.name, st.P, st.A, st.Lt, st.HD, st.L,
        st.total, `${((st.P/st.total)*100).toFixed(1)}%`,
        `PKR ${st.outstanding}`, st.status
      ]);
      doc.autoTable({ startY:32, head:[['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']], body, styles:{fontSize:10} });
      doc.save('analytics_report.pdf');
      if (navigator.share && navigator.canShare) {
        const blob = doc.output('blob');
        const file = new File([blob], 'analytics_report.pdf', { type: 'application/pdf' });
        navigator.share({ files: [file], title: 'Analytics Report', text: `Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}` }).catch(console.error);
      }
    } else {
      filtered.forEach(st=>{
        const doc = new jspdf.jsPDF();
        doc.setFontSize(16); doc.text(`Report for ${st.name} (${st.adm})`,14,16);
        doc.setFontSize(12);
        const rows = [
          ['Present',st.P],['Absent',st.A],['Late',st.Lt],
          ['Half-Day',st.HD],['Leave',st.L],['Total',st.total],
          ['% Present',`${((st.P/st.total)*100).toFixed(1)}%`],
          ['Outstanding',`PKR ${st.outstanding}`],['Status',st.status]
        ];
        doc.autoTable({ startY:24, head:[['Metric','Value']], body:rows, styles:{fontSize:10} });
        const filename = `report_${st.adm}.pdf`;
        doc.save(filename);
        if (navigator.share && navigator.canShare) {
          const blob = doc.output('blob');
          const file = new File([blob], filename, { type: 'application/pdf' });
          navigator.share({ files: [file], title: `Report for ${st.name}`, text: `Analytics for ${st.name}` }).catch(console.error);
        }
      });
    }
  };
  $('shareAnalytics').onclick = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');

  // --- 11. ATTENDANCE REGISTER ---
  const loadReg   = $('loadRegister');
  const changeReg = $('changeRegister');
  const saveReg   = $('saveRegister');
  const dlReg     = $('downloadRegister');
  const shReg     = $('shareRegister');
  const rm        = $('registerMonth');
  const rh        = $('registerHeader');
  const rb        = $('registerBody');
  const regCodes  = ['A','P','Lt','HD','L'];
  const regColors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  loadReg.onclick = () => {
    const m = rm.value; if(!m){alert('Pick month');return;}
    const [y,mm] = m.split('-').map(Number);
    const days = new Date(y,mm,0).getDate();
    rh.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>`+
      [...Array(days)].map((_,i)=>`<th>${i+1}</th>`).join('');
    rb.innerHTML='';
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((s,i)=>{
      let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=days;d++){
        const key = `${m}-${String(d).padStart(2,'0')}`;
        const c = (attendanceData[key]||{})[s.adm]||'A';
        const style =
          c==='A'?'':`style="background:${regColors[c]};color:#fff"`;
        row+=`<td class="reg-cell" ${style}><span class="status-text">${c}</span></td>`;
      }
      const tr=document.createElement('tr'); tr.innerHTML=row;
      rb.appendChild(tr);
    });
    rb.querySelectorAll('.reg-cell').forEach(cell=>{
      cell.onclick=()=>{
        const span=cell.querySelector('.status-text');
        let idx=regCodes.indexOf(span.textContent);
        idx=(idx+1)%regCodes.length; const c=regCodes[idx];
        span.textContent=c;
        if(c==='A'){cell.style.background='';cell.style.color='';}
        else {cell.style.background=regColors[c];cell.style.color='#fff';}
      };
    });
    show($('registerTableWrapper'), saveReg);
    hide(loadReg, changeReg, dlReg, shReg);
  };

  saveReg.onclick = async ()=>{
    const m=rm.value; const [y,mm]=m.split('-').map(Number);
    const days=new Date(y,mm,0).getDate();
    Array.from(rb.children).forEach(tr=>{
      const adm=tr.children[1].textContent;
      for(let d=1;d<=days;d++){
        const code=tr.children[3+d-1].querySelector('.status-text').textContent;
        const key=`${m}-${String(d).padStart(2,'0')}`;
        attendanceData[key]=attendanceData[key]||{};
        attendanceData[key][adm]=code;
      }
    });
    await save('attendanceData',attendanceData);
    hide(saveReg);
    show(changeReg, dlReg, shReg);
  };

  changeReg.onclick = ()=>{
    hide($('registerTableWrapper'),changeReg,dlReg,shReg,saveReg);
    $('registerHeader').innerHTML=''; $('registerBody').innerHTML='';
    show($('loadRegister'));
  };

  dlReg.onclick = ()=>{
    const doc=new jspdf.jsPDF({orientation:'landscape',unit:'pt',format:'a4'});
    doc.setFontSize(18);doc.text('Attendance Register',14,16);
    doc.setFontSize(12);doc.text($('setupText').textContent,14,24);
    doc.autoTable({startY:32,html:'#registerTable',tableWidth:'auto',styles:{fontSize:10}});
    doc.save('attendance_register.pdf');
    // Auto-share via Web Share API
    if (navigator.share && navigator.canShare) {
      const blob = doc.output('blob');
      const file = new File([blob], 'attendance_register.pdf', { type: 'application/pdf' });
      navigator.share({ files: [file], title: 'Attendance Register', text: $('setupText').textContent }).catch(console.error);
    }
  };

  shReg.onclick = ()=>{
    const header=`Attendance Register\n${$('setupText').textContent}`;
    const rows=Array.from(rb.children).map(tr=>
      Array.from(tr.children).map(td=>
        td.querySelector('.status-text')?td.querySelector('.status-text').textContent:td.textContent
      ).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+rows.join('\n'))}`,'_blank');
  };

  // --- 12. Service Worker ---
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
