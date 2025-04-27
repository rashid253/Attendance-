// app.js

const { get, set } = idbKeyval;

window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  // STORAGE
  let students = await get('students') || [];
  let attendanceData = await get('attendanceData') || {};
  const saveStudents = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);

  // ADM# GENERATOR
  const getLastAdmNo = async () => (await get('lastAdmissionNo')) || 0;
  const setLastAdmNo = n => set('lastAdmissionNo', n);
  const generateAdmNo = async () => {
    const last = await getLastAdmNo(), next = last + 1;
    setLastAdmNo(next);
    return String(next).padStart(4,'0');
  };

  // ELEMENTS
  const schoolInput    = $('schoolNameInput'),
        classSelect    = $('teacherClassSelect'),
        sectionSelect  = $('teacherSectionSelect'),
        btnSaveSetup   = $('saveSetup'),
        setupForm      = $('setupForm'),
        setupDisplay   = $('setupDisplay'),
        setupText      = $('setupText'),
        btnEditSetup   = $('editSetup');

  const nameInput      = $('studentName'),
        parentInput    = $('parentName'),
        contactInput   = $('parentContact'),
        occInput       = $('parentOccupation'),
        addrInput      = $('parentAddress'),
        btnAddStudent  = $('addStudent'),
        tbodyStudents  = $('studentsBody'),
        chkAllStudents = $('selectAllStudents'),
        btnEditSel     = $('editSelected'),
        btnDeleteSel   = $('deleteSelected'),
        btnSaveReg     = $('saveRegistration'),
        btnShareReg    = $('shareRegistration'),
        btnEditReg     = $('editRegistration'),
        btnDownloadReg = $('downloadRegistrationPDF');

  const dateInput      = $('dateInput'),
        btnLoadAtt     = $('loadAttendance'),
        divAttList     = $('attendanceList'),
        btnSaveAtt     = $('saveAttendance'),
        sectionResult  = $('attendance-result'),
        tbodySummary   = $('summaryBody'),
        btnResetAtt    = $('resetAttendance'),
        btnShareAtt    = $('shareAttendanceSummary'),
        btnDownloadAtt = $('downloadAttendancePDF');

  const selectAnalyticsTarget  = $('analyticsTarget'),
        analyticsSectionSelect = $('analyticsSectionSelect'),
        analyticsFilter        = $('analyticsFilter'),
        analyticsStudentInput  = $('analyticsStudentInput'),
        selectAnalyticsType    = $('analyticsType'),
        inputAnalyticsDate     = $('analyticsDate'),
        inputAnalyticsMonth    = $('analyticsMonth'),
        inputSemesterStart     = $('semesterStart'),
        inputSemesterEnd       = $('semesterEnd'),
        inputAnalyticsYear     = $('yearStart'),
        btnLoadAnalytics       = $('loadAnalytics'),
        btnResetAnalytics      = $('resetAnalytics'),
        divInstructions        = $('instructions'),
        divAnalyticsTable      = $('analyticsContainer'),
        divGraphs              = $('graphs'),
        btnShareAnalytics      = $('shareAnalytics'),
        btnDownloadAnalytics   = $('downloadAnalytics'),
        ctxBar                 = $('barChart').getContext('2d'),
        ctxPie                 = $('pieChart').getContext('2d');

  let chartBar, chartPie;

  const monthInput      = $('registerMonth'),
        btnLoadReg      = $('loadRegister'),
        btnChangeReg    = $('changeRegister'),
        divRegTable     = $('registerTableWrapper'),
        tbodyReg        = $('registerBody'),
        divRegSummary   = $('registerSummarySection'),
        tbodyRegSum     = $('registerSummaryBody'),
        btnShareReg2    = $('shareRegister'),
        btnDownloadReg2 = $('downloadRegisterPDF'),
        headerRegRowEl  = document.querySelector('#registerTable thead tr');

  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // HELPERS
  const filteredStudents = () => students.filter(s=>s.cls===classSelect.value && s.sec===sectionSelect.value);

  function animateCounters(){
    document.querySelectorAll('.number').forEach(span=>{
      const target=+span.dataset.target; let count=0, step=Math.max(1,target/100);
      function update(){ count+=step; span.textContent=count<target?Math.ceil(count):target; if(count<target) requestAnimationFrame(update); }
      requestAnimationFrame(update);
    });
  }

  function updateTotals(){
    const totalSchool=students.length,
          totalClass=students.filter(s=>s.cls===classSelect.value).length,
          totalSection=filteredStudents().length;
    [['sectionCount',totalSection],['classCount',totalClass],['schoolCount',totalSchool]]
      .forEach(([id,val])=>$ (id).dataset.target=val);
    animateCounters();
  }

  function bindRowSelection(){
    const boxes=Array.from(tbodyStudents.querySelectorAll('.sel'));
    boxes.forEach(cb=>cb.onchange=()=>{ cb.closest('tr').classList.toggle('selected',cb.checked); const any=boxes.some(x=>x.checked); btnEditSel.disabled=btnDeleteSel.disabled=!any; });
    chkAllStudents.onchange=()=>boxes.forEach(cb=>{cb.checked=chkAllStudents.checked;cb.dispatchEvent(new Event('change'));});
  }

  function renderStudents(){
    tbodyStudents.innerHTML='';
    filteredStudents().forEach((st,idx)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td><input type="checkbox" class="sel" data-index="${idx}" ${btnSaveReg.classList.contains('hidden')?'':'disabled'}></td>
        <td>${idx+1}</td><td>${st.name}</td><td>${st.adm}</td><td>${st.parent}</td>
        <td>${st.contact}</td><td>${st.occupation}</td><td>${st.address}</td>
        <td>${btnSaveReg.classList.contains('hidden')?'<button class="share-one">Share</button>':''}</td>`;
      if(btnSaveReg.classList.contains('hidden')){
        tr.querySelector('.share-one').onclick=()=>{ const hdr=`*Attendance* ${schoolInput.value} ${classSelect.value}-${sectionSelect.value}`; const msg=[hdr,`Name:${st.name}`,`Adm#:${st.adm}`].join('\n'); window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank'); };
      }
      tbodyStudents.appendChild(tr);
    });
    bindRowSelection(); updateTotals();
  }

  // SETUP
  async function loadSetup(){
    const school=await get('schoolName'), cls=await get('teacherClass'), sec=await get('teacherSection');
    if(school&&cls&&sec){ schoolInput.value=school; classSelect.value=cls; sectionSelect.value=sec; setupText.textContent=`${school} | ${cls}-${sec}`; setupForm.classList.add('hidden'); setupDisplay.classList.remove('hidden'); renderStudents(); }
  }
  btnSaveSetup.onclick=async e=>{e.preventDefault(); if(!schoolInput.value||!classSelect.value||!sectionSelect.value) return alert('Complete setup'); await set('schoolName',schoolInput.value); await set('teacherClass',classSelect.value); await set('teacherSection',sectionSelect.value); await loadSetup(); };
  btnEditSetup.onclick=e=>{e.preventDefault(); setupForm.classList.remove('hidden'); setupDisplay.classList.add('hidden');};
  await loadSetup();

  // ADD STUDENT
  btnAddStudent.onclick=async e=>{e.preventDefault(); const name=nameInput.value.trim(), parent=parentInput.value.trim(), cont=contactInput.value.trim(), occ=occInput.value.trim(), addr=addrInput.value.trim(); if(!name||!parent||!cont||!occ||!addr) return alert('All fields required'); if(!/^\d{7,15}$/.test(cont)) return alert('Contact must be 7–15 digits'); const adm=await generateAdmNo(); students.push({name,adm,parent,contact:cont,occupation:occ,address:addr,roll:Date.now(),cls:classSelect.value,sec:sectionSelect.value}); await saveStudents(); renderStudents(); [nameInput,parentInput,contactInput,occInput,addrInput].forEach(i=>i.value=''); };

  // EDIT/DELETE/REG
  btnEditSel.onclick=e=>{/*...*/}; btnDeleteSel.onclick=e=>{/*...*/}; btnSaveReg.onclick=e=>{/*...*/}; btnEditReg.onclick=e=>{/*...*/}; btnShareReg.onclick=e=>{/*...*/}; btnDownloadReg.onclick=e=>{/*...*/};

  // ATTENDANCE
  btnLoadAtt.onclick=e=>{/*...*/}; btnSaveAtt.onclick=e=>{/*...*/}; btnResetAtt.onclick=()=>{/*...*/}; btnShareAtt.onclick=()=>{/*...*/}; btnDownloadAtt.onclick=()=>{/*...*/};

  // ANALYTICS
  function resetAnalytics(){ ['labelSection','analyticsSectionSelect','labelFilter','analyticsFilter','analyticsStudentInput'].forEach(id=>$(id).classList.add('hidden')); selectAnalyticsType.disabled=true; [inputAnalyticsDate,inputAnalyticsMonth,inputSemesterStart,inputSemesterEnd,inputAnalyticsYear,btnResetAnalytics,divAnalyticsTable,divGraphs,btnShareAnalytics,btnDownloadAnalytics].forEach(el=>el.classList.add('hidden')); }
  resetAnalytics(); selectAnalyticsTarget.value='class'; selectAnalyticsTarget.dispatchEvent(new Event('change'));
  selectAnalyticsTarget.onchange=()=>{ resetAnalytics(); if(selectAnalyticsTarget.value==='class'||selectAnalyticsTarget.value==='section') selectAnalyticsType.disabled=false; if(selectAnalyticsTarget.value==='section'){$('labelSection').classList.remove('hidden'); analyticsSectionSelect.classList.remove('hidden');} if(selectAnalyticsTarget.value==='student'){$('labelFilter').classList.remove('hidden'); analyticsFilter.classList.remove('hidden');} };
  analyticsFilter.onchange=()=>{ const c=new Choices(analyticsStudentInput,{searchEnabled:true,shouldSort:false}); c.setChoices(filteredStudents().map(s=>({value:s.roll,label:`${s.name}—${s.parent}—${s.adm}`})),'value','label',true); analyticsStudentInput.classList.remove('hidden'); selectAnalyticsType.disabled=true; analyticsStudentInput.onchange=()=>selectAnalyticsType.disabled=false; };
  selectAnalyticsType.onchange=()=>{ [inputAnalyticsDate,inputAnalyticsMonth,inputSemesterStart,inputSemesterEnd,inputAnalyticsYear].forEach(i=>i.classList.add('hidden')); btnResetAnalytics.classList.remove('hidden'); if(selectAnalyticsType.value==='date') inputAnalyticsDate.classList.remove('hidden'); if(selectAnalyticsType.value==='month') inputAnalyticsMonth.classList.remove('hidden'); if(selectAnalyticsType.value==='semester'){inputSemesterStart.classList.remove('hidden');inputSemesterEnd.classList.remove('hidden');} if(selectAnalyticsType.value==='year') inputAnalyticsYear.classList.remove('hidden'); };
  btnLoadAnalytics.onclick=e=>{ e.preventDefault(); let from,to; const t=selectAnalyticsType.value; if(t==='date'){from=to=inputAnalyticsDate.value||alert('Pick date');} else if(t==='month'){const [y,m]=inputAnalyticsMonth.value.split('-').map(Number);from=`${inputAnalyticsMonth.value}-01`;to=`${inputAnalyticsMonth.value}-${new Date(y,m,0).getDate()}`;} else if(t==='semester'){const [sy,sm]=inputSemesterStart.value.split('-').map(Number);const [ey,em]=inputSemesterEnd.value.split('-').map(Number);from=`${inputSemesterStart.value}-01`;to=`${inputSemesterEnd.value}-${new Date(ey,em,0).getDate()}`;} else if(t==='year'){from=`${inputAnalyticsYear.value}-01-01`;to=`${inputAnalyticsYear.value}-12-31`;} else return alert('Select period'); let pool=[]; if(selectAnalyticsTarget.value==='class') pool=students.filter(s=>s.cls===classSelect.value); if(selectAnalyticsTarget.value==='section') pool=filteredStudents(); if(selectAnalyticsTarget.value==='student'){const roll=analyticsStudentInput.value; pool=students.filter(s=>String(s.roll)===roll);} const stats=pool.map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0})); Object.entries(attendanceData).forEach(([d,recs])=>{ if(d>=from&&d<=to) stats.forEach(st=>{const c=recs[st.roll]||'A';st[c]++;st.total++;}); }); divAnalyticsTable.innerHTML=`<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>%</th></tr></thead><tbody>${stats.map(s=>`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total?((s.P/s.total)*100).toFixed(1):'0.0'}</td></tr>`).join('')}</tbody></table>`; divAnalyticsTable.classList.remove('hidden'); divInstructions.textContent=`Report: ${from} to ${to}`; divInstructions.classList.remove('hidden'); const labels=stats.map(s=>s.name), dataPct=stats.map(s=>s.total? s.P/s.total*100:0); chartBar?.destroy(); chartBar=new Chart(ctxBar,{type:'bar',data:{labels,datasets:[{label:'% Present',data:dataPct}]},options:{scales:{y:{beginAtZero:true,max:100}}}}); const agg=stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0}); chartPie?.destroy(); chartPie=new Chart(ctxPie,{type:'pie',data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg)}]}}); divGraphs.classList.remove('hidden'); btnShareAnalytics.classList.remove('hidden'); btnDownloadAnalytics.classList.remove('hidden'); };
  btnResetAnalytics.onclick=e=>{e.preventDefault();resetAnalytics();};

  // REGISTER
  function genHeader(days){ headerRegRowEl.innerHTML='<th>Sr#</th><th>Adm#</th><th>Name</th>'+Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join(''); }
  btnLoadReg.onclick=e=>{e.preventDefault(); if(!monthInput.value)return alert('Select month'); const [y,m]=monthInput.value.split('-').map(Number), days=new Date(y,m,0).getDate(); genHeader(days); tbodyReg.innerHTML=''; tbodyRegSum.innerHTML=''; filteredStudents().forEach((s,i)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`+Array.from({length:days},(_,d)=>{const code=(attendanceData[`${monthInput.value}-${String(d+1).padStart(2,'0')}`]||{})[s.roll]||'A';return`<td style="background:${colors[code]};color:#fff">${code}</td>`;}).join(''); tbodyReg.appendChild(tr); }); filteredStudents().forEach(s=>{let stat={P:0,A:0,Lt:0,HD:0,L:0,total:0}; for(let d=1;d<=days;d++){const code=(attendanceData[`${monthInput.value}-${String(d).padStart(2,'0')}`]||{})[s.roll]||'A';stat[code]++;stat.total++;} const pct=stat.total?((stat.P/stat.total)*100).toFixed(1):'0.0'; const tr=document.createElement('tr'); tr.innerHTML=`<td>${s.name}</td><td>${stat.P}</td><td>${stat.A}</td><td>${stat.Lt}</td><td>${stat.HD}</td><td>${stat.L}</td><td>${pct}</td>`; tbodyRegSum.appendChild(tr); }); divRegTable.classList.remove('hidden'); divRegSummary.classList.remove('hidden'); btnLoadReg.classList.add('hidden'); btnChangeReg.classList.remove('hidden'); };
  btnChangeReg.onclick=e=>{e.preventDefault();divRegTable.classList.add('hidden');divRegSummary.classList.add('hidden');btnLoadReg.classList.remove('hidden');btnChangeReg.classList.add('hidden');};
});
