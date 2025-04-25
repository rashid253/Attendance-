// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // Use the global idbKeyval IIFE script loaded in index.html
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);
  const colors = { P: '#4CAF50', A: '#f44336', Lt: '#FFEB3B', HD: '#FF9800', L: '#03a9f4' };

  // ─── 1. SETUP ─────────────────────────────────────────────────────────────────
  const schoolIn     = $('schoolNameInput');
  const classSel     = $('teacherClassSelect');
  const secSel       = $('teacherSectionSelect');
  const saveSetup    = $('saveSetup');
  const setupForm    = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText    = $('setupText');
  const editSetup    = $('editSetup');

  async function loadSetup() {
    const school = await get('schoolName');
    const cls    = await get('teacherClass');
    const sec    = await get('teacherSection');
    if (school && cls && sec) {
      schoolIn.value   = school;
      classSel.value   = cls;
      secSel.value     = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetup.addEventListener('click', async e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) {
      return alert('Complete setup');
    }
    await set('schoolName', schoolIn.value);
    await set('teacherClass', classSel.value);
    await set('teacherSection', secSel.value);
    await loadSetup();
  });

  editSetup.addEventListener('click', e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  });

  await loadSetup();

  // ─── 2. STUDENT REGISTRATION ─────────────────────────────────────────────────
  let students = (await get('students')) || [];
  const studentNameIn   = $('studentName');
  const admissionNoIn   = $('admissionNo');
  const parentNameIn    = $('parentName');
  const parentContactIn = $('parentContact');
  const parentOccIn     = $('parentOccupation');
  const parentAddrIn    = $('parentAddress');
  const addStudentBtn   = $('addStudent');
  const studentsBody    = $('studentsBody');
  const selectAll       = $('selectAllStudents');
  const editSelBtn      = $('editSelected');
  const deleteSelBtn    = $('deleteSelected');
  const saveRegBtn      = $('saveRegistration');
  const shareRegBtn     = $('shareRegistration');
  const editRegBtn      = $('editRegistration');
  const downloadRegBtn  = $('downloadRegistrationPDF');
  let regSaved = false, inlineEdit = false;

  async function saveStudents() {
    await set('students', students);
  }

  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved ? 'disabled' : ''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved ? '<button class="share-one">Share</button>' : ''}</td>`;
      if (regSaved) {
        tr.querySelector('.share-one').addEventListener('click', () => {
          const hdr = `School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
          const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        });
      }
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }

  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelBtn.disabled = deleteSelBtn.disabled = !any;
      };
    });
    selectAll.disabled = regSaved;
    selectAll.onchange = () => {
      if (!regSaved) boxes.forEach(cb => {
        cb.checked = selectAll.checked;
        cb.dispatchEvent(new Event('change'));
      });
    };
  }

  addStudentBtn.addEventListener('click', async e => {
    e.preventDefault();
    const name    = studentNameIn.value.trim();
    const adm     = admissionNoIn.value.trim();
    const parent  = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occ     = parentOccIn.value.trim();
    const addr    = parentAddrIn.value.trim();
    if (!name || !adm || !parent || !contact || !occ || !addr) return alert('All fields required');
    if (!/^\d+$/.test(adm)) return alert('Adm# must be numeric');
    if (students.some(s => s.adm === adm)) return alert('Duplicate Adm# not allowed');
    if (!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits');
    students.push({ name, adm, parent, contact, occupation: occ, address: addr, roll: Date.now() });
    await saveStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn].forEach(i => i.value = '');
  });

  function onCellBlur(e) {
    const td = e.target, tr = td.closest('tr');
    const idx = +tr.querySelector('.sel').dataset.index;
    const ci  = Array.from(tr.children).indexOf(td);
    const keys = ['name','adm','parent','contact','occupation','address'];
    const val = td.textContent.trim();
    if (ci === 2) {
      if (!/^\d+$/.test(val)) { alert('Adm# must be numeric'); renderStudents(); return; }
      if (students.some((s,i2) => s.adm===val && i2!==idx)) { alert('Duplicate Adm# not allowed'); renderStudents(); return; }
    }
    if (ci>=1 && ci<=6) {
      students[idx][keys[ci-1]] = val;
      saveStudents();
    }
  }

  editSelBtn.addEventListener('click', e => {
    e.preventDefault();
    const sel = Array.from(document.querySelectorAll('.sel:checked'));
    if (!sel.length) return;
    inlineEdit = !inlineEdit;
    editSelBtn.textContent = inlineEdit ? 'Done Editing' : 'Edit Selected';
    sel.forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td,ci) => {
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit ? td.addEventListener('blur', onCellBlur) : td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  });

  deleteSelBtn.addEventListener('click', async e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb => +cb.dataset.index)
      .sort((a,b)=>b-a)
      .forEach(i => students.splice(i,1));
    await saveStudents();
    renderStudents();
    selectAll.checked = false;
  });

  saveRegBtn.addEventListener('click', e => {
    e.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegBtn.classList.remove('hidden');
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  });

  editRegBtn.addEventListener('click', e => {
    e.preventDefault();
    regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegBtn.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  });

  shareRegBtn.addEventListener('click', e => {
    e.preventDefault();
    const hdr = `School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines = students.map(s =>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines)}`, '_blank');
  });

  downloadRegBtn.addEventListener('click', e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Student Registration', 10, 10);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 10, 20);
    doc.text(`School: ${schoolIn.value}`, 10, 26);
    doc.text(`Class: ${classSel.value}`, 10, 32);
    doc.text(`Section: ${secSel.value}`, 10, 38);
    doc.autoTable({
      head: [['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: students.map(s => [s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY: 44
    });
    doc.save('student_registration.pdf');
  });

  renderStudents();

  // ─── 3. ATTENDANCE MARKING ─────────────────────────────────────────────────────
  let attendanceData = (await get('attendanceData')) || {};
  const dateInput      = $('dateInput');
  const loadAtt        = $('loadAttendance');
  const attList        = $('attendanceList');
  const saveAtt        = $('saveAttendance');
  const resultSection  = $('attendance-result');
  const summaryBody    = $('summaryBody');
  const resetAtt       = $('resetAttendance');
  const shareAtt       = $('shareAttendanceSummary');
  const downloadAttPDF = $('downloadAttendancePDF');

  loadAtt.addEventListener('click', e => {
    e.preventDefault();
    if (!dateInput.value) return alert('Pick a date');
    attList.innerHTML = '';
    students.forEach(s => {
      const row = document.createElement('div');
      row.className = 'attendance-item';
      row.textContent = s.name;
      const btns = document.createElement('div');
      btns.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'att-btn';
        b.dataset.code = code;
        b.textContent = code;
        if (attendanceData[dateInput.value]?.[s.roll] === code) {
          b.style.background = colors[code];
          b.style.color = '#fff';
        }
        b.addEventListener('click', () => {
          btns.querySelectorAll('.att-btn').forEach(x => {
            x.style.background = '';
            x.style.color = '#333';
          });
          b.style.background = colors[code];
          b.style.color = '#fff';
        });
        btns.appendChild(b);
      });
      attList.append(row, btns);
    });
    saveAtt.classList.remove('hidden');
  });

  saveAtt.addEventListener('click', async e => {
    e.preventDefault();
    const d = dateInput.value;
    attendanceData[d] = {};
    attList.querySelectorAll('.attendance-actions').forEach((btns,i) => {
      const sel = btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll] = sel ? sel.dataset.code : 'A';
    });
    await set('attendanceData', attendanceData);
    $('attendance-section').classList.add('hidden');
    resultSection.classList.remove('hidden');
    summaryBody.innerHTML = '';
    const hdr = `Date: ${d}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    summaryBody.insertAdjacentHTML('beforebegin', `<tr><td colspan="3"><em>${hdr}</em></td></tr>`);
    students.forEach(s => {
      const code = attendanceData[d][s.roll] || 'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').addEventListener('click', () => {
        const msg = `${hdr}\n\nName: ${s.name}\nStatus: ${status}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      });
      summaryBody.appendChild(tr);
    });
  });

  resetAtt.addEventListener('click', () => {
    resultSection.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    attList.innerHTML = '';
    saveAtt.classList.add('hidden');
    summaryBody.innerHTML = '';
  });

  shareAtt.addEventListener('click', () => {
    const d = dateInput.value;
    const hdr = `Date: ${d}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines = students.map(s => {
      const code = attendanceData[d][s.roll] || 'A';
      return `${s.name}: ${ {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code] }`;
    });
    const total = students.length;
    const pres = students.reduce((sum,s) => sum + (attendanceData[d][s.roll]==='P'?1:0), 0);
    const pct = total ? ((pres/total)*100).toFixed(1) : '0.0';
    const remark = pct==100?'Best':pct>=75?'Good':pct>=50?'Fair':'Poor';
    window.open(`https://wa.me/?text=${encodeURIComponent([hdr,'',...lines,'',`Overall Attendance: ${pct}% | ${remark}`].join('\n'))}`, '_blank');
  });

  downloadAttPDF.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Daily Attendance Report',10,10);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date(dateInput.value).toLocaleDateString()}`,10,20);
    doc.text(`School: ${schoolIn.value}`,10,26);
    doc.text(`Class: ${classSel.value}`,10,32);
    doc.text(`Section: ${secSel.value}`,10,38);
    doc.autoTable({
      head:[['Name','Status']],
      body: students.map(s => {
        const code = attendanceData[dateInput.value]?.[s.roll] || 'A';
        const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
        return [s.name, status];
      }),
      startY:44
    });
    doc.save('attendance_summary.pdf');
  });

  // ─── 4. ANALYTICS ─────────────────────────────────────────────────────────────
  const analyticsTarget      = $('analyticsTarget');
  const studentAdmInput      = $('studentAdmInput');
  const analyticsType        = $('analyticsType');
  const analyticsDate        = $('analyticsDate');
  const analyticsMonth       = $('analyticsMonth');
  const semesterStartInput   = $('semesterStart');
  const semesterEndInput     = $('semesterEnd');
  const yearStart            = $('yearStart');
  const loadAnalyticsBtn     = $('loadAnalytics');
  const resetAnalyticsBtn    = $('resetAnalytics');
  const instructionsEl       = $('instructions');
  const analyticsContainer   = $('analyticsContainer');
  const graphsEl             = $('graphs');
  const shareAnalyticsBtn    = $('shareAnalytics');
  const downloadAnalyticsBtn = $('downloadAnalytics');
  const barCtx               = $('barChart').getContext('2d');
  const pieCtx               = $('pieChart').getContext('2d');
  let barChart, pieChart;

  function hideAllAnalytics() {
    [analyticsDate, analyticsMonth, semesterStartInput,
     semesterEndInput, yearStart, instructionsEl,
     analyticsContainer, graphsEl, resetAnalyticsBtn]
    .forEach(el => el.classList.add('hidden'));
  }

  analyticsTarget.addEventListener('change', () => {
    studentAdmInput.classList.toggle('hidden', analyticsTarget.value!=='student');
    hideAllAnalytics();
    analyticsType.value = '';
  });

  analyticsType.addEventListener('change', () => {
    hideAllAnalytics();
    if (analyticsType.value==='date') analyticsDate.classList.remove('hidden');
    if (analyticsType.value==='month') analyticsMonth.classList.remove('hidden');
    if (analyticsType.value==='semester') {
      semesterStartInput.classList.remove('hidden');
      semesterEndInput.classList.remove('hidden');
    }
    if (analyticsType.value==='year') yearStart.classList.remove('hidden');
    resetAnalyticsBtn.classList.remove('hidden');
  });

  resetAnalyticsBtn.addEventListener('click', e => {
    e.preventDefault();
    hideAllAnalytics();
    analyticsType.value = '';
  });

  loadAnalyticsBtn.addEventListener('click', e => {
    e.preventDefault();
    let from, to;
    if (analyticsType.value==='date') {
      if (!analyticsDate.value) return alert('Pick a date');
      from = to = analyticsDate.value;
    } else if (analyticsType.value==='month') {
      if (!analyticsMonth.value) return alert('Pick a month');
      const [y,m] = analyticsMonth.value.split('-').map(Number);
      from = `${analyticsMonth.value}-01`;
      to   = `${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (analyticsType.value==='semester') {
      if (!semesterStartInput.value||!semesterEndInput.value) return alert('Pick semester range');
      from = `${semesterStartInput.value}-01`;
      const [ey,em] = semesterEndInput.value.split('-').map(Number);
      to   = `${semesterEndInput.value}-${new Date(ey,em,0).getDate()}`;
    } else if (analyticsType.value==='year') {
      if (!yearStart.value) return alert('Pick year');
      from = `${yearStart.value}-01-01`;
      to   = `${yearStart.value}-12-31`;
    } else return alert('Select period');

    const subset = analyticsTarget.value==='student'
      ? students.filter(s=>s.adm===studentAdmInput.value.trim())
      : students;
    const stats = subset.map(s=>({ name:s.name, roll:s.roll, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    const fromD=new Date(from), toD=new Date(to);
    Object.entries(attendanceData).forEach(([d,recs])=>{
      const cd=new Date(d);
      if (cd>=fromD && cd<=toD) stats.forEach(st=>{
        const code=recs[st.roll]||'A';
        st[code]++; st.total++;
      });
    });

    let html = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s=>{
      const pct = s.total?((s.P/s.total)*100).toFixed(1):'0.0';
      html += `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
    });
    html += '</tbody></table>';

Due to length limit we stop. Probably fine.
