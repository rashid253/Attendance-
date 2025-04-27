// app.js

// --- IMPORTS & GLOBALS ---
const { get, set } = window.idbKeyval;
const { jsPDF } = window.jspdf; // UMD build exposes window.jspdf.jsPDF

// --- STATE ---
let students       = await get('students')       || [];
let attendanceData = await get('attendanceData') || {};

// --- STORAGE HELPERS ---
const saveStudents       = () => set('students', students);
const saveAttendanceData = () => set('attendanceData', attendanceData);
const getLastAdmNo       = async () => (await get('lastAdmissionNo')) || 0;
const setLastAdmNo       = n => set('lastAdmissionNo', n);

async function generateAdmNo() {
  const last = await getLastAdmNo();
  const next = last + 1;
  await setLastAdmNo(next);
  return String(next).padStart(4, '0');
}

// --- DOM ELEMENTS ---
const $ = id => document.getElementById(id);

const schoolInput       = $('schoolNameInput');
const classSelect       = $('teacherClassSelect');
const sectionSelect     = $('teacherSectionSelect');
const btnSaveSetup      = $('saveSetup');
const setupForm         = $('setupForm');
const setupDisplay      = $('setupDisplay');
const setupText         = $('setupText');
const btnEditSetup      = $('editSetup');

const nameInput         = $('studentName');
const parentInput       = $('parentName');
const contactInput      = $('parentContact');
const occInput          = $('parentOccupation');
const addrInput         = $('parentAddress');
const btnAddStudent     = $('addStudent');

const tbodyStudents     = $('studentsBody');
const selectAllStudents = $('selectAllStudents');
const btnEditReg        = $('editRegistration');
const btnSaveReg        = $('saveRegistration');
const btnDeleteSel      = $('deleteSelected');

const dateInput         = $('dateInput');
const btnLoadAtt        = $('loadAttendance');
const divAttList        = $('attendanceList');
const btnSaveAtt        = $('saveAttendance');
const sectionResult     = $('attendance-result');
const tbodySummary      = $('summaryBody');
const btnResetAtt       = $('resetAttendance');
const btnShareAtt       = $('shareAttendanceSummary');
const btnDownloadAtt    = $('downloadAttendancePDF');

const analyticsTarget        = $('analyticsTarget');
const analyticsSectionSelect = $('analyticsSectionSelect');
const analyticsAdmInput      = $('analyticsAdmInput');
const monthInput             = $('analyticsMonth');
const btnLoadAnalytics       = $('loadAnalytics');
const btnShareAnalytics      = $('shareAnalytics');
const btnDownloadAnalytics   = $('downloadAnalytics');
const analyticsResult        = $('analyticsResult');
const labelSection           = $('labelSection');

const monthRegInput          = $('registerMonth');
const btnLoadReg             = $('loadRegister');
const btnChangeReg           = $('changeRegister');
const divRegTable            = $('registerTableWrapper');
const tbodyReg               = $('registerBody');
const divRegSummary          = $('registerSummarySection');
const tbodyRegSum            = $('registerSummaryBody');
const btnShareReg2           = $('shareRegister');
const btnDownloadReg2        = $('downloadRegisterPDF');

// Chart contexts (if you still use charts elsewhere)
const ctxBar                 = $('barChart')?.getContext?.('2d');
const ctxPie                 = $('pieChart')?.getContext?.('2d');
let chartBar, chartPie;

// Colors for attendance codes
const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

// --- SETUP LOADING ---
async function loadSetup() {
  const school = await get('schoolName');
  const cls    = await get('teacherClass');
  const sec    = await get('teacherSection');
  if (school && cls && sec) {
    schoolInput.value   = school;
    classSelect.value   = cls;
    sectionSelect.value = sec;
    setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
    setupForm.classList.add('hidden');
    setupDisplay.classList.remove('hidden');
    renderStudents();
    updateTotals();
  }
}

btnSaveSetup.onclick = async e => {
  e.preventDefault();
  if (!schoolInput.value || !classSelect.value || !sectionSelect.value) {
    return alert('Complete setup');
  }
  await set('schoolName', schoolInput.value);
  await set('teacherClass', classSelect.value);
  await set('teacherSection', sectionSelect.value);
  await loadSetup();
};

btnEditSetup.onclick = e => {
  e.preventDefault();
  setupForm.classList.remove('hidden');
  setupDisplay.classList.add('hidden');
};

await loadSetup();

// --- COUNTERS ---
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

