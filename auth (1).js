// auth.js
// -------
// Handles signup, login, logout, and role-based UI toggling.

import {
  auth,
  usersRef,
  schoolsRef,
  classesRef
} from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  set as dbSet,
  push as dbPush,
  child as dbChild,
  get as dbGet,
  onValue
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// DOM Elements
const authModal       = document.getElementById("auth-modal");
const modalClose      = document.getElementById("auth-modal-close");
const showLoginBtn    = document.getElementById("show-login");
const showSignupBtn   = document.getElementById("show-signup");
const loginForm       = document.getElementById("login-form");
const signupForm      = document.getElementById("signup-form");
const loginEmail      = document.getElementById("login-email");
const loginPassword   = document.getElementById("login-password");
const loginError      = document.getElementById("login-error");
const signupName      = document.getElementById("signup-name");
const signupEmail     = document.getElementById("signup-email");
const signupPassword  = document.getElementById("signup-password");
const signupRole      = document.getElementById("signup-role");
const signupSchoolInp = document.getElementById("signup-school");
const signupClassInp  = document.getElementById("signup-class");
const signupError     = document.getElementById("signup-error");
const signupSchoolSec = document.getElementById("signup-school-section");
const signupClassSec  = document.getElementById("signup-class-section");

const mainContent     = document.getElementById("main-content");
const logoutBtn       = document.getElementById("logoutBtn");
const welcomeUserSpan = document.getElementById("welcome-user");

// Role-based sections
const adminSetup      = document.getElementById("admin-setup");
const principalDash   = document.getElementById("principal-dashboard");
const teacherDash     = document.getElementById("teacher-dashboard");

// HOW IT WORKS:
// 1. On page load, show the auth modal if no user is signed in.
// 2. In signup form, if role="admin", show only name/email/password.
//    If role="principal", show school dropdown (populated from /schools).
//    If role="teacher", show school + class inputs.
// 3. On signup submit: create user, then write to /users/{uid} with { name, role, schoolId, className }.
//    - Admin: no schoolId or className.
//    - Principal: schoolId = existing or newly created.
//    - Teacher: schoolId + className.
// 4. On login submit: sign in. onAuthStateChanged then calls setupUI(user).
// 5. setupUI fetches /users/{uid}, reads role, toggles UI accordingly.

// Show login form
showLoginBtn.addEventListener("click", () => {
  signupForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
  loginError.textContent = "";
});

// Show signup form
showSignupBtn.addEventListener("click", () => {
  loginForm.classList.add("hidden");
  signupForm.classList.remove("hidden");
  signupError.textContent = "";
});

// Close modal
modalClose.addEventListener("click", () => {
  authModal.classList.add("hidden");
});

// Role selection in signup: show/hide extra fields
signupRole.addEventListener("change", () => {
  const role = signupRole.value;
  if (role === "admin") {
    signupSchoolSec.classList.add("hidden");
    signupClassSec.classList.add("hidden");
  } else if (role === "principal") {
    signupSchoolSec.classList.remove("hidden");
    signupClassSec.classList.add("hidden");
    populateSchoolDropdown(signupSchoolInp);
  } else if (role === "teacher") {
    signupSchoolSec.classList.remove("hidden");
    signupClassSec.classList.remove("hidden");
    populateSchoolDropdown(signupSchoolInp);
  }
});

// Populate dropdown for existing schools
async function populateSchoolDropdown(selectElement) {
  const snapshot = await dbGet(schoolsRef);
  selectElement.innerHTML = "<option disabled selected>Select School</option>";
  if (snapshot.exists()) {
    snapshot.forEach(childSnap => {
      const schoolId = childSnap.key;
      const { name } = childSnap.val();
      const opt = document.createElement("option");
      opt.value = schoolId;
      opt.textContent = name;
      selectElement.appendChild(opt);
    });
  }
}

// SIGNUP SUBMISSION
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupError.textContent = "";
  const name      = signupName.value.trim();
  const email     = signupEmail.value.trim();
  const password  = signupPassword.value.trim();
  const role      = signupRole.value;
  const schoolId  = signupSchoolInp.value || null;
  const className = signupClassInp.value.trim() || null;

  if (!name || !email || !password || !role) {
    signupError.textContent = "All required fields must be filled.";
    return;
  }
  if (role === "principal" && !schoolId) {
    signupError.textContent = "Principal must select an existing school.";
    return;
  }
  if (role === "teacher" && (!schoolId || !className)) {
    signupError.textContent = "Teacher must select school and enter class (e.g. 10-A).";
    return;
  }

  try {
    // Create user in Firebase Auth
    const { user } = await createUserWithEmailAndPassword(auth, email, password);

    // If admin: create a new school entry as well
    let assignedSchoolId = schoolId;
    if (role === "admin") {
      // Create unique school ID by pushing to /schools
      const newSchoolRef = dbPush(schoolsRef);
      await dbSet(newSchoolRef, { name: `${name}'s School` });
      assignedSchoolId = newSchoolRef.key;
    }

    // Write user profile in Realtime Database under /users/{uid}
    await dbSet(dbChild(usersRef, user.uid), {
      name,
      role,
      schoolId: assignedSchoolId,
      className: role === "teacher" ? className : null
    });

    // After signup, automatically sign in and close modal
    authModal.classList.add("hidden");
    signupForm.reset();
  } catch (err) {
    signupError.textContent = err.message;
  }
});

