// auth.js

import { auth, database } from "./firebase-config.js";
import {
  ref as dbRef,
  get as dbGet,
  onValue,
  set as dbSet
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const emailInput             = document.getElementById("emailInput");
const passwordInput          = document.getElementById("passwordInput");
const authButton             = document.getElementById("authButton");
const toggleAuthSpan         = document.getElementById("toggleAuth");
const formTitle              = document.getElementById("form-title");

const signupExtra            = document.getElementById("signup-extra");
const roleSelect             = document.getElementById("roleSelect");
const displayNameInput       = document.getElementById("displayNameInput");
const schoolRegisterSelect   = document.getElementById("schoolRegisterSelect");
const classRegisterSelect    = document.getElementById("classRegisterSelect");
const sectionRegisterSelect  = document.getElementById("sectionRegisterSelect");

const authContainer          = document.getElementById("auth-container");
const mainApp                = document.getElementById("main-app");
const logoutBtn              = document.getElementById("logoutBtn");

let isLoginMode = true;
let schoolsList = [];

// 1. Subscribe to appData/schools so dropdown خود بخود اپڈیٹ ہو
function subscribeSchools() {
  const schoolsRef = dbRef(database, "appData/schools");
  onValue(schoolsRef, (snapshot) => {
    if (snapshot.exists()) {
      schoolsList = snapshot.val();
    } else {
      schoolsList = [];
    }
    console.log("DEBUG: Loaded schools from DB:", schoolsList);
    populateSchoolDropdown();
  }, (error) => {
    console.error("DEBUG: onValue error for appData/schools:", error);
  });
}

// Populate the School dropdown
function populateSchoolDropdown() {
  // اگر ابھی signupExtra hidden ہے تو dropdown کو خالی کرنا
  if (signupExtra.classList.contains("hidden")) return;

  // واضح کریں کون سی options پہلے موجود ہیں
  schoolRegisterSelect.innerHTML = '<option disabled selected>-- Select School (for principal/teacher) --</option>';
  console.log("DEBUG: Populating dropdown with:", schoolsList);

  if (Array.isArray(schoolsList) && schoolsList.length > 0) {
    schoolsList.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      schoolRegisterSelect.appendChild(opt);
    });
  } else {
    // اگر فہرست خالی ہے تو صرف default placeholder دکھائیں
    console.log("DEBUG: schoolsList is empty; dropdown remains with only placeholder.");
  }
}

// 2. Toggle between Login and Sign Up forms
function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  if (!isLoginMode) {
    // Switch to Sign Up
    formTitle.textContent = "Sign Up for Attendance App";
    authButton.textContent = "Sign Up";
    signupExtra.classList.remove("hidden");
    toggleAuthSpan.textContent = "Already have an account? Login";
    // اب اس وقت ڈراپ ڈاؤن دکھائیں گے → populate کریں
    populateSchoolDropdown();
  } else {
    // Switch to Login
    formTitle.textContent = "Login to Attendance App";
    authButton.textContent = "Login";
    signupExtra.classList.add("hidden");
    toggleAuthSpan.textContent = "Don't have an account? Sign Up";
  }
  // Reset inputs
  emailInput.value          = "";
  passwordInput.value       = "";
  displayNameInput.value    = "";
  roleSelect.value          = "";
  schoolRegisterSelect.value= "";
  classRegisterSelect.value = "";
  sectionRegisterSelect.value="";
  classRegisterSelect.classList.add("hidden");
  sectionRegisterSelect.classList.add("hidden");
}

toggleAuthSpan.addEventListener("click", toggleAuthMode);

// 3. Show/hide Class & Section selects when Role = teacher
roleSelect.addEventListener("change", () => {
  if (roleSelect.value === "teacher") {
    classRegisterSelect.classList.remove("hidden");
    sectionRegisterSelect.classList.remove("hidden");
  } else {
    classRegisterSelect.classList.add("hidden");
    sectionRegisterSelect.classList.add("hidden");
  }
});

// 4. Handle Login / Sign Up button click
authButton.addEventListener("click", async () => {
  const email    = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) {
    alert("Email اور Password دونوں ضروری ہیں۔");
    return;
  }

  if (isLoginMode) {
    // LOGIN
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert("Login نامنظور: " + err.message);
    }
  } else {
    // SIGNUP
    const displayName = displayNameInput.value.trim();
    const role        = roleSelect.value;
    const school      = schoolRegisterSelect.value;
    const cls         = role === "teacher" ? classRegisterSelect.value : "";
    const sec         = role === "teacher" ? sectionRegisterSelect.value : "";

    if (!displayName || !role || !school) {
      alert("براہِ کرم اپنا نام، رول اور اسکول منتخب کریں۔");
      return;
    }
    if (role === "teacher" && (!cls || !sec)) {
      alert("Teacher رول کے لیے Class اور Section دونوں منتخب کریں۔");
      return;
    }

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCred.user, { displayName });
      const uid = userCred.user.uid;
      // Save profile under /users/{uid} in Realtime Database
      const userRef = dbRef(database, `users/${uid}`);
      await dbSet(userRef, {
        displayName,
        email,
        role,
        school,
        class: cls,
        section: sec
      });
      alert("Sign Up کامیاب! براہِ کرم لاگ ان کریں۔");
      toggleAuthMode();
    } catch (err) {
      alert("Sign Up ناکام: " + err.message);
    }
  }
});

// 5. Monitor Auth state changes
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authContainer.classList.add("hidden");
    mainApp.classList.remove("hidden");
    const uid = user.uid;
    try {
      const snap = await dbGet(dbRef(database, `users/${uid}`));
      if (snap.exists()) {
        const profile = snap.val();
        window.currentUserProfile = {
          uid,
          displayName: profile.displayName,
          email: profile.email,
          role: profile.role,
          school: profile.school,
          class: profile.class || "",
          section: profile.section || ""
        };
        document.dispatchEvent(new Event("userLoggedIn"));
      } else {
        alert("User profile نہ ملا، دوبارہ Login کریں۔");
        await signOut(auth);
      }
    } catch (err) {
      console.error("Error reading user profile:", err);
      alert("پروفائل پڑھنے میں مسئلہ، دوبارہ کوشش کریں۔");
      await signOut(auth);
    }
  } else {
    authContainer.classList.remove("hidden");
    mainApp.classList.add("hidden");
    window.currentUserProfile = null;
  }
});

// 6. Logout بٹن فنکشن
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Logout میں مسئلہ:", err);
  }
});

// 7. Start listening for changes to the schools list
subscribeSchools();