function updateTotals() {
  const totalSchool  = students.length;
  const totalClass   = students.filter(s => s.cls === classSelect.value).length;
  const totalSection = students.filter(s => s.cls === classSelect.value && s.sec === sectionSelect.value).length;
  document.getElementById('sectionCount').dataset.target = totalSection;
  document.getElementById('classCount').dataset.target   = totalClass;
  document.getElementById('schoolCount').dataset.target  = totalSchool;
  animateCounters();
}

// --- STUDENT REGISTRATION ---
btnAddStudent.onclick = async e => {
  e.preventDefault();
  const name   = nameInput.value.trim();
  const parent = parentInput.value.trim();
  const cont   = contactInput.value.trim();
  const occ    = occInput.value.trim();
  const addr   = addrInput.value.trim();
  if (!name || !parent || !cont || !occ || !addr) {
    return alert('All fields required');
  }
  if (!/^\d{7,15}$/.test(cont)) {
    return alert('Contact must be 7–15 digits');
  }
  const adm = await generateAdmNo();
  students.push({
    name, adm, parent, contact: cont,
    occupation: occ, address: addr,
    roll: Date.now(), cls: classSelect.value, sec: sectionSelect.value
  });
  await saveStudents();
  renderStudents();
  [nameInput, parentInput, contactInput, occInput, addrInput].forEach(i => i.value = '');
};

function renderStudents() {
  tbodyStudents.innerHTML = '';
  const filtered = students.filter(s => s.cls === classSelect.value && s.sec === sectionSelect.value);
  filtered.forEach((st, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="sel" data-index="${idx}"></td>
      <td>${idx + 1}</td>
      <td>${st.name}</td>
      <td>${st.adm}</td>
      <td>${st.parent}</td>
      <td>${st.contact}</td>
      <td>${st.occupation}</td>
      <td>${st.address}</td>
    `;
    tbodyStudents.appendChild(tr);
  });
  bindRowSelection();
  updateTotals();
}

function bindRowSelection() {
  const boxes = Array.from(tbodyStudents.querySelectorAll('.sel'));
  boxes.forEach(cb => {
    cb.onchange = () => {
      btnDeleteSel.disabled = !boxes.some(x => x.checked);
    };
  });
  selectAllStudents.onchange = () => {
    boxes.forEach(cb => cb.checked = selectAllStudents.checked);
    btnDeleteSel.disabled = !selectAllStudents.checked;
  };
}

// Edit / Save / Delete Selected
btnEditReg.onclick = () => {
  tbodyStudents.querySelectorAll('tr').forEach(tr => {
    tr.querySelectorAll('td').forEach((td, i) => {
      if (i >= 2 && i <= 7) {
        td.contentEditable = true;
        td.classList.add('editing');
      }
    });
  });
  btnEditReg.classList.add('hidden');
  btnSaveReg.classList.remove('hidden');
};

btnSaveReg.onclick = async () => {
  const filtered = students.filter(s => s.cls === classSelect.value && s.sec === sectionSelect.value);
  tbodyStudents.querySelectorAll('tr').forEach((tr, idx) => {
    const cells = tr.querySelectorAll('td');
    const keys = ['name', 'adm', 'parent', 'contact', 'occupation', 'address'];
    keys.forEach((k, i) => {
      filtered[idx][k] = cells[i + 2].textContent.trim();
    });
  });
  await saveStudents();
  renderStudents();
  btnSaveReg.classList.add('hidden');
  btnEditReg.classList.remove('hidden');
};

btnDeleteSel.onclick = async () => {
  if (!confirm('Delete selected?')) return;
  const filtered = students.filter(s => s.cls === classSelect.value && s.sec === sectionSelect.value);
  const toRemove = Array.from(tbodyStudents.querySelectorAll('.sel:checked'))
    .map(cb => filtered[+cb.dataset.index].roll);
  students = students.filter(s => !toRemove.includes(s.roll));
  await saveStudents();
  renderStudents();
};

// --- ATTENDANCE MARKING & SUMMARY ---
btnLoadAtt.onclick = e => {
  e.preventDefault();
  if (!dateInput.value) return alert('Pick a date');
  divAttList.innerHTML = '';
  const filtered = students.filter(s => s.cls === classSelect.value && s.sec === sectionSelect.value);
  filtered.forEach(s => {
    const row = document.createElement('div');
    row.className = 'attendance-item';
    row.textContent = s.name;
    const actions = document.createElement('div');
    actions.className = 'attendance-actions';
    ['P', 'A', 'Lt', 'HD', 'L'].forEach(code => {
      const b = document.createElement('button');
      b.textContent = code;
      b.dataset.code = code;
      b.onclick = () => {
        actions.querySelectorAll('button').forEach(x => {
          x.style.background = '';
          x.style.color = '';
        });
        b.style.background = colors[code];
        b.style.color = '#fff';
      };
      actions.appendChild(b);
    });
    divAttList.append(row, actions);
  });
  btnSaveAtt.classList.remove('hidden');
};

btnSaveAtt.onclick = async e => {
  e.preventDefault();
  const d = dateInput.value;
  attendanceData[d] = {};
  const filtered = students.filter(s => s.cls === classSelect.value && s.sec === sectionSelect.value);
  divAttList.querySelectorAll('.attendance-actions').forEach((actions, i) => {
    const sel = actions.querySelector('button[style*="background"]');
    attendanceData[d][filtered[i].roll] = sel ? sel.dataset.code : 'A';
  });
  await saveAttendanceData();

  // build summary table
  tbodySummary.innerHTML = '';
  filtered.forEach(s => {
    const code   = attendanceData[d][s.roll] || 'A';
    const status = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' }[code];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.name}</td>
      <td>${status}</td>
      <td><button class="send-btn">Send</button></td>
    `;
    tr.querySelector('.send-btn').onclick = () => {
      const msg = [`Date: ${d}`, `Name: ${s.name}`, `Status: ${status}`].join('\n');
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    };
    tbodySummary.appendChild(tr);
  });

  sectionResult.classList.remove('hidden');
};

