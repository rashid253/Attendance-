// app.js
const $ = id => document.getElementById(id),
      getText = s => ({P:'Present', A:'Absent', Lt:'Late', L:'Leave', HD:'Half Day'}[s]||'Not Marked');

const schoolName = 'Your School Name';

let cls    = localStorage.getItem('teacherClass')   || '',
    sec    = localStorage.getItem('teacherSection') || '',
    students   = JSON.parse(localStorage.getItem('students'))    || [],
    attendance = JSON.parse(localStorage.getItem('attendanceData'))|| {},
    isEditing  = false, editRoll = null;

// --- Setup ---
function initSetup(){
  if(!cls||!sec) return;
  $('dispClass').textContent = cls;
  $('dispSection').textContent = sec;
  $('teacherClassHeader').textContent = `${cls}-${sec}`;
  $('teacherSetupForm').classList.add('hidden');
  $('teacherSetupDisplay').classList.remove('hidden');
  renderStudents();
  populateFilter();
}
$('saveTeacherClass').addEventListener('click', ()=>{
  const c = $('teacherClassSelect').value,
        s = $('teacherSectionSelect').value;
  if(!c||!s) return alert('Select class & section');
  cls = c; sec = s;
  localStorage.setItem('teacherClass', c);
  localStorage.setItem('teacherSection', s);
  initSetup();
});
$('editTeacherSetup').addEventListener('click', ()=>{
  $('teacherSetupForm').classList.remove('hidden');
  $('teacherSetupDisplay').classList.add('hidden');
});

// --- Students ---
function renderStudents(){
  const ul = $('students');
  ul.innerHTML = '';
  students
    .filter(s=>s.class===cls && s.section===sec)
    .forEach(s=>{
      const li = document.createElement('li');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = `${s.roll} - ${s.name}`;
      li.append(nameSpan);

      const editBtn = document.createElement('button');
      editBtn.className='small';
      editBtn.textContent='Edit';
      editBtn.onclick = ()=>{
        isEditing = true;
        editRoll = s.roll;
        $('studentName').value      = s.name;
        $('admissionNo').value      = s.admissionNo;
        $('parentContact').value    = s.parentContact;
        $('addStudent').textContent = 'Update';
      };
      li.append(editBtn);

      const delBtn = document.createElement('button');
      delBtn.className='small';
      delBtn.textContent='Delete';
      delBtn.onclick = ()=>{
        if(!confirm('Delete this student?')) return;
        students = students.filter(x=>!(x.roll===s.roll && x.class===cls && x.section===sec));
        localStorage.setItem('students', JSON.stringify(students));
        initSetup();
      };
      li.append(delBtn);

      ul.append(li);
    });
}
$('addStudent').addEventListener('click', ()=>{
  const name = $('studentName').value.trim();
  if(!name||!cls) return alert('Enter name & save class');
  const adm = $('admissionNo').value.trim(),
        ph  = $('parentContact').value.trim();

  if(isEditing){
    const stu = students.find(s=>s.roll===editRoll && s.class===cls && s.section===sec);
    if(stu){
      stu.name = name;
      stu.admissionNo = adm;
      stu.parentContact = ph;
    }
    isEditing = false;
    editRoll = null;
    $('addStudent').textContent='Add';
  } else {
    const roll = students.filter(s=>s.class===cls && s.section===sec).length + 1;
    students.push({roll, name, admissionNo:adm, class:cls, section:sec, parentContact:ph});
  }

  localStorage.setItem('students', JSON.stringify(students));
  $('studentName').value = $('admissionNo').value = $('parentContact').value = '';
  initSetup();
});
$('deleteAllStudents').addEventListener('click', ()=>{
  if(!cls) return alert('Save class first');
  if(!confirm('Delete all students?')) return;
  students = students.filter(s=>!(s.class===cls && s.section===sec));
  localStorage.setItem('students', JSON.stringify(students));
  initSetup();
});

function populateFilter(){
  const sel = $('studentFilter');
  sel.innerHTML = '<option value="">All Students</option>';
  students
    .filter(s=>s.class===cls && s.section===sec)
    .forEach(s=>{
      const o = document.createElement('option');
      o.value = s.roll;
      o.textContent = s.name;
      sel.append(o);
    });
}

