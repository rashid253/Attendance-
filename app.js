// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- IndexedDB helpers ---
  const { get, set } = window.idbKeyval;
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;

  const saveStudents       = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);
  const saveLastAdmNo      = () => set('lastAdmissionNo', lastAdmNo);
  async function generateAdmNo() {
    lastAdmNo++;
    await saveLastAdmNo();
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- DOM helpers ---
  const $ = id => document.getElementById(id);
  function show(el){ el.classList.remove('hidden'); }
  function hide(el){ el.classList.add('hidden'); }

  // --- SETUP ---
  async function loadSetup(){
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if(school && cls && sec){
      $('schoolNameInput').value      = school;
      $('teacherClassSelect').value   = cls;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent      = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderStudents();
      updateCounters();
    }
  }
  $('saveSetup').onclick = async e=>{
    e.preventDefault();
    const school = $('schoolNameInput').value.trim(),
          cls    = $('teacherClassSelect').value,
          sec    = $('teacherSectionSelect').value;
    if(!school||!cls||!sec) return alert('Complete setup');
    await set('schoolName', school);
    await set('teacherClass', cls);
    await set('teacherSection', sec);
    await loadSetup();
  };
  $('editSetup').onclick = e=>{
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };
  await loadSetup();

  // --- COUNTERS ---
  function animateCounters(){
    document.querySelectorAll('.number').forEach(span=>{
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target/100);
      (function update(){
        count += step;
        span.textContent = count<target ? Math.ceil(count): target;
        if(count<target) requestAnimationFrame(update);
      })();
    });
  }
  function updateCounters(){
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cls&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cls).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  $('teacherClassSelect').onchange   = ()=>{ renderStudents(); updateCounters(); };
  $('teacherSectionSelect').onchange = ()=>{ renderStudents(); updateCounters(); };

  // --- STUDENT REGISTRATION ---
  function renderStudents(){
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value,
          tbody = $('studentsBody');
    tbody.innerHTML = '';
    students.filter(s=>s.cls===cls&&s.sec===sec)
      .forEach((stu,i)=>{
        const tr=document.createElement('tr');
        tr.dataset.index=i;
        tr.innerHTML=`
          <td><input type="checkbox" class="sel"></td>
          <td>${i+1}</td><td>${stu.name}</td><td>${stu.adm}</td>
          <td>${stu.parent}</td><td>${stu.contact}</td>
          <td>${stu.occupation}</td><td>${stu.address}</td>`;
        tbody.appendChild(tr);
      });
    $('selectAllStudents').checked=false;
    toggleEditDelete();
  }
  $('addStudent').onclick=async e=>{
    e.preventDefault();
    const name=$('studentName').value.trim(),
          parent=$('parentName').value.trim(),
          contact=$('parentContact').value.trim(),
          occupation=$('parentOccupation').value.trim(),
          address=$('parentAddress').value.trim(),
          cls=$('teacherClassSelect').value,
          sec=$('teacherSectionSelect').value;
    if(!name||!parent||!contact||!occupation||!address) return alert('All fields required');
    if(!/^\d{7,15}$/.test(contact)) return alert('Contact 7–15 digits');
    const adm=await generateAdmNo();
    students.push({name,adm,parent,contact,occupation,address,cls,sec});
    renderStudents();
  };
  function toggleEditDelete(){
    const any=!!document.querySelector('.sel:checked');
    $('editSelected').disabled=!any;
    $('deleteSelected').disabled=!any;
  }
  $('studentsBody').addEventListener('change',e=>{
    if(e.target.classList.contains('sel')) toggleEditDelete();
  });
  $('selectAllStudents').onclick=()=>{
    document.querySelectorAll('.sel').forEach(cb=>cb.checked=$('selectAllStudents').checked);
    toggleEditDelete();
  };
  $('saveRegistration').onclick=async()=>{
    await saveStudents();
    hide($('editSelected'));hide($('deleteSelected'));
    hide($('selectAllStudents'));hide($('saveRegistration'));
    show($('shareRegistration'));show($('editRegistration'));
    show($('downloadRegistrationPDF'));
  };
  $('editRegistration').onclick=e=>{
    e.preventDefault();
    show($('editSelected'));show($('deleteSelected'));
    show($('selectAllStudents'));show($('saveRegistration'));
    hide($('shareRegistration'));hide($('editRegistration'));
    hide($('downloadRegistrationPDF'));
  };
  $('downloadRegistrationPDF').onclick=()=>{const{jsPDF}=window.jspdf;const d=new jsPDF();d.autoTable({html:'#studentsTable'});d.save('registration.pdf');};
  $('shareRegistration').onclick=()=>{
    const cls=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value,
          hdr=`*Students* Class:${cls} Sec:${sec}`,
          lines=students.filter(s=>s.cls===cls&&s.sec===sec).map(s=>`${s.adm}: ${s.name}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`,'_blank');
  };
  $('deleteSelected').onclick=e=>{e.preventDefault();students=students.filter((_,i)=>!Array.from(document.querySelectorAll('.sel')).some(cb=>cb.checked&&+cb.closest('tr').dataset.index===i));renderStudents();};

  // --- ATTENDANCE SECTION (UPDATED) ---
  const dateInput=$('dateInput'),
        loadAttendance=$('loadAttendance'),
        saveAttendance=$('saveAttendance'),
        resetAttendance=$('resetAttendance'),
        downloadAttendancePDF=$('downloadAttendancePDF'),
        shareAttendanceSummary=$('shareAttendanceSummary'),
        attendanceBody=$('attendanceBody'),
        attendanceSummary=$('attendanceSummary');
  loadAttendance.onclick=()=>{
    attendanceBody.innerHTML='';
    students.forEach((stu,idx)=>{
      const nameDiv=document.createElement('div');
      nameDiv.className='attendance-name';
      nameDiv.textContent=stu.name;
      attendanceBody.appendChild(nameDiv);
      ['P','A','Lt','HD','L'].forEach(code=>{
        const btn=document.createElement('button');
        btn.type='button';btn.className='att-btn';btn.dataset.code=code;btn.textContent=code;
        btn.onclick=()=>{Array.from(attendanceBody.querySelectorAll(`.att-btn[data-code]`))
            .filter(b=>b.parentElement===nameDiv.parentElement).forEach(b=>b.classList.remove('selected'));
          btn.classList.add('selected');
        };
        attendanceBody.appendChild(btn);
      });
    });
    show(saveAttendance);hide(resetAttendance);hide(downloadAttendancePDF);hide(shareAttendanceSummary);hide(attendanceSummary);
  };
  saveAttendance.onclick=async()=>{
    const date=dateInput.value; if(!date) return alert('Pick a date');
    attendanceData[date]={};
    const rows=attendanceBody.children;
    for(let i=0;i<rows.length;i+=6){
      const idx=i/6,div=rows[i],btns=Array.from(rows).slice(i+1,i+6);
      const sel=btns.find(b=>b.classList.contains('selected'));
      attendanceData[date][students[idx].roll]=sel?sel.dataset.code:'A';
    }
    await saveAttendanceData();
    hide(saveAttendance);hide(attendanceBody);
    attendanceSummary.innerHTML=`<h3>Summary: ${date}</h3><ul>`+
      students.map(s=>{const c=attendanceData[date][s.roll]||'A',t={P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'}[c];return`<li>${s.name}: ${t}</li>`;}).join('')+'</ul>';
    show(attendanceSummary);show(resetAttendance);show(downloadAttendancePDF);show(shareAttendanceSummary);
  };
  downloadAttendancePDF.onclick=()=>{
    const{jsPDF}=window.jspdf,d=new jsPDF(),date=dateInput.value;
    d.text(`Summary: ${date}`,10,10);
    const lines=Array.from(attendanceSummary.querySelectorAll('li')).map(li=>li.textContent);
    d.autoTable({head:[['Student & Status']],body:lines.map(l=>[l]),startY:20});
    d.save('attendance_summary.pdf');
  };
  shareAttendanceSummary.onclick=()=>{
    const date=dateInput.value,hdr=`Summary ${date}`,lines=Array.from(attendanceSummary.querySelectorAll('li')).map(li=>li.textContent);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`,'_blank');
  };
  resetAttendance.onclick=()=>{
    show(attendanceBody);show(saveAttendance);
    hide(attendanceSummary);hide(resetAttendance);hide(downloadAttendancePDF);hide(shareAttendanceSummary);
  };

  // --- ANALYTICS SECTION ---
  const analyticsTarget=$('analyticsTarget'),
        analyticsSection=$('analyticsSectionSelect'),
        analyticsFilter=$('analyticsFilter'),
        analyticsStudent=$('analyticsStudentInput'),
        analyticsType=$('analyticsType'),
        analyticsDate=$('analyticsDate'),
        analyticsMonth=$('analyticsMonth'),
        semesterStart=$('semesterStart'),
        semesterEnd=$('semesterEnd'),
        yearStart=$('yearStart'),
        loadAnalytics=$('loadAnalytics'),
        resetAnalytics=$('resetAnalytics'),
        instructionsEl=$('instructions'),
        analyticsContainer=$('analyticsContainer'),
        graphsEl=$('graphs'),
        analyticsActions=$('analyticsActions'),
        shareAnalytics=$('shareAnalytics'),
        downloadAnalytics=$('downloadAnalytics'),
        barCtx=$('barChart').getContext('2d'),
        pieCtx=$('pieChart').getContext('2d');
  let chartBar,chartPie;
  function hideAllAnalytics(){[analyticsDate,analyticsMonth,semesterStart,semesterEnd,yearStart,instructionsEl,analyticsContainer,graphsEl,analyticsActions,resetAnalytics].forEach(hide);}
  analyticsTarget.onchange=()=>{
    analyticsType.disabled=false;
    hideAllAnalytics();
    $('labelSection').classList.toggle('hidden',analyticsTarget.value!=='section');
    $('labelFilter').classList.toggle('hidden',analyticsTarget.value!=='student');
    analyticsSection.classList.toggle('hidden',analyticsTarget.value!=='section');
    analyticsFilter.classList.toggle('hidden',analyticsTarget.value!=='student');
    analyticsStudent.classList.add('hidden');
  };
  analyticsFilter.onchange=()=>{
    analyticsStudent.innerHTML='<option disabled selected>-- Pick --</option>'+students.map(s=>`<option value="${s.roll}">${s.name} (${s.adm})</option>`).join('');
    analyticsStudent.classList.remove('hidden');
  };
  analyticsType.onchange=()=>{
    hideAllAnalytics();
    if(analyticsType.value==='date') analyticsDate.classList.remove('hidden');
    if(analyticsType.value==='month') analyticsMonth.classList.remove('hidden');
    if(analyticsType.value==='semester'){ semesterStart.classList.remove('hidden');semesterEnd.classList.remove('hidden');}
    if(analyticsType.value==='year') yearStart.classList.remove('hidden');
    resetAnalytics.classList.remove('hidden');
  };
  resetAnalytics.onclick=e=>{e.preventDefault();hideAllAnalytics();analyticsType.value='';};
  loadAnalytics.onclick=()=>{
    const tgt=analyticsTarget.value,typ=analyticsType.value;
    let from,to;
    if(typ==='date'){from=to=analyticsDate.value;}
    else if(typ==='month'){const[y,m]=analyticsMonth.value.split('-').map(Number);from=`${analyticsMonth.value}-01`;to=`${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;}
    else if(typ==='semester'){const[sy,sm]=semesterStart.value.split('-').map(Number),[ey,em]=semesterEnd.value.split('-').map(Number);from=`${semesterStart.value}-01`;to=`${semesterEnd.value}-${new Date(ey,em,0).getDate()}`;}
    else if(typ==='year'){from=`${yearStart.value}-01-01`;to=`${yearStart.value}-12-31`;}
    else return alert('Select period');
    let pool=students.slice();
    if(tgt==='section') pool=pool.filter(s=>s.sec===analyticsSection.value);
    if(tgt==='student') pool=pool.filter(s=>String(s.roll)===analyticsStudent.value);
    const stats=pool.map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs])=>{if(d<from||d>to)return;stats.forEach(st=>{const c=recs[st.roll]||'A';st[c]++;st.total++;});});
    const thead=$('analyticsTable thead tr');thead.innerHTML='<th>Sr#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th>';
    const tbody=$('analyticsBody');tbody.innerHTML='';stats.forEach((st,i)=>{const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0';const tr=document.createElement('tr');tr.innerHTML=`<td>${i+1}</td><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${pct}%</td>`;tbody.appendChild(tr);});
    instructionsEl.textContent=`Period: ${from} to ${to}`;show(instructionsEl);show(analyticsContainer);show(graphsEl);show(analyticsActions);show(resetAnalytics);
    const labels=stats.map(s=>s.name),dataPct=stats.map(s=>s.total? s.P/s.total*100:0);
    chartBar?.destroy();chartBar=new Chart(barCtx,{type:'bar',data:{labels,datasets:[{label:'% Present',data:dataPct}]},options:{scales:{y:{beginAtZero:true,max:100}}}});
    const agg=stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    chartPie?.destroy();chartPie=new Chart(pieCtx,{type:'pie',data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg)}]}});  
  };
  shareAnalytics.onclick=()=>{const hdr=instructionsEl.textContent,rows=Array.from($('analyticsBody').children).map(tr=>tr.textContent.trim());window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`,'_blank');};
  downloadAnalytics.onclick=()=>{const{jsPDF}=window.jspdf,doc=new jsPDF();doc.autoTable({html:'#analyticsTable'});doc.save('analytics.pdf');};

  // --- ATTENDANCE REGISTER ---
  $('loadRegister').onclick=()=>{
    const m=$('registerMonth').value;if(!m)return alert('Pick month');const[y,mm]=m.split('-').map(Number),days=new Date(y,mm,0).getDate();const head=$('registerTable thead tr');head.innerHTML='<th>Sr#</th><th>Adm#</th><th>Name</th>'+Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');const tb=$('registerBody');tb.innerHTML='';students.forEach((s,i)=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`+Array.from({length:days},(_,d)=>{const k=`${m}-${String(d+1).padStart(2,'0')}`,c=attendanceData[k]?.[s.roll]||'A';return`<td>${c}</td>`;}).join('');tb.appendChild(tr);});show($('registerTableWrapper'));
  };

});
