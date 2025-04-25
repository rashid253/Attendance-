// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // idb-keyval storage
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);

  // Load persistent data before any function definitions
  let allStudents = await get('students') || [];
  let attendanceData = await get('attendanceData') || {};
  let regSaved = false;
  let inlineEdit = false;

  // Cache DOM elements
  const schoolIn = $('schoolNameInput');
  const classSel = $('teacherClassSelect');
  const secSel = $('teacherSectionSelect');
  const saveSetupBtn = $('saveSetup');
  const setupForm = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText = $('setupText');
  const editSetupBtn = $('editSetup');

  const studentNameIn = $('studentName');
  const admissionNoIn = $('admissionNo');
  const parentNameIn = $('parentName');
  const parentContactIn = $('parentContact');
  const parentOccIn = $('parentOccupation');
  const parentAddrIn = $('parentAddress');
  const addStudentBtn = $('addStudent');
  const studentsBody = $('studentsBody');
  const selectAllCb = $('selectAllStudents');
  const editSelBtn = $('editSelected');
  const deleteSelBtn = $('deleteSelected');
  const saveRegBtn = $('saveRegistration');
  const shareRegBtn = $('shareRegistration');
  const editRegBtn = $('editRegistration');
  const downloadRegBtn = $('downloadRegistrationPDF');

  const dateInput = $('dateInput');
  const loadAttBtn = $('loadAttendance');
  const attList = $('attendanceList');
  const saveAttBtn = $('saveAttendance');
  const resultSection = $('attendance-result');
  const summaryBody = $('summaryBody');
  const resetAttBtn = $('resetAttendance');
  const shareAttBtn = $('shareAttendanceSummary');
  const downloadAttBtn = $('downloadAttendancePDF');

  const analyticsTarget = $('analyticsTarget');
  const studentAdmInput = $('studentAdmInput');
  const analyticsType = $('analyticsType');
  const analyticsDate = $('analyticsDate');
  const analyticsMonth = $('analyticsMonth');
  const semesterStart = $('semesterStart');
  const semesterEnd = $('semesterEnd');
  const yearStart = $('yearStart');
  const loadAnalyticsBtn = $('loadAnalytics');
  const resetAnalyticsBtn = $('resetAnalytics');
  const instructionsEl = $('instructions');
  const analyticsContainer = $('analyticsContainer');
  const graphsEl = $('graphs');
  const shareAnalyticsBtn = $('shareAnalytics');
  const downloadAnalyticsBtn = $('downloadAnalytics');
  const barCtx = $('barChart').getContext('2d');
  const pieCtx = $('pieChart').getContext('2d');
  let barChart, pieChart;

  const colors = { P: '#4CAF50', A: '#f44336', Lt: '#FFEB3B', HD: '#FF9800', L: '#03a9f4' };

  // Helper functions
  function getCurrentClassSection() {
    return { cls: classSel.value, sec: secSel.value };
  }

  function filteredStudents() {
    const { cls, sec } = getCurrentClassSection();
    return allStudents.filter(s => s.cls === cls && s.sec === sec);
  }

  async function saveAllStudents() {
    await set('students', allStudents);
  }

  function bindSelection() {
    const boxes = Array.from(studentsBody.querySelectorAll('.sel'));
    boxes.forEach(cb => cb.onchange = () => {
      cb.closest('tr').classList.toggle('selected', cb.checked);
      const any = boxes.some(x => x.checked);
      editSelBtn.disabled = deleteSelBtn.disabled = !any;
    }));
    selectAllCb.disabled = regSaved;
    selectAllCb.onchange = () => boxes.forEach(cb => {
      cb.checked = selectAllCb.checked;
      cb.dispatchEvent(new Event('change'));
    });
  }

  function renderStudents() {
    const list = filteredStudents();
    studentsBody.innerHTML = '';
    list.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved ? 'disabled' : ''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved ? '<button class="share-one">Share</button>' : ''}</td>`;
      if (regSaved) {
        const btn = tr.querySelector('.share-one');
        if (btn) btn.onclick = e => {
          e.preventDefault();
          const hdr = `School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
          const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }

  function onCellBlur(e) {
    const td = e.target;
    const tr = td.closest('tr');
    const idx = +tr.querySelector('.sel').dataset.index;
    const keys = ['name', 'adm', 'parent', 'contact', 'occupation', 'address'];
    const ci = Array.from(tr.children).indexOf(td);
    const val = td.textContent.trim();
    const stu = filteredStudents()[idx];
    if (ci === 2 && !/^\d+$/.test(val)) return alert('Adm# must be numeric');
    if (ci === 2 && allStudents.some(s => s.adm === val && s.roll !== stu.roll)) return alert('Duplicate Adm# not allowed');
    if (ci >= 1 && ci <= 6) {
      stu[keys[ci - 1]] = val;
      allStudents = allStudents.map(s => s.roll === stu.roll ? stu : s);
      saveAllStudents();
    }
    renderStudents();
  }

  // Setup handlers
  async function loadSetup() {
    const school = await get('schoolName');
    const cls = await get('teacherClass');
    const sec = await get('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
      renderStudents();
    }
  }

  saveSetupBtn.onclick = async e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    await set('schoolName', schoolIn.value);
    await set('teacherClass', classSel.value);
    await set('teacherSection', secSel.value);
    await loadSetup();
  };
  editSetupBtn.onclick = e => { e.preventDefault(); setupForm.classList.remove('hidden'); setupDisplay.classList.add('hidden'); };
  await loadSetup();

  // Registration handlers
  addStudentBtn.onclick = async e => {
    e.preventDefault();
    const name = studentNameIn.value.trim();
    const adm = admissionNoIn.value.trim();
    const parent = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occ = parentOccIn.value.trim();
    const addr = parentAddrIn.value.trim();
    if (!name || !adm || !parent || !contact || !occ || !addr) return alert('All fields required');
    if (!/^\d+$/.test(adm)) return alert('Adm# must be numeric');
    if (!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits');
    const { cls, sec } = getCurrentClassSection();
    if (allStudents.some(s => s.adm === adm && s.cls === cls && s.sec === sec)) return alert('Duplicate Admission#');
    allStudents.push({ name, adm, parent, contact, occupation: occ, address: addr, roll: Date.now(), cls, sec });
    await saveAllStudents();
    renderStudents();
  };

  editSelBtn.onclick = e => {
    e.preventDefault();
    inlineEdit = !inlineEdit;
    editSelBtn.textContent = inlineEdit ? 'Done Editing' : 'Edit Selected';
    Array.from(document.querySelectorAll('.sel:checked')).forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td, ci) => {
        if (ci >= 1 && ci <= 6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit ? td.addEventListener('blur', onCellBlur) : td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  deleteSelBtn.onclick = async e => {
    e.preventDefault(); if (!confirm('Delete selected?')) return;
    const rolls = Array.from(document.querySelectorAll('.sel:checked')).map(cb => filteredStudents()[+cb.dataset.index].roll);
    allStudents = allStudents.filter(s => !rolls.includes(s.roll));
    await saveAllStudents(); renderStudents();
  };

  saveRegBtn.onclick = e => {
    e.preventDefault(); regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id => $(id).classList.remove('hidden'));
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };
  editRegBtn.onclick = e => {
    e.preventDefault(); regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id => $(id).classList.add('hidden'));
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick = e => {
    e.preventDefault();
    const hdr = `School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines = filteredStudents().map(s =>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`, '_blank');
  };

  downloadRegBtn.onclick = e => {
    /* PDF generation code with the same null-check patterns */
  };

  // Attendance Marking handlers
  loadAttBtn.onclick = e => {
    e.preventDefault();
    const date = dateInput.value; if (!date) return alert('Pick a date');
    attList.innerHTML = '';
    filteredStudents().forEach(s => {
      const row = document.createElement('div'); row.className='attendance-item'; row.textContent=s.name;
      const actions = document.createElement('div'); actions.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const btn = document.createElement('button'); btn.type='button'; btn.textContent=code; btn.dataset.code=code;
        if (attendanceData[date]?.[s.roll]===code) { btn.style.background=colors[code]; btn.style.color='#fff'; }
        btn.onclick = e2 => {
          e2.preventDefault();
          actions.querySelectorAll('button').forEach(b => { b.style.background=''; b.style.color='#333'; });
          btn.style.background=colors[code]; btn.style.color='#fff';
        };
        actions.appendChild(btn);
      });
      attList.append(row); attList.append(actions);
    });
    saveAttBtn.classList.remove('hidden');
  };

  saveAttBtn.onclick = async e => {
    e.preventDefault();
    const date = dateInput.value;
    attendanceData[date] = {};
    document.querySelectorAll('.attendance-actions').forEach((actions, i) => {
      const sel = actions.querySelector('button[style*="background"]');
      attendanceData[date][filteredStudents()[i].roll] = sel?.dataset.code || 'A';
    });
    await set('attendanceData', attendanceData);
    $('attendance-section').classList.add('hidden');
    resultSection.classList.remove('hidden');
    summaryBody.innerHTML = `<tr><td colspan="3"><em>Date: ${date}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}</em></td></tr>`;
    filteredStudents().forEach(s => {
      const code = attendanceData[date][s.roll] || 'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class='send-btn'>Send</button></td>`;
      const btn = tr.querySelector('.send-btn');
      if (btn) btn.onclick = e2 => {
        e2.preventDefault();
        window.open(`https://wa.me/?text=${encodeURIComponent(
          `Date: ${date}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}\n\nName: ${s.name}\nStatus: ${status}`
        )}`, '_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  resetAttBtn.onclick = _ => {
    resultSection.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    attList.innerHTML = '';
    saveAttBtn.classList.add('hidden');
    summaryBody.innerHTML = '';
  };
  shareAttBtn.onclick = _ => { /* ... */ };
  downloadAttBtn.onclick = _ => { /* ... */ };

  // Analytics and Register sections follow the same initialization-first pattern…

  // Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('ServiceWorker registered:', reg.scope))
        .catch(err => console.error('ServiceWorker failed:', err));
    });
  }
});
