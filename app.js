// app.js

// ---------------------------------------------
// 1. IMPORTS
// ---------------------------------------------
import {
  auth,
  database,
  dbRef,
  dbSet,
  dbGet,
  dbOnValue,
  dbPush,
  dbChild,
  dbRemove
} from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// IndexedDB helpers (idb-keyval IIFE)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// ---------------------------------------------
// 2. FIREBASE REFERENCES
// ---------------------------------------------
const appDataRef = dbRef(database, "appData");

// ---------------------------------------------
// 3. GLOBAL STATE VARIABLES
// ---------------------------------------------
let studentsBySchool       = {};
let attendanceDataBySchool = {};
let paymentsDataBySchool   = {};
let lastAdmNoBySchool      = {};
let fineRates              = { A: 50, Lt: 20, L: 10, HD: 30 };
let eligibilityPct         = 75;
let schools                = [];
let currentSchool          = null;
let teacherClass           = null;
let teacherSection         = null;

let students       = [];
let attendanceData = {};
let paymentsData   = {};
let lastAdmNo      = 0;
let currentProfile = null;

// ---------------------------------------------
// 4. UTILITY FUNCTIONS
// ---------------------------------------------
function $(id) {
  return document.getElementById(id);
}

function hide(...els) {
  els.forEach(e => e && e.classList.add("hidden"));
}
function show(...els) {
  els.forEach(e => e && e.classList.remove("hidden"));
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
    await dbSet(appDataRef, payload);
    console.log("✅ Synced to Firebase");
  } catch (err) {
    console.error("Sync failed:", err);
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

async function initLocalState() {
  studentsBySchool       = (await idbGet("studentsBySchool"))       || studentsBySchool;
  attendanceDataBySchool = (await idbGet("attendanceDataBySchool")) || attendanceDataBySchool;
  paymentsDataBySchool   = (await idbGet("paymentsDataBySchool"))   || paymentsDataBySchool;
  lastAdmNoBySchool      = (await idbGet("lastAdmNoBySchool"))      || lastAdmNoBySchool;
  fineRates              = (await idbGet("fineRates"))              || fineRates;
  eligibilityPct         = (await idbGet("eligibilityPct"))         ?? eligibilityPct;
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

async function genAdmNo() {
  lastAdmNo++;
  lastAdmNoBySchool[currentSchool] = lastAdmNo;
  await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
  await syncToFirebase();
  return String(lastAdmNo).padStart(4, "0");
}

// ---------------------------------------------
// 5. AUTHENTICATION / SIGNUP-LOGIN LOGIC
// ---------------------------------------------
let isLoginMode = true;

const authContainer         = $("auth-container");
const mainApp               = $("main-app");
const emailInput            = $("emailInput");
const passwordInput         = $("passwordInput");
const authButton            = $("authButton");
const formTitle             = $("form-title");
const toggleAuth            = $("toggleAuth");
const signupExtra           = $("signup-extra");
const roleSelect            = $("roleSelect");
const displayNameInput      = $("displayNameInput");
const schoolRegisterSelect  = $("schoolRegisterSelect");
const classRegisterSelect   = $("classRegisterSelect");
const sectionRegisterSelect = $("sectionRegisterSelect");

toggleAuth.addEventListener("click", () => {
  isLoginMode = !isLoginMode;
  if (isLoginMode) {
    formTitle.innerText    = "Login to Attendance App";
    authButton.innerText   = "Login";
    toggleAuth.innerText   = "Don't have an account? Sign Up";
    signupExtra.classList.add("hidden");
  } else {
    formTitle.innerText    = "Sign Up for Attendance App";
    authButton.innerText   = "Sign Up";
    toggleAuth.innerText   = "Already have an account? Login";
    signupExtra.classList.remove("hidden");
  }
});

roleSelect.onchange = () => {
  if (roleSelect.value === "teacher") {
    classRegisterSelect.classList.remove("hidden");
    sectionRegisterSelect.classList.remove("hidden");
  } else {
    classRegisterSelect.classList.add("hidden");
    sectionRegisterSelect.classList.add("hidden");
  }
};

authButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const pass  = passwordInput.value.trim();

  if (!email || !pass) {
    alert("Please enter both Email and Password.");
    return;
  }

  if (isLoginMode) {
    // ------ LOGIN ------
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle next steps
    } catch (err) {
      console.error("Login error:", err);
      alert("Login failed: " + err.message);
    }
  } else {
    // ------ SIGN UP ------
    const displayName = displayNameInput.value.trim();
    const role        = roleSelect.value;
    const schoolSel   = schoolRegisterSelect.value;
    const cls         = classRegisterSelect.value;
    const sec         = sectionRegisterSelect.value;

    if (!displayName || !role) {
      alert("Please enter Full Name and select Role.");
      return;
    }
    if ((role === "principal" || role === "teacher") && !schoolSel) {
      alert("For Principal/Teacher, please select a School.");
      return;
    }
    if (role === "teacher" && (!cls || !sec)) {
      alert("For Teacher, please select Class and Section.");
      return;
    }

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCred.user, { displayName });

      const uid = userCred.user.uid;
      const profileData = {
        displayName,
        role,
        school: role === "admin" ? "" : schoolSel,
        class:  role === "teacher" ? cls : "",
        section: role === "teacher" ? sec : ""
      };
      await dbSet(dbRef(database, `users/${uid}`), profileData);

      // Clear signup form
      displayNameInput.value        = "";
      roleSelect.value              = "-- Select Role --";
      schoolRegisterSelect.value    = "-- Select School --";
      classRegisterSelect.value     = "-- Select Class --";
      sectionRegisterSelect.value   = "-- Select Section --";

      // Switch back to Login mode
      isLoginMode = true;
      formTitle.innerText    = "Login to Attendance App";
      authButton.innerText   = "Login";
      toggleAuth.innerText   = "Don't have an account? Sign Up";
      signupExtra.classList.add("hidden");
    } catch (err) {
      console.error("Signup error:", err);
      alert("Signup failed: " + err.message);
    }
  }
});

