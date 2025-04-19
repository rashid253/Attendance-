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

  // SETUP
  const schoolIn       = $('schoolNameInput'),
        classSel       = $('teacherClassSelect'),
        secSel         = $('teacherSectionSelect'),
        saveSetupBtn   = $('saveSetup'),
        setupForm      = $('setupForm'),
        setupDisplay   = $('setupDisplay'),
        setupText      = $('setupText'),
        editSetupBtn   = $('editSetup');

  function loadSetup() {
    const school = localStorage.getItem('schoolName'),
          cls    = localStorage.getItem('teacherClass'),
          sec    = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value       = school;
      classSel.value       = cls;
      secSel.value         = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetupBtn.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value)
      return alert('Complete setup');
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

  // STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const studentNameIn       = $('studentName'),
        admissionNoIn       = $('admissionNo'),
        parentNameIn        = $('parentName'),
        parentContactIn     = $('parentContact'),
        parentOccupationIn  = $('parentOccupation'),
        parentAddressIn     = $('parentAddress'),
        addStudentBtn       = $('addStudent'),
        studentsBody        = $('studentsBody'),
        selectAllChk        = $('selectAllStudents'),
        editSelectedBtn     = $('editSelected'),
        deleteSelectedBtn   = $('deleteSelected'),
        saveRegBtn          = $('saveRegistration'),
        shareRegBtn         = $('shareRegistration'),
        editRegBtn          = $('editRegistration'),
        downloadRegPDFBtn   = $('downloadRegistrationPDF');
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
    const name        = studentNameIn.value.trim(),
          adm         = admissionNoIn.value.trim(),
          parent      = parentNameIn.value.trim(),
          contact     = parentContactIn.value.trim(),
          occupation  = parentOccupationIn.value.trim(),
          address     = parentAddressIn.value.trim();
    if (!name || !adm || !parent || !contact || !occupation || !address)
      return alert('All fields required');
    if (!/^[0-9]+$/.test(adm)) return alert('Adm# must be numeric');
    if (!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits');
    students.push({ name, adm, parent, contact, occupation, address, roll: Date.now() });
    saveStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccupationIn, parentAddressIn].forEach(i => i.value = '');
  };

  function onCellBlur(e) {
    const td = e.target, tr = td.closest('tr'),
          idx = +tr.querySelector('.sel').dataset.index,
          ci  = Array.from(tr.children).indexOf(td),
          keys = ['name','adm','parent','contact','occupation','address'];
    if (ci >= 1 && ci <= 6) {
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
    selBoxes.forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td, ci) => {
        if (ci >= 1 && ci <= 6) {
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
      .map(cb => +cb.dataset.index)
      .sort((a,b) => b - a)
      .forEach(i => students.splice(i,1));
    saveStudents();
    renderStudents();
    selectAllChk.checked = false;
  };

  saveRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegPDFBtn.classList.remove('hidden');
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  editRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegPDFBtn.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick = ev => {
    ev.preventDefault();
    const hdr   = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s =>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines)}`, '_blank');
  };

  downloadRegPDFBtn.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    // Header
    const [yr, mo] = registerMonth.value.split('-');
    const monthName = new Date(yr, mo-1).toLocaleString('default',{month:'long'});
    doc.setFontSize(16);
    doc.text(`Attendance Register — ${monthName} ${yr}`, doc.internal.pageSize.getWidth()/2, 40, { align: 'center' });

    // Table
    doc.autoTable({
      html: '#registerTableWrapper table',
      startY: 60,
      theme: 'grid',
      headStyles: { fillColor: [33,150,243] },
      styles: { fontSize: 8, cellPadding: 4 },
      margin: { left: 40, right: 40 }
    });

    // Summary & Charts on new page
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Monthly Summary', 40, 50);
    doc.autoTable({
      html: '#registerSummary table',
      startY: 70,
      theme: 'grid',
      headStyles: { fillColor: [33,150,243] },
      styles: { fontSize: 10, cellPadding: 6 },
      margin: { left: 40, right: 40 }
    });

    // 1cm padding and enlarge charts by 1cm
    const cm = 28.35;
    const chartY = doc.lastAutoTable.finalY + cm;
    const availableW = doc.internal.pageSize.getWidth() - 80; 
    const chartW = (availableW / 2) + cm;
    const chartH = 150 + cm;

    doc.addImage(regBarChart.toBase64Image(), 'PNG', 40, chartY, chartW, chartH);
    doc.addImage(regPieChart.toBase64Image(), 'PNG', 60 + chartW, chartY, chartW, chartH);

    // Save
    doc.save(`Register_${mo}-${yr}.pdf`);
  };

  renderStudents();

  // ... rest of Attendance, Analytics, Traditional Register logic unchanged ...
});
