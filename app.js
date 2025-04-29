// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- 1. IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) return console.error('idb-keyval not found');
  const { get, set } = window.idbKeyval;
  const save = (key, val) => set(key, val);

  // --- 2. State & Defaults (Half-Day default = 30) ---
  let students        = await get('students')       || [];
  let attendanceData  = await get('attendanceData')|| {};
  let finesData       = await get('finesData')     || {};
  let paymentsData    = await get('paymentsData')  || {};
  let lastAdmNo       = await get('lastAdmissionNo')|| 0;
  let fineRates       = await get('fineRates')     || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct  = await get('eligibilityPct')|| 75;

  // --- 3. Update settings UI ---
  $('fineAbsent').value    = fineRates.A;
  $('fineLate').value      = fineRates.Lt;
  $('fineLeave').value     = fineRates.L;
  $('fineHalfDay').value   = fineRates.HD;
  $('eligibilityPct').value= eligibilityPct;
  $('saveSettings').onclick = async () => {
    fineRates = {
      A : Number($('fineAbsent').value)   || 0,
      Lt: Number($('fineLate').value)     || 0,
      L : Number($('fineLeave').value)    || 0,
      HD: Number($('fineHalfDay').value)  || 0,
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;
    await Promise.all([ save('fineRates', fineRates), save('eligibilityPct', eligibilityPct) ]);
    alert('Fines & eligibility settings saved');
  };

  // ... rest of your existing code unchanged until share individual attendance ...

  // --- Share individual attendance with professional messages & "Rs" sign ---
  attendanceSummaryDiv.querySelectorAll('.share-individual')
    .forEach(ic => ic.onclick = () => {
      const date    = dateInput.value;
      const adm     = ic.dataset.adm;
      const student = students.find(x => x.adm === adm);
      const code    = attendanceData[date][adm];
      let msg = `Dear Parent,\n\n`;
      switch(code) {
        case 'P':
          msg += `${student.name} was Present on ${date}.\nKeep up the good attendance!`;
          break;
        case 'A':
          msg += `${student.name} was Absent on ${date}.\nPlease send a leave note upon return.`;
          break;
        case 'Lt':
          msg += `${student.name} was Late on ${date}.\nEnsure arrival by 08:00 AM.`;
          break;
        case 'HD':
          msg += `${student.name} attended a Half-Day on ${date}.\nInform office in advance next time.`;
          break;
        case 'L':
          msg += `${student.name} was on Leave on ${date}.\nSubmit assignments and expected return date.`;
          break;
        default:
          msg += `Status on ${date}: ${code}.`;
      }
      msg += `\n\nRegards,\n${$('schoolNameInput').value}`;
      window.open(`https://wa.me/${student.contact}?text=${encodeURIComponent(msg)}`, '_blank');
    });

  // --- Attendance Register Download in Landscape ---
  $('downloadRegister').onclick = () => {
    const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    doc.setFontSize(18); doc.text('Attendance Register', 14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#registerTable', theme:'grid' });
    doc.save('attendance_register.pdf');
  };

  // --- Analytics Download with embedded charts ---
  $('downloadAnalytics').onclick = () => {
    const doc = new jspdf.jsPDF({ orientation:'portrait', unit:'pt', format:'a4' });
    doc.setFontSize(18); doc.text('Analytics Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    // embed charts
    const barImg = document.getElementById('barChart').toDataURL('image/png');
    const pieImg = document.getElementById('pieChart').toDataURL('image/png');
    doc.addImage(barImg,'PNG',14,32,300,150);
    doc.addImage(pieImg,'PNG',330,32,150,150);
    // table below
    doc.autoTable({ startY:200, html:'#analyticsTable', theme:'grid' });
    doc.save('analytics_report.pdf');
  };

  // helper
  function $(id){ return document.getElementById(id); }
  // ... rest of your code ...
});
