// ===== app.js =====
const $ = id => document.getElementById(id),
      getText = s => ({P:'Present', A:'Absent', Lt:'Late', L:'Leave', HD:'Half Day'}[s]||'Not Marked');

const schoolName = 'Your School Name';

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
  populateFilters();
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
  students.filter(s=>s.class===cls && s.section===sec)
    .forEach(s=>{
      const li = document.createElement('li'),
            txt = document.createElement('span');
      txt.textContent = `${s.roll} - ${s.name}`;
      li.append(txt);

      // Edit
      const eb = document.createElement('button');
      eb.className = 'icon-button edit-btn';
      eb.title = 'Edit';
      eb.onclick = ()=> {
        isEditing = true; editRoll = s.roll;
        $('studentName').value = s.name;
        $('admissionNo').value = s.admissionNo;
        $('parentContact').value = s.parentContact;
        $('addStudent').textContent = 'Update';
      };
      li.append(eb);

      // Delete
      const db = document.createElement('button');
      db.className = 'icon-button delete-btn';
      db.title = 'Delete';
      db.onclick = ()=> {
        if(!confirm('Delete this student?')) return;
        students = students.filter(x=>!(x.roll===s.roll && x.class===cls && x.section===sec));
        localStorage.setItem('students', JSON.stringify(students));
        initSetup();
      };
      li.append(db);

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
    if(stu) { stu.name=name; stu.admissionNo=adm; stu.parentContact=ph; }
    isEditing=false; editRoll=null; $('addStudent').textContent='Add';
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

// populate both analytics & principal filters
function populateFilters(){
  ['studentFilter','prStudentFilter'].forEach(id=>{
    const sel = $(id);
    sel.innerHTML = '<option value="">All Students</option>';
    students.filter(s=>s.class===cls && s.section===sec)
      .forEach(s=>{
        const o = document.createElement('option');
        o.value = s.roll; o.textContent = `${s.roll} - ${s.name}`;
        sel.append(o);
      });
  });
}

// --- Attendance Marking ---
$('loadAttendance').addEventListener('click', ()=> {
  const d = $('dateInput').value;
  if(!d) return alert('Pick date');
  renderAttendance(d);
});
function renderAttendance(d){
  $('attendanceList').innerHTML = '';
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
        btn.onclick = ()=>{
          day[s.roll] = btn.dataset.code;
          div.querySelectorAll('.att-btn').forEach(b=>b.className='att-btn');
          btn.classList.add('selected', btn.dataset.code);
        };
      });
      // send per student
      div.querySelector('.send-btn').onclick = ()=>{
        const code = day[s.roll]||'',
              status = getText(code),
              instr = ({
                Lt:`Your child was late on ${d}. Please ensure punctuality and provide a reason.`,
                A: `Your child was absent on ${d}. Please submit a leave application.`,
                L: `Your child was on leave on ${d}. Please provide leave details.`,
                HD:`Your child had a half day on ${d}. Please provide a note.`,
                P: `Your child was present. Keep up the great attendance!`
              }[code]||''),
              sObj = students.find(x=>x.roll==s.roll),
              phone = sObj.parentContact.replace(/[^0-9]/g,''),
              msg =
                `*${schoolName}*\n`+
                `Class-Section: ${cls}-${sec}\n`+
                `Date: ${d}\n`+
                `Student: ${s.name}\n`+
                `Status: ${status}\n\n`+
                instr;
        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`);
      };
      $('attendanceList').append(div);
    });
}
$('saveAttendance').addEventListener('click', ()=> {
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
      const li = document.createElement('li'),
            code = day[s.roll]||'',
            txt  = getText(code);
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
  const d = $('dateInput').value,
        day = attendance[d]||{},
        totals = {P:0,A:0,Lt:0,L:0,HD:0};
  let msg =
    `*${schoolName}*\n`+
    `Class-Section: ${cls}-${sec}\n`+
    `Date: ${d}\n\n`;
  students.filter(s=>s.class===cls && s.section===sec)
    .forEach(s=>{
      const code = day[s.roll]||'';
      totals[code] = (totals[code]||0)+1;
      msg += `${s.name}: ${getText(code)}\n`;
    });
  msg = `Totals → P:${totals.P}, A:${totals.A}, Lt:${totals.Lt}, HD:${totals.HD}, L:${totals.L}\n\n` + msg;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`);
});
$('downloadAttendanceBtn').addEventListener('click', ()=>{
  const d = $('dateInput').value,
        { jsPDF } = window.jspdf,
        doc = new jsPDF(),
        day = attendance[d]||{},
        rows = students.filter(s=>s.class===cls && s.section===sec)
          .map(s=>[s.name, getText(day[s.roll]||'')]);
  doc.text(`${cls}-${sec} | ${d}`, 10, 10);
  doc.autoTable({ head:[['Name','Status']], body:rows, startY:20 });
  doc.save(`Attendance_${d}.pdf`);
});

