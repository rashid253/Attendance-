// app.js (with per-school data segregation + login/auth gating)
// -------------------------------------------------------------------------------------------------

// 1) IMPORTS & INITIAL SETUP
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  set as dbSet,
  get as dbGet,          // ← Added this import for “get”
  onValue,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// IndexedDB helpers (idb-keyval IIFE must be loaded in your HTML before this script)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// Firebase configuration (replace with your actual config)
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
const database = getDatabase(app);
const auth = getAuth(app);
const appDataRef = dbRef(database, "appData");

// $() shorthand
const $ = (id) => document.getElementById(id);

// -------------------------------------------------------------------------------------------------
// 2) GLOBAL STATE FOR ALL SCHOOLS & THE ACTIVE SCHOOL
// -------------------------------------------------------------------------------------------------
let studentsBySchool       = {};  // { schoolName: [ studentObj, ... ] }
let attendanceDataBySchool = {};  // { schoolName: { dateStr: { adm#: statusCode, ... }, ... } }
let paymentsDataBySchool   = {};  // { schoolName: { adm#: [ { date, amount }, ... ], ... } }
let lastAdmNoBySchool      = {};  // { schoolName: lastAssignedNumber }

let fineRates              = { A: 50, Lt: 20, L: 10, HD: 30 };
let eligibilityPct         = 75;
let schools                = [];    // [ "School A", "School B", ... ]
let currentSchool          = null;  // e.g. "School A"
let teacherClass           = null;  // e.g. "Class One"
let teacherSection         = null;  // e.g. "A"

// These variables hold the “active school” data once currentSchool is set
let students       = []; // references studentsBySchool[currentSchool]
let attendanceData = {}; // references attendanceDataBySchool[currentSchool]
let paymentsData   = {}; // references paymentsDataBySchool[currentSchool]
let lastAdmNo      = 0;  // references lastAdmNoBySchool[currentSchool]

// -------------------------------------------------------------------------------------------------
// 3) UTILITY FUNCTIONS (PER-SCHOOL DATA, SYNC, PDF SHARE, ETC.)
// -------------------------------------------------------------------------------------------------

// Ensure every per-school data structure exists (when selecting a new school)
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

// Load all per-school data + settings from IndexedDB → global variables
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

// Push all per‐school data + settings up to Firebase under /appData
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
    teacherSection
  };
  try {
    await dbSet(appDataRef, payload);
    console.log("✅ Synced data to Firebase");
  } catch (err) {
    console.error("Firebase sync failed:", err);
  }
}

// Utility: share PDF blobs via the Web Share API (mobile, etc.)
async function sharePdf(blob, fileName, title) {
  if (
    navigator.canShare &&
    navigator.canShare({ files: [new File([blob], fileName, { type: blob.type })] })
  ) {
    try {
      await navigator.share({
        files: [new File([blob], fileName, { type: blob.type })],
        title
      });
    } catch (err) {
      console.error("Share failed:", err);
    }
  }
}

// -------------------------------------------------------------------------------------------------
// 4) resetViews(): SHOW/HIDE Main Sections (excluding login/setup)
// -------------------------------------------------------------------------------------------------
// - If setup is NOT done (no currentSchool/class/section), hide everything except #teacher-setup.
// - If setup is done, hide #teacher-setup and show the six main sections.
function resetViews() {
  const setupDone = currentSchool && teacherClass && teacherSection;
  const mainSections = [
    $("financial-settings"),
    $("animatedCounters"),
    $("student-registration"),
    $("attendance-section"),
    $("analytics-section"),
    $("register-section")
  ];

  if (!setupDone) {
    // Hide the six main sections, show the “Setup” box
    mainSections.forEach(sec => sec && sec.classList.add("hidden"));
    document.getElementById("teacher-setup").classList.remove("hidden");
  } else {
    // Show the six main sections, hide the “Setup” box
    mainSections.forEach(sec => sec && sec.classList.remove("hidden"));
    document.getElementById("teacher-setup").classList.add("hidden");
  }
}

// -------------------------------------------------------------------------------------------------
// 5) loadSetup(): POPULATE Setup Form & Load Active School Data
// -------------------------------------------------------------------------------------------------
async function loadSetup() {
  // 5a) Read IndexedDB keys for schools, currentSchool, class, section
  schools        = (await idbGet("schools")) || [];
  currentSchool  = await idbGet("currentSchool");
  teacherClass   = await idbGet("teacherClass");
  teacherSection = await idbGet("teacherSection");

  // 5b) Populate the “Select School” dropdown
  const schoolSelect = $("schoolSelect");
  schoolSelect.innerHTML = `
    <option disabled selected>-- Select School --</option>
    ${schools.map(s => `<option value="${s}">${s}</option>`).join("")}
  `;
  if (currentSchool) {
    schoolSelect.value = currentSchool;
  }

  renderSchoolList();

  // 5c) If school + class + section are already chosen → load that school’s data
  if (currentSchool && teacherClass && teacherSection) {
    await ensureSchoolData(currentSchool);
    students       = studentsBySchool[currentSchool];
    attendanceData = attendanceDataBySchool[currentSchool];
    paymentsData   = paymentsDataBySchool[currentSchool];
    lastAdmNo      = lastAdmNoBySchool[currentSchool];

    // Set the “Select Class” and “Select Section” dropdowns to the saved values
    $("teacherClassSelect").value   = teacherClass;
    $("teacherSectionSelect").value = teacherSection;

    // Show the “Setup Display” (summary) and hide the setup form
    $("setupText").textContent = `${currentSchool} 🏫 | Class: ${teacherClass} | Section: ${teacherSection}`;
    $("setupForm").classList.add("hidden");
    $("setupDisplay").classList.remove("hidden");

    // Hide the Setup box, show the six main sections
    resetViews();

    // Render Students table & animate counters now that setup is done
    renderStudents();
    updateCounters();
  } else {
    // Setup is incomplete → show setup form, hide main sections
    $("setupForm").classList.remove("hidden");
    $("setupDisplay").classList.add("hidden");
    document.getElementById("teacher-setup").classList.remove("hidden");
    resetViews();
  }
}

