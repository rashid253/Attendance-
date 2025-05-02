// app.js — Part 1 of 3: Initialization & Setup

// --- 0. Debug console (optional) ---
window.addEventListener('DOMContentLoaded', () => {
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);
});

// --- 1. IndexedDB helpers (idb-keyval) ---
if (!window.idbKeyval) {
  console.error('idb-keyval not found');
}
const { get, set } = window.idbKeyval;
const save = (key, val) => set(key, val);

// --- 2. State & Defaults ---
let students        = [];
let attendanceData  = {};
let finesData       = {};
let paymentsData    = {};
let lastAdmNo       = 0;
let fineRates       = { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct  = 75;

(async () => {
  students        = await get('students')        || [];
  attendanceData  = await get('attendanceData')  || {};
  finesData       = await get('finesData')       || {};
  paymentsData    = await get('paymentsData')    || {};
  lastAdmNo       = await get('lastAdmissionNo') || 0;
  fineRates       = await get('fineRates')       || fineRates;
  eligibilityPct  = await get('eligibilityPct')  || eligibilityPct;
})();

async function genAdmNo() {
  lastAdmNo++;
  await save('lastAdmissionNo', lastAdmNo);
  return String(lastAdmNo).padStart(4, '0');
}

// --- 3. DOM Helpers ---
const $ = id => document.getElementById(id);
const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

// --- 4. SETTINGS: Fines & Eligibility ---
(function initSettingsUI() {
  const formDiv      = $('financialForm');
  const saveBtn      = $('saveSettings');
  const inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map($);
  const settingsCard = document.createElement('div');
  settingsCard.id    = 'settingsCard';
  settingsCard.className = 'card hidden';
  const editBtn      = document.createElement('button');
  editBtn.id         = 'editSettings';
  editBtn.className  = 'btn no-print hidden';
  editBtn.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editBtn);

  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveBtn.onclick = async () => {
    fineRates = {
      A : Number($('fineAbsent').value)   || 0,
      Lt: Number($('fineLate').value)     || 0,
      L : Number($('fineLeave').value)    || 0,
      HD: Number($('fineHalfDay').value)  || 0,
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);

    settingsCard.innerHTML = `
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
      </div>
    `;
    hide(formDiv, ...inputs, saveBtn);
    show(settingsCard, editBtn);
  };

  editBtn.onclick = () => {
    hide(settingsCard, editBtn);
    show(formDiv, ...inputs, saveBtn);
  };
})();

// --- 5. SETUP: School, Class & Section ---
window.addEventListener('DOMContentLoaded', async () => {
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
      // proceed to render students, etc.
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc  = $('schoolNameInput').value.trim();
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!sc || !cl || !sec) { alert('Complete setup'); return; }
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
});
// app.js — Part 2 of 3: Student Registration & Payments

