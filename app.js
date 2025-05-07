// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- Universal PDF share helper (must come first) ---
  async function sharePdf(blob, fileName, title) {
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })) {
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
  if (!window.idbKeyval) { console.error('idb-keyval not found'); return; }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // --- 2. State & Defaults ---
  let students       = await get('students')        || [];
  let attendanceData = await get('attendanceData')  || {};
  let paymentsData   = await get('paymentsData')    || {};
  let lastAdmNo      = await get('lastAdmissionNo') || 0;
  let fineRates      = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct = await get('eligibilityPct')  || 75;
  let analyticsFilterOptions = ['all'], analyticsDownloadMode = 'combined';
  let lastAnalyticsStats = [], lastAnalyticsRange = { from: null, to: null }, lastAnalyticsShare = '';

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 3. DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- Attendance Section Styling ---
  const attendanceStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Bubblegum+Sans&display=swap');
    .attendance-container .attendance-info-row {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 1rem;
      margin-bottom: 0.25rem;
    }
    .attendance-container .sr-num,
    .attendance-container .adm-num {
      font-weight: bold;
      font-size: 1.2rem;
      color: green;
    }
    .attendance-container .student-name {
      font-weight: bold;
      font-size: 1.5rem;
      color: royalblue;
      font-family: 'Bubblegum Sans', cursive;
    }
    .attendance-student-container {
      margin-bottom: 1rem;
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = attendanceStyles;
  document.head.appendChild(styleEl);

  // --- 4. DOWNLOAD & SHARE HANDLERS ---
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
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students.filter(s => s.cls === cl && s.sec === sec).map(s => {
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => { if (rec[s.adm]) stats[rec[s.adm]]++; });
      const totalMarked = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const outstanding = totalFine - paid;
      const pct = totalMarked ? (stats.P/totalMarked)*100 : 0;
      const status = (outstanding>0||pct<eligibilityPct) ? 'Debarred' : 'Eligible';
      return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: PKR ${outstanding}\nStatus: ${status}`;
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // --- 5. SETTINGS: Fines & Eligibility ---
  const formDiv      = $('financialForm'),
        saveSettings = $('saveSettings'),
        inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map(id => $(id)),
        settingsCard = document.createElement('div'),
        editSettings = document.createElement('button');
  settingsCard.id = 'settingsCard';
  settingsCard.className = 'card hidden';
  editSettings.id = 'editSettings';
  editSettings.className = 'btn no-print hidden';
  editSettings.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editSettings);

  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveSettings.onclick = async () => {
    fineRates = {
      A: Number($('fineAbsent').value) || 0,
      Lt: Number($('fineLate').value) || 0,
      L: Number($('fineLeave').value) || 0,
      HD: Number($('fineHalfDay').value) || 0
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);
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
    const [sc, cl, sec] = await Promise.all([
      get('schoolName'),
      get('teacherClass'),
      get('teacherSection')
    ]);
    if (sc && cl && sec) {
      $('schoolNameInput').value      = sc;
      $('teacherClassSelect').value   = cl;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent      = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
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
    const sec= $('teacherSectionSelect').value;
    if (!sc || !cl || !sec) { alert('Complete setup'); return; }
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

  // --- 7. COUNTERS & UTILS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
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
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s => s.cls === cl && s.sec === sec).length;
    $('classCount').dataset.target   = students.filter(s => s.cls === cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  function resetViews() {
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'),
      $('registerTableWrapper'), $('changeRegister'),
      $('saveRegister'), $('downloadRegister'), $('shareRegister')
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
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx = 0;
    students.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => { if (rec[s.adm]) stats[rec[s.adm]]++; });
      const total = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const fine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out = fine - paid;
      const pct = total ? (stats.P/total)*100 : 0;
      const status = (out>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';
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
        <td>PKR ${out}</td>
        <td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>`;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b => b.onclick = () => openPaymentModal(b.dataset.adm));
  }
  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => e.target.classList.contains('sel') && toggleButtons());
  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(c => c.checked = $('selectAllStudents').checked);
    toggleButtons();
  };

  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n  = $('studentName').value.trim(),
          p  = $('parentName').value.trim(),
          c  = $('parentContact').value.trim(),
          o  = $('parentOccupation').value.trim(),
          a  = $('parentAddress').value.trim(),
      // --- continue in app.js ---

  // --- edit, delete & save registration handlers ---
  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach(cb => {
      const tr = cb.closest('tr'), i = +tr.dataset.index, s = students[i];
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
    document.querySelectorAll('#studentsBody tr').forEach(tr => {
      const inputs = [...tr.querySelectorAll('input:not(.sel)')];
      if (inputs.length === 5) {
        const [name, parent, contact, occupation, address] = inputs.map(i => i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(x => x.adm === adm);
        if (idx > -1) students[idx] = { ...students[idx], name, parent, contact, occupation, address };
      }
    });
    await save('students', students);
    hide($('doneEditing'));
    show($('editSelected'), $('deleteSelected'), $('saveRegistration'));
    renderStudents();
    updateCounters();
  };

  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected?')) return;
    const toDelete = [...document.querySelectorAll('.sel:checked')].map(cb => +cb.closest('tr').dataset.index);
    students = students.filter((_, i) => !toDelete.includes(i));
    await save('students', students);
    renderStudents();
    updateCounters();
    resetViews();
  };

  $('saveRegistration').onclick = async () => {
    if (!$('doneEditing').classList.contains('hidden')) {
      alert('Finish editing first');
      return;
    }
    await save('students', students);
    hide(
      document.querySelector('#student-registration .row-inline'),
      $('editSelected'), $('deleteSelected'), $('selectAllStudents'), $('saveRegistration')
    );
    show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents();
    updateCounters();
  };

  $('editRegistration').onclick = () => {
    show(
      document.querySelector('#student-registration .row-inline'),
      $('selectAllStudents'), $('editSelected'), $('deleteSelected'), $('saveRegistration')
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
    const adm = $('payAdm').textContent, amt = Number($('paymentAmount').value) || 0;
    paymentsData[adm] = paymentsData[adm] || [];
    paymentsData[adm].push({ date: new Date().toISOString().split('T')[0], amount: amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));

  // --- 10. MARK ATTENDANCE ---
  const dateInput             = $('dateInput'),
        loadAttendanceBtn     = $('loadAttendance'),
        saveAttendanceBtn     = $('saveAttendance'),
        resetAttendanceBtn    = $('resetAttendance'),
        downloadAttendanceBtn = $('downloadAttendancePDF'),
        shareAttendanceBtn    = $('shareAttendanceSummary'),
        attendanceBodyDiv     = $('attendanceBody'),
        attendanceSummaryDiv  = $('attendanceSummary'),
        statusNames           = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' },
        statusColors          = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  attendanceBodyDiv.classList.add('attendance-container');

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = '';
    attendanceSummaryDiv.innerHTML = '';
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    students.filter(s => s.cls === cl && s.sec === sec).forEach((stu, i) => {
      const container = document.createElement('div');
      container.className = 'attendance-student-container';

      const infoRow = document.createElement('div');
      infoRow.className = 'attendance-info-row';
      const sr = document.createElement('span');
      sr.className = 'sr-num';
      sr.textContent = `#${i+1}`;
      const adm = document.createElement('span');
      adm.className = 'adm-num';
      adm.textContent = `(${stu.adm})`;
      const name = document.createElement('span');
      name.className = 'student-name';
      name.textContent = stu.name;
      infoRow.append(sr, adm, name);

      const btns = document.createElement('div');
      btns.className = 'attendance-buttons';
      Object.keys(statusNames).forEach(code => {
        const btn = document.createElement('button');
        btn.className = 'att-btn';
        btn.textContent = code;
        btn.onclick = () => {
          btns.querySelectorAll('.att-btn').forEach(b => {
            b.classList.remove('selected');
            b.style.background = '';
            b.style.color = '';
          });
          btn.classList.add('selected');
          btn.style.background = statusColors[code];
          btn.style.color = '#fff';
        };
        btns.appendChild(btn);
      });

      container.append(infoRow, btns);
      attendanceBodyDiv.appendChild(container);
    });

    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert('Please pick a date'); return; }
    attendanceData[date] = {};
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    students.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
      const sel = attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = sel ? sel.textContent : 'A';
    });
    await save('attendanceData', attendanceData);

    // build summary table with Sr# and Adm#
    attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement('table');
    tbl.id = 'attendanceSummaryTable';
    tbl.innerHTML = `
      <thead>
        <tr>
          <th>Sr#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th>
        </tr>
      </thead>
      <tbody>
      </tbody>`;
    const tb = tbl.querySelector('tbody');
    students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value)
      .forEach((s, i) => {
        const code = attendanceData[date][s.adm];
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${i+1}</td>
          <td>${s.adm}</td>
          <td>${s.name}</td>
          <td>${statusNames[code]}</td>
          <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>`;
        tb.appendChild(tr);
      });
    attendanceSummaryDiv.appendChild(tbl);

    attendanceSummaryDiv.querySelectorAll('.share-individual').forEach(ic => {
      ic.onclick = () => {
        const adm = ic.dataset.adm;
        const stu = students.find(x => x.adm === adm);
        const code = attendanceData[date][adm];
        const msg = `Dear Parent, your child was ${statusNames[code]} on ${date}.`;
        window.open(`https://wa.me/${stu.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      };
    });

    hide(attendanceBodyDiv, saveAttendanceBtn);
    show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  resetAttendanceBtn.onclick = () => {
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  downloadAttendanceBtn.onclick = async () => {
    const doc = new jspdf.jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const date = dateInput.value;
    const today = new Date().toISOString().split('T')[0];

    doc.setFontSize(18);
    doc.text('Attendance Report', 14, 16);
    doc.setFontSize(10);
    doc.text(`Date: ${today}`, w - 14, 16, { align: 'right' });
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);

    doc.autoTable({ startY: 32, html: '#attendanceSummaryTable' });
    const blob = doc.output('blob');
    doc.save(`attendance_${date}.pdf`);
    await sharePdf(blob, `attendance_${date}.pdf`, 'Attendance Report');
  };

  shareAttendanceBtn.onclick = () => {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value, date = dateInput.value;
    const header = `*Attendance Report*\nClass ${cl} Section ${sec} - ${date}`;
    const lines = [];
    const rows = attendanceSummaryDiv.querySelectorAll('#attendanceSummaryTable tbody tr');
    rows.forEach(tr => {
      const name = tr.children[2].textContent;
      const status = tr.children[3].textContent;
      lines.push(`*${name}*: ${status}`);
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines.join('\n'))}`, '_blank');
  };

  // --- rest of analytics, register, service worker unchanged ---
});
