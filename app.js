// app.js
const $ = id => document.getElementById(id),
      getText = s => ({P:'Present',A:'Absent',Lt:'Late',L:'Leave',HD:'Half Day'}[s]||'Not Marked');

let school = localStorage.getItem('schoolName')||'',
    cls    = localStorage.getItem('teacherClass')||'',
    sec    = localStorage.getItem('teacherSection')||'',
    students   = JSON.parse(localStorage.getItem('students'))||[],
    attendance = JSON.parse(localStorage.getItem('attendanceData'))||{};

// --- Setup ---
function initSetup(){
  if(!school||!cls||!sec) return;
  $('dispSchool').textContent       = school;
  $('dispClass').textContent        = cls;
  $('dispSection').textContent      = sec;
  $('schoolNameHeader').textContent = school;
  $('teacherClassHeader').textContent = `${cls}-${sec}`;
  $('teacherSetupForm').classList.add('hidden');
  $('teacherSetupDisplay').classList.remove('hidden');
  renderStudents();
  populateStudentFilter();
}
$('saveTeacherClass').onclick = () => {
  const sName = $('schoolNameInput').value.trim(),
        c     = $('teacherClassSelect').value,
        s     = $('teacherSectionSelect').value;
  if(!sName||!c||!s) return alert('Enter school, class & section');
  school=sName; cls=c; sec=s;
  localStorage.setItem('schoolName', school);
  localStorage.setItem('teacherClass', cls);
  localStorage.setItem('teacherSection', sec);
  initSetup();
};
$('editTeacherSetup').onclick = () => {
  $('teacherSetupForm').classList.remove('hidden');
  $('teacherSetupDisplay').classList.add('hidden');
};