// --- Attendance Marking ---
$('loadAttendance').addEventListener('click', ()=>{
  const d = $('dateInput').value;
  if(!d) return alert('Pick date');
  renderAttendance(d);
});
function renderAttendance(d){
  $('attendanceList').innerHTML = '';
  attendance[d] = attendance[d] || {};
  const day = attendance[d];

  students
    .filter(s=>s.class===cls && s.section===sec)
    .forEach(s=>{
      const div = document.createElement('div');
      div.className = 'attendance-item';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'att-name';
      nameDiv.textContent = `${s.roll}-${s.name}`;

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'attendance-actions';

      const btnsDiv = document.createElement('div');
      btnsDiv.className = 'attendance-buttons';

      ['P','A','Lt','L','HD'].forEach(code=>{
        const b = document.createElement('button');
        b.className = `att-btn${day[s.roll]===code ? ' selected '+code : ''}`;
        b.textContent = code;
        b.onclick = ()=>{
          day[s.roll] = code;
          btnsDiv.querySelectorAll('button').forEach(bb=>bb.className='att-btn');
          b.classList.add('selected', code);
        };
        btnsDiv.append(b);
      });

      const sendBtn = document.createElement('button');
      sendBtn.className = 'send-btn';
      sendBtn.textContent = 'Send';
      sendBtn.onclick = ()=>{
        const code = day[s.roll] || '',
              status = getText(code);
        const instr = {
          Lt:`Your child was late on ${d}. Please ensure punctuality.`,
          A:`Your child was absent on ${d}. Please submit leave.`,
          L:`Your child was on leave on ${d}. Please provide details.`,
          HD:`Half day on ${d}. Please send note.`,
          P:`Present on ${d}. Good attendance!`
        }[code] || '';
        const phone = s.parentContact.replace(/[^0-9]/g,'');
        const msg = `*${schoolName}*\nClass-Section: ${cls}-${sec}\nDate: ${d}\nStudent: ${s.name}\nStatus: ${status}\n\n${instr}`;
        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`);
      };

      actionsDiv.append(btnsDiv, sendBtn);
      div.append(nameDiv, actionsDiv);
      $('attendanceList').append(div);
    });
}

$('saveAttendance').addEventListener('click', ()=>{
  const d = $('dateInput').value;
  if(!d) return alert('Pick date');
  localStorage.setItem('attendanceData', JSON.stringify(attendance));
  showAttendanceResult(d);
});

// --- Attendance Result ---
function showAttendanceResult(d){
  $('attendance-section').classList.add('hidden');
  const ul = $('attendanceResultList');
  ul.innerHTML = '';
  const day = attendance[d] || {};
  students
    .filter(s=>s.class===cls && s.section===sec)
    .forEach(s=>{
      const li = document.createElement('li');
      const code = day[s.roll] || '';
      li.innerHTML = `<span>${s.name}:</span> <span class="status-${code}">${getText(code)}</span>`;
      ul.append(li);
    });
  $('attendance-result').classList.remove('hidden');
}

$('editAttendanceBtn').addEventListener('click', ()=>{
  $('attendance-result').classList.add('hidden');
  $('attendance-section').classList.remove('hidden');
});

$('shareAttendanceBtn').addEventListener('click', ()=>{
  const d = $('dateInput').value, day = attendance[d] || {},
        totals = {P:0,A:0,Lt:0,L:0,HD:0};
  let msg = `*${schoolName}*\nClass-Section: ${cls}-${sec}\nDate: ${d}\n\n`;
  students.filter(s=>s.class===cls && s.section===sec).forEach(s=>{
    const c = day[s.roll] || '';
    totals[c] = (totals[c]||0) + 1;
    msg += `${s.name}: ${getText(c)}\n`;
  });
  msg = `Totals → P:${totals.P}, A:${totals.A}, Lt:${totals.Lt}, HD:${totals.HD}, L:${totals.L}\n\n` + msg;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`);
});

$('downloadAttendanceBtn').addEventListener('click', ()=>{
  const d = $('dateInput').value;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const day = attendance[d] || {};
  const rows = students
    .filter(s=>s.class===cls && s.section===sec)
    .map(s=>[s.name, getText(day[s.roll]||'')]);

  doc.text(`${cls}-${sec} | ${d}`, 10, 10);
  doc.autoTable({
    head: [['Name','Status']],
    body: rows,
    startY: 20
  });
  doc.save(`Attendance_${d}.pdf`);
});

// --- Analytics ---
$('analyticsType').addEventListener('change', e=>{
  const v = e.target.value;
  $('analyticsDate').classList.toggle('hidden', v!=='date');
  $('analyticsMonth').classList.toggle('hidden', v!=='month');
});

$('loadAnalytics').addEventListener('click', ()=>{
  renderAnalytics();
  ['analyticsType','analyticsDate','analyticsMonth','studentFilter','representationType','loadAnalytics']
    .forEach(id=>$(id).disabled=true);
  $('resetAnalyticsBtn').classList.remove('hidden');
});

$('resetAnalyticsBtn').addEventListener('click', ()=>{
  ['analyticsType','analyticsDate','analyticsMonth','studentFilter','representationType','loadAnalytics']
    .forEach(id=>$(id).disabled=false);
  $('resetAnalyticsBtn').classList.add('hidden');
  $('analyticsContainer').innerHTML = '';
});

function renderAnalytics(){
  const type = $('analyticsType').value,
        period = type==='date' ? $('analyticsDate').value : $('analyticsMonth').value,
        stud  = $('studentFilter').value,
        rep   = $('representationType').value;

  if(!period) return alert('Select period');
  const dates = type==='date'
    ? [period]
    : getPeriodDates(type, period);

  const data = students
    .filter(s=>s.class===cls && s.section===sec)
    .filter(s=>!stud||s.roll==stud)
    .map(s=>{
      const cnt = {P:0,A:0,Lt:0,L:0,HD:0};
      dates.forEach(d=>{
        const st = attendance[d]?.[s.roll];
        if(st) cnt[st]++;
      });
      const total = dates.length,
            pct   = Math.round((cnt.P + cnt.Lt + cnt.HD) / total * 100);
      return {name:s.name, cnt, pct};
    });

  const cont = $('analyticsContainer');
  cont.innerHTML = '';

  if(rep==='table'||rep==='all'){
    const tbl = document.createElement('table');
    tbl.border = 1;
    tbl.style.width = '100%';

    if(type==='month'){
      const days = dates.map(d=>d.split('-')[2]);
      tbl.innerHTML = `<tr><th>Name</th>${days.map(d=>`<th>${d}</th>`).join('')}</tr>` +
        data.map(r=>{
          let row = `<tr><td>${r.name}</td>`;
          dates.forEach(d=>{
            const code = attendance[d]?.[students.find(x=>x.name===r.name).roll]||'';
            row += `<td>${code}</td>`;
          });
          return row + '</tr>';
        }).join('');
    } else {
      tbl.innerHTML = `<tr><th>Name</th><th>P</th><th>Lt</th><th>HD</th><th>L</th><th>A</th><th>%</th></tr>` +
        data.map(r=>`<tr><td>${r.name}</td>` +
          [r.cnt.P, r.cnt.Lt, r.cnt.HD, r.cnt.L, r.cnt.A, r.pct+'%']
            .map(v=>`<td>${v}</td>`).join('') +
        '</tr>').join('');
    }

    const wrap = document.createElement('div');
    wrap.className = 'table-container';
    wrap.append(tbl);
    cont.append(wrap);
  }

  if(rep==='summary'||rep==='all'){
    data.forEach(r=>{
      const p = document.createElement('p');
      p.innerHTML = `<strong>${r.name}</strong>: ${r.cnt.P} Present, ${r.cnt.Lt} Late, ${r.cnt.HD} Half Day, ${r.cnt.L} Leave, ${r.cnt.A} Absent — <em>${r.pct}%</em>` +
        (r.pct<75 ? ' ⚠️ Needs Improvement' : r.pct>=90 ? ' ✅ Excellent' : '');
      cont.append(p);
    });
  }

  if(rep==='graph'||rep==='all'){
    const canvas = document.createElement('canvas');
    cont.append(canvas);
    if(window.analyticsChart) window.analyticsChart.destroy();
    window.analyticsChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: data.map(r=>r.name),
        datasets: [{label: '%', data: data.map(r=>r.pct)}]
      },
      options: { responsive: true }
    });
  }

  if(rep!=='all'){
    const btns = document.createElement('div');
    btns.className = 'row-inline';

    const share = document.createElement('button');
    share.className = 'small';
    share.textContent = 'Share';
    share.onclick = ()=>{
      let msg = `*${schoolName}*\nClass-Section: ${cls}-${sec}\nPeriod: ${type} ${period}\n\n`;
      data.forEach(r=> msg += `${r.name}: ${r.pct}%\n`);
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`);
    };

    const dl = document.createElement('button');
    dl.className = 'small';
    dl.textContent = 'Download';
    dl.onclick = ()=>{
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const rows = data.map(r=>[r.name, r.pct + '%']);
      doc.text('Report', 10, 10);
      doc.autoTable({ head: [['Name','%']], body: rows, startY: 20 });
      doc.save('Report.pdf');
    };

    btns.append(share, dl);
    cont.append(btns);
  }
}

function getPeriodDates(type, m){
  const arr = [], now = new Date(), year = now.getFullYear();
  if(type==='month' && /^\d{4}-\d{2}$/.test(m)){
    const [y, mm] = m.split('-'),
          days = new Date(y, mm, 0).getDate();
    for(let d=1; d<=days; d++){
      arr.push(`${y}-${mm}-${String(d).padStart(2,'0')}`);
    }
  } else if(type==='year' && /^\d{4}$/.test(m)){
    for(let mm=1; mm<=12; mm++){
      const md = String(mm).padStart(2,'0'),
            days = new Date(m, mm, 0).getDate();
      for(let d=1; d<=days; d++){
        arr.push(`${m}-${md}-${String(d).padStart(2,'0')}`);
      }
    }
  } else if(type==='semester' || type==='sixmonths'){
    const start = type==='semester'?1:7, end = type==='semester'?6:12;
    for(let mm=start; mm<=end; mm++){
      const md = String(mm).padStart(2,'0'),
            days = new Date(year, mm, 0).getDate();
      for(let d=1; d<=days; d++){
        arr.push(`${year}-${md}-${String(d).padStart(2,'0')}`);
      }
    }
  }
  return arr;
}

// Initialize
initSetup();
