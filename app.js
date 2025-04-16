document.addEventListener("DOMContentLoaded", function() {
  // Allowed classes list
  const allowedClasses = [
    "Play Group", "Nursery", "Prep", "Pre One", "One", "Two", "Three",
    "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"
  ];

  // Helper function to convert status code into professional English message
  function getStatusText(status) {
    switch(status) {
      case "P": return "Present. Thank you for ensuring your child’s punctuality.";
      case "A": return "Absent. Please contact the school for further details regarding your child's absence.";
      case "L": return "Late. Kindly ensure your child arrives on time. Thank you.";
      case "Le": return "Leave. Your child's leave request has been approved.";
      default: return "Not Marked";
    }
  }

  // Teacher Setup Elements
  const teacherClassSelect = document.getElementById("teacherClassSelect");
  const saveTeacherClassBtn = document.getElementById("saveTeacherClass");
  const teacherClassDisplay = document.getElementById("teacherClassDisplay");
  const teacherClassDisplayRegistration = document.getElementById("teacherClassDisplayRegistration");
  const teacherClassDisplayAttendance = document.getElementById("teacherClassDisplayAttendance");
  const teacherClassHeader = document.getElementById("teacherClassHeader");

  // Student Registration Elements
  const studentNameInput = document.getElementById('studentName');
  const parentContactInput = document.getElementById('parentContact');
  const addStudentBtn = document.getElementById('addStudent');
  const studentsListEl = document.getElementById('students');

  // Attendance Elements
  const dateInput = document.getElementById('dateInput');
  const loadAttendanceBtn = document.getElementById('loadAttendance');
  const attendanceListEl = document.getElementById('attendanceList');
  const saveAttendanceBtn = document.getElementById('saveAttendance');

  // Report Elements
  const exportPdfBtn = document.getElementById('exportPdf');
  const shareWhatsAppBtn = document.getElementById('shareWhatsApp');
  // Removed sendParentsBtn and its related code

  // Retrieve teacher class from localStorage if set
  let teacherClass = localStorage.getItem('teacherClass') || "";
  updateTeacherClassDisplays();

  function updateTeacherClassDisplays() {
    teacherClassDisplay.textContent = teacherClass || "None";
    teacherClassDisplayRegistration.textContent = teacherClass || "None";
    teacherClassDisplayAttendance.textContent = teacherClass || "None";
    teacherClassHeader.textContent = teacherClass || "None";
  }

  saveTeacherClassBtn.addEventListener('click', function() {
    const selectedClass = teacherClassSelect.value;
    if (allowedClasses.includes(selectedClass)) {
      teacherClass = selectedClass;
      localStorage.setItem('teacherClass', teacherClass);
      updateTeacherClassDisplays();
      renderStudents();
    } else {
      alert("Please select a valid class.");
    }
  });

  // Retrieve stored data or initialize new structures
  let students = JSON.parse(localStorage.getItem('students')) || [];
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || {};

  function generateRollNumber(cls) {
    const classStudents = students.filter(student => student.class === cls);
    if (classStudents.length === 0) { return 1; }
    let maxRoll = Math.max(...classStudents.map(s => parseInt(s.roll, 10)));
    return maxRoll + 1;
  }

  function renderStudents() {
    studentsListEl.innerHTML = "";
    const classStudents = students.filter(student => student.class === teacherClass);
    classStudents.forEach((student) => {
      const li = document.createElement('li');
      li.textContent = `${student.roll} - ${student.name}`;
      const actionsDiv = document.createElement('div');
      actionsDiv.classList.add("action-buttons");
      
      const editBtn = document.createElement('button');
      editBtn.textContent = "Edit";
      editBtn.addEventListener('click', function() {
        let newName = prompt("Enter new name:", student.name);
        if (newName && newName.trim() !== "") {
          const idx = students.findIndex(s => s.roll === student.roll && s.class === teacherClass);
          if (idx !== -1) {
            students[idx].name = newName.trim();
            localStorage.setItem('students', JSON.stringify(students));
            renderStudents();
          }
        }
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener('click', function() {
        if (confirm(`Delete ${student.name}?`)) {
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

  addStudentBtn.addEventListener('click', function() {
    if (!teacherClass) {
      alert("Please select your class from the Teacher Setup section.");
      return;
    }
    const name = studentNameInput.value.trim();
    const parentContact = parentContactInput.value.trim();
    if (name) {
      const roll = generateRollNumber(teacherClass);
      students.push({ roll, name, class: teacherClass, parentContact });
      localStorage.setItem('students', JSON.stringify(students));
      studentNameInput.value = "";
      parentContactInput.value = "";
      renderStudents();
    } else {
      alert("Please enter student name.");
    }
  });

  // Replace dropdown with quick-tap buttons for faster attendance input
  function renderAttendanceForDate(date) {
    attendanceListEl.innerHTML = "";
    const classStudents = students.filter(student => student.class === teacherClass);
    let attendanceForDate = attendanceData[date] || {};
    classStudents.forEach(student => {
      const div = document.createElement('div');
      div.classList.add('attendance-item');
      
      const label = document.createElement('label');
      label.textContent = `${student.roll} - ${student.name}`;
      div.appendChild(label);
      
      const buttonsContainer = document.createElement('div');
      buttonsContainer.classList.add('attendance-buttons');
      
      const options = [
        { value: "P", text: "P" },
        { value: "A", text: "A" },
        { value: "L", text: "L" },
        { value: "Le", text: "Le" }
      ];
      
      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.textContent = opt.text;
        btn.classList.add('att-btn');
        if (attendanceForDate[student.roll] === opt.value) {
          btn.classList.add('selected');
        }
        btn.addEventListener('click', function() {
          attendanceForDate[student.roll] = opt.value;
          const siblingBtns = buttonsContainer.querySelectorAll('.att-btn');
          siblingBtns.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        });
        buttonsContainer.appendChild(btn);
      });
      div.appendChild(buttonsContainer);
      
      // Individual "Send" button for WhatsApp message per student
      const sendBtn = document.createElement('button');
      sendBtn.textContent = "Send";
      sendBtn.classList.add('send-btn');
      sendBtn.addEventListener('click', function() {
        const status = attendanceForDate[student.roll] || "Not Marked";
        if (!dateInput.value) {
          alert("Please select a date first.");
          return;
        }
        const selectedDate = dateInput.value;
        const statusText = getStatusText(status);
        let message = `Dear Parent,\n\nAttendance for your child, ${student.name} (Roll: ${student.roll}) on ${selectedDate} (Class: ${teacherClass}) is as follows:\n\n${statusText}\n\nRegards,\nSchool Administration`;
        if (!student.parentContact) {
          alert("Parent contact is not available for " + student.name);
          return;
        }
        const whatsappUrl = "https://api.whatsapp.com/send?phone=" + encodeURIComponent(student.parentContact) +
                            "&text=" + encodeURIComponent(message);
        window.open(whatsappUrl, '_blank');
      });
      div.appendChild(sendBtn);
      attendanceListEl.appendChild(div);
    });
    attendanceData[date] = attendanceForDate;
  }

  loadAttendanceBtn.addEventListener('click', function() {
    const date = dateInput.value;
    if (!date) { alert("Please select a date."); return; }
    renderAttendanceForDate(date);
  });

  saveAttendanceBtn.addEventListener('click', function() {
    const date = dateInput.value;
    if (!date) { alert("Please select a date."); return; }
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    alert(`Attendance saved for ${date}`);
  });

  // Export PDF event handler with Daily and Monthly options
  exportPdfBtn.addEventListener('click', function() {
    const { jsPDF } = window.jspdf;
    let reportType = prompt("Enter report type for PDF report: daily OR monthly").toLowerCase();
    if (!reportType || (reportType !== "daily" && reportType !== "monthly")) {
      alert("Please enter a valid report type (daily or monthly).");
      return;
    }
    const doc = new jsPDF();
    if (reportType === "daily") {
      const date = dateInput.value;
      if (!date) { alert("Please select a date for the report."); return; }
      doc.text(`Attendance Report for ${date} (Class: ${teacherClass})`, 10, 10);
      let y = 20;
      let attendanceForDate = attendanceData[date] || {};
      const classStudents = students.filter(student => student.class === teacherClass);
      classStudents.forEach(student => {
        const status = attendanceForDate[student.roll] || "Not Marked";
        const statusText = getStatusText(status);
        doc.text(`${student.roll} - ${student.name}: ${statusText}`, 10, y);
        y += 10;
      });
      doc.save(`attendance_${date}.pdf`);
    } else if (reportType === "monthly") {
      // Ask user to enter the month in YYYY-MM format
      let monthInput = prompt("Enter month (YYYY-MM) for the monthly report:");
      if (!monthInput) { alert("Month is required for monthly report."); return; }
      doc.text(`Monthly Attendance Report for ${monthInput} (Class: ${teacherClass})`, 10, 10);
      
      // Gather all dates from attendanceData that start with the given month
      let attendanceDates = [];
      for (let date in attendanceData) {
        if (date.startsWith(monthInput)) {
          attendanceDates.push(date);
        }
      }
      if (attendanceDates.length === 0) {
        alert("No attendance data found for the entered month.");
        return;
      }
      attendanceDates.sort(); // Sort dates chronologically
      
      // Build table header and rows
      let tableColumnHeaders = ["Roll", "Name"].concat(attendanceDates);
      let tableRows = [];
      const classStudents = students.filter(student => student.class === teacherClass);
      classStudents.forEach(student => {
        let row = [student.roll, student.name];
        attendanceDates.forEach(date => {
          let status = (attendanceData[date] && attendanceData[date][student.roll]) || "";
          row.push(status);
        });
        tableRows.push(row);
      });
      
      // Using autoTable plugin to render table in PDF (ensure autoTable is included)
      if (doc.autoTable) {
        doc.autoTable({
          head: [tableColumnHeaders],
          body: tableRows,
          startY: 20
        });
      } else {
        // Fallback: manually write rows (less formatted)
        let y = 20;
        doc.text(tableColumnHeaders.join("  |  "), 10, y);
        y += 10;
        tableRows.forEach(row => {
          doc.text(row.join("  |  "), 10, y);
          y += 10;
        });
      }
      doc.save(`attendance_month_${monthInput}.pdf`);
    }
  });

  // Share on WhatsApp event handler with Daily and Monthly options
  shareWhatsAppBtn.addEventListener('click', function() {
    let reportType = prompt("Enter report type for WhatsApp sharing: daily OR monthly").toLowerCase();
    if (!reportType || (reportType !== "daily" && reportType !== "monthly")) {
      alert("Please enter a valid report type (daily or monthly).");
      return;
    }
    if (reportType === "daily") {
      const date = dateInput.value;
      if (!date) { alert("Please select a date for sharing."); return; }
      let attendanceForDate = attendanceData[date] || {};
      const classStudents = students.filter(student => student.class === teacherClass);
      let message = `Attendance Report for ${date} (Class: ${teacherClass})\n\n`;
      classStudents.forEach(student => {
        const status = attendanceForDate[student.roll] || "Not Marked";
        const statusText = getStatusText(status);
        message += `${student.roll} - ${student.name}: ${statusText}\n`;
      });
      const whatsappUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(message);
      window.open(whatsappUrl, '_blank');
    } else if (reportType === "monthly") {
      let monthInput = prompt("Enter month (YYYY-MM) for sharing the monthly report:");
      if (!monthInput) { alert("Month is required for monthly sharing."); return; }
      // Gather and sort dates for the month
      let attendanceDates = [];
      for (let date in attendanceData) {
        if (date.startsWith(monthInput)) { attendanceDates.push(date); }
      }
      if (attendanceDates.length === 0) {
        alert("No attendance data found for the entered month.");
        return;
      }
      attendanceDates.sort();
      
      let message = `Monthly Attendance Report for ${monthInput} (Class: ${teacherClass})\n\n`;
      // Create header row (limited to text formatting)
      message += `Roll - Name`;
      attendanceDates.forEach(date => {
        message += ` | ${date.substr(8,2)}`; // show only day part
      });
      message += "\n";
      
      // Append each student's attendance for the month
      const classStudents = students.filter(student => student.class === teacherClass);
      classStudents.forEach(student => {
        message += `${student.roll} - ${student.name}`;
        attendanceDates.forEach(date => {
          let status = (attendanceData[date] && attendanceData[date][student.roll]) || "";
          message += ` | ${status}`;
        });
        message += "\n";
      });
      const whatsappUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(message);
      window.open(whatsappUrl, '_blank');
    }
  });

  renderStudents();
});
