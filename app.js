// app.js

// Use the global idbKeyval loaded via IIFE in index.html
const { get, set } = idbKeyval;

window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  // --- STORAGE ---
  let students = await get('students') || [];
  let attendanceData = await get('attendanceData') || {};

  const saveStudents = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);

  // --- ADM# GENERATOR ---
  const getLastAdmNo = async () => (await get('lastAdmissionNo')) || 0;
  const setLastAdmNo = n => set('lastAdmissionNo', n);
  const generateAdmNo = async () => {
    const last = await getLastAdmNo();
    const next = last + 1;
    setLastAdmNo(next);
    return String(next).padStart(4, '0');
  };

  // --- ELEMENT REFERENCES ---
  const schoolInput    = $('schoolNameInput');
  const classSelect    = $('teacherClassSelect');
  const sectionSelect  = $('teacherSectionSelect');
  const btnSaveSetup   = $('saveSetup');
  const setupForm      = $('setupForm');
  const setupDisplay   = $('setupDisplay');
  const setupText      = $('setupText');
  const btnEditSetup   = $('editSetup');

  const nameInput      = $('studentName');
  const parentInput    = $('parentName');
  const contactInput   = $('parentContact');
  const occInput       = $('parentOccupation');
  const addrInput      = $('parentAddress');
  const btnAddStudent  = $('addStudent');
  const tbodyStudents  = $('studentsBody');
  const chkAllStudents = $('selectAllStudents');
  const btnEditSel     = $('editSelected');
  const btnDeleteSel   = $('deleteSelected');
  const btnSaveReg     = $('saveRegistration');
  const btnShareReg    = $('shareRegistration');
  const btnEditReg     = $('editRegistration');
  const btnDownloadReg = $('downloadRegistrationPDF');

  const dateInput      = $('dateInput');
  const btnLoadAtt     = $('loadAttendance');
  const divAttList     = $('attendanceList');
  const btnSaveAtt     = $('saveAttendance');
  const sectionResult  = $('attendance-result');
  const tbodySummary   = $('summaryBody');
  const btnResetAtt    = $('resetAttendance');
  const btnShareAtt    = $('shareAttendanceSummary');
  const btnDownloadAtt = $('downloadAttendancePDF');

  const selectAnalyticsTarget  = $('analyticsTarget');
  const analyticsSectionSelect = $('analyticsSectionSelect');
  const analyticsFilter        = $('analyticsFilter');
  const analyticsStudentInput  = $('analyticsStudentInput');
  const selectAnalyticsType    = $('analyticsType');
  const inputAnalyticsDate     = $('analyticsDate');
  const inputAnalyticsMonth    = $('analyticsMonth');
  const inputSemesterStart     = $('semesterStart');
  const inputSemesterEnd       = $('semesterEnd');
  const inputAnalyticsYear     = $('yearStart');
  const btnLoadAnalytics       = $('loadAnalytics');
  const btnResetAnalytics      = $('resetAnalytics');
  const divInstructions        = $('instructions');
  const divAnalyticsTable      = $('analyticsContainer');
  const divGraphs              = $('graphs');
  const btnShareAnalytics      = $('shareAnalytics');
  const btnDownloadAnalytics   = $('downloadAnalytics');
  const ctxBar = $('barChart').getContext('2d');
  const ctxPie = $('pieChart').getContext('2d');
  let chartBar, chartPie;

  const monthInput      = $('registerMonth');
  const btnLoadReg      = $('loadRegister');
  const btnChangeReg    = $('changeRegister');
  const divRegTable     = $('registerTableWrapper');
  const tbodyReg        = $('registerBody');
  const divRegSummary   = $('registerSummarySection');
  const tbodyRegSum     = $('registerSummaryBody');
  const btnShareReg2    = $('shareRegister');
  const btnDownloadReg2 = $('downloadRegisterPDF');
  const headerRegRowEl  = document.querySelector('#registerTable thead tr');

  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // --- HELPERS ---
  const filteredStudents = () =>
    students.filter(s => s.cls === classSelect.value && s.sec === sectionSelect.value);

  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target / 100);
      function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
    });
  }

  function updateTotals() {
    const totalSchool = students.length;
    const totalClass  = students.filter(s => s.cls === classSelect.value).length;
    const totalSection= filteredStudents().length;
    [['sectionCount', totalSection], ['classCount', totalClass], ['schoolCount', totalSchool]]
      .forEach(([id,val]) => $(id).dataset.target = val);
    animateCounters();
  }

  function bindRowSelection() {
    const boxes = Array.from(tbodyStudents.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        btnEditSel.disabled = btnDeleteSel.disabled = !any;
      };
    });
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
        <td><input type="checkbox" class="sel" data-index="${idx}" ${btnSaveReg.classList.contains('hidden')?'':'disabled'}></td>
        <td>${idx+1}</td><td>${st.name}</td><td>${st.adm}</td><td>${st.parent}</td>
        <td>${st.contact}</td><td>${st.occupation}</td><td>${st.address}</td>
        <td>${btnSaveReg.classList.contains('hidden')?'<button class="share-one">Share</button>':''}</td>
      `;
      if (btnSaveReg.classList.contains('hidden')) {
        tr.querySelector('.share-one').onclick = () => {
          const hdr = `*Attendance Report*\nSchool: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
          const msg = [hdr, `Name: ${st.name}`, `Adm#: ${st.adm}`, `Parent: ${st.parent}`, `Contact: ${st.contact}`].join('\n');
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      tbodyStudents.appendChild(tr);
    });
    bindRowSelection();
    updateTotals();
  }

  // --- SETUP ---
  async function loadSetup() {
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if (school && cls && sec) {
      schoolInput.value = school;
      classSelect.value = cls;
      sectionSelect.value = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
      renderStudents();
    }
  }
  btnSaveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolInput.value || !classSelect.value || !sectionSelect.value) return alert('Complete setup');
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

  // --- ADD STUDENT ---
  btnAddStudent.onclick = async e => {
    e.preventDefault();
    const name   = nameInput.value.trim();
    const parent = parentInput.value.trim();
    const cont   = contactInput.value.trim();
    const occ    = occInput.value.trim();
    const addr   = addrInput.value.trim();
    if (!name || !parent || !cont || !occ || !addr) return alert('All fields required');
    if (!/^\d{7,15}$/.test(cont)) return alert('Contact must be 7–15 digits');
    const adm = await generateAdmNo();
    students.push({ name, adm, parent, contact: cont, occupation: occ, address: addr,
                    roll: Date.now(), cls: classSelect.value, sec: sectionSelect.value });
    await saveStudents();
    renderStudents();
    [nameInput, parentInput, contactInput, occInput, addrInput].forEach(i => i.value = '');
  };

  // --- INLINE EDIT / DELETE / SAVE REGISTRATION ---
  btnEditSel.onclick = e => {
    e.preventDefault();
    const boxes = Array.from(tbodyStudents.querySelectorAll('.sel:checked'));
    if (!boxes.length) return;
    boxes.forEach(cb => {
      const tr = cb.closest('tr');
      tr.querySelectorAll('td').forEach((td, ci) => {
        if (ci >= 2 && ci <= 7) {
          td.contentEditable = true;
          td.classList.add('editing');
          td.addEventListener('blur', () => {
            const idx = +cb.dataset.index;
            const keys = ['name','adm','parent','contact','occupation','address'];
            const val = td.textContent.trim();
            if (ci === 3 && !/^\d+$/.test(val)) return alert('Adm# numeric');
            const stu = filteredStudents()[idx];
            stu[keys[ci-2]] = val;
            students = students.map(s => s.roll === stu.roll ? stu : s);
            saveStudents();
          });
        }
      });
    });
  };
  btnDeleteSel.onclick = async e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    const toRemove = Array.from(tbodyStudents.querySelectorAll('.sel:checked'))
      .map(cb => filteredStudents()[+cb.dataset.index].roll);
    students = students.filter(s => !toRemove.includes(s.roll));
    await saveStudents();
    renderStudents();
  };
  btnSaveReg.onclick = e => {
    e.preventDefault();
    btnSaveReg.classList.add('hidden');
    btnShareReg.classList.remove('hidden');
    btnEditReg.classList.remove('hidden');
    btnDownloadReg.classList.remove('hidden');
    renderStudents();
  };
  btnEditReg.onclick = e => {
    e.preventDefault();
    btnSaveReg.classList.remove('hidden');
    btnShareReg.classList.add('hidden');
    btnEditReg.classList.add('hidden');
    btnDownloadReg.classList.add('hidden');
    renderStudents();
  };
  btnShareReg.onclick = e => {
    e.preventDefault();
    const hdr = `*Student List*\nSchool: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
    const lines = filteredStudents().map(s => `${s.name} (${s.adm})`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n' + lines)}`, '_blank');
  };
  btnDownloadReg.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Student Registration', 10, 10);
    doc.autoTable({
      head: [['Name','Adm#','Parent','Contact','Occ','Addr']],
      body: filteredStudents().map(s => [s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY: 20
    });
    doc.save('registration.pdf');
  };

  // --- ATTENDANCE MARKING & SUMMARY ---
  btnLoadAtt.onclick = e => {
    e.preventDefault();
    if (!dateInput.value) return alert('Pick a date');
    divAttList.innerHTML = '';
    filteredStudents().forEach(s => {
      const row = document.createElement('div');
      row.className = 'attendance-item';
      row.textContent = s.name;
      const actions = document.createElement('div');
      actions.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button');
        b.textContent = code;
        b.dataset.code = code;
        b.onclick = () => {
          actions.querySelectorAll('button').forEach(x => { x.style.background=''; x.style.color=''; });
          b.style.background = colors[code]; b.style.color='#fff';
        };
        actions.appendChild(b);
      });
      divAttList.append(row, actions);
    });
    btnSaveAtt.classList.remove('hidden');
  };
  btnSaveAtt.onclick = async e => {
    e.preventDefault();
    const d = dateInput.value;
    attendanceData[d] = {};
    divAttList.querySelectorAll('.attendance-actions').forEach((actions, i) => {
      const btn = actions.querySelector('button[style*="background"]');
      attendanceData[d][filteredStudents()[i].roll] = btn ? btn.dataset.code : 'A';
    });
    await saveAttendanceData();
    sectionResult.classList.remove('hidden');
    tbodySummary.innerHTML = '';
    filteredStudents().forEach(s => {
      const code = attendanceData[d][s.roll] || 'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick = () => {
        const msg = [`Date: ${d}`, `Name: ${s.name}`, `Status: ${status}`].join('\n');
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      };
      tbodySummary.appendChild(tr);
    });
  };
  btnResetAtt.onclick = () => {
    sectionResult.classList.add('hidden');
    divAttList.innerHTML = '';
    btnSaveAtt.classList.add('hidden');
  };
  btnShareAtt.onclick = () => {
    const d = dateInput.value;
    const hdr = `*Attendance*\nDate: ${d}`;
    const lines = filteredStudents().map(s => {
      const code = attendanceData[d][s.roll] || 'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      return `${s.name}: ${status}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`, '_blank');
  };
  btnDownloadAtt.onclick = () => {
    const d = dateInput.value;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Attendance Summary', 10, 10);
    doc.autoTable({
      head: [['Name','Status']],
      body: filteredStudents().map(s => {
        const code = attendanceData[d][s.roll] || 'A';
        const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
        return [s.name, status];
      }),
      startY: 20
    });
    doc.save('attendance.pdf');
  };

  // --- ANALYTICS ---
  function resetAnalytics() {
    $('labelSection').classList.add('hidden');
    analyticsSectionSelect.classList.add('hidden');
    $('labelFilter').classList.add('hidden');
    analyticsFilter.classList.add('hidden');
    analyticsStudentInput.classList.add('hidden');
    selectAnalyticsType.disabled = true;
    [inputAnalyticsDate,inputAnalyticsMonth,inputSemesterStart,inputSemesterEnd,inputAnalyticsYear]
      .forEach(i=>i.classList.add('hidden'));
    btnResetAnalytics.classList.add('hidden');
    divAnalyticsTable.classList.add('hidden');
    divGraphs.classList.add('hidden');
    btnShareAnalytics.classList.add('hidden');
    btnDownloadAnalytics.classList.add('hidden');
  }
  resetAnalytics();
  selectAnalyticsTarget.value = 'class';
  selectAnalyticsTarget.dispatchEvent(new Event('change'));

  selectAnalyticsTarget.onchange = () => {
    resetAnalytics();
    if (selectAnalyticsTarget.value === 'class') {
      selectAnalyticsType.disabled = false;
    }
    if (selectAnalyticsTarget.value === 'section') {
      $('labelSection').classList.remove('hidden');
      analyticsSectionSelect.classList.remove('hidden');
      selectAnalyticsType.disabled = false;
    }
    if (selectAnalyticsTarget.value === 'student') {
      $('labelFilter').classList.remove('hidden');
      analyticsFilter.classList.remove('hidden');
    }
  };

  analyticsFilter.onchange = () => {
    const choice = new Choices(analyticsStudentInput, { searchEnabled:true, shouldSort:false, itemSelectText:'' });
    choice.setChoices(
      filteredStudents().map(s=>({value:s.roll,label:`${s.name} — ${s.parent} — ${s.adm}`})),
      'value','label', true
    );
    analyticsStudentInput.classList.remove('hidden');
    selectAnalyticsType.disabled = true;
    analyticsStudentInput.onchange = () => selectAnalyticsType.disabled = false;
  };

  selectAnalyticsType.onchange = () => {
    [inputAnalyticsDate,inputAnalyticsMonth,inputSemesterStart,inputSemesterEnd,inputAnalyticsYear]
      .forEach(i=>i.classList.add('hidden'));
    btnResetAnalytics.classList.remove('hidden');
    if (selectAnalyticsType.value==='date')     inputAnalyticsDate.classList.remove('hidden');
    if (selectAnalyticsType.value==='month')    inputAnalyticsMonth.classList.remove('hidden');
    if (selectAnalyticsType.value==='semester'){
      inputSemesterStart.classList.remove('hidden');
      inputSemesterEnd.classList.remove('hidden');
    }
    if (selectAnalyticsType.value==='year')     inputAnalyticsYear.classList.remove('hidden');
  };

  btnLoadAnalytics.onclick = e => {
    e.preventDefault();
    let from, to;
    const t = selectAnalyticsType.value;
    if (t==='date')      { from = to = inputAnalyticsDate.value || alert('Pick date'); }
    else if (t==='month') { const [y,m]=inputAnalyticsMonth.value.split('-').map(Number);
                            from = `${inputAnalyticsMonth.value}-01`;
                            to   = `${inputAnalyticsMonth.value}-${new Date(y,m,0).getDate()}`; }
    else if (t==='semester') {
      const [sy,sm] = inputSemesterStart.value.split('-').map(Number);
      const [ey,em] = inputSemesterEnd.value.split('-').map(Number);
      from = `${inputSemesterStart.value}-01`;
      to   = `${inputSemesterEnd.value}-${new Date(ey,em,0).getDate()}`;
    }
    else if (t==='year') { from = `${inputAnalyticsYear.value}-01-01`; to = `${inputAnalyticsYear.value}-12-31`; }
    else return alert('Select period');

    let pool = [];
    if (selectAnalyticsTarget.value==='class')   pool = students.filter(s=>s.cls===classSelect.value);
    if (selectAnalyticsTarget.value==='section') pool = filteredStudents();
    if (selectAnalyticsTarget.value==='student') {
      const roll = analyticsStudentInput.value;
      pool = students.filter(s=>String(s.roll)===roll);
    }

    const stats = pool.map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      if (d>=from && d<=to) stats.forEach(st=>{
        const c = recs[st.roll]||'A';
        st[c]++; st.total++;
      });
    });

    divAnalyticsTable.innerHTML = `<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>%</th></tr></thead><tbody>${
      stats.map(s=>`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total?((s.P/s.total)*100).toFixed(1):'0.0'}</td></tr>`).join('')
    }</tbody></table>`;
    divAnalyticsTable.classList.remove('hidden');
    divInstructions.textContent = `Report: ${from} to ${to}`;
    divInstructions.classList.remove('hidden');

    const labels = stats.map(s=>s.name),
          dataPct = stats.map(s=>s.total? s.P/s.total*100:0);
    chartBar?.destroy();
    chartBar = new Chart(ctxBar,{type:'bar',data:{labels,datasets:[{label:'% Present',data:dataPct}]},options:{scales:{y:{beginAtZero:true,max:100}}}});
    const agg = stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    chartPie?.destroy();
    chartPie = new Chart(ctxPie,{type:'pie',data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg)}]}});

    divGraphs.classList.remove('hidden');
    btnShareAnalytics.classList.remove('hidden');
    btnDownloadAnalytics.classList.remove('hidden');
  };

  btnResetAnalytics.onclick = e => { e.preventDefault(); resetAnalytics(); };

  // --- REGISTER ---
  function genHeader(days) {
    headerRegRowEl.innerHTML = '<th>Sr#</th><th>Adm#</th><th>Name</th>' +
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
  }
  btnLoadReg.onclick = e => {
    e.preventDefault();
    if (!monthInput.value) return alert('Select month');
    const [y,m] = monthInput.value.split('-').map(Number),
          days  = new Date(y,m,0).getDate();
    genHeader(days);
    tbodyReg.innerHTML = '';
    tbodyRegSum.innerHTML = '';
    filteredStudents().forEach((s,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
        Array.from({length:days},(_,d)=>{
          const code = (attendanceData[`${monthInput.value}-${String(d+1).padStart(2,'0')}`]||{})[s.roll]||'A';
          return `<td style="background:${colors[code]};color:#fff">${code}</td>`;
        }).join('');
      tbodyReg.appendChild(tr);
    });
    filteredStudents().forEach(s=>{
      const stat={P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for(let d=1;d<=days;d++){
        const code = (attendanceData[`${monthInput.value}-${String(d).padStart(2,'0')}`]||{})[s.roll]||'A';
        stat[code]++; stat.total++;
      }
      const pct = stat.total?((stat.P/stat.total)*100).toFixed(1):'0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${stat.P}</td><td>${stat.A}</td><td>${stat.Lt}</td><td>${stat.HD}</td><td>${stat.L}</td><td>${pct}</td>`;
      tbodyRegSum.appendChild(tr);
    });
    divRegTable.classList.remove('hidden');
    divRegSummary.classList.remove('hidden');
    btnLoadReg.classList.add('hidden');
    btnChangeReg.classList.remove('hidden');
  };
  btnChangeReg.onclick = e => {
    e.preventDefault();
    divRegTable.classList.add('hidden');
    divRegSummary.classList.add('hidden');
    btnLoadReg.classList.remove('hidden');
    btnChangeReg.classList.add('hidden');
  };
});
