// app.js
window.addEventListener('DOMContentLoaded', async () => {
  (function(){ const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/eruda'; s.onload = () => eruda.init(); document.body.appendChild(s); })();
  if (!window.idbKeyval) { console.error('idbKeyval not found'); return; }
  const { get, set } = window.idbKeyval;
  let students = await get('students')||[], attendanceData = await get('attendanceData')||{}, lastAdmNo = await get('lastAdmissionNo')||0;
  let lastShareText='', lastAnalyticsShare='';
  const saveStudents=()=>set('students',students), saveAttendanceData=()=>set('attendanceData',attendanceData), saveLastAdmNo=()=>set('lastAdmissionNo',lastAdmNo);
  async function generateAdmNo(){ lastAdmNo++; await saveLastAdmNo(); return String(lastAdmNo).padStart(4,'0'); }
  const $=id=>document.getElementById(id), show=(...e)=>e.forEach(x=>x&&x.classList.remove('hidden')), hide=(...e)=>e.forEach(x=>x&&x.classList.add('hidden'));

  // SETUP
  async function loadSetup(){
    const [school,cls,sec]=await Promise.all([get('schoolName'),get('teacherClass'),get('teacherSection')]);
    if(school&&cls&&sec){
      $('schoolNameInput').value=school; $('teacherClassSelect').value=cls; $('teacherSectionSelect').value=sec;
      $('setupText').textContent=`${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      hide($('setupForm')); show($('setupDisplay')); renderStudents(); updateCounters();
    }
  }
  $('saveSetup').onclick=async e=>{e.preventDefault(); const s=$('schoolNameInput').value.trim(), c=$('teacherClassSelect').value, q=$('teacherSectionSelect').value;
    if(!s||!c||!q){alert('Complete setup');return;} await Promise.all([set('schoolName',s),set('teacherClass',c),set('teacherSection',q)]); await loadSetup();
  };
  $('editSetup').onclick=e=>{e.preventDefault(); show($('setupForm')); hide($('setupDisplay'));};
  await loadSetup();

  // COUNTERS
  function animateCounters(){ document.querySelectorAll('.number').forEach(span=>{ const t=+span.dataset.target; let cnt=0,step=Math.max(1,t/100);
      (function u(){ cnt+=step; span.textContent=cnt<t?Math.ceil(cnt):t; if(cnt<t)requestAnimationFrame(u); })();
    });
  }
  function updateCounters(){ const cls=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    $('sectionCount').dataset.target=students.filter(s=>s.cls===cls&&s.sec===sec).length;
    $('classCount').dataset.target=students.filter(s=>s.cls===cls).length;
    $('schoolCount').dataset.target=students.length; animateCounters();
  }
  $('teacherClassSelect').onchange=()=>{renderStudents();updateCounters();};
  $('teacherSectionSelect').onchange=()=>{renderStudents();updateCounters();};

  // STUDENT REGISTRATION
  function renderStudents(){
    const cls=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value, tbody=$('studentsBody');
    tbody.innerHTML='';
    students.filter(s=>s.cls===cls&&s.sec===sec).forEach((stu,i)=>{ const tr=document.createElement('tr'); tr.dataset.index=i;
      tr.innerHTML=`<td><input type="checkbox" class="sel"></td><td>${i+1}</td><td>${stu.name}</td><td>${stu.adm}</td><td>${stu.parent}</td><td>${stu.contact}</td><td>${stu.occupation}</td><td>${stu.address}</td><td>${$('shareRegistration').classList.contains('hidden')?'':`<i class="fas fa-share-alt share-row" data-index="${i}"></i>`}</td>`;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked=false; toggleButtons();
    document.querySelectorAll('.share-row').forEach(ic=>ic.onclick=()=>{const s=students[+ic.dataset.index],msg=`*${s.name}*\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');});
  }
  function toggleButtons(){const any=!!document.querySelector('.sel:checked'); $('editSelected').disabled=!any; $('deleteSelected').disabled=!any;}
  $('studentsBody').addEventListener('change',e=>{ if(e.target.classList.contains('sel')) toggleButtons(); });
  $('selectAllStudents').onclick=()=>{document.querySelectorAll('.sel').forEach(cb=>cb.checked=$('selectAllStudents').checked); toggleButtons();};

  $('addStudent').onclick=async e=>{e.preventDefault(); const name=$('studentName').value.trim(), parent=$('parentName').value.trim(), contact=$('parentContact').value.trim(), occupation=$('parentOccupation').value.trim(), address=$('parentAddress').value.trim(), cls=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    if(!name||!parent||!contact||!occupation||!address){alert('All fields required');return;}
    if(!/^\d{7,15}$/.test(contact)){alert('Contact must be 7–15 digits');return;}
    const adm=await generateAdmNo(); students.push({name,adm,parent,contact,occupation,address,cls,sec}); await saveStudents(); renderStudents(); updateCounters();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };

  $('deleteSelected').onclick=async ()=>{ if(!confirm('Delete selected?'))return; const toDel=Array.from(document.querySelectorAll('.sel:checked')).map(cb=>+cb.closest('tr').dataset.index); students=students.filter((_,i)=>!toDel.includes(i)); await saveStudents(); renderStudents(); updateCounters(); };
  $('editSelected').onclick=()=>{
    document.querySelectorAll('.sel:checked').forEach(cb=>{const tr=cb.closest('tr'),i=+tr.dataset.index,s=students[i]; tr.innerHTML=`<td><input type="checkbox" class="sel" checked></td><td>${i+1}</td><td><input value="${s.name}"></td><td>${s.adm}</td><td><input value="${s.parent}"></td><td><input value="${s.contact}"></td><td><input value="${s.occupation}"></td><td><input value="${s.address}"></td><td></td>`;});
    hide($('editSelected'),$('deleteSelected')); show($('doneEditing'));
  };
  $('doneEditing').onclick=async ()=>{
    document.querySelectorAll('#studentsBody tr').forEach(tr=>{ const inputs=tr.querySelectorAll('input:not(.sel)'); if(inputs.length===5){ const [name,parent,contact,occupation,address]=Array.from(inputs).map(i=>i.value.trim()), adm=tr.children[3].textContent, idx=students.findIndex(s=>s.adm===adm); if(idx>-1) students[idx]={...students[idx],name,parent,contact,occupation,address}; }}); await saveStudents(); hide($('doneEditing')); show($('editSelected'),$('deleteSelected'),$('saveRegistration')); renderStudents(); updateCounters();
  };
  $('saveRegistration').onclick=async ()=>{ await saveStudents(); hide($('editSelected'),$('deleteSelected'),$('selectAllStudents'),$('saveRegistration')); show($('shareRegistration'),$('downloadRegistrationPDF')); renderStudents();};
  $('shareRegistration').onclick=()=>{ const cls=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value,header=`*Students List*\nClass ${cls} Section ${sec}`,lines=students.filter(s=>s.cls===cls&&s.sec===sec).map(s=>`*${s.name}*\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`).join('\n\n'); lastShareText=header+'\n\n'+lines; window.open(`https://wa.me/?text=${encodeURIComponent(lastShareText)}`,'_blank');};
  $('downloadRegistrationPDF').onclick=()=>{const doc=new window.jspdf.jsPDF();doc.autoTable({html:'#studentsTable'});doc.save('registration.pdf');};

  // MARK ATTENDANCE
  const dateInput=$('dateInput'),loadAttendance=$('loadAttendance'),saveAttendance=$('saveAttendance'),resetAttendance=$('resetAttendance'),downloadAttendancePDF=$('downloadAttendancePDF'),shareAttendanceSummary=$('shareAttendanceSummary'),attendanceBody=$('attendanceBody'),attendanceSummary=$('attendanceSummary');
  const statusNames={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}, statusColors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};
  loadAttendance.onclick=()=>{
    attendanceBody.innerHTML=''; students.forEach(stu=>{ const row=document.createElement('div');row.className='attendance-row'; const nameDiv=document.createElement('div');nameDiv.className='attendance-name';nameDiv.textContent=stu.name; const btns=document.createElement('div');btns.className='attendance-buttons'; Object.keys(statusNames).forEach(code=>{ const btn=document.createElement('button');btn.className='att-btn';btn.textContent=code;btn.onclick=()=>{ btns.querySelectorAll('.att-btn').forEach(b=>{b.classList.remove('selected');b.style.background='';b.style.color='';}); btn.classList.add('selected');btn.style.background=statusColors[code];btn.style.color='#fff';}; btns.appendChild(btn);}); row.append(nameDiv,btns); attendanceBody.appendChild(row); });
    show(saveAttendance); hide(resetAttendance,downloadAttendancePDF,shareAttendanceSummary,attendanceSummary);
  };
  saveAttendance.onclick=async()=>{
    const date=dateInput.value; if(!date){alert('Pick a date');return;} attendanceData[date]={};
    students.forEach((s,i)=>{ const btn=attendanceBody.children[i].querySelector('.att-btn.selected'), code=btn?btn.textContent:'A'; attendanceData[date][s.adm]=code; });
    await saveAttendanceData(); const header=`Attendance Report: ${date}\n`, lines=students.map(s=>`${s.name}: ${statusNames[attendanceData[date][s.adm]]}`); lastShareText=header+lines.join('\n');
    const tbl=document.createElement('table'); tbl.innerHTML='<tr><th>Name</th><th>Status</th></tr>'+students.map(s=>`<tr><td>${s.name}</td><td>${statusNames[attendanceData[date][s.adm]]}</td></tr>`).join('');
    attendanceSummary.innerHTML=`<h3>Attendance Report: ${date}</h3>`; attendanceSummary.appendChild(tbl);
    hide(saveAttendance,attendanceBody); show(resetAttendance,downloadAttendancePDF,shareAttendanceSummary,attendanceSummary);
  };
  downloadAttendancePDF.onclick=()=>{const doc=new window.jspdf.jsPDF();doc.autoTable({html:'#attendanceSummary table'});doc.save('attendance_summary.pdf');};
  shareAttendanceSummary.onclick=()=>{window.open(`https://wa.me/?text=${encodeURIComponent(lastShareText)}`,'_blank');};
  resetAttendance.onclick=()=>{show(attendanceBody,saveAttendance); hide(resetAttendance,downloadAttendancePDF,shareAttendanceSummary,attendanceSummary);};

  // ANALYTICS
  const analyticsTarget=$('analyticsTarget'),analyticsSectionSel=$('analyticsSectionSelect'),analyticsType=$('analyticsType'),analyticsDate=$('analyticsDate'),analyticsMonth=$('analyticsMonth'),semesterStart=$('semesterStart'),semesterEnd=$('semesterEnd'),yearStart=$('yearStart'),analyticsSearch=$('analyticsSearch'),loadAnalyticsBtn=$('loadAnalytics'),resetAnalyticsBtn=$('resetAnalytics'),instructionsEl=$('instructions'),analyticsContainer=$('analyticsContainer'),graphsEl=$('graphs'),analyticsActions=$('analyticsActions'),shareAnalyticsBtn=$('shareAnalytics'),downloadAnalyticsBtn=$('downloadAnalytics'),barCtx=$('barChart').getContext('2d'),pieCtx=$('pieChart').getContext('2d');
  let barChart,pieChart;
  analyticsTarget.onchange=()=>{
    analyticsType.disabled=false; hide(analyticsSectionSel,analyticsSearch);
    if(analyticsTarget.value==='section')show(analyticsSectionSel); if(analyticsTarget.value==='student')show(analyticsSearch);
    hide(instructionsEl,analyticsContainer,graphsEl,analyticsActions,resetAnalyticsBtn);
  };
  analyticsType.onchange=()=>{
    hide(instructionsEl,analyticsContainer,graphsEl,analyticsActions,resetAnalyticsBtn,analyticsDate,analyticsMonth,semesterStart,semesterEnd,yearStart);
    if(analyticsType.value==='date')show(analyticsDate); if(analyticsType.value==='month')show(analyticsMonth); if(analyticsType.value==='semester')show(semesterStart,semesterEnd); if(analyticsType.value==='year')show(yearStart);
    show(resetAnalyticsBtn);
  };
  resetAnalyticsBtn.onclick=e=>{e.preventDefault();analyticsType.value='';hide(instructionsEl,analyticsContainer,graphsEl,analyticsActions,resetAnalyticsBtn,analyticsDate,analyticsMonth,semesterStart,semesterEnd,yearStart);};
  loadAnalyticsBtn.onclick=()=>{
    if(analyticsTarget.value==='student'&&!analyticsSearch.value.trim()){alert('Please enter Adm# or Name');return;}
    let from,to; const typ=analyticsType.value;
    if(typ==='date')from=to=analyticsDate.value; else if(typ==='month'){const [y,m]=analyticsMonth.value.split('-').map(Number);from=`${analyticsMonth.value}-01`;to=`${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;} else if(typ==='semester'){const [sy,sm]=semesterStart.value.split('-').map(Number),[ey,em]=semesterEnd.value.split('-').map(Number);from=`${semesterStart.value}-01`;to=`${semesterEnd.value}-${new Date(ey,em,0).getDate()}`;} else if(typ==='year'){from=`${yearStart.value}-01-01`;to=`${yearStart.value}-12-31`;} else {alert('Select period');return;}
    let pool=students.slice(); if(analyticsTarget.value==='section')pool=pool.filter(s=>s.sec===analyticsSectionSel.value); if(analyticsTarget.value==='student'){const q=analyticsSearch.value.trim().toLowerCase();pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));}
    const stats=pool.map(s=>({adm:s.adm,name:s.name,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs])=>{if(d<from||d>to)return;stats.forEach(st=>{const c=recs[st.adm]||'A';st[c]++;st.total++;});});
    const head=$('analyticsTable').querySelector('thead tr');head.innerHTML='<th>#</th><th>Adm#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th>';
    const body=$('analyticsBody');body.innerHTML='';stats.forEach((st,i)=>{const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0';const tr=document.createElement('tr');tr.innerHTML=`<td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${pct}%</td>`;body.appendChild(tr);});
    instructionsEl.textContent=`Period: ${from} to ${to}`;show(instructionsEl,analyticsContainer,graphsEl,analyticsActions);
    barChart?.destroy();barChart=new Chart(barCtx,{type:'bar',data:{labels:stats.map(s=>s.name),datasets:[{label:'% Present',data:stats.map(s=>s.total? s.P/s.total*100:0)}]},options:{scales:{y:{beginAtZero:true,max:100}}}});
    const agg=stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(k=>a[k]+=s[k]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    pieChart?.destroy();pieChart=new Chart(pieCtx,{type:'pie',data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg)}]}});
    lastAnalyticsShare=`Analytics (${from} to ${to})\n`+stats.map((st,i)=>`${i+1}. ${st.adm} ${st.name}: ${((st.P||0)/(st.total||1)*100).toFixed(1)}%`).join('\n');
  };
  $('shareAnalytics').onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`,'_blank');
  $('downloadAnalytics').onclick=()=>{const doc=new window.jspdf.jsPDF();doc.autoTable({html:'#analyticsTable'});doc.save('analytics.pdf');};

  // ATTENDANCE REGISTER
  const loadRegisterBtn=$('loadRegister'), saveRegisterBtn=$('saveRegister'), changeRegisterBtn=$('changeRegister'), downloadRegister=$('downloadRegister'), shareRegister=$('shareRegister'), monthInput=$('registerMonth'), registerBody=$('registerBody'), registerHeader=$('registerHeader');
  const regCodes=['A','P','Lt','HD','L'], regColors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};
  loadRegisterBtn.onclick=()=>{
    const m=monthInput.value; if(!m){alert('Pick month');return;}
    const [y,mm]=m.split('-').map(Number), days=new Date(y,mm,0).getDate();
    registerHeader.innerHTML='<th>#</th><th>Adm#</th><th>Name</th>'+Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    registerBody.innerHTML=''; students.forEach((s,i)=>{let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;for(let d=1;d<=days;d++){const key=`${m}-${String(d).padStart(2,'0')}`,code=(attendanceData[key]&&attendanceData[key][s.adm])||'A',style=code==='A'?'':` style="background:${regColors[code]};color:#fff"`;row+=`<td class="reg-cell"${style}><span class="status-text">${code}</span></td>`;}const tr=document.createElement('tr');tr.innerHTML=row;registerBody.appendChild(tr);});
    registerBody.querySelectorAll('.reg-cell').forEach(cell=>{const span=cell.querySelector('.status-text');cell.onclick=()=>{let idx=regCodes.indexOf(span.textContent);idx=(idx+1)%regCodes.length;const code=regCodes[idx];span.textContent=code;if(code==='A'){cell.style.background='';cell.style.color='';}else{cell.style.background=regColors[code];cell.style.color='#fff';}};});
    show($('registerTableWrapper'),changeRegisterBtn,downloadRegister,shareRegister,saveRegisterBtn); hide(loadRegisterBtn);
  };
  saveRegisterBtn.onclick=async()=>{
    const m=monthInput.value,[y,mm]=m.split('-').map(Number),days=new Date(y,mm,0).getDate();
    Array.from(registerBody.children).forEach(tr=>{const adm=tr.children[1].textContent;for(let d=0;d<days;d++){const code=tr.children[3+d].querySelector('.status-text').textContent,key=`${m}-${String(d+1).padStart(2,'0')}`;attendanceData[key]=attendanceData[key]||{};attendanceData[key][adm]=code;}});await saveAttendanceData();alert('Register saved');};
  changeRegisterBtn.onclick=()=>{hide($('registerTableWrapper'),changeRegisterBtn,downloadRegister,shareRegister,saveRegisterBtn);show(loadRegisterBtn);};
  downloadRegister.onclick=()=>{const doc=new window.jspdf.jsPDF();doc.autoTable({html:'#registerTable'});doc.save('attendance_register.pdf');};
  shareRegister.onclick=()=>{const hdr=`Attendance Register: ${monthInput.value}`,rows=Array.from(registerBody.querySelectorAll('tr')).map(tr=>Array.from(tr.querySelectorAll('td')).map(td=>{const st=td.querySelector('.status-text');return st?st.textContent.trim():td.textContent.trim();}).join(' '));window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`,'_blank');};
});
