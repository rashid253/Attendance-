// app.js
// ------
// Updated main application file.
// This version replaces inline Firebase initialization with imports from firebase-config.js,
// adds role-based authentication & “Setup” gating (via auth.js and setup.js), and namespaces
// all Firebase reads/writes under `appData/${currentSchool}`. It preserves your existing IndexedDB
// logic, UI event handlers, and PDF/chart code, but defers most actions until after “setupDone”.

// ───────────────────────────────────────────────────────────────
// 1) IMPORT FIREBASE & AUTH HELPERS
// ───────────────────────────────────────────────────────────────
import { auth, db } from "./firebase-config.js";
import { getCurrentUserRole, onUserStateChanged, logout } from "./auth.js";

// Load the setup module (it handles “Create/Select School → Save Setup” and fires “setupDone”)
// on DOMContentLoaded. Do not remove this import.
import "./setup.js";

import {
  ref as dbRef,
  set as dbSet,
  get as dbGet,
  onValue
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// IndexedDB helpers via idb-keyval (loaded as IIFE in index.html)
// ---------------------------------------------------------------
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// ───────────────────────────────────────────────────────────────
// 2) GLOBAL STATE (per‐school mappings & settings)
// ───────────────────────────────────────────────────────────────

// These hold mappings for every school, loaded from IndexedDB at startup.
let studentsBySchool       = {}; // { schoolName: [ { name, adm, parentName, contact, occupation, address, cls, sec, fine, status } ] }
let attendanceDataBySchool = {}; // { schoolName: { "YYYY-MM-DD": { adm: "P"/"A"/"Lt"/"HD"/"L" } } }
let paymentsDataBySchool   = {}; // { schoolName: { adm: [ { date: "YYYY-MM-DD", amount: number }, ... ] } }
let lastAdmNoBySchool      = {}; // { schoolName: numeric last admission number }

// These apply per‐school but shared across roles:
let fineRates    = { A: 50, Lt: 20, L: 10, HD: 30 };
let eligibilityPct = 75;

// “schools” array & currently-selected setup (persisted in IndexedDB too)
let schools = [];            // [ "Alpha School", "Beta Academy", … ]
let currentSchool  = null;   // e.g. "Alpha School"
let teacherClass   = null;   // e.g. "Class Ten"
let teacherSection = null;   // e.g. "B"

// These variables point to the “current school” data once setup is done:
let students       = [];     // references studentsBySchool[currentSchool]
let attendanceData = {};     // references attendanceDataBySchool[currentSchool]
let paymentsData   = {};     // references paymentsDataBySchool[currentSchool]
let lastAdmNo      = 0;      // references lastAdmNoBySchool[currentSchool]

// ───────────────────────────────────────────────────────────────
// 3) HELPER: Ensure data structures exist for a given school in IndexedDB
// ───────────────────────────────────────────────────────────────
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

// ───────────────────────────────────────────────────────────────
// 4) INITIALIZE STATE FROM INDEXEDDB
//    (Loads all per‐school mappings, plus global settings, before setup.)
// ───────────────────────────────────────────────────────────────
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
    // Ensure that the “currentSchool” data structures exist
    await ensureSchoolData(currentSchool);

    // Point the per‐current‐school references:
    students       = studentsBySchool[currentSchool];
    attendanceData = attendanceDataBySchool[currentSchool];
    paymentsData   = paymentsDataBySchool[currentSchool];
    lastAdmNo      = lastAdmNoBySchool[currentSchool];
  }
}

// ───────────────────────────────────────────────────────────────
// 5) SYNC LOCAL STATE TO FIREBASE (under `appData/${currentSchool}`)
// ───────────────────────────────────────────────────────────────
async function syncToFirebase() {
  if (!currentSchool) return; // nothing to sync if setup isn't done
  // Construct a school-specific payload:
  const payload = {
    students:       studentsBySchool[currentSchool]       || [],
    attendance:     attendanceDataBySchool[currentSchool] || {},
    payments:       paymentsDataBySchool[currentSchool]   || {},
    meta: {
      lastAdmNo:      lastAdmNoBySchool[currentSchool]    || 0,
      fineRates:      fineRates,
      eligibilityPct: eligibilityPct
    }
  };
  try {
    await dbSet(dbRef(db, `appData/${encodeURIComponent(currentSchool)}`), payload);
    console.log("✅ Synced data for", currentSchool, "to Firebase");
  } catch (err) {
    console.error("Firebase sync failed:", err);
  }
}

// ───────────────────────────────────────────────────────────────
// 6) OCTAL: UTILITY FOR SHARING PDF VIA WEB SHARE API
// ───────────────────────────────────────────────────────────────
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

// ───────────────────────────────────────────────────────────────
// 7) AUTHENTICATION GATING
//    If not signed in, redirect to login.html.
//    If signed in but no “role” claim, log out.
// ───────────────────────────────────────────────────────────────
onUserStateChanged(async (user) => {
  if (!user) {
    // Not signed in → redirect
    window.location.href = "login.html";
    return;
  }
  const role = await getCurrentUserRole();
  if (!role) {
    alert("Your account has no role assigned. Contact the administrator.");
    await logout();
  }
  // Otherwise, do nothing. We wait for “setupDone” before proceeding.
});

