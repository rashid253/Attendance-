// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- Eruda Console ---
  // Eruda script already loaded in HTML

  // --- IndexedDB (idb-keyval) ---
  const { get, set } = window.idbKeyval;
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;
  const saveStudents       = () => set('students', students);
  const saveAttendance     = () => set('attendanceData', attendanceData);
  const saveLastAdm        = () => set('lastAdmissionNo', lastAdmNo);
  async function genAdm() {
    lastAdmNo++;
    await saveLastAdm();
    return String(lastAdmNo).padStart(4,'0');
  }

  // --- DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = el => el && el.classList.remove('hidden');
  const hide = el => el && el.classList.add('hidden');

  // --- SETUP ---
  async function loadSetup() {
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if (school && cls && sec) {
      $('setupText').textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      show($('setupDisplay'));
      hide($('setupForm'));
      renderStudents();
      updateCounters();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const school = $('schoolNameInput').value.trim(),
          cls    = $('teacherClassSelect').value,
          sec    = $('teacherSectionSelect').value;
    if (!school||!cls||!sec) return alert('Complete setup');
    await set('schoolName', school);
    await set('teacherClass', cls);
    await set('teacherSection', sec);
    await loadSetup();
  };
  $('editSetup').onclick = e => {
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };
  await loadSetup();

  // --- COUNTERS ---
  function animate() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target/100);
      (function upd() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(upd);
      })();
    });
  }
  function updateCounters() {
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cls&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cls).length;
    $('schoolCount').dataset.target  = students.length;
    animate();
  }
  $('teacherClassSelect').onchange   = updateCounters;
  $('teacherSectionSelect').onchange = updateCounters;

  // --- STUDENT REGISTRATION ---
  function renderStudents() {
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><input type="checkbox" class="sel"></td>
                      <td>${i+1}</td><td>${s.name}</td><td>${s.adm}</td>
                      <td>${s.parent}</td><td>${s.contact}</td>
                      <td>${s.occupation}</td><td>${s.address}</td>`;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleEdit();
  }
  $('addStudent').onclick = async () => {
    const name = $('studentName').value.trim(),
          parent = $('parentName').value.trim(),
          contact = $('parentContact').value.trim(),
          occupation = $('parentOccupation').value.trim(),
          address = $('parentAddress').value.trim();
    if (!name||!parent||!contact||!occupation||!address) return alert('All fields required');
    const adm = await genAdm();
    students.push({ name, adm, parent, contact, occupation, address,
      cls: $('teacherClassSelect').value, sec: $('teacherSectionSelect').value });
    await saveStudents();
    renderStudents();
    updateCounters();
  };
  function toggleEdit() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleEdit();
  });
  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(cb=>cb.checked=$('selectAllStudents').checked);
    toggleEdit();
  };
  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected?')) return;
    students = students.filter((_,i)=>![...document.querySelectorAll('.sel')]
      .some(cb=>cb.checked && +cb.closest('tr').rowIndex-1===i));
    await saveStudents();
    renderStudents();
    updateCounters();
  };
  $('saveRegistration').onclick = async () => {
    await saveStudents();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>hide($(id)));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id=>show($(id)));
  };
  $('downloadRegistrationPDF').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html:'#studentsTable' });
    doc.save('registration.pdf');
  };
  $('shareRegistration').onclick = () => {
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const hdr = `Students Class:${cls}-${sec}`;
    const lines = students.map(s=>`${s.adm}: ${s.name}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`, '_blank');
  };
  $('editRegistration').onclick = () => {
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>show($(id)));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id=>hide($(id)));
  };

  // --- ATTENDANCE SECTION ---
  const dateInput       = $('dateInput'),
        loadAtt         = $('loadAttendance'),
        saveAtt         = $('saveAttendance'),
        resetAtt        = $('resetAttendance'),
        dlAttPDF        = $('downloadAttendancePDF'),
        shareAtt        = $('shareAttendanceSummary'),
        attBody         = $('attendanceBody'),
        attSummary      = $('attendanceSummary');
  const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  loadAtt.onclick = () => {
    attBody.innerHTML = '';
    students.forEach((s,i) => {
      const row = document.createElement('div'); row.className='attendance-row';
      const nm = document.createElement('div'); nm.className='attendance-name'; nm.textContent=s.name;
      const btns = document.createElement('div'); btns.className='attendance-buttons';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b = document.createElement('button'); b.className='att-btn'; b.textContent=code;
        b.onclick = () => {
          btns.querySelectorAll('.att-btn').forEach(x=>{x.classList.remove('selected'); x.style.background='';});
          b.classList.add('selected'); b.style.background=colors[code];
        };
        btns.appendChild(b);
      });
      row.append(nm, btns); attBody.appendChild(row);
    });
    show(saveAtt); hide(resetAtt); hide(dlAttPDF); hide(shareAtt); hide(attSummary);
  };

  saveAtt.onclick = async () => {
    const date = dateInput.value; if(!date) return alert('Pick a date');
    attendanceData[date] = {};
    attBody.querySelectorAll('.attendance-row').forEach((row,i) => {
      const sel = row.querySelector('.att-btn.selected');
      attendanceData[date][students[i].adm] = sel ? sel.textContent : 'A';
    });
    await saveAttendance();
    hide(saveAtt); hide(attBody);
    attSummary.innerHTML = `<h3>Date: ${date}</h3><ul>` +
      students.map(s=>`<li>${s.name}: ${attendanceData[date][s.adm]}</li>`).join('') +
      `</ul>`;
    show(attSummary); show(resetAtt); show(dlAttPDF); show(shareAtt);
  };

  dlAttPDF.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(attSummary.innerText, 10, 10);
    doc.save('attendance.pdf');
  };
  shareAtt.onclick = () => {
    const text = attSummary.innerText;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };
  resetAtt.onclick = () => {
    show(attBody); show(saveAtt); hide(attSummary); hide(resetAtt); hide(dlAttPDF); hide(shareAtt);
  };

  // --- ATTENDANCE REGISTER ---
  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value; if(!m) return alert('Pick month');
    const [y,mm] = m.split('-').map(Number), days = new Date(y,mm,0).getDate();
    const hdr = $('registerHeader');
    hdr.innerHTML = '<th>#</th><th>Adm#</th><th>Name</th>' + Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    const tb = $('registerBody'); tb.innerHTML='';
    students.forEach((s,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`+
        Array.from({length:days},()=>`<td>A</td>`).join('');
      tb.appendChild(tr);
    });
    show($('registerTableWrapper')); show($('changeRegister')); hide($('loadRegister'));
  };
  $('changeRegister').onclick = () => {
    hide($('registerTableWrapper')); hide($('changeRegister')); show($('loadRegister'));
  };
});
