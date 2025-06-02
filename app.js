// app.js

import { database } from "./firebase-config.js";
import {
  ref as dbRef,
  set as dbSet,
  onValue,
  get,
  push,
  child,
  remove,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// -----------------------------
// DOM Elements
// -----------------------------

// Authentication
const authContainer   = document.getElementById("auth-container");
const mainApp         = document.getElementById("main-app");
const emailInput      = document.getElementById("emailInput");
const passwordInput   = document.getElementById("passwordInput");
const authButton      = document.getElementById("authButton");
const formTitle       = document.getElementById("form-title");
const toggleAuth      = document.getElementById("toggleAuth");
const signupExtra     = document.getElementById("signup-extra");
const roleSelect      = document.getElementById("roleSelect");
const displayNameInput= document.getElementById("displayNameInput");
const schoolRegisterSelect = document.getElementById("schoolRegisterSelect");
const classRegisterSelect  = document.getElementById("classRegisterSelect");
const sectionRegisterSelect= document.getElementById("sectionRegisterSelect");

// Logout
const logoutBtn       = document.getElementById("logoutBtn");

// FINANCIAL SETTINGS
const fineAbsentInput    = document.getElementById("fineAbsent");
const fineLateInput      = document.getElementById("fineLate");
const fineLeaveInput     = document.getElementById("fineLeave");
const fineHalfDayInput   = document.getElementById("fineHalfDay");
const eligibilityPctInput= document.getElementById("eligibilityPct");
const saveSettingsBtn    = document.getElementById("saveSettings");
const financialSection   = document.getElementById("financial-settings");

// Container for financial card and edit button
let financialCardDiv = null;
let editSettingsBtn  = null;

// STUDENT REGISTRATION
const studentNameInput    = document.getElementById("studentName");
const parentNameInput     = document.getElementById("parentName");
const parentContactInput  = document.getElementById("parentContact");
const parentOccupationInput = document.getElementById("parentOccupation");
const parentAddressInput  = document.getElementById("parentAddress");
const addStudentBtn       = document.getElementById("addStudent");
const studentsTableBody   = document.getElementById("studentsBody");
const selectAllStudentsCb = document.getElementById("selectAllStudents");
const editSelectedBtn     = document.getElementById("editSelected");
const doneEditingBtn      = document.getElementById("doneEditing");
const deleteSelectedBtn   = document.getElementById("deleteSelected");
const saveRegistrationBtn = document.getElementById("saveRegistration");
const editRegistrationBtn = document.getElementById("editRegistration");
const shareRegistrationBtn= document.getElementById("shareRegistration");
const downloadRegistrationPDFBtn = document.getElementById("downloadRegistrationPDF");

// MARK ATTENDANCE
const dateInput           = document.getElementById("dateInput");
const loadAttendanceBtn   = document.getElementById("loadAttendance");
const attendanceBodyDiv   = document.getElementById("attendanceBody");
const attendanceSummaryDiv= document.getElementById("attendanceSummary");
const saveAttendanceBtn   = document.getElementById("saveAttendance");
const resetAttendanceBtn  = document.getElementById("resetAttendance");
const downloadAttendancePDFBtn = document.getElementById("downloadAttendancePDF");
const shareAttendanceSummaryBtn = document.getElementById("shareAttendanceSummary");

// ANALYTICS
const analyticsTargetSelect   = document.getElementById("analyticsTarget");
const analyticsSectionSelect  = document.getElementById("analyticsSectionSelect");
const analyticsTypeSelect     = document.getElementById("analyticsType");
const analyticsDateInput      = document.getElementById("analyticsDate");
const analyticsMonthInput     = document.getElementById("analyticsMonth");
const semesterStartInput      = document.getElementById("semesterStart");
const semesterEndInput        = document.getElementById("semesterEnd");
const yearStartInput          = document.getElementById("yearStart");
const analyticsSearchInput    = document.getElementById("analyticsSearch");
const loadAnalyticsBtn        = document.getElementById("loadAnalytics");
const resetAnalyticsBtn       = document.getElementById("resetAnalytics");
const analyticsContainerDiv   = document.getElementById("analyticsContainer");
const analyticsTableHead      = document.querySelector("#analyticsTable thead tr");
const analyticsTableBody      = document.getElementById("analyticsBody");
const graphsDiv               = document.getElementById("graphs");
const barChartCanvas          = document.getElementById("barChart");
const pieChartCanvas          = document.getElementById("pieChart");
const downloadAnalyticsBtn    = document.getElementById("downloadAnalytics");
const shareAnalyticsBtn       = document.getElementById("shareAnalytics");
const analyticsFilterBtn      = document.getElementById("analyticsFilterBtn");
const analyticsFilterModal    = document.getElementById("analyticsFilterModal");
const applyAnalyticsFilterBtn = document.getElementById("applyAnalyticsFilter");

// ATTENDANCE REGISTER
const registerMonthInput      = document.getElementById("registerMonth");
const loadRegisterBtn         = document.getElementById("loadRegister");
const registerTableWrapper    = document.getElementById("registerTableWrapper");
const registerHeaderRow       = document.getElementById("registerHeader");
const registerBody            = document.getElementById("registerBody");
const changeRegisterBtn       = document.getElementById("changeRegister");
const saveRegisterBtn         = document.getElementById("saveRegister");
const downloadRegisterBtn     = document.getElementById("downloadRegister");
const shareRegisterBtn        = document.getElementById("shareRegister");

// PAYMENT MODAL
const paymentModal            = document.getElementById("paymentModal");
const paymentModalClose       = document.getElementById("paymentModalClose");
const payAdmSpan              = document.getElementById("payAdm");
const paymentAmountInput      = document.getElementById("paymentAmount");
const savePaymentBtn          = document.getElementById("savePayment");
const cancelPaymentBtn        = document.getElementById("cancelPayment");

// -----------------------------
// Firebase Auth & State
// -----------------------------
const auth = getAuth();

// Current user profile (filled from auth.js)
let currentProfile = null;

// Track loaded student list (for editing)
let loadedStudents = [];
let editingStudentId = null;

// -----------------------------
// 1) AUTHENTICATION & SIGNUP/LOGIN TOGGLE
// -----------------------------
let isLoginMode = true;

toggleAuth.addEventListener("click", () => {
  isLoginMode = !isLoginMode;
  if (isLoginMode) {
    formTitle.textContent = "Login to Attendance App";
    authButton.textContent = "Login";
    toggleAuth.textContent = "Don't have an account? Sign Up";
    signupExtra.classList.add("hidden");
  } else {
    formTitle.textContent = "Sign Up for Attendance App";
    authButton.textContent = "Sign Up";
    toggleAuth.textContent = "Already have an account? Login";
    signupExtra.classList.remove("hidden");
  }
});

authButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const pass  = passwordInput.value.trim();

  if (!email || !pass) {
    alert("Email اور Password دونوں درج کریں۔");
    return;
  }

  if (isLoginMode) {
    // ------ Login ------
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      // authStateChanged will fire
    } catch (err) {
      console.error("Login error:", err);
      alert("Login ناکام: " + err.message);
    }
  } else {
    // ------ Sign Up ------
    const displayName = displayNameInput.value.trim();
    const role        = roleSelect.value;
    const schoolSel   = schoolRegisterSelect.value;
    const cls         = classRegisterSelect.value;
    const sec         = sectionRegisterSelect.value;

    if (!displayName || !role) {
      alert("Full Name اور Role دونوں درج کریں۔");
      return;
    }
    // For principal/teacher, ensure school selected
    if ((role === "principal" || role === "teacher") && !schoolSel) {
      alert("Principal/Teacher کے لیے اسکول منتخب کریں۔");
      return;
    }
    if (role === "teacher" && (!cls || !sec)) {
      alert("Teacher کے لیے کلاس اور سیکشن دونوں منتخب کریں۔");
      return;
    }

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, pass);
      // Update display name
      await updateProfile(userCred.user, { displayName });

      // Save profile in Realtime Database under /users/$uid
      const uid = userCred.user.uid;
      const profileData = {
        displayName,
        role,
        school: role === "admin" ? "" : schoolSel,
        class:  role === "teacher" ? cls : "",
        section: role === "teacher" ? sec : ""
      };
      await dbSet(dbRef(database, `users/${uid}`), profileData);

      // Clear signup fields
      displayNameInput.value = "";
      roleSelect.value       = "-- Select Role --";
      schoolRegisterSelect.value = "-- Select School --";
      classRegisterSelect.value  = "-- Select Class --";
      sectionRegisterSelect.value= "-- Select Section --";

      // Switch back to login mode
      isLoginMode = true;
      formTitle.textContent = "Login to Attendance App";
      authButton.textContent = "Login";
      toggleAuth.textContent = "Don't have an account? Sign Up";
      signupExtra.classList.add("hidden");
    } catch (err) {
      console.error("Signup error:", err);
      alert("Signup ناکام: " + err.message);
    }
  }
});

