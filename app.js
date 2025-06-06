// app.js

// =======================
// 1) IMPORTS & INITIAL SETUP
// =======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  set as dbSet,
  onValue,
  get as dbGet,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const firebaseConfig = {
  // … your existing Firebase config …
};
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// IndexedDB helper via idb-keyval
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// =======================
// 2) GLOBAL STATE FOR AUTH
// =======================
let currentUser = null;    // Firebase user
let userProfile = null;    // /users/{uid} data

// =======================
// 3) APPLICATION DATA STRUCTURES
// =======================

// Per-school state mappings
let studentsBySchool = {};
let attendanceDataBySchool = {};
let paymentsDataBySchool = {};
let lastAdmNoBySchool = {};

// Default fine rates and eligibility %
let fineRates = { A: 50, Lt: 20, L: 10, HD: 30 };
let eligibilityPct = 75;

// List of all school names
let schools = [];

// Currently selected school/class/section
let currentSchool = null;
let teacherClass = null;
let teacherSection = null;

// Active pointers for the selected school
let students = [];
let attendanceData = {};
let paymentsData = {};
let lastAdmNo = 0;

// =======================
// 4) AUTH UI & LOGIC
// =======================
window.addEventListener("DOMContentLoaded", () => {
  const authScreen = document.getElementById("authScreen");
  const mainApp = document.getElementById("mainApp");

  const showLoginBtn = document.getElementById("showLogin");
  const showRegisterBtn = document.getElementById("showRegister");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");

  const regEmail = document.getElementById("regEmail");
  const regPassword = document.getElementById("regPassword");
  const regRole = document.getElementById("regRole");
  const regSchool = document.getElementById("regSchool");
  const regClass = document.getElementById("regClass");
  const regSection = document.getElementById("regSection");

  // Show login by default
  showLoginForm();
  function showLoginForm() {
    loginForm.style.display = "flex";
    registerForm.style.display = "none";
  }
  function showRegisterForm() {
    loginForm.style.display = "none";
    registerForm.style.display = "flex";
  }

  showLoginBtn.onclick = showLoginForm;
  showRegisterBtn.onclick = showRegisterForm;

  // When “Role” changes in Register, show/hide related fields
  regRole.addEventListener("change", () => {
    const role = regRole.value;
    if (role === "admin") {
      regSchool.style.display = "none";
      regClass.style.display = "none";
      regSection.style.display = "none";
    } else if (role === "principal") {
      regSchool.style.display = "block";
      regClass.style.display = "none";
      regSection.style.display = "none";
      loadAllSchoolsInto(regSchool);
    } else if (role === "teacher") {
      regSchool.style.display = "block";
      regClass.style.display = "block";
      regSection.style.display = "block";
      loadAllSchoolsInto(regSchool);
      populateClassDropdown(regClass);
    }
  });

  // LOGIN SUBMIT
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will proceed
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  });

  // REGISTER SUBMIT
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = regEmail.value.trim();
    const password = regPassword.value;
    const role = regRole.value;
    if (!role) {
      alert("Please pick a role.");
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      let profile = { email, role };
      if (role === "principal") {
        const schoolName = regSchool.value;
        profile.assignedSchools = {};
        profile.assignedSchools[schoolName] = true;
      } else if (role === "teacher") {
        profile.assignedSchool = regSchool.value;
        profile.assignedClass = regClass.value;
        profile.assignedSection = regSection.value;
      }
      await dbSet(dbRef(database, `users/${uid}`), profile);
      alert("Registration successful! Please login.");
      showLoginForm();
    } catch (err) {
      alert("Registration failed: " + err.message);
    }
  });

  // OBSERVE AUTH STATE
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      const snap = await dbGet(dbRef(database, `users/${user.uid}`));
      if (!snap.exists()) {
        alert("No user profile found. Contact admin.");
        return;
      }
      userProfile = snap.val();
      authScreen.style.display = "none";
      mainApp.style.display = "block";
      initializeAfterAuth();
    } else {
      currentUser = null;
      userProfile = null;
      authScreen.style.display = "flex";
      mainApp.style.display = "none";
    }
  });

  // LOGOUT BUTTON
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = () => signOut(auth);
  }
});

// =======================
// 5) HELPER FUNCTIONS FOR DROPDOWNS
// =======================
async function loadAllSchoolsInto(selectElement) {
  const appDataSnap = await dbGet(dbRef(database, "appData/schools"));
  selectElement.innerHTML = `<option disabled selected>-- Select School --</option>`;
  if (appDataSnap.exists()) {
    const schoolList = appDataSnap.val();
    schoolList.forEach((sch) => {
      const opt = document.createElement("option");
      opt.value = sch;
      opt.textContent = sch;
      selectElement.appendChild(opt);
    });
  }
}

function populateClassDropdown(classSelect) {
  const classOptions = [
    "Play Group", "Nursery", "KG",
    "Class One","Class Two","Class Three",
    "Class Four","Class Five","Class Six",
    "Class Seven","Class Eight","Class Nine",
    "Class Ten"
  ];
  classSelect.innerHTML = `<option disabled selected>-- Select Class --</option>`;
  classOptions.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    classSelect.appendChild(opt);
  });
}

// =======================
// 6) INITIALIZATION AFTER AUTH
// =======================
async function initializeAfterAuth() {
  // Role-based UI adjustments
  const setupSection = document.getElementById("teacher-setup");
  const schoolInput = document.getElementById("schoolInput");
  const schoolSelect = document.getElementById("schoolSelect");

  if (userProfile.role === "admin") {
    setupSection.style.display = "block";
    schoolInput.style.display = "inline-block";
  }
  else if (userProfile.role === "principal") {
    setupSection.style.display = "block";
    schoolInput.style.display = "none";
    schoolSelect.innerHTML = `<option disabled selected>-- Select School --</option>`;
    Object.keys(userProfile.assignedSchools || {}).forEach(sch => {
      const opt = document.createElement("option");
      opt.value = sch;
      opt.textContent = sch;
      schoolSelect.appendChild(opt);
    });
  }
  else if (userProfile.role === "teacher") {
    setupSection.style.display = "none";
    const assignedSchool = userProfile.assignedSchool;
    const assignedClass = userProfile.assignedClass;
    const assignedSection = userProfile.assignedSection;

    await idbSet("currentSchool", assignedSchool);
    await idbSet("teacherClass", assignedClass);
    await idbSet("teacherSection", assignedSection);

    await initLocalState();
    await loadSetup();
  }

  // Continue with normal app initialization
  if (userProfile.role !== "teacher") {
    await initLocalState();
    resetViews();
    await loadSetup();
  }
}

// =======================
// 7) LOCAL STATE & FIREBASE SYNC
// =======================
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
}

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
    await dbSet(dbRef(database, "appData"), payload);
    console.log("✅ Synced data to Firebase");
  } catch (err) {
    console.error("Firebase sync failed:", err);
  }
}

// =======================
// 8) SETUP SECTION LOGIC
// =======================
function resetViews() {
  const sections = [
    "financial-settings",
    "animatedCounters",
    "student-registration",
    "attendance-section",
    "analytics-section",
    "register-section"
  ];
  sections.forEach(id => document.getElementById(id).classList.add("hidden"));
}

