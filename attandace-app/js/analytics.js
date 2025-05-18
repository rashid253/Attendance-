// js/analytics.js
import { idbGet, idbSet, syncToFirebase, show, hide } from "./utils.js";
import { database } from "./firebase-config.js";
import { dbRef, set as dbSet } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import Chart from "https://cdn.jsdelivr.net/npm/chart.js";

const atg               = document.getElementById("analyticsTarget");
const asel              = document.getElementById("analyticsSectionSelect");
const atype             = document.getElementById("analyticsType");
const adateInput        = document.getElementById("analyticsDate");
const amonthInput       = document.getElementById("analyticsMonth");
const semsInput         = document.getElementById("semesterStart");
const semeInput         = document.getElementById("semesterEnd");
const ayearInput        = document.getElementById("yearStart");
const asearchInput      = document.getElementById("analyticsSearch");
const loadAnalyticsBtn  = document.getElementById("loadAnalytics");
const resetAnalyticsBtn = document.getElementById("resetAnalytics");
const instructionsDiv   = document.getElementById("instructions");
const analyticsContainer= document.getElementById("analyticsContainer");
const graphsDiv         = document.getElementById("graphs");
const analyticsActionsDiv = document.getElementById("analyticsActions");
const barChartCanvas    = document.getElementById("barChart");
const pieChartCanvas    = document.getElementById("pieChart");
const downloadAnalytics = document.getElementById("downloadAnalytics");
const shareAnalytics    = document.getElementById("shareAnalytics");

let students = [], attendanceData = {}, paymentsData = {}, fineRates = {}, eligibilityPct = 0;
let analyticsFilterOptions = ["all"];
let analyticsDownloadMode = "combined";
let lastAnalyticsStats = [], lastAnalyticsRange = { from:null, to:null }, lastAnalyticsShare = "";
let barChart = null, pieChart = null;

export async function initAnalyticsModule() {
  students       = (await idbGet("students"))       || [];
  attendanceData = (await idbGet("attendanceData")) || {};
  paymentsData   = (await idbGet("paymentsData"))   || {};
  fineRates      = (await idbGet("fineRates"))      || { A:50, Lt:20, L:10, HD:30 };
  eligibilityPct = (await idbGet("eligibilityPct")) || 75;

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearchInput].forEach(x=>x.classList.add("hidden"));
    [instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv].forEach(x=>x.classList.add("hidden"));
    if (atg.value==="section") asel.classList.remove("hidden");
    if (atg.value==="student") asearchInput.classList.remove("hidden");
  };

  atype.onchange = () => {
    [adateInput, amonthInput, semsInput, semeInput, ayearInput].forEach(x=>x.classList.add("hidden"));
    [instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv].forEach(x=>x.classList.add("hidden"));
    resetAnalyticsBtn.classList.remove("hidden");
    switch (atype.value) {
      case "date": adateInput.classList.remove("hidden"); break;
      case "month": amonthInput.classList.remove("hidden"); break;
      case "semester": semsInput.classList.remove("hidden"); semeInput.classList.remove("hidden"); break;
      case "year": ayearInput.classList.remove("hidden"); break;
    }
  };

  resetAnalyticsBtn.onclick = (e) => {
    e.preventDefault();
    atype.value = "";
    [adateInput, amonthInput, semsInput, semeInput, ayearInput, instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv].forEach(x=>x.classList.add("hidden"));
    resetAnalyticsBtn.classList.add("hidden");
  };

  document.getElementById("analyticsFilterBtn").onclick = () => show(document.getElementById("analyticsFilterModal"));
  document.getElementById("analyticsFilterClose").onclick = () => hide(document.getElementById("analyticsFilterModal"));
  document.getElementById("applyAnalyticsFilter").onclick = () => {
    analyticsFilterOptions = Array.from(document.querySelectorAll("#analyticsFilterForm input[type='checkbox']:checked")).map(cb=>cb.value) || ["all"];
    analyticsDownloadMode = document.querySelector("#analyticsFilterForm input[name='downloadMode']:checked").value;
    hide(document.getElementById("analyticsFilterModal"));
    if (lastAnalyticsStats.length) renderAnalytics(lastAnalyticsStats, lastAnalyticsRange.from, lastAnalyticsRange.to);
  };

  loadAnalyticsBtn.onclick = loadAnalytics;
  downloadAnalytics.onclick = downloadAnalyticsPDF;
  shareAnalytics.onclick = shareAnalyticsSummary;
}