// --- Students ---
function renderStudents(){
  $('students').innerHTML = '';
  students.filter(s=>s.class===cls&&s.section===sec)
    .forEach(s=>{
      const li=document.createElement('li');
      li.textContent = `${s.roll}-${s.name}`;
      $('students').append(li);
    });
}
$('addStudent').onclick = () => {
  const name = $('studentName').value.trim();
  if(!name||!cls) return alert('Enter name & save class');
  const roll = students.filter(s=>s.class===cls&&s.section===sec).length + 1;
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
function populateStudentFilter(){
  const sel = $('studentFilter');
  sel.innerHTML = '<option value="">All Students</option>';
  students.filter(s=>s.class===cls&&s.section===sec)
    .forEach(s=>{
      const o=document.createElement('option');
      o.value = s.roll; o.textContent = s.name;
      sel.append(o);
    });
}

// --- Attendance Marking ---
$('loadAttendance').onclick = () => {
  const d = $('dateInput').value;
  if(!d) return alert('Pick date');
  renderAttendance(d);
};
function renderAttendance(d){
  $('attendanceList').innerHTML = '';
  const day = attendance[d] = attendance[d]||{};
  students.filter(s=>s.class===cls&&s.section===sec)
    .forEach(s=>{
      const div = document.createElement('div');
      div.className = 'attendance-item';
      div.innerHTML =
        `<span>${s.roll}-${s.name}</span>` +
        `<div class="attendance-buttons">${
          ['P','A','Lt','L','HD'].map(code=>
            `<button class="att-btn${day[s.roll]===code?' selected '+code:''}" data-code="${code}">${code}</button>`
          ).join('')
        }</div>` +
        `<button class="send-btn" data-roll="${s.roll}" data-date="${d}">Send</button>`;
      // status buttons
      div.querySelectorAll('.att-btn').forEach(btn=>{
        btn.onclick = ()=>{
          day[s.roll] = btn.dataset.code;
          div.querySelectorAll('.att-btn').forEach(b=>b.className='att-btn');
          btn.classList.add('selected', btn.dataset.code);
        };
      });
      // per‑student share
      div.querySelector('.send-btn').onclick = ()=>{
        const status = getText(day[s.roll]||''),
              phone  = students.find(x=>x.roll==s.roll).parentContact.replace(/[^0-9]/g,''),
              msg    = `${school} | ${cls}-${sec} | ${d} | ${s.name}: ${status}`;
        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`);
      };
      $('attendanceList').append(div);
    });
}
$('saveAttendance').onclick = () => {
  const d = $('dateInput').value;
  if(!d) return alert('Pick date');
  localStorage.setItem('attendanceData', JSON.stringify(attendance));
  showAttendanceResult(d);
};

// --- Attendance Result ---
function showAttendanceResult(d){
  $('resultDate').textContent = d;
  $('attendance-section').classList.add('hidden');
  const list = $('attendanceResultList');
  list.innerHTML = '';
  let totals = {P:0,A:0,Lt:0,L:0,HD:0};
  students.filter(s=>s.class===cls&&s.section===sec).forEach(s=>{
    const code = attendance[d]?.[s.roll]||'';
    totals[code]++;
    const li = document.createElement('li');
    li.innerHTML = `<strong>${s.name}</strong><span class="summary-code ${code}">${code}</span>`;
    list.append(li);
  });
  $('attendance-result').classList.remove('hidden');
}
$('editAttendanceBtn').onclick = () => {
  $('attendance-result').classList.add('hidden');
  $('attendance-section').classList.remove('hidden');
};
$('shareAttendanceBtn').onclick = () => {
  const d = $('dateInput').value;
  let totals = {P:0,A:0,Lt:0,L:0,HD:0},
      msg = `${school} | ${cls}-${sec} | ${d}\nTotals → `;
  students.filter(s=>s.class===cls&&s.section===sec).forEach(s=>{
    const code = attendance[d]?.[s.roll]||'';
    totals[code]++;
  });
  msg += `Present:${totals.P}, Absent:${totals.A}, Late:${totals.Lt}, Leave:${totals.L}, HalfDay:${totals.HD}\n`;
  students.filter(s=>s.class===cls&&s.section===sec).forEach(s=>{
    const code = attendance[d]?.[s.roll]||'';
    msg += `${s.name}: ${getText(code)}\n`;
  });
  window.open('https://api.whatsapp.com/send?text='+encodeURIComponent(msg));
};

// --- Lookup by Date ---
$('lookupBtn').onclick = () => {
  const d = $('lookupDate').value;
  if(!d) return alert('Pick date');
  const ul = $('lookupResult');
  ul.innerHTML = '';
  let found = false;
  students.filter(s=>s.class===cls&&s.section===sec).forEach(s=>{
    const code = attendance[d]?.[s.roll];
    if(code!==undefined){
      found = true;
      const li = document.createElement('li');
      li.textContent = `${s.name}: ${getText(code)}`;
      ul.append(li);
    }
  });
  ul.classList.toggle('hidden', !found);
  if(!found) alert('No record for ' + d);
};

// --- Analytics ---
$('analyticsType').onchange = () => {
  const t = $('analyticsType').value;
  $('analyticsSemester').classList.toggle('hidden', t!=='semester');
  $('analyticsYear').classList.toggle('hidden', t!=='year');
};
$('loadAnalytics').onclick = () => {
  renderAnalytics();
  ['analyticsType','analyticsMonth','analyticsSemester','analyticsYear','studentFilter','representationType','loadAnalytics']
    .forEach(id=>$(id).disabled = true);
  $('resetAnalyticsBtn').classList.remove('hidden');
};
$('resetAnalyticsBtn').onclick = () => {
  ['analyticsType','analyticsMonth','analyticsSemester','analyticsYear','studentFilter','representationType','loadAnalytics']
    .forEach(id=>$(id).disabled = false);
  $('resetAnalyticsBtn').classList.add('hidden');
  $('analyticsContainer').innerHTML = '';
};

function renderAnalytics(){
  const type = $('analyticsType').value,
        month = $('analyticsMonth').value,
        sem   = $('analyticsSemester').value,
        year  = $('analyticsYear').value,
        stud  = $('studentFilter').value,
        rep   = $('representationType').value;
  let dates = getPeriodDates(type, month, sem, year);
  const data = [];
  students.filter(s=>s.class===cls&&s.section===sec)
    .filter(s=>!stud||s.roll==stud)
    .forEach(s=>{
      const cnt = {P:0,A:0,Lt:0,L:0,HD:0};
      dates.forEach(d=>{
        const st = attendance[d]?.[s.roll];
        if(st) cnt[st]++;
      });
      const total   = dates.length,
            present = cnt.P + cnt.Lt + cnt.HD,
            pct     = Math.round(present/total*100);
      data.push({name:s.name,cnt,pct});
    });
  const cont = $('analyticsContainer');
  cont.innerHTML = '';

  // Table view
  if(rep==='table'||rep==='all'){
    const tbl = document.createElement('table');
    tbl.border = 1;
    tbl.style.width = '100%';
    // Header
    let header = '<tr><th>Name</th>';
    if(type==='month'){
      header += dates.map(d=>`<th>${d.split('-')[2]}</th>`).join('');
    } else {
      header += '<th>P</th><th>Lt</th><th>HD</th><th>L</th><th>A</th><th>%</th>';
    }
    header += '</tr>';
    // Rows
    let rows = data.map(r=>{
      let row = `<tr><td>${r.name}</td>`;
      if(type==='month'){
        dates.forEach((d,i)=>{
          const code = attendance[d]?.[students.find(s=>s.name===r.name).roll]||'';
          row += `<td>${code}</td>`;
        });
      } else {
        row += `<td>${r.cnt.P}</td><td>${r.cnt.Lt}</td><td>${r.cnt.HD}</td>`+
               `<td>${r.cnt.L}</td><td>${r.cnt.A}</td><td>${r.pct}%</td>`;
      }
      return row + '</tr>';
    }).join('');
    tbl.innerHTML = header + rows;
    const wrap = document.createElement('div');
    wrap.className = 'table-container';
    wrap.append(tbl);
    cont.append(wrap);
  }

  // Summary view
  if(rep==='summary'||rep==='all'){
    data.forEach(r=>{
      const p = document.createElement('p');
      p.innerHTML = `<strong>${r.name}</strong>: ${r.cnt.P} Present, ${r.cnt.Lt} Late, ${r.cnt.HD} Half Day, ${r.cnt.L} Leave, ${r.cnt.A} Absent — <em>${r.pct}%</em> ${suggestion(r.pct)}`;
      cont.append(p);
    });
  }

  // Graph view
  if(rep==='graph'||rep==='all'){
    const canvas = document.createElement('canvas');
    cont.append(canvas);
    new Chart(canvas.getContext('2d'), {
      type:'bar',
      data:{ labels:data.map(r=>r.name), datasets:[{ label:'%', data:data.map(r=>r.pct) }] },
      options:{ responsive:true }
    });
  }

  // Share & Download
  const btns = document.createElement('div');
  btns.className = 'row-inline';
  btns.innerHTML =
    '<button id="shareAnalytics">📤 Share</button>' +
    '<button id="downloadAnalytics">📥 Download PDF</button>';
  cont.append(btns);

  $('shareAnalytics').onclick = () => {
    let totals={P:0,A:0,Lt:0,L:0,HD:0}, msg=`${school} | ${cls}-${sec} | ${type} | `;
    if(type==='month') msg += month;
    else if(type==='semester') msg += sem==='1'? 'Jan–Jun '+year : 'Jul–Dec '+year;
    else msg += year;
    msg += '\nTotals → ';
    data.forEach(r=>{
      totals.P  += r.cnt.P;
      totals.A  += r.cnt.A;
      totals.Lt += r.cnt.Lt;
      totals.L  += r.cnt.L;
      totals.HD += r.cnt.HD;
    });
    msg += `Present:${totals.P}, Absent:${totals.A}, Late:${totals.Lt}, Leave:${totals.L}, HalfDay:${totals.HD}\n\n`;
    data.forEach(r=> msg += `${r.name}: ${r.pct}%\n`);
    window.open('https://api.whatsapp.com/send?text='+encodeURIComponent(msg));
  };

  $('downloadAnalytics').onclick = () => {
    const { jsPDF } = window.jspdf, doc = new jsPDF();
    doc.text(`${school} | ${cls}-${sec}`,10,10);
    if(type==='month'){
      doc.text(`Monthly Report: ${month}`,10,20);
    } else if(type==='semester'){
      doc.text(`Semester Report: ${sem==='1'?'Jan–Jun':'Jul–Dec'} ${year}`,10,20);
    } else {
      doc.text(`Yearly Report: ${year}`,10,20);
    }
    doc.autoTable({
      head:[ type==='month'
        ? ['Name', ...dates.map(d=>d.split('-')[2])] 
        : ['Name','P','Lt','HD','L','A','%']
      ],
      body: data.map(r=>{
        return type==='month'
          ? [r.name, ...dates.map(d=>attendance[d]?.[students.find(s=>s.name===r.name).roll]||'')]
          : [r.name, r.cnt.P, r.cnt.Lt, r.cnt.HD, r.cnt.L, r.cnt.A, r.pct+'%'];
      }),
      startY: 30,
      styles:{fontSize:8}
    });
    doc.save(`Report_${type}_${type==='month'?month:(type==='semester'?`${sem}_${year}`:year)}.pdf`);
  };
}

function getPeriodDates(type,m,sem,yr){
  const arr = [], now = new Date(), y = yr||now.getFullYear();
  if(type==='month'){
    const [yy,mm] = m.split('-'), days=new Date(yy,mm,0).getDate();
    for(let d=1;d<=days;d++) arr.push(`${yy}-${mm}-${String(d).padStart(2,'0')}`);
  } else if(type==='semester'){
    const start = sem==='2'?7:1, end = sem==='2'?12:6;
    for(let mo=start;mo<=end;mo++){
      const days=new Date(y,mo,0).getDate();
      for(let d=1;d<=days;d++) arr.push(`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
    }
  } else { // year
    for(let mo=1;mo<=12;mo++){
      const days=new Date(yr,mo,0).getDate();
      for(let d=1;d<=days;d++) arr.push(`${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
    }
  }
  return arr;
}

function suggestion(p){
  if(p<75) return '⚠️ Needs Improvement';
  if(p>=90) return '✅ Excellent';
  return '';
}

// Init
initSetup();
