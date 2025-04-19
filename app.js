// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'var(--orange)', L:'var(--info)' };

  // 1. SETUP … (unchanged)

  // 2. STUDENT REGISTRATION … (unchanged)

  // 3. ATTENDANCE MARKING … (unchanged)

  // 4. ANALYTICS
  let students = JSON.parse(localStorage.getItem('students')||'[]');
  const analyticsScope        = $('analyticsScope');
  const analyticsStudentSelect= $('analyticsStudentSelect');
  const analyticsType         = $('analyticsType');
  const analyticsDate         = $('analyticsDate');
  const analyticsMonth        = $('analyticsMonth');
  const semesterStart         = $('semesterStart');
  const semesterEnd           = $('semesterEnd');
  const yearStart             = $('yearStart');
  const loadAnalyticsBtn      = $('loadAnalytics');
  const resetAnalyticsBtn     = $('resetAnalytics');
  const instructionsEl        = $('instructions');
  const analyticsContainer    = $('analyticsContainer');
  const graphsEl              = $('graphs');
  const analyticsActionsEl    = $('analyticsActions');
  const shareAnalyticsBtn     = $('shareAnalytics');
  const downloadAnalyticsBtn  = $('downloadAnalytics');
  const barCtx                = document.getElementById('barChart').getContext('2d');
  const pieCtx                = document.getElementById('pieChart').getContext('2d');
  let barChart, pieChart;

  // populate student dropdown
  students.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.roll;
    opt.textContent = s.name;
    analyticsStudentSelect.append(opt);
  });

  // show/hide student select
  analyticsScope.onchange = () => {
    if (analyticsScope.value === 'student') {
      analyticsStudentSelect.classList.remove('hidden');
    } else {
      analyticsStudentSelect.classList.add('hidden');
      analyticsStudentSelect.value = '';
    }
  };

  function hideAllAnalytics() {
    [analyticsStudentSelect, analyticsDate, analyticsMonth, semesterStart,
     semesterEnd, yearStart, instructionsEl, analyticsContainer,
     graphsEl, analyticsActionsEl, resetAnalyticsBtn]
      .forEach(el => el.classList.add('hidden'));
  }

  analyticsType.onchange = () => {
    hideAllAnalytics();
    if (analyticsScope.value === 'student' && analyticsType.value) {
      analyticsStudentSelect.classList.remove('hidden');
    }
    if (analyticsType.value === 'date')     analyticsDate.classList.remove('hidden');
    if (analyticsType.value === 'month')    analyticsMonth.classList.remove('hidden');
    if (analyticsType.value === 'semester') {
      semesterStart.classList.remove('hidden');
      semesterEnd.classList.remove('hidden');
    }
    if (analyticsType.value === 'year')     yearStart.classList.remove('hidden');
  };

  resetAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    analyticsType.value = '';
    analyticsScope.value = 'class';
    analyticsStudentSelect.value = '';
    hideAllAnalytics();
  };

  loadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    // determine target students
    let target = [];
    if (analyticsScope.value === 'student') {
      if (!analyticsStudentSelect.value) {
        return alert('Please select a student');
      }
      const s = students.find(x=>x.roll==analyticsStudentSelect.value);
      target = s ? [s] : [];
    } else {
      target = students.slice();
    }

    // determine date range
    let from, to;
    if (analyticsType.value === 'date') {
      if (!analyticsDate.value) return alert('Pick a date');
      from = to = analyticsDate.value;
    } else if (analyticsType.value === 'month') {
      if (!analyticsMonth.value) return alert('Pick a month');
      from = analyticsMonth.value+'-01'; to = analyticsMonth.value+'-31';
    } else if (analyticsType.value === 'semester') {
      if (!semesterStart.value||!semesterEnd.value) return alert('Pick range');
      from = semesterStart.value+'-01'; to = semesterEnd.value+'-31';
    } else if (analyticsType.value === 'year') {
      if (!yearStart.value) return alert('Pick a year');
      from = yearStart.value+'-01-01'; to = yearStart.value+'-12-31';
    } else return;

    // compute stats only for target list
    const stats = target.map(s=>({
      name:s.name, roll:s.roll, P:0,A:0,Lt:0,HD:0,L:0,total:0
    }));
    Object.entries(window.attendanceData||{}).forEach(([d,recs])=>{
      if (d>=from && d<=to) stats.forEach(st=>{
        const c = recs[st.roll]||'A'; st[c]++; st.total++;
      });
    });

    // render table
    let html = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s=>{
      const pct = s.total?((s.P/s.total)*100).toFixed(1):'0.0';
      html += `<tr>
        <td>${s.name}</td><td>${s.P}</td><td>${s.A}</td>
        <td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td>
        <td>${s.total}</td><td>${pct}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    analyticsContainer.innerHTML = html;
    analyticsContainer.classList.remove('hidden');

    instructionsEl.textContent = `Report ${analyticsScope.value==='class'?'for Class':'for '+stats[0].name}: ${from} to ${to}`;
    instructionsEl.classList.remove('hidden');
    resetAnalyticsBtn.classList.remove('hidden');

    // charts
    const labels = stats.map(s=>s.name);
    const dataPct = stats.map(s=>s.total?s.P/s.total*100:0);
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx,{
      type:'bar',
      data:{ labels, datasets:[{ label:'% Present', data:dataPct }] },
      options:{ maintainAspectRatio:true }
    });
    const agg = stats.reduce((a,s)=>{
      ['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]); return a;
    },{P:0,A:0,Lt:0,HD:0,L:0});
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx,{
      type:'pie',
      data:{ labels:['P','A','Lt','HD','L'], datasets:[{ data:Object.values(agg) }]},
      options:{ maintainAspectRatio:true, aspectRatio:1 }
    });

    graphsEl.classList.remove('hidden');
    analyticsActionsEl.classList.remove('hidden');
  };

  // shareAnalyticsBtn & downloadAnalyticsBtn … (unchanged)

  // 5. ATTENDANCE REGISTER … (unchanged)
});
