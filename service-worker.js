// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- 0. Request Persistent Storage so data survives “Clear Site Data” if possible ---
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted();
    if (!isPersisted) {
      const granted = await navigator.storage.persist();
      console.log('Persistent storage granted:', granted);
    } else {
      console.log('Already persistent storage');
    }
  }

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

  // --- 1. Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- 2. IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) { console.error('idb-keyval not found'); return; }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // --- 3. State & Defaults ---
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

  // --- 4. DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

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
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students.filter(s => s.cls === cl && s.sec === sec).map(s => {
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => { if (rec[s.adm]) stats[rec.adm]++; });
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
      doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 32);
      const fineLine = `Fines – Absent: PKR ${fineRates.A}, Late: PKR ${fineRates.Lt}, Leave: PKR ${fineRates.L}, Half-Day: PKR ${fineRates.HD}`;
      const eligLine = `Eligibility: ≥ ${eligibilityPct}%`;
      doc.text(fineLine, 14, 40);
      doc.text(eligLine, 14, 46);
      doc.autoTable({ startY: 52, html: '#analyticsTable' });
      const blob = doc.output('blob');
      doc.save('analytics_report.pdf');
      await sharePdf(blob, 'analytics_report.pdf', 'Attendance Analytics Report');
    } else {
      const doc = new jspdf.jsPDF();
      lastAnalyticsStats.forEach((st, i) => {
        if (i > 0) doc.addPage();
        doc.setFontSize(18);
        doc.text('Individual Attendance Analytics Report', 14, 16);
        doc.setFontSize(12);
        doc.text(setupHeader, 14, 24);
        doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 32);
        doc.text(`Fines – Absent: PKR ${fineRates.A}, Late: PKR ${fineRates.Lt}, Leave: PKR ${fineRates.L}, Half-Day: PKR ${fineRates.HD}`, 14, 40);
        doc.text(`Eligibility: ≥ ${eligibilityPct}%`, 14, 46);
        doc.setFontSize(14);
        doc.text(`Name: ${st.name}`, 14, 60);
        doc.text(`Adm#: ${st.adm}`, 14, 76);
        doc.text(`Present: ${st.P}`, 14, 92);
        doc.text(`Absent: ${st.A}`, 14, 108);
        doc.text(`Late: ${st.Lt}`, 14, 124);
        doc.text(`Half-Day: ${st.HD}`, 14, 140);
        doc.text(`Leave: ${st.L}`, 14, 156);
        doc.text(`Total: ${st.total}`, 14, 172);
        const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : '0.0';
        doc.text(`% Present: ${pct}%`, 14, 188);
        doc.text(`Outstanding: PKR ${st.outstanding}`, 14, 204);
        doc.text(`Status: ${st.status}`, 14, 220);
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
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');
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
    fineRates = { A:Number($('fineAbsent').value)||0, Lt:Number($('fineLate').value)||0, L:Number($('fineLeave').value)||0, HD:Number($('fineHalfDay').value)||0 };
    eligibilityPct = Number($('eligibilityPct').value)||0;
    await Promise.all([ save('fineRates', fineRates), save('eligibilityPct', eligibilityPct) ]);
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
    const [sc,cl,sec] = await Promise.all([ get('schoolName'), get('teacherClass'), get('teacherSection') ]);
    if (sc && cl && sec) {
      $('schoolNameInput').value      = sc;
      $('teacherClassSelect').value   = cl;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent      = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderStudents(); updateCounters(); resetViews();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc = $('schoolNameInput').value.trim(), cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    if (!sc||!cl||!sec) { alert('Complete setup'); return; }
    await Promise.all([ save('schoolName', sc), save('teacherClass', cl), save('teacherSection', sec) ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- 7. COUNTERS & UTILS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target; let count = 0; const step = Math.max(1, target/100);
      (function upd(){ count+=step; span.textContent = count<target?Math.ceil(count):target; if(count<target) requestAnimationFrame(upd); })();
    });
  }
  function updateCounters() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cl).length;
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
  $('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- 8. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value, tbody = $('studentsBody');
    tbody.innerHTML = ''; let idx = 0;
    students.forEach((s,i) => {
      if (s.cls!==cl||s.sec!==sec) return;
      idx++;
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(rec=>{ if(rec[s.adm]) stats[rec[s.adm]]++; });
      const total = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const fine = stats.A*fineRates.A+stats.Lt*fineRates.Lt+stats.L*fineRates.L+stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out = fine-paid;
      const pct = total? (stats.P/total)*100:0;
      const status = (out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr = document.createElement('tr'); tr.dataset.index=i;
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td><td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${out}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked=false; toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }
  $('addStudent').onclick = async e=>{
    e.preventDefault();
    const n=$('studentName').value.trim(),p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(),o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim(),cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a){alert('All fields required');return;}
    if(!/^\d{7,15}$/.test(c)){alert('Contact 7–15 digits');return;}
    const adm=await genAdmNo();
    students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls:cl,sec});
    await save('students',students); renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };

  // --- 9. MARK ATTENDANCE ---
const dateInput               = $('dateInput');
const loadAttendanceBtn       = $('loadAttendance');
const saveAttendanceBtn       = $('saveAttendance');
const resetAttendanceBtn      = $('resetAttendance');
const downloadAttendanceBtn   = $('downloadAttendancePDF');
const shareAttendanceBtn      = $('shareAttendanceSummary');
const attendanceBodyDiv       = $('attendanceBody');
const attendanceSummaryDiv    = $('attendanceSummary');
const statusNames             = { P: 'Present', A: 'Absent', Lt: 'Late', HD: 'Half-Day', L: 'Leave' };
const statusColors            = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: '#FF9800', L: 'var(--info)' };

