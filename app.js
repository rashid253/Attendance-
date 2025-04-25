// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- STORAGE & HELPERS ---
  const { get, set } = window.idbKeyval;
  const $ = id => document.getElementById(id);

  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};

  async function saveStudents()       { await set('students', students); }
  async function saveAttendanceData(){ await set('attendanceData', attendanceData); }

  // Color map
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // --- ELEMENTS ---
  // Setup
  const schoolInput    = $('schoolNameInput'),
        classSelect    = $('teacherClassSelect'),
        sectionSelect  = $('teacherSectionSelect'),
        btnSaveSetup   = $('saveSetup'),
        setupForm      = $('setupForm'),
        setupDisplay   = $('setupDisplay'),
        setupText      = $('setupText'),
        btnEditSetup   = $('editSetup');
  // Registration
  const nameInput       = $('studentName'),
        admInput        = $('admissionNo'),
        parentInput     = $('parentName'),
        contactInput    = $('parentContact'),
        occInput        = $('parentOccupation'),
        addrInput       = $('parentAddress'),
        btnAddStudent   = $('addStudent'),
        tbodyStudents   = $('studentsBody'),
        chkAllStudents  = $('selectAllStudents'),
        btnEditSel      = $('editSelected'),
        btnDeleteSel    = $('deleteSelected'),
        btnSaveReg      = $('saveRegistration'),
        btnShareReg     = $('shareRegistration'),
        btnDownloadReg  = $('downloadRegistrationPDF'),
        wrapperStudents = $('studentTableWrapper');
  // Attendance
  const dateInput       = $('dateInput'),
        btnLoadAtt      = $('loadAttendance'),
        divAttList      = $('attendanceList'),
        btnSaveAtt      = $('saveAttendance'),
        sectionResult   = $('attendance-result'),
        tbodySummary    = $('summaryBody'),
        btnResetAtt     = $('resetAttendance'),
        btnShareAtt     = $('shareAttendanceSummary'),
        btnDownloadAtt  = $('downloadAttendancePDF');
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
  // Register
  const monthInput       = $('registerMonth'),
        btnLoadReg       = $('loadRegister'),
        btnChangeReg     = $('changeRegister'),
        divRegTable      = $('registerTableWrapper'),
        tbodyReg         = $('registerBody'),
        divRegSummary    = $('registerSummarySection'),
        tbodyRegSum      = $('registerSummaryBody'),
        btnShareReg2     = $('shareRegister'),
        btnDownloadReg2  = $('downloadRegisterPDF'),
        headerRegRowEl   = document.querySelector('#registerTable thead tr');

  // --- STATE ---
  let registrationSaved = false;
  let inlineEditing     = false;
  let chartBar, chartPie;

  // --- UTILITIES ---
  function getCurrentClassSection() {
    return { cls: classSelect.value, sec: sectionSelect.value };
  }
  function filteredStudents() {
    const { cls, sec } = getCurrentClassSection();
    return students.filter(s => s.cls === cls && s.sec === sec);
  }
  function updateTotals() {
    $('totalSchoolCount').textContent  = students.length;
    $('totalClassCount').textContent   = students.filter(s=>s.cls===classSelect.value).length;
    $('totalSectionCount').textContent = filteredStudents().length;
  }
  function bindRowSelection() {
    const boxes = Array.from(tbodyStudents.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        const any = boxes.some(x=>x.checked);
        btnEditSel.disabled = btnDeleteSel.disabled = !any;
      };
    });
    chkAllStudents.disabled = registrationSaved;
    chkAllStudents.onchange = () => boxes.forEach(cb => cb.checked = chkAllStudents.checked);
  }

  // --- SETUP ---
  async function loadSetup() {
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if (school && cls && sec) {
      schoolInput.value   = school;
      classSelect.value   = cls;
      sectionSelect.value = sec;
      setupText.textContent = `${school} | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('d-none');
      setupDisplay.classList.remove('d-none');
      renderStudents();
    }
    updateTotals();
  }
  btnSaveSetup.onclick = async () => {
    if (!schoolInput.value||!classSelect.value||!sectionSelect.value) return alert('Complete setup');
    await set('schoolName',schoolInput.value);
    await set('teacherClass',classSelect.value);
    await set('teacherSection',sectionSelect.value);
    loadSetup();
  };
  btnEditSetup.onclick = () => {
    setupForm.classList.remove('d-none');
    setupDisplay.classList.add('d-none');
  };
  await loadSetup();

  // --- STUDENT REGISTRATION ---
  function renderStudents() {
    tbodyStudents.innerHTML = '';
    filteredStudents().forEach((st, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" ${registrationSaved?'disabled':''}></td>
        <td>${idx+1}</td><td>${st.name}</td><td>${st.adm}</td><td>${st.parent}</td>
        <td>${st.contact}</td><td>${st.occupation}</td><td>${st.address}</td>
        <td>
          ${registrationSaved
            ? '<button id="editRegistration" class="btn btn-sm btn-info">Edit</button> <button id="downloadRegistrationPDF" class="btn btn-sm btn-danger">Download</button> <button id="shareRegistration" class="btn btn-sm btn-primary">Share</button>'
            : ''}
        </td>`;
      tbodyStudents.appendChild(tr);
    });
    bindRowSelection();
    updateTotals();

    if (registrationSaved) {
      $('editRegistration').onclick   = restoreRegistration;
      $('downloadRegistrationPDF').onclick = downloadRegistration;
      $('shareRegistration').onclick  = shareRegistration;
      wrapperStudents.classList.add('saved');
    }
  }
  btnAddStudent.onclick = async () => {
    const name = nameInput.value.trim(),
          adm  = admInput.value.trim(),
          par  = parentInput.value.trim(),
          cont = contactInput.value.trim(),
          occ  = occInput.value.trim(),
          addr = addrInput.value.trim();
    if (!name||!adm||!par||!cont||!occ||!addr) return alert('All fields required');
    if (!/^\d+$/.test(adm)) return alert('Admission# must be numeric');
    if (!/^\d{7,15}$/.test(cont)) return alert('Contact must be 7–15 digits');
    if (students.some(s=>s.adm===adm&&s.cls===classSelect.value&&s.sec===sectionSelect.value)) return alert('Duplicate Admission#');
    students.push({ name, adm, parent:par, contact:cont, occupation:occ, address:addr, roll:Date.now(), cls:classSelect.value, sec:sectionSelect.value });
    await saveStudents();
    renderStudents();
    [nameInput,admInput,parentInput,contactInput,occInput,addrInput].forEach(i=>i.value='');
  };
  btnSaveReg.onclick = () => {
    registrationSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.add('d-none'));
    ['shareRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.remove('d-none'));
    renderStudents();
  };
  function restoreRegistration() {
    registrationSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.remove('d-none'));
    ['shareRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.add('d-none'));
    wrapperStudents.classList.remove('saved');
    renderStudents();
  }
  function shareRegistration() {
    const hdr = `School: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
    const lines = filteredStudents().map(s=>`Name:${s.name}, Adm#:${s.adm}, Parent:${s.parent}, Contact:${s.contact}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines)}`, '_blank');
  }
  function downloadRegistration() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Student Registration',10,10);
    doc.setFontSize(12); doc.text(`Date: ${new Date().toLocaleDateString()}`,10,20);
    doc.autoTable({ head:[['Name','Adm#','Parent','Contact','Occ.','Address']], body: filteredStudents().map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]), startY:30 });
    doc.save('student_registration.pdf');
  }
  renderStudents();

  // --- ATTENDANCE ---  
  btnLoadAtt.onclick = () => {
    const d = dateInput.value; if (!d) return alert('Pick a date');
    divAttList.innerHTML = '';
    filteredStudents().forEach(s=>{
      const label = document.createElement('div'); label.textContent = s.name;
      const actions = document.createElement('div'); actions.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const btn = document.createElement('button');
        btn.textContent = code; btn.onclick = () => {
          actions.querySelectorAll('button').forEach(b=>{ b.style.background=''; b.style.color='#333'; });
          btn.style.background = colors[code]; btn.style.color='#fff';
        };
        if (attendanceData[d]?.[s.roll]===code) { btn.style.background=colors[code]; btn.style.color='#fff'; }
        actions.appendChild(btn);
      });
      divAttList.append(label, actions);
    });
    btnSaveAtt.classList.remove('d-none');
  };
  btnSaveAtt.onclick = async () => {
    const d = dateInput.value; attendanceData[d]={};
    document.querySelectorAll('.attendance-actions').forEach((actions,i)=>{
      const sel = actions.querySelector('button[style*="background"]');
      attendanceData[d][filteredStudents()[i].roll] = sel?.textContent || 'A';
    });
    await saveAttendanceData();
    sectionResult.classList.remove('d-none');
    tbodySummary.innerHTML = `<tr><td colspan="3"><em>Date: ${d}</em></td></tr>`;
    filteredStudents().forEach(s=>{
      const code = attendanceData[d][s.roll]||'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class="btn btn-sm btn-primary">Send</button></td>`;
      tr.querySelector('button').onclick = () => {
        const msg = [`Date:${d}`,`School:${schoolInput.value}`,`Class:${classSelect.value}`,`Section:${sectionSelect.value}`,`Name:${s.name}`,`Status:${status}`].join('\n');
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
      };
      tbodySummary.appendChild(tr);
    });
    btnShareAtt.onclick = shareAttendance;
    btnDownloadAtt.onclick = downloadAttendance;
  };
  btnResetAtt.onclick = () => {
    sectionResult.classList.add('d-none');
    divAttList.innerHTML = '';
    btnSaveAtt.classList.add('d-none');
  };
  function shareAttendance() {
    const d = dateInput.value;
    const hdr = `Date:${d}\nSchool:${schoolInput.value}\nClass:${classSelect.value}\nSection:${sectionSelect.value}`;
    const lines = filteredStudents().map(s=>{
      const code=attendanceData[d][s.roll]||'A';
      return `${s.name}:${ {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code] }`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines)}`);
  }
  function downloadAttendance() {
    const d = dateInput.value, { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Daily Attendance Report',10,10);
    doc.setFontSize(12); doc.text(`Date: ${new Date(d).toLocaleDateString()}`,10,20);
    doc.autoTable({ head:[['Name','Status']], body: filteredStudents().map(s=>{ const code=attendanceData[d][s.roll]||'A'; return [s.name,{P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]]; }), startY:30 });
    doc.save('attendance_summary.pdf');
  }

  // --- ANALYTICS ---
  function hideAnalyticsInputs() {
    ['studentAdmInput','analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart','instructions','analyticsContainer','graphs','analyticsActions2']
      .forEach(id=>$(id).classList.add('d-none'));
  }
  selectAnalyticsTarget.onchange = () => {
    admAnalyticsInput.classList.toggle('d-none', selectAnalyticsTarget.value!=='student');
    hideAnalyticsInputs();
    selectAnalyticsType.value='';
  };
  selectAnalyticsType.onchange = () => {
    hideAnalyticsInputs();
    if (selectAnalyticsType.value==='date')       inputAnalyticsDate.classList.remove('d-none');
    if (selectAnalyticsType.value==='month')      inputAnalyticsMonth.classList.remove('d-none');
    if (selectAnalyticsType.value==='semester'){ inputSemesterStart.classList.remove('d-none'); inputSemesterEnd.classList.remove('d-none'); }
    if (selectAnalyticsType.value==='year')       inputAnalyticsYear.classList.remove('d-none');
    btnResetAnalytics.classList.remove('d-none');
  };
  btnResetAnalytics.onclick = () => { hideAnalyticsInputs(); selectAnalyticsType.value=''; };
  btnLoadAnalytics.onclick = () => {
    let from, to;
    const t = selectAnalyticsType.value;
    if (t==='date') {
      if (!inputAnalyticsDate.value) return alert('Pick a date');
      from=to=inputAnalyticsDate.value;
    } else if (t==='month') {
      if (!inputAnalyticsMonth.value) return alert('Pick a month');
      const [y,m] = inputAnalyticsMonth.value.split('-').map(Number);
      from=`${inputAnalyticsMonth.value}-01`;
      to  =`${inputAnalyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (t==='semester') {
      if (!inputSemesterStart.value||!inputSemesterEnd.value) return alert('Pick semester');
      const [ey,em] = inputSemesterEnd.value.split('-').map(Number);
      from=`${inputSemesterStart.value}-01`;
      to  =`${inputSemesterEnd.value}-${new Date(ey,em,0).getDate()}`;
    } else if (t==='year') {
      if (!inputAnalyticsYear.value) return alert('Pick year');
      from=`${inputAnalyticsYear.value}-01-01`;
      to  =`${inputAnalyticsYear.value}-12-31`;
    } else return alert('Select period');

    // compute stats
    const stats = filteredStudents().map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([day,recs])=>{
      if (day>=from && day<=to) stats.forEach(st=>{
        const c=recs[st.roll]||'A'; st[c]++; st.total++;
      });
    });

    // render table
    let html = '<table class="table"><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s=>{
      const pct = s.total?((s.P/s.total)*100).toFixed(1):'0.0';
      html += `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
    });
    html += '</tbody></table>';
    divAnalyticsTable.innerHTML = html;
    divAnalyticsTable.classList.remove('d-none');
    divInstructions.textContent = `Period: ${from} → ${to}`;
    divInstructions.classList.remove('d-none');

    // render charts
    const labels = stats.map(s=>s.name), dataPct = stats.map(s=>s.total?(s.P/s.total)*100:0);
    chartBar?.destroy();
    chartBar = new Chart(ctxBar,{type:'bar',data:{labels,datasets:[{label:'% Present',data:dataPct}]},options:{responsive:true,scales:{y:{beginAtZero:true,max:100}}}});
    const agg = stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    chartPie?.destroy();
    chartPie = new Chart(ctxPie,{type:'pie',data:{labels:['Present','Absent','Late','Half Day','Leave'],datasets:[{data:Object.values(agg)}]},options:{responsive:true}});
    divGraphs.classList.remove('d-none');

    $('analyticsActions2').classList.remove('d-none');
    btnShareAnalytics.onclick    = shareAnalytics;
    btnDownloadAnalytics.onclick = downloadAnalytics;
  };
  function shareAnalytics() {
    const hdr = divInstructions.textContent + `\nSchool:${schoolInput.value}\nClass:${classSelect.value}\nSection:${sectionSelect.value}`;
    const rows = [...divAnalyticsTable.querySelectorAll('tbody tr')].map(r=>[...r.children].map(td=>td.textContent)).map(c=>`${c[0]} P:${c[1]} A:${c[2]} Lt:${c[3]} HD:${c[4]} L:${c[5]} Total:${c[6]} %:${c[7]}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`);
  }
  function downloadAnalytics() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Attendance Analytics',10,10);
    doc.setFontSize(12); doc.text(divInstructions.textContent,10,20);
    doc.autoTable({ head:[['Name','P','A','Lt','HD','L','Total','%']], body:[...divAnalyticsTable.querySelectorAll('tbody tr')].map(r=>[...r.children].map(td=>td.textContent)), startY:30 });
    const y = doc.lastAutoTable.finalY+10;
    doc.addImage(chartBar.toBase64Image(),'PNG',10,y,80,60);
    doc.addImage(chartPie.toBase64Image(),'PNG',100,y,80,60);
    doc.save('attendance_analytics.pdf');
  }

  // --- ATTENDANCE REGISTER ---
  function generateRegisterHeader(days) {
    headerRegRowEl.innerHTML = '<th>Sr#</th><th>Adm#</th><th>Name</th>';
    for(let d=1; d<=days; d++){
      const th=document.createElement('th'); th.textContent=d; headerRegRowEl.appendChild(th);
    }
  }
  btnLoadReg.onclick = () => {
    if (!monthInput.value) return alert('Select month');
    const [y,m] = monthInput.value.split('-').map(Number),
          days  = new Date(y,m,0).getDate();
    generateRegisterHeader(days);
    tbodyReg.innerHTML=''; tbodyRegSum.innerHTML='';
    filteredStudents().forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1; d<=days; d++){
        const dateStr=`${monthInput.value}-${String(d).padStart(2,'0')}`,
              code=(attendanceData[dateStr]||{})[s.roll]||'A';
        const td=document.createElement('td');
        td.textContent=code; td.style.background=colors[code]; td.style.color='#fff'; tr.appendChild(td);
      }
      tbodyReg.appendChild(tr);
    });
    filteredStudents().forEach(s=>{
      const stat={P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for(let d=1; d<=days; d++){
        const dateStr=`${monthInput.value}-${String(d).padStart(2,'0')}`;
        const code=(attendanceData[dateStr]||{})[s.roll]||'A'; stat[code]++; stat.total++;
      }
      const pct=stat.total?((stat.P/stat.total)*100).toFixed(1):'0.0';
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${stat.P}</td><td>${stat.A}</td><td>${stat.Lt}</td><td>${stat.HD}</td><td>${stat.L}</td><td>${pct}</td>`;
      tbodyRegSum.appendChild(tr);
    });
    divRegTable.classList.remove('d-none');
    divRegSummary.classList.remove('d-none');
    btnLoadReg.classList.add('d-none');
    btnChangeReg.classList.remove('d-none');

    btnShareReg2.onclick = () => {
      const hdr=`Register for ${monthInput.value}\nSchool:${schoolInput.value}\nClass:${classSelect.value}\nSection:${sectionSelect.value}`;
      const lines = [...tbodyRegSum.querySelectorAll('tr')].map(r=>{
        const [name,p,a,lt,hd,l,pct] = [...r.children].map(td=>td.textContent);
        return `${name}: P:${p}, A:${a}, Lt:${lt}, HD:${hd}, L:${l}, %:${pct}`;
      }).join('\n');
      window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines)}`);
    };
    btnDownloadReg2.onclick = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape');
      doc.setFontSize(16); doc.text('Monthly Attendance Register',10,10);
      doc.setFontSize(12); doc.text(`Month: ${monthInput.value}`,10,20);
      doc.autoTable({ html:'#registerTable', startY:30, styles:{fontSize:6} });
      doc.save('attendance_register.pdf');
    };
  };
  btnChangeReg.onclick = () => {
    divRegTable.classList.add('d-none');
    divRegSummary.classList.add('d-none');
    btnLoadReg.classList.remove('d-none');
    btnChangeReg.classList.add('d-none');
  };

  // --- SERVICE WORKER ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
