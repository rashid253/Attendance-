// ===== app.js =====
const $ = id => document.getElementById(id),
      getText = s => ({P:'Present', A:'Absent', Lt:'Late', L:'Leave', HD:'Half Day'}[s]||'Not Marked');

const schoolName = 'Your School Name';  // ← replace with actual name

let cls    = localStorage.getItem('teacherClass')   || '',
    sec    = localStorage.getItem('teacherSection') || '',
    students   = JSON.parse(localStorage.getItem('students'))    || [],
    attendance = JSON.parse(localStorage.getItem('attendanceData'))||{},
    isEditing  = false,
    editRoll   = null;

// --- Setup ---
function initSetup(){
  if(!cls||!sec) return;
  $('dispClass').textContent = cls;
  $('dispSection').textContent = sec;
  $('teacherClassHeader').textContent = `${cls}-${sec}`;
  $('teacherSetupForm').classList.add('hidden');
  $('teacherSetupDisplay').classList.remove('hidden');
  renderStudents();
  populateStudentFilter();
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
      const txt = document.createElement('span');
      txt.textContent = `${s.roll} - ${s.name}`;
      li.append(txt);

      // Edit
      const editBtn = document.createElement('button');
      editBtn.className = 'icon-button edit-btn';
      editBtn.title = 'Edit';
      editBtn.onclick = ()=>{
        isEditing = true;
        editRoll  = s.roll;
        $('studentName').value = s.name;
        $('admissionNo').value = s.admissionNo;
        $('parentContact').value = s.parentContact;
        $('addStudent').textContent = 'Update';
      };
      li.append(editBtn);

      // Delete
      const delBtn = document.createElement('button');
      delBtn.className = 'icon-button delete-btn';
      delBtn.title = 'Delete';
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
      stu.name = name; stu.admissionNo = adm; stu.parentContact = ph;
    }
    isEditing = false; editRoll = null;
    $('addStudent').textContent = 'Add';
  } else {
    const roll = students.filter(s=>s.class===cls && s.section===sec).length + 1;
    students.push({ roll, name, admissionNo:adm, class:cls, section:sec, parentContact:ph });
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

function populateStudentFilter(){
  const sel = $('studentFilter');
  sel.innerHTML = '<option value="">All Students</option>';
  students.filter(s=>s.class===cls && s.section===sec)
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
  const list = $('attendanceList');
  list.innerHTML = '';
  attendance[d] = attendance[d]||{};
  const day = attendance[d];
  students.filter(s=>s.class===cls && s.section===sec)
    .forEach(s=>{
      const div = document.createElement('div');
      div.className = 'attendance-item';
      div.innerHTML =
        `<span>${s.roll}-${s.name}</span>
         <div class="attendance-buttons">
           ${['P','A','Lt','L','HD'].map(code=>
             `<button class="att-btn${day[s.roll]===code?' selected '+code:''}" data-code="${code}">${code}</button>`
           ).join('')}
         </div>
         <button class="send-btn" data-roll="${s.roll}" data-date="${d}">Send</button>`;
      // mark buttons
      div.querySelectorAll('.att-btn').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          day[s.roll] = btn.dataset.code;
          div.querySelectorAll('.att-btn').forEach(b=>b.className='att-btn');
          btn.classList.add('selected', btn.dataset.code);
        });
      });
      // send per student
      div.querySelector('.send-btn').addEventListener('click', ()=>{
        const code = day[s.roll]||'';
        const status = getText(code);
        let instruction = '';
        switch(code){
          case 'Lt': instruction = `Your child was late on ${d}. Please ensure punctuality and provide a reason.`; break;
          case 'A': instruction = `Your child was absent on ${d}. Please submit a leave application.`; break;
          case 'L': instruction = `Your child was on leave on ${d}. Please provide leave details.`; break;
          case 'HD': instruction = `Your child had a half day on ${d}. Please provide a note.`; break;
          case 'P': instruction = `Your child was present. Keep up the great attendance!`; break;
        }
        const sObj = students.find(x=>x.roll==s.roll);
        const phone = sObj.parentContact.replace(/[^0-9]/g,'');
        const msg =
          `*${schoolName}*\n`+
          `Class-Section: ${cls}-${sec}\n`+
          `Date: ${d}\n`+
          `Student: ${s.name}\n`+
          `Status: ${status}\n\n`+
          instruction;
        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`);
      });
      list.append(div);
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
  const list = $('attendanceResultList');
  list.innerHTML = '';
  const day = attendance[d]||{};
  students.filter(s=>s.class===cls && s.section===sec)
    .forEach(s=>{
      const li = document.createElement('li');
      const code = day[s.roll]||'';
      const txt  = getText(code);
      li.innerHTML = `<span>${s.name}:</span> <span class="status-${code}">${txt}</span>`;
      list.append(li);
    });
  $('attendance-result').classList.remove('hidden');
}
$('editAttendanceBtn').addEventListener('click', ()=>{
  $('attendance-result').classList.add('hidden');
  $('attendance-section').classList.remove('hidden');
});
$('shareAttendanceBtn').addEventListener('click', ()=>{
  const d = $('dateInput').value;
  const day = attendance[d]||{};
  const totals = {P:0,A:0,Lt:0,L:0,HD:0};
  let msg =
    `*${schoolName}*\n`+
    `Class-Section: ${cls}-${sec}\n`+
    `Date: ${d}\n\n`+
    `Totals → Present:${totals.P}, Absent:${totals.A}, Late:${totals.Lt}, HalfDay:${totals.HD}, Leave:${totals.L}\n\n`;
  students.filter(s=>s.class===cls && s.section===sec)
    .forEach(s=>{
      const code = day[s.roll]||'';
      totals[code] = (totals[code]||0)+1;
      msg += `${s.name}: ${getText(code)}\n`;
    });
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`);
});
$('downloadAttendanceBtn').addEventListener('click', ()=>{
  const d = $('dateInput').value;
  const { jsPDF } = window.jspdf, doc = new jsPDF();
  doc.text(`${cls}-${sec} | ${d}`, 10, 10);
  const day = attendance[d]||{};
  const rows = students.filter(s=>s.class===cls && s.section===sec)
    .map(s=>[s.name, getText(day[s.roll]||'')]);
  doc.autoTable({ head:[['Name','Status']], body:rows, startY:20 });
  doc.save(`Attendance_${d}.pdf`);
});

