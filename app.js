// app.js (fully functional, with corrected Analytics section display and no syntax errors)
// ----------------------------------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  set as dbSet,
  onValue,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// IndexedDB helpers (idb-keyval IIFE is loaded in HTML head)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// Firebase configuration (replace placeholders with your actual config)
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
const appDataRef = dbRef(database, "appData");

// Local application state (will be filled from IndexedDB or defaults)
let students       = [];
let attendanceData = {};
let paymentsData   = {};
let lastAdmNo      = 0;
let fineRates      = { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct = 75;
let schools        = [];
let currentSchool  = null;
let teacherClass   = null;
let teacherSection = null;

// Load state from IndexedDB (if it exists), otherwise use defaults
async function initLocalState() {
  students       = (await idbGet("students"))       || [];
  attendanceData = (await idbGet("attendanceData")) || {};
  paymentsData   = (await idbGet("paymentsData"))   || {};
  lastAdmNo      = (await idbGet("lastAdmissionNo"))|| 0;
  fineRates      = (await idbGet("fineRates"))      || { A:50, Lt:20, L:10, HD:30 };
  eligibilityPct = (await idbGet("eligibilityPct")) || 75;
  schools        = (await idbGet("schools"))        || [];
  currentSchool  = (await idbGet("currentSchool"))  || null;
  teacherClass   = (await idbGet("teacherClass"))   || null;
  teacherSection = (await idbGet("teacherSection")) || null;
}

// Push local state to Firebase Realtime Database
async function syncToFirebase() {
  const payload = {
    students,
    attendanceData,
    paymentsData,
    lastAdmNo,
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

// Placeholder for loadSetup function (defined below)
let loadSetup;

window.addEventListener("DOMContentLoaded", async () => {
  // Shorthand selector and show/hide helpers
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove("hidden"));
  const hide = (...els) => els.forEach(e => e && e.classList.add("hidden"));

  // Initialize local state from IndexedDB
  await initLocalState();

  // Cache DOM elements BEFORE defining functions that reference them
  const schoolInput             = $("schoolInput");
  const schoolSelect            = $("schoolSelect");
  const classSelect             = $("teacherClassSelect");
  const sectionSelect           = $("teacherSectionSelect");
  const saveSetupBtn            = $("saveSetup");
  const editSetupBtn            = $("editSetup");
  const setupForm               = $("setupForm");
  const setupDisplay            = $("setupDisplay");
  const setupText               = $("setupText");
  const schoolList              = $("schoolList");

  const fineAbsentInput         = $("fineAbsent");
  const fineLateInput           = $("fineLate");
  const fineLeaveInput          = $("fineLeave");
  const fineHalfDayInput        = $("fineHalfDay");
  const eligibilityPctInput     = $("eligibilityPct");
  const saveSettingsBtn         = $("saveSettings");

  const studentsBody            = $("studentsBody");
  const selectAllStudents       = $("selectAllStudents");
  const editSelectedBtn         = $("editSelected");
  const doneEditingBtn          = $("doneEditing");
  const deleteSelectedBtn       = $("deleteSelected");
  const saveRegistrationBtn     = $("saveRegistration");
  const editRegistrationBtn     = $("editRegistration");
  const shareRegistrationBtn    = $("shareRegistration");
  const downloadRegistrationBtn = $("downloadRegistrationPDF");
  const addStudentBtn           = $("addStudent");
  const studentNameInput        = $("studentName");
  const parentNameInput         = $("parentName");
  const parentContactInput      = $("parentContact");
  const parentOccupationInput   = $("parentOccupation");
  const parentAddressInput      = $("parentAddress");

  const paymentModal            = $("paymentModal");
  const paymentModalCloseBtn    = $("paymentModalClose");
  const payAdmSpan              = $("payAdm");
  const paymentAmountInput      = $("paymentAmount");
  const savePaymentBtn          = $("savePayment");
  const cancelPaymentBtn        = $("cancelPayment");

  const dateInput               = $("dateInput");
  const loadAttendanceBtn       = $("loadAttendance");
  const saveAttendanceBtn       = $("saveAttendance");
  const resetAttendanceBtn      = $("resetAttendance");
  const downloadAttendanceBtn   = $("downloadAttendancePDF");
  const shareAttendanceBtn      = $("shareAttendanceSummary");
  const attendanceBodyDiv       = $("attendanceBody");
  const attendanceSummaryDiv    = $("attendanceSummary");

  const analyticsFilterBtn      = $("analyticsFilterBtn");
  const analyticsFilterModal    = $("analyticsFilterModal");
  const analyticsFilterClose    = $("analyticsFilterClose");
  const applyAnalyticsFilterBtn = $("applyAnalyticsFilter");
  const analyticsTargetSelect   = $("analyticsTarget");
  const analyticsSectionSelect  = $("analyticsSectionSelect");
  const analyticsTypeSelect     = $("analyticsType");
  const analyticsDateInput      = $("analyticsDate");
  const analyticsMonthInput     = $("analyticsMonth");
  const semesterStartInput      = $("semesterStart");
  const semesterEndInput        = $("semesterEnd");
  const yearStartInput          = $("yearStart");
  const analyticsSearchInput    = $("analyticsSearch");
  const loadAnalyticsBtn        = $("loadAnalytics");
  const resetAnalyticsBtn       = $("resetAnalytics");
  const instructionsDiv         = $("instructions");
  const analyticsContainer      = $("analyticsContainer");
  const analyticsTableTbody     = $("analyticsBody");
  const barChartCanvas          = $("barChart");
  const pieChartCanvas          = $("pieChart");
  const graphsDiv               = $("graphs");           // container wrapping both canvases
  const downloadAnalyticsBtn    = $("downloadAnalytics");
  const shareAnalyticsBtn       = $("shareAnalytics");
  const analyticsActionsDiv     = $("analyticsActions"); // container wrapping download/share buttons

  const registerMonthInput      = $("registerMonth");
  const loadRegisterBtn         = $("loadRegister");
  const registerTableWrapper    = $("registerTableWrapper");
  const registerHeaderRow       = $("registerHeader");
  const registerBodyTbody       = $("registerBody");
  const changeRegisterBtn       = $("changeRegister");
  const saveRegisterBtn         = $("saveRegister");
  const downloadRegisterBtn     = $("downloadRegister");
  const shareRegisterBtn        = $("shareRegister");

  const chooseBackupFolderBtn   = $("chooseBackupFolder");
  const restoreDataBtn          = $("restoreData");
  const restoreFileInput        = $("restoreFile");
  const resetDataBtn            = $("resetData");

  // PDF share helper (Web Share API)
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

  // Eruda console for debugging (optional)
  const erudaScript = document.createElement("script");
  erudaScript.src = "https://cdn.jsdelivr.net/npm/eruda";
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // Generate next admission number and sync to Firebase
  async function genAdmNo() {
    lastAdmNo++;
    await idbSet("lastAdmissionNo", lastAdmNo);
    await syncToFirebase();
    return String(lastAdmNo).padStart(4, "0");
  }

  // Hide all dynamic sections except initial ones
  function resetViews() {
    hide(
      attendanceBodyDiv, saveAttendanceBtn, resetAttendanceBtn,
      attendanceSummaryDiv, downloadAttendanceBtn, shareAttendanceBtn,
      instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv,
      registerTableWrapper, changeRegisterBtn, saveRegisterBtn, downloadRegisterBtn, shareRegisterBtn
    );
    show(loadRegisterBtn);
  }

  // ===== 1. SETUP Section =====
  function renderSchoolList() {
    schoolList.innerHTML = "";
    schools.forEach((school, idx) => {
      const row = document.createElement("div");
      row.className = "row-inline";
      row.innerHTML = `
        <span>${school}</span>
        <div>
          <button data-idx="${idx}" class="edit-school no-print"><i class="fas fa-edit"></i></button>
          <button data-idx="${idx}" class="delete-school no-print"><i class="fas fa-trash"></i></button>
        </div>`;
      schoolList.appendChild(row);
    });
    document.querySelectorAll(".edit-school").forEach(btn => {
      btn.onclick = async () => {
        const idx = +btn.dataset.idx;
        const newName = prompt("Edit School Name:", schools[idx]);
        if (newName?.trim()) {
          schools[idx] = newName.trim();
          await idbSet("schools", schools);
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

  loadSetup = async () => {
    // Refresh local variables from IndexedDB
    schools        = (await idbGet("schools")) || [];
    currentSchool  = await idbGet("currentSchool");
    teacherClass   = await idbGet("teacherClass");
    teacherSection = await idbGet("teacherSection");

    // Populate School dropdown
    schoolSelect.innerHTML =
      ['<option disabled selected>-- Select School --</option>']
      .concat(schools.map(s => `<option value="${s}">${s}</option>`))
      .join("");
    if (currentSchool) schoolSelect.value = currentSchool;

    renderSchoolList();

    if (currentSchool && teacherClass && teacherSection) {
      classSelect.value = teacherClass;
      sectionSelect.value = teacherSection;
      setupText.textContent = `${currentSchool} 🏫 | Class: ${teacherClass} | Section: ${teacherSection}`;
      hide(setupForm);
      show(setupDisplay);
      renderStudents();
      updateCounters();
      resetViews();
    } else {
      show(setupForm);
      hide(setupDisplay);
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
  };

  await loadSetup();

  // ===== 2. FINANCIAL SETTINGS Section =====
  fineAbsentInput.value     = fineRates.A;
  fineLateInput.value       = fineRates.Lt;
  fineLeaveInput.value      = fineRates.L;
  fineHalfDayInput.value    = fineRates.HD;
  eligibilityPctInput.value = eligibilityPct;

  const settingsCard = document.createElement("div");
  settingsCard.id = "settingsCard";
  settingsCard.className = "card hidden";
  const editSettingsBtn = document.createElement("button");
  editSettingsBtn.id = "editSettings";
  editSettingsBtn.className = "btn no-print hidden";
  editSettingsBtn.textContent = "Edit Settings";
  saveSettingsBtn.parentNode.appendChild(settingsCard);
  saveSettingsBtn.parentNode.appendChild(editSettingsBtn);

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
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
      </div>`;
    hide(
      fineAbsentInput, fineLateInput, fineLeaveInput,
      fineHalfDayInput, eligibilityPctInput, saveSettingsBtn
    );
    show(settingsCard, editSettingsBtn);
  };

  editSettingsBtn.onclick = () => {
    hide(settingsCard, editSettingsBtn);
    show(
      fineAbsentInput, fineLateInput, fineLeaveInput,
      fineHalfDayInput, eligibilityPctInput, saveSettingsBtn
    );
  };

  // ===== 3. COUNTERS Section =====
  function animateCounters() {
    document.querySelectorAll(".number").forEach(span => {
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
    const cl = classSelect.value, sec = sectionSelect.value;
    $("sectionCount").dataset.target = students.filter(s => s.cls === cl && s.sec === sec).length;
    $("classCount").dataset.target   = students.filter(s => s.cls === cl).length;
    $("schoolCount").dataset.target  = students.length;
    animateCounters();
  }

  // ===== 4. STUDENT REGISTRATION Section =====
  function renderStudents() {
    const cl = classSelect.value, sec = sectionSelect.value;
    studentsBody.innerHTML = "";
    let idx = 0;
    students.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => { if (rec[s.adm]) stats[rec[s.adm]]++; });
      const total = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const fine  = stats.A * fineRates.A + stats.Lt * fineRates.Lt + stats.L * fineRates.L + stats.HD * fineRates.HD;
      const paid  = (paymentsData[s.adm] || []).reduce((a, p) => a + p.amount, 0);
      const out   = fine - paid;
      const pct   = total ? (stats.P / total) * 100 : 0;
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
    editSelectedBtn.disabled = !any;
    deleteSelectedBtn.disabled = !any;
  }
  studentsBody.addEventListener("change", e => {
    if (e.target.classList.contains("sel")) toggleButtons();
  });
  selectAllStudents.onclick = () => {
    document.querySelectorAll(".sel").forEach(c => c.checked = selectAllStudents.checked);
    toggleButtons();
  };

  addStudentBtn.onclick = async e => {
    e.preventDefault();
    const n   = studentNameInput.value.trim(),
          p   = parentNameInput.value.trim(),
          c   = parentContactInput.value.trim(),
          o   = parentOccupationInput.value.trim(),
          a   = parentAddressInput.value.trim(),
          cl  = classSelect.value,
          sec = sectionSelect.value;
    if (!n || !p || !c || !o || !a) {
      alert("All fields are required");
      return;
    }
    if (!/^\d{7,15}$/.test(c)) {
      alert("Contact must be 7–15 digits");
      return;
    }
    const adm = await genAdmNo();
    students.push({ name: n, adm, parent: p, contact: c, occupation: o, address: a, cls: cl, sec });
    await idbSet("students", students);
    await syncToFirebase();
    renderStudents(); 
    updateCounters();
    resetViews();
    studentNameInput.value = parentNameInput.value = parentContactInput.value = parentOccupationInput.value = parentAddressInput.value = "";
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
    hide(editSelectedBtn);
    show(doneEditingBtn);
  };
  doneEditingBtn.onclick = async () => {
    document.querySelectorAll("#studentsBody tr").forEach(tr => {
      const inputs = [...tr.querySelectorAll("input:not(.sel)")];
      if (inputs.length === 5) {
        const [n, p, c, o, a] = inputs.map(i => i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(x => x.adm === adm);
        if (idx > -1) {
          students[idx] = { ...students[idx], name: n, parent: p, contact: c, occupation: o, address: a };
        }
      }
    });
    await idbSet("students", students);
    await syncToFirebase();
    hide(doneEditingBtn);
    show(editSelectedBtn, deleteSelectedBtn, saveRegistrationBtn);
    renderStudents(); 
    updateCounters();
  };

  deleteSelectedBtn.onclick = async () => {
    if (!confirm("Delete selected students?")) return;
    const toDelete = [...document.querySelectorAll(".sel:checked")].map(cb => +cb.closest("tr").dataset.index);
    students = students.filter((_, i) => !toDelete.includes(i));
    await idbSet("students", students);
    await syncToFirebase();
    renderStudents(); 
    updateCounters();
    resetViews();
  };

  saveRegistrationBtn.onclick = async () => {
    if (!doneEditingBtn.classList.contains("hidden")) {
      alert("Please finish editing first");
      return;
    }
    await idbSet("students", students);
    await syncToFirebase();
    hide(
      $("student-registration").querySelector(".row-inline"),
      editSelectedBtn, deleteSelectedBtn, selectAllStudents, saveRegistrationBtn
    );
    show(editRegistrationBtn, shareRegistrationBtn, downloadRegistrationBtn);
    renderStudents(); 
    updateCounters();
  };
  editRegistrationBtn.onclick = () => {
    show(
      $("student-registration").querySelector(".row-inline"),
      selectAllStudents, editSelectedBtn, deleteSelectedBtn, saveRegistrationBtn
    );
    hide(editRegistrationBtn, shareRegistrationBtn, downloadRegistrationBtn);
    renderStudents(); 
    updateCounters();
  };

  // ===== 5. PAYMENT MODAL =====
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
    await idbSet("paymentsData", paymentsData);
    await syncToFirebase();
    hide(paymentModal);
    renderStudents();
  };
  cancelPaymentBtn.onclick = () => hide(paymentModal);

  // ===== 6. MARK ATTENDANCE Section =====
  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = "";
    attendanceSummaryDiv.innerHTML = "";
    const cl = classSelect.value, sec = sectionSelect.value;
    attendanceBodyDiv.style.overflowX = "auto";
    students.filter(stu => stu.cls === cl && stu.sec === sec).forEach((stu, i) => {
      const row = document.createElement("div");
      const headerDiv = document.createElement("div");
      const btnsDiv = document.createElement("div");
      row.className = "attendance-row";
      headerDiv.className = "attendance-header";
      btnsDiv.className = "attendance-buttons";
      headerDiv.textContent = `${i + 1}. ${stu.name} (${stu.adm})`;
      Object.entries({ P: "Present", A: "Absent", Lt: "Late", HD: "Half-Day", L: "Leave" }).forEach(([code, label]) => {
        const btn = document.createElement("button");
        btn.className = "att-btn";
        btn.textContent = code;
        btn.onclick = () => {
          btnsDiv.querySelectorAll(".att-btn").forEach(b => {
            b.classList.remove("selected");
            b.style = "";
          });
          btn.classList.add("selected");
          btn.style.background = {
            P: "var(--success)",
            A: "var(--danger)",
            Lt: "var(--warning)",
            HD: "#FF9800",
            L: "var(--info)"
          }[code];
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
    if (!date) {
      alert("Pick a date");
      return;
    }
    attendanceData[date] = {};
    const cl = classSelect.value, sec = sectionSelect.value;
    students.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
      const selBtn = attendanceBodyDiv.children[i].querySelector(".att-btn.selected");
      attendanceData[date][s.adm] = selBtn ? selBtn.textContent : "A";
    });
    await idbSet("attendanceData", attendanceData);

    // Immediately sync attendance to Firebase
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
          <td>${{ P: "Present", A: "Absent", Lt: "Late", HD: "Half-Day", L: "Leave" }[code]}</td>
          <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
        </tr>`;
    });
    attendanceSummaryDiv.appendChild(tbl);
    attendanceSummaryDiv.querySelectorAll(".share-individual").forEach(ic => {
      ic.onclick = () => {
        const adm = ic.dataset.adm;
        const st = students.find(x => x.adm === adm);
        const msg = `Dear Parent, your child (Adm#: ${adm}) was ${{ P: "Present", A: "Absent", Lt: "Late", HD: "Half-Day", L: "Leave" }[attendanceData[date][adm]]} on ${date}.`;
        window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`, "_blank");
      };
    });

    hide(attendanceBodyDiv, saveAttendanceBtn);
    show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  resetAttendanceBtn.onclick = () => {
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  downloadAttendanceBtn.onclick = async () => {
    const doc = new jspdf.jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split("T")[0];
    doc.setFontSize(18);
    doc.text("Attendance Report", 14, 16);
    doc.setFontSize(10);
    doc.text(`Date: ${today}`, w - 14, 16, { align: "right" });
    doc.setFontSize(12);
    doc.text(setupText.textContent, 14, 24);
    doc.autoTable({ startY: 30, html: "#attendanceSummaryTable" });
    const fileName = `attendance_${dateInput.value}.pdf`;
    const blob = doc.output("blob");
    doc.save(fileName);
    await sharePdf(blob, fileName, "Attendance Report");
  };

  shareAttendanceBtn.onclick = () => {
    const cl = classSelect.value, sec = sectionSelect.value, date = dateInput.value;
    const header = `*Attendance Report*\nClass ${cl} Sec ${sec} - ${date}`;
    const lines = students.filter(s => s.cls === cl && s.sec === sec)
      .map((s, i) => `${i + 1}. ${s.name} (Adm#: ${s.adm}): ${{ P: "Present", A: "Absent", Lt: "Late", HD: "Half-Day", L: "Leave" }[attendanceData[date][s.adm]]}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n\n" + lines.join("\n"))}`, "_blank");
  };

  // ===== 7. ANALYTICS Section =====

  // Define status names & colors for charts
  const analyticsStatusNames  = { P: "Present", A: "Absent", Lt: "Late", HD: "Half-Day", L: "Leave" };
  const analyticsStatusColors = {
    P: getComputedStyle(document.documentElement).getPropertyValue("--success").trim(),
    A: getComputedStyle(document.documentElement).getPropertyValue("--danger").trim(),
    Lt: getComputedStyle(document.documentElement).getPropertyValue("--warning").trim(),
    HD: "#FF9800",
    L: getComputedStyle(document.documentElement).getPropertyValue("--info").trim()
  };

  let barChart, pieChart;
  let analyticsFilterOptions = ["all"];
  let analyticsDownloadMode  = "combined";
  let lastAnalyticsStats     = [];
  let lastAnalyticsRange     = { from: null, to: null };
  let lastAnalyticsShare     = "";

  analyticsFilterBtn.onclick = () => show(analyticsFilterModal);
  analyticsFilterClose.onclick = () => hide(analyticsFilterModal);
  applyAnalyticsFilterBtn.onclick = () => {
    analyticsFilterOptions = Array.from(document.querySelectorAll("#analyticsFilterForm input[type='checkbox']:checked"))
      .map(cb => cb.value) || ["all"];
    analyticsDownloadMode = document.querySelector("#analyticsFilterForm input[name='downloadMode']:checked").value;
    hide(analyticsFilterModal);
    if (lastAnalyticsStats.length) renderAnalytics(lastAnalyticsStats, lastAnalyticsRange.from, lastAnalyticsRange.to);
  };

  analyticsTargetSelect.onchange = () => {
    analyticsTypeSelect.disabled = false;
    analyticsSectionSelect.classList.add("hidden");
    analyticsSearchInput.classList.add("hidden");
    instructionsDiv.classList.add("hidden");
    analyticsContainer.classList.add("hidden");
    graphsDiv.classList.add("hidden");
    analyticsActionsDiv.classList.add("hidden");
    if (analyticsTargetSelect.value === "section") analyticsSectionSelect.classList.remove("hidden");
    if (analyticsTargetSelect.value === "student") analyticsSearchInput.classList.remove("hidden");
  };

  analyticsTypeSelect.onchange = () => {
    analyticsDateInput.classList.add("hidden");
    analyticsMonthInput.classList.add("hidden");
    semesterStartInput.classList.add("hidden");
    semesterEndInput.classList.add("hidden");
    yearStartInput.classList.add("hidden");
    instructionsDiv.classList.add("hidden");
    analyticsContainer.classList.add("hidden");
    graphsDiv.classList.add("hidden");
    analyticsActionsDiv.classList.add("hidden");
    resetAnalyticsBtn.classList.remove("hidden");
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
        break;
    }
  };

  resetAnalyticsBtn.onclick = e => {
    e.preventDefault();
    analyticsTypeSelect.value = "";
    analyticsDateInput.classList.add("hidden");
    analyticsMonthInput.classList.add("hidden");
    semesterStartInput.classList.add("hidden");
    semesterEndInput.classList.add("hidden");
    yearStartInput.classList.add("hidden");
    instructionsDiv.classList.add("hidden");
    analyticsContainer.classList.add("hidden");
    graphsDiv.classList.add("hidden");
    analyticsActionsDiv.classList.add("hidden");
    resetAnalyticsBtn.classList.add("hidden");
  };

  loadAnalyticsBtn.onclick = () => {
    if (analyticsTargetSelect.value === "student" && !analyticsSearchInput.value.trim()) {
      alert("Enter admission number or name");
      return;
    }
    let from, to;
    switch (analyticsTypeSelect.value) {
      case "date":
        from = to = analyticsDateInput.value;
        break;
      case "month": {
        const [y, m] = analyticsMonthInput.value.split("-").map(Number);
        from = `${analyticsMonthInput.value}-01`;
        to   = `${analyticsMonthInput.value}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
        break;
      }
      case "semester": {
        const [sy, sm] = semesterStartInput.value.split("-").map(Number);
        const [ey, em] = semesterEndInput.value.split("-").map(Number);
        from = `${semesterStartInput.value}-01`;
        to   = `${semesterEndInput.value}-${String(new Date(ey, em, 0).getDate()).padStart(2, "0")}`;
        break;
      }
      case "year":
        from = `${yearStartInput.value}-01-01`;
        to   = `${yearStartInput.value}-12-31`;
        break;
      default:
        alert("Select a period");
        return;
    }

    const cls = classSelect.value, sec = sectionSelect.value;
    let pool = students.filter(s => s.cls === cls && s.sec === sec);
    if (analyticsTargetSelect.value === "section") {
      pool = pool.filter(s => s.sec === analyticsSectionSelect.value);
    }
    if (analyticsTargetSelect.value === "student") {
      const q = analyticsSearchInput.value.trim().toLowerCase();
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
      st.status = st.outstanding > 0 || pct < eligibilityPct ? "Debarred" : "Eligible";
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

    // Render table body
    const thead = $("analyticsTable").querySelector("thead tr");
    thead.innerHTML = ["#", "Adm#", "Name", "P", "A", "Lt", "HD", "L", "Total", "%", "Outstanding", "Status"]
      .map(h => `<th>${h}</th>`)
      .join("");
    analyticsTableTbody.innerHTML = "";
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
      analyticsTableTbody.appendChild(tr);
    });

    instructionsDiv.textContent = `Period: ${from} to ${to}`;

    // Ensure parent containers are visible
    show(instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv);

    // Render bar chart
    barChart?.destroy();
    barChart = new Chart(barChartCanvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: filtered.map(st => st.name),
        datasets: [{
          label: "% Present",
          data: filtered.map(st => (st.total ? (st.P / st.total) * 100 : 0)),
          backgroundColor: filtered.map(() => analyticsStatusColors.P)
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });

    // Render pie chart
    const totals = filtered.reduce((acc, st) => {
      acc.P += st.P;
      acc.A += st.A;
      acc.Lt += st.Lt;
      acc.HD += st.HD;
      acc.L += st.L;
      return acc;
    }, { P: 0, A: 0, Lt: 0, HD: 0, L: 0 });
    pieChart?.destroy();
    pieChart = new Chart(pieChartCanvas.getContext("2d"), {
      type: "pie",
      data: {
        labels: Object.values(analyticsStatusNames),
        datasets: [{
          data: Object.keys(analyticsStatusNames).map(code => totals[code]),
          backgroundColor: Object.keys(analyticsStatusNames).map(code => analyticsStatusColors[code])
        }]
      }
    });

    // Prepare share text
    lastAnalyticsShare = `Attendance Analytics (${from} to ${to})\n` +
      filtered.map((st, i) => `${i + 1}. ${st.adm} ${st.name}: ${st.total ? (st.P / st.total * 100).toFixed(1) : "0.0"}% / PKR ${st.outstanding}`)
      .join("\n");
  }

  downloadAnalyticsBtn.onclick = async () => {
    if (!lastAnalyticsStats.length) {
      alert("Load analytics first");
      return;
    }
    if (analyticsDownloadMode === "combined") {
      const doc = new jspdf.jsPDF();
      const w = doc.internal.pageSize.getWidth();
      const { from, to } = lastAnalyticsRange;
      doc.setFontSize(18);
      doc.text("Attendance Analytics", 14, 16);
      doc.setFontSize(10);
      doc.text(`Period: ${from} to ${to}`, w - 14, 16, { align: "right" });
      doc.setFontSize(12);
      doc.text(setupText.textContent, 14, 24);
      // Build a temporary table element
      const table = document.createElement("table");
      table.innerHTML = `
        <tr>
          <th>#</th><th>Adm#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th><th>Outstanding</th><th>Status</th>
        </tr>
        ${lastAnalyticsStats.map((st, i) => `
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
            <td>${st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0"}%</td>
            <td>PKR ${st.outstanding}</td>
            <td>${st.status}</td>
          </tr>`).join("")}
      `;
      doc.autoTable({ startY: 30, html: table });
      const fileName = `analytics_${from}_to_${to}.pdf`;
      const blob = doc.output("blob");
      doc.save(fileName);
      await sharePdf(blob, fileName, "Attendance Analytics");
    } else {
      const doc = new jspdf.jsPDF();
      const w = doc.internal.pageSize.getWidth();
      const { from, to } = lastAnalyticsRange;
      lastAnalyticsStats.forEach((st, i) => {
        if (i > 0) doc.addPage();
        doc.setFontSize(18);
        doc.text("Attendance Analytics (Individual)", 14, 16);
        doc.setFontSize(10);
        doc.text(`Period: ${from} to ${to}`, w - 14, 16, { align: "right" });
        doc.setFontSize(12);
        doc.text(setupText.textContent, 14, 24);
        doc.setFontSize(14);
        doc.text(`Student: ${st.name} (Adm#: ${st.adm})`, 14, 36);
        doc.setFontSize(12);
        doc.text(`Present: ${st.P}`, 14, 50);
        doc.text(`Absent: ${st.A}`, 60, 50);
        doc.text(`Late: ${st.Lt}`, 14, 64);
        doc.text(`Half-Day: ${st.HD}`, 60, 64);
        doc.text(`Leave: ${st.L}`, 14, 78);
        doc.text(`Total Days Marked: ${st.total}`, 14, 92);
        const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
        doc.text(`Attendance %: ${pct}%`, 14, 106);
        doc.text(`Outstanding Fine: PKR ${st.outstanding}`, 14, 120);
        doc.text(`Status: ${st.status}`, 14, 134);
      });
      const individualFileName = `analytics_individual_${from}_to_${to}.pdf`;
      const individualBlob = doc.output("blob");
      doc.save(individualFileName);
      await sharePdf(individualBlob, individualFileName, "Attendance Analytics (Book)");
    }
  };

  shareAnalyticsBtn.onclick = () => {
    if (!lastAnalyticsShare) {
      alert("Load analytics first");
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, "_blank`);
  };

  // ===== 8. ATTENDANCE REGISTER Section =====
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
      doc.text(setupText.textContent, 14, 36);
      doc.autoTable({ startY: 60, html: "#registerTable", tableWidth: "auto", styles: { fontSize: 10 } });
      const blob = doc.output("blob");
      doc.save("attendance_register.pdf");
      await sharePdf(blob, "attendance_register.pdf", "Attendance Register");
    };
    shareRegisterBtn.onclick = () => {
      const header = `Attendance Register\n${setupText.textContent}`;
      const rows = Array.from(registerBodyTbody.children).map(tr =>
        Array.from(tr.children).map(td => td.querySelector(".status-text")?.textContent || td.textContent).join(" ")
      );
      window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n" + rows.join("\n"))}`, "_blank");
    };
  }

  loadRegisterBtn.onclick = () => {
    const m = registerMonthInput.value;
    if (!m) {
      alert("Pick month");
      return;
    }
    const dateKeys = Object.keys(attendanceData).filter(d => d.startsWith(m + "-")).sort();
    if (!dateKeys.length) {
      alert("No attendance marked this month.");
      return;
    }
    registerHeaderRow.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
      dateKeys.map(k => `<th>${k.split("-")[2]}</th>`).join("");
    registerBodyTbody.innerHTML = "";
    const cl = classSelect.value, sec = sectionSelect.value;
    students.filter(s => s.cls === cl && s.sec === sec).forEach((s, i) => {
      let row = `<td>${i + 1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      dateKeys.forEach(key => {
        const c = attendanceData[key][s.adm] || "";
        const color = c === "P" ? "var(--success)" :
                      c === "Lt" ? "var(--warning)" :
                      c === "HD" ? "#FF9800" :
                      c === "L"  ? "var(--info)" :
                      "var(--danger)";
        const style = c ? `style="background:${color};color:#fff"` : "";
        row += `<td class="reg-cell" ${style}><span class="status-text">${c}</span></td>`;
      });
      const tr = document.createElement("tr");
      tr.innerHTML = row;
      registerBodyTbody.appendChild(tr);
    });

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
          const col = c === "P"  ? "var(--success)" :
                      c === "Lt" ? "var(--warning)" :
                      c === "HD" ? "#FF9800" :
                      c === "L"  ? "var(--info)" :
                      "var(--danger)";
          cell.style.background = col;
          cell.style.color = "#fff";
        }
      };
    });

    show(registerTableWrapper, saveRegisterBtn);
    hide(loadRegisterBtn, changeRegisterBtn, downloadRegisterBtn, shareRegisterBtn);
  };

  saveRegisterBtn.onclick = async () => {
    const m = registerMonthInput.value;
    const dateKeys = Object.keys(attendanceData).filter(d => d.startsWith(m + "-")).sort();
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
    await idbSet("attendanceData", attendanceData);
    await syncToFirebase();
    hide(saveRegisterBtn);
    show(changeRegisterBtn, downloadRegisterBtn, shareRegisterBtn);
    bindRegisterActions();
  };

  changeRegisterBtn.onclick = () => {
    hide(registerTableWrapper, changeRegisterBtn, downloadRegisterBtn, shareRegisterBtn, saveRegisterBtn);
    registerHeaderRow.innerHTML = "";
    registerBodyTbody.innerHTML = "";
    show(loadRegisterBtn);
  };

  bindRegisterActions();

  // ===== 9. BACKUP & RESTORE & RESET =====
  let backupHandle = null;

  chooseBackupFolderBtn.onclick = async () => {
    try {
      backupHandle = await window.showDirectoryPicker();
      alert("Backup folder selected.");
    } catch (err) {
      console.error(err);
      alert("Folder selection canceled or not supported.");
    }
  };

  restoreDataBtn.onclick = () => restoreFileInput.click();
  restoreFileInput.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      // Overwrite local state
      students       = data.students       || [];
      attendanceData = data.attendanceData || {};
      paymentsData   = data.paymentsData   || {};
      lastAdmNo      = data.lastAdmNo      || 0;
      fineRates      = data.fineRates      || { A:50, Lt:20, L:10, HD:30 };
      eligibilityPct = data.eligibilityPct || 75;
      schools        = data.schools        || [];
      currentSchool  = data.currentSchool  || null;
      teacherClass   = data.teacherClass   || null;
      teacherSection = data.teacherSection || null;
      // Save to IndexedDB
      await Promise.all([
        idbSet("students", students),
        idbSet("attendanceData", attendanceData),
        idbSet("paymentsData", paymentsData),
        idbSet("lastAdmissionNo", lastAdmNo),
        idbSet("fineRates", fineRates),
        idbSet("eligibilityPct", eligibilityPct),
        idbSet("schools", schools),
        idbSet("currentSchool", currentSchool),
        idbSet("teacherClass", teacherClass),
        idbSet("teacherSection", teacherSection)
      ]);
      // Sync to Firebase
      await syncToFirebase();
      await loadSetup();
      alert("Data restored successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to restore data. File may be invalid.");
    }
    restoreFileInput.value = "";
  };

  resetDataBtn.onclick = async () => {
    if (!confirm("Factory reset will delete ALL data locally and in Firebase. Continue?")) return;
    await idbClear();
    students = [];
    attendanceData = {};
    paymentsData = {};
    lastAdmNo = 0;
    fineRates = { A:50, Lt:20, L:10, HD:30 };
    eligibilityPct = 75;
    schools = [];
    currentSchool = null;
    teacherClass = null;
    teacherSection = null;
    await syncToFirebase();
    await loadSetup();
    alert("Factory reset completed.");
  };

  // Periodic backup to chosen folder every 5 minutes
  setInterval(async () => {
    if (!backupHandle) return;
    try {
      const backupData = {
        students,
        attendanceData,
        paymentsData,
        lastAdmNo,
        fineRates,
        eligibilityPct,
        schools,
        currentSchool,
        teacherClass,
        teacherSection
      };
      const now = new Date();
      const fileName = `backup_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}.json`;
      const fileHandle = await backupHandle.getFileHandle(fileName, { create: true });
      const writer = await fileHandle.createWritable();
      await writer.write(JSON.stringify(backupData, null, 2));
      await writer.close();
      console.log("🗄️ Backup written to folder:", fileName);
    } catch (err) {
      console.error("Backup failed:", err);
    }
  }, 5 * 60 * 1000);

  // ===== 10. SERVICE WORKER Registration =====
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(console.error);
  }

  // ===== 11. Firebase onValue listener (two-way sync) =====
  onValue(appDataRef, async snapshot => {
    if (!snapshot.exists()) {
      console.log("No existing data in Firebase; continuing with local IndexedDB.");
      return;
    }
    const data = snapshot.val();
    students       = data.students       || [];
    attendanceData = data.attendanceData || {};
    paymentsData   = data.paymentsData   || {};
    lastAdmNo      = data.lastAdmNo      || 0;
    fineRates      = data.fineRates      || { A:50, Lt:20, L:10, HD:30 };
    eligibilityPct = data.eligibilityPct || 75;
    schools        = data.schools        || [];
    currentSchool  = data.currentSchool  || null;
    teacherClass   = data.teacherClass   || null;
    teacherSection = data.teacherSection || null;

    await Promise.all([
      idbSet("students", students),
      idbSet("attendanceData", attendanceData),
      idbSet("paymentsData", paymentsData),
      idbSet("lastAdmissionNo", lastAdmNo),
      idbSet("fineRates", fineRates),
      idbSet("eligibilityPct", eligibilityPct),
      idbSet("schools", schools),
      idbSet("currentSchool", currentSchool),
      idbSet("teacherClass", teacherClass),
      idbSet("teacherSection", teacherSection)
    ]);
    await loadSetup();
    console.log("✅ Loaded data from Firebase into IndexedDB and UI");
  });
});
