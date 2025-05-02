// app.js — Part 1/3
window.addEventListener('DOMContentLoaded', async () => {
  // --- 0. Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- 1. IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) {
    console.error('idb-keyval not found');
    return;
  }
  const { get, set } = window.idbKeyval;
  const save = (key, val) => set(key, val);

  // --- 2. State & Defaults ---
  let students        = await get('students')        || [];
  let attendanceData  = await get('attendanceData')  || {};
  let finesData       = await get('finesData')       || {};
  let paymentsData    = await get('paymentsData')    || {};
  let lastAdmNo       = await get('lastAdmissionNo') || 0;
  let fineRates       = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct  = await get('eligibilityPct')  || 75;

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 3. DOM Helpers ---
  const $    = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- 4. SEARCH & FILTER STATE ---
  let searchTerm     = '';
  let filterOptions  = { time: null, info: [], all: false };
  const globalSearch = $('globalSearch');
  const filterBtn    = $('filterBtn');
  const filterDialog = $('filterDialog');
  const closeFilter  = $('closeFilter');
  const applyFilter  = $('applyFilter');
  const timeChecks   = filterDialog.querySelectorAll('input[name="timeFilter"]');
  const infoChecks   = filterDialog.querySelectorAll('input[name="infoFilter"]');
  const pickers      = {
    'date-day':  $('picker-date'),
    'month':     $('picker-month'),
    'semester':  $('picker-semester'),
    'year':      $('picker-year'),
  };

  globalSearch.oninput = e => {
    searchTerm = e.target.value.trim().toLowerCase();
    renderStudents();
  };
  filterBtn.onclick = () => show(filterDialog);
  closeFilter.onclick = () => hide(filterDialog);
  timeChecks.forEach(c => {
    c.onchange = () => {
      Object.entries(pickers).forEach(([k, el]) => {
        el.classList.toggle('hidden', k !== c.value);
      });
    };
  });

  applyFilter.onclick = () => {
    try {
      const t = [...timeChecks].find(c => c.checked)?.value;
      filterOptions.time = t || null;
      filterOptions.info = [...infoChecks].filter(i => i.checked).map(i => i.value);
      filterOptions.all  = filterOptions.info.includes('all');
      hide(filterDialog);
      renderStudents();
    } catch (err) {
      console.error('Filter error suppressed:', err);
    }
  };

  // --- 5. SETUP ---
  const setupForm    = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const saveSetup    = $('saveSetup');
  const editSetup    = $('editSetup');

  function renderSetup() {
    const school = $('schoolNameInput').value.trim();
    const grade  = $('teacherClassSelect').value;
    const sect   = $('teacherSectionSelect').value;
    $('setupText').textContent = `${school} | ${grade}-${sect}`;
    show(setupDisplay);
    hide(setupForm);
  }

  saveSetup.onclick = async () => {
    const school = $('schoolNameInput').value.trim();
    const grade  = $('teacherClassSelect').value;
    const sect   = $('teacherSectionSelect').value;
    await Promise.all([
      save('schoolName', school),
      save('teacherClass', grade),
      save('teacherSection', sect)
    ]);
    renderSetup();
    renderStudents();
    updateCounters();
    resetViews();
  };

  editSetup.onclick = () => {
    show(setupForm);
    hide(setupDisplay);
  };

  // Load saved setup on init
  const savedSchool = await get('schoolName');
  const savedClass  = await get('teacherClass');
  const savedSect   = await get('teacherSection');
  if (savedSchool && savedClass && savedSect) {
    $('schoolNameInput').value       = savedSchool;
    $('teacherClassSelect').value    = savedClass;
    $('teacherSectionSelect').value  = savedSect;
    renderSetup();
  }

  // --- 6. STUDENTS & COUNTERS ---
  const studentsBody = $('studentsBody');
  const sectionCount = $('sectionCount');
  const classCount   = $('classCount');
  const schoolCount  = $('schoolCount');

  function renderStudents() {
    studentsBody.innerHTML = '';
    students
      .filter(s => {
        if (s.class !== $('teacherClassSelect').value || s.section !== $('teacherSectionSelect').value) return false;
        if (searchTerm && !`${s.admNo} ${s.name}`.toLowerCase().includes(searchTerm)) return false;
        if (!filterOptions.all) {
          if (filterOptions.time) {
            // implement time filtering...
          }
          if (filterOptions.info.length) {
            // implement info filtering...
          }
        }
        return true;
      })
      .forEach(s => {
        const tr = document.createElement('tr');
        // ... build each <tr> with s.admNo, s.name, etc.
        studentsBody.appendChild(tr);
      });
  }

  function updateCounters() {
    const cls = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    sectionCount.textContent = students.filter(s => s.class === cls && s.section === sec).length;
    classCount.textContent   = students.filter(s => s.class === cls).length;
    schoolCount.textContent  = students.length;
  }

  function resetViews() {
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'),
      $('registerTableWrapper'), $('changeRegister'), $('saveRegister'),
      $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }

  $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };
  // app.js — Part 2/3

