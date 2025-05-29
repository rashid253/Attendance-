// app.js (with per‐school data segregation + auth‐restricted Setup)
// ------------------------------------------------------------------

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  set as dbSet,
  onValue,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

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
  databaseURL: "https://attandace-management-default-rtdb.firebaseio.com",
};
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const appDataRef = dbRef(database, "appData");
const auth = getAuth(app);

// ----------------------
// Local application state (per‐school mappings)
// ----------------------
let studentsBySchool       = {}; // { schoolName: [ { name, adm, parent, contact, occupation, address, cls, sec } ] }
let attendanceDataBySchool = {}; // { schoolName: { "YYYY-MM-DD": { adm: "P"/"A"/... } } }
let paymentsDataBySchool   = {}; // { schoolName: { adm: [ { date: "YYYY-MM-DD", amount: number }, ... ] } }
let lastAdmNoBySchool      = {}; // { schoolName: numeric last admission number }
let fineRates              = { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct         = 75;
let schools                = [];    // array of school names (strings)
let currentSchool          = null;  // selected school name
let teacherClass           = null;  // selected class (e.g. "10")
let teacherSection         = null;  // selected section (e.g. "A")

// These variables hold the currently active school's data
let students       = [];    // will reference studentsBySchool[currentSchool]
let attendanceData = {};    // will reference attendanceDataBySchool[currentSchool]
let paymentsData   = {};    // will reference paymentsDataBySchool[currentSchool]
let lastAdmNo      = 0;     // will reference lastAdmNoBySchool[currentSchool]

// ----------------------
// Ensure data structures exist for a given school
// ----------------------
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

// ----------------------
// Initialize state from IndexedDB
// ----------------------
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

// ----------------------
// Sync local state (mappings) to Firebase
// ----------------------
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

// ----------------------
// Utility: Show/hide elements
// ----------------------
const show = (...els) => els.forEach(e => e && e.classList.remove("hidden"));
const hide = (...els) => els.forEach(e => e && e.classList.add("hidden"));

// ----------------------
// DOMContentLoaded: Main Initialization & Auth → UI Logic
// ----------------------
window.addEventListener("DOMContentLoaded", async () => {
  // Simplified selector
  const $ = (id) => document.getElementById(id);

  // Initialize IndexedDB state
  await initLocalState();

  // ----------------------
  // AUTH: Show login modal if not signed in
  // ----------------------
  const loginModal = $("loginModal");
  const loginBtn = $("loginBtn");
  const closeLoginModal = $("closeLoginModal");
  const loginEmail = $("loginEmail");
  const loginPassword = $("loginPassword");
  const logoutBtn = $("logoutBtn");
  const setupSection = $("teacher-setup");

  function requireAuthShowSetup(user) {
    if (user) {
      // Signed in → hide login, show Setup section
      hide(loginModal);
      show(logoutBtn);
      show(setupSection);
      loadSetup();   // re‐build Setup UI
    } else {
      // Not signed in → hide Setup, show login
      hide(setupSection);
      hide(logoutBtn);
      show(loginModal);
    }
  }

  onAuthStateChanged(auth, (user) => {
    requireAuthShowSetup(user);
  });

  closeLoginModal.onclick = () => {
    // If user tries to close login without signing in, keep it open.
    // (Alternatively, user can’t close until they log in.)
    // But to keep it simple, just keep it visible.
    show(loginModal);
  };

  loginBtn.onclick = async () => {
    const email = loginEmail.value.trim();
    const pass = loginPassword.value;
    if (!email || !pass) {
      alert("Please enter both email and password.");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle UI
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  };

  logoutBtn.onclick = async () => {
    await signOut(auth);
    // onAuthStateChanged will handle UI
  };

  // ----------------------
  // Initialize the rest of the UI once auth state is resolved
  // ----------------------
  // Note: loadSetup() is called inside `requireAuthShowSetup(user)` when user is signed in,
  // so we don’t call it here directly until user is authenticated.

  // ----------------------
  // Inside here: everything from “Reset Views” onward remains unchanged,
  // but wrapped so that Setup is only available when signed in.
  // ----------------------

  // Generate new admission number (per school)
  async function genAdmNo() {
    lastAdmNo++;
    lastAdmNoBySchool[currentSchool] = lastAdmNo;
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
    await syncToFirebase();
    return String(lastAdmNo).padStart(4, "0");
  }

  // ----------------------
  // 1. SETUP SECTION
  // ----------------------
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
    schoolListDiv.innerHTML = "";
    schools.forEach((sch, idx) => {
      const row = document.createElement("div");
      row.className = "row-inline";
      row.innerHTML = `
        <span>${sch}</span>
        <div>
          <button data-idx="${idx}" class="edit-school no-print"><i class="fas fa-edit"></i></button>
          <button data-idx="${idx}" class="delete-school no-print"><i class="fas fa-trash"></i></button>
        </div>`;
      schoolListDiv.appendChild(row);
    });
    document.querySelectorAll(".edit-school").forEach(btn => {
      btn.onclick = async () => {
        const idx = +btn.dataset.idx;
        const newName = prompt("Edit School Name:", schools[idx]);
        if (newName?.trim()) {
          const oldName = schools[idx];
          schools[idx] = newName.trim();
          await idbSet("schools", schools);

          // Rename mappings if necessary
          studentsBySchool[newName] = studentsBySchool[oldName] || [];
          delete studentsBySchool[oldName];
          await idbSet("studentsBySchool", studentsBySchool);

          attendanceDataBySchool[newName] = attendanceDataBySchool[oldName] || {};
          delete attendanceDataBySchool[oldName];
          await idbSet("attendanceDataBySchool", attendanceDataBySchool);

          paymentsDataBySchool[newName] = paymentsDataBySchool[oldName] || {};
          delete paymentsDataBySchool[oldName];
          await idbSet("paymentsDataBySchool", paymentsDataBySchool);

          lastAdmNoBySchool[newName] = lastAdmNoBySchool[oldName] || 0;
          delete lastAdmNoBySchool[oldName];
          await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);

          await syncToFirebase();
          await loadSetup();
        }
      };
    });
    document.querySelectorAll(".delete-school").forEach(btn => {
      btn.onclick = async () => {
        const idx = +btn.dataset.idx;
        if (!confirm(`Delete school "${schools[idx]}"?`)) return;
        const removed = schools.splice(idx, 1)[0];
        await idbSet("schools", schools);

        // Remove mappings for this school
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
      // Load current school's data into working variables
      students       = studentsBySchool[currentSchool];
      attendanceData = attendanceDataBySchool[currentSchool];
      paymentsData   = paymentsDataBySchool[currentSchool];
      lastAdmNo      = lastAdmNoBySchool[currentSchool];

      classSelect.value = teacherClass;
      sectionSelect.value = teacherSection;
      setupText.textContent = `${currentSchool} 🏫 | Class: ${teacherClass} | Section: ${teacherSection}`;
      hide(setupForm);
      show(setupDisplay);

      // After setup completes, show all other sections
      resetViews();

      // After setup completes, render students and counters
      setTimeout(() => {
        renderStudents();
        updateCounters();
      }, 0);

    } else {
      // Setup is not complete, hide other sections
      show(setupForm);
      hide(setupDisplay);
      resetViews();
    }
  };

  saveSetupBtn.onclick = async (e) => {
    e.preventDefault();
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
    resetViews(); // hide other sections until Setup is saved again
  };

  // ----------------------
  // 2. FINANCIAL SETTINGS SECTION
  // ----------------------
  const formDiv             = $("financialForm");
  const saveSettings        = $("saveSettings");
  const fineAbsentInput     = $("fineAbsent");
  const fineLateInput       = $("fineLate");
  const fineLeaveInput      = $("fineLeave");
  const fineHalfDayInput    = $("fineHalfDay");
  const eligibilityPctInput = $("eligibilityPct");

  const settingsCard = document.createElement("div");
  const editSettings = document.createElement("button");
  settingsCard.id = "settingsCard";
  settingsCard.className = "card hidden";
  editSettings.id = "editSettings";
  editSettings.className = "btn no-print hidden";
  editSettings.textContent = "Edit Settings";
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editSettings);

  // Initialize inputs with existing values
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

    settingsCard.innerHTML = `
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
      </div>`;
    hide(formDiv, saveSettings, fineAbsentInput, fineLateInput, fineLeaveInput, fineHalfDayInput, eligibilityPctInput);
    show(settingsCard, editSettings);
  };

  editSettings.onclick = () => {
    hide(settingsCard, editSettings);
    show(formDiv, saveSettings, fineAbsentInput, fineLateInput, fineLeaveInput, fineHalfDayInput, eligibilityPctInput);
  };

  // ----------------------
  // 3. COUNTERS SECTION
  // ----------------------
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
    return card;
  }

  // Create all seven cards first so their <span> IDs exist in the DOM
  const sectionCard     = createCounterCard("card-section",     "Section",        "sectionCount");
  const classCard       = createCounterCard("card-class",       "Class",          "classCount");
  const schoolCard      = createCounterCard("card-school",      "School",         "schoolCount");
  const attendanceCard  = createCounterCard("card-attendance",  "Attendance",     "attendanceCount");
  const eligibleCard    = createCounterCard("card-eligible",    "Eligible",       "eligibleCount");
  const debarredCard    = createCounterCard("card-debarred",    "Debarred",       "debarredCount");
  const outstandingCard = createCounterCard("card-outstanding", "Outstanding/Fine","outstandingCount");

  // Now that those <span> elements exist, grab them:
  const sectionCountSpan     = $("sectionCount");
  const classCountSpan       = $("classCount");
  const schoolCountSpan      = $("schoolCount");
  const attendanceCountSpan  = $("attendanceCount");
  const eligibleCountSpan    = $("eligibleCount");
  const debarredCountSpan    = $("debarredCount");
  const outstandingCountSpan = $("outstandingCount");

  function animateCounters() {
    document.querySelectorAll(".card-number span").forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target / 100);
      (function upd() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(upd);
      })();
    });
  }

  function updateCounters() {
    const cl  = classSelect.value;
    const sec = sectionSelect.value;

    // Section: number of students in this class+section
    const sectionStudents = students.filter(s => s.cls === cl && s.sec === sec);
    sectionCountSpan.dataset.target = sectionStudents.length;

    // Class: number of students in this class (all sections)
    const classStudents = students.filter(s => s.cls === cl);
    classCountSpan.dataset.target = classStudents.length;

    // School: total students (in the current school)
    schoolCountSpan.dataset.target = students.length;

    // Attendance for this class+section across all dates
    let totalP = 0, totalA = 0, totalLt = 0, totalHD = 0, totalL = 0;
    Object.entries(attendanceData).forEach(([date, rec]) => {
      sectionStudents.forEach(s => {
        const code = rec[s.adm];
        if (!code) {
          totalA++;
        } else {
          switch (code) {
            case "P": totalP++; break;
            case "A": totalA++; break;
            case "Lt": totalLt++; break;
            case "HD": totalHD++; break;
            case "L": totalL++; break;
          }
        }
      });
    });
    const attendanceTotal = totalP + totalA + totalLt + totalHD + totalL;
    attendanceCountSpan.dataset.target = attendanceTotal;

    // Eligible, Debarred, Outstanding
    let eligibleCount = 0, debarredCount = 0, outstandingCount = 0;
    students.forEach(s => {
      if (s.cls !== cl || s.sec !== sec) return;
      let p=0, a=0, lt=0, hd=0, l=0, totalDays=0;
      Object.values(attendanceData).forEach(rec => {
        if (rec[s.adm]) {
          totalDays++;
          switch (rec[s.adm]) {
            case "P": p++; break;
            case "A": a++; break;
            case "Lt": lt++; break;
            case "HD": hd++; break;
            case "L": l++; break;
          }
        }
      });
      const fineTotal = a * fineRates.A + lt * fineRates.Lt + l * fineRates.L + hd * fineRates.HD;
      const paid = (paymentsData[s.adm] || []).reduce((acc, pmt) => acc + pmt.amount, 0);
      const outstanding = fineTotal - paid;
      const pct = totalDays ? (p / totalDays) * 100 : 0;
      const status = (outstanding > 0 || pct < eligibilityPct) ? "Debarred" : "Eligible";
      if (status === "Eligible") eligibleCount++;
      else debarredCount++;
      if (outstanding > 0) outstandingCount++;
    });
    eligibleCountSpan.dataset.target    = eligibleCount;
    debarredCountSpan.dataset.target    = debarredCount;
    outstandingCountSpan.dataset.target = outstandingCount;

    animateCounters();
  }

  // Dialog handlers for each card
  sectionCard.onclick = () => {
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    const list = students
      .filter(s => s.cls === cl && s.sec === sec)
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Class ${cl} Section ${sec}:\n\n${list || "No students found."}`);
  };

  classCard.onclick = () => {
    const cl = classSelect.value;
    const list = students
      .filter(s => s.cls === cl)
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Class ${cl} (All Sections):\n\n${list || "No students found."}`);
  };

  schoolCard.onclick = () => {
    const classes = [...new Set(students.map(s => s.cls))].sort();
    let details = "";
    classes.forEach(cl => {
      const classStudents = students.filter(s => s.cls === cl);
      details += `Class ${cl} (Total ${classStudents.length} students):\n`;
      classStudents.forEach((s, idx) => {
        details += `  ${idx + 1}. Adm#: ${s.adm}  Name: ${s.name}\n`;
      });
      details += "\n";
    });
    alert(`School Overview:\n\n${details || "No students in school."}`);
  };

  attendanceCard.onclick = () => {
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    let totalP = 0, totalA = 0, totalLt = 0, totalHD = 0, totalL = 0;
    Object.entries(attendanceData).forEach(([date, rec]) => {
      students.filter(stu => stu.cls === cl && stu.sec === sec).forEach(s => {
        const code = rec[s.adm];
        if (!code) {
          totalA++;
        } else {
          switch (code) {
            case "P": totalP++; break;
            case "A": totalA++; break;
            case "Lt": totalLt++; break;
            case "HD": totalHD++; break;
            case "L": totalL++; break;
          }
        }
      });
    });
    alert(
      `Attendance Summary for Class ${cl} Section ${sec}:\n\n` +
      `Present   : ${totalP}\n` +
      `Absent    : ${totalA}\n` +
      `Late      : ${totalLt}\n` +
      `Half-Day  : ${totalHD}\n` +
      `Leave     : ${totalL}`
    );
  };

  eligibleCard.onclick = () => {
    const list = students
      .filter(s => {
        if (s.cls !== classSelect.value || s.sec !== sectionSelect.value) return false;
        let p=0, totalDays=0;
        Object.values(attendanceData).forEach(rec => {
          if (rec[s.adm]) {
            totalDays++;
            if (rec[s.adm] === "P") p++;
          }
        });
        const pct = totalDays ? (p / totalDays) * 100 : 0;
        let a=0, lt=0, l=0, hd=0;
        Object.values(attendanceData).forEach(rec => {
          if (rec[s.adm]) {
            switch (rec[s.adm]) {
              case "A": a++; break;
              case "Lt": lt++; break;
              case "HD": hd++; break;
              case "L": l++; break;
            }
          }
        });
        const fineTotal = a * fineRates.A + lt * fineRates.Lt + l * fineRates.L + hd * fineRates.HD;
        const paid = (paymentsData[s.adm] || []).reduce((acc, pmt) => acc + pmt.amount, 0);
        const outstanding = fineTotal - paid;
        return outstanding <= 0 && pct >= eligibilityPct;
      })
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Eligible Students:\n\n${list || "No eligible students."}`);
  };

  debarredCard.onclick = () => {
    const list = students
      .filter(s => {
        if (s.cls !== classSelect.value || s.sec !== sectionSelect.value) return false;
        let p=0, totalDays=0;
        Object.values(attendanceData).forEach(rec => {
          if (rec[s.adm]) {
            totalDays++;
            if (rec[s.adm] === "P") p++;
          }
        });
        const pct = totalDays ? (p / totalDays) * 100 : 0;
        let a=0, lt=0, l=0, hd=0;
        Object.values(attendanceData).forEach(rec => {
          if (rec[s.adm]) {
            switch (rec[s.adm]) {
              case "A": a++; break;
              case "Lt": lt++; break;
              case "HD": hd++; break;
              case "L": l++; break;
            }
          }
        });
        const fineTotal = a * fineRates.A + lt * fineRates.Lt + l * fineRates.L + hd * fineRates.HD;
        const paid = (paymentsData[s.adm] || []).reduce((acc, pmt) => acc + pmt.amount, 0);
        const outstanding = fineTotal - paid;
        return outstanding > 0 || pct < eligibilityPct;
      })
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Debarred Students:\n\n${list || "No debarred students."}`);
  };

  outstandingCard.onclick = () => {
    const list = students
      .filter(s => {
        if (s.cls !== classSelect.value || s.sec !== sectionSelect.value) return false;
        let a=0, lt=0, l=0, hd=0;
        Object.values(attendanceData).forEach(rec => {
          if (rec[s.adm]) {
            switch (rec[s.adm]) {
              case "A": a++; break;
              case "Lt": lt++; break;
              case "HD": hd++; break;
              case "L": l++; break;
            }
          }
        });
        const fineTotal = a * fineRates.A + lt * fineRates.Lt + l * fineRates.L + hd * fineRates.HD;
        const paid = (paymentsData[s.adm] || []).reduce((acc, pmt) => acc + pmt.amount, 0);
        return fineTotal - paid > 0;
      })
      .map((s, i) => {
        let a=0, lt=0, l=0, hd=0;
        Object.values(attendanceData).forEach(rec => {
          if (rec[s.adm]) {
            switch (rec[s.adm]) {
              case "A": a++; break;
              case "Lt": lt++; break;
              case "HD": hd++; break;
              case "L": l++; break;
            }
          }
        });
        const fineTotal = a * fineRates.A + lt * fineRates.Lt + l * fineRates.L + hd * fineRates.HD;
        const paid = (paymentsData[s.adm] || []).reduce((acc, pmt) => acc + pmt.amount, 0);
        const outstanding = fineTotal - paid;
        return `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}  Outstanding: PKR ${outstanding}`;
      })
      .join("\n");
    alert(`Students with Outstanding Fines:\n\n${list || "No outstanding fines."}`);
  };

  // ----------------------
  // 4. STUDENT REGISTRATION SECTION
  // ----------------------
  const studentsBody            = $("studentsBody");
  const selectAllStudents       = $("selectAllStudents");
  const editSelectedBtn         = $("editSelected");
  const doneEditingBtn          = $("doneEditing");
  const deleteSelectedBtn       = $("deleteSelected");
  const saveRegistrationBtn     = $("saveRegistration");
  const editRegistrationBtn     = $("editRegistration");
  const shareRegistrationBtn    = $("shareRegistration");
  const downloadRegistrationBtn = $("downloadRegistrationPDF");

  $("addStudent").onclick = async (e) => {
    e.preventDefault();
    const n   = $("studentName").value.trim();
    const p   = $("parentName").value.trim();
    const c   = $("parentContact").value.trim();
    const o   = $("parentOccupation").value.trim();
    const a   = $("parentAddress").value.trim();
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    if (!n || !p || !c || !o || !a) { alert("All fields required"); return; }
    if (!/^\d{7,15}$/.test(c)) { alert("Contact must be 7–15 digits"); return; }
    const adm = await genAdmNo();
    students.push({ name: n, adm, parent: p, contact: c, occupation: o, address: a, cls: cl, sec });
    studentsBySchool[currentSchool] = students;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    renderStudents();
    updateCounters();

    // ----- CLEAR Form Inputs Here -----
    $("studentName").value      = "";
    $("parentName").value       = "";
    $("parentContact").value    = "";
    $("parentOccupation").value = "";
    $("parentAddress").value    = "";
  };

  function renderStudents() {
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    studentsBody.innerHTML = "";
    let idx = 0;
    students.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      // Compute stats
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => { if (rec[s.adm]) stats[rec[s.adm]]++; });
      const total = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const fine  = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid  = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount, 0);
      const out   = fine - paid;
      const pct   = total ? (stats.P/total)*100 : 0;
      const status = (out > 0 || pct < eligibilityPct) ? "Debarred" : "Eligible";

      const tr = document.createElement("tr");
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td>
        <td>${s.name}</td>
        <td>${s.adm}</td>
        <td>${s.parent}</td>
        <td>${s.contact}</td>
        <td>${s.occupation}</td>
        <td>${s.address}</td>
        <td>PKR ${out}</td>
        <td>${status}</td>
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
    const any = !!document.querySelector(".sel:checked");
    editSelectedBtn.disabled   = !any;
    deleteSelectedBtn.disabled = !any;
  }

  studentsBody.addEventListener("change", e => {
    if (e.target.classList.contains("sel")) toggleButtons();
  });

  selectAllStudents.onclick = () => {
    document.querySelectorAll(".sel").forEach(c => c.checked = selectAllStudents.checked);
    toggleButtons();
  };

  editSelectedBtn.onclick = () => {
    document.querySelectorAll(".sel:checked").forEach(cb => {
      const tr = cb.closest("tr"), i = +tr.dataset.index, s = students[i];
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" checked></td>
        <td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"></td>
        <td>${s.adm}</td>
        <td><input value="${s.parent}"></td>
        <td><input value="${s.contact}"></td>
        <td><input value="${s.occupation}"></td>
        <td><input value="${s.address}"></td>
        <td colspan="3"></td>
      `;
    });
    hide(editSelectedBtn, deleteSelectedBtn);
    show(doneEditingBtn);
  };

  doneEditingBtn.onclick = async () => {
    document.querySelectorAll("#studentsBody tr").forEach(tr => {
      const inps = [...tr.querySelectorAll("input:not(.sel)")];
      if (inps.length === 5) {
        const [n, p, c, o, a] = inps.map(i => i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(x => x.adm === adm);
        if (idx > -1) {
          students[idx] = { ...students[idx], name: n, parent: p, contact: c, occupation: o, address: a };
        }
      }
    });
    studentsBySchool[currentSchool] = students;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    hide(doneEditingBtn);
    show(editSelectedBtn, deleteSelectedBtn, saveRegistrationBtn);
    renderStudents();
    updateCounters();
  };

  deleteSelectedBtn.onclick = async () => {
    if (!confirm("Delete selected students?")) return;
    const toDel = [...document.querySelectorAll(".sel:checked")].map(cb => +cb.closest("tr").dataset.index);
    students = students.filter((_, i) => !toDel.includes(i));
    studentsBySchool[currentSchool] = students;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    renderStudents();
    updateCounters();
  };

  saveRegistrationBtn.onclick = async () => {
    if (!doneEditingBtn.classList.contains("hidden")) { alert("Finish editing before saving."); return; }
    studentsBySchool[currentSchool] = students;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    hide($("student-registration").querySelector(".row-inline"), editSelectedBtn, deleteSelectedBtn, selectAllStudents, saveRegistrationBtn);
    show(editRegistrationBtn, shareRegistrationBtn, downloadRegistrationBtn);
    renderStudents();
    updateCounters();
  };

  editRegistrationBtn.onclick = () => {
    show($("student-registration").querySelector(".row-inline"), selectAllStudents, editSelectedBtn, deleteSelectedBtn, saveRegistrationBtn);
    hide(editRegistrationBtn, shareRegistrationBtn, downloadRegistrationBtn);
    renderStudents();
    updateCounters();
  };

  // ----------------------
  // 5. PAYMENT MODAL SECTION
  // ----------------------
  const paymentModal         = $("paymentModal");
  const payAdmSpan           = $("payAdm");
  const paymentAmountInput   = $("paymentAmount");
  const paymentModalCloseBtn = $("paymentModalClose");
  const savePaymentBtn       = $("savePayment");
  const cancelPaymentBtn     = $("cancelPayment");

  function openPaymentModal(adm) {
    payAdmSpan.textContent = adm;
    paymentAmountInput.value = "";
    show(paymentModal);
  }
  paymentModalCloseBtn.onclick = () => hide(paymentModal);
  savePaymentBtn.onclick = async () => {
    const adm = payAdmSpan.textContent;
    const amt = Number(paymentAmountInput.value) || 0;
    paymentsData[adm] = paymentsData[adm] || [];
    paymentsData[adm].push({ date: new Date().toISOString().split("T")[0], amount: amt });
    paymentsDataBySchool[currentSchool] = paymentsData;
    await idbSet("paymentsDataBySchool", paymentsDataBySchool);
    await syncToFirebase();
    hide(paymentModal);
    renderStudents();
    updateCounters();
  };
  cancelPaymentBtn.onclick = () => hide(paymentModal);

  // ----------------------
  // 6. MARK ATTENDANCE SECTION
  // ----------------------
  const dateInput             = $("dateInput");
  const loadAttendanceBtn     = $("loadAttendance");
  const saveAttendanceBtn     = $("saveAttendance");
  const resetAttendanceBtn    = $("resetAttendance");
  const downloadAttendanceBtn = $("downloadAttendancePDF");
  const shareAttendanceBtn    = $("shareAttendanceSummary");
  const attendanceBodyDiv     = $("attendanceBody");
  const attendanceSummaryDiv  = $("attendanceSummary");

  const statusNames  = { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" };
  const statusColors = { P:"var(--success)", A:"var(--danger)", Lt:"var(--warning)", HD:"#FF9800", L:"var(--info)" };

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = "";
    attendanceSummaryDiv.innerHTML = "";
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    attendanceBodyDiv.style.overflowX = "auto";
    students.filter(stu => stu.cls === cl && stu.sec === sec).forEach((stu, i) => {
      const row = document.createElement("div");
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
          btnsDiv.querySelectorAll(".att-btn").forEach(b => { b.classList.remove("selected"); b.style = ""; });
          btn.classList.add("selected");
          btn.style.background = statusColors[code];
          btn.style.color = "#fff";
        };
        btnsDiv.appendChild(btn);
      });
      row.append(headerDiv, btnsDiv);
      attendanceBodyDiv.appendChild(row);
    });
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert("Pick date"); return; }
    attendanceData[date] = {};
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    students.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
      const selBtn = attendanceBodyDiv.children[i].querySelector(".att-btn.selected");
      attendanceData[date][s.adm] = selBtn ? selBtn.textContent : "A";
    });
    attendanceDataBySchool[currentSchool] = attendanceData;
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
    await syncToFirebase();
    console.log("✅ Attendance data synced to Firebase");

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
          <td>${i + 1}</td>
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
        const st = students.find(x => x.adm === adm);
        const msg = `Dear Parent, your child (Adm#: ${adm}) was ${statusNames[attendanceData[date][adm]]} on ${date}.`;
        window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`, "_blank");
      };
    });

    hide(attendanceBodyDiv, saveAttendanceBtn);
    show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
    updateCounters();
  };

  resetAttendanceBtn.onclick = () => {
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  downloadAttendanceBtn.onclick = async () => {
    const doc = new jspdf.jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split("T")[0];
    doc.setFontSize(18); doc.text("Attendance Report", 14, 16);
    doc.setFontSize(10); doc.text(`Date: ${today}`, w - 14, 16, { align: "right" });
    doc.setFontSize(12); doc.text(setupText.textContent, 14, 24);
    doc.autoTable({ startY: 30, html: "#attendanceSummaryTable" });
    const fileName = `attendance_${dateInput.value}.pdf`;
    const blob = doc.output("blob");
    doc.save(fileName);
    await sharePdf(blob, fileName, "Attendance Report");
  };

  shareAttendanceBtn.onclick = () => {
    const cl   = classSelect.value;
    const sec  = sectionSelect.value;
    const date = dateInput.value;
    const header = `*Attendance Report*\nClass ${cl} Sec ${sec} - ${date}`;
    const lines = students.filter(s => s.cls === cl && s.sec === sec)
      .map((s, i) => `${i + 1}. ${s.name} (Adm#: ${s.adm}): ${statusNames[attendanceData[date][s.adm]]}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n\n" + lines.join("\n"))}`, "_blank");
  };

  // ----------------------
  // 7. ANALYTICS SECTION
  // ----------------------
  const atg                  = $("analyticsTarget");           // select: section/student
  const asel                 = $("analyticsSectionSelect");    // section dropdown
  const atype                = $("analyticsType");             // type: date/month/semester/year
  const adateInput           = $("analyticsDate");             // input type="date"
  const amonthInput          = $("analyticsMonth");            // input type="month"
  const semsInput            = $("semesterStart");             // input type="month"
  const semeInput            = $("semesterEnd");               // input type="month"
  const ayearInput           = $("yearStart");                 // input type="number" min=2000 max=2100
  const asearchInput         = $("analyticsSearch");           // input to search admission or name
  const loadAnalyticsBtn     = $("loadAnalytics");
  const resetAnalyticsBtn    = $("resetAnalytics");
  const instructionsDiv      = $("instructions");
  const analyticsContainer   = $("analyticsContainer");
  const graphsDiv            = $("graphs");
  const analyticsActionsDiv  = $("analyticsActions");
  const barChartCanvas       = $("barChart");
  const pieChartCanvas       = $("pieChart");
  const downloadAnalyticsBtn = $("downloadAnalytics");
  const shareAnalyticsBtn    = $("shareAnalytics");

  const analyticsStatusNames  = { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" };
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

  $("analyticsFilterBtn").onclick = () => show($("analyticsFilterModal"));
  $("analyticsFilterClose").onclick = () => hide($("analyticsFilterModal"));
  $("applyAnalyticsFilter").onclick = () => {
    analyticsFilterOptions = Array.from(document.querySelectorAll("#analyticsFilterForm input[type='checkbox']:checked")).map(cb => cb.value) || ["all"];
    analyticsDownloadMode = document.querySelector("#analyticsFilterForm input[name='downloadMode']:checked").value;
    hide($("analyticsFilterModal"));
    if (lastAnalyticsStats.length) {
      renderAnalytics(lastAnalyticsStats, lastAnalyticsRange.from, lastAnalyticsRange.to);
    }
  };

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearchInput].forEach(x => x.classList.add("hidden"));
    [instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv].forEach(x => x.classList.add("hidden"));
    if (atg.value === "section") asel.classList.remove("hidden");
    if (atg.value === "student") asearchInput.classList.remove("hidden");
  };

  atype.onchange = () => {
    [adateInput, amonthInput, semsInput, semeInput, ayearInput].forEach(x => x.classList.add("hidden"));
    [instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv].forEach(x => x.classList.add("hidden"));
    resetAnalyticsBtn.classList.remove("hidden");
    switch (atype.value) {
      case "date":
        adateInput.classList.remove("hidden");
        break;
      case "month":
        amonthInput.classList.remove("hidden");
        break;
      case "semester":
        semsInput.classList.remove("hidden");
        semeInput.classList.remove("hidden");
        break;
      case "year":
        ayearInput.classList.remove("hidden");
        break;
    }
  };

  resetAnalyticsBtn.onclick = (e) => {
    e.preventDefault();
    atype.value = "";
    [adateInput, amonthInput, semsInput, semeInput, ayearInput, instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv].forEach(x => x.classList.add("hidden"));
    resetAnalyticsBtn.classList.add("hidden");
  };

  loadAnalyticsBtn.onclick = () => {
    if (atg.value === "student" && !asearchInput.value.trim()) { alert("Enter admission number or name"); return; }
    let from, to;
    if (atype.value === "date") {
      from = to = adateInput.value;
    } else if (atype.value === "month") {
      const [y, m] = amonthInput.value.split("-").map(Number);
      from = `${amonthInput.value}-01`;
      to = `${amonthInput.value}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    } else if (atype.value === "semester") {
      const [sy, sm] = semsInput.value.split("-").map(Number);
      const [ey, em] = semeInput.value.split("-").map(Number);
      from = `${semsInput.value}-01`;
      to = `${semeInput.value}-${String(new Date(ey, em, 0).getDate()).padStart(2, "0")}`;
    } else if (atype.value === "year") {
      from = `${ayearInput.value}-01-01`;
      to = `${ayearInput.value}-12-31`;
    } else {
      alert("Select period type");
      return;
    }

    const cls = classSelect.value;
    const sec = sectionSelect.value;
    let pool = students.filter(s => s.cls === cls && s.sec === sec);
    if (atg.value === "section") pool = pool.filter(s => s.sec === asel.value);
    if (atg.value === "student") {
      const q = asearchInput.value.trim().toLowerCase();
      pool = pool.filter(s => s.adm === q || s.name.toLowerCase().includes(q));
    }

    const stats = pool.map(s => ({ adm: s.adm, name: s.name, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    Object.entries(attendanceData).forEach(([d, rec]) => {
      if (d < from || d > to) return;
      stats.forEach(st => {
        if (rec[st.adm]) { st[rec[st.adm]]++; st.total++; }
      });
    });
    stats.forEach(st => {
      const totalFine = st.A * fineRates.A + st.Lt * fineRates.Lt + st.L * fineRates.L + st.HD * fineRates.HD;
      const paid = (paymentsData[st.adm] || []).reduce((a, p) => a + p.amount, 0);
      st.outstanding = totalFine - paid;
      const pct = st.total ? (st.P / st.total) * 100 : 0;
      st.status = st.outstanding > 0 || pct < eligibilityPct ? "Debarred" : "Eligible";
    });

    lastAnalyticsStats = stats;
    lastAnalyticsRange = { from, to };
    renderAnalytics(stats, from, to);
  };

  function renderAnalytics(stats, from, to) {
    // 1) Filter stats according to filter options
    let filtered = stats;
    if (!analyticsFilterOptions.includes("all")) {
      filtered = stats.filter(st => analyticsFilterOptions.some(opt => {
        switch (opt) {
          case "registered":   return true;
          case "attendance":   return st.total > 0;
          case "fine":         return st.A > 0 || st.Lt > 0 || st.L > 0 || st.HD > 0;
          case "cleared":      return st.outstanding === 0;
          case "debarred":     return st.status === "Debarred";
          case "eligible":     return st.status === "Eligible";
        }
      }));
    }

    // 2) Build HTML table
    const theadRow = document.querySelector("#analyticsTable thead tr");
    theadRow.innerHTML = [
      "#", "Adm#", "Name", "P", "A", "Lt", "HD", "L", "Total", "%", "Outstanding", "Status"
    ].map(h => `<th>${h}</th>`).join("");

    const tbody = $("analyticsBody");
    tbody.innerHTML = "";
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
      tbody.appendChild(tr);
    });

    // 3) Show analytics section
    $("instructions").textContent = `Period: ${from} to ${to}`;
    show(instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv);

    // 4) Bar chart: % Present for each student
    const barCtx = barChartCanvas.getContext("2d");
    if (window.barChartInstance) barChartInstance.destroy();
    window.barChartInstance = new Chart(barCtx, {
      type: "bar",
      data: {
        labels: filtered.map(st => st.name),
        datasets: [{
          label: "% Present",
          data: filtered.map(st => st.total ? (st.P / st.total) * 100 : 0),
          backgroundColor: filtered.map(() => analyticsStatusColors.P)
        }]
      },
      options: {
        scales: { y: { beginAtZero: true, max: 100 } }
      }
    });

    // 5) Pie chart: distribution of statuses across all filtered students
    const totals = filtered.reduce((acc, st) => {
      acc.P  += st.P;
      acc.A  += st.A;
      acc.Lt += st.Lt;
      acc.HD += st.HD;
      acc.L  += st.L;
      return acc;
    }, { P:0, A:0, Lt:0, HD:0, L:0 });

    const pieCtx = pieChartCanvas.getContext("2d");
    if (window.pieChartInstance) pieChartInstance.destroy();
    window.pieChartInstance = new Chart(pieCtx, {
      type: "pie",
      data: {
        labels: Object.values(analyticsStatusNames),
        datasets: [{
          data: Object.keys(analyticsStatusNames).map(code => totals[code]),
          backgroundColor: Object.keys(analyticsStatusNames).map(code => analyticsStatusColors[code])
        }]
      }
    });

    // 6) Prepare WhatsApp share text
    lastAnalyticsShare =
      `Attendance Analytics (${from} to ${to})\n` +
      filtered.map((st, i) => {
        const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
        return `${i + 1}. ${st.adm} ${st.name}: ${pct}% / PKR ${st.outstanding}`;
      }).join("\n");
  }

  downloadAnalyticsBtn.onclick = async () => {
    if (!lastAnalyticsStats.length) { alert("Load analytics first"); return; }

    if (analyticsDownloadMode === "combined") {
      const doc = new jspdf.jsPDF();
      const w = doc.internal.pageSize.getWidth();
      const { from, to } = lastAnalyticsRange;
      doc.setFontSize(18); doc.text("Attendance Analytics", 14, 16);
      doc.setFontSize(10); doc.text(`Period: ${from} to ${to}`, w - 14, 16, { align: "right" });
      doc.setFontSize(12); doc.text(setupText.textContent, 14, 24);

      // Build a temporary table
      const tempTable = document.createElement("table");
      tempTable.innerHTML = `
        <thead>
          <tr>
            <th>#</th><th>Adm#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th><th>Outstanding</th><th>Status</th>
          </tr>
        </thead>
        <tbody id="tempAnalyticsBody"></tbody>
      `;
      document.body.appendChild(tempTable);
      const tempBody = tempTable.querySelector("#tempAnalyticsBody");
      lastAnalyticsStats.forEach((st, i) => {
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
        tempBody.appendChild(tr);
      });

      doc.autoTable({ startY: 30, html: tempTable });
      document.body.removeChild(tempTable);
      const fileName = `analytics_${lastAnalyticsRange.from}_to_${lastAnalyticsRange.to}.pdf`;
      doc.save(fileName);
    } else {
      // Individual PDFs
      for (const st of lastAnalyticsStats) {
        const doc = new jspdf.jsPDF();
        doc.setFontSize(18); doc.text(`Analytics: ${st.name}`, 14, 16);
        doc.setFontSize(12);
        doc.text(`Adm#: ${st.adm}`, 14, 30);
        doc.text(`Present: ${st.P}`, 14, 40);
        doc.text(`Absent: ${st.A}`, 14, 50);
        doc.text(`Late: ${st.Lt}`, 14, 60);
        doc.text(`Half-Day: ${st.HD}`, 14, 70);
        doc.text(`Leave: ${st.L}`, 14, 80);
        const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
        doc.text(`Attendance %: ${pct}%`, 14, 90);
        doc.text(`Outstanding: PKR ${st.outstanding}`, 14, 100);
        doc.text(`Status: ${st.status}`, 14, 110);
        const fileName = `analytics_${st.adm}_${st.name}.pdf`;
        doc.save(fileName);
      }
    }
  };

  shareAnalyticsBtn.onclick = () => {
    if (!lastAnalyticsShare) { alert("Load analytics first"); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, "_blank");
  };

  // ----------------------
  // 7. ATTENDANCE REGISTER SECTION
  // ----------------------
  const registerMonthInput = $("registerMonth");
  const loadRegisterBtn    = $("loadRegister");
  const registerHeader     = $("registerHeader");
  const registerBody       = $("registerBody");
  const registerTableWrapper = $("registerTableWrapper");
  const changeRegisterBtn  = $("changeRegister");
  const saveRegisterBtn    = $("saveRegister");
  const downloadRegisterBtn = $("downloadRegister");
  const shareRegisterBtn   = $("shareRegister");

  loadRegisterBtn.onclick = () => {
    const month = registerMonthInput.value; // format: YYYY-MM
    if (!month) { alert("Select month"); return; }
    const [y, m] = month.split("-").map(Number);
    const numDays = new Date(y, m, 0).getDate();
    // Build header
    registerHeader.innerHTML = `<th>Adm#</th><th>Name</th>`;
    for (let d = 1; d <= numDays; d++) {
      registerHeader.innerHTML += `<th>${String(d).padStart(2, "0")}</th>`;
    }
    // Build body
    registerBody.innerHTML = "";
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    const pool = students.filter(s => s.cls === cl && s.sec === sec);
    pool.forEach((s, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${s.adm}</td><td>${s.name}</td>`;
      for (let d = 1; d <= numDays; d++) {
        const day = `${month}-${String(d).padStart(2, "0")}`;
        const status = attendanceData[day]?.[s.adm] || "";
        tr.innerHTML += `<td>${status}</td>`;
      }
      registerBody.appendChild(tr);
    });
    show(registerTableWrapper, changeRegisterBtn, saveRegisterBtn, shareRegisterBtn);
    hide(downloadRegisterBtn);
  };

  changeRegisterBtn.onclick = () => {
    hide(registerTableWrapper, changeRegisterBtn, saveRegisterBtn, shareRegisterBtn);
    registerMonthInput.value = "";
  };

  saveRegisterBtn.onclick = async () => {
    // For simplicity, we only allow saving register by re‐marking attendance manually via “Mark Attendance” flow.
    alert("To modify/save register, please use the “Mark Attendance” section for each date.");
  };

  downloadRegisterBtn.onclick = async () => {
    alert("Download not implemented for register view. Use Analytics or Attendance report exports.");
  };

  shareRegisterBtn.onclick = () => {
    alert("Share not implemented for register view. Use other share buttons for Attendance/Analytics.");
  };

  // ----------------------
  // Reset Views: Hide/Show sections based on whether setup is complete
  // ----------------------
  function resetViews() {
    // If setup is incomplete (i.e. currentSchool/class/section is null), hide everything except #teacher-setup section.
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
      allSections.forEach(sec => sec && hide(sec));
    } else {
      allSections.forEach(sec => sec && show(sec));
    }
  }

  // Immediately run resetViews() so that on first load, only Setup is visible if not done
  resetViews();

  // ----------------------
  // Utility: Share PDF via Web Share API
  // ----------------------
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
});
