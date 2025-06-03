// app.js
// -------------------------------------------------------------------------------------------
// This file drives everything under “/appData” → IndexedDB → UI. It assumes auth.js has set
// window.currentUserProfile = { uid, name, email, role, school, class, section } and then
// dispatched document.dispatchEvent(new CustomEvent("userLoggedIn")).

// 1) IMPORTS & INITIALIZATION
import { auth, database } from "./firebase-config.js";
import {
  ref as dbRef,
  set as dbSet,
  get as dbGet,
  onValue
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// IndexedDB helpers (idb-keyval)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// --------------------
// 2) GLOBAL STATE
// --------------------
let currentSchool    = null;
let teacherClass     = null;
let teacherSection   = null;
let profileUID       = null;

// All appData nodes:
let studentsBySchool       = {};
let attendanceDataBySchool = {};
let paymentsDataBySchool   = {};
let fineRates              = {};
let eligibilityPct         = {};
let lastAdmNoBySchool      = {};
let schools                = [];

// Active on-screen lists for the selected school/class/section:
let students       = [];
let attendanceData = {};
let paymentsData   = [];

// --------------------
// 3) DOM ELEMENTS (all “id”s must match index.html exactly)
// --------------------
// SETUP panel (but app.js only uses data; setup.js handles UI there)
const setupSection = document.getElementById("teacher-setup");

// STUDENT REGISTRATION
const studentNameInput      = document.getElementById("studentName");
const parentNameInput       = document.getElementById("parentName");
const parentContactInput    = document.getElementById("parentContact");
const parentOccupationInput = document.getElementById("parentOccupation");
const parentAddressInput    = document.getElementById("parentAddress");
const addStudentBtn         = document.getElementById("addStudent");

const studentsBody          = document.getElementById("studentsBody");
const selectAllStudentsChk  = document.getElementById("selectAllStudents");
const editSelectedBtn       = document.getElementById("editSelected");
const doneEditingBtn        = document.getElementById("doneEditing");
const deleteSelectedBtn     = document.getElementById("deleteSelected");
const saveRegistrationBtn   = document.getElementById("saveRegistration");
const editRegistrationBtn   = document.getElementById("editRegistration");
const shareRegistrationBtn  = document.getElementById("shareRegistration");
const downloadRegistrationBtn = document.getElementById("downloadRegistrationPDF");

// MARK ATTENDANCE
const dateInput             = document.getElementById("dateInput");
const loadAttendanceBtn     = document.getElementById("loadAttendance");
const attendanceBodyDiv     = document.getElementById("attendanceBody");
const attendanceSummaryDiv  = document.getElementById("attendanceSummary");
const saveAttendanceBtn     = document.getElementById("saveAttendance");
const resetAttendanceBtn    = document.getElementById("resetAttendance");
const downloadAttendanceBtn = document.getElementById("downloadAttendancePDF");
const shareAttendanceBtn    = document.getElementById("shareAttendanceSummary");

// ANALYTICS
const analyticsClassSelect   = document.getElementById("analyticsClassSelect");
const analyticsSectionSelect = document.getElementById("analyticsSectionSelect");
const loadAnalyticsBtn       = document.getElementById("loadAnalytics");
const attendanceChartCanvas  = document.getElementById("attendanceChart");

// PAYMENT (Modal)
const paymentModal        = document.getElementById("paymentModal");
const paymentAdmNoInput   = document.getElementById("paymentAdmNo");
const paymentAmountInput  = document.getElementById("paymentAmount");
const paymentDateInput    = document.getElementById("paymentDate");
const addPaymentBtn       = document.getElementById("addPayment");
const paymentsBody        = document.getElementById("paymentsBody");
const savePaymentsBtn     = document.getElementById("savePayments");
const closePaymentModalBtn= document.getElementById("closePaymentModal");

// LOGOUT
const logoutBtn           = document.getElementById("logoutBtn");

// --------------------
// 4) UTILITIES
// --------------------
// Helper to get elements quickly by ID (shortcut)
function $(id) {
  return document.getElementById(id);
}

// Reset IndexedDB & reload
async function clearAllLocalData() {
  await idbClear();
  window.location.reload();
}

// --------------------
// 5) LOAD “/appData” from Firebase → store in local IndexedDB → populate UI
// --------------------
async function loadAppDataFromFirebase() {
  const appDataRef = dbRef(database, "appData");
  onValue(appDataRef, async (snapshot) => {
    const data = snapshot.exists() ? snapshot.val() : {};
    // Pull each sub-node into our state
    schools                = data.schools                || [];
    studentsBySchool       = data.studentsBySchool       || {};
    attendanceDataBySchool = data.attendanceDataBySchool || {};
    paymentsDataBySchool   = data.paymentsDataBySchool   || {};
    fineRates              = data.fineRates              || {};
    eligibilityPct         = data.eligibilityPct         || {};
    lastAdmNoBySchool      = data.lastAdmNoBySchool      || {};

    // Save each node to IndexedDB
    await idbSet("schools", schools);
    await idbSet("studentsBySchool", studentsBySchool);
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
    await idbSet("paymentsDataBySchool", paymentsDataBySchool);
    await idbSet("fineRates", fineRates);
    await idbSet("eligibilityPct", eligibilityPct);
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);

    // Also save currentSchool / teacherClass / teacherSection (in case auth.js set them earlier)
    await idbSet("currentSchool", currentSchool);
    await idbSet("teacherClass", teacherClass);
    await idbSet("teacherSection", teacherSection);

    // Finally, build the UI for whatever the logged-in user sees
    await loadSetup();
  });
}

