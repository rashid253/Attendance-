// app.js
// Core attendance management logic – no UI changes required here, just selecting by ID and updating counts
window.addEventListener('DOMContentLoaded', async () => {
  // --- STORAGE & HELPERS ---
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);

  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};

  async function saveStudents() {
    await set('students', students);
  }
  async function saveAttendanceData() {
    await set('attendanceData', attendanceData);
  }

  function getCurrentClassSection() {
    return {
      cls: $('teacherClassSelect').value,
      sec: $('teacherSectionSelect').value
    };
  }
  function filteredStudents() {
    const { cls, sec } = getCurrentClassSection();
    return students.filter(s => s.cls === cls && s.sec === sec);
  }

  function updateTotals() {
    const totalSchool = students.length;
    const { cls, sec } = getCurrentClassSection();
    const totalClass   = students.filter(s => s.cls === cls).length;
    const totalSection = filteredStudents().length;
    $('totalSchoolCount').textContent  = totalSchool;
    $('totalClassCount').textContent   = totalClass;
    $('totalSectionCount').textContent = totalSection;
  }

  // --- DOM ELEMENTS ---
  // Setup
  const schoolInput    = $('schoolNameInput');
  const classSelect    = $('teacherClassSelect');
  const sectionSelect  = $('teacherSectionSelect');
  const btnSaveSetup   = $('saveSetup');
  const setupForm      = $('setupForm');
  const setupDisplay   = $('setupDisplay');
  const setupText      = $('setupText');
  const btnEditSetup   = $('editSetup');

  // Registration
  const nameInput      = $('studentName');
  const admInput       = $('admissionNo');
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

  // Attendance Marking
  const dateInput      = $('dateInput');
  const btnLoadAtt     = $('loadAttendance');
  const divAttList     = $('attendanceList');
  const btnSaveAtt     = $('saveAttendance');
  const sectionResult  = $('attendance-result');
  const tbodySummary   = $('summaryBody');

  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // --- SETUP LOGIC ---
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
    }
    updateTotals();
  }
  btnSaveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolInput.value || !classSelect.value || !sectionSelect.value) {
      return alert('Complete setup');
    }
    await set('schoolName', schoolInput.value);
    await set('teacherClass', classSelect.value);
    await set('teacherSection', sectionSelect.value);
    await loadSetup();
  };
  btnEditSetup.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };
  await loadSetup();

  // --- STUDENT REGISTRATION LOGIC ---
  let registrationSaved = false, inlineEditing = false;

  function bindRowSelection() {
    const boxes = Array.from(tbodyStudents.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        btnEditSel.disabled = btnDeleteSel.disabled = !any;
      };
    });
    chkAllStudents.disabled = registrationSaved;
    chkAllStudents.onchange = () => boxes.forEach(cb => {
      cb.checked = chkAllStudents.checked;
      cb.dispatchEvent(new Event('change'));
    });
  }

  function renderStudents() {
    const list = filteredStudents();
    tbodyStudents.innerHTML = '';
    list.forEach((st, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" data-index="${idx}" ${registrationSaved?'disabled':''}></td>
        <td>${idx+1}</td>
        <td>${st.name}</td><td>${st.adm}</td><td>${st.parent}</td>
        <td>${st.contact}</td><td>${st.occupation}</td><td>${st.address}</td>
        <td>${registrationSaved?'<button class="share-one btn btn-link p-0"><i class="fas fa-share-alt"></i></button>':''}</td>
      `;
      if (registrationSaved) {
        tr.querySelector('.share-one').onclick = () => {
          const hdr = `School: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
          const msg = [hdr, `Name: ${st.name}`, `Adm#: ${st.adm}`, `Parent: ${st.parent}`,
                       `Contact: ${st.contact}`, `Occupation: ${st.occupation}`, `Address: ${st.address}`]
                       .join('\n');
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      tbodyStudents.appendChild(tr);
    });
    bindRowSelection();
    updateTotals();
  }

  btnAddStudent.onclick = async e => {
    e.preventDefault();
    const name = nameInput.value.trim(), adm = admInput.value.trim(), par = parentInput.value.trim(),
          cont = contactInput.value.trim(), occ = occInput.value.trim(), addr = addrInput.value.trim();
    if (!name||!adm||!par||!cont||!occ||!addr) return alert('All fields required');
    if (!/^\d+$/.test(adm)) return alert('Adm# must be numeric');
    if (!/^\d{7,15}$/.test(cont)) return alert('Contact must be 7–15 digits');
    if (students.some(s=>s.adm===adm && s.cls===classSelect.value && s.sec===sectionSelect.value))
      return alert('Duplicate Adm# in this class');
    students.push({ name, adm, parent:par, contact:cont, occupation:occ, address:addr,
      roll: Date.now(), cls:classSelect.value, sec:sectionSelect.value });
    await saveStudents(); renderStudents();
    [nameInput, admInput, parentInput, contactInput, occInput, addrInput].forEach(i=>i.value='');
  };

  function handleInlineBlur(e) {
    const td = e.target, tr = td.closest('tr'), idx = +tr.querySelector('.sel').dataset.index;
    const keys=['name','adm','parent','contact','occupation','address'];
    const val = td.textContent.trim(), list = filteredStudents(), stu = list[idx];
    if (td.cellIndex===1 && !/^\d+$/.test(val)) return alert('Adm# numeric'), renderStudents();
    if (td.cellIndex===1 && students.some(s=>s.adm===val && s.roll!==stu.roll)) return alert('Duplicate Adm#'), renderStudents();
    if (td.cellIndex>=2 && td.cellIndex<=7) {
      stu[keys[td.cellIndex-2]] = val;
      students = students.map(s=>s.roll===stu.roll?stu:s);
      saveStudents();
    }
  }

  btnEditSel.onclick = e => {
    e.preventDefault();
    const checked = Array.from(tbodyStudents.querySelectorAll('.sel:checked'));
    if (!checked.length) return;
    inlineEditing = !inlineEditing;
    btnEditSel.textContent = inlineEditing ? 'Done Editing' : 'Edit Selected';
    checked.forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td, ci) => {
        if (ci>=1 && ci<=7) {
          td.contentEditable = inlineEditing;
          td.classList.toggle('editing', inlineEditing);
          inlineEditing ? td.addEventListener('blur', handleInlineBlur) : td.removeEventListener('blur', handleInlineBlur);
        }
      });
    });
  };

  btnDeleteSel.onclick = async e => {
    e.preventDefault(); if (!confirm('Delete selected?')) return;
    const toRemove = Array.from(tbodyStudents.querySelectorAll('.sel:checked')).
      map(cb=>filteredStudents()[+cb.dataset.index].roll);
    students = students.filter(s=>!toRemove.includes(s.roll));
    await saveStudents(); renderStudents();
  };

  btnSaveReg.onclick = e => {
    e.preventDefault(); registrationSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.remove('hidden'));
    $('studentTableWrapper').classList.add('saved'); renderStudents();
  };

  btnEditReg.onclick = e => {
    e.preventDefault(); registrationSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.add('hidden'));
    $('studentTableWrapper').classList.remove('saved'); renderStudents();
  };

  btnShareReg.onclick = e => {
    e.preventDefault();
    const hdr = `School: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
    const lines = filteredStudents().map(s=>`Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`, '_blank');
  };

  btnDownloadReg.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Student Registration',10,10);
    doc.setFontSize(12); doc.text(`Date: ${new Date().toLocaleDateString()}`,10,20);
    doc.text(`School: ${schoolInput.value}`,10,26);
    doc.text(`Class: ${classSelect.value}`,10,32);
    doc.text(`Section: ${sectionSelect.value}`,10,38);
    doc.autoTable({ head:[['Name','Adm#','Parent','Contact','Occupation','Address']],
                   body: filteredStudents().map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]), startY:44 });
    doc.save('student_registration.pdf');
  };

  // --- ATTENDANCE MARKING ---
  btnLoadAtt.onclick = e => {
    e.preventDefault(); const d = dateInput.value; if (!d) return alert('Pick a date');
    divAttList.innerHTML = '';
    filteredStudents().forEach(s=>{
      const row=document.createElement('div'); row.className='attendance-item'; row.textContent=s.name;
      const actions=document.createElement('div'); actions.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button'); b.type='button'; b.textContent=code; b.dataset.code=code;
        if (attendanceData[d]?.[s.roll]===code) { b.style.background=colors[code]; b.style.color='#fff'; }
        b.onclick = e2 => { e2.preventDefault(); actions.querySelectorAll('button').forEach(x=>{x.style.background='';x.style.color='#333'}); b.style.background=colors[code]; b.style.color='#fff'; };
        actions.appendChild(b);
      });
      divAttList.append(row, actions);
    });
    btnSaveAtt.classList.remove('hidden');
  };

  btnSaveAtt.onclick = async e => {
    e.preventDefault(); const d=dateInput.value; attendanceData[d]={};
    document.querySelectorAll('.attendance-actions').forEach((actions,i)=>{
      const sel = actions.querySelector('button[style*="background"]');
      attendanceData[d][filteredStudents()[i].roll] = sel?.dataset.code || 'A';
    });
    await saveAttendanceData();
    sectionResult.classList.remove('hidden'); divAttList.innerHTML=''; btnSaveAtt.classList.add('hidden');
    tbodySummary.innerHTML = `<tr><td colspan="3"><em>Date: ${d}<br>School: ${schoolInput.value}<br>Class: ${classSelect.value}<br>Section: ${sectionSelect.value}</em></td></tr>`;
    filteredStudents().forEach(s=>{
      const code = attendanceData[d][s.roll] || 'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${status}</td><td><button class="btn btn-link p-0 send-btn"><i class="fas fa-paper-plane"></i></button></td>`;
      tr.querySelector('.send-btn').onclick = ()=>{
        const msg=[`Date: ${d}`,`School: ${schoolInput.value}`,`Class: ${classSelect.value}`,
                   `Section: ${sectionSelect.value}`,'',`Name: ${s.name}`,`Status: ${status}`].join('\n');
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      };
      tbodySummary.appendChild(tr);
    });
  };

  // Reset and other sections omitted for brevity (analytics, register)

  // --- SERVICE WORKER ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.error('SW failed:', err));
    });
  }
});