// 1. Load attendance UI
loadAttendanceBtn.onclick = () => {
  attendanceBodyDiv.innerHTML = '';
  attendanceSummaryDiv.innerHTML = '';
  const cl  = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;
  const date = dateInput.value;
  if (!date) { alert('Pick a date'); return; }
  students.filter(s => s.cls === cl && s.sec === sec).forEach((stu, i) => {
    const row = document.createElement('div');
    row.className = 'attendance-row';

    // Header: Sr#. Name (Adm#)
    const headerDiv = document.createElement('div');
    headerDiv.className = 'attendance-header';
    headerDiv.textContent = `${i + 1}. ${stu.name} (${stu.adm})`;

    // Status buttons
    const btnsDiv = document.createElement('div');
    btnsDiv.className = 'attendance-buttons';
    Object.keys(statusNames).forEach(code => {
      const btn = document.createElement('button');
      btn.className = 'att-btn';
      btn.textContent = code;
      btn.onclick = () => {
        btnsDiv.querySelectorAll('.att-btn').forEach(b => {
          b.classList.remove('selected');
          b.style = '';
        });
        btn.classList.add('selected');
        btn.style.background = statusColors[code];
        btn.style.color = '#fff';
      };
      btnsDiv.appendChild(btn);
    });

    row.append(headerDiv, btnsDiv);
    attendanceBodyDiv.appendChild(row);
  });

  show(attendanceBodyDiv, saveAttendanceBtn);
  hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
};

