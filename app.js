// app (27).js

// =======================================
// 1) FIREBASE IMPORTS & INITIAL SETUP
// =======================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  set as dbSet,
  get as dbGet
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsx5pWhYGh1bJ9gL2bmC68gVc6EpICEzA",
  authDomain: "attandace-management.firebaseapp.com",
  databaseURL: "https://attandace-management-default-rtdb.firebaseio.com",
  projectId: "attandace-management",
  storageBucket: "attandace-management.appspot.com",
  messagingSenderId: "222685278846",
  appId: "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// IndexedDB helper via idb-keyval (make sure idb-keyval is included in your HTML before this script)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// =======================================
// 2) GLOBAL STATE (AUTH + APP DATA)
// =======================================
let currentUser = null;
let userProfile = null;

let studentsBySchool = {};
let attendanceDataBySchool = {};
let paymentsDataBySchool = {};
let lastAdmNoBySchool = {};
let fineRates = { A: 50, Lt: 20, L: 10, HD: 30 };
let eligibilityPct = 75;
let schools = [];
let currentSchool = null;
let teacherClass = null;
let teacherSection = null;

let students = [];
let attendanceData = {};
let paymentsData = {};
let lastAdmNo = 0;

// =======================================
// 3) UTILITY: ensureSchoolData & syncToFirebase
// =======================================
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
    teacherSection
  };
  try {
    await dbSet(dbRef(database, "appData"), payload);
    console.log("✅ Synced data to Firebase");
  } catch (err) {
    console.error("Firebase sync failed:", err);
  }
}

// =======================================
// 4) DOMContentLoaded: SETUP AUTH UI & LISTENERS
// =======================================
window.addEventListener("DOMContentLoaded", () => {
  // --- AUTH SCREENS (Login / Register) ---
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

  // دکھائیں—لاگ ان/رجسٹر فارم (Start with Login visible)
  function showLoginForm() {
    loginForm.style.display = "flex";
    registerForm.style.display = "none";
  }
  function showRegisterForm() {
    loginForm.style.display = "none";
    registerForm.style.display = "flex";
  }

  showLoginForm();
  showLoginBtn.onclick = showLoginForm;
  showRegisterBtn.onclick = showRegisterForm;

  // جب Role تبدیل ہو تو متعلقہ فیلڈز شو/ہائڈ کریں
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

  // 4.1) LOGIN SUBMIT
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  });

  // 4.2) REGISTER SUBMIT
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

  // 4.3) AUTH STATE OBSERVER
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
      await initializeAfterAuth();
    } else {
      currentUser = null;
      userProfile = null;
      authScreen.style.display = "flex";
      mainApp.style.display = "none";
    }
  });

  // 4.4) LOGOUT BUTTON
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = () => signOut(auth);
  }
});

// =======================================
// 5) HELPER: ڈراپ ڈاؤن میں اسکول لوڈ کریں
// =======================================
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
    "Class One", "Class Two", "Class Three",
    "Class Four", "Class Five", "Class Six",
    "Class Seven", "Class Eight", "Class Nine",
    "Class Ten"
  ];
  classSelect.innerHTML = `<option disabled selected>-- Select Class --</option>`;
  classOptions.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    classSelect.appendChild(opt);
  });
}

// =======================================
// 6) initializeAfterAuth: لاگ ان کے بعد کا سارا سیٹ اپ
// =======================================
async function initializeAfterAuth() {
  const setupSection = document.getElementById("teacher-setup");
  const schoolInput = document.getElementById("schoolInput");
  const schoolSelect = document.getElementById("schoolSelect");

  // اگر Admin ہو: اسکول کا اندراج + لسٹ دکھائیں
  if (userProfile.role === "admin") {
    setupSection.style.display = "block";
    schoolInput.style.display = "inline-block";
  }
  // اگر Principal ہو: صرف اُسے اس کے اسکول کی لسٹ دکھائیں
  else if (userProfile.role === "principal") {
    setupSection.style.display = "block";
    schoolInput.style.display = "none";
    schoolSelect.innerHTML = `<option disabled selected>-- Select School --</option>`;
    Object.keys(userProfile.assignedSchools || {}).forEach((sch) => {
      const opt = document.createElement("option");
      opt.value = sch;
      opt.textContent = sch;
      schoolSelect.appendChild(opt);
    });
  }
  // اگر Teacher ہو: سیدھا اپنا اسائنڈ اسکول، کلاس، سیکشن لوکل اسٹوریج میں رکھو
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
    return;
  }

  // اگر Admin یا Principal ہے تب بھی ڈیٹا انیشیلائز کریں
  await initLocalState();
  resetViews();    // سب سیکشنز کو ہائڈ یا شو کریں
  await loadSetup();
}