// ---------------------------------------------
// 6. ON AUTH STATE CHANGED
// ---------------------------------------------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authContainer.classList.add("hidden");
    mainApp.classList.remove("hidden");

    const uid = user.uid;
    try {
      const profSnap = await dbGet(dbRef(database, `users/${uid}`));
      if (profSnap.exists()) {
        currentProfile = profSnap.val();
        currentProfile.uid = uid;
      } else {
        // fallback (should not happen in normal flow)
        currentProfile = {
          role: "teacher",
          displayName: user.displayName,
          school: "",
          class: "",
          section: "",
          uid
        };
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
    }

    if (currentProfile.role === "teacher") {
      currentSchool  = currentProfile.school;
      teacherClass   = currentProfile.class;
      teacherSection = currentProfile.section;
    }

    // Load remote appData once
    try {
      const appSnap = await dbGet(appDataRef);
      if (appSnap.exists()) {
        const data = appSnap.val();
        studentsBySchool       = data.studentsBySchool       || {};
        attendanceDataBySchool = data.attendanceDataBySchool || {};
        paymentsDataBySchool   = data.paymentsDataBySchool   || {};
        lastAdmNoBySchool      = data.lastAdmNoBySchool      || {};
        fineRates              = data.fineRates              || fineRates;
        eligibilityPct         = data.eligibilityPct         || eligibilityPct;
        schools                = data.schools                || [];
        currentSchool          = data.currentSchool          || currentSchool;
        teacherClass           = data.teacherClass           || teacherClass;
        teacherSection         = data.teacherSection         || teacherSection;
      }
    } catch (err) {
      console.error("Error loading appData from Firebase:", err);
    }

    // Initialize local IndexedDB caches
    await initLocalState();

    // Ensure school‐specific data structures exist
    await ensureSchoolData(currentSchool);

    // Load UI sections
    loadSetup();
    renderStudents();
    updateCounters();
    loadFinancialSettings();
  } else {
    mainApp.classList.add("hidden");
    authContainer.classList.remove("hidden");
  }
});

// ---------------------------------------------
// 7. LOGOUT
// ---------------------------------------------
$("logoutBtn").onclick = async () => {
  await signOut(auth);
};

// ---------------------------------------------
// 8. SETUP SECTION (Add / Edit / Delete Schools, Select School/Class/Section)
// ---------------------------------------------
const setupForm        = $("setupForm");
const setupDisplay     = $("setupDisplay");
const schoolInput      = $("schoolInput");
const schoolSelectElm  = $("schoolSelect");
const classSelectElm   = $("teacherClassSelect");
const sectionSelectElm = $("teacherSectionSelect");
const setupTextElm     = $("setupText");
const saveSetupBtn     = $("saveSetup");
const editSetupBtn     = $("editSetup");
const schoolListDiv    = $("schoolList");

async function loadSetup() {
  schools        = (await idbGet("schools"))       || schools;
  currentSchool  = (await idbGet("currentSchool")) || currentSchool;
  teacherClass   = (await idbGet("teacherClass"))  || teacherClass;
  teacherSection = (await idbGet("teacherSection"))|| teacherSection;

  // Populate School‐dropdown
  schoolSelectElm.innerHTML = [
    '<option disabled selected>-- Select School --</option>',
    ...schools.map(s => `<option value="${s}">${s}</option>`)
  ].join("");
  if (currentSchool) schoolSelectElm.value = currentSchool;

  renderSchoolList();

  // If user (after login or signup) already has school/class/section selected:
  if (currentSchool && teacherClass && teacherSection) {
    await ensureSchoolData(currentSchool);
    students       = studentsBySchool[currentSchool];
    attendanceData = attendanceDataBySchool[currentSchool];
    paymentsData   = paymentsDataBySchool[currentSchool];
    lastAdmNo      = lastAdmNoBySchool[currentSchool] || 0;

    classSelectElm.value   = teacherClass;
    sectionSelectElm.value = teacherSection;

    setupTextElm.innerText = `${currentSchool}   |   Class: ${teacherClass}   |   Section: ${teacherSection}`;
    hide(setupForm);
    show(setupDisplay);

    resetViews();
    renderStudents();
    updateCounters();
  } else {
    show(setupForm);
    hide(setupDisplay);
    resetViews();
  }
}

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

  // Handle “Edit School” buttons
  document.querySelectorAll(".edit-school").forEach(btn => {
    btn.onclick = async () => {
      const idx     = +btn.dataset.idx;
      const newName = prompt("Edit School Name:", schools[idx]);
      if (!newName?.trim()) return;

      const oldName = schools[idx];
      schools[idx]  = newName.trim();
      await idbSet("schools", schools);

      // Update remote “appData/schools”
      const snap = await dbGet(dbRef(database, "appData/schools"));
      let remoteSchools = snap.val() || [];
      remoteSchools = remoteSchools.map(s => (s === oldName ? newName : s));
      await dbSet(dbRef(database, "appData/schools"), remoteSchools);

      // Rename keys in all structures
      studentsBySchool[newName]       = studentsBySchool[oldName]       || [];
      delete studentsBySchool[oldName];
      attendanceDataBySchool[newName] = attendanceDataBySchool[oldName] || {};
      delete attendanceDataBySchool[oldName];
      paymentsDataBySchool[newName]   = paymentsDataBySchool[oldName]   || {};
      delete paymentsDataBySchool[oldName];
      lastAdmNoBySchool[newName]      = lastAdmNoBySchool[oldName]      || 0;
      delete lastAdmNoBySchool[oldName];

      if (currentSchool === oldName) {
        currentSchool = newName;
        await idbSet("currentSchool", currentSchool);
      }

      await idbSet("studentsBySchool",       studentsBySchool);
      await idbSet("attendanceDataBySchool", attendanceDataBySchool);
      await idbSet("paymentsDataBySchool",   paymentsDataBySchool);
      await idbSet("lastAdmNoBySchool",      lastAdmNoBySchool);
      await syncToFirebase();

      await loadSetup();
    };
  });

  // Handle “Delete School” buttons
  document.querySelectorAll(".delete-school").forEach(btn => {
    btn.onclick = async () => {
      const idx = +btn.dataset.idx;
      if (!confirm(`Delete school "${schools[idx]}"?`)) return;
      const removed = schools.splice(idx, 1)[0];
      await idbSet("schools", schools);

      // Delete all data for that school
      delete studentsBySchool[removed];
      await idbSet("studentsBySchool", studentsBySchool);
      delete attendanceDataBySchool[removed];
      await idbSet("attendanceDataBySchool", attendanceDataBySchool);
      delete paymentsDataBySchool[removed];
      await idbSet("paymentsDataBySchool", paymentsDataBySchool);
      delete lastAdmNoBySchool[removed];
      await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);

      if (currentSchool === removed) {
        currentSchool   = null;
        teacherClass    = null;
        teacherSection  = null;
        await idbSet("currentSchool", null);
        await idbSet("teacherClass",  null);
        await idbSet("teacherSection",null);
      }
      await syncToFirebase();
      await loadSetup();
    };
  });
}