// 2. Save & Show Summary
saveAttendanceBtn.onclick = async () => {
  const date = dateInput.value;
  attendanceData[date] = attendanceData[date] || {};
  attendanceBodyDiv.querySelectorAll('.attendance-row').forEach((row, i) => {
    const adm = students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value)[i].adm;
    const selected = row.querySelector('.selected');
    if (selected) attendanceData[date][adm] = selected.textContent;
  });
  await save('attendanceData', attendanceData);

  // Build summary table
  const tbl = document.createElement('table');
  tbl.className = 'table';
  tbl.innerHTML = `
    <thead>
      <tr><th>#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th></tr>
    </thead>
    <tbody>
      ${students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value)
        .map((s, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${s.adm}</td>
            <td>${s.name}</td>
            <td>${statusNames[attendanceData[date][s.adm]]}</td>
            <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
          </tr>`).join('')}
    </tbody>
  `;
  attendanceSummaryDiv.appendChild(tbl);

  attendanceSummaryDiv.querySelectorAll('.share-individual').forEach(ic => {
    ic.onclick = () => {
      const adm = ic.dataset.adm;
      const st  = students.find(x => x.adm === adm);
      const msg = `Dear Parent, your child (Adm#: ${adm}) was ${statusNames[attendanceData[date][adm]]} on ${date}.`;
      window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`, '_blank');
    };
  });

  hide(attendanceBodyDiv, saveAttendanceBtn);
  show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
};

// 3. Reset view
resetAttendanceBtn.onclick = () => {
  show(attendanceBodyDiv, saveAttendanceBtn);
  hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
};

// 4. Download PDF
downloadAttendanceBtn.onclick = async () => {
  const doc = new jspdf.jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const today = new Date().toISOString().split('T')[0];
  const cl  = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;
  const date = dateInput.value;

  doc.setFontSize(18);
  doc.text('Attendance Report', 14, 16);
  doc.setFontSize(10);
  doc.text(`Date: ${today}`, pageWidth - 14, 16, { align: 'right' });
  doc.setFontSize(12);
  doc.text(`Class ${cl} Section ${sec} - ${date}`, 14, 24);
  doc.autoTable({ startY: 30, html: '#attendanceSummary table' });

  const blob = doc.output('blob');
  doc.save('attendance_report.pdf');
  await sharePdf(blob, 'attendance_report.pdf', 'Attendance Report');
};

// 5. Share via WhatsApp
shareAttendanceBtn.onclick = () => {
  const cl  = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;
  const date = dateInput.value;
  const header = `*Attendance Report*\nClass ${cl} Sec ${sec} - ${date}`;
  const lines = students
    .filter(s => s.cls === cl && s.sec === sec)
    .map((s, i) => `${i + 1}. ${s.name} (Adm#: ${s.adm}): ${statusNames[attendanceData[date][s.adm]]}`);
  window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines.join('\n'))}`, '_blank');
};



// --- 10. ANALYTICS ---
const atg = $('analyticsTarget'),
      asel = $('analyticsSectionSelect'),
      atype = $('analyticsType'),
      adate = $('analyticsDate'),
      amonth = $('analyticsMonth'),
      sems = $('semesterStart'),
      seme = $('semesterEnd'),
      ayear = $('yearStart'),
      asearch = $('analyticsSearch'),
      loadA = $('loadAnalytics'),
      resetA = $('resetAnalytics'),
      instr = $('instructions'),
      acont = $('analyticsContainer'),
      graphs = $('graphs'),
      aacts = $('analyticsActions'),
      barCtx = $('barChart').getContext('2d'),
      pieCtx = $('pieChart').getContext('2d');
let barChart, pieChart;

const analyticsStatusNames = { P: 'Present', A: 'Absent', Lt: 'Late', HD: 'Half-Day', L: 'Leave' };
const analyticsStatusColors = {
  P: getComputedStyle(document.documentElement).getPropertyValue('--success').trim(),
  A: getComputedStyle(document.documentElement).getPropertyValue('--danger').trim(),
  Lt: getComputedStyle(document.documentElement).getPropertyValue('--warning').trim(),
  HD: '#FF9800',
  L: getComputedStyle(document.documentElement).getPropertyValue('--info').trim()
};

$('analyticsFilterBtn').onclick = () => show($('analyticsFilterModal'));

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
    case 'date': adate.classList.remove('hidden'); break;
    case 'month': amonth.classList.remove('hidden'); break;
    case 'semester': sems.classList.remove('hidden'); seme.classList.remove('hidden'); break;
    case 'year': ayear.classList.remove('hidden'); break;
  }
};

resetA.onclick = e => {
  e.preventDefault();
  atype.value = '';
  [adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
  resetA.classList.add('hidden');
};

loadA.onclick = () => {
  if (atg.value === 'student' && !asearch.value.trim()) { alert('Enter admission number or name'); return; }

  // Determine date range
  let from, to;
  if (atype.value === 'date') {
    const d = adate.value;
    from = to = d;
  } else if (atype.value === 'month') {
    const [y,m] = amonth.value.split('-');
    from = `${y}-${m}-01`;
    to = `${y}-${m}-${new Date(y, m, 0).getDate()}`;
  } else if (atype.value === 'semester') {
    from = sems.value;
    to = seme.value;
  } else if (atype.value === 'year') {
    const y = ayear.value;
    from = `${y}-01-01`;
    to = `${y}-12-31`;
  }

  const cls = $('teacherClassSelect').value, secVal = $('teacherSectionSelect').value;
  let pool = students.filter(s => s.cls === cls && s.sec === secVal);
  if (atg.value === 'section') pool = pool.filter(s => s.sec === asel.value);
  if (atg.value === 'student') {
    const q = asearch.value.trim().toLowerCase();
    pool = pool.filter(s => s.adm === q || s.name.toLowerCase().includes(q));
  }

  const stats = pool.map(s => ({ adm: s.adm, name: s.name, P: 0, A: 0, Lt: 0, HD: 0, L: 0, total: 0 }));
  Object.entries(attendanceData).forEach(([d, rec]) => {
    if (d < from || d > to) return;
    stats.forEach(st => {
      if (rec[st.adm]) { st[rec[st.adm]]++; st.total++; }
    });
  });
  stats.forEach(st => {
    const totalFine = st.A * fineRates.A + st.Lt * fineRates.Lt + st.L * fineRates.L + st.HD * fineRates.HD;
    const paid = (paymentsData[st.adm] || []).reduce((a, p) => a + p.amount, 0);
    st.outstanding = totalFine - paid;
    const pct = st.total ? (st.P / st.total) * 100 : 0;
    st.status = (st.outstanding > 0 || pct < eligibilityPct) ? 'Debarred' : 'Eligible';
  });

  lastAnalyticsStats = stats;
  lastAnalyticsRange = { from, to };
  renderAnalytics(stats, from, to);
};

function renderAnalytics(stats, from, to) {
  let filtered = analyticsFilterOptions.includes('all')
    ? stats
    : stats.filter(st => analyticsFilterOptions.includes(st.status.toLowerCase()));

  // Table
  const tbody = $('analyticsTable').querySelector('tbody');
  tbody.innerHTML = '';
  filtered.forEach((st, i) => {
    const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : '0.0';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td><td>${st.adm}</td><td>${st.name}</td>
      <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td>
      <td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td>
      <td>${pct}%</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>
    `;
    tbody.appendChild(tr);
  });

  $('instructions').textContent = `Period: ${from} to ${to}`;
  show($('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'));

  // Bar chart
  barChart?.destroy();
  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: filtered.map(st => st.name),
      datasets: [{ label: '% Present', data: filtered.map(st => st.total ? st.P / st.total * 100 : 0), backgroundColor: filtered.map(_ => analyticsStatusColors.P) }]
    },
    options: { scales: { y: { beginAtZero: true, max: 100 } } }
  });

  // Pie chart
  pieChart?.destroy();
  const totals = stats.reduce((acc, st) => {
    acc.P += st.P; acc.A += st.A; acc.Lt += st.Lt; acc.HD += st.HD; acc.L += st.L;
    return acc;
  }, { P: 0, A: 0, Lt: 0, HD: 0, L: 0 });
  pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: Object.values(analyticsStatusNames),
      datasets: [{ data: Object.keys(analyticsStatusNames).map(c => totals[c]), backgroundColor: Object.keys(analyticsStatusNames).map(code => analyticsStatusColors[code]) }]
    }
  });

  // Build WhatsApp share text
  const header = `*Analytics Report*\nPeriod: ${from} to ${to}`;
  lastAnalyticsShare = `${header}\n\n` + filtered.map((st, i) => `${i+1}. ${st.name}: ${st.P}/${st.total} Present, Outstanding PKR ${st.outstanding}, ${st.status}`).join('\n');
}


