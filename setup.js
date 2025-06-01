// setup.js
import { database } from "./firebase-config.js";
import { ref as dbRef, set as dbSet, get as dbGet } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// DOM Elements
const setupForm         = document.getElementById("setupForm");
const setupDisplay      = document.getElementById("setupDisplay");
const schoolInput       = document.getElementById("schoolInput");
const schoolSelect      = document.getElementById("schoolSelect");
const classSelect       = document.getElementById("teacherClassSelect");
const sectionSelect     = document.getElementById("teacherSectionSelect");
const setupText         = document.getElementById("setupText");
const saveSetupBtn      = document.getElementById("saveSetup");
const editSetupBtn      = document.getElementById("editSetup");
const schoolListDiv     = document.getElementById("schoolList");

const { get: idbGet, set: idbSet } = window.idbKeyval;

// Global state vars
window.studentsBySchool       = {};  
window.attendanceDataBySchool = {};
window.paymentsDataBySchool   = {};
window.lastAdmNoBySchool      = {};
window.fineRates              = { A:50, Lt:20, L:10, HD:30 };
window.eligibilityPct         = 75;
window.schools                = [];
window.currentSchool          = null;
window.teacherClass           = null;
window.teacherSection         = null;

document.addEventListener("userLoggedIn", async () => {
  const appDataSnap = await dbGet(dbRef(database, "appData"));
  if (appDataSnap.exists()) {
    const appData = appDataSnap.val();
    window.schools                = appData.schools                || [];
    window.studentsBySchool       = appData.studentsBySchool       || {};
    window.attendanceDataBySchool = appData.attendanceDataBySchool || {};
    window.paymentsDataBySchool   = appData.paymentsDataBySchool   || {};
    window.lastAdmNoBySchool      = appData.lastAdmNoBySchool      || {};
    window.fineRates              = appData.fineRates              || window.fineRates;
    window.eligibilityPct         = appData.eligibilityPct         || window.eligibilityPct;
    window.currentSchool          = appData.currentSchool          || null;
    window.teacherClass           = appData.teacherClass           || null;
    window.teacherSection         = appData.teacherSection         || null;
  } else {
    window.schools                = [];
    window.studentsBySchool       = {};
    window.attendanceDataBySchool = {};
    window.paymentsDataBySchool   = {};
    window.lastAdmNoBySchool      = {};
  }
  await renderSetupUI();
});

async function renderSetupUI() {
  const profile = window.currentUserProfile;
  if (!profile) return;

  if (profile.role === "admin") {
    setupForm.querySelector("#schoolInput").classList.remove("hidden");
    setupForm.querySelector("#schoolSelect").classList.remove("hidden");
    classSelect.disabled   = false;
    sectionSelect.disabled = false;
    saveSetupBtn.disabled  = false;

    renderSchoolList();

    if (window.currentSchool) {
      schoolSelect.value    = window.currentSchool;
      classSelect.value     = window.teacherClass;
      sectionSelect.value   = window.teacherSection;
      setupText.textContent = `${window.currentSchool} 🏫 | Class: ${window.teacherClass} | Section: ${window.teacherSection}`;
      setupForm.classList.add("hidden");
      setupDisplay.classList.remove("hidden");
      showMainSections();
    } else {
      setupForm.classList.remove("hidden");
      setupDisplay.classList.add("hidden");
      hideMainSections();
    }
  } else if (profile.role === "principal") {
    const mySchool = profile.school;
    window.currentSchool = mySchool;
    window.teacherClass   = null;
    window.teacherSection = null;

    schoolSelect.innerHTML = `<option value="${mySchool}">${mySchool}</option>`;
    schoolSelect.disabled  = true;
    classSelect.disabled   = false;
    sectionSelect.disabled = false;

    setupForm.classList.remove("hidden");
    setupDisplay.classList.add("hidden");
    hideMainSections();
  } else if (profile.role === "teacher") {
    const mySchool  = profile.school;
    const myClass   = profile.class;
    const mySection = profile.section;

    window.currentSchool = mySchool;
    window.teacherClass  = myClass;
    window.teacherSection= mySection;

    setupText.textContent = `${mySchool} 🏫 | Class: ${myClass} | Section: ${mySection}`;
    setupForm.classList.add("hidden");
    setupDisplay.classList.remove("hidden");
    showMainSections();
  }

  function hideMainSections() {
    [
      document.getElementById("financial-settings"),
      document.getElementById("animatedCounters"),
      document.getElementById("student-registration"),
      document.getElementById("attendance-section"),
      document.getElementById("analytics-section"),
      document.getElementById("register-section")
    ].forEach(sec => sec.classList.add("hidden"));
  }
  function showMainSections() {
    [
      document.getElementById("financial-settings"),
      document.getElementById("animatedCounters"),
      document.getElementById("student-registration"),
      document.getElementById("attendance-section"),
      document.getElementById("analytics-section"),
      document.getElementById("register-section")
    ].forEach(sec => sec.classList.remove("hidden"));
  }
}

