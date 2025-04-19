// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // Shared color mapping
  const colors = {
    P: 'var(--success)',
    A: 'var(--danger)',
    Lt: 'var(--warning)',
    HD: 'var(--orange)',
    L: 'var(--info)'
  };

  // -----------------------------
  // 1. SETUP
  // -----------------------------
  const schoolIn     = $('schoolNameInput');
  const classSel     = $('teacherClassSelect');
  const secSel       = $('teacherSectionSelect');
  const saveSetup    = $('saveSetup');
  const setupForm    = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText    = $('setupText');
  const editSetup    = $('editSetup');

  function loadSetup() {
    const school = localStorage.getItem('schoolName');
    const cls    = localStorage.getItem('teacherClass');
    const sec    = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value   = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetup.onclick = e => {
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

  editSetup.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };

  loadSetup();

  // -----------------------------
  // 2. STUDENT REGISTRATION
  // -----------------------------
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  window.students = students;

  const studentNameIn   = $('studentName');
  const admissionNoIn   = $('admissionNo');
  const parentNameIn    = $('parentName');
  const parentContactIn = $('parentContact');
  const parentOccIn     = $('parentOccupation');
  const parentAddrIn    = $('parentAddress');
  const addStudentBtn   = $('addStudent');
  const studentsBody    = $('studentsBody');
  const selectAll       = $('selectAllStudents');
  const editSelBtn      = $('editSelected');
  const deleteSelBtn    = $('deleteSelected');
  const saveRegBtn      = $('saveRegistration');
  const shareRegBtn     = $('shareRegistration');
  const editRegBtn      = $('editRegistration');
  const downloadRegBtn  = $('downloadRegistrationPDF');
  let regSaved = false, inlineEdit = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved ? 'disabled' : ''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved ? '<button class="share-one">Share</button>' : ''}</td>`;
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
    bindSelection();
  }

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
      if (!regSaved) {
        boxes.forEach(cb => {
          cb.checked = selectAll.checked;
          cb.dispatchEvent(new Event('change'));
        });
      }
    };
  }

  addStudentBtn.onclick = ev => {
    ev.preventDefault();
    const name    = studentNameIn.value.trim();
    const adm     = admissionNoIn.value.trim();
    const parent  = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occ     = parentOccIn.value.trim();
    const addr    = parentAddrIn.value.trim();

    if (!name || !adm || !parent || !contact || !occ || !addr) {
      alert('All fields required');
      return;
    }
    if (!/^\d+$/.test(adm)) {
      alert('Adm# must be numeric');
      return;
    }
    if (students.some(s => s.adm === adm)) {
      alert(`Admission# ${adm} already exists`);
      return;
    }
    if (!/^\d{7,15}$/.test(contact)) {
      alert('Contact must be 7–15 digits');
      return;
    }

    students.push({ name, adm, parent, contact, occupation: occ, address: addr, roll: Date.now() });
    saveStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn].forEach(i => i.value = '');
  };

  function onCellBlur(e) {
    const td = e.target;
    const tr = td.closest('tr');
    const idx = +tr.querySelector('.sel').dataset.index;
    const ci  = Array.from(tr.children).indexOf(td);
    const keys = ['name','adm','parent','contact','occupation','address'];
    const val = td.textContent.trim();

    if (ci === 2) {
      if (!/^\d+$/.test(val)) {
        alert('Adm# must be numeric');
        renderStudents();
        return;
      }
      if (students.some((s, i2) => s.adm === val && i2 !== idx)) {
        alert('Duplicate Adm# not allowed');
        renderStudents();
        return;
      }
    }
    if (ci >= 1 && ci <= 6) {
      students[idx][keys[ci - 1]] = val;
      saveStudents();
    }
  }

  editSelBtn.onclick = ev => {
    ev.preventDefault();
    const sel = Array.from(document.querySelectorAll('.sel:checked'));
    if (!sel.length) return;
    inlineEdit = !inlineEdit;
    editSelBtn.textContent = inlineEdit ? 'Done Editing' : 'Edit Selected';
    sel.forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td, ci) => {
        if (ci >= 1 && ci <= 6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit ? td.addEventListener('blur', onCellBlur) : td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  deleteSelBtn.onclick = ev => {
    ev.preventDefault();
    if (!confirm('Delete selected?')) return;
    Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb => +cb.dataset.index)
      .sort((a, b) => b - a)
      .forEach(i => students.splice(i, 1));
    saveStudents();
    renderStudents();
    selectAll.checked = false;
  };

  saveRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegBtn.classList.remove('hidden');
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
    downloadRegBtn.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick = ev => {
    ev.preventDefault();
    const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s =>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines)}`, '_blank');
  };

  downloadRegBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    doc.autoTable({
      head: [['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: students.map(s => [s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY: 40, margin: { left: 40, right: 40 }, styles: { fontSize: 10 }
    });
    doc.save('students_registration.pdf');
  };

  renderStudents();

  // -----------------------------
  // 3. ATTENDANCE MARKING
  // -----------------------------
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
  window.attendanceData = attendanceData;

  const dateInput       = $('dateInput');
  const loadAtt         = $('loadAttendance');
  const attList         = $('attendanceList');
  const saveAtt         = $('saveAttendance');
  const resultSection   = $('attendance-result');
  const summaryBody     = $('summaryBody');
  const resetAtt        = $('resetAttendance');
  const shareAtt        = $('shareAttendanceSummary');
  const downloadAttPDF  = $('downloadAttendancePDF');

  loadAtt.onclick = ev => {
    ev.preventDefault();
    if (!dateInput.value) return alert('Pick a date');
    attList.innerHTML = '';
    students.forEach(s => {
      const row = document.createElement('div');
      row.className = 'attendance-item';
      row.textContent = s.name;
      const btns = document.createElement('div');
      btns.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'att-btn';
        b.dataset.code = code;
        b.textContent = code;
        if (attendanceData[dateInput.value]?.[s.roll] === code) {
          b.style.background = colors[code];
          b.style.color = '#fff';
        }
        b.onclick = e2 => {
          e2.preventDefault();
          btns.querySelectorAll('.att-btn').forEach(x => {
            x.style.background = '';
            x.style.color = 'var(--dark)';
          });
          b.style.background = colors[code];
          b.style.color = '#fff';
        };
        btns.append(b);
      });
      attList.append(row, btns);
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick = ev => {
    ev.preventDefault();
    const d = dateInput.value;
    attendanceData[d] = {};
    attList.querySelectorAll('.attendance-actions').forEach((btns,i) => {
      const sel = btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll] = sel ? sel.dataset.code : 'A';
    });
    localStorage.setItem('attendance
                           // -----------------------------
  // 5. ATTENDANCE REGISTER
  // -----------------------------
  const registerDateFrom = $('registerDateFrom');
  const registerDateTo   = $('registerDateTo');
  const loadRegisterBtn  = $('loadRegister');
  const registerTable    = $('registerTable');
  const registerBody     = $('registerBody');
  const downloadRegisterBtn = $('downloadRegisterPDF');
  const shareRegisterBtn = $('shareRegister');

  loadRegisterBtn.onclick = ev => {
    ev.preventDefault();
    if (!registerDateFrom.value || !registerDateTo.value) {
      return alert('Select date range');
    }

    const from = new Date(registerDateFrom.value);
    const to = new Date(registerDateTo.value);
    if (from > to) {
      return alert('Invalid date range');
    }

    // Generate all dates in range
    const dates = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0]);
    }

    // Build table
    let html = '<thead><tr><th>Name</th>';
    dates.forEach(d => {
      html += `<th>${new Date(d).toLocaleDateString('en-US', {month:'short', day:'numeric'})}</th>`;
    });
    html += '</tr></thead><tbody>';

    students.forEach(s => {
      html += `<tr><td>${s.name}</td>`;
      dates.forEach(d => {
        const code = attendanceData[d]?.[s.roll] || '';
        html += `<td style="color:${colors[code] || 'inherit'}">${code}</td>`;
      });
      html += '</tr>';
    });

    registerBody.innerHTML = html;
    registerTable.classList.remove('hidden');
    downloadRegisterBtn.classList.remove('hidden');
    shareRegisterBtn.classList.remove('hidden');
  };

  downloadRegisterBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l','pt','a4');
    doc.autoTable({
      html: registerTable,
      startY: 40,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 80 } }
    });
    doc.save('attendance_register.pdf');
  };

  shareRegisterBtn.onclick = ev => {
    ev.preventDefault();
    const from = registerDateFrom.value;
    const to = registerDateTo.value;
    const hdr = `Attendance Register\n${from} to ${to}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    
    const dates = [];
    for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0]);
    }

    const lines = students.map(s => {
      const statuses = dates.map(d => {
        const code = attendanceData[d]?.[s.roll] || 'A';
        return `${new Date(d).toLocaleDateString('en-US', {month:'short', day:'numeric'})}: ${code}`;
      }).join(', ');
      return `${s.name}: ${statuses}`;
    });

    const msg = [hdr, '', ...lines].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // -----------------------------
  // 6. DATA MANAGEMENT
  // -----------------------------
  const backupBtn = $('backupData');
  const restoreBtn = $('restoreData');
  const restoreFile = $('restoreFile');
  const resetAllBtn = $('resetAllData');

  backupBtn.onclick = ev => {
    ev.preventDefault();
    const data = {
      schoolName: localStorage.getItem('schoolName'),
      teacherClass: localStorage.getItem('teacherClass'),
      teacherSection: localStorage.getItem('teacherSection'),
      students: JSON.parse(localStorage.getItem('students') || '[]'),
      attendanceData: JSON.parse(localStorage.getItem('attendanceData') || '{}')
    };

    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_system_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  restoreBtn.onclick = ev => {
    ev.preventDefault();
    restoreFile.click();
  };

  restoreFile.onchange = ev => {
    const file = ev.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (!confirm(`Restore data from ${file.name}? This will overwrite current data.`)) {
          return;
        }

        localStorage.setItem('schoolName', data.schoolName || '');
        localStorage.setItem('teacherClass', data.teacherClass || '');
        localStorage.setItem('teacherSection', data.teacherSection || '');
        localStorage.setItem('students', JSON.stringify(data.students || []));
        localStorage.setItem('attendanceData', JSON.stringify(data.attendanceData || {}));

        // Reload all data
        students = JSON.parse(localStorage.getItem('students') || [];
        attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
        
        // Refresh all views
        loadSetup();
        renderStudents();
        alert('Data restored successfully! Page will reload.');
        location.reload();
      } catch (err) {
        alert('Error restoring data: Invalid file format');
      }
    };
    reader.readAsText(file);
  };

  resetAllBtn.onclick = ev => {
    ev.preventDefault();
    if (!confirm('WARNING: This will delete ALL data permanently. Continue?')) {
      return;
    }
    
    localStorage.clear();
    alert('All data has been reset. Page will reload.');
    location.reload();
  };

  // -----------------------------
  // 7. INITIALIZATION
  // -----------------------------
  function initializeCurrentDate() {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    analyticsDate.value = today;
    registerDateFrom.value = today;
    registerDateTo.value = today;
    
    // Set semester inputs to current academic period
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    if (month >= 1 && month <= 6) {
      semesterStartInput.value = `${year}-01`;
      semesterEndInput.value = `${year}-06`;
    } else {
      semesterStartInput.value = `${year}-07`;
      semesterEndInput.value = `${year}-12`;
    }
    
    // Set year input to current year
    yearStart.value = year;
    
    // Set month input to current month
    analyticsMonth.value = `${year}-${month.toString().padStart(2, '0')}`;
  }

  initializeCurrentDate();
});
