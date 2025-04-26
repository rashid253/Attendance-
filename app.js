// app.js
window.addEventListener('DOMContentLoaded', async () => {
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);

  // --- STORAGE INIT ---
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};

  const saveStudents = async () => await set('students', students);
  const saveAttendanceData = async () => await set('attendanceData', attendanceData);

  // --- ADM# GENERATOR ---
  const getLastAdmNo  = async () => (await get('lastAdmissionNo')) || 0;
  const setLastAdmNo  = async n => await set('lastAdmissionNo', n);
  const generateAdmNo = async () => {
    const last = await getLastAdmNo();
    const next = last + 1;
    await setLastAdmNo(next);
    return String(next).padStart(4, '0');
  };

  // --- CLASS/SECTION FILTERS ---
  const getCurrentClassSection = () => ({
    cls: $('teacherClassSelect').value,
    sec: $('teacherSectionSelect').value
  });
  const filteredStudents = () => {
    const { cls, sec } = getCurrentClassSection();
    return students.filter(s => s.cls === cls && s.sec === sec);
  };

  // --- ANIMATED COUNTERS ---
  const animateCounters = () => {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target / 100);
      const update = () => {
        count += step;
        if (count < target) {
          span.textContent = Math.ceil(count);
          requestAnimationFrame(update);
        } else {
          span.textContent = target;
        }
      };
      requestAnimationFrame(update);
    });
  };
  const updateTotals = () => {
    const totalSchool  = students.length;
    const totalClass   = students.filter(s => s.cls === getCurrentClassSection().cls).length;
    const totalSection = filteredStudents().length;
    [
      { id: 'sectionCount', val: totalSection },
      { id: 'classCount',   val: totalClass   },
      { id: 'schoolCount',  val: totalSchool  }
    ].forEach(o => {
      $(o.id).dataset.target = o.val;
    });
    animateCounters();
  };

  // --- DOM ELEMENTS ---
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

  const selectAnalyticsTarget    = $('analyticsTarget');
  const analyticsFilter          = $('analyticsFilter');
  const analyticsStudentSelect   = $('analyticsStudentSelect');
  const selectAnalyticsType      = $('analyticsType');
  const inputAnalyticsDate       = $('analyticsDate');
  const inputAnalyticsMonth      = $('analyticsMonth');
  const inputSemesterStart       = $('semesterStart');
  const inputSemesterEnd         = $('semesterEnd');
  const inputAnalyticsYear       = $('yearStart');
  const btnLoadAnalytics         = $('loadAnalytics');
  const btnResetAnalytics        = $('resetAnalytics');
  const divInstructions          = $('instructions');
  const divAnalyticsTable        = $('analyticsContainer');
  const divGraphs                = $('graphs');
  const btnShareAnalytics        = $('shareAnalytics');
  const btnDownloadAnalytics     = $('downloadAnalytics');
  let chartBar, chartPie;
  const ctxBar                   = $('barChart').getContext('2d');
  const ctxPie                   = $('pieChart').getContext('2d');

  const monthInput       = $('registerMonth');
  const btnLoadReg       = $('loadRegister');
  const btnChangeReg     = $('changeRegister');
  const divRegTable      = $('registerTableWrapper');
  const tbodyReg         = $('registerBody');
  const divRegSummary    = $('registerSummarySection');
  const tbodyRegSum      = $('registerSummaryBody');
  const btnShareReg2     = $('shareRegister');
  const btnDownloadReg2  = $('downloadRegisterPDF');
  const headerRegRowEl   = document.querySelector('#registerTable thead tr');

  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // --- STATE FLAGS ---
  let registrationSaved = false;
  let inlineEditing    = false;

  // --- ROW SELECTION & RENDERING ---
  const bindRowSelection = () => {
    const boxes = Array.from(tbodyStudents.querySelectorAll('.sel'));
    boxes.forEach(cb => cb.onchange = () => {
      cb.closest('tr').classList.toggle('selected', cb.checked);
      const any = boxes.some(x => x.checked);
      btnEditSel.disabled = btnDeleteSel.disabled = !any;
    });
    chkAllStudents.onchange = () => boxes.forEach(cb => { cb.checked = chkAllStudents.checked; cb.dispatchEvent(new Event('change')); });
  };

  const renderStudents = () => {
    const list = filteredStudents();
    tbodyStudents.innerHTML = '';
    list.forEach((st, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" data-index="${idx}" ${registrationSaved?'disabled':''}></td>
        <td>${idx+1}</td>
        <td>${st.name}</td><td>${st.adm}</td><td>${st.parent}</td>
        <td>${st.contact}</td><td>${st.occupation}</td><td>${st.address}</td>
        <td>${registrationSaved?'<button class="share-one">Share</button>':''}</td>
      `;
      if (registrationSaved) {
        tr.querySelector('.share-one').onclick = () => {
          const hdr = `*Attendance Report*\nSchool: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
          const msg = [hdr, `Name: ${st.name}`, `Adm#: ${st.adm}`, `Parent: ${st.parent}`, `Contact: ${st.contact}`, `Occupation: ${st.occupation}`, `Address: ${st.address}`].join('\n');
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      tbodyStudents.appendChild(tr);
    });
    bindRowSelection();
    updateTotals();
  };

  // --- SETUP ---
  const loadSetup = async () => {
    const school = await get('schoolName');
    const cls    = await get('teacherClass');
    const sec    = await get('teacherSection');
    if (school && cls && sec) {
      schoolInput.value = school;
      classSelect.value = cls;
      sectionSelect.value = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
      renderStudents();
    }
  };
  btnSaveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolInput.value || !classSelect.value || !sectionSelect.value) return alert('Complete setup');
    await set('schoolName', schoolInput.value);
    await set('teacherClass', classSelect.value);
    await set('teacherSection', sectionSelect.value);
    await loadSetup();
  };
  btnEditSetup.onclick = e => { e.preventDefault(); setupForm.classList.remove('hidden'); setupDisplay.classList.add('hidden'); };
  await loadSetup();

  // --- ADD STUDENT ---
  btnAddStudent.onclick = async e => {
    e.preventDefault();
    const name = nameInput.value.trim(), parent = parentInput.value.trim(), cont = contactInput.value.trim();
    const occ = occInput.value.trim(), addr = addrInput.value.trim();
    if (!name || !parent || !cont || !occ || !addr) return alert('All fields required');
    if (!/^\d{7,15}$/.test(cont)) return alert('Contact must be 7–15 digits');
    const adm = await generateAdmNo();
    students.push({ name, adm, parent, contact: cont, occupation: occ, address: addr, roll: Date.now(), cls: classSelect.value, sec: sectionSelect.value });
    await saveStudents(); renderStudents();
    [nameInput,parentInput,contactInput,occInput,addrInput].forEach(i=>i.value='');
  };

  // --- INLINE EDIT / DELETE / SAVE REGISTRATION ---
  const handleInlineBlur = e => { /* implementation as before */ };
  btnEditSel.onclick = e => { /* implementation as before */ };
  btnDeleteSel.onclick = async e => { /* implementation as before */ };
  btnSaveReg.onclick = e => { /* implementation as before */ };
  btnEditReg.onclick = e => { /* implementation as before */ };
  btnShareReg.onclick = e => { /* implementation as before */ };
  btnDownloadReg.onclick = e => { /* implementation as before */ };

  // --- ATTENDANCE MARKING & SUMMARY ---
  btnLoadAtt.onclick = e => { /* implementation as before */ };
  btnSaveAtt.onclick = async e => { /* implementation as before */ };
  btnResetAtt.onclick = () => { /* implementation as before */ };
  btnShareAtt.onclick = () => { /* implementation as before */ };
  btnDownloadAtt.onclick = () => { /* implementation as before */ };

  // --- ANALYTICS ---
  selectAnalyticsTarget.onchange = () => {
    const mode = selectAnalyticsTarget.value;
    analyticsFilter.classList.toggle('hidden', mode !== 'student');
    analyticsStudentSelect.classList.add('hidden');
  };
  analyticsFilter.onchange = () => {
    const mode = analyticsFilter.value;
    const sel = analyticsStudentSelect;
    sel.innerHTML = '<option disabled selected>--Select--</option>';
    const pool = students.filter(s => s.cls === classSelect.value && s.sec === sectionSelect.value);
    if (mode === 'adm') pool.forEach(s => sel.insertAdjacentHTML('beforeend', `<option value="${s.adm}">${s.adm}</option>`));
    else [...new Set(pool.map(s=>s.name))].forEach(n => sel.insertAdjacentHTML('beforeend', `<option>${n}</option>`));
    sel.classList.remove('hidden');
  };
  btnLoadAnalytics.onclick = e => {
    e.preventDefault();
    // determine targetList
    let targetList = [];
    const mode = selectAnalyticsTarget.value;
    if (mode === 'class') targetList = students.filter(s=>s.cls===classSelect.value);
    else if (mode==='section') targetList = filteredStudents();
    else {
      const field = analyticsFilter.value, val = analyticsStudentSelect.value;
      if (!field||!val) return alert('Select student field and value');
      targetList = students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value&&((field==='adm')?s.adm===val:s.name===val));
      if (field==='name'&&targetList.length>1) return alert('Multiple matches; choose Admission #.');
    }
    // period logic as before
    let from,to;
    // ...
    // compute stats on targetList
    const stats = targetList.map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      const cd=new Date(d), fD=new Date(from), tD=new Date(to);
      if(cd>=fD&&cd<=tD) stats.forEach(st=>{const code=recs[st.roll]||'A';st[code]++;st.total++;});
    });
    // render table & charts as before
  };
  btnShareAnalytics.onclick = e => { /* implementation as before */ };
  btnDownloadAnalytics.onclick = e => { /* implementation as before */ };

  // --- ATTENDANCE REGISTER ---
  const generateRegisterHeader = days => { /* implementation as before */ };
  btnLoadReg.onclick = e => { /* implementation as before */ };
  btnChangeReg.onclick = e => { /* implementation as before */ };
  btnShareReg2.onclick = e => { /* implementation as before */ };
  btnDownloadReg2.onclick = e => { /* implementation as before */ };

  // --- SERVICE WORKER ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
  }
});
