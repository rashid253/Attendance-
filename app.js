// app (27).js

// =======================
// IMPORTS & INITIAL SETUP
// =======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  set as dbSet,
  get as dbGet
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

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

// IndexedDB helper (idb-keyval must be loaded in your HTML)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// =======================
// GLOBAL STATE
// =======================
let studentsBySchool = {};
let attendanceDataBySchool = {};
let paymentsDataBySchool = {};
let lastAdmNoBySchool = {};
let fineRates = { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct = 75;
let schools = [];
let currentSchool = null;
let teacherClass = null;
let teacherSection = null;

let students = [];
let attendanceData = {};
let paymentsData = {};
let lastAdmNo = 0;

// =======================
// ENSURE DATA STRUCTURES FOR A SCHOOL
// =======================
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

// =======================
// INITIALIZE LOCAL STATE
// =======================
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

// =======================
// SYNC LOCAL STATE TO FIREBASE
// =======================
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
    await dbSet(dbRef(database, "appData"), payload);
    console.log("✅ Synced data to Firebase");
  } catch (err) {
    console.error("Firebase sync failed:", err);
  }
}

// =======================
// DOMContentLoaded: MAIN INITIALIZATION
// =======================
window.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);

  // Load local state from IndexedDB
  await initLocalState();

  // ----------------------
  // RESET VIEWS BASED ON SETUP
  // ----------------------
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
  resetViews();

  // ----------------------
  // ERUDA FOR DEBUGGING (OPTIONAL)
  // ----------------------
  const erudaScript = document.createElement("script");
  erudaScript.src = "https://cdn.jsdelivr.net/npm/eruda";
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // ----------------------
  // GENERATE NEW ADMISSION NUMBER (PER SCHOOL)
  // ----------------------
  async function genAdmNo() {
    lastAdmNo++;
    lastAdmNoBySchool[currentSchool] = lastAdmNo;
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
    await syncToFirebase();
    return String(lastAdmNo).padStart(4, "0");
  }

  // =======================
  // 1) SETUP SECTION
  // =======================
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
        <button data-idx="${idx}" class="edit-school">✎</button>
        <button data-idx="${idx}" class="delete-school">🗑</button>
      `;
      schoolListDiv.appendChild(row);
    });
    document.querySelectorAll(".edit-school").forEach(btn => {
      btn.onclick = async () => {
        const idx = +btn.dataset.idx;
        const oldName = schools[idx];
        const newName = prompt("Edit School Name:", oldName);
        if (!newName?.trim()) return;
        schools[idx] = newName.trim();
        await idbSet("schools", schools);

        // Migrate data under newName key
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
      };
    });
    document.querySelectorAll(".delete-school").forEach(btn => {
      btn.onclick = async () => {
        const idx = +btn.dataset.idx;
        if (!confirm(`Delete school "${schools[idx]}"?`)) return;
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
      setupForm.classList.add("hidden");
      setupDisplay.classList.remove("hidden");

      resetViews();

      // After setup completes, render students and counters
      setTimeout(() => {
        renderStudents();
        updateCounters();
      }, 0);

    } else {
      setupForm.classList.remove("hidden");
      setupDisplay.classList.add("hidden");
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
    setupForm.classList.remove("hidden");
    setupDisplay.classList.add("hidden");
    resetViews();
  };

  // ----------------------
  // 2) FINANCIAL SETTINGS SECTION
  // ----------------------
  const formDiv             = $("financialForm");
  const saveSettings        = $("saveSettings");
  const fineAbsentInputComp     = $("fineAbsent");
  const fineLateInputComp       = $("fineLate");
  const fineLeaveInputComp      = $("fineLeave");
  const fineHalfDayInputComp    = $("fineHalfDay");
  const eligibilityPctInputComp = $("eligibilityPct");

  const settingsCard = document.createElement("div");
  const editSettings = document.createElement("button");
  settingsCard.id = "settingsCard";
  settingsCard.className = "card hidden";
  editSettings.id = "editSettings";
  editSettings.className = "btn no-print hidden";
  editSettings.textContent = "Edit Settings";
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editSettings);

  fineAbsentInputComp.value     = fineRates.A;
  fineLateInputComp.value       = fineRates.Lt;
  fineLeaveInputComp.value      = fineRates.L;
  fineHalfDayInputComp.value    = fineRates.HD;
  eligibilityPctInputComp.value = eligibilityPct;

  saveSettings.onclick = async () => {
    fineRates = {
      A: Number(fineAbsentInputComp.value) || 0,
      Lt: Number(fineLateInputComp.value) || 0,
      L: Number(fineLeaveInputComp.value) || 0,
      HD: Number(fineHalfDayInputComp.value) || 0,
    };
    eligibilityPct = Number(eligibilityPctInputComp.value) || 0;
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
    formDiv.classList.add("hidden");
    saveSettings.classList.add("hidden");
    editSettings.classList.remove("hidden");
    settingsCard.classList.remove("hidden");
  };

  editSettings.onclick = () => {
    settingsCard.classList.add("hidden");
    editSettings.classList.add("hidden");
    formDiv.classList.remove("hidden");
    saveSettings.classList.remove("hidden");
  };

  // ----------------------
  // 3) COUNTERS SECTION
  // ----------------------
  const countersContainerComp = $("countersContainer");

  function createCounterCardComp(id, title, spanId) {
    const card = document.createElement("div");
    card.className = "counter-card";
    card.id = id;
    card.innerHTML = `
      <div class="card-content">
        <p class="card-title">${title}</p>
        <p class="card-number"><span id="${spanId}" data-target="0">0</span></p>
      </div>`;
    countersContainerComp.appendChild(card);
    return card;
  }

  // Create all seven cards so that their spans exist
  const sectionCardComp     = createCounterCardComp("card-section", "Section",        "sectionCount");
  const classCardComp       = createCounterCardComp("card-class",   "Class",          "classCount");
  const schoolCardComp      = createCounterCardComp("card-school",  "School",         "schoolCount");
  const attendanceCardComp  = createCounterCardComp("card-attendance", "Attendance", "attendanceCount");
  const eligibleCardComp    = createCounterCardComp("card-eligible",   "Eligible",   "eligibleCount");
  const debarredCardComp    = createCounterCardComp("card-debarred",   "Debarred",   "debarredCount");
  const outstandingCardComp = createCounterCardComp("card-outstanding","Outstanding/Fine","outstandingCount");

  const sectionCountSpanComp     = $("sectionCount");
  const classCountSpanComp       = $("classCount");
  const schoolCountSpanComp      = $("schoolCount");
  const attendanceCountSpanComp  = $("attendanceCount");
  const eligibleCountSpanComp    = $("eligibleCount");
  const debarredCountSpanComp    = $("debarredCount");
  const outstandingCountSpanComp = $("outstandingCount");

  function animateCountersComp() {
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

  function updateCountersComp() {
    const cl  = classSelect.value;
    const sec = sectionSelect.value;

    // Section count
    const sectionStudents = students.filter(s => s.cls === cl && s.sec === sec);
    sectionCountSpanComp.dataset.target = sectionStudents.length;

    // Class count
    const classStudents = students.filter(s => s.cls === cl);
    classCountSpanComp.dataset.target = classStudents.length;

    // School total
    schoolCountSpanComp.dataset.target = students.length;

    // Attendance summary
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
    attendanceCountSpanComp.dataset.target = (totalP + totalA + totalLt + totalHD + totalL);

    // Eligible, Debarred, Outstanding
    let eligibleCount = 0, debarredCount = 0, outstandingCount = 0;
    students.forEach(s => {
      if (s.cls !== cl || s.sec !== sec) return;
      let p=0, a=0, lt=0, hd=0, l=0, totalDays=0;
      Object.values(attendanceData).forEach(rec => {
        if (rec[s.adm]) {
          totalDays++;
          if (rec[s.adm] === "P") p++;
        }
      });
      const pct = totalDays ? (p / totalDays) * 100 : 0;
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
      if (outstanding <= 0 && pct >= eligibilityPct) eligibleCount++;
      else debarredCount++;
      if (outstanding > 0) outstandingCount++;
    });
    eligibleCountSpanComp.dataset.target    = eligibleCount;
    debarredCountSpanComp.dataset.target    = debarredCount;
    outstandingCountSpanComp.dataset.target = outstandingCount;

    animateCountersComp();
  }

  // Handlers for clicking on each counter card
  sectionCardComp.onclick = () => {
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    const list = students
      .filter(s => s.cls === cl && s.sec === sec)
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Class ${cl} Section ${sec}:\n\n${list || "No students found."}`);
  };

  classCardComp.onclick = () => {
    const cl = classSelect.value;
    const list = students
      .filter(s => s.cls === cl)
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}`)
      .join("\n");
    alert(`Class ${cl} (All Sections):\n\n${list || "No students found."}`);
  };

  schoolCardComp.onclick = () => {
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

  attendanceCardComp.onclick = () => {
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    let totalP = 0, totalA = 0, totalLt = 0, totalHD = 0, totalL = 0;
    Object.entries(attendanceData).forEach(([date, rec]) => {
      students.filter(s => s.cls === cl && s.sec === sec).forEach(s => {
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

  eligibleCardComp.onclick = () => {
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

  debarredCardComp.onclick = () => {
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

  outstandingCardComp.onclick = () => {
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

  // =======================
  // 4) STUDENT REGISTRATION SECTION
  // =======================
  const studentsBodyComp            = $("studentsBody");
  const selectAllStudentsComp       = $("selectAllStudents");
  const editSelectedBtnComp         = $("editSelected");
  const doneEditingBtnComp          = $("doneEditing");
  const deleteSelectedBtnComp       = $("deleteSelected");
  const saveRegistrationBtnComp     = $("saveRegistration");
  const editRegistrationBtnComp     = $("editRegistration");
  const shareRegistrationBtnComp    = $("shareRegistration");
  const downloadRegistrationBtnComp = $("downloadRegistrationPDF");

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
    updateCountersComp();

    // Clear form fields
    $("studentName").value      = "";
    $("parentName").value       = "";
    $("parentContact").value    = "";
    $("parentOccupation").value = "";
    $("parentAddress").value    = "";
  };

  function renderStudents() {
    const cl  = classSelect.value;
    const sec = sectionSelect.value;
    studentsBodyComp.innerHTML = "";
    let idx = 0;
    students.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
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
      studentsBodyComp.appendChild(tr);
    });
    selectAllStudentsComp.checked = false;
    toggleButtonsComp();
    document.querySelectorAll(".add-payment-btn").forEach(b => {
      b.onclick = () => openPaymentModal(b.dataset.adm);
    });
  }

  function toggleButtonsComp() {
    const any = !!document.querySelector(".sel:checked");
    editSelectedBtnComp.disabled   = !any;
    deleteSelectedBtnComp.disabled = !any;
  }

  studentsBodyComp.addEventListener("change", e => {
    if (e.target.classList.contains("sel")) toggleButtonsComp();
  });

  selectAllStudentsComp.onclick = () => {
    document.querySelectorAll(".sel").forEach(c => c.checked = selectAllStudentsComp.checked);
    toggleButtonsComp();
  };

  editSelectedBtnComp.onclick = () => {
    document.querySelectorAll(".sel:checked").forEach(cb => {
      const tr = cb.closest("tr"), i = +tr.dataset.index;
      const s = students[i];
      // Replace cells 2,4,5,6,7 with inputs
      tr.cells[2].innerHTML = `<input value="${s.name}">`;
      tr.cells[4].innerHTML = `<input value="${s.parent}">`;
      tr.cells[5].innerHTML = `<input value="${s.contact}">`;
      tr.cells[6].innerHTML = `<input value="${s.occupation}">`;
      tr.cells[7].innerHTML = `<input value="${s.address}">`;
    });
    editSelectedBtnComp.classList.add("hidden");
    deleteSelectedBtnComp.classList.add("hidden");
    doneEditingBtnComp.classList.remove("hidden");
  };

  doneEditingBtnComp.onclick = async () => {
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
    doneEditingBtnComp.classList.add("hidden");
    editSelectedBtnComp.classList.remove("hidden");
    deleteSelectedBtnComp.classList.remove("hidden");
    saveRegistrationBtnComp.classList.remove("hidden");
    renderStudents();
    updateCountersComp();
  };

  deleteSelectedBtnComp.onclick = async () => {
    if (!confirm("Delete selected students?")) return;
    const toDel = [...document.querySelectorAll(".sel:checked")].map(cb => +cb.closest("tr").dataset.index);
    students = students.filter((_, i) => !toDel.includes(i));
    studentsBySchool[currentSchool] = students;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    renderStudents();
    updateCountersComp();
  };

  saveRegistrationBtnComp.onclick = async () => {
    if (!doneEditingBtnComp.classList.contains("hidden")) { alert("Finish editing before saving."); return; }
    studentsBySchool[currentSchool] = students;
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    // Hide row-inline controls and show share/download
    $("student-registration").querySelector(".row-inline").classList.add("hidden");
    editSelectedBtnComp.classList.add("hidden");
    deleteSelectedBtnComp.classList.add("hidden");
    selectAllStudentsComp.classList.add("hidden");
    saveRegistrationBtnComp.classList.add("hidden");
    editRegistrationBtnComp.classList.remove("hidden");
    shareRegistrationBtnComp.classList.remove("hidden");
    downloadRegistrationBtnComp.classList.remove("hidden");
    renderStudents();
    updateCountersComp();
  };

  editRegistrationBtnComp.onclick = () => {
    $("student-registration").querySelector(".row-inline").classList.remove("hidden");
    selectAllStudentsComp.classList.remove("hidden");
    editSelectedBtnComp.classList.remove("hidden");
    deleteSelectedBtnComp.classList.remove("hidden");
    saveRegistrationBtnComp.classList.remove("hidden");
    editRegistrationBtnComp.classList.add("hidden");
    shareRegistrationBtnComp.classList.add("hidden");
    downloadRegistrationBtnComp.classList.add("hidden");
    renderStudents();
    updateCountersComp();
  };

  shareRegistrationBtnComp.onclick = () => {
    const header = `*Student Registration List*\n${setupText.textContent}\n\n`;
    const lines = students
      .filter(s => s.cls === classSelect.value && s.sec === sectionSelect.value)
      .map((s, i) => `${i + 1}. Adm#: ${s.adm}  Name: ${s.name}  Parent: ${s.parent}`);
    window.open("https://wa.me/?text=" + encodeURIComponent(header + lines.join("\n")), "_blank");
  };

  downloadRegistrationBtnComp.onclick = async () => {
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
      </tr>`;
    let idx = 0;
    students.forEach((s) => {
      if (s.cls !== classSelect.value || s.sec !== sectionSelect.value) return;
      idx++;
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${idx}</td>
        <td>${s.adm}</td>
        <td>${s.name}</td>
        <td>${s.parent}</td>
        <td>${s.contact}</td>
        <td>${s.occupation}</td>
        <td>${s.address}</td>
      `;
      tempTable.appendChild(row);
    });

    doc.autoTable({ html: tempTable, startY: 50 });
    const blob = doc.output("blob");
    sharePdf(blob, "Student_Registration_List.pdf", "Student Registration List");
  };

  // Placeholder for openPaymentModal
  function openPaymentModal(adm) {
    // Your payment modal code here
  }

  // Finally, run initial setup loader
  await loadSetup();
});
