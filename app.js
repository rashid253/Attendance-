// app.js
window.addEventListener('DOMContentLoaded', () => {
  // Shortcut to get element by ID
  const $ = id => document.getElementById(id);

  // Color mapping for attendance codes
  const colors = {
    P: 'var(--success)',
    A: 'var(--danger)',
    Lt: 'var(--warning)',
    HD: 'var(--orange)',
    L: 'var(--info)'
  };

  // 1. SETUP
  const schoolIn = $('schoolNameInput');
  const classSel = $('teacherClassSelect');
  const secSel = $('teacherSectionSelect');
  const saveSetup = $('saveSetup');
  const setupForm = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText = $('setupText');
  const editSetup = $('editSetup');

  function loadSetup() {
    const school = localStorage.getItem('schoolName');
    const cls = localStorage.getItem('teacherClass');
    const sec = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetup.addEventListener('click', e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) {
      alert('Complete setup first');
      return;
    }
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  });

  editSetup.addEventListener('click', e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  });

  loadSetup();

  // 2. STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const studentNameIn = $('studentName');
  const admissionNoIn = $('admissionNo');
  const parentNameIn = $('parentName');
  const parentContactIn = $('parentContact');
  const parentOccIn = $('parentOccupation');
  const parentAddrIn = $('parentAddress');
  const addStudentBtn = $('addStudent');
  const studentsBody = $('studentsBody');
  const selectAll = $('selectAllStudents');
  const editSelBtn = $('editSelected');
  const deleteSelBtn = $('deleteSelected');
  const saveRegBtn = $('saveRegistration');
  const shareRegBtn = $('shareRegistration');
  const editRegBtn = $('editRegistration');
  const downloadRegBtn = $('downloadRegistrationPDF');
  const studentTableWrapper = $('studentTableWrapper');
  let regSaved = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => cb.onchange = () => {
      cb.closest('tr').classList.toggle('selected', cb.checked);
      const any = boxes.some(x => x.checked);
      editSelBtn.disabled = deleteSelBtn.disabled = !any;
    });
    selectAll.disabled = regSaved;
    selectAll.onchange = () => {
      if (!regSaved) boxes.forEach(cb => { cb.checked = selectAll.checked; cb.onchange(); });
    };
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
        tr.querySelector('.share-one').onclick = e => {
          e.preventDefault();
          const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
          const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
        };
      }
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }

  addStudentBtn.addEventListener('click', e => {
    e.preventDefault();
    const name = studentNameIn.value.trim();
    const adm = admissionNoIn.value.trim();
    const parent = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occ = parentOccIn.value.trim();
    const addr = parentAddrIn.value.trim();
    if (!name || !adm || !parent || !contact || !occ || !addr) { alert('All fields are required'); return; }
    if (!/^\d+$/.test(adm)) { alert('Admission No must be numeric'); return; }
    if (students.some(s => s.adm === adm)) { alert('Admission No already exists'); return; }
    if (!/^\d{7,15}$/.test(contact)) { alert('Contact must be 7-15 digits'); return; }
    students.push({ name, adm, parent, contact, occupation: occ, address: addr, roll: Date.now() });
    saveStudents(); renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn].forEach(inp => inp.value = '');
  });

  saveRegBtn.addEventListener('click', e => {
    e.preventDefault(); regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden'); editRegBtn.classList.remove('hidden'); downloadRegBtn.classList.remove('hidden');
    studentTableWrapper.classList.add('saved'); renderStudents();
  });

  editRegBtn.addEventListener('click', e => {
    e.preventDefault(); regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden'); editRegBtn.classList.add('hidden'); downloadRegBtn.classList.add('hidden');
    studentTableWrapper.classList.remove('saved'); renderStudents();
  });

  shareRegBtn.addEventListener('click', e => {
    e.preventDefault();
    const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s => `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines)}`);
  });

  downloadRegBtn.addEventListener('click', e => {
    e.preventDefault();
    const doc = new window.jsPDF('p','pt','a4');
    doc.autoTable({ head: [['Name','Adm#','Parent','Contact','Occupation','Address']], body: students.map(s => [s.name,s.adm,s.parent,s.contact,s.occupation,s.address]), startY:40, margin:{left:40,right:40}, styles:{fontSize:10} });
    doc.save('students_registration.pdf');
  });

  renderStudents();

  // 3. MARK ATTENDANCE
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
  const dateInput = $('dateInput');
  const loadAtt = $('loadAttendance');
  const attList = $('attendanceList');
  const saveAtt = $('saveAttendance');

  loadAtt.addEventListener('click', e => {
    e.preventDefault();
    if (!dateInput.value) { alert('Select a date'); return; }
    attList.innerHTML = '';
    students.forEach(s => {
      const row = document.createElement('div'); row.className = 'attendance-item'; row.textContent = s.name;
      const btns = document.createElement('div'); btns.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button'); b.type='button'; b.className='att-btn'; b.dataset.code=code; b.textContent=code;
        if (attendanceData[dateInput.value]?.[s.roll] === code) { b.style.background=colors[code]; b.style.color='#fff'; }
        b.addEventListener('click', () => {
          btns.querySelectorAll('.att-btn').forEach(x => { x.style.background=''; x.style.color='var(--dark)'; });
          b.style.background=colors[code]; b.style.color='#fff';
        });
        btns.appendChild(b);
      });
      attList.appendChild(row); attList.appendChild(btns);
    });
    saveAtt.classList.remove('hidden');
  });

  saveAtt.addEventListener('click', e => {
    e.preventDefault();
    const d = dateInput.value;
    attendanceData[d] = {};
    document.querySelectorAll('.attendance-actions').forEach((btns, idx) => {
      const sel = btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[idx].roll] = sel ? sel.dataset.code : 'A';
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    $('attendance-section').classList.add('hidden');
    $('attendance-result').classList.remove('hidden');
  });

  $('shareAttendanceSummary').addEventListener('click', e => {
    e.preventDefault();
    const d = dateInput.value;
    const hdr = `Date: ${d}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const map = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' };
    const lines = students.map(s => `${s.name}: ${map[attendanceData[d][s.roll] || 'A']}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines.join('\n'))}`);
  });

  $('downloadAttendancePDF').addEventListener('click', e => {
    e.preventDefault();
    const doc = new window.jsPDF('p','pt','a4');
    doc.autoTable({ head: [['Name','Status']], body: students.map(s => {
      const code = attendanceData[dateInput.value]?.[s.roll] || 'A'; return [s.name, {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]];
    }), startY:40, margin:{left:40,right:40}, styles:{fontSize:10} });
    doc.save('attendance_summary.pdf');
  });

  // 4. ANALYTICS
  const analyticsTarget = $('analyticsTarget');
  const studentAdmInput = $('studentAdmInput');
  const analyticsType = $('analyticsType');
  const analyticsDate = $('analyticsDate');
  const analyticsMonth = $('analyticsMonth');
  const semesterStart = $('semesterStart');
  const semesterEnd = $('semesterEnd');
  const yearStart = $('yearStart');
  const loadAnalytics = $('loadAnalytics');
  const resetAnalytics = $('resetAnalytics');
  const instructionsEl = $('instructions');
  const analyticsContainer = $('analyticsContainer');
  const graphsEl = $('graphs');
  const analyticsActions = $('analyticsActions');
  const shareAnalyticsBtn = $('shareAnalytics');
  const downloadAnalyticsBtn = $('downloadAnalytics');
  let barChart, pieChart;

  analyticsTarget.addEventListener('change', () => {
    studentAdmInput.classList.toggle('hidden', analyticsTarget.value === 'class');
  });

  analyticsType.addEventListener('change', () => {
    // hide all period inputs
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart].forEach(el => el.classList.add('hidden'));
    if (analyticsType.value==='date') analyticsDate.classList.remove('hidden');
    if (analyticsType.value==='month') analyticsMonth.classList.remove('hidden');
    if (analyticsType.value==='semester') { semesterStart.classList.remove('hidden'); semesterEnd.classList.remove('hidden'); }
    if (analyticsType.value==='year') yearStart.classList.remove('hidden');
    resetAnalytics.classList.remove('hidden');
  });

  loadAnalytics.addEventListener('click', e => {
    e.preventDefault();
    let from, to;
    if (analyticsType.value==='date') {
      if (!analyticsDate.value) { alert('Pick date'); return; }
      from = to = analyticsDate.value;
    } else if (analyticsType.value==='month') {
      if (!analyticsMonth.value) { alert('Pick month'); return; }
      const [y,m] = analyticsMonth.value.split('-').map(Number);
      from = `${analyticsMonth.value}-01`;
      to   = `${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (analyticsType.value==='semester') {
      if (!semesterStart.value||!semesterEnd.value) { alert('Pick range'); return; }
      const [sy, sm] = semesterEnd.value.split('-').map(Number);
      from = `${semesterStart.value}-01`;
      to   = `${semesterEnd.value}-${new Date(sy,sm,0).getDate()}`;
    } else if (analyticsType.value==='year') {
      if (!yearStart.value) { alert('Pick year'); return; }
      from = `${yearStart.value}-01-01`;
      to   = `${yearStart.value}-12-31`;
    } else { alert('Select period'); return; }

    const stats = (analyticsTarget.value==='class')
      ? students.map(s=>({ name: s.name, roll: s.roll, P:0, A:0, Lt:0, HD:0, L:0, total:0 }))
      : (() => {
          const adm = studentAdmInput.value.trim();
          if (!adm) { alert('Enter Adm#'); return; }
          const stud = students.find(s=>s.adm===adm);
          if (!stud) { alert(`No student with Adm#: ${adm}`); return; }
          return [{ name: stud.name, roll: stud.roll, P:0, A:0, Lt:0, HD:0, L:0, total:0 }];
        })();

    Object.entries(attendanceData).forEach(([d, recs]) => {
      const cd = new Date(d);
      if (cd >= new Date(from) && cd <= new Date(to)) {
        stats.forEach(st => {
          const c = recs[st.roll] || 'A';
          st[c]++; st.total++;
        });
      }
    });

    // build table
    analyticsContainer.innerHTML = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>' +
      stats.map(s=>{
        const pct = s.total ? ((s.P/s.total)*100).toFixed(1) : '0.0';
        return `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
      }).join('') + '</tbody></table>';

    instructionsEl.textContent = `Report: ${from} to ${to}`;
    instructionsEl.classList.remove('hidden');
    analyticsContainer.classList.remove('hidden');
    graphsEl.classList.remove('hidden');
    analyticsActions.classList.remove('hidden');

    // draw charts
    const labels = stats.map(s=>s.name);
    const dataPct= stats.map(s=> s.total?(s.P/s.total)*100:0);
    barChart?.destroy();
    barChart = new Chart($('barChart').getContext('2d'), { type:'bar', data:{ labels, datasets:[{ label:'% Present', data: dataPct }] }, options:{ maintainAspectRatio:true } });
    const agg = stats.reduce((a,s)=>{ ['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]); return a; }, {P:0,A:0,Lt:0,HD:0,L:0});
    pieChart?.destroy();
    pieChart = new Chart($('pieChart').getContext('2d'), { type:'pie', data:{ labels:['P','A','Lt','HD','L'], datasets:[{ data: Object.values(agg) }] }, options:{ maintainAspectRatio:true, aspectRatio:1 } });
  });

  shareAnalyticsBtn.addEventListener('click', () => {
    const period = instructionsEl.textContent.replace('Report: ', '');
    const hdr = `Period: ${period}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const rows = Array.from(document.querySelectorAll('#analyticsContainer tbody tr')).map(r=>{
      const td = r.querySelectorAll('td');
      return `${td[0].textContent} P:${td[1].textContent} A:${td[2].textContent} Lt:${td[3].textContent} HD:${td[4].textContent} L:${td[5].textContent} Total:${td[6].textContent} %:${td[7].textContent}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + rows.join('\n'))}`);
  });

  downloadAnalyticsBtn.addEventListener('click', e => {
    e.preventDefault();
    const doc = new window.jsPDF('p','pt','a4');
    doc.setFontSize(14);
    doc.text(localStorage.getItem('schoolName'), 40, 30);
    doc.setFontSize(12);
    doc.text(`Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`, 40, 45);
    doc.text(instructionsEl.textContent, 40, 60);
    doc.autoTable({ head: [['Name','P','A','Lt','HD','L','Total','%']], body: Array.from(document.querySelectorAll('#analyticsContainer tbody tr')).map(r=>Array.from(r.cells).map(td=>td.textContent)), startY:75, margin:{left:40,right:40}, styles:{fontSize:8} });
    const y = doc.lastAutoTable.finalY + 10, w = 120, h = 80;
    doc.addImage(barChart.toBase64Image(), 'PNG', 40, y, w, h);
    doc.addImage(pieChart.toBase64Image(), 'PNG', 40+w+20, y, w, h);
    doc.save('analytics_report.pdf');
  });

  // 5. ATTENDANCE REGISTER
  const registerMonth = $('registerMonth');
  const loadRegister = $('loadRegister');
  const changeRegister = $('changeRegister');
  const registerTableWrapper = $('registerTableWrapper');
  const registerBody = $('registerBody');
  const registerSummarySection = $('registerSummarySection');
  const registerSummaryBody = $('registerSummaryBody');
  const shareRegisterBtn = $('shareRegister');
  const downloadRegisterBtn = $('downloadRegisterPDF');

  // append day headers once
  const headerRow = $('registerTable').querySelector('thead tr');
  if (headerRow.children.length === 3) {
    for (let d = 1; d <= 31; d++) {
      const th = document.createElement('th'); th.textContent = d; headerRow.appendChild(th);
    }
  }

  loadRegister.addEventListener('click', e => {
    e.preventDefault();
    if (!registerMonth.value) { alert('Select month'); return; }
    const data = JSON.parse(localStorage.getItem('attendanceData') || '{}');
    const [y,m] = registerMonth.value.split('-').map(Number);
    const dim = new Date(y,m,0).getDate();

    registerBody.innerHTML = '';
    registerSummaryBody.innerHTML = '';

    // daily register rows
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let day=1; day<=dim; day++) {
        const key = `${registerMonth.value}-${String(day).padStart(2,'0')}`;
        const code = (data[key]||{})[s.roll]||'A';
        const td = document.createElement('td'); td.textContent = code; td.style.background = colors[code]; td.style.color = '#fff'; tr.appendChild(td);
      }
      registerBody.appendChild(tr);
    });

    // summary rows
    const stats = students.map(s=>({ name:s.name, roll:s.roll, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    stats.forEach(st=>{
      for(let day=1; day<=dim; day++){
        const key = `${registerMonth.value}-${String(day).padStart(2,'0')}`;
        const code = (data[key]||{})[st.roll]||'A'; st[code]++; st.total++;
      }
      const pct = st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${pct}</td>`;
      registerSummaryBody.appendChild(tr);
    });

    registerTableWrapper.classList.remove('hidden');
    registerSummarySection.classList.remove('hidden');
    loadRegister.classList.add('hidden');
    changeRegister.classList.remove('hidden');
  });

  changeRegister.addEventListener('click', e => {
    e.preventDefault();
    registerTableWrapper.classList.add('hidden');
    registerSummarySection.classList.add('hidden');
    loadRegister.classList.remove('hidden');
    changeRegister.classList.add('hidden');
  });

  shareRegisterBtn.addEventListener('click', () => {
    const hdr = `Register for ${registerMonth.value}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = Array.from(registerSummaryBody.querySelectorAll('tr')).map(r => {
      const td = r.querySelectorAll('td');
      return `${td[0].textContent}: P:${td[1].textContent}, A:${td[2].textContent}, Lt:${td[3].textContent}, HD:${td[4].textContent}, L:${td[5].textContent}, %:${td[6].textContent}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines.join('\n'))}`);
  });

  downloadRegisterBtn.addEventListener('click', () => {
    const doc = new window.jsPDF('l','pt','a4');
    doc.text(localStorage.getItem('schoolName'), 40, 30);
    doc.text(`Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`, 40, 45);
    doc.text(`Register for ${registerMonth.value}`, 40, 60);
    doc.autoTable({ html:'#registerTable', startY:75, styles:{fontSize:8} });
    doc.autoTable({ html:'#registerSummarySection table', startY: doc.lastAutoTable.finalY+10, styles:{fontSize:8} });
    doc.save('attendance_register.pdf');
  });
});
