// app (13).js

window.addEventListener('DOMContentLoaded', async () => {
  // --- Universal PDF share helper (must come first) ---
  async function sharePdf(blob, fileName, title) {
    if (
      navigator.canShare &&
      navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })
    ) {
      try {
        await navigator.share({
          title,
          files: [new File([blob], fileName, { type: 'application/pdf' })],
        });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share failed', err);
      }
    }
  }

  // Utility to get element by ID
  const $ = id => document.getElementById(id);

  // Application state
  let students = [];             // loaded elsewhere
  let attendanceData = {};       // loaded elsewhere
  let paymentsData = {};         // loaded elsewhere
  let fineRates = {};            // loaded elsewhere
  let eligibilityPct = 0;        // loaded elsewhere
  let lastAnalyticsStats = [];   // set by analytics generator
  let lastAnalyticsRange = {};   // set by analytics generator
  let analyticsFilterOptions = ['all'];  // user‐selected filters
  let analyticsDownloadMode = 'combined'; // or 'individual'

  // --- Student Registration Download ---
  $('downloadRegistration').onclick = async () => {
    if (!students.length) {
      alert('No students to download. Please load student list first.');
      return;
    }
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 32, html: '#studentsTable' });
    const blob = doc.output('blob');
    doc.save('registration.pdf');
    await sharePdf(blob, 'registration.pdf', 'Student List');
  };

  // --- Share via WhatsApp ---
  $('shareRegistration').onclick = () => {
    const cl = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students
      .filter(s => s.cls === cl && s.sec === sec)
      .map(s => {
        const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
        Object.values(attendanceData).forEach(rec => {
          if (rec[s.adm]) stats[rec[s.adm]]++;
        });
        const totalMarked = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
        const totalFine = stats.A * fineRates.A +
                          stats.Lt * fineRates.Lt +
                          stats.L * fineRates.L +
                          stats.HD * fineRates.HD;
        const paid = (paymentsData[s.adm] || []).reduce((a, p) => a + p.amount, 0);
        return [
          `#${s.adm} ${s.name}`,
          `Present: ${stats.P}`,
          `Absent: ${stats.A}`,
          `Late: ${stats.Lt}`,
          `Half‑Day: ${stats.HD}`,
          `Leave: ${stats.L}`,
          `Total: ${totalMarked}`,
          `Fine: PKR ${totalFine}`,
          `Paid: PKR ${paid}`,
          `Outstanding: PKR ${totalFine - paid}`
        ].join(' | ');
      })
      .join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // --- Settings Save Handler ---
  $('saveSettings').onclick = async () => {
    fineRates = {
      A : Number($('fineAbsent').value)    || 0,
      Lt: Number($('fineLate').value)      || 0,
      L : Number($('fineLeave').value)     || 0,
      HD: Number($('fineHalfDay').value)   || 0,
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
  };

  // --- Download Analytics (combined or individual) ---
  $('downloadAnalytics').onclick = async () => {
    if (!lastAnalyticsStats.length) { 
      alert('No analytics to download. Please generate a report first.'); 
      return; 
    }
    const doc = new jspdf.jsPDF();
    // Determine filtered stats based on analyticsFilterOptions
    let filteredStats = lastAnalyticsStats;
    if (!analyticsFilterOptions.includes('all')) {
      filteredStats = lastAnalyticsStats.filter(st =>
        analyticsFilterOptions.some(opt => {
          switch (opt) {
            case 'registered': return true;
            case 'attendance': return st.total > 0;
            case 'fine':       return st.A > 0 || st.Lt > 0 || st.L > 0 || st.HD > 0;
            case 'cleared':    return st.outstanding === 0;
            case 'debarred':   return st.status === 'Debarred';
            case 'eligible':   return st.status === 'Eligible';
            default: return false;
          }
        })
      );
    }

    if (analyticsDownloadMode === 'combined') {
      // Combined report
      doc.setFontSize(18);
      doc.text('Analytics Report', 14, 16);
      doc.setFontSize(12);
      doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 24);
      doc.autoTable({ startY: 32, html: '#analyticsTable' });
      const blob = doc.output('blob');
      doc.save('analytics_report.pdf');
      await sharePdf(blob, 'analytics_report.pdf', 'Analytics Report');
    } else {
      // Individual reports in one PDF
      const headers = ['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status'];
      filteredStats.forEach((st, idx) => {
        if (idx > 0) doc.addPage();
        doc.setFontSize(18);
        doc.text(`Analytics Report - ${st.name}`, 14, 16);
        doc.setFontSize(12);
        const percent = st.total ? ((st.P/st.total) * 100).toFixed(1) + '%' : '0%';
        const row = [
          idx + 1,
          st.adm,
          st.name,
          st.P,
          st.A,
          st.Lt,
          st.HD,
          st.L,
          st.total,
          percent,
          `PKR ${st.outstanding}`,
          st.status
        ];
        doc.autoTable({ startY: 24, head: [headers], body: [row] });
      });
      const blob = doc.output('blob');
      doc.save('analytics_individual_reports.pdf');
      await sharePdf(blob, 'analytics_individual_reports.pdf', 'Individual Analytics Reports');
    }
  };

  // --- WhatsApp share for analytics ---
  $('shareAnalytics').onclick = () => {
    if (!lastAnalyticsShare) { 
      alert('No analytics to share. Please generate a report first.'); 
      return; 
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');
  };

  // --- Download Attendance Register ---
  $('downloadRegister').onclick = async () => {
    const doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(18);
    doc.text('Attendance Register', 40, 40);
    doc.autoTable({ startY: 60, html: '#registerTable' });
    const blob = doc.output('blob');
    doc.save('attendance_register.pdf');
    await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
  };

  // --- Remaining application initialization & UI binding ---
  const formDiv   = $('settingsForm');
  const inputs    = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct']
                    .map(id => $(id));
  const settingsCard = document.createElement('div');
  const editSettings = document.createElement('button');
  settingsCard.id    = 'settingsCard';
  settingsCard.className = 'card hidden';
  editSettings.id    = 'editSettings';
  editSettings.className = 'btn no-print hidden';
  editSettings.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editSettings);

  // Load persisted settings into form
  fineRates = await load('fineRates') || { A:0, Lt:0, L:0, HD:0 };
  eligibilityPct = await load('eligibilityPct') || 0;
  $('fineAbsent').value    = fineRates.A;
  $('fineLate').value      = fineRates.Lt;
  $('fineLeave').value     = fineRates.L;
  $('fineHalfDay').value   = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  // Show settings card if needed
  editSettings.onclick = () => {
    show(formDiv, $('saveSettings'), ...inputs);
    hide(settingsCard, editSettings);
  };

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
