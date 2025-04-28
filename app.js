// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // DOM helpers
  const $ = id => document.getElementById(id);
  const show = el => el && el.classList.remove('hidden');
  const hide = el => el && el.classList.add('hidden');

  // IndexedDB via idb-keyval
  if (!window.idbKeyval) {
    console.error('idbKeyval not found');
    return;
  }
  const { get, set } = window.idbKeyval;

  // Data stores
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

  // 1. SETUP
  async function loadSetup() {
    const [school, cls, sec] = await Promise.all([
      get('schoolName'), get('teacherClass'), get('teacherSection')
    ]);
    if (school && cls && sec) {
      $('schoolNameInput').value       = school;
      $('teacherClassSelect').value    = cls;
      $('teacherSectionSelect').value  = sec;
      $('setupText').textContent       = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
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
    if (!school || !cls || !sec) {
      alert('Complete setup');
      return;
    }
    await Promise.all([
      set('schoolName', school),
      set('teacherClass', cls),
      set('teacherSection', sec)
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => {
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };
  await loadSetup();

  // 2. COUNTERS
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
    $('sectionCount').dataset.target = students.filter(s => s.cls===cls && s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s => s.cls===cls).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); };

  // 3. STUDENT REGISTRATION
  let editMode = false;
  function renderStudents() {
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value,
          tbody = $('studentsBody');
    tbody.innerHTML = '';
    students.filter(s => s.cls===cls && s.sec===sec).forEach((stu, i) => {
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
    updateSelectionButtons();
  }
  $('addStudent').onclick = async e => {
    e.preventDefault();
    const name       = $('studentName').value.trim(),
          parent     = $('parentName').value.trim(),
          contact    = $('parentContact').value.trim(),
          occupation = $('parentOccupation').value.trim(),
          address    = $('parentAddress').value.trim(),
          cls        = $('teacherClassSelect').value,
          sec        = $('teacherSectionSelect').value;
    if (!name || !parent || !contact || !occupation || !address) {
      alert('All fields required');
      return;
    }
    if (!/^\d{7,15}$/.test(contact)) {
      alert('Contact must be 7–15 digits');
      return;
    }
    const adm = await generateAdmNo();
    students.push({ name, adm, parent, contact, occupation, address, cls, sec });
    await saveStudents();
    renderStudents();
    updateCounters();
  };

  function updateSelectionButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled   = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) {
      const tr = e.target.closest('tr');
      tr.classList.toggle('selected-row', e.target.checked);
      updateSelectionButtons();
    }
  });
  $('selectAllStudents').onclick = () => {
    const all = $('selectAllStudents').checked;
    document.querySelectorAll('.sel').forEach(cb => {
      cb.checked = all;
      cb.closest('tr').classList.toggle('selected-row', all);
    });
    updateSelectionButtons();
  };

  $('editSelected').onclick = () => {
    const btn = $('editSelected');
    const checkedBoxes = Array.from(document.querySelectorAll('.sel:checked'));
    if (!editMode) {
      // Enter edit mode
      checkedBoxes.forEach(cb => cb.closest('tr').classList.add('selected-row'));
      btn.innerHTML = `<i class="fas fa-check"></i> Done`;
      editMode = true;
    } else {
      // Exit edit mode
      checkedBoxes.forEach(cb => {
        const tr = cb.closest('tr');
        tr.classList.remove('selected-row');
        cb.checked = false;
      });
      btn.innerHTML = `<i class="fas fa-edit"></i> Edit`;
      editMode = false;
      updateSelectionButtons();
    }
  };

  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected?')) return;
    const toDelete = new Set(
      Array.from(document.querySelectorAll('.sel:checked'))
        .map(cb => +cb.closest('tr').dataset.index)
    );
    students = students.filter((_, i) => !toDelete.has(i));
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
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    const hdr = `Students | Class: ${cls} | Section: ${sec}`;
    const lines = students.map(s => `${s.adm}: ${s.name}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`, '_blank');
  };

  $('editRegistration').onclick = () => {
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => show($(id)));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id => hide($(id)));
  };

  // 4. MARK ATTENDANCE
  const { jsPDF } = window.jspdf;
  const attColors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };
  $('loadAttendance').onclick = () => {
    const body = $('attendanceBody');
    body.innerHTML = '';
    students.forEach((stu, idx) => {
      const row = document.createElement('div');
      row.className = 'attendance-row';
      const nameDiv = document.createElement('div');
      nameDiv.className = 'attendance-name';
      nameDiv.textContent = stu.name;
      const btns = document.createElement('div');
      btns.className = 'attendance-buttons';
      ['P','A','Lt','HD','L'].forEach(code => {
        const btn = document.createElement('button');
        btn.className = 'att-btn';
        btn.textContent = code;
        btn.onclick = () => {
          btns.querySelectorAll('.att-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          btn.style.background = attColors[code];
          btn.style.color = '#fff';
        };
        btns.appendChild(btn);
      });
      row.append(nameDiv, btns);
      body.appendChild(row);
    });
    show($('saveAttendance'));
    show($('resetAttendance'));
    show($('downloadAttendancePDF'));
    show($('shareAttendanceSummary'));
  };

  $('saveAttendance').onclick = async () => {
    const date = $('dateInput').value;
    if (!date) { alert('Pick a date'); return; }
    attendanceData[date] = {};
    document.querySelectorAll('.attendance-row').forEach((row, i) => {
      const sel = row.querySelector('.att-btn.selected');
      attendanceData[date][students[i].adm] = sel ? sel.textContent : 'A';
    });
    await saveAttendanceData();
    hide($('saveAttendance'));
  };

  $('resetAttendance').onclick = () => {
    $('attendanceBody').innerHTML = '';
    hide($('resetAttendance'));
    hide($('downloadAttendancePDF'));
    hide($('shareAttendanceSummary'));
  };

  $('downloadAttendancePDF').onclick = () => {
    const doc = new jsPDF();
    doc.text(JSON.stringify(attendanceData, null, 2), 10, 10);
    doc.save('attendance_summary.pdf');
  };

  $('shareAttendanceSummary').onclick = () => {
    const date = $('dateInput').value;
    const hdr = `Attendance Summary: ${date}`;
    const rows = Object.entries(attendanceData[date] || {})
      .map(([adm, status]) => `${adm}: ${status}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n' + rows.join('\n'))}`, '_blank');
  };

  // 5. ANALYTICS
  $('analyticsTarget').onchange = () => {
    $('analyticsFilter').classList.toggle('hidden', $('analyticsTarget').value !== 'student');
    $('analyticsType').disabled = false;
  };
  $('analyticsFilter').onchange = () => {
    const sel = $('analyticsStudentInput');
    sel.innerHTML = students.map(s => `<option value="${s.adm}">${s.adm}</option>`).join('');
    show(sel);
  };
  $('analyticsType').onchange = () => {
    ['analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart'].forEach(id => hide($(id)));
    const t = $('analyticsType').value;
    if (t === 'date') show($('analyticsDate'));
    if (t === 'month') show($('analyticsMonth'));
    if (t === 'semester') { show($('semesterStart')); show($('semesterEnd')); }
    if (t === 'year') show($('yearStart'));
    show($('resetAnalytics'));
  };
  $('resetAnalytics').onclick = e => {
    e.preventDefault();
    hide($('resetAnalytics'));
    $('analyticsType').value = '';
  };
  $('loadAnalytics').onclick = () => {
    const tgt = $('analyticsTarget').value;
    const typ = $('analyticsType').value;
    let from, to;
    if (typ === 'date')    from = to = $('analyticsDate').value;
    else if (typ === 'month') {
      const [y,m] = $('analyticsMonth').value.split('-').map(Number);
      from = `${y}-${String(m).padStart(2,'0')}-01`;
      to   = `${y}-${String(m).padStart(2,'0')}-${new Date(y,m,0).getDate()}`;
    }
    else if (typ === 'semester') {
      const [sy,sm] = $('semesterStart').value.split('-').map(Number);
      const [ey,em] = $('semesterEnd').value.split('-').map(Number);
      from = `${sy}-${String(sm).padStart(2,'0')}-01`;
      to   = `${ey}-${String(em).padStart(2,'0')}-${new Date(ey,em,0).getDate()}`;
    }
    else if (typ==='year') {
      const y = $('yearStart').value;
      from = `${y}-01-01`; to = `${y}-12-31`;
    } else { alert('Select period'); return; }

    let pool = students.slice();
    if (tgt==='section') pool = pool.filter(s => s.sec === $('analyticsSectionSelect').value);
    if (tgt==='student') pool = pool.filter(s => s.adm === $('analyticsStudentInput').value);

    // compute stats...
    const stats = pool.map(s => ({ name:s.name, adm:s.adm, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    Object.entries(attendanceData).forEach(([d,recs]) => {
      if (d < from || d > to) return;
      stats.forEach(st => {
        const c = recs[st.adm] || 'A';
        st[c]++; st.total++;
      });
    });

    // render table
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

    $('instructions').textContent = `Period: ${from} to ${to}`;
    show($('instructions'));
    show($('analyticsContainer'));
    show($('graphs'));
    show($('analyticsActions'));

    // charts
    const barCtx = $('barChart').getContext('2d');
    const pieCtx = $('pieChart').getContext('2d');
    if (window.barChart) window.barChart.destroy();
    if (window.pieChart) window.pieChart.destroy();
    window.barChart = new Chart(barCtx, {
      type:'bar',
      data:{
        labels: stats.map(s=>s.name),
        datasets:[{ label:'% Present', data: stats.map(s=>s.total? s.P/s.total*100 : 0 ) }]
      },
      options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
    });
    const agg = stats.reduce((a,s)=> { ['P','A','Lt','HD','L'].forEach(k=>a[k]+=s[k]); return a; },
      { P:0,A:0,Lt:0,HD:0,L:0 });
    window.pieChart = new Chart(pieCtx, {
      type:'pie',
      data:{ labels:['P','A','Lt','HD','L'], datasets:[{ data: Object.values(agg) }] }
    });
  };
  $('shareAnalytics').onclick = () => {
    const hdr = $('instructions').textContent;
    const rows = Array.from($('analyticsBody').children).map(tr=>tr.textContent.trim());
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`, '_blank');
  };
  $('downloadAnalytics').onclick = () => {
    const doc = new jsPDF();
    doc.autoTable({ html:'#analyticsTable' });
    doc.save('analytics.pdf');
  };

  // 6. ATTENDANCE REGISTER
  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value;
    if (!m) { alert('Pick month'); return; }
    const [y,mm] = m.split('-').map(Number);
    const days = new Date(y, mm, 0).getDate();
    const hdr = $('registerHeader');
    hdr.innerHTML = '<th>#</th><th>Adm#</th><th>Name</th>' +
      Array.from({length:days}, (_,i) => `<th>${i+1}</th>`).join('');
    const tb = $('registerBody'); tb.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
        Array.from({length:days}, ()=>`<td>A</td>`).join('');
      tb.appendChild(tr);
    });
    show($('registerTableWrapper'));
    show($('changeRegister'));
    show($('downloadRegister'));
    show($('shareRegister'));
    hide($('loadRegister'));
  };
  $('changeRegister').onclick = () => {
    hide($('registerTableWrapper'));
    hide($('changeRegister'));
    hide($('downloadRegister'));
    hide($('shareRegister'));
    show($('loadRegister'));
  };
  $('downloadRegister').onclick = () => {
    const doc = new jsPDF();
    doc.autoTable({ html:'#registerTable' });
    doc.save('attendance_register.pdf');
  };
  $('shareRegister').onclick = () => {
    const hdr = `Attendance Register: ${$('registerMonth').value}`;
    const rows = Array.from($('registerBody').children)
      .map(tr => Array.from(tr.children).map(td=>td.textContent).join(' '));
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`, '_blank');
  };

  // register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
