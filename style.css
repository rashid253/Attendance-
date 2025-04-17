// app.js
const $ = id => document.getElementById(id),
      getText = s => ({P:'Present', A:'Absent', Lt:'Late', L:'Leave', HD:'Half Day'}[s]||'Not Marked');

let cls = localStorage.getItem('teacherClass')||'',
    sec = localStorage.getItem('teacherSection')||'',
    students = JSON.parse(localStorage.getItem('students'))||[],
    attendance = JSON.parse(localStorage.getItem('attendanceData'))||{};

// --- Setup ---
function initSetup(){
  if(!cls||!sec) return;
  $('dispClass').textContent = cls;
  $('dispSection').textContent = sec;
  $('teacherClassHeader').textContent = `${cls}-${sec}`;
  $('teacherSetupForm').classList.add('hidden');
  $('teacherSetupDisplay').classList.remove('hidden');
  renderStudents(); populateStudentFilter();
}
$('saveTeacherClass').onclick = () => {
  const c=$('teacherClassSelect').value, s=$('teacherSectionSelect').value;
  if(!c||!s) return alert('Select class & section');
  cls=c; sec=s;
  localStorage.setItem('teacherClass',c);
  localStorage.setItem('teacherSection',s);
  initSetup();
};
$('editTeacherSetup').onclick=()=>{
  $('teacherSetupForm').classList.remove('hidden');
  $('teacherSetupDisplay').classList.add('hidden');
};

// --- Students ---
function renderStudents(){
  $('students').innerHTML='';
  students.filter(s=>s.class===cls&&s.section===sec)
    .forEach(s=>{
      const li=document.createElement('li');
      li.textContent=`${s.roll}-${s.name}`;
      $('students').append(li);
    });
}
$('addStudent').onclick=()=>{
  const name=$('studentName').value.trim();
  if(!name||!cls) return alert('Enter name & save class');
  const roll=students.filter(s=>s.class===cls&&s.section===sec).length+1;
  students.push({
    roll,
    name,
    admissionNo:$('admissionNo').value.trim(),
    class:cls,
    section:sec,
    parentContact:$('parentContact').value.trim()
  });
  localStorage.setItem('students',JSON.stringify(students));
  $('studentName').value=$('admissionNo').value=$('parentContact').value='';
  initSetup();
};
function populateStudentFilter(){
  const sel=$('studentFilter');
  sel.innerHTML='<option value="">All Students</option>';
  students.filter(s=>s.class===cls&&s.section===sec)
    .forEach(s=>{
      const o=document.createElement('option');
      o.value=s.roll;
      o.textContent=s.name;
      sel.append(o);
    });
}