function renderSchoolList() {
  schoolListDiv.innerHTML = "";
  window.schools.forEach((sch, idx) => {
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
      const newName = prompt("Edit School Name:", window.schools[idx]);
      if (newName?.trim()) {
        const oldName = window.schools[idx];
        window.schools[idx] = newName.trim();
        window.studentsBySchool[newName] = window.studentsBySchool[oldName] || [];
        delete window.studentsBySchool[oldName];
        window.attendanceDataBySchool[newName] = window.attendanceDataBySchool[oldName] || {};
        delete window.attendanceDataBySchool[oldName];
        window.paymentsDataBySchool[newName] = window.paymentsDataBySchool[oldName] || {};
        delete window.paymentsDataBySchool[oldName];
        window.lastAdmNoBySchool[newName] = window.lastAdmNoBySchool[oldName] || 0;
        delete window.lastAdmNoBySchool[oldName];
        if (window.currentSchool === oldName) {
          window.currentSchool = newName.trim();
        }
        await syncAppDataToFirebase();
        renderSchoolList();
      }
    };
  });

  document.querySelectorAll(".delete-school").forEach(btn => {
    btn.onclick = async () => {
      const idx = +btn.dataset.idx;
      if (!confirm(`Delete school "${window.schools[idx]}"?`)) return;
      const removed = window.schools.splice(idx, 1)[0];
      delete window.studentsBySchool[removed];
      delete window.attendanceDataBySchool[removed];
      delete window.paymentsDataBySchool[removed];
      delete window.lastAdmNoBySchool[removed];
      if (window.currentSchool === removed) {
        window.currentSchool = null;
        window.teacherClass = null;
        window.teacherSection = null;
      }
      await syncAppDataToFirebase();
      renderSchoolList();
    };
  });
}

saveSetupBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  const profile = window.currentUserProfile;
  if (profile.role === "admin") {
    const newSchool = schoolInput.value.trim();
    if (newSchool) {
      if (!window.schools.includes(newSchool)) {
        window.schools.push(newSchool);
        window.studentsBySchool[newSchool] = [];
        window.attendanceDataBySchool[newSchool] = {};
        window.paymentsDataBySchool[newSchool] = {};
        window.lastAdmNoBySchool[newSchool] = 0;
      }
      schoolInput.value = "";
      await syncAppDataToFirebase();
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
    window.currentSchool = selSchool;
    window.teacherClass  = selClass;
    window.teacherSection= selSection;
    await syncAppDataToFirebase();
    setupText.textContent = `${selSchool} 🏫 | Class: ${selClass} | Section: ${selSection}`;
    setupForm.classList.add("hidden");
    setupDisplay.classList.remove("hidden");
    showMainSections();
  } else if (profile.role === "principal") {
    const mySchool = profile.school;
    const selClass   = classSelect.value;
    const selSection = sectionSelect.value;
    if (!selClass || !selSection) {
      alert("Please select a class and section.");
      return;
    }
    window.currentSchool = mySchool;
    window.teacherClass  = selClass;
    window.teacherSection= selSection;
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
    studentsBySchool: window.studentsBySchool,
    attendanceDataBySchool: window.attendanceDataBySchool,
    paymentsDataBySchool: window.paymentsDataBySchool,
    lastAdmNoBySchool: window.lastAdmNoBySchool,
    fineRates: window.fineRates,
    eligibilityPct: window.eligibilityPct,
    schools: window.schools,
    currentSchool: window.currentSchool,
    teacherClass: window.teacherClass,
    teacherSection: window.teacherSection
  };
  try {
    await dbSet(dbRef(database, "appData"), payload);
    console.log("✅ App Data Synced to Firebase");
  } catch (err) {
    console.error("Sync failed:", err);
  }
}
