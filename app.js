// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- STORAGE & HELPERS ---
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);

  // --- DOM ELEMENTS ---
  // Setup
  const schoolInput     = $('schoolNameInput');
  const classSelect     = $('teacherClassSelect');
  const sectionSelect   = $('teacherSectionSelect');
  const btnSaveSetup    = $('saveSetup');
  const setupForm       = $('setupForm');
  const setupDisplay    = $('setupDisplay');
  const setupText       = $('setupText');
  const btnEditSetup    = $('editSetup');

  // Registration
  const nameInput       = $('studentName');
  const admInput        = $('admissionNo');
  const parentInput     = $('parentName');
  const contactInput    = $('parentContact');
  const occInput        = $('parentOccupation');
  const addrInput       = $('parentAddress');
  const btnAddStudent   = $('addStudent');
  const tbodyStudents   = $('studentsBody');
  const chkAllStudents  = $('selectAllStudents');
  const btnEditSel      = $('editSelected');
  const btnDeleteSel    = $('deleteSelected');
  const btnSaveReg      = $('saveRegistration');
  const btnShareReg     = $('shareRegistration');
  const btnEditReg      = $('editRegistration');
  const btnDownloadReg  = $('downloadRegistrationPDF');

  // Totals
  const totalSchoolCount  = $('totalSchoolCount');
  const totalClassCount   = $('totalClassCount');
  const totalSectionCount = $('totalSectionCount');

  // --- STATE ---
  let students = await get('students') || [];
  let attendanceData = await get('attendanceData') || {};
  let registrationSaved = false;
  let inlineEditing = false;

  // --- CORE FUNCTIONS ---
  function getCurrentClassSection() {
    return { cls: classSelect.value, sec: sectionSelect.value };
  }
  function filteredStudents() {
    const { cls, sec } = getCurrentClassSection();
    return students.filter(s => s.cls === cls && s.sec === sec);
  }
  function updateTotals() {
    totalSchoolCount.textContent = students.length;
    const { cls } = getCurrentClassSection();
    totalClassCount.textContent = students.filter(s => s.cls === cls).length;
    totalSectionCount.textContent = filteredStudents().length;
  }

  function bindRowSelection() {
    const boxes = Array.from(tbodyStudents.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        btnEditSel.disabled = btnDeleteSel.disabled = !any;
      };
    });
    chkAllStudents.disabled = registrationSaved;
    chkAllStudents.onchange = () => {
      boxes.forEach(cb => {
        cb.checked = chkAllStudents.checked;
        cb.dispatchEvent(new Event('change'));
      });
    };
  }

  function renderStudents() {
    const list = filteredStudents();
    tbodyStudents.innerHTML = '';
    list.forEach((st, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" data-index="${idx}" ${registrationSaved ? 'disabled' : ''}></td>
        <td>${idx + 1}</td>
        <td>${st.name}</td><td>${st.adm}</td><td>${st.parent}</td>
        <td>${st.contact}</td><td>${st.occupation}</td><td>${st.address}</td>
        <td>${registrationSaved ? '<button class="share-one">Share</button>' : ''}</td>
      `;
      if (registrationSaved) {
        tr.querySelector('.share-one').onclick = () => {
          const hdr = `School: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
          const msg = [
            hdr,
            `Name: ${st.name}`,
            `Adm#: ${st.adm}`,
            `Parent: ${st.parent}`,
            `Contact: ${st.contact}`,
            `Occupation: ${st.occupation}`,
            `Address: ${st.address}`
          ].join('\n');
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      tbodyStudents.appendChild(tr);
    });
    bindRowSelection();
    updateTotals();
  }

  // --- SETUP LOGIC ---
  btnSaveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolInput.value || !classSelect.value || !sectionSelect.value) {
      return alert('Complete setup');
    }
    await set('schoolName', schoolInput.value);
    await set('teacherClass', classSelect.value);
    await set('teacherSection', sectionSelect.value);
    await loadSetup();
  };
  btnEditSetup.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };

  async function loadSetup() {
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if (school && cls && sec) {
      schoolInput.value   = school;
      classSelect.value   = cls;
      sectionSelect.value = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
      renderStudents();
    }
    updateTotals();
  }
  await loadSetup();

  // --- STUDENT REGISTRATION EVENTS ---
  btnAddStudent.onclick = async e => {
    e.preventDefault();
    const name = nameInput.value.trim(),
          adm  = admInput.value.trim(),
          par  = parentInput.value.trim(),
          cont = contactInput.value.trim(),
          occ  = occInput.value.trim(),
          addr = addrInput.value.trim();
    if (!name || !adm || !par || !cont || !occ || !addr) {
      return alert('All fields required');
    }
    if (!/^\d+$/.test(adm)) {
      return alert('Admission number must be numeric');
    }
    if (!/^\d{7,15}$/.test(cont)) {
      return alert('Contact must be 7–15 digits');
    }
    if (students.some(s => s.adm === adm && s.cls === classSelect.value && s.sec === sectionSelect.value)) {
      return alert('Duplicate Admission# in this class & section');
    }
    students.push({
      name, adm, parent: par, contact: cont, occupation: occ, address: addr,
      roll: Date.now(), cls: classSelect.value, sec: sectionSelect.value
    });
    await set('students', students);
    renderStudents();
    [nameInput, admInput, parentInput, contactInput, occInput, addrInput].forEach(i => i.value = '');
  };

  btnEditSel.onclick = e => {
    e.preventDefault();
    const checked = Array.from(tbodyStudents.querySelectorAll('.sel:checked'));
    if (!checked.length) return;
    inlineEditing = !inlineEditing;
    btnEditSel.textContent = inlineEditing ? 'Done Editing' : 'Edit Selected';
    checked.forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td, ci) => {
        if (ci >= 1 && ci <= 6) {
          td.contentEditable = inlineEditing;
          td.classList.toggle('editing', inlineEditing);
          if (inlineEditing) td.addEventListener('blur', handleInlineBlur);
          else td.removeEventListener('blur', handleInlineBlur);
        }
      });
    });
  };

  function handleInlineBlur(e) {
    const td = e.target,
          tr = td.closest('tr'),
          idx = +tr.querySelector('.sel').dataset.index,
          keys = ['name','adm','parent','contact','occupation','address'],
          ci = Array.from(tr.children).indexOf(td),
          val = td.textContent.trim(),
          list = filteredStudents(),
          stu = list[idx];
    if (ci === 2 && !/^\d+$/.test(val)) {
      alert('Adm# must be numeric');
      renderStudents();
      return;
    }
    if (ci === 2 && students.some(s => s.adm === val && s.roll !== stu.roll)) {
      alert('Duplicate Adm#');
      renderStudents();
      return;
    }
    if (ci >= 1 && ci <= 6) {
      stu[keys[ci-1]] = val;
      students = students.map(s => s.roll === stu.roll ? stu : s);
      set('students', students);
    }
  }

  btnDeleteSel.onclick = async e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    const toRemove = Array.from(tbodyStudents.querySelectorAll('.sel:checked'))
      .map(cb => filteredStudents()[+cb.dataset.index].roll);
    students = students.filter(s => !toRemove.includes(s.roll));
    await set('students', students);
    renderStudents();
  };

  btnSaveReg.onclick = e => {
    e.preventDefault();
    registrationSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id => $(id).classList.remove('hidden'));
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  btnEditReg.onclick = e => {
    e.preventDefault();
    registrationSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id => $(id).classList.add('hidden'));
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  btnShareReg.onclick = e => {
    e.preventDefault();
    const hdr = `School: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
    const lines = filteredStudents().map(s =>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines)}`, '_blank');
  };

  btnDownloadReg.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Student Registration', 10, 10);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 10, 20);
    doc.text(`School: ${schoolInput.value}`, 10, 26);
    doc.text(`Class: ${classSelect.value}`, 10, 32);
    doc.text(`Section: ${sectionSelect.value}`, 10, 38);
    doc.autoTable({
      head: [['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: filteredStudents().map(s => [s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY: 44
    });
    doc.save('student_registration.pdf');
  };

  // final render
  updateTotals();
  renderStudents();
});