// --------------------
// 6) SYNCHRONIZE local state (IndexedDB) → UI
//     - loadSetup() determines which “school/class/section” to show
//     - then calls renderStudents(), renderAttendanceUI(), renderAnalytics(), etc.
// --------------------
async function loadSetup() {
  // Restore from IndexedDB if they exist
  const storedSchool  = await idbGet("currentSchool");
  const storedClass   = await idbGet("teacherClass");
  const storedSection = await idbGet("teacherSection");
  currentSchool       = storedSchool    || currentSchool;
  teacherClass        = storedClass     || teacherClass;
  teacherSection      = storedSection   || teacherSection;

  const profile = window.currentUserProfile;
  if (!profile) return;

  // If Admin (no specific school), they must pick a school first
  if (profile.role === "admin") {
    // Show nothing until they pick a school somewhere in Setup
    return;
  }

  // For Principal/Teacher, we already know school/class/section from profile
  if (profile.role === "principal") {
    currentSchool = profile.school;
  }
  if (profile.role === "teacher") {
    currentSchool  = profile.school;
    teacherClass   = profile.class;
    teacherSection = profile.section;
  }

  if (!currentSchool) return;

  // Now load the local-lists for that school:
  if (!studentsBySchool[currentSchool]) {
    studentsBySchool[currentSchool] = [];
    await idbSet("studentsBySchool", studentsBySchool);
  }
  if (!attendanceDataBySchool[currentSchool]) {
    attendanceDataBySchool[currentSchool] = {};
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
  }
  if (!paymentsDataBySchool[currentSchool]) {
    paymentsDataBySchool[currentSchool] = {};
    await idbSet("paymentsDataBySchool", paymentsDataBySchool);
  }
  if (lastAdmNoBySchool[currentSchool] === undefined) {
    lastAdmNoBySchool[currentSchool] = 0;
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
  }

  // Build “students”, “attendanceData”, “paymentsData” for this school
  students       = studentsBySchool[currentSchool].filter(s => (profile.role !== "teacher" || (s.cls === teacherClass && s.sec === teacherSection)));
  attendanceData = attendanceDataBySchool[currentSchool] || {};
  paymentsData   = paymentsDataBySchool[currentSchool] || {};

  // Initial UI update:
  renderStudents();
  updateCounters();
  renderAttendanceUI();
  renderAnalytics();
}

