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

  // --- 2. DOM helper ---
  const $ = id => document.getElementById(id);

  // --- 3. Load persisted data ---
  let students       = (await get('students'))       || [];
  let attendanceData = (await get('attendanceData')) || {};
  let paymentsData   = (await get('paymentsData'))   || [];
  let fineRates      = (await get('fineRates'))      || { A:0, Lt:0, L:0, HD:0 };
  let eligibilityPct = (await get('eligibilityPct')) || 0;

  // --- Helpers to show/hide ---
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- 4. SETTINGS: Fines & Eligibility ---
  const formDiv     = $('financialForm');
  const saveBtn     = $('saveSettings');
  const inputs      = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map($);
  const settingsCard = document.createElement('div');
  settingsCard.id    = 'settingsCard';
  settingsCard.className = 'card hidden';
  const editBtn      = document.createElement('button');
  editBtn.id         = 'editSettings';
  editBtn.className  = 'btn no-print hidden';
  editBtn.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editBtn);

  // initialize
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
    renderCriteria();
    hide(formDiv);
    show(editBtn);
  };
  editBtn.onclick = () => {
    show(formDiv);
    hide(settingsCard, editBtn);
  };

  // --- 5. SETUP: School & Teacher ---
  const saveSetup       = $('saveSetup');
  const editSetup       = $('editSetup');
  const setupForm       = $('setupForm');
  const setupDisplay    = $('setupDisplay');
  const setupText       = $('setupText');
  const schoolNameInput = $('schoolNameInput');
  const teacherClassSelect   = $('teacherClassSelect');
  const teacherSectionSelect = $('teacherSectionSelect');

  async function loadSetup() {
    const sc = await get('schoolName');
    const cl = await get('teacherClass');
    const sec= await get('teacherSection');
    if (sc && cl && sec) {
      schoolNameInput.value      = sc;
      teacherClassSelect.value   = cl;
      teacherSectionSelect.value = sec;
      setupText.textContent      = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide(setupForm);
      show(setupDisplay);
      renderStudents();
      updateCounters();
      resetViews();
    }
  }

  saveSetup.onclick = async e => {
    e.preventDefault();
    const sc  = schoolNameInput.value.trim();
    const cl  = teacherClassSelect.value;
    const sec = teacherSectionSelect.value;
    if (!sc || !cl || !sec) { alert('Complete setup'); return; }
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    await loadSetup();
  };
  editSetup.onclick = e => { e.preventDefault(); show(setupForm); hide(setupDisplay); };
  await loadSetup();

  // --- 6. COUNTERS & UTILS ---
  function updateCounters() {
    const total = students.filter(s => s.cls === teacherClassSelect.value && s.sec === teacherSectionSelect.value).length;
    $('sectionCount').dataset.target = total;
    // classCount & schoolCount can be similarly set
  }
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.ceil(target / 50);
      const tick = () => {
        count += step;
        if (count >= target) { span.textContent = target; }
        else { span.textContent = count; requestAnimationFrame(tick); }
      };
      tick();
    });
  }
  updateCounters();
  animateCounters();

  function resetViews() {
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('analyticsChart'), $('analyticsActions'), $('analyticsTable'),
      $('registerTableWrapper'), $('changeRegister'), $('saveRegister'),
      $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }
  teacherClassSelect.onchange = () => { renderStudents(); updateCounters(); resetViews(); };
  teacherSectionSelect.onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- 7. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl = teacherClassSelect.value, sec = teacherSectionSelect.value;
    const tbody = $('studentsBody'); tbody.innerHTML = '';
    let idx = 0;
    students.forEach((s,i)=>{
      if (s.cls!==cl || s.sec!==sec) return;
      idx++;
      const stats = {P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(r=>stats[r[s.adm]||'A']++);
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid      = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out       = totalFine - paid;
      const totalDays = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct       = totalDays ? (stats.P/totalDays)*100 : 0;
      const status    = (out>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>
        <td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${out}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-money-bill-wave"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }
  function toggleButtons(){
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e=> {
    if (e.target.classList.contains('sel')) toggleButtons();
  });
  $('selectAllStudents').onclick = ()=> {
    const check = $('selectAllStudents').checked;
    document.querySelectorAll('.sel').forEach(c=>c.checked = check);
    toggleButtons();
  };

  $('addStudent').onclick=async e=>{
    e.preventDefault();
    const n = $('studentName').value.trim(),
          p = $('parentName').value.trim(),
          c = $('parentContact').value.trim(),
          o = $('parentOccupation').value.trim(),
          a = $('parentAddress').value.trim(),
          cl = teacherClassSelect.value,
          sec= teacherSectionSelect.value;
    if (!n||!p||!c||!o||!a) { alert('All fields required'); return; }
    if (!/^\d{7,15}$/.test(c)) { alert('Contact 7–15 digits'); return; }
    const adm = Date.now().toString().slice(-6);  // simple adm generator
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec });
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };

  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach(cb=>{
      const tr = cb.closest('tr'), i = +tr.dataset.index, s = students[i];
      tr.innerHTML = `
        <td></td><td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"></td>
        <td>${s.adm}</td>
        <td><input value="${s.parent}"></td>
        <td><input value="${s.contact}"></td>
        <td><input value="${s.occupation}"></td>
        <td><input value="${s.address}"></td>
        <td>${tr.children[8].textContent}</td><td>${tr.children[9].textContent}</td><td></td>
      `;
    });
    hide($('editSelected'), $('deleteSelected'));
    show($('doneEditing'));
  };
  $('doneEditing').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach(tr=>{
      const inputs = [...tr.querySelectorAll('input:not(.sel)')];
      if (inputs.length===5) {
        const [n,p,c,o,a] = inputs.map(i=>i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(s=>s.adm===adm);
        students[idx] = { ...students[idx], name:n, parent:p, contact:c, occupation:o, address:a };
      }
    });
    await save('students', students);
    hide($('doneEditing'));
    show($('editSelected'), $('deleteSelected'), $('saveRegistration'));
    renderStudents(); updateCounters();
  };
  $('deleteSelected').onclick=async()=>{
    if (!confirm('Delete?')) return;
    const toDel = [...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students = students.filter((_,i)=>!toDel.includes(i));
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
  };
  $('saveRegistration').onclick=async()=>{
    if (!$('doneEditing').classList.contains('hidden')) { alert('Finish editing'); return; }
    await save('students', students);
    hide($('editSelected'), $('deleteSelected'), $('selectAllStudents'), $('saveRegistration'));
    show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  $('editRegistration').onclick=()=>{ 
    show($('editSelected'), $('deleteSelected'), $('selectAllStudents'), $('saveRegistration'));
    hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  $('shareRegistration').onclick=()=>{
    const cl = teacherClassSelect.value, sec = teacherSectionSelect.value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students.filter(s=>s.cls===cl&&s.sec===sec).map(s=>{
      const tf = (attendanceData ? 0 : 0); // replace with real calc if needed
      return `*${s.name}*\nAdm#: ${s.adm}`;
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`, '_blank');
  };
  $('downloadRegistrationPDF').onclick=()=>{
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Student List',14,16);
    doc.autoTable({ startY:32, html:'#studentsTable' });
    doc.save('registration.pdf');
  };

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('savePayment').onclick=async()=>{
    const adm = $('payAdm').textContent, amt = Number($('paymentAmount').value)||0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));

  // --- 9. MARK ATTENDANCE ---
  const loadAttendanceBtn    = $('loadAttendance'),
        attendanceBodyDiv    = $('attendanceBody'),
        attendanceSummaryDiv = $('attendanceSummary'),
        saveAttendanceBtn    = $('saveAttendance'),
        resetAttendanceBtn   = $('resetAttendance'),
        downloadAttendanceBtn= $('downloadAttendancePDF'),
        shareAttendanceBtn   = $('shareAttendanceSummary');
  const statusNames  = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' };
  const statusColors = { P:'#28a745', A:'#dc3545', Lt:'#ffc107', HD:'#fd7e14', L:'#17a2b8' };

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = '';
    const date = $('dateInput').value;
    const roster = students.filter(s=>s.cls===teacherClassSelect.value && s.sec===teacherSectionSelect.value);
    roster.forEach((stu,i)=>{
      const row = document.createElement('div'); row.className='attendance-row';
      const nameDiv = document.createElement('div'); nameDiv.className='attendance-name'; nameDiv.textContent=stu.name;
      const btnsDiv = document.createElement('div'); btnsDiv.className='attendance-buttons';
      Object.keys(statusNames).forEach(code=>{
        const btn = document.createElement('button');
        btn.className='att-btn'; btn.textContent=code;
        btn.onclick = () => {
          btnsDiv.querySelectorAll('.att-btn').forEach(b=>{
            b.classList.remove('selected'); b.style.background=''; b.style.color='';
          });
          btn.classList.add('selected'); btn.style.background=statusColors[code]; btn.style.color='#fff';
          attendanceData[`${date}`] = attendanceData[date]||{};
          attendanceData[date][stu.adm] = code;
        };
        btnsDiv.appendChild(btn);
      });
      row.appendChild(nameDiv); row.appendChild(btnsDiv);
      attendanceBodyDiv.appendChild(row);
    });
    show(attendanceBodyDiv, saveAttendanceBtn, resetAttendanceBtn);
  };
  saveAttendanceBtn.onclick = async()=>{
    await save('attendanceData', attendanceData);
    alert('Attendance saved');
  };
  resetAttendanceBtn.onclick = () => {
    location.reload();
  };
  downloadAttendanceBtn.onclick = () => {
    const doc=new jspdf.jsPDF(); doc.setFontSize(18); doc.text('Attendance',14,16);
    doc.autoTable({ html:'#attendanceSection table' });
    doc.save('attendance.pdf');
  };
  shareAttendanceBtn.onclick = () => {
    // similar to shareRegistration
  };

  // --- 10. ANALYTICS ---
  const loadA    = $('loadAnalytics'),
        resetA   = $('resetAnalytics'),
        acont    = $('analyticsContainer'),
        aacts    = $('analyticsActions');

  function fetchAnalytics() {
    const stats = [];
    // build stats from students, attendanceData, paymentsData, fineRates, eligibilityPct
    students.forEach(s=>{
      // example stub:
      stats.push({
        adm:s.adm, name:s.name, P:0, A:0, Lt:0, HD:0, L:0,
        total:0, pct:0, outstanding:0, outstandingValue:0, status:'Eligible'
      });
    });
    return stats;
  }

  // Render analytics table and chart
  function renderAnalytics(data) {
    const tbody = $('analyticsTable').querySelector('tbody');
    tbody.innerHTML = '';
    data.forEach((st,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td>
        <td>${st.total}</td><td>${st.pct}%</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>
      `;
      tbody.appendChild(tr);
    });
    renderKPIs(data);
    renderChart(data);
  }

  function loadAnalytics() {
    const stats = fetchAnalytics();
    renderAnalytics(stats);
    show($('analyticsChart'), $('analyticsActions'), $('analyticsTable'));
  }
  $('loadAnalytics').onclick = loadAnalytics;
  $('resetAnalytics').onclick = () => resetViews();

  // --- 11. ATTENDANCE REGISTER ---
  const loadReg   = $('loadRegister'),
        saveReg   = $('saveRegister'),
        dlReg     = $('downloadRegister'),
        shReg     = $('shareRegister'),
        rm        = $('registerMonth'),
        rh        = $('registerHeader'),
        rb        = $('registerBody'),
        rw        = $('registerTableWrapper');

  loadReg.onclick = () => {
    const m = rm.value; if (!m) { alert('Pick month'); return; }
    const [y,mm] = m.split('-').map(Number), days = new Date(y,mm,0).getDate();
    rh.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` + Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    rb.innerHTML = '';
    students.filter(s=>s.cls===teacherClassSelect.value&&s.sec===teacherSectionSelect.value)
      .forEach((s,i)=>{
        const tr=document.createElement('tr');
        tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
          Array.from({length:days},(_,d)=>{
            const key=`${m}-${String(d+1).padStart(2,'0')}`;
            const code=attendanceData[key]&&attendanceData[key][s.adm]||'A';
            return `<td class="reg-cell"><span class="status-text">${code}</span></td>`;
          }).join('');
        rb.appendChild(tr);
      });
    show(rw, saveReg);
  };
  saveReg.onclick = async()=>{
    await save('attendanceData', attendanceData);
    alert('Register saved');
  };
  dlReg.onclick = () => {
    // similar PDF export
  };
  shReg.onclick = () => {
    // similar share
  };

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }

});
