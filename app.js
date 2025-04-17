document.addEventListener('DOMContentLoaded', function() {
  // Allowed classes
  const allowedClasses = [
    "Play Group","Nursery","Prep","Pre One",
    "One","Two","Three","Four","Five",
    "Six","Seven","Eight","Nine","Ten"
  ];

  // Map code to full status
  function getStatusText(code) {
    switch(code) {
      case "P":  return "Present";
      case "A":  return "Absent";
      case "L":  return "Late";
      case "Le": return "Leave";
      default:   return "Not Marked";
    }
  }

  // DOM elements
  const teacherClassSelect        = document.getElementById('teacherClassSelect');
  const saveTeacherClassBtn       = document.getElementById('saveTeacherClass');
  const teacherClassDisplay       = document.getElementById('teacherClassDisplay');
  const teacherClassDisplayReg    = document.getElementById('teacherClassDisplayRegistration');
  const teacherClassDisplayAtt    = document.getElementById('teacherClassDisplayAttendance');
  const teacherClassHeader        = document.getElementById('teacherClassHeader');

  const studentNameInput   = document.getElementById('studentName');
  const parentContactInput = document.getElementById('parentContact');
  const addStudentBtn      = document.getElementById('addStudent');
  const studentsListEl     = document.getElementById('students');

  const dateInput           = document.getElementById('dateInput');
  const loadAttendanceBtn   = document.getElementById('loadAttendance');
  const attendanceListEl    = document.getElementById('attendanceList');
  const saveAttendanceBtn   = document.getElementById('saveAttendance');

  const downloadDailyPdfBtn   = document.getElementById('downloadDailyPdf');
  const shareDailyWhatsAppBtn = document.getElementById('shareDailyWhatsApp');
  const sendParentsBtn        = document.getElementById('sendParents');

  // Load stored data
  let teacherClass   = localStorage.getItem('teacherClass') || '';
  let students       = JSON.parse(localStorage.getItem('students') || '[]');
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');

  // Update all class displays
  function updateDisplays() {
    teacherClassDisplay.textContent    = teacherClass || 'None';
    teacherClassDisplayReg.textContent = teacherClass || 'None';
    teacherClassDisplayAtt.textContent = teacherClass || 'None';
    teacherClassHeader.textContent     = teacherClass || 'None';
  }

  // Save helpers
  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }
  function saveAttendance() {
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
  }

  // Generate next roll number for the class
  function generateRoll() {
    const cls = students.filter(s => s.class === teacherClass);
    return cls.length
      ? Math.max(...cls.map(s => +s.roll)) + 1
      : 1;
  }

  // Render student list
  function renderStudents() {
    studentsListEl.innerHTML = '';
    students
      .filter(s => s.class === teacherClass)
      .forEach(student => {
        const li = document.createElement('li');
        li.textContent = `${student.roll} - ${student.name}`;

        const actions = document.createElement('div');
        actions.className = 'action-buttons';

        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.onclick = () => {
          const newName = prompt('Enter new name:', student.name);
          if (newName) {
            student.name = newName.trim();
            saveStudents();
            renderStudents();
          }
        };

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        delBtn.onclick = () => {
          if (confirm(`Delete ${student.name}?`)) {
            students = students.filter(s =>
              !(s.roll === student.roll && s.class === teacherClass)
            );
            saveStudents();
            renderStudents();
          }
        };

        actions.append(editBtn, delBtn);
        li.append(actions);
        studentsListEl.append(li);
      });
  }

  // Add a new student
  addStudentBtn.onclick = () => {
    if (!teacherClass) {
      return alert('Please select your class first.');
    }
    const name = studentNameInput.value.trim();
    if (!name) {
      return alert('Enter student name.');
    }
    const contact = parentContactInput.value.trim();
    const roll = generateRoll();
    students.push({ roll, name, class: teacherClass, parentContact: contact });
    saveStudents();
    studentNameInput.value = parentContactInput.value = '';
    renderStudents();
  };

  // Render attendance entry for a given date
  function renderAttendance(date) {
    attendanceListEl.innerHTML = '';
    const clsStudents = students.filter(s => s.class === teacherClass);
    const dayData = attendanceData[date] || {};

    clsStudents.forEach(student => {
      const row = document.createElement('div');
      row.className = 'attendance-item';

      const label = document.createElement('label');
      label.textContent = `${student.roll} - ${student.name}`;
      row.append(label);

      // Quick-tap buttons
      const btnContainer = document.createElement('div');
      btnContainer.className = 'attendance-buttons';

      ['P','A','L','Le'].forEach(code => {
        const btn = document.createElement('button');
        btn.textContent = code;
        btn.className = 'att-btn';
        if (dayData[student.roll] === code) {
          btn.classList.add('selected');
        }
        btn.onclick = () => {
          dayData[student.roll] = code;
          btnContainer.querySelectorAll('.att-btn')
            .forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        };
        btnContainer.append(btn);
      });
      row.append(btnContainer);

      // Individual Send button
      const sendBtn = document.createElement('button');
      sendBtn.textContent = 'Send';
      sendBtn.className = 'send-btn';
      sendBtn.onclick = () => {
        if (!dateInput.value) {
          return alert('Select a date first.');
        }
        const code = dayData[student.roll] || '';
        const status = getStatusText(code);
        if (!student.parentContact) {
          return alert(`No contact for ${student.name}.`);
        }
        const msg = 
          `Dear Parent,\\n\\n` +
          `Attendance for ${student.name} (Roll: ${student.roll}) on ${date} is: ${status}.\\n\\n` +
          `Regards,\\nSchool Administration`;
        const url =
          'https://api.whatsapp.com/send?phone=' +
          encodeURIComponent(student.parentContact) +
          '&text=' +
          encodeURIComponent(msg);
        window.open(url, '_blank');
      };
      row.append(sendBtn);

      attendanceListEl.append(row);
      attendanceData[date] = dayData;
    });

    saveAttendance();
  }

  // Load attendance
  loadAttendanceBtn.onclick = () => {
    const d = dateInput.value;
    if (!d) {
      return alert('Select a date.');
    }
    renderAttendance(d);
  };

  // Save attendance
  saveAttendanceBtn.onclick = () => {
    const d = dateInput.value;
    if (!d) {
      return alert('Select a date.');
    }
    saveAttendance();
    alert(`Attendance saved for ${d}.`);
  };

  // Download daily PDF report
  downloadDailyPdfBtn.onclick = () => {
    const d = dateInput.value;
    if (!d) {
      return alert('Select a date for report.');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Daily Attendance for ${d} (Class: ${teacherClass})`, 10, 10);
    let y = 20;
    const dayData = attendanceData[d] || {};
    students.filter(s => s.class === teacherClass)
      .forEach(stu => {
        doc.text(
          `${stu.roll} - ${stu.name}: ${getStatusText(dayData[stu.roll])}`,
          10, y
        );
        y += 10;
      });
    doc.save(`Daily_Attendance_${d}.pdf`);
  };

  // Share daily on WhatsApp
  shareDailyWhatsAppBtn.onclick = () => {
    const d = dateInput.value;
    if (!d) {
      return alert('Select a date for report.');
    }
    let msg = `Daily Attendance for ${d} (Class: ${teacherClass})\\n\\n`;
    const dayData = attendanceData[d] || {};
    students.filter(s => s.class === teacherClass)
      .forEach(stu => {
        msg += `${stu.roll} - ${stu.name}: ${getStatusText(dayData[stu.roll])}\\n`;
      });
    window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(msg), '_blank');
  };

  // Bulk send to all parents
  sendParentsBtn.onclick = () => {
    const d = dateInput.value;
    if (!d) {
      return alert('Select a date.');
    }
    const dayData = attendanceData[d] || {};
    students.filter(s => s.class === teacherClass)
      .forEach((stu, i) => {
        if (!stu.parentContact) return;
        const msg =
          `Dear Parent,\\n\\n` +
          `Attendance for ${stu.name} (Roll: ${stu.roll}) on ${d} is: ${getStatusText(dayData[stu.roll])}.\\n\\n` +
          `Regards,\\nSchool Administration`;
        setTimeout(() => {
          window.open(
            'https://api.whatsapp.com/send?phone=' +
            encodeURIComponent(stu.parentContact) +
            '&text=' +
            encodeURIComponent(msg),
            '_blank'
          );
        }, i * 1500);
      });
  };

  // Initial setup
  updateDisplays();
  renderStudents();
});
