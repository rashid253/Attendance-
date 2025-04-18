window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const THRESHOLD = 75;
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };
  let attendanceData = JSON.parse(localStorage.getItem('attendance') || {};

  // ================= SETUP SECTION =================
  const setupForm = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText = $('setupText');
  const saveSetup = $('saveSetup');
  const editSetup = $('editSetup');

  function saveSetupData() {
    localStorage.setItem('schoolName', $('schoolNameInput').value);
    localStorage.setItem('teacherClass', $('teacherClassSelect').value);
    localStorage.setItem('teacherSection', $('teacherSectionSelect').value);
    
    setupForm.classList.add('hidden');
    setupDisplay.classList.remove('hidden');
    setupText.textContent = `${$('schoolNameInput').value} - ${$('teacherClassSelect').value} ${$('teacherSectionSelect').value}`;
  }

  saveSetup.addEventListener('click', () => {
    if (!$('schoolNameInput').value || !$('teacherClassSelect').value || !$('teacherSectionSelect').value) {
      alert('Please fill all setup fields');
      return;
    }
    saveSetupData();
  });

  editSetup.addEventListener('click', () => {
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  });

  // Initialize setup if exists
  if(localStorage.getItem('schoolName')) {
    $('schoolNameInput').value = localStorage.getItem('schoolName');
    $('teacherClassSelect').value = localStorage.getItem('teacherClass');
    $('teacherSectionSelect').value = localStorage.getItem('teacherSection');
    saveSetupData();
  }

  // ================= ATTENDANCE SECTION =================
  const dateInput = $('dateInput');
  const loadAttendance = $('loadAttendance');
  const saveAttendance = $('saveAttendance');
  const attendanceList = $('attendanceList');
  const attendanceResult = $('attendance-result');

  function createAttendanceButtons(student) {
    const div = document.createElement('div');
    div.className = 'attendance-item';
    div.innerHTML = `
      ${student.name} (${student.adm})
      <div class="attendance-actions">
        ${Object.entries(colors).map(([status, color]) => `
          <button class="att-btn" style="background:${color}" 
            data-status="${status}">${status}</button>
        `).join('')}
      </div>
    `;
    return div;
  }

  loadAttendance.addEventListener('click', () => {
    if(!dateInput.value) return alert('Select date first');
    attendanceList.innerHTML = '';
    students.forEach(student => {
      const item = createAttendanceButtons(student);
      const buttons = item.querySelectorAll('.att-btn');
      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          buttons.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          updateAttendanceRecord(student.adm, btn.dataset.status);
        });
      });
      attendanceList.appendChild(item);
    });
    saveAttendance.classList.remove('hidden');
    attendanceResult.classList.remove('hidden');
  });

  function updateAttendanceRecord(adm, status) {
    const dateKey = dateInput.value;
    if(!attendanceData[dateKey]) attendanceData[dateKey] = {};
    attendanceData[dateKey][adm] = status;
    localStorage.setItem('attendance', JSON.stringify(attendanceData));
  }

  saveAttendance.addEventListener('click', () => {
    renderAttendanceSummary();
    saveAttendance.classList.add('hidden');
  });

  function renderAttendanceSummary() {
    const dateKey = dateInput.value;
    const summaryBody = $('summaryBody');
    summaryBody.innerHTML = '';
    
    students.forEach(student => {
      const tr = document.createElement('tr');
      const status = attendanceData[dateKey]?.[student.adm] || 'A';
      tr.innerHTML = `
        <td>${student.name}</td>
        <td style="color:${colors[status]}">${status}</td>
        <td><button class="small" onclick="shareStudentAttendance('${student.adm}','${dateKey}')">Send</button></td>
      `;
      summaryBody.appendChild(tr);
    });
  }

  window.shareStudentAttendance = (adm, date) => {
    const student = students.find(s => s.adm === adm);
    const status = attendanceData[date]?.[adm] || 'A';
    const message = `Attendance Update\n\nDate: ${date}\nStudent: ${student.name}\nAdm#: ${adm}\nStatus: ${status}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  // ================= ANALYTICS SECTION =================
  const analyticsType = $('analyticsType');
  const loadAnalytics = $('loadAnalytics');
  const analyticsContainer = $('analyticsContainer');
  const graphs = $('graphs');

  analyticsType.addEventListener('change', () => {
    document.querySelectorAll('#analytics-section input[type="date"], #analytics-section input[type="month"], #analytics-section input[type="number"]')
      .forEach(el => el.classList.add('hidden'));
    
    switch(analyticsType.value) {
      case 'date': $('analyticsDate').classList.remove('hidden'); break;
      case 'month': $('analyticsMonth').classList.remove('hidden'); break;
      case 'semester': 
        $('semesterStart').classList.remove('hidden');
        $('semesterEnd').classList.remove('hidden');
        break;
      case 'year': $('yearStart').classList.remove('hidden'); break;
    }
  });

  loadAnalytics.addEventListener('click', () => {
    if(!validateAnalyticsInput()) return;
    generateAnalyticsReport();
    graphs.classList.remove('hidden');
    renderCharts();
  });

  function validateAnalyticsInput() {
    const type = analyticsType.value;
    if(type === 'date' && !$('analyticsDate').value) return alert('Select date');
    if(type === 'month' && !$('analyticsMonth').value) return alert('Select month');
    if(type === 'semester' && (!$('semesterStart').value || !$('semesterEnd').value)) 
      return alert('Select semester range');
    if(type === 'year' && !$('yearStart').value) return alert('Enter year');
    return true;
  }

  function generateAnalyticsReport() {
    const type = analyticsType.value;
    let dateRange = [];
    
    switch(type) {
      case 'date': 
        dateRange = [$('analyticsDate').value];
        break;
      case 'month':
        const month = $('analyticsMonth').value;
        dateRange = Object.keys(attendanceData).filter(d => d.startsWith(month));
        break;
      case 'semester':
        const start = $('semesterStart').value;
        const end = $('semesterEnd').value;
        dateRange = Object.keys(attendanceData).filter(d => d >= start && d <= end);
        break;
      case 'year':
        const year = $('yearStart').value;
        dateRange = Object.keys(attendanceData).filter(d => d.startsWith(year));
        break;
    }

    const report = calculateAttendanceStats(dateRange);
    analyticsContainer.innerHTML = `
      <h3>Attendance Statistics (${dateRange.length} days)</h3>
      <p>Total Students: ${students.length}</p>
      <p>Average Attendance: ${report.avg}%</p>
      <p>Days with < ${THRESHOLD}% Attendance: ${report.lowDays}</p>
    `;
    analyticsContainer.classList.remove('hidden');
  }

  function calculateAttendanceStats(dateRange) {
    let totalPresent = 0;
    let lowDays = 0;
    
    dateRange.forEach(date => {
      const dailyData = attendanceData[date] || {};
      const presentCount = Object.values(dailyData).filter(s => ['P','Lt','HD'].includes(s)).length;
      const dailyPercentage = (presentCount / students.length) * 100 || 0;
      totalPresent += dailyPercentage;
      if(dailyPercentage < THRESHOLD) lowDays++;
    });

    return {
      avg: (totalPresent / dateRange.length).toFixed(1),
      lowDays
    };
  }

  function renderCharts() {
    const ctxBar = $('barChart').getContext('2d');
    const ctxPie = $('pieChart').getContext('2d');
    
    new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: Object.keys(colors),
        datasets: [{
          label: 'Attendance Distribution',
          data: calculateStatusDistribution(),
          backgroundColor: Object.values(colors)
        }]
      }
    });

    new Chart(ctxPie, {
      type: 'pie',
      data: {
        labels: ['Present', 'Absent'],
        datasets: [{
          data: [calculateOverallPercentage(), 100 - calculateOverallPercentage()],
          backgroundColor: [colors.P, colors.A]
        }]
      }
    });
  }

  function calculateStatusDistribution() {
    const counts = { P:0, A:0, Lt:0, HD:0, L:0 };
    Object.values(attendanceData).forEach(dateData => {
      Object.values(dateData).forEach(status => counts[status]++);
    });
    return Object.values(counts);
  }

  function calculateOverallPercentage() {
    const totalEntries = Object.values(attendanceData).flatMap(date => Object.values(date)).length;
    const presentEntries = Object.values(attendanceData).flatMap(date => 
      Object.values(date).filter(s => ['P','Lt','HD'].includes(s))).length;
    return ((presentEntries / totalEntries) * 100 || 0).toFixed(1);
  }

  // Rest of your existing student registration code remains unchanged
  // ...
});
