// app.js
window.addEventListener('DOMContentLoaded', async () => {
  const { get, set } = window.idbKeyval;
  const $ = id => document.getElementById(id);

  // ─── State ───────────────────────────────────────────────────────────────────
  let classes = [];
  let currentKey = null;      // "School|Class|Section"
  let students = [];          // students for current class
  let attendanceData = {};    // attendance map for current class

  // ─── UI Elements ─────────────────────────────────────────────────────────────
  const classSelect       = $('classSelect');
  const setupSection      = $('teacher-setup');
  const setupForm         = $('setupForm');
  const setupDisplay      = $('setupDisplay');
  const setupText         = $('setupText');

  const studentSection    = $('student-registration');
  const attendanceSection = $('attendance-section');
  const summarySection    = $('attendance-result');
  const analyticsSection  = $('analytics-section');
  const registerSection   = $('register-section');

  // ─── Helpers: load & save class list ─────────────────────────────────────────
  async function loadClasses() {
    classes = await get('classes') || [];
    classSelect.innerHTML = `<option value="__new">+ New Class</option>` +
      classes.map(key => {
        const [sch, cls, sec] = key.split('|');
        return `<option value="${key}">${sch} | ${cls}-${sec}</option>`;
      }).join('');
  }
  async function saveClasses() {
    await set('classes', classes);
  }

  // ─── Helpers: show/hide sections ─────────────────────────────────────────────
  function hideAll() {
    setupSection.classList.add('hidden');
    studentSection.classList.add('hidden');
    attendanceSection.classList.add('hidden');
    summarySection.classList.add('hidden');
    analyticsSection.classList.add('hidden');
    registerSection.classList.add('hidden');
  }
  function showAfterSetup() {
    studentSection.classList.remove('hidden');
    attendanceSection.classList.remove('hidden');
    analyticsSection.classList.remove('hidden');
    registerSection.classList.remove('hidden');
  }

  // ─── Enter new-class setup ───────────────────────────────────────────────────
  function enterNewSetup() {
    hideAll();
    setupSection.classList.remove('hidden');
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  }

  // ─── Save or update setup ────────────────────────────────────────────────────
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sch = $('schoolNameInput').value.trim();
    const cls = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!sch || !cls || !sec) return alert('Complete setup');
    const key = `${sch}|${cls}|${sec}`;
    if (!classes.includes(key)) {
      classes.push(key);
      await saveClasses();
    }
    currentKey = key;
    // initialize empty stores if first time
    if (!await get(`students-${key}`))       await set(`students-${key}`, []);
    if (!await get(`attendanceData-${key}`)) await set(`attendanceData-${key}`, {});
    // update UI
    await loadClasses();
    classSelect.value = key;
    setupText.textContent = `${sch} 🏫 | ${cls}-${sec}`;
    setupForm.classList.add('hidden');
    setupDisplay.classList.remove('hidden');
    showAfterSetup();
    await loadClassData();
  };

  // ─── Edit existing setup ─────────────────────────────────────────────────────
  $('editSetup').onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
    hideAll();
    setupSection.classList.remove('hidden');
  };

  // ─── Handle classSelect change ────────────────────────────────────────────────
  classSelect.onchange = async () => {
    if (classSelect.value === '__new') {
      enterNewSetup();
    } else {
      currentKey = classSelect.value;
      await loadClassData();
    }
  };

  // ─── Load data & UI for currentKey ───────────────────────────────────────────
  async function loadClassData() {
    hideAll();
    setupSection.classList.remove('hidden');
    // populate setup display
    const [sch, cls, sec] = currentKey.split('|');
    $('schoolNameInput').value       = sch;
    $('teacherClassSelect').value    = cls;
    $('teacherSectionSelect').value  = sec;
    setupText.textContent            = `${sch} 🏫 | ${cls}-${sec}`;
    setupForm.classList.add('hidden');
    setupDisplay.classList.remove('hidden');
    // load students & attendance
    students = await get(`students-${currentKey}`) || [];
    attendanceData = await get(`attendanceData-${currentKey}`) || {};
    renderStudents();
    showAfterSetup();
  }

  // ─── STUDENT REGISTRATION ────────────────────────────────────────────────────
  const studentsBody   = $('studentsBody');
  const selectAll      = $('selectAllStudents');
  const editSelBtn     = $('editSelected');
  const deleteSelBtn   = $('deleteSelected');
  const saveRegBtn     = $('saveRegistration');
  const shareRegBtn    = $('shareRegistration');
  const editRegBtn     = $('editRegistration');
  const downloadRegBtn = $('downloadRegistrationPDF');

  async function saveStudents() {
    await set(`students-${currentKey}`, students);
  }

  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${saveRegBtn.disabled?'disabled':''}></td>`+
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>`+
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>`+
        `<td>${saveRegBtn.disabled?'<button class="share-one">Share</button>':''}</td>`;
      if (saveRegBtn.disabled) {
        tr.querySelector('.share-one').onclick = () => {
          const msg = `${setupText.textContent}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindStudentSelection();
  }

  function bindStudentSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x=>x.checked);
        editSelBtn.disabled = deleteSelBtn.disabled = !any;
      };
    });
    selectAll.disabled = saveRegBtn.disabled;
    selectAll.onchange = () => {
      boxes.forEach(cb => {
        if (!saveRegBtn.disabled) {
          cb.checked = selectAll.checked;
          cb.dispatchEvent(new Event('change'));
        }
      });
    };
  }

  $('addStudent').onclick = async () => {
    const name   = $('studentName').value.trim();
    const adm    = $('admissionNo').value.trim();
    const parent = $('parentName').value.trim();
    const contact= $('parentContact').value.trim();
    const occ    = $('parentOccupation').value.trim();
    const addr   = $('parentAddress').value.trim();
    if (!name||!adm||!parent||!contact||!occ||!addr) return alert('All fields required');
    if (!/^\d+$/.test(adm)) return alert('Adm# must be numeric');
    if (students.some(s=>s.adm===adm)) return alert('Duplicate Adm#');
    if (!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits');
    students.push({ name, adm, parent, contact, occupation: occ, address: addr, roll: Date.now() });
    await saveStudents();
    renderStudents();
    ['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress']
      .forEach(id=>$(id).value='');
  };

  editSelBtn.onclick = () => {
    const inline = editSelBtn.textContent === 'Edit Selected';
    if (inline) {
      editSelBtn.textContent = 'Done Editing';
      document.querySelectorAll('.sel:checked').forEach(cb => {
        cb.closest('tr').querySelectorAll('td').forEach((td,ci)=>{
          if (ci>=1&&ci<=6) {
            td.contentEditable = 'true';
            td.classList.add('editing');
            td.onblur = async () => {
              const tr = td.closest('tr'), idx = +tr.querySelector('.sel').dataset.index;
              const val = td.textContent.trim(), keys = ['name','adm','parent','contact','occupation','address'];
              if (ci===2 && (!/^\d+$/.test(val)||students.some((s,i)=>s.adm===val&&i!==idx))) {
                alert('Invalid Adm#'); renderStudents(); return;
              }
              students[idx][keys[ci-1]] = val;
              await saveStudents();
            };
          }
        });
      });
    } else {
      editSelBtn.textContent = 'Edit Selected';
      document.querySelectorAll('td.editing').forEach(td=>{
        td.contentEditable = 'false';
        td.classList.remove('editing');
        td.onblur = null;
      });
    }
  };

  deleteSelBtn.onclick = async () => {
    if (!confirm('Delete selected?')) return;
    Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb=>+cb.dataset.index)
      .sort((a,b)=>b-a)
      .forEach(i=>students.splice(i,1));
    await saveStudents();
    renderStudents();
  };

  saveRegBtn.onclick = () => {
    saveRegBtn.disabled = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegBtn.classList.remove('hidden');
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  editRegBtn.onclick = () => {
    saveRegBtn.disabled = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegBtn.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick = () => {
    const hdr = setupText.textContent;
    const lines = students.map(s=>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`, '_blank');
  };

  downloadRegBtn.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Student Registration',10,10);
    doc.setFontSize(12); doc.text(setupText.textContent,10,20);
    doc.autoTable({
      head:[['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY:30
    });
    doc.save('student_registration.pdf');
  };

  // ─── ATTENDANCE MARKING ───────────────────────────────────────────────────────
  const dateInput          = $('dateInput');
  const loadAttendanceBtn  = $('loadAttendance');
  const attendanceList     = $('attendanceList');
  const saveAttendanceBtn  = $('saveAttendance');
  const resetAttendanceBtn = $('resetAttendance');
  const shareAttendanceBtn = $('shareAttendanceSummary');
  const downloadAttendanceBtn = $('downloadAttendancePDF');
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  loadAttendanceBtn.onclick = () => {
    if (!dateInput.value) return alert('Pick a date');
    attendanceList.innerHTML = '';
    students.forEach(s => {
      const row = document.createElement('div');
      row.className = 'attendance-item';
      row.textContent = s.name;
      const btns = document.createElement('div');
      btns.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button');
        b.className = 'att-btn';
        b.textContent = code;
        b.dataset.code = code;
        if (attendanceData[dateInput.value]?.[s.roll] === code) {
          b.style.background = colors[code];
          b.style.color = '#fff';
        }
        b.onclick = () => {
          btns.querySelectorAll('.att-btn').forEach(x=>{ x.style.background=''; x.style.color='#333'; });
          b.style.background = colors[code];
          b.style.color = '#fff';
        };
        btns.appendChild(b);
      });
      attendanceList.append(row, btns);
    });
    saveAttendanceBtn.classList.remove('hidden');
  };

  saveAttendanceBtn.onclick = async () => {
    const d = dateInput.value;
    attendanceData[d] = {};
    attendanceList.querySelectorAll('.attendance-actions').forEach((btns,i)=>{
      const sel = btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll] = sel ? sel.dataset.code : 'A';
    });
    await set(`attendanceData-${currentKey}`, attendanceData);
    attendanceSection.classList.add('hidden');
    summarySection.classList.remove('hidden');
    renderSummary(d);
  };

  resetAttendanceBtn.onclick = () => {
    summarySection.classList.add('hidden');
    attendanceSection.classList.remove('hidden');
    attendanceList.innerHTML = '';
    saveAttendanceBtn.classList.add('hidden');
  };

  function renderSummary(date) {
    const tbody = $('summaryBody');
    tbody.innerHTML = '';
    const hdrRow = document.createElement('tr');
    hdrRow.innerHTML = `<td colspan="3"><em>Date: ${date} | ${setupText.textContent}</em></td>`;
    tbody.appendChild(hdrRow);
    students.forEach(s => {
      const code = attendanceData[date][s.roll] || 'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick = () => {
        const msg = `Date: ${date}\n${setupText.textContent}\n\nName: ${s.name}\nStatus: ${status}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      };
      tbody.appendChild(tr);
    });
  }

  shareAttendanceBtn.onclick = () => {
    const date = dateInput.value;
    const hdr  = `Date: ${date} | ${setupText.textContent}`;
    const lines = students.map(s =>
      `${s.name}: ${ {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[attendanceData[date][s.roll]||'A'] }`
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines.join('\n'))}`, '_blank');
  };

  downloadAttendanceBtn.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const date = dateInput.value;
    doc.setFontSize(16); doc.text('Daily Attendance Report',10,10);
    doc.setFontSize(12);
    doc.text(`Date: ${date}`,10,20);
    doc.text(setupText.textContent,10,30);
    doc.autoTable({
      head:[['Name','Status']],
      body: students.map(s=>[
        s.name,
        {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[attendanceData[date][s.roll]||'A']
      ]),
      startY:40
    });
    doc.save('attendance_summary.pdf');
  };

  // ─── ANALYTICS SECTION ────────────────────────────────────────────────────────
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
     analyticsContainer, graphsEl, resetAnalyticsBtn].forEach(el => el.classList.add('hidden'));
  }

  analyticsTarget.onchange = () => {
    studentAdmInput.classList.toggle('hidden', analyticsTarget.value!=='student');
    hideAllAnalytics();
    analyticsType.value = '';
  };

  analyticsType.onchange = () => {
    hideAllAnalytics();
    if (analyticsType.value==='date') analyticsDate.classList.remove('hidden');
    if (analyticsType.value==='month') analyticsMonth.classList.remove('hidden');
    if (analyticsType.value==='semester') {
      semesterStartInput.classList.remove('hidden');
      semesterEndInput.classList.remove('hidden');
    }
    if (analyticsType.value==='year') yearStart.classList.remove('hidden');
    resetAnalyticsBtn.classList.remove('hidden');
  };

  resetAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    hideAllAnalytics();
    analyticsType.value = '';
  };

  loadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
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
    } else {
      return alert('Select period');
    }

    // build stats
    const stats = (analyticsTarget.value==='student'
      ? [students.find(s=>s.adm===studentAdmInput.value.trim())]
      : students
    ).map(s=>({ name:s.name, roll:s.roll, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));

    const fromDate = new Date(from), toDate = new Date(to);
    Object.entries(attendanceData).forEach(([d,recs])=>{
      const cd = new Date(d);
      if (cd>=fromDate && cd<=toDate) {
        stats.forEach(st=>{
          const code = recs[st.roll]||'A';
          st[code]++; st.total++;
        });
      }
    });

    // render table
    let html = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s=>{
      const pct = s.total?((s.P/s.total)*100).toFixed(1):'0.0';
      html += `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
    });
    html += '</tbody></table>';
    analyticsContainer.innerHTML = html;
    analyticsContainer.classList.remove('hidden');

    // instructions
    instructionsEl.textContent = analyticsTarget.value==='student'
      ? `Admission#: ${studentAdmInput.value.trim()} | ${from} to ${to}`
      : `Report: ${from} to ${to}`;
    instructionsEl.classList.remove('hidden');

    // bar chart
    const labels = stats.map(s=>s.name);
    const dataPct = stats.map(s=>s.total?(s.P/s.total)*100:0);
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx,{ type:'bar', data:{ labels, datasets:[{ label:'% Present', data:dataPct }]}, options:{ responsive:true, scales:{ y:{ beginAtZero:true, max:100 }}}});

    // pie chart
    const agg = stats.reduce((a,s)=>{
      ['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);
      return a;
    },{P:0,A:0,Lt:0,HD:0,L:0});
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx,{ type:'pie', data:{ labels:['Present','Absent','Late','Half Day','Leave'], datasets:[{ data:Object.values(agg) }]}, options:{ responsive:true }});

    graphsEl.classList.remove('hidden');
  };

  shareAnalyticsBtn.onclick = () => {
    const period = instructionsEl.textContent.split('|')[1].trim();
    const hdr = `Period: ${period} | ${setupText.textContent}`;
    const rows = Array.from(analyticsContainer.querySelectorAll('tbody tr')).map(r=>{
      const tds = r.querySelectorAll('td');
      return `${tds[0].textContent} P:${tds[1].textContent} A:${tds[2].textContent} Lt:${tds[3].textContent} HD:${tds[4].textContent} L:${tds[5].textContent} Total:${tds[6].textContent} %:${tds[7].textContent}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+rows.join('\n'))}`, '_blank');
  };

  downloadAnalyticsBtn.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Attendance Analytics',10,10);
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`,10,20);
    const period = instructionsEl.textContent.split('|')[1].trim();
    doc.text(`Period: ${period}`,10,26);
    doc.text(setupText.textContent,10,32);
    doc.autoTable({
      head:[['Name','P','A','Lt','HD','L','Total','%']],
      body:Array.from(analyticsContainer.querySelectorAll('tbody tr')).map(r=>
        Array.from(r.querySelectorAll('td')).map(td=>td.textContent)
      ),
      startY:40
    });
    doc.save('attendance_analytics.pdf');
  };

  // ─── ATTENDANCE REGISTER ─────────────────────────────────────────────────────
  const registerMonthIn     = $('registerMonth');
  const loadRegisterBtn     = $('loadRegister');
  const changeRegisterBtn   = $('changeRegister');
  const registerTableWrapper= $('registerTableWrapper');
  const registerBody        = $('registerBody');
  const registerSummaryBody = $('registerSummaryBody');

  function generateRegisterHeader(days) {
    const headerRow = document.querySelector('#registerTable thead tr');
    headerRow.innerHTML = `<th>Sr#</th><th>Adm#</th><th>Name</th>`;
    for (let d = 1; d <= days; d++) {
      const th = document.createElement('th'); th.textContent = d;
      headerRow.appendChild(th);
    }
  }

  loadRegisterBtn.onclick = () => {
    if (!registerMonthIn.value) return alert('Select month');
    const [y,m] = registerMonthIn.value.split('-').map(Number);
    const daysInMonth = new Date(y,m,0).getDate();
    generateRegisterHeader(daysInMonth);
    registerBody.innerHTML = '';
    registerSummaryBody.innerHTML = '';

    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1; d<=daysInMonth; d++) {
        const dateStr = `${registerMonthIn.value}-${String(d).padStart(2,'0')}`;
        const code = attendanceData[dateStr]?.[s.roll] || 'A';
        const td = document.createElement('td');
        td.textContent = code;
        td.style.background = colors[code];
        td.style.color = '#fff';
        tr.appendChild(td);
      }
      registerBody.appendChild(tr);
    });

    students.forEach(s => {
      const st={P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for (let d=1; d<=daysInMonth; d++){
        const dateStr = `${registerMonthIn.value}-${String(d).padStart(2,'0')}`;
        const code = attendanceData[dateStr]?.[s.roll] || 'A';
        st[code]++; st.total++;
      }
      const pct = st.total ? ((st.P/st.total)*100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${pct}</td>`;
      registerSummaryBody.appendChild(tr);
    });

    registerTableWrapper.classList.remove('hidden');
    registerSection.classList.remove('hidden');
    loadRegisterBtn.classList.add('hidden');
    changeRegisterBtn.classList.remove('hidden');
  };

  changeRegisterBtn.onclick = () => {
    registerTableWrapper.classList.add('hidden');
    registerSection.classList.add('hidden');
    loadRegisterBtn.classList.remove('hidden');
    changeRegisterBtn.classList.add('hidden');
  };

  $('shareRegister').onclick = () => {
    const hdr = `Register for ${registerMonthIn.value} | ${setupText.textContent}`;
    const lines = Array.from(registerSummaryBody.querySelectorAll('tr')).map(r => {
      const tds = r.querySelectorAll('td');
      return `${tds[0].textContent}: P:${tds[1].textContent}, A:${tds[2].textContent}, Lt:${tds[3].textContent}, HD:${tds[4].textContent}, L:${tds[5].textContent}, %:${tds[6].textContent}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines.join('\n'))}`, '_blank');
  };

  $('downloadRegisterPDF').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    doc.setFontSize(16); doc.text('Monthly Attendance Register',10,10);
    doc.setFontSize(12);
    doc.text(`Month: ${registerMonthIn.value}`,10,20);
    doc.text(setupText.textContent,10,30);
    doc.autoTable({
      html: '#registerTable',
      startY:40,
      styles:{ fontSize:6 },
      columnStyles:{ 0:{cellWidth:10},1:{cellWidth:15},2:{cellWidth:30} }
    });
    doc.save('attendance_register.pdf');
  };

  // ─── SERVICE WORKER ───────────────────────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(r=>console.log('SW registered',r.scope))
      .catch(e=>console.error('SW failed',e));
  }

  // ─── Initialization ─────────────────────────────────────────────────────────
  await loadClasses();
  if (classes.length === 0) {
    classSelect.value = '__new';
    enterNewSetup();
  } else {
    classSelect.value = classes[0];
    currentKey = classes[0];
    await loadClassData();
  }
});
