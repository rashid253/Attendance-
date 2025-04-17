// app.js
// Helpers & Data Initialization
const $ = id => document.getElementById(id),
      getText = s => ({P:'Present', A:'Absent', Lt:'Late', L:'Leave', HD:'Half Day'}[s] || 'Not Marked');

let cls = localStorage.getItem('teacherClass') || '',
    sec = localStorage.getItem('teacherSection') || '',
    students = JSON.parse(localStorage.getItem('students')) || [],
    attendance = JSON.parse(localStorage.getItem('attendanceData')) || {};

// --- Teacher Setup ---
function initSetup() {
  if (!cls || !sec) return;
  $('dispClass').textContent = cls;
  $('dispSection').textContent = sec;
  $('teacherClassHeader').textContent = `${cls}-${sec}`;
  $('teacherSetupForm').classList.add('hidden');
  $('teacherSetupDisplay').classList.remove('hidden');
  renderStudents();
  populateStudentFilter();
}

$('saveTeacherClass').onclick = () => {
  const c = $('teacherClassSelect').value,
        s = $('teacherSectionSelect').value;
  if (!c || !s) return alert('Select class & section');
  cls = c; sec = s;
  localStorage.setItem('teacherClass', c);
  localStorage.setItem('teacherSection', s);
  initSetup();
};

$('editTeacherSetup').onclick = () => {
  $('teacherSetupForm').classList.remove('hidden');
  $('teacherSetupDisplay').classList.add('hidden');
};

// --- Student Registration ---
function renderStudents() {
  $('students').innerHTML = '';
  students.filter(s => s.class===cls && s.section===sec)
          .forEach(s => {
    const li = document.createElement('li');
    li.textContent = `${s.roll}-${s.name}`;
    $('students').append(li);
  });
}

$('addStudent').onclick = () => {
  const name = $('studentName').value.trim();
  if (!name || !cls) return alert('Enter name & save class');
  const roll = students.filter(s => s.class===cls && s.section===sec).length + 1;
  students.push({
    roll,
    name,
    admissionNo: $('admissionNo').value.trim(),
    class: cls,
    section: sec,
    parentContact: $('parentContact').value.trim()
  });
  localStorage.setItem('students', JSON.stringify(students));
  $('studentName').value = $('admissionNo').value = $('parentContact').value = '';
  initSetup();
};

function populateStudentFilter() {
  const sel = $('studentFilter');
  sel.innerHTML = '<option value="">All Students</option>';
  students.filter(s => s.class===cls && s.section===sec)
          .forEach(s => {
    const o = document.createElement('option');
    o.value = s.roll;
    o.textContent = s.name;
    sel.append(o);
  });
}

// --- Attendance Marking ---
$('loadAttendance').onclick = () => {
  const d = $('dateInput').value;
  if (!d) return alert('Pick a date');
  renderAttendance(d);
};

function renderAttendance(d) {
  $('attendanceList').innerHTML = '';
  const day = attendance[d] = attendance[d] || {};
  students.filter(s => s.class===cls && s.section===sec)
    .forEach(s => {
      const div = document.createElement('div');
      div.className = 'attendance-item';
      div.innerHTML =
        `<span>${s.roll}-${s.name}</span>
         <div class="attendance-buttons">
           ${['P','A','Lt','L','HD'].map(code =>
             `<button class="att-btn${day[s.roll]===code?' selected':''}" data-code="${code}">${code}</button>`
           ).join('')}
         </div>`;
      div.querySelectorAll('button').forEach(btn =>
        btn.onclick = () => {
          day[s.roll] = btn.dataset.code;
          div.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        }
      );
      $('attendanceList').append(div);
    });
}

$('saveAttendance').onclick = () => {
  const d = $('dateInput').value;
  if (!d) return alert('Pick a date');
  localStorage.setItem('attendanceData', JSON.stringify(attendance));
  showAttendanceResult(d);
};

// --- Attendance Result ---
function showAttendanceResult(d) {
  $('attendance-section').classList.add('hidden');
  const list = $('attendanceResultList');
  list.innerHTML = '';
  const day = attendance[d] || {};
  students.filter(s => s.class===cls && s.section===sec)
    .forEach(s => {
      const li = document.createElement('li');
      li.textContent = `${s.name}: ${getText(day[s.roll]||'')}`;
      list.append(li);
    });
  $('attendance-result').classList.remove('hidden');
}

$('editAttendanceBtn').onclick = () => {
  $('attendance-result').classList.add('hidden');
  $('attendance-section').classList.remove('hidden');
};

$('shareAttendanceBtn').onclick = () => {
  let msg = '', d = $('dateInput').value, day = attendance[d]||{};
  students.filter(s => s.class===cls && s.section===sec)
    .forEach(s => msg += `${s.name}: ${getText(day[s.roll]||'')}\n`);
  window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(msg));
};

