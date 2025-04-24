// app.js

// Wait for DOM
window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // ===== IndexedDB setup (idb) =====
  const db = await idb.openDB('attendance-db', 1, {
    upgrade(db) {
      db.createObjectStore('settings');
      db.createObjectStore('students', { keyPath: 'adm' });
      db.createObjectStore('attendance');
    }
  });
  const getSetting = async k => db.get('settings', k);
  const setSetting = async (k,v) => db.put('settings', v, k);
  const getAllStudents = async () => db.getAll('students');
  const saveStudent     = async s => db.put('students', s);
  const deleteStudent   = async a => db.delete('students', a);
  const getAttendance   = async d => (await db.get('attendance', d)) || {};
  const saveAttendance  = async (d,data) => db.put('attendance', data, d);
  const getAttendanceDates = async () => db.getAllKeys('attendance');

  // ===== 1. Setup =====
  const schoolIn = $('schoolNameInput'),
        classSel = $('teacherClassSelect'),
        secSel   = $('teacherSectionSelect'),
        saveSetup= $('saveSetup'),
        setupForm= $('setupForm'),
        setupDisp= $('setupDisplay'),
        setupTxt = $('setupText'),
        editSetup= $('editSetup');

  async function loadSetup(){
    const s = await getSetting('schoolName'),
          c = await getSetting('teacherClass'),
          e = await getSetting('teacherSection');
    if(s && c && e){
      schoolIn.value=s; classSel.value=c; secSel.value=e;
      setupTxt.textContent=`${s} 🏫 | Class: ${c} | Section: ${e}`;
      setupForm.classList.add('hidden');
      setupDisp.classList.remove('hidden');
    }
  }
  saveSetup.onclick = async e => {
    e.preventDefault();
    if(!schoolIn.value||!classSel.value||!secSel.value) return alert('Complete setup');
    await setSetting('schoolName', schoolIn.value);
    await setSetting('teacherClass', classSel.value);
    await setSetting('teacherSection', secSel.value);
    await loadSetup();
  };
  editSetup.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisp.classList.add('hidden');
  };
  await loadSetup();

  // ===== 2. Student Registration =====
  let students = await getAllStudents(), regSaved=false;
  const studentNameIn   = $('studentName'),
        admissionNoIn   = $('admissionNo'),
        parentNameIn    = $('parentName'),
        parentContactIn = $('parentContact'),
        parentOccIn     = $('parentOccupation'),
        parentAddrIn    = $('parentAddress'),
        addStudentBtn   = $('addStudent'),
        studentsBody    = $('studentsBody'),
        selectAllCb     = $('selectAllStudents'),
        editSelBtn      = $('editSelected'),
        deleteSelBtn    = $('deleteSelected'),
        saveRegBtn      = $('saveRegistration'),
        shareRegBtn     = $('shareRegistration'),
        editRegBtn      = $('editRegistration'),
        dlRegBtn        = $('downloadRegistrationPDF');

  function bindSelection(){
    const boxes=[...document.querySelectorAll('.sel')];
    boxes.forEach(cb=>{
      cb.onchange=()=>{
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any=boxes.some(x=>x.checked);
        editSelBtn.disabled=deleteSelBtn.disabled=!any;
      };
    });
    selectAllCb.disabled=regSaved;
    selectAllCb.onchange=()=>boxes.forEach(cb=>{
      cb.checked=selectAllCb.checked; cb.dispatchEvent(new Event('change'));
    });
  }
  async function renderStudents(){
    students = await getAllStudents();
    studentsBody.innerHTML='';
    students.forEach(s=>{
      const tr=document.createElement('tr');
      tr.innerHTML=
        `<td><input type="checkbox" class="sel" data-adm="${s.adm}" ${regSaved?'disabled':''}></td>`+
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>`+
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>`+
        `<td>${regSaved?'<button class="share-one">Share</button>':''}</td>`;
      if(regSaved){
        tr.querySelector('.share-one').onclick=()=>{
          const hdr=`School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
          const msg=`${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }
  addStudentBtn.onclick = async e => {
    e.preventDefault();
    const obj={
      name: studentNameIn.value.trim(),
      adm: admissionNoIn.value.trim(),
      parent: parentNameIn.value.trim(),
      contact: parentContactIn.value.trim(),
      occupation: parentOccIn.value.trim(),
      address: parentAddrIn.value.trim()
    };
    if(!obj.name||!obj.adm||!obj.parent||!obj.contact||!obj.occupation||!obj.address)
      return alert('All fields required');
    if(!/^\d+$/.test(obj.adm)) return alert('Adm# numeric');
    if(students.some(x=>x.adm===obj.adm)) return alert('Adm# exists');
    if(!/^\d{7,15}$/.test(obj.contact)) return alert('Contact 7–15 digits');
    await saveStudent(obj);
    [studentNameIn,admissionNoIn,parentNameIn,parentContactIn,parentOccIn,parentAddrIn].forEach(i=>i.value='');
    await renderStudents();
  };
  saveRegBtn.onclick=e=>{
    e.preventDefault();
    regSaved=true; renderStudents();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.remove('hidden'));
  };
  editRegBtn.onclick=e=>{
    e.preventDefault();
    regSaved=false; renderStudents();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.add('hidden'));
  };
  shareRegBtn.onclick=()=>{
    const hdr=`School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines=students.map(s=>`Name:${s.name},Adm#:${s.adm}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`, '_blank');
  };
  dlRegBtn.onclick=()=>{
    const { jsPDF }=window.jspdf, doc=new jsPDF();
    doc.text('Student Registration',10,10);
    doc.autoTable({ head:[['Name','Adm#','Parent','Contact','Occ','Addr']],
      body: students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]), startY:20});
    doc.save('student_registration.pdf');
  };
  deleteSelBtn.onclick=async()=>{
    const toDel=[...document.querySelectorAll('.sel:checked')].map(cb=>cb.dataset.adm);
    for(let a of toDel) await deleteStudent(a);
    await renderStudents();
  };
  await renderStudents();

  // ===== 3. Attendance =====
  const dateIn=$('dateInput'), loadAtt=$('loadAttendance'), attList=$('attendanceList'),
        saveAtt=$('saveAttendance'), resSec=$('attendance-result'), sumBody=$('summaryBody'),
        shareAtt=$('shareAttendanceSummary'), dlAtt=$('downloadAttendancePDF');
  loadAtt.onclick=async()=>{
    if(!dateIn.value) return alert('Pick date');
    attList.innerHTML='';
    const recs=await getAttendance(dateIn.value);
    students=await getAllStudents();
    students.forEach(s=>{
      const row=document.createElement('div'); row.textContent=s.name; row.className='attendance-item';
      const btns=document.createElement('div'); btns.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(c=>{
        const b=document.createElement('button'); b.textContent=c; b.className='att-btn';
        if(recs[s.adm]===c){ b.style.background=colors[c]; b.style.color='#fff'; }
        b.onclick=()=>{
          btns.querySelectorAll('.att-btn').forEach(x=>{x.style.background='';x.style.color='#333';});
          b.style.background=colors[c]; b.style.color='#fff';
        };
        btns.append(b);
      });
      attList.append(row,btns);
    });
    saveAtt.classList.remove('hidden');
  };
  saveAtt.onclick=async()=>{
    const d=dateIn.value, data={};
    attList.querySelectorAll('.attendance-actions').forEach((btns,i)=>{
      const sel=btns.querySelector('.att-btn[style*="background"]');
      data[students[i].adm]=sel?sel.textContent:'A';
    });
    await saveAttendance(d,data);
    resSec.classList.remove('hidden'); sumBody.innerHTML='';
    const hdr=`Date:${d}\nSchool:${schoolIn.value}`;
    students.forEach(s=>{
      const st={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[data[s.adm]||'A'];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${st}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+s.name+': '+st)}`,'_blank');
      sumBody.appendChild(tr);
    });
  };
  shareAtt.onclick=()=>{/* same pattern */};
  dlAtt.onclick=()=>{/* same pattern */};

  // ===== 4. Analytics & 5. Register =====
  // Implement loadAnalytics, downloadAnalytics, loadRegister, downloadRegister identically using idb and Chart.js/jsPDF

  // ===== Service Worker =====
  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js'));
  }
});