// --- 11. REGISTER TABLE & PAYMENTS MODAL BINDING ---
(() => {
  const loadBtn    = $('loadRegister'),
        changeBtn  = $('changeRegister'),
        saveBtn    = $('saveRegister'),
        downloadBtn= $('downloadRegister'),
        shareBtn   = $('shareRegister'),
        tableWrapper = $('registerTableWrapper'),
        headerRow  = $('registerHeader'),
        bodyTbody  = $('registerBody'),
        monthInput = $('registerMonth');

  function bindRegisterActions() {
    downloadBtn.onclick = async () => {
      const doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const today = new Date().toISOString().split('T')[0];
      doc.setFontSize(18); doc.text('Attendance Register', 14, 20);
      doc.setFontSize(10); doc.text(`Date: ${today}`, pageWidth - 14, 20, { align: 'right' });
      doc.setFontSize(12); doc.text($('setupText').textContent, 14, 36);
      doc.autoTable({ startY: 60, html: '#registerTable', tableWidth: 'auto', styles: { fontSize: 10 } });
      const blob = doc.output('blob');
      doc.save('attendance_register.pdf');
      await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
    };
    shareBtn.onclick = () => {
      const header = `Attendance Register\n${$('setupText').textContent}`;
      const rows = Array.from(bodyTbody.children).map(tr =>
        Array.from(tr.children).map(td => td.querySelector('.status-text')?.textContent || td.textContent).join(' ')
      );
      window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows.join('\n'))}`, '_blank');
    };
  }

  loadBtn.onclick = () => {
    const m = monthInput.value;
    if (!m) { alert('Pick month'); return; }
    const dateKeys = Object.keys(attendanceData).filter(d => d.startsWith(m + '-')).sort();
    if (!dateKeys.length) { alert('No attendance marked this month.'); return; }
    headerRow.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` + dateKeys.map(k => `<th>${k.split('-')[2]}</th>`).join('');
    bodyTbody.innerHTML = '';
    const cl = $('teacherClassSelect').value, secVal = $('teacherSectionSelect').value;
    students.filter(s => s.cls === cl && s.sec === secVal).forEach((s, i) => {
      let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      dateKeys.forEach(key => {
        const c = attendanceData[key]?.[s.adm] || '';
        const color = c === 'P' ? 'var(--success)' : c === 'Lt' ? 'var(--warning)' : c === 'HD' ? '#FF9800' : c === 'L' ? 'var(--info)' : 'var(--danger)';
        row += `<td class="reg-cell" ${c ? `style="background:${color};color:#fff"` : ''}><span class="status-text">${c}</span></td>`;
      });
      const tr = document.createElement('tr');
      tr.innerHTML = row;
      bodyTbody.appendChild(tr);
    });

    document.querySelectorAll('.reg-cell').forEach(cell => {
      cell.onclick = () => {
        const span = cell.querySelector('.status-text');
        const codes = ['', 'P', 'Lt', 'HD', 'L', 'A'];
        const idx = (codes.indexOf(span.textContent) + 1) % codes.length;
        const c = codes[idx];
        span.textContent = c;
        if (!c) {
          cell.style.background = '';
          cell.style.color = '';
        } else {
          const col = c === 'P' ? 'var(--success)' : c === 'Lt' ? 'var(--warning)' : c === 'HD' ? '#FF9800' : c === 'L' ? 'var(--info)' : 'var(--danger)';
          cell.style.background = col;
          cell.style.color = '#fff';
        }
      };
    });

    show(tableWrapper, changeBtn, downloadBtn, shareBtn, saveBtn);
    hide(loadBtn);
  };

  saveBtn.onclick = async () => {
    const m = monthInput.value;
    const dateKeys = Object.keys(attendanceData).filter(d => d.startsWith(m + '-')).sort();
    Array.from(bodyTbody.children).forEach(tr => {
      const adm = tr.children[1].textContent;
      dateKeys.forEach((key, idx) => {
        const code = tr.children[3 + idx].querySelector('.status-text').textContent;
        if (code) {
          attendanceData[key] = attendanceData[key] || {};
          attendanceData[key][adm] = code;
        } else {
          attendanceData[key] && delete attendanceData[key][adm];
        }
      });
    });
    await save('attendanceData', attendanceData);
    alert('Register saved.');
  };

  changeBtn.onclick = () => {
    hide(tableWrapper, changeBtn, downloadBtn, shareBtn, saveBtn);
    headerRow.innerHTML = '';
    bodyTbody.innerHTML = '';
    show(loadBtn);
  };

  bindRegisterActions();
})();


// --- 12. Service Worker Registration (for offline) ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(console.error);
}
