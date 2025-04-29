// app.js
eruda.init(); // debug

(async()=> {
  const { get, set } = idbKeyval;
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;
  let lastShareText  = '', lastAnalyticsShare='';

  const saveStudents       = ()=>set('students', students);
  const saveAttendanceData = ()=>set('attendanceData', attendanceData);
  const saveLastAdmNo      = ()=>set('lastAdmissionNo', lastAdmNo);
  async function generateAdmNo(){ lastAdmNo++; await saveLastAdmNo(); return String(lastAdmNo).padStart(4,'0'); }
  const $=id=>document.getElementById(id), show=(...e)=>e.forEach(el=>el?.classList.remove('hidden')), hide=(...e)=>e.forEach(el=>el?.classList.add('hidden'));

  // 1. SETUP
  async function loadSetup(){
    const [school,cls,sec]=await Promise.all([get('schoolName'),get('teacherClass'),get('teacherSection')]);
    if(school&&cls&&sec){
      $('#schoolNameInput').value=school;
      $('#teacherClassSelect').value=cls;
      $('#teacherSectionSelect').value=sec;
      $('#setupText').textContent=`${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      hide($('#setupForm')); show($('#setupDisplay'));
    }
    renderStudents(); updateCounters();
  }
  $('#saveSetup').onclick=async e=>{e.preventDefault();
    const school=$('#schoolNameInput').value.trim(),cls=$('#teacherClassSelect').value,sec=$('#teacherSectionSelect').value;
    if(!school||!cls||!sec)return alert('Complete setup');
    await Promise.all([set('schoolName',school),set('teacherClass',cls),set('teacherSection',sec)]);
    await loadSetup();
  };
  $('#editSetup').onclick=e=>{e.preventDefault();show($('#setupForm'));hide($('#setupDisplay'));};
  await loadSetup();

  // 2. COUNTERS
  function animateCounters(){document.querySelectorAll('.number').forEach(span=>{const target=+span.dataset.target;let c=0,step=Math.max(1,target/100);(function u(){c+=step;span.textContent=c<target?Math.ceil(c):target;if(c<target)requestAnimationFrame(u)})();});}
  function updateCounters(){const cls=$('#teacherClassSelect').value,sec=$('#teacherSectionSelect').value;$('#sectionCount').dataset.target=students.filter(s=>s.cls===cls&&s.sec===sec).length;$('#classCount').dataset.target=students.filter(s=>s.cls===cls).length;$('#schoolCount').dataset.target=students.length;animateCounters();}
  $('#teacherClassSelect').onchange=()=>{renderStudents();updateCounters();};
  $('#teacherSectionSelect').onchange=()=>{renderStudents();updateCounters();};

  // 3. STUDENT REGISTRATION
  function renderStudents(){
    const cls=$('#teacherClassSelect').value,sec=$('#teacherSectionSelect').value;
    const tbody=$('#studentsBody');tbody.innerHTML='';
    students.filter(s=>s.cls===cls&&s.sec===sec).forEach((stu,i)=>{
      const tr=document.createElement('tr');tr.dataset.index=i;
      tr.innerHTML=`<td><input type="checkbox" class="sel"></td><td>${i+1}</td><td>${stu.name}</td><td>${stu.adm}</td><td>${stu.parent}</td><td>${stu.contact}</td><td>${stu.occupation}</td><td>${stu.address}</td><td>${$('#shareRegistration').classList.contains('hidden')?'':`<i class="fas fa-share-alt share-row" data-index="${i}"></i>`}</td>`;
      tbody.appendChild(tr);
    });
    $('#selectAllStudents').checked=false;toggleButtons();
    document.querySelectorAll('.share-row').forEach(icon=>icon.onclick=()=>{const s=students[+icon.dataset.index];const msg=`*${s.name}*\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');});
  }
  function toggleButtons(){const any=!!document.querySelector('.sel:checked');$('#editSelected').disabled=!any;$('#deleteSelected').disabled=!any;}
  $('#studentsBody').addEventListener('change',e=>e.target.classList.contains('sel')&&toggleButtons());
  $('#selectAllStudents').onclick=()=>{document.querySelectorAll('.sel').forEach(cb=>cb.checked=$('#selectAllStudents').checked);toggleButtons();};
  $('#addStudent').onclick=async e=>{e.preventDefault();const name=$('#studentName').value.trim(),parent=$('#parentName').value.trim(),contact=$('#parentContact').value.trim(),occupation=$('#parentOccupation').value.trim(),address=$('#parentAddress').value.trim(),cls=$('#teacherClassSelect').value,sec=$('#teacherSectionSelect').value;if(!name||!parent||!contact||!occupation||!address)return alert('All required');if(!/^\d{7,15}$/.test(contact))return alert('Contact 7–15 digits');const adm=await generateAdmNo();students.push({name,adm,parent,contact,occupation,address,cls,sec});await saveStudents();renderStudents();updateCounters();['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');};
  $('#deleteSelected').onclick=async()=>{if(!confirm('Delete?'))return;const toDel=Array.from(document.querySelectorAll('.sel:checked')).map(cb=>+cb.closest('tr').dataset.index);students=students.filter((_,i)=>!toDel.includes(i));await saveStudents();renderStudents();updateCounters();};
  $('#editSelected').onclick=()=>{document.querySelectorAll('.sel:checked').forEach(cb=>{const tr=cb.closest('tr'),i=+tr.dataset.index,s=students[i];tr.innerHTML=`<td><input type="checkbox" class="sel" checked></td><td>${i+1}</td><td><input value="${s.name}"></td><td>${s.adm}</td><td><input value="${s.parent}"></td><td><input value="${s.contact}"></td><td><input value="${s.occupation}"></td><td><input value="${s.address}"></td><td></td>`;});hide($('#editSelected'),$('#deleteSelected'));show($('#doneEditing'));};
  $('#doneEditing').onclick=async()=>{document.querySelectorAll('#studentsBody tr').forEach(tr=>{const inputs=tr.querySelectorAll('input:not(.sel)');if(inputs.length===5){const [name,parent,contact,occupation,address]=Array.from(inputs).map(i=>i.value.trim());const adm=tr.children[3].textContent,idx=students.findIndex(s=>s.adm===adm);idx>-1&&(students[idx]={...students[idx],name,parent,contact,occupation,address});}});await saveStudents();hide($('#doneEditing'));show($('#editSelected'),$('#deleteSelected'),$('#saveRegistration'));renderStudents();updateCounters();};
  $('#saveRegistration').onclick=async()=>{await saveStudents();hide($('#editSelected'),$('#deleteSelected'),$('#selectAllStudents'),$('#saveRegistration'));show($('#shareRegistration'),$('#downloadRegistrationPDF'));renderStudents();};
  $('#shareRegistration').onclick=()=>{const cls=$('#teacherClassSelect').value,sec=$('#teacherSectionSelect').value,header=`*Students List*\nClass ${cls} Section ${sec}`,lines=students.filter(s=>s.cls===cls&&s.sec===sec).map(s=>`*${s.name}*\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`).join('\n\n');lastShareText=header+'\n\n'+lines;window.open(`https://wa.me/?text=${encodeURIComponent(lastShareText)}`,'_blank');};
  $('#downloadRegistrationPDF').onclick=()=>{const doc=new jsPDF();doc.autoTable({html:'#studentsTable'});doc.save('registration.pdf');};

  // 4. MARK ATTENDANCE (identical to above)

  // 6. ATTENDANCE REGISTER
  const loadRegisterBtn=$('#loadRegister'),changeRegisterBtn=$('#changeRegister'),downloadRegister=$('#downloadRegister'),shareRegister=$('#shareRegister'),monthInput=$('#registerMonth'),registerHeader=$('#registerHeader'),registerBody=$('#registerBody');
  const regCodes=['A','P','Lt','HD','L'],regColors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};
  loadRegisterBtn.onclick=()=>{
    const m=monthInput.value; if(!m){alert('Select month');return;}
    const [y,mm]=m.split('-').map(Number),days=new Date(y,mm,0).getDate();
    registerHeader.innerHTML='<th>#</th><th>Adm#</th><th>Name</th>'+Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    registerBody.innerHTML='';
    students.forEach((s,i)=>{const tr=document.createElement('tr');let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;for(let d=0;d<days;d++)row+=`<td class="reg-cell"><span class="status-text">A</span></td>`;tr.innerHTML=row;registerBody.appendChild(tr);});
    document.querySelectorAll('.reg-cell').forEach(cell=>{const span=cell.querySelector('.status-text');cell.onclick=()=>{let idx=regCodes.indexOf(span.textContent);idx=(idx+1)%regCodes.length;const c=regCodes[idx];span.textContent=c;if(c==='A'){cell.style.background='';cell.style.color='';}else{cell.style.background=regColors[c];cell.style.color='#fff';}};});
    show($('#registerTableWrapper'),changeRegisterBtn,downloadRegister,shareRegister);hide(loadRegisterBtn);
  };
  changeRegisterBtn.onclick=()=>{hide($('#registerTableWrapper'),changeRegisterBtn,downloadRegister,shareRegister);show(loadRegisterBtn);};
  downloadRegister.onclick=()=>{const doc=new jsPDF();doc.autoTable({html:'#registerTable'});doc.save('attendance_register.pdf');};
  shareRegister.onclick=()=>{const hdr=`Attendance Register: ${monthInput.value}`,rows=Array.from(registerBody.querySelectorAll('tr')).map(tr=>Array.from(tr.querySelectorAll('td')).map(td=>td.querySelector('.status-text')?td.querySelector('.status-text').textContent.trim():td.textContent.trim()).join(' '));window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`,'_blank');};

  // service worker
  if('serviceWorker' in navigator)navigator.serviceWorker.register('service-worker.js').catch(console.error);
})();
