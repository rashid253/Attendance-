$('downloadAnalytics').onclick = async () => {
  if (!lastAnalyticsStats.length) {
    alert('No analytics to download. Please generate a report first.');
    return;
  }

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