btnResetAtt.onclick = () => {
  sectionResult.classList.add('hidden');
  divAttList.innerHTML = '';
  btnSaveAtt.classList.add('hidden');
};

btnShareAtt.onclick = () => {
  const d    = dateInput.value;
  const hdr  = `*Attendance* Date: ${d}`;
  const filtered = students.filter(s => s.cls === classSelect.value && s.sec === sectionSelect.value);
  const lines = filtered.map(s => {
    const code   = attendanceData[d][s.roll] || 'A';
    const status = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' }[code];
    return `${s.name}: ${status}`;
  });
  window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n' + lines.join('\n'))}`, '_blank');
};

btnDownloadAtt.onclick = () => {
  const d   = dateInput.value;
  const doc = new jsPDF();
  doc.text('Attendance Summary', 10, 10);
  doc.autoTable({
    head: [['Name','Status']],
    body: students
      .filter(s => s.cls === classSelect.value && s.sec === sectionSelect.value)
      .map(s => {
        const code   = attendanceData[d][s.roll] || 'A';
        const status = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' }[code];
        return [s.name, status];
      }),
    startY: 20
  });
  doc.save('attendance.pdf');
};

// --- ANALYTICS ---
analyticsTarget.onchange = () => {
  const v = analyticsTarget.value;
  labelSection.classList.toggle('hidden', v !== 'section');
  analyticsSectionSelect.classList.toggle('hidden', v !== 'section');
  analyticsAdmInput.classList.toggle('hidden', v !== 'student');
};

