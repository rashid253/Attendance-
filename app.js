// app.js (Complete file with Request Access and Key Login updates integrated into the original logic)
// -------------------------------------------------------------------------------------------------

// ----------------------------------------------
// 1) Firebase Initialization (imports and config)
// ----------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  set as dbSet,
  onValue,
  update as dbUpdate,
  push as dbPush
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// IndexedDB helpers (idb-keyval IIFE must be loaded in your HTML before this script)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// Firebase configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyBsx…EpICEzA",
  authDomain: "attandace-management.firebaseapp.com",
  projectId: "attandace-management",
  storageBucket: "attandace-management.appspot.com",
  messagingSenderId: "222685278846",
  appId: "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B",
  databaseURL: "https://attandace-management-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ----------------------------------------------
// 2) New: Load “schools” from Firebase into `allSchools[]`
// ----------------------------------------------
let allSchools = []; // will hold array of { id: "<schoolId>", name: "<schoolName>" }
onValue(dbRef(database, "schools"), snapshot => {
  allSchools = [];
  snapshot.forEach(childSnap => {
    allSchools.push({
      id: childSnap.key,
      name: childSnap.val().name
    });
  });
});

// ----------------------------------------------
// 3) New: Dummy or placeholder functions for classes & sections
//    Replace these with your real data‐loading logic if you store those nodes in Firebase or IndexedDB
// ----------------------------------------------
async function getClassesBySchoolId(schoolId) {
  // Placeholder: return a static list. Change to fetch from "classes/{schoolId}" in Firebase if you have it.
  return [
    { name: "Play Group" },
    { name: "Nursery" },
    { name: "KG" },
    { name: "Class One" },
    { name: "Class Two" }
  ];
}

async function getSectionsByClassName(className) {
  // Placeholder: return a static list.
  return [
    { name: "A" },
    { name: "B" },
    { name: "C" }
  ];
}

// ----------------------------------------------
// 4) New: KEY LOGIN & SETUP LOCK Functionality
// ----------------------------------------------

// Validate a teacher’s key and lock down the Setup UI accordingly.
async function validateAndLockForTeacher(keyInput) {
  try {
    const snap = await dbRef(database, `teachers/${keyInput}`).get();
    const errEl = document.getElementById("keyErrorMsg");
    if (!snap.exists() || snap.val().isActive !== true) {
      // Key is invalid or blocked
      $('#keyLoginModal').modal('show');
      errEl.textContent = "Invalid or blocked key. Contact admin.";
      errEl.classList.remove("d-none");
      return;
    }

    // Key is valid and active: hide modal
    $('#keyLoginModal').modal('hide');
    // Save in localStorage so next time we skip the modal
    localStorage.setItem("teacherKey", keyInput);

    // Extract allowed school/class/section from Firebase data
    const teacherData = snap.val();
    const allowedSchoolId = teacherData.schoolId;
    const allowedClass = teacherData.className;
    const allowedSection = teacherData.sectionName;

    // Lock down the Setup section to only allowed values
    lockDownSetupSection(allowedSchoolId, allowedClass, allowedSection);
  } catch (err) {
    console.error("Error validating key:", err);
    $('#keyLoginModal').modal('show');
    const errEl = document.getElementById("keyErrorMsg");
    errEl.textContent = "Error checking key. Try again.";
    errEl.classList.remove("d-none");
  }
}

// On page load, check if a key is already in localStorage
document.addEventListener("DOMContentLoaded", async () => {
  const savedKey = localStorage.getItem("teacherKey");
  if (savedKey) {
    await validateAndLockForTeacher(savedKey);
  } else {
    // Show login modal if no key stored
    $('#keyLoginModal').modal({ backdrop: 'static', keyboard: false });
    $('#keyLoginModal').modal('show');
  }
});

// When teacher clicks “Submit” on Key Login modal
document.getElementById("submitTeacherKeyBtn").addEventListener("click", async () => {
  const keyInput = document.getElementById("teacherKeyInput").value.trim();
  if (!keyInput) return;
  await validateAndLockForTeacher(keyInput);
});