async function loadSetup() {
  const savedSchools       = (await idbGet("schools"))       || [];
  const savedCurrentSchool = (await idbGet("currentSchool")) || null;
  const savedClass         = (await idbGet("teacherClass"))  || null;
  const savedSection       = (await idbGet("teacherSection"))|| null;

  schools = savedSchools;
  currentSchool = savedCurrentSchool;
  teacherClass = savedClass;
  teacherSection = savedSection;

  const schoolSelect = document.getElementById("schoolSelect");
  const schoolInput = document.getElementById("schoolInput");

  // Role-based: Admin sees input; Principal sees dropdown of assigned; Teacher already set
  if (userProfile.role === "admin") {
    schoolInput.style.display = "inline-block";
    schoolSelect.innerHTML = `<option disabled selected>-- Select School --</option>`;
    schools.forEach(sch => {
      const opt = document.createElement("option");
      opt.value = sch;
      opt.textContent = sch;
      schoolSelect.appendChild(opt);
    });
  } else if (userProfile.role === "principal") {
    schoolInput.style.display = "none";
    // Dropdown already populated in initializeAfterAuth
  }

  renderSchoolList();

  if (currentSchool && teacherClass && teacherSection) {
    await ensureSchoolData(currentSchool);
    students       = studentsBySchool[currentSchool];
    attendanceData = attendanceDataBySchool[currentSchool];
    paymentsData   = paymentsDataBySchool[currentSchool];
    lastAdmNo      = lastAdmNoBySchool[currentSchool];

    document.getElementById("setupText").textContent =
      `${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`;
    document.getElementById("setupForm").classList.add("hidden");
    document.getElementById("setupDisplay").classList.remove("hidden");

    resetViews();
    // show other sections
    document.getElementById("financial-settings").classList.remove("hidden");
    document.getElementById("animatedCounters").classList.remove("hidden");
    document.getElementById("student-registration").classList.remove("hidden");
    document.getElementById("attendance-section").classList.remove("hidden");
    document.getElementById("analytics-section").classList.remove("hidden");
    document.getElementById("register-section").classList.remove("hidden");

    renderStudents();
    updateCounters();
  } else {
    document.getElementById("setupForm").classList.remove("hidden");
    document.getElementById("setupDisplay").classList.add("hidden");
    resetViews();
  }
}

function renderSchoolList() {
  const listDiv = document.getElementById("schoolList");
  listDiv.innerHTML = "";
  schools.forEach((sch, idx) => {
    const wrapper = document.createElement("div");
    wrapper.textContent = sch;
    if (userProfile.role === "admin") {
      const editBtn = document.createElement("button");
      editBtn.textContent = "✎";
      editBtn.style.marginLeft = "0.5em";
      editBtn.onclick = () => {
        const newName = prompt("Rename school:", sch);
        if (!newName) return;
        if (schools.includes(newName)) {
          alert("School name already exists.");
          return;
        }
        // Rename in arrays and mappings
        schools[idx] = newName;
        studentsBySchool[newName] = studentsBySchool[sch] || [];
        attendanceDataBySchool[newName] = attendanceDataBySchool[sch] || {};
        paymentsDataBySchool[newName] = paymentsDataBySchool[sch] || {};
        lastAdmNoBySchool[newName] = lastAdmNoBySchool[sch] || 0;
        delete studentsBySchool[sch];
        delete attendanceDataBySchool[sch];
        delete paymentsDataBySchool[sch];
        delete lastAdmNoBySchool[sch];
        idbSet("schools", schools);
        idbSet("studentsBySchool", studentsBySchool);
        idbSet("attendanceDataBySchool", attendanceDataBySchool);
        idbSet("paymentsDataBySchool", paymentsDataBySchool);
        idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
        syncToFirebase();
        loadSetup();
      };
      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑";
      delBtn.style.marginLeft = "0.5em";
      delBtn.onclick = async () => {
        if (!confirm(`Delete "${sch}" and all its data?`)) return;
        schools.splice(idx, 1);
        delete studentsBySchool[sch];
        delete attendanceDataBySchool[sch];
        delete paymentsDataBySchool[sch];
        delete lastAdmNoBySchool[sch];
        if (currentSchool === sch) {
          currentSchool = null;
          teacherClass = null;
          teacherSection = null;
          await idbSet("currentSchool", null);
          await idbSet("teacherClass", null);
          await idbSet("teacherSection", null);
        }
        await idbSet("schools", schools);
        await idbSet("studentsBySchool", studentsBySchool);
        await idbSet("attendanceDataBySchool", attendanceDataBySchool);
        await idbSet("paymentsDataBySchool", paymentsDataBySchool);
        await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
        await syncToFirebase();
        loadSetup();
      };
      wrapper.append(editBtn, delBtn);
    }
    listDiv.appendChild(wrapper);
  });
}

const saveSetupBtn = document.getElementById("saveSetup");
saveSetupBtn.onclick = async (e) => {
  e.preventDefault();
  const newSchool = document.getElementById("schoolInput").value.trim();
  const schoolSelect = document.getElementById("schoolSelect");
  const classSelect = document.getElementById("teacherClassSelect");
  const sectionSelect = document.getElementById("teacherSectionSelect");

  if (newSchool) {
    if (userProfile.role !== "admin") {
      alert("Only Admins can create a new school.");
      return;
    }
    if (!schools.includes(newSchool)) {
      schools.push(newSchool);
      await idbSet("schools", schools);
      await syncToFirebase();
    }
    document.getElementById("schoolInput").value = "";
    loadSetup();
    return;
  }
  const selSchool  = schoolSelect.value;
  const selClass   = classSelect.value;
  const selSection = sectionSelect.value;
  if (!selSchool || !selClass || !selSection) {
    alert("Please select a school, class, and section.");
    return;
  }
  currentSchool  = selSchool;
  teacherClass   = selClass;
  teacherSection = selSection;
  await idbSet("currentSchool", currentSchool);
  await idbSet("teacherClass", teacherClass);
  await idbSet("teacherSection", teacherSection);
  await syncToFirebase();
  await loadSetup();
};

const editSetupBtn = document.getElementById("editSetup");
editSetupBtn.onclick = (e) => {
  e.preventDefault();
  document.getElementById("setupForm").classList.remove("hidden");
  document.getElementById("setupDisplay").classList.add("hidden");
  resetViews();
};

// =======================
// 9) FINANCIAL SETTINGS LOGIC
// =======================
const fineAbsentInput     = document.getElementById("fineAbsent");
const fineLateInput       = document.getElementById("fineLate");
const fineLeaveInput      = document.getElementById("fineLeave");
const fineHalfDayInput    = document.getElementById("fineHalfDay");
const eligibilityPctInput = document.getElementById("eligibilityPct");
const saveSettingsBtn     = document.getElementById("saveSettings");
const settingsCard        = document.createElement("div");
const editSettingsBtn     = document.createElement("button");

function loadFinancialSettings() {
  fineAbsentInput.value     = fineRates.A;
  fineLateInput.value       = fineRates.Lt;
  fineLeaveInput.value      = fineRates.L;
  fineHalfDayInput.value    = fineRates.HD;
  eligibilityPctInput.value = eligibilityPct;
  settingsCard.id = "settingsCard";
  editSettingsBtn.id = "editSettings";
  editSettingsBtn.classList.add("no-print");
  editSettingsBtn.innerHTML = `<i class="fas fa-edit"></i> Edit`;
  editSettingsBtn.onclick = () => {
    settingsCard.classList.add("hidden");
    editSettingsBtn.classList.add("hidden");
    document.getElementById("financialForm").classList.remove("hidden");
    saveSettingsBtn.classList.remove("hidden");
  };
  document.getElementById("financial-settings").append(settingsCard, editSettingsBtn);
}

