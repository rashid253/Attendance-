// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = {
    P: 'var(--success)',
    A: 'var(--danger)',
    Lt: 'var(--warning)',
    HD: 'var(--orange)',
    L: 'var(--info)'
  };

  // 1. SETUP (unchanged)
  const schoolIn     = $('schoolNameInput');
  const classSel     = $('teacherClassSelect');
  const secSel       = $('teacherSectionSelect');
  const saveSetupBtn = $('saveSetup');
  const setupForm    = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText    = $('setupText');
  const editSetupBtn = $('editSetup');

  function loadSetup() {
    const school = localStorage.getItem('schoolName');
    const cls    = localStorage.getItem('teacherClass');
    const sec    = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value      = school;
      classSel.value      = cls;
      secSel.value        = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetupBtn.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) {
      return alert('Complete setup');
    }
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

  // 2. STUDENT REGISTRATION (unchanged)
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  window.students = students;  // expose for other sections
  const studentNameIn      = $('studentName');
  const admissionNoIn      = $('admissionNo');
  const parentNameIn       = $('parentName');
  const parentContactIn    = $('parentContact');
  const parentOccupationIn = $('parentOccupation');
  const parentAddressIn    = $('parentAddress');
  const addStudentBtn      = $('addStudent');
  const studentsBody       = $('studentsBody');
  const selectAllChk       = $('selectAllStudents');
  const editSelectedBtn    = $('editSelected');
  const deleteSelectedBtn  = $('deleteSelected');
  const saveRegBtn         = $('saveRegistration');
  const shareRegBtn        = $('shareRegistration');
  const editRegBtn         = $('editRegistration');
  const downloadRegPDFBtn  = $('downloadRegistrationPDF');
  let regSaved = false, inlineEdit = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved?'disabled':''}></td>` +
        `<td>${s.name}</td>` +
        `<td>${s.adm}</td>` +
        `<td>${s.parent}</td>` +
        `<td>${s.contact}</td>` +
        `<td>${s.occupation}</td>` +
        `<td>${s.address}</td>` +
        `<td>${regSaved?'<button class="share-one">Share</button>':''}</td>`;
      if (regSaved) {
        tr.querySelector('.share-one').onclick = ev => {
          ev.preventDefault();
          const hdr = 
            `School: ${localStorage.getItem('schoolName')}\n` +
            `Class: ${localStorage.getItem('teacherClass')}\n` +
            `Section: ${localStorage.getItem('teacherSection')}`;
          const msg =
            `${hdr}\n\n` +
            `Name: ${s.name}\n` +
            `Adm#: ${s.adm}\n` +
            `Parent: ${s.parent}\n` +
            `Contact: ${s.contact}\n` +
            `Occupation: ${s.occupation}\n` +
            `Address: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindStudentSelection();
  }

  function bindStudentSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelectedBtn.disabled = deleteSelectedBtn.disabled = !any;
      };
    });
    selectAllChk.disabled = regSaved;
    selectAllChk.onchange = () => {
      if (!regSaved) {
        boxes.forEach(cb => {
          cb.checked = selectAllChk.checked;
          cb.dispatchEvent(new Event('change'));
        });
      }
    };
  }

  addStudentBtn.onclick = ev => {
    ev.preventDefault();
    const name       = studentNameIn.value.trim();
    const adm        = admissionNoIn.value.trim();
    const parent     = parentNameIn.value.trim();
    const contact    = parentContactIn.value.trim();
    const occupation = parentOccupationIn.value.trim();
    const address    = parentAddressIn.value.trim();
    if (!name || !adm || !parent || !contact || !occupation || !address) {
      return alert('All fields required');
    }
    if (!/^\d+$/.test(adm)) {
      return alert('Adm# must be numeric');
    }
    if (!/^\d{7,15}$/.test(contact)) {
      return alert('Contact must be 7–15 digits');
    }
    students.push({
      name,
      adm,
      parent,
      contact,
      occupation,
      address,
      roll: Date.now()
    });
    saveStudents();
    renderStudents();
    [
      studentNameIn,
      admissionNoIn,
      parentNameIn,
      parentContactIn,
      parentOccupationIn,
      parentAddressIn
    ].forEach(i => i.value = '');
  };

  function onCellBlur(e) {
    const td = e.target;
    const tr = td.closest('tr');
    const idx = +tr.querySelector('.sel').dataset.index;
    const ci  = Array.from(tr.children).indexOf(td);
    const keys = ['name','adm','parent','contact','occupation','address'];
    if (ci >= 1 && ci <= 6) {
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  }

  editSelectedBtn.onclick = ev => {
    ev.preventDefault();
    const sel = Array.from(document.querySelectorAll('.sel:checked'));
    if (!sel.length) return;
    inlineEdit = !inlineEdit;
    editSelectedBtn.textContent = inlineEdit ? 'Done Editing' : 'Edit Selected';
    sel.forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td, ci) => {
        if (ci >= 1 && ci <= 6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit
            ? td.addEventListener('blur', onCellBlur)
            : td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  deleteSelectedBtn.onclick = ev => {
    ev.preventDefault();
    if (!confirm('Delete selected?')) return;
    Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb => +cb.dataset.index)
      .sort((a, b) => b - a)
      .forEach(i => students.splice(i, 1));
    saveStudents();
    renderStudents();
    selectAllChk.checked = false;
  };

  saveRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegPDFBtn.classList.remove('hidden');
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  editRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegPDFBtn.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick = ev => {
    ev.preventDefault();
    const hdr = 
      `School: ${localStorage.getItem('schoolName')}\n` +
      `Class: ${localStorage.getItem('teacherClass')}\n` +
      `Section: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s =>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines)}`, '_blank');
  };

  downloadRegPDFBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    doc.autoTable({
      head: [['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: students.map(s => [s.name, s.adm, s.parent, s.contact, s.occupation, s.address]),
      startY: 40,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 10 }
    });
    doc.save('students_registration.pdf');
  };

  renderStudents();

  // 3. ATTENDANCE MARKING (unchanged)

  // 4. ANALYTICS (unchanged)

  // 5. ATTENDANCE REGISTER (updated PDF styling)
  const regMonthIn       = $('registerMonth');
  const loadRegBtn       = $('loadRegister');
  const changeRegBtn     = $('changeRegister');
  const regTableWrapper  = $('registerTableWrapper');
  const regTable         = $('registerTable');
  const regBody          = $('registerBody');
  const regSummarySection = $('registerSummarySection');
  const regSummaryBody   = $('registerSummaryBody');
  const shareRegBtn2     = $('shareRegister');
  const downloadRegBtn2  = $('downloadRegisterPDF');

  // build 1–31 headers once
  const regHeaderRow = regTable.querySelector('thead tr');
  for (let d = 1; d <= 31; d++) {
    const th = document.createElement('th');
    th.textContent = d;
    regHeaderRow.append(th);
  }

  downloadRegBtn2.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');

    // Header texts
    doc.text(localStorage.getItem('schoolName'), 40, 30);
    doc.text(
      `Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`,
      40, 45
    );
    doc.text(`Register for ${regMonthIn.value}`, 40, 60);

    // Extract headers from table DOM
    const headerCells = regTable.querySelectorAll('thead tr th');
    const headers = Array.from(headerCells).map(th => th.textContent);

    // Extract row data
    const bodyData = [];
    regBody.querySelectorAll('tr').forEach(tr => {
      const row = Array.from(tr.children).map(td => td.textContent);
      bodyData.push(row);
    });

    // Generate PDF with fixed column widths
    doc.autoTable({
      head: [headers],
      body: bodyData,
      startY: 75,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 20 },  // S. No.
        1: { cellWidth: 40 },  // Adm#
        2: { cellWidth: 80, halign: 'left' }, // Name
        // Date columns: uniform narrow width
        ...Array.from({ length: headers.length - 3 }, (_, i) => i + 3)
          .reduce((acc, idx) => { acc[idx] = { cellWidth: 16, halign: 'center' }; return acc; }, {})
      }
    });

    // Save PDF
    doc.save('attendance_register.pdf');
  };

  loadRegBtn.onclick   = ev => { /* unchanged */ };
  changeRegBtn.onclick = ev => { /* unchanged */ };
  shareRegBtn2.onclick = ev => { /* unchanged */ };
});
