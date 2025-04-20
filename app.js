// app.js
window.addEventListener('DOMContentLoaded', () => {
  const { jsPDF } = window.jspdf;
  const $ = id => document.getElementById(id);
  const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };

  // SETUP
  const schoolIn = $('schoolNameInput'), classSel = $('teacherClassSelect'), secSel = $('teacherSectionSelect');
  const saveSetup = $('saveSetup'), editSetup = $('editSetup'), setupForm = $('setupForm'), setupDisplay = $('setupDisplay'), setupText = $('setupText');
  function loadSetup() {
    const school = localStorage.getItem('schoolName'), cls = localStorage.getItem('teacherClass'), sec = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school; classSel.value = cls; secSel.value = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden'); setupDisplay.classList.remove('hidden');
    }
  }
  saveSetup.addEventListener('click', e => { e.preventDefault(); if (!schoolIn.value||!classSel.value||!secSel.value) { alert('Complete setup first'); return;} localStorage.setItem('schoolName',schoolIn.value); localStorage.setItem('teacherClass',classSel.value); localStorage.setItem('teacherSection',secSel.value); loadSetup(); });
  editSetup.addEventListener('click', e => { e.preventDefault(); setupForm.classList.remove('hidden'); setupDisplay.classList.add('hidden'); });
  loadSetup();

  // STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const studentNameIn = $('studentName'), admissionNoIn = $('admissionNo'), parentNameIn = $('parentName'), parentContactIn = $('parentContact'), parentOccIn = $('parentOccupation'), parentAddrIn = $('parentAddress');
  const addStudentBtn = $('addStudent'), studentsBody = $('studentsBody'), selectAll = $('selectAllStudents');
  const editSelBtn = $('editSelected'), deleteSelBtn = $('deleteSelected'), saveRegBtn = $('saveRegistration'), shareRegBtn = $('shareRegistration'), editRegBtn = $('editRegistration'), downloadRegBtn = $('downloadRegistrationPDF'), studentTableWrapper = $('studentTableWrapper');
  let regSaved = false;
  function saveStudents() { localStorage.setItem('students', JSON.stringify(students)); }
  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => cb.onchange = () => { cb.closest('tr').classList.toggle('selected', cb.checked); const any = boxes.some(x => x.checked); editSelBtn.disabled = deleteSelBtn.disabled = !any; });
    selectAll.disabled = regSaved;
    selectAll.onchange = () => { if (!regSaved) boxes.forEach(cb => (cb.checked = selectAll.checked, cb.onchange())); };
  }
  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type=\"checkbox\" class=\"sel\" data-index=\"${i}\" ${regSaved?'disabled':''}></td>`+
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>`+
        `<td>${regSaved?'<button class=\"share-one\">Share</button>':''}</td>`;
      if (regSaved) tr.querySelector('.share-one').onclick = e => { e.preventDefault(); const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`; const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`; window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`); };
      studentsBody.appendChild(tr);
    }); bindSelection();
  }
  addStudentBtn.addEventListener('click', e => { e.preventDefault(); const name=studentNameIn.value.trim(), adm=admissionNoIn.value.trim(), parent=parentNameIn.value.trim(), contact=parentContactIn.value.trim(), occ=parentOccIn.value.trim(), addr=parentAddrIn.value.trim(); if(!name||!adm||!parent||!contact||!occ||!addr){alert('All fields are required');return;} if(!/^[0-9]+$/.test(adm)){alert('Admission No must be numeric');return;} if(students.some(s=>s.adm===adm)){alert('Admission No already exists');return;} if(!/^[0-9]{7,15}$/.test(contact)){alert('Contact must be 7-15 digits');return;} students.push({name,adm,parent,contact,occupation:occ,address:addr,roll:Date.now()}); saveStudents(); renderStudents(); [studentNameIn,admissionNoIn,parentNameIn,parentContactIn,parentOccIn,parentAddrIn].forEach(i=>i.value=''); });
  saveRegBtn.addEventListener('click', e => { e.preventDefault(); regSaved=true; ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.add('hidden')); shareRegBtn.classList.remove('hidden'); editRegBtn.classList.remove('hidden'); downloadRegBtn.classList.remove('hidden'); studentTableWrapper.classList.add('saved'); renderStudents(); });
  editRegBtn.addEventListener('click', e => { e.preventDefault(); regSaved=false; ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.remove('hidden')); shareRegBtn.classList.add('hidden'); editRegBtn.classList.add('hidden'); downloadRegBtn.classList.add('hidden'); studentTableWrapper.classList.remove('saved'); renderStudents(); });
  shareRegBtn.addEventListener('click', e => { e.preventDefault(); const hdr=`School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`; const lines=students.map(s=>`Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`); window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines.join('\n---\n'))}`); });
  downloadRegBtn.addEventListener('click', e => { e.preventDefault(); const doc=new jsPDF('p','pt','a4'); doc.autoTable({ head:[['Name','Adm#','Parent','Contact','Occupation','Address']], body:students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]), startY:40, margin:{left:40,right:40}, styles:{fontSize:10} }); doc.save('students_registration.pdf'); });
  renderStudents();

  // MARK ATTENDANCE
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');
  const dateInput = $('dateInput'), loadAtt = $('loadAttendance'), attList = $('attendanceList'), saveAtt = $('saveAttendance');
  loadAtt.addEventListener('click', e => {
    e.preventDefault(); if(!dateInput.value){alert('Select a date');return;} attList.innerHTML='';
    students.forEach(s=>{ const row=document.createElement('div'); row.className='attendance-item'; row.textContent=s.name; const btns=document.createElement('div'); btns.className='attendance-actions'; ['P','A','Lt','HD','L'].forEach(code=>{ const b=document.createElement('button'); b.type='button'; b.className='att-btn'; b.dataset.code=code; b.textContent=code; if(attendanceData[dateInput.value]?.[s.roll]===code){b.style.background=colors[code];b.style.color='#fff';} b.addEventListener('click',()=>{btns.querySelectorAll('.att-btn').forEach(x=>{x.style.background='';x.style.color='var(--dark)'}); b.style.background=colors[code]; b.style.color='#fff';}); btns.appendChild(b); }); attList.appendChild(row); attList.appendChild(btns); }); saveAtt.classList.remove('hidden');
  });
  saveAtt.addEventListener('click', e => {
    e.preventDefault(); const d=dateInput.value; attendanceData[d]={}; document.querySelectorAll('.attendance-actions').forEach((btns,idx)=>{ const sel=btns.querySelector('.att-btn[style*="background"]'); attendanceData[d][students[idx].roll]=sel?sel.dataset.code:'A'; }); localStorage.setItem('attendanceData',JSON.stringify(attendanceData));
    // build summary table
    const summaryBody = $('summaryBody'); summaryBody.innerHTML = '';
    students.forEach(s=>{ const code=attendanceData[d][s.roll]||'A'; const map={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}; const tr=document.createElement('tr'); tr.innerHTML=`<td>${s.name}</td><td>${map[code]}</td><td><button class=\"share-one\">Share</button></td>`; tr.querySelector('.share-one').onclick = () => { const hdr=`Date: ${d}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`; const msg=`${hdr}\n\nName: ${s.name}\nStatus: ${map[code]}`; window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`); }; summaryBody.appendChild(tr); });
    $('attendance-section').classList.add('hidden'); $('attendance-result').classList.remove('hidden');
  });
  $('downloadAttendancePDF').addEventListener('click', e => {
    e.preventDefault(); const d=dateInput.value; const doc=new jsPDF('p','pt','a4'); doc.autoTable({ head:[['Name','Status']], body:students.map(s=>{ const code=attendanceData[d]?.[s.roll]||'A'; return [s.name, {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]]; }), startY:40, margin:{left:40,right:40}, styles:{fontSize:10} }); doc.save('attendance_summary.pdf'); });

  // ANALYTICS
  const analyticsTarget=$('analyticsTarget'), studentAdmInput=$('studentAdmInput'), analyticsType=$('analyticsType'), analyticsDate=$('analyticsDate'), analyticsMonth=$('analyticsMonth'), semesterStart=$('semesterStart'), semesterEnd=$('semesterEnd'), yearStart=$('yearStart'), loadAnalytics=$('loadAnalytics'), resetAnalytics=$('resetAnalytics'), instructionsEl=$('instructions'), analyticsContainer=$('analyticsContainer'), graphsEl=$('graphs'), analyticsActions=$('analyticsActions'), shareAnalyticsBtn=$('shareAnalytics'), downloadAnalyticsBtn=$('downloadAnalytics');
  let barChart, pieChart;
  analyticsTarget.addEventListener('change',()=>{ studentAdmInput.classList.toggle('hidden',analyticsTarget.value==='class'); });
  analyticsType.addEventListener('change',()=>{ [analyticsDate,analyticsMonth,semesterStart,semesterEnd,yearStart].forEach(el=>el.classList.add('hidden')); if(analyticsType.value==='date')analyticsDate.classList.remove('hidden'); if(analyticsType.value==='month')analyticsMonth.classList.remove('hidden'); if(analyticsType.value==='semester'){semesterStart.classList.remove('hidden');semesterEnd.classList.remove('hidden');} if(analyticsType.value==='year')yearStart.classList.remove('hidden'); resetAnalytics.classList.remove('hidden'); });
  loadAnalytics.addEventListener('click',e=>{
    e.preventDefault(); let from,to; if(analyticsType.value==='date'){if(!analyticsDate.value){alert('Pick date');return;} from=to=analyticsDate.value;} else if(analyticsType.value==='month'){if(!analyticsMonth.value){alert('Pick month');return;} const [y,m]=analyticsMonth.value.split('-').map(Number); from=`${analyticsMonth.value}-01`; to=`${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;} else if(analyticsType.value==='semester'){if(!semesterStart.value||!semesterEnd.value){alert('Pick range');return;} const [sy,sm]=semesterEnd.value.split('-').map(Number); from=`${semesterStart.value}-01`; to=`${semesterEnd.value}-${new Date(sy,sm,0).getDate()}`;} else if(analyticsType.value==='year'){if(!yearStart.value){alert('Pick year');return;} from=`${yearStart.value}-01-01`; to=`${yearStart.value}-12-31`;} else{alert('Select period');return;}
    const stats = analyticsTarget.value==='class' ? students.map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0})) : (()=>{ const adm=studentAdmInput.value.trim(); if(!adm){alert('Enter Adm#');return;} const stud=students.find(s=>s.adm===adm); if(!stud){alert(`No student with Adm#: ${adm}`);return;} return [{name:stud.name,roll:stud.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}]; })();
    Object.entries(attendanceData).forEach(([d,recs])=>{ const cd=new Date(d); if(cd>=new Date(from)&&cd<=new Date(to)) stats.forEach(st=>{ const c=recs[st.roll]||'A'; st[c]++; st.total++; }); });
    analyticsContainer.innerHTML=`<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>${stats.map(s=>{const pct=s.total?((s.P/s.total)*100).toFixed(1):'0.0';return`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`}).join('')}</tbody></table>`;
    instructionsEl.textContent=`Report:
