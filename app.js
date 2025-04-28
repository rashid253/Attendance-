// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // Eruda
  (function(){
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/eruda';
    s.onload = () => eruda.init();
    document.body.appendChild(s);
  })();

  // IndexedDB
  if (!window.idbKeyval) return console.error('idbKeyval not found');
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
    const [school, cls, sec] = await Promise.all([
      get('schoolName'), get('teacherClass'), get('teacherSection')
    ]);
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
    await Promise.all([
      set('schoolName', school),
      set('teacherClass', cls),
      set('teacherSection', sec)
    ]);
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
        <td>${i+1}</td>
        <td>${stu.name}</td><td>${stu.adm}</td>
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
    if (!name||!parent||!contact||!occupation||!address)
      return alert('All fields required');
    if (!/^\d{7,15}$/.test(contact))
      return alert('Contact must be 7–15 digits');
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
    const toDelete = Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb => +cb.closest('tr').dataset.index);
    students = students.filter((_,i)=>!toDelete.includes(i));
    await saveStudents();
    renderStudents(); updateCounters();
  };

  // Excel-style Edit
  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach(cb => {
      const tr = cb.closest('tr'), idx = +tr.dataset.index, stu = students[idx];
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" checked></td>
        <td>${idx+1}</td>
        <td><input value="${stu.name}"></td>
        <td>${stu.adm}</td>
        <td><input value="${stu.parent}"></td>
        <td><input value="${stu.contact}"></td>
        <td><input value="${stu.occupation}"></td>
        <td><input value="${stu.address}"></td>
      `;
    });
    $('saveRegistration').disabled = false;
  };

  // Save (both add & edits) + Share formatting
  $('saveRegistration').onclick = async () => {
    // apply inline edits
    document.querySelectorAll('#studentsBody tr').forEach(tr => {
      const inputs = tr.querySelectorAll('input:not(.sel)');
      if (inputs.length === 5) {
        const [name, parent, contact, occupation, address] =
          Array.from(inputs).map(i=>i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(s=>s.adm===adm);
        if (idx>-1) {
          students[idx] = { ...students[idx], name, parent, contact, occupation, address };
        }
      }
    });
    await saveStudents();
    // hide editing buttons
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>hide($(id)));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id=>show($(id)));
  };

  // Share with formatted text
  $('shareRegistration').onclick = () => {
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    const header = `Students List – Class ${cls} Section ${sec}`;
    const lines = students
      .filter(s=>s.cls===cls && s.sec===sec)
      .map(s=>
        `*${s.name}*\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
      ).join('\n\n');
    window.open(
      `https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank'
    );
  };

  $('downloadRegistrationPDF').onclick = () => {
    const doc = new window.jspdf.jsPDF();
    doc.autoTable({ html: '#studentsTable' });
    doc.save('registration.pdf');
  };
  $('editRegistration').onclick = e => {
    e.preventDefault();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>show($(id)));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id=>hide($(id)));
  };

  // 4. ATTENDANCE SECTION
  const dateInput = $('dateInput'),
        loadAttendance = $('loadAttendance'),
        saveAttendance = $('saveAttendance'),
        resetAttendance = $('resetAttendance'),
        downloadAttendancePDF = $('downloadAttendancePDF'),
        shareAttendanceSummary = $('shareAttendanceSummary'),
        attendanceBody = $('attendanceBody'),
        attendanceSummary = $('attendanceSummary');

  const statusNames = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' };
  const statusColors = {
    Present: 'var(--success)',
    Absent:  'var(--danger)',
    Late:    'var(--warning)',
    'Half Day': '#FF9800',
    Leave:   'var(--info)'
  };

  loadAttendance.onclick = () => {
    attendanceBody.innerHTML = '';
    students.forEach(stu => {
      const row = document.createElement('div'); row.className='attendance-row';
      const nameDiv = document.createElement('div');
      nameDiv.className='attendance-name'; nameDiv.textContent = stu.name;
      const btns = document.createElement('div'); btns.className='attendance-buttons';
      Object.keys(statusNames).forEach(code => {
        const btn = document.createElement('button');
        btn.className='att-btn'; btn.textContent = code;
        btn.onclick = () => {
          btns.querySelectorAll('.att-btn').forEach(b=>b.classList.remove('selected'));
          btn.classList.add('selected');
          const fullname = statusNames[code];
          btn.style.background = statusColors[fullname];
          btn.style.color = '#fff';
        };
        btns.appendChild(btn);
      });
      row.append(nameDiv, btns);
      attendanceBody.appendChild(row);
    });
    ['saveAttendance'].forEach(show);
    ['resetAttendance','downloadAttendancePDF','shareAttendanceSummary','attendanceSummary']
      .forEach(hide);
  };

  saveAttendance.onclick = async () => {
    const date = dateInput.value;
    if (!date) return alert('Pick a date');
    const reportTab = document.createElement('table');
    reportTab.innerHTML = '<tr><th>Name</th><th>Status</th></tr>';
    attendanceData[date] = {};
    attendanceBody.querySelectorAll('.attendance-row').forEach((row,i) => {
      const code = row.querySelector('.att-btn.selected')?.textContent || 'A';
      const student = students[i];
      const status = statusNames[code];
      attendanceData[date][student.adm] = code;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${student.name}</td><td>${status}</td>`;
      reportTab.appendChild(tr);
    });
    await saveAttendanceData();

    attendanceSummary.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    attendanceSummary.appendChild(reportTab);

    ['saveAttendance','attendanceBody'].forEach(hide);
    ['resetAttendance','downloadAttendancePDF','shareAttendanceSummary','attendanceSummary'].forEach(show);
  };

  downloadAttendancePDF.onclick = () => {
    const doc = new window.jspdf.jsPDF();
    doc.autoTable({ html: '#attendanceSummary table' });
    doc.save('attendance_summary.pdf');
  };

  shareAttendanceSummary.onclick = () => {
    let text = attendanceSummary.textContent.trim();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  resetAttendance.onclick = () => {
    ['attendanceBody','saveAttendance'].forEach(show);
    ['resetAttendance','downloadAttendancePDF','shareAttendanceSummary','attendanceSummary'].forEach(hide);
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
    analyticsSection.classList.toggle('hidden', analyticsTarget.value!=='section');
    hideAnalyticsAll();
  };

  analyticsType.onchange = () => {
    hideAnalyticsAll();
    if (analyticsType.value==='date') show(analyticsDate);
    if (analyticsType.value==='month') show(analyticsMonth);
    if (analyticsType.value==='semester') { show(semesterStart); show(semesterEnd); }
    if (analyticsType.value==='year') show(yearStart);
    show(resetAnalyticsBtn);
  };

  resetAnalyticsBtn.onclick = e => {
    e.preventDefault();
    hideAnalyticsAll();
    analyticsType.value = '';
  };

  loadAnalyticsBtn.onclick = () => {
    let from, to, typ = analyticsType.value;
    if (typ==='date')      from=to=analyticsDate.value;
    else if (typ==='month'){ const [y,m]=analyticsMonth.value.split('-').map(Number);
      from=`${analyticsMonth.value}-01`;
      to  =`${analyticsMonth.value}-${new Date(y,m,0).getDate()}`; }
    else if (typ==='semester'){ const [sy,sm]=semesterStart.value.split('-').map(Number),
          [ey,em]=semesterEnd.value.split('-').map(Number);
      from=`${semesterStart.value}-01`;
      to  =`${semesterEnd.value}-${new Date(ey,em,0).getDate()}`; }
    else if (typ==='year')  { from=`${yearStart.value}-01-01`; to=`${yearStart.value}-12-31`; }
    else { alert('Select period'); return; }

    // filter by search
    const q = analyticsSearch.value.trim().toLowerCase();
    let pool = students.slice();
    if (q) {
      if (/^\d+$/.test(q)) pool = students.filter(s=>s.adm===q);
      else pool = students.filter(s=>s.name.toLowerCase().includes(q));
    }

    // stats
    const stats = pool.map(s=>({ name:s.name, adm:s.adm, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      if (d<from||d>to) return;
      stats.forEach(st=>{ const c = recs[st.adm]||'A'; st[c]++; st.total++; });
    });

    // render table
    const head = $('analyticsTable').querySelector('thead tr');
    head.innerHTML = '<th>#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th>';
    const body = $('analyticsBody'); body.innerHTML = '';
    stats.forEach((st,i)=>{
      const pct = st.total?((st.P/st.total)*100).toFixed(1):'0.0';
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
      type:'bar',
      data:{ labels:stats.map(s=>s.name),
             datasets:[{ label:'% Present', data:stats.map(s=> s.total? s.P/s.total*100 :0) }] },
      options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
    });
    const agg = stats.reduce((a,s)=>{ ['P','A','Lt','HD','L'].forEach(k=>a[k]+=s[k]); return a; },
                              {P:0,A:0,Lt:0,HD:0,L:0});
    pieChart?.destroy();
    pieChart = new Chart(pieCtx, {
      type:'pie',
      data:{ labels:['P','A','Lt','HD','L'], datasets:[{ data:Object.values(agg) }] }
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
    doc.autoTable({ html:'#analyticsTable' });
    doc.save('analytics.pdf');
  };

  // 6. ATTENDANCE REGISTER
  const loadRegisterBtn    = $('loadRegister'),
        changeRegisterBtn  = $('changeRegister'),
        downloadRegister   = $('downloadRegister'),
        shareRegister      = $('shareRegister'),
        monthInput         = $('registerMonth');

  loadRegisterBtn.onclick = () => {
    const m = monthInput.value; if(!m) return alert('Pick month');
    const [y,mm] = m.split('-').map(Number),
          days = new Date(y,mm,0).getDate();
    $('registerHeader').innerHTML =
      '<th>#</th><th>Adm#</th><th>Name</th>' +
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    const tb = $('registerBody'); tb.innerHTML = '';
    students.forEach((s,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
        Array.from({length:days},()=>`<td class="reg-cell">A</td>`).join('');
      tb.appendChild(tr);
    });

    // make cells interactive
    document.querySelectorAll('.reg-cell').forEach(cell => {
      // error icon
      const icon = document.createElement('i');
      icon.className = 'fas fa-times error-icon';
      cell.appendChild(icon);

      cell.addEventListener('click', () => {
        const order = ['A','P','Lt','HD','L'];
        let idx = order.indexOf(cell.firstChild.textContent);
        idx = (idx + 1) % order.length;
        const code = order[idx];
        cell.firstChild.textContent = code;
        // apply color
        const status = { P:'var(--success)', A:'', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' }[code];
        cell.style.background = status || '';
        cell.style.color = code==='A'?'': '#fff';
      });
      icon.addEventListener('click', e => {
        e.stopPropagation();
        cell.firstChild.textContent = 'A';
        cell.style.background = '';
        icon.style.display = 'none';
      });
      cell.addEventListener('mouseenter', () => { icon.style.display='block'; });
      cell.addEventListener('mouseleave', () => { icon.style.display='none'; });
    });

    show($('registerTableWrapper'), changeRegisterBtn, downloadRegister, shareRegister);
    hide(loadRegisterBtn);
  };

  changeRegisterBtn.onclick = () => {
    hide($('registerTableWrapper'), changeRegisterBtn, downloadRegister, shareRegister);
    show(loadRegisterBtn);
  };

  downloadRegister.onclick = () => {
    const doc = new window.jspdf.jsPDF();
    doc.autoTable({ html:'#registerTable' });
    doc.save('attendance_register.pdf');
  };

  shareRegister.onclick = () => {
    const hdr = `Attendance Register: ${monthInput.value}`;
    const rows = Array.from($('registerBody').children).map(tr=>
      Array.from(tr.children).map(td=>td.textContent.trim()).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`,'_blank');
  };

  // SERVICE WORKER
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(console.error);
});
