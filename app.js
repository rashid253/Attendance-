<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Classwise Attendance Management</title>

  <!-- PWA manifest & meta -->
  <link rel="manifest" href="manifest.json" />
  <meta name="theme-color" content="#2196F3" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="application-name" content="Attendance Mgmt" />

  <!-- Font Awesome -->
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
    crossorigin="anonymous"
    referrerpolicy="no-referrer"
  />

  <!-- jsPDF + AutoTable -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js"></script>

  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

  <!-- idb-keyval IIFE -->
  <script src="https://cdn.jsdelivr.net/npm/idb-keyval@3/dist/idb-keyval-iife.min.js"></script>

  <!-- Main CSS -->
  <link rel="stylesheet" href="style.css" />

  <!-- Print-media rule to hide icons in PDF/print -->
  <style>
    @media print {
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1><i class="fas fa-school"></i> Attendance Management</h1>
  </header>

  <!-- SETTINGS -->
  <section id="settings-section">
    <h2><i class="fas fa-cog"></i> Settings (Optional)</h2>
    <div class="row-inline">
      <label>Fine per Absent (₹): <input type="number" id="fineAbsent" /></label>
      <label>Fine per Late (₹):   <input type="number" id="fineLate" /></label>
      <label>Fine per Leave (₹):  <input type="number" id="fineLeave" /></label>
      <label>Fine per Half-Day (₹):<input type="number" id="fineHalfDay"/></label>
      <label>Eligibility % Threshold: <input type="number" id="eligibilityPct" min="0" max="100"/></label>
      <button id="saveSettings"><i class="fas fa-save"></i> Save Settings</button>
    </div>
  </section>

  <!-- PAYMENT MODAL -->
  <div id="paymentModal" class="modal hidden">
    <div class="modal-content">
      <h3>Record Payment for Adm# <span id="payAdm"></span></h3>
      <label>Amount (₹): <input type="number" id="paymentAmount" /></label>
      <div class="modal-actions">
        <button id="savePayment"><i class="fas fa-check"></i> Save</button>
        <button id="cancelPayment"><i class="fas fa-times"></i> Cancel</button>
      </div>
    </div>
  </div>

  <!-- 1. Setup -->
  <section id="teacher-setup">
    <h2><i class="fas fa-cog"></i> Setup</h2>
    <div id="setupForm" class="row-inline">
      <input id="schoolNameInput" placeholder="School Name" />
      <select id="teacherClassSelect">
        <option disabled selected value="">-- Select Class --</option>
        <option>Play Group</option><option>Nursery</option><option>KG</option><option>Prep</option>
        <option>Class One</option><option>Class Two</option><option>Class Three</option>
        <!-- etc. -->
      </select>
      <select id="teacherSectionSelect">
        <option disabled selected value="">-- Select Section --</option>
        <option>A</option><option>B</option><option>C</option>
      </select>
      <button id="saveSetup"><i class="fas fa-save"></i> Save</button>
    </div>
    <div id="setupDisplay" class="hidden">
      <h3>
        <i class="fas fa-school no-print"></i>
        <span id="setupText"></span>
      </h3>
      <button id="editSetup"><i class="fas fa-edit"></i> Edit</button>
    </div>
  </section>

  <!-- 2. Counters -->
  <section id="animatedCounters" class="counter-grid">
    <div class="counter-card">
      <span id="sectionCount" class="number" data-target="0">0</span>
      <div>Section Students</div>
    </div>
    <div class="counter-card">
      <span id="classCount" class="number" data-target="0">0</span>
      <div>Class Students</div>
    </div>
    <div class="counter-card">
      <span id="schoolCount" class="number" data-target="0">0</span>
      <div>School Students</div>
    </div>
  </section>

  <!-- 3. Student Registration -->
  <section id="student-registration">
    <h2><i class="fas fa-user-graduate"></i> Student Registration</h2>
    <div class="row-inline">
      <input id="studentName" placeholder="Name" />
      <input id="parentName" placeholder="Parent Name" />
      <input id="parentContact" placeholder="Parent Contact" />
      <input id="parentOccupation" placeholder="Occupation" />
      <input id="parentAddress" placeholder="Address" />
      <button id="addStudent"><i class="fas fa-plus-circle"></i> Add</button>
    </div>
    <div class="table-wrapper">
      <table id="studentsTable">
        <thead>
          <tr>
            <th><input type="checkbox" id="selectAllStudents"/></th>
            <th>#</th><th>Name</th><th>Adm#</th><th>Parent</th>
            <th>Contact</th><th>Occupation</th><th>Address</th>
            <th>Fine (₹)</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="studentsBody"></tbody>
      </table>
    </div>
    <div class="table-actions">
      <button id="editSelected" disabled><i class="fas fa-edit"></i> Edit</button>
      <button id="doneEditing" class="hidden"><i class="fas fa-check"></i> Done</button>
      <button id="deleteSelected" disabled><i class="fas fa-trash"></i> Delete</button>
      <button id="saveRegistration"><i class="fas fa-save"></i> Save</button>
      <button id="editRegistration" class="hidden"><i class="fas fa-undo"></i> Restore</button>
      <button id="shareRegistration" class="hidden"><i class="fas fa-share-alt"></i> Share All</button>
      <button id="downloadRegistrationPDF" class="hidden"><i class="fas fa-download"></i> Download</button>
    </div>
  </section>

  <!-- 4. Mark Attendance -->
  <section id="attendance-section">
    <h2><i class="fas fa-calendar-check"></i> Mark Attendance</h2>
    <div id="attendanceForm">
      <!-- ... form to mark attendance -->
      <table id="attendanceTable">
        <thead>
          <tr>
            <th>Student Name</th><th>Present</th><th>Absent</th><th>Leave</th><th>Late</th>
          </tr>
        </thead>
        <tbody id="attendanceBody"></tbody>
      </table>
      <button id="saveAttendance"><i class="fas fa-save"></i> Save Attendance</button>
    </div>
  </section>

  <!-- 5. Analytics -->
  <section id="analytics-section">
    <h2><i class="fas fa-chart-bar"></i> Analytics</h2>
    <div id="attendanceChartContainer">
      <canvas id="attendanceChart"></canvas>
    </div>
    <button id="generateAnalyticsPDF"><i class="fas fa-download"></i> Download Report</button>
  </section>

  <!-- 6. Attendance Register -->
  <section id="register-section">
    <h2><i class="fas fa-book"></i> Attendance Register</h2>
    <div class="row-inline">
      <select id="classSelect">
        <option>Select Class</option>
        <option>Class One</option><option>Class Two</option><option>Class Three</option>
      </select>
      <select id="sectionSelect">
        <option>Select Section</option>
        <option>A</option><option>B</option><option>C</option>
      </select>
      <button id="viewRegister"><i class="fas fa-eye"></i> View</button>
    </div>
    <div id="registerTableWrapper" class="hidden">
      <table id="attendanceRegisterTable">
        <thead>
          <tr>
            <th>Name</th><th>Status</th><th>Fine</th><th>Remarks</th>
          </tr>
        </thead>
        <tbody id="registerTableBody"></tbody>
      </table>
    </div>
  </section>

  <script src="app.js"></script>
</body>
</html>