saveSettingsBtn.onclick = async () => {
  fineRates = {
    A: Number(fineAbsentInput.value) || 0,
    Lt: Number(fineLateInput.value) || 0,
    L:  Number(fineLeaveInput.value) || 0,
    HD: Number(fineHalfDayInput.value) || 0,
  };
  eligibilityPct = Number(eligibilityPctInput.value) || 0;
  await idbSet("fineRates", fineRates);
  await idbSet("eligibilityPct", eligibilityPct);
  await syncToFirebase();

  settingsCard.innerHTML = `
    <div class="card">
      <p><strong>Fine/Absent:</strong> PKR ${fineRates.A}</p>
      <p><strong>Fine/Late:</strong> PKR ${fineRates.Lt}</p>
      <p><strong>Fine/Leave:</strong> PKR ${fineRates.L}</p>
      <p><strong>Fine/Half-Day:</strong> PKR ${fineRates.HD}</p>
      <p><strong>Eligibility %:</strong> ${eligibilityPct}%</p>
    </div>`;
  document.getElementById("financialForm").classList.add("hidden");
  saveSettingsBtn.classList.add("hidden");
  settingsCard.classList.remove("hidden");
  editSettingsBtn.classList.remove("hidden");
};

// =======================
// 10) COUNTERS (DASHBOARD)
// =======================
const countersContainer = document.getElementById("countersContainer");

function createCounterCard(id, title, spanId) {
  const card = document.createElement("div");
  card.className = "counter-card";
  card.id = id;
  card.innerHTML = `
    <div class="card-content">
      <p class="card-title">${title}</p>
      <p class="card-number"><span id="${spanId}" data-target="0">0</span></p>
    </div>`;
  countersContainer.appendChild(card);
}

function setupCounters() {
  countersContainer.innerHTML = "";
  createCounterCard("card-section", "Section", "sectionCount");
  createCounterCard("card-class", "Class", "classCount");
  createCounterCard("card-school", "School", "schoolCount");
  createCounterCard("card-attendance", "Attendance", "attendanceCount");
  createCounterCard("card-eligible", "Eligible", "eligibleCount");
  createCounterCard("card-debarred", "Debarred", "debarredCount");
  createCounterCard("card-outstanding", "Outstanding/Fine", "outstandingCount");
}

function animateCounters() {
  document.querySelectorAll(".card-number span").forEach(span => {
    const target = +span.dataset.target;
    let count = 0;
    const step = Math.max(1, target / 100);
    (function upd() {
      count += step;
      span.textContent = count < target ? Math.ceil(count) : target;
      if (count < target) requestAnimationFrame(upd);
    })();
  });
}

function updateCounters() {
  const cl  = teacherClass;
  const sec = teacherSection;

  const sectionCountSpan = document.getElementById("sectionCount");
  const classCountSpan   = document.getElementById("classCount");
  const schoolCountSpan  = document.getElementById("schoolCount");
  const attendanceCountSpan = document.getElementById("attendanceCount");
  const eligibleCountSpan   = document.getElementById("eligibleCount");
  const debarredCountSpan   = document.getElementById("debarredCount");
  const outstandingCountSpan= document.getElementById("outstandingCount");

  const sectionStudents = students.filter(s => s.cls === cl && s.sec === sec);
  sectionCountSpan.dataset.target = sectionStudents.length;

  const classStudents = students.filter(s => s.cls === cl);
  classCountSpan.dataset.target = classStudents.length;

  schoolCountSpan.dataset.target = students.length;

  let totalP = 0, totalA = 0, totalLt = 0, totalHD = 0, totalL = 0;
  Object.entries(attendanceData).forEach(([date, rec]) => {
    sectionStudents.forEach(s => {
      const code = rec[s.adm];
      if (!code) {
        totalA++;
      } else {
        switch (code) {
          case "P": totalP++; break;
          case "A": totalA++; break;
          case "Lt": totalLt++; break;
          case "HD": totalHD++; break;
          case "L": totalL++; break;
        }
      }
    });
  });
  const attendanceTotal = totalP + totalA + totalLt + totalHD + totalL;
  attendanceCountSpan.dataset.target = attendanceTotal;

  let eligibleCount = 0, debarredCount = 0, outstandingCount = 0;
  students.forEach(s => {
    if (s.cls !== cl || s.sec !== sec) return;
    let p=0, a=0, lt=0, hd=0, l=0, totalDays=0;
    Object.values(attendanceData).forEach(rec => {
      if (rec[s.adm]) {
        totalDays++;
        switch (rec[s.adm]) {
          case "P": p++; break;
          case "A": a++; break;
          case "Lt": lt++; break;
          case "HD": hd++; break;
          case "L": l++; break;
        }
      }
    });
    const fineTotal = a * fineRates.A + lt * fineRates.Lt + l * fineRates.L + hd * fineRates.HD;
    const paid = (paymentsData[s.adm] || []).reduce((acc, pmt) => acc + pmt.amount, 0);
    const outstanding = fineTotal - paid;
    const pct = totalDays ? (p / totalDays) * 100 : 0;
    const status = (outstanding > 0 || pct < eligibilityPct) ? "Debarred" : "Eligible";

    if (status === "Eligible") eligibleCount++;
    else debarredCount++;
    if (outstanding > 0) outstandingCount++;
  });
  eligibleCountSpan.dataset.target    = eligibleCount;
  debarredCountSpan.dataset.target    = debarredCount;
  outstandingCountSpan.dataset.target = outstandingCount;

  animateCounters();
}

// =======================
// 11) STUDENT REGISTRATION LOGIC
// =======================
const studentsBody = document.getElementById("studentsBody");
const selectAllStudents = document.getElementById("selectAllStudents");
const editSelectedBtn = document.getElementById("editSelected");
const doneEditingBtn = document.getElementById("doneEditing");
const deleteSelectedBtn = document.getElementById("deleteSelected");
const addStudentBtn = document.getElementById("addStudent");
const saveRegistrationBtn = document.getElementById("saveRegistration");
const editRegistrationBtn = document.getElementById("editRegistration");
const shareRegistrationBtn = document.getElementById("shareRegistration");
const downloadRegistrationPDFBtn = document.getElementById("downloadRegistrationPDF");

addStudentBtn.onclick = async (e) => {
  e.preventDefault();
  const n   = document.getElementById("studentName").value.trim();
  const p   = document.getElementById("parentName").value.trim();
  const c   = document.getElementById("parentContact").value.trim();
  const o   = document.getElementById("parentOccupation").value.trim();
  const a   = document.getElementById("parentAddress").value.trim();
  const cl  = teacherClass;
  const sec = teacherSection;
  if (!n || !p || !c || !o || !a) { alert("All fields required"); return; }
  if (!/^\d{7,15}$/.test(c)) { alert("Contact must be 7–15 digits"); return; }
  const adm = await genAdmNo();
  students.push({ name: n, adm, parent: p, contact: c, occupation: o, address: a, cls: cl, sec });
  studentsBySchool[currentSchool] = students;
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();
  renderStudents();
  updateCounters();

  document.getElementById("studentName").value      = "";
  document.getElementById("parentName").value       = "";
  document.getElementById("parentContact").value    = "";
  document.getElementById("parentOccupation").value = "";
  document.getElementById("parentAddress").value    = "";
};

