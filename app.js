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
        `<td class="select-col"><input type="checkbox" class="selectStudent" data-index="${i}" ${registrationSaved?'disabled': ''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${registrationSaved?'<button class="share">Share</button>':''}</td>`;
      if(registrationSaved){
        tr.querySelector('.share').onclick = ()=>{
          const setup = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
          const msg = `${setup}\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
        };
      }
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
    selectAll.disabled = registrationSaved;
    selectAll.onchange = ()=>{ if(!registrationSaved) boxes.forEach(cb=>{ cb.checked = selectAll.checked; cb.dispatchEvent(new Event('change')); }); };
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
    editSelected.style.display = 'none';
    deleteSelected.style.display = 'none';
    selectAll.style.display = 'none';
    saveRegistration.style.display = 'none';
    document.querySelectorAll('.select-col').forEach(el=>el.style.display='none');
    shareRegistration.classList.remove('hidden');
    editRegistration.classList.remove('hidden');
    renderStudents();
  };

  // Edit Registration Table (undo save)
  editRegistration.onclick = ()=>{
    registrationSaved = false;
    editSelected.style.display = '';
    deleteSelected.style.display = '';
    selectAll.style.display = '';
    saveRegistration.style.display = '';
    document.querySelectorAll('.select-col').forEach(el=>el.style.display='table-cell');
    shareRegistration.classList.add('hidden');
    editRegistration.classList.add('hidden');
    renderStudents();
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
    summaryBody.insertAdjacentHTML('beforebegin', `<tr><td colspan="3"><em>${setup} | Date: ${d}</em></td></tr>`);
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

  resetAtt.onclick=()=>{ resSec.classList.add('hidden'); $('attendance-section').classList.remove('hidden'); attList.innerHTML=''; saveAtt.classList.add('hidden'); summaryBody.innerHTML=''; };

  $('shareAttendanceSummary').onclick=()=>{
    const setup=`School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    const lines=[...summaryBody.querySelectorAll('tr')]...
