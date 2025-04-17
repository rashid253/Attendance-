// app.js
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // Refs
  const analyticsType     = $('analyticsType');
  const analyticsDateIn   = $('analyticsDate');
  const analyticsMonthIn  = $('analyticsMonth');
  const analyticsSemester = $('analyticsSemester');
  const analyticsYearIn   = $('analyticsYear');
  const studentFilter     = $('studentFilter');
  const repType           = $('representationType');
  const loadBtn           = $('loadAnalytics');
  const resetBtn          = $('resetAnalyticsBtn');
  const container         = $('analyticsContainer');
  const actions           = $('analyticsActions');
  const shareBtn          = $('shareAnalytics');
  const downloadBtn       = $('downloadAnalytics');

  const THRESHOLD = 75; // exam eligibility % cut-off

  let schoolName = localStorage.getItem('schoolName') || '';
  let cls        = localStorage.getItem('teacherClass') || '';
  let sec        = localStorage.getItem('teacherSection') || '';
  let students   = JSON.parse(localStorage.getItem('students')) || [];
  let attendance = JSON.parse(localStorage.getItem('attendanceData')) || {};
  let chart;

  // Toggle inputs based on period
  analyticsType.addEventListener('change', () => {
    [analyticsDateIn, analyticsMonthIn, analyticsSemester, analyticsYearIn].forEach(el => el.classList.add('hidden'));
    const v = analyticsType.value;
    if (v==='date')     analyticsDateIn.classList.remove('hidden');
    if (v==='month')    analyticsMonthIn.classList.remove('hidden');
    if (v==='semester') analyticsSemester.classList.remove('hidden');
    if (v==='year')     analyticsYearIn.classList.remove('hidden');
  });

  loadBtn.addEventListener('click', renderAnalytics);
  resetBtn.addEventListener('click', () => {
    [analyticsType, analyticsDateIn, analyticsMonthIn, analyticsSemester, analyticsYearIn, studentFilter, repType, loadBtn]
      .forEach(el => { el.disabled = false; el.classList.remove('hidden'); });
    resetBtn.classList.add('hidden');
    actions.classList.add('hidden');
    container.innerHTML = '';
  });

  function getBlocks(type) {
    const yearNow = new Date().getFullYear();
    const blocks = [];
    if (type==='date') {
      const d = analyticsDateIn.value;
      if (d) blocks.push({ label: `Date: ${d}`, dates: [d] });
    }
    if (type==='month') {
      const [y,m] = analyticsMonthIn.value.split('-');
      const days = new Date(y,m,0).getDate();
      const dates = Array.from({length:days},(_,i)=>`${y}-${m}-${String(i+1).padStart(2,'0')}`);
      blocks.push({ label: `Month: ${y}-${m}`, dates });
    }
    if (type==='semester') {
      const sem = analyticsSemester.value;
      const start = sem==='1'?1:7, end = sem==='1'?6:12;
      for (let mo=start; mo<=end; mo++) {
        const mm = String(mo).padStart(2,'0');
        const days = new Date(yearNow,mo,0).getDate();
        const dates = Array.from({length:days},(_,i)=>`${yearNow}-${mm}-${String(i+1).padStart(2,'0')}`);
        blocks.push({ label: `Sem ${sem}: Month ${mm}`, dates });
      }
    }
    if (type==='year') {
      const y = analyticsYearIn.value;
      for (let mo=1; mo<=12; mo++) {
        const mm = String(mo).padStart(2,'0');
        const days = new Date(y,mo,0).getDate();
        const dates = Array.from({length:days},(_,i)=>`${y}-${mm}-${String(i+1).padStart(2,'0')}`);
        blocks.push({ label: `Year ${y}: Month ${mm}`, dates });
      }
    }
    return blocks;
  }

  function renderAnalytics() {
    const type = analyticsType.value;
    if (!type) return alert('Please select a period');

    [analyticsType, analyticsDateIn, analyticsMonthIn, analyticsSemester, analyticsYearIn, studentFilter, repType, loadBtn]
      .forEach(el => el.disabled = true);
    resetBtn.classList.remove('hidden');
    actions.classList.remove('hidden');
    container.innerHTML = '';

    const blocks = getBlocks(type);
    if (!blocks.length) return alert('Invalid period selection');

    const roster = students.filter(s => s.class===cls && s.section===sec)
                           .filter(s => !studentFilter.value || s.roll==studentFilter.value);

    // Prepare overall summary counts
    const overall = roster.map(s => ({
      name: s.name,
      cnt: { P:0, A:0, Lt:0, HD:0, L:0 }
    }));

    // Legend
    const legend = document.createElement('p');
    legend.textContent = 'Legend: P=Present, Lt=Late, HD=Half Day, L=Leave, A=Absent';
    container.appendChild(legend);

    // Render each block
    blocks.forEach((blk, bi) => {
      const heading = document.createElement('h3');
      heading.textContent = blk.label;
      container.appendChild(heading);

      // Table view
      if (repType.value==='table' || repType.value==='all') {
        const tbl = document.createElement('table');
        tbl.border = 1; tbl.style.width = '100%';
        const hdr = ['Roll','Name', ...blk.dates.map(d=>d.split('-')[2])];
        tbl.innerHTML = `<tr>${hdr.map(h=>`<th>${h}</th>`).join('')}</tr>`;
        roster.forEach((s, i) => {
          const row = [s.roll, s.name, ...blk.dates.map(d => {
            const st = attendance[d]?.[s.roll] || '';
            if (st) overall[i].cnt[st]++;
            return st;
          })];
          tbl.innerHTML += `<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`;
        });
        container.appendChild(tbl);
      }

      // Summary for this block
      if (repType.value==='summary' || repType.value==='all') {
        const sumDiv = document.createElement('div');
        sumDiv.className = 'summary-block';
        sumDiv.innerHTML = `<h4>Summary for ${blk.label}</h4>` +
          roster.map((s, i) => {
            const cnt = blk.dates.reduce((a, d) => {
              const st = attendance[d]?.[s.roll];
              if (st) a[st] = (a[st]||0)+1;
              return a;
            }, {P:0,A:0,Lt:0,HD:0,L:0});
            const pct = Math.round((cnt.P+cnt.Lt+cnt.HD)/blk.dates.length*100);
            const elig = pct>=THRESHOLD ? 'Eligible' : 'Not Eligible';
            return `<p>${s.name}: P:${cnt.P}, Lt:${cnt.Lt}, HD:${cnt.HD}, L:${cnt.L}, A:${cnt.A} — ${pct}%` +
                   `<span class="eligibility">${elig}</span></p>`;
          }).join('');
        container.appendChild(sumDiv);
      }

      // Graph for this block
      if (repType.value==='graph' || repType.value==='all') {
        const cvs = document.createElement('canvas');
        container.appendChild(cvs);
        if (chart) chart.destroy();
        const data = roster.map((s, i) => {
          const cnt = blk.dates.reduce((a, d) => {
            const st = attendance[d]?.[s.roll];
            if (st) a[st] = (a[st]||0)+1;
            return a;
          }, {P:0, Lt:0, HD:0});
          return Math.round((cnt.P+cnt.Lt+cnt.HD)/blk.dates.length*100);
        });
        chart = new Chart(cvs.getContext('2d'), {
          type: 'bar',
          data: { labels: roster.map(s=>s.name), datasets: [{ label: '% Present', data }] },
          options: { responsive: true }
        });
      }
    });

    // Overall summary
    const totalDays = blocks.reduce((sum, b) => sum + b.dates.length, 0);
    const ovDiv = document.createElement('div');
    ovDiv.className = 'summary-block';
    ovDiv.innerHTML = '<h3>Overall Summary & Exam Eligibility</h3>' +
      overall.map(o => {
        const pct = Math.round((o.cnt.P+o.cnt.Lt+o.cnt.HD)/totalDays*100);
        const eligText = pct>=THRESHOLD
          ? '⚑ Eligible for Exams'
          : '✗ Not Eligible for Exams';
        return `<p>${o.name}: P:${o.cnt.P}, Lt:${o.cnt.Lt}, HD:${o.cnt.HD}, L:${o.cnt.L}, A:${o.cnt.A} — ${pct}% ` +
               `<span class="eligibility">${eligText}</span></p>`;
      }).join('');
    container.appendChild(ovDiv);

    // Share Summary only
    shareBtn.onclick = () => {
      let text = `${schoolName} | Class-Section: ${cls}-${sec}\n`;
      text += blocks.map(b=>b.label).join(' | ') + '\n\n';
      text += ovDiv.innerText;
      if (navigator.share) navigator.share({ title: 'Attendance Summary', text });
      else alert('Share not supported');
    };

    // Download full report
    downloadBtn.onclick = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p','pt','a4');
      let y = 20;
      doc.setFontSize(12);
      doc.text(`${schoolName} | Class-Section: ${cls}-${sec}`, 20, y); y += 20;
      blocks.forEach(b => {
        doc.text(b.label, 20, y); y += 15;
        if (repType.value==='table' || repType.value==='all') {
          const tbl = container.querySelector('table');
          doc.autoTable({ html: tbl, startY: y, margin:{left:20,right:20} });
          y = doc.lastAutoTable.finalY + 10;
        }
        if (repType.value==='summary' || repType.value==='all') {
          const sums = Array.from(container.querySelectorAll('.summary-block:nth-of-type(' + (blocks.length+1) + ') p'));
          sums.forEach(p => { doc.text(p.innerText, 20, y); y += 12; });
          y += 5;
        }
      });
      // overall
      doc.text('Overall Summary & Exam Eligibility', 20, y); y += 15;
      ovDiv.querySelectorAll('p').forEach(p => {
        doc.text(p.innerText, 20, y); y += 12;
      });
      doc.save(`Attendance_Report_${type}.pdf`);
    };
  }
});