function renderStudents() {
  studentsBody.innerHTML = "";
  let idx = 0;
  students.forEach((s, i) => {
    if (s.cls !== teacherClass || s.sec !== teacherSection) return;
    idx++;
    const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
    Object.values(attendanceData).forEach(rec => { if (rec[s.adm]) stats[rec[s.adm]]++; });
    const total = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
    const fine  = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
    const paid  = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount, 0);
    const out   = fine - paid;
    const pct   = total ? (stats.P/total)*100 : 0;
    const status = (out > 0 || pct < eligibilityPct) ? "Debarred" : "Eligible";

    const tr = document.createElement("tr");
    tr.dataset.index = i;
    tr.innerHTML = `
      <td><input type="checkbox" class="sel"></td>
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
  selectAllStudents.checked = false;
  toggleButtons();
  document.querySelectorAll(".add-payment-btn").forEach(b => {
    b.onclick = () => openPaymentModal(b.dataset.adm);
  });
}

function toggleButtons() {
  const anyChecked = document.querySelectorAll(".sel:checked").length > 0;
  editSelectedBtn.disabled = !anyChecked;
  deleteSelectedBtn.disabled = !anyChecked;
}

studentsBody.addEventListener("change", e => {
  if (e.target.classList.contains("sel")) toggleButtons();
});

selectAllStudents.onclick = () => {
  document.querySelectorAll(".sel").forEach(c => c.checked = selectAllStudents.checked);
  toggleButtons();
};

editSelectedBtn.onclick = () => {
  document.querySelectorAll(".sel:checked").forEach(cb => {
    const tr = cb.closest("tr");
    const i = Number(tr.dataset.index);
    const s = students[i];
    tr.cells[2].innerHTML = `<input value="${s.name}">`;
    tr.cells[4].innerHTML = `<input value="${s.parent}">`;
    tr.cells[5].innerHTML = `<input value="${s.contact}">`;
    tr.cells[6].innerHTML = `<input value="${s.occupation}">`;
    tr.cells[7].innerHTML = `<input value="${s.address}">`;
  });
  editSelectedBtn.classList.add("hidden");
  deleteSelectedBtn.classList.add("hidden");
  doneEditingBtn.classList.remove("hidden");
};

doneEditingBtn.onclick = async () => {
  document.querySelectorAll(".sel:checked").forEach(cb => {
    const tr = cb.closest("tr");
    const i = Number(tr.dataset.index);
    const inputs = tr.querySelectorAll("input");
    students[i].name       = inputs[0].value.trim();
    students[i].parent     = inputs[1].value.trim();
    students[i].contact    = inputs[2].value.trim();
    students[i].occupation = inputs[3].value.trim();
    students[i].address    = inputs[4].value.trim();
  });
  studentsBySchool[currentSchool] = students;
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();
  renderStudents();
  updateCounters();
  doneEditingBtn.classList.add("hidden");
  editSelectedBtn.classList.remove("hidden");
  deleteSelectedBtn.classList.remove("hidden");
};

deleteSelectedBtn.onclick = async () => {
  if (!confirm("Delete selected students?")) return;
  const toDelete = Array.from(document.querySelectorAll(".sel:checked")).map(cb => Number(cb.closest("tr").dataset.index));
  // Remove by filtering
  students = students.filter((_, idx) => !toDelete.includes(idx));
  studentsBySchool[currentSchool] = students;
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();
  renderStudents();
  updateCounters();
};

saveRegistrationBtn.onclick = () => {
  if (!doneEditingBtn.classList.contains("hidden")) {
    alert("Finish editing before saving.");
    return;
  }
  saveRegistrationBtn.classList.add("hidden");
  editRegistrationBtn.classList.remove("hidden");
  shareRegistrationBtn.classList.remove("hidden");
  downloadRegistrationPDFBtn.classList.remove("hidden");
};

editRegistrationBtn.onclick = () => {
  editRegistrationBtn.classList.add("hidden");
  shareRegistrationBtn.classList.add("hidden");
  downloadRegistrationPDFBtn.classList.add("hidden");
  saveRegistrationBtn.classList.remove("hidden");
};

shareRegistrationBtn.onclick = () => {
  const header = `Student Registration List\n${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`;
  const lines = students
    .filter(s => s.cls === teacherClass && s.sec === teacherSection)
    .map((s, i) => `${i+1}. Adm#: ${s.adm} Name: ${s.name} Parent: ${s.parent}`);
  window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n\n" + lines.join("\n"))}`, "_blank");
};

downloadRegistrationPDFBtn.onclick = () => {
  const doc = new jspdf.jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const today = new Date().toISOString().split("T")[0];
  doc.setFontSize(18); doc.text("Student Registration List", 14, 16);
  doc.setFontSize(10); doc.text(`Date: ${today}`, w - 14, 16, { align: "right" });
  doc.setFontSize(12); doc.text(`${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`, 14, 24);

  // Build temp table
  const tempTable = document.createElement("table");
  tempTable.innerHTML = `
    <thead>
      <tr><th>#</th><th>Adm#</th><th>Name</th><th>Parent</th><th>Contact</th><th>Occupation</th><th>Address</th></tr>
    </thead>
    <tbody>
      ${students
        .filter(s => s.cls === teacherClass && s.sec === teacherSection)
        .map((s, i) => `
          <tr>
            <td>${i+1}</td>
            <td>${s.adm}</td>
            <td>${s.name}</td>
            <td>${s.parent}</td>
            <td>${s.contact}</td>
            <td>${s.occupation}</td>
            <td>${s.address}</td>
          </tr>
        `).join("")}
    </tbody>`;
  tempTable.id = "tempStudentsTable";
  document.body.appendChild(tempTable);
  doc.autoTable({ html: "#tempStudentsTable" });
  document.body.removeChild(tempTable);

  const fileName = `students_${teacherClass}_${teacherSection}_${today}.pdf`;
  const blob = doc.output("blob");
  doc.save(fileName);
  sharePdf(blob, fileName, "Student Registration List");
};

// =======================
// 12) PAYMENT MODAL LOGIC
// =======================
const paymentModal = document.getElementById("paymentModal");
const paymentModalCloseBtn = document.getElementById("paymentModalClose");
const payAdmSpan = document.getElementById("payAdm");
const paymentAmountInput = document.getElementById("paymentAmount");
const savePaymentBtn = document.getElementById("savePayment");
const cancelPaymentBtn = document.getElementById("cancelPayment");

function openPaymentModal(adm) {
  payAdmSpan.textContent = adm;
  paymentAmountInput.value = "";
  paymentModal.classList.remove("hidden");
}

paymentModalCloseBtn.onclick = () => paymentModal.classList.add("hidden");
cancelPaymentBtn.onclick = () => paymentModal.classList.add("hidden");

savePaymentBtn.onclick = async () => {
  const adm = payAdmSpan.textContent;
  const amt = Number(paymentAmountInput.value) || 0;
  paymentsData[adm] = paymentsData[adm] || [];
  paymentsData[adm].push({ date: new Date().toISOString().split("T")[0], amount: amt });
  paymentsDataBySchool[currentSchool] = paymentsData;
  await idbSet("paymentsDataBySchool", paymentsDataBySchool);
  await syncToFirebase();
  paymentModal.classList.add("hidden");
  renderStudents();
  updateCounters();
};

// =======================
// 13) MARK ATTENDANCE LOGIC
// =======================
const attendanceBodyDiv = document.getElementById("attendanceBody");
const attendanceSummaryDiv = document.getElementById("attendanceSummary");
const loadAttendanceBtn = document.getElementById("loadAttendance");
const saveAttendanceBtn = document.getElementById("saveAttendance");
const resetAttendanceBtn = document.getElementById("resetAttendance");
const downloadAttendancePDFBtn = document.getElementById("downloadAttendancePDF");
const shareAttendanceBtn = document.getElementById("shareAttendanceSummary");
const dateInput = document.getElementById("dateInput");

const statusNames  = { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" };
const statusColors = { P:"var(--success)", A:"var(--danger)", Lt:"var(--warning)", HD:"#FF9800", L:"var(--info)" };

loadAttendanceBtn.onclick = () => {
  attendanceBodyDiv.innerHTML = "";
  attendanceSummaryDiv.innerHTML = "";
  const cl  = teacherClass;
  const sec = teacherSection;

  students.filter(stu => stu.cls === cl && stu.sec === sec).forEach((stu, i) => {
    const row = document.createElement("div");
    const headerDiv = document.createElement("div");
    const btnsDiv   = document.createElement("div");
    row.className       = "attendance-row";
    headerDiv.className = "attendance-header";
    btnsDiv.className   = "attendance-buttons";
    headerDiv.textContent = `${i + 1}. ${stu.name} (${stu.adm})`;
    Object.keys(statusNames).forEach(code => {
      const btn = document.createElement("button");
      btn.className = "att-btn";
      btn.textContent = code;
      btn.onclick = () => {
        btnsDiv.querySelectorAll(".att-btn").forEach(b => { b.classList.remove("selected"); b.style = ""; });
        btn.classList.add("selected");
        btn.style.background = statusColors[code];
        btn.style.color = "#fff";
      };
      btnsDiv.appendChild(btn);
    });
    row.append(headerDiv, btnsDiv);
    attendanceBodyDiv.appendChild(row);
  });
  attendanceBodyDiv.style.overflowX = "auto";
  saveAttendanceBtn.classList.remove("hidden");
  resetAttendanceBtn.classList.add("hidden");
  downloadAttendancePDFBtn.classList.add("hidden");
  shareAttendanceBtn.classList.add("hidden");
  attendanceSummaryDiv.classList.add("hidden");
};

saveAttendanceBtn.onclick = async () => {
  const date = dateInput.value;
  if (!date) { alert("Pick date"); return; }
  attendanceData[date] = {};
  const cl  = teacherClass;
  const sec = teacherSection;
  students.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
    const selBtn = attendanceBodyDiv.children[i].querySelector(".att-btn.selected");
    attendanceData[date][s.adm] = selBtn ? selBtn.textContent : "A";
  });
  attendanceDataBySchool[currentSchool] = attendanceData;
  await idbSet("attendanceDataBySchool", attendanceDataBySchool);
  await syncToFirebase();

  attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
  const tbl = document.createElement("table");
  tbl.id = "attendanceSummaryTable";
  tbl.innerHTML = `
    <tr>
      <th>Sr#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th>
    </tr>`;
  students.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
    const code = attendanceData[date][s.adm];
    tbl.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${s.adm}</td>
        <td>${s.name}</td>
        <td>${statusNames[code]}</td>
        <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
      </tr>`;
  });
  attendanceSummaryDiv.appendChild(tbl);
  attendanceSummaryDiv.querySelectorAll(".share-individual").forEach(ic => {
    ic.onclick = () => {
      const adm = ic.dataset.adm;
      const st = students.find(x => x.adm === adm);
      const msg = `Dear Parent, your child (Adm#: ${adm}) was ${statusNames[attendanceData[date][adm]]} on ${date}.`;
      window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`, "_blank");
    };
  });

  attendanceBodyDiv.classList.add("hidden");
  saveAttendanceBtn.classList.add("hidden");
  resetAttendanceBtn.classList.remove("hidden");
  downloadAttendancePDFBtn.classList.remove("hidden");
  shareAttendanceBtn.classList.remove("hidden");
  attendanceSummaryDiv.classList.remove("hidden");
  updateCounters();
};

resetAttendanceBtn.onclick = () => {
  attendanceBodyDiv.classList.remove("hidden");
  saveAttendanceBtn.classList.remove("hidden");
  resetAttendanceBtn.classList.add("hidden");
  downloadAttendancePDFBtn.classList.add("hidden");
  shareAttendanceBtn.classList.add("hidden");
  attendanceSummaryDiv.classList.add("hidden");
};

downloadAttendancePDFBtn.onclick = async () => {
  const doc = new jspdf.jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const today = new Date().toISOString().split("T")[0];
  doc.setFontSize(18); doc.text("Attendance Report", 14, 16);
  doc.setFontSize(10); doc.text(`Date: ${today}`, w - 14, 16, { align: "right" });
  doc.setFontSize(12); doc.text(`${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`, 14, 24);
  doc.autoTable({ startY: 30, html: "#attendanceSummaryTable" });
  const fileName = `attendance_${dateInput.value}.pdf`;
  const blob = doc.output("blob");
  doc.save(fileName);
  await sharePdf(blob, fileName, "Attendance Report");
};

shareAttendanceBtn.onclick = () => {
  const cl   = teacherClass;
  const sec  = teacherSection;
  const date = dateInput.value;
  const header = `*Attendance Report*\nClass ${cl} Sec ${sec} - ${date}`;
  const lines = students.filter(s => s.cls === cl && s.sec === sec)
    .map((s, i) => `${i + 1}. ${s.name} (Adm#: ${s.adm}): ${statusNames[attendanceData[date][s.adm]]}`);
  window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n\n" + lines.join("\n"))}`, "_blank");
};

// =======================
// 14) ANALYTICS LOGIC
// =======================
const analyticsTarget       = document.getElementById("analyticsTarget");
const analyticsSectionSelect= document.getElementById("analyticsSectionSelect");
const analyticsType         = document.getElementById("analyticsType");
const analyticsDate         = document.getElementById("analyticsDate");
const analyticsMonth        = document.getElementById("analyticsMonth");
const semesterStartInput    = document.getElementById("semesterStart");
const semesterEndInput      = document.getElementById("semesterEnd");
const yearStartInput        = document.getElementById("yearStart");
const analyticsSearch       = document.getElementById("analyticsSearch");
const loadAnalyticsBtn      = document.getElementById("loadAnalytics");
const resetAnalyticsBtn     = document.getElementById("resetAnalytics");
const instructionsDiv       = document.getElementById("instructions");
const analyticsContainer    = document.getElementById("analyticsContainer");
const analyticsBody         = document.getElementById("analyticsBody");
const graphsDiv             = document.getElementById("graphs");
const barChartCanvas        = document.getElementById("barChart");
const pieChartCanvas        = document.getElementById("pieChart");
const downloadAnalyticsBtn  = document.getElementById("downloadAnalytics");
const shareAnalyticsBtn     = document.getElementById("shareAnalytics");

let lastAnalyticsStats = [];
let lastAnalyticsRange = {};
let lastAnalyticsShare = "";
let analyticsFilterOptions = ["all"];
let analyticsDownloadMode = "combined";

analyticsTarget.onchange = () => {
  analyticsType.disabled = false;
  analyticsSectionSelect.classList.add("hidden");
  analyticsSearch.classList.add("hidden");
  if (analyticsTarget.value === "section") {
    analyticsSectionSelect.classList.remove("hidden");
  }
  if (analyticsTarget.value === "student") {
    analyticsSearch.classList.remove("hidden");
  }
};

analyticsType.onchange = () => {
  analyticsDate.classList.add("hidden");
  analyticsMonth.classList.add("hidden");
  semesterStartInput.classList.add("hidden");
  semesterEndInput.classList.add("hidden");
  yearStartInput.classList.add("hidden");
  instructionsDiv.classList.add("hidden");
  analyticsContainer.classList.add("hidden");
  graphsDiv.classList.add("hidden");
  document.getElementById("analyticsActions").classList.add("hidden");
  resetAnalyticsBtn.classList.remove("hidden");

  switch (analyticsType.value) {
    case "date":
      analyticsDate.classList.remove("hidden");
      break;
    case "month":
      analyticsMonth.classList.remove("hidden");
      break;
    case "semester":
      semesterStartInput.classList.remove("hidden");
      semesterEndInput.classList.remove("hidden");
      break;
    case "year":
      yearStartInput.classList.remove("hidden");
      break;
  }
};

loadAnalyticsBtn.onclick = () => {
  if (analyticsTarget.value === "student" && !analyticsSearch.value.trim()) {
    alert("Enter admission number or name");
    return;
  }
  let from, to;
  if (analyticsType.value === "date") {
    from = to = analyticsDate.value;
  } else if (analyticsType.value === "month") {
    const [y, m] = analyticsMonth.value.split("-").map(Number);
    from = `${analyticsMonth.value}-01`;
    to   = `${analyticsMonth.value}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  } else if (analyticsType.value === "semester") {
    const [sy, sm] = semesterStartInput.value.split("-").map(Number);
    const [ey, em] = semesterEndInput.value.split("-").map(Number);
    from = `${semesterStartInput.value}-01`;
    to   = `${semesterEndInput.value}-${String(new Date(ey, em, 0).getDate()).padStart(2, "0")}`;
  } else if (analyticsType.value === "year") {
    from = `${yearStartInput.value}-01-01`;
    to   = `${yearStartInput.value}-12-31`;
  } else {
    alert("Select period type");
    return;
  }

  const cls = teacherClass;
  const sec = teacherSection;
  let pool = students.filter(s => s.cls === cls && s.sec === sec);

  if (analyticsTarget.value === "section") {
    const asel = analyticsSectionSelect.value;
    pool = pool.filter(s => s.sec === asel);
  }
  if (analyticsTarget.value === "student") {
    const q = analyticsSearch.value.trim().toLowerCase();
    pool = pool.filter(s => s.adm === q || s.name.toLowerCase().includes(q));
  }

  const stats = pool.map(s => ({ adm: s.adm, name: s.name, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
  Object.entries(attendanceData).forEach(([d, rec]) => {
    if (d < from || d > to) return;
    stats.forEach(st => {
      if (rec[st.adm]) { st[rec[st.adm]]++; st.total++; }
    });
  });
  stats.forEach(st => {
    const totalFine = st.A * fineRates.A + st.Lt * fineRates.Lt + st.L * fineRates.L + st.HD * fineRates.HD;
    const paid = (paymentsData[st.adm] || []).reduce((a, p) => a + p.amount, 0);
    st.outstanding = totalFine - paid;
    const pct = st.total ? (st.P / st.total) * 100 : 0;
    st.status = st.outstanding > 0 || pct < eligibilityPct ? "Debarred" : "Eligible";
  });

  lastAnalyticsStats = stats;
  lastAnalyticsRange = { from, to };
  renderAnalytics(stats, from, to);
};

function renderAnalytics(stats, from, to) {
  let filtered = stats;
  if (!analyticsFilterOptions.includes("all")) {
    filtered = stats.filter(st => analyticsFilterOptions.some(opt => {
      switch (opt) {
        case "registered":   return true;
        case "attendance":   return st.total > 0;
        case "fine":         return st.A > 0 || st.Lt > 0 || st.L > 0 || st.HD > 0;
        case "cleared":      return st.outstanding === 0;
        case "debarred":     return st.status === "Debarred";
        case "eligible":     return st.status === "Eligible";
      }
    }));
  }

  const theadRow = document.querySelector("#analyticsTable thead tr");
  theadRow.innerHTML = [
    "#", "Adm#", "Name", "P", "A", "Lt", "HD", "L", "Total", "%", "Outstanding", "Status"
  ].map(h => `<th>${h}</th>`).join("");

  analyticsBody.innerHTML = "";
  filtered.forEach((st, i) => {
    const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${st.adm}</td>
      <td>${st.name}</td>
      <td>${st.P}</td>
      <td>${st.A}</td>
      <td>${st.Lt}</td>
      <td>${st.HD}</td>
      <td>${st.L}</td>
      <td>${st.total}</td>
      <td>${pct}%</td>
      <td>PKR ${st.outstanding}</td>
      <td>${st.status}</td>
    `;
    analyticsBody.appendChild(tr);
  });

  instructionsDiv.textContent = `Period: ${from} to ${to}`;
  instructionsDiv.classList.remove("hidden");
  analyticsContainer.classList.remove("hidden");
  graphsDiv.classList.remove("hidden");
  document.getElementById("analyticsActions").classList.remove("hidden");

  // Bar Chart
  const barCtx = barChartCanvas.getContext("2d");
  if (window.barChartInstance) window.barChartInstance.destroy();
  window.barChartInstance = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: filtered.map(st => st.name),
      datasets: [{
        label: "% Present",
        data: filtered.map(st => st.total ? (st.P / st.total) * 100 : 0),
        backgroundColor: filtered.map(() => statusColors.P)
      }]
    },
    options: {
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });

  // Pie Chart
  const totals = filtered.reduce((acc, st) => {
    acc.P  += st.P;
    acc.A  += st.A;
    acc.Lt += st.Lt;
    acc.HD += st.HD;
    acc.L  += st.L;
    return acc;
  }, { P:0, A:0, Lt:0, HD:0, L:0 });

  const pieCtx = pieChartCanvas.getContext("2d");
  if (window.pieChartInstance) window.pieChartInstance.destroy();
  window.pieChartInstance = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: Object.values(statusNames),
      datasets: [{
        data: Object.keys(statusNames).map(code => totals[code]),
        backgroundColor: Object.keys(statusNames).map(code => statusColors[code])
      }]
    }
  });

  lastAnalyticsShare =
    `Attendance Analytics (${from} to ${to})\n` +
    filtered.map((st, i) => {
      const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
      return `${i + 1}. ${st.adm} ${st.name}: ${pct}% / PKR ${st.outstanding}`;
    }).join("\n");
}

