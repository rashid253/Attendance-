// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- 0. Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- 1. idb-keyval setup ---
  if (!window.idbKeyval) return console.error('idb-keyval missing');
  const { get, set } = window.idbKeyval;
  const save = (key, val) => set(key, val);

  // --- 2. State & Defaults ---
  let students       = await get('students')        || [];
  let attendanceData = await get('attendanceData')  || {};
  let paymentsData   = await get('paymentsData')    || {};
  let lastAdmNo      = await get('lastAdmissionNo') || 0;
  let fineRates      = await get('fineRates')       || { A:50, Lt:20, L:10, HD:0 };
  let eligibilityPct = await get('eligibilityPct')  || 75;

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 3. DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // Cache registration form row
  const regForm = document.querySelector('#student-registration .row-inline');

  // --- 4. SETTINGS: Fines & Eligibility ---
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;
  $('saveSettings').onclick = async () => {
    fineRates = {
      A : Number($('fineAbsent').value)   || 0,
      Lt: Number($('fineLate').value)     || 0,
      L : Number($('fineLeave').value)    || 0,
      HD: Number($('fineHalfDay').value)  || 0
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);
    alert('Settings saved');
  };

  // --- 5. SETUP: School, Class, Section ---
  async function loadSetup() {
    const [school, cls, sec] = await Promise.all([
      get('schoolName'), get('teacherClass'), get('teacherSection')
    ]);
    if (school && cls && sec) {
      $('schoolNameInput').value      = school;
      $('teacherClassSelect').value   = cls;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent      = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      hide($('setupForm')); show($('setupDisplay'));
      renderStudents(); updateCounters(); resetViews();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const school = $('schoolNameInput').value.trim(),
          cls    = $('teacherClassSelect').value,
          sec    = $('teacherSectionSelect').value;
    if (!school||!cls||!sec) { alert('Complete setup'); return; }
    await Promise.all([
      save('schoolName', school),
      save('teacherClass', cls),
      save('teacherSection', sec)
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- 6. COUNTERS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target/100);
      (function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
      })();
    });
  }
  function updateCounters() {
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cls&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cls).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

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

  // --- 7. STUDENT REGISTRATION (with fine, status, share) ---
  function renderStudents() {
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx = 0;
    students.forEach((s,i) => {
      if (s.cls!==cls || s.sec!==sec) return;
      idx++;
      // attendance tally
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => { stats[rec[s.adm]||'A']++; });
      // fines & outstanding
      const totalFine   = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const totalPaid   = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const outstanding = totalFine - totalPaid;
      // attendance %
      const days        = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pctPresent  = days ? (stats.P/days)*100 : 0;
      // status
      const status      = (outstanding>0 || pctPresent<eligibilityPct) ? 'Debarred' : 'Eligible';

      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>₹ ${outstanding}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
        <td><i class="fas fa-share-alt share-row" data-adm="${s.adm}"></i></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b => b.onclick = () => openPaymentModal(b.dataset.adm));
    document.querySelectorAll('.share-row').forEach(ic => ic.onclick = () => {
      const adm = ic.dataset.adm;
      const s = students.find(x=>x.adm===adm);
      const msg = `*${s.name}*\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    });
  }
  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => { if (e.target.classList.contains('sel')) toggleButtons(); });
  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(cb => cb.checked = $('selectAllStudents').checked);
    toggleButtons();
  };

  // Registration CRUD
  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n = $('studentName').value.trim(),
          p = $('parentName').value.trim(),
          c = $('parentContact').value.trim(),
          o = $('parentOccupation').value.trim(),
          a = $('parentAddress').value.trim(),
          cl= $('teacherClassSelect').value,
          sc= $('teacherSectionSelect').value;
    if (!n||!p||!c||!o||!a) { alert('All fields required'); return; }
    if (!/^\d{7,15}$/.test(c)) { alert('Contact must be 7–15 digits'); return; }
    const adm = await genAdmNo();
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec:sc });
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id => $(id).value='');
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
      if (inputs.length === 5) {
        const [n,p,c,o,a] = inputs.map(i => i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(s=>s.adm===adm);
        if (idx > -1) students[idx] = {...students[idx], name:n, parent:p, contact:c, occupation:o, address:a};
      }
    });
    await save('students', students);
    hide($('doneEditing')); show($('editSelected'), $('deleteSelected'), $('saveRegistration'));
    renderStudents(); updateCounters();
  };
  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected?')) return;
    const toDel = [...document.querySelectorAll('.sel:checked')].map(cb => +cb.closest('tr').dataset.index);
    students = students.filter((_,i)=>!toDel.includes(i));
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
  };
  $('saveRegistration').onclick = async () => {
    if (!$('doneEditing').classList.contains('hidden')) { alert('Finish editing first'); return; }
    await save('students', students);
    hide(regForm, $('editSelected'), $('deleteSelected'), $('selectAllStudents'), $('saveRegistration'));
    show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  $('editRegistration').onclick = () => {
    show(regForm, $('selectAllStudents'), $('editSelected'), $('deleteSelected'), $('saveRegistration'));
    hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  $('shareRegistration').onclick = () => {
    const cl = $('teacherClassSelect').value, sc = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sc}`;
    const lines = students.filter(s=>s.cls===cl&&s.sec===sc).map(s=>{
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(r=>stats[r[s.adm]||'A']++);
      const tf=stats.A*fineRates.A+stats.Lt*fineRates.Lt+stats.L*fineRates.L+stats.HD*fineRates.HD;
      const tp=(paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out=tf-tp, days=stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct=days?((stats.P/days)*100).toFixed(1):'0.0';
      const st=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: ₹${out}\nAttend: ${pct}%\nStatus: ${st}`;
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`, '_blank');
  };
  $('downloadRegistrationPDF').onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Student List',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#studentsTable' });
    window.open(doc.output('bloburl'),'_blank'); doc.save('registration.pdf');
  };

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm; $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent, amt = Number($('paymentAmount').value)||0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal')); renderStudents();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));

  // --- 9. MARK ATTENDANCE ---
  const dateInput = $('dateInput'),
        loadAttendanceBtn    = $('loadAttendance'),
        saveAttendanceBtn    = $('saveAttendance'),
        resetAttendanceBtn   = $('resetAttendance'),
        downloadAttendanceBtn= $('downloadAttendancePDF'),
        shareAttendanceBtn   = $('shareAttendanceSummary'),
        attendanceBodyDiv    = $('attendanceBody'),
        attendanceSummaryDiv = $('attendanceSummary'),
        statusNames = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' },
        statusColors= { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML=''; attendanceSummaryDiv.innerHTML='';
    const cl=$('teacherClassSelect').value, sc=$('teacherSectionSelect').value;
    const roster=students.filter(s=>s.cls===cl&&s.sec===sc);
    roster.forEach((stu,i)=>{ 
      const row=document.createElement('div'); row.className='attendance-row';
      const nd=document.createElement('div'); nd.className='attendance-name'; nd.textContent=stu.name;
      const btns=document.createElement('div'); btns.className='attendance-buttons';
      Object.keys(statusNames).forEach(code=>{
        const btn=document.createElement('button'); btn.className='att-btn'; btn.textContent=code;
        btn.onclick=()=>{ btns.querySelectorAll('.att-btn').forEach(b=>{b.classList.remove('selected');b.style.background='';b.style.color='';}); btn.classList.add('selected'); btn.style.background=statusColors[code]; btn.style.color='#fff'; };
        btns.appendChild(btn);
      });
      row.append(nd,btns); attendanceBodyDiv.appendChild(row);
    });
    show(attendanceBodyDiv, saveAttendanceBtn); hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value; if(!date){alert('Pick a date');return;}
    attendanceData[date] = {};
    const cl=$('teacherClassSelect').value, sc=$('teacherSectionSelect').value;
    const roster=students.filter(s=>s.cls===cl&&s.sec===sc);
    roster.forEach((s,i)=>{
      const btn = attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = btn ? btn.textContent : 'A';
    });
    await save('attendanceData', attendanceData);

    attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl=document.createElement('table');
    tbl.innerHTML = `<tr><th>Name</th><th>Status</th><th>Share</th></tr>`;
    roster.forEach(s=>{
      const code=attendanceData[date][s.adm];
      tbl.innerHTML += `<tr><td>${s.name}</td><td>${statusNames[code]}</td><td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td></tr>`;
    });
    attendanceSummaryDiv.appendChild(tbl);
    attendanceSummaryDiv.querySelectorAll('.share-individual').forEach(ic=>ic.onclick=()=>{
      const adm=ic.dataset.adm, st=students.find(x=>x.adm===adm), c=attendanceData[date][adm];
      const msg=`Dear Parent, your child was ${statusNames[c]} on ${date}.`;
      window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`, '_blank');
    });

    hide(saveAttendanceBtn, attendanceBodyDiv); show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  resetAttendanceBtn.onclick = () => { show(attendanceBodyDiv, saveAttendanceBtn); hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv); };

  downloadAttendanceBtn.onclick = () => {
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#attendanceSummary table' });
    window.open(doc.output('bloburl'), '_blank'); doc.save(`attendance_${dateInput.value}.pdf`);
  };

  shareAttendanceBtn.onclick = () => {
    const cl=$('teacherClassSelect').value, sc=$('teacherSectionSelect').value, d=dateInput.value;
    const header=`*Attendance Report*\nClass ${cl} Section ${sc} - ${d}`;
    const lines=students.filter(s=>s.cls===cl&&s.sec===sc).map(s=>`*${s.name}*: ${statusNames[attendanceData[d][s.adm]]}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`, '_blank');
  };

  // --- 10. ANALYTICS ---
  const atg=$('analyticsTarget'), asel=$('analyticsSectionSelect'), atype=$('analyticsType'),
        adate=$('analyticsDate'), amonth=$('analyticsMonth'), sems=$('semesterStart'),
        seme=$('semesterEnd'), ayear=$('yearStart'), asearch=$('analyticsSearch'),
        loadA=$('loadAnalytics'), resetA=$('resetAnalytics'),
        instr=$('instructions'), acont=$('analyticsContainer'),
        graphs=$('graphs'), aacts=$('analyticsActions'),
        barCtx=$('barChart').getContext('2d'), pieCtx=$('pieChart').getContext('2d');
  let barChart, pieChart, lastAnalyticsShare='';

  atg.onchange = () => {
    atype.disabled = false; [asel, asearch].forEach(x=>x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach(x=>x.classList.add('hidden'));
    if(atg.value==='section') asel.classList.remove('hidden');
    if(atg.value==='student') asearch.classList.remove('hidden');
  };
  atype.onchange = () => {
    [adate, amonth, sems, seme, ayear].forEach(x=>x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach(x=>x.classList.add('hidden'));
    resetA.classList.remove('hidden');
    if(atype.value==='date') adate.classList.remove('hidden');
    if(atype.value==='month') amonth.classList.remove('hidden');
    if(atype.value==='semester'){ sems.classList.remove('hidden'); seme.classList.remove('hidden'); }
    if(atype.value==='year') ayear.classList.remove('hidden');
  };
  resetA.onclick = e => {
    e.preventDefault(); atype.value=''; [adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts, resetA].forEach(x=>x.classList.add('hidden'));
  };

  loadA.onclick = () => {
    if(atg.value==='student'&&!asearch.value.trim()){ alert('Enter Adm# or Name'); return; }
    let from, to;
    if(atype.value==='date'){ from = to = adate.value; }
    else if(atype.value==='month'){ const [y,m]=amonth.value.split('-').map(Number); from=`${amonth.value}-01`; to=`${amonth.value}-${new Date(y,m,0).getDate()}`; }
    else if(atype.value==='semester'){ const [sy,sm]=sems.value.split('-').map(Number), [ey,em]=seme.value.split('-').map(Number); from=`${sems.value}-01`; to=`${seme.value}-${new Date(ey,em,0).getDate()}`; }
    else if(atype.value==='year'){ from=`${ayear.value}-01-01`; to=`${ayear.value}-12-31`; }
    else { alert('Select period'); return; }

    const cls=$('teacherClassSelect').value, sc=$('teacherSectionSelect').value;
    let pool=students.filter(s=>s.cls===cls&&s.sec===sc);
    if(atg.value==='section') pool=pool.filter(s=>s.sec===asel.value);
    if(atg.value==='student'){ const q=asearch.value.trim().toLowerCase(); pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q)); }

    const stats=pool.map(s=>({ adm:s.adm, name:s.name, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      if(d<from||d>to) return;
      stats.forEach(st=>{ const c=recs[st.adm]||'A'; st[c]++; st.total++; });
    });
    stats.forEach(st=>{
      const tf=st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
      const tp=(paymentsData[st.adm]||[]).reduce((a,p)=>a+p.amount,0);
      st.outstanding = tf - tp;
      st.status = (st.outstanding>0 || (st.total?(st.P/st.total*100):0) < eligibilityPct) ? 'Debarred' : 'Eligible';
    });

    const head=$('analyticsTable').querySelector('thead tr');
    head.innerHTML = ['#','Adm#','Name','P','A','Lt','HD','L','Total','%','₹ Outstanding','Status'].map(h=>`<th>${h}</th>`).join('');
    const body=$('analyticsBody'); body.innerHTML = '';
    stats.forEach((st,i)=>{ const pct = st.total?((st.P/st.total)*100).toFixed(1):'0.0'; 
      const tr=document.createElement('tr'); tr.innerHTML=`
        <td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td>
        <td>${st.total}</td><td>${pct}%</td><td>₹ ${st.outstanding}</td><td>${st.status}</td>
      `; body.appendChild(tr);
    });

    instr.textContent = `Period: ${from} to ${to}`;
    show(instr, acont, graphs, aacts);

    barChart?.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: { labels: stats.map(s=>s.name), datasets:[{ label:'% Present', data: stats.map(s=> s.total?s.P/s.total*100:0 ) }] },
      options: { scales:{ y:{ beginAtZero:true, max:100 } } }
    });

    const aggFine = stats.reduce((sum,st)=>sum+st.outstanding,0);
    pieChart?.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: { labels:['Outstanding Fine'], datasets:[{ data:[aggFine] }] }
    });

    lastAnalyticsShare = `Analytics (${from} to ${to})\n` +
      stats.map((st,i)=>`${i+1}. ${st.adm} ${st.name}: ${(st.total?((st.P/st.total)*100):0).toFixed(1)}% / ₹${st.outstanding}`).join('\n');
  };
  $('shareAnalytics').onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');
  $('downloadAnalytics').onclick = () => {
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Analytics Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#analyticsTable' });
    const barImg=barCtx.canvas.toDataURL('image/png'); doc.addPage(); doc.addImage(barImg,'PNG',14,20,180,80);
    const pieImg=pieCtx.canvas.toDataURL('image/png'); doc.addPage(); doc.addImage(pieImg,'PNG',14,20,100,100);
    window.open(doc.output('bloburl'),'_blank'); doc.save('analytics_report.pdf');
  };

  // --- 11. ATTENDANCE REGISTER: landscape PDF ---
  $('downloadRegister').onclick = () => {
    const doc=new jspdf.jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18); doc.text('Attendance Register',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#registerTable' });
    window.open(doc.output('bloburl'),'_blank'); doc.save('attendance_register.pdf');
  };

  // --- 12. SERVICE WORKER ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
