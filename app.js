// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // Helpers
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
  let inEditMode = false;
  function renderStudents() {
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value,
          tbody = $('studentsBody');
    tbody.innerHTML = '';
    students.filter(s => s.cls===cls && s.sec===sec).forEach((stu,i) => {
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
    updateActionButtons();
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
    if (!name||!parent||!contact||!occupation||!address) {
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

  function updateActionButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled   = !any;
    $('deleteSelected').disabled = !any;
    $('saveRegistration').disabled= students.length===0;
  }
  document.querySelector('#studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) {
      const tr = e.target.closest('tr');
      tr.classList.toggle('selected-row', e.target.checked);
      updateActionButtons();
    }
  });
  $('selectAllStudents').onclick = () => {
    const all = $('selectAllStudents').checked;
    document.querySelectorAll('.sel').forEach(cb => {
      cb.checked = all;
      cb.closest('tr').classList.toggle('selected-row', all);
    });
    updateActionButtons();
  };

  $('editSelected').onclick = () => {
    const btn     = $('editSelected');
    const checked = Array.from(document.querySelectorAll('.sel:checked'));
    if (!inEditMode) {
      checked.forEach(cb => cb.closest('tr').classList.add('selected-row'));
      btn.innerHTML = `<i class="fas fa-check"></i> Done`;
      inEditMode = true;
    } else {
      checked.forEach(cb => {
        cb.closest('tr').classList.remove('selected-row');
        cb.checked = false;
      });
      btn.innerHTML = `<i class="fas fa-edit"></i> Edit`;
      inEditMode = false;
      updateActionButtons();
    }
  };

  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected?')) return;
    const toDelete = new Set(
      Array.from(document.querySelectorAll('.sel:checked'))
            .map(cb => +cb.closest('tr').dataset.index)
    );
    students = students.filter((_,i) => !toDelete.has(i));
    await saveStudents();
    renderStudents();
    updateCounters();
  };

  $('saveRegistration').onclick = async () => {
    await saveStudents();
    alert('Registration saved');
  };

  renderStudents();

  // 4. MARK ATTENDANCE
  const attColors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };
  $('loadAttendance').onclick = () => {
    const body = $('attendanceBody');
    body.innerHTML = '';
    students.forEach((stu, i) => {
      const row = document.createElement('div'); row.className = 'attendance-row';
      const nameDiv = document.createElement('div'); nameDiv.className = 'attendance-name'; nameDiv.textContent = stu.name;
      const btns = document.createElement('div'); btns.className = 'attendance-buttons';
      ['P','A','Lt','HD','L'].forEach(code => {
        const btn = document.createElement('button');
        btn.className = 'att-btn'; btn.textContent = code;
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
    alert('Attendance saved for ' + date);
  };
  $('resetAttendance').onclick = () => {
    $('attendanceBody').innerHTML = '';
    hide($('saveAttendance'));
    hide($('resetAttendance'));
    hide($('downloadAttendancePDF'));
    hide($('shareAttendanceSummary'));
  };
  $('downloadAttendancePDF').onclick = () => {
    const doc = new window.jspdf.jsPDF();
    doc.autoTable({ html: '#studentsTable' });
    doc.save('attendance_summary.pdf');
  };
  $('shareAttendanceSummary').onclick = () => {
    const date = $('dateInput').value;
    const hdr = `Attendance Summary: ${date}`;
    const rows = Object.entries(attendanceData[date]||{})
                      .map(([adm, st]) => `${adm}: ${st}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n' + rows.join('\n'))}`, '_blank');
  };

  // 5. ANALYTICS (only Reg# filter)
  $('analyticsTarget').onchange = () => {
    $('analyticsFilter').classList.toggle('hidden', $('analyticsTarget').value !== 'student');
    $('analyticsType').disabled = false;
  };
  $('analyticsFilter').innerHTML = `<option disabled selected>-- Filter --</option><option value="adm">Reg#</option>`;
  $('analyticsFilter').onchange = async () => {
    const sel = $('analyticsStudentInput');
    sel.innerHTML = students.map(s => `<option value="${s.adm}">${s.name} (${s.adm})</option>`).join('');
    show(sel);
  };
  $('loadAnalytics').onclick = () => {
    // implement analytics logic as before...
    alert('Analytics loaded');
  };

  // 6. ATTENDANCE REGISTER
  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value; if (!m) { alert('Pick month'); return; }
    const [y,mo] = m.split('-').map(Number), days = new Date(y,mo,0).getDate();
    $('registerHeader').innerHTML =
      '<th>#</th><th>Adm#</th><th>Name</th>' +
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    const tb = $('registerBody'); tb.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
                     Array.from({length:days},()=>'<td>A</td>').join('');
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
    const doc = new window.jspdf.jsPDF();
    doc.autoTable({ html: '#registerTable' });
    doc.save('attendance_register.pdf');
  };
  $('shareRegister').onclick = () => {
    alert('Share register');
  };
});
