// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // 0. Debug console
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // 1. idb-keyval helpers
  if (!window.idbKeyval) { console.error('idb-keyval not found'); return; }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // 2. State & defaults
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

  // 3. DOM helpers
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // 4. Settings
  const formDiv = $('financialForm'), saveSettingsBtn = $('saveSettings');
  const settingsInputs = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map($);
  const settingsCard = document.createElement('div');
  settingsCard.id='settingsCard'; settingsCard.className='card hidden';
  const editSettingsBtn = document.createElement('button');
  editSettingsBtn.id='editSettings'; editSettingsBtn.className='btn no-print hidden';
  editSettingsBtn.textContent='Edit Settings';
  formDiv.parentNode.appendChild(settingsCard); formDiv.parentNode.appendChild(editSettingsBtn);

  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveSettingsBtn.onclick = async () => {
    fineRates = {
      A : +$('fineAbsent').value || 0,
      Lt: +$('fineLate').value   || 0,
      L : +$('fineLeave').value  || 0,
      HD: +$('fineHalfDay').value|| 0
    };
    eligibilityPct = +$('eligibilityPct').value || 0;
    await Promise.all([ save('fineRates',fineRates), save('eligibilityPct',eligibilityPct) ]);
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
    hide(settingsCard, editSettingsBtn);
    show(formDiv, ...settingsInputs, saveSettingsBtn);
  };

  // 5. Setup
  async function loadSetup(){
    const [sc,cl,sec] = await Promise.all([get('schoolName'),get('teacherClass'),get('teacherSection')]);
    if(sc&&cl&&sec){
      $('schoolNameInput').value=sc;
      $('teacherClassSelect').value=cl;
      $('teacherSectionSelect').value=sec;
      $('setupText').textContent=`${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm')); show($('setupDisplay'));
      renderStudents(); updateCounters(); resetViews();
    }
  }
  $('saveSetup').onclick=async e=>{ e.preventDefault();
    const sc=$('schoolNameInput').value.trim(),
          cl=$('teacherClassSelect').value,
          sec=$('teacherSectionSelect').value;
    if(!sc||!cl||!sec){ alert('Complete setup'); return; }
    await Promise.all([ save('schoolName',sc), save('teacherClass',cl), save('teacherSection',sec) ]);
    await loadSetup();
  };
  $('editSetup').onclick=e=>{ e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // 6. Counters & utils
  function animateCounters(){
    document.querySelectorAll('.number').forEach(span=>{
      const target=+span.dataset.target; let count=0; const step=Math.max(1,target/100);
      (function upd(){ count+=step;
        span.textContent=count<target?Math.ceil(count):target;
        if(count<target) requestAnimationFrame(upd);
      })();
    });
  }
  function updateCounters(){
    const cl=$('teacherClassSelect').value,
          sec=$('teacherSectionSelect').value;
    $('sectionCount').dataset.target=students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target=students.filter(s=>s.cls===cl).length;
    $('schoolCount').dataset.target=students.length;
    animateCounters();
  }
  function resetViews(){
    hide(
      $('attendanceBody'),$('saveAttendance'),$('resetAttendance'),
      $('attendanceSummary'),$('downloadAttendancePDF'),$('shareAttendanceSummary'),
      $('instructions'),$('analyticsContainer'),$('graphs'),$('analyticsActions'),
      $('registerTableWrapper'),$('changeRegister'),$('saveRegister'),
      $('downloadRegister'),$('shareRegister')
    );
    show($('loadRegister'));
  }
  $('teacherClassSelect').onchange=()=>{ renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange=()=>{ renderStudents(); updateCounters(); resetViews(); };

  // 7. Student registration & status
  function renderStudents(){
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const tbody=$('studentsBody'); tbody.innerHTML=''; let idx=0;
    students.forEach((s,i)=>{
      if(s.cls!==cl||s.sec!==sec) return; idx++;
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(r=>stats[r[s.adm]||'A']++);
      const tf=stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const tp=(paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      const out=tf-tp, totalDays=stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct=totalDays?(stats.P/totalDays)*100:0;
      const status=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr=document.createElement('tr'); tr.dataset.index=i;
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>
        <td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${out}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>`;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked=false; toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }
  function toggleButtons(){
    const any=!!document.querySelector('.sel:checked');
    $('editSelected').disabled=!any;
    $('deleteSelected').disabled=!any;
  }
  $('studentsBody').addEventListener('change',e=>{ if(e.target.classList.contains('sel')) toggleButtons(); });
  $('selectAllStudents').onclick=()=>{ document.querySelectorAll('.sel').forEach(cb=>cb.checked=$('selectAllStudents').checked); toggleButtons(); };

  $('addStudent').onclick=async e=>{
    e.preventDefault();
    const n=$('studentName').value.trim(), p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(), o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim(),
          cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a){alert('All fields required');return;}
    if(!/^\d{7,15}$/.test(c)){alert('Contact 7–15 digits');return;}
    const adm=await genAdmNo();
    students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls:cl,sec});
    await save('students',students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };

  // (editSelected, doneEditing, deleteSelected, saveRegistration, shareRegistration, downloadRegistrationPDF remain unchanged)

  // 8. Payment modal
  function openPaymentModal(adm){
    $('payAdm').textContent=adm; $('paymentAmount').value=''; show($('paymentModal'));
  }
  $('savePayment').onclick=async()=>{
    const adm=$('payAdm').textContent, amt=+$('paymentAmount').value||0;
    paymentsData[adm]=paymentsData[adm]||[]; paymentsData[adm].push({date:new Date().toISOString().split('T')[0],amount:amt});
    await save('paymentsData',paymentsData); hide($('paymentModal')); renderStudents();
  };
  $('cancelPayment').onclick=()=>hide($('paymentModal'));

  // 9. Mark Attendance (unchanged)

  // 10. Analytics & PDF download
  let stats=[], analyticsFrom='', analyticsTo='';
  const atg=$('analyticsTarget'), asel=$('analyticsSectionSelect'),
        atype=$('analyticsType'), adate=$('analyticsDate'),
        amonth=$('analyticsMonth'), sems=$('semesterStart'),
        seme=$('semesterEnd'), ayear=$('yearStart'),
        asearch=$('analyticsSearch'),
        loadA=$('loadAnalytics'), resetA=$('resetAnalytics'),
        instr=$('instructions'),
        acont=$('analyticsContainer'),
        graphs=$('graphs'),
        aacts=$('analyticsActions'),
        barCtx=$('barChart').getContext('2d'),
        pieCtx=$('pieChart').getContext('2d');
  let barChart,pieChart;

  atg.onchange=()=>{atype.disabled=false;[asel,asearch].forEach(x=>x.classList.add('hidden'));[instr,acont,graphs,aacts].forEach(x=>x.classList.add('hidden'));if(atg.value==='section')asel.classList.remove('hidden');if(atg.value==='student')asearch.classList.remove('hidden');};
  atype.onchange=()=>{[adate,amonth,sems,seme,ayear].forEach(x=>x.classList.add('hidden'));[instr,acont,graphs,aacts].forEach(x=>x.classList.add('hidden'));resetA.classList.remove('hidden');if(atype.value==='date')adate.classList.remove('hidden');if(atype.value==='month')amonth.classList.remove('hidden');if(atype.value==='semester'){sems.classList.remove('hidden');seme.classList.remove('hidden');}if(atype.value==='year')ayear.classList.remove('hidden');};
  resetA.onclick=e=>{e.preventDefault();atype.value='';[adate,amonth,sems,seme,ayear,instr,acont,graphs,aacts].forEach(x=>x.classList.add('hidden'));resetA.classList.add('hidden');};

  loadA.onclick=()=>{
    if(atg.value==='student'&&!asearch.value.trim()){alert('Enter Adm# or Name');return;}
    let from,to;
    if(atype.value==='date')from=to=adate.value;
    else if(atype.value==='month'){const [y,m]=amonth.value.split('-').map(Number);from=`${amonth.value}-01`;to=`${amonth.value}-${new Date(y,m,0).getDate()}`;}
    else if(atype.value==='semester'){const [sy,sm]=sems.value.split('-').map(Number),[ey,em]=seme.value.split('-').map(Number);from=`${sems.value}-01`;to=`${seme.value}-${new Date(ey,em,0).getDate()}`;}
    else if(atype.value==='year'){from=`${ayear.value}-01-01`;to=`${ayear.value}-12-31`;}
    else{alert('Select period');return;}
    analyticsFrom=from;analyticsTo=to;
    const cls=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    let pool=students.filter(s=>s.cls===cls&&s.sec===sec);
    if(atg.value==='section')pool=pool.filter(s=>s.sec===asel.value);
    if(atg.value==='student'){const q=asearch.value.trim().toLowerCase();pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));}
    stats=pool.map(s=>({adm:s.adm,name:s.name,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs])=>{if(d<from||d>to)return;stats.forEach(st=>{const c=recs[st.adm]||'A';st[c]++;st.total++;});});
    stats.forEach(st=>{const tf=st.A*fineRates.A+st.Lt*fineRates.Lt+st.L*fineRates.L+st.HD*fineRates.HD;const tp=(paymentsData[st.adm]||[]).reduce((sum,p)=>sum+p.amount,0);st.outstanding=tf-tp;const pct=st.total?(st.P/st.total)*100:0;st.status=(st.outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';});
    // render table + charts...
    show(instr,acont,graphs,aacts);
  };

  $('shareAnalytics').onclick=()=>{const txt=`Analytics (${analyticsFrom} to ${analyticsTo})\n`+stats.map((st,i)=>`${i+1}. ${st.adm} ${st.name}: ${((st.P/st.total)*100).toFixed(1)}% / PKR ${st.outstanding}`).join('\n');window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`,'_blank');};

  $('downloadAnalytics').onclick=()=>{
    const school=$('setupText').textContent,margin=14;
    const doc=new jspdf.jsPDF({orientation:'landscape',unit:'pt',format:'a4'});
    let y=40;
    doc.setFontSize(18).text(`${school} – Attendance Summary Report`,margin,y);y+=24;
    doc.setFontSize(12).text(`Period: ${analyticsFrom} – ${analyticsTo}`,margin,y);y+=24;
    doc.autoTable({startY:y,head:[['Adm#','Name','% Present','Outstanding','Status']],body:stats.map(st=>[st.adm,st.name,`${((st.P/st.total)*100).toFixed(1)}%`,`PKR ${st.outstanding}`,st.status]),styles:{fontSize:10},margin:{left:margin,right:margin}});
    doc.addPage('landscape');y=40;
    doc.setFontSize(18).text(`${school} – Detailed Fines & Eligibility`,margin,y);y+=24;
    doc.autoTable({startY:y,head:[['Adm#','Name','Absent','Late','Leave','Half-Day','Outstanding','Status']],body:stats.map(st=>[st.adm,st.name,`${st.A} (PKR ${st.A*fineRates.A})`,`${st.Lt} (PKR ${st.Lt*fineRates.Lt})`,`${st.L} (PKR ${st.L*fineRates.L})`,`${st.HD} (PKR ${st.HD*fineRates.HD})`,`PKR ${st.outstanding}`,st.status]),styles:{fontSize:10},margin:{left:margin,right:margin}});
    doc.save('attendance_full_report.pdf');
  };

  // 11. Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
