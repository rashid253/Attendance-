// app.js
document.addEventListener("DOMContentLoaded", () => {
  // Helpers
  function getStatusText(s) {
    return { P:"Present", A:"Absent", L:"Leave", Lt:"Late", HD:"Half Day" }[s]||"-";
  }
  function showModal(m){ m.style.display="block"; }
  function closeModal(m){ m.style.display="none"; }

  // Refs
  const clsSel    = document.getElementById("teacherClassSelect");
  const secSel    = document.getElementById("teacherSectionSelect");
  const saveCls   = document.getElementById("saveTeacherClass");
  const header    = document.getElementById("teacherClassHeader");

  const nameIn    = document.getElementById("studentName");
  const admIn     = document.getElementById("admissionNo");
  const pcIn      = document.getElementById("parentContact");
  const addStd    = document.getElementById("addStudent");
  const listStd   = document.getElementById("students");

  const dateIn    = document.getElementById("dateInput");
  const loadDay   = document.getElementById("loadAttendance");
  const saveDay   = document.getElementById("saveAttendance");
  const listDay   = document.getElementById("attendanceList");

  const monthIn   = document.getElementById("monthInput");
  const loadMon   = document.getElementById("loadMonth");
  const monTable  = document.getElementById("monthTable");
  const summary   = document.getElementById("summaryReport");

  const expPdf    = document.getElementById("exportPdf");
  const shpWA     = document.getElementById("shareWhatsApp");
  const pdfModal  = document.getElementById("pdfOptionsModal");
  const waModal   = document.getElementById("whatsappOptionsModal");
  const pdfClose  = document.getElementById("closePdfModalBtn");
  const waClose   = document.getElementById("closeWaModalBtn");
  const pdfCur    = document.getElementById("pdfCurrentReportBtn");
  const pdfDay    = document.getElementById("pdfDailyReportBtn");
  const pdfMon    = document.getElementById("pdfMonthlyReportBtn");
  const pdfMonIn  = document.getElementById("pdfMonthInput");
  const waCur     = document.getElementById("waCurrentBtn");
  const waDay     = document.getElementById("waDailyBtn");
  const waMon     = document.getElementById("waMonthlyBtn");
  const waMonIn   = document.getElementById("waMonthInput");

  // Storage
  let teacherClass   = localStorage.getItem("teacherClass")   || "";
  let teacherSection = localStorage.getItem("teacherSection") || "";
  let students       = JSON.parse(localStorage.getItem("students"))       || [];
  let attendanceData = JSON.parse(localStorage.getItem("attendanceData")) || {};

  // Init
  clsSel.value = teacherClass;
  secSel.value = teacherSection;
  updateHeader();
  renderStudents();

  // Save class/section
  saveCls.addEventListener("click", () => {
    if(!clsSel.value||!secSel.value) return alert("Select both class & section");
    teacherClass = clsSel.value;
    teacherSection = secSel.value;
    localStorage.setItem("teacherClass", teacherClass);
    localStorage.setItem("teacherSection", teacherSection);
    updateHeader();
    renderStudents();
  });

  // Add student
  addStd.addEventListener("click", () => {
    if(!teacherClass||!teacherSection) return alert("Save class & section first");
    const name = nameIn.value.trim();
    if(!name) return alert("Enter student name");
    const roll = generateRoll();
    students.push({
      roll, name,
      admissionNo: admIn.value.trim(),
      class: teacherClass,
      section: teacherSection,
      parentContact: pcIn.value.trim()
    });
    localStorage.setItem("students", JSON.stringify(students));
    nameIn.value=admIn.value=pcIn.value="";
    renderStudents();
  });

  // Day attendance
  loadDay.addEventListener("click", () => {
    if(!dateIn.value) return dateIn.showPicker?.()??dateIn.focus();
    renderAttendance(dateIn.value);
  });
  saveDay.addEventListener("click", () => {
    if(!dateIn.value) return dateIn.showPicker?.()??dateIn.focus();
    localStorage.setItem("attendanceData", JSON.stringify(attendanceData));
    alert("Saved for "+dateIn.value);
  });

  // Monthly view
  loadMon.addEventListener("click", () => {
    if(!monthIn.value) return;
    renderMonthTable(monthIn.value);
    renderSummary(monthIn.value);
  });

  // Reports modal
  expPdf.addEventListener("click", ()=>showModal(pdfModal));
  shpWA.addEventListener("click", ()=>showModal(waModal));
  pdfClose.addEventListener("click", ()=>closeModal(pdfModal));
  waClose.addEventListener("click", ()=>closeModal(waModal));

  pdfCur.addEventListener("click", ()=>{ generatePdf("Current Attendance", dateIn.value||new Date().toISOString().slice(0,10)); closeModal(pdfModal); });
  pdfDay.addEventListener("click", ()=>{ if(!dateIn.value) return dateIn.showPicker?.()??dateIn.focus(); generatePdf("Daily Attendance", dateIn.value); closeModal(pdfModal); });
  pdfMon.addEventListener("click", ()=>{ if(!pdfMonIn.value) return pdfMonIn.showPicker?.()??pdfMonIn.focus(); generateMonthlyPdf(pdfMonIn.value); closeModal(pdfModal); });

  waCur.addEventListener("click", ()=>{ sendWA("Current Attendance", dateIn.value||new Date().toISOString().slice(0,10)); closeModal(waModal); });
  waDay.addEventListener("click", ()=>{ if(!dateIn.value) return dateIn.showPicker?.()??dateIn.focus(); sendWA("Daily Attendance", dateIn.value); closeModal(waModal); });
  waMon.addEventListener("click", ()=>{ if(!waMonIn.value) return waMonIn.showPicker?.()??waMonIn.focus(); sendWAMonthly(waMonIn.value); closeModal(waModal); });

  // Functions
  function updateHeader() {
    header.textContent = teacherClass&&teacherSection
      ? `${teacherClass} - ${teacherSection}`
      : "None";
  }

  function generateRoll() {
    const list = students.filter(s=>s.class===teacherClass&&s.section===teacherSection);
    return list.length ? Math.max(...list.map(s=>+s.roll))+1 : 1;
  }

  function renderStudents() {
    listStd.innerHTML = "";
    students
      .filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=>{
        const li = document.createElement("li");
        li.textContent = `${s.roll} - ${s.name}`;
        const del = document.createElement("button");
        del.textContent="Delete";
        del.onclick = ()=>{
          if(!confirm(`Delete ${s.name}?`)) return;
          students = students.filter(x=>x!==s);
          localStorage.setItem("students",JSON.stringify(students));
          renderStudents();
        };
        li.append(del);
        listStd.append(li);
      });
  }

  function renderAttendance(d) {
    listDay.innerHTML = "";
    const dayData = attendanceData[d] = attendanceData[d]||{};
    students
      .filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=>{
        const div = document.createElement("div");
        div.className = "attendance-item";
        div.textContent = `${s.roll} - ${s.name}`;
        const bc = document.createElement("div");
        bc.className = "attendance-buttons";
        ["P","A","Lt","L","HD"].forEach(code=>{
          const btn = document.createElement("button");
          btn.className="att-btn";
          btn.textContent=code;
          if(dayData[s.roll]===code) btn.classList.add("selected");
          btn.onclick=()=>{
            dayData[s.roll]=code;
            bc.querySelectorAll("button").forEach(x=>x.classList.remove("selected"));
            btn.classList.add("selected");
          };
          bc.append(btn);
        });
        div.append(bc);
        listDay.append(div);
      });
  }

  function renderMonthTable(m) {
    const [y,mm] = m.split("-");
    const days = new Date(y,mm,0).getDate();
    let html = "<table><tr><th>Roll</th><th>Name</th>";
    for(let d=1;d<=days;d++) html+=`<th>${d}</th>`;
    html+="</tr>";
    students
      .filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=>{
        html+=`<tr><td>${s.roll}</td><td>${s.name}</td>`;
        for(let d=1;d<=days;d++){
          const key=`${m}-${String(d).padStart(2,"0")}`;
          html+=`<td>${attendanceData[key]?.[s.roll]||""}</td>`;
        }
        html+="</tr>";
      });
    html+="</table>";
    monTable.innerHTML = html;
  }

  function renderSummary(m) {
    const [y,mm] = m.split("-");
    const days = new Date(y,mm,0).getDate();
    let out="";
    students
      .filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=>{
        const cnt={P:0,A:0,Lt:0,L:0,HD:0};
        for(let d=1;d<=days;d++){
          const key=`${m}-${String(d).padStart(2,"0")}`;
          const st=attendanceData[key]?.[s.roll];
          if(cnt[st]!==undefined) cnt[st]++;
        }
        const present=cnt.P+cnt.Lt+cnt.HD;
        const perc=Math.round((present/days)*100);
        out+=`<p><strong>${s.roll}-${s.name}:</strong> P:${cnt.P}, Lt:${cnt.Lt}, HD:${cnt.HD}, L:${cnt.L}, A:${cnt.A} — ${perc}%</p>`;
      });
    summary.innerHTML = out;
  }

  function generatePdf(title,d) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`${title} for ${d} (${teacherClass}-${teacherSection})`,10,10);
    let y=20;
    const dayData = attendanceData[d]||{};
    students
      .filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=>{
        doc.text(`${s.roll}-${s.name}: ${getStatusText(dayData[s.roll]||"")}`,10,y);
        y+=10;
      });
    doc.save(`${title.replace(/\s+/g,"_")}_${d}.pdf`);
  }

  function generateMonthlyPdf(m) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("l","pt","a4");
    doc.text(`Monthly Attendance for ${m} (${teacherClass}-${teacherSection})`,20,30);
    const [y,mm] = m.split("-");
    const days = new Date(y,mm,0).getDate();
    const cols = ["Roll","Name",...Array.from({length:days},(_,i)=>(i+1).toString())];
    const rows = students
      .filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .map(s=>{
        const row = [s.roll,s.name];
        for(let d=1;d<=days;d++){
          const key=`${m}-${String(d).padStart(2,"0")}`;
          row.push(attendanceData[key]?.[s.roll]||"");
        }
        return row;
      });
    doc.autoTable({ head:[cols], body:rows, startY:50, theme:"grid",
      styles:{fontSize:8}, headStyles:{fillColor:[0,123,255]} });
    doc.save(`Monthly_Attendance_${m}.pdf`);
  }

  function sendWA(title,d) {
    let msg=`${title} for ${d} (${teacherClass}-${teacherSection})\n\n`;
    const dayData=attendanceData[d]||{};
    students
      .filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=>{
        msg+=`${s.roll}-${s.name}: ${getStatusText(dayData[s.roll]||"")}\n`;
      });
    window.open("https://api.whatsapp.com/send?text="+encodeURIComponent(msg),"_blank");
  }

  function sendWAMonthly(m) {
    let msg=`Monthly Attendance for ${m} (${teacherClass}-${teacherSection})\n\n`;
    const [y,mm] = m.split("-");
    const days = new Date(y,mm,0).getDate();
    students
      .filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=>{
        const cnt={P:0,A:0,Lt:0,L:0,HD:0};
        for(let d=1;d<=days;d++){
          const key=`${m}-${String(d).padStart(2,"0")}`;
          const st=attendanceData[key]?.[s.roll];
          if(cnt[st]!==undefined) cnt[st]++;
        }
        msg+=`${s.roll}-${s.name}\nP:${cnt.P}, Lt:${cnt.Lt}, HD:${cnt.HD}, L:${cnt.L}, A:${cnt.A}\n\n`;
      });
    window.open("https://api.whatsapp.com/send?text="+encodeURIComponent(msg),"_blank");
  }
});
