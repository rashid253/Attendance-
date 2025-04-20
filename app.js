window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P: '#4CAF50', A: '#f44336', Lt: '#FFEB3B', HD: '#FF9800', L: '#03a9f4' };

  // 1. SETUP
  const schoolIn = $('schoolNameInput');
  const classSel = $('teacherClassSelect');
  const secSel = $('teacherSectionSelect');
  const saveSetup = $('saveSetup');
  const setupForm = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText = $('setupText');
  const editSetup = $('editSetup');

  function loadSetup() {
    const school = localStorage.getItem('schoolName');
    const cls = localStorage.getItem('teacherClass');
    const sec = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetup.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };

  editSetup.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };

  loadSetup();

  // 2. STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  // ... registration code unchanged ...

  // 3. ATTENDANCE MARKING
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
  // ... attendance marking code unchanged ...

  // 4. ANALYTICS
  const analyticsTarget   = $('analyticsTarget');
  const studentAdmInput   = $('studentAdmInput');
  const analyticsType     = $('analyticsType');
  const analyticsDate     = $('analyticsDate');
  const analyticsMonth    = $('analyticsMonth');
  const semesterStartInput= $('semesterStart');
  const semesterEndInput  = $('semesterEnd');
  const yearStart         = $('yearStart');
  const loadAnalyticsBtn  = $('loadAnalytics');
  const resetAnalyticsBtn = $('resetAnalytics');
  const instructionsEl    = $('instructions');
  const analyticsContainer= $('analyticsContainer');
  const graphsEl          = $('graphs');
  const analyticsActionsEl= $('analyticsActions');
  const shareAnalyticsBtn = $('shareAnalytics');
  const downloadAnalyticsBtn = $('downloadAnalytics');
  const barCtx           = $('barChart').getContext('2d');
  const pieCtx           = $('pieChart').getContext('2d');
  let barChart, pieChart;

  function hideAllAnalytics() {
    [analyticsDate, analyticsMonth, semesterStartInput, semesterEndInput, yearStart,
     instructionsEl, analyticsContainer, graphsEl, analyticsActionsEl, resetAnalyticsBtn]
      .forEach(el => el.classList.add('hidden'));
  }

  analyticsTarget.onchange = () => {
    // Show input for student admission when individual selected
    if (analyticsTarget.value === 'student') {
      studentAdmInput.classList.remove('hidden');
    } else {
      studentAdmInput.classList.add('hidden');
    }
    hideAllAnalytics();
    analyticsType.value = '';
  };

  analyticsType.onchange = () => {
    hideAllAnalytics();
    if (analyticsType.value === 'date') analyticsDate.classList.remove('hidden');
    if (analyticsType.value === 'month') analyticsMonth.classList.remove('hidden');
    if (analyticsType.value === 'semester') {
      semesterStartInput.classList.remove('hidden');
      semesterEndInput.classList.remove('hidden');
    }
    if (analyticsType.value === 'year') yearStart.classList.remove('hidden');
    resetAnalyticsBtn.classList.remove('hidden');
  };

  resetAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    hideAllAnalytics();
    analyticsType.value = '';
  };

  loadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    // Determine period
    let from, to;
    if (analyticsType.value === 'date') {
      if (!analyticsDate.value) return alert('Pick a date');
      from = to = analyticsDate.value;
    } else if (analyticsType.value === 'month') {
      if (!analyticsMonth.value) return alert('Pick a month');
      const [y,m] = analyticsMonth.value.split('-').map(Number);
      from = `${analyticsMonth.value}-01`;
      to = `${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (analyticsType.value === 'semester') {
      if (!semesterStartInput.value || !semesterEndInput.value) return alert('Pick semester range');
      from = `${semesterStartInput.value}-01`;
      const [ey,em] = semesterEndInput.value.split('-').map(Number);
      to = `${semesterEndInput.value}-${new Date(ey,em,0).getDate()}`;
    } else if (analyticsType.value === 'year') {
      if (!yearStart.value) return alert('Pick year');
      from = `${yearStart.value}-01-01`;
      to = `${yearStart.value}-12-31`;
    } else {
      return alert('Select period');
    }

    // Prepare stats array based on target
    let stats = [];
    if (analyticsTarget.value === 'student') {
      const adm = studentAdmInput.value.trim();
      if (!adm) return alert('Enter Admission #');
      const student = students.find(s => s.adm === adm);
      if (!student) return alert(`No student with Admission# ${adm}`);
      stats = [{ name: student.name, roll: student.roll, P:0, A:0, Lt:0, HD:0, L:0, total:0 }];
    } else {
      stats = students.map(s => ({ name: s.name, roll: s.roll, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    }

    // Aggregate attendance data
    const fromDate = new Date(from), toDate = new Date(to);
    Object.entries(attendanceData).forEach(([d,recs]) => {
      const cur = new Date(d);
      if (cur >= fromDate && cur <= toDate) {
        stats.forEach(st => {
          const code = recs[st.roll] || 'A';
          st[code]++;
          st.total++;
        });
      }
    });

    // Render table
    let html = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s => {
      const pct = s.total ? ((s.P / s.total) * 100).toFixed(1) : '0.0';
      html += `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td>` +
              `<td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
    });
    html += '</tbody></table>';
    analyticsContainer.innerHTML = html;
    analyticsContainer.classList.remove('hidden');

    // Display instructions/header
    if (analyticsTarget.value === 'student') {
      instructionsEl.textContent = `Admission#: ${studentAdmInput.value.trim()} | Report: ${from} to ${to}`;
    } else {
      instructionsEl.textContent = `Report: ${from} to ${to}`;
    }
    instructionsEl.classList.remove('hidden');

    // Bar chart: % Present
    const labels = stats.map(s => s.name);
    const dataPct = stats.map(s => s.total ? (s.P / s.total) * 100 : 0);
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: { labels, datasets: [{ label: '% Present', data: dataPct }] },
      options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
    });

    // Pie chart: aggregate or single breakdown
    const agg = stats.reduce((a, s) => {
      ['P','A','Lt','HD','L'].forEach(c => a[c] += s[c]);
      return a;
    }, { P:0, A:0, Lt:0, HD:0, L:0 });
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: { labels: ['Present','Absent','Late','Half Day','Leave'], datasets: [{ data: Object.values(agg) }] },
      options: { responsive: true }
    });

    graphsEl.classList.remove('hidden');
    analyticsActionsEl.classList.remove('hidden');
  };

  // ... shareAnalytics and downloadAnalytics code unchanged ...
});
