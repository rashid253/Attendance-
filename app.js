// app.js

window.addEventListener('DOMContentLoaded', async () => { // idbKeyval IIFE available globally const { get, set } = idbKeyval; const $ = id => document.getElementById(id); const colors = { P: '#4CAF50', A: '#f44336', Lt: '#FFEB3B', HD: '#FF9800', L: '#03a9f4' };

// 1. SETUP const schoolIn     = $('schoolNameInput'); const classSel     = $('teacherClassSelect'); const secSel       = $('teacherSectionSelect'); const saveSetup    = $('saveSetup'); const setupForm    = $('setupForm'); const setupDisplay = $('setupDisplay'); const setupText    = $('setupText'); const editSetup    = $('editSetup');

async function loadSetup() { const school = await get('schoolName'); const cls    = await get('teacherClass'); const sec    = await get('teacherSection'); if (school && cls && sec) { schoolIn.value   = school; classSel.value   = cls; secSel.value     = sec; setupText.textContent = ${school} 🏫 | Class: ${cls} | Section: ${sec}; setupForm.classList.add('hidden'); setupDisplay.classList.remove('hidden'); } }

saveSetup.onclick = async e => { e.preventDefault(); if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup'); await set('schoolName', schoolIn.value); await set('teacherClass', classSel.value); await set('teacherSection', secSel.value); await loadSetup(); };

editSetup.onclick = e => { e.preventDefault(); setupForm.classList.remove('hidden'); setupDisplay.classList.add('hidden'); };

await loadSetup();

// 2. STUDENT REGISTRATION let students = await get('students') || []; const studentNameIn    = $('studentName'); const admissionNoIn    = $('admissionNo'); const parentNameIn     = $('parentName'); const parentContactIn  = $('parentContact'); const parentOccIn      = $('parentOccupation'); const parentAddrIn     = $('parentAddress'); const addStudentBtn    = $('addStudent'); const studentsBody     = $('studentsBody'); const selectAll        = $('selectAllStudents');

