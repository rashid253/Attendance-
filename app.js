document.addEventListener("DOMContentLoaded", function() {
  // Allowed classes list
  const allowedClasses = [
    "Play Group", "Nursery", "Prep", "Pre One", "One", "Two", "Three",
    "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"
  ];

  // Helper: Convert status code into professional text
  function getStatusText(status) {
    switch(status) {
      case "P": return "Present. Thank you for ensuring your child’s punctuality.";
      case "A": return "Absent. Please contact the school for further details regarding your child's absence.";
      case "L": return "Late. Kindly ensure your child arrives on time. Thank you.";
      case "Le": return "Leave. Your child's leave request has been approved.";
      default: return "Not Marked";
    }
  }

  // ================= Teacher Setup Elements =================
  const teacherClassSelect = document.getElementById("teacherClassSelect");
  const saveTeacherClassBtn = document.getElementById("saveTeacherClass");
  const teacherClassDisplay = document.getElementById("teacherClassDisplay");
  const teacherClassDisplayRegistration = document.getElementById("teacherClassDisplayRegistration");
  const teacherClassDisplayAttendance = document.getElementById("teacherClassDisplayAttendance");
  const teacherClassHeader = document.getElementById("teacherClassHeader");

  // ================= Student Registration Elements =================
  const studentNameInput = document.getElementById('studentName');
  const parentContactInput = document.getElementById('parentContact');
  const addStudentBtn = document.getElementById('addStudent');
  const studentsListEl = document.getElementById('students');

  // ================= Attendance Elements =================
  const dateInput = document.getElementById('dateInput');
  const loadAttendanceBtn = document.getElementById('loadAttendance');
  const attendanceListEl = document.getElementById('attendanceList');
  const saveAttendanceBtn = document.getElementById('saveAttendance');

  // ================= Report Elements =================
  const exportPdfBtn = document.getElementById('exportPdf');
  const shareWhatsAppBtn = document.getElementById('shareWhatsApp');
  const specialNoteInput = document.getElementById('specialNote');
  const monthInputElement = document.getElementById('monthInput'); // For monthly report

  // ================= PDF Options Modal =================
  const pdfOptionsModal = document.getElementById('pdfOptionsModal');
  const pdfCurrentReportBtn = document.getElementById('pdfCurrentReportBtn');  // Current attendance report button
  const pdfDailyReportBtn = document.getElementById('pdfDailyReportBtn');
  const pdfMonthlyReportBtn = document.getElementById('pdfMonthlyReportBtn');
  const closePdfModalBtn = document.getElementById('closePdfModalBtn');

  // ================= WhatsApp Sharing Modal Creation =================
  // We'll create a new modal for WhatsApp sharing instead of using prompt.
  const whatsappOptionsModal = document.createElement("div");
  whatsappOptionsModal.id = "whatsappOptionsModal";
  whatsappOptionsModal.innerHTML = `
    <div class="modal-content">
      <h3>Select Report Type for WhatsApp Sharing</h3>
      <button id="whatsappCurrentBtn">Current Attendance Report</button>
      <button id="whatsappDailyBtn">Daily Attendance Report</button>
      <button id="whatsappMonthlyBtn">Monthly Attendance Report</button>
      <button id="closeWhatsappModalBtn">Cancel</button>
    </div>
  `;
  // Apply basic styling similar to the PDF modal
  whatsappOptionsModal.style.display = "none";
  whatsappOptionsModal.style.position = "fixed";
  whatsappOptionsModal.style.zIndex = "1000";
  whatsappOptionsModal.style.left = "0";
  whatsappOptionsModal.style.top = "0";
  whatsappOptionsModal.style.width = "100%";
  whatsappOptionsModal.style.height = "100%";
  whatsappOptionsModal.style.overflow = "auto";
  whatsappOptionsModal.style.backgroundColor = "rgba(0,0,0,0.4)";
  document.body.appendChild(whatsappOptionsModal);

  const whatsappCurrentBtn = document.getElementById("whatsappCurrentBtn");
  const whatsappDailyBtn = document.getElementById("whatsappDailyBtn");
  const whatsappMonthlyBtn = document.getElementById("whatsappMonthlyBtn");
  const closeWhatsappModalBtn = document.getElementById("closeWhatsappModalBtn");

  // ================= Retrieve Stored Data =================
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

  // ================= Attendance Rendering =================
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
      
      // "Send" button for WhatsApp per student
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
    if (!date) {
      if (typeof dateInput.showPicker === "function") {
        dateInput.showPicker();
      } else {
        dateInput.focus();
      }
      return;
    }
    renderAttendanceForDate(date);
  });

  saveAttendanceBtn.addEventListener('click', function() {
    const date = dateInput.value;
    if (!date) { 
      if (typeof dateInput.showPicker === "function") {
        dateInput.showPicker();
      } else {
        dateInput.focus();
      }
      return;
    }
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    alert(`Attendance saved for ${date}`);
  });

  // ================= PDF Report Generation =================
  // Show PDF options modal when "Download PDF" is clicked
  exportPdfBtn.addEventListener('click', function() {
    pdfOptionsModal.style.display = "block";
  });

  // (1) Current Attendance Report – if no date selected, default to today's date
  pdfCurrentReportBtn.addEventListener('click', function() {
    let date = dateInput.value;
    if (!date) {
      date = new Date().toISOString().split("T")[0];
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Current Attendance Report for ${date} (Class: ${teacherClass})`, 10, 10);
    let y = 20;
    let attendanceForDate = attendanceData[date] || {};
    const classStudents = students.filter(student => student.class === teacherClass);
    classStudents.forEach(student => {
      const status = attendanceForDate[student.roll] || "Not Marked";
      const statusText = getStatusText(status);
      doc.text(`${student.roll} - ${student.name}: ${statusText}`, 10, y);
      y += 10;
    });
    doc.save(`current_attendance_${date}.pdf`);
    pdfOptionsModal.style.display = "none";
  });

  // (2) Daily Attendance Report – require a date to be chosen (do not default)
  pdfDailyReportBtn.addEventListener('click', function() {
    const chosenDate = dateInput.value;
    if (!chosenDate) {
      alert("Please select a date using the date picker for the daily report.");
      if (typeof dateInput.showPicker === "function") {
        dateInput.showPicker();
      } else {
        dateInput.focus();
      }
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Daily Attendance Report for ${chosenDate} (Class: ${teacherClass})`, 10, 10);
    let y = 20;
    let attendanceForDate = attendanceData[chosenDate] || {};
    const classStudents = students.filter(student => student.class === teacherClass);
    classStudents.forEach(student => {
      const status = attendanceForDate[student.roll] || "Not Marked";
      const statusText = getStatusText(status);
      doc.text(`${student.roll} - ${student.name}: ${statusText}`, 10, y);
      y += 10;
    });
    doc.save(`daily_attendance_${chosenDate}.pdf`);
    pdfOptionsModal.style.display = "none";
  });

  // (3) Monthly Attendance Report – using the month picker (no prompt)
  pdfMonthlyReportBtn.addEventListener('click', function() {
    const monthValue = monthInputElement.value; // expected "YYYY-MM"
    if (!monthValue) {
      alert("Please select a month using the month picker for the monthly report.");
      if (typeof monthInputElement.showPicker === "function") {
        monthInputElement.showPicker();
      } else {
        monthInputElement.focus();
      }
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'pt', 'a4'); // landscape mode
    doc.text(`Monthly Attendance Report for ${monthValue} (Class: ${teacherClass})`, 20, 30);
    let tableColumnHeaders = ["Roll", "Name"];
    for (let day = 1; day <= 31; day++) {
      tableColumnHeaders.push(day.toString());
    }
    let tableRows = [];
    const classStudents = students.filter(student => student.class === teacherClass);
    classStudents.forEach(student => {
      let row = [student.roll, student.name];
      for (let day = 1; day <= 31; day++) {
        let dayStr = day.toString().padStart(2, '0');
        let dateStr = `${monthValue}-${dayStr}`;
        let status = (attendanceData[dateStr] && attendanceData[dateStr][student.roll]) || "";
        row.push(status);
      }
      tableRows.push(row);
    });
    doc.autoTable({
      head: [tableColumnHeaders],
      body: tableRows,
      startY: 50,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [33, 150, 243] }
    });
    doc.save(`monthly_attendance_${monthValue}.pdf`);
    pdfOptionsModal.style.display = "none";
  });

  closePdfModalBtn.addEventListener('click', function() {
    pdfOptionsModal.style.display = "none";
  });

  // ================= WhatsApp Sharing =================
  // When the teacher clicks the WhatsApp sharing button, show the WhatsApp Options Modal
  shareWhatsAppBtn.addEventListener('click', function() {
    whatsappOptionsModal.style.display = "block";
  });

  whatsappCurrentBtn.addEventListener('click', function() {
    let date = dateInput.value;
    if (!date) {
      // For current, if no date is selected, default to today's date
      date = new Date().toISOString().split("T")[0];
    }
    let attendanceForDate = attendanceData[date] || {};
    let message = `Current Attendance Report for ${date} (Class: ${teacherClass})\n\n`;
    const classStudents = students.filter(student => student.class === teacherClass);
    classStudents.forEach(student => {
      const status = attendanceForDate[student.roll] || "Not Marked";
      const statusText = getStatusText(status);
      message += `${student.roll} - ${student.name}: ${statusText}\n`;
    });
    const whatsappUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(message);
    window.open(whatsappUrl, '_blank');
    whatsappOptionsModal.style.display = "none";
  });

  whatsappDailyBtn.addEventListener('click', function() {
    const chosenDate = dateInput.value;
    if (!chosenDate) {
      alert("Please select a date using the date picker for the daily WhatsApp report.");
      if (typeof dateInput.showPicker === "function") {
        dateInput.showPicker();
      } else {
        dateInput.focus();
      }
      return;
    }
    let attendanceForDate = attendanceData[chosenDate] || {};
    let message = `Daily Attendance Report for ${chosenDate} (Class: ${teacherClass})\n\n`;
    const classStudents = students.filter(student => student.class === teacherClass);
    classStudents.forEach(student => {
      const status = attendanceForDate[student.roll] || "Not Marked";
      const statusText = getStatusText(status);
      message += `${student.roll} - ${student.name}: ${statusText}\n`;
    });
    const whatsappUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(message);
    window.open(whatsappUrl, '_blank');
    whatsappOptionsModal.style.display = "none";
  });

  whatsappMonthlyBtn.addEventListener('click', function() {
    const monthValue = monthInputElement.value;
    if (!monthValue) {
      alert("Please select a month using the month picker for the monthly WhatsApp report.");
      if (typeof monthInputElement.showPicker === "function") {
        monthInputElement.showPicker();
      } else {
        monthInputElement.focus();
      }
      return;
    }
    let message = `Monthly Attendance Report for ${monthValue} (Class: ${teacherClass})\n\nRoll - Name`;
    for (let day = 1; day <= 31; day++) {
      message += ` | ${day}`;
    }
    message += "\n";
    const classStudents = students.filter(student => student.class === teacherClass);
    classStudents.forEach(student => {
      message += `${student.roll} - ${student.name}`;
      for (let day = 1; day <= 31; day++) {
        let dayStr = day.toString().padStart(2, '0');
        let dateStr = `${monthValue}-${dayStr}`;
        let status = (attendanceData[dateStr] && attendanceData[dateStr][student.roll]) || "";
        message += ` | ${status}`;
      }
      message += "\n";
    });
    const whatsappUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(message);
    window.open(whatsappUrl, '_blank');
    whatsappOptionsModal.style.display = "none";
  });

  closeWhatsappModalBtn.addEventListener('click', function() {
    whatsappOptionsModal.style.display = "none";
  });

  // ================= End of Code =================
  renderStudents();
});