// -----------------------------
// 2) AUTH STATE CHANGED
// -----------------------------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Hide auth, show main app
    authContainer.classList.add("hidden");
    mainApp.classList.remove("hidden");

    // Load user profile from DB
    const uid = user.uid;
    const profileSnap = await get(dbRef(database, `users/${uid}`));
    if (profileSnap.exists()) {
      currentProfile = profileSnap.val();
      currentProfile.uid = uid;
    } else {
      // No profile in DB (shouldn't happen)
      currentProfile = { role: "teacher", displayName: user.displayName, school: "", class: "", section: "", uid };
    }

    // Populate setup dropdown (setup.js will handle most)
    // Trigger custom event for setup.js
    document.dispatchEvent(new CustomEvent("userLoggedIn"));

    // Load Financial, Students, Attendance, Analytics, Register as needed
    loadFinancialSettings();
    loadStudents();
    // Other initial loads (attendance lists, analytics setup) go here
  } else {
    // No user
    mainApp.classList.add("hidden");
    authContainer.classList.remove("hidden");
  }
});

// -----------------------------
// 3) LOGOUT
// -----------------------------
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// -----------------------------
// 4) FINANCIAL SETTINGS
// -----------------------------
async function loadFinancialSettings() {
  const fineRef = dbRef(database, "appData/fineRates");
  const eligRef = dbRef(database, "appData/eligibilityPct");

  const fineSnap = await get(fineRef);
  const eligSnap = await get(eligRef);

  if (fineSnap.exists() && eligSnap.exists()) {
    const fines = fineSnap.val();
    const elig  = eligSnap.val();
    showFinancialCard(fines, elig);
  } else {
    showFinancialForm();
  }
}

