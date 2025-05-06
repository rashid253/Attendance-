$('downloadAnalytics').onclick = async () => {
  if (!lastAnalyticsStats.length) {
    alert('No analytics to download. Please generate a report first.');
    return;
  }

  // **Always read the radio directly** instead of relying
  // on analyticsDownloadMode being in sync.
  const mode = document.querySelector(
    '#analyticsFilterForm input[name="downloadMode"]:checked'
  ).value;

  const doc = new jspdf.jsPDF();

  if (mode === 'combined') {
    doc.setFontSize(18);
    doc.text('Analytics Report', 14, 16);
    doc.setFontSize(12);
    doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 24);
    doc.autoTable({ startY: 32, html: '#analyticsTable' });

  } else /* individual */ {
    lastAnalyticsStats.forEach((stat, i) => {
      if (i > 0) doc.addPage();
      doc.setFontSize(18);
      doc.text(`Analytics: ${stat.name} (Adm#: ${stat.adm})`, 14, 16);
      doc.setFontSize(12);
      doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 24);
      doc.autoTable({
        startY: 32,
        head: [['P','A','Lt','HD','L','Total','%','Outstanding','Status']],
        body: [[
          stat.P,
          stat.A,
          stat.Lt,
          stat.HD,
          stat.L,
          stat.total,
          stat.total ? ((stat.P/stat.total)*100).toFixed(1) + '%' : '0.0%',
          `PKR ${stat.outstanding}`,
          stat.status
        ]]
      });
    });
  }

  const fileName = mode === 'combined'
    ? 'analytics_report.pdf'
    : `analytics_reports_${lastAnalyticsRange.from}_to_${lastAnalyticsRange.to}.pdf`;

  const blob = doc.output('blob');
  doc.save(fileName);
  await sharePdf(blob, fileName, 'Analytics Report');
};
