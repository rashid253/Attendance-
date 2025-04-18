// app.js
// Analytics enhancements: placeholder, detailed tables for Month/Semester/Year, dynamic fields

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
  const loadAnalyticsBtn  = $('loadAnalytics');
  const resetAnalyticsBtn = $('resetAnalyticsBtn');
  const analyticsCont     = $('analyticsContainer');

  let schoolName = localStorage.getItem('schoolName') || '';
  let cls        = localStorage.getItem('teacherClass') || '';
  let sec        = localStorage.getItem('teacherSection') || '';
  let students   = JSON.parse(localStorage.getItem('students')) || [];
  let attendance = JSON.parse(localStorage.getItem('attendanceData')) || {};
  let analyticsChart = null;

  // Show/hide inputs based on period
  analyticsType.addEventListener('change', e => {
    const v = e.target.value;
    [analyticsDateIn, analyticsMonthIn, analyticsSemester, analyticsYearIn]
      .forEach(el => el.classList.add('hidden'));
    if (v === 'date')     analyticsDateIn.classList.remove('hidden');
    if (v === 'month')    analyticsMonthIn.classList.remove('hidden');
    if (v === 'semester') analyticsSemester.classList.remove('hidden');
    if (v === 'year')     analyticsYearIn.classList.remove('hidden');
  });

  loadAnalyticsBtn.addEventListener('click', renderAnalytics);
  resetAnalyticsBtn.addEventListener('click', () => {
    [
      analyticsType, analyticsDateIn, analyticsMonthIn,
      analyticsSemester, analyticsYearIn,
      studentFilter, repType, loadAnalyticsBtn
    ].forEach(el => { el.disabled = false; el.classList.remove('hidden'); });
    resetAnalyticsBtn.classList.add('hidden');
    analyticsCont.innerHTML = '';
  });

  function collectDatesFor(type) {
    const dates = [];
    const year = new Date().getFullYear();
    if (type === 'date') {
      dates.push(analyticsDateIn.value);
    } else if (type === 'month') {
      const [y,m] = analyticsMonthIn.value.split('-');
      const days = new Date(y, m, 0).getDate();
      for (let d = 1; d <= days; d++) dates.push(`${y}-${m}-${String(d).padStart(2,'0')}`);
    } else if (type === 'semester') {
      const sem = analyticsSemester.value;
      const start = sem === '1' ? 1 : 7;
      const end   = sem === '1' ? 6 : 12;
      for (let mo = start; mo <= end; mo++) {
        const mm = String(mo).padStart(2,'0');
        const days = new Date(year, mo, 0).getDate();
        for (let d = 1; d <= days; d++) dates.push(`${year}-${mm}-${String(d).padStart(2,'0')}`);
      }
    } else if (type === 'year') {
      const y = analyticsYearIn.value;
      for (let mo = 1; mo <= 12; mo++) {
        const mm = String(mo).padStart(2,'0');
        const days = new Date(y, mo, 0).getDate();
        for (let d = 1; d <= days; d++) dates.push(`${y}-${mm}-${String(d).padStart(2,'0')}`);
      }
    }
    return dates;
  }

  function renderAnalytics() {
    const type = analyticsType.value;
    if (!type) return alert('Please select a period');

    // disable controls
    [
      analyticsType, analyticsDateIn, analyticsMonthIn,
      analyticsSemester, analyticsYearIn,
      studentFilter, repType, loadAnalyticsBtn
    ].forEach(el => el.disabled = true);
    resetAnalyticsBtn.classList.remove('hidden');
    analyticsCont.innerHTML = '';

    const dates = collectDatesFor(type);
    if (!dates.length) return alert('Please select a valid period');

    // Gather student data
    const selRoll = studentFilter.value;
    const data = students
      .filter(s => s.class === cls && s.section === sec)
      .filter(s => !selRoll || s.roll == selRoll)
      .map(s => {
        const cnt = { P:0, A:0, Lt:0, L:0, HD:0 };
        dates.forEach(d => { const st = attendance[d]?.[s.roll]; if (st) cnt[st]++; });
        const pct = Math.round((cnt.P+cnt.Lt+cnt.HD)/dates.length*100);
        return { roll: s.roll, name: s.name, cnt, pct };
      });

    // Detailed register table for Month/Semester/Year
    if (['month','semester','year'].includes(type)) {
      const tbl = document.createElement('table');
      tbl.border = 1; tbl.style.width = '100%';
      const header = ['Roll','Name', ...dates.map(d => d.split('-')[2])];
      tbl.innerHTML = `<tr>${header.map(h=>`<th>${h}</th>`).join('')}</tr>`;
      data.forEach(r => {
        const row = [r.roll, r.name, ...dates.map(d => attendance[d]?.[r.roll]||'')];
        tbl.innerHTML += `<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`;
      });
      analyticsCont.appendChild(tbl);
    }

    // Summary block
    if (repType.value !== 'graph') {
      const sum = document.createElement('div');
      sum.innerHTML = '<h3>Summary</h3>' +
        data.map(r =>
          `<p>${r.name}: P:${r.cnt.P}, Lt:${r.cnt.Lt}, HD:${r.cnt.HD}, L:${r.cnt.L}, A:${r.cnt.A} — ${r.pct}%</p>`
        ).join('');
      analyticsCont.appendChild(sum);
    }

    // Graph
    if (repType.value === 'graph' || repType.value === 'all') {
      const canvas = document.createElement('canvas');
      analyticsCont.append(canvas);
      if (analyticsChart) analyticsChart.destroy();
      analyticsChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: data.map(r=>r.name),
          datasets:[{ label: '% Present', data: data.map(r=>r.pct) }]
        },
        options: { responsive: true }
      });
    }

    // Share & Download logic unchanged – will capture exactly what's rendered above
  }
});
