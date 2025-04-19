// app.js window.addEventListener('DOMContentLoaded', () => { const $ = id => document.getElementById(id); const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };

// ----------------------------- // 1. SETUP (unchanged) // ----------------------------- const schoolIn     = $('schoolNameInput'); const classSel     = $('teacherClassSelect'); const secSel       = $('teacherSectionSelect'); const saveSetup    = $('saveSetup'); const setupForm    = $('setupForm'); const setupDisplay = $('setupDisplay'); const setupText    = $('setupText'); const editSetup    = $('editSetup');

function loadSetup() { const school = localStorage.getItem('schoolName'); const cls    = localStorage.getItem('teacherClass'); const sec    = localStorage.getItem('teacherSection'); if (school && cls && sec) { schoolIn.value = school; classSel.value = cls; secSel.value   = sec; setupText.textContent = ${school} 🏫 | Class: ${cls} | Section: ${sec}; setupForm.classList.add('hidden'); setupDisplay.classList.remove('hidden'); } } saveSetup.onclick = e => { e.preventDefault(); if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup'); localStorage.setItem('schoolName', schoolIn.value); localStorage.setItem('teacherClass', classSel.value); localStorage.setItem('teacherSection', secSel.value); loadSetup(); }; editSetup.onclick = e => { e.preventDefault(); setupForm.classList.remove('hidden'); setupDisplay.classList.add('hidden'); }; loadSetup();

// ----------------------------- // 2. STUDENT REGISTRATION (unchanged) // ----------------------------- let students = JSON.parse(localStorage.getItem('students') || '[]'); window.students = students; const studentNameIn   = $('studentName'); const admissionNoIn   = $('admissionNo'); const parentNameIn    = $('parentName'); const parentContactIn = $('parentContact'); const parentOccIn     = $('parentOccupation'); const parentAddrIn    = $('parentAddress'); const addStudentBtn   = $('addStudent'); const studentsBody    = $('studentsBody'); const selectAll       = $('selectAllStudents'); const editSelBtn      = $('editSelected'); const deleteSelBtn    = $('deleteSelected'); const saveRegBtn      = $('saveRegistration'); const shareRegBtn     = $('shareRegistration'); const editRegBtn      = $('editRegistration'); const downloadRegBtn  = $('downloadRegistrationPDF'); let regSaved = false, inlineEdit = false;

function saveStudents() { localStorage.setItem('students', JSON.stringify(students)); } function renderStudents() { studentsBody.innerHTML = ''; students.forEach((s, i) => { const tr = document.createElement('tr'); tr.innerHTML = <td><input type="checkbox" class="sel" data-index="${i}" ${regSaved?'disabled':''}></td> + <td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td> + <td>${regSaved?'<button class="share-one">Share</button>':''}</td>; if (regSaved) { tr.querySelector('.share-one').onclick = ev => { ev.preventDefault(); const hdr = School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}; const msg = ${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}; window.open(https://wa.me/?text=${encodeURIComponent(msg)}, '_blank'); }; } studentsBody.appendChild(tr); }); bindSelection(); } function bindSelection() { const boxes = Array.from(document.querySelectorAll('.sel')); boxes.forEach(cb => { cb.onchange = () => { cb.closest('tr').classList.toggle('selected', cb.checked); const any = boxes.some(x => x.checked); editSelBtn.disabled = deleteSelBtn.disabled = !any; }; }); selectAll.disabled = regSaved; selectAll.onchange = () => { if (!regSaved) boxes.forEach(cb => { cb.checked = selectAll.checked; cb.dispatchEvent(new Event('change')); }); }; }

addStudentBtn.onclick = ev => { ev.preventDefault(); const name       = studentNameIn.value.trim(); const adm        = admissionNoIn.value.trim(); const parent     = parentNameIn.value.trim(); const contact    = parentContactIn.value.trim(); const occ        = parentOccIn.value.trim(); const addr       = parentAddrIn.value.trim(); if (!name || !adm || !parent || !contact || !occ || !addr) return alert('All fields required'); if (!/^[0-9]+$/.test(adm)) return alert('Adm# must be numeric'); if (students.some(s => s.adm === adm)) return alert(Admission# ${adm} already exists); if (!/^[0-9]{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits'); students.push({ name, adm, parent, contact, occupation: occ, address: addr, roll: Date.now() }); saveStudents(); renderStudents(); [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn].forEach(i => i.value = ''); };

function onCellBlur(e) { const td = e.target, tr = td.closest('tr'); const idx = +tr.querySelector('.sel').dataset.index; const ci  = Array.from(tr.children).indexOf(td); const keys = ['name','adm','parent','contact','occupation','address']; const val = td.textContent.trim(); if (ci === 2) { if (!/^[0-9]+$/.test(val)) { alert('Adm# must be numeric'); renderStudents(); return; } if (students.some((s,i2) => s.adm===val && i2!==idx)) { alert('Duplicate Adm# not allowed'); renderStudents(); return; } } if (ci >= 1 && ci <= 6) { students[idx][keys[ci-1]] = val; saveStudents(); } }

editSelBtn.onclick = ev => { ev.preventDefault(); const sel = Array.from(document.querySelectorAll('.sel:checked')); if (!sel.length) return; inlineEdit = !inlineEdit; editSelBtn.textContent = inlineEdit ? 'Done Editing' : 'Edit Selected'; sel.forEach(cb => { cb.closest('tr').querySelectorAll('td').forEach((td, ci) => { if (ci >= 1 && ci <= 6) { td.contentEditable = inlineEdit; td.classList.toggle('editing', inlineEdit); inlineEdit ? td.addEventListener('blur', onCellBlur) : td.removeEventListener('blur', onCellBlur); } }); }); }; deleteSelBtn.onclick = ev => { ev.preventDefault(); if (!confirm('Delete selected?')) return; Array.from(document.querySelectorAll('.sel:checked')) .map(cb => +cb.dataset.index) .sort((a,b) => b-a) .forEach(i => students.splice(i,1)); saveStudents(); renderStudents(); selectAll.checked = false; }; saveRegBtn.onclick = ev => { ev.preventDefault(); regSaved = true; ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.add('hidden')); shareRegBtn.classList.remove('hidden'); editRegBtn.classList.remove('hidden'); downloadRegBtn.classList.remove('hidden'); $('studentTableWrapper').classList.add('saved'); renderStudents(); }; editRegBtn.onclick = ev => { ev.preventDefault(); regSaved = false; ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.remove('hidden')); shareRegBtn.classList.add('hidden'); editRegBtn.classList.add('hidden'); downloadRegBtn.classList.add('hidden'); $('studentTableWrapper').classList.remove('saved'); renderStudents(); }; shareRegBtn.onclick = ev => { ev.preventDefault(); const hdr = School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}; const lines = students.map(s => Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address} ).join('\n---\n'); window.open(https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}, '_blank'); }; downloadRegBtn.onclick = ev => { ev.preventDefault(); const { jsPDF } = window.jspdf; const doc = new jsPDF('p','pt','a4'); doc.autoTable({ head: [['Name','Adm#','Parent','Contact','Occupation','Address']], body: students.map(s => [s.name,s.adm,s.parent,s.contact,s.occupation,s.address]) }); doc.save('students_registration PDF'); }; renderStudents();

// ----------------------------- // 3. ATTENDANCE MARKING (unchanged) // ----------------------------- let attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}'); // ...attendance marking code unchanged...

// ----------------------------- // 4. ANALYTICS (fixed semester range) // ----------------------------- // ...analytics code with corrected semester logic (as above)...

// ----------------------------- // 5. ATTENDANCE REGISTER (unchanged) // ----------------------------- const regMonthIn      = $('registerMonth'); const loadReg         = $('loadRegister'); const changeReg       = $('changeRegister'); const regTableWrapper = $('registerTableWrapper'); const regBody         = $('registerBody'); const regSummaryBody  = $('registerSummaryBody');

// build day headers once const headerRow = $('registerTable').querySelector('thead tr'); for (let d = 1; d <= 31; d++) { const th = document.createElement('th'); th.textContent = d; headerRow.append(th); }

loadReg.onclick = e => { e.preventDefault(); if (!regMonthIn.value) return alert('Select month'); const data = JSON.parse(localStorage.getItem('attendanceData')||'{}'); const [y,m] = regMonthIn.value.split('-').map(Number); const dim = new Date(y,m,0).getDate();

regBody.innerHTML = '';
regSummaryBody.innerHTML = '';

students.forEach((s,i) => {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
  for (let d = 1; d <= dim; d++) {
    const key = `${regMonthIn.value}-${String(d).padStart(2,'0')}`;
    const code = (data[key]||{})[s.roll] || 'A';
    const td = document.createElement('td');
    td.textContent = code;
    td.style.background = colors[code];
    td.style.color = '#fff';
    tr.append(td);
  }
  regBody.append(tr);
});

const stats2 = students.map(s => ({ name: s.name, roll: s.roll, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
stats2.forEach(st => {
  for (let d = 1; d <= dim; d++) {
    const key = `${regMonthIn.value}-${String(d).padStart(2,'0')}`;
    const code = (data[key]||{})[st.roll] || 'A';
    st[code]++; st.total++;
  }
  const pct = st.total ? ((st.P/st.total)*100).toFixed(1) : '0.0';
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${pct}</td>`;
  regSummaryBody.append(tr);
});

regTableWrapper.classList.remove('hidden');
$('registerSummarySection').classList.remove('hidden');
loadReg.classList.add('hidden');
changeReg.classList.remove('hidden');

};

changeReg.onclick = e => { e.preventDefault(); regTableWrapper.classList.add('hidden'); $('registerSummarySection').classList.add('hidden'); loadReg.classList.remove('hidden'); changeReg.classList.add('hidden'); }; });

