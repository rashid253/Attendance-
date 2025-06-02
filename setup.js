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
const schoolInput    = document.getElementById("schoolInput");
const schoolSelect   = document.getElementById("schoolSelect");
const saveSetupBtn   = document.getElementById("saveSetup");
const schoolListDiv  = document.getElementById("schoolList");

let schools = [];

// --------------------
// 1) Load existing schools
// --------------------
function loadSchools() {
  const ref = dbRef(database, "appData/schools");
  onValue(ref, snapshot => {
    schools = snapshot.exists() ? snapshot.val() : [];
    renderSchools();
    populateDropdowns();
  }, error => {
    console.error("onValue error for appData/schools:", error);
  });
}

// --------------------
// 2) Populate both signup & setup dropdowns
// --------------------
function populateDropdowns() {
  // Signup dropdown
  const signupDropdown = document.getElementById("schoolRegisterSelect");
  signupDropdown.innerHTML = '<option disabled selected>-- Select School --</option>';
  schools.forEach(s => {
    const opt = document.createElement("option");
    opt.textContent = s;
    opt.value = s;
    signupDropdown.appendChild(opt);
  });

  // Setup dropdown
  schoolSelect.innerHTML = '<option disabled selected>-- Select School --</option>';
  schools.forEach(s => {
    const opt = document.createElement("option");
    opt.textContent = s;
    opt.value = s;
    schoolSelect.appendChild(opt);
  });
}

// --------------------
// 3) Render existing schools on setup page
// --------------------
function renderSchools() {
  schoolListDiv.innerHTML = "";
  schools.forEach(s => {
    const div = document.createElement("div");
    div.textContent = s;
    schoolListDiv.appendChild(div);
  });
}

// --------------------
// 4) Save new school
// --------------------
saveSetupBtn.addEventListener("click", async () => {
  const newSchool = schoolInput.value.trim();
  if (!newSchool) {
    alert("براہِ کرم اسکول کا نام درج کریں!");
    return;
  }
  const updatedSchools = [...schools, newSchool];
  try {
    await dbSet(dbRef(database, "appData/schools"), updatedSchools);
    schoolInput.value = "";
    alert("Skool شامل ہو گیا!");
  } catch (err) {
    console.error("Error writing schools:", err);
    alert("کچھ غلط ہوا: " + err.message);
  }
});

// --------------------
// Initialize
// --------------------
loadSchools();
