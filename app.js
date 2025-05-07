// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- Universal PDF share helper (must come first) ---
  async function sharePdf(blob, fileName, title) {
    if (
      navigator.canShare &&
      navigator.canShare({
        files: [new File([blob], fileName, { type: 'application/pdf' })],
      })
    ) {
      try {
        await navigator.share({ title, files: [new File([blob], fileName, { type: 'application/pdf' })] });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share failed', err);
      }
    }
  }

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
  const save = (k, v) => set(k, v);

  // --- 2. State & Defaults ---
  let students = (await get('students')) || [];
  let attendanceData = (await get('attendanceData')) || {};
  let paymentsData = (await get('paymentsData')) || {};
  let lastAdmNo = (await get('lastAdmissionNo')) || 0;
  let fineRates = (await get('fineRates')) || { A: 50, Lt: 20, L: 10, HD: 30 };
  let eligibilityPct = (await get('eligibilityPct')) || 75;
  let analyticsFilterOptions = ['all'];
  let analyticsDownloadMode = 'combined';
  let lastAnalyticsStats = [];
  let lastAnalyticsRange = { from: null, to: null };
  let lastAnalyticsShare = '';

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 3. DOM Helpers ---
  const $ = (id) => document.getElementById(id);
  const show = (...els) => els.forEach((e) => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach((e) => e && e.classList.add('hidden'));

  // --- 4. DOWNLOAD & SHARE HANDLERS ---

  // 4.1 Student List PDF
  $('downloadRegistrationPDF').onclick = async () => {
    const doc = new jspdf.jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split('T')[0];

    doc.setFontSize(18);
    doc.text('Student List', 14, 16);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.text(`Date: ${today}`, w - 14, 24, { align: 'right' });
    doc.autoTable({ startY: 32, html: '#studentsTable' });

    const blob = doc.output('blob');
    doc.save('registration.pdf');
    await sharePdf(blob, 'registration.pdf', 'Student List');
  };
  $('shareRegistration').onclick = () => {
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students
      .filter((s) => s.cls === cl && s.sec === sec)
      .map((s) => {
        const stats = { P: 0, A: 0, Lt: 0, HD: 0, L: 0 };
        Object.values(attendanceData).forEach((rec) => {
          if (rec[s.adm]) stats[rec[s.adm]]++;
        });
        const totalMarked = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
        const totalFine =
          stats.A * fineRates.A +
          stats.Lt * fineRates.Lt +
          stats.L * fineRates.L +
          stats.HD * fineRates.HD;
        const paid = (paymentsData[s.adm] || []).reduce((a, p) => a + p.amount, 0);
        const outstanding = totalFine - paid;
        const pct = totalMarked ? (stats.P / totalMarked) * 100 : 0;
        const status = outstanding > 0 || pct < eligibilityPct ? 'Debarred' : 'Eligible';
        return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: PKR ${outstanding}\nStatus: ${status}`;
      })
      .join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // 4.2 Attendance Summary PDF
  const dateInput = $('dateInput'),
    loadAttendanceBtn = $('loadAttendance'),
    saveAttendanceBtn = $('saveAttendance'),
    resetAttendanceBtn = $('resetAttendance'),
    downloadAttendanceBtn = $('downloadAttendancePDF'),
    shareAttendanceBtn = $('shareAttendanceSummary'),
    attendanceBodyDiv = $('attendanceBody'),
    attendanceSummaryDiv = $('attendanceSummary'),
    statusNames = {
      P: 'Present',
      A: 'Absent',
      Lt: 'Late',
      HD: 'Half-Day',
      L: 'Leave',
    },
    statusColors = {
      P: 'var(--success)',
      A: 'var(--danger)',
      Lt: 'var(--warning)',
      HD: '#FF9800',
      L: 'var(--info)',
    };

  downloadAttendanceBtn.onclick = async () => {
    if (!attendanceSummaryDiv.innerHTML.trim()) {
      alert('No attendance to download. Please generate a report first.');
      return;
    }
    const doc = new jspdf.jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const dt = dateInput.value;

    doc.setFontSize(18);
    doc.text('Attendance Report', 14, 16);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.text(`Date: ${dt}`, w - 14, 24, { align: 'right' });
    doc.autoTable({ startY: 32, html: '#attendanceSummary table' });

    const blob = doc.output('blob');
    doc.save(`attendance_${dt}.pdf`);
    await sharePdf(blob, `attendance_${dt}.pdf`, 'Attendance Report');
  };
  shareAttendanceBtn.onclick = () => {
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const dt = dateInput.value;
    const header = `*Attendance Report*\nClass ${cl} Section ${sec} - ${dt}`;
    const lines = Array.from(
      attendanceSummaryDiv.querySelectorAll('table tbody tr')
    )
      .map((tr) => `*${tr.children[0].textContent}*: ${tr.children[1].textContent}`)
      .join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // 4.3 Attendance Register PDF
  $('downloadRegister').onclick = async () => {
    const doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split('T')[0];

    doc.setFontSize(18);
    doc.text('Attendance Register', 14, 20);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 36);
    doc.text(`Date: ${today}`, w - 14, 36, { align: 'right' });
    doc.autoTable({ startY: 50, html: '#registerTable', tableWidth: 'auto', styles: { fontSize: 10 } });

    const blob = doc.output('blob');
    doc.save('attendance_register.pdf');
    await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
  };
  $('shareRegister').onclick = () => {
    const header = `Attendance Register\n${$('setupText').textContent}`;
    const rows = Array.from($('registerBody').children)
      .map((tr) => Array.from(tr.children).map((td) => td.textContent).join(' '))
      .join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows)}`, '_blank');
  };

  // --- 5. SETTINGS: Fines & Eligibility ---
  const formDiv = $('financialForm'),
    saveSettings = $('saveSettings'),
    inputs = ['fineAbsent', 'fineLate', 'fineLeave', 'fineHalfDay', 'eligibilityPct'].map((id) => $(id)),
    settingsCard = document.createElement('div'),
    editSettings = document.createElement('button');
  settingsCard.id = 'settingsCard';
  settingsCard.className = 'card hidden';
  editSettings.id = 'editSettings';
  editSettings.className = 'btn no-print hidden';
  editSettings.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editSettings);

  $('fineAbsent').value = fineRates.A;
  $('fineLate').value = fineRates.Lt;
  $('fineLeave').value = fineRates.L;
  $('fineHalfDay').value = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveSettings.onclick = async () => {
    fineRates = {
      A: Number($('fineAbsent').value) || 0,
      Lt: Number($('fineLate').value) || 0,
      L: Number($('fineLeave').value) || 0,
      HD: Number($('fineHalfDay').value) || 0,
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;
    await Promise.all([save('fineRates', fineRates), save('eligibilityPct', eligibilityPct)]);
    settingsCard.innerHTML = `
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
      </div>`;
    hide(formDiv, saveSettings, ...inputs);
    show(settingsCard, editSettings);
  };
  editSettings.onclick = () => {
    hide(settingsCard, editSettings);
    show(formDiv, saveSettings, ...inputs);
  };

  // --- 6. SETUP: School, Class & Section ---
  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([get('schoolName'), get('teacherClass'), get('teacherSection')]);
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
    const sc = $('schoolNameInput').value.trim(),
      cl = $('teacherClassSelect').value,
      sec = $('teacherSectionSelect').value;
    if (!sc || !cl || !sec) {
      alert('Complete setup');
      return;
    }
    await Promise.all([save('schoolName', sc), save('teacherClass', cl), save('teacherSection', sec)]);
    await loadSetup();
  };
  $('editSetup').onclick = (e) => {
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };
  await loadSetup();

  // --- 7. COUNTERS & UTILS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach((span) => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target / 100);
      (function upd() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(upd);
      })();
    });
  }
  function updateCounters() {
    const cl = $('teacherClassSelect').value,
      sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter((s) => s.cls === cl && s.sec === sec).length;
    $('classCount').dataset.target = students.filter((s) => s.cls === cl).length;
    $('schoolCount').dataset.target = students.length;
    animateCounters();
  }
  function resetViews() {
    hide(
      $('attendanceBody'),
      $('saveAttendance'),
      $('resetAttendance'),
      $('attendanceSummary'),
      $('downloadAttendancePDF'),
      $('shareAttendanceSummary'),
      $('instructions'),
      $('analyticsContainer'),
      $('graphs'),
      $('analyticsActions'),
      $('registerTableWrapper'),
      $('changeRegister'),
      $('saveRegister'),
      $('downloadRegister'),
      $('shareRegister')
    );
    show($('loadRegister'));
  }
  $('teacherClassSelect').onchange = () => {
    renderStudents();
    updateCounters();
    resetViews();
  };
  $('teacherSectionSelect').onchange = () => {
    renderStudents();
    updateCounters();
    resetViews();
  };

  // --- 8. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value,
      sec = $('teacherSectionSelect').value,
      tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx = 0;
    students.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      const stats = { P: 0, A: 0, Lt: 0, HD: 0, L: 0 };
      Object.values(attendanceData).forEach((rec) => {
        if (rec[s.adm]) stats[rec[s.adm]]++;
      });
      const totalMarked = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const totalFine =
        stats.A * fineRates.A +
        stats.Lt * fineRates.Lt +
        stats.L * fineRates.L +
        stats.HD * fineRates.HD;
      const paid = (paymentsData[s.adm] || []).reduce((a, p) => a + p.amount, 0);
      const outstanding = totalFine - paid;
      const pct = totalMarked ? (stats.P / totalMarked) * 100 : 0;
      const status = outstanding > 0 || pct < eligibilityPct ? 'Debarred' : 'Eligible';

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
        <td><button class="add-payment-btn" data-adm="${s.adm}">
          <i class="fas fa-coins"></i>
        </button></td>`;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach((b) => {
      b.onclick = () => openPaymentModal(b.dataset.adm);
    });
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
    document.querySelectorAll('.sel').forEach((c) => (c.checked = $('selectAllStudents').checked));
    toggleButtons();
  };

  $('addStudent').onclick = async (e) => {
    e.preventDefault();
    const n = $('studentName').value.trim(),
      p = $('parentName').value.trim(),
      c = $('parentContact').value.trim(),
      o = $('parentOccupation').value.trim(),
      a = $('parentAddress').value.trim(),
      cl = $('teacherClassSelect').value,
      sec = $('teacherSectionSelect').value;
    if (!n || !p || !c || !o || !a) {
      alert('All fields required');
      return;
    }
    if (!/^\d{7,15}$/.test(c)) {
      alert('Contact 7–15 digits');
      return;
    }
    const adm = await genAdmNo();
    students.push({ name: n, adm, parent: p, contact: c, occupation: o, address: a, cls: cl, sec });
    await save('students', students);
    renderStudents();
    updateCounters();
    resetViews();
    ['studentName', 'parentName', 'parentContact', 'parentOccupation', 'parentAddress'].forEach(
      (id) => ($(id).value = '')
    );
  };

  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach((cb) => {
      const tr = cb.closest('tr'),
        i = +tr.dataset.index,
        s = students[i];
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" checked></td>
        <td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"></td>
        <td>${s.adm}</td>
        <td><input value="${s.parent}"></td>
        <td><input value="${s.contact}"></td>
        <td><input value="${s.occupation}"></td>
        <td><input value="${s.address}"></td>
        <td colspan="3"></td>`;
    });
    hide($('editSelected'));
    show($('doneEditing'));
  };

  $('doneEditing').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach((tr) => {
      const inps = [...tr.querySelectorAll('input:not(.sel)')];
      if (inps.length === 5) {
        const [n, p, c, o, a] = inps.map((i) => i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex((x) => x.adm === adm);
        if (idx > -1) students[idx] = { ...students[idx], name: n, parent: p, contact: c, occupation: o, address: a };
      }
    });
    await save('students', students);
    hide($('doneEditing'));
    show($('editSelected'), $('deleteSelected'), $('saveRegistration'));
    renderStudents();
    updateCounters();
  };

  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete?')) return;
    const toDel = [...document.querySelectorAll('.sel:checked')].map((cb) => +cb.closest('tr').dataset.index);
    students = students.filter((_, i) => !toDel.includes(i));
    await save('students', students);
    renderStudents();
    updateCounters();
    resetViews();
  };

  $('saveRegistration').onclick = async () => {
    if (!$('doneEditing').classList.contains('hidden')) {
      alert('Finish editing');
      return;
    }
    await save('students', students);
    hide(
      document.querySelector('#student-registration .row-inline'),
      $('editSelected'),
      $('deleteSelected'),
      $('selectAllStudents'),
      $('saveRegistration')
    );
    show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents();
    updateCounters();
  };

  $('editRegistration').onclick = () => {
    show(
      document.querySelector('#student-registration .row-inline'),
      $('selectAllStudents'),
      $('editSelected'),
      $('deleteSelected'),
      $('saveRegistration')
    );
    hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents();
    updateCounters();
  };

  // --- 9. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('paymentModalClose').onclick = () => hide($('paymentModal'));
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent,
      amt = Number($('paymentAmount').value) || 0;
    paymentsData[adm] = paymentsData[adm] || [];
    paymentsData[adm].push({ date: new Date().toISOString().split('T')[0], amount: amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));

  // --- 10. MARK ATTENDANCE ---
  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = '';
    attendanceSummaryDiv.innerHTML = '';
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    students
      .filter((s) => s.cls === cl && s.sec === sec)
      .forEach((stu, i) => {
        const row = document.createElement('div');
        row.className = 'attendance-row';
        const nameDiv = document.createElement('div');
        nameDiv.className = 'attendance-name';
        nameDiv.textContent = stu.name;
        const btnsDiv = document.createElement('div');
        btnsDiv.className = 'attendance-buttons';
        ['P', 'A', 'Lt', 'HD', 'L'].forEach((code) => {
          const btn = document.createElement('button');
          btn.className = 'att-btn';
          btn.textContent = code;
          btn.onclick = () => {
            btnsDiv.querySelectorAll('.att-btn').forEach((b) => {
              b.classList.remove('selected');
              b.style.background = '';
              b.style.color = '';
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
    if (!date) {
      alert('Please pick a date');
      return;
    }
    attendanceData[date] = {};
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    students
      .filter((s) => s.cls === cl && s.sec === sec)
      .forEach((s, i) => {
        const btn = attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
        if (btn) attendanceData[date][s.adm] = btn.textContent;
      });
    await save('attendanceData', attendanceData);

    attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement('table');
    tbl.innerHTML = `<tr><th>Name</th><th>Status</th><th>Share</th></tr>`;
    students
      .filter((s) => s.cls === cl && s.sec === sec)
      .forEach((s) => {
        const code = attendanceData[date]?.[s.adm] || 'Not Marked';
        tbl.innerHTML += `<tr>
          <td>${s.name}</td><td>${code}</td>
          <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
        </tr>`;
      });
    attendanceSummaryDiv.appendChild(tbl);
    attendanceSummaryDiv.querySelectorAll('.share-individual').forEach((ic) => {
      ic.onclick = () => {
        const adm = ic.dataset.adm;
        const st = students.find((x) => x.adm === adm);
        const code = attendanceData[date]?.[adm] || 'Not Marked';
        const msg = `Dear Parent, your child was ${code} on ${date}.`;
        window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      };
    });

    hide(attendanceBodyDiv, saveAttendanceBtn);
    show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  resetAttendanceBtn.onclick = () => {
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  // --- 11. ANALYTICS & CHARTS ---
  const atg = $('analyticsTarget'),
    asel = $('analyticsSectionSelect'),
    atype = $('analyticsType'),
    adate2 = $('analyticsDate'),
    amonth2 = $('analyticsMonth'),
    sems = $('semesterStart'),
    seme = $('semesterEnd'),
    ayear2 = $('yearStart'),
    asearch2 = $('analyticsSearch'),
    loadA2 = $('loadAnalytics'),
    resetA2 = $('resetAnalytics'),
    instr = $('instructions'),
    acont = $('analyticsContainer'),
    graphs = $('graphs'),
    aacts = $('analyticsActions'),
    barCtx = $('barChart').getContext('2d'),
    pieCtx = $('pieChart').getContext('2d');
  let barChart, pieChart;

  const analyticsStatusNames2 = { P: 'Present', A: 'Absent', Lt: 'Late', HD: 'Half-Day', L: 'Leave' };
  const analyticsStatusColors2 = {
    P: getComputedStyle(document.documentElement).getPropertyValue('--success').trim(),
    A: getComputedStyle(document.documentElement).getPropertyValue('--danger').trim(),
    Lt: getComputedStyle(document.documentElement).getPropertyValue('--warning').trim(),
    HD: '#FF9800',
    L: getComputedStyle(document.documentElement).getPropertyValue('--info').trim(),
  };

  $('analyticsFilterBtn').onclick = () => show($('analyticsFilterModal'));
  $('analyticsFilterClose').onclick = () => hide($('analyticsFilterModal'));
  $('applyAnalyticsFilter').onclick = () => {
    analyticsFilterOptions = Array.from(
      document.querySelectorAll('#analyticsFilterForm input[type="checkbox"]:checked')
    ).map((cb) => cb.value);
    if (!analyticsFilterOptions.length) analyticsFilterOptions = ['all'];
    analyticsDownloadMode = document.querySelector('#analyticsFilterForm input[name="downloadMode"]:checked').value;
    hide($('analyticsFilterModal'));
    if (lastAnalyticsStats.length) renderAnalytics(lastAnalyticsStats, lastAnalyticsRange.from, lastAnalyticsRange.to);
  };

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearch2].forEach((x) => x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach((x) => x.classList.add('hidden'));
    if (atg.value === 'section') asel.classList.remove('hidden');
    if (atg.value === 'student') asearch2.classList.remove('hidden');
  };

  atype.onchange = () => {
    [adate2, amonth2, sems, seme, ayear2].forEach((x) => x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach((x) => x.classList.add('hidden'));
    resetA2.classList.remove('hidden');
    switch (atype.value) {
      case 'date':
        adate2.classList.remove('hidden');
        break;
      case 'month':
        amonth2.classList.remove('hidden');
        break;
      case 'semester':
        sems.classList.remove('hidden');
        seme.classList.remove('hidden');
        break;
      case 'year':
        ayear2.classList.remove('hidden');
        break;
    }
  };

  resetA2.onclick = (e) => {
    e.preventDefault();
    atype.value = '';
    [adate2, amonth2, sems, seme, ayear2, instr, acont, graphs, aacts].forEach((x) => x.classList.add('hidden'));
    resetA2.classList.add('hidden');
  };

  loadA2.onclick = () => {
    let from, to;
    if (atype.value === 'date') {
      from = to = adate2.value;
    } else if (atype.value === 'month') {
      const [y, m] = amonth2.value.split('-').map(Number);
      from = `${amonth2.value}-01`;
      to = `${amonth2.value}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    } else if (atype.value === 'semester') {
      const [sy, sm] = sems.value.split('-').map(Number);
      const [ey, em] = seme.value.split('-').map(Number);
      from = `${sems.value}-01`;
      to = `${seme.value}-${String(new Date(ey, em, 0).getDate()).padStart(2, '0')}`;
    } else if (atype.value === 'year') {
      from = `${ayear2.value}-01-01`;
      to = `${ayear2.value}-12-31`;
    } else {
      alert('Select a period');
      return;
    }

    const cls = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    let pool = students.filter((s) => s.cls === cls && s.sec === sec);
    if (atg.value === 'section') pool = pool.filter((s) => s.sec === asel.value);
    if (atg.value === 'student') {
      const q = asearch2.value.trim().toLowerCase();
      pool = pool.filter((s) => s.adm === q || s.name.toLowerCase().includes(q));
    }

    const stats = pool.map((s) => ({
      adm: s.adm,
      name: s.name,
      P: 0,
      A: 0,
      Lt: 0,
      HD: 0,
      L: 0,
      total: 0,
    }));
    Object.entries(attendanceData).forEach(([d, rec]) => {
      if (d < from || d > to) return;
      stats.forEach((st) => {
        if (rec[st.adm]) {
          st[rec[st.adm]]++;
          st.total++;
        }
      });
    });
    stats.forEach((st) => {
      const totalFine =
        st.A * fineRates.A +
        st.Lt * fineRates.Lt +
        st.L * fineRates.L +
        st.HD * fineRates.HD;
      const paid = (paymentsData[st.adm] || []).reduce((a, p) => a + p.amount, 0);
      st.outstanding = totalFine - paid;
      const pct = st.total ? (st.P / st.total) * 100 : 0;
      st.status = st.outstanding > 0 || pct < eligibilityPct ? 'Debarred' : 'Eligible';
    });

    lastAnalyticsStats = stats;
    lastAnalyticsRange = { from, to };
    renderAnalytics(stats, from, to);
  };

  function renderAnalytics(stats, from, to) {
    let filtered = stats;
    if (!analyticsFilterOptions.includes('all')) {
      filtered = stats.filter((st) =>
        analyticsFilterOptions.some((opt) => {
          switch (opt) {
            case 'registered':
              return true;
            case 'attendance':
              return st.total > 0;
            case 'fine':
              return st.A > 0 || st.Lt > 0 || st.L > 0 || st.HD > 0;
            case 'cleared':
              return st.outstanding === 0;
            case 'debarred':
              return st.status === 'Debarred';
            case 'eligible':
              return st.status === 'Eligible';
            default:
              return false;
          }
        })
      );
    }

    const thead = $('analyticsTable').querySelector('thead tr');
    thead.innerHTML = ['#', 'Adm#', 'Name', 'P', 'A', 'Lt', 'HD', 'L', 'Total', '%', 'Outstanding', 'Status']
      .map((h) => `<th>${h}</th>`)
      .join('');
    const tbody = $('analyticsBody');
    tbody.innerHTML = '';
    filtered.forEach((st, i) => {
      const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td><td>${st.adm}</td><td>${st.name}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td>
        <td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td>
        <td>${pct}%</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>`;
      tbody.appendChild(tr);
    });

    instr.textContent = `Period: ${from} to ${to}`;
    show(instr, acont, graphs, aacts);

    barChart?.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: filtered.map((st) => st.name),
        datasets: [
          {
            label: '% Present',
            data: filtered.map((st) => (st.total ? (st.P / st.total) * 100 : 0)),
            backgroundColor: filtered.map(() => analyticsStatusColors2.P),
          },
        ],
      },
      options: { scales: { y: { beginAtZero: true, max: 100 } } },
    });

    const totalCounts = filtered.reduce(
      (acc, st) => {
        acc.P += st.P;
        acc.A += st.A;
        acc.Lt += st.Lt;
        acc.HD += st.HD;
        acc.L += st.L;
        return acc;
      },
      { P: 0, A: 0, Lt: 0, HD: 0, L: 0 }
    );
    pieChart?.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: Object.values(analyticsStatusNames2),
        datasets: [
          {
            data: Object.keys(analyticsStatusNames2).map((code) => totalCounts[code]),
            backgroundColor: Object.keys(analyticsStatusNames2).map((code) => analyticsStatusColors2[code]),
          },
        ],
      },
    });

    lastAnalyticsShare =
      `Analytics (${from} to ${to})\n` +
      filtered
        .map(
          (st, i) =>
            `${i + 1}. ${st.adm} ${st.name}: ${(
              (st.P / st.total) *
              100 || 0
            ).toFixed(1)}% / PKR ${st.outstanding}`
        )
        .join('\n');

    // Bind downloadAnalytics with combined vs individual
    $('downloadAnalytics').onclick = async () => {
      if (!filtered.length) {
        alert('No analytics to download. Generate first.');
        return;
      }
      if (analyticsDownloadMode === 'combined') {
        const doc = new jspdf.jsPDF();
        doc.setFontSize(18);
        doc.text('Analytics Report', 14, 16);
        doc.setFontSize(12);
        doc.text(`Period: ${from} to ${to}`, 14, 24);
        doc.autoTable({ startY: 32, html: '#analyticsTable' });
        const blob = doc.output('blob');
        doc.save('analytics_report.pdf');
        await sharePdf(blob, 'analytics_report.pdf', 'Analytics Report');
      } else {
        const doc = new jspdf.jsPDF();
        filtered.forEach((st, i) => {
          if (i > 0) doc.addPage();
          doc.setFontSize(18);
          doc.text(`Analytics - ${st.name}`, 14, 16);
          doc.setFontSize(12);
          doc.text(`Adm#: ${st.adm}`, 14, 24);
          doc.text(`Period: ${from} to ${to}`, 14, 30);
          doc.autoTable({
            startY: 40,
            head: [['P', 'A', 'Lt', 'HD', 'L', 'Total', '%', 'Outstanding', 'Status']],
            body: [
              [
                st.P,
                st.A,
                st.Lt,
                st.HD,
                st.L,
                st.total,
                st.total ? ((st.P / st.total) * 100).toFixed(1) + '%' : '0.0%',
                'PKR ' + st.outstanding,
                st.status,
              ],
            ],
          });
        });
        const blob = doc.output('blob');
        doc.save('analytics_individual.pdf');
        await sharePdf(blob, 'analytics_individual.pdf', 'Analytics Reports');
      }
    };
    $('shareAnalytics').onclick = () => {
      if (!filtered.length) {
        alert('No analytics to share. Generate first.');
        return;
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');
    };
  }

  // --- 12. ATTENDANCE REGISTER ---
  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value;
    if (!m) {
      alert('Pick month');
      return;
    }
    const [y, mm] = m.split('-').map(Number);
    const days = new Date(y, mm, 0).getDate();
    $('registerHeader').innerHTML =
      `<th>#</th><th>Adm#</th><th>Name</th>` +
      [...Array(days)].map((_, i) => `<th>${i + 1}</th>`).join('');
    $('registerBody').innerHTML = '';
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    students
      .filter((s) => s.cls === cl && s.sec === sec)
      .forEach((s, i) => {
        let row = `<td>${i + 1}</td><td>${s.adm}</td><td>${s.name}</td>`;
        for (let d = 1; d <= days; d++) {
          const key = `${m}-${String(d).padStart(2, '0')}`;
          const c = (attendanceData[key] || {})[s.adm] || 'A';
          const style =
            c === 'A'
              ? ''
              : `style="background:${
                  c === 'P'
                    ? 'var(--success)'
                    : c === 'Lt'
                    ? 'var(--warning)'
                    : c === 'HD'
                    ? '#FF9800'
                    : c === 'L'
                    ? 'var(--info)'
                    : 'var(--danger)'
                };color:#fff"`;
          row += `<td class="reg-cell" ${style}><span class="status-text">${c}</span></td>`;
        }
        const tr = document.createElement('tr');
        tr.innerHTML = row;
        $('registerBody').appendChild(tr);
      });
    document.querySelectorAll('.reg-cell').forEach((cell) => {
      cell.onclick = () => {
        const span = cell.querySelector('.status-text');
        const codes = ['A', 'P', 'Lt', 'HD', 'L'];
        const idx = (codes.indexOf(span.textContent) + 1) % codes.length;
        const c = codes[idx];
        span.textContent = c;
        if (c === 'A') {
          cell.style.background = '';
          cell.style.color = '';
        } else {
          const color =
            c === 'P'
              ? 'var(--success)'
              : c === 'Lt'
              ? 'var(--warning)'
              : c === 'HD'
              ? '#FF9800'
              : c === 'L'
              ? 'var(--info)'
              : 'var(--danger)';
          cell.style.background = color;
          cell.style.color = '#fff';
        }
      };
    });
    show($('registerTableWrapper'), $('saveRegister'));
    hide($('loadRegister'), $('changeRegister'), $('downloadRegister'), $('shareRegister'));
  };

  $('saveRegister').onclick = async () => {
    const m = $('registerMonth').value;
    const [y, mm] = m.split('-').map(Number);
    const days = new Date(y, mm, 0).getDate();
    Array.from($('registerBody').children).forEach((tr) => {
      const adm = tr.children[1].textContent;
      for (let d = 1; d <= days; d++) {
        const code = tr.children[3 + d - 1].querySelector('.status-text').textContent;
        const key = `${m}-${String(d).padStart(2, '0')}`;
        attendanceData[key] = attendanceData[key] || {};
        attendanceData[key][adm] = code;
      }
    });
    await save('attendanceData', attendanceData);
    hide($('saveRegister'));
    show($('changeRegister'), $('downloadRegister'), $('shareRegister'));
  };

  $('changeRegister').onclick = () => {
    hide($('registerTableWrapper'), $('changeRegister'), $('downloadRegister'), $('shareRegister'), $('saveRegister'));
    $('registerHeader').innerHTML = '';
    $('registerBody').innerHTML = '';
    show($('loadRegister'));
  };

  // --- 13. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