function showFinancialForm() {
  // Show inputs
  fineAbsentInput.parentElement.classList.remove("hidden");
  fineLateInput.parentElement.classList.remove("hidden");
  fineLeaveInput.parentElement.classList.remove("hidden");
  fineHalfDayInput.parentElement.classList.remove("hidden");
  eligibilityPctInput.parentElement.classList.remove("hidden");
  saveSettingsBtn.classList.remove("hidden");

  // Remove any existing card/edit button
  if (financialCardDiv) { financialCardDiv.remove(); financialCardDiv = null; }
  if (editSettingsBtn)  { editSettingsBtn.remove();  editSettingsBtn = null; }
}

function showFinancialCard(fines, elig) {
  // Hide inputs
  fineAbsentInput.parentElement.classList.add("hidden");
  fineLateInput.parentElement.classList.add("hidden");
  fineLeaveInput.parentElement.classList.add("hidden");
  fineHalfDayInput.parentElement.classList.add("hidden");
  eligibilityPctInput.parentElement.classList.add("hidden");
  saveSettingsBtn.classList.add("hidden");

  // Remove old card/edit if present
  if (financialCardDiv) { financialCardDiv.remove(); financialCardDiv = null; }
  if (editSettingsBtn)  { editSettingsBtn.remove();  editSettingsBtn = null; }

  // Create card
  financialCardDiv = document.createElement("div");
  financialCardDiv.classList.add("card");
  financialCardDiv.innerHTML = `
    <p><strong>Fine/Absent (PKR):</strong> ${fines.absent}</p>
    <p><strong>Fine/Late (PKR):</strong> ${fines.late}</p>
    <p><strong>Fine/Leave (PKR):</strong> ${fines.leave}</p>
    <p><strong>Fine/Half-Day (PKR):</strong> ${fines.halfDay}</p>
    <p><strong>Eligibility % (≥):</strong> ${elig}</p>
  `;
  financialSection.appendChild(financialCardDiv);

  // Edit button
  editSettingsBtn = document.createElement("button");
  editSettingsBtn.classList.add("btn", "btn-primary", "no-print");
  editSettingsBtn.textContent = "Edit";
  editSettingsBtn.addEventListener("click", () => {
    fineAbsentInput.value     = fines.absent;
    fineLateInput.value       = fines.late;
    fineLeaveInput.value      = fines.leave;
    fineHalfDayInput.value    = fines.halfDay;
    eligibilityPctInput.value = elig;
    showFinancialForm();
  });
  financialSection.appendChild(editSettingsBtn);
}

