window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const THRESHOLD = 75;
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };
  
  // Initialize data stores
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  let attendanceData = JSON.parse(localStorage.getItem('attendance') || '{}');

  // ================= SETUP SECTION =================
  const setupForm = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText = $('setupText');
  const saveSetup = $('saveSetup');
  const editSetup = $('editSetup');

  // Initialize setup form
  function initSetup() {
    const savedSchool = localStorage.getItem('schoolName');
    if(savedSchool) {
      $('schoolNameInput').value = savedSchool;
      $('teacherClassSelect').value = localStorage.getItem('teacherClass') || '';
      $('teacherSectionSelect').value = localStorage.getItem('teacherSection') || '';
      toggleSetupDisplay(true);
    }
  }

  function toggleSetupDisplay(saved) {
    setupForm.classList.toggle('hidden', saved);
    setupDisplay.classList.toggle('hidden', !saved);
    if(saved) {
      setupText.textContent = `${localStorage.getItem('schoolName')} - ${localStorage.getItem('teacherClass')} ${localStorage.getItem('teacherSection')}`;
    }
  }

  saveSetup.addEventListener('click', () => {
    const school = $('schoolNameInput').value.trim();
    const className = $('teacherClassSelect').value;
    const section = $('teacherSectionSelect').value;

    if(!school || !className || !section) {
      alert('Please fill all setup fields');
      return;
    }

    localStorage.setItem('schoolName', school);
    localStorage.setItem('teacherClass', className);
    localStorage.setItem('teacherSection', section);
    toggleSetupDisplay(true);
  });

  editSetup.addEventListener('click', () => toggleSetupDisplay(false));
  initSetup();

  // ================= STUDENT REGISTRATION =================
  // ... [Keep the original student registration code here] ...
  // (Ensure all original student registration code is present)

  // ================= ATTENDANCE MARKING =================
  const dateInput = $('dateInput');
  const loadAttendance = $('loadAttendance');
  const saveAttendance = $('saveAttendance');
  const attendanceList = $('attendanceList');

  function createAttendanceItem(student) {
    const div = document.createElement('div');
    div.className = 'attendance-item';
    div.innerHTML = `
      <span>${student.name} (${student.adm})</span>
      <div class="attendance-actions">
        ${Object.entries(colors).map(([status, color]) => `
          <button class="att-btn" 
            data-status="${status}"
            style="background: ${color}">
            ${status}
          </button>
        `).join('')}
      </div>
    `;
    return div;
  }

  loadAttendance.addEventListener('click', () => {
    if(!dateInput.value) return alert('Please select a date');
    if(students.length === 0) return alert('No students registered');
    
    attendanceList.innerHTML = '';
    students.forEach(student => {
      const item = createAttendanceItem(student);
      const buttons = item.querySelectorAll('.att-btn');
      const currentStatus = attendanceData[dateInput.value]?.[student.adm] || 'A';
      
      buttons.forEach(btn => {
        if(btn.dataset.status === currentStatus) btn.classList.add('selected');
        
        btn.addEventListener('click', () => {
          buttons.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          updateAttendance(student.adm, btn.dataset.status);
        });
      });
      
      attendanceList.appendChild(item);
    });
    
    saveAttendance.classList.remove('hidden');
    $('attendance-result').classList.remove('hidden');
  });

  function updateAttendance(adm, status) {
    const dateKey = dateInput.value;
    if(!attendanceData[dateKey]) attendanceData[dateKey] = {};
    attendanceData[dateKey][adm] = status;
    localStorage.setItem('attendance', JSON.stringify(attendanceData));
  }

  saveAttendance.addEventListener('click', () => {
    renderAttendanceSummary();
    saveAttendance.classList.add('hidden');
    alert('Attendance saved successfully!');
  });

  // ================= ATTENDANCE SUMMARY =================
  function renderAttendanceSummary() {
    const summaryBody = $('summaryBody');
    const dateKey = dateInput.value;
    summaryBody.innerHTML = '';

    students.forEach(student => {
      const status = attendanceData[dateKey]?.[student.adm] || 'A';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${student.name}</td>
        <td style="color: ${colors[status]}">${status}</td>
        <td>
          <button class="small" onclick="shareIndividualAttendance('${student.adm}')">
            Send
          </button>
        </td>
      `;
      summaryBody.appendChild(row);
    });
  }

  window.shareIndividualAttendance = (adm) => {
    const student = students.find(s => s.adm === adm);
    const date = dateInput.value;
    const status = attendanceData[date]?.[adm] || 'A';
    const message = `Attendance Update\n\nDate: ${date}\nStudent: ${student.name}\nAdmission #: ${adm}\nStatus: ${status}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  // ================= ANALYTICS SECTION =================
  // ... [Include the working analytics code from previous answer] ...
  // (Ensure complete analytics implementation from previous response)

  // Initialize Chart.js
  if(typeof Chart !== 'undefined') {
    Chart.defaults.font.family = 'Arial, sans-serif';
    Chart.defaults.color = '#333';
  }
});
