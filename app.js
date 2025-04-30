// app.js

window.addEventListener('DOMContentLoaded', async () => {
  console.debug('DOMContentLoaded – initializing app');

  // 0. Debug console via Eruda
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => { console.debug('Eruda loaded'); eruda.init(); };
  document.body.appendChild(erudaScript);

  // 1. idb-keyval helpers
  if (!window.idbKeyval) { console.error('idb-keyval not found'); return; }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v).then(() => console.debug(`Saved ${k}`, v));

  // 2. State & defaults
  let students       = await get('students')        || [];
  let attendanceData = await get('attendanceData')  || {};
  let paymentsData   = await get('paymentsData')    || {};
  let lastAdmNo      = await get('lastAdmissionNo') || 0;
  let fineRates      = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct = await get('eligibilityPct')  || 75;
  console.debug('Initial state:', { students, fineRates, eligibilityPct });

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // 3. DOM helpers
  const $    = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // 4. Financial Settings UI
  const formDiv        = $('financialForm'),
        saveSettingsBtn= $('saveSettings');
  const settingsInputs = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map($);
  const settingsCard   = document.createElement('div');
        settingsCard.id = 'settingsCard';
        settingsCard.className = 'card hidden';
  const editSettingsBtn = document.createElement('button');
        editSettingsBtn.id = 'editSettings';
        editSettingsBtn.className = 'btn no-print hidden';
        editSettingsBtn.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editSettingsBtn);

  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveSettingsBtn.onclick = async () => {
    console.debug('Saving settings');
    fineRates = {
      A : +$('fineAbsent').value     || 0,
      Lt: +$('fineLate').value       || 0,
      L : +$('fineLeave').value      || 0,
      HD: +$('fineHalfDay').value    || 0,
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
    hide(formDiv, ...settingsInputs, saveSettingsBtn);
    show(settingsCard, editSettingsBtn);
  };

  editSettingsBtn.onclick = () => {
    console.debug('Editing settings');
    hide(settingsCard, editSettingsBtn);
    show(formDiv, ...settingsInputs, saveSettingsBtn);
  };

  // 5. Teacher & School Setup
  const setupForm            = $('setupForm'),
        setupDisplay         = $('setupDisplay'),
        schoolNameInput      = $('schoolNameInput'),
        teacherClassSelect   = $('teacherClassSelect'),
        teacherSectionSelect = $('teacherSectionSelect'),
        setupText            = $('setupText');

  async function loadSetup() {
    console.debug('Loading setup');
    const [sc, cl, sec] = await Promise.all([
      get('schoolName'), get('teacherClass'), get('teacherSection')
    ]);
    if (sc && cl && sec) {
      schoolNameInput.value        = sc;
      teacherClassSelect.value     = cl;
      teacherSectionSelect.value   = sec;
      setupText.textContent        = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide(setupForm);
      show(setupDisplay);
      renderStudents(); updateCounters(); resetViews();
    }
  }

  $('saveSetup').onclick = async e => {
    e.preventDefault();
    console.debug('Saving setup');
    const sc  = schoolNameInput.value.trim(),
          cl  = teacherClassSelect.value,
          sec = teacherSectionSelect.value;
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
    console.debug('Editing setup');
    show(setupForm);
    hide(setupDisplay);
  };

  await loadSetup();

  // 6. Counters & View Management
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target / 100);
      (function upd() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(upd);
      })();
    });
  }

  function updateCounters() {
    const cl  = teacherClassSelect.value,
          sec = teacherSectionSelect.value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }

  function resetViews() {
    console.debug('Resetting views');
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'),
      $('registerTableWrapper'), $('changeRegister'), $('saveRegister'),
      $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }

  teacherClassSelect.onchange = () => { renderStudents(); updateCounters(); resetViews(); };
  teacherSectionSelect.onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // 7. Student Registration & Display
  function renderStudents() {
    console.debug('Rendering students');
    const cl   = teacherClassSelect.value,
          sec  = teacherSectionSelect.value,
          tbody= $('studentsBody');
    tbody.innerHTML = '';
    let idx = 0;
    students.forEach((s,i) => {
      if (s.cls!==cl||s.sec!==sec) return;
      idx++;
      const stats = { P:0,A:0,Lt:0,HD:0,L:0 };
      Object.values(attendanceData).forEach(r=>stats[r[s.adm]||'A']++);
      const fineTotal   = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paidTotal   = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      const outstanding = fineTotal - paidTotal;
      const totalDays   = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct         = totalDays ? (stats.P/totalDays)*100 : 0;
      const status      = (outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td>
        <td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${outstanding}</td><td>${status}</td>
        <td><button class="add-payment-btn btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>`;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }

  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }

  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleButtons();
  });

  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(cb=>cb.checked=$('selectAllStudents').checked);
    toggleButtons();
  };

  $('addStudent').onclick = async e => {
    e.preventDefault();
    console.debug('Adding student');
    const name       = $('studentName').value.trim(),
          parent     = $('parentName').value.trim(),
          contact    = $('parentContact').value.trim(),
          occupation = $('parentOccupation').value.trim(),
          address    = $('parentAddress').value.trim(),
          cl         = teacherClassSelect.value,
          sec        = teacherSectionSelect.value;
    if (!name||!parent||!contact||!occupation||!address) { alert('All fields required'); return; }
    if (!/^\d{7,15}$/.test(contact)) { alert('Contact must be 7–15 digits'); return; }
    const adm = await genAdmNo();
    students.push({ name,adm,parent,contact,occupation,address,cls:cl,sec });
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };

  // 8. Payment Modal
  function openPaymentModal(adm) {
    console.debug(`Opening payment modal for ${adm}`);
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('savePayment').onclick = async ()=>{
    console.debug('Saving payment');
    const adm = $('payAdm').textContent;
    const amt = +$('paymentAmount').value||0;
    paymentsData[adm]=(paymentsData[adm]||[]);
    paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };
  $('cancelPayment').onclick = ()=>hide($('paymentModal'));

  // 9. Mark Attendance
  console.debug('Initializing attendance');
  const dateInput         = $('dateInput'),
        loadAttBtn        = $('loadAttendance'),
        saveAttBtn        = $('saveAttendance'),
        resetAttBtn       = $('resetAttendance'),
        attBody           = $('attendanceBody'),
        attSummary        = $('attendanceSummary'),
        downloadAttBtn    = $('downloadAttendancePDF'),
        shareAttBtn       = $('shareAttendanceSummary');

  loadAttBtn.onclick = ()=>{
    const date = dateInput.value;
    if(!date){ alert('Select a date'); return; }
    console.debug('Loading attendance for', date);
    attBody.innerHTML='';
    const table = document.createElement('table'), thead=document.createElement('thead'), tbody=document.createElement('tbody');
    thead.innerHTML = '<tr><th>#</th><th>Name</th><th>Adm#</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th></tr>';
    table.appendChild(thead);
    const cl=teacherClassSelect.value, sec=teacherSectionSelect.value;
    let idx=0;
    students.forEach(s=>{
      if(s.cls!==cl||s.sec!==sec) return;
      idx++;
      const row=document.createElement('tr');
      row.innerHTML=`
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td><button data-status="P" class="att-btn">P</button></td>
        <td><button data-status="A" class="att-btn">A</button></td>
        <td><button data-status="Lt" class="att-btn">Lt</button></td>
        <td><button data-status="HD" class="att-btn">HD</button></td>
        <td><button data-status="L" class="att-btn">L</button></td>`;
      const prev = attendanceData[date]?.[s.adm];
      if(prev){ row.querySelector(`button[data-status="${prev}"]`)?.classList.add('selected'); }
      row.querySelectorAll('.att-btn').forEach(btn=>btn.onclick=()=>{
        row.querySelectorAll('.att-btn').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody); attBody.appendChild(table);
    show(saveAttBtn, resetAttBtn); hide(attSummary, downloadAttBtn, shareAttBtn);
  };

  saveAttBtn.onclick=async()=>{
    const date=dateInput.value;
    attendanceData[date]={};
    attBody.querySelectorAll('tbody tr').forEach(row=>{
      const adm=row.children[2].textContent;
      const sel=row.querySelector('.att-btn.selected');
      attendanceData[date][adm]=sel?.dataset.status||'A';
    });
    await save('attendanceData', attendanceData);
    console.debug('Saved attendance for', date);
    renderAttendanceSummary(date);
    show(attSummary, downloadAttBtn, shareAttBtn);
  };

  resetAttBtn.onclick = ()=>loadAttBtn.click();

  function renderAttendanceSummary(date){
    const recs=attendanceData[date]||{};
    const stats={P:0,A:0,Lt:0,HD:0,L:0};
    Object.values(recs).forEach(s=>stats[s]++);
    attSummary.innerHTML=`
      <p><strong>Summary for ${date}</strong></p>
      <p>Present: ${stats.P}</p>
      <p>Absent: ${stats.A}</p>
      <p>Late: ${stats.Lt}</p>
      <p>Half-Day: ${stats.HD}</p>
      <p>Leave: ${stats.L}</p>`;
  }

  downloadAttBtn.onclick=()=>{
    const date=dateInput.value;
    const doc=new jspdf.jsPDF();
    doc.text(`Attendance – ${date}`,20,20);
    const body=Object.entries(attendanceData[date]||{}).map(([adm,st])=>[adm,st]);
    doc.autoTable({head:[['Adm#','Status']],body});
    doc.save(`attendance-${date}.pdf`);
  };

  shareAttBtn.onclick=()=>{
    const date=dateInput.value; let txt=`Attendance for ${date}\n`;
    Object.entries(attendanceData[date]||{}).forEach(([adm,st])=>txt+=`${adm}: ${st}\n`);
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`);
  };

  // 10. Analytics & PDF Download
  console.debug('Initializing analytics');
  const atg              = $('analyticsTarget'),
        asel             = $('analyticsSectionSelect'),
        atype            = $('analyticsType'),
        adate            = $('analyticsDate'),
        amonth           = $('analyticsMonth'),
        sems             = $('semesterStart'),
        seme             = $('semesterEnd'),
        ayear            = $('yearStart'),
        asearch          = $('analyticsSearch'),
        loadA            = $('loadAnalytics'),
        resetA           = $('resetAnalytics'),
        instr            = $('instructions'),
        acont            = $('analyticsContainer'),
        aTableHeadRow    = $('analyticsTable').querySelector('thead tr'),
        aTableBody       = $('analyticsBody'),
        graphs           = $('graphs'),
        barCtx           = $('barChart').getContext('2d'),
        pieCtx           = $('pieChart').getContext('2d'),
        shareAnalyticsBtn= $('shareAnalytics'),
        downloadAnalyticsBtn=$('downloadAnalytics');
  let stats=[], analyticsFrom='', analyticsTo='', barChart, pieChart;

  atg.onchange = ()=>{
    atype.disabled=false;
    [asel,asearch].forEach(el=>el.classList.add('hidden'));
    [instr,acont,graphs,shareAnalyticsBtn,downloadAnalyticsBtn,resetA].forEach(el=>el.classList.add('hidden'));
    if(atg.value==='section') show(asel);
    if(atg.value==='student') show(asearch);
  };

  atype.onchange = ()=>{
    [adate,amonth,sems,seme,ayear].forEach(el=>el.classList.add('hidden'));
    [instr,acont,graphs,shareAnalyticsBtn,downloadAnalyticsBtn,resetA].forEach(el=>el.classList.add('hidden'));
    resetA.classList.remove('hidden');
    if(atype.value==='date') show(adate);
    if(atype.value==='month') show(amonth);
    if(atype.value==='semester') show(sems,seme);
    if(atype.value==='year') show(ayear);
  };

  resetA.onclick=e=>{
    e.preventDefault();
    atype.value='';
    [adate,amonth,sems,seme,ayear,instr,acont,graphs,shareAnalyticsBtn,downloadAnalyticsBtn,resetA]
      .forEach(el=>el.classList.add('hidden'));
  };

  loadA.onclick = ()=>{
    if(!atype.value){ alert('Select a period'); return; }
    if(atg.value==='section'&&!asel.value){ alert('Select a section'); return; }
    if(atg.value==='student'&&!asearch.value.trim()){ alert('Enter Adm# or Name'); return; }
    // date range
    let from, to;
    if(atype.value==='date'){ from=to=adate.value; }
    else if(atype.value==='month'){
      const [y,m]=amonth.value.split('-').map(Number);
      from=`${amonth.value}-01`; to=`${amonth.value}-${new Date(y,m,0).getDate()}`;
    } else if(atype.value==='semester'){
      const [sy,sm]=sems.value.split('-').map(Number);
      const [ey,em]=seme.value.split('-').map(Number);
      from=`${sems.value}-01`; to=`${seme.value}-${new Date(ey,em,0).getDate()}`;
    } else {
      from=`${ayear.value}-01-01`; to=`${ayear.value}-12-31`;
    }
    analyticsFrom=from; analyticsTo=to;
    // filter pool
    let pool = students.filter(s=>s.cls===teacherClassSelect.value&&s.sec===teacherSectionSelect.value);
    if(atg.value==='section') pool=pool.filter(s=>s.sec===asel.value);
    if(atg.value==='student'){
      const q=asearch.value.trim().toLowerCase();
      pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));
    }
    stats = pool.map(s=>({ adm:s.adm, name:s.name, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    for(const [d,recs] of Object.entries(attendanceData)){
      if(d<from||d>to) continue;
      stats.forEach(st=>{
        const code=recs[st.adm]||'A';
        st[code]++; st.total++;
      });
    }
    stats.forEach(st=>{
      const fineTotal=st.A*fineRates.A+st.Lt*fineRates.Lt+st.L*fineRates.L+st.HD*fineRates.HD;
      const paidTotal=(paymentsData[st.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      st.outstanding=fineTotal-paidTotal;
      const pct=st.total?(st.P/st.total)*100:0;
      st.status=(st.outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
    });
    // render table
    aTableHeadRow.innerHTML=`
      <th>#</th><th>Adm#</th><th>Name</th>
      <th>% Present</th><th>Outstanding</th><th>Status</th>
    `;
    aTableBody.innerHTML='';
    stats.forEach((st,i)=>{
      const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td>
        <td>${pct}%</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>
      `;
      aTableBody.appendChild(tr);
    });
    show(instr,acont,graphs,shareAnalyticsBtn,downloadAnalyticsBtn);
    if(barChart) barChart.destroy();
    if(pieChart) pieChart.destroy();
    barChart=new Chart(barCtx,{
      type:'bar',
      data:{ labels:stats.map(s=>s.adm), datasets:[{ label:'% Present', data:stats.map(s=>(s.total?(s.P/s.total)*100:0)) }] },
      options:{ responsive:true, scales:{ y:{ beginAtZero:true, max:100 } } }
    });
    const first=stats[0]||{P:0,A:0,Lt:0,HD:0,L:0};
    pieChart=new Chart(pieCtx,{
      type:'pie',
      data:{ labels:['Present','Absent','Late','Half-day','Leave'], datasets:[{ data:[first.P,first.A,first.Lt,first.HD,first.L] }] },
      options:{ responsive:true }
    });
  };

  shareAnalyticsBtn.onclick=()=>{
    let txt=`Analytics (${analyticsFrom} to ${analyticsTo})\n`;
    stats.forEach((st,i)=>{
      const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      txt+=`${i+1}. ${st.adm} ${st.name}: ${pct}% / PKR ${st.outstanding}\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`,'_blank');
  };

  downloadAnalyticsBtn.onclick=()=>{
    const doc=new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    const margin=40, rowH=20;
    let y=margin;
    doc.setFontSize(16);
    doc.text(`${setupText.textContent} – Analytics Report`, margin, y); y+=rowH;
    doc.setFontSize(12);
    doc.text(`Period: ${analyticsFrom} – ${analyticsTo}`, margin, y); y+=rowH;
    doc.autoTable({
      startY:y,
      head:[['Adm#','Name','% Present','Outstanding','Status']],
      body:stats.map(st=>[
        st.adm,
        st.name,
        st.total?((st.P/st.total)*100).toFixed(1)+'%':'0.0%',
        'PKR '+st.outstanding,
        st.status
      ]),
      styles:{ fontSize:10 },
      margin:{ left:margin, right:margin }
    });
    doc.save(`analytics_${analyticsFrom}_to_${analyticsTo}.pdf`);
  };

  // 11. Attendance Register
  console.debug('Initializing attendance register');
  const registerMonth       = $('registerMonth'),
        loadRegisterBtn     = $('loadRegister'),
        changeRegisterBtn   = $('changeRegister'),
        saveRegisterBtn     = $('saveRegister'),
        downloadRegisterBtn = $('downloadRegister'),
        shareRegisterBtn    = $('shareRegister'),
        registerHeader      = $('registerHeader'),
        registerBody        = $('registerBody');

  loadRegisterBtn.onclick = ()=>{
    const ym = registerMonth.value;
    if(!ym){ alert('Select month'); return; }
    console.debug('Loading register for', ym);
    registerHeader.innerHTML='<th>#</th><th>Name</th><th>Adm#</th>';
    registerBody.innerHTML='';
    const [y,m]=ym.split('-').map(Number);
    const days=new Date(y,m,0).getDate();
    for(let d=1;d<=days;d++){
      const th=document.createElement('th'); th.textContent=d; registerHeader.appendChild(th);
    }
    let idx=0;
    students.forEach(s=>{
      if(s.cls!==teacherClassSelect.value||s.sec!==teacherSectionSelect.value) return;
      idx++;
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>`;
      for(let d=1;d<=days;d++){
        const dateKey=`${ym}-${String(d).padStart(2,'0')}`;
        const cell=document.createElement('td');
        const btn=document.createElement('button'); btn.className='att-btn';
        const prev=attendanceData[dateKey]?.[s.adm];
        btn.textContent=prev||'A'; if(prev) btn.classList.add('selected');
        btn.onclick=()=>{
          const cycle=['P','A','Lt','HD','L'];
          const cur=btn.textContent;
          const nxt=cycle[(cycle.indexOf(cur)+1)%cycle.length];
          btn.textContent=nxt; btn.classList.toggle('selected',nxt!=='A');
        };
        cell.appendChild(btn); tr.appendChild(cell);
      }
      registerBody.appendChild(tr);
    });
    show(changeRegisterBtn, saveRegisterBtn);
    hide(loadRegisterBtn, downloadRegisterBtn, shareRegisterBtn);
  };

  changeRegisterBtn.onclick=()=>{
    registerHeader.innerHTML=''; registerBody.innerHTML='';
    hide(changeRegisterBtn, saveRegisterBtn, downloadRegisterBtn, shareRegisterBtn);
    show(loadRegisterBtn);
  };

  saveRegisterBtn.onclick=async()=>{
    const ym=registerMonth.value;
    const [y,m]=ym.split('-').map(Number);
    const days=new Date(y,m,0).getDate();
    registerBody.querySelectorAll('tr').forEach(tr=>{
      const adm=tr.children[2].textContent;
      for(let i=0;i<days;i++){
        const btn=tr.children[3+i].firstChild;
        const status=btn.textContent;
        const dateKey=`${ym}-${String(i+1).padStart(2,'0')}`;
        attendanceData[dateKey]=attendanceData[dateKey]||{};
        attendanceData[dateKey][adm]=status;
      }
    });
    await save('attendanceData', attendanceData);
    console.debug('Saved register for', ym);
    show(downloadRegisterBtn, shareRegisterBtn);
    hide(saveRegisterBtn, changeRegisterBtn);
  };

  downloadRegisterBtn.onclick=()=>{
    const ym=registerMonth.value;
    const doc=new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    doc.text(`Attendance Register – ${ym}`,30,20);
    const header=Array.from(registerHeader.children).map(th=>th.textContent);
    const body=Array.from(registerBody.children).map(tr=>Array.from(tr.children).map(td=>td.textContent));
    doc.autoTable({ head:[header], body, margin:{ left:30, right:30 }, styles:{ fontSize:8 } });
    doc.save(`register-${ym}.pdf`);
  };

  shareRegisterBtn.onclick=()=>{
    const ym=registerMonth.value; let txt=`Register for ${ym}\n`;
    registerBody.querySelectorAll('tr').forEach(tr=>{
      const adm=tr.children[2].textContent;
      const statuses=Array.from(tr.children).slice(3).map(td=>td.textContent).join('');
      txt+=`${adm}: ${statuses}\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`,'_blank');
  };

  // 12. Service Worker registration
  if('serviceWorker'in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg=>console.debug('SW registered',reg))
      .catch(err=>console.error('SW registration failed',err));
  }

}); // end DOMContentLoaded