// --- Attendance Marking ---
$('loadAttendance').onclick=()=>{
  const d=$('dateInput').value; if(!d) return alert('Pick date');
  renderAttendance(d);
};
function renderAttendance(d){
  $('attendanceList').innerHTML='';
  const day=attendance[d]=attendance[d]||{};
  students.filter(s=>s.class===cls&&s.section===sec)
    .forEach(s=>{
      const div=document.createElement('div');
      div.className='attendance-item';
      div.innerHTML=
        `<span>${s.roll}-${s.name}</span>`+
        `<div class="attendance-buttons">`+
          ['P','A','Lt','L','HD'].map(code=>
            `<button class="att-btn${day[s.roll]===code?' selected '+code:''}" data-code="${code}">${code}</button>`
          ).join('')+
        `</div>`+
        `<button class="send-btn" data-roll="${s.roll}" data-date="${d}">Send</button>`;
      // Status buttons
      div.querySelectorAll('.att-btn').forEach(btn=> btn.onclick=()=>{
        day[s.roll]=btn.dataset.code;
        div.querySelectorAll('.att-btn').forEach(b=>b.className='att-btn');
        btn.classList.add('selected',btn.dataset.code);
      });
      // Per‑student WhatsApp
      div.querySelector('.send-btn').onclick=()=>{
        const status=getText(day[s.roll]||'');
        const msg=`${cls}-${sec} | ${d} | ${s.name}: ${status}`;
        const phone=students.find(x=>x.roll==s.roll).parentContact.replace(/[^0-9]/g,'');
        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`);
      };
      $('attendanceList').append(div);
    });
}
$('saveAttendance').onclick=()=>{
  const d=$('dateInput').value; if(!d) return alert('Pick date');
  localStorage.setItem('attendanceData',JSON.stringify(attendance));
  showAttendanceResult(d);
};

// --- Attendance Result ---
function showAttendanceResult(d){
  $('attendance-section').classList.add('hidden');
  const list=$('attendanceResultList'); list.innerHTML='';
  const day=attendance[d]||{};
  students.filter(s=>s.class===cls&&s.section===sec)
    .forEach(s=>{
      const li=document.createElement('li');
      li.textContent=`${s.name}: ${getText(day[s.roll]||'')}`;
      list.append(li);
    });
  $('attendance-result').classList.remove('hidden');
}
$('editAttendanceBtn').onclick=()=>{
  $('attendance-result').classList.add('hidden');
  $('attendance-section').classList.remove('hidden');
};
$('shareAttendanceBtn').onclick=()=>{
  const d=$('dateInput').value;
  let msg=`${cls}-${sec} | ${d}\n`;
  const day=attendance[d]||{};
  students.filter(s=>s.class===cls&&s.section===sec)
    .forEach(s=> msg+=`${s.name}: ${getText(day[s.roll]||'')}\n`);
  window.open('https://api.whatsapp.com/send?text='+encodeURIComponent(msg));
};
$('downloadAttendanceBtn').onclick=()=>{
  const d=$('dateInput').value;
  const { jsPDF }=window.jspdf, doc=new jsPDF();
  doc.text(`${cls}-${sec} | ${d}`,10,10);
  let y=20, day=attendance[d]||{};
  students.filter(s=>s.class===cls&&s.section===sec)
    .forEach(s=>{
      doc.text(`${s.name}: ${getText(day[s.roll]||'')}`,10,y);
      y+=10;
    });
  doc.save(`Attendance_${d}.pdf`);
};

// --- Analytics ---
$('loadAnalytics').onclick=()=>{ renderAnalytics(); };
function renderAnalytics(){
  const type=$('analyticsType').value,
        month=$('analyticsMonth').value,
        stud=$('studentFilter').value,
        rep=$('representationType').value;
  const dates=getPeriodDates(type,month);
  const data=[];
  students.filter(s=>s.class===cls&&s.section===sec)
    .filter(s=>!stud||s.roll==stud)
    .forEach(s=>{
      const cnt={P:0,A:0,Lt:0,L:0,HD:0};
      dates.forEach(d=>{ const st=attendance[d]?.[s.roll]; if(st) cnt[st]++; });
      const total=dates.length, present=cnt.P+cnt.Lt+cnt.HD;
      const pct=Math.round(present/total*100);
      data.push({ name:s.name, cnt, dates, total, pct });
    });
  const cont=$('analyticsContainer'); cont.innerHTML='';

  // Table or combined
  if(rep==='table'||rep==='all'){
    if(type==='month'){
      const tbl=document.createElement('table'); tbl.border=1; tbl.style.width='100%';
      let header='<tr><th>Name</th>'+ dates.map(d=>`<th>${d.split('-')[2]}</th>`).join('') +'</tr>';
      let rows=data.map(r=>{
        let row=`<tr><td>${r.name}</td>`;
        r.dates.forEach(d=>{
          const code=attendance[d]?.[students.find(s=>s.name===r.name).roll]||'';
          row+=`<td>${code}</td>`;
        });
        return row+'</tr>';
      }).join('');
      tbl.innerHTML=header+rows;
      cont.append(tbl);
    } else {
      const tbl2=document.createElement('table'); tbl2.border=1; tbl2.style.width='100%';
      tbl2.innerHTML =
        '<tr><th>Name</th><th>P</th><th>Lt</th><th>HD</th><th>L</th><th>A</th><th>%</th></tr>' +
        data.map(r=>`<tr><td>${r.name}</td>`+
          [r.cnt.P, r.cnt.Lt, r.cnt.HD, r.cnt.L, r.cnt.A, r.pct+'%']
          .map(v=>`<td>${v}</td>`).join('') +
        '</tr>').join('');
      cont.append(tbl2);
    }
  }

  // Summary
  if(rep==='summary'||rep==='all'){
    data.forEach(r=>{
      const p=document.createElement('p');
      p.innerHTML=
        `<strong>${r.name}</strong>: ${r.cnt.P} Present, ${r.cnt.Lt} Late, ${r.cnt.HD} Half Day, ${r.cnt.L} Leave, ${r.cnt.A} Absent — <em>${r.pct}%</em> ${suggestion(r.pct)}`;
      cont.append(p);
    });
  }

  // Graph
  if(rep==='graph'||rep==='all'){
    const canvas=document.createElement('canvas');
    cont.append(canvas);
    new Chart(canvas.getContext('2d'),{
      type:'bar',
      data:{ labels:data.map(r=>r.name), datasets:[{ label:'%', data:data.map(r=>r.pct) }] },
      options:{ responsive:true }
    });
  }

  // Share & Download for analytics if not combined
  if(rep!=='all'){
    const btns=document.createElement('div'); btns.className='row-inline';
    btns.innerHTML='<button id="shareAnalytics">Share</button><button id="downloadAnalytics">Download PDF</button>';
    cont.append(btns);
    $('shareAnalytics').onclick=()=>{
      let msg=`${cls}-${sec} | ${type} | ${month}\n`;
      data.forEach(r=>msg+=`${r.name}: ${r.pct}%\n`);
      window.open('https://api.whatsapp.com/send?text='+encodeURIComponent(msg));
    };
    $('downloadAnalytics').onclick=()=>{
      const { jsPDF }=window.jspdf, doc=new jsPDF();
      doc.text('Analytics Report',10,10);
      const rows=data.map(r=>[r.name,r.pct+'%']);
      doc.autoTable({ head:[['Name','%']], body:rows, startY:20 });
      doc.save('Analytics.pdf');
    };
  }
}

function getPeriodDates(type,m){
  const arr=[]; const now=new Date(), year=now.getFullYear();
  if(type==='month'){
    const [y,mm]=m.split('-'), days=new Date(y,mm,0).getDate();
    for(let d=1;d<=days;d++) arr.push(`${y}-${mm}-${String(d).padStart(2,'0')}`);
  } else if(type==='semester'){
    for(let mm=1;mm<=6;mm++){
      const days=new Date(year,mm,0).getDate();
      for(let d=1;d<=days;d++) arr.push(`${year}-${String(mm).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
    }
  } else if(type==='sixmonths'){
    for(let mm=7;mm<=12;mm++){
      const days=new Date(year,mm,0).getDate();
      for(let d=1;d<=days;d++) arr.push(`${year}-${String(mm).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
    }
  } else if(type==='year'){
    for(let mm=1;mm<=12;mm++){
      const days=new Date(year,mm,0).getDate();
      for(let d=1;d<=days;d++) arr.push(`${year}-${String(mm).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
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