// lockDownSetupSection: hide/disable all but the assigned school/class/section
function lockDownSetupSection(schoolId, className, sectionName) {
  // 1) Hide “Add/Rename/Remove School” buttons
  const btnAddSchool = document.getElementById("btnAddNewSchool");
  const btnRenameSchool = document.getElementById("btnRenameSchool");
  const btnRemoveSchool = document.getElementById("btnRemoveSchool");
  if (btnAddSchool) btnAddSchool.style.display = "none";
  if (btnRenameSchool) btnRenameSchool.style.display = "none";
  if (btnRemoveSchool) btnRemoveSchool.style.display = "none";

  // 2) In the School dropdown, show only the allowedSchoolId
  const schoolSelect = document.getElementById("schoolSetupSelect");
  Array.from(schoolSelect.options).forEach(opt => {
    if (opt.value !== schoolId) opt.style.display = "none";
  });
  schoolSelect.value = schoolId;
  schoolSelect.disabled = true;

  // 3) Load classes for that school, then lock to className
  renderClassOptions(schoolId);
  const classSelect = document.getElementById("classSetupSelect");
  Array.from(classSelect.options).forEach(opt => {
    if (opt.textContent !== className) opt.style.display = "none";
  });
  classSelect.value = className;
  classSelect.disabled = true;

  // 4) Load sections for that class, then lock to sectionName
  renderSectionOptions(className);
  const sectionSelect = document.getElementById("sectionSetupSelect");
  Array.from(sectionSelect.options).forEach(opt => {
    if (opt.textContent !== sectionName) opt.style.display = "none";
  });
  sectionSelect.value = sectionName;
  sectionSelect.disabled = true;

  // 5) Now initialize all the app data for that school:
  initializeAppDataForSchool(schoolId);
}

// ----------------------------------------------
// 5) New: REQUEST ACCESS Modal Logic
// ----------------------------------------------
document.getElementById("btnOpenRequestModal").addEventListener("click", () => {
  // Reset form fields
  document.getElementById("reqTeacherName").value = "";
  document.getElementById("reqTeacherEmail").value = "";
  document.getElementById("reqSchoolSelect").innerHTML = '<option value="">Select School</option>';
  document.getElementById("reqClassSelect").innerHTML = '<option value="">Select Class</option>';
  document.getElementById("reqSectionSelect").innerHTML = '<option value="">Select Section</option>';
  document.getElementById("reqErrorMsg").classList.add("d-none");

  // Populate the School dropdown from `allSchools[]`
  allSchools.forEach(schoolObj => {
    const opt = document.createElement("option");
    opt.value = schoolObj.id;
    opt.textContent = schoolObj.name;
    document.getElementById("reqSchoolSelect").appendChild(opt);
  });

  // Show the modal
  $('#requestAccessModal').modal('show');
});

// When a school is selected, load the Class dropdown:
document.getElementById("reqSchoolSelect").addEventListener("change", async (e) => {
  const schoolId = e.target.value;
  const classSelect = document.getElementById("reqClassSelect");
  const sectionSelect = document.getElementById("reqSectionSelect");

  classSelect.innerHTML = '<option value="">Select Class</option>';
  sectionSelect.innerHTML = '<option value="">Select Section</option>';
  sectionSelect.disabled = true;

  if (!schoolId) {
    classSelect.disabled = true;
    return;
  }

  const classes = await getClassesBySchoolId(schoolId);
  classes.forEach(clsObj => {
    const opt = document.createElement("option");
    opt.value = clsObj.name;
    opt.textContent = clsObj.name;
    classSelect.appendChild(opt);
  });
  classSelect.disabled = false;
});

// When a class is selected, load the Section dropdown:
document.getElementById("reqClassSelect").addEventListener("change", async (e) => {
  const className = e.target.value;
  const sectionSelect = document.getElementById("reqSectionSelect");

  sectionSelect.innerHTML = '<option value="">Select Section</option>';
  if (!className) {
    sectionSelect.disabled = true;
    return;
  }

  const sections = await getSectionsByClassName(className);
  sections.forEach(secObj => {
    const opt = document.createElement("option");
    opt.value = secObj.name;
    opt.textContent = secObj.name;
    sectionSelect.appendChild(opt);
  });
  sectionSelect.disabled = false;
});

