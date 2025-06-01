// setup.js
import { database } from "./index.html";
import { ref as dbRef, set as dbSet, onValue, get as dbGet } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// DOM Elements (Setup سیکشن)
const setupForm = document.getElementById("setupForm");
const setupDisplay = document.getElementById("setupDisplay");
const schoolInput = document.getElementById("schoolInput");
const schoolSelect = document.getElementById("schoolSelect");
const classSelect = document.getElementById("teacherClassSelect");
const sectionSelect = document.getElementById("teacherSectionSelect");
const setupText = document.getElementById("setupText");
const saveSetupBtn = document.getElementById("saveSetup");
const editSetupBtn = document.getElementById("editSetup");
const schoolListDiv = document.getElementById("schoolList");

// IndexedDB و دیگر مقامی ڈیٹا
const { get: idbGet, set: idbSet } = window.idbKeyval;

// یہ متغیرز global کہیں بھی استعمال ہوں گے
window.studentsBySchool = {};         // { schoolName: [ { …student fields… } ] }
window.attendanceDataBySchool = {};
window.paymentsDataBySchool = {};
window.lastAdmNoBySchool = {};
window.fineRates = { A:50, Lt:20, L:10, HD:30 };
window.eligibilityPct = 75;
window.schools = [];
window.currentSchool = null;
window.teacherClass = null;
window.teacherSection = null;
window.students = [];
window.attendanceData = {};
window.paymentsData = {};
window.lastAdmNo = 0;

// ---------------
// 1. یوزر لاگ ان ہونے کے بعد initialize کریں
// ---------------
document.addEventListener("userLoggedIn", async () => {
  // 1.1 اسکولز کی فہرست لوڈ کریں (Realtime DB سے)
  const appDataSnap = await dbGet(dbRef(database, "appData"));
  if (appDataSnap.exists()) {
    const appData = appDataSnap.val();
    window.schools = appData.schools || [];
    window.studentsBySchool = appData.studentsBySchool || {};
    window.attendanceDataBySchool = appData.attendanceDataBySchool || {};
    window.paymentsDataBySchool = appData.paymentsDataBySchool || {};
    window.lastAdmNoBySchool = appData.lastAdmNoBySchool || {};
    window.fineRates = appData.fineRates || window.fineRates;
    window.eligibilityPct = appData.eligibilityPct || window.eligibilityPct;
    window.currentSchool = appData.currentSchool || null;
    window.teacherClass = appData.teacherClass || null;
    window.teacherSection = appData.teacherSection || null;
  } else {
    window.schools = [];
    window.studentsBySchool = {};
    window.attendanceDataBySchool = {};
    window.paymentsDataBySchool = {};
    window.lastAdmNoBySchool = {};
  }

  await renderSetupUI();
});

