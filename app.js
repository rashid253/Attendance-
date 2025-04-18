window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const THRESHOLD = 75;
  const codeLabels = {
    P: 'Present',
    A: 'Absent',
    Lt: 'Late',
    HD: 'Half‑Day',
    L: 'Leave'
  };
  const colors = {
    P: 'var(--success)',
    A: 'var(--danger)',
    Lt: 'var(--warning)',
    HD: 'var(--orange)',
    L: 'var(--info)'
  };

  // --- SETUP ---
  const setupForm    = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText    = $('setupText');
  const schoolInput  = $('schoolNameInput');
  const classSelect  = $('teacherClassSelect');
  const sectionSelect= $('teacherSectionSelect');
  const saveSetupBtn = $('saveSetup');
  const editSetupBtn = $('editSetup');

  function displaySetup() {
    const school  = localStorage.getItem('schoolName');
    const cls     = localStorage.getItem('teacherClass');
    const section = localStorage.getItem('teacherSection');
    if (school && cls && section) {
      setupText.textContent = `School: ${school} | Class: ${cls} | Section: ${section}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    } else {
      setupForm.classList.remove('hidden');
      setupDisplay.classList.add('hidden');
    }
  }

  saveSetupBtn.addEventListener('click', () => {
    const school  = schoolInput.value.trim();
    const cls     = classSelect.value;
    const section = sectionSelect.value;
    if (!school || !cls || !section) {
      alert('Please fill all setup fields.');
      return;
    }
    localStorage.setItem('schoolName', school);
    localStorage.setItem('teacherClass', cls);
    localStorage.setItem('teacherSection', section);
    displaySetup();
  });

  editSetupBtn.addEventListener('click', () => {
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
    schoolInput.value   = localStorage.getItem('schoolName') || '';
    classSelect.value   = localStorage.getItem('teacherClass') || '';
    sectionSelect.value = localStorage.getItem('teacherSection') || '';
  });

  displaySetup();

  // --- STUDENT REGISTRATION ---
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const inputs      = ['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress'].map($);
  const addBtn      = $('addStudent');
  const tblBody     = $('studentsBody');
  const selectAll   = $('selectAllStudents');
  const editSel     = $('editSelected');
  const delSel      = $('deleteSelected');
  const saveReg     = $('saveRegistration');
  const shareReg    = $('shareRegistration');
  const editReg     = $('editRegistration');
  const downloadReg = $('downloadRegistrationPDF');
  let savedReg = false, inlineMode = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.selStu'));
    boxes.forEach(cb => {
      cb.addEventListener('change', () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSel.disabled = delSel.disabled = !any || savedReg;
      });
    });
    selectAll.disabled = savedReg;
    selectAll.addEventListener('change', () => {
      if (savedReg) return;
      const boxes = document.querySelectorAll('.selStu');
      boxes.forEach(cb => {
        cb.checked = selectAll.checked;
        cb.dispatchEvent(new Event('change'));
      });
    });
  }

  function renderStudents() {
    tblBody.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="select-col" style="${savedReg?'display:none':''}">
          <input type="checkbox" class="selStu" data-i="${i}">
        </td>
        <td>${s.name}</td>
        <td>${s.adm}</td>
        <td>${s.parent}</td>
        <td>${s.contact}</td>
        <td>${s.occupation}</td>
        <td>${s.address}</td>
        <td>${savedReg?'<button class="sRow small">Share</button>':''}</td>
      `;
      if (savedReg) {
        tr.querySelector('.sRow').addEventListener('click', () => {
          const hdr = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
          const msg = `${hdr}\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        });
      }
      tblBody.appendChild(tr);
    });
    bindSelection();
  }

  addBtn.addEventListener('click', () => {
    // require all fields non-empty
    const vals = inputs.map(i => i.value.trim());
    const labels = ['Name','Adm#','Parent Name','Parent Contact','Occupation','Address'];
    const missing = labels.filter((lbl, idx) => !vals[idx]);
    if (missing.length) {
      alert('Please fill: ' + missing.join(', '));
      return;
    }
    students.push({
      name: vals[0],
      adm: vals[1],
      parent: vals[2],
      contact: vals[3],
      occupation: vals[4],
      address: vals[5]
    });
    saveStudents();
    renderStudents();
    inputs.forEach(i => i.value = '');
  });

  delSel.addEventListener('click', () => {
    if (!confirm('Delete selected students?')) return;
    Array.from(document.querySelectorAll('.selStu:checked'))
      .map(cb => +cb.dataset.i)
      .sort((a,b) => b-a)
      .forEach(idx => students.splice(idx,1));
    saveStudents();
    renderStudents();
    selectAll.checked = false;
  });

  function onBlur(e) {
    const td = e.target;
    const tr = td.closest('tr');
    const idx = +tr.querySelector('.selStu').dataset.i;
    const keys = ['name','adm','parent','contact','occupation','address'];
    const ci = Array.from(tr.children).indexOf(td);
    if (ci>=1 && ci<=6) {
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  }

  editSel.addEventListener('click', () => {
    const checked = Array.from(document.querySelectorAll('.selStu:checked'));
    if (!checked.length) return;
    inlineMode = !inlineMode;
    editSel.textContent = inlineMode ? 'Done Editing' : 'Edit Selected';
    checked.forEach(cb => {
      const tr = cb.closest('tr');
      Array.from(tr.querySelectorAll('td')).forEach((td,ci) => {
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineMode;
          td.classList.toggle('editing', inlineMode);
          if (inlineMode) td.addEventListener('blur', onBlur);
          else td.removeEventListener('blur', onBlur);
        }
      });
    });
  });

  saveReg.addEventListener('click', () => {
    savedReg = true;
    [editSel, delSel, selectAll, saveReg].forEach(b => b.style.display='none');
    shareReg.classList.remove('hidden');
    editReg.classList.remove('hidden');
    downloadReg.classList.remove('hidden');
    renderStudents();
  });

  editReg.addEventListener('click', () => {
    savedReg = false;
    [editSel, delSel, selectAll, saveReg].forEach(b => b.style.display='');
    shareReg.classList.add('hidden');
    editReg.classList.add('hidden');
    downloadReg.classList.add('hidden');
    renderStudents();
  });

  shareReg.addEventListener('click', () => {
    // individual share only via per-row buttons
    alert('Use the Share buttons on each row.');
  });

  downloadReg.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    let y = 20;
    const header = [
      `School: ${localStorage.getItem('schoolName')}`,
      `Class: ${localStorage.getItem('teacherClass')}`,
      `Section: ${localStorage.getItem('teacherSection')}`
    ].join(' | ');
    doc.setFontSize(14);
    doc.text(header, 20, y);
    y+=20;
    // clone table without last column
    const tbl = document.getElementById('studentTable').cloneNode(true);
    tbl.querySelector('th:last-child').remove();
    tbl.querySelectorAll('tr').forEach(r=>r.lastElementChild.remove());
    doc.autoTable({ html: tbl, startY: y, theme: 'grid',
      headStyles:{ fillColor:[41,128,185], textColor:255, fontStyle:'bold' },
      styles:{ fontSize:10, cellPadding:4 }
    });
    doc.save('Student_Registration.pdf');
  });

  renderStudents();

  // --- ATTENDANCE MARKING & SUMMARY ---
  const loadAttendanceBtn    = $('loadAttendance');
  const attendanceList        = $('attendanceList');
  const saveAttendanceBtn     = $('saveAttendance');
  const attendanceSection     = $('attendance-section');
  const attendanceResult      = $('attendance-result');
  const summaryBody           = $('summaryBody');
  const dateInput             = $('dateInput');
  const sendSelectedBtn       = $('shareAttendanceSummary');
  let currentAttendance = { date:'', statuses:[] };

  loadAttendanceBtn.addEventListener('click', () => {
    const date = dateInput.value;
    if (!date) { alert('Select Date'); return; }
    attendanceList.innerHTML = '';
    currentAttendance = { date, statuses: Array(students.length).fill(null) };
    students.forEach((s,i) => {
      const nameDiv = document.createElement('div');
      nameDiv.className = 'attendance-item';
      nameDiv.textContent = s.name;
      attendanceList.appendChild(nameDiv);

      const actions = document.createElement('div');
      actions.className = 'attendance-actions';
      Object.keys(colors).forEach(code => {
        const btn = document.createElement('button');
        btn.textContent = code;
        btn.className = 'att-btn';
        btn.addEventListener('click', () => {
          currentAttendance.statuses[i] = code;
          actions.querySelectorAll('button').forEach(b=>b.classList.remove('selected'));
          btn.classList.add('selected');
          saveAttendanceBtn.classList.remove('hidden');
        });
        actions.appendChild(btn);
      });
      attendanceList.appendChild(actions);
    });
  });

  saveAttendanceBtn.addEventListener('click', () => {
    const { date, statuses } = currentAttendance;
    if (!date || statuses.includes(null)) { alert('Mark all statuses'); return; }
    const all = JSON.parse(localStorage.getItem('attendance')||'{}');
    all[date] = statuses;
    localStorage.setItem('attendance', JSON.stringify(all));
    showAttendanceSummary(date);
  });

  function showAttendanceSummary(date) {
    const all = JSON.parse(localStorage.getItem('attendance')||'{}');
    const statuses = all[date]||[];
    summaryBody.innerHTML = '';
    statuses.forEach((st,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${students[i].name}</td>
        <td>${codeLabels[st]||st}</td>
        <td><input type="checkbox" class="sendStu" data-i="${i}"></td>
      `;
      summaryBody.appendChild(tr);
    });
    attendanceSection.classList.add('hidden');
    attendanceResult.classList.remove('hidden');
    sendSelectedBtn.disabled = true;
    // enable send button when any checkbox checked
    document.querySelectorAll('.sendStu').forEach(cb => {
      cb.addEventListener('change', () => {
        sendSelectedBtn.disabled = ![...document.querySelectorAll('.sendStu')].some(x=>x.checked);
      });
    });
  }

  // repurpose shareAttendanceSummary as Send Selected
  sendSelectedBtn.textContent = 'Send Selected';
  sendSelectedBtn.addEventListener('click', () => {
    const date = dateInput.value;
    document.querySelectorAll('.sendStu:checked').forEach(cb => {
      const i = +cb.dataset.i;
      const hdr = `Date: ${date}\nSchool: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
      const msg = `${hdr}\nName: ${students[i].name}\nStatus: ${codeLabels[currentAttendance.statuses[i]]}`;
      const number = students[i].contact.replace(/\D/g,'');
      window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`, '_blank');
    });
  });

  $('downloadAttendancePDF').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    let y=20;
    const hdr = [
      `School: ${localStorage.getItem('schoolName')}`,
      `Class: ${localStorage.getItem('teacherClass')}`,
      `Section: ${localStorage.getItem('teacherSection')}`,
      `Date: ${dateInput.value}`
    ].join(' | ');
    doc.setFontSize(14);
    doc.text(hdr,20,y);
    y+=20;
    const tbl = document.getElementById('attendanceSummaryTable').cloneNode(true);
    tbl.querySelector('th:last-child').remove();
    tbl.querySelectorAll('tr').forEach(r=>r.lastElementChild.remove());
    doc.autoTable({
      html: tbl,
      startY: y,
      theme: 'grid',
      headStyles: { fillColor:[41,128,185], textColor:255, fontStyle:'bold' },
      styles: { fontSize:10, cellPadding:4 }
    });
    doc.save(`Attendance_Summary_${dateInput.value}.pdf`);
  });

  $('resetAttendance').addEventListener('click', () => {
    attendanceResult.classList.add('hidden');
    attendanceSection.classList.remove('hidden');
    saveAttendanceBtn.classList.add('hidden');
  });

  // --- ANALYTICS ---
  const typeSelect = $('analyticsType');
  const dateField  = $('analyticsDate');
  const monField   = $('analyticsMonth');
  const inst       = $('instructions');
  const container  = $('analyticsContainer');
  const graphs     = $('graphs');
  const loadAna    = $('loadAnalytics');
  const resetAna   = $('resetAnalytics');
  const shareAna   = $('shareAnalytics');
  const downloadAna= $('downloadAnalytics');

  loadAna.addEventListener('click', () => {
    const all = JSON.parse(localStorage.getItem('attendance')||'{}');
    const rows = Object.entries(all).map(([d,sts]) => {
      const present = sts.filter(s=>s==='P'||s==='Lt'||s==='HD').length;
      const pct = (present/sts.length)*100;
      return { date:d, percent:pct.toFixed(1)+'%' };
    });
    // render simple table
    container.innerHTML = '<table><thead><tr><th>Date</th><th>Attendance %</th></tr></thead><tbody>' +
      rows.map(r=>`<tr><td>${r.date}</td><td>${r.percent}</td></tr>`).join('') +
      '</tbody></table>';
    graphs.classList.remove('hidden');
    container.classList.remove('hidden');
    inst.textContent = '';
    resetAna.classList.remove('hidden');
  });

  resetAna.addEventListener('click', () => location.reload());
  shareAna.addEventListener('click', () => alert('Sharing analytics...'));
  downloadAna.addEventListener('click', () => alert('Downloading analytics...'));
});
