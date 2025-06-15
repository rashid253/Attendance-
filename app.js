// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref as dbRef, set as dbSet, onValue, get as dbGet } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
// Firebase Authentication imports
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Firebase configuration (provided)
const firebaseConfig = {
  apiKey: "AIzaSyBsx…EpICEzA",
  authDomain: "attandace-management.firebaseapp.com",
  projectId: "attandace-management",
  storageBucket: "attandace-management.appspot.com",
  messagingSenderId: "222685278846",
  appId: "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B",
  databaseURL: "https://attandace-management-default-rtdb.firebaseio.com",
};
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const appDataRef = dbRef(database, "appData");
const requestsRef = dbRef(database, "requests");
const auth = getAuth(app);

// IndexedDB helpers (idb-keyval IIFE assumed loaded in HTML)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// ----------------------
// Local application state (per-school data)
// ----------------------
let studentsBySchool       = {};
let attendanceDataBySchool = {};
let paymentsDataBySchool   = {};
let lastAdmNoBySchool      = {};
let fineRates              = { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct         = 75;
let schools                = [];
let currentSchool          = null;
let teacherClass           = null;
let teacherSection         = null;

// Active school's data (references)
let students       = [];
let attendanceData = {};
let paymentsData   = {};
let lastAdmNo      = 0;

// Ensure data structures exist for a given school
async function ensureSchoolData(school) {
  if (!school) return;
  if (!studentsBySchool[school]) {
    studentsBySchool[school] = [];
    await idbSet("studentsBySchool", studentsBySchool);
  }
  if (!attendanceDataBySchool[school]) {
    attendanceDataBySchool[school] = {};
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
  }
  if (!paymentsDataBySchool[school]) {
    paymentsDataBySchool[school] = {};
    await idbSet("paymentsDataBySchool", paymentsDataBySchool);
  }
  if (lastAdmNoBySchool[school] === undefined) {
    lastAdmNoBySchool[school] = 0;
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
  }
}

// Initialize state from IndexedDB
async function initLocalState() {
  studentsBySchool       = (await idbGet("studentsBySchool"))       || {};
  attendanceDataBySchool = (await idbGet("attendanceDataBySchool")) || {};
  paymentsDataBySchool   = (await idbGet("paymentsDataBySchool"))   || {};
  lastAdmNoBySchool      = (await idbGet("lastAdmNoBySchool"))      || {};
  fineRates              = (await idbGet("fineRates"))              || fineRates;
  eligibilityPct         = (await idbGet("eligibilityPct"))         || eligibilityPct;
  schools                = (await idbGet("schools"))                || [];
  currentSchool          = (await idbGet("currentSchool"))          || null;
  teacherClass           = (await idbGet("teacherClass"))           || null;
  teacherSection         = (await idbGet("teacherSection"))         || null;

  if (currentSchool) {
    await ensureSchoolData(currentSchool);
    students       = studentsBySchool[currentSchool];
    attendanceData = attendanceDataBySchool[currentSchool];
    paymentsData   = paymentsDataBySchool[currentSchool];
    lastAdmNo      = lastAdmNoBySchool[currentSchool];
  }
}

// Sync local state to Firebase
async function syncToFirebase() {
  const payload = {
    studentsBySchool,
    attendanceDataBySchool,
    paymentsDataBySchool,
    lastAdmNoBySchool,
    fineRates,
    eligibilityPct,
    schools,
    currentSchool,
    teacherClass,
    teacherSection,
  };
  try {
    await dbSet(appDataRef, payload);
    console.log("✅ Synced data to Firebase");
  } catch (err) {
    console.error("Firebase sync failed:", err);
  }
}

// Share PDF via Web Share API (unchanged)
async function sharePdf(blob, fileName, title) {
  if (
    navigator.canShare &&
    navigator.canShare({ files: [new File([blob], fileName, { type: "application/pdf" })] })
  ) {
    try {
      await navigator.share({ title, files: [new File([blob], fileName, { type: "application/pdf" })] });
    } catch (err) {
      if (err.name !== "AbortError") console.error("Share failed", err);
    }
  }
}

// ----------------------
// DOMContentLoaded: Main Initialization
// ----------------------
window.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove("hidden"));
  const hide = (...els) => els.forEach(e => e && e.classList.add("hidden"));

  // ----------------------
  // Authentication UI and logic
  // ----------------------
  // Login form submission
  if ($("loginForm")) {
    $("loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("loginEmail").value;
      const password = $("loginPassword").value;
      try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will handle post-login
      } catch (error) {
        alert("Login failed: " + error.message);
      }
    });
  }

  // Signup form submission (principal or teacher)
  if ($("signupForm")) {
    $("signupForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const role = $("roleSelect").value; // expected "principal" or "teacher"
      const email = $("signupEmail").value.trim();
      const password = $("signupPassword").value;
      const schoolName = $("signupSchool").value.trim();
      const cls = role === "teacher" ? $("signupClass").value : null;
      const sec = role === "teacher" ? $("signupSection").value : null;

      // Validation
      if (!email || !password || !schoolName || (role === "teacher" && (!cls || !sec))) {
        alert("Please fill all required fields.");
        return;
      }
      try {
        // Create the auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        // Store signup request in database
        const requestData = { 
          uid,
          email,
          role,
          school: schoolName,
          class: cls,
          section: sec,
          status: "pending"
        };
        await dbSet(dbRef(requestsRef, uid), requestData);
        alert("Signup request submitted. Please wait for admin approval.");
      } catch (error) {
        alert("Signup failed: " + error.message);
      }
    });
  }

  // Admin signup form submission
  if ($("adminSignupForm")) {
    $("adminSignupForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("adminEmail").value.trim();
      const password = $("adminPassword").value;
      const schoolName = $("adminSchool").value.trim();
      if (!email || !password || !schoolName) {
        alert("Please fill all required fields.");
        return;
      }
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        // Add new school to list if not exists
        if (!schools.includes(schoolName)) {
          schools.push(schoolName);
          await idbSet("schools", schools);
          await syncToFirebase();
        }
        // Optionally, store admin info (could be used on admin page)
        await dbSet(dbRef(database, `admins/${uid}`), { email, school: schoolName });
        alert("Admin account created. You can now sign in.");
      } catch (error) {
        alert("Admin signup failed: " + error.message);
      }
    });
  }

  // Password reset
  if ($("resetPasswordBtn")) {
    $("resetPasswordBtn").addEventListener("click", async () => {
      const email = $("loginEmail").value.trim();
      if (!email) {
        alert("Please enter your email for password reset.");
        return;
      }
      try {
        await sendPasswordResetEmail(auth, email);
        alert("Password reset email sent.");
      } catch (error) {
        alert("Failed to send reset email: " + error.message);
      }
    });
  }

  // Hide main app sections until authenticated
  function hideMainApp() {
    hide(
      $("setupForm"), $("setupDisplay"),
      $("financial-settings"), $("student-registration"),
      $("attendance-section"), $("analytics-section"),
      $("register-section"), $("chooseBackupFolder"),
      $("restoreData"), $("resetData")
    );
  }
  function showMainApp() {
    show(
      $("financial-settings"), $("student-registration"),
      $("attendance-section"), $("analytics-section"),
      $("register-section"), $("chooseBackupFolder"),
      $("restoreData"), $("resetData")
    );
  }
  hideMainApp();

  // ----------------------
  // Authentication state change handler
  // ----------------------
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User signed in
      const uid = user.uid;
      // Check if this user is an admin
      const adminSnap = await dbGet(dbRef(database, `admins/${uid}`));
      if (adminSnap.exists()) {
        // Admin: redirect or load admin interface
        window.location.href = "admin.html";
        return;
      }
      // Check pending request (principal/teacher)
      const reqSnap = await dbGet(dbRef(database, `requests/${uid}`));
      if (!reqSnap.exists() || reqSnap.val().status !== "approved") {
        alert("Your account is pending approval by admin.");
        await signOut(auth);
        return;
      }
      const data = reqSnap.val();
      currentSchool = data.school;
      if (data.role === "teacher") {
        teacherClass = data.class;
        teacherSection = data.section;
      } else {
        // Principal: has access to all classes (we leave class/section unset)
        teacherClass = null;
        teacherSection = null;
      }
      // Save to local IndexedDB and state
      await idbSet("currentSchool", currentSchool);
      await idbSet("teacherClass", teacherClass);
      await idbSet("teacherSection", teacherSection);
      await initLocalState();
      showMainApp();
      // Proceed to loadSetup and original logic
      // Note: resetViews and loadSetup will handle showing the right UI
      await loadSetup();
    } else {
      // User signed out
      hideMainApp();
      alert("Please login to access the application.");
      // Optionally clear local state or redirect to login screen
    }
  });

  // ----------------------
  // Main App Logic (unchanged)
  // ----------------------
  // 1. SETUP SECTION
  const setupForm      = $("setupForm");
  const setupDisplay   = $("setupDisplay");
  const schoolInput    = $("schoolInput");
  const schoolSelect   = $("schoolSelect");
  const classSelect    = $("teacherClassSelect");
  const sectionSelect  = $("teacherSectionSelect");
  const setupText      = $("setupText");
  const saveSetupBtn   = $("saveSetup");
  const editSetupBtn   = $("editSetup");
  const schoolListDiv  = $("schoolList");

  function renderSchoolList() {
    // ... existing code ...
  }

  let loadSetup = async () => {
    schools        = (await idbGet("schools")) || [];
    currentSchool  = await idbGet("currentSchool");
    teacherClass   = await idbGet("teacherClass");
    teacherSection = await idbGet("teacherSection");

    // Populate school dropdown
    schoolSelect.innerHTML = ['<option disabled selected>-- Select School --</option>',
      ...schools.map(s => `<option value="${s}">${s}</option>` )
    ].join("");
    if (currentSchool) schoolSelect.value = currentSchool;

    renderSchoolList();

    if (currentSchool && teacherClass && teacherSection) {
      await ensureSchoolData(currentSchool);
      students       = studentsBySchool[currentSchool];
      attendanceData = attendanceDataBySchool[currentSchool];
      paymentsData   = paymentsDataBySchool[currentSchool];
      lastAdmNo      = lastAdmNoBySchool[currentSchool];

      classSelect.value = teacherClass;
      sectionSelect.value = teacherSection;
      setupText.textContent = `${currentSchool} 🏫 | Class: ${teacherClass} | Section: ${teacherSection}`;
      hide(setupForm);
      show(setupDisplay);

      // Show other sections now that setup is done
      resetViews();
      setTimeout(() => {
        renderStudents();
        updateCounters();
      }, 0);

    } else {
      show(setupForm);
      hide(setupDisplay);
      resetViews();
    }
  };

  saveSetupBtn.onclick = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) { alert("Please login to continue."); return; }
    const newSchool = schoolInput.value.trim();
    if (newSchool) {
      if (!schools.includes(newSchool)) {
        schools.push(newSchool);
        await idbSet("schools", schools);
        await syncToFirebase();
      }
      schoolInput.value = "";
      return loadSetup();
    }
    const selSchool  = schoolSelect.value;
    const selClass   = classSelect.value;
    const selSection = sectionSelect.value;
    if (!selSchool || !selClass || !selSection) {
      alert("Please select a school, class, and section.");
      return;
    }
    currentSchool  = selSchool;
    teacherClass   = selClass;
    teacherSection = selSection;
    await idbSet("currentSchool", currentSchool);
    await idbSet("teacherClass", teacherClass);
    await idbSet("teacherSection", teacherSection);
    await syncToFirebase();
    await loadSetup();
  };

  editSetupBtn.onclick = (e) => {
    e.preventDefault();
    show(setupForm);
    hide(setupDisplay);
    resetViews();
  };

  // 2. FINANCIAL SETTINGS SECTION (unchanged)
  const formDiv             = $("financialForm");
  const saveSettings        = $("saveSettings");
  const fineAbsentInput     = $("fineAbsent");
  const fineLateInput       = $("fineLate");
  const fineLeaveInput      = $("fineLeave");
  const fineHalfDayInput    = $("fineHalfDay");
  const eligibilityPctInput = $("eligibilityPct");
  const settingsCard        = document.createElement("div");
  const editSettings        = document.createElement("button");
  settingsCard.id = "settingsCard";
  settingsCard.className = "card hidden";
  editSettings.id = "editSettings";
  editSettings.className = "btn no-print hidden";
  editSettings.textContent = "Edit Settings";
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editSettings);
  fineAbsentInput.value     = fineRates.A;
  fineLateInput.value       = fineRates.Lt;
  fineLeaveInput.value      = fineRates.L;
  fineHalfDayInput.value    = fineRates.HD;
  eligibilityPctInput.value = eligibilityPct;

  saveSettings.onclick = async () => {
    fineRates = {
      A: Number(fineAbsentInput.value) || 0,
      Lt: Number(fineLateInput.value) || 0,
      L: Number(fineLeaveInput.value) || 0,
      HD: Number(fineHalfDayInput.value) || 0,
    };
    eligibilityPct = Number(eligibilityPctInput.value) || 0;
    await idbSet("fineRates", fineRates);
    await idbSet("eligibilityPct", eligibilityPct);
    await syncToFirebase();
    alert("Settings saved.");
  };

  editSettings.onclick = () => {
    show(formDiv, saveSettings, fineAbsentInput, fineLateInput, fineLeaveInput, fineHalfDayInput, eligibilityPctInput);
    hide(settingsCard, editSettings);
  };

  // 3. COUNTERS SECTION (unchanged)
  const animatedCountersDiv = $("animatedCounters");
  function updateCounters() {
    $("monthlyAbsents").textContent     = Object.values(attendanceData).flat().filter(status => status === "A").length;
    $("monthlyLates").textContent       = Object.values(attendanceData).flat().filter(status => status === "Lt").length;
    $("monthlyLeaves").textContent      = Object.values(attendanceData).flat().filter(status => status === "L").length;
    $("monthlyHalfDays").textContent    = Object.values(attendanceData).flat().filter(status => status === "HD").length;
    $("attendanceEligiblePct").textContent = eligibilityPct + "%";
  }

  // 4. STUDENT REGISTRATION SECTION (unchanged logic, added auth check)
  const studentForm           = $("studentForm");
  const studentTable         = $("studentTable");
  const shareRegistrationBtn = $("shareRegistration");
  const downloadRegistrationBtn = $("downloadRegistrationPDF");
  const editRegistrationBtn  = $("editRegistration");
  const saveRegistrationBtn  = $("saveRegistration");
  const deleteSelectedBtn    = $("deleteSelected");
  const selectAllStudents    = $("selectAllStudents");
  const doneEditingBtn       = $("doneEditing");

  function renderStudents() {
    // ... existing rendering code ...
  }

  // "Edit Registration" button
  editRegistrationBtn.onclick = () => {
    show($("student-registration").querySelector(".row-inline"),
      selectAllStudents, editSelectedBtn, deleteSelectedBtn, saveRegistrationBtn);
    hide(editRegistrationBtn, shareRegistrationBtn, downloadRegistrationBtn);
    renderStudents();
    updateCounters();
  };

  // "Done Editing" button (if exists)
  if (doneEditingBtn) {
    doneEditingBtn.onclick = () => {
      saveRegistrationBtn.onclick(); // Save changes
    };
  }

  saveRegistrationBtn.onclick = async () => {
    if (!auth.currentUser) { alert("Please login to continue."); return; }
    if (!doneEditingBtn.classList.contains("hidden")) {
      alert("Finish editing before saving.");
      return;
    }
    studentsBySchool[currentSchool] = students;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    hide($("student-registration").querySelector(".row-inline"),
         selectAllStudents, editSelectedBtn, deleteSelectedBtn, saveRegistrationBtn);
    show(editRegistrationBtn, shareRegistrationBtn, downloadRegistrationBtn);
    renderStudents();
    updateCounters();
  };

  // "Share Registration" (WhatsApp)
  shareRegistrationBtn.onclick = () => {
    const header = `*Student Registration List*\n${setupText.textContent}\n\n`;
    const lines = students
      .filter(s => s.cls === classSelect.value && s.sec === sectionSelect.value)
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}  Parent: ${s.parent}`);
    const whatsappURL = "https://wa.me/?text=" + encodeURIComponent(header + lines.join("\n"));
    window.open(whatsappURL, "_blank");
  };

  // "Download Registration" (PDF)
  downloadRegistrationBtn.onclick = async () => {
    const doc = new jspdf.jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split("T")[0];
    doc.setFontSize(18);
    doc.text("Student Registration List", 14, 20);
    doc.setFontSize(10);
    doc.text(`Date: ${today}`, pageWidth - 14, 20, { align: "right" });
    doc.setFontSize(12);
    doc.text(setupText.textContent, 14, 36);

    const tempTable = document.createElement("table");
    tempTable.innerHTML = `
      <tr>
        <th>#</th><th>Adm#</th><th>Name</th><th>Parent</th><th>Contact</th><th>Occupation</th><th>Address</th>
      </tr>
      ${students
        .filter(s => s.cls === classSelect.value && s.sec === sectionSelect.value)
        .map((s, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${s.adm}</td>
            <td>${s.name}</td>
            <td>${s.parent}</td>
            <td>${s.contact}</td>
            <td>${s.occupation}</td>
            <td>${s.address}</td>
          </tr>
        `).join("")}
    `;
    doc.autoTable({
      startY: 50,
      html: tempTable,
      styles: { fontSize: 10 }
    });
    const fileName = `students_${classSelect.value}_${sectionSelect.value}_${today}.pdf`;
    const blob = doc.output("blob");
    doc.save(fileName);
    await sharePdf(blob, fileName, "Student Registration List");
  };

  // 5. PAYMENT MODAL SECTION (unchanged)
  const paymentModal         = $("paymentModal");
  const payAdmSpan           = $("payAdm");
  const paymentAmountInput   = $("paymentAmount");
  const paymentModalCloseBtn = $("paymentModalClose");
  const savePaymentBtn       = $("savePayment");
  const cancelPaymentBtn     = $("cancelPayment");

  // Additional event handlers for payment (unchanged)...
  
  // ----------------------
  // SERVICE WORKER REGISTRATION (unchanged)
  // ----------------------
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(console.error);
  }

  // ----------------------
  // Firebase onValue Listener (sync from Firebase to IndexedDB/UI)
  // ----------------------
  onValue(appDataRef, async (snapshot) => {
    if (!snapshot.exists()) {
      // Initialize default structure if missing
      const defaultPayload = {
        studentsBySchool: {},
        attendanceDataBySchool: {},
        paymentsDataBySchool: {},
        lastAdmNoBySchool: {},
        fineRates: { A:50, Lt:20, L:10, HD:30 },
        eligibilityPct: 75,
        schools: [],
        currentSchool: null,
        teacherClass: null,
        teacherSection: null
      };
      await dbSet(appDataRef, defaultPayload);
      studentsBySchool       = {};
      attendanceDataBySchool = {};
      paymentsDataBySchool   = {};
      lastAdmNoBySchool      = {};
      fineRates              = defaultPayload.fineRates;
      eligibilityPct         = defaultPayload.eligibilityPct;
      schools                = [];
      currentSchool          = null;
      teacherClass           = null;
      teacherSection         = null;
      await Promise.all([
        idbSet("studentsBySchool", studentsBySchool),
        idbSet("attendanceDataBySchool", attendanceDataBySchool),
        idbSet("paymentsDataBySchool", paymentsDataBySchool),
        idbSet("lastAdmNoBySchool", lastAdmNoBySchool),
        idbSet("fineRates", fineRates),
        idbSet("eligibilityPct", eligibilityPct),
        idbSet("schools", schools),
        idbSet("currentSchool", currentSchool),
        idbSet("teacherClass", teacherClass),
        idbSet("teacherSection", teacherSection),
      ]);
      return loadSetup();
    }
    const data = snapshot.val();
    studentsBySchool       = data.studentsBySchool       || {};
    attendanceDataBySchool = data.attendanceDataBySchool || {};
    paymentsDataBySchool   = data.paymentsDataBySchool   || {};
    lastAdmNoBySchool      = data.lastAdmNoBySchool      || {};
    fineRates              = data.fineRates              || { A:50, Lt:20, L:10, HD:30 };
    eligibilityPct         = data.eligibilityPct         || 75;
    schools                = data.schools                || [];
    currentSchool          = data.currentSchool          || null;
    teacherClass           = data.teacherClass           || null;
    teacherSection         = data.teacherSection         || null;
    await Promise.all([
      idbSet("studentsBySchool", studentsBySchool),
      idbSet("attendanceDataBySchool", attendanceDataBySchool),
      idbSet("paymentsDataBySchool", paymentsDataBySchool),
      idbSet("lastAdmNoBySchool", lastAdmNoBySchool),
      idbSet("fineRates", fineRates),
      idbSet("eligibilityPct", eligibilityPct),
      idbSet("schools", schools),
      idbSet("currentSchool", currentSchool),
      idbSet("teacherClass", teacherClass),
      idbSet("teacherSection", teacherSection),
    ]);
    await loadSetup();
    console.log("✅ Loaded data from Firebase into IndexedDB and UI");
  });

  // Final call to loadSetup on page load
  await loadSetup();

  // Ensure counters container is scrollable
  const container = $("countersContainer");
  if (container) {
    container.style.display = "flex";
    container.style.overflowX = "auto";
    container.style.whiteSpace = "nowrap";
  }
});

// Helper: show/hide other sections based on setup completion
function resetViews() {
  const setupDone = currentSchool && teacherClass && teacherSection;
  const allSections = [
    $("financial-settings"),
    $("animatedCounters"),
    $("student-registration"),
    $("attendance-section"),
    $("analytics-section"),
    $("register-section"),
    $("chooseBackupFolder"),
    $("restoreData"),
    $("resetData"),
  ];
  if (!setupDone) {
    allSections.forEach(sec => sec && sec.classList.add("hidden"));
  } else {
    allSections.forEach(sec => sec && sec.classList.remove("hidden"));
  }
}
