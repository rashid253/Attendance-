// auth.js
// ------------------------------------------------------
// Authentication & User‐Profile Logic (separate file):
//  1) Firebase Initialization (Auth + Firestore)
//  2) Signup Wizard (Owner/Admin creates school, branches, classes, sections)
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
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ----------------------
// 1) FIREBASE INITIALIZATION
// ----------------------
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_APIKEY",
  authDomain: "YOUR_FIREBASE_AUTHDOMAIN",
  projectId: "YOUR_FIREBASE_PROJECTID",
  storageBucket: "YOUR_FIREBASE_STORAGEBUCKET",
  messagingSenderId: "YOUR_FIREBASE_MSGSENDERID",
  appId: "YOUR_FIREBASE_APPID",
  measurementId: "YOUR_FIREBASE_MEASUREMENTID"
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ----------------------
// 2) APP STATE (to be used by app.js)
// ----------------------
export let currentProfile     = null;    // Firestore “users/{uid}” doc data
export let currentSchoolData  = null;    // Firestore “schools/{schoolId}” doc data

// ----------------------
// 3) SIGNUP WIZARD LOGIC
//    (Owner/Admin only — creates school + user profile)
// ----------------------

// Collect signup inputs from index.html:
const ownerNameInput     = document.getElementById("ownerName");
const ownerEmailInput    = document.getElementById("ownerEmail");
const ownerPasswordInput = document.getElementById("ownerPassword");
const instituteNameInput = document.getElementById("instituteName");
const branchesContainer  = document.getElementById("branchesContainer");
const classesContainer   = document.getElementById("classesContainer");
const sectionsContainer  = document.getElementById("sectionsContainer");
const signupErrorP       = document.getElementById("signupError");

const toStep2Btn     = document.getElementById("toStep2");
const backToStep1Btn = document.getElementById("backToStep1");
const toStep3Btn     = document.getElementById("toStep3");
const backToStep2Btn = document.getElementById("backToStep2");
const toStep4Btn     = document.getElementById("toStep4");
const backToStep3Btn = document.getElementById("backToStep3");
const signupFinishBtn= document.getElementById("signupFinish");

const signupSteps = {
  step1: document.getElementById("signupStep1"),
  step2: document.getElementById("signupStep2"),
  step3: document.getElementById("signupStep3"),
  step4: document.getElementById("signupStep4"),
};

let signupData = {
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  instituteName: "",
  branches: [],
  classes: [],
  sections: {}
};

function showSignupStep(stepEl) {
  Object.values(signupSteps).forEach(s => s.classList.add("hidden"));
  stepEl.classList.remove("hidden");
}

function clearError(el) {
  el.textContent = "";
}
function showError(el, msg) {
  el.textContent = msg;
}

// Auto‐expand “branches” and “classes” inputs:
function setupAutoExpand(containerSelector) {
  containerSelector.addEventListener("input", (evt) => {
    const inputListDiv = evt.currentTarget.querySelector(".auto-list");
    const inputs = Array.from(inputListDiv.querySelectorAll(".auto-input"));
    const last = inputs[inputs.length - 1];
    if (last.value.trim() !== "") {
      const newInput = last.cloneNode();
      newInput.value = "";
      newInput.placeholder = last.placeholder;
      inputListDiv.appendChild(newInput);
    }
  });
}

function collectAutoList(containerDiv) {
  const inputs = Array.from(containerDiv.querySelectorAll(".auto-input"));
  return inputs.map(i => i.value.trim()).filter(v => v !== "");
}

// Step1 → Step2
toStep2Btn.addEventListener("click", () => {
  clearError(signupErrorP);
  const name  = ownerNameInput.value.trim();
  const email = ownerEmailInput.value.trim();
  const pwd   = ownerPasswordInput.value;
  if (!name || !email || !pwd) {
    showError(signupErrorP, "All fields are required.");
    return;
  }
  signupData.ownerName     = name;
  signupData.ownerEmail    = email;
  signupData.ownerPassword = pwd;
  showSignupStep(signupSteps.step2);
});
backToStep1Btn.addEventListener("click", () => {
  clearError(signupErrorP);
  showSignupStep(signupSteps.step1);
});

// Step2 → Step3
toStep3Btn.addEventListener("click", () => {
  clearError(signupErrorP);
  const inst     = instituteNameInput.value.trim();
  const branches = collectAutoList(branchesContainer);
  if (!inst) {
    showError(signupErrorP, "Institute name is required.");
    return;
  }
  if (branches.length === 0) {
    showError(signupErrorP, "At least one branch is required.");
    return;
  }
  signupData.instituteName = inst;
  signupData.branches      = branches;
  showSignupStep(signupSteps.step3);
});
backToStep2Btn.addEventListener("click", () => {
  clearError(signupErrorP);
  showSignupStep(signupSteps.step2);
});