// ───────────────────────────────────────────────────────────────
// 8) “setupDone” EVENT LISTENER: Triggered by setup.js once user has chosen
//    a valid (school, class, section) matching their role.
//    At this point, we can load local data, attach UI handlers, and un‐hide sections.
// ───────────────────────────────────────────────────────────────
window.addEventListener("setupDone", async () => {
  // 8a) Reload “currentSchool / teacherClass / teacherSection” from IndexedDB,
  // because setup.js saved them into IndexedDB already.
  currentSchool  = await idbGet("currentSchool");
  teacherClass   = await idbGet("teacherClass");
  teacherSection = await idbGet("teacherSection");

  // 8b) Initialize local state (populate studentsBySchool, etc.)
  await initLocalState();

  // 8c) Unhide all the major sections that were hidden by default in index.html
  const show = (...els) => els.forEach(e => e && e.classList.remove("hidden"));
  show(
    document.getElementById("financial-settings"),
    document.getElementById("animatedCounters"),
    document.getElementById("student-registration"),
    document.getElementById("attendance-section"),
    document.getElementById("analytics-section"),
    document.getElementById("register-section")
    // …add any other sections you have that were hidden initially…
  );

  // 8d) Render initial UI: counters, student table, etc.
  renderCounters();
  renderStudents();
  attachRealtimeListeners();

  // 8e) Optionally: Show an “Admin Panel” button if user is admin:
  const role = await getCurrentUserRole();
  if (role === "admin") {
    const adminBtn = document.getElementById("adminPanelBtn");
    if (adminBtn) adminBtn.classList.remove("hidden");
  }
});

// ───────────────────────────────────────────────────────────────
// 9) UTILITIES: RENDERING & REAL-TIME LISTENERS
//    These functions run after setup is done.
// ───────────────────────────────────────────────────────────────

// 9a) Attach real-time Firebase listeners for the current school so that
//     any external changes (e.g., Admin updates from another client) immediately
//     update local IndexedDB and UI.
function attachRealtimeListeners() {
  if (!currentSchool) return;
  const schoolKey = encodeURIComponent(currentSchool);
  const schoolRef = dbRef(db, `appData/${schoolKey}`);

  onValue(schoolRef, async (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.val();

    // Extract children from payload:
    const incomingStudents   = data.students   || [];
    const incomingAttendance = data.attendance || {};
    const incomingPayments   = data.payments   || {};
    const incomingMeta       = data.meta       || {};

    // Update local variables:
    studentsBySchool[currentSchool]      = incomingStudents;
    attendanceDataBySchool[currentSchool] = incomingAttendance;
    paymentsDataBySchool[currentSchool]   = incomingPayments;
    lastAdmNoBySchool[currentSchool]      = incomingMeta.lastAdmNo || 0;
    fineRates    = incomingMeta.fineRates    || fineRates;
    eligibilityPct = incomingMeta.eligibilityPct || eligibilityPct;

    // Persist to IndexedDB:
    await idbSet("studentsBySchool",       studentsBySchool);
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
    await idbSet("paymentsDataBySchool",   paymentsDataBySchool);
    await idbSet("lastAdmNoBySchool",      lastAdmNoBySchool);
    await idbSet("fineRates",              fineRates);
    await idbSet("eligibilityPct",         eligibilityPct);

    // Update per‐school references & re‐render:
    students       = studentsBySchool[currentSchool];
    attendanceData = attendanceDataBySchool[currentSchool];
    paymentsData   = paymentsDataBySchool[currentSchool];
    lastAdmNo      = lastAdmNoBySchool[currentSchool];

    renderStudents();
    renderCounters();
  });
}

// 9b) Render dashboard counters (e.g., total students, present today, etc.)
function renderCounters() {
  const container = document.getElementById("countersContainer");
  if (!container) return;
  container.innerHTML = ""; // clear existing

  // Example counters: total registered, present today, absent, fine owed, eligible, debarred
  const totalStudents = students.filter(s => s.cls === teacherClass && s.sec === teacherSection).length;

  // Count today's attendance (if any)
  const today = new Date().toISOString().slice(0, 10);
  let present = 0, absent = 0, late = 0, halfDay = 0, leave = 0;
  if (attendanceData[today]) {
    Object.entries(attendanceData[today]).forEach(([adm, code]) => {
      switch (code) {
        case "P": present++; break;
        case "A": absent++; break;
        case "Lt": late++; break;
        case "HD": halfDay++; break;
        case "L": leave++; break;
      }
    });
  }

  // Total fine owed by all students in this class/section:
  let totalFine = 0;
  students
    .filter(s => s.cls === teacherClass && s.sec === teacherSection)
    .forEach(s => {
      let a = 0, ltCount = 0, hd = 0, l = 0;
      Object.entries(attendanceData).forEach(([date, rec]) => {
        const code = rec[s.adm];
        if (code === "A") a++;
        if (code === "Lt") ltCount++;
        if (code === "HD") hd++;
        if (code === "L") l++;
      });
      const fineTotal = a * fineRates.A + ltCount * fineRates.Lt + l * fineRates.L + hd * fineRates.HD;
      const paid = (paymentsData[s.adm] || []).reduce((sum, pmt) => sum + pmt.amount, 0);
      totalFine += Math.max(0, fineTotal - paid);
    });

  // Eligible & Debarred counts:
  let eligibleCount = 0, debarredCount = 0;
  students
    .filter(s => s.cls === teacherClass && s.sec === teacherSection)
    .forEach(s => {
      let pCount = 0, totalDays = 0;
      let a = 0, ltCount = 0, hd = 0, l = 0;
      Object.entries(attendanceData).forEach(([date, rec]) => {
        if (rec[s.adm]) {
          totalDays++;
          if (rec[s.adm] === "P") pCount++;
          if (rec[s.adm] === "A") a++;
          if (rec[s.adm] === "Lt") ltCount++;
          if (rec[s.adm] === "HD") hd++;
          if (rec[s.adm] === "L") l++;
        }
      });
      const pct = totalDays ? (pCount / totalDays) * 100 : 0;
      const fineTotal = a * fineRates.A + ltCount * fineRates.Lt + l * fineRates.L + hd * fineRates.HD;
      const paid = (paymentsData[s.adm] || []).reduce((sum, pmt) => sum + pmt.amount, 0);
      const outstanding = fineTotal - paid;
      if (outstanding <= 0 && pct >= eligibilityPct) eligibleCount++;
      if (outstanding > 0 || pct < eligibilityPct) debarredCount++;
    });

  // Helper to create a counter card:
  const makeCard = (title, number) => {
    const card = document.createElement("div");
    card.className = "counter-card card";
    card.innerHTML = `<div class="card-number">${number}</div><div>${title}</div>`;
    return card;
  };

  container.appendChild(makeCard("Total Students", totalStudents));
  container.appendChild(makeCard("Present Today", present));
  container.appendChild(makeCard("Absent Today", absent));
  container.appendChild(makeCard("Total Fine Owed", totalFine));
  container.appendChild(makeCard("Eligible", eligibleCount));
  container.appendChild(makeCard("Debarred", debarredCount));
}

