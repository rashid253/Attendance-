// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };

  // … sections 1–3 unchanged …

  // 4. ANALYTICS
  const analyticsTarget      = $('analyticsTarget');
  const studentAdmInput      = $('studentAdmInput');
  const analyticsType        = $('analyticsType');
  const analyticsDate        = $('analyticsDate');
  const analyticsMonth       = $('analyticsMonth');
  const semesterStart        = $('semesterStart');
  const semesterEnd          = $('semesterEnd');
  const yearStart            = $('yearStart');
  const loadAnalyticsBtn     = $('loadAnalytics');
  const resetAnalyticsBtn    = $('resetAnalytics');
  const instructionsEl       = $('instructions');
  const analyticsContainer   = $('analyticsContainer');
  const graphsEl             = $('graphs');
  const analyticsActionsEl   = $('analyticsActions');
  const shareAnalyticsBtn    = $('shareAnalytics');
  const downloadAnalyticsBtn = $('downloadAnalytics');
  const barCtx               = document.getElementById('barChart').getContext('2d');
  const pieCtx               = document.getElementById('pieChart').getContext('2d');
  let barChart, pieChart;

  // SHOW/HIDE admission# input
  analyticsTarget.onchange = () => {
    if (analyticsTarget.value === 'student') {
      studentAdmInput.classList.remove('hidden');
    } else {
      studentAdmInput.classList.add('hidden');
    }
  };

  function hideAllAnalytics() {
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart,
     instructionsEl, analyticsContainer, graphsEl, analyticsActionsEl, resetAnalyticsBtn]
      .forEach(el => el.classList.add('hidden'));
    studentAdmInput.classList.add('hidden');
  }

  analyticsType.onchange = () => {
    hideAllAnalytics();
    if (analyticsType.value === 'date')      analyticsDate.classList.remove('hidden');
    if (analyticsType.value === 'month')     analyticsMonth.classList.remove('hidden');
    if (analyticsType.value === 'semester')  { semesterStart.classList.remove('hidden'); semesterEnd.classList.remove('hidden'); }
    if (analyticsType.value === 'year')      yearStart.classList.remove('hidden');
    resetAnalyticsBtn.classList.remove('hidden');
  };

  resetAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    analyticsType.value = '';
    analyticsTarget.value = 'class';
    studentAdmInput.value = '';
    hideAllAnalytics();
  };

  loadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    // determine date range
    let from, to;
    if (analyticsType.value === 'date') {
      if (!analyticsDate.value) return alert('Pick a date');
      from = to = analyticsDate.value;
    } else if (analyticsType.value === 'month') {
      if (!analyticsMonth.value) return alert('Pick a month');
      from = analyticsMonth.value + '-01'; to = analyticsMonth.value + '-31';
    } else if (analyticsType.value === 'semester') {
      if (!semesterStart.value || !semesterEnd.value) return alert('Pick semester range');
      from = semesterStart.value + '-01'; to = semesterEnd.value + '-31';
    } else if (analyticsType.value === 'year') {
      if (!yearStart.value) return alert('Pick a year');
      from = yearStart.value + '-01-01'; to = yearStart.value + '-12-31';
    } else {
      return alert('Select a period');
    }

    // build stats array
    let stats;
    if (analyticsTarget.value === 'class') {
      stats = students.map(s => ({ name: s.name, roll: s.roll, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    } else {
      const adm = studentAdmInput.value.trim();
      if (!adm) return alert('Enter Admission # for student report');
      const stud = students.find(s => s.adm === adm);
      if (!stud) return alert(`No student found with Adm#: ${adm}`);
      stats = [{ name: stud.name, roll: stud.roll, P:0, A:0, Lt:0, HD:0, L:0, total:0 }];
    }

    // tally attendance
    Object.entries(attendanceData).forEach(([d, recs]) => {
      if (d >= from && d <= to) {
        stats.forEach(st => {
          const code = recs[st.roll] || 'A';
          st[code]++; st.total++;
        });
      }
    });

    // render table
    let html = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s => {
      const pct = s.total ? ((s.P / s.total) * 100).toFixed(1) : '0.0';
      html += `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
    });
    html += '</tbody></table>';
    analyticsContainer.innerHTML = html;
    analyticsContainer.classList.remove('hidden');
    instructionsEl.textContent = `Report: ${from} to ${to}`;
    instructionsEl.classList.remove('hidden');

    // Bar chart: % present
    const labels = stats.map(s => s.name);
    const dataPct = stats.map(s => s.total ? (s.P / s.total) * 100 : 0);
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, { type:'bar', data:{ labels, datasets:[{ label:'% Present', data:dataPct }] }, options:{ maintainAspectRatio:true } });

    // Pie chart: aggregate counts
    const agg = stats.reduce((a, s) => { ['P','A','Lt','HD','L'].forEach(c => a[c] += s[c]); return a; }, {P:0,A:0,Lt:0,HD:0,L:0});
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, { type:'pie', data:{ labels:['P','A','Lt','HD','L'], datasets:[{ data: Object.values(agg) }] }, options:{ maintainAspectRatio:true, aspectRatio:1 } });

    graphsEl.classList.remove('hidden');
    analyticsActionsEl.classList.remove('hidden');
  };

  // … shareAnalyticsBtn & downloadAnalyticsBtn unchanged …

  // … sections 6 unchanged …
});
