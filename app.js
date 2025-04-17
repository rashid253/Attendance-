<!-- index.html (unchanged) -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Classwise Attendance Management</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header>
    <h1 id="appTitle">Attendance Management</h1>
  </header>

  <!-- Teacher & School Setup -->
  <section id="teacher-setup">
    <h2>Setup</h2>
    <div id="setupForm">
      <div class="row-inline">
        <input type="text" id="schoolNameInput" placeholder="Your School Name" />
        <label for="teacherClassSelect">Class:</label>
        <select id="teacherClassSelect">
          <option value="">--Class--</option>
          <option>One</option><option>Two</option><option>Three</option>
        </select>
        <label for="teacherSectionSelect">Section:</label>
        <select id="teacherSectionSelect">
          <option value="">--Section--</option>
          <option>A</option><option>B</option><option>C</option>
        </select>
        <button id="saveSetup" type="button">Save</button>
      </div>
    </div>
    <div id="setupDisplay" class="hidden">
      <p><strong>School:</strong> <span id="dispSchool"></span></p>
      <p><strong>Class‑Section:</strong> <span id="dispClass"></span>‑<span id="dispSection"></span></p>
      <button id="editSetup" class="small">Edit</button>
    </div>
  </section>

  <!-- Student Registration -->
  <section id="student-registration">
    <h2>Student Registration</h2>
    <div class="row-inline">
      <input type="text" id="studentName" placeholder="Name" />
      <input type="text" id="admissionNo" placeholder="Admission No (opt)" />
      <input type="text" id="parentContact" placeholder="Parent Contact" />
      <button id="addStudent">Add</button>
    </div>
    <ul id="students"></ul>
    <button id="deleteAllStudents" class="small">Delete All</button>
  </section>

  <!-- Attendance Marking -->
  <section id="attendance-section">
    <h2>Mark Attendance</h2>
    <div class="row-inline">
      <input type="date" id="dateInput" />
      <button id="loadAttendance">Load</button>
    </div>
    <div id="attendanceList"></div>
    <button id="saveAttendance">Save Attendance</button>
  </section>

  <!-- Attendance Summary -->
  <section id="attendance-result" class="hidden">
    <h2>Attendance Summary</h2>
    <ul id="attendanceResultList" class="attendance-summary"></ul>
    <div class="row-inline">
      <button id="editAttendanceBtn" class="small">Edit</button>
      <button id="shareAttendanceBtn" class="small">Share</button>
      <button id="downloadAttendanceBtn" class="small">Download</button>
    </div>
  </section>

  <!-- Analytics -->
  <section id="analytics-section">
    <h2>Analytics</h2>
    <div class="row-inline">
      <select id="analyticsType">
        <option value="date">Specific Date</option>
        <option value="month">Month</option>
        <option value="semester">Semester</option>
        <option value="sixmonths">6 Months</option>
        <option value="year">Year</option>
      </select>
      <input type="date" id="analyticsDate" class="hidden" />
      <input type="month" id="analyticsMonth" class="hidden" />
      <select id="studentFilter"><option value="">All Students</option></select>
      <select id="representationType">
        <option value="table">Table</option>
        <option value="summary">Summary</option>
        <option value="graph">Graph</option>
        <option value="all">All</option>
      </select>
      <button id="loadAnalytics">Load</button>
      <button id="resetAnalyticsBtn" class="small hidden">Change Period</button>
    </div>
    <div id="analyticsContainer" class="table-container"></div>
  </section>

  <!-- libs -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="app.js"></script>
</body>
</html>
