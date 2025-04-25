// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- STORAGE HELPERS ---
  const { get, set } = window.idbKeyval;
  const $ = id => document.getElementById(id);

  async function saveStudents()       { await set('students', students); }
  async function saveAttendanceData(){ await set('attendanceData', attendanceData); }

  // --- ELEMENTS ---
  // Setup
  const schoolInput       = $('schoolNameInput'),
        classSelect       = $('teacherClassSelect'),
        sectionSelect     = $('teacherSectionSelect'),
        btnSaveSetup      = $('saveSetup'),
        setupForm         = $('setupForm'),
        setupDisplay      = $('setupDisplay'),
        setupText         = $('setupText'),
        btnEditSetup      = $('editSetup');
  // Registration
  const nameInput         = $('studentName'),
        admInput          = $('admissionNo'),
        parentInput       = $('parentName'),
        contactInput      = $('parentContact'),
        occInput          = $('parentOccupation'),
        addrInput         = $('parentAddress'),
        btnAddStudent     = $('addStudent'),
        tbodyStudents     = $('studentsBody'),
        chkAllStudents    = $('selectAllStudents'),
        btnEditSelected   = $('editSelected'),
        btnDeleteSelected = $('deleteSelected'),
        btnSaveReg        = $('saveRegistration'),
        btnShareReg       = $('shareRegistration'),
        btnDownloadReg    = $('downloadRegistrationPDF'),
        btnEditReg        = $('editRegistration'),
        wrapperStudents   = $('studentTableWrapper');
  const totalSchoolCount  = $('totalSchoolCount'),
        totalClassCount   = $('totalClassCount'),
        totalSectionCount = $('totalSectionCount');
  // Attendance
  const dateInput           = $('dateInput'),
        btnLoadAttendance   = $('loadAttendance'),
        attendanceList      = $('attendanceList'),
        btnSaveAttendance   = $('saveAttendance'),
        btnShareAttendance  = $('shareAttendance'),
        btnDownloadAttendance = $('downloadAttendancePDF'),
        attendanceResult    = $('attendance-result'),
        tbodySummary        = $('summaryBody'),
        btnResetAttendance  = $('resetAttendance'),
        btnShareSummary     = $('shareAttendanceSummary'),
        btnDownloadSummary  = $('downloadAttendanceSummaryPDF');
  // Analytics
  const analyticsTarget     = $('analyticsTarget'),
        studentAdmInput     = $('studentAdmInput'),
        analyticsType       = $('analyticsType'),
        analyticsDate       = $('analyticsDate'),
        analyticsMonth      = $('analyticsMonth'),
        semesterStart       = $('semesterStart'),
        semesterEnd         = $('semesterEnd'),
        analyticsYear       = $('yearStart'),
        btnLoadAnalytics    = $('loadAnalytics'),
        btnResetAnalytics   = $('resetAnalytics'),
        instructionsDiv     = $('instructions'),
        analyticsContainer  = $('analyticsContainer'),
        graphsDiv           = $('graphs'),
        barCtx              = $('barChart').getContext('2d'),
        pieCtx              = $('pieChart').getContext('2d'),
        btnShareAnalytics   = $('shareAnalytics'),
        btnDownloadAnalytics= $('downloadAnalyticsPDF');
  // Register
  const registerMonthInput  = $('registerMonth'),
        btnLoadRegister     = $('loadRegister'),
        btnChangeRegister   = $('changeRegister'),
        registerTableWrap   = $('registerTableWrapper'),
        registerBody        = $('registerBody'),
        registerSummaryWrap = $('registerSummarySection'),
        registerSummaryBody = $('registerSummaryBody'),
        registerHeaderRow   = document.querySelector('#registerTable thead tr');

  // --- STATE ---
  let students        = await get('students') || [];
  let attendanceData  = await get('attendanceData') || {};
  let registrationSaved = false;
  let chartBar, chartPie;
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // --- HELPERS ---
  function getCurrentClsSec() {
    return { cls: classSelect.value, sec: sectionSelect.value };
  }
  function filteredStudents() {
    const { cls, sec } = getCurrentClsSec();
    return students.filter(s => s.cls===cls && s.sec===sec);
  }
  function updateTotals() {
    totalSchoolCount.textContent = students.length;
    totalClassCount.textContent = filteredStudents().length;
    totalSectionCount.textContent = filteredStudents().length;
  }
  function bindRowSelection() {
    const boxes = Array.from(tbodyStudents.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        const any = boxes.some(x=>x.checked);
        btnEditSelected.disabled = btnDeleteSelected.disabled = !any;
      };
    });
    chkAllStudents.disabled = registrationSaved;
    chkAllStudents.onchange = () => boxes.forEach(cb => cb.checked=chkAllStudents.checked);
  }
  function renderStudents() {
    tbodyStudents.innerHTML = '';
    filteredStudents().forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" ${registrationSaved?'disabled':''}></td>
        <td>${i+1}</td>
        <td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>
        <td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>${registrationSaved?'<button class="btn btn-sm btn-outline-primary share-one">Share</button>':''}</td>
      `;
      // share-one button
      if (registrationSaved) {
        tr.querySelector('.share-one').onclick = () => {
          const hdr = `School:${schoolInput.value}\nClass:${classSelect.value}\nSection:${sectionSelect.value}`;
          const msg = `${hdr}\nName:${s.name}\nAdm#:${s.adm}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      tbodyStudents.appendChild(tr);
    });
    bindRowSelection();
    updateTotals();
  }

  // --- SETUP LOGIC ---
  btnSaveSetup.onclick = async () => {
    if (!schoolInput.value||!classSelect.value||!sectionSelect.value) {
      return alert('Complete setup');
    }
    await set('schoolName', schoolInput.value);
    await set('teacherClass', classSelect.value);
    await set('teacherSection', sectionSelect.value);
    loadSetup();
  };
  btnEditSetup.onclick = () => {
    setupForm.classList.remove('d-none');
    setupDisplay.classList.add('d-none');
  };
  async function loadSetup() {
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if (school&&cls&&sec) {
      schoolInput.value=school;
      classSelect.value=cls;
      sectionSelect.value=sec;
      setupText.textContent=`${school} | Class:${cls} | Section:${sec}`;
      setupForm.classList.add('d-none');
      setupDisplay.classList.remove('d-none');
      renderStudents();
    }
    updateTotals();
  }
  await loadSetup();

  // --- STUDENT REGISTRATION EVENTS ---
  btnAddStudent.onclick = async () => {
    const name=nameInput.value.trim(),
          adm =admInput.value.trim(),
          par =parentInput.value.trim(),
          cont=contactInput.value.trim(),
          occ =occInput.value.trim(),
          addr=addrInput.value.trim();
    if (!name||!adm||!par||!cont||!occ||!addr) {
      return alert('All fields required');
    }
    if (!/^\d+$/.test(adm)) {
      return alert('Admission# must be numeric');
    }
    if (students.some(s=>s.adm===adm&&s.cls===classSelect.value&&s.sec===sectionSelect.value)) {
      return alert('Duplicate Admission#');
    }
    students.push({ name, adm, parent:par, contact:cont, occupation:occ, address:addr, roll:Date.now(), cls:classSelect.value, sec:sectionSelect.value });
    await saveStudents();
    renderStudents();
    [nameInput,admInput,parentInput,contactInput,occInput,addrInput].forEach(i=>i.value='');
  };
  btnSaveReg.onclick = () => {
    registrationSaved = true;
    wrapperStudents.classList.add('saved');
    [btnEditSelected,btnDeleteSelected,chkAllStudents,btnSaveReg].forEach(el=>el.classList.add('d-none'));
    [btnShareReg,btnDownloadReg,btnEditReg].forEach(el=>el.classList.remove('d-none'));
    renderStudents();
  };
  btnEditReg.onclick = () => {
    registrationSaved = false;
    wrapperStudents.classList.remove('saved');
    [btnEditSelected,btnDeleteSelected,chkAllStudents,btnSaveReg].forEach(el=>el.classList.remove('d-none'));
    [btnShareReg,btnDownloadReg,btnEditReg].forEach(el=>el.classList.add('d-none'));
    renderStudents();
  };
  btnShareReg.onclick = () => {
    const hdr = `School:${schoolInput.value}\nClass:${classSelect.value}\nSection:${sectionSelect.value}`;
    const lines = filteredStudents().map(s=>`${s.name} (${s.adm})`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n' + lines)}`, '_blank');
  };
  btnDownloadReg.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Student Registration', 10, 10);
    doc.autoTable({ html: '#studentTable' });
    doc.save('students.pdf');
  };

  // --- MARK ATTENDANCE ---
  btnLoadAttendance.onclick = () => {
    const d = dateInput.value;
    if (!d) return alert('Pick a date');
    attendanceList.innerHTML = '';
    filteredStudents().forEach(s => {
      const lbl = document.createElement('div');
      lbl.textContent = `${s.name} (${s.adm})`;
      const actions = document.createElement('div');
      actions.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = code;
        // pre-color if previously saved
        if (attendanceData[d]?.[s.roll] === code) {
          b.style.background = colors[code];
          b.style.color = '#fff';
        }
        b.onclick = () => {
          actions.querySelectorAll('button').forEach(x => {
            x.style.background = '';
            x.style.color = '';
          });
          b.style.background = colors[code];
          b.style.color = '#fff';
        };
        actions.appendChild(b);
      });
      attendanceList.append(lbl, actions);
    });
    btnSaveAttendance.classList.remove('d-none');
  };
  btnSaveAttendance.onclick = async () => {
    const d = dateInput.value;
    attendanceData[d] = {};
    Array.from(attendanceList.querySelectorAll('.attendance-actions')).forEach((actions, i) => {
      const sel = actions.querySelector('button[style*="background"]');
      attendanceData[d][filteredStudents()[i].roll] = sel ? sel.textContent : 'A';
    });
    await saveAttendanceData();
    btnShareAttendance.classList.remove('d-none');
    btnDownloadAttendance.classList.remove('d-none');
    attendanceResult.classList.remove('d-none');
    // fill summary
    tbodySummary.innerHTML = `<tr><td colspan="2"><em>Date: ${d}</em></td></tr>`;
    filteredStudents().forEach(s => {
      const code = attendanceData[d][s.roll] || 'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td>`;
      tbodySummary.appendChild(tr);
    });
  };
  btnShareAttendance.onclick = () => {
    const d = dateInput.value;
    const lines = filteredStudents().map(s => {
      const code = attendanceData[d][s.roll] || 'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      return `${s.name}: ${status}`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank');
  };
  btnDownloadAttendance.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Daily Attendance', 10, 10);
    doc.autoTable({
      head: [['Name', 'Status']],
      body: filteredStudents().map(s => {
        const d = dateInput.value;
        const code = attendanceData[d][s.roll] || 'A';
        const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
        return [s.name, status];
      })
    });
    doc.save('attendance.pdf');
  };
  btnResetAttendance.onclick = () => {
    attendanceResult.classList.add('d-none');
    attendanceList.innerHTML = '';
    btnSaveAttendance.classList.add('d-none');
    btnShareAttendance.classList.add('d-none');
    btnDownloadAttendance.classList.add('d-none');
  };

  // --- ANALYTICS ---
  function hideAnalytics() {
    ['studentAdmInput','analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart','instructions','analyticsContainer','graphs','shareAnalytics','downloadAnalyticsPDF']
      .forEach(id => $(id)?.classList.add('d-none'));
  }
  analyticsTarget.onchange = () => {
    studentAdmInput.classList.toggle('d-none', analyticsTarget.value!=='student');
    hideAnalytics();
    analyticsType.value = '';
  };
  analyticsType.onchange = () => {
    hideAnalytics();
    if (analyticsType.value==='date')      analyticsDate.classList.remove('d-none');
    if (analyticsType.value==='month')     analyticsMonth.classList.remove('d-none');
    if (analyticsType.value==='semester')  { semesterStart.classList.remove('d-none'); semesterEnd.classList.remove('d-none'); }
    if (analyticsType.value==='year')      analyticsYear.classList.remove('d-none');
    btnResetAnalytics.classList.remove('d-none');
  };
  btnResetAnalytics.onclick = hideAnalytics;
  btnLoadAnalytics.onclick = () => {
    let from, to;
    const t = analyticsType.value;
    if (t==='date') {
      if (!analyticsDate.value) return alert('Pick a date');
      from = to = analyticsDate.value;
    } else if (t==='month') {
      if (!analyticsMonth.value) return alert('Pick a month');
      const [y,m] = analyticsMonth.value.split('-').map(Number);
      from = `${analyticsMonth.value}-01`;
      to   = `${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (t==='semester') {
      if (!semesterStart.value||!semesterEnd.value) return alert('Pick semester range');
      const [sy,sm] = semesterStart.value.split('-').map(Number),
            [ey,em] = semesterEnd.value.split('-').map(Number);
      from = `${semesterStart.value}-01`;
      to   = `${semesterEnd.value}-${new Date(ey,em,0).getDate()}`;
    } else if (t==='year') {
      if (!analyticsYear.value) return alert('Pick year');
      from = `${analyticsYear.value}-01-01`;
      to   = `${analyticsYear.value}-12-31`;
    } else return alert('Select period');

    // compute stats
    const stats = filteredStudents().map(s=>({ name:s.name, roll:s.roll, P:0,A:0,Lt:0,HD:0,L:0, total:0 }));
    Object.entries(attendanceData).forEach(([day, rec])=>{
      if (day>=from && day<=to) {
        stats.forEach(st => {
          const c = rec[st.roll]||'A';
          st[c]++; st.total++;
        });
      }
    });

    // render table
    let html = '<table class="table"><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s => {
      const pct = s.total?((s.P/s.total)*100).toFixed(1):'0.0';
      html += `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
    });
    html += '</tbody></table>';
    analyticsContainer.innerHTML = html;
    analyticsContainer.classList.remove('d-none');
    instructionsDiv.textContent = `Period: ${from} → ${to}`;
    instructionsDiv.classList.remove('d-none');

    // render charts
    const labels = stats.map(s=>s.name),
          dataPct = stats.map(s=>s.total?(s.P/s.total)*100:0);
    chartBar?.destroy();
    chartBar = new Chart(barCtx, {
      type:'bar',
      data:{ labels, datasets:[{ label:'% Present', data:dataPct }] },
      options:{ responsive:true, scales:{ y:{ beginAtZero:true, max:100 } }}
    });
    const agg = stats.reduce((a,s)=>{ ['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]); return a; },{P:0,A:0,Lt:0,HD:0,L:0});
    chartPie?.destroy();
    chartPie = new Chart(pieCtx, {
      type:'pie',
      data:{ labels:['Present','Absent','Late','Half Day','Leave'], datasets:[{ data:Object.values(agg) }] },
      options:{ responsive:true }
    });
    graphsDiv.classList.remove('d-none');
    btnShareAnalytics.classList.remove('d-none');
    btnDownloadAnalytics.classList.remove('d-none');
  };
  btnShareAnalytics.onclick = () => {
    const rows = Array.from(document.querySelectorAll('#analyticsContainer tbody tr'))
      .map(tr=>[...tr.children].map(td=>td.textContent).join(' ')).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(rows)}`, '_blank');
  };
  btnDownloadAnalytics.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Attendance Analytics', 10, 10);
    doc.autoTable({ html:'#analyticsContainer table' });
    doc.save('analytics.pdf');
  };

  // --- REGISTER ---
  function genRegisterHeader(days) {
    registerHeaderRow.innerHTML = '<th>Sr#</th><th>Adm#</th><th>Name</th>';
    for(let d=1; d<=days; d++){
      const th = document.createElement('th');
      th.textContent = d;
      registerHeaderRow.appendChild(th);
    }
  }
  btnLoadRegister.onclick = () => {
    if (!registerMonthInput.value) return alert('Select month');
    const [y,m] = registerMonthInput.value.split('-').map(Number),
          days   = new Date(y,m,0).getDate();
    genRegisterHeader(days);
    registerBody.innerHTML = '';
    filteredStudents().forEach((s,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1; d<=days; d++){
        const dateStr = `${registerMonthInput.value}-${String(d).padStart(2,'0')}`;
        const code = attendanceData[dateStr]?.[s.roll]||'A';
        const td = document.createElement('td');
        td.textContent = code;
        td.style.background = colors[code];
        td.style.color = '#fff';
        tr.appendChild(td);
      }
      registerBody.appendChild(tr);
    });
    // summary
    registerSummaryBody.innerHTML = '';
    filteredStudents().forEach(s=>{
      const stat={P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for(let d=1; d<=days; d++){
        const dateStr = `${registerMonthInput.value}-${String(d).padStart(2,'0')}`;
        const c = attendanceData[dateStr]?.[s.roll]||'A';
        stat[c]++; stat.total++;
      }
      const pct = stat.total?((stat.P/stat.total)*100).toFixed(1):'0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${stat.P}</td><td>${stat.A}</td><td>${stat.Lt}</td><td>${stat.HD}</td><td>${stat.L}</td><td>${pct}</td>`;
      registerSummaryBody.appendChild(tr);
    });
    registerTableWrap.classList.remove('d-none');
    registerSummaryWrap.classList.remove('d-none');
    btnChangeRegister.classList.remove('d-none');
    btnLoadRegister.classList.add('d-none');
  };
  btnChangeRegister.onclick = () => {
    registerTableWrap.classList.add('d-none');
    registerSummaryWrap.classList.add('d-none');
    btnChangeRegister.classList.add('d-none');
    btnLoadRegister.classList.remove('d-none');
  };
});