saveSettingsBtn.addEventListener("click", async () => {
  const absentVal   = Number(fineAbsentInput.value)     || 0;
  const lateVal     = Number(fineLateInput.value)       || 0;
  const leaveVal    = Number(fineLeaveInput.value)      || 0;
  const halfDayVal  = Number(fineHalfDayInput.value)    || 0;
  const eligVal     = Number(eligibilityPctInput.value) || 0;

  const finesObj = {
    absent:   absentVal,
    late:     lateVal,
    leave:    leaveVal,
    halfDay:  halfDayVal
  };

  try {
    await dbSet(dbRef(database, "appData/fineRates"), finesObj);
    await dbSet(dbRef(database, "appData/eligibilityPct"), eligVal);
    showFinancialCard(finesObj, eligVal);
  } catch (err) {
    console.error("Error saving financial settings:", err);
    alert("کچھ غلط ہوا: " + err.message);
  }
});

// -----------------------------
// 5) STUDENT REGISTRATION
// -----------------------------
async function loadStudents() {
  const school = currentProfile.school;
  if (!school) return;

  const studentsRef = dbRef(database, `appData/studentsBySchool/${school}`);
  onValue(studentsRef, (snap) => {
    const data = snap.exists() ? snap.val() : {};
    // data is object keyed by push IDs
    loadedStudents = Object.entries(data).map(([id, obj]) => ({ id, ...obj }));
    renderStudentsTable();
  });
}