saveSetupBtn.onclick = async (e) => {
  e.preventDefault();
  const newSchool = schoolInput.value.trim();
  if (newSchool) {
    // Add a brand‐new school
    if (!schools.includes(newSchool)) {
      schools.push(newSchool);
      await idbSet("schools", schools);

      // Update remote “appData/schools”
      const snap = await dbGet(dbRef(database, "appData/schools"));
      let remoteSchools = snap.val() || [];
      if (!remoteSchools.includes(newSchool)) {
        remoteSchools.push(newSchool);
        await dbSet(dbRef(database, "appData/schools"), remoteSchools);
      }
    }
    schoolInput.value = "";
    return loadSetup();
  }

  // Otherwise: user is finalizing their selection of school/class/section
  const selSchool  = schoolSelectElm.value;
  const selClass   = classSelectElm.value;
  const selSection = sectionSelectElm.value;
  if (!selSchool || !selClass || !selSection) {
    alert("Please select a school, class, and section.");
    return;
  }
  currentSchool  = selSchool;
  teacherClass   = selClass;
  teacherSection = selSection;
  await idbSet("currentSchool", currentSchool);
  await idbSet("teacherClass",  teacherClass);
  await idbSet("teacherSection",teacherSection);

  // Write back to Firebase
  await dbSet(dbRef(database, "appData/currentSchool"), currentSchool);
  await dbSet(dbRef(database, "appData/teacherClass"), teacherClass);
  await dbSet(dbRef(database, "appData/teacherSection"), teacherSection);

  loadSetup();
};

editSetupBtn.onclick = (e) => {
  e.preventDefault();
  show(setupForm);
  hide(setupDisplay);
  resetViews();
};

function resetViews() {
  const setupDone = !!(currentSchool && teacherClass && teacherSection);
  const allSections = [
    $("financial-settings"),
    $("animatedCounters"),
    $("student-registration"),
    $("attendance-section"),
    $("analytics-section"),
    $("register-section"),
    $("chooseBackupFolder"),
    $("restoreData"),
    $("resetData"),
    $("logoutBtn")
  ];
  if (!setupDone) {
    allSections.forEach(sec => sec && hide(sec));
  } else {
    allSections.forEach(sec => sec && show(sec));
  }
}

// ---------------------------------------------
// 9. FINANCIAL SETTINGS
// ---------------------------------------------
const fineAbsentInputElm     = $("fineAbsent");
const fineLateInputElm       = $("fineLate");
const fineLeaveInputElm      = $("fineLeave");
const fineHalfDayInputElm    = $("fineHalfDay");
const eligibilityPctInputElm = $("eligibilityPct");
const saveSettingsBtn        = $("saveSettings");
const financialSection       = $("financial-settings");

const settingsCard = document.createElement("div");
settingsCard.id    = "settingsCard";
settingsCard.className = "card hidden";
const editSettings = document.createElement("button");
editSettings.id    = "editSettings";
editSettings.className = "btn no-print hidden";
editSettings.innerText = "Edit Settings";
financialSection.appendChild(settingsCard);
financialSection.appendChild(editSettings);

async function loadFinancialSettings() {
  const fr = await idbGet("fineRates");
  const ep = await idbGet("eligibilityPct");
  if (fr) { fineRates = fr; }
  if (ep !== undefined) { eligibilityPct = ep; }

  fineAbsentInputElm.value     = fineRates.A;
  fineLateInputElm.value       = fineRates.Lt;
  fineLeaveInputElm.value      = fineRates.L;
  fineHalfDayInputElm.value    = fineRates.HD;
  eligibilityPctInputElm.value = eligibilityPct;

  if (fineRates && eligibilityPct !== undefined) {
    showFinancialCard();
  } else {
    showFinancialForm();
  }
}

function showFinancialForm() {
  hide(settingsCard, editSettings);
  show(
    fineAbsentInputElm, fineLateInputElm, fineLeaveInputElm,
    fineHalfDayInputElm, eligibilityPctInputElm, saveSettingsBtn
  );
}

function showFinancialCard() {
  settingsCard.innerHTML = `
    <div class="card-content">
      <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
      <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
      <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
      <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
      <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
    </div>`;
  hide(
    fineAbsentInputElm, fineLateInputElm, fineLeaveInputElm,
    fineHalfDayInputElm, eligibilityPctInputElm, saveSettingsBtn
  );
  show(settingsCard, editSettings);
}

saveSettingsBtn.onclick = async () => {
  fineRates = {
    A: Number(fineAbsentInputElm.value) || 0,
    Lt: Number(fineLateInputElm.value) || 0,
    L: Number(fineLeaveInputElm.value) || 0,
    HD: Number(fineHalfDayInputElm.value) || 0
  };
  eligibilityPct = Number(eligibilityPctInputElm.value) || 0;

  await idbSet("fineRates", fineRates);
  await idbSet("eligibilityPct", eligibilityPct);
  await syncToFirebase();

  showFinancialCard();
};

editSettings.onclick = () => {
  fineAbsentInputElm.value     = fineRates.A;
  fineLateInputElm.value       = fineRates.Lt;
  fineLeaveInputElm.value      = fineRates.L;
  fineHalfDayInputElm.value    = fineRates.HD;
  eligibilityPctInputElm.value = eligibilityPct;
  showFinancialForm();
};

loadFinancialSettings();

// ---------------------------------------------
// 10. ANIMATED COUNTERS
// ---------------------------------------------
const countersContainer   = $("countersContainer");
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

createCounterCard("card-section",     "Section",         "sectionCount");
createCounterCard("card-class",       "Class",           "classCount");
createCounterCard("card-school",      "School",          "schoolCount");
createCounterCard("card-attendance",  "Attendance",      "attendanceCount");
createCounterCard("card-eligible",    "Eligible",        "eligibleCount");
createCounterCard("card-debarred",    "Debarred",        "debarredCount");
createCounterCard("card-outstanding", "Outstanding/Fine","outstandingCount");

const sectionCountSpan     = $("sectionCount");
const classCountSpan       = $("classCount");
const schoolCountSpan      = $("schoolCount");
const attendanceCountSpan  = $("attendanceCount");
const eligibleCountSpan    = $("eligibleCount");
const debarredCountSpan    = $("debarredCount");
const outstandingCountSpan = $("outstandingCount");

function animateCounters() {
  document.querySelectorAll(".card-number span").forEach(span => {
    const target = +span.dataset.target;
    let count = 0;
    const step = Math.max(1, target / 100);
    (function upd() {
      count += step;
      span.innerText = count < target ? Math.ceil(count) : target;
      if (count < target) requestAnimationFrame(upd);
    })();
  });
}