// LOGIN SUBMISSION
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email    = loginEmail.value.trim();
  const password = loginPassword.value.trim();
  if (!email || !password) {
    loginError.textContent = "Enter email and password.";
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginForm.reset();
    authModal.classList.add("hidden");
  } catch (err) {
    loginError.textContent = err.message;
  }
});

// LOGOUT
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// AUTH STATE CHANGE: toggle UI
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Hide modal, show main content
    authModal.classList.add("hidden");
    mainContent.classList.remove("hidden");

    // Fetch user profile from /users/{uid}
    const snapshot = await dbGet(dbChild(usersRef, user.uid));
    if (!snapshot.exists()) {
      // If no profile, force logout
      await signOut(auth);
      return;
    }
    const { name, role, schoolId, className } = snapshot.val();
    welcomeUserSpan.textContent = `Hello, ${name} (${role.charAt(0).toUpperCase() + role.slice(1)})`;

    // Toggle role-based sections
    adminSetup.classList.add("hidden");
    principalDash.classList.add("hidden");
    teacherDash.classList.add("hidden");
    document.getElementById("financial-settings").classList.add("hidden");
    document.getElementById("animatedCounters").classList.add("hidden");
    document.getElementById("student-registration").classList.add("hidden");
    document.getElementById("attendance-section").classList.add("hidden");
    document.getElementById("analytics-section").classList.add("hidden");
    document.getElementById("register-section").classList.add("hidden");

    if (role === "admin") {
      // Show admin setup UI
      adminSetup.classList.remove("hidden");
      // Load existing schools
      loadSchoolList();
    } else if (role === "principal") {
      principalDash.classList.remove("hidden");
      // Populate dropdown of schools (should include only the assigned schoolId)
      const opt = document.createElement("option");
      const schoolSnap = await dbGet(dbChild(schoolsRef, schoolId));
      opt.value = schoolId;
      opt.textContent = schoolSnap.val().name;
      document.getElementById("principal-school-select").appendChild(opt);
      // Once loaded, principal can click “Load Classes” to see classes under that school
    } else if (role === "teacher") {
      teacherDash.classList.remove("hidden");
      // Show teacher’s school and class
      const schoolSnap = await dbGet(dbChild(schoolsRef, schoolId));
      document.getElementById("teacher-school-name").textContent = schoolSnap.val().name;
      document.getElementById("teacher-class-name").textContent = className;
      // Show teacher’s relevant sections: financial, counters, registration, attendance, analytics, register
      document.getElementById("financial-settings").classList.remove("hidden");
      document.getElementById("animatedCounters").classList.remove("hidden");
      document.getElementById("student-registration").classList.remove("hidden");
      document.getElementById("attendance-section").classList.remove("hidden");
      document.getElementById("analytics-section").classList.remove("hidden");
      document.getElementById("register-section").classList.remove("hidden");
    }
  } else {
    // No user: show auth modal
    mainContent.classList.add("hidden");
    authModal.classList.remove("hidden");
    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
    // Clear any role-based dropdowns
    document.getElementById("principal-school-select").innerHTML = `<option disabled selected>-- Select School --</option>`;
  }
});

// LOAD EXISTING SCHOOLS FOR ADMIN LIST
async function loadSchoolList() {
  const ul = document.getElementById("schools-ul");
  ul.innerHTML = "";
  const snapshot = await dbGet(schoolsRef);
  if (snapshot.exists()) {
    snapshot.forEach(childSnap => {
      const schoolId = childSnap.key;
      const { name } = childSnap.val();
      const li = document.createElement("li");
      li.textContent = name + " ";
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Delete";
      removeBtn.classList.add("btn", "no-print");
      removeBtn.style.marginLeft = "1em";
      removeBtn.addEventListener("click", async () => {
        await dbSet(dbChild(schoolsRef, schoolId), null);
        loadSchoolList();
      });
      li.appendChild(removeBtn);
      ul.appendChild(li);
    });
  }
}

// CREATE NEW SCHOOL (Admin)
document.getElementById("create-school-btn").addEventListener("click", async () => {
  const name = document.getElementById("newSchoolName").value.trim();
  if (!name) return;
  const newRef = dbPush(schoolsRef);
  await dbSet(newRef, { name });
  document.getElementById("newSchoolName").value = "";
  loadSchoolList();
});

// PRINCIPAL: LOAD CLASSES FOR SELECTED SCHOOL
document.getElementById("load-classes-btn").addEventListener("click", async () => {
  const schoolId = document.getElementById("principal-school-select").value;
  if (!schoolId) return;
  const classesSnap = await dbGet(dbChild(classesRef, schoolId));
  const classesList = document.getElementById("classes-ul");
  classesList.innerHTML = "";
  if (classesSnap.exists()) {
    classesSnap.forEach(childSnap => {
      const className = childSnap.key;
      const { sections } = childSnap.val();
      const li = document.createElement("li");
      li.textContent = `Class ${className} → Sections: ${sections.join(", ")}`;
      classesList.appendChild(li);
    });
  }
  document.getElementById("classes-list").classList.remove("hidden");
});
