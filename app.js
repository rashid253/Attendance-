// app.js

// =============================================
// 0) AUTHENTICATION SETUP (Login / Register)
// =============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

import {
  getDatabase,
  ref as dbRef,
  set as dbSet,
  get as dbGet,
  onValue
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// IndexedDB helpers (idb-keyval IIFE must be loaded in your HTML before this script)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// Firebase configuration (use exactly your existing config)
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

// Elements for auth screens (must match your HTML IDs)
const authScreen     = document.getElementById("authScreen");
const mainApp        = document.getElementById("mainApp");
const showLoginBtn   = document.getElementById("showLogin");
const showRegisterBtn= document.getElementById("showRegister");
const loginForm      = document.getElementById("loginForm");
const registerForm   = document.getElementById("registerForm");
const loginEmail     = document.getElementById("loginEmail");
const loginPassword  = document.getElementById("loginPassword");
const regEmail       = document.getElementById("regEmail");
const regPassword    = document.getElementById("regPassword");
const regRole        = document.getElementById("regRole");
const regSchool      = document.getElementById("regSchool");
const regClass       = document.getElementById("regClass");
const regSection     = document.getElementById("regSection");
const logoutBtn      = document.getElementById("logoutBtn");

// Show Login or Register forms
function showLoginForm() {
  loginForm.style.display = "flex";
  registerForm.style.display = "none";
}
function showRegisterForm() {
  loginForm.style.display = "none";
  registerForm.style.display = "flex";
}
showLoginBtn.addEventListener("click", showLoginForm);
showRegisterBtn.addEventListener("click", showRegisterForm);

// When role changes on Register, show/hide the appropriate selects
regRole.addEventListener("change", () => {
  const role = regRole.value;
  if (role === "admin") {
    regSchool.style.display = "none";
    regClass.style.display  = "none";
    regSection.style.display= "none";
  } else if (role === "principal") {
    regSchool.style.display = "block";
    regClass.style.display  = "none";
    regSection.style.display= "none";
    loadAllSchoolsInto(regSchool);
  } else if (role === "teacher") {
    regSchool.style.display  = "block";
    regClass.style.display   = "block";
    regSection.style.display = "block";
    loadAllSchoolsInto(regSchool);
    populateClassDropdown(regClass);
  }
});

// LOGIN SUBMIT
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
  } catch (err) {
    alert("Login failed: " + err.message);
  }
});

// REGISTER SUBMIT
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const role = regRole.value;
  if (!role) {
    alert("Please select a role.");
    return;
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth, regEmail.value.trim(), regPassword.value);
    const uid = cred.user.uid;
    // Build profile object
    let profile = { email: regEmail.value.trim(), role };
    if (role === "principal") {
      const schoolName = regSchool.value;
      profile.assignedSchools = {};
      profile.assignedSchools[schoolName] = true;
    } else if (role === "teacher") {
      profile.assignedSchool  = regSchool.value;
      profile.assignedClass   = regClass.value;
      profile.assignedSection = regSection.value;
    }
    // Save under /users/{uid}
    await dbSet(dbRef(database, `users/${uid}`), profile);
    alert("Registration successful! Please log in.");
    showLoginForm();
  } catch (err) {
    alert("Registration failed: " + err.message);
  }
});

// OBSERVE AUTH STATE
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is logged in
    authScreen.style.display = "none";
    mainApp.style.display    = "block";
    const snap = await dbGet(dbRef(database, `users/${user.uid}`));
    if (!snap.exists()) {
      alert("No profile found. Contact admin.");
      return;
    }
    window.userProfile = snap.val(); // global reference for role
    initializeAfterAuth();
  } else {
    // Not logged in
    authScreen.style.display = "flex";
    mainApp.style.display    = "none";
  }
});

// LOGOUT
logoutBtn.addEventListener("click", () => signOut(auth));


// =============================================
// 1) “PER‐SCHOOL” DATA LOGIC (UNCHANGED)
// =============================================

// These live under /appData in Realtime Database
const appDataRef = dbRef(database, "appData");

// Local application state (per‐school mappings)
let studentsBySchool       = {}; // { schoolName: [ { … } ] }
let attendanceDataBySchool = {}; // { schoolName: { "YYYY-MM-DD": { adm: "P"/"A"/... } } }
let paymentsDataBySchool   = {}; // { schoolName: { adm: [ { date, amount }, … ] } }
let lastAdmNoBySchool      = {}; // { schoolName: numeric last admission number }
let fineRates              = { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct         = 75;
let schools                = [];    // array of school names
let currentSchool          = null;  // selected school name
let teacherClass           = null;  // selected class
let teacherSection         = null;  // selected section

// These reference the “active” school’s data
let students       = [];    // studentsBySchool[currentSchool]
let attendanceData = {};    // attendanceDataBySchool[currentSchool]
let paymentsData   = {};    // paymentsDataBySchool[currentSchool]
let lastAdmNo      = 0;     // lastAdmNoBySchool[currentSchool]

// Ensure data structures exist for a given school
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

// Initialize state from IndexedDB
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

// Sync local state to Firebase under /appData
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
    await dbSet(appDataRef, payload);
    console.log("✅ Synced data to Firebase");
  } catch (err) {
    console.error("Firebase sync failed:", err);
  }
}

// Utility: Share PDF via Web Share API
async function sharePdf(blob, fileName, title) {
  if (
    navigator.canShare &&
    navigator.canShare({ files: [new File([blob], fileName, { type: blob.type })] })
  ) {
    try {
      await navigator.share({
        title,
        files: [new File([blob], fileName, { type: blob.type })]
      });
    } catch (err) {
      console.error("Share failed:", err);
    }
  }
}

// ---------------------------------------------
// DOMContentLoaded: only set up event‐handlers now
// but actual “app logic” runs after auth finishes.
// ---------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Populate “Role → School/Class/Section” in Register form
  // (we’ll only call this when needed)
});

