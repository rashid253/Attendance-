  // app.js
window.addEventListener('DOMContentLoaded', async () => {
  // idbKeyval is exposed globally via the <script type="module"> in index.html
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);
  const colors = { P: '#4CAF50', A: '#f44336', Lt: '#FFEB3B', HD: '#FF9800', L: '#03a9f4' };

  // 1. SETUP
  const schoolIn       = $('schoolNameInput');
  const classSel       = $('teacherClassSelect');
  const secSel         = $('teacherSectionSelect');
  const saveSetup      = $('saveSetup');
  const setupForm      = $('setupForm');
  const setupDisplay   = $('setupDisplay');
  const setupText      = $('setupText');
  const editSetup      = $('editSetup');

  async function loadSetup() {
    const school = await get('schoolName');
    const cls    = await get('teacherClass');
    const sec    = await get('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value   = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    await set('schoolName', schoolIn.value);
    await set('teacherClass', classSel.value);
    await set('teacherSection', secSel.value);
    await loadSetup();
  };

  editSetup.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };

  await loadSetup();

  // 2. STUDENT REGISTRATION
  let students = await get('students') || [];
  const studentNameIn    = $('studentName');
  const admissionNoIn    = $('admissionNo');
  const parentNameIn     = $('parentName');
  const parentContactIn  = $('parentContact');
  const parentOccIn      = $('parentOccupation');
  const parentAddrIn     = $('parentAddress');
  const addStudentBtn    = $('addStudent');
  const studentsBody     = $('studentsBody');
  const selectAll        = $('selectAllStudents');
  const editSelBtn       = $('editSelected');
  const deleteSelBtn     = $('deleteSelected');
  const saveRegBtn       = $('saveRegistration');
  const shareRegBtn      = $('shareRegistration');
  const editRegBtn       = $('editRegistration');
  const downloadRegBtn   = $('downloadRegistrationPDF');
  let regSaved = false, inlineEdit = false;

  async function saveStudents() {
    await set('students', students);
  }

  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved ? 'disabled' : ''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved ? '<button class="share-one">Share</button>' : ''}</td>`;
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

  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelBtn.disabled = deleteSelBtn.disabled = !any;
      };
    });
    selectAll.disabled = regSaved;
    selectAll.onchange = () => {
      if (!regSaved) boxes.forEach(cb => {
        cb.checked = selectAll.checked;
        cb.dispatchEvent(new Event('change'));
      });
    };
  }

  addStudentBtn.onclick = async ev => {
    ev.preventDefault();
    const name    = studentNameIn.value.trim();
    const adm     = admissionNoIn.value.trim();
    const parent  = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occ     = parentOccIn.value.trim();
    const addr    = parentAddrIn.value.trim();
    if (!name || !adm || !parent || !contact || !occ || !addr) return alert('All fields required');
    if (!/^\d+$/.test(adm)) return alert('Adm# must be numeric');
    if (students.some(s => s.adm === adm)) return alert(`Admission# ${adm} already exists`);
    if (!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits');
    students.push({ name, adm, parent, contact, occupation: occ, address: addr, roll: Date.now() });
    await saveStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn].forEach(i => i.value = '');
  };

  function onCellBlur(e) {
    const td = e.target, tr = td.closest('tr');
    const idx = +tr.querySelector('.sel').dataset.index;
    const ci  = Array.from(tr.children).indexOf(td);
    const keys = ['name','adm','parent','contact','occupation','address'];
    const val = td.textContent.trim();
    if (ci === 2) {
      if (!/^\d+$/.test(val)) { alert('Adm# must be numeric'); renderStudents(); return; }
      if (students.some((s,i2) => s.adm===val && i2!==idx)) {
        alert('Duplicate Adm# not allowed'); renderStudents(); return;
      }
    }
    if (ci>=1 && ci<=6) {
      students[idx][keys[ci-1]] = val;
      saveStudents();
    }
  }

  editSelBtn.onclick = ev => {
    ev.preventDefault();
    const sel = Array.from(document.querySelectorAll('.sel:checked'));
    if (!sel.length) return;
    inlineEdit = !inlineEdit;
    editSelBtn.textContent = inlineEdit ? 'Done Editing' : 'Edit Selected';
    sel.forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td,ci) => {
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit ? td.addEventListener('blur', onCellBlur) : td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  deleteSelBtn.onclick = async ev => {
    ev.preventDefault();
    if (!confirm('Delete selected?')) return;
    Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb => +cb.dataset.index)
      .sort((a,b)=>b-a)
      .forEach(i=>students.splice(i,1));
    await saveStudents();
    renderStudents();
    selectAll.checked = false;
  };

  saveRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegBtn.classList.remove('hidden');
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
    downloadRegBtn.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick = ev => {
    ev.preventDefault();
    const hdr = `School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines = students.map(s =>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines)}`, '_blank');
  };

  downloadRegBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Student Registration', 10, 10);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`,10,20);
    doc.text(`School: ${schoolIn.value}`,10,26);
    doc.text(`Class: ${classSel.value}`,10,32);
    doc.text(`Section: ${secSel.value}`,10,38);
    doc.autoTable({
      head:[['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY:44
    });
    doc.save('student_registration.pdf');
  };

  renderStudents();

  // 3. ATTENDANCE MARKING
  let attendance = await get('attendanceData') || {};
  const dateInput          = $('dateInput');
  const loadAtt            = $('loadAttendance');
  const attList            = $('attendanceList');
  const saveAtt            = $('saveAttendance');
  const resultSection      = $('attendance-result');
  const summaryBody        = $('summaryBody');
  const resetAtt           = $('resetAttendance');
  const shareAtt           = $('shareAttendanceSummary');
  const downloadAttPDF     = $('downloadAttendancePDF');

  loadAtt.onclick = ev => {
    ev.preventDefault();
    if (!dateInput.value) return alert('Pick a date');
    attList.innerHTML = '';
    students.forEach(s => {
      const row = document.createElement('div');
      row.className = 'attendance-item';
      row.textContent = s.name;
      const btns = document.createElement('div');
      btns.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'att-btn'; b.dataset.code = code; b.textContent = code;
        if (attendance[dateInput.value]?.[s.roll] === code) {
          b.style.background = colors[code]; b.style.color = '#fff';
        }
        b.onclick = () => {
          btns.querySelectorAll('.att-btn').forEach(x => { x.style.background=''; x.style.color='#333'; });
          b.style.background = colors[code]; b.style.color = '#fff';
        };
        btns.appendChild(b);
      });
      attList.append(row, btns);
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick = async ev => {
    ev.preventDefault();
    const d = dateInput.value;
    attendance[d] = {};
    attList.querySelectorAll('.attendance-actions').forEach((btns,i) => {
      const sel = btns.querySelector('.att-btn[style*="background"]');
      attendance[d][students[i].roll] = sel ? sel.dataset.code : 'A';
    });
    await set('attendanceData', attendance);
    $('attendance-section').classList.add('hidden');
    resultSection.classList.remove('hidden');
    summaryBody.innerHTML = '';
    const hdr = `Date: ${d}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    summaryBody.insertAdjacentHTML('beforebegin', `<tr><td colspan="3"><em>${hdr}</em></td></tr>`);
    students.forEach(s => {
      const code = attendance[d][s.roll] || 'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick = () => {
        const msg = `${hdr}\n\nName: ${s.name}\nStatus: ${status}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  resetAtt.onclick = () => {
    resultSection.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    attList.innerHTML = '';
    saveAtt.classList.add('hidden');
    summaryBody.innerHTML = '';
  };

  shareAtt.onclick = () => {
    const d = dateInput.value;
    const hdr = `Date: ${d}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines = students.map(s => {
      const code = attendance[d][s.roll]||'A';
      return `${s.name}: ${ {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code] }`;
    });
    const total = students.length;
    const pres = students.reduce((sum,s) => sum + (attendance[d][s.roll]==='P'?1:0), 0);
    const pct = total ? ((pres/total)*100).toFixed(1) : '0.0';
    const remark = pct==100?'Best':pct>=75?'Good':pct>=50?'Fair':'Poor';
    window.open(`https://wa.me/?text=${encodeURIComponent([hdr,'',...lines,'',`Overall Attendance: ${pct}% | ${remark}`].join('\n'))}`, '_blank');
  };

  downloadAttPDF.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Daily Attendance Report',10,10);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date(dateInput.value).toLocaleDateString()}`,10,20);
    doc.text(`School: ${schoolIn.value}`,10,26);
    doc.text(`Class: ${classSel.value}`,10,32);
    doc.text(`Section: ${secSel.value}`,10,38);
    doc.autoTable({
      head:[['Name','Status']],
      body: students.map(s => {
        const code = attendance[dateInput.value]?.[s.roll]||'A';
        const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
        return [s.name, status];
      }),
      startY:44
    });
    doc.save('attendance_summary.pdf');
  };

  // 4. ANALYTICS (unchanged)
  // 5. REGISTER (unchanged)
});
  // ─── ANALYTICS SECTION ────────────────────────────────────────────────────────
  const analyticsTarget      = $('analyticsTarget');
  const studentAdmInput      = $('studentAdmInput');
  const analyticsType        = $('analyticsType');
  const analyticsDate        = $('analyticsDate');
  const analyticsMonth       = $('analyticsMonth');
  const semesterStartInput   = $('semesterStart');
  const semesterEndInput     = $('semesterEnd');
  const yearStart            = $('yearStart');
  const loadAnalyticsBtn     = $('loadAnalytics');
  const resetAnalyticsBtn    = $('resetAnalytics');
  const instructionsEl       = $('instructions');
  const analyticsContainer   = $('analyticsContainer');
  const graphsEl             = $('graphs');
  const shareAnalyticsBtn    = $('shareAnalytics');
  const downloadAnalyticsBtn = $('downloadAnalytics');

  function hideAllAnalytics() {
    [analyticsDate, analyticsMonth, semesterStartInput,
     semesterEndInput, yearStart, instructionsEl,
     analyticsContainer, graphsEl, resetAnalyticsBtn]
    .forEach(el => el.classList.add('hidden'));
  }

  analyticsTarget.onchange = () => {
    studentAdmInput.classList.toggle('hidden', analyticsTarget.value!=='student');
    hideAllAnalytics();
    analyticsType.value = '';
  };

  analyticsType.onchange = () => {
    hideAllAnalytics();
    if (analyticsType.value==='date') analyticsDate.classList.remove('hidden');
    if (analyticsType.value==='month') analyticsMonth.classList.remove('hidden');
    if (analyticsType.value==='semester') {
      semesterStartInput.classList.remove('hidden');
      semesterEndInput.classList.remove('hidden');
    }
    if (analyticsType.value==='year') yearStart.classList.remove('hidden');
    resetAnalyticsBtn.classList.remove('hidden');
  };

  resetAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    hideAllAnalytics();
    analyticsType.value = '';
  };

  loadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    let from, to;
    if (analyticsType.value==='date') {
      if (!analyticsDate.value) return alert('Pick a date');
      from = to = analyticsDate.value;
    } else if (analyticsType.value==='month') {
      if (!analyticsMonth.value) return alert('Pick a month');
      const [y,m] = analyticsMonth.value.split('-').map(Number);
      from = `${analyticsMonth.value}-01`;
      to   = `${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (analyticsType.value==='semester') {
      if (!semesterStartInput.value||!semesterEndInput.value) return alert('Pick range');
      from = `${semesterStartInput.value}-01`;
      const [ey,em] = semesterEndInput.value.split('-').map(Number);
      to   = `${semesterEndInput.value}-${new Date(ey,em,0).getDate()}`;
    } else if (analyticsType.value==='year') {
      if (!yearStart.value) return alert('Pick year');
      from = `${yearStart.value}-01-01`;
      to   = `${yearStart.value}-12-31`;
    } else return alert('Select period');

    // compute stats
    const subset = analyticsTarget.value==='student'
      ? students.filter(s=>s.adm===studentAdmInput.value.trim())
      : students;
    const stats = subset.map(s=>({ name:s.name, roll:s.roll, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    const fromD=new Date(from), toD=new Date(to);
    Object.entries(attendanceData).forEach(([d,recs])=>{
      const cd=new Date(d);
      if (cd>=fromD && cd<=toD) stats.forEach(st=>{
        const code=recs[st.roll]||'A';
        st[code]++; st.total++;
      });
    });

    // render table
    let html='<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s=>{
      const pct=s.total?((s.P/s.total)*100).toFixed(1):'0.0';
      html+=`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
    });
    html+='</tbody></table>';
    analyticsContainer.innerHTML=html;
    analyticsContainer.classList.remove('hidden');

    instructionsEl.textContent = analyticsTarget.value==='student'
      ? `Admission#: ${studentAdmInput.value.trim()} | ${from} to ${to}`
      : `Report: ${from} to ${to}`;
    instructionsEl.classList.remove('hidden');

    // initialize canvas contexts here to avoid null
    const barEl = $('barChart'), pieEl = $('pieChart');
    if (barEl && pieEl) {
      barCtx = barEl.getContext('2d');
      pieCtx = pieEl.getContext('2d');
    }

    // draw bar chart
    const labels = stats.map(s=>s.name);
    const dataPct = stats.map(s=> s.total?(s.P/s.total)*100:0 );
    if (barCtx) {
      if (window.barChart) window.barChart.destroy();
      window.barChart = new Chart(barCtx,{ type:'bar', data:{ labels, datasets:[{ label:'% Present', data:dataPct }]}, options:{ responsive:true, scales:{ y:{ beginAtZero:true, max:100 }}}});
    }

    // draw pie chart
    const agg = stats.reduce((a,s)=>{ ['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]); return a; },{P:0,A:0,Lt:0,HD:0,L:0});
    if (pieCtx) {
      if (window.pieChart) window.pieChart.destroy();
      window.pieChart = new Chart(pieCtx,{ type:'pie', data:{ labels:['Present','Absent','Late','Half Day','Leave'], datasets:[{ data:Object.values(agg) }]}, options:{ responsive:true }});
    }

    graphsEl.classList.remove('hidden');
  };

  shareAnalyticsBtn.onclick = () => {
    const period = instructionsEl.textContent.split('|')[1].trim();
    const hdr = `Period: ${period} | ${setupText.textContent}`;
    const rows = Array.from(analyticsContainer.querySelectorAll('tbody tr')).map(r=>{
      const tds = r.querySelectorAll('td');
      return `${tds[0].textContent} P:${tds[1].textContent} A:${tds[2].textContent} Lt:${tds[3].textContent} HD:${tds[4].textContent} L:${tds[5].textContent} Total:${tds[6].textContent} %:${tds[7].textContent}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+rows.join('\n'))}`, '_blank');
  };

  downloadAnalyticsBtn.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Attendance Analytics',10,10);
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`,10,20);
    const period = instructionsEl.textContent.split('|')[1].trim();
    doc.text(`Period: ${period}`,10,26);
    doc.text(setupText.textContent,10,32);
    doc.autoTable({
      head:[['Name','P','A','Lt','HD','L','Total','%']],
      body:Array.from(analyticsContainer.querySelectorAll('tbody tr')).map(r=>
        Array.from(r.querySelectorAll('td')).map(td=>td.textContent)
      ),
      startY:40
    });
    doc.save('attendance_analytics.pdf');
  };

  // ─── ATTENDANCE REGISTER ─────────────────────────────────────────────────────
  const registerMonthIn     = $('registerMonth');
  const loadRegisterBtn     = $('loadRegister');
  const changeRegisterBtn   = $('changeRegister');
  const registerTableWrapper= $('registerTableWrapper');
  const registerBody        = $('registerBody');
  const registerSummaryBody = $('registerSummaryBody');

  function generateRegisterHeader(days) {
    const headerRow = document.querySelector('#registerTable thead tr');
    headerRow.innerHTML = `<th>Sr#</th><th>Adm#</th><th>Name</th>`;
    for (let d=1; d<=days; d++){
      const th = document.createElement('th');
      th.textContent = d;
      headerRow.appendChild(th);
    }
  }

  loadRegisterBtn.onclick = () => {
    if (!registerMonthIn.value) return alert('Select month');
    const [y,m] = registerMonthIn.value.split('-').map(Number);
    const daysInMonth = new Date(y,m,0).getDate();
    generateRegisterHeader(daysInMonth);
    registerBody.innerHTML = '';
    registerSummaryBody.innerHTML = '';

    students.forEach((s,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1; d<=daysInMonth; d++){
        const dateStr = `${registerMonthIn.value}-${String(d).padStart(2,'0')}`;
        const code = attendanceData[dateStr]?.[s.roll] || 'A';
        const td = document.createElement('td');
        td.textContent = code;
        td.style.background = colors[code];
        td.style.color = '#fff';
        tr.appendChild(td);
      }
      registerBody.appendChild(tr);
    });

    students.forEach(s=>{
      const st={P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for (let d=1; d<=daysInMonth; d++){
        const dateStr = `${registerMonthIn.value}-${String(d).padStart(2,'0')}`;
        const code = attendanceData[dateStr]?.[s.roll] || 'A';
        st[code]++; st.total++;
      }
      const pct = st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${pct}</td>`;
      registerSummaryBody.appendChild(tr);
    });

    registerTableWrapper.classList.remove('hidden');
    registerSection.classList.remove('hidden');
    loadRegisterBtn.classList.add('hidden');
    changeRegisterBtn.classList.remove('hidden');
  };

  changeRegisterBtn.onclick = () => {
    registerTableWrapper.classList.add('hidden');
    registerSection.classList.add('hidden');
    loadRegisterBtn.classList.remove('hidden');
    changeRegisterBtn.classList.add('hidden');
  };

  $('shareRegister').onclick = () => {
    const hdr = `Register for ${registerMonthIn.value} | ${setupText.textContent}`;
    const lines = Array.from(registerSummaryBody.querySelectorAll('tr')).map(r=>{
      const tds = r.querySelectorAll('td');
      return `${tds[0].textContent}: P:${tds[1].textContent}, A:${tds[2].textContent}, Lt:${tds[3].textContent}, HD:${tds[4].textContent}, L:${tds[5].textContent}, %:${tds[6].textContent}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines.join('\n'))}`, '_blank');
  };

  $('downloadRegisterPDF').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    doc.setFontSize(16); doc.text('Monthly Attendance Register',10,10);
    doc.setFontSize(12); doc.text(setupText.textContent,10,20);
    doc.autoTable({
      html: '#registerTable',
      startY:30,
      styles:{ fontSize:6 },
      columnStyles:{0:{cellWidth:10},1:{cellWidth:15},2:{cellWidth:30}}
    });
    doc.save('attendance_register.pdf');
  };

  // ─── SERVICE WORKER ───────────────────────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(r=>console.log('SW registered',r.scope))
      .catch(e=>console.error('SW failed',e));
  }

  // ─── Initialization ─────────────────────────────────────────────────────────
  await loadClasses();
  if (!classes.length) {
    classSelect.value = '__new';
    enterNewSetup();
  } else {
    classSelect.value = classes[0];
    currentKey = classes[0];
    await loadClassData();
  }
});
