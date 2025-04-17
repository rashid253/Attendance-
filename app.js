// app.js
document.addEventListener("DOMContentLoaded", () => {
  // === Helpers ===
  function getStatusText(s) {
    return { P:"Present", A:"Absent", L:"Late", Le:"Leave" }[s] || "-";
  }
  function showModal(m){ m.style.display="block"; }
  function closeModal(m){ m.style.display="none"; }

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

  const waModal        = document.getElementById("whatsappOptionsModal");
  const waCurrentBtn   = document.getElementById("waCurrentBtn");
  const waDailyBtn     = document.getElementById("waDailyBtn");
  const waMonthlyBtn   = document.getElementById("waMonthlyBtn");
  const waMonthInput   = document.getElementById("waMonthInput");
  const waCloseBtn     = document.getElementById("closeWaModalBtn");

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
    if (!dateInput.value) { dateInput.showPicker?.() ?? dateInput.focus(); return; }
    renderAttendance(dateInput.value);
  });
  saveAttendanceBtn.addEventListener("click", () => {
    if (!dateInput.value) { dateInput.showPicker?.() ?? dateInput.focus(); return; }
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
    if (!dateInput.value) { dateInput.showPicker?.() ?? dateInput.focus(); return; }
    generatePdf("Daily Attendance", dateInput.value);
    closeModal(pdfModal);
  });
  pdfMonBtn.addEventListener("click", () => {
    const m = waMonthInput.value;
    if (!m) { waMonthInput.showPicker?.() ?? waMonthInput.focus(); return; }
    generateMonthlyPdf(m);
    closeModal(pdfModal);
  });

  // === WhatsApp Modal ===
  shareWhatsAppBtn.addEventListener("click", () => {
    resetWaButtons();
    showModal(waModal);
  });
  waCloseBtn.addEventListener("click", () => closeModal(waModal));

  // Enable Daily btn when date selected
  dateInput.addEventListener("input", () => {
    if (dateInput.value) {
      waDailyBtn.classList.remove("disabled");
      waDailyBtn.classList.add("active");
    } else {
      waDailyBtn.classList.remove("active");
      waDailyBtn.classList.add("disabled");
    }
  });

  // Enable Monthly btn when month selected
  waMonthInput.addEventListener("input", () => {
    if (waMonthInput.value) {
      waMonthlyBtn.classList.remove("disabled");
      waMonthlyBtn.classList.add("active");
    } else {
      waMonthlyBtn.classList.remove("active");
      waMonthlyBtn.classList.add("disabled");
    }
  });

  // Button handlers
  waCurrentBtn.addEventListener("click", () => {
    sendWhatsApp("Current Attendance", dateInput.value || new Date().toISOString().slice(0,10));
    closeModal(waModal);
  });
  waDailyBtn.addEventListener("click", () => {
    if (!dateInput.value) return alert("Please select a date first.");
    sendWhatsApp("Daily Attendance", dateInput.value);
    closeModal(waModal);
  });
  waMonthlyBtn.addEventListener("click", () => {
    if (!waMonthInput.value) return alert("Please select a month first.");
    sendWhatsAppMonthly(waMonthInput.value);
    closeModal(waModal);
  });

  // Reset WA modal buttons
  function resetWaButtons() {
    waCurrentBtn.classList.add("active");
    waDailyBtn.classList.remove("active"); waDailyBtn.classList.add("disabled");
    waMonthlyBtn.classList.remove("active"); waMonthlyBtn.classList.add("disabled");
    waMonthInput.value = "";
  }

  // === Core Functions (renderAttendance, generatePdf, etc.) ===
  // ... (same as before) ...

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
    students.filter(s => s.class === teacherClass).forEach(s => {
      const li = document.createElement("li");
      li.textContent = `${s.roll} - ${s.name}`;
      const actions = document.createElement("div");
      actions.className = "action-buttons";
      const e = document.createElement("button"); e.textContent = "Edit";
      e.onclick = () => { /* edit logic */ };
      const d = document.createElement("button"); d.textContent = "Delete";
      d.onclick = () => { /* delete logic */ };
      actions.append(e, d);
      li.append(actions);
      studentsListEl.append(li);
    });
  }
  function renderAttendance(date) {
    attendanceListEl.innerHTML = "";
    const ad = attendanceData[date] || {};
    students.filter(s=>s.class===teacherClass).forEach(s => {
      /* render each student’s buttons and Send button */
    });
    attendanceData[date] = ad;
  }
  function generatePdf(title, d) { /* ... */ }
  function generateMonthlyPdf(m) { /* ... */ }
  function sendWhatsApp(title, d) {
    let msg = `${title} for ${d} (Class:${teacherClass})\n\n`;
    const ad = attendanceData[d] || {};
    students.filter(s=>s.class===teacherClass).forEach(s => {
      msg += `${s.roll}-${s.name}: ${getStatusText(ad[s.roll]||"-")}\n`;
    });
    window.open("https://api.whatsapp.com/send?text="+encodeURIComponent(msg), "_blank");
  }
  function sendWhatsAppMonthly(m) {
    let msg = `Monthly Attendance for ${m} (Class:${teacherClass})\n\n`;
    students.filter(s=>s.class===teacherClass).forEach(s => {
      const parts = [];
      for (let d=1; d<=31; d++) {
        const dd = String(d).padStart(2,"0");
        const key = `${m}-${dd}`;
        const st  = (attendanceData[key]||{})[s.roll] || "-";
        parts.push(`${dd}:${st}`);
      }
      msg += `${s.roll}-${s.name}: ${parts.join(", ")}\n`;
    });
    window.open("https://api.whatsapp.com/send?text="+encodeURIComponent(msg), "_blank");
  }
});
