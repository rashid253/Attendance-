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

  // --- Share utility: download + share PDF ---
  async function downloadAndSharePDF(doc, filename, shareTitle) {
    try {
      // Generate blob from jsPDF
      const blob = doc.output('blob');
      // Trigger download
      doc.save(filename);
      // If Web Share API available, share the file
      if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'application/pdf' })] })) {
        await navigator.share({ files: [new File([blob], filename, { type: 'application/pdf' })], title: shareTitle });
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  }

  // --- Student Registration Section ---
  $('registerForm').onsubmit = async e => {
    e.preventDefault();
    const name = $('stuName').value.trim();
    const adm  = await genAdmNo();
    students.push({ adm, name });
    await save('students', students);
    renderStudentsTable();
    $('stuName').value = '';
  };

  function renderStudentsTable() {
    const tbody = $('studentsTable').querySelector('tbody');
    tbody.innerHTML = '';
    for (const { adm, name } of students) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${adm}</td><td>${name}</td>`;
      tbody.appendChild(tr);
    }
  }
  renderStudentsTable();

  // --- Payments Section ---
  $('paymentsForm').onsubmit = async e => {
    e.preventDefault();
    const adm = $('payAdm').value;
    const amt = parseFloat($('payAmt').value);
    paymentsData[adm] = (paymentsData[adm]||0) + amt;
    await save('paymentsData', paymentsData);
    renderPayments();
    $('payAdm').value = $('payAmt').value = '';
  };

  function renderPayments() {
    const ul = $('paymentsList'); ul.innerHTML = '';
    for (const adm of Object.keys(paymentsData)) {
      const li = document.createElement('li');
      li.textContent = `#${adm}: PKR ${paymentsData[adm]}`;
      ul.appendChild(li);
    }
  }
  renderPayments();

  // --- Attendance Section ---
  $('attendanceForm').onsubmit = async e => {
    e.preventDefault();
    const date = $('dateInput').value;
    if (!attendanceData[date]) attendanceData[date] = {};
    for (const { adm } of students) {
      const val = $('att_'+adm).value;
      attendanceData[date][adm] = val;
    }
    await save('attendanceData', attendanceData);
    renderAttendanceSummary();
  };

  function renderAttendanceForm() {
    const div = $('attendanceInputs'); div.innerHTML = '';
    for (const { adm, name } of students) {
      const row = document.createElement('div');
      row.innerHTML = `<label>${adm} ${name}: <select id='att_${adm}'><option value='P'>P</option><option value='A'>A</option><option value='Lt'>Lt</option><option value='HD'>HD</option><option value='L'>L</option></select></label>`;
      div.appendChild(row);
    }
  }
  renderAttendanceForm();

  function renderAttendanceSummary() {
    const table = $('attendanceSummary').querySelector('table');
    table.innerHTML = '<tr><th>Date</th><th>Present</th><th>Absent</th></tr>';
    for (const date of Object.keys(attendanceData)) {
      const recs = Object.values(attendanceData[date]);
      const P = recs.filter(v=>v==='P').length;
      const A = recs.filter(v=>v==='A').length;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${date}</td><td>${P}</td><td>${A}</td>`;
      table.appendChild(tr);
    }
  }
  renderAttendanceSummary();

  // --- Analytics Section ---
  $('analyticsGo').onclick = () => {
    const from = $('analyticsFrom').value;
    const to   = $('analyticsTo').value;
    lastAnalyticsRange = { from, to };
    const stats = [];
    for (const { adm, name } of students) {
      let P=0,A=0,Lt=0,HD=0,L=0;
      for (const date in attendanceData) {
        if (date<from||date>to) continue;
        const v=attendanceData[date][adm];
        if (v==='P') P++;
        if (v==='A') A++;
        if (v==='Lt') Lt++;
        if (v==='HD') HD++;
        if (v==='L') L++;
      }
      const total=P+A+Lt+HD+L;
      const paid = paymentsData[adm]||0;
      const outstanding = Math.max(0, total*fineRates.A - paid);
      const status = (P/total*100>=eligibilityPct && outstanding===0) ? 'Eligible' : (outstanding>0 ? 'Debarred' : 'At Risk');
      stats.push({ adm,name,P,A,Lt,HD,L,total,outstanding,status });
    }
    lastAnalyticsStats = stats;
    renderAnalyticsTable(stats);
  };

  function renderAnalyticsTable(stats) {
    const tbody = $('analyticsTable').querySelector('tbody');
    tbody.innerHTML = '';
    for (const st of stats) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${st.adm}</td><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${(st.P/st.total*100).toFixed(1)+'%'}</td><td>${st.outstanding}</td><td>${st.status}</td>`;
      tbody.appendChild(tr);
    }
  }

  // --- Download & Share Sections ---
  $('downloadRegistrationPDF').onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Student List',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#studentsTable' });
    downloadAndSharePDF(doc, 'registration.pdf', 'Student Registration List');
  };

  $('downloadAttendancePDF').onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#attendanceSummary table' });
    const filename = `attendance_${$('dateInput').value}.pdf`;
    downloadAndSharePDF(doc, filename, 'Attendance Report');
  };

  $('downloadAnalytics').onclick = async () => {
    const filtered = lastAnalyticsStats.filter(st => {
      if (analyticsFilterOptions.includes('all')) return true;
      return analyticsFilterOptions.some(opt => {
        switch(opt) {
          case 'registered': return true;
          case 'attendance':  return st.total>0;
          case 'fine':        return (st.A>0||st.Lt>0||st.L>0||st.HD>0);
          case 'cleared':     return st.outstanding===0;
          case 'debarred':    return st.status==='Debarred';
          case 'eligible':    return st.status==='Eligible';
          default:            return false;
        }
      });
    });
    if (analyticsDownloadMode==='combined') {
      const doc = new jspdf.jsPDF();
      doc.setFontSize(18); doc.text('Analytics Report',14,16);
      doc.setFontSize(12); doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`,14,24);
      const body = filtered.map((st,i) => [
        i+1, st.adm, st.name, st.P, st.A, st.Lt, st.HD, st.L,
        st.total, `${((st.P/st.total)*100).toFixed(1)}%`,
        `PKR ${st.outstanding}`, st.status
      ]);
      doc.autoTable({ startY:32, head:[['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']], body, styles:{ fontSize:10 } });
      downloadAndSharePDF(doc, 'analytics_report.pdf', 'Analytics Report');
    } else {
      for (const st of filtered) {
        const doc = new jspdf.jsPDF();
        doc.setFontSize(16); doc.text(`Report for ${st.name} (${st.adm})`,14,16);
        doc.setFontSize(12);
        const rows = [
          ['Present',st.P],['Absent',st.A],['Late',st.Lt],
          ['Half-Day',st.HD],['Leave',st.L],['Total',st.total],
          ['% Present',`${((st.P/st.total)*100).toFixed(1)}%`],
          ['Outstanding',`PKR ${st.outstanding}`],['Status',st.status]
        ];
        doc.autoTable({ startY:24, head:[['Metric','Value']], body:rows, styles:{ fontSize:10 } });
        downloadAndSharePDF(doc, `report_${st.adm}.pdf`, `Report for ${st.name}`);
      }
    }
  };

  $('downloadRegister').onclick = () => {
    const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    doc.setFontSize(18); doc.text('Attendance Register',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#registerTable', tableWidth:'auto', styles:{ fontSize:10 } });
    downloadAndSharePDF(doc, 'attendance_register.pdf', 'Attendance Register');
  };

  // --- Service Worker Registration (unchanged) ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(reg => console.log('SW registered', reg));
    });
  }
});
