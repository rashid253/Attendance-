// setup.js

import { database } from "./firebase-config.js";
import {
  ref as dbRef,
  set as dbSet,
  onValue
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// --------------------
// DOM elements
// --------------------
const setupSection       = document.getElementById("teacher-setup");
const schoolInput        = document.getElementById("schoolInput");
const schoolSelect       = document.getElementById("schoolSelect");
const saveSetupBtn       = document.getElementById("saveSetup");
const schoolListDiv      = document.getElementById("schoolList");

// We'll reuse the same dropdown for signup in auth.js:
const signupDropdown     = document.getElementById("schoolRegisterSelect");
const classRegisterSelect   = document.getElementById("classRegisterSelect");
const sectionRegisterSelect = document.getElementById("sectionRegisterSelect");

// Track current list of schools
let schools = [];
let isAdmin = false;

// --------------------
// 1) Load existing schools from Realtime Database
// --------------------
function loadSchools() {
  const ref = dbRef(database, "appData/schools");
  onValue(ref, snapshot => {
    schools = snapshot.exists() ? snapshot.val() : [];
    renderSchools();
    if (isAdmin) populateAdminDropdown();
    populateSignupDropdown();
  }, error => {
    console.error("onValue error for appData/schools:", error);
  });
}

// --------------------
// 2) Render schools list in setupSection
// --------------------
function renderSchools() {
  schoolListDiv.innerHTML = "";
  schools.forEach((s, idx) => {
    const itemDiv = document.createElement("div");
    itemDiv.textContent = s;
    itemDiv.classList.add("school-item");
    // If admin, add a delete button next to each school
    if (isAdmin) {
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.classList.add("btn", "btn-sm");
      delBtn.style.marginLeft = "0.5em";
      delBtn.addEventListener("click", async () => {
        // Remove this school from array and write back
        const updated = schools.filter((_, i) => i !== idx);
        try {
          await dbSet(dbRef(database, "appData/schools"), updated);
        } catch (err) {
          console.error("Error deleting school:", err);
          alert("کچھ غلط ہوا: " + err.message);
        }
      });
      itemDiv.appendChild(delBtn);
    }
    schoolListDiv.appendChild(itemDiv);
  });
}

// --------------------
// 3) Populate admin's "schoolSelect" dropdown
// --------------------
function populateAdminDropdown() {
  schoolSelect.innerHTML = '<option disabled selected>-- Select School --</option>';
  schools.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    schoolSelect.appendChild(opt);
  });
}

// --------------------
// 4) Populate Signup dropdown for principals/teachers
// --------------------
function populateSignupDropdown() {
  signupDropdown.innerHTML =
    '<option disabled selected>-- Select School (for principal/teacher) --</option>';
  schools.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    signupDropdown.appendChild(opt);
  });
}

// --------------------
// 5) Handle adding a new school (Admin only)
// --------------------
saveSetupBtn.addEventListener("click", async () => {
  const newSchool = schoolInput.value.trim();
  if (!newSchool) {
    alert("براہِ کرم اسکول کا نام درج کریں!");
    return;
  }
  // Prevent duplicate names
  if (schools.includes(newSchool)) {
    alert("یہ اسکول پہلے ہی موجود ہے۔");
    return;
  }
  const updatedSchools = [...schools, newSchool];
  try {
    await dbSet(dbRef(database, "appData/schools"), updatedSchools);
    schoolInput.value = "";
    alert("اسکول شامل ہو گیا!");
  } catch (err) {
    console.error("Error writing schools:", err);
    alert("کچھ غلط ہوا: " + err.message);
  }
});

// --------------------
// 6) Show principal's view (read-only school)
// --------------------
function showPrincipalSetup(school) {
  // Hide admin-only inputs
  schoolInput.parentElement.classList.add("hidden");
  schoolSelect.parentElement.classList.add("hidden");
  saveSetupBtn.classList.add("hidden");
  // Display principal's assigned school
  const infoDiv = document.createElement("div");
  infoDiv.innerHTML = `<strong>آپ کا اسکول:</strong> ${school}`;
  infoDiv.classList.add("card");
  setupSection.appendChild(infoDiv);
}

// --------------------
// 7) Show teacher's view (read-only school, class, section)
// --------------------
function showTeacherSetup(school, cls, sec) {
  // Hide admin-only inputs
  schoolInput.parentElement.classList.add("hidden");
  schoolSelect.parentElement.classList.add("hidden");
  saveSetupBtn.classList.add("hidden");
  // Hide principal sign-up dropdown inside setup (if any)
  // Display teacher's assigned school, class & section
  const infoDiv = document.createElement("div");
  infoDiv.innerHTML =
    `<strong>آپ کا اسکول:</strong> ${school}<br>` +
    `<strong>آپ کی کلاس:</strong> ${cls}<br>` +
    `<strong>آپ کا سیکشن:</strong> ${sec}`;
  infoDiv.classList.add("card");
  setupSection.appendChild(infoDiv);
}

// --------------------
// 8) Initialize setup section based on user role
// --------------------
function initSetup() {
  const profile = window.currentUserProfile;
  if (!profile) return;
  const role = profile.role;
  if (role === "admin") {
    isAdmin = true;
    // Ensure inputs are visible
    schoolInput.parentElement.classList.remove("hidden");
    schoolSelect.parentElement.classList.remove("hidden");
    saveSetupBtn.classList.remove("hidden");
    renderSchools();
    populateAdminDropdown();
  } else if (role === "principal") {
    showPrincipalSetup(profile.school);
  } else if (role === "teacher") {
    showTeacherSetup(profile.school, profile.class, profile.section);
  }
  loadSchools();
}

// --------------------
// 9) Listen for userLoggedIn event (fired by auth.js after login)
// --------------------
document.addEventListener("userLoggedIn", initSetup);

// --------------------
// 10) Immediately subscribe to schools in case Admin already logged in
// --------------------
if (window.currentUserProfile) {
  initSetup();
} else {
  loadSchools();
}
