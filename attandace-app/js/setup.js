// js/setup.js
import { database } from "./firebase-config.js";
import { idbGet, idbSet } from "./utils.js";
import { dbRef, set as dbSet } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { show, hide } from "./utils.js";
import { renderStudents, updateCounters } from "./students.js"; // assuming students.js exports these
import { renderSchoolList } from "./utils.js"; // یا اگر الگ function لکھیں

const setupForm    = document.getElementById("setupForm");
const schoolInput  = document.getElementById("schoolInput");
const schoolSelect = document.getElementById("schoolSelect");
const classSelect  = document.getElementById("teacherClassSelect");
const sectionSelect= document.getElementById("teacherSectionSelect");
const setupText    = document.getElementById("setupText");
const saveSetupBtn = document.getElementById("saveSetup");
const editSetupBtn = document.getElementById("editSetup");
let schools, currentSchool, teacherClass, teacherSection;

// Load initial setup state
export async function loadSetup() {
  schools        = (await idbGet("schools")) || [];
  currentSchool  = await idbGet("currentSchool");
  teacherClass   = await idbGet("teacherClass");
  teacherSection = await idbGet("teacherSection");

  schoolSelect.innerHTML = ['<option disabled selected>-- Select School --</option>', ...schools.map(s => `<option value="${s}">${s}</option>`)].join("");
  if (currentSchool) schoolSelect.value = currentSchool;

  renderSchoolList(); // assume یہ function بھی utils یا اس فائل میں موجود ہے

  if (currentSchool && teacherClass && teacherSection) {
    classSelect.value   = teacherClass;
    sectionSelect.value = teacherSection;
    setupText.textContent = `${currentSchool} 🏫 | Class: ${teacherClass} | Section: ${teacherSection}`;
    hide(setupForm);
    show(document.getElementById("setupDisplay"));

    // پھر باقی ایپ initial rendering کریں:
    setTimeout(() => {
      renderStudents();
      updateCounters();
      hideAllViewsExcept("students"); // فرض کریں ایسا کوئی function ہے
    }, 0);

  } else {
    show(setupForm);
    hide(document.getElementById("setupDisplay"));
  }
}

saveSetupBtn.onclick = async (e) => {
  e.preventDefault();
  const newSchool = schoolInput.value.trim();
  if (newSchool) {
    if (!schools.includes(newSchool)) {
      schools.push(newSchool);
      await idbSet("schools", schools);
      // Firebase پر بھی:
      await dbSet(dbRef(database, `users/${auth.currentUser.uid}/school`), schools);
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
  // Firebase پر بھی:
  await dbSet(dbRef(database, "users/" + auth.currentUser.uid), {
    school: currentSchool,
    class: teacherClass,
    sections: [teacherSection],
    role: "teacher" // یا principal/admin وغیرہ
  });
  await loadSetup();
};

editSetupBtn.onclick = (e) => {
  e.preventDefault();
  show(setupForm);
  hide(document.getElementById("setupDisplay"));
};
