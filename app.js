/* style.css */
:root {
  --primary: #2196F3;
  --success: #4CAF50;
  --danger: #f44336;
  --warning: #FFEB3B;
  --orange: #FF9800;
  --info: #03a9f4;
  --light: #f2f2f2;
  --dark: #333;
}

* {
  -webkit-tap-highlight-color: transparent;
  outline: none;
}

body {
  font-family: Arial, sans-serif;
  color: var(--dark);
  padding: 10px;
}

header {
  background: var(--primary);
  color: #fff;
  padding: 15px;
  text-align: center;
  margin-bottom: 10px;
}

section {
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 6px;
  margin-bottom: 20px;
  padding: 15px;
}

.row-inline {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 10px;
}

label {
  font-weight: bold;
}

input,
select,
button {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

button {
  background: var(--primary);
  color: #fff;
  cursor: pointer;
}

button:hover {
  opacity: 0.9;
}

button.save {
  background: var(--success);
}

button.small {
  background: var(--info);
  padding: 4px 8px;
  font-size: 0.9em;
}

.hidden {
  display: none;
}

.table-wrapper {
  overflow-x: auto;
  margin-top: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.table-wrapper.saved {
  border: 2px solid var(--success);
  background: var(--light);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border: 1px solid #ccc;
  padding: 8px;
  white-space: nowrap;
  text-align: left;
}

th {
  background: var(--light);
}

.table-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.attendance-item {
  font-weight: bold;
  margin-bottom: 5px;
}

.attendance-item + .attendance-actions {
  display: flex;
  gap: 5px;
  margin-bottom: 15px;
}

.att-btn {
  flex: 1;
  padding: 8px;
  border: 1px solid #ccc;
  background: transparent;
  color: var(--dark);
  font-weight: bold;
}

.table-container {
  overflow-x: auto;
  margin-top: 15px;
}

.summary-block {
  margin-top: 15px;
}

.graph-container {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-top: 15px;
}

canvas {
  flex: 1 1 300px;
  max-width: 100%;
}

.selected {
  background: var(--light);
}

.editing {
  outline: 2px dashed var(--info);
}

.select-col {
  width: 40px;
}

#registerTableWrapper {
  overflow-x: auto;
  margin-top: 10px;
}

#registerTable thead th {
  position: sticky;
  top: 0;
  background: var(--light);
  z-index: 1;
}

#register-section .row-inline > * {
  margin-right: 8px;
}

.attendance-actions .att-btn {
  flex: 1;
  padding: 8px;
  border: 1px solid #ccc;
  background: transparent;
  color: var(--dark);
  font-weight: bold;
  font-size: 1em;
}

#pieChart {
  aspect-ratio: 1 / 1;
}

