window.addEventListener('DOMContentLoaded', async () => {
  // --- Universal PDF share helper (must come first) ---
  async function sharePdf(blob, fileName, title) {
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })) {
      try {
        await navigator.share({ title, files: [new File([blob], fileName, { type: 'application/pdf' })] });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share failed', err);
      }
    }
  }

  // --- Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) { console.error('idb-keyval not found'); return; }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // --- State & Defaults ---
  let students       = await get('students')        || [];
  let attendanceData = await get('attendanceData')  || {};
  let paymentsData   = await get('paymentsData')    || {};
  let lastAdmNo      = await get('lastAdmissionNo') || 0;
  let fineRates      = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct = await get('eligibilityPct')  || 75;
  let analyticsFilterOptions = ['all'], analyticsDownloadMode = 'combined';
  let lastAnalyticsStats = [], lastAnalyticsRange = { from: null, to: null }, lastAnalyticsShare = '';

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- Registration PDF & Share ---
  $('downloadRegistrationPDF').onclick = async () => {
    const doc = new jspdf.jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split('T')[0];
    doc.setFontSize(18).text('Registered Students', 14, 16);
    doc.setFontSize(10).text(`Date: ${today}`, w-14, 16, { align:'right' });
    doc.setFontSize(12).text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 30, html: '#studentsTable' });
    const blob = doc.output('blob');
    doc.save('registration.pdf');
    await sharePdf(blob,'registration.pdf','Registered Students');
  };
  $('shareRegistration').onclick = () => {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}\n`;
    const lines = students.filter(s=>s.cls===cl&&s.sec===sec).map(s => {
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(r=>r[s.adm]&&stats[r[s.adm]]++);
      const totalMarked=stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const fine=stats.A*fineRates.A+stats.Lt*fineRates.Lt+stats.L*fineRates.L+stats.HD*fineRates.HD;
      const paid=(paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out=fine-paid, pct=totalMarked?stats.P/totalMarked*100:0;
      const status=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: PKR ${out}\nStatus: ${status}`;
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+lines)}`,'_blank');
  };

  // --- Settings ---
  const formDiv=$('financialForm'), saveSettings=$('saveSettings');
  const inputs=['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map(id=>$(id));
  const settingsCard=document.createElement('div'), editSettings=document.createElement('button');
  settingsCard.id='settingsCard'; settingsCard.className='card hidden';
  editSettings.id='editSettings'; editSettings.className='btn no-print hidden'; editSettings.textContent='Edit Settings';
  formDiv.parentNode.appendChild(settingsCard); formDiv.parentNode.appendChild(editSettings);
  $('fineAbsent').value=fineRates.A; $('fineLate').value=fineRates.Lt;
  $('fineLeave').value=fineRates.L; $('fineHalfDay').value=fineRates.HD;
  $('eligibilityPct').value=eligibilityPct;
  saveSettings.onclick=async()=>{
    fineRates={A:+$('fineAbsent').value||0, Lt:+$('fineLate').value||0, L:+$('fineLeave').value||0, HD:+$('fineHalfDay').value||0};
    eligibilityPct=+$('eligibilityPct').value||0;
    await Promise.all([save('fineRates',fineRates), save('eligibilityPct',eligibilityPct)]);
    settingsCard.innerHTML=`
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
      </div>`;
    hide(formDiv,saveSettings,...inputs); show(settingsCard,editSettings);
  };
  editSettings.onclick=()=>{hide(settingsCard,editSettings); show(formDiv,saveSettings,...inputs);};

  // --- Setup school/class/section ---
  async function loadSetup() {
    const [sc,cl,sec] = await Promise.all([get('schoolName'),get('teacherClass'),get('teacherSection')]);
    if(sc&&cl&&sec){
      $('schoolNameInput').value=sc; $('teacherClassSelect').value=cl; $('teacherSectionSelect').value=sec;
      $('setupText').textContent=`${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm')); show($('setupDisplay')); renderStudents(); updateCounters(); resetViews();
    }
  }
  $('saveSetup').onclick=async e=>{e.preventDefault();
    const sc=$('schoolNameInput').value.trim(), cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    if(!sc||!cl||!sec){alert('Complete setup');return;}
    await Promise.all([save('schoolName',sc),save('teacherClass',cl),save('teacherSection',sec)]);
    loadSetup();
  };
  $('editSetup').onclick=e=>{e.preventDefault(); show($('setupForm')); hide($('setupDisplay'));};
  await loadSetup();

  // --- Counters & Utils ---
  function animateCounters(){
    document.querySelectorAll('.number').forEach(span=>{
      const target=+span.dataset.target; let count=0; const step=Math.max(1,target/100);
      (function upd(){count+=step; span.textContent=count<target?Math.ceil(count):target; if(count<target)requestAnimationFrame(upd);})();
    });
  }
  function updateCounters(){
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    $('sectionCount').dataset.target=students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target=students.filter(s=>s.cls===cl).length;
    $('schoolCount').dataset.target=students.length;
    animateCounters();
  }
  function resetViews(){
    hide($('attendanceBody'),$('saveAttendance'),$('resetAttendance'),
         $('attendanceSummary'),$('downloadAttendancePDF'),$('shareAttendanceSummary'),
         $('instructions'),$('analyticsContainer'),$('graphs'),$('analyticsActions'),
         $('registerTableWrapper'),$('changeRegister'),
         $('saveRegister'),$('downloadRegister'),$('shareRegister'));
    show($('loadRegister'));
  }
  $('teacherClassSelect').onchange=()=>{renderStudents();updateCounters();resetViews();};
  $('teacherSectionSelect').onchange=()=>{renderStudents();updateCounters();resetViews();};

  // --- Student registration & fine/status ---
  function renderStudents(){
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value, tbody=$('studentsBody');
    tbody.innerHTML=''; let idx=0;
    students.forEach((s,i)=>{
      if(s.cls!==cl||s.sec!==sec) return;
      idx++;
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(r=>r[s.adm]&&stats[r[s.adm]]++);
      const total=stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const fine=stats.A*fineRates.A+stats.Lt*fineRates.Lt+stats.L*fineRates.L+stats.HD*fineRates.HD;
      const paid=(paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out=fine-paid, pct=total?stats.P/total*100:0;
      const status=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr=document.createElement('tr'); tr.dataset.index=i;
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td><td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${out}</td><td>${status}</td>
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
  $('studentsBody').addEventListener('change',e=>e.target.classList.contains('sel')&&toggleButtons());
  $('selectAllStudents').onclick=()=>{document.querySelectorAll('.sel').forEach(c=>c.checked=$('selectAllStudents').checked); toggleButtons();};

  $('addStudent').onclick=async e=>{
    e.preventDefault();
    const n=$('studentName').value.trim(),p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(),o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim(),cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a){alert('All required');return;}
    if(!/^\d{7,15}$/.test(c)){alert('Contact 7–15 digits');return;}
    const adm=await genAdmNo();
    students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls:cl,sec});
    await save('students',students); renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };
  $('editSelected').onclick=()=>{
    document.querySelectorAll('.sel:checked').forEach(cb=>{
      const tr=cb.closest('tr'), i=+tr.dataset.index, s=students[i];
      tr.innerHTML=`
        <td><input type="checkbox" class="sel" checked></td><td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"></td><td>${s.adm}</td>
        <td><input value="${s.parent}"></td><td><input value="${s.contact}"></td>
        <td><input value="${s.occupation}"></td><td><input value="${s.address}"></td><td colspan="3"></td>`;
    });
    hide($('editSelected')); show($('doneEditing'));
  };
  $('doneEditing').onclick=async()=>{
    document.querySelectorAll('#studentsBody tr').forEach(tr=>{
      const inps=[...tr.querySelectorAll('input:not(.sel)')];
      if(inps.length===5){
        const [n,p,c,o,a]=inps.map(i=>i.value.trim()), adm=tr.children[3].textContent;
        const idx=students.findIndex(x=>x.adm===adm);
        students[idx]={...students[idx],name:n,parent:p,contact:c,occupation:o,address:a};
      }
    });
    await save('students',students);
    hide($('doneEditing')); show($('editSelected'),$('deleteSelected'),$('saveRegistration'));
    renderStudents(); updateCounters();
  };
  $('deleteSelected').onclick=async()=>{
    if(!confirm('Delete?'))return;
    const toDel=[...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students=students.filter((_,i)=>!toDel.includes(i));
    await save('students',students); renderStudents(); updateCounters(); resetViews();
  };
  $('saveRegistration').onclick=async()=>{
    if(!$('doneEditing').classList.contains('hidden')){alert('Finish editing');return;}
    await save('students',students);
    hide(document.querySelector('#student-registration .row-inline'),$('editSelected'),$('deleteSelected'),$('selectAllStudents'),$('saveRegistration'));
    show($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  $('editRegistration').onclick=()=>{ show(document.querySelector('#student-registration .row-inline'),$('selectAllStudents'),$('editSelected'),$('deleteSelected'),$('saveRegistration')); hide($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF')); renderStudents(); updateCounters(); };

  // --- Payment Modal ---
  function openPaymentModal(adm){ $('payAdm').textContent=adm; $('paymentAmount').value=''; show($('paymentModal')); }
  $('paymentModalClose').onclick=()=>hide($('paymentModal'));
  $('savePayment').onclick=async()=>{
    const adm=$('payAdm').textContent, amt=Number($('paymentAmount').value)||0;
    paymentsData[adm]=paymentsData[adm]||[]; paymentsData[adm].push({date:new Date().toISOString().split('T')[0],amount:amt});
    await save('paymentsData',paymentsData); hide($('paymentModal')); renderStudents();
  };
  $('cancelPayment').onclick=()=>hide($('paymentModal'));

  // --- Mark Attendance ---
  const dateInput=$('dateInput'), loadAttendanceBtn=$('loadAttendance'), saveAttendanceBtn=$('saveAttendance'),
        resetAttendanceBtn=$('resetAttendance'), downloadAttendanceBtn=$('downloadAttendancePDF'),
        shareAttendanceBtn=$('shareAttendanceSummary'), attendanceBodyDiv=$('attendanceBody'),
        attendanceSummaryDiv=$('attendanceSummary'),
        statusNames={P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'},
        statusColors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};

  loadAttendanceBtn.onclick=()=>{ attendanceBodyDiv.innerHTML=''; attendanceSummaryDiv.innerHTML=''; const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value; attendanceBodyDiv.style.overflowX='auto'; students.filter(s=>s.cls===cl&&s.sec===sec).forEach((stu,i)=>{ const row=document.createElement('div'); row.className='attendance-row'; const headerDiv=document.createElement('div'); headerDiv.className='attendance-header'; headerDiv.textContent=`${i+1}. ${stu.name} (${stu.adm})`; const btnsDiv=document.createElement('div'); btnsDiv.className='attendance-buttons'; Object.keys(statusNames).forEach(code=>{ const btn=document.createElement('button'); btn.className='att-btn'; btn.textContent=code; btn.onclick=()=>{ btnsDiv.querySelectorAll('.att-btn').forEach(b=>{b.classList.remove('selected');b.style='';}); btn.classList.add('selected'); btn.style.background=statusColors[code]; btn.style.color='#fff'; }; btnsDiv.appendChild(btn); }); row.append(headerDiv,btnsDiv); attendanceBodyDiv.appendChild(row); }); show(attendanceBodyDiv,saveAttendanceBtn); hide(resetAttendanceBtn,downloadAttendanceBtn,shareAttendanceBtn,attendanceSummaryDiv); };

  saveAttendanceBtn.onclick=async()=>{ const date=dateInput.value; if(!date){alert('Pick date');return;} attendanceData[date]={}; const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value; students.filter(s=>s.cls===cl&&s.sec===sec).forEach((s,i)=>{ const sel=attendanceBodyDiv.children[i].querySelector('.att-btn.selected'); attendanceData[date][s.adm]=sel?sel.textContent:'A'; }); await save('attendanceData',attendanceData); attendanceSummaryDiv.innerHTML=`<h3>Attendance Report: ${date}</h3>`; const tbl=document.createElement('table'); tbl.id='attendanceSummaryTable'; tbl.innerHTML='<tr><th>Sr#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th></tr>'; students.filter(s=>s.cls===cl&&s.sec===sec).forEach((s,i)=>{ const code=attendanceData[date][s.adm]; tbl.innerHTML+=`<tr><td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td><td>${statusNames[code]}</td><td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td></tr>`; }); attendanceSummaryDiv.appendChild(tbl); attendanceSummaryDiv.querySelectorAll('.share-individual').forEach(ic=>ic.onclick=()=>{ const adm=ic.dataset.adm, st=students.find(x=>x.adm===adm); const msg=`Dear Parent, your child (Adm#: ${adm}) was ${statusNames[attendanceData[date][adm]]} on ${date}.`; window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`,'_blank'); }); hide(attendanceBodyDiv,saveAttendanceBtn); show(resetAttendanceBtn,downloadAttendanceBtn,shareAttendanceBtn,attendanceSummaryDiv); };

  resetAttendanceBtn.onclick=()=>{ show(attendanceBodyDiv,saveAttendanceBtn); hide(resetAttendanceBtn,downloadAttendanceBtn,shareAttendanceBtn,attendanceSummaryDiv); };

  downloadAttendanceBtn.onclick=async()=>{ const doc=new jspdf.jsPDF(); const w=doc.internal.pageSize.getWidth(), today=new Date().toISOString().split('T')[0]; doc.setFontSize(18).text('Attendance Report',14,16); doc.setFontSize(10).text(`Date: ${today}`,w-14,16,{align:'right'}); doc.setFontSize(12).text($('setupText').textContent,14,24); doc.autoTable({startY:30,html:'#attendanceSummaryTable'}); const fn=`attendance_${dateInput.value}.pdf`, blob=doc.output('blob'); doc.save(fn); await sharePdf(blob,fn,'Attendance Report'); };

  shareAttendanceBtn.onclick=()=>{ const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value, date=dateInput.value; const header=`*Attendance Report*\nClass ${cl} Sec ${sec} - ${date}\n`; const lines=students.filter(s=>s.cls===cl&&s.sec===sec).map((s,i)=>`${i+1}. ${s.name} (Adm#: ${s.adm}): ${statusNames[attendanceData[date][s.adm]]}`); window.open(`https://wa.me/?text=${encodeURIComponent(header+lines.join('\n'))}`,'_blank'); };

  // --- Analytics & PDF Download/Share ---
  const atg=$('analyticsTarget'), asel=$('analyticsSectionSelect'), atype=$('analyticsType'),
        adate=$('analyticsDate'), amonth=$('analyticsMonth'), sems=$('semesterStart'),
        seme=$('semesterEnd'), ayear=$('yearStart'), asearch=$('analyticsSearch'),
        loadA=$('loadAnalytics'), resetA=$('resetAnalytics'),
        instr=$('instructions'), acont=$('analyticsContainer'),
        graphs=$('graphs'), aacts=$('analyticsActions'),
        barCtx=$('barChart').getContext('2d'), pieCtx=$('pieChart').getContext('2d');
  let barChart,pieChart;
  const analyticsStatusNames={P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'};
  const analyticsStatusColors={
    P:getComputedStyle(document.documentElement).getPropertyValue('--success').trim(),
    A:getComputedStyle(document.documentElement).getPropertyValue('--danger').trim(),
    Lt:getComputedStyle(document.documentElement).getPropertyValue('--warning').trim(),
    HD:'#FF9800', L:getComputedStyle(document.documentElement).getPropertyValue('--info').trim()
  };

  $('analyticsFilterBtn').onclick=()=>show($('analyticsFilterModal'));
  $('analyticsFilterClose').onclick=()=>hide($('analyticsFilterModal'));
  $('applyAnalyticsFilter').onclick=()=>{
    analyticsFilterOptions=Array.from(document.querySelectorAll('#analyticsFilterForm input[type="checkbox"]:checked')).map(cb=>cb.value)||['all'];
    analyticsDownloadMode=document.querySelector('#analyticsFilterForm input[name="downloadMode"]:checked').value;
    hide($('analyticsFilterModal'));
    if(lastAnalyticsStats.length) renderAnalytics(lastAnalyticsStats,lastAnalyticsRange.from,lastAnalyticsRange.to);
  };

  atg.onchange=()=>{
    atype.disabled=false; [asel,asearch].forEach(x=>x.classList.add('hidden')); [instr,acont,graphs,aacts].forEach(x=>x.classList.add('hidden'));
    if(atg.value==='section') asel.classList.remove('hidden');
    if(atg.value==='student') asearch.classList.remove('hidden');
  };
  atype.onchange=()=>{
    [adate,amonth,sems,seme,ayear].forEach(x=>x.classList.add('hidden'));
    [instr,acont,graphs,aacts].forEach(x=>x.classList.add('hidden'));
    resetA.classList.remove('hidden');
    if(atype.value==='date') adate.classList.remove('hidden');
    if(atype.value==='month') amonth.classList.remove('hidden');
    if(atype.value==='semester'){ sems.classList.remove('hidden'); seme.classList.remove('hidden'); }
    if(atype.value==='year') ayear.classList.remove('hidden');
  };
  resetA.onclick=e=>{e.preventDefault();atype.value='';[adate,amonth,sems,seme,ayear,instr,acont,graphs,aacts].forEach(x=>x.classList.add('hidden'));resetA.classList.add('hidden');};

  loadA.onclick=()=>{
    if(atg.value==='student'&&!asearch.value.trim()){alert('Enter admission# or name');return;}
    let from,to;
    if(atype.value==='date'){ from=to=adate.value; }
    else if(atype.value==='month'){ const [y,m]=amonth.value.split('-').map(Number); from=`${amonth.value}-01`; to=`${amonth.value}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`; }
    else if(atype.value==='semester'){ const [sy,sm]=sems.value.split('-').map(Number); const [ey,em]=seme.value.split('-').map(Number); from=`${sems.value}-01`; to=`${seme.value}-${String(new Date(ey,em,0).getDate()).padStart(2,'0')}`; }
    else if(atype.value==='year'){ from=`${ayear.value}-01-01`; to=`${ayear.value}-12-31`; }
    else{alert('Select period');return;}

    const cls=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    let pool=students.filter(s=>s.cls===cls&&s.sec===sec);
    if(atg.value==='section') pool=pool.filter(s=>s.sec===asel.value);
    if(atg.value==='student'){ const q=asearch.value.trim().toLowerCase(); pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q)); }

    const stats=pool.map(s=>({adm:s.adm,name:s.name,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,rec])=>{
      if(d<from||d>to) return;
      stats.forEach(st=>{ if(rec[st.adm]){ st[rec[st.adm]]++; st.total++; } });
    });
    stats.forEach(st=>{ const tf=st.A*fineRates.A+st.Lt*fineRates.Lt+st.L*fineRates.L+st.HD*fineRates.HD; const paid=(paymentsData[st.adm]||[]).reduce((a,p)=>a+p.amount,0); st.outstanding=tf-paid; st.status=(st.outstanding>0||(st.total?st.P/st.total*100:0)<eligibilityPct)?'Debarred':'Eligible'; });
    lastAnalyticsStats=stats; lastAnalyticsRange={from,to}; renderAnalytics(stats,from,to);
  };

  function renderAnalytics(stats,from,to){
    let filtered=stats;
    if(!analyticsFilterOptions.includes('all')){
      filtered=stats.filter(st=>analyticsFilterOptions.some(opt=>{
        if(opt==='registered') return true;
        if(opt==='attendance') return st.total>0;
        if(opt==='fine') return st.A>0||st.Lt>0||st.L>0||st.HD>0;
        if(opt==='cleared') return st.outstanding===0;
        if(opt==='debarred') return st.status==='Debarred';
        if(opt==='eligible') return st.status==='Eligible';
      }));
    }
    const thead=$('analyticsTable').querySelector('thead tr');
    thead.innerHTML=['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status'].map(h=>`<th>${h}</th>`).join('');
    const tbody=$('analyticsBody'); tbody.innerHTML='';
    filtered.forEach((st,i)=>{ const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0'; const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${pct}%</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>`; tbody.appendChild(tr); });
    instr.textContent=`Period: ${from} to ${to}`; show(instr,acont,graphs,aacts);
    barChart?.destroy();
    barChart=new Chart(barCtx,{type:'bar',data:{labels:filtered.map(st=>st.name),datasets:[{label:'% Present',data:filtered.map(st=>st.total?st.P/st.total*100:0),backgroundColor:filtered.map(_=>analyticsStatusColors.P)}]},options:{scales:{y:{beginAtZero:true,max:100}}}});
    const totals=filtered.reduce((a,st)=>{a.P+=st.P; a.A+=st.A; a.Lt+=st.Lt; a.HD+=st.HD; a.L+=st.L; return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    pieChart?.destroy();
    pieChart=new Chart(pieCtx,{type:'pie',data:{labels:Object.values(analyticsStatusNames),datasets:[{data:Object.keys(analyticsStatusNames).map(c=>totals[c]),backgroundColor:Object.keys(analyticsStatusNames).map(c=>analyticsStatusColors[c])}]}});
    lastAnalyticsShare=`Attendance Analytics (${from} to ${to})\n`+filtered.map((st,i)=>`${i+1}. ${st.adm} ${st.name}: ${(st.total? (st.P/st.total*100).toFixed(1):'0.0')}% / PKR ${st.outstanding}`).join('\n');
  }

  // --- Analytics PDF download/share ---
  $('downloadAnalytics').onclick=async()=>{
    if(!lastAnalyticsStats.length){alert('No analytics to download.');return;}
    const setupText=$('setupText').textContent, periodText=`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`;
    if(analyticsDownloadMode==='combined'){
      const doc=new jspdf.jsPDF(), w=doc.internal.pageSize.getWidth();
      doc.setFontSize(18).text('Attendance Analytics Report',14,16);
      doc.setFontSize(12).text(setupText,14,24).text(periodText,14,32);
      doc.autoTable({startY:40,html:'#analyticsTable'});
      const blob=doc.output('blob'); doc.save('analytics_report.pdf'); await sharePdf(blob,'analytics_report.pdf','Attendance Analytics Report');
    } else {
      const doc=new jspdf.jsPDF();
      lastAnalyticsStats.forEach((st,i)=>{ if(i>0) doc.addPage();
        doc.setFontSize(18).text('Individual Attendance Analytics',14,16);
        doc.setFontSize(12).text(setupText,14,24).text(periodText,14,32);
        doc.setFontSize(14).text(`Name: ${st.name}`,14,40).text(`Adm#: ${st.adm}`,14,60);
        doc.setFontSize(12).text(`Present: ${st.P}`,14,80).text(`Absent: ${st.A}`,14,100).text(`Late: ${st.Lt}`,14,120).text(`Half-Day: ${st.HD}`,14,140).text(`Leave: ${st.L}`,14,160).text(`Total: ${st.total}`,14,180);
        const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0'; doc.text(`% Present: ${pct}%`,14,200).text(`Outstanding: PKR ${st.outstanding}`,14,220).text(`Status: ${st.status}`,14,240);
      });
      const blob=doc.output('blob'); doc.save('individual_analytics_book.pdf'); await sharePdf(blob,'individual_analytics_book.pdf','Individual Attendance Analytics');
    }
  };
  $('shareAnalytics').onclick=()=>{ if(!lastAnalyticsShare){alert('No analytics to share');return;} window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`,'_blank'); };

  // --- Attendance Register (unchanged) ---
  (function(){
    const loadBtn=$('loadRegister'), saveBtn=$('saveRegister'), changeBtn=$('changeRegister'),
          downloadBtn=$('downloadRegister'), shareBtn=$('shareRegister'),
          tableWrapper=$('registerTableWrapper'), headerRow=$('registerHeader'), bodyTbody=$('registerBody');
    function bindRegisterActions(){
      downloadBtn.onclick=async()=>{
        const doc=new jspdf.jsPDF({orientation:'landscape',unit:'pt',format:'a4'}), w=doc.internal.pageSize.getWidth(), today=new Date().toISOString().split('T')[0];
        doc.setFontSize(18).text('Attendance Register',14,20);
        doc.setFontSize(10).text(`Date: ${today}`,w-14,20,{align:'right'});
        doc.setFontSize(12).text($('setupText').textContent,14,36);
        doc.autoTable({startY:60,html:'#registerTable',tableWidth:'auto',styles:{fontSize:10}});
        const blob=doc.output('blob'); doc.save('attendance_register.pdf'); await sharePdf(blob,'attendance_register.pdf','Attendance Register');
      };
      shareBtn.onclick=()=>{
        const header=`Attendance Register\n${$('setupText').textContent}`;
        const rows=Array.from(bodyTbody.children).map(tr=>Array.from(tr.children).map(td=>td.querySelector('.status-text')?.textContent||td.textContent).join(' '));
        window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+rows.join('\n'))}`,'_blank');
      };
    }
    loadBtn.onclick=()=>{
      const m=$('registerMonth').value; if(!m){alert('Pick month');return;}
      const dateKeys=Object.keys(attendanceData).filter(d=>d.startsWith(m+'-')).sort();
      if(!dateKeys.length){alert('No attendance marked this month.');return;}
      headerRow.innerHTML=`<th>#</th><th>Adm#</th><th>Name</th>`+dateKeys.map(k=>`<th>${k.split('-')[2]}</th>`).join('');
      bodyTbody.innerHTML='';
      const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
      students.filter(s=>s.cls===cl&&s.sec===sec).forEach((s,i)=>{
        let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
        dateKeys.forEach((key)=>{
          const c=attendanceData[key][s.adm]||'', color=c==='P'?'var(--success)':c==='Lt'?'var(--warning)':c==='HD'?'#FF9800':c==='L'?'var(--info)':'var(--danger)';
          row+=`<td class="reg-cell" style="background:${c?color:''};color:${c?'#fff':''}"><span class="status-text">${c}</span></td>`;
        });
        const tr=document.createElement('tr'); tr.innerHTML=row; bodyTbody.appendChild(tr);
      });
      document.querySelectorAll('.reg-cell').forEach(cell=>cell.onclick=()=>{
        const span=cell.querySelector('.status-text'), codes=['','P','Lt','HD','L','A'];
        const idx=(codes.indexOf(span.textContent)+1)%codes.length, c=codes[idx];
        span.textContent=c;
        if(!c){cell.style.background='';cell.style.color='';}
        else{const col=c==='P'?'var(--success)':c==='Lt'?'var(--warning)':c==='HD'?'#FF9800':c==='L'?'var(--info)':'var(--danger)';
          cell.style.background=col;cell.style.color='#fff';}
      });
      show(tableWrapper,saveBtn); hide(loadBtn,changeBtn,downloadBtn,shareBtn);
    };
    saveBtn.onclick=async()=>{
      const m=$('registerMonth').value;
      const dateKeys=Object.keys(attendanceData).filter(d=>d.startsWith(m+'-')).sort();
      Array.from(bodyTbody.children).forEach(tr=>{
        const adm=tr.children[1].textContent;
        dateKeys.forEach((key,idx)=>{
          const code=tr.children[3+idx].querySelector('.status-text').textContent;
          if(code){attendanceData[key]=attendanceData[key]||{};attendanceData[key][adm]=code;}
          else delete attendanceData[key][adm];
        });
      });
      await save('attendanceData',attendanceData);
      hide(saveBtn); show(changeBtn,downloadBtn,shareBtn); bindRegisterActions();
    };
    changeBtn.onclick=()=>{
      hide(tableWrapper,changeBtn,downloadBtn,shareBtn,saveBtn); headerRow.innerHTML=''; bodyTbody.innerHTML=''; show(loadBtn);
    };
    bindRegisterActions();
  })();

  // --- Service Worker ---
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(console.error);
});
