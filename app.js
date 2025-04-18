window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'var(--orange)', L:'var(--info)' };

  // SETUP
  const schoolIn = $('schoolNameInput'), classSel = $('teacherClassSelect'), secSel = $('teacherSectionSelect');
  const saveSet = $('saveSetup'), formSet = $('setupForm'), dispSet = $('setupDisplay'), txtSet = $('setupText'), editSet = $('editSetup');
  saveSet.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };
  editSet.onclick = e => {
    e.preventDefault();
    formSet.classList.remove('hidden');
    dispSet.classList.add('hidden');
  };
  function loadSetup() {
    const s = localStorage.getItem('schoolName'), c = localStorage.getItem('teacherClass'), e = localStorage.getItem('teacherSection');
    if (s && c && e) {
      schoolIn.value = s; classSel.value = c; secSel.value = e;
      txtSet.textContent = `${s} 🏫 | Class: ${c} | Section: ${e}`;
      formSet.classList.add('hidden'); dispSet.classList.remove('hidden');
    }
  }
  loadSetup();

  // STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students')||'[]');
  const inputs = ['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress'].map($);
  const addBtn = $('addStudent'), tblBody = $('studentsBody');
  const selectAll = $('selectAllStudents'), editSelected = $('editSelected'), deleteSelected = $('deleteSelected');
  const saveRegistration = $('saveRegistration'), shareRegistration = $('shareRegistration'), editRegistration = $('editRegistration');
  const downloadRegPDF = $('downloadRegistrationPDF');
  let registrationSaved = false, inlineEditMode = false;

  function saveStudents() { localStorage.setItem('students', JSON.stringify(students)); }
  function renderStudents() {
    tblBody.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td class="select-col"><input type="checkbox" class="selectStudent" data-index="${i}" ${registrationSaved?'disabled':''}></td>`+
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>`+
        `<td>${registrationSaved?'<button type="button" class="share">Share</button>':''}</td>`;
      if (registrationSaved) {
        tr.querySelector('.share').onclick = ev => {
          ev.preventDefault();
          const setup = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
          const msg = `${setup}
Name: ${s.name}
Adm#: ${s.adm}
Parent: ${s.parent}
Contact: ${s.contact}
Occupation: ${s.occupation}
Address: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      tblBody.appendChild(tr);
    });
    bindSelection();
  }

  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.selectStudent'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelected.disabled = !any;
        deleteSelected.disabled = !any;
      };
    });
    selectAll.disabled = registrationSaved;
    selectAll.onchange = () => {
      if (!registrationSaved) boxes.forEach(cb => { cb.checked = selectAll.checked; cb.dispatchEvent(new Event('change')); });
    };
  }

  addBtn.onclick = ev => {
    ev.preventDefault();
    const vals = inputs.map(i=>i.value.trim());
    if (vals.some(v=>!v)) return alert('All fields are required');
    if (!/^\d+$/.test(vals[1])) return alert('Adm# must be numeric');
    if (!/^\d{7,15}$/.test(vals[3])) return alert('Contact must be 7–15 digits');
    const [name, adm, parent, contact, occupation, address] = vals;
    students.push({name, adm, parent, contact, occupation, address, roll: Date.now()});
    saveStudents(); renderStudents(); inputs.forEach(i=>i.value='');
  };

  function onCellBlur(e) {
    const td = e.target, tr = td.closest('tr'), idx = +tr.querySelector('.selectStudent').dataset.index;
    const ci = Array.from(tr.children).indexOf(td), keys = ['name','adm','parent','contact','occupation','address'];
    if (ci>=1&&ci<=6) {
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  }

  editSelected.onclick = ev => {
    ev.preventDefault();
    const sel = Array.from(document.querySelectorAll('.selectStudent:checked'));
    if (!sel.length) return;
    inlineEditMode = !inlineEditMode;
    editSelected.textContent = inlineEditMode?'Done Editing':'Edit Selected';
    sel.forEach(cb=>{
      Array.from(cb.closest('tr').querySelectorAll('td')).forEach((td,ci)=>{
        if(ci>=1&&ci<=6){
          td.contentEditable = inlineEditMode;
          td.classList.toggle('editing', inlineEditMode);
          inlineEditMode?td.addEventListener('blur',onCellBlur):td.removeEventListener('blur',onCellBlur);
        }
      });
    });
  };

  deleteSelected.onclick = ev => {
    ev.preventDefault();
    if (!confirm('Delete selected?')) return;
    Array.from(document.querySelectorAll('.selectStudent:checked'))
      .map(cb=>+cb.dataset.index).sort((a,b)=>b-a).forEach(i=>students.splice(i,1));
    saveStudents(); renderStudents(); selectAll.checked=false;
  };

  saveRegistration.onclick = ev => {
    ev.preventDefault();
    registrationSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.add('hidden'));
    shareRegistration.classList.remove('hidden');
    editRegistration.classList.remove('hidden');
    downloadRegPDF.classList.remove('hidden');
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  editRegistration.onclick = ev => {
    ev.preventDefault();
    registrationSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.remove('hidden'));
    shareRegistration.classList.add('hidden');
    editRegistration.classList.add('hidden');
    downloadRegPDF.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegistration.onclick = ev => {
    ev.preventDefault();
    const setup = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s=>`Name:${s.name}\nAdm#:${s.adm}\nParent:${s.parent}\nContact:${s.contact}\nOccupation:${s.occupation}\nAddress:${s.address}`).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(setup+'\n\n'+lines)}`, '_blank');
  };

  downloadRegPDF.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    doc.autoTable({
      head:[['Name','Adm#','Parent','Contact','Occupation','Address']],
      body:students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY:40,margin:{left:40,right:40},styles:{fontSize:10}
    });
    doc.save('students_registration.pdf');
  };

  renderStudents();

  // ... rest of app.js unchanged for Attendance & Analytics ...
});
