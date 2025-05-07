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
  $('downloadRegistrationPDF').onclick = async () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text('Student List', 14, 16);
    // add current date at top right
    const today = new Date().toISOString().split('T')[0];
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(12);
    doc.text(today, pageWidth - 14, 16, { align: 'right' });
    doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 32, html: '#studentsTable' });
    const blob = doc.output('blob');
    doc.save('registration.pdf');
    await sharePdf(blob, 'registration.pdf', 'Student List');
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

  $('downloadAnalytics').onclick = async () => {
    if (!lastAnalyticsStats.length) { alert('No analytics to download. Please generate a report first.'); return; }
    if (analyticsDownloadMode === 'combined') {
      const doc = new jspdf.jsPDF();
      doc.setFontSize(18);
      doc.text('Analytics Report', 14, 16);
      doc.setFontSize(12);
      doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 24);
      doc.autoTable({ startY: 32, html: '#analyticsTable' });
      const blob = doc.output('blob');
      doc.save('analytics_report.pdf');
      await sharePdf(blob, 'analytics_report.pdf', 'Analytics Report');
    } else {
      const doc = new jspdf.jsPDF();
      doc.setFontSize(18);
      doc.text('Individual Analytics Report', 14, 16);
      doc.setFontSize(12);
      doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 24);
      lastAnalyticsStats.forEach((st, i) => {
        if (i > 0) doc.addPage();
        doc.setFontSize(14);
        doc.text(`Name: ${st.name}`, 14, 40);
        doc.text(`Adm#: ${st.adm}`, 14, 60);
        doc.text(`Present: ${st.P}`, 14, 80);
        doc.text(`Absent: ${st.A}`, 14, 100);
        doc.text(`Late: ${st.Lt}`, 14, 120);
        doc.text(`Half-Day: ${st.HD}`, 14, 140);
        doc.text(`Leave: ${st.L}`, 14, 160);
        doc.text(`Total: ${st.total}`, 14, 180);
        const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : '0.0';
        doc.text(`% Present: ${pct}%`, 14, 200);
        doc.text(`Outstanding: PKR ${st.outstanding}`, 14, 220);
        doc.text(`Status: ${st.status}`, 14, 240);
      });
      const blob = doc.output('blob');
      doc.save('individual_analytics_book.pdf');
      await sharePdf(blob, 'individual_analytics_book.pdf', 'Individual Analytics');
    }
  };

  $('shareAnalytics').onclick = () => {
    if (!lastAnalyticsShare) { alert('No analytics to share. Please generate a report first.'); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');
  };

  // --- 9. MARK ATTENDANCE ---
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

  // ... load and save attendance logic unchanged ...

  downloadAttendanceBtn.onclick = async () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report', 14, 16);
    // add date at top right
    const pageW = doc.internal.pageSize.getWidth();
    const attDate = dateInput.value;
    doc.setFontSize(12);
    doc.text(attDate, pageW - 14, 16, { align: 'right' });
    doc.setFontSize(12); doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 32, html: '#attendanceSummary table' });
    const fileName = `attendance_${dateInput.value}.pdf`;
    const blob = doc.output('blob');
    doc.save(fileName);
    await sharePdf(blob, fileName, 'Attendance Report');
  };

  // --- 11. ATTENDANCE REGISTER (with working Download & Share buttons) ---
  (function(){
    const loadBtn       = $('loadRegister'),
          saveBtn       = $('saveRegister'),
          changeBtn     = $('changeRegister'),
          downloadBtn   = $('downloadRegister'),
          shareBtn      = $('shareRegister'),
          tableWrapper  = $('registerTableWrapper'),
          headerRow     = $('registerHeader'),
          bodyTbody     = $('registerBody');

    function bindRegisterActions() {
      downloadBtn.onclick = async () => {
        const doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(18); doc.text('Attendance Register', 14, 20);
        // add current date at top right
        const today = new Date().toISOString().split('T')[0];
        const pw = doc.internal.pageSize.getWidth();
        doc.setFontSize(12);
        doc.text(today, pw - 14, 20, { align: 'right' });
        doc.setFontSize(12); doc.text($('setupText').textContent, 14, 36);
        doc.autoTable({ startY: 50, html: '#registerTable', tableWidth: 'auto', styles: { fontSize: 10 } });
        const blob = doc.output('blob');
        doc.save('attendance_register.pdf');
        await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
      };

      shareBtn.onclick = () => {
        const header = `Attendance Register\n${$('setupText').textContent}`;
        const rows = Array.from(bodyTbody.children).map(tr =>
          Array.from(tr.children)
               .map(td => td.querySelector('.status-text')?.textContent || td.textContent)
               .join(' ')
        );
        window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows.join('\n'))}`, '_blank');
      };
    }

    bindRegisterActions();
  })();

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
