document.addEventListener("DOMContentLoaded", function() {
  // Allowed classes list
  const allowedClasses = [
    "Play Group", "Nursery", "Prep", "Pre One",
    "One", "Two", "Three", "Four", "Five",
    "Six", "Seven", "Eight", "Nine", "Ten"
  ];

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
  const sendParentsBtn = document.getElementById('sendParents');
  const specialNoteInput = document.getElementById('specialNote');

  // Retrieve teacher class from localStorage if set
  let teacherClass = localStorage.getItem('teacherClass') || "";
  updateTeacherClassDisplays();

  // Function to update teacher class displays in UI
  function updateTeacherClassDisplays() {
    teacherClassDisplay.textContent = teacherClass || "None";
    teacherClassDisplayRegistration.textContent = teacherClass || "None";
    teacherClassDisplayAttendance.textContent = teacherClass || "None";
    teacherClassHeader.textContent = teacherClass || "None";
  }

  // Save Teacher Class button event
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

  // Retrieve data from localStorage or initialize new structures
  let students = JSON.parse(localStorage.getItem('students')) || [];
  // Each student: { roll, name, class, parentContact }
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || {};
  // attendanceData: { date: { roll: status } }

  // Generate Roll Number automatically for teacher's class
  function generateRollNumber(cls) {
    const classStudents = students.filter(student => student.class === cls);
    if(classStudents.length === 0) {
      return 1;
    }
    let maxRoll = Math.max(...classStudents.map(s => parseInt(s.roll, 10)));
    return maxRoll + 1;
  }

  // Render student list (only for teacher's class)
  function renderStudents() {
    studentsListEl.innerHTML = "";
    const classStudents = students.filter(student => student.class === teacherClass);
    classStudents.forEach((student) => {
      const li = document.createElement('li');
      // Display only roll and name; class name is shown at the header
      li.textContent = `${student.roll} - ${student.name}`;
      
      // Action Buttons: Edit and Delete
      const actionsDiv = document.createElement('div');
      actionsDiv.classList.add("action-buttons");

      // Edit button
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

      // Delete button
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

  // Add Student event: only for teacher's class
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

  // Render attendance for the selected date for teacher's class only using quick-tap buttons
  function renderAttendanceForDate(date) {
    attendanceListEl.innerHTML = "";
    const classStudents = students.filter(student => student.class === teacherClass);
    let attendanceForDate = attendanceData[date] || {};

    classStudents.forEach(student => {
      const div = document.createElement('div');
      div.classList.add('attendance-item');

      const label = document.createElement('label');
      // Display only roll and name
      label.textContent = `${student.roll} - ${student.name}`;
      div.appendChild(label);

      // Create a container for the quick-tap buttons
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

        // If this option is selected, highlight it
        if (attendanceForDate[student.roll] === opt.value) {
          btn.classList.add('selected');
        }

        btn.addEventListener('click', function() {
          attendanceForDate[student.roll] = opt.value;
          // Update UI: remove 'selected' from all buttons in this container and add to this one
          const siblingBtns = buttonsContainer.querySelectorAll('.att-btn');
          siblingBtns.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        });

        buttonsContainer.appendChild(btn);
      });

      div.appendChild(buttonsContainer);

      // Create an individual "Send" button for WhatsApp
      const sendBtn = document.createElement('button');
      sendBtn.textContent = "Send";
      sendBtn.classList.add('send-btn');
      sendBtn.addEventListener('click', function() {
        // Get current attendance status
        const status = attendanceForDate[student.roll] || "Not Marked";
        if (!dateInput.value) {
          alert("Please select a date first.");
          return;
        }
        const selectedDate = dateInput.value;
        let message = `Dear Parent,\n\nAttendance for your child (${student.name}, Roll: ${student.roll}) on ${selectedDate} (Class: ${teacherClass}) is: ${status}.\n\nRegards,\nSchool`;
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

  // Load Attendance event
  loadAttendanceBtn.addEventListener('click', function() {
    const date = dateInput.value;
    if (!date) {
      alert("Please select a date.");
      return;
    }
    renderAttendanceForDate(date);
  });

  // Save Attendance event
  saveAttendanceBtn.addEventListener('click', function() {
    const date = dateInput.value;
    if (!date) {
      alert("Please select a date.");
      return;
    }
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    alert(`Attendance saved for ${date}`);
  });

  // PDF Export event (generates overall class attendance report)
  exportPdfBtn.addEventListener('click', function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const date = dateInput.value;
    if (!date) {
      alert("Please select a date for the report.");
      return;
    }
    // Header with class name and date
    doc.text(`Attendance Report for ${date} (Class: ${teacherClass})`, 10, 10);
    let y = 20;
    let attendanceForDate = attendanceData[date] || {};
    const classStudents = students.filter(student => student.class === teacherClass);
    classStudents.forEach(student => {
      const status = attendanceForDate[student.roll] || "Not Marked";
      doc.text(`${student.roll} - ${student.name}: ${status}`, 10, y);
      y += 10;
    });
    doc.save(`attendance_${date}.pdf`);
  });

  // Share on WhatsApp event (sends overall attendance report)
  shareWhatsAppBtn.addEventListener('click', function() {
    const date = dateInput.value;
    if (!date) {
      alert("Please select a date for sharing.");
      return;
    }
    let attendanceForDate = attendanceData[date] || {};
    const classStudents = students.filter(student => student.class === teacherClass);
    let message = `Attendance Report for ${date} (Class: ${teacherClass})\n\n`;
    classStudents.forEach(student => {
      const status = attendanceForDate[student.roll] || "Not Marked";
      message += `${student.roll} - ${student.name}: ${status}\n`;
    });
    const whatsappUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(message);
    window.open(whatsappUrl, '_blank');
  });

  // Optionally, the existing "Send Attendance To All Parents" event remains (if needed)
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
        let message = `Dear Parent,\n\nAttendance for your child (${student.name}, Roll: ${student.roll}) on ${date} (Class: ${teacherClass}) is: ${status}.\n`;
        if (specialNote) {
          message += `\nNote: ${specialNote}`;
        }
        message += `\n\nRegards,\nSchool`;
        const whatsappUrl = "https://api.whatsapp.com/send?phone=" + encodeURIComponent(student.parentContact) +
                              "&text=" + encodeURIComponent(message);
        setTimeout(() => {
          window.open(whatsappUrl, '_blank');
        }, index * 1500);
      }
    });
  });

  // Initial render for student list
  renderStudents();
});
