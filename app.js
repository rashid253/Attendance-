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

  //
  // 1. SETUP
  //
  const schoolIn      = $('schoolNameInput'),
        classSel      = $('teacherClassSelect'),
        secSel        = $('teacherSectionSelect'),
        saveSetupBtn  = $('saveSetup'),
        setupForm     = $('setupForm'),
        setupDisplay  = $('setupDisplay'),
        setupText     = $('setupText'),
        editSetupBtn  = $('editSetup');

  function loadSetup() {
    const school = localStorage.getItem('schoolName'),
          cls    = localStorage.getItem('teacherClass'),
          sec    = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value        = school;
      classSel.value        = cls;
      secSel.value          = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetupBtn.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) {
      alert('Complete setup');
      return;
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

  //
  // 2. STUDENT REGISTRATION
  //
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const studentNameIn      = $('studentName'),
        admissionNoIn      = $('admissionNo'),
        parentNameIn       = $('parentName'),
        parentContactIn    = $('parentContact'),
        parentOccupationIn = $('parentOccupation'),
        parentAddressIn    = $('parentAddress'),
        addStudentBtn      = $('addStudent'),
        studentsBody       = $('studentsBody'),
        selectAllChk       = $('selectAllStudents'),
        editSelectedBtn    = $('editSelected'),
        deleteSelectedBtn  = $('deleteSelected'),
        saveRegBtn         = $('saveRegistration'),
        shareRegBtn        = $('shareRegistration'),
        editRegBtn         = $('editRegistration'),
        downloadRegPDFBtn  = $('downloadRegistrationPDF');
  let regSaved = false, inlineEdit = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
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

  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved?'disabled':''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved?'<button class="share-one">Share</button>':''}</td>`;
      if (regSaved) {
        tr.querySelector('.share-one').onclick = ev => {
          ev.preventDefault();
          const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
          const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindStudentSelection();
  }

  addStudentBtn.onclick = ev => {
    ev.preventDefault();
    const name       = studentNameIn.value.trim(),
          adm        = admissionNoIn.value.trim(),
          parent     = parentNameIn.value.trim(),
          contact    = parentContactIn.value.trim(),
          occupation = parentOccupationIn.value.trim(),
          address    = parentAddressIn.value.trim();
    if (!name || !adm || !parent || !contact || !occupation || !address) {
      alert('All fields required');
      return;
    }
    if (!/^[0-9]+$/.test(adm)) {
      alert('Adm# must be numeric');
      return;
    }
    if (!/^\d{7,15}$/.test(contact)) {
      alert('Contact must be 7–15 digits');
      return;
    }
    students.push({ name, adm, parent, contact, occupation, address, roll: Date.now() });
    saveStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccupationIn, parentAddressIn].forEach(i=>i.value='');
  };

  function onCellBlur(e) {
    const td  = e.target,
          tr  = td.closest('tr'),
          idx = +tr.querySelector('.sel').dataset.index,
          ci  = Array.from(tr.children).indexOf(td),
          keys= ['name','adm','parent','contact','occupation','address'];
    if (ci>=1 && ci<=6) {
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  }

  editSelectedBtn.onclick = ev => {
    ev.preventDefault();
    const selBoxes = Array.from(document.querySelectorAll('.sel:checked'));
    if (!selBoxes.length) return;
    inlineEdit = !inlineEdit;
    editSelectedBtn.textContent = inlineEdit ? 'Done Editing' : 'Edit Selected';
    selBoxes.forEach(cb=>{
      cb.closest('tr').querySelectorAll('td').forEach((td, ci)=>{
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit ? td.addEventListener('blur', onCellBlur) : td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  deleteSelectedBtn.onclick = ev => {
    ev.preventDefault();
    if (!confirm('Delete selected?')) return;
    Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb=>+cb.dataset.index).sort((a,b)=>b-a).forEach(i=>students.splice(i,1));
    saveStudents();
    renderStudents();
    selectAllChk.checked = false;
  };

  saveRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.add('hidden'));
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
      .forEach(id=>$(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegPDFBtn.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick = ev => {
    ev.preventDefault();
    const hdr   = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s=>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`, '_blank');
  };

  //
  // 3. ATTENDANCE MARKING
  //
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
  const dateInput         = $('dateInput'),
        loadAttBtn        = $('loadAttendance'),
        attList           = $('attendanceList'),
        saveAttBtn        = $('saveAttendance'),
        resSection        = $('attendance-result'),
        summaryBody       = $('summaryBody'),
        resetAttBtn       = $('resetAttendance'),
        shareAttBtn       = $('shareAttendanceSummary'),
        downloadAttPDFBtn = $('downloadAttendancePDF');

  // ... Existing attendance handlers ...

  //
  // 4. ANALYTICS
  //
  // ... Existing analytics handlers ...

  //
  // 5. TRADITIONAL REGISTER
  //
  const registerMonthInput      = $('registerMonth'),
        loadRegisterBtn         = $('loadRegister'),
        registerTableWrapper    = $('registerTableWrapper'),
        registerSummary         = $('registerSummary'),
        registerGraphs          = $('registerGraphs'),
        shareRegisterBtn        = $('shareRegister'),
        downloadRegisterPDFBtn2 = $('downloadRegisterPDF');
  let regBarChart, regPieChart, registerStats;

  loadRegisterBtn.onclick = () => {
    // ... build table, summary, charts as you had ...
    shareRegisterBtn.classList.remove('hidden');
    downloadRegisterPDFBtn2.classList.remove('hidden');
  };

  shareRegisterBtn.onclick = () => {
    // ... your existing share logic ...
  };

  // ←—— MISSING HANDLER ADDED HERE —→
  downloadRegisterPDFBtn2.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    // Title
    const period = registerMonthInput.value;
    doc.setFontSize(16);
    doc.text(`Register Month: ${period}`, doc.internal.pageSize.getWidth()/2, 40, { align: 'center' });

    // Full register table
    doc.autoTable({
      html: '#registerTableWrapper table',
      startY: 60,
      theme: 'grid',
      headStyles: { fillColor: [33,150,243] },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 40, right: 40 }
    });

    // Summary & charts on new page
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Monthly Summary', 40, 40);
    doc.autoTable({
      html: '#registerSummary table',
      startY: 60,
      theme: 'grid',
      headStyles: { fillColor: [33,150,243] },
      styles: { fontSize: 10, cellPadding: 4 },
      margin: { left: 40, right: 40 }
    });
    const cm = 28.35; // 1cm
    let y = doc.lastAutoTable.finalY + cm;
    const pageWidth = doc.internal.pageSize.getWidth() - 80;
    const chartW = pageWidth / 2;
    const chartH = 100;
    doc.addImage(regBarChart.toBase64Image(), 'PNG', 40, y, chartW, chartH);
    doc.addImage(regPieChart.toBase64Image(), 'PNG', 60 + chartW, y, chartW, chartH);

    doc.save(`Register_${period}.pdf`);
  };

  renderStudents();
});