downloadAnalyticsBtn.onclick = async () => {
  if (!lastAnalyticsStats.length) { alert("Load analytics first"); return; }

  const from = lastAnalyticsRange.from;
  const to = lastAnalyticsRange.to;
  const today = new Date().toISOString().split("T")[0];
  const doc = new jspdf.jsPDF();

  if (analyticsDownloadMode === "combined") {
    doc.setFontSize(18); doc.text("Attendance Analytics", 14, 16);
    doc.setFontSize(10); doc.text(`Period: ${from} to ${to}`, 14, 24);
    doc.setFontSize(12); doc.text(`${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`, 14, 32);

    const tempTable = document.createElement("table");
    tempTable.innerHTML = `
      <thead>
        <tr>
          <th>#</th><th>Adm#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th><th>Outstanding</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${lastAnalyticsStats.map((st, i) => {
          const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
          return `
            <tr>
              <td>${i+1}</td>
              <td>${st.adm}</td>
              <td>${st.name}</td>
              <td>${st.P}</td>
              <td>${st.A}</td>
              <td>${st.Lt}</td>
              <td>${st.HD}</td>
              <td>${st.L}</td>
              <td>${st.total}</td>
              <td>${pct}%</td>
              <td>PKR ${st.outstanding}</td>
              <td>${st.status}</td>
            </tr>`;
        }).join("")}
      </tbody>`;
    tempTable.id = "tempAnalyticsTable";
    document.body.appendChild(tempTable);
    doc.autoTable({ html: "#tempAnalyticsTable", startY: 40 });
    document.body.removeChild(tempTable);

    const fileName = `analytics_combined_${from}_to_${to}.pdf`;
    const blob = doc.output("blob");
    doc.save(fileName);
    await sharePdf(blob, fileName, "Attendance Analytics");
  } else {
    // Individual PDFs
    const lines = lastAnalyticsStats.map((st, i) => {
      const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
      return `
Student: ${st.name} (Adm#: ${st.adm})
Present: ${st.P}
Absent: ${st.A}
Late: ${st.Lt}
Half-Day: ${st.HD}
Leave: ${st.L}
Total Days: ${st.total}
% Present: ${pct}%
Outstanding Fine: PKR ${st.outstanding}

Fine Rates:
Absent: PKR ${fineRates.A}
Late: PKR ${fineRates.Lt}
Leave: PKR ${fineRates.L}
Half-Day: PKR ${fineRates.HD}

Eligibility %: ${eligibilityPct}%

HOD Signature: ______________

`;
    });

    let yPos = 16;
    doc.setFontSize(14);
    lastAnalyticsStats.forEach((st, i) => {
      if (i !== 0) doc.addPage();
      const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
      doc.text(`Attendance Receipt`, 14, 16);
      doc.setFontSize(12);
      doc.text(`Student: ${st.name} (Adm#: ${st.adm})`, 14, 26);
      doc.text(`Present: ${st.P}`, 14, 36);
      doc.text(`Absent: ${st.A}`, 14, 44);
      doc.text(`Late: ${st.Lt}`, 14, 52);
      doc.text(`Half-Day: ${st.HD}`, 14, 60);
      doc.text(`Leave: ${st.L}`, 14, 68);
      doc.text(`Total Days: ${st.total}`, 14, 76);
      doc.text(`% Present: ${pct}%`, 14, 84);
      doc.text(`Outstanding Fine: PKR ${st.outstanding}`, 14, 92);

      doc.text(`Fine Rates:`, 14, 110);
      doc.text(`Absent: PKR ${fineRates.A}`, 14, 118);
      doc.text(`Late: PKR ${fineRates.Lt}`, 14, 126);
      doc.text(`Leave: PKR ${fineRates.L}`, 14, 134);
      doc.text(`Half-Day: PKR ${fineRates.HD}`, 14, 142);
      doc.text(`Eligibility %: ${eligibilityPct}%`, 14, 158);

      doc.text(`HOD Signature: ______________`, 14, 180);
      doc.text(`Generated on ${new Date().toISOString().split("T")[0]}`, 14, 200);
    });

    const fileName = `analytics_individual_${lastAnalyticsRange.from}_to_${lastAnalyticsRange.to}.pdf`;
    const blob = doc.output("blob");
    doc.save(fileName);
    await sharePdf(blob, fileName, "Attendance Analytics (Individual Receipts)");
  }
};

