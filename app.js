// app.js (FULL)
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const THRESHOLD = 75;
  const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'var(--orange)', L:'var(--info)' };

  // --- SETUP ---
  const schoolIn = $('schoolNameInput'), classSel = $('teacherClassSelect'), secSel = $('teacherSectionSelect');
  const saveSet = $('saveSetup'), formSet = $('setupForm'), dispSet = $('setupDisplay'), txtSet = $('setupText'), editSet = $('editSetup');
  saveSet.onclick = () => {
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };
  editSet.onclick = () => {
    formSet.classList.remove('hidden');
    dispSet.classList.add('hidden');
  };
  function loadSetup() {
    const s = localStorage.getItem('schoolName'), c = localStorage.getItem('teacherClass'), e = localStorage.getItem('teacherSection');
    if (s && c && e) {
      schoolIn.value = s;
      classSel.value = c;
      secSel.value = e;
      txtSet.textContent = `${s} 🏫 | Class: ${c} | Section: ${e}`;
      formSet.classList.add('hidden');
      dispSet.classList.remove('hidden');
    }
  }
  loadSetup();

  // --- STUDENT REGISTRATION ---
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const inputs = ['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress'].map($);
  const addBtn = $('addStudent'), tblBody = $('studentsBody');
  const selectAll = $('selectAllStudents'), editSelected = $('editSelected'), deleteSelected = $('deleteSelected');
  const saveRegistration = $('saveRegistration'), shareRegistration = $('shareRegistration'), editRegistration = $('editRegistration');
  let registrationSaved = false, inlineEditMode = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function renderStudents() {
    tblBody.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td class="select-col" style="${registrationSaved?'display:none':''}"><input type=checkbox class=selectStudent data-index=${i}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${registrationSaved?'<button class="share-row">Share</button>':''}</td>`;
      if (registrationSaved) {
        tr.querySelector('.share-row').onclick = () => {
          const header = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
          const msg = `${header}\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
        };
      }
      tblBody.appendChild(tr);
    });
    bindSelection();
  }

  function bindSelection() {
    const boxes = [...document.querySelectorAll('.selectStudent')];
    boxes.forEach(cb => cb.onchange = () => {
      const tr = cb.closest('tr');
      cb.checked ? tr.classList.add('selected') : tr.classList.remove('selected');
      const any = boxes.some(x=>x.checked);
      editSelected.disabled = !any || registrationSaved;
      deleteSelected.disabled = !any || registrationSaved;
    });
    selectAll.disabled = registrationSaved;
    selectAll.onchange = () => {
      if (registrationSaved) return;
      boxes.forEach(cb => { cb.checked = selectAll.checked; cb.dispatchEvent(new Event('change')); });
    };
  }

  deleteSelected.onclick = () => {
    if (!confirm('Delete selected students?')) return;
    [...document.querySelectorAll('.selectStudent:checked')]
      .map(cb=>+cb.dataset.index).sort((a,b)=>b-a)
      .forEach(idx=>students.splice(idx,1));
    saveStudents(); renderStudents(); selectAll.checked=false;
  };

  function onCellBlur(e) {
    const td = e.target;
    const tr = td.closest('tr');
    const idx = +tr.querySelector('.selectStudent').dataset.index;
    const keys = ['name','adm','parent','contact','occupation','address'];
    const ci = Array.from(tr.children).indexOf(td);
    if (ci>=1 && ci<=6) {
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  }

  editSelected.onclick = () => {
    if (registrationSaved) return;
    const sel = [...document.querySelectorAll('.selectStudent:checked')];
    if (!sel.length) return;
    inlineEditMode = !inlineEditMode;
    editSelected.textContent = inlineEditMode ? 'Done Editing' : 'Edit Selected';
    sel.forEach(cb => {
      const tr = cb.closest('tr');
      [...tr.querySelectorAll('td')].forEach((td,ci) => {
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineEditMode;
          td.classList.toggle('editing', inlineEditMode);
          if (inlineEditMode) td.addEventListener('blur', onCellBlur);
          else td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  saveRegistration.onclick = () => {
    registrationSaved = true;
    editSelected.style.display = 'none';
    deleteSelected.style.display = 'none';
    selectAll.style.display = 'none';
    saveRegistration.style.display = 'none';
    shareRegistration.classList.remove('hidden');
    editRegistration.classList.remove('hidden');
    renderStudents();
  };

  editRegistration.onclick = () => {
    registrationSaved = false;
    editSelected.style.display = '';
    deleteSelected.style.display = '';
    selectAll.style.display = '';
    saveRegistration.style.display = '';
    shareRegistration.classList.add('hidden');
    editRegistration.classList.add('hidden');
    renderStudents();
  };

  shareRegistration.onclick = () => {
    const header = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s =>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`,'_blank');
  };

  addBtn.onclick = () => {
    if (registrationSaved) return;
    const vals = inputs.map(i=>i.value.trim());
    if (!vals[0]||!vals[1]) return alert('Name & Adm# required');
    students.push({ name: vals[0], adm: vals[1], parent: vals[2], contact: vals[3], occupation: vals[4], address: vals[5], roll: Date.now() });
    saveStudents(); renderStudents(); inputs.forEach(i=>i.value='');
  };

  renderStudents();

  // --- ATTENDANCE MARKING & SUMMARY ---
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');
  const dateIn = $('dateInput'), loadAtt = $('loadAttendance'), attList = $('attendanceList'), saveAtt = $('saveAttendance');
  const resSec = $('attendance-result'), summaryBody = $('summaryBody'), resetAtt = $('resetAttendance');

  loadAtt.onclick = () => {
    if (!dateIn.value) return alert('Pick date');
    attList.innerHTML = '';
    students.forEach((s,i)=>{
      const nameRow = document.createElement('div'); nameRow.className='attendance-item'; nameRow.textContent=s.name;
      const btnRow = document.createElement('div'); btnRow.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b = document.createElement('button'); b.className='att-btn'; b.dataset.code=code; b.textContent=code;
        if (attendanceData[dateIn.value]?.[s.roll]===code) { b.style.background=colors[code]; b.style.color='#fff'; }
        b.onclick = () => {
          [...btnRow.children].forEach(x=>{ x.style.background='transparent'; x.style.color='var(--dark)'; });
          b.style.background=colors[code]; b.style.color='#fff';
        };
        btnRow.append(b);
      });
      attList.append(nameRow, btnRow);
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick = () => {
    const d = dateIn.value; attendanceData[d] = {};
    attList.querySelectorAll('.attendance-actions').forEach((row,i)=>{
      const b = row.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll] = b ? b.dataset.code : 'Not marked';
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    $('attendance-section').classList.add('hidden'); resSec.classList.remove('hidden');
    summaryBody.innerHTML = '';
    // header row
    summaryBody.insertAdjacentHTML('beforebegin', 
      `<tr><td colspan="3"><em>School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')} | Date: ${d}</em></td></tr>`
    );
    students.forEach(s=>{
      const st = attendanceData[d][s.roll];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${st}</td><td>` +
        `<button class="send">Send</button></td>`;
      tr.querySelector('.send').onclick = () => {
        const remarkMap = { P:'Good attendance—keep it up!', A:'Please ensure regular attendance.', Lt:'Remember to arrive on time.', HD:'Submit permission note for half-day.', L:'Attend when possible.' };
        const remark = remarkMap[st] || '';
        const msg = [
          `Date: ${d}`,
          `School: ${localStorage.getItem('schoolName')}`,
          `Class: ${localStorage.getItem('teacherClass')}`,
          `Section: ${localStorage.getItem('teacherSection')}`,
          '',
          `Name: ${s.name}`,
          `Status: ${st}`,
          `Remarks: ${remark}`
        ].join('\n');
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  resetAtt.onclick = () => {
    resSec.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    attList.innerHTML = '';
    saveAtt.classList.add('hidden');
    summaryBody.innerHTML = '';
  };

  // DOWNLOAD Attendance Summary PDF
  $('downloadAttendanceSummary').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    let y = 20;
    const header = [`School: ${localStorage.getItem('schoolName')}`,
                    `Class: ${localStorage.getItem('teacherClass')}`,
                    `Section: ${localStorage.getItem('teacherSection')}`,
                    `Date: ${$('dateInput').value}`].join(' | ');
    doc.setFontSize(14);
    doc.text(header, 20, y);
    y += 20;
    doc.autoTable({
      html: document.querySelector('#attendance-result table'),
      startY: y,
      theme: 'grid',
      headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4 }
    });
    doc.save(`Attendance_Summary_${$('dateInput').value}.pdf`);
  };

  // --- ANALYTICS ---
  const typeSel=$('analyticsType'), aDate=$('analyticsDate'), aMonth=$('analyticsMonth'), semStart=$('semesterStart'), semEnd=$('semesterEnd'), yrStart=$('yearStart');
  const loadAnalytics=$('loadAnalytics'), resetAnalytics=$('resetAnalytics'), instr=$('instructions'), contA=$('analyticsContainer'), graphs=$('graphs');
  const shareAnalytics=$('shareAnalytics'), downloadAnalytics=$('downloadAnalytics');
  const barCtx=$('barChart').getContext('2d'), pieCtx=$('pieChart').getContext('2d');
  window.summaryData = []; // global for share
  function toggleInputs(){[aDate,aMonth,semStart,...
