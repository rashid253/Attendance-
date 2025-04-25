// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- STORAGE & HELPERS ---
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);

  // Load or initialize data
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

  // --- SETUP SECTION ---
  const schoolIn      = $('schoolNameInput');
  const classSel      = $('teacherClassSelect');
  const secSel        = $('teacherSectionSelect');
  const saveSetupBtn  = $('saveSetup');
  const setupForm     = $('setupForm');
  const setupDisplay  = $('setupDisplay');
  const setupText     = $('setupText');
  const editSetupBtn  = $('editSetup');

  async function loadSetup() {
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value   = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
      renderStudents(); // initial render after setup loaded
    }
  }

  saveSetupBtn.onclick = async e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) {
      return alert('Complete setup');
    }
    await set('schoolName', schoolIn.value);
    await set('teacherClass', classSel.value);
    await set('teacherSection', secSel.value);
    await loadSetup();
  };

  editSetupBtn.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };

  await loadSetup();

  // --- STUDENT REGISTRATION ---
  const studentNameIn   = $('studentName');
  const admissionNoIn   = $('admissionNo');
  const parentNameIn    = $('parentName');
  const parentContactIn = $('parentContact');
  const parentOccIn     = $('parentOccupation');
  const parentAddrIn    = $('parentAddress');
  const addStudentBtn   = $('addStudent');
  const studentsBody    = $('studentsBody');
  const selectAllCb     = $('selectAllStudents');
  const editSelBtn      = $('editSelected');
  const deleteSelBtn    = $('deleteSelected');
  const saveRegBtn      = $('saveRegistration');
  const shareRegBtn     = $('shareRegistration');
  const editRegBtn      = $('editRegistration');
  const downloadRegBtn  = $('downloadRegistrationPDF');
  let   regSaved = false, inlineEdit = false;

  function bindSelection() {
    const boxes = Array.from(studentsBody.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelBtn.disabled = deleteSelBtn.disabled = !any;
      };
    });
    selectAllCb.disabled = regSaved;
    selectAllCb.onchange = () => {
      if (!regSaved) boxes.forEach(cb => {
        cb.checked = selectAllCb.checked;
        cb.dispatchEvent(new Event('change'));
      });
    };
  }

  function renderStudents() {
    const list = filteredStudents();
    studentsBody.innerHTML = '';
    list.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved?'disabled':''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved?'<button class="share-one">Share</button>':''}</td>`;
      if (regSaved) {
        tr.querySelector('.share-one').onclick = ev => {
          ev.preventDefault();
          const hdr = `School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
          const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }

  addStudentBtn.onclick = async e => {
    e.preventDefault();
    const name    = studentNameIn.value.trim();
    const adm     = admissionNoIn.value.trim();
    const parent  = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occ     = parentOccIn.value.trim();
    const addr    = parentAddrIn.value.trim();
    if (!name||!adm||!parent||!contact||!occ||!addr) {
      return alert('All fields required');
    }
    if (!/^\d+$/.test(adm)) {
      return alert('Adm# must be numeric');
    }
    if (!/^\d{7,15}$/.test(contact)) {
      return alert('Contact must be 7–15 digits');
    }
    // prevent duplicates in same class & section
    if (students.some(s=>s.adm===adm && s.cls===classSel.value && s.sec===secSel.value)) {
      return alert('Duplicate Admission# in this class/section');
    }
    students.push({
      name, adm, parent, contact,
      occupation: occ, address: addr,
      roll: Date.now(),
      cls: classSel.value,
      sec: secSel.value
    });
    await saveStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn].forEach(i=>i.value='');
  };

  function onCellBlur(e) {
    const td = e.target, tr = td.closest('tr');
    const idx = +tr.querySelector('.sel').dataset.index;
    const keys = ['name','adm','parent','contact','occupation','address'];
    const ci  = Array.from(tr.children).indexOf(td);
    const val = td.textContent.trim();
    const list = filteredStudents();
    const stu = list[idx];
    if (ci===2 && !/^\d+$/.test(val)) { alert('Adm# must be numeric'); renderStudents(); return; }
    if (ci===2 && students.some(s=>s.adm===val && s.roll!==stu.roll)) { alert('Duplicate Adm#'); renderStudents(); return; }
    if (ci>=1 && ci<=6) {
      stu[keys[ci-1]] = val;
      students = students.map(s=>s.roll===stu.roll?stu:s);
      saveStudents();
    }
  }

  editSelBtn.onclick = e => {
    e.preventDefault();
    const sel = Array.from(document.querySelectorAll('.sel:checked'));
    if (!sel.length) return;
    inlineEdit = !inlineEdit;
    editSelBtn.textContent = inlineEdit ? 'Done Editing' : 'Edit Selected';
    sel.forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td,ci)=>{
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit
            ? td.addEventListener('blur', onCellBlur)
            : td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  deleteSelBtn.onclick = async e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    const rolls = Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb=>filteredStudents()[+cb.dataset.index].roll);
    students = students.filter(s=>!rolls.includes(s.roll));
    await saveStudents();
    renderStudents();
  };

  saveRegBtn.onclick = e => {
    e.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.remove('hidden'));
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  editRegBtn.onclick = e => {
    e.preventDefault();
    regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.add('hidden'));
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick = e => {
    e.preventDefault();
    const hdr = `School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines = filteredStudents().map(s=>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`, '_blank');
  };

  downloadRegBtn.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Student Registration', 10, 10);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 10, 20);
    doc.text(`School: ${schoolIn.value}`, 10, 26);
    doc.text(`Class: ${classSel.value}`, 10, 32);
    doc.text(`Section: ${secSel.value}`, 10, 38);
    doc.autoTable({
      head: [['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: filteredStudents().map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY: 44
    });
    doc.save('student_registration.pdf');
  };

  renderStudents();

  // --- ATTENDANCE MARKING ---
  const loadAttendanceBtn = loadAttBtn;
  loadAttendanceBtn.onclick = e => {
    e.preventDefault();
    const d = dateIn.value; if(!d) return alert('Pick a date');
    attendanceList.innerHTML = '';
    filteredStudents().forEach(s=>{
      const row=document.createElement('div'); row.className='attendance-item'; row.textContent=s.name;
      const actions=document.createElement('div'); actions.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button');
        b.type='button'; b.textContent=code; b.dataset.code=code;
        if(attendanceData[d]?.[s.roll]===code){ b.style.background=colors[code]; b.style.color='#fff'; }
        b.onclick=e2=>{ e2.preventDefault();
          actions.querySelectorAll('button').forEach(x=>{ x.style.background=''; x.style.color='#333'; });
          b.style.background=colors[code]; b.style.color='#fff';
        };
        actions.appendChild(b);
      });
      attendanceList.append(row, actions);
    });
    saveAttBtn.classList.remove('hidden');
  };

  saveAttBtn.onclick = async e => {
    e.preventDefault();
    const d = dateIn.value;
    attendanceData[d] = {};
    document.querySelectorAll('.attendance-actions').forEach((actions,i)=>{
      const sel=actions.querySelector('button[style*="background"]');
      attendanceData[d][filteredStudents()[i].roll] = sel?.dataset.code || 'A';
    });
    await saveAttendanceData();
    $('attendance-section').classList.add('hidden');
    attendanceResult.classList.remove('hidden');
    summaryBody.innerHTML = `<tr><td colspan="3"><em>Date: ${d}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}</em></td></tr>`;
    filteredStudents().forEach(s=>{
      const code=attendanceData[d][s.roll]||'A';
      const status={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick=e2=>{
        e2.preventDefault();
        window.open(`https://wa.me/?text=${encodeURIComponent(summaryBody.textContent + `\n\nName: ${s.name}\nStatus: ${status}`)}`, '_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  resetAttBtn.onclick = e => {
    e.preventDefault();
    attendanceResult.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    attendanceList.innerHTML = '';
    saveAttBtn.classList.add('hidden');
  };

  shareAttBtn.onclick = e => {
    e.preventDefault();
    const d = dateIn.value;
    const hdr = `Date: ${d}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines = filteredStudents().map(s=>{
      const code=attendanceData[d][s.roll]||'A';
      return `${s.name}: ${ {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code] }`;
    });
    const total = filteredStudents().length;
    const pres  = filteredStudents().reduce((sum,s)=>sum + (attendanceData[d][s.roll]==='P'?1:0),0);
    const pct   = total?((pres/total)*100).toFixed(1):'0.0';
    const summary = `${hdr}\n\n${lines.join('\n')}\n\nOverall Attendance: ${pct}%`;
    window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, '_blank');
  };

  downloadAttBtn.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Daily Attendance Report', 10, 10);
    doc.setFontSize(12);
    const dateStr = new Date(dateIn.value).toLocaleDateString();
    doc.text(`Date: ${dateStr}`, 10, 20);
    doc.text(`School: ${schoolIn.value}`, 10, 26);
    doc.text(`Class: ${classSel.value}`, 10, 32);
    doc.text(`Section: ${secSel.value}`, 10, 38);
    doc.autoTable({
      head:[['Name','Status']],
      body: filteredStudents().map(s=>{const code=attendanceData[dateIn.value][s.roll]||'A';
        return [s.name,{P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]];
      }),
      startY:44
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
