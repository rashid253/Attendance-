// app.js

document.addEventListener('DOMContentLoaded', function(){
  // helper
  function $(id){ return document.getElementById(id); }

  // --- element refs ---
  const schoolNameIn    = $('schoolNameInput');
  const classSel        = $('teacherClassSelect');
  const sectionSel      = $('teacherSectionSelect');
  const saveSetupBtn    = $('saveSetup');
  const editSetupBtn    = $('editSetup');
  const setupForm       = $('setupForm');
  const setupDisplay    = $('setupDisplay');
  const dispSchool      = $('dispSchool');
  const dispClass       = $('dispClass');
  const dispSection     = $('dispSection');

  const nameIn          = $('studentName');
  const admIn           = $('admissionNo');
  const contactIn       = $('parentContact');
  const addStudBtn      = $('addStudent');
  const studentsUl      = $('students');
  const delAllStudBtn   = $('deleteAllStudents');

  const dateIn          = $('dateInput');
  const loadAttBtn      = $('loadAttendance');
  const attListDiv      = $('attendanceList');
  const saveAttBtn      = $('saveAttendance');

  const attResultSec    = $('attendance-result');
  const attResultUl     = $('attendanceResultList');
  const editAttBtn      = $('editAttendanceBtn');
  const shareAttBtn     = $('shareAttendanceBtn');
  const downloadAttBtn  = $('downloadAttendanceBtn');

  const analyticsType   = $('analyticsType');
  const analyticsDate   = $('analyticsDate');
  const analyticsMonth  = $('analyticsMonth');
  const studentFilter   = $('studentFilter');
  const repType         = $('representationType');
  const loadAnalytics   = $('loadAnalytics');
  const resetAnalytics  = $('resetAnalyticsBtn');
  const analyticsCont   = $('analyticsContainer');

  // --- state ---
  let schoolName  = localStorage.getItem('schoolName')     || '';
  let cls         = localStorage.getItem('teacherClass')   || '';
  let sec         = localStorage.getItem('teacherSection') || '';
  let students    = JSON.parse(localStorage.getItem('students'))         || [];
  let attendance  = JSON.parse(localStorage.getItem('attendanceData'))   || {};
  let analyticsChart = null;
  let isEditing   = false, editRoll = null;

  // --- Setup functions ---
  function initSetup(){
    if(!schoolName||!cls||!sec) return;
    dispSchool.textContent  = schoolName;
    dispClass.textContent   = cls;
    dispSection.textContent = sec;
    setupForm.classList.add('hidden');
    setupDisplay.classList.remove('hidden');
    renderStudents();
    populateFilter();
  }

  saveSetupBtn.addEventListener('click', ()=>{
    const s = schoolNameIn.value.trim();
    const c = classSel.value;
    const se= sectionSel.value;
    if(!s||!c||!se) return alert('Enter school, class & section');
    schoolName = s; cls = c; sec = se;
    localStorage.setItem('schoolName', schoolName);
    localStorage.setItem('teacherClass', cls);
    localStorage.setItem('teacherSection', sec);
    initSetup();
  });

  editSetupBtn.addEventListener('click', ()=>{
    setupDisplay.classList.add('hidden');
    setupForm.classList.remove('hidden');
    schoolNameIn.value = schoolName;
    classSel.value     = cls;
    sectionSel.value   = sec;
  });

  // --- Student functions ---
  function renderStudents(){
    studentsUl.innerHTML = '';
    students.filter(s=>s.class===cls&&s.section===sec)
      .forEach(s=>{
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = `${s.roll}. ${s.name}`;
        const grp = document.createElement('div');
        grp.className = 'button-group';

        const eBtn = document.createElement('button');
        eBtn.className = 'small';
        eBtn.textContent = 'Edit';
        eBtn.addEventListener('click', ()=>{
          isEditing = true; editRoll = s.roll;
          nameIn.value    = s.name;
          admIn.value     = s.admissionNo;
          contactIn.value = s.parentContact;
          addStudBtn.textContent = 'Update';
        });

        const dBtn = document.createElement('button');
        dBtn.className = 'small';
        dBtn.textContent = 'Delete';
        dBtn.addEventListener('click', ()=>{
          if(!confirm('Delete?')) return;
          students = students.filter(x=>!(x.roll===s.roll&&x.class===cls&&x.section===sec));
          localStorage.setItem('students', JSON.stringify(students));
          renderStudents();
        });

        grp.append(eBtn, dBtn);
        li.append(span, grp);
        studentsUl.append(li);
      });
  }

  addStudBtn.addEventListener('click', ()=>{
    const nm = nameIn.value.trim();
    if(!nm||!cls) return alert('Enter name & save setup');
    const ad = admIn.value.trim();
    const pc = contactIn.value.trim();
    if(isEditing){
      const stu = students.find(s=>s.roll===editRoll&&s.class===cls&&s.section===sec);
      stu.name = nm; stu.admissionNo = ad; stu.parentContact = pc;
      isEditing = false; addStudBtn.textContent = 'Add';
    } else {
      const rl = students.filter(s=>s.class===cls&&s.section===sec).length+1;
      students.push({roll:rl,name:nm,admissionNo:ad,class:cls,section:sec,parentContact:pc});
    }
    localStorage.setItem('students', JSON.stringify(students));
    nameIn.value = admIn.value = contactIn.value = '';
    renderStudents();
  });

  delAllStudBtn.addEventListener('click', ()=>{
    if(!cls) return alert('Save setup first');
    if(!confirm('Delete all?')) return;
    students = students.filter(s=>!(s.class===cls&&s.section===sec));
    localStorage.setItem('students', JSON.stringify(students));
    renderStudents();
  });

  function populateFilter(){
    studentFilter.innerHTML = '<option value="">All Students</option>';
    students.filter(s=>s.class===cls&&s.section===sec)
      .forEach(s=>{
        const o = document.createElement('option');
        o.value = s.roll; o.textContent = s.name;
        studentFilter.append(o);
      });
  }

  // --- Attendance functions ---
  loadAttBtn.addEventListener('click', ()=>{
    const d = dateIn.value;
    if(!d) return alert('Pick date');
    renderAttendance(d);
  });

  function renderAttendance(d){
    attListDiv.innerHTML = '';
    attendance[d] = attendance[d]||{};
    const day = attendance[d];
    students.filter(s=>s.class===cls&&s.section===sec)
      .forEach(s=>{
        const div = document.createElement('div');
        div.className = 'attendance-item';
        const nd = document.createElement('div');
        nd.className = 'att-name';
        nd.textContent = `${s.roll}. ${s.name}`;

        const act = document.createElement('div');
        act.className = 'attendance-actions';
        const btns = document.createElement('div');
        btns.className = 'attendance-buttons';

        ['P','A','Lt','L','HD'].forEach(code=>{
          const b = document.createElement('button');
          b.className = 'att-btn' + (day[s.roll]===code?` selected ${code}`:'');
          b.textContent = code;
          b.addEventListener('click', ()=>{
            day[s.roll]=code;
            btns.querySelectorAll('button').forEach(x=>x.className='att-btn');
            b.classList.add('selected', code);
          });
          btns.append(b);
        });

        const send = document.createElement('button');
        send.className = 'send-btn';
        send.textContent = 'Send';
        send.addEventListener('click', ()=> showSummary(d));

        act.append(btns, send);
        div.append(nd, act);
        attListDiv.append(div);
      });
  }

  saveAttBtn.addEventListener('click', ()=>{
    const d = dateIn.value;
    if(!d) return alert('Pick date');
    localStorage.setItem('attendanceData', JSON.stringify(attendance));
    showSummary(d);
  });

  // --- Summary ---
  function showSummary(d){
    attResultUl.innerHTML = '';
    const day = attendance[d]||{};
    students.filter(s=>s.class===cls&&s.section===sec)
      .forEach(s=>{
        const li = document.createElement('li');
        li.textContent = `${s.name}: ${day[s.roll]||'Not marked'}`;
        attResultUl.append(li);
      });
    attResultSec.classList.remove('hidden');
    editAttBtn.addEventListener('click', ()=> attResultSec.classList.add('hidden'));
    shareAttBtn.addEventListener('click', ()=> shareSummary(d));
    downloadAttBtn.addEventListener('click', ()=> downloadSummary(d));
  }

  function shareSummary(d){
    const day = attendance[d]||{};
    const lines = students.filter(s=>s.class===cls&&s.section===sec)
      .map(s=>`${s.name}: ${day[s.roll]||'Not marked'}`);
    const text = `${schoolName}\nClass‑Section: ${cls}-${sec}\nDate: ${d}\n\n`+lines.join('\n');
    if(navigator.share) navigator.share({title:schoolName,text});
    else alert('Share not supported');
  }

  function downloadSummary(d){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(schoolName,10,10);
    doc.text(`Class‑Section: ${cls}-${sec}`,10,20);
    doc.text(`Date: ${d}`,10,30);
    const body = students.filter(s=>s.class===cls&&s.section===sec)
      .map(s=>[s.name, attendance[d]?.[s.roll]||'Not marked']);
    doc.autoTable({ head:[['Name','Status']], body, startY:40 });
    doc.save(`Summary_${d}.pdf`);
  }

  // --- Analytics wiring only (kept unchanged) ---
  analyticsType.addEventListener('change', e=>{
    analyticsDate.classList.toggle('hidden', e.target.value!=='date');
    analyticsMonth.classList.toggle('hidden', e.target.value!=='month');
  });
  loadAnalytics.addEventListener('click', ()=>{/* ... your analytics code ... */});
  resetAnalytics.addEventListener('click', ()=>{/* ... */});

  // Initialize
  initSetup();
});
