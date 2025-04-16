<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>School Attendance App</title>
  <!-- Minimal styling for demonstration -->
  <style>
    .action-buttons button,
    .attendance-buttons button,
    button { margin: 5px; }
    .selected { background-color: #4CAF50; color: white; }
  </style>
</head>
<body>

  <!-- Teacher Setup Section -->
  <h2>Teacher Setup</h2>
  <select id="teacherClassSelect">
    <option value="">Select Class</option>
    <option value="Play Group">Play Group</option>
    <option value="Nursery">Nursery</option>
    <option value="Prep">Prep</option>
    <option value="Pre One">Pre One</option>
    <option value="One">One</option>
    <option value="Two">Two</option>
    <option value="Three">Three</option>
    <option value="Four">Four</option>
    <option value="Five">Five</option>
    <option value="Six">Six</option>
    <option value="Seven">Seven</option>
    <option value="Eight">Eight</option>
    <option value="Nine">Nine</option>
    <option value="Ten">Ten</option>
  </select>
  <button id="saveTeacherClass">Save Teacher Class</button>
  <p>Current Class: <span id="teacherClassDisplay">None</span></p>
  <p>Registration Class: <span id="teacherClassDisplayRegistration">None</span></p>
  <p>Attendance Class: <span id="teacherClassDisplayAttendance">None</span></p>
  <h3 id="teacherClassHeader">None</h3>

  <!-- Student Registration Section -->
  <h2>Student Registration</h2>
  <input type="text" id="studentName" placeholder="Student Name">
  <input type="text" id="parentContact" placeholder="Parent Contact">
  <button id="addStudent">Add Student</button>
  <ul id="students"></ul>

  <!-- Attendance Section -->
  <h2>Attendance</h2>
  <input type="date" id="dateInput">
  <button id="loadAttendance">Load Attendance</button>
  <div id="attendanceList"></div>
  <button id="saveAttendance">Save Attendance</button>

  <!-- Report & Sharing Section -->
  <h2>Reports & Sharing</h2>
  <select id="reportType">
    <option value="daily">Daily Report</option>
    <option value="monthly">Monthly Report</option>
  </select>
  <button id="exportPdf">Export PDF</button>
  <button id="shareWhatsApp">Share on WhatsApp</button>
  <button id="sendParents">Send to Parents</button>
  <textarea id="specialNote" placeholder="Special note"></textarea>

  <!-- Include jsPDF and autoTable plugin libraries -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js"></script>

  <script>
    document.addEventListener("DOMContentLoaded", function() {
      // Allowed classes list
      const allowedClasses = [
        "Play Group", "Nursery", "Prep", "Pre One",
        "One", "Two", "Three", "Four", "Five",
        "Six", "Seven", "Eight", "Nine", "Ten"
      ];

      // Helper function to convert status code into professional English message
      function getStatusText(status) {
        switch(status) {
          case "P":
            return "Present. Thank you for ensuring your child’s punctuality.";
          case "A":
            return "Absent. Please contact the school for further details regarding your child's absence.";
          case "L":
            return "Late. Kindly ensure your child arrives on time. Thank you.";
          case "Le":
            return "Leave. Your child's leave request has been approved.";
          default:
            return "Not Marked";
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
      const reportTypeSelect = document.getElementById('reportType');
      const exportPdfBtn = document.getElementById('exportPdf');
      const shareWhatsAppBtn = document.getElementById('shareWhatsApp');
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
      let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || {};

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

      // Attendance rendering: quick-tap buttons for each student
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

      // Export PDF with two options: daily and monthly
      exportPdfBtn.addEventListener('click', function () {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const reportType = reportTypeSelect.value;
        const selectedDate = dateInput.value;
        if (!selectedDate) {
          alert("Please select a date.");
          return;
        }
        if (reportType === "daily") {
          doc.text(`Daily Attendance Report for ${selectedDate} (Class: ${teacherClass})`, 10, 10);
          let y = 20;
          let attendanceForDate = attendanceData[selectedDate] || {};
          const classStudents = students.filter(student => student.class === teacherClass);
          classStudents.forEach(student => {
              const status = attendanceForDate[student.roll] || "Not Marked";
              const statusText = getStatusText(status);
              doc.text(`${student.roll} - ${student.name}: ${statusText}`, 10, y);
              y += 10;
          });
          doc.save(`attendance_${selectedDate}.pdf`);
        } else {  // monthly report in table format
          const dateObj = new Date(selectedDate);
          const year = dateObj.getFullYear();
          const month = dateObj.getMonth(); // 0-indexed
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          // Construct table header
          const head = [['Roll', 'Name', ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString())]];
          const body = [];
          const classStudents = students.filter(student => student.class === teacherClass);
          classStudents.forEach(student => {
            const row = [student.roll.toString(), student.name];
            for(let day = 1; day <= daysInMonth; day++){
              let dayString = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
              let attendanceForDay = attendanceData[dayString] || {};
              let status = attendanceForDay[student.roll] || "NM";
              row.push(status);
            }
            body.push(row);
          });
          doc.text(`Monthly Attendance Report for ${dateObj.toLocaleString('default', { month: 'long' })} ${year} (Class: ${teacherClass})`, 10, 10);
          // Use autoTable plugin for table rendering
          if (doc.autoTable) {
            doc.autoTable({
              head: head,
              body: body,
              startY: 20,
              styles: { fontSize: 8 }
            });
          } else {
            // Fallback: simple text output
            let y = 20;
            doc.text("Attendance Table:", 10, y);
            y += 10;
            body.forEach(row => {
              doc.text(row.join(" | "), 10, y);
              y += 10;
            });
          }
          doc.save(`attendance_${year}_${month + 1}.pdf`);
        }
      });

      // Share on WhatsApp with two options: daily and monthly report
      shareWhatsAppBtn.addEventListener('click', function () {
        const reportType = reportTypeSelect.value;
        const selectedDate = dateInput.value;
        if (!selectedDate) {
          alert("Please select a date.");
          return;
        }
        let message = "";
        if (reportType === "daily") {
          let attendanceForDate = attendanceData[selectedDate] || {};
          const classStudents = students.filter(student => student.class === teacherClass);
          message = `Daily Attendance Report for ${selectedDate} (Class: ${teacherClass})\n\n`;
          classStudents.forEach(student => {
              const status = attendanceForDate[student.roll] || "Not Marked";
              const statusText = getStatusText(status);
              message += `${student.roll} - ${student.name}: ${statusText}\n`;
          });
        } else { // monthly report
          const dateObj = new Date(selectedDate);
          const year = dateObj.getFullYear();
          const month = dateObj.getMonth(); // 0-indexed
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          message = `Monthly Attendance Report for ${dateObj.toLocaleString('default', { month: 'long' })} ${year} (Class: ${teacherClass})\n\n`;
          const classStudents = students.filter(student => student.class === teacherClass);
          classStudents.forEach(student => {
              message += `${student.roll} - ${student.name}:\n`;
              for(let day = 1; day <= daysInMonth; day++){
                let dayString = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                let attendanceForDay = attendanceData[dayString] || {};
                let status = attendanceForDay[student.roll] || "NM";
                message += `  Day ${day}: ${status}\n`;
              }
              message += "\n";
          });
        }
        const whatsappUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(message);
        window.open(whatsappUrl, '_blank');
      });

      // Send individual WhatsApp messages to parents (daily report per student)
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
            const statusText = getStatusText(status);
            let message = `Dear Parent,\n\nAttendance for your child, ${student.name} (Roll: ${student.roll}) on ${date} (Class: ${teacherClass}) is as follows:\n\n${statusText}\n`;
            if (specialNote) {
              message += `\nNote: ${specialNote}`;
            }
            message += `\n\nRegards,\nSchool Administration`;
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
  </script>
</body>
</html>