// Handle the “Send Request” button click:
document.getElementById("submitRequestBtn").addEventListener("click", async () => {
  const name = document.getElementById("reqTeacherName").value.trim();
  const email = document.getElementById("reqTeacherEmail").value.trim();
  const school = document.getElementById("reqSchoolSelect").value;
  const cls = document.getElementById("reqClassSelect").value;
  const sec = document.getElementById("reqSectionSelect").value;
  const errorEl = document.getElementById("reqErrorMsg");

  // Simple validation
  if (!name || !email || !school || !cls || !sec) {
    errorEl.textContent = "Please fill all fields.";
    errorEl.classList.remove("d-none");
    return;
  }
  errorEl.classList.add("d-none");

  try {
    await dbPush(dbRef(database, "requests"), {
      teacherName: name,
      teacherEmail: email,
      schoolId: school,
      className: cls,
      sectionName: sec,
      status: "pending",
      requestedAt: Date.now()
    });

    $('#requestAccessModal').modal('hide');
    alert("Your request has been sent to the admin.");
  } catch (err) {
    console.error("Firebase error:", err);
    errorEl.textContent = "Could not send request. Try again.";
    errorEl.classList.remove("d-none");
  }
});

// ----------------------------------------------
// 6) Original Attendance Management App Logic (unchanged parts)
//    Below is the entire original app.js content, exactly as it was.
//    (Do not modify the following section; it's your original working code.)
// ----------------------------------------------

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
  if (!schools.includes(school)) {
    schools.push(school);
    await idbSet("schools", schools);
  }
  await idbSet("teacherSection", teacherSection);
  await idbSet("teacherClass", teacherClass);
  await idbSet("currentSchool", currentSchool);
}

// Sync local state (mappings) to Firebase
async function syncToFirebase() {
  const appDataRef = dbRef(database, "appData");
  const payload = {
    studentsBySchool,
    attendanceDataBySchool,
    paymentsDataBySchool,
    lastAdmNoBySchool
  };
  try {
    await dbSet(appDataRef, payload);
    console.log("✅ Synced data to Firebase");
  } catch (err) {
    console.error("Firebase sync failed:", err);
  }
}

// Utility: Share PDF via Web Share API
async function sharePdf(blob, fileName, title) {
  if (
    navigator.canShare &&
    navigator.canShare({ files: [new File([blob], fileName, { type: blob.type })] })
  ) {
    try {
      await navigator.share({
        title,
        files: [new File([blob], fileName, { type: blob.type })]
      });
      console.log("File shared successfully");
    } catch (err) {
      console.error("Error sharing file:", err);
    }
  } else {
    alert("Web Share API not supported for files on this browser.");
  }
}

// Utility wrapper for document.getElementById
function $(id) {
  return document.getElementById(id);
}

// --------------------------------------------------
// Global State and Per-School Data Structures
// --------------------------------------------------