// -------------------------------------------------------------------------------------------------
// 6) renderSchoolList(): SHOW all schools with Edit/Delete buttons (for Admin/Principal)
// -------------------------------------------------------------------------------------------------
function renderSchoolList() {
  const schoolListDiv = $("schoolList");
  schoolListDiv.innerHTML = "";
  schools.forEach((sch, idx) => {
    const row = document.createElement("div");
    row.className = "row-inline";
    row.innerHTML = `
      <span>${sch}</span>
      <div>
        <button data-idx="${idx}" class="edit-school no-print"><i class="fas fa-edit"></i></button>
        <button data-idx="${idx}" class="delete-school no-print"><i class="fas fa-trash"></i></button>
      </div>
    `;
    schoolListDiv.appendChild(row);
  });

  // Edit School
  document.querySelectorAll(".edit-school").forEach(btn => {
    btn.onclick = async () => {
      const idx = +btn.dataset.idx;
      const newName = prompt("Rename school:", schools[idx]);
      if (!newName) return;
      if (schools.includes(newName)) {
        alert("School name already exists.");
        return;
      }
      const oldName = schools[idx];
      schools[idx] = newName.trim();
      await idbSet("schools", schools);

      // Rename per‐school datasets in IndexedDB → Firebase
      studentsBySchool[newName]       = studentsBySchool[oldName] || [];
      delete studentsBySchool[oldName];
      await idbSet("studentsBySchool", studentsBySchool);

      attendanceDataBySchool[newName] = attendanceDataBySchool[oldName] || {};
      delete attendanceDataBySchool[oldName];
      await idbSet("attendanceDataBySchool", attendanceDataBySchool);

      paymentsDataBySchool[newName]   = paymentsDataBySchool[oldName] || {};
      delete paymentsDataBySchool[oldName];
      await idbSet("paymentsDataBySchool", paymentsDataBySchool);

      lastAdmNoBySchool[newName]      = lastAdmNoBySchool[oldName] || 0;
      delete lastAdmNoBySchool[oldName];
      await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);

      await syncToFirebase();
      await loadSetup();
    };
  });

  // Delete School
  document.querySelectorAll(".delete-school").forEach(btn => {
    btn.onclick = async () => {
      const idx = +btn.dataset.idx;
      const removed = schools.splice(idx, 1)[0];
      await idbSet("schools", schools);

      delete studentsBySchool[removed];
      await idbSet("studentsBySchool", studentsBySchool);

      delete attendanceDataBySchool[removed];
      await idbSet("attendanceDataBySchool", attendanceDataBySchool);

      delete paymentsDataBySchool[removed];
      await idbSet("paymentsDataBySchool", paymentsDataBySchool);

      delete lastAdmNoBySchool[removed];
      await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);

      if (currentSchool === removed) {
        currentSchool = null;
        teacherClass = null;
        teacherSection = null;
        await idbSet("currentSchool", null);
        await idbSet("teacherClass", null);
        await idbSet("teacherSection", null);
      }
      await syncToFirebase();
      await loadSetup();
    };
  });
}

// -------------------------------------------------------------------------------------------------
// 7) FINANCIAL SETTINGS SECTION
// -------------------------------------------------------------------------------------------------
const fineAbsentInput  = $("fineAbsent");
const fineLateInput    = $("fineLate");
const fineLeaveInput   = $("fineLeave");
const fineHalfDayInput = $("fineHalfDay");
const eligibilityPctInput = $("eligibilityPct");
const saveSettingsBtn  = $("saveSettings");

const settingsCard    = document.createElement("div");
const editSettingsBtn = document.createElement("button");

function loadFinancialSettings() {
  fineAbsentInput.value = fineRates.A;
  fineLateInput.value   = fineRates.Lt;
  fineLeaveInput.value  = fineRates.L;
  fineHalfDayInput.value = fineRates.HD;
  eligibilityPctInput.value = eligibilityPct;

  settingsCard.id = "settingsCard";
  editSettingsBtn.id = "editSettings";
  editSettingsBtn.classList.add("no-print");
  editSettingsBtn.innerHTML = `<i class="fas fa-edit"></i> Edit`;
  editSettingsBtn.onclick = () => {
    settingsCard.classList.add("hidden");
    editSettingsBtn.classList.add("hidden");
    $("financialForm").classList.remove("hidden");
    saveSettingsBtn.classList.remove("hidden");
  };
  $("financial-settings").append(settingsCard, editSettingsBtn);
}

saveSettingsBtn.onclick = async () => {
  fineRates = {
    A: Number(fineAbsentInput.value) || 0,
    Lt: Number(fineLateInput.value) || 0,
    L: Number(fineLeaveInput.value) || 0,
    HD: Number(fineHalfDayInput.value) || 0
  };
  eligibilityPct = Number(eligibilityPctInput.value) || 0;
  await idbSet("fineRates", fineRates);
  await idbSet("eligibilityPct", eligibilityPct);
  await syncToFirebase();

  settingsCard.innerHTML = `
    <div class="card">
      <p><strong>Fine/Absent:</strong> PKR ${fineRates.A}</p>
      <p><strong>Fine/Late:</strong> PKR ${fineRates.Lt}</p>
      <p><strong>Fine/Leave:</strong> PKR ${fineRates.L}</p>
      <p><strong>Fine/Half-Day:</strong> PKR ${fineRates.HD}</p>
      <p><strong>Eligibility %:</strong> ${eligibilityPct}%</p>
    </div>`;
  $("financialForm").classList.add("hidden");
  saveSettingsBtn.classList.add("hidden");
  settingsCard.classList.remove("hidden");
  editSettingsBtn.classList.remove("hidden");
};

// -------------------------------------------------------------------------------------------------
// 8) COUNTERS (DASHBOARD) SECTION
// -------------------------------------------------------------------------------------------------
const countersContainer = $("countersContainer");

function createCounterCard(id, title, spanId) {
  const card = document.createElement("div");
  card.className = "counter-card";
  card.id = id;
  card.innerHTML = `
    <div class="card-content">
      <p class="card-title">${title}</p>
      <p class="card-number"><span id="${spanId}" data-target="0">0</span></p>
    </div>`;
  countersContainer.appendChild(card);
}

function setupCounters() {
  countersContainer.innerHTML = "";
  createCounterCard("card-section",  "Section",       "sectionCount");
  createCounterCard("card-class",    "Class",         "classCount");
  createCounterCard("card-school",   "School",        "schoolCount");
  createCounterCard("card-attendance","Attendance",    "attendanceCount");
  createCounterCard("card-eligible", "Eligible",      "eligibleCount");
  createCounterCard("card-debarred","Debarred",       "debarredCount");
  createCounterCard("card-outstanding","Outstanding/Fine","outstandingCount");
}

function animateCounters() {
  document.querySelectorAll(".card-number span").forEach(span => {
    const target = +span.dataset.target;
    let count = 0;
    const step = Math.max(1, target / 100);
    (function update() {
      count += step;
      span.textContent = count < target ? Math.ceil(count) : target;
      if (count < target) requestAnimationFrame(update);
    })();
  });
}