/* Toast notifications */
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 12px 24px;
  border-radius: 4px;
  color: white;
  z-index: 1000;
  animation: fadeInOut 3s ease-in-out;
}
.toast-info { background-color: var(--info); }
.toast-success { background-color: var(--success); }
.toast-warning { background-color: var(--warning); color: #333; }
.toast-error { background-color: var(--danger); }
@keyframes fadeInOut {
  0%, 100% { opacity: 0; transform: translateY(20px); }
  10%, 90% { opacity: 1; transform: translateY(0); }
}

/* Attendance stats */
.attendance-stats {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  margin: 15px 0;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
}
.stat-present { color: var(--success); font-weight: bold; }
.stat-absent { color: var(--danger); font-weight: bold; }
.stat-late { color: var(--warning); font-weight: bold; }
.stat-halfday { color: var(--orange); font-weight: bold; }
.stat-leave { color: var(--info); font-weight: bold; }

.danger {
  background-color: var(--danger);
}

@media (max-width: 600px) {
  .row-inline input,
  .row-inline select,
  .row-inline button {
    flex: 1 1 100%;
  }
  
  .attendance-stats {
    gap: 8px;
    font-size: 0.9em;
  }
  
  .row-inline {
    flex-direction: column;
    align-items: stretch;
  }
  
  .row-inline > * {
    margin-bottom: 8px;
  }
}
// Continuing from the previous code - adding more features to app.js

// ========================================================================
// 6. STUDENT ATTENDANCE HISTORY VIEWER
// ========================================================================
const historySection = document.createElement('section');
historySection.id = 'history-section';
historySection.innerHTML = `
  <h2>Student Attendance History</h2>
  <div class="row-inline">
    <input id="historyAdmInput" placeholder="Enter Adm#">
    <button type="button" id="loadHistory">Load History</button>
    <button type="button" id="downloadHistoryPDF" class="hidden">Download PDF</button>
  </div>
  <div class="table-wrapper hidden" id="historyTableWrapper">
    <table id="historyTable">
      <thead>
        <tr>
          <th>Date</th>
          <th>Day</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody id="historyBody"></tbody>
    </table>
  </div>
  <div id="historySummary" class="hidden">
    <h3>Summary</h3>
    <div class="attendance-stats" id="historyStats"></div>
  </div>
`;
document.body.insertBefore(historySection, $('backup-section'));

$('loadHistory').onclick = () => {
  const adm = $('historyAdmInput').value.trim();
  if (!adm) {
    showToast('Please enter admission number', 'error');
    return;
  }

  const student = students.find(s => s.adm === adm);
  if (!student) {
    showToast(`No student found with admission #${adm}`, 'error');
    return;
  }

  const historyBody = $('historyBody');
  historyBody.innerHTML = '';
  
  const stats = { P: 0, A: 0, Lt: 0, HD: 0, L: 0, total: 0 };
  const sortedDates = Object.keys(attendanceData).sort();
  
  sortedDates.forEach(date => {
    const code = attendanceData[date][student.roll] || 'A';
    if (code) {
      stats[code]++;
      stats.total++;
      
      const tr = document.createElement('tr');
      const day = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
      tr.innerHTML = `
        <td>${new Date(date).toLocaleDateString()}</td>
        <td>${day}</td>
        <td style="background: ${colors[code]}; color: white">${code}</td>
      `;
      historyBody.appendChild(tr);
    }
  });

  // Update stats display
  const historyStats = $('historyStats');
  historyStats.innerHTML = `
    <div><span class="stat-present">${stats.P} Present</span></div>
    <div><span class="stat-absent">${stats.A} Absent</span></div>
    <div><span class="stat-late">${stats.Lt} Late</span></div>
    <div><span class="stat-halfday">${stats.HD} Half Day</span></div>
    <div><span class="stat-leave">${stats.L} Leave</span></div>
    <div><strong>${stats.total} Total</strong></div>
    <div><strong>${stats.total ? ((stats.P / stats.total) * 100).toFixed(1) : '0'}%</strong> Overall</div>
  `;

  $('historyTableWrapper').classList.remove('hidden');
  $('historySummary').classList.remove('hidden');
  $('downloadHistoryPDF').classList.remove('hidden');
  showToast(`Attendance history loaded for ${student.name}`, 'success');
};

$('downloadHistoryPDF').onclick = () => {
  const adm = $('historyAdmInput').value.trim();
  const student = students.find(s => s.adm === adm);
  if (!student) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  doc.setFontSize(16);
  doc.text('Student Attendance History', 10, 10);
  doc.setFontSize(12);
  doc.text(`Name: ${student.name}`, 10, 20);
  doc.text(`Adm#: ${student.adm}`, 10, 26);
  doc.text(`School: ${localStorage.getItem('schoolName')}`, 10, 32);
  doc.text(`Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`, 10, 38);

  // History table
  doc.autoTable({
    html: '#historyTable',
    startY: 44,
    styles: { fontSize: 8 }
  });

  // Stats summary
  const stats = $('historyStats');
  const y = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(14);
  doc.text('Summary Statistics', 10, y);
  doc.setFontSize(12);
  
  const statsText = [
    `Present: ${stats.querySelector('.stat-present').textContent}`,
    `Absent: ${stats.querySelector('.stat-absent').textContent}`,
    `Late: ${stats.querySelector('.stat-late').textContent}`,
    `Half Day: ${stats.querySelector('.stat-halfday').textContent}`,
    `Leave: ${stats.querySelector('.stat-leave').textContent}`,
    `Total: ${stats.querySelector('strong').textContent}`,
    `Overall: ${stats.querySelectorAll('strong')[1].textContent}`
  ];
  
  statsText.forEach((text, i) => {
    doc.text(text, 10, y + 10 + (i * 6));
  });

  doc.save(`attendance_history_${student.adm}.pdf`);
};

// ========================================================================
// 7. BULK ATTENDANCE OPERATIONS
// ========================================================================
const bulkSection = document.createElement('section');
bulkSection.id = 'bulk-section';
bulkSection.innerHTML = `
  <h2>Bulk Attendance Operations</h2>
  <div class="row-inline">
    <label for="bulkDateRange">Date Range:</label>
    <input type="date" id="bulkStartDate">
    <span>to</span>
    <input type="date" id="bulkEndDate">
  </div>
  <div class="row-inline">
    <label for="bulkStatus">Set Status:</label>
    <select id="bulkStatus">
      <option value="P">Present</option>
      <option value="A">Absent</option>
      <option value="Lt">Late</option>
      <option value="HD">Half Day</option>
      <option value="L">Leave</option>
    </select>
    <button type="button" id="applyBulk">Apply to All Students</button>
  </div>
  <div class="row-inline">
    <button type="button" id="clearBulkRange">Clear Attendance in Range</button>
  </div>
`;
document.body.insertBefore(bulkSection, $('backup-section'));

// Set default dates (current week)
const today = new Date();
const startOfWeek = new Date(today);
startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
$('bulkStartDate').valueAsDate = startOfWeek;
$('bulkEndDate').valueAsDate = today;

$('applyBulk').onclick = () => {
  const startDate = $('bulkStartDate').value;
  const endDate = $('bulkEndDate').value;
  const status = $('bulkStatus').value;
  
  if (!startDate || !endDate) {
    showToast('Please select date range', 'error');
    return;
  }
  
  if (new Date(startDate) > new Date(endDate)) {
    showToast('End date must be after start date', 'error');
    return;
  }
  
  if (!confirm(`Set all students to ${status} from ${startDate} to ${endDate}?`)) {
    return;
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  let daysProcessed = 0;
  
  // Iterate through each day in range
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (!attendanceData[dateStr]) {
      attendanceData[dateStr] = {};
    }
    
    // Set status for all students
    students.forEach(student => {
      attendanceData[dateStr][student.roll] = status;
    });
    
    daysProcessed++;
  }
  
  localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
  showToast(`Updated ${daysProcessed} days for ${students.length} students`, 'success');
};

$('clearBulkRange').onclick = () => {
  const startDate = $('bulkStartDate').value;
  const endDate = $('bulkEndDate').value;
  
  if (!startDate || !endDate) {
    showToast('Please select date range', 'error');
    return;
  }
  
  if (new Date(startDate) > new Date(endDate)) {
    showToast('End date must be after start date', 'error');
    return;
  }
  
  if (!confirm(`Clear attendance records from ${startDate} to ${endDate}?`)) {
    return;
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  let daysCleared = 0;
  
  // Iterate through each day in range
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (attendanceData[dateStr]) {
      delete attendanceData[dateStr];
      daysCleared++;
    }
  }
  
  localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
  showToast(`Cleared ${daysCleared} days of attendance records`, 'success');
};

// ========================================================================
// 8. DATA IMPORT/EXPORT ENHANCEMENTS
// ========================================================================
// Enhanced backup section with CSV import/export
$('backup-section').innerHTML += `
  <div class="row-inline" style="margin-top: 15px;">
    <button id="exportCSV">Export as CSV</button>
    <button id="importCSV">Import CSV</button>
    <input type="file" id="csvFileInput" accept=".csv" style="display: none;">
  </div>
`;

$('exportCSV').on
