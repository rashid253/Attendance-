// setup.js

import { database } from "./firebase-config.js";
import {
  ref as dbRef,
  set as dbSet,
  onValue
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// DOM elements
const adminSetupDiv       = document.getElementById("admin-setup");
const principalSetupDiv   = document.getElementById("principal-setup");
const teacherSetupInfoDiv = document.getElementById("teacher-setup-info");

const schoolInput        = document.getElementById("schoolInput");
const saveSetupBtn       = document.getElementById("saveSetup");
const schoolSelect       = document.getElementById("schoolSelect");
const deleteSetupBtn     = document.getElementById("deleteSetup");
const schoolListDiv      = document.getElementById("schoolList");

const principalInfoDiv   = document.getElementById("principal-info");
const teacherInfoDiv     = document.getElementById("teacher-info");

// Signup dropdowns need populating too
const signupSchoolSelect   = document.getElementById("schoolRegisterSelect");
const classRegisterSelect  = document.getElementById("classRegisterSelect");
const sectionRegisterSelect= document.getElementById("sectionRegisterSelect");

let schools = [];
let currentProfile = null;

// 1) Load schools from Realtime Database
function loadSchools() {
  const ref = dbRef(database, "appData/schools");
  onValue(ref, snapshot => {
    schools = snapshot.exists() ? snapshot.val() : [];
    renderSchoolList();
    populateAdminDropdown();
    populateSignupDropdown();
    refreshUserView();
  }, error => {
    console.error("onValue error for appData/schools:", error);
  });
}

// 2) Render list of schools with delete buttons (Admin)
function renderSchoolList() {
  schoolListDiv.innerHTML = "";
  schools.forEach((s, idx) => {
    const itemDiv = document.createElement("div");
    itemDiv.classList.add("school-item");
    itemDiv.innerHTML = `
      <span>${s}</span>
      <button class="btn btn-sm btn-danger" data-index="${idx}">Delete</button>
    `;
    itemDiv.querySelector("button").addEventListener("click", async () => {
      const updated = schools.filter((_, i) => i !== idx);
      try {
        await dbSet(dbRef(database, "appData/schools"), updated);
      } catch (err) {
        console.error("Error deleting school:", err);
        alert("کچھ غلط ہوا: " + err.message);
      }
    });
    schoolListDiv.appendChild(itemDiv);
  });
}

// 3) Populate Admin's delete dropdown
function populateAdminDropdown() {
  schoolSelect.innerHTML = '<option disabled selected>-- Select School to Delete --</option>';
  schools.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    schoolSelect.appendChild(opt);
  });
}

// 4) Populate signup school dropdown
function populateSignupDropdown() {
  signupSchoolSelect.innerHTML = '<option disabled selected>-- Select School --</option>';
  schools.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    signupSchoolSelect.appendChild(opt);
  });
}

// 5) Add new school (Admin)
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
  try {
    await dbSet(dbRef(database, "appData/schools"), [...schools, newSchool]);
    schoolInput.value = "";
    alert("اسکول شامل ہو گیا!");
  } catch (err) {
    console.error("Error adding school:", err);
    alert("کچھ غلط ہوا: " + err.message);
  }
});

// 6) Delete selected school (Admin)
deleteSetupBtn.addEventListener("click", async () => {
  const selected = schoolSelect.value;
  if (!selected) {
    alert("براہِ کرم حذف کرنے کے لیے اسکول منتخب کریں۔");
    return;
  }
  const updated = schools.filter(s => s !== selected);
  try {
    await dbSet(dbRef(database, "appData/schools"), updated);
    alert("اسکول حذف ہو گیا!");
  } catch (err) {
    console.error("Error deleting school:", err);
    alert("کچھ غلط ہوا: " + err.message);
  }
});

// 7) Show/Hide setup UI based on role
function refreshUserView() {
  currentProfile = window.currentUserProfile;
  if (!currentProfile) return;

  const { role, school, class: cls, section } = currentProfile;

  // Hide all sub-sections
  adminSetupDiv.classList.add("hidden");
  principalSetupDiv.classList.add("hidden");
  teacherSetupInfoDiv.classList.add("hidden");

  if (role === "admin") {
    // Show Admin UI
    adminSetupDiv.classList.remove("hidden");
  }
  else if (role === "principal") {
    // Show Principal's read-only info
    principalInfoDiv.innerHTML = `<p><strong>آپ کا اسکول:</strong> ${school}</p>`;
    principalSetupDiv.classList.remove("hidden");
  }
  else if (role === "teacher") {
    // Show Teacher's read-only info
    teacherInfoDiv.innerHTML = `
      <p><strong>آپ کا اسکول:</strong> ${school}</p>
      <p><strong>آپ کی کلاس:</strong> ${cls}</p>
      <p><strong>آپ کا سیکشن:</strong> ${section}</p>
    `;
    teacherSetupInfoDiv.classList.remove("hidden");
  }
}

// 8) Listen for login event from auth.js
document.addEventListener("userLoggedIn", () => {
  refreshUserView();
});

// 9) In case user already logged in on load
if (window.currentUserProfile) {
  refreshUserView();
}

// Initialize loading of schools
loadSchools();
