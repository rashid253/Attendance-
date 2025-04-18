window.addEventListener('DOMContentLoaded', () => { const $ = id => document.getElementById(id); const THRESHOLD = 75; const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };

// --- SETUP --- const setupForm = $('setupForm'), setupDisplay = $('setupDisplay'), setupText = $('setupText'); const schoolInput = $('schoolNameInput'), classSelect = $('teacherClassSelect'), sectionSelect = $('teacherSectionSelect'); const saveSetupBtn = $('saveSetup'), editSetupBtn = $('editSetup');

function displaySetup() { const school = localStorage.getItem('schoolName'), cls = localStorage.getItem('teacherClass'), section = localStorage.getItem('teacherSection'); if (school && cls && section) { setupText.textContent = School: ${school} | Class: ${cls} | Section: ${section}; setupForm.classList.add('hidden'); setupDisplay.classList.remove('hidden'); } else { setupForm.classList.remove('hidden'); setupDisplay.classList.add('hidden'); } }

saveSetupBtn.onclick = () => { const school = schoolInput.value.trim(), cls = classSelect.value, section = sectionSelect.value; if (!school || !cls || !section) return alert('Please fill all setup fields.'); localStorage.setItem('schoolName', school); localStorage.setItem('teacherClass', cls); localStorage.setItem('teacherSection', section); displaySetup(); };

editSetupBtn.onclick = () => { setupForm.classList.remove('hidden'); setupDisplay.classList.add('hidden'); schoolInput.value = localStorage.getItem('schoolName') || ''; classSelect.value = localStorage.getItem('teacherClass') || ''; sectionSelect.value = localStorage.getItem('teacherSection') || ''; };

displaySetup();

// --- STUDENT REGISTRATION --- let students = JSON.parse(localStorage.getItem('students') || '[]'); const inputs      = ['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress'].map($), addBtn      = $('addStudent'), tblBody     = $('studentsBody'), selectAll   = $('selectAllStudents'), editSel     = $('editSelected'), delSel      = $('deleteSelected'), saveReg     = $('saveRegistration'), shareReg    = $('shareRegistration'), editReg     = $('editRegistration'), downloadReg = $('downloadRegistrationPDF'); let savedReg = false, inlineMode = false;

function saveStudents() { localStorage.setItem('students', JSON.stringify(students)); }

function bindSelection() { const boxes = [...document.querySelectorAll('.selStu')]; boxes.forEach(cb => cb.onchange = () => { const tr = cb.closest('tr'); cb.checked ? tr.classList.add('selected') : tr.classList.remove('selected'); const any = boxes.some(x=>x.checked); editSel.disabled = delSel.disabled = !any || savedReg; }); selectAll.disabled = savedReg; selectAll.onchange = () => { if (savedReg) return; boxes.forEach(cb => { cb.checked = selectAll.checked; cb.dispatchEvent(new Event('change')); }); }; }

function renderStudents() { tblBody.innerHTML = ''; students.forEach((s,i) => { const tr = document.createElement('tr'); tr.innerHTML = <td class="select-col" style="${savedReg?'display:none':''}"><input type="checkbox" class="selStu" data-i="${i}"></td> + <td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td> + <td>${savedReg?'<button class="sRow small">Share</button>':''}</td>; if (savedReg) { tr.querySelector('.sRow').onclick = () => { const hdr = School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}; const msg = ${hdr}\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}; window.open(https://wa.me/?text=${encodeURIComponent(msg)}, '_blank'); }; } tblBody.appendChild(tr); }); bindSelection(); }

addBtn.onclick = () => { if (savedReg) return; const vs = inputs.map(i=>i.value.trim()); if (!vs[0]||!vs[1]) return alert('Name & Adm# required'); students.push({ name: vs[0], adm: vs[1], parent: vs[2], contact: vs[3], occupation: vs[4], address: vs[5] }); saveStudents(); renderStudents(); inputs.forEach(i=>i.value=''); };

delSel.onclick = () => { if (!confirm('Delete selected students?')) return; [...document.querySelectorAll('.selStu:checked')].map(cb=>+cb.dataset.i).sort((a,b)=>b-a) .forEach(idx=>students.splice(idx,1)); saveStudents(); renderStudents(); selectAll.checked = false; };

editSel.onclick = () => { if (savedReg) return; const sel = [...document.querySelectorAll('.selStu:checked')]; if (!sel.length) return; inlineMode = !inlineMode; editSel.textContent = inlineMode ? 'Done Editing' : 'Edit Selected'; sel.forEach(cb => { const tr = cb.closest('tr'); [...tr.querySelectorAll('td')].forEach((td,ci) => { if (ci>=1 && ci<=6) { td.contentEditable = inlineMode; td.classList.toggle('editing', inlineMode); if (inlineMode) td.addEventListener('blur', onBlur); else td.removeEventListener('blur', onBlur); } }); }); };

function onBlur(e) { const td = e.target, tr = td.closest('tr'), idx = +tr.querySelector('.selStu').dataset.i; const keys = ['name','adm','parent','contact','occupation','address'], ci = Array.from(tr.children).indexOf(td); if (ci>=1 && ci<=6) { students[idx][keys[ci-1]] = td.textContent.trim(); saveStudents(); } }

saveReg.onclick = () => { savedReg = true; [editSel,delSel,selectAll,saveReg].forEach(b=>b.style.display='none'); shareReg.classList.remove('hidden'); editReg.classList.remove('hidden'); downloadReg.classList.remove('hidden'); renderStudents(); };

editReg.onclick = () => { savedReg = false; [editSel,delSel,selectAll,saveReg].forEach(b=>b.style.display=''); shareReg.classList.add('hidden'); editReg.classList.add('hidden'); downloadReg.classList.add('hidden'); renderStudents(); };

shareReg.onclick = () => { const hdr = School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}; const data = students.map(s => Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address} ).join('\n---\n'); window.open(https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+data)}, '_blank'); };

downloadReg.onclick = () => { const { jsPDF } = window.jspdf; const doc = new jsPDF('p','pt','a4'); let y = 20; const header = [ School: ${localStorage.getItem('schoolName')}, Class: ${localStorage.getItem('teacherClass')}, Section: ${localStorage.getItem('teacherSection')} ].join(' | '); doc.setFontSize(14); doc.text(header, 20, y); y += 20; doc.autoTable({ html: document.getElementById('studentTable'), startY: y, theme: 'grid', headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' }, styles: { fontSize:10, cellPadding:4 } }); doc.save('Student_Registration.pdf'); };

renderStudents();

// --- ATTENDANCE MARKING & SUMMARY --- const loadAttendanceBtn    = $('loadAttendance'), attendanceList        = $('attendanceList'), saveAttendanceBtn     = $('saveAttendance'), attendanceSection     = $('attendance-section'), attendanceResult      = $('attendance-result'), summaryBody           = $('summaryBody'), dateInput             = $('dateInput'); let currentAttendance = { date: '', statuses: [] };

loadAttendanceBtn.onclick = () => { const date = dateInput.value; if (!date) return alert('Select Date'); attendanceList.innerHTML = ''; currentAttendance = { date, statuses: Array(students.length).fill(null) }; students.forEach((s,i) => { const nameDiv = document.createElement('div'); nameDiv.className = 'attendance-item'; nameDiv.textContent = s.name; attendanceList.appendChild(nameDiv); const actions = document.createElement('div'); actions.className = 'attendance-actions'; Object.keys(colors).forEach(code => { const btn = document.createElement('button'); btn.textContent = code; btn.className = 'att-btn'; btn.onclick = () => { currentAttendance.statuses[i] = code; [...actions.children].forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); saveAttendanceBtn.classList.remove('hidden'); }; actions.appendChild(btn); }); attendanceList.appendChild(actions); }); };

saveAttendanceBtn.onclick = () => { const { date, statuses } = currentAttendance; if (!date || statuses.includes(null)) return alert('Mark all statuses'); const all = JSON.parse(localStorage.getItem('attendance') || '{}'); all[date] = statuses; localStorage.setItem('attendance', JSON.stringify(all)); showAttendanceSummary(date); };

function showAttendanceSummary(date) { const all = JSON.parse(localStorage.getItem('attendance') || '{}'); const statuses = all[date] || []; summaryBody.innerHTML = ''; statuses.forEach((st,i) => { const tr = document.createElement('tr'); tr.innerHTML = <td>${students[i].name}</td><td>${st}</td><td><button class="small share-row">Share</button></td>; tr.querySelector('.share-row').onclick = () => { const hdr = Date: ${date}\nSchool: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}; const msg = ${hdr}\nName: ${students[i].name}\nStatus: ${st}; window.open(https://wa.me/?text=${encodeURIComponent(msg)}, '_blank'); }; summaryBody.appendChild(tr); }); attendanceResult.classList.remove('hidden'); attendanceSection.classList.add('hidden'); }

$('shareAttendanceSummary').onclick = () => { /* kept original / }; $('downloadAttendancePDF').onclick = () => { / kept original */ }; $('resetAttendance').onclick = () => { attendanceResult.classList.add('hidden'); attendanceSection.classList.remove('hidden'); saveAttendanceBtn.classList.add('hidden'); };

// --- ANALYTICS (Basic placeholder) --- $('loadAnalytics').onclick = () => alert('Analytics feature coming soon.'); $('resetAnalytics').onclick = () => location.reload(); $('shareAnalytics').onclick = () => alert('Sharing analytics...'); $('downloadAnalytics').onclick = () => alert('Downloading analytics...'); });