// =======================================
// 7) LOCAL STATE INIT: IndexedDB سے ڈیٹا لوڈ کریں
// =======================================
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

// =======================================
// 8) RESET / SHOW-HIDE VIEW سیکشنز
// =======================================
function resetViews() {
  const sections = [
    "financial-settings",
    "animatedCounters",
    "student-registration",
    "attendance-section",
    "analytics-section",
    "register-section"
  ];
  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
}

// =======================================
// 9) loadSetup: اسکول/کلاس/سیکشن سیٹ اپ کریں
// =======================================
async function loadSetup() {
  // IndexedDB سے تازہ ویلیوز لوڈ کریں
  schools        = (await idbGet("schools")) || [];
  currentSchool  = (await idbGet("currentSchool")) || null;
  teacherClass   = (await idbGet("teacherClass")) || null;
  teacherSection = (await idbGet("teacherSection")) || null;

  const schoolSelect = document.getElementById("schoolSelect");
  const schoolInput = document.getElementById("schoolInput");
  const classSelect = document.getElementById("teacherClassSelect");
  const sectionSelect = document.getElementById("teacherSectionSelect");
  const setupText = document.getElementById("setupText");

  // Populate اسکول کا ڈراپ ڈاؤن
  if (userProfile.role === "admin") {
    schoolInput.style.display = "inline-block";
    schoolSelect.innerHTML = `<option disabled selected>-- Select School --</option>`;
    schools.forEach((sch) => {
      const opt = document.createElement("option");
      opt.value = sch;
      opt.textContent = sch;
      schoolSelect.appendChild(opt);
    });
  } else if (userProfile.role === "principal") {
    schoolInput.style.display = "none";
    schoolSelect.innerHTML = `<option disabled selected>-- Select School --</option>`;
    Object.keys(userProfile.assignedSchools || {}).forEach((sch) => {
      const opt = document.createElement("option");
      opt.value = sch;
      opt.textContent = sch;
      schoolSelect.appendChild(opt);
    });
  }

  renderSchoolList();

  // اگر سیٹ اپ مکمل ہے تو باقی فیچرز دکھائیں
  if (currentSchool && teacherClass && teacherSection) {
    await ensureSchoolData(currentSchool);
    students = studentsBySchool[currentSchool];
    attendanceData = attendanceDataBySchool[currentSchool];
    paymentsData = paymentsDataBySchool[currentSchool];
    lastAdmNo = lastAdmNoBySchool[currentSchool];

    classSelect.value = teacherClass;
    sectionSelect.value = teacherSection;
    schoolSelect.value = currentSchool;

    setupText.textContent =
      `${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`;
    document.getElementById("setupForm").classList.add("hidden");
    document.getElementById("setupDisplay").classList.remove("hidden");

    resetViews();
    // Show تمام سیکشنز
    document.getElementById("financial-settings").classList.remove("hidden");
    document.getElementById("animatedCounters").classList.remove("hidden");
    document.getElementById("student-registration").classList.remove("hidden");
    document.getElementById("attendance-section").classList.remove("hidden");
    document.getElementById("analytics-section").classList.remove("hidden");
    document.getElementById("register-section").classList.remove("hidden");

    renderStudents();   // طالب علموں کی ٹیبل ریڈر کریں
    updateCounters();   // کاؤنٹرز اپ ڈیٹ کریں
  } else {
    document.getElementById("setupForm").classList.remove("hidden");
    document.getElementById("setupDisplay").classList.add("hidden");
    resetViews();
  }
}