// --- 7. COUNTERS & UTILS ---
function animateCounters() {
  document.querySelectorAll('.number').forEach(span => {
    const target = +span.dataset.target;
    let count = 0;
    const step = Math.max(1, target / 100);
    (function upd() {
      count += step;
      span.textContent = count < target ? Math.ceil(count) : target;
      if (count < target) requestAnimationFrame(upd);
    })();
  });
}

function updateCounters() {
  const cls = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;
  sectionCount.textContent = students.filter(s => s.cls === cls && s.sec === sec).length;
  classCount.textContent   = students.filter(s => s.cls === cls).length;
  schoolCount.textContent  = students.length;
}

// --- 8. STUDENT REGISTRATION & TABLE ACTIONS ---
// Cache buttons & table
const selectAllStudents     = $('selectAllStudents');
const editSelectedBtn       = $('editSelected');
const doneEditingBtn        = $('doneEditing');
const deleteSelectedBtn     = $('deleteSelected');
const saveRegistrationBtn   = $('saveRegistration');
const shareRegistrationBtn  = $('shareRegistration');
const downloadRegistrationPDFBtn = $('downloadRegistrationPDF');

// Toggle Edit/Delete/Save buttons based on selection
function toggleButtons() {
  const anyChecked = !!document.querySelector('.sel:checked');
  editSelectedBtn.disabled   = !anyChecked;
  deleteSelectedBtn.disabled = !anyChecked;
}
selectAllStudents.onclick = () => {
  document.querySelectorAll('.sel').forEach(cb => cb.checked = selectAllStudents.checked);
  toggleButtons();
};

// Edit selected rows in‑place
editSelectedBtn.onclick = () => {
  document.querySelectorAll('.sel:checked').forEach(cb => {
    const tr = cb.closest('tr');
    const i  = +tr.dataset.index;
    const s  = students[i];
    tr.innerHTML = `
      <td><input type="checkbox" class="sel" checked></td>
      <td>${i+1}</td>
      <td><input value="${s.name}" /></td>
      <td>${s.adm}</td>
      <td><input value="${s.parent}" /></td>
      <td><input value="${s.contact}" /></td>
      <td><input value="${s.occupation}" /></td>
      <td><input value="${s.address}" /></td>
      <td>PKR ${s.fine || 0}</td>
      <td>${s.status}</td>
      <td></td>
    `;
  });
  hide(editSelectedBtn, deleteSelectedBtn, saveRegistrationBtn);
  show(doneEditingBtn);
};

