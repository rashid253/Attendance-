// app.js
import * as idbKeyvalModule from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';
const { get, set } = idbKeyvalModule;
window.idbKeyval = idbKeyvalModule;

window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  // — STORAGE (idb-keyval) —
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};

  const saveStudents       = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);

  // — ADM# GENERATOR —
  const getLastAdmNo  = async () => (await get('lastAdmissionNo')) || 0;
  const setLastAdmNo  = n => set('lastAdmissionNo', n);
  const generateAdmNo = async () => {
    const last = await getLastAdmNo();
    const next = last + 1;
    setLastAdmNo(next);
    return String(next).padStart(4, '0');
  };

  // — ELEMENT REFS —
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

  const selectAnalyticsTarget = $('analyticsTarget');
  const analyticsFilter       = $('analyticsFilter');
  const analyticsStudentInput = $('analyticsStudentInput');
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
  let chartBar, chartPie;
  const ctxBar = $('barChart').getContext('2d');
  const ctxPie = $('pieChart').getContext('2d');

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

  // — HELPERS —
  const filteredStudents = () =>
    students.filter(s => s.cls===classSelect.value && s.sec===sectionSelect.value);

  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target/100);
      function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
    });
  }

  function updateTotals() {
    const totalSchool  = students.length;
    const totalClass   = students.filter(s=>s.cls===classSelect.value).length;
    const totalSection = filteredStudents().length;
    [['sectionCount', totalSection], ['classCount', totalClass], ['schoolCount', totalSchool]]
      .forEach(([id,val]) => $(id).dataset.target = val);
    animateCounters();
  }

  function bindRowSelection() {
    const boxes = Array.from(tbodyStudents.querySelectorAll('.sel'));
    boxes.forEach(cb => cb.onchange = () => {
      cb.closest('tr').classList.toggle('selected', cb.checked);
      const any = boxes.some(x=>x.checked);
      btnEditSel.disabled = btnDeleteSel.disabled = !any;
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
          const msg = `Name: ${st.name}\nAdm#: ${st.adm}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
        };
      }
      tbodyStudents.appendChild(tr);
    });
    bindRowSelection();
    updateTotals();
  }

  // — SETUP —
  async function loadSetup(){
    const school=await get('schoolName'),
          cls   =await get('teacherClass'),
          sec   =await get('teacherSection');
    if (school && cls && sec) {
      schoolInput.value=school;
      classSelect.value=cls;
      sectionSelect.value=sec;
      setupText.textContent = `${school} | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
      renderStudents();
    }
  }
  btnSaveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolInput.value||!classSelect.value||!sectionSelect.value)
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

  // — ADD STUDENT —
  btnAddStudent.onclick = async e => {
    e.preventDefault();
    const name   = nameInput.value.trim(),
          parent = parentInput.value.trim(),
          cont   = contactInput.value.trim(),
          occ    = occInput.value.trim(),
          addr   = addrInput.value.trim();
    if (!name||!parent||!cont||!occ||!addr) return alert('All fields required');
    if (!/^\d{7,15}$/.test(cont))      return alert('Contact must be 7–15 digits');
    const adm = await generateAdmNo();
    students.push({ name, adm, parent, contact:cont, occupation:occ, address:addr,
                    roll:Date.now(), cls:classSelect.value, sec:sectionSelect.value });
    await saveStudents();
    renderStudents();
    [nameInput,parentInput,contactInput,occInput,addrInput].forEach(i=>i.value='');
  };

  // — SAVE / EDIT REGISTRATION —
  btnSaveReg.onclick = e => {
    e.preventDefault();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id=>$(id).classList.remove('hidden'));
    renderStudents();
  };
  btnEditReg.onclick = e => {
    e.preventDefault();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id=>$(id).classList.add('hidden'));
    renderStudents();
  };
  btnShareReg.onclick = () => {
    const hdr=`*Attendance Report* School:${schoolInput.value} Class:${classSelect.value} Sec:${sectionSelect.value}`;
    const lines = filteredStudents().map(s=>`Name:${s.name} Adm#:${s.adm}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`);
  };

  // — ATTENDANCE MARKING —
  btnLoadAtt.onclick = e => {
    e.preventDefault();
    if (!dateInput.value) return alert('Pick a date');
    divAttList.innerHTML='';
    filteredStudents().forEach(s => {
      const row=document.createElement('div'), actions=document.createElement('div');
      row.textContent=s.name;
      actions.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button');
        b.textContent=code; b.dataset.code=code;
        b.onclick=()=>{
          actions.querySelectorAll('button').forEach(x=>{x.style='';});
          b.style.background=colors[code]; b.style.color='#fff';
        };
        actions.appendChild(b);
      });
      divAttList.append(row,actions);
    });
    btnSaveAtt.classList.remove('hidden');
  };
  btnSaveAtt.onclick = async () => {
    const d = dateInput.value; attendanceData[d]={};
    document.querySelectorAll('.attendance-actions').forEach((actions,i)=>{
      const btn=actions.querySelector('button[style]'),
            code=btn?btn.dataset.code:'A';
      attendanceData[d][filteredStudents()[i].roll]=code;
    });
    await saveAttendanceData();
    $('attendance-section').classList.add('hidden');
    sectionResult.classList.remove('hidden');
    tbodySummary.innerHTML='';
    filteredStudents().forEach(s=>{
      const code=attendanceData[d][s.roll]||'A';
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${code}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(`${s.name}: ${code}`)}`);
      tbodySummary.appendChild(tr);
    });
  };
  btnResetAtt.onclick = () => {
    sectionResult.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    divAttList.innerHTML=''; btnSaveAtt.classList.add('hidden');
  };

  // — ANALYTICS REWORK —
  analyticsFilter.disabled       = true;
  analyticsStudentInput.disabled = true;
  selectAnalyticsType.disabled   = true;
  [inputAnalyticsDate, inputAnalyticsMonth, inputSemesterStart, inputSemesterEnd, inputAnalyticsYear]
    .forEach(i => i.classList.add('hidden'));
  btnResetAnalytics.classList.add('hidden');

  selectAnalyticsTarget.addEventListener('change', () => {
    if (selectAnalyticsTarget.value==='section' || selectAnalyticsTarget.value==='class') {
      analyticsFilter.classList.add('hidden');
      analyticsFilter.disabled = true;
      analyticsStudentInput.classList.add('hidden');
      selectAnalyticsType.disabled = false;
    }
    if (selectAnalyticsTarget.value==='student') {
      analyticsFilter.classList.remove('hidden');
      analyticsFilter.disabled = false;
      analyticsStudentInput.classList.add('hidden');
      selectAnalyticsType.disabled = true;
    }
  });

  analyticsFilter.addEventListener('change', () => {
    analyticsStudentInput.innerHTML = '<option value="" disabled selected>--Select student--</option>';
    filteredStudents().forEach(s => {
      const opt = document.createElement('option');
      opt.value = analyticsFilter.value==='adm'?s.adm:s.name;
      opt.textContent = opt.value;
      analyticsStudentInput.appendChild(opt);
    });
    analyticsStudentInput.classList.remove('hidden');
    analyticsStudentInput.disabled = false;
  });

  analyticsStudentInput.addEventListener('change', () => {
    selectAnalyticsType.disabled = false;
  });

  selectAnalyticsType.addEventListener('change', () => {
    [inputAnalyticsDate, inputAnalyticsMonth, inputSemesterStart, inputSemesterEnd, inputAnalyticsYear]
      .forEach(i => i.classList.add('hidden'));
    btnResetAnalytics.classList.remove('hidden');
    switch (selectAnalyticsType.value) {
      case 'date':     inputAnalyticsDate.classList.remove('hidden'); break;
      case 'month':    inputAnalyticsMonth.classList.remove('hidden'); break;
      case 'semester': inputSemesterStart.classList.remove('hidden'); inputSemesterEnd.classList.remove('hidden'); break;
      case 'year':     inputAnalyticsYear.classList.remove('hidden'); break;
    }
  });

  btnLoadAnalytics.addEventListener('click', e => {
    e.preventDefault();
    let from,to; const t=selectAnalyticsType.value;
    if (t==='date')      { if (!inputAnalyticsDate.value) return alert('Pick date'); from=to=inputAnalyticsDate.value; }
    else if (t==='month') { if (!inputAnalyticsMonth.value) return alert('Pick month'); const [y,m]=inputAnalyticsMonth.value.split('-').map(Number); from=`${inputAnalyticsMonth.value}-01`; to=`${inputAnalyticsMonth.value}-${new Date(y,m,0).getDate()}`; }
    else if (t==='semester'){ if (!inputSemesterStart.value||!inputSemesterEnd.value) return alert('Pick range'); const [sy,sm]=inputSemesterStart.value.split('-').map(Number); const [ey,em]=inputSemesterEnd.value.split('-').map(Number); from=`${inputSemesterStart.value}-01`; to=`${inputSemesterEnd.value}-${new Date(ey,em,0).getDate()}`; }
    else if (t==='year') { if (!inputAnalyticsYear.value) return alert('Pick year'); from=`${inputAnalyticsYear.value}-01-01`; to=`${inputAnalyticsYear.value}-12-31`; }
    else return alert('Select period');

    let pool = [];
    if (selectAnalyticsTarget.value==='class')   pool = students.filter(s=>s.cls===classSelect.value);
    if (selectAnalyticsTarget.value==='section') pool = filteredStudents();
    if (selectAnalyticsTarget.value==='student') {
      const v = analyticsStudentInput.value;
      pool = students.filter(s=>
        (analyticsFilter.value==='adm'?s.adm===v:s.name===v)
         && s.cls===classSelect.value && s.sec===sectionSelect.value
      );
    }

    const stats = pool.map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      if (d>=from && d<=to) stats.forEach(st=>{ const c=recs[st.roll]||'A'; st[c]++; st.total++; });
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
    chartBar = new Chart(ctxBar, { type:'bar', data:{ labels, datasets:[{ label:'% Present', data:dataPct }] }, options:{ scales:{ y:{ beginAtZero:true,max:100 } } } });
    const agg = stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]); return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    chartPie?.destroy();
    chartPie = new Chart(ctxPie, { type:'pie', data:{ labels:['P','A','Lt','HD','L'], datasets:[{ data:Object.values(agg) }] } });

    divGraphs.classList.remove('hidden');
    btnShareAnalytics.classList.remove('hidden');
    btnDownloadAnalytics.classList.remove('hidden');
  });

  // — REGISTER —
  function genHeader(days) {
    headerRegRowEl.innerHTML = '<th>Sr#</th><th>Adm#</th><th>Name</th>' +
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
  }
  btnLoadReg.onclick = e => {
    e.preventDefault();
    if (!monthInput.value) return alert('Select month');
    const [y,m] = monthInput.value.split('-').map(Number);
    const days = new Date(y,m,0).getDate();
    genHeader(days);
    tbodyReg.innerHTML = '';
    tbodyRegSum.innerHTML = '';
    filteredStudents().forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
        Array.from({length:days},(_,d)=>{ const code=(attendanceData[`${monthInput.value}-${String(d+1).padStart(2,'0')}`]||{})[s.roll]||'A'; return `<td style="background:${colors[code]};color:#fff">${code}</td>`; }).join('');
      tbodyReg.appendChild(tr);
    });
    filteredStudents().forEach(s=>{
      let stat={P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for(let d=1;d<=days;d++){ const code=(attendanceData[`${monthInput.value}-${String(d).padStart(2,'0')}`]||{})[s.roll]||'A'; stat[code]++; stat.total++; }
      const pct=stat.total?((stat.P/stat.total)*100).toFixed(1):'0.0';
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${stat.P}</td><td>${stat.A}</td><td>${stat.Lt}</td><td>${stat.HD}</td><td>${stat.L}</td><td>${pct}</td>`;
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