shareAnalyticsBtn.onclick = () => {
  if (!lastAnalyticsShare) { alert("Load analytics first"); return; }
  window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, "_blank");
};

// FILTER MODAL
const analyticsFilterModal = document.getElementById("analyticsFilterModal");
const analyticsFilterClose = document.getElementById("analyticsFilterClose");
const applyAnalyticsFilterBtn = document.getElementById("applyAnalyticsFilter");

document.getElementById("analyticsFilterBtn").onclick = () => analyticsFilterModal.classList.remove("hidden");
analyticsFilterClose.onclick = () => analyticsFilterModal.classList.add("hidden");

applyAnalyticsFilterBtn.onclick = () => {
  const form = document.getElementById("analyticsFilterForm");
  const opts = Array.from(form.querySelectorAll("input[type=checkbox]:checked")).map(cb => cb.value);
  analyticsFilterOptions = opts.length ? opts : ["all"];
  const mode = form.querySelector("input[name=downloadMode]:checked").value;
  analyticsDownloadMode = mode;
  analyticsFilterModal.classList.add("hidden");
};

// =======================
// 15) ATTENDANCE REGISTER LOGIC
// =======================
const registerMonthInput   = document.getElementById("registerMonth");
const loadRegisterBtn      = document.getElementById("loadRegister");
const registerTableWrapper = document.getElementById("registerTableWrapper");
const registerHeaderRow    = document.getElementById("registerHeader");
const registerBodyTbody    = document.getElementById("registerBody");
const changeRegisterBtn    = document.getElementById("changeRegister");
const saveRegisterBtn      = document.getElementById("saveRegister");
const downloadRegisterBtn  = document.getElementById("downloadRegister");
const shareRegisterBtn     = document.getElementById("shareRegister");