// =============================================
// 2) AFTER AUTH INITIALIZATION
//    (called once user is logged in)
// =============================================
async function initializeAfterAuth() {
  // 2A) Load local IndexedDB state
  await initLocalState();

  // 2B) Based on userProfile.role, show/hide “Setup” inputs
  const setupForm        = document.getElementById("setupForm");
  const setupDisplay     = document.getElementById("setupDisplay");
  const schoolInput      = document.getElementById("schoolInput");
  const schoolSelect     = document.getElementById("schoolSelect");
  const classSelect      = document.getElementById("teacherClassSelect");
  const sectionSelect    = document.getElementById("teacherSectionSelect");
  const setupText        = document.getElementById("setupText");
  const saveSetupBtn     = document.getElementById("saveSetup");
  const editSetupBtn     = document.getElementById("editSetup");
  const schoolListDiv    = document.getElementById("schoolList");

  // Helper: render the list of schools with edit/delete buttons if Admin
  function renderSchoolList() {
    schoolListDiv.innerHTML = "";
    schools.forEach((sch, idx) => {
      const row = document.createElement("div");
      row.className = "row-inline";
      row.innerHTML = `
        <span>${sch}</span>
        <div>
          ${userProfile.role === "admin"
            ? `<button data-idx="${idx}" class="edit-school no-print"><i class="fas fa-edit"></i></button>
               <button data-idx="${idx}" class="delete-school no-print"><i class="fas fa-trash"></i></button>`
            : ``
          }
        </div>`;
      schoolListDiv.appendChild(row);
    });
    // Attach edit handlers
    document.querySelectorAll(".edit-school").forEach(btn => {
      btn.onclick = async () => {
        const i = +btn.dataset.idx;
        const newName = prompt("Rename school:", schools[i]);
        if (!newName) return;
        if (schools.includes(newName)) {
          alert("School already exists.");
          return;
        }
        const oldName = schools[i];
        schools[i] = newName.trim();
        await idbSet("schools", schools);

        // Move all mappings under oldName → newName
        studentsBySchool[newName] = studentsBySchool[oldName] || [];
        delete studentsBySchool[oldName];
        await idbSet("studentsBySchool", studentsBySchool);

        attendanceDataBySchool[newName] = attendanceDataBySchool[oldName] || {};
        delete attendanceDataBySchool[oldName];
        await idbSet("attendanceDataBySchool", attendanceDataBySchool);

        paymentsDataBySchool[newName] = paymentsDataBySchool[oldName] || {};
        delete paymentsDataBySchool[oldName];
        await idbSet("paymentsDataBySchool", paymentsDataBySchool);

        lastAdmNoBySchool[newName] = lastAdmNoBySchool[oldName] || 0;
        delete lastAdmNoBySchool[oldName];
        await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);

        await syncToFirebase();
        await loadSetup();
      };
    });
    document.querySelectorAll(".delete-school").forEach(btn => {
      btn.onclick = async () => {
        const i = +btn.dataset.idx;
        if (!confirm(`Delete "${schools[i]}" and all its data?`)) return;
        const removed = schools.splice(i, 1)[0];
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
          currentSchool = null;
          teacherClass  = null;
          teacherSection= null;
          await idbSet("currentSchool", null);
          await idbSet("teacherClass", null);
          await idbSet("teacherSection", null);
        }
        await syncToFirebase();
        await loadSetup();
      };
    });
  }

  // Load Setup (schools, selected school/class/section)
  async function loadSetup() {
    schools        = (await idbGet("schools"))       || [];
    currentSchool  = await idbGet("currentSchool");
    teacherClass   = await idbGet("teacherClass");
    teacherSection = await idbGet("teacherSection");

    // Populate schoolSelect dropdown
    schoolSelect.innerHTML = ['<option disabled selected>-- Select School --</option>',
      ...schools.map(s => `<option value="${s}">${s}</option>`)
    ].join("");
    if (currentSchool) schoolSelect.value = currentSchool;

    renderSchoolList();

    if (currentSchool && teacherClass && teacherSection) {
      await ensureSchoolData(currentSchool);
      students       = studentsBySchool[currentSchool];
      attendanceData = attendanceDataBySchool[currentSchool];
      paymentsData   = paymentsDataBySchool[currentSchool];
      lastAdmNo      = lastAdmNoBySchool[currentSchool];

      classSelect.value   = teacherClass;
      sectionSelect.value = teacherSection;
      setupText.textContent = `${currentSchool} 🏫 | Class: ${teacherClass} | Section: ${teacherSection}`;
      setupForm.classList.add("hidden");
      setupDisplay.classList.remove("hidden");

      // Show all other sections now that setup is complete
      resetViews();

      // Render students & counters once the DOM is ready
      setTimeout(() => {
        renderStudents();
        updateCounters();
      }, 0);
    } else {
      setupForm.classList.remove("hidden");
      setupDisplay.classList.add("hidden");
      resetViews();
    }
  }

  // Save Setup button
  saveSetupBtn.onclick = async (e) => {
    e.preventDefault();
    const newSchool = schoolInput.value.trim();
    if (newSchool) {
      if (userProfile.role !== "admin") {
        alert("Only Admin can create a new school.");
        return;
      }
      if (!schools.includes(newSchool)) {
        schools.push(newSchool);
        await idbSet("schools", schools);
        await syncToFirebase();
      }
      schoolInput.value = "";
      return loadSetup();
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

  // Edit Setup button
  editSetupBtn.onclick = (e) => {
    e.preventDefault();
    setupForm.classList.remove("hidden");
    setupDisplay.classList.add("hidden");
    resetViews();
  };

  // 2C) Helper functions for dropdowns
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
      "Play Group","Nursery","KG",
      "Class One","Class Two","Class Three",
      "Class Four","Class Five","Class Six",
      "Class Seven","Class Eight","Class Nine",
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

  // 2D) Now load setup for the first time
  await loadSetup();


  // =============================================
  // 3) FINANCIAL SETTINGS LOGIC (UNCHANGED)
  // =============================================
  const formDiv             = document.getElementById("financialForm");
  const saveSettings        = document.getElementById("saveSettings");
  const fineAbsentInput     = document.getElementById("fineAbsent");
  const fineLateInput       = document.getElementById("fineLate");
  const fineLeaveInput      = document.getElementById("fineLeave");
  const fineHalfDayInput    = document.getElementById("fineHalfDay");
  const eligibilityPctInput = document.getElementById("eligibilityPct");

  const settingsCard = document.createElement("div");
  const editSettings = document.createElement("button");
  settingsCard.id = "settingsCard";
  settingsCard.className = "card hidden";
  editSettings.id = "editSettings";
  editSettings.className = "btn no-print hidden";
  editSettings.textContent = "Edit Settings";
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editSettings);

  fineAbsentInput.value     = fineRates.A;
  fineLateInput.value       = fineRates.Lt;
  fineLeaveInput.value      = fineRates.L;
  fineHalfDayInput.value    = fineRates.HD;
  eligibilityPctInput.value = eligibilityPct;

  saveSettings.onclick = async () => {
    fineRates = {
      A : Number(fineAbsentInput.value)  || 0,
      Lt: Number(fineLateInput.value)    || 0,
      L : Number(fineLeaveInput.value)   || 0,
      HD: Number(fineHalfDayInput.value) || 0
    };
    eligibilityPct = Number(eligibilityPctInput.value) || 0;
    await idbSet("fineRates", fineRates);
    await idbSet("eligibilityPct", eligibilityPct);
    await syncToFirebase();

    settingsCard.innerHTML = `
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
      </div>`;
    formDiv.querySelectorAll("input").forEach(i => i.parentElement.classList.add("hidden"));
    saveSettings.classList.add("hidden");
    settingsCard.classList.remove("hidden");
    editSettings.classList.remove("hidden");
  };

  editSettings.onclick = () => {
    settingsCard.classList.add("hidden");
    editSettings.classList.add("hidden");
    formDiv.querySelectorAll("input").forEach(i => i.parentElement.classList.remove("hidden"));
    saveSettings.classList.remove("hidden");
  };


  // =============================================
  // 4) COUNTERS SECTION (UNCHANGED)
  // =============================================
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

  createCounterCard("card-section",     "Section",        "sectionCount");
  createCounterCard("card-class",       "Class",          "classCount");
  createCounterCard("card-school",      "School",         "schoolCount");
  createCounterCard("card-attendance",  "Attendance",     "attendanceCount");
  createCounterCard("card-eligible",    "Eligible",       "eligibleCount");
  createCounterCard("card-debarred",    "Debarred",       "debarredCount");
  createCounterCard("card-outstanding", "Outstanding/Fine","outstandingCount");

  const sectionCountSpan     = document.getElementById("sectionCount");
  const classCountSpan       = document.getElementById("classCount");
  const schoolCountSpan      = document.getElementById("schoolCount");
  const attendanceCountSpan  = document.getElementById("attendanceCount");
  const eligibleCountSpan    = document.getElementById("eligibleCount");
  const debarredCountSpan    = document.getElementById("debarredCount");
  const outstandingCountSpan = document.getElementById("outstandingCount");

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
    const cl  = document.getElementById("teacherClassSelect").value;
    const sec = document.getElementById("teacherSectionSelect").value;

    const sectionStudents = students.filter(s => s.cls === cl && s.sec === sec);
    sectionCountSpan.dataset.target = sectionStudents.length;

    const classStudents = students.filter(s => s.cls === cl);
    classCountSpan.dataset.target = classStudents.length;

    schoolCountSpan.dataset.target = students.length;

    let totalP = 0, totalA = 0, totalLt = 0, totalHD = 0, totalL = 0;
    Object.entries(attendanceData).forEach(([_, rec]) => {
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

  const sectionCard     = document.getElementById("card-section");
  const classCard       = document.getElementById("card-class");
  const schoolCard      = document.getElementById("card-school");
  const attendanceCard  = document.getElementById("card-attendance");
  const eligibleCard    = document.getElementById("card-eligible");
  const debarredCard    = document.getElementById("card-debarred");
  const outstandingCard = document.getElementById("card-outstanding");

  sectionCard.onclick = () => {
    const cl  = document.getElementById("teacherClassSelect").value;
    const sec = document.getElementById("teacherSectionSelect").value;
    const list = students
      .filter(s => s.cls === cl && s.sec === sec)
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Class ${cl} Section ${sec}:\n\n${list || "No students found."}`);
  };

  classCard.onclick = () => {
    const cl = document.getElementById("teacherClassSelect").value;
    const list = students
      .filter(s => s.cls === cl)
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Class ${cl} (All Sections):\n\n${list || "No students found."}`);
  };

  schoolCard.onclick = () => {
    const classes = [...new Set(students.map(s => s.cls))].sort();
    let details = "";
    classes.forEach(cl => {
      const classStudents = students.filter(s => s.cls === cl);
      details += `Class ${cl} (Total ${classStudents.length} students):\n`;
      classStudents.forEach((s, idx) => {
        details += `  ${idx + 1}. Adm#: ${s.adm}  Name: ${s.name}\n`;
      });
      details += "\n";
    });
    alert(`School Overview:\n\n${details || "No students in school."}`);
  };

  attendanceCard.onclick = () => {
    const cl  = document.getElementById("teacherClassSelect").value;
    const sec = document.getElementById("teacherSectionSelect").value;
    let totalP = 0, totalA = 0, totalLt = 0, totalHD = 0, totalL = 0;
    Object.entries(attendanceData).forEach(([_, rec]) => {
      students.filter(s => s.cls === cl && s.sec === sec).forEach(s => {
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
    alert(
      `Attendance Summary for Class ${cl} Section ${sec}:\n\n` +
      `Present   : ${totalP}\n` +
      `Absent    : ${totalA}\n` +
      `Late      : ${totalLt}\n` +
      `Half-Day  : ${totalHD}\n` +
      `Leave     : ${totalL}`
    );
  };

  eligibleCard.onclick = () => {
    const cl  = document.getElementById("teacherClassSelect").value;
    const sec = document.getElementById("teacherSectionSelect").value;
    const list = students
      .filter(s => {
        if (s.cls !== cl || s.sec !== sec) return false;
        let p=0, totalDays=0;
        Object.values(attendanceData).forEach(rec => {
          if (rec[s.adm]) {
            totalDays++;
            if (rec[s.adm] === "P") p++;
          }
        });
        const pct = totalDays ? (p / totalDays) * 100 : 0;
        let a=0, lt=0, l=0, hd=0;
        Object.values(attendanceData).forEach(rec => {
          if (rec[s.adm]) {
            switch (rec[s.adm]) {
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
        return outstanding <= 0 && pct >= eligibilityPct;
      })
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Eligible Students:\n\n${list || "No eligible students."}`);
  };

  debarredCard.onclick = () => {
    const cl  = document.getElementById("teacherClassSelect").value;
    const sec = document.getElementById("teacherSectionSelect").value;
    const list = students
      .filter(s => {
        if (s.cls !== cl || s.sec !== sec) return false;
        let p=0, totalDays=0;
        Object.values(attendanceData).forEach(rec => {
          if (rec[s.adm]) {
            totalDays++;
            if (rec[s.adm] === "P") p++;
          }
        });
        const pct = totalDays ? (p / totalDays) * 100 : 0;
        let a=0, lt=0, l=0, hd=0;
        Object.values(attendanceData).forEach(rec => {
          if (rec[s.adm]) {
            switch (rec[s.adm]) {
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
        return outstanding > 0 || pct < eligibilityPct;
      })
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Debarred Students:\n\n${list || "No debarred students."}`);
  };

  outstandingCard.onclick = () => {
    const cl  = document.getElementById("teacherClassSelect").value;
    const sec = document.getElementById("teacherSectionSelect").value;
    const list = students
      .filter(s => {
        if (s.cls !== cl || s.sec !== sec) return false;
        let a=0, lt=0, l=0, hd=0;
        Object.values(attendanceData).forEach(rec => {
          if (rec[s.adm]) {
            switch (rec[s.adm]) {
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
        return outstanding > 0;
      })
      .map((s, i) => {
        let a=0, lt=0, l=0, hd=0;
        Object.values(attendanceData).forEach(rec => {
          if (rec[s.adm]) {
            switch (rec[s.adm]) {
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
        return `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}  Outstanding: PKR ${outstanding}`;
      })
      .join("\n");
    alert(`Students with Outstanding Fines:\n\n${list || "No outstanding fines."}`);
  };


  // =============================================
  // 5) STUDENT REGISTRATION LOGIC (UNCHANGED)
  // =============================================
  const studentsBody            = document.getElementById("studentsBody");
  const selectAllStudents       = document.getElementById("selectAllStudents");
  const editSelectedBtn         = document.getElementById("editSelected");
  const doneEditingBtn          = document.getElementById("doneEditing");
  const deleteSelectedBtn       = document.getElementById("deleteSelected");
  const saveRegistrationBtn     = document.getElementById("saveRegistration");
  const editRegistrationBtn     = document.getElementById("editRegistration");
  const shareRegistrationBtn    = document.getElementById("shareRegistration");
  const downloadRegistrationBtn = document.getElementById("downloadRegistrationPDF");

  async function genAdmNo() {
    lastAdmNo++;
    lastAdmNoBySchool[currentSchool] = lastAdmNo;
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
    await syncToFirebase();
    return String(lastAdmNo).padStart(4, "0");
  }

  document.getElementById("addStudent").onclick = async (e) => {
    e.preventDefault();
    const n   = document.getElementById("studentName").value.trim();
    const p   = document.getElementById("parentName").value.trim();
    const c   = document.getElementById("parentContact").value.trim();
    const o   = document.getElementById("parentOccupation").value.trim();
    const a   = document.getElementById("parentAddress").value.trim();
    const cl  = document.getElementById("teacherClassSelect").value;
    const sec = document.getElementById("teacherSectionSelect").value;
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
    const cl  = document.getElementById("teacherClassSelect").value;
    const sec = document.getElementById("teacherSectionSelect").value;
    studentsBody.innerHTML = "";
    let idx = 0;
    students.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
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
    const any = !!document.querySelector(".sel:checked");
    editSelectedBtn.disabled   = !any;
    deleteSelectedBtn.disabled = !any;
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
      const tr = cb.closest("tr"), i = +tr.dataset.index, s = students[i];
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" checked></td>
        <td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"></td>
        <td>${s.adm}</td>
        <td><input value="${s.parent}"></td>
        <td><input value="${s.contact}"></td>
        <td><input value="${s.occupation}"></td>
        <td><input value="${s.address}"></td>
        <td colspan="3"></td>
      `;
    });
    editSelectedBtn.classList.add("hidden");
    deleteSelectedBtn.classList.add("hidden");
    doneEditingBtn.classList.remove("hidden");
  };

  doneEditingBtn.onclick = async () => {
    document.querySelectorAll("#studentsBody tr").forEach(tr => {
      const inps = [...tr.querySelectorAll("input:not(.sel)")];
      if (inps.length === 5) {
        const [n, p, c, o, a] = inps.map(i => i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(x => x.adm === adm);
        if (idx > -1) {
          students[idx] = { ...students[idx], name: n, parent: p, contact: c, occupation: o, address: a };
        }
      }
    });
    studentsBySchool[currentSchool] = students;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    doneEditingBtn.classList.add("hidden");
    editSelectedBtn.classList.remove("hidden");
    deleteSelectedBtn.classList.remove("hidden");
    renderStudents();
    updateCounters();
  };

  deleteSelectedBtn.onclick = async () => {
    if (!confirm("Delete selected students?")) return;
    const toDel = [...document.querySelectorAll(".sel:checked")].map(cb => +cb.closest("tr").dataset.index);
    students = students.filter((_, i) => !toDel.includes(i));
    studentsBySchool[currentSchool] = students;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    renderStudents();
    updateCounters();
  };

  saveRegistrationBtn.onclick = async () => {
    if (!doneEditingBtn.classList.contains("hidden")) { alert("Finish editing before saving."); return; }
    studentsBySchool[currentSchool] = students;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    saveRegistrationBtn.classList.add("hidden");
    editRegistrationBtn.classList.remove("hidden");
    shareRegistrationBtn.classList.remove("hidden");
    downloadRegistrationBtn.classList.remove("hidden");
    renderStudents();
    updateCounters();
  };

  editRegistrationBtn.onclick = () => {
    editRegistrationBtn.classList.add("hidden");
    shareRegistrationBtn.classList.add("hidden");
    downloadRegistrationBtn.classList.add("hidden");
    saveRegistrationBtn.classList.remove("hidden");
    renderStudents();
    updateCounters();
  };

  shareRegistrationBtn.onclick = () => {
    const header = `*Student Registration List*\n${document.getElementById("setupText").textContent}\n\n`;
    const lines = students
      .filter(s => s.cls === document.getElementById("teacherClassSelect").value
                && s.sec === document.getElementById("teacherSectionSelect").value)
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}  Parent: ${s.parent}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(header + lines.join("\n"))}`, "_blank");
  };

  downloadRegistrationBtn.onclick = async () => {
    const doc = new jspdf.jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split("T")[0];

    doc.setFontSize(18);
    doc.text("Student Registration List", 14, 20);
    doc.setFontSize(10);
    doc.text(`Date: ${today}`, pageWidth - 14, 20, { align: "right" });
    doc.setFontSize(12);
    doc.text(document.getElementById("setupText").textContent, 14, 36);

    const tempTable = document.createElement("table");
    tempTable.innerHTML = `
      <tr>
        <th>#</th><th>Adm#</th><th>Name</th><th>Parent</th><th>Contact</th><th>Occupation</th><th>Address</th>
      </tr>
      ${
        students
          .filter(s => s.cls === document.getElementById("teacherClassSelect").value
                    && s.sec === document.getElementById("teacherSectionSelect").value)
          .map((s, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${s.adm}</td>
              <td>${s.name}</td>
              <td>${s.parent}</td>
              <td>${s.contact}</td>
              <td>${s.occupation}</td>
              <td>${s.address}</td>
            </tr>
          `).join("")
      }
    `;
    doc.autoTable({
      startY: 50,
      html: tempTable,
      styles: { fontSize: 10 }
    });

    const fileName = `students_${document.getElementById("teacherClassSelect").value}_${document.getElementById("teacherSectionSelect").value}_${today}.pdf`;
    const blob = doc.output("blob");
    doc.save(fileName);

    await sharePdf(blob, fileName, "Student Registration List");
  };


  // =============================================
  // 6) PAYMENT MODAL LOGIC (UNCHANGED)
  // =============================================
  const paymentModal         = document.getElementById("paymentModal");
  const payAdmSpan           = document.getElementById("payAdm");
  const paymentAmountInput   = document.getElementById("paymentAmount");
  const paymentModalCloseBtn = document.getElementById("paymentModalClose");
  const savePaymentBtn       = document.getElementById("savePayment");
  const cancelPaymentBtn     = document.getElementById("cancelPayment");

  function openPaymentModal(adm) {
    payAdmSpan.textContent = adm;
    paymentAmountInput.value = "";
    paymentModal.classList.remove("hidden");
  }
  paymentModalCloseBtn.onclick = () => paymentModal.classList.add("hidden");
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
  cancelPaymentBtn.onclick = () => paymentModal.classList.add("hidden");


  // =============================================
  // 7) MARK ATTENDANCE LOGIC (UNCHANGED)
  // =============================================
  const dateInput             = document.getElementById("dateInput");
  const loadAttendanceBtn     = document.getElementById("loadAttendance");
  const saveAttendanceBtn     = document.getElementById("saveAttendance");
  const resetAttendanceBtn    = document.getElementById("resetAttendance");
  const downloadAttendanceBtn = document.getElementById("downloadAttendancePDF");
  const shareAttendanceBtn    = document.getElementById("shareAttendanceSummary");
  const attendanceBodyDiv     = document.getElementById("attendanceBody");
  const attendanceSummaryDiv  = document.getElementById("attendanceSummary");

  const statusNames  = { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" };
  const statusColors = { P:"var(--success)", A:"var(--danger)", Lt:"var(--warning)", HD:"#FF9800", L:"var(--info)" };

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = "";
    attendanceSummaryDiv.innerHTML = "";
    const cl  = document.getElementById("teacherClassSelect").value;
    const sec = document.getElementById("teacherSectionSelect").value;
    attendanceBodyDiv.style.overflowX = "auto";
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
    attendanceBodyDiv.classList.remove("hidden");
    saveAttendanceBtn.classList.remove("hidden");
    resetAttendanceBtn.classList.add("hidden");
    downloadAttendanceBtn.classList.add("hidden");
    shareAttendanceBtn.classList.add("hidden");
    attendanceSummaryDiv.classList.add("hidden");
  };

  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert("Pick date"); return; }
    attendanceData[date] = {};
    const cl  = document.getElementById("teacherClassSelect").value;
    const sec = document.getElementById("teacherSectionSelect").value;
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
    downloadAttendanceBtn.classList.remove("hidden");
    shareAttendanceBtn.classList.remove("hidden");
    attendanceSummaryDiv.classList.remove("hidden");
    updateCounters();
  };

  resetAttendanceBtn.onclick = () => {
    attendanceBodyDiv.classList.remove("hidden");
    saveAttendanceBtn.classList.remove("hidden");
    resetAttendanceBtn.classList.add("hidden");
    downloadAttendanceBtn.classList.add("hidden");
    shareAttendanceBtn.classList.add("hidden");
    attendanceSummaryDiv.classList.add("hidden");
  };

  downloadAttendanceBtn.onclick = async () => {
    const doc = new jspdf.jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split("T")[0];
    doc.setFontSize(18); doc.text("Attendance Report", 14, 16);
    doc.setFontSize(10); doc.text(`Date: ${today}`, w - 14, 16, { align: "right" });
    doc.setFontSize(12); doc.text(document.getElementById("setupText").textContent, 14, 24);
    doc.autoTable({ startY: 30, html: "#attendanceSummaryTable" });
    const fileName = `attendance_${dateInput.value}.pdf`;
    const blob = doc.output("blob");
    doc.save(fileName);
    await sharePdf(blob, fileName, "Attendance Report");
  };

  shareAttendanceBtn.onclick = () => {
    const cl   = document.getElementById("teacherClassSelect").value;
    const sec  = document.getElementById("teacherSectionSelect").value;
    const date = dateInput.value;
    const header = `*Attendance Report*\nClass ${cl} Sec ${sec} - ${date}`;
    const lines = students.filter(s => s.cls === cl && s.sec === sec)
      .map((s, i) => `${i + 1}. ${s.name} (Adm#: ${s.adm}): ${statusNames[attendanceData[date][s.adm]]}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n\n" + lines.join("\n"))}`, "_blank");
  };

  // =============================================
  // 8) ANALYTICS SECTION (UNCHANGED)
  // =============================================
  const atg                  = document.getElementById("analyticsTarget");
  const asel                 = document.getElementById("analyticsSectionSelect");
  const atype                = document.getElementById("analyticsType");
  const adateInput           = document.getElementById("analyticsDate");
  const amonthInput          = document.getElementById("analyticsMonth");
  const semsInput            = document.getElementById("semesterStart");
  const semeInput            = document.getElementById("semesterEnd");
  const ayearInput           = document.getElementById("yearStart");
  const asearchInput         = document.getElementById("analyticsSearch");
  const loadAnalyticsBtn     = document.getElementById("loadAnalytics");
  const resetAnalyticsBtn    = document.getElementById("resetAnalytics");
  const instructionsDiv      = document.getElementById("instructions");
  const analyticsContainer   = document.getElementById("analyticsContainer");
  const graphsDiv            = document.getElementById("graphs");
  const analyticsActionsDiv  = document.getElementById("analyticsActions");
  const barChartCanvas       = document.getElementById("barChart");
  const pieChartCanvas       = document.getElementById("pieChart");
  const downloadAnalyticsBtn = document.getElementById("downloadAnalytics");
  const shareAnalyticsBtn    = document.getElementById("shareAnalytics");

  const analyticsStatusNames  = { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" };
  const analyticsStatusColors = {
    P: getComputedStyle(document.documentElement).getPropertyValue("--success").trim(),
    A: getComputedStyle(document.documentElement).getPropertyValue("--danger").trim(),
    Lt: getComputedStyle(document.documentElement).getPropertyValue("--warning").trim(),
    HD: "#FF9800",
    L: getComputedStyle(document.documentElement).getPropertyValue("--info").trim(),
  };

  let analyticsFilterOptions = ["all"];
  let analyticsDownloadMode  = "combined";
  let lastAnalyticsStats     = [];
  let lastAnalyticsRange     = { from: null, to: null };
  let lastAnalyticsShare     = "";

  document.getElementById("analyticsFilterBtn").onclick = () => {
    document.getElementById("analyticsFilterModal").classList.remove("hidden");
  };
  document.getElementById("analyticsFilterClose").onclick = () => {
    document.getElementById("analyticsFilterModal").classList.add("hidden");
  };
  document.getElementById("applyAnalyticsFilter").onclick = () => {
    analyticsFilterOptions = Array.from(document.querySelectorAll("#analyticsFilterForm input[type='checkbox']:checked")).map(cb => cb.value) || ["all"];
    analyticsDownloadMode = document.querySelector("#analyticsFilterForm input[name='downloadMode']:checked").value;
    document.getElementById("analyticsFilterModal").classList.add("hidden");
    if (lastAnalyticsStats.length) {
      renderAnalytics(lastAnalyticsStats, lastAnalyticsRange.from, lastAnalyticsRange.to);
    }
  };

  atg.onchange = () => {
    atype.disabled = false;
    asel.classList.add("hidden");
    asearchInput.classList.add("hidden");
    instructionsDiv.classList.add("hidden");
    analyticsContainer.classList.add("hidden");
    graphsDiv.classList.add("hidden");
    analyticsActionsDiv.classList.add("hidden");
    resetAnalyticsBtn.classList.remove("hidden");
    if (atg.value === "section") asel.classList.remove("hidden");
    if (atg.value === "student") asearchInput.classList.remove("hidden");
  };

  atype.onchange = () => {
    [adateInput, amonthInput, semsInput, semeInput, ayearInput].forEach(x => x.classList.add("hidden"));
    [instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv].forEach(x => x.classList.add("hidden"));
    resetAnalyticsBtn.classList.remove("hidden");
    switch (atype.value) {
      case "date":
        adateInput.classList.remove("hidden");
        break;
      case "month":
        amonthInput.classList.remove("hidden");
        break;
      case "semester":
        semsInput.classList.remove("hidden");
        semeInput.classList.remove("hidden");
        break;
      case "year":
        ayearInput.classList.remove("hidden");
        break;
    }
  };

  resetAnalyticsBtn.onclick = (e) => {
    e.preventDefault();
    atype.value = "";
    [adateInput, amonthInput, semsInput, semeInput, ayearInput, instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv].forEach(x => x.classList.add("hidden"));
    resetAnalyticsBtn.classList.add("hidden");
  };

  loadAnalyticsBtn.onclick = () => {
    if (atg.value === "student" && !asearchInput.value.trim()) { alert("Enter admission number or name"); return; }
    let from, to;
    if (atype.value === "date") {
      from = to = adateInput.value;
    } else if (atype.value === "month") {
      const [y, m] = amonthInput.value.split("-").map(Number);
      from = `${amonthInput.value}-01`;
      to = `${amonthInput.value}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    } else if (atype.value === "semester") {
      const [sy, sm] = semsInput.value.split("-").map(Number);
      const [ey, em] = semeInput.value.split("-").map(Number);
      from = `${semsInput.value}-01`;
      to = `${semeInput.value}-${String(new Date(ey, em, 0).getDate()).padStart(2, "0")}`;
    } else if (atype.value === "year") {
      from = `${ayearInput.value}-01-01`;
      to = `${ayearInput.value}-12-31`;
    } else {
      alert("Select period type");
      return;
    }

    const cls = document.getElementById("teacherClassSelect").value;
    const sec = document.getElementById("teacherSectionSelect").value;
    let pool = students.filter(s => s.cls === cls && s.sec === sec);
    if (atg.value === "section") pool = pool.filter(s => s.sec === asel.value);
    if (atg.value === "student") {
      const q = asearchInput.value.trim().toLowerCase();
      pool = pool.filter(s => s.adm === q || s.name.toLowerCase().includes(q));
    }

    const stats = pool.map(s => ({ adm: s.adm, name: s.name, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    Object.entries(attendanceData).forEach(([d, rec]) => {
      if (d < from || d > to) return;
      stats.forEach(st => {
        if (rec[st.adm]) {
          st[rec[st.adm]]++;
          st.total++;
        }
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
    theadRow.innerHTML = ["#","Adm#","Name","P","A","Lt","HD","L","Total","%","Outstanding","Status"]
      .map(h => `<th>${h}</th>`).join("");

    const tbody = document.getElementById("analyticsBody");
    tbody.innerHTML = "";
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
      tbody.appendChild(tr);
    });

    document.getElementById("instructions").textContent = `Period: ${from} to ${to}`;
    document.getElementById("instructions").classList.remove("hidden");
    document.getElementById("analyticsContainer").classList.remove("hidden");
    document.getElementById("graphs").classList.remove("hidden");
    document.getElementById("analyticsActions").classList.remove("hidden");

    // Bar chart
    const barCtx = barChartCanvas.getContext("2d");
    if (window.barChartInstance) window.barChartInstance.destroy();
    window.barChartInstance = new Chart(barCtx, {
      type: "bar",
      data: {
        labels: filtered.map(st => st.name),
        datasets: [{
          label: "% Present",
          data: filtered.map(st => st.total ? (st.P / st.total) * 100 : 0),
          backgroundColor: filtered.map(() => analyticsStatusColors.P)
        }]
      },
      options: {
        scales: { y: { beginAtZero: true, max: 100 } }
      }
    });

    // Pie chart
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
        labels: Object.values(analyticsStatusNames),
        datasets: [{
          data: Object.keys(analyticsStatusNames).map(code => totals[code]),
          backgroundColor: Object.keys(analyticsStatusNames).map(code => analyticsStatusColors[code])
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

    if (analyticsDownloadMode === "combined") {
      const doc = new jspdf.jsPDF();
      const w = doc.internal.pageSize.getWidth();
      const { from, to } = lastAnalyticsRange;
      doc.setFontSize(18); doc.text("Attendance Analytics", 14, 16);
      doc.setFontSize(10); doc.text(`Period: ${from} to ${to}`, w - 14, 16, { align: "right" });
      doc.setFontSize(12); doc.text(document.getElementById("setupText").textContent, 14, 24);

      const tempTable = document.createElement("table");
      tempTable.innerHTML = `
        <tr>
          <th>#</th><th>Adm#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th><th>Outstanding</th><th>Status</th>
        </tr>
        ${lastAnalyticsStats.map((st,i) => {
          const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
          return `
            <tr>
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
            </tr>`;
        }).join("")}`;

      doc.autoTable({ startY: 30, html: tempTable });
      const fileName = `analytics_${lastAnalyticsRange.from}_to_${lastAnalyticsRange.to}.pdf`;
      const blob = doc.output("blob");
      doc.save(fileName);
      await sharePdf(blob, fileName, "Attendance Analytics");

    } else {
      const doc = new jspdf.jsPDF();
      const w = doc.internal.pageSize.getWidth();
      const { from, to } = lastAnalyticsRange;
      lastAnalyticsStats.forEach((st, i) => {
        if (i > 0) doc.addPage();
        doc.setFontSize(18);
        doc.text("Attendance Analytics (Individual Receipt)", 14, 16);
        doc.setFontSize(10);
        doc.text(`Period: ${from} to ${to}`, w - 14, 16, { align: "right" });
        doc.setFontSize(12);
        doc.text(document.getElementById("setupText").textContent, 14, 28);
        doc.setFontSize(14);
        doc.text(`Student: ${st.name}  (Adm#: ${st.adm})`, 14, 44);
        doc.setFontSize(12);
        doc.text(`Present   : ${st.P}`, 14, 60);
        doc.text(`Absent    : ${st.A}`, 80, 60);
        doc.text(`Late      : ${st.Lt}`, 14, 74);
        doc.text(`Half-Day  : ${st.HD}`, 80, 74);
        doc.text(`Leave     : ${st.L}`, 14, 88);
        doc.text(`Total Days Marked: ${st.total}`, 14, 102);
        const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
        doc.text(`Attendance %: ${pct}%`, 14, 116);
        doc.text(`Outstanding Fine: PKR ${st.outstanding}`, 14, 130);

        const fineRatesText =
          `Fine Rates:\n` +
          `  Absent   (PKR): ${fineRates.A}\n` +
          `  Late     (PKR): ${fineRates.Lt}\n` +
          `  Leave    (PKR): ${fineRates.L}\n` +
          `  Half-Day (PKR): ${fineRates.HD}\n` +
          `Eligibility ≥ ${eligibilityPct}%\n`;
        const blockStartY = 148;
        doc.setFontSize(11);
        fineRatesText.split("\n").forEach((ln, idx) => {
          doc.text(14, blockStartY + idx * 6, ln);
        });
        const signY = blockStartY + 6 * (fineRatesText.split("\n").length) + 10;
        doc.setFontSize(12);
        doc.text("_______________________________", 14, signY);
        doc.text("     HOD Signature", 14, signY + 8);
        const footerY = signY + 30;
        doc.setFontSize(10);
        doc.text("Receipt generated by Attendance Mgmt App", w - 14, footerY, { align: "right" });
      });
      const individualFileName = `analytics_individual_${lastAnalyticsRange.from}_to_${lastAnalyticsRange.to}.pdf`;
      const individualBlob = doc.output("blob");
      doc.save(individualFileName);
      await sharePdf(individualBlob, individualFileName, "Attendance Analytics (Receipt)");
    }
  };

  shareAnalyticsBtn.onclick = () => {
    if (!lastAnalyticsShare) { alert("Load analytics first"); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, "_blank");
  };


  // =============================================
  // 9) ATTENDANCE REGISTER LOGIC (UNCHANGED)
  // =============================================
  const loadRegisterBtn      = document.getElementById("loadRegister");
  const saveRegisterBtn      = document.getElementById("saveRegister");
  const changeRegisterBtn    = document.getElementById("changeRegister");
  const downloadRegisterBtn  = document.getElementById("downloadRegister");
  const shareRegisterBtn     = document.getElementById("shareRegister");
  const registerTableWrapper = document.getElementById("registerTableWrapper");
  const registerHeaderRow    = document.getElementById("registerHeader");
  const registerBodyTbody    = document.getElementById("registerBody");

  function bindRegisterActions() {
    downloadRegisterBtn.onclick = async () => {
      const doc = new jspdf.jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const today = new Date().toISOString().split("T")[0];
      doc.setFontSize(18); doc.text("Attendance Register", 14, 20);
      doc.setFontSize(10); doc.text(`Date: ${today}`, pageWidth - 14, 20, { align: "right" });
      doc.setFontSize(12); doc.text(document.getElementById("setupText").textContent, 14, 36);
      doc.autoTable({ startY: 60, html: "#registerTable", tableWidth: "auto", styles: { fontSize: 10 } });
      const blob = doc.output("blob");
      doc.save("attendance_register.pdf");
      await sharePdf(blob, "attendance_register.pdf", "Attendance Register");
    };

    shareRegisterBtn.onclick = () => {
      const header = `Attendance Register\n${document.getElementById("setupText").textContent}`;
      const rows = Array.from(registerBodyTbody.children).map(tr =>
        Array.from(tr.children).map(td => td.querySelector(".status-text")?.textContent || td.textContent).join(" ")
      );
      window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n" + rows.join("\n"))}`, "_blank");
    };
  }

  loadRegisterBtn.onclick = () => {
    const m = document.getElementById("registerMonth").value;
    if (!m) { alert("Pick month"); return; }
    const dateKeys = Object.keys(attendanceData).filter(d => d.startsWith(m + "-")).sort();
    if (!dateKeys.length) { alert("No attendance marked this month."); return; }

    registerHeaderRow.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` + dateKeys.map(k => `<th>${k.split("-")[2]}</th>`).join("");
    registerBodyTbody.innerHTML = "";

    const cl  = document.getElementById("teacherClassSelect").value;
    const sec = document.getElementById("teacherSectionSelect").value;
    students.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
      let row = `<td>${i + 1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      dateKeys.forEach(key => {
        const c = attendanceData[key][s.adm] || "";
        const color = c === "P" ? "var(--success)" : c === "Lt" ? "var(--warning)" : c === "HD" ? "#FF9800" : c === "L" ? "var(--info)" : "var(--danger)";
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
        const codes = ["","P","Lt","HD","L","A"];
        const idx = (codes.indexOf(span.textContent) + 1) % codes.length;
        const c = codes[idx];
        span.textContent = c;
        if (!c) {
          cell.style.background = "";
          cell.style.color = "";
        } else {
          const col = c === "P" ? "var(--success)" : c === "Lt" ? "var(--warning)" : c === "HD" ? "#FF9800" : c === "L" ? "var(--info)" : "var(--danger)";
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
    const m = document.getElementById("registerMonth").value;
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
    document.getElementById("registerHeader").innerHTML = "";
    document.getElementById("registerBody").innerHTML   = "";
    loadRegisterBtn.classList.remove("hidden");
  };

  bindRegisterActions();


  // =============================================
  // 10) BACKUP, RESTORE & RESET SECTION (UNCHANGED)
  // =============================================
  const chooseBackupFolderBtn = document.getElementById("chooseBackupFolder");
  const restoreDataBtn       = document.getElementById("restoreData");
  const restoreFileInput     = document.getElementById("restoreFile");
  const resetDataBtn         = document.getElementById("resetData");
  let backupHandle = null;

  chooseBackupFolderBtn.onclick = async () => {
    try {
      backupHandle = await window.showDirectoryPicker();
      alert("Backup folder selected.");
    } catch (err) {
      console.error(err);
      alert("Folder selection canceled or not supported.");
    }
  };

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
      const fileName = `backup_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"00")}-${String(now.getMinutes()).padStart(2,"00")}.json`;
      const fileHandle = await backupHandle.getFileHandle(fileName, { create: true });
      const writer = await fileHandle.createWritable();
      await writer.write(JSON.stringify(backupData, null, 2));
      await writer.close();
      console.log("🗄️ Backup written to folder:", fileName);
    } catch (err) {
      console.error("Backup failed:", err);
    }
  }, 5 * 60 * 1000);


  // =============================================
  // 11) UTILITY: Generate Admission Number (unchanged)
  // =============================================
  async function genAdmNo() {
    lastAdmNo++;
    lastAdmNoBySchool[currentSchool] = lastAdmNo;
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
    await syncToFirebase();
    return String(lastAdmNo).padStart(4, "0");
  }

  // =============================================
  // 12) RESET VIEWS UNTIL SETUP IS COMPLETE
  // =============================================
  function resetViews() {
    const setupDone = currentSchool && teacherClass && teacherSection;
    // List all major section IDs:
    const sectionIDs = [
      "financial-settings",
      "animatedCounters",
      "student-registration",
      "attendance-section",
      "analytics-section",
      "register-section",
      "backup-restore"
    ];
    sectionIDs.forEach(id => {
      const el = document.getElementById(id);
      if (!setupDone) {
        el && el.classList.add("hidden");
      } else {
        el && el.classList.remove("hidden");
      }
    });
  }
}
