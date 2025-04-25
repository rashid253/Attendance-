// app.js
window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const { get, set } = window.idbKeyval;

  // State
  let students = await get('students') || [];
  let attendanceData = await get('attendanceData') || {};
  let pieChart, analyticsPie;

  // Helpers
  function nextAdm() { return students.length + 1; }
  function nextReg() { return Date.now(); }
  async function saveStudents() { await set('students', students); }
  async function saveAttendance() { await set('attendanceData', attendanceData); }
  function filteredStudents() {
    const cls = $('teacherClassSelect')?.value, sec = $('teacherSectionSelect')?.value;
    return students.filter(s => s.cls === cls && s.sec === sec);
  }
  function updateTotals() {
    $('totalSchoolCount').textContent = students.length;
    $('totalClassCount').textContent = students.filter(s=>s.cls=== $('teacherClassSelect').value).length;
    $('totalSectionCount').textContent = filteredStudents().length;
  }

  // --- SETUP ---
  async function loadSetup() {
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if (school && cls && sec) {
      $('schoolNameInput').value = school;
      $('teacherClassSelect').value = cls;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${school} | Class: ${cls} | Section: ${sec}`;
      $('setupDisplay').classList.remove('d-none');
    }
  }
  $('saveSetup').onclick = async () => {
    const school = $('schoolNameInput').value,
          cls    = $('teacherClassSelect').value,
          sec    = $('teacherSectionSelect').value;
    if (!school || !cls || !sec) return alert('Complete setup');
    await set('schoolName', school);
    await set('teacherClass', cls);
    await set('teacherSection', sec);
    await loadSetup();
  };
  $('editSetup').onclick = () => {
    $('setupDisplay').classList.add('d-none');
  };
  await loadSetup();

  // --- STUDENT REGISTRATION ---
  function renderStudents() {
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    filteredStudents().forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.reg}</td>
        <td>${s.adm}</td>
        <td>${s.name}</td>
        <td>${s.parent}</td>
        <td>${s.contact}</td>
        <td>${s.occupation}</td>
        <td>${s.address}</td>
      `;
      tbody.appendChild(tr);
    });
    updateTotals();
  }

  $('addStudent').onclick = async () => {
    const name = $('studentName').value.trim(),
          parent = $('parentName').value.trim(),
          contact = $('parentContact').value.trim(),
          occupation = $('parentOccupation').value.trim(),
          address = $('parentAddress').value.trim();
    if (!name||!parent||!contact||!occupation||!address) return alert('All fields required');
    const { cls, sec } = { cls: $('teacherClassSelect').value, sec: $('teacherSectionSelect').value };
    const reg = nextReg(), adm = nextAdm();
    students.push({ reg, adm, name, parent, contact, occupation, address, cls, sec });
    await saveStudents();
    renderStudents();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress']
      .forEach(id => $(id).value = '');
  };

  // --- MARK ATTENDANCE ---
  $('loadAttendance').onclick = () => {
    const d = $('dateInput').value;
    if (!d) return alert('Pick a date');
    const list = $('attendanceList');
    list.innerHTML = '';
    filteredStudents().forEach(s => {
      const item = document.createElement('div');
      item.className = 'attendance-item';
      item.innerHTML = `
        <div class="att-name">${s.name}</div>
        <div class="att-buttons d-flex gap-1 flex-wrap">
          ${['P','A','Lt','HD','L'].map(c => `<button type="button" class="btn btn-light btn-sm border">${c}</button>`).join('')}
        </div>`;
      list.appendChild(item);
      item.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => {
          item.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
        };
      });
    });
    $('saveAttendance').classList.remove('d-none');
  };

  $('saveAttendance').onclick = async () => {
    const d = $('dateInput').value;
    attendanceData[d] = {};
    document.querySelectorAll('.attendance-item').forEach((item, i) => {
      const code = item.querySelector('button.active')?.textContent || 'A';
      attendanceData[d][ filteredStudents()[i].adm ] = code;
    });
    await saveAttendance();
    // render pie
    const counts = {P:0,A:0,Lt:0,HD:0,L:0};
    Object.values(attendanceData[d]).forEach(c=>counts[c]++);
    const ctx = $('summaryPie').getContext('2d');
    $('summaryPie').parentElement.classList.remove('d-none');
    pieChart?.destroy();
    pieChart = new Chart(ctx, {
      type:'pie',
      data:{ labels:['Present','Absent','Late','Half Day','Leave'], datasets:[{ data:Object.values(counts) }] }
    });
    $('attendance-result').classList.remove('d-none');
  };

  $('downloadAttendancePDF').onclick = () => {
    if(!window.jspdf) return alert('PDF lib missing');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Attendance Summary',10,10);
    doc.addImage(pieChart.toBase64Image(),'PNG',15,20,180,100);
    doc.save('attendance_summary.pdf');
  };

  $('shareAttendanceSummary').onclick = () => {
    const d = $('dateInput').value;
    const lines = filteredStudents().map(s => {
      const c = attendanceData[d][s.adm] || 'A';
      return `${s.name}: ${ c==='P'?'Present': c==='A'?'Absent': c==='Lt'?'Late': c==='HD'?'Half Day':'Leave' }`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(`Date: ${d}\n${lines}`)}`);
  };

  // --- ANALYTICS ---
  function hideAnalytics() {
    ['analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart','resetAnalytics','analyticsPie','analyticsTable','analyticsControls']
      .forEach(id => $(id)?.classList.add('d-none'));
  }
  $('analyticsType').onchange = () => {
    hideAnalytics();
    const t = $('analyticsType').value;
    if (t==='date') $('analyticsDate').classList.remove('d-none');
    if (t==='month') $('analyticsMonth').classList.remove('d-none');
    if (t==='semester') ['semesterStart','semesterEnd'].forEach(id=>$(id).classList.remove('d-none'));
    if (t==='year') $('yearStart').classList.remove('d-none');
    $('resetAnalytics').classList.remove('d-none');
  };

  $('loadAnalytics').onclick = () => {
    const t = $('analyticsType').value;
    let from,to;
    if (t==='date') {
      from = to = $('analyticsDate').value;
      if(!from) return alert('Pick a date');
    }
    if (t==='month') {
      const m = $('analyticsMonth').value;
      if(!m) return alert('Pick month');
      const [y,mm] = m.split('-').map(Number);
      from = `${m}-01`;
      to = `${m}-${new Date(y,mm,0).getDate()}`;
    }
    if (t==='semester') {
      const s = $('semesterStart').value, e = $('semesterEnd').value;
      if(!s||!e) return alert('Pick semester');
      const [ey,em] = e.split('-').map(Number);
      from = `${s}-01`;
      to   = `${e}-${new Date(ey,em,0).getDate()}`;
    }
    if (t==='year') {
      const y = $('yearStart').value;
      if(!y) return alert('Pick year');
      from = `${y}-01-01`;
      to   = `${y}-12-31`;
    }
    // compute stats
    const stats = filteredStudents().map(s=>({name:s.name,P:0,A:0,Lt:0,HD:0,L:0}));
    Object.entries(attendanceData).forEach(([d,rec])=>{
      if (d>=from && d<=to) {
        stats.forEach((st,i)=>{
          const code = rec[ filteredStudents()[i].adm ] || 'A';
          st[code]++;
        });
      }
    });
    // render table
    const tbl = ['<table class="table"><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th></tr></thead><tbody>']
      .concat(stats.map(s=>`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td></tr>`))
      .concat('</tbody></table>').join('');
    $('analyticsTable').innerHTML = tbl;
    $('analyticsTable').classList.remove('d-none');

    // pie chart
    const agg = stats.reduce((a,s)=>{ ['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]); return a; },{P:0,A:0,Lt:0,HD:0,L:0});
    const ctx = $('analyticsPie').getContext('2d');
    $('analyticsPie').classList.remove('d-none');
    analyticsPie?.destroy();
    analyticsPie = new Chart(ctx, {
      type:'pie',
      data:{ labels:['Present','Absent','Late','Half Day','Leave'], datasets:[{ data:Object.values(agg) }] }
    });

    $('analyticsControls').classList.remove('d-none');
  };

  $('downloadAnalytics').onclick = () => {
    if(!window.jspdf) return alert('PDF lib missing');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Attendance Analytics',10,10);
    doc.addImage(analyticsPie.toBase64Image(),'PNG',15,20,180,100);
    doc.save('analytics.pdf');
  };

  $('shareAnalytics').onclick = () => {
    const t = $('analyticsType').value,
          instr = `Period: ${$('analyticsDate').value||$('analyticsMonth').value||''}`;
    const rows = document.querySelectorAll('#analyticsTable tbody tr');
    const lines = Array.from(rows).map(r => Array.from(r.cells).map(c=>c.textContent).join(' '));
    window.open(`https://wa.me/?text=${encodeURIComponent(instr+'\n'+lines.join('\n'))}`);
  };

  // --- ATTENDANCE REGISTER ---
  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value;
    if(!m) return alert('Pick month');
    const [y,mm] = m.split('-').map(Number),
          days = new Date(y,mm,0).getDate();
    const head = document.querySelector('#registerTable thead tr');
    head.innerHTML = '<th>Sr#</th><th>Adm#</th><th>Name</th>' +
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    const body = $('registerBody'), sum = $('registerSummaryBody');
    body.innerHTML = ''; sum.innerHTML = '';
    filteredStudents().forEach((s,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
        Array.from({length:days},(_,d)=>{
          const ds = `${m}-${String(d+1).padStart(2,'0')}`,
                c = attendanceData[ds]?.[s.adm]||'A',
                colors = {P:'#4CAF50',A:'#f44336',Lt:'#FFEB3B',HD:'#FF9800',L:'#03a9f4'};
          return `<td style="background:${colors[c]};color:#fff">${c}</td>`;
        }).join('');
      body.appendChild(tr);
      // summary
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      for(let d=1;d<=days;d++){
        const ds = `${m}-${String(d).padStart(2,'0')}`,
              c = attendanceData[ds]?.[s.adm]||'A';
        stats[c]++;
      }
      const pct = ((stats.P/days)*100).toFixed(1);
      sum.innerHTML += `<tr><td>${s.name}</td><td>${stats.P}</td><td>${stats.A}</td><td>${stats.Lt}</td><td>${stats.HD}</td><td>${stats.L}</td><td>${pct}</td></tr>`;
    });
    $('registerTableWrapper').classList.remove('d-none');
    $('registerSummarySection').classList.remove('d-none');
    $('loadRegister').classList.add('d-none');
    $('changeRegister').classList.remove('d-none');
  };

  $('changeRegister').onclick = () => {
    ['registerTableWrapper','registerSummarySection'].forEach(id=>$(id).classList.add('d-none'));
    $('changeRegister').classList.add('d-none');
    $('loadRegister').classList.remove('d-none');
  };

  $('downloadRegisterPDF').onclick = () => {
    if(!window.jspdf) return alert('PDF lib missing');
    const { jsPDF }=window.jspdf, doc=new jsPDF('landscape');
    doc.text('Attendance Register',10,10);
    doc.autoTable({ html:'#registerTable', startY:20, styles:{fontSize:6} });
    doc.autoTable({ html:'#registerSummarySection table', startY:doc.lastAutoTable.finalY+10 });
    doc.save('register.pdf');
  };

  $('shareRegister').onclick = () => {
    const m = $('registerMonth').value;
    const lines = Array.from($('registerSummaryBody').rows).map(r=>`${r.cells[0].textContent}: ${r.cells[6].textContent}%`);
    window.open(`https://wa.me/?text=${encodeURIComponent(`Register ${m}\n${lines.join('\n')}`)}`);
  };

  // Init
  renderStudents();
  updateTotals();
  hideAnalytics();
});
