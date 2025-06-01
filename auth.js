// auth.js
import { auth, database } from "./index.html"; // فیبر بیس کنفیگ اور auth, database ہم نے index.html میں export کیا
import { ref as dbRef, set as dbSet, onValue, get as dbGet } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const authButton = document.getElementById("authButton");
const toggleAuth = document.getElementById("toggleAuth");
const formTitle = document.getElementById("form-title");

// سائن اپ کے وقت اضافی فیلڈز
const signupExtra = document.getElementById("signup-extra");
const roleSelect = document.getElementById("roleSelect");
const displayNameInput = document.getElementById("displayNameInput");
const schoolRegisterSelect = document.getElementById("schoolRegisterSelect");
const classRegisterSelect = document.getElementById("classRegisterSelect");
const sectionRegisterSelect = document.getElementById("sectionRegisterSelect");

// مینی ایپ اور آتھ کنٹینر
const authContainer = document.getElementById("auth-container");
const mainApp = document.getElementById("main-app");

// لاگ آؤٹ بٹن
const logoutBtn = document.getElementById("logoutBtn");

// ---------------
// 1. AUTH UI Logic
// ---------------

// پہلے Firebase Realtime Database سے اسکولز کی لسٹ لے کر schoolRegisterSelect اور setup کے اسکول سیلیکٹ بھریں گے
let schoolsList = [];

// ڈیٹا بیس سے اسکولز لوڈ کریں
async function loadSchools() {
  const schoolsSnap = await dbGet(dbRef(database, "appData/schools"));
  if (schoolsSnap.exists()) {
    schoolsList = schoolsSnap.val();
  } else {
    schoolsList = [];
  }
  // سائن اپ میں اسکول سیلیکٹ کو اپڈیٹ کریں
  schoolRegisterSelect.innerHTML = '<option disabled selected>-- Select School (for principal/teacher) --</option>';
  schoolsList.forEach((sch) => {
    schoolRegisterSelect.innerHTML += `<option value="${sch}">${sch}</option>`;
  });
  // setup.js میں بھی اسکول سیلیکٹر اسی لسٹ سے بھرے گا
  const schoolSelect = document.getElementById("schoolSelect");
  if (schoolSelect) {
    schoolSelect.innerHTML =
      '<option disabled selected>-- Select School --</option>' +
      schoolsList.map((s) => `<option value="${s}">${s}</option>`).join("");
  }
}

// پیج لوڈ ہونے پر اسکولز لوڈ کریں
loadSchools();

// UI کو toggle کرنا: Login ↔ Signup
let isLoginMode = true;
function toggleAuthMode() {
  if (isLoginMode) {
    // لاگ ان موڈ سے سائن اپ موڈ پر جا رہے ہیں
    formTitle.textContent = "Sign Up for Attendance App";
    authButton.textContent = "Sign Up";
    signupExtra.classList.remove("hidden");
    toggleAuth.innerHTML = `Already have an account? <span id="toggleAuth">Login</span>`;
  } else {
    // سائن اپ موڈ سے لاگ ان موڈ پر جا رہے ہیں
    formTitle.textContent = "Login to Attendance App";
    authButton.textContent = "Login";
    signupExtra.classList.add("hidden");
    toggleAuth.innerHTML = `Don't have an account? <span id="toggleAuth">Sign Up</span>`;
  }
  isLoginMode = !isLoginMode;
}

// ان پٹس کلئیر کریں جب موڈ چینج ہو
toggleAuth.addEventListener("click", () => {
  emailInput.value = "";
  passwordInput.value = "";
  displayNameInput.value = "";
  roleSelect.value = "";
  schoolRegisterSelect.value = "";
  classRegisterSelect.value = "";
  sectionRegisterSelect.value = "";

  // کلاس/سیکشن ڈراپ ڈاؤن صرف ٹیچر رول سلیکٹ کرنے پر دکھیں گے
  classRegisterSelect.classList.add("hidden");
  sectionRegisterSelect.classList.add("hidden");

  toggleAuthMode();
});

// جب یوزر سائن اپ کے وقت رول چنے گا
roleSelect.addEventListener("change", () => {
  const role = roleSelect.value;
  if (role === "teacher") {
    // اگر ٹیچر ہو تو کلاس+سیکشن بھی چاہیے
    classRegisterSelect.classList.remove("hidden");
    sectionRegisterSelect.classList.remove("hidden");
  } else {
    classRegisterSelect.classList.add("hidden");
    sectionRegisterSelect.classList.add("hidden");
  }
});

// -------------------
// 2. AUTH بٹن کلک: لاگ ان یا سائن اپ
// -------------------
authButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert("Email اور Password دونوں ضروری ہیں۔");
    return;
  }

  if (isLoginMode) {
    // ========== LOGIN ==========
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // لاگ ان کامیاب، UI کو اپڈیٹ کرنا onAuthStateChanged سے ہوگا
    } catch (err) {
      alert("Login فیل ہوا: " + err.message);
    }
  } else {
    // ========== SIGN UP ==========
    const displayName = displayNameInput.value.trim();
    const role = roleSelect.value;
    const school = schoolRegisterSelect.value;
    const cls = role === "teacher" ? classRegisterSelect.value : null;
    const sec = role === "teacher" ? sectionRegisterSelect.value : null;

    if (!displayName || !role || !school) {
      alert("براہِ کرم اپنی تفصیلات مکمل کریں (Name, Role, School)۔");
      return;
    }
    if (role === "teacher" && (!cls || !sec)) {
      alert("Teacher منتخب کرنے پر Class اور Section دونوں منتخب کریں۔");
      return;
    }

    try {
      // Firebase Auth میں یوزر بنائیں
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      // پروفائل کا displayName اپڈیٹ کریں
      await updateProfile(userCred.user, { displayName });

      // Realtime DB میں /users/{uid} پر یوزر پروفائل لکھیں
      const uid = userCred.user.uid;
      await dbSet(dbRef(database, `users/${uid}`), {
        displayName,
        email,
        role,
        school,
        class: cls || "",
        section: sec || "",
      });

      alert("Sign Up کامیاب۔ اب Login کریں۔");
      // فارم کو Login موڈ میں لائیں
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

// -------------------
// 3. AUTH STATE چیک: لاگ ان / لاگ آؤٹ پر UI اپڈیٹ
// -------------------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // یوزر لاگ ان ہے
    authContainer.classList.add("hidden");
    mainApp.classList.remove("hidden");

    // Realtime DB سے یوزر کا پروفائل لوڈ کریں
    const uid = user.uid;
    const userSnap = await dbGet(dbRef(database, `users/${uid}`));
    if (userSnap.exists()) {
      const profile = userSnap.val();
      window.currentUserProfile = {
        uid,
        displayName: profile.displayName,
        email: profile.email,
        role: profile.role,
        school: profile.school,
        class: profile.class,
        section: profile.section,
      };
      // اب setup.js میں یہ پروفائل استعمال ہوگی
      // چونکہ اسکولز loadLowest() کے ذریعہ پہلے لوڈ ہو چکے تھے، تو setup میں اسی data سے آگے بڑھیں
      document.dispatchEvent(new Event("userLoggedIn"));
    } else {
      alert("User profile ملا نہيں، دوبارہ Login کریں۔");
      await signOut(auth);
    }
  } else {
    // یوزر لاگ آؤٹ ہے
    authContainer.classList.remove("hidden");
    mainApp.classList.add("hidden");
    window.currentUserProfile = null;
  }
});

// -------------------
// 4. LOGOUT بٹن
// -------------------
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Logout میں مسئلہ:", err);
  }
});
