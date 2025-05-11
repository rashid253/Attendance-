// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- Universal PDF share helper (must come first) ---
  async function sharePdf(blob, fileName, title) {
    if (
      navigator.canShare &&
      navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })
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
  let analyticsFilterOptions = ['all'],
    analyticsDownloadMode = 'combined';
  let lastAnalyticsStats = [],
    lastAnalyticsRange = { from: null, to: null },
    lastAnalyticsShare = '';

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 3. DOM Helpers ---
  const $ = (id) => document.getElementById(id);
  const show = (...els) => els.forEach((e) => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach((e) => e && e.classList.add('hidden'));

  // --- DOWNLOAD & SHARE HANDLERS ---
  // Student Registration PDF
  $('downloadRegistrationPDF').onclick = async () => {
    const doc = new jspdf.jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split('T')[0];

    doc.setFontSize(18);
    doc.text('Registered Students', 14, 16);
    doc.setFontSize(10);
    doc.text(`Date: ${today}`, pageWidth - 14, 16, { align: 'right' });
    const setupText = $('setupText').textContent;
    doc.setFontSize(12);
    doc.text(setupText, 14, 24);

    doc.autoTable({ startY: 30, html: '#studentsTable' });
    const blob = doc.output('blob');
    doc.save('registration.pdf');
    await sharePdf(blob, 'registration.pdf', 'Registered Students');
  };

  $('shareRegistration').onclick = () => {
    const cl = $('teacherClassSelect').value,
      sec = $('teacherSectionSelect').value;
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
        const status =
          outstanding > 0 || pct < eligibilityPct ? 'Debarred' : 'Eligible';
        return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: PKR ${outstanding}\nStatus: ${status}`;
      })
      .join('\n\n');
    window.open(
      `https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`,
      '_blank'
    );
  };

  // --- Analytics PDF ---
  $('downloadAnalytics').onclick = async () => {
    if (!lastAnalyticsStats.length) {
      alert('No analytics to download. Generate report first.');
      return;
    }

    const setupHeader = $('setupText').textContent;

    if (analyticsDownloadMode === 'combined') {
      const doc = new jspdf.jsPDF();

      doc.setFontSize(18);
      doc.text('Attendance Analytics Report', 14, 16);

      doc.setFontSize(12);
      doc.text(setupHeader, 14, 24);

      doc.text(
        `Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`,
        14,
        32
      );

      doc.autoTable({
        startY: 40,
        html: '#analyticsTable',
      });

      const blob = doc.output('blob');
      doc.save('analytics_report.pdf');
      await sharePdf(blob, 'analytics_report.pdf', 'Attendance Analytics Report');
    } else {
      const doc = new jspdf.jsPDF();

      doc.setFontSize(18);
      doc.text('Individual Attendance Analytics Report', 14, 16);

      doc.setFontSize(12);
      doc.text(setupHeader, 14, 24);

      doc.text(
        `Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`,
        14,
        32
      );

      let y = 48;
      lastAnalyticsStats.forEach((st, i) => {
        if (i > 0) {
          doc.addPage();
          y = 48;
        }

        doc.setFontSize(14);
        doc.text(`Name: ${st.name}`, 14, y);
        y += 16;
        doc.text(`Adm#: ${st.adm}`, 14, y);
        y += 16;

        doc.setFontSize(12);
        doc.text(`Present: ${st.P}`, 14, y);
        y += 14;
        doc.text(`Absent: ${st.A}`, 14, y);
        y += 14;
        doc.text(`Late: ${st.Lt}`, 14, y);
        y += 14;
        doc.text(`Half-Day: ${st.HD}`, 14, y);
        y += 14;
        doc.text(`Leave: ${st.L}`, 14, y);
        y += 14;
        doc.text(`Total Days Marked: ${st.total}`, 14, y);
        y += 20;

        const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : '0.0';
        doc.text(`% Present: ${pct}%`, 14, y);
        y += 16;
        doc.text(`Outstanding Fine: PKR ${st.outstanding}`, 14, y);
        y += 16;
        doc.text(`Status: ${st.status}`, 14, y);
        y += 20;

        doc.setFontSize(12);
        doc.text(
          `Fine Rates — Absent: PKR ${fineRates.A}, Late: PKR ${fineRates.Lt}, Leave: PKR ${fineRates.L}, Half-Day: PKR ${fineRates.HD}`,
          14,
          y
        );
        y += 20;

        doc.text('Detailed Dates:', 14, y);
        y += 16;
        const from = lastAnalyticsRange.from,
          to = lastAnalyticsRange.to;
        const datesByStatus = { P: [], A: [], Lt: [], HD: [], L: [] };
        Object.entries(attendanceData).forEach(([date, rec]) => {
          if (date >= from && date <= to && rec[st.adm]) {
            datesByStatus[rec[st.adm]].push(date);
          }
        });
        ['A', 'Lt', 'L', 'HD'].forEach((code) => {
          if (datesByStatus[code].length) {
            const label = {
              A: 'Absent',
              Lt: 'Late',
              L: 'Leave',
              HD: 'Half-Day',
            }[code];
            doc.text(
              `${label} (${code}): ${datesByStatus[code].join(', ')}`,
              14,
              y
            );
            y += 14;
          }
        });

        y += 10;
      });

      const blob = doc.output('blob');
      doc.save('individual_analytics_book.pdf');
      await sharePdf(blob, 'individual_analytics_book.pdf', 'Individual Attendance Analytics');
    }
  };

  // --- Share Analytics via WhatsApp ---
  $('shareAnalytics').onclick = () => {
    if (!lastAnalyticsShare) {
      alert('No analytics to share. Generate report first.');
      return;
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`,
      '_blank'
    );
  };

  // --- 4. SETTINGS: Fines & Eligibility ---
  const formDiv = $('financialForm'),
    saveSettings = $('saveSettings'),
    inputs = ['fineAbsent', 'fineLate', 'fineLeave', 'fineHalfDay', 'eligibilityPct'].map(
      (id) => $(id)
    ),
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

  // --- 5. SETUP: School, Class & Section ---
  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([
      get('schoolName'),
      get('teacherClass'),
      get('teacherSection'),
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

  // --- 6. COUNTERS & UTILS ---
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

  // --- 7. STUDENT REGISTRATION & FINE/STATUS ---
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
      const total = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const fine =
        stats.A * fineRates.A +
        stats.Lt * fineRates.Lt +
        stats.L * fineRates.L +
        stats.HD * fineRates.HD;
      const paid = (paymentsData[s.adm] || []).reduce((a, p) => a + p.amount, 0);
      const out = fine - paid;
      const pct = total ? (stats.P / total) * 100 : 0;
      const status = out > 0 || pct < eligibilityPct ? 'Debarred' : 'Eligible';
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td><td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${out}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach((b) => (b.onclick = () => openPaymentModal(b.dataset.adm)));
  }
  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', (e) =>
    e.target.classList.contains('sel') ? toggleButtons() : null
  );
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
    students.push({
      name: n,
      adm,
      parent: p,
      contact: c,
      occupation: o,
      address: a,
      cls: cl,
      sec,
    });
    await save('students', students);
    renderStudents();
    updateCounters();
    resetViews();
    ['studentName', 'parentName', 'parentContact', 'parentOccupation', 'parentAddress'].forEach(
      (id) => $(id).value = ''
    );
  };

  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach((cb) => {
      const tr = cb.closest('tr'),
        i = +tr.dataset.index,
        s = students[i];
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" checked></td><td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"></td><td>${s.adm}</td>
        <td><input value="${s.parent}"></td><td><input value="${s.contact}"></td>
        <td><input value="${s.occupation}"></td><td><input value="${s.address}"></td><td colspan="3"></td>
      `;
    });
    hide($('editSelected'));
    show($('doneEditing'));
  };
  $('doneEditing').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach((tr) => {
      const inps = [...tr.querySelectorAll('input:not(.sel)')];
      if (inps.length === 5) {
        const [n, p, c, o, a] = inps.map((i) => i.value.trim()),
          adm = tr.children[3].textContent;
        const idx = students.findIndex((x) => x.adm === adm);
        if (idx > -1)
          students[idx] = {
            ...students[idx],
            name: n,
            parent: p,
            contact: c,
            occupation: o,
            address: a,
          };
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
    const toDel = [...document.querySelectorAll('.sel:checked')].map(
      (cb) => +cb.closest('tr').dataset.index
    );
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

  // --- 8. PAYMENT MODAL ---
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

  // --- 9. MARK ATTENDANCE ---
  const dateInput = $('dateInput'),
    loadAttendanceBtn = $('loadAttendance'),
    saveAttendanceBtn = $('saveAttendance'),
    resetAttendanceBtn = $('resetAttendance'),
    downloadAttendanceBtn = $('downloadAttendancePDF'),
    shareAttendanceBtn = $('shareAttendanceSummary'),
    attendanceBodyDiv = $('attendanceBody'),
    attendanceSummaryDiv = $('attendanceSummary'),
    statusNames = { P: 'Present', A: 'Absent', Lt: 'Late', HD: 'Half-Day', L: 'Leave' },
    statusColors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: '#FF9800', L: 'var(--info)' };

  // --- 10. ATTENDANCE & ANALYTICS REGISTRATION ---

  // Load attendance for selected date
  loadAttendanceBtn.onclick = () => {
    const date = dateInput.value;
    if (!date) { alert('Select date'); return; }
    // render attendance table
    renderAttendanceTable(date);
    show(attendanceBodyDiv, saveAttendanceBtn, resetAttendanceBtn, attendanceSummaryDiv);
    hide(loadAttendanceBtn);
  };

  function renderAttendanceTable(date) {
    const tbody = $('attendanceTableBody');
    tbody.innerHTML = '';
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const rec = attendanceData[date] || {};
    let idx = 0;
    students.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      const status = rec[s.adm] || 'P';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>
          <select data-adm="${s.adm}">
            ${Object.entries(statusNames).map(([code, label]) =>
              `<option value="${code}" ${code === status ? 'selected' : ''}>${label}</option>`
            ).join('')}
          </select>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Save attendance
  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    const selects = attendanceBodyDiv.querySelectorAll('select[data-adm]');
    attendanceData[date] = {};
    selects.forEach(sel => {
      attendanceData[date][sel.dataset.adm] = sel.value;
    });
    await save('attendanceData', attendanceData);
    alert('Attendance saved');
    show(downloadAttendanceBtn, shareAttendanceBtn, $('analyticsContainer'));
    hide(saveAttendanceBtn, resetAttendanceBtn);
    generateAttendanceSummary(date);
  };

  // Reset attendance inputs
  resetAttendanceBtn.onclick = () => {
    renderAttendanceTable(dateInput.value);
  };

  // Generate summary for sharing / PDF
  function generateAttendanceSummary(date) {
    const rec = attendanceData[date] || {};
    const summaryLines = [];
    Object.entries(statusNames).forEach(([code, label]) => {
      const count = Object.values(rec).filter(v => v === code).length;
      summaryLines.push(`${label}: ${count}`);
    });
    $('attendanceSummaryText').textContent = `Attendance for ${date}\n` + summaryLines.join(' | ');
  }

  // Download Attendance PDF
  downloadAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text(`Attendance - ${date}`, 14, 16);
    doc.autoTable({ startY: 24, html: '#attendanceTable' });
    const blob = doc.output('blob');
    doc.save(`attendance_${date}.pdf`);
    await sharePdf(blob, `attendance_${date}.pdf`, `Attendance ${date}`);
  };

  // Share Attendance Summary via WhatsApp
  shareAttendanceBtn.onclick = () => {
    const text = $('attendanceSummaryText').textContent;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- 11. ANALYTICS: generate charts and summaries ---

  $('generateAnalytics').onclick = () => {
    const from = $('analyticsFrom').value, to = $('analyticsTo').value;
    if (!from || !to || from > to) { alert('Select valid range'); return; }
    lastAnalyticsRange = { from, to };
    computeAnalytics(from, to);
    show($('analyticsActions'), $('graphs'));
  };

  function computeAnalytics(from, to) {
    // filter dates
    const dates = Object.keys(attendanceData).filter(d => d >= from && d <= to).sort();
    const stats = students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value)
      .map(s => {
        const recs = dates.map(d => attendanceData[d][s.adm] || 'P');
        const counts = { P:0, A:0, Lt:0, HD:0, L:0 };
        recs.forEach(c => counts[c]++);
        const total = recs.length;
        const fine = counts.A*fineRates.A + counts.Lt*fineRates.Lt + counts.L*fineRates.L + counts.HD*fineRates.HD;
        const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
        const outstanding = fine - paid;
        const pct = total ? (counts.P/total)*100 : 0;
        const status = (outstanding>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';
        return { name: s.name, adm: s.adm, ...counts, total, outstanding, status };
      });
    lastAnalyticsStats = stats;
    renderAnalyticsTable(stats);
    renderAnalyticsCharts(stats, dates);
    buildAnalyticsShareText(stats, from, to);
  }

  function renderAnalyticsTable(stats) {
    const tbody = $('analyticsTableBody');
    tbody.innerHTML = '';
    stats.forEach(st => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="analytics-select" data-adm="${st.adm}"></td>
        <td>${st.name}</td><td>${st.adm}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td>
        <td>${st.total}</td><td>${st.outstanding}</td><td>${st.status}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderAnalyticsCharts(stats, dates) {
    // Placeholder: implement chart rendering as needed, e.g., using Chart.js or similar
    // e.g., attendance percentage over time, fine distribution, etc.
  }

  function buildAnalyticsShareText(stats, from, to) {
    const header = `Analytics ${from} to ${to}`;
    const lines = stats.map(st =>
      `${st.name} (${st.adm}) - %Present: ${((st.P/st.total)*100).toFixed(1)}%, Fine: PKR ${st.outstanding}, ${st.status}`
    );
    lastAnalyticsShare = header + '\n' + lines.join('\n');
  }

  // Initialize analytics selectors
  $('analyticsDownloadMode').onchange = (e) => {
    analyticsDownloadMode = e.target.value;
  };
  // --- 12. Finalize and Clean Up ---

  // Handle change in download mode (combined vs individual)
  $('analyticsDownloadMode').onchange = (e) => {
    analyticsDownloadMode = e.target.value;
  };

  // Optional: reset analytics filters
  $('resetAnalytics').onclick = () => {
    hide($('analyticsActions'), $('graphs'));
    $('analyticsFrom').value = '';
    $('analyticsTo').value = '';
    lastAnalyticsStats = [];
    lastAnalyticsShare = '';
    $('analyticsTableBody').innerHTML = '';
  };

  // --- 13. Service Worker Registration ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('service-worker.js')
      .then(() => console.log('Service Worker registered'))
      .catch(console.error);
  }

}); // end DOMContentLoaded
