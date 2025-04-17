// app.js
document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id),
        today = () => new Date().toISOString().slice(0,10),
        getStatusText = s => ({ P:"Present", A:"Absent", L:"Leave", Lt:"Late", HD:"Half Day" }[s]||"Not Marked");

  // DOM refs
  const clsSel    = $("teacherClassSelect"),
        secSel    = $("teacherSectionSelect"),
        saveCls   = $("saveTeacherClass"),
        formSetup = $("teacherSetupForm"),
        dispSetup = $("teacherSetupDisplay"),
        dispClass  = $("dispClass"),
        dispSection = $("dispSection"),
        editSetup = $("editTeacherSetup"),
        header    = $("teacherClassHeader"),

        nameIn    = $("studentName"),
        admIn     = $("admissionNo"),
        pcIn      = $("parentContact"),
        addStd    = $("addStudent"),
        listStd   = $("students"),

        dateIn    = $("dateInput"),
        loadDay   = $("loadAttendance"),
        saveDay   = $("saveAttendance"),
        listDay   = $("attendanceList"),

        monthIn   = $("monthInput"),
        loadMon   = $("loadMonth"),
        monTable  = $("monthTable"),
        summary   = $("summaryReport"),

        expPdf    = $("exportPdf"),
        shpWA     = $("shareWhatsApp"),
        pdfModal  = $("pdfOptionsModal"),
        waModal   = $("whatsappOptionsModal"),
        pdfClose  = $("closePdfModalBtn"),
        waClose   = $("closeWaModalBtn"),
        pdfCur    = $("pdfCurrentReportBtn"),
        pdfDay    = $("pdfDailyReportBtn"),
        pdfMon    = $("pdfMonthlyReportBtn"),
        pdfMonIn  = $("pdfMonthInput"),
        waCur     = $("waCurrentBtn"),
        waDay     = $("waDailyBtn"),
        waMon     = $("waMonthlyBtn"),
        waMonIn   = $("waMonthInput");

  // Data
  let teacherClass   = localStorage.getItem("teacherClass")   || "",
      teacherSection = localStorage.getItem("teacherSection") || "",
      students       = JSON.parse(localStorage.getItem("students"))       || [],
      attendanceData = JSON.parse(localStorage.getItem("attendanceData")) || {};

  // Init
  clsSel.value = teacherClass;
  secSel.value = teacherSection;
  if (teacherClass && teacherSection) showSetupDisplay();
  renderStudents();

  // Teacher Setup
  saveCls.onclick = () => {
    if (!clsSel.value || !secSel.value) return alert("Select both class & section");
    teacherClass = clsSel.value;
    teacherSection = secSel.value;
    localStorage.setItem("teacherClass", teacherClass);
    localStorage.setItem("teacherSection", teacherSection);
    header.textContent = `${teacherClass} - ${teacherSection}`;
    showSetupDisplay();
    renderStudents();
  };
  editSetup.onclick = () => {
    formSetup.classList.remove("hidden");
    dispSetup.classList.add("hidden");
  };
  function showSetupDisplay() {
    dispClass.textContent = teacherClass;
    dispSection.textContent = teacherSection;
    formSetup.classList.add("hidden");
    dispSetup.classList.remove("hidden");
  }

  // Student Registration
  addStd.onclick = () => {
    if (!teacherClass || !teacherSection) return alert("Save class & section first");
    const name = nameIn.value.trim();
    if (!name) return alert("Enter student name");
    const roll = students.filter(s=>s.class===teacherClass&&s.section===teacherSection).length + 1;
    students.push({ roll, name,
      admissionNo: admIn.value.trim(),
      class: teacherClass,
      section: teacherSection,
      parentContact: pcIn.value.trim()
    });
    localStorage.setItem("students", JSON.stringify(students));
    nameIn.value = admIn.value = pcIn.value = "";
    renderStudents();
  };

  function renderStudents() {
    listStd.innerHTML = "";
    students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s => {
        const li = document.createElement("li");
        li.innerHTML = `${s.roll} - ${s.name} ${s.admissionNo? `(Adm: ${s.admissionNo})`: ""}`;
        const del = document.createElement("button");
        del.textContent = "Delete";
        del.onclick = () => {
          if (!confirm(`Delete ${s.name}?`)) return;
          students = students.filter(x=>x!==s);
          localStorage.setItem("students", JSON.stringify(students));
          renderStudents();
        };
        li.append(del);
        listStd.append(li);
      });
  }

  // Daily Attendance
  loadDay.onclick = () => {
    if (!dateIn.value) return dateIn.showPicker?.() ?? dateIn.focus();
    renderAttendance(dateIn.value);
  };
  saveDay.onclick = () => {
    if (!dateIn.value) return dateIn.showPicker?.() ?? dateIn.focus();
    localStorage.setItem("attendanceData", JSON.stringify(attendanceData));
    // hide setup when saving attendance
    formSetup.classList.add("hidden");
    dispSetup.classList.add("hidden");
    alert("Saved for " + dateIn.value);
  };

  function renderAttendance(d) {
    listDay.innerHTML = "";
    const dayData = attendanceData[d] = attendanceData[d] || {};
    students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s => {
        const div = document.createElement("div");
        div.className = "attendance-item";
        div.innerHTML = `<span>${s.roll} - ${s.name}</span>`;
        const btns = document.createElement("div");
        btns.className = "attendance-buttons";
        ["P","A","Lt","L","HD"].forEach(code => {
          const b = document.createElement("button");
          b.className = "att-btn";
          b.textContent = code;
          if (dayData[s.roll] === code) b.classList.add("selected");
          b.onclick = () => {
            dayData[s.roll] = code;
            btns.querySelectorAll("button").forEach(x=>x.classList.remove("selected"));
            b.classList.add("selected");
          };
          btns.append(b);
        });
        div.append(btns);
        listDay.append(div);
      });
  }

  // Monthly View & Summary
  loadMon.onclick = () => {
    if (!monthIn.value) return;
    renderMonthTable(monthIn.value);
    renderSummary(monthIn.value);
  };

  function renderMonthTable(m) {
    const [y,mm] = m.split("-"), days = new Date(y,mm,0).getDate();
    let html = `<table><tr><th>Roll</th><th>Name</th>`;
    html += Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join("");
    html += `</tr>`;
    students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s => {
        html += `<tr><td>${s.roll}</td><td>${s.name}</td>`;
        for (let d=1; d<=days; d++){
          const key = `${m}-${String(d).padStart(2,"0")}`;
          html += `<td>${attendanceData[key]?.[s.roll]||""}</td>`;
        }
        html += `</tr>`;
      });
    monTable.innerHTML = html + `</table>`;
  }

  function renderSummary(m) {
    const [y,mm] = m.split("-"), days = new Date(y,mm,0).getDate();
    let out = "";
    students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s => {
        const cnt = {P:0,A:0,Lt:0,L:0,HD:0};
        for (let d=1; d<=days; d++){
          const key = `${m}-${String(d).padStart(2,"0")}`;
          const st = attendanceData[key]?.[s.roll];
          if (cnt[st]!==undefined) cnt[st]++; 
        }
        const pres = cnt.P + cnt.Lt + cnt.HD,
              pct = Math.round(pres / days * 100);
        out += `<p><strong>${s.roll}-${s.name}:</strong> P:${cnt.P}, Lt:${cnt.Lt}, HD:${cnt.HD}, L:${cnt.L}, A:${cnt.A} — ${pct}%</p>`;
      });
    summary.innerHTML = out;
  }

  // Reports & Share
  expPdf.onclick = () => pdfModal.style.display = "flex";
  shpWA.onclick  = () => waModal.style.display = "flex";
  pdfClose.onclick = () => pdfModal.style.display = "none";
  waClose.onclick  = () => waModal.style.display = "none";

  // Dynamic button text & color
  dateIn.onchange = () => {
    const d = dateIn.value;
    pdfDay.textContent = `Download Daily Report (${d})`;
    pdfDay.classList.add("highlight");
    waDay.textContent  = `Share Daily Report (${d})`;
    waDay.classList.add("highlight");
  };
  pdfMonIn.onchange = () => {
    const m = pdfMonIn.value;
    pdfMon.textContent = `Get Monthly Report (${m})`;
    pdfMon.classList.add("highlight");
  };
  waMonIn.onchange = () => {
    const m = waMonIn.value;
    waMon.textContent = `Share Monthly Report (${m})`;
    waMon.classList.add("highlight");
  };

  pdfCur.onclick = () => { genPdf("Current Attendance", today()); pdfModal.style.display="none"; };
  pdfDay.onclick = () => { genPdf("Daily Attendance", dateIn.value); pdfModal.style.display="none"; };
  pdfMon.onclick = () => { genMonthlyPdf(pdfMonIn.value); pdfModal.style.display="none"; };

  waCur.onclick = () => { sendWA("Current Attendance", today()); waModal.style.display="none"; };
  waDay.onclick = () => { sendWA("Daily Attendance", dateIn.value); waModal.style.display="none"; };
  waMon.onclick = () => { sendWAMonthly(waMonIn.value); waModal.style.display="none"; };

  function genPdf(title,d) {
    const { jsPDF } = window.jspdf, doc = new jsPDF();
    doc.text(`${title} for ${d} (${teacherClass}-${teacherSection})`,10,10);
    let y=20, dayData = attendanceData[d]||{};
    students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=>{ doc.text(`${s.roll}-${s.name}: ${getStatusText(dayData[s.roll]||"")}`,10,y); y+=10; });
    doc.save(`${title.replace(/\s+/g,"_")}_${d}.pdf`);
  }
  function genMonthlyPdf(m) {
    const { jsPDF } = window.jspdf, doc = new jsPDF("l","pt","a4");
    doc.text(`Monthly Attendance for ${m} (${teacherClass}-${teacherSection})`,20,30);
    const [y,mm] = m.split("-"), days = new Date(y,mm,0).getDate();
    const cols = ["Roll","Name",...Array.from({length:days},(_,i)=>(i+1).toString())];
    const rows = students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .map(s=>[s.roll,s.name,...Array.from({length:days},(_,i)=>{
        const key=`${m}-${String(i+1).padStart(2,"0")}`;
        return attendanceData[key]?.[s.roll]||"";
      })]);
    doc.autoTable({ head:[cols], body:rows, startY:50, theme:"grid",
      styles:{fontSize:8}, headStyles:{fillColor:[33,150,243]} });
    doc.save(`Monthly_Attendance_${m}.pdf`);
  }
  function sendWA(title,d) {
    let msg=`${title} for ${d} (${teacherClass}-${teacherSection})\n\n`,
        dayData = attendanceData[d]||{};
    students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=> msg+=`${s.roll}-${s.name}: ${getStatusText(dayData[s.roll]||"")}\n`);
    window.open("https://api.whatsapp.com/send?text="+encodeURIComponent(msg),"_blank");
  }
  function sendWAMonthly(m) {
    let msg=`Monthly Attendance for ${m} (${teacherClass}-${teacherSection})\n\n`,
        [y,mm]=m.split("-"), days=new Date(y,mm,0).getDate();
    students.filter(s=>s.class===teacherClass&&s.section===teacherSection)
      .forEach(s=>{
        const cnt={P:0,A:0,Lt:0,L:0,HD:0};
        for(let d=1;d<=days;d++){
          const key=`${m}-${String(d).padStart(2,"0")}`, st=attendanceData[key]?.[s.roll];
          if(cnt[st]!==undefined) cnt[st]++;
        }
        msg+=`${s.roll}-${s.name}\nP:${cnt.P}, Lt:${cnt.Lt}, HD:${cnt.HD}, L:${cnt.L}, A:${cnt.A}\n\n`;
      });
    window.open("https://api.whatsapp.com/send?text="+encodeURIComponent(msg),"_blank");
  }
});