// --- 6. STUDENT REGISTRATION & FINE/STATUS ---
function renderStudents() {
  const cl = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;
  const tbody = $('studentsBody');
  tbody.innerHTML = '';
  let idx = 0;

  students.forEach((s, i) => {
    if (s.cls !== cl || s.sec !== sec) return;
    idx++;
    // tally attendance statuses
    const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
    Object.values(attendanceData).forEach(rec => {
      const code = rec[s.adm] || 'A';
      stats[code]++;
    });
    // compute fines & payments
    const totalFine = stats.A * fineRates.A
                    + stats.Lt * fineRates.Lt
                    + stats.L  * fineRates.L
                    + stats.HD * fineRates.HD;
    const paid = (paymentsData[s.adm] || []).reduce((a,p) => a + p.amount, 0);
    const outstanding = totalFine - paid;
    const totalDays = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
    const pct = totalDays ? (stats.P / totalDays) * 100 : 0;
    const status = (outstanding > 0 || pct < eligibilityPct) ? 'Debarred' : 'Eligible';

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
      <td>PKR ${outstanding}</td>
      <td>${status}</td>
      <td><button class="add-payment-btn" data-adm="${s.adm}">💰</button></td>
    `;
    tbody.appendChild(tr);
  });

  // reset control buttons
  $('selectAllStudents').checked = false;
  toggleButtons();

  // wire up payment modals
  document.querySelectorAll('.add-payment-btn').forEach(btn => {
    btn.onclick = () => openPaymentModal(btn.dataset.adm);
  });
}

function toggleButtons() {
  const anySelected = !!document.querySelector('.sel:checked');
  $('editSelected').disabled = !anySelected;
  $('deleteSelected').disabled = !anySelected;
}

$('studentsBody').addEventListener('change', e => {
  if (e.target.classList.contains('sel')) toggleButtons();
});
$('selectAllStudents').onclick = () => {
  document.querySelectorAll('.sel').forEach(c => c.checked = $('selectAllStudents').checked);
  toggleButtons();
};

// add new student
$('addStudent').onclick = async e => {
  e.preventDefault();
  const name    = $('studentName').value.trim();
  const parent  = $('parentName').value.trim();
  const contact = $('parentContact').value.trim();
  const occupation = $('parentOccupation').value.trim();
  const address    = $('parentAddress').value.trim();
  const cls    = $('teacherClassSelect').value;
  const sec    = $('teacherSectionSelect').value;
  if (!name || !parent || !contact || !occupation || !address) {
    alert('All fields required');
    return;
  }
  if (!/^\d{7,15}$/.test(contact)) {
    alert('Contact must be 7–15 digits');
    return;
  }
  const adm = await genAdmNo();
  students.push({ name, adm, parent, contact, occupation, address, cls, sec });
  await save('students', students);
  renderStudents();
  // clear inputs
  ['studentName','parentName','parentContact','parentOccupation','parentAddress']
    .forEach(id => $(id).value = '');
};

// edit & delete selected
$('editSelected').onclick = () => {
  document.querySelectorAll('.sel:checked').forEach(cb => {
    const tr = cb.closest('tr');
    const idx = +tr.dataset.index;
    const s   = students[idx];
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
  hide($('editSelected'));
  show($('doneEditing'));
};

$('doneEditing').onclick = async () => {
  document.querySelectorAll('#studentsBody tr').forEach(tr => {
    const inputs = tr.querySelectorAll('input:not(.sel)');
    if (inputs.length === 5) {
      const [nameEl, parentEl, contactEl, occEl, addrEl] = inputs;
      const adm = tr.children[3].textContent;
      const i   = students.findIndex(s => s.adm === adm);
      students[i] = {
        ...students[i],
        name: nameEl.value.trim(),
        parent: parentEl.value.trim(),
        contact: contactEl.value.trim(),
        occupation: occEl.value.trim(),
        address: addrEl.value.trim()
      };
    }
  });
  await save('students', students);
  hide($('doneEditing'));
  show($('editSelected'), $('deleteSelected'), $('saveRegistration'));
  renderStudents();
};

// delete
$('deleteSelected').onclick = async () => {
  if (!confirm('Delete selected?')) return;
  const toDel = Array.from(document.querySelectorAll('.sel:checked'))
    .map(cb => +cb.closest('tr').dataset.index);
  students = students.filter((_, i) => !toDel.includes(i));
  await save('students', students);
  renderStudents();
};

// save registration view
$('saveRegistration').onclick = async () => {
  if (!$('doneEditing').classList.contains('hidden')) {
    alert('Finish editing first');
    return;
  }
  await save('students', students);
  hide($('saveRegistration'), $('editSelected'), $('deleteSelected'), $('selectAllStudents'));
  show($('editRegistration'), $('downloadRegistrationPDF'), $('shareRegistration'));
};

// switch back to edit
$('editRegistration').onclick = () => {
  show($('saveRegistration'), $('selectAllStudents'), $('editSelected'), $('deleteSelected'));
  hide($('editRegistration'), $('downloadRegistrationPDF'), $('shareRegistration'));
  renderStudents();
};

// share & download registration
$('shareRegistration').onclick = () => {
  const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
  const header = `*Students List* Class ${cl} Section ${sec}`;
  const lines = students
    .filter(s => s.cls === cl && s.sec === sec)
    .map(s => `*${s.name}* (Adm# ${s.adm}) – Outstanding PKR ${ (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0) }`);
  window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines.join('\n'))}`, '_blank');
};

$('downloadRegistrationPDF').onclick = () => {
  const doc = new jspdf.jsPDF();
  doc.setFontSize(18).text('Student List', 14, 16);
  doc.setFontSize(12).text($('setupText').textContent, 14, 24);
  doc.autoTable({ startY: 32, html: '#studentsTable' });
  const url = doc.output('bloburl'); window.open(url); doc.save('students.pdf');
};

// --- 7. PAYMENT MODAL ---
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
// app.js — Part 3 of 3: Attendance, Analytics, Register & Global Filter

// --- 8. MARK ATTENDANCE ---
(function initAttendance() {
  const dateInput = $('dateInput');
  const loadBtn   = $('loadAttendance');
  const saveBtn   = $('saveAttendance');
  const resetBtn  = $('resetAttendance');
  const bodyDiv   = $('attendanceBody');
  const sumDiv    = $('attendanceSummary');
  const dlBtn     = $('downloadAttendancePDF');
  const shareBtn  = $('shareAttendanceSummary');
  const statusNames  = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' };
  const statusColors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  loadBtn.onclick = () => {
    bodyDiv.innerHTML = '';
    const roster = students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value);
    roster.forEach(stu => {
      const row = document.createElement('div'); row.className = 'attendance-row';
      const nameDiv = document.createElement('div'); nameDiv.className = 'attendance-name'; nameDiv.textContent = stu.name;
      const btns = document.createElement('div'); btns.className = 'attendance-buttons';
      Object.keys(statusNames).forEach(code => {
        const b = document.createElement('button');
        b.textContent = code;
        b.className = 'att-btn';
        b.onclick = () => {
          btns.querySelectorAll('.att-btn').forEach(x => { x.classList.remove('selected'); x.style.background=''; x.style.color=''; });
          b.classList.add('selected'); b.style.background = statusColors[code]; b.style.color='#fff';
        };
        btns.appendChild(b);
      });
      row.append(nameDiv, btns);
      bodyDiv.appendChild(row);
    });
    show(bodyDiv, saveBtn);
    hide(resetBtn, dlBtn, shareBtn, sumDiv);
  };

  saveBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert('Pick a date'); return; }
    attendanceData[date] = {};
    const roster = students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value);
    roster.forEach((s,i) => {
      const sel = bodyDiv.children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = sel ? sel.textContent : 'A';
    });
    await save('attendanceData', attendanceData);
    sumDiv.innerHTML = `<h3>Report: ${date}</h3><table><tr><th>Name</th><th>Status</th></tr>` +
      roster.map(s => `<tr><td>${s.name}</td><td>${statusNames[attendanceData[date][s.adm]]}</td></tr>`).join('') +
      `</table>`;
    hide(bodyDiv, saveBtn);
    show(resetBtn, dlBtn, shareBtn, sumDiv);
    // wire share icons omitted for brevity
  };

  resetBtn.onclick = () => { show(bodyDiv, saveBtn); hide(resetBtn, dlBtn, shareBtn, sumDiv); };

  dlBtn.onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.text('Attendance',14,16);
    doc.autoTable({ html: '#attendanceSummary table', startY:24 });
    window.open(doc.output('bloburl')); doc.save(`attendance_${dateInput.value}.pdf`);
  };
  shareBtn.onclick = () => {
    const date = dateInput.value;
    const lines = students.filter(s => s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value)
      .map(s => `*${s.name}*: ${statusNames[attendanceData[date][s.adm]]}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(`Attendance ${date}\n`+lines.join('\n'))}`);
  };
})();

// --- 9. ANALYTICS ---
(function initAnalytics() {
  const targetSel = $('analyticsTarget');
  const sectionSel = $('analyticsSectionSelect');
  const searchIn = $('analyticsSearch');
  const typeSel = $('analyticsType');
  const dateIn = $('analyticsDate'), monthIn = $('analyticsMonth'),
        semStart = $('semesterStart'), semEnd = $('semesterEnd'), yearIn = $('yearStart');
  const loadBtn = $('loadAnalytics'), resetBtn = $('resetAnalytics');
  const instr = $('instructions'), container = $('analyticsContainer'),
        barCtx = $('barChart').getContext('2d'), pieCtx = $('pieChart').getContext('2d');
  let barChart, pieChart, lastShare;

  targetSel.onchange = () => {
    typeSel.disabled = false;
    [sectionSel, searchIn].forEach(x=>x.classList.add('hidden'));
    if (targetSel.value==='section') sectionSel.classList.remove('hidden');
    if (targetSel.value==='student') searchIn.classList.remove('hidden');
  };
  typeSel.onchange = () => {
    [dateIn, monthIn, semStart, semEnd, yearIn, instr, container].forEach(x=>x.classList.add('hidden'));
    resetBtn.classList.remove('hidden');
    if (typeSel.value==='date') dateIn.classList.remove('hidden');
    if (typeSel.value==='month') monthIn.classList.remove('hidden');
    if (typeSel.value==='semester') semStart.classList.remove('hidden'), semEnd.classList.remove('hidden');
    if (typeSel.value==='year') yearIn.classList.remove('hidden');
  };
  resetBtn.onclick = e => { e.preventDefault(); typeSel.value=''; [dateIn, monthIn, semStart, semEnd, yearIn, instr, container].forEach(x=>x.classList.add('hidden')); resetBtn.classList.add('hidden'); };

  loadBtn.onclick = () => {
    // compute from/to similar to filter
    // filter student pool by class/section/target/search
    // build stats[], render table, charts...
    // set lastShare text
    show(instr, container);
  };
  $('shareAnalytics').onclick = ()=>window.open(`https://wa.me/?text=${encodeURIComponent(lastShare)}`);
  $('downloadAnalytics').onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.text('Analytics',14,16);
    doc.autoTable({ html:'#analyticsTable', startY:24 });
    window.open(doc.output('bloburl')); doc.save('analytics.pdf');
  };
})();

