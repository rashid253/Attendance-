// app.js (Complete and Updated for Auth + Role-Based Access)
// -------------------------------------------------------------------------------------------

// 1. IMPORTS & INITIALIZATION FOR AUTH & DATABASE
import { auth, database } from "./firebase-config.js";
import {
  ref as dbRef,
  set as dbSet,
  get as dbGet,
  onValue
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// IndexedDB helpers (idb-keyval)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// Reference to Firebase node for entire appData
const appDataRef = dbRef(database, "appData");

// 2. GLOBAL STATE (PER-SCHOOL & APP STATE VARIABLES)
let studentsBySchool       = {};
let attendanceDataBySchool = {};
let paymentsDataBySchool   = {};
let lastAdmNoBySchool      = {};
let fineRates              = { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct         = 75;
let schools                = [];

// These three will be set by setup.js (or overwritten if teacher)
let currentSchool    = null;
let teacherClass     = null;
let teacherSection   = null;

// Active-school derived vars
let students       = [];
let attendanceData = {};
let paymentsData   = {};
let lastAdmNo      = 0;

// 3. ON USER LOGIN & SETUP COMPLETE → INITIALIZE DATA
document.addEventListener("userLoggedIn", async () => {
  try {
    const appDataSnap = await dbGet(appDataRef);
    if (appDataSnap.exists()) {
      const appData = appDataSnap.val();
      studentsBySchool       = appData.studentsBySchool       || {};
      attendanceDataBySchool = appData.attendanceDataBySchool || {};
      paymentsDataBySchool   = appData.paymentsDataBySchool   || {};
      lastAdmNoBySchool      = appData.lastAdmNoBySchool      || {};
      fineRates              = appData.fineRates              || fineRates;
      eligibilityPct         = appData.eligibilityPct         || eligibilityPct;
      schools                = appData.schools                || [];
      currentSchool          = appData.currentSchool          || null;
      teacherClass           = appData.teacherClass           || null;
      teacherSection         = appData.teacherSection         || null;
    }
  } catch (err) {
    console.error("Error fetching appData from Firebase:", err);
  }

  const profile = window.currentUserProfile;
  if (profile && profile.role === "teacher") {
    currentSchool  = profile.school;
    teacherClass   = profile.class;
    teacherSection = profile.section;
  }

  if (currentSchool && teacherClass && teacherSection) {
    await ensureSchoolData(currentSchool);

    students       = studentsBySchool[currentSchool];
    attendanceData = attendanceDataBySchool[currentSchool];
    paymentsData   = paymentsDataBySchool[currentSchool];
    lastAdmNo      = lastAdmNoBySchool[currentSchool] || 0;

    await initLocalState();

    resetViews();
    renderStudents();
    updateCounters();
  }
});

// 4. ENSURE DATA STRUCTURES EXIST FOR A GIVEN SCHOOL
async function ensureSchoolData(school) {
  if (!school) return;
  if (!studentsBySchool[school]) {
    studentsBySchool[school] = [];
    await idbSet("studentsBySchool", studentsBySchool);
  }
  if (!attendanceDataBySchool[school]) {
    attendanceDataBySchool[school] = {};
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
  }
  if (!paymentsDataBySchool[school]) {
    paymentsDataBySchool[school] = {};
    await idbSet("paymentsDataBySchool", paymentsDataBySchool);
  }
  if (lastAdmNoBySchool[school] === undefined) {
    lastAdmNoBySchool[school] = 0;
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
  }
}

// 5. INITIALIZE LOCAL STATE FROM IndexedDB
async function initLocalState() {
  studentsBySchool       = (await idbGet("studentsBySchool"))       || studentsBySchool;
  attendanceDataBySchool = (await idbGet("attendanceDataBySchool")) || attendanceDataBySchool;
  paymentsDataBySchool   = (await idbGet("paymentsDataBySchool"))   || paymentsDataBySchool;
  lastAdmNoBySchool      = (await idbGet("lastAdmNoBySchool"))      || lastAdmNoBySchool;
  fineRates              = (await idbGet("fineRates"))              || fineRates;
  eligibilityPct         = (await idbGet("eligibilityPct"))         || eligibilityPct;
  schools                = (await idbGet("schools"))                || schools;
  currentSchool          = (await idbGet("currentSchool"))          || currentSchool;
  teacherClass           = (await idbGet("teacherClass"))           || teacherClass;
  teacherSection         = (await idbGet("teacherSection"))         || teacherSection;

  if (currentSchool) {
    await ensureSchoolData(currentSchool);
    students       = studentsBySchool[currentSchool];
    attendanceData = attendanceDataBySchool[currentSchool];
    paymentsData   = paymentsDataBySchool[currentSchool];
    lastAdmNo      = lastAdmNoBySchool[currentSchool] || 0;
  }
}

// 6. SYNC ENTIRE appData BACK TO FIREBASE
async function syncToFirebase() {
  const payload = {
    studentsBySchool,
    attendanceDataBySchool,
    paymentsDataBySchool,
    lastAdmNoBySchool,
    fineRates,
    eligibilityPct,
    schools,
    currentSchool,
    teacherClass,
    teacherSection,
  };
  try {
    await dbSet(appDataRef, payload);
    console.log("✅ Synced data to Firebase");
  } catch (err) {
    console.error("Firebase sync failed:", err);
  }
}

// ----------------------------------------------------------
// 7. REST OF YOUR ORIGINAL app.js CODE (Student Registration,
//    Attendance, Analytics, Counters, Payments, etc.)
//    – وہیں paste کر دیں جہاں پہلے تھا
// ----------------------------------------------------------

// Example: STUDENT REGISTRATION
const studentNameInput      = document.getElementById("studentName");
const parentNameInput       = document.getElementById("parentName");
const parentContactInput    = document.getElementById("parentContact");
const parentOccupationInput = document.getElementById("parentOccupation");
const parentAddressInput    = document.getElementById("parentAddress");
const addStudentBtn         = document.getElementById("addStudent");

addStudentBtn.addEventListener("click", async () => {
  const name       = studentNameInput.value.trim();
  const parentName = parentNameInput.value.trim();
  const contact    = parentContactInput.value.trim();
  const occupation = parentOccupationInput.value.trim();
  const address    = parentAddressInput.value.trim();

  if (!name) {
    alert("Student name is required.");
    return;
  }

  lastAdmNo += 1;
  lastAdmNoBySchool[currentSchool] = lastAdmNo;

  const newStudent = {
    adm: lastAdmNo,
    name,
    parentName,
    contact,
    occupation,
    address,
    fine: 0,
    status: "Registered"
  };

  students.push(newStudent);
  studentsBySchool[currentSchool] = students;

  await idbSet("studentsBySchool", studentsBySchool);
  await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);

  await syncToFirebase();

  renderStudents();
  updateCounters();

  studentNameInput.value      = "";
  parentNameInput.value       = "";
  parentContactInput.value    = "";
  parentOccupationInput.value = "";
  parentAddressInput.value    = "";
});

function renderStudents() {
  const studentsBody = document.getElementById("studentsBody");
  if (!studentsBody) return;
  studentsBody.innerHTML = "";

  students.forEach((stu, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="stuCheckbox" data-index="${index}" /></td>
      <td>${index + 1}</td>
      <td>${stu.name}</td>
      <td>${stu.adm}</td>
      <td>${stu.parentName}</td>
      <td>${stu.contact}</td>
      <td>${stu.occupation}</td>
      <td>${stu.address}</td>
      <td>${stu.fine}</td>
      <td>${stu.status}</td>
      <td>
        <button class="edit-stu btn" data-index="${index}"><i class="fas fa-edit"></i></button>
        <button class="delete-stu btn" data-index="${index}"><i class="fas fa-trash-alt"></i></button>
      </td>`;
    studentsBody.appendChild(tr);
  });

  const selectAll = document.getElementById("selectAllStudents");
  if (selectAll) {
    selectAll.checked = false;
    selectAll.addEventListener("change", () => {
      document.querySelectorAll(".stuCheckbox").forEach(cb => {
        cb.checked = selectAll.checked;
      });
      toggleStudentActions();
    });
  }

  document.querySelectorAll(".stuCheckbox").forEach(cb => {
    cb.addEventListener("change", toggleStudentActions);
  });
  toggleStudentActions();

  document.querySelectorAll(".edit-stu").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = +btn.dataset.index;
      enterEditMode(idx);
    });
  });

  document.querySelectorAll(".delete-stu").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = +btn.dataset.index;
      if (confirm(`Delete student ${students[idx].name}?`)) {
        students.splice(idx, 1);
        studentsBySchool[currentSchool]       = students;
        await idbSet("studentsBySchool", studentsBySchool);
        await syncToFirebase();
        renderStudents();
        updateCounters();
      }
    });
  });
}

function toggleStudentActions() {
  const checked = document.querySelectorAll(".stuCheckbox:checked").length;
  document.getElementById("editSelected").disabled   = checked !== 1;
  document.getElementById("deleteSelected").disabled = checked === 0;
}

const editSelectedBtn = document.getElementById("editSelected");
const doneEditingBtn  = document.getElementById("doneEditing");

editSelectedBtn.addEventListener("click", () => {
  const checkedBoxes = document.querySelectorAll(".stuCheckbox:checked");
  if (checkedBoxes.length !== 1) return;
  const idx = +checkedBoxes[0].dataset.index;
  enterEditMode(idx);
});

doneEditingBtn.addEventListener("click", async () => {
  const idx = +doneEditingBtn.dataset.index;
  const name       = studentNameInput.value.trim();
  const parentName = parentNameInput.value.trim();
  const contact    = parentContactInput.value.trim();
  const occupation = parentOccupationInput.value.trim();
  const address    = parentAddressInput.value.trim();

  if (!name) {
    alert("Student name is required.");
    return;
  }

  const stu = students[idx];
  stu.name       = name;
  stu.parentName = parentName;
  stu.contact    = contact;
  stu.occupation = occupation;
  stu.address    = address;

  studentsBySchool[currentSchool] = students;
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();

  exitEditMode();
  renderStudents();
  updateCounters();
});

function enterEditMode(index) {
  const stu = students[index];
  studentNameInput.value      = stu.name;
  parentNameInput.value       = stu.parentName;
  parentContactInput.value    = stu.contact;
  parentOccupationInput.value = stu.occupation;
  parentAddressInput.value    = stu.address;

  addStudentBtn.classList.add("hidden");
  editSelectedBtn.classList.add("hidden");
  doneEditingBtn.classList.remove("hidden");
  doneEditingBtn.dataset.index = index;
}

function exitEditMode() {
  studentNameInput.value      = "";
  parentNameInput.value       = "";
  parentContactInput.value    = "";
  parentOccupationInput.value = "";
  parentAddressInput.value    = "";

  addStudentBtn.classList.remove("hidden");
  editSelectedBtn.classList.remove("hidden");
  doneEditingBtn.classList.add("hidden");
  doneEditingBtn.dataset.index = "";
}

const deleteSelectedBtn = document.getElementById("deleteSelected");
deleteSelectedBtn.addEventListener("click", async () => {
  const checkedBoxes = document.querySelectorAll(".stuCheckbox:checked");
  if (checkedBoxes.length === 0) return;

  if (!confirm(`Delete ${checkedBoxes.length} selected student(s)?`)) return;
  const indices = Array.from(checkedBoxes).map(cb => +cb.dataset.index).sort((a,b)=>b-a);
  for (const idx of indices) {
    students.splice(idx, 1);
  }
  studentsBySchool[currentSchool] = students;
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();
  renderStudents();
  updateCounters();
});

const saveRegistrationBtn = document.getElementById("saveRegistration");
saveRegistrationBtn.addEventListener("click", async () => {
  await idbSet("studentsBySchool", studentsBySchool);
  await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
  await syncToFirebase();
  alert("Registration saved successfully.");
});

const restoreFileInput = document.getElementById("restoreFile");
const restoreDataBtn   = document.getElementById("restoreData");
restoreDataBtn.addEventListener("click", () => restoreFileInput.click());

restoreFileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const backup = JSON.parse(text);
    if (!backup.studentsBySchool) throw new Error("Invalid backup format.");
    studentsBySchool       = backup.studentsBySchool;
    attendanceDataBySchool = backup.attendanceDataBySchool;
    paymentsDataBySchool   = backup.paymentsDataBySchool;
    lastAdmNoBySchool      = backup.lastAdmNoBySchool;
    fineRates              = backup.fineRates;
    eligibilityPct         = backup.eligibilityPct;
    schools                = backup.schools;
    currentSchool          = backup.currentSchool;
    teacherClass           = backup.teacherClass;
    teacherSection         = backup.teacherSection;

    await idbSet("studentsBySchool", studentsBySchool);
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
    await idbSet("paymentsDataBySchool", paymentsDataBySchool);
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
    await idbSet("fineRates", fineRates);
    await idbSet("eligibilityPct", eligibilityPct);
    await idbSet("schools", schools);
    await idbSet("currentSchool", currentSchool);
    await idbSet("teacherClass", teacherClass);
    await idbSet("teacherSection", teacherSection);

    await syncToFirebase();
    alert("Data restored from backup. Please reload the page.");
    location.reload();
  } catch (err) {
    alert("Failed to restore backup: " + err.message);
  }
});

const resetDataBtn = document.getElementById("resetData");
resetDataBtn.addEventListener("click", async () => {
  if (!confirm("Factory reset will delete ALL data for this school. Continue?")) return;
  students = [];
  attendanceData = {};
  paymentsData = {};
  lastAdmNo = 0;

  studentsBySchool[currentSchool]       = [];
  attendanceDataBySchool[currentSchool] = {};
  paymentsDataBySchool[currentSchool]   = {};
  lastAdmNoBySchool[currentSchool]      = 0;

  await idbSet("studentsBySchool", studentsBySchool);
  await idbSet("attendanceDataBySchool", attendanceDataBySchool);
  await idbSet("paymentsDataBySchool", paymentsDataBySchool);
  await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);

  await syncToFirebase();
  renderStudents();
  updateCounters();
  resetViews();
});

const dateInput      = document.getElementById("dateInput");
const loadAttendanceBtn = document.getElementById("loadAttendance");
const attendanceBody = document.getElementById("attendanceBody");
const attendanceSummary = document.getElementById("attendanceSummary");
const saveAttendanceBtn = document.getElementById("saveAttendance");
const resetAttendanceBtn = document.getElementById("resetAttendance");

loadAttendanceBtn.addEventListener("click", () => {
  const date = dateInput.value;
  if (!date) {
    alert("Select a date first.");
    return;
  }
  renderAttendanceTable(date);
});

function renderAttendanceTable(date) {
  attendanceBody.innerHTML = "";
  attendanceSummary.classList.add("hidden");
  saveAttendanceBtn.classList.add("hidden");
  resetAttendanceBtn.classList.add("hidden");

  if (!attendanceData[date]) {
    attendanceData[date] = {};
  }

  const table = document.createElement("table");
  table.classList.add("table");
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>#</th><th>Adm#</th><th>Name</th><th>Status</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  students.forEach((stu, idx) => {
    const status = attendanceData[date][stu.adm] || "P";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${stu.adm}</td>
      <td>${stu.name}</td>
      <td>
        <select class="att-select" data-adm="${stu.adm}">
          <option value="P" ${status === "P" ? "selected" : ""}>P</option>
          <option value="A" ${status === "A" ? "selected" : ""}>A</option>
          <option value="Lt" ${status === "Lt" ? "selected" : ""}>Lt</option>
          <option value="HD" ${status === "HD" ? "selected" : ""}>HD</option>
          <option value="L" ${status === "L" ? "selected" : ""}>L</option>
        </select>
      </td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  attendanceBody.appendChild(table);

  saveAttendanceBtn.classList.remove("hidden");
  resetAttendanceBtn.classList.remove("hidden");
}

saveAttendanceBtn.addEventListener("click", async () => {
  const date = dateInput.value;
  document.querySelectorAll(".att-select").forEach(sel => {
    const adm = sel.dataset.adm;
    attendanceData[date][adm] = sel.value;
  });
  attendanceDataBySchool[currentSchool] = attendanceData;
  await idbSet("attendanceDataBySchool", attendanceDataBySchool);
  await syncToFirebase();
  alert("Attendance saved for " + date);
  calculateSummary(date);
});

resetAttendanceBtn.addEventListener("click", () => {
  const date = dateInput.value;
  if (attendanceData[date]) {
    delete attendanceData[date];
    attendanceDataBySchool[currentSchool] = attendanceData;
    idbSet("attendanceDataBySchool", attendanceDataBySchool);
    syncToFirebase();
    renderAttendanceTable(date);
  }
});

function calculateSummary(date) {
  const summaryBox = attendanceSummary;
  summaryBox.innerHTML = "";
  const stats = { P: 0, A: 0, Lt: 0, HD: 0, L: 0 };
  students.forEach(stu => {
    const status = attendanceData[date][stu.adm] || "P";
    stats[status]++;
  });
  const total   = students.length;
  const present = stats.P + stats.Lt + stats.HD;
  const perc    = ((present / total) * 100).toFixed(2);

  summaryBox.innerHTML = `
    <p>Total Students: ${total}</p>
    <p>Present: ${stats.P}</p>
    <p>Late: ${stats.Lt}</p>
    <p>Half Day: ${stats.HD}</p>
    <p>Absent: ${stats.A}</p>
    <p>Leave: ${stats.L}</p>
    <p>Attendance %: ${perc}%</p>`;
  summaryBox.classList.remove("hidden");
}

const analyticsTargetSelect    = document.getElementById("analyticsTarget");
const analyticsSectionSelect   = document.getElementById("analyticsSectionSelect");
const analyticsTypeSelect      = document.getElementById("analyticsType");
const analyticsDateInput       = document.getElementById("analyticsDate");
const analyticsMonthInput      = document.getElementById("analyticsMonth");
const semesterStartInput       = document.getElementById("semesterStart");
const semesterEndInput         = document.getElementById("semesterEnd");
const yearStartInput           = document.getElementById("yearStart");
const analyticsSearchInput     = document.getElementById("analyticsSearch");
const loadAnalyticsBtn         = document.getElementById("loadAnalytics");
const resetAnalyticsBtn        = document.getElementById("resetAnalytics");
const analyticsContainer       = document.getElementById("analyticsContainer");
const analyticsBody            = document.getElementById("analyticsBody");
const analyticsTableHeadRow    = document.querySelector("#analyticsTable thead tr");
const graphsDiv                = document.getElementById("graphs");
let barChartInstance           = null;
let pieChartInstance           = null;

analyticsTargetSelect.addEventListener("change", () => {
  analyticsSectionSelect.classList.add("hidden");
  analyticsTypeSelect.disabled = false;
  analyticsDateInput.classList.add("hidden");
  analyticsMonthInput.classList.add("hidden");
  semesterStartInput.classList.add("hidden");
  semesterEndInput.classList.add("hidden");
  yearStartInput.classList.add("hidden");
  analyticsSearchInput.classList.add("hidden");

  const target = analyticsTargetSelect.value;
  if (target === "section") {
    analyticsSectionSelect.classList.remove("hidden");
  }
});

analyticsTypeSelect.addEventListener("change", () => {
  analyticsDateInput.classList.add("hidden");
  analyticsMonthInput.classList.add("hidden");
  semesterStartInput.classList.add("hidden");
  semesterEndInput.classList.add("hidden");
  yearStartInput.classList.add("hidden");
  analyticsSearchInput.classList.add("hidden");

  const type = analyticsTypeSelect.value;
  switch (type) {
    case "date":
      analyticsDateInput.classList.remove("hidden");
      break;
    case "month":
      analyticsMonthInput.classList.remove("hidden");
      break;
    case "semester":
      semesterStartInput.classList.remove("hidden");
      semesterEndInput.classList.remove("hidden");
      break;
    case "year":
      yearStartInput.classList.remove("hidden");
      analyticsSearchInput.classList.remove("hidden");
      break;
  }
});

loadAnalyticsBtn.addEventListener("click", () => {
  const target  = analyticsTargetSelect.value;
  const section = analyticsSectionSelect.value;
  const type    = analyticsTypeSelect.value;
  if (!target || !type) {
    alert("Please select report target and period.");
    return;
  }
  generateAnalytics(target, section, type);
});

resetAnalyticsBtn.addEventListener("click", () => {
  analyticsTargetSelect.value       = "";
  analyticsSectionSelect.value      = "";
  analyticsSectionSelect.classList.add("hidden");
  analyticsTypeSelect.value         = "";
  analyticsTypeSelect.disabled      = true;
  analyticsDateInput.value          = "";
  analyticsMonthInput.value         = "";
  semesterStartInput.value          = "";
  semesterEndInput.value            = "";
  yearStartInput.value              = "";
  analyticsSearchInput.value        = "";
  analyticsContainer.classList.add("hidden");
  graphsDiv.classList.add("hidden");
  resetAnalyticsBtn.classList.add("hidden");
});

function generateAnalytics(target, section, type) {
  let filteredStudents = [...students];
  if (target === "section" && section) {
    filteredStudents = filteredStudents.filter(stu => stu.section === section);
  }

  let dates = Object.keys(attendanceData);
  if (type === "date") {
    const selDate = analyticsDateInput.value;
    dates = dates.filter(d => d === selDate);
  } else if (type === "month") {
    const [year, month] = analyticsMonthInput.value.split("-");
    dates = dates.filter(d => {
      const dt = new Date(d);
      return dt.getFullYear() === +year && dt.getMonth() + 1 === +month;
    });
  } else if (type === "semester") {
    const start = semesterStartInput.value;
    const end   = semesterEndInput.value;
    dates = dates.filter(d => d >= start && d <= end);
  } else if (type === "year") {
    const year = +yearStartInput.value;
    dates = dates.filter(d => new Date(d).getFullYear() === year);
  }

  const analyticsStats = filteredStudents.map(stu => {
    const stat = { adm: stu.adm, name: stu.name, P: 0, A: 0, Lt: 0, HD: 0, L: 0 };
    dates.forEach(d => {
      const status = attendanceData[d]?.[stu.adm] || "P";
      stat[status]++;
    });
    stat.total = stat.P + stat.Lt + stat.HD + stat.A + stat.L;
    stat.perc  = stat.total > 0 ? ((stat.P + stat.Lt + stat.HD) / stat.total * 100).toFixed(2) : "0.00";
    stat.outstanding = stu.fine;
    stat.status = stat.perc >= eligibilityPct ? "Eligible" : "Debarred";
    return stat;
  });

  analyticsTableHeadRow.innerHTML = [
    "#", "Adm#", "Name", "P", "A", "Lt", "HD", "L", "Total", "%", "Outstanding", "Status"
  ].map(h => `<th>${h}</th>`).join("");

  analyticsBody.innerHTML = "";
  analyticsStats.forEach((st, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${st.adm}</td>
      <td>${st.name}</td>
      <td>${st.P}</td>
      <td>${st.A}</td>
      <td>${st.Lt}</td>
      <td>${st.HD}</td>
      <td>${st.L}</td>
      <td>${st.total}</td>
      <td>${st.perc}%</td>
      <td>${st.outstanding}</td>
      <td>${st.status}</td>`;
    analyticsBody.appendChild(tr);
  });

  analyticsContainer.classList.remove("hidden");
  graphsDiv.classList.remove("hidden");
  resetAnalyticsBtn.classList.remove("hidden");

  if (barChartInstance) {
    barChartInstance.destroy();
  }
  const barCtx = document.getElementById("barChart").getContext("2d");
  barChartInstance = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: analyticsStats.map(st => st.adm),
      datasets: [{
        label: "% Attendance",
        data: analyticsStats.map(st => +st.perc),
        backgroundColor: null
      }]
    },
    options: {
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });

  if (pieChartInstance) {
    pieChartInstance.destroy();
  }
  const pieCtx = document.getElementById("pieChart").getContext("2d");
  const totalP   = analyticsStats.reduce((sum, st) => sum + st.P, 0);
  const totalA   = analyticsStats.reduce((sum, st) => sum + st.A, 0);
  const totalLt  = analyticsStats.reduce((sum, st) => sum + st.Lt, 0);
  const totalHD  = analyticsStats.reduce((sum, st) => sum + st.HD, 0);
  const totalL   = analyticsStats.reduce((sum, st) => sum + st.L, 0);
  pieChartInstance = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: ["Present", "Absent", "Late", "Half-Day", "Leave"],
      datasets: [{ data: [totalP, totalA, totalLt, totalHD, totalL] }]
    }
  });
}