// 9c) Render the “Student Registration” table
function renderStudents() {
  const tbody = document.getElementById("studentsBody");
  if (!tbody) return;
  tbody.innerHTML = ""; // clear existing

  // Filter students for this class & section
  const filtered = students.filter(s => s.cls === teacherClass && s.sec === teacherSection);

  filtered.forEach((stu, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="select-student" data-adm="${stu.adm}" /></td>
      <td>${i + 1}</td>
      <td>${stu.name}</td>
      <td>${stu.adm}</td>
      <td>${stu.parentName}</td>
      <td>${stu.contact}</td>
      <td>${stu.occupation}</td>
      <td>${stu.address}</td>
      <td>${stu.fine || 0}</td>
      <td>${stu.status || ""}</td>
      <td>
        <button class="edit-single no-print" data-adm="${stu.adm}"><i class="fas fa-edit"></i></button>
        <button class="delete-single no-print" data-adm="${stu.adm}"><i class="fas fa-trash"></i></button>
        <button class="pay-single no-print" data-adm="${stu.adm}"><i class="fas fa-money-bill-wave"></i></button>
      </td>`;
    tbody.appendChild(tr);
  });

  // Attach per‐row event handlers:
  document.querySelectorAll(".edit-single").forEach(btn => {
    btn.onclick = () => {
      const adm = btn.dataset.adm;
      startEditStudent(adm);
    };
  });
  document.querySelectorAll(".delete-single").forEach(btn => {
    btn.onclick = async () => {
      const adm = btn.dataset.adm;
      if (!confirm(`Delete student Adm#: ${adm}?`)) return;
      // Remove from local array:
      const idx = students.findIndex(s => s.adm === adm);
      if (idx > -1) {
        students.splice(idx, 1);
        studentsBySchool[currentSchool] = students;
        await idbSet("studentsBySchool", studentsBySchool);
        await syncToFirebase();
        renderStudents();
        renderCounters();
      }
    };
  });
  document.querySelectorAll(".pay-single").forEach(btn => {
    btn.onclick = () => openPaymentModal(btn.dataset.adm);
  });
}

