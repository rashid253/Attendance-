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
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- 4. SETTINGS ---
  const formDiv      = $('financialForm');
  const saveBtn      = $('saveSettings');
  const inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map($);
  const settingsCard = document.createElement('div');
  settingsCard.id    = 'settingsCard';
  settingsCard.className = 'card hidden';
  const editBtn      = document.createElement('button');
  editBtn.id         = 'editSettings';
  editBtn.className  = 'btn no-print hidden';
  editBtn.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editBtn);

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
      HD: +$('fineHalfDay').value  || 30,
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
    hide(formDiv, ...inputs, saveBtn);
    show(settingsCard, editBtn);
  };
  editBtn.onclick = () => {
    hide(settingsCard, editBtn);
    show(formDiv, ...inputs, saveBtn);
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
      hide($('setupForm')); show($('setupDisplay'));
      renderStudents(); updateCounters(); resetViews();
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
      const target = +span.dataset.target; let count = 0;
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
    show($('loadRegister'), $('loadAttendance'));
  }
  $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- 7. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody'); tbody.innerHTML = ''; let idx = 0;
    students.forEach((s,i)=>{
      if (s.cls!==cl||s.sec!==sec) return; idx++;
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(r=>stats[r[s.adm]||'A']++);
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid      = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out       = totalFine - paid;
      const totalDays = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct       = totalDays?(stats.P/totalDays)*100:0;
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
  function toggleButtons(){
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change',e=>e.target.classList.contains('sel')&&toggleButtons());
  $('selectAllStudents').onclick=()=>{ document.querySelectorAll('.sel').forEach(c=>c.checked=$('selectAllStudents').checked); toggleButtons(); };
  // ... registration, payment logic unchanged ...

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm){
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent, amt = +$('paymentAmount').value || 0;
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
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    students.filter(s=>s.cls===cl&&s.sec===sec).forEach((stu,i) => {
      const row = document.createElement('div'); row.className='attendance-row';
      const nameDiv = document.createElement('div'); nameDiv.className='attendance-name'; nameDiv.textContent = stu.name;
      const btnsDiv = document.createElement('div'); btnsDiv.className='attendance-buttons';
      Object.entries(statusNames).forEach(([code,txt])=>{
        const btn = document.createElement('button'); btn.className='att-btn'; btn.textContent = code;
        btn.onclick = ()=>{
          btnsDiv.querySelectorAll('.att-btn').forEach(b=>{b.classList.remove('selected');b.style.background='';b.style.color='';});
          btn.classList.add('selected'); btn.style.background = statusColors[code]; btn.style.color='#fff';
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
    const date = dateInput.value; if (!date){ alert('Pick a date'); return; }
    attendanceData[date]={};
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    students.filter(s=>s.cls===cl&&s.sec===sec).forEach((s,i)=>{
      const btn = attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = btn?btn.textContent:'A';
    });
    await save('attendanceData', attendanceData);

    attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement('table'); tbl.innerHTML = `<tr><th>Name</th><th>Status</th><th>Share</th></tr>`;
    students.filter(s=>s.cls===cl&&s.sec===sec).forEach(s=>{
      const code = attendanceData[date][s.adm];
      tbl.innerHTML += `<tr><td>${s.name}</td><td>${statusNames[code]}</td>
        <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td></tr>`;
    });
    attendanceSummaryDiv.appendChild(tbl);

    attendanceSummaryDiv.querySelectorAll('.share-individual').forEach(ic=>{
      ic.onclick = ()=>{
        const adm = ic.dataset.adm;
        const student = students.find(x=>x.adm===adm);
        const code = attendanceData[date][adm];
        const msg = `Dear Parent, your child was ${statusNames[code]} on ${date}.`;
        window.open(`https://wa.me/${student.contact}?text=${encodeURIComponent(msg)}`, '_blank');
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
    const url = doc.output('bloburl'); window.open(url,'_blank'); doc.save(`attendance_${dateInput.value}.pdf`);
  };

  shareAttendanceBtn.onclick = () => {
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const date = dateInput.value;
    const header = `*Attendance Report*\nClass ${cl} Section ${sec} - ${date}`;
    const lines  = students.filter(s=>s.cls===cl&&s.sec===sec)
      .map(s=>`*${s.name}*: ${statusNames[attendanceData[date][s.adm]]}`)
      .join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`, '_blank');
  };

  // --- 10. ANALYTICS ---
  const atg   = $('analyticsTarget');
  const asel  = $('analyticsSectionSelect');
  const atype = $('analyticsType');
  const adate = $('analyticsDate');
  const amonth= $('analyticsMonth');
  const sems  = $('semesterStart');
  const seme  = $('semesterEnd');
  const ayear = $('yearStart');
  const asearch = $('analyticsSearch');
  const loadA   = $('loadAnalytics');
  const resetA  = $('resetAnalytics');
  const instr   = $('instructions');
  const acont   = $('analyticsContainer');
  const graphs  = $('graphs');
  const aacts   = $('analyticsActions');
  const barCtx  = $('barChart').getContext('2d');
  const pieCtx  = $('pieChart').getContext('2d');
  let barChart, pieChart, lastAnalyticsShare = '';

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearch, instr, acont, graphs, aacts].forEach(el=>el.classList.add('hidden'));
    resetA.classList.add('hidden');
    if(atg.value==='section') asel.classList.remove('hidden');
    if(atg.value==='student') asearch.classList.remove('hidden');
  };

  atype.onchange = () => {
    [adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts].forEach(el=>el.classList.add('hidden'));
    resetA.classList.remove('hidden');
    if(atype.value==='date') adate.classList.remove('hidden');
    if(atype.value==='month') amonth.classList.remove('hidden');
    if(atype.value==='semester'){ sems.classList.remove('hidden'); seme.classList.remove('hidden'); }
    if(atype.value==='year') ayear.classList.remove('hidden');
  };

  resetA.onclick = e => {
    e.preventDefault();
    atype.value = '';
    [adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts].forEach(el=>el.classList.add('hidden'));
    resetA.classList.add('hidden');
  };

  loadA.onclick = () => {
    // compute date range
    if(atg.value==='student'&&!asearch.value.trim()){alert('Enter Adm# or Name'); return;}
    let from,to;
    if(atype.value==='date'){ from=to=adate.value; }
    else if(atype.value==='month'){
      const [y,m] = amonth.value.split('-').map(Number);
      from=`${amonth.value}-01`;
      to=`${amonth.value}-${new Date(y,m,0).getDate()}`;
    }
    else if(atype.value==='semester'){
      const [sy,sm]=sems.value.split('-').map(Number);
      const [ey,em]=seme.value.split('-').map(Number);
      from=`${sems.value}-01`;
      to=`${seme.value}-${new Date(ey,em,0).getDate()}`;
    }
    else if(atype.value==='year'){ from=`${ayear.value}-01-01`; to=`${ayear.value}-12-31`; }
    else{ alert('Select period'); return; }

    const cls = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    let pool = students.filter(s=>s.cls===cls&&s.sec===sec);
    if(atg.value==='section') pool=pool.filter(s=>s.sec===asel.value);
    if(atg.value==='student'){
      const q=asearch.value.trim().toLowerCase();
      pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));
    }

    // compute stats
    const stats = pool.map(s=>({ adm:s.adm, name:s.name, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      if(d<from||d>to) return;
      stats.forEach(st=>{
        const c=recs[st.adm]||'A';
        st[c]++; st.total++;
      });
    });

    stats.forEach(st=>{
      const tf = st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
      const tp = (paymentsData[st.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      st.outstanding = tf-tp;
      const pct = st.total?(st.P/st.total)*100:0;
      st.status = (st.outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
    });

    // render table
    const thead = $('analyticsTable').querySelector('thead tr');
    thead.innerHTML = ['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']
      .map(h=>`<th>${h}</th>`).join('');
    const tbody = $('analyticsBody'); tbody.innerHTML='';
    stats.forEach((st,i)=>{
      const pct = st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const tr = document.createElement('tr');
      tr.innerHTML=`
        <td>${i+1}</td>
        <td>${st.adm}</td>
        <td>${st.name}</td>
        <td>${st.P}</td>
        <td>${st.A}</td>
        <td>${st.Lt}</td>
        <td>${st.HD}</td>
        <td>${st.L}</td>
        <td>${st.total}</td>
        <td>${pct}%</td>
        <td>PKR ${st.outstanding}</td>
        <td>${st.status}</td>`;
      tbody.appendChild(tr);
    });

    instr.textContent = `Period: ${from} to ${to}`;
    show(instr, acont, graphs, aacts);

    // bar chart
    barChart?.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: stats.map(st=>st.name),
        datasets: [{ label:'% Present', data: stats.map(st=>st.total?(st.P/st.total)*100:0) }]
      },
      options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
    });

    // pie chart
    const agg = stats.reduce((sum,st)=>sum+st.outstanding,0);
    pieChart?.destroy();
    pieChart = new Chart(pieCtx, {
      type:'pie',
      data:{ labels:['Outstanding'], datasets:[{ data:[agg] }] }
    });

    lastAnalyticsShare = `Analytics (${from} to ${to})\n` +
      stats.map((st,i)=>`${i+1}. ${st.adm} ${st.name}: ${((st.P/st.total)*100).toFixed(1)}% / PKR ${st.outstanding}`)
           .join('\n');
  };

  $('shareAnalytics').onclick = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');

  // Updated downloadAnalytics
  $('downloadAnalytics').onclick = () => {
    const doc = new jspdf.jsPDF('p','pt','a4');
    doc.setFontSize(18); doc.text('Analytics Report',40,40);
    doc.setFontSize(12); doc.text($('setupText').textContent,40,60);
    doc.autoTable({ startY:80, html:'#analyticsTable', margin:{ left:40, right:40 } });

    const barCanvas = document.getElementById('barChart');
    const barUrl = barCanvas.toDataURL('image/png',1.0);
    doc.addPage();
    doc.setFontSize(16); doc.text('Bar Chart – % Present',40,40);
    const bw = doc.internal.pageSize.getWidth()-80;
    const bh = bw * (barCanvas.height/barCanvas.width);
    doc.addImage(barUrl,'PNG',40,60,bw,bh);

    const pieCanvas = document.getElementById('pieChart');
    const pieUrl = pieCanvas.toDataURL('image/png',1.0);
    doc.addPage();
    doc.setFontSize(16); doc.text('Pie Chart – Outstanding',40,40);
    const pw = doc.internal.pageSize.getWidth()-80;
    const ph = pw * (pieCanvas.height/pieCanvas.width);
    doc.addImage(pieUrl,'PNG',40,60,pw,ph);

    doc.save('analytics_report.pdf');
  };

  // --- 11. ATTENDANCE REGISTER ---
  // (same as above)

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
