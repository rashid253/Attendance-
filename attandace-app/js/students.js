// js/students.js
import { idbGet, idbSet, genAdmNo, syncToFirebase, show, hide } from "./utils.js";
import { database } from "./firebase-config.js";
import { dbRef, set as dbSet } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const studentsBody      = document.getElementById("studentsBody");
const selectAllStudents = document.getElementById("selectAllStudents");
const editSelected      = document.getElementById("editSelected");
const doneEditing       = document.getElementById("doneEditing");
const deleteSelected    = document.getElementById("deleteSelected");
const saveRegistration  = document.getElementById("saveRegistration");
const addStudentBtn     = document.getElementById("addStudent");

let students = [], attendanceData = {}, paymentsData = {}, fineRates, eligibilityPct;

export async function initStudentsModule() {
  // Load local state
  students       = (await idbGet("students"))       || [];
  attendanceData = (await idbGet("attendanceData")) || {};
  paymentsData   = (await idbGet("paymentsData"))   || [];
  fineRates      = (await idbGet("fineRates"))      || { A:50, Lt:20, L:10, HD:30 };
  eligibilityPct = (await idbGet("eligibilityPct")) || 75;

  renderStudents();
  updateCounters();

  selectAllStudents.onclick = () => {
    document.querySelectorAll(".sel").forEach(c => c.checked = selectAllStudents.checked);
    toggleButtons();
  };
  studentsBody.addEventListener("change", e => {
    if (e.target.classList.contains("sel")) toggleButtons();
  });

  addStudentBtn.onclick = addStudent;
  editSelected.onclick = startEditingSelected;
  doneEditing.onclick = finishEditingSelected;
  deleteSelected.onclick = deleteSelectedStudents;
  saveRegistration.onclick = saveAllStudents;
}

function toggleButtons() {
  const any = !!document.querySelector(".sel:checked");
  editSelected.disabled = !any;
  deleteSelected.disabled = !any;
}

export function renderStudents() {
  const cl  = document.getElementById("teacherClassSelect").value;
  const sec = document.getElementById("teacherSectionSelect").value;
  studentsBody.innerHTML = "";
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
    const status= (out>0 || pct<eligibilityPct) ? "Debarred" : "Eligible";
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

  // Attach payment buttons
  document.querySelectorAll(".add-payment-btn").forEach(b => {
    b.onclick = () => openPaymentModal(b.dataset.adm);
  });
}

async function addStudent(e) {
  e.preventDefault();
  const n = document.getElementById("studentName").value.trim();
  const p = document.getElementById("parentName").value.trim();
  const c = document.getElementById("parentContact").value.trim();
  const o = document.getElementById("parentOccupation").value.trim();
  const a = document.getElementById("parentAddress").value.trim();
  const cl= document.getElementById("teacherClassSelect").value;
  const sec=document.getElementById("teacherSectionSelect").value;
  if (!n||!p||!c||!o||!a) { alert("All fields required"); return; }
  if (!/^\d{7,15}$/.test(c)) { alert("Contact must be 7–15 digits"); return; }
  const adm = await genAdmNo();
  students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec });
  await idbSet("students", students);
  // Firebase پر بھی write کرنا چاہیں تو:
  await syncToFirebase({
    students,
    attendanceData,
    paymentsData,
    lastAdmNo: await idbGet("lastAdmissionNo"),
    fineRates, eligibilityPct, schools: await idbGet("schools"),
    currentSchool: await idbGet("currentSchool"), teacherClass: await idbGet("teacherClass"), teacherSection: await idbGet("teacherSection")
  });
  renderStudents(); updateCounters(); hideAllViewsExcept("students");
}

function startEditingSelected() {
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
  hide(editSelected);
  show(doneEditing);
}

async function finishEditingSelected() {
  document.querySelectorAll("#studentsBody tr").forEach(tr => {
    const inps = [...tr.querySelectorAll("input:not(.sel)")];
    if (inps.length === 5) {
      const [n,p,c,o,a] = inps.map(i=>i.value.trim()), adm = tr.children[3].textContent;
      const idx = students.findIndex(x=>x.adm===adm);
      if (idx > -1) students[idx] = { ...students[idx], name:n, parent:p, contact:c, occupation:o, address:a };
    }
  });
  await idbSet("students", students);
  await syncToFirebase({
    students,
    attendanceData,
    paymentsData,
    lastAdmNo: await idbGet("lastAdmissionNo"),
    fineRates, eligibilityPct, schools: await idbGet("schools"),
    currentSchool: await idbGet("currentSchool"), teacherClass: await idbGet("teacherClass"), teacherSection: await idbGet("teacherSection")
  });
  hide(doneEditing);
  show(editSelected, deleteSelected, saveRegistration);
  renderStudents(); updateCounters();
}

async function deleteSelectedStudents() {
  if (!confirm("Delete selected?")) return;
  const toDel = [...document.querySelectorAll(".sel:checked")].map(cb=>+cb.closest("tr").dataset.index);
  students = students.filter((_,i)=>!toDel.includes(i));
  await idbSet("students", students);
  await syncToFirebase({
    students,
    attendanceData,
    paymentsData,
    lastAdmNo: await idbGet("lastAdmissionNo"),
    fineRates, eligibilityPct, schools: await idbGet("schools"),
    currentSchool: await idbGet("currentSchool"), teacherClass: await idbGet("teacherClass"), teacherSection: await idbGet("teacherSection")
  });
  renderStudents(); updateCounters(); hideAllViewsExcept("students");
}

async function saveAllStudents() {
  if (!doneEditing.classList.contains("hidden")) {
    alert("Finish editing first");
    return;
  }
  await idbSet("students", students);
  await syncToFirebase({
    students,
    attendanceData,
    paymentsData,
    lastAdmNo: await idbGet("lastAdmissionNo"),
    fineRates, eligibilityPct, schools: await idbGet("schools"),
    currentSchool: await idbGet("currentSchool"), teacherClass: await idbGet("teacherClass"), teacherSection: await idbGet("teacherSection")
  });
  hide(
    document.querySelector("#student-registration .row-inline"),
    editSelected, deleteSelected, selectAllStudents, saveRegistration
  );
  show(editRegistration, shareRegistration, downloadRegistration);
  renderStudents(); updateCounters();
}

// اگر Payment Modal کا کوڈ بھی یہاں رکھنا ہے تو اس میں add کریں:
// function openPaymentModal(adm) { … }

// دیگر export functions (اگر باہر سے کال کرنا ہو)
// export { renderStudents, updateCounters };
