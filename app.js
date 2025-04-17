// app.js
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // Refs
  const analyticsType     = $('analyticsType');
  const analyticsDateIn   = $('analyticsDate');
  const analyticsMonthIn  = $('analyticsMonth');
  const studentFilter     = $('studentFilter');
  const repType           = $('representationType');
  const loadAnalyticsBtn  = $('loadAnalytics');
  const resetAnalyticsBtn = $('resetAnalyticsBtn');
  const analyticsCont     = $('analyticsContainer');

  // state (assuming these have been initialized elsewhere)
  let schoolName = localStorage.getItem('schoolName')     || '';
  let cls        = localStorage.getItem('teacherClass')   || '';
  let sec        = localStorage.getItem('teacherSection') || '';
  let students   = JSON.parse(localStorage.getItem('students'))       || [];
  let attendance = JSON.parse(localStorage.getItem('attendanceData')) || {};
  let analyticsChart = null;

  analyticsType.addEventListener('change', e => {
    analyticsDateIn.classList.toggle('hidden', e.target.value !== 'date');
    analyticsMonthIn.classList.toggle('hidden', e.target.value !== 'month');
  });

  loadAnalyticsBtn.addEventListener('click', renderAnalytics);
  resetAnalyticsBtn.addEventListener('click', () => {
    [analyticsType, analyticsDateIn, analyticsMonthIn, studentFilter, repType, loadAnalyticsBtn]
      .forEach(el => el.disabled = false);
    resetAnalyticsBtn.classList.add('hidden');
    analyticsCont.innerHTML = '';
  });

  function renderAnalytics() {
    const type   = analyticsType.value;
    const period = (type === 'date' ? analyticsDateIn.value : analyticsMonthIn.value);
    if (!period) return alert('Please select a period');

    // disable controls
    [analyticsType, analyticsDateIn, analyticsMonthIn, studentFilter, repType, loadAnalyticsBtn]
      .forEach(el => el.disabled = true);
    resetAnalyticsBtn.classList.remove('hidden');
    analyticsCont.innerHTML = '';

    // build date list
    let dates = [];
    const year = new Date().getFullYear();
    if (type === 'date') {
      dates = [period];
    } else if (type === 'month') {
      const [y,m] = period.split('-');
      const days = new Date(y, m, 0).getDate();
      for (let d = 1; d <= days; d++) {
        dates.push(`${y}-${m}-${String(d).padStart(2,'0')}`);
      }
    } else if (type === 'semester') {
      for (let mo = 1; mo <= 6; mo++) {
        const mm = String(mo).padStart(2,'0');
        const days = new Date(year, mo, 0).getDate();
        for (let d = 1; d <= days; d++) {
          dates.push(`${year}-${mm}-${String(d).padStart(2,'0')}`);
        }
      }
    } else if (type === 'sixmonths') {
      for (let mo = 7; mo <= 12; mo++) {
        const mm = String(mo).padStart(2,'0');
        const days = new Date(year, mo, 0).getDate();
        for (let d = 1; d <= days; d++) {
          dates.push(`${year}-${mm}-${String(d).padStart(2,'0')}`);
        }
      }
    } else if (type === 'year') {
      for (let mo = 1; mo <= 12; mo++) {
        const mm = String(mo).padStart(2,'0');
        const days = new Date(period, mo, 0).getDate();
        for (let d = 1; d <= days; d++) {
          dates.push(`${period}-${mm}-${String(d).padStart(2,'0')}`);
        }
      }
    }

    // gather data
    const selRoll = studentFilter.value;
    const data = students
      .filter(s => s.class === cls && s.section === sec)
      .filter(s => !selRoll || s.roll == selRoll)
      .map(s => {
        const cnt = { P:0, A:0, Lt:0, L:0, HD:0 };
        dates.forEach(d => {
          const st = attendance[d]?.[s.roll];
          if (st) cnt[st]++;
        });
        const total = dates.length;
        const pct = Math.round((cnt.P + cnt.Lt + cnt.HD)/total*100);
        return { name: s.name, cnt, pct };
      });

    // render table
    if (repType.value === 'table' || repType.value === 'all') {
      const tbl = document.createElement('table');
      tbl.border = 1; tbl.style.width = '100%';

      if (type === 'date') {
        tbl.innerHTML = `<tr><th>Name</th><th>Status</th></tr>` +
          data.map(r => `<tr><td>${r.name}</td><td>${
            Object.entries(r.cnt).find(([k,v])=>v>0)?.[0] || 'Not marked'
          }</td></tr>`).join('');
      } else {
        tbl.innerHTML = `<tr><th>Name</th><th>Present</th><th>Late</th><th>Half Day</th><th>Leave</th><th>Absent</th><th>%</th></tr>` +
          data.map(r => `<tr><td>${r.name}</td><td>${r.cnt.P}</td><td>${r.cnt.Lt}</td><td>${r.cnt.HD}</td><td>${r.cnt.L}</td><td>${r.cnt.A}</td><td>${r.pct}%</td></tr>`).join('');
      }

      const wrap = document.createElement('div');
      wrap.className = 'table-container';
      wrap.append(tbl);
      analyticsCont.append(wrap);
    }

    // render summary
    if (repType.value === 'summary' || repType.value === 'all') {
      data.forEach(r => {
        const p = document.createElement('p');
        if (type === 'date') {
          const status = Object.entries(r.cnt).find(([k,v])=>v>0)?.[0] || 'Not marked';
          p.textContent = `${r.name}: ${status}`;
        } else {
          p.textContent = `${r.name}: P:${r.cnt.P}, Lt:${r.cnt.Lt}, HD:${r.cnt.HD}, L:${r.cnt.L}, A:${r.cnt.A} — ${r.pct}%`;
        }
        analyticsCont.append(p);
      });
    }

    // render graph
    if (repType.value === 'graph' || repType.value === 'all') {
      const canvas = document.createElement('canvas');
      analyticsCont.append(canvas);
      if (analyticsChart) analyticsChart.destroy();
      analyticsChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: data.map(r => r.name),
          datasets: [{ label: '% Present', data: data.map(r => r.pct) }]
        },
        options: { responsive: true }
      });
      const btn = document.createElement('button');
      btn.className = 'small'; btn.textContent = 'Download Graph';
      btn.onclick = () => {
        const url = analyticsChart.toBase64Image();
        const a = document.createElement('a');
        a.href = url; a.download = `Chart_${period}.png`;
        a.click();
      };
      analyticsCont.append(btn);
    }

    // share
    const shareBtn = document.createElement('button');
    shareBtn.className = 'small';
    shareBtn.textContent = 'Share';
    shareBtn.onclick = () => {
      let text = `📊 ${schoolName}\nClass‑Section: ${cls}-${sec}\nPeriod: ${type} ${period}\n\n`;

      if (repType.value === 'table' || repType.value === 'all') {
        if (type === 'date') {
          text += 'Name | Status\n';
          data.forEach(r => {
            const status = Object.entries(r.cnt).find(([k,v])=>v>0)?.[0] || 'Not marked';
            text += `${r.name} | ${status}\n`;
          });
        } else {
          text += 'Name | P | Lt | HD | L | A | %\n';
          data.forEach(r => {
            text += `${r.name} | ${r.cnt.P} | ${r.cnt.Lt} | ${r.cnt.HD} | ${r.cnt.L} | ${r.cnt.A} | ${r.pct}%\n`;
          });
        }
        text += '\n';
      }

      if (repType.value === 'summary' || repType.value === 'all') {
        text += 'Summary:\n';
        data.forEach(r => {
          if (type === 'date') {
            const status = Object.entries(r.cnt).find(([k,v])=>v>0)?.[0] || 'Not marked';
            text += `${r.name}: ${status}\n`;
          } else {
            text += `${r.name}: P:${r.cnt.P}, Lt:${r.cnt.Lt}, HD:${r.cnt.HD}, L:${r.cnt.L}, A:${r.cnt.A}, %:${r.pct}%\n`;
          }
        });
        text += '\n';
      }

      if (repType.value === 'graph' || repType.value === 'all') {
        text += 'Percent Present (Graph Data):\n';
        data.forEach(r => text += `${r.name}: ${r.pct}%\n`);
      }

      if (navigator.share) {
        navigator.share({ title: `Analytics: ${period}`, text });
      } else {
        alert('Share not supported on this device.');
      }
    };
    analyticsCont.appendChild(shareBtn);

    // download
    const dlBtn = document.createElement('button');
    dlBtn.className = 'small';
    dlBtn.textContent = 'Download';
    dlBtn.onclick = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF(
        repType.value === 'table' && type === 'month' ? 'l' : 'p',
        'pt', 'a4'
      );
      doc.text(schoolName, 20, 20);
      doc.text(`Class‑Section: ${cls}-${sec}`, 20, 40);
      doc.text(`Period: ${type} ${period}`, 20, 60);

      if (repType.value === 'table') {
        const head = type === 'date'
          ? ['Name','Status']
          : ['Name','P','Lt','HD','L','A','%'];
        const rows = data.map(r => (
          type === 'date'
            ? [r.name, Object.entries(r.cnt).find(([k,v])=>v>0)?.[0] || 'Not marked']
            : [r.name, r.cnt.P, r.cnt.Lt, r.cnt.HD, r.cnt.L, r.cnt.A, `${r.pct}%`]
        ));
        doc.autoTable({ head: [head], body: rows, startY: 80 });
      } else if (repType.value === 'summary') {
        const head = type === 'date'
          ? ['Name','Status']
          : ['Name','P','Lt','HD','L','A','%'];
        const rows = data.map(r => (
          type === 'date'
            ? [r.name, Object.entries(r.cnt).find(([k,v])=>v>0)?.[0] || 'Not marked']
            : [r.name, `P:${r.cnt.P}`, `Lt:${r.cnt.Lt}`, `HD:${r.cnt.HD}`, `L:${r.cnt.L}`, `A:${r.cnt.A}`, `${r.pct}%`]
        ));
        doc.autoTable({ head: [head], body: rows, startY: 80 });
      } else if (repType.value === 'graph') {
        if (analyticsChart) {
          const img = analyticsChart.toBase64Image();
          doc.addImage(img, 'PNG', 20, 80, doc.internal.pageSize.getWidth() - 40, 150);
        }
      } else if (repType.value === 'all') {
        // table
        const head1 = ['Name','P','Lt','HD','L','A','%'];
        const rows1 = data.map(r => [r.name, r.cnt.P, r.cnt.Lt, r.cnt.HD, r.cnt.L, r.cnt.A, `${r.pct}%`]);
        doc.autoTable({ head: [head1], body: rows1, startY: 80 });
        // graph on new page
        if (analyticsChart) {
          doc.addPage();
          const imgAll = analyticsChart.toBase64Image();
          doc.addImage(imgAll, 'PNG', 20, 80, doc.internal.pageSize.getWidth() - 40, 150);
        }
      }

      doc.save(`Analytics_${period}.pdf`);
    };
    analyticsCont.appendChild(dlBtn);
  }

  // Initialize if needed
});
