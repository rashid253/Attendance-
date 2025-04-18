window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const THRESHOLD = 75;
  const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'var(--orange)', L:'var(--info)' };

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

  saveSetupBtn.onclick = () => {
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
  };

  editSetupBtn.onclick = () => {
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
    schoolInput.value   = localStorage.getItem('schoolName') || '';
    classSelect.value   = localStorage.getItem('teacherClass') || '';
    sectionSelect.value = localStorage.getItem('teacherSection') || '';
  };

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
    const boxes = [...document.querySelectorAll('.selStu')];
    boxes.forEach(cb => {
      cb.onchange = () => {
        const tr = cb.closest('tr');
        tr.classList.toggle('selected', cb.checked);
        const anyChecked = boxes.some(x => x.checked);
        editSel.disabled = delSel.disabled = !anyChecked || savedReg;
      };
    });
    selectAll.disabled = savedReg;
    selectAll.onchange = () => {
      if (savedReg) return;
      boxes.forEach(cb => {
        cb.checked = selectAll.checked;
        cb.dispatchEvent(new Event('change'));
      });
    };
  }

  function renderStudents() {
    tblBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td class="select-col" style="${savedReg?'display:none':''}">
           <input type="checkbox" class="selStu" data-i="${i}">
         </td>
         <td>${s.name}</td>
         <td>${s.adm}</td>
         <td>${s.parent}</td>
         <td>${s.contact}</td>
         <td>${s.occupation}</td>
         <td>${s.address}</td>
         <td>${savedReg?'<button class="sRow small">Share</button>':''}</td>`;
      if (savedReg) {
        tr.querySelector('.sRow').onclick = () => {
          const hdr = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
          const msg = `${hdr}\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      tblBody.appendChild(tr);
    });
    bindSelection();
  }

  addBtn.onclick = () => {
    if (savedReg) return;
    const vals = inputs.map(i => i.value.trim());
    if (!vals[0] || !vals[1]) {
      alert('Name & Adm# required');
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
  };

  delSel.onclick = () => {
    if (!confirm('Delete selected students?')) return;
    const toRemove = [...document.querySelectorAll('.selStu:checked')]
      .map(cb => +cb.dataset.i)
      .sort((a,b) => b - a);
    toRemove.forEach(idx => students.splice(idx, 1));
    saveStudents();
    renderStudents();
    selectAll.checked = false;
  };

  function onBlur(e) {
    const td = e.target;
    const tr = td.closest('tr');
    const idx = +tr.querySelector('.selStu').dataset.i;
    const keys = ['name','adm','parent','contact','occupation','address'];
    const ci = Array.from(tr.children).indexOf(td);
    if (ci >= 1 && ci <= 6) {
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  }

  editSel.onclick = () => {
    if (savedReg) return;
    const checked = [...document.querySelectorAll('.selStu:checked')];
    if (!checked.length) return;
    inlineMode = !inlineMode;
    editSel.textContent = inlineMode ? 'Done Editing' : 'Edit Selected';
    checked.forEach(cb => {
      const tr = cb.closest('tr');
      [...tr.querySelectorAll('td')].forEach((td, ci) => {
        if (ci >= 1 && ci <= 6) {
          td.contentEditable = inlineMode;
          td.classList.toggle('editing', inlineMode);
          if (inlineMode) td.addEventListener('blur', onBlur);
          else td.removeEventListener('blur', onBlur);
        }
      });
    });
  };

  saveReg.onclick = () => {
    savedReg = true;
    [editSel, delSel, selectAll, saveReg].forEach(b => b.style.display = 'none');
    shareReg.classList.remove('hidden');
    editReg.classList.remove('hidden');
    downloadReg.classList.remove('hidden');
    renderStudents();
  };

  editReg.onclick = () => {
    savedReg = false;
    [editSel, delSel, selectAll, saveReg].forEach(b => b.style.display = '');
    shareReg.classList.add('hidden');
    editReg.classList.add('hidden');
    downloadReg.classList.add('hidden');
    renderStudents();
  };

  shareReg.onclick = () => {
    const hdr = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    const data = students.map(s =>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+data)}`, '_blank');
  };

  downloadReg.onclick = () => {
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
    y += 20;
    doc.autoTable({
      html: document.getElementById('studentTable'),
      startY: y,
      theme: 'grid',
      headStyles: { fillColor: [41,128,185], textColor:255, fontStyle:'bold' },
      styles: { fontSize:10, cellPadding:4 }
    });
    doc.save('Student_Registration.pdf');
  };

  renderStudents();

  // --- ATTENDANCE MARKING & SUMMARY ---
  const loadAttendanceBtn    = $('loadAttendance');
  const attendanceList       = $('attendanceList');
  const saveAttendanceBtn    = $('saveAttendance');
  const attendanceSection    = $('attendance-section');
  const attendanceResult     = $('attendance-result');
  const summaryBody          = $('summaryBody');
  const dateInput            = $('dateInput');
  let currentAttendance      = { date: '', statuses: [] };

  loadAttendanceBtn.onclick = () => {
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
        btn.onclick = () => {
          currentAttendance.statuses[i] = code;
          [...actions.children].forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          saveAttendanceBtn.classList.remove('hidden');
        };
        actions.appendChild(btn);
      });
      attendanceList.appendChild(actions);
    });
  };

  saveAttendanceBtn.onclick = () => {
    const { date, statuses } = currentAttendance;
    if (!date || statuses.includes(null)) { alert('Mark all statuses'); return; }
    const all = JSON.parse(localStorage.getItem('attendance') || '{}');
    all[date] = statuses;
    localStorage.setItem('attendance', JSON.stringify(all));
    showAttendanceSummary(date);
  };

  function showAttendanceSummary(date) {
    const all = JSON.parse(localStorage.getItem('attendance') || '{}');
    const statuses = all[date] || [];
    summaryBody.innerHTML = '';
    statuses.forEach((st,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${students[i].name}</td>
        <td>${st}</td>
        <td><button class="small share-row">Share</button></td>
      `;
      tr.querySelector('.share-row').onclick = () => {
        const hdr = `Date: ${date}\nSchool: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
        const msg = `${hdr}\nName: ${students[i].name}\nStatus: ${st}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      };
      summaryBody.appendChild(tr);
    });
    attendanceResult.classList.remove('hidden');
    attendanceSection.classList.add('hidden');
  }

  $('shareAttendanceSummary').onclick = () => {
    const date = dateInput.value;
    const header = [
      `Date: ${date}`,
      `School: ${localStorage.getItem('schoolName')}`,
      `Class: ${localStorage.getItem('teacherClass')}`,
      `Section: ${localStorage.getItem('teacherSection')}`,
      ''
    ].join('\n');

    const rows = Array.from(document.querySelectorAll('#summaryBody tr'));
    const blocks = rows.map(tr => {
      const name   = tr.children[0].textContent;
      const status = tr.children[1].textContent;
      const remark = { P:'Good attendance—keep it up!', A:'Please ensure regular attendance.', Lt:'Remember to arrive on time.', HD:'Submit permission note for half‑day.', L:'Attend when possible.' }[status] || '';
      return [`*Name:* ${name}`, `*Status:* ${status}`, `*Remarks:* ${remark}`, ''].join('\n');
    }).join('\n');

    const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
    rows.forEach(tr => {
      const st = tr.children[1].textContent;
      stats[st] = (stats[st]||0) + 1;
    });
    const total = rows.length;
    const avgPct = ((stats.P + stats.Lt + stats.HD) / total) * 100;
    const avgRemark = avgPct >= THRESHOLD ? 'Overall attendance is good.' : 'Overall attendance needs improvement.';
    const footer = [`Class Average: ${avgPct.toFixed(1)}%`, `Remarks: ${avgRemark}`].join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+blocks+'\n'+footer)}`, '_blank');
  };

  $('downloadAttendancePDF').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    let y = 20;
    const hdr = [
      `School: ${localStorage.getItem('schoolName')}`,
      `Class: ${localStorage.getItem('teacherClass')}`,
      `Section: ${localStorage.getItem('teacherSection')}`,
      `Date: ${dateInput.value}`
    ].join(' | ');
    doc.setFontSize(14);
    doc.text(hdr, 20, y);
    y += 20;
    doc.autoTable({
      html: document.getElementById('attendanceSummaryTable'),
      startY: y,
      theme: 'grid',
      headStyles: { fillColor:[41,128,185], textColor:255, fontStyle:'bold' },
      styles: { fontSize:10, cellPadding:4 }
    });
    doc.save(`Attendance_Summary_${dateInput.value}.pdf`);
  };

  $('resetAttendance').onclick = () => {
    attendanceResult.classList.add('hidden');
    attendanceSection.classList.remove('hidden');
    saveAttendanceBtn.classList.add('hidden');
  };

  // --- ANALYTICS (placeholder) ---
  $('loadAnalytics').onclick     = () => alert('Analytics coming soon.');
  $('resetAnalytics').onclick    = () => location.reload();
  $('shareAnalytics').onclick    = () => alert('Share analytics');
  $('downloadAnalytics').onclick = () => alert('Download analytics');
});
