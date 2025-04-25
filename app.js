// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- STORAGE & HELPERS ---
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);

  async function saveStudents()       { await set('students', students); }
  async function saveAttendanceData(){ await set('attendanceData', attendanceData); }

  // --- DOM ELEMENTS ---
  // Setup
  const schoolInput     = $('schoolNameInput'),
        classSelect     = $('teacherClassSelect'),
        sectionSelect   = $('teacherSectionSelect'),
        btnSaveSetup    = $('saveSetup'),
        setupForm       = $('setupForm'),
        setupDisplay    = $('setupDisplay'),
        setupText       = $('setupText'),
        btnEditSetup    = $('editSetup');
  // Registration
  const nameInput       = $('studentName'),
        admInput        = $('admissionNo'),
        btnAddStudent   = $('addStudent'),
        tbodyStudents   = $('studentsBody'),
        wrapperStudents = $('studentTableWrapper'),
        btnEditSel      = $('editSelected'),
        btnDeleteSel    = $('deleteSelected'),
        btnSaveReg      = $('saveRegistration'),
        btnShareReg     = $('shareRegistration'),
        btnEditReg      = $('editRegistration'),
        btnDownloadReg  = $('downloadRegistrationPDF'),
        chkAllStudents  = $('selectAllStudents');
  // Totals
  const totalSchoolCount  = $('totalSchoolCount'),
        totalClassCount   = $('totalClassCount'),
        totalSectionCount = $('totalSectionCount');
  // Attendance
  const dateInput       = $('dateInput'),
        btnLoadAtt      = $('loadAttendance'),
        divAttList      = $('attendanceList'),
        btnSaveAtt      = $('saveAttendance');
  // Register
  const monthInput      = $('registerMonth'),
        btnLoadReg      = $('loadRegister'),
        btnChangeReg    = $('changeRegister'),
        divRegTable     = $('registerTableWrapper'),
        tbodyReg        = $('registerBody'),
        divRegSummary   = $('registerSummarySection'),
        tbodyRegSum     = $('registerSummaryBody'),
        btnShareReg2    = $('shareRegister'),
        btnDownloadReg2 = $('downloadRegisterPDF'),
        headerRegRowEl  = document.querySelector('#registerTable thead tr');
  // Analytics
  const selectAnalyticsTarget = $('analyticsTarget'),
        admAnalyticsInput     = $('studentAdmInput'),
        selectAnalyticsType   = $('analyticsType'),
        inputAnalyticsDate    = $('analyticsDate'),
        inputAnalyticsMonth   = $('analyticsMonth'),
        inputSemesterStart    = $('semesterStart'),
        inputSemesterEnd      = $('semesterEnd'),
        inputAnalyticsYear    = $('yearStart'),
        btnLoadAnalytics      = $('loadAnalytics'),
        btnResetAnalytics     = $('resetAnalytics'),
        divInstructions       = $('instructions'),
        divAnalyticsTable     = $('analyticsContainer'),
        divGraphs             = $('graphs'),
        ctxBar                = $('barChart').getContext('2d'),
        ctxPie                = $('pieChart').getContext('2d'),
        btnShareAnalytics     = $('shareAnalytics'),
        btnDownloadAnalytics  = $('downloadAnalytics');

  // --- STATE ---
  let students = await get('students') || [];
  let attendanceData = await get('attendanceData') || {};
  let registrationSaved = false;
  let inlineEditing = false;
  let chartBar, chartPie;
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // --- CORE FUNCTIONS ---
  function getCurrentClassSection() {
    return { cls: classSelect.value, sec: sectionSelect.value };
  }
  function filteredStudents() {
    const { cls, sec } = getCurrentClassSection();
    return students.filter(s => s.cls === cls && s.sec === sec);
  }
  function updateTotals() {
    totalSchoolCount.textContent = students.length;
    const { cls } = getCurrentClassSection();
    totalClassCount.textContent = students.filter(s => s.cls === cls).length;
    totalSectionCount.textContent = filteredStudents().length;
  }

  function bindRowSelection() {
    const boxes = Array.from(tbodyStudents.querySelectorAll('.sel'));
    boxes.forEach(cb => cb.onchange = () => {
      cb.closest('tr').classList.toggle('selected', cb.checked);
      const any = boxes.some(x => x.checked);
      btnEditSel.disabled = btnDeleteSel.disabled = !any;
    });
    chkAllStudents.disabled = registrationSaved;
    chkAllStudents.onchange = () => boxes.forEach(cb => {
      cb.checked = chkAllStudents.checked;
      cb.dispatchEvent(new Event('change'));
    });
  }

  function renderStudents() {
    tbodyStudents.innerHTML = '';
    filteredStudents().forEach((st, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" data-index="${idx}" ${registrationSaved?'disabled':''}></td>
        <td>${idx+1}</td>
        <td>${st.name} / ${st.adm}</td>
        <td>${registrationSaved?'<button class="share-one btn btn-sm">🔗</button>':''}</td>`;
      if (registrationSaved) {
        tr.querySelector('.share-one').onclick = () => {
          const hdr = `School: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
          const msg = [hdr, `Name: ${st.name}`, `Adm#: ${st.adm}`].join('\n');
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      tbodyStudents.appendChild(tr);
    });
    bindRowSelection();
    updateTotals();
  }

  // --- SETUP LOGIC ---
  btnSaveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolInput.value||!classSelect.value||!sectionSelect.value) return alert('Complete setup');
    await set('schoolName', schoolInput.value);
    await set('teacherClass', classSelect.value);
    await set('teacherSection', sectionSelect.value);
    loadSetup();
  };
  btnEditSetup.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('d-none');
    setupDisplay.classList.add('d-none');
  };
  async function loadSetup() {
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if (school && cls && sec) {
      schoolInput.value = school;
      classSelect.value = cls;
      sectionSelect.value = sec;
      setupText.textContent = `${school} | ${cls}-${sec}`;
      setupForm.classList.add('d-none');
      setupDisplay.classList.remove('d-none');
      renderStudents();
    }
    updateTotals();
  }
  await loadSetup();

  // --- STUDENT REGISTRATION EVENTS ---
  btnAddStudent.onclick = async e => {
    e.preventDefault();
    const name = nameInput.value.trim(),
          adm  = admInput.value.trim();
    if (!name||!adm) return alert('Name & Adm# required');
    if (!/^\d+$/.test(adm)) return alert('Adm# numeric');
    if (students.some(s=>s.adm===adm&&s.cls===classSelect.value&&s.sec===sectionSelect.value))
      return alert('Duplicate');
    students.push({ name, adm, roll: Date.now(), cls: classSelect.value, sec: sectionSelect.value });
    await saveStudents();
    renderStudents();
    nameInput.value = admInput.value = '';
  };

  btnEditSel.onclick = e => {
    e.preventDefault();
    const cbs = Array.from(tbodyStudents.querySelectorAll('.sel:checked'));
    if (!cbs.length) return;
    inlineEditing = !inlineEditing;
    btnEditSel.textContent = inlineEditing ? 'Done' : 'Edit';
    cbs.forEach(cb => {
      const td = cb.closest('tr').children[2];
      td.contentEditable = inlineEditing;
      td.classList.toggle('editing', inlineEditing);
    });
  };

  btnDeleteSel.onclick = async e => {
    e.preventDefault();
    if (!confirm('Delete?')) return;
    const torem = Array.from(tbodyStudents.querySelectorAll('.sel:checked'))
      .map(cb => filteredStudents()[+cb.dataset.index].roll);
    students = students.filter(s => !torem.includes(s.roll));
    await saveStudents();
    renderStudents();
  };

  btnSaveReg.onclick = e => {
    e.preventDefault();
    registrationSaved = true;
    wrapperStudents.classList.add('saved');
    renderStudents();
  };

  btnEditReg.onclick = e => {
    e.preventDefault();
    registrationSaved = false;
    wrapperStudents.classList.remove('saved');
    renderStudents();
  };

  // --- ATTENDANCE MARKING ---
  btnLoadAtt.onclick = e => {
    e.preventDefault();
    const d = dateInput.value; if (!d) return alert('Select date');
    divAttList.innerHTML = '';
    filteredStudents().forEach(s => {
      const row = document.createElement('div'),
            act = document.createElement('div');
      row.textContent = `${s.name} / ${s.adm}`;
      act.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button');
        b.textContent = code; b.className='btn btn-sm';
        if (attendanceData[d]?.[s.roll]===code) { b.style.background=colors[code]; b.style.color='#fff'; }
        b.onclick = ev => {
          ev.preventDefault();
          act.querySelectorAll('button').forEach(x=>{x.style.background='';x.style.color='';});
          b.style.background = colors[code]; b.style.color='#fff';
        };
        act.appendChild(b);
      });
      divAttList.append(row, act);
    });
    btnSaveAtt.classList.remove('d-none');
  };

  btnSaveAtt.onclick = async e => {
    e.preventDefault();
    const d = dateInput.value; if (!d) return;
    attendanceData[d] = {};
    document.querySelectorAll('.attendance-actions').forEach((act, i) => {
      const sel = act.querySelector('button[style*="background"]');
      attendanceData[d][filteredStudents()[i].roll] = sel?.textContent || 'A';
    });
    await saveAttendanceData();
    alert('Saved');
  };

  // --- ATTENDANCE REGISTER ---
  function generateRegisterHeader(days) {
    headerRegRowEl.innerHTML = '<th>#</th><th>Adm#</th><th>Name</th>';
    for(let d=1; d<=days; d++){
      const th = document.createElement('th');
      th.textContent = d;
      headerRegRowEl.appendChild(th);
    }
  }

  btnLoadReg.onclick = e => {
    e.preventDefault();
    const m = monthInput.value; if (!m) return alert('Select month');
    const [y,mo] = m.split('-').map(Number),
          days = new Date(y, mo, 0).getDate();
    generateRegisterHeader(days);
    tbodyReg.innerHTML = '';
    tbodyRegSum.innerHTML = '';
    filteredStudents().forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1; d<=days; d++){
        const ds = `${m}-${String(d).padStart(2,'0')}`,
              code = attendanceData[ds]?.[s.roll] || 'A';
        const td = document.createElement('td');
        td.textContent = code;
        td.style.background = colors[code];
        td.style.color = '#fff';
        tr.appendChild(td);
      }
      tbodyReg.appendChild(tr);
    });
    filteredStudents().forEach(s => {
      const stat = {P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for(let d=1; d<=days; d++){
        const ds = `${m}-${String(d).padStart(2,'0')}`,
              c = attendanceData[ds]?.[s.roll] || 'A';
        stat[c]++; stat.total++;
      }
      const pct = stat.total ? ((stat.P/stat.total)*100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${stat.P}</td><td>${stat.A}</td><td>${stat.Lt}</td><td>${stat.HD}</td><td>${stat.L}</td><td>${pct}</td>`;
      tbodyRegSum.appendChild(tr);
    });
    divRegTable.classList.remove('d-none');
    divRegSummary.classList.remove('d-none');
    btnChangeReg.classList.remove('d-none');
  };

  btnChangeReg.onclick = e => {
    e.preventDefault();
    divRegTable.classList.add('d-none');
    divRegSummary.classList.add('d-none');
    btnChangeReg.classList.add('d-none');
  };

  // --- ANALYTICS ---
  function hideAnalyticsInputs() {
    ['studentAdmInput','analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart','instructions','analyticsContainer','graphs','analyticsActions2']
      .forEach(id => $(id).classList.add('d-none'));
  }
  selectAnalyticsTarget.onchange = () => {
    admAnalyticsInput.classList.toggle('d-none', selectAnalyticsTarget.value!=='student');
    hideAnalyticsInputs();
    selectAnalyticsType.value = '';
  };
  selectAnalyticsType.onchange = () => {
    hideAnalyticsInputs();
    if (selectAnalyticsType.value==='date')    $('analyticsDate').classList.remove('d-none');
    if (selectAnalyticsType.value==='month')   $('analyticsMonth').classList.remove('d-none');
    if (selectAnalyticsType.value==='semester'){ $('semesterStart').classList.remove('d-none'); $('semesterEnd').classList.remove('d-none'); }
    if (selectAnalyticsType.value==='year')    $('yearStart').classList.remove('d-none');
    btnResetAnalytics.classList.remove('d-none');
  };
  btnResetAnalytics.onclick = e => { e.preventDefault(); hideAnalyticsInputs(); selectAnalyticsType.value=''; };

  btnLoadAnalytics.onclick = e => {
    e.preventDefault();
    let from,to;
    if (selectAnalyticsType.value==='date') {
      if (!inputAnalyticsDate.value) return alert('Select date');
      from = to = inputAnalyticsDate.value;
    } else if (selectAnalyticsType.value==='month') {
      if (!inputAnalyticsMonth.value) return alert('Select month');
      const [y,m] = inputAnalyticsMonth.value.split('-').map(Number);
      from = `${inputAnalyticsMonth.value}-01`;
      to   = `${inputAnalyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (selectAnalyticsType.value==='semester') {
      if (!inputSemesterStart.value||!inputSemesterEnd.value) return alert('Select range');
      from = `${inputSemesterStart.value}-01`;
      const [ey,em] = inputSemesterEnd.value.split('-').map(Number);
      to   = `${inputSemesterEnd.value}-${new Date(ey,em,0).getDate()}`;
    } else if (selectAnalyticsType.value==='year') {
      if (!inputAnalyticsYear.value) return alert('Select year');
      from = `${inputAnalyticsYear.value}-01-01`;
      to   = `${inputAnalyticsYear.value}-12-31`;
    } else return alert('Select type');

    let stats = filteredStudents().map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs]) => {
      const cd=new Date(d), f=new Date(from), t=new Date(to);
      if(cd>=f&&cd<=t) stats.forEach(st => {
        const c = recs[st.roll]||'A'; st[c]++; st.total++;
      });
    });

    let html = '<table class="table table-sm"><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s => {
      const pct = s.total ? ((s.P/s.total)*100).toFixed(1) : '0.0';
      html += `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${pct}</td></tr>`;
    });
    html += '</tbody></table>';
    divAnalyticsTable.innerHTML = html;
    divAnalyticsTable.classList.remove('d-none');

    divInstructions.textContent = `Report: ${from} to ${to}`;
    divInstructions.classList.remove('d-none');

    const labels = stats.map(s=>s.name),
          dataPct = stats.map(s=> s.total ? (s.P/s.total)*100 : 0 );
    if(chartBar) chartBar.destroy();
    chartBar = new Chart(ctxBar, { type:'bar', data:{labels,datasets:[{label:'%P',data:dataPct}]}, options:{responsive:true,scales:{y:{beginAtZero:true,max:100}}} });
    const agg = stats.reduce((a,s)=>{ ['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]); return a; }, {P:0,A:0,Lt:0,HD:0,L:0});
    if(chartPie) chartPie.destroy();
    chartPie = new Chart(ctxPie, { type:'pie', data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg)}]}, options:{responsive:true} });

    divGraphs.classList.remove('d-none');
    $('analyticsActions2').classList.remove('d-none');
  };

});
