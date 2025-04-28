// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // Eruda Debug Console
  (function(){
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/eruda';
    s.onload = () => eruda.init();
    document.body.appendChild(s);
  })();

  // idb-keyval IndexedDB
  if (!window.idbKeyval) { console.error('idbKeyval not found'); return; }
  const { get, set } = window.idbKeyval;

  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;
  let isShareMode    = false;

  const saveStudents       = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);
  const saveLastAdmNo      = () => set('lastAdmissionNo', lastAdmNo);

  async function generateAdmNo() {
    lastAdmNo++; await saveLastAdmNo();
    return String(lastAdmNo).padStart(4, '0');
  }

  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(el=>el&&el.classList.remove('hidden'));
  const hide = (...els) => els.forEach(el=>el&&el.classList.add('hidden'));

  // 1. SETUP
  async function loadSetup() {
    const [school, cls, sec] = await Promise.all([
      get('schoolName'), get('teacherClass'), get('teacherSection')
    ]);
    if (school && cls && sec) {
      $('schoolNameInput').value = school;
      $('teacherClassSelect').value = cls;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      hide($('setupForm')); show($('setupDisplay'));
      renderStudents(); updateCounters();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const school = $('schoolNameInput').value.trim(),
          cls    = $('teacherClassSelect').value,
          sec    = $('teacherSectionSelect').value;
    if (!school||!cls||!sec) return alert('Complete setup');
    await Promise.all([
      set('schoolName', school),
      set('teacherClass', cls),
      set('teacherSection', sec)
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // 2. COUNTERS
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target/100);
      (function update() {
        count += step;
        span.textContent = count<target? Math.ceil(count): target;
        if (count<target) requestAnimationFrame(update);
      })();
    });
  }
  function updateCounters() {
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cls&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cls).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  $('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); };

  // 3. STUDENT REGISTRATION
  function renderStudents() {
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody'); tbody.innerHTML = '';
    students.filter(s=>s.cls===cls&&s.sec===sec).forEach((stu,i) => {
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      let html = `
        <td><input type="checkbox" class="sel"></td>
        <td>${i+1}</td><td>${stu.name}</td><td>${stu.adm}</td>
        <td>${stu.parent}</td><td>${stu.contact}</td>
        <td>${stu.occupation}</td><td>${stu.address}</td>
        <td>${isShareMode? `<i class="fas fa-share-alt share-row" data-index="${i}"></i>`: ''}</td>
      `;
      tr.innerHTML = html;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleSelectionButtons();
    if (isShareMode) {
      document.querySelectorAll('.share-row').forEach(icon => {
        icon.onclick = () => {
          const s = students[+icon.dataset.index];
          const msg = `*${s.name}*\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
        };
      });
    }
  }

  $('addStudent').onclick = async e => {
    e.preventDefault();
    const name = $('studentName').value.trim(),
          parent = $('parentName').value.trim(),
          contact = $('parentContact').value.trim(),
          occupation = $('parentOccupation').value.trim(),
          address = $('parentAddress').value.trim(),
          cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    if (!name||!parent||!contact||!occupation||!address) return alert('All fields required');
    if (!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits');
    const adm = await generateAdmNo();
    students.push({ name, adm, parent, contact, occupation, address, cls, sec });
    await saveStudents();
    renderStudents(); updateCounters();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress']
      .forEach(id=>$(id).value='');
  };

  function toggleSelectionButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleSelectionButtons();
  });
  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(cb=>cb.checked = $('selectAllStudents').checked);
    toggleSelectionButtons();
  };
  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected?')) return;
    const toDel = Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb=>+cb.closest('tr').dataset.index);
    students = students.filter((_,i)=>!toDel.includes(i));
    await saveStudents(); renderStudents(); updateCounters();
  };

  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach(cb=>{
      const tr = cb.closest('tr'), idx=+tr.dataset.index, s=students[idx];
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" checked></td>
        <td>${idx+1}</td>
        <td><input value="${s.name}"></td>
        <td>${s.adm}</td>
        <td><input value="${s.parent}"></td>
        <td><input value="${s.contact}"></td>
        <td><input value="${s.occupation}"></td>
        <td><input value="${s.address}"></td>
        <td></td>
      `;
    });
    hide($('editSelected'), $('deleteSelected'));
    show($('doneEditing'));
  };

  $('doneEditing').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach(tr=>{
      const inputs = tr.querySelectorAll('input:not(.sel)');
      if (inputs.length===5) {
        const [name, parent, contact, occupation, address] = Array.from(inputs).map(i=>i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(s=>s.adm===adm);
        if (idx>-1) students[idx] = {...students[idx], name, parent, contact, occupation, address};
      }
    });
    await saveStudents();
    hide($('doneEditing'));
    show($('editSelected'), $('deleteSelected'));
    isShareMode = false;
    renderStudents(); updateCounters();
  };

  $('saveRegistration').onclick = async () => {
    await saveStudents();
    hide($('editSelected'), $('deleteSelected'), $('selectAllStudents'), $('saveRegistration'));
    isShareMode = true;
    show($('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents();
  };

  $('shareRegistration').onclick = () => {
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\\nClass ${cls} Section ${sec}`;
    const lines = students.filter(s=>s.cls===cls&&s.sec===sec).map(s=>
      `*${s.name}*\\nAdm#: ${s.adm}\\nParent: ${s.parent}\\nContact: ${s.contact}\\nOccupation: ${s.occupation}\\nAddress: ${s.address}`
    ).join('\\n\\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\\n\\n'+lines)}`,'_blank');
  };

  $('downloadRegistrationPDF').onclick = () => {
    const doc = new window.jspdf.jsPDF();
    doc.autoTable({ html: '#studentsTable' });
    doc.save('registration.pdf');
  };

  // 4. ATTENDANCE SECTION
  const dateInput = $('dateInput'),
        loadAttendance = $('loadAttendance'),
        saveAttendance = $('saveAttendance'),
        resetAttendance = $('resetAttendance'),
        downloadAttendancePDF = $('downloadAttendancePDF'),
        shareAttendanceSummary = $('shareAttendanceSummary'),
        attendanceBody = $('attendanceBody'),
        attendanceSummary = $('attendanceSummary');

  const statusNames = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' };

  loadAttendance.onclick = () => {
    attendanceBody.innerHTML = '';
    students.forEach(stu=>{
      const row = document.createElement('div'); row.className='attendance-row';
      const nameDiv = document.createElement('div'); nameDiv.className='attendance-name'; nameDiv.textContent=stu.name;
      const btns = document.createElement('div'); btns.className='attendance-buttons';
      Object.entries(statusNames).forEach(([code,full])=>{
        const btn = document.createElement('button');
        btn.className='att-btn'; btn.textContent=code;
        btn.onclick = ()=>{
          btns.querySelectorAll('.att-btn').forEach(b=>{
            b.classList.remove('selected');
            b.style.background=''; b.style.color='';
          });
          btn.classList.add('selected');
          btn.style.background = `var(--${full.toLowerCase().replace(' ','')})`;
          btn.style.color = '#fff';
        };
        btns.appendChild(btn);
      });
      row.append(nameDiv, btns);
      attendanceBody.appendChild(row);
    });
    show(saveAttendance);
    hide(resetAttendance, downloadAttendancePDF, shareAttendanceSummary, attendanceSummary);
  };

  saveAttendance.onclick = async () => {
    const date = dateInput.value; if (!date) return alert('Pick a date');
    attendanceData[date] = {};
    attendanceBody.querySelectorAll('.attendance-row').forEach((row,i)=>{
      const sel = row.querySelector('.att-btn.selected');
      const code = sel? sel.textContent : 'A';
      attendanceData[date][students[i].adm] = code;
    });
    await saveAttendanceData();
    const tbl = document.createElement('table');
    tbl.innerHTML = '<tr><th>Name</th><th>Status</th></tr>' +
      students.map(s=>{
        const st = statusNames[attendanceData[date][s.adm]||'A'];
        return `<tr><td>${s.name}</td><td>${st}</td></tr>`;
      }).join('');
    attendanceSummary.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    attendanceSummary.appendChild(tbl);

    hide(saveAttendance, attendanceBody);
    show(resetAttendance, downloadAttendancePDF, shareAttendanceSummary, attendanceSummary);
  };

  downloadAttendancePDF.onclick = () => {
    const doc = new window.jspdf.jsPDF();
    doc.autoTable({ html: '#attendanceSummary table' });
    doc.save('attendance_summary.pdf');
  };
  shareAttendanceSummary.onclick = () => {
    const text = attendanceSummary.textContent.trim();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank');
  };
  resetAttendance.onclick = () => {
    show(attendanceBody, saveAttendance);
    hide(resetAttendance, downloadAttendancePDF, shareAttendanceSummary, attendanceSummary);
  };

  // 5. ANALYTICS & 6. REGISTER remain unchanged...

  // SERVICE WORKER
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(console.error);
});
