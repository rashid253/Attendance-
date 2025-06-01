// auth.js
import { auth, database } from "./firebase-config.js";
import { ref as dbRef, set as dbSet, get as dbGet } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const emailInput       = document.getElementById("emailInput");
const passwordInput    = document.getElementById("passwordInput");
const authButton       = document.getElementById("authButton");
const toggleAuth       = document.getElementById("toggleAuth");
const formTitle        = document.getElementById("form-title");

const signupExtra         = document.getElementById("signup-extra");
const roleSelect          = document.getElementById("roleSelect");
const displayNameInput    = document.getElementById("displayNameInput");
const schoolRegisterSelect= document.getElementById("schoolRegisterSelect");
const classRegisterSelect = document.getElementById("classRegisterSelect");
const sectionRegisterSelect = document.getElementById("sectionRegisterSelect");

const authContainer = document.getElementById("auth-container");
const mainApp       = document.getElementById("main-app");
const logoutBtn     = document.getElementById("logoutBtn");

let schoolsList = [];

// Load schools from Firebase
async function loadSchools() {
  const snap = await dbGet(dbRef(database, "appData/schools"));
  if (snap.exists()) {
    schoolsList = snap.val();
  } else {
    schoolsList = [];
  }
  schoolRegisterSelect.innerHTML = '<option disabled selected>-- Select School (for principal/teacher) --</option>';
  schoolsList.forEach(s => {
    schoolRegisterSelect.innerHTML += `<option value="${s}">${s}</option>`;
  });
  const schoolSelect = document.getElementById("schoolSelect");
  if (schoolSelect) {
    schoolSelect.innerHTML =
      '<option disabled selected>-- Select School --</option>' +
      schoolsList.map(s => `<option value="${s}">${s}</option>`).join("");
  }
}
loadSchools();

let isLoginMode = true;
function toggleAuthMode() {
  if (isLoginMode) {
    formTitle.textContent = "Sign Up for Attendance App";
    authButton.textContent = "Sign Up";
    signupExtra.classList.remove("hidden");
    toggleAuth.innerHTML = `Already have an account? <span id="toggleAuth">Login</span>`;
  } else {
    formTitle.textContent = "Login to Attendance App";
    authButton.textContent = "Login";
    signupExtra.classList.add("hidden");
    toggleAuth.innerHTML = `Don't have an account? <span id="toggleAuth">Sign Up</span>`;
  }
  isLoginMode = !isLoginMode;
}

toggleAuth.addEventListener("click", () => {
  emailInput.value = "";
  passwordInput.value = "";
  displayNameInput.value = "";
  roleSelect.value = "";
  schoolRegisterSelect.value = "";
  classRegisterSelect.value = "";
  sectionRegisterSelect.value = "";
  classRegisterSelect.classList.add("hidden");
  sectionRegisterSelect.classList.add("hidden");
  toggleAuthMode();
});

roleSelect.addEventListener("change", () => {
  const role = roleSelect.value;
  if (role === "teacher") {
    classRegisterSelect.classList.remove("hidden");
    sectionRegisterSelect.classList.remove("hidden");
  } else {
    classRegisterSelect.classList.add("hidden");
    sectionRegisterSelect.classList.add("hidden");
  }
});

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
      alert("Login فیل ہوا: " + err.message);
    }
  } else {
    // SIGNUP
    const displayName = displayNameInput.value.trim();
    const role        = roleSelect.value;
    const school      = schoolRegisterSelect.value;
    const cls         = role === "teacher" ? classRegisterSelect.value : null;
    const sec         = role === "teacher" ? sectionRegisterSelect.value : null;

    if (!displayName || !role || !school) {
      alert("براہِ کرم اپنی تفصیلات مکمل کریں (Name, Role, School)۔");
      return;
    }
    if (role === "teacher" && (!cls || !sec)) {
      alert("Teacher منتخب کرنے پر Class اور Section دونوں منتخب کریں۔");
      return;
    }

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCred.user, { displayName });
      const uid = userCred.user.uid;
      await dbSet(dbRef(database, `users/${uid}`), {
        displayName, email, role, school, class: cls || "", section: sec || ""
      });
      alert("Sign Up کامیاب۔ اب Login کریں۔");
      toggleAuthMode();
      emailInput.value = "";
      passwordInput.value = "";
      displayNameInput.value = "";
      roleSelect.value = "";
      schoolRegisterSelect.value = "";
      classRegisterSelect.value = "";
      sectionRegisterSelect.value = "";
      classRegisterSelect.classList.add("hidden");
      sectionRegisterSelect.classList.add("hidden");
    } catch (err) {
      alert("Sign Up فیل ہوا: " + err.message);
    }
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    authContainer.classList.add("hidden");
    mainApp.classList.remove("hidden");
    const uid = user.uid;
    const snap = await dbGet(dbRef(database, `users/${uid}`));
    if (snap.exists()) {
      const profile = snap.val();
      window.currentUserProfile = {
        uid,
        displayName: profile.displayName,
        email: profile.email,
        role: profile.role,
        school: profile.school,
        class: profile.class,
        section: profile.section
      };
      document.dispatchEvent(new Event("userLoggedIn"));
    } else {
      alert("User profile نہ ملا، دوبارہ Login کریں۔");
      await signOut(auth);
    }
  } else {
    authContainer.classList.remove("hidden");
    mainApp.classList.add("hidden");
    window.currentUserProfile = null;
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Logout میں مسئلہ:", err);
  }
});