// --- 10. ATTENDANCE REGISTER ---
(function initRegister() {
  const loadBtn = $('loadRegister'), changeBtn = $('changeRegister'),
        saveBtn = $('saveRegister'), dlBtn = $('downloadRegister'), shBtn = $('shareRegister');
  const monthIn = $('registerMonth'), header = $('registerHeader'), body = $('registerBody'), wrapper = $('registerTableWrapper');

  loadBtn.onclick = () => {
    const m = monthIn.value;
    if (!m) return alert('Pick month');
    const days = new Date(...m.split('-').map(Number),0).getDate();
    header.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>`+
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    body.innerHTML = '';
    students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value)
      .forEach((s,i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
          Array.from({length:days},(_,d)=>{
            const key=`${m}-${String(d+1).padStart(2,'0')}`;
            const c=(attendanceData[key]||{})[s.adm]||'A';
            const color = c==='A'? '' : `style="background:${statusColors[c]};color:#fff"`;
            return `<td class="reg-cell"${color}><span class="status-text">${c}</span></td>`;
          }).join('');
        body.appendChild(tr);
      });
    wrapper.classList.remove('hidden');
    show(saveBtn); hide(loadBtn, changeBtn, dlBtn, shBtn);
    // attach cell click to cycle statuses...
  };

  saveBtn.onclick = async () => {
    const m = monthIn.value;
    Array.from(body.children).forEach(tr => {
      const adm = tr.children[1].textContent;
      Array.from(tr.querySelectorAll('.status-text')).forEach((span,d) => {
        const key = `${m}-${String(d+1).padStart(2,'0')}`;
        attendanceData[key] = attendanceData[key]||{};
        attendanceData[key][adm] = span.textContent;
      });
    });
    await save('attendanceData', attendanceData);
    hide(saveBtn); show(changeBtn, dlBtn, shBtn);
  };
  changeBtn.onclick = () => { show(saveBtn); hide(changeBtn, dlBtn, shBtn); };
  dlBtn.onclick = () => {
    const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    doc.text('Attendance Register',14,16);
    doc.autoTable({ html:'#registerTable', startY:24, tableWidth:'auto', styles:{fontSize:8} });
    window.open(doc.output('bloburl')); doc.save('register.pdf');
  };
  shBtn.onclick = () => {
    const rows = Array.from(body.children).map(tr => 
      Array.from(tr.children).map(td=>td.querySelector('.status-text')?td.querySelector('.status-text').textContent:td.textContent).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent('Register\n'+rows.join('\n'))}`);
  };
})();

// --- 11. SERVICE WORKER ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(console.error);

// --- 12. GLOBAL FILTER & PDF BOOKLET (re-used from Part 1) ---
// ... insert the filter & booklet code here if not already ...
}