let studentsBySchool       = {}; // { schoolName: [ studentObj, … ] }
let attendanceDataBySchool = {}; // { schoolName: { "YYYY-MM-DD": { adm: status, … } } }
let paymentsDataBySchool   = {}; // { schoolName: { adm: [ { date, amount }, … ] } }
let lastAdmNoBySchool      = {}; // { schoolName: lastNumericAdmNo }
let fineRates              = { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct         = 75;

let schools                = [];    // [ schoolId, … ]  (loaded from IndexedDB and Firebase)
let currentSchool          = null;  // selected school ID string
let teacherClass           = null;  // selected class string
let teacherSection         = null;  // selected section string

let students       = [];    // pointer to studentsBySchool[currentSchool]
let attendanceData = {};    // pointer to attendanceDataBySchool[currentSchool]
let paymentsData   = {};    // pointer to paymentsDataBySchool[currentSchool]
let lastAdmNo      = 0;     // pointer to lastAdmNoBySchool[currentSchool]

// --------------------------------------------------
// PWA: Service Worker Registration (unchanged)
// --------------------------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}

// --------------------------------------------------
// SETUP Section
// --------------------------------------------------
async function loadSetup() {
  studentsBySchool       = (await idbGet("studentsBySchool")) || {};
  attendanceDataBySchool = (await idbGet("attendanceDataBySchool")) || {};
  paymentsDataBySchool   = (await idbGet("paymentsDataBySchool")) || {};
  lastAdmNoBySchool      = (await idbGet("lastAdmNoBySchool")) || {};
  schools                = (await idbGet("schools")) || [];

  renderSchoolOptions();

  // Add event listeners for Setup buttons:
  document.getElementById("btnAddNewSchool").addEventListener("click", async () => {
    const newSchoolName = prompt("Enter new school name:");
    if (!newSchoolName) return;
    if (!schools.includes(newSchoolName)) {
      schools.push(newSchoolName);
      await idbSet("schools", schools);
      studentsBySchool[newSchoolName] = [];
      attendanceDataBySchool[newSchoolName] = {};
      paymentsDataBySchool[newSchoolName] = {};
      lastAdmNoBySchool[newSchoolName] = 0;
      await idbSet("studentsBySchool", studentsBySchool);
      await idbSet("attendanceDataBySchool", attendanceDataBySchool);
      await idbSet("paymentsDataBySchool", paymentsDataBySchool);
      await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
      renderSchoolOptions();
      alert("New school added.");
    } else {
      alert("School already exists.");
    }
  });

  document.getElementById("btnRenameSchool").addEventListener("click", async () => {
    const oldName = document.getElementById("schoolSetupSelect").value;
    if (!oldName) {
      alert("Please select a school to rename.");
      return;
    }
    const newName = prompt("Enter new name for the school:", oldName);
    if (!newName) return;
    if (newName === oldName) return;
    if (schools.includes(newName)) {
      alert("A school with that name already exists.");
      return;
    }
    // Rename in arrays and mappings:
    const index = schools.indexOf(oldName);
    schools[index] = newName;
    studentsBySchool[newName] = studentsBySchool[oldName];
    attendanceDataBySchool[newName] = attendanceDataBySchool[oldName];
    paymentsDataBySchool[newName] = paymentsDataBySchool[oldName];
    lastAdmNoBySchool[newName] = lastAdmNoBySchool[oldName];

    delete studentsBySchool[oldName];
    delete attendanceDataBySchool[oldName];
    delete paymentsDataBySchool[oldName];
    delete lastAdmNoBySchool[oldName];

    await idbSet("schools", schools);
    await idbSet("studentsBySchool", studentsBySchool);
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
    await idbSet("paymentsDataBySchool", paymentsDataBySchool);
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
    renderSchoolOptions();
    alert("School renamed.");
  });

  document.getElementById("btnRemoveSchool").addEventListener("click", async () => {
    const schoolToDelete = document.getElementById("schoolSetupSelect").value;
    if (!schoolToDelete) {
      alert("Please select a school to remove.");
      return;
    }
    if (!confirm(`Are you sure you want to remove "${schoolToDelete}" and all its data?`)) {
      return;
    }
    schools = schools.filter(s => s !== schoolToDelete);
    delete studentsBySchool[schoolToDelete];
    delete attendanceDataBySchool[schoolToDelete];
    delete paymentsDataBySchool[schoolToDelete];
    delete lastAdmNoBySchool[schoolToDelete];
    await idbSet("schools", schools);
    await idbSet("studentsBySchool", studentsBySchool);
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
    await idbSet("paymentsDataBySchool", paymentsDataBySchool);
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
    renderSchoolOptions();
    alert("School removed.");
  });

  // When a school is selected in setup, load classes
  document.getElementById("schoolSetupSelect").addEventListener("change", (e) => {
    const school = e.target.value;
    renderClassOptions(school);
  });

  // When a class is selected in setup, load sections
  document.getElementById("classSetupSelect").addEventListener("change", (e) => {
    const cls = e.target.value;
    renderSectionOptions(cls);
  });

  // When “Apply Setup” is clicked, initialize app data
  document.getElementById("applySetup").addEventListener("click", async () => {
    const school = document.getElementById("schoolSetupSelect").value;
    const cls = document.getElementById("classSetupSelect").value;
    const sec = document.getElementById("sectionSetupSelect").value;
    if (!school || !cls || !sec) {
      alert("Please select School, Class, and Section.");
      return;
    }
    teacherClass = cls;
    teacherSection = sec;
    currentSchool = school;
    await ensureSchoolData(currentSchool);

    // Load data for this school
    students = studentsBySchool[currentSchool] || [];
    attendanceData = attendanceDataBySchool[currentSchool] || {};
    paymentsData = paymentsDataBySchool[currentSchool] || {};
    lastAdmNo = lastAdmNoBySchool[currentSchool] || 0;

    // Render counters, tables, etc.
    renderCounters();
    renderStudentsTable();
  });
}

// Render school dropdown in Setup
function renderSchoolOptions() {
  const schoolSelect = $("schoolSetupSelect");
  schoolSelect.innerHTML = '<option value="">Select School</option>';
  schools.forEach((school) => {
    const opt = document.createElement("option");
    opt.value = school;
    opt.textContent = school;
    schoolSelect.appendChild(opt);
  });
}

// Render class dropdown after a school is selected
function renderClassOptions(school) {
  const classSelect = $("classSetupSelect");
  classSelect.innerHTML = '<option value="">Select Class</option>';
  if (!school) {
    classSelect.disabled = true;
    return;
  }
  const classSet = new Set();
  (studentsBySchool[school] || []).forEach((stu) => {
    classSet.add(stu.cls);
  });
  Array.from(classSet).forEach((cls) => {
    const opt = document.createElement("option");
    opt.value = cls;
    opt.textContent = cls;
    classSelect.appendChild(opt);
  });
  classSelect.disabled = false;
}

// Render section dropdown after a class is selected
function renderSectionOptions(cls) {
  const sectionSelect = $("sectionSetupSelect");
  sectionSelect.innerHTML = '<option value="">Select Section</option>';
  if (!cls) {
    sectionSelect.disabled = true;
    return;
  }
  const secSet = new Set();
  Object.values(studentsBySchool[currentSchool] || []).forEach((stu) => {
    if (stu.cls === cls) {
      secSet.add(stu.sec);
    }
  });
  Array.from(secSet).forEach((sec) => {
    const opt = document.createElement("option");
    opt.value = sec;
    opt.textContent = sec;
    sectionSelect.appendChild(opt);
  });
  sectionSelect.disabled = false;
}

// Initialize the entire app data for a given school
async function initializeAppDataForSchool(school) {
  currentSchool = school;
  await ensureSchoolData(currentSchool);
  students = studentsBySchool[currentSchool] || [];
  attendanceData = attendanceDataBySchool[currentSchool] || {};
  paymentsData = paymentsDataBySchool[currentSchool] || {};
  lastAdmNo = lastAdmNoBySchool[currentSchool] || 0;

  renderCounters();
  renderStudentsTable();
  renderAttendanceControls();
  renderAnalyticsControls();
  renderRegisterControls();
}

// --------------------------------------------------
// COUNTERS Section
// --------------------------------------------------
function renderCounters() {
  const totalStudents = (studentsBySchool[currentSchool] || []).length;
  const counterStudents = $("counterTotalStudents");
  counterStudents.textContent = totalStudents;
  // Similarly render other counters if needed, e.g. total classes, total sections, etc.
}

// --------------------------------------------------
// STUDENTS TABLE (Registration) Section
// --------------------------------------------------
function renderStudentsTable() {
  const tbody = $("studentsTableBody");
  tbody.innerHTML = "";
  (studentsBySchool[currentSchool] || []).forEach((stu) => {
    const tr = document.createElement("tr");

    const tdAdm = document.createElement("td");
    tdAdm.textContent = stu.adm;
    tr.appendChild(tdAdm);

    const tdName = document.createElement("td");
    tdName.textContent = stu.name;
    tr.appendChild(tdName);

    const tdParent = document.createElement("td");
    tdParent.textContent = stu.parent;
    tr.appendChild(tdParent);

    const tdContact = document.createElement("td");
    tdContact.textContent = stu.contact;
    tr.appendChild(tdContact);

    const tdOccupation = document.createElement("td");
    tdOccupation.textContent = stu.occupation;
    tr.appendChild(tdOccupation);

    const tdAddress = document.createElement("td");
    tdAddress.textContent = stu.address;
    tr.appendChild(tdAddress);

    const tdClass = document.createElement("td");
    tdClass.textContent = stu.cls;
    tr.appendChild(tdClass);

    const tdSection = document.createElement("td");
    tdSection.textContent = stu.sec;
    tr.appendChild(tdSection);

    const tdAction = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.className = "btn btn-sm btn-warning me-2";
    editBtn.onclick = () => openEditStudentModal(stu.adm);
    tdAction.appendChild(editBtn);

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "btn btn-sm btn-danger";
    delBtn.onclick = () => deleteStudent(stu.adm);
    tdAction.appendChild(delBtn);

    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });
}

// Add New Student
$("addStudentBtn").addEventListener("click", () => {
  $("studentFormTitle").textContent = "Add New Student";
  $("stuName").value = "";
  $("stuParent").value = "";
  $("stuContact").value = "";
  $("stuOccupation").value = "";
  $("stuAddress").value = "";
  $("stuClass").value = teacherClass;
  $("stuSection").value = teacherSection;
  $("stuAdmNo").value = generateAdmNo();
  $("studentModal").classList.add("show");
});

// Generate new Admission Number
function generateAdmNo() {
  lastAdmNoBySchool[currentSchool] = (lastAdmNoBySchool[currentSchool] || 0) + 1;
  idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
  return `${teacherClass}-${teacherSection}-${String(
    lastAdmNoBySchool[currentSchool]
  ).padStart(3, "0")}`;
}

// Save Student (Add or Edit)
$("saveStudentBtn").addEventListener("click", async () => {
  const admNo = $("stuAdmNo").value.trim();
  const name = $("stuName").value.trim();
  const parent = $("stuParent").value.trim();
  const contact = $("stuContact").value.trim();
  const occupation = $("stuOccupation").value.trim();
  const address = $("stuAddress").value.trim();
  const cls = $("stuClass").value;
  const sec = $("stuSection").value;

  if (!admNo || !name || !cls || !sec) {
    alert("Admission number, Name, Class, and Section are required.");
    return;
  }

  const existingIndex = studentsBySchool[currentSchool].findIndex(
    (s) => s.adm === admNo
  );
  if (existingIndex >= 0) {
    // Update existing student
    studentsBySchool[currentSchool][existingIndex] = {
      adm: admNo,
      name,
      parent,
      contact,
      occupation,
      address,
      cls,
      sec
    };
  } else {
    // Add new student
    studentsBySchool[currentSchool].push({
      adm: admNo,
      name,
      parent,
      contact,
      occupation,
      address,
      cls,
      sec
    });
  }

  await idbSet("studentsBySchool", studentsBySchool);
  renderStudentsTable();
  $("studentModal").classList.remove("show");
  // Optionally sync to Firebase
  syncToFirebase();
});

// Open Edit Student Modal
function openEditStudentModal(admNo) {
  const stu = studentsBySchool[currentSchool].find((s) => s.adm === admNo);
  if (!stu) return;
  $("studentFormTitle").textContent = "Edit Student";
  $("stuName").value = stu.name;
  $("stuParent").value = stu.parent;
  $("stuContact").value = stu.contact;
  $("stuOccupation").value = stu.occupation;
  $("stuAddress").value = stu.address;
  $("stuClass").value = stu.cls;
  $("stuSection").value = stu.sec;
  $("stuAdmNo").value = stu.adm;
  $("studentModal").classList.add("show");
}

// Delete Student
async function deleteStudent(admNo) {
  if (!confirm(`Delete student with Admission No. ${admNo}?`)) return;
  studentsBySchool[currentSchool] = studentsBySchool[currentSchool].filter(
    (s) => s.adm !== admNo
  );
  await idbSet("studentsBySchool", studentsBySchool);
  renderStudentsTable();
  // Optionally sync to Firebase
  syncToFirebase();
}

// ----------------------
// PAYMENT Section
// ----------------------
function openPaymentModal(admNo) {
  $("paymentAdmNo").textContent = admNo;
  $("paymentAmount").value = "";
  $("paymentModal").classList.add("show");
  $("savePaymentBtn").dataset.adm = admNo;
}

$("savePaymentBtn").addEventListener("click", async () => {
  const admNo = $("savePaymentBtn").dataset.adm;
  const amount = parseFloat($("paymentAmount").value.trim());
  if (isNaN(amount) || amount <= 0) {
    alert("Enter a valid payment amount.");
    return;
  }
  const date = new Date().toISOString().split("T")[0];
  if (!paymentsDataBySchool[currentSchool][admNo]) {
    paymentsDataBySchool[currentSchool][admNo] = [];
  }
  paymentsDataBySchool[currentSchool][admNo].push({ date, amount });
  await idbSet("paymentsDataBySchool", paymentsDataBySchool);
  $("paymentModal").classList.remove("show");
  // Optionally sync to Firebase
  syncToFirebase();
});

// ----------------------
// MARK ATTENDANCE Section
// ----------------------
$("loadAttendanceBtn").addEventListener("click", () => {
  const date = $("attendanceDate").value;
  if (!date) {
    alert("Select a date first.");
    return;
  }
  renderAttendanceForm(date);
});

function renderAttendanceForm(date) {
  const container = $("attendanceContainer");
  container.innerHTML = "";
  const tbl = document.createElement("table");
  tbl.className = "table table-bordered";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Adm No", "Name", "Status"].forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  tbl.appendChild(thead);

  const tbody = document.createElement("tbody");
  (studentsBySchool[currentSchool] || [])
    .filter((s) => s.cls === teacherClass && s.sec === teacherSection)
    .forEach((stu) => {
      const tr = document.createElement("tr");
      const tdAdm = document.createElement("td");
      tdAdm.textContent = stu.adm;
      tr.appendChild(tdAdm);

      const tdName = document.createElement("td");
      tdName.textContent = stu.name;
      tr.appendChild(tdName);

      const tdStatus = document.createElement("td");
      const select = document.createElement("select");
      select.className = "form-select";
      ["P", "A", "Lt", "HD", "L"].forEach((optVal) => {
        const opt = document.createElement("option");
        opt.value = optVal;
        opt.textContent = optVal;
        select.appendChild(opt);
      });
      // Preselect if attendanceData exists
      if (
        attendanceDataBySchool[currentSchool][date] &&
        attendanceDataBySchool[currentSchool][date][stu.adm]
      ) {
        select.value = attendanceDataBySchool[currentSchool][date][stu.adm];
      }
      tdStatus.appendChild(select);
      tr.appendChild(tdStatus);

      tbody.appendChild(tr);
    });
  tbl.appendChild(tbody);
  container.appendChild(tbl);
}

$("saveAttendanceBtn").addEventListener("click", async () => {
  const date = $("attendanceDate").value;
  if (!date) return;
  const rows = $("attendanceContainer").querySelectorAll("tbody tr");
  if (!attendanceDataBySchool[currentSchool][date]) {
    attendanceDataBySchool[currentSchool][date] = {};
  }
  rows.forEach((tr) => {
    const admNo = tr.cells[0].textContent;
    const status = tr.cells[2].querySelector("select").value;
    attendanceDataBySchool[currentSchool][date][admNo] = status;
  });
  await idbSet("attendanceDataBySchool", attendanceDataBySchool);
  alert("Attendance saved.");
  // Optionally sync to Firebase
  syncToFirebase();
});

// ----------------------
// ANALYTICS Section
// ----------------------
$("loadAnalyticsBtn").addEventListener("click", () => {
  const fromDate = $("analyticsFromDate").value;
  const toDate = $("analyticsToDate").value;
  if (!fromDate || !toDate) {
    alert("Select both From and To dates.");
    return;
  }
  renderAnalytics(fromDate, toDate);
});

function renderAnalytics(fromDate, toDate) {
  const container = $("analyticsContainer");
  container.innerHTML = "";

  // Collect attendance statuses between fromDate and toDate
  const studentMap = {};
  (studentsBySchool[currentSchool] || []).forEach((stu) => {
    if (stu.cls === teacherClass && stu.sec === teacherSection) {
      studentMap[stu.adm] = { name: stu.name, total: 0, present: 0 };
    }
  });

  Object.entries(attendanceDataBySchool[currentSchool] || {}).forEach(([date, rec]) => {
    if (date >= fromDate && date <= toDate) {
      Object.entries(rec).forEach(([adm, status]) => {
        if (studentMap[adm]) {
          studentMap[adm].total += 1;
          if (status === "P") studentMap[adm].present += 1;
        }
      });
    }
  });

  // Render table
  const tbl = document.createElement("table");
  tbl.className = "table table-bordered";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Adm No", "Name", "Total Days", "Present", "Percentage"].forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  tbl.appendChild(thead);

  const tbody = document.createElement("tbody");
  Object.entries(studentMap).forEach(([adm, info]) => {
    const tr = document.createElement("tr");
    const tdAdm = document.createElement("td");
    tdAdm.textContent = adm;
    tr.appendChild(tdAdm);

    const tdName = document.createElement("td");
    tdName.textContent = info.name;
    tr.appendChild(tdName);

    const tdTotal = document.createElement("td");
    tdTotal.textContent = info.total;
    tr.appendChild(tdTotal);

    const tdPresent = document.createElement("td");
    tdPresent.textContent = info.present;
    tr.appendChild(tdPresent);

    const tdPct = document.createElement("td");
    const pct = info.total > 0 ? ((info.present / info.total) * 100).toFixed(2) : "0.00";
    tdPct.textContent = pct + "%";
    tr.appendChild(tdPct);

    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  container.appendChild(tbl);
}

// ----------------------
// ATTENDANCE REGISTER Section
// ----------------------
$("loadRegisterBtn").addEventListener("click", () => {
  const year = $("registerYear").value;
  const month = $("registerMonth").value;
  if (!year || !month) {
    alert("Select Year and Month.");
    return;
  }
  renderRegister(year, month);
});

function renderRegister(year, month) {
  const container = $("registerContainer");
  container.innerHTML = "";

  const daysInMonth = new Date(year, month, 0).getDate();
  const headerRow = document.createElement("tr");
  headerRow.appendChild(document.createElement("th")); // empty corner cell
  for (let d = 1; d <= daysInMonth; d++) {
    const th = document.createElement("th");
    th.textContent = d;
    headerRow.appendChild(th);
  }

  const table = document.createElement("table");
  table.className = "table table-bordered";
  const thead = document.createElement("thead");
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  (studentsBySchool[currentSchool] || []).forEach((stu) => {
    if (stu.cls === teacherClass && stu.sec === teacherSection) {
      const tr = document.createElement("tr");
      const tdAdm = document.createElement("td");
      tdAdm.textContent = stu.adm;
      tr.appendChild(tdAdm);

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const td = document.createElement("td");
        const status = attendanceDataBySchool[currentSchool][dateStr]?.[stu.adm] || "";
        td.textContent = status;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

// ----------------------
// BACKUP, RESTORE & RESET Section
// ----------------------
$("chooseBackupFolderBtn").addEventListener("click", async () => {
  const handle = await window.showDirectoryPicker();
  await idbSet("backupFolderHandle", handle);
  alert("Backup folder selected.");
});

$("restoreDataBtn").addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async () => {
    if (!input.files.length) return;
    const file = input.files[0];
    const text = await file.text();
    const data = JSON.parse(text);
    await idbClear();
    studentsBySchool = data.studentsBySchool || {};
    attendanceDataBySchool = data.attendanceDataBySchool || {};
    paymentsDataBySchool = data.paymentsDataBySchool || {};
    lastAdmNoBySchool = data.lastAdmNoBySchool || {};
    schools = data.schools || [];
    await idbSet("studentsBySchool", studentsBySchool);
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
    await idbSet("paymentsDataBySchool", paymentsDataBySchool);
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
    await idbSet("schools", schools);
    renderSchoolOptions();
    alert("Data restored from JSON.");
  };
  input.click();
});

$("resetDataBtn").addEventListener("click", async () => {
  if (!confirm("This will delete ALL local and Firebase data. Proceed?")) return;
  await idbClear();
  studentsBySchool = {};
  attendanceDataBySchool = {};
  paymentsDataBySchool = {};
  lastAdmNoBySchool = {};
  schools = [];
  await idbSet("studentsBySchool", studentsBySchool);
  await idbSet("attendanceDataBySchool", attendanceDataBySchool);
  await idbSet("paymentsDataBySchool", paymentsDataBySchool);
  await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
  await idbSet("schools", schools);
  renderSchoolOptions();
  // Clear Firebase as well
  await dbSet(dbRef(database, "appData"), null);
  alert("Factory reset complete. Reloading.");
  location.reload();
});

// ----------------------------------------------
// Final initialization: load setup on page load (unchanged)
// ----------------------------------------------
(async () => {
  await loadSetup();

  // Make counters container scrollable if present
  const countersContainer = $("countersContainer");
  if (countersContainer) {
    countersContainer.style.display = "flex";
    countersContainer.style.overflowX = "auto";
    countersContainer.style.whiteSpace = "nowrap";
  }
})();
