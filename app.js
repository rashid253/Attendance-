// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // Eruda
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // idb-keyval
  if (!window.idbKeyval) return;
  const { get,set } = window.idbKeyval;

  // State
  let students = await get('students')||[];
  let attendanceData = await get('attendanceData')||{};
  let lastAdmNo = await get('lastAdmissionNo')||0;

  // Helpers
  const saveStudents = ()=>set('students',students);
  const saveAttendanceData = ()=>set('attendanceData',attendanceData);
  const saveLastAdmNo = ()=>set('lastAdmissionNo',lastAdmNo);
  async function generateAdmNo(){ lastAdmNo++; await saveLastAdmNo(); return String(lastAdmNo).padStart(4,'0'); }
  const $=id=>document.getElementById(id), show=(...els)=>els.forEach(e=>e&&e.classList.remove('hidden')), hide=(...els)=>els.forEach(e=>e&&e.classList.add('hidden'));

  // 1. Setup
  async function loadSetup(){
    const [sch,cls,sec]=await Promise.all([get('schoolName'),get('teacherClass'),get('teacherSection')]);
    if(sch&&cls&&sec){
      $('schoolNameInput').value=sch;$('teacherClassSelect').value=cls;$('teacherSectionSelect').value=sec;
      $('setupText').textContent=`${sch} | Class: ${cls} | Section: ${sec}`;
      hide($('setupForm')); show($('setupDisplay'));
      renderStudents(); updateCounters(); resetViews();
    }
  }
  $('saveSetup').onclick=async e=>{e.preventDefault();const sch=$('schoolNameInput').value.trim(),cls=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;if(!sch||!cls||!sec){alert('Complete');return;}await Promise.all([set('schoolName',sch),set('teacherClass',cls),set('teacherSection',sec)]);loadSetup();};
  $('editSetup').onclick=e=>{e.preventDefault();show($('setupForm'));hide($('setupDisplay'));};
  await loadSetup();

  // 2. Counters
  function animateCounters(){document.querySelectorAll('.number').forEach(span=>{const tgt=+span.dataset.target;let c=0,st=Math.max(1,tgt/100);(function u(){c+=st;span.textContent=c<tgt?Math.ceil(c):tgt;if(c<tgt)requestAnimationFrame(u);}());});}
  function updateCounters(){const cls=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;$('sectionCount').dataset.target=students.filter(s=>s.cls===cls&&s.sec===sec).length;$('classCount').dataset.target=students.filter(s=>s.cls===cls).length;$('schoolCount').dataset.target=students.length;animateCounters();}
  $('teacherClassSelect').onchange=()=>{renderStudents();updateCounters();resetViews();};
  $('teacherSectionSelect').onchange=()=>{renderStudents();updateCounters();resetViews();};

  function resetViews(){hide($('attendanceBody'),$('saveAttendance'),$('resetAttendance'),$('attendanceSummary'),$('downloadAttendancePDF'),$('shareAttendanceSummary'),$('instructions'),$('analyticsContainer'),$('graphs'),$('analyticsActions'),$('registerTableWrapper'),$('changeRegister'),$('saveRegister'),$('downloadRegister'),$('shareRegister'));show($('loadRegister'));}

  // 3. Registration
  const regForm=$('regForm');
  function renderStudents(){const cls=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value,tbody=$('studentsBody');tbody.innerHTML='';let d=0;students.forEach((s,i)=>{if(s.cls!==cls||s.sec!==sec)return;d++;const tr=document.createElement('tr');tr.dataset.index=i;tr.innerHTML=`<td><input type="checkbox" class="sel"></td><td>${d}</td><td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td><td></td>`;tbody.appendChild(tr);});$('selectAllStudents').checked=false;toggleButtons();}
  function toggleButtons(){const any=!!document.querySelector('.sel:checked');$('editSelected').disabled=!any;$('deleteSelected').disabled=!any;}
  $('studentsBody').addEventListener('change',e=>e.target.classList.contains('sel')&&toggleButtons());
  $('selectAllStudents').onclick=()=>{document.querySelectorAll('.sel').forEach(cb=>cb.checked=$('selectAllStudents').checked);toggleButtons();};

  $('addStudent').onclick=async e=>{e.preventDefault();const n=$('studentName').value.trim(),p=$('parentName').value.trim(),c=$('parentContact').value.trim(),o=$('parentOccupation').value.trim(),a=$('parentAddress').value.trim(),cls=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;if(!n||!p||!c||!o||!a){alert('All');return;}if(!/^\d{7,15}$/.test(c)){alert('Contact');return;}const adm=await generateAdmNo();students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls,sec});await saveStudents();renderStudents();updateCounters();resetViews();['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');};

  $('editSelected').onclick=()=>{document.querySelectorAll('.sel:checked').forEach(cb=>{const tr=cb.closest('tr'),i=+tr.dataset.index,s=students[i];tr.innerHTML=`<td><input type="checkbox" class="sel" checked></td><td>${tr.children[1].textContent}</td><td><input value="${s.name}"></td><td>${s.adm}</td><td><input value="${s.parent}"></td><td><input value="${s.contact}"></td><td><input value="${s.occupation}"></td><td><input value="${s.address}"></td><td></td>`;});hide($('editSelected'));show($('doneEditing'));};
  $('doneEditing').onclick=async()=>{document.querySelectorAll('#studentsBody tr').forEach(tr=>{const inp=tr.querySelectorAll('input:not(.sel)');if(inp.length===5){const [n,p,c,o,a]=Array.from(inp).map(i=>i.value.trim()),adm=tr.children[3].textContent,idx=students.findIndex(s=>s.adm===adm);if(idx>-1)students[idx]={...students[idx],name:n,parent:p,contact:c,occupation:o,address:a};}});await saveStudents();hide($('doneEditing'));show($('editSelected'),$('deleteSelected'),$('saveRegistration'));renderStudents();updateCounters();};

  $('deleteSelected').onclick=async()=>{if(!confirm('Del?'))return;const toDel=Array.from(document.querySelectorAll('.sel:checked')).map(cb=>+cb.closest('tr').dataset.index);students=students.filter((_,i)=>!toDel.includes(i));await saveStudents();renderStudents();updateCounters();resetViews();};

  $('saveRegistration').onclick=async()=>{if(!$('doneEditing').classList.contains('hidden')){alert('Finish edit');return;}await saveStudents();hide(regForm,$('editSelected'),$('deleteSelected'),$('selectAllStudents'),$('saveRegistration'));show($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF')); renderStudents();};
  $('editRegistration').onclick=()=>{show(regForm,$('selectAllStudents'),$('editSelected'),$('deleteSelected'),$('saveRegistration'));hide($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF'));renderStudents();};

  // 4. Attendance
  const dateInput=$('dateInput'),loadAttendance=$('loadAttendance'),saveAttendance=$('saveAttendance'),resetAttendance=$('resetAttendance'),downloadAttendancePDF=$('downloadAttendancePDF'),shareAttendanceSummary=$('shareAttendanceSummary'),attendanceBody=$('attendanceBody'),attendanceSummary=$('attendanceSummary');
  const statusNames={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'};

  loadAttendance.onclick=()=>{attendanceBody.innerHTML='';attendanceSummary.innerHTML='';const cls=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;students.filter(s=>s.cls===cls&&s.sec===sec).forEach(stu=>{const row=document.createElement('div');row.className='attendance-row';const nd=document.createElement('div');nd.className='attendance-name';nd.textContent=stu.name;const btns=document.createElement('div');btns.className='attendance-buttons';['P','A','Lt','HD','L'].forEach(code=>{const btn=document.createElement('button');btn.className='att-btn';btn.textContent=code;btn.onclick=()=>{btns.querySelectorAll('.att-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');};btns.appendChild(btn);});row.append(nd,btns);attendanceBody.append(row);});show(attendanceBody,saveAttendance);hide(resetAttendance,downloadAttendancePDF,shareAttendanceSummary,attendanceSummary);};

  saveAttendance.onclick=async()=>{const dt=dateInput.value;if(!dt){alert('Pick date');return;}attendanceData[dt]={};const cls=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;const roster=students.filter(s=>s.cls===cls&&s.sec===sec);roster.forEach((s,i)=>{const btn=attendanceBody.children[i].querySelector('.att-btn.selected');attendanceData[dt][s.adm]=btn?btn.textContent:'A';});await saveAttendanceData();attendanceSummary.innerHTML=`<h3>Date: ${dt}</h3>`;const tbl=document.createElement('table');tbl.innerHTML='<tr><th>Name</th><th>Status</th></tr>';roster.forEach(s=>tbl.innerHTML+=`<tr><td>${s.name}</td><td>${statusNames[attendanceData[dt][s.adm]]}</td></tr>`);attendanceSummary.append(tbl);hide(saveAttendance,attendanceBody);show(resetAttendance,downloadAttendancePDF,shareAttendanceSummary,attendanceSummary);};

  downloadAttendancePDF.onclick=()=>{const dt=dateInput.value,doc=new jspdf.jsPDF();doc.setFontSize(18);doc.text('Attendance Report',14,16);doc.setFontSize(12);doc.text($('setupText').textContent,14,24);if(dt)doc.text(`Date: ${dt}`,14,32);doc.autoTable({startY:dt?40:32,html:'#attendanceSummary table'});for(let i=1;i<=doc.getNumberOfPages();i++){doc.setPage(i);doc.setFontSize(10);doc.text('FAIQTECH SOL',doc.internal.pageSize.getWidth()/2,doc.internal.pageSize.getHeight()-10,{align:'center'});}window.open(doc.output('bloburl'),'_blank');doc.save('attendance_summary.pdf');};

  // 5. Analytics (omitted for brevity)
  // 6. Register (omitted)
});
