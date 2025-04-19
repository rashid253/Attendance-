window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };

  // 1. SETUP
  const schoolIn = $('schoolNameInput');
  const classSel = $('teacherClassSelect');
  const secSel   = $('teacherSectionSelect');
  const saveSetupBtn = $('saveSetup');
  const setupForm    = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText    = $('setupText');
  const editSetupBtn = $('editSetup');

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

  saveSetupBtn.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };
  editSetupBtn.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };
  loadSetup();

  // 2. STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  window.students = students;
  const studentNameIn      = $('studentName');
  const admissionNoIn      = $('admissionNo');
  const parentNameIn       = $('parentName');
  const parentContactIn    = $('parentContact');
  const parentOccupationIn = $('parentOccupation');
  const parentAddressIn    = $('parentAddress');
  const addStudentBtn      = $('addStudent');
  const studentsBody       = $('studentsBody');
  const selectAllChk       = $('selectAllStudents');
  const editSelectedBtn    = $('editSelected');
  const deleteSelectedBtn  = $('deleteSelected');
  const saveRegBtn         = $('saveRegistration');
  const shareRegBtn        = $('shareRegistration');
  const editRegBtn         = $('editRegistration');
  const downloadRegPDFBtn  = $('downloadRegistrationPDF');
  let regSaved = false, inlineEdit = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved?'disabled':''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved?'<button class="share-one">Share</button>':''}</td>`;
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
    bindStudentSelection();
  }

  function bindStudentSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelectedBtn.disabled = deleteSelectedBtn.disabled = !any;
      };
    });
    selectAllChk.disabled = regSaved;
    selectAllChk.onchange = () => {
      if (!regSaved) boxes.forEach(cb => { cb.checked = selectAllChk.checked; cb.dispatchEvent(new Event('change')); });
    };
  }

  addStudentBtn.onclick = ev => {
    ev.preventDefault();
    const name = studentNameIn.value.trim();
    const adm  = admissionNoIn.value.trim();
    const parent = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occupation = parentOccupationIn.value.trim();
    const address    = parentAddressIn.value.trim();
    if (!name||!adm||!parent||!contact||!occupation||!address) return alert('All fields required');
    if (!/^\d+$/.test(adm)) return alert('Adm# must be numeric');
    if (!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits');
    students.push({ name, adm, parent, contact, occupation, address, roll: Date.now() });
    saveStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccupationIn, parentAddressIn].forEach(i=>i.value='');
  };

  function onCellBlur(e) {
    const td = e.target, tr = td.closest('tr');
    const idx = +tr.querySelector('.sel').dataset.index;
    const ci  = Array.from(tr.children).indexOf(td);
    const keys = ['name','adm','parent','contact','occupation','address'];
    if (ci>=1 && ci<=6) {
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  }

  editSelectedBtn.onclick = ev => {
    ev.preventDefault();
    const sel = Array.from(document.querySelectorAll('.sel:checked'));
    if (!sel.length) return;
    inlineEdit = !inlineEdit;
    editSelectedBtn.textContent = inlineEdit ? 'Done Editing' : 'Edit Selected';
    sel.forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td, ci) => {
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit ? td.addEventListener('blur', onCellBlur) : td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  deleteSelectedBtn.onclick = ev => {
    ev.preventDefault();
    if (!confirm('Delete selected?')) return;
    Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb => +cb.dataset.index)
      .sort((a,b) => b - a)
      .forEach(i => students.splice(i, 1));
    saveStudents();
    renderStudents();
    selectAllChk.checked = false;
  };

  saveRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegPDFBtn.classList.remove('hidden');
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  editRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegPDFBtn.classList.add('hidden');
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

  downloadRegPDFBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    doc.autoTable({
      head:[['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY:40, margin:{left:40,right:40}, styles:{fontSize:10}
    });
    doc.save('students_registration.pdf');
  };

  renderStudents();

  // 3. ATTENDANCE MARKING (unchanged) …
  // 4. ANALYTICS (unchanged) …

  // 5. ATTENDANCE REGISTER
  const regMonthIn       = $('registerMonth');
  const loadRegBtn       = $('loadRegister');
  const changeRegBtn     = $('changeRegister');
  const regTableWrapper  = $('registerTableWrapper');
  const regTable         = $('registerTable');
  const regBody          = $('registerBody');
  const regSummarySection= $('registerSummarySection');
  const regSummaryBody   = $('registerSummaryBody');
  const shareRegBtn2     = $('shareRegister');
  const downloadRegBtn2  = $('downloadRegisterPDF');

  // build 1–31 headers once
  const regHeaderRow = regTable.querySelector('thead tr');
  for (let d = 1; d <= 31; d++) {
    const th = document.createElement('th');
    th.textContent = d;
    regHeaderRow.append(th);
  }

  loadRegBtn.onclick = e => {
    e.preventDefault();
    if (!regMonthIn.value) return alert('Select month');
    const [yr,mo] = regMonthIn.value.split('-').map(Number);
    const dim = new Date(yr, mo, 0).getDate();

    regBody.innerHTML = '';
    regSummaryBody.innerHTML = '';

    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1; d<=dim; d++) {
        const key = `${regMonthIn.value}-${String(d).padStart(2,'0')}`;
        const code= (JSON.parse(localStorage.getItem('attendanceData')||'{}')[key]||{})[s.roll] || 'A';
        const td = document.createElement('td');
        td.textContent = code;
        td.style.background = colors[code];
        td.style.color = '#fff';
        tr.append(td);
      }
      regBody.append(tr);
    });

    // summary
    const attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
    const stats = students.map(s=>({name:s.name,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    stats.forEach(st=>{
      for(let d=1; d<=dim; d++){
        const key = `${regMonthIn.value}-${String(d).padStart(2,'0')}`;
        const rec = attendanceData[key]||{};
        const code = rec[ students.find(x=>x.name===st.name).roll ]||'A';
        st[code]++; st.total++;
      }
      const pct = st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${pct}</td>`;
      regSummaryBody.append(tr);
    });

    regTableWrapper.classList.remove('hidden');
    regSummarySection.classList.remove('hidden');
    loadRegBtn.classList.add('hidden');
    changeRegBtn.classList.remove('hidden');
  };

  changeRegBtn.onclick = e => {
    e.preventDefault();
    regTableWrapper.classList.add('hidden');
    regSummarySection.classList.add('hidden');
    loadRegBtn.classList.remove('hidden');
    changeRegBtn.classList.add('hidden');
  };

  shareRegBtn2.onclick = e => {
    e.preventDefault();
    const hdr = `Register for ${regMonthIn.value}\nSchool: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    const lines = Array.from(regSummaryBody.querySelectorAll('tr')).map(r=>{
      const td = r.querySelectorAll('td');
      return `${td[0].textContent}: P:${td[1].textContent}, A:${td[2].textContent}, Lt:${td[3].textContent}, HD:${td[4].textContent}, L:${td[5].textContent}, %:${td[6].textContent}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines.join('\n'))}`, '_blank');
  };

  downloadRegBtn2.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    // switch to landscape orientation
    const doc = new jsPDF('l','pt','a4');
    doc.text(localStorage.getItem('schoolName'), 40, 30);
    doc.text(`Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`, 40, 45);
    doc.text(`Register for ${regMonthIn.value}`, 40, 60);
    doc.autoTable({ html: '#registerTable', startY: 75, styles: { fontSize: 8 } });
    doc.autoTable({ html: '#registerSummarySection table', startY: doc.lastAutoTable.finalY + 10, styles: { fontSize: 8 } });
    doc.save('attendance_register.pdf');
  };
});
