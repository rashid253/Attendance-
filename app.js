// app.js
// ------------------------------------------------------
// Core Application Logic (all sections), with Auth integration:
//  0) Import Auth helpers (auth.js) + Firestore/Auth
//  1) Define showView(...) helper
//  2) Register onAuthStateChanged listener (switch views)
//  3) Handle login form submission & signup navigation
//  4) IndexedDB & Firebase Realtime DB initialization & syncing
//  5) Setup, Financial Settings, Counters, Student Registration, Attendance, Analytics, Register, Backup/Restore
// ------------------------------------------------------

// 0) Import Auth helpers (from auth.js) and Firebase Auth/Firestore calls:
import {
  auth,                    // Firebase Auth instance
  currentProfile,          // user’s Firestore profile data
  currentSchoolData,       // school’s Firestore data
  onAuthStateChanged,      // wrapper around firebase.auth().onAuthStateChanged
  signOut                  // to let both Owner and Teacher log out
} from "./auth.js";

import { signInWithEmailAndPassword } 
  from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// 1) showView(...) helper: hides all “.view” panels and #mainApp, then shows exactly one
function showView(viewEl) {
  document.querySelectorAll(".view, #mainApp").forEach(el => {
    if (el) el.classList.add("hidden");
  });
  if (viewEl) viewEl.classList.remove("hidden");
}

// 2) Register the Auth‐state listener.
//    If user is signed in, show mainApp; otherwise show login.
onAuthStateChanged((user, profile, schoolData) => {
  if (user) {
    // Show the main application UI
    showView(document.getElementById("mainApp"));

    // Optionally display user’s name somewhere:
    if (profile.role === "owner") {
      const ownerNameSpan = document.getElementById("ownerDisplayName");
      if (ownerNameSpan) ownerNameSpan.textContent = profile.name;
    } else {
      const teacherNameSpan = document.getElementById("teacherDisplayName");
      if (teacherNameSpan) teacherNameSpan.textContent = profile.name;
    }

    // Initialize application UI now that user is authenticated:
    initLocalState().then(() => {
      loadSetup();
      updateFinancialCard();
      // etc. any initial rendering
    });
  } else {
    // Not signed in → show login form
    showView(document.getElementById("loginContainer"));
  }
});

