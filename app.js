document.addEventListener("DOMContentLoaded", function() {
  // Student Registration Elements
  const studentNameInput = document.getElementById('studentName');
  const studentClassSelect = document.getElementById('studentClass');
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
  // attendanceData structure: { date: { roll: status } }

  // Function: Roll Number خودکار جاری کرنے کے لیے –
  // ہر کلاس کے لیے موجودہ زیادہ سے زیادہ roll number دیکھ کر اگلا نمبر دیا جائے گا
  function generateRollNumber(cls) {
    const classStudents = students.filter(student => student.class === cls);
    if(classStudents.length === 0) {
      return 1;
    }
    let maxRoll = Math.max(...classStudents.map(s => parseInt(s.roll, 10)));
    return maxRoll + 1;
  }

  // Function to render student list with editing option
  function renderStudents() {
    studentsListEl.innerHTML = "";
    students.forEach((student, index) => {
      const li = document.createElement('li');
      li.textContent = `${student.roll} - ${student.name} (${student.class})`;
      
      // Container for Edit/Delete buttons
      const actionsDiv = document.createElement('div');
      actionsDiv.classList.add("action-buttons");

      // Edit button: change student name
      const editBtn = document.createElement('button');
      editBtn.textContent = "Edit";
      editBtn.addEventListener('click', function() {
        let newName = prompt("Enter new name:", student.name);
        if(newName !== null && newName.trim() !== "") {
          student.name = newName.trim();
          localStorage.setItem('students', JSON.stringify(students));
          renderStudents();
        }
      });
      
      // Delete button: remove student
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener('click', function() {
        if(confirm(`Delete ${student.name}?`)) {
          students.splice(index, 1);
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

  // Add Student button event
  addStudentBtn.addEventListener('click', function() {
    const name = studentNameInput.value.trim();
    const cls = studentClassSelect.value;
    
    if(name && cls) {
      // Roll Number automatic generation per class
      const roll = generateRollNumber(cls);
      students.push({ roll, name, class: cls });
      localStorage.setItem('students', JSON.stringify(students));
      studentNameInput.value = "";
      studentClassSelect.selectedIndex = 0;
      renderStudents();
    } else {
      alert("Please enter student name and select a class.");
    }
  });

  // Render attendance for the selected date and class filter
  function renderAttendanceForDate(date, filterClass) {
    attendanceListEl.innerHTML = "";
    // Filter students by selected class; اگر کوئی کلاس منتخب نہ ہو تو تمام طلباء دکھائیں
    let filteredStudents = students;
    if(filterClass) {
      filteredStudents = students.filter(student => student.class === filterClass);
    }
    // Get attendance for the date; اگر موجود نہ ہو تو نیا object بنائیں
    let attendanceForDate = attendanceData[date] || {};

    filteredStudents.forEach(student => {
      const div = document.createElement('div');
      div.classList.add('attendance-item');

      // Label: roll - name (class)
      const label = document.createElement('label');
      label.textContent = `${student.roll} - ${student.name} (${student.class})`;

      // Dropdown: attendance status options
      const select = document.createElement('select');
      // Default option
      const defaultOpt = document.createElement('option');
      defaultOpt.value = "";
      defaultOpt.textContent = "--Select--";
      select.appendChild(defaultOpt);

      // Status options: P (Present), A (Absent), L (Late), Le (Leave)
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

      // اگر پہلے سے کوئی status موجود ہو تو اسے سیٹ کریں
      if(attendanceForDate[student.roll]) {
        select.value = attendanceForDate[student.roll];
      }

      // تبدیلی پر attendance object اپڈیٹ کریں
      select.addEventListener('change', function() {
        attendanceForDate[student.roll] = this.value;
      });

      div.appendChild(label);
      div.appendChild(select);
      attendanceListEl.appendChild(div);
    });
    // Update the global attendanceData object for that date
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

  // PDF Export button event (رپورٹ میں تمام طلباء شامل ہیں)
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

    // تمام طلباء کی فہرست رپورٹ میں شامل کریں (ضرورت کے مطابق کلاس کے لحاظ سے بھی فلٹر کیا جا سکتا ہے)
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
