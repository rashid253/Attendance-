// js/auth.js
import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { dbRef, get as dbGet } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { database } from "./firebase-config.js";
import { loadSetup } from "./setup.js"; // فرض کریں setup logic loadSetup export ہوا ہے
import { show, hide } from "./utils.js";

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("loginEmail");
const passwordInput = document.getElementById("loginPassword");

export function initAuth() {
  // اگر آپ index.html میں loginForm وغیرہ شامل کرنا چاہتے ہوں تو ایک الگ <section id="loginSection"> بنائیں
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // یوزر لاگ ان ہے، رول چیک کریں
      const snap = await dbGet(dbRef(database, `users/${user.uid}`));
      const profile = snap.val();
      if (!profile) {
        alert("Profile missing. Contact admin.");
        await signOut(auth);
        return;
      }
      const role = profile.role;
      switch (role) {
        case "admin":
          initAdminDashboard();
          break;
        case "principal":
          initPrincipalDashboard(profile.school);
          break;
        case "teacher":
          initTeacherDashboard(profile.school, profile.class, profile.sections);
          break;
        case "student":
          initStudentDashboard(profile.adm);
          break;
        default:
          alert("Unauthorized role.");
          await signOut(auth);
      }
    } else {
      // یوزر لاگ آؤٹ ہے، صرف login دکھائیں
      showLoginPage();
    }
  });

  // Login form submit
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const pass  = passwordInput.value.trim();
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // Firebase Auth خودکار onAuthStateChanged کو ٹرگر کرے گا
    } catch(err) {
      alert("Login failed: " + err.message);
    }
  });
}

export async function logout() {
  await signOut(auth);
  showLoginPage();
}

function showLoginPage() {
  // index.html پر آپ کے پاس <section id="loginSection"> ہونا چاہیے
  document.getElementById("loginSection").classList.remove("hidden");
  document.getElementById("mainApp").classList.add("hidden");
}

// ان initXDashboard() کو آپ اپنی باقی modules میں implement کریں گے
function initAdminDashboard() {
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");
  // یہاں loadSetup() وغیرہ کال کریں تاکہ app.js کی باقی logic چل جائے
  loadSetup();
  // اور اگر کوئی خاص “admin-only” UI ہو، وہ دکھائیں
}
function initPrincipalDashboard(school) {
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");
  loadSetup();
  // پھر آپ setup.js یا جہاں ضروری ہو school filter logic ڈال سکتے ہیں
}
function initTeacherDashboard(school, cls, sections) {
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");
  loadSetup();
  // صرف اپنی کلاس/سیکشن کا UI دکھائیں
}
function initStudentDashboard(adm) {
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");
  loadSetup();
  // صرف اپنے adm# کا ڈیٹا دکھائیں
}
