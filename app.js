// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- 0. Debug console (Eruda should be loaded in HTML) ---

  // --- 1. IndexedDB helpers via idb-keyval IIFE ---
  if (!window.idbKeyval) {
    console.error('idbKeyval not found; include the iife script in your HTML');
    return;
  }
  const { get, set } = window.idbKeyval;

  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;

  const saveStudents       = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);
  const saveLastAdmNo      = () => set('lastAdmissionNo', lastAdmNo);

  async function generateAdmNo() {
    lastAdmNo++;
    await saveLastAdmNo();
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 2. DOM helpers ---
  const $ = id => document.getElementById(id);
  const show = el => el && el.classList.remove('hidden');
  const hide = el => el && el.classList.add('hidden');

  // --- 3. SETUP ---
  async function loadSetup() {
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if (school && cls && sec) {
      $('schoolNameInput').value      = school;
      $('teacherClassSelect').value   = cls;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent      = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderStudents();
      updateCounters();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const school = $('schoolNameInput').value.trim(),
          cls    = $('teacherClassSelect').value,
          sec    = $('teacherSectionSelect').value;
    if (!school || !cls || !sec) return alert('Complete setup');
    await set('schoolName', school);
    await set('teacherClass', cls);
    await set('teacherSection', sec);
    await loadSetup();
  };
  $('editSetup').onclick = e => {
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };
  await loadSetup();

  // --- 4. COUNTERS ---
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
  $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); };

  // --- 5. STUDENT REGISTRATION ---
  function renderStudents() {
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value,
          tbody = $('studentsBody');
    tbody.innerHTML = '';
    students
      .filter(s => s.cls === cls && s.sec === sec)
      .forEach((stu, i) => {
        const tr = document.createElement('tr');
        tr.dataset.index = i;
        tr.innerHTML = `
          <td><input type="checkbox" class="sel"></td>
          <td>${i+1}</td>
          <td>${stu.name}</td>
          <td>${stu.adm}</td>
          <td>${stu.parent}</td>
          <td>${stu.contact}</td>
          <td>${stu.occupation}</td>
          <td>${stu.address}</td>
        `;
        tbody.appendChild(tr);
      });
    $('selectAllStudents').checked = false;
    toggleSelectionButtons();
  }

  $('addStudent').onclick = async e => {
    e.preventDefault();
    const name = $('studentName').value.trim(),
          parent = $('parentName').value.trim(),
          contact = $('parentContact').value.trim(),
          occupation = $('parentOccupation').value.trim(),
          address = $('parentAddress').value.trim(),
          cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    if (!name || !parent || !contact || !occupation || !address) {
      return alert('All fields required');
    }
    if (!/^\d{7,15}$/.test(contact)) {
      return alert('Contact must be 7–15 digits');
    }
    const adm = await generateAdmNo();
    students.push({ name, adm, parent, contact, occupation, address, cls, sec });
    await saveStudents();
    renderStudents();
    updateCounters();
  };

  function toggleSelectionButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled   = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleSelectionButtons();
  });
  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(cb => cb.checked = $('selectAllStudents').checked);
    toggleSelectionButtons();
  };

  $('deleteSelected').onclick = async e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    students = students.filter((_, i) => {
      return !Array.from(document.querySelectorAll('.sel'))
        .some(cb => cb.checked && +cb.closest('tr').dataset.index === i);
    });
    await saveStudents();
    renderStudents();
    updateCounters();
  };

  $('saveRegistration').onclick = async () => {
    await saveStudents();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => hide($(id)));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id => show($(id)));
  };
  $('downloadRegistrationPDF').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html: '#studentsTable' });
    doc.save('registration.pdf');
  };
  $('shareRegistration').onclick = () => {
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const hdr = `Students | Class: ${cls} | Section: ${sec}`;
    const lines = students.map(s => `${s.adm}: ${s.name}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`, '_blank');
  };
  $('editRegistration').onclick = e => {
    e.preventDefault();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => show($(id)));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id => hide($(id)));
  };

  // --- 6. MARK ATTENDANCE ---
  const dateInput             = $('dateInput'),
        loadAttendance        = $('loadAttendance'),
        saveAttendance        = $('saveAttendance'),
        resetAttendance       = $('resetAttendance'),
        downloadAttendancePDF = $('downloadAttendancePDF'),
        shareAttendanceSummary= $('shareAttendanceSummary'),
        attendanceBody        = $('attendanceBody'),
        attendanceSummary     = $('attendanceSummary');
  const attColors = {
    P: 'var(--success)',
    A: 'var(--danger)',
    Lt: 'var(--warning)',
    HD: '#FF9800',
    L: 'var(--info)'
  };

  loadAttendance.onclick = () => {
    attendanceBody.innerHTML = '';
    students.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'attendance-row';
      const nm = document.createElement('div');
      nm.className = 'attendance-name';
      nm.textContent = s.name;
      const btns = document.createElement('div');
      btns.className = 'attendance-buttons';
      ['P','A','Lt','HD','L'].forEach(code => {
        const btn = document.createElement('button');
        btn.className = 'att-btn';
        btn.textContent = code;
        btn.style.background = 'rgba(33,150,243,0.1)';
        btn.onclick = () => {
          btns.querySelectorAll('.att-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          btn.style.background = attColors[code];
          btn.style.color = '#fff';
        };
        btns.appendChild(btn);
      });
      row.append(nm, btns);
      attendanceBody.appendChild(row);
    });
    show(saveAttendance);
    hide(resetAttendance);
    hide(downloadAttendancePDF);
    hide(shareAttendanceSummary);
    hide(attendanceSummary);
  };

  saveAttendance.onclick = async () => {
    const date = dateInput.value;
    if (!date) return alert('Pick a date');
    attendanceData[date] = {};
    document.querySelectorAll('.attendance-row').forEach((row, i) => {
      const sel = row.querySelector('.att-btn.selected');
      attendanceData[date][students[i].adm] = sel ? sel.textContent : 'A';
    });
    await saveAttendanceData();

    hide(saveAttendance);
    hide(attendanceBody);

    attendanceSummary.innerHTML = `
      <h4>Attendance Report</h4>
      <h4>Date: ${date}</h4>
      <ul>
        ${students.map(s => `
          <li>
            <span class="name">${s.name}</span>
            <span class="status">${attendanceData[date][s.adm]}</span>
          </li>
        `).join('')}
      </ul>
    `;
    show(attendanceSummary);
    show(resetAttendance);
    show(downloadAttendancePDF);
    show(shareAttendanceSummary);
  };

  downloadAttendancePDF.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(attendanceSummary.innerText, 10, 10);
    doc.save('attendance_summary.pdf');
  };
  shareAttendanceSummary.onclick = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(attendanceSummary.innerText)}`, '_blank');
  };
  resetAttendance.onclick = () => {
    show(attendanceBody);
    show(saveAttendance);
    hide(attendanceSummary);
    hide(resetAttendance);
    hide(downloadAttendancePDF);
    hide(shareAttendanceSummary);
  };

  // --- 7. ANALYTICS ---
  const analyticsTarget      = $('analyticsTarget'),
        analyticsSectionSel  = $('analyticsSectionSelect'),
        analyticsFilter      = $('analyticsFilter'),
        analyticsStudentSel  = $('analyticsStudentInput'),
        analyticsTypeSel     = $('analyticsType'),
        analyticsDateInput   = $('analyticsDate'),
        analyticsMonthInput  = $('analyticsMonth'),
        semesterStartInput   = $('semesterStart'),
        semesterEndInput     = $('semesterEnd'),
        yearStartInput       = $('yearStart'),
        loadAnalyticsBtn     = $('loadAnalytics'),
        resetAnalyticsBtn    = $('resetAnalytics'),
        instructionsEl       = $('instructions'),
        analyticsContainerEl = $('analyticsContainer'),
        graphsEl             = $('graphs'),
        analyticsActionsEl   = $('analyticsActions'),
        shareAnalyticsBtn    = $('shareAnalytics'),
        downloadAnalyticsBtn = $('downloadAnalytics'),
        barCtx               = $('barChart').getContext('2d'),
        pieCtx               = $('pieChart').getContext('2d');
  let barChart, pieChart;

  function hideAllAnalytics() {
    [
      analyticsDateInput, analyticsMonthInput,
      semesterStartInput, semesterEndInput,
      yearStartInput, instructionsEl,
      analyticsContainerEl, graphsEl,
      analyticsActionsEl, resetAnalyticsBtn
    ].forEach(hide);
  }
  analyticsTarget.onchange = () => {
    analyticsTypeSel.disabled = false;
    hideAllAnalytics();
    analyticsSectionSel.classList.toggle('hidden', analyticsTarget.value !== 'section');
    analyticsFilter.classList.toggle('hidden', analyticsTarget.value !== 'student');
    analyticsStudentSel.classList.add('hidden');
  };
  analyticsFilter.onchange = () => {
    analyticsStudentSel.innerHTML = '<option disabled selected>-- Pick --</option>' +
      students.map(s => `<option value="${s.adm}">${s.name} (${s.adm})</option>`).join('');
    show(analyticsStudentSel);
  };
  analyticsTypeSel.onchange = () => {
    hideAllAnalytics();
    if (analyticsTypeSel.value === 'date') show(analyticsDateInput);
    if (analyticsTypeSel.value === 'month') show(analyticsMonthInput);
    if (analyticsTypeSel.value === 'semester') { show(semesterStartInput); show(semesterEndInput); }
    if (analyticsTypeSel.value === 'year') show(yearStartInput);
    show(resetAnalyticsBtn);
  };
  resetAnalyticsBtn.onclick = e => {
    e.preventDefault();
    hideAllAnalytics();
    analyticsTypeSel.value = '';
  };
  loadAnalyticsBtn.onclick = () => {
    const tgt = analyticsTarget.value,
          typ = analyticsTypeSel.value;
    let from, to;
    if (typ === 'date') {
      from = to = analyticsDateInput.value;
    } else if (typ === 'month') {
      const [y,m] = analyticsMonthInput.value.split('-').map(Number);
      from = `${analyticsMonthInput.value}-01`;
      to   = `${analyticsMonthInput.value}-${new Date(y,m,0).getDate()}`;
    } else if (typ === 'semester') {
      const [sy,sm] = semesterStartInput.value.split('-').map(Number);
      const [ey,em] = semesterEndInput.value.split('-').map(Number);
      from = `${semesterStartInput.value}-01`;
      to   = `${semesterEndInput.value}-${new Date(ey,em,0).getDate()}`;
    } else if (typ === 'year') {
      from = `${yearStartInput.value}-01-01`;
      to   = `${yearStartInput.value}-12-31`;
    } else {
      return alert('Select period');
    }

    let pool = students.slice();
    if (tgt === 'section') pool = pool.filter(s => s.sec === analyticsSectionSel.value);
    if (tgt === 'student') pool = pool.filter(s => s.adm === analyticsStudentSel.value);

    const stats = pool.map(s => ({ name: s.name, adm: s.adm, P:0,A:0,Lt:0,HD:0,L:0, total:0 }));
    Object.entries(attendanceData).forEach(([d,recs]) => {
      if (d < from || d > to) return;
      stats.forEach(st => {
        const c = recs[st.adm] || 'A';
        st[c]++; st.total++;
      });
    });

    const thead = $('analyticsTable').querySelector('thead tr');
    thead.innerHTML = '<th>#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th>';
    const tbody = $('analyticsBody');
    tbody.innerHTML = '';
    stats.forEach((st,i) => {
      const pct = st.total ? ((st.P/st.total)*100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td>
                      <td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${pct}%</td>`;
      tbody.appendChild(tr);
    });

    instructionsEl.textContent = `Period: ${from} to ${to}`;
    show(instructionsEl);
    show(analyticsContainerEl);
    show(graphsEl);
    show(analyticsActionsEl);

    barChart?.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: { labels: stats.map(s=>s.name), datasets: [{ label: '% Present', data: stats.map(s=>s.total? s.P/s.total*100:0) }] },
      options: { scales: { y: { beginAtZero:true, max:100 } } }
    });
    const agg = stats.reduce((acc,s) => { ['P','A','Lt','HD','L'].forEach(k=>acc[k]+=s[k]); return acc; }, {P:0,A:0,Lt:0,HD:0,L:0});
    pieChart?.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: { labels:['P','A','Lt','HD','L'], datasets:[{ data:Object.values(agg) }] }
    });
  };
  shareAnalyticsBtn.onclick = () => {
    const hdr = instructionsEl.textContent;
    const rows = Array.from($('analyticsBody').children).map(tr=>tr.textContent.trim());
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`, '_blank');
  };
  downloadAnalyticsBtn.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html:'#analyticsTable' });
    doc.save('analytics.pdf');
  };

  // --- 8. ATTENDANCE REGISTER ---
  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value; if (!m) return alert('Pick month');
    const [y,mm] = m.split('-').map(Number), days = new Date(y,mm,0).getDate();
    const hdr = $('registerHeader');
    hdr.innerHTML = '<th>#</th><th>Adm#</th><th>Name</th>' +
      Array.from({ length: days }, (_,i) => `<th>${i+1}</th>`).join('');
    const tb = $('registerBody'); tb.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
        Array.from({ length: days }, ()=>`<td>${attendanceData[`${m}-${String(i+1).padStart(2,'0')}`]||'A'}</td>`).join('');
      tb.appendChild(tr);
    });
    show($('registerTableWrapper'));
    show($('changeRegister'));
    hide($('loadRegister'));
  };
  $('changeRegister').onclick = () => {
    hide($('registerTableWrapper'));
    hide($('changeRegister'));
    show($('loadRegister'));
  };

  // --- 9. Optional: Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
