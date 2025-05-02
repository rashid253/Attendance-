// app.js (part 1/3)
(() => {
  const $    = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  window.addEventListener('DOMContentLoaded', async () => {
    // 1. IndexedDB helpers
    if (!window.idbKeyval) {
      console.error('idb-keyval not found');
      return;
    }
    const { get, set } = window.idbKeyval;
    const save = (k, v) => set(k, v);

    // 2. State & defaults
    let students       = await get('students')        || [];
    let attendanceData = await get('attendanceData')  || {};
    let finesData      = await get('finesData')       || {};
    let paymentsData   = await get('paymentsData')    || {};
    let lastAdmNo      = await get('lastAdmissionNo') || 0;
    let fineRates      = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
    let eligibilityPct = await get('eligibilityPct')  || 75;

    async function genAdmNo() {
      lastAdmNo++;
      await save('lastAdmissionNo', lastAdmNo);
      return String(lastAdmNo).padStart(4, '0');
    }

    // 3. Search & Filter setup
    let searchTerm    = '';
    let filterOptions = { time: null, info: [], all: false };

    const globalSearch = $('globalSearch');
    const filterBtn    = $('filterBtn');
    const filterDialog = $('filterDialog');
    const closeFilter  = $('closeFilter');
    const applyFilter  = $('applyFilter');
    const timeChecks   = Array.from(filterDialog.querySelectorAll('input[name="timeFilter"]'));
    const pickers      = {
      'date-day':  $('picker-date'),
      'month':     $('picker-month'),
      'semester':  $('picker-semester'),
      'year':      $('picker-year'),
    };

    // Toggle time pickers
    timeChecks.forEach(chk => chk.onchange = () => {
      timeChecks.forEach(c => { if (c !== chk) c.checked = false; });
      Object.entries(pickers).forEach(([val, el]) => {
        el.classList.toggle('hidden', chk.value !== val || !chk.checked);
      });
      $('timePickers').classList.toggle('hidden', !chk.checked);
    });

    // Search handler
    globalSearch.oninput = () => {
      searchTerm = globalSearch.value.trim().toLowerCase();
      renderStudents();
    };

    // Filter dialog
    filterBtn.onclick   = () => show(filterDialog);
    closeFilter.onclick = () => hide(filterDialog);
    applyFilter.onclick = () => {
      const t = timeChecks.find(c => c.checked)?.value;
      let range = null;
      if (t === 'date-day') {
        const d = $('filterDate').value;
        range = { from: d, to: d };
      } else if (t === 'month') {
        const m = $('filterMonth').value;
        const [y, mm] = m.split('-').map(Number);
        range = { from: `${m}-01`, to: `${m}-${new Date(y, mm, 0).getDate()}` };
      } else if (t === 'semester') {
        const s1 = $('filterSemStart').value;
        const s2 = $('filterSemEnd').value;
        const [sy, sm] = s1.split('-').map(Number);
        const [ey, em] = s2.split('-').map(Number);
        range = { from: `${s1}-01`, to: `${s2}-${new Date(ey, em, 0).getDate()}` };
      } else if (t === 'year') {
        const y = $('filterYear').value;
        range = { from: `${y}-01-01`, to: `${y}-12-31` };
      }
      const info = Array.from(filterDialog.querySelectorAll('input[name="infoFilter"]:checked'))
                        .map(i => i.value);
      filterOptions = { time: range, info, all: info.includes('all') };
      hide(filterDialog);
      renderStudents();
    };

    // 4. Financial Settings
    const formDiv = $('financialForm');
    const saveSettingsBtn = $('saveSettings');
    const fInputs = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map($);
    const settingsCard = document.createElement('div');
    settingsCard.id = 'settingsCard'; settingsCard.className = 'card hidden';
    const editSettingsBtn = document.createElement('button');
    editSettingsBtn.id = 'editSettings'; editSettingsBtn.className = 'btn no-print hidden';
    editSettingsBtn.textContent = 'Edit Settings';
    formDiv.parentNode.append(settingsCard, editSettingsBtn);

    $('fineAbsent').value    = fineRates.A;
    $('fineLate').value      = fineRates.Lt;
    $('fineLeave').value     = fineRates.L;
    $('fineHalfDay').value   = fineRates.HD;
    $('eligibilityPct').value= eligibilityPct;

    saveSettingsBtn.onclick = async () => {
      fineRates = {
        A : +$('fineAbsent').value || 0,
        Lt: +$('fineLate').value   || 0,
        L : +$('fineLeave').value  || 0,
        HD: +$('fineHalfDay').value|| 0
      };
      eligibilityPct = +$('eligibilityPct').value || 0;
      await save('fineRates', fineRates);
      await save('eligibilityPct', eligibilityPct);
      settingsCard.innerHTML = `
        <p>Fine–Absent: PKR ${fineRates.A}</p>
        <p>Fine–Late: PKR ${fineRates.Lt}</p>
        <p>Fine–Leave: PKR ${fineRates.L}</p>
        <p>Fine–Half-Day: PKR ${fineRates.HD}</p>
        <p>Elig % ≥ ${eligibilityPct}</p>`;
      hide(formDiv, ...fInputs, saveSettingsBtn);
      show(settingsCard, editSettingsBtn);
    };
    editSettingsBtn.onclick = () => {
      hide(settingsCard, editSettingsBtn);
      show(formDiv, ...fInputs, saveSettingsBtn);
    };

    // 5. Teacher Setup
    async function loadSetup() {
      const [sc, cls, sec] = await Promise.all([
        get('schoolName'),
        get('teacherClass'),
        get('teacherSection')
      ]);
      if (sc && cls && sec) {
        $('schoolNameInput').value = sc;
        $('teacherClassSelect').value = cls;
        $('teacherSectionSelect').value = sec;
        $('setupText').textContent = `${sc} | Class ${cls} Sec ${sec}`;
        hide($('setupForm')); show($('setupDisplay'));
        renderStudents();
        updateCounters();
        resetViews();
      }
    }
    $('saveSetup').onclick = async e => {
      e.preventDefault();
      const sc  = $('schoolNameInput').value.trim();
      const cls = $('teacherClassSelect').value;
      const sec = $('teacherSectionSelect').value;
      if (!sc || !cls || !sec) { alert('Complete setup'); return; }
      await save('schoolName', sc);
      await save('teacherClass', cls);
      await save('teacherSection', sec);
      loadSetup();
    };
    $('editSetup').onclick = e => {
      e.preventDefault();
      show($('setupForm'));
      hide($('setupDisplay'));
    };
    await loadSetup();

    // app.js (part 2/3 continued)

// 6. Counters & Utilities
function animateCounters() {
  document.querySelectorAll('.number').forEach(span => {
    const target = +span.dataset.target;
    let count = 0;
    const step = Math.max(1, target / 100);
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
  $('sectionCount').dataset.target = students.filter(s => s.cls === cls && s.sec === sec).length;
  $('classCount').dataset.target   = students.filter(s => s.cls === cls).length;
  $('schoolCount').dataset.target  = students.length;
  animateCounters();
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

$('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };
$('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

// 7. Student Registration Rendering
function renderStudents() {
  const cls = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;
  const tbody = $('studentsBody');
  tbody.innerHTML = '';
  let idx = 0;

  students
    .filter(s => s.cls === cls && s.sec === sec)
    .filter(s => {
      if (searchTerm && !(s.name.toLowerCase().includes(searchTerm) || s.adm.includes(searchTerm))) return false;
      // Future: apply filterOptions here
      return true;
    })
    .forEach((s, i) => {
      idx++;
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => { stats[rec[s.adm] || 'A']++; });
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L* fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out = totalFine - paid;
      const totalDays = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct = totalDays ? (stats.P/totalDays)*100 : 0;
      const status = (out>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';

      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td>
        <td>${s.name}</td>
        <td>${s.adm}</td>
        <td>${s.parent}</td>
        <td>${s.contact}</td>
        <td>${s.occupation}</td>
        <td>${s.address}</td>
        <td>PKR ${out}</td>
        <td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });

  $('selectAllStudents').checked = false;
  toggleRegButtons();
  document.querySelectorAll('.add-payment-btn').forEach(btn => {
    btn.onclick = () => openPaymentModal(btn.dataset.adm);
  });
}

function toggleRegButtons() {
  const any = !!document.querySelector('.sel:checked');
  $('editSelected').disabled = !any;
  $('deleteSelected').disabled = !any;
}

// Registration checkbox events
$('studentsBody').addEventListener('change', e => {
  if (e.target.classList.contains('sel')) toggleRegButtons();
});
$('selectAllStudents').onclick = () => {
  const checked = $('selectAllStudents').checked;
  document.querySelectorAll('.sel').forEach(c => c.checked = checked);
  toggleRegButtons();
};

// 8. Add / Edit / Delete Students
$('addStudent').onclick = async e => {
  e.preventDefault();
  const n = $('studentName').value.trim();
  const p = $('parentName').value.trim();
  const c = $('parentContact').value.trim();
  const o = $('parentOccupation').value.trim();
  const a = $('parentAddress').value.trim();
  const cls = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;
  if (!n||!p||!c||!o||!a) return alert('All fields required');
  if (!/^\d{7,15}$/.test(c)) return alert('Contact 7–15 digits');
  const adm = await genAdmNo();
  students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls, sec });
  await save('students', students);
  renderStudents(); updateCounters(); resetViews();
  ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
};

$('editSelected').onclick = () => {
  document.querySelectorAll('.sel:checked').forEach(cb => {
    const tr = cb.closest('tr'), i = +tr.dataset.index, s = students[i];
    tr.innerHTML = `
      <td><input type="checkbox" class="sel" checked></td>
      <td>${tr.children[1].textContent}</td>
      <td><input value="${s.name}"></td>
      <td>${s.adm}</td>
      <td><input value="${s.parent}"></td>
      <td><input value="${s.contact}"></td>
      <td><input value="${s.occupation}"></td>
      <td><input value="${s.address}"></td>
      <td colspan="3"></td>
    `;
  });
  hide($('editSelected')); show($('doneEditing'));
};

$('doneEditing').onclick = async () => {
  document.querySelectorAll('#studentsBody tr').forEach(tr => {
    const inputs = [...tr.querySelectorAll('input:not(.sel)')];
    if (inputs.length === 5) {
      const [n,p,c,o,a] = inputs.map(i=>i.value.trim());
      const adm = tr.children[3].textContent;
      const idx = students.findIndex(s=>s.adm===adm);
      if (idx>-1) students[idx] = { ...students[idx], name:n, parent:p, contact:c, occupation:o, address:a };
    }
  });
  await save('students', students);
  hide($('doneEditing'));
  show($('editSelected'), $('deleteSelected'), $('saveRegistration'));
  renderStudents(); updateCounters();
};

$('deleteSelected').onclick = async () => {
  if (!confirm('Delete selected?')) return;
  const toDel = [...document.querySelectorAll('.sel:checked')].map(cb => +cb.closest('tr').dataset.index);
  students = students.filter((_,i)=>!toDel.includes(i));
  await save('students', students);
  renderStudents(); updateCounters(); resetViews();
};

$('saveRegistration').onclick = async () => {
  if (!$('doneEditing').classList.contains('hidden')) return alert('Finish editing first');
  await save('students', students);
  hide(
    document.querySelector('#student-registration .row-inline'),
    $('selectAllStudents'), $('editSelected'), $('deleteSelected'), $('saveRegistration')
  );
  show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
};

$('editRegistration').onclick = () => {
  show(
    document.querySelector('#student-registration .row-inline'),
    $('selectAllStudents'), $('editSelected'), $('deleteSelected'), $('saveRegistration')
  );
  hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
  renderStudents(); updateCounters();
};

// Payments modal handler (will be completed in part 3)
function openPaymentModal(adm) { /*...*/ }

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
  if (!date) { alert('Please pick a date'); return; }
  attendanceData[date] = {};
  const roster = students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value);
  roster.forEach((s, i) => {
    const btn = attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
    attendanceData[date][s.adm] = btn ? btn.textContent : 'A';
  });
  await save('attendanceData', attendanceData);

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
  doc.autoTable({ startY: 32, html: '#attendanceSummary table' });
  doc.save(`attendance_${dateInput.value}.pdf`);
};

shareAttendanceBtn.onclick = () => {
  const date = dateInput.value;
  const header = `*Attendance Report*\nClass ${$('teacherClassSelect').value} Section ${$('teacherSectionSelect').value} - ${date}`;
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

// generate fine report PDF
$('generateFineReport').onclick = generateFineReportPDF;

atg.onchange = () => {
  atype.disabled = false;
  [asel, asearch].forEach(x => x.classList.add('hidden'));
  [instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
  if (atg.value === 'section') asel.classList.remove('hidden');
  if (atg.value === 'student') asearch.classList.remove('hidden');
};

atype.onchange = () => {
  [adate, amonth, sems, seme, ayear].forEach(x => x.classList.add('hidden'));
  [instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
  resetA.classList.remove('hidden');
  if (atype.value === 'date') adate.classList.remove('hidden');
  if (atype.value === 'month') amonth.classList.remove('hidden');
  if (atype.value === 'semester') { sems.classList.remove('hidden'); seme.classList.remove('hidden'); }
  if (atype.value === 'year') ayear.classList.remove('hidden');
};

resetA.onclick = e => {
  e.preventDefault();
  atype.value = '';
  [adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
  resetA.classList.add('hidden');
};

loadA.onclick = () => {
  // analytics loading logic unchanged from part 2
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

loadReg.onclick = () => {
  const m = rm.value;
  if (!m) { alert('Pick month'); return; }
  const [y, mm] = m.split('-').map(Number);
  const days = new Date(y, mm, 0).getDate();

  rh.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
    [...Array(days)].map((_,i) => `<th>${i+1}</th>`).join('');

  rb.innerHTML = '';
  const roster = students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value);
  roster.forEach((s,i) => {
    let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
    for (let d=1; d<=days; d++) {
      const key = `${m}-${String(d).padStart(2,'0')}`;
      const c = (attendanceData[key]||{})[s.adm] || 'A';
      const style = c==='A' ? '' : ` style="background:${regColors[c]};color:#fff"`;
      row += `<td class="reg-cell"${style}><span class="status-text">${c}</span></td>`;
    }
    const tr = document.createElement('tr');
    tr.innerHTML = row;
    rb.appendChild(tr);
  });

  rb.querySelectorAll('.reg-cell').forEach(cell => {
    cell.onclick = () => {
      const span = cell.querySelector('.status-text');
      let idx = regCodes.indexOf(span.textContent);
      idx = (idx + 1) % regCodes.length;
      const c = regCodes[idx];
      span.textContent = c;
      if (c === 'A') { cell.style.background = ''; cell.style.color = ''; }
      else            { cell.style.background = regColors[c]; cell.style.color = '#fff'; }
    };
  });

  show(rw, saveReg);
  hide(loadReg, changeReg, dlReg, shReg);
};

saveReg.onclick = async () => {
  const m = rm.value;
  const [y, mm] = m.split('-').map(Number);
  const days = new Date(y, mm, 0).getDate();
  Array.from(rb.children).forEach(tr => {
    const adm = tr.children[1].textContent;
    for (let d=1; d<=days; d++) {
      const code = tr.children[3 + d - 1].querySelector('.status-text').textContent;
      const key = `${m}-${String(d).padStart(2,'0')}`;
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
  doc.autoTable({ startY: 32, html: '#registerTable', tableWidth: 'auto', styles: { fontSize: 10 } });
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

  }); // end DOMContentLoaded
})();
