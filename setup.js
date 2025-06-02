// setup.js

import { database } from "./firebase-config.js";
import {
  ref as dbRef,
  set as dbSet,
  onValue
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// **DOM عناصر**
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

// Signup فارم کے لیے اسکول کا ڈراپ ڈاؤن
const signupSchoolSelect   = document.getElementById("schoolRegisterSelect");
const classRegisterSelect  = document.getElementById("classRegisterSelect");
const sectionRegisterSelect= document.getElementById("sectionRegisterSelect");

let schools = [];
let currentProfile = null;

/**
 * 1) "appData/schools" سے اسکولوں کا ڈیٹا لوڈ کریں
 */
function loadSchools() {
  const ref = dbRef(database, "appData/schools");
  onValue(
    ref,
    (snapshot) => {
      schools = snapshot.exists() ? snapshot.val() : [];
      renderSchoolList();
      populateAdminDropdown();
      populateSignupDropdown();
      refreshUserView();
    },
    (error) => {
      console.error("onValue error for appData/schools:", error);
    }
  );
}

/**
 * 2) Admin کے لیے: اسکولوں کی لسٹ دکھائیں (Card میں)
 */
function renderSchoolList() {
  schoolListDiv.innerHTML = "";
  schools.forEach((s, idx) => {
    const itemDiv = document.createElement("div");
    itemDiv.classList.add("school-item");
    itemDiv.style.display = "flex";
    itemDiv.style.justifyContent = "space-between";
    itemDiv.style.alignItems = "center";
    itemDiv.style.padding = "0.5em 0";
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

/**
 * 3) Admin کے لیے ڈراپ ڈاؤن Populate کریں (Delete کے لیے)
 */
function populateAdminDropdown() {
  schoolSelect.innerHTML = '<option disabled selected>-- Select School to Delete --</option>';
  schools.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    schoolSelect.appendChild(opt);
  });
}

/**
 * 4) Signup فارم کے لیے اسکول ڈراپ ڈاؤن Populate کریں
 */
function populateSignupDropdown() {
  signupSchoolSelect.innerHTML = '<option disabled selected>-- Select School --</option>';
  schools.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    signupSchoolSelect.appendChild(opt);
  });
}

/**
 * 5) Admin: نیا اسکول شامل کریں
 */
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

/**
 * 6) Admin: منتخب شدہ اسکول حذف کریں
 */
deleteSetupBtn.addEventListener("click", async () => {
  const selected = schoolSelect.value;
  if (!selected) {
    alert("براہِ کرم حذف کرنے کے لیے اسکول منتخب کریں۔");
    return;
  }
  const updated = schools.filter((s) => s !== selected);
  try {
    await dbSet(dbRef(database, "appData/schools"), updated);
    alert("اسکول حذف ہو گیا!");
  } catch (err) {
    console.error("Error deleting school:", err);
    alert("کچھ غلط ہوا: " + err.message);
  }
});

/**
 * 7) لاگ ان یوزر کا ویو Refresh کریں (Admin/Principal/Teacher کے مطابق)
 */
function refreshUserView() {
  currentProfile = window.currentUserProfile;
  if (!currentProfile) return;

  const { role, school, class: cls, section } = currentProfile;

  // پہلے تمام Views چھپا دیں
  adminSetupDiv.classList.add("hidden");
  principalSetupDiv.classList.add("hidden");
  teacherSetupInfoDiv.classList.add("hidden");

  if (role === "admin") {
    // Admin view دکھائیں
    adminSetupDiv.classList.remove("hidden");
  }
  else if (role === "principal") {
    // Principal کا info دکھائیں (read-only)
    principalInfoDiv.innerHTML = `
      <p><strong>آپ کا اسکول:</strong> ${school}</p>
    `;
    principalSetupDiv.classList.remove("hidden");
  }
  else if (role === "teacher") {
    // Teacher کا info دکھائیں (read-only)
    teacherInfoDiv.innerHTML = `
      <p><strong>آپ کا اسکول:</strong> ${school}</p>
      <p><strong>آپ کی کلاس:</strong> ${cls}</p>
      <p><strong>آپ کا سیکشن:</strong> ${section}</p>
    `;
    teacherSetupInfoDiv.classList.remove("hidden");
  }
}

/**
 * 8) auth.js سے “userLoggedIn” ایونٹ سنیں
 */
document.addEventListener("userLoggedIn", () => {
  refreshUserView();
});

/**
 * 9) اگر یوزر پہلے سے لاگ ان ہوا تو فوراً View اپ ڈیٹ کریں
 */
if (window.currentUserProfile) {
  refreshUserView();
}

// آخر میں اسکول لوڈ کریں
loadSchools();
