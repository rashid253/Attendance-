// app.js
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // --- Setup ---
  const saveSetupBtn     = $('saveSetup');
  const editSetupBtn     = $('editSetup');
  const setupForm        = $('setupForm');
  const setupDisplay     = $('setupDisplay');
  const dispSchool       = $('dispSchool');
  const dispClass        = $('dispClass');
  const dispSection      = $('dispSection');
  const schoolNameInput  = $('schoolNameInput');
  const teacherClassSel  = $('teacherClassSelect');
  const teacherSectionSel= $('teacherSectionSelect');

  // --- Registration ---
  const studentNameIn    = $('studentName');
  const admissionNoIn    = $('admissionNo');
  const parentContactIn  = $('parentContact');
  const addStudentBtn    = $('addStudent');
  const studentsList     = $('students');
  const deleteAllBtn     = $('deleteAllStudents');
  const studentFilter    = $('studentFilter');

  // --- Attendance ---
  const dateInput        = $('dateInput');
  const loadAttendanceBtn= $('loadAttendance');
  const attendanceList   = $('attendanceList');
  const saveAttendanceBtn= $('saveAttendance');
  const attendanceResult = $('attendance-result');
  const attendanceResultList = $('attendanceResultList');
  const shareAttendBtn   = $('shareAttendanceBtn');
  const downloadAttendBtn= $('downloadAttendanceBtn');

  // --- Analytics ---
  const analyticsType     = $('analyticsType');
  const analyticsDateIn   = $('analyticsDate');
  const analyticsMonthIn  = $('analyticsMonth');
  const analyticsSemester = $('analyticsSemester');
  const analyticsYearIn   = $('analyticsYear');
  const repType           = $('representationType');
  const loadAnalyticsBtn  = $('loadAnalytics');
  const resetAnalyticsBtn = $('resetAnalyticsBtn');
  const analyticsContainer= $('analyticsContainer');
  const analyticsActions  = $('analyticsActions');
  const shareAnalyticsBtn = $('shareAnalytics');
  const downloadAnalyticsBtn = $('downloadAnalytics');

  const THRESHOLD = 75;

  // --- Data ---
  let schoolName = localStorage.getItem('schoolName') || '';
  let cls        = localStorage.getItem('teacherClass') || '';
  let sec        = localStorage.getItem('teacherSection') || '';
  let students   = JSON.parse(localStorage.getItem('students')) || [];
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || {};
  let chart;

  // Render setup display or form
  function renderSetup() {
    if (schoolName && cls && sec) {
      dispSchool.textContent  = schoolName;
      dispClass.textContent   = cls;
      dispSection.textContent = sec;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    } else {
      setupForm.classList.remove('hidden');
      setupDisplay.classList.add('hidden');
    }
  }

  // Setup handlers
  saveSetupBtn.addEventListener('click', () => {
    schoolName = schoolNameInput.value.trim();
    cls        = teacherClassSel.value;
    sec        = teacherSectionSel.value;
    if (!schoolName || !cls || !sec) return alert('Fill all setup fields');
    localStorage.setItem('schoolName', schoolName);
    localStorage.setItem('teacherClass', cls);
    localStorage.setItem('teacherSection', sec);
    renderSetup();
  });
  editSetupBtn.addEventListener('click', () => {
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  });

  // Populate student list UI and filter
  function renderStudentList() {
    studentsList.innerHTML = '';
    studentFilter.innerHTML = '<option value="">All Students</option>';
    students.forEach(s => {
      const li = document.createElement('li');
      li.textContent = `${s.name} (${s.roll})`;
      studentsList.appendChild(li);
      const opt = document.createElement('option');
      opt.value = s.roll;
      opt.textContent = s.name;
      studentFilter.appendChild(opt);
    });
  }

  // Registration handlers
  addStudentBtn.addEventListener('click', () => {
    const name = studentNameIn.value.trim();
    const roll = admissionNoIn.value.trim() || Date.now();
    if (!name) return alert('Enter student name');
    const newStudent = { name, roll, class: cls, section: sec };
    students.push(newStudent);
    localStorage.setItem('students', JSON.stringify(students));
    studentNameIn.value = '';
    admissionNoIn.value = '';
    parentContactIn.value = '';
    renderStudentList();
  });
  deleteAllBtn.addEventListener('click', () => {
    if (!confirm('Delete all students?')) return;
    students = [];
    localStorage.removeItem('students');
    renderStudentList();
  });

  // Attendance rendering
  function renderAttendanceInputs() {
    attendanceList.innerHTML = '';
    const date = dateInput.value;
    if (!date) return alert('Select a date');
    if (!attendanceData[date]) attendanceData[date] = {};
    students
      .filter(s => s.class === cls && s.section === sec)
      .forEach(s => {
        const div = document.createElement('div');
        div.className = 'attendance-row';
        div.innerHTML = `<span>${s.name}</span>`;
        ['P','A','Lt','HD','L'].forEach(code => {
          const btn = document.createElement('button');
          btn.textContent = code;
          btn.className = 'att-btn';
          if (attendanceData[date][s.roll] === code) btn.classList.add('selected');
          btn.addEventListener('click', () => {
            if (attendanceData[date][s.roll] === code) {
              delete attendanceData[date][s.roll];
              btn.classList.remove('selected');
            } else {
              attendanceData[date][s.roll] = code;
              div.querySelectorAll('.att-btn').forEach(b => b.classList.remove('selected'));
              btn.classList.add('selected');
            }
          });
          div.appendChild(btn);
        });
        attendanceList.appendChild(div);
      });
  }
  loadAttendanceBtn.addEventListener('click', renderAttendanceInputs);

  // Save attendance
  saveAttendanceBtn.addEventListener('click', () => {
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    attendanceResultList.innerHTML = '';
    const date = dateInput.value;
    if (!date) return alert('Select a date');
    const dayData = attendanceData[date] || {};
    students
      .filter(s => s.class === cls && s.section === sec)
      .forEach(s => {
        const li = document.createElement('li');
        const status = dayData[s.roll] || 'Not marked';
        li.textContent = `${s.name}: ${status}`;
        attendanceResultList.appendChild(li);
      });
    $('attendance-section').classList.add('hidden');
    attendanceResult.classList.remove('hidden');
  });

  // Summary share/download
  shareAttendBtn.addEventListener('click', () => {
    const date = dateInput.value;
    let text = `${schoolName} ${cls}-${sec} Attendance ${date}\n`;
    attendanceResultList.querySelectorAll('li').forEach(li => text += li.textContent + '\n');
    if (navigator.share) navigator.share({ text });
    else alert(text);
  });
  downloadAttendBtn.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 20;
    doc.text(`${schoolName} ${cls}-${sec} Attendance ${dateInput.value}`, 20, y);
    y += 10;
    attendanceResultList.querySelectorAll('li').forEach(li => {
      doc.text(li.textContent, 20, y);
      y += 7;
    });
    doc.save(`Attendance_${dateInput.value}.pdf`);
  });

  // --- Analytics code unchanged ---
  analyticsType.addEventListener('change', () => {
    [analyticsDateIn, analyticsMonthIn, analyticsSemester, analyticsYearIn]
      .forEach(el => el.classList.add('hidden'));
    const v = analyticsType.value;
    if (v==='date')     analyticsDateIn.classList.remove('hidden');
    if (v==='month')    analyticsMonthIn.classList.remove('hidden');
    if (v==='semester') analyticsSemester.classList.remove('hidden');
    if (v==='year')     analyticsYearIn.classList.remove('hidden');
  });
  loadAnalyticsBtn.addEventListener('click', renderAnalytics);
  resetAnalyticsBtn.addEventListener('click', () => {
    [analyticsType, analyticsDateIn, analyticsMonthIn, analyticsSemester, analyticsYearIn, studentFilter, repType, loadAnalyticsBtn]
      .forEach(el => { el.disabled=false; el.classList.remove('hidden'); });
    resetAnalyticsBtn.classList.add('hidden');
    analyticsActions.classList.add('hidden');
    analyticsContainer.innerHTML = '';
  });

  // Initial render
  renderSetup();
  renderStudentList();
});
