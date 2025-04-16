document.addEventListener("DOMContentLoaded", function() {
  // Allowed classes
  const allowedClasses = ["Play Group","Nursery","Prep","Pre One","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];

  function getStatusText(status) {
    switch(status) {
      case "P":  return "Present. Thank you for ensuring your child’s punctuality.";
      case "A":  return "Absent. Please contact the school for further details.";
      case "L":  return "Late. Kindly ensure your child arrives on time.";
      case "Le": return "Leave. Your child's leave request has been approved.";
      default:   return "Not Marked";
    }
  }

  // ---- Element refs ----
  const teacherClassSelect = document.getElementById("teacherClassSelect");
  const saveTeacherClassBtn = document.getElementById("saveTeacherClass");
  const teacherClassDisplay = document.getElementById("teacherClassDisplay");
  const teacherClassHeader = document.getElementById("teacherClassHeader");

  const studentNameInput = document.getElementById('studentName');
  const parentContactInput = document.getElementById('parentContact');
  const addStudentBtn = document.getElementById('addStudent');
  const studentsListEl = document.getElementById('students');

  const dateInput = document.getElementById('dateInput');
  const loadAttendanceBtn = document.getElementById('loadAttendance');
  const attendanceListEl   = document.getElementById('attendanceList');
  const saveAttendanceBtn  = document.getElementById('saveAttendance');

  const exportPdfBtn     = document.getElementById('exportPdf');
  const shareWhatsAppBtn = document.getElementById('shareWhatsApp');
  const monthInput       = document.getElementById('monthInput');

  const pdfOptionsModal     = document.getElementById('pdfOptionsModal');
  const pdfCurrentReportBtn = document.getElementById('pdfCurrentReportBtn');
  const pdfDailyReportBtn   = document.getElementById('pdfDailyReportBtn');
  const pdfMonthlyReportBtn = document.getElementById('pdfMonthlyReportBtn');
  const closePdfModalBtn    = document.getElementById('closePdfModalBtn');

  // Create WhatsApp Modal (structure only—styling in CSS)
  const whatsappOptionsModal = document.createElement("div");
  whatsappOptionsModal.id = "whatsappOptionsModal";
  whatsappOptionsModal.innerHTML = `
    <div class="modal-content">
      <h3>Select Report Type for WhatsApp</h3>
      <button id="waCurrentBtn">Current Attendance Report</button>
      <button id="waDailyBtn">Daily Attendance Report</button>
      <button id="waMonthlyBtn">Monthly Attendance Report</button>
      <button id="closeWaModalBtn">Cancel</button>
    </div>`;
  document.body.appendChild(whatsappOptionsModal);

  // WhatsApp modal buttons
  const waCurrentBtn    = document.getElementById("waCurrentBtn");
  const waDailyBtn      = document.getElementById("waDailyBtn");
  const waMonthlyBtn    = document.getElementById("waMonthlyBtn");
  const closeWaModalBtn = document.getElementById("closeWaModalBtn");

  // ---- Data storage ----
  let teacherClass    = localStorage.getItem('teacherClass') || "";
  let students        = JSON.parse(localStorage.getItem('students'))        || [];
  let attendanceData  = JSON.parse(localStorage.getItem('attendanceData'))  || {};

  function updateClassDisplays() {
    teacherClassDisplay.textContent = teacherClass || "None";
    teacherClassHeader.textContent     = teacherClass || "None";
  }
  updateClassDisplays();

  saveTeacherClassBtn.onclick = () => {
    const c = teacherClassSelect.value;
    if (allowedClasses.includes(c)) {
      teacherClass = c;
      localStorage.setItem('teacherClass', c);
      updateClassDisplays();
      renderStudents();
    } else {
      alert("Please select a valid class.");
    }
  };

  function generateRoll(cls) {
    const clsStudents = students.filter(s => s.class===cls);
    if (!clsStudents.length) return 1;
    return Math.max(...clsStudents.map(s=>+s.roll)) + 1;
  }

  function renderStudents() {
    studentsListEl.innerHTML = "";
    students.filter(s=>s.class===teacherClass).forEach(s => {
      const li = document.createElement('li');
      li.textContent = `${s.roll} - ${s.name}`;
      const div = document.createElement('div');
      div.classList.add("action-buttons");
      const e = document.createElement('button'); e.textContent="Edit";
      e.onclick = ()=>{ /* same as before */ };
      const d = document.createElement('button'); d.textContent="Delete";
      d.onclick = ()=>{ /* same as before */ };
      div.append(e,d);
      li.append(div);
      studentsListEl.append(li);
    });
  }
  renderStudents();

  addStudentBtn.onclick = () => {
    if (!teacherClass) return alert("Select a class first.");
    const name = studentNameInput.value.trim();
    const pc   = parentContactInput.value.trim();
    if (!name) return alert("Enter student name.");
    const roll = generateRoll(teacherClass);
    students.push({roll,name,class:teacherClass,parentContact:pc});
    localStorage.setItem('students', JSON.stringify(students));
    studentNameInput.value = parentContactInput.value = "";
    renderStudents();
  };

  function renderAttendance(date) { /* same as before */ }

  loadAttendanceBtn.onclick = ()=>{
    if (!dateInput.value) {
      dateInput.showPicker?.() ?? dateInput.focus();
      return;
    }
    renderAttendance(dateInput.value);
  };

  saveAttendanceBtn.onclick = ()=>{
    if (!dateInput.value) {
      dateInput.showPicker?.() ?? dateInput.focus();
      return;
    }
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    alert(`Attendance saved for ${dateInput.value}`);
  };

  // ---- PDF handlers ----
  exportPdfBtn.onclick = ()=> pdfOptionsModal.style.display="block";
  closePdfModalBtn.onclick = ()=> pdfOptionsModal.style.display="none";

  pdfCurrentReportBtn.onclick = ()=>{
    let d = dateInput.value || new Date().toISOString().slice(0,10);
    generatePdf("Current Attendance", d);
    pdfOptionsModal.style.display="none";
  };

  pdfDailyReportBtn.onclick = ()=>{
    const d = dateInput.value;
    if (!d) { alert("Pick a date."); dateInput.showPicker?.() ?? dateInput.focus(); return; }
    generatePdf("Daily Attendance", d);
    pdfOptionsModal.style.display="none";
  };

  pdfMonthlyReportBtn.onclick = ()=>{
    const m = monthInput.value;
    if (!m) { alert("Pick a month."); monthInput.showPicker?.() ?? monthInput.focus(); return; }
    generateMonthlyPdf(m);
    pdfOptionsModal.style.display="none";
  };

  function generatePdf(title, date) {
    const {jsPDF} = window.jspdf;
    const doc = new jsPDF();
    doc.text(`${title} for ${date} (Class: ${teacherClass})`, 10,10);
    let y=20;
    const data = attendanceData[date]||{};
    students.filter(s=>s.class===teacherClass).forEach(s=>{
      doc.text(`${s.roll}-${s.name}: ${getStatusText(data[s.roll]||"")}`,10,y);
      y+=10;
    });
    doc.save(`${title.replace(" ","_")}_${date}.pdf`);
  }

  function generateMonthlyPdf(month) {
    const {jsPDF} = window.jspdf;
    const doc = new jsPDF('l','pt','a4');
    doc.text(`Monthly Attendance for ${month} (Class: ${teacherClass})`,20,30);
    const cols = ["Roll","Name",...Array.from({length:31},(_,i)=>(""+(i+1)))];
    const rows = students.filter(s=>s.class===teacherClass).map(s=>{
      return [s.roll,s.name,
        ...Array.from({length:31},(_,i)=>{
          const key = `${month}-${String(i+1).padStart(2,'0')}`;
          return attendanceData[key]?.[s.roll]||"";
        })];
    });
    doc.autoTable({head:[cols],body:rows,startY:50,theme:'grid',styles:{fontSize:8},headStyles:{fillColor:[33,150,243]}});
    doc.save(`Monthly_Attendance_${month}.pdf`);
  }

  // ---- WhatsApp handlers ----
  shareWhatsAppBtn.onclick = ()=> whatsappOptionsModal.style.display="block";
  closeWaModalBtn.onclick = ()=> whatsappOptionsModal.style.display="none";

  waCurrentBtn.onclick = ()=>{
    let d = dateInput.value || new Date().toISOString().slice(0,10);
    sendWhatsApp("Current Attendance", d);
    whatsappOptionsModal.style.display="none";
  };

  waDailyBtn.onclick = ()=>{
    const d = dateInput.value;
    if (!d) { alert("Pick a date."); dateInput.showPicker?.() ?? dateInput.focus(); return; }
    sendWhatsApp("Daily Attendance", d);
    whatsappOptionsModal.style.display="none";
  };

  waMonthlyBtn.onclick = ()=>{
    const m = monthInput.value;
    if (!m) { alert("Pick a month."); monthInput.showPicker?.() ?? monthInput.focus(); return; }
    let msg = `Monthly Attendance for ${m} (Class: ${teacherClass})\nRoll-Name`;
    for (let i=1;i<=31;i++) msg += ` | ${i}`;
    msg += "\n";
    students.filter(s=>s.class===teacherClass).forEach(s=>{
      msg += `${s.roll}-${s.name}`;
      for (let i=1;i<=31;i++){
        const key=`${m}-${String(i).padStart(2,'0')}`;
        msg += ` | ${attendanceData[key]?.[s.roll]||""}`;
      }
      msg += "\n";
    });
    window.open("https://api.whatsapp.com/send?text="+encodeURIComponent(msg),'_blank');
    whatsappOptionsModal.style.display="none";
  };

  function sendWhatsApp(title, date) {
    let msg = `${title} for ${date} (Class: ${teacherClass})\n\n`;
    const data = attendanceData[date]||{};
    students.filter(s=>s.class===teacherClass).forEach(s=>{
      msg += `${s.roll}-${s.name}: ${getStatusText(data[s.roll]||"")}\n`;
    });
    window.open("https://api.whatsapp.com/send?text="+encodeURIComponent(msg),'_blank');
  }

  renderStudents();
});
