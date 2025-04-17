// app.js (fixed)

const $ = id => document.getElementById(id);

let schoolName    = localStorage.getItem('schoolName') || '';
let cls           = localStorage.getItem('teacherClass')   || '';
let sec           = localStorage.getItem('teacherSection') || '';
let students      = JSON.parse(localStorage.getItem('students'))    || [];
let attendance    = JSON.parse(localStorage.getItem('attendanceData'))|| {};
let analyticsChart = null;
let isEditing     = false, editRoll = null;

// --- SETUP ---
function initSetup() {
  if (!schoolName || !cls || !sec) return;
  $('#dispSchool').textContent  = schoolName;
  $('#dispClass').textContent   = cls;
  $('#dispSection').textContent = sec;
  $('#setupForm').classList.add('hidden');
  $('#setupDisplay').classList.remove('hidden');
  renderStudents();
  populateFilter();
}

$('#saveSetup').onclick = () => {
  const s    = $('#schoolNameInput').value.trim();
  const c    = $('#teacherClassSelect').value;
  const secv = $('#teacherSectionSelect').value;
  if (!s || !c || !secv) return alert('Enter school, class & section');
  schoolName = s; cls = c; sec = secv;
  localStorage.setItem('schoolName', schoolName);
  localStorage.setItem('teacherClass', cls);
  localStorage.setItem('teacherSection', sec);
  initSetup();
};

$('#editSetup').onclick = () => {
  $('#setupDisplay').classList.add('hidden');
  $('#setupForm').classList.remove('hidden');
  $('#schoolNameInput').value      = schoolName;
  $('#teacherClassSelect').value   = cls;
  $('#teacherSectionSelect').value = sec;
};

// --- STUDENT REGISTRATION ---
function renderStudents() {
  const ul = $('#students');
  ul.innerHTML = '';
  students
    .filter(s=>s.class===cls && s.section===sec)
    .forEach(s => {
      const li    = document.createElement('li');
      const name  = document.createElement('span');
      name.textContent = `${s.roll}. ${s.name}`;
      const group = document.createElement('div');
      group.className = 'button-group';

      const edit = document.createElement('button');
      edit.className = 'small';
      edit.textContent = 'Edit';
      edit.onclick = () => {
        isEditing = true; editRoll = s.roll;
        $('#studentName').value   = s.name;
        $('#admissionNo').value   = s.admissionNo;
        $('#parentContact').value = s.parentContact;
        $('#addStudent').textContent = 'Update';
      };

      const del = document.createElement('button');
      del.className = 'small';
      del.textContent = 'Delete';
      del.onclick = () => {
        if (!confirm('Delete this student?')) return;
        students = students.filter(x => !(x.roll===s.roll && x.class===cls && x.section===sec));
        localStorage.setItem('students', JSON.stringify(students));
        renderStudents();
      };

      group.append(edit, del);
      li.append(name, group);
      ul.append(li);
    });
}

$('#addStudent').onclick = () => {
  const name = $('#studentName').value.trim();
  if (!name || !cls) return alert('Enter name & save setup');
  const adm = $('#admissionNo').value.trim();
  const ph  = $('#parentContact').value.trim();
  if (isEditing) {
    const stu = students.find(s=>s.roll===editRoll && s.class===cls && s.section===sec);
    stu.name = name; stu.admissionNo = adm; stu.parentContact = ph;
    isEditing = false; $('#addStudent').textContent = 'Add';
  } else {
    const roll = students.filter(s=>s.class===cls && s.section===sec).length + 1;
    students.push({ roll, name, admissionNo: adm, class: cls, section: sec, parentContact: ph });
  }
  localStorage.setItem('students', JSON.stringify(students));
  $('#studentName').value = $('#admissionNo').value = $('#parentContact').value = '';
  renderStudents();
};

$('#deleteAllStudents').onclick = () => {
  if (!cls) return alert('Save setup first');
  if (!confirm('Delete all?')) return;
  students = students.filter(s=>!(s.class===cls && s.section===sec));
  localStorage.setItem('students', JSON.stringify(students));
  renderStudents();
};

