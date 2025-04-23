// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P: '#4CAF50', A: '#f44336', Lt: '#FFEB3B', HD: '#FF9800', L: '#03a9f4' };

  // ... (all existing setup, registration, attendance, analytics, register code unchanged) ...

  // 2a. STUDENT REGISTRATION PDF
  downloadRegBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Student Registration', 10, 10);
    doc.setFontSize(12);
    const currentDate = new Date().toLocaleDateString();
    doc.text(`Date: ${currentDate}`,10,20);
    doc.text(`School: ${localStorage.getItem('schoolName')}`,10,26);
    doc.text(`Class: ${localStorage.getItem('teacherClass')}`,10,32);
    doc.text(`Section: ${localStorage.getItem('teacherSection')}`,10,38);
    doc.autoTable({
      head: [['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY:44
    });
    doc.save('student_registration.pdf');
    alert('PDF download complete');
  };

  // 3a. DAILY ATTENDANCE PDF
  downloadAttPDF.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Daily Attendance Report',10,10);
    doc.setFontSize(12);
    const selDate = dateInput.value;
    const formatted = new Date(selDate).toLocaleDateString();
    doc.text(`Date: ${formatted}`,10,20);
    doc.text(`School: ${localStorage.getItem('schoolName')}`,10,26);
    doc.text(`Class: ${localStorage.getItem('teacherClass')}`,10,32);
    doc.text(`Section: ${localStorage.getItem('teacherSection')}`,10,38);
    doc.autoTable({
      head:[['Name','Status']],
      body: students.map(s=>{
        const code = (attendanceData[dateInput.value]||{})[s.roll]||'A';
        const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
        return [s.name,status];
      }),
      startY:44
    });
    doc.save('attendance_summary.pdf');
    alert('PDF download complete');
  };

  // 4a. ATTENDANCE ANALYTICS PDF
  downloadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Attendance Analytics',10,10);
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`,10,20);
    const period = instructionsEl.textContent.replace(/^.*\|\s*/,'');
    doc.text(`Period: ${period}`,10,26);
    doc.text(`School: ${localStorage.getItem('schoolName')}`,10,32);
    doc.text(`Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`,10,38);
    doc.autoTable({
      head:[['Name','P','A','Lt','HD','L','Total','%']],
      body: Array.from(analyticsContainer.querySelectorAll('tbody tr')).map(r=>
        Array.from(r.querySelectorAll('td')).map(td=>td.textContent)
      ),
      startY:44
    });
    const y = doc.lastAutoTable.finalY + 10;
    doc.addImage(barChart.toBase64Image(),'PNG',10,y,80,60);
    doc.addImage(pieChart.toBase64Image(),'PNG',100,y,80,60);
    doc.save('attendance_analytics.pdf');
    alert('PDF download complete');
  };

  // 5a. MONTHLY ATTENDANCE REGISTER PDF
  downloadReg2.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    doc.setFontSize(16); doc.text('Monthly Attendance Register',10,10);
    doc.setFontSize(12);
    doc.text(`Month: ${regMonthIn.value}`,10,20);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`,10,26);
    doc.text(`School: ${localStorage.getItem('schoolName')}`,10,32);
    doc.text(`Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`,10,38);
    doc.autoTable({
      html: '#registerTable',
      startY:44,
      styles:{ fontSize:6 },
      columnStyles:{ 0:{cellWidth:10},1:{cellWidth:15},2:{cellWidth:30} }
    });
    doc.autoTable({
      html: '#registerSummarySection table',
      startY: doc.lastAutoTable.finalY + 10,
      styles:{ fontSize:8 }
    });
    doc.save('attendance_register.pdf');
    alert('PDF download complete');
  };

  // Register service worker for offline capability
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('service-worker.js')
        .then(reg => console.log('ServiceWorker registered:', reg.scope))
        .catch(err => console.error('ServiceWorker registration failed:', err));
    });
  }
});