// 3) Handle login form submission & “Show Signup” button
document.addEventListener("DOMContentLoaded", () => {
  const loginForm       = document.getElementById("loginForm");
  const loginEmailInput = document.getElementById("loginEmail");
  const loginPwdInput   = document.getElementById("loginPassword");
  const loginErrorP     = document.getElementById("loginError");
  const showSignupBtn   = document.getElementById("showSignup");

  if (showSignupBtn) {
    showSignupBtn.addEventListener("click", () => {
      showView(document.getElementById("signupContainer"));
      // Reset signup steps to Step1
      showSignupStep(signupSteps.step1);
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (evt) => {
      evt.preventDefault();
      if (loginErrorP) loginErrorP.textContent = "";
      const email = loginEmailInput.value.trim();
      const pwd   = loginPwdInput.value;
      try {
        await signInWithEmailAndPassword(auth, email, pwd);
        loginEmailInput.value = "";
        loginPwdInput.value   = "";
        // onAuthStateChanged will fire automatically
      } catch (err) {
        console.error(err);
        if (loginErrorP) loginErrorP.textContent = "Invalid credentials.";
      }
    });
  }
});

// 4) IndexedDB & Firebase Realtime DB initialization and syncing
import { initializeApp } 
  from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  set as dbSet,
  onValue,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// IndexedDB helpers (idb-keyval IIFE must be loaded before this script)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// Firebase Realtime Database config (must match auth.js config)
const firebaseConfig = {
  apiKey: "AIzaSyBsx5pWhYGh1bJ9gL2bmC68gVc6EpICEzA",
  authDomain: "attandace-management.firebaseapp.com",
  projectId: "attandace-management",
  storageBucket: "attandace-management.appspot.com",
  messagingSenderId: "222685278846",
  appId: "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B",
  databaseURL: "https://attandace-management-default-rtdb.firebaseio.com"
};
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const appDataRef = dbRef(database, "appData");

// ----------------------
// Local application state
// ----------------------
let students       = [];    // Array of { name, adm, parent, contact, occupation, address, cls, sec }
let attendanceData = {};    // { "YYYY-MM-DD": { adm: "P"/"A"/"Lt"/"HD"/"L", ... } }
let paymentsData   = {};    // { adm: [ { date: "YYYY-MM-DD", amount: number }, ... ] }
let lastAdmNo      = 0;     // numeric, incrementing for new admission numbers
let fineRates      = { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct = 75;    // percentage threshold
let schools        = [];    // array of school names (strings)
let currentSchool  = null;  // selected school name
let teacherClass   = null;  // selected class (e.g. "10")
let teacherSection = null;  // selected section (e.g. "A")

// ----------------------
// 4a) Initialize state from IndexedDB
// ----------------------
async function initLocalState() {
  students       = (await idbGet("students"))       || [];
  attendanceData = (await idbGet("attendanceData")) || {};
  paymentsData   = (await idbGet("paymentsData"))   || {};
  lastAdmNo      = (await idbGet("lastAdmNo"))      || 0;
  fineRates      = (await idbGet("fineRates"))      || fineRates;
  eligibilityPct = (await idbGet("eligibilityPct")) || eligibilityPct;
  schools        = (await idbGet("schools"))        || [];
  currentSchool  = (await idbGet("currentSchool"))  || null;
  teacherClass   = (await idbGet("teacherClass"))   || null;
  teacherSection = (await idbGet("teacherSection")) || null;
}

// ----------------------
// 4b) Sync local state to Firebase Realtime DB
// ----------------------
async function syncToFirebase() {
  const payload = {
    students,
    attendanceData,
    paymentsData,
    lastAdmNo,
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

// ----------------------
// 4c) Listen to Firebase → update IndexedDB/UI
// ----------------------
onValue(appDataRef, async (snapshot) => {
  if (!snapshot.exists()) {
    // If no data, initialize defaults and push them
    const defaultPayload = {
      students: [],
      attendanceData: {},
      paymentsData: {},
      lastAdmNo: 0,
      fineRates: { A:50, Lt:20, L:10, HD:30 },
      eligibilityPct: 75,
      schools: [],
      currentSchool: null,
      teacherClass: null,
      teacherSection: null
    };
    await dbSet(appDataRef, defaultPayload);
    students       = [];
    attendanceData = {};
    paymentsData   = {};
    lastAdmNo      = 0;
    fineRates      = defaultPayload.fineRates;
    eligibilityPct = defaultPayload.eligibilityPct;
    schools        = [];
    currentSchool  = null;
    teacherClass   = null;
    teacherSection = null;
    await Promise.all([
      idbSet("students", students),
      idbSet("attendanceData", attendanceData),
      idbSet("paymentsData", paymentsData),
      idbSet("lastAdmNo", lastAdmNo),
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
  students       = data.students       || [];
  attendanceData = data.attendanceData || {};
  paymentsData   = data.paymentsData   || {};
  lastAdmNo      = data.lastAdmNo      || 0;
  fineRates      = data.fineRates      || { A:50, Lt:20, L:10, HD:30 };
  eligibilityPct = data.eligibilityPct || 75;
  schools        = data.schools        || [];
  currentSchool  = data.currentSchool  || null;
  teacherClass   = data.teacherClass   || null;
  teacherSection = data.teacherSection || null;

  await Promise.all([
    idbSet("students", students),
    idbSet("attendanceData", attendanceData),
    idbSet("paymentsData", paymentsData),
    idbSet("lastAdmNo", lastAdmNo),
    idbSet("fineRates", fineRates),
    idbSet("eligibilityPct", eligibilityPct),
    idbSet("schools", schools),
    idbSet("currentSchool", currentSchool),
    idbSet("teacherClass", teacherClass),
    idbSet("teacherSection", teacherSection),
  ]);
  await loadSetup();
  console.log("✅ Loaded data from Firebase into IndexedDB and UI");
});

// ----------------------
// 5) INITIAL LOAD: after DOMContentLoaded, call initLocalState + loadSetup
// ----------------------
window.addEventListener("DOMContentLoaded", async () => {
  await initLocalState();
  // If already authenticated, onAuthStateChanged callback will run loadSetup()
  // Otherwise, login view is shown.
});

// ----------------------
// 6) SETUP SECTION
// ----------------------
const setupForm      = document.getElementById("setupForm");
const setupDisplay   = document.getElementById("setupDisplay");
const schoolInput    = document.getElementById("schoolInput");
const schoolSelect   = document.getElementById("schoolSelect");
const classSelect    = document.getElementById("teacherClassSelect");
const sectionSelect  = document.getElementById("teacherSectionSelect");
const setupText      = document.getElementById("setupText");
const saveSetupBtn   = document.getElementById("saveSetup");
const editSetupBtn   = document.getElementById("editSetup");
const schoolListDiv  = document.getElementById("schoolList");

function renderSchoolList() {
  schoolListDiv.innerHTML = "";
  schools.forEach((sch, idx) => {
    const row = document.createElement("div");
    row.className = "row-inline";
    row.innerHTML = `
      <span>${sch}</span>
      <div>
        <button data-idx="${idx}" class="edit-school no-print"><i class="fas fa-edit"></i></button>
        <button data-idx="${idx}" class="delete-school no-print"><i class="fas fa-trash"></i></button>
      </div>`;
    schoolListDiv.appendChild(row);
  });
  document.querySelectorAll(".edit-school").forEach(btn => {
    btn.onclick = async () => {
      const idx = +btn.dataset.idx;
      const newName = prompt("Edit School Name:", schools[idx]);
      if (newName?.trim()) {
        schools[idx] = newName.trim();
        await idbSet("schools", schools);
        await syncToFirebase();
        await loadSetup();
      }
    };
  });
  document.querySelectorAll(".delete-school").forEach(btn => {
    btn.onclick = async () => {
      const idx = +btn.dataset.idx;
      if (!confirm(`Delete school "${schools[idx]}"?`)) return;
      const removed = schools.splice(idx, 1)[0];
      await idbSet("schools", schools);
      if (currentSchool === removed) {
        currentSchool = null;
        teacherClass = null;
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

async function loadSetup() {
  schools        = (await idbGet("schools")) || [];
  currentSchool  = await idbGet("currentSchool");
  teacherClass   = await idbGet("teacherClass");
  teacherSection = await idbGet("teacherSection");

  // Populate school dropdown
  if (schoolSelect) {
    schoolSelect.innerHTML = ['<option disabled selected>-- Select School --</option>',
      ...schools.map(s => `<option value="${s}">${s}</option>` )
    ].join("");
    if (currentSchool) schoolSelect.value = currentSchool;
  }

  renderSchoolList();

  if (currentSchool && teacherClass && teacherSection) {
    classSelect.value = teacherClass;
    sectionSelect.value = teacherSection;
    if (setupText) setupText.textContent = `${currentSchool} 🏫 | Class: ${teacherClass} | Section: ${teacherSection}`;
    hide(setupForm);
    show(setupDisplay);
    // Show main sections and update counters etc.
    renderStudents();
    updateFinancialCard();
    updateCounters();
  } else {
    // Setup incomplete: hide main sections
    show(setupForm);
    hide(setupDisplay);
    resetViews();
  }
}

if (saveSetupBtn) {
  saveSetupBtn.onclick = async (e) => {
    e.preventDefault();
    const newSchool = schoolInput.value.trim();
    if (newSchool) {
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
}

if (editSetupBtn) {
  editSetupBtn.onclick = (e) => {
    e.preventDefault();
    show(setupForm);
    hide(setupDisplay);
    resetViews();
  };
}

// ----------------------
// 7) FINANCIAL SETTINGS SECTION
// ----------------------
const fineAbsentInput     = document.getElementById("fineAbsent");
const fineLateInput       = document.getElementById("fineLate");
const fineLeaveInput      = document.getElementById("fineLeave");
const fineHalfDayInput    = document.getElementById("fineHalfDay");
const eligibilityPctInput = document.getElementById("eligibilityPct");
const saveSettings        = document.getElementById("saveSettings");
const settingsCard        = document.createElement("div");
const editSettings        = document.createElement("button");

if (saveSettings) {
  // Prepare the card and edit button
  settingsCard.id = "settingsCard";
  settingsCard.className = "card hidden";
  editSettings.id = "editSettings";
  editSettings.className = "btn no-print hidden";
  editSettings.textContent = "Edit Settings";
  saveSettings.parentNode.appendChild(settingsCard);
  saveSettings.parentNode.appendChild(editSettings);

  // Initial values
  fineAbsentInput.value     = fineRates.A;
  fineLateInput.value       = fineRates.Lt;
  fineLeaveInput.value      = fineRates.L;
  fineHalfDayInput.value    = fineRates.HD;
  eligibilityPctInput.value = eligibilityPct;

  saveSettings.onclick = async () => {
    fineRates = {
      A: Number(fineAbsentInput.value) || 0,
      Lt: Number(fineLateInput.value) || 0,
      L: Number(fineLeaveInput.value) || 0,
      HD: Number(fineHalfDayInput.value) || 0,
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
    hide(fineAbsentInput, fineLateInput, fineLeaveInput, fineHalfDayInput, eligibilityPctInput, saveSettings);
    show(settingsCard, editSettings);
  };

  editSettings.onclick = () => {
    hide(settingsCard, editSettings);
    show(fineAbsentInput, fineLateInput, fineLeaveInput, fineHalfDayInput, eligibilityPctInput, saveSettings);
  };
}

// Helper to update settings card if data already loaded
function updateFinancialCard() {
  if (settingsCard && !settingsCard.classList.contains("hidden")) {
    settingsCard.innerHTML = `
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
      </div>`;
  }
}

// ----------------------
// 8) COUNTERS SECTION
// ----------------------
const countersContainer = document.getElementById("countersContainer");
let sectionCountSpan, classCountSpan, schoolCountSpan, attendanceCountSpan, eligibleCountSpan, debarredCountSpan, outstandingCountSpan;

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
  return card;
}

function setupCounters() {
  if (!countersContainer) return;
  countersContainer.innerHTML = "";
  createCounterCard("card-section",       "Section",         "sectionCount");
  createCounterCard("card-class",         "Class",           "classCount");
  createCounterCard("card-school",        "School",          "schoolCount");
  createCounterCard("card-attendance",    "Attendance",      "attendanceCount");
  createCounterCard("card-eligible",      "Eligible",        "eligibleCount");
  createCounterCard("card-debarred",      "Debarred",        "debarredCount");
  createCounterCard("card-outstanding",   "Outstanding/Fine","outstandingCount");

  sectionCountSpan     = document.getElementById("sectionCount");
  classCountSpan       = document.getElementById("classCount");
  schoolCountSpan      = document.getElementById("schoolCount");
  attendanceCountSpan  = document.getElementById("attendanceCount");
  eligibleCountSpan    = document.getElementById("eligibleCount");
  debarredCountSpan    = document.getElementById("debarredCount");
  outstandingCountSpan = document.getElementById("outstandingCount");
}

function animateCounters() {
  document.querySelectorAll(".counter-card .card-number span").forEach(span => {
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
  if (!sectionCountSpan) return;
  const cl  = classSelect.value;
  const sec = sectionSelect.value;

  // Section: number of students in this class+section
  const sectionStudents = students.filter(s => s.cls === cl && s.sec === sec);
  sectionCountSpan.dataset.target = sectionStudents.length;

  // Class: number of students in this class (all sections)
  const classStudents = students.filter(s => s.cls === cl);
  classCountSpan.dataset.target = classStudents.length;

  // School: total students
  schoolCountSpan.dataset.target = students.length;

  // Attendance count (# of attendance entries for this class/section)
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

  // Eligible, Debarred, Outstanding
  let eligibleCount = 0, debarredCount = 0, outstandingCount = 0;
  students.forEach(s => {
    if (s.cls !== cl || s.sec !== sec) return;
    let p=0, a=0, lt=0, hd=0, l=0, totalDays=0;
    Object.entries(attendanceData).forEach(([date, rec]) => {
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

function bindCounterClicks() {
  document.getElementById("card-section").onclick = () => {
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    const list = students
      .filter(s => s.cls === cl && s.sec === sec)
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Class ${cl} Section ${sec}:\n\n${list || "No students found."}`);
  };

  document.getElementById("card-class").onclick = () => {
    const cl = classSelect.value;
    const list = students
      .filter(s => s.cls === cl)
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Class ${cl} (All Sections):\n\n${list || "No students found."}`);
  };

  document.getElementById("card-school").onclick = () => {
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

  document.getElementById("card-attendance").onclick = () => {
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    let totalP = 0, totalA = 0, totalLt = 0, totalHD = 0, totalL = 0;
    Object.entries(attendanceData).forEach(([date, rec]) => {
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

  document.getElementById("card-eligible").onclick = () => {
    const list = students
      .filter(s => {
        if (s.cls !== classSelect.value || s.sec !== sectionSelect.value) return false;
        let p=0, totalDays=0;
        Object.entries(attendanceData).forEach(([d, rec]) => {
          if (rec[s.adm]) {
            totalDays++;
            if (rec[s.adm] === "P") p++;
          }
        });
        const pct = totalDays ? (p / totalDays) * 100 : 0;
        let a=0, lt=0, l=0, hd=0;
        Object.entries(attendanceData).forEach(([d, rec]) => {
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

  document.getElementById("card-debarred").onclick = () => {
    const list = students
      .filter(s => {
        if (s.cls !== classSelect.value || s.sec !== sectionSelect.value) return false;
        let p=0, totalDays=0;
        Object.entries(attendanceData).forEach(([d, rec]) => {
          if (rec[s.adm]) {
            totalDays++;
            if (rec[s.adm] === "P") p++;
          }
        });
        const pct = totalDays ? (p / totalDays) * 100 : 0;
        let a=0, lt=0, l=0, hd=0;
        Object.entries(attendanceData).forEach(([d, rec]) => {
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

  document.getElementById("card-outstanding").onclick = () => {
    const list = students
      .filter(s => {
        if (s.cls !== classSelect.value || s.sec !== sectionSelect.value) return false;
        let a=0, lt=0, l=0, hd=0;
        Object.entries(attendanceData).forEach(([d, rec]) => {
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
        return fineTotal - paid > 0;
      })
      .map((s, i) => {
        let a=0, lt=0, l=0, hd=0;
        Object.entries(attendanceData).forEach(([d, rec]) => {
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
}

setupCounters();
bindCounterClicks();

// ----------------------
// 9) STUDENT REGISTRATION SECTION
// ----------------------
const studentsBody            = document.getElementById("studentsBody");
const selectAllStudents       = document.getElementById("selectAllStudents");
const editSelectedBtn         = document.getElementById("editSelected");
const doneEditingBtn          = document.getElementById("doneEditing");
const deleteSelectedBtn       = document.getElementById("deleteSelected");
const saveRegistrationBtn     = document.getElementById("saveRegistration");
const editRegistrationBtn     = document.getElementById("editRegistration");
const shareRegistrationBtn    = document.getElementById("shareRegistration");
const downloadRegistrationBtn = document.getElementById("downloadRegistrationPDF");

if (document.getElementById("addStudent")) {
  document.getElementById("addStudent").onclick = async (e) => {
    e.preventDefault();
    const n   = document.getElementById("studentName").value.trim();
    const p   = document.getElementById("parentName").value.trim();
    const c   = document.getElementById("parentContact").value.trim();
    const o   = document.getElementById("parentOccupation").value.trim();
    const a   = document.getElementById("parentAddress").value.trim();
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    if (!n || !p || !c || !o || !a) { alert("All fields required"); return; }
    if (!/^\d{7,15}$/.test(c)) { alert("Contact must be 7–15 digits"); return; }
    lastAdmNo++;
    await idbSet("lastAdmNo", lastAdmNo);
    const adm = String(lastAdmNo).padStart(4, "0");
    students.push({ name: n, adm, parent: p, contact: c, occupation: o, address: a, cls: cl, sec });
    await idbSet("students", students);
    await syncToFirebase();
    renderStudents();
    updateCounters();
    document.getElementById("studentName").value      = "";
    document.getElementById("parentName").value       = "";
    document.getElementById("parentContact").value    = "";
    document.getElementById("parentOccupation").value = "";
    document.getElementById("parentAddress").value    = "";
  };
}

function renderStudents() {
  const cl  = classSelect.value;
  const sec = sectionSelect.value;
  if (!studentsBody) return;
  studentsBody.innerHTML = "";
  let idx = 0;
  students.forEach((s, i) => {
    if (s.cls !== cl || s.sec !== sec) return;
    idx++;
    const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
    Object.entries(attendanceData).forEach(([_, rec]) => { if (rec[s.adm]) stats[rec[s.adm]]++; });
    const totalDays = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
    const fine  = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
    const paid  = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount, 0);
    const out   = fine - paid;
    const pct   = totalDays ? (stats.P/totalDays)*100 : 0;
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
      <td><button class="add-payment-btn no-print" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
    `;
    studentsBody.appendChild(tr);
  });
  if (selectAllStudents) selectAllStudents.checked = false;
  toggleButtons();
  document.querySelectorAll(".add-payment-btn").forEach(b => {
    b.onclick = () => openPaymentModal(b.dataset.adm);
  });
}

function toggleButtons() {
  const any = !!document.querySelector(".sel:checked");
  if (editSelectedBtn) editSelectedBtn.disabled   = !any;
  if (deleteSelectedBtn) deleteSelectedBtn.disabled = !any;
}

if (studentsBody) {
  studentsBody.addEventListener("change", e => {
    if (e.target.classList.contains("sel")) toggleButtons();
  });
}
if (selectAllStudents) {
  selectAllStudents.onclick = () => {
    document.querySelectorAll(".sel").forEach(c => c.checked = selectAllStudents.checked);
    toggleButtons();
  };
}

if (editSelectedBtn) {
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
    hide(editSelectedBtn, deleteSelectedBtn);
    show(doneEditingBtn);
  };
}

if (doneEditingBtn) {
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
    await idbSet("students", students);
    await syncToFirebase();
    hide(doneEditingBtn);
    show(editSelectedBtn, deleteSelectedBtn, saveRegistrationBtn);
    renderStudents();
    updateCounters();
  };
}

if (deleteSelectedBtn) {
  deleteSelectedBtn.onclick = async () => {
    if (!confirm("Delete selected students?")) return;
    const toDel = [...document.querySelectorAll(".sel:checked")].map(cb => +cb.closest("tr").dataset.index);
    students = students.filter((_, i) => !toDel.includes(i));
    await idbSet("students", students);
    await syncToFirebase();
    renderStudents();
    updateCounters();
  };
}

if (saveRegistrationBtn) {
  saveRegistrationBtn.onclick = async () => {
    if (!doneEditingBtn.classList.contains("hidden")) { alert("Finish editing before saving."); return; }
    await idbSet("students", students);
    await syncToFirebase();
    hide(document.querySelector("#student-registration .row-inline"), editSelectedBtn, deleteSelectedBtn, selectAllStudents, saveRegistrationBtn);
    show(editRegistrationBtn, shareRegistrationBtn, downloadRegistrationBtn);
    renderStudents();
    updateCounters();
  };
}

if (editRegistrationBtn) {
  editRegistrationBtn.onclick = () => {
    show(document.querySelector("#student-registration .row-inline"), selectAllStudents, editSelectedBtn, deleteSelectedBtn, saveRegistrationBtn);
    hide(editRegistrationBtn, shareRegistrationBtn, downloadRegistrationBtn);
    renderStudents();
    updateCounters();
  };
}

// ----------------------
// 10) PAYMENT MODAL SECTION
// ----------------------
const paymentModal         = document.getElementById("paymentModal");
const payAdmSpan           = document.getElementById("payAdm");
const paymentAmountInput   = document.getElementById("paymentAmount");
const paymentModalCloseBtn = document.getElementById("paymentModalClose");
const savePaymentBtn       = document.getElementById("savePayment");
const cancelPaymentBtn     = document.getElementById("cancelPayment");

function openPaymentModal(adm) {
  if (!paymentModal) return;
  payAdmSpan.textContent = adm;
  paymentAmountInput.value = "";
  show(paymentModal);
}
if (paymentModalCloseBtn) paymentModalCloseBtn.onclick = () => hide(paymentModal);
if (savePaymentBtn) {
  savePaymentBtn.onclick = async () => {
    const adm = payAdmSpan.textContent;
    const amt = Number(paymentAmountInput.value) || 0;
    paymentsData[adm] = paymentsData[adm] || [];
    paymentsData[adm].push({ date: new Date().toISOString().split("T")[0], amount: amt });
    await idbSet("paymentsData", paymentsData);
    await syncToFirebase();
    hide(paymentModal);
    renderStudents();
    updateCounters();
  };
}
if (cancelPaymentBtn) cancelPaymentBtn.onclick = () => hide(paymentModal);

// ----------------------
// 11) MARK ATTENDANCE SECTION
// ----------------------
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

if (loadAttendanceBtn) {
  loadAttendanceBtn.onclick = () => {
    if (!attendanceBodyDiv) return;
    attendanceBodyDiv.innerHTML = "";
    if (attendanceSummaryDiv) attendanceSummaryDiv.innerHTML = "";
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
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
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };
}

if (saveAttendanceBtn) {
  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert("Pick date"); return; }
    attendanceData[date] = {};
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    students.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
      const selBtn = attendanceBodyDiv.children[i].querySelector(".att-btn.selected");
      attendanceData[date][s.adm] = selBtn ? selBtn.textContent : "A";
    });
    await idbSet("attendanceData", attendanceData);
    await syncToFirebase();
    console.log("✅ Attendance data synced to Firebase");

    if (!attendanceSummaryDiv) return;
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

    hide(attendanceBodyDiv, saveAttendanceBtn);
    show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
    updateCounters();
  };
}

if (resetAttendanceBtn) {
  resetAttendanceBtn.onclick = () => {
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };
}

if (downloadAttendanceBtn) {
  downloadAttendanceBtn.onclick = async () => {
    const { jsPDF } = jspdf; // from jspdf.umd
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split("T")[0];
    doc.setFontSize(18); doc.text("Attendance Report", 14, 16);
    doc.setFontSize(10); doc.text(`Date: ${today}`, w - 14, 16, { align: "right" });
    doc.setFontSize(12); doc.text(setupText.textContent, 14, 24);
    doc.autoTable({ startY: 30, html: "#attendanceSummaryTable" });
    const fileName = `attendance_${dateInput.value}.pdf`;
    const blob = doc.output("blob");
    doc.save(fileName);
    await sharePdf(blob, fileName, "Attendance Report");
  };
}

if (shareAttendanceBtn) {
  shareAttendanceBtn.onclick = () => {
    const cl   = classSelect.value;
    const sec  = sectionSelect.value;
    const date = dateInput.value;
    const header = `*Attendance Report*\nClass ${cl} Sec ${sec} - ${date}`;
    const lines = students.filter(s => s.cls === cl && s.sec === sec)
      .map((s, i) => `${i + 1}. ${s.name} (Adm#: ${s.adm}): ${statusNames[attendanceData[date][s.adm]]}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n\n" + lines.join("\n"))}`, "_blank");
  };
}

// ----------------------
// 12) ANALYTICS SECTION
// ----------------------
const atg                  = document.getElementById("analyticsTarget");
const aselection           = document.getElementById("analyticsSectionSelect");
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
let analyticsStatusColors;

let analyticsFilterOptions = ["all"];
let analyticsDownloadMode  = "combined";
let lastAnalyticsStats     = [];
let lastAnalyticsRange     = { from: null, to: null };
let lastAnalyticsShare     = "";

if (document.getElementById("analyticsFilterBtn")) {
  document.getElementById("analyticsFilterBtn").onclick = () => show(document.getElementById("analyticsFilterModal"));
}
if (document.getElementById("analyticsFilterClose")) {
  document.getElementById("analyticsFilterClose").onclick = () => hide(document.getElementById("analyticsFilterModal"));
}
if (document.getElementById("applyAnalyticsFilter")) {
  document.getElementById("applyAnalyticsFilter").onclick = () => {
    analyticsFilterOptions = Array.from(document.querySelectorAll("#analyticsFilterForm input[type='checkbox']:checked")).map(cb => cb.value) || ["all"];
    analyticsDownloadMode = document.querySelector("#analyticsFilterForm input[name='downloadMode']:checked").value;
    hide(document.getElementById("analyticsFilterModal"));
    if (lastAnalyticsStats.length) {
      renderAnalytics(lastAnalyticsStats, lastAnalyticsRange.from, lastAnalyticsRange.to);
    }
  };
}

if (atg) {
  atg.onchange = () => {
    atype.disabled = false;
    if (aselection) aselection.classList.add("hidden");
    if (asearchInput) asearchInput.classList.add("hidden");
    if (instructionsDiv) instructionsDiv.classList.add("hidden");
    if (analyticsContainer) analyticsContainer.classList.add("hidden");
    if (graphsDiv) graphsDiv.classList.add("hidden");
    if (analyticsActionsDiv) analyticsActionsDiv.classList.add("hidden");
    if (atg.value === "section" && aselection) aselection.classList.remove("hidden");
    if (atg.value === "student" && asearchInput) asearchInput.classList.remove("hidden");
  };
}

if (atype) {
  atype.onchange = () => {
    [adateInput, amonthInput, semsInput, semeInput, ayearInput].forEach(x => { if (x) x.classList.add("hidden"); });
    [instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv].forEach(x => { if (x) x.classList.add("hidden"); });
    if (resetAnalyticsBtn) resetAnalyticsBtn.classList.remove("hidden");
    switch (atype.value) {
      case "date":
        if (adateInput) adateInput.classList.remove("hidden");
        break;
      case "month":
        if (amonthInput) amonthInput.classList.remove("hidden");
        break;
      case "semester":
        if (semsInput) semsInput.classList.remove("hidden");
        if (semeInput) semeInput.classList.remove("hidden");
        break;
      case "year":
        if (ayearInput) ayearInput.classList.remove("hidden");
        break;
    }
  };
}

if (resetAnalyticsBtn) {
  resetAnalyticsBtn.onclick = (e) => {
    e.preventDefault();
    if (atype) atype.value = "";
    [adateInput, amonthInput, semsInput, semeInput, ayearInput, instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv].forEach(x => { if (x) x.classList.add("hidden"); });
    resetAnalyticsBtn.classList.add("hidden");
  };
}

if (loadAnalyticsBtn) {
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

    const cls = classSelect.value;
    const sec = sectionSelect.value;
    let pool = students.filter(s => s.cls === cls && s.sec === sec);
    if (atg.value === "section") {
      pool = pool.filter(s => s.sec === aselection.value);
    }
    if (atg.value === "student") {
      const q = asearchInput.value.trim().toLowerCase();
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
    analyticsStatusColors = {
      P: getComputedStyle(document.documentElement).getPropertyValue("--success").trim() || "#4caf50",
      A: getComputedStyle(document.documentElement).getPropertyValue("--danger").trim()  || "#f44336",
      Lt: getComputedStyle(document.documentElement).getPropertyValue("--warning").trim() || "#ffeb3b",
      HD: "#FF9800",
      L: getComputedStyle(document.documentElement).getPropertyValue("--info").trim()     || "#2196f3"
    };
    renderAnalytics(stats, from, to);
  };
}

function renderAnalytics(stats, from, to) {
  // Filter stats
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

  // Build HTML table
  const theadRow = document.querySelector("#analyticsTable thead tr");
  theadRow.innerHTML = [
    "#", "Adm#", "Name", "P", "A", "Lt", "HD", "L", "Total", "%", "Outstanding", "Status"
  ].map(h => `<th>${h}</th>`).join("");

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

  // Show analytics section
  document.getElementById("instructions").textContent = `Period: ${from} to ${to}`;
  showView(instructionsDiv);
  showView(analyticsContainer);
  showView(graphsDiv);
  showView(analyticsActionsDiv);

  // Bar chart: % Present
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

  // Pie chart: distribution of statuses
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

  // Prepare share text
  lastAnalyticsShare =
    `Attendance Analytics (${from} to ${to})\n` +
    filtered.map((st, i) => {
      const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
      return `${i + 1}. ${st.adm} ${st.name}: ${pct}% / PKR ${st.outstanding}`;
    }).join("\n");
}

if (downloadAnalyticsBtn) {
  downloadAnalyticsBtn.onclick = async () => {
    if (!lastAnalyticsStats.length) { alert("Load analytics first"); return; }

    const { jsPDF } = jspdf; // from jspdf.umd
    if (analyticsDownloadMode === "combined") {
      const doc = new jsPDF();
      const w = doc.internal.pageSize.getWidth();
      const { from, to } = lastAnalyticsRange;
      doc.setFontSize(18); doc.text("Attendance Analytics", 14, 16);
      doc.setFontSize(10); doc.text(`Period: ${from} to ${to}`, w - 14, 16, { align: "right" });
      doc.setFontSize(12); doc.text(setupText.textContent, 14, 24);

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
      const stats = lastAnalyticsStats;
      for (let i = 0; i < stats.length; i++) {
        if (i > 0) doc.addPage();
        const st = stats[i];
        doc.setFontSize(18);
        doc.text("Attendance Analytics (Individual Receipt)", 14, 16);
        doc.setFontSize(10);
        doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, w - 14, 16, { align: "right" });
        doc.setFontSize(12);
        doc.text(setupText.textContent, 14, 28);
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
      }
      const individualFileName = `analytics_individual_${lastAnalyticsRange.from}_to_${lastAnalyticsRange.to}.pdf`;
      const individualBlob = doc.output("blob");
      doc.save(individualFileName);
      await sharePdf(individualBlob, individualFileName, "Attendance Analytics (Receipt)");
    }
  };
}

if (shareAnalyticsBtn) {
  shareAnalyticsBtn.onclick = () => {
    if (!lastAnalyticsShare) { alert("Load analytics first"); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, "_blank");
  };
}

// ----------------------
// 13) ATTENDANCE REGISTER SECTION
// ----------------------
const loadRegisterBtn      = document.getElementById("loadRegister");
const saveRegisterBtn      = document.getElementById("saveRegister");
const changeRegisterBtn    = document.getElementById("changeRegister");
const downloadRegisterBtn  = document.getElementById("downloadRegister");
const shareRegisterBtn     = document.getElementById("shareRegister");
const registerTableWrapper = document.getElementById("registerTableWrapper");
const registerHeaderRow    = document.getElementById("registerHeader");
const registerBodyTbody    = document.getElementById("registerBody");

function bindRegisterActions() {
  if (downloadRegisterBtn) {
    downloadRegisterBtn.onclick = async () => {
      const { jsPDF } = jspdf;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const today = new Date().toISOString().split("T")[0];
      doc.setFontSize(18); doc.text("Attendance Register", 14, 20);
      doc.setFontSize(10); doc.text(`Date: ${today}`, pageWidth - 14, 20, { align: "right" });
      doc.setFontSize(12); doc.text(setupText.textContent, 14, 36);
      doc.autoTable({ startY: 60, html: "#registerTable", tableWidth: "auto", styles: { fontSize: 10 } });
      const blob = doc.output("blob");
      doc.save("attendance_register.pdf");
      await sharePdf(blob, "attendance_register.pdf", "Attendance Register");
    };
  }

  if (shareRegisterBtn) {
    shareRegisterBtn.onclick = () => {
      const header = `Attendance Register\n${setupText.textContent}`;
      const rows = Array.from(registerBodyTbody.children).map(tr =>
        Array.from(tr.children).map(td => td.querySelector(".status-text")?.textContent || td.textContent).join(" ")
      );
      window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n" + rows.join("\n"))}`, "_blank");
    };
  }
}

if (loadRegisterBtn) {
  loadRegisterBtn.onclick = () => {
    const m = document.getElementById("registerMonth").value;
    if (!m) { alert("Pick month"); return; }
    const dateKeys = Object.keys(attendanceData).filter(d => d.startsWith(m + "-")).sort();
    if (!dateKeys.length) { alert("No attendance marked this month."); return; }

    registerHeaderRow.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` + dateKeys.map(k => `<th>${k.split("-")[2]}</th>`).join("");
    registerBodyTbody.innerHTML = "";

    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    students.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
      let row = `<td>${i + 1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      dateKeys.forEach((key, idx) => {
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

    show(registerTableWrapper, saveRegisterBtn);
    hide(loadRegisterBtn, changeRegisterBtn, downloadRegisterBtn, shareRegisterBtn);
  };
}

if (saveRegisterBtn) {
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
    await idbSet("attendanceData", attendanceData);
    await syncToFirebase();
    hide(saveRegisterBtn);
    show(changeRegisterBtn, downloadRegisterBtn, shareRegisterBtn);
    bindRegisterActions();
    updateCounters();
  };
}

if (changeRegisterBtn) {
  changeRegisterBtn.onclick = () => {
    hide(registerTableWrapper, changeRegisterBtn, downloadRegisterBtn, shareRegisterBtn, saveRegisterBtn);
    registerHeaderRow.innerHTML = "";
    registerBodyTbody.innerHTML = "";
    show(loadRegisterBtn);
  };
}

bindRegisterActions();

// ----------------------
// 14) BACKUP, RESTORE & RESET SECTION
// ----------------------
const chooseBackupFolderBtn = document.getElementById("chooseBackupFolder");
const restoreDataBtn        = document.getElementById("restoreData");
const restoreFileInput      = document.getElementById("restoreFile");
const resetDataBtn          = document.getElementById("resetData");
let backupHandle = null;

if (chooseBackupFolderBtn) {
  chooseBackupFolderBtn.onclick = async () => {
    try {
      backupHandle = await window.showDirectoryPicker();
      alert("Backup folder selected.");
    } catch (err) {
      console.error(err);
      alert("Folder selection canceled or not supported.");
    }
  };
}

if (restoreDataBtn) {
  restoreDataBtn.onclick = () => restoreFileInput.click();
}
if (restoreFileInput) {
  restoreFileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      students       = data.students       || [];
      attendanceData = data.attendanceData || {};
      paymentsData   = data.paymentsData   || {};
      lastAdmNo      = data.lastAdmNo      || 0;
      fineRates      = data.fineRates      || { A:50, Lt:20, L:10, HD:30 };
      eligibilityPct = data.eligibilityPct || 75;
      schools        = data.schools        || [];
      currentSchool  = data.currentSchool  || null;
      teacherClass   = data.teacherClass   || null;
      teacherSection = data.teacherSection || null;

      await Promise.all([
        idbSet("students", students),
        idbSet("attendanceData", attendanceData),
        idbSet("paymentsData", paymentsData),
        idbSet("lastAdmNo", lastAdmNo),
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
}

if (resetDataBtn) {
  resetDataBtn.onclick = async () => {
    if (!confirm("Factory reset will delete ALL data locally and in Firebase. Continue?")) return;
    await idbClear();
    students       = [];
    attendanceData = {};
    paymentsData   = {};
    lastAdmNo      = 0;
    fineRates      = { A:50, Lt:20, L:10, HD:30 };
    eligibilityPct = 75;
    schools        = [];
    currentSchool  = null;
    teacherClass   = null;
    teacherSection = null;
    await syncToFirebase();
    await loadSetup();
    alert("Factory reset completed.");
  };
}

// Automatic periodic backup to the selected folder (every 5 minutes)
setInterval(async () => {
  if (!backupHandle) return;
  try {
    const backupData = {
      students,
      attendanceData,
      paymentsData,
      lastAdmNo,
      fineRates,
      eligibilityPct,
      schools,
      currentSchool,
      teacherClass,
      teacherSection,
    };
    const now = new Date();
    const fileName = `backup_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}-${String(now.getMinutes()).padStart(2,"0")}.json`;
    const fileHandle = await backupHandle.getFileHandle(fileName,{ create:true });
    const writer = await fileHandle.createWritable();
    await writer.write(JSON.stringify(backupData, null, 2));
    await writer.close();
    console.log("🗄️ Backup written to folder:", fileName);
  } catch (err) {
    console.error("Backup failed:", err);
  }
}, 5 * 60 * 1000); // every 5 minutes

// ----------------------
// 15) SERVICE WORKER REGISTRATION
// ----------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js", { type: "module" })
      .then(reg => console.log("Service Worker registered as module:", reg))
      .catch(err => console.error("SW registration failed:", err));
  });
}

// ----------------------
// 16) GLOBAL UTILITY: hide/show multiple elements
// ----------------------
function hide(...els) { els.forEach(e => { if (e) e.classList.add("hidden"); }); }
function show(...els) { els.forEach(e => { if (e) e.classList.remove("hidden"); }); }

// ----------------------
// 17) SIGNUP WIZARD LOGIC (Owner/Admin)
// ----------------------
const ownerNameInput     = document.getElementById("ownerName");
const ownerEmailInput    = document.getElementById("ownerEmail");
const ownerPasswordInput = document.getElementById("ownerPassword");
const instituteNameInput = document.getElementById("instituteName");
const branchesContainer  = document.getElementById("branchesContainer");
const classesContainer   = document.getElementById("classesContainer");
const sectionsContainer  = document.getElementById("sectionsContainer");
const signupErrorP       = document.getElementById("signupError");

const toStep2Btn     = document.getElementById("toStep2");
const backToStep1Btn = document.getElementById("backToStep1");
const toStep3Btn     = document.getElementById("toStep3");
const backToStep2Btn = document.getElementById("backToStep2");
const toStep4Btn     = document.getElementById("toStep4");
const backToStep3Btn = document.getElementById("backToStep3");
const signupFinishBtn= document.getElementById("signupFinish");

const signupSteps = {
  step1: document.getElementById("signupStep1"),
  step2: document.getElementById("signupStep2"),
  step3: document.getElementById("signupStep3"),
  step4: document.getElementById("signupStep4"),
};

let signupData = {
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  instituteName: "",
  branches: [],
  classes: [],
  sections: {}
};

function showSignupStep(stepEl) {
  Object.values(signupSteps).forEach(s => s.classList.add("hidden"));
  stepEl.classList.remove("hidden");
}

function clearError(el) {
  if (el) el.textContent = "";
}
function showError(el, msg) {
  if (el) el.textContent = msg;
}

// Auto‐expand “branches” and “classes” inputs:
function setupAutoExpand(containerDiv) {
  if (!containerDiv) return;
  containerDiv.addEventListener("input", (evt) => {
    const inputListDiv = evt.currentTarget.querySelector(".auto-list");
    const inputs = Array.from(inputListDiv.querySelectorAll(".auto-input"));
    const last = inputs[inputs.length - 1];
    if (last.value.trim() !== "") {
      const newInput = last.cloneNode();
      newInput.value = "";
      newInput.placeholder = last.placeholder;
      inputListDiv.appendChild(newInput);
    }
  });
}

function collectAutoList(containerDiv) {
  if (!containerDiv) return [];
  const inputs = Array.from(containerDiv.querySelectorAll(".auto-input"));
  return inputs.map(i => i.value.trim()).filter(v => v !== "");
}

// Step1 → Step2
if (toStep2Btn) {
  toStep2Btn.addEventListener("click", () => {
    clearError(signupErrorP);
    const name  = ownerNameInput.value.trim();
    const email = ownerEmailInput.value.trim();
    const pwd   = ownerPasswordInput.value;
    if (!name || !email || !pwd) {
      showError(signupErrorP, "All fields are required.");
      return;
    }
    signupData.ownerName     = name;
    signupData.ownerEmail    = email;
    signupData.ownerPassword = pwd;
    showSignupStep(signupSteps.step2);
  });
}
if (backToStep1Btn) {
  backToStep1Btn.addEventListener("click", () => {
    clearError(signupErrorP);
    showSignupStep(signupSteps.step1);
  });
}

// Step2 → Step3
if (toStep3Btn) {
  toStep3Btn.addEventListener("click", () => {
    clearError(signupErrorP);
    const inst     = instituteNameInput.value.trim();
    const branches = collectAutoList(branchesContainer);
    if (!inst) {
      showError(signupErrorP, "Institute name is required.");
      return;
    }
    if (branches.length === 0) {
      showError(signupErrorP, "At least one branch is required.");
      return;
    }
    signupData.instituteName = inst;
    signupData.branches      = branches;
    showSignupStep(signupSteps.step3);
  });
}
if (backToStep2Btn) {
  backToStep2Btn.addEventListener("click", () => {
    clearError(signupErrorP);
    showSignupStep(signupSteps.step2);
  });
}

// Step3 → Step4
if (toStep4Btn) {
  toStep4Btn.addEventListener("click", () => {
    clearError(signupErrorP);
    const classes = collectAutoList(classesContainer);
    if (classes.length === 0) {
      showError(signupErrorP, "At least one class is required.");
      return;
    }
    signupData.classes = classes;
    // Build “sections per class” blocks:
    sectionsContainer.innerHTML = "";
    signupData.sections = {};
    classes.forEach(cls => {
      const wrapper = document.createElement("div");
      wrapper.className = "class-section-block";
      wrapper.innerHTML = `
        <p><strong>${cls}</strong> – Sections:</p>
        <div class="auto-list">
          <input type="text" class="auto-input" placeholder="Section name (e.g. A)" required />
        </div>
      `;
      sectionsContainer.appendChild(wrapper);
      const autoListDiv = wrapper.querySelector(".auto-list");
      autoListDiv.addEventListener("input", (evt) => {
        const inputs = Array.from(evt.currentTarget.querySelectorAll(".auto-input"));
        const last = inputs[inputs.length - 1];
        if (last.value.trim() !== "") {
          const newInp = last.cloneNode();
          newInp.value = "";
          newInp.placeholder = last.placeholder;
          evt.currentTarget.appendChild(newInp);
        }
      });
    });
    showSignupStep(signupSteps.step4);
  });
}
if (backToStep3Btn) {
  backToStep3Btn.addEventListener("click", () => {
    clearError(signupErrorP);
    showSignupStep(signupSteps.step3);
  });
}

// Finish Signup (create Firebase Auth user + Firestore docs)
if (signupFinishBtn) {
  signupFinishBtn.addEventListener("click", async () => {
    clearError(signupErrorP);
    // Collect sections for each class
    const clsBlocks = Array.from(sectionsContainer.querySelectorAll(".class-section-block"));
    let valid = true;
    clsBlocks.forEach(block => {
      const clsName = block.querySelector("p strong").textContent;
      const secs = Array.from(block.querySelectorAll(".auto-input"))
        .map(i => i.value.trim())
        .filter(v => v !== "");
      if (secs.length === 0) valid = false;
      signupData.sections[clsName] = secs;
    });
    if (!valid) {
      showError(signupErrorP, "Each class must have at least one section.");
      return;
    }

    try {
      // Create Auth user (owner)
      const userCred = await createUserWithEmailAndPassword(
        auth,
        signupData.ownerEmail,
        signupData.ownerPassword
      );
      const uid = userCred.user.uid;

      // Create Firestore: schools/{uid}
      const { setDoc, doc: fsDoc } = await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js");
      await setDoc(fsDoc(db, "schools", uid), {
        name: signupData.instituteName,
        branches: signupData.branches,
        classes: signupData.classes,
        sections: signupData.sections,
        createdAt: new Date()
      });

      // Create Firestore: users/{uid}
      await setDoc(fsDoc(db, "users", uid), {
        name: signupData.ownerName,
        email: signupData.ownerEmail,
        role: "owner",
        schoolId: uid,
        assigned: [],
        createdAt: new Date()
      });

      // Clear all signup fields
      ownerNameInput.value     = "";
      ownerEmailInput.value    = "";
      ownerPasswordInput.value = "";
      instituteNameInput.value = "";
      branchesContainer.querySelector(".auto-list").innerHTML = `<input type="text" class="auto-input" placeholder="Branch name" />`;
      classesContainer.querySelector(".auto-list").innerHTML  = `<input type="text" class="auto-input" placeholder="Class name" />`;
      sectionsContainer.innerHTML = "";

      // Switch to Login view
      showView(document.getElementById("loginContainer"));
      alert("Signup successful! Please log in.");
    } catch (err) {
      console.error(err);
      showError(signupErrorP, err.message);
    }
  });
}

// Initialize auto‐expand on Step2 & Step3
setupAutoExpand(branchesContainer);
setupAutoExpand(classesContainer);
// Initially show Step1 on signup view
showSignupStep(signupSteps.step1);

// ----------------------
// Utilities
// ----------------------
async function sharePdf(blob, fileName, title) {
  if (
    navigator.canShare &&
    navigator.canShare({ files: [new File([blob], fileName, { type: "application/pdf" })] })
  ) {
    try {
      await navigator.share({ title, files: [new File([blob], fileName, { type: "application/pdf" })] });
    } catch (err) {
      if (err.name !== "AbortError") console.error("Share failed", err);
    }
  }
}

function resetViews() {
  // Hide all main sections (except setup) when reconfiguring
  const sections = document.querySelectorAll("#financial-settings, #animatedCounters, #student-registration, #attendance-section, #analytics-section, #register-section");
  sections.forEach(s => s.classList.add("hidden"));
  hide(settingsCard, editSettings);
}

