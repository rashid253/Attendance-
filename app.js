// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- Eruda (floating error console) ---
  (function() {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/eruda';
    s.onload = () => eruda.init();
    document.body.appendChild(s);
  })();

  // --- IndexedDB helpers via idb-keyval ---
  const { get, set } = window.idbKeyval;
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;

  const saveStudents       = async () => await set('students', students);
  const saveAttendanceData = async () => await set('attendanceData', attendanceData);
  const saveLastAdmNo      = async () => await set('lastAdmissionNo', lastAdmNo);

  async function generateAdmNo() {
    lastAdmNo++;
    await saveLastAdmNo();
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- DOM helpers ---
  const $ = id => document.getElementById(id);
  function show(el){ el.classList.remove('hidden'); }
  function hide(el){ el.classList.add('hidden'); }

  // --- SETUP SECTION ---
  async function loadSetup() {
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if (school && cls && sec) {
      $('schoolNameInput').value      = school;
      $('teacherClassSelect').value   = cls;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent      = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderStudents();
      updateCounters();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const school = $('schoolNameInput').value.trim(),
          cls    = $('teacherClassSelect').value,
          sec    = $('teacherSectionSelect').value;
    if (!school||!cls||!sec) return alert('Complete setup');
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
      let count = 0, step = Math.max(1, target/100);
      (function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
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
  $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); };

  // --- STUDENT REGISTRATION ---
  function renderStudents() {
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value,
          tbody = $('studentsBody');
    tbody.innerHTML = '';
    students.filter(s=>s.cls===cls&&s.sec===sec)
      .forEach((stu,i)=> {
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
    const name       = $('studentName').value.trim(),
          parent     = $('parentName').value.trim(),
          contact    = $('parentContact').value.trim(),
          occupation = $('parentOccupation').value.trim(),
          address    = $('parentAddress').value.trim(),
          cls        = $('teacherClassSelect').value,
          sec        = $('teacherSectionSelect').value;
    if (!name||!parent||!contact||!occupation||!address) return alert('All fields required');
    if (!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits');
    const adm = await generateAdmNo();
    students.push({ name, adm, parent, contact, occupation, address, cls, sec });
    await saveStudents();
    renderStudents();
  };

  function toggleEditDelete() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled   = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleEditDelete();
  });
  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(cb => cb.checked = $('selectAllStudents').checked);
    toggleEditDelete();
  };

  $('editSelected').onclick = e => {
    e.preventDefault();
    const rows = Array.from(document.querySelectorAll('.sel:checked')).map(cb => cb.closest('tr'));
    rows.forEach(tr => {
      Array.from(tr.children).slice(2,8).forEach(td => {
        td.contentEditable = true;
        td.classList.add('editing');
      });
    });
    $('editSelected').textContent = 'Done';
    $('editSelected').onclick = async evt => {
      evt.preventDefault();
      rows.forEach(tr => {
        const idx = +tr.dataset.index;
        ['name','adm','parent','contact','occupation','address'].forEach((f,i) => {
          students[idx][f] = tr.children[i+2].textContent.trim();
        });
      });
      await saveStudents();
      renderStudents();
      $('editSelected').textContent = 'Edit Selected';
      // rebind original
      $('editSelected').onclick = arguments.callee.caller;
    };
  };

  $('deleteSelected').onclick = async e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    students = students.filter((_,i)=>
      !Array.from(document.querySelectorAll('.sel'))
        .some(cb=>cb.checked && +cb.closest('tr').dataset.index===i)
    );
    await saveStudents();
    renderStudents();
  };

  $('saveRegistration').onclick = async () => {
    await saveStudents();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>hide($(id)));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>show($(id)));
  };
  $('editRegistration').onclick = e => {
    e.preventDefault();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>show($(id)));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>hide($(id)));
  };
  $('downloadRegistrationPDF').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html:'#studentsTable' });
    doc.save('registration.pdf');
  };
  $('shareRegistration').onclick = () => {
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value,
          hdr = `*Students* Class:${cls} Sec:${sec}`,
          lines = students.filter(s=>s.cls===cls&&s.sec===sec).map(s=>`${s.adm}: ${s.name}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`, '_blank');
  };

  // --- ATTENDANCE SECTION (polished) ---
  const dateInput             = $('dateInput'),
        loadAttendance        = $('loadAttendance'),
        saveAttendance        = $('saveAttendance'),
        resetAttendance       = $('resetAttendance'),
        downloadAttendancePDF = $('downloadAttendancePDF'),
        shareAttendanceSummary= $('shareAttendanceSummary'),
        attendanceBody        = $('attendanceBody'),
        attendanceSummary     = $('attendanceSummary');

  const attColors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  loadAttendance.onclick = () => {
    attendanceBody.innerHTML = '';
    students.forEach((stu, idx) => {
      const row = document.createElement('div');
      row.className = 'attendance-row';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'attendance-name';
      nameDiv.textContent = stu.name;
      row.appendChild(nameDiv);

      const btns = document.createElement('div');
      btns.className = 'attendance-buttons';
      ['P','A','Lt','HD','L'].forEach(code => {
        const btn = document.createElement('button');
        btn.className = 'att-btn';
        btn.textContent = code;
        btn.style.color = 'transparent';
        btn.onclick = () => {
          btns.querySelectorAll('.att-btn').forEach(b => {
            b.classList.remove('selected');
            b.style.background = '';
            b.style.color = 'transparent';
          });
          btn.classList.add('selected');
          btn.style.background = attColors[code];
          btn.style.color = '#fff';
        };
        btns.appendChild(btn);
      });
      row.appendChild(btns);
      attendanceBody.appendChild(row);
    });
    show(saveAttendance);
    hide(resetAttendance);
    hide(downloadAttendancePDF);
    hide(shareAttendanceSummary);
    hide(attendanceSummary);
  };

  saveAttendance.onclick = async () => {
    const date = dateInput.value;
    if (!date) return alert('Pick a date');

    attendanceData[date] = {};
    Array.from(attendanceBody.querySelectorAll('.attendance-row')).forEach((row,i) => {
      const sel = row.querySelector('.att-btn.selected');
      const code = sel ? sel.textContent : 'A';
      attendanceData[date][students[i].roll] = code;
    });
    await saveAttendanceData();

    hide(saveAttendance);
    hide(attendanceBody);

    attendanceSummary.innerHTML = `<h3>Date: ${date}</h3><h4>Attendance Summary</h4><ul>` +
      students.map(s => {
        const c = attendanceData[date][s.roll]||'A';
        const txt = {P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'}[c];
        return `<li>${s.name}: ${txt}</li>`;
      }).join('') +
      `</ul>`;
    show(attendanceSummary);
    show(resetAttendance);
    show(downloadAttendancePDF);
    show(shareAttendanceSummary);
  };

  downloadAttendancePDF.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const date = dateInput.value;
    doc.text('Attendance Summary',10,10);
    doc.text(`Date: ${date}`,10,16);
    const lines = Array.from(attendanceSummary.querySelectorAll('li')).map(li=>li.textContent);
    doc.autoTable({ head:[['Student & Status']], body:lines.map(l=>[l]), startY:24 });
    doc.save('attendance_summary.pdf');
  };

  shareAttendanceSummary.onclick = () => {
    const date = dateInput.value;
    const hdr  = `Attendance Summary\nDate: ${date}`;
    const lines= Array.from(attendanceSummary.querySelectorAll('li')).map(li=>li.textContent);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`, '_blank');
  };

  resetAttendance.onclick = () => {
    show(attendanceBody);
    show(saveAttendance);
    hide(attendanceSummary);
    hide(resetAttendance);
    hide(downloadAttendancePDF);
    hide(shareAttendanceSummary);
  };

  // --- ANALYTICS SECTION ---
  const analyticsTarget     = $('analyticsTarget'),
        analyticsSection    = $('analyticsSectionSelect'),
        analyticsFilter     = $('analyticsFilter'),
        analyticsStudent    = $('analyticsStudentInput'),
        analyticsType       = $('analyticsType'),
        analyticsDate       = $('analyticsDate'),
        analyticsMonth      = $('analyticsMonth'),
        semesterStartInput  = $('semesterStart'),
        semesterEndInput    = $('semesterEnd'),
        yearStartInput      = $('yearStart'),
        loadAnalyticsBtn    = $('loadAnalytics'),
        resetAnalyticsBtn   = $('resetAnalytics'),
        instructionsEl      = $('instructions'),
        analyticsContainer  = $('analyticsContainer'),
        graphsEl            = $('graphs'),
        analyticsActionsEl  = $('analyticsActions'),
        shareAnalyticsBtn   = $('shareAnalytics'),
        downloadAnalyticsBtn= $('downloadAnalytics'),
        barCtx              = $('barChart').getContext('2d'),
        pieCtx              = $('pieChart').getContext('2d');
  let barChart, pieChart;

  function hideAllAnalytics() {
    [analyticsDate, analyticsMonth, semesterStartInput, semesterEndInput,
     yearStartInput, instructionsEl, analyticsContainer, graphsEl,
     analyticsActionsEl, resetAnalyticsBtn].forEach(el=>hide(el));
  }

  analyticsTarget.onchange = () => {
    analyticsType.disabled = false;
    hideAllAnalytics();
    $('labelSection').classList.toggle('hidden', analyticsTarget.value!=='section');
    analyticsSection.classList.toggle('hidden', analyticsTarget.value!=='section');
    $('labelFilter').classList.toggle('hidden', analyticsTarget.value!=='student');
    analyticsFilter.classList.toggle('hidden', analyticsTarget.value!=='student');
    analyticsStudent.classList.add('hidden');
  };

  analyticsFilter.onchange = () => {
    analyticsStudent.innerHTML = '<option disabled selected>-- Pick --</option>' +
      students.map(s=>`<option value="${s.roll}">${s.name} (${s.adm})</option>`).join('');
    analyticsStudent.classList.remove('hidden');
  };

  analyticsType.onchange = () => {
    hideAllAnalytics();
    if (analyticsType.value==='date') show(analyticsDate);
    if (analyticsType.value==='month') show(analyticsMonth);
    if (analyticsType.value==='semester') { show(semesterStartInput); show(semesterEndInput); }
    if (analyticsType.value==='year') show(yearStartInput);
    show(resetAnalyticsBtn);
  };

  resetAnalyticsBtn.onclick = e => {
    e.preventDefault();
    hideAllAnalytics();
    analyticsType.value = '';
  };

  loadAnalyticsBtn.onclick = () => {
    const tgt = analyticsTarget.value, typ = analyticsType.value;
    let from, to;
    if (typ==='date')      from=to=analyticsDate.value;
    else if (typ==='month'){const [y,m]=analyticsMonth.value.split('-').map(Number);
      from=`${analyticsMonth.value}-01`; to=`${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;}
    else if (typ==='semester'){const [sy,sm]=semesterStartInput.value.split('-').map(Number),
          [ey,em]=semesterEndInput.value.split('-').map(Number);
      from=`${semesterStartInput.value}-01`; to=`${semesterEndInput.value}-${new Date(ey,em,0).getDate()}`;}
    else if (typ==='year')  from=`${yearStartInput.value}-01-01`,to=`${yearStartInput.value}-12-31`;
    else return alert('Select period');

    let pool=students.slice();
    if (tgt==='section') pool=pool.filter(s=>s.sec===analyticsSection.value);
    if (tgt==='student') pool=pool.filter(s=>String(s.roll)===analyticsStudent.value);

    const stats=pool.map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      if (d<from||d>to) return;
      stats.forEach(st=>{const c=recs[st.roll]||'A';st[c]++;st.total++;});
    });

    const thead = $('analyticsTable').querySelector('thead tr');
    thead.innerHTML = '<th>Sr#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th>';
    const tbody = $('analyticsBody');
    tbody.innerHTML = '';
    stats.forEach((st,i)=>{
      const pct = st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td>
                      <td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${pct}%</td>`;
      tbody.appendChild(tr);
    });

    instructionsEl.textContent = `Period: ${from} to ${to}`;
    show(instructionsEl); show(analyticsContainer); show(graphsEl); show(analyticsActionsEl); show(resetAnalyticsBtn);

    const labels = stats.map(s=>s.name);
    const dataPct = stats.map(s=> s.total? s.P/s.total*100:0 );
    barChart?.destroy();
    barChart = new Chart(barCtx, { type:'bar', data:{labels,datasets:[{label:'% Present',data:dataPct}]}, options:{scales:{y:{beginAtZero:true,max:100}}}});
    const agg=stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    pieChart?.destroy();
    pieChart = new Chart(pieCtx, { type:'pie', data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg)}]}});
  };

  shareAnalyticsBtn.onclick = () => {
    const hdr = instructionsEl.textContent;
    const rows = Array.from($('analyticsBody').children).map(tr=>tr.textContent.trim());
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`, '_blank');
  };

  downloadAnalyticsBtn.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html:'#analyticsTable' });
    doc.save('analytics.pdf');
  };

  // --- ATTENDANCE REGISTER ---
  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value;
    if (!m) return alert('Pick month');
    const [y,mm] = m.split('-').map(Number);
    const days = new Date(y,mm,0).getDate();
    const head = $('registerTable thead tr');
    head.innerHTML = '<th>Sr#</th><th>Adm#</th><th>Name</th>' +
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    const tb = $('registerBody');
    tb.innerHTML = '';
    students.forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
        Array.from({length:days},(_,d)=>{
          const key=`${m}-${String(d+1).padStart(2,'0')}`;
          return `<td>${attendanceData[key]?.[s.roll]||'A'}</td>`;
        }).join('');
      tb.appendChild(tr);
    });
    show($('registerTableWrapper'));
  };

  // --- SERVICE WORKER ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('service-worker.js')
        .then(reg=>console.log('SW registered', reg.scope))
        .catch(err=>console.error('SW failed', err));
    });
  }
});
