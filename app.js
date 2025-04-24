// app.js
// ===== IndexedDB setup (using idb) =====
// Make sure you’ve included in index.html:
// <script src="https://unpkg.com/idb/build/iife/index-min.js"></script>

const dbPromise = idb.openDB('attendance-db', 1, {
  upgrade(db) {
    db.createObjectStore('settings');                     // key → simple values
    db.createObjectStore('students', { keyPath: 'adm' }); // key = admission #
    db.createObjectStore('attendance');                   // date → { adm: code }
  }
});

async function getSetting(key) {
  return (await dbPromise).get('settings', key);
}
async function setSetting(key, value) {
  return (await dbPromise).put('settings', value, key);
}
async function getAllStudents() {
  return (await dbPromise).getAll('students');
}
async function saveStudent(obj) {
  return (await dbPromise).put('students', obj);
}
async function deleteStudent(adm) {
  return (await dbPromise).delete('students', adm);
}
async function getAttendance(date) {
  return (await dbPromise).get('attendance', date) || {};
}
async function saveAttendance(date, data) {
  return (await dbPromise).put('attendance', data, date);
}
async function getAllAttendanceDates() {
  return (await dbPromise).getAllKeys('attendance');
}
// ========================================

window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // 1. SETUP
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
    if (!schoolIn.value || !classSel.value || !secSel.value) {
      alert('Complete setup');
      return;
    }
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

  // 2. STUDENT REGISTRATION
  let students = await getAllStudents();
  const studentNameIn    = $('studentName'),
        admissionNoIn    = $('admissionNo'),
        parentNameIn     = $('parentName'),
        parentContactIn  = $('parentContact'),
        parentOccIn      = $('parentOccupation'),
        parentAddrIn     = $('parentAddress'),
        addStudentBtn    = $('addStudent'),
        studentsBody     = $('studentsBody'),
        selectAllCb      = $('selectAllStudents'),
        editSelBtn       = $('editSelected'),
        deleteSelBtn     = $('deleteSelected'),
        saveRegBtn       = $('saveRegistration'),
        shareRegBtn      = $('shareRegistration'),
        editRegBtn       = $('editRegistration'),
        downloadRegBtn   = $('downloadRegistrationPDF');

  let regSaved = false, inlineEdit = false;

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
      if (!regSaved) {
        boxes.forEach(cb => {
          cb.checked = selectAllCb.checked;
          cb.dispatchEvent(new Event('change'));
        });
      }
    };
  }

  async function renderStudents() {
    students = await getAllStudents();
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
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
    const name    = studentNameIn.value.trim(),
          adm     = admissionNoIn.value.trim(),
          parent  = parentNameIn.value.trim(),
          contact = parentContactIn.value.trim(),
          occ     = parentOccIn.value.trim(),
          addr    = parentAddrIn.value.trim();
    if (!name||!adm||!parent||!contact||!occ||!addr) {
      alert('All fields required');
      return;
    }
    if (!/^\d+$/.test(adm)) { alert('Adm# must be numeric'); return; }
    if (students.some(s=>s.adm===adm)) { alert('Admission# already exists'); return; }
    if (!/^\d{7,15}$/.test(contact)) { alert('Contact must be 7-15 digits'); return; }
    await saveStudent({ name, adm, parent, contact, occupation: occ, address: addr });
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn].forEach(i=>i.value='');
    await renderStudents();
  };

  editSelBtn.onclick = e => {
    e.preventDefault();
    inlineEdit = !inlineEdit;
    editSelBtn.textContent = inlineEdit?'Done Editing':'Edit Selected';
    document.querySelectorAll('.sel:checked').forEach(cb => {
      const tr = cb.closest('tr');
      tr.querySelectorAll('td').forEach((td, ci) => {
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          if (inlineEdit) td.addEventListener('blur', onCellBlur);
          else td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  async function onCellBlur(e) {
    const td = e.target, tr = td.closest('tr');
    const admKey = tr.querySelector('.sel').dataset.adm;
    const ci = Array.from(tr.children).indexOf(td);
    const keys = ['name','adm','parent','contact','occupation','address'];
    const val = td.textContent.trim();
    if (ci===2) {
      if (!/^\d+$/.test(val)) { alert('Adm# must be numeric'); await renderStudents(); return; }
      if (students.some(s=>s.adm===val && s.adm!==admKey)) { alert('Duplicate Adm#'); await renderStudents(); return; }
    }
    const student = (await getAllStudents()).find(s=>s.adm===admKey);
    student[keys[ci-1]] = val;
    if (ci===2) {
      await deleteStudent(admKey);
      await saveStudent(student);
    } else {
      await saveStudent(student);
    }
    await renderStudents();
  }

  deleteSelBtn.onclick = async e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    const toDelete = Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb=>cb.dataset.adm);
    for (let adm of toDelete) await deleteStudent(adm);
    await renderStudents();
    selectAllCb.checked = false;
  };

  saveRegBtn.onclick = e => {
    e.preventDefault();
    regSaved = true;
    renderStudents();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id=>$(id).classList.remove('hidden'));
  };

  editRegBtn.onclick = async e => {
    e.preventDefault();
    regSaved = false;
    renderStudents();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id=>$(id).classList.add('hidden'));
  };

  shareRegBtn.onclick = () => {
    const hdr = `School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines = students.map(s=>`Name: ${s.name}, Adm#: ${s.adm}, Parent: ${s.parent}, Contact: ${s.contact}, Occupation: ${s.occupation}, Address: ${s.address}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`, '_blank');
  };

  downloadRegBtn.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Student Registration',10,10);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`,10,20);
    doc.text(`School: ${schoolIn.value}`,10,26);
    doc.text(`Class: ${classSel.value}`,10,32);
    doc.text(`Section: ${secSel.value}`,10,38);
    doc.autoTable({
      head:[['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY:44
    });
    doc.save('student_registration.pdf');
  };

  await renderStudents();

  // 3. ATTENDANCE MARKING & SUMMARY
  const dateInput            = $('dateInput'),
        loadAttBtn           = $('loadAttendance'),
        attList              = $('attendanceList'),
        saveAttBtn           = $('saveAttendance'),
        resultSection        = $('attendance-result'),
        summaryBody          = $('summaryBody'),
        shareAttendanceBtn   = $('shareAttendanceSummary'),
        downloadAttendanceBtn= $('downloadAttendancePDF');

  let attendanceData = await (async()=>{
    const all = await dbPromise;
    const val = await all.get('attendance', '__all__');
    return val || {};
  })();

  loadAttBtn.onclick = async () => {
    if (!dateInput.value) return alert('Pick a date');
    attList.innerHTML = '';
    const recs = await getAttendance(dateInput.value);
    students = await getAllStudents();
    students.forEach(s=>{
      const row = document.createElement('div');
      row.className='attendance-item'; row.textContent=s.name;
      const btns = document.createElement('div'); btns.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b = document.createElement('button');
        b.textContent=code; b.className='att-btn';
        if (recs[s.adm]===code) { b.style.background=colors[code]; b.style.color='#fff'; }
        b.onclick = () => {
          btns.querySelectorAll('.att-btn').forEach(x=>{ x.style.background=''; x.style.color='#333'; });
          b.style.background=colors[code]; b.style.color='#fff';
        };
        btns.append(b);
      });
      attList.append(row, btns);
    });
    saveAttBtn.classList.remove('hidden');
  };

  saveAttBtn.onclick = async () => {
    const d = dateInput.value;
    const data = {};
    attList.querySelectorAll('.attendance-actions').forEach((btns,i)=>{
      const sel = btns.querySelector('.att-btn[style*="background"]');
      data[students[i].adm] = sel?sel.textContent:'A';
    });
    await saveAttendance(d, data);
    resultSection.classList.remove('hidden');
    summaryBody.innerHTML='';
    const hdr = `Date: ${d}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    students.forEach(s=>{
      const code = data[s.adm]||'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick = () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+s.name+': '+status)}`, '_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  shareAttendanceBtn.onclick = () => {
    const d = dateInput.value;
    const hdr = `Date: ${d}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines = students.map(s=>{
      const code = (attendanceData[d]||{})[s.adm]||'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      return `${s.name}: ${status}`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`, '_blank');
  };

  downloadAttendanceBtn.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const d = dateInput.value;
    doc.setFontSize(16); doc.text('Attendance Summary',10,10);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date(d).toLocaleDateString()}`,10,20);
    doc.text(`School: ${schoolIn.value}`,10,26);
    doc.text(`Class: ${classSel.value}`,10,32);
    doc.text(`Section: ${secSel.value}`,10,38);
    doc.autoTable({
      head:[['Name','Status']],
      body: students.map(s=>{
        const code = (attendanceData[d]||{})[s.adm]||'A';
        const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
        return [s.name,status];
      }),
      startY:44
    });
    doc.save('attendance_summary.pdf');
  };

  // 4. ANALYTICS and 5. REGISTER share/download logic
  // ... (similar swap of getAttendance calls)

  // Service Worker registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
  }
});