function updateCounters() {
  const cl  = classSelectElm.value;
  const sec = sectionSelectElm.value;

  const sectionStudents = students.filter(s => s.cls === cl && s.sec === sec);
  const classStudents   = students.filter(s => s.cls === cl);

  sectionCountSpan.dataset.target = sectionStudents.length;
  classCountSpan.dataset.target   = classStudents.length;
  schoolCountSpan.dataset.target  = students.length;

  let totalP=0, totalA=0, totalLt=0, totalHD=0, totalL=0;
  Object.entries(attendanceData).forEach(([date, rec]) => {
    sectionStudents.forEach(s => {
      const code = rec[s.adm];
      if (!code) totalA++;
      else {
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
  attendanceCountSpan.dataset.target = totalP + totalA + totalLt + totalHD + totalL;

  let eligibleCount = 0, debarredCount = 0, outstandingCount = 0;
  sectionStudents.forEach(s => {
    let p=0,a=0,lt=0,hd=0,l=0,totalDays=0;
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
    const fineTotal = a*fineRates.A + lt*fineRates.Lt + l*fineRates.L + hd*fineRates.HD;
    const paid = (paymentsData[s.adm]||[]).reduce((sum,x) => sum + x.amount, 0);
    const outstanding = fineTotal - paid;
    const perc = totalDays ? (p/totalDays)*100 : 0;
    if (outstanding <= 0 && perc >= eligibilityPct) eligibleCount++;
    else debarredCount++;
    if (outstanding > 0) outstandingCount++;
  });
  eligibleCountSpan.dataset.target    = eligibleCount;
  debarredCountSpan.dataset.target    = debarredCount;
  outstandingCountSpan.dataset.target = outstandingCount;

  animateCounters();
}

$("card-section").onclick = () => {
  const cl  = classSelectElm.value;
  const sec = sectionSelectElm.value;
  const list = students.filter(s => s.cls===cl && s.sec===sec)
                       .map((s,i)=>`${i+1}. Adm#: ${s.adm}  ${s.name}`)
                       .join("\n");
  alert(`Class ${cl} Section ${sec}:\n\n${list||"No students."}`);
};
$("card-class").onclick = () => {
  const cl = classSelectElm.value;
  const list = students.filter(s => s.cls===cl)
                       .map((s,i)=>`${i+1}. Adm#: ${s.adm}  ${s.name}`)
                       .join("\n");
  alert(`Class ${cl} (All Sections):\n\n${list||"No students."}`);
};
$("card-school").onclick = () => {
  const classesList = [...new Set(students.map(s=>s.cls))].sort();
  let details = "";
  classesList.forEach(cl => {
    const classStu = students.filter(s => s.cls===cl);
    details += `Class ${cl} (${classStu.length}):\n`;
    classStu.forEach((s,i) => { details += `  ${i+1}. Adm#: ${s.adm}  ${s.name}\n`; });
    details += "\n";
  });
  alert(`School Overview:\n\n${details||"No students."}`);
};
$("card-attendance").onclick = () => {
  const cl  = classSelectElm.value;
  const sec = sectionSelectElm.value;
  let counts = { P:0, A:0, Lt:0, HD:0, L:0 };
  Object.values(attendanceData).forEach(rec => {
    students.filter(s=>s.cls===cl && s.sec===sec).forEach(s => {
      const code = rec[s.adm];
      if (!code) counts.A++;
      else {
        switch(code) {
          case "P": counts.P++; break;
          case "A": counts.A++; break;
          case "Lt": counts.Lt++; break;
          case "HD": counts.HD++; break;
          case "L": counts.L++; break;
        }
      }
    });
  });
  alert(
    `Attendance for Class ${cl} Section ${sec}:\n\n` +
    `Present  : ${counts.P}\n` +
    `Absent   : ${counts.A}\n` +
    `Late     : ${counts.Lt}\n` +
    `Half-Day : ${counts.HD}\n` +
    `Leave    : ${counts.L}`
  );
};
$("card-eligible").onclick = () => {
  const cl  = classSelectElm.value;
  const sec = sectionSelectElm.value;
  const list = students.filter(s => s.cls===cl && s.sec===sec).filter(s => {
    let p=0,a=0,lt=0,hd=0,l=0,totalDays=0;
    Object.values(attendanceData).forEach(rec => {
      if (rec[s.adm]) {
        totalDays++;
        switch(rec[s.adm]) {
          case "P": p++; break;
          case "A": a++; break;
          case "Lt": lt++; break;
          case "HD": hd++; break;
          case "L": l++; break;
        }
      }
    });
    const fineTotal = a*fineRates.A + lt*fineRates.Lt + l*fineRates.L + hd*fineRates.HD;
    const paid = (paymentsData[s.adm]||[]).reduce((sum,x)=>sum+x.amount, 0);
    const outstanding = fineTotal - paid;
    const perc = totalDays ? (p/totalDays)*100 : 0;
    return outstanding <= 0 && perc >= eligibilityPct;
  }).map((s,i)=>`${i+1}. Adm#: ${s.adm} ${s.name}`).join("\n");
  alert(`Eligible Students:\n\n${list||"None."}`);
};
$("card-debarred").onclick = () => {
  const cl  = classSelectElm.value;
  const sec = sectionSelectElm.value;
  const list = students.filter(s => s.cls===cl && s.sec===sec).filter(s => {
    let p=0,a=0,lt=0,hd=0,l=0,totalDays=0;
    Object.values(attendanceData).forEach(rec => {
      if(rec[s.adm]) {
        totalDays++;
        switch(rec[s.adm]) {
          case "P": p++; break;
          case "A": a++; break;
          case "Lt": lt++; break;
          case "HD": hd++; break;
          case "L": l++; break;
        }
      }
    });
    const fineTotal = a*fineRates.A + lt*fineRates.Lt + l*fineRates.L + hd*fineRates.HD;
    const paid = (paymentsData[s.adm]||[]).reduce((sum,x)=>sum+x.amount, 0);
    const outstanding = fineTotal - paid;
    const perc = totalDays ? (p/totalDays)*100 : 0;
    return outstanding > 0 || perc < eligibilityPct;
  }).map((s,i)=>`${i+1}. Adm#: ${s.adm} ${s.name}`).join("\n");
  alert(`Debarred Students:\n\n${list||"None."}`);
};
$("card-outstanding").onclick = () => {
  const cl  = classSelectElm.value;
  const sec = sectionSelectElm.value;
  const list = students.filter(s => s.cls===cl && s.sec===sec).filter(s => {
    let a=0, lt=0, hd=0, l=0;
    Object.values(attendanceData).forEach(rec => {
      if(rec[s.adm]) {
        switch(rec[s.adm]) {
          case "A": a++; break;
          case "Lt": lt++; break;
          case "HD": hd++; break;
          case "L": l++; break;
        }
      }
    });
    const fineTotal = a*fineRates.A + lt*fineRates.Lt + l*fineRates.L + hd*fineRates.HD;
    const paid = (paymentsData[s.adm]||[]).reduce((sum,x)=>sum+x.amount, 0);
    return (fineTotal - paid) > 0;
  }).map((s,i) => {
    let a=0,lt=0,hd=0,l=0;
    Object.values(attendanceData).forEach(rec => {
      if(rec[s.adm]) {
        switch(rec[s.adm]) {
          case "A": a++; break;
          case "Lt": lt++; break;
          case "HD": hd++; break;
          case "L": l++; break;
        }
      }
    });
    const fineTotal = a*fineRates.A + lt*fineRates.Lt + l*fineRates.L + hd*fineRates.HD;
    const paid = (paymentsData[s.adm]||[]).reduce((sum,x)=>sum+x.amount, 0);
    const out   = fineTotal - paid;
    return `${i+1}. Adm#: ${s.adm} ${s.name} – Outstanding: PKR ${out}`;
  }).join("\n");
  alert(`Students with Outstanding Fines:\n\n${list||"None."}`);
};

// ---------------------------------------------
// 11. STUDENT REGISTRATION
// ---------------------------------------------
const studentNameInput      = $("studentName");
const parentNameInput       = $("parentName");
const parentContactInput    = $("parentContact");
const parentOccupationInput = $("parentOccupation");
const parentAddressInput    = $("parentAddress");
const addStudentBtn         = $("addStudent");
const studentsBody          = $("studentsBody");
const selectAllStudentsCb   = $("selectAllStudents");
const editSelectedBtn       = $("editSelected");
const doneEditingBtn        = $("doneEditing");
const deleteSelectedBtn     = $("deleteSelected");
const saveRegistrationBtn   = $("saveRegistration");
const editRegistrationBtn   = $("editRegistration");
const downloadRegistrationBtn = $("downloadRegistrationPDF");

let editingStudentIndex = null;

addStudentBtn.onclick = async () => {
  const n   = studentNameInput.value.trim();
  const p   = parentNameInput.value.trim();
  const c   = parentContactInput.value.trim();
  const o   = parentOccupationInput.value.trim();
  const a   = parentAddressInput.value.trim();
  const cl  = classSelectElm.value;
  const sec = sectionSelectElm.value;

  if (!n || !p || !/^\d{7,15}$/.test(c)) {
    alert("Enter valid Name, Parent Name, and Contact (7–15 digits).");
    return;
  }

  if (editingStudentIndex !== null) {
    const s = students[editingStudentIndex];
    s.name       = n;
    s.parentName = p;
    s.contact    = c;
    s.occupation = o;
    s.address    = a;
    studentsBySchool[currentSchool] = students;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    exitEditMode();
    renderStudents();
    updateCounters();
    return;
  }

  const adm = await genAdmNo();
  const newStu = {
    adm,
    name: n,
    parentName: p,
    contact: c,
    occupation: o,
    address: a,
    cls: cl,
    sec: sec,
    fine: 0,
    status: "Registered"
  };
  students.push(newStu);
  studentsBySchool[currentSchool] = students;
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();

  studentNameInput.value      = "";
  parentNameInput.value       = "";
  parentContactInput.value    = "";
  parentOccupationInput.value = "";
  parentAddressInput.value    = "";

  renderStudents();
  updateCounters();
};

function exitEditMode() {
  editingStudentIndex = null;
  studentNameInput.value      = "";
  parentNameInput.value       = "";
  parentContactInput.value    = "";
  parentOccupationInput.value = "";
  parentAddressInput.value    = "";

  addStudentBtn.innerText = "Add";
  editSelectedBtn.classList.remove("hidden");
  deleteSelectedBtn.classList.remove("hidden");
  doneEditingBtn.classList.add("hidden");
}

function renderStudents() {
  studentsBody.innerHTML = "";
  let idxCount = 0;
  students.forEach((s, i) => {
    if (s.cls !== classSelectElm.value || s.sec !== sectionSelectElm.value) return;
    idxCount++;
    let a=0, lt=0, hd=0, l=0;
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
    const fineTotal = a*fineRates.A + lt*fineRates.Lt + l*fineRates.L + hd*fineRates.HD;
    const paid = (paymentsData[s.adm]||[]).reduce((sum,x)=>sum+x.amount,0);
    const outstanding = fineTotal - paid;
    let totalDays = 0, presentDays = 0;
    Object.values(attendanceData).forEach(rec => {
      if (rec[s.adm]) {
        totalDays++;
        if (rec[s.adm] !== "A") presentDays++;
      }
    });
    const perc = totalDays ? ((presentDays/totalDays)*100).toFixed(2) : "0.00";
    const status = (outstanding > 0 || +perc < eligibilityPct) ? "Debarred" : "Eligible";

    const tr = document.createElement("tr");
    tr.dataset.index = i;
    tr.innerHTML = `
      <td><input type="checkbox" class="stuCheckbox" data-index="${i}" /></td>
      <td>${idxCount}</td>
      <td>${s.name}</td>
      <td>${s.adm}</td>
      <td>${s.parentName}</td>
      <td>${s.contact}</td>
      <td>${s.occupation}</td>
      <td>${s.address}</td>
      <td>PKR ${outstanding}</td>
      <td>${status}</td>
      <td><button class="add-payment-btn btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
    `;
    studentsBody.appendChild(tr);
  });

  selectAllStudentsCb.checked = false;
  selectAllStudentsCb.onchange = () => {
    document.querySelectorAll(".stuCheckbox").forEach(cb => cb.checked = selectAllStudentsCb.checked);
    toggleStudentActions();
  };

  document.querySelectorAll(".stuCheckbox").forEach(cb => {
    cb.onchange = () => {
      if (!cb.checked) selectAllStudentsCb.checked = false;
      else if (document.querySelectorAll(".stuCheckbox:not(:checked)").length === 0) {
        selectAllStudentsCb.checked = true;
      }
      toggleStudentActions();
    };
  });

  toggleStudentActions();
  editSelectedBtn.disabled   = true;
  deleteSelectedBtn.disabled = true;

  document.querySelectorAll(".add-payment-btn").forEach(btn => {
    btn.onclick = () => openPaymentModal(btn.dataset.adm);
  });
}

function toggleStudentActions() {
  const checkedCount = document.querySelectorAll(".stuCheckbox:checked").length;
  editSelectedBtn.disabled   = checkedCount !== 1;
  deleteSelectedBtn.disabled = checkedCount === 0;
}

editSelectedBtn.onclick = () => {
  const cb = document.querySelector(".stuCheckbox:checked");
  if (!cb) return;
  const idx = +cb.dataset.index;
  enterEditMode(idx);
};

function enterEditMode(index) {
  editingStudentIndex = index;
  const s = students[index];
  studentNameInput.value      = s.name;
  parentNameInput.value       = s.parentName;
  parentContactInput.value    = s.contact;
  parentOccupationInput.value = s.occupation;
  parentAddressInput.value    = s.address;

  addStudentBtn.innerText = "Update";
  editSelectedBtn.classList.add("hidden");
  deleteSelectedBtn.classList.add("hidden");
  doneEditingBtn.classList.remove("hidden");
  doneEditingBtn.dataset.index = index;
}

doneEditingBtn.onclick = () => {
  exitEditMode();
};

deleteSelectedBtn.onclick = async () => {
  const checkedCbs = document.querySelectorAll(".stuCheckbox:checked");
  if (!checkedCbs.length) return;
  if (!confirm(`Delete ${checkedCbs.length} selected student(s)?`)) return;
  const indices = Array.from(checkedCbs).map(cb => +cb.dataset.index).sort((a,b)=>b-a);
  indices.forEach(i => students.splice(i,1));
  studentsBySchool[currentSchool] = students;
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();
  renderStudents();
  updateCounters();
};

saveRegistrationBtn.onclick = async () => {
  await idbSet("studentsBySchool", studentsBySchool);
  await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
  await syncToFirebase();
  alert("Registration saved successfully.");
};

editRegistrationBtn.onclick = () => {
  show(addStudentBtn, selectAllStudentsCb, editSelectedBtn, deleteSelectedBtn, saveRegistrationBtn);
  hide(editRegistrationBtn, $("shareRegistration"), downloadRegistrationBtn);
  renderStudents();
  updateCounters();
};

// ---------------------------------------------
// 12. PAYMENT MODAL
// ---------------------------------------------
const paymentModal         = $("paymentModal");
const payAdmSpan           = $("payAdm");
const paymentAmountInput   = $("paymentAmount");
const paymentModalCloseBtn = $("paymentModalClose");
const savePaymentBtn       = $("savePayment");
const cancelPaymentBtn     = $("cancelPayment");

function openPaymentModal(adm) {
  payAdmSpan.innerText      = adm;
  paymentAmountInput.value  = "";
  show(paymentModal);
}
paymentModalCloseBtn.onclick = () => hide(paymentModal);
cancelPaymentBtn.onclick    = () => hide(paymentModal);

savePaymentBtn.onclick = async () => {
  const adm = payAdmSpan.innerText;
  const amt = Number(paymentAmountInput.value) || 0;
  paymentsData[adm] = paymentsData[adm] || [];
  paymentsData[adm].push({
    date: new Date().toISOString().split("T")[0],
    amount: amt
  });
  paymentsDataBySchool[currentSchool] = paymentsData;
  await idbSet("paymentsDataBySchool", paymentsDataBySchool);
  await syncToFirebase();
  hide(paymentModal);
  renderStudents();
  updateCounters();
  alert("Payment recorded!");
};

// ---------------------------------------------
// 13. ATTENDANCE SECTION
// ---------------------------------------------
const dateInputElm        = $("dateInput");
const loadAttendanceBtn   = $("loadAttendance");
const attendanceBodyDiv   = $("attendanceBody");
const attendanceSummaryDiv= $("attendanceSummary");
const saveAttendanceBtn   = $("saveAttendance");
const resetAttendanceBtn  = $("resetAttendance");
const downloadAttendanceBtn = $("downloadAttendancePDF");
const shareAttendanceSummaryBtn = $("shareAttendanceSummary");

loadAttendanceBtn.onclick = () => {
  const date = dateInputElm.value;
  if (!date) {
    alert("Please select a date.");
    return;
  }
  renderAttendanceTable(date);
};

function renderAttendanceTable(date) {
  attendanceBodyDiv.innerHTML = "";
  attendanceSummaryDiv.innerHTML = "";
  hide(attendanceSummaryDiv, resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceSummaryBtn);

  if (!attendanceData[date]) {
    attendanceData[date] = {};
  }

  students.filter(s => s.cls===classSelectElm.value && s.sec===sectionSelectElm.value)
          .forEach((stu,i) => {
    const row = document.createElement("div");
    row.className = "attendance-row";
    const headerDiv = document.createElement("div");
    headerDiv.className = "attendance-header";
    headerDiv.innerText = `${i+1}. ${stu.name} (${stu.adm})`;

    const btnsDiv = document.createElement("div");
    btnsDiv.className = "attendance-buttons";
    ["P","A","Lt","HD","L"].forEach(code => {
      const btn = document.createElement("button");
      btn.className = "att-btn";
      btn.innerText = code;
      if (attendanceData[date][stu.adm] === code) {
        btn.classList.add("selected");
        btn.style.background = {
          P: "var(--success)",
          A: "var(--danger)",
          Lt: "var(--warning)",
          HD: "#FF9800",
          L: "var(--info)"
        }[code];
        btn.style.color = "#fff";
      }
      btn.onclick = () => {
        btnsDiv.querySelectorAll(".att-btn").forEach(b => {
          b.classList.remove("selected");
          b.style = "";
        });
        btn.classList.add("selected");
        btn.style.background = {
          P: "var(--success)",
          A: "var(--danger)",
          Lt: "var(--warning)",
          HD: "#FF9800",
          L: "var(--info)"
        }[code];
        btn.style.color = "#fff";
      };
      btnsDiv.appendChild(btn);
    });
    row.append(headerDiv, btnsDiv);
    attendanceBodyDiv.appendChild(row);
  });

  show(attendanceBodyDiv, saveAttendanceBtn, resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceSummaryBtn);
}

saveAttendanceBtn.onclick = async () => {
  const date = dateInputElm.value;
  if (!date) return;
  students.filter(s => s.cls===classSelectElm.value && s.sec===sectionSelectElm.value)
    .forEach((s,i) => {
      const selBtn = attendanceBodyDiv.children[i].querySelector(".att-btn.selected");
      attendanceData[date][s.adm] = selBtn ? selBtn.innerText : "A";
    });
  attendanceDataBySchool[currentSchool] = attendanceData;
  await idbSet("attendanceDataBySchool", attendanceDataBySchool);
  await syncToFirebase();
  alert(`Attendance for ${date} saved!`);
  calculateAttendanceSummary(date);
};

resetAttendanceBtn.onclick = () => {
  const date = dateInputElm.value;
  if (attendanceData[date]) {
    delete attendanceData[date];
    attendanceDataBySchool[currentSchool] = attendanceData;
    idbSet("attendanceDataBySchool", attendanceDataBySchool);
    syncToFirebase();
    renderAttendanceTable(date);
  }
};

function calculateAttendanceSummary(date) {
  attendanceSummaryDiv.innerHTML = `<h3>Attendance Summary: ${date}</h3>`;
  const tbl = document.createElement("table");
  tbl.id = "attendanceSummaryTable";
  tbl.className = "table";
  tbl.innerHTML = `
    <tr>
      <th>Sr#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th>
    </tr>`;
  students.filter(s => s.cls===classSelectElm.value && s.sec===sectionSelectElm.value)
    .forEach((s,i) => {
      const code = attendanceData[date][s.adm] || "A";
      tbl.innerHTML += `
        <tr>
          <td>${i+1}</td>
          <td>${s.adm}</td>
          <td>${s.name}</td>
          <td>${ { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" }[code] }</td>
          <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
        </tr>`;
    });
  attendanceSummaryDiv.appendChild(tbl);

  attendanceSummaryDiv.querySelectorAll(".share-individual").forEach(ic => {
    ic.onclick = () => {
      const adm = ic.dataset.adm;
      const st  = students.find(x => x.adm === adm);
      const date = dateInputElm.value;
      const msg = `Dear Parent, your child (Adm#: ${adm}) was ${
        { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" }[attendanceData[date][adm] || "A"]
      } on ${date}.`;
      window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`, "_blank");
    };
  });

  show(attendanceSummaryDiv);
}

downloadAttendanceBtn.onclick = () => {
  const date = dateInputElm.value;
  if (!date) return;
  const doc = new jspdf.jsPDF();
  const w = doc.internal.pageSize.getWidth();
  doc.setFontSize(18); doc.text("Attendance Report", 14, 16);
  doc.setFontSize(10); doc.text(`Date: ${date}`, w - 14, 16, { align: "right" });
  doc.setFontSize(12); doc.text($("setupText").innerText, 14, 24);
  doc.autoTable({ startY: 30, html: "#attendanceSummaryTable" });
  const fileName = `attendance_${date}.pdf`;
  doc.save(fileName);
};

shareAttendanceSummaryBtn.onclick = () => {
  const cl   = classSelectElm.value;
  const sec  = sectionSelectElm.value;
  const date = dateInputElm.value;
  let msg = `*Attendance Report*\nClass ${cl} Sec ${sec} - ${date}\n\n`;
  students.filter(s=>s.cls===cl && s.sec===sec).forEach((s,i) => {
    const code = attendanceData[date][s.adm] || "A";
    msg += `${i+1}. Adm#: ${s.adm} – ${
      { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" }[code]
    }\n`;
  });
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
};

// ---------------------------------------------
// 14. ANALYTICS SECTION
// ---------------------------------------------
const analyticsTargetSelect    = $("analyticsTarget");
const analyticsSectionSelect   = $("analyticsSectionSelect");
const analyticsTypeSelect      = $("analyticsType");
const analyticsDateInput       = $("analyticsDate");
const analyticsMonthInput      = $("analyticsMonth");
const semesterStartInput       = $("semesterStart");
const semesterEndInput         = $("semesterEnd");
const yearStartInput           = $("yearStart");
const analyticsSearchInput     = $("analyticsSearch");
const loadAnalyticsBtn         = $("loadAnalytics");
const resetAnalyticsBtn        = $("resetAnalytics");
const analyticsContainer       = $("analyticsContainer");
const analyticsBody            = $("analyticsBody");
const analyticsTableHeadRow    = document.querySelector("#analyticsTable thead tr");
const graphsDiv                = $("graphs");

let barChartInstance = null;
let pieChartInstance = null;

analyticsTargetSelect.addEventListener("change", () => {
  analyticsSectionSelect.classList.add("hidden");
  analyticsTypeSelect.disabled = false;
  analyticsDateInput.classList.add("hidden");
  analyticsMonthInput.classList.add("hidden");
  semesterStartInput.classList.add("hidden");
  semesterEndInput.classList.add("hidden");
  yearStartInput.classList.add("hidden");
  analyticsSearchInput.classList.add("hidden");

  if (analyticsTargetSelect.value === "section") {
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
  switch (analyticsTypeSelect.value) {
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

loadAnalyticsBtn.onclick = () => {
  const target  = analyticsTargetSelect.value;
  const section = analyticsSectionSelect.value;
  const type    = analyticsTypeSelect.value;
  if (!target || !type) {
    alert("Select report target and period.");
    return;
  }
  generateAnalytics(target, section, type);
};

resetAnalyticsBtn.onclick = () => {
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

  if (barChartInstance) barChartInstance.destroy();
  if (pieChartInstance) pieChartInstance.destroy();
};

function generateAnalytics(target, section, type) {
  let filteredStudents = [...students];
  if (target === "section" && section) {
    filteredStudents = filteredStudents.filter(stu => stu.sec === section);
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

  if (dates.length === 0) {
    alert("No attendance records for selected period.");
    return;
  }

  const analyticsStats = filteredStudents.map(stu => {
    const stat = { adm: stu.adm, name: stu.name, P:0, A:0, Lt:0, HD:0, L:0 };
    dates.forEach(d => {
      const code = attendanceData[d]?.[stu.adm] || "P";
      stat[code]++;
    });
    stat.total = stat.P + stat.Lt + stat.HD + stat.A + stat.L;
    stat.perc = stat.total ? ((stat.P + stat.Lt + stat.HD)/stat.total*100).toFixed(2) : "0.00";
    let a=0, lt=0, hd=0, l=0;
    Object.values(attendanceData).forEach(rec => {
      if (rec[stu.adm]) {
        switch(rec[stu.adm]) {
          case "A": a++; break;
          case "Lt": lt++; break;
          case "HD": hd++; break;
          case "L": l++; break;
        }
      }
    });
    const fineTotal = a*fineRates.A + lt*fineRates.Lt + l*fineRates.L + hd*fineRates.HD;
    const paid = (paymentsData[stu.adm]||[]).reduce((sum,x)=>sum+x.amount,0);
    stat.outstanding = fineTotal - paid;
    stat.status = stat.perc >= eligibilityPct ? "Eligible" : "Debarred";
    return stat;
  });

  analyticsTableHeadRow.innerHTML = [
    "#","Adm#","Name","P","A","Lt","HD","L","Total","%","Outstanding","Status"
  ].map(h=>`<th>${h}</th>`).join("");
  analyticsBody.innerHTML = "";
  analyticsStats.forEach((st,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${st.adm}</td>
      <td>${st.name}</td>
      <td>${st.P}</td>
      <td>${st.A}</td>
      <td>${st.Lt}</td>
      <td>${st.HD}</td>
      <td>${st.L}</td>
      <td>${st.total}</td>
      <td>${st.perc}%</td>
      <td>PKR ${st.outstanding}</td>
      <td>${st.status}</td>`;
    analyticsBody.appendChild(tr);
  });

  analyticsContainer.classList.remove("hidden");
  graphsDiv.classList.remove("hidden");
  resetAnalyticsBtn.classList.remove("hidden");

  if (barChartInstance) barChartInstance.destroy();
  const barCtx = document.getElementById("barChart").getContext("2d");
  barChartInstance = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: analyticsStats.map(st=>st.adm),
      datasets: [{
        label: "% Attendance",
        data: analyticsStats.map(st=>+st.perc),
        backgroundColor: analyticsStats.map(_=> "rgba(54, 162, 235, 0.6)"),
        borderColor: analyticsStats.map(_=> "rgba(54, 162, 235, 1)"),
        borderWidth: 1
      }]
    },
    options: {
      scales: { y: { beginAtZero:true, max:100 } }
    }
  });

  if (pieChartInstance) pieChartInstance.destroy();
  const pieCtx = document.getElementById("pieChart").getContext("2d");
  const totalP  = analyticsStats.reduce((sum,st)=>sum+st.P, 0);
  const totalA  = analyticsStats.reduce((sum,st)=>sum+st.A, 0);
  const totalLt = analyticsStats.reduce((sum,st)=>sum+st.Lt,0);
  const totalHD = analyticsStats.reduce((sum,st)=>sum+st.HD,0);
  const totalL  = analyticsStats.reduce((sum,st)=>sum+st.L,0);
  pieChartInstance = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: ["Present","Absent","Late","Half-Day","Leave"],
      datasets: [{
        data: [totalP,totalA,totalLt,totalHD,totalL],
        backgroundColor: [
          "rgba(75, 192, 192, 0.6)",
          "rgba(255, 99, 132, 0.6)",
          "rgba(255, 206, 86, 0.6)",
          "rgba(255, 159, 64, 0.6)",
          "rgba(153, 102, 255, 0.6)"
        ],
        borderColor: [
          "rgba(75, 192, 192, 1)",
          "rgba(255, 99, 132, 1)",
          "rgba(255, 206, 86, 1)",
          "rgba(255, 159, 64, 1)",
          "rgba(153, 102, 255, 1)"
        ],
        borderWidth: 1
      }]
    }
  });
}

