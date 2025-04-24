// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P: '#4CAF50', A: '#f44336', Lt: '#FFEB3B', HD: '#FF9800', L: '#03a9f4' };

  // 1. SETUP
  const schoolIn = $('schoolNameInput');
  const classSel = $('teacherClassSelect');
  const secSel = $('teacherSectionSelect');
  const saveSetup = $('saveSetup');
  const setupForm = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText = $('setupText');
  const editSetup = $('editSetup');

  function loadSetup() {
    const school = localStorage.getItem('schoolName');
    const cls    = localStorage.getItem('teacherClass');
    const sec    = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value   = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetup.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };

  editSetup.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };

  loadSetup();

  // 2. STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students') || '[]');
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

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
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
          const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
          const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }

  addStudentBtn.onclick = ev => {
    ev.preventDefault();
    const name    = studentNameIn.value.trim();
    const adm     = admissionNoIn.value.trim();
    const parent  = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occ     = parentOccIn.value.trim();
    const addr    = parentAddrIn.value.trim();
    if (!name || !adm || !parent || !contact || !occ || !addr) return alert('All fields required');
    if (!/^\d+$/.test(adm)) return alert('Adm# must be numeric');
    if (students.some(s => s.adm === adm)) return alert(`Admission# ${adm} already exists`);
    if (!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7-15 digits');
    students.push({
      name, adm, parent, contact,
      occupation: occ, address: addr,
      roll: Date.now()
    });
    saveStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn].forEach(i => i.value = '');
  };

  function onCellBlur(e) {
    const td = e.target, tr = td.closest('tr');
    const idx = +tr.querySelector('.sel').dataset.index;
    const ci  = Array.from(tr.children).indexOf(td);
    const keys = ['name','adm','parent','contact','occupation','address'];
    const val = td.textContent.trim();
    if (ci === 2) {
      if (!/^\d+$/.test(val)) { alert('Adm# must be numeric'); renderStudents(); return; }
      if (students.some((s,i2) => s.adm === val && i2 !== idx)) { alert('Duplicate Adm# not allowed'); renderStudents(); return; }
    }
    if (ci >= 1 && ci <= 6) {
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
        if (ci >= 1 && ci <= 6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit ? td.addEventListener('blur', onCellBlur) : td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  deleteSelBtn.onclick = ev => {
    ev.preventDefault();
    if (!confirm('Delete selected?')) return;
    Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb => +cb.dataset.index)
      .sort((a,b)=>b-a)
      .forEach(i => students.splice(i,1));
    saveStudents(); renderStudents(); selectAll.checked = false;
  };

  saveRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id => $(id).classList.remove('hidden'));
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  editRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id => $(id).classList.add('hidden'));
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick = ev => {
    ev.preventDefault();
    const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
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
    const currentDate = new Date().toLocaleDateString();
    doc.text(`Date: ${currentDate}`,10,20);
    doc.text(`School: ${localStorage.getItem('schoolName')}`,10,26);
    doc.text(`Class: ${localStorage.getItem('teacherClass')}`,10,32);
    doc.text(`Section: ${localStorage.getItem('teacherSection')}`,10,38);
    doc.autoTable({
      head: [['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY:44
    });
    doc.save('student_registration.pdf');
  };

  renderStudents();

  // 3. ATTENDANCE MARKING
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');
  const dateInput   = $('dateInput');
  const loadAtt     = $('loadAttendance');
  const attList     = $('attendanceList');
  const saveAtt     = $('saveAttendance');
  const resultSection = $('attendance-result');
  const summaryBody   = $('summaryBody');

  loadAtt.onclick = ev => {
    ev.preventDefault();
    if (!dateInput.value) return alert('Pick a date');
    attList.innerHTML = '';
    students.forEach(s=>{
      const row = document.createElement('div');
      row.className='attendance-item'; row.textContent=s.name;
      const btns=document.createElement('div');
      btns.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button');
        b.textContent=code; b.className='att-btn'; b.dataset.code=code;
        if(attendanceData[dateInput.value]?.[s.roll]===code){
          b.style.background=colors[code]; b.style.color='#fff';
        }
        b.onclick=e2=>{
          btns.querySelectorAll('.att-btn').forEach(x=>{ x.style.background=''; x.style.color='#333'; });
          b.style.background=colors[code]; b.style.color='#fff';
        };
        btns.append(b);
      });
      attList.append(row,btns);
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick = ev=>{
    ev.preventDefault();
    const d=dateInput.value;
    attendanceData[d]={};
    attList.querySelectorAll('.attendance-actions').forEach((btns,i)=>{
      const sel=btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll]=sel?sel.dataset.code:'A';
    });
    localStorage.setItem('attendanceData',JSON.stringify(attendanceData));
    resultSection.classList.remove('hidden');
    summaryBody.innerHTML='';
    const hdr=`Date: ${d}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    students.forEach(s=>{
      const code=attendanceData[d][s.roll]||'A';
      const status={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick=e2=>{
        const msg=`${hdr}\n\nName: ${s.name}\nStatus: ${status}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  // 4. ANALYTICS
  /* ...full analytics code as in original file... */

  // 5. ATTENDANCE REGISTER
  /* ...full register code as in original file... */

  // Service Worker registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js');
    });
  }
});