// --------------------
// 7) STUDENT REGISTRATION FUNCTIONS
// --------------------
function renderStudents() {
  studentsBody.innerHTML = "";
  let idx = 0;
  students.forEach((s) => {
    idx++;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="studentCheckbox" data-adm="${s.adm}" /></td>
      <td>${s.adm}</td>
      <td>${s.name}</td>
      <td>${s.cls}</td>
      <td>${s.sec}</td>
      <td>${s.parentName}</td>
      <td>${s.parentContact}</td>
      <td>${s.parentOccupation}</td>
      <td>${s.parentAddress}</td>
    `;
    studentsBody.appendChild(tr);
  });
  selectAllStudentsChk.checked = false;
  selectAllStudentsChk.disabled = (students.length === 0);
  editSelectedBtn.disabled = true;
  deleteSelectedBtn.disabled = true;
}

function updateCounters() {
  // (This can update any on-screen counters if needed)
}

// Add a new student
addStudentBtn.onclick = async (e) => {
  e.preventDefault();
  const n   = studentNameInput.value.trim();
  const p   = parentNameInput.value.trim();
  const c   = parentContactInput.value.trim();
  const o   = parentOccupationInput.value.trim();
  const a   = parentAddressInput.value.trim();
  if (!n || !p || !c || !o || !a) { alert("All fields required"); return; }
  if (!/^\d{7,15}$/.test(c)) { alert("Contact must be 7–15 digits"); return; }
  if (!teacherClass || !teacherSection) {
    alert("Class and Section not set!");
    return;
  }
  // Generate new Adm No
  lastAdmNoBySchool[currentSchool]++;
  await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
  const newAdm = lastAdmNoBySchool[currentSchool];

  const newStudent = {
    adm: newAdm,
    cls: teacherClass,
    sec: teacherSection,
    name: n,
    parentName: p,
    parentContact: c,
    parentOccupation: o,
    parentAddress: a
  };
  // Update local state & IndexedDB
  students.push(newStudent);
  studentsBySchool[currentSchool] = studentsBySchool[currentSchool].concat(newStudent);
  await idbSet("studentsBySchool", studentsBySchool);

  renderStudents();
  studentNameInput.value = "";
  parentNameInput.value = "";
  parentContactInput.value = "";
  parentOccupationInput.value = "";
  parentAddressInput.value = "";
};

// Select All / None
selectAllStudentsChk.onchange = () => {
  document.querySelectorAll(".studentCheckbox").forEach(chk => {
    chk.checked = selectAllStudentsChk.checked;
  });
  editSelectedBtn.disabled = !selectAllStudentsChk.checked;
  deleteSelectedBtn.disabled = !selectAllStudentsChk.checked;
};

// Enable/Disable buttons based on selection
studentsBody.onclick = () => {
  const anyChecked = Array.from(document.querySelectorAll(".studentCheckbox"))
                         .some(chk => chk.checked);
  editSelectedBtn.disabled = !anyChecked;
  deleteSelectedBtn.disabled = !anyChecked;
};

editSelectedBtn.onclick = () => {
  // (You can implement row-by-row editing here if desired)
  alert("Row-by-row editing not yet implemented.");
};

deleteSelectedBtn.onclick = async () => {
  if (!confirm("Are you sure you want to delete selected students?")) return;
  const checked = Array.from(document.querySelectorAll(".studentCheckbox"))
                .filter(chk => chk.checked).map(chk => parseInt(chk.dataset.adm));
  students = students.filter(s => !checked.includes(s.adm));
  studentsBySchool[currentSchool] = studentsBySchool[currentSchool].filter(s => !checked.includes(s.adm));
  await idbSet("studentsBySchool", studentsBySchool);
  renderStudents();
};

// Save all registrations to Firebase
saveRegistrationBtn.onclick = async () => {
  const payload = {
    schools,
    studentsBySchool,
    attendanceDataBySchool,
    paymentsDataBySchool,
    fineRates,
    eligibilityPct,
    lastAdmNoBySchool
  };
  try {
    await dbSet(dbRef(database, "appData"), payload);
    alert("All registration data saved to server.");
  } catch (err) {
    console.error("Save error:", err);
    alert("Error saving data: " + err.message);
  }
};

// --------------------
// 8) ATTENDANCE FUNCTIONS
// --------------------
function renderAttendanceUI() {
  attendanceBodyDiv.innerHTML = "";
  if (!students.length) {
    attendanceBodyDiv.innerHTML = "<p>No students to mark attendance.</p>";
    return;
  }
  const tbl = document.createElement("table");
  tbl.innerHTML = `
    <thead>
      <tr>
        <th>Adm No</th>
        <th>Name</th>
        <th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th>
      </tr>
    </thead>
    <tbody id="attendanceTableBody"></tbody>
  `;
  attendanceBodyDiv.appendChild(tbl);

  const tbody = document.getElementById("attendanceTableBody");
  students.forEach((s) => {
    const existing = (attendanceData[dateInput.value] || {})[s.adm] || "P";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.adm}</td>
      <td>${s.name}</td>
      <td><input type="radio" name="att-${s.adm}" value="P" ${existing==="P"?"checked":""} /></td>
      <td><input type="radio" name="att-${s.adm}" value="A" ${existing==="A"?"checked":""} /></td>
      <td><input type="radio" name="att-${s.adm}" value="Lt" ${existing==="Lt"?"checked":""} /></td>
      <td><input type="radio" name="att-${s.adm}" value="HD" ${existing==="HD"?"checked":""} /></td>
      <td><input type="radio" name="att-${s.adm}" value="L" ${existing==="L"?"checked":""} /></td>
    `;
    tbody.appendChild(tr);
  });
  saveAttendanceBtn.classList.remove("hidden");
  resetAttendanceBtn.classList.remove("hidden");
  downloadAttendanceBtn.classList.remove("hidden");
  shareAttendanceBtn.classList.remove("hidden");
  attendanceSummaryDiv.classList.remove("hidden");
  generateAttendanceSummary();
}

