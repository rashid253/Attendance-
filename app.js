// app.js
document.addEventListener("DOMContentLoaded", () => {
  // Helpers
  function getStatusText(s) {
    return {
      P: "Present",
      A: "Absent",
      L: "Leave",
      Lt: "Late",
      HD: "Half Day"
    }[s] || "-";
  }
  function showModal(m){ m.style.display="block"; }
  function closeModal(m){ m.style.display="none"; }

  // Refs
  const teacherClassSelect = document.getElementById("teacherClassSelect");
  const saveTeacherClass   = document.getElementById("saveTeacherClass");
  const teacherClassHeader = document.getElementById("teacherClassHeader");

  const studentNameInput   = document.getElementById("studentName");
  const admissionNoInput   = document.getElementById("admissionNo");
  const parentContactInput = document.getElementById("parentContact");
  const addStudentBtn      = document.getElementById("addStudent");
  const studentsListEl     = document.getElementById("students");

  const dateInput         = document.getElementById("dateInput");
  const loadAttendanceBtn = document.getElementById("loadAttendance");
  const attendanceListEl  = document.getElementById("attendanceList");
  const saveAttendanceBtn = document.getElementById("saveAttendance");

  const monthInput        = document.getElementById("monthInput");
  const loadMonthBtn      = document.getElementById("loadMonth");
  const monthTable        = document.getElementById("monthTable");
  const summaryReport     = document.getElementById("summaryReport");

  const exportPdfBtn      = document.getElementById("exportPdf");
  const shareWhatsAppBtn  = document.getElementById("shareWhatsApp");

  // Storage
  let teacherClass   = localStorage.getItem("teacherClass")   || "";
  let students       = JSON.parse(localStorage.getItem("students"))       || [];
  let attendanceData = JSON.parse(localStorage.getItem("attendanceData")) || {};

  // Init
  updateClassDisplay();
  renderStudents();

  // Teacher Setup
  saveTeacherClass.addEventListener("click", () => {
    const c = teacherClassSelect.value;
    if (!c) return alert("Select Class/Section");
    teacherClass = c;
    localStorage.setItem("teacherClass", c);
    updateClassDisplay();
    renderStudents();
  });

  // Student Registration
  addStudentBtn.addEventListener("click", () => {
    if (!teacherClass) return alert("Save class first");
    const name = studentNameInput.value.trim();
    if (!name) return alert("Enter student name");
    const roll = generateRoll(teacherClass);
    const adm  = admissionNoInput.value.trim();
    const pc   = parentContactInput.value.trim();
    students.push({ roll, name, admissionNo: adm, class: teacherClass, parentContact: pc });
    localStorage.setItem("students", JSON.stringify(students));
    studentNameInput.value = admissionNoInput.value = parentContactInput.value = "";
    renderStudents();
  });

  // Attendance
  loadAttendanceBtn.addEventListener("click", () => {
    if (!dateInput.value) return dateInput.showPicker?.() ?? dateInput.focus();
    renderAttendance(dateInput.value);
  });
  saveAttendanceBtn.addEventListener("click", () => {
    if (!dateInput.value) return dateInput.showPicker?.() ?? dateInput.focus();
    localStorage.setItem("attendanceData", JSON.stringify(attendanceData));
    alert("Saved for " + dateInput.value);
  });

  // Monthly View & Summary
  loadMonthBtn.addEventListener("click", () => {
    if (!monthInput.value) return;
    renderMonthTable(monthInput.value);
    renderSummary(monthInput.value);
  });

  // Reports & Sharing
  exportPdfBtn.addEventListener("click", () => {
    const m = monthInput.value;
    if (!m) return alert("Select month");
    // Implement PDF export of summary here...
    alert("PDF export coming soon");
  });
  shareWhatsAppBtn.addEventListener("click", () => {
    const m = monthInput.value;
    if (!m) return alert("Select month");
    sendWhatsAppMonthly(m);
  });

  // Functions
  function updateClassDisplay() {
    teacherClassHeader.textContent = teacherClass || "None";
  }

  function generateRoll(cls) {
    const list = students.filter(s => s.class === cls);
    return list.length ? Math.max(...list.map(s=>+s.roll)) + 1 : 1;
  }

  function renderStudents() {
    studentsListEl.innerHTML = "";
    students.filter(s => s.class === teacherClass)
      .forEach(s => {
        const li = document.createElement("li");
        li.textContent = `${s.roll} - ${s.name}`;
        const btns = document.createElement("div");
        btns.className = "action-buttons";
        const del = document.createElement("button");
        del.textContent = "Delete";
        del.onclick = () => {
          if (!confirm(`Delete ${s.name}?`)) return;
          students = students.filter(x=>x!==s);
          localStorage.setItem("students", JSON.stringify(students));
          renderStudents();
        };
        btns.append(del);
        li.append(btns);
        studentsListEl.append(li);
      });
  }

  function renderAttendance(date) {
    attendanceListEl.innerHTML = "";
    const dayData = attendanceData[date] = attendanceData[date] || {};
    students.filter(s => s.class === teacherClass).forEach(s => {
      const div = document.createElement("div");
      div.className = "attendance-item";
      div.textContent = `${s.roll} - ${s.name}`;
      const bc = document.createElement("div");
      bc.className = "attendance-buttons";
      ["P","A","Lt","L","HD"].forEach(code => {
        const b = document.createElement("button");
        b.className = "att-btn";
        b.textContent = code;
        if (dayData[s.roll] === code) b.classList.add("selected");
        b.onclick = () => {
          dayData[s.roll] = code;
          bc.querySelectorAll("button").forEach(x=>x.classList.remove("selected"));
          b.classList.add("selected");
        };
        bc.append(b);
      });
      div.append(bc);
      attendanceListEl.append(div);
    });
  }

  function renderMonthTable(m) {
    const [y, mm] = m.split("-");
    const days = new Date(y, mm, 0).getDate();
    let html = `<table><tr><th>Roll</th><th>Name</th>`;
    for (let d=1; d<=days; d++) html += `<th>${d}</th>`;
    html += `</tr>`;
    students.filter(s=>s.class===teacherClass).forEach(s=>{
      html += `<tr><td>${s.roll}</td><td>${s.name}</td>`;
      for (let d=1; d<=days; d++){
        const key = `${m}-${String(d).padStart(2,"0")}`;
        const st = attendanceData[key]?.[s.roll] || "";
        html += `<td>${st}</td>`;
      }
      html += `</tr>`;
    });
    html += `</table>`;
    monthTable.innerHTML = html;
  }

  function renderSummary(m) {
    const [y, mm] = m.split("-");
    const days = new Date(y, mm, 0).getDate();
    let out = "";
    students.filter(s=>s.class===teacherClass).forEach(s=>{
      const cnt = { P:0, A:0, Lt:0, L:0, HD:0 };
      for (let d=1; d<=days; d++){
        const key = `${m}-${String(d).padStart(2,"0")}`;
        const st = attendanceData[key]?.[s.roll];
        if (cnt[st] !== undefined) cnt[st]++;
      }
      const totalDays = days;
      const presentCount = cnt.P + cnt.HD + cnt.Lt;
      const percent = Math.round((presentCount / totalDays) * 100);
      out += `<p><strong>${s.roll}-${s.name}:</strong> Present ${cnt.P}, HalfDay ${cnt.HD}, Late ${cnt.Lt}, Leave ${cnt.L}, Absent ${cnt.A} &mdash; ${percent}%</p>`;
    });
    summaryReport.innerHTML = out;
  }

  function sendWhatsAppMonthly(m) {
    let msg = `Monthly Attendance Summary for ${m} (Class: ${teacherClass})\n\n`;
    const [y, mm] = m.split("-");
    const days = new Date(y, mm, 0).getDate();
    students.filter(s=>s.class===teacherClass).forEach(s=>{
      let cnt = { P:0, A:0, Lt:0, L:0, HD:0 };
      for (let d=1; d<=days; d++){
        const key = `${m}-${String(d).padStart(2,"0")}`;
        const st = attendanceData[key]?.[s.roll];
        if (cnt[st] !== undefined) cnt[st]++;
      }
      msg += `${s.roll} – ${s.name}\n`;
      msg += `Present: ${cnt.P}, HalfDay: ${cnt.HD}, Late: ${cnt.Lt}, Leave: ${cnt.L}, Absent: ${cnt.A}\n\n`;
    });
    window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(msg), "_blank");
  }
});
