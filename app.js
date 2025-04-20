// app.js
window.addEventListener('DOMContentLoaded', () => {
  // jsPDF constructor from UMD bundle
  const { jsPDF } = window.jspdf;

  // Helper to fetch element by ID
  const $ = id => document.getElementById(id);

  // Color mapping for attendance codes
  const colors = {
    P: 'var(--success)',
    A: 'var(--danger)',
    Lt: 'var(--warning)',
    HD: 'var(--orange)',
    L: 'var(--info)'
  };

  // 1. SETUP
  const schoolIn       = $('schoolNameInput');
  const classSel       = $('teacherClassSelect');
  const secSel         = $('teacherSectionSelect');
  const saveSetup      = $('saveSetup');
  const setupForm      = $('setupForm');
  const setupDisplay   = $('setupDisplay');
  const setupText      = $('setupText');
  const editSetup      = $('editSetup');

  function loadSetup() {
    const school = localStorage.getItem('schoolName');
    const cls    = localStorage.getItem('teacherClass');
    const sec    = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value    = school;
      classSel.value    = cls;
      secSel.value      = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }
  saveSetup.addEventListener('click', e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) {
      alert('Complete setup first');
      return;
    }
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  });
  editSetup.addEventListener('click', e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  });
  loadSetup();

  // 2. STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const studentNameIn       = $('studentName');
  const admissionNoIn       = $('admissionNo');
  const parentNameIn        = $('parentName');
  const parentContactIn     = $('parentContact');
  const parentOccIn         = $('parentOccupation');
  const parentAddrIn        = $('parentAddress');
  const addStudentBtn       = $('addStudent');
  const studentsBody        = $('studentsBody');
  const selectAll           = $('selectAllStudents');
  const editSelBtn          = $('editSelected');
  const deleteSelBtn        = $('deleteSelected');
  const saveRegBtn          = $('saveRegistration');
  const shareRegBtn         = $('shareRegistration');
  const editRegBtn          = $('editRegistration');
  const downloadRegBtn      = $('downloadRegistrationPDF');
  const studentTableWrapper = $('studentTableWrapper');
  let regSaved = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }
  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => cb.onchange = () => {
      cb.closest('tr').classList.toggle('selected', cb.checked);
      const any = boxes.some(x => x.checked);
      editSelBtn.disabled = deleteSelBtn.disabled = !any;
    });
    selectAll.disabled = regSaved;
    selectAll.onchange = () => {
      if (!regSaved) boxes.forEach(cb => (cb.checked = selectAll.checked, cb.onchange()));
    };
  }
  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved?'disabled':''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved?'<button class="share-one">Share</button>':''}</td>`;
      if (regSaved) {
        tr.querySelector('.share-one').onclick = e => {
          e.preventDefault();
          const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
          const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
        };
      }
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }

  addStudentBtn.addEventListener('click', e => {
    e.preventDefault();
    const name    = studentNameIn.value.trim();
    const adm     = admissionNoIn.value.trim();
    const parent  = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occ     = parentOccIn.value.trim();
    const addr    = parentAddrIn.value.trim();
    if (!name||!adm||!parent||!contact||!occ||!addr) {
      alert('All fields are required'); return;
    }
    if (!/^[0-9]+$/.test(adm)) { alert('Admission No must be numeric'); return; }
    if (students.some(s=>s.adm===adm)) { alert('Admission No already exists'); return; }
    if (!/^[0-9]{7,15}$/.test(contact)) { alert('Contact must be 7-15 digits'); return; }
    students.push({name,adm,parent,contact,occupation:occ,address:addr,roll:Date.now()});
    saveStudents(); renderStudents();
    [studentNameIn,admissionNoIn,parentNameIn,parentContactIn,parentOccIn,parentAddrIn].forEach(i=>i.value='');
  });

  saveRegBtn.addEventListener('click', e => {
    e.preventDefault(); regSaved=true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegBtn.classList.remove('hidden');
    studentTableWrapper.classList.add('saved'); renderStudents();
  });

  editRegBtn.addEventListener('click', e => {
    e.preventDefault(); regSaved=false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegBtn.classList.add('hidden');
    studentTableWrapper.classList.remove('saved'); renderStudents();
  });

  shareRegBtn.addEventListener('click', e => {
    e.preventDefault();
    const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s=>`Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines.join('\n---\n'))}`);
  });

  downloadRegBtn.addEventListener('click', e => {
    e.preventDefault();
    const doc = new jsPDF('p','pt','a4');
    doc.autoTable({
      head: [['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY:40, margin:{left:40,right:40}, styles:{fontSize:10}
    });
    doc.save('students_registration.pdf');
  });

  renderStudents();

  // 3. MARK ATTENDANCE
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');
  const dateInput  = $('dateInput');
  const loadAtt    = $('loadAttendance');
  const attList    = $('attendanceList');
  const saveAtt    = $('saveAttendance');

  loadAtt.addEventListener('click', e => {
    e.preventDefault(); if(!dateInput.value){alert('Select a date');return;}
    attList.innerHTML='';
    students.forEach(s=>{
      const row = document.createElement('div'); row.className='attendance-item'; row.textContent=s.name;
      const btns= document.createElement('div'); btns.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button'); b.type='button'; b.className='att-btn'; b.dataset.code=code; b.textContent=code;
        if(attendanceData[dateInput.value]?.[s.roll]===code){b.style.background=colors[code];b.style.color='#fff';}
        b.addEventListener('click',()=>{
          btns.querySelectorAll('.att-btn').forEach(x=>{x.style.background='';x.style.color='var(--dark)';});
          b.style.background=colors[code];b.style.color='#fff';
        });
        btns.appendChild(b);
      });
      attList.appendChild(row);
      attList.appendChild(btns);
    });
    saveAtt.classList.remove('hidden');
  });

  saveAtt.addEventListener('click', e=>{
    e.preventDefault();
    const d=dateInput.value; attendanceData[d]={};
    document.querySelectorAll('.attendance-actions').forEach((btns,idx)=>{
      const sel=btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[idx].roll]=sel?sel.dataset.code:'A';
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    $('attendance-section').classList.add('hidden');
    $('attendance-result').classList.remove('hidden');
  });

  $('shareAttendanceSummary').addEventListener('click', e=>{
    e.preventDefault();
    const d=dateInput.value;
    const hdr=`Date: ${d}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const map={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'};
    const lines=students.map(s=>`${s.name}: ${map[attendanceData[d][s.roll]||'A']}`);
    window.open(`mailto:?body=${encodeURIComponent(hdr+'\n\n'+lines.join('\n'))}`);
  });

  $('downloadAttendancePDF').addEventListener('click', e=>{
    e.preventDefault();
    const doc=new jsPDF('p','pt','a4');
    doc.autoTable({
      head:[['Name','Status']],
      body:students.map(s=>{
        const code=attendanceData[dateInput.value]?.[s.roll]||'A';
        return [s.name,{P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]];
      }),
      startY:40, margin:{left:40,right:40}, styles:{fontSize:10}
    });
    doc.save('attendance_summary.pdf');
  });

  // 4. ANALYTICS (handlers same until download)
  const analyticsTarget  = $('analyticsTarget');
  const studentAdmInput  = $('studentAdmInput');
  const analyticsType    = $('analyticsType');
  const analyticsDate    = $('analyticsDate');
  const analyticsMonth   = $('analyticsMonth');
  const semesterStart    = $('semesterStart');
  const semesterEnd      = $('semesterEnd');
  const yearStart        = $('yearStart');
  const loadAnalytics    = $('loadAnalytics');
  const resetAnalytics   = $('resetAnalytics');
  const instructionsEl   = $('instructions');
  const analyticsContainer = $('analyticsContainer');
  const graphsEl         = $('graphs');
  const analyticsActions = $('analyticsActions');
  const shareAnalyticsBtn= $('shareAnalytics');
  const downloadAnalyticsBtn = $('downloadAnalytics');
  let barChart, pieChart;

  analyticsTarget.addEventListener('change',()=>{ studentAdmInput.classList.toggle('hidden',analyticsTarget.value==='class'); });
  analyticsType.addEventListener('change',()=>{
    [analyticsDate,analyticsMonth,semesterStart,semesterEnd,yearStart].forEach(el=>el.classList.add('hidden'));
    if(analyticsType.value==='date') analyticsDate.classList.remove('hidden');
    if(analyticsType.value==='month') analyticsMonth.classList.remove('hidden');
    if(analyticsType.value==='semester'){semesterStart.classList.remove('hidden');semesterEnd.classList.remove('hidden');}
    if(analyticsType.value==='year') yearStart.classList.remove('hidden');
    resetAnalytics.classList.remove('hidden');
  });

  loadAnalytics.addEventListener('click', e=>{
    e.preventDefault();
    // ... existing logic builds stats, table, barChart, pieChart ...
  });

  shareAnalyticsBtn.addEventListener('click', ()=>{
    // ... existing share logic ...
  });

  downloadAnalyticsBtn.addEventListener('click', e=>{
    e.preventDefault();
    const doc = new jsPDF('p','pt','a4');
    doc.setFontSize(14);
    doc.text(localStorage.getItem('schoolName'), 40, 30);
    doc.setFontSize(12);
    doc.text(`Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`, 40, 45);
    doc.text(instructionsEl.textContent, 40, 60);

    doc.autoTable({
      head: [['Name','P','A','Lt','HD','L','Total','%']],
      body: Array.from(document.querySelectorAll('#analyticsContainer tbody tr')).map(tr =>
        Array.from(tr.cells).map(td => td.textContent)
      ),
      startY: 75, margin: {left:40, right:40}, styles:{fontSize:8}
    });

    const y = doc.lastAutoTable.finalY + 10;
    const w = 120, h = 80;
    if (barChart) {
      doc.addImage(barChart.canvas.toDataURL('image/png'), 'PNG', 40, y, w, h);
    }
    if (pieChart) {
      doc.addImage(pieChart.canvas.toDataURL('image/png'), 'PNG', 40 + w + 20, y, w, h);
    }

    doc.save('analytics_report.pdf');
  });

  // 5. ATTENDANCE REGISTER
  const registerMonth      = $('registerMonth');
  const loadRegister       = $('loadRegister');
  const changeRegister     = $('changeRegister');
  const registerTableWrapper   = $('registerTableWrapper');
  const registerBody       = $('registerBody');
  const registerSummaryBody= $('registerSummaryBody');
  const shareRegister      = $('shareRegister');
  const downloadRegisterPDF= $('downloadRegisterPDF');

  loadRegister.addEventListener('click', e=>{
    e.preventDefault();
    if (!registerMonth.value) { alert('Select month'); return; }
    const [year, month] = registerMonth.value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // header
    const headRow = document.querySelector('#registerTable thead tr');
    while (headRow.children.length > 3) headRow.removeChild(headRow.lastChild);
    for (let d=1; d<=daysInMonth; d++) {
      const th=document.createElement('th'); th.textContent=d; headRow.appendChild(th);
    }

    // body
    registerBody.innerHTML='';
    students.forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1; d<=daysInMonth; d++){
        const date=`${registerMonth.value}-${String(d).padStart(2,'0')}`;
        const code=attendanceData[date]?.[s.roll]||'';
        const td=document.createElement('td'); td.textContent=code;
        if (code) td.style.background=colors[code];
        tr.appendChild(td);
      }
      registerBody.appendChild(tr);
    });

    // summary
    registerSummaryBody.innerHTML='';
    students.forEach(s=>{
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      for (let d=1; d<=daysInMonth; d++){
        const date=`${registerMonth.value}-${String(d).padStart(2,'0')}`;
        const code=attendanceData[date]?.[s.roll]||'A';
        stats[code]++;
      }
      const total=daysInMonth;
      const pct= total?((stats.P/total)*100).toFixed(1):'0.0';
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${stats.P}</td><td>${stats.A}</td><td>${stats.Lt}</td><td>${stats.HD}</td><td>${stats.L}</td><td>${pct}</td>`;
      registerSummaryBody.appendChild(tr);
    });

    registerTableWrapper.classList.remove('hidden');
    document.getElementById('registerSummarySection').classList.remove('hidden');
    changeRegister.classList.remove('hidden');
  });

  downloadRegisterPDF.addEventListener('click', e=>{
    e.preventDefault();
    const doc=new jsPDF('l','pt','a4');
    doc.setFontSize(14);
    doc.text(localStorage.getItem('schoolName'),40,30);
    doc.setFontSize(12);
    doc.text(`Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`,40,45);
    doc.text(`Attendance Register: ${registerMonth.value}`,40,60);

    const days=Array.from(document.querySelectorAll('#registerTable thead th')).slice(3).map(th=>th.textContent);
    const body=Array.from(document.querySelectorAll('#registerTable tbody tr')).map(tr=>
      Array.from(tr.cells).map(td=>td.textContent)
    );

    doc.autoTable({
      head: [['Sr#','Adm#','Name', ...days]],
      body: body,
      startY:75,
      margin:{left:10,right:10},
      styles:{fontSize:6},
      columnStyles:{
        0:{cellWidth:20},
        1:{cellWidth:30},
        2:{cellWidth:60},
        ...days.reduce((a,_,i)=>{a[i+3]={cellWidth:10};return a;},{})
      }
    });

    doc.autoTable({
      head:[['Name','P','A','Lt','HD','L','%']],
      body:Array.from(document.querySelectorAll('#registerSummaryBody tr')).map(r=>
        Array.from(r.cells).map(td=>td.textContent)
      ),
      startY:doc.lastAutoTable.finalY+20,
      margin:{left:40,right:40},
      styles:{fontSize:8}
    });

    doc.save('attendance_register.pdf');
  });

});