function renderStudentsTable() {
  studentsTableBody.innerHTML = "";
  loadedStudents.forEach((stu, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="student-cb" data-id="${stu.id}"></td>
      <td>${idx + 1}</td>
      <td>${stu.name}</td>
      <td>${stu.admissionNo}</td>
      <td>${stu.parentName}</td>
      <td>${stu.parentContact}</td>
      <td>${stu.parentOccupation}</td>
      <td>${stu.parentAddress}</td>
      <td>${stu.currentFine || 0}</td>
      <td>${stu.status || ""}</td>
      <td>
        <button class="btn btn-sm btn-primary edit-btn" data-id="${stu.id}">Edit</button>
        <button class="btn btn-sm btn-danger delete-btn" data-id="${stu.id}">Delete</button>
      </td>
    `;
    studentsTableBody.appendChild(tr);
  });

  // Checkbox handlers
  document.querySelectorAll(".student-cb").forEach((cb) => {
    cb.addEventListener("change", () => {
      const anyChecked = Array.from(document.querySelectorAll(".student-cb"))
                              .some((c) => c.checked);
      editSelectedBtn.disabled   = !anyChecked;
      deleteSelectedBtn.disabled = !anyChecked;
    });
  });

  // Individual edit/delete buttons
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      startEditingStudent(id);
    });
  });
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const school = currentProfile.school;
      if (confirm("Are you sure you want to delete this student?")) {
        await remove(child(dbRef(database), `appData/studentsBySchool/${school}/${id}`));
      }
    });
  });
}

addStudentBtn.addEventListener("click", async () => {
  const name     = studentNameInput.value.trim();
  const parent   = parentNameInput.value.trim();
  const contact  = parentContactInput.value.trim();
  const occupation = parentOccupationInput.value.trim();
  const address  = parentAddressInput.value.trim();
  const school   = currentProfile.school;

  if (!name || !parent || !contact) {
    alert("نام، والد کا نام اور رابطہ لازماً درج کریں۔");
    return;
  }

  // Generate admissionNo (e.g., timestamp or push key)
  const admissionNo = Date.now().toString().slice(-6);

  const newStudent = {
    name,
    admissionNo,
    parentName: parent,
    parentContact: contact,
    parentOccupation: occupation,
    parentAddress: address,
    currentFine: 0,
    status: "Registered"
  };

  try {
    await push(dbRef(database, `appData/studentsBySchool/${school}`), newStudent);
    // Clear inputs
    studentNameInput.value = "";
    parentNameInput.value  = "";
    parentContactInput.value = "";
    parentOccupationInput.value = "";
    parentAddressInput.value = "";
  } catch (err) {
    console.error("Error adding student:", err);
    alert("کچھ غلط ہوا: " + err.message);
  }
});

editSelectedBtn.addEventListener("click", () => {
  const checkedBox = document.querySelector(".student-cb:checked");
  if (checkedBox) {
    const id = checkedBox.getAttribute("data-id");
    startEditingStudent(id);
  }
});

function startEditingStudent(id) {
  const stu = loadedStudents.find((s) => s.id === id);
  if (!stu) return;
  // Populate fields
  studentNameInput.value = stu.name;
  parentNameInput.value  = stu.parentName;
  parentContactInput.value = stu.parentContact;
  parentOccupationInput.value = stu.parentOccupation;
  parentAddressInput.value = stu.parentAddress;
  editingStudentId = id;
  addStudentBtn.textContent = "Update";
  doneEditingBtn.classList.remove("hidden");
  editRegistrationBtn.classList.remove("hidden");
}

doneEditingBtn.addEventListener("click", async () => {
  if (!editingStudentId) return;
  const name     = studentNameInput.value.trim();
  const parent   = parentNameInput.value.trim();
  const contact  = parentContactInput.value.trim();
  const occupation = parentOccupationInput.value.trim();
  const address  = parentAddressInput.value.trim();
  const school   = currentProfile.school;

  if (!name || !parent || !contact) {
    alert("نام، والد کا نام اور رابطہ لازماً درج کریں۔");
    return;
  }

  const updates = {
    name,
    parentName: parent,
    parentContact: contact,
    parentOccupation: occupation,
    parentAddress: address
  };

  try {
    await dbSet(dbRef(database, `appData/studentsBySchool/${school}/${editingStudentId}`), {
      ...loadedStudents.find((s) => s.id === editingStudentId),
      ...updates
    });
    // Reset form
    studentNameInput.value = "";
    parentNameInput.value  = "";
    parentContactInput.value = "";
    parentOccupationInput.value = "";
    parentAddressInput.value = "";
    editingStudentId = null;
    addStudentBtn.textContent = "Add";
    doneEditingBtn.classList.add("hidden");
    editRegistrationBtn.classList.add("hidden");
  } catch (err) {
    console.error("Error updating student:", err);
    alert("کچھ غلط ہوا: " + err.message);
  }
});

deleteSelectedBtn.addEventListener("click", async () => {
  const checkedBoxes = Array.from(document.querySelectorAll(".student-cb:checked"));
  const school = currentProfile.school;
  if (checkedBoxes.length && confirm("Delete selected students?")) {
    for (const cb of checkedBoxes) {
      const id = cb.getAttribute("data-id");
      await remove(child(dbRef(database), `appData/studentsBySchool/${school}/${id}`));
    }
  }
});

editRegistrationBtn.addEventListener("click", () => {
  // Simply cancel edit mode
  editingStudentId = null;
  studentNameInput.value = "";
  parentNameInput.value  = "";
  parentContactInput.value = "";
  parentOccupationInput.value = "";
  parentAddressInput.value = "";
  addStudentBtn.textContent = "Add";
  doneEditingBtn.classList.add("hidden");
  editRegistrationBtn.classList.add("hidden");
});

// -----------------------------
// 6) MARK ATTENDANCE
// -----------------------------
async function loadAttendance() {
  const date = dateInput.value;
  const school = currentProfile.school;
  if (!date || !school) return;

  // Fetch list of students
  const stuSnap = await get(dbRef(database, `appData/studentsBySchool/${school}`));
  const stuData = stuSnap.exists() ? stuSnap.val() : {};
  const students = Object.entries(stuData).map(([id, obj]) => ({ id, ...obj }));

  // Fetch existing attendance for that date
  const attSnap = await get(dbRef(database, `appData/attendanceDataBySchool/${school}/${date}`));
  const attData = attSnap.exists() ? attSnap.val() : {};

  // Render attendance table
  attendanceBodyDiv.innerHTML = "";
  students.forEach((stu, idx) => {
    const status = attData[stu.id] || "Absent";
    const row = document.createElement("div");
    row.classList.add("row-inline");
    row.innerHTML = `
      <span>${stu.name} (${stu.admissionNo})</span>
      <select class="att-select" data-id="${stu.id}" style="margin-left:1em;">
        <option value="Present" ${status === "Present" ? "selected" : ""}>Present</option>
        <option value="Absent" ${status === "Absent" ? "selected" : ""}>Absent</option>
        <option value="Late" ${status === "Late" ? "selected" : ""}>Late</option>
        <option value="Leave" ${status === "Leave" ? "selected" : ""}>Leave</option>
        <option value="HalfDay" ${status === "HalfDay" ? "selected" : ""}>HalfDay</option>
      </select>
    `;
    attendanceBodyDiv.appendChild(row);
  });

  saveAttendanceBtn.classList.remove("hidden");
  resetAttendanceBtn.classList.remove("hidden");
  downloadAttendancePDFBtn.classList.remove("hidden");
  shareAttendanceSummaryBtn.classList.remove("hidden");
}

loadAttendanceBtn.addEventListener("click", loadAttendance);

saveAttendanceBtn.addEventListener("click", async () => {
  const date = dateInput.value;
  const school = currentProfile.school;
  if (!date || !school) return;

  const selects = document.querySelectorAll(".att-select");
  const updates = {};
  selects.forEach((sel) => {
    const id = sel.getAttribute("data-id");
    updates[id] = sel.value;
  });

  try {
    await dbSet(dbRef(database, `appData/attendanceDataBySchool/${school}/${date}`), updates);
    alert("Attendance saved!");
  } catch (err) {
    console.error("Error saving attendance:", err);
    alert("کچھ غلط ہوا: " + err.message);
  }
});

resetAttendanceBtn.addEventListener("click", () => {
  attendanceBodyDiv.innerHTML = "";
  saveAttendanceBtn.classList.add("hidden");
  resetAttendanceBtn.classList.add("hidden");
  downloadAttendancePDFBtn.classList.add("hidden");
  shareAttendanceSummaryBtn.classList.add("hidden");
});

// -----------------------------
// 7) ANALYTICS (مختصر مثال)
// -----------------------------
loadAnalyticsBtn.addEventListener("click", async () => {
  const target = analyticsTargetSelect.value;
  if (!target) {
    alert("اپنا ریپورٹ ٹارگٹ منتخب کریں۔");
    return;
  }
  // For brevity: fetch attendance records or student counts based on target...
  // پھر ٹیبل اور چارٹس generate کریں
  analyticsContainerDiv.classList.remove("hidden");
  graphsDiv.classList.remove("hidden");
});

// -----------------------------
// 8) ATTENDANCE REGISTER (مختصر مثال)
// -----------------------------
loadRegisterBtn.addEventListener("click", async () => {
  const month = registerMonthInput.value;
  const school = currentProfile.school;
  if (!month || !school) return;

  // Generate header days in that month
  const [year, mon] = month.split("-");
  const daysInMonth = new Date(year, mon, 0).getDate();

  registerHeaderRow.innerHTML = `<th>Adm#</th><th>Name</th>`;
  for (let d = 1; d <= daysInMonth; d++) {
    registerHeaderRow.innerHTML += `<th>${d}</th>`;
  }

  // Fetch students and attendance, then populate table...
  registerTableWrapper.classList.remove("hidden");
});

// -----------------------------
// 9) PAYMENT MODAL (مختصر مثال)
// -----------------------------
document.querySelectorAll(".pay-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const adm = btn.getAttribute("data-adm");
    payAdmSpan.textContent = adm;
    paymentModal.classList.remove("hidden");
  });
});

paymentModalClose.addEventListener("click", () => paymentModal.classList.add("hidden"));
cancelPaymentBtn.addEventListener("click", () => paymentModal.classList.add("hidden"));

savePaymentBtn.addEventListener("click", async () => {
  const amount = Number(paymentAmountInput.value) || 0;
  const adm = payAdmSpan.textContent;
  const school = currentProfile.school;
  if (amount <= 0) {
    alert("مندرجہ بالا فیس رقم درست کریں۔");
    return;
  }
  // Append payment under /appData/paymentsDataBySchool/$school/$adm
  try {
    const payRef = dbRef(database, `appData/paymentsDataBySchool/${school}/${adm}`);
    await push(payRef, { amount, timestamp: Date.now() });
    paymentModal.classList.add("hidden");
    paymentAmountInput.value = "";
    alert("Payment recorded!");
  } catch (err) {
    console.error("Error saving payment:", err);
    alert("کچھ غلط ہوا: " + err.message);
  }
});

// -----------------------------
// END OF app.js
// -----------------------------