function updateCounters() {
  const cl  = teacherClass;
  const sec = teacherSection;

  const sectionCountSpan    = $("sectionCount");
  const classCountSpan      = $("classCount");
  const schoolCountSpan     = $("schoolCount");
  const attendanceCountSpan = $("attendanceCount");
  const eligibleCountSpan   = $("eligibleCount");
  const debarredCountSpan   = $("debarredCount");
  const outstandingCountSpan= $("outstandingCount");

  const sectionStudents = students.filter(s => s.cls === cl && s.sec === sec);
  sectionCountSpan.dataset.target = sectionStudents.length;

  const classStudents = students.filter(s => s.cls === cl);
  classCountSpan.dataset.target = classStudents.length;

  schoolCountSpan.dataset.target = students.length;

  // Compute attendance totals for “section” (P, A, Lt, HD, L counts)
  let totalP = 0, totalA = 0, totalLt = 0, totalHD = 0, totalL = 0;
  Object.entries(attendanceData).forEach(([date, rec]) => {
    sectionStudents.forEach(s => {
      const code = rec[s.adm];
      if (!code) {
        totalA++;
      } else {
        switch (code) {
          case "P":  totalP++;  break;
          case "A":  totalA++;  break;
          case "Lt": totalLt++; break;
          case "HD": totalHD++; break;
          case "L":  totalL++;  break;
        }
      }
    });
  });
  const attendanceTotal = totalP + totalA + totalLt + totalHD + totalL;
  attendanceCountSpan.dataset.target = attendanceTotal;

  // Compute “Eligible / Debarred / Outstanding” for each student in this section
  let eligibleCount = 0, debarredCount = 0, outstandingCount = 0;
  students.forEach(s => {
    if (s.cls !== cl || s.sec !== sec) return;
    let p = 0, a = 0, lt = 0, hd = 0, l = 0, totalDays = 0;
    Object.values(attendanceData).forEach(rec => {
      if (rec[s.adm]) {
        totalDays++;
        switch (rec[s.adm]) {
          case "P":  p++;  break;
          case "A":  a++;  break;
          case "Lt": lt++; break;
          case "HD": hd++; break;
          case "L":  l++;  break;
        }
      }
    });
    const fineTotal = 
      a * fineRates.A +
      lt * fineRates.Lt +
      l * fineRates.L +
      hd * fineRates.HD;
    const paid = (paymentsData[s.adm] || []).reduce((acc, pmt) => acc + pmt.amount, 0);
    const outstanding = fineTotal - paid;
    const pct = totalDays ? (p / totalDays) * 100 : 0;
    const status = (outstanding > 0 || pct < eligibilityPct) ? "Debarred" : "Eligible";

    if (status === "Eligible") eligibleCount++;
    else debarredCount++;
    if (outstanding > 0) outstandingCount++;
  });
  eligibleCountSpan.dataset.target     = eligibleCount;
  debarredCountSpan.dataset.target     = debarredCount;
  outstandingCountSpan.dataset.target  = outstandingCount;

  animateCounters();
}

// -------------------------------------------------------------------------------------------------
// 9) STUDENT REGISTRATION SECTION
// -------------------------------------------------------------------------------------------------
const studentsBody               = $("studentsBody");
const selectAllStudents          = $("selectAllStudents");
const editSelectedBtn            = $("editSelected");
const doneEditingBtn             = $("doneEditing");
const deleteSelectedBtn          = $("deleteSelected");
const addStudentBtn              = $("addStudent");
const saveRegistrationBtn        = $("saveRegistration");
const editRegistrationBtn        = $("editRegistration");
const shareRegistrationBtn       = $("shareRegistration");
const downloadRegistrationPDFBtn = $("downloadRegistrationPDF");

addStudentBtn.onclick = async (e) => {
  e.preventDefault();
  const n = $("studentName").value.trim();
  const p = $("parentName").value.trim();
  const c = $("parentContact").value.trim();
  const o = $("parentOccupation").value.trim();
  const a = $("parentAddress").value.trim();
  const cl = teacherClass;
  const sec = teacherSection;
  if (!n || !p || !c || !o || !a) {
    alert("All fields required");
    return;
  }
  if (!/^\d{7,15}$/.test(c)) {
    alert("Contact must be 7–15 digits");
    return;
  }
  const adm = await genAdmNo();
  students.push({
    name: n,
    adm,
    parent: p,
    contact: c,
    occupation: o,
    address: a,
    cls: cl,
    sec
  });
  studentsBySchool[currentSchool] = students;
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();
  renderStudents();
  updateCounters();

  // ---- CLEAR the five form fields after adding ----
  $("studentName").value      = "";
  $("parentName").value       = "";
  $("parentContact").value    = "";
  $("parentOccupation").value = "";
  $("parentAddress").value    = "";
};

function renderStudents() {
  studentsBody.innerHTML = "";
  let idx = 0;
  const cl = teacherClass;
  const sec = teacherSection;

  students.forEach((s, i) => {
    if (s.cls !== cl || s.sec !== sec) return;
    idx++;
    // Compute stats for each student
    const stats = { P: 0, A: 0, Lt: 0, HD: 0, L: 0 };
    Object.values(attendanceData).forEach(rec => {
      if (rec[s.adm]) stats[rec[s.adm]]++;
    });
    const total = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
    const fine = 
      stats.A * fineRates.A +
      stats.Lt * fineRates.Lt +
      stats.L * fineRates.L +
      stats.HD * fineRates.HD;
    const paid = (paymentsData[s.adm] || []).reduce((acc, pmt) => acc + pmt.amount, 0);
    const out = fine - paid;
    const pct = total ? (stats.P / total) * 100 : 0;
    const status = (out > 0 || pct < eligibilityPct) ? "Debarred" : "Eligible";

    const tr = document.createElement("tr");
    tr.dataset.index = i;
    tr.innerHTML = `
      <td><input type="checkbox" class="sel"></td>
      <td>${idx}</td>
      <td>${s.name}</td>        <!-- cell 2: Name -->
      <td>${s.adm}</td>         <!-- cell 3: Admission# -->
      <td>${s.parent}</td>      <!-- cell 4: Parent -->
      <td>${s.contact}</td>     <!-- cell 5: Contact -->
      <td>${s.occupation}</td>  <!-- cell 6: Occupation -->
      <td>${s.address}</td>     <!-- cell 7: Address -->
      <td>PKR ${out}</td>       <!-- cell 8: Fine -->
      <td>${status}</td>        <!-- cell 9: Status -->
      <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
    `;
    studentsBody.appendChild(tr);
  });
  selectAllStudents.checked = false;
  toggleButtons();
  document.querySelectorAll(".add-payment-btn").forEach(b => {
    b.onclick = () => openPaymentModal(b.dataset.adm);
  });
}

function toggleButtons() {
  const anyChecked = document.querySelectorAll(".sel:checked").length > 0;
  editSelectedBtn.disabled = !anyChecked;
  deleteSelectedBtn.disabled = !anyChecked;
}

studentsBody.addEventListener("change", e => {
  if (e.target.classList.contains("sel")) toggleButtons();
});

selectAllStudents.onclick = () => {
  document.querySelectorAll(".sel")
    .forEach(c => c.checked = selectAllStudents.checked);
  toggleButtons();
};

editSelectedBtn.onclick = () => {
  document.querySelectorAll(".sel:checked").forEach(cb => {
    const tr = cb.closest("tr");
    const i = Number(tr.dataset.index);
    const s = students[i];
    tr.cells[2].innerHTML = `<input value="${s.name}" />`;
    tr.cells[4].innerHTML = `<input value="${s.parent}" />`;
    tr.cells[5].innerHTML = `<input value="${s.contact}" />`;
    tr.cells[6].innerHTML = `<input value="${s.occupation}" />`;
    tr.cells[7].innerHTML = `<input value="${s.address}" />`;
  });
  editSelectedBtn.classList.add("hidden");
  deleteSelectedBtn.classList.add("hidden");
  doneEditingBtn.classList.remove("hidden");
};

doneEditingBtn.onclick = async () => {
  document.querySelectorAll(".sel:checked").forEach(cb => {
    const tr = cb.closest("tr");
    const i = Number(tr.dataset.index);
    const inputs = tr.querySelectorAll("input");
    students[i].name       = inputs[0].value.trim();
    students[i].parent     = inputs[1].value.trim();
    students[i].contact    = inputs[2].value.trim();
    students[i].occupation = inputs[3].value.trim();
    students[i].address    = inputs[4].value.trim();
  });
  studentsBySchool[currentSchool] = students;
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();
  renderStudents();
  updateCounters();
  doneEditingBtn.classList.add("hidden");
  editSelectedBtn.classList.remove("hidden");
  deleteSelectedBtn.classList.remove("hidden");
};

