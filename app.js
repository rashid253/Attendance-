// app.js
// -------------------------------------------------------------------------------------------------
// (1) FIREBASE + IDB‐KEYVAL SETUP

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  set as dbSet,
  push as dbPush,
  get as dbGet,
  onValue,
  update as dbUpdate,
  remove as dbRemove,
  child as dbChild
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// IndexedDB helpers (idb-keyval IIFE must be loaded in your HTML before this script)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBsx…EpICEzA",
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

// Utility to encode keys in Firebase paths
function encodeKey(str) {
  return str
    .replace(/\./g, "___")
    .replace(/\//g, "____")
    .replace(/\$/g, "_____")
    .replace(//g, "______")
    .replace(//g, "_______")
    .replace(/#/g, "________")
    .replace(/\\/g, "_________");
}

// -------------------------------------------------------------------------------------------------
// (2) LOGIN / LOGOUT LOGIC
// We assume that login.html has stored “currentUser” in IndexedDB under key="currentUser":
//    { fullName, userType, school, class, section }
//
// On index.html load, a small script checks IndexedDB; if no currentUser, redirect to login.html.
// Here we implement “Logout” to clear currentUser and redirect.

window.addEventListener("DOMContentLoaded", async () => {
  const currentUser = await idbGet("currentUser");
  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }
  window.currentUser = currentUser; // { fullName, userType, school, class, section }

  // Attach logout button handler
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await idbSet("currentUser", null);
      window.location.href = "login.html";
    };
  }

  // After that, proceed with the rest of initialization
  initApp();
});

// -------------------------------------------------------------------------------------------------
// (3) GLOBAL DATA STRUCTURES (by school) & TEACHER KEYS

let studentsBySchool       = {}; // { schoolName: [ { name, adm, parent, contact, occupation, address, cls, sec } ] }
let attendanceDataBySchool = {}; // { schoolName: { "YYYY-MM-DD": { adm: "P"/"A"/... } } }
let paymentsDataBySchool   = {}; // { schoolName: { adm: [ { date: "YYYY-MM-DD", amount: number }, ... ] } }
let lastAdmNoBySchool      = {}; // { schoolName: numeric last admission number }
let fineRates              = { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct         = 75;
let schools                = [];  // array of school names (strings)
let teacherKeysBySchool    = {};  // { schoolName: { className: { sectionName: key } } }

// (NEW) Per‐school classes & sections
let classesBySchool   = {}; // { "School A": ["Nursery","KG","Class One",…], … }
let sectionsBySchool  = {}; // { "School A": { "Nursery": ["A","B"], "KG": ["A"], … }, … }

// “Active” school’s data pointers:
let currentSchoolStudents   = [];
let currentSchoolAttendance = {};
let currentSchoolPayments   = {};
let currentSchoolLastAdm    = 0;

// Selections for Teacher/Principal:
let selectedSchool   = null;
let selectedClass    = null;
let selectedSection  = null;

// -------------------------------------------------------------------------------------------------
// (4) UTILITY: ENSURE per‐school buckets exist

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
  if (!teacherKeysBySchool[school]) {
    teacherKeysBySchool[school] = {};
    await idbSet("teacherKeysBySchool", teacherKeysBySchool);
  }
  if (!classesBySchool[school]) {
    classesBySchool[school] = [];
    await idbSet("classesBySchool", classesBySchool);
  }
  if (!sectionsBySchool[school]) {
    sectionsBySchool[school] = {};
    await idbSet("sectionsBySchool", sectionsBySchool);
  }
}

// -------------------------------------------------------------------------------------------------
// (5) LOAD EVERYTHING FROM IndexedDB into memory

async function initLocalState() {
  const [
    _studentsBySchool,
    _attBySchool,
    _payBySchool,
    _lastAdmBySchool,
    _savedFineRates,
    _savedPct,
    _savedSchools,
    _savedTeacherKeys,
    _savedClassesBySchool,
    _savedSectionsBySchool
  ] = await Promise.all([
    idbGet("studentsBySchool"),
    idbGet("attendanceDataBySchool"),
    idbGet("paymentsDataBySchool"),
    idbGet("lastAdmNoBySchool"),
    idbGet("fineRates"),
    idbGet("eligibilityPct"),
    idbGet("schools"),
    idbGet("teacherKeysBySchool"),
    idbGet("classesBySchool"),
    idbGet("sectionsBySchool")
  ]);

  studentsBySchool       = _studentsBySchool       || {};
  attendanceDataBySchool = _attBySchool           || {};
  paymentsDataBySchool   = _payBySchool           || {};
  lastAdmNoBySchool      = _lastAdmBySchool        || {};
  fineRates              = _savedFineRates || fineRates;
  eligibilityPct         = _savedPct       || eligibilityPct;
  schools                = _savedSchools   || [];
  teacherKeysBySchool    = _savedTeacherKeys   || {};
  classesBySchool        = _savedClassesBySchool || {};
  sectionsBySchool       = _savedSectionsBySchool|| {};

  selectedSchool   = await idbGet("currentSchool")   || null;
  selectedClass    = await idbGet("teacherClass")   || null;
  selectedSection  = await idbGet("teacherSection") || null;

  if (selectedSchool) {
    await ensureSchoolData(selectedSchool);
    currentSchoolStudents   = studentsBySchool[selectedSchool];
    currentSchoolAttendance = attendanceDataBySchool[selectedSchool];
    currentSchoolPayments   = paymentsDataBySchool[selectedSchool];
    currentSchoolLastAdm    = lastAdmNoBySchool[selectedSchool];
  }
}

// -------------------------------------------------------------------------------------------------
// (6) SYNC all data back to Firebase under /appData

async function syncToFirebase() {
  const payload = {
    studentsBySchool,
    attendanceDataBySchool,
    paymentsDataBySchool,
    lastAdmNoBySchool,
    fineRates,
    eligibilityPct,
    schools,
    teacherKeysBySchool,
    classesBySchool,
    sectionsBySchool
  };
  try {
    await dbSet(appDataRef, payload);
    console.log("✅ Synced data to Firebase");
  } catch (err) {
    console.error("Firebase sync failed:", err);
  }
}

// -------------------------------------------------------------------------------------------------
// (7) UTILITY: SHARING PDF

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

// -------------------------------------------------------------------------------------------------
// (8) MAIN APPLICATION INITIALIZATION

async function initApp() {
  // Shortcut for getElementById
  const $ = (id) => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove("hidden"));
  const hide = (...els) => els.forEach(e => e && e.classList.add("hidden"));

  // Load local state from IndexedDB
  await initLocalState();

  // currentUser has been set by the login check
  const { userType, school: userSchool, class: userClass, section: userSection } = window.currentUser;

  // Based on userType, set selectedSchool/class/section
  if (userType === "Teacher") {
    selectedSchool  = userSchool;
    selectedClass   = userClass;
    selectedSection = userSection;
    await Promise.all([
      idbSet("currentSchool", selectedSchool),
      idbSet("teacherClass", selectedClass),
      idbSet("teacherSection", selectedSection)
    ]);
    await ensureSchoolData(selectedSchool);
    currentSchoolStudents   = studentsBySchool[selectedSchool]      || [];
    currentSchoolAttendance = attendanceDataBySchool[selectedSchool] || {};
    currentSchoolPayments   = paymentsDataBySchool[selectedSchool]   || {};
    currentSchoolLastAdm    = lastAdmNoBySchool[selectedSchool]      || 0;
  } else if (userType === "Principal") {
    selectedSchool = userSchool;
    selectedClass = null;
    selectedSection = null;
    await Promise.all([
      idbSet("currentSchool", selectedSchool),
      idbSet("teacherClass", null),
      idbSet("teacherSection", null)
    ]);
    await ensureSchoolData(selectedSchool);
    currentSchoolStudents   = studentsBySchool[selectedSchool]      || [];
    currentSchoolAttendance = attendanceDataBySchool[selectedSchool] || {};
    currentSchoolPayments   = paymentsDataBySchool[selectedSchool]   || {};
    currentSchoolLastAdm    = lastAdmNoBySchool[selectedSchool]      || 0;
  }

  // Function to hide or show all main sections based on whether setup is done
  function resetViews() {
    const setupDone = !!(
      selectedSchool &&
      (userType === "Teacher"
        ? (selectedClass && selectedSection)
        : true)
    );
    const allSections = [
      $("financial-settings"),
      $("animatedCounters"),
      $("student-registration"),
      $("attendance-section"),
      $("analytics-section"),
      $("register-section"),
      $("chooseBackupFolder"),
      $("restoreData"),
      $("resetData")
    ];
    if (!setupDone) {
      allSections.forEach(sec => sec && hide(sec));
    } else {
      allSections.forEach(sec => sec && show(sec));
    }
  }
  resetViews();

  // -------------------------------------------------------------------------------------------------
  // (9) SETUP SECTION (modified for Teacher vs Principal)

  const setupForm      = $("setupForm");
  const setupDisplay   = $("setupDisplay");
  const schoolInput    = $("schoolInput");
  const schoolSelect   = $("schoolSelect");
  const classSelect    = $("teacherClassSelect");
  const sectionSelect  = $("teacherSectionSelect");
  const newClassInput  = $("newClassInput");
  const addClassBtn    = $("addClassBtn");
  const newSectionInput= $("newSectionInput");
  const addSectionBtn  = $("addSectionBtn");
  const setupText      = $("setupText");
  const saveSetupBtn   = $("saveSetup");
  const editSetupBtn   = $("editSetup");
  const schoolListDiv  = $("schoolList");

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
        const oldName = schools[idx];
        const newName = prompt("Edit School Name:", oldName);
        if (newName?.trim()) {
          const trimmed = newName.trim();
          schools[idx] = trimmed;
          await idbSet("schools", schools);

          // Move all per‐school data under new key
          studentsBySchool[trimmed]      = studentsBySchool[oldName]      || [];
          delete studentsBySchool[oldName];
          attendanceDataBySchool[trimmed]= attendanceDataBySchool[oldName]|| {};
          delete attendanceDataBySchool[oldName];
          paymentsDataBySchool[trimmed]  = paymentsDataBySchool[oldName]  || {};
          delete paymentsDataBySchool[oldName];
          lastAdmNoBySchool[trimmed]     = lastAdmNoBySchool[oldName]     || 0;
          delete lastAdmNoBySchool[oldName];
          teacherKeysBySchool[trimmed]   = teacherKeysBySchool[oldName]   || {};
          delete teacherKeysBySchool[oldName];
          classesBySchool[trimmed]       = classesBySchool[oldName]       || [];
          delete classesBySchool[oldName];
          sectionsBySchool[trimmed]      = sectionsBySchool[oldName]      || {};
          delete sectionsBySchool[oldName];

          if (selectedSchool === oldName) {
            selectedSchool = trimmed;
            await idbSet("currentSchool", selectedSchool);
          }

          await Promise.all([
            idbSet("studentsBySchool", studentsBySchool),
            idbSet("attendanceDataBySchool", attendanceDataBySchool),
            idbSet("paymentsDataBySchool", paymentsDataBySchool),
            idbSet("lastAdmNoBySchool", lastAdmNoBySchool),
            idbSet("teacherKeysBySchool", teacherKeysBySchool),
            idbSet("classesBySchool", classesBySchool),
            idbSet("sectionsBySchool", sectionsBySchool)
          ]);
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
        delete studentsBySchool[removed];
        delete attendanceDataBySchool[removed];
        delete paymentsDataBySchool[removed];
        delete lastAdmNoBySchool[removed];
        delete teacherKeysBySchool[removed];
        delete classesBySchool[removed];
        delete sectionsBySchool[removed];

        if (selectedSchool === removed) {
          selectedSchool  = null;
          selectedClass   = null;
          selectedSection = null;
          await idbSet("currentSchool", null);
          await idbSet("teacherClass", null);
          await idbSet("teacherSection", null);
        }

        await Promise.all([
          idbSet("studentsBySchool", studentsBySchool),
          idbSet("attendanceDataBySchool", attendanceDataBySchool),
          idbSet("paymentsDataBySchool", paymentsDataBySchool),
          idbSet("lastAdmNoBySchool", lastAdmNoBySchool),
          idbSet("teacherKeysBySchool", teacherKeysBySchool),
          idbSet("classesBySchool", classesBySchool),
          idbSet("sectionsBySchool", sectionsBySchool)
        ]);
        await syncToFirebase();
        await loadSetup();
      };
    });
  }

  function populateClassDropdown() {
    classSelect.innerHTML = `<option disabled selected>-- Select Class --</option>`;
    if (!selectedSchool) return;
    const list = classesBySchool[selectedSchool] || [];
    list.forEach(cls => {
      const opt = document.createElement("option");
      opt.value = cls;
      opt.textContent = cls;
      classSelect.appendChild(opt);
    });
  }

  function populateSectionDropdown() {
    sectionSelect.innerHTML = `<option disabled selected>-- Select Section --</option>`;
    if (!selectedSchool || !selectedClass) return;
    const secs = (sectionsBySchool[selectedSchool] || {})[selectedClass] || [];
    secs.forEach(sec => {
      const opt = document.createElement("option");
      opt.value = sec;
      opt.textContent = sec;
      sectionSelect.appendChild(opt);
    });
  }

  async function loadSetup() {
    schools          = (await idbGet("schools"))         || [];
    selectedSchool   = (await idbGet("currentSchool"))   || null;
    selectedClass    = (await idbGet("teacherClass"))    || null;
    selectedSection  = (await idbGet("teacherSection"))  || null;
    classesBySchool  = (await idbGet("classesBySchool"))  || {};
    sectionsBySchool = (await idbGet("sectionsBySchool")) || {};

    schoolSelect.innerHTML = [
      `<option disabled selected>-- Select School --</option>`,
      ...schools.map(s => `<option value="${s}">${s}</option>`)
    ].join("");
    if (selectedSchool) schoolSelect.value = selectedSchool;

    renderSchoolList();

    if (userType === "Teacher" && selectedSchool && selectedClass && selectedSection) {
      setupText.textContent = `${selectedSchool} 🏫 | Class: ${selectedClass} | Section: ${selectedSection}`;
      hide(setupForm);
      show(setupDisplay);
      resetViews();
      currentSchoolStudents   = (studentsBySchool[selectedSchool]      || []);
      currentSchoolAttendance = (attendanceDataBySchool[selectedSchool] || {});
      currentSchoolPayments   = (paymentsDataBySchool[selectedSchool]   || {});
      currentSchoolLastAdm    = (lastAdmNoBySchool[selectedSchool]      || 0);
      setTimeout(() => {
        renderStudents();
        updateCounters();
      }, 0);
    }
    else if (userType === "Principal" && selectedSchool) {
      await ensureSchoolData(selectedSchool);
      populateClassDropdown();
      sectionSelect.innerHTML = `<option disabled selected>-- Select Section --</option>`;
      setupText.textContent = `Principal 📋 | School: ${selectedSchool}`;
      hide(setupForm);
      show(setupDisplay);
      resetViews();
    }
    else {
      populateClassDropdown();
      sectionSelect.innerHTML = `<option disabled selected>-- Select Section --</option>`;
      show(setupForm);
      hide(setupDisplay);
      resetViews();
    }
  }

  saveSetupBtn.onclick = async (e) => {
    e.preventDefault();

    const newSchool = schoolInput.value.trim();
    if (newSchool) {
      if (!schools.includes(newSchool)) {
        schools.push(newSchool);
        await idbSet("schools", schools);
        await ensureSchoolData(newSchool);
        await syncToFirebase();
      }
      schoolInput.value = "";
      return loadSetup();
    }

    const selSch = schoolSelect.value;
    const selCls = classSelect.value;
    const selSec = sectionSelect.value;

    if (userType === "Principal") {
      if (!selSch) {
        alert("Please select a school.");
        return;
      }
      selectedSchool = selSch;
      selectedClass = null;
      selectedSection = null;
      await idbSet("currentSchool", selectedSchool);
      await idbSet("teacherClass", null);
      await idbSet("teacherSection", null);
      await syncToFirebase();
      return loadSetup();
    }

    if (userType === "Teacher") {
      if (!selSch || !selCls || !selSec) {
        alert("Please select school, class, and section.");
        return;
      }
      teacherKeysBySchool[selSch] = teacherKeysBySchool[selSch] || {};
      const classMap = teacherKeysBySchool[selSch][selCls] || {};
      const existingKey = classMap[selSec];
      if (existingKey) {
        const inputKey = prompt(`Enter login key for ${selSch} | Class ${selCls} Section ${selSec}:`);
        if (inputKey !== existingKey) {
          alert("Invalid login key.");
          return;
        }
      } else {
        let newKey = prompt(`Set new login key for ${selSch} | Class ${selCls} Section ${selSec}:`);
        if (!newKey || !newKey.trim()) { alert("Invalid key."); return; }
        teacherKeysBySchool[selSch][selCls] = teacherKeysBySchool[selSch][selCls] || {};
        teacherKeysBySchool[selSch][selCls][selSec] = newKey.trim();
        await idbSet("teacherKeysBySchool", teacherKeysBySchool);
        await syncToFirebase();
      }

      selectedSchool  = selSch;
      selectedClass   = selCls;
      selectedSection = selSec;
      await idbSet("currentSchool", selectedSchool);
      await idbSet("teacherClass", selectedClass);
      await idbSet("teacherSection", selectedSection);
      await syncToFirebase();
      return loadSetup();
    }
  };

  editSetupBtn.onclick = (e) => {
    e.preventDefault();
    show(setupForm);
    hide(setupDisplay);
    resetViews();
  };

  addClassBtn.onclick = async (e) => {
    e.preventDefault();
    if (!selectedSchool) {
      alert("Please select (or create) a school first.");
      return;
    }
    const clsName = newClassInput.value.trim();
    if (!clsName) {
      alert("Enter a valid class name.");
      return;
    }
    classesBySchool[selectedSchool] = classesBySchool[selectedSchool] || [];
    if (!classesBySchool[selectedSchool].includes(clsName)) {
      classesBySchool[selectedSchool].push(clsName);
      await idbSet("classesBySchool", classesBySchool);
      await syncToFirebase();
    }
    newClassInput.value = "";
    populateClassDropdown();
  };

  addSectionBtn.onclick = async (e) => {
    e.preventDefault();
    if (!selectedSchool || !classSelect.value) {
      alert("First select (or create) a class, then add sections.");
      return;
    }
    const secName = newSectionInput.value.trim();
    if (!secName) {
      alert("Enter a valid section name.");
      return;
    }
    const cls = classSelect.value;
    sectionsBySchool[selectedSchool] = sectionsBySchool[selectedSchool] || {};
    sectionsBySchool[selectedSchool][cls] = sectionsBySchool[selectedSchool][cls] || [];
    if (!sectionsBySchool[selectedSchool][cls].includes(secName)) {
      sectionsBySchool[selectedSchool][cls].push(secName);
      await idbSet("sectionsBySchool", sectionsBySchool);
      await syncToFirebase();
    }
    newSectionInput.value = "";
    populateSectionDropdown();
  };

  schoolSelect.onchange = async () => {
    const sel = schoolSelect.value;
    if (!sel) return;
    selectedSchool = sel;
    await ensureSchoolData(selectedSchool);
    await idbSet("currentSchool", selectedSchool);

    classesBySchool  = (await idbGet("classesBySchool"))  || {};
    sectionsBySchool = (await idbGet("sectionsBySchool")) || {};
    populateClassDropdown();
    sectionSelect.innerHTML = `<option disabled selected>-- Select Section --</option>`;
  };

  classSelect.onchange = async () => {
    selectedClass = classSelect.value;
    await idbSet("teacherClass", selectedClass);
    sectionsBySchool = (await idbGet("sectionsBySchool")) || {};
    populateSectionDropdown();
  };

  sectionSelect.onchange = async () => {
    selectedSection = sectionSelect.value;
    await idbSet("teacherSection", selectedSection);
  };

  await loadSetup();

  // -------------------------------------------------------------------------------------------------
  // (10) FINANCIAL SETTINGS SECTION

  const formDiv             = $("financialForm");
  const saveSettings        = $("saveSettings");
  const fineAbsentInput     = $("fineAbsent");
  const fineLateInput       = $("fineLate");
  const fineLeaveInput      = $("fineLeave");
  const fineHalfDayInput    = $("fineHalfDay");
  const eligibilityPctInput = $("eligibilityPct");

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
    hide(formDiv, saveSettings, fineAbsentInput, fineLateInput, fineLeaveInput, fineHalfDayInput, eligibilityPctInput);
    show(settingsCard, editSettings);
  };

  editSettings.onclick = () => {
    hide(settingsCard, editSettings);
    show(formDiv, saveSettings, fineAbsentInput, fineLateInput, fineLeaveInput, fineHalfDayInput, eligibilityPctInput);
  };

  // -------------------------------------------------------------------------------------------------
  // (11) COUNTERS SECTION

  const countersContainer = $("countersContainer");

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

  const sectionCard     = createCounterCard("card-section",     "Section",        "sectionCount");
  const classCard       = createCounterCard("card-class",       "Class",          "classCount");
  const schoolCard      = createCounterCard("card-school",      "School",         "schoolCount");
  const attendanceCard  = createCounterCard("card-attendance",  "Attendance",     "attendanceCount");
  const eligibleCard    = createCounterCard("card-eligible",    "Eligible",       "eligibleCount");
  const debarredCard    = createCounterCard("card-debarred",    "Debarred",       "debarredCount");
  const outstandingCard = createCounterCard("card-outstanding", "Outstanding/Fine","outstandingCount");

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
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(upd);
      })();
    });
  }

  function updateCounters() {
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    const sectionStudents = currentSchoolStudents.filter(s => s.cls === cl && s.sec === sec);
    sectionCountSpan.dataset.target = sectionStudents.length;
    const classStudents = currentSchoolStudents.filter(s => s.cls === cl);
    classCountSpan.dataset.target = classStudents.length;
    schoolCountSpan.dataset.target = currentSchoolStudents.length;

    let totalP = 0, totalA = 0, totalLt = 0, totalHD = 0, totalL = 0;
    Object.entries(currentSchoolAttendance).forEach(([date, rec]) => {
      sectionStudents.forEach(s => {
        const code = rec[s.adm];
        if (!code) { totalA++; }
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
    const attendanceTotal = totalP + totalA + totalLt + totalHD + totalL;
    attendanceCountSpan.dataset.target = attendanceTotal;

    let eligibleCount = 0, debarredCount = 0, outstandingCount = 0;
    currentSchoolStudents.forEach(s => {
      if (s.cls !== cl || s.sec !== sec) return;
      let p=0, a=0, lt=0, hd=0, l=0, totalDays=0;
      Object.values(currentSchoolAttendance).forEach(rec => {
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
      const paid = (currentSchoolPayments[s.adm] || []).reduce((acc, pmt) => acc + pmt.amount, 0);
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

  sectionCard.onclick = () => {
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    const list = currentSchoolStudents
      .filter(s => s.cls === cl && s.sec === sec)
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Class ${cl} Section ${sec}:\n\n${list || "No students found."}`);
  };

  classCard.onclick = () => {
    const cl = classSelect.value;
    const list = currentSchoolStudents
      .filter(s => s.cls === cl)
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Class ${cl} (All Sections):\n\n${list || "No students found."}`);
  };

  schoolCard.onclick = () => {
    const classes = [...new Set(currentSchoolStudents.map(s => s.cls))].sort();
    let details = "";
    classes.forEach(cl => {
      const classStudents = currentSchoolStudents.filter(s => s.cls === cl);
      details += `Class ${cl} (Total ${classStudents.length} students):\n`;
      classStudents.forEach((s, idx) => {
        details += `  ${idx + 1}. Adm#: ${s.adm}  Name: ${s.name}\n`;
      });
      details += "\n";
    });
    alert(`School Overview:\n\n${details || "No students in school."}`);
  };

  attendanceCard.onclick = () => {
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    let totalP = 0, totalA = 0, totalLt = 0, totalHD = 0, totalL = 0;
    Object.entries(currentSchoolAttendance).forEach(([date, rec]) => {
      currentSchoolStudents.filter(s => s.cls === cl && s.sec === sec).forEach(s => {
        const code = rec[s.adm];
        if (!code) { totalA++; }
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
    const list = currentSchoolStudents
      .filter(s => {
        if (s.cls !== classSelect.value || s.sec !== sectionSelect.value) return false;
        let p=0, totalDays=0;
        Object.values(currentSchoolAttendance).forEach(rec => {
          if (rec[s.adm]) {
            totalDays++;
            if (rec[s.adm] === "P") p++;
          }
        });
        const pct = totalDays ? (p / totalDays) * 100 : 0;
        let a=0, lt=0, l=0, hd=0;
        Object.values(currentSchoolAttendance).forEach(rec => {
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
        const paid = (currentSchoolPayments[s.adm] || []).reduce((acc, pmt) => acc + pmt.amount, 0);
        const outstanding = fineTotal - paid;
        return outstanding <= 0 && pct >= eligibilityPct;
      })
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Eligible Students:\n\n${list || "No eligible students."}`);
  };

  debarredCard.onclick = () => {
    const list = currentSchoolStudents
      .filter(s => {
        if (s.cls !== classSelect.value || s.sec !== sectionSelect.value) return false;
        let p=0, totalDays=0;
        Object.values(currentSchoolAttendance).forEach(rec => {
          if (rec[s.adm]) {
            totalDays++;
            if (rec[s.adm] === "P") p++;
          }
        });
        const pct = totalDays ? (p / totalDays) * 100 : 0;
        let a=0, lt=0, l=0, hd=0;
        Object.values(currentSchoolAttendance).forEach(rec => {
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
        const paid = (currentSchoolPayments[s.adm] || []).reduce((acc, pmt) => acc + pmt.amount, 0);
        const outstanding = fineTotal - paid;
        return outstanding > 0 || pct < eligibilityPct;
      })
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Debarred Students:\n\n${list || "No debarred students."}`);
  };

  outstandingCard.onclick = () => {
    const list = currentSchoolStudents
      .filter(s => {
        if (s.cls !== classSelect.value || s.sec !== sectionSelect.value) return false;
        let a=0, lt=0, l=0, hd=0;
        Object.values(currentSchoolAttendance).forEach(rec => {
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
        const paid = (currentSchoolPayments[s.adm] || []).reduce((acc, pmt) => acc + pmt.amount, 0);
        return fineTotal - paid > 0;
      })
      .map((s, i) => {
        let a=0, lt=0, l=0, hd=0;
        Object.values(currentSchoolAttendance).forEach(rec => {
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
        const paid = (currentSchoolPayments[s.adm] || []).reduce((acc, pmt) => acc + pmt.amount, 0);
        const outstanding = fineTotal - paid;
        return `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}  Outstanding: PKR ${outstanding}`;
      })
      .join("\n");
    alert(`Students with Outstanding Fines:\n\n${list || "No outstanding fines."}`);
  };

  // -------------------------------------------------------------------------------------------------
  // (12) STUDENT REGISTRATION SECTION

  const studentsBody            = $("studentsBody");
  const selectAllStudents       = $("selectAllStudents");
  const editSelectedBtn         = $("editSelected");
  const doneEditingBtn          = $("doneEditing");
  const deleteSelectedBtn       = $("deleteSelected");
  const saveRegistrationBtn     = $("saveRegistration");
  const editRegistrationBtn     = $("editRegistration");
  const shareRegistrationBtn    = $("shareRegistration");
  const downloadRegistrationBtn = $("downloadRegistrationPDF");

  $("addStudent").onclick = async (e) => {
    e.preventDefault();
    const n   = $("studentName").value.trim();
    const p   = $("parentName").value.trim();
    const c   = $("parentContact").value.trim();
    const o   = $("parentOccupation").value.trim();
    const a   = $("parentAddress").value.trim();
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    if (!n || !p || !c || !o || !a) { alert("All fields required"); return; }
    if (!/^\d{7,15}$/.test(c)) { alert("Contact must be 7–15 digits"); return; }
    const adm = await genAdmNo();
    currentSchoolStudents.push({ name: n, adm, parent: p, contact: c, occupation: o, address: a, cls: cl, sec });
    studentsBySchool[selectedSchool] = currentSchoolStudents;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    renderStudents();
    updateCounters();
    $("studentName").value      = "";
    $("parentName").value       = "";
    $("parentContact").value    = "";
    $("parentOccupation").value = "";
    $("parentAddress").value    = "";
  };

  function renderStudents() {
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    studentsBody.innerHTML = "";
    let idx = 0;
    currentSchoolStudents.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(currentSchoolAttendance).forEach(rec => { if (rec[s.adm]) stats[rec[s.adm]]++; });
      const total = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const fine  = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid  = (currentSchoolPayments[s.adm]||[]).reduce((a,p)=>a+p.amount, 0);
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
      const tr = cb.closest("tr"), i = +tr.dataset.index, s = currentSchoolStudents[i];
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

  doneEditingBtn.onclick = async () => {
    document.querySelectorAll("#studentsBody tr").forEach(tr => {
      const inps = [...tr.querySelectorAll("input:not(.sel)")];
      if (inps.length === 5) {
        const [n, p, c, o, a] = inps.map(i => i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = currentSchoolStudents.findIndex(x => x.adm === adm);
        if (idx > -1) {
          currentSchoolStudents[idx] = { ...currentSchoolStudents[idx], name: n, parent: p, contact: c, occupation: o, address: a };
        }
      }
    });
    studentsBySchool[selectedSchool] = currentSchoolStudents;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    hide(doneEditingBtn);
    show(editSelectedBtn, deleteSelectedBtn, saveRegistrationBtn);
    renderStudents();
    updateCounters();
  };

  deleteSelectedBtn.onclick = async () => {
    if (!confirm("Delete selected students?")) return;
    const toDel = [...document.querySelectorAll(".sel:checked")].map(cb => +cb.closest("tr").dataset.index);
    currentSchoolStudents = currentSchoolStudents.filter((_, i) => !toDel.includes(i));
    studentsBySchool[selectedSchool] = currentSchoolStudents;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    renderStudents();
    updateCounters();
  };

  saveRegistrationBtn.onclick = async () => {
    if (!doneEditingBtn.classList.contains("hidden")) { alert("Finish editing before saving."); return; }
    studentsBySchool[selectedSchool] = currentSchoolStudents;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    hide($("student-registration").querySelector(".row-inline"), editSelectedBtn, deleteSelectedBtn, selectAllStudents, saveRegistrationBtn);
    show(editRegistrationBtn, shareRegistrationBtn, downloadRegistrationBtn);
    renderStudents();
    updateCounters();
  };

  editRegistrationBtn.onclick = () => {
    show($("student-registration").querySelector(".row-inline"), selectAllStudents, editSelectedBtn, deleteSelectedBtn, saveRegistrationBtn);
    hide(editRegistrationBtn, shareRegistrationBtn, downloadRegistrationBtn);
    renderStudents();
    updateCounters();
  };

  // -------------------------------------------------------------------------------------------------
  // (13) PAYMENT MODAL SECTION

  const paymentModal         = $("paymentModal");
  const payAdmSpan           = $("payAdm");
  const paymentAmountInput   = $("paymentAmount");
  const paymentModalCloseBtn = $("paymentModalClose");
  const savePaymentBtn       = $("savePayment");
  const cancelPaymentBtn     = $("cancelPayment");

  function openPaymentModal(adm) {
    payAdmSpan.textContent = adm;
    paymentAmountInput.value = "";
    show(paymentModal);
  }
  paymentModalCloseBtn.onclick = () => hide(paymentModal);
  savePaymentBtn.onclick = async () => {
    const adm = payAdmSpan.textContent;
    const amt = Number(paymentAmountInput.value) || 0;
    currentSchoolPayments[adm] = currentSchoolPayments[adm] || [];
    currentSchoolPayments[adm].push({ date: new Date().toISOString().split("T")[0], amount: amt });
    paymentsDataBySchool[selectedSchool] = currentSchoolPayments;
    await idbSet("paymentsDataBySchool", paymentsDataBySchool);
    await syncToFirebase();
    hide(paymentModal);
    renderStudents();
    updateCounters();
  };
  cancelPaymentBtn.onclick = () => hide(paymentModal);

  // -------------------------------------------------------------------------------------------------
  // (14) MARK ATTENDANCE SECTION

  const dateInput             = $("dateInput");
  const loadAttendanceBtn     = $("loadAttendance");
  const saveAttendanceBtn     = $("saveAttendance");
  const resetAttendanceBtn    = $("resetAttendance");
  const downloadAttendanceBtn = $("downloadAttendancePDF");
  const shareAttendanceBtn    = $("shareAttendanceSummary");
  const attendanceBodyDiv     = $("attendanceBody");
  const attendanceSummaryDiv  = $("attendanceSummary");

  const statusNames  = { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" };
  const statusColors = { P:"var(--success)", A:"var(--danger)", Lt:"var(--warning)", HD:"#FF9800", L:"var(--info)" };

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = "";
    attendanceSummaryDiv.innerHTML = "";
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    attendanceBodyDiv.style.overflowX = "auto";
    currentSchoolStudents.filter(stu => stu.cls === cl && stu.sec === sec).forEach((stu, i) => {
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

  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert("Pick date"); return; }
    currentSchoolAttendance[date] = {};
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    currentSchoolStudents.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
      const selBtn = attendanceBodyDiv.children[i].querySelector(".att-btn.selected");
      currentSchoolAttendance[date][s.adm] = selBtn ? selBtn.textContent : "A";
    });
    attendanceDataBySchool[selectedSchool] = currentSchoolAttendance;
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
    await syncToFirebase();
    console.log("✅ Attendance data synced to Firebase");
    attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement("table");
    tbl.id = "attendanceSummaryTable";
    tbl.innerHTML = `
      <tr>
        <th>Sr#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th>
      </tr>`;
    currentSchoolStudents.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
      const code = currentSchoolAttendance[date][s.adm];
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
        const st = currentSchoolStudents.find(x => x.adm === adm);
        const msg = `Dear Parent, your child (Adm#: ${adm}) was ${statusNames[currentSchoolAttendance[date][adm]]} on ${date}.`;
        window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`, "_blank");
      };
    });
    hide(attendanceBodyDiv, saveAttendanceBtn);
    show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
    updateCounters();
  };

  resetAttendanceBtn.onclick = () => {
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  downloadAttendanceBtn.onclick = async () => {
    const doc = new jspdf.jsPDF();
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

  shareAttendanceBtn.onclick = () => {
    const cl   = classSelect.value;
    const sec  = sectionSelect.value;
    const date = dateInput.value;
    const header = `*Attendance Report*\nClass ${cl} Sec ${sec} - ${date}`;
    const lines = currentSchoolStudents.filter(s => s.cls === cl && s.sec === sec)
      .map((s, i) => `${i + 1}. ${s.name} (Adm#: ${s.adm}): ${statusNames[currentSchoolAttendance[date][s.adm]]}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n\n" + lines.join("\n"))}`, "_blank");
  };

  // -------------------------------------------------------------------------------------------------
  // (15) ANALYTICS SECTION

  const atg                  = $("analyticsTarget");
  const asel                 = $("analyticsSectionSelect");
  const atype                = $("analyticsType");
  const adateInput           = $("analyticsDate");
  const amonthInput          = $("analyticsMonth");
  const semsInput            = $("semesterStart");
  const semeInput            = $("semesterEnd");
  const ayearInput           = $("yearStart");
  const asearchInput         = $("analyticsSearch");
  const loadAnalyticsBtn     = $("loadAnalytics");
  const resetAnalyticsBtn    = $("resetAnalytics");
  const instructionsDiv      = $("instructions");
  const analyticsContainer   = $("analyticsContainer");
  const graphsDiv            = $("graphs");
  const analyticsActionsDiv  = $("analyticsActions");
  const barChartCanvas       = $("barChart");
  const pieChartCanvas       = $("pieChart");
  const downloadAnalyticsBtn = $("downloadAnalytics");
  const shareAnalyticsBtn    = $("shareAnalytics");

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

  $("analyticsFilterBtn").onclick = () => show($("analyticsFilterModal"));
  $("analyticsFilterClose").onclick = () => hide($("analyticsFilterModal"));
  $("applyAnalyticsFilter").onclick = () => {
    analyticsFilterOptions = Array.from(document.querySelectorAll("#analyticsFilterForm input[type='checkbox']:checked")).map(cb => cb.value) || ["all"];
    analyticsDownloadMode = document.querySelector("#analyticsFilterForm input[name='downloadMode']:checked").value;
    hide($("analyticsFilterModal"));
    if (lastAnalyticsStats.length) {
      renderAnalytics(lastAnalyticsStats, lastAnalyticsRange.from, lastAnalyticsRange.to);
    }
  };

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearchInput].forEach(x => x.classList.add("hidden"));
    [instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv].forEach(x => x.classList.add("hidden"));
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

    const cls = classSelect.value;
    const sec = sectionSelect.value;
    let pool = currentSchoolStudents.filter(s => s.cls === cls && s.sec === sec);
    if (atg.value === "section") pool = pool.filter(s => s.sec === asel.value);
    if (atg.value === "student") {
      const q = asearchInput.value.trim().toLowerCase();
      pool = pool.filter(s => s.adm === q || s.name.toLowerCase().includes(q));
    }

    const stats = pool.map(s => ({ adm: s.adm, name: s.name, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    Object.entries(currentSchoolAttendance).forEach(([d, rec]) => {
      if (d < from || d > to) return;
      stats.forEach(st => {
        if (rec[st.adm]) { st[rec[st.adm]]++; st.total++; }
      });
    });
    stats.forEach(st => {
      const totalFine = st.A * fineRates.A + st.Lt * fineRates.Lt + st.L * fineRates.L + st.HD * fineRates.HD;
      const paid = (currentSchoolPayments[st.adm] || []).reduce((a, p) => a + p.amount, 0);
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

    const tbody = $("analyticsBody");
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

    $("instructions").textContent = `Period: ${from} to ${to}`;
    show(instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv);

    const barCtx = barChartCanvas.getContext("2d");
    if (window.barChartInstance) barChartInstance.destroy();
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

    const totals = filtered.reduce((acc, st) => {
      acc.P  += st.P;
      acc.A  += st.A;
      acc.Lt += st.Lt;
      acc.HD += st.HD;
      acc.L  += st.L;
      return acc;
    }, { P:0, A:0, Lt:0, HD:0, L:0 });

    const pieCtx = pieChartCanvas.getContext("2d");
    if (window.pieChartInstance) pieChartInstance.destroy();
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

  // -------------------------------------------------------------------------------------------------
  // (16) ATTENDANCE REGISTER SECTION

  const loadRegisterBtn      = $("loadRegister");
  const saveRegisterBtn      = $("saveRegister");
  const changeRegisterBtn    = $("changeRegister");
  const downloadRegisterBtn  = $("downloadRegister");
  const shareRegisterBtn     = $("shareRegister");
  const registerTableWrapper = $("registerTableWrapper");
  const registerHeaderRow    = $("registerHeader");
  const registerBodyTbody    = $("registerBody");

  function bindRegisterActions() {
    downloadRegisterBtn.onclick = async () => {
      const doc = new jspdf.jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
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

    shareRegisterBtn.onclick = () => {
      const header = `Attendance Register\n${setupText.textContent}`;
      const rows = Array.from(registerBodyTbody.children).map(tr =>
        Array.from(tr.children).map(td => td.querySelector(".status-text")?.textContent || td.textContent).join(" ")
      );
      window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n" + rows.join("\n"))}`, "_blank");
    };
  }

  loadRegisterBtn.onclick = () => {
    const m = $("registerMonth").value;
    if (!m) { alert("Pick month"); return; }
    const dateKeys = Object.keys(currentSchoolAttendance).filter(d => d.startsWith(m + "-")).sort();
    if (!dateKeys.length) { alert("No attendance marked this month."); return; }

    registerHeaderRow.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` + dateKeys.map(k => `<th>${k.split("-")[2]}</th>`).join("");
    registerBodyTbody.innerHTML = "";

    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    currentSchoolStudents.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
      let row = `<td>${i + 1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      dateKeys.forEach((key, idx) => {
        const c = currentSchoolAttendance[key][s.adm] || "";
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

  saveRegisterBtn.onclick = async () => {
    const m = $("registerMonth").value;
    const dateKeys = Object.keys(currentSchoolAttendance).filter(d => d.startsWith(m + "-")).sort();
    Array.from(registerBodyTbody.children).forEach(tr => {
      const adm = tr.children[1].textContent;
      dateKeys.forEach((key, idx) => {
        const code = tr.children[3 + idx].querySelector(".status-text").textContent;
        if (code) {
          currentSchoolAttendance[key] = currentSchoolAttendance[key] || {};
          currentSchoolAttendance[key][adm] = code;
        } else {
          if (currentSchoolAttendance[key]) delete currentSchoolAttendance[key][adm];
        }
      });
    });
    attendanceDataBySchool[selectedSchool] = currentSchoolAttendance;
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
    await syncToFirebase();
    hide(saveRegisterBtn);
    show(changeRegisterBtn, downloadRegisterBtn, shareRegisterBtn);
    bindRegisterActions();
    updateCounters();
  };

  changeRegisterBtn.onclick = () => {
    hide(registerTableWrapper, changeRegisterBtn, downloadRegisterBtn, shareRegisterBtn, saveRegisterBtn);
    registerHeaderRow.innerHTML = "";
    registerBodyTbody.innerHTML = "";
    show(loadRegisterBtn);
  };

  bindRegisterActions();

  // -------------------------------------------------------------------------------------------------
  // (17) BACKUP, RESTORE & RESET SECTION

  const chooseBackupFolderBtn = $("chooseBackupFolder");
  const restoreDataBtn        = $("restoreData");
  const restoreFileInput      = $("restoreFile");
  const resetDataBtn          = $("resetData");
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
      teacherKeysBySchool    = data.teacherKeysBySchool    || {};
      classesBySchool        = data.classesBySchool        || {};
      sectionsBySchool       = data.sectionsBySchool       || {};
      selectedSchool         = data.currentSchool          || null;
      selectedClass          = data.teacherClass           || null;
      selectedSection        = data.teacherSection         || null;

      await Promise.all([
        idbSet("studentsBySchool", studentsBySchool),
        idbSet("attendanceDataBySchool", attendanceDataBySchool),
        idbSet("paymentsDataBySchool", paymentsDataBySchool),
        idbSet("lastAdmNoBySchool", lastAdmNoBySchool),
        idbSet("fineRates", fineRates),
        idbSet("eligibilityPct", eligibilityPct),
        idbSet("schools", schools),
        idbSet("teacherKeysBySchool", teacherKeysBySchool),
        idbSet("classesBySchool", classesBySchool),
        idbSet("sectionsBySchool", sectionsBySchool),
        idbSet("currentSchool", selectedSchool),
        idbSet("teacherClass", selectedClass),
        idbSet("teacherSection", selectedSection)
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
    teacherKeysBySchool    = {};
    classesBySchool        = {};
    sectionsBySchool       = {};
    selectedSchool         = null;
    selectedClass          = null;
    selectedSection        = null;

    await Promise.all([
      idbSet("studentsBySchool", studentsBySchool),
      idbSet("attendanceDataBySchool", attendanceDataBySchool),
      idbSet("paymentsDataBySchool", paymentsDataBySchool),
      idbSet("lastAdmNoBySchool", lastAdmNoBySchool),
      idbSet("fineRates", fineRates),
      idbSet("eligibilityPct", eligibilityPct),
      idbSet("schools", schools),
      idbSet("teacherKeysBySchool", teacherKeysBySchool),
      idbSet("classesBySchool", classesBySchool),
      idbSet("sectionsBySchool", sectionsBySchool),
      idbSet("currentSchool", null),
      idbSet("teacherClass", null),
      idbSet("teacherSection", null)
    ]);
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
        teacherKeysBySchool,
        classesBySchool,
        sectionsBySchool,
        currentSchool: selectedSchool,
        teacherClass: selectedClass,
        teacherSection: selectedSection
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

  // -------------------------------------------------------------------------------------------------
  // (18) SERVICE WORKER REGISTRATION

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(console.error);
  }

  // -------------------------------------------------------------------------------------------------
  // (19) Firebase onValue Listener (Sync from Firebase to IndexedDB/UI)

  onValue(appDataRef, async (snapshot) => {
    if (!snapshot.exists()) {
      console.warn("⚠️ /appData missing in Firebase—restoring default structure...");
      const defaultPayload = {
        studentsBySchool: {},
        attendanceDataBySchool: {},
        paymentsDataBySchool: {},
        lastAdmNoBySchool: {},
        fineRates: { A:50, Lt:20, L:10, HD:30 },
        eligibilityPct: 75,
        schools: [],
        teacherKeysBySchool: {},
        classesBySchool: {},
        sectionsBySchool: {}
      };
      await dbSet(appDataRef, defaultPayload);
      studentsBySchool       = {};
      attendanceDataBySchool = {};
      paymentsDataBySchool   = {};
      lastAdmNoBySchool      = {};
      fineRates              = defaultPayload.fineRates;
      eligibilityPct         = defaultPayload.eligibilityPct;
      schools                = [];
      teacherKeysBySchool    = {};
      classesBySchool        = {};
      sectionsBySchool       = {};
      await Promise.all([
        idbSet("studentsBySchool", studentsBySchool),
        idbSet("attendanceDataBySchool", attendanceDataBySchool),
        idbSet("paymentsDataBySchool", paymentsDataBySchool),
        idbSet("lastAdmNoBySchool", lastAdmNoBySchool),
        idbSet("fineRates", fineRates),
        idbSet("eligibilityPct", eligibilityPct),
        idbSet("schools", schools),
        idbSet("teacherKeysBySchool", teacherKeysBySchool),
        idbSet("classesBySchool", classesBySchool),
        idbSet("sectionsBySchool", sectionsBySchool)
      ]);
      return loadSetup();
    }

    const data = snapshot.val();
    studentsBySchool       = data.studentsBySchool       || {};
    attendanceDataBySchool = data.attendanceDataBySchool || {};
    paymentsDataBySchool   = data.paymentsDataBySchool   || {};
    lastAdmNoBySchool      = data.lastAdmNoBySchool      || {};
    fineRates              = data.fineRates              || { A:50, Lt:20, L:10, HD:30 };
    eligibilityPct         = data.eligibilityPct         || 75;
    schools                = data.schools                || [];
    teacherKeysBySchool    = data.teacherKeysBySchool    || {};
    classesBySchool        = data.classesBySchool        || {};
    sectionsBySchool       = data.sectionsBySchool       || {};

    await Promise.all([
      idbSet("studentsBySchool", studentsBySchool),
      idbSet("attendanceDataBySchool", attendanceDataBySchool),
      idbSet("paymentsDataBySchool", paymentsDataBySchool),
      idbSet("lastAdmNoBySchool", lastAdmNoBySchool),
      idbSet("fineRates", fineRates),
      idbSet("eligibilityPct", eligibilityPct),
      idbSet("schools", schools),
      idbSet("teacherKeysBySchool", teacherKeysBySchool),
      idbSet("classesBySchool", classesBySchool),
      idbSet("sectionsBySchool", sectionsBySchool)
    ]);
    return loadSetup();
  });

  // -------------------------------------------------------------------------------------------------
  // (20) Admission Number Generator

  async function genAdmNo() {
    currentSchoolLastAdm++;
    lastAdmNoBySchool[selectedSchool] = currentSchoolLastAdm;
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
    await syncToFirebase();
    return String(currentSchoolLastAdm).padStart(4, "0");
  }
}
