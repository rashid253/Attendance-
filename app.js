// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // Eruda Debug Console
  (function(){
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/eruda';
    s.onload = () => eruda.init();
    document.body.appendChild(s);
  })();

  // idb-keyval IndexedDB
  if (!window.idbKeyval) { console.error('idbKeyval not found'); return; }
  const { get, set } = window.idbKeyval;

  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;
  const saveStudents       = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);
  const saveLastAdmNo      = () => set('lastAdmissionNo', lastAdmNo);

  async function generateAdmNo() {
    lastAdmNo++; await saveLastAdmNo();
    return String(lastAdmNo).padStart(4, '0');
  }

  const $ = id => document.getElementById(id);
  const show = el => el && el.classList.remove('hidden');
  const hide = el => el && el.classList.add('hidden');

  // 1. SETUP
  async function loadSetup() {
    const [school, cls, sec] = await Promise.all([get('schoolName'), get('teacherClass'), get('teacherSection')]);
    if (school && cls && sec) {
      $('schoolNameInput').value = school;
      $('teacherClassSelect').value = cls;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      hide($('setupForm')); show($('setupDisplay'));
      renderStudents(); updateCounters();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const school = $('schoolNameInput').value.trim(),
          cls    = $('teacherClassSelect').value,
          sec    = $('teacherSectionSelect').value;
    if (!school||!cls||!sec) return alert('Complete setup');
    await Promise.all([set('schoolName', school), set('teacherClass', cls), set('teacherSection', sec)]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // 2. COUNTERS
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target/100);
      (function update() {
        count += step;
        span.textContent = count<target? Math.ceil(count): target;
        if (count<target) requestAnimationFrame(update);
      })();
    });
  }
  function updateCounters() {
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cls&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cls).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  $('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); };

  // 3. STUDENT REGISTRATION
  function renderStudents() {
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody'); tbody.innerHTML = '';
    students.filter(s=>s.cls===cls&&s.sec===sec).forEach((stu,i) => {
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${i+1}</td><td>${stu.name}</td><td>${stu.adm}</td>
        <td>${stu.parent}</td><td>${stu.contact}</td>
        <td>${stu.occupation}</td><td>${stu.address}</td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleSelectionButtons();
  }
  $('addStudent').onclick = async e => {
    e.preventDefault();
    const name = $('studentName').value.trim(),
          parent = $('parentName').value.trim(),
          contact = $('parentContact').value.trim(),
          occupation = $('parentOccupation').value.trim(),
          address = $('parentAddress').value.trim(),
          cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    if (!name||!parent||!contact||!occupation||!address) return alert('All fields required');
    if (!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits');
    const adm = await generateAdmNo();
    students.push({ name, adm, parent, contact, occupation, address, cls, sec });
    await saveStudents();
    renderStudents(); updateCounters();
  };
  function toggleSelectionButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleSelectionButtons();
  });
  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(cb => cb.checked = $('selectAllStudents').checked);
    toggleSelectionButtons();
  };
  $('deleteSelected').onclick = async e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    students = students.filter((_,i)=>
      !Array.from(document.querySelectorAll('.sel')).some(cb=>cb.checked&&+cb.closest('tr').dataset.index===i)
    );
    await saveStudents();
    renderStudents(); updateCounters();
  };
  $('saveRegistration').onclick = async () => {
    await saveStudents();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>hide($(id)));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>show($(id)));
  };
  $('downloadRegistrationPDF').onclick = () => {
    const doc = new window.jspdf.jsPDF();
    doc.autoTable({ html: '#studentsTable' });
    doc.save('registration.pdf');
  };
  $('shareRegistration').onclick = () => {
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const hdr = `Students | Class: ${cls} | Section: ${sec}`;
    const lines = students.map(s=>`${s.adm}: ${s.name}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`,'_blank');
  };
  $('editRegistration').onclick = e => {
    e.preventDefault();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>show($(id)));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>hide($(id)));
  };

  // 4. ATTENDANCE SECTION
  const dateInput   = $('dateInput'),
        loadAttendance = $('loadAttendance'),
        saveAttendance = $('saveAttendance'),
        resetAttendance = $('resetAttendance'),
        downloadAttendancePDF = $('downloadAttendancePDF'),
        shareAttendanceSummary = $('shareAttendanceSummary'),
        attendanceBody = $('attendanceBody'),
        attendanceSummary = $('attendanceSummary');
  const attColors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  loadAttendance.onclick = () => {
    attendanceBody.innerHTML = '';
    students.forEach((stu)=>{
      const row = document.createElement('div'); row.className='attendance-row';
      const nameDiv = document.createElement('div'); nameDiv.className='attendance-name'; nameDiv.textContent=stu.name;
      const btns = document.createElement('div'); btns.className='attendance-buttons';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const btn = document.createElement('button');
        btn.className='att-btn'; btn.textContent=code;
        btn.onclick=()=>{
          btns.querySelectorAll('.att-btn').forEach(b=>b.classList.remove('selected'));
          btn.classList.add('selected');
          btn.style.background=attColors[code]; btn.style.color='#fff';
        };
        btns.appendChild(btn);
      });
      row.append(nameDiv,btns); attendanceBody.appendChild(row);
    });
    show(saveAttendance); hide(resetAttendance); hide(downloadAttendancePDF); hide(shareAttendanceSummary); hide(attendanceSummary);
  };

  saveAttendance.onclick = async () => {
    const date = dateInput.value; if (!date) return alert('Pick a date');
    attendanceData[date] = {};
    attendanceBody.querySelectorAll('.attendance-row').forEach((row,i)=>{
      const sel = row.querySelector('.att-btn.selected');
      attendanceData[date][students[i].adm] = sel? sel.textContent:'A';
    });
    await saveAttendanceData();
    hide(saveAttendance); hide(attendanceBody);
    attendanceSummary.innerHTML = `<h3>Attendance Report: ${date}</h3><ul>` +
      students.map(s=>`<li>${s.name}: ${attendanceData[date][s.adm]}</li>`).join('') +
      `</ul>`;
    show(attendanceSummary); show(resetAttendance); show(downloadAttendancePDF); show(shareAttendanceSummary);
  };

  downloadAttendancePDF.onclick = () => {
    const doc = new window.jspdf.jsPDF();
    doc.text(attendanceSummary.innerText,10,10);
    doc.save('attendance_summary.pdf');
  };
  shareAttendanceSummary.onclick = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(attendanceSummary.innerText)}`,'_blank');
  };
  resetAttendance.onclick = () => {
    show(attendanceBody); show(saveAttendance); hide(attendanceSummary);
    hide(resetAttendance); hide(downloadAttendancePDF); hide(shareAttendanceSummary);
  };

  // 5. ANALYTICS SECTION
  const analyticsTarget      = $('analyticsTarget'),
        analyticsSection     = $('analyticsSectionSelect'),
        analyticsType        = $('analyticsType'),
        analyticsDate        = $('analyticsDate'),
        analyticsMonth       = $('analyticsMonth'),
        semesterStart        = $('semesterStart'),
        semesterEnd          = $('semesterEnd'),
        yearStart            = $('yearStart'),
        analyticsSearch      = $('analyticsSearch'),
        analyticsDropdown    = $('analyticsDropdown'),
        loadAnalyticsBtn     = $('loadAnalytics'),
        resetAnalyticsBtn    = $('resetAnalytics'),
        instructionsEl       = $('instructions'),
        analyticsContainerEl = $('analyticsContainer'),
        graphsEl             = $('graphs'),
        analyticsActionsEl   = $('analyticsActions'),
        shareAnalyticsBtn    = $('shareAnalytics'),
        downloadAnalyticsBtn = $('downloadAnalytics'),
        barCtx               = $('barChart').getContext('2d'),
        pieCtx               = $('pieChart').getContext('2d');
  let barChart, pieChart;

  function hideAnalyticsAll() {
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd,
     yearStart, instructionsEl, analyticsContainerEl,
     graphsEl, analyticsActionsEl, resetAnalyticsBtn].forEach(hide);
  }

  analyticsTarget.onchange = () => {
    analyticsType.disabled = false;
    analyticsSection.classList.toggle('hidden', analyticsTarget.value !== 'section');
    hideAnalyticsAll();
  };

  analyticsType.onchange = () => {
    hideAnalyticsAll();
    if (analyticsType.value === 'date') show(analyticsDate);
    if (analyticsType.value === 'month') show(analyticsMonth);
    if (analyticsType.value === 'semester') { show(semesterStart); show(semesterEnd); }
    if (analyticsType.value === 'year') show(yearStart);
    show(resetAnalyticsBtn);
  };

  resetAnalyticsBtn.onclick = e => {
    e.preventDefault();
    hideAnalyticsAll();
    analyticsType.value = '';
  };

  loadAnalyticsBtn.onclick = () => {
    // build date range
    let from, to, typ = analyticsType.value;
    if (typ === 'date')      from = to = analyticsDate.value;
    else if (typ === 'month') {
      const [y,m] = analyticsMonth.value.split('-').map(Number);
      from = `${analyticsMonth.value}-01`;
      to   = `${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (typ === 'semester') {
      const [sy,sm] = semesterStart.value.split('-').map(Number);
      const [ey,em] = semesterEnd.value.split('-').map(Number);
      from = `${semesterStart.value}-01`;
      to   = `${semesterEnd.value}-${new Date(ey,em,0).getDate()}`;
    } else if (typ === 'year') {
      from = `${yearStart.value}-01-01`;
      to   = `${yearStart.value}-12-31`;
    } else {
      alert('Select period');
      return;
    }

    // filter students by search or all
    const q = analyticsSearch.value.trim().toLowerCase();
    let pool = students.slice();
    if (q) {
      if (/^\d+$/.test(q)) pool = students.filter(s => s.adm === q);
      else pool = students.filter(s => s.name.toLowerCase().includes(q));
    }

    // stats calc
    const stats = pool.map(s => ({ name: s.name, adm: s.adm, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    Object.entries(attendanceData).forEach(([d, recs]) => {
      if (d < from || d > to) return;
      stats.forEach(st => {
        const c = recs[st.adm] || 'A';
        st[c]++;
        st.total++;
      });
    });

    // render table
    const head = $('analyticsTable').querySelector('thead tr');
    head.innerHTML = '<th>#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th>';
    const body = $('analyticsBody');
    body.innerHTML = '';
    stats.forEach((st,i) => {
      const pct = st.total ? ((st.P/st.total)*100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td>
                      <td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${pct}%</td>`;
      body.appendChild(tr);
    });

    instructionsEl.textContent = `Period: ${from} to ${to}`;
    show(instructionsEl); show(analyticsContainerEl); show(graphsEl); show(analyticsActionsEl);

    // charts
    barChart?.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: stats.map(s=>s.name),
        datasets: [{ label: '% Present', data: stats.map(s=> s.total ? s.P/s.total*100 : 0 ) }]
      },
      options: { scales: { y: { beginAtZero: true, max: 100 } } }
    });

    const agg = stats.reduce((a,s) => {
      ['P','A','Lt','HD','L'].forEach(k => a[k]+=s[k]);
      return a;
    }, { P:0,A:0,Lt:0,HD:0,L:0 });
    pieChart?.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: { labels: ['P','A','Lt','HD','L'], datasets: [{ data: Object.values(agg) }] }
    });
  };

  analyticsDropdown.onclick = () => {
    analyticsSearch.value = '';
    loadAnalyticsBtn.click();
  };

  shareAnalyticsBtn.onclick = () => {
    const hdr = instructionsEl.textContent;
    const rows = Array.from($('analyticsBody').children).map(tr=>tr.textContent.trim());
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`,'_blank');
  };

  downloadAnalyticsBtn.onclick = () => {
    const doc = new window.jspdf.jsPDF();
    doc.autoTable({ html: '#analyticsTable' });
    doc.save('analytics.pdf');
  };

  // 6. ATTENDANCE REGISTER
  const downloadRegisterBtn = $('downloadRegister'),
        shareRegisterBtn    = $('shareRegister');

  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value; if(!m) return alert('Pick month');
    const [y,mm] = m.split('-').map(Number), days = new Date(y,mm,0).getDate();
    $('registerHeader').innerHTML = '<th>#</th><th>Adm#</th><th>Name</th>' +
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    const tb = $('registerBody'); tb.innerHTML = '';
    students.forEach((s,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
                     Array.from({length:days},()=>`<td>A</td>`).join('');
      tb.appendChild(tr);
    });
    show($('registerTableWrapper'));
    show($('changeRegister')); show(downloadRegisterBtn); show(shareRegisterBtn);
    hide($('loadRegister'));
  };
  $('changeRegister').onclick = () => {
    hide($('registerTableWrapper'));
    hide($('changeRegister')); hide(downloadRegisterBtn); hide(shareRegisterBtn);
    show($('loadRegister'));
  };
  downloadRegisterBtn.onclick = () => {
    const doc = new window.jspdf.jsPDF();
    doc.autoTable({ html: '#registerTable' });
    doc.save('attendance_register.pdf');
  };
  shareRegisterBtn.onclick = () => {
    const hdr = `Attendance Register: ${$('registerMonth').value}`;
    const rows = Array.from($('registerBody').children).map(tr =>
      Array.from(tr.children).map(td=>td.textContent).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`,'_blank');
  };

  // SERVICE WORKER
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(console.error);
});