btnLoadAnalytics.onclick = e => {
  e.preventDefault();
  if (!analyticsTarget.value || !monthInput.value) {
    return alert('Select report type and month');
  }

  // build pool
  let pool = students.filter(s => s.cls === classSelect.value);
  if (analyticsTarget.value === 'section') {
    pool = pool.filter(s => s.sec === analyticsSectionSelect.value);
  } else if (analyticsTarget.value === 'student') {
    const adm = analyticsAdmInput.value.trim();
    pool = pool.filter(s => s.adm === adm);
    if (!pool.length) return alert('No student with that Adm#');
  }

  // tally
  const stats = pool.map(s => ({ name: s.name, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
  Object.entries(attendanceData).forEach(([date, recs]) => {
    if (!date.startsWith(monthInput.value)) return;
    stats.forEach(st => {
      const code = recs[st.roll] || 'A';
      st[code]++;
      st.total++;
    });
  });

  // render table
  let html = `<table>
    <thead><tr>
      <th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>%</th>
    </tr></thead><tbody>`;
  stats.forEach(s => {
    const pct = s.total ? ((s.P / s.total) * 100).toFixed(1) : '0.0';
    html += `<tr>
      <td>${s.name}</td>
      <td>${s.P}</td>
      <td>${s.A}</td>
      <td>${s.Lt}</td>
      <td>${s.HD}</td>
      <td>${s.L}</td>
      <td>${pct}</td>
    </tr>`;
  });
  html += `</tbody></table>`;

  analyticsResult.innerHTML = html;
  analyticsResult.classList.remove('hidden');
  btnShareAnalytics.classList.remove('hidden');
  btnDownloadAnalytics.classList.remove('hidden');
};

btnShareAnalytics.onclick = () => {
  const rows = Array.from(analyticsResult.querySelectorAll('tbody tr')).map(r => {
    const cells = Array.from(r.children).map(td => td.textContent);
    return `${cells[0]}: P=${cells[1]}, A=${cells[2]}, Lt=${cells[3]}, HD=${cells[4]}, L=${cells[5]}, %=${cells[6]}`;
  });
  const hdr = `Attendance Report (${analyticsTarget.value} - ${monthInput.value})`;
  window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n' + rows.join('\n'))}`, '_blank');
};

btnDownloadAnalytics.onclick = () => {
  const doc = new jsPDF();
  doc.text(`Attendance Report (${analyticsTarget.value} - ${monthInput.value})`, 10, 10);
  doc.autoTable({ html: '#analyticsResult table', startY: 20 });
  doc.save('analytics.pdf');
};

// --- ATTENDANCE REGISTER ---
btnLoadReg.onclick = e => {
  e.preventDefault();
  if (!monthRegInput.value) return alert('Select month');
  const [y, m] = monthRegInput.value.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();

  // header
  const thead = $('#registerTable').querySelector('thead tr');
  thead.innerHTML = '<th>Sr#</th><th>Adm#</th><th>Name</th>' +
    Array.from({ length: days }, (_, i) => `<th>${i+1}</th>`).join('');

  // body
  tbodyReg.innerHTML = '';
  const filtered = students.filter(s => s.cls === classSelect.value && s.sec === sectionSelect.value);
  filtered.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
      Array.from({ length: days }, (_, d) => {
        const code = (attendanceData[`${monthRegInput.value}-${String(d+1).padStart(2,'0')}`] || {})[s.roll] || 'A';
        return `<td style="background:${colors[code]};color:#fff">${code}</td>`;
      }).join('');
    tbodyReg.appendChild(tr);
  });

  // summary
  tbodyRegSum.innerHTML = '';
  filtered.forEach(s => {
    let stat = { P:0, A:0, Lt:0, HD:0, L:0, total:0 };
    for (let d = 1; d <= days; d++) {
      const code = (attendanceData[`${monthRegInput.value}-${String(d).padStart(2,'0')}`] || {})[s.roll] || 'A';
      stat[code]++; stat.total++;
    }
    const pct = stat.total ? ((stat.P / stat.total) * 100).toFixed(1) : '0.0';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.name}</td><td>${stat.P}</td><td>${stat.A}</td><td>${stat.Lt}</td><td>${stat.HD}</td><td>${stat.L}</td><td>${pct}</td>`;
    tbodyRegSum.appendChild(tr);
  });

  divRegTable.classList.remove('hidden');
  divRegSummary.classList.remove('hidden');
  btnLoadReg.classList.add('hidden');
  btnChangeReg.classList.remove('hidden');
};

btnChangeReg.onclick = e => {
  e.preventDefault();
  divRegTable.classList.add('hidden');
  divRegSummary.classList.add('hidden');
  btnLoadReg.classList.remove('hidden');
  btnChangeReg.classList.add('hidden');
};

btnShareReg2.onclick = e => {
  e.preventDefault();
  const hdr = `*Attendance Register* for ${monthRegInput.value}\nSchool: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
  const lines = Array.from(tbodyRegSum.querySelectorAll('tr')).map(r => {
    const [name,p,a,lt,hd,l,pct] = Array.from(r.querySelectorAll('td')).map(td => td.textContent);
    return `${name}: P:${p}, A:${a}, Lt:${lt}, HD:${hd}, L:${l}, %:${pct}`;
  });
  window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n' + lines.join('\n'))}`, '_blank');
};

btnDownloadReg2.onclick = () => {
  const doc = new jsPDF('landscape');
  doc.autoTable({ html: '#registerTable', startY: 10, styles: { fontSize: 6 } });
  doc.autoTable({ html: '#registerSummarySection table', startY: doc.lastAutoTable.finalY + 10, styles: { fontSize: 8 } });
  doc.save('register.pdf');
};

// --- SERVICE WORKER ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(() => {});
}
