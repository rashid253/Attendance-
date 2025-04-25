// app.js
window.addEventListener('DOMContentLoaded', async () => {
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // --- SETUP ---
  const schoolIn    = $('schoolNameInput');
  const classSel    = $('teacherClassSelect');
  const secSel      = $('teacherSectionSelect');
  const saveSetup   = $('saveSetup');
  const setupForm   = $('setupForm');
  const setupDisplay= $('setupDisplay');
  const setupText   = $('setupText');
  const editSetup   = $('editSetup');

  async function loadSetup() {
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value   = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
      renderStudents();
    }
  }
  saveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolIn.value||!classSel.value||!secSel.value) return alert('Complete setup');
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

  // --- HELPERS ---
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};

  function saveStudents()       { return set('students', students); }
  function saveAttendanceData(){ return set('attendanceData', attendanceData); }

  function getCurrentClassSection() {
    return { cls: classSel.value, sec: secSel.value };
  }
  function filteredStudents() {
    const { cls, sec } = getCurrentClassSection();
    return students.filter(s=>s.cls===cls&&s.sec===sec);
  }

  // --- STUDENT REGISTRATION ---
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
    document.querySelectorAll('.sel').forEach(cb=>{
      cb.onchange=()=>{
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any=[...document.querySelectorAll('.sel')].some(x=>x.checked);
        editSelBtn.disabled=deleteSelBtn.disabled=!any;
      };
    });
    selectAllCb.disabled=regSaved;
    selectAllCb.onchange=()=>document.querySelectorAll('.sel').forEach(cb=>{
      cb.checked=selectAllCb.checked;cb.dispatchEvent(new Event('change'));
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
        tr.querySelector('.share-one').onclick=e=>{
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
    if(!/^\d+$/.test(adm)) return alert('Adm# numeric');
    if(!/^\d{7,15}$/.test(contact)) return alert('Contact 7–15 digits');
    if(students.some(s=>s.adm===adm&&s.cls===classSel.value&&s.sec===secSel.value))
      return alert('Duplicate in this class/section');
    students.push({name,adm,parent,contact,occupation:occ,address:addr,roll:Date.now(),cls:classSel.value,sec:secSel.value});
    await saveStudents();renderStudents();
    [studentNameIn,admissionNoIn,parentNameIn,parentContactIn,parentOccIn,parentAddrIn].forEach(i=>i.value='');
  };

  function onCellBlur(e){
    const td=e.target,tr=td.closest('tr'),
          idx=+tr.querySelector('.sel').dataset.index,
          keys=['name','adm','parent','contact','occupation','address'],
          ci=[...tr.children].indexOf(td),
          val=td.textContent.trim(),
          list=filteredStudents(),stu=list[idx];
    if(ci===2&&!/^\d+$/.test(val)){alert('Adm# numeric');renderStudents();return;}
    if(ci===2&&students.some(s=>s.adm===val&&s.roll!==stu.roll)){alert('Dup Adm#');renderStudents();return;}
    if(ci>=1&&ci<=6){stu[keys[ci-1]]=val;students=students.map(s=>s.roll===stu.roll?stu:s);saveStudents();}
  }

  editSelBtn.onclick=e=>{
    e.preventDefault();
    const sel=[...document.querySelectorAll('.sel:checked')];
    if(!sel.length)return;
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
    if(!confirm('Delete?'))return;
    const rolls=[...document.querySelectorAll('.sel:checked')].map(cb=>filteredStudents()[+cb.dataset.index].roll);
    students=students.filter(s=>!rolls.includes(s.roll));
    await saveStudents();renderStudents();
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
    doc.autoTable({head:[['Name','Adm#','Parent','Contact','Occupation','Address']],body:filteredStudents().map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),startY:44});
    doc.save('student_registration.pdf');
  };

  renderStudents();

  // --- ATTENDANCE MARKING ---
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
    const d=dateInput2.value;if(!d)return alert('Pick date');
    attList.innerHTML='';
    filteredStudents().forEach(s=>{
      const row=document.createElement('div');row.className='attendance-item';row.textContent=s.name;
      const actions=document.createElement('div');actions.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button');b.type='button';b.textContent=code;b.dataset.code=code;
        if(attendanceData[d]?.[s.roll]===code){b.style.background=colors[code];b.style.color='#fff';}
        b.onclick=e2=>{e2.preventDefault();actions.querySelectorAll('button').forEach(x=>{x.style.background='';x.style.color='#333'});b.style.background=colors[code];b.style.color='#fff';};
        actions.appendChild(b);
      });
      attList.append(row);attList.append(actions);
      // ← force flex:
      actions.style.display='flex';
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick=async e=>{
    e.preventDefault();
    const d=dateInput2.value;attendanceData[d]={};
    document.querySelectorAll('.attendance-actions').forEach((actions,i)=>{const sel=actions.querySelector('button[style*="background"]');attendanceData[d][filteredStudents()[i].roll]=sel?.dataset.code||'A';});
    await saveAttendanceData();
    $('attendance-section').classList.add('hidden');attResult.classList.remove('hidden');
    sumBody.innerHTML='';const hdr=`Date: ${d}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    sumBody.insertAdjacentHTML('beforebegin',`<tr><td colspan="3"><em>${hdr}</em></td></tr>`);
    filteredStudents().forEach(s=>{const code=attendanceData[d][s.roll]||'A',status={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code],tr=document.createElement('tr');tr.innerHTML=`<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;tr.querySelector('.send-btn').onclick=e2=>{e2.preventDefault();window.open(`https://wa.me/?text=${encodeURIComponent(hdr+`\n\nName: ${s.name}\nStatus: ${status}`)}`,'_blank');};sumBody.appendChild(tr);});
  };

  resetAtt.onclick=_=>{attResult.classList.add('hidden');$('attendance-section').classList.remove('hidden');attList.innerHTML='';saveAtt.classList.add('hidden');sumBody.innerHTML='';};

  shareAtt.onclick=_=>{const d=dateInput2.value,hdr=`Date: ${d}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`,lines=filteredStudents().map(s=>`${s.name}: ${ {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[attendanceData[d]?.[s.roll]||'A'] }`),total=filteredStudents().length,pres=filteredStudents().reduce((a,s)=>a+(attendanceData[d]?.[s.roll]==='P'?1:0),0),pct=total?((pres/total)*100).toFixed(1):'0.0',remark=pct==100?'Best':pct>=75?'Good':pct>=50?'Fair':'Poor',msg=[hdr,'',...lines,'',`Overall Attendance: ${pct}% | ${remark}`].join('\n');window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');};

  dlAtt.onclick=e=>{e.preventDefault();const {jsPDF}=window.jspdf,doc=new jsPDF();doc.setFontSize(16);doc.text('Daily Attendance',10,10);doc.setFontSize(12);const d=dateInput2.value,dateStr=new Date(d).toLocaleDateString();doc.text(`Date: ${dateStr}`,10,20);doc.text(`School: ${schoolIn.value}`,10,26);doc.text(`Class: ${classSel.value}`,10,32);doc.text(`Section: ${secSel.value}`,10,38);doc.autoTable({head:[['Name','Status']],body:filteredStudents().map(s=>{const code=attendanceData[d]?.[s.roll]||'A';return [s.name,{P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]];}),startY:44});doc.save('attendance_summary.pdf');};

  // --- ANALYTICS & REGISTER follow above patterns ---
  // pie+bar re-show:
  const graphsEl = $('graphs');
  const analyticsActionsEl = $('analyticsActions');
  graphsEl.style.display = 'flex';
  analyticsActionsEl.style.display = 'flex';

  // --- SERVICE WORKER ---
  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('service-worker.js')
        .then(reg=>console.log('SW registered:',reg.scope))
        .catch(err=>console.error('SW failed:',err));
    });
  }
});
