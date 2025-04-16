document.addEventListener("DOMContentLoaded", function() {
  const studentListEl = document.getElementById('students');
  const addStudentBtn = document.getElementById('addStudent');
  const studentNameInput = document.getElementById('studentName');
  const attendanceListEl = document.getElementById('attendanceList');
  const saveAttendanceBtn = document.getElementById('saveAttendance');
  const loadAttendanceBtn = document.getElementById('loadAttendance');
  const dateInput = document.getElementById('dateInput');
  const exportPdfBtn = document.getElementById('exportPdf');
  const shareWhatsAppBtn = document.getElementById('shareWhatsApp');
  
  // لوکل اسٹوریج سے ڈیٹا لوڈ کریں
  let students = JSON.parse(localStorage.getItem('students')) || [];
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || {};

  // طلباء کی فہرست کو رینڈر کریں
  function renderStudents() {
    studentListEl.innerHTML = "";
    students.forEach((student, index) => {
      const li = document.createElement('li');
      li.textContent = student;
      
      // طالب علم ڈیلیٹ کرنے کا بٹن
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = "Delete";
      deleteBtn.onclick = function() {
        students.splice(index, 1);
        localStorage.setItem('students', JSON.stringify(students));
        renderStudents();
      };
      
      li.appendChild(deleteBtn);
      studentListEl.appendChild(li);
    });
  }
  
  // طالب علم شامل کرنے کا بٹن ایکشن
  addStudentBtn.addEventListener('click', function() {
    const name = studentNameInput.value.trim();
    if(name) {
      students.push(name);
      localStorage.setItem('students', JSON.stringify(students));
      studentNameInput.value = "";
      renderStudents();
    }
  });
  
  // مخصوص تاریخ کے لیے اٹینڈنس کی معلومات رینڈر کریں
  function renderAttendanceForDate(date) {
    attendanceListEl.innerHTML = "";
    let attendanceForDate = attendanceData[date] || {};
    
    students.forEach(student => {
      const div = document.createElement('div');
      div.classList.add('attendance-item');
      
      const label = document.createElement('label');
      label.textContent = student;
      
      const checkbox = document.createElement('input');
      checkbox.type = "checkbox";
      checkbox.checked = attendanceForDate[student] || false;
      checkbox.addEventListener('change', function() {
        attendanceForDate[student] = this.checked;
      });
      
      div.appendChild(label);
      div.appendChild(checkbox);
      attendanceListEl.appendChild(div);
    });
    
    attendanceData[date] = attendanceForDate;
  }
  
  // تاریخ سلیکٹ کرکے اٹینڈنس لوڈ کریں
  loadAttendanceBtn.addEventListener('click', function() {
    const date = dateInput.value;
    if(date) {
      renderAttendanceForDate(date);
    }
  });
  
  // اٹینڈنس ڈیٹا کو محفوظ کریں
  saveAttendanceBtn.addEventListener('click', function() {
    const date = dateInput.value;
    if(date) {
      localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
      alert('Attendance saved for ' + date);
    }
  });
  
  // PDF ایکسپورٹ کا بٹن
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
    if(attendanceData[date]) {
      for(let student in attendanceData[date]) {
        let status = attendanceData[date][student] ? "Present" : "Absent";
        doc.text(`${student}: ${status}`, 10, y);
        y += 10;
      }
    } else {
      doc.text("No attendance data available.", 10, y);
    }
    doc.save("attendance_" + date + ".pdf");
  });
  
  // WhatsApp شیئرنگ کا بٹن
  shareWhatsAppBtn.addEventListener('click', function() {
    const date = dateInput.value;
    if(!date) {
      alert("Please select a date for the report.");
      return;
    }
    let message = "Attendance Report for " + date + "\n";
    if(attendanceData[date]) {
      for(let student in attendanceData[date]) {
        let status = attendanceData[date][student] ? "Present" : "Absent";
        message += `${student}: ${status}\n`;
      }
    } else {
      message += "No attendance data available.";
    }
    const whatsappUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(message);
    window.open(whatsappUrl, '_blank');
  });
  
  // ابتدائی رینڈر
  renderStudents();
});
