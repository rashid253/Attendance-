document.addEventListener("DOMContentLoaded", () => {
  // Allowed classes
  const allowedClasses = [
    "Play Group","Nursery","Prep","Pre One",
    "One","Two","Three","Four","Five",
    "Six","Seven","Eight","Nine","Ten"
  ];

  // Concise status text for reports
  function getConciseStatus(code) {
    switch(code) {
      case "P": return "Present";
      case "A": return "Absent";
      case "L": return "Late";
      case "Le": return "Leave";
      default:   return "Not Marked";
    }
  }

  // Elements
  const teacherClassSelect = $("#teacherClassSelect");
  const saveTeacherClassBtn = $("#saveTeacherClass");
  const teacherClassDisplay        = $("#teacherClassDisplay");
  const teacherClassDisplayReg     = $("#teacherClassDisplayRegistration");
  const teacherClassDisplayAtt     = $("#teacherClassDisplayAttendance");
  const teacherClassHeader         = $("#teacherClassHeader");

  const studentNameInput   = $("#studentName");
  const parentContactInput = $("#parentContact");
  const addStudentBtn      = $("#addStudent");
  const studentsListEl     = $("#students");

  const dateInput        = $("#dateInput");
  const loadAttendanceBtn = $("#loadAttendance");
  const attendanceListEl = $("#attendanceList");
  const saveAttendanceBtn = $("#saveAttendance");

  const downloadDailyPdfBtn    = $("#downloadDailyPdf");
  const shareDailyWhatsAppBtn  = $("#shareDailyWhatsApp");
  const sendParentsBtn         = $("#sendParents");

  // Load from localStorage
  let teacherClass = localStorage.getItem('teacherClass') || "";
  let students     = JSON.parse(localStorage.getItem('students')) || [];
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || {};

  // Utility to get element by ID
  function $(id) { return document.getElementById(id); }

  // Update class displays
  function updateClassDisplays() {
    teacherClassDisplay.textContent = teacherClass || "None";
    teacherClassDisplayReg.textContent = teacherClass || "None";
    teacherClassDisplayAtt.textContent = teacherClass || "None";
    teacherClassHeader.textContent = teacherClass || "None";
  }

  saveTeacherClassBtn.addEventListener('click', () => {
    const cls = teacherClassSelect.value;
    if (!allowedClasses.includes(cls)) {
      return alert("Please select a valid class.");
    }
    teacherClass = cls;
    localStorage.setItem('teacherClass', cls);
    updateClassDisplays();
    renderStudents();
  });

  updateClassDisplays();

  // Roll number generator
  function generateRoll() {
    const clsSt = students.filter(s=>s.class===teacherClass);
    return clsSt.length === 0
      ? 1
      : Math.max(...clsSt.map(s=>+s.roll)) + 1;
  }

  // Render student list
  function renderStudents() {
    studentsListEl.innerHTML = "";
    students
      .filter(s=>s.class===teacherClass)
      .forEach(student => {
        const li = document.createElement('li');
        li.textContent = `${student.roll} - ${student.name}`;
        const actions = document.createElement('div');
        actions.className = "action-buttons";

        const editBtn = document.createElement('button');
        editBtn.textContent = "Edit";
        editBtn.onclick = () => {
          const n = prompt("New name:", student.name);
          if (!n) return;
          student.name = n.trim();
          localStorage.setItem('students', JSON.stringify(students));
          renderStudents();
        };

        const delBtn = document.createElement('button');
        delBtn.textContent = "Delete";
        delBtn.onclick = () => {
          if (!confirm(`Delete ${student.name}?`)) return;
          students = students.filter(s=>!(s.roll===student.roll && s.class===teacherClass));
          localStorage.setItem('students', JSON.stringify(students));
          renderStudents();
        };

        actions.append(editBtn, delBtn);
        li.append(actions);
        studentsListEl.append(li);
      });
  }

  // Add student
  addStudentBtn.onclick = () => {
    if (!teacherClass) return alert("Please select your class first.");
    const name = studentNameInput.value.trim();
    if (!name) return alert("Enter student name.");
    const contact = parentContactInput.value.trim();
    const roll = generateRoll();
    students.push({ roll, name, class: teacherClass, parentContact: contact });
    localStorage.setItem('students', JSON.stringify(students));
    studentNameInput.value = parentContactInput.value = "";
    renderStudents();
  };

  // Render attendance
  function renderAttendanceForDate(date) {
    attendanceListEl.innerHTML = "";
    const clsSt = students.filter(s=>s.class===teacherClass);
    const attForDate = attendanceData[date] || {};

    clsSt.forEach(student => {
      const row = document.createElement('div');
      row.className = "attendance-item";
      const lbl = document.createElement('label');
      lbl.textContent = `${student.roll} - ${student.name}`;
      row.append(lbl);

      const btns = document.createElement('div');
      btns.className = "attendance-buttons";
      ["P","A","L","Le"].forEach(code => {
        const b = document.createElement('button');
        b.textContent = code;
        b.className = "att-btn";
        if (attForDate[student.roll] === code) b.classList.add('selected');
        b.onclick = () => {
          attForDate[student.roll] = code;
          btns.querySelectorAll('.att-btn').forEach(x=>x.classList.remove('selected'));
          b.classList.add('selected');
        };
        btns.append(b);
      });
      row.append(btns);

      const send = document.createElement('button');
      send.textContent = "Send";
      send.className = "send-btn";
      send.onclick = () => {
        if (!dateInput.value) return alert("Select date first.");
        const code = attForDate[student.roll] || "";
        const status = getConciseStatus(code);
        const msg = 
          `Dear Parent,\n\n` +
          `Attendance for ${student.name} (Roll: ${student.roll}) on ${date} is: ${status}.\n\n` +
          `Regards,\nSchool Administration`;
        if (!student.parentContact) return alert(`No contact for ${student.name}`);
        const url = 
          "https://api.whatsapp.com/send?phone=" +
          encodeURIComponent(student.parentContact) +
          "&text=" +
          encodeURIComponent(msg);
        window.open(url, '_blank');
      };
      row.append(send);

      attendanceListEl.append(row);
      attendanceData[date] = attForDate;
    });
  }

  loadAttendanceBtn.onclick = () => {
    const d = dateInput.value;
    if (!d) return alert("Select date.");
    renderAttendanceForDate(d);
  };

  saveAttendanceBtn.onclick = () => {
    const d = dateInput.value;
    if (!d) return alert("Select date.");
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    alert(`Attendance saved for ${d}`);
  };

  // Daily PDF report
  downloadDailyPdfBtn.onclick = () => {
    const d = dateInput.value;
    if (!d) return alert("Select date for report.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Daily Attendance for ${d} (Class: ${teacherClass})`, 10, 10);
    let y = 20;
    const att = attendanceData[d] || {};
    students.filter(s=>s.class===teacherClass).forEach(stu => {
      doc.text(
        `${stu.roll} - ${stu.name}: ${getConciseStatus(att[stu.roll])}`, 
        10, y
      );
      y += 10;
    });
    doc.save(`Daily_Attendance_${d}.pdf`);
  };

  // Share daily via WhatsApp
  shareDailyWhatsAppBtn.onclick = () => {
    const d = dateInput.value;
    if (!d) return alert("Select date for report.");
    let msg = `Daily Attendance for ${d} (Class: ${teacherClass})\n\n`;
    const att = attendanceData[d] || {};
    students.filter(s=>s.class===teacherClass).forEach(stu => {
      msg += `${stu.roll} - ${stu.name}: ${getConciseStatus(att[stu.roll])}\n`;
    });
    const url = "https://api.whatsapp.com/send?text=" + encodeURIComponent(msg);
    window.open(url, '_blank');
  };

  // Bulk send to parents
  sendParentsBtn.onclick = () => {
    const d = dateInput.value;
    if (!d) return alert("Select date.");
    const att = attendanceData[d] || {};
    students.filter(s=>s.class===teacherClass).forEach((stu, i) => {
      if (!stu.parentContact) return;
      const msg = 
        `Dear Parent,\n\n` +
        `Attendance for ${stu.name} (Roll: ${stu.roll}) on ${d} is: ${getConciseStatus(att[stu.roll])}.\n\n` +
        `Regards,\nSchool Administration`;
      const url = 
        "https://api.whatsapp.com/send?phone=" +
        encodeURIComponent(stu.parentContact) +
        "&text=" +
        encodeURIComponent(msg);
      setTimeout(() => window.open(url, '_blank'), i * 1500);
    });
  };

  // Initial render
  renderStudents();
});