// Commit edits
doneEditingBtn.onclick = async () => {
  document.querySelectorAll('tbody#studentsBody tr').forEach(tr => {
    const cb     = tr.querySelector('.sel');
    if (cb && cb.checked) {
      const inputs = [...tr.querySelectorAll('input:not(.sel)')];
      if (inputs.length === 5) {
        const [n, p, c, o, a] = inputs.map(i => i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(s => s.adm === adm);
        if (idx > -1) {
          students[idx] = { ...students[idx], name:n, parent:p, contact:c, occupation:o, address:a };
        }
      }
    }
  });
  await save('students', students);
  hide(doneEditingBtn);
  show(editSelectedBtn, deleteSelectedBtn, saveRegistrationBtn);
  renderStudents();
  updateCounters();
};

// Delete selected
deleteSelectedBtn.onclick = async () => {
  students = students.filter((s, i) =>
    !document.querySelector(`tbody#studentsBody tr[data-index="${i}"] .sel`).checked
  );
  await save('students', students);
  renderStudents();
  updateCounters();
  toggleButtons();
};

// Save registration data (export/share)
saveRegistrationBtn.onclick = () => {
  save('students', students);
  shareRegistrationBtn.classList.remove('hidden');
  downloadRegistrationPDFBtn.classList.remove('hidden');
};

// Share via WhatsApp
shareRegistrationBtn.onclick = () => {
  const header = `Student List\n${$('setupText').textContent}`;
  const rows = Array.from($('studentsBody').children).map(tr =>
    Array.from(tr.children).slice(1,6).map(td => td.textContent).join(' ')
  );
  window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows.join('\n'))}`, '_blank');
};

// Download as PDF
downloadRegistrationPDFBtn.onclick = () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.autoTable({ html: '#studentsTable' });
  doc.save('Student_Registration.pdf');
};

// --- Add New Student ---
$('addStudent').onclick = async e => {
  e.preventDefault();
  const n   = $('studentName').value.trim();
  const p   = $('parentName').value.trim();
  const c   = $('parentContact').value.trim();
  const o   = $('parentOccupation').value.trim();
  const a   = $('parentAddress').value.trim();
  const cl  = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;
  if (!n || !p || !c || !o || !a) {
    alert('All fields are required.');
    return;
  }
  const adm = await genAdmNo();
  students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec, fine:0, status:'Eligible' });
  await save('students', students);
  renderStudents();
  updateCounters();
  resetViews();
  ['studentName','parentName','parentContact','parentOccupation','parentAddress']
    .forEach(id => $(id).value = '');
};
  // app.js (part 3/3)

// --- 9. PAYMENT MODAL ---
function openPaymentModal(adm) {
  $('payAdm').textContent = adm;
  $('paymentAmount').value = '';
  show($('paymentModal'));
}
$('savePayment').onclick = async () => {
  const adm = $('payAdm').textContent;
  const amt = Number($('paymentAmount').value) || 0;
  paymentsData[adm] = paymentsData[adm] || [];
  paymentsData[adm].push({ date: new Date().toISOString().split('T')[0], amount: amt });
  await save('paymentsData', paymentsData);
  hide($('paymentModal'));
  renderStudents();
};
$('cancelPayment').onclick = () => hide($('paymentModal'));

// --- 10. MARK ATTENDANCE ---
const dateInput             = $('dateInput');
const loadAttendanceBtn     = $('loadAttendance');
const saveAttendanceBtn     = $('saveAttendance');
const resetAttendanceBtn    = $('resetAttendance');
const downloadAttendanceBtn = $('downloadAttendancePDF');
const shareAttendanceBtn    = $('shareAttendanceSummary');
const attendanceBodyDiv     = $('attendanceBody');
const attendanceSummaryDiv  = $('attendanceSummary');
const statusNames           = { P: 'Present', A: 'Absent', Lt: 'Late', HD: 'Half-Day', L: 'Leave' };
const statusColors          = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: '#FF9800', L: 'var(--info)' };

loadAttendanceBtn.onclick = () => {
  attendanceBodyDiv.innerHTML = '';
  attendanceSummaryDiv.innerHTML = '';
  const cl = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;
  const roster = students.filter(s => s.cls === cl && s.sec === sec);
  roster.forEach(stu => {
    const row = document.createElement('div');
    row.className = 'attendance-row';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'attendance-name';
    nameDiv.textContent = stu.name;
    const btnsDiv = document.createElement('div');
    btnsDiv.className = 'attendance-buttons';
    Object.keys(statusNames).forEach(code => {
      const btn = document.createElement('button');
      btn.className = 'att-btn';
      btn.textContent = code;
      btn.onclick = () => {
        btnsDiv.querySelectorAll('.att-btn').forEach(b => {
          b.classList.remove('selected');
          b.style.background = '';
          b.style.color = '';
        });
        btn.classList.add('selected');
        btn.style.background = statusColors[code];
        btn.style.color = '#fff';
      };
      btnsDiv.appendChild(btn);
    });
    row.append(nameDiv, btnsDiv);
    attendanceBodyDiv.appendChild(row);
  });
  show(attendanceBodyDiv, saveAttendanceBtn);
  hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
};

saveAttendanceBtn.onclick = async () => {
  const date = dateInput.value;
  if (!date) { alert('Pick a date'); return; }
  const cl = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;
  const roster = students.filter(s => s.cls === cl && s.sec === sec);
  roster.forEach((stu, i) => {
    const adm = stu.adm;
    const code = attendanceBodyDiv.children[i]
      .querySelector('.att-btn.selected')?.textContent || 'A';
    attendanceData[date] = attendanceData[date] || {};
    attendanceData[date][adm] = code;
  });
  await save('attendanceData', attendanceData);
  // build summary table...
  attendanceSummaryDiv.innerHTML = '<table><tr><th>Name</th><th>Status</th></tr>' +
    roster.map(stu => `<tr><td>${stu.name}</td><td>${statusNames[attendanceData[date][stu.adm]]}</td></tr>`).join('') +
    '</table>';
  hide(attendanceBodyDiv, saveAttendanceBtn);
  show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
};

resetAttendanceBtn.onclick = () => {
  show(attendanceBodyDiv, saveAttendanceBtn);
  hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
};

downloadAttendanceBtn.onclick = () => {
  const doc = new jspdf.jsPDF();
  doc.setFontSize(18);
  doc.text('Attendance Report', 14, 16);
  doc.setFontSize(12);
  doc.text($('setupText').textContent, 14, 24);
  doc.autoTable({ startY: 32, html: '#attendanceSummary table' });
  doc.save(`attendance_${dateInput.value}.pdf`);
};

shareAttendanceBtn.onclick = () => {
  const cl = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;
  const date = dateInput.value;
  const header = `*Attendance Report*\nClass ${cl} Section ${sec} - ${date}`;
  const lines = students.filter(s => s.cls === cl && s.sec === sec)
    .map(s => `*${s.name}*: ${statusNames[attendanceData[date][s.adm]]}`);
  window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + lines.join('\n'))}`, '_blank');
};