loadRegisterBtn.onclick = () => {
  const m = registerMonthInput.value;
  if (!m) { alert("Pick month"); return; }
  const dateKeys = Object.keys(attendanceData).filter(d => d.startsWith(m + "-")).sort();
  if (!dateKeys.length) { alert("No attendance marked this month."); return; }

  registerHeaderRow.innerHTML =
    `<th>#</th><th>Adm#</th><th>Name</th>` +
    dateKeys.map(k => `<th>${k.split("-")[2]}</th>`).join("");

  registerBodyTbody.innerHTML = "";
  students.filter(s => s.cls === teacherClass && s.sec === teacherSection).forEach((s, i) => {
    let row = `<td>${i + 1}</td><td>${s.adm}</td><td>${s.name}</td>`;
    dateKeys.forEach(key => {
      const c = attendanceData[key][s.adm] || "";
      const color = c === "P" ? "var(--success)"
                 : c === "Lt" ? "var(--warning)"
                 : c === "HD" ? "#FF9800"
                 : c === "L" ? "var(--info)"
                 : "var(--danger)";
      const style = c ? `style="background:${color};color:#fff"` : "";
      row += `<td class="reg-cell" ${style}><span class="status-text">${c}</span></td>`;
    });
    const tr = document.createElement("tr");
    tr.innerHTML = row;
    registerBodyTbody.appendChild(tr);
  });

  document.querySelectorAll(".reg-cell").forEach(cell => {
    cell.onclick = () => {
      const span = cell.querySelector(".status-text");
      const codes = ["", "P", "Lt", "HD", "L", "A"];
      const idx = (codes.indexOf(span.textContent) + 1) % codes.length;
      const c = codes[idx];
      span.textContent = c;
      if (!c) {
        cell.style.background = "";
        cell.style.color = "";
      } else {
        const col = c === "P" ? "var(--success)"
                  : c === "Lt" ? "var(--warning)"
                  : c === "HD" ? "#FF9800"
                  : c === "L" ? "var(--info)"
                  : "var(--danger)";
        cell.style.background = col;
        cell.style.color = "#fff";
      }
    };
  });

  registerTableWrapper.classList.remove("hidden");
  saveRegisterBtn.classList.remove("hidden");
  loadRegisterBtn.classList.add("hidden");
  changeRegisterBtn.classList.add("hidden");
  downloadRegisterBtn.classList.add("hidden");
  shareRegisterBtn.classList.add("hidden");
};

