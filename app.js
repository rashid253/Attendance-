// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // Eruda debug console
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // idb-keyval
  if (!window.idbKeyval) { console.error('idbKeyval not found'); return; }
  const { get, set } = window.idbKeyval;

  // State
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;
  let lastShareText      = '';
  let lastAnalyticsShare = '';

  // Helpers
  const saveStudents       = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);
  const saveLastAdmNo      = () => set('lastAdmissionNo', lastAdmNo);
  async function generateAdmNo() { lastAdmNo++; await saveLastAdmNo(); return String(lastAdmNo).padStart(4,'0'); }
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(el=>el&&el.classList.remove('hidden'));
  const hide = (...els) => els.forEach(el=>el.classList.add('hidden'));

  // 1. SETUP
  async function loadSetup() {
    const [school, cls, sec] = await Promise.all([
      get('schoolName'), get('teacherClass'), get('teacherSection')
    ]);
    if (school && cls && sec) {
      $('schoolNameInput').value = school;
      $('teacherClassSelect').value = cls;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
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
      set('schoolName', school),
      set('teacherClass', cls),
      set('teacherSection', sec),
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // 2. COUNTERS
  function animateCounters(){
    document.querySelectorAll('.number').forEach(span=>{
      const target = +span.dataset.target; let count = 0, step = Math.max(1, target/100);
      (function update(){
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
      })();
    });
  }
  function updateCounters(){
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cls&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cls).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  $('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

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

  // 3. STUDENT REGISTRATION
  function renderStudents(){
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value, tbody = $('studentsBody');
    tbody.innerHTML = ''; let disp = 0;
    students.forEach((stu,i)=>{
      if (stu.cls!==cls||stu.sec!==sec) return;
      disp++;
      const tr = document.createElement('tr'); tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${disp}</td><td>${stu.name}</td><td>${stu.adm}</td>
        <td>${stu.parent}</td><td>${stu.contact}</td><td>${stu.occupation}</td><td>${stu.address}</td>
        <td>${$('shareRegistration').classList.contains('hidden')?'':`<i class="fas fa-share-alt share-row" data-index="${i}"></i>`}</td>`;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false; toggleButtons();
    document.querySelectorAll('.share-row').forEach(ic=>ic.onclick = ()=>{
      const s = students[+ic.dataset.index];
      const msg = `*${s.name}*\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    });
  }
  function toggleButtons(){
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any; $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e=>{ if(e.target.classList.contains('sel')) toggleButtons(); });
  $('selectAllStudents').onclick = ()=>{ document.querySelectorAll('.sel').forEach(cb=>cb.checked=$('selectAllStudents').checked); toggleButtons(); };

  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n=$('studentName').value.trim(), p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(), o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim(), cls=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a){ alert('All fields required'); return; }
    if(!/^\d{7,15}$/.test(c)){ alert('Contact must be 7–15 digits'); return; }
    const adm = await generateAdmNo();
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls, sec });
    await saveStudents(); renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };

  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach(cb=>{
      const tr=cb.closest('tr'), i=+tr.dataset.index, s=students[i];
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" checked></td>
        <td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"></td>
        <td>${s.adm}</td>
        <td><input value="${s.parent}"></td>
        <td><input value="${s.contact}"></td>
        <td><input value="${s.occupation}"></td>
        <td><input value="${s.address}"></td>
        <td></td>`;
    });
    hide($('editSelected')); show($('doneEditing'));
  };
  $('doneEditing').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach(tr=>{
      const inp=tr.querySelectorAll('input:not(.sel)');
      if(inp.length===5){
        const [n,p,c,o,a] = Array.from(inp).map(i=>i.value.trim()),
              adm = tr.children[3].textContent,
              idx = students.findIndex(s=>s.adm===adm);
        if(idx>-1) students[idx] = {...students[idx], name:n, parent:p, contact:c, occupation:o, address:a};
      }
    });
    await saveStudents();
    hide($('doneEditing')); show($('editSelected'),$('deleteSelected'),$('saveRegistration'));
    renderStudents(); updateCounters();
  };

  $('deleteSelected').onclick = async () => {
    if(!confirm('Delete selected?')) return;
    const toDel = Array.from(document.querySelectorAll('.sel:checked')).map(cb=>+cb.closest('tr').dataset.index);
    students = students.filter((_,i)=>!toDel.includes(i));
    await saveStudents(); renderStudents(); updateCounters(); resetViews();
  };

  $('saveRegistration').onclick = async () => {
    if (!$('doneEditing').classList.contains('hidden')) {
      alert('Please finish editing first (click Done) before saving.'); return;
    }
    await saveStudents();
    hide($('editSelected'),$('deleteSelected'),$('selectAllStudents'),$('saveRegistration'));
    show($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF'));
    renderStudents();
  };
  $('editRegistration').onclick = () => {
    hide($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF'));
    show($('selectAllStudents'),$('editSelected'),$('deleteSelected'),$('saveRegistration'));
    renderStudents();
  };
  $('shareRegistration').onclick = () => {
    const cls=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const header=`*Students List*\nClass ${cls} Section ${sec}`;
    const lines=students.filter(s=>s.cls===cls&&s.sec===sec)
                       .map(s=>`*${s.name}*\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`)
                       .join('\n\n');
    lastShareText=header+'\n\n'+lines;
    window.open(`https://wa.me/?text=${encodeURIComponent(lastShareText)}`,'_blank');
  };
  $('downloadRegistrationPDF').onclick = () => {
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#studentsTable' });
    const pc=doc.getNumberOfPages();
    for(let i=1;i<=pc;i++){ doc.setPage(i); doc.setFontSize(10); doc.text('FAIQTECH SOL', doc.internal.pageSize.getWidth()/2, doc.internal.pageSize.getHeight()-10, {align:'center'}); }
    const url=doc.output('bloburl'); window.open(url,'_blank'); doc.save('registration.pdf');
  };

  // 4. MARK ATTENDANCE
  const dateInput=$('dateInput'), loadAttendance=$('loadAttendance'), saveAttendance=$('saveAttendance'),
        resetAttendance=$('resetAttendance'), downloadAttendancePDF=$('downloadAttendancePDF'),
        shareAttendanceSummary=$('shareAttendanceSummary'),
        attendanceBody=$('attendanceBody'), attendanceSummary=$('attendanceSummary');
  const statusNames={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'},
        statusColors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};

  loadAttendance.onclick = () => {
    attendanceBody.innerHTML=''; attendanceSummary.innerHTML='';
    const cls=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const roster=students.filter(s=>s.cls===cls&&s.sec===sec);
    roster.forEach(stu=>{
      const row=document.createElement('div'); row.className='attendance-row';
      const nd=document.createElement('div'); nd.className='attendance-name'; nd.textContent=stu.name;
      const btns=document.createElement('div'); btns.className='attendance-buttons';
      Object.keys(statusNames).forEach(code=>{
        const btn=document.createElement('button'); btn.className='att-btn'; btn.textContent=code;
        btn.onclick=()=>{
          btns.querySelectorAll('.att-btn').forEach(b=>{b.classList.remove('selected');b.style.background='';b.style.color='';});
          btn.classList.add('selected'); btn.style.background=statusColors[code]; btn.style.color='#fff';
        };
        btns.appendChild(btn);
      });
      row.append(nd,btns); attendanceBody.append(row);
    });
    show(attendanceBody, saveAttendance); hide(resetAttendance, downloadAttendancePDF, shareAttendanceSummary, attendanceSummary);
  };

  saveAttendance.onclick = async () => {
    const date=dateInput.value; if(!date){alert('Pick a date');return;}
    attendanceData[date]={};
    const cls=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const roster=students.filter(s=>s.cls===cls&&s.sec===sec);
    roster.forEach((s,i)=>{
      const btn=attendanceBody.children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm]=btn?btn.textContent:'A';
    });
    await saveAttendanceData();
    attendanceSummary.innerHTML=`<h3>Attendance Report: ${date}</h3>`;
    const tbl=document.createElement('table');
    tbl.innerHTML='<tr><th>Name</th><th>Status</th></tr>';
    roster.forEach(s=>tbl.innerHTML+=`<tr><td>${s.name}</td><td>${statusNames[attendanceData[date][s.adm]]}</td></tr>`);
    attendanceSummary.append(tbl);
    hide(saveAttendance, attendanceBody); show(resetAttendance, downloadAttendancePDF, shareAttendanceSummary, attendanceSummary);
  };
  resetAttendance.onclick=()=>{ show(attendanceBody, saveAttendance); hide(resetAttendance, downloadAttendancePDF, shareAttendanceSummary, attendanceSummary); };
  downloadAttendancePDF.onclick=()=>{
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#attendanceSummary table' });
    const pc=doc.getNumberOfPages();
    for(let i=1;i<=pc;i++){ doc.setPage(i); doc.setFontSize(10); doc.text('FAIQTECH SOL', doc.internal.pageSize.getWidth()/2, doc.internal.pageSize.getHeight()-10, {align:'center'}); }
    const url=doc.output('bloburl'); window.open(url,'_blank'); doc.save('attendance_summary.pdf');
  };
  shareAttendanceSummary.onclick=()=>{ window.open(`https://wa.me/?text=${encodeURIComponent(lastShareText)}`,'_blank'); };

  // 5. ANALYTICS
  const analyticsTarget=$('analyticsTarget'), analyticsSectionSel=$('analyticsSectionSelect'),
        analyticsType=$('analyticsType'), analyticsDate=$('analyticsDate'),
        analyticsMonth=$('analyticsMonth'), semesterStart=$('semesterStart'),
        semesterEnd=$('semesterEnd'), yearStart=$('yearStart'),
        analyticsSearch=$('analyticsSearch'), loadAnalyticsBtn=$('loadAnalytics'),
        resetAnalyticsBtn=$('resetAnalytics'), instructionsEl=$('instructions'),
        analyticsContainer=$('analyticsContainer'), graphsEl=$('graphs'),
        analyticsActions=$('analyticsActions'),
        barCtx=$('barChart').getContext('2d'), pieCtx=$('pieChart').getContext('2d');
  let barChart, pieChart;

  analyticsTarget.onchange=()=>{ analyticsType.disabled=false; hide(analyticsSectionSel,analyticsSearch,instructionsEl,analyticsContainer,graphsEl,analyticsActions); if(analyticsTarget.value==='section')show(analyticsSectionSel); if(analyticsTarget.value==='student')show(analyticsSearch); };
  analyticsType.onchange=()=>{ hide(analyticsDate,analyticsMonth,semesterStart,semesterEnd,yearStart,instructionsEl,analyticsContainer,graphsEl,analyticsActions); if(analyticsType.value==='date')show(analyticsDate); if(analyticsType.value==='month')show(analyticsMonth); if(analyticsType.value==='semester')show(semesterStart,semesterEnd); if(analyticsType.value==='year')show(yearStart); show(resetAnalyticsBtn); };
  resetAnalyticsBtn.onclick=e=>{e.preventDefault();analyticsType.value=''; hide(analyticsDate,analyticsMonth,semesterStart,semesterEnd,yearStart,instructionsEl,analyticsContainer,graphsEl,analyticsActions,resetAnalyticsBtn); };

  loadAnalyticsBtn.onclick=()=>{
    if(analyticsTarget.value==='student'&&!analyticsSearch.value.trim()){alert('Enter Adm# or Name');return;}
    let from,to,typ=analyticsType.value;
    if(typ==='date')from=to=analyticsDate.value;
    else if(typ==='month'){const[y,m]=analyticsMonth.value.split('-').map(Number);from=`${analyticsMonth.value}-01`;to=`${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;}
    else if(typ==='semester'){const[sy,sm]=semesterStart.value.split('-').map(Number),[ey,em]=semesterEnd.value.split('-').map(Number);from=`${semesterStart.value}-01`;to=`${semesterEnd.value}-${new Date(ey,em,0).getDate()}`;}
    else if(typ==='year'){from=`${yearStart.value}-01-01`;to=`${yearStart.value}-12-31`;}
    else{alert('Select period');return;}
    const cls=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    let pool=students.filter(s=>s.cls===cls&&s.sec===sec);
    if(analyticsTarget.value==='section')pool=pool.filter(s=>s.sec===analyticsSectionSel.value);
    if(analyticsTarget.value==='student'){const q=analyticsSearch.value.trim().toLowerCase();pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));}

    const stats=pool.map(s=>({adm:s.adm,name:s.name,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs])=>{if(d<from||d>to)return;stats.forEach(st=>{const c=recs[st.adm]||'A';st[c]++;st.total++;});});

    const head=$('analyticsTable').querySelector('thead tr'); head.innerHTML='<th>#</th><th>Adm#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th>';
    const body=$('analyticsBody'); body.innerHTML=''; stats.forEach((st,i)=>{const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0';const tr=document.createElement('tr');tr.innerHTML=`<td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${pct}%</td>`;body.appendChild(tr);});

    instructionsEl.textContent=`Period: ${from} to ${to}`; show(instructionsEl,analyticsContainer,graphsEl,analyticsActions);

    barChart?.destroy(); barChart=new Chart(barCtx,{type:'bar',data:{labels:stats.map(s=>s.name),datasets:[{label:'% Present',data:stats.map(s=>s.total?s.P/s.total*100:0)}]},options:{scales:{y:{beginAtZero:true,max:100}}}});
    const agg=stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(k=>a[k]+=s[k]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    pieChart?.destroy(); pieChart=new Chart(pieCtx,{type:'pie',data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg)}]}});

    lastAnalyticsShare=`Analytics (${from} to ${to})\n`+stats.map((st,i)=>`${i+1}. ${st.adm} ${st.name}: ${((st.P||0)/(st.total||1)*100).toFixed(1)}%`).join('\n');
  };
  $('shareAnalytics').onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`,'_blank');
  $('downloadAnalytics').onclick=()=>{
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#analyticsTable' });
    const barImg=barCtx.canvas.toDataURL(), pieImg=pieCtx.canvas.toDataURL();
    doc.addPage(); doc.setFontSize(20); doc.text('Bar Chart',14,20); doc.addImage(barImg,'PNG',14,28,180,100);
    doc.addPage(); doc.setFontSize(20); doc.text('Pie Chart',14,20); doc.addImage(pieImg,'PNG',14,28,100,100);
    const pc=doc.getNumberOfPages(); for(let i=1;i<=pc;i++){ doc.setPage(i); doc.setFontSize(10); doc.text('FAIQTECH SOL',doc.internal.pageSize.getWidth()/2,doc.internal.pageSize.getHeight()-10,{align:'center'}); }
    const url=doc.output('bloburl'); window.open(url,'_blank'); doc.save('analytics_report.pdf');
  };

  // 6. ATTENDANCE REGISTER
  const loadRegisterBtn=$('loadRegister'),changeRegisterBtn=$('changeRegister'),saveRegisterBtn=$('saveRegister'),
        downloadRegister=$('downloadRegister'),shareRegister=$('shareRegister'),
        monthInput=$('registerMonth'),registerHeader=$('registerHeader'),
        registerBody=$('registerBody'),registerWrapper=$('registerTableWrapper');
  const regCodes=['A','P','Lt','HD','L'], regColors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};
  hide(changeRegisterBtn,saveRegisterBtn,downloadRegister,shareRegister);

  loadRegisterBtn.onclick=()=>{
    const m=monthInput.value; if(!m){alert('Pick month');return;}
    const[y,mm]=m.split('-').map(Number),days=new Date(y,mm,0).getDate();
    registerHeader.innerHTML='<th>#</th><th>Adm#</th><th>Name</th>'+Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    registerBody.innerHTML=''; const cls=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    const roster=students.filter(s=>s.cls===cls&&s.sec===sec);
    roster.forEach((s,i)=>{let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;for(let d=1;d<=days;d++){const key=`${m}-${String(d).padStart(2,'0')}`,code=(attendanceData[key]&&attendanceData[key][s.adm])||'A',style=code==='A'?'':` style="background:${regColors[code]};color:#fff"`;row+=`<td class="reg-cell"${style}><span class="status-text">${code}</span></td>`;}const tr=document.createElement('tr');tr.innerHTML=row;registerBody.appendChild(tr);});
    registerBody.querySelectorAll('.reg-cell').forEach(cell=>{const span=cell.querySelector('.status-text');cell.onclick=()=>{let idx=regCodes.indexOf(span.textContent);idx=(idx+1)%regCodes.length;const code=regCodes[idx];span.textContent=code;if(code==='A'){cell.style.background='';cell.style.color='';}else{cell.style.background=regColors[code];cell.style.color='#fff';}};});
    show(registerWrapper,saveRegisterBtn);hide(loadRegisterBtn,changeRegisterBtn,downloadRegister,shareRegister);
  };

  saveRegisterBtn.onclick=async()=>{
    const m=monthInput.value,[y,mm]=m.split('-').map(Number),days=new Date(y,mm,0).getDate();
    Array.from(registerBody.children).forEach(tr=>{const adm=tr.children[1].textContent;for(let d=0;d<days;d++){const code=tr.children[3+d].querySelector('.status-text').textContent,key=`${m}-${String(d+1).padStart(2,'0')}`;attendanceData[key]=attendanceData[key]||{};attendanceData[key][adm]=code;}});await saveAttendanceData();
    hide(saveRegisterBtn);show(changeRegisterBtn,downloadRegister,shareRegister);
  };

  changeRegisterBtn.onclick=()=>{hide(changeRegisterBtn,downloadRegister,shareRegister);show(saveRegisterBtn);};
  downloadRegister.onclick=()=>{const doc=new jspdf.jsPDF();doc.setFontSize(18);doc.text('Attendance Report',14,16);doc.setFontSize(12);doc.text($('setupText').textContent,14,24);doc.autoTable({ startY:32, html:'#registerTable' });const url=doc.output('bloburl');window.open(url,'_blank');doc.save('attendance_register.pdf');};
  shareRegister.onclick=()=>{const hdr=`Attendance Report\n${$('setupText').textContent}`,rows=Array.from(registerBody.querySelectorAll('tr')).map(tr=>Array.from(tr.querySelectorAll('td')).map(td=>td.querySelector('.status-text')?td.querySelector('.status-text').textContent:td.textContent).join(' '));window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`,'_blank');};

  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(console.error);
});
