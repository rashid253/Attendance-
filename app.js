// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- Imports & IndexedDB helpers ---
  const { get, set } = window.idbKeyval;
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;

  const saveStudents       = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);
  const saveLastAdmNo      = () => set('lastAdmissionNo', lastAdmNo);

  async function generateAdmNo() {
    lastAdmNo++;
    await saveLastAdmNo();
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- Helpers ---
  const $ = id => document.getElementById(id);
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  // --- SETUP SECTION ---
  async function loadSetup() {
    const school = await get('schoolName');
    const cls    = await get('teacherClass');
    const sec    = await get('teacherSection');
    if (school && cls && sec) {
      $('schoolNameInput').value   = school;
      $('teacherClassSelect').value = cls;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderStudents();
      updateCounters();
    }
  }

  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const school = $('schoolNameInput').value.trim();
    const cls    = $('teacherClassSelect').value;
    const sec    = $('teacherSectionSelect').value;
    if (!school || !cls || !sec) return alert('Complete setup');
    await set('schoolName', school);
    await set('teacherClass', cls);
    await set('teacherSection', sec);
    await loadSetup();
  };
  $('editSetup').onclick = e => {
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };
  await loadSetup();

  // --- COUNTERS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target / 100);
      (function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
      })();
    });
  }
  function updateCounters() {
    const cls = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const filtered = students.filter(s=>s.cls===cls && s.sec===sec);
    $('sectionCount').dataset.target = filtered.length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cls).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  $('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); };

  // --- STUDENT REGISTRATION ---
  function renderStudents() {
    const cls = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    students.filter(s=>s.cls===cls && s.sec===sec)
      .forEach((stu,i) => {
        const tr = document.createElement('tr');
        tr.dataset.index = i;
        tr.innerHTML = `
          <td><input type="checkbox" class="sel"></td>
          <td>${i+1}</td>
          <td>${stu.name}</td>
          <td>${stu.adm}</td>
          <td>${stu.parent}</td>
          <td>${stu.contact}</td>
          <td>${stu.occupation}</td>
          <td>${stu.address}</td>
        `;
        tbody.appendChild(tr);
      });
    $('selectAllStudents').checked = false;
    toggleEditDelete();
  }

  $('addStudent').onclick = async e => {
    e.preventDefault();
    const name       = $('studentName').value.trim();
    const parent     = $('parentName').value.trim();
    const contact    = $('parentContact').value.trim();
    const occupation = $('parentOccupation').value.trim();
    const address    = $('parentAddress').value.trim();
    const cls        = $('teacherClassSelect').value;
    const sec        = $('teacherSectionSelect').value;
    if (!name||!parent||!contact||!occupation||!address) return alert('All fields required');
    if (!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits');
    const adm = await generateAdmNo();
    students.push({ name, adm, parent, contact, occupation, address, cls, sec });
    renderStudents();
  };

  function toggleEditDelete() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleEditDelete();
  });
  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(cb=>cb.checked=$('selectAllStudents').checked);
    toggleEditDelete();
  };

  let editMode = false;
  $('editSelected').onclick = e => {
    e.preventDefault();
    const rows = Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb=>cb.closest('tr'));
    if (!editMode) {
      rows.forEach(tr => {
        Array.from(tr.children).slice(2,8).forEach(td=>{ td.contentEditable=true; td.classList.add('editing'); });
      });
      $('editSelected').textContent = 'Done';
      editMode = true;
    } else {
      rows.forEach(tr=>{
        const idx = +tr.dataset.index;
        const fields = ['name','adm','parent','contact','occupation','address'];
        fields.forEach((f,i)=>{
          students[idx][f] = tr.children[i+2].textContent.trim();
        });
      });
      renderStudents();
      $('editSelected').textContent = 'Edit Selected';
      editMode = false;
    }
  };

  $('deleteSelected').onclick = e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    const keep = [];
    document.querySelectorAll('tr').forEach(tr=>{
      const cb = tr.querySelector('.sel');
      if (!cb || !cb.checked) {
        const i = +tr.dataset.index;
        keep.push(students[i]);
      }
    });
    students = keep;
    renderStudents();
  };

  $('saveRegistration').onclick = async () => {
    await saveStudents();
    hide($('editSelected'));
    hide($('deleteSelected'));
    hide($('selectAllStudents'));
    hide($('saveRegistration'));
    show($('shareRegistration'));
    show($('editRegistration'));
    show($('downloadRegistrationPDF'));
  };
  $('editRegistration').onclick = () => {
    show($('editSelected'));
    show($('deleteSelected'));
    show($('selectAllStudents'));
    show($('saveRegistration'));
    hide($('shareRegistration'));
    hide($('editRegistration'));
    hide($('downloadRegistrationPDF'));
  };
  $('downloadRegistrationPDF').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html: '#studentsTable' });
    doc.save('registration.pdf');
  };
  $('shareRegistration').onclick = () => {
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const hdr = `*Students List* Class:${cls} Section:${sec}`;
    const lines = students.filter(s=>s.cls===cls&&s.sec===sec)
      .map(s=>`${s.adm}: ${s.name}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`, '_blank');
  };

  // --- ATTENDANCE SECTION ---
  $('loadAttendance').onclick = () => {
    const tbody = $('attendanceBody');
    tbody.innerHTML = '';
    students.forEach((stu,i)=>{
      const tr = document.createElement('tr');
      tr.dataset.roll = stu.roll;
      tr.innerHTML = `
        <td>${stu.name}</td>
        <td>
          <select class="statusSelect">
            <option value="P">Present</option>
            <option value="A">Absent</option>
            <option value="Lt">Late</option>
            <option value="HD">Half Day</option>
            <option value="L">Leave</option>
          </select>
        </td>
      `;
      tbody.appendChild(tr);
    });
    show($('saveAttendance'));
  };

  $('saveAttendance').onclick = async () => {
    const date = $('dateInput').value;
    if (!date) return alert('Pick date');
    attendanceData[date] = {};
    document.querySelectorAll('#attendanceBody tr').forEach(tr=>{
      const roll = tr.dataset.roll;
      const code = tr.querySelector('.statusSelect').value;
      attendanceData[date][roll] = code;
    });
    await saveAttendanceData();
    show($('shareAttendanceSummary'));
    show($('downloadAttendancePDF'));
  };
  $('downloadAttendancePDF').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html: '#attendanceTable' });
    doc.save('attendance.pdf');
  };
  $('shareAttendanceSummary').onclick = () => {
    const date = $('dateInput').value;
    const hdr = `*Attendance* Date:${date}`;
    const lines = students.map(s=>{
      const code = attendanceData[date][s.roll]||'A';
      return `${s.name}: ${code}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`, '_blank');
  };

  // --- ANALYTICS SECTION ---
  const ctxBar = $('barChart').getContext('2d');
  const ctxPie = $('pieChart').getContext('2d');
  let chartBar, chartPie;

  $('analyticsTarget').onchange = function(){
    $('analyticsType').disabled = false;
    hide($('analyticsSectionSelect'));
    hide($('labelSection'));
    hide($('analyticsFilter'));
    hide($('labelFilter'));
    hide($('analyticsStudentInput'));
    if (this.value==='section') {
      show($('labelSection'));
      show($('analyticsSectionSelect'));
    }
    if (this.value==='student') {
      show($('labelFilter'));
      show($('analyticsFilter'));
    }
  };

  $('analyticsFilter').onchange = function(){
    const sel = $('analyticsStudentInput');
    sel.innerHTML = '<option disabled selected>-- Pick --</option>' +
      students.map(s=>`<option value="${s.roll}">${s.name} (${s.adm})</option>`).join('');
    show(sel);
  };

  $('analyticsType').onchange = function(){
    ['analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart'].forEach(id=>hide($(id)));
    show($('resetAnalytics'));
    if (this.value==='date') show($('analyticsDate'));
    if (this.value==='month') show($('analyticsMonth'));
    if (this.value==='semester') { show($('semesterStart')); show($('semesterEnd')); }
    if (this.value==='year') show($('yearStart'));
  };

  $('loadAnalytics').onclick = () => {
    const tgt = $('analyticsTarget').value;
    const typ = $('analyticsType').value;
    let from, to;
    if (typ==='date') { from = to = $('analyticsDate').value; }
    else if (typ==='month') {
      const m = $('analyticsMonth').value;
      const [y,mm] = m.split('-').map(Number);
      from = `${m}-01`;
      to   = `${m}-${new Date(y,mm,0).getDate()}`;
    }
    else if (typ==='semester') {
      const s = $('semesterStart').value, e = $('semesterEnd').value;
      const [sy,sm]=s.split('-').map(Number), [ey,em]=e.split('-').map(Number);
      from = `${s}-01`; to = `${e}-${new Date(ey,em,0).getDate()}`;
    }
    else if (typ==='year') {
      const y = $('yearStart').value;
      from = `${y}-01-01`; to = `${y}-12-31`;
    }
    else { alert('Select period'); return; }

    let pool = students.slice();
    if (tgt==='class') {}
    if (tgt==='section') {
      const sec = $('analyticsSectionSelect').value;
      pool = pool.filter(s=>s.sec===sec);
    }
    if (tgt==='student') {
      const roll = $('analyticsStudentInput').value;
      pool = pool.filter(s=>String(s.roll)===roll);
    }

    const stats = pool.map(s=>({ name:s.name, roll:s.roll, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    Object.entries(attendanceData).forEach(([date, recs])=>{
      if (date<from||date>to) return;
      stats.forEach(st=>{ const c=recs[st.roll]||'A'; st[c]++; st.total++; });
    });

    // render table
    const tb = $('analyticsBody');
    tb.innerHTML = '';
    stats.forEach((st,i)=>{
      const pct = st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${st.name}</td><td>${pct}%</td>`;
      tb.appendChild(tr);
    });
    show($('analyticsContainer'));
    show($('graphs'));
    show($('analyticsActions'));

    // bar chart
    const labels = stats.map(s=>s.name);
    const dataPct = stats.map(s=> s.total? s.P/s.total*100: 0 );
    chartBar?.destroy();
    chartBar = new Chart(ctxBar, {
      type:'bar',
      data:{ labels, datasets:[{ label:'% Present', data:dataPct }]},
      options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
    });
    // pie chart
    const agg = stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    chartPie?.destroy();
    chartPie = new Chart(ctxPie, {
      type:'pie',
      data:{ labels:['P','A','Lt','HD','L'], datasets:[{ data:Object.values(agg) }] }
    });
  };

  $('downloadAnalytics').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html:'#analyticsTable' });
    doc.save('analytics.pdf');
  };
  $('shareAnalytics').onclick = () => {
    const lines = Array.from($('analyticsBody').children).map(tr=>tr.textContent.trim());
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  // --- ATTENDANCE REGISTER ---
  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value;
    if (!m) return alert('Pick month');
    const [y,mm] = m.split('-').map(Number);
    const days = new Date(y,mm,0).getDate();
    // header
    const head = $('registerTable').querySelector('thead tr');
    head.innerHTML = '<th>Sr#</th><th>Adm#</th><th>Name</th>' +
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    // body
    const tb = $('registerBody');
    tb.innerHTML = '';
    students.forEach((s,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
        Array.from({length:days},(_,d)=>{
          const key = `${m}-${String(d+1).padStart(2,'0')}`;
          const code = (attendanceData[key]||{})[s.roll]||'A';
          return `<td>${code}</td>`;
        }).join('');
      tb.appendChild(tr);
    });
    show($('registerTableWrapper'));
  };
});
