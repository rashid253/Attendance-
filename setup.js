// setup.js

import { database } from "./firebase-config.js";
import { ref as dbRef, set as dbSet, get as dbGet } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const setupForm       = document.getElementById("setupForm");
const setupDisplay    = document.getElementById("setupDisplay");
const schoolInput     = document.getElementById("schoolInput");
const schoolSelect    = document.getElementById("schoolSelect");
const classSelect     = document.getElementById("teacherClassSelect");
const sectionSelect   = document.getElementById("teacherSectionSelect");
const setupText       = document.getElementById("setupText");
const saveSetupBtn    = document.getElementById("saveSetup");
const editSetupBtn    = document.getElementById("editSetup");
const schoolListDiv   = document.getElementById("schoolList");

const { get: idbGet, set: idbSet } = window.idbKeyval;

// Global state (mirrors firebase data)
let studentsBySchool       = {};
let attendanceDataBySchool = {};
let paymentsDataBySchool   = {};
let lastAdmNoBySchool      = {};
let fineRates              = { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct         = 75;
let schools                = [];
let currentSchool          = null;
let teacherClass           = null;
let teacherSection         = null;

// Expose hide/show functions at module scope
function hideMainSections() {
  [
    document.getElementById("financial-settings"),
    document.getElementById("animatedCounters"),
    document.getElementById("student-registration"),
    document.getElementById("attendance-section"),
    document.getElementById("analytics-section"),
    document.getElementById("register-section")
  ].forEach(sec => sec && sec.classList.add("hidden"));
}

function showMainSections() {
  [
    document.getElementById("financial-settings"),
    document.getElementById("animatedCounters"),
    document.getElementById("student-registration"),
    document.getElementById("attendance-section"),
    document.getElementById("analytics-section"),
    document.getElementById("register-section")
  ].forEach(sec => sec && sec.classList.remove("hidden"));
}

// Called when the user logs in
document.addEventListener("userLoggedIn", async () => {
  // Fetch appData from Firebase
  const appDataSnap = await dbGet(dbRef(database, "appData"));
  if (appDataSnap.exists()) {
    const appData = appDataSnap.val();
    schools                = appData.schools                || [];
    studentsBySchool       = appData.studentsBySchool       || {};
    attendanceDataBySchool = appData.attendanceDataBySchool || {};
    paymentsDataBySchool   = appData.paymentsDataBySchool   || {};
    lastAdmNoBySchool      = appData.lastAdmNoBySchool      || {};
    fineRates              = appData.fineRates              || fineRates;
    eligibilityPct         = appData.eligibilityPct         || eligibilityPct;
    currentSchool          = appData.currentSchool          || null;
    teacherClass           = appData.teacherClass           || null;
    teacherSection         = appData.teacherSection         || null;
  } else {
    schools = [];
    studentsBySchool = {};
    attendanceDataBySchool = {};
    paymentsDataBySchool = {};
    lastAdmNoBySchool = {};
  }

  await renderSetupUI();
});

// Populate the School dropdown and the list of schools
function populateSchoolDropdown() {
  schoolSelect.innerHTML = '<option disabled selected>-- Select School --</option>';
  schools.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    schoolSelect.appendChild(opt);
  });
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

  document.querySelectorAll(".edit-school").forEach(btn => {
    btn.onclick = async () => {
      const idx = +btn.dataset.idx;
      const newName = prompt("Edit School Name:", schools[idx]);
      if (newName?.trim()) {
        const oldName = schools[idx];
        const trimmed = newName.trim();
        schools[idx] = trimmed;

        // Migrate data keys
        studentsBySchool[trimmed]       = studentsBySchool[oldName]       || [];
        attendanceDataBySchool[trimmed] = attendanceDataBySchool[oldName] || {};
        paymentsDataBySchool[trimmed]   = paymentsDataBySchool[oldName]   || {};
        lastAdmNoBySchool[trimmed]      = lastAdmNoBySchool[oldName]      || 0;
        delete studentsBySchool[oldName];
        delete attendanceDataBySchool[oldName];
        delete paymentsDataBySchool[oldName];
        delete lastAdmNoBySchool[oldName];

        if (currentSchool === oldName) {
          currentSchool = trimmed;
        }
        await syncAppDataToFirebase();
        populateSchoolDropdown();
        renderSchoolList();
      }
    };
  });

  document.querySelectorAll(".delete-school").forEach(btn => {
    btn.onclick = async () => {
      const idx = +btn.dataset.idx;
      const toRemove = schools[idx];
      if (!confirm(`Delete school "${toRemove}"?`)) return;
      schools.splice(idx, 1);
      delete studentsBySchool[toRemove];
      delete attendanceDataBySchool[toRemove];
      delete paymentsDataBySchool[toRemove];
      delete lastAdmNoBySchool[toRemove];
      if (currentSchool === toRemove) {
        currentSchool = null;
        teacherClass  = null;
        teacherSection= null;
      }
      await syncAppDataToFirebase();
      populateSchoolDropdown();
      renderSchoolList();
    };
  });
}

