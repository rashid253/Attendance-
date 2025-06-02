// auth.js

import { auth, database } from "./firebase-config.js";
import {
  ref as dbRef,
  set as dbSet,
  get as dbGet,
  onValue
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  deleteUser
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// --------------------
// DOM elements
// --------------------
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

// --------------------
// 1) Subscribe to /appData/schools for dropdown
// --------------------
function subscribeSchools() {
  const schoolsRef = dbRef(database, "appData/schools");
  onValue(
    schoolsRef,
    (snapshot) => {
      schoolsList = snapshot.exists() ? snapshot.val() : [];
      if (!isLoginMode) {
        populateSchoolDropdown();
      }
    },
    (error) => {
      console.error("onValue error for appData/schools:", error);
    }
  );
}

// --------------------
// 2) Populate school dropdown in signup
// --------------------
function populateSchoolDropdown() {
  schoolRegisterSelect.innerHTML =
    '<option disabled selected>-- Select School (for principal/teacher) --</option>';
  if (Array.isArray(schoolsList)) {
    schoolsList.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      schoolRegisterSelect.appendChild(opt);
    });
  }
}

// --------------------
// 3) Toggle between Login and SignUp modes
// --------------------
function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  if (!isLoginMode) {
    formTitle.textContent      = "Sign Up for Attendance App";
    authButton.textContent     = "Sign Up";
    signupExtra.classList.remove("hidden");
    toggleAuthSpan.textContent = "Already have an account? Login";
    populateSchoolDropdown();
  } else {
    formTitle.textContent      = "Login to Attendance App";
    authButton.textContent     = "Login";
    signupExtra.classList.add("hidden");
    toggleAuthSpan.textContent = "Don't have an account? Sign Up";
  }
  // Clear fields
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

// --------------------
// 4) Show/hide Class & Section based on Role
// --------------------
roleSelect.addEventListener("change", () => {
  if (roleSelect.value === "teacher") {
    classRegisterSelect.classList.remove("hidden");
    sectionRegisterSelect.classList.remove("hidden");
  } else {
    classRegisterSelect.classList.add("hidden");
    sectionRegisterSelect.classList.add("hidden");
  }
});

// --------------------
// 5) Handle Login / SignUp button click
// --------------------
authButton.addEventListener("click", async () => {
  const email    = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert("Email اور Password دونوں ضروری ہیں۔");
    return;
  }

  if (isLoginMode) {
    // ─── LOGIN ───
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert("Login نامنظور: " + err.message);
    }
  } else {
    // ─── SIGNUP ───
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

    let createdUser = null;
    try {
      // (1) Create user in Auth
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      createdUser = userCred.user;
      console.log("✓ createUserWithEmailAndPassword UID:", createdUser.uid);

      // (2) Update displayName in Auth profile
      await updateProfile(createdUser, { displayName });
      console.log("✓ updateProfile succeeded for UID:", createdUser.uid);

      // (3) Write profile to Realtime Database using createdUser.uid
      //     (onAuthStateChanged won't auto sign out now—even if profile isn't found yet)
      const uid = createdUser.uid;
      console.log("→ Attempting dbSet at /users/" + uid);
      await dbSet(dbRef(database, `users/${uid}`), {
        displayName,
        email,
        role,
        school,
        class: cls,
        section: sec
      });
      console.log("✓ dbSet succeeded for /users/" + uid);

      // (4) Sign out after successful signup
      await signOut(auth);
      console.log("✓ Signed out after signup");

      alert("Sign Up کامیاب! براہِ کرم دوبارہ لاگ ان کریں۔");
      toggleAuthMode();
    } catch (err) {
      console.error("✖ Signup error:", err);
      if (createdUser) {
        try {
          await deleteUser(createdUser);
          console.log("→ Deleted Auth user due to DB write failure");
        } catch (delErr) {
          console.error("⚠ Error deleting user after failed DB write:", delErr);
        }
      }
      alert("Sign Up ناکام: " + err.message);
    }
  }
});

// --------------------
// 6) Monitor Auth state and show/hide main app
// --------------------

// Note: We remove the "auto sign-out if profile missing" logic.
//       Instead, if no profile exists, just stay on login screen.

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const snap = await dbGet(dbRef(database, `users/${user.uid}`));
      if (snap.exists()) {
        // Profile exists in DB, show main app
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
        // No DB profile found—remain on login/signup screen
        window.currentUserProfile = null;
        authContainer.classList.remove("hidden");
        mainApp.classList.add("hidden");
      }
    } catch {
      // On any DB error, stay on login/signup
      window.currentUserProfile = null;
      authContainer.classList.remove("hidden");
      mainApp.classList.add("hidden");
    }
  } else {
    // No user logged in
    window.currentUserProfile = null;
    authContainer.classList.remove("hidden");
    mainApp.classList.add("hidden");
  }
});

// --------------------
// 7) Logout button
// --------------------
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch {}
});

// --------------------
// 8) Initialize school subscription
// --------------------
subscribeSchools();
