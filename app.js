// app.js
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // --- Refs ---
  const schoolIn     = $('schoolNameInput');
  const classSel     = $('teacherClassSelect');
  const sectionSel   = $('teacherSectionSelect');
  const saveSetup    = $('saveSetup');
  const editSetup    = $('editSetup');
  const setupForm    = $('setupForm');
  const setupDisp    = $('setupDisplay');
  const dispSchool   = $('dispSchool');
  const dispClass    = $('dispClass');
  const dispSection  = $('dispSection');

  const nameIn       = $('studentName');
  const admIn        = $('admissionNo');
  const contactIn    = $('parentContact');
  const addStud      = $('addStudent');
  const studentsUl   = $('students');
  const delAllStud   = $('deleteAllStudents');

  const dateIn       = $('dateInput');
  const loadAtt      = $('loadAttendance');
  const attList      = $('attendanceList');
  const saveAtt      = $('saveAttendance');

  const attResultSec = $('attendance-result');
  const attResultUl  = $('attendanceResultList');
  const editAtt      = $('editAttendanceBtn');
  const shareAtt     = $('shareAttendanceBtn');
  const downloadAtt  = $('downloadAttendanceBtn');

  const analyticsType    = $('analyticsType');
  const analyticsDateIn  = $('analyticsDate');
  const analyticsMonthIn = $('analyticsMonth');
  const studentFilter    = $('studentFilter');
  const repType          = $('representationType');
  const loadAnalyticsBtn = $('loadAnalytics');
  const resetAnalytics   = $('resetAnalyticsBtn');
  const analyticsCont    = $('analyticsContainer');

  // --- State ---
  let schoolName   = localStorage.getItem('schoolName')     || '';
  let cls          = localStorage.getItem('teacherClass')   || '';
  let sec          = localStorage.getItem('teacherSection') || '';
  let students     = JSON.parse(localStorage.getItem('students'))         || [];
  let attendance   = JSON.parse(localStorage.getItem('attendanceData'))   || {};
  let analyticsChart= null;
  let isEditing    = false, editRoll = null;

  // --- Setup ---
  function initSetup(){
    if(!schoolName||!cls||!sec) return;
    dispSchool.textContent  = schoolName;
    dispClass.textContent   = cls;
    dispSection.textContent = sec;
    setupForm.classList.add('hidden');
    setupDisp.classList.remove('hidden');
    renderStudents();
    populateFilter();
  }

  saveSetup.addEventListener('click', ()=>{
    const s = schoolIn.value.trim(), c = classSel.value, se = sectionSel.value;
    if(!s||!c||!se) return alert('Enter school, class & section');
    schoolName = s; cls = c; sec = se;
    localStorage.setItem('schoolName', schoolName);
    localStorage.setItem('teacherClass', cls);
    localStorage.setItem('teacherSection', sec);
    initSetup();
  });

  editSetup.addEventListener('click', ()=>{
    setupDisp.classList.add('hidden');
    setupForm.classList.remove('hidden');
    schoolIn.value   = schoolName;
    classSel.value   = cls;
    sectionSel.value = sec;
  });

  // --- Students ---
  function renderStudents(){
    studentsUl.innerHTML = '';
    students.filter(s=>s.class===cls&&s.section===sec).forEach(s=>{
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = `${s.roll}. ${s.name}`;
      const grp = document.createElement('div');
      grp.className = 'button-group';
      const e = document.createElement('button');
      e.className='small'; e.textContent='Edit';
      e.addEventListener('click', ()=>{
        isEditing=true; editRoll=s.roll;
        nameIn.value=s.name; admIn.value=s.admissionNo; contactIn.value=s.parentContact;
        addStud.textContent='Update';
      });
      const d = document.createElement('button');
      d.className='small'; d.textContent='Delete';
      d.addEventListener('click', ()=>{
        if(!confirm('Delete?')) return;
        students = students.filter(x=>!(x.roll===s.roll&&x.class===cls&&x.section===sec));
        localStorage.setItem('students', JSON.stringify(students));
        renderStudents();
      });
      grp.append(e,d); li.append(span,grp); studentsUl.append(li);
    });
  }

  addStud.addEventListener('click', ()=>{
    const nm=nameIn.value.trim();
    if(!nm||!cls) return alert('Enter name & save setup');
    const ad=admIn.value.trim(), pc=contactIn.value.trim();
    if(isEditing){
      const stu=students.find(s=>s.roll===editRoll&&s.class===cls&&s.section===sec);
      stu.name=nm; stu.admissionNo=ad; stu.parentContact=pc;
      isEditing=false; addStud.textContent='Add';
    } else {
      const rl=students.filter(s=>s.class===cls&&s.section===sec).length+1;
      students.push({roll:rl,name:nm,admissionNo:ad,class:cls,section:sec,parentContact:pc});
    }
    localStorage.setItem('students', JSON.stringify(students));
    nameIn.value=admIn.value=contactIn.value='';
    renderStudents();
  });

  delAllStud.addEventListener('click', ()=>{
    if(!cls) return alert('Save setup first');
    if(!confirm('Delete all?')) return;
    students = students.filter(s=>!(s.class===cls&&s.section===sec));
    localStorage.setItem('students', JSON.stringify(students));
    renderStudents();
  });

  function populateFilter(){
    studentFilter.innerHTML = '<option value="">All Students</option>';
    students.filter(s=>s.class===cls&&s.section===sec).forEach(s=>{
      const o=document.createElement('option'); o.value=s.roll; o.textContent=s.name;
      studentFilter.append(o);
    });
  }

  // --- Attendance ---
  loadAtt.addEventListener('click', ()=>{
    const d = dateIn.value;
    if(!d) return alert('Pick date');
    renderAttendance(d);
  });

  function renderAttendance(d){
    attList.innerHTML = '';
    attendance[d] = attendance[d]||{};
    const day = attendance[d];
    students.filter(s=>s.class===cls&&s.section===sec).forEach(s=>{
      const div=document.createElement('div'); div.className='attendance-item';
      const nd=document.createElement('div'); nd.className='att-name';
      nd.textContent=`${s.roll}. ${s.name}`;
      const act=document.createElement('div'); act.className='attendance-actions';
      const btns=document.createElement('div'); btns.className='attendance-buttons';
      ['P','A','Lt','L','HD'].forEach(code=>{
        const b=document.createElement('button');
        b.className='att-btn'+(day[s.roll]===code?` selected ${code}`:'');
        b.textContent=code;
        b.addEventListener('click', ()=>{
          day[s.roll]=code;
          btns.querySelectorAll('button').forEach(x=>x.className='att-btn');
          b.classList.add('selected',code);
        });
        btns.append(b);
      });
      const send=document.createElement('button');
      send.className='send-btn'; send.textContent='Send';
      send.addEventListener('click', ()=> showSummary(d));
      act.append(btns, send); div.append(nd, act); attList.append(div);
    });
  }

  saveAtt.addEventListener('click', ()=>{
    const d=dateIn.value;
    if(!d) return alert('Pick date');
    localStorage.setItem('attendanceData', JSON.stringify(attendance));
    showSummary(d);
  });

  // --- Summary ---
  function showSummary(d){
    attResultUl.innerHTML='';
    const day=attendance[d]||{};
    students.filter(s=>s.class===cls&&s.section===sec).forEach(s=>{
      const li=document.createElement('li');
      li.textContent=`${s.name}: ${day[s.roll]||'Not marked'}`;
      attResultUl.append(li);
    });
    $('attendance-section').classList.add('hidden');
    attResultSec.classList.remove('hidden');
    editAtt.addEventListener('click', ()=>{
      attResultSec.classList.add('hidden');
      $('attendance-section').classList.remove('hidden');
    });
    shareAtt.addEventListener('click', ()=> shareSummary(d));
    downloadAtt.addEventListener('click', ()=> downloadSummary(d));
  }

  function shareSummary(d){
    const day=attendance[d]||{};
    const lines=students.filter(s=>s.class===cls&&s.section===sec)
      .map(s=>`${s.name}: ${day[s.roll]||'Not marked'}`);
    const txt=`${schoolName}\nClass‑Section: ${cls}-${sec}\nDate: ${d}\n\n`+lines.join('\n');
    if(navigator.share) navigator.share({title:schoolName,text:txt});
    else alert('Share not supported');
  }

  function downloadSummary(d){
    const { jsPDF }=window.jspdf;
    const doc=new jsPDF();
    doc.text(schoolName,10,10);
    doc.text(`Class‑Section: ${cls}-${sec}`,10,20);
    doc.text(`Date: ${d}`,10,30);
    const body=students.filter(s=>s.class===cls&&s.section===sec)
      .map(s=>[s.name, attendance[d]?.[s.roll]||'Not marked']);
    doc.autoTable({head:[['Name','Status']],body,startY:40});
    doc.save(`Summary_${d}.pdf`);
  }

  // --- Analytics wiring ---
  analyticsType.addEventListener('change', e=>{
    const v=e.target.value;
    analyticsDateIn.classList.toggle('hidden', v!=='date');
    analyticsMonthIn.classList.toggle('hidden', v!=='month');
  });

  loadAnalyticsBtn.addEventListener('click', renderAnalytics);
  resetAnalytics.addEventListener('click', ()=>{
    [analyticsType, analyticsDateIn, analyticsMonthIn, studentFilter, repType, loadAnalyticsBtn]
      .forEach(el=>el.disabled=false);
    resetAnalytics.classList.add('hidden');
    analyticsCont.innerHTML='';
  });

  function renderAnalytics(){
    const type=analyticsType.value;
    const period = type==='date'? analyticsDateIn.value : analyticsMonthIn.value;
    if(!period) return alert('Select period');
    [analyticsType, analyticsDateIn, analyticsMonthIn, studentFilter, repType, loadAnalyticsBtn]
      .forEach(el=>el.disabled=true);
    resetAnalytics.classList.remove('hidden');
    // reuse your previous renderAnalytics logic here...
    // e.g. build table/summary/graph & append to analyticsCont
  }

  // initialize
  initSetup();
});
