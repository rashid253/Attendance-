// app.js
window.addEventListener('DOMContentLoaded', async () => {
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);

  let classes = [];                // list of class keys
  let currentClassKey = null;      // "School|Class|Section"
  let students = [];               // current class’s students
  let attendanceData = {};         // current class’s attendance

  // --- Multi-class support ---
  async function getClasses() {
    return await get('classes') || [];
  }
  async function saveClasses(key) {
    classes = await getClasses();
    if (!classes.includes(key)) {
      classes.push(key);
      await set('classes', classes);
    }
  }
  async function populateClassSwitcher() {
    classes = await getClasses();
    const sw = $('classSwitcher');
    sw.innerHTML = '';
    classes.forEach(key => {
      const [school, cls, sec] = key.split('|');
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${school} | ${cls}-${sec}`;
      sw.appendChild(opt);
    });
    if (!currentClassKey && classes.length) {
      currentClassKey = classes[0];
    }
    if (currentClassKey) sw.value = currentClassKey;
  }
  async function loadClassData(key) {
    // display setup summary
    const [school, cls, sec] = key.split('|');
    $('schoolNameInput').value = school;
    $('teacherClassSelect').value = cls;
    $('teacherSectionSelect').value = sec;
    $('setupText').textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
    $('setupForm').classList.add('hidden');
    $('setupDisplay').classList.remove('hidden');

    // load students & attendance
    students = await get(`students-${key}`) || [];
    attendanceData = await get(`attendanceData-${key}`) || {};
    renderStudents();
  }
  async function saveSetupData() {
    const school = $('schoolNameInput').value;
    const cls    = $('teacherClassSelect').value;
    const sec    = $('teacherSectionSelect').value;
    const key = `${school}|${cls}|${sec}`;
    await saveClasses(key);
    currentClassKey = key;
    // initialize empty stores if first time
    await set(`students-${key}`, students);
    await set(`attendanceData-${key}`, attendanceData);
    await populateClassSwitcher();
  }

  // --- Setup section ---
  $('newSetup').onclick = () => {
    $('setupForm').classList.remove('hidden');
    $('setupDisplay').classList.add('hidden');
  };
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    if (!$('schoolNameInput').value || !$('teacherClassSelect').value || !$('teacherSectionSelect').value) {
      return alert('Complete setup');
    }
    await saveSetupData();
    await loadClassData(currentClassKey);
  };
  $('editSetup').onclick = e => {
    e.preventDefault();
    $('setupForm').classList.remove('hidden');
    $('setupDisplay').classList.add('hidden');
  };
  $('classSwitcher').onchange = async e => {
    currentClassKey = e.target.value;
    await loadClassData(currentClassKey);
  };

  // --- STUDENT REGISTRATION ---
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
  let regSaved = false, inlineEdit = false;

  async function saveStudents() {
    await set(`students-${currentClassKey}`, students);
  }

  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved ? 'disabled' : ''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved ? '<button class="share-one">Share</button>' : ''}</td>`;
      if (regSaved) {
        tr.querySelector('.share-one').onclick = ev => {
          ev.preventDefault();
          const hdr = `School: ${$('schoolNameInput').value}\nClass: ${$('teacherClassSelect').value}\nSection: ${$('teacherSectionSelect').value}`;
          const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }

  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelBtn.disabled = deleteSelBtn.disabled = !any;
      };
    });
    selectAll.disabled = regSaved;
    selectAll.onchange = () => {
      if (!regSaved) boxes.forEach(cb => {
        cb.checked = selectAll.checked;
        cb.dispatchEvent(new Event('change'));
      });
    };
  }

  function onCellBlur(e) {
    const td = e.target, tr = td.closest('tr');
    const idx = +tr.querySelector('.sel').dataset.index;
    const ci  = Array.from(tr.children).indexOf(td);
    const keys = ['name','adm','parent','contact','occupation','address'];
    const val = td.textContent.trim();
    if (ci === 2) {
      if (!/^\d+$/.test(val)) { alert('Adm# must be numeric'); renderStudents(); return; }
      if (students.some((s,i2) => s.adm===val && i2!==idx)) { alert('Duplicate Adm# not allowed'); renderStudents(); return; }
    }
    if (ci>=1 && ci<=6) {
      students[idx][keys[ci-1]] = val;
      saveStudents();
    }
  }

  editSelBtn.onclick = ev => {
    ev.preventDefault();
    const sel = Array.from(document.querySelectorAll('.sel:checked'));
    if (!sel.length) return;
    inlineEdit = !inlineEdit;
    editSelBtn.textContent = inlineEdit ? 'Done Editing' : 'Edit Selected';
    sel.forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td,ci) => {
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit ? td.addEventListener('blur', onCellBlur) : td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  deleteSelBtn.onclick = async ev => {
    ev.preventDefault();
    if (!confirm('Delete selected?')) return;
    Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb => +cb.dataset.index)
      .sort((a,b)=>b-a)
      .forEach(i=>students.splice(i,1));
    await saveStudents();
    renderStudents();
    selectAll.checked = false;
  };

  saveRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegBtn.classList.remove('hidden');
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  editRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegBtn.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick = ev => {
    ev.preventDefault();
    const hdr = `School: ${$('schoolNameInput').value}\nClass: ${$('teacherClassSelect').value}\nSection: ${$('teacherSectionSelect').value}`;
    const lines = students.map(s =>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines)}`, '_blank');
  };

  downloadRegBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Student Registration', 10, 10);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`,10,20);
    doc.text(`School: ${$('schoolNameInput').value}`,10,26);
    doc.text(`Class: ${$('teacherClassSelect').value}`,10,32);
    doc.text(`Section: ${$('teacherSectionSelect').value}`,10,38);
    doc.autoTable({
      head:[['Name','Adm#','Parent','Contact','Occupation','Address']],
      body:students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY:44
    });
    alert('PDF generation complete. Starting download...');
    doc.save('student_registration.pdf');
  };

  // 3. ATTENDANCE MARKING
  const dateInput      = $('dateInput');
  const loadAtt        = $('loadAttendance');
  const attList        = $('attendanceList');
  const saveAtt        = $('saveAttendance');
  const resultSection  = $('attendance-result');
  const summaryBody    = $('summaryBody');
  const resetAtt       = $('resetAttendance');
  const shareAtt       = $('shareAttendanceSummary');
  const downloadAttPDF = $('downloadAttendancePDF');
  const colors         = { P:'#4CAF50',A:'#f44336',Lt:'#FFEB3B',HD:'#FF9800',L:'#03a9f4' };

  loadAtt.onclick = ev => {
    ev.preventDefault();
    if (!dateInput.value) return alert('Pick a date');
    attList.innerHTML = '';
    students.forEach(s=>{
      const row = document.createElement('div');
      row.className='attendance-item';
      row.textContent=s.name;
      const btns=document.createElement('div');
      btns.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button');
        b.type='button'; b.className='att-btn'; b.dataset.code=code; b.textContent=code;
        if(attendanceData[dateInput.value]?.[s.roll]===code){
          b.style.background=colors[code]; b.style.color='#fff';
        }
        b.onclick=e2=>{
          e2.preventDefault();
          btns.querySelectorAll('.att-btn').forEach(x=>{ x.style.background=''; x.style.color='#333'; });
          b.style.background=colors[code]; b.style.color='#fff';
        };
        btns.append(b);
      });
      attList.append(row,btns);
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick = async ev => {
    ev.preventDefault();
    const d = dateInput.value;
    attendanceData[d] = {};
    attList.querySelectorAll('.attendance-actions').forEach((btns,i)=>{
      const sel = btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll] = sel ? sel.dataset.code : 'A';
    });
    await set(`attendanceData-${currentClassKey}`, attendanceData);
    $('attendance-section').classList.add('hidden');
    resultSection.classList.remove('hidden');
    summaryBody.innerHTML = '';
    const hdr = `Date: ${d}\nSchool: ${$('schoolNameInput').value}\nClass: ${$('teacherClassSelect').value}\nSection: ${$('teacherSectionSelect').value}`;
    summaryBody.insertAdjacentHTML('beforebegin', `<tr><td colspan="3"><em>${hdr}</em></td></tr>`);
    students.forEach(s=>{
      const code = attendanceData[d][s.roll]||'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick = e2=>{
        e2.preventDefault();
        const msg = `${hdr}\n\nName: ${s.name}\nStatus: ${status}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  resetAtt.onclick = ev=>{
    ev.preventDefault();
    resultSection.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    attList.innerHTML=''; saveAtt.classList.add('hidden'); summaryBody.innerHTML='';
  };

  shareAtt.onclick = ev=>{
    ev.preventDefault();
    const d = dateInput.value;
    const hdr = `Date: ${d}\nSchool: ${$('schoolNameInput').value}\nClass: ${$('teacherClassSelect').value}\nSection: ${$('teacherSectionSelect').value}`;
    const lines = students.map(s=>{
      const code = attendanceData[d][s.roll]||'A';
      return `${s.name}: ${ {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code] }`;
    });
    const total = students.length;
    const pres = students.reduce((sum,s)=>(sum+(attendanceData[d][s.roll]==='P'?1:0)),0);
    const pct = total?((pres/total)*100).toFixed(1):'0.0';
    const remark = pct==100?'Best':pct>=75?'Good':pct>=50?'Fair':'Poor';
    const summary = `Overall Attendance: ${pct}% | ${remark}`;
    window.open(`https://wa.me/?text=${encodeURIComponent([hdr,'',...lines,'',summary].join('\n'))}`, '_blank');
  };

  downloadAttPDF.onclick = ev=>{
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Daily Attendance Report',10,10);
    doc.setFontSize(12);
    const f = new Date(dateInput.value).toLocaleDateString();
    doc.text(`Date: ${f}`,10,20);
    doc.text(`School: ${$('schoolNameInput').value}`,10,26);
    doc.text(`Class: ${$('teacherClassSelect').value}`,10,32);
    doc.text(`Section: ${$('teacherSectionSelect').value}`,10,38);
    doc.autoTable({
      head:[['Name','Status']],
      body: students.map(s=>{
        const code = attendanceData[dateInput.value]?.[s.roll]||'A';
        const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
        return [s.name,status];
      }),
      startY:44
    });
    alert('PDF generation complete. Starting download...');
    doc.save('attendance_summary.pdf');
  };

  // 4. ANALYTICS and 5. REGISTER remain unchanged…

  // initialize
  await populateClassSwitcher();
  if (classes.length) {
    currentClassKey = classes[0];
    await loadClassData(currentClassKey);
  } else {
    $('setupForm').classList.remove('hidden');
  }
});
