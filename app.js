window.addEventListener('DOMContentLoaded', ()=>{
  const $ = id => document.getElementById(id);
  const THRESHOLD = 75;
  const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'var(--orange)', L:'var(--info)' };

  // SETUP
  const schoolIn = $('schoolNameInput'), classSel = $('teacherClassSelect'), secSel = $('teacherSectionSelect');
  const saveSet = $('saveSetup'), formSet = $('setupForm'), dispSet = $('setupDisplay'), txtSet = $('setupText'), editSet = $('editSetup');
  saveSet.onclick = () => {
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };
  editSet.onclick = () => { formSet.classList.remove('hidden'); dispSet.classList.add('hidden'); };
  function loadSetup(){
    const s=localStorage.getItem('schoolName'), c=localStorage.getItem('teacherClass'), e=localStorage.getItem('teacherSection');
    if(s && c && e){
      schoolIn.value=s; classSel.value=c; secSel.value=e;
      txtSet.textContent = `${s} 🏫 | Class: ${c} | Section: ${e}`;
      formSet.classList.add('hidden'); dispSet.classList.remove('hidden');
    }
  }
  loadSetup();

  // STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students')||'[]');
  const inputs = ['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress'].map($);
  const addBtn=$('addStudent'), tblBody=$('studentsBody');
  const selectAll=$('selectAllStudents'), editSelected=$('editSelected'), deleteSelected=$('deleteSelected');
  const saveRegistration=$('saveRegistration'), shareRegistration=$('shareRegistration'), editRegistration=$('editRegistration');
  let registrationSaved = false;
  let inlineEditMode = false;

  function saveStudents(){ localStorage.setItem('students', JSON.stringify(students)); }

  function renderStudents(){
    tblBody.innerHTML='';
    students.forEach((s,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td class="select-col"><input type="checkbox" class="selectStudent" data-index="${i}"></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td><button class="share">Share</button></td>`;
      // share per row
      tr.querySelector('.share').onclick = ()=>{
        const setup = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
        const msg = `${setup}\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
      };
      tblBody.appendChild(tr);
    });
    bindSelection();
  }

  function bindSelection(){
    const boxes = [...document.querySelectorAll('.selectStudent')];
    boxes.forEach(cb=>{
      cb.onchange = ()=>{
        const tr = cb.closest('tr');
        cb.checked ? tr.classList.add('selected') : tr.classList.remove('selected');
        const any = boxes.some(x=>x.checked);
        editSelected.disabled = !any || registrationSaved;
        deleteSelected.disabled = !any || registrationSaved;
      };
    });
    selectAll.onchange = ()=>{ boxes.forEach(cb=>{ cb.checked = selectAll.checked; cb.dispatchEvent(new Event('change')); }); };
  }

  deleteSelected.onclick = ()=>{
    if(!confirm('Delete selected students?')) return;
    [...document.querySelectorAll('.selectStudent:checked')]
      .map(cb=>+cb.dataset.index)
      .sort((a,b)=>b-a)
      .forEach(idx=>students.splice(idx,1));
    saveStudents(); renderStudents(); selectAll.checked=false;
  };

  function onCellBlur(e){
    const td = e.target;
    const tr = td.closest('tr');
    const idx = +tr.querySelector('.selectStudent').dataset.index;
    const ci = Array.from(tr.children).indexOf(td);
    const keys = ['name','adm','parent','contact','occupation','address'];
    if(ci>=1 && ci<=6){
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  }

  editSelected.onclick = ()=>{
    if(registrationSaved) return;
    const selected = [...document.querySelectorAll('.selectStudent:checked')];
    if(!selected.length) return;
    inlineEditMode = !inlineEditMode;
    editSelected.textContent = inlineEditMode ? 'Done Editing' : 'Edit Selected';
    selected.forEach(cb=>{
      const tr = cb.closest('tr');
      [...tr.querySelectorAll('td')].forEach((td,ci)=>{
        if(ci>=1 && ci<=6){
          td.contentEditable = inlineEditMode;
          td.classList.toggle('editing', inlineEditMode);
          if(inlineEditMode) td.addEventListener('blur', onCellBlur);
          else td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  // Save Registration Table
  saveRegistration.onclick = ()=>{
    registrationSaved = true;
    // disable editing controls
    editSelected.disabled = true;
    deleteSelected.disabled = true;
    selectAll.disabled = true;
    saveRegistration.classList.add('hidden');
    // hide checkboxes
    document.querySelectorAll('.select-col').forEach(el=>el.style.display='none');
    // exit inline edit mode
    inlineEditMode = false;
    editSelected.textContent = 'Edit Selected';
    // show share and edit table
    shareRegistration.classList.remove('hidden');
    editRegistration.classList.remove('hidden');
  };

  // Edit Registration Table (undo save)
  editRegistration.onclick = ()=>{
    registrationSaved = false;
    editSelected.disabled = true;
    deleteSelected.disabled = true;
    selectAll.disabled = false;
    saveRegistration.classList.remove('hidden');
    document.querySelectorAll('.select-col').forEach(el=>el.style.display='table-cell');
    shareRegistration.classList.add('hidden');
    editRegistration.classList.add('hidden');
  };

  // Share entire table
  shareRegistration.onclick = ()=>{
    const setup = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s=>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    const msg = `${setup}\n\n${lines}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
  };

  addBtn.onclick = ()=>{
    if(registrationSaved) return;
    const vals = inputs.map(i=>i.value.trim());
    if(!vals[0]||!vals[1]) return alert('Name & Adm# required');
    const [name,adm,parent,contact,occupation,address] = vals;
    students.push({name,adm,parent,contact,occupation,address,roll:Date.now()});
    saveStudents(); renderStudents(); inputs.forEach(i=>i.value='');
  };

  renderStudents();

  // ATTENDANCE MARKING & SUMMARY
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');
  const dateIn=$('dateInput'), loadAtt=$('loadAttendance'), attList=$('attendanceList'), saveAtt=$('saveAttendance');
  const resSec=$('attendance-result'), summaryBody=$('summaryBody'), resetAtt=$('resetAttendance');

  loadAtt.onclick=()=>{
    if(!dateIn.value) return alert('Pick date');
    attList.innerHTML='';
    students.forEach((s,i)=>{
      const nameRow=document.createElement('div'); nameRow.className='attendance-item'; nameRow.textContent=s.name;
      const btnRow=document.createElement('div'); btnRow.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button'); b.className='att-btn'; b.dataset.code=code; b.textContent=code;
        if(attendanceData[dateIn.value]?.[s.roll]===code){ b.style.background=colors[code]; b.style.color='#fff'; }
        b.onclick=()=>{ [...btnRow.children].forEach(x=>{ x.style.background='transparent'; x.style.color='var(--dark)'; }); b.style.background=colors[code]; b.style.color='#fff'; };
        btnRow.append(b);
      });
      attList.append(nameRow, btnRow);
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick=()=>{
    const d=dateIn.value; attendanceData[d]={};
    attList.querySelectorAll('.attendance-actions').forEach((row,i)=>{
      const btn=row.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll]=btn?btn.dataset.code:'Not marked';
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    $('attendance-section').classList.add('hidden'); resSec.classList.remove('hidden'); summaryBody.innerHTML='';
    const setup = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    students.forEach(s=>{
      const st=attendanceData[d][s.roll];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${st}</td><td><button class="send">Send</button></td>`;
      tr.querySelector('.send').onclick=()=>{
        const remark={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[st]||'';
        const msg=`${setup}\nDate: ${d}\nName: ${s.name}\nStatus: ${st}\nRemark: ${remark}`;
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`,'_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  resetAtt.onclick=()=>{ resSec.classList.add('hidden'); $('attendance-section').classList.remove('hidden'); attList.innerHTML=''; saveAtt.classList.add('hidden'); };

  $('shareAttendanceSummary').onclick=()=>{
    const setup = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    const lines=[...summaryBody.querySelectorAll('tr')].map(r=>{
      const n=r.children[0].textContent, st=r.children[1].textContent;
      return `Name: ${n}\nStatus: ${st}`;
    }).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(setup+'\n\n'+lines)}`,'_blank');
  };

  $('downloadAttendanceSummary').onclick=()=>{
    const {jsPDF}=window.jspdf; const doc=new jsPDF('p','pt','a4'); let y=20;
    doc.setFontSize(14);
    const setup=`School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    doc.text(setup,20,y); y+=20;
    doc.setFontSize(12);
    doc.text(`Attendance Summary - ${dateIn.value}`,20,y); y+=20;
    doc.autoTable({html: summaryBody.closest('table'), startY: y, margin:{left:20,right:20}});
    doc.save(`Attendance_Summary_${dateIn.value}.pdf`);
  };

  // ANALYTICS
  const typeSel=$('analyticsType'), aDate=$('analyticsDate'), aMonth=$('analyticsMonth'), semStart=$('semesterStart'), semEnd=$('semesterEnd'), yrStart=$('yearStart');
  const loadAnalytics=$('loadAnalytics'), resetAnalytics=$('resetAnalytics'), instr=$('instructions'), contA=$('analyticsContainer'), graphs=$('graphs');
  const shareAnalytics=$('shareAnalytics'), downloadAnalytics=$('downloadAnalytics');
  const barCtx=$('barChart').getContext('2d'), pieCtx=$('pieChart').getContext('2d');
  let chartBar, chartPie, summaryData=[];

  function toggleInputs(){[aDate,aMonth,semStart,semEnd,yrStart].forEach(el=>el.classList.add('hidden')); const v=typeSel.value;
    if(v==='date') aDate.classList.remove('hidden');
    if(v==='month') aMonth.classList.remove('hidden');
    if(v==='semester'){ semStart.classList.remove('hidden'); semEnd.classList.remove('hidden'); }
    if(v==='year') yrStart.classList.remove('hidden');
  }
  typeSel.onchange=toggleInputs;

  function buildDates(){ const v=typeSel.value, arr=[]; function push(s,e){let c=new Date(s);while(c<=e){arr.push(c.toISOString().slice(0,10));c.setDate(c.getDate()+1);} }
    if(v==='date'){let d=new Date(aDate.value); if(!isNaN(d)) arr.push(d.toISOString().slice(0,10));}
    if(v==='month'){let [y,m]=aMonth.value.split('-'); push(new Date(y,m-1,1), new Date(y,m,0));}
    if(v==='semester'){let [ys,ms]=semStart.value.split('-'), [ye,me]=semEnd.value.split('-'); push(new Date(ys,ms-1,1), new Date(ye,me,0));}
    if(v==='year'){let y=+yrStart.value; push(new Date(y,0,1), new Date(y,11,31));}
    return arr; }

  loadAnalytics.onclick=()=>{
    const dates=buildDates(); if(!dates.length) return alert('Select period');
    resetAnalytics.classList.remove('hidden'); instr.classList.remove('hidden'); contA.classList.remove('hidden'); graphs.classList.remove('hidden');
    instr.innerHTML=`<h3>Instructions</h3><p>Attendance % = (P+Lt+HD)/TotalDays ×100</p><p>Threshold: ${THRESHOLD}%</p>`;
    const dataA=JSON.parse(localStorage.getItem('attendanceData')||'{}');
    const summary=students.map(s=>{const cnt={P:0,A:0,Lt:0,HD:0,L:0};dates.forEach(d=>{const st=(dataA[d]||{})[s.roll]||'';if(st)cnt[st]++;});const total=dates.length;const pct=Math.round((cnt.P+cnt.Lt+cnt.HD)/total*100);return {name:s.name,...cnt,total,pct};});
    summaryData=summary;
    contA.innerHTML=''; const tbl=document.createElement('table'); tbl.border=1; tbl.style.width='100%'; tbl.innerHTML=`<tr><th>Name</th><th>P</th><th>Lt</th><th>HD</th><th>L</th><th>A</th><th>Total</th><th>%</th><th>Elig</th></tr>`+summary.map(r=>`<tr><td>${r.name}</td><td>${r.P}</td><td>${r.Lt}</td><td>${r.HD}</td><td>${r.L}</td><td>${r.A}</td><td>${r.total}</td><td>${r.pct}%</td><td>${r.pct>=THRESHOLD?'✓':'✗'}</td></tr>`).join(''); contA.appendChild(tbl);
    if(chartBar)chartBar.destroy();chartBar=new Chart(barCtx,{type:'bar',data:{labels:summary.map(r=>r.name),datasets:[{label:'%',data:summary.map(r=>r.pct)}]},options:{responsive:true}});
    if(chartPie)chartPie.destroy();chartPie=new Chart(pieCtx,{type:'pie',data:{labels:summary.map(r=>r.name),datasets:[{data:summary.map(r=>r.pct)}]},options:{responsive:true}});
    $('analyticsActions').classList.remove('hidden');
  };

  resetAnalytics.onclick=()=>{typeSel.value='';toggleInputs();resetAnalytics.classList.add('hidden');instr.classList.add('hidden');contA.classList.add('hidden');graphs.classList.add('hidden');$('analyticsActions').classList.add('hidden');};

  shareAnalytics.onclick=()=>{
    if(!summaryData.length) return alert('No data to share');
    const setup=`School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    const txt=summaryData.map(r=>`Name: ${r.name}\nPresent: ${r.P}\nLate: ${r.Lt}\nHalfDay: ${r.HD}\nAbsent: ${r.A}\nLeave: ${r.L}\nTotal: ${r.total}\n%: ${r.pct}%\nElig: ${r.pct>=THRESHOLD?'Yes':'No'}`).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(setup+'\n\n'+txt)}`,'_blank');
  };

  downloadAnalytics.onclick=()=>{
    const {jsPDF}=window.jspdf; const doc=new jsPDF('p','pt','a4'); let y=20;
    doc.setFontSize(14);
    const setup=`School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    doc.text(setup,20,y); y+=20;
    doc.setFontSize(12); doc.text('Attendance Analytics',20,y); y+=20;
    doc.autoTable({html:contA.querySelector('table'),startY:y,margin:{left:20,right:20}});
    y=doc.lastAutoTable.finalY+20; doc.text('Bar Chart',20,y); y+=10; doc.addImage($('barChart').toDataURL(),'PNG',20,y,550,200); y+=210;
    doc.text('Pie Chart',20,y); y+=10; doc.addImage($('pieChart').toDataURL(),'PNG',20,y,300,200);
    doc.save('Attendance_Analytics.pdf');
  };
});
