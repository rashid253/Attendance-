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
