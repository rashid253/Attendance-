window.addEventListener('DOMContentLoaded', async () => {
  // 1. idb-keyval
  const { get, set } = window.idbKeyval || {};
  if (!get) return console.error('idb-keyval missing');
  const save = (k,v) => set(k,v);

  // 2. State
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};
  let paymentsData   = await get('paymentsData')   || {};
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;
  let fineRates      = await get('fineRates')      || {A:50,Lt:20,L:10,HD:0};
  let eligibilityPct = await get('eligibilityPct') || 75;

  async function genAdmNo(){ lastAdmNo++; await save('lastAdmissionNo',lastAdmNo); return String(lastAdmNo).padStart(4,'0'); }

  const $=id=>document.getElementById(id), show=(...e)=>e.forEach(x=>x&&x.classList.remove('hidden')), hide=(...e)=>e.forEach(x=>x&&x.classList.add('hidden'));

  // SETTINGS
  $('fineAbsent').value=fineRates.A; $('fineLate').value=fineRates.Lt;
  $('fineLeave').value=fineRates.L; $('fineHalfDay').value=fineRates.HD;
  $('eligibilityPct').value=eligibilityPct;
  $('saveSettings').onclick=async()=>{
    fineRates={A:+$('fineAbsent').value||0,Lt:+$('fineLate').value||0,L:+$('fineLeave').value||0,HD:+$('fineHalfDay').value||0};
    eligibilityPct=+$('eligibilityPct').value||0;
    await save('fineRates',fineRates); await save('eligibilityPct',eligibilityPct);
    alert('Saved');
  };

  // SETUP
  async function loadSetup(){
    const [s,c,sec] = await Promise.all([get('schoolName'),get('teacherClass'),get('teacherSection')]);
    if(s&&c&&sec){ $('schoolNameInput').value=s; $('teacherClassSelect').value=c; $('teacherSectionSelect').value=sec;
      $('setupText').textContent=`${s} 🏫 | Class: ${c} | Section: ${sec}`;
      hide($('setupForm')); show($('setupDisplay')); renderStudents(); updateCounters(); resetViews(); }
  }
  $('saveSetup').onclick=async e=>{e.preventDefault(); const s=$('schoolNameInput').value.trim(),c=$('teacherClassSelect').value,sc=$('teacherSectionSelect').value;
    if(!s||!c||!sc){alert('Complete');return;} await save('schoolName',s);await save('teacherClass',c);await save('teacherSection',sc); await loadSetup();
  };
  $('editSetup').onclick=e=>{e.preventDefault();show($('setupForm'));hide($('setupDisplay'));};
  await loadSetup();

  // COUNTERS
  function animateCounters(){ document.querySelectorAll('.number').forEach(sp=>{ const tgt=+sp.dataset.target; let ct=0,st=Math.max(1,tgt/100);
      (function up(){ ct+=st; sp.textContent=ct<tgt?Math.ceil(ct):tgt; if(ct<tgt)requestAnimationFrame(up); })(); }); }
  function updateCounters(){ const c=$('teacherClassSelect').value,sc=$('teacherSectionSelect').value;
    $('sectionCount').dataset.target=students.filter(s=>s.cls===c&&s.sec===sc).length;
    $('classCount').dataset.target=students.filter(s=>s.cls===c).length;
    $('schoolCount').dataset.target=students.length; animateCounters(); }
  $('teacherClassSelect').onchange=()=>{renderStudents();updateCounters();resetViews();};
  $('teacherSectionSelect').onchange=()=>{renderStudents();updateCounters();resetViews();};

  function resetViews(){ hide($('attendanceBody'),$('saveAttendance'),$('resetAttendance'),$('attendanceSummary'),$('downloadAttendancePDF'),$('shareAttendanceSummary'),
    $('instructions'),$('analyticsContainer'),$('graphs'),$('analyticsActions'),$('registerTableWrapper'),$('changeRegister'),$('saveRegister'),$('downloadRegister'),$('shareRegister')); show($('loadRegister')); }

  // REGISTRATION
  function renderStudents(){ const c=$('teacherClassSelect').value, sc=$('teacherSectionSelect').value, tb=$('studentsBody'); tb.innerHTML=''; let idx=0;
    students.forEach((s,i)=>{ if(s.cls!==c||s.sec!==sc) return; idx++;
      const st={P:0,A:0,Lt:0,HD:0,L:0}; Object.values(attendanceData).forEach(r=>st[r[s.adm]||'A']++);
      const tf=st.A*fineRates.A+st.Lt*fineRates.Lt+st.L*fineRates.L+st.HD*fineRates.HD;
      const tp=(paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0), out=tf-tp;
      const days=st.P+st.A+st.Lt+st.HD+st.L, pct=days?st.P/days*100:0;
      const status=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr=document.createElement('tr');tr.dataset.index=i; tr.innerHTML=`<td><input type='checkbox' class='sel'></td><td>${idx}</td><td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td><td>₹ ${out}</td><td>${status}</td><td><button class='add-payment-btn' data-adm='${s.adm}'><i class='fas fa-coins'></i></button></td><td><i class='fas fa-share-alt share-row' data-adm='${s.adm}'></i></td>`;
      tb.append(tr);
    }); $('selectAllStudents').checked=false; toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
    document.querySelectorAll('.share-row').forEach(ic=>ic.onclick=()=>{const adm=ic.dataset.adm,s=students.find(x=>x.adm===adm);const m=`*${s.name}*\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOcc: ${s.occupation}\nAddr: ${s.address}`; window.open(`https://wa.me/?text=${encodeURIComponent(m)}`,'_blank');});
  }
  function toggleButtons(){const any=!!document.querySelector('.sel:checked');$('editSelected').disabled=!any;$('deleteSelected').disabled=!any;}
  $('studentsBody').addEventListener('change',e=>{if(e.target.classList.contains('sel'))toggleButtons();});
  $('selectAllStudents').onclick=()=>{document.querySelectorAll('.sel').forEach(cb=>cb.checked=$('selectAllStudents').checked);toggleButtons();};

  // Add/Edit/Delete/Save Registration
  $('addStudent').onclick=async e=>{e.preventDefault();const n=$('studentName').value.trim(),p=$('parentName').value.trim(),c=$('parentContact').value.trim(),o=$('parentOccupation').value.trim(),a=$('parentAddress').value.trim(),cl=$('teacherClassSelect').value,sc=$('teacherSectionSelect').value;if(!n||!p||!c||!o||!a){alert('All required');return;}if(!/^[0-9]{7,15}$/.test(c)){alert('Contact digits');return;}const adm=await genAdmNo();students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls:cl,sec:sc});await save('students',students);renderStudents();updateCounters();resetViews();['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');};
  $('editSelected').onclick=()=>{/*...*/}; $('doneEditing').onclick=async()=>{/*...*/}; $('deleteSelected').onclick=async()=>{/*...*/}; $('saveRegistration').onclick=async()=>{/*...*/}; $('editRegistration').onclick=()=>{/*...*/}; $('shareRegistration').onclick=()=>{/*...*/}; $('downloadRegistrationPDF').onclick=()=>{/*...*/};

  // 8. Payment Modal
  function openPaymentModal(adm){$('payAdm').textContent=adm;$('paymentAmount').value='';show($('paymentModal'));}
  $('savePayment').onclick=async()=>{const adm=$('payAdm').textContent,amt=+$('paymentAmount').value||0;paymentsData[adm]=paymentsData[adm]||[];paymentsData[adm].push({date:new Date().toISOString().split('T')[0],amount:amt});await save('paymentsData',paymentsData);hide($('paymentModal'));renderStudents();};
  $('cancelPayment').onclick=()=>hide($('paymentModal'));

  // 9. Mark Attendance (unchanged working code)
  // 10. Analytics & PDF
  $('downloadAnalytics').onclick=()=>{/*...*/};
  // 11. Register PDF
  $('downloadRegister').onclick=()=>{/*...*/};
  // 12. Service Worker
  if('serviceWorker' in navigator)navigator.serviceWorker.register('service-worker.js').catch(console.error);
});
