// app.js
document.addEventListener("DOMContentLoaded", function() {
  // ... [Previous setup code remains same]

  // ================== FIXED DAILY REPORT ==================
  pdfDailyReportBtn.addEventListener('click', async function() {
    pdfOptionsModal.style.display = "none";
    dateInput.value = ""; // Force fresh selection
    
    const selectedDate = await new Promise(resolve => {
      dateInput.showPicker();
      dateInput.addEventListener('input', function handler() {
        resolve(this.value);
        dateInput.removeEventListener('input', handler);
      });
    });

    if (!selectedDate) return;
    
    // PDF generation code here
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    // ... [rest of PDF generation]
  });

  // ================== IMPROVED WHATSAPP SHARING ==================
  shareWhatsAppBtn.addEventListener('click', () => {
    document.getElementById('whatsappOptionsModal').style.display = "block";
  });

  document.querySelectorAll('.whatsapp-option-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const reportType = this.dataset.type;
      let message = `📚 *${teacherClass} Attendance Report*\n\n`;
      
      // Current Report
      if (reportType === 'current') {
        const date = dateInput.value || new Date().toISOString().split('T')[0];
        message += `📅 *Date:* ${date}\n\n`;
        // ... attendance data
      }
      
      // Daily Report
      if (reportType === 'daily') {
        const selectedDate = await new Promise(resolve => {
          dateInput.value = "";
          dateInput.showPicker();
          dateInput.addEventListener('input', function handler() {
            resolve(this.value);
            dateInput.removeEventListener('input', handler);
          });
        });
        message += `📆 *Daily Report:* ${selectedDate}\n\n`;
        // ... attendance data
      }

      // Monthly Report 
      if (reportType === 'monthly') {
        const monthValue = await new Promise(resolve => {
          monthInputElement.value = "";
          monthInputElement.showPicker();
          monthInputElement.addEventListener('input', function handler() {
            resolve(this.value);
            monthInputElement.removeEventListener('input', handler);
          });
        });
        message += `📊 *Monthly Report:* ${monthValue}\n\n`;
        // ... monthly data
      }

      // Format with emojis
      message += `✅ Present | ❌ Absent | ⏰ Late | 🏖️ Leave\n\n`;
      message += `💌 Note: ${specialNoteInput.value || "No special notes"}`;
      
      // Send via WhatsApp
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
      document.getElementById('whatsappOptionsModal').style.display = "none";
    });
  });

  // ... [Rest of existing code]
});
