// js/register.js
import { idbGet, idbSet, syncToFirebase, show, hide } from "./utils.js";
import { database } from "./firebase-config.js";
import { dbRef, set as dbSet } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const loadRegisterBtn     = document.getElementById("loadRegister");
const saveRegisterBtn     = document.getElementById("saveRegister");
const changeRegisterBtn   = document.getElementById("changeRegister");
const downloadRegisterBtn = document.getElementById("downloadRegister");
const shareRegisterBtn    = document.getElementById("shareRegister");
const registerTableWrapper= document.getElementById("registerTableWrapper");
const registerHeaderRow   = document.getElementById("registerHeader");
const registerBodyTbody   = document.getElementById("registerBody");

let attendanceData = {};
let students       = [];

export async function initRegisterModule() {
  attendanceData = (await idbGet("attendanceData")) || {};
  students       = (await idbGet("students"))       || [];
  loadRegisterBtn.onclick = loadRegister;
  saveRegisterBtn.onclick = saveRegister;
  changeRegisterBtn.onclick = changeRegister;
  downloadRegisterBtn.onclick = downloadRegisterPDF;
  shareRegisterBtn.onclick = shareRegisterSummary;
}

function loadRegister() {
  const m = document.getElementById("registerMonth").value;
  if (!m) { alert("Pick month"); return; }
  const dateKeys = Object.keys(attendanceData).filter(d => d.startsWith(m+"-")).sort();
  if (!dateKeys.length) { alert("No attendance marked this month."); return; }
  registerHeaderRow.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` + dateKeys.map(k=>`<th>${k.split("-")[2]}</th>`).join("");
  registerBodyTbody.innerHTML = "";
  const cl = document.getElementById("teacherClassSelect").value;
  const sec= document.getElementById("teacherSectionSelect").value;
  students.filter(s=>s.cls===cl&&s.sec===sec).forEach((s,i)=>{
    let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
    dateKeys.forEach(key=>{
      const c = attendanceData[key][s.adm]||"";
      const color = c==="P"? "var(--success)" : c==="Lt"? "var(--warning)" : c==="HD"? "#FF9800" : c==="L"? "var(--info)" : "var(--danger)";
      const style = c? `style="background:${color};color:#fff"` : "";
      row += `<td class="reg-cell" ${style}><span class="status-text">${c}</span></td>`;
    });
    const tr = document.createElement("tr"); tr.innerHTML = row;
    registerBodyTbody.appendChild(tr);
  });

  document.querySelectorAll(".reg-cell").forEach(cell => {
    cell.onclick = () => {
      const span = cell.querySelector(".status-text");
      const codes = ["","P","Lt","HD","L","A"];
      const idx = (codes.indexOf(span.textContent)+1)%codes.length;
      const c = codes[idx];
      span.textContent = c;
      if (!c) { cell.style.background=""; cell.style.color=""; }
      else {
        const col = c==="P"? "var(--success)" : c==="Lt"? "var(--warning)" : c==="HD"? "#FF9800" : c==="L"? "var(--info)" : "var(--danger)";
        cell.style.background = col; cell.style.color="#fff";
      }
    };
  });

  show(registerTableWrapper, saveRegisterBtn);
  hide(loadRegisterBtn, changeRegisterBtn, downloadRegisterBtn, shareRegisterBtn);
}

async function saveRegister() {
  const m = document.getElementById("registerMonth").value;
  const dateKeys = Object.keys(attendanceData).filter(d=>d.startsWith(m+"-")).sort();
  Array.from(registerBodyTbody.children).forEach(tr => {
    const adm = tr.children[1].textContent;
    dateKeys.forEach((key, idx) => {
      const code = tr.children[3+idx].querySelector(".status-text").textContent;
      if (code) {
        attendanceData[key] = attendanceData[key]||{};
        attendanceData[key][adm] = code;
      } else {
        if (attendanceData[key]) delete attendanceData[key][adm];
      }
    });
  });
  await idbSet("attendanceData", attendanceData);
  await syncToFirebase({
    students,
    attendanceData,
    paymentsData: await idbGet("paymentsData"),
    lastAdmNo: await idbGet("lastAdmissionNo"),
    fineRates: await idbGet("fineRates"),
    eligibilityPct: await idbGet("eligibilityPct"),
    schools: await idbGet("schools"),
    currentSchool: await idbGet("currentSchool"),
    teacherClass: await idbGet("teacherClass"),
    teacherSection: await idbGet("teacherSection")
  });
  hide(saveRegisterBtn);
  show(changeRegisterBtn, downloadRegisterBtn, shareRegisterBtn);
}

function changeRegister() {
  hide(registerTableWrapper, changeRegisterBtn, downloadRegisterBtn, shareRegisterBtn, saveRegisterBtn);
  registerHeaderRow.innerHTML = ""; registerBodyTbody.innerHTML = "";
  show(loadRegisterBtn);
}

async function downloadRegisterPDF() {
  const doc = new jspdf.jsPDF({ orientation:"landscape", unit:"pt", format:"a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const today = new Date().toISOString().split("T")[0];
  doc.setFontSize(18); doc.text("Attendance Register",14,20);
  doc.setFontSize(10); doc.text(`Date: ${today}`, pageWidth-14,20,{ align:"right" });
  doc.setFontSize(12); doc.text(document.getElementById("setupText").textContent,14,36);
  doc.autoTable({ startY:60, html:"#registerTable", tableWidth:"auto", styles:{ fontSize:10 } });
  const blob = doc.output("blob");
  doc.save("attendance_register.pdf");
  await sharePdf(blob, "attendance_register.pdf", "Attendance Register");
}

function shareRegisterSummary() {
  const header = `Attendance Register\n${document.getElementById("setupText").textContent}`;
  const rows = Array.from(registerBodyTbody.children).map(tr =>
    Array.from(tr.children).map(td => td.querySelector(".status-text")?.textContent || td.textContent).join(" ")
  );
  window.open(`https://wa.me/?text=${encodeURIComponent(header+"\n"+rows.join("\n"))}`, "_blank");
}

export { initRegisterModule };
