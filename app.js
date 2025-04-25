// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- STORAGE & HELPERS ---
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);

  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};

  async function saveStudents()       { await set('students', students); }
  async function saveAttendanceData(){ await set('attendanceData', attendanceData); }

  function getCurrentClassSection() {
    return { cls: $('teacherClassSelect').value, sec: $('teacherSectionSelect').value };
  }
  function filteredStudents() {
    const { cls, sec } = getCurrentClassSection();
    return students.filter(s => s.cls === cls && s.sec === sec);
  }

  // --- DOM ELEMENTS ---
  // Setup
  const schoolInput    = $('schoolNameInput');
  const classSelect    = $('teacherClassSelect');
  const sectionSelect  = $('teacherSectionSelect');
  const btnSaveSetup   = $('saveSetup');
  const setupForm      = $('setupForm');
  const setupDisplay   = $('setupDisplay');
  const setupText      = $('setupText');
  const btnEditSetup   = $('editSetup');
  // Registration
  const nameInput      = $('studentName');
  const admInput       = $('admissionNo');
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
  // Attendance
  const dateInput      = $('dateInput');
  const btnLoadAtt     = $('loadAttendance');
  const divAttList     = $('attendanceList');
  const btnSaveAtt     = $('saveAttendance');
  const sectionResult  = $('attendance-result');
  const tbodySummary   = $('summaryBody');
  const btnResetAtt    = $('resetAttendance');
  const btnShareAtt    = $('shareAttendanceSummary');
  const btnDownloadAtt = $('downloadAttendancePDF');
  // Analytics
  const selectAnalyticsTarget = $('analyticsTarget');
  const admAnalyticsInput     = $('studentAdmInput');
  const selectAnalyticsType   = $('analyticsType');
  const inputAnalyticsDate    = $('analyticsDate');
  const inputAnalyticsMonth   = $('analyticsMonth');
  const inputSemesterStart    = $('semesterStart');
  const inputSemesterEnd      = $('semesterEnd');
  const inputAnalyticsYear    = $('yearStart');
  const btnLoadAnalytics      = $('loadAnalytics');
  const btnResetAnalytics     = $('resetAnalytics');
  const divInstructions       = $('instructions');
  const divAnalyticsTable     = $('analyticsContainer');
  const divGraphs             = $('graphs');
  const btnShareAnalytics     = $('shareAnalytics');
  const btnDownloadAnalytics  = $('downloadAnalytics');
  const ctxBar                = $('barChart').getContext('2d');
  const ctxPie                = $('pieChart').getContext('2d');
  let chartBar, chartPie;
  // Register
  const monthInput     = $('registerMonth');
  const btnLoadReg     = $('loadRegister');
  const btnChangeReg   = $('changeRegister');
  const divRegTable    = $('registerTableWrapper');
  const tbodyReg       = $('registerBody');
  const divRegSummary  = $('registerSummarySection');
  const tbodyRegSum    = $('registerSummaryBody');
  const btnShareReg2   = $('shareRegister');
  const btnDownloadReg2= $('downloadRegisterPDF');
  const headerRegRow   = document.querySelector('#registerTable thead tr');

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

  // --- STUDENT REGISTRATION LOGIC ---
  let registrationSaved = false, inlineEditing = false;
  function bindRowSelection() {
    const boxes = Array.from(tbodyStudents.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        btnEditSel.disabled = btnDeleteSel.disabled = !any;
      };
    });
    chkAllStudents.disabled = registrationSaved;
    chkAllStudents.onchange = () => boxes.forEach(cb => {
      cb.checked = chkAllStudents.checked;
      cb.dispatchEvent(new Event('change'));
    });
  }
  function renderStudents() {
    const list = filteredStudents();
    tbodyStudents.innerHTML = '';
    list.forEach((st, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" data-index="${idx}" ${registrationSaved?'disabled':''}></td>
        <td>${st.name}</td><td>${st.adm}</td><td>${st.parent}</td>
        <td>${st.contact}</td><td>${st.occupation}</td><td>${st.address}</td>
        <td>${registrationSaved?'<button class="share-one">Share</button>':''}</td>
      `;
      if (registrationSaved) {
        tr.querySelector('.share-one').onclick = () => {
          const hdr = `School: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
          const msg = [
            hdr,
            `Name: ${st.name}`,
            `Adm#: ${st.adm}`,
            `Parent: ${st.parent}`,
            `Contact: ${st.contact}`,
            `Occupation: ${st.occupation}`,
            `Address: ${st.address}`
          ].join('\n');
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      tbodyStudents.appendChild(tr);
    });
    bindRowSelection();
  }

  btnAddStudent.onclick = async e => {
    e.preventDefault();
    const name = nameInput.value.trim(),
          adm  = admInput.value.trim(),
          par  = parentInput.value.trim(),
          cont = contactInput.value.trim(),
          occ  = occInput.value.trim(),
          addr = addrInput.value.trim();
    if (!name||!adm||!par||!cont||!occ||!addr) {
      return alert('All fields required');
    }
    if (!/^\d+$/.test(adm)) {
      return alert('Admission number must be numeric');
    }
    if (!/^\d{7,15}$/.test(cont)) {
      return alert('Contact must be 7–15 digits');
    }
    if (students.some(s=>s.adm===adm && s.cls===classSelect.value && s.sec===sectionSelect.value)) {
      return alert('Duplicate Admission# in this class & section');
    }
    students.push({
      name, adm, parent:par, contact:cont, occupation:occ, address:addr,
      roll: Date.now(), cls:classSelect.value, sec:sectionSelect.value
    });
    await saveStudents();
    renderStudents();
    [nameInput, admInput, parentInput, contactInput, occInput, addrInput].forEach(i=>i.value='');
  };

  function handleInlineBlur(e) {
    const td = e.target,
          tr = td.closest('tr'),
          idx= +tr.querySelector('.sel').dataset.index,
          keys=['name','adm','parent','contact','occupation','address'],
          ci = Array.from(tr.children).indexOf(td),
          val=td.textContent.trim(),
          list=filteredStudents(),
          stu=list[idx];
    if (ci===2 && !/^\d+$/.test(val)) {
      alert('Adm# numeric'); renderStudents(); return;
    }
    if (ci===2 && students.some(s=>s.adm===val && s.roll!==stu.roll)) {
      alert('Duplicate Adm#'); renderStudents(); return;
    }
    if (ci>=1 && ci<=6) {
      stu[keys[ci-1]] = val;
      students = students.map(s=>s.roll===stu.roll?stu:s);
      saveStudents();
    }
  }

  btnEditSel.onclick = e => {
    e.preventDefault();
    const checked = Array.from(tbodyStudents.querySelectorAll('.sel:checked'));
    if (!checked.length) return;
    inlineEditing = !inlineEditing;
    btnEditSel.textContent = inlineEditing ? 'Done Editing' : 'Edit Selected';
    checked.forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td,ci)=>{
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineEditing;
          td.classList.toggle('editing', inlineEditing);
          inlineEditing
            ? td.addEventListener('blur', handleInlineBlur)
            : td.removeEventListener('blur', handleInlineBlur);
        }
      });
    });
  };

  btnDeleteSel.onclick = async e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    const toRemove = Array.from(tbodyStudents.querySelectorAll('.sel:checked'))
      .map(cb=>filteredStudents()[+cb.dataset.index].roll);
    students = students.filter(s=>!toRemove.includes(s.roll));
    await saveStudents();
    renderStudents();
  };

  btnSaveReg.onclick = e => {
    e.preventDefault();
    registrationSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$ (id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$ (id).classList.remove('hidden'));
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  btnEditReg.onclick = e => {
    e.preventDefault();
    registrationSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$ (id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$ (id).classList.add('hidden'));
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  btnShareReg.onclick = e => {
    e.preventDefault();
    const hdr = `School: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
    const lines = filteredStudents().map(s=>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`, '_blank');
  };

  btnDownloadReg.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Student Registration',10,10);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`,10,20);
    doc.text(`School: ${schoolInput.value}`,10,26);
    doc.text(`Class: ${classSelect.value}`,10,32);
    doc.text(`Section: ${sectionSelect.value}`,10,38);
    doc.autoTable({
      head:[['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: filteredStudents().map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY:44
    });
    doc.save('student_registration.pdf');
  };

  renderStudents();

  // --- ATTENDANCE MARKING ---
  btnLoadAtt.onclick = e => {
    e.preventDefault();
    const d = dateInput.value;
    if (!d) return alert('Pick a date');
    divAttList.innerHTML = '';
    filteredStudents().forEach(s=>{
      const row = document.createElement('div'); row.className='attendance-item'; row.textContent=s.name;
      const actions = document.createElement('div'); actions.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b = document.createElement('button');
        b.type='button'; b.textContent=code; b.dataset.code=code;
        if(attendanceData[d]?.[s.roll]===code){ b.style.background=colors[code]; b.style.color='#fff'; }
        b.onclick = e2 => {
          e2.preventDefault();
          actions.querySelectorAll('button').forEach(x=>{ x.style.background=''; x.style.color='#333'; });
          b.style.background = colors[code];
          b.style.color = '#fff';
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
    document.querySelectorAll('.attendance-actions').forEach((actions,i)=>{
      const sel = actions.querySelector('button[style*="background"]');
      attendanceData[d][filteredStudents()[i].roll] = sel?.dataset.code || 'A';
    });
    await saveAttendanceData();
    $('attendance-section').classList.add('hidden');
    sectionResult.classList.remove('hidden');
    tbodySummary.innerHTML = `<tr><td colspan="3"><em>Date: ${d}\nSchool: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}</em></td></tr>`;
    filteredStudents().forEach(s=>{
      const code = attendanceData[d][s.roll] || 'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick = () => {
        const msg = [
          `Date: ${d}`,
          `School: ${schoolInput.value}`,
          `Class: ${classSelect.value}`,
          `Section: ${sectionSelect.value}`,
          '',
          `Name: ${s.name}`,
          `Status: ${status}`
        ].join('\n');
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      };
      tbodySummary.appendChild(tr);
    });
  };

  btnResetAtt.onclick = () => {
    sectionResult.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    divAttList.innerHTML = '';
    btnSaveAtt.classList.add('hidden');
  };

  btnShareAtt.onclick = () => {
    const d = dateInput.value;
    const hdr = `Date: ${d}\nSchool: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
    const lines = filteredStudents().map(s=>{
      const code = attendanceData[d][s.roll] || 'A';
      return `${s.name}: ${ {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code] }`;
    });
    const total = filteredStudents().length;
    const pres  = filteredStudents().reduce((a,s)=>a + (attendanceData[d][s.roll]==='P'?1:0), 0);
    const pct   = total?((pres/total)*100).toFixed(1):'0.0';
    const summary = `${hdr}\n\n${lines.join('\n')}\n\nOverall Attendance: ${pct}%`;
    window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, '_blank');
  };

  btnDownloadAtt.onclick = () => {
    const d = dateInput.value;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Daily Attendance Report', 10, 10);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date(d).toLocaleDateString()}`, 10, 20);
    doc.text(`School: ${schoolInput.value}`, 10, 26);
    doc.text(`Class: ${classSelect.value}`, 10, 32);
    doc.text(`Section: ${sectionSelect.value}`, 10, 38);
    doc.autoTable({
      head:[['Name','Status']],
      body: filteredStudents().map(s=>{ const code = attendanceData[d][s.roll]||'A'; return [s.name, {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]]; }),
      startY: 44
    });
    doc.save('attendance_summary.pdf');
  };  
 // --- ANALYTICS ---
  const analyticsTargetEl = $('analyticsTarget');
  const analyticsTypeEl   = $('analyticsType');

  function hideAnalyticsInputs() {
    ['studentAdmInput','analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart','instructions','analyticsContainer','graphs','analyticsActions']
      .forEach(id => $(id).classList.add('hidden'));
  }

  analyticsTargetEl.onchange = () => {
    $('studentAdmInput').classList.toggle('hidden', analyticsTargetEl.value!=='student');
    hideAnalyticsInputs();
    analyticsTypeEl.value = '';
  };

  analyticsTypeEl.onchange = () => {
    hideAnalyticsInputs();
    if (analyticsTypeEl.value==='date')    $('analyticsDate').classList.remove('hidden');
    if (analyticsTypeEl.value==='month')   $('analyticsMonth').classList.remove('hidden');
    if (analyticsTypeEl.value==='semester'){ $('semesterStart').classList.remove('hidden'); $('semesterEnd').classList.remove('hidden'); }
    if (analyticsTypeEl.value==='year')    $('yearStart').classList.remove('hidden');
    $('resetAnalytics').classList.remove('hidden');
  };

  $('resetAnalytics').onclick = e => { e.preventDefault(); hideAnalyticsInputs(); analyticsTypeEl.value = ''; };

  $('loadAnalytics').onclick = e => {
    e.preventDefault();
    let from, to;
    if (analyticsTypeEl.value==='date') {
      if (!$('analyticsDate').value) return alert('Pick a date');
      from = to = $('analyticsDate').value;
    } else if (analyticsTypeEl.value==='month') {
      if (!$('analyticsMonth').value) return alert('Pick a month');
      const [y,m] = $('analyticsMonth').value.split('-').map(Number);
      from = `${$('analyticsMonth').value}-01`;
      to   = `${$('analyticsMonth').value}-${new Date(y,m,0).getDate()}`;
    } else if (analyticsTypeEl.value==='semester') {
      if (!$('semesterStart').value || !$('semesterEnd').value) return alert('Pick semester range');
      from = `${$('semesterStart').value}-01`;
      const [ey,em] = $('semesterEnd').value.split('-').map(Number);
      to   = `${$('semesterEnd').value}-${new Date(ey,em,0).getDate()}`;
    } else if (analyticsTypeEl.value==='year') {
      if (!$('yearStart').value) return alert('Pick year');
      from = `${$('yearStart').value}-01-01`;
      to   = `${$('yearStart').value}-12-31`;
    } else {
      return alert('Select period');
    }

    // collect stats
    let stats = filteredStudents().map(s => ({ name: s.name, roll: s.roll, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    Object.entries(attendanceData).forEach(([d,recs]) => {
      const cd = new Date(d), fD = new Date(from), tD = new Date(to);
      if (cd>=fD && cd<=tD) {
        stats.forEach(st => {
          const code = recs[st.roll] || 'A';
          st[code]++; st.total++;
        });
      }
    });

    // build table
    let html = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s => {
      const pct = s.total?((s.P/s.total)*100).toFixed(1):'0.0';
      html += `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
    });
    html += '</tbody></table>';
    $('analyticsContainer').innerHTML = html;
    $('analyticsContainer').classList.remove('hidden');

    // instructions
    $('instructions').textContent = analyticsTargetEl.value==='student'
      ? `Adm#: ${$('studentAdmInput').value.trim()} | Report: ${from} to ${to}`
      : `Report: ${from} to ${to}`;
    $('instructions').classList.remove('hidden');

    // bar chart
    const labels = stats.map(s=>s.name), dataPct = stats.map(s=>s.total?(s.P/s.total)*100:0);
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, { type:'bar', data:{ labels, datasets:[{ label:'% Present', data:dataPct }] },
      options:{ responsive:true, scales:{ y:{ beginAtZero:true, max:100 } } } });

    // pie chart
    const agg = stats.reduce((a,s)=>{ ['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]); return a; }, {P:0,A:0,Lt:0,HD:0,L:0});
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, { type:'pie', data:{ labels:['Present','Absent','Late','Half Day','Leave'], datasets:[{ data:Object.values(agg) }] },
      options:{ responsive:true } });

    $('graphs').classList.remove('hidden');
    $('analyticsActions').classList.remove('hidden');
  };

  $('shareAnalytics').onclick = e => {
    e.preventDefault();
    const hdr = $('instructions').textContent.split('|')[1].trim();
    const header = `Period: ${hdr}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const rows = [...$('analyticsContainer').querySelectorAll('tbody tr')].map(r=>{
      const td = [...r.querySelectorAll('td')].map(c=>c.textContent);
      return `${td[0]} P:${td[1]} A:${td[2]} Lt:${td[3]} HD:${td[4]} L:${td[5]} Total:${td[6]} %:${td[7]}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+rows.join('\n'))}`,'_blank');
  };

  $('downloadAnalytics').onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Attendance Analytics',10,10);
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`,10,20);
    const period = $('instructions').textContent.split('|')[1].trim();
    doc.text(`Period: ${period}`,10,26);
    doc.text(`School: ${schoolIn.value}`,10,32);
    doc.text(`Class: ${classSel.value} | Section: ${secSel.value}`,10,38);
    doc.autoTable({
      head:[['Name','P','A','Lt','HD','L','Total','%']],
      body:[...$('analyticsContainer').querySelectorAll('tbody tr')].map(r=>[...r.querySelectorAll('td')].map(c=>c.textContent)),
      startY:44
    });
    const y = doc.lastAutoTable.finalY + 10;
    doc.addImage(barChart.toBase64Image(),'PNG',10,y,80,60);
    doc.addImage(pieChart.toBase64Image(),'PNG',100,y,80,60);
    doc.save('attendance_analytics.pdf');
  };

  // --- ATTENDANCE REGISTER ---
  const headerRowEl = document.querySelector('#registerTable thead tr');

  function generateRegisterHeader(days) {
    headerRowEl.innerHTML = '<th>Sr#</th><th>Adm#</th><th>Name</th>';
    for (let d=1; d<=days; d++) {
      const th=document.createElement('th'); th.textContent=d;
      headerRowEl.appendChild(th);
    }
  }

  loadRegBtn.onclick = e => {
    e.preventDefault();
    if (!registerMonthIn.value) return alert('Select month');
    const [y,m] = registerMonthIn.value.split('-').map(Number);
    const days = new Date(y,m,0).getDate();
    generateRegisterHeader(days);
    registerBody.innerHTML = ''; registerSummaryBody.innerHTML = '';
    filteredStudents().forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1; d<=days; d++){
        const dateStr=`${registerMonthIn.value}-${String(d).padStart(2,'0')}`;
        const code=(attendanceData[dateStr]||{})[s.roll]||'A';
        const td=document.createElement('td');
        td.textContent=code; td.style.background=colors[code]; td.style.color='#fff';
        tr.appendChild(td);
      }
      registerBody.appendChild(tr);
    });
    filteredStudents().forEach(s=>{
      const stat={P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for (let d=1; d<=days; d++){
        const dateStr=`${registerMonthIn.value}-${String(d).padStart(2,'0')}`;
        const code=(attendanceData[dateStr]||{})[s.roll]||'A';
        stat[code]++; stat.total++;
      }
      const pct = stat.total?((stat.P/stat.total)*100).toFixed(1):'0.0';
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${stat.P}</td><td>${stat.A}</td><td>${stat.Lt}</td><td>${stat.HD}</td><td>${stat.L}</td><td>${pct}</td>`;
      registerSummaryBody.appendChild(tr);
    });
    registerTableWrap.classList.remove('hidden');
    registerSummarySec.classList.remove('hidden');
    loadRegBtn.classList.add('hidden');
    changeRegBtn.classList.remove('hidden');
  };

  changeRegBtn.onclick = e => {
    e.preventDefault();
    registerTableWrap.classList.add('hidden');
    registerSummarySec.classList.add('hidden');
    loadRegBtn.classList.remove('hidden');
    changeRegBtn.classList.add('hidden');
  };

  shareReg2Btn.onclick = e => {
    e.preventDefault();
    const hdr=`Register for ${registerMonthIn.value}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines=[...registerSummaryBody.querySelectorAll('tr')].map(r=>{
      const td=[...r.querySelectorAll('td')].map(c=>c.textContent);
      return `${td[0]}: P:${td[1]}, A:${td[2]}, Lt:${td[3]}, HD:${td[4]}, L:${td[5]}, %:${td[6]}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines.join('\n'))}`,'_blank');
  };

  downloadReg2Btn.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    doc.setFontSize(16); doc.text('Monthly Attendance Register',10,10);
    doc.setFontSize(12);
    doc.text(`Month: ${registerMonthIn.value}`,10,20);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`,10,26);
    doc.text(`School: ${schoolIn.value}`,10,32);
    doc.text(`Class: ${classSel.value} | Section: ${secSel.value}`,10,38);
    doc.autoTable({ html:'#registerTable', startY:44, styles:{fontSize:6}, columnStyles:{0:{cellWidth:10},1:{cellWidth:15},2:{cellWidth:30}} });
    doc.autoTable({ html:'#registerSummarySection table', startY:doc.lastAutoTable.finalY+10, styles:{fontSize:8} });
    doc.save('attendance_register.pdf');
  };

  // --- SERVICE WORKER ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.error('SW failed:', err));
    });
  }
});