function loadAnalytics() {
  if (atg.value==="student" && !asearchInput.value.trim()) { alert("Enter admission number or name"); return; }
  let from, to;
  if (atype.value==="date") {
    from = to = adateInput.value;
  } else if (atype.value==="month") {
    const [y,m] = amonthInput.value.split("-").map(Number);
    from = `${amonthInput.value}-01`;
    to = `${amonthInput.value}-${String(new Date(y,m,0).getDate()).padStart(2,"0")}`;
  } else if (atype.value==="semester") {
    const [sy,sm] = semsInput.value.split("-").map(Number);
    const [ey,em] = semeInput.value.split("-").map(Number);
    from = `${semsInput.value}-01`;
    to = `${semeInput.value}-${String(new Date(ey,em,0).getDate()).padStart(2,"0")}`;
  } else if (atype.value==="year") {
    from = `${ayearInput.value}-01-01`;
    to = `${ayearInput.value}-12-31`;
  } else { alert("Select period"); return; }

  const cls = document.getElementById("teacherClassSelect").value;
  const sec = document.getElementById("teacherSectionSelect").value;
  let pool = students.filter(s=>s.cls===cls && s.sec===sec);
  if (atg.value==="section") pool = pool.filter(s=>s.sec===asel.value);
  if (atg.value==="student") {
    const q = asearchInput.value.trim().toLowerCase();
    pool = pool.filter(s=>s.adm===q || s.name.toLowerCase().includes(q));
  }

  const stats = pool.map(s=>({ adm:s.adm, name:s.name, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
  Object.entries(attendanceData).forEach(([d,rec])=>{
    if (d<from||d>to) return;
    stats.forEach(st=>{ if(rec[st.adm]) { st[rec[st.adm]]++; st.total++; } });
  });
  stats.forEach(st=>{
    const totalFine = st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
    const paid = (paymentsData[st.adm]||[]).reduce((a,p)=>a+p.amount,0);
    st.outstanding = totalFine - paid;
    const pct = st.total ? (st.P/st.total)*100 : 0;
    st.status = st.outstanding>0||pct<eligibilityPct ? "Debarred" : "Eligible";
  });

  lastAnalyticsStats = stats;
  lastAnalyticsRange = { from, to };
  renderAnalytics(stats, from, to);
}

function renderAnalytics(stats, from, to) {
  // 1) Filter according to any checkboxes…
  let filtered = stats;
  if (!analyticsFilterOptions.includes("all")) {
    filtered = stats.filter(st => 
      analyticsFilterOptions.some(opt => {
        switch (opt) {
          case "registered": return true;
          case "attendance": return st.total > 0;
          case "fine":       return st.A > 0 || st.Lt > 0 || st.L > 0 || st.HD > 0;
          case "cleared":    return st.outstanding === 0;
          case "debarred":   return st.status === "Debarred";
          case "eligible":   return st.status === "Eligible";
        }
      })
    );
  }

  // 2) Rebuild the HTML table’s header and body…
  const theadRow = document.querySelector("#analyticsTable thead tr");
  theadRow.innerHTML = [
    "#", "Adm#", "Name", "P", "A", "Lt", "HD", "L", "Total", "%", "Outstanding", "Status"
  ].map(h => `<th>${h}</th>`).join("");

  const tbody = document.getElementById("analyticsBody");
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

  // 3) Show the analytics section (including the graphs div)
  instructionsDiv.textContent = `Period: ${from} to ${to}`;
  show(instructionsDiv, analyticsContainer, graphsDiv, analyticsActionsDiv);

  // 4) Bar chart: destroy any existing instance, then recreate
  const barCtx = barChartCanvas.getContext("2d");
  if (barChart && typeof barChart.destroy === "function") {
    barChart.destroy();
  }
  barChart = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: filtered.map(st => st.name),
      datasets: [{
        label: "% Present",
        data: filtered.map(st => st.total ? (st.P / st.total) * 100 : 0),
        backgroundColor: filtered.map(() => getComputedStyle(document.documentElement).getPropertyValue("--success").trim())
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

  // 5) Pie chart: destroy old then recreate
  const totals = filtered.reduce((acc, st) => {
    acc.P  += st.P;
    acc.A  += st.A;
    acc.Lt += st.Lt;
    acc.HD += st.HD;
    acc.L  += st.L;
    return acc;
  }, { P: 0, A: 0, Lt: 0, HD: 0, L: 0 });

  const pieCtx = pieChartCanvas.getContext("2d");
  if (pieChart && typeof pieChart.destroy === "function") {
    pieChart.destroy();
  }
  pieChart = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: ["Present","Absent","Late","Half-Day","Leave"],
      datasets: [{
        data: [totals.P, totals.A, totals.Lt, totals.HD, totals.L],
        backgroundColor: [
          getComputedStyle(document.documentElement).getPropertyValue("--success").trim(),
          getComputedStyle(document.documentElement).getPropertyValue("--danger").trim(),
          getComputedStyle(document.documentElement).getPropertyValue("--warning").trim(),
          "#FF9800",
          getComputedStyle(document.documentElement).getPropertyValue("--info").trim()
        ]
      }]
    }
  });

  // 6) Prepare the share‐via‐WhatsApp text
  lastAnalyticsShare = 
    `Attendance Analytics (${from} to ${to})\n` +
    filtered.map((st, i) => {
      const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : "0.0";
      return `${i + 1}. ${st.adm} ${st.name}: ${pct}% / PKR ${st.outstanding}`;
    }).join("\n");
}

async function downloadAnalyticsPDF() {
  if (!lastAnalyticsStats.length) { alert("Load analytics first"); return; }

  if (analyticsDownloadMode === "combined") {
    // Combined PDF
    const doc = new jspdf.jsPDF(), w = doc.internal.pageSize.getWidth();
    const { from, to } = lastAnalyticsRange;
    doc.setFontSize(18); doc.text("Attendance Analytics",14,16);
    doc.setFontSize(10); doc.text(`Period: ${from} to ${to}`, w-14, 16, { align:"right" });
    doc.setFontSize(12); doc.text(document.getElementById("setupText").textContent,14,24);
    const table = document.createElement("table");
    table.innerHTML = `
      <tr><th>#</th><th>Adm#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th><th>Outstanding</th><th>Status</th></tr>
      ${lastAnalyticsStats.map((st,i)=>`<tr>
        <td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td>
        <td>${st.total}</td><td>${st.total?((st.P/st.total)*100).toFixed(1):"0.0"}%</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>
      </tr>`).join("")}`;
    doc.autoTable({ startY:30, html: table });
    const fileName = `analytics_${from}_to_${to}.pdf`, blob = doc.output("blob");
    doc.save(fileName);
    await sharePdf(blob, fileName, "Attendance Analytics");

  } else {
    // Individual receipts PDF
    const doc = new jspdf.jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const { from, to } = lastAnalyticsRange;

    const fineRatesText =
      `Fine Rates:\n` +
      `  Absent  (PKR): ${fineRates.A}\n` +
      `  Late    (PKR): ${fineRates.Lt}\n` +
      `  Leave   (PKR): ${fineRates.L}\n` +
      `  Half-Day(PKR): ${fineRates.HD}\n` +
      `Eligibility ≥ ${eligibilityPct}%\n`;

    lastAnalyticsStats.forEach((st, i) => {
      if (i > 0) doc.addPage();
      doc.setFontSize(18);
      doc.text("Attendance Analytics (Individual Receipt)", 14, 16);
      doc.setFontSize(10);
      doc.text(`Period: ${from} to ${to}`, w - 14, 16, { align: "right" });
      doc.setFontSize(12);
      doc.text(document.getElementById("setupText").textContent, 14, 28);
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
      doc.text(`Attendance %: ${pct}%`, 14, 116);
      doc.text(`Outstanding Fine: PKR ${st.outstanding}`, 14, 130);

      const blockStartY = 148;
      doc.setFontSize(11);
      const lines = fineRatesText.split("\n");
      lines.forEach((ln, idx) => {
        doc.text(14, blockStartY + idx * 6, ln);
      });

      const signY = blockStartY + lines.length * 6 + 10;
      doc.setFontSize(12);
      doc.text("_______________________________", 14, signY);
      doc.text("     HOD Signature", 14, signY + 8);

      const footerY = signY + 30;
      doc.setFontSize(10);
      doc.text("Receipt generated by Attendance Mgmt App", w - 14, footerY, { align: "right" });
    });

    const individualFileName = `analytics_individual_${from}_to_${to}.pdf`;
    const individualBlob = doc.output("blob");
    doc.save(individualFileName);
    await sharePdf(individualBlob, individualFileName, "Attendance Analytics (Receipt)");
  }
}

function shareAnalyticsSummary() {
  if (!lastAnalyticsShare) { alert("Load analytics first"); return; }
  window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, "_blank");
}

export { initAnalyticsModule };