deleteSelectedBtn.onclick = async () => {
  if (!confirm("Delete selected students?")) return;
  const toDelete = Array.from(document.querySelectorAll(".sel:checked"))
    .map(cb => Number(cb.closest("tr").dataset.index));
  students = students.filter((_, idx) => !toDelete.includes(idx));
  studentsBySchool[currentSchool] = students;
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();
  renderStudents();
  updateCounters();
};

saveRegistrationBtn.onclick = () => {
  if (!doneEditingBtn.classList.contains("hidden")) {
    alert("Finish editing before saving.");
    return;
  }
  saveRegistrationBtn.classList.add("hidden");
  editRegistrationBtn.classList.remove("hidden");
  shareRegistrationBtn.classList.remove("hidden");
  downloadRegistrationPDFBtn.classList.remove("hidden");
};

editRegistrationBtn.onclick = () => {
  editRegistrationBtn.classList.add("hidden");
  shareRegistrationBtn.classList.add("hidden");
  downloadRegistrationPDFBtn.classList.add("hidden");
  saveRegistrationBtn.classList.remove("hidden");
};

shareRegistrationBtn.onclick = () => {
  const header = `Student Registration List\n${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`;
  const lines = students
    .filter(s => s.cls === teacherClass && s.sec === teacherSection)
    .map((s, i) =>
      `${i+1}. Adm#: ${s.adm} Name: ${s.name} Parent: ${s.parent}`
    );
  window.open(
    `https://wa.me/?text=${encodeURIComponent(header + "\n\n" + lines.join("\n"))}`,
    "_blank"
  );
};

downloadRegistrationPDFBtn.onclick = () => {
  const doc = new jspdf.jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const today = new Date().toISOString().split("T")[0];
  doc.setFontSize(18);
  doc.text("Student Registration List", 14, 16);
  doc.setFontSize(10);
  doc.text(`Date: ${today}`, w - 14, 16, { align: "right" });
  doc.setFontSize(12);
  doc.text(
    `${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`,
    14,
    24
  );

  const tempTable = document.createElement("table");
  tempTable.innerHTML = `
    <thead>
      <tr>
        <th>#</th><th>Adm#</th><th>Name</th><th>Parent</th><th>Contact</th><th>Occupation</th><th>Address</th>
      </tr>
    </thead>
    <tbody>
      ${students
        .filter(s => s.cls === teacherClass && s.sec === teacherSection)
        .map((s, i) => `
        <tr>
          <td>${i+1}</td>
          <td>${s.adm}</td>
          <td>${s.name}</td>
          <td>${s.parent}</td>
          <td>${s.contact}</td>
          <td>${s.occupation}</td>
          <td>${s.address}</td>
        </tr>`).join("")}
    </tbody>`;
  tempTable.id = "tempStudentsTable";
  document.body.appendChild(tempTable);

  doc.autoTable({
    html: "#tempStudentsTable",
    margin: { top: 40 } // ensure table doesn’t overlap the headings
  });

  document.body.removeChild(tempTable);

  const fileName = `students_${teacherClass}_${teacherSection}_${today}.pdf`;
  const blob = doc.output("blob");
  doc.save(fileName);
  sharePdf(blob, fileName, "Student Registration List");
};

// -------------------------------------------------------------------------------------------------
// 10) PAYMENT MODAL SECTION
// -------------------------------------------------------------------------------------------------
const paymentModal         = $("paymentModal");
const paymentModalCloseBtn = $("paymentModalClose");
const payAdmSpan           = $("payAdm");
const paymentAmountInput   = $("paymentAmount");
const savePaymentBtn       = $("savePayment");
const cancelPaymentBtn     = $("cancelPayment");

function openPaymentModal(adm) {
  payAdmSpan.textContent = adm;
  paymentAmountInput.value = "";
  paymentModal.classList.remove("hidden");
}

paymentModalCloseBtn.onclick = () => paymentModal.classList.add("hidden");
cancelPaymentBtn.onclick     = () => paymentModal.classList.add("hidden");

savePaymentBtn.onclick = async () => {
  const adm = payAdmSpan.textContent;
  const amt = Number(paymentAmountInput.value) || 0;
  paymentsData[adm] = paymentsData[adm] || [];
  paymentsData[adm].push({ date: new Date().toISOString().split("T")[0], amount: amt });
  paymentsDataBySchool[currentSchool] = paymentsData;
  await idbSet("paymentsDataBySchool", paymentsDataBySchool);
  await syncToFirebase();
  paymentModal.classList.add("hidden");
  renderStudents();
  updateCounters();
};

// -------------------------------------------------------------------------------------------------
// 11) MARK ATTENDANCE SECTION
// -------------------------------------------------------------------------------------------------
const attendanceBodyDiv       = $("attendanceBody");
const attendanceSummaryDiv    = $("attendanceSummary");
const loadAttendanceBtn       = $("loadAttendance");
const saveAttendanceBtn       = $("saveAttendance");
const resetAttendanceBtn      = $("resetAttendance");
const downloadAttendancePDFBtn= $("downloadAttendancePDF");
const shareAttendanceBtn      = $("shareAttendanceSummary");
const dateInput               = $("dateInput");

const statusNames = { P: "Present", A: "Absent", Lt: "Late", HD: "Half-Day", L: "Leave" };
const statusColors= { P: "#4caf50", A: "#f44336", Lt: "#ff9800", HD: "#ff9800", L: "#03a9f4" };

loadAttendanceBtn.onclick = () => {
  attendanceBodyDiv.innerHTML = "";
  attendanceSummaryDiv.innerHTML = "";
  const cl  = teacherClass;
  const sec = teacherSection;

  students.filter(stu => stu.cls === cl && stu.sec === sec).forEach((stu, i) => {
    const row = document.createElement("div");
    const headerDiv = document.createElement("div");
    const btnsDiv   = document.createElement("div");
    row.className       = "attendance-row";
    headerDiv.className = "attendance-header";
    btnsDiv.className   = "attendance-buttons";
    headerDiv.textContent = `${i+1}. ${stu.name} (${stu.adm})`;

    Object.keys(statusNames).forEach(code => {
      const btn = document.createElement("button");
      btn.className = "att-btn";
      btn.textContent = code;
      btn.onclick = () => {
        btnsDiv.querySelectorAll(".att-btn").forEach(b => {
          b.classList.remove("selected");
          b.style = "";
        });
        btn.classList.add("selected");
        btn.style.background = statusColors[code];
        btn.style.color = "#fff";
      };
      btnsDiv.appendChild(btn);
    });

    row.append(headerDiv, btnsDiv);
    attendanceBodyDiv.appendChild(row);
  });

  attendanceBodyDiv.style.overflowX = "auto";
  saveAttendanceBtn.classList.remove("hidden");
  resetAttendanceBtn.classList.add("hidden");
  downloadAttendancePDFBtn.classList.add("hidden");
  shareAttendanceBtn.classList.add("hidden");
  attendanceSummaryDiv.classList.add("hidden");
};

