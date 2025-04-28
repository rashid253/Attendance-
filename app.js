// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // Eruda Debug Console
  (function(){
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/eruda';
    s.onload = () => eruda.init();
    document.body.appendChild(s);
  })();

  // idb-keyval IndexedDB (IIFE exposes global `idbKeyval`)
  if (typeof idbKeyval === 'undefined') {
    console.error('idbKeyval not found');
    return;
  }
  const { get, set } = idbKeyval;

  // State
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;
  let lastShareText  = '';
  let lastAnalyticsShare = '';

  // Helpers
  const saveStudents       = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);
  const saveLastAdmNo      = () => set('lastAdmissionNo', lastAdmNo);
  async function generateAdmNo() {
    lastAdmNo++;
    await saveLastAdmNo();
    return String(lastAdmNo).padStart(4, '0');
  }
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(el => el && el.classList.remove('hidden'));
  const hide = (...els) => els.forEach(el => el && el.classList.add('hidden'));

  //
  // 1. SETUP
  //
  async function loadSetup() {
    const [school, cls, sec] = await Promise.all([
      get('schoolName'),
      get('teacherClass'),
      get('teacherSection')
    ]);
    if (school && cls && sec) {
      $('schoolNameInput').value = school;
      $('teacherClassSelect').value = cls;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderStudents();
      updateCounters();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const school = $('schoolNameInput').value.trim();
    const cls    = $('teacherClassSelect').value;
    const sec    = $('teacherSectionSelect').value;
    if (!school || !cls || !sec) return alert('Complete setup');
    await Promise.all([
      set('schoolName', school),
      set('teacherClass', cls),
      set('teacherSection', sec)
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => {
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };
  await loadSetup();

  //
  // 2. COUNTERS
  //
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target/100);
      (function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
      })();
    });
  }
  function updateCounters() {
    const cls = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s => s.cls===cls && s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s => s.cls===cls).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  $('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); };

  //
  // 3. STUDENT REGISTRATION
  //
  function renderStudents() {
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    students.filter(s => s.cls===cls && s.sec===sec).forEach((stu, i) => {
      const tr = document.createElement('tr'); tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${i+1}</td>
        <td>${stu.name}</td>
        <td>${stu.adm}</td>
        <td>${stu.parent}</td>
        <td>${stu.contact}</td>
        <td>${stu.occupation}</td>
        <td>${stu.address}</td>
        <td>${$('shareRegistration').classList.contains('hidden') ? '' : `<i class="fas fa-share-alt share-row" data-index="${i}"></i>`}</td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleButtons();
    document.querySelectorAll('.share-row').forEach(icon => {
      icon.onclick = () => {
        const s = students[+icon.dataset.index];
        const msg = `*${s.name}*\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      };
    });
  }
  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleButtons();
  });
  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(cb => cb.checked = $('selectAllStudents').checked);
    toggleButtons();
  };
  $('addStudent').onclick = async e => {
    e.preventDefault();
    const name       = $('studentName').value.trim(),
          parent     = $('parentName').value.trim(),
          contact    = $('parentContact').value.trim(),
          occupation = $('parentOccupation').value.trim(),
          address    = $('parentAddress').value.trim(),
          cls        = $('teacherClassSelect').value,
          sec        = $('teacherSectionSelect').value;
    if (!name || !parent || !contact || !occupation || !address) return alert('All fields required');
    if (!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits');
    const adm = await generateAdmNo();
    students.push({ name, adm, parent, contact, occupation, address, cls, sec });
    await saveStudents();
    renderStudents(); updateCounters();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id => $(id).value = '');
  };
  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected?')) return;
    const toDel = Array.from(document.querySelectorAll('.sel:checked')).map(cb => +cb.closest('tr').dataset.index);
    students = students.filter((_, i) => !toDel.includes(i));
    await saveStudents(); renderStudents(); updateCounters();
  };
  // editSelected, doneEditing, saveRegistration, shareRegistration, downloadRegistrationPDF handlers remain unchanged

  //
  // 4. MARK ATTENDANCE
  //
  // loadAttendance, saveAttendance, downloadAttendancePDF, shareAttendanceSummary, resetAttendance handlers remain unchanged

  //
  // 5. ANALYTICS
  //
  // analyticsTarget.onchange, analyticsType.onchange, resetAnalytics, loadAnalyticsBtn, shareAnalyticsBtn, downloadAnalyticsBtn remain unchanged

  //
  // 6. ATTENDANCE REGISTER (corrected)
  //
  const codes = ['A','P','Lt','HD','L'];
  const statusColors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value;
    if (!m) return alert('Pick month');
    const [y, mm] = m.split('-').map(Number);
    const days = new Date(y, mm, 0).getDate();

    // Header
    $('registerHeader').innerHTML =
      '<th>#</th><th>Adm#</th><th>Name</th>' +
      Array.from({ length: days }, (_, i) => `<th>${i+1}</th>`).join('');

    // Body
    const tb = $('registerBody');
    tb.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d = 0; d < days; d++) {
        row += `<td class="reg-cell"><span class="status-text">A</span></td>`;
      }
      tr.innerHTML = row;
      tb.appendChild(tr);
    });

    // Cycle statuses on click
    document.querySelectorAll('.reg-cell').forEach(cell => {
      const span = cell.querySelector('.status-text');
      cell.addEventListener('click', () => {
        let idx = codes.indexOf(span.textContent);
        idx = (idx + 1) % codes.length;
        const code = codes[idx];
        span.textContent = code;
        if (code === 'A') {
          cell.style.background = '';
          cell.style.color = '';
        } else {
          cell.style.background = statusColors[code];
          cell.style.color = '#fff';
        }
      });
    });

    show($('registerTableWrapper'), $('changeRegister'), $('downloadRegister'), $('shareRegister'));
    hide($('loadRegister'));
  };

  $('changeRegister').onclick = () => {
    hide($('registerTableWrapper'), $('changeRegister'), $('downloadRegister'), $('shareRegister'));
    show($('loadRegister'));
  };

  $('downloadRegister').onclick = () => {
    const doc = new window.jspdf.jsPDF();
    doc.autoTable({ html: '#registerTable' });
    doc.save('attendance_register.pdf');
  };

  $('shareRegister').onclick = () => {
    const hdr = `Attendance Register: ${$('registerMonth').value}`;
    const rows = Array.from(document.querySelectorAll('#registerBody tr')).map(tr =>
      Array.from(tr.querySelectorAll('td')).map(td => {
        const txt = td.querySelector('.status-text');
        return txt ? txt.textContent.trim() : td.textContent.trim();
      }).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n' + rows.join('\n'))}`, '_blank');
  };

  // Service Worker
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(console.error);
});
