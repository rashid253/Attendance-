document.addEventListener("DOMContentLoaded", function() {
  // Allowed classes list
  const allowedClasses = [
    "Play Group", "Nursery", "Prep", "Pre One",
    "One", "Two", "Three", "Four", "Five",
    "Six", "Seven", "Eight", "Nine", "Ten"
  ];

  // --- Helper function for concise report status text ---
  // Returns a short text for attendance, e.g., "P" => "Present", etc.
  function getConciseStatus(status) {
    switch(status) {
      case "P": return "Present";
      case "A": return "Absent";
      case "L": return "Late";
      case "Le": return "Leave";
      default: return "Not Marked";
    }
  }

  // --- Teacher Setup Elements ---
  const teacherClassSelect = document.getElementById("teacherClassSelect");
  const saveTeacherClassBtn = document.getElementById("saveTeacherClass");
  const teacherClassDisplay = document.getElementById("teacherClassDisplay");
  const teacherClassDisplayRegistration = document.getElementById("teacherClassDisplayRegistration");
  const teacherClassDisplayAttendance = document.getElementById("teacherClassDisplayAttendance");
  const teacherClassHeader = document.getElementById("teacherClassHeader");

  // --- Student Registration Elements ---
  const studentNameInput = document.getElementById('studentName');
  const parentContactInput = document.getElementById('parentContact');
  const addStudentBtn = document.getElementById('addStudent');
  const studentsListEl = document.getElementById('students');

  // --- Attendance Elements ---
  const dateInput = document.getElementById('dateInput');
  const loadAttendanceBtn = document.getElementById('loadAttendance');
  const attendanceListEl = document.getElementById('attendanceList');
  const saveAttendanceBtn = document.getElementById('saveAttendance');

  // --- Report Elements ---
  // For daily reports:
  const downloadDailyPdfBtn = document.getElementById('downloadDailyPdf');
  const shareDailyWhatsAppBtn = document.getElementById('shareDailyWhatsApp');
  // For monthly reports:
  const monthInput = document.getElementById('monthInput');
  const downloadMonthlyPdfBtn = document.getElementById('downloadMonthlyPdf');
  const shareMonthlyWhatsAppBtn = document.getElementById('shareMonthlyWhatsApp');
  // (The bulk send-to-parents option remains unchanged if needed)
  const sendParentsBtn = document.getElementById('sendParents');
  const specialNoteInput = document.getElementById('specialNote');

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
  // Each student: { roll, name, class, parentContact }
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || {};
  // attendanceData: { date: { roll: status } }

  function generateRollNumber(cls) {
    const classStudents = students.filter(student => student.class === cls);
    if(classStudents.length === 0) {
      return 1;
    }
    let maxRoll = Math.max(...classStudents.map(s => parseInt(s.roll, 10)));
    return maxRoll + 1;
  }

  function renderStudents() {
    studentsListEl.innerHTML = "";
    const classStudents = students.filter(student => student.class === teacherClass);
    classStudents.forEach((student) => {
      const li = document.createElement('li');
      // Display roll and name only; class is shown in header
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

  // Render attendance using quick-tap buttons
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

      // Individual "Send" button for quick WhatsApp sending per student
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
        // Use concise status text for sending
        const statusText = getConciseStatus(status);
        let message = `Dear Parent,\n\nAttendance for your child (${student.name}, Roll: ${student.roll}) on ${selectedDate} (Class: ${teacherClass}) is:\n${statusText}\n\nRegards,\nSchool Administration`;
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
    if (!date) {
      alert("Please select a date.");
      return;
    }
    renderAttendanceForDate(date);
  });

  saveAttendanceBtn.addEventListener('click', function() {
    const date = dateInput.value;
    if (!date) {
      alert("Please select a date.");
      return;
    }
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    alert(`Attendance saved for ${date}`);
  });

  // --- DAILY REPORT FUNCTIONS (using dateInput) ---

  downloadDailyPdfBtn.addEventListener('click', function() {
    const { jsPDF } = window.jspdf;
    const date = dateInput.value;
    if (!date) {
      alert("Please select a date for the daily report.");
      return;
    }
    const doc = new jsPDF();
    doc.text(`Daily Attendance Report for ${date} (Class: ${teacherClass})`, 10, 10);
    let y = 20;
    let attendanceForDate = attendanceData[date] || {};
    const classStudents = students.filter(student => student.class === teacherClass);
    classStudents.forEach(student => {
      const status = attendanceForDate[student.roll] || "Not Marked";
      // For daily report, list only roll - name : status
      doc.text(`${student.roll} - ${student.name}: ${getConciseStatus(status)}`, 10, y);
      y += 10;
    });
    doc.save(`Daily_Attendance_${date}.pdf`);
  });

  shareDailyWhatsAppBtn.addEventListener('click', function() {
    const date = dateInput.value;
    if (!date) {
      alert("Please select a date for the daily report.");
      return;
    }
    let attendanceForDate = attendanceData[date] || {};
    const classStudents = students.filter(student => student.class === teacherClass);
    let message = `Daily Attendance Report for ${date} (Class: ${teacherClass})\n\n`;
    classStudents.forEach(student => {
      const status = attendanceForDate[student.roll] || "Not Marked";
      message += `${student.roll} - ${student.name}: ${getConciseStatus(status)}\n`;
    });
    const whatsappUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(message);
    window.open(whatsappUrl, '_blank');
  });

  // --- MONTHLY REPORT FUNCTIONS ---

  downloadMonthlyPdfBtn.addEventListener('click', function() {
    const monthStr = monthInput.value; // in "YYYY-MM" format
    if (!monthStr) {
      alert("Please select a month for the monthly report.");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Monthly Attendance Report for ${monthStr} (Class: ${teacherClass})`, 10, 10);
    let y = 20;
    // Get all dates in attendanceData that match the selected month
    const reportDates = Object.keys(attendanceData).filter(date => date.startsWith(monthStr));
    if(reportDates.length === 0) {
      alert("No attendance records found for the selected month.");
      return;
    }
    reportDates.sort(); // sort dates ascending
    reportDates.forEach(date => {
      doc.text(`Date: ${date}`, 10, y);
      y += 10;
      const attendanceForDate = attendanceData[date];
      const classStudents = students.filter(student => student.class === teacherClass);
      classStudents.forEach(student => {
        const status = attendanceForDate[student.roll] || "Not Marked";
        doc.text(`${student.roll} - ${student.name}: ${getConciseStatus(status)}`, 20, y);
        y += 10;
      });
      y += 5; // extra space between days
      if (y > 250) { // add new page if needed
        doc.addPage();
        y = 20;
      }
    });
    doc.save(`Monthly_Attendance_${monthStr}.pdf`);
  });

  shareMonthlyWhatsAppBtn.addEventListener('click', function() {
    const monthStr = monthInput.value;
    if (!monthStr) {
      alert("Please select a month for the monthly report.");
      return;
    }
    let message = `Monthly Attendance Report for ${monthStr} (Class: ${teacherClass})\n\n`;
    const reportDates = Object.keys(attendanceData).filter(date => date.startsWith(monthStr));
    if(reportDates.length === 0) {
      alert("No attendance records found for the selected month.");
      return;
    }
    reportDates.sort();
    reportDates.forEach(date => {
      message += `Date: ${date}\n`;
      const attendanceForDate = attendanceData[date];
      const classStudents = students.filter(student => student.class === teacherClass);
      classStudents.forEach(student => {
        const status = attendanceForDate[student.roll] || "Not Marked";
        message += `${student.roll} - ${student.name}: ${getConciseStatus(status)}\n`;
      });
      message += `\n`;
    });
    const whatsappUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(message);
    window.open(whatsappUrl, '_blank');
  });

  // (Optional) Existing Bulk "Send Attendance To All Parents" event remains as before.
  sendParentsBtn.addEventListener('click', function() {
    const date = dateInput.value;
    if (!date) {
      alert("Please select a date before sending to parents.");
      return;
    }
    let attendanceForDate = attendanceData[date] || {};
    const classStudents = students.filter(student => student.class === teacherClass);
    const specialNote = specialNoteInput.value.trim();
    
    classStudents.forEach((student, index) => {
      if (student.parentContact) {
        const status = attendanceForDate[student.roll] || "Not Marked";
        const statusText = getConciseStatus(status);
        let message = `Dear Parent,\n\nAttendance for your child, ${student.name} (Roll: ${student.roll}) on ${date} (Class: ${teacherClass}) is: ${statusText}.\n`;
        if (specialNote) {
          message += `Note: ${specialNote}\n`;
        }
        message += `\nRegards,\nSchool Administration`;
        const whatsappUrl = "https://api.whatsapp.com/send?phone=" + encodeURIComponent(student.parentContact) +
                              "&text=" + encodeURIComponent(message);
        setTimeout(() => {
          window.open(whatsappUrl, '_blank');
        }, index * 1500);
      }
    });
  });

  renderStudents();
});
