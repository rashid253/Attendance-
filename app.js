// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = {
    P: 'var(--success)',
    A: 'var(--danger)',
    Lt: 'var(--warning)',
    HD: 'var(--orange)',
    L: 'var(--info)'
  };

  //
  // 1. SETUP
  //
  const schoolIn      = $('schoolNameInput'),
        classSel      = $('teacherClassSelect'),
        secSel        = $('teacherSectionSelect'),
        saveSetupBtn  = $('saveSetup'),
        setupForm     = $('setupForm'),
        setupDisplay  = $('setupDisplay'),
        setupText     = $('setupText'),
        editSetupBtn  = $('editSetup');

  function loadSetup() {
    const school = localStorage.getItem('schoolName'),
          cls    = localStorage.getItem('teacherClass'),
          sec    = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value        = school;
      classSel.value        = cls;
      secSel.value          = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetupBtn.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) {
      alert('Complete setup');
      return;
    }
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };

  editSetupBtn.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };

  loadSetup();

  //
  // 2. STUDENT REGISTRATION
  //
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const studentNameIn      = $('studentName'),
        admissionNoIn      = $('admissionNo'),
        parentNameIn       = $('parentName'),
        parentContactIn    = $('parentContact'),
        parentOccupationIn = $('parentOccupation'),
        parentAddressIn    = $('parentAddress'),
        addStudentBtn      = $('addStudent'),
        studentsBody       = $('studentsBody'),
        selectAllChk       = $('selectAllStudents'),
        editSelectedBtn    = $('editSelected'),
        deleteSelectedBtn  = $('deleteSelected'),
        saveRegBtn         = $('saveRegistration'),
        shareRegBtn        = $('shareRegistration'),
        editRegBtn         = $('editRegistration'),
        downloadRegPDFBtn  = $('downloadRegistrationPDF');
  let regSaved = false, inlineEdit = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function bindStudentSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelectedBtn.disabled = deleteSelectedBtn.disabled = !any;
      };
    });
    selectAllChk.disabled = regSaved;
    selectAllChk.onchange = () => {
      if (!regSaved) {
        boxes.forEach(cb => {
          cb.checked = selectAllChk.checked;
          cb.dispatchEvent(new Event('change'));
        });
      }
    };
  }

  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved?'disabled':''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved?'<button class="share-one">Share</button>':''}</td>`;
      if (regSaved) {
        tr.querySelector('.share-one').onclick = ev => {
          ev.preventDefault();
          const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
          const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindStudentSelection();
  }

  addStudentBtn.onclick = ev => {
    ev.preventDefault();
    const name       = studentNameIn.value.trim(),
          adm        = admissionNoIn.value.trim(),
          parent     = parentNameIn.value.trim(),
          contact    = parentContactIn.value.trim(),
          occupation = parentOccupationIn.value.trim(),
          address    = parentAddressIn.value.trim();
    if (!name || !adm || !parent || !contact || !occupation || !address) {
      alert('All fields required');
      return;
    }
    if (!/^[0-9]+$/.test(adm)) {
      alert('Adm# must be numeric');
      return;
    }
    if (!/^\d{7,15}$/.test(contact)) {
      alert('Contact must be 7–15 digits');
      return;
    }
    students.push({ name, adm, parent, contact, occupation, address, roll: Date.now() });
    saveStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccupationIn, parentAddressIn].forEach(i=>i.value='');
  };

  function onCellBlur(e) {
    const td  = e.target,
          tr  = td.closest('tr'),
          idx = +tr.querySelector('.sel').dataset.index,
          ci  = Array.from(tr.children).indexOf(td),
          keys= ['name','adm','parent','contact','occupation','address'];
    if (ci>=1 && ci<=6) {
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  }

  editSelectedBtn.onclick = ev => {
    ev.preventDefault();
    const selBoxes = Array.from(document.querySelectorAll('.sel:checked'));
    if (!selBoxes.length) return;
    inlineEdit = !inlineEdit;
    editSelectedBtn.textContent = inlineEdit ? 'Done Editing' : 'Edit Selected';
    selBoxes.forEach(cb=>{
      cb.closest('tr').querySelectorAll('td').forEach((td, ci)=>{
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit ? td.addEventListener('blur', onCellBlur) : td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  deleteSelectedBtn.onclick = ev => {
    ev.preventDefault();
    if (!confirm('Delete selected?')) return;
    Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb=>+cb.dataset.index).sort((a,b)=>b-a).forEach(i=>students.splice(i,1));
    saveStudents();
    renderStudents();
    selectAllChk.checked = false;
  };

  saveRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegPDFBtn.classList.remove('hidden');
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  editRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegPDFBtn.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick = ev => {
    ev.preventDefault();
    const hdr   = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s=>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`, '_blank');
  };

  downloadRegPDFBtn.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    // Header
    const registerMonthInput = $('registerMonth').value.split('-'),
          yr  = registerMonthInput[0],
          mo  = registerMonthInput[1],
          monthName = new Date(yr, mo-1).toLocaleString('default',{month:'long'});
    doc.setFontSize(16);
    doc.text(`Attendance Register — ${monthName} ${yr}`, doc.internal.pageSize.getWidth()/2, 40, { align: 'center' });

    // Table of days
    doc.autoTable({
      html: '#registerTableWrapper table',
      startY: 60,
      theme: 'grid',
      headStyles: { fillColor: [33,150,243] },
      styles: { fontSize: 8, cellPadding: 4 },
      margin: { left: 40, right: 40 }
    });

    // Summary & Charts on new page
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Monthly Summary', 40, 50);
    doc.autoTable({
      html: '#registerSummary table',
      startY: 70,
      theme: 'grid',
      headStyles: { fillColor: [33,150,243] },
      styles: { fontSize: 10, cellPadding: 6 },
      margin: { left: 40, right: 40 }
    });

    // Enlarge charts by 1cm and add 1cm padding below
    const cm = 28.35;
    const chartY    = doc.lastAutoTable.finalY + cm;
    const availW    = doc.internal.pageSize.getWidth() - 80;
    const chartW    = (availW/2) + cm;
    const chartH    = 150 + cm;
    doc.addImage(regBarChart.toBase64Image(), 'PNG', 40, chartY, chartW, chartH);
    doc.addImage(regPieChart.toBase64Image(), 'PNG', 60 + chartW, chartY, chartW, chartH);

    doc.save(`Register_${mo}-${yr}.pdf`);
  };

  renderStudents();

  //
  // 3. ATTENDANCE MARKING
  //
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
  const dateInput       = $('dateInput'),
        loadAttBtn      = $('loadAttendance'),
        attList         = $('attendanceList'),
        saveAttBtn      = $('saveAttendance'),
        resSection      = $('attendance-result'),
        summaryBody     = $('summaryBody'),
        resetAttBtn     = $('resetAttendance'),
        shareAttBtn     = $('shareAttendanceSummary'),
        downloadAttPDFBtn = $('downloadAttendancePDF');

  loadAttBtn.onclick = ev => {
    ev.preventDefault();
    if (!dateInput.value) { alert('Pick a date'); return; }
    attList.innerHTML = '';
    students.forEach(s=>{
      const row = document.createElement('div'),
            btns= document.createElement('div');
      row.className = 'attendance-item';
      row.textContent = s.name;
      btns.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'att-btn'; b.dataset.code = code; b.textContent = code;
        if (attendanceData[dateInput.value]?.[s.roll] === code) {
          b.style.background = colors[code]; b.style.color = '#fff';
        }
        b.onclick = e2 => {
          e2.preventDefault();
          btns.querySelectorAll('.att-btn').forEach(x => { x.style.background=''; x.style.color='var(--dark)'; });
          b.style.background = colors[code]; b.style.color = '#fff';
        };
        btns.append(b);
      });
      attList.append(row, btns);
    });
    saveAttBtn.classList.remove('hidden');
  };

  saveAttBtn.onclick = ev => {
    ev.preventDefault();
    const d = dateInput.value;
    attendanceData[d] = {};
    attList.querySelectorAll('.attendance-actions').forEach((btns,i)=>{
      const sel = btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll] = sel ? sel.dataset.code : 'A';
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    $('attendance-section').classList.add('hidden');
    resSection.classList.remove('hidden');
    summaryBody.innerHTML = '';
    const hdr = `Date: ${d}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    summaryBody.insertAdjacentHTML('beforebegin', `<tr><td colspan="3"><em>${hdr}</em></td></tr>`);
    students.forEach(s=>{
      const code = attendanceData[d][s.roll] || 'A',
            status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick = e2 =>{
        e2.preventDefault();
        const msg = `${hdr}\n\nName: ${s.name}\nStatus: ${status}`;
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  resetAttBtn.onclick = ev => {
    ev.preventDefault();
    resSection.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    attList.innerHTML = '';
    saveAttBtn.classList.add('hidden');
    summaryBody.innerHTML = '';
  };

  shareAttBtn.onclick = ev => {
    ev.preventDefault();
    const d = dateInput.value;
    const hdr = `Date: ${d}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const remarkMap = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'};
    const lines = students.map(s => `${s.name}: ${remarkMap[attendanceData[d][s.roll]||'A']}`);
    const total = students.length;
    const pres  = students.reduce((sum,s)=> sum + (attendanceData[d][s.roll]==='P'?1:0), 0);
    const pct   = total ? ((pres/total)*100).toFixed(1) : '0.0';
    const clsRemark = pct==100?'Best':pct>=75?'Good':pct>=50?'Fair':'Poor';
    const summary = `Overall Attendance: ${pct}% | ${clsRemark}`;
    window.open(`https://wa.me/?text=${encodeURIComponent([hdr,'',...lines,'',summary].join('\n'))}`, '_blank');
  };

  downloadAttPDFBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    doc.autoTable({
      head:[['Name','Status']],
      body: students.map(s=>{
        const code = attendanceData[dateInput.value][s.roll]||'A';
        return [s.name,{P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]];
      }),
      startY:40,
      margin:{left:40,right:40},
      styles:{fontSize:10}
    });
    doc.save('attendance_summary.pdf');
  };

  //
  // 4. ANALYTICS
  //
  const analyticsType       = $('analyticsType'),
        analyticsDate       = $('analyticsDate'),
        analyticsMonth      = $('analyticsMonth'),
        semesterStart      = $('semesterStart'),
        semesterEnd        = $('semesterEnd'),
        yearStart          = $('yearStart'),
        loadAnalyticsBtn   = $('loadAnalytics'),
        resetAnalyticsBtn  = $('resetAnalytics'),
        instructionsEl     = $('instructions'),
        analyticsContainer = $('analyticsContainer'),
        graphsEl           = $('graphs'),
        analyticsActionsEl = $('analyticsActions'),
        shareAnalyticsBtn  = $('shareAnalytics'),
        downloadAnalyticsBtn= $('downloadAnalytics'),
        barCtx             = document.getElementById('barChart').getContext('2d'),
        pieCtx             = document.getElementById('pieChart').getContext('2d');
  let barChart, pieChart;

  analyticsType.onchange = () => {
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart,
     instructionsEl, analyticsContainer, graphsEl, analyticsActionsEl, resetAnalyticsBtn]
      .forEach(el => el.classList.add('hidden'));
    if (analyticsType.value === 'date')      analyticsDate.classList.remove('hidden');
    if (analyticsType.value === 'month')     analyticsMonth.classList.remove('hidden');
    if (analyticsType.value === 'semester')  { semesterStart.classList.remove('hidden'); semesterEnd.classList.remove('hidden'); }
    if (analyticsType.value === 'year')      yearStart.classList.remove('hidden');
  };

  resetAnalyticsBtn.onclick = e => {
    e.preventDefault();
    analyticsType.value = '';
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart,
     instructionsEl, analyticsContainer, graphsEl, analyticsActionsEl, resetAnalyticsBtn]
      .forEach(el => el.classList.add('hidden'));
  };

  loadAnalyticsBtn.onclick = e => {
    e.preventDefault();
    let from, to;
    if (analyticsType.value === 'date') {
      if (!analyticsDate.value) { alert('Pick a date'); return; }
      from = to = analyticsDate.value;
    } else if (analyticsType.value === 'month') {
      if (!analyticsMonth.value) { alert('Pick a month'); return; }
      from = analyticsMonth.value + '-01';
      to   = analyticsMonth.value + '-31';
    } else if (analyticsType.value === 'semester') {
      if (!semesterStart.value||!semesterEnd.value) { alert('Pick a range'); return; }
      from = semesterStart.value + '-01';
      to   = semesterEnd.value + '-31';
    } else if (analyticsType.value === 'year') {
      if (!yearStart.value) { alert('Pick a year'); return; }
      from = yearStart.value + '-01-01';
      to   = yearStart.value + '-12-31';
    } else return;

    const stats = students.map(s=>({ name:s.name, roll:s.roll, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    Object.entries(attendanceData).forEach(([d,recs]) => {
      if (d>=from && d<=to) stats.forEach(st=>{ const c=recs[st.roll]||'A'; st[c]++; st.total++; });
    });

    let html = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s => {
      const pct = s.total?((s.P/s.total)*100).toFixed(1):'0.0';
      html += `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
    });
    html += '</tbody></table>';
    analyticsContainer.innerHTML = html;
    analyticsContainer.classList.remove('hidden');
    instructionsEl.textContent = `Report: ${from} to ${to}`;
    instructionsEl.classList.remove('hidden');
    resetAnalyticsBtn.classList.remove('hidden');

    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
      type:'bar',
      data:{ labels: stats.map(s=>s.name), datasets:[{ label:'% Present', data: stats.map(s=> s.total? s.P/s.total*100:0 ) }] },
      options:{ maintainAspectRatio:true }
    });

    const agg = stats.reduce((a,s)=>{ ['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]); return a; },{P:0,A:0,Lt:0,HD:0,L:0});
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type:'pie',
      data:{ labels:['P','A','Lt','HD','L'], datasets:[{ data: Object.values(agg) }] },
      options:{ maintainAspectRatio:true }
    });

    graphsEl.classList.remove('hidden');
    analyticsActionsEl.classList.remove('hidden');
  };

  shareAnalyticsBtn.onclick = e => {
    e.preventDefault();
    const period = instructionsEl.textContent.replace('Report: ','');
    const hdr    = `Date Range: ${period}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const rows   = Array.from(document.querySelectorAll('#analyticsContainer tbody tr')).map(r => {
      const td = Array.from(r.querySelectorAll('td')).map(x=>x.textContent);
      return `${td[0]} P:${td[1]} A:${td[2]} Lt:${td[3]} HD:${td[4]} L:${td[5]} %:${td[7]}`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+rows)}`, '_blank');
  };

  downloadAnalyticsBtn.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    doc.setFontSize(14);
    doc.text(localStorage.getItem('schoolName'), 40, 30);
    doc.setFontSize(12);
    doc.text(`Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`, 40, 45);
    doc.text(instructionsEl.textContent.replace('Report: ','Period: '), 40, 60);
    doc.autoTable({ html:'#analyticsContainer table', startY:75, margin:{left:40,right:40}, styles:{fontSize:8} });
    const y = doc.lastAutoTable.finalY + 10;
    doc.addImage(barChart.toBase64Image(),'PNG',40,y,120,80);
    doc.addImage(pieChart.toBase64Image(),'PNG',180,y,120,80);
    doc.save('analytics_report.pdf');
  };

  //
  // 5. TRADITIONAL REGISTER
  //
  const registerMonthInput    = $('registerMonth'),
        loadRegisterBtn       = $('loadRegister'),
        registerTableWrapper  = $('registerTableWrapper'),
        registerSummary       = $('registerSummary'),
        registerGraphs        = $('registerGraphs'),
        shareRegisterBtn      = $('shareRegister'),
        downloadRegisterPDFBtn2 = $('downloadRegisterPDF');
  let regBarChart, regPieChart, registerStats;

  loadRegisterBtn.onclick = () => {
    if (!registerMonthInput.value) { alert('Pick a month'); return; }
    const [yr, mo] = registerMonthInput.value.split('-').map(Number);
    const daysInMo = new Date(yr, mo, 0).getDate();

    // build table
    let html = '<table class="register-table"><thead><tr><th>Sr#</th><th>Reg#</th><th>Name</th>';
    for (let d=1; d<=daysInMo; d++) html += `<th>${d}</th>`;
    html += '</tr></thead><tbody>';
    students.forEach((s,i) => {
      html += `<tr><td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1; d<=daysInMo; d++) {
        const dd  = String(d).padStart(2,'0'),
              key = `${yr}-${String(mo).padStart(2,'0')}-${dd}`,
              code=attendanceData[key]?.[s.roll]||'A';
        html += `<td class="${code}" style="background:${colors[code]};color:${(code==='Lt'||code==='HD')?'var(--dark)':'#fff'}">${code}</td>`;
      }
      html += '</tr>';
    });
    html += '</tbody></table>';
    registerTableWrapper.innerHTML = html;
    registerTableWrapper.classList.remove('hidden');

    // summary stats
    const stats = students.map(s=>({name:s.name,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    for (let d=1; d<=daysInMo; d++) {
      const dd=String(d).padStart(2,'0'), key=`${yr}-${String(mo).padStart(2,'0')}-${dd}`;
      stats.forEach((st,idx)=>{
        const c = attendanceData[key]?.[students[idx].roll]||'A';
        st[c]++; st.total++;
      });
    }
    registerStats = stats;
    let sumHtml = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>%</th></tr></thead><tbody>';
    stats.forEach(st=>{
      const pct = st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      sumHtml += `<tr><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${pct}</td></tr>`;
    });
    sumHtml += '</tbody></table>';
    registerSummary.innerHTML = sumHtml;
    registerSummary.classList.remove('hidden');

    // charts
    const barCtx2 = document.getElementById('registerBarChart').getContext('2d'),
          pieCtx2 = document.getElementById('registerPieChart').getContext('2d'),
          labels = stats.map(s=>s.name),
          dataPct= stats.map(s=> s.total? s.P/s.total*100:0);
    if (regBarChart) regBarChart.destroy();
    regBarChart = new Chart(barCtx2, { type:'bar', data:{labels,datasets:[{label:'% Present',data:dataPct}]}, options:{maintainAspectRatio:true} });
    const agg2 = stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    if (regPieChart) regPieChart.destroy();
    regPieChart = new Chart(pieCtx2, { type:'pie', data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg2)}]}, options:{maintainAspectRatio:true} });
    registerGraphs.classList.remove('hidden');

    shareRegisterBtn.classList.remove('hidden');
    downloadRegisterPDFBtn2.classList.remove('hidden');
  };

  shareRegisterBtn.onclick = () => {
    const period = registerMonthInput.value,
          hdr    = `Register Month: ${period}`,
          lines  = students.map((s,i)=>{
            const st = registerStats[i];
            return `${s.adm} ${s.name}: P:${st.P} A:${st.A} Lt:${st.Lt} HD:${st.HD} L:${st.L}`;
          }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines)}`, '_blank');
  };
});
