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

  // Utility to grab common header info
  function getPdfHeaderInfo() {
    const now = new Date();
    return {
      dateStr: now.toLocaleDateString(),
      timeStr: now.toLocaleTimeString(),
      setupText: $('setupText').textContent
    };
  }

  // --- DOWNLOAD & SHARE HANDLERS ---
  $('downloadRegistrationPDF').onclick = async () => {
    const start = performance.now();
    const { dateStr, timeStr, setupText } = getPdfHeaderInfo();
    const doc = new jspdf.jsPDF();
    doc.setFontSize(14);
    doc.text(`Date: ${dateStr} ${timeStr}`, 14, 16);
    doc.text(setupText, 14, 26);
    doc.text('Title: Student Registration List', 14, 36);
    doc.setFontSize(12);
    doc.autoTable({ startY: 46, html: '#studentsTable' });
    const duration = ((performance.now() - start) / 1000).toFixed(2) + 's';
    doc.text(`Generated in: ${duration}`, 14, doc.lastAutoTable.finalY + 10);
    const blob = doc.output('blob');
    doc.save('registration.pdf');
    await sharePdf(blob, 'registration.pdf', 'Student Registration List');
  };

  $('shareRegistration').onclick = () => { /* unchanged */ };

  $('downloadAttendancePDF').onclick = async () => {
    const start = performance.now();
    const { dateStr, timeStr, setupText } = getPdfHeaderInfo();
    const date = $('dateInput').value;
    const doc = new jspdf.jsPDF();
    doc.setFontSize(14);
    doc.text(`Date: ${date} (${dateStr} ${timeStr})`, 14, 16);
    doc.text(setupText, 14, 26);
    doc.text('Title: Attendance Report', 14, 36);
    doc.setFontSize(12);
    doc.autoTable({ startY: 46, html: '#attendanceSummary table' });
    const duration = ((performance.now() - start) / 1000).toFixed(2) + 's';
    doc.text(`Generated in: ${duration}`, 14, doc.lastAutoTable.finalY + 10);
    const fileName = `attendance_${date}.pdf`;
    const blob = doc.output('blob');
    doc.save(fileName);
    await sharePdf(blob, fileName, 'Attendance Report');
  };

  $('shareAttendanceSummary').onclick = () => { /* unchanged */ };

  $('downloadAnalytics').onclick = async () => {
    if (!lastAnalyticsStats.length) { alert('No analytics to download.'); return; }
    const start = performance.now();
    const { dateStr, timeStr, setupText } = getPdfHeaderInfo();
    const { from, to } = lastAnalyticsRange;
    const doc = new jspdf.jsPDF();
    doc.setFontSize(14);
    doc.text(`Date: ${dateStr} ${timeStr}`, 14, 16);
    doc.text(setupText, 14, 26);
    doc.text(`Title: Analytics Report (${from} to ${to})`, 14, 36);
    doc.setFontSize(12);
    doc.autoTable({ startY: 46, html: '#analyticsTable' });
    const duration = ((performance.now() - start) / 1000).toFixed(2) + 's';
    doc.text(`Generated in: ${duration}`, 14, doc.lastAutoTable.finalY + 10);
    doc.save('analytics_report.pdf');
    await sharePdf(doc.output('blob'), 'analytics_report.pdf', 'Analytics Report');
  };

  // Individual analytics routine similarly updated (omitted for brevity)

  // --- 11. ATTENDANCE REGISTER Download Handler ---
  (function(){
    const downloadBtn = $('downloadRegister');
    function bindRegisterActions() {
      downloadBtn.onclick = async () => {
        const start = performance.now();
        const { dateStr, timeStr, setupText } = getPdfHeaderInfo();
        const doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(14);
        doc.text(`Date: ${dateStr} ${timeStr}`, 14, 20);
        doc.text(setupText, 14, 30);
        doc.text('Title: Attendance Register', 14, 40);
        doc.autoTable({ startY: 50, html: '#registerTable', tableWidth: 'auto', styles: { fontSize: 10 } });
        const duration = ((performance.now() - start) / 1000).toFixed(2) + 's';
        doc.text(`Generated in: ${duration}`, 14, doc.lastAutoTable.finalY + 10);
        const blob = doc.output('blob');
        doc.save('attendance_register.pdf');
        await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
      };
    }
    bindRegisterActions();
  })();

  // --- 12. Service Worker (unchanged) ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
