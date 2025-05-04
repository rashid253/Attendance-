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
  let students        = await get('students')        || [];
  let attendanceData  = await get('attendanceData')  || {};
  let paymentsData    = await get('paymentsData')    || {};
  let lastAdmNo       = await get('lastAdmissionNo') || 0;
  let fineRates       = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct  = await get('eligibilityPct')  || 75;

  // Analytics filter & download settings
  let analyticsFilterOptions = ['all'];
  let analyticsDownloadMode  = 'combined';
  let lastAnalyticsStats     = [];
  let lastAnalyticsRange     = { from: null, to: null };
  let lastAnalyticsShare     = '';

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 3. DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- 4. SETTINGS: Fines & Eligibility ---
  const formDiv      = $('financialForm');
  const saveSettings = $('saveSettings');
  const inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct']
    .map(id => $(id));

  const settingsCard = document.createElement('div');
  settingsCard.id    = 'settingsCard';
  settingsCard.className = 'card hidden';
  const editSettings = document.createElement('button');
  editSettings.id    = 'editSettings';
  editSettings.className = 'btn no-print hidden';
  editSettings.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editSettings);

  // initialize form values
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveSettings.onclick = async () => {
    fineRates = {
      A : Number($('fineAbsent').value)   || 0,
      Lt: Number($('fineLate').value)     || 0,
      L : Number($('fineLeave').value)    || 0,
      HD: Number($('fineHalfDay').value)  || 0,
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
      </div>
    `;
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
    const sc  = $('schoolNameInput').value.trim();
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!sc || !cl || !sec) { alert('Complete setup'); return; }
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- 6. COUNTERS & UTILS ---
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
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s => s.cls===cl && s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s => s.cls===cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
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
  $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- 7. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx = 0;
    students.forEach((s, i) => {
      if (s.cls!==cl || s.sec!==sec) return;
      idx++;
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.entries(attendanceData).forEach(([date, recs]) => {
        const c = recs[s.adm] || 'A';
        stats[c]++;
      });
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid       = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      const outstanding= totalFine - paid;
      const totalDays  = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const pct        = totalDays ? (stats.P/totalDays)*100 : 0;
      const status     = (outstanding>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';

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
    $('selectAllStudents').checked = false;
    toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
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
    const n = $('studentName').value.trim(),
          p = $('parentName').value.trim(),
          c = $('parentContact').value.trim(),
          o = $('parentOccupation').value.trim(),
          a = $('parentAddress').value.trim(),
          cl= $('teacherClassSelect').value,
          sec= $('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a){ alert('All fields required'); return; }
    if(!/^\d{7,15}$/.test(c)){ alert('Contact 7–15 digits'); return; }
    const adm = await genAdmNo();
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec });
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress']
      .forEach(id => $(id).value = '');
  };
  // edit, delete, save registration handlers…
  // (unchanged from original)

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent;
    const amt = Number($('paymentAmount').value) || 0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ date: new Date().toISOString().split('T')[0], amount: amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));

  // --- 9. MARK ATTENDANCE ---
  // loadAttendance, saveAttendance, resetAttendance, downloadAttendance, shareAttendance…
  // (unchanged from original)

  // --- 10. ANALYTICS ---
  const atg       = $('analyticsTarget');
  const asel      = $('analyticsSectionSelect');
  const atype     = $('analyticsType');
  const adate     = $('analyticsDate');
  const amonth    = $('analyticsMonth');
  const sems      = $('semesterStart');
  const seme      = $('semesterEnd');
  const ayear     = $('yearStart');
  const asearch   = $('analyticsSearch');
  const loadA     = $('loadAnalytics');
  const resetA    = $('resetAnalytics');
  const instr     = $('instructions');
  const acont     = $('analyticsContainer');
  const graphs    = $('graphs');
  const aacts     = $('analyticsActions');
  const barCtx    = $('barChart').getContext('2d');
  const pieCtx    = $('pieChart').getContext('2d');
  let barChart, pieChart;

  // filter modal handlers
  $('analyticsFilterBtn').onclick    = () => show($('analyticsFilterModal'));
  $('analyticsFilterClose').onclick  = () => hide($('analyticsFilterModal'));
  $('applyAnalyticsFilter').onclick  = () => {
    analyticsFilterOptions = Array.from(
      document.querySelectorAll('#analyticsFilterForm input[type="checkbox"]:checked')
    ).map(cb => cb.value) || ['all'];
    analyticsDownloadMode = document.querySelector(
      '#analyticsFilterForm input[name="downloadMode"]:checked'
    ).value;
    hide($('analyticsFilterModal'));
    if (lastAnalyticsStats.length) {
      renderAnalytics(lastAnalyticsStats, lastAnalyticsRange.from, lastAnalyticsRange.to);
    }
  };

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearch].forEach(x => x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
    if (atg.value === 'section') asel.classList.remove('hidden');
    if (atg.value === 'student') asearch.classList.remove('hidden');
  };

  atype.onchange = () => {
    [adate, amonth, sems, seme, ayear].forEach(x => x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
    resetA.classList.remove('hidden');
    switch (atype.value) {
      case 'date':     adate.classList.remove('hidden'); break;
      case 'month':    amonth.classList.remove('hidden'); break;
      case 'semester': sems.classList.remove('hidden'); seme.classList.remove('hidden'); break;
      case 'year':     ayear.classList.remove('hidden'); break;
    }
  };

  resetA.onclick = e => {
    e.preventDefault();
    atype.value = '';
    [adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
    resetA.classList.add('hidden');
  };

  loadA.onclick = () => {
    // compute from, to, stats…
    lastAnalyticsStats = stats;
    lastAnalyticsRange = { from, to };
    renderAnalytics(stats, from, to);
  };

  function renderAnalytics(stats, from, to) {
    let filtered = stats;
    if (!analyticsFilterOptions.includes('all')) {
      filtered = stats.filter(st => analyticsFilterOptions.some(opt => {
        switch (opt) {
          case 'registered': return true;
          case 'attendance':  return st.total > 0;
          case 'fine':        return (st.A>0||st.Lt>0||st.L>0||st.HD>0);
          case 'cleared':     return st.outstanding === 0;
          case 'debarred':    return st.status === 'Debarred';
          case 'eligible':    return st.status === 'Eligible';
          default:            return false;
        }
      }));
    }

    const thead = $('analyticsTable').querySelector('thead tr');
    thead.innerHTML = ['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']
      .map(h => `<th>${h}</th>`).join('');
    const tbody = $('analyticsBody');
    tbody.innerHTML = '';
    filtered.forEach((st,i) => {
      const pct = st.total ? ((st.P/st.total)*100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${st.adm}</td>
        <td>${st.name}</td>
        <td>${st.P}</td>
        <td>${st.A}</td>
        <td>${st.Lt}</td>
        <td>${st.HD}</td>
        <td>${st.L}</td>
        <td>${st.total}</td>
        <td>${pct}%</td>
        <td>PKR ${st.outstanding}</td>
        <td>${st.status}</td>
      `;
      tbody.appendChild(tr);
    });

    instr.textContent = `Period: ${from} to ${to}`;
    show(instr, acont, graphs, aacts);

    // Bar Chart
    barChart?.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: filtered.map(st => st.name),
        datasets: [{ label: '% Present', data: filtered.map(st => st.total ? (st.P/st.total)*100 : 0) }]
      },
      options: { scales: { y: { beginAtZero: true, max: 100 } } }
    });

    // Pie Chart
    const totalOutstanding = filtered.reduce((sum, st) => sum + st.outstanding, 0);
    pieChart?.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: { labels: ['Outstanding'], datasets: [{ data: [totalOutstanding] }] }
    });

    lastAnalyticsShare = `Analytics (${from} to ${to})\n` +
      filtered.map((st,i) => `${i+1}. ${st.adm} ${st.name}: ${((st.P/st.total)*100).toFixed(1)}% / PKR ${st.outstanding}`)
        .join('\n');
  }

  $('downloadAnalytics').onclick = () => {
    const filtered = lastAnalyticsStats.filter(st => {
      if (analyticsFilterOptions.includes('all')) return true;
      return analyticsFilterOptions.some(opt => {
        switch (opt) {
          case 'registered': return true;
          case 'attendance':  return st.total > 0;
          case 'fine':        return (st.A>0||st.Lt>0||st.L>0||st.HD>0);
          case 'cleared':     return st.outstanding === 0;
          case 'debarred':    return st.status === 'Debarred';
          case 'eligible':    return st.status === 'Eligible';
          default:            return false;
        }
      });
    });

    if (analyticsDownloadMode === 'combined') {
      const doc = new jspdf.jsPDF();
      doc.setFontSize(18);
      doc.text('Analytics Report', 14, 16);
      doc.setFontSize(12);
      doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 24);
      const body = filtered.map((st,i) => [
        i+1, st.adm, st.name, st.P, st.A, st.Lt, st.HD, st.L,
        st.total, `${((st.P/st.total)*100).toFixed(1)}%`,
        `PKR ${st.outstanding}`, st.status
      ]);
      doc.autoTable({
        startY: 32,
        head: [['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']],
        body,
        styles: { fontSize: 10 }
      });
      doc.save('analytics_report.pdf');
    } else {
      filtered.forEach(st => {
        const doc = new jspdf.jsPDF();
        doc.setFontSize(16);
        doc.text(`Report for ${st.name} (${st.adm})`, 14, 16);
        doc.setFontSize(12);
        const rows = [
          ['Present', st.P],
          ['Absent', st.A],
          ['Late', st.Lt],
          ['Half-Day', st.HD],
          ['Leave', st.L],
          ['Total', st.total],
          ['% Present', `${((st.P/st.total)*100).toFixed(1)}%`],
          ['Outstanding', `PKR ${st.outstanding}`],
          ['Status', st.status]
        ];
        doc.autoTable({
          startY: 24,
          head: [['Metric','Value']],
          body: rows,
          styles: { fontSize: 10 }
        });
        doc.save(`report_${st.adm}.pdf`);
      });
    }
  };

  $('shareAnalytics').onclick = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');

  // --- 11. ATTENDANCE REGISTER ---
  const loadReg   = $('loadRegister');
  const changeReg = $('changeRegister');
  const saveReg   = $('saveRegister');
  const dlReg     = $('downloadRegister');
  const shReg     = $('shareRegister');
  const rm        = $('registerMonth');
  const rh        = $('registerHeader');
  const rb        = $('registerBody');
  const regCodes  = ['A','P','Lt','HD','L'];
  const regColors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  loadReg.onclick = () => {
    const m = rm.value;
    if (!m) { alert('Pick month'); return; }
    const [y, mm] = m.split('-').map(Number);
    const days = new Date(y, mm, 0).getDate();

    rh.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
      [...Array(days)].map((_,i) => `<th>${i+1}</th>`).join('');

    rb.innerHTML = '';
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s => s.cls===cl && s.sec===sec);

    roster.forEach((s,i) => {
      let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1; d<=days; d++) {
        const key = `${m}-${String(d).padStart(2,'0')}`;
        const c   = (attendanceData[key]||{})[s.adm] || 'A';
        const style = c==='A' ? '' : `style="background:${regColors[c]};color:#fff"`;
        row += `<td class="reg-cell" ${style}><span class="status-text">${c}</span></td>`;
      }
      const tr = document.createElement('tr');
      tr.innerHTML = row;
      rb.appendChild(tr);
    });

    rb.querySelectorAll('.reg-cell').forEach(cell => {
      cell.onclick = () => {
        const span = cell.querySelector('.status-text');
        let idx = regCodes.indexOf(span.textContent);
        idx = (idx+1) % regCodes.length;
        const c = regCodes[idx];
        span.textContent = c;
        if (c==='A') {
          cell.style.background = '';
          cell.style.color = '';
        } else {
          cell.style.background = regColors[c];
          cell.style.color = '#fff';
        }
      };
    });

    show($('registerTableWrapper'), saveReg);
    hide(loadReg, changeReg, dlReg, shReg);
  };

  saveReg.onclick = async () => {
    const m = rm.value;
    const [y, mm] = m.split('-').map(Number);
    const days = new Date(y, mm, 0).getDate();
    Array.from(rb.children).forEach(tr => {
      const adm = tr.children[1].textContent;
      for (let d=1; d<=days; d++) {
        const code = tr.children[3 + d - 1].querySelector('.status-text').textContent;
        const key = `${m}-${String(d).padStart(2,'0')}`;
        attendanceData[key] = attendanceData[key] || {};
        attendanceData[key][adm] = code;
      }
    });
    await save('attendanceData', attendanceData);
    hide(saveReg);
    show(changeReg, dlReg, shReg);
  };

  changeReg.onclick = () => {
    hide($('registerTableWrapper'), changeReg, dlReg, shReg, saveReg);
    $('registerHeader').innerHTML = '';
    $('registerBody').innerHTML   = '';
    show($('loadRegister'));
  };

  dlReg.onclick = () => {
    const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    doc.setFontSize(18); doc.text('Attendance Register',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#registerTable', tableWidth:'auto', styles:{ fontSize:10 } });
    doc.save('attendance_register.pdf');
  };

  shReg.onclick = () => {
    const header = `Attendance Register\n${$('setupText').textContent}`;
    const rows = Array.from(rb.children).map(tr =>
      Array.from(tr.children).map(td =>
        td.querySelector('.status-text') ? td.querySelector('.status-text').textContent : td.textContent
      ).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows.join('\n'))}`, '_blank');
  };

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});

// --- Fine Report PDF Block ---
document.addEventListener('DOMContentLoaded', () => {
  const fineReportBtn = document.getElementById('generateFineReport');
  fineReportBtn.addEventListener('click', generateFineReportPDF);
});

async function generateFineReportPDF() {
  const fineRates      = await idbKeyval.get('fineRates')      || { A:0, Lt:0, L:0, HD:0 };
  const eligibilityPct = await idbKeyval.get('eligibilityPct') || 0;
  const attendanceData = await idbKeyval.get('attendanceData') || {};
  const students       = await idbKeyval.get('students')       || [];

  const type = document.getElementById('analyticsType').value;
  let fromDate, toDate;
  if (type === 'date') {
    fromDate = toDate = document.getElementById('analyticsDate').value;
  } else if (type === 'month') {
    const m = document.getElementById('analyticsMonth').value;
    const [y, mon] = m.split('-').map(Number);
    fromDate = `${m}-01`;
    toDate   = `${m}-${String(new Date(y, mon, 0).getDate()).padStart(2,'0')}`;
  } else if (type === 'semester') {
    const s1 = document.getElementById('semesterStart').value;
    const s2 = document.getElementById('semesterEnd').value;
    const [sy, sm] = s1.split('-').map(Number);
    const [ey, em] = s2.split('-').map(Number);
    fromDate = `${s1}-01`;
    toDate   = `${s2}-${String(new Date(ey, em, 0).getDate()).padStart(2,'0')}`;
  } else if (type === 'year') {
    const y = document.getElementById('yearStart').value;
    fromDate = `${y}-01-01`;
    toDate   = `${y}-12-31}`;
  } else {
    alert('Please select a valid period.');
    return;
  }

  const finesEntries = [];
  for (const [date, recs] of Object.entries(attendanceData)) {
    if (date < fromDate || date > toDate) continue;
    students.forEach(s => {
      const status = recs[s.adm] || 'A';
      const amount = fineRates[status] || 0;
      if (amount > 0) {
        finesEntries.push({
          studentId: s.adm,
          name:      s.name,
          class:     s.cls,
          section:   s.sec,
          date,
          type:      status,
          amount
        });
      }
    });
  }

  const doc = new jspdf.jsPDF();
  let y = 10;
  doc.setFontSize(14).text('Fine & Eligibility Criteria', 10, y); y += 8;
  doc.setFontSize(12);
  doc.text(`Absent Fine: PKR ${fineRates.A}`, 10, y); y += 6;
  doc.text(`Late Fine: PKR ${fineRates.Lt}`, 10, y); y += 6;
  doc.text(`Leave Fine: PKR ${fineRates.L}`, 10, y); y += 6;
  doc.text(`Half-Day Fine: PKR ${fineRates.HD}`, 10, y); y += 6;
  doc.text(`Passing % Threshold: ${eligibilityPct}%`, 10, y); y += 10;

  doc.setFontSize(14).text('Detailed Fine Report', 10, y); y += 6;
  const fineTable = finesEntries.map(f => [
    f.studentId, f.name, f.class, f.section, f.date, f.type, f.amount
  ]);
  doc.autoTable({
    startY: y,
    head: [['Adm#','Name','Class','Section','Date','Type','Amount (PKR)']],
    body: fineTable,
    styles: { fontSize: 10 }
  });

  const blobUrl = doc.output('bloburl');
  window.open(blobUrl);
  doc.save('fine_report.pdf');
}
