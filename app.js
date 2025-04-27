// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- IMPORTS & PLUGINS ---
  const { get, set } = window.idbKeyval;
  const { jsPDF } = window.jspdf; 
  // autoTable plugin has already patched jsPDF.prototype.autoTable

  // --- STATE & STORAGE ---
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};

  const saveStudents       = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);

  const getLastAdmNo = async () => (await get('lastAdmissionNo')) || 0;
  const setLastAdmNo = n => set('lastAdmissionNo', n);
  async function generateAdmNo() {
    const last = await getLastAdmNo();
    const next = last + 1;
    await setLastAdmNo(next);
    return String(next).padStart(4, '0');
  }

  // --- DOM SELECTORS ---
  const $ = id => document.getElementById(id);
  // Setup
  const schoolInput  = $('schoolNameInput'),
        classSelect  = $('teacherClassSelect'),
        sectionSelect= $('teacherSectionSelect'),
        btnSaveSetup = $('saveSetup'),
        setupForm    = $('setupForm'),
        setupDisplay = $('setupDisplay'),
        setupText    = $('setupText'),
        btnEditSetup = $('editSetup');
  // Counters
  const sectionCountEl = $('sectionCount'),
        classCountEl   = $('classCount'),
        schoolCountEl  = $('schoolCount');
  // Registration
  const nameInput       = $('studentName'),
        parentInput     = $('parentName'),
        contactInput    = $('parentContact'),
        occInput        = $('parentOccupation'),
        addrInput       = $('parentAddress'),
        btnAddStudent   = $('addStudent'),
        tbodyStudents   = $('studentsBody'),
        selectAllStudents = $('selectAllStudents'),
        btnEditSelected   = $('editSelected'),
        btnDeleteSelected = $('deleteSelected'),
        btnSaveRegistration = $('saveRegistration'),
        btnShareRegistration = $('shareRegistration'),
        btnEditRegistration   = $('editRegistration'),
        btnDownloadRegistrationPDF = $('downloadRegistrationPDF');
  // Attendance marking & summary
  const dateInput        = $('dateInput'),
        btnLoadAtt       = $('loadAttendance'),
        divAttList       = $('attendanceList'),
        btnSaveAtt       = $('saveAttendance'),
        sectionResult    = $('attendance-result'),
        tbodySummary     = $('summaryBody'),
        btnResetAtt      = $('resetAttendance'),
        btnShareAtt      = $('shareAttendanceSummary'),
        btnDownloadAtt   = $('downloadAttendancePDF');
  // Analytics
  const analyticsTarget        = $('analyticsTarget'),
        analyticsSectionSelect  = $('analyticsSectionSelect'),
        analyticsFilter         = $('analyticsFilter'),
        analyticsStudentInput   = $('analyticsStudentInput'),
        analyticsType           = $('analyticsType'),
        inputAnalyticsDate      = $('analyticsDate'),
        inputAnalyticsMonth     = $('analyticsMonth'),
        inputSemesterStart      = $('semesterStart'),
        inputSemesterEnd        = $('semesterEnd'),
        inputAnalyticsYear      = $('yearStart'),
        btnLoadAnalytics        = $('loadAnalytics'),
        btnResetAnalytics       = $('resetAnalytics'),
        divInstructions         = $('instructions'),
        divAnalyticsTable       = $('analyticsContainer'),
        divGraphs               = $('graphs'),
        btnShareAnalytics       = $('shareAnalytics'),
        btnDownloadAnalytics    = $('downloadAnalytics'),
        labelSection            = $('labelSection'),
        labelFilter             = $('labelFilter');
  // Charts
  const ctxBar = $('barChart').getContext('2d'),
        ctxPie = $('pieChart').getContext('2d');
  let chartBar, chartPie;
  // Register
  const monthRegInput    = $('registerMonth'),
        btnLoadReg       = $('loadRegister'),
        btnChangeReg     = $('changeRegister'),
        divRegTable      = $('registerTableWrapper'),
        tbodyReg         = $('registerBody'),
        divRegSummary    = $('registerSummarySection'),
        tbodyRegSum      = $('registerSummaryBody'),
        btnShareReg2     = $('shareRegister'),
        btnDownloadReg2  = $('downloadRegisterPDF');

  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // --- SETUP ---
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
      updateTotals();
    }
  }
  btnSaveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolInput.value||!classSelect.value||!sectionSelect.value) return alert('Complete setup');
    await set('schoolName', schoolInput.value);
    await set('teacherClass', classSelect.value);
    await set('teacherSection', sectionSelect.value);
    await loadSetup();
  };
  btnEditSetup.onclick = e => { e.preventDefault(); setupForm.classList.remove('hidden'); setupDisplay.classList.add('hidden'); };
  await loadSetup();

  // --- COUNTERS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target, step = Math.max(1, target/100);
      let count = 0;
      (function update(){count+=step;span.textContent=count<target?Math.ceil(count):target; if(count<target)requestAnimationFrame(update);}());
    });
  }
  function updateTotals() {
    const filtered = students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value);
    sectionCountEl.dataset.target = filtered.length;
    classCountEl.dataset.target   = students.filter(s=>s.cls===classSelect.value).length;
    schoolCountEl.dataset.target  = students.length;
    animateCounters();
  }

  // --- STUDENT REGISTRATION ---
  btnAddStudent.onclick = async e=>{ e.preventDefault();
    const name=nameInput.value.trim(), parent=parentInput.value.trim(),
          cont=contactInput.value.trim(), occ=occInput.value.trim(),
          addr=addrInput.value.trim();
    if(!name||!parent||!cont||!occ||!addr) return alert('All fields required');
    if(!/^\d{7,15}$/.test(cont)) return alert('Contact must be 7–15 digits');
    const adm=await generateAdmNo();
    students.push({name,adm,parent,contact:cont,occupation:occ,address:addr,roll:Date.now(),cls:classSelect.value,sec:sectionSelect.value});
    await saveStudents(); renderStudents();
    [nameInput,parentInput,contactInput,occInput,addrInput].forEach(i=>i.value='');
  };
  function renderStudents(){
    tbodyStudents.innerHTML='';
    students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value)
      .forEach((st,idx)=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`
          <td><input type="checkbox" class="sel" data-index="${idx}"></td>
          <td>${idx+1}</td><td>${st.name}</td><td>${st.adm}</td>
          <td>${st.parent}</td><td>${st.contact}</td><td>${st.occupation}</td>
          <td>${st.address}</td><td><button class="share-one">Share</button></td>
        `;
        tr.querySelector('.share-one').onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(`Name: ${st.name}\nAdm#: ${st.adm}`)}`,'_blank');
        tbodyStudents.appendChild(tr);
      });
    bindRowSelection(); updateTotals();
  }
  function bindRowSelection(){
    const boxes=Array.from(tbodyStudents.querySelectorAll('.sel'));
    boxes.forEach(cb=>cb.onchange=()=>{ btnEditSelected.disabled=btnDeleteSelected.disabled=!boxes.some(x=>x.checked); });
    selectAllStudents.onchange=()=>boxes.forEach(cb=>cb.checked=selectAllStudents.checked)||boxes[0]?.dispatchEvent(new Event('change'));
  }
  btnSaveRegistration.onclick=e=>{ e.preventDefault();
    ['saveRegistration','editSelected','deleteSelected','selectAllStudents'].forEach(id=>$(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.remove('hidden'));
  };
  btnEditRegistration.onclick=e=>{ e.preventDefault();
    ['saveRegistration','editSelected','deleteSelected','selectAllStudents'].forEach(id=>$(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.add('hidden'));
  };
  btnEditSelected.onclick=e=>{ e.preventDefault();
    Array.from(tbodyStudents.querySelectorAll('.sel:checked')).forEach(cb=>{
      const tr=cb.closest('tr');
      tr.querySelectorAll('td').forEach((td,ci)=>{
        if(ci>=2&&ci<=7){ td.contentEditable=true; td.classList.add('editing'); td.onblur=async ()=>{
          const idx=+cb.dataset.index, keys=['name','adm','parent','contact','occupation','address'], val=td.textContent.trim();
          if(ci===3&&!/^\d+$/.test(val)) { alert('Adm# numeric'); renderStudents(); return; }
          students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value)[idx][keys[ci-2]]=val;
          await saveStudents();
        }; }
      });
    });
  };
  btnDeleteSelected.onclick=async e=>{ e.preventDefault(); if(!confirm('Delete selected?'))return;
    const toRemove=Array.from(tbodyStudents.querySelectorAll('.sel:checked'))
      .map(cb=>students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value)[+cb.dataset.index].roll);
    students=students.filter(s=>!toRemove.includes(s.roll));
    await saveStudents(); renderStudents();
  };
  btnDownloadRegistrationPDF.onclick=e=>{ e.preventDefault();
    const doc=new jsPDF();
    doc.autoTable({ html:'#studentTable', startY:10 });
    doc.save('registration.pdf');
  };

  // --- ATTENDANCE MARKING & SUMMARY ---
  btnLoadAtt.onclick=e=>{ e.preventDefault(); if(!dateInput.value)return alert('Pick a date');
    divAttList.innerHTML='';
    students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value)
      .forEach(s=>{
        const row=document.createElement('div'); row.className='attendance-item'; row.textContent=s.name;
        const actions=document.createElement('div'); actions.className='attendance-actions';
        ['P','A','Lt','HD','L'].forEach(code=>{
          const b=document.createElement('button'); b.textContent=code; b.dataset.code=code;
          b.onclick=()=>{ actions.querySelectorAll('button').forEach(x=>{x.style.background='';x.style.color='';}); b.style.background=colors[code]; b.style.color='#fff'; };
          actions.appendChild(b);
        });
        divAttList.append(row,actions);
      });
    btnSaveAtt.classList.remove('hidden');
  };
  btnSaveAtt.onclick=async e=>{ e.preventDefault();
    const d=dateInput.value; attendanceData[d]={};
    students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value).forEach((s,i)=>{
      const b=divAttList.querySelectorAll('.attendance-actions')[i].querySelector('button[style*="background"]');
      attendanceData[d][s.roll]=b?b.dataset.code:'A';
    });
    await saveAttendanceData(); sectionResult.classList.remove('hidden'); tbodySummary.innerHTML='';
    students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value).forEach(s=>{
      const code=attendanceData[d][s.roll]||'A';
      const status={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(`Date: ${d}\nName: ${s.name}\nStatus: ${status}`)}`,'_blank');
      tbodySummary.appendChild(tr);
    });
  };
  btnResetAtt.onclick=()=>{ sectionResult.classList.add('hidden'); divAttList.innerHTML=''; btnSaveAtt.classList.add('hidden'); };
  btnShareAtt.onclick=()=>{ const d=dateInput.value;
    const hdr=`*Attendance* Date: ${d}`, lines=students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value)
      .map(s=>`${s.name}: ${ {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[attendanceData[d][s.roll]||'A'] }`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`,'_blank');
  };
  btnDownloadAtt.onclick=()=>{ const d=dateInput.value; const doc=new jsPDF();
    doc.text('Attendance Summary',10,10);
    doc.autoTable({
      head:[['Name','Status']],
      body:students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value)
        .map(s=>{ const code=attendanceData[d][s.roll]||'A'; return [s.name,{P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]];}),
      startY:20
    });
    doc.save('attendance.pdf');
  };

  // --- ANALYTICS ---
  function resetAnalyticsUI(){
    ['labelSection','analyticsSectionSelect','labelFilter','analyticsFilter','analyticsStudentInput']
      .forEach(id=>$(id).classList.add('hidden'));
    analyticsType.disabled=true;
    [inputAnalyticsDate,inputAnalyticsMonth,inputSemesterStart,inputSemesterEnd,inputAnalyticsYear,btnResetAnalytics,divAnalyticsTable,divGraphs,btnShareAnalytics,btnDownloadAnalytics]
      .forEach(el=>el.classList.add('hidden'));
    divInstructions.textContent='';
    analyticsTarget.value=''; analyticsType.value=''; analyticsSectionSelect.value=''; analyticsFilter.value=''; analyticsStudentInput.value='';
  }
  resetAnalyticsUI();
  analyticsTarget.onchange=()=>{ resetAnalyticsUI(); analyticsType.disabled=false;
    if(analyticsTarget.value==='section') $( 'labelSection').classList.remove('hidden'), analyticsSectionSelect.classList.remove('hidden');
    if(analyticsTarget.value==='student') $( 'labelFilter').classList.remove('hidden'), analyticsFilter.classList.remove('hidden');
  };
  analyticsFilter.onchange=()=>{ new Choices(analyticsStudentInput,{searchEnabled:true,shouldSort:false,itemSelectText:''})
      .setChoices(students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value)
        .map(s=>({value:s.roll,label:`${s.name} — ${s.parent} — ${s.adm}`})),'value','label',true);
      analyticsStudentInput.classList.remove('hidden');
  };

  analyticsType.onchange=()=>{
    [inputAnalyticsDate,inputAnalyticsMonth,inputSemesterStart,inputSemesterEnd,inputAnalyticsYear].forEach(i=>i.classList.add('hidden'));
    btnResetAnalytics.classList.remove('hidden');
    if(analyticsType.value==='date') inputAnalyticsDate.classList.remove('hidden');
    if(analyticsType.value==='month') inputAnalyticsMonth.classList.remove('hidden');
    if(analyticsType.value==='semester'){ inputSemesterStart.classList.remove('hidden'); inputSemesterEnd.classList.remove('hidden'); }
    if(analyticsType.value==='year') inputAnalyticsYear.classList.remove('hidden');
  };

  btnLoadAnalytics.onclick=e=>{ e.preventDefault();
    let from,to; const t=analyticsType.value;
    if(t==='date'){ if(!inputAnalyticsDate.value) return alert('Pick date'); from=to=inputAnalyticsDate.value; }
    else if(t==='month'){ if(!inputAnalyticsMonth.value) return alert('Pick month'); const [y,m]=inputAnalyticsMonth.value.split('-').map(Number);
      from=`${inputAnalyticsMonth.value}-01`; to=`${inputAnalyticsMonth.value}-${new Date(y,m,0).getDate()}`; }
    else if(t==='semester'){ if(!inputSemesterStart.value||!inputSemesterEnd.value) return alert('Pick start & end'); 
      const [sy,sm]=inputSemesterStart.value.split('-').map(Number), [ey,em]=inputSemesterEnd.value.split('-').map(Number);
      from=`${inputSemesterStart.value}-01`; to=`${inputSemesterEnd.value}-${new Date(ey,em,0).getDate()}`; }
    else if(t==='year'){ if(!inputAnalyticsYear.value) return alert('Pick year'); from=`${inputAnalyticsYear.value}-01-01`; to=`${inputAnalyticsYear.value}-12-31`; }
    else return alert('Select period');

    let pool=[];
    if(analyticsTarget.value==='class') pool=students.filter(s=>s.cls===classSelect.value);
    if(analyticsTarget.value==='section') pool=students.filter(s=>s.cls===classSelect.value&&s.sec===analyticsSectionSelect.value);
    if(analyticsTarget.value==='student') pool=students.filter(s=>s.roll===+analyticsStudentInput.value);

    const stats=pool.map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs])=>{ if(d>=from&&d<=to) stats.forEach(st=>{ const c=recs[st.roll]||'A'; st[c]++; st.total++; }); });

    divAnalyticsTable.innerHTML=`<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>%</th></tr></thead><tbody>${
      stats.map(s=>`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${
        s.total?((s.P/s.total)*100).toFixed(1):'0.0'
      }</td></tr>`).join('')
    }</tbody></table>`;
    divAnalyticsTable.classList.remove('hidden');
    divInstructions.textContent=`Report: ${from} to ${to}`; divInstructions.classList.remove('hidden');

    // charts
    const labels=stats.map(s=>s.name), dataPct=stats.map(s=>s.total? s.P/s.total*100:0);
    chartBar?.destroy(); chartBar=new Chart(ctxBar,{type:'bar',data:{labels,datasets:[{label:'% Present',data:dataPct}]},options:{scales:{y:{beginAtZero:true,max:100}}}});
    const agg=stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    chartPie?.destroy(); chartPie=new Chart(ctxPie,{type:'pie',data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg)}]}});

    divGraphs.classList.remove('hidden'); $('#analyticsActions').classList.remove('hidden');
  };
  btnResetAnalytics.onclick=e=>{ e.preventDefault(); resetAnalyticsUI(); };

  btnShareAnalytics.onclick=()=>{
    const rows=Array.from(divAnalyticsTable.querySelectorAll('tbody tr')).map(r=>{
      const [n,P,A,Lt,HD,L,pct]=[...r.querySelectorAll('td')].map(td=>td.textContent);
      return `${n}: P:${P}, A:${A}, Lt:${Lt}, HD:${HD}, L:${L}, %:${pct}`;
    });
    const hdr=`Attendance Report (${analyticsTarget.value}):`;
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`,'_blank');
  };
  btnDownloadAnalytics.onclick=()=>{
    const doc=new jsPDF();
    doc.text(`Attendance Report (${analyticsTarget.value})`,10,10);
    doc.autoTable({ html:'#analyticsContainer table', startY:20 });
    doc.save('analytics.pdf');
  };

  // --- ATTENDANCE REGISTER ---
  btnLoadReg.onclick=e=>{ e.preventDefault();
    if(!monthRegInput.value) return alert('Select month');
    const [y,m]=monthRegInput.value.split('-').map(Number), days=new Date(y,m,0).getDate();
    const tbl=$('registerTable'), theadRow=tbl.querySelector('thead tr');
    theadRow.innerHTML='<th>Sr#</th><th>Adm#</th><th>Name</th>'+Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    tbodyReg.innerHTML=''; tbodyRegSum.innerHTML='';
    const filtered=students.filter(s=>s.cls===classSelect.value&&s.sec===sectionSelect.value);
    filtered.forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`+Array.from({length:days},(_,d)=>{
        const code=(attendanceData[`${monthRegInput.value}-${String(d+1).padStart(2,'0')}`]||{})[s.roll]||'A';
        return `<td style="background:${colors[code]};color:#fff">${code}</td>`;
      }).join('');
      tbodyReg.appendChild(tr);
    });
    filtered.forEach(s=>{
      let stat={P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for(let d=1;d<=days;d++){
        const code=(attendanceData[`${monthRegInput.value}-${String(d).padStart(2,'0')}`]||{})[s.roll]||'A';
        stat[code]++; stat.total++;
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
  btnShareReg2.onclick=e=>{ e.preventDefault();
    const hdr=`*Attendance Register* ${monthRegInput.value}`; const lines=Array.from(tbodyRegSum.querySelectorAll('tr')).map(r=>{
      const [n,p,a,lt,hd,l,pct]=[...r.querySelectorAll('td')].map(td=>td.textContent);
      return `${n}: P:${p}, A:${a}, Lt:${lt}, HD:${hd}, L:${l}, %:${pct}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`,'_blank');
  };
  btnDownloadReg2.onclick=()=>{
    const doc=new jsPDF('landscape');
    doc.autoTable({ html:'#registerTable', startY:10, styles:{fontSize:6} });
    doc.autoTable({ html:'#registerSummarySection table', startY:doc.lastAutoTable.finalY+10, styles:{fontSize:8} });
    doc.save('register.pdf');
  };

  // --- PWA SW ---
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(()=>{});
});
