// app.js (part 1/3)
window.addEventListener('DOMContentLoaded', async () => {
  // 1. IndexedDB helpers (idb-keyval)
  if (!window.idbKeyval) {
    console.error('idb-keyval not found');
    return;
  }
  const { get, set } = window.idbKeyval;
  const save = (key, val) => set(key, val);

  // 2. State & defaults
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

  // 3. DOM helpers
  const $    = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // 4. Search & filter state
  let searchTerm    = '';
  let filterOptions = { time: null, info: [], all: false };

  const globalSearch = $('globalSearch');
  const filterBtn    = $('filterBtn');
  const filterDialog = $('filterDialog');
  const closeFilter  = $('closeFilter');
  const applyFilter  = $('applyFilter');
  const timeChecks   = filterDialog.querySelectorAll('input[name="timeFilter"]');
  const pickers      = {
    'date-day': $('picker-date'),
    'month':    $('picker-month'),
    'semester': $('picker-semester'),
    'year':     $('picker-year')
  };

  // toggle time pickers
  timeChecks.forEach(chk => {
    chk.onchange = () => {
      timeChecks.forEach(c => { if (c !== chk) c.checked = false; });
      Object.entries(pickers).forEach(([val, el]) => {
        el.classList.toggle('hidden', chk.value !== val || !chk.checked);
      });
      $('timePickers').classList.toggle('hidden', !chk.checked);
    };
  });

  // search input handler
  globalSearch.oninput = () => {
    searchTerm = globalSearch.value.trim().toLowerCase();
    renderStudents();
  };

  // open/close filter dialog
  filterBtn.onclick   = () => show(filterDialog);
  closeFilter.onclick = () => hide(filterDialog);

  // apply filter handler
  applyFilter.onclick = () => {
    const t = [...timeChecks].find(c => c.checked)?.value;
    let range = null;
    if (t === 'date-day') {
      const d = $('filterDate').value;
      range = { from: d, to: d };
    } else if (t === 'month') {
      const m = $('filterMonth').value;
      const [y, mm] = m.split('-').map(Number);
      range = { from: `${m}-01`, to: `${m}-${new Date(y, mm, 0).getDate()}` };
    } else if (t === 'semester') {
      const s1 = $('filterSemStart').value, s2 = $('filterSemEnd').value;
      const [sy, sm] = s1.split('-').map(Number), [ey, em] = s2.split('-').map(Number);
      range = { from: `${s1}-01`, to: `${s2}-${new Date(ey, em, 0).getDate()}` };
    } else if (t === 'year') {
      const y = $('filterYear').value;
      range = { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    const info = [...filterDialog.querySelectorAll('input[name="infoFilter"]:checked')].map(i => i.value);
    filterOptions = { time: range, info, all: info.includes('all') };
    hide(filterDialog);
    renderStudents();
  };

  // 5. Financial settings
  const formDiv        = $('financialForm');
  const saveSettings   = $('saveSettings');
  const settingsInputs = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map($);
  const settingsCard   = document.createElement('div');
  settingsCard.id      = 'settingsCard';
  settingsCard.className = 'card hidden';
  const editSettingsBtn = document.createElement('button');
  editSettingsBtn.id    = 'editSettings';
  editSettingsBtn.className = 'btn no-print hidden';
  editSettingsBtn.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editSettingsBtn);

  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveSettings.onclick = async () => {
    fineRates = {
      A : Number($('fineAbsent').value)   || 0,
      Lt: Number($('fineLate').value)     || 0,
      L : Number($('fineLeave').value)    || 0,
      HD: Number($('fineHalfDay').value)  || 30,
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);
    settingsCard.innerHTML = `
      <div class="card-content">
        <p><strong>Fine–Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine–Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine–Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine–Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
      </div>
    `;
    hide(formDiv, ...settingsInputs, saveSettings);
    show(settingsCard, editSettingsBtn);
  };

  editSettingsBtn.onclick = () => {
    hide(settingsCard, editSettingsBtn);
    show(formDiv, ...settingsInputs, saveSettings);
  };

  // 6. Setup loading/saving
  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([
      get('schoolName'),
      get('teacherClass'),
      get('teacherSection')
    ]);
    if (sc && cl && sec) {
      $('schoolNameInput').value      = sc;
      $('teacherClassSelect').value   = cl;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent      = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderStudents();
      updateCounters();
      resetViews();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc  = $('schoolNameInput').value.trim();
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!sc || !cl || !sec) {
      alert('Complete setup');
      return;
    }
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => {
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };

  await loadSetup();

  // Parts 2/3 & 3/3 follow...
});
// app.js (part 2/3)

// 7. Render functions
function renderStudents() {
  const studentTableBody = $('studentTableBody');
  studentTableBody.innerHTML = '';

  const filteredStudents = students.filter(student => {
    // Search filter
    if (searchTerm && !student.name.toLowerCase().includes(searchTerm)) return false;

    // Info filter
    if (!filterOptions.all && filterOptions.info.length && !filterOptions.info.includes(student.status)) return false;

    // Date filter
    if (filterOptions.time) {
      const studentDate = new Date(student.dateOfAdmission);
      const { from, to } = filterOptions.time;
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (studentDate < fromDate || studentDate > toDate) return false;
    }

    return true;
  });

  filteredStudents.forEach(student => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${student.admissionNo}</td>
      <td>${student.name}</td>
      <td>${student.dateOfAdmission}</td>
      <td>${student.status}</td>
      <td><button class="btn btn-edit" onclick="editStudent(${student.admissionNo})">Edit</button></td>
      <td><button class="btn btn-delete" onclick="deleteStudent(${student.admissionNo})">Delete</button></td>
    `;
    studentTableBody.appendChild(row);
  });
}

async function editStudent(admissionNo) {
  const student = students.find(s => s.admissionNo === admissionNo);
  if (!student) return;

  $('admissionNo').value = student.admissionNo;
  $('studentName').value = student.name;
  $('dateOfAdmission').value = student.dateOfAdmission;
  $('status').value = student.status;
  show($('studentForm'));
}

async function deleteStudent(admissionNo) {
  const confirmDelete = confirm('Are you sure you want to delete this student?');
  if (!confirmDelete) return;

  students = students.filter(s => s.admissionNo !== admissionNo);
  await save('students', students);
  renderStudents();
  updateCounters();
}

function resetStudentForm() {
  $('studentForm').reset();
  hide($('studentForm'));
}

async function updateCounters() {
  const activeStudents = students.filter(s => s.status === 'Active').length;
  const inactiveStudents = students.filter(s => s.status === 'Inactive').length;
  $('activeCount').textContent = activeStudents;
  $('inactiveCount').textContent = inactiveStudents;
}

// 8. Attendance system

async function markAttendance(admissionNo) {
  const student = students.find(s => s.admissionNo === admissionNo);
  if (!student) return alert('Student not found');

  const currentDate = new Date().toISOString().split('T')[0];
  const attendanceKey = `${admissionNo}-${currentDate}`;

  if (!attendanceData[attendanceKey]) {
    attendanceData[attendanceKey] = { attendance: 'Present' };
    await save('attendanceData', attendanceData);
    alert('Attendance marked as Present');
  } else {
    alert('Attendance for today is already marked');
  }
}

// 9. Fine system

async function applyFine(admissionNo) {
  const student = students.find(s => s.admissionNo === admissionNo);
  if (!student) return alert('Student not found');

  const currentDate = new Date().toISOString().split('T')[0];
  const fineKey = `${admissionNo}-${currentDate}`;

  if (!finesData[fineKey]) {
    finesData[fineKey] = { fineAmount: fineRates.A };
    await save('finesData', finesData);
    alert(`Fine of PKR ${fineRates.A} applied`);
  } else {
    alert('Fine for today is already applied');
  }
}

// 10. Payment system

async function applyPayment(admissionNo) {
  const student = students.find(s => s.admissionNo === admissionNo);
  if (!student) return alert('Student not found');

  const currentDate = new Date().toISOString().split('T')[0];
  const paymentKey = `${admissionNo}-${currentDate}`;

  if (!paymentsData[paymentKey]) {
    paymentsData[paymentKey] = { paymentAmount: 0 };
    await save('paymentsData', paymentsData);
    alert('Payment registered');
  } else {
    alert('Payment already recorded');
  }
}

// 11. Save student (register)

$('studentForm').onsubmit = async e => {
  e.preventDefault();

  const admissionNo = await genAdmNo();
  const name = $('studentName').value;
  const dateOfAdmission = $('dateOfAdmission').value;
  const status = $('status').value;

  const newStudent = { admissionNo, name, dateOfAdmission, status };
  students.push(newStudent);

  await save('students', students);
  renderStudents();
  resetStudentForm();
  updateCounters();
};

// 12. Generate report (fines and payments)

async function generateReport() {
  const reportDiv = $('reportDiv');
  reportDiv.innerHTML = '';
  const studentRows = students.map(s => {
    const fine = finesData[s.admissionNo] ? finesData[s.admissionNo].fineAmount : 0;
    const payment = paymentsData[s.admissionNo] ? paymentsData[s.admissionNo].paymentAmount : 0;
    return `
      <tr>
        <td>${s.admissionNo}</td>
        <td>${s.name}</td>
        <td>${fine}</td>
        <td>${payment}</td>
      </tr>
    `;
  }).join('');
  reportDiv.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Admission No</th>
          <th>Name</th>
          <th>Fine</th>
          <th>Payment</th>
        </tr>
      </thead>
      <tbody>
        ${studentRows}
      </tbody>
    </table>
  `;
}

// 13. Save report as PDF

async function saveReportAsPDF() {
  const reportDiv = $('reportDiv');
  const reportHtml = reportDiv.outerHTML;
  const pdf = new jsPDF();
  pdf.html(reportHtml, {
    callback: function (doc) {
      doc.save('report.pdf');
    }
  });
}

// 14. Setup fine and attendance reset
async function resetFineAttendance() {
  attendanceData = {};
  finesData = {};
  await Promise.all([
    save('attendanceData', attendanceData),
    save('finesData', finesData)
  ]);
  alert('Attendance and fines data reset');
}

// 15. Final Update
renderStudents();
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
const statusNames           = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' };
const statusColors          = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

loadAttendanceBtn.onclick = () => {
  attendanceBodyDiv.innerHTML = '';
  attendanceSummaryDiv.innerHTML = '';
  const roster = students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value);
  roster.forEach((stu, i) => {
    const row = document.createElement('div');
    row.className = 'attendance-row';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'attendance-name';
    nameDiv.textContent = stu.name;
    const btnsDiv = document.createElement('div');
    btnsDiv.className = 'attendance-buttons';
    Object.entries(statusNames).forEach(([code, label]) => {
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
  if (!date) return alert('Please pick a date');
  attendanceData[date] = {};
  const roster = students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value);
  roster.forEach((s,i) => {
    const btn = attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
    attendanceData[date][s.adm] = btn ? btn.textContent : 'A';
  });
  await save('attendanceData', attendanceData);

  // build summary
  attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
  const tbl = document.createElement('table');
  tbl.innerHTML = `<tr><th>Name</th><th>Status</th><th>Share</th></tr>`;
  roster.forEach(s => {
    const code = attendanceData[date][s.adm];
    tbl.innerHTML += `
      <tr>
        <td>${s.name}</td>
        <td>${statusNames[code]}</td>
        <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
      </tr>`;
  });
  attendanceSummaryDiv.appendChild(tbl);
  attendanceSummaryDiv.querySelectorAll('.share-individual').forEach(ic => {
    ic.onclick = () => {
      const adm = ic.dataset.adm;
      const student = students.find(x => x.adm === adm);
      const msg = `Dear Parent, your child was ${statusNames[attendanceData[date][adm]]} on ${date}.`;
      window.open(`https://wa.me/${student.contact}?text=${encodeURIComponent(msg)}`, '_blank');
    };
  });

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
  doc.autoTable({ startY:32, html: '#attendanceSummary table' });
  doc.save(`attendance_${dateInput.value}.pdf`);
};

shareAttendanceBtn.onclick = () => {
  const date = dateInput.value;
  const header = `*Attendance Report* ${$('setupText').textContent} - ${date}`;
  const lines = students
    .filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value)
    .map(s => `*${s.name}*: ${statusNames[attendanceData[date][s.adm]]}`)
    .join('\n');
  window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
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
let barChart, pieChart, lastAnalyticsShare = '';

// bind fine-report button
$('generateFineReport').onclick = generateFineReportPDF;

// analytics target change
atg.onchange = () => {
  atype.disabled = false;
  [asel, asearch].forEach(x => x.classList.add('hidden'));
  [instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
  if (atg.value==='section') asel.classList.remove('hidden');
  if (atg.value==='student') asearch.classList.remove('hidden');
};

// analytics period change
atype.onchange = () => {
  [adate, amonth, sems, seme, ayear].forEach(x => x.classList.add('hidden'));
  [instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
  resetA.classList.remove('hidden');
  if (atype.value==='date') adate.classList.remove('hidden');
  if (atype.value==='month') amonth.classList.remove('hidden');
  if (atype.value==='semester') { sems.classList.remove('hidden'); seme.classList.remove('hidden'); }
  if (atype.value==='year') ayear.classList.remove('hidden');
};

resetA.onclick = e => {
  e.preventDefault();
  atype.value='';
  [adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
  resetA.classList.add('hidden');
};

loadA.onclick = () => {
  // existing analytics load logic from earlier code
};

$('shareAnalytics').onclick = () =>
  window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');

$('downloadAnalytics').onclick = () => {
  const doc = new jspdf.jsPDF();
  doc.setFontSize(18);
  doc.text('Analytics Report',14,16);
  doc.setFontSize(12);
  doc.text($('setupText').textContent,14,24);
  doc.autoTable({startY:32, html:'#analyticsTable'});
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

loadReg.onclick = () => {
  const m = rm.value;
  if (!m) return alert('Pick month');
  const [y, mm] = m.split('-').map(Number);
  const days = new Date(y, mm, 0).getDate();

  rh.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
    [...Array(days)].map((_,i)=>`<th>${i+1}</th>`).join('');

  rb.innerHTML = '';
  const roster = students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
  roster.forEach((s,i) => {
    let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
    for (let d=1; d<=days; d++){
      const key = `${m}-${String(d).padStart(2,'0')}`;
      const c = (attendanceData[key]||{})[s.adm]|| 'A';
      const style = c==='A'? '' : ` style="background:${regColors[c]};color:#fff"`;
      row += `<td class="reg-cell"${style}><span class="status-text">${c}</span></td>`;
    }
    const tr = document.createElement('tr');
    tr.innerHTML = row;
    rb.appendChild(tr);
  });

  rb.querySelectorAll('.reg-cell').forEach(cell =>{
    cell.onclick = () =>{
      const span = cell.querySelector('.status-text');
      let idx = regCodes.indexOf(span.textContent);
      idx = (idx+1) % regCodes.length;
      const c = regCodes[idx];
      span.textContent = c;
      if(c==='A'){ cell.style.background=''; cell.style.color=''; }
      else        { cell.style.background=regColors[c]; cell.style.color='#fff'; }
    };
  });

  show(rw, saveReg);
  hide(loadReg, changeReg, dlReg, shReg);
};

saveReg.onclick = async () =>{
  const m = rm.value, [y, mm] = m.split('-').map(Number);
  const days = new Date(y, mm, 0).getDate();
  Array.from(rb.children).forEach(tr =>{
    const adm = tr.children[1].textContent;
    for (let d=1; d<=days; d++){
      const code = tr.children[3+d-1].querySelector('.status-text').textContent;
      const key = `${m}-${String(d).padStart(2,'0')}`;
      attendanceData[key] = attendanceData[key]||{};
      attendanceData[key][adm] = code;
    }
  });
  await save('attendanceData', attendanceData);
  hide(saveReg);
  show(changeReg, dlReg, shReg);
};

changeReg.onclick = () =>{
  hide(changeReg, dlReg, shReg);
  show(saveReg);
};

dlReg.onclick = () =>{
  const doc = new jspdf.jsPDF({orientation:'landscape',unit:'pt',format:'a4'});
  doc.setFontSize(18);
  doc.text('Attendance Register',14,16);
  doc.setFontSize(12);
  doc.text($('setupText').textContent,14,24);
  doc.autoTable({startY:32,html:'#registerTable',tableWidth:'auto',styles:{fontSize:10}});
  doc.save('attendance_register.pdf');
};

shReg.onclick = () =>{
  const header = `Attendance Register\n${$('setupText').textContent}`;
  const rows = Array.from(rb.children).map(tr =>
    Array.from(tr.children).map(td =>
      td.querySelector('.status-text')? td.querySelector('.status-text').textContent: td.textContent
    ).join(' ')
  );
  window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+rows.join('\n'))}`,'_blank');
};

// 13. Service Worker
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('service-worker.js').catch(console.error);
};

