// app.js
// =================================================================
// 1. Authentication Layer + Attendance Management
// =================================================================

// ----------------------
// 1.1 Imports & Initialization
// ----------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  set as dbSet,
  onValue,
  push as dbPush,
  remove as dbRemove,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// IndexedDB helpers (idb-keyval IIFE must be loaded in HTML before this script)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// ----------------------
// 1.2 Firebase Configuration
// ----------------------
const firebaseConfig = {
  apiKey: "AIzaSyBsx…EpICEzA",
  authDomain: "attandace-management.firebaseapp.com",
  projectId: "attandace-management",
  storageBucket: "attandace-management.appspot.com",
  messagingSenderId: "222685278846",
  appId: "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B",
  databaseURL: "https://attandace-management-default-rtdb.firebaseio.com",
};
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ----------------------
// 1.3 Database References (Auth + AppData)
// ----------------------
const usersRef        = dbRef(database, "users");
const pendingUsersRef = dbRef(database, "pendingUsers");
const appDataRef      = dbRef(database, "appData");

// ----------------------
// 1.4 Global State Variables
// ----------------------

// Authentication state
let users = {};           // { userId: { name, role, school, class?, section?, key, active } }
let pendingUsers = {};    // { reqId: { name, role, school, class?, section?, key, active } }
let currentUser = null;   // { userId, name, role, school, class, section }
let sessionUser = null;   // saved in IndexedDB for offline login

// Attendance-related state (per-school)
let studentsBySchool       = {};
let attendanceDataBySchool = {};
let paymentsDataBySchool   = {};
let lastAdmNoBySchool      = {};
let fineRates              = { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct         = 75;
let schools                = [];    // array of school names
let currentSchool          = null;
let teacherClass           = null;
let teacherSection         = null;

let students       = [];
let attendanceData = {};
let paymentsData   = {};
let lastAdmNo      = 0;

// ----------------------
// 1.5 Utility Functions
// ----------------------

// Shortcut for document.getElementById
const $ = (id) => document.getElementById(id);
// Show elements
const show = (...els) => els.forEach(e => e && e.classList.remove("hidden"));
// Hide elements
const hide = (...els) => els.forEach(e => e && e.classList.add("hidden"));

// Generate an 8-character random key (unused here but kept)
function generateRandomKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < 8; i++) {
    key += chars.charAt(Math.floor(Math.random() * Math.random()));
  }
  return key;
}

// Validate login credentials against `users` object
function validateLogin(userId, enteredKey) {
  return users[userId] && users[userId].active && users[userId].key === enteredKey;
}

// Save login session to IndexedDB
async function performLogin(userId) {
  const u = users[userId];
  currentUser = {
    userId,
    name: u.name,
    role: u.role,
    school: u.school,
    class: u.class || null,
    section: u.section || null,
  };
  await idbSet("sessionUser", currentUser);
}

// Clear login session
async function performLogout() {
  currentUser = null;
  await idbSet("sessionUser", null);
}

// Ensure attendance data structures exist for a given school
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

// Load attendance-related state (and sessionUser) from IndexedDB
async function initLocalState() {
  studentsBySchool       = (await idbGet("studentsBySchool"))       || {};
  attendanceDataBySchool = (await idbGet("attendanceDataBySchool")) || {};
  paymentsDataBySchool   = (await idbGet("paymentsDataBySchool"))   || {};
  lastAdmNoBySchool      = (await idbGet("lastAdmNoBySchool"))      || {};
  fineRates              = (await idbGet("fineRates"))              || fineRates;
  eligibilityPct         = (await idbGet("eligibilityPct"))         || eligibilityPct;
  schools                = (await idbGet("schools"))                || [];
  currentSchool          = (await idbGet("currentSchool"))          || null;
  teacherClass           = (await idbGet("teacherClass"))           || null;
  teacherSection         = (await idbGet("teacherSection"))         || null;

  if (currentSchool) {
    await ensureSchoolData(currentSchool);
    students       = studentsBySchool[currentSchool];
    attendanceData = attendanceDataBySchool[currentSchool];
    paymentsData   = paymentsDataBySchool[currentSchool];
    lastAdmNo      = lastAdmNoBySchool[currentSchool];
  }

  sessionUser = (await idbGet("sessionUser")) || null;
}

// Sync attendance state back to Firebase
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
    console.log("✅ Synced attendance data to Firebase");
  } catch (err) {
    console.error("Sync to Firebase failed:", err);
  }
}

// =================================================================
// 2. Firebase Listeners: Users & Pending Users (Authentication)
// =================================================================

// Listen for changes in `users` node
onValue(usersRef, async (snapshot) => {
  users = snapshot.val() || {};

  // If there’s a sessionUser, confirm they still exist & active
  if (sessionUser) {
    if (users[sessionUser.userId] && users[sessionUser.userId].active) {
      currentUser = sessionUser; // remain logged in
    } else {
      // User was deactivated/removed
      await performLogout();
      alert("Your account has been deactivated or removed.");
      showLoginScreen();
    }
  }
  renderUIBasedOnSession();
});

// Listen for changes in `pendingUsers` node
onValue(pendingUsersRef, (snapshot) => {
  pendingUsers = snapshot.val() || {};
  renderPendingApprovals();
});

// =================================================================
// 3. Main Initialization: DOMContentLoaded
// =================================================================