// ---------------
// 2. Setup UI کو رول کے مطابق دکھائیں / چھپائیں
// ---------------
async function renderSetupUI() {
  const profile = window.currentUserProfile;
  if (!profile) return;

  // اگر ایڈمن ہے تو مکمل اسکول مینجمنٹ دکھائیں
  if (profile.role === "admin") {
    // سبھی فیلڈز دکھائیں: نئے اسکول کا ٹیکسٹ باکس اور سکول ڈراپ ڈاؤن بھی
    setupForm.querySelector("#schoolInput").classList.remove("hidden");
    setupForm.querySelector("#schoolSelect").classList.remove("hidden");
    classSelect.disabled = false;
    sectionSelect.disabled = false;
    saveSetupBtn.disabled = false;

    // سکول کی لسٹ render کریں
    renderSchoolList();

    // اگر پہلے سے currentSchool سیٹ ہے تو اسے ڈراپ ڈاؤن میں سیٹ کریں
    if (window.currentSchool) {
      schoolSelect.value = window.currentSchool;
      classSelect.value = window.teacherClass;
      sectionSelect.value = window.teacherSection;
      setupText.textContent = `${window.currentSchool} 🏫 | Class: ${window.teacherClass} | Section: ${window.teacherSection}`;
      setupForm.classList.add("hidden");
      setupDisplay.classList.remove("hidden");
      showMainSections();
    } else {
      setupForm.classList.remove("hidden");
      setupDisplay.classList.add("hidden");
      hideMainSections();
    }
  }

  // اگر پرنسپل ہے تو صرف اپنا اسکول سیٹ کریں، کلاس اور سیکشن آپشنل
  else if (profile.role === "principal") {
    // نئے اسکول نہیں بنائے گا، صرف وہ سکول سیٹ کریں جو اس کے پروفائل میں پہلے سے سیٹ ہے۔
    const mySchool = profile.school;
    window.currentSchool = mySchool;
    window.teacherClass = null;
    window.teacherSection = null;

    // اسکول سیلیکٹ کو disable کرکے صرف اپنا سکول سیٹ کریں
    schoolSelect.innerHTML = `<option value="${mySchool}">${mySchool}</option>`;
    schoolSelect.disabled = true;

    // کلاس اور سیکشن ان پٹ انڈیبل رکھیں تاکہ پرنسپل انہیں سیٹ کرسکے
    classSelect.disabled = false;
    sectionSelect.disabled = false;

    setupForm.classList.remove("hidden");
    setupDisplay.classList.add("hidden");
    hideMainSections();
  }

  // اگر ٹیچر ہے تو اس کا اسکول+کلاس+سیکشن پروفائل میں پہلے سے موجود ہے،
  // اس لیے صرف display کریں اور دوبارہ سیٹ کرنے کی اجازت نہ دیں۔
  else if (profile.role === "teacher") {
    const mySchool = profile.school;
    const myClass = profile.class;
    const mySection = profile.section;

    window.currentSchool = mySchool;
    window.teacherClass = myClass;
    window.teacherSection = mySection;

    setupText.textContent = `${mySchool} 🏫 | Class: ${myClass} | Section: ${mySection}`;
    setupForm.classList.add("hidden");
    setupDisplay.classList.remove("hidden");
    showMainSections();
  }

  // --------------------------------
  // display اور hide کرنے والی helper فنکشنز
  // --------------------------------
  function hideMainSections() {
    const allSecs = [
      document.getElementById("financial-settings"),
      document.getElementById("animatedCounters"),
      document.getElementById("student-registration"),
      document.getElementById("attendance-section"),
      document.getElementById("analytics-section"),
      document.getElementById("register-section"),
    ];
    allSecs.forEach((sec) => sec.classList.add("hidden"));
  }
  function showMainSections() {
    const allSecs = [
      document.getElementById("financial-settings"),
      document.getElementById("animatedCounters"),
      document.getElementById("student-registration"),
      document.getElementById("attendance-section"),
      document.getElementById("analytics-section"),
      document.getElementById("register-section"),
    ];
    allSecs.forEach((sec) => sec.classList.remove("hidden"));
  }
}

