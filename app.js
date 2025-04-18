// app.js
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // Setup & Registration
  $('#saveSetup').addEventListener('click', () => {
    const school = $('#schoolNameInput').value.trim();
    const cls    = $('#teacherClassSelect').value;
    const sec    = $('#teacherSectionSelect').value;
    if (!school||!cls||!sec) return alert('Fill all setup fields');
    localStorage.setItem('schoolName', school);
    localStorage.setItem('teacherClass', cls);
    localStorage.setItem('teacherSection', sec);
    $('#dispSchool').textContent = school;
    $('#dispClass').textContent   = cls;
    $('#dispSection').textContent = sec;
    $('#setupForm').classList.add('hidden');
    $('#setupDisplay').classList.remove('hidden');
  });
  $('#editSetup').addEventListener('click', () => {
    $('#setupDisplay').classList.add('hidden');
    $('#setupForm').classList.remove('hidden');
  });

  let students = JSON.parse(localStorage.getItem('students')||'[]');
  const renderStudents = () => {
    $('#students').innerHTML = '';
    $('#studentFilter').innerHTML = '<option value="">All Students</option>';
    students.forEach(s=>{
      const li = document.createElement('li');
      li.textContent = `${s.name} (Roll ${s.roll})`;
      $('#students').append(li);
      const opt = document.createElement('option');
      opt.value = s.roll; opt.textContent = s.name;
      $('#studentFilter').append(opt);
    });
  };
  $('#addStudent').addEventListener('click', () => {
    const name = $('#studentName').value.trim();
    if (!name) return alert('Enter student name');
    const roll = Date.now();
    students.push({name,roll});
    localStorage.setItem('students', JSON.stringify(students));
    renderStudents();
  });
  $('#deleteAllStudents').addEventListener('click', () => {
    if (!confirm('Delete all?')) return;
    students = [];
    localStorage.setItem('students', '[]');
    renderStudents();
  });
  renderStudents();

  // Analytics
  const THRESHOLD = 75;
  let chartBar, chartPie;

  const showPeriodInputs = () => {
    ['analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart']
      .forEach(id=>$(id).classList.add('hidden'));
    const v = $('#analyticsType').value;
    if (v==='date')     $('#analyticsDate').classList.remove('hidden');
    if (v==='month')    $('#analyticsMonth').classList.remove('hidden');
    if (v==='semester'){
      $('#semesterStart').classList.remove('hidden');
      $('#semesterEnd').classList.remove('hidden');
    }
    if (v==='year')     $('#yearStart').classList.remove('hidden');
  };
  $('#analyticsType').addEventListener('change', showPeriodInputs);

  const buildDateArray = () => {
    const type = $('#analyticsType').value;
    const dates = [];
    const pushRange = (start, end) => {
      let cur = new Date(start);
      while (cur <= end) {
        dates.push(cur.toISOString().slice(0,10));
        cur.setDate(cur.getDate()+1);
      }
    };
    if (type==='date'){
      const d = new Date($('#analyticsDate').value);
      dates.push(d.toISOString().slice(0,10));
    }
    if (type==='month'){
      const [y,m] = $('#analyticsMonth').value.split('-');
      const start = new Date(y, m-1,1);
      const end   = new Date(y, m, 0);
      pushRange(start,end);
    }
    if (type==='semester'){
      const [ys,ms] = $('#semesterStart').value.split('-');
      const [ye,me] = $('#semesterEnd').value.split('-');
      const start = new Date(ys, ms-1,1);
      const end   = new Date(ye, me,0);
      pushRange(start,end);
    }
    if (type==='year'){
      const [ys,ms] = $('#yearStart').value.split('-');
      const start = new Date(ys, ms-1,1);
      const end   = new Date(start);
      end.setMonth(end.getMonth()+11, 0);
      pushRange(start,end);
    }
    return dates;
  };

  $('#loadAnalytics').addEventListener('click', ()=>{
    const dates = buildDateArray();
    if (!dates.length) return alert('Select valid period');
    $('#resetAnalyticsBtn').classList.remove('hidden');
    $('#instructions').classList.remove('hidden');
    $('#analyticsContainer').classList.remove('hidden');
    $('#graphs').classList.remove('hidden');
    $('#analyticsActions').classList.remove('hidden');

    // show instructions
    $('#instructions').innerHTML = `
      <h3>Instructions & Formulas</h3>
      <p><strong>Formula:</strong> Attendance % = (P + Lt + HD) / TotalDays × 100</p>
      <p><strong>Eligibility Threshold:</strong> ${THRESHOLD}% required to sit exams</p>
      <p>Graphs show each student’s attendance % over the chosen period.</p>
    `;

    // compute summary
    const summary = students.map(s=>{
      const cnt = {P:0,A:0,Lt:0,HD:0,L:0};
      dates.forEach(d=>{
        const rec = JSON.parse(localStorage.getItem('attendanceData')||'{}')[d]||{};
        const st = rec[s.roll];
        if (st) cnt[st]++;
      });
      const pct = Math.round((cnt.P+cnt.Lt+cnt.HD)/dates.length*100);
      return { name:s.name, ...cnt, pct, elig: pct>=THRESHOLD };
    });

    // render summary table
    const tbl = document.createElement('table');
    tbl.border=1; tbl.style.width='100%';
    tbl.innerHTML = `
      <tr>
        <th>Name</th><th>P</th><th>Lt</th><th>HD</th><th>L</th><th>A</th><th>%</th><th>Elig</th>
      </tr>
      ${summary.map(r=>`
        <tr>
          <td>${r.name}</td><td>${r.P}</td><td>${r.Lt}</td><td>${r.HD}</td>
          <td>${r.L}</td><td>${r.A}</td><td>${r.pct}%</td>
          <td>${r.elig? '✓':'✗'}</td>
        </tr>`).join('')}
    `;
    $('#analyticsContainer').innerHTML = '';
    $('#analyticsContainer').append(tbl);

    // render bar chart
    const names = summary.map(r=>r.name);
    const data  = summary.map(r=>r.pct);
    if (chartBar) chartBar.destroy();
    chartBar = new Chart($('#barChart').getContext('2d'), {
      type:'bar',
      data:{ labels:names, datasets:[{ label:'%', data }] },
      options:{ responsive:true }
    });

    // render pie chart
    if (chartPie) chartPie.destroy();
    chartPie = new Chart($('#pieChart').getContext('2d'), {
      type:'pie',
      data:{ labels:names, datasets:[{ data }] },
      options:{ responsive:true }
    });
  });

  $('#resetAnalyticsBtn').addEventListener('click', () => {
    ['analyticsType','analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart']
      .forEach(id=>$(id).classList.add('hidden'));
    $('#resetAnalyticsBtn').classList.add('hidden');
    $('#instructions').classList.add('hidden');
    $('#analyticsContainer').classList.add('hidden');
    $('#graphs').classList.add('hidden');
    $('#analyticsActions').classList.add('hidden');
    $('#analyticsType').value = '';
    $('#analyticsContainer').innerHTML = '';
  });

  // Share & Download
  $('#shareAnalytics').addEventListener('click', ()=>{
    let text = $('#instructions').innerText + '\n\n';
    text += $('#analyticsContainer').innerText;
    if (navigator.share) navigator.share({ title:'Attendance Summary', text });
    else alert('Share not supported');
  });

  $('#downloadAnalytics').addEventListener('click', ()=>{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    let y = 20;
    doc.setFontSize(12);
    // instructions
    $('#instructions p').forEach(p=>{
      doc.text(p.innerText,20,y); y+=15;
    });
    y+=10;
    // table
    doc.autoTable({ html: $('#analyticsContainer table'), startY:y, margin:{left:20,right:20} });
    y = doc.lastAutoTable.finalY + 20;
    // bar chart
    doc.text('Bar Chart',20,y); y+=10;
    const barImg = $('#barChart').toDataURL('image/png');
    doc.addImage(barImg,'PNG',20,y,550,200); y+=210;
    // pie chart
    doc.text('Pie Chart',20,y); y+=10;
    const pieImg = $('#pieChart').toDataURL('image/png');
    doc.addImage(pieImg,'PNG',20,y,300,200);
    doc.save('Attendance_Report.pdf');
  });
});
