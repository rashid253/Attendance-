document.addEventListener('DOMContentLoaded', () => { const $ = id => document.getElementById(id); let students = JSON.parse(localStorage.getItem('students') || '[]');

const studentNameIn      = $('studentName'); const admissionNoIn      = $('admissionNo'); const parentNameIn       = $('parentName'); const parentContactIn    = $('parentContact'); const parentOccupationIn = $('parentOccupation'); const parentAddressIn    = $('parentAddress'); const addStudentBtn      = $('addStudent'); const studentsBody       = $('studentsBody');

function saveStudents() { localStorage.setItem('students', JSON.stringify(students)); }

function renderStudents() { studentsBody.innerHTML = ''; students.forEach((s, i) => { const tr = document.createElement('tr'); tr.innerHTML = <td><input type="checkbox" class="sel" data-index="${i}"></td> <td>${s.name}</td> <td>${s.adm}</td> <td>${s.parent}</td> <td>${s.contact}</td> <td>${s.occupation}</td> <td>${s.address}</td>; studentsBody.appendChild(tr); }); }

addStudentBtn.addEventListener('click', e => { e.preventDefault(); const name       = studentNameIn.value.trim(); const adm        = admissionNoIn.value.trim(); const parent     = parentNameIn.value.trim(); const contact    = parentContactIn.value.trim(); const occupation = parentOccupationIn.value.trim(); const address    = parentAddressIn.value.trim();

if (!name || !adm || !parent || !contact || !occupation || !address) {
  return alert('All fields required');
}
if (!/^[0-9]+$/.test(adm)) {
  return alert('Adm# must be numeric');
}
if (!/^\d{7,15}$/.test(contact)) {
  return alert('Contact must be 7–15 digits');
}

students.push({ name, adm, parent, contact, occupation, address, roll: Date.now() });
saveStudents();
renderStudents();

[studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccupationIn, parentAddressIn]
  .forEach(i => i.value = '');

});

renderStudents(); });

