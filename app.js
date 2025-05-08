// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- Universal PDF share helper ---
  async function sharePdf(blob, fileName, title) {
    if (
      navigator.canShare &&
      navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })
    ) {
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

  let analyticsFilterOptions = ['all'];
  let analyticsDownloadMode  = 'combined';
  let lastAnalyticsStats     = [];
  let lastAnalyticsRange     = { from: null, to: null };

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- 1. DOWNLOAD & SHARE REGISTRATION ---
  $('downloadRegistrationPDF').onclick = async () => {
    const doc = new jspdf.jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split('T')[0];
    doc.setFontSize(18);
    doc.text('Registered Students', 14, 16);
    doc.setFontSize(10);
    doc.text(`Date: ${today}`, pageWidth - 14, 16, { align: 'right' });
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 30, html: '#studentsTable' });
    const total = students.length;
    const y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`Total Students: ${total}`, 14, y);
    const blob = doc.output('blob');
    doc.save('registration.pdf');
    await sharePdf(blob, 'registration.pdf', 'Registered Students');
  };
  $('shareRegistration').onclick = () => {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students
      .filter(s => s.cls===cl && s.sec===sec)
      .map(s => {
        const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
        Object.values(attendanceData).forEach(rec => rec[s.adm] && stats[rec.adm]++);
        const total = Object.values(stats).reduce((a,b)=>a+b,0);
        const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
        const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
        const out = totalFine - paid;
        const pct = total? (stats.P/total)*100 : 0;
        const status = (out>0||pct<eligibilityPct)?'Debarred':'Eligible';
        return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: PKR ${out}\nStatus: ${status}`;
      }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // --- 2. SETTINGS: Fines & Eligibility ---
  const formDiv      = $('financialForm'),
        saveSettings = $('saveSettings'),
        inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map(id => $(id)),
        settingsCard = document.createElement('div'),
        editSettings = document.createElement('button');
  settingsCard.id = 'settingsCard'; settingsCard.className = 'card hidden';
  editSettings.id = 'editSettings'; editSettings.className = 'btn no-print hidden'; editSettings.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard); formDiv.parentNode.appendChild(editSettings);
  $('fineAbsent').value = fineRates.A; $('fineLate').value = fineRates.Lt;
  $('fineLeave').value = fineRates.L; $('fineHalfDay').value = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;
  saveSettings.onclick = async () => {
    fineRates = { A:+$('fineAbsent').value, Lt:+$('fineLate').value, L:+$('fineLeave').value, HD:+$('fineHalfDay').value };
    eligibilityPct = +$('eligibilityPct').value;
    await Promise.all([ save('fineRates',fineRates), save('eligibilityPct',eligibilityPct) ]);
    settingsCard.innerHTML = `<div class="card-content">
      <p><strong>Fine–A:</strong> PKR ${fineRates.A}</p>
      <p><strong>Fine–Lt:</strong> PKR ${fineRates.Lt}</p>
      <p><strong>Fine–L:</strong> PKR ${fineRates.L}</p>
      <p><strong>Fine–HD:</strong> PKR ${fineRates.HD}</p>
      <p><strong>Elig %:</strong> ${eligibilityPct}%</p>
    </div>`;
    hide(formDiv, saveSettings, ...inputs); show(settingsCard, editSettings);
  };
  editSettings.onclick = () => { hide(settingsCard, editSettings); show(formDiv, saveSettings, ...inputs); };

  // --- 3. SETUP: School, Class & Section ---
  async function loadSetup() {
    const [sc,cl,sec] = await Promise.all([ get('schoolName'), get('teacherClass'), get('teacherSection') ]);
    if (sc&&cl&&sec) {
      $('schoolNameInput').value=sc; $('teacherClassSelect').value=cl; $('teacherSectionSelect').value=sec;
      $('setupText').textContent=`${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm')); show($('setupDisplay'));
      renderStudents(); updateCounters(); resetViews();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc=$('schoolNameInput').value.trim(), cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    if(!sc||!cl||!sec){ alert('Complete setup'); return; }
    await Promise.all([ save('schoolName',sc), save('teacherClass',cl), save('teacherSection',sec) ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- 4. COUNTERS & UTILS ---
  function animateCounters(){ document.querySelectorAll('.number').forEach(span=>{ const t=+span.dataset.target; let c=0,s=Math.max(1,t/100); (function u(){ c+=s; span.textContent=c<t?Math.ceil(c):t; if(c<t)requestAnimationFrame(u); })(); }); }
  function updateCounters(){ const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    $('sectionCount').dataset.target=students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target=students.filter(s=>s.cls===cl).length;
    $('schoolCount').dataset.target=students.length;
    animateCounters();
  }
  function resetViews(){ hide($('attendanceBody'),$('saveAttendance'),$('resetAttendance'),$('attendanceSummary'),$('downloadAttendancePDF'),$('shareAttendanceSummary'),$('instructions'),$('analyticsContainer'),$('graphs'),$('analyticsActions'),$('registerTableWrapper'),$('changeRegister'),$('saveRegister'),$('downloadRegister'),$('shareRegister')); show($('loadRegister')); }
  $('teacherClassSelect').onchange=()=>{ renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange=()=>{ renderStudents(); updateCounters(); resetViews(); };

  // --- 5. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents(){
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value, tbody=$('studentsBody');
    tbody.innerHTML=''; let idx=0;
    students.forEach((s,i)=>{ if(s.cls!==cl||s.sec!==sec) return; idx++;
      const stats={P:0,A:0,Lt:0,HD:0,L:0}; Object.values(attendanceData).forEach(r=>r[s.adm]&&stats[r[s.adm]]++);
      const tot=Object.values(stats).reduce((a,b)=>a+b,0), fine=stats.A*fineRates.A+stats.Lt*fineRates.Lt+stats.L*fineRates.L+stats.HD*fineRates.HD;
      const paid=(paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0), out=fine-paid, pct=tot?stats.P/tot*100:0;
      const status=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr=document.createElement('tr'); tr.dataset.index=i;
      tr.innerHTML=`<td><input type=checkbox class=sel></td><td>${idx}</td><td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td><td>PKR ${out}</td><td>${status}</td><td><button class=add-payment-btn data-adm=${s.adm}><i class="fas fa-coins"></i></button></td>`;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked=false; toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }
  function toggleButtons(){ const any=!!document.querySelector('.sel:checked'); $('editSelected').disabled=!any; $('deleteSelected').disabled=!any; }
  $('studentsBody').addEventListener('change',e=>e.target.classList.contains('sel')&&toggleButtons());
  $('selectAllStudents').onclick=()=>{ document.querySelectorAll('.sel').forEach(c=>c.checked=$('selectAllStudents').checked); toggleButtons(); };
  $('addStudent').onclick=async e=>{ e.preventDefault();
    const n=$('studentName').value.trim(), p=$('parentName').value.trim(), c=$('parentContact').value.trim(), o=$('parentOccupation').value.trim(), a=$('parentAddress').value.trim();
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a){alert('All fields required');return;} if(!/^\d{7,15}$/.test(c)){alert('Contact 7–15 digits');return;}
    const adm=await genAdmNo(); students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls:cl,sec});
    await save('students',students); renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };
  $('editSelected').onclick=()=>{ document.querySelectorAll('.sel:checked').forEach(cb=>{ const tr=cb.closest('tr'), i=+tr.dataset.index, s=students[i];
      tr.innerHTML=`<td><input type=checkbox class=sel checked></td><td>${tr.children[1].textContent}</td><td><input value="${s.name}"></td><td>${s.adm}</td><td><input value="${s.parent}"></td><td><input value="${s.contact}"></td><td><input value="${s.occupation}"></td><td><input value="${s.address}"></td><td colspan=3></td>`;
    }); hide($('editSelected')); show($('doneEditing')); };
  $('doneEditing').onclick=async()=>{ document.querySelectorAll('#studentsBody tr').forEach(tr=>{ const inps=[...tr.querySelectorAll('input:not(.sel)')]; if(inps.length===5){
        const [n,p,c,o,a]=inps.map(i=>i.value.trim()), adm=tr.children[3].textContent, idx=students.findIndex(x=>x.adm===adm);
        if(idx>-1) students[idx]={...students[idx],name:n,parent:p,contact:c,occupation:o,address:a};
      }}); await save('students',students); hide($('doneEditing')); show($('editSelected'),$('deleteSelected'),$('saveRegistration')); renderStudents(); updateCounters();
  };
  $('deleteSelected').onclick=async()=>{ if(!confirm('Delete?'))return; const toDel=[...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students=students.filter((_,i)=>!toDel.includes(i)); await save('students',students); renderStudents(); updateCounters(); resetViews();
  };
  $('saveRegistration').onclick=async()=>{ if(!$('doneEditing').classList.contains('hidden')){alert('Finish editing');return;} await save('students',students);
    hide(document.querySelector('#student-registration .row-inline'),$('editSelected'),$('deleteSelected'),$('selectAllStudents'),$('saveRegistration'));
    show($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF')); renderStudents(); updateCounters();
  };
  $('editRegistration').onclick=()=>{ show(document.querySelector('#student-registration .row-inline'),$('selectAllStudents'),$('editSelected'),$('deleteSelected'),$('saveRegistration'));
    hide($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF')); renderStudents(); updateCounters();
  };

  // --- 6. MARK ATTENDANCE ---
  const dateInput=$('dateInput'), loadAttendanceBtn=$('loadAttendance'), saveAttendanceBtn=$('saveAttendance'),
        resetAttendanceBtn=$('resetAttendance'), downloadAttendanceBtn=$('downloadAttendancePDF'),
        shareAttendanceBtn=$('shareAttendanceSummary'), attendanceBodyDiv=$('attendanceBody'),
        attendanceSummaryDiv=$('attendanceSummary'), statusNames={P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'};
  attendanceBodyDiv.classList.add('attendance-container');
  loadAttendanceBtn.onclick=()=>{ attendanceBodyDiv.innerHTML=''; attendanceSummaryDiv.innerHTML='';
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    students.filter(s=>s.cls===cl&&s.sec===sec).forEach((stu,i)=>{ const cont=document.createElement('div'); cont.className='attendance-student-container';
      const info=document.createElement('div'); info.className='attendance-info-row';
      const sr=document.createElement('span'); sr.className='sr-num'; sr.textContent=`#${i+1}`;
      const admEl=document.createElement('span'); admEl.className='adm-num'; admEl.textContent=`(${stu.adm})`;
      const nm=document.createElement('span'); nm.className='student-name'; nm.textContent=stu.name;
      info.append(sr,admEl,nm);
      const btns=document.createElement('div'); btns.className='attendance-buttons';
      Object.keys(statusNames).forEach(code=>{ const b=document.createElement('button'); b.className='att-btn'; b.textContent=code;
        b.onclick=()=>{ btns.querySelectorAll('.att-btn').forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); };
        btns.append(b);
      });
      cont.append(info,btns); attendanceBodyDiv.append(cont);
    });
    show(attendanceBodyDiv,saveAttendanceBtn); hide(resetAttendanceBtn,downloadAttendanceBtn,shareAttendanceBtn,attendanceSummaryDiv);
  };
  saveAttendanceBtn.onclick=async()=>{ const date=dateInput.value; if(!date){alert('Pick date');return;}
    attendanceData[date]={}; const cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    students.filter(s=>s.cls===cl&&s.sec===sec).forEach((s,i)=>{ const b=attendanceBodyDiv.children[i].querySelector('.att-btn.selected'); attendanceData[date][s.adm]=b?b.textContent:'A'; });
    await save('attendanceData',attendanceData);
    attendanceSummaryDiv.innerHTML=`<h3>Attendance Report: ${date}</h3>`; const tbl=document.createElement('table'); tbl.id='attendanceSummaryTable';
    tbl.innerHTML='<tr><th>SR#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th></tr>';
    students.filter(s=>s.cls===cl&&s.sec===sec).forEach((s,i)=>{ const c=attendanceData[date][s.adm];
      tbl.innerHTML+=`<tr><td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td><td>${statusNames[c]}</td><td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td></tr>`;
    });
    attendanceSummaryDiv.append(tbl);
    attendanceSummaryDiv.querySelectorAll('.share-individual').forEach(ic=>ic.onclick=()=>{ const a=ic.dataset.adm, st=students.find(x=>x.adm===a);
      window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(`Dear Parent, your child was ${statusNames[attendanceData[date][a]]} on ${date}.`)}`,'_blank');
    });
    hide(attendanceBodyDiv,saveAttendanceBtn); show(resetAttendanceBtn,downloadAttendanceBtn,shareAttendanceBtn,attendanceSummaryDiv);
  };
  resetAttendanceBtn.onclick=()=>{ show(attendanceBodyDiv,saveAttendanceBtn); hide(resetAttendanceBtn,downloadAttendanceBtn,shareAttendanceSummary,attendanceSummaryDiv); };
  downloadAttendanceBtn.onclick=async()=>{ const doc=new jspdf.jsPDF(); doc.setFontSize(18); doc.text('Attendance Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,30); doc.autoTable({startY:40,html:'#attendanceSummaryTable'});
    let P=0,A=0,Lt=0,HD=0,L=0; Object.values(attendanceData[$('dateInput').value]||{}).forEach(c=>{ if(c==='P')P++; if(c==='A')A++; if(c==='Lt')Lt++; if(c==='HD')HD++; if(c==='L')L++; });
    const y=doc.lastAutoTable.finalY+10; doc.setFontSize(12); doc.text(`Totals → P: ${P}, A: ${A}, Lt: ${Lt}, HD: ${HD}, L: ${L}`,14,y);
    const blob=doc.output('blob'); doc.save(`attendance_${$('dateInput').value}.pdf`); await sharePdf(blob,`attendance_${$('dateInput').value}.pdf`,'Attendance Report');
  };
  shareAttendanceBtn.onclick=()=>{ const cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value,date=dateInput.value;
    const header=`*Attendance Report*\nClass ${cl} Section ${sec} - ${date}`; const lines=students.filter(s=>s.cls===cl&&s.sec===sec).map(s=>`*${s.name}*: ${statusNames[attendanceData[date][s.adm]]}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines.join('\n'))}`,'_blank');
  };

  // --- 7. ANALYTICS ---
  const atg    = $('analyticsTarget'),
        asel   = $('analyticsSectionSelect'),
        atype  = $('analyticsType'),
        adate  = $('analyticsDate'),
        amonth = $('analyticsMonth'),
        sems   = $('semesterStart'),
        seme   = $('semesterEnd'),
        ayear  = $('yearStart'),
        asearch= $('analyticsSearch'),
        loadA  = $('loadAnalytics'),
        resetA = $('resetAnalytics'),
        instr  = $('instructions'),
        acont  = $('analyticsContainer'),
        graphs = $('graphs'),
        aacts  = $('analyticsActions'),
        barCtx = $('barChart').getContext('2d'),
        pieCtx = $('pieChart').getContext('2d');
  let barChart, pieChart;

  // download/share handlers need to be defined before use:
  async function downloadAnalyticsHandler() {
    if (!lastAnalyticsStats.length) { alert('Load a report first'); return; }
    const doc = new jspdf.jsPDF();
    const { from, to } = lastAnalyticsRange;
    doc.setFontSize(18); doc.text('Attendance Analytics',14,16);
    doc.setFontSize(10); doc.text(`Period: ${from} to ${to}`, doc.internal.pageSize.getWidth()-14,16,{align:'right'});
    doc.setFontSize(12); doc.text($('setupText').textContent,14,30);
    const filters = analyticsFilterOptions;
    const filtered = filters.includes('all') ? lastAnalyticsStats : lastAnalyticsStats.filter(st=>{
      if(filters.includes('attendance') && st.total===0) return false;
      if(filters.includes('fine') && (st.A+st.Lt+st.L+st.HD)===0) return false;
      if(filters.includes('cleared') && st.outstanding!==0) return false;
      if(filters.includes('debarred') && st.status!=='Debarred') return false;
      if(filters.includes('eligible') && st.status!=='Eligible') return false;
      return true;
    });
    doc.autoTable({
      startY:40,
      head:[['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']],
      body:filtered.map((st,i)=>[
        i+1, st.adm, st.name, st.P, st.A, st.Lt, st.HD, st.L, st.total,
        st.total? (st.P/st.total*100).toFixed(1)+'%' : '0.0%', 'PKR '+st.outstanding, st.status
      ])
    });
    const grand = filtered.reduce((g,st)=>{
      g.P+=st.P; g.A+=st.A; g.Lt+=st.Lt; g.HD+=st.HD; g.L+=st.L; return g;
    },{P:0,A:0,Lt:0,HD:0,L:0});
    const y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Totals → P: ${grand.P}, A: ${grand.A}, Lt: ${grand.Lt}, HD: ${grand.HD}, L: ${grand.L}`,14,y);
    const blob = doc.output('blob');
    doc.save('analytics.pdf');
    await sharePdf(blob,'analytics.pdf','Attendance Analytics');
  }
  function shareAnalyticsHandler() {
    if (!lastAnalyticsStats.length) { alert('Load a report first'); return; }
    const { from, to } = lastAnalyticsRange;
    const header = `Attendance Analytics (${from} to ${to})`;
    const lines = lastAnalyticsStats.map((st,i)=>`${i+1}. ${st.adm} ${st.name}: ${(st.total? (st.P/st.total*100).toFixed(1):'0.0')}% / PKR ${st.outstanding}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + lines.join('\n'))}`,'_blank');
  }

  // Open/close filter modal
  $('analyticsFilterBtn').addEventListener('click', () => show($('analyticsFilterModal')));
  $('analyticsFilterClose').addEventListener('click', () => hide($('analyticsFilterModal')));

  // Target change
  atg.addEventListener('change', () => {
    atype.disabled = false;
    hide(asel, asearch, instr, acont, graphs, aacts);
    if (atg.value==='section') asel.classList.remove('hidden');
    if (atg.value==='student') asearch.classList.remove('hidden');
  });

  // Type change
  atype.addEventListener('change', () => {
    hide(adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts);
    resetA.classList.remove('hidden');
    if(atype.value==='date') adate.classList.remove('hidden');
    else if(atype.value==='month') amonth.classList.remove('hidden');
    else if(atype.value==='semester'){ sems.classList.remove('hidden'); seme.classList.remove('hidden'); }
    else if(atype.value==='year') ayear.classList.remove('hidden');
  });

  // Load analytics
  loadA.addEventListener('click', () => {
    if(atype.value==='student'&&!asearch.value.trim()){ alert('Enter admission number or name'); return; }
    let from,to;
    if(atype.value==='date'){ from=to=adate.value; }
    else if(atype.value==='month'){ const[y,m]=amonth.value.split('-').map(Number); from=`${amonth.value}-01`; to=`${amonth.value}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`; }
    else if(atype.value==='semester'){ const[sy,sm]=sems.value.split('-').map(Number),[ey,em]=seme.value.split('-').map(Number); from=`${sems.value}-01`; to=`${seme.value}-${String(new Date(ey,em,0).getDate()).padStart(2,'0')}`; }
    else if(atype.value==='year'){ from=`${ayear.value}-01-01`; to=`${ayear.value}-12-31`; }
    else { alert('Select period'); return; }

    const cls=$('teacherClassSelect').value;
    let pool=students.filter(s=>s.cls===cls);
    if(atg.value==='section') pool=pool.filter(s=>s.sec===asel.value);
    if(atg.value==='student'){ const q=asearch.value.trim().toLowerCase(); pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q)); }

    const stats=pool.map(s=>({ adm:s.adm,name:s.name,P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    Object.entries(attendanceData).forEach(([d,rec])=>{
      if(d<from||d>to) return;
      stats.forEach(st=>{ if(rec[st.adm]){ st[rec[st.adm]]++; st.total++; } });
    });
    stats.forEach(st=>{ const tf=st.A*fineRates.A+st.Lt*fineRates.Lt+st.L*fineRates.L+st.HD*fineRates.HD, paid=(paymentsData[st.adm]||[]).reduce((a,p)=>a+p.amount,0);
      st.outstanding=tf-paid; const pct=st.total?st.P/st.total*100:0; st.status=(st.outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
    });

    lastAnalyticsStats=stats; lastAnalyticsRange={from,to};
    renderAnalytics(stats,from,to);
  });

  // Apply filter
  resetA.addEventListener('click', () => {
    analyticsFilterOptions=Array.from(document.querySelectorAll('#analyticsFilterForm input[type="checkbox"]:checked')).map(cb=>cb.value);
    if(!analyticsFilterOptions.length) analyticsFilterOptions=['all'];
    analyticsDownloadMode=document.querySelector('#analyticsFilterForm input[name="downloadMode"]:checked').value;
    hide($('analyticsFilterModal'));
    if(!lastAnalyticsStats.length) alert('Load a report first.');
    else renderAnalytics(lastAnalyticsStats,lastAnalyticsRange.from,lastAnalyticsRange.to);
  });

  // Bind download/share
  $('downloadAnalytics').addEventListener('click', downloadAnalyticsHandler);
  $('shareAnalytics').addEventListener('click', shareAnalyticsHandler);

  function renderAnalytics(stats,from,to){
    const filters=analyticsFilterOptions;
    const filtered=filters.includes('all')?stats:stats.filter(st=>filters.some(opt=>{
      switch(opt){
        case 'attendance': return st.total>0;
        case 'fine': return st.A>0||st.Lt>0||st.L>0||st.HD>0;
        case 'cleared': return st.outstanding===0;
        case 'debarred': return st.status==='Debarred';
        case 'eligible': return st.status==='Eligible';
        default: return true;
      }
    }));
    const thead=$('analyticsTable').querySelector('thead tr');
    thead.innerHTML=['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status'].map(h=>`<th>${h}</th>`).join('');
    const tbody=$('analyticsBody'); tbody.innerHTML='';
    filtered.forEach((st,i)=>{ const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0'; const tr=document.createElement('tr');
      tr.innerHTML=`<td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${pct}%</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>`;
      tbody.appendChild(tr);
    });
    $('instructions').textContent=`Period: ${from} to ${to}`;
    show($('instructions'),$('analyticsContainer'),$('graphs'),$('analyticsActions'));
    barChart&&barChart.destroy(); pieChart&&pieChart.destroy();
    barChart=new Chart(barCtx,{ type:'bar', data:{ labels:filtered.map(st=>st.name), datasets:[{ label:'% Present', data:filtered.map(st=>st.total?st.P/st.total*100:0) }] }, options:{ scales:{ y:{ beginAtZero:true, max:100 } } } });
    const totals=filtered.reduce((a,st)=>{ a.P+=st.P; a.A+=st.A; a.Lt+=st.Lt; a.HD+=st.HD; a.L+=st.L; return a; },{P:0,A:0,Lt:0,HD:0,L:0});
    pieChart=new Chart(pieCtx,{ type:'pie', data:{ labels:['Present','Absent','Late','Half‑Day','Leave'], datasets:[{ data:[totals.P,totals.A,totals.Lt,totals.HD,totals.L] }] } });
  }

  // --- 8. ATTENDANCE REGISTER ---
  (function(){
    const loadBtn     = $('loadRegister'),
          saveBtn     = $('saveRegister'),
          changeBtn   = $('changeRegister'),
          downloadBtn = $('downloadRegister'),
          shareBtn    = $('shareRegister'),
          headerRow   = $('registerHeader'),
          bodyTbody   = $('registerBody'),
          tableWrapper= $('registerTableWrapper');

    function bindRegisterActions(){
      downloadBtn.onclick = async () => {
        const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
        doc.setFontSize(18); doc.text('Attendance Register',14,20);
        doc.setFontSize(12); doc.text($('setupText').textContent,14,36);
        doc.autoTable({ startY:50, html:'#registerTable', tableWidth:'auto', styles:{ fontSize:10 } });
        const m=$('registerMonth').value;
        const keys=Object.keys(attendanceData).filter(d=>d.startsWith(m+'-'));
        const cls=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
        const secTotals={P:0,A:0,Lt:0,HD:0,L:0};
        keys.forEach(date=>students.filter(s=>s.cls===cls&&s.sec===sec).forEach(s=>{ const c=attendanceData[date][s.adm]; if(secTotals[c]!==undefined)secTotals[c]++; }));
        const y3=doc.lastAutoTable.finalY+10; doc.setFontSize(12);
        doc.text(`Section Totals → Present: ${secTotals.P}, Absent: ${secTotals.A}, Late: ${secTotals.Lt}, Half-Day: ${secTotals.HD}, Leave: ${secTotals.L}`,14,y3);
        const blob=doc.output('blob'); doc.save('attendance_register.pdf'); await sharePdf(blob,'attendance_register.pdf','Attendance Register');
      };
      shareBtn.onclick = () => {
        const header=`Attendance Register\n${$('setupText').textContent}`;
        const rows=Array.from(bodyTbody.children).map(tr=>Array.from(tr.children).map(td=>td.textContent.trim()).join(' '));
        window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+rows.join('\n'))}`,'_blank');
      };
    }

    loadBtn.onclick = () => {
      const m=$('registerMonth').value; if(!m){alert('Pick month');return;}
      const keys=Object.keys(attendanceData).filter(d=>d.startsWith(m+'-')).sort(); if(!keys.length){alert('No attendance marked this month.');return;}
      headerRow.innerHTML=`<th>#</th><th>Adm#</th><th>Name</th>`+keys.map(k=>`<th>${k.split('-')[2]}</th>`).join('');
      bodyTbody.innerHTML='';
      const cls=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
      students.filter(s=>s.cls===cls&&s.sec===sec).forEach((s,i)=>{
        let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
        keys.forEach(key=>{
          const c=attendanceData[key][s.adm]||'', color=c==='P'?'var(--success)':c==='Lt'?'var(--warning)':c==='HD'?'#FF9800':c==='L'?'var(--info)':'var(--danger)';
          const style=c?`background:${color};color:#fff`:'';
          row+=`<td class="reg-cell" style="${style}"><span class="status-text">${c}</span></td>`;
        });
        const tr=document.createElement('tr'); tr.innerHTML=row; bodyTbody.appendChild(tr);
      });
      document.querySelectorAll('.reg-cell').forEach(cell=>cell.onclick=()=>{
        const span=cell.querySelector('.status-text'), codes=['','P','Lt','HD','L','A'], idx=(codes.indexOf(span.textContent)+1)%codes.length, c=codes[idx];
        span.textContent=c; if(!c){cell.style.background='';cell.style.color='';} else { const col=c==='P'?'var(--success)':c==='Lt'?'var(--warning)':c==='HD'?'#FF9800':c==='L'?'var(--info)':'var(--danger)'; cell.style.background=col; cell.style.color='#fff'; }
      });
      show(tableWrapper, saveBtn); hide(loadBtn, changeBtn, downloadBtn, shareBtn);
    };

    saveBtn.onclick = async () => {
      const m=$('registerMonth').value;
      const keys=Object.keys(attendanceData).filter(d=>d.startsWith(m+'-')).sort();
      Array.from(bodyTbody.children).forEach(tr=>{
        const adm=tr.children[1].textContent;
        keys.forEach((key,idx)=>{
          const code=tr.children[3+idx].querySelector('.status-text').textContent;
          if(code){ attendanceData[key]=attendanceData[key]||{}; attendanceData[key][adm]=code; }
          else if(attendanceData[key]) delete attendanceData[key][adm];
        });
      });
      await save('attendanceData',attendanceData);
      hide(saveBtn); show(changeBtn, downloadBtn, shareBtn); bindRegisterActions();
    };

    changeBtn.onclick=()=>{
      hide(tableWrapper, changeBtn, downloadBtn, shareBtn, saveBtn); headerRow.innerHTML=''; bodyTbody.innerHTML=''; show(loadBtn);
    };

    bindRegisterActions();
  })();

  // --- 9. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