// ---------------------------------------------
// 15. ATTENDANCE REGISTER SECTION
// ---------------------------------------------
const registerMonthInput   = $("registerMonth");
const loadRegisterBtn      = $("loadRegister");
const registerTableWrapper = $("registerTableWrapper");
const registerHeaderRow    = $("registerHeader");
const registerBody         = $("registerBody");
const changeRegisterBtn    = $("changeRegister");
const saveRegisterBtn      = $("saveRegister");
const downloadRegisterBtn  = $("downloadRegister");
const shareRegisterBtn     = $("shareRegister");

loadRegisterBtn.onclick = () => {
  const mVal = registerMonthInput.value;
  if (!mVal) {
    alert("Select a month.");
    return;
  }
  renderRegister(mVal);
};

function renderRegister(monthVal) {
  const [year, month] = monthVal.split("-");
  const daysInMonth = new Date(+year, +month, 0).getDate();

  registerHeaderRow.innerHTML = `<th>Name</th><th>Adm#</th>`;
  for (let d = 1; d <= daysInMonth; d++) {
    registerHeaderRow.innerHTML += `<th>${d}</th>`;
  }

  registerBody.innerHTML = "";
  students.forEach((s,i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${s.name}</td><td>${s.adm}</td>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dd = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const code = attendanceData[dd]?.[s.adm] || "A";
      tr.innerHTML += `<td>${code}</td>`;
    }
    registerBody.appendChild(tr);
  });

  registerTableWrapper.classList.remove("hidden");
}