$('downloadAttendanceBtn').onclick = () => {
  const d = $('dateInput').value;
  const { jsPDF } = window.jspdf, doc = new jsPDF();
  doc.text(`Attendance for ${d} (${cls}-${sec})`, 10, 10);
  let y = 20, day = attendance[d]||{};
  students.filter(s => s.class===cls && s.section===sec)
    .forEach(s => {
      doc.text(`${s.name}: ${getText(day[s.roll]||'')}`, 10, y);
      y += 10;
    });
  doc.save(`Attendance_${d}.pdf`);
};

// --- Analytics ---
$('loadAnalytics').onclick = renderAnalytics;

function renderAnalytics() {
  const type = $('analyticsType').value,
        month = $('analyticsMonth').value,
        stud = $('studentFilter').value,
        rep = $('representationType').value;
  const dates = getPeriodDates(type, month);
  const data = [];

  students.filter(s => s.class===cls && s.section===sec)
    .filter(s => !stud || s.roll==stud)
    .forEach(s => {
      const cnt = {P:0,A:0,Lt:0,L:0,HD:0}, total = dates.length;
      dates.forEach(d => {
        const st = attendance[d]?.[s.roll];
        if (st) cnt[st]++;
      });
      const present = cnt.P + cnt.Lt + cnt.HD;
      const pct = Math.round(present/total*100);
      data.push({ name: s.name, ...cnt, total, pct });
    });

  const cont = $('analyticsContainer');
  cont.innerHTML = '';

  if (rep === 'table') {
    const tbl = document.createElement('table');
    tbl.style.width = '100%';
    tbl.border = 1;
    const hdr = ['Name','P','Lt','HD','L','A','%'];
    tbl.innerHTML =
      '<tr>' + hdr.map(h => `<th>${h}</th>`).join('') + '</tr>' +
      data.map(r =>
        `<tr>${[r.name,r.P,r.Lt,r.HD,r.L,r.A,r.pct+'%']
          .map(v=>`<td>${v}</td>`).join('')}</tr>`
      ).join('');
    cont.append(tbl);
  }

  if (rep === 'summary') {
    data.forEach(r => {
      const p = document.createElement('p');
      p.innerHTML =
        `<strong>${r.name}</strong>: ${r.P} Present, ${r.Lt} Late, ${r.HD} Half Day, ${r.L} Leave, ${r.A} Absent — <em>${r.pct}%</em> ${suggestion(r.pct)}`;
      cont.append(p);
    });
  }

  if (rep === 'graph') {
    const canvas = document.createElement('canvas');
    cont.append(canvas);
    new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: data.map(r => r.name),
        datasets: [{ label: 'Attendance %', data: data.map(r => r.pct) }]
      },
      options: { responsive: true }
    });
  }

  // Share & Download buttons
  const btns = document.createElement('div');
  btns.className = 'row-inline';
  btns.innerHTML =
    '<button id="shareAnalytics">Share</button>' +
    '<button id="downloadAnalytics">Download PDF</button>';
  cont.append(btns);

  $('shareAnalytics').onclick = () => {
    let msg = 'Analytics:\n';
    data.forEach(r => msg += `${r.name}: ${r.pct}%\n`);
    window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(msg));
  };

  $('downloadAnalytics').onclick = () => {
    const { jsPDF } = window.jspdf, doc = new jsPDF();
    doc.text('Analytics Report', 10, 10);
    const rows = data.map(r => [r.name, r.pct + '%']);
    doc.autoTable({ head: [['Name','%']], body: rows, startY: 20 });
    doc.save('Analytics.pdf');
  };
}

function getPeriodDates(type, m) {
  const arr = [];
  const now = new Date(), year = now.getFullYear();
  if (type === 'month') {
    const [y, mm] = m.split('-'), days = new Date(y, mm, 0).getDate();
    for (let d = 1; d <= days; d++) {
      arr.push(`${y}-${mm}-${String(d).padStart(2,'0')}`);
    }
  } else if (type === 'semester') {
    // Jan–Jun
    for (let mm = 1; mm <= 6; mm++) {
      const days = new Date(year, mm, 0).getDate();
      for (let d = 1; d <= days; d++) {
        arr.push(`${year}-${String(mm).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
      }
    }
  } else if (type === 'sixmonths') {
    // Jul–Dec
    for (let mm = 7; mm <= 12; mm++) {
      const days = new Date(year, mm, 0).getDate();
      for (let d = 1; d <= days; d++) {
        arr.push(`${year}-${String(mm).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
      }
    }
  } else if (type === 'year') {
    for (let mm = 1; mm <= 12; mm++) {
      const days = new Date(year, mm, 0).getDate();
      for (let d = 1; d <= days; d++) {
        arr.push(`${year}-${String(mm).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
      }
    }
  }
  return arr;
}

function suggestion(p) {
  if (p < 75) return '⚠️ Needs Improvement';
  if (p >= 90) return '✅ Excellent';
  return '';
}

// Initialize on load
initSetup();
