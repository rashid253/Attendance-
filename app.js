// app.js (only the Analytics & Traditional Register sections shown)
// — keep all preceding setup, registration, and attendance code unchanged —

window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // ... previous code omitted for brevity ...

  // ---------- ANALYTICS SECTION FIXES ----------
  const analyticsType      = $('analyticsType');
  const analyticsDate      = $('analyticsDate');
  const analyticsMonth     = $('analyticsMonth');
  const semesterStart      = $('semesterStart');
  const semesterEnd        = $('semesterEnd');
  const yearStart          = $('yearStart');
  const loadAnalyticsBtn   = $('loadAnalytics');
  const resetAnalyticsBtn  = $('resetAnalytics');
  const instructionsEl     = $('instructions');
  const analyticsContainer = $('analyticsContainer');
  const graphsEl           = $('graphs');
  const analyticsActionsEl = $('analyticsActions');
  const shareAnalyticsBtn  = $('shareAnalytics');
  const downloadAnalyticsBtn = $('downloadAnalytics');
  const barCtx             = $('barChart').getContext('2d');
  const pieCtx             = $('pieChart').getContext('2d');

  // Show/hide appropriate picker based on selection
  analyticsType.addEventListener('change', () => {
    // hide all first
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart].forEach(el => el.classList.add('hidden'));
    // show the one(s) needed
    switch (analyticsType.value) {
      case 'date':
        analyticsDate.classList.remove('hidden');
        break;
      case 'month':
        analyticsMonth.classList.remove('hidden');
        break;
      case 'semester':
        semesterStart.classList.remove('hidden');
        semesterEnd.classList.remove('hidden');
        break;
      case 'year':
        yearStart.classList.remove('hidden');
        break;
    }
  });

  loadAnalyticsBtn.addEventListener('click', ev => {
    ev.preventDefault();
    // ensure a period is selected
    if (!analyticsType.value) return alert('Select a period');
    // determine date range
    let dates = [];
    if (analyticsType.value === 'date') {
      if (!analyticsDate.value) return alert('Pick a date');
      dates = [ analyticsDate.value ];
    } else if (analyticsType.value === 'month') {
      if (!analyticsMonth.value) return alert('Pick a month');
      // gather all days in that month
      const [ year, mon ] = analyticsMonth.value.split('-').map(Number);
      const lastDay = new Date(year, mon, 0).getDate();
      for (let d = 1; d <= lastDay; d++) {
        dates.push(`${analyticsMonth.value}-${String(d).padStart(2,'0')}`);
      }
    } else if (analyticsType.value === 'semester') {
      if (!semesterStart.value || !semesterEnd.value) return alert('Pick semester start & end');
      const start = new Date(semesterStart.value + '-01');
      const end   = new Date(semesterEnd.value + '-01');
      for (let dt = new Date(start); dt <= end; dt.setMonth(dt.getMonth()+1)) {
        const ym = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
        const lastDay = new Date(dt.getFullYear(), dt.getMonth()+1, 0).getDate();
        for (let d = 1; d <= lastDay; d++) {
          dates.push(`${ym}-${String(d).padStart(2,'0')}`);
        }
      }
    } else if (analyticsType.value === 'year') {
      if (!yearStart.value) return alert('Pick a year');
      const yr = Number(yearStart.value);
      for (let m = 1; m <= 12; m++) {
        const ym = `${yr}-${String(m).padStart(2,'0')}`;
        const lastDay = new Date(yr, m, 0).getDate();
        for (let d = 1; d <= lastDay; d++) {
          dates.push(`${ym}-${String(d).padStart(2,'0')}`);
        }
      }
    }

    // aggregate counts
    const attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
    const counts = { P:0, A:0, Lt:0, HD:0, L:0 };
    dates.forEach(date => {
      const dayData = attendanceData[date] || {};
      Object.values(dayData).forEach(code => {
        counts[code] = (counts[code] || 0) + 1;
      });
    });

    // render charts
    instructionsEl.classList.add('hidden');
    analyticsContainer.classList.add('hidden'); // we don't use table output
    graphsEl.classList.remove('hidden');
    analyticsActionsEl.classList.remove('hidden');

    new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: Object.keys(counts),
        datasets: [{ label: 'Total', data: Object.values(counts) }]
      }
    });
    new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: Object.keys(counts),
        datasets: [{ data: Object.values(counts) }]
      }
    });
  });

  resetAnalyticsBtn.addEventListener('click', ev => {
    ev.preventDefault();
    analyticsType.value = '';
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart].forEach(el => el.classList.add('hidden'));
    graphsEl.classList.add('hidden');
    analyticsActionsEl.classList.add('hidden');
    instructionsEl.classList.remove('hidden');
  });

  // ---------- TRADITIONAL REGISTER SECTION FIXES ----------
  const loadRegisterBtn     = $('loadRegister');
  const resetRegisterBtn    = $('resetRegister');
  const registerMonthInput  = $('registerMonth');
  const registerWrapper     = $('registerWrapper');
  const registerTable       = $('registerTable');
  const registerSummary     = $('registerSummary');
  const registerSummaryBody = $('registerSummaryTable tbody');
  const students            = JSON.parse(localStorage.getItem('students') || '[]');
  const attendanceData      = JSON.parse(localStorage.getItem('attendanceData') || '{}');

  loadRegisterBtn.addEventListener('click', ev => {
    ev.preventDefault();
    if (!registerMonthInput.value) return alert('Pick a month');
    const [ year, mon ] = registerMonthInput.value.split('-').map(Number);
    const lastDay = new Date(year, mon, 0).getDate();

    // build header row: Days 1..N
    let html = '<thead><tr><th>Name</th>';
    for (let d = 1; d <= lastDay; d++) {
      html += `<th>${d}</th>`;
    }
    html += '</tr></thead><tbody>';

    // per-student rows
    students.forEach(s => {
      html += `<tr><td>${s.name}</td>`;
      let present=0, absent=0, late=0, half=0, leave=0;
      for (let d = 1; d <= lastDay; d++) {
        const dateKey = `${registerMonthInput.value}-${String(d).padStart(2,'0')}`;
        const code = (attendanceData[dateKey] || {})[s.roll] || 'A';
        html += `<td>${code}</td>`;
        if (code==='P') present++;
        if (code==='A') absent++;
        if (code==='Lt') late++;
        if (code==='HD') half++;
        if (code==='L') leave++;
      }
      html += '</tr>';
      // accumulate summary
      registerSummaryBody.insertAdjacentHTML('beforeend',
        `<tr>
           <td>${s.name}</td>
           <td>${present}</td>
           <td>${absent}</td>
           <td>${late}</td>
           <td>${half}</td>
           <td>${leave}</td>
           <td>${present+absent+late+half+leave}</td>
           <td>${((present/(present+absent+late+half+leave))*100).toFixed(1)}%</td>
         </tr>`);
    });

    html += '</tbody>';
    registerTable.innerHTML = html;
    registerWrapper.classList.remove('hidden');
    registerSummary.classList.remove('hidden');
    resetRegisterBtn.classList.remove('hidden');
  });

  resetRegisterBtn.addEventListener('click', ev => {
    ev.preventDefault();
    registerTable.innerHTML = '';
    registerSummaryBody.innerHTML = '';
    registerWrapper.classList.add('hidden');
    registerSummary.classList.add('hidden');
    resetRegisterBtn.classList.add('hidden');
    registerMonthInput.value = '';
  });

  // ... any remaining code ...
});
