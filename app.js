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

  // --- DOWNLOAD & SHARE HANDLERS ---
  // 3.1 Student Registration PDF
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

  // 3.2 Share Registration via WhatsApp
  $('shareRegistration').onclick = () => {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students.filter(s => s.cls === cl && s.sec === sec).map((s, i) => {
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => { if (rec[s.adm]) stats[rec[s.adm]]++; });
      const totalMarked = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const outstanding = totalFine - paid;
      const pct = totalMarked ? (stats.P/totalMarked)*100 : 0;
      const status = (outstanding>0||pct<eligibilityPct) ? 'Debarred' : 'Eligible';
      return `*${i+1}. ${s.name} (Adm#: ${s.adm})*\nOutstanding: PKR ${outstanding}\nStatus: ${status}`;
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // 3.3 Analytics PDF download
  $('downloadAnalytics').onclick = async () => {
    // ... existing analytics download logic ...
    const { from, to } = lastAnalyticsRange;
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text('Attendance Analytics', 14, 16);
    doc.setFontSize(10);
    doc.text(`Range: ${from} to ${to}`, 14, 24);
    doc.autoTable({ startY: 30, head: [['Adm No', 'Present', 'Absent', 'Late', 'Half-Day']], body: lastAnalyticsStats });
    doc.save('analytics.pdf');
    const blob = doc.output('blob');
    await sharePdf(blob, 'analytics.pdf', 'Attendance Analytics');
  };

  // 3.4 Share Analytics via WhatsApp
  $('shareAnalytics').onclick = () => {
    // ... existing analytics sharing logic ...
    const header = `*Attendance Analytics*\nRange: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`;
    const lines = lastAnalyticsStats.map((row, i) =>
      `*${i+1}. Adm#: ${row[0]}* - P:${row[1]}, A:${row[2]}, Lt:${row[3]}, HD:${row[4]}`
    ).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // --- 4. SETTINGS: Fines & Eligibility ---
  const settingsCard = $('settingsCard'),
        formDiv     = $('settingsForm'),
        editSettings= $('editSettings'),
        saveSettings= $('saveSettings'),
        inputs      = [...document.querySelectorAll('#settingsForm input')];
  async function loadSettings() {
    const rates = await get('fineRates'), pct = await get('eligibilityPct');
    if (rates) fineRates = rates;
    if (pct) eligibilityPct = pct;
    inputs.forEach(i => {
      if (i.id === 'eligibilityPct') i.value = eligibilityPct;
      else i.value = fineRates[i.id];
    });
    show(settingsCard, editSettings);
  }
  saveSettings.onclick = async () => {
    fineRates = { A:+$('A').value, Lt:+$('Lt').value, L:+$('L').value, HD:+$('HD').value };
    eligibilityPct = +$('eligibilityPct').value;
    await save('fineRates', fineRates);
    await save('eligibilityPct', eligibilityPct);
    hide(formDiv, saveSettings, ...inputs);
    show(settingsCard, editSettings);
  };
  editSettings.onclick = () => {
    hide(settingsCard, editSettings);
    show(formDiv, saveSettings, ...inputs);
  };

  // --- 5. SETUP: School, Class & Section ---
  const setupCard = $('setupCard'),
        setupForm = $('setupForm'),
        editSetup = $('editSetup'),
        saveSetup = $('saveSetup');
  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([
      get('schoolName'),
      get('teacherClass'),
      get('teacherSection')
    ]);
    if (sc) $('schoolName').value = sc;
    if (cl) $('teacherClassSelect').value = cl;
    if (sec) $('teacherSectionSelect').value = sec;
    hide(setupForm, saveSetup);
    show(setupCard, editSetup);
    renderStudents(); updateCounters(); bindRegisterActions();
  }
  saveSetup.onclick = async () => {
    await save('schoolName', $('schoolName').value);
    await save('teacherClass', $('teacherClassSelect').value);
    await save('teacherSection', $('teacherSectionSelect').value);
    hide(setupForm, saveSetup);
    show(setupCard, editSetup);
    renderStudents(); updateCounters(); bindRegisterActions();
  };
  editSetup.onclick = () => {
    hide(setupCard, editSetup);
    show(setupForm, saveSetup);
  };

  // --- 6. COUNTERS & UTILS ---
  function updateCounters() {
    const total = students.length;
    const byCls = students.filter(s => s.cls === $('teacherClassSelect').value).length;
    $('totalStudents').textContent = total;
    $('classStudents').textContent = byCls;
  }
  function bindRegisterActions() {
    $('loadRegistration').onclick = () => renderStudents();
    $('registerSection').onclick = () => {
      $('loadBtn').click();
      show(tableWrap, changeBtn, downloadBtn, shareBtn, saveBtn);
    };
  }

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
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => { if (rec[s.adm]) stats[rec[s.adm]]++; });
      const total = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const fine  = stats.A * fineRates.A + stats.Lt * fineRates.Lt + stats.L * fineRates.L + stats.HD * fineRates.HD;
      const paid  = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out   = fine - paid;
      const pct   = total ? (stats.P/total)*100 : 0;
      const status = (out > 0 || pct < eligibilityPct) ? 'Debarred' : 'Eligible';
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${out}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });

    // reset select-all and button states
    $('selectAllStudents').checked = false;
    toggleButtons();

    // **DEBUG FIX**: bind individual checkbox clicks
    tbody.querySelectorAll('.sel').forEach(cb => cb.addEventListener('change', toggleButtons));

    // bind payment buttons
    document.querySelectorAll('.add-payment-btn').forEach(b => b.onclick = () => openPaymentModal(b.dataset.adm));
  }

  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }

  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(c => c.checked = $('selectAllStudents').checked);
    toggleButtons();
  };

  $('addStudent').onclick = async e => {
    const form = $('studentForm'), data = new FormData(form);
    const name       = data.get('name').trim();
    const parent     = data.get('parent').trim();
    const contact    = data.get('contact').trim();
    const occupation = data.get('occupation').trim();
    const address    = data.get('address').trim();
    if (!name) return alert('Name required');
    const adm = await genAdmNo();
    students.push({
      name, parent, contact, occupation, address,
      cls: $('teacherClassSelect').value,
      sec: $('teacherSectionSelect').value,
      adm
    });
    await save('students', students);
    form.reset();
    renderStudents();
    updateCounters();
  };

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
        <td colspan="3"></td>
      `;
    });
    hide($('editSelected')); show($('doneEditing'));
  };

  $('doneEditing').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach(tr=>{
      const inps=[...tr.querySelectorAll('input:not(.sel)')];
      if(inps.length===5){
        const [n,p,c,o,a]=inps.map(i=>i.value.trim()),
              adm = tr.children[3].textContent;
        const idx = students.findIndex(x=>x.adm === adm);
        if(idx > -1) {
          students[idx] = {
            ...students[idx],
            name: n,
            parent: p,
            contact: c,
            occupation: o,
            address: a
          };
        }
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
    const toDel = [...document.querySelectorAll('.sel:checked')].map(cb => +cb.closest('tr').dataset.index);
    students = students.filter((_, i) => !toDel.includes(i));
    await save('students', students);
    renderStudents();
    updateCounters();
  };

  $('saveRegistration').onclick = async () => {
    await save('students', students);
    alert('Saved!');
  };
  $('editRegistration').onclick = () => {
    renderStudents();
    toggleButtons();
  };

  // --- 8. PAYMENT MODAL ---
  const paymentModal = $('paymentModal'),
        payForm      = $('paymentForm'),
        payBtn       = $('addPayment'),
        closePay     = $('closePayment');
  function openPaymentModal(adm) {
    $('paymentAdm').textContent = adm;
    show(paymentModal);
  }
  closePay.onclick = () => hide(paymentModal);
  payBtn.onclick = async () => {
    const amt = +$('paymentAmount').value;
    const adm = $('paymentAdm').textContent;
    if (!amt) return alert('Amount?');
    paymentsData[adm] = paymentsData[adm] || [];
    paymentsData[adm].push({ date: new Date().toISOString().split('T')[0], amount: amt });
    await save('paymentsData', paymentsData);
    hide(paymentModal);
    renderStudents();
  };

  // --- 9. MARK ATTENDANCE ---
  $('markAttendance').onclick = () => {
    const date = $('attendanceDate').value;
    if (!date) return alert('Select date');
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const rec = {};
    document.querySelectorAll('#studentsBody tr').forEach(tr => {
      const adm = tr.children[3].textContent;
      const sel = tr.querySelector('.sel').checked;
      rec[adm] = sel ? 'P' : 'A';
    });
    attendanceData[date] = rec;
    save('attendanceData', attendanceData);
    alert('Attendance saved');
  };

  // --- 10. ANALYTICS ---
  $('filterAnalytics').onclick = () => {
    const from = $('fromDate').value, to = $('toDate').value;
    if (!from || !to) return alert('Select range');
    lastAnalyticsRange = { from, to };
    const stats = [];
    Object.entries(attendanceData).forEach(([date, rec]) => {
      if (date >= from && date <= to) {
        Object.entries(rec).forEach(([adm, status]) => {
          let row = stats.find(r => r[0] === adm);
          if (!row) { row = [adm, 0, 0, 0, 0]; stats.push(row); }
          if (status === 'P') row[1]++; if (status === 'A') row[2]++;
          if (status === 'Lt') row[3]++; if (status === 'HD') row[4]++;
        });
      }
    });
    lastAnalyticsStats = stats;
    show($('downloadAnalytics'), $('shareAnalytics'));
  };

  // --- 11. ATTENDANCE REGISTER ---
  $('viewRegister').onclick = () => {
    const date = $('regDate').value;
    if (!date) return alert('Select date');
    const rec = attendanceData[date];
    if (!rec) return alert('No data');
    const tbody = $('registerBody');
    tbody.innerHTML = '';
    Object.entries(rec).forEach(([adm, status]) => {
      const s = students.find(x => x.adm === adm);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${adm}</td><td>${status}</td>`;
      tbody.appendChild(tr);
    });
  };

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
