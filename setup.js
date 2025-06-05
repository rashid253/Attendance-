// setup.js
// --------
// Manages the “Setup” UI: creating/selecting schools and choosing class/section.
// Enforces role-based restrictions (Admin, Principal, Teacher) via custom claims.
// Once a valid setup is saved, fires a “setupDone” event so app.js can proceed.

// Imports
import { auth, db } from "./firebase-config.js";
import { getCurrentUserRole, getCurrentUserClaims } from "./auth.js";
import {
  ref as dbRef,
  get as dbGet,
  set as dbSet,
  onValue
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ───────────────────────────────────────────────────────────────
// GLOBALS & UI ELEMENTS
// ───────────────────────────────────────────────────────────────
let schools = [];            // Array of school names loaded from Realtime DB
let currentUserRole = null;  // "admin" | "principal" | "teacher"
let currentUserClaims = {};  // { role, school, cls, section }

let currentSchool = null;
let currentClass = null;
let currentSection = null;

// UI references
const adminCreateDiv    = document.getElementById("admin-create-school");
const schoolInput       = document.getElementById("schoolInput");
const createSchoolBtn   = document.getElementById("createSchoolBtn");
const schoolSelect      = document.getElementById("schoolSelect");
const classSelect       = document.getElementById("teacherClassSelect");
const sectionSelect     = document.getElementById("teacherSectionSelect");
const saveSetupBtn      = document.getElementById("saveSetupBtn");
const editSetupBtn      = document.getElementById("editSetupBtn");
const setupDisplayDiv   = document.getElementById("setupDisplay");
const setupTextSpan     = document.getElementById("setupText");
const schoolListDiv     = document.getElementById("schoolListContainer");

// ───────────────────────────────────────────────────────────────
// READ / WRITE “schools” ARRAY TO FIREBASE
// ───────────────────────────────────────────────────────────────
async function pushSchoolsToFirebase() {
  try {
    await dbSet(dbRef(db, "schoolsList"), schools);
  } catch (err) {
    console.error("Error writing schoolsList:", err);
  }
}

async function readSchoolsFromFirebase() {
  try {
    const snapshot = await dbGet(dbRef(db, "schoolsList"));
    if (snapshot.exists()) {
      schools = snapshot.val() || [];
    } else {
      schools = [];
    }
  } catch (err) {
    console.error("Error reading schoolsList:", err);
    schools = [];
  }
  return schools;
}

// ───────────────────────────────────────────────────────────────
// RENDER SCHOOL DROPDOWN & ADMIN SCHOOL LIST
// ───────────────────────────────────────────────────────────────
function renderSchoolDropdown() {
  schoolSelect.innerHTML = `<option disabled selected>-- Select School --</option>`;
  schools.forEach((sch) => {
    const opt = document.createElement("option");
    opt.value = sch;
    opt.textContent = sch;
    schoolSelect.appendChild(opt);
  });
}

function renderSchoolListForAdmin() {
  schoolListDiv.innerHTML = "";
  schools.forEach((sch, idx) => {
    const row = document.createElement("div");
    row.className = "row-inline";
    row.innerHTML = `
      <span>${sch}</span>
      <button data-idx="${idx}" class="edit-school no-print"><i class="fas fa-edit"></i></button>
      <button data-idx="${idx}" class="delete-school no-print"><i class="fas fa-trash"></i></button>
    `;
    schoolListDiv.appendChild(row);
  });

  document.querySelectorAll(".edit-school").forEach((btn) => {
    btn.onclick = async () => {
      const idx = +btn.dataset.idx;
      const newName = prompt("Edit School Name:", schools[idx]);
      if (newName?.trim()) {
        const oldName = schools[idx];
        schools[idx] = newName.trim();
        await pushSchoolsToFirebase();
        await loadSetupUI();
      }
    };
  });

  document.querySelectorAll(".delete-school").forEach((btn) => {
    btn.onclick = async () => {
      const idx = +btn.dataset.idx;
      if (!confirm(`Delete school “${schools[idx]}”?`)) return;
      const removed = schools.splice(idx, 1);
      await pushSchoolsToFirebase();
      // If the deleted school was selected, clear localStorage
      const saved = JSON.parse(localStorage.getItem("mySetup")) || {};
      if (saved.school === removed[0]) {
        localStorage.removeItem("mySetup");
      }
      await loadSetupUI();
    };
  });
}

// ───────────────────────────────────────────────────────────────
// LOAD & RENDER SETUP UI BASED ON ROLE & SAVED SETUP
// ───────────────────────────────────────────────────────────────
export async function loadSetupUI() {
  // 1. Read schools from Firebase and render dropdown
  await readSchoolsFromFirebase();
  renderSchoolDropdown();

  // 2. Get current user’s role and custom claims
  currentUserRole = await getCurrentUserRole();
  currentUserClaims = await getCurrentUserClaims();

  // 3. Show/hide “Create School” only if Admin
  if (currentUserRole === "admin") {
    adminCreateDiv.classList.remove("hidden");
    schoolListDiv.classList.remove("hidden");
    renderSchoolListForAdmin();
  } else {
    adminCreateDiv.classList.add("hidden");
    schoolListDiv.classList.add("hidden");
  }

  // 4. If setup is already saved in localStorage, display it
  const saved = JSON.parse(localStorage.getItem("mySetup")) || {};
  if (saved.school && saved.cls && saved.sec) {
    currentSchool = saved.school;
    currentClass = saved.cls;
    currentSection = saved.sec;

    // Populate text and hide dropdowns
    setupTextSpan.textContent = `${currentSchool} 🏫 | Class: ${currentClass} | Section: ${currentSection}`;
    schoolSelect.value = currentSchool;
    classSelect.value = currentClass;
    sectionSelect.value = currentSection;

    document.getElementById("schoolSelectSection").classList.add("hidden");
    setupDisplayDiv.classList.remove("hidden");

    // Fire event so app.js can continue
    window.dispatchEvent(new Event("setupDone"));
  } else {
    // No saved setup: show dropdowns
    document.getElementById("schoolSelectSection").classList.remove("hidden");
    setupDisplayDiv.classList.add("hidden");
  }
}

// ───────────────────────────────────────────────────────────────
// HANDLER: Admin clicks “Create School”
// ───────────────────────────────────────────────────────────────
createSchoolBtn.onclick = async (e) => {
  e.preventDefault();
  const newSchool = schoolInput.value.trim();
  if (!newSchool) {
    alert("Enter a school name first.");
    return;
  }
  if (schools.includes(newSchool)) {
    alert("That school already exists!");
    return;
  }
  schools.push(newSchool);
  await pushSchoolsToFirebase();
  schoolInput.value = "";
  await loadSetupUI();
};

// ───────────────────────────────────────────────────────────────
// HANDLER: Save Setup (School/ Class/ Section)
// ───────────────────────────────────────────────────────────────
saveSetupBtn.onclick = async (e) => {
  e.preventDefault();
  const selectedSchool = schoolSelect.value;
  const selectedClass = classSelect.value;
  const selectedSection = sectionSelect.value;
  if (!selectedSchool || !selectedClass || !selectedSection) {
    alert("Please select school, class, and section.");
    return;
  }

  // If Principal: ensure their claim.school matches selectedSchool
  if (currentUserRole === "principal") {
    if (currentUserClaims.school !== selectedSchool) {
      alert("As Principal, you can only select your assigned school.");
      return;
    }
  }

  // If Teacher: ensure their claims exactly match
  if (currentUserRole === "teacher") {
    if (
      currentUserClaims.school !== selectedSchool ||
      currentUserClaims.cls !== selectedClass ||
      currentUserClaims.section !== selectedSection
    ) {
      alert("As Teacher, you can only select your assigned school, class, and section.");
      return;
    }
  }

  // 1. Save to localStorage
  currentSchool = selectedSchool;
  currentClass = selectedClass;
  currentSection = selectedSection;
  localStorage.setItem(
    "mySetup",
    JSON.stringify({
      school: selectedSchool,
      cls: selectedClass,
      sec: selectedSection
    })
  );

  // 2. Update UI: hide dropdowns, show saved text
  setupTextSpan.textContent = `${selectedSchool} 🏫 | Class: ${selectedClass} | Section: ${selectedSection}`;
  document.getElementById("schoolSelectSection").classList.add("hidden");
  setupDisplayDiv.classList.remove("hidden");

  // 3. Fire event so app.js can proceed
  window.dispatchEvent(new Event("setupDone"));
};

// ───────────────────────────────────────────────────────────────
// HANDLER: Edit Setup → Clear saved and show dropdowns again
// ───────────────────────────────────────────────────────────────
editSetupBtn.onclick = (e) => {
  e.preventDefault();
  localStorage.removeItem("mySetup");
  currentSchool = null;
  currentClass = null;
  currentSection = null;
  setupDisplayDiv.classList.add("hidden");
  document.getElementById("schoolSelectSection").classList.remove("hidden");
};

// ───────────────────────────────────────────────────────────────
// INITIALIZE ON PAGE LOAD & RELOAD WHEN /schoolsList CHANGES
// ───────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  // 1. Ensure user is signed in; if not, redirect (app.js will handle redirect if no auth)
  // 2. Load the UI based on current role and saved setup
  await loadSetupUI();

  // 3. Listen for real-time changes under “/schoolsList” and re-render
  onValue(dbRef(db, "schoolsList"), async () => {
    await loadSetupUI();
  });
});