// --- 11. ANALYTICS & FINE REPORT ---
const atg    = $('analyticsTarget');
const asel   = $('analyticsSectionSelect');
const atype  = $('analyticsType');
const adate  = $('analyticsDate');
const amonth = $('analyticsMonth');
const sems   = $('semesterStart');
const seme   = $('semesterEnd');
const ayear  = $('yearStart');
const asearch= $('analyticsSearch');
const loadA  = $('loadAnalytics');
const resetA = $('resetAnalytics');
const instr  = $('instructions');
const acont  = $('analyticsContainer');
const graphs = $('graphs');
const aacts  = $('analyticsActions');
const barCtx = $('barChart').getContext('2d');
const pieCtx = $('pieChart').getContext('2d');

// show/hide analytics controls on selection
atg.onchange = () => { /* ... */ };
atype.onchange = () => { /* ... */ };

loadA.onclick = () => {
  // existing analytics logic...
};

$('shareAnalytics').onclick = () =>
  window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');

$('downloadAnalytics').onclick = () => {
  const doc = new jspdf.jsPDF();
  doc.setFontSize(18);
  doc.text('Analytics Report', 14, 16);
  doc.setFontSize(12);
  doc.text($('setupText').textContent, 14, 24);
  doc.autoTable({ startY: 32, html: '#analyticsTable' });
  doc.save('analytics_report.pdf');
};

// --- 12. ATTENDANCE REGISTER ---
const loadReg   = $('loadRegister');
const changeReg = $('changeRegister');
const saveReg   = $('saveRegister');
const dlReg     = $('downloadRegister');
const shReg     = $('shareRegister');
const rm        = $('registerMonth');
const rh        = $('registerHeader');
const rb        = $('registerBody');
const rw        = $('registerTableWrapper');
const regCodes  = ['A','P','Lt','HD','L'];
const regColors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

loadReg.onclick = async () => {
  const m = rm.value;
  if (!m) { alert('Pick month'); return; }
  const [y, mm] = m.split('-').map(Number);
  const days = new Date(y, mm, 0).getDate();
  rh.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
    [...Array(days)].map((_,i)=>`<th>${i+1}</th>`).join('');
  rb.innerHTML = '';
  const roster = students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value);
  roster.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.dataset.index = i;
    tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
      [...Array(days)].map((_,d) => 
        `<td><span class="status-text">${attendanceData[`${m}-${String(d+1).padStart(2,'0')}`]?.[s.adm] || 'A'}</span></td>`
      ).join('');
    rb.appendChild(tr);
  });
  show(rw, saveReg);
  hide(changeReg, dlReg, shReg);
};

saveReg.onclick = async () => {
  const days = rb.querySelectorAll('tr:first-child td').length - 3;
  rb.querySelectorAll('tr').forEach(tr => {
    const adm = tr.children[1].textContent;
    for (let d=1; d<=days; d++) {
      const code = tr.children[2 + d].querySelector('.status-text').textContent;
      const key = `${rm.value}-${String(d).padStart(2,'0')}`;
      attendanceData[key] = attendanceData[key] || {};
      attendanceData[key][adm] = code;
    }
  });
  await save('attendanceData', attendanceData);
  hide(saveReg);
  show(changeReg, dlReg, shReg);
};

changeReg.onclick = () => {
  hide(changeReg, dlReg, shReg);
  show(saveReg);
};

dlReg.onclick = () => {
  const doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(18);
  doc.text('Attendance Register', 14, 16);
  doc.setFontSize(12);
  doc.text($('setupText').textContent, 14, 24);
  doc.autoTable({ startY: 32, html: '#registerTable', tableWidth: 'auto' });
  doc.save('attendance_register.pdf');
};

shReg.onclick = () => {
  const header = `Attendance Register\n${$('setupText').textContent}`;
  const rows = Array.from(rb.children).map(tr =>
    Array.from(tr.children).map(td =>
      td.querySelector('.status-text') ? td.querySelector('.status-text').textContent : td.textContent
    ).join(' ')
  );
  window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows.join('\n'))}`, '_blank');
};

// --- 13. SERVICE WORKER ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(console.error);
}