// When “Load” is clicked:
loadAttendanceBtn.onclick = () => {
  if (!dateInput.value) { alert("Please pick a date."); return; }
  renderAttendanceUI();
};

function generateAttendanceSummary() {
  const dateKey = dateInput.value;
  if (!attendanceData[dateKey]) attendanceData[dateKey] = {};
  const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
  students.forEach(s => {
    const rec = (attendanceData[dateKey][s.adm]) || "P";
    stats[rec]++;
  });
  const total = students.length;
  attendanceSummaryDiv.innerHTML = `
    <p><strong>${dateKey}</strong> کی حاضری:</p>
    <p>Present: ${stats.P}, Absent: ${stats.A}, Late: ${stats.Lt}, Half-Day: ${stats.HD}, Leave: ${stats.L}</p>
  `;
}

saveAttendanceBtn.onclick = async () => {
  const dateKey = dateInput.value;
  if (!attendanceData[dateKey]) attendanceData[dateKey] = {};
  students.forEach(s => {
    const val = document.querySelector(`input[name="att-${s.adm}"]:checked`).value;
    attendanceData[dateKey][s.adm] = val;
  });
  attendanceDataBySchool[currentSchool][dateKey] = attendanceData[dateKey];
  await idbSet("attendanceDataBySchool", attendanceDataBySchool);

  // Push full /appData back to Firebase:
  const payload = {
    schools,
    studentsBySchool,
    attendanceDataBySchool,
    paymentsDataBySchool,
    fineRates,
    eligibilityPct,
    lastAdmNoBySchool
  };
  try {
    await dbSet(dbRef(database, "appData"), payload);
    alert("Attendance saved.");
  } catch (err) {
    console.error("Attendance save error:", err);
    alert("Error saving attendance: " + err.message);
  }
};

resetAttendanceBtn.onclick = () => {
  renderAttendanceUI();
};

downloadAttendanceBtn.onclick = () => {
  // Implement PDF export if needed via jsPDF + AutoTable
  alert("Download Attendance PDF not yet implemented.");
};

shareAttendanceBtn.onclick = () => {
  alert("Share Attendance not yet implemented.");
};

// --------------------
// 9) ANALYTICS (Chart.js)
// --------------------
loadAnalyticsBtn.onclick = () => {
  const cl  = analyticsClassSelect.value;
  const sec = analyticsSectionSelect.value;
  if (!cl || !sec) { alert("Select class & section"); return; }

  // Compute attendance percentage for each student over all dates
  const labels = [];
  const dataPts = [];
  students
    .filter(s => s.cls === cl && s.sec === sec)
    .forEach(s => {
      let presentCount = 0, totalCount = 0;
      Object.keys(attendanceData).forEach(dateKey => {
        if (attendanceData[dateKey][s.adm]) {
          totalCount++;
          if (attendanceData[dateKey][s.adm] === "P") presentCount++;
        }
      });
      const pct = totalCount ? Math.round((presentCount / totalCount) * 100) : 0;
      labels.push(`${s.adm}`);
      dataPts.push(pct);
    });

  // Build Chart
  const ctx = attendanceChartCanvas.getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Attendance %",
        data: dataPts,
        backgroundColor: "rgba(54, 162, 235, 0.5)",
        borderColor:   "rgba(54, 162, 235, 1)",
        borderWidth: 1
      }]
    },
    options: {
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });
};

