// app.js
// Complete Attendance & Fine Management application script
// Sections: Setup, Financial Settings toggle, Global Fine Mode, Registration w/ Admission Date, Attendance, Analytics, Register, PDF/Share, PWA

window.addEventListener('DOMContentLoaded', async () => {
  // --- Service Worker (safe) ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // --- IndexedDB via idb-keyval ---
  const { get, set } = idbKeyval;
  const save = (k, v) => set(k, v);

  // --- Load persisted or defaults ---
  let calcMode       = await get('calcMode')       || 'manual';
  let fineRates      = await get('fineRates')      || { absent:50, late:20, leave:10, halfDay:30 };
  let eligibilityPct = await get('eligibilityPct')|| 75;
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData')|| {};
  let paymentsData   = await get('paymentsData')   || {};

  // --- DOM helpers ---
  const $ = id => document.getElementById(id);
  const show = el => el && el.classList.remove('hidden');
  const hide = el => el && el.classList.add('hidden');

  // --- SETUP ---
  function renderSetup(d) {
    $('setupText').textContent = `${d.school} | Class ${d.grade} - Section ${d.section}`;
    hide($('setupForm')); show($('setupDisplay'));
  }
  const savedSetup = await get('setup');
  if (savedSetup) renderSetup(savedSetup);
  $('saveSetup').onclick = async () => {
    const d = { school:$('schoolNameInput').value.trim(), grade:$('teacherClassSelect').value, section:$('teacherSectionSelect').value };
    if (!d.school||!d.grade||!d.section) return alert('Complete setup');
    await Promise.all([ save('setup',d), save('schoolName',d.school), save('teacherClass',d.grade), save('teacherSection',d.section) ]);
    renderSetup(d); renderStudents(); updateCounters(); resetViews();
  };
  $('editSetup').onclick = () => { show($('setupForm')); hide($('setupDisplay')); };

  // --- COUNTERS ---
  function updateCounters() {
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cl).length;
    $('schoolCount').dataset.target  = students.length;
    document.querySelectorAll('.number').forEach(span=>{
      const target=+span.dataset.target; let c=0,step=Math.max(1,target/100);
      (function inc(){ c+=step; span.textContent=c<target?Math.ceil(c):target; if(c<target) requestAnimationFrame(inc); })();
    });
  }
  $('teacherClassSelect').onchange = $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- FINANCIAL SETTINGS & Fine Mode toggle ---
  // Load values
  $('fineAbsent').value    = fineRates.absent;
  $('fineLate').value      = fineRates.late;
  $('fineLeave').value     = fineRates.leave;
  $('fineHalfDay').value   = fineRates.halfDay;
  $('eligibilityPct').value= eligibilityPct;
  $('modeManual').checked  = calcMode==='manual';
  $('modeSmart').checked   = calcMode==='smart';
  // Radios change
  [ $('modeManual'), $('modeSmart') ].forEach(r=>{
    r.onchange = async () => {
      calcMode = r.value; await save('calcMode',calcMode);
      students = students.map(s=>({ ...s, fineMode:calcMode })); await save('students',students);
      renderStudents();
    };
  });
  // Save settings
  $('saveSettings').onclick = async () => {
    fineRates = {
      absent:  +$('fineAbsent').value,
      late:    +$('fineLate').value,
      leave:   +$('fineLeave').value,
      halfDay: +$('fineHalfDay').value
    };
    eligibilityPct = +$('eligibilityPct').value;
    await Promise.all([ save('fineRates',fineRates), save('eligibilityPct',eligibilityPct) ]);
    alert('Financial settings saved');
  };

  // --- STUDENT REGISTRATION & RENDERING ---
  $('addStudent').onclick = async () => {
    const n=$('studentName').value.trim(), p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(), o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim(), admDate=$('admissionDate').value,
          cls=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a||!admDate) return alert('All fields required');
    const adm=Date.now().toString().slice(-4);
    students.push({ name:n,adm,parent:p,contact:c,occupation:o,address:a,cls,sec,admissionDate:admDate,fineMode:calcMode });
    await save('students',students); renderStudents(); updateCounters(); resetViews();
  };
  function renderStudents(){
    const tbody=$('studentsBody'); tbody.innerHTML='';
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    let idx=0;
    students.forEach(s=>{
      if(s.cls!==cl||s.sec!==sec) return;
      idx++;
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.entries(attendanceData).forEach(([d,recs])=>{
        if(d < s.admissionDate) return;
        const code=recs[s.adm]||'A'; stats[code]++;
      });
      let fine=0;
      if(calcMode==='manual') fine=stats.A*fineRates.absent;
      else fine=stats.A*fineRates.absent+stats.Lt*fineRates.late+stats.L*fineRates.leave+stats.HD*fineRates.halfDay;
      const paid=(paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0), out=fine-paid;
      const total=stats.P+stats.A+stats.Lt+stats.L+stats.HD, pct=total? (stats.P/total)*100:0;
      const status=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr=document.createElement('tr'); tr.dataset.adm=s.adm;
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td><td>${idx}</td><td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>
        <td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>${calcMode}</td><td>${s.admissionDate}</td>
        <td>PKR ${out}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>`;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked=false;
  }
  renderStudents();

  // --- PAYMENT MODAL ---
  $('studentsBody').addEventListener('click',e=>{
    const btn=e.target.closest('.add-payment-btn'); if(!btn) return;
    $('payAdm').textContent=btn.dataset.adm; $('paymentAmount').value=''; show($('paymentModal'));
  });
  $('savePayment').onclick=async()=>{
    const adm=$('payAdm').textContent, amt=+$('paymentAmount').value||0;
    paymentsData[adm]=paymentsData[adm]||[]; paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
    await save('paymentsData',paymentsData); hide($('paymentModal')); renderStudents();
  };
  $('cancelPayment').onclick = $('paymentModalClose').onclick = ()=>hide($('paymentModal'));

  // --- ATTENDANCE MARKING ---
  $('loadAttendance').onclick=()=>{
    const date=$('dateInput').value; if(!date) return alert('Pick a date');
    const body=$('attendanceBody'); body.innerHTML='';
    const roster=students.filter(s=>s.cls==$('teacherClassSelect').value&&s.sec==$('teacherSectionSelect').value);
    roster.forEach((s,i)=>{
      const row=document.createElement('div'); row.className='attendance-row';
      const nameDiv=document.createElement('div'); nameDiv.className='attendance-name'; nameDiv.textContent=s.name;
      const btns=document.createElement('div'); btns.className='attendance-buttons';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button'); b.textContent=code; b.className='att-btn';
        b.onclick=()=>{ btns.querySelectorAll('button').forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); };
        btns.appendChild(b);
      });
      row.append(nameDiv,btns); body.appendChild(row);
    });
    show($('attendanceBody'),$('saveAttendance')); hide($('attendanceSummary'),$('resetAttendance'),$('downloadAttendancePDF'),$('shareAttendanceSummary'));
  };
  $('saveAttendance').onclick=async()=>{
    const date=$('dateInput').value; attendanceData[date]={};
    const roster=students.filter(s=>s.cls==$('teacherClassSelect').value&&s.sec==$('teacherSectionSelect').value);
    roster.forEach((s,i)=>{
      const code=document.querySelectorAll('.attendance-row')[i].querySelector('.selected')?.textContent||'A';
      attendanceData[date][s.adm]=code;
    });
    await save('attendanceData',attendanceData); alert('Attendance saved');
  };

  // --- ANALYTICS & FILTER MODAL ---
  $('analyticsTarget').innerHTML=`
    <option disabled selected>-- Report For --</option>
    <option value="class">Class</option><option value="section">Section</option><option value="student">Student</option>`;
  $('analyticsFilterBtn').onclick=()=>show($('analyticsFilterModal'));
  $('analyticsFilterClose').onclick=()=>hide($('analyticsFilterModal'));
  $('applyAnalyticsFilter').onclick=()=>hide($('analyticsFilterModal'));
  $('analyticsTarget').onchange=()=>show($('analyticsType'));
  $('analyticsType').onchange=()=>{ ['analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart'].forEach(id=>hide($(id))); show($( {'date':'analyticsDate','month':'analyticsMonth','semester':'semesterStart','year':'yearStart'}[ $('analyticsType').value ] )); };

  let lastStats=[], lastRange={}, lastShare='';
  $('loadAnalytics').onclick=()=>{
    let from,to, t=$('analyticsType').value;
    if(t==='date'){ from=to=$('analyticsDate').value; }
    else if(t==='month'){ const ym=$('analyticsMonth').value.split('-'); from=`${ym[0]}-${ym[1]}-01`; to=`${ym[0]}-${ym[1]}-${String(new Date(ym[0],ym[1],0).getDate()).padStart(2,'0')}`; }
    else if(t==='semester'){ from=$('semesterStart').value+'-01'; const e=$('semesterEnd').value.split('-'); to=`${e[0]}-${e[1]}-${String(new Date(e[0],e[1],0).getDate()).padStart(2,'0')}`; }
    else if(t==='year'){ const y=$('yearStart').value; from=`${y}-01-01`; to=`${y}-12-31`; }
    else return alert('Select period');
    let pool=students.filter(s=>s.cls==$('teacherClassSelect').value);
    if($('analyticsTarget').value==='section') pool=pool.filter(s=>s.sec==$('analyticsSectionSelect').value);
    if($('analyticsTarget').value==='student'){ const q=$('analyticsSearch').value.trim().toLowerCase(); pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q)); if(!pool.length) return alert('No student'); }
    const stats=pool.map(s=>({ adm:s.adm,name:s.name,admissionDate:s.admissionDate,fineMode:calcMode,P:0,A:0,Lt:0,HD:0,L:0,total:0,outstanding:0,status:'' }));
    Object.entries(attendanceData).forEach(([d,recs])=> stats.forEach(st=>{ if(d<st.admissionDate||d<from||d>to) return; const c=recs[st.adm]||'A'; st[c]++; st.total++; }));
    stats.forEach(st=>{ const tf=st.A*fineRates.absent+st.Lt*fineRates.late+st.L*fineRates.leave+st.HD*fineRates.halfDay; const paid=(paymentsData[st.adm]||[]).reduce((s,p)=>s+p.amount,0); st.outstanding=tf-paid; const pct=st.total? (st.P/st.total)*100:0; st.status=(st.outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible'; });
    lastStats=stats; lastRange={from,to};
    const thead=document.querySelector('#analyticsTable thead tr'); thead.innerHTML=['#','Adm#','Name','Adm Date','Fine Mode','P','A','Lt','HD','L','Total','%','Outstanding','Status'].map(h=>`<th>${h}</th>`).join('');
    const tbody=$('analyticsBody'); tbody.innerHTML='';
    stats.forEach((st,i)=>{ const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0'; const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td><td>${st.admissionDate}</td><td>${st.fineMode}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${pct}%</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>`; tbody.appendChild(tr); });
    $('instructions').textContent=`Period: ${lastRange.from} to ${lastRange.to}`; show($('instructions'),$('analyticsContainer'),$('graphs'),$('analyticsActions'));
    const barCtx=$('barChart').getContext('2d'), pieCtx=$('pieChart').getContext('2d');
    window.barChart?.destroy(); window.pieChart?.destroy();
    window.barChart=new Chart(barCtx,{type:'bar',data:{labels:stats.map((_,i)=>i+1),datasets:[{label:'% Present',data:stats.map(st=>((st.P/st.total)*100).toFixed(1))}]},options:{scales:{y:{beginAtZero:true,max:100}}}});
    window.pieChart=new Chart(pieCtx,{type:'pie',data:{labels:['Outstanding'],datasets:[{data:[stats.reduce((s,st)=>s+st.outstanding,0)]}]}});    
    lastShare=`Analytics ${lastRange.from} to ${lastRange.to}\n`+stats.map(st=>`${st.name}: ${(st.P/st.total*100).toFixed(1)}% | PKR ${st.outstanding}`).join('\n');
  };
  $('downloadAnalytics').onclick=()=>{
    const doc=new jspdf.jsPDF(); doc.setFontSize(16); doc.text('Analytics Report',14,16); doc.setFontSize(12); doc.text(`Period: ${lastRange.from} to ${lastRange.to}`,14,24);
    const head=[['#','Adm#','Name','Adm Date','Fine Mode','P','A','Lt','HD','L','Total','%','Outstanding','Status']];
    const body=lastStats.map((st,i)=>[i+1,st.adm,st.name,st.admissionDate,st.fineMode,st.P,st.A,st.Lt,st.HD,st.L,st.total,`${((st.P/st.total)*100).toFixed(1)}%`,`PKR ${st.outstanding}`,st.status]);
    doc.autoTable({startY:32,head,body,styles:{fontSize:10}}); doc.save('analytics.pdf');
  };
  $('shareAnalytics').onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(lastShare)}`,'_blank');

  // --- ATTENDANCE REGISTER ---
  $('loadRegister').onclick=()=>{
    const m=$('registerMonth').value; if(!m) return alert('Select month');
    const [y,mm]=m.split('-').map(Number), days=new Date(y,mm,0).getDate();
    const rh=$('registerHeader'), rb=$('registerBody');
    rh.innerHTML='<th>#</th><th>Adm#</th><th>Name</th>' + Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    rb.innerHTML='';
    const roster=students.filter(s=>s.cls==$('teacherClassSelect').value&&s.sec==$('teacherSectionSelect').value);
    roster.forEach((s,i)=>{ let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`; for(let d=1;d<=days;d++){ const key=`${m}-${String(d).padStart(2,'0')}`, code=(attendanceData[key]||{})[s.adm]||'A'; const style=code==='A'?'':`style="background:red;color:#fff"`; row+=`<td class="reg-cell" ${style}><span class="status-text">${code}</span></td>`; } const tr=document.createElement('tr'); tr.innerHTML=row; rb.appendChild(tr); });
    document.querySelectorAll('.reg-cell').forEach(cell=>cell.onclick=()=>{ const span=cell.querySelector('.status-text'), codes=['P','A','Lt','HD','L']; let i=codes.indexOf(span.textContent); i=(i+1)%codes.length; span.textContent=codes[i]; if(codes[i]==='A'){cell.style.background='';cell.style.color='';}else{cell.style.background='red';cell.style.color='#fff';} });
    hide($('loadRegister'),$('changeRegister'),$('downloadRegister'),$('shareRegister')); show($('saveRegister'));
  };
  $('saveRegister').onclick=async()=>{
    const m=$('registerMonth').value; const [y,mm]=m.split('-').map(Number), days=new Date(y,mm,0).getDate();
    $('registerBody').querySelectorAll('tr').forEach(tr=>{ const adm=tr.children[1].textContent; for(let d=1;d<=days;d++){ const code=tr.children[3+d-1].querySelector('.status-text').textContent; const key=`${m}-${String(d).padStart(2,'0')}`; attendanceData[key]=attendanceData[key]||{}; attendanceData[key][adm]=code; }}); await save('attendanceData',attendanceData);
    hide($('saveRegister')); show($('changeRegister'),$('downloadRegister'),$('shareRegister'));
  };
  $('changeRegister').onclick=()=>{ hide($('changeRegister'),$('downloadRegister'),$('shareRegister'),$('registerTableWrapper'),$('saveRegister')); show($('loadRegister')); };
  $('downloadRegister').onclick=()=>{
    const doc=new jspdf.jsPDF(); doc.setFontSize(18); doc.text('Attendance Register',14,16);
    const head=[Array.from($('registerHeader').children).map(th=>th.textContent)];
    const body=Array.from($('registerBody').children).map(tr=>Array.from(tr.children).map(td=>td.textContent));
    doc.autoTable({startY:32,head,body,styles:{fontSize:8}}); doc.save(`register_${$('registerMonth').value}.pdf`);
  };
  $('shareRegister').onclick=()=>{
    const m=$('registerMonth').value, header=`Register ${m}`, lines=Array.from($('registerBody').children).map(tr=>`*${tr.children[2].textContent}*: `+Array.from(tr.children).slice(3).map(td=>td.textContent).join(''));
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines.join('\n'))}`,'_blank');
  };

  // --- Initialize view ---
  resetViews();
  function resetViews(){
    ['attendanceBody','saveAttendance','resetAttendance','downloadAttendancePDF','shareAttendanceSummary',
     'instructions','analyticsContainer','graphs','analyticsActions',
     'registerTableWrapper','saveRegister','changeRegister','downloadRegister','shareRegister']
     .forEach(id=>hide($(id)));
  }
});
