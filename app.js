// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // Eruda debug console
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // idb-keyval
  const { get, set } = window.idbKeyval;

  // State & DataStores
  let students        = await get('students')       || [];
  let attendanceData  = await get('attendanceData') || {};
  let finesData       = await get('finesData')     || {};
  let paymentsData    = await get('paymentsData')  || {};
  let lastAdmNo       = await get('lastAdmissionNo')|| 0;
  let fineRates       = await get('fineRates')     || { A:50, Lt:20, L:10, HD:0 };
  let eligibilityPct  = await get('eligibilityPct')|| 75;

  // Helpers
  const save = (k,v) => set(k,v);
  async function genAdmNo() { lastAdmNo++; await save('lastAdmissionNo', lastAdmNo); return String(lastAdmNo).padStart(4,'0'); }
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // Cache registration form container
  const registrationFormDiv = document.querySelector('#student-registration .row-inline');

  // 1. SETTINGS
  $('fineAbsent').value   = fineRates.A;
  $('fineLate').value     = fineRates.Lt;
  $('fineLeave').value    = fineRates.L;
  $('fineHalfDay').value  = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;
  $('saveSettings').onclick = async () => {
    fineRates = {
      A  : Number($('fineAbsent').value)   || 0,
      Lt : Number($('fineLate').value)     || 0,
      L  : Number($('fineLeave').value)    || 0,
      HD : Number($('fineHalfDay').value)  || 0
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);
    alert('Settings saved!');
  };

  // 2. SETUP
  async function loadSetup() {
    const [sc,cl,sec] = await Promise.all([get('schoolName'), get('teacherClass'), get('teacherSection')]);
    if (sc&&cl&&sec) {
      $('schoolNameInput').value = sc;
      $('teacherClassSelect').value = cl;
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
    if(!sc||!cl||!sec){ alert('Complete setup'); return; }
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // 3. COUNTERS
  function animateCounters(){
    document.querySelectorAll('.number').forEach(span=>{
      const tgt=+span.dataset.target; let c=0,step=Math.max(1,tgt/100);
      (function up(){ c+=step; span.textContent=c<tgt?Math.ceil(c):tgt; if(c<tgt) requestAnimationFrame(up); })();
    });
  }
  function updateCounters(){
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  $('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange= () => { renderStudents(); updateCounters(); resetViews(); };

  function resetViews(){
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'),
      $('registerTableWrapper'), $('changeRegister'), $('saveRegister'),
      $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }

  // 4. STUDENT REGISTRATION
  function renderStudents(){
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value, tbody=$('studentsBody');
    tbody.innerHTML=''; let idx=0;
    students.forEach((s,i)=>{
      if(s.cls!==cl||s.sec!==sec) return;
      idx++;
      const totalFine=(finesData[s.adm]||[]).reduce((sum,f)=>sum+f.amount,0);
      const totalPaid=(paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      const outstanding=totalFine-totalPaid;
      const days=Object.keys(attendanceData).length;
      const present=Object.values(attendanceData).filter(r=>r[s.adm]==='P').length;
      const pct=days?present/days*100:0;
      const status=(outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr=document.createElement('tr'); tr.dataset.index=i;
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>₹ ${outstanding}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>`;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked=false; toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }
  function toggleButtons(){
    const any=!!document.querySelector('.sel:checked');
    $('editSelected').disabled=!any; $('deleteSelected').disabled=!any;
  }
  $('studentsBody').addEventListener('change',e=> e.target.classList.contains('sel')&&toggleButtons() );
  $('selectAllStudents').onclick=()=>{ document.querySelectorAll('.sel').forEach(cb=>cb.checked=$('selectAllStudents').checked); toggleButtons(); };

  $('addStudent').onclick=async e=>{
    e.preventDefault();
    const n=$('studentName').value.trim(), p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(), o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim(), cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a){ alert('All fields required'); return; }
    if(!/^\d{7,15}$/.test(c)){ alert('Contact 7-15 digits'); return; }
    const adm=await genAdmNo();
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec });
    await save('students',students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };

  $('editSelected').onclick=()=>{
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
        <td colspan="3"></td>`;
    });
    hide($('editSelected')); show($('doneEditing'));
  };
  $('doneEditing').onclick=async()=>{
    document.querySelectorAll('#studentsBody tr').forEach(tr=>{
      const inp=tr.querySelectorAll('input:not(.sel)');
      if(inp.length===5){
        const [n,p,c,o,a]=[...inp].map(i=>i.value.trim());
        const adm=tr.children[3].textContent;
        const idx=students.findIndex(s=>s.adm===adm);
        if(idx>-1)students[idx]={...students[idx],name:n,parent:p,contact:c,occupation:o,address:a};
      }
    });
    await save('students',students);
    hide($('doneEditing')); show($('editSelected'),$('deleteSelected'),$('saveRegistration'));
    renderStudents(); updateCounters();
  };

  $('deleteSelected').onclick=async()=>{
    if(!confirm('Delete selected?'))return;
    const del=[...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students=students.filter((_,i)=>!del.includes(i));
    await save('students',students);
    renderStudents(); updateCounters(); resetViews();
  };

  $('saveRegistration').onclick=async()=>{
    if(!$('doneEditing').classList.contains('hidden')){ alert('Finish editing'); return; }
    await save('students',students);
    hide(registrationFormDiv,$('editSelected'),$('deleteSelected'),$('selectAllStudents'),$('saveRegistration'));
    show($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  $('editRegistration').onclick=()=>{
    show(registrationFormDiv,$('selectAllStudents'),$('editSelected'),$('deleteSelected'),$('saveRegistration'));
    hide($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };

  $('shareRegistration').onclick=()=>{
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const hdr=`*Students List*\nClass ${cl} Section ${sec}`;
    const lines=students.filter(s=>s.cls===cl&&s.sec===sec).map(s=>{
      const tf=(finesData[s.adm]||[]).reduce((a,f)=>a+f.amount,0);
      const tp=(paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out=tf-tp; const days=Object.keys(attendanceData).length;
      const pres=Object.values(attendanceData).filter(r=>r[s.adm]==='P').length;
      const pct=days?pres/days*100:0; const st=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: ₹${out}\nStatus: ${st}`;
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`,'_blank');
  };
  $('downloadRegistrationPDF').onclick=()=>{
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Student List',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#studentsTable' });
    const url=doc.output('bloburl'); window.open(url,'_blank');
    doc.save('registration.pdf');
  };

  // 5. MARK ATTENDANCE (same as before)...

  // 6. ANALYTICS
  // (Implement as in prior code, ensuring loadAnalytics, charts, and PDF download work)

  // 7. ATTENDANCE REGISTER
  // (Implement as in prior code, ensuring loadRegister, edit/save/reset, and PDF/download share work)

  // PAYMENT MODAL Logic
  function openPaymentModal(adm){
    $('payAdm').textContent=adm;
    $('paymentAmount').value='';
    show($('paymentModal'));
  }
  $('savePayment').onclick=async()=>{
    const adm=$('payAdm').textContent, amt=Number($('paymentAmount').value)||0;
    paymentsData[adm]=paymentsData[adm]||[];
    paymentsData[adm].push({date:new Date().toISOString().split('T')[0],amount:amt});
    await save('paymentsData',paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };
  $('cancelPayment').onclick=()=>hide($('paymentModal'));

  // Service Worker
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(console.error);
});
