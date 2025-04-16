document.addEventListener("DOMContentLoaded", function() {
  // Allowed classes list
  const allowedClasses = [
    "Play Group", "Nursery", "Prep", "Pre One",
    "One", "Two", "Three", "Four", "Five",
    "Six", "Seven", "Eight", "Nine", "Ten"
  ];

  // Check if teacher's class is already set in localStorage; if not, prompt teacher to enter one
  let teacherClass = localStorage.getItem('teacherClass');
  if (!teacherClass) {
    teacherClass = prompt("Enter your Class (" + allowedClasses.join(", ") + "):", "");
    if (!teacherClass || !allowedClasses.includes(teacherClass)) {
      alert("Invalid Class! Please reload and enter a valid class.");
      return;
    }
    localStorage.setItem('teacherClass', teacherClass);
  }

  // Update teacher class display in various sections
  document.getElementById('teacherClassDisplay').textContent = teacherClass;
  document.getElementById('teacherClassDisplayRegistration').textContent = teacherClass;
  document.getElementById('teacherClassDisplayAttendance').textContent = teacherClass;

  // Student Registration Elements
  const studentNameInput = document.getElementById('studentName');
  const addStudentBtn = document.getElementById('addStudent');
  const studentsListEl = document.getElementById('students');

  // Attendance Elements
  const dateInput = document.getElementById('dateInput');
  const loadAttendanceBtn = document.getElementById('loadAttendance');
  const attendanceListEl = document.getElementById('attendanceList');
  const saveAttendanceBtn = document.getElementById('saveAttendance');

  // Report Elements
  const exportPdfBtn = document.getElementById('exportPdf');

  // Retrieve data from localStorage or initialize new data structures
  let students = JSON.parse(localStorage.getItem('students')) || [];
  // students: array of objects: { roll, name, class }
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || {};
  // attendanceData structure: { date: { roll: status } }

  // Function: Generate Roll Number automatically for teacher's class
  function generateRollNumber(cls) {
    const classStudents = students.filter(student => student.class === cls);
    if(classStudents.length === 0) {
      return 1;
    }
    let maxRoll = Math.max(...classStudents.map(s => parseInt(s.roll, 10)));
    return maxRoll + 1;
  }

  // Render student list (only showing students from teacher's class)
  function renderStudents() {
    studentsListEl.innerHTML = "";
    const classStudents = students.filter(student => student.class === teacherClass);
    classStudents.forEach((student, index) => {
      const li = document.createElement('li');
      li.textContent = `${student.roll} - ${student.name} (${student.class})`;

      // Action Buttons for Edit/Delete
      const actionsDiv = document.createElement('div');
      actionsDiv.classList.add("action-buttons");

      // Edit button
      const editBtn = document.createElement('button');
      editBtn.textContent = "Edit";
      editBtn.addEventListener('click', function() {
        let newName = prompt("Enter new name:", student.name);
        if(newName !== null && newName.trim() !== "") {
          // Update student name in overall students array (find by roll and class)
          const idx = students.findIndex(s => s.roll === student.roll && s.class === teacherClass);
          if(idx !== -1) {
            students[idx].name = newName.trim();
            localStorage.setItem('students', JSON.stringify(students));
            renderStudents();
          }
        }
      });

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener('click', function() {
        if(confirm(`Delete ${student.name}?`)) {
          // Remove student from overall students array
          students = students.filter(s => !(s.roll === student.roll && s.class === teacherClass));
          localStorage.setItem('students', JSON.stringify(students));
          renderStudents();
        }
      });

      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(deleteBtn);
      li.appendChild(actionsDiv);
      studentsListEl.appendChild(li);
    });
  }

  // Add Student button event: teacher can only add students to his/her class
  addStudentBtn.addEventListener('click', function() {
    const name = studentNameInput.value.trim();
    if(name) {
      const roll = generateRollNumber(teacherClass);
      students.push({ roll, name, class: teacherClass });
      localStorage.setItem('students', JSON.stringify(students));
      studentNameInput.value = "";
      renderStudents();
    } else {
      alert("Please enter student name.");
    }
  });

  // Render attendance for the selected date for teacher's class only
  function renderAttendanceForDate(date) {
    attendanceListEl.innerHTML = "";
    // Filter students: only teacher's class
    const classStudents = students.filter(student => student.class === teacherClass);
    let attendanceForDate = attendanceData[date] || {};

    classStudents.forEach(student => {
      const div = document.createElement('div');
      div.classList.add('attendance-item');

      const label = document.createElement('label');
      label.textContent = `${student.roll} - ${student.name} (${student.class})`;

      // Dropdown for attendance status options
      const select = document.createElement('select');
      // Default option
      const defaultOpt = document.createElement('option');
      defaultOpt.value = "";
      defaultOpt.textContent = "--Select--";
      select.appendChild(defaultOpt);

      // Options: P (Present), A (Absent), L (Late), Le (Leave)
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

      // Set previously saved status if exists
      if(attendanceForDate[student.roll]) {
        select.value = attendanceForDate[student.roll];
      }

      select.addEventListener('change', function() {
        attendanceForDate[student.roll] = this.value;
      });

      div.appendChild(label);
      div.appendChild(select);
      attendanceListEl.appendChild(div);
    });
    attendanceData[date] = attendanceForDate;
  }

  // Load Attendance button event
  loadAttendanceBtn.addEventListener('click', function() {
    const date = dateInput.value;
    if(!date) {
      alert("Please select a date.");
      return;
    }
    renderAttendanceForDate(date);
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

  // PDF Export button event (Report contains only teacher's class students)
  exportPdfBtn.addEventListener('click', function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const date = dateInput.value;
    if(!date) {
      alert("Please select a date for the report.");
      return;
    }
    doc.text("Attendance Report for " + date + " (Class " + teacherClass + ")", 10, 10);
    let y = 20;
    let attendanceForDate = attendanceData[date] || {};
    const classStudents = students.filter(student => student.class === teacherClass);
    classStudents.forEach(student => {
      const status = attendanceForDate[student.roll] || "Not Marked";
      doc.text(`${student.roll} - ${student.name}: ${status}`, 10, y);
      y += 10;
    });
    doc.save("attendance_" + date + ".pdf");
  });

  // Initial render
  renderStudents();
});