async function renderSetupUI() {
  const profile = window.currentUserProfile;
  if (!profile) return;

  // Populate schoolSelect immediately
  populateSchoolDropdown();
  renderSchoolList();

  if (profile.role === "admin") {
    // Admin can add new school or select existing
    schoolInput.classList.remove("hidden");
    schoolSelect.classList.remove("hidden");
    classSelect.disabled   = false;
    sectionSelect.disabled = false;
    saveSetupBtn.disabled  = false;

    if (currentSchool) {
      // If already set up
      schoolSelect.value    = currentSchool;
      classSelect.value     = teacherClass;
      sectionSelect.value   = teacherSection;
      setupText.textContent = `${currentSchool} 🏫 | Class: ${teacherClass} | Section: ${teacherSection}`;
      setupForm.classList.add("hidden");
      setupDisplay.classList.remove("hidden");
      showMainSections();
    } else {
      setupForm.classList.remove("hidden");
      setupDisplay.classList.add("hidden");
      hideMainSections();
    }
  }
  else if (profile.role === "principal") {
    // Principal: fixed school
    const mySchool = profile.school;
    currentSchool  = mySchool;
    teacherClass   = null;
    teacherSection = null;

    schoolSelect.innerHTML = `<option value="${mySchool}">${mySchool}</option>`;
    schoolSelect.disabled  = true;
    classSelect.disabled   = false;
    sectionSelect.disabled = false;

    setupForm.classList.remove("hidden");
    setupDisplay.classList.add("hidden");
    hideMainSections();
  }
  else if (profile.role === "teacher") {
    // Teacher: fixed school, class, section
    const mySchool  = profile.school;
    const myClass   = profile.class;
    const mySection = profile.section;

    currentSchool  = mySchool;
    teacherClass   = myClass;
    teacherSection = mySection;

    setupText.textContent = `${mySchool} 🏫 | Class: ${myClass} | Section: ${mySection}`;
    setupForm.classList.add("hidden");
    setupDisplay.classList.remove("hidden");
    showMainSections();
  }
}

saveSetupBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  const profile = window.currentUserProfile;
  if (profile.role === "admin") {
    const newSchool = schoolInput.value.trim();
    if (newSchool) {
      if (!schools.includes(newSchool)) {
        schools.push(newSchool);
        studentsBySchool[newSchool]       = [];
        attendanceDataBySchool[newSchool] = {};
        paymentsDataBySchool[newSchool]   = {};
        lastAdmNoBySchool[newSchool]      = 0;
      }
      schoolInput.value = "";
      await syncAppDataToFirebase();
      populateSchoolDropdown();
      renderSchoolList();
      return;
    }
    const selSchool  = schoolSelect.value;
    const selClass   = classSelect.value;
    const selSection = sectionSelect.value;
    if (!selSchool || !selClass || !selSection) {
      alert("Please select a school, class, and section.");
      return;
    }
    currentSchool   = selSchool;
    teacherClass    = selClass;
    teacherSection  = selSection;
    await syncAppDataToFirebase();
    setupText.textContent = `${selSchool} 🏫 | Class: ${selClass} | Section: ${selSection}`;
    setupForm.classList.add("hidden");
    setupDisplay.classList.remove("hidden");
    showMainSections();
  }
  else if (profile.role === "principal") {
    const mySchool    = profile.school;
    const selClass    = classSelect.value;
    const selSection  = sectionSelect.value;
    if (!selClass || !selSection) {
      alert("Please select a class and section.");
      return;
    }
    currentSchool   = mySchool;
    teacherClass    = selClass;
    teacherSection  = selSection;
    await syncAppDataToFirebase();
    setupText.textContent = `${mySchool} 🏫 | Class: ${selClass} | Section: ${selSection}`;
    setupForm.classList.add("hidden");
    setupDisplay.classList.remove("hidden");
    showMainSections();
  }
});

editSetupBtn.addEventListener("click", (e) => {
  e.preventDefault();
  setupForm.classList.remove("hidden");
  setupDisplay.classList.add("hidden");
  hideMainSections();
});

export async function syncAppDataToFirebase() {
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
    console.log("✅ App Data Synced to Firebase");
  } catch (err) {
    console.error("Sync failed:", err);
  }
}