// ------------------------
// 3. سکولز کی لسٹ دکھائیں (Admin کے لیے)
// ------------------------
function renderSchoolList() {
  schoolListDiv.innerHTML = "";
  window.schools.forEach((sch, idx) => {
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

  // Edit بٹن
  document.querySelectorAll(".edit-school").forEach((btn) => {
    btn.onclick = async () => {
      const idx = +btn.dataset.idx;
      const newName = prompt("Edit School Name:", window.schools[idx]);
      if (newName?.trim()) {
        const oldName = window.schools[idx];
        window.schools[idx] = newName.trim();

        // سکول کا نام بدلنا → تمام متعلقہ mappings کو بھی rename کریں
        window.studentsBySchool[newName] = window.studentsBySchool[oldName] || [];
        delete window.studentsBySchool[oldName];

        window.attendanceDataBySchool[newName] = window.attendanceDataBySchool[oldName] || {};
        delete window.attendanceDataBySchool[oldName];

        window.paymentsDataBySchool[newName] = window.paymentsDataBySchool[oldName] || {};
        delete window.paymentsDataBySchool[oldName];

        window.lastAdmNoBySchool[newName] = window.lastAdmNoBySchool[oldName] || 0;
        delete window.lastAdmNoBySchool[oldName];

        // اگر currentSchool بھی oldName تھی تو اسے update کریں
        if (window.currentSchool === oldName) {
          window.currentSchool = newName.trim();
        }

        // ڈیٹا بیس میں sync کریں
        await syncAppDataToFirebase();
        renderSchoolList();
      }
    };
  });

  // Delete بٹن
  document.querySelectorAll(".delete-school").forEach((btn) => {
    btn.onclick = async () => {
      const idx = +btn.dataset.idx;
      if (!confirm(`Delete school "${window.schools[idx]}"?`)) return;
      const removed = window.schools.splice(idx, 1)[0];

      delete window.studentsBySchool[removed];
      delete window.attendanceDataBySchool[removed];
      delete window.paymentsDataBySchool[removed];
      delete window.lastAdmNoBySchool[removed];

      if (window.currentSchool === removed) {
        window.currentSchool = null;
        window.teacherClass = null;
        window.teacherSection = null;
      }
      await syncAppDataToFirebase();
      renderSchoolList();
    };
  });
}

// -----------------------------
// 4. SAVE SETUP (Admin/Principal)
// -----------------------------
saveSetupBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  const profile = window.currentUserProfile;

  // اگر Admin ہے تو:
  if (profile.role === "admin") {
    const newSchool = schoolInput.value.trim();
    if (newSchool) {
      // نئے سکول کا اضافہ کریں
      if (!window.schools.includes(newSchool)) {
        window.schools.push(newSchool);
        window.studentsBySchool[newSchool] = [];
        window.attendanceDataBySchool[newSchool] = {};
        window.paymentsDataBySchool[newSchool] = {};
        window.lastAdmNoBySchool[newSchool] = 0;
      }
      schoolInput.value = "";
      await syncAppDataToFirebase();
      renderSchoolList();
      return;
    }
    // یا پھر کسی existing سکول کے لیے سیلیکٹ + کلاس + سیکشن سیٹ کریں
    const selSchool = schoolSelect.value;
    const selClass = classSelect.value;
    const selSection = sectionSelect.value;
    if (!selSchool || !selClass || !selSection) {
      alert("Please select a school, class, and section.");
      return;
    }
    window.currentSchool = selSchool;
    window.teacherClass = selClass;
    window.teacherSection = selSection;
    await syncAppDataToFirebase();
    setupText.textContent = `${selSchool} 🏫 | Class: ${selClass} | Section: ${selSection}`;
    setupForm.classList.add("hidden");
    setupDisplay.classList.remove("hidden");
    showMainSections();
  }

  // اگر Principal ہے تو:
  else if (profile.role === "principal") {
    const mySchool = profile.school; // پہلے سے طے شدہ
    const selClass = classSelect.value;
    const selSection = sectionSelect.value;
    if (!selClass || !selSection) {
      alert("Please select a class and section.");
      return;
    }
    window.currentSchool = mySchool;
    window.teacherClass = selClass;
    window.teacherSection = selSection;
    await syncAppDataToFirebase();
    setupText.textContent = `${mySchool} 🏫 | Class: ${selClass} | Section: ${selSection}`;
    setupForm.classList.add("hidden");
    setupDisplay.classList.remove("hidden");
    showMainSections();
  }
});

// -------------------
// 5. EDIT SETUP بٹن
// -------------------
editSetupBtn.addEventListener("click", (e) => {
  e.preventDefault();
  setupForm.classList.remove("hidden");
  setupDisplay.classList.add("hidden");
  hideMainSections();
});

// -------------------
// 6. Firebase پر سارا appData sync کریں
// -------------------
export async function syncAppDataToFirebase() {
  const payload = {
    studentsBySchool: window.studentsBySchool,
    attendanceDataBySchool: window.attendanceDataBySchool,
    paymentsDataBySchool: window.paymentsDataBySchool,
    lastAdmNoBySchool: window.lastAdmNoBySchool,
    fineRates: window.fineRates,
    eligibilityPct: window.eligibilityPct,
    schools: window.schools,
    currentSchool: window.currentSchool,
    teacherClass: window.teacherClass,
    teacherSection: window.teacherSection,
  };
  try {
    await dbSet(dbRef(database, "appData"), payload);
    console.log("✅ App Data Synced to Firebase");
  } catch (err) {
    console.error("Sync failed:", err);
  }
}

// -------------------
// 7. “حاضر/غیاب” وغیرہ والی بخشیں تبھی دکھائیں جب کوئی اسکول + کلاس + سیکشن سیٹ ہو
// -------------------
function hideMainSections() {
  const allSecs = [
    document.getElementById("financial-settings"),
    document.getElementById("animatedCounters"),
    document.getElementById("student-registration"),
    document.getElementById("attendance-section"),
    document.getElementById("analytics-section"),
    document.getElementById("register-section"),
  ];
  allSecs.forEach((sec) => sec.classList.add("hidden"));
}
function showMainSections() {
  const allSecs = [
    document.getElementById("financial-settings"),
    document.getElementById("animatedCounters"),
    document.getElementById("student-registration"),
    document.getElementById("attendance-section"),
    document.getElementById("analytics-section"),
    document.getElementById("register-section"),
  ];
  allSecs.forEach((sec) => sec.classList.remove("hidden"));
}
