// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // idb-keyval is now available globally
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);
  const colors = { P: '#4CAF50', A: '#f44336', Lt: '#FFEB3B', HD: '#FF9800', L: '#03a9f4' };

  // 0. Load data before any functions run
  let students = await get('students') || [];
  let attendanceData = await get('attendanceData') || {};
  let regSaved = false, inlineEdit = false;

  // 1. SETUP
  const schoolIn       = $('schoolNameInput');
  const classSel       = $('teacherClassSelect');
  const secSel         = $('teacherSectionSelect');
  const saveSetup      = $('saveSetup');
  const setupForm      = $('setupForm');
  const setupDisplay   = $('setupDisplay');
  const setupText      = $('setupText');
  const editSetup      = $('editSetup');

  async function loadSetup() {
    const school = await get('schoolName');
    const cls    = await get('teacherClass');
    const sec    = await get('teacherSection');
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
    if (!schoolIn.value || !classSel.value || !secSel.value)
      return alert('Complete setup');
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

  // Helper: current class/section
  function getCurrentClassSection() {
    return { cls: classSel.value, sec: secSel.value };
  }
  function filteredStudents() {
    const { cls, sec } = getCurrentClassSection();
    return students.filter(s => s.cls === cls && s.sec === sec);
  }
  async function saveAllStudents() {
    await set('students', students);
  }

  // 2. STUDENT REGISTRATION
  const studentNameIn    = $('studentName');
  const admissionNoIn    = $('admissionNo');
  const parentNameIn     = $('parentName');
  const parentContactIn  = $('parentContact');
  const parentOccIn      = $('parentOccupation');
  const parentAddrIn     = $('parentAddress');
  const addStudentBtn    = $('addStudent');
  const studentsBody     = $('studentsBody');
  const selectAll        = $('selectAllStudents');
  const editSelBtn       = $('editSelected');
  const deleteSelBtn     = $('deleteSelected');
  const saveRegBtn       = $('saveRegistration');
  const shareRegBtn      = $('shareRegistration');
  const editRegBtn       = $('editRegistration');
  const downloadRegBtn   = $('downloadRegistrationPDF');

  function bindSelection() {
    const boxes = Array.from(studentsBody.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelBtn.disabled = deleteSelBtn.disabled = !any;
      };
    });
    selectAll.disabled = regSaved;
    selectAll.onchange = () => boxes.forEach(cb => {
      cb.checked = selectAll.checked;
      cb.dispatchEvent(new Event('change'));
    });
  }

  function renderStudents() {
    const list = filteredStudents();
    studentsBody.innerHTML = '';
    list.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved?'disabled':''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved?'<button class="share-one">Share</button>':''}</td>`;
      if (regSaved) {
        const btn = tr.querySelector('.share-one');
        if (btn) btn.onclick = ev => {
          ev.preventDefault();
          const hdr = `School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
          const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }

  addStudentBtn.onclick = async ev => {
    ev.preventDefault();
    const name    = studentNameIn.value.trim();
    const adm     = admissionNoIn.value.trim();
    const parent  = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occ     = parentOccIn.value.trim();
    const addr    = parentAddrIn.value.trim();
    if (!name||!adm||!parent||!contact||!occ||!addr)
      return alert('All fields required');
    if (!/^\d+$/.test(adm)) return alert('Adm# must be numeric');
    if (!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits');
    const { cls, sec } = getCurrentClassSection();
    if (students.some(s=>s.adm===adm && s.cls===cls && s.sec===sec))
      return alert('Admission# exists in this class/section');
    students.push({ name, adm, parent, contact, occupation: occ, address: addr, roll: Date.now(), cls, sec });
    await saveAllStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn]
      .forEach(i=>i.value='');
  };

  function onCellBlur(e) {
    const td = e.target, tr = td.closest('tr');
    const idx = +tr.querySelector('.sel').dataset.index;
    const keys = ['name','adm','parent','contact','occupation','address'];
    const ci  = Array.from(tr.children).indexOf(td);
    const val = td.textContent.trim();
    const stu = filteredStudents()[idx];
    if (ci===2 && !/^\d+$/.test(val)) { alert('Adm# must be numeric'); renderStudents(); return; }
    if (ci===2 && students.some(s=>s.adm===val && s.roll!==stu.roll)) { alert('Duplicate Adm#'); renderStudents(); return; }
    if (ci>=1&&ci<=6) {
      stu[keys[ci-1]] = val;
      students = students.map(s=>s.roll===stu.roll?stu:s);
      saveAllStudents();
    }
  }

  editSelBtn.onclick = ev => {
    ev.preventDefault();
    const sel = Array.from(document.querySelectorAll('.sel:checked'));
    if (!sel.length) return;
    inlineEdit = !inlineEdit;
    editSelBtn.textContent = inlineEdit?'Done Editing':'Edit Selected';
    sel.forEach(cb=> {
      cb.closest('tr').querySelectorAll('td').forEach((td,ci)=>{
        if (ci>=1&&ci<=6) {
          td.contentEditable=inlineEdit;
          td.classList.toggle('editing',inlineEdit);
          inlineEdit?td.addEventListener('blur',onCellBlur):td.removeEventListener('blur',onCellBlur);
        }
      });
    });
  };

  deleteSelBtn.onclick = async ev => {
    ev.preventDefault();
    if (!confirm('Delete selected?')) return;
    const rolls = Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb=>filteredStudents()[+cb.dataset.index].roll);
    students = students.filter(s=>!rolls.includes(s.roll));
    await saveAllStudents();
    renderStudents();
  };

  saveRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id=>$(id).classList.remove('hidden'));
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  editRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id=>$(id).classList.add('hidden'));
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick = ev => {
    ev.preventDefault();
    const hdr=`School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines=filteredStudents().map(s=>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`,'_blank');
  };

  downloadRegBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Student Registration',10,10);
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
    alert('PDF done, downloading...');
    doc.save('student_registration.pdf');
  };

  renderStudents();

  // 3. ATTENDANCE MARKING
  const loadAttendanceBtn = loadAttBtn;
  loadAttendanceBtn.onclick = ev => {
    ev.preventDefault();
    const date = dateInput.value; if(!date) return alert('Pick a date');
    attList.innerHTML='';
    filteredStudents().forEach(s=>{
      const row=document.createElement('div'); row.className='attendance-item'; row.textContent=s.name;
      const actions=document.createElement('div'); actions.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button'); b.type='button'; b.textContent=code; b.dataset.code=code;
        if(attendanceData[date]?.[s.roll]===code){b.style.background=colors[code];b.style.color='#fff';}
        b.onclick=e2=>{e2.preventDefault();actions.querySelectorAll('button').forEach(x=>{x.style.background='';x.style.color='#333'});b.style.background=colors[code];b.style.color='#fff';};
        actions.appendChild(b);
      });
      attList.append(row);attList.append(actions);
    });
    saveAttBtn.classList.remove('hidden');
  };

  saveAttBtn.onclick = async ev=>{
    ev.preventDefault();
    const date=dateInput.value;
    attendanceData[date]={};
    document.querySelectorAll('.attendance-actions').forEach((actions,i)=>{
      const sel=actions.querySelector('button[style*="background"]');
      attendanceData[date][filteredStudents()[i].roll]=sel?.dataset.code||'A';
    });
    await set('attendanceData',attendanceData);
    $('attendance-section').classList.add('hidden');
    resultSection.classList.remove('hidden');
    summaryBody.innerHTML=`<tr><td colspan="3"><em>Date: ${date}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}</em></td></tr>`;
    filteredStudents().forEach(s=>{
      const code=attendanceData[date][s.roll]||'A';
      const status={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      const btn=tr.querySelector('.send-btn');
      if(btn) btn.onclick=e2=>{e2.preventDefault();window.open(`https://wa.me/?text=${encodeURIComponent(`Date: ${date}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}\n\nName: ${s.name}\nStatus: ${status}`)}`,'_blank');};
      summaryBody.appendChild(tr);
    });
  };

  resetAttBtn.onclick=_=>{
    resultSection.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    attList.innerHTML='';
    saveAttBtn.classList.add('hidden');
    summaryBody.innerHTML='';
  };

  shareAttBtn.onclick=_=>{
    const date=dateInput.value;
    const hdr=`Date: ${date}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines=filteredStudents().map(s=>`${s.name}: ${ {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[attendanceData[date]?.[s.roll]||'A'] }`);
    const total=filteredStudents().length;
    const pres=filteredStudents().reduce((sum,s)=>sum+(attendanceData[date]?.[s.roll]==='P'?1:0),0);
    const pct=total?((pres/total)*100).toFixed(1):'0.0';
    const remark=pct==100?'Best':pct>=75?'Good':pct>=50?'Fair':'Poor';
    const msg=[hdr,'',...lines,'',`Overall Attendance: ${pct}% | ${remark}`].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
  };

  downloadAttBtn.onclick=ev=>{
    ev.preventDefault();
    const { jsPDF }=window.jspdf;
    const doc=new jsPDF();
    doc.setFontSize(16);doc.text('Daily Attendance Report',10,10);
    doc.setFontSize(12);
    const dateStr=new Date(dateInput.value).toLocaleDateString();
    doc.text(`Date: ${dateStr}`,10,20);
    doc.text(`School: ${schoolIn.value}`,10,26);
    doc.text(`Class: ${classSel.value}`,10,32);
    doc.text(`Section: ${secSel.value}`,10,38);
    doc.autoTable({
      head:[['Name','Status']],
      body:filteredStudents().map(s=>{const code=attendanceData[dateInput.value]?.[s.roll]||'A';return [s.name,{P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]];}),
      startY:44
    });
    alert('PDF done');doc.save('attendance_summary.pdf');
  };

  // 4. ANALYTICS
  // ... implement using filteredStudents() in place of students ...

  // 5. REGISTER
  // ... implement using filteredStudents() in place of students ...

  // 6. Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('SW registered',reg.scope))
        .catch(err => console.error('SW failed',err));
    });
  }
});
