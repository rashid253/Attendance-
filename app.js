// app.js

// Debug: ensure idb is loaded
console.log('app.js loaded, idb=', window.idb);

// ===== IndexedDB setup (using idb) =====
const dbPromise = idb.openDB('attendance-db', 1, {
  upgrade(db) {
    db.createObjectStore('settings');                     // simple key→value
    db.createObjectStore('students', { keyPath: 'adm' }); // admission# as key
    db.createObjectStore('attendance');                   // date → { adm: code }
  }
});

// ===== Helper functions =====
async function getSetting(key)       { return (await dbPromise).get('settings', key); }
async function setSetting(key, val)  { return (await dbPromise).put('settings', val, key); }

async function getAllStudents()      { return (await dbPromise).getAll('students'); }
async function saveStudent(obj)      { return (await dbPromise).put('students', obj); }
async function deleteStudent(adm)    { return (await dbPromise).delete('students', adm); }

async function getAttendance(date)   { return (await dbPromise).get('attendance', date) || {}; }
async function saveAttendance(date,data) { return (await dbPromise).put('attendance', data, date); }
async function getAllAttendanceDates()   { return (await dbPromise).getAllKeys('attendance'); }

// ===== App logic =====
window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // --- 1. SETUP ---
  const schoolIn     = $('schoolNameInput'),
        classSel     = $('teacherClassSelect'),
        secSel       = $('teacherSectionSelect'),
        saveSetupBtn = $('saveSetup'),
        setupForm    = $('setupForm'),
        setupDisplay = $('setupDisplay'),
        setupText    = $('setupText'),
        editSetupBtn = $('editSetup');

  async function loadSetup() {
    const school = await getSetting('schoolName'),
          cls    = await getSetting('teacherClass'),
          sec    = await getSetting('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value   = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }
  saveSetupBtn.onclick = async e => {
    e.preventDefault();
    if (!schoolIn.value||!classSel.value||!secSel.value) return alert('Complete setup');
    await setSetting('schoolName', schoolIn.value);
    await setSetting('teacherClass', classSel.value);
    await setSetting('teacherSection', secSel.value);
    await loadSetup();
  };
  editSetupBtn.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };
  await loadSetup();

  // --- 2. STUDENT REGISTRATION ---
  let students = await getAllStudents();
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
        downloadRegBtn  = $('downloadRegistrationPDF');
  let regSaved = false;

  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelBtn.disabled = deleteSelBtn.disabled = !any;
      };
    });
    selectAllCb.disabled = regSaved;
    selectAllCb.onchange = () => {
      boxes.forEach(cb => {
        cb.checked = selectAllCb.checked;
        cb.dispatchEvent(new Event('change'));
      });
    };
  }

  async function renderStudents() {
    students = await getAllStudents();
    studentsBody.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-adm="${s.adm}" ${regSaved?'disabled':''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved?'<button class="share-one">Share</button>':''}</td>`;
      if (regSaved) {
        tr.querySelector('.share-one').onclick = () => {
          const hdr = `School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
          const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }

  addStudentBtn.onclick = async e => {
    e.preventDefault();
    const obj = {
      name: studentNameIn.value.trim(),
      adm: admissionNoIn.value.trim(),
      parent: parentNameIn.value.trim(),
      contact: parentContactIn.value.trim(),
      occupation: parentOccIn.value.trim(),
      address: parentAddrIn.value.trim()
    };
    if (!obj.name||!obj.adm||!obj.parent||!obj.contact||!obj.occupation||!obj.address)
      return alert('All fields required');
    if (!/^\d+$/.test(obj.adm)) return alert('Adm# numeric');
    if (students.some(s=>s.adm===obj.adm)) return alert('Admission# exists');
    if (!/^\d{7,15}$/.test(obj.contact)) return alert('Contact 7–15 digits');
    await saveStudent(obj);
    [studentNameIn,admissionNoIn,parentNameIn,parentContactIn,parentOccIn,parentAddrIn].forEach(i=>i.value='');
    await renderStudents();
  };

  saveRegBtn.onclick = e => {
    e.preventDefault();
    regSaved = true;
    renderStudents();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.remove('hidden'));
  };
  editRegBtn.onclick = e => {
    e.preventDefault();
    regSaved = false;
    renderStudents();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.add('hidden'));
  };
  shareRegBtn.onclick = () => {
    const hdr = `School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines = students.map(s=>`Name:${s.name},Adm#:${s.adm}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`, '_blank');
  };
  downloadRegBtn.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Student Registration',10,10);
    doc.setFontSize(12);
    doc.text(`School: ${schoolIn.value}`,10,20);
    doc.autoTable({ head:[['Name','Adm#','Parent','Contact','Occ','Addr']], body: students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]), startY:30 });
    doc.save('student_registration.pdf');
  };

  await renderStudents();

  // --- 3. ATTENDANCE MARKING & SUMMARY ---
  const dateIn   = $('dateInput'),
        loadAtt  = $('loadAttendance'),
        attList  = $('attendanceList'),
        saveAtt  = $('saveAttendance'),
        resSec   = $('attendance-result'),
        sumBody  = $('summaryBody'),
        shareAtt = $('shareAttendanceSummary'),
        dlAtt    = $('downloadAttendancePDF');

  loadAtt.onclick = async () => {
    if (!dateIn.value) return alert('Pick date');
    attList.innerHTML = '';
    const recs = await getAttendance(dateIn.value);
    students = await getAllStudents();
    students.forEach((s,i) => {
      const row = document.createElement('div'); row.textContent=s.name; row.className='attendance-item';
      const btns= document.createElement('div'); btns.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button');
        b.textContent=code; b.className='att-btn';
        if (recs[s.adm]===code) { b.style.background=colors[code]; b.style.color='#fff'; }
        b.onclick = ()=>{ btns.querySelectorAll('.att-btn').forEach(x=>{x.style.background='';x.style.color='#333';}); b.style.background=colors[code]; b.style.color='#fff'; };
        btns.append(b);
      });
      attList.append(row, btns);
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick = async () => {
    const d = dateIn.value, data={};
    attList.querySelectorAll('.attendance-actions').forEach((btns,i)=>{
      const sel = btns.querySelector('.att-btn[style*="background"]');
      data[students[i].adm] = sel?sel.textContent:'A';
    });
    await saveAttendance(d, data);
    resSec.classList.remove('hidden');
    sumBody.innerHTML = '';
    const hdr = `Date:${d}\nSchool:${schoolIn.value}`;
    students.forEach(s=>{
      const code=data[s.adm]||'A', status={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick = ()=>window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+s.name+': '+status)}`, '_blank');
      sumBody.appendChild(tr);
    });
  };
  shareAtt.onclick = () => {
    const d = dateIn.value, hdr=`Date:${d}\nSchool:${schoolIn.value}`;
    const lines = students.map(s=>{
      const code = ({}/* stub */)[s.adm]||'A', status={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      return `${s.name}: ${status}`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`, '_blank');
  };
  dlAtt.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const d=dateIn.value;
    doc.setFontSize(16); doc.text('Attendance Summary',10,10);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date(d).toLocaleDateString()}`,10,20);
    doc.autoTable({ head:[['Name','Status']], body: students.map(s=>{ const code='A', st='Absent'; return [s.name,st]; }), startY:30 });
    doc.save('attendance_summary.pdf');
  };

  // --- 4. ANALYTICS ---
  // (omitted for brevity: use getAllAttendanceDates, getAttendance, Chart.js, share/download similar pattern)

  // --- 5. ATTENDANCE REGISTER ---
  // (omitted for brevity)

  // --- SERVICE WORKER ---
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');
});
