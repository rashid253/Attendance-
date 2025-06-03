// setup.js
// -------------------------------------------------------------------------------------------
// This file populates “appData/schools” and also drives the “Setup” panel (Admin / Principal / Teacher).
// It also fills the <select id="schoolRegisterSelect"> dropdown for principal/teacher signup.

import { database } from "./firebase-config.js";
import {
  ref as dbRef,
  set as dbSet,
  onValue
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// --------------------
// 1) DOM elements (must match index.html exactly)
// --------------------
const setupSection          = document.getElementById("teacher-setup");
const schoolInput           = document.getElementById("schoolInput");
const schoolSelect          = document.getElementById("schoolSelect");
const saveSetupBtn          = document.getElementById("saveSetup");
const schoolListDiv         = document.getElementById("schoolList");

// Reuse these for populating the Sign-Up form in auth.js:
const signupDropdown        = document.getElementById("schoolRegisterSelect");
const classRegisterSelect   = document.getElementById("classRegisterSelect");
const sectionRegisterSelect = document.getElementById("sectionRegisterSelect");

// --------------------
// 2) Track current list of schools
// --------------------
let schools = [];
let isAdmin = false;

// --------------------
// 3) Load existing schools from Realtime Database
// --------------------
function loadSchools() {
  const ref = dbRef(database, "appData/schools");
  onValue(ref, snapshot => {
    if (!snapshot.exists()) {
      schools = [];
    } else {
      schools = snapshot.val();
    }
    renderSchools();
    populateSignupDropdown();
    populateAdminDropdown();
  });
}

// --------------------
// 4) Render “Schools List” (for Admin to see all schools)
// --------------------
function renderSchools() {
  schoolListDiv.innerHTML = "";
  schools.forEach(s => {
    const itemDiv = document.createElement("div");
    itemDiv.classList.add("card");
    itemDiv.textContent = s;
    schoolListDiv.appendChild(itemDiv);
  });
}

// --------------------
// 5) Populate “Admin” dropdown (in case Admin wants to edit an existing school)
// --------------------
function populateAdminDropdown() {
  // Only show if Admin is logged in
  if (!isAdmin) {
    schoolSelect.parentElement.classList.add("hidden");
    return;
  }
  schoolSelect.parentElement.classList.remove("hidden");
  schoolSelect.innerHTML = `<option disabled selected>-- Select School to Edit --</option>`;
  schools.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    schoolSelect.appendChild(opt);
  });
}

// --------------------
// 6) Populate “Sign‐Up” dropdown (for Principal/Teacher)
// --------------------
function populateSignupDropdown() {
  signupDropdown.classList.remove("hidden");
  signupDropdown.innerHTML =
    `<option disabled selected>-- Select School (for principal/teacher) --</option>`;
  schools.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    signupDropdown.appendChild(opt);
  });
}

// --------------------
// 7) Handle “Save” button click (only Admin can add a new school)
// --------------------
saveSetupBtn.addEventListener("click", async () => {
  const newSchool = schoolInput.value.trim();
  if (!newSchool) {
    alert("براہِ کرم اسکول کا نام درج کریں!");
    return;
  }
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
    console.error("Error adding school:", err);
    alert("اسکول شامل کرنے میں خرابی: " + err.message);
  }
});

// --------------------
// 8) Show/hide UI based on “role”
// --------------------
function showPrincipalSetup(school) {
  // If Principal, hide Admin fields & show a card with their assigned school
  schoolInput.parentElement.classList.add("hidden");
  schoolSelect.parentElement.classList.add("hidden");
  saveSetupBtn.classList.add("hidden");

  const infoDiv = document.createElement("div");
  infoDiv.classList.add("card");
  infoDiv.innerHTML = `<strong>آپ کا اسکول:</strong> ${school}`;
  setupSection.appendChild(infoDiv);
}

function showTeacherSetup(school, cls, sec) {
  // If Teacher, hide Admin fields & show a card with their assigned school, class & section
  schoolInput.parentElement.classList.add("hidden");
  schoolSelect.parentElement.classList.add("hidden");
  saveSetupBtn.classList.add("hidden");

  const infoDiv = document.createElement("div");
  infoDiv.classList.add("card");
  infoDiv.innerHTML =
    `<strong>آپ کا اسکول:</strong> ${school}<br>` +
    `<strong>آپ کی کلاس:</strong> ${cls}<br>` +
    `<strong>آپ کا سیکشن:</strong> ${sec}`;
  setupSection.appendChild(infoDiv);
}

// --------------------
// 9) When user logs in (event from auth.js), configure the Setup panel
// --------------------
function initSetup() {
  const profile = window.currentUserProfile;
  if (!profile) return;

  // Clear out any previously appended infoDiv
  setupSection.querySelectorAll(".card").forEach(el => el.remove());
  isAdmin = false;

  const role = profile.role;
  if (role === "admin") {
    isAdmin = true;
    // Show Admin inputs
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
  // Always re-load schools (so dropdowns stay fresh)
  loadSchools();
}

// --------------------
// 10) Listen for “userLoggedIn” (fired by auth.js) and/or load schools immediately if already logged in
// --------------------
document.addEventListener("userLoggedIn", initSetup);
if (window.currentUserProfile) {
  initSetup();
} else {
  loadSchools();
}