saveAttendanceBtn.onclick = async () => {
  const date = dateInput.value;
  if (!date) {
    alert("Pick date");
    return;
  }
  attendanceData[date] = {};
  const cl  = teacherClass;
  const sec = teacherSection;
  students.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
    const selBtn = attendanceBodyDiv.children[i].querySelector(".att-btn.selected");
    attendanceData[date][s.adm] = selBtn ? selBtn.textContent : "A";
  });
  attendanceDataBySchool[currentSchool] = attendanceData;
  await idbSet("attendanceDataBySchool", attendanceDataBySchool);
  await syncToFirebase();

  attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
  const tbl = document.createElement("table");
  tbl.id = "attendanceSummaryTable";
  tbl.innerHTML = `
    <tr>
      <th>Sr#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th>
    </tr>`;
  students.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
    const code = attendanceData[date][s.adm];
    tbl.innerHTML += `
      <tr>
        <td>${i+1}</td>
        <td>${s.adm}</td>
        <td>${s.name}</td>
        <td>${statusNames[code]}</td>
        <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
      </tr>`;
  });
  attendanceSummaryDiv.appendChild(tbl);
  attendanceSummaryDiv.querySelectorAll(".share-individual").forEach(ic => {
    ic.onclick = () => {
      const adm = ic.dataset.adm;
      const st  = students.find(x => x.adm === adm);
      const msg = `Dear Parent, your child (Adm#: ${adm}) was ${statusNames[attendanceData[date][adm]]} on ${date}.`;
      window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`, "_blank");
    };
  });

  attendanceBodyDiv.classList.add("hidden");
  saveAttendanceBtn.classList.add("hidden");
  resetAttendanceBtn.classList.remove("hidden");
  downloadAttendancePDFBtn.classList.remove("hidden");
  shareAttendanceBtn.classList.remove("visible"); 
  attendanceSummaryDiv.classList.remove("hidden");
  updateCounters();
};

resetAttendanceBtn.onclick = () => {
  attendanceBodyDiv.classList.remove("hidden");
  saveAttendanceBtn.classList.remove("hidden");
  resetAttendanceBtn.classList.add("hidden");
  downloadAttendancePDFBtn.classList.add("hidden");
  shareAttendanceBtn.classList.add("hidden");
  attendanceSummaryDiv.classList.add("hidden");
};

downloadAttendancePDFBtn.onclick = async () => {
  const doc = new jspdf.jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const today = new Date().toISOString().split("T")[0];
  doc.setFontSize(18);
  doc.text("Attendance Report", 14, 16);
  doc.setFontSize(10);
  doc.text(`Date: ${today}`, w - 14, 16, { align: "right" });
  doc.setFontSize(12);
  doc.text(
    `${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`,
    14,
    24
  );
  doc.autoTable({
    startY: 40,
    html: "#attendanceSummaryTable"
  });
  const fileName = `attendance_${dateInput.value}.pdf`;
  const blob = doc.output("blob");
  doc.save(fileName);
  await sharePdf(blob, fileName, "Attendance Report");
};

shareAttendanceBtn.onclick = () => {
  const cl  = teacherClass;
  const sec = teacherSection;
  const date = dateInput.value;
  const header = `*Attendance Report*\nClass ${cl} Sec ${sec} - ${date}`;
  const lines = students
    .filter(s => s.cls === cl && s.sec === sec)
    .map((s, i) =>
      `${i+1}. ${s.name} (Adm#: ${s.adm}): ${statusNames[attendanceData[date][s.adm]]}`
    );
  window.open(
    `https://wa.me/?text=${encodeURIComponent(header + "\n\n" + lines.join("\n"))}`,
    "_blank"
  );
};

// -------------------------------------------------------------------------------------------------
// 12) ANALYTICS SECTION
// -------------------------------------------------------------------------------------------------
const analyticsTarget         = $("analyticsTarget");
const analyticsSectionSelect  = $("analyticsSectionSelect");
const analyticsType           = $("analyticsType");
const analyticsDate           = $("analyticsDate");
const analyticsMonth          = $("analyticsMonth");
const semesterStartInput      = $("semesterStart");
const semesterEndInput        = $("semesterEnd");
const yearStartInput          = $("yearStart");
const analyticsSearch         = $("analyticsSearch");
const loadAnalyticsBtn        = $("loadAnalytics");
const resetAnalyticsBtn       = $("resetAnalytics");
const instructionsDiv         = $("instructions");
const analyticsContainer      = $("analyticsContainer");
const analyticsBody           = $("analyticsBody");
const graphsDiv               = $("graphs");
const barChartCanvas          = $("barChart");
const pieChartCanvas          = $("pieChart");
const downloadAnalyticsBtn    = $("downloadAnalytics");
const shareAnalyticsBtn       = $("shareAnalytics");

let lastAnalyticsStats = [];
let lastAnalyticsRange = {};
let lastAnalyticsShare = "";
let analyticsFilterOptions = ["all"];
let analyticsDownloadMode  = "combined";

// When “Report For” changes, show/hide section or search box
analyticsTarget.onchange = () => {
  analyticsType.disabled            = false;
  analyticsSectionSelect.classList.add("hidden");
  analyticsSearch.classList.add("hidden");
  if (analyticsTarget.value === "section") {
    analyticsSectionSelect.classList.remove("hidden");
  }
  if (analyticsTarget.value === "student") {
    analyticsSearch.classList.remove("hidden");
  }
};

// When “Period” changes, show/hide date/month/semester inputs
analyticsType.onchange = () => {
  analyticsDate.classList.add("hidden");
  analyticsMonth.classList.add("hidden");
  semesterStartInput.classList.add("hidden");
  semesterEndInput.classList.add("hidden");
  yearStartInput.classList.add("hidden");
  instructionsDiv.classList.add("hidden");
  analyticsContainer.classList.add("hidden");
  graphsDiv.classList.add("hidden");
  $("analyticsActions").classList.add("hidden");
  resetAnalyticsBtn.classList.remove("hidden");

  switch (analyticsType.value) {
    case "date":
      analyticsDate.classList.remove("hidden");
      break;
    case "month":
      analyticsMonth.classList.remove("hidden");
      break;
    case "semester":
      semesterStartInput.classList.remove("hidden");
      semesterEndInput.classList.remove("hidden");
      break;
    case "year":
      yearStartInput.classList.remove("hidden");
      break;
  }
};

loadAnalyticsBtn.onclick = () => {
  if (analyticsTarget.value === "student" && !analyticsSearch.value.trim()) {
    alert("Enter admission number or name");
    return;
  }
  let from, to;
  if (analyticsType.value === "date") {
    from = to = analyticsDate.value;
  } else if (analyticsType.value === "month") {
    const [y, m] = analyticsMonth.value.split("-").map(Number);
    from = `${analyticsMonth.value}-01`;
    to = `${analyticsMonth.value}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  } else if (analyticsType.value === "semester") {
    const [sy, sm] = semesterStartInput.value.split("-").map(Number);
    const [ey, em] = semesterEndInput.value.split("-").map(Number);
    from = `${semesterStartInput.value}-01`;
    to = `${semesterEndInput.value}-${String(new Date(ey, em, 0).getDate()).padStart(2, "0")}`;
  } else if (analyticsType.value === "year") {
    from = `${yearStartInput.value}-01-01`;
    to = `${yearStartInput.value}-12-31`;
  } else {
    alert("Select period type");
    return;
  }

  const cls = teacherClass;
  const sec = teacherSection;
  let pool = students.filter(s => s.cls === cls && s.sec === sec);

  if (analyticsTarget.value === "section") {
    const asel = analyticsSectionSelect.value;
    pool = pool.filter(s => s.sec === asel);
  }
  if (analyticsTarget.value === "student") {
    const q = analyticsSearch.value.trim().toLowerCase();
    pool = pool.filter(s => s.adm === q || s.name.toLowerCase().includes(q));
  }

  const stats = pool.map(s => ({ adm: s.adm, name: s.name, P: 0, A: 0, Lt: 0, HD: 0, L: 0, total: 0 }));
  Object.entries(attendanceData).forEach(([d, rec]) => {
    if (d < from || d > to) return;
    stats.forEach(st => {
      if (rec[st.adm]) {
        st[rec[st.adm]]++;
        st.total++;
      }
    });
  });
  stats.forEach(st => {
    const totalFine = st.A * fineRates.A + st.Lt * fineRates.Lt + st.L * fineRates.L + st.HD * fineRates.HD;
    const paid = (paymentsData[st.adm] || []).reduce((a, p) => a + p.amount, 0);
    st.outstanding = totalFine - paid;
    const pct = st.total ? (st.P / st.total) * 100 : 0;
    st.status = (st.outstanding > 0 || pct < eligibilityPct) ? "Debarred" : "Eligible";
  });

  lastAnalyticsStats = stats;
  lastAnalyticsRange = { from, to };
  renderAnalytics(stats, from, to);
};

function renderAnalytics(stats, from, to) {
  let filtered = stats;
  if (!analyticsFilterOptions.includes("all")) {
    filtered = stats.filter(st =>
      analyticsFilterOptions.some(opt => {
        switch (opt) {
          case "registered": return true;
          case "attendance": return st.total > 0;
          case "fine": return st.A > 0 || st.Lt > 0 || st.L > 0 || st.HD > 0;
          case "cleared": return st.outstanding === 0;
          case "debarred": return st.status === "Debarred";
          case "eligible": return st.status === "Eligible";
        }
      })
    );
  }

  const theadRow = document.querySelector("#analyticsTable thead tr");
  theadRow.innerHTML = [
    "#", "Adm#", "Name", "P", "A", "Lt", "HD", "L", "Total", "%", "Outstanding", "Status"
  ].map(h => `<th>${h}</th>`).join("");

  analyticsBody.innerHTML = "";
  filtered.forEach((st, i) => {
    const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${st.adm}</td>
      <td>${st.name}</td>
      <td>${st.P}</td>
      <td>${st.A}</td>
      <td>${st.Lt}</td>
      <td>${st.HD}</td>
      <td>${st.L}</td>
      <td>${st.total}</td>
      <td>${pct}%</td>
      <td>PKR ${st.outstanding}</td>
      <td>${st.status}</td>
    `;
    analyticsBody.appendChild(tr);
  });

  instructionsDiv.textContent = `Period: ${from} to ${to}`;
  instructionsDiv.classList.remove("hidden");
  analyticsContainer.classList.remove("hidden");
  graphsDiv.classList.remove("hidden");
  $("analyticsActions").classList.remove("hidden");

  // Bar Chart (no hard-coded backgroundColor → default palette)
  const barCtx = barChartCanvas.getContext("2d");
  if (window.barChartInstance) window.barChartInstance.destroy();
  window.barChartInstance = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: filtered.map(st => st.name),
      datasets: [{
        label: "% Present",
        data: filtered.map(st => (st.total ? (st.P / st.total) * 100 : 0))
        // backgroundColor omitted → Chart.js default colors
      }]
    },
    options: {
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });

  // Pie Chart with explicit five‐color palette (no duplicates)
  const totals = filtered.reduce((acc, st) => {
    acc.P  += st.P;
    acc.A  += st.A;
    acc.Lt += st.Lt;
    acc.HD += st.HD;
    acc.L  += st.L;
    return acc;
  }, { P: 0, A: 0, Lt: 0, HD: 0, L: 0 });

  const pieCtx = pieChartCanvas.getContext("2d");
  if (window.pieChartInstance) window.pieChartInstance.destroy();
  window.pieChartInstance = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: Object.values(statusNames),
      datasets: [{
        data: Object.keys(statusNames).map(code => totals[code]),
        backgroundColor: [
          "#4caf50", // Present
          "#f44336", // Absent
          "#ff9800", // Late
          "#ffc107", // Half‐Day
          "#03a9f4"  // Leave
        ]
      }]
    }
  });

  lastAnalyticsShare =
    `Attendance Analytics (${from} to ${to})\n` +
    filtered.map((st, i) => {
      const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
      return `${i+1}. ${st.adm} ${st.name}: ${pct}% / PKR ${st.outstanding}`;
    }).join("\n");
}

