// File: src/js/students.js
import { set, get } from 'idb-keyval';
const $ = id => document.getElementById(id);

let students = [], lastAdmNo = 0;

async function genAdmNo() {
  lastAdmNo++;
  await set('lastAdmissionNo', lastAdmNo);
  return String(lastAdmNo).padStart(4,'0');
}

export async function initStudents() {
  students    = await get('students')||[];
  lastAdmNo   = await get('lastAdmissionNo')||0;

  const addBtn    = $('addStudent');
  const tbody     = $('studentsBody');
  const selectAll = $('selectAllStudents');
  const editSel   = $('editSelected');
  const delSel    = $('deleteSelected');
  const saveReg   = $('saveRegistration');
  const editReg   = $('editRegistration');
  const shareReg  = $('shareRegistration');
  const downloadReg = $('downloadRegistrationPDF');

  function renderStudents() {
    tbody.innerHTML = '';
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    let idx=0;
    students.forEach((s,i)=>{
      if (s.cls!==cl||s.sec!==sec) return;
      idx++;
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td>
        <td>${s.occupation}</td><td>${s.address}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}">Pay</button></td>
      `;
      tbody.appendChild(tr);
    });
    selectAll.checked=false;
  }

  addBtn.onclick=async e=>{
    e.preventDefault();
    const n=$('studentName').value.trim(),
          p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(),
          o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim(),
          cl=$('teacherClassSelect').value,
          sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a) return alert('All fields required');
    const adm = await genAdmNo();
    students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls,sec});
    await set('students', students);
    renderStudents();
  };

  selectAll.onclick = ()=> tbody.querySelectorAll('.sel')
    .forEach(cb=>cb.checked=selectAll.checked);

  editSel.onclick = ()=>{/* implement inline edit logic if needed */};
  delSel.onclick = async ()=>{
    if (!confirm('Delete selected?')) return;
    const toDel = [...tbody.querySelectorAll('.sel:checked')]
      .map(cb=>+cb.closest('tr').dataset.index);
    students = students.filter((_,i)=>!toDel.includes(i));
    await set('students', students);
    renderStudents();
  };

  saveReg.onclick=async()=>{
    await set('students', students);
    alert('Students saved');
  };

  editReg.onclick=()=>{/* toggle registration UI back if you hide it */};

  document.addEventListener('change', e=>{
    if (e.target.classList.contains('sel')) {
      const any = !!tbody.querySelector('.sel:checked');
      editSel.disabled = delSel.disabled = !any;
    }
  });

  renderStudents();
}
