// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- IMPORTS & PLUGINS ---
  const { get, set } = window.idbKeyval;
  const { jsPDF } = window.jspdf; 
  // jspdf-autotable plugin must be loaded before this script

  // --- STATE & STORAGE HELPERS ---
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};

  const saveStudents       = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);

  const getLastAdmNo = async () => (await get('lastAdmissionNo')) || 0;
  const setLastAdmNo = n => set('lastAdmissionNo', n);
  async function generateAdmNo() {
    const last = await getLastAdmNo(), next = last + 1;
    await setLastAdmNo(next);
    return String(next).padStart(4, '0');
  }

  // --- DOM SELECTORS ---
  const $ = id => document.getElementById(id);

  // Setup
  const schoolInput       = $('schoolNameInput');
  const classSelect       = $('teacherClassSelect');
  const sectionSelect     = $('teacherSectionSelect');
  const btnSaveSetup      = $('saveSetup');
  const setupForm         = $('setupForm');
  const setupDisplay      = $('setupDisplay');
  const setupText         = $('setupText');
  const btnEditSetup      = $('editSetup');

  // Counters
  const sectionCountEl    = $('sectionCount');
  const classCountEl      = $('classCount');
  const schoolCountEl     = $('schoolCount');

  // Registration
  const nameInput             = $('studentName');
  const parentInput           = $('parentName');
  const contactInput          = $('parentContact');
  const occInput              = $('parentOccupation');
  const addrInput             = $('parentAddress');
  const btnAddStudent         = $('addStudent');
  const tbodyStudents         = $('studentsBody');
  const selectAllStudents     = $('selectAllStudents');
  const btnEditSelected       = $('editSelected');
  const btnDeleteSelected     = $('deleteSelected');
  const btnSaveRegistration   = $('saveRegistration');
  const btnShareRegistration  = $('shareRegistration');
  const btnEditRegistration   = $('editRegistration');
  const btnDownloadRegistrationPDF = $('downloadRegistrationPDF');

  // Attendance marking & summary
  const dateInput           = $('dateInput');
  const btnLoadAttendance   = $('loadAttendance');
  const divAttList          = $('attendanceList');
  const btnSaveAttendance   = $('saveAttendance');
  const sectionResult       = $('attendance-result');
  const tbodySummary        = $('summaryBody');
  const btnResetAttendance  = $('resetAttendance');
  const btnShareAttendance  = $('shareAttendanceSummary');
  const btnDownloadAttendance = $('downloadAttendancePDF');

  // Analytics
  const analyticsTarget        = $('analyticsTarget');
  const analyticsSectionSelect = $('analyticsSectionSelect');
  const analyticsFilter        = $('analyticsFilter');
  const analyticsStudentInput  = $('analyticsStudentInput');
  const analyticsType          = $('analyticsType');
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
  const labelSection           = $('labelSection');
  const labelFilter            = $('labelFilter');
  const ctxBar                 = $('barChart').getContext('2d');
  const ctxPie                 = $('pieChart').getContext('2d');
  let chartBar, chartPie;

  // Register
  const monthRegInput    = $('registerMonth');
  const btnLoadRegister  = $('loadRegister');
  const btnChangeRegister= $('changeRegister');
  const divRegisterTable = $('registerTableWrapper');
  const tbodyRegister    = $('registerBody');
  const divRegisterSummary = $('registerSummarySection');
  const tbodyRegisterSum = $('registerSummaryBody');
  const btnShareRegister = $('shareRegister');
  const btnDownloadRegisterPDF = $('downloadRegisterPDF');

  // Attendance code colors
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // --- SETUP LOGIC ---
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
      updateTotals();
    }
  }
  btnSaveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolInput.value || !classSelect.value || !sectionSelect.value)
      return alert('Complete setup');
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
      let count = 0, step = Math.max(1, target/100);
      (function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
      })();
    });
  }
  function updateTotals() {
    const filtered = students.filter(s => s.cls===classSelect.value && s.sec===sectionSelect.value);
    sectionCountEl.dataset.target = filtered.length;
    classCountEl.dataset.target   = students.filter(s=>s.cls===classSelect.value).length;
    schoolCountEl.dataset.target  = students.length;
    animateCounters();
  }

  // --- STUDENT REGISTRATION ---
  btnAddStudent.onclick = async e => {
    e.preventDefault();
    const name   = nameInput.value.trim(),
          parent = parentInput.value.trim(),
          cont   = contactInput.value.trim(),
          occ    = occInput.value.trim(),
          addr   = addrInput.value.trim();
    if (!name||!parent||!cont||!occ||!addr) return alert('All fields required');
    if (!/^\d{7,15}$/.test(cont)) return alert('Contact must be 7–15 digits');
    const adm = await generateAdmNo();
    students.push({
      name, adm, parent, contact: cont,
      occupation: occ, address: addr,
      roll: Date.now(),
      cls: classSelect.value,
      sec: sectionSelect.value
    });
    await saveStudents();
    renderStudents();
    [nameInput,parentInput,contactInput,occInput,addrInput].forEach(i=>i.value='');
  };
  function renderStudents() {
    tbodyStudents.innerHTML = '';
    const filtered = students.filter(s=>s.cls===classSelect.value && s.sec===sectionSelect.value);
    filtered.forEach((st, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" data-index="${idx}"></td>
        <td>${idx+1}</td>
        <td>${st.name}</td>
        <td>${st.adm}</td>
        <td>${st.parent}</td>
        <td>${st.contact}</td>
        <td>${st.occupation}</td>
        <td>${st.address}</td>
        <td><button class="share-one">Share</button></td>
      `;
      tr.querySelector('.share-one').onclick = () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(`Name: ${st.name}\nAdm#: ${st.adm}`)}`, '_blank');
      };
      tbodyStudents.appendChild(tr);
    });
    bindRowSelection();
    updateTotals();
  }
  function bindRowSelection() {
    const boxes = Array.from(tbodyStudents.querySelectorAll('.sel'));
    boxes.forEach(cb => cb.onchange = () => {
      btnEditSelected.disabled = btnDeleteSelected.disabled = !boxes.some(x=>x.checked);
    });
    selectAllStudents.onchange = () => {
      boxes.forEach(cb => cb.checked = selectAllStudents.checked);
      btnDeleteSelected.disabled = !selectAllStudents.checked;
    };
  }
  btnEditSelected.onclick = e => {
    e.preventDefault();
    Array.from(tbodyStudents.querySelectorAll('.sel:checked')).forEach(cb => {
      const tr = cb.closest('tr');
      tr.querySelectorAll('td').forEach((td, ci) => {
        if (ci >= 2 && ci <= 7) {
          td.contentEditable = true;
          td.classList.add('editing');
          td.onblur = async () => {
            const idx = +cb.dataset.index;
            const keys = ['name','adm','parent','contact','occupation','address'];
            const val = td.textContent.trim();
            if (ci===3 && !/^\d+$/.test(val)) { alert('Adm# numeric'); renderStudents(); return; }
            const target = students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value)[idx];
            target[keys[ci-2]] = val;
            await saveStudents();
          };
        }
      });
    });
  };
  btnDeleteSelected.onclick = async e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    const filtered = students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value);
    const toRemove = Array.from(tbodyStudents.querySelectorAll('.sel:checked'))
      .map(cb => filtered[+cb.dataset.index].roll);
    students = students.filter(s => !toRemove.includes(s.roll));
    await saveStudents();
    renderStudents();
  };
  btnSaveRegistration.onclick = e => {
    e.preventDefault();
    ['saveRegistration','editSelected','deleteSelected','selectAllStudents']
      .forEach(id => $(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id => $(id).classList.remove('hidden'));
  };
  btnEditRegistration.onclick = e => {
    e.preventDefault();
    ['saveRegistration','editSelected','deleteSelected','selectAllStudents']
      .forEach(id => $(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id => $(id).classList.add('hidden'));
  };
  btnDownloadRegistrationPDF.onclick = e => {
    e.preventDefault();
    const doc = new jsPDF();
    doc.autoTable({ html: '#studentTable', startY: 10 });
    doc.save('registration.pdf');
  };

  // --- ATTENDANCE MARKING & SUMMARY ---
  btnLoadAttendance.onclick = e => {
    e.preventDefault();
    if (!dateInput.value) return alert('Pick a date');
    divAttList.innerHTML = '';
    const filtered = students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value);
    filtered.forEach(s => {
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
          actions.querySelectorAll('button').forEach(x=>{ x.style.background=''; x.style.color=''; });
          b.style.background = colors[code];
          b.style.color = '#fff';
        };
        actions.appendChild(b);
      });
      divAttList.append(row, actions);
    });
    btnSaveAttendance.classList.remove('hidden');
  };
  btnSaveAttendance.onclick = async e => {
    e.preventDefault();
    const d = dateInput.value;
    attendanceData[d] = {};
    const filtered = students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value);
    divAttList.querySelectorAll('.attendance-actions').forEach((actions,i) => {
      const sel = actions.querySelector('button[style*="background"]');
      attendanceData[d][filtered[i].roll] = sel ? sel.dataset.code : 'A';
    });
    await saveAttendanceData();
    sectionResult.classList.remove('hidden');
    tbodySummary.innerHTML = '';
    filtered.forEach(s => {
      const code = attendanceData[d][s.roll]||'A';
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
  btnResetAttendance.onclick = () => {
    sectionResult.classList.add('hidden');
    divAttList.innerHTML = '';
    btnSaveAttendance.classList.add('hidden');
  };
  btnShareAttendance.onclick = () => {
    const d = dateInput.value;
    const hdr = `*Attendance* Date: ${d}`;
    const filtered = students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value);
    const lines = filtered.map(s => {
      const code = attendanceData[d][s.roll]||'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      return `${s.name}: ${status}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n' + lines.join('\n'))}`, '_blank');
  };
  btnDownloadAttendance.onclick = () => {
    const d = dateInput.value;
    const doc = new jsPDF();
    doc.text('Attendance Summary', 10, 10);
    doc.autoTable({
      head: [['Name','Status']],
      body: students
        .filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value)
        .map(s=> {
          const code = attendanceData[d][s.roll]||'A';
          const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
          return [s.name, status];
        }),
      startY: 20
    });
    doc.save('attendance.pdf');
  };

  // --- ANALYTICS ---
  function resetAnalyticsUI() {
    hide(labelSection); hide(analyticsSectionSelect);
    hide(labelFilter); hide(analyticsFilter); hide(analyticsStudentInput);
    analyticsType.disabled = true;
    [inputAnalyticsDate, inputAnalyticsMonth, inputSemesterStart, inputSemesterEnd, inputAnalyticsYear,
      btnResetAnalytics, divAnalyticsTable, divGraphs, btnShareAnalytics, btnDownloadAnalytics]
      .forEach(el => hide(el));
    divInstructions.textContent = '';
    analyticsTarget.value = '';
    analyticsType.value = '';
    analyticsSectionSelect.value = '';
    analyticsFilter.value = '';
    analyticsStudentInput.value = '';
  }
  resetAnalyticsUI();

  analyticsTarget.onchange = () => {
    resetAnalyticsUI();
    analyticsType.disabled = false;
    if (analyticsTarget.value === 'section') {
      labelSection.classList.remove('hidden');
      analyticsSectionSelect.classList.remove('hidden');
    }
    if (analyticsTarget.value === 'student') {
      labelFilter.classList.remove('hidden');
      analyticsFilter.classList.remove('hidden');
    }
  };

  analyticsFilter.onchange = () => {
    const choices = new Choices(analyticsStudentInput, { searchEnabled: true, itemSelectText: '' });
    const opts = students
      .filter(s => s.cls===classSelect.value && s.sec===sectionSelect.value)
      .map(s => ({ value: s.roll, label: `${s.name} — ${s.parent} — ${s.adm}` }));
    choices.setChoices(opts, 'value', 'label', true);
    analyticsStudentInput.classList.remove('hidden');
  };

  analyticsType.onchange = () => {
    [inputAnalyticsDate, inputAnalyticsMonth, inputSemesterStart, inputSemesterEnd, inputAnalyticsYear]
      .forEach(el => hide(el));
    btnResetAnalytics.classList.remove('hidden');
    if (analyticsType.value === 'date') show(inputAnalyticsDate);
    if (analyticsType.value === 'month') show(inputAnalyticsMonth);
    if (analyticsType.value === 'semester') {
      show(inputSemesterStart); show(inputSemesterEnd);
    }
    if (analyticsType.value === 'year') show(inputAnalyticsYear);
  };

  btnLoadAnalytics.onclick = e => {
    e.preventDefault();
    let from, to;
    const t = analyticsType.value;
    if (t === 'date') {
      if (!inputAnalyticsDate.value) return alert('Pick date');
      from = to = inputAnalyticsDate.value;
    } else if (t === 'month') {
      if (!inputAnalyticsMonth.value) return alert('Pick month');
      const [y,m] = inputAnalyticsMonth.value.split('-').map(Number);
      from = `${inputAnalyticsMonth.value}-01`;
      to   = `${inputAnalyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (t === 'semester') {
      if (!inputSemesterStart.value||!inputSemesterEnd.value) return alert('Pick both');
      const [sy,sm]=inputSemesterStart.value.split('-').map(Number),
            [ey,em]=inputSemesterEnd.value.split('-').map(Number);
      from = `${inputSemesterStart.value}-01`;
      to   = `${inputSemesterEnd.value}-${new Date(ey,em,0).getDate()}`;
    } else if (t === 'year') {
      if (!inputAnalyticsYear.value) return alert('Pick year');
      from = `${inputAnalyticsYear.value}-01-01`;
      to   = `${inputAnalyticsYear.value}-12-31`;
    } else return alert('Select period');

    let pool = students.filter(s => s.cls===classSelect.value);
    if (analyticsTarget.value==='section')
      pool = pool.filter(s => s.sec===analyticsSectionSelect.value);
    if (analyticsTarget.value==='student')
      pool = pool.filter(s => String(s.roll)===analyticsStudentInput.value);

    const stats = pool.map(s => ({ name: s.name, roll: s.roll, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    Object.entries(attendanceData).forEach(([d,recs]) => {
      if (d < from || d > to) return;
      stats.forEach(st => {
        const c = recs[st.roll]||'A';
        st[c]++; st.total++;
      });
    });

    // render table
    let html = `<table>
      <thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>%</th></tr></thead><tbody>`;
    stats.forEach(s => {
      const pct = s.total ? ((s.P/s.total)*100).toFixed(1) : '0.0';
      html += `<tr>
        <td>${s.name}</td><td>${s.P}</td><td>${s.A}</td>
        <td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${pct}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    divAnalyticsTable.innerHTML = html;
    divInstructions.textContent = `Report: ${from} to ${to}`;
    divAnalyticsTable.classList.remove('hidden');
    divInstructions.classList.remove('hidden');

    // charts
    const labels = stats.map(s=>s.name),
          dataPct = stats.map(s=> s.total ? s.P/s.total*100 : 0 );
    chartBar?.destroy();
    chartBar = new Chart(ctxBar, {
      type:'bar',
      data:{ labels, datasets:[{ label:'% Present', data:dataPct }] },
      options:{ scales:{ y:{ beginAtZero:true, max:100 }}}
    });
    const agg = stats.reduce((a,s) => {
      ['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);
      return a;
    }, {P:0,A:0,Lt:0,HD:0,L:0});
    chartPie?.destroy();
    chartPie = new Chart(ctxPie, {
      type:'pie',
      data:{ labels:['P','A','Lt','HD','L'], datasets:[{ data:Object.values(agg) }] }
    });
    divGraphs.classList.remove('hidden');
    btnShareAnalytics.classList.remove('hidden');
    btnDownloadAnalytics.classList.remove('hidden');
  };
  btnResetAnalytics.onclick = e => {
    e.preventDefault();
    resetAnalyticsUI();
  };
  btnShareAnalytics.onclick = () => {
    const rows = Array.from(divAnalyticsTable.querySelectorAll('tbody tr')).map(r => {
      const [n,P,A,Lt,HD,L,pct] = [...r.querySelectorAll('td')].map(td=>td.textContent);
      return `${n}: P=${P}, A=${A}, Lt=${Lt}, HD=${HD}, L=${L}, %=${pct}`;
    });
    const hdr = `Attendance Report (${analyticsTarget.value})`;
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`, '_blank');
  };
  btnDownloadAnalytics.onclick = () => {
    const doc = new jsPDF();
    doc.text(`Attendance Report (${analyticsTarget.value})`, 10, 10);
    doc.autoTable({ html: '#analyticsContainer table', startY: 20 });
    doc.save('analytics.pdf');
  };

  // --- ATTENDANCE REGISTER ---
  btnLoadRegister.onclick = e => {
    e.preventDefault();
    if (!monthRegInput.value) return alert('Select month');
    const [y,m] = monthRegInput.value.split('-').map(Number);
    const days = new Date(y,m,0).getDate();
    const tbl = $('registerTable');
    const headRow = tbl.querySelector('thead tr');
    headRow.innerHTML = '<th>Sr#</th><th>Adm#</th><th>Name</th>' +
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    tbodyRegister.innerHTML = '';
    const filtered = students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value);
    filtered.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
        Array.from({length:days},(_,d)=>{
          const code = (attendanceData[`${monthRegInput.value}-${String(d+1).padStart(2,'0')}`]||{})[s.roll]||'A';
          return `<td style="background:${colors[code]};color:#fff">${code}</td>`;
        }).join('');
      tbodyRegister.appendChild(tr);
    });
    tbodyRegisterSum.innerHTML = '';
    filtered.forEach(s=>{
      let stat={P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for(let d=1;d<=days;d++){
        const code=(attendanceData[`${monthRegInput.value}-${String(d).padStart(2,'0')}`]||{})[s.roll]||'A';
        stat[code]++; stat.total++;
      }
      const pct = stat.total ? ((stat.P/stat.total)*100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${stat.P}</td><td>${stat.A}</td><td>${stat.Lt}</td>
                      <td>${stat.HD}</td><td>${stat.L}</td><td>${pct}</td>`;
      tbodyRegisterSum.appendChild(tr);
    });
    divRegisterTable.classList.remove('hidden');
    divRegisterSummary.classList.remove('hidden');
    btnLoadRegister.classList.add('hidden');
    btnChangeRegister.classList.remove('hidden');
  };
  btnChangeRegister.onclick = e => {
    e.preventDefault();
    divRegisterTable.classList.add('hidden');
    divRegisterSummary.classList.add('hidden');
    btnLoadRegister.classList.remove('hidden');
    btnChangeRegister.classList.add('hidden');
  };
  btnShareRegister.onclick = e => {
    e.preventDefault();
    const hdr = `*Attendance Register* ${monthRegInput.value}`;
    const lines = Array.from(tbodyRegisterSum.querySelectorAll('tr')).map(r=>{
      const [n,p,a,lt,hd,l,pct]=[...r.querySelectorAll('td')].map(td=>td.textContent);
      return `${n}: P:${p}, A:${a}, Lt:${lt}, HD:${hd}, L:${l}, %:${pct}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`, '_blank');
  };
  btnDownloadRegisterPDF.onclick = () => {
    const doc = new jsPDF('landscape');
    doc.autoTable({ html: '#registerTable', startY: 10, styles:{ fontSize: 6 } });
    doc.autoTable({ html: '#registerSummarySection table', startY: doc.lastAutoTable.finalY+10, styles:{ fontSize: 8 } });
    doc.save('register.pdf');
  };

  // --- PWA SERVICE WORKER ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  }

  // --- helper show/hide ---
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }
});