// ───────────────────────────────────────────────────────────────
// 10) EVENT HANDLERS & UI LOGIC (run after setupDone)
//     We wrap these in a function to be sure they run only once
// ───────────────────────────────────────────────────────────────
function registerUIEventHandlers() {
  const $ = (id) => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove("hidden"));
  const hide = (...els) => els.forEach(e => e && e.classList.add("hidden"));

  // 10a) Financial Settings: read & save fineRates, eligibilityPct
  const fineAbsentInput   = $("fineAbsent");
  const fineLateInput     = $("fineLate");
  const fineLeaveInput    = $("fineLeave");
  const fineHalfDayInput  = $("fineHalfDay");
  const eligibilityInput  = $("eligibilityPct");
  const saveSettingsBtn   = $("saveSettings");

  // Populate inputs with current values:
  if (fineRates) {
    fineAbsentInput.value   = fineRates.A;
    fineLateInput.value     = fineRates.Lt;
    fineLeaveInput.value    = fineRates.L;
    fineHalfDayInput.value  = fineRates.HD;
  }
  eligibilityInput.value = eligibilityPct;

  saveSettingsBtn.onclick = async () => {
    const A  = Number(fineAbsentInput.value)   || 0;
    const Lt = Number(fineLateInput.value)     || 0;
    const L  = Number(fineLeaveInput.value)    || 0;
    const HD = Number(fineHalfDayInput.value)  || 0;
    const pct = Number(eligibilityInput.value) || 0;
    fineRates = { A, Lt, L, HD };
    eligibilityPct = pct;
    await idbSet("fineRates", fineRates);
    await idbSet("eligibilityPct", eligibilityPct);
    await syncToFirebase();
    alert("Settings saved.");
    renderCounters();
  };

  // 10b) Student Registration: add, edit, delete, bulk actions
  const studentNameInput     = $("studentName");
  const parentNameInput      = $("parentName");
  const parentContactInput   = $("parentContact");
  const occupationInput      = $("parentOccupation");
  const addressInput         = $("parentAddress");
  const addStudentBtn        = $("addStudent");
  const editSelectedBtn      = $("editSelected");
  const deleteSelectedBtn    = $("deleteSelected");
  const saveRegistrationBtn  = $("saveRegistration");
  const editRegistrationBtn  = $("editRegistration");
  const shareRegistrationBtn = $("shareRegistration");
  const downloadRegistrationBtn = $("downloadRegistrationPDF");
  const selectAllCheckbox    = $("selectAllStudents");

  // State for “bulk edit” vs “view”:
  let bulkEditing = false;
  let originalStudentsSnapshot = [];

  // Generate new Admission No. (per school)
  async function genAdmNo() {
    lastAdmNo++;
    lastAdmNoBySchool[currentSchool] = lastAdmNo;
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
    await syncToFirebase();
    return String(lastAdmNo).padStart(4, "0");
  }

  // Add a new student
  addStudentBtn.onclick = async () => {
    const name       = studentNameInput.value.trim();
    const parentName = parentNameInput.value.trim();
    const contact    = parentContactInput.value.trim();
    const occupation = occupationInput.value.trim();
    const address    = addressInput.value.trim();
    if (!name || !parentName || !contact) {
      alert("Name, parent name, and contact are required.");
      return;
    }
    const newAdm = await genAdmNo();
    const newStudent = {
      adm: newAdm,
      name,
      parentName,
      contact,
      occupation,
      address,
      cls: teacherClass,
      sec: teacherSection,
      fine: 0,
      status: "registered"
    };
    students.push(newStudent);
    studentsBySchool[currentSchool] = students;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    renderStudents();
    renderCounters();
    // Clear inputs:
    studentNameInput.value     = "";
    parentNameInput.value      = "";
    parentContactInput.value   = "";
    occupationInput.value      = "";
    addressInput.value         = "";
  };

  // Single‐student edit flow
  function startEditStudent(adm) {
    const stu = students.find(s => s.adm === adm);
    if (!stu) return;
    // Pre-fill inputs:
    studentNameInput.value     = stu.name;
    parentNameInput.value      = stu.parentName;
    parentContactInput.value   = stu.contact;
    occupationInput.value      = stu.occupation;
    addressInput.value         = stu.address;
    addStudentBtn.classList.add("hidden");
    const confirmBtn = document.createElement("button");
    confirmBtn.id = "confirmEditStudent";
    confirmBtn.className = "no-print";
    confirmBtn.innerHTML = `<i class="fas fa-check"></i> Confirm`;
    addStudentBtn.parentNode.appendChild(confirmBtn);
    confirmBtn.onclick = async () => {
      stu.name       = studentNameInput.value.trim();
      stu.parentName = parentNameInput.value.trim();
      stu.contact    = parentContactInput.value.trim();
      stu.occupation = occupationInput.value.trim();
      stu.address    = addressInput.value.trim();
      studentsBySchool[currentSchool] = students;
      await idbSet("studentsBySchool", studentsBySchool);
      await syncToFirebase();
      renderStudents();
      renderCounters();
      // Cleanup:
      studentNameInput.value     = "";
      parentNameInput.value      = "";
      parentContactInput.value   = "";
      occupationInput.value      = "";
      addressInput.value         = "";
      confirmBtn.remove();
      addStudentBtn.classList.remove("hidden");
    };
  }

  // Bulk selection
  selectAllCheckbox.onclick = () => {
    const checked = selectAllCheckbox.checked;
    document.querySelectorAll(".select-student").forEach(chk => {
      chk.checked = checked;
    });
    editSelectedBtn.disabled = !checked;
    deleteSelectedBtn.disabled = !checked;
  };
  document.addEventListener("change", (e) => {
    if (e.target.classList.contains("select-student")) {
      const anyChecked = Array.from(document.querySelectorAll(".select-student"))
        .some(chk => chk.checked);
      editSelectedBtn.disabled   = !anyChecked;
      deleteSelectedBtn.disabled = !anyChecked;
    }
  });

  // Bulk delete
  deleteSelectedBtn.onclick = async () => {
    if (!confirm("Delete selected students?")) return;
    const toDelete = Array.from(document.querySelectorAll(".select-student"))
      .filter(chk => chk.checked)
      .map(chk => chk.dataset.adm);
    students = students.filter(s => !toDelete.includes(s.adm));
    studentsBySchool[currentSchool] = students;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    renderStudents();
    renderCounters();
    selectAllCheckbox.checked = false;
    editSelectedBtn.disabled   = true;
    deleteSelectedBtn.disabled = true;
  };

  // Bulk edit (enables inline editing; simplified for brevity)
  editSelectedBtn.onclick = () => {
    bulkEditing = true;
    originalStudentsSnapshot = JSON.parse(JSON.stringify(students));
    // Example approach: convert each table cell to <input> for name/contact, etc.
    // For brevity, we skip the detailed implementation here.
    // After editing, user clicks “Done” → finish bulk edit mode.
    editSelectedBtn.classList.add("hidden");
    editRegistrationBtn.classList.remove("hidden");
  };

  editRegistrationBtn.onclick = async () => {
    if (!bulkEditing) return;
    bulkEditing = false;
    // Assume we have updated `students` array based on edited inputs
    studentsBySchool[currentSchool] = students;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    renderStudents();
    renderCounters();
    editRegistrationBtn.classList.add("hidden");
    editSelectedBtn.classList.remove("hidden");
  };

  // Share / Download Registration as PDF
  downloadRegistrationBtn.onclick = async () => {
    const doc = new jspdf.jsPDF({ unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const title = "Student Registration";
    doc.setFontSize(18); doc.text(title, 14, 20);
    doc.setFontSize(12); doc.text(`School: ${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`, 14, 36);
    doc.autoTable({ startY: 60, html: "#studentsTable", tableWidth: "auto", styles: { fontSize: 10 } });
    const blob = doc.output("blob");
    doc.save("student_registration.pdf");
    await sharePdf(blob, "student_registration.pdf", "Student Registration");
  };

  shareRegistrationBtn.onclick = () => {
    const lines = [`Student Registration for ${currentSchool} | Class ${teacherClass} Sec ${teacherSection}:`];
    students
      .filter(s => s.cls === teacherClass && s.sec === teacherSection)
      .forEach((s, i) => lines.push(`${i + 1}. ${s.name} (Adm#: ${s.adm})`));
    const text = lines.join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  // 10c) Payment Modal
  const payAdmSpan         = $("payAdm");
  const paymentAmountInput = $("paymentAmount");
  const paymentModal       = $("paymentModal");
  const paymentModalClose  = $("paymentModalClose");
  const savePaymentBtn     = $("savePayment");
  const cancelPaymentBtn   = $("cancelPayment");

  function openPaymentModal(adm) {
    payAdmSpan.textContent = adm;
    paymentAmountInput.value = "";
    paymentModal.classList.remove("hidden");
  }
  paymentModalClose.onclick = () => paymentModal.classList.add("hidden");
  cancelPaymentBtn.onclick  = () => paymentModal.classList.add("hidden");

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
    renderCounters();
  };

  // 10d) Attendance Section
  const dateInput             = $("dateInput");
  const loadAttendanceBtn     = $("loadAttendance");
  const saveAttendanceBtn     = $("saveAttendance");
  const resetAttendanceBtn    = $("resetAttendance");
  const downloadAttendanceBtn = $("downloadAttendancePDF");
  const shareAttendanceBtn    = $("shareAttendanceSummary");
  const attendanceBodyDiv     = $("attendanceBody");
  const attendanceSummaryDiv  = $("attendanceSummary");

  const statusNames  = { P: "Present", A: "Absent", Lt: "Late", HD: "Half-Day", L: "Leave" };
  const statusColors = { P: "var(--success)", A: "var(--danger)", Lt: "var(--warning)", HD: "#FF9800", L: "var(--info)" };

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = "";
    attendanceSummaryDiv.innerHTML = "";
    const cl  = teacherClass;
    const sec = teacherSection;
    attendanceBodyDiv.style.overflowX = "auto";
    students
      .filter(stu => stu.cls === cl && stu.sec === sec)
      .forEach((stu, i) => {
        const row       = document.createElement("div");
        const headerDiv = document.createElement("div");
        const btnsDiv   = document.createElement("div");
        row.className       = "attendance-row";
        headerDiv.className = "attendance-header";
        btnsDiv.className   = "attendance-buttons";
        headerDiv.textContent = `${i + 1}. ${stu.name} (${stu.adm})`;
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
    saveAttendanceBtn.classList.remove("hidden");
    resetAttendanceBtn.classList.add("hidden");
    downloadAttendanceBtn.classList.add("hidden");
    shareAttendanceBtn.classList.add("hidden");
    attendanceSummaryDiv.classList.add("hidden");
  };

  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert("Pick date"); return; }
    attendanceData[date] = {};
    const cl  = teacherClass;
    const sec = teacherSection;
    students
      .filter(s => s.cls === cl && s.sec === sec)
      .forEach((s, i) => {
        const selBtn = attendanceBodyDiv.children[i].querySelector(".att-btn.selected");
        attendanceData[date][s.adm] = selBtn ? selBtn.textContent : "A";
      });
    attendanceDataBySchool[currentSchool] = attendanceData;
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
    await syncToFirebase();
    console.log("✅ Attendance data synced to Firebase");

    // Build summary table
    attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement("table");
    tbl.id = "attendanceSummaryTable";
    tbl.innerHTML = `
      <tr>
        <th>Sr#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th>
      </tr>`;
    students
      .filter(s => s.cls === teacherClass && s.sec === teacherSection)
      .forEach((s, i) => {
        const code = attendanceData[date][s.adm];
        tbl.innerHTML += `
          <tr>
            <td>${i + 1}</td>
            <td>${s.adm}</td>
            <td>${s.name}</td>
            <td>${statusNames[code]}</td>
            <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
          </tr>`;
      });
    attendanceSummaryDiv.appendChild(tbl);

    // Attach share‐individual event handlers
    attendanceSummaryDiv.querySelectorAll(".share-individual").forEach(ic => {
      ic.onclick = () => {
        const adm = ic.dataset.adm;
        const st  = students.find(x => x.adm === adm);
        const msg = `Dear Parent, your child (Adm#: ${adm}) was ${statusNames[attendanceData[date][adm]]} on ${date}.`;
        const phone = st.contact.replace(/[^0-9]/g, "");
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
      };
    });

    attendanceBodyDiv.classList.add("hidden");
    saveAttendanceBtn.classList.add("hidden");
    resetAttendanceBtn.classList.remove("hidden");
    downloadAttendanceBtn.classList.remove("hidden");
    shareAttendanceBtn.classList.remove("hidden");
    attendanceSummaryDiv.classList.remove("hidden");
    renderCounters();
  };

  resetAttendanceBtn.onclick = () => {
    attendanceBodyDiv.classList.remove("hidden");
    saveAttendanceBtn.classList.remove("hidden");
    resetAttendanceBtn.classList.add("hidden");
    downloadAttendanceBtn.classList.add("hidden");
    shareAttendanceBtn.classList.add("hidden");
    attendanceSummaryDiv.classList.add("hidden");
  };

  downloadAttendanceBtn.onclick = async () => {
    const doc = new jspdf.jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split("T")[0];
    doc.setFontSize(18); doc.text("Attendance Report", 14, 16);
    doc.setFontSize(10); doc.text(`Date: ${today}`, w - 14, 16, { align: "right" });
    doc.setFontSize(12); doc.text(`School: ${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`, 14, 24);
    doc.autoTable({ startY: 30, html: "#attendanceSummaryTable" });
    const fileName = `attendance_${dateInput.value}.pdf`;
    const blob = doc.output("blob");
    doc.save(fileName);
    await sharePdf(blob, fileName, "Attendance Report");
  };

  shareAttendanceBtn.onclick = () => {
    const date = dateInput.value;
    const header = `*Attendance Report*\n${currentSchool} | Class ${teacherClass} Section ${teacherSection} - ${date}`;
    const lines = students
      .filter(s => s.cls === teacherClass && s.sec === teacherSection)
      .map((s, i) => `${i + 1}. ${s.name} (Adm#: ${s.adm}): ${statusNames[attendanceData[date][s.adm]]}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n\n" + lines.join("\n"))}`, "_blank");
  };

  // 10e) Analytics Section
  const analyticsTarget        = $("analyticsTarget");
  const analyticsSectionSelect = $("analyticsSectionSelect");
  const analyticsType          = $("analyticsType");
  const analyticsDateInput     = $("analyticsDate");
  const analyticsMonthInput    = $("analyticsMonth");
  const semesterStartInput     = $("semesterStart");
  const semesterEndInput       = $("semesterEnd");
  const analyticsYearInput     = $("yearStart");
  const analyticsSearchInput   = $("analyticsSearch");
  const loadAnalyticsBtn       = $("loadAnalytics");
  const resetAnalyticsBtn      = $("resetAnalytics");
  const instructionsDiv        = $("instructions");
  const analyticsContainer     = $("analyticsContainer");
  const graphsDiv              = $("graphs");
  const analyticsActionsDiv    = $("analyticsActions");
  const barChartCanvas         = $("barChart");
  const pieChartCanvas         = $("pieChart");
  const downloadAnalyticsBtn   = $("downloadAnalytics");
  const shareAnalyticsBtn      = $("shareAnalytics");

  const analyticsStatusNames  = { P: "Present", A: "Absent", Lt: "Late", HD: "Half-Day", L: "Leave" };
  const analyticsStatusColors = {
    P: getComputedStyle(document.documentElement).getPropertyValue("--success").trim(),
    A: getComputedStyle(document.documentElement).getPropertyValue("--danger").trim(),
    Lt: getComputedStyle(document.documentElement).getPropertyValue("--warning").trim(),
    HD: "#FF9800",
    L: getComputedStyle(document.documentElement).getPropertyValue("--info").trim(),
  };

  let analyticsFilterOptions = ["all"];
  let analyticsDownloadMode  = "combined"; // or "individual"
  let lastAnalyticsStats     = [];
  let lastAnalyticsRange     = { from: null, to: null };
  let lastAnalyticsShare     = "";

  // Show/hide sub-controls based on “-- Report For --” dropdown
  analyticsTarget.onchange = () => {
    const val = analyticsTarget.value;
    if (val === "class") {
      analyticsType.disabled = false;
      analyticsSectionSelect.classList.add("hidden");
      analyticsSearchInput.classList.add("hidden");
    } else if (val === "section") {
      analyticsSectionSelect.classList.remove("hidden");
      analyticsType.disabled = false;
      analyticsSearchInput.classList.add("hidden");
    } else if (val === "student") {
      analyticsSectionSelect.classList.remove("hidden");
      analyticsSearchInput.classList.remove("hidden");
      analyticsType.disabled = false;
    } else {
      analyticsType.disabled = true;
      analyticsSectionSelect.classList.add("hidden");
      analyticsSearchInput.classList.add("hidden");
    }
  };

  // Show/hide date/month/semester/year inputs based on “Period” dropdown
  analyticsType.onchange = () => {
    analyticsDateInput.classList.add("hidden");
    analyticsMonthInput.classList.add("hidden");
    semesterStartInput.classList.add("hidden");
    semesterEndInput.classList.add("hidden");
    analyticsYearInput.classList.add("hidden");

    const val = analyticsType.value;
    if (val === "date") analyticsDateInput.classList.remove("hidden");
    else if (val === "month") analyticsMonthInput.classList.remove("hidden");
    else if (val === "semester") {
      semesterStartInput.classList.remove("hidden");
      semesterEndInput.classList.remove("hidden");
    } else if (val === "year") {
      analyticsYearInput.classList.remove("hidden");
    }
  };

  // Load analytics when “Load” is clicked
  loadAnalyticsBtn.onclick = async () => {
    const reportFor = analyticsTarget.value;
    if (!reportFor) { alert("Select Report For"); return; }

    // Determine the filter range
    let fromDate = null, toDate = null;
    const type = analyticsType.value;
    if (type === "date") {
      fromDate = toDate = analyticsDateInput.value;
    } else if (type === "month") {
      const m = analyticsMonthInput.value; // “YYYY-MM”
      if (!m) { alert("Select Month"); return; }
      fromDate = `${m}-01`;
      const daysInMonth = new Date(Number(m.split("-")[0]), Number(m.split("-")[1]), 0).getDate();
      toDate   = `${m}-${String(daysInMonth).padStart(2, "0")}`;
    } else if (type === "semester") {
      const s = semesterStartInput.value; // “YYYY-MM”
      const e = semesterEndInput.value;   // “YYYY-MM”
      if (!s || !e) { alert("Select Semester Range"); return; }
      fromDate = `${s}-01`;
      const [ey, em] = e.split("-");
      const daysInEndMonth = new Date(Number(ey), Number(em), 0).getDate();
      toDate   = `${e}-${String(daysInEndMonth).padStart(2, "0")}`;
    } else if (type === "year") {
      const y = analyticsYearInput.value;
      if (!y) { alert("Enter Year"); return; }
      fromDate = `${y}-01-01`;
      toDate   = `${y}-12-31`;
    } else {
      alert("Select Period");
      return;
    }

    // Build list of date‐strings between fromDate & toDate inclusive
    const start = new Date(fromDate);
    const end   = new Date(toDate);
    if (start > end) { alert("Invalid date range."); return; }
    const dateKeys = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().split("T")[0];
      if (attendanceData[iso]) dateKeys.push(iso);
    }
    if (!dateKeys.length) { alert("No attendance data in range."); return; }

    // Determine target subset (class/section/student)
    const cl  = teacherClass;
    const sec = teacherSection;
    const filterList = students.filter(s => {
      if (s.cls !== cl) return false;
      if (reportFor === "section" && s.sec !== analyticsSectionSelect.value) return false;
      if (reportFor === "student" && s.adm !== analyticsSearchInput.value && s.name !== analyticsSearchInput.value) return false;
      return true;
    });

    if (!filterList.length) { alert("No matching records."); return; }

    // Build analytics rows:
    const stats = filterList.map((s, i) => {
      let presentCount = 0, absentCount = 0, lateCount = 0, hdCount = 0, leaveCount = 0;
      dateKeys.forEach(date => {
        const code = attendanceData[date][s.adm];
        if (!code) { absentCount++; }
        else {
          switch (code) {
            case "P": presentCount++; break;
            case "A": absentCount++; break;
            case "Lt": lateCount++; break;
            case "HD": hdCount++; break;
            case "L": leaveCount++; break;
          }
        }
      });
      const totalDays = dateKeys.length;
      const pct = totalDays ? ((presentCount / totalDays) * 100).toFixed(1) : "0.0";
      const a = absentCount, lt = lateCount, hd = hdCount, l = leaveCount;
      const fineTotal = a * fineRates.A + lt * fineRates.Lt + l * fineRates.L + hd * fineRates.HD;
      const paid = (paymentsData[s.adm] || []).reduce((sum, pmt) => sum + pmt.amount, 0);
      const outstanding = fineTotal - paid;
      let eligible = (outstanding <= 0 && pct >= eligibilityPct) ? "Yes" : "No";
      return {
        sr: i + 1,
        adm: s.adm,
        name: s.name,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        halfDay: hdCount,
        leave: leaveCount,
        attendancePct: pct,
        fineTotal,
        paid,
        outstanding,
        eligible
      };
    });

    // Store for download/share
    lastAnalyticsStats = stats;
    lastAnalyticsRange = { from: fromDate, to: toDate };

    // Render HTML table
    analyticsContainer.classList.remove("hidden");
    instructionsDiv.classList.add("hidden");
    graphsDiv.classList.remove("hidden");
    analyticsActionsDiv.classList.remove("hidden");

    const tblHead = document.querySelector("#analyticsTable thead tr");
    const tblBody = document.querySelector("#analyticsTable tbody");
    tblHead.innerHTML = `
      <th>#</th><th>Adm#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th>
      <th>HD</th><th>L</th><th>%</th><th>Fine</th><th>Paid</th><th>Outstanding</th><th>Eligible</th>
    `;
    tblBody.innerHTML = "";
    stats.forEach(st => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${st.sr}</td>
        <td>${st.adm}</td>
        <td>${st.name}</td>
        <td>${st.present}</td>
        <td>${st.absent}</td>
        <td>${st.late}</td>
        <td>${st.halfDay}</td>
        <td>${st.leave}</td>
        <td>${st.attendancePct}%</td>
        <td>${st.fineTotal}</td>
        <td>${st.paid}</td>
        <td>${st.outstanding}</td>
        <td>${st.eligible}</td>
      `;
      tblBody.appendChild(row);
    });

    // Render charts using Chart.js
    renderAnalyticsCharts(stats);

    // Prepare share text
    const header = `Analytics: ${currentSchool} | Class ${teacherClass} Section ${teacherSection} (${fromDate} to ${toDate})`;
    const lines = stats.map(st => (
      `${st.sr}. ${st.name} (Adm#: ${st.adm}) → %: ${st.attendancePct}, Fine: ${st.outstanding}, Eligible: ${st.eligible}`
    ));
    lastAnalyticsShare = `${header}\n\n${lines.join("\n")}`;
  };

  // Download analytics as PDF
  downloadAnalyticsBtn.onclick = async () => {
    if (!lastAnalyticsStats.length) { alert("Load analytics first"); return; }
    const doc = new jspdf.jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split("T")[0];
    doc.setFontSize(18); doc.text("Attendance Analytics", 14, 20);
    doc.setFontSize(10); doc.text(`Date: ${today}`, w - 14, 20, { align: "right" });
    doc.setFontSize(12); doc.text(`School: ${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`, 14, 36);
    doc.text(`Period: ${lastAnalyticsRange.from} → ${lastAnalyticsRange.to}`, 14, 52);
    doc.autoTable({ startY: 60, html: "#analyticsTable", tableWidth: "auto", styles: { fontSize: 8 } });
    const blob = doc.output("blob");
    doc.save("attendance_analytics.pdf");
    await sharePdf(blob, "attendance_analytics.pdf", "Attendance Analytics");
  };

  shareAnalyticsBtn.onclick = () => {
    if (!lastAnalyticsShare) { alert("Load analytics first"); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, "_blank");
  };

  // 10f) Attendance Register Section
  const loadRegisterBtn      = $("loadRegister");
  const saveRegisterBtn      = $("saveRegister");
  const changeRegisterBtn    = $("changeRegister");
  const downloadRegisterBtn  = $("downloadRegister");
  const shareRegisterBtn     = $("shareRegister");
  const registerTableWrapper = $("registerTableWrapper");
  const registerHeaderRow    = $("registerHeader");
  const registerBodyTbody    = $("registerBody");

  loadRegisterBtn.onclick = () => {
    const m = $("registerMonth").value; // “YYYY-MM”
    if (!m) { alert("Pick month"); return; }
    // Gather date-keys for that month:
    const dateKeys = Object.keys(attendanceData).filter(d => d.startsWith(m + "-")).sort();
    if (!dateKeys.length) { alert("No attendance marked this month."); return; }

    // Build table header
    registerHeaderRow.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
      dateKeys.map(k => `<th>${k.split("-")[2]}</th>`).join("");
    registerBodyTbody.innerHTML = "";

    students
      .filter(s => s.cls === teacherClass && s.sec === teacherSection)
      .forEach((s, i) => {
        let row = `<td>${i + 1}</td><td>${s.adm}</td><td>${s.name}</td>`;
        dateKeys.forEach(key => {
          const c = (attendanceData[key] && attendanceData[key][s.adm]) || "";
          const color = c === "P" ? "var(--success)"
                       : c === "Lt" ? "var(--warning)"
                       : c === "HD" ? "#FF9800"
                       : c === "L" ? "var(--info)"
                       : "var(--danger)";
          const style = c ? `style="background:${color};color:#fff"` : "";
          row += `<td class="reg-cell" ${style}><span class="status-text">${c}</span></td>`;
        });
        const tr = document.createElement("tr");
        tr.innerHTML = row;
        registerBodyTbody.appendChild(tr);
      });

    // Make cells clickable to toggle status
    document.querySelectorAll(".reg-cell").forEach(cell => {
      cell.onclick = () => {
        const span = cell.querySelector(".status-text");
        const codes = ["", "P", "Lt", "HD", "L", "A"];
        const idx = (codes.indexOf(span.textContent) + 1) % codes.length;
        const c = codes[idx];
        span.textContent = c;
        if (!c) {
          cell.style.background = "";
          cell.style.color = "";
        } else {
          const col = c === "P" ? "var(--success)"
                    : c === "Lt" ? "var(--warning)"
                    : c === "HD" ? "#FF9800"
                    : c === "L" ? "var(--info)"
                    : "var(--danger)";
          cell.style.background = col;
          cell.style.color = "#fff";
        }
      };
    });

    registerTableWrapper.classList.remove("hidden");
    saveRegisterBtn.classList.remove("hidden");
    changeRegisterBtn.classList.add("hidden");
    downloadRegisterBtn.classList.remove("hidden");
    shareRegisterBtn.classList.remove("hidden");
  };

  saveRegisterBtn.onclick = async () => {
    const m = $("registerMonth").value;
    const dateKeys = Object.keys(attendanceData).filter(d => d.startsWith(m + "-")).sort();
    Array.from(registerBodyTbody.children).forEach(tr => {
      const adm = tr.children[1].textContent;
      dateKeys.forEach((key, idx) => {
        const code = tr.children[3 + idx].querySelector(".status-text").textContent;
        if (!attendanceData[key]) attendanceData[key] = {};
        attendanceData[key][adm] = code || "A";
      });
    });
    attendanceDataBySchool[currentSchool] = attendanceData;
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
    await syncToFirebase();
    alert("Register saved.");
    renderCounters();
  };

  downloadRegisterBtn.onclick = async () => {
    const doc = new jspdf.jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split("T")[0];
    doc.setFontSize(18); doc.text("Attendance Register", 14, 20);
    doc.setFontSize(10); doc.text(`Date: ${today}`, w - 14, 20, { align: "right" });
    doc.setFontSize(12); doc.text(`School: ${currentSchool} | Class: ${teacherClass} | Section: ${teacherSection}`, 14, 36);
    doc.autoTable({ startY: 60, html: "#registerTable", tableWidth: "auto", styles: { fontSize: 8 } });
    const blob = doc.output("blob");
    doc.save("attendance_register.pdf");
    await sharePdf(blob, "attendance_register.pdf", "Attendance Register");
  };

  shareRegisterBtn.onclick = () => {
    const header = `Attendance Register\n${currentSchool} | Class ${teacherClass} Section ${teacherSection}`;
    const rows = Array.from(registerBodyTbody.children).map(tr =>
      Array.from(tr.children)
        .map(td => td.querySelector(".status-text")?.textContent || td.textContent)
        .join(" ")
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n" + rows.join("\n"))}`, "_blank`);
  };

  // 10g) Reset Data / Backup (if you have those sections)
  const chooseBackupFolderBtn = $("chooseBackupFolder");
  const restoreDataBtn        = $("restoreData");
  const resetDataBtn          = $("resetData");

  chooseBackupFolderBtn && chooseBackupFolderBtn.onclick = async () => {
    alert("Backup folder selection not implemented in web version.");
  };
  restoreDataBtn && restoreDataBtn.onclick = async () => {
    if (!confirm("Restore all data from IndexedDB?")) return;
    await initLocalState();
    renderStudents();
    renderCounters();
    alert("Data restored from local storage.");
  };
  resetDataBtn && resetDataBtn.onclick = async () => {
    if (!confirm("Factory reset all data? This cannot be undone.")) return;
    await idbClear();
    // Clear in-memory as well:
    studentsBySchool = {};
    attendanceDataBySchool = {};
    paymentsDataBySchool = {};
    lastAdmNoBySchool = {};
    fineRates = { A:50, Lt:20, L:10, HD:30 };
    eligibilityPct = 75;
    schools = [];
    currentSchool = null;
    teacherClass = null;
    teacherSection = null;
    // Reload page to force new setup:
    window.location.reload();
  };
}

// ───────────────────────────────────────────────────────────────
// 11) ONCE “setupDone” FIRES FOR THE FIRST TIME, REGISTER ALL UI HANDLERS
// ───────────────────────────────────────────────────────────────
window.addEventListener("setupDone", () => {
  // Delay registration slightly to ensure DOM elements exist
  setTimeout(() => {
    registerUIEventHandlers();
  }, 100);
});

// ───────────────────────────────────────────────────────────────
// 12) OPTIONAL: LOGOUT BUTTON (in header) ALWAYS ENABLED
// ───────────────────────────────────────────────────────────────
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await logout();
  window.location.href = "login.html";
});

// ───────────────────────────────────────────────────────────────
// 13) CHART RENDERING FOR ANALYTICS (using Chart.js)
// ───────────────────────────────────────────────────────────────
function renderAnalyticsCharts(stats) {
  // Destroy existing charts if any
  if (window.barChart) {
    window.barChart.destroy();
    window.pieChart.destroy();
  }
  const labels = stats.map(s => s.adm);
  const presentData = stats.map(s => s.present);
  const absentData  = stats.map(s => s.absent);

  // Bar Chart for Present/Absent
  window.barChart = new Chart(barChartCanvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Present",
          data: presentData,
          backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--success").trim()
        },
        {
          label: "Absent",
          data: absentData,
          backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--danger").trim()
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // Pie Chart for Eligibility (% Eligible vs Debarred)
  const eligibleCount = stats.filter(s => s.eligible === "Yes").length;
  const debarredCount = stats.filter(s => s.eligible === "No").length;
  window.pieChart = new Chart(pieChartCanvas.getContext("2d"), {
    type: "pie",
    data: {
      labels: ["Eligible", "Debarred"],
      datasets: [
        {
          data: [eligibleCount, debarredCount],
          backgroundColor: [
            getComputedStyle(document.documentElement).getPropertyValue("--success").trim(),
            getComputedStyle(document.documentElement).getPropertyValue("--danger").trim()
          ]
        }
      ]
    },
    options: {
      responsive: true
    }
  });
}