// --- Analytics ---
$('loadAnalytics').addEventListener('click', ()=>{
  renderAnalytics('analyticsContainer','resetAnalyticsBtn','loadAnalytics');
  ['analyticsType','analyticsMonth','studentFilter','representationType','loadAnalytics']
    .forEach(id=>$(id).disabled=true);
  $('resetAnalyticsBtn').classList.remove('hidden');
});
$('resetAnalyticsBtn').addEventListener('click', ()=>{
  ['analyticsType','analyticsMonth','studentFilter','representationType','loadAnalytics']
    .forEach(id=>$(id).disabled=false);
  $('resetAnalyticsBtn').classList.add('hidden');
  $('analyticsContainer').innerHTML='';
});

// --- Principal Requests ---
$('prPeriodType').addEventListener('change', e => {
  const v = e.target.value;
  $('prDate').classList.toggle('hidden', v!=='date');
  $('prMonth').classList.toggle('hidden', v!=='month');
  $('prYear').classList.toggle('hidden', v!=='year');
});
$('prLoad').addEventListener('click', ()=>{
  renderAnalytics('prContainer','prReset','prLoad','prPeriodType','prDate','prMonth','prYear','prStudentFilter','prRepresentationType');
  ['prPeriodType','prDate','prMonth','prYear','prStudentFilter','prRepresentationType','prLoad']
    .forEach(id=>$(id).disabled=true);
  $('prReset').classList.remove('hidden');
});
$('prReset').addEventListener('click', ()=>{
  ['prPeriodType','prDate','prMonth','prYear','prStudentFilter','prRepresentationType','prLoad']
    .forEach(id=>$(id).disabled=false);
  $('prReset').classList.add('hidden');
  $('prContainer').innerHTML='';
});

