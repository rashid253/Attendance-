document.addEventListener("DOMContentLoaded", function() {
  // Student Registration Elements
  const rollNumberInput = document.getElementById('rollNumber');
  const studentNameInput = document.getElementById('studentName');
  const studentClassInput = document.getElementById('studentClass');
  const addStudentBtn = document.getElementById('addStudent');
  const studentsListEl = document.getElementById('students');
  
  // Attendance Elements
  const dateInput = document.getElementById('dateInput');
  const filterClassSelect = document.getElementById('filterClass');
  const loadAttendanceBtn = document.getElementById('loadAttendance');
  const attendanceListEl = document.getElementById('attendanceList');
  const saveAttendanceBtn = document.getElementById('saveAttendance');
  
  // Report Elements
  const exportPdfBtn = document.getElementById('exportPdf');
  
  // Retrieve data from localStorage or initialize new data structures
  let students = JSON.parse(localStorage.getItem('students')) || []; 
  // students: array of objects: { roll, name, class }
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || {};
  // attendanceData structure: { date: { rollNumber: status } }
  
  // Function to update the student list UI and update filter dropdown with classes
  function renderStudents() {
    studentsListEl.innerHTML = "";
    let classesSet = new Set();
    
    students.forEach((student, index) => {
      classesSet.add(student.class);
      
      const li = document.createElement('li');
      li.textContent = `${student.roll} - ${student.name} (${student.class}) `;
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = "Delete";
      deleteBtn.onclick = function() {
        students.splice(index, 1);
        localStorage.setItem('students', JSON.stringify(students));
        renderStudents();
        populateFilterClasses();
      };
      li.appendChild(deleteBtn);
      studentsListEl.appendChild(li);
    });
    populateFilterClasses();
    // populateFilterClasses uses the classesSet from current students.
  }
  
  // Populate filter dropdown based on available classes
  function populateFilterClasses() {
    // Start with All option
    let classes = ["all"];
    students.forEach(student => {
      if(!classes.includes(student.class)) {
        classes.push(student.class);
      }
    });
    // Clear and update select element
    filterClassSelect.innerHTML = "";
    classes.forEach(cls => {
      const option = document.createElement('option');
      option.value = cls;
      option.textContent = cls;
      filterClassSelect.appendChild(option);
    });
  }
  
  // Add Student button click event
  addStudentBtn.addEventListener('click', function() {
    const roll = rollNumberInput.value.trim();
    const name = studentNameInput.value.trim();
    const cls = studentClassInput.value.trim();
    
    if(roll && name && cls) {
      // Check for duplicate roll number (optional)
      if(students.find(student => student.roll === roll)) {
        alert("Roll Number already exists!");
        return;
      }
      students.push({ roll, name, class: cls });
      localStorage.setItem('students', JSON.stringify(students));
      rollNumberInput.value = "";
      studentNameInput.value = "";
      studentClassInput.value = "";
      renderStudents();
    } else {
      alert("Please fill all fields.");
    }
  });
  
  // Render attendance for the selected date and class filter
  function renderAttendanceForDate(date, filterClass) {
    attendanceListEl.innerHTML = "";
    // Filter the students list if a particular class is selected
    let filteredStudents = students;
    if(filterClass !== "all") {
      filteredStudents = students.filter(student => student.class === filterClass);
    }
    // Get attendance for date if exists, else initialize a new object
    let attendanceForDate = attendanceData[date] || {};
    
    filteredStudents.forEach(student => {
      const div = document.createElement('div');
      div.classList.add('attendance-item');
      
      // Label showing roll, name & class
      const label = document.createElement('label');
      label.textContent = `${student.roll} - ${student.name} (${student.class})`;
      
      // Dropdown to select attendance status
      const select = document.createElement('select');
      // Add default blank option
      let defaultOpt = document.createElement('option');
      defaultOpt.value = "";
      defaultOpt.textContent = "--Select--";
      select.appendChild(defaultOpt);
      
      // Options: Present, Absent, Late, Leave
      const statuses = [
        { value: "P", text: "Present" },
        { value: "A", text: "Absent" },
        { value: "L", text: "Late" },
        { value: "Le", text: "Leave" }
      ];
      
      statuses.forEach(status => {
        const opt = document.createElement('option');
        opt.value = status.value;
        opt.textContent = status.text;
        select.appendChild(opt);
      });
      
      // Preselect value if attendance already exists
      if(attendanceForDate[student.roll]) {
        select.value = attendanceForDate[student.roll];
      }
      
      // When selection changes, update attendance object
      select.addEventListener('change', function() {
        attendanceForDate[student.roll] = this.value;
      });
      
      div.appendChild(label);
      div.appendChild(select);
      attendanceListEl.appendChild(div);
    });
    // Update attendanceData object for the date
    attendanceData[date] = attendanceForDate;
  }
  
  // Load Attendance button event
  loadAttendanceBtn.addEventListener('click', function() {
    const date = dateInput.value;
    if(!date) {
      alert("Please select a date.");
      return;
    }
    const filterClass = filterClassSelect.value;
    renderAttendanceForDate(date, filterClass);
  });
  
  // Save Attendance button event
  saveAttendanceBtn.addEventListener('click', function() {
    const date = dateInput.value;
    if(!date) {
      alert("Please select a date.");
      return;
    }
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    alert(`Attendance saved for ${date}`);
  });
  
  // PDF Export button event
  exportPdfBtn.addEventListener('click', function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const date = dateInput.value;
    if(!date) {
      alert("Please select a date for the report.");
      return;
    }
    doc.text("Attendance Report for " + date, 10, 10);
    let y = 20;
    let attendanceForDate = attendanceData[date] || {};
    
    // List all students (not applying class filter in report; can adjust if needed)
    students.forEach(student => {
      const status = attendanceForDate[student.roll] || "Not Marked";
      doc.text(`${student.roll} - ${student.name} (${student.class}): ${status}`, 10, y);
      y += 10;
    });
    doc.save("attendance_" + date + ".pdf");
  });
  
  // ابتدائی رینڈر
  renderStudents();
});
