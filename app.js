// app.js

const { get, set } = window.idbKeyval;

window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  // --- SETUP SECTION ---
  const schoolInput   = $('schoolNameInput'),
        classSelect   = $('teacherClassSelect'),
        sectionSelect = $('teacherSectionSelect'),
        btnSaveSetup  = $('saveSetup'),
        setupForm     = $('setupForm'),
        setupDisplay  = $('setupDisplay'),
        setupText     = $('setupText'),
        btnEditSetup  = $('editSetup');

  async function loadSetup() {
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if (school && cls && sec) {
      schoolInput.value   = school;
      classSelect.value   = cls;
      sectionSelect.value = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
      renderStudents();
      updateCounters();
    }
  }

  btnSaveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolInput.value || !classSelect.value || !sectionSelect.value) {
      return alert('Complete setup');
    }
    await set('schoolName', schoolInput.value);
    await set('teacherClass', classSelect.value);
    await set('teacherSection', sectionSelect.value);
    await loadSetup();
  };

  btnEditSetup.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
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
    const cls = classSelect.value, sec = sectionSelect.value;
    const sectionCount = students.filter(s => s.cls === cls && s.sec === sec).length;
    const classCount   = students.filter(s => s.cls === cls).length;
    const schoolCount  = students.length;
    $('sectionCount').dataset.target = sectionCount;
    $('classCount').dataset.target   = classCount;
    $('schoolCount').dataset.target  = schoolCount;
    animateCounters();
  }

  classSelect.onchange = updateCounters;
  sectionSelect.onchange = updateCounters;

  // --- STUDENT REGISTRATION ---
  let students = await get('students') || [];
  const saveStudents = () => set('students', students);

  let lastAdm = await get('lastAdmissionNo') || 0;
  const saveLastAdm = () => set('lastAdmissionNo', lastAdm);
  async function generateAdm() {
    lastAdm++;
    await saveLastAdm();
    return String(lastAdm).padStart(4, '0');
  }

  const studentInputs = {
    name: $('studentName'),
    parent: $('parentName'),
    contact: $('parentContact'),
    occupation: $('parentOccupation'),
    address: $('parentAddress')
  };

  const tbodyStudents = $('studentsBody'),
        selectAll     = $('selectAllStudents'),
        btnEditSel    = $('editSelected'),
        btnDeleteSel  = $('deleteSelected'),
        btnSaveReg    = $('saveRegistration'),
        btnShareReg   = $('shareRegistration'),
        btnEditReg    = $('editRegistration'),
        btnDownloadReg= $('downloadRegistrationPDF'),
        btnAddStudent = $('addStudent');

  function renderStudents() {
    const cls = classSelect.value, sec = sectionSelect.value;
    tbodyStudents.innerHTML = '';
    students.filter(s => s.cls === cls && s.sec === sec)
      .forEach((s, i) => {
        const tr = document.createElement('tr');
        tr.dataset.index = i;
        tr.innerHTML = `
          <td><input type="checkbox" class="sel"></td>
          <td>${i+1}</td>
          <td>${s.name}</td>
          <td>${s.adm}</td>
          <td>${s.parent}</td>
          <td>${s.contact}</td>
          <td>${s.occupation}</td>
          <td>${s.address}</td>
        `;
        tbodyStudents.appendChild(tr);
      });
    selectAll.checked = false;
    toggleActionButtons();
  }

  btnAddStudent.onclick = async e => {
    e.preventDefault();
    const cls = classSelect.value, sec = sectionSelect.value;
    const vals = Object.values(studentInputs).map(inp => inp.value.trim());
    if (vals.some(v => !v)) return alert('All fields required');
    if (!/^\d{7,15}$/.test(studentInputs.contact.value.trim())) {
      return alert('Contact must be 7–15 digits');
    }
    const adm = await generateAdm();
    students.push({
      name: studentInputs.name.value.trim(),
      adm,
      parent: studentInputs.parent.value.trim(),
      contact: studentInputs.contact.value.trim(),
      occupation: studentInputs.occupation.value.trim(),
      address: studentInputs.address.value.trim(),
      cls, sec
    });
    await saveStudents();
    renderStudents();
    Object.values(studentInputs).forEach(i => i.value = '');
  };

  function toggleActionButtons() {
    const any = !!tbodyStudents.querySelector('.sel:checked');
    btnEditSel.disabled   = !any;
    btnDeleteSel.disabled = !any;
  }

  tbodyStudents.addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleActionButtons();
  });
  selectAll.onchange = () => {
    tbodyStudents.querySelectorAll('.sel').forEach(cb => cb.checked = selectAll.checked);
    toggleActionButtons();
  };

  let inEdit = false;
  btnEditSel.onclick = e => {
    e.preventDefault();
    const rows = [...tbodyStudents.querySelectorAll('.sel:checked')].map(cb => cb.closest('tr'));
    if (!inEdit) {
      rows.forEach(tr => {
        [...tr.children].slice(2, 8).forEach(td => td.contentEditable = true);
      });
      btnEditSel.textContent = 'Done';
      inEdit = true;
    } else {
      rows.forEach(tr => {
        const idx = +tr.dataset.index;
        const keys = ['name','adm','parent','contact','occupation','address'];
        keys.forEach((k,i) => {
          students[idx][k] = tr.children[i+2].textContent.trim();
        });
      });
      saveStudents();
      renderStudents();
      btnEditSel.textContent = 'Edit Selected';
      inEdit = false;
    }
  };

  btnDeleteSel.onclick = async e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    const toKeep = [];
    tbodyStudents.querySelectorAll('tr').forEach(tr => {
      if (!tr.querySelector('.sel').checked) toKeep.push(students[+tr.dataset.index]);
    });
    students = toKeep;
    await saveStudents();
    renderStudents();
  };

  btnSaveReg.onclick = e => {
    e.preventDefault();
    saveStudents();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id => $(id).classList.remove('hidden'));
  };

  btnEditReg.onclick = e => {
    e.preventDefault();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id => $(id).classList.add('hidden'));
  };

  btnDownloadReg.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html: '#studentsTable', startY: 10 });
    doc.save('registration.pdf');
  };

  btnShareReg.onclick = () => {
    const cls = classSelect.value, sec = sectionSelect.value;
    const hdr = `*Students* Class:${cls} Sec:${sec}`;
    const lines = students.filter(s=>s.cls===cls&&s.sec===sec).map(s=>`${s.adm}: ${s.name}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`, '_blank');
  };

  renderStudents();

  // --- ATTENDANCE SECTION ---
  let attendanceData = await get('attendanceData') || {};

  const attendanceList = $('attendanceList'),
        btnLoadAtt    = $('loadAttendance'),
        btnSaveAtt    = $('saveAttendance'),
        btnShareAtt   = $('shareAttendanceSummary'),
        btnDownloadAtt= $('downloadAttendancePDF');

  btnLoadAtt.onclick = () => {
    attendanceList.innerHTML = '';
    const cls = classSelect.value, sec = sectionSelect.value;
    students.filter(s=>s.cls===cls&&s.sec===sec).forEach(s => {
      const div = document.createElement('div');
      div.className = 'attendance-item';
      div.innerHTML = `
        <span>${s.name}</span>
        <div class="attendance-actions">
          ${['P','A','Lt','HD','L'].map(c=>`<button data-code="${c}">${c}</button>`).join('')}
        </div>
      `;
      attendanceList.appendChild(div);
    });
    show(btnSaveAtt);
  };

  attendanceList.addEventListener('click', e => {
    if (e.target.tagName === 'BUTTON') {
      const grp = e.target.parentElement;
      grp.querySelectorAll('button').forEach(b=>{
        b.style.background = ''; b.style.color = '';
      });
      e.target.style.background = '#2196F3'; e.target.style.color = '#fff';
    }
  });

  btnSaveAtt.onclick = async () => {
    const date = $('dateInput').value;
    if (!date) return alert('Pick a date');
    attendanceData[date] = {};
    const cls = classSelect.value, sec = sectionSelect.value;
    students.filter(s=>s.cls===cls&&s.sec===sec).forEach((s,i) => {
      const div = attendanceList.children[i];
      const btn = div.querySelector('button[style*="background"]');
      attendanceData[date][s.adm] = btn ? btn.dataset.code : 'A';
    });
    await set('attendanceData', attendanceData);
    show(btnShareAtt); show(btnDownloadAtt);
  };

  btnDownloadAtt.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({
      head: [['Name','Status']],
      body: students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value)
        .map(s=>[s.name, attendanceData[$('dateInput').value][s.adm]]),
      startY: 10
    });
    doc.save('attendance.pdf');
  };

  btnShareAtt.onclick = () => {
    const date = $('dateInput').value;
    const hdr = `*Attendance* Date:${date}`;
    const lines = students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value)
      .map(s=>`${s.name}: ${attendanceData[date][s.adm]}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`, '_blank');
  };

  // --- ANALYTICS SECTION ---
  const analyticsTarget    = $('analyticsTarget'),
        analyticsSection   = $('analyticsSectionSelect'),
        analyticsAdmInput  = $('analyticsAdmInput'),
        analyticsType      = $('analyticsType'),
        analyticsDate      = $('analyticsDate'),
        analyticsMonth     = $('analyticsMonth'),
        semesterStart      = $('semesterStart'),
        semesterEnd        = $('semesterEnd'),
        yearStart          = $('yearStart'),
        btnLoadAnalytics   = $('loadAnalytics'),
        btnResetAnalytics  = $('resetAnalytics'),
        analyticsInstructions = $('analyticsInstructions'),
        analyticsContainer = $('analyticsContainer'),
        graphs             = $('graphs'),
        btnShareAnalytics  = $('shareAnalytics'),
        btnDownloadAnalytics = $('downloadAnalyticsPDF'),
        ctxBar             = $('barChart').getContext('2d'),
        ctxPie             = $('pieChart').getContext('2d');
  let chartBar, chartPie;

  analyticsTarget.onchange = () => {
    analyticsType.disabled = false;
    hide(analyticsSection); hide($('labelSection'));
    hide(analyticsAdmInput); hide($('labelAdm'));
    if (analyticsTarget.value === 'section') {
      show($('labelSection')); show(analyticsSection);
    }
    if (analyticsTarget.value === 'student') {
      show($('labelAdm')); show(analyticsAdmInput);
    }
  };

  analyticsType.onchange = () => {
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart].forEach(hide);
    show(btnResetAnalytics);
    if (analyticsType.value === 'date') show(analyticsDate);
    if (analyticsType.value === 'month') show(analyticsMonth);
    if (analyticsType.value === 'semester') { show(semesterStart); show(semesterEnd); }
    if (analyticsType.value === 'year') show(yearStart);
  };

  btnLoadAnalytics.onclick = () => {
    const tgt = analyticsTarget.value;
    const typ = analyticsType.value;
    let from, to;
    if (typ === 'date') {
      from = to = analyticsDate.value;
    } else if (typ === 'month') {
      const m = analyticsMonth.value, [y,mo] = m.split('-');
      from = `${m}-01`; to = `${m}-${new Date(y,mo,0).getDate()}`;
    } else if (typ === 'semester') {
      const s = semesterStart.value, e = semesterEnd.value;
      const [sy,sm]=s.split('-'), [ey,em]=e.split('-');
      from = `${s}-01`; to = `${e}-${new Date(ey,em,0).getDate()}`;
    } else if (typ === 'year') {
      const y = yearStart.value;
      from = `${y}-01-01`; to = `${y}-12-31`;
    } else return alert('Select period');

    let pool = students.slice();
    if (tgt === 'section') {
      pool = pool.filter(s => s.sec === analyticsSection.value);
    }
    if (tgt === 'student') {
      pool = pool.filter(s => s.adm === analyticsAdmInput.value.trim());
    }

    const stats = pool.map(s => ({ adm: s.adm, name: s.name, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    Object.entries(attendanceData).forEach(([date,recs]) => {
      if (date < from || date > to) return;
      stats.forEach(st => {
        const c = recs[st.adm] || 'A';
        st[c]++; st.total++;
      });
    });

    // render table
    let html = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s => {
      const pct = s.total ? ((s.P / s.total) * 100).toFixed(1) : '0.0';
      html += `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${pct}</td></tr>`;
    });
    html += '</tbody></table>';
    analyticsContainer.innerHTML = html;
    show(analyticsInstructions);
    analyticsInstructions.textContent = `Report: ${from} to ${to}`;
    show(analyticsContainer);
    show(graphs);
    show(btnShareAnalytics);
    show(btnDownloadAnalytics);

    // charts
    const labels = stats.map(s => s.name),
          dataPct = stats.map(s => s.total ? s.P / s.total * 100 : 0);
    chartBar?.destroy();
    chartBar = new Chart(ctxBar, { type: 'bar', data:{ labels, datasets:[{ label:'% P',data:dataPct }]}, options:{ scales:{ y:{ beginAtZero:true,max:100 }}}});
    const agg = stats.reduce((a,s)=>{ ['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]); return a; }, {P:0,A:0,Lt:0,HD:0,L:0});
    chartPie?.destroy();
    chartPie = new Chart(ctxPie, { type:'pie', data:{ labels:['P','A','Lt','HD','L'], datasets:[{ data:Object.values(agg) }]}});
  };

  btnShareAnalytics.onclick = () => {
    const lines = [...analyticsContainer.querySelectorAll('tbody tr')].map(tr => tr.textContent.trim());
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  btnDownloadAnalytics.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html: '#analyticsContainer table', startY: 10 });
    doc.save('analytics.pdf');
  };

  // --- REGISTER SECTION ---
  const loadRegisterBtn = $('loadRegister'),
        changeRegisterBtn = $('changeRegister'),
        registerTableWrapper = $('registerTableWrapper'),
        registerTable = $('registerTable'),
        registerBody = $('registerBody'),
        registerSummarySection = $('registerSummarySection'),
        registerSummaryBody = $('registerSummaryBody'),
        shareRegisterBtn = $('shareRegister'),
        downloadRegisterBtn = $('downloadRegisterPDF');

  loadRegisterBtn.onclick = () => {
    const m = $('registerMonth').value;
    if (!m) return alert('Select month');
    const [y,mo] = m.split('-').map(Number);
    const days = new Date(y,mo,0).getDate();
    const thead = registerTable.querySelector('thead tr');
    thead.innerHTML = '<th>Sr#</th><th>Adm#</th><th>Name</th>' +
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    registerBody.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
        Array.from({length:days},(_,d)=>{
          const code = (attendanceData[`${m}-${String(d+1).padStart(2,'0')}`]||{})[s.adm]||'A';
          return `<td>${code}</td>`;
        }).join('');
      registerBody.appendChild(tr);
    });
    registerSummaryBody.innerHTML = '';
    students.forEach(s => {
      let stat={P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for (let d=1; d<=days; d++){
        const code = (attendanceData[`${m}-${String(d).padStart(2,'0')}`]||{})[s.adm]||'A';
        stat[code]++; stat.total++;
      }
      const pct = stat.total?((stat.P/stat.total)*100).toFixed(1):'0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${stat.P}</td><td>${stat.A}</td><td>${stat.Lt}</td><td>${stat.HD}</td><td>${stat.L}</td><td>${pct}</td>`;
      registerSummaryBody.appendChild(tr);
    });
    show(registerTableWrapper);
    show(registerSummarySection);
    hide(loadRegisterBtn);
    show(changeRegisterBtn);
  };

  changeRegisterBtn.onclick = e => {
    e.preventDefault();
    registerTableWrapper.classList.add('hidden');
    registerSummarySection.classList.add('hidden');
    loadRegisterBtn.classList.remove('hidden');
    changeRegisterBtn.classList.add('hidden');
  };

  shareRegisterBtn.onclick = () => {
    const m = $('registerMonth').value;
    const hdr = `*Attendance Register* for ${m}`;
    const lines = [...registerSummaryBody.querySelectorAll('tr')].map(tr=>tr.textContent.trim());
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`, '_blank');
  };

  downloadRegisterBtn.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    doc.autoTable({ html: '#registerTable', startY: 10 });
    doc.autoTable({ html: '#registerSummarySection table', startY: doc.lastAutoTable.finalY + 10 });
    doc.save('register.pdf');
  };
});
