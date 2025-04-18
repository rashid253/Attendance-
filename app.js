// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const THRESHOLD = 75;
  const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'var(--orange)', L:'var(--info)' };

  // … [all of your previous setup, registration, attendance & analytics code up through share handlers] …

  // —— UPDATED: Attendance Summary “Share” ——
  $('shareAttendanceSummary').onclick = () => {
    const date = $('dateInput').value;
    const setup = [
      `Date: ${date}`,
      `School: ${localStorage.getItem('schoolName')}`,
      `Class: ${localStorage.getItem('teacherClass')}`,
      `Section: ${localStorage.getItem('teacherSection')}`,
      ''
    ].join('\n');

    // build per‑student blocks
    const blocks = [...$('summaryBody').querySelectorAll('tr')].map(tr => {
      const name = tr.children[0].textContent;
      const status = tr.children[1].textContent;
      // professional remarks:
      const remarkMap = {
        P: 'Good attendance—keep it up!',
        A: 'Please ensure regular attendance.',
        Lt: 'Remember to arrive on time.',
        HD: 'Submit permission note for half‑day.',
        L: 'Attend when possible.'
      };
      const remark = remarkMap[status] || '';
      return [
        `*Name:* ${name}`,
        `*Status:* ${status}`,
        `*Remarks:* ${remark}`,
        ''
      ].join('\n');
    }).join('\n');

    // compute class % for this single day
    const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
    [...$('summaryBody').querySelectorAll('tr')].forEach(tr => {
      const st = tr.children[1].textContent;
      stats[st] = (stats[st]||0) + 1;
    });
    const totalStudents = [...$('summaryBody').querySelectorAll('tr')].length;
    const classPct = ((stats.P + stats.Lt + stats.HD) / totalStudents) * 100;
    const classRemark = classPct >= THRESHOLD
      ? 'Overall attendance is good.'
      : 'Overall attendance needs improvement.';
    const footer = [
      `Class Average: ${classPct.toFixed(1)}%`,
      `Remarks: ${classRemark}`
    ].join('\n');

    const msg = [setup, blocks, footer].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // —— UPDATED: Analytics “Share” ——
  $('shareAnalytics').onclick = () => {
    const dates = (() => {
      // reconstruct the same buildDates() logic here
      const v = $('analyticsType').value;
      const arr = [];
      const pushRange = (s,e) => {
        let d = new Date(s);
        while (d <= e) {
          arr.push(d.toISOString().slice(0,10));
          d.setDate(d.getDate()+1);
        }
      };
      if (v === 'date') {
        const d = new Date($('analyticsDate').value);
        if (!isNaN(d)) arr.push(d.toISOString().slice(0,10));
      }
      if (v === 'month') {
        const [y,m] = $('analyticsMonth').value.split('-');
        pushRange(new Date(y,m-1,1), new Date(y,m,0));
      }
      if (v === 'semester') {
        const [ys,ms] = $('semesterStart').value.split('-');
        const [ye,me] = $('semesterEnd').value.split('-');
        pushRange(new Date(ys,ms-1,1), new Date(ye,me,0));
      }
      if (v === 'year') {
        const y = +$('yearStart').value;
        pushRange(new Date(y,0,1), new Date(y,11,31));
      }
      return arr;
    })();
    if (!dates.length) return alert('No dates selected');

    const start = dates[0], end = dates[dates.length - 1];
    const header = [
      `Date Range: ${start} to ${end}`,
      `School: ${localStorage.getItem('schoolName')}`,
      `Class: ${localStorage.getItem('teacherClass')}`,
      `Section: ${localStorage.getItem('teacherSection')}`,
      ''
    ].join('\n');

    // summaryData was populated when you clicked “Load Analytics”
    const lines = window.summaryData.map(r => {
      const remark = r.pct >= THRESHOLD
        ? 'Good attendance—keep it up!'
        : 'Attendance below threshold.';
      return [
        `*${r.name}*`,
        `P:${r.P} A:${r.A} Lt:${r.Lt} HD:${r.HD} L:${r.L}`,
        `Total Days: ${r.total}  %: ${r.pct}%`,
        `Remarks: ${remark}`,
        ''
      ].join('\n');
    }).join('\n');

    // class average
    const avg = window.summaryData.reduce((s,r) => s + r.pct, 0) / window.summaryData.length;
    const avgRemark = avg >= THRESHOLD
      ? 'Overall attendance is good.'
      : 'Overall attendance needs improvement.';
    const footer = [
      `Class Average: ${avg.toFixed(1)}%`,
      `Remarks: ${avgRemark}`
    ].join('\n');

    const msg = [header, lines, footer].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // —— ENHANCED PDF STYLING FOR DOWNLOADS ——  
  // (you can keep your existing downloadAttendanceSummary and downloadAnalytics code,
  //  but switch autoTable theme to 'grid' and bump fontSize/headerFontSize:)
  // Example:
  // doc.autoTable({
  //   html: tableEl,
  //   startY: y,
  //   theme: 'grid',
  //   headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
  //   styles: { fontSize: 10, cellPadding: 4 }
  // });

  // … [rest of your PDF download handlers unchanged] …
});
