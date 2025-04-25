// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- 0. STORAGE & HELPERS ----------------------------
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // load or initialize
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};

  function saveStudents()       { return set('students', students); }
  function saveAttendanceData(){ return set('attendanceData', attendanceData); }

  function getCurrentClassSection() {
    return { cls: $('teacherClassSelect').value, sec: $('teacherSectionSelect').value };
  }
  function filteredStudents() {
    const { cls, sec } = getCurrentClassSection();
    return students.filter(s => s.cls===cls && s.sec===sec);
  }

  // --- 1. SETUP ---------------------------------------
  const schoolIn    = $('schoolNameInput');
  const classSel    = $('teacherClassSelect');
  const secSel      = $('teacherSectionSelect');
  const saveSetup   = $('saveSetup');
  const setupForm   = $('setupForm');
  const setupDisplay= $('setupDisplay');
  const setupText   = $('setupText');
  const editSetup   = $('editSetup');

  async function loadSetup(){
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if(school&&cls&&sec){
      schoolIn.value=school;
      classSel.value=cls;
      secSel.value  =sec;
      setupText.textContent=`${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
      renderStudents();
    }
  }
  saveSetup.onclick=async e=>{
    e.preventDefault();
    if(!schoolIn.value||!classSel.value||!secSel.value) return alert('Complete setup');
    await set('schoolName', schoolIn.value);
    await set('teacherClass', classSel.value);
    await set('teacherSection', secSel.value);
    await loadSetup();
  };
  editSetup.onclick=e=>{
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };
  await loadSetup();

  // --- 2. STUDENT REGISTRATION -----------------------
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
  let   regSaved=false, inlineEdit=false;

  function bindSelection(){
    const boxes=[...studentsBody.querySelectorAll('.sel')];
    boxes.forEach(cb=>cb.onchange=()=>{
      cb.closest('tr').classList.toggle('selected',cb.checked);
      const any=boxes.some(x=>x.checked);
      editSelBtn.disabled=deleteSelBtn.disabled=!any;
    });
    selectAllCb.disabled=regSaved;
    selectAllCb.onchange=()=>boxes.forEach(cb=>{
      cb.checked=selectAllCb.checked;
      cb.dispatchEvent(new Event('change'));
    });
  }

  function renderStudents(){
    const list=filteredStudents();
    studentsBody.innerHTML='';
    list.forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved?'disabled':''}></td>`+
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>`+
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>`+
        `<td>${regSaved?'<button class="share-one">Share</button>':''}</td>`;
      if(regSaved){
        const btn=tr.querySelector('.share-one');
        if(btn) btn.onclick=e=>{
          e.preventDefault();
          const hdr=`School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
          const msg=`${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }

  addStudentBtn.onclick=async e=>{
    e.preventDefault();
    const name=studentNameIn.value.trim(),
          adm=admissionNoIn.value.trim(),
          parent=parentNameIn.value.trim(),
          contact=parentContactIn.value.trim(),
          occ=parentOccIn.value.trim(),
          addr=parentAddrIn.value.trim();
    if(!name||!adm||!parent||!contact||!occ||!addr) return alert('All fields required');
    if(!/^\d+$/.test(adm)) return alert('Adm# must be numeric');
    if(!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits');
    if(students.some(s=>s.adm===adm&&s.cls===classSel.value&&s.sec===secSel.value))
      return alert('Duplicate in this class/section');
    students.push({name,adm,parent,contact,occupation:occ,address:addr,roll:Date.now(),cls:classSel.value,sec:secSel.value});
    await saveStudents();
    renderStudents();
    [studentNameIn,admissionNoIn,parentNameIn,parentContactIn,parentOccIn,parentAddrIn].forEach(i=>i.value='');
  };

  function onCellBlur(e){
    const td=e.target, tr=td.closest('tr'),
          idx=+tr.querySelector('.sel').dataset.index,
          keys=['name','adm','parent','contact','occupation','address'],
          ci=[...tr.children].indexOf(td),
          val=td.textContent.trim(),
          list=filteredStudents(),
          stu=list[idx];
    if(ci===2&&!/^\d+$/.test(val)){alert('Adm# must be numeric');renderStudents();return;}
    if(ci===2&&students.some(s=>s.adm===val&&s.roll!==stu.roll)){alert('Duplicate Adm#');renderStudents();return;}
    if(ci>=1&&ci<=6){
      stu[keys[ci-1]]=val;
      students=students.map(s=>s.roll===stu.roll?stu:s);
      saveStudents();
    }
  }

  editSelBtn.onclick=e=>{
    e.preventDefault();
    const sel=[...document.querySelectorAll('.sel:checked')];
    if(!sel.length) return;
    inlineEdit=!inlineEdit;
    editSelBtn.textContent=inlineEdit?'Done Editing':'Edit Selected';
    sel.forEach(cb=>[...cb.closest('tr').querySelectorAll('td')].forEach((td,ci)=>{
      if(ci>=1&&ci<=6){
        td.contentEditable=inlineEdit;
        td.classList.toggle('editing',inlineEdit);
        inlineEdit?td.addEventListener('blur',onCellBlur):td.removeEventListener('blur',onCellBlur);
      }
    }));
  };

  deleteSelBtn.onclick=async e=>{
    e.preventDefault();
    if(!confirm('Delete selected?')) return;
    const rolls=[...document.querySelectorAll('.sel:checked')].map(cb=>filteredStudents()[+cb.dataset.index].roll);
    students=students.filter(s=>!rolls.includes(s.roll));
    await saveStudents();
    renderStudents();
  };

  saveRegBtn.onclick=e=>{
    e.preventDefault();
    regSaved=true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.remove('hidden'));
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };
  editRegBtn.onclick=e=>{
    e.preventDefault();
    regSaved=false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.add('hidden'));
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick=e=>{
    e.preventDefault();
    const hdr=`School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`,
          lines=filteredStudents().map(s=>`Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`,'_blank');
  };

  downloadRegBtn.onclick=e=>{
    e.preventDefault();
    const {jsPDF}=window.jspdf,doc=new jsPDF();
    doc.setFontSize(16);doc.text('Student Registration',10,10);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`,10,20);
    doc.text(`School: ${schoolIn.value}`,10,26);
    doc.text(`Class: ${classSel.value}`,10,32);
    doc.text(`Section: ${secSel.value}`,10,38);
    doc.autoTable({
      head:[['Name','Adm#','Parent','Contact','Occupation','Address']],
      body:filteredStudents().map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY:44
    });
    doc.save('student_registration.pdf');
  };

  renderStudents();

  // --- 3. ATTENDANCE MARKING -------------------------
  const dateInput2=$('dateInput'),
        loadAtt=$('loadAttendance'),
        attList=$('attendanceList'),
        saveAtt=$('saveAttendance'),
        attResult=$('attendance-result'),
        sumBody=$('summaryBody'),
        resetAtt=$('resetAttendance'),
        shareAtt=$('shareAttendanceSummary'),
        dlAtt=$('downloadAttendancePDF');

  loadAtt.onclick=e=>{
    e.preventDefault();
    const d=dateInput2.value; if(!d) return alert('Pick a date');
    attList.innerHTML='';
    filteredStudents().forEach(s=>{
      const row=document.createElement('div');row.className='attendance-item';row.textContent=s.name;
      const actions=document.createElement('div');actions.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button');
        b.type='button';b.textContent=code;b.dataset.code=code;
        if(attendanceData[d]?.[s.roll]===code){b.style.background=colors[code];b.style.color='#fff';}
        b.onclick=e2=>{e2.preventDefault();actions.querySelectorAll('button').forEach(x=>{x.style.background='';x.style.color='#333'});b.style.background=colors[code];b.style.color='#fff';};
        actions.appendChild(b);
      });
      attList.append(row);attList.append(actions);
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick=async e=>{
    e.preventDefault();
    const d=dateInput2.value;attendanceData[d]={};
    document.querySelectorAll('.attendance-actions').forEach((actions,i)=>{
      const sel=actions.querySelector('button[style*="background"]');
      attendanceData[d][filteredStudents()[i].roll]=sel?.dataset.code||'A';
    });
    await saveAttendanceData();
    $('attendance-section').classList.add('hidden');attResult.classList.remove('hidden');
    sumBody.innerHTML='';const hdr=`Date: ${d}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    sumBody.insertAdjacentHTML('beforebegin',`<tr><td colspan="3"><em>${hdr}</em></td></tr>`);
    filteredStudents().forEach(s=>{
      const code=attendanceData[d][s.roll]||'A',
            status={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code],
            tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick=e2=>{e2.preventDefault();window.open(`https://wa.me/?text=${encodeURIComponent(hdr+`\n\nName: ${s.name}\nStatus: ${status}`)}`,'_blank');};
      sumBody.appendChild(tr);
    });
  };

  resetAtt.onclick=_=>{
    attResult.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    attList.innerHTML='';
    saveAtt.classList.add('hidden');
    sumBody.innerHTML='';
  };

  shareAtt.onclick=_=>{
    const d=dateInput2.value,
          hdr=`Date: ${d}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`,
          lines=filteredStudents().map(s=>`${s.name}: ${ {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[attendanceData[d]?.[s.roll]||'A'] }`);
    const total=filteredStudents().length,
          pres=filteredStudents().reduce((a,s)=>a+(attendanceData[d]?.[s.roll]==='P'?1:0),0),
          pct=total?((pres/total)*100).toFixed(1):'0.0',
          remark=pct==100?'Best':pct>=75?'Good':pct>=50?'Fair':'Poor',
          msg=[hdr,'',...lines,'',`Overall Attendance: ${pct}% | ${remark}`].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
  };

  dlAtt.onclick=e=>{
    e.preventDefault();
    const {jsPDF}=window.jspdf,doc=new jsPDF();
    doc.setFontSize(16);doc.text('Daily Attendance',10,10);
    doc.setFontSize(12);
    const d=dateInput2.value,dateStr=new Date(d).toLocaleDateString();
    doc.text(`Date: ${dateStr}`,10,20);
    doc.text(`School: ${schoolIn.value}`,10,26);
    doc.text(`Class: ${classSel.value}`,10,32);
    doc.text(`Section: ${secSel.value}`,10,38);
    doc.autoTable({
      head:[['Name','Status']],
      body:filteredStudents().map(s=>{const code=attendanceData[d]?.[s.roll]||'A';return [s.name,{P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]];}),
      startY:44
    });
    doc.save('attendance_summary.pdf');
  };

  // --- 4. ANALYTICS ------------------------------------------------
  const analyticsTarget=$('analyticsTarget'),
        studAdmIn    =$('studentAdmInput'),
        analyticsType=$('analyticsType'),
        analyticsDate=$('analyticsDate'),
        analyticsMonth=$('analyticsMonth'),
        semesterStart=$('semesterStart'),
        semesterEnd  =$('semesterEnd'),
        yearStartIn  =$('yearStart'),
        loadAnalytics=$('loadAnalytics'),
        resetAnalytics=$('resetAnalytics'),
        instructions =$('instructions'),
        analyticsContainer=$('analyticsContainer'),
        graphs       =$('graphs'),
        shareAnalytics=$('shareAnalytics'),
        downloadAnalytics=$('downloadAnalytics');

  function hideAnalyticsInputs(){
    [analyticsDate,analyticsMonth,semesterStart,semesterEnd,yearStartIn,instructions,analyticsContainer,graphs,shareAnalytics,downloadAnalytics,resetAnalytics].forEach(el=>el.classList.add('hidden'));
  }

  analyticsTarget.onchange=_=>{
    studAdmIn.classList.toggle('hidden',analyticsTarget.value!=='student');
    hideAnalyticsInputs();
    analyticsType.value='';
  };

  analyticsType.onchange=_=>{
    hideAnalyticsInputs();
    if(analyticsType.value==='date') analyticsDate.classList.remove('hidden');
    if(analyticsType.value==='month') analyticsMonth.classList.remove('hidden');
    if(analyticsType.value==='semester'){semesterStart.classList.remove('hidden');semesterEnd.classList.remove('hidden');}
    if(analyticsType.value==='year') yearStartIn.classList.remove('hidden');
    resetAnalytics.classList.remove('hidden');
  };

  resetAnalytics.onclick=e=>{e.preventDefault();hideAnalyticsInputs();analyticsType.value='';};

  loadAnalytics.onclick=e=>{
    e.preventDefault();
    let from,to;
    if(analyticsType.value==='date'){
      if(!analyticsDate.value) return alert('Pick a date');
      from=to=analyticsDate.value;
    } else if(analyticsType.value==='month'){
      if(!analyticsMonth.value) return alert('Pick a month');
      const [y,m]=analyticsMonth.value.split('-').map(Number);
      from=`${analyticsMonth.value}-01`;
      to=`${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    } else if(analyticsType.value==='semester'){
      if(!semesterStart.value||!semesterEnd.value) return alert('Pick range');
      from=`${semesterStart.value}-01`;
      const [ey,em]=semesterEnd.value.split('-').map(Number);
      to=`${semesterEnd.value}-${new Date(ey,em,0).getDate()}`;
    } else if(analyticsType.value==='year'){
      if(!yearStartIn.value) return alert('Pick year');
      from=`${yearStartIn.value}-01-01`;
      to=`${yearStartIn.value}-12-31`;
    } else return alert('Select period');

    let stats=[];
    if(analyticsTarget.value==='student'){
      const adm=studAdmIn.value.trim();
      if(!adm) return alert('Enter Adm#');
      const stu=filteredStudents().find(s=>s.adm===adm);
      if(!stu) return alert(`No student ${adm}`);
      stats=[{name:stu.name,roll:stu.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}];
    } else {
      stats=filteredStudents().map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    }

    const fD=new Date(from), tD=new Date(to);
    Object.entries(attendanceData).forEach(([d,recs])=>{
      const cd=new Date(d);
      if(cd>=fD&&cd<=tD) stats.forEach(st=>{
        const code=recs[st.roll]||'A';
        st[code]++;st.total++;
      });
    });

    // build table
    let html='<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s=>{
      const pct=s.total?((s.P/s.total)*100).toFixed(1):'0.0';
      html+=`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
    });
    html+='</tbody></table>';
    analyticsContainer.innerHTML=html; analyticsContainer.classList.remove('hidden');

    instructions.textContent=analyticsTarget.value==='student'
      ?`Adm#: ${studAdmIn.value.trim()} | Report: ${from} to ${to}`
      :`Report: ${from} to ${to}`;
    instructions.classList.remove('hidden');

    // bar chart
    const labels=stats.map(s=>s.name);
    const dataPct=stats.map(s=>s.total?(s.P/s.total)*100:0);
    if(barChart) barChart.destroy();
    barChart=new Chart(barCtx,{type:'bar',data:{labels,datasets:[{label:'% Present',data:dataPct}]},options:{responsive:true,scales:{y:{beginAtZero:true,max:100}}}});

    // pie chart
    const agg=stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    if(pieChart) pieChart.destroy();
    pieChart=new Chart(pieCtx,{type:'pie',data:{labels:['Present','Absent','Late','Half Day','Leave'],datasets:[{data:Object.values(agg)}]},options:{responsive:true}});

    graphs.classList.remove('hidden'); shareAnalytics.classList.remove('hidden'); downloadAnalytics.classList.remove('hidden');
  };

  shareAnalytics.onclick=e=>{
    e.preventDefault();
    const period=instructions.textContent.split('|')[1].trim();
    const hdr=`Period: ${period}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const rows=[...analyticsContainer.querySelectorAll('tbody tr')].map(r=>{
      const t=[...r.querySelectorAll('td')].map(td=>td.textContent);
      return `${t[0]} P:${t[1]} A:${t[2]} Lt:${t[3]} HD:${t[4]} L:${t[5]} Total:${t[6]} %:${t[7]}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\\n\\n'+rows.join('\\n'))}`,'_blank');
  };

  downloadAnalytics.onclick=e=>{
    e.preventDefault();
    const {jsPDF}=window.jspdf,doc=new jsPDF();
    doc.setFontSize(16);doc.text('Attendance Analytics',10,10);
    doc.setFontSize(12);doc.text(`Generated on: ${new Date().toLocaleDateString()}`,10,20);
    const period=instructions.textContent.split('|')[1].trim();
    doc.text(`Period: ${period}`,10,26);
    doc.text(`School: ${schoolIn.value}`,10,32);
    doc.text(`Class: ${classSel.value} | Section: ${secSel.value}`,10,38);
    doc.autoTable({head:[['Name','P','A','Lt','HD','L','Total','%']],body:[...analyticsContainer.querySelectorAll('tbody tr')].map(r=>[...r.querySelectorAll('td')].map(td=>td.textContent)),startY:44});
    const y=doc.lastAutoTable.finalY+10;
    doc.addImage(barChart.toBase64Image(),'PNG',10,y,80,60);
    doc.addImage(pieChart.toBase64Image(),'PNG',100,y,80,60);
    alert('PDF generated');doc.save('attendance_analytics.pdf');
  };

  // --- 5. ATTENDANCE REGISTER -----------------------
  const registerMonth=$('registerMonth'),
        loadReg    =$('loadRegister'),
        changeReg  =$('changeRegister'),
        regTableWrap=$('registerTableWrapper'),
        regBody    =$('registerBody'),
        regSummarySec=$('registerSummarySection'),
        regSummaryBody=$('registerSummaryBody'),
        shareReg2  =$('shareRegister'),
        downloadReg2=$('downloadRegisterPDF'),
        headerRow  =document.querySelector('#registerTable thead tr');

  function generateRegisterHeader(days){
    headerRow.innerHTML=`<th>#</th><th>Adm#</th><th>Name</th>`;
    for(let d=1;d<=days;d++){
      const th=document.createElement('th');th.textContent=d;headerRow.appendChild(th);
    }
  }

  loadReg.onclick=e=>{
    e.preventDefault();
    if(!registerMonth.value) return alert('Select month');
    const [y,m]=registerMonth.value.split('-').map(Number),
          days=new Date(y,m,0).getDate();
    generateRegisterHeader(days);
    regBody.innerHTML='';regSummaryBody.innerHTML='';
    filteredStudents().forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=days;d++){
        const dateStr=`${registerMonth.value}-${String(d).padStart(2,'0')}`,
              code=(attendanceData[dateStr]||{})[s.roll]||'A',
              td=document.createElement('td');
        td.textContent=code;td.style.background=colors[code];td.style.color='#fff';tr.appendChild(td);
      }
      regBody.appendChild(tr);
    });
    filteredStudents().forEach(s=>{
      const st={P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for(let d=1;d<=days;d++){
        const dateStr=`${registerMonth.value}-${String(d).padStart(2,'0')}`,
              code=(attendanceData[dateStr]||{})[s.roll]||'A';
        st[code]++;st.total++;
      }
      const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0',
            tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${pct}</td>`;
      regSummaryBody.appendChild(tr);
    });
    regTableWrap.classList.remove('hidden');
    regSummarySec.classList.remove('hidden');
    loadReg.classList.add('hidden');
    changeReg.classList.remove('hidden');
  };

  changeReg.onclick=e=>{
    e.preventDefault();
    regTableWrap.classList.add('hidden');
    regSummarySec.classList.add('hidden');
    loadReg.classList.remove('hidden');
    changeReg.classList.add('hidden');
  };

  shareReg2.onclick=e=>{
    e.preventDefault();
    const hdr=`Register for ${registerMonth.value}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines=[...regSummaryBody.querySelectorAll('tr')].map(r=>{
      const td=[...r.querySelectorAll('td')].map(c=>c.textContent);
      return `${td[0]}: P:${td[1]}, A:${td[2]}, Lt:${td[3]}, HD:${td[4]}, L:${td[5]}, %:${td[6]}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines.join('\n'))}`,'_blank');
  };

  downloadReg2.onclick=e=>{
    e.preventDefault();
    const {jsPDF}=window.jspdf,doc=new jsPDF('landscape');
    doc.setFontSize(16);doc.text('Monthly Attendance Register',10,10);
    doc.setFontSize(12);
    doc.text(`Month: ${registerMonth.value}`,10,20);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`,10,26);
    doc.text(`School: ${schoolIn.value}`,10,32);
    doc.text(`Class: ${classSel.value} | Section: ${secSel.value}`,10,38);
    doc.autoTable({html:'#registerTable',startY:44,styles:{fontSize:6},columnStyles:{0:{cellWidth:10},1:{cellWidth:15},2:{cellWidth:30}}});
    doc.autoTable({html:'#registerSummarySection table',startY:doc.lastAutoTable.finalY+10,styles:{fontSize:8}});
    doc.save('attendance_register.pdf');
  };

  // --- 6. SERVICE WORKER -------------------------------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('SW registered:',reg.scope))
        .catch(err => console.error('SW failed:',err));
    });
  }
});
