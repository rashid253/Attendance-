// app.js (Updated: Per-School Data Isolation Integrated into Original Code)
// -------------------------------------------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  set as dbSet,
  onValue,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// IndexedDB helpers (idb-keyval IIFE must be loaded in your HTML before this script)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// Firebase configuration (replace with your actual config)
const firebaseConfig = {
  // ... your Firebase config ...
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// -------------------------------------------------------------------------------------------------
// Global State (with `school` support)
// -------------------------------------------------------------------------------------------------
let students       = [];    // Array of { name, adm, parent, contact, occupation, address, cls, sec, school }
let attendanceData = {};    // { "YYYY-MM-DD": { adm: "P"/"A"/"Lt"/"HD"/"L", ... } }
let paymentsData   = {};    // { adm: [ { date: "YYYY-MM-DD", amount: number }, ... ] }
let lastAdmNo      = 0;     // numeric, incrementing for new admission numbers
let fineRates      = { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct = 75;    // percentage threshold
let schools        = [];    // array of school names (strings)
let currentSchool  = null;  // selected school name
let teacherClass   = null;  // selected class (e.g. "10")
let teacherSection = null;  // selected section (e.g. "A")

// -------------------------------------------------------------------------------------------------
// IndexedDB / Firebase Utility Functions
// -------------------------------------------------------------------------------------------------
async function syncToFirebase() {
  try {
    // Compose payload reflecting full app state
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
      teacherSection,
    };
    await dbSet(dbRef(db, "attendanceAppData"), payload);
    console.log("✅ Synced to Firebase");
  } catch (err) {
    console.error("Firebase sync error:", err);
  }
}

// Admission Number (ADM) generator
async function genAdmNo() {
  lastAdmNo = (await idbGet("lastAdmNo")) || lastAdmNo;
  lastAdmNo++;
  await idbSet("lastAdmNo", lastAdmNo);
  return "ADM" + String(lastAdmNo).padStart(4, "0");
}

// -------------------------------------------------------------------------------------------------
// Initialize Local State from IndexedDB (and subscribe to Firebase)
// -------------------------------------------------------------------------------------------------
async function initLocalState() {
  students       = (await idbGet("students"))       || [];
  attendanceData = (await idbGet("attendanceData")) || {};
  paymentsData   = (await idbGet("paymentsData"))   || {};
  lastAdmNo      = (await idbGet("lastAdmNo"))      || lastAdmNo;
  fineRates      = (await idbGet("fineRates"))      || fineRates;
  eligibilityPct = (await idbGet("eligibilityPct")) || eligibilityPct;
  schools        = (await idbGet("schools"))        || [];
  currentSchool  = (await idbGet("currentSchool"))  || null;
  teacherClass   = (await idbGet("teacherClass"))   || null;
  teacherSection = (await idbGet("teacherSection")) || null;
}

onValue(dbRef(db, "attendanceAppData"), async (snapshot) => {
  const data = snapshot.val();
  if (!data) return;
  // Overwrite local state with Firebase data
  students       = data.students       || [];
  attendanceData = data.attendanceData || {};
  paymentsData   = data.paymentsData   || {};
  lastAdmNo      = data.lastAdmNo      || lastAdmNo;
  fineRates      = data.fineRates      || fineRates;
  eligibilityPct = data.eligibilityPct || eligibilityPct;
  schools        = data.schools        || [];
  currentSchool  = data.currentSchool  || currentSchool;
  teacherClass   = data.teacherClass   || teacherClass;
  teacherSection = data.teacherSection || teacherSection;

  // Persist fetched state to IndexedDB
  await Promise.all([
    idbSet("students", students),
    idbSet("attendanceData", attendanceData),
    idbSet("paymentsData", paymentsData),
    idbSet("lastAdmNo", lastAdmNo),
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

// -------------------------------------------------------------------------------------------------
// DOMContentLoaded: Main Initialization
// -------------------------------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
  // Simplified selector/shower/hider
  const $ = (id) => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove("hidden"));
  const hide = (...els) => els.forEach(e => e && e.classList.add("hidden"));

  // Load local state
  await initLocalState();

  // -------------------------------------------------------------------------------------------------
  // Reset Views: Hide/Show all sections based on whether setup is complete
  // -------------------------------------------------------------------------------------------------
  function resetViews() {
    const setupDone = currentSchool && teacherClass && teacherSection;
    const allSections = [
      $("financial-settings"),
      $("animatedCounters"),
      $("student-registration"),
      $("attendance-section"),
      $("attendanceSummarySection"),
      $("analytics-section"),
      $("register-section"),
      $("backup-restore-section")
    ];
    const setupSection = $("teacher-setup");
    if (!setupDone) {
      hide(...allSections);
      show(setupSection);
    } else {
      show(...allSections);
      hide(setupSection);
    }
  }

  // -------------------------------------------------------------------------------------------------
  // 1. SETUP SECTION
  // -------------------------------------------------------------------------------------------------
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
        const idx = btn.dataset.idx;
        const newName = prompt("Enter new school name:", schools[idx]);
        if (newName && newName.trim()) {
          const oldName = schools[idx];
          schools[idx] = newName.trim();
          students = students.map(s => s.school === oldName ? { ...s, school: newName.trim() } : s);
          if (currentSchool === oldName) currentSchool = newName.trim();
          await Promise.all([
            idbSet("schools", schools),
            idbSet("students", students),
            idbSet("currentSchool", currentSchool)
          ]);
          await syncToFirebase();
          await loadSetup();
        }
      };
    });
    document.querySelectorAll(".delete-school").forEach(btn => {
      btn.onclick = async () => {
        const idx = btn.dataset.idx;
        const toDelete = schools[idx];
        if (confirm(`Delete school "${toDelete}" and all its data?`)) {
          schools.splice(idx, 1);
          students = students.filter(s => s.school !== toDelete);
          Object.keys(paymentsData).forEach(adm => {
            const st = students.find(s => s.adm === adm);
            if (!st || st.school === toDelete) delete paymentsData[adm];
          });
          Object.keys(attendanceData).forEach(date => {
            Object.keys(attendanceData[date]).forEach(adm => {
              const st = students.find(s => s.adm === adm);
              if (!st || st.school === toDelete) delete attendanceData[date][adm];
            });
          });
          if (currentSchool === toDelete) {
            currentSchool = null;
            teacherClass = null;
            teacherSection = null;
            await Promise.all([
              idbSet("currentSchool", currentSchool),
              idbSet("teacherClass", teacherClass),
              idbSet("teacherSection", teacherSection)
            ]);
          }
          await Promise.all([
            idbSet("schools", schools),
            idbSet("students", students),
            idbSet("paymentsData", paymentsData),
            idbSet("attendanceData", attendanceData)
          ]);
          await syncToFirebase();
          await loadSetup();
        }
      };
    });
  }

  async function loadSetup() {
    schools        = (await idbGet("schools")) || [];
    currentSchool  = await idbGet("currentSchool");
    teacherClass   = await idbGet("teacherClass");
    teacherSection = await idbGet("teacherSection");

    schoolSelect.innerHTML = [
      `<option disabled selected>-- Select School --</option>`,
      ...schools.map(s => `<option value="${s}">${s}</option>`)
    ].join("");
    if (currentSchool) schoolSelect.value = currentSchool;

    renderSchoolList();

    if (currentSchool && teacherClass && teacherSection) {
      classSelect.value = teacherClass;
      sectionSelect.value = teacherSection;
      setupText.textContent = `${currentSchool} 🏫 | Class: ${teacherClass} | Section: ${teacherSection}`;
      hide(setupForm);
      show(setupDisplay);
      resetViews();
      renderStudents();
      updateCounters();
    } else {
      show(setupForm);
      hide(setupDisplay);
      resetViews();
    }
  }

  saveSetupBtn.onclick = async (e) => {
    e.preventDefault();
    const selectedSchool = schoolInput.value.trim() || schoolSelect.value.trim();
    const selectedClass  = classSelect.value.trim();
    const selectedSect   = sectionSelect.value.trim();
    if (!selectedSchool || !selectedClass || !selectedSect) {
      alert("Please fill School, Class, and Section.");
      return;
    }
    currentSchool = selectedSchool;
    teacherClass  = selectedClass;
    teacherSection= selectedSect;
    if (!schools.includes(currentSchool)) {
      schools.push(currentSchool);
      await idbSet("schools", schools);
    }
    await Promise.all([
      idbSet("currentSchool", currentSchool),
      idbSet("teacherClass", teacherClass),
      idbSet("teacherSection", teacherSection),
    ]);
    await syncToFirebase();
    await loadSetup();
  };

  editSetupBtn.onclick = (e) => {
    e.preventDefault();
    show(setupForm);
    hide(setupDisplay);
    resetViews();
  };

  // -------------------------------------------------------------------------------------------------
  // 2. FINANCIAL SETTINGS SECTION
  // -------------------------------------------------------------------------------------------------
  const formDiv             = $("financialForm");
  const saveSettingsBtn     = $("saveSettings");
  const fineAbsentInput     = $("fineAbsent");
  const fineLateInput       = $("fineLate");
  const fineLeaveInput      = $("fineLeave");
  const fineHalfDayInput    = $("fineHalfDay");
  const eligibilityPctInput = $("eligibilityPct");
  const settingsCard        = document.createElement("div");
  const editSettingsBtn     = document.createElement("button");

  settingsCard.id = "settingsCard";
  settingsCard.className = "card hidden";
  editSettingsBtn.id = "editSettings";
  editSettingsBtn.className = "btn no-print hidden";
  $("financial-settings").appendChild(settingsCard);
  $("financial-settings").appendChild(editSettingsBtn);

  function renderSettings() {
    fineAbsentInput.value     = fineRates.A;
    fineLateInput.value       = fineRates.Lt;
    fineLeaveInput.value      = fineRates.L;
    fineHalfDayInput.value    = fineRates.HD;
    eligibilityPctInput.value = eligibilityPct;
    settingsCard.innerHTML = `
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
      </div>`;
  }

  saveSettingsBtn.onclick = async () => {
    fineRates.A  = Number(fineAbsentInput.value)  || fineRates.A;
    fineRates.Lt = Number(fineLateInput.value)    || fineRates.Lt;
    fineRates.L  = Number(fineLeaveInput.value)   || fineRates.L;
    fineRates.HD = Number(fineHalfDayInput.value) || fineRates.HD;
    eligibilityPct = Number(eligibilityPctInput.value) || eligibilityPct;

    await Promise.all([
      idbSet("fineRates", fineRates),
      idbSet("eligibilityPct", eligibilityPct)
    ]);
    await syncToFirebase();
    renderSettings();
    hide(formDiv, saveSettingsBtn, fineAbsentInput, fineLateInput, fineLeaveInput, fineHalfDayInput, eligibilityPctInput);
    show(settingsCard, editSettingsBtn);
    renderStudents();
    updateCounters();
  };

  editSettingsBtn.onclick = () => {
    hide(settingsCard, editSettingsBtn);
    show(formDiv, saveSettingsBtn, fineAbsentInput, fineLateInput, fineLeaveInput, fineHalfDayInput, eligibilityPctInput);
  };

  renderSettings();

  // -------------------------------------------------------------------------------------------------
  // 3. COUNTERS SECTION
  // -------------------------------------------------------------------------------------------------
  const countersContainer = $("countersContainer");

  function createCounterCard(id, title, spanId) {
    const card = document.createElement("div");
    card.id = id;
    card.className = "card counter-card no-print";
    card.innerHTML = `
      <div class="card-header"><h4>${title}</h4></div>
      <div class="card-number"><span id="${spanId}" data-target="0">0</span></div>
    `;
    countersContainer.appendChild(card);
    return card;
  }

  createCounterCard("card-section",     "Section",         "sectionCount");
  createCounterCard("card-class",       "Class",           "classCount");
  createCounterCard("card-school",      "School",          "schoolCount");
  createCounterCard("card-attendance",  "Attendance",      "attendanceCount");
  createCounterCard("card-eligible",    "Eligible",        "eligibleCount");
  createCounterCard("card-debarred",    "Debarred",        "debarredCount");
  createCounterCard("card-outstanding", "Outstanding/Fine","outstandingCount");

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

  // -------------------------------------------------------------------------------------------------
  // 4. STUDENT REGISTRATION SECTION
  // -------------------------------------------------------------------------------------------------
  const studentsBody            = $("studentsBody");
  const selectAllStudents       = $("selectAllStudents");
  const editSelectedBtn         = $("editSelected");
  const doneEditingBtn          = $("doneEditing");
  const deleteSelectedBtn       = $("deleteSelected");
  const shareRegistrationBtn    = $("shareRegistration");
  const downloadRegistrationBtn = $("downloadRegistrationPDF");

  function renderStudents() {
    const cl  = teacherClass;
    const sec = teacherSection;
    const sch = currentSchool;
    studentsBody.innerHTML = "";
    let idx = 0;

    students.forEach((s, i) => {
      if (s.school !== sch || s.cls !== cl || s.sec !== sec) return;
      idx++;

      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => {
        if (rec[s.adm]) stats[rec[s.adm]]++;
      });
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

      tr.querySelector(".add-payment-btn").onclick = () => {
        openPaymentModal(s.adm);
      };
    });

    if (selectAllStudents) selectAllStudents.checked = false;
    toggleButtons();
  }

  function updateCounters() {
    const cl  = teacherClass;
    const sec = teacherSection;
    const sch = currentSchool;

    const sectionStudents = students.filter(s => s.school === sch && s.cls === cl && s.sec === sec);
    sectionCountSpan.dataset.target = sectionStudents.length;

    const classStudents = students.filter(s => s.school === sch && s.cls === cl);
    classCountSpan.dataset.target = classStudents.length;

    const schoolStudents = students.filter(s => s.school === sch);
    schoolCountSpan.dataset.target = schoolStudents.length;

    let totalP = 0, totalA = 0, totalLt = 0, totalHD = 0, totalL = 0;
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
    const attendanceTotal = totalP + totalA + totalLt + totalHD + totalL;
    attendanceCountSpan.dataset.target = attendanceTotal;

    let eligibleCount = 0, debarredCount = 0, outstandingCount = 0;
    sectionStudents.forEach(s => {
      let p=0, a=0, lt=0, hd=0, l=0, recordedDays=0;
      Object.values(attendanceData).forEach(rec => {
        if (rec[s.adm]) {
          recordedDays++;
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
      const pct = recordedDays ? (p / recordedDays) * 100 : 0;
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

  function toggleButtons() {
    const anyChecked = document.querySelectorAll(".sel:checked").length > 0;
    if (deleteSelectedBtn) deleteSelectedBtn.disabled = !anyChecked;
    if (editSelectedBtn) editSelectedBtn.disabled = !anyChecked;
  }

  $("addStudent").onclick = async (e) => {
    e.preventDefault();
    const n   = $("studentName").value.trim();
    const p   = $("parentName").value.trim();
    const c   = $("parentContact").value.trim();
    const o   = $("parentOccupation").value.trim();
    const a   = $("parentAddress").value.trim();
    const cl  = teacherClass;
    const sec = teacherSection;
    const sch = currentSchool;
    if (!n || !p || !c || !o || !a) { alert("All fields required"); return; }
    if (!/^\d{7,15}$/.test(c)) { alert("Contact must be 7–15 digits"); return; }
    const adm = await genAdmNo();
    students.push({ name: n, adm, parent: p, contact: c, occupation: o, address: a, cls: cl, sec, school: sch });
    await Promise.all([ idbSet("students", students), syncToFirebase() ]);
    renderStudents();
    updateCounters();
    $("studentName").value       = "";
    $("parentName").value        = "";
    $("parentContact").value     = "";
    $("parentOccupation").value  = "";
    $("parentAddress").value     = "";
  };

  editSelectedBtn.onclick = () => {
    document.querySelectorAll("#studentsBody tr").forEach(tr => {
      if (!tr.querySelector(".sel").checked) return;
      const tds = tr.children;
      const [nTd, admTd, pTd, cTd, oTd, aTd] = [tds[2], tds[3], tds[4], tds[5], tds[6], tds[7]];
      nTd.innerHTML = `<input value="${nTd.textContent}">`;
      pTd.innerHTML = `<input value="${pTd.textContent}">`;
      cTd.innerHTML = `<input value="${cTd.textContent}">`;
      oTd.innerHTML = `<input value="${oTd.textContent}">`;
      aTd.innerHTML = `<input value="${aTd.textContent}">`;
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
        const idx = students.findIndex(x => x.adm === adm && x.school === currentSchool);
        if (idx > -1) {
          students[idx] = { ...students[idx], name: n, parent: p, contact: c, occupation: o, address: a };
        }
      }
    });
    await Promise.all([ idbSet("students", students), syncToFirebase() ]);
    hide(doneEditingBtn);
    show(editSelectedBtn, deleteSelectedBtn);
    renderStudents();
    updateCounters();
  };

  deleteSelectedBtn.onclick = async () => {
    if (!confirm("Delete selected students?")) return;
    document.querySelectorAll("#studentsBody tr").forEach(tr => {
      const checkbox = tr.querySelector(".sel");
      if (checkbox.checked) {
        const adm = tr.children[3].textContent;
        students = students.filter(s => !(s.adm === adm && s.school === currentSchool));
        delete paymentsData[adm];
        Object.keys(attendanceData).forEach(date => {
          if (attendanceData[date][adm]) delete attendanceData[date][adm];
        });
      }
    });
    await Promise.all([
      idbSet("students", students),
      idbSet("paymentsData", paymentsData),
      idbSet("attendanceData", attendanceData),
      syncToFirebase()
    ]);
    renderStudents();
    updateCounters();
  };

  selectAllStudents && (selectAllStudents.onclick = () => {
    const checked = selectAllStudents.checked;
    document.querySelectorAll(".sel").forEach(cb => cb.checked = checked);
    toggleButtons();
  });
  document.addEventListener("change", (e) => {
    if (e.target.classList.contains("sel")) toggleButtons();
  });

  shareRegistrationBtn.onclick = () => {
    const list = students
      .filter(s => s.school === currentSchool && s.cls === teacherClass && s.sec === teacherSection)
      .map((s, i) => `${i+1}. ${s.name} (Adm#: ${s.adm})`)
      .join("\n");
    const header = `Student List\n${currentSchool} | Class ${teacherClass} Sec ${teacherSection}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n\n" + (list || "No students."))}`, "_blank`);
  };

  downloadRegistrationBtn.onclick = async () => {
    const doc = new jspdf.jsPDF();
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(18); doc.text("Student Registration", 14, 16);
    doc.setFontSize(10); doc.text(`${currentSchool} | Class ${teacherClass} Sec ${teacherSection}`, w-14, 16, { align: "right" });
    doc.setFontSize(12); doc.text("Sr#  Adm#    Name     Parent     Contact", 14, 28);
    let y = 36;
    students
      .filter(s => s.school === currentSchool && s.cls === teacherClass && s.sec === teacherSection)
      .forEach((s, i) => {
        doc.text(`${i+1}.   ${s.adm}   ${s.name}   ${s.parent}   ${s.contact}`, 14, y);
        y += 8;
        if (y > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 20;
        }
      });
    const fileName = `registration_${currentSchool}_${teacherClass}_${teacherSection}.pdf`;
    const blob = doc.output("blob");
    doc.save(fileName);
    await sharePdf(blob, fileName, "Student Registration");
  };

  // -------------------------------------------------------------------------------------------------
  // 5. PAYMENT MODAL SECTION
  // -------------------------------------------------------------------------------------------------
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
  cancelPaymentBtn.onclick     = () => hide(paymentModal);

  savePaymentBtn.onclick = async () => {
    const adm = payAdmSpan.textContent;
    const amt = Number(paymentAmountInput.value) || 0;
    if (amt <= 0) { alert("Enter valid amount."); return; }
    paymentsData[adm] = paymentsData[adm] || [];
    paymentsData[adm].push({ date: new Date().toISOString().split("T")[0], amount: amt });
    await Promise.all([ idbSet("paymentsData", paymentsData), syncToFirebase() ]);
    hide(paymentModal);
    renderStudents();
    updateCounters();
  };

  // -------------------------------------------------------------------------------------------------
  // 6. ATTENDANCE SECTION
  // -------------------------------------------------------------------------------------------------
  const loadAttendanceBtn    = $("loadAttendance");
  const attendanceBodyDiv    = $("attendanceBody");
  const attendanceSummaryDiv = $("attendanceSummary");
  const dateInput            = $("attendanceDate");
  const shareAttendanceBtn   = $("shareAttendance");
  const downloadAttendanceBtn= $("downloadAttendancePDF");

  const statusNames  = { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" };
  const statusColors = { P:"var(--success)", A:"var(--danger)", Lt:"var(--warning)", HD:"#FF9800", L:"var(--info)" };

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = "";
    attendanceSummaryDiv.innerHTML = "";
    const cl  = teacherClass;
    const sec = teacherSection;
    const sch = currentSchool;
    attendanceBodyDiv.style.overflowX = "auto";

    students
      .filter(stu => stu.school === sch && stu.cls === cl && stu.sec === sec)
      .forEach((stu, i) => {
        const row = document.createElement("div");
        row.className = "attendance-row";
        const headerDiv = document.createElement("div");
        const btnsDiv   = document.createElement("div");
        headerDiv.className = "attendance-header";
        btnsDiv.className   = "attendance-buttons";
        headerDiv.textContent = `${i+1}. ${stu.name} (${stu.adm})`;
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
    show($("attendanceInputs"));
  };

  $("saveAttendance").onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert("Pick date."); return; }
    const cl  = teacherClass;
    const sec = teacherSection;
    const sch = currentSchool;
    if (!attendanceData[date]) attendanceData[date] = {};
    students
      .filter(stu => stu.school === sch && stu.cls === cl && stu.sec === sec)
      .forEach((stu, i) => {
        const btns = attendanceBodyDiv.children[i].querySelectorAll(".att-btn");
        const selected = [...btns].find(b => b.classList.contains("selected"));
        if (selected) {
          attendanceData[date][stu.adm] = selected.textContent;
        } else {
          delete attendanceData[date][stu.adm];
        }
      });
    await Promise.all([ idbSet("attendanceData", attendanceData), syncToFirebase() ]);
    alert("Attendance saved.");
    attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement("table");
    tbl.id = "attendanceSummaryTable";
    tbl.innerHTML = `
      <tr>
        <th>Sr#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th>
      </tr>`;
    students
      .filter(s => s.school === sch && s.cls === cl && s.sec === sec)
      .forEach((s, i) => {
        const code = attendanceData[date][s.adm] || "A";
        const statusText = statusNames[code] || "Absent";
        tbl.innerHTML += `
          <tr>
            <td>${i+1}</td>
            <td>${s.adm}</td>
            <td>${s.name}</td>
            <td>${statusText}</td>
            <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
          </tr>`;
      });
    attendanceSummaryDiv.appendChild(tbl);
    attendanceSummaryDiv.querySelectorAll(".share-individual").forEach(ic => {
      ic.onclick = () => {
        const adm = ic.dataset.adm;
        const st  = students.find(x => x.adm === adm && x.school === currentSchool);
        const code = attendanceData[date][adm] || "A";
        const msg = `Dear Parent, your child (Adm#: ${adm}) was ${statusNames[code]} on ${date}.`;
        window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`, "_blank");
      };
    });
    renderStudents();
    updateCounters();
  };

  shareAttendanceBtn.onclick = () => {
    const cl   = teacherClass;
    const sec  = teacherSection;
    const date = dateInput.value;
    if (!date) { alert("Load attendance first."); return; }
    const header = `*Attendance Report*\n${currentSchool} | Class ${cl} Sec ${sec} - ${date}`;
    const lines = students
      .filter(s => s.school === currentSchool && s.cls === cl && s.sec === sec)
      .map((s, i) => {
        const code = attendanceData[date][s.adm] || "A";
        return `${i+1}. ${s.name} (${s.adm}): ${statusNames[code]}`;
      })
      .join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n\n" + (lines || "No data."))}`, "_blank");
  };

  downloadAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert("Load attendance first."); return; }
    const cl   = teacherClass;
    const sec  = teacherSection;
    const doc = new jspdf.jsPDF();
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(18); doc.text("Attendance Report", 14, 16);
    doc.setFontSize(10); doc.text(`${currentSchool} | Class ${cl} Sec ${sec}`, w-14, 16, { align: "right" });
    doc.setFontSize(12); doc.text(`Date: ${date}`, 14, 24);
    const tempTbl = document.createElement("table");
    tempTbl.innerHTML = `
      <tr>
        <th>Sr#</th><th>Adm#</th><th>Name</th><th>Status</th>
      </tr>`;
    students.filter(s => s.school === currentSchool && s.cls === cl && s.sec === sec).forEach((s, i) => {
      const code = attendanceData[date][s.adm] || "A";
      tempTbl.innerHTML += `
        <tr>
          <td>${i+1}</td>
          <td>${s.adm}</td>
          <td>${s.name}</td>
          <td>${statusNames[code]}</td>
        </tr>`;
    });
    doc.autoTable({ startY: 30, html: tempTbl });
    const fileName = `attendance_${currentSchool}_${cl}_${sec}_${date}.pdf`;
    const blob = doc.output("blob");
    doc.save(fileName);
    await sharePdf(blob, fileName, "Attendance Report");
  };

  // -------------------------------------------------------------------------------------------------
  // 7. ANALYTICS SECTION
  // -------------------------------------------------------------------------------------------------
  const atg                  = $("analyticsTarget");
  const asel                 = $("analyticsSectionSelect");
  const atype                = $("analyticsType");
  const adateInput           = $("analyticsDate");
  const amonthInput          = $("analyticsMonth");
  const semsInput            = $("semesterStart");
  const semeInput            = $("semesterEnd");
  const ayearInput           = $("yearStart");
  const asearchInput         = $("analyticsSearch");
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
    L:  getComputedStyle(document.documentElement).getPropertyValue("--info").trim()
  };

  let analyticsFilterOptions = ["all"];
  let analyticsDownloadMode  = "combined";
  let lastAnalyticsStats     = [];
  let lastAnalyticsRange     = { from: null, to: null };
  let lastAnalyticsShare     = "";

  $("analyticsFilterBtn").onclick = () => show($("analyticsFilterModal"));
  $("analyticsFilterClose").onclick = () => hide($("analyticsFilterModal"));
  $("applyAnalyticsFilter").onclick = () => {
    analyticsFilterOptions = Array.from(document.querySelectorAll("#analyticsFilterForm input[type='checkbox']:checked")).map(cb => cb.value) || ["all"];
    analyticsDownloadMode = document.querySelector("#analyticsFilterForm input[name='downloadMode']:checked").value;
    hide($("analyticsFilterModal"));
    if (lastAnalyticsStats.length) renderAnalytics(lastAnalyticsStats, lastAnalyticsRange.from, lastAnalyticsRange.to);
  };

  resetAnalyticsBtn.onclick = (e) => {
    e.preventDefault();
    atype.value = "";
    [adateInput, amonthInput, semsInput, semeInput, ayearInput, asel, analyticsActionsDiv].forEach(x => x.classList.add("hidden"));
    resetAnalyticsBtn.classList.add("hidden");
    instructionsDiv.textContent = "";
  };

  loadAnalyticsBtn.onclick = () => {
    if (!currentSchool || !teacherClass || !teacherSection) { alert("Complete setup first."); return; }
    if (atg.value === "student" && !asearchInput.value.trim()) { alert("Enter admission number or name"); return; }
    let from, to;
    if (atype.value === "date") {
      if (!adateInput.value) { alert("Pick date."); return; }
      from = to = adateInput.value;
    } else if (atype.value === "month") {
      if (!amonthInput.value) { alert("Pick month."); return; }
      const [y, m] = amonthInput.value.split("-");
      from = `${y}-${m}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      to = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
    } else if (atype.value === "semester") {
      if (!semsInput.value || !semeInput.value) { alert("Pick semester range."); return; }
      from = `${semsInput.value}-01`;
      const [ey, em] = semeInput.value.split("-");
      const lastDay = new Date(ey, em, 0).getDate();
      to = `${ey}-${em}-${String(lastDay).padStart(2, "0")}`;
    } else if (atype.value === "year") {
      if (!ayearInput.value) { alert("Pick year."); return; }
      from = `${ayearInput.value}-01-01`;
      to   = `${ayearInput.value}-12-31`;
    } else {
      alert("Pick analytics type."); return;
    }

    const cls = teacherClass;
    const sec = teacherSection;
    let pool = students.filter(s => s.school === currentSchool && s.cls === cls && s.sec === sec);

    if (atg.value === "section") {
      const asec = asel.value;
      pool = pool.filter(s => s.sec === asec);
    }
    if (atg.value === "student") {
      const q = asearchInput.value.trim().toLowerCase();
      pool = pool.filter(s => s.adm.toLowerCase() === q || s.name.toLowerCase().includes(q));
    }

    const stats = pool.map(s => ({ adm: s.adm, name: s.name, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
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
      filtered = stats.filter(st => {
        for (let opt of analyticsFilterOptions) {
          if (opt === "eligible" && st.status === "Eligible") return true;
          if (opt === "debarred" && st.status === "Debarred") return true;
          if (opt === "outstanding" && st.outstanding > 0) return true;
          if (opt === "perfect" && st.P === st.total) return true;
        }
        return false;
      });
    }

    const tbody = $("analyticsTableBody");
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

    $("instructions").textContent = `Period: ${from} to ${to}`;
    show(instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv);

    const barCtx = barChartCanvas.getContext("2d");
    if (window.barChartInstance) window.barChartInstance.destroy();
    window.barChartInstance = new Chart(barCtx, {
      type: "bar",
      data: {
        labels: filtered.map(st => st.adm),
        datasets: [{
          label: "% Present",
          data: filtered.map(st => st.total ? (st.P / st.total) * 100 : 0),
          backgroundColor: "#007bff"
        }]
      },
      options: { scales: { y: { beginAtZero: true, max: 100 } } }
    });

    const totals = { P:0, A:0, Lt:0, HD:0, L:0 };
    filtered.forEach(st => {
      totals.P += st.P;
      totals.A += st.A;
      totals.Lt+= st.Lt;
      totals.HD+= st.HD;
      totals.L += st.L;
    });
    const pieCtx = pieChartCanvas.getContext("2d");
    if (window.pieChartInstance) window.pieChartInstance.destroy();
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

    lastAnalyticsShare =
      `Attendance Analytics (${from} to ${to})\n` +
      filtered.map((st, i) => {
        const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
        return `${i + 1}. ${st.adm} ${st.name}: ${pct}% / PKR ${st.outstanding}`;
      }).join("\n");
  }

  $("downloadAnalytics").onclick = async () => {
    if (!lastAnalyticsStats.length) { alert("Load analytics first"); return; }

    if (analyticsDownloadMode === "combined") {
      const doc = new jspdf.jsPDF();
      const w = doc.internal.pageSize.getWidth();
      const { from, to } = lastAnalyticsRange;
      doc.setFontSize(18); doc.text("Attendance Analytics", 14, 16);
      doc.setFontSize(10); doc.text(`Period: ${from} to ${to}`, w - 14, 16, { align: "right" });
      doc.setFontSize(12); doc.text(`${currentSchool} | Class ${teacherClass} Sec ${teacherSection}`, 14, 24);

      const tempTable = document.createElement("table");
      tempTable.innerHTML = `
        <tr>
          <th>Sr#</th><th>Adm#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th><th>Fine</th><th>Status</th>
        </tr>`;
      lastAnalyticsStats.forEach((st, i) => {
        const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
        tempTable.innerHTML += `
          <tr>
            <td>${i+1}</td>
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
      });
      doc.autoTable({ startY: 30, html: tempTable });
      const fileName = `analytics_${currentSchool}_${lastAnalyticsRange.from}_to_${lastAnalyticsRange.to}.pdf`;
      const blob = doc.output("blob");
      doc.save(fileName);
      await sharePdf(blob, fileName, "Attendance Analytics");
    } else {
      const doc = new jspdf.jsPDF();
      const w  = doc.internal.pageSize.getWidth();
      const { from, to } = lastAnalyticsRange;
      lastAnalyticsStats.forEach((st, i) => {
        if (i > 0) doc.addPage();
        doc.setFontSize(18);
        doc.text("Attendance Analytics (Individual Receipt)", 14, 16);
        doc.setFontSize(10);
        doc.text(`Period: ${from} to ${to}`, w - 14, 16, { align: "right" });
        doc.setFontSize(12);
        doc.text(`${currentSchool} | Class ${teacherClass} Sec ${teacherSection}`, 14, 28);
        doc.setFontSize(14);
        doc.text(`Student: ${st.name}  (Adm#: ${st.adm})`, 14, 44);
        doc.setFontSize(12);
        doc.text(`Present   : ${st.P}`, 14, 60);
        doc.text(`Absent    : ${st.A}`, 80, 60);
        doc.text(`Late      : ${st.Lt}`, 14, 74);
        doc.text(`Half-Day  : ${st.HD}`, 80, 74);
        doc.text(`Leave     : ${st.L}`, 14, 88);
        doc.text(`Total Days Marked: ${st.total}`, 14, 102);
        const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
        doc.text(`Percentage Present: ${pct}%`, 14, 116);
        doc.text(`Outstanding Fine: PKR ${st.outstanding}`, 14, 130);
        const fineRatesText = `
Fine Rates:
  Absent: PKR ${fineRates.A}
  Late  : PKR ${fineRates.Lt}
  Leave : PKR ${fineRates.L}
  Half-Day: PKR ${fineRates.HD}
Eligibility: ≥ ${eligibilityPct}%
        `.trim();
        const blockStartY = 150;
        doc.setFontSize(12);
        fineRatesText.split("\n").forEach((ln, idx) => {
          doc.text(14, blockStartY + idx * 6, ln);
        });
        const signY = blockStartY + 6 * (fineRatesText.split("\n").length) + 10;
        doc.setFontSize(12);
        doc.text("_______________________________", 14, signY);
        doc.text("     HOD Signature", 14, signY + 8);
        const footerY = signY + 30;
        doc.setFontSize(10);
        doc.text("Receipt generated by Attendance Mgmt App", w - 14, footerY, { align: "right" });
      });
      const individualFileName = `analytics_individual_${currentSchool}_${lastAnalyticsRange.from}_to_${lastAnalyticsRange.to}.pdf`;
      const individualBlob = doc.output("blob");
      doc.save(individualFileName);
      await sharePdf(individualBlob, individualFileName, "Attendance Analytics (Individual Receipt)");
    }
  };

  shareAnalyticsBtn.onclick = () => {
    if (!lastAnalyticsShare) { alert("Load analytics first"); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, "_blank`);
  };

  // -------------------------------------------------------------------------------------------------
  // 8. ATTENDANCE REGISTER SECTION
  // -------------------------------------------------------------------------------------------------
  const registerTableWrapper = $("registerTableWrapper");
  const registerBodyTbody    = $("registerBodyTbody");
  const registerHeaderRow    = $("registerHeaderRow");
  const changeRegisterBtn    = $("changeRegister");
  const loadRegisterBtn      = $("loadRegister");
  const saveRegisterBtn      = $("saveRegister");
  const downloadRegisterBtn  = $("downloadRegister");
  const shareRegisterBtn     = $("shareRegister");
  const registerMonthInput   = $("registerMonth");

  changeRegisterBtn.onclick = () => {
    show(loadRegisterBtn);
    hide(saveRegisterBtn, downloadRegisterBtn, shareRegisterBtn);
    registerBodyTbody.innerHTML = "";
    registerHeaderRow.innerHTML  = "";
  };

  loadRegisterBtn.onclick = () => {
    const m = registerMonthInput.value;
    if (!m) { alert("Pick month"); return; }
    const sch = currentSchool;
    const cls = teacherClass;
    const sec = teacherSection;
    const dateKeys = Object.keys(attendanceData).filter(d => d.startsWith(m + "-")).sort();
    if (!dateKeys.length) { alert("No attendance marked this month."); return; }

    registerHeaderRow.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
      dateKeys.map(k => `<th>${k.split("-")[2]}</th>`).join("");
    registerBodyTbody.innerHTML = "";

    students.filter(s => s.school === sch && s.cls === cls && s.sec === sec).forEach((s, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
        dateKeys.map(date => {
          const code = attendanceData[date] && attendanceData[date][s.adm] ? attendanceData[date][s.adm] : "";
          const color = code
            ? (code === "P" ? "var(--success)" : code === "Lt" ? "var(--warning)" :
               code === "HD" ? "#FF9800" : code === "L" ? "var(--info)" : "var(--danger)")
            : "";
          return `<td><span class="status-text" style="display:inline-block; width:24px; height:24px; line-height:24px; text-align:center;${color?`background:${color};color:#fff;`:``}">${code}</span></td>`;
        }).join("");
      registerBodyTbody.appendChild(tr);
    });
    show(registerTableWrapper, saveRegisterBtn, downloadRegisterBtn, shareRegisterBtn);
    hide(loadRegisterBtn);
  };

  saveRegisterBtn.onclick = async () => {
    const m = registerMonthInput.value;
    const sch = currentSchool;
    const cls = teacherClass;
    const sec = teacherSection;
    const dateKeys = Object.keys(attendanceData).filter(d => d.startsWith(m + "-")).sort();
    registerBodyTbody.querySelectorAll("tr").forEach((tr, rowIdx) => {
      const adm = tr.children[1].textContent;
      dateKeys.forEach((date, idx) => {
        const code = tr.children[3 + idx].querySelector(".status-text").textContent;
        attendanceData[date] = attendanceData[date] || {};
        if (code) attendanceData[date][adm] = code;
        else delete attendanceData[date][adm];
      });
    });
    await Promise.all([ idbSet("attendanceData", attendanceData), syncToFirebase() ]);
    alert("Register saved.");
    renderStudents();
    updateCounters();
  };

  downloadRegisterBtn.onclick = async () => {
    const m = registerMonthInput.value;
    if (!m) { alert("Pick month"); return; }
    const sch = currentSchool;
    const cls = teacherClass;
    const sec = teacherSection;
    const dateKeys = Object.keys(attendanceData).filter(d => d.startsWith(m + "-")).sort();
    if (!dateKeys.length) { alert("No attendance marked this month."); return; }

    const doc = new jspdf.jsPDF("l", "pt", "a4");
    const w = doc.internal.pageSize.getWidth();
    doc.setFontSize(18); doc.text("Attendance Register", 14, 20);
    doc.setFontSize(10); doc.text(`Date: ${m}`, w - 14, 20, { align: "right" });
    doc.setFontSize(12); doc.text(`${currentSchool} | Class ${cls} Sec ${sec}`, 14, 36);

    const tempTbl = document.createElement("table");
    tempTbl.innerHTML = `<tr><th>#</th><th>Adm#</th><th>Name</th>` +
      dateKeys.map(d => `<th>${d.split("-")[2]}</th>`).join("") + `</tr>`;
    students.filter(s => s.school === sch && s.cls === cls && s.sec === sec).forEach((s, i) => {
      tempTbl.innerHTML += `<tr><td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
        dateKeys.map(date => {
          const code = attendanceData[date] && attendanceData[date][s.adm] ? attendanceData[date][s.adm] : "";
          return `<td>${code}</td>`;
        }).join("") + `</tr>`;
    });
    doc.autoTable({ startY: 60, html: tempTbl, tableWidth: "auto", styles: { fontSize: 8 } });
    const fileName = `register_${currentSchool}_${cls}_${sec}_${m}.pdf`;
    const blob = doc.output("blob");
    doc.save(fileName);
    await sharePdf(blob, fileName, "Attendance Register");
  };

  shareRegisterBtn.onclick = () => {
    const m = registerMonthInput.value;
    if (!m) { alert("Pick month"); return; }
    const sch = currentSchool;
    const cls = teacherClass;
    const sec = teacherSection;
    const dateKeys = Object.keys(attendanceData).filter(d => d.startsWith(m + "-")).sort();
    if (!dateKeys.length) { alert("No attendance marked this month."); return; }

    const header = `Attendance Register\n${currentSchool} | Class ${cls} Sec ${sec}`;
    const rows = Array.from(registerBodyTbody.children).map(tr =>
      Array.from(tr.children).map(td => td.querySelector(".status-text")?.textContent || td.textContent).join(" ")
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header + "\n" + rows.join("\n"))}`, "_blank");
  };

  // -------------------------------------------------------------------------------------------------
  // 9. BACKUP / RESTORE SECTION
  // -------------------------------------------------------------------------------------------------
  const chooseBackupFolderBtn = $("chooseBackupFolder");
  const restoreDataBtn       = $("restoreData");
  const restoreFileInput     = $("restoreFileInput");
  const factoryResetBtn      = $("factoryReset");

  let backupDirectoryHandle = null;

  chooseBackupFolderBtn.onclick = async () => {
    try {
      backupDirectoryHandle = await window.showDirectoryPicker();
      alert("Backup folder selected.");
    } catch (err) {
      console.error(err);
      alert("Folder selection canceled or not supported.");
    }
  };

  restoreDataBtn.onclick = () => restoreFileInput.click();

  restoreFileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      students       = data.students       || [];
      attendanceData = data.attendanceData || {};
      paymentsData   = data.paymentsData   || {};
      lastAdmNo      = data.lastAdmNo      || lastAdmNo;
      fineRates      = data.fineRates      || fineRates;
      eligibilityPct = data.eligibilityPct || eligibilityPct;
      schools        = data.schools        || [];
      currentSchool  = data.currentSchool  || null;
      teacherClass   = data.teacherClass   || null;
      teacherSection = data.teacherSection || null;

      await Promise.all([
        idbSet("students", students),
        idbSet("attendanceData", attendanceData),
        idbSet("paymentsData", paymentsData),
        idbSet("lastAdmNo", lastAdmNo),
        idbSet("fineRates", fineRates),
        idbSet("eligibilityPct", eligibilityPct),
        idbSet("schools", schools),
        idbSet("currentSchool", currentSchool),
        idbSet("teacherClass", teacherClass),
        idbSet("teacherSection", teacherSection),
      ]);
      await syncToFirebase();
      await loadSetup();
      alert("Data restored from backup.");
    } catch (err) {
      console.error("Restore error:", err);
      alert("Failed to restore data.");
    }
  };

  factoryResetBtn.onclick = async () => {
    if (!confirm("Factory reset will delete all data. Continue?")) return;
    const defaultPayload = {
      students: [],
      attendanceData: {},
      paymentsData: {},
      lastAdmNo: 0,
      fineRates: { A:50, Lt:20, L:10, HD:30 },
      eligibilityPct: 75,
      schools: [],
      currentSchool: null,
      teacherClass: null,
      teacherSection: null
    };
    await dbSet(dbRef(db, "attendanceAppData"), defaultPayload);
    alert("Factory reset completed.");
  };

  // -------------------------------------------------------------------------------------------------
  // Periodic Auto-Backup (if folder chosen)
  // -------------------------------------------------------------------------------------------------
  setInterval(async () => {
    if (!backupDirectoryHandle) return;
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
        teacherSection,
      };
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}`;
      const fileName = `backup_${currentSchool || "all"}_${timestamp}.json`;
      const fileHandle = await backupDirectoryHandle.getFileHandle(fileName, { create: true });
      const writer = await fileHandle.createWritable();
      await writer.write(JSON.stringify(backupData, null, 2));
      await writer.close();
      console.log("✅ Auto-backup saved:", fileName);
    } catch (err) {
      console.error("Auto-backup error:", err);
    }
  }, 30 * 60 * 1000); // every 30 minutes

  // -------------------------------------------------------------------------------------------------
  // Finalize: Load setup on page load
  // -------------------------------------------------------------------------------------------------
  await loadSetup();

  // Ensure counters container is scrollable
  const container = $("countersContainer");
  if (container) {
    container.style.display = "flex";
    container.style.overflowX = "auto";
    container.style.whiteSpace = "nowrap";
  }
});
