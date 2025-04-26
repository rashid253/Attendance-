// app.js
window.addEventListener('DOMContentLoaded', async () => {
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);

  // --- STORAGE ---
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};

  const saveStudents       = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);

  // --- ADM# GENERATOR ---
  const getLastAdmNo = async () => (await get('lastAdmissionNo')) || 0;
  const setLastAdmNo = n => set('lastAdmissionNo', n);
  const generateAdmNo = async () => {
    const last = await getLastAdmNo(), next = last + 1;
    setLastAdmNo(next);
    return String(next).padStart(4,'0');
  };

  // --- Filters & Counters ---
  const getCurrentClassSection = () => ({ cls: $('teacherClassSelect').value, sec: $('teacherSectionSelect').value });
  const filteredStudents = () => students.filter(s=>s.cls===getCurrentClassSection().cls && s.sec===getCurrentClassSection().sec);
  const animateCounters = () => { document.querySelectorAll('.number').forEach(span=>{ const target=+span.dataset.target; let c=0,step=Math.max(1,target/100); const upd=()=>{ c+=step; span.textContent=c<target?Math.ceil(c):target; if(c<target) requestAnimationFrame(upd); }; requestAnimationFrame(upd); }); };
  const updateTotals = () => { const totSchool=students.length, totClass=students.filter(s=>s.cls===getCurrentClassSection().cls).length, totSection=filteredStudents().length; [['sectionCount',totSection],['classCount',totClass],['schoolCount',totSchool]].forEach(([id,v])=>$ (id).dataset.target=v); animateCounters(); };

  // --- Elem refs ---
  const schoolInput=$('schoolNameInput'), classSelect=$('teacherClassSelect'), sectionSelect=$('teacherSectionSelect');
  const btnSaveSetup=$('saveSetup'), setupForm=$('setupForm'), setupDisplay=$('setupDisplay'), setupText=$('setupText'), btnEditSetup=$('editSetup');
  const nameInput=$('studentName'), parentInput=$('parentName'), contactInput=$('parentContact'), occInput=$('parentOccupation'), addrInput=$('parentAddress');
  const btnAddStudent=$('addStudent'), tbodyStudents=$('studentsBody'), chkAllStudents=$('selectAllStudents');
  const btnEditSel=$('editSelected'), btnDeleteSel=$('deleteSelected'), btnSaveReg=$('saveRegistration'), btnShareReg=$('shareRegistration'), btnEditReg=$('editRegistration'), btnDownloadReg=$('downloadRegistrationPDF');
  const dateInput=$('dateInput'), btnLoadAtt=$('loadAttendance'), divAttList=$('attendanceList'), btnSaveAtt=$('saveAttendance');
  const sectionResult=$('attendance-result'), tbodySummary=$('summaryBody'), btnResetAtt=$('resetAttendance'), btnShareAtt=$('shareAttendanceSummary'), btnDownloadAtt=$('downloadAttendancePDF');
  const selectAnalyticsTarget=$('analyticsTarget'), analyticsFilter=$('analyticsFilter'), analyticsStudentInput=$('analyticsStudentInput'), studentDatalist=$('studentDatalist');
  const selectAnalyticsType=$('analyticsType'), inputAnalyticsDate=$('analyticsDate'), inputAnalyticsMonth=$('analyticsMonth'), inputSemesterStart=$('semesterStart'), inputSemesterEnd=$('semesterEnd'), inputAnalyticsYear=$('yearStart');
  const btnLoadAnalytics=$('loadAnalytics'), btnResetAnalytics=$('resetAnalytics'), divInstructions=$('instructions'), divAnalyticsTable=$('analyticsContainer'), divGraphs=$('graphs'), btnShareAnalytics=$('shareAnalytics'), btnDownloadAnalytics=$('downloadAnalytics');
  let chartBar,chartPie; const ctxBar=$('barChart').getContext('2d'), ctxPie=$('pieChart').getContext('2d');
  const monthInput=$('registerMonth'), btnLoadReg=$('loadRegister'), btnChangeReg=$('changeRegister'), divRegTable=$('registerTableWrapper'), tbodyReg=$('registerBody'), divRegSummary=$('registerSummarySection'), tbodyRegSum=$('registerSummaryBody'), btnShareReg2=$('shareRegister'), btnDownloadReg2=$('downloadRegisterPDF'), headerRegRowEl=document.querySelector('#registerTable thead tr');
  const colors={P:'#4CAF50',A:'#f44336',Lt:'#FFEB3B',HD:'#FF9800',L:'#03a9f4'};

  // --- Render & Setup ---
  function bindRowSelection(){ const boxes=[...tbodyStudents.querySelectorAll('.sel')]; boxes.forEach(cb=>cb.onchange=()=>{ cb.closest('tr').classList.toggle('selected',cb.checked); const any=boxes.some(x=>x.checked); btnEditSel.disabled=btnDeleteSel.disabled=!any; }); chkAllStudents.disabled=btnSaveReg.classList.contains('hidden'); chkAllStudents.onchange=()=>boxes.forEach(cb=>{cb.checked=chkAllStudents.checked;cb.dispatchEvent(new Event('change'));}); }
  function renderStudents(){ tbodyStudents.innerHTML=''; filteredStudents().forEach((st,i)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td><input type="checkbox" class="sel" data-index="${i}" ${btnSaveReg.classList.contains('hidden')?'':'disabled'}></td><td>${i+1}</td><td>${st.name}</td><td>${st.adm}</td><td>${st.parent}</td><td>${st.contact}</td><td>${st.occupation}</td><td>${st.address}</td><td>${btnSaveReg.classList.contains('hidden')?'<button class="share-one">Share</button>':''}</td>`; if(btnSaveReg.classList.contains('hidden')) tr.querySelector('.share-one').onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(`Name: ${st.name}\nAdm#: ${st.adm}`)}`); tbodyStudents.appendChild(tr); }); bindRowSelection(); updateTotals(); }
  async function loadSetup(){ const school=await get('schoolName'), cls=await get('teacherClass'), sec=await get('teacherSection'); if(school&&cls&&sec){ schoolInput.value=school; classSelect.value=cls; sectionSelect.value=sec; setupText.textContent=`${school} | Class: ${cls} | Section: ${sec}`; setupForm.classList.add('hidden'); setupDisplay.classList.remove('hidden'); renderStudents(); }}
  btnSaveSetup.onclick=async e=>{ e.preventDefault(); if(!schoolInput.value||!classSelect.value||!sectionSelect.value) return alert('Complete setup'); await set('schoolName',schoolInput.value); await set('teacherClass',classSelect.value); await set('teacherSection',sectionSelect.value); await loadSetup(); };
  btnEditSetup.onclick=e=>{ e.preventDefault(); setupForm.classList.remove('hidden'); setupDisplay.classList.add('hidden'); };
  await loadSetup();

  // --- Student Registration ---
  btnAddStudent.onclick=async e=>{ e.preventDefault(); const [n,p,c,o,a]=[nameInput,parentInput,contactInput,occInput,addrInput].map(i=>i.value.trim()); if(!n||!p||!c||!o||!a) return alert('All fields required'); if(!/^\d{7,15}$/.test(c)) return alert('Contact must be 7–15 digits'); const adm=await generateAdmNo(); students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,roll:Date.now(),cls:classSelect.value,sec:sectionSelect.value}); await saveStudents(); renderStudents(); [nameInput,parentInput,contactInput,occInput,addrInput].forEach(i=>i.value=''); };

  // --- Registration Save/Edit/Share ---
  btnSaveReg.onclick=e=>{ e.preventDefault(); ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.add('hidden')); ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.remove('hidden')); renderStudents(); };
  btnEditReg.onclick=e=>{ e.preventDefault(); ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.remove('hidden')); ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.add('hidden')); renderStudents(); };
  btnShareReg.onclick=e=>{ e.preventDefault(); const hdr=`*Attendance Report*\nSchool: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`; const lines=filteredStudents().map(s=>`Name: ${s.name} | Adm#: ${s.adm}`); window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`); };
  btnDownloadReg.onclick=e=>{ e.preventDefault(); const {jsPDF}=window.jspdf; const doc=new jsPDF(); doc.text('Attendance Report',10,10); doc.text(`School: ${schoolInput.value}`,10,20); doc.autoTable({ head:[['Name','Adm#']], body:filteredStudents().map(s=>[s.name,s.adm]), startY:30 }); doc.save('registration.pdf'); };

  // --- Attendance ---
  btnLoadAtt.onclick=e=>{ e.preventDefault(); if(!dateInput.value) return alert('Pick date'); divAttList.innerHTML=''; filteredStudents().forEach(s=>{ const row=document.createElement('div'), actions=document.createElement('div'); row.textContent=s.name; actions.className='attendance-actions'; ['P','A','Lt','HD','L'].forEach(code=>{ const b=document.createElement('button'); b.textContent=code; b.dataset.code=code; b.onclick=()=>{ actions.querySelectorAll('button').forEach(x=>{x.style=''}); b.style.background=colors[code]; b.style.color='#fff'; }; actions.appendChild(b); }); divAttList.append(row,actions); }); btnSaveAtt.classList.remove('hidden'); };
  btnSaveAtt.onclick=async e=>{ e.preventDefault(); const d=dateInput.value; attendanceData[d]={}; document.querySelectorAll('.attendance-actions').forEach((actions,i)=>{ const btn=actions.querySelector('button[style]'); attendanceData[d][filteredStudents()[i].roll]=btn?btn.dataset.code:'A'; }); await saveAttendanceData(); $('attendance-section').classList.add('hidden'); sectionResult.classList.remove('hidden'); tbodySummary.innerHTML=''; filteredStudents().forEach(s=>{ const code=attendanceData[dateInput.value][s.roll]||'A'; const tr=document.createElement('tr'); tr.innerHTML=`<td>${s.name}</td><td>${code}</td><td><button class='send-btn'>Send</button></td>`; tr.querySelector('.send-btn').onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(`${s.name}: ${code}`)}`); tbodySummary.appendChild(tr); }); };
  btnResetAtt.onclick=()=>{ sectionResult.classList.add('hidden'); $('attendance-section').classList.remove('hidden'); divAttList.innerHTML=''; btnSaveAtt.classList.add('hidden'); };
  btnShareAtt.onclick=()=>btnSaveAtt.onclick();
  btnDownloadAtt.onclick=e=>{ e.preventDefault(); alert('Download PDF logic here'); };

  // --- Analytics ---
  function hideAllAnalytics(){ ['analyticsFilter','analyticsStudentInput','analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart','instructions','analyticsContainer','graphs','analyticsActions'].forEach(id=>$(id).classList.add('hidden')); }
  selectAnalyticsTarget.onchange=()=>{ hideAllAnalytics(); if(selectAnalyticsTarget.value==='student'){ analyticsFilter.classList.remove('hidden'); $('labelFilter').classList.remove('hidden'); } };
  analyticsFilter.onchange=e=>{ const field=e.target.value; studentDatalist.innerHTML=''; filteredStudents().forEach(s=>{ const v=field==='adm'?s.adm:s.name; studentDatalist.insertAdjacentHTML('beforeend',`<option value="${v}">`); }); analyticsStudentInput.classList.remove('hidden'); };
  selectAnalyticsType.onchange=()=>{ hideAllAnalytics(); const t=selectAnalyticsType.value; if(t==='date') $('analyticsDate').classList.remove('hidden'); if(t==='month') $('analyticsMonth').classList.remove('hidden'); if(t==='semester'){ $('semesterStart').classList.remove('hidden'); $('semesterEnd').classList.remove('hidden'); } if(t==='year') $('yearStart').classList.remove('hidden'); btnResetAnalytics.classList.remove('hidden'); };
  btnLoadAnalytics.onclick=e=>{ e.preventDefault(); let from,to; const t=selectAnalyticsType.value; if(t==='date'){ from=to=inputAnalyticsDate.value; } else if(t==='month'){ const [y,m]=inputAnalyticsMonth.value.split('-'); from=`${inputAnalyticsMonth.value}-01`; to=`${inputAnalyticsMonth.value}-${new Date(y,m,0).getDate()}`; } else if(t==='semester'){ const [sy,sm]=inputSemesterStart.value.split('-'); const [ey,em]=inputSemesterEnd.value.split('-'); from=`${inputSemesterStart.value}-01`; to=`${inputSemesterEnd.value}-${new Date(ey,em,0).getDate()}`; } else if(t==='year'){ from=`${inputAnalyticsYear.value}-01-01`; to=`${inputAnalyticsYear.value}-12-31`; } else return alert('Select period');
    const stats=filteredStudents().map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0})); Object.entries(attendanceData).forEach(([d,recs])=>{ if(d>=from&&d<=to) stats.forEach(st=>{ const c=recs[st.roll]||'A'; st[c]++; st.total++; }); });
    // render
    divAnalyticsTable.innerHTML='<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>%</th></tr></thead><tbody>'+stats.map(s=>`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${((s.P/s.total*100)||0).toFixed(1)}</td></tr>`).join('')+'</tbody></table>';
    divAnalyticsTable.classList.remove('hidden'); divInstructions.textContent=`Report: ${from} to ${to}`; divInstructions.classList.remove('hidden');
    // charts
    const labels=stats.map(s=>s.name), dataPct=stats.map(s=>s.total? s.P/s.total*100:0);
    chartBar&&chartBar.destroy(); chartBar=new Chart(ctxBar,{type:'bar',data:{labels,datasets:[{label:'% Present',data:dataPct}]},options:{scales:{y:{beginAtZero:true,max:100}}}});
    const agg=stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    chartPie&&chartPie.destroy(); chartPie=new Chart(ctxPie,{type:'pie',data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg)}]}});
    divGraphs.classList.remove('hidden'); $('analyticsActions').classList.remove('hidden'); };

  btnShareAnalytics.onclick=e=>{ e.preventDefault(); alert('Share analytics via WhatsApp'); };
  btnDownloadAnalytics.onclick=e=>{ e.preventDefault(); alert('Download analytics PDF'); };

  // --- Register ---
  function genHeader(days){ headerRegRowEl.innerHTML='<th>Sr#</th><th>Adm#</th><th>Name</th>'+Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join(''); }
  btnLoadReg.onclick=e=>{ e.preventDefault(); const [y,m]=monthInput.value.split('-').map(Number), days=new Date(y,m,0).getDate(); genHeader(days); tbodyReg.innerHTML=''; tbodyRegSum.innerHTML=''; filteredStudents().forEach((s,i)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`+Array.from({length:days},(_,d)=>{const code=(attendanceData[`${monthInput.value}-${String(d+1).padStart(2,'0')}`]||{})[s.roll]||'A';return`<td style="background:${colors[code]};color:#fff">${code}</td>`;}).join(''); tbodyReg.appendChild(tr); });
    filteredStudents().forEach(s=>{ let stat={P:0,A:0,Lt:0,HD:0,L:0,total:0}; for(let d=1;d<=days;d++){const code=(attendanceData[`${monthInput.value}-${String(d).padStart(2,'0')}`]||{})[s.roll]||'A'; stat[code]++; stat.total++; } const pct=(stat.total?((stat.P/stat.total)*100).toFixed(1):'0'); const tr=document.createElement('tr'); tr.innerHTML=`<td>${s.name}</td><td>${stat.P}</td><td>${stat.A}</td><td>${stat.Lt}</td><td>${stat.HD}</td><td>${stat.L}</td><td>${pct}</td>`; tbodyRegSum.appendChild(tr); }); divRegTable.classList.remove('
