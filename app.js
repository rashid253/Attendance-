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
  const inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct']
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
  $('studentsBody').addEventListener('change', e => e.target.classList.contains('sel') && toggleButtons());
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
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };

  // --- 8. DOWNLOAD & SHARE HANDLERS ---
  $('downloadAttendancePDF').onclick = () => {
    const element = $('attendanceSummary');
    html2pdf().from(element).set({ filename: 'attendance.pdf' }).toPdf().get('pdf').then(pdf => {
      const blob = pdf.output('blob');
      const file = new File([blob], 'attendance.pdf', { type: 'application/pdf' });
      if (navigator.share) {
        navigator.share({ files: [file], title: 'Attendance Summary', text: 'Here is the attendance summary PDF.' })
          .catch(err => console.error('Share failed:', err));
      }
    });
  };

  $('downloadRegister').onclick = () => {
    const element = $('registerTableWrapper');
    html2pdf().from(element).set({ filename: 'register.pdf' }).toPdf().get('pdf').then(pdf => {
      const blob = pdf.output('blob');
      const file = new File([blob], 'register.pdf', { type: 'application/pdf' });
      if (navigator.share) {
        navigator.share({ files: [file], title: 'Register', text: 'Here is the attendance register PDF.' })
          .catch(err => console.error('Share failed:', err));
      }
    });
  };

  // --- 9. PAYMENT MODAL ---
  function openPaymentModal(adm){
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('paymentModalClose').onclick = () => hide($('paymentModal'));
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent,
          amt = Number($('paymentAmount').value) || 0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ date: new Date().toISOString().split('T')[0], amount: amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));

  // --- 10. MARK ATTENDANCE ---
  const dateInput = $('dateInput'),
        loadAttendanceBtn = $('loadAttendance'),
        saveAttendanceBtn = $('saveAttendance'),
        resetAttendanceBtn = $('resetAttendance'),
        attendanceBodyDiv = $('attendanceBody'),
        attendanceSummaryDiv = $('attendanceSummary');
  const statusNames = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' };
  const statusColors= { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = '';
    attendanceSummaryDiv.innerHTML = '';
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((stu,i)=>{
      const row = document.createElement('div'); row.className='attendance-row';
      const nameDiv = document.createElement('div'); nameDiv.className='attendance-name'; nameDiv.textContent=stu.name;
      const btnsDiv = document.createElement('div'); btnsDiv.className='attendance-buttons';
      Object.keys(statusNames).forEach(code=>{
        const btn = document.createElement('button'); btn.className='att-btn'; btn.textContent=code;
        btn.onclick = ()=> {
          btnsDiv.querySelectorAll('.att-btn').forEach(b=>{b.classList.remove('selected');b.style.background='';b.style.color='';});
          btn.classList.add('selected'); btn.style.background=statusColors[code]; btn.style.color='#fff';
        };
        btnsDiv.appendChild(btn);
      });
      row.append(nameDiv, btnsDiv);
      attendanceBodyDiv.appendChild(row);
    });
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, $('downloadAttendancePDF'), $('shareAttendanceSummary'), attendanceSummaryDiv);
  };

  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert('Pick date'); return; }
    attendanceData[date] = {};
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((s,i)=>{
      const btn = attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = btn? btn.textContent : 'A';
    });
    await save('attendanceData', attendanceData);

    attendanceSummaryDiv.innerHTML = `<h3>Attendance: ${date}</h3>`;
    const tbl = document.createElement('table');
    tbl.innerHTML = '<tr><th>Name</th><th>Status</th><th>Share</th></tr>';
    roster.forEach(s=>{
      const code = attendanceData[date][s.adm];
      tbl.innerHTML += `<tr><td>${s.name}</td><td>${statusNames[code]}</td><td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td></tr>`;
    });
    attendanceSummaryDiv.appendChild(tbl);
    attendanceSummaryDiv.querySelectorAll('.share-individual').forEach(ic=>ic.onclick=()=>{
      const adm = ic.dataset.adm, st = students.find(x=>x.adm===adm), code = attendanceData[date][adm];
      const msg = `Dear Parent, your child was ${statusNames[code]} on ${date}.`;
      window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`,'_blank');
    });

    hide(attendanceBodyDiv, saveAttendanceBtn);
    show(resetAttendanceBtn, $('downloadAttendancePDF'), $('shareAttendanceSummary'), attendanceSummaryDiv);
  };

  resetAttendanceBtn.onclick = () => {
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, $('downloadAttendancePDF'), $('shareAttendanceSummary'), attendanceSummaryDiv);
  };

  // --- 11. Registration Download/Share ---
  $('downloadRegistrationPDF').onclick = () => {
    const element = document.querySelector('#student-registration .row-inline');
    html2pdf().from(element).set({ filename: 'registration.pdf' }).toPdf().get('pdf').then(pdf=>{
      const blob = pdf.output('blob');
      const file = new File([blob], 'registration.pdf', { type:'application/pdf' });
      if (navigator.share) {
        navigator.share({ files:[file], title:'Registration', text:'Student Registration PDF.' }).catch(console.error);
      }
    });
  };
  $('shareRegistration').onclick = () => {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students.filter(s=>s.cls===cl&&s.sec===sec).map(s=>{
      const fines = 
        Object.entries(attendanceData).reduce((a,[d,r])=>a+(r[s.adm]==='A'?fineRates.A:0),0) +
        Object.entries(attendanceData).reduce((a,[d,r])=>a+(r[s.adm]==='Lt'?fineRates.Lt:0),0) +
        Object.entries(attendanceData).reduce((a,[d,r])=>a+(r[s.adm]==='L'?fineRates.L:0),0) +
        Object.entries(attendanceData).reduce((a,[d,r])=>a+(r[s.adm]==='HD'?fineRates.HD:0),0);
      return `${s.name} (Adm ${s.adm}) - Outstanding PKR ${fines - ((paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0))}`;
    });
    const msg = header + '\n' + lines.join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
