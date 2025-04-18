window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // SETUP (unchanged)
  const schoolIn = $('schoolNameInput');
  const classSel = $('teacherClassSelect');
  const secSel = $('teacherSectionSelect');
  const saveSetupBtn = $('saveSetup');
  const setupForm = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText = $('setupText');
  const editSetupBtn = $('editSetup');

  function loadSetup() {
    const school = localStorage.getItem('schoolName');
    const cls = localStorage.getItem('teacherClass');
    const sec = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetupBtn.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };

  editSetupBtn.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };

  loadSetup();

  // STUDENT REGISTRATION (fixed)
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const studentNameIn = $('studentName');
  const admissionNoIn = $('admissionNo');
  const parentNameIn = $('parentName');
  const parentContactIn = $('parentContact');
  const parentOccupationIn = $('parentOccupation');
  const parentAddressIn = $('parentAddress');
  const addStudentBtn = $('addStudent');
  const studentsBody = $('studentsBody');

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = [
        `<td><input type="checkbox" class="sel" data-index="${i}"></td>`,
        `<td>${s.name}</td>`,
        `<td>${s.adm}</td>`,
        `<td>${s.parentName}</td>`,
        `<td>${s.contact}</td>`,
        `<td>${s.occupation}</td>`,
        `<td>${s.address}</td>`,
        `<td><button class="share-one" data-index="${i}">Share</button></td>`
      ].join('');
      studentsBody.appendChild(tr);
    });
    document.querySelectorAll('.share-one').forEach(btn => {
      btn.onclick = ev => {
        const idx = +btn.dataset.index;
        const s = students[idx];
        const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
        const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parentName}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      };
    });
  }

  addStudentBtn.onclick = ev => {
    ev.preventDefault();
    const name = studentNameIn.value.trim();
    const adm = admissionNoIn.value.trim();
    const parentName = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occupation = parentOccupationIn.value.trim();
    const address = parentAddressIn.value.trim();

    if (!name || !adm || !parentName || !contact || !occupation || !address) {
      return alert('All fields are required.');
    }
    if (!/^[0-9]+$/.test(adm)) {
      return alert('Admission number must be numeric.');
    }
    if (students.some(s => s.adm === adm)) {
      return alert('Admission number already exists.');
    }
    if (!/^\d{7,15}$/.test(contact)) {
      return alert('Contact must be 7–15 digits.');
    }

    students.push({ name, adm, parentName, contact, occupation, address });
    saveStudents();
    renderStudents();

    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccupationIn, parentAddressIn]
      .forEach(input => input.value = '');
  };

  renderStudents();

  // (The rest of app.js: Attendance, Analytics, etc., unchanged)
  // ...
});
