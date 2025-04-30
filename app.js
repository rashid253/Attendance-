// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- 0. Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);
  
  // --- 1. IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) {
    console.error('idb-keyval not found');
    return;
  }
  
  const { get, set } = window.idbKeyval;
  const save = (key, val) => set(key, val);
  
  // --- 2. State & Defaults ---
  let students = await get('students') || [];
  let attendanceData = await get('attendanceData') || {};
  let finesData = await get('finesData') || {};
  let paymentsData = await get('paymentsData') || {};
  let lastAdmNo = await get('lastAdmissionNo') || 0;
  let fineRates = await get('fineRates') || { A: 50, Lt: 20, L: 10, HD: 0 };
  let eligibilityPct = await get('eligibilityPct') || 75;

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 3. DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // Cache registration form container
  const regForm = document.querySelector('#student-registration .row-inline');

  // --- 4. SETTINGS: Fines & Eligibility ---
  $('fineAbsent').value = fineRates.A;
  $('fineLate').value = fineRates.Lt;
  $('fineLeave').value = fineRates.L;
  $('fineHalfDay').value = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  $('saveSettings').onclick = async () => {
    fineRates = {
      A: Number($('fineAbsent').value) || 0,
      Lt: Number($('fineLate').value) || 0,
      L: Number($('fineLeave').value) || 0,
      HD: Number($('fineHalfDay').value) || 0,
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);
    alert('Fines & eligibility settings saved');
  };

  // --- 5. SETUP: School, Class & Section ---
  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([
      get('schoolName'),
      get('teacherClass'),
      get('teacherSection')
    ]);
    if (sc && cl && sec) {
      $('schoolNameInput').value = sc;
      $('teacherClassSelect').value = cl;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderStudents();
      updateCounters();
      resetViews();
    }
  }

  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc = $('schoolNameInput').value.trim();
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!sc || !cl || !sec) {
      alert('Please complete the setup form');
      return;
    }
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    await loadSetup();
  };

  $('editSetup').onclick = e => {
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };

  await loadSetup();

  // --- 6. COUNTERS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target / 100);
      (function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) {
          requestAnimationFrame(update);
        }
      })();
    });
  }

  function updateCounters() {
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s => s.cls === cl && s.sec === sec).length;
    $('classCount').dataset.target = students.filter(s => s.cls === cl).length;
    $('schoolCount').dataset.target = students.length;
    animateCounters();
  }

  $('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  function resetViews() {
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'),
      $('registerTableWrapper'), $('changeRegister'), $('saveRegister'),
      $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }

  // --- 7. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx = 0;

    students.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;

      // compute attendance counts
      const stats = { P: 0, A: 0, Lt: 0, HD: 0, L: 0 };
      Object.values(attendanceData).forEach(recs => {
        const c = recs[s.adm] || 'A';
        stats[c]++;
      });

      // compute fine and outstanding
      const totalFine = stats.A * fineRates.A
        + stats.Lt * fineRates.Lt
        + stats.L * fineRates.L
        + stats.HD * fineRates.HD;
      const totalPaid = (paymentsData[s.adm] || [])
        .reduce((sum, p) => sum + p.amount, 0);
      const outstanding = totalFine - totalPaid;

      // compute attendance %
      const totalDays = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const pctPresent = totalDays ? (stats.P / totalDays) * 100 : 0;

      // determine status
      const status = (outstanding > 0 || pctPresent < eligibilityPct) ? 'Debarred' : 'Eligible';

      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td>
        <td>${s.name}</td>
        <td>${s.adm}</td>
        <td>${s.parent}</td>
        <td>${s.contact}</td>
        <td>${s.occupation}</td>
        <td>${s.address}</td>
        <td>PKR ${outstanding}</td>
        <td>${status}</td>
        <td>
          <button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button>
          <button class="edit-btn" data-index="${i}"><i class="fas fa-edit"></i></button>
          <button class="delete-btn" data-index="${i}"><i class="fas fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // reset select-all and buttons
    $('selectAllStudents').checked = false;
    toggleButtons();
    document.querySelectorAll('.add-payment-btn')
      .forEach(btn => btn.onclick = () => openPaymentModal(btn.dataset.adm));
  }

  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }

  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleButtons();
  });

  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(cb => {
      cb.checked = $('selectAllStudents').checked;
    });
    toggleButtons();
  };

  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n = $('studentName').value.trim();
    const p = $('parentName').value.trim();
    const c = $('parentContact').value.trim();
    const o = $('parentOccupation').value.trim();
    const a = $('parentAddress').value.trim();
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!n || !p || !c || !o || !a) {
      alert('All fields are required');
      return;
    }
    if (!/^\d{7,15}$/.test(c)) {
      alert('Contact must be 7–15 digits');
      return;
    }
    const adm = await genAdmNo();
    students.push({ name: n, adm, parent: p, contact: c, occupation: o, address: a, cls: cl, sec });
    await save('students', students);
    renderStudents();
    updateCounters();
    resetViews();
    ['studentName', 'parentName', 'parentContact', 'parentOccupation', 'parentAddress']
      .forEach(id => $(id).value = '');
  };

  // Edit functionality for students
  $('studentsBody').addEventListener('click', e => {
    if (e.target.classList.contains('edit-btn')) {
      const index = e.target.dataset.index;
      const s = students[index];

      // Fill the edit form with student data
      $('studentName').value = s.name;
      $('parentName').value = s.parent;
      $('parentContact').value = s.contact;
      $('parentOccupation').value = s.occupation;
      $('parentAddress').value = s.address;

      // Change the button to "Add" to save the changes
      $('addStudent').textContent = 'Update Student';
      $('addStudent').onclick = async function () {
        // Update student details
        if (!s) return;
        
        s.name = $('studentName').value;
        s.parent = $('parentName').value;
        s.contact = $('parentContact').value;
        s.occupation = $('parentOccupation').value;
        s.address = $('parentAddress').value;

        await save('students', students);
        renderStudents();
        updateCounters();
        resetViews();
        $('addStudent').textContent = 'Add Student'; // Reset button text
      };
    }

    // Delete functionality for students
    if (e.target.classList.contains('delete-btn')) {
      const index = e.target.dataset.index;
      students.splice(index, 1); // Remove the student
      await save('students', students);
      renderStudents();
      updateCounters();
      resetViews();
    }
  });

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }

  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent;
    const amt = Number($('paymentAmount').value) || 0;
    paymentsData[adm] = paymentsData[adm] || [];
    paymentsData[adm].push({ date: new Date().toISOString().split('T')[0], amount: amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };

  $('cancelPayment').onclick = () => hide($('paymentModal'));

  // --- 9. MARK ATTENDANCE ---
  const dateInput = $('dateInput');
  const loadAttendanceBtn = $('loadAttendance');
  const saveAttendanceBtn = $('saveAttendance');
  const resetAttendanceBtn = $('resetAttendance');
  const downloadAttendanceBtn = $('downloadAttendancePDF');
  const shareAttendanceBtn = $('shareAttendanceSummary');
  const attendanceBodyDiv = $('attendanceBody');
  const attendanceSummaryDiv = $('attendanceSummary');
  const statusNames = { P: 'Present', A: 'Absent', Lt: 'Late', HD: 'Half Day', L: 'Leave' };
  const statusColors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: '#FF9800', L: 'var(--info)' };

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = '';
    attendanceSummaryDiv.innerHTML = '';
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s => s.cls === cl && s.sec === sec);
    roster.forEach((stu) => {
      const row = document.createElement('div');
      row.className = 'attendance-row';
      const nameDiv = document.createElement('div');
      nameDiv.className = 'attendance-name';
      nameDiv.textContent = stu.name;
      const btnsDiv = document.createElement('div');
      btnsDiv.className = 'attendance-buttons';
      Object.keys(statusNames).forEach(code => {
        const btn = document.createElement('button');
        btn.className = 'att-btn';
        btn.textContent = code;
        btn.onclick = () => {
          btnsDiv.querySelectorAll('.att-btn').forEach(b => {
            b.classList.remove('selected');
            b.style.background = ''; b.style.color = '';
          });
          btn.classList.add('selected');
          btn.style.background = statusColors[code];
          btn.style.color = '#fff';
        };
        btnsDiv.appendChild(btn);
      });
      row.append(nameDiv, btnsDiv);
      attendanceBodyDiv.appendChild(row);
    });
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert('Please pick a date'); return; }
    attendanceData[date] = {};
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s => s.cls === cl && s.sec === sec);
    roster.forEach((s, i) => {
      const btn = attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = btn ? btn.textContent : 'A';
    });
    await save('attendanceData', attendanceData);

    attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement('table');
    tbl.innerHTML = `<tr><th>Name</th><th>Status</th><th>Share</th></tr>`;
    roster.forEach(s => {
      const code = attendanceData[date][s.adm];
      tbl.innerHTML += `<tr>
        <td>${s.name}</td>
        <td>${statusNames[code]}</td>
        <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
      </tr>`;
    });
    attendanceSummaryDiv.appendChild(tbl);

    attendanceSummaryDiv.querySelectorAll('.share-individual')
      .forEach(ic => ic.onclick = () => {
        const adm = ic.dataset.adm;
        const student = students.find(x => x.adm === adm);
        const code = attendanceData[date][adm];
        const msg = `Dear Parent, your child was ${statusNames[code]} on ${date}.`;
        window.open(`https://wa.me/${student.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      });

    hide(saveAttendanceBtn, attendanceBodyDiv);
    show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  resetAttendanceBtn.onclick = () => {
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  // Download attendance in landscape format
  downloadAttendanceBtn.onclick = () => {
    const doc = new jspdf.jsPDF('landscape');
    doc.setFontSize(18);
    doc.text(`Attendance Report`, 14, 16);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 32, html: '#attendanceSummary table' });
    doc.save(`attendance_${dateInput.value}.pdf`);
  };

  shareAttendanceBtn.onclick = () => {
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const date = dateInput.value;
    const header = `*Attendance Report*\nClass ${cl} Section ${sec} - ${date}`;
    const lines = students.filter(s => s.cls === cl && s.sec === sec)
      .map(s => `*${s.name}*: ${statusNames[attendanceData[date][s.adm]]}`)
      .join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // --- 10. ANALYTICS Implementation ---
  const atg = $('analyticsTarget');
  const asel = $('analyticsSectionSelect');
  const atype = $('analyticsType');
  const adate = $('analyticsDate');
  const amonth = $('analyticsMonth');
  const sems = $('semesterStart');
  const seme = $('semesterEnd');
  const ayear = $('yearStart');
  const asearch = $('analyticsSearch');
  const loadA = $('loadAnalytics');
  const resetA = $('resetAnalytics');
  const instr = $('instructions');
  const acont = $('analyticsContainer');
  const graphs = $('graphs');
  const aacts = $('analyticsActions');
  const barCtx = $('barChart').getContext('2d');
  const pieCtx = $('pieChart').getContext('2d');
  let barChart, pieChart, lastAnalyticsShare = '';

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearch].forEach(x => x.classList.add('hidden'));
    acont.classList.add('hidden');
    graphs.classList.add('hidden');
    aacts.classList.add('hidden');
    if (atg.value === 'section') asel.classList.remove('hidden');
    if (atg.value === 'student') asearch.classList.remove('hidden');
  };

  atype.onchange = () => {
    [adate, amonth, sems, seme, ayear].forEach(x => x.classList.add('hidden'));
    instr.classList.add('hidden');
    acont.classList.add('hidden');
    graphs.classList.add('hidden');
    aacts.classList.add('hidden');
    resetA.classList.remove('hidden');
    if (atype.value === 'date') adate.classList.remove('hidden');
    if (atype.value === 'month') amonth.classList.remove('hidden');
    if (atype.value === 'semester') { sems.classList.remove('hidden'); seme.classList.remove('hidden'); }
    if (atype.value === 'year') ayear.classList.remove('hidden');
  };

  resetA.onclick = e => {
    e.preventDefault();
    atype.value = '';
    [adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
    resetA.classList.add('hidden');
  };

  loadA.onclick = () => {
    if (atg.value === 'student' && !asearch.value.trim()) {
      alert('Please enter an admission number or name');
      return;
    }
    let from, to;
    if (atype.value === 'date') {
      from = to = adate.value;
    } else if (atype.value === 'month') {
      const [year, month] = amonth.value.split('-');
      from = to = `${year}-${month}-01`;
    } else if (atype.value === 'semester') {
      const [startYear, startMonth] = sems.value.split('-');
      const [endYear, endMonth] = seme.value.split('-');
      from = `${startYear}-${startMonth}-01`;
      to = `${endYear}-${endMonth}-31`;
    } else if (atype.value === 'year') {
      from = `${ayear.value}-01-01`;
      to = `${ayear.value}-12-31`;
    }

    // Here add your logic for fetching and displaying the analytics data based on the date range.
    alert(`Analytics from ${from} to ${to} for ${atg.value}`);
  };
});
