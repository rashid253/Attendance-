document.addEventListener("DOMContentLoaded", () => {
  // === Helpers ===
  function getStatusText(s) {
    return {
      P:  "Present. Thank you for ensuring your child’s punctuality.",
      A:  "Absent. Please contact the school for further details.",
      L:  "Late. Kindly ensure your child arrives on time.",
      Le: "Leave. Your child's leave request has been approved."
    }[s] || "Not Marked";
  }
  function showModal(m){ m.style.display = "block"; }
  function closeModal(m){ m.style.display = "none"; }

  // === Element refs ===
  const dateInput   = document.getElementById("dateInput");
  const monthInput  = document.getElementById("monthInput");

  const exportPdfBtn     = document.getElementById("exportPdf");
  const shareWhatsAppBtn = document.getElementById("shareWhatsApp");

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

  // === Storage ===
  let teacherClass   = localStorage.getItem("teacherClass")   || "";
  let students       = JSON.parse(localStorage.getItem("students"))       || [];
  let attendanceData = JSON.parse(localStorage.getItem("attendanceData")) || {};

  // === PDF Modal Wiring ===
  exportPdfBtn.onclick = () => showModal(pdfModal);
  pdfCloseBtn.onclick  = () => closeModal(pdfModal);

  pdfCurBtn.onclick = () => {
    const d = dateInput.value || new Date().toISOString().slice(0,10);
    generatePdf("Current Attendance", d);
    closeModal(pdfModal);
  };

  pdfDayBtn.onclick = () => {
    if (!dateInput.value) {
      dateInput.showPicker?.() ?? dateInput.focus();
      dateInput.onchange = () => {
        generatePdf("Daily Attendance", dateInput.value);
        dateInput.onchange = null;
        closeModal(pdfModal);
      };
      return;
    }
    generatePdf("Daily Attendance", dateInput.value);
    closeModal(pdfModal);
  };

  pdfMonBtn.onclick = () => {
    if (!monthInput.value) {
      monthInput.showPicker?.() ?? monthInput.focus();
      monthInput.onchange = () => {
        generateMonthlyPdf(monthInput.value);
        monthInput.onchange = null;
        closeModal(pdfModal);
      };
      return;
    }
    generateMonthlyPdf(monthInput.value);
    closeModal(pdfModal);
  };

  // === WhatsApp Modal Wiring ===
  shareWhatsAppBtn.onclick = () => showModal(waModal);
  waCloseBtn.onclick       = () => closeModal(waModal);

  waCurBtn.onclick = () => {
    const d = dateInput.value || new Date().toISOString().slice(0,10);
    sendWhatsApp("Current Attendance", d);
    closeModal(waModal);
  };

  waDayBtn.onclick = () => {
    if (!dateInput.value) {
      dateInput.showPicker?.() ?? dateInput.focus();
      dateInput.onchange = () => {
        sendWhatsApp("Daily Attendance", dateInput.value);
        dateInput.onchange = null;
        closeModal(waModal);
      };
      return;
    }
    sendWhatsApp("Daily Attendance", dateInput.value);
    closeModal(waModal);
  };

  waMonBtn.onclick = () => {
    if (!monthInput.value) {
      monthInput.showPicker?.() ?? monthInput.focus();
      monthInput.onchange = () => {
        sendWhatsAppMonthly(monthInput.value);
        monthInput.onchange = null;
        closeModal(waModal);
      };
      return;
    }
    sendWhatsAppMonthly(monthInput.value);
    closeModal(waModal);
  };

  // === Report Generation Functions ===
  function generatePdf(title, d) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`${title} for ${d} (Class: ${teacherClass})`, 10, 10);
    let y = 20;
    const ad = attendanceData[d] || {};
    students.filter(s => s.class === teacherClass).forEach(s => {
      doc.text(`${s.roll}-${s.name}: ${getStatusText(ad[s.roll]||"")}`, 10, y);
      y += 10;
    });
    doc.save(`${title.replace(/ /g,"_")}_${d}.pdf`);
  }

  function generateMonthlyPdf(m) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("l","pt","a4");
    doc.text(`Monthly Attendance for ${m} (Class: ${teacherClass})`, 20, 30);
    const cols = ["Roll","Name",...Array.from({length:31},(_,i)=>""+(i+1))];
    const rows = students
      .filter(s=>s.class===teacherClass)
      .map(s => {
        return [s.roll, s.name,
          ...Array.from({length:31},(_,i)=>{
            const key = `${m}-${String(i+1).padStart(2,"0")}`;
            return attendanceData[key]?.[s.roll] || "";
          })
        ];
      });
    doc.autoTable({
      head: [cols],
      body: rows,
      startY: 50,
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [33,150,243] }
    });
    doc.save(`Monthly_Attendance_${m}.pdf`);
  }

  // === WhatsApp Sharing Functions ===
  function sendWhatsApp(title, d) {
    let msg = `${title} for ${d} (Class: ${teacherClass})\n\n`;
    const ad = attendanceData[d] || {};
    students.filter(s=>s.class===teacherClass).forEach(s => {
      msg += `${s.roll}-${s.name}: ${getStatusText(ad[s.roll]||"")}\n`;
    });
    window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(msg), "_blank");
  }

  function sendWhatsAppMonthly(month) {
    // Make month human‐readable
    const [yr, mo] = month.split("-");
    const monthName = new Date(yr, mo - 1)
      .toLocaleString("default", { month: "long", year: "numeric" });

    let msg = `Monthly Attendance Report for ${monthName} (Class: ${teacherClass})\n\n`;

    students.filter(s=>s.class===teacherClass).forEach(s => {
      const presents = [], absents = [], lates = [], leaves = [];
      for (let day = 1; day <= 31; day++) {
        const dd = String(day).padStart(2,"0");
        const key = `${month}-${dd}`;
        const st  = attendanceData[key]?.[s.roll];
        if (st === "P")  presents.push(dd);
        if (st === "A")  absents.push(dd);
        if (st === "L")  lates.push(dd);
        if (st === "Le") leaves.push(dd);
      }
      msg += `${s.roll}. ${s.name}\n`;
      if (presents .length) msg += `  Present: ${presents.join(", ")}\n`;
      if (absents  .length) msg += `  Absent:  ${absents.join(", ")}\n`;
      if (lates    .length) msg += `  Late:    ${lates.join(", ")}\n`;
      if (leaves   .length) msg += `  Leave:   ${leaves.join(", ")}\n`;
      msg += "\n";
    });

    window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(msg), "_blank");
  }
});
