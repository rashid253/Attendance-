// app.js

document.addEventListener('DOMContentLoaded', () => {
  // Element refs
  const schoolNameInput      = $('#schoolNameInput');
  const teacherClassSelect   = $('#teacherClassSelect');
  const teacherSectionSelect = $('#teacherSectionSelect');
  const saveSetupBtn         = $('#saveSetup');
  const editSetupBtn         = $('#editSetup');
  const setupFormEl          = $('#setupForm');
  const setupDisplayEl       = $('#setupDisplay');
  const dispSchool           = $('#dispSchool');
  const dispClass            = $('#dispClass');
  const dispSection          = $('#dispSection');

  const studentNameInput     = $('#studentName');
  const admissionNoInput     = $('#admissionNo');
  const parentContactInput   = $('#parentContact');
  const addStudentBtn        = $('#addStudent');
  const studentsUl           = $('#students');
  const deleteAllStudentsBtn = $('#deleteAllStudents');

  const dateInput            = $('#dateInput');
  const loadAttendanceBtn    = $('#loadAttendance');
  const attendanceListDiv    = $('#attendanceList');
  const saveAttendanceBtn    = $('#saveAttendance');

  const attendanceResultSec  = $('#attendance-result');
  const attendanceResultUl   = $('#attendanceResultList');
  const editAttendanceBtn    = $('#editAttendanceBtn');
  const shareAttendanceBtn   = $('#shareAttendanceBtn');
  const downloadAttendanceBtn= $('#downloadAttendanceBtn');

  const analyticsTypeSel     = $('#analyticsType');
  const analyticsDateInput   = $('#analyticsDate');
  const analyticsMonthInput  = $('#analyticsMonth');
  const studentFilterSel     = $('#studentFilter');
  const representationSel    = $('#representationType');
  const loadAnalyticsBtn     = $('#loadAnalytics');
  const resetAnalyticsBtn    = $('#resetAnalyticsBtn');
  const analyticsContainer   = $('#analyticsContainer');

  // State
  let schoolName    = localStorage.getItem('schoolName')       || '';
  let cls           = localStorage.getItem('teacherClass')     || '';
  let sec           = localStorage.getItem('teacherSection')   || '';
  let students      = JSON.parse(localStorage.getItem('students'))         || [];
  let attendance    = JSON.parse(localStorage.getItem('attendanceData'))   || {};
  let analyticsChart= null;
  let isEditing     = false, editRoll = null;

  // DOM helper
  function $(id){ return document.getElementById(id); }

  // --- Setup ---
  function initSetup() {
    if (!schoolName || !cls || !sec) return;
    dispSchool.textContent  = schoolName;
    dispClass.textContent   = cls;
    dispSection.textContent = sec;
    setupFormEl.classList.add('hidden');
    setupDisplayEl.classList.remove('hidden');
    renderStudents();
    populateFilter();
  }

  saveSetupBtn.onclick = () => {
    const s    = schoolNameInput.value.trim();
    const c    = teacherClassSelect.value;
    const secv = teacherSectionSelect.value;
    if (!s||!c||!secv) return alert('Enter school, class & section');
    schoolName = s; cls = c; sec = secv;
    localStorage.setItem('schoolName', schoolName);
    localStorage.setItem('teacherClass', cls);
    localStorage.setItem('teacherSection', sec);
    initSetup();
  };

  editSetupBtn.onclick = () => {
    setupDisplayEl.classList.add('hidden');
    setupFormEl.classList.remove('hidden');
    schoolNameInput.value      = schoolName;
    teacherClassSelect.value   = cls;
    teacherSectionSelect.value = sec;
  };

  // --- Students ---
  function renderStudents(){
    studentsUl.innerHTML = '';
    students.filter(s=>s.class===cls&&s.section===sec)
      .forEach(s => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${s.roll}. ${s.name}`;
        const btnGroup = document.createElement('div');
        btnGroup.className = 'button-group';

        const editBtn = document.createElement('button');
        editBtn.className = 'small';
        editBtn.textContent = 'Edit';
        editBtn.onclick = ()=>{
          isEditing = true; editRoll = s.roll;
          studentNameInput.value    = s.name;
          admissionNoInput.value    = s.admissionNo;
          parentContactInput.value  = s.parentContact;
          addStudentBtn.textContent = 'Update';
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'small';
        delBtn.textContent = 'Delete';
        delBtn.onclick = ()=>{
          if(!confirm('Delete this student?')) return;
          students = students.filter(x=>!(x.roll===s.roll&&x.class===cls&&x.section===sec));
          localStorage.setItem('students', JSON.stringify(students));
          renderStudents();
        };

        btnGroup.append(editBtn, delBtn);
        li.append(nameSpan, btnGroup);
        studentsUl.append(li);
      });
  }

  addStudentBtn.onclick = () => {
    const name = studentNameInput.value.trim();
    if (!name||!cls) return alert('Enter name & save setup');
    const adm = admissionNoInput.value.trim();
    const ph  = parentContactInput.value.trim();
    if (isEditing) {
      const stu = students.find(s=>s.roll===editRoll&&s.class===cls&&s.section===sec);
      stu.name = name; stu.admissionNo = adm; stu.parentContact = ph;
      isEditing = false; addStudentBtn.textContent='Add';
    } else {
      const roll = students.filter(s=>s.class===cls&&s.section===sec).length+1;
      students.push({roll,name,admissionNo:adm,class:cls,section:sec,parentContact:ph});
    }
    localStorage.setItem('students', JSON.stringify(students));
    studentNameInput.value = admissionNoInput.value = parentContactInput.value = '';
    renderStudents();
  };

  deleteAllStudentsBtn.onclick = () => {
    if(!cls) return alert('Save setup first');
    if(!confirm('Delete all students?')) return;
    students = students.filter(s=>!(s.class===cls&&s.section===sec));
    localStorage.setItem('students', JSON.stringify(students));
    renderStudents();
  };

  function populateFilter(){
    studentFilterSel.innerHTML = '<option value="">All Students</option>';
    students.filter(s=>s.class===cls&&s.section===sec)
      .forEach(s=>{
        const o=document.createElement('option');
        o.value=s.roll; o.textContent=s.name;
        studentFilterSel.append(o);
      });
  }

  // --- Attendance Marking ---
  loadAttendanceBtn.onclick = () => {
    const d = dateInput.value;
    if(!d) return alert('Pick date');
    renderAttendance(d);
  };

  function renderAttendance(d){
    attendanceListDiv.innerHTML = '';
    attendance[d] = attendance[d]||{};
    const day = attendance[d];
    students.filter(s=>s.class===cls&&s.section===sec)
      .forEach(s=>{
        const div = document.createElement('div');
        div.className='attendance-item';
        const nameDiv = document.createElement('div');
        nameDiv.className='att-name';
        nameDiv.textContent=`${s.roll}. ${s.name}`;

        const actionsDiv = document.createElement('div');
        actionsDiv.className='attendance-actions';
        const btnsDiv = document.createElement('div');
        btnsDiv.className='attendance-buttons';

        ['P','A','Lt','L','HD'].forEach(code=>{
          const b = document.createElement('button');
          b.className='att-btn'+(day[s.roll]===code?` selected ${code}`:'');
          b.textContent=code;
          b.onclick = ()=>{
            day[s.roll]=code;
            btnsDiv.querySelectorAll('button').forEach(x=>x.className='att-btn');
            b.classList.add('selected',code);
          };
          btnsDiv.append(b);
        });

        const sendBtn = document.createElement('button');
        sendBtn.className='send-btn';
        sendBtn.textContent='Send';
        sendBtn.onclick = ()=> showSummary(d);

        actionsDiv.append(btnsDiv, sendBtn);
        div.append(nameDiv, actionsDiv);
        attendanceListDiv.append(div);
      });
  }

  saveAttendanceBtn.onclick = () => {
    const d = dateInput.value;
    if(!d) return alert('Pick date');
    localStorage.setItem('attendanceData', JSON.stringify(attendance));
    showSummary(d);
  };

  // --- Attendance Summary ---
  function showSummary(d){
    attendanceResultUl.innerHTML = '';
    const day = attendance[d]||{};
    students.filter(s=>s.class===cls&&s.section===sec)
      .forEach(s=>{
        const li=document.createElement('li');
        li.textContent=`${s.name}: ${day[s.roll]||'Not marked'}`;
        attendanceResultUl.append(li);
      });
    attendanceResultSec.classList.remove('hidden');
    editAttendanceBtn.onclick = ()=> {
      attendanceResultSec.classList.add('hidden');
    };
    shareAttendanceBtn.onclick    = ()=> shareSummary(d);
    downloadAttendanceBtn.onclick = ()=> downloadSummary(d);
  }

  // --- Summary share/download ---
  function shareSummary(d){
    const day = attendance[d]||{};
    const lines = students.filter(s=>s.class===cls&&s.section===sec)
      .map(s=>`${s.name}: ${day[s.roll]||'Not marked'}`);
    const text = `${schoolName}\nClass‑Section: ${cls}-${sec}\nDate: ${d}\n\n`+lines.join('\n');
    if(navigator.share){
      navigator.share({title:schoolName,text});
    } else {
      alert('Share not supported');
    }
  }

  function downloadSummary(d){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(schoolName, 10, 10);
    doc.text(`Class‑Section: ${cls}-${sec}`, 10, 20);
    doc.text(`Date: ${d}`, 10, 30);
    const body = students.filter(s=>s.class===cls&&s.section===sec)
      .map(s=>[s.name, attendance[d]?.[s.roll]||'Not marked']);
    doc.autoTable({ head:[['Name','Status']], body, startY:40 });
    doc.save(`Summary_${d}.pdf`);
  }

  // --- Analytics ---
  analyticsTypeSel.onchange = e => {
    analyticsDateInput.classList.toggle('hidden', e.target.value!=='date');
    analyticsMonthInput.classList.toggle('hidden', e.target.value!=='month');
  };

  loadAnalyticsBtn.onclick = () => {
    renderAnalytics();
    [analyticsTypeSel, analyticsDateInput, analyticsMonthInput, studentFilterSel, representationSel, loadAnalyticsBtn]
      .forEach(el=>el.disabled = true);
    resetAnalyticsBtn.classList.remove('hidden');
  };

  resetAnalyticsBtn.onclick = () => {
    [analyticsTypeSel, analyticsDateInput, analyticsMonthInput, studentFilterSel, representationSel, loadAnalyticsBtn]
      .forEach(el=>el.disabled = false);
    resetAnalyticsBtn.classList.add('hidden');
    analyticsContainer.innerHTML = '';
  };

  function renderAnalytics(){
    const type   = analyticsTypeSel.value;
    const period = type==='date'? analyticsDateInput.value : analyticsMonthInput.value;
    if(!period) return alert('Select period');
    const stud   = studentFilterSel.value;
    const rep    = representationSel.value;
    const dates  = (type==='date'? [period] : getPeriodDates(type, period));
    const data   = students.filter(s=>s.class===cls&&s.section===sec)
      .filter(s=>!stud||s.roll==stud)
      .map(s=>{
        const cnt={P:0,A:0,Lt:0,L:0,HD:0};
        dates.forEach(d=>{ const st=attendance[d]?.[s.roll]; if(st) cnt[st]++; });
        const pct=Math.round((cnt.P+cnt.Lt+cnt.HD)/dates.length*100);
        return {name:s.name,cnt,pct};
      });

    analyticsContainer.innerHTML = '';

    // TABLE
    if(rep==='table'||rep==='all'){
      const tbl=document.createElement('table');
      tbl.border=1; tbl.style.width='100%';
      if(type==='month'){
        const days=dates.map(d=>d.split('-')[2]);
        const head=['Name',...days];
        const rows=students.filter(s=>s.class===cls&&s.section===sec)
          .map(s=>[s.name,...dates.map(d=>attendance[d]?.[s.roll]||'–')]);
        docTable(tbl, head, rows);
      } else {
        const head=['Name','P','Lt','HD','L','A','%'];
        const rows=data.map(r=>[r.name, r.cnt.P, r.cnt.Lt, r.cnt.HD, r.cnt.L, r.cnt.A, r.pct+'%']);
        docTable(tbl, head, rows);
      }
      const wrap=document.createElement('div');
      wrap.className='table-container'; wrap.append(tbl);
      analyticsContainer.append(wrap);
    }

    // SUMMARY
    if(rep==='summary'||rep==='all'){
      data.forEach(r=>{
        const p=document.createElement('p');
        p.textContent=`${r.name}: ${r.cnt.P}P, ${r.cnt.Lt}Lt, ${r.cnt.HD}H, ${r.cnt.L}L, ${r.cnt.A}A — ${r.pct}%`;
        analyticsContainer.append(p);
      });
    }

    // GRAPH
    if(rep==='graph'||rep==='all'){
      const canvas=document.createElement('canvas');
      analyticsContainer.append(canvas);
      if(analyticsChart) analyticsChart.destroy();
      analyticsChart=new Chart(canvas.getContext('2d'),{
        type:'bar',
        data:{labels:data.map(r=>r.name),datasets:[{label:'%',data:data.map(r=>r.pct)}]},
        options:{responsive:true}
      });
      const btn=document.createElement('button');
      btn.className='small'; btn.textContent='Download Graph';
      btn.onclick=()=>{
        const url=analyticsChart.toBase64Image();
        const a=document.createElement('a');
        a.href=url; a.download=`Chart_${period}.png`;
        a.click();
      };
      analyticsContainer.append(btn);
    }

    // SHARE / DOWNLOAD
    if(rep!=='all'){
      const wrap=document.createElement('div');
      wrap.className='row-inline';

      const shareBtn=document.createElement('button');
      shareBtn.className='small'; shareBtn.textContent='Share';
      shareBtn.onclick=()=>{
        const text=buildShareText(type, period, data, dates);
        if(navigator.share) navigator.share({title:schoolName,text});
        else alert('Share not supported');
      };

      const dlBtn=document.createElement('button');
      dlBtn.className='small'; dlBtn.textContent='Download';
      dlBtn.onclick=()=>{
        const { jsPDF }=window.jspdf;
        const doc=new jsPDF(type==='month'?'l':'p','pt','a4');
        doc.text(schoolName,20,20);
        if(type==='month'){
          const head=['Name',...dates.map(d=>d.split('-')[2])];
          const rows=students.filter(s=>s.class===cls&&s.section===sec)
            .map(s=>[s.name,...dates.map(d=>attendance[d]?.[s.roll]||'–')]);
          doc.autoTable({head:[head],body:rows,startY:40,styles:{fontSize:8},headStyles:{fillColor:[33,150,243]}});
          doc.save(`Register_${period}.pdf`);
        } else {
          const rows=data.map(r=>[r.name,r.pct+'%']);
          doc.autoTable({head:[['Name','%']],body:rows,startY:40});
          doc.save(`Report_${period}.pdf`);
        }
      };

      wrap.append(shareBtn, dlBtn);
      analyticsContainer.append(wrap);
    }
  }

  function docTable(tbl, head, rows){
    const tr=document.createElement('tr');
    head.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; tr.append(th); });
    tbl.append(tr);
    rows.forEach(r=>{
      const row=document.createElement('tr');
      r.forEach(c=>{ const td=document.createElement('td'); td.textContent=c; row.append(td); });
      tbl.append(row);
    });
  }

  function buildShareText(type, period, data, dates){
    let text=`${schoolName}\nClass‑Section: ${cls}-${sec}\n`;
    if(type==='date'){
      text+=`Date: ${period}\n\n`+
        data.map(r=>`${r.name}: ${attendance[period]?.[students.find(s=>s.name===r.name).roll]||'–'}`).join('\n');
    } else if(type==='month'){
      text+=`Register ${period}\n\n`+
        students.filter(s=>s.class===cls&&s.section===sec)
          .map(s=>`${s.name}: ${dates.map(d=>attendance[d]?.[s.roll]||'–').join(' ')}`).join('\n');
    } else {
      text+=`Period: ${type} ${period}\n\n`+
        data.map(r=>`${r.name}: ${r.pct}% (${r.cnt.P}P,${r.cnt.Lt}Lt,${r.cnt.HD}H,${r.cnt.L}L,${r.cnt.A}A)`).join('\n');
    }
    return text;
  }

  function getPeriodDates(type,m){
    const arr=[], now=new Date(), year=now.getFullYear();
    if(type==='month'&&/^\d{4}-\d{2}$/.test(m)){
      const [y,mo]=m.split('-'),days=new Date(y,mo,0).getDate();
      for(let d=1;d<=days;d++)arr.push(`${y}-${mo}-${String(d).padStart(2,'0')}`);
    } else if(type==='year'&&/^\d{4}$/.test(m)){
      for(let mo=1;mo<=12;mo++){
        const mm=String(mo).padStart(2,'0'),
              days=new Date(m,mo,0).getDate();
        for(let d=1;d<=days;d++)arr.push(`${m}-${mm}-${String(d).padStart(2,'0')}`);
      }
    } else {
      const [start,end]=type==='semester'? [1,6]: [7,12];
      for(let mo=start;mo<=end;mo++){
        const mm=String(mo).padStart(2,'0'),days=new Date(year,mo,0).getDate();
        for(let d=1;d<=days;d++)arr.push(`${year}-${mm}-${String(d).padStart(2,'0')}`);
      }
    }
    return arr;
  }

  // Initialize
  initSetup();
});
