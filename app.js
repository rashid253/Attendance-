// app.js
window.addEventListener('DOMContentLoaded', async () => {
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);

  // --- Storage ---
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};

  const saveStudents       = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);

  // --- Admission # generator ---
  const getLastAdmNo = async () => (await get('lastAdmissionNo')) || 0;
  const setLastAdmNo = n => set('lastAdmissionNo', n);
  const generateAdmNo = async () => {
    const last = await getLastAdmNo(), next = last + 1;
    setLastAdmNo(next);
    return String(next).padStart(4,'0');
  };

  // --- Filters ---
  const getCurrentClassSection = () => ({
    cls: $('teacherClassSelect').value,
    sec: $('teacherSectionSelect').value
  });
  const filteredStudents = () => {
    const {cls,sec} = getCurrentClassSection();
    return students.filter(s => s.cls===cls && s.sec===sec);
  };

  // --- Counters ---
  const animateCounters = () => {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target/100);
      function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if(count < target) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
    });
  };
  const updateTotals = () => {
    const totalSchool  = students.length;
    const totalClass   = students.filter(s=>s.cls===getCurrentClassSection().cls).length;
    const totalSection = filteredStudents().length;
    [
      ['sectionCount', totalSection],
      ['classCount',   totalClass],
      ['schoolCount',  totalSchool]
    ].forEach(([id,val]) => $(id).dataset.target = val);
    animateCounters();
  };

  // --- Elements ---
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
  const analyticsFilter        = $('analyticsFilter');
  const analyticsStudentInput  = $('analyticsStudentInput');
  const studentDatalist        = $('studentDatalist');
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

  // --- Utility: bind and render students ---
  function bindRowSelection() {
    const boxes = tbodyStudents.querySelectorAll('.sel');
    boxes.forEach(cb => cb.onchange = () => {
      cb.closest('tr').classList.toggle('selected', cb.checked);
      const any = Array.from(boxes).some(x=>x.checked);
      btnEditSel.disabled = btnDeleteSel.disabled = !any;
    });
    chkAllStudents.onchange = () => boxes.forEach(cb => {
      cb.checked = chkAllStudents.checked;
      cb.dispatchEvent(new Event('change'));
    });
  }
  function renderStudents() {
    const list = filteredStudents();
    tbodyStudents.innerHTML = '';
    list.forEach((st,idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" data-index="${idx}" ${btnSaveReg.classList.contains('hidden')?'':'disabled'}></td>
        <td>${idx+1}</td><td>${st.name}</td><td>${st.adm}</td><td>${st.parent}</td>
        <td>${st.contact}</td><td>${st.occupation}</td><td>${st.address}</td>
        <td>${btnSaveReg.classList.contains('hidden')?'<button class="share-one">Share</button>':''}</td>
      `;
      if(btnSaveReg.classList.contains('hidden')){
        tr.querySelector('.share-one').onclick = () => {
          const hdr = `*Attendance Report*\\nSchool: ${schoolInput.value}\\nClass: ${classSelect.value}\\nSection: ${sectionSelect.value}`;
          const msg = [hdr,
            `Name: ${st.name}`, `Adm#: ${st.adm}`, `Parent: ${st.parent}`,
            `Contact: ${st.contact}`, `Occupation: ${st.occupation}`, `Address: ${st.address}`
          ].join('\\n');
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
        };
      }
      tbodyStudents.appendChild(tr);
    });
    bindRowSelection();
    updateTotals();
  }

  // --- Setup ---
  async function loadSetup(){
    const school=await get('schoolName'), cls=await get('teacherClass'), sec=await get('teacherSection');
    if(school&&cls&&sec){
      schoolInput.value=school; classSelect.value=cls; sectionSelect.value=sec;
      setupText.textContent=`${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden'); setupDisplay.classList.remove('hidden');
      renderStudents();
    }
  }
  btnSaveSetup.onclick = async e => {
    e.preventDefault();
    if(!schoolInput.value||!classSelect.value||!sectionSelect.value) return alert('Complete setup');
    await set('schoolName',schoolInput.value);
    await set('teacherClass',classSelect.value);
    await set('teacherSection',sectionSelect.value);
    await loadSetup();
  };
  btnEditSetup.onclick = e => { e.preventDefault(); setupForm.classList.remove('hidden'); setupDisplay.classList.add('hidden'); };
  await loadSetup();

  // --- Add Student ---
  btnAddStudent.onclick = async e=>{
    e.preventDefault();
    const name=nameInput.value.trim(), parent=parentInput.value.trim(),
          cont=contactInput.value.trim(), occ=occInput.value.trim(), addr=addrInput.value.trim();
    if(!name||!parent||!cont||!occ||!addr) return alert('All fields required');
    if(!/^\d{7,15}$/.test(cont)) return alert('Contact must be 7–15 digits');
    const adm=await generateAdmNo();
    students.push({name,adm,parent,contact:cont,occupation:occ,address:addr,roll:Date.now(),cls:classSelect.value,sec:sectionSelect.value});
    await saveStudents(); renderStudents();
    [nameInput,parentInput,contactInput,occInput,addrInput].forEach(i=>i.value='');
  };

  // --- Inline Edit/Delete/Save Registration ---
  btnEditSel.onclick = e=>{ /* same as before */ };
  btnDeleteSel.onclick=async e=>{ /* same as before */ };
  btnSaveReg.onclick=e=>{ /* same as before */ };
  btnEditReg.onclick=e=>{ /* same as before */ };
  btnShareReg.onclick=e=>{ /* same as before */ };
  btnDownloadReg.onclick=e=>{ /* same as before */ };

  // --- Attendance Marking & Summary ---
  btnLoadAtt.onclick = e=>{ /* same as before */ };
  btnSaveAtt.onclick = async e=>{ /* same as before */ };
  btnResetAtt.onclick = ()=>{ /* same as before */ };
  btnShareAtt.onclick = ()=>{ /* same as before */ };
  btnDownloadAtt.onclick = ()=>{ /* same as before */ };

  // --- Analytics ---
  selectAnalyticsTarget.onchange = ()=>{
    const mode = selectAnalyticsTarget.value;
    analyticsFilter.classList.toggle('hidden',mode!=='student');
    $('labelFilter').classList.toggle('hidden',mode!=='student');
    analyticsStudentInput.classList.add('hidden');
  };
  analyticsFilter.onchange = ()=>{
    const field=analyticsFilter.value;
    const datalist = studentDatalist;
    datalist.innerHTML='';
    const pool=students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value);
    if(field==='adm'){
      pool.forEach(s=>datalist.insertAdjacentHTML('beforeend',`<option value="${s.adm}">`));
    } else {
      const names=[...new Set(pool.map(s=>s.name))];
      names.forEach(n=>datalist.insertAdjacentHTML('beforeend',`<option value="${n}">`));
    }
    analyticsStudentInput.value='';
    analyticsStudentInput.classList.remove('hidden');
  };
  btnLoadAnalytics.onclick=e=>{
    e.preventDefault();
    let targetList=[];
    const mode=selectAnalyticsTarget.value;
    if(mode==='class') targetList=students.filter(s=>s.cls===classSelect.value);
    else if(mode==='section') targetList=filteredStudents();
    else {
      const field=analyticsFilter.value, val=analyticsStudentInput.value.trim();
      if(!field||!val) return alert('Select field and value');
      targetList=students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value&&((field==='adm')?s.adm===val:s.name===val));
      if(field==='name'&&targetList.length>1) return alert('Name ambiguous; use Adm# instead.');
    }
    // period selection
    let from,to;
    if(selectAnalyticsType.value==='date'){ if(!inputAnalyticsDate.value) return alert('Pick date'); from=to=inputAnalyticsDate.value; }
    else if(selectAnalyticsType.value==='month'){ if(!inputAnalyticsMonth.value)return alert('Pick month');
      const [y,m]=inputAnalyticsMonth.value.split('-').map(Number);
      from=`${inputAnalyticsMonth.value}-01`;
      to=`${inputAnalyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    }
    else if(selectAnalyticsType.value==='semester'){
      if(!inputSemesterStart.value||!inputSemesterEnd.value) return alert('Pick range');
      const [sy,sm]=inputSemesterStart.value.split('-').map(Number);
      const [ey,em]=inputSemesterEnd.value.split('-').map(Number);
      from=`${inputSemesterStart.value}-01`;
      to=`${inputSemesterEnd.value}-${new Date(ey,em,0).getDate()}`;
    }
    else if(selectAnalyticsType.value==='year'){ if(!inputAnalyticsYear.value)return alert('Pick year');
      from=`${inputAnalyticsYear.value}-01-01`; to=`${inputAnalyticsYear.value}-12-31`;
    } else return alert('Select period');

    // compute stats
    const stats=targetList.map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      const cd=new Date(d), fD=new Date(from), tD=new Date(to);
      if(cd>=fD && cd<=tD) stats.forEach(st=>{const c=recs[st.roll]||'A'; st[c]++; st.total++;});
    });

    // render table
    let html='<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s=>{const pct=s.total?s.P/s.total*100:0; html+=`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct.toFixed(1)}</td></tr>`;});
    html+='</tbody></table>';
    divAnalyticsTable.innerHTML=html; divAnalyticsTable.classList.remove('hidden');

    divInstructions.textContent=`Report: ${from} to ${to}`; divInstructions.classList.remove('hidden');

    // charts
    const labels=stats.map(s=>s.name);
    const dataPct=stats.map(s=> s.total? s.P/s.total*100: 0);
    if(chartBar) chartBar.destroy();
    chartBar=new Chart(ctxBar,{type:'bar',data:{labels,datasets:[{label:'% Present',data:dataPct}]},options:{responsive:true,scales:{y:{beginAtZero:true,max:100}}}});
    const agg=stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    if(chartPie) chartPie.destroy();
    chartPie=new Chart(ctxPie,{type:'pie',data:{labels:['Present','Absent','Late','Half Day','Leave'],datasets:[{data:Object.values(agg)}]},options:{responsive:true}});
    divGraphs.classList.remove('hidden'); $('analyticsActions').classList.remove('hidden');
  };
  btnShareAnalytics.onclick = ()=>{ /* same as before */ };
  btnDownloadAnalytics.onclick = ()=>{ /* same as before */ };

  // --- Register ---
  const generateRegisterHeader=days=>{
    headerRegRowEl.innerHTML='<th>Sr#</th><th>Adm#</th><th>Name</th>';
    for(let d=1;d<=days;d++){const th=document.createElement('th'); th.textContent=d; headerRegRowEl.appendChild(th);}
  };
  btnLoadReg.onclick=e=>{
    e.preventDefault(); if(!monthInput.value)return alert('Select month');
    const [y,m]=monthInput.value.split('-').map(Number), days=new Date(y,m,0).getDate();
    generateRegisterHeader(days); tbodyReg.innerHTML=''; tbodyRegSum.innerHTML='';
    filteredStudents().forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=days;d++){
        const ds=`${monthInput.value}-${String(d).padStart(2,'0')}`, code=(attendanceData[ds]||{})[s.roll]||'A';
        const td=document.createElement('td'); td.textContent=code; td.style.background=colors[code]; td.style.color='#fff';
        tr.appendChild(td);
      }
      tbodyReg.appendChild(tr);
    });
    filteredStudents().forEach(s=>{
      const stat={P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for(let d=1;d<=days;d++){
        const ds=`${monthInput.value}-${String(d).padStart(2,'0')}`, c=(attendanceData[ds]||{})[s.roll]||'A';
        stat[c]++; stat.total++;
      }
      const pct=stat.total?((stat.P/stat.total)*100).toFixed(1):'0.0';
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${stat.P}</td><td>${stat.A}</td><td>${stat.Lt}</td><td>${stat.HD}</td><td>${stat.L}</td><td>${pct}</td>`;
      tbodyRegSum.appendChild(tr);
    });
    divRegTable.classList.remove('hidden'); divRegSummary.classList.remove('hidden');
    btnLoadReg.classList.add('hidden'); btnChangeReg.classList.remove('hidden');
  };
  btnChangeReg.onclick=e=>{ e.preventDefault(); divRegTable.classList.add('hidden'); divRegSummary.classList.add('hidden'); btnLoadReg.classList.remove('hidden'); btnChangeReg.classList.add('hidden'); };
  btnShareReg2.onclick=e=>{ /* same as before */ };
  btnDownloadReg2.onclick=e=>{ /* same as before */ };

  // --- Service Worker ---
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');
});
