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
  function nextReg() { return String(Date.now()).slice(-5); }
  async function saveStudents() { await set('students', students); }
  async function saveAttendance() { await set('attendanceData', attendanceData); }
  function filteredStudents() {
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    return students.filter(s => s.cls === cls && s.sec === sec);
  }
  function updateTotals() {
    $('totalSchoolCount').textContent = students.length;
    $('totalClassCount').textContent = students.filter(s => s.cls === $('teacherClassSelect').value).length;
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
    filteredStudents().forEach((s) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="small-col">${s.reg}</td>
        <td>${s.adm}</td>
        <td>${s.name}</td>
        <td>${s.parent}</td>
        <td>${s.contact}</td>
        <td>${s.occupation}</td>
        <td>${s.address}</td>
        <td>
          <button class="action-btn share-btn" data-adm="${s.adm}"><i class="fas fa-share-alt"></i></button>
          <button class="action-btn delete-btn" data-adm="${s.adm}"><i class="fas fa-trash-alt"></i></button>
        </td>`;
      tbody.appendChild(tr);
    });
    updateTotals();
    attachStudentActions();
  }

  function attachStudentActions() {
    document.querySelectorAll('.delete-btn').forEach(btn => btn.onclick = async () => {
      if (!confirm('Delete this student?')) return;
      students = students.filter(s => s.adm != btn.dataset.adm);
      await saveStudents();
      renderStudents();
    });
    document.querySelectorAll('.share-btn').forEach(btn => btn.onclick = () => {
      const adm = btn.dataset.adm, s = students.find(x => x.adm == adm);
      const msg = `Name: ${s.name}\nReg#: ${s.reg}\nAdm#: ${s.adm}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    });
  }

  $('addStudent').onclick = async () => {
    if (!$('studentName').checkValidity() || !$('parentName').checkValidity() ||
        !$('parentContact').checkValidity() || !$('parentOccupation').checkValidity() ||
        !$('parentAddress').checkValidity()) {
      return alert('Please fill out all fields correctly.');
    }
    const reg = nextReg(), adm = nextAdm();
    students.push({
      reg, adm,
      name: $('studentName').value.trim(),
      parent: $('parentName').value.trim(),
      contact: $('parentContact').value.trim(),
      occupation: $('parentOccupation').value.trim(),
      address: $('parentAddress').value.trim(),
      cls: $('teacherClassSelect').value,
      sec: $('teacherSectionSelect').value
    });
    await saveStudents();
    renderStudents();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id => $(id).value = '');
  };

  $('downloadAllStudents').onclick = () => {
    const csv = [['Reg','Adm','Name','Parent','Contact','Occupation','Address']];
    students.forEach(s => csv.push([s.reg,s.adm,s.name,s.parent,s.contact,s.occupation,s.address]));
    const blob = new Blob([csv.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'students.csv'; a.click();
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
          ${['P','A','Lt','HD','L'].map(c => `<button class="btn btn-light btn-sm border">${c}</button>`).join('')}
        </div>`;
      list.appendChild(item);
      item.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => {
          item.querySelectorAll('button').forEach(b => b.classList.remove('active','btn-success','btn-danger','btn-warning','btn-info','btn-primary'));
          btn.classList.add('active',
            btn.textContent==='P' ? 'btn-success' :
            btn.textContent==='A' ? 'btn-danger' :
            btn.textContent==='Lt' ? 'btn-warning' :
            btn.textContent==='HD' ? 'btn-info' :
            'btn-primary'
          );
        };
      });
    });
    $('saveAttendance').classList.remove('d-none');
  };

  $('saveAttendance').onclick = async () => {
    const d = $('dateInput').value;
    attendanceData[d] = {};
    document.querySelectorAll('.attendance-item').forEach((item,i) => {
      const code = item.querySelector('button.active')?.textContent || 'A';
      attendanceData[d][ filteredStudents()[i].adm ] = code;
    });
    await saveAttendance();
    $('attCard').classList.add('d-none');
    const details = filteredStudents().map(s => `${s.name}: ${attendanceData[d][s.adm]||'A'}`).join('<br>');
    $('attendanceDetails').innerHTML = `<strong>Date: ${d}</strong><br>${details}`;
    $('attendanceText').classList.remove('d-none');
  };

  // --- ANALYTICS ---
  function hideAllAnalytics() {
    ['analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart','resetAnalytics','analyticsPie','analyticsTable','analyticsActionsEnd']
      .forEach(id => $(id)?.classList.add('d-none'));
  }
  $('analyticsType').onchange = () => {
    hideAllAnalytics();
    const t = $('analyticsType').value;
    if (t==='date')    $('analyticsDate').classList.remove('d-none');
    if (t==='month')   $('analyticsMonth').classList.remove('d-none');
    if (t==='semester'){ $('semesterStart').classList.remove('d-none'); $('semesterEnd').classList.remove('d-none'); }
    if (t==='year')    $('yearStart').classList.remove('d-none');
    $('resetAnalytics').classList.remove('d-none');
  };

  $('loadAnalytics').onclick = () => {
    const t = $('analyticsType').value;
    let from,to;
    if (t==='date') {
      from=to=$('analyticsDate').value; if (!from) return alert('Pick a date');
    }
    if (t==='month') {
      const m=$('analyticsMonth').value; if (!m) return alert('Pick month');
      const [y,mm]=m.split('-').map(Number);
      from=`${m}-01`; to=`${m}-${new Date(y,mm,0).getDate()}`;
    }
    if (t==='semester') {
      const s=$('semesterStart').value,e=$('semesterEnd').value;
      if (!s||!e) return alert('Pick semester');
      const [ey,em]=e.split('-').map(Number);
      from=`${s}-01`; to=`${e}-${new Date(ey,em,0).getDate()}`;
    }
    if (t==='year') {
      const y=$('yearStart').value; if (!y) return alert('Pick year');
      from=`${y}-01-01`; to=`${y}-12-31`;
    }

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
    const agg = stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]); return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    const ctx = $('analyticsPie').getContext('2d');
    $('analyticsPie').classList.remove('d-none');
    analyticsPie?.destroy();
    analyticsPie = new Chart(ctx,{type:'pie',data:{labels:['Present','Absent','Late','Half Day','Leave'],datasets:[{data:Object.values(agg)}]}});

    $('analyticsActionsEnd').classList.remove('d-none');
  };

  $('downloadAnalytics').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Attendance Analytics',10,10);
    doc.addImage(analyticsPie.toBase64Image(),'PNG',15,20,180,100);
    doc.save('analytics.pdf');
  };
  $('shareAnalytics').onclick = () => {
    const rows = document.querySelectorAll('#analyticsTable tbody tr');
    const lines = Array.from(rows).map(r => Array.from(r.cells).map(c => c.textContent).join(' '));
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`);
  };

  // Init
  renderStudents();
  updateTotals();
  hideAllAnalytics();
});
