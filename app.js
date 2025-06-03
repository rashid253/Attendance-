// app.js
// ------
// Main application logic: student registration, attendance, analytics, etc.
// Assumes user is authenticated and role-based UI is already toggled by auth.js.

import {
  database,
  appDataRef
} from "./firebase-config.js";
import {
  getDatabase,
  ref as dbRef,
  set as dbSet,
  onValue,
  child as dbChild,
  get as dbGet,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// IndexedDB (idb-keyval) helpers
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// State variables (scoped per authenticated user)
let studentsByUser       = {}; // { uid: [ { ... } ] }
let attendanceByUser     = {}; // { uid: { "YYYY-MM-DD": { adm: status } } }
let paymentsByUser       = {}; // { uid: { adm: [ { date, amount } ] } }
let lastAdmByUser        = {}; // { uid: last admission number }
let fineRates            = { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct       = 75;
let students             = [];
let attendanceData       = {};
let paymentsData         = {};
let lastAdmNo            = 0;
let currentUserId        = null;

// UI Elements
const loginSection      = document.getElementById("login-section");
const logoutBtn         = document.getElementById("logoutBtn");
const mainContent       = document.getElementById("main-content");

const financialSection  = document.getElementById("financial-settings");
const countersSection   = document.getElementById("animatedCounters");
const registrationSection = document.getElementById("student-registration");
const attendanceSection = document.getElementById("attendance-section");
const analyticsSection  = document.getElementById("analytics-section");
const registerSection   = document.getElementById("register-section");

// Called by auth.js after authentication and role-based UI toggling
export async function initAppForUser(uid) {
  currentUserId = uid;

  // Load from IndexedDB
  studentsByUser   = (await idbGet("studentsByUser"))   || {};
  attendanceByUser = (await idbGet("attendanceByUser")) || {};
  paymentsByUser   = (await idbGet("paymentsByUser"))   || {};
  lastAdmByUser    = (await idbGet("lastAdmByUser"))    || {};
  fineRates        = (await idbGet("fineRates"))        || fineRates;
  eligibilityPct   = (await idbGet("eligibilityPct"))   || eligibilityPct;

  // Ensure data structure for this user
  await ensureUserData(currentUserId);

  students       = studentsByUser[currentUserId];
  attendanceData = attendanceByUser[currentUserId];
  paymentsData   = paymentsByUser[currentUserId];
  lastAdmNo      = lastAdmByUser[currentUserId];

  // Sync to Firebase
  await syncToFirebase();

  // Render initial UI (students list, counters, etc.)
  renderStudents();
  updateCounters();
  bindUIEvents();
}

// Ensure user data exists
async function ensureUserData(uid) {
  if (!uid) return;
  if (!studentsByUser[uid]) {
    studentsByUser[uid] = [];
    await idbSet("studentsByUser", studentsByUser);
  }
  if (!attendanceByUser[uid]) {
    attendanceByUser[uid] = {};
    await idbSet("attendanceByUser", attendanceByUser);
  }
  if (!paymentsByUser[uid]) {
    paymentsByUser[uid] = {};
    await idbSet("paymentsByUser", paymentsByUser);
  }
  if (lastAdmByUser[uid] === undefined) {
    lastAdmByUser[uid] = 0;
    await idbSet("lastAdmByUser", lastAdmByUser);
  }
}

// Sync local state to Firebase
async function syncToFirebase() {
  const payload = {
    studentsByUser,
    attendanceByUser,
    paymentsByUser,
    lastAdmByUser,
    fineRates,
    eligibilityPct
  };
  try {
    await dbSet(dbChild(appDataRef, currentUserId), payload);
    console.log("✅ Synced data to Firebase");
  } catch (err) {
    console.error("Firebase sync failed:", err);
  }
}

// Generate new admission number
async function genAdmNo() {
  lastAdmNo++;
  lastAdmByUser[currentUserId] = lastAdmNo;
  await idbSet("lastAdmByUser", lastAdmByUser);
  await syncToFirebase();
  return String(lastAdmNo).padStart(4, "0");
}

// RENDER STUDENTS TABLE
function renderStudents() {
  const studentsBody = document.getElementById("studentsBody");
  studentsBody.innerHTML = "";
  let idx = 0;
  students.forEach((s, i) => {
    idx++;
    // Compute attendance stats
    const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
    Object.values(attendanceData).forEach(dayRec => {
      if (dayRec[s.adm]) stats[dayRec[s.adm]]++;
    });
    const total = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
    const fine  = stats.A * fineRates.A + stats.Lt * fineRates.Lt + stats.L * fineRates.L + stats.HD * fineRates.HD;
    const paid  = (paymentsData[s.adm] || []).reduce((a, p) => a + p.amount, 0);
    const out   = fine - paid;
    const pct   = total ? (stats.P / total) * 100 : 0;
    const status = (out > 0 || pct < eligibilityPct) ? "Debarred" : "Eligible";

    const tr = document.createElement("tr");
    tr.dataset.index = i;
    tr.innerHTML = `
      <td><input type="checkbox" class="sel" /></td>
      <td>${idx}</td>
      <td>${s.name}</td>
      <td>${s.adm}</td>
      <td>${s.parent}</td>
      <td>${s.contact}</td>
      <td>${s.occupation}</td>
      <td>${s.address}</td>
      <td>PKR ${out}</td>
      <td>${status}</td>
      <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
    `;
    studentsBody.appendChild(tr);
  });
  document.getElementById("selectAllStudents").checked = false;
  toggleRegistrationButtons();
  document.querySelectorAll(".add-payment-btn").forEach(b => {
    b.onclick = () => openPaymentModal(b.dataset.adm);
  });
}

// UPDATE COUNTERS (e.g., total students, total present, etc.)
function updateCounters() {
  const container = document.getElementById("countersContainer");
  container.innerHTML = "";
  const totalStudents = students.length;
  const totalPresent = Object.values(attendanceData).reduce((acc, dayRec) => {
    return acc + Object.values(dayRec).filter(status => status === "P").length;
  }, 0);
  const totalAbsent = Object.values(attendanceData).reduce((acc, dayRec) => {
    return acc + Object.values(dayRec).filter(status => status === "A").length;
  }, 0);

  const cards = [
    { label: "Students", number: totalStudents },
    { label: "Present Records", number: totalPresent },
    { label: "Absent Records", number: totalAbsent }
  ];
  cards.forEach(c => {
    const div = document.createElement("div");
    div.classList.add("counter-card", "card");
    div.innerHTML = `<div class="card-number">${c.number}</div><div>${c.label}</div>`;
    container.appendChild(div);
  });
}

// BIND UI EVENTS FOR STUDENT REGISTRATION, ATTENDANCE, ETC.
function bindUIEvents() {
  // FINANCIAL SETTINGS
  document.getElementById("saveSettings").onclick = async () => {
    fineRates.A  = Number(document.getElementById("fineAbsent").value)  || fineRates.A;
    fineRates.Lt = Number(document.getElementById("fineLate").value)    || fineRates.Lt;
    fineRates.L  = Number(document.getElementById("fineLeave").value)   || fineRates.L;
    fineRates.HD = Number(document.getElementById("fineHalfDay").value) || fineRates.HD;
    eligibilityPct = Number(document.getElementById("eligibilityPct").value) || eligibilityPct;
    await idbSet("fineRates", fineRates);
    await idbSet("eligibilityPct", eligibilityPct);
    await syncToFirebase();
    alert("Settings saved.");
  };

  // STUDENT REGISTRATION: Add new student
  document.getElementById("addStudent").onclick = async () => {
    const name      = document.getElementById("studentName").value.trim();
    const parent    = document.getElementById("parentName").value.trim();
    const contact   = document.getElementById("parentContact").value.trim();
    const occupation= document.getElementById("parentOccupation").value.trim();
    const address   = document.getElementById("parentAddress").value.trim();
    if (!name || !parent) return;
    const adm = await genAdmNo();
    const newStudent = { name, adm, parent, contact, occupation, address };
    students.push(newStudent);
    studentsByUser[currentUserId] = students;
    await idbSet("studentsByUser", studentsByUser);
    await syncToFirebase();
    renderStudents();
    document.getElementById("studentName").value = "";
    document.getElementById("parentName").value = "";
    document.getElementById("parentContact").value = "";
    document.getElementById("parentOccupation").value = "";
    document.getElementById("parentAddress").value = "";
  };

  // SELECT ALL STUDENTS checkbox
  document.getElementById("selectAllStudents").addEventListener("change", (e) => {
    const checked = e.target.checked;
    document.querySelectorAll("#studentsBody .sel").forEach(cb => {
      cb.checked = checked;
    });
    toggleRegistrationButtons();
  });

  // STUDENT checkboxes → toggle Edit/Delete buttons
  document.getElementById("studentsBody").addEventListener("change", () => {
    toggleRegistrationButtons();
  });

  // DELETE SELECTED STUDENTS
  document.getElementById("deleteSelected").onclick = async () => {
    const checkedBoxes = Array.from(document.querySelectorAll("#studentsBody .sel"))
      .filter(cb => cb.checked);
    if (!checkedBoxes.length) return;
    const confirmed = confirm(`Delete ${checkedBoxes.length} selected student(s)?`);
    if (!confirmed) return;
    // Remove in descending index order
    const indices = checkedBoxes.map(cb => Number(cb.closest("tr").dataset.index));
    indices.sort((a, b) => b - a);
    indices.forEach(i => students.splice(i, 1));
    studentsByUser[currentUserId] = students;
    await idbSet("studentsByUser", studentsByUser);
    await syncToFirebase();
    renderStudents();
  };

  // ATTENDANCE: Load attendance for selected date
  document.getElementById("loadAttendance").onclick = () => {
    const date = document.getElementById("dateInput").value;
    if (!date) return;
    loadAttendanceForDate(date);
  };

  // STUDENT PAYMENT MODAL
  document.getElementById("paymentModalClose").onclick = () => {
    document.getElementById("paymentModal").classList.add("hidden");
  };
  document.getElementById("cancelPayment").onclick = () => {
    document.getElementById("paymentModal").classList.add("hidden");
  };
  document.getElementById("savePayment").onclick = async () => {
    const adm = document.getElementById("payAdm").textContent;
    const amount = Number(document.getElementById("paymentAmount").value);
    if (!amount) return;
    if (!paymentsData[adm]) paymentsData[adm] = [];
    paymentsData[adm].push({ date: new Date().toISOString().split("T")[0], amount });
    paymentsByUser[currentUserId] = paymentsData;
    await idbSet("paymentsByUser", paymentsByUser);
    await syncToFirebase();
    document.getElementById("paymentModal").classList.add("hidden");
    renderStudents();
  };

  // ATTENDANCE → Save attendance
  document.getElementById("saveAttendance").onclick = async () => {
    const date = document.getElementById("dateInput").value;
    if (!date) return;
    await idbSet("attendanceByUser", attendanceByUser);
    await syncToFirebase();
    document.getElementById("saveAttendance").classList.add("hidden");
    document.getElementById("resetAttendance").classList.add("hidden");
    document.getElementById("shareAttendanceSummary").classList.remove("hidden");
    document.getElementById("downloadAttendancePDF").classList.remove("hidden");
    renderStudents();
    updateCounters();
  };

  // ATTENDANCE → Reset attendance inputs
  document.getElementById("resetAttendance").onclick = () => {
    const checkboxes = document.querySelectorAll(".att-checkbox");
    checkboxes.forEach(cb => {
      cb.checked = false;
      cb.closest("td").querySelector("select").value = "";
    });
    document.getElementById("attendanceSummary").classList.add("hidden");
    document.getElementById("saveAttendance").classList.add("hidden");
    document.getElementById("resetAttendance").classList.add("hidden");
    document.getElementById("shareAttendanceSummary").classList.add("hidden");
    document.getElementById("downloadAttendancePDF").classList.add("hidden");
  };

  // ANALYTICS → Load analytics
  document.getElementById("loadAnalytics").onclick = () => {
    loadAnalytics();
  };

  // REGISTER → Load monthly register
  document.getElementById("loadRegister").onclick = () => {
    const month = document.getElementById("registerMonth").value;
    if (!month) return;
    loadMonthlyRegister(month);
  };
}

// Toggle Edit/Delete buttons in student registration
function toggleRegistrationButtons() {
  const checkedCount = document.querySelectorAll("#studentsBody .sel:checked").length;
  document.getElementById("editSelected").disabled = checkedCount !== 1;
  document.getElementById("deleteSelected").disabled = checkedCount === 0;
}

// Load attendance form for a given date
function loadAttendanceForDate(date) {
  // Build table with student names and dropdowns for status
  const container = document.getElementById("attendanceBody");
  container.innerHTML = "";
  const table = document.createElement("table");
  table.classList.add("table-wrapper");
  const thead = document.createElement("thead");
  thead.innerHTML = `<tr><th>Name</th><th>Adm#</th><th>Status</th></tr>`;
  const tbody = document.createElement("tbody");
  students.forEach(s => {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.textContent = s.name;
    const tdAdm = document.createElement("td");
    tdAdm.textContent = s.adm;
    const tdStatus = document.createElement("td");
    const select = document.createElement("select");
    select.innerHTML = `
      <option value="" disabled selected>--</option>
      <option value="P">Present</option>
      <option value="A">Absent</option>
      <option value="Lt">Late</option>
      <option value="HD">Half-Day</option>
      <option value="L">Leave</option>
    `;
    select.value = (attendanceData[date] || {})[s.adm] || "";
    select.addEventListener("change", (e) => {
      if (!attendanceData[date]) attendanceData[date] = {};
      attendanceData[date][s.adm] = e.target.value;
      attendanceByUser[currentUserId] = attendanceData;
      document.getElementById("saveAttendance").classList.remove("hidden");
      document.getElementById("resetAttendance").classList.remove("hidden");
      updateAttendanceSummary(date);
    });
    tdStatus.appendChild(select);
    tr.appendChild(tdName);
    tr.appendChild(tdAdm);
    tr.appendChild(tdStatus);
    tbody.appendChild(tr);
  });
  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
  updateAttendanceSummary(date);
}

// Update attendance summary box
function updateAttendanceSummary(date) {
  const summaryBox = document.getElementById("attendanceSummary");
  const dayRec = attendanceData[date] || {};
  const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
  Object.values(dayRec).forEach(status => stats[status]++);
  summaryBox.innerHTML = `
    <div><strong>Date:</strong> ${date}</div>
    <div>Present: ${stats.P}</div>
    <div>Absent: ${stats.A}</div>
    <div>Late: ${stats.Lt}</div>
    <div>Half-Day: ${stats.HD}</div>
    <div>Leave: ${stats.L}</div>
  `;
  summaryBox.classList.remove("hidden");
}

// Open payment modal for a given admission number
function openPaymentModal(adm) {
  document.getElementById("payAdm").textContent = adm;
  document.getElementById("paymentAmount").value = "";
  document.getElementById("paymentModal").classList.remove("hidden");
}

// LOAD ANALYTICS (simplified: show attendance % per student)
function loadAnalytics() {
  const target = document.getElementById("analyticsTarget").value;
  if (!target) return;
  const container = document.getElementById("analyticsContainer");
  const tbody = document.getElementById("analyticsBody");
  const thead = document.querySelector("#analyticsTable thead tr");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  if (target === "student") {
    // Columns: Adm#, Name, Present %, Absent %, Fine, Status
    ["Adm#", "Name", "Present %", "Absent %", "Fine (PKR)", "Status"].forEach(h => {
      const th = document.createElement("th");
      th.textContent = h;
      thead.appendChild(th);
    });
    students.forEach(s => {
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(dayRec => {
        if (dayRec[s.adm]) stats[dayRec[s.adm]]++;
      });
      const total = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const pctPresent = total ? ((stats.P / total) * 100).toFixed(1) : "0.0";
      const pctAbsent  = total ? ((stats.A / total) * 100).toFixed(1) : "0.0";
      const fine  = stats.A * fineRates.A + stats.Lt * fineRates.Lt + stats.L * fineRates.L + stats.HD * fineRates.HD;
      const paid  = (paymentsData[s.adm] || []).reduce((a, p) => a + p.amount, 0);
      const out   = fine - paid;
      const status = (out > 0 || (total && (stats.P / total)*100 < eligibilityPct)) ? "Debarred" : "Eligible";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.adm}</td>
        <td>${s.name}</td>
        <td>${pctPresent}%</td>
        <td>${pctAbsent}%</td>
        <td>PKR ${out}</td>
        <td>${status}</td>
      `;
      tbody.appendChild(tr);
    });
    container.classList.remove("hidden");
    document.getElementById("graphs").classList.remove("hidden");
    plotCharts();
    document.getElementById("analyticsActions").classList.remove("hidden");
  }
  // Implement other target types ("class", "section") similarly if needed
}

// PLOT BARCHART & PIECHART FOR STUDENT ATTENDANCE SUMMARY
function plotCharts() {
  // For simplicity: Bar chart of top 5 students by present count
  const ctxBar = document.getElementById("barChart").getContext("2d");
  const sorted = [...students].sort((a, b) => {
    const statsA = { P:0 }, statsB = { P:0 };
    Object.values(attendanceData).forEach(dayRec => {
      if (dayRec[a.adm] === "P") statsA.P++;
      if (dayRec[b.adm] === "P") statsB.P++;
    });
    return statsB.P - statsA.P;
  }).slice(0, 5);
  const labels = sorted.map(s => s.name);
  const data = sorted.map(s => {
    let count = 0;
    Object.values(attendanceData).forEach(dayRec => {
      if (dayRec[s.adm] === "P") count++;
    });
    return count;
  });
  new Chart(ctxBar, {
    type: "bar",
    data: { labels, datasets: [{ label: "Present Count", data }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Pie chart: overall present vs absent counts
  const ctxPie = document.getElementById("pieChart").getContext("2d");
  let presentTotal = 0, absentTotal = 0;
  Object.values(attendanceData).forEach(dayRec => {
    Object.values(dayRec).forEach(status => {
      if (status === "P") presentTotal++;
      else if (status === "A") absentTotal++;
    });
  });
  new Chart(ctxPie, {
    type: "pie",
    data: {
      labels: ["Present", "Absent"],
      datasets: [{ data: [presentTotal, absentTotal] }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// LOAD MONTHLY REGISTER (shows each student’s daily status for the month)
function loadMonthlyRegister(month) {
  const [year, mon] = month.split("-");
  const daysInMonth = new Date(year, Number(mon), 0).getDate();
  const headerRow = document.getElementById("registerHeader");
  headerRow.innerHTML = "<th>Adm#</th><th>Name</th>";
  for (let d = 1; d <= daysInMonth; d++) {
    const th = document.createElement("th");
    th.textContent = d;
    headerRow.appendChild(th);
  }
  const tbody = document.getElementById("registerBody");
  tbody.innerHTML = "";
  students.forEach(s => {
    const tr = document.createElement("tr");
    const tdAdm = document.createElement("td");
    tdAdm.textContent = s.adm;
    const tdName = document.createElement("td");
    tdName.textContent = s.name;
    tr.appendChild(tdAdm);
    tr.appendChild(tdName);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${mon.padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const status = (attendanceData[dateStr] || {})[s.adm] || "";
      const td = document.createElement("td");
      td.textContent = status;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  document.getElementById("registerTableWrapper").classList.remove("hidden");
  document.getElementById("changeRegister").classList.remove("hidden");
  document.getElementById("saveRegister").classList.remove("hidden");
}

// EXPORT initAppForUser to be called in auth.js