downloadAnalyticsBtn.onclick = async () => {
  if (!lastAnalyticsStats.length) {
    alert("Load analytics first");
    return;
  }

  const from = lastAnalyticsRange.from;
  const to   = lastAnalyticsRange.to;
  const today = new Date().toISOString().split("T")[0];
  const doc = new jspdf.jsPDF();

  if (analyticsDownloadMode === "combined") {
    doc.setFontSize(18);
    doc.text("Attendance Analytics", 14, 16);
    doc.setFontSize(10);
    doc.text(`Period: ${from} to ${to}`, 14, 24);
    doc.setFontSize(12);
    doc.text(
      `${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`,
      14,
      32
    );

    const tempTable = document.createElement("table");
    tempTable.innerHTML = `
      <thead>
        <tr>
          <th>#</th><th>Adm#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th><th>Outstanding</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${lastAnalyticsStats.map((st, i) => {
          const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
          return `
            <tr>
              <td>${i + 1}</td>
              <td>${st.adm}</td>
              <td>${st.name}</td>
              <td>${st.P}</td>
              <td>${st.A}</td>
              <td>${st.Lt}</td>
              <td>${st.HD}</td>
              <td>${st.L}</td>
              <td>${st.total}</td>
              <td>${pct}%</td>
              <td>PKR ${st.outstanding}</td>
              <td>${st.status}</td>
            </tr>`;
        }).join("")}
      </tbody>`;
    tempTable.id = "tempAnalyticsTable";
    document.body.appendChild(tempTable);

    doc.autoTable({
      html: "#tempAnalyticsTable",
      startY: 50,
      margin: { top: 50 }
    });
    document.body.removeChild(tempTable);

    const fileName = `analytics_combined_${from}_to_${to}.pdf`;
    const blob = doc.output("blob");
    doc.save(fileName);
    await sharePdf(blob, fileName, "Attendance Analytics");
  } else {
    lastAnalyticsStats.forEach((st, i) => {
      if (i !== 0) doc.addPage();
      const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
      doc.setFontSize(14);
      doc.text("Attendance Receipt", 14, 16);
      doc.setFontSize(12);
      doc.text(`Student: ${st.name} (Adm#: ${st.adm})`, 14, 26);
      doc.text(`Present: ${st.P}`, 14, 36);
      doc.text(`Absent: ${st.A}`, 14, 44);
      doc.text(`Late: ${st.Lt}`, 14, 52);
      doc.text(`Half-Day: ${st.HD}`, 14, 60);
      doc.text(`Leave: ${st.L}`, 14, 68);
      doc.text(`Total Days: ${st.total}`, 14, 76);
      doc.text(`% Present: ${pct}%`, 14, 84);
      doc.text(`Outstanding Fine: PKR ${st.outstanding}`, 14, 92);

      doc.text("Fine Rates:", 14, 110);
      doc.text(`Absent: PKR ${fineRates.A}`, 14, 118);
      doc.text(`Late: PKR ${fineRates.Lt}`, 14, 126);
      doc.text(`Leave: PKR ${fineRates.L}`, 14, 134);
      doc.text(`Half-Day: PKR ${fineRates.HD}`, 14, 142);
      doc.text(`Eligibility %: ${eligibilityPct}%`, 14, 158);

      doc.text("HOD Signature: ______________", 14, 180);
      doc.text(`Generated on ${today}`, 14, 200);
    });

    const fileName = `analytics_individual_${lastAnalyticsRange.from}_to_${lastAnalyticsRange.to}.pdf`;
    const blob = doc.output("blob");
    doc.save(fileName);
    await sharePdf(blob, fileName, "Attendance Analytics (Individual Receipts)");
  }
};

