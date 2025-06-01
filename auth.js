// auth.js

import { auth, database } from "./firebase-config.js";
import {
  ref as dbRef,
  onValue,
  get as dbGet,
  set as dbSet
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// DOM references
const emailInput            = document.getElementById("emailInput");
const passwordInput         = document.getElementById("passwordInput");
const authButton            = document.getElementById("authButton");
const toggleAuthSpan        = document.getElementById("toggleAuth");
const formTitle             = document.getElementById("form-title");

const signupExtra           = document.getElementById("signup-extra");
const roleSelect            = document.getElementById("roleSelect");
const displayNameInput      = document.getElementById("displayNameInput");
const schoolRegisterSelect  = document.getElementById("schoolRegisterSelect");
const classRegisterSelect   = document.getElementById("classRegisterSelect");
const sectionRegisterSelect = document.getElementById("sectionRegisterSelect");

const authContainer         = document.getElementById("auth-container");
const mainApp               = document.getElementById("main-app");
const logoutBtn             = document.getElementById("logoutBtn");

let isLoginMode = true;
let schoolsList = [];

// ─── 1) /appData/schools پر سبسکرائب کریں تاکہ dropdown ہمیشہ اپڈیٹ رہے ─────────────────
function subscribeSchools() {
  const schoolsRef = dbRef(database, "appData/schools");
  onValue(
    schoolsRef,
    (snapshot) => {
      schoolsList = snapshot.exists() ? snapshot.val() : [];
      console.log("DEBUG: Loaded schools from DB:", schoolsList);
      // اگر آپ فی الوقت signup موڈ میں ہیں تو فوراً populate کریں
      if (!isLoginMode) {
        populateSchoolDropdown();
      }
    },
    (error) => {
      console.error("DEBUG: onValue error for appData/schools:", error);
    }
  );
}

// ─── 2) Signup فارم میں اسکولز ڈالیں ────────────────────────────────────────
function populateSchoolDropdown() {
  schoolRegisterSelect.innerHTML =
    '<option disabled selected>-- Select School (for principal/teacher) --</option>';
  if (Array.isArray(schoolsList) && schoolsList.length > 0) {
    schoolsList.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      schoolRegisterSelect.appendChild(opt);
    });
  }
}

// ─── 3) Login ↔ SignUp موڈ ٹوگل کریں ───────────────────────────────────────
function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  if (!isLoginMode) {
    // Sign Up موڈ
    formTitle.textContent      = "Sign Up for Attendance App";
    authButton.textContent     = "Sign Up";
    signupExtra.classList.remove("hidden");
    toggleAuthSpan.textContent = "Already have an account? Login";
    // جب Sign Up دکھائیں، اسکولز کی فہرست populate کریں
    populateSchoolDropdown();
  } else {
    // Login موڈ
    formTitle.textContent      = "Login to Attendance App";
    authButton.textContent     = "Login";
    signupExtra.classList.add("hidden");
    toggleAuthSpan.textContent = "Don't have an account? Sign Up";
  }
  // Reset fields
  emailInput.value           = "";
  passwordInput.value        = "";
  displayNameInput.value     = "";
  roleSelect.value           = "";
  schoolRegisterSelect.value = "";
  classRegisterSelect.value  = "";
  sectionRegisterSelect.value= "";
  classRegisterSelect.classList.add("hidden");
  sectionRegisterSelect.classList.add("hidden");
}
toggleAuthSpan.addEventListener("click", toggleAuthMode);

// ─── 4) Role منتخب ہونے پر Class & Section دکھائیں ─────────────────────────────────
roleSelect.addEventListener("change", () => {
  if (roleSelect.value === "teacher") {
    classRegisterSelect.classList.remove("hidden");
    sectionRegisterSelect.classList.remove("hidden");
  } else {
    classRegisterSelect.classList.add("hidden");
    sectionRegisterSelect.classList.add("hidden");
  }
});

// ─── 5) Handle Login / Sign Up button click ───────────────────────────────────────
authButton.addEventListener("click", async () => {
  const email    = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) {
    alert("Email اور Password دونوں ضروری ہیں۔");
    return;
  }

  if (isLoginMode) {
    // ───────────── LOGIN ─────────────
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert("Login نامنظور: " + err.message);
    }
  } else {
    // ──────────── SIGNUP ─────────────
    const displayName = displayNameInput.value.trim();
    const role        = roleSelect.value;
    const school      = schoolRegisterSelect.value;
    const cls         = role === "teacher" ? classRegisterSelect.value : "";
    const sec         = role === "teacher" ? sectionRegisterSelect.value : "";

    // Validate required fields
    if (!displayName || !role || !school) {
      alert("براہِ کرم اپنا نام، رول اور اسکول منتخب کریں۔");
      return;
    }
    if (role === "teacher" && (!cls || !sec)) {
      alert("Teacher رول کے لیے Class اور Section دونوں منتخب کریں۔");
      return;
    }

    try {
      // 1) Auth میں نیا user بنائیں
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      // 2) displayName update کریں
      await updateProfile(userCred.user, { displayName });
      const uid = userCred.user.uid;

      // 3) DB میں profile لکھیں (Rules کے مطابق write allow ہو جائے گا)
      const userRef = dbRef(database, `users/${uid}`);
      await dbSet(userRef, {
        displayName,
        email,
        role,
        school,
        class: cls,
        section: sec,
      });

      // 4) اب signOut کریں تاکہ onAuthStateChanged صحیح طریقے سے عمل کرے
      await signOut(auth);

      alert("Sign Up کامیاب! براہِ کرم دوبارہ لاگ ان کریں۔");
      toggleAuthMode();
    } catch (err) {
      alert("Sign Up ناکام: " + err.message);
    }
  }
});

// ─── 6) Monitor Auth state changes ─────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      // جب signup فوراً ہوتا ہے، onAuthStateChanged trigger ہو سکتا ہے
      // پہلے DB میں /users/{uid} سے profile پڑھیں
      const snap = await dbGet(dbRef(database, `users/${user.uid}`));
      if (snap.exists()) {
        // اگر profile مل گیا تو main-app دکھائیں
        const profile = snap.val();
        window.currentUserProfile = {
          uid: user.uid,
          displayName: profile.displayName,
          email: profile.email,
          role: profile.role,
          school: profile.school,
          class: profile.class || "",
          section: profile.section || "",
        };
        authContainer.classList.add("hidden");
        mainApp.classList.remove("hidden");
        document.dispatchEvent(new Event("userLoggedIn"));
      } else {
        // اگر profile ابھی نہیں ملا تو silent signOut
        await signOut(auth);
      }
    } catch (err) {
      console.error("Error reading user profile:", err);
      await signOut(auth);
    }
  } else {
    // user لاگ آؤٹ ہے
    authContainer.classList.remove("hidden");
    mainApp.classList.add("hidden");
    window.currentUserProfile = null;
  }
});

// ─── 7) Logout بٹن کاز ───────────────────────────────────────────────────
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Logout میں مسئلہ:", err);
  }
});

// ─── 8) آغاز میں /appData/schools پر سبسکرائب کریں ────────────────────────────
subscribeSchools();
