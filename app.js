// app.js
document.addEventListener("DOMContentLoaded", () => {
  // === Helpers ===
  function getStatusText(s) {
    return {
      P: "Present",
      A: "Absent",
      L: "Late",
      Le: "Leave"
    }[s] || "-";
  }

  function showModal(modal) { modal.style.display = "block"; }
  function closeModal(modal){ modal.style.display = "none"; }

  // === Refs ===
  const dateInput         = document.getElementById("dateInput");
  const exportPdfBtn      = document.getElementById("exportPdf");
  const shareWhatsAppBtn  = document.getElementById("shareWhatsApp");

  const pdfModal     = document.getElementById("pdfOptionsModal");
  const pdfCurBtn    = document.getElementById("pdfCurrentReportBtn");
  const pdfDayBtn    = document.getElementById("pdfDailyReportBtn");
  const pdfMonBtn    = document.getElementById("pdfMonthlyReportBtn");
  const pdfCloseBtn  = document.getElementById("closePdfModalBtn");

  const waModal      = document.getElementById("whatsappOptionsModal");
  const waCurBtn     = document.getElementById("waCurrentBtn");
  const waDayBtn     = document.getElementById("waDailyBtn");
  const waMonBtn     = document.getElementById("waMonthlyBtn");
  const waCloseBtn   = document.getElementById("closeWaModalBtn");
  const waMonthInput = document.getElementById("waMonthInput");

  // storage & other refs omitted for brevity...
  let teacherClass   = localStorage.getItem("teacherClass")   || "";
  let students       = JSON.parse(localStorage.getItem("students"))       || [];
  let attendanceData = JSON.parse(localStorage.getItem("attendanceData")) || {};

  // === Enable WhatsApp buttons on input ===
  dateInput.addEventListener("change", () => {
    if (dateInput.value) {
      waDayBtn.disabled = false;
      waDayBtn.classList.add("active-btn");
    } else {
      waDayBtn.disabled = true;
      waDayBtn.classList.remove("active-btn");
    }
  });
  waMonthInput.addEventListener("change", () => {
    if (waMonthInput.value) {
      waMonBtn.disabled = false;
      waMonBtn.classList.add("active-btn");
    } else {
      waMonBtn.disabled = true;
      waMonBtn.classList.remove("active-btn");
    }
  });

  // === WhatsApp Modal Actions ===
  shareWhatsAppBtn.addEventListener("click", () => showModal(waModal));
  waCloseBtn.addEventListener("click", () => closeModal(waModal));

  waCurBtn.addEventListener("click", () => {
    const d = dateInput.value || new Date().toISOString().slice(0,10);
    sendWhatsApp("Current Attendance", d);
    closeModal(waModal);
  });

  waDayBtn.addEventListener("click", () => {
    // button is disabled until date selected
    sendWhatsApp("Daily Attendance", dateInput.value);
    closeModal(waModal);
  });

  waMonBtn.addEventListener("click", () => {
    // button is disabled until month selected
    sendWhatsAppMonthly(waMonthInput.value);
    closeModal(waModal);
  });

  // simplified monthly message format
  function sendWhatsAppMonthly(m) {
    let msg = `Monthly Attendance for ${m} (Class:${teacherClass})\n`;
    students
      .filter(s => s.class === teacherClass)
      .forEach(s => {
        const codes = [];
        for (let d=1; d<=31; d++) {
          const key = `${m}-${String(d).padStart(2,"0")}`;
          codes.push(attendanceData[key]?.[s.roll] || "-");
        }
        msg += `${s.roll}-${s.name}: ${codes.join(",")}\n`;
      });
    window.open("https://api.whatsapp.com/send?text="+encodeURIComponent(msg), "_blank");
  }

  // original sendWhatsApp, generatePdf, generateMonthlyPdf, render logic, etc.
  // ...
});
