// app.js
// ===== indexeddb setup (using idb) =====
const dbPromise = idb.openDB('attendance-db', 1, {
  upgrade(db) {
    db.createObjectStore('settings');                     
    db.createObjectStore('students', { keyPath: 'adm' }); 
    db.createObjectStore('attendance');                   
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
// ========================================

window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const colors = { P: '#4CAF50', A: '#f44336', Lt: '#FFEB3B', HD: '#FF9800', L: '#03a9f4' };

  // 1. SETUP
  const schoolIn = $('schoolNameInput');
  const classSel = $('teacherClassSelect');
  const secSel   = $('teacherSectionSelect');
  const saveSetup = $('saveSetup');
  const setupForm = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText = $('setupText');
  const editSetup = $('editSetup');

  async function loadSetup() {
    const school = await getSetting('schoolName');
    const cls    = await getSetting('teacherClass');
    const sec    = await getSetting('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value   = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value)
      return alert('Complete setup');
    await setSetting('schoolName', schoolIn.value);
    await setSetting('teacherClass', classSel.value);
    await setSetting('teacherSection', secSel.value);
    loadSetup();
  };

  editSetup.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };

  await loadSetup();

  // 2. STUDENT REGISTRATION
  let students = await getAllStudents();
  const studentNameIn    = $('studentName');
  const admissionNoIn    = $('admissionNo');
  const parentNameIn     = $('parentName');
  const parentContactIn  = $('parentContact');
  const parentOccIn      = $('parentOccupation');
  const parentAddrIn     = $('parentAddress');
  const addStudentBtn    = $('addStudent');
  const studentsBody     = $('studentsBody');
  const selectAll        = $('selectAllStudents');
  const editSelBtn       = $('editSelected');
  const deleteSelBtn     = $('deleteSelected');
  const saveRegBtn       = $('saveRegistration');
  const shareRegBtn      = $('shareRegistration');
  const editRegBtn       = $('editRegistration');
  const downloadRegBtn   = $('downloadRegistrationPDF');
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
    selectAll.disabled = regSaved;
    selectAll.onchange = () => {
      if (!regSaved) boxes.forEach(cb => {
        cb.checked = selectAll.checked;
        cb.dispatchEvent(new Event('change'));
      });
    };
  }

  async function renderStudents() {
    students = await getAllStudents();
    studentsBody.innerHTML = '';
    students.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-adm="${s.adm}" ${regSaved ? 'disabled' : ''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved ? '<button class="share-one">Share</button>' : ''}</td>`;
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }

  addStudentBtn.onclick = async e => {
    e.preventDefault();
    const name    = studentNameIn.value.trim();
    const adm     = admissionNoIn.value.trim();
    const parent  = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occ     = parentOccIn.value.trim();
    const addr    = parentAddrIn.value.trim();
    if (!name||!adm||!parent||!contact||!occ||!addr)
      return alert('All fields required');
    if (!/^\d+$/.test(adm)) return alert('Adm# must be numeric');
    if (students.some(s => s.adm===adm))
      return alert(`Admission# ${adm} already exists`);
    if (!/^\d{7,15}$/.test(contact))
      return alert('Contact must be 7-15 digits');
    await saveStudent({ name, adm, parent, contact, occupation: occ, address: addr });
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn]
      .forEach(i => i.value='');
    await renderStudents();
  };

  deleteSelBtn.onclick = async e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    const toDelete = Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb => cb.dataset.adm);
    for (let adm of toDelete) {
      await deleteStudent(adm);
    }
    await renderStudents();
  };

  saveRegBtn.onclick = e => {
    e.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id => $(id).classList.remove('hidden'));
  };

  editRegBtn.onclick = e => {
    e.preventDefault();
    regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id => $(id).classList.add('hidden'));
  };

  await renderStudents();

  // 3. ATTENDANCE MARKING & SUMMARY, 4. ANALYTICS, 5. REGISTER
  // ... (apply same IndexedDB calls in those sections)

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js');
    });
  }
});
