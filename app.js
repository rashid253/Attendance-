// app.js
document.addEventListener("DOMContentLoaded", () => {
  // === Helpers ===
  function getStatusText(s) {
    return {
      P: "Present. Thank you for ensuring your child’s punctuality.",
      A: "Absent. Please contact the school for further details.",
      L: "Late. Kindly ensure your child arrives on time.",
      Le: "Leave. Your child's leave request has been approved."
    }[s] || "Not Marked";
  }

  function showModal(modal) { modal.style.display = "block"; }
  function closeModal(modal){ modal.style.display = "none"; }

  // === Refs ===
  const teacherClassSelect = document.getElementById("teacherClassSelect");
  const saveTeacherClassBtn = document.getElementById("saveTeacherClass");
  const teacherClassDisplay = document.getElementById("teacherClassDisplay");
  const teacherClassHeader  = document.getElementById("teacherClassHeader");

  const studentNameInput   = document.getElementById("studentName");
  const parentContactInput = document.getElementById("parentContact");
  const addStudentBtn      = document.getElementById("addStudent");
  const studentsListEl     = document.getElementById("students");

  const dateInput         = document.getElementById("dateInput");
  const loadAttendanceBtn = document.getElementById("loadAttendance");
  const attendanceListEl  = document.getElementById("attendanceList");
  const saveAttendanceBtn = document.getElementById("saveAttendance");

  const exportPdfBtn     = document.getElementById("exportPdf");
  const shareWhatsAppBtn = document.getElementById("shareWhatsApp");

  const pdfModal     = document.getElementById("pdfOptionsModal");
  const pdfCurBtn    = document.getElementById("pdfCurrentReportBtn");
  const pdfDayBtn    = document.getElementById("pdfDailyReportBtn");
  const pdfMonBtn    = document.getElementById("pdfMonthlyReportBtn");
  const pdfCloseBtn  = document.getElementById("closePdfModalBtn");

  const waModal      = document.getElementById("whatsappOptionsModal");
  const waCurBtn     = document.getElementById("waCurrentBtn");
  const waDayBtn     = document.getElementById("waDailyBtn");
  const waMonBtn     = document.getElementById("waMonthlyBtn");
  const waCloseBtn   = document.getElementById("closeWaModalBtn");
  const waMonthInput = document.getElementById("waMonthInput");

  // === Storage ===
  let teacherClass   = localStorage.getItem("teacherClass")   || "";
  let students       = JSON.parse(localStorage.getItem("students"))       || [];
  let attendanceData = JSON.parse(localStorage.getItem("attendanceData")) || {};

  // === Init ===
  updateClassDisplays();
  renderStudents();

  // === Teacher Setup ===
  saveTeacherClassBtn.addEventListener("click", () => {
    const c = teacherClassSelect.value;
    if (!c) return alert("Please select a class.");
    teacherClass = c;
    localStorage.setItem("teacherClass", c);
    updateClassDisplays();
    renderStudents();
  });

  // === Student Registration ===
  addStudentBtn.addEventListener("click", () => {
    if (!teacherClass) return alert("Select your class first.");
    const name = studentNameInput.value.trim();
    const pc   = parentContactInput.value.trim();
    if (!name) return alert("Enter student name.");
    const roll = generateRoll(teacherClass);
    students.push({ roll, name, class: teacherClass, parentContact: pc });
    localStorage.setItem("students", JSON.stringify(students));
    studentNameInput.value = parentContactInput.value = "";
    renderStudents();
  });

  // === Attendance ===
  loadAttendanceBtn.addEventListener("click", () => {
    if (!dateInput.value) {
      dateInput.showPicker?.() ?? dateInput.focus();
      return;
    }
    renderAttendance(dateInput.value);
  });

  saveAttendanceBtn.addEventListener("click", () => {
    if (!dateInput.value) {
      dateInput.showPicker?.() ?? dateInput.focus();
      return;
    }
    localStorage.setItem("attendanceData", JSON.stringify(attendanceData));
    alert("Saved attendance for " + dateInput.value);
  });

  // === PDF Modal ===
  exportPdfBtn.addEventListener("click", () => showModal(pdfModal));
  pdfCloseBtn.addEventListener("click", () => closeModal(pdfModal));

  pdfCurBtn.addEventListener("click", () => {
    const d = dateInput.value || new Date().toISOString().slice(0,10);
    generatePdf("Current Attendance", d);
    closeModal(pdfModal);
  });

  pdfDayBtn.addEventListener("click", () => {
    if (!dateInput.value) {
      dateInput.showPicker?.() ?? dateInput.focus();
      return;
    }
    generatePdf("Daily Attendance", dateInput.value);
    closeModal(pdfModal);
  });

  pdfMonBtn.addEventListener("click", () => {
    const m = waMonthInput.value;
    if (!m) {
      waMonthInput.showPicker?.() ?? waMonthInput.focus();
      return;
    }
    generateMonthlyPdf(m);
    closeModal(pdfModal);
  });

  // === WhatsApp Modal ===
  shareWhatsAppBtn.addEventListener("click", () => showModal(waModal));
  waCloseBtn.addEventListener("click", () => closeModal(waModal));

  waCurBtn.addEventListener("click", () => {
    const d = dateInput.value || new Date().toISOString().slice(0,10);
    sendWhatsApp("Current Attendance", d);
    closeModal(waModal);
  });

  waDayBtn.addEventListener("click", () => {
    if (!dateInput.value) {
      dateInput.showPicker?.() ?? dateInput.focus();
      return;
    }
    sendWhatsApp("Daily Attendance", dateInput.value);
    closeModal(waModal);
  });

  waMonBtn.addEventListener("click", () => {
    const m = waMonthInput.value;
    if (!m) {
      waMonthInput.showPicker?.() ?? waMonthInput.focus();
      return;
    }
    sendWhatsAppMonthly(m);
    closeModal(waModal);
  });

  // === Functions ===
  function updateClassDisplays() {
    teacherClassDisplay.textContent = teacherClass || "None";
    teacherClassHeader.textContent  = teacherClass || "None";
  }

  function generateRoll(cls) {
    const clsStud = students.filter(s => s.class === cls);
    return clsStud.length
      ? Math.max(...clsStud.map(s => +s.roll)) + 1
      : 1;
  }

  function renderStudents() {
    studentsListEl.innerHTML = "";
    students
      .filter(s => s.class === teacherClass)
      .forEach(s => {
        const li = document.createElement("li");
        li.textContent = `${s.roll} - ${s.name}`;
        const actions = document.createElement("div");
        actions.className = "action-buttons";
        const e = document.createElement("button"); e.textContent="Edit";
        e.onclick = () => {
          const n = prompt("New name:", s.name);
          if (!n) return;
          s.name = n.trim();
          localStorage.setItem("students", JSON.stringify(students));
          renderStudents();
        };
        const d = document.createElement("button"); d.textContent="Delete";
        d.onclick = () => {
          if (!confirm("Delete " + s.name + "?")) return;
          students = students.filter(x => x !== s);
          localStorage.setItem("students", JSON.stringify(students));
          renderStudents();
        };
        actions.append(e,d);
        li.append(actions);
        studentsListEl.append(li);
      });
  }

  function renderAttendance(date) {
    attendanceListEl.innerHTML = "";
    const clsStud = students.filter(s => s.class === teacherClass);
    const ad = attendanceData[date] || {};
    clsStud.forEach(s => {
      const div = document.createElement("div");
      div.className = "attendance-item";
      const lbl = document.createElement("label");
      lbl.textContent = `${s.roll} - ${s.name}`;
      const bc = document.createElement("div");
      bc.className = "attendance-buttons";
      ["P","A","L","Le"].forEach(opt => {
        const b = document.createElement("button");
        b.className = "att-btn";
        b.textContent = opt;
        if (ad[s.roll] === opt) b.classList.add("selected");
        b.onclick = () => {
          ad[s.roll] = opt;
          bc.querySelectorAll("button").forEach(x => x.classList.remove("selected"));
          b.classList.add("selected");
        };
        bc.append(b);
      });
      const send = document.createElement("button");
      send.className = "send-btn";
      send.textContent = "Send";
      send.onclick = () => {
        if (!dateInput.value) return;
        const st = getStatusText(ad[s.roll]||"");
        const msg = `Attendance for ${s.name} (Roll:${s.roll}) on ${dateInput.value} (Class:${teacherClass}):\n${st}`;
        window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(msg));
      };
      div.append(lbl, bc, send);
      attendanceListEl.append(div);
    });
    attendanceData[date] = ad;
  }

  function generatePdf(title, d) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`${title} for ${d} (Class:${teacherClass})`, 10, 10);
    let y = 20;
    const ad = attendanceData[d]||{};
    students.filter(s=>s.class===teacherClass).forEach(s=>{
      doc.text(`${s.roll}-${s.name}: ${getStatusText(ad[s.roll]||"")}`,10,y);
      y+=10;
    });
    doc.save(`${title.replace(/\s+/g,"_")}_${d}.pdf`);
  }

  function generateMonthlyPdf(m) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("l","pt","a4");
    doc.text(`Monthly Attendance for ${m} (Class:${teacherClass})`,20,30);
    const cols = ["Roll","Name",...Array.from({length:31},(_,i)=>""+(i+1))];
    const rows = students.filter(s=>s.class===teacherClass).map(s=>{
      return [s.roll,s.name,
        ...Array.from({length:31},(_,i)=>{
          const key=`${m}-${String(i+1).padStart(2,"0")}`;
          return attendanceData[key]?.[s.roll]||"";
        })
      ];
    });
    doc.autoTable({ head:[cols], body:rows, startY:50, theme:"grid",
                    styles:{fontSize:8}, headStyles:{fillColor:[33,150,243]} });
    doc.save(`Monthly_Attendance_${m}.pdf`);
  }

  function sendWhatsApp(title, d) {
    let msg = `${title} for ${d} (Class:${teacherClass})\n\n`;
    const ad = attendanceData[d]||{};
    students.filter(s=>s.class===teacherClass).forEach(s=>{
      msg += `${s.roll}-${s.name}: ${getStatusText(ad[s.roll]||"")}\n`;
    });
    window.open("https://api.whatsapp.com/send?text="+encodeURIComponent(msg),"_blank");
  }

  function sendWhatsAppMonthly(m) {
    let msg = `Monthly Attendance for ${m} (Class:${teacherClass})\nRoll-Name`;
    for(let i=1;i<=31;i++) msg += ` | ${i}`; msg+="\n";
    students.filter(s=>s.class===teacherClass).forEach(s=>{
      msg+=`${s.roll}-${s.name}`;
      for(let i=1;i<=31;i++){
        const key=`${m}-${String(i).padStart(2,"0")}`;
        msg+=` | ${attendanceData[key]?.[s.roll]||""}`;
      }
      msg+="\n";
    });
    window.open("https://api.whatsapp.com/send?text="+encodeURIComponent(msg),"_blank");
  }
});
