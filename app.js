// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- IndexedDB helpers (idb-keyval) ---
  const { get, set } = window.idbKeyval;
  const save = (key, val) => set(key, val);

  // --- State & Defaults ---
  let students = await get('students') || [];
  let attendanceData = await get('attendanceData') || {};
  let finesData = await get('finesData') || {};
  let paymentsData = await get('paymentsData') || {};
  let fineRates = await get('fineRates') || { A: 50, Lt: 20, L: 10, HD: 0 };
  let eligibilityPct = await get('eligibilityPct') || 75;

  async function genAdmNo() {
    const lastAdmNo = await get('lastAdmissionNo') || 0;
    const newAdmNo = lastAdmNo + 1;
    await save('lastAdmissionNo', newAdmNo);
    return String(newAdmNo).padStart(4, '0');
  }

  // --- DOM Helpers ---
  const $ = (id) => document.getElementById(id);
  const show = (...els) => els.forEach((e) => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach((e) => e && e.classList.add('hidden'));

  // --- SETTINGS: Fines & Eligibility ---
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

  // --- SETUP: School, Class & Section ---
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

  $('saveSetup').onclick = async (e) => {
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

  $('editSetup').onclick = (e) => {
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };

  await loadSetup();

  // --- COUNTERS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach((span) => {
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
    $('sectionCount').dataset.target = students.filter((s) => s.cls === cl && s.sec === sec).length;
    $('classCount').dataset.target = students.filter((s) => s.cls === cl).length;
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

  // --- STUDENT REGISTRATION & FINE/STATUS ---
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
      Object.values(attendanceData).forEach((recs) => {
        const c = recs[s.adm] || 'A';
        stats[c]++;
      });

      // compute fine and outstanding
      const totalFine = stats.A * fineRates.A
        + stats.Lt * fineRates.Lt
        + stats.L * fineRates.L
        + stats.HD * fineRates.HD;
      const totalPaid = (paymentsData[s.adm] || []).reduce((sum, p) => sum + p.amount, 0);
      const outstanding = totalFine - totalPaid;

      // compute attendance %
      const totalDays = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const pctPresent = totalDays ? (stats.P / totalDays) * 100 : 0;

      // determine status
      const status = (outstanding > 0 || pctPresent < eligibilityPct)
        ? 'Debarred'
        : 'Eligible';

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
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });

    // reset select-all and buttons
    $('selectAllStudents').checked = false;
    toggleButtons();
    document.querySelectorAll('.add-payment-btn')
      .forEach((btn) => btn.onclick = () => openPaymentModal(btn.dataset.adm));
  }

  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }

  $('studentsBody').addEventListener('change', (e) => {
    if (e.target.classList.contains('sel')) toggleButtons();
  });

  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach((cb) => {
      cb.checked = $('selectAllStudents').checked;
    });
    toggleButtons();
  };

  $('addStudent').onclick = async (e) => {
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
    students.push({ name: n, adm, parent: p, contact: c, occupation: o, address: a, cls: cl, sec: sec });
    await save('students', students);
    renderStudents();
    updateCounters();
    resetViews();
    ['studentName', 'parentName', 'parentContact', 'parentOccupation', 'parentAddress']
      .forEach((id) => $(id).value = '');
  };

  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach((cb) => {
      const tr = cb.closest('tr');
      const i = +tr.dataset.index;
      const s = students[i];
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" checked></td>
        <td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"></td>
        <td>${s.adm}</td>
        <td><input value="${s.parent