changeRegisterBtn.onclick = () => {
  hide(registerTableWrapper, changeRegisterBtn, saveRegisterBtn, downloadRegisterBtn, shareRegisterBtn);
  registerMonthInput.value = "";
};

saveRegisterBtn.onclick = () => {
  alert("Register is already saved in real time via Save Attendance.");
};

downloadRegisterBtn.onclick = () => {
  const doc = new jspdf.jsPDF({ orientation: "l", unit: "pt", format: "a4" });
  doc.text(`Attendance Register - ${registerMonthInput.value}`, 40, 20);
  doc.autoTable({ html: "#registerTable", startY: 30, theme: "grid", styles: { fontSize: 6 } });
  const fileName = `Register_${registerMonthInput.value}.pdf`;
  doc.save(fileName);
};

shareRegisterBtn.onclick = () => {
  const msg = `Attendance Register for ${registerMonthInput.value}:\n\nPlease check your school’s portal.`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank`);
};

// ---------------------------------------------
// 16. BACKUP & RESTORE SECTION
// ---------------------------------------------
const restoreFileInput = $("restoreFile");
const restoreDataBtn   = $("restoreData");
const resetDataBtn     = $("resetData");

restoreDataBtn.onclick = () => restoreFileInput.click();
restoreFileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const txt = await file.text();
    const backup = JSON.parse(txt);
    if (backup.studentsBySchool)       studentsBySchool       = backup.studentsBySchool;
    if (backup.attendanceDataBySchool) attendanceDataBySchool = backup.attendanceDataBySchool;
    if (backup.paymentsDataBySchool)   paymentsDataBySchool   = backup.paymentsDataBySchool;
    if (backup.lastAdmNoBySchool)      lastAdmNoBySchool      = backup.lastAdmNoBySchool;
    if (backup.fineRates)              fineRates              = backup.fineRates;
    if (backup.eligibilityPct !== undefined) eligibilityPct    = backup.eligibilityPct;
    if (backup.schools)                schools                = backup.schools;
    if (backup.currentSchool)          currentSchool          = backup.currentSchool;
    if (backup.teacherClass)           teacherClass           = backup.teacherClass;
    if (backup.teacherSection)         teacherSection         = backup.teacherSection;

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
    alert("Backup restored. Reloading...");
    location.reload();
  } catch (err) {
    alert("Restore failed: " + err.message);
  }
};

resetDataBtn.onclick = async () => {
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
};

// ---------------------------------------------
// 17. PAGE LOAD
// ---------------------------------------------
// All initialization is triggered by onAuthStateChanged above.