shareAnalyticsBtn.onclick = () => {
  if (!lastAnalyticsShare) {
    alert("Load analytics first");
    return;
  }
  window.open(
    `https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`,
    "_blank"
  );
};

// -------------------------------------------------------------------------------------------------
// 13) ATTENDANCE REGISTER SECTION
// -------------------------------------------------------------------------------------------------
const registerMonthInput         = $("registerMonth");
const loadRegisterBtn            = $("loadRegister");
const registerTableWrapper       = $("registerTableWrapper");
const registerHeaderRow          = $("registerHeader");
const registerBodyTbody          = $("registerBody");
const changeRegisterBtn          = $("changeRegister");
const saveRegisterBtn            = $("saveRegister");
const downloadRegisterBtn        = $("downloadRegister");
const shareRegisterBtn           = $("shareRegister");

loadRegisterBtn.onclick = () => {
  const m = registerMonthInput.value;
  if (!m) {
    alert("Pick month");
    return;
  }
  const dateKeys = Object.keys(attendanceData)
    .filter(d => d.startsWith(m + "-"))
    .sort();
  if (!dateKeys.length) {
    alert("No attendance marked this month.");
    return;
  }

  registerHeaderRow.innerHTML =
    `<th>#</th><th>Adm#</th><th>Name</th>` +
    dateKeys.map(k => `<th>${k.split("-")[2]}</th>`).join("");

  registerBodyTbody.innerHTML = "";
  students
    .filter(s => s.cls === teacherClass && s.sec === teacherSection)
    .forEach((s, i) => {
      let row = `<td>${i + 1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      dateKeys.forEach(key => {
        const c = attendanceData[key][s.adm] || "";
        const color =
          c === "P"
            ? "#4caf50"
            : c === "Lt"
            ? "#ff9800"
            : c === "ff9800"
            ? "#ff9800"
            : c === "L"
            ? "#03a9f4"
            : "#f44336";
        const style = c ? `style="background:${color};color:#fff"` : "";
        row += `<td class="reg-cell" ${style}><span class="status-text">${c}</span></td>`;
      });
      const tr = document.createElement("tr");
      tr.innerHTML = row;
      registerBodyTbody.appendChild(tr);
    });

  registerTableWrapper.classList.remove("hidden");
  saveRegisterBtn.classList.remove("hidden");
  loadRegisterBtn.classList.add("hidden");
  changeRegisterBtn.classList.add("hidden");
  downloadRegisterBtn.classList.add("hidden");
  shareRegisterBtn.classList.add("hidden");
};

saveRegisterBtn.onclick = async () => {
  const m = registerMonthInput.value;
  const dateKeys = Object.keys(attendanceData)
    .filter(d => d.startsWith(m + "-"))
    .sort();
  Array.from(registerBodyTbody.children).forEach(tr => {
    const adm = tr.children[1].textContent;
    dateKeys.forEach((key, idx) => {
      const code = tr.children[3 + idx].querySelector(".status-text").textContent;
      if (code) {
        attendanceData[key] = attendanceData[key] || {};
        attendanceData[key][adm] = code;
      } else {
        if (attendanceData[key]) delete attendanceData[key][adm];
      }
    });
  });
  attendanceDataBySchool[currentSchool] = attendanceData;
  await idbSet("attendanceDataBySchool", attendanceDataBySchool);
  await syncToFirebase();
  saveRegisterBtn.classList.add("hidden");
  changeRegisterBtn.classList.remove("hidden");
  downloadRegisterBtn.classList.remove("hidden");
  shareRegisterBtn.classList.remove("hidden");
  bindRegisterActions();
  updateCounters();
};

changeRegisterBtn.onclick = () => {
  registerTableWrapper.classList.add("hidden");
  changeRegisterBtn.classList.add("hidden");
  downloadRegisterBtn.classList.add("hidden");
  shareRegisterBtn.classList.add("hidden");
  saveRegisterBtn.classList.add("hidden");
  loadRegisterBtn.classList.remove("hidden");
  registerHeaderRow.innerHTML = "";
  registerBodyTbody.innerHTML = "";
};

function bindRegisterActions() {
  downloadRegisterBtn.onclick = async () => {
    const doc = new jspdf.jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split("T")[0];
    doc.setFontSize(18);
    doc.text("Attendance Register", 14, 20);
    doc.setFontSize(10);
    doc.text(`Date: ${today}`, pageWidth - 14, 20, { align: "right" });
    doc.setFontSize(12);
    doc.text(
      `${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`,
      14,
      36
    );
    doc.autoTable({
      startY: 60,
      html: "#registerTable",
      tableWidth: "auto",
      styles: { fontSize: 10 }
    });
    const blob = doc.output("blob");
    doc.save("attendance_register.pdf");
    await sharePdf(blob, "attendance_register.pdf", "Attendance Register");
  };

  shareRegisterBtn.onclick = () => {
    const header = `Attendance Register\n${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`;
    const rows = Array.from(registerBodyTbody.children).map(tr =>
      Array.from(tr.children)
        .map(td => td.querySelector(".status-text")?.textContent || td.textContent)
        .join(" ")
    );
    window.open(
      `https://wa.me/?text=${encodeURIComponent(header + "\n" + rows.join("\n"))}`,
      "_blank"
    );
  };
}

// -------------------------------------------------------------------------------------------------
// 14) BACKUP / RESTORE / RESET SECTION (Folder Picker, Import JSON, Factory Reset)
// -------------------------------------------------------------------------------------------------
const chooseBackupFolderBtn = $("chooseBackupFolder");
const restoreDataBtn        = $("restoreData");
const restoreFileInput      = $("restoreFile");
const resetDataBtn          = $("resetData");

let backupFolderHandle = null;

// Request permission to pick a backup folder
chooseBackupFolderBtn.onclick = async () => {
  try {
    backupFolderHandle = await window.showDirectoryPicker();
    alert("Backup folder selected.");
  } catch (err) {
    console.error("Folder picker canceled or not allowed:", err);
  }
};

// RESTORE from selected JSON file
restoreDataBtn.onclick = async () => {
  const fileList = restoreFileInput.files;
  if (!fileList.length) {
    alert("Select a JSON backup file first.");
    return;
  }
  const file = fileList[0];
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Overwrite all IndexedDB keys with data from JSON
    await idbSet("studentsBySchool",       data.studentsBySchool || {});
    await idbSet("attendanceDataBySchool", data.attendanceDataBySchool || {});
    await idbSet("paymentsDataBySchool",   data.paymentsDataBySchool || {});
    await idbSet("lastAdmNoBySchool",      data.lastAdmNoBySchool || {});
    await idbSet("fineRates",              data.fineRates || {});
    await idbSet("eligibilityPct",         data.eligibilityPct || 75);
    await idbSet("schools",                data.schools || []);
    await idbSet("currentSchool",          data.currentSchool || null);
    await idbSet("teacherClass",           data.teacherClass || null);
    await idbSet("teacherSection",         data.teacherSection || null);

    // If backup folder is chosen, also write this JSON there
    if (backupFolderHandle) {
      const newFile = await backupFolderHandle.getFileHandle("backup.json", { create: true });
      const writable = await newFile.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
    }

    alert("Data restored from backup. Reloading...");
    window.location.reload();
  } catch (err) {
    alert("Restore failed: " + err);
    console.error(err);
  }
};

// FACTORY RESET (clears all IndexedDB and Firebase data)
resetDataBtn.onclick = async () => {
  if (!confirm("Really erase all data? This cannot be undone.")) return;
  // Clear IndexedDB
  await idbClear();
  // Clear Firebase
  await dbSet(dbRef(database, "appData"), null);
  alert("All data erased. Reloading...");
  window.location.reload();
};

// -------------------------------------------------------------------------------------------------
// UTILITY: Generate Admission Number for Students
// -------------------------------------------------------------------------------------------------
async function genAdmNo() {
  lastAdmNo++;
  lastAdmNoBySchool[currentSchool] = lastAdmNo;
  await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
  await syncToFirebase();
  return String(lastAdmNo).padStart(4, "0");
}

// -------------------------------------------------------------------------------------------------
// 15) LOGIN / REGISTER FORM HANDLERS
// -------------------------------------------------------------------------------------------------
function setupLoginFormHandlers() {
  const loginForm       = $("loginForm");
  const registerForm    = $("registerForm");
  const loginEmail      = $("loginEmail");
  const loginPassword   = $("loginPassword");
  const regEmail        = $("regEmail");
  const regPassword     = $("regPassword");
  const regRole         = $("regRole");
  const regSchool       = $("regSchool");
  const regClass        = $("regClass");
  const regSection      = $("regSection");

  // Show login by default
  $("showLogin").onclick = () => {
    loginForm.style.display    = "flex";
    registerForm.style.display = "none";
  };
  $("showRegister").onclick = () => {
    loginForm.style.display    = "none";
    registerForm.style.display = "flex";
  };

  // When “Role” changes in Register, show/hide related fields
  regRole.addEventListener("change", () => {
    const role = regRole.value;
    if (role === "admin") {
      regSchool.style.display  = "none";
      regClass.style.display   = "none";
      regSection.style.display = "none";
    } else if (role === "principal") {
      regSchool.style.display  = "block";
      regClass.style.display   = "none";
      regSection.style.display = "none";
      loadAllSchoolsInto(regSchool);
    } else if (role === "teacher") {
      regSchool.style.display  = "block";
      regClass.style.display   = "block";
      regSection.style.display = "block";
      loadAllSchoolsInto(regSchool);
      populateClassDropdown(regClass);
    }
  });

  // LOGIN SUBMIT
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email    = loginEmail.value.trim();
    const password = loginPassword.value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will take care of showing/hiding UI
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  });

  // REGISTER SUBMIT
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email    = regEmail.value.trim();
    const password = regPassword.value;
    const role     = regRole.value;
    if (!role) {
      alert("Please pick a role.");
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid  = cred.user.uid;
      let profile = { email, role };
      if (role === "principal") {
        profile.assignedSchools = {};
        profile.assignedSchools[regSchool.value] = true;
      } else if (role === "teacher") {
        profile.assignedSchool  = regSchool.value;
        profile.assignedClass   = regClass.value;
        profile.assignedSection = regSection.value;
      }
      await dbSet(dbRef(database, `users/${uid}`), profile);
      alert("Registration successful! Please login.");
      loginForm.style.display    = "flex";
      registerForm.style.display = "none";
    } catch (err) {
      alert("Registration failed: " + err.message);
    }
  });
}

