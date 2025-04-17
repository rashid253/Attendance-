document.addEventListener("DOMContentLoaded", function() {
  const allowedClasses = [
    "Play Group","Nursery","Prep","Pre One",
    "One","Two","Three","Four","Five",
    "Six","Seven","Eight","Nine","Ten"
  ];

  // Helper: concise status text
  function getConciseStatus(status) {
    switch(status) {
      case "P": return "Present";
      case "A": return "Absent";
      case "L": return "Late";
      case "Le": return "Leave";
      default: return "Not Marked";
    }
  }

  // Elements
  const teacherClassSelect = document.getElementById("teacherClassSelect");
  const saveTeacherClassBtn = document.getElementById("saveTeacherClass");
  const teacherClassDisplay = document.getElementById("teacherClassDisplay");
  const teacherClassDisplayRegistration = document.getElementById("teacherClassDisplayRegistration");
  const teacherClassDisplayAttendance = document.getElementById("teacherClassDisplayAttendance");
  const teacherClassHeader = document.getElementById("teacherClassHeader");

  const studentNameInput = document.getElementById('studentName');
  const parentContactInput = document.getElementById('parentContact');
  const addStudentBtn = document.getElementById('addStudent');
  const studentsListEl = document.getElementById('students');

  const dateInput = document.getElementById('dateInput');
  const loadAttendanceBtn = document.getElementById('loadAttendance');
  const attendanceListEl = document.getElementById('attendanceList');
  const saveAttendanceBtn = document.getElementById('saveAttendance');

  const downloadDailyPdfBtn = document.getElementById('downloadDailyPdf');
  const shareDailyWhatsAppBtn = document.getElementById('shareDailyWhatsApp');
  const sendParentsBtn = document.getElementById('sendParents');

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
    const clsSt = students.filter(s=>s.class===cls);
    return clsSt.length===0 ? 1 : Math.max(...clsSt.map(s=>+s.roll))+1;
  }

  function renderStudents() {
    studentsListEl.innerHTML = "";
    students.filter(s=>s.class===teacherClass).forEach(student=>{
      const li = document.createElement('li');
      li.textContent = `${student.roll} - ${student.name}`;
      const act = document.createElement('div'); act.className="action-buttons";
      const e = document.createElement('button'); e.textContent="Edit";
      e.onclick=()=>{ let n=prompt("New name:",student.name); if(n){ student.name=n; localStorage.setItem('students',JSON.stringify(students)); renderStudents(); } };
      const d = document.createElement('button'); d.textContent="Delete";
      d.onclick=()=>{ if(confirm(`Delete ${student.name}?`)){ students=students.filter(x=>x.roll!==student.roll||x.class!==teacherClass); localStorage.setItem('students',JSON.stringify(students)); renderStudents(); } };
      act.append(e,d); li.append(act); studentsListEl.append(li);
    });
  }

  addStudentBtn.onclick = ()=>{
    if(!teacherClass){ alert("Select class first."); return; }
    const name=studentNameInput.value.trim(), pc=parentContactInput.value.trim();
    if(!name){ alert("Enter student name."); return; }
    const roll=generateRollNumber(teacherClass);
    students.push({roll,name,class:teacherClass,parentContact:pc});
    localStorage.setItem('students',JSON.stringify(students));
    studentNameInput.value=parentContactInput.value="";
    renderStudents();
  };

  function renderAttendanceForDate(date) {
    attendanceListEl.innerHTML="";
    const classStudents=students.filter(s=>s.class===teacherClass);
    let attForDate=attendanceData[date]||{};
    classStudents.forEach(student=>{
      const div=document.createElement('div'); div.className="attendance-item";
      const lbl=document.createElement('label');
      lbl.textContent=`${student.roll} - ${student.name}`; div.append(lbl);

      const btns=document.createElement('div'); btns.className="attendance-buttons";
      ["P","A","L","Le"].forEach(code=>{
        const b=document.createElement('button'); b.textContent=code; b.className="att-btn";
        if(attForDate[student.roll]===code) b.classList.add('selected');
        b.onclick=()=>{
          attForDate[student.roll]=code;
          btns.querySelectorAll('.att-btn').forEach(x=>x.classList.remove('selected'));
          b.classList.add('selected');
        };
        btns.append(b);
      });
      div.append(btns);

      const send=document.createElement('button');
      send.textContent="Send"; send.className="send-btn";
      send.onclick=()=>{
        if(!dateInput.value){ alert("Select date first."); return; }
        const st=attForDate[student.roll]||"Not Marked";
        const msg=`Dear Parent,\n\nAttendance for your child (${student.name}, Roll: ${student.roll}) on ${date} (Class: ${teacherClass}) is: ${getConciseStatus(st)}.\n\nRegards,\nSchool Administration`;
        if(!student.parentContact){ alert(`No contact for ${student.name}`); return; }
        window.open("https://api.whatsapp.com/send?phone="+encodeURIComponent(student.parentContact)+
                    "&text="+encodeURIComponent(msg), '_blank');
      };
      div.append(send);
      attendanceListEl.append(div);
    });
    attendanceData[date]=attForDate;
  }

  loadAttendanceBtn.onclick=()=>{
    const d=dateInput.value||alert("Select date."),_d=dateInput.value;
    if(_d) renderAttendanceForDate(_d);
  };
  saveAttendanceBtn.onclick=()=>{
    const d=dateInput.value||alert("Select date.");
    if(d) { localStorage.setItem('attendanceData',JSON.stringify(attendanceData)); alert(`Attendance saved for ${d}`); }
  };

  // Daily PDF
  downloadDailyPdfBtn.onclick=()=>{
    const { jsPDF }=window.jspdf; const d=dateInput.value||alert("Select date.");
    if(!d) return;
    const doc=new jsPDF();
    doc.text(`Daily Attendance for ${d} (Class: ${teacherClass})`,10,10);
    let y=20; (attendanceData[d]||{}) && students.filter(s=>s.class===teacherClass).forEach(stu=>{
      doc.text(`${stu.roll} - ${stu.name}: ${getConciseStatus((attendanceData[d]||{})[stu.roll])}`,10,y);
      y+=10;
    });
    doc.save(`Daily_Attendance_${d}.pdf`);
  };

  shareDailyWhatsAppBtn.onclick=()=>{
    const d=dateInput.value||alert("Select date."); if(!d) return;
    let msg=`Daily Attendance for ${d} (Class: ${teacherClass})\n\n`;
    students.filter(s=>s.class===teacherClass).forEach(stu=>{
      msg+=`${stu.roll} - ${stu.name}: ${getConciseStatus((attendanceData[d]||{})[stu.roll])}\n`;
    });
    window.open("https://api.whatsapp.com/send?text="+encodeURIComponent(msg), '_blank');
  };

  // Bulk send to parents (unchanged)
  sendParentsBtn.onclick=()=>{
    const d=dateInput.value||alert("Select date."); if(!d) return;
    let att=attendanceData[d]||{};
    students.filter(s=>s.class===teacherClass).forEach((stu,i)=>{
      if(stu.parentContact){
        const st=att[stu.roll]||"Not Marked";
        const msg=`Dear Parent,\n\nAttendance for your child (${stu.name}, Roll: ${stu.roll}) on ${d} (Class: ${teacherClass}) is: ${getConciseStatus(st)}.\n\nRegards,\nSchool Administration`;
        setTimeout(()=>window.open("https://api.whatsapp.com/send?phone="+encodeURIComponent(stu.parentContact)+
          "&text="+encodeURIComponent(msg),'_blank'), i*1500);
      }
    });
  };

  renderStudents();
});
