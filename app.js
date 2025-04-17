// app.js

const $ = id => document.getElementById(id);
let schoolName = localStorage.getItem('schoolName') || '';
let cls         = localStorage.getItem('teacherClass')   || '';
let sec         = localStorage.getItem('teacherSection') || '';
let students    = JSON.parse(localStorage.getItem('students'))    || [];
let attendance  = JSON.parse(localStorage.getItem('attendanceData'))|| {};
let analyticsChart = null;
let isEditing   = false, editRoll = null;

// --- Setup ---
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
  const s = $('#schoolNameInput').value.trim();
  const c = $('#teacherClassSelect').value;
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
  $('#schoolNameInput').value = schoolName;
  $('#teacherClassSelect').value = cls;
  $('#teacherSectionSelect').value = sec;
};

// --- Student Registration ---
function renderStudents() {
  const ul = $('#students');
  ul.innerHTML = '';
  students.filter(s=>s.class===cls && s.section===sec)
    .forEach(s => {
      const li = document.createElement('li');
      const name = document.createElement('span');
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
  students.filter(s=>s.class===cls && s.section===sec)
    .forEach(s => {
      const o = document.createElement('option');
      o.value = s.roll; o.textContent = s.name;
      sel.append(o);
    });
}

// --- Attendance Marking ---
$('#loadAttendance').onclick = () => {
  const d = $('#dateInput').value;
  if (!d) return alert('Pick date');
  renderAttendance(d);
};

function renderAttendance(date) {
  $('#attendanceList').innerHTML = '';
  attendance[date] = attendance[date] || {};
  const day = attendance[date];

  students.filter(s=>s.class===cls && s.section===sec)
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

// --- Attendance Summary ---
function showSummary(date) {
  $('#attendance-section').classList.add('hidden');
  const ul = $('#attendanceResultList');
  ul.innerHTML = '';
  const day = attendance[date]||{};
  students.filter(s=>s.class===cls && s.section===sec)
    .forEach(s => {
      const li = document.createElement('li');
      li.textContent = `${s.name}: ${day[s.roll]||'Not marked'}`;
      ul.append(li);
    });
  $('#attendance-result').classList.remove('hidden');
}
$('#editAttendanceBtn').onclick = () => {
  $('#attendance-result').classList.add('hidden');
  $('#attendance-section').classList.remove('hidden');
};
$('#downloadAttendanceBtn').onclick = () => downloadSummary($('#dateInput').value);

// share summary via Web Share API
function shareSummary(date) {
  const day = attendance[date]||{};
  const lines = students.filter(s=>s.class===cls&&s.section===sec)
    .map(s=>`${s.name}: ${day[s.roll]||'Not marked'}`);
  const text = `${schoolName}\nClass‑Section: ${cls}-${sec}\nDate: ${date}\n\n` + lines.join('\n');
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

// --- Analytics ---
$('#analyticsType').onchange = e => {
  const v = e.target.value;
  $('#analyticsDate').classList.toggle('hidden', v!=='date');
  $('#analyticsMonth').classList.toggle('hidden', v!=='month');
};
$('#loadAnalytics').onclick = () => {
  renderAnalytics();
  ['analyticsType','analyticsDate','analyticsMonth','studentFilter','representationType','loadAnalytics']
    .forEach(id=>$(id).disabled = true);
  $('#resetAnalyticsBtn').classList.remove('hidden');
};
$('#resetAnalyticsBtn').onclick = () => {
  ['analyticsType','analyticsDate','analyticsMonth','studentFilter','representationType','loadAnalytics']
    .forEach(id=>$(id).disabled = false);
  $('#resetAnalyticsBtn').classList.add('hidden');
  $('#analyticsContainer').innerHTML = '';
};

function renderAnalytics() {
  const type = $('#analyticsType').value;
  const period = type==='date'? $('#analyticsDate').value : $('#analyticsMonth').value;
  const stud   = $('#studentFilter').value;
  const rep    = $('#representationType').value;
  if (!period) return alert('Select period');

  const dates = (type==='date'? [period] : getPeriodDates(type, period));
  const data = students.filter(s=>s.class===cls && s.section===sec)
    .filter(s=>!stud||s.roll==stud)
    .map(s => {
      const cnt = {P:0,A:0,Lt:0,L:0,HD:0};
      dates.forEach(d => { const st = attendance[d]?.[s.roll]; if(st) cnt[st]++; });
      const pct = Math.round((cnt.P+cnt.Lt+cnt.HD)/dates.length*100);
      return { name: s.name, cnt, pct };
    });

  const cont = $('#analyticsContainer');
  cont.innerHTML = '';

  // TABLE view (including monthly register)
  if (rep==='table'||rep==='all') {
    const tbl = document.createElement('table');
    tbl.border = 1; tbl.style.width='100%';
    if (type==='month') {
      const days = dates.map(d=>d.split('-')[2]);
      const head = ['Name', ...days];
      const rows = students.filter(s=>s.class===cls&&s.section===sec)
        .map(s=> [s.name, ...dates.map(d=>attendance[d]?.[s.roll]||'–')] );
      docTable(tbl, head, rows);
    } else {
      const head = ['Name','P','Lt','HD','L','A','%'];
      const rows = data.map(r=>[r.name, r.cnt.P, r.cnt.Lt, r.cnt.HD, r.cnt.L, r.cnt.A, r.pct+'%']);
      docTable(tbl, head, rows);
    }
    const wrap = document.createElement('div');
    wrap.className='table-container'; wrap.append(tbl);
    cont.append(wrap);
  }

  // SUMMARY view
  if (rep==='summary'||rep==='all') {
    data.forEach(r => {
      const p = document.createElement('p');
      p.textContent = `${r.name}: ${r.cnt.P}P, ${r.cnt.Lt}Lt, ${r.cnt.HD}H, ${r.cnt.L}L, ${r.cnt.A}A — ${r.pct}%`;
      cont.append(p);
    });
  }

  // GRAPH view
  if (rep==='graph'||rep==='all') {
    const canvas = document.createElement('canvas');
    cont.append(canvas);
    if (analyticsChart) analyticsChart.destroy();
    analyticsChart = new Chart(canvas.getContext('2d'), {
      type:'bar',
      data:{ labels:data.map(r=>r.name), datasets:[{ label:'%', data:data.map(r=>r.pct) }] },
      options:{ responsive:true }
    });
    const btn = document.createElement('button');
    btn.className='small'; btn.textContent='Download Graph';
    btn.onclick = ()=> {
      const url = analyticsChart.toBase64Image();
      const a = document.createElement('a');
      a.href = url; a.download = `Chart_${period}.png`;
      a.click();
    };
    cont.append(btn);
  }

  // SHARE/DOWNLOAD buttons
  if (rep!=='all') {
    const wrap = document.createElement('div');
    wrap.className='row-inline';

    const share = document.createElement('button');
    share.className='small';
    share.textContent='Share';
    share.onclick = () => {
      const text = buildShareText(type, period, data, dates);
      if (navigator.share) navigator.share({ title: schoolName, text });
      else alert('Share not supported');
    };

    const dl = document.createElement('button');
    dl.className='small';
    dl.textContent='Download';
    dl.onclick = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF(type==='month'?'l':'p','pt','a4');
      doc.text(schoolName, 20, 20);
      if (type==='month') {
        const head = ['Name', ...dates.map(d=>d.split('-')[2])];
        const rows = students.filter(s=>s.class===cls&&s.section===sec)
          .map(s=> [s.name, ...dates.map(d=>attendance[d]?.[s.roll]||'–')] );
        doc.autoTable({ head:[head], body:rows, startY:40, styles:{fontSize:8}, headStyles:{fillColor:[33,150,243]} });
        doc.save(`Register_${period}.pdf`);
      } else {
        const rows = data.map(r=>[r.name, r.pct+'%']);
        doc.autoTable({ head:[['Name','%']], body:rows, startY:40 });
        doc.save(`Report_${period}.pdf`);
      }
    };

    wrap.append(share, dl);
    cont.append(wrap);
  }
}

// Helpers
function docTable(tbl, head, rows) {
  const tr = document.createElement('tr');
  head.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; tr.append(th); });
  tbl.append(tr);
  rows.forEach(r=> {
    const row = document.createElement('tr');
    r.forEach(c=>{ const td=document.createElement('td'); td.textContent=c; row.append(td); });
    tbl.append(row);
  });
}

function buildShareText(type, period, data, dates) {
  let text = `${schoolName}\nClass‑Section: ${cls}-${sec}\n`;
  if (type==='date') {
    text += `Date: ${period}\n\n` +
      data.map(r=>`${r.name}: ${attendance[period]?.[students.find(s=>s.name===r.name).roll]||'–'}`).join('\n');
  } else if (type==='month') {
    text += `Register ${period}\n\n` +
      students.filter(s=>s.class===cls&&s.section===sec)
        .map(s=>`${s.name}: ${dates.map(d=>attendance[d]?.[s.roll]||'–').join(' ')}`).join('\n');
  } else {
    text += `Period: ${type} ${period}\n\n` +
      data.map(r=>`${r.name}: ${r.pct}% (${r.cnt.P}P,${r.cnt.Lt}Lt,${r.cnt.HD}H,${r.cnt.L}L,${r.cnt.A}A)`).join('\n');
  }
  return text;
}

function getPeriodDates(type, m) {
  const arr = [], now=new Date(), year=now.getFullYear();
  if (type==='month' && /^\d{4}-\d{2}$/.test(m)) {
    const [y,mo]=m.split('-'), days=new Date(y,mo,0).getDate();
    for (let d=1; d<=days; d++) arr.push(`${y}-${mo}-${String(d).padStart(2,'0')}`);
  }
  else if (type==='year' && /^\d{4}$/.test(m)) {
    for (let mo=1; mo<=12; mo++) {
      const mm=String(mo).padStart(2,'0'),
            days=new Date(m,mo,0).getDate();
      for (let d=1; d<=days; d++) arr.push(`${m}-${mm}-${String(d).padStart(2,'0')}`);
    }
  }
  else {
    const [start,end] = type==='semester'? [1,6]: [7,12];
    for (let mo=start; mo<=end; mo++) {
      const mm=String(mo).padStart(2,'0'),
            days=new Date(year,mo,0).getDate();
      for (let d=1; d<=days; d++) arr.push(`${year}-${mm}-${String(d).padStart(2,'0')}`);
    }
  }
  return arr;
}

// Init
initSetup();