// Helper: load all school names into a dropdown (used in Register for principal/teacher)
async function loadAllSchoolsInto(selectElement) {
  const appDataSnap = await dbGet(dbRef(database, "appData/schools"));
  selectElement.innerHTML = `<option disabled selected>-- Select School --</option>`;
  if (appDataSnap.exists()) {
    const schoolList = appDataSnap.val();
    schoolList.forEach(sch => {
      const opt = document.createElement("option");
      opt.value = sch;
      opt.textContent = sch;
      selectElement.appendChild(opt);
    });
  }
}

function populateClassDropdown(classSelect) {
  const classOptions = [
    "Play Group", "Nursery", "KG",
    "Class One", "Class Two", "Class Three",
    "Class Four", "Class Five", "Class Six",
    "Class Seven", "Class Eight", "Class Nine",
    "Class Ten"
  ];
  classSelect.innerHTML = `<option disabled selected>-- Select Class --</option>`;
  classOptions.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    classSelect.appendChild(opt);
  });
}

// -------------------------------------------------------------------------------------------------
// 16) DOMContentLoaded: TIE IT ALL TOGETHER (login gating + setup + rest of app)
// -------------------------------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // Not signed in → show login screen, hide mainApp
      $("authScreen").style.display = "flex";
      $("mainApp").style.display   = "none";
      return;
    }
    // User is signed in → hide login, show mainApp
    $("authScreen").style.display = "none";
    $("mainApp").style.display   = "block";

    // NOW that the mainApp UI is in the DOM, wire up any elements that need to exist first:
    // e.g., all the const … = $("…") lines above will have valid references

    // Load IndexedDB → initialize variables → show/hide sections appropriately
    await initLocalState();
    resetViews();
    await loadSetup();
  });

  setupLoginFormHandlers();

  // Also, immediately call these so that any “default” UI is in place:
  setupCounters();
  loadFinancialSettings();
});

// -------------------------------------------------------------------------------------------------
// 17) CSS SNIPPET (make sure this is in your style.css or a <style> block!):
// -------------------------------------------------------------------------------------------------
/*
.att-btn {
  margin: 0.25em;
  padding: 0.4em 0.8em;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  background: #ddd;
  color: #333;
}
.att-btn.selected {
  color: #fff !important;
}
.attendance-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 0.5em;
}
.attendance-header {
  flex: 0 0 200px;
  font-weight: bold;
}
.attendance-buttons {
  flex: 1;
}
*/