// --------------------
// 10) PAYMENTS
// --------------------
let tempPayments = []; // holds new payments before saving
addPaymentBtn.onclick = (e) => {
  e.preventDefault();
  const adm  = parseInt(paymentAdmNoInput.value);
  const amt  = parseFloat(paymentAmountInput.value);
  const dt   = paymentDateInput.value;
  if (!adm || !amt || !dt) { alert("All fields required"); return; }
  const existingStudent = students.find(s => s.adm === adm);
  if (!existingStudent) { alert("Invalid Adm No for this school."); return; }
  tempPayments.push({ adm, amount: amt, date: dt });
  renderTempPayments();
  paymentAdmNoInput.value = "";
  paymentAmountInput.value = "";
  paymentDateInput.value = "";
};

function renderTempPayments() {
  paymentsBody.innerHTML = "";
  tempPayments.forEach((p, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.adm}</td>
      <td>${p.amount}</td>
      <td>${p.date}</td>
      <td><button class="removePaymentBtn" data-idx="${idx}">Remove</button></td>
    `;
    paymentsBody.appendChild(tr);
  });
  document.querySelectorAll(".removePaymentBtn").forEach(btn => {
    btn.onclick = (e) => {
      const i = parseInt(e.target.dataset.idx);
      tempPayments.splice(i, 1);
      renderTempPayments();
    };
  });
}

savePaymentsBtn.onclick = async () => {
  // Merge tempPayments into paymentsDataBySchool[currentSchool]
  if (!paymentsDataBySchool[currentSchool]) {
    paymentsDataBySchool[currentSchool] = {};
  }
  tempPayments.forEach(p => {
    if (!paymentsDataBySchool[currentSchool][p.adm]) {
      paymentsDataBySchool[currentSchool][p.adm] = [];
    }
    paymentsDataBySchool[currentSchool][p.adm].push({ amount: p.amount, date: p.date });
  });
  await idbSet("paymentsDataBySchool", paymentsDataBySchool);

  // Save entire /appData back to Firebase
  const payload = {
    schools,
    studentsBySchool,
    attendanceDataBySchool,
    paymentsDataBySchool,
    fineRates,
    eligibilityPct,
    lastAdmNoBySchool
  };
  try {
    await dbSet(dbRef(database, "appData"), payload);
    alert("Payments saved.");
    tempPayments = [];
    renderTempPayments();
  } catch (err) {
    console.error("Payment save error:", err);
    alert("Error saving payments: " + err.message);
  }
};

closePaymentModalBtn.onclick = () => {
  paymentModal.classList.add("hidden");
};

// --------------------
// 11) LOGOUT
// --------------------
logoutBtn.onclick = async () => {
  try {
    await auth.signOut();
    clearAllLocalData();
  } catch (err) {
    console.error("Logout error:", err);
    alert("Error logging out: " + err.message);
  }
};

// --------------------
// 12) LISTEN FOR USER LOGIN (triggered by auth.js)
// --------------------
async function onUserLoggedIn() {
  const user = auth.currentUser;
  if (!user) return;
  profileUID = user.uid;
  // Pull the user’s profile (we assume auth.js wrote profile under “users/{uid}”)
  const profileRef = dbRef(database, `users/${profileUID}`);
  const snap = await dbGet(profileRef);
  window.currentUserProfile = snap.exists() ? snap.val() : null;

  // If login successful, hide #auth-container & show #main-app
  document.getElementById("auth-container").classList.add("hidden");
  document.getElementById("main-app").classList.remove("hidden");

  // Set currentSchool, etc., based on profile
  const prof = window.currentUserProfile;
  if (prof) {
    if (prof.role === "principal") {
      currentSchool = prof.school;
    } else if (prof.role === "teacher") {
      currentSchool  = prof.school;
      teacherClass   = prof.class;
      teacherSection = prof.section;
    }
  }

  // Start syncing /appData
  loadAppDataFromFirebase();
}

document.addEventListener("userLoggedIn", onUserLoggedIn);

// --------------------
// 13) IMMEDIATELY SUBSCRIBE if already logged in (e.g., page reload)
// --------------------
auth.onAuthStateChanged((user) => {
  if (user) {
    document.dispatchEvent(new CustomEvent("userLoggedIn"));
  }
});