// --- Shared Analytics/Principal Renderer ---
function renderAnalytics(containerId, resetBtnId, loadBtnId, typeId='analyticsType', dateId='analyticsMonth', monthId='', yearId='', studentId='studentFilter', repId='representationType'){
  const type = $(typeId).value,
        period = type==='date'?$(dateId).value
               :type==='month'?$(dateId).value
               :type==='year'?$(yearId).value
               :null;
  if(!period) return alert('Select period');
  const dates = type==='date'? [period] : getPeriodDates(type,period);
  const stud = $(studentId).value,
        rep   = $(repId).value;
  const data = students.filter(s=>s.class===cls && s.section===sec)
    .filter(s=>!stud||s.roll==stud)
    .map(s=>{
      const cnt={P:0,A:0,Lt:0,L:0,HD:0};
      dates.forEach(d=>{ const st=attendance[d]?.[s.roll]; if(st) cnt[st]++; });
      const total=dates.length, present=cnt.P+cnt.Lt+cnt.HD, pct=Math.round(present/total*100);
      return { name:s.name, cnt, pct };
    });
  const cont = $(containerId); cont.innerHTML='';

  // TABLE
  if(rep==='table'||rep==='all'){
    const tbl=document.createElement('table'); tbl.border=1; tbl.style.width='100%';
    if(type==='month'){
      const days = dates.map(d=>d.split('-')[2]);
      tbl.innerHTML =
        `<tr><th>Name</th>${days.map(d=>`<th>${d}</th>`).join('')}</tr>`+
        data.map(r=>{
          let row=`<tr><td>${r.name}</td>`;
          dates.forEach((d,i)=>{
            const code=attendance[d]?.[students.find(x=>x.name===r.name).roll]||'';
            row+=`<td>${code}</td>`;
          });
          return row+'</tr>';
        }).join('');
    } else {
      tbl.innerHTML =
        '<tr><th>Name</th><th>P</th><th>Lt</th><th>HD</th><th>L</th><th>A</th><th>%</th></tr>'+
        data.map(r=>
          `<tr><td>${r.name}</td>`+
          [r.cnt.P,r.cnt.Lt,r.cnt.HD,r.cnt.L,r.cnt.A,r.pct+'%'].map(v=>`<td>${v}</td>`).join('')+
          '</tr>'
        ).join('');
    }
    const wrap=document.createElement('div'); wrap.className='table-container'; wrap.append(tbl); cont.append(wrap);
  }

  // SUMMARY
  if(rep==='summary'||rep==='all'){
    const sumDiv=document.createElement('div'); sumDiv.className='analytics-summary';
    data.forEach(r=>{
      const p=document.createElement('p');
      p.innerHTML =
        `<strong>${r.name}</strong>: ${r.cnt.P} Present, ${r.cnt.Lt} Late, ${r.cnt.HD} Half Day, ${r.cnt.L} Leave, ${r.cnt.A} Absent — <em>${r.pct}%</em>`+
        (r.pct<75?' ⚠️ Needs Improvement':r.pct>=90?' ✅ Excellent':'');
      sumDiv.append(p);
    });
    cont.append(sumDiv);
  }

  // GRAPH
  if(rep==='graph'||rep==='all'){
    const canvas=document.createElement('canvas'); cont.append(canvas);
    if(window.analyticsChart) window.analyticsChart.destroy();
    window.analyticsChart=new Chart(canvas.getContext('2d'),{
      type:'bar',
      data:{ labels:data.map(r=>r.name), datasets:[{label:'%',data:data.map(r=>r.pct)}] },
      options:{ responsive:true }
    });
  }

  // SHARE & DOWNLOAD
  if(rep!=='all'){
    const btns=document.createElement('div'); btns.className='row-inline';
    btns.innerHTML =
      `<button id="share_${containerId}" class="icon-button share-btn icon-only" title="Share"></button>`+
      `<button id="download_${containerId}" class="icon-button download-btn icon-only" title="Download"></button>`;
    cont.append(btns);

    $( `share_${containerId}` ).onclick = ()=>{
      const totals=data.reduce((t,r)=>{
        t.P+=r.cnt.P; t.A+=r.cnt.A; t.Lt+=r.cnt.Lt; t.L+=r.cnt.L; t.HD+=r.cnt.HD; return t;
      },{P:0,A:0,Lt:0,L:0,HD:0});
      let msg=`*${schoolName}*\nClass-Section: ${cls}-${sec}\nPeriod: ${type} ${period}\n\n`+
              `Totals → P:${totals.P}, A:${totals.A}, Lt:${totals.Lt}, HD:${totals.HD}, L:${totals.L}\n\n`+
              data.map(r=>`${r.name}: ${r.pct}%`).join('\n');
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`);
    };
    $( `download_${containerId}` ).onclick = ()=>{
      const { jsPDF }=window.jspdf, doc=new jsPDF();
      doc.text('Report',10,10);
      const rows=data.map(r=>[r.name,r.pct+'%']);
      doc.autoTable({ head:[['Name','%']], body:rows, startY:20 });
      doc.save(`${containerId}.pdf`);
    };
  }
}

// --- Helpers ---
function getPeriodDates(type,m){
  const arr=[], now=new Date(), year=now.getFullYear();
  if(type==='month' && /^\d{4}-\d{2}$/.test(m)){
    const [y,mm]=m.split('-'), days=new Date(y,mm,0).getDate();
    for(let d=1;d<=days;d++) arr.push(`${y}-${mm}-${String(d).padStart(2,'0')}`);
  } else if(type==='year' && /^\d{4}$/.test(m)){
    for(let mm=1;mm<=12;mm++){
      const md=String(mm).padStart(2,'0'), days=new Date(m,mm,0).getDate();
      for(let d=1;d<=days;d++) arr.push(`${m}-${md}-${String(d).padStart(2,'0')}`);
    }
  } else if(type==='semester'||type==='sixmonths'||type==='year'){
    let start=1,end=12;
    if(type==='semester'){ start=1; end=6; }
    if(type==='sixmonths'){ start=7; end=12; }
    for(let mm=start;mm<=end;mm++){
      const md=String(mm).padStart(2,'0'), days=new Date(year,mm,0).getDate();
      for(let d=1;d<=days;d++) arr.push(`${year}-${md}-${String(d).padStart(2,'0')}`);
    }
  }
  return arr;
}

// --- Init ---
initSetup();