function populateFilter() {
  const sel = $('#studentFilter');
  sel.innerHTML = '<option value="">All Students</option>';
  students
    .filter(s=>s.class===cls && s.section===sec)
    .forEach(s => {
      const o = document.createElement('option');
      o.value = s.roll; o.textContent = s.name;
      sel.append(o);
    });
}

// --- ATTENDANCE MARKING ---
$('#loadAttendance').onclick = () => {
  const d = $('#dateInput').value;
  if (!d) return alert('Pick date');
  renderAttendance(d);
};

function renderAttendance(date) {
  $('#attendanceList').innerHTML = '';
  attendance[date] = attendance[date] || {};
  const day = attendance[date];

  students.filter(s=>s.class===cls&&s.section===sec)
    .forEach(s => {
      const div = document.createElement('div');
      div.className = 'attendance-item';
      const name = document.createElement('div');
      name.className = 'att-name';
      name.textContent = `${s.roll}. ${s.name}`;

      const actions = document.createElement('div');
      actions.className = 'attendance-actions';
      const btns = document.createElement('div');
      btns.className = 'attendance-buttons';

      ['P','A','Lt','L','HD'].forEach(code => {
        const b = document.createElement('button');
        b.className = 'att-btn' + (day[s.roll]===code?` selected ${code}`:'');
        b.textContent = code;
        b.onclick = () => {
          day[s.roll] = code;
          btns.querySelectorAll('button').forEach(x=>x.className='att-btn');
          b.classList.add('selected', code);
        };
        btns.append(b);
      });

      const send = document.createElement('button');
      send.className = 'send-btn';
      send.textContent = 'Send';
      send.onclick = () => shareSummary(date);

      actions.append(btns, send);
      div.append(name, actions);
      $('#attendanceList').append(div);
    });
}

$('#saveAttendance').onclick = () => {
  const d = $('#dateInput').value;
  if (!d) return alert('Pick date');
  localStorage.setItem('attendanceData', JSON.stringify(attendance));
  showSummary(d);
};

// --- ATTENDANCE SUMMARY ---
function showSummary(date) {
  $('#attendance-section').classList.add('hidden');
  const ul = $('#attendanceResultList');
  ul.innerHTML = '';
  const day = attendance[date]||{};
  students.filter(s=>s.class===cls&&s.section===sec)
    .forEach(s => {
      const li = document.createElement('li');
      li.textContent = `${s.name}: ${day[s.roll]||'Not marked'}`;
      ul.append(li);
    });
  $('#attendance-result').classList.remove('hidden');

  // bind summary share/download
  $('#shareAttendanceBtn').onclick    = () => shareSummary(date);
  $('#downloadAttendanceBtn').onclick = () => downloadSummary(date);
}

$('#editAttendanceBtn').onclick = () => {
  $('#attendance-result').classList.add('hidden');
  $('#attendance-section').classList.remove('hidden');
};

function shareSummary(date) {
  const day = attendance[date]||{};
  const lines = students.filter(s=>s.class===cls&&s.section===sec)
    .map(s=>`${s.name}: ${day[s.roll]||'Not marked'}`);
  const text = `${schoolName}\nClass‑Section: ${cls}-${sec}\nDate: ${date}\n\n`+lines.join('\n');
  if (navigator.share) {
    navigator.share({ title: schoolName, text });
  } else {
    alert('Share not supported on this browser.');
  }
}

function downloadSummary(date) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text(schoolName, 10, 10);
  doc.text(`Class‑Section: ${cls}-${sec}`, 10, 20);
  doc.text(`Date: ${date}`, 10, 30);
  const body = students.filter(s=>s.class===cls&&s.section===sec)
    .map(s=>[s.name, attendance[date]?.[s.roll]||'Not marked']);
  doc.autoTable({ head:[['Name','Status']], body, startY: 40 }); 
  doc.save(`Summary_${date}.pdf`);
}

// --- ANALYTICS (unchanged bindings for Load/Reset) ---

// ... keep your existing renderAnalytics, helpers, etc., unchanged ...

// Init
initSetup();
