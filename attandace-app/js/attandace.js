// js/attendance.js
import { idbGet, idbSet, syncToFirebase, show, hide } from "./utils.js";
import { database } from "./firebase-config.js";
import { dbRef, set as dbSet } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const dateInput             = document.getElementById("dateInput");
const loadAttendanceBtn     = document.getElementById("loadAttendance");
const saveAttendanceBtn     = document.getElementById("saveAttendance");
const resetAttendanceBtn    = document.getElementById("resetAttendance");
const downloadAttendanceBtn = document.getElementById("downloadAttendancePDF");
const shareAttendanceBtn    = document.getElementById("shareAttendanceSummary");
const attendanceBodyDiv     = document.getElementById("attendanceBody");
const attendanceSummaryDiv  = document.getElementById("attendanceSummary");

let attendanceData = {};
let students       = [];
let fineRates      = {};
let paymentsData   = {};
let eligibilityPct = 0;

export async function initAttendanceModule() {
  // Load required state
  attendanceData = (await idbGet("attendanceData")) || {};
  students       = (await idbGet("students"))       || [];
  fineRates      = (await idbGet("fineRates"))      || { A:50, Lt:20, L:10, HD:30 };
  paymentsData   = (await idbGet("paymentsData"))   || {};
  eligibilityPct = (await idbGet("eligibilityPct")) || 75;

  loadAttendanceBtn.onclick  = loadAttendance;
  saveAttendanceBtn.onclick  = saveAttendance;
  resetAttendanceBtn.onclick = resetAttendance;
  downloadAttendanceBtn.onclick = downloadAttendancePDF;
  shareAttendanceBtn.onclick = shareAttendanceSummary;
}

function loadAttendance() {
  attendanceBodyDiv.innerHTML = "";
  attendanceSummaryDiv.innerHTML = "";
  const cl  = document.getElementById("teacherClassSelect").value;
  const sec = document.getElementById("teacherSectionSelect").value;
  attendanceBodyDiv.style.overflowX = "auto";
  students.filter(stu => stu.cls===cl && stu.sec===sec).forEach((stu,i) => {
    const row = document.createElement("div"), headerDiv = document.createElement("div"), btnsDiv = document.createElement("div");
    row.className = "attendance-row"; headerDiv.className = "attendance-header"; btnsDiv.className = "attendance-buttons";
    headerDiv.textContent = `${i+1}. ${stu.name} (${stu.adm})`;
    const statusNames  = { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" };
    const statusColors = { P:"var(--success)", A:"var(--danger)", Lt:"var(--warning)", HD:"#FF9800", L:"var(--info)" };
    Object.keys(statusNames).forEach(code => {
      const btn = document.createElement("button");
      btn.className = "att-btn"; btn.textContent = code;
      btn.onclick = () => {
        btnsDiv.querySelectorAll(".att-btn").forEach(b=>{b.classList.remove("selected");b.style=""});
        btn.classList.add("selected"); btn.style.background = statusColors[code]; btn.style.color="#fff";
      };
      btnsDiv.appendChild(btn);
    });
    row.append(headerDiv, btnsDiv);
    attendanceBodyDiv.appendChild(row);
  });
  show(attendanceBodyDiv, saveAttendanceBtn);
  hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
}

async function saveAttendance() {
  const date = dateInput.value;
  if (!date) { alert("Pick date"); return; }
  attendanceData[date] = {};
  const cl  = document.getElementById("teacherClassSelect").value;
  const sec = document.getElementById("teacherSectionSelect").value;
  students.filter(s=>s.cls===cl&&s.sec===sec).forEach((s,i)=>{
    const selBtn = attendanceBodyDiv.children[i].querySelector(".att-btn.selected");
    attendanceData[date][s.adm] = selBtn ? selBtn.textContent : "A";
  });
  await idbSet("attendanceData", attendanceData);
  // Firebase پر sync
  await syncToFirebase({
    students,
    attendanceData,
    paymentsData,
    lastAdmNo: await idbGet("lastAdmissionNo"),
    fineRates, eligibilityPct, schools: await idbGet("schools"),
    currentSchool: await idbGet("currentSchool"), teacherClass: await idbGet("teacherClass"), teacherSection: await idbGet("teacherSection")
  });
  console.log("✅ Attendance data synced to Firebase");

  attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
  const tbl = document.createElement("table"); tbl.id="attendanceSummaryTable";
  tbl.innerHTML = `
    <tr>
      <th>Sr#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th>
    </tr>`;
  const statusNames = { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" };
  students.filter(s=>s.cls===cl&&s.sec===sec).forEach((s,i)=>{
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
  attendanceSummaryDiv.querySelectorAll(".share-individual").forEach(ic=>{
    ic.onclick = () => {
      const adm = ic.dataset.adm, st = students.find(x=>x.adm===adm);
      const msg = `Dear Parent, your child (Adm#: ${adm}) was ${statusNames[attendanceData[date][adm]]} on ${date}.`;
      window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`, "_blank");
    };
  });

  hide(attendanceBodyDiv, saveAttendanceBtn);
  show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
}

function resetAttendance() {
  show(attendanceBodyDiv, saveAttendanceBtn);
  hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
}

async function downloadAttendancePDF() {
  const doc = new jspdf.jsPDF(), w = doc.internal.pageSize.getWidth();
  const today = new Date().toISOString().split("T")[0];
  doc.setFontSize(18); doc.text("Attendance Report", 14, 16);
  doc.setFontSize(10); doc.text(`Date: ${today}`, w-14, 16, { align:"right" });
  doc.setFontSize(12); doc.text(document.getElementById("setupText").textContent, 14, 24);
  doc.autoTable({ startY:30, html:"#attendanceSummaryTable" });
  const fileName = `attendance_${dateInput.value}.pdf`, blob = doc.output("blob");
  doc.save(fileName);
  await sharePdf(blob, fileName, "Attendance Report");
}

function shareAttendanceSummary() {
  const cl = document.getElementById("teacherClassSelect").value;
  const sec= document.getElementById("teacherSectionSelect").value;
  const date= dateInput.value;
  const statusNames = { P:"Present", A:"Absent", Lt:"Late", HD:"Half-Day", L:"Leave" };
  const header = `*Attendance Report*\nClass ${cl} Sec ${sec} - ${date}`;
  const lines = students.filter(s=>s.cls===cl&&s.sec===sec).map((s,i)=>`${i+1}. ${s.name} (Adm#: ${s.adm}): ${statusNames[attendanceData[date][s.adm]]}`);
  window.open(`https://wa.me/?text=${encodeURIComponent(header+"\n\n"+lines.join("\n"))}`, "_blank");
}

export { initAttendanceModule };