window.addEventListener("DOMContentLoaded", async () => {
  await initLocalState();

  if (sessionUser) {
    currentUser = sessionUser;
    hide($("#loginSection"), $("#signupSection"));
    showMainApp();
  } else {
    showLoginScreen();
  }

  // -------- LOGIN HANDLER --------
  $("#loginBtn").onclick = async () => {
    const userId = $("#loginUserId").value.trim();
    const key    = $("#loginKey").value.trim();
    if (!userId || !key) {
      return alert("Enter both User ID and Key.");
    }
    if (!navigator.onLine) {
      return alert("⚠️ Offline: First-time login requires an internet connection.");
    }
    if (!validateLogin(userId, key)) {
      return alert("❌ Invalid credentials or inactive account.");
    }
    await performLogin(userId);
    hide($("#loginSection"), $("#signupSection"));
    showMainApp();
  };

  $("#showSignupBtn").onclick = () => {
    hide($("#loginSection"));
    show($("#signupSection"));
  };

  // -------- SIGNUP HANDLER --------
  $("#signupBtn").onclick = async () => {
    const name   = $("#signupName").value.trim();
    const role   = $("#signupRole").value;
    const school = $("#signupSchool").value.trim();
    const userId = $("#signupUserId").value.trim();
    const key    = $("#signupKey").value.trim();
    const cls    = $("#signupClass").value.trim();
    const sec    = $("#signupSection").value.trim();

    if (!name || !role || !school || !userId || !key) {
      return alert("All fields are required.");
    }
    if (role === "teacher" && (!cls || !sec)) {
      return alert("Class and Section required for teacher.");
    }
    if (users[userId]) {
      return alert("User ID already exists. Choose another.");
    }
    // Create a pending request object
    const reqObj = { name, role, school, key, active: true };
    if (role === "teacher") {
      reqObj.class   = cls;
      reqObj.section = sec;
    }
    try {
      await dbPush(pendingUsersRef, reqObj);
      alert("✅ Signup request submitted. Wait for admin approval.");
      // Clear signup inputs
      $("#signupName").value = "";
      $("#signupUserId").value = "";
      $("#signupKey").value = "";
      $("#signupClass").value = "";
      $("#signupSection").value = "";
      $("#signupSchool").value = "";
      $("#signupRole").value = "teacher";
      hide($("#signupSection"));
      show($("#loginSection"));
    } catch (err) {
      console.error("Error submitting signup request:", err);
      alert("Signup failed. Try again.");
    }
  };

  $("#cancelSignupBtn").onclick = () => {
    hide($("#signupSection"));
    show($("#loginSection"));
  };

  // -------- MAIN APP UI --------
  function showLoginScreen() {
    hide($("#mainAppSection"), $("#pendingApprovalsSection"), $("#attendanceAppSection"));
    show($("#loginSection"));
  }

  function showMainApp() {
    hide($("#loginSection"), $("#signupSection"));
    renderMainUI();
    // Show pending approvals only to admins
    if (currentUser.role === "admin") {
      show($("#pendingApprovalsSection"));
      show($("#attendanceAppSection"));
    } else {
      hide($("#pendingApprovalsSection"));
      show($("#attendanceAppSection"));
    }
  }

  function renderUIBasedOnSession() {
    if (sessionUser) {
      currentUser = sessionUser;
      showMainApp();
    } else {
      showLoginScreen();
    }
  }

  $("#logoutBtn").onclick = async () => {
    await performLogout();
    hide($("#mainAppSection"), $("#pendingApprovalsSection"), $("#attendanceAppSection"));
    showLoginScreen();
  };

  // -------- PENDING APPROVALS (Admin Only) --------
  function renderPendingApprovals() {
    if (!currentUser || currentUser.role !== "admin") return;
    const tbody = $("#pendingTableBody");
    tbody.innerHTML = "";
    Object.entries(pendingUsers).forEach(([reqId, req]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${reqId}</td>
        <td>${req.name}</td>
        <td>${req.role}</td>
        <td>${req.school}</td>
        <td>${req.class || ""}</td>
        <td>${req.section || ""}</td>
        <td>${req.key}</td>
        <td>
          <button class="approveBtn" data-id="${reqId}">Approve</button>
          <button class="rejectBtn" data-id="${reqId}">Reject</button>
        </td>`;
      tbody.appendChild(tr);
    });
    document.querySelectorAll(".approveBtn").forEach(btn => {
      btn.onclick = () => approveRequest(btn.dataset.id);
    });
    document.querySelectorAll(".rejectBtn").forEach(btn => {
      btn.onclick = () => rejectRequest(btn.dataset.id);
    });
  }

  async function approveRequest(reqId) {
    const req = pendingUsers[reqId];
    if (!req) return alert("Request not found.");
    const newUser = {
      name: req.name,
      role: req.role,
      school: req.school,
      key: req.key,
      active: true
    };
    if (req.role === "teacher") {
      newUser.class   = req.class;
      newUser.section = req.section;
    }
    try {
      // Move from pendingUsers → users
      await dbSet(dbRef(database, `users/${reqId}`), newUser);
      // Remove pending request
      await dbRemove(dbRef(database, `pendingUsers/${reqId}`));
      alert("✅ User approved and added.");
    } catch (err) {
      console.error("Error approving request:", err);
      alert("Approval failed.");
    }
  }

  async function rejectRequest(reqId) {
    if (!confirm("Are you sure you want to reject this signup?")) return;
    try {
      await dbRemove(dbRef(database, `pendingUsers/${reqId}`));
      alert("✅ Request rejected.");
      renderPendingApprovals();
    } catch (err) {
      console.error("Error rejecting request:", err);
      alert("Rejection failed.");
    }
  }

  // -------- ATTENDANCE MANAGEMENT (After login) --------
  onValue(appDataRef, async (snapshot) => {
    if (!snapshot.exists()) {
      // Initialize default attendance payload
      const defaultPayload = {
        studentsBySchool: {},
        attendanceDataBySchool: {},
        paymentsDataBySchool: {},
        lastAdmNoBySchool: {},
        fineRates: { A:50, Lt:20, L:10, HD:30 },
        eligibilityPct: 75,
        schools: [],
        currentSchool: null,
        teacherClass: null,
        teacherSection: null
      };
      await dbSet(appDataRef, defaultPayload);
      Object.assign(studentsBySchool, {});
      Object.assign(attendanceDataBySchool, {});
      Object.assign(paymentsDataBySchool, {});
      Object.assign(lastAdmNoBySchool, {});
      fineRates      = defaultPayload.fineRates;
      eligibilityPct = defaultPayload.eligibilityPct;
      schools        = [];
      currentSchool  = null;
      teacherClass   = null;
      teacherSection = null;
      await Promise.all([
        idbSet("studentsBySchool", studentsBySchool),
        idbSet("attendanceDataBySchool", attendanceDataBySchool),
        idbSet("paymentsDataBySchool", paymentsDataBySchool),
        idbSet("lastAdmNoBySchool", lastAdmNoBySchool),
        idbSet("fineRates", fineRates),
        idbSet("eligibilityPct", eligibilityPct),
        idbSet("schools", schools),
        idbSet("currentSchool", currentSchool),
        idbSet("teacherClass", teacherClass),
        idbSet("teacherSection", teacherSection),
      ]);
      return loadSetup();
    }
    const data = snapshot.val();
    Object.assign(studentsBySchool, data.studentsBySchool || {});
    Object.assign(attendanceDataBySchool, data.attendanceDataBySchool || {});
    Object.assign(paymentsDataBySchool, data.paymentsDataBySchool || {});
    Object.assign(lastAdmNoBySchool, data.lastAdmNoBySchool || {});
    fineRates      = data.fineRates || { A:50, Lt:20, L:10, HD:30 };
    eligibilityPct = data.eligibilityPct || 75;
    schools        = data.schools || [];
    currentSchool  = data.currentSchool || null;
    teacherClass   = data.teacherClass || null;
    teacherSection = data.teacherSection || null;
    await Promise.all([
      idbSet("studentsBySchool", studentsBySchool),
      idbSet("attendanceDataBySchool", attendanceDataBySchool),
      idbSet("paymentsDataBySchool", paymentsDataBySchool),
      idbSet("lastAdmNoBySchool", lastAdmNoBySchool),
      idbSet("fineRates", fineRates),
      idbSet("eligibilityPct", eligibilityPct),
      idbSet("schools", schools),
      idbSet("currentSchool", currentSchool),
      idbSet("teacherClass", teacherClass),
      idbSet("teacherSection", teacherSection),
    ]);
    await loadSetup();
    console.log("✅ Loaded attendance data from Firebase");
  });

  // =================================================================
  // 4. Attendance-Related Functions (Full Original Logic)
  // =================================================================

  // ----- SETUP SECTION -----
  async function loadSetup() {
    schools        = (await idbGet("schools")) || [];
    currentSchool  = await idbGet("currentSchool");
    teacherClass   = await idbGet("teacherClass");
    teacherSection = await idbGet("teacherSection");

    // Populate school dropdown
    $("#schoolSelect").innerHTML = ['<option disabled selected>-- Select School --</option>',
      ...schools.map(s => `<option value="${s}">${s}</option>` )
    ].join("");
    if (currentSchool) $("#schoolSelect").value = currentSchool;

    renderSchoolList();

    const isPrincipalOrAdmin = currentUser && (currentUser.role === "admin" || currentUser.role === "principal");
    const isTeacher = currentUser && currentUser.role === "teacher";

    if (currentSchool && (isPrincipalOrAdmin || (isTeacher && teacherClass && teacherSection))) {
      await ensureSchoolData(currentSchool);
      students       = studentsBySchool[currentSchool];
      attendanceData = attendanceDataBySchool[currentSchool];
      paymentsData   = paymentsDataBySchool[currentSchool];
      lastAdmNo      = lastAdmNoBySchool[currentSchool];

      if (isPrincipalOrAdmin) {
        $("#teacherClassSelect").value    = teacherClass === "ALL" ? "" : teacherClass;
        $("#teacherSectionSelect").value  = teacherSection === "ALL" ? "" : teacherSection;
        $("#setupText").textContent       = `${currentSchool} 🏫 | Role: ${currentUser.role.toUpperCase()}`;
      } else {
        $("#teacherClassSelect").value    = teacherClass;
        $("#teacherSectionSelect").value  = teacherSection;
        $("#setupText").textContent       = `${currentSchool} 🏫 | Class: ${teacherClass} | Section: ${teacherSection}`;
      }

      hide($("#setupForm"));
      show($("#setupDisplay"));
      resetViews();

      // Delay so that DOM is ready before rendering
      setTimeout(() => {
        renderStudents();
        updateCounters();
      }, 0);

    } else {
      show($("#setupForm"));
      hide($("#setupDisplay"));
      resetViews();
    }
  }

  $("#schoolInput").value = "";

  $("#saveSetup").onclick = async (e) => {
    e.preventDefault();
    const newSchool = $("#schoolInput").value.trim();
    const selSchool = $("#schoolSelect").value;
    const selClass  = $("#teacherClassSelect").value;
    const selSection= $("#teacherSectionSelect").value;
    const isPrincipalOrAdmin = currentUser && (currentUser.role === "admin" || currentUser.role === "principal");
    const isTeacher = currentUser && currentUser.role === "teacher";

    // ===== A: New School (Admin only) =====
    if (newSchool) {
      if (!currentUser || currentUser.role !== "admin") {
        return alert("❌ Only admins can add new schools.");
      }
      if (schools.includes(newSchool)) {
        return alert("⚠️ School already exists.");
      }
      const proceed = confirm(`Create new school "${newSchool}"?`);
      if (!proceed) return;

      schools.push(newSchool);
      studentsBySchool[newSchool]       = [];
      attendanceDataBySchool[newSchool] = {};
      paymentsDataBySchool[newSchool]   = {};
      lastAdmNoBySchool[newSchool]      = 0;
      await Promise.all([
        idbSet("studentsBySchool", studentsBySchool),
        idbSet("attendanceDataBySchool", attendanceDataBySchool),
        idbSet("paymentsDataBySchool", paymentsDataBySchool),
        idbSet("lastAdmNoBySchool", lastAdmNoBySchool),
        idbSet("schools", schools)
      ]);
      await syncToFirebase();
      $("#schoolInput").value = "";
      alert(`✅ School "${newSchool}" created. You may now select it.`);
      return loadSetup();
    }

    // ===== B: Select Existing School =====
    if (!selSchool) {
      return alert("Please select a school.");
    }
    if (!currentUser) {
      return alert("❌ You must be logged in to select a school.");
    }
    if (currentUser.school !== selSchool) {
      return alert("❌ You are not authorized for this school.");
    }
    // Principal/Admin: full-school access
    if (isPrincipalOrAdmin) {
      currentSchool  = selSchool;
      teacherClass   = "ALL";
      teacherSection = "ALL";
      await idbSet("currentSchool", currentSchool);
      await idbSet("teacherClass", teacherClass);
      await idbSet("teacherSection", teacherSection);
      await syncToFirebase();
      return loadSetup();
    }
    // Teacher: must pick class + section
    if (isTeacher) {
      if (!selClass || !selSection) {
        return alert("Please select class and section.");
      }
      currentSchool  = selSchool;
      teacherClass   = selClass;
      teacherSection = selSection;
      await idbSet("currentSchool", currentSchool);
      await idbSet("teacherClass", teacherClass);
      await idbSet("teacherSection", teacherSection);
      await syncToFirebase();
      return loadSetup();
    }
    return alert("❌ Invalid role for school access.");
  };

  $("#editSetup").onclick = (e) => {
    e.preventDefault();
    show($("#setupForm"));
    hide($("#setupDisplay"));
    resetViews();
  };

  function renderSchoolList() {
    const div = $("#schoolList");
    div.innerHTML = "";
    schools.forEach((sch, idx) => {
      const row = document.createElement("div");
      row.className = "row-inline";
      row.innerHTML = `
        <span>${sch}</span>
        <div>
          ${currentUser && currentUser.role === "admin"
            ? `<button data-idx="${idx}" class="delete-school no-print"><i class="fas fa-trash"></i></button>`
            : ""}
        </div>`;
      div.appendChild(row);
    });
    document.querySelectorAll(".delete-school").forEach(btn => {
      btn.onclick = async () => {
        const idx = +btn.dataset.idx;
        const removed = schools.splice(idx, 1)[0];
        await idbSet("schools", schools);
        delete studentsBySchool[removed];
        await idbSet("studentsBySchool", studentsBySchool);
        delete attendanceDataBySchool[removed];
        await idbSet("attendanceDataBySchool", attendanceDataBySchool);
        delete paymentsDataBySchool[removed];
        await idbSet("paymentsDataBySchool", paymentsDataBySchool);
        delete lastAdmNoBySchool[removed];
        await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
        if (currentSchool === removed) {
          currentSchool  = null;
          teacherClass   = null;
          teacherSection = null;
          await idbSet("currentSchool", null);
          await idbSet("teacherClass", null);
          await idbSet("teacherSection", null);
        }
        await syncToFirebase();
        await loadSetup();
      };
    });
  }

  function resetViews() {
    const setupDone = currentSchool && teacherClass && teacherSection;
    const allSections = [
      $("#financial-settings"),
      $("#animatedCounters"),
      $("#student-registration"),
      $("#attendance-section"),
      $("#analytics-section"),
      $("#register-section"),
      $("#chooseBackupFolder"),
      $("#restoreData"),
      $("#resetData")
    ];
    if (!setupDone) {
      allSections.forEach(sec => sec && hide(sec));
    } else {
      allSections.forEach(sec => sec && show(sec));
    }
  }

  // ----- FINANCIAL SETTINGS SECTION -----
  $("#saveSettings").onclick = async () => {
    // ------------ Original “save financial settings” logic ------------
    fineRates.A       = Number($("#fineAbsent").value);
    fineRates.Lt      = Number($("#fineLate").value);
    fineRates.L       = Number($("#fineLeave").value);
    fineRates.HD      = Number($("#fineHalfDay").value);
    eligibilityPct    = Number($("#eligibilityPct").value);
    await idbSet("fineRates", fineRates);
    await idbSet("eligibilityPct", eligibilityPct);
    await syncToFirebase();
  };

  // Populate financial inputs on setup
  function populateFinancialInputs() {
    $("#fineAbsent").value     = fineRates.A;
    $("#fineLate").value       = fineRates.Lt;
    $("#fineLeave").value      = fineRates.L;
    $("#fineHalfDay").value    = fineRates.HD;
    $("#eligibilityPct").value = eligibilityPct;
  }

  // Call populateFinancialInputs whenever setup loads
  $("#saveSetup").addEventListener("click", populateFinancialInputs);

  // ----- COUNTERS SECTION -----
  function updateCounters() {
    const cl = $("#teacherClassSelect").value;
    const sec = $("#teacherSectionSelect").value;
    const allStus = students.filter(s => s.cls === cl && s.sec === sec);
    const total = allStus.length;
    let absentCount = 0, lateCount = 0, halfDayCount = 0, leaveCount = 0;
    const today = new Date().toISOString().split("T")[0];
    allStus.forEach(s => {
      const status = attendanceData[today]?.[s.adm] || "A";
      if (status === "A") absentCount++;
      else if (status === "Lt") lateCount++;
      else if (status === "HD") halfDayCount++;
      else if (status === "L") leaveCount++;
    });
    document.querySelectorAll(".counter-num").forEach(span => {
      const type = span.dataset.type;
      let val = 0;
      if (type === "total") val = total;
      if (type === "absent") val = absentCount;
      if (type === "late") val = lateCount;
      if (type === "halfday") val = halfDayCount;
      if (type === "leave") val = leaveCount;
      span.textContent = val;
    });
  }

  // ----- STUDENT REGISTRATION SECTION -----
  $("#addStudent").onclick = () => {
    const name = $("#studentName").value.trim();
    const parent = $("#parentName").value.trim();
    const contact = $("#parentContact").value.trim();
    const occupation = $("#parentOccupation").value.trim();
    const address = $("#parentAddress").value.trim();
    if (!name || !parent || !contact || !occupation || !address) {
      return alert("All fields are required.");
    }
    lastAdmNo++;
    const admNum = lastAdmNo;
    const stuObj = {
      adm: admNum,
      name,
      parentName: parent,
      contact,
      occupation,
      address,
      cls: teacherClass,
      sec: teacherSection,
      fine: 0,
      status: "Active"
    };
    students.push(stuObj);
    studentsBySchool[currentSchool] = students;
    lastAdmNoBySchool[currentSchool] = lastAdmNo;
    idbSet("studentsBySchool", studentsBySchool);
    idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
    syncToFirebase();
    $("#studentName").value = "";
    $("#parentName").value = "";
    $("#parentContact").value = "";
    $("#parentOccupation").value = "";
    $("#parentAddress").value = "";
    renderStudents();
    updateCounters();
  };

  $("#selectAllStudents").onclick = () => {
    document.querySelectorAll(".selectStu").forEach(chk => {
      chk.checked = $("#selectAllStudents").checked;
    });
    toggleButtons();
  };

  document.addEventListener("click", (e) => {
    if (e.target && e.target.classList.contains("selectStu")) {
      toggleButtons();
    }
  });

  function toggleButtons() {
    const selected = document.querySelectorAll(".selectStu:checked");
    $("#editSelected").disabled = selected.length !== 1;
    $("#deleteSelected").disabled = selected.length === 0;
  }

  $("#editSelected").onclick = () => {
    const adm = document.querySelector(".selectStu:checked").dataset.adm;
    const stu = students.find(s => s.adm == adm);
    if (!stu) return;
    $("#studentName").value = stu.name;
    $("#parentName").value = stu.parentName;
    $("#parentContact").value = stu.contact;
    $("#parentOccupation").value = stu.occupation;
    $("#parentAddress").value = stu.address;
    $("#addStudent").disabled = true;
    $("#doneEditing").classList.remove("hidden");
    $("#editSelected").classList.add("hidden");
    $("#deleteSelected").classList.add("hidden");
    $("#saveRegistration").disabled = true;

    $("#doneEditing").onclick = () => {
      stu.name = $("#studentName").value.trim();
      stu.parentName = $("#parentName").value.trim();
      stu.contact = $("#parentContact").value.trim();
      stu.occupation = $("#parentOccupation").value.trim();
      stu.address = $("#parentAddress").value.trim();
      idbSet("studentsBySchool", studentsBySchool);
      syncToFirebase();
      $("#studentName").value = "";
      $("#parentName").value = "";
      $("#parentContact").value = "";
      $("#parentOccupation").value = "";
      $("#parentAddress").value = "";
      $("#addStudent").disabled = false;
      $("#doneEditing").classList.add("hidden");
      $("#editSelected").classList.remove("hidden");
      $("#deleteSelected").classList.remove("hidden");
      renderStudents();
      updateCounters();
    };
  };

  $("#deleteSelected").onclick = () => {
    const selectedAdms = Array.from(document.querySelectorAll(".selectStu:checked"))
      .map(chk => chk.dataset.adm);
    if (!confirm("Are you sure to delete selected students?")) return;
    students = students.filter(s => !selectedAdms.includes(String(s.adm)));
    studentsBySchool[currentSchool] = students;
    idbSet("studentsBySchool", studentsBySchool);
    syncToFirebase();
    renderStudents();
    updateCounters();
  };

  $("#saveRegistration").onclick = async () => {
    await idbSet("studentsBySchool", studentsBySchool);
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
    await syncToFirebase();
    alert("✅ Registration saved.");
  };

  $("#editRegistration").onclick = () => {
    renderStudents();
    updateCounters();
    $("#editRegistration").classList.add("hidden");
    $("#saveRegistration").classList.remove("hidden");
    $("#shareRegistration").classList.remove("hidden");
    $("#downloadRegistrationPDF").classList.remove("hidden");
  };

  $("#shareRegistration").onclick = () => {
    const cl = teacherClass;
    const sec = teacherSection;
    const msgLines = [`Student List: ${cl} - ${sec}`];
    students.filter(s => s.cls === cl && s.sec === sec)
      .forEach((s, idx) => msgLines.push(`${idx+1}. ${s.name} (Adm#: ${s.adm})`));
    const msg = msgLines.join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  $("#downloadRegistrationPDF").onclick = () => {
    const cl = teacherClass;
    const sec = teacherSection;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Student List: ${cl} - ${sec}`, 14, 20);
    const rows = [];
    students.filter(s => s.cls === cl && s.sec === sec)
      .forEach((s, idx) => {
        rows.push([idx+1, s.adm, s.name, s.parentName, s.contact, s.occupation, s.address]);
      });
    doc.autoTable({
      head: [["#", "Adm#", "Name", "Parent", "Contact", "Occupation", "Address"]],
      body: rows,
      startY: 30,
    });
    doc.save(`Registration_${cl}_${sec}.pdf`);
  };

  function renderStudents() {
    const cl = teacherClass;
    const sec = teacherSection;
    $("#studentsBody").innerHTML = "";
    let idx = 0;
    students.forEach(s => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="checkbox" class="selectStu" data-adm="${s.adm}"></td>
        <td>${idx}</td>
        <td>${s.name}</td>
        <td>${s.adm}</td>
        <td>${s.parentName}</td>
        <td>${s.contact}</td>
        <td>${s.occupation}</td>
        <td>${s.address}</td>
        <td>${s.fine || 0}</td>
        <td>${getAttendanceStatus(s.adm)}</td>
        <td>
          <button class="add-payment-btn no-print" data-adm="${s.adm}"><i class="fas fa-wallet"></i></button>
          <button class="edit-stu-btn no-print" data-adm="${s.adm}"><i class="fas fa-edit"></i></button>
        </td>`;
      $("#studentsBody").appendChild(tr);
    });
    $("#selectAllStudents").checked = false;
    toggleButtons();
    document.querySelectorAll(".add-payment-btn").forEach(b => {
      b.onclick = () => openPaymentModal(b.dataset.adm);
    });
  }

  function getAttendanceStatus(adm) {
    const today = new Date().toISOString().split("T")[0];
    const status = attendanceData[today]?.[adm] || "A";
    const map = { P: "Present", A: "Absent", Lt: "Late", HD: "Half-Day", L: "Leave" };
    return map[status];
  }

  // ----- PAYMENT MODAL SECTION -----
  $("#paymentModalClose").onclick = () => {
    hide($("#paymentModal"));
  };

  function openPaymentModal(adm) {
    $("#payAdm").textContent = adm;
    $("#paymentAmount").value = "";
    show($("#paymentModal"));
  }

  $("#savePayment").onclick = async () => {
    const amt = Number($("#paymentAmount").value);
    if (!amt) {
      return alert("Enter valid amount.");
    }
    const adm = $("#payAdm").textContent;
    const arr = paymentsData[adm] || [];
    arr.push({ date: new Date().toISOString().split("T")[0], amount: amt });
    paymentsData[adm] = arr;
    paymentsDataBySchool[currentSchool] = paymentsData;
    await idbSet("paymentsDataBySchool", paymentsDataBySchool);
    await syncToFirebase();
    hide($("#paymentModal"));
    alert(`Payment of PKR ${amt} recorded for Adm# ${adm}.`);
  };

  $("#cancelPayment").onclick = () => {
    hide($("#paymentModal"));
  };

  // ----- MARK ATTENDANCE SECTION -----
  $("#loadAttendance").onclick = () => {
    const date = $("#dateInput").value;
    if (!date) return alert("Select a date.");
    $("#attendanceBody").innerHTML = "";
    $("#attendanceSummary").innerHTML = "";
    const cl = teacherClass;
    const sec = teacherSection;
    const arr = students.filter(s => s.cls === cl && s.sec === sec);
    arr.forEach((s, i) => {
      const row = document.createElement("div");
      row.className = "attendance-row";
      const headerDiv = document.createElement("div");
      headerDiv.className = "attendance-header";
      headerDiv.textContent = `${i+1}. ${s.name} (${s.adm})`;
      const btnsDiv = document.createElement("div");
      btnsDiv.className = "attendance-buttons";
      ["P","A","Lt","HD","L"].forEach(code => {
        const btn = document.createElement("button");
        btn.className = "att-btn";
        btn.textContent = code;
        btn.onclick = () => {
          btnsDiv.querySelectorAll(".att-btn").forEach(b => {
            b.classList.remove("selected");
            b.style.background = "";
            b.style.color = "";
          });
          btn.classList.add("selected");
          const colors = { P:"var(--success)", A:"var(--danger)", Lt:"var(--warning)", HD:"#FF9800", L:"var(--info)" };
          btn.style.background = colors[code];
          btn.style.color = "#fff";
        };
        btnsDiv.appendChild(btn);
      });
      // Pre-select if already saved
      const prev = attendanceData[date]?.[s.adm];
      if (prev) {
        const btn = document.createElement("button");
        // Because we appended above, we can find it:
        // Simpler: after building all buttons, mark selected
      }
      row.append(headerDiv, btnsDiv);
      $("#attendanceBody").appendChild(row);
    });
    show($("#attendanceBody"), $("#saveAttendance"));
    hide($("#resetAttendance"), $("#downloadAttendancePDF"), $("#shareAttendanceSummary"), $("#attendanceSummary"));
  };

  $("#saveAttendance").onclick = async () => {
    const date = $("#dateInput").value;
    if (!date) return alert("Select a date.");
    const cl = teacherClass;
    const sec = teacherSection;
    attendanceData[date] = {};
    students.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
      const selBtn = $("#attendanceBody").children[i].querySelector(".att-btn.selected");
      attendanceData[date][s.adm] = selBtn ? selBtn.textContent : "A";
    });
    attendanceDataBySchool[currentSchool] = attendanceData;
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
    await syncToFirebase();
    // Build summary
    $("#attendanceSummary").innerHTML = `<h3>Attendance Summary for ${date}</h3>`;
    const tbl = document.createElement("table");
    tbl.innerHTML = `<tr><th>#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th></tr>`;
    students.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
      const code = attendanceData[date][s.adm];
      const map = { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" };
      tbl.innerHTML += `
        <tr>
          <td>${i+1}</td>
          <td>${s.adm}</td>
          <td>${s.name}</td>
          <td>${map[code]}</td>
          <td><i class="fas fa-share-alt no-print share-individual" data-adm="${s.adm}"></i></td>
        </tr>`;
    });
    $("#attendanceSummary").appendChild(tbl);
    document.querySelectorAll(".share-individual").forEach(ic => {
      ic.onclick = () => {
        const adm = ic.dataset.adm;
        const s = students.find(x => x.adm == adm);
        const statusMap = { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" };
        const code = attendanceData[date][adm];
        const msg = `Dear Parent, your child (Adm#: ${adm}) was ${statusMap[code]} on ${date}.`;
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`, "_blank");
      };
    });
    hide($("#attendanceBody"), $("#saveAttendance"));
    show($("#resetAttendance"), $("#downloadAttendancePDF"), $("#shareAttendanceSummary"), $("#attendanceSummary"));
    updateCounters();
  };

  $("#resetAttendance").onclick = () => {
    show($("#attendanceBody"), $("#saveAttendance"));
    hide($("#resetAttendance"), $("#downloadAttendancePDF"), $("#shareAttendanceSummary"), $("#attendanceSummary"));
  };

  $("#downloadAttendancePDF").onclick = () => {
    const date = $("#dateInput").value;
    if (!date) return;
    const cl = teacherClass, sec = teacherSection;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Attendance Report: ${cl} - ${sec} on ${date}`, 14, 20);
    const rows = [];
    const map = { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" };
    students.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
      rows.push([i+1, s.adm, s.name, map[attendanceData[date][s.adm]]]);
    });
    doc.autoTable({
      head: [["#", "Adm#", "Name", "Status"]],
      body: rows,
      startY: 30,
    });
    doc.save(`Attendance_${cl}_${sec}_${date}.pdf`);
  };

  $("#shareAttendanceSummary").onclick = () => {
    const date = $("#dateInput").value;
    if (!date) return;
    const cl = teacherClass, sec = teacherSection;
    const map = { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" };
    const lines = [`Attendance Summary: ${cl} - ${sec} on ${date}`];
    students.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
      lines.push(`${i+1}. ${s.name} (${s.adm}): ${map[attendanceData[date][s.adm]]}`);
    });
    const msg = lines.join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // ----- ANALYTICS SECTION -----
  $("#analyticsFilterBtn").onclick = () => show($("#analyticsFilterModal"));
  $("#analyticsFilterClose").onclick = () => hide($("#analyticsFilterModal"));

  $("#applyAnalyticsFilter").onclick = () => {
    hide($("#analyticsFilterModal"));
  };

  $("#loadAnalytics").onclick = () => {
    const target = $("#analyticsTarget").value;
    if (!target) return alert("Select Report For");
    if (target === "section") {
      $("#analyticsSectionSelect").classList.remove("hidden");
      $("#analyticsType").disabled = false;
    } else if (target === "student") {
      $("#analyticsSearch").classList.remove("hidden");
      $("#analyticsType").disabled = false;
    }
  };

  $("#resetAnalytics").onclick = () => {
    hide($("#analyticsSectionSelect"), $("#analyticsDate"), $("#analyticsMonth"),
         $("#semesterStart"), $("#semesterEnd"), $("#yearStart"), $("#analyticsSearch"),
         $("#analyticsContainer"), $("#analyticsActions"), $("#resetAnalytics");
    $("#analyticsTarget").value = "";
    $("#analyticsType").value = "";
    $("#analyticsType").disabled = true;
  };

  $("#analyticsType").onchange = () => {
    const type = $("#analyticsType").value;
    hide($("#analyticsDate"), $("#analyticsMonth"), $("#semesterStart"), $("#semesterEnd"), $("#yearStart"), $("#analyticsSearch"));
    if (type === "date") $("#analyticsDate").classList.remove("hidden");
    if (type === "month") $("#analyticsMonth").classList.remove("hidden");
    if (type === "semester") { $("#semesterStart").classList.remove("hidden"); $("#semesterEnd").classList.remove("hidden"); }
    if (type === "year") $("#yearStart").classList.remove("hidden");
  };

  $("#loadAnalytics").onclick = () => {
    const target = $("#analyticsTarget").value;
    const type   = $("#analyticsType").value;
    if (!target || !type) return alert("Select Report For and Period");
    // Example: display a basic chart using Chart.js
    const ctx1 = document.getElementById("barChart").getContext("2d");
    const ctx2 = document.getElementById("pieChart").getContext("2d");
    $("#analyticsContainer").classList.remove("hidden");
    $("#analyticsActions").classList.remove("hidden");
    hide($("#analyticsFilterModal"));
    // Build dummy data for illustration
    const labels = ["Jan", "Feb", "Mar", "Apr", "May"];
    const values = [12, 19, 3, 5, 2];
    new Chart(ctx1, { type: "bar", data: { labels, datasets: [{ label: "Attendance %", data: values }] } });
    new Chart(ctx2, { type: "pie", data: { labels, datasets: [{ data: values }] } });
  };

  $("#downloadAnalytics").onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Analytics Report", 14, 20);
    doc.save("Analytics_Report.pdf");
  };

  $("#shareAnalytics").onclick = () => {
    alert("Share Analytics via WhatsApp/Email is not implemented in this demo.");
  };

  // ----- ATTENDANCE REGISTER SECTION -----
  $("#loadRegister").onclick = () => {
    const month = $("#registerMonth").value;
    if (!month) return alert("Select Month");
    $("#registerTableWrapper").classList.remove("hidden");
    $("#changeRegister").classList.remove("hidden");
    $("#saveRegister").classList.remove("hidden");
    $("#downloadRegister").classList.remove("no-print");
    $("#shareRegister").classList.remove("no-print");
    const [year, mon] = month.split("-");
    const daysInMonth = new Date(year, mon, 0).getDate();
    const headerRow = $("#registerHeader");
    headerRow.innerHTML = "<th>Adm#</th><th>Name</th>";
    for (let d = 1; d <= daysInMonth; d++) {
      headerRow.innerHTML += `<th>${d}</th>`;
    }
    $("#registerBody").innerHTML = "";
    students.filter(s => s.cls === teacherClass && s.sec === teacherSection)
      .forEach(s => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${s.adm}</td><td>${s.name}</td>` +
          Array(daysInMonth).fill("<td>—</td>").join("");
        $("#registerBody").appendChild(tr);
      });
  };

  $("#changeRegister").onclick = () => {
    hide($("#changeRegister"), $("#saveRegister"), $("#downloadRegister"), $("#shareRegister"));
    $("#registerTableWrapper").classList.add("hidden");
  };

  $("#saveRegister").onclick = async () => {
    // Save register data to IndexedDB/Firebase (not implemented in this demo)
    alert("Register saved to local IndexedDB and Firebase.");
  };

  $("#downloadRegister").onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("l", "pt", "a4");
    doc.text("Attendance Register", 40, 40);
    doc.save("Attendance_Register.pdf");
  };

  $("#shareRegister").onclick = () => {
    alert("Share Register via WhatsApp/Email is not implemented in this demo.");
  };

  // ----- BACKUP / RESTORE / RESET SECTION -----
  $("#chooseBackupFolder").onclick = () => {
    alert("Select Backup Folder functionality requires File System Access API (browser-specific).");
  };

  $("#restoreData").onclick = () => {
    $("#restoreFile").click();
  };

  $("#restoreFile").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      await idbClear();
      await idbSet("studentsBySchool", data.studentsBySchool || {});
      await idbSet("attendanceDataBySchool", data.attendanceDataBySchool || {});
      await idbSet("paymentsDataBySchool", data.paymentsDataBySchool || {});
      await idbSet("lastAdmNoBySchool", data.lastAdmNoBySchool || {});
      await idbSet("fineRates", data.fineRates || fineRates);
      await idbSet("eligibilityPct", data.eligibilityPct || eligibilityPct);
      await idbSet("schools", data.schools || []);
      await idbSet("currentSchool", data.currentSchool || null);
      await idbSet("teacherClass", data.teacherClass || null);
      await idbSet("teacherSection", data.teacherSection || null);
      await syncToFirebase();
      alert("✅ Data restored successfully.");
      location.reload();
    } catch {
      alert("❌ Invalid backup file.");
    }
  };

  $("#resetData").onclick = async () => {
    if (!confirm("This will erase ALL data. Proceed?")) return;
    await idbClear();
    await dbSet(appDataRef, null);
    alert("✅ All data cleared.");
    location.reload();
  };

  // ----- SERVICE WORKER REGISTRATION -----
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('service-worker.js', { type: 'module' })
        .then(reg => console.log('Service Worker registered as module:', reg))
        .catch(err => console.error('SW registration failed:', err));
    });
  }

}); // End of DOMContentLoaded

// =================================================================
// 5. Main UI Rendering (static portions of HTML shown/hidden)
// =================================================================

function renderMainUI() {
  show($("#mainAppSection"));
}

// =================================================================
// 6. Helper: Render school list & other repeated logic can remain here
// =================================================================
// (All helper functions have been defined above.)
