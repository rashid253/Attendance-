// auth.js
// ------------------------------------------------------
// Authentication & User‐Profile Logic (separate file):
//  1) Firebase Initialization (Auth + Firestore)
//  2) Signup Wizard (Owner/Admin creates school, branches, classes, sections) – handled in app.js
//  3) Login (Owner/Teacher) & Auth‐State Listener
//  4) Exported Objects for app.js:
//       - auth, db
//       - currentProfile (Firestore “users/{uid}” data)
//       - currentSchoolData (Firestore “schools/{schoolId}” data)
//       - onAuthStateChanged, signOut
// ------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged as fbOnAuthStateChanged,
  signOut as fbSignOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ------------------------------------------------------
// 1) FIREBASE INITIALIZATION
// ------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBsx5pWhYGh1bJ9gL2bmC68gVc6EpICEzA",
  authDomain: "attandace-management.firebaseapp.com",
  databaseURL: "https://attandace-management-default-rtdb.firebaseio.com",
  projectId: "attandace-management",
  storageBucket: "attandace-management.appspot.com",
  messagingSenderId: "222685278846",
  appId: "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ----------------------
// 2) APP STATE (to be used by app.js)
// ----------------------
export let currentProfile     = null;    // Firestore “users/{uid}” doc data
export let currentSchoolData  = null;    // Firestore “schools/{schoolId}” doc data

// ----------------------
// 3) LOGIN FLOW & VIEW SWITCHES
//    (Signup Wizard is in app.js)
// ----------------------

// Grab login elements (id must match index.html)
const loginForm       = document.getElementById("loginForm");
const loginEmailInput = document.getElementById("loginEmail");
const loginPwdInput   = document.getElementById("loginPassword");
const loginErrorP     = document.getElementById("loginError");
const showSignupBtn   = document.getElementById("showSignup");

// showView helper will be defined in app.js, so we only trigger events here
if (loginForm) {
  loginForm.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    if (loginErrorP) loginErrorP.textContent = "";
    const email = loginEmailInput.value.trim();
    const pwd   = loginPwdInput.value;
    try {
      await signInWithEmailAndPassword(auth, email, pwd);
      loginEmailInput.value = "";
      loginPwdInput.value   = "";
      // onAuthStateChanged (below) will do the view switching
    } catch (err) {
      console.error(err);
      if (loginErrorP) loginErrorP.textContent = "Invalid credentials.";
    }
  });
}

if (showSignupBtn) {
  showSignupBtn.addEventListener("click", () => {
    // index.html has a #signupContainer view—app.js will call showView on it
    document.getElementById("signupContainer")?.classList.remove("hidden");
    document.getElementById("loginContainer")?.classList.add("hidden");
    // Reset signup wizard to Step 1
    const step1 = document.getElementById("signupStep1");
    const steps = [ "signupStep1", "signupStep2", "signupStep3", "signupStep4" ];
    steps.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });
    if (step1) step1.classList.remove("hidden");
  });
}

// ----------------------
// 4) AUTH STATE LISTENER
// ----------------------
export function onAuthStateChanged(callback) {
  fbOnAuthStateChanged(auth, async (user) => {
    if (user) {
      // Fetch user profile from Firestore “users/{uid}”
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        await fbSignOut(auth);
        callback(null, null, null);
        return;
      }
      currentProfile = userDocSnap.data();

      const { role, schoolId } = currentProfile;
      // Fetch school data from Firestore “schools/{schoolId}”
      const schoolDocRef  = doc(db, "schools", schoolId);
      const schoolDocSnap = await getDoc(schoolDocRef);
      if (!schoolDocSnap.exists()) {
        await fbSignOut(auth);
        callback(null, null, null);
        return;
      }
      currentSchoolData = schoolDocSnap.data();
      currentSchoolData.id = schoolId;

      // Notify app.js
      callback(user, currentProfile, currentSchoolData);
    } else {
      currentProfile    = null;
      currentSchoolData = null;
      callback(null, null, null);
    }
  });
}

// ----------------------
// 5) SIGN OUT
// ----------------------
export function signOut() {
  return fbSignOut(auth);
}
