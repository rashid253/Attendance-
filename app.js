// ---------------------------------------------
// app.js (Complete & Updated for All Features)
// ---------------------------------------------

// 1. IMPORTS & INITIALIZATION
import { auth, database } from "./firebase-config.js";
import {
  ref as dbRef,
  set as dbSet,
  get as dbGet,
  onValue,
  push,
  child,
  remove
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// IndexedDB helpers (idb-keyval IIFE must be loaded in HTML)
const { get: idbGet, set: idbSet } = window.idbKeyval;

// Reference to Firebase “appData” node
const appDataRef = dbRef(database, "appData");

// ------------------------------------------------------
// 2. GLOBAL STATE (per-school mappings & app variables)
// ------------------------------------------------------
let studentsBySchool       = {}; // { schoolName: [ {...student}, ... ] }
let attendanceDataBySchool = {}; // { schoolName: { "YYYY-MM-DD": { adm: status, ... } } }
let paymentsDataBySchool   = {}; // { schoolName: { adm: [ { date, amount }, ... ] } }
let lastAdmNoBySchool      = {}; // { schoolName: lastAdmissionNumber }

let fineRates      = { A: 50, Lt: 20, L: 10, HD: 30 }; // default fines
let eligibilityPct = 75; // default eligibility percentage
let schools        = []; // array of school names

// These three are written by setup.js or overwritten for teacher role:
let currentSchool    = null; // selected school name
let teacherClass     = null; // e.g. "Class Eight"
let teacherSection   = null; // e.g. "A"

// For the *active* school, these mirror the above mappings
let students       = [];    // reference to studentsBySchool[currentSchool]
let attendanceData = {};    // reference to attendanceDataBySchool[currentSchool]
let paymentsData   = {};    // reference to paymentsDataBySchool[currentSchool]
let lastAdmNo      = 0;     // reference to lastAdmNoBySchool[currentSchool]

// ------------------------------------------------------
// 3. LISTEN FOR “userLoggedIn” EVENT (from auth.js/setup.js)
// ------------------------------------------------------
document.addEventListener("userLoggedIn", async () => {
  // Fetch everything from Firebase once on login
  try {
    const snap = await dbGet(appDataRef);
    if (snap.exists()) {
      const appData = snap.val();
      studentsBySchool       = appData.studentsBySchool       || {};
      attendanceDataBySchool = appData.attendanceDataBySchool || {};
      paymentsDataBySchool   = appData.paymentsDataBySchool   || {};
      lastAdmNoBySchool      = appData.lastAdmNoBySchool      || {};
      fineRates              = appData.fineRates              || fineRates;
      eligibilityPct         = appData.eligibilityPct         || eligibilityPct;
      schools                = appData.schools                || [];
      currentSchool          = appData.currentSchool          || null;
      teacherClass           = appData.teacherClass           || null;
      teacherSection         = appData.teacherSection         || null;
    }
  } catch (err) {
    console.error("Error loading appData from Firebase:", err);
  }

  // If current user is a teacher, override school/class/section from their profile
  const profile = window.currentUserProfile;
  if (profile && profile.role === "teacher") {
    currentSchool  = profile.school;
    teacherClass   = profile.class;
    teacherSection = profile.section;
  }

  // Once we have currentSchool/class/section, ensure data structures exist
  if (currentSchool && teacherClass && teacherSection) {
    await ensureSchoolData(currentSchool);

    students       = studentsBySchool[currentSchool];
    attendanceData = attendanceDataBySchool[currentSchool];
    paymentsData   = paymentsDataBySchool[currentSchool];
    lastAdmNo      = lastAdmNoBySchool[currentSchool] || 0;

    await initLocalState();

    resetViews();
    renderStudents();
    updateCounters();
  }
});

// ------------------------------------------------------
// 4. ENSURE STRUCTURE FOR A GIVEN SCHOOL EXISTS (IndexedDB & RAM)
// ------------------------------------------------------
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

// ------------------------------------------------------
// 5. INITIALIZE LOCAL STATE FROM IndexedDB
// ------------------------------------------------------
async function initLocalState() {
  studentsBySchool       = (await idbGet("studentsBySchool"))       || studentsBySchool;
  attendanceDataBySchool = (await idbGet("attendanceDataBySchool")) || attendanceDataBySchool;
  paymentsDataBySchool   = (await idbGet("paymentsDataBySchool"))   || paymentsDataBySchool;
  lastAdmNoBySchool      = (await idbGet("lastAdmNoBySchool"))      || lastAdmNoBySchool;
  fineRates              = (await idbGet("fineRates"))              || fineRates;
  eligibilityPct         = (await idbGet("eligibilityPct"))         || eligibilityPct;
  schools                = (await idbGet("schools"))                || schools;
  currentSchool          = (await idbGet("currentSchool"))          || currentSchool;
  teacherClass           = (await idbGet("teacherClass"))           || teacherClass;
  teacherSection         = (await idbGet("teacherSection"))         || teacherSection;

  if (currentSchool) {
    await ensureSchoolData(currentSchool);
    students       = studentsBySchool[currentSchool];
    attendanceData = attendanceDataBySchool[currentSchool];
    paymentsData   = paymentsDataBySchool[currentSchool];
    lastAdmNo      = lastAdmNoBySchool[currentSchool] || 0;
  }
}

// ------------------------------------------------------
// 6. SYNC ENTIRE appData BACK TO Firebase
// ------------------------------------------------------
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

// ------------------------------------------------------
// 7. UTILITY: Generate Admission Number & Sync
// ------------------------------------------------------
async function genAdmNo() {
  lastAdmNo++;
  lastAdmNoBySchool[currentSchool] = lastAdmNo;
  await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
  await syncToFirebase();
  return String(lastAdmNo).padStart(4, "0");
}

// ------------------------------------------------------
// 8. VIEW MANAGEMENT (Hide/Show Sections Based on Setup)
// ------------------------------------------------------
const hide = (...els) => els.forEach(e => e && e.classList.add("hidden"));
const show = (...els) => els.forEach(e => e && e.classList.remove("hidden"));

function resetViews() {
  // Only Show “Setup” if setup incomplete; otherwise show all sections
  const setupDone = currentSchool && teacherClass && teacherSection;
  const allSections = [
    document.getElementById("financial-settings"),
    document.getElementById("animatedCounters"),
    document.getElementById("student-registration"),
    document.getElementById("attendance-section"),
    document.getElementById("analytics-section"),
    document.getElementById("register-section"),
    document.getElementById("chooseBackupFolder"),
    document.getElementById("restoreData"),
    document.getElementById("resetData"),
    document.getElementById("logoutBtn")
  ];
  if (!setupDone) {
    allSections.forEach(sec => sec && hide(sec));
  } else {
    allSections.forEach(sec => sec && show(sec));
  }
}

// ------------------------------------------------------
// 9. SETUP SECTION (Populate School List, Save/Edit Setup)
// ------------------------------------------------------
const setupForm      = document.getElementById("setupForm");
const setupDisplay   = document.getElementById("setupDisplay");
const schoolInput    = document.getElementById("schoolInput");
const schoolSelect   = document.getElementById("schoolSelect");
const classSelect    = document.getElementById("teacherClassSelect");
const sectionSelect  = document.getElementById("teacherSectionSelect");
const setupText      = document.getElementById("setupText");
const saveSetupBtn   = document.getElementById("saveSetup");
const editSetupBtn   = document.getElementById("editSetup");
const schoolListDiv  = document.getElementById("schoolList");

// Render list of existing schools (with edit/delete buttons)
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
  // Attach handlers
  document.querySelectorAll(".edit-school").forEach(btn => {
    btn.onclick = async () => {
      const idx = +btn.dataset.idx;
      const newName = prompt("Edit School Name:", schools[idx]);
      if (newName?.trim()) {
        const oldName = schools[idx];
        schools[idx] = newName.trim();
        await idbSet("schools", schools);

        // Rename all mappings in-memory & IndexedDB
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

      // Remove mappings
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
        teacherClass   = null;
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

async function loadSetup() {
  schools        = (await idbGet("schools"))       || [];
  currentSchool  = (await idbGet("currentSchool")) || currentSchool;
  teacherClass   = (await idbGet("teacherClass"))  || teacherClass;
  teacherSection = (await idbGet("teacherSection"))|| teacherSection;

  // Populate dropdown
  schoolSelect.innerHTML = [
    '<option disabled selected>-- Select School --</option>',
    ...schools.map(s => `<option value="${s}">${s}</option>`)
  ].join("");
  if (currentSchool) schoolSelect.value = currentSchool;

  renderSchoolList();

  if (currentSchool && teacherClass && teacherSection) {
    // Setup complete → show display
    await ensureSchoolData(currentSchool);
    students       = studentsBySchool[currentSchool];
    attendanceData = attendanceDataBySchool[currentSchool];
    paymentsData   = paymentsDataBySchool[currentSchool];
    lastAdmNo      = lastAdmNoBySchool[currentSchool] || 0;

    classSelect.value   = teacherClass;
    sectionSelect.value = teacherSection;
    setupText.textContent = `${currentSchool} 🏫 | Class: ${teacherClass} | Section: ${teacherSection}`;
    hide(setupForm);
    show(setupDisplay);

    // Show other sections now
    resetViews();
    renderStudents();
    updateCounters();
  } else {
    // Incomplete setup → hide everything else
    show(setupForm);
    hide(setupDisplay);
    resetViews();
  }
}

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
  loadSetup();
};

editSetupBtn.onclick = (e) => {
  e.preventDefault();
  show(setupForm);
  hide(setupDisplay);
  resetViews();
};

// Initialize setup on page load
window.addEventListener("DOMContentLoaded", loadSetup);

// ------------------------------------------------------
// 10. FINANCIAL SETTINGS SECTION
// ------------------------------------------------------
const formDiv             = document.getElementById("financialForm");
const saveSettings        = document.getElementById("saveSettings");
const fineAbsentInputElm  = document.getElementById("fineAbsent");
const fineLateInputElm    = document.getElementById("fineLate");
const fineLeaveInputElm   = document.getElementById("fineLeave");
const fineHalfDayInputElm = document.getElementById("fineHalfDay");
const eligibilityPctInputElm = document.getElementById("eligibilityPct");

// Container for card & edit button
const settingsCard = document.createElement("div");
settingsCard.id = "settingsCard";
settingsCard.className = "card hidden";
const editSettings = document.createElement("button");
editSettings.id = "editSettings";
editSettings.className = "btn no-print hidden";
editSettings.textContent = "Edit Settings";
formDiv.parentNode.appendChild(settingsCard);
formDiv.parentNode.appendChild(editSettings);

// Fill initial values
fineAbsentInputElm.value     = fineRates.A;
fineLateInputElm.value       = fineRates.Lt;
fineLeaveInputElm.value      = fineRates.L;
fineHalfDayInputElm.value    = fineRates.HD;
eligibilityPctInputElm.value = eligibilityPct;

saveSettings.onclick = async () => {
  fineRates = {
    A: Number(fineAbsentInputElm.value) || 0,
    Lt: Number(fineLateInputElm.value) || 0,
    L: Number(fineLeaveInputElm.value) || 0,
    HD: Number(fineHalfDayInputElm.value) || 0,
  };
  eligibilityPct = Number(eligibilityPctInputElm.value) || 0;
  await idbSet("fineRates", fineRates);
  await idbSet("eligibilityPct", eligibilityPct);
  await syncToFirebase();

  // Render card
  settingsCard.innerHTML = `
    <div class="card-content">
      <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
      <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
      <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
      <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
      <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
    </div>`;
  hide(formDiv, saveSettings, fineAbsentInputElm, fineLateInputElm, fineLeaveInputElm, fineHalfDayInputElm, eligibilityPctInputElm);
  show(settingsCard, editSettings);
};

editSettings.onclick = () => {
  hide(settingsCard, editSettings);
  show(formDiv, saveSettings, fineAbsentInputElm, fineLateInputElm, fineLeaveInputElm, fineHalfDayInputElm, eligibilityPctInputElm);
};

// ------------------------------------------------------
// 11. COUNTERS SECTION (Animated Cards)
// ------------------------------------------------------
const countersContainer = document.getElementById("countersContainer");

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

// Create all seven cards
createCounterCard("card-section",     "Section",         "sectionCount");
createCounterCard("card-class",       "Class",           "classCount");
createCounterCard("card-school",      "School",          "schoolCount");
createCounterCard("card-attendance",  "Attendance",      "attendanceCount");
createCounterCard("card-eligible",    "Eligible",        "eligibleCount");
createCounterCard("card-debarred",    "Debarred",        "debarredCount");
createCounterCard("card-outstanding", "Outstanding/Fine","outstandingCount");

// Grab spans
const sectionCountSpan     = document.getElementById("sectionCount");
const classCountSpan       = document.getElementById("classCount");
const schoolCountSpan      = document.getElementById("schoolCount");
const attendanceCountSpan  = document.getElementById("attendanceCount");
const eligibleCountSpan    = document.getElementById("eligibleCount");
const debarredCountSpan    = document.getElementById("debarredCount");
const outstandingCountSpan = document.getElementById("outstandingCount");

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

  // 1) Section Count
  const sectionStudents = students.filter(s => s.cls === cl && s.sec === sec);
  sectionCountSpan.dataset.target = sectionStudents.length;

  // 2) Class Count
  const classStudents = students.filter(s => s.cls === cl);
  classCountSpan.dataset.target = classStudents.length;

  // 3) School Count
  schoolCountSpan.dataset.target = students.length;

  // 4) Attendance Count (total records)
  let totalP=0, totalA=0, totalLt=0, totalHD=0, totalL=0;
  Object.entries(attendanceData).forEach(([date, rec]) => {
    sectionStudents.forEach(s => {
      const code = rec[s.adm];
      if (!code) totalA++;
      else {
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
  attendanceCountSpan.dataset.target = totalP + totalA + totalLt + totalHD + totalL;

  // 5–7) Eligible, Debarred, Outstanding
  let eligibleCount=0, debarredCount=0, outstandingCount=0;
  sectionStudents.forEach(s => {
    let p=0, a=0, lt=0, hd=0, l=0, totalDays=0;
    Object.values(attendanceData).forEach(rec => {
      if(rec[s.adm]) {
        totalDays++;
        switch(rec[s.adm]) {
          case "P": p++; break;
          case "A": a++; break;
          case "Lt": lt++; break;
          case "HD": hd++; break;
          case "L": l++; break;
        }
      }
    });
    const fineTotal = a*fineRates.A + lt*fineRates.Lt + l*fineRates.L + hd*fineRates.HD;
    const paid = (paymentsData[s.adm]||[]).reduce((sum,x)=>sum+x.amount, 0);
    const outstanding = fineTotal - paid;
    const perc = totalDays ? (p/totalDays)*100 : 0;
    if (outstanding > 0 || perc < eligibilityPct) debarredCount++;
    else eligibleCount++;
    if (outstanding > 0) outstandingCount++;
  });
  eligibleCountSpan.dataset.target    = eligibleCount;
  debarredCountSpan.dataset.target    = debarredCount;
  outstandingCountSpan.dataset.target = outstandingCount;

  animateCounters();
}

// Card click dialogs
document.getElementById("card-section").onclick = () => {
  const cl  = classSelect.value;
  const sec = sectionSelect.value;
  const list = students.filter(s => s.cls===cl && s.sec===sec)
                       .map((s,i)=>`${i+1}. Adm#: ${s.adm}  ${s.name}`)
                       .join("\n");
  alert(`Class ${cl} Section ${sec}:\n\n${list||"No students."}`);
};
document.getElementById("card-class").onclick = () => {
  const cl = classSelect.value;
  const list = students.filter(s => s.cls===cl)
                       .map((s,i)=>`${i+1}. Adm#: ${s.adm}  ${s.name}`)
                       .join("\n");
  alert(`Class ${cl} (All Sections):\n\n${list||"No students."}`);
};
document.getElementById("card-school").onclick = () => {
  const classesList = [...new Set(students.map(s=>s.cls))].sort();
  let details = "";
  classesList.forEach(cl => {
    const classStu = students.filter(s => s.cls===cl);
    details += `Class ${cl} (${classStu.length}):\n`;
    classStu.forEach((s,i) => {
      details += `  ${i+1}. Adm#: ${s.adm}  ${s.name}\n`;
    });
    details += "\n";
  });
  alert(`School Overview:\n\n${details||"No students."}`);
};
document.getElementById("card-attendance").onclick = () => {
  const cl  = classSelect.value;
  const sec = sectionSelect.value;
  let counts = { P:0, A:0, Lt:0, HD:0, L:0 };
  Object.values(attendanceData).forEach(rec => {
    students.filter(s=>s.cls===cl && s.sec===sec).forEach(s => {
      const code = rec[s.adm];
      if (!code) counts.A++;
      else {
        switch(code) {
          case "P": counts.P++; break;
          case "A": counts.A++; break;
          case "Lt": counts.Lt++; break;
          case "HD": counts.HD++; break;
          case "L": counts.L++; break;
        }
      }
    });
  });
  alert(
    `Attendance for Class ${cl} Section ${sec}:\n\n` +
    `Present   : ${counts.P}\n` +
    `Absent    : ${counts.A}\n` +
    `Late      : ${counts.Lt}\n` +
    `Half-Day  : ${counts.HD}\n` +
    `Leave     : ${counts.L}`
  );
};
document.getElementById("card-eligible").onclick = () => {
  const cl  = classSelect.value;
  const sec = sectionSelect.value;
  const list = students.filter(s => s.cls===cl && s.sec===sec).filter(s => {
    let p=0,a=0,lt=0,hd=0,l=0,totalDays=0;
    Object.values(attendanceData).forEach(rec => {
      if (rec[s.adm]) {
        totalDays++;
        switch(rec[s.adm]) {
          case "P": p++; break;
          case "A": a++; break;
          case "Lt": lt++; break;
          case "HD": hd++; break;
          case "L": l++; break;
        }
      }
    });
    const fineTotal = a*fineRates.A + lt*fineRates.Lt + l*fineRates.L + hd*fineRates.HD;
    const paid = (paymentsData[s.adm]||[]).reduce((sum,x)=>sum+x.amount, 0);
    const outstanding = fineTotal - paid;
    const perc = totalDays ? (p/totalDays)*100 : 0;
    return outstanding <= 0 && perc >= eligibilityPct;
  }).map((s,i)=>`${i+1}. Adm#: ${s.adm} ${s.name}`).join("\n");
  alert(`Eligible Students:\n\n${list||"None."}`);
};
document.getElementById("card-debarred").onclick = () => {
  const cl  = classSelect.value;
  const sec = sectionSelect.value;
  const list = students.filter(s => s.cls===cl && s.sec===sec).filter(s => {
    let p=0,a=0,lt=0,hd=0,l=0,totalDays=0;
    Object.values(attendanceData).forEach(rec => {
      if(rec[s.adm]) {
        totalDays++;
        switch(rec[s.adm]) {
          case "P": p++; break;
          case "A": a++; break;
          case "Lt": lt++; break;
          case "HD": hd++; break;
          case "L": l++; break;
        }
      }
    });
    const fineTotal = a*fineRates.A + lt*fineRates.Lt + l*fineRates.L + hd*fineRates.HD;
    const paid = (paymentsData[s.adm]||[]).reduce((sum,x)=>sum+x.amount, 0);
    const outstanding = fineTotal - paid;
    const perc = totalDays ? (p/totalDays)*100 : 0;
    return outstanding > 0 || perc < eligibilityPct;
  }).map((s,i)=>`${i+1}. Adm#: ${s.adm} ${s.name}`).join("\n");
  alert(`Debarred Students:\n\n${list||"None."}`);
};
document.getElementById("card-outstanding").onclick = () => {
  const cl  = classSelect.value;
  const sec = sectionSelect.value;
  const list = students.filter(s => s.cls===cl && s.sec===sec).filter(s => {
    let a=0,lt=0,hd=0,l=0;
    Object.values(attendanceData).forEach(rec => {
      if(rec[s.adm]) {
        switch(rec[s.adm]) {
          case "A": a++; break;
          case "Lt": lt++; break;
          case "HD": hd++; break;
          case "L": l++; break;
        }
      }
    });
    const fineTotal = a*fineRates.A + lt*fineRates.Lt + l*fineRates.L + hd*fineRates.HD;
    const paid = (paymentsData[s.adm]||[]).reduce((sum,x)=>sum+x.amount, 0);
    return (fineTotal - paid) > 0;
  }).map((s,i) => {
    let a=0,lt=0,hd=0,l=0;
    Object.values(attendanceData).forEach(rec => {
      if(rec[s.adm]) {
        switch(rec[s.adm]) {
          case "A": a++; break;
          case "Lt": lt++; break;
          case "HD": hd++; break;
          case "L": l++; break;
        }
      }
    });
    const fineTotal = a*fineRates.A + lt*fineRates.Lt + l*fineRates.L + hd*fineRates.HD;
    const paid = (paymentsData[s.adm]||[]).reduce((sum,x)=>sum+x.amount, 0);
    const out   = fineTotal - paid;
    return `${i+1}. Adm#: ${s.adm} ${s.name} – Outstanding: PKR ${out}`;
  }).join("\n");
  alert(`Students with Outstanding Fines:\n\n${list||"None."}`);
};

// ------------------------------------------------------
// 12. STUDENT REGISTRATION SECTION
// ------------------------------------------------------
const studentNameInput      = document.getElementById("studentName");
const parentNameInput       = document.getElementById("parentName");
const parentContactInput    = document.getElementById("parentContact");
const parentOccupationInput = document.getElementById("parentOccupation");
const parentAddressInput    = document.getElementById("parentAddress");
const addStudentBtn         = document.getElementById("addStudent");
const studentsBody          = document.getElementById("studentsBody");
const selectAllStudentsCb   = document.getElementById("selectAllStudents");
const editSelectedBtn       = document.getElementById("editSelected");
const doneEditingBtn        = document.getElementById("doneEditing");
const deleteSelectedBtn     = document.getElementById("deleteSelected");
const saveRegistrationBtn   = document.getElementById("saveRegistration");
const editRegistrationBtn   = document.getElementById("editRegistration");
const shareRegistrationBtn  = document.getElementById("shareRegistration");
const downloadRegistrationBtn = document.getElementById("downloadRegistrationPDF");

// Add Student
addStudentBtn.addEventListener("click", async () => {
  const n   = studentNameInput.value.trim();
  const p   = parentNameInput.value.trim();
  const c   = parentContactInput.value.trim();
  const o   = parentOccupationInput.value.trim();
  const a   = parentAddressInput.value.trim();
  const cl  = classSelect.value;
  const sec = sectionSelect.value;

  if (!n || !p || !c) {
    alert("فل ٹیکسٹ ضرور درج کریں: Name, Parent اور Contact۔");
    return;
  }
  if (!/^\d{7,15}$/.test(c)) {
    alert("Contact صحیح ڈِجِٹس میں ہونا چاہیے (7–15 digits)۔");
    return;
  }

  const adm = await genAdmNo();
  const newStu = {
    adm,
    name: n,
    parentName: p,
    contact: c,
    occupation: o,
    address: a,
    cls: cl,
    sec: sec,
    fine: 0,
    status: "Registered"
  };
  students.push(newStu);
  studentsBySchool[currentSchool] = students;
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();

  renderStudents();
  updateCounters();

  // Clear inputs
  studentNameInput.value      = "";
  parentNameInput.value       = "";
  parentContactInput.value    = "";
  parentOccupationInput.value = "";
  parentAddressInput.value    = "";
});

function renderStudents() {
  studentsBody.innerHTML = "";
  let idx = 0;
  students.forEach((s, i) => {
    if (s.cls !== classSelect.value || s.sec !== sectionSelect.value) return;
    idx++;
    // Compute fine & status dynamically
    let a=0, lt=0, hd=0, l=0;
    Object.values(attendanceData).forEach(rec => {
      if (rec[s.adm]) {
        switch(rec[s.adm]) {
          case "A": a++; break;
          case "Lt": lt++; break;
          case "HD": hd++; break;
          case "L": l++; break;
        }
      }
    });
    const fineTotal = a*fineRates.A + lt*fineRates.Lt + l*fineRates.L + hd*fineRates.HD;
    const paid = (paymentsData[s.adm]||[]).reduce((sum,x)=>sum+x.amount,0);
    const outstanding = fineTotal - paid;
    const totalDays = Object.values(attendanceData).reduce((cnt, rec) => rec[s.adm] ? cnt+1 : cnt, 0);
    const presentDays = Object.values(attendanceData).reduce((cnt, rec) => rec[s.adm] && rec[s.adm] !== "A" ? cnt+1 : cnt, 0);
    const perc = totalDays ? (presentDays/totalDays)*100 : 0;
    const status = (outstanding > 0 || perc < eligibilityPct) ? "Debarred" : "Eligible";

    const tr = document.createElement("tr");
    tr.dataset.index = i;
    tr.innerHTML = `
      <td><input type="checkbox" class="stuCheckbox" data-index="${i}" /></td>
      <td>${idx}</td>
      <td>${s.name}</td>
      <td>${s.adm}</td>
      <td>${s.parentName}</td>
      <td>${s.contact}</td>
      <td>${s.occupation}</td>
      <td>${s.address}</td>
      <td>PKR ${outstanding}</td>
      <td>${status}</td>
      <td><button class="add-payment-btn btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
    `;
    studentsBody.appendChild(tr);
  });

  selectAllStudentsCb.checked = false;
  toggleStudentActions();

  document.querySelectorAll(".stuCheckbox").forEach(cb => {
    cb.onchange = toggleStudentActions;
  });
  editSelectedBtn.disabled   = true;
  deleteSelectedBtn.disabled = true;

  document.querySelectorAll(".add-payment-btn").forEach(btn => {
    btn.onclick = () => openPaymentModal(btn.dataset.adm);
  });
}

function toggleStudentActions() {
  const checkedCount = document.querySelectorAll(".stuCheckbox:checked").length;
  editSelectedBtn.disabled   = checkedCount !== 1;
  deleteSelectedBtn.disabled = checkedCount === 0;
}

editSelectedBtn.onclick = () => {
  const cb = document.querySelector(".stuCheckbox:checked");
  if (!cb) return;
  const idx = +cb.dataset.index;
  enterEditMode(idx);
};

doneEditingBtn.onclick = async () => {
  const idx = +doneEditingBtn.dataset.index;
  const s   = students[idx];
  const name       = studentNameInput.value.trim();
  const parentName = parentNameInput.value.trim();
  const contact    = parentContactInput.value.trim();
  const occupation = parentOccupationInput.value.trim();
  const address    = parentAddressInput.value.trim();

  if (!name) {
    alert("Student Name لازماً درج کریں۔");
    return;
  }
  s.name       = name;
  s.parentName = parentName;
  s.contact    = contact;
  s.occupation = occupation;
  s.address    = address;

  studentsBySchool[currentSchool] = students;
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();

  exitEditMode();
  renderStudents();
  updateCounters();
};

function enterEditMode(index) {
  const s = students[index];
  studentNameInput.value      = s.name;
  parentNameInput.value       = s.parentName;
  parentContactInput.value    = s.contact;
  parentOccupationInput.value = s.occupation;
  parentAddressInput.value    = s.address;

  addStudentBtn.classList.add("hidden");
  editSelectedBtn.classList.add("hidden");
  deleteSelectedBtn.classList.add("hidden");

  doneEditingBtn.classList.remove("hidden");
  doneEditingBtn.dataset.index = index;
}

function exitEditMode() {
  studentNameInput.value      = "";
  parentNameInput.value       = "";
  parentContactInput.value    = "";
  parentOccupationInput.value = "";
  parentAddressInput.value    = "";

  addStudentBtn.classList.remove("hidden");
  editSelectedBtn.classList.remove("hidden");
  deleteSelectedBtn.classList.remove("hidden");
  doneEditingBtn.classList.add("hidden");
}

deleteSelectedBtn.onclick = async () => {
  const checkedCbs = document.querySelectorAll(".stuCheckbox:checked");
  if (!checkedCbs.length) return;
  if (!confirm(`Delete ${checkedCbs.length} selected student(s)?`)) return;
  const indices = Array.from(checkedCbs).map(cb => +cb.dataset.index).sort((a,b)=>b-a);
  indices.forEach(i => students.splice(i,1));
  studentsBySchool[currentSchool] = students;
  await idbSet("studentsBySchool", studentsBySchool);
  await syncToFirebase();
  renderStudents();
  updateCounters();
};

saveRegistrationBtn.onclick = async () => {
  await idbSet("studentsBySchool", studentsBySchool);
  await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
  await syncToFirebase();
  alert("Registration saved successfully.");
};

editRegistrationBtn.onclick = () => {
  show(addStudentBtn, selectAllStudentsCb, editSelectedBtn, deleteSelectedBtn, saveRegistrationBtn);
  hide(editRegistrationBtn, shareRegistrationBtn, downloadRegistrationBtn);
  renderStudents();
  updateCounters();
};

// ------------------------------------------------------
// 13. PAYMENT MODAL SECTION
// ------------------------------------------------------
const paymentModal         = document.getElementById("paymentModal");
const payAdmSpan           = document.getElementById("payAdm");
const paymentAmountInput   = document.getElementById("paymentAmount");
const paymentModalCloseBtn = document.getElementById("paymentModalClose");
const savePaymentBtn       = document.getElementById("savePayment");
const cancelPaymentBtn     = document.getElementById("cancelPayment");

function openPaymentModal(adm) {
  payAdmSpan.textContent = adm;
  paymentAmountInput.value = "";
  show(paymentModal);
}
paymentModalCloseBtn.onclick = () => hide(paymentModal);
cancelPaymentBtn.onclick = () => hide(paymentModal);
savePaymentBtn.onclick = async () => {
  const adm = payAdmSpan.textContent;
  const amt = Number(paymentAmountInput.value) || 0;
  paymentsData[adm] = paymentsData[adm] || [];
  paymentsData[adm].push({
    date: new Date().toISOString().split("T")[0],
    amount: amt
  });
  paymentsDataBySchool[currentSchool] = paymentsData;
  await idbSet("paymentsDataBySchool", paymentsDataBySchool);
  await syncToFirebase();
  hide(paymentModal);
  renderStudents();
  updateCounters();
};

// ------------------------------------------------------
// 14. ATTENDANCE SECTION
// ------------------------------------------------------
const dateInputElm        = document.getElementById("dateInput");
const loadAttendanceBtn   = document.getElementById("loadAttendance");
const attendanceBodyDiv   = document.getElementById("attendanceBody");
const attendanceSummaryDiv= document.getElementById("attendanceSummary");
const saveAttendanceBtn   = document.getElementById("saveAttendance");
const resetAttendanceBtn  = document.getElementById("resetAttendance");
const downloadAttendanceBtn = document.getElementById("downloadAttendancePDF");
const shareAttendanceSummaryBtn = document.getElementById("shareAttendanceSummary");

const statusNames  = { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" };
const statusColors = { P:"var(--success)", A:"var(--danger)", Lt:"var(--warning)", HD:"#FF9800", L:"var(--info)" };

loadAttendanceBtn.onclick = () => {
  const date = dateInputElm.value;
  if (!date) {
    alert("برائے مہربانی تاریخ منتخب کریں۔");
    return;
  }
  renderAttendanceTable(date);
};

function renderAttendanceTable(date) {
  attendanceBodyDiv.innerHTML = "";
  attendanceSummaryDiv.innerHTML = "";
  hide(attendanceSummaryDiv, resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceSummaryBtn);

  if (!attendanceData[date]) {
    attendanceData[date] = {};
  }

  students.filter(s => s.cls===classSelect.value && s.sec===sectionSelect.value)
          .forEach((stu,i) => {
    const row = document.createElement("div");
    row.className = "attendance-row";
    const headerDiv = document.createElement("div");
    headerDiv.className = "attendance-header";
    headerDiv.textContent = `${i+1}. ${stu.name} (${stu.adm})`;

    const btnsDiv = document.createElement("div");
    btnsDiv.className = "attendance-buttons";
    Object.keys(statusNames).forEach(code => {
      const btn = document.createElement("button");
      btn.className = "att-btn";
      btn.textContent = code;
      if (attendanceData[date][stu.adm] === code) {
        btn.classList.add("selected");
        btn.style.background = statusColors[code];
        btn.style.color = "#fff";
      }
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

  show(attendanceBodyDiv, saveAttendanceBtn, resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceSummaryBtn);
}

saveAttendanceBtn.onclick = async () => {
  const date = dateInputElm.value;
  if (!date) return;
  students.filter(s => s.cls===classSelect.value && s.sec===sectionSelect.value)
    .forEach((s,i) => {
      const selBtn = attendanceBodyDiv.children[i].querySelector(".att-btn.selected");
      attendanceData[date][s.adm] = selBtn ? selBtn.textContent : "A";
    });
  attendanceDataBySchool[currentSchool] = attendanceData;
  await idbSet("attendanceDataBySchool", attendanceDataBySchool);
  await syncToFirebase();
  alert(`Attendance for ${date} saved!`);
  calculateAttendanceSummary(date);
};

resetAttendanceBtn.onclick = () => {
  const date = dateInputElm.value;
  if (attendanceData[date]) {
    delete attendanceData[date];
    attendanceDataBySchool[currentSchool] = attendanceData;
    idbSet("attendanceDataBySchool", attendanceDataBySchool);
    syncToFirebase();
    renderAttendanceTable(date);
  }
};

function calculateAttendanceSummary(date) {
  attendanceSummaryDiv.innerHTML = `<h3>Attendance Summary: ${date}</h3>`;
  const tbl = document.createElement("table");
  tbl.id = "attendanceSummaryTable";
  tbl.className = "table";
  tbl.innerHTML = `
    <tr>
      <th>Sr#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th>
    </tr>`;
  students.filter(s => s.cls===classSelect.value && s.sec===sectionSelect.value)
    .forEach((s,i) => {
      const code = attendanceData[date][s.adm] || "A";
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
      const date = dateInputElm.value;
      const msg = `Dear Parent, your child (Adm#: ${adm}) was ${statusNames[attendanceData[date][adm]]} on ${date}.`;
      window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`, "_blank");
    };
  });

  show(attendanceSummaryDiv);
}

downloadAttendanceBtn.onclick = async () => {
  const date = dateInputElm.value;
  if (!date) return;
  const doc = new jspdf.jsPDF();
  const w = doc.internal.pageSize.getWidth();
  doc.setFontSize(18); doc.text("Attendance Report", 14, 16);
  doc.setFontSize(10); doc.text(`Date: ${date}`, w - 14, 16, { align: "right" });
  doc.setFontSize(12); doc.text(setupText.textContent, 14, 24);
  doc.autoTable({ startY: 30, html: "#attendanceSummaryTable" });
  const fileName = `attendance_${date}.pdf`;
  doc.save(fileName);
};

shareAttendanceSummaryBtn.onclick = () => {
  const cl   = classSelect.value;
  const sec  = sectionSelect.value;
  const date = dateInputElm.value;
  let msg = `*Attendance Report*\nClass ${cl} Sec ${sec} - ${date}\n\n`;
  students.filter(s=>s.cls===cl && s.sec===sec).forEach((s,i) => {
    const code = attendanceData[date][s.adm] || "A";
    msg += `${i+1}. Adm#: ${s.adm} – ${statusNames[code]}\n`;
  });
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
};

// ------------------------------------------------------
// 15. ANALYTICS SECTION (Attendance+Fine Stats + Charts)
// ------------------------------------------------------
const analyticsTargetSelect    = document.getElementById("analyticsTarget");
const analyticsSectionSelect   = document.getElementById("analyticsSectionSelect");
const analyticsTypeSelect      = document.getElementById("analyticsType");
const analyticsDateInput       = document.getElementById("analyticsDate");
const analyticsMonthInput      = document.getElementById("analyticsMonth");
const semesterStartInput       = document.getElementById("semesterStart");
const semesterEndInput         = document.getElementById("semesterEnd");
const yearStartInput           = document.getElementById("yearStart");
const analyticsSearchInput     = document.getElementById("analyticsSearch");
const loadAnalyticsBtn         = document.getElementById("loadAnalytics");
const resetAnalyticsBtn        = document.getElementById("resetAnalytics");
const analyticsContainer       = document.getElementById("analyticsContainer");
const analyticsBody            = document.getElementById("analyticsBody");
const analyticsTableHeadRow    = document.querySelector("#analyticsTable thead tr");
const graphsDiv                = document.getElementById("graphs");

let barChartInstance = null;
let pieChartInstance = null;

analyticsTargetSelect.addEventListener("change", () => {
  analyticsSectionSelect.classList.add("hidden");
  analyticsTypeSelect.disabled = false;
  analyticsDateInput.classList.add("hidden");
  analyticsMonthInput.classList.add("hidden");
  semesterStartInput.classList.add("hidden");
  semesterEndInput.classList.add("hidden");
  yearStartInput.classList.add("hidden");
  analyticsSearchInput.classList.add("hidden");

  if (analyticsTargetSelect.value === "section") {
    analyticsSectionSelect.classList.remove("hidden");
  }
});

analyticsTypeSelect.addEventListener("change", () => {
  analyticsDateInput.classList.add("hidden");
  analyticsMonthInput.classList.add("hidden");
  semesterStartInput.classList.add("hidden");
  semesterEndInput.classList.add("hidden");
  yearStartInput.classList.add("hidden");
  analyticsSearchInput.classList.add("hidden");
  switch (analyticsTypeSelect.value) {
    case "date":
      analyticsDateInput.classList.remove("hidden");
      break;
    case "month":
      analyticsMonthInput.classList.remove("hidden");
      break;
    case "semester":
      semesterStartInput.classList.remove("hidden");
      semesterEndInput.classList.remove("hidden");
      break;
    case "year":
      yearStartInput.classList.remove("hidden");
      analyticsSearchInput.classList.remove("hidden");
      break;
  }
});

loadAnalyticsBtn.onclick = () => {
  const target  = analyticsTargetSelect.value;
  const section = analyticsSectionSelect.value;
  const type    = analyticsTypeSelect.value;
  if (!target || !type) {
    alert("Select report target and period.");
    return;
  }
  generateAnalytics(target, section, type);
};

resetAnalyticsBtn.onclick = () => {
  analyticsTargetSelect.value       = "";
  analyticsSectionSelect.value      = "";
  analyticsSectionSelect.classList.add("hidden");
  analyticsTypeSelect.value         = "";
  analyticsTypeSelect.disabled      = true;
  analyticsDateInput.value          = "";
  analyticsMonthInput.value         = "";
  semesterStartInput.value          = "";
  semesterEndInput.value            = "";
  yearStartInput.value              = "";
  analyticsSearchInput.value        = "";
  analyticsContainer.classList.add("hidden");
  graphsDiv.classList.add("hidden");
  resetAnalyticsBtn.classList.add("hidden");

  if (barChartInstance) barChartInstance.destroy();
  if (pieChartInstance) pieChartInstance.destroy();
};

function generateAnalytics(target, section, type) {
  let filteredStudents = [...students];
  if (target === "section" && section) {
    filteredStudents = filteredStudents.filter(stu => stu.sec === section);
  }

  let dates = Object.keys(attendanceData);
  if (type === "date") {
    const selDate = analyticsDateInput.value;
    dates = dates.filter(d => d === selDate);
  } else if (type === "month") {
    const [year, month] = analyticsMonthInput.value.split("-");
    dates = dates.filter(d => {
      const dt = new Date(d);
      return dt.getFullYear() === +year && dt.getMonth() + 1 === +month;
    });
  } else if (type === "semester") {
    const start = semesterStartInput.value;
    const end   = semesterEndInput.value;
    dates = dates.filter(d => d >= start && d <= end);
  } else if (type === "year") {
    const year = +yearStartInput.value;
    dates = dates.filter(d => new Date(d).getFullYear() === year);
  }

  // Build stats per student
  const analyticsStats = filteredStudents.map(stu => {
    const stat = { adm: stu.adm, name: stu.name, P:0, A:0, Lt:0, HD:0, L:0 };
    dates.forEach(d => {
      const code = attendanceData[d]?.[stu.adm] || "P";
      stat[code]++;
    });
    stat.total = stat.P + stat.Lt + stat.HD + stat.A + stat.L;
    stat.perc = stat.total ? ((stat.P + stat.Lt + stat.HD)/stat.total*100).toFixed(2) : "0.00";
    // Recompute outstanding fine for this stud
    let a=0, lt=0, hd=0, l=0;
    Object.values(attendanceData).forEach(rec => {
      if(rec[stu.adm]) {
        switch(rec[stu.adm]) {
          case "A": a++; break;
          case "Lt": lt++; break;
          case "HD": hd++; break;
          case "L": l++; break;
        }
      }
    });
    const fineTotal = a*fineRates.A + lt*fineRates.Lt + l*fineRates.L + hd*fineRates.HD;
    const paid = (paymentsData[stu.adm]||[]).reduce((sum,x)=>sum+x.amount,0);
    stat.outstanding = fineTotal - paid;
    stat.status = stat.perc >= eligibilityPct ? "Eligible" : "Debarred";
    return stat;
  });

  // Build table header & body
  analyticsTableHeadRow.innerHTML = [
    "#","Adm#","Name","P","A","Lt","HD","L","Total","%","Outstanding","Status"
  ].map(h=>`<th>${h}</th>`).join("");
  analyticsBody.innerHTML = "";
  analyticsStats.forEach((st,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${st.adm}</td>
      <td>${st.name}</td>
      <td>${st.P}</td>
      <td>${st.A}</td>
      <td>${st.Lt}</td>
      <td>${st.HD}</td>
      <td>${st.L}</td>
      <td>${st.total}</td>
      <td>${st.perc}%</td>
      <td>PKR ${st.outstanding}</td>
      <td>${st.status}</td>`;
    analyticsBody.appendChild(tr);
  });

  analyticsContainer.classList.remove("hidden");
  graphsDiv.classList.remove("hidden");
  resetAnalyticsBtn.classList.remove("hidden");

  // Bar Chart for % Attendance
  if (barChartInstance) barChartInstance.destroy();
  const barCtx = document.getElementById("barChart").getContext("2d");
  barChartInstance = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: analyticsStats.map(st=>st.adm),
      datasets: [{
        label: "% Attendance",
        data: analyticsStats.map(st=>+st.perc),
        backgroundColor: null
      }]
    },
    options: {
      scales: { y: { beginAtZero:true, max:100 } }
    }
  });

  // Pie Chart for Totals (P vs A vs Lt vs HD vs L)
  if (pieChartInstance) pieChartInstance.destroy();
  const pieCtx = document.getElementById("pieChart").getContext("2d");
  const totalP  = analyticsStats.reduce((sum,st)=>sum+st.P, 0);
  const totalA  = analyticsStats.reduce((sum,st)=>sum+st.A, 0);
  const totalLt = analyticsStats.reduce((sum,st)=>sum+st.Lt,0);
  const totalHD = analyticsStats.reduce((sum,st)=>sum+st.HD,0);
  const totalL  = analyticsStats.reduce((sum,st)=>sum+st.L,0);
  pieChartInstance = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: ["Present","Absent","Late","Half-Day","Leave"],
      datasets: [{ data: [totalP,totalA,totalLt,totalHD,totalL] }]
    }
  });
}

// ------------------------------------------------------
// 16. ATTENDANCE REGISTER SECTION (Monthly Grid)
// ------------------------------------------------------
const registerMonthInput    = document.getElementById("registerMonth");
const loadRegisterBtn       = document.getElementById("loadRegister");
const registerTableWrapper  = document.getElementById("registerTableWrapper");
const registerHeaderRow     = document.getElementById("registerHeader");
const registerBody          = document.getElementById("registerBody");
const changeRegisterBtn     = document.getElementById("changeRegister");
const saveRegisterBtn       = document.getElementById("saveRegister");
const downloadRegisterBtn   = document.getElementById("downloadRegister");
const shareRegisterBtn      = document.getElementById("shareRegister");

loadRegisterBtn.onclick = () => {
  const mVal = registerMonthInput.value;
  if (!mVal) {
    alert("Select a month.");
    return;
  }
  renderRegister(mVal);
};

function renderRegister(monthVal) {
  const [year, month] = monthVal.split("-");
  const daysInMonth = new Date(+year, +month, 0).getDate();

  // Build Header: “Name | Adm# | 1 | 2 | …”
  registerHeaderRow.innerHTML = `<th>Name</th><th>Adm#</th>`;
  for (let d = 1; d <= daysInMonth; d++) {
    registerHeaderRow.innerHTML += `<th>${d}</th>`;
  }

  // Build Body
  registerBody.innerHTML = "";
  students.forEach((s,i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${s.name}</td><td>${s.adm}</td>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dd = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const code = attendanceData[dd]?.[s.adm] || "A";
      tr.innerHTML += `<td>${code}</td>`;
    }
    registerBody.appendChild(tr);
  });

  registerTableWrapper.classList.remove("hidden");
}

changeRegisterBtn.onclick = () => {
  hide(registerTableWrapper, changeRegisterBtn, saveRegisterBtn, downloadRegisterBtn, shareRegisterBtn);
  registerMonthInput.value = "";
};

saveRegisterBtn.onclick = async () => {
  // Already saved per-day on “Save Attendance”; can show a message
  alert("Register is already saved in real time.");
};

downloadRegisterBtn.onclick = () => {
  const doc = new jspdf.jsPDF({ orientation: "l" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const title = `Attendance Register - ${registerMonthInput.value}`;
  doc.setFontSize(16); doc.text(title, w/2, 12, { align: "center" });
  doc.autoTable({ html: "#registerTable", startY: 20, theme: "grid", styles:{ fontSize:8 } });
  const fileName = `Register_${registerMonthInput.value}.pdf`;
  doc.save(fileName);
};
shareRegisterBtn.onclick = () => {
  const msg = `Attendance Register for ${registerMonthInput.value}:\n\nPlease check your school’s portal.`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
};

// ------------------------------------------------------
// 17. BACKUP & RESTORE SECTION
// ------------------------------------------------------
const restoreFileInput = document.getElementById("restoreFile");
const restoreDataBtn   = document.getElementById("restoreData");
const resetDataBtn     = document.getElementById("resetData");

restoreDataBtn.onclick = () => restoreFileInput.click();
restoreFileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const txt = await file.text();
    const backup = JSON.parse(txt);
    if (!backup.studentsBySchool) throw new Error("Invalid backup.");
    // Overwrite all local state
    studentsBySchool       = backup.studentsBySchool       || {};
    attendanceDataBySchool = backup.attendanceDataBySchool || {};
    paymentsDataBySchool   = backup.paymentsDataBySchool   || {};
    lastAdmNoBySchool      = backup.lastAdmNoBySchool      || {};
    fineRates              = backup.fineRates              || fineRates;
    eligibilityPct         = backup.eligibilityPct         || eligibilityPct;
    schools                = backup.schools                || [];
    currentSchool          = backup.currentSchool          || currentSchool;
    teacherClass           = backup.teacherClass           || teacherClass;
    teacherSection         = backup.teacherSection         || teacherSection;

    await idbSet("studentsBySchool", studentsBySchool);
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
    await idbSet("paymentsDataBySchool", paymentsDataBySchool);
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
    await idbSet("fineRates", fineRates);
    await idbSet("eligibilityPct", eligibilityPct);
    await idbSet("schools", schools);
    await idbSet("currentSchool", currentSchool);
    await idbSet("teacherClass", teacherClass);
    await idbSet("teacherSection", teacherSection);

    await syncToFirebase();
    alert("Backup restored. Reloading...");
    location.reload();
  } catch (err) {
    alert("Restore failed: " + err.message);
  }
};

resetDataBtn.onclick = async () => {
  if (!confirm("Factory reset will delete ALL data for this school. Continue?")) return;
  students = [];
  attendanceData = {};
  paymentsData = {};
  lastAdmNo = 0;

  studentsBySchool[currentSchool]       = [];
  attendanceDataBySchool[currentSchool] = {};
  paymentsDataBySchool[currentSchool]   = {};
  lastAdmNoBySchool[currentSchool]      = 0;

  await idbSet("studentsBySchool", studentsBySchool);
  await idbSet("attendanceDataBySchool", attendanceDataBySchool);
  await idbSet("paymentsDataBySchool", paymentsDataBySchool);
  await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);

  await syncToFirebase();
  renderStudents();
  updateCounters();
  resetViews();
};

// ------------------------------------------------------
// 18. PAGE LOAD: Nothing more to initialize here.
// ------------------------------------------------------