saveRegisterBtn.onclick = async () => {
  const m = registerMonthInput.value;
  const dateKeys = Object.keys(attendanceData).filter(d => d.startsWith(m + "-")).sort();
  Array.from(registerBodyTbody.children).forEach(tr => {
    const adm = tr.children[1].textContent;
    dateKeys.forEach((key, idx) => {
      const code = tr.children[3 + idx].querySelector(".status-text").textContent;
      if (code) {
        attendanceData[key] = attendanceData[key] || {};
        attendanceData[key][adm] = code;
      } else {
        if (attendanceData[key]) delete attendanceData[key][adm];
      }
    });
  });
  attendanceDataBySchool[currentSchool] = attendanceData;
  await idbSet("attendanceDataBySchool", attendanceDataBySchool);
  await syncToFirebase();
  saveRegisterBtn.classList.add("hidden");
  changeRegisterBtn.classList.remove("hidden");
  downloadRegisterBtn.classList.remove("hidden");
  shareRegisterBtn.classList.remove("hidden");
  bindRegisterActions();
  updateCounters();
};

changeRegisterBtn.onclick = () => {
  registerTableWrapper.classList.add("hidden");
  changeRegisterBtn.classList.add("hidden");
  downloadRegisterBtn.classList.add("hidden");
  shareRegisterBtn.classList.add("hidden");
  saveRegisterBtn.classList.add("hidden");
  loadRegisterBtn.classList.remove("hidden");
  registerHeaderRow.innerHTML = "";
  registerBodyTbody.innerHTML = "";
};

function bindRegisterActions() {
  downloadRegisterBtn.onclick = async () => {
    const doc = new jspdf.jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split("T")[0];
    doc.setFontSize(18); doc.text("Attendance Register", 14, 20);
    doc.setFontSize(10); doc.text(`Date: ${today}`, pageWidth - 14, 20, { align: "right" });
    doc.setFontSize(12); doc.text(`${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`, 14, 36);
    doc.autoTable({ startY: 60, html: "#registerTable", tableWidth: "auto", styles: { fontSize: 10 } });
    const blob = doc.output("blob");
    doc.save("attendance_register.pdf");
    await sharePdf(blob, "attendance_register.pdf", "Attendance Register");
  };

  shareRegisterBtn.onclick = () => {
    const header = `Attendance Register\n${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`;
    const rows = Array.from(registerBodyTbody.children).map(tr =>
      Array.from(tr.children).map(td => td.querySelector(".status-text")?.textContent || td.textContent).join(" ")
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n" + rows.join("\n"))}`, "_blank");
  };
}

// =======================
// 16) BACKUP, RESTORE & RESET
// =======================
let backupHandle = null;
const chooseBackupFolderBtn = document.getElementById("chooseBackupFolder");
const restoreDataBtn         = document.getElementById("restoreData");
const restoreFileInput       = document.getElementById("restoreFile");
const resetDataBtn           = document.getElementById("resetData");

chooseBackupFolderBtn.onclick = async () => {
  try {
    backupHandle = await window.showDirectoryPicker();
    alert("Backup folder selected.");
  } catch (err) {
    console.error(err);
    alert("Folder selection canceled or not supported.");
  }
};

setInterval(async () => {
  if (!backupHandle) return;
  try {
    const backupData = {
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
    const now = new Date();
    const fileName = `backup_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}-${String(now.getMinutes()).padStart(2,"0")}.json`;
    const fileHandle = await backupHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(backupData));
    await writable.close();
  } catch (err) {
    console.error("Auto-backup failed:", err);
  }
}, 600000); // every 10 minutes

restoreDataBtn.onclick = () => restoreFileInput.click();

restoreFileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    studentsBySchool       = data.studentsBySchool       || {};
    attendanceDataBySchool = data.attendanceDataBySchool || {};
    paymentsDataBySchool   = data.paymentsDataBySchool   || {};
    lastAdmNoBySchool      = data.lastAdmNoBySchool      || {};
    fineRates              = data.fineRates              || { A:50, Lt:20, L:10, HD:30 };
    eligibilityPct         = data.eligibilityPct         || 75;
    schools                = data.schools                || [];
    currentSchool          = data.currentSchool          || null;
    teacherClass           = data.teacherClass           || null;
    teacherSection         = data.teacherSection         || null;

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
    await syncToFirebase();
    await loadSetup();
    alert("Data restored successfully.");
  } catch (err) {
    console.error(err);
    alert("Failed to restore data. File may be invalid.");
  }
  restoreFileInput.value = "";
};

resetDataBtn.onclick = async () => {
  if (!confirm("Factory reset will delete ALL data locally and in Firebase. Continue?")) return;
  await idbClear();
  studentsBySchool       = {};
  attendanceDataBySchool = {};
  paymentsDataBySchool   = {};
  lastAdmNoBySchool      = {};
  fineRates              = { A:50, Lt:20, L:10, HD:30 };
  eligibilityPct         = 75;
  schools                = [];
  currentSchool          = null;
  teacherClass           = null;
  teacherSection         = null;
  await syncToFirebase();
  await loadSetup();
  alert("Factory reset completed.");
};

// =======================
// 17) UTILITY: Generate Admission Number
// =======================
async function genAdmNo() {
  lastAdmNo++;
  lastAdmNoBySchool[currentSchool] = lastAdmNo;
  await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
  await syncToFirebase();
  return String(lastAdmNo).padStart(4, "0");
}

// =======================
// 18) SHARE PDF UTIL
// =======================
async function sharePdf(blob, fileName, title) {
  if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: blob.type })] })) {
    try {
      await navigator.share({
        files: [new File([blob], fileName, { type: blob.type })],
        title
      });
    } catch (err) {
      console.error("Share failed:", err);
    }
  }
}

// =======================
// 19) INITIAL SETUP ON PAGE LOAD (UNAFFECTED BY AUTH)
// =======================
// Note: actual show/hide is done after auth in initializeAfterAuth()
// But we can pre-setup UI elements here:

document.addEventListener("DOMContentLoaded", () => {
  setupCounters();
  loadFinancialSettings();
});