// =======================================
// 10) renderSchoolList: اسکول ایڈیٹ/ڈیلیٹ کے لیے
// =======================================
function renderSchoolList() {
  const listDiv = document.getElementById("schoolList");
  listDiv.innerHTML = "";
  schools.forEach((sch, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "row-inline";
    wrapper.innerHTML = `
      <span>${sch}</span>
      <button data-idx="${idx}" class="edit-school">✎</button>
      <button data-idx="${idx}" class="delete-school">🗑</button>
    `;
    listDiv.appendChild(wrapper);
  });
  // Edit handlers
  document.querySelectorAll(".edit-school").forEach((btn) => {
    btn.onclick = async () => {
      const idx = +btn.getAttribute("data-idx");
      const oldName = schools[idx];
      const newName = prompt("Rename school:", oldName);
      if (!newName) return;
      if (schools.includes(newName)) {
        alert("School name already exists.");
        return;
      }
      schools[idx] = newName;
      // Migrate data to new key
      studentsBySchool[newName] = studentsBySchool[oldName] || [];
      attendanceDataBySchool[newName] = attendanceDataBySchool[oldName] || {};
      paymentsDataBySchool[newName] = paymentsDataBySchool[oldName] || {};
      lastAdmNoBySchool[newName] = lastAdmNoBySchool[oldName] || 0;
      delete studentsBySchool[oldName];
      delete attendanceDataBySchool[oldName];
      delete paymentsDataBySchool[oldName];
      delete lastAdmNoBySchool[oldName];

      await idbSet("schools", schools);
      await idbSet("studentsBySchool", studentsBySchool);
      await idbSet("attendanceDataBySchool", attendanceDataBySchool);
      await idbSet("paymentsDataBySchool", paymentsDataBySchool);
      await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
      await syncToFirebase();
      loadSetup();
    };
  });
  // Delete handlers
  document.querySelectorAll(".delete-school").forEach((btn) => {
    btn.onclick = async () => {
      const idx = +btn.getAttribute("data-idx");
      const schName = schools[idx];
      if (!confirm(`Delete "${schName}" and all its data?`)) return;
      schools.splice(idx, 1);
      delete studentsBySchool[schName];
      delete attendanceDataBySchool[schName];
      delete paymentsDataBySchool[schName];
      delete lastAdmNoBySchool[schName];
      if (currentSchool === schName) {
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
  });
}

// =======================================
// 11) SETUP FORM HANDLERS (Create/select school, class, section)
// =======================================
const saveSetupBtn = document.getElementById("saveSetup");
saveSetupBtn.onclick = async (e) => {
  e.preventDefault();
  const newSchool = document.getElementById("schoolInput").value.trim();
  const schoolSelect = document.getElementById("schoolSelect");
  const classSelect = document.getElementById("teacherClassSelect");
  const sectionSelect = document.getElementById("teacherSectionSelect");

  // اگر نیا اسکول لکھا گیا تو Admin ہی کر سکتا ہے
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
  // اگر پہلے سے موجود اسکول منتخب کرنا ہے
  const selSchool = schoolSelect.value;
  const selClass = classSelect.value;
  const selSection = sectionSelect.value;
  if (!selSchool || !selClass || !selSection) {
    alert("Please select a school, class, and section.");
    return;
  }
  currentSchool = selSchool;
  teacherClass = selClass;
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

// =======================================
// 12) FINANCIAL SETTINGS SECTION
// =======================================
const fineAbsentInput = document.getElementById("fineAbsent");
const fineLateInput = document.getElementById("fineLate");
const fineLeaveInput = document.getElementById("fineLeave");
const fineHalfDayInput = document.getElementById("fineHalfDay");
const eligibilityPctInput = document.getElementById("eligibilityPct");
const saveSettingsBtn = document.getElementById("saveSettings");

function loadFinancialSettings() {
  fineAbsentInput.value = fineRates.A;
  fineLateInput.value = fineRates.Lt;
  fineLeaveInput.value = fineRates.L;
  fineHalfDayInput.value = fineRates.HD;
  eligibilityPctInput.value = eligibilityPct;
}

saveSettingsBtn.onclick = async () => {
  fineRates = {
    A: Number(fineAbsentInput.value) || 0,
    Lt: Number(fineLateInput.value) || 0,
    L: Number(fineLeaveInput.value) || 0,
    HD: Number(fineHalfDayInput.value) || 0
  };
  eligibilityPct = Number(eligibilityPctInput.value) || 0;
  await idbSet("fineRates", fineRates);
  await idbSet("eligibilityPct", eligibilityPct);
  await syncToFirebase();
  renderFinancialCard();
};

function renderFinancialCard() {
  const settingsCard = document.getElementById("settingsCard");
  settingsCard.innerHTML = `
    <div class="card">
      <p><strong>Fine/Absent:</strong> PKR ${fineRates.A}</p>
      <p><strong>Fine/Late:</strong> PKR ${fineRates.Lt}</p>
      <p><strong>Fine/Leave:</strong> PKR ${fineRates.L}</p>
      <p><strong>Fine/Half-Day:</strong> PKR ${fineRates.HD}</p>
      <p><strong>Eligibility %:</strong> ${eligibilityPct}%</p>
    </div>`;
}

// =======================================
// 13) COUNTERS ( ڈیش بورڈ )
// =======================================
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
  document.querySelectorAll(".card-number span").forEach((span) => {
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
  const cl = teacherClass;
  const sec = teacherSection;

  const sectionCountSpan = document.getElementById("sectionCount");
  const classCountSpan = document.getElementById("classCount");
  const schoolCountSpan = document.getElementById("schoolCount");
  const attendanceCountSpan = document.getElementById("attendanceCount");
  const eligibleCountSpan = document.getElementById("eligibleCount");
  const debarredCountSpan = document.getElementById("debarredCount");
  const outstandingCountSpan = document.getElementById("outstandingCount");

  // Section student count
  const sectionStudents = students.filter((s) => s.cls === cl && s.sec === sec);
  sectionCountSpan.dataset.target = sectionStudents.length;

  // Class student count
  const classStudents = students.filter((s) => s.cls === cl);
  classCountSpan.dataset.target = classStudents.length;

  // School total student count
  schoolCountSpan.dataset.target = students.length;

  // Attendance summary
  let totalP = 0,
    totalA = 0,
    totalLt = 0,
    totalHD = 0,
    totalL = 0;
  Object.entries(attendanceData).forEach(([date, rec]) => {
    sectionStudents.forEach((s) => {
      const code = rec[s.adm];
      if (!code) {
        totalA++;
      } else {
        switch (code) {
          case "P":
            totalP++;
            break;
          case "A":
            totalA++;
            break;
          case "Lt":
            totalLt++;
            break;
          case "HD":
            totalHD++;
            break;
          case "L":
            totalL++;
            break;
        }
      }
    });
  });
  const attendanceTotal = totalP + totalA + totalLt + totalHD + totalL;
  attendanceCountSpan.dataset.target = attendanceTotal;

  // Eligible / Debarred / Outstanding counts
  let eligibleCount = 0,
    debarredCount = 0,
    outstandingCount = 0;
  students.forEach((s) => {
    if (s.cls !== cl || s.sec !== sec) return;
    let p = 0,
      a = 0,
      lt = 0,
      hd = 0,
      l = 0,
      totalDays = 0;
    Object.values(attendanceData).forEach((rec) => {
      if (rec[s.adm]) {
        totalDays++;
        switch (rec[s.adm]) {
          case "P":
            p++;
            break;
          case "A":
            a++;
            break;
          case "Lt":
            lt++;
            break;
          case "HD":
            hd++;
            break;
          case "L":
            l++;
            break;
        }
      }
    });
    const fineTotal = a * fineRates.A + lt * fineRates.Lt + l * fineRates.L + hd * fineRates.HD;
    const paid = (paymentsData[s.adm] || []).reduce((acc, pmt) => acc + pmt.amount, 0);
    const outstanding = fineTotal - paid;
    const pct = totalDays ? (p / totalDays) * 100 : 0;
    const status = outstanding > 0 || pct < eligibilityPct ? "Debarred" : "Eligible";

    if (status === "Eligible") eligibleCount++;
    else debarredCount++;
    if (outstanding > 0) outstandingCount++;
  });
  eligibleCountSpan.dataset.target = eligibleCount;
  debarredCountSpan.dataset.target = debarredCount;
  outstandingCountSpan.dataset.target = outstandingCount;

  animateCounters();
}

// =======================================
// 14) STUDENT REGISTRATION SECTION
// =======================================
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

// 14.1) Add Student
addStudentBtn.onclick = async (e) => {
  e.preventDefault();
  const n = document.getElementById("studentName").value.trim();
  const p = document.getElementById("parentName").value.trim();
  const c = document.getElementById("parentContact").value.trim();
  const o = document.getElementById("parentOccupation").value.trim();
  const a = document.getElementById("parentAddress").value.trim();
  const cl = teacherClass;
  const sec = teacherSection;
  if (!n || !p || !c || !o || !a) {
    alert("All fields required");
    return;
  }
  if (!/^\d{7,15}$/.test(c)) {
    alert("Contact must be 7–15 digits");
    return;
  }
  const adm = await genAdmNo();
  students.push({
    name: n,
    adm,
    parent: p,
    contact: c,
    occupation: o,
    address: a,
    cls: cl,
    sec
  });
  studentsBySchool[currentSchool] = students;
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();
  renderStudents();
  updateCounters();

  // Clear form fields
  document.getElementById("studentName").value = "";
  document.getElementById("parentName").value = "";
  document.getElementById("parentContact").value = "";
  document.getElementById("parentOccupation").value = "";
  document.getElementById("parentAddress").value = "";
};

// 14.2) Render Students Table
function renderStudents() {
  studentsBody.innerHTML = "";
  let idx = 0;
  students.forEach((s, i) => {
    if (s.cls !== teacherClass || s.sec !== teacherSection) return;
    idx++;
    const stats = { P: 0, A: 0, Lt: 0, HD: 0, L: 0 };
    Object.values(attendanceData).forEach((rec) => {
      if (rec[s.adm]) stats[rec[s.adm]]++;
    });
    const total = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
    const fine =
      stats.A * fineRates.A +
      stats.Lt * fineRates.Lt +
      stats.L * fineRates.L +
      stats.HD * fineRates.HD;
    const paid = (paymentsData[s.adm] || []).reduce((a, p) => a + p.amount, 0);
    const out = fine - paid;
    const pct = total ? (stats.P / total) * 100 : 0;
    const status = out > 0 || pct < eligibilityPct ? "Debarred" : "Eligible";

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
  selectAllStudents.checked = false;
  toggleButtons();
  document.querySelectorAll(".add-payment-btn").forEach((b) => {
    b.onclick = () => openPaymentModal(b.dataset.adm);
  });
}

function toggleButtons() {
  const anyChecked = document.querySelectorAll(".sel:checked").length > 0;
  editSelectedBtn.disabled = !anyChecked;
  deleteSelectedBtn.disabled = !anyChecked;
}

studentsBody.addEventListener("change", (e) => {
  if (e.target.classList.contains("sel")) toggleButtons();
});

selectAllStudents.onclick = () => {
  document
    .querySelectorAll(".sel")
    .forEach((c) => (c.checked = selectAllStudents.checked));
  toggleButtons();
};

// 14.3) Edit Selected
editSelectedBtn.onclick = () => {
  document.querySelectorAll(".sel:checked").forEach((cb) => {
    const tr = cb.closest("tr");
    const i = Number(tr.dataset.index);
    const s = students[i];
    // Replace relevant cells with input fields
    tr.cells[2].innerHTML = `<input value="${s.name}" />`;
    tr.cells[4].innerHTML = `<input value="${s.parent}" />`;
    tr.cells[5].innerHTML = `<input value="${s.contact}" />`;
    tr.cells[6].innerHTML = `<input value="${s.occupation}" />`;
    tr.cells[7].innerHTML = `<input value="${s.address}" />`;
  });
  editSelectedBtn.classList.add("hidden");
  deleteSelectedBtn.classList.add("hidden");
  doneEditingBtn.classList.remove("hidden");
};

// 14.4) Done Editing
doneEditingBtn.onclick = async () => {
  document.querySelectorAll(".sel:checked").forEach((cb) => {
    const tr = cb.closest("tr");
    const i = Number(tr.dataset.index);
    const inputs = tr.querySelectorAll("input");
    students[i].name = inputs[0].value.trim();
    students[i].parent = inputs[1].value.trim();
    students[i].contact = inputs[2].value.trim();
    students[i].occupation = inputs[3].value.trim();
    students[i].address = inputs[4].value.trim();
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

// 14.5) Delete Selected
deleteSelectedBtn.onclick = async () => {
  if (!confirm("Delete selected students?")) return;
  const toDelete = Array.from(
    document.querySelectorAll(".sel:checked")
  ).map((cb) => Number(cb.closest("tr").dataset.index));
  students = students.filter((_, idx) => !toDelete.includes(idx));
  studentsBySchool[currentSchool] = students;
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();
  renderStudents();
  updateCounters();
};

// 14.6) Save / Edit / Share / Download Registration
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
    .filter((s) => s.cls === teacherClass && s.sec === teacherSection)
    .map(
      (s, i) =>
        `${i + 1}. Adm#: ${s.adm} Name: ${s.name} Parent: ${s.parent}`
    );
  window.open(
    `https://wa.me/?text=${encodeURIComponent(header + "\n\n" + lines.join("\n"))}`,
    "_blank"
  );
};

downloadRegistrationPDFBtn.onclick = () => {
  const doc = new jspdf.jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const today = new Date().toISOString().split("T")[0];
  doc.setFontSize(18);
  doc.text("Student Registration List", 14, 20);
  doc.setFontSize(10);
  doc.text(`Date: ${today}`, w - 14, 20, { align: "right" });
  doc.setFontSize(12);
  doc.text(`${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`, 14, 36);

  // Build a temporary HTML table for jsPDF
  const tempTable = document.createElement("table");
  tempTable.innerHTML = `
    <tr>
      <th>#</th><th>Adm#</th><th>Name</th><th>Parent</th><th>Contact</th><th>Occupation</th><th>Address</th>
    </tr>`;
  let idx = 0;
  students.forEach((s) => {
    if (s.cls !== teacherClass || s.sec !== teacherSection) return;
    idx++;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${idx}</td>
      <td>${s.adm}</td>
      <td>${s.name}</td>
      <td>${s.parent}</td>
      <td>${s.contact}</td>
      <td>${s.occupation}</td>
      <td>${s.address}</td>
    `;
    tempTable.appendChild(row);
  });

  doc.autoTable({ html: tempTable, startY: 50 });
  const blob = doc.output("blob");
  sharePdf(blob, "Student_Registration_List.pdf", "Student Registration List");
};

// =======================================
// 15) genAdmNo: نیا ایڈم نمبر بنانے کے لیے
// =======================================
async function genAdmNo() {
  lastAdmNo++;
  lastAdmNoBySchool[currentSchool] = lastAdmNo;
  await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
  await syncToFirebase();
  return String(lastAdmNo).padStart(4, "0");
}

// =======================================
// 16) Placeholder for Payment Modal وغیرہ
// =======================================
function openPaymentModal(adm) {
  // آپ اپنا موڈل کوڈ یہاں رکھیں
}

// =======================================
// 17) When Authenticated, loadSetup is called
// =======================================
// (initializeAfterAuth handles that)
