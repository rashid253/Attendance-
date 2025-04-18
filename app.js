window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };

  // SETUP
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

  // STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const studentNameIn = $('studentName');
  const admissionNoIn = $('admissionNo');
  const parentNameIn = $('parentName');
  const parentContactIn = $('parentContact');
  const parentOccupationIn = $('parentOccupation');
  const parentAddressIn = $('parentAddress');
  const addStudentBtn = $('addStudent');
  const studentsBody = $('studentsBody');
  const selectAllChk = $('selectAllStudents');
  const editSelectedBtn = $('editSelected');
  const deleteSelectedBtn = $('deleteSelected');
  const saveRegBtn = $('saveRegistration');
  const shareRegBtn = $('shareRegistration');
  const editRegBtn = $('editRegistration');
  const downloadRegPDFBtn = $('downloadRegistrationPDF');
  let regSaved = false;
  let inlineEdit = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved ? 'disabled' : ''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
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
      if (!regSaved) boxes.forEach(cb => { cb.checked = selectAllChk.checked; cb.dispatchEvent(new Event('change')); });
    };
  }

  addStudentBtn.onclick = ev => {
    ev.preventDefault();
    const name = studentNameIn.value.trim();
    const adm = admissionNoIn.value.trim();
    const parent = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occupation = parentOccupationIn.value.trim();
    const address = parentAddressIn.value.trim();
    if (!name || !adm || !parent || !contact || !occupation || !address) return alert('All fields required');
    if (!/^[0-9]+$/.test(adm)) return alert('Adm# must be numeric');
    if (!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits');
    students.push({ name, adm, parent, contact, occupation, address, roll: Date.now() });
    saveStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccupationIn, parentAddressIn].forEach(i => i.value = '');
  };

  function onCellBlur(e) {
    const td = e.target;
    const tr = td.closest('tr');
    const idx = +tr.querySelector('.sel').dataset.index;
    const ci = Array.from(tr.children).indexOf(td);
    const keys = ['name', 'adm', 'parent', 'contact', 'occupation', 'address'];
    if (ci >= 1 && ci <= 6) {
      students[idx][keys[ci - 1]] = td.textContent.trim();
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
      .sort((a, b) => b - a)
      .forEach(i => students.splice(i, 1));
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
    const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
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

  // ATTENDANCE
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
  const dateInput = $('dateInput');
  const loadAttBtn = $('loadAttendance');
  const attList = $('attendanceList');
  const saveAttBtn = $('saveAttendance');
  const resSection = $('attendance-result');
  const summaryBody = $('summaryBody');
  const resetAttBtn = $('resetAttendance');
  const shareAttBtn = $('shareAttendanceSummary');
  const downloadAttPDFBtn = $('downloadAttendancePDF');

  loadAttBtn.onclick = ev => {
    ev.preventDefault();
    if (!dateInput.value) return alert('Pick a date');
    attList.innerHTML = '';
    students.forEach(s => {
      const row = document.createElement('div');
      const btns = document.createElement('div');
      row.className = 'attendance-item'; row.textContent = s.name;
      btns.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'att-btn'; b.dataset.code = code; b.textContent = code;
        if (attendanceData[dateInput.value]?.[s.roll] === code) {
          b.style.background = colors[code]; b.style.color = '#fff';
        }
        b.onclick = e2 => {
          e2.preventDefault();
          btns.querySelectorAll('.att-btn').forEach(x => { x.style.background = ''; x.style.color = 'var(--dark)'; });
          b.style.background = colors[code]; b.style.color = '#fff';
        };
        btns.append(b);
      });
      attList.append(row, btns);
    });
    saveAttBtn.classList.remove('hidden');
  };

  saveAttBtn.onclick = ev => {
    ev.preventDefault();
    const d = dateInput.value;
    attendanceData[d] = {};
    attList.querySelectorAll('.attendance-actions').forEach((btns, i) => {
      const sel = btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll] = sel ? sel.dataset.code : 'A';
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    $('attendance-section').classList.add('hidden');
    resSection.classList.remove('hidden');
    summaryBody.innerHTML = '';
    const hdr = `Date: ${d}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    summaryBody.insertAdjacentHTML('beforebegin', `<tr><td colspan=\"3\"><em>${hdr}</em></td></tr>`);
    students.forEach(s => {
      const code = attendanceData[d][s.roll] || 'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class=\"send-btn\">Send</button></td>`;
      tr.querySelector('.send-btn').onclick = e2 => {
        e2.preventDefault();
        const msg = `${hdr}\n\nName: ${s.name}\nStatus: ${status}`;
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  resetAttBtn.onclick = ev => { ev.preventDefault(); resSection.classList.add('hidden'); $('attendance-section').classList.remove('hidden'); attList.innerHTML=''; saveAttBtn.classList.add('hidden'); summaryBody.innerHTML=''; };

  shareAttBtn.onclick = ev => {
    ev.preventDefault();
    const d = dateInput.value;
    const hdr = `Date: ${d}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const remarkMap = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'};
    const lines = students.map(s => `${s.name}: ${remarkMap[attendanceData[d][s.roll] || 'A']}`);
    const total = students.length;
    const pres  = students.reduce((sum,s) => sum + (attendanceData[d][s.roll]==='P'?1:0), 0);
    const pct   = total ? ((pres/total)*100).toFixed(1) : '0.0';
    const clsRemark = pct==100 ? 'Best' : pct>=75 ? 'Good' : pct>=50 ? 'Fair' : 'Poor';
    const summary = `Overall Attendance: ${pct}% | ${clsRemark}`;
    const msg     = [hdr, '', ...lines, '', summary].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  downloadAttPDFBtn.onclick = ev => { ev.preventDefault(); const { jsPDF } = window.jspdf; const doc = new jsPDF('p','pt','a4'); doc.autoTable({ head:[['Name','Status']], body: students.map(s=>{ const code=attendanceData[dateInput.value][s.roll]||'A'; return [s.name, {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]]; }), startY:40, margin:{left:40,right:40}, styles:{fontSize:10} }); doc.save('attendance_summary.pdf'); };

  // ANALYTICS
  const analyticsType = $('analyticsType');
  const analyticsDate = $('analyticsDate');
  const analyticsMonth = $('analyticsMonth');
  const semesterStart = $('semesterStart');
  const semesterEnd = $('semesterEnd');
  const yearStart = $('yearStart');
  const loadAnalyticsBtn = $('loadAnalytics');
  const resetAnalyticsBtn = $('resetAnalytics');
  const instructionsEl = $('instructions');
  const analyticsContainer = $('analyticsContainer');
  const graphsEl = $('graphs');
  const analyticsActionsEl = $('analyticsActions');
  const shareAnalyticsBtn = $('shareAnalytics');
  const downloadAnalyticsBtn = $('downloadAnalytics');
  const barCtx = document.getElementById('barChart').getContext('2d');
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  let barChart, pieChart;

  analyticsType.onchange = () => {
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart, instructionsEl, analyticsContainer, graphsEl, analyticsActionsEl, resetAnalyticsBtn]
      .forEach(el => el.classList.add('hidden'));
    if (analyticsType.value === 'date') analyticsDate.classList.remove('hidden');
    if (analyticsType.value === 'month') analyticsMonth.classList.remove('hidden');
    if (analyticsType.value === 'semester') { semesterStart.classList.remove('hidden'); semesterEnd.classList.remove('hidden'); }
    if (analyticsType.value === 'year') yearStart.classList.remove('hidden');
  };

  resetAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    analyticsType.value = '';
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart, instructionsEl, analyticsContainer, graphsEl, analyticsActionsEl, resetAnalyticsBtn]
      .forEach(el => el.classList.add('hidden'));
  };

  loadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    let from, to;
    if (analyticsType.value==='date') { if(!analyticsDate.value) return alert('Pick a date'); from = to = analyticsDate.value; }

    else if (analyticsType.value==='month') { if(!analyticsMonth.value) return alert('Pick a month'); from=analyticsMonth.value+'-01'; to=analyticsMonth.value+'-31'; }

    else if (analyticsType.value==='semester') { if(!semesterStart.value||!semesterEnd.value) return alert('Pick range'); from=semesterStart.value+'-01'; to=semesterEnd.value+'-31'; }

    else if (analyticsType.value==='year') { if(!yearStart.value) return alert('Pick a year'); from=yearStart.value+'-01-01'; to=yearStart.value+'-12-31'; }

    else return;

    const stats = students.map(s => ({ name: s.name, roll: s.roll, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    Object.entries(attendanceData).forEach(([d, recs]) => { if (d >= from && d <= to) stats.forEach(st => { const c = recs[st.roll] || 'A'; st[c]++; st.total++; }); });
    let html = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s => { const pct = s.total ? ((s.P/s.total)*100).toFixed(1) : '0.0'; html += `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`; });
    html += '</tbody></table>';
    analyticsContainer.innerHTML = html;
    analyticsContainer.classList.remove('hidden');
    instructionsEl.textContent = `Report: ${from} to ${to}`;
    instructionsEl.classList.remove('hidden');
    resetAnalyticsBtn.classList.remove('hidden');

    const labels = stats.map(s => s.name);
    const dataPct = stats.map(s => s.total ? s.P/s.total*100 : 0);
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, { type:'bar', data:{ labels, datasets:[{ label:'% Present', data:dataPct }] }, options:{ maintainAspectRatio:true } });
    const agg = stats.reduce((a,s) => { ['P','A','Lt','HD','L'].forEach(c => a[c]+=s[c]); return a; }, {P:0,A:0,Lt:0,HD:0,L:0});
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, { type:'pie', data:{ labels:['P','A','Lt','HD','L'], datasets:[{ data:Object.values(agg) }] }, options:{ maintainAspectRatio:true } });
    graphsEl.classList.remove('hidden');
    analyticsActionsEl.classList.remove('hidden');
  };

  shareAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    const period = instructionsEl.textContent.replace('Report: ','');
    const hdr = `Date Range: ${period}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const rows = Array.from(analyticsContainer.querySelectorAll('tbody tr')).map(r => {
      const [name,p,a,lt,hd,l,total,pct] = Array.from(r.querySelectorAll('td')).map(td => td.textContent);
      return `${name} P:${p} A:${a} Lt:${lt} HD:${hd} L:${l} Total:${total} %:${pct}`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + rows)}`, '_blank');
  };

  downloadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    doc.setFontSize(14);
    doc.text(localStorage.getItem('schoolName'), 40, 30);
    doc.setFontSize(12);
    doc.text(`Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`, 40, 45);
    doc.text(instructionsEl.textContent.replace('Report: ', 'Period: '), 40, 60);
    doc.autoTable({
      head: [['Name','P','A','Lt','HD','L','Total','%']],
      body: Array.from(analyticsContainer.querySelectorAll('tbody tr')).map(r => Array.from(r.querySelectorAll('td')).map(td=>td.textContent)),
      startY: 75,
      margin: { left:40, right:40 },
      styles: { fontSize:8 }
    });
    const y = doc.lastAutoTable.finalY + 10;
    const w = 120, h = 80;
    doc.addImage(barChart.toBase64Image(), 'PNG', 40, y, w, h);
    doc.addImage(pieChart.toBase64Image(), 'PNG', 40 + w + 20, y, w, h);
    doc.save('analytics_report.pdf');
  };
});