const registerMonthInput   = document.getElementById("registerMonth");
const loadRegisterBtn      = document.getElementById("loadRegister");
const registerTableWrapper = document.getElementById("registerTableWrapper");
const registerHeaderRow    = document.getElementById("registerHeader");
const registerBody         = document.getElementById("registerBody");
const changeRegisterBtn    = document.getElementById("changeRegister");
const saveRegisterBtn      = document.getElementById("saveRegister");
const downloadRegisterBtn  = document.getElementById("downloadRegister");
const shareRegisterBtn     = document.getElementById("shareRegister");

loadRegisterBtn.addEventListener("click", () => {
  const monthVal = registerMonthInput.value;
  if (!monthVal) {
    alert("Select a month first.");
    return;
  }
  renderRegister(monthVal);
});

function renderRegister(monthVal) {
  const [year, month] = monthVal.split("-");
  const daysInMonth = new Date(+year, +month, 0).getDate();
  const headerHTML = ["Name", "Adm#"].concat(
    Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString())
  ).map(h => `<th>${h}</th>`).join("");
  registerHeaderRow.innerHTML = headerHTML;

  registerBody.innerHTML = "";
  students.forEach(stu => {
    const tr = document.createElement("tr");
    let rowHTML = `<td>${stu.name}</td><td>${stu.adm}</td>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${month.padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
      const status = attendanceData[dateStr]?.[stu.adm] || "";
      rowHTML += `<td>${status}</td>`;
    }
    tr.innerHTML = rowHTML;
    registerBody.appendChild(tr);
  });

  registerTableWrapper.classList.remove("hidden");
  changeRegisterBtn.classList.remove("hidden");
  saveRegisterBtn.classList.remove("hidden");
  shareRegisterBtn.classList.remove("hidden");
}

changeRegisterBtn.addEventListener("click", () => {
  registerMonthInput.value = "";
  registerTableWrapper.classList.add("hidden");
  changeRegisterBtn.classList.add("hidden");
  saveRegisterBtn.classList.add("hidden");
  shareRegisterBtn.classList.add("hidden");
});

saveRegisterBtn.addEventListener("click", async () => {
  await idbSet("attendanceDataBySchool", attendanceDataBySchool);
  await syncToFirebase();
  alert("Attendance register saved.");
});

const { jsPDF } = window.jspdf;
const autoTable = window.jspdf?.autoTable;

const downloadRegistrationPDFBtn = document.getElementById("downloadRegistrationPDF");
downloadRegistrationPDFBtn.addEventListener("click", () => {
  const doc = new jsPDF();
  autoTable(doc, {
    head: [["#", "Adm#", "Name", "Parent", "Contact", "Occupation", "Address", "Fine", "Status"]],
    body: students.map((stu, idx) => [
      idx + 1, stu.adm, stu.name, stu.parentName, stu.contact, stu.occupation, stu.address, stu.fine, stu.status
    ])
  });
  doc.save(`Registration_${currentSchool}.pdf`);
});

const downloadAttendancePDFBtn = document.getElementById("downloadAttendancePDF");
downloadAttendancePDFBtn.addEventListener("click", () => {
  const date = dateInput.value;
  if (!date) {
    alert("Select a date first.");
    return;
  }
  const doc = new jsPDF();
  autoTable(doc, {
    head: [["#", "Adm#", "Name", "Status"]],
    body: students.map((stu, idx) => [
      idx + 1, stu.adm, stu.name, attendanceData[date]?.[stu.adm] || "P"
    ])
  });
  doc.save(`Attendance_${currentSchool}_${date}.pdf`);
});

const downloadAnalyticsBtn = document.getElementById("downloadAnalytics");
downloadAnalyticsBtn.addEventListener("click", () => {
  const doc = new jsPDF();
  autoTable({ html: "#analyticsTable", startY: 20, doc });
  doc.save(`Analytics_${currentSchool}.pdf`);
});

downloadRegisterBtn.addEventListener("click", () => {
  if (!registerMonthInput.value) {
    alert("Select a month first.");
    return;
  }
  const doc = new jsPDF();
  autoTable({ html: "#registerTable", startY: 20, doc });
  doc.save(`Register_${currentSchool}_${registerMonthInput.value}.pdf`);
});

const shareRegistrationBtn = document.getElementById("shareRegistration");
shareRegistrationBtn.addEventListener("click", () => {
  if (!navigator.share) {
    alert("Web Share API not supported.");
    return;
  }
  const data = students.map(stu => ({
    adm: stu.adm,
    name: stu.name,
    parentName: stu.parentName,
    contact: stu.contact,
    occupation: stu.occupation,
    address: stu.address,
    fine: stu.fine,
    status: stu.status
  }));
  navigator.share({
    title: `Registration Data - ${currentSchool}`,
    text: JSON.stringify(data, null, 2)
  });
});

const shareAttendanceSummaryBtn = document.getElementById("shareAttendanceSummary");
shareAttendanceSummaryBtn.addEventListener("click", () => {
  if (!navigator.share) {
    alert("Web Share API not supported.");
    return;
  }
  const date = dateInput.value;
  if (!date) {
    alert("Select a date first.");
    return;
  }
  const data = students.map(stu => ({
    adm: stu.adm,
    name: stu.name,
    status: attendanceData[date]?.[stu.adm] || "P"
  }));
  navigator.share({
    title: `Attendance Data - ${currentSchool} - ${date}`,
    text: JSON.stringify(data, null, 2)
  });
});

const shareAnalyticsBtn = document.getElementById("shareAnalytics");
shareAnalyticsBtn.addEventListener("click", () => {
  if (!navigator.share) {
    alert("Web Share API not supported.");
    return;
  }
  let filteredStudents = [...students];
  const target = analyticsTargetSelect.value;
  const section = analyticsSectionSelect.value;
  const type = analyticsTypeSelect.value;

  if (target === "section" && section) {
    filteredStudents = filteredStudents.filter(stu => stu.section === section);
  }

  let dates = Object.keys(attendanceData);
  if (type === "date") {
    dates = dates.filter(d => d === analyticsDateInput.value);
  } else if (type === "month") {
    const [y, m] = analyticsMonthInput.value.split("-");
    dates = dates.filter(d => {
      const dt = new Date(d);
      return dt.getFullYear() === +y && dt.getMonth() + 1 === +m;
    });
  } else if (type === "semester") {
    const start = semesterStartInput.value;
    const end = semesterEndInput.value;
    dates = dates.filter(d => d >= start && d <= end);
  } else if (type === "year") {
    const y = +yearStartInput.value;
    dates = dates.filter(d => new Date(d).getFullYear() === y);
  }

  const analyticsStats = filteredStudents.map(stu => {
    const stat = { adm: stu.adm, name: stu.name, P: 0, A: 0, Lt: 0, HD: 0, L: 0 };
    dates.forEach(d => {
      const status = attendanceData[d]?.[stu.adm] || "P";
      stat[status]++;
    });
    stat.total = stat.P + stat.Lt + stat.HD + stat.A + stat.L;
    stat.perc  = stat.total > 0 ? ((stat.P + stat.Lt + stat.HD) / stat.total * 100).toFixed(2) : "0.00";
    stat.outstanding = stu.fine;
    stat.status = stat.perc >= eligibilityPct ? "Eligible" : "Debarred";
    return stat;
  });

  navigator.share({
    title: `Analytics Data - ${currentSchool}`,
    text: JSON.stringify(analyticsStats, null, 2)
  });
});

const countersContainer = document.getElementById("countersContainer");

function updateCounters() {
  if (!countersContainer) return;
  countersContainer.innerHTML = "";

  const totalStudents = students.length;
  const presentToday = (() => {
    const today = new Date().toISOString().slice(0, 10);
    if (!attendanceData[today]) return 0;
    return Object.values(attendanceData[today]).filter(s => s !== "A").length;
  })();
  const absentToday = totalStudents - presentToday;
  const pendingFine = students.reduce((sum, stu) => sum + (stu.fine || 0), 0);

  const stats = [
    { label: "Total Students", number: totalStudents },
    { label: "Present Today", number: presentToday },
    { label: "Absent Today", number: absentToday },
    { label: "Total Outstanding (PKR)", number: pendingFine }
  ];

  stats.forEach(st => {
    const card = document.createElement("div");
    card.className = "counter-card card";
    card.innerHTML = `
      <div class="card-number">${st.number}</div>
      <div class="card-label">${st.label}</div>`;
    countersContainer.appendChild(card);
  });
}

function resetViews() {
  [
    document.getElementById("financial-settings"),
    document.getElementById("animatedCounters"),
    document.getElementById("student-registration"),
    document.getElementById("attendance-section"),
    document.getElementById("analytics-section"),
    document.getElementById("register-section")
  ].forEach(sec => sec.classList.add("hidden"));
}

const fineAbsentInput    = document.getElementById("fineAbsent");
const fineLateInput      = document.getElementById("fineLate");
const fineLeaveInput     = document.getElementById("fineLeave");
const fineHalfDayInput   = document.getElementById("fineHalfDay");
const eligibilityPctInput= document.getElementById("eligibilityPct");
const saveSettingsBtn    = document.getElementById("saveSettings");

(async () => {
  const storedFineRates = await idbGet("fineRates");
  const storedEligPct   = await idbGet("eligibilityPct");
  if (storedFineRates) {
    fineRates = storedFineRates;
  }
  if (storedEligPct !== undefined) {
    eligibilityPct = storedEligPct;
  }
  if (fineAbsentInput)    fineAbsentInput.value    = fineRates.A;
  if (fineLateInput)      fineLateInput.value      = fineRates.Lt;
  if (fineLeaveInput)     fineLeaveInput.value     = fineRates.L;
  if (fineHalfDayInput)   fineHalfDayInput.value   = fineRates.HD;
  if (eligibilityPctInput)eligibilityPctInput.value= eligibilityPct;
})();

saveSettingsBtn.addEventListener("click", async () => {
  fineRates.A  = +fineAbsentInput.value;
  fineRates.Lt = +fineLateInput.value;
  fineRates.L  = +fineLeaveInput.value;
  fineRates.HD = +fineHalfDayInput.value;
  eligibilityPct = +eligibilityPctInput.value;

  await idbSet("fineRates", fineRates);
  await idbSet("eligibilityPct", eligibilityPct);
  await syncToFirebase();
  alert("Financial settings saved.");
});

const paymentModal      = document.getElementById("paymentModal");
const paymentModalClose = document.getElementById("paymentModalClose");
const paymentAmountInput= document.getElementById("paymentAmount");
const savePaymentBtn    = document.getElementById("savePayment");
const cancelPaymentBtn  = document.getElementById("cancelPayment");
let currentPaymentAdm   = null;

function openPaymentModal(adm) {
  currentPaymentAdm = adm;
  document.getElementById("payAdm").textContent = adm;
  paymentModal.classList.remove("hidden");
}

paymentModalClose.addEventListener("click", () => {
  paymentModal.classList.add("hidden");
});

cancelPaymentBtn.addEventListener("click", () => {
  paymentModal.classList.add("hidden");
});

savePaymentBtn.addEventListener("click", async () => {
  const amount = +paymentAmountInput.value;
  if (!amount || amount <= 0) {
    alert("Enter a valid amount.");
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  if (!paymentsData[currentPaymentAdm]) {
    paymentsData[currentPaymentAdm] = [];
  }
  paymentsData[currentPaymentAdm].push({ date, amount });

  const stuIdx = students.findIndex(s => s.adm === currentPaymentAdm);
  if (stuIdx >= 0) {
    students[stuIdx].fine = Math.max(0, students[stuIdx].fine - amount);
  }

  paymentsDataBySchool[currentSchool] = paymentsData;
  studentsBySchool[currentSchool]     = students;
  await idbSet("paymentsDataBySchool", paymentsDataBySchool);
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();

  renderStudents();
  updateCounters();
  paymentModal.classList.add("hidden");
  paymentAmountInput.value = "";
});

function attachPaymentButtons() {
  document.querySelectorAll(".pay-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const adm = +btn.dataset.adm;
      openPaymentModal(adm);
    });
  });
}

(async () => {
  if (typeof loadSetup === "function") {
    await loadSetup();
  }

  if (countersContainer) {
    countersContainer.style.display = "flex";
    countersContainer.style.overflowX = "auto";
    countersContainer.style.whiteSpace = "nowrap";
  }
})();