// --- Analytics ---
$('loadAnalytics').addEventListener('click', ()=>{
  renderAnalytics();
  ['analyticsType','analyticsMonth','studentFilter','representationType','loadAnalytics']
    .forEach(id=>$(id).disabled = true);
  $('resetAnalyticsBtn').classList.remove('hidden');
});
$('resetAnalyticsBtn').addEventListener('click', ()=>{
  ['analyticsType','analyticsMonth','studentFilter','representationType','loadAnalytics']
    .forEach(id=>$(id).disabled = false);
  $('resetAnalyticsBtn').classList.add('hidden');
  $('analyticsContainer').innerHTML = '';
});

function renderAnalytics(){
  const type = $('analyticsType').value,
        month= $('analyticsMonth').value,
        stud = $('studentFilter').value,
        rep  = $('representationType').value;
  const dates = getPeriodDates(type, month);
  const data = students.filter(s=>s.class===cls && s.section===sec)
    .filter(s=>!stud||s.roll==stud)
    .map(s=>{
      const cnt = {P:0,A:0,Lt:0,L:0,HD:0};
      dates.forEach(d=>{ const st=attendance[d]?.[s.roll]; if(st) cnt[st]++; });
      const total = dates.length,
            present = cnt.P + cnt.Lt + cnt.HD,
            pct = Math.round(present/total*100);
      return { name:s.name, cnt, pct };
    });
  const cont = $('analyticsContainer'); cont.innerHTML = '';

  // Table or combined
  if(rep==='table'||rep==='all'){
    const tbl = document.createElement('table');
    tbl.border=1; tbl.style.width='100%';
    if(type==='month'){
      const header = '<tr><th>Name</th>' + dates.map(d=>`<th>${d.split('-')[2]}</th>`).join('') + '</tr>';
      const rows   = data.map(r=>{
        let row=`<tr><td>${r.name}</td>`;
        dates.forEach((d,i)=>{
          const code = attendance[d]?.[students.find(x=>x.name===r.name).roll]||'';
          row += `<td>${code}</td>`;
        });
        return row+'</tr>';
      }).join('');
      tbl.innerHTML = header+rows;
    } else {
      tbl.innerHTML =
        '<tr><th>Name</th><th>P</th><th>Lt</th><th>HD</th><th>L</th><th>A</th><th>%</th></tr>' +
        data.map(r=>`<tr><td>${r.name}</td>`+
          [r.cnt.P,r.cnt.Lt,r.cnt.HD,r.cnt.L,r.cnt.A,r.pct+'%']
          .map(v=>`<td>${v}</td>`).join('')+'</tr>'
        ).join('');
    }
    const wrap = document.createElement('div');
    wrap.className='table-container';
    wrap.append(tbl);
    cont.append(wrap);
  }

  // Summary
  if(rep==='summary'||rep==='all'){
    const sumDiv = document.createElement('div');
    sumDiv.className = 'analytics-summary';
    data.forEach(r=>{
      const p = document.createElement('p');
      p.innerHTML =
        `<strong>${r.name}</strong>: ${r.cnt.P} Present, ${r.cnt.Lt} Late, ${r.cnt.HD} Half Day, ${r.cnt.L} Leave, ${r.cnt.A} Absent — <em>${r.pct}%</em>${r.pct<75?' ⚠️ Needs Improvement':r.pct>=90?' ✅ Excellent':''}`;
      sumDiv.append(p);
    });
    cont.append(sumDiv);
  }

  // Graph
  if(rep==='graph'||rep==='all'){
    const canvas = document.createElement('canvas');
    cont.append(canvas);
    if(window.analyticsChart) window.analyticsChart.destroy();
    window.analyticsChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: data.map(r=>r.name),
        datasets: [{ label:'Attendance %', data:data.map(r=>r.pct) }]
      },
      options: { responsive:true }
    });
  }

  // Share & Download (icons)
  if(rep!=='all'){
    const btns = document.createElement('div');
    btns.className = 'row-inline';
    btns.innerHTML =
      `<button id="shareAnalytics" class="icon-button share-btn icon-only" title="Share"></button>`+
      `<button id="downloadAnalytics" class="icon-button download-btn icon-only" title="Download"></button>`;
    cont.append(btns);

    $('shareAnalytics').addEventListener('click', ()=>{
      const totals = data.reduce((t,r)=>{
        t.P+=r.cnt.P; t.A+=r.cnt.A; t.Lt+=r.cnt.Lt; t.L+=r.cnt.L; t.HD+=r.cnt.HD;
        return t;
      }, {P:0,A:0,Lt:0,L:0,HD:0});
      let msg =
        `*${schoolName}*\n`+
        `Class-Section: ${cls}-${sec}\n`+
        `Period: ${type} ${month}\n\n`+
        `Totals → Present:${totals.P}, Absent:${totals.A}, Late:${totals.Lt}, HalfDay:${totals.HD}, Leave:${totals.L}\n\n`;
      data.forEach(r=> msg+=`${r.name}: ${r.pct}%\n`);
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`);
    });

    $('downloadAnalytics').addEventListener('click', ()=>{
      const { jsPDF } = window.jspdf, doc = new jsPDF();
      doc.text('Analytics Report', 10, 10);
      const rows = data.map(r=>[r.name, r.pct+'%']);
      doc.autoTable({ head:[['Name','%']], body:rows, startY:20 });
      doc.save('Analytics.pdf');
    });
  }
}

// --- Helpers ---
function getPeriodDates(type,m){
  const arr = [], now=new Date(), year=now.getFullYear();
  if(type==='month' && /^\d{4}-\d{2}$/.test(m)){
    const [y,mm]=m.split('-'), days=new Date(y,mm,0).getDate();
    for(let d=1;d<=days;d++) arr.push(`${y}-${mm}-${String(d).padStart(2,'0')}`);
  } else if(['semester','sixmonths','year'].includes(type)){
    let start=1, end=12;
    if(type==='semester'){ start=1; end=6; }
    if(type==='sixmonths'){ start=7; end=12; }
    for(let mm=start; mm<=end; mm++){
      const md = String(mm).padStart(2,'0'),
            days=new Date(year,mm,0).getDate();
      for(let d=1; d<=days; d++){
        arr.push(`${year}-${md}-${String(d).padStart(2,'0')}`);
      }
    }
  }
  return arr;
}

// --- Init ---
initSetup();
