// app.js
document.addEventListener("DOMContentLoaded", () => {
  // Helpers
  const getStatusText = s => ({ P:"Present", A:"Absent", L:"Leave", Lt:"Late", Le:"Leave", HD:"Half Day" }[s]||"Not Marked");

  // Refs
  const clsSel    = $("#teacherClassSelect");
  const secSel    = $("#teacherSectionSelect");
  const saveCls   = $("#saveTeacherClass");
  const header    = $("#teacherClassHeader");

  const nameIn    = $("#studentName");
  const admIn     = $("#admissionNo");
  const pcIn      = $("#parentContact");
  const addStd    = $("#addStudent");
  const listStd   = $("#students");

  const dateIn    = $("#dateInput");
  const loadDay   = $("#loadAttendance");
  const saveDay   = $("#saveAttendance");
  const listDay   = $("#attendanceList");

  const monthIn   = $("#monthInput");
  const loadMon   = $("#loadMonth");
  const monTable  = $("#monthTable");
  const summary   = $("#summaryReport");

  const expPdf    = $("#exportPdf");
  const shpWA     = $("#shareWhatsApp");
  const pdfModal  = $("#pdfOptionsModal");
  const waModal   = $("#whatsappOptionsModal");
  const pdfClose  = $("#closePdfModalBtn");
  const waClose   = $("#closeWaModalBtn");
  const pdfCur    = $("#pdfCurrentReportBtn");
  const pdfDay    = $("#pdfDailyReportBtn");
  const pdfMon    = $("#pdfMonthlyReportBtn");
  const pdfMonIn  = $("#pdfMonthInput");
  const waCur     = $("#waCurrentBtn");
  const waDay     = $("#waDailyBtn");
  const waMon     = $("#waMonthlyBtn");
  const waMonIn   = $("#waMonthInput");

  // Storage
  let teacherClass   = localStorage.getItem("teacherClass")   || "";
  let teacherSection = localStorage.getItem("teacherSection") || "";
  let students       = JSON.parse(localStorage.getItem("students"))       || [];
  let attendanceData = JSON.parse(localStorage.getItem("attendanceData")) || {};

  // Init
  clsSel.value   = teacherClass;
  secSel.value   = teacherSection;
  updateHeader();
  renderStudents();

  // Save class & section
  saveCls.onclick = () => {
    if (!clsSel.value || !secSel.value) return alert("Select both class & section");
    teacherClass = clsSel.value;
    teacherSection = secSel.value;
    localStorage.setItem("teacherClass", teacherClass);
    localStorage.setItem("teacherSection", teacherSection);
    updateHeader();
    renderStudents();
  };

  // Add student
  addStd.onclick = () => {
    if (!teacherClass||!teacherSection) return alert("Save class & section first");
    const name = nameIn.value.trim();
    if (!name) return alert("Enter student name");
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
  };

  // Load / Save daily attendance
  loadDay.onclick = () => {
    if (!dateIn.value) return dateIn.showPicker?.() ?? dateIn.focus();
    renderAttendance(dateIn.value);
  };
  saveDay.onclick = () => {
    if (!dateIn.value) return dateIn.showPicker?.() ?? dateIn.focus();
    localStorage.setItem("attendanceData", JSON.stringify(attendanceData));
    alert("Saved for "+ dateIn.value);
  };

  // Monthly view
  loadMon.onclick = () => {
    if (!monthIn.value) return;
    renderMonthTable(monthIn.value);
    renderSummary(monthIn.value);
  };

  // Reports modals
  expPdf.onclick = () => pdfModal.style.display="flex";
  shpWA.onclick  = () => waModal.style.display="flex";
  pdfClose.onclick = () => pdfModal.style.display="none";
  waClose.onclick  = () => waModal.style.display="none";

  // PDF buttons
  pdfCur.onclick = () => { genPdf("Current Attendance", dateIn.value||today()); pdfModal.style.display="none"; };
  pdfDay.onclick = () => { if(!dateIn.value) return dateIn.showPicker?.() ?? dateIn.focus(); genPdf("Daily Attendance", dateIn.value); pdfModal.style.display="none"; };
  pdfMon.onclick = () => { if(!pdfMonIn.value) return pdfMonIn.showPicker?.() ?? pdfMonIn.focus(); genMonthlyPdf(pdfMonIn.value); pdfModal.style.display="none"; };

  // WhatsApp buttons
  waCur.onclick = () => { sendWA("Current Attendance", dateIn.value||today()); waModal.style.display="none"; };
  waDay.onclick = () => { if(!dateIn.value) return dateIn.showPicker?.() ?? dateIn.focus(); sendWA("Daily Attendance", dateIn.value); waModal.style.display="none"; };
  waMon.onclick = () => { if(!waMonIn.value) return waMonIn.showPicker?.() ?? waMonIn.focus(); sendWAMonthly(waMonIn.value); waModal.style.display="none"; };

  // Helpers
  function today(){ return new Date().toISOString().slice(0,10); }
  function updateHeader(){
    header.textContent = teacherClass && teacherSection
      ? `${teacherClass} - ${teacherSection}`
      : "None";
  }
  function generateRoll(){
    const list = students.filter(s=>s.class===teacherClass&&s.section===teacherSection);
    return list.length ? Math.max(...list.map(s=>+s.roll))+1 : 1;
  }
  function renderStudents(){
    listStd.innerHTML = "";
    students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=>{
        const li = document.createElement("li");
        li.textContent = `${s.roll} - ${s.name}`;
        const del = document.createElement("button");
        del.textContent="Delete";
        del.onclick = ()=> {
          if(!confirm(`Delete ${s.name}?`)) return;
          students = students.filter(x=>x!==s);
          localStorage.setItem("students",JSON.stringify(students));
          renderStudents();
        };
        li.append(del);
        listStd.append(li);
      });
  }
  function renderAttendance(d){
    listDay.innerHTML="";
    const dayData = attendanceData[d] = attendanceData[d]||{};
    students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=>{
        const div = document.createElement("div");
        div.className = "attendance-item";
        div.innerHTML = `<span>${s.roll} - ${s.name}</span>`;
        const btns = document.createElement("div");
        btns.className="attendance-buttons";
        ["P","A","Lt","L","HD"].forEach(code=>{
          const b = document.createElement("button");
          b.className="att-btn";
          b.textContent=code;
          if(dayData[s.roll]===code) b.classList.add("selected");
          b.onclick=()=>{
            dayData[s.roll]=code;
            btns.querySelectorAll("button").forEach(x=>x.classList.remove("selected"));
            b.classList.add("selected");
          };
          btns.append(b);
        });
        div.append(btns);
        listDay.append(div);
      });
  }
  function renderMonthTable(m){
    const [y,mm]=m.split("-"), days=new Date(y,mm,0).getDate();
    let html=`<table><tr><th>Roll</th><th>Name</th>`+Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join("")+`</tr>`;
    students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=>{
        html+=`<tr><td>${s.roll}</td><td>${s.name}</td>`+
          Array.from({length:days},(_,i)=>{
            const key=`${m}-${String(i+1).padStart(2,"0")}`;
            return `<td>${attendanceData[key]?.[s.roll]||""}</td>`;
          }).join("")+`</tr>`;
      });
    monTable.innerHTML=html+"</table>";
  }
  function renderSummary(m){
    const [y,mm]=m.split("-"), days=new Date(y,mm,0).getDate();
    let out="";
    students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=>{
        const cnt={P:0,A:0,Lt:0,L:0,HD:0};
        for(let d=1;d<=days;d++){
          const key=`${m}-${String(d).padStart(2,"0")}`;
          const st=attendanceData[key]?.[s.roll];
          if(cnt[st]!==undefined) cnt[st]++;
        }
        const pres=cnt.P+cnt.Lt+cnt.HD, pct=Math.round(pres/days*100);
        out+=`<p><strong>${s.roll}-${s.name}:</strong> P:${cnt.P}, Lt:${cnt.Lt}, HD:${cnt.HD}, L:${cnt.L}, A:${cnt.A} — ${pct}%</p>`;
      });
    summary.innerHTML=out;
  }
  function genPdf(title,d){
    const { jsPDF } = window.jspdf, doc=new jsPDF();
    doc.text(`${title} for ${d} (${teacherClass}-${teacherSection})`,10,10);
    let y=20, dayData=attendanceData[d]||{};
    students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=>{ doc.text(`${s.roll}-${s.name}: ${getStatusText(dayData[s.roll]||"")}`,10,y); y+=10; });
    doc.save(`${title.replace(/\s+/g,"_")}_${d}.pdf`);
  }
  function genMonthlyPdf(m){
    const { jsPDF } = window.jspdf, doc=new jsPDF("l","pt","a4");
    doc.text(`Monthly Attendance for ${m} (${teacherClass}-${teacherSection})`,20,30);
    const [y,mm]=m.split("-"), days=new Date(y,mm,0).getDate();
    const cols=["Roll","Name",...Array.from({length:days},(_,i)=>(i+1).toString())];
    const rows=students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .map(s=>[s.roll,s.name,...Array.from({length:days},(_,i)=>{
        const key=`${m}-${String(i+1).padStart(2,"0")}`;
        return attendanceData[key]?.[s.roll]||"";
      })]);
    doc.autoTable({ head:[cols], body:rows, startY:50, theme:"grid",
      styles:{fontSize:8}, headStyles:{fillColor:[33,150,243]} });
    doc.save(`Monthly_Attendance_${m}.pdf`);
  }
  function sendWA(title,d){
    let msg=`${title} for ${d} (${teacherClass}-${teacherSection})\n\n`;
    const dayData=attendanceData[d]||{};
    students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=> msg+=`${s.roll}-${s.name}: ${getStatusText(dayData[s.roll]||"")}\n`);
    window.open("https://api.whatsapp.com/send?text="+encodeURIComponent(msg),"_blank");
  }
  function sendWAMonthly(m){
    let msg=`Monthly Attendance for ${m} (${teacherClass}-${teacherSection})\n\n`;
    const [y,mm]=m.split("-"), days=new Date(y,mm,0).getDate();
    students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=>{
        const cnt={P:0,A:0,Lt:0,L:0,HD:0};
        for(let d=1;d<=days;d++){
          const key=`${m}-${String(d).padStart(2,"0")}`;
          if(cnt[attendanceData[key]?.[s.roll]]!==undefined)
            cnt[attendanceData[key][s.roll]]++;
        }
        msg+=`${s.roll}-${s.name}\nP:${cnt.P}, Lt:${cnt.Lt}, HD:${cnt.HD}, L:${cnt.L}, A:${cnt.A}\n\n`;
      });
    window.open("https://api.whatsapp.com/send?text="+encodeURIComponent(msg),"_blank");
  }

  // small helper for querySelector
  function $(id){ return document.getElementById(id); }
});
