// app.js
// ===== IndexedDB setup (using idb) =====
const dbPromise = idb.openDB('attendance-db', 1, {
  upgrade(db) {
    db.createObjectStore('settings');                     // key → simple values
    db.createObjectStore('students', { keyPath: 'adm' }); // key = admission #
    db.createObjectStore('attendance');                   // date → { adm: code }
  }
});

async function getSetting(key) {
  return (await dbPromise).get('settings', key);
}
async function setSetting(key, value) {
  return (await dbPromise).put('settings', value, key);
}
async function getAllStudents() {
  return (await dbPromise).getAll('students');
}
async function saveStudent(obj) {
  return (await dbPromise).put('students', obj);
}
async function deleteStudent(adm) {
  return (await dbPromise).delete('students', adm);
}
async function getAttendance(date) {
  return (await dbPromise).get('attendance', date) || {};
}
async function saveAttendance(date, data) {
  return (await dbPromise).put('attendance', data, date);
}
async function getAllAttendanceDates() {
  return (await dbPromise).getAllKeys('attendance');
}
// ========================================

window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const colors = { P: '#4CAF50', A: '#f44336', Lt: '#FFEB3B', HD: '#FF9800', L: '#03a9f4' };

  // 1. SETUP
  const schoolIn       = $('schoolNameInput');
  const classSel       = $('teacherClassSelect');
  const secSel         = $('teacherSectionSelect');
  const saveSetupBtn   = $('saveSetup');
  const setupForm      = $('setupForm');
  const setupDisplay   = $('setupDisplay');
  const setupText      = $('setupText');
  const editSetupBtn   = $('editSetup');

  async function loadSetup() {
    const school = await getSetting('schoolName');
    const cls    = await getSetting('teacherClass');
    const sec    = await getSetting('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value   = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetupBtn.onclick = async e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) {
      alert('Complete setup');
      return;
    }
    await setSetting('schoolName', schoolIn.value);
    await setSetting('teacherClass', classSel.value);
    await setSetting('teacherSection', secSel.value);
    await loadSetup();
  };

  editSetupBtn.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };

  await loadSetup();

  // 2. STUDENT REGISTRATION
  let students = await getAllStudents();
  const studentNameIn    = $('studentName');
  const admissionNoIn    = $('admissionNo');
  const parentNameIn     = $('parentName');
  const parentContactIn  = $('parentContact');
  const parentOccIn      = $('parentOccupation');
  const parentAddrIn     = $('parentAddress');
  const addStudentBtn    = $('addStudent');
  const studentsBody     = $('studentsBody');
  const selectAllCb      = $('selectAllStudents');
  const editSelBtn       = $('editSelected');
  const deleteSelBtn     = $('deleteSelected');
  const saveRegBtn       = $('saveRegistration');
  const shareRegBtn      = $('shareRegistration');
  const editRegBtn       = $('editRegistration');
  const downloadRegBtn   = $('downloadRegistrationPDF');
  let regSaved = false, inlineEdit = false;

  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelBtn.disabled = deleteSelBtn.disabled = !any;
      };
    });
    selectAllCb.disabled = regSaved;
    selectAllCb.onchange = () => {
      if (!regSaved) {
        boxes.forEach(cb => {
          cb.checked = selectAllCb.checked;
          cb.dispatchEvent(new Event('change'));
        });
      }
    };
  }

  async function renderStudents() {
    students = await getAllStudents();
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-adm="${s.adm}" ${regSaved ? 'disabled' : ''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved ? '<button class="share-one">Share</button>' : ''}</td>`;
      if (regSaved) {
        tr.querySelector('.share-one').onclick = ev => {
          ev.preventDefault();
          const hdr = `School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
          const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }

  addStudentBtn.onclick = async ev => {
    ev.preventDefault();
    const name    = studentNameIn.value.trim();
    const adm     = admissionNoIn.value.trim();
    const parent  = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occ     = parentOccIn.value.trim();
    const addr    = parentAddrIn.value.trim();
    if (!name || !adm || !parent || !contact || !occ || !addr) {
      alert('All fields required');
      return;
    }
    if (!/^\d+$/.test(adm)) {
      alert('Adm# must be numeric');
      return;
    }
    if (students.some(s => s.adm === adm)) {
      alert(`Admission# ${adm} already exists`);
      return;
    }
    if (!/^\d{7,15}$/.test(contact)) {
      alert('Contact must be 7-15 digits');
      return;
    }
    await saveStudent({ name, adm, parent, contact, occupation: occ, address: addr });
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn]
      .forEach(i => i.value = '');
    await renderStudents();
  };

  editSelBtn.onclick = ev => {
    ev.preventDefault();
    inlineEdit = !inlineEdit;
    editSelBtn.textContent = inlineEdit ? 'Done Editing' : 'Edit Selected';
    document.querySelectorAll('.sel:checked').forEach(cb => {
      const tr = cb.closest('tr');
      tr.querySelectorAll('td').forEach((td, ci) => {
        if (ci >= 1 && ci <= 6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          if (inlineEdit) {
            td.addEventListener('blur', onCellBlur);
          } else {
            td.removeEventListener('blur', onCellBlur);
          }
        }
      });
    });
  };

  async function onCellBlur(e) {
    const td = e.target, tr = td.closest('tr');
    const adm = tr.querySelector('.sel').dataset.adm;
    const idx = ['name','adm','parent','contact','occupation','address'][Array.from(tr.children).indexOf(td) - 1];
    let val = td.textContent.trim();
    if (idx === 'adm') {
      if (!/^\d+$/.test(val)) { alert('Adm# must be numeric'); await renderStudents(); return; }
      if (students.some(s => s.adm === val && s.adm !== adm)) { alert('Duplicate Adm#'); await renderStudents(); return; }
    }
    const s = (await getAllStudents()).find(s => s.adm === adm);
    s[idx] = val;
    if (idx === 'adm') {
      await deleteStudent(adm);
      await saveStudent(s);
    } else {
      await saveStudent(s);
    }
    await renderStudents();
  }

  deleteSelBtn.onclick = async ev => {
    ev.preventDefault();
    if (!confirm('Delete selected?')) return;
    const toDelete = Array.from(document.querySelectorAll('.sel:checked')).map(cb => cb.dataset.adm);
    for (let adm of toDelete) {
      await deleteStudent(adm);
    }
    await renderStudents();
    selectAllCb.checked = false;
  };

  saveRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id => $(id).classList.remove('hidden'));
    $('studentTableWrapper').classList.add('saved');
  };

  editRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id => $(id).classList.add('hidden'));
    $('studentTableWrapper').classList.remove('saved');
  };

  await renderStudents();

  // 3. ATTENDANCE MARKING & SUMMARY
  const dateInput    = $('dateInput');
  const loadAttBtn   = $('loadAttendance');
  const attList      = $('attendanceList');
  const saveAttBtn   = $('saveAttendance');
  const resultSec    = $('attendance-result');
  const summaryBody  = $('summaryBody');

  loadAttBtn.onclick = async ev => {
    ev.preventDefault();
    if (!dateInput.value) { alert('Pick a date'); return; }
    attList.innerHTML = '';
    const attendanceData = await getAttendance(dateInput.value);
    students = await getAllStudents();
    students.forEach(s => {
      const row = document.createElement('div');
      row.className = 'attendance-item'; row.textContent = s.name;
      const btns = document.createElement('div'); btns.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button');
        b.textContent = code; b.className = 'att-btn';
        if (attendanceData[s.adm] === code) { b.style.background = colors[code]; b.style.color = '#fff'; }
        b.onclick = () => {
          btns.querySelectorAll('.att-btn').forEach(x => { x.style.background = ''; x.style.color = '#333'; });
          b.style.background = colors[code]; b.style.color = '#fff';
        };
        btns.append(b);
      });
      attList.append(row, btns);
    });
    saveAttBtn.classList.remove('hidden');
  };

  saveAttBtn.onclick = async ev => {
    ev.preventDefault();
    const date = dateInput.value;
    const data = {};
    document.querySelectorAll('.attendance-actions').forEach((btns, i) => {
      const sel = btns.querySelector('.att-btn[style*="background"]');
      const adm = students[i].adm;
      data[adm] = sel ? sel.textContent : 'A';
    });
    await saveAttendance(date, data);

    // show summary
    resultSec.classList.remove('hidden');
    summaryBody.innerHTML = '';
    const hdr = `Date: ${date}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    students.forEach(s => {
      const code = data[s.adm] || 'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick = () => {
        const msg = `${hdr}\n\nName: ${s.name}\nStatus: ${status}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  // 4. ANALYTICS
  const analyticsTarget = $('analyticsTarget');
  const studentAdmIn    = $('studentAdmInput');
  const analyticsType   = $('analyticsType');
  const analyticsDate   = $('analyticsDate');
  const analyticsMonth  = $('analyticsMonth');
  const semesterStart   = $('semesterStart');
  const semesterEnd     = $('semesterEnd');
  const yearStart       = $('yearStart');
  const loadAnalytics   = $('loadAnalytics');
  const resetAnalytics  = $('resetAnalytics');
  const instructionsEl  = $('instructions');
  const analyticsCont   = $('analyticsContainer');
  const graphsEl        = $('graphs');
  let barChart, pieChart;

  function hideAllAnalytics() {
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart,
     instructionsEl, analyticsCont, graphsEl, resetAnalytics].forEach(el => el.classList.add('hidden'));
  }
  analyticsTarget.onchange = () => {
    studentAdmIn.classList.toggle('hidden', analyticsTarget.value !== 'student');
    hideAllAnalytics();
    analyticsType.value = '';
  };
  analyticsType.onchange = () => {
    hideAllAnalytics();
    if (analyticsType.value === 'date') analyticsDate.classList.remove('hidden');
    if (analyticsType.value === 'month') analyticsMonth.classList.remove('hidden');
    if (analyticsType.value === 'semester') { semesterStart.classList.remove('hidden'); semesterEnd.classList.remove('hidden'); }
    if (analyticsType.value === 'year') yearStart.classList.remove('hidden');
    resetAnalytics.classList.remove('hidden');
  };
  resetAnalytics.onclick = ev => {
    ev.preventDefault();
    hideAllAnalytics();
    analyticsType.value = '';
  };

  loadAnalytics.onclick = async ev => {
    ev.preventDefault();
    let from, to;
    if (analyticsType.value === 'date') {
      if (!analyticsDate.value) return alert('Pick a date');
      from = to = analyticsDate.value;
    } else if (analyticsType.value === 'month') {
      if (!analyticsMonth.value) return alert('Pick a month');
      const [y, m] = analyticsMonth.value.split('-').map(Number);
      from = `${analyticsMonth.value}-01`;
      to   = `${analyticsMonth.value}-${new Date(y, m, 0).getDate()}`;
    } else if (analyticsType.value === 'semester') {
      if (!semesterStart.value || !semesterEnd.value) return alert('Pick semester range');
      const [sy, sm] = semesterStart.value.split('-').map(Number);
      const [ey, em] = semesterEnd.value.split('-').map(Number);
      from = `${semesterStart.value}-01`;
      to   = `${semesterEnd.value}-${new Date(ey, em, 0).getDate()}`;
    } else if (analyticsType.value === 'year') {
      if (!yearStart.value) return alert('Pick year');
      from = `${yearStart.value}-01-01`;
      to   = `${yearStart.value}-12-31`;
    } else {
      return alert('Select period');
    }

    // init stats
    students = await getAllStudents();
    const stats = (analyticsTarget.value === 'student'
      ? students.filter(s => s.adm === studentAdmIn.value.trim())
      : students
    ).map(s => ({ ...s, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));

    // gather dates in range
    const allDates = await getAllAttendanceDates();
    for (const d of allDates) {
      const cur = new Date(d);
      if (cur >= new Date(from) && cur <= new Date(to)) {
        const recs = await getAttendance(d);
        stats.forEach(st => {
          const code = recs[st.adm] || 'A';
          st[code]++; st.total++;
        });
      }
    }

    // render table
    let html = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s => {
      const pct = s.total ? ((s.P/s.total)*100).toFixed(1) : '0.0';
      html += `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
    });
    html += '</tbody></table>';
    analyticsCont.innerHTML = html;
    analyticsCont.classList.remove('hidden');
    instructionsEl.textContent = analyticsTarget.value==='student'
      ? `Admission#: ${studentAdmIn.value.trim()} | Report: ${from} to ${to}`
      : `Report: ${from} to ${to}`;
    instructionsEl.classList.remove('hidden');

    // charts
    const labels = stats.map(s => s.name);
    const dataPct = stats.map(s => s.total ? (s.P/s.total)*100 : 0);
    if (barChart) barChart.destroy();
    barChart = new Chart($('barChart').getContext('2d'), {
      type:'bar',
      data:{ labels, datasets:[{ label:'% Present', data: dataPct }]},
      options:{ responsive:true, scales:{ y:{ beginAtZero:true, max:100 } } }
    });
    const agg = stats.reduce((a,s) => {
      ['P','A','Lt','HD','L'].forEach(c => a[c]+=s[c]);
      return a;
    }, {P:0,A:0,Lt:0,HD:0,L:0});
    if (pieChart) pieChart.destroy();
    pieChart = new Chart($('pieChart').getContext('2d'), {
      type:'pie',
      data:{ labels:['Present','Absent','Late','Half Day','Leave'], datasets:[{ data:Object.values(agg) }]},
      options:{ responsive:true }
    });
    graphsEl.classList.remove('hidden');
  };

  // 5. ATTENDANCE REGISTER
  const regMonthIn      = $('registerMonth');
  const loadRegBtn      = $('loadRegister');
  const changeRegBtn    = $('changeRegister');
  const regTableWrapper = $('registerTableWrapper');
  const regBody         = $('registerBody');
  const regSummarySec   = $('registerSummarySection');
  const regSummaryBody  = $('registerSummaryBody');

  function generateRegisterHeader(days) {
    const headerRow = document.querySelect
er('#registerTable thead tr');
    headerRow.innerHTML = '<th>Sr#</th><th>Adm#</th><th>Name</th>';
    for (let d = 1; d <= days; d++) {
      headerRow.innerHTML += `<th>${d}</th>`;
    }
  }

  loadRegBtn.onclick = async e => {
    e.preventDefault();
    if (!regMonthIn.value) { alert('Select month'); return; }
    const [y,m] = regMonthIn.value.split('-').map(Number);
    const daysInMonth = new Date(y,m,0).getDate();
    generateRegisterHeader(daysInMonth);
    regBody.innerHTML = '';
    regSummaryBody.innerHTML = '';
    students = await getAllStudents();
    const allDates = await getAllAttendanceDates();

    // build table
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${regMonthIn.value}-${String(d).padStart(2,'0')}`;
        const recs = allDates.includes(dateStr) ? await getAttendance(dateStr) : {};
        const code = recs[s.adm] || 'A';
        const td = document.createElement('td');
        td.textContent = code;
        td.style.background = colors[code]; td.style.color = '#fff';
        tr.appendChild(td);
      }
      regBody.appendChild(tr);
    }

    // summary
    students.forEach(s => {
      let st = {P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${regMonthIn.value}-${String(d).padStart(2,'0')}`;
        const recs = allDates.includes(dateStr) ? await getAttendance(dateStr) : {};
        const code = recs[s.adm] || 'A';
        st[code]++; st.total++;
      }
      const pct = st.total ? ((st.P/st.total)*100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${pct}</td>`;
      regSummaryBody.appendChild(tr);
    });

    regTableWrapper.classList.remove('hidden');
    regSummarySec.classList.remove('hidden');
    loadRegBtn.classList.add('hidden');
    changeRegBtn.classList.remove('hidden');
  };

  changeRegBtn.onclick = e => {
    e.preventDefault();
    regTableWrapper.classList.add('hidden');
    regSummarySec.classList.add('hidden');
    loadRegBtn.classList.remove('hidden');
    changeRegBtn.classList.add('hidden');
  };

  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js');
    });
  }
});