// Step3 → Step4
toStep4Btn.addEventListener("click", () => {
  clearError(signupErrorP);
  const classes = collectAutoList(classesContainer);
  if (classes.length === 0) {
    showError(signupErrorP, "At least one class is required.");
    return;
  }
  signupData.classes = classes;
  // Build “sections per class” blocks:
  sectionsContainer.innerHTML = "";
  signupData.sections = {};
  classes.forEach(cls => {
    const wrapper = document.createElement("div");
    wrapper.className = "class‐section-block";
    wrapper.innerHTML = `
      <p><strong>${cls}</strong> – Sections:</p>
      <div class="auto-list">
        <input type="text" class="auto-input" placeholder="Section name (e.g. A)" required />
      </div>
    `;
    sectionsContainer.appendChild(wrapper);
    const autoListDiv = wrapper.querySelector(".auto-list");
    autoListDiv.addEventListener("input", (evt) => {
      const inputs = Array.from(evt.currentTarget.querySelectorAll(".auto-input"));
      const last = inputs[inputs.length - 1];
      if (last.value.trim() !== "") {
        const newInp = last.cloneNode();
        newInp.value = "";
        newInp.placeholder = last.placeholder;
        evt.currentTarget.appendChild(newInp);
      }
    });
  });
  showSignupStep(signupSteps.step4);
});
backToStep3Btn.addEventListener("click", () => {
  clearError(signupErrorP);
  showSignupStep(signupSteps.step3);
});

// Finish Signup (create Firebase Auth user + Firestore docs)
signupFinishBtn.addEventListener("click", async () => {
  clearError(signupErrorP);
  // Collect sections for each class
  const clsBlocks = Array.from(sectionsContainer.querySelectorAll(".class‐section-block"));
  let valid = true;
  clsBlocks.forEach(block => {
    const clsName = block.querySelector("p strong").textContent;
    const secs = Array.from(block.querySelectorAll(".auto-input"))
      .map(i => i.value.trim())
      .filter(v => v !== "");
    if (secs.length === 0) valid = false;
    signupData.sections[clsName] = secs;
  });
  if (!valid) {
    showError(signupErrorP, "Each class must have at least one section.");
    return;
  }

  try {
    // Create Auth user (owner)
    const userCred = await createUserWithEmailAndPassword(
      auth,
      signupData.ownerEmail,
      signupData.ownerPassword
    );
    const uid = userCred.user.uid;

    // Create Firestore: schools/{uid}
    await setDoc(doc(db, "schools", uid), {
      name: signupData.instituteName,
      branches: signupData.branches,
      classes: signupData.classes,
      sections: signupData.sections,
      createdAt: new Date()
    });

    // Create Firestore: users/{uid}
    await setDoc(doc(db, "users", uid), {
      name: signupData.ownerName,
      email: signupData.ownerEmail,
      role: "owner",
      schoolId: uid,
      assigned: [],
      createdAt: new Date()
    });

    // Clear all signup fields
    ownerNameInput.value     = "";
    ownerEmailInput.value    = "";
    ownerPasswordInput.value = "";
    instituteNameInput.value = "";
    branchesContainer.querySelector(".auto-list").innerHTML = `<input type="text" class="auto-input" placeholder="Branch name" />`;
    classesContainer.querySelector(".auto-list").innerHTML  = `<input type="text" class="auto-input" placeholder="Class name" />`;
    sectionsContainer.innerHTML = "";

    // Switch to Login view
    showLoginView();
    alert("Signup successful! Please log in.");
  } catch (err) {
    console.error(err);
    showError(signupErrorP, err.message);
  }
});

// Initialize auto‐expand on Step2 & Step3
setupAutoExpand(branchesContainer);
setupAutoExpand(classesContainer);

// Initially show Step1
showSignupStep(signupSteps.step1);

// ----------------------
// 4) LOGIN FLOW & VIEW SWITCHES
// ----------------------
const loginForm       = document.getElementById("loginForm");
const loginEmailInput = document.getElementById("loginEmail");
const loginPwdInput   = document.getElementById("loginPassword");
const loginErrorP     = document.getElementById("loginError");
const showSignupBtn   = document.getElementById("showSignup");

// Hide all “main app” views initially
const views = {
  signup: document.getElementById("signupContainer"),
  login:  document.getElementById("loginContainer"),
  ownerDash: document.getElementById("ownerDashboard"),
  teacherDash: document.getElementById("teacherDashboard"),
};

function showView(viewEl) {
  Object.values(views).forEach(v => v.classList.add("hidden"));
  viewEl.classList.remove("hidden");
}

function showLoginView() {
  clearError(loginErrorP);
  showView(views.login);
}

showSignupBtn.addEventListener("click", () => {
  clearError(loginErrorP);
  showView(views.signup);
  showSignupStep(signupSteps.step1);
});

loginForm.addEventListener("submit", async (evt) => {
  evt.preventDefault();
  clearError(loginErrorP);
  const email = loginEmailInput.value.trim();
  const pwd   = loginPwdInput.value;
  try {
    await signInWithEmailAndPassword(auth, email, pwd);
    loginEmailInput.value = "";
    loginPwdInput.value  = "";
  } catch (err) {
    console.error(err);
    showError(loginErrorP, "Invalid credentials.");
  }
});

// ----------------------
// 5) AUTH STATE LISTENER
// ----------------------
export function onAuthStateChanged(callback) {
  fbOnAuthStateChanged(auth, async (user) => {
    if (user) {
      // Fetch user profile
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        await fbSignOut(auth);
        return;
      }
      currentProfile = userDoc.data();
      const { role, schoolId, name } = currentProfile;

      // Fetch school data
      const schoolDoc = await getDoc(doc(db, "schools", schoolId));
      if (!schoolDoc.exists()) {
        await fbSignOut(auth);
        return;
      }
      currentSchoolData = schoolDoc.data();
      currentSchoolData.id = schoolId;

      callback(user, currentProfile, currentSchoolData);
    } else {
      currentProfile = null;
      currentSchoolData = null;
      callback(null, null, null);
    }
  });
}

export function signOut() {
  return fbSignOut(auth);
}

// ----------------------
// Immediately after load, show Login
// ----------------------
showLoginView();
