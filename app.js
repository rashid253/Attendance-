// app.js
document.addEventListener("DOMContentLoaded", () => {
  // ... other refs and code unchanged ...

  // WhatsApp modal refs
  const shareWhatsAppBtn = document.getElementById("shareWhatsApp");
  const waModal         = document.getElementById("whatsappOptionsModal");
  const waSendBtn       = document.getElementById("waSendBtn");
  const waCloseBtn      = document.getElementById("closeWaModalBtn");
  const waTypeInputs    = document.querySelectorAll('input[name="waType"]');
  const waDateContainer = document.getElementById("waDateContainer");
  const waMonthContainer= document.getElementById("waMonthContainer");
  const waDateInput     = document.getElementById("waDateInput");
  const waMonthInput    = document.getElementById("waMonthInput");

  // Show modal
  shareWhatsAppBtn.addEventListener("click", () => {
    resetWaModal();
    waModal.style.display = "block";
  });
  waCloseBtn.addEventListener("click", () => waModal.style.display = "none");

  // Switch containers when type changes
  waTypeInputs.forEach(radio => {
    radio.addEventListener("change", () => {
      waDateInput.value = "";
      waMonthInput.value = "";
      waSendBtn.disabled = false; // current always ready
      if (radio.value === "current") {
        waDateContainer.style.display = "none";
        waMonthContainer.style.display= "none";
      } else if (radio.value === "daily") {
        waDateContainer.style.display = "block";
        waMonthContainer.style.display= "none";
        waSendBtn.disabled = true;
      } else { // monthly
        waDateContainer.style.display = "none";
        waMonthContainer.style.display= "block";
        waSendBtn.disabled = true;
      }
    });
  });

  // Enable Send when date/month picked
  waDateInput.addEventListener("input", () => {
    const dailySelected = document.getElementById("waTypeDay").checked;
    waSendBtn.disabled = dailySelected ? !waDateInput.value : false;
  });
  waMonthInput.addEventListener("input", () => {
    const monSelected = document.getElementById("waTypeMon").checked;
    waSendBtn.disabled = monSelected ? !waMonthInput.value : false;
  });

  // On Send click
  waSendBtn.addEventListener("click", () => {
    const type = document.querySelector('input[name="waType"]:checked').value;
    let msg, key, d, m;
    if (type === "current") {
      d = new Date().toISOString().slice(0,10);
      msg = buildMessage("Current Attendance", d);
    }
    else if (type === "daily") {
      d = waDateInput.value;
      msg = buildMessage("Daily Attendance", d);
    }
    else { // monthly
      m = waMonthInput.value; // YYYY-MM
      msg = buildMonthlyMessage("Monthly Attendance", m);
    }
    window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(msg), "_blank");
    waModal.style.display = "none";
  });

  // Build the standard (current/daily) message
  function buildMessage(title, date) {
    let out = `${title} for ${date} (Class:${teacherClass})\n\n`;
    const ad = attendanceData[date] || {};
    students
      .filter(s => s.class === teacherClass)
      .forEach(s => {
        out += `${s.roll}-${s.name}: ${getStatusText(ad[s.roll]||"-")}\n`;
      });
    return out;
  }

  // Build a clear monthly message: "DD:Status" per day
  function buildMonthlyMessage(title, month) {
    let out = `${title} for ${month} (Class:${teacherClass})\n\n`;
    students
      .filter(s => s.class === teacherClass)
      .forEach(s => {
        let line = `${s.roll}-${s.name}: `;
        const parts = [];
        for (let day=1; day<=31; day++) {
          const dd = String(day).padStart(2,"0");
          const key = `${month}-${dd}`;
          const st  = (attendanceData[key]||{})[s.roll] || "-";
          parts.push(`${dd}:${st}`);
        }
        line += parts.join(", ");
        out += line + "\n";
      });
    return out;
  }

  function resetWaModal() {
    // reset UI to default (current)
    document.getElementById("waTypeCur").checked = true;
    waDateContainer.style.display = "none";
    waMonthContainer.style.display= "none";
    waDateInput.value = "";
    waMonthInput.value= "";
    waSendBtn.disabled = false;
  }

  // ... rest of your existing app.js code (student list, attendance, PDF) remains unchanged ...
});
