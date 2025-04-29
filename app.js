// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // — Eruda debug console —
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // — idb-keyval IndexedDB helpers —
  if (!window.idbKeyval) { console.error('idbKeyval not found'); return; }
  const { get, set } = window.idbKeyval;

  // — State —
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;

  // — Utility functions —
  const saveStudents       = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);
  const saveLastAdmNo      = () => set('lastAdmissionNo', lastAdmNo);
  async function generateAdmNo() {
    lastAdmNo++;
    await saveLastAdmNo();
    return String(lastAdmNo).padStart(4, '0');
  }
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // — 1. SETUP —
  async function loadSetup() {
    const [school, cls, sec] = await Promise.all([
      get('schoolName'), get('teacherClass'), get('teacherSection')
    ]);
    if (school && cls && sec) {
      $('schoolNameInput').value = school;
      $('teacherClassSelect').value = cls;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${school} | Class: ${cls} | Section: ${sec}`;
      hide($('setupForm')); show($('setupDisplay'));
      renderStudents();
      updateCounters();
      resetAllViews();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const school = $('schoolNameInput').value.trim(),
          cls    = $('teacherClassSelect').value,
          sec    = $('teacherSectionSelect').value;
    if (!school || !cls || !sec) { alert('Complete setup'); return; }
    await Promise.all([
      set('schoolName', school),
      set('teacherClass', cls),
      set('teacherSection', sec)
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // — 2. COUNTERS —
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target / 100);
      (function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
      })();
    });
  }
  function updateCounters() {
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s => s.cls === cls && s.sec === sec).length;
    $('classCount').dataset.target   = students.filter(s => s.cls === cls).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  $('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); resetAllViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetAllViews(); };

  // — 3. STUDENT REGISTRATION —
  const regForm = $('regForm');

  function renderStudents() {
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value,
          tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idxDisplay = 0;
    students.forEach((s, i) => {
      if (s.cls !== cls || s.sec !== sec) return;
      idxDisplay++;
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idxDisplay}</td>
        <td>${s.name}</td>
        <td>${s.adm}</td>
        <td>${s.parent}</td>
        <td>${s.contact}</td>
        <td>${s.occupation}</td>
        <td>${s.address}</td>
        <td></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleRegButtons();
  }
  function toggleRegButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleRegButtons();
  });
  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(cb => cb.checked = $('selectAllStudents').checked);
    toggleRegButtons();
  };

  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n = $('studentName').value.trim(),
          p = $('parentName').value.trim(),
          c = $('parentContact').value.trim(),
          o = $('parentOccupation').value.trim(),
          a = $('parentAddress').value.trim(),
          cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    if (!n || !p || !c || !o || !a) { alert('All fields required'); return; }
    if (!/^\d{7,15}$/.test(c)) { alert('Contact must be 7–15 digits'); return; }
    const adm = await generateAdmNo();
    students.push({ name: n, adm, parent: p, contact: c, occupation: o, address: a, cls, sec });
    await saveStudents();
    renderStudents();
    updateCounters();
    resetAllViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id => $(id).value = '');
  };

  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach(cb => {
      const tr = cb.closest('tr'),
            i  = +tr.dataset.index,
            s  = students[i];
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" checked></td>
        <td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"></td>
        <td>${s.adm}</td>
        <td><input value="${s.parent}"></td>
        <td><input value="${s.contact}"></td>
        <td><input value="${s.occupation}"></td>
        <td><input value="${s.address}"></td>
        <td></td>
      `;
    });
    hide($('editSelected'));
    show($('doneEditing'));
  };
  $('doneEditing').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach(tr => {
      const inputs = tr.querySelectorAll('input:not(.sel)');
      if (inputs.length === 5) {
        const [n,p,c,o,a] = Array.from(inputs).map(i => i.value.trim()),
              adm = tr.children[3].textContent,
              idx = students.findIndex(s => s.adm === adm);
        if (idx > -1) students[idx] = { ...students[idx], name: n, parent: p, contact: c, occupation: o, address: a };
      }
    });
    await saveStudents();
    hide($('doneEditing'));
    show($('editSelected'), $('deleteSelected'), $('saveRegistration'));
    renderStudents();
    updateCounters();
  };

  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected?')) return;
    const toDel = Array.from(document.querySelectorAll('.sel:checked')).map(cb => +cb.closest('tr').dataset.index);
    students = students.filter((_, i) => !toDel.includes(i));
    await saveStudents();
    renderStudents();
    updateCounters();
    resetAllViews();
  };

  $('saveRegistration').onclick = async () => {
    if (!$('doneEditing').classList.contains('hidden')) {
      alert('Finish editing first'); return;
    }
    await saveStudents();
    hide(regForm, $('editSelected'), $('deleteSelected'), $('selectAllStudents'), $('saveRegistration'));
    show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
  };
  $('editRegistration').onclick = () => {
    show(regForm, $('selectAllStudents'), $('editSelected'), $('deleteSelected'), $('saveRegistration'));
    hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents();
  };

  // — 4. MARK ATTENDANCE —
  const dateInput = $('dateInput'),
        loadAttendance = $('loadAttendance'),
        saveAttendance = $('saveAttendance'),
        resetAttendance = $('resetAttendance'),
        downloadAttendancePDF = $('downloadAttendancePDF'),
        shareAttendanceSummary = $('shareAttendanceSummary'),
        attendanceBody = $('attendanceBody'),
        attendanceSummary = $('attendanceSummary');
  const statusNames = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' };

  loadAttendance.onclick = () => {
    attendanceBody.innerHTML = '';
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    const roster = students.filter(s => s.cls === cls && s.sec === sec);
    roster.forEach(stu => {
      const row = document.createElement('div'); row.className = 'attendance-row';
      const nameDiv = document.createElement('div'); nameDiv.className = 'attendance-name'; nameDiv.textContent = stu.name;
      const btns = document.createElement('div'); btns.className = 'attendance-buttons';
      ['P','A','Lt','HD','L'].forEach(code => {
        const btn = document.createElement('button'); btn.className = 'att-btn'; btn.textContent = code;
        btn.onclick = () => {
          btns.querySelectorAll('.att-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        };
        btns.appendChild(btn);
      });
      row.append(nameDiv, btns);
      attendanceBody.append(row);
    });
    show(attendanceBody, saveAttendance);
    hide(resetAttendance, downloadAttendancePDF, shareAttendanceSummary, attendanceSummary);
  };

  saveAttendance.onclick = async () => {
    const dt = dateInput.value; if (!dt) { alert('Pick date'); return; }
    attendanceData[dt] = {};
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const roster = students.filter(s => s.cls === cls && s.sec === sec);
    roster.forEach((s,i) => {
      const btn = attendanceBody.children[i].querySelector('.att-btn.selected');
      attendanceData[dt][s.adm] = btn ? btn.textContent : 'A';
    });
    await saveAttendanceData();
    attendanceSummary.innerHTML = `<h3>Date: ${dt}</h3>`;
    const tbl = document.createElement('table');
    tbl.innerHTML = '<tr><th>Name</th><th>Status</th></tr>';
    roster.forEach(s => {
      const code = attendanceData[dt][s.adm];
      tbl.innerHTML += `<tr><td>${s.name}</td><td>${statusNames[code]}</td></tr>`;
    });
    attendanceSummary.append(tbl);
    hide(saveAttendance, attendanceBody);
    show(resetAttendance, downloadAttendancePDF, shareAttendanceSummary, attendanceSummary);
  };

  downloadAttendancePDF.onclick = () => {
    const dt = dateInput.value;
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    if (dt) doc.text(`Date: ${dt}`,14,32);
    doc.autoTable({ startY: dt?40:32, html: '#attendanceSummary table' });
    const pc = doc.getNumberOfPages();
    for (let i=1; i<=pc; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.text('FAIQTECH SOL', doc.internal.pageSize.getWidth()/2, doc.internal.pageSize.getHeight()-10, { align:'center' });
    }
    window.open(doc.output('bloburl'), '_blank');
    doc.save('attendance_summary.pdf');
  };

  // — 5. ANALYTICS —
  const analyticsControls = $('analyticsControls'),
        analyticsTarget = $('analyticsTarget'),
        analyticsSectionSel = $('analyticsSectionSelect'),
        analyticsType = $('analyticsType'),
        analyticsDate = $('analyticsDate'),
        analyticsMonth = $('analyticsMonth'),
        yearStart = $('yearStart'),
        analyticsSearch = $('analyticsSearch'),
        loadAnalyticsBtn = $('loadAnalytics'),
        resetAnalyticsBtn = $('resetAnalytics'),
        instructionsEl = $('instructions'),
        analyticsContainer = $('analyticsContainer'),
        graphsEl = $('graphs'),
        analyticsActions = $('analyticsActions'),
        barCtx = $('barChart').getContext('2d'),
        pieCtx = $('pieChart').getContext('2d');
  let barChart, pieChart;

  analyticsTarget.onchange = () => {
    analyticsType.disabled = false;
    show(analyticsControls);
    hide(analyticsSectionSel, analyticsSearch);
  };
  analyticsType.onchange = () => {
    hide(analyticsDate, analyticsMonth, yearStart);
    if (analyticsType.value === 'date') show(analyticsDate);
    if (analyticsType.value === 'month') show(analyticsMonth);
    if (analyticsType.value === 'year') show(yearStart);
    show(resetAnalyticsBtn, loadAnalyticsBtn);
  };
  loadAnalyticsBtn.onclick = () => {
    // compute stats, render table & charts...
    hide(analyticsSectionSel, analyticsType, analyticsDate, analyticsMonth, yearStart, analyticsSearch);
    show(instructionsEl, analyticsContainer, graphsEl, analyticsActions);
  };
  resetAnalyticsBtn.onclick = e => {
    e.preventDefault();
    show(analyticsControls);
    hide(instructionsEl, analyticsContainer, graphsEl, analyticsActions, resetAnalyticsBtn);
  };

  // — 6. ATTENDANCE REGISTER —
  const registerControls = $('registerControls'),
        loadRegisterBtn = $('loadRegister'),
        changeRegisterBtn = $('changeRegister'),
        saveRegisterBtn = $('saveRegister'),
        downloadRegister = $('downloadRegister'),
        shareRegister = $('shareRegister'),
        monthInput = $('registerMonth'),
        registerHeader = $('registerHeader'),
        registerBody = $('registerBody'),
        registerWrapper = $('registerTableWrapper');

  loadRegisterBtn.onclick = () => {
    const m = monthInput.value;
    if (!m) { alert('Pick month'); return; }
    const [y,mm] = m.split('-').map(Number),
          days = new Date(y,mm,0).getDate();
    registerHeader.innerHTML = '<th>#</th><th>Adm#</th><th>Name</th>' +
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    registerBody.innerHTML = '';
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cls&&s.sec===sec);
    roster.forEach((s,i) => {
      let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1; d<=days; d++){
        row += `<td class="reg-cell"><span class="status-text">A</span></td>`;
      }
      const tr = document.createElement('tr');
      tr.innerHTML = row;
      registerBody.appendChild(tr);
    });
    // make cells clickable...
    registerBody.querySelectorAll('.reg-cell').forEach(cell=>{
      cell.onclick = () => {
        const span = cell.querySelector('.status-text'),
              codes = ['A','P','Lt','HD','L'],
              idx = (codes.indexOf(span.textContent)+1) % codes.length,
              code = codes[idx];
        span.textContent = code;
        if (code==='A'){ cell.style.background=''; cell.style.color=''; }
        else { cell.style.background = statusColors[code]; cell.style.color='#fff'; }
      };
    });
    hide(monthInput, loadRegisterBtn);
    show(saveRegisterBtn, changeRegisterBtn, registerWrapper);
  };

  saveRegisterBtn.onclick = async () => {
    const m = monthInput.value, [y,mm] = m.split('-').map(Number),
          days = new Date(y,mm,0).getDate();
    Array.from(registerBody.children).forEach(tr => {
      const adm = tr.children[1].textContent;
      for (let d=0; d<days; d++){
        const code = tr.children[3+d].querySelector('.status-text').textContent,
              key = `${m}-${String(d+1).padStart(2,'0')}`;
        attendanceData[key] = attendanceData[key]||{};
        attendanceData[key][adm] = code;
      }
    });
    await saveAttendanceData();
    hide(saveRegisterBtn);
    show(downloadRegister, shareRegister);
    registerWrapper.prepend(Object.assign(document.createElement('h3'),{textContent:`Month: ${monthInput.value}`}));
  };

  changeRegisterBtn.onclick = () => {
    show(monthInput, loadRegisterBtn);
    hide(changeRegisterBtn, downloadRegister, shareRegister, saveRegisterBtn, registerWrapper.querySelector('h3'));
    registerWrapper.classList.add('hidden');
  };

  // — Service Worker —
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
