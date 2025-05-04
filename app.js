// app.js
// Full functionality: Setup, Financial Settings, Registration with Admission Date & Fine Mode,
// Attendance marking, Analytics, PDF Download, Sharing, PWA, Service Worker

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
  const save = (k, v) => set(k, v);

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
  const hide = (...els) => els.forEach(e => e.classList.add('hidden'));

  // --- 4. SETTINGS: Fines & Eligibility ---
  const formDiv      = $('financialForm');
  const saveSettings = $('saveSettings');
  const inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map(id=>$(id));
  const settingsCard = document.createElement('div');
  settingsCard.id    = 'settingsCard'; settingsCard.className = 'card hidden';
  const editSettings = document.createElement('button');
  editSettings.id    = 'editSettings'; editSettings.className = 'btn no-print hidden';
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
    await Promise.all([ save('fineRates', fineRates), save('eligibilityPct', eligibilityPct) ]);
    settingsCard.innerHTML = `
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
      </div>`;
    hide(formDiv, saveSettings, ...inputs);
    show(settingsCard, editSettings);
  };
  editSettings.onclick = () => {
    hide(settingsCard, editSettings);
    show(formDiv, saveSettings, ...inputs);
  };

  // --- 5. SETUP: School, Class & Section ---
  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([ get('schoolName'), get('teacherClass'), get('teacherSection') ]);
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
    const sc  = $('schoolNameInput').value.trim(),
          cl  = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    if (!sc||!cl||!sec) { alert('Complete setup'); return; }
    await Promise.all([ save('schoolName',sc), save('teacherClass',cl), save('teacherSection',sec) ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- 6. COUNTERS & UTILS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target=+span.dataset.target; let count=0; const step=Math.max(1,target/100);
      (function upd(){
        count+=step; span.textContent = count<target?Math.ceil(count):target;
        if(count<target) requestAnimationFrame(upd);
      })();
    });
  }
  function updateCounters() {
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
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
  $('teacherClassSelect').onchange = $('teacherSectionSelect').onchange = () => {
    renderStudents(); updateCounters(); resetViews();
  };

  // --- 7. STUDENT REGISTRATION & FINE/STATUS ---
  const modeManual = $('modeManual'), modeSmart = $('modeSmart'), admissionDate = $('admissionDate');
  function renderStudents() {
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const tbody=$('studentsBody'); tbody.innerHTML=''; let idx=0;
    students.forEach((s,i)=>{
      if(s.cls!==cl||s.sec!==sec) return;
      idx++;
      // compute stats after admissionDate
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.entries(attendanceData).forEach(([d,recs])=>{
        if (d < s.admissionDate) return;
        const c=recs[s.adm]||'A'; stats[c]++;
      });
      // compute fine
      const totalFine = s.fineMode==='manual'
        ? stats.A * fineRates.A
        : stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      const outstanding = totalFine - paid;
      const totalDays = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct = totalDays? (stats.P/totalDays)*100 : 0;
      const status = (outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr=document.createElement('tr'); tr.dataset.index=i;
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>
        <td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>${s.fineMode}</td><td>${s.admissionDate}</td>
        <td>PKR ${outstanding}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>`;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked=false; toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }
  function toggleButtons(){
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any; $('deleteSelected').disabled = !any;
  }
  renderStudents(); updateCounters();

  // --- selection & edit/delete ---
  $('studentsBody').addEventListener('change', e=>{ if(e.target.classList.contains('sel')) toggleButtons(); });
  $('selectAllStudents').onclick = ()=>{ 
    document.querySelectorAll('.sel').forEach(c=>c.checked=$('selectAllStudents').checked); 
    toggleButtons(); 
  };

  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n=$('studentName').value.trim(), p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(), o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim(), cl=$('teacherClassSelect').value,
          sec=$('teacherSectionSelect').value, admDate=admissionDate.value;
    if(!n||!p||!c||!o||!a||!admDate){ alert('All fields required'); return; }
    const adm=await genAdmNo();
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec, fineMode: modeSmart.checked?'smart':'manual', admissionDate: admDate });
    await save('students', students);
    ['studentName','parentName','parentContact','parentOccupation','parentAddress','admissionDate'].forEach(id=>$(id).value='');
    modeManual.checked=true;
    renderStudents(); updateCounters(); resetViews();
  };

  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach(cb=>{
      const tr=cb.closest('tr'), i=+tr.dataset.index, s=students[i];
      tr.innerHTML=`
        <td><input type="checkbox" class="sel" checked></td>
        <td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"></td>
        <td>${s.adm}</td>
        <td><input value="${s.parent}"></td>
        <td><input value="${s.contact}"></td>
        <td><input value="${s.occupation}"></td>
        <td><input value="${s.address}"></td>
        <td colspan="5"></td>`;
    });
    hide($('editSelected')); show($('doneEditing'));
  };

  $('doneEditing').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach(tr => {
      const inputs=[...tr.querySelectorAll('input:not(.sel)')];
      if(inputs.length===5){
        const [n,p,c,o,a]=inputs.map(i=>i.value.trim()), adm=tr.children[3].textContent;
        const idx=students.findIndex(x=>x.adm===adm);
        if(idx>-1) students[idx]={...students[idx], name:n, parent:p, contact:c, occupation:o, address:a};
      }
    });
    await save('students', students);
    hide($('doneEditing')); show($('editSelected'), $('deleteSelected'), $('saveRegistration'));
    renderStudents(); updateCounters();
  };

  $('deleteSelected').onclick = async () => {
    if(!confirm('Delete?')) return;
    const toDel=[...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students=students.filter((_,i)=>!toDel.includes(i));
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
  };

  $('saveRegistration').onclick = async () => {
    if(!$('doneEditing').classList.contains('hidden')){ alert('Finish editing'); return; }
    await save('students', students);
    hide(document.querySelector('#student-registration .row-inline'), $('editSelected'), $('deleteSelected'), $('saveRegistration'));
    show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
  };
  $('editRegistration').onclick = () => {
    show(document.querySelector('#student-registration .row-inline'), $('editSelected'), $('deleteSelected'), $('saveRegistration'));
    hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
  };

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('payAdm').textContent=adm; $('paymentAmount').value='';
    show($('paymentModal'));
  }
  $('paymentModalClose').onclick = () => hide($('paymentModal'));
  $('savePayment').onclick = async () => {
    const adm=$('payAdm').textContent, amt=Number($('paymentAmount').value)||0;
    paymentsData[adm]=paymentsData[adm]||[];
    paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal')); renderStudents();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));

  // --- 9. MARK ATTENDANCE ---
  const statusNames={P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'};
  const statusColors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};
  $('loadAttendance').onclick = () => {
    const date=$('dateInput').value; if(!date){alert('Pick date');return;}
    $('attendanceBody').innerHTML=''; $('attendanceSummary').innerHTML='';
    const roster=students.filter(s=>s.cls==$('teacherClassSelect').value&&s.sec==$('teacherSectionSelect').value);
    roster.forEach(stu=>{
      const row=document.createElement('div'), nameDiv=document.createElement('div'), btnsDiv=document.createElement('div');
      row.className='attendance-row'; nameDiv.className='attendance-name'; btnsDiv.className='attendance-buttons';
      nameDiv.textContent=stu.name;
      Object.keys(statusNames).forEach(code=>{
        const btn=document.createElement('button');
        btn.className='att-btn'; btn.textContent=code;
        btn.onclick=()=>{
          btnsDiv.querySelectorAll('.att-btn').forEach(b=>{b.classList.remove('selected'); b.style.background=''; b.style.color='';});
          btn.classList.add('selected'); btn.style.background=statusColors[code]; btn.style.color='#fff';
        };
        btnsDiv.appendChild(btn);
      });
      row.append(nameDiv, btnsDiv); $('attendanceBody').appendChild(row);
    });
    show($('attendanceBody'), $('saveAttendance')); hide($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), $('attendanceSummary'));
  };
  $('saveAttendance').onclick = async () => {
    const date=$('dateInput').value;
    attendanceData[date]={};
    const roster=students.filter(s=>s.cls==$('teacherClassSelect').value&&s.sec==$('teacherSectionSelect').value);
    roster.forEach((s,i)=>{
      const btn=$('attendanceBody').children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = btn?btn.textContent:'A';
    });
    await save('attendanceData', attendanceData);
    // render summary
    const div=$('attendanceSummary'); div.innerHTML=`<h3>Attendance: ${date}</h3>`;
    const tbl=document.createElement('table'); tbl.innerHTML='<tr><th>Name</th><th>Status</th><th>Share</th></tr>';
    roster.forEach(s=>{
      const code=attendanceData[date][s.adm];
      tbl.innerHTML+=`<tr><td>${s.name}</td><td>${statusNames[code]}</td><td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td></tr>`;
    });
    div.appendChild(tbl);
    div.querySelectorAll('.share-individual').forEach(ic=>{
      ic.onclick=()=>{
        const adm=ic.dataset.adm, st=students.find(x=>x.adm===adm), code=attendanceData[date][adm];
        const msg=`Dear Parent, your child was ${statusNames[code]} on ${date}.`;
        window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`,'_blank');
      };
    });
    hide($('attendanceBody'), $('saveAttendance')); show($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), $('attendanceSummary'));
  };
  $('resetAttendance').onclick = () => { show($('attendanceBody'), $('saveAttendance')); hide($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), $('attendanceSummary')); };
  $('downloadAttendancePDF').onclick = () => {
    const doc=new jspdf.jsPDF(); doc.setFontSize(18); doc.text('Attendance',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#attendanceSummary table' }); doc.save(`attendance_${$('dateInput').value}.pdf`);
  };
  $('shareAttendanceSummary').onclick = () => {
    const date=$('dateInput').value, cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const header=`*Attendance Report*\nClass ${cl} Section ${sec} - ${date}`;
    const lines=students.filter(s=>s.cls==$('teacherClassSelect').value&&s.sec==$('teacherSectionSelect').value)
      .map(s=>`*${s.name}*: ${statusNames[attendanceData[date][s.adm]]}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines.join('\n'))}`,'_blank');
  };

  // --- 10. ANALYTICS ---
  const atg=$('analyticsTarget'), asel=$('analyticsSectionSelect'), atype=$('analyticsType'),
        adate=$('analyticsDate'), amonth=$('analyticsMonth'), sems=$('semesterStart'),
        seme=$('semesterEnd'), ayear=$('yearStart'), asearch=$('analyticsSearch'),
        loadA=$('loadAnalytics'), resetA=$('resetAnalytics'),
        instr=$('instructions'), acont=$('analyticsContainer'),
        graphs=$('graphs'), aacts=$('analyticsActions'),
        barCtx=$('barChart').getContext('2d'), pieCtx=$('pieChart').getContext('2d');
  let barChart, pieChart;

  $('analyticsFilterBtn').onclick   = () => show($('analyticsFilterModal'));
  $('analyticsFilterClose').onclick = () => hide($('analyticsFilterModal'));
  $('applyAnalyticsFilter').onclick = () => {
    analyticsFilterOptions = Array.from(document.querySelectorAll('#analyticsFilterForm input[type="checkbox"]:checked')).map(cb=>cb.value);
    analyticsDownloadMode   = document.querySelector('#analyticsFilterForm input[name="downloadMode"]:checked').value;
    hide($('analyticsFilterModal'));
    if (lastAnalyticsStats.length) renderAnalytics(lastAnalyticsStats, lastAnalyticsRange.from, lastAnalyticsRange.to);
  };

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearch].forEach(x=>x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach(x=>x.classList.add('hidden'));
    if(atg.value==='section') asel.classList.remove('hidden');
    if(atg.value==='student') asearch.classList.remove('hidden');
  };
  atype.onchange = () => {
    [adate, amonth, sems, seme, ayear].forEach(x=>x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach(x=>x.classList.add('hidden'));
    resetA.classList.remove('hidden');
    switch(atype.value){
      case 'date':     adate.classList.remove('hidden'); break;
      case 'month':    amonth.classList.remove('hidden'); break;
      case 'semester': sems.classList.remove('hidden'); seme.classList.remove('hidden'); break;
      case 'year':     ayear.classList.remove('hidden'); break;
    }
  };
  resetA.onclick = e => {
    e.preventDefault();
    atype.value=''; [adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts].forEach(x=>x.classList.add('hidden'));
    resetA.classList.add('hidden');
  };

  loadA.onclick = () => {
    if(atg.value==='student' && !asearch.value.trim()){ alert('Enter admission# or name'); return; }
    let from, to;
    if(atype.value==='date'){ from=to=adate.value; }
    else if(atype.value==='month'){
      const [y,m]=amonth.value.split('-').map(Number);
      from=`${amonth.value}-01`; to=`${amonth.value}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
    }
    else if(atype.value==='semester'){
      const [sy,sm]=sems.value.split('-').map(Number), [ey,em]=seme.value.split('-').map(Number);
      from=`${sems.value}-01`; to=`${seme.value}-${String(new Date(ey,em,0).getDate()).padStart(2,'0')}`;
    }
    else if(atype.value==='year'){ from=`${ayear.value}-01-01`; to=`${ayear.value}-12-31`; }
    else { alert('Select period'); return; }

    const cls=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    let pool=students.filter(s=>s.cls===cls&&s.sec===sec);
    if(atg.value==='section') pool=pool.filter(s=>s.sec===asel.value);
    if(atg.value==='student'){
      const q=asearch.value.trim().toLowerCase();
      pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));
    }

    const stats=pool.map(s=>({ adm:s.adm, name:s.name, admissionDate:s.admissionDate, fineMode:s.fineMode, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      stats.forEach(st=>{
        if(d<from||d>to||d<st.admissionDate) return;
        const c=recs[st.adm]||'A'; st[c]++; st.total++;
      });
    });
    stats.forEach(st=>{
      const tf = st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
      const tp = (paymentsData[st.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      st.outstanding = tf - tp;
      const pct = st.total?(st.P/st.total)*100:0;
      st.status = (st.outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
    });
    lastAnalyticsStats = stats; lastAnalyticsRange={from,to};
    renderAnalytics(stats, from, to);
  };

  function renderAnalytics(stats, from, to){
    let filtered = analyticsFilterOptions.includes('all')?stats:stats.filter(st=>analyticsFilterOptions.some(opt=>{
      switch(opt){
        case 'registered': return true;
        case 'attendance':  return st.total>0;
        case 'fine':        return st.A>0||st.Lt>0||st.L>0||st.HD>0;
        case 'cleared':     return st.outstanding===0;
        case 'debarred':    return st.status==='Debarred';
        case 'eligible':    return st.status==='Eligible';
        default:            return false;
      }
    }));
    const thead=$('analyticsTable').querySelector('thead tr');
    thead.innerHTML=['#','Adm#','Name','Adm Date','Fine Mode','P','A','Lt','HD','L','Total','%','Outstanding','Status']
      .map(h=>`<th>${h}</th>`).join('');
    const tbody=$('analyticsBody'); tbody.innerHTML='';
    filtered.forEach((st,i)=>{
      const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td>
        <td>${st.admissionDate}</td><td>${st.fineMode}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td>
        <td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${pct}%</td>
        <td>PKR ${st.outstanding}</td><td>${st.status}</td>`;
      tbody.appendChild(tr);
    });
    $('instructions').textContent=`Period: ${from} to ${to}`; show($('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'));
    barChart?.destroy();
    barChart=new Chart(barCtx,{type:'bar',data:{labels:filtered.map((_,i)=>i+1),datasets:[{label:'% Present',data:filtered.map(st=>((st.P/st.total)*100).toFixed(1))}]},options:{scales:{y:{beginAtZero:true,max:100}}}});
    pieChart?.destroy();
    pieChart=new Chart(pieCtx,{type:'pie',data:{labels:['Outstanding'],datasets:[{data:[filtered.reduce((sum,st)=>sum+st.outstanding,0)]}]}});

    lastAnalyticsShare=`Analytics (${from} to ${to})\n`+filtered.map(st=>`${st.name}: ${(st.P/st.total*100).toFixed(1)}% / PKR ${st.outstanding}`).join('\n');
  }

  $('downloadAnalytics').onclick = () => {
    const filtered = lastAnalyticsStats.filter(st=>analyticsFilterOptions.includes('all')||analyticsFilterOptions.some(opt=>{
      switch(opt){
        case 'registered': return true;
        case 'attendance':  return st.total>0;
        case 'fine':        return st.A>0||st.Lt>0||st.L>0||st.HD>0;
        case 'cleared':     return st.outstanding===0;
        case 'debarred':    return st.status==='Debarred';
        case 'eligible':    return st.status==='Eligible';
      }
    }));
    if(analyticsDownloadMode==='combined'){
      const doc=new jspdf.jsPDF(); doc.setFontSize(18); doc.text('Analytics Report',14,16);
      doc.setFontSize(12); doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`,14,24);
      const body=filtered.map((st,i)=>[i+1,st.adm,st.name,st.admissionDate,st.fineMode,st.P,st.A,st.Lt,st.HD,st.L,st.total,`${((st.P/st.total)*100).toFixed(1)}%`,`PKR ${st.outstanding}`,st.status]);
      doc.autoTable({ startY:32, head:[['#','Adm#','Name','Adm Date','Fine Mode','P','A','Lt','HD','L','Total','%','Outstanding','Status']], body, styles:{fontSize:10} });
      doc.save('analytics_report.pdf');
    } else {
      filtered.forEach(st=>{
        const doc=new jspdf.jsPDF(); doc.setFontSize(16); doc.text(`Report for ${st.name} (${st.adm})`,14,16);
        doc.setFontSize(12);
        const rows=[['Adm Date',st.admissionDate],['Fine Mode',st.fineMode],['Present',st.P],['Absent',st.A],['Late',st.Lt],['Half-Day',st.HD],['Leave',st.L],['Total',st.total],['% Present',`${((st.P/st.total)*100).toFixed(1)}%`],['Outstanding',`PKR ${st.outstanding}`],['Status',st.status]];
        doc.autoTable({ startY:24, head:[['Metric','Value']], body:rows, styles:{fontSize:10} });
        doc.save(`report_${st.adm}.pdf`);
      });
    }
  };
  $('shareAnalytics').onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`,'_blank');

  // --- 11. ATTENDANCE REGISTER ---
  const loadReg=$('loadRegister'), changeReg=$('changeRegister'), saveReg=$('saveRegister'),
        dlReg=$('downloadRegister'), shReg=$('shareRegister'), rm=$('registerMonth'),
        rh=$('registerHeader'), rb=$('registerBody');
  const regCodes=['A','P','Lt','HD','L'], regColors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};

  loadReg.onclick = () => {
    const m=rm.value; if(!m){alert('Pick month');return;}
    const [y,mm]=m.split('-').map(Number), days=new Date(y,mm,0).getDate();
    rh.innerHTML=`<th>#</th><th>Adm#</th><th>Name</th>`+[...Array(days)].map((_,i)=>`<th>${i+1}</th>`).join('');
    rb.innerHTML='';
    const roster=students.filter(s=>s.cls==$('teacherClassSelect').value&&s.sec==$('teacherSectionSelect').value);
    roster.forEach((s,i)=>{
      let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=days;d++){
        const key=`${m}-${String(d).padStart(2,'0')}`, c=(attendanceData[key]||{})[s.adm]||'A';
        const style=c==='A'?'':`style="background:${regColors[c]};color:#fff"`;
        row+=`<td class="reg-cell" ${style}><span class="status-text">${c}</span></td>`;
      }
      const tr=document.createElement('tr'); tr.innerHTML=row; rb.appendChild(tr);
    });
    rb.querySelectorAll('.reg-cell').forEach(cell=>{
      cell.onclick=()=>{
        const span=cell.querySelector('.status-text');
        let idx=regCodes.indexOf(span.textContent);
        idx=(idx+1)%regCodes.length; const c=regCodes[idx];
        span.textContent=c;
        if(c==='A'){ cell.style.background=''; cell.style.color=''; }
        else { cell.style.background=regColors[c]; cell.style.color='#fff'; }
      };
    });
    show($('registerTableWrapper'), saveReg); hide(loadReg, changeReg, dlReg, shReg);
  };

  saveReg.onclick = async ()=>{
    const m=rm.value, [y,mm]=m.split('-').map(Number), days=new Date(y,mm,0).getDate();
    Array.from(rb.children).forEach(tr=>{
      const adm=tr.children[1].textContent;
      for(let d=1;d<=days;d++){
        const code=tr.children[3+d-1].querySelector('.status-text').textContent;
        const key=`${m}-${String(d).padStart(2,'0')}`;
        attendanceData[key]=attendanceData[key]||{};
        attendanceData[key][adm]=code;
      }
    });
    await save('attendanceData', attendanceData);
    hide(saveReg); show(changeReg, dlReg, shReg);
  };
  changeReg.onclick = ()=>{
    hide($('registerTableWrapper'), changeReg, dlReg, shReg, saveReg);
    rh.innerHTML=''; rb.innerHTML='';
    show(loadReg);
  };
  dlReg.onclick = ()=>{
    const doc=new jspdf.jsPDF(); doc.setFontSize(18); doc.text('Attendance Register',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, head:[...rh.children].map(th=>th.textContent), body: Array.from(rb.children).map(tr=>Array.from(tr.children).map(td=>td.textContent)) });
    doc.save(`register_${rm.value}.pdf`);
  };
  shReg.onclick = () => {
    const m=rm.value, header=`*Attendance Register* ${m}`, lines=Array.from(rb.children).map(tr=>{
      const name=tr.children[2].textContent;
      const statuses=Array.from(tr.children).slice(3).map(td=>td.textContent).join('');
      return `*${name}*: ${statuses}`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`,'_blank');
  };

  // --- PWA: Service Worker ---
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);
});
