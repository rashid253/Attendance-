// app.js
window.addEventListener('DOMContentLoaded', async () => {
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);

  // --- STORAGE INIT ---
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};

  const saveStudents = async () => await set('students', students);
  const saveAttendanceData = async () => await set('attendanceData', attendanceData);

  // --- ADM# GENERATOR (school-wide) ---
  const getLastAdmNo  = async () => (await get('lastAdmissionNo')) || 0;
  const setLastAdmNo  = async n => await set('lastAdmissionNo', n);
  const generateAdmNo = async () => {
    const last = await getLastAdmNo();
    const next = last + 1;
    await setLastAdmNo(next);
    return String(next).padStart(4, '0'); // “0001”, “0002”…
  };

  // --- CLASS/SECTION FILTERS ---
  const getCurrentClassSection = () => ({
    cls: $('teacherClassSelect').value,
    sec: $('teacherSectionSelect').value
  });
  const filteredStudents = () => {
    const { cls, sec } = getCurrentClassSection();
    return students.filter(s => s.cls === cls && s.sec === sec);
  };

  // --- ANIMATED COUNTERS ---
  const animateCounters = () => {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target / 100);
      const update = () => {
        count += step;
        if (count < target) {
          span.textContent = Math.ceil(count);
          requestAnimationFrame(update);
        } else {
          span.textContent = target;
        }
      };
      requestAnimationFrame(update);
    });
  };
  const updateTotals = () => {
    const totalSchool  = students.length;
    const totalClass   = students.filter(s => s.cls === getCurrentClassSection().cls).length;
    const totalSection = filteredStudents().length;
    [
      { id: 'sectionCount', val: totalSection },
      { id: 'classCount',   val: totalClass   },
      { id: 'schoolCount',  val: totalSchool  }
    ].forEach(o => {
      const el = $(o.id);
      el.dataset.target = o.val;
    });
    animateCounters();
  };

  // --- DOM ELEMENTS ---
  const schoolInput    = $('schoolNameInput');
  const classSelect    = $('teacherClassSelect');
  const sectionSelect  = $('teacherSectionSelect');
  const btnSaveSetup   = $('saveSetup');
  const setupForm      = $('setupForm');
  const setupDisplay   = $('setupDisplay');
  const setupText      = $('setupText');
  const btnEditSetup   = $('editSetup');

  const nameInput      = $('studentName');
  const parentInput    = $('parentName');
  const contactInput   = $('parentContact');
  const occInput       = $('parentOccupation');
  const addrInput      = $('parentAddress');
  const btnAddStudent  = $('addStudent');
  const tbodyStudents  = $('studentsBody');
  const chkAllStudents = $('selectAllStudents');
  const btnEditSel     = $('editSelected');
  const btnDeleteSel   = $('deleteSelected');
  const btnSaveReg     = $('saveRegistration');
  const btnShareReg    = $('shareRegistration');
  const btnEditReg     = $('editRegistration');
  const btnDownloadReg = $('downloadRegistrationPDF');

  const dateInput      = $('dateInput');
  const btnLoadAtt     = $('loadAttendance');
  const divAttList     = $('attendanceList');
  const btnSaveAtt     = $('saveAttendance');
  const sectionResult  = $('attendance-result');
  const tbodySummary   = $('summaryBody');
  const btnResetAtt    = $('resetAttendance');
  const btnShareAtt    = $('shareAttendanceSummary');
  const btnDownloadAtt = $('downloadAttendancePDF');

  const selectAnalyticsTarget = $('analyticsTarget');
  const admAnalyticsInput     = $('studentAdmInput');
  const selectAnalyticsType   = $('analyticsType');
  const inputAnalyticsDate    = $('analyticsDate');
  const inputAnalyticsMonth   = $('analyticsMonth');
  const inputSemesterStart    = $('semesterStart');
  const inputSemesterEnd      = $('semesterEnd');
  const inputAnalyticsYear    = $('yearStart');
  const btnLoadAnalytics      = $('loadAnalytics');
  const btnResetAnalytics     = $('resetAnalytics');
  const divInstructions       = $('instructions');
  const divAnalyticsTable     = $('analyticsContainer');
  const divGraphs             = $('graphs');
  const btnShareAnalytics     = $('shareAnalytics');
  const btnDownloadAnalytics  = $('downloadAnalytics');
  let chartBar, chartPie;
  const ctxBar                = $('barChart').getContext('2d');
  const ctxPie                = $('pieChart').getContext('2d');

  const monthInput       = $('registerMonth');
  const btnLoadReg       = $('loadRegister');
  const btnChangeReg     = $('changeRegister');
  const divRegTable      = $('registerTableWrapper');
  const tbodyReg         = $('registerBody');
  const divRegSummary    = $('registerSummarySection');
  const tbodyRegSum      = $('registerSummaryBody');
  const btnShareReg2     = $('shareRegister');
  const btnDownloadReg2  = $('downloadRegisterPDF');
  const headerRegRowEl   = document.querySelector('#registerTable thead tr');

  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // --- STATE FLAGS ---
  let registrationSaved = false;
  let inlineEditing    = false;

  // --- ROW SELECTION BINDING ---
  const bindRowSelection = () => {
    const boxes = Array.from(tbodyStudents.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        btnEditSel.disabled = btnDeleteSel.disabled = !any;
      };
    });
    chkAllStudents.disabled = registrationSaved;
    chkAllStudents.onchange = () => boxes.forEach(cb => {
      cb.checked = chkAllStudents.checked;
      cb.dispatchEvent(new Event('change'));
    });
  };

  // --- RENDER STUDENTS ---
  const renderStudents = () => {
    const list = filteredStudents();
    tbodyStudents.innerHTML = '';
    list.forEach((st, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" data-index="${idx}" ${registrationSaved?'disabled':''}></td>
        <td>${idx+1}</td>
        <td>${st.name}</td><td>${st.adm}</td><td>${st.parent}</td>
        <td>${st.contact}</td><td>${st.occupation}</td><td>${st.address}</td>
        <td>${registrationSaved?'<button class="share-one">Share</button>':''}</td>
      `;
      if (registrationSaved) {
        tr.querySelector('.share-one').onclick = () => {
          const hdr = `*Attendance Report*\\nSchool: ${schoolInput.value}\\nClass: ${classSelect.value}\\nSection: ${sectionSelect.value}`;
          const msg = [
            hdr,
            `Name: ${st.name}`,
            `Adm#: ${st.adm}`,
            `Parent: ${st.parent}`,
            `Contact: ${st.contact}`,
            `Occupation: ${st.occupation}`,
            `Address: ${st.address}`
          ].join('\\n');
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      tbodyStudents.appendChild(tr);
    });
    bindRowSelection();
    updateTotals();
  };

  // --- SETUP ---
  const loadSetup = async () => {
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
    }
  };
  btnSaveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolInput.value || !classSelect.value || !sectionSelect.value) {
      return alert('Complete setup');
    }
    await set('schoolName', schoolInput.value);
    await set('teacherClass', classSelect.value);
    await set('teacherSection', sectionSelect.value);
    await set('students', students);
    await loadSetup();
  };
  btnEditSetup.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };
  await loadSetup();

  // --- ADD STUDENT ---
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
      name, adm, parent, contact: cont, occupation: occ, address: addr,
      roll: Date.now(),
      cls: classSelect.value, sec: sectionSelect.value
    });
    await saveStudents();
    renderStudents();
    [nameInput, parentInput, contactInput, occInput, addrInput].forEach(i => i.value = '');
  };

  // --- INLINE EDIT ---
  const handleInlineBlur = e => {
    const td   = e.target;
    const tr   = td.closest('tr');
    const idx  = +tr.querySelector('.sel').dataset.index;
    const keys = ['name','adm','parent','contact','occupation','address'];
    const ci   = Array.from(tr.children).indexOf(td);
    const val  = td.textContent.trim();
    const stu  = filteredStudents()[idx];
    if (ci===2 && !/^\d+$/.test(val)) { alert('Adm# numeric'); renderStudents(); return; }
    if (ci===2 && students.some(s=>s.adm===val && s.roll!==stu.roll)) { alert('Duplicate Adm#'); renderStudents(); return; }
    if (ci>=1 && ci<=6) {
      stu[keys[ci-1]] = val;
      students = students.map(s=>s.roll===stu.roll?stu:s);
      saveStudents();
    }
  };

  btnEditSel.onclick = e => {
    e.preventDefault();
    const checked = Array.from(tbodyStudents.querySelectorAll('.sel:checked'));
    if (!checked.length) return;
    inlineEditing = !inlineEditing;
    btnEditSel.textContent = inlineEditing ? 'Done Editing' : 'Edit Selected';
    checked.forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td, ci) => {
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineEditing;
          td.classList.toggle('editing', inlineEditing);
          inlineEditing ? td.addEventListener('blur', handleInlineBlur)
                        : td.removeEventListener('blur', handleInlineBlur);
        }
      });
    });
  };

  btnDeleteSel.onclick = async e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    const toRemove = Array.from(tbodyStudents.querySelectorAll('.sel:checked'))
      .map(cb => filteredStudents()[+cb.dataset.index].roll);
    students = students.filter(s => !toRemove.includes(s.roll));
    await saveStudents();
    renderStudents();
  };

  btnSaveReg.onclick = e => {
    e.preventDefault();
    registrationSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id => $(id).classList.remove('hidden'));
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  btnEditReg.onclick = e => {
    e.preventDefault();
    registrationSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id => $(id).classList.add('hidden'));
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  btnShareReg.onclick = e => {
    e.preventDefault();
    const hdr = `*Attendance Report*\\nSchool: ${schoolInput.value}\\nClass: ${classSelect.value}\\nSection: ${sectionSelect.value}`;
    const lines = filteredStudents().map(s =>
      `Name: ${s.name}\\nAdm#: ${s.adm}\\nParent: ${s.parent}\\nContact: ${s.contact}\\nOccupation: ${s.occupation}\\nAddress: ${s.address}`
    ).join('\\n---\\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\\n\\n' + lines)}`, '_blank');
  };

  btnDownloadReg.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica','bold'); doc.setFontSize(16);
    doc.text('Attendance Report', 10, 10);
    doc.setFont('helvetica','normal'); doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 10, 20);
    doc.text(`School: ${schoolInput.value}`, 10, 26);
    doc.text(`Class: ${classSelect.value}`, 10, 32);
    doc.text(`Section: ${sectionSelect.value}`, 10, 38);
    doc.autoTable({
      head: [['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: filteredStudents().map(s => [s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY: 44
    });
    doc.save('student_registration.pdf');
  };

  // --- ATTENDANCE MARKING ---
  btnLoadAtt.onclick = e => {
    e.preventDefault();
    const d = dateInput.value;
    if (!d) return alert('Pick a date');
    divAttList.innerHTML = '';
    filteredStudents().forEach(s => {
      const row = document.createElement('div');
      row.className = 'attendance-item';
      row.textContent = s.name;
      const actions = document.createElement('div');
      actions.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button');
        b.type = 'button';
        b.classList.add('att-btn');
        b.textContent = code;
        b.dataset.code = code;
        if (attendanceData[d]?.[s.roll] === code) {
          b.style.background = colors[code];
          b.style.color = '#fff';
        }
        b.onclick = ev => {
          ev.preventDefault();
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
    document.querySelectorAll('.attendance-actions').forEach((actions, i) => {
      const sel = actions.querySelector('button[style*="background"]');
      attendanceData[d][filteredStudents()[i].roll] = sel?.dataset.code || 'A';
    });
    await saveAttendanceData();
    $('attendance-section').classList.add('hidden');
    sectionResult.classList.remove('hidden');
    tbodySummary.innerHTML = '';
    const hdrRow = document.createElement('tr');
    hdrRow.innerHTML = `<td colspan="3"><em>Date: ${d} | School: ${schoolInput.value} | Class: ${classSelect.value} | Section: ${sectionSelect.value}</em></td>`;
    tbodySummary.appendChild(hdrRow);
    filteredStudents().forEach(s => {
      const code = attendanceData[d][s.roll] || 'A';
      const statusMap = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' };
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${statusMap[code]}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick = () => {
        const msg = [
          `Date: ${d}`,
          `School: ${schoolInput.value}`,
          `Class: ${classSelect.value}`,
          `Section: ${sectionSelect.value}`,
          '',
          `Name: ${s.name}`,
          `Status: ${statusMap[code]}`
        ].join('\\n');
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      };
      tbodySummary.appendChild(tr);
    });
  };

  btnResetAtt.onclick = () => {
    sectionResult.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    divAttList.innerHTML = '';
    btnSaveAtt.classList.add('hidden');
  };

  btnShareAtt.onclick = () => {
    const d = dateInput.value;
    const hdr = `*Attendance Report*\\nDate: ${d}\\nSchool: ${schoolInput.value}\\nClass: ${classSelect.value}\\nSection: ${sectionSelect.value}`;
    const lines = filteredStudents().map(s => {
      const code = attendanceData[d][s.roll] || 'A';
      const statusMap = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' };
      return `${s.name}: ${statusMap[code]}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\\n\\n' + lines.join('\\n'))}`, '_blank');
  };

  btnDownloadAtt.onclick = () => {
    const d = dateInput.value;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica','bold'); doc.setFontSize(16);
    doc.text('Attendance Report', 10, 10);
    doc.setFont('helvetica','normal'); doc.setFontSize(12);
    doc.text(`Date: ${new Date(d).toLocaleDateString()}`, 10, 20);
    doc.text(`School: ${schoolInput.value}`, 10, 26);
    doc.text(`Class: ${classSelect.value}`, 10, 32);
    doc.text(`Section: ${sectionSelect.value}`, 10, 38);
    doc.autoTable({
      head: [['Name','Status']],
      body: filteredStudents().map(s => {
        const code = attendanceData[d][s.roll] || 'A';
        const statusMap = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' };
        return [s.name, statusMap[code]];
      }),
      startY: 44
    });
    doc.save('attendance_summary.pdf');
  };

  // --- ANALYTICS ---
  const hideAnalyticsInputs = () => {
    ['studentAdmInput','analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart','instructions','analyticsContainer','graphs','analyticsActions']
      .forEach(id => $(id).classList.add('hidden'));
  };
  selectAnalyticsTarget.onchange = () => {
    admAnalyticsInput.classList.toggle('hidden', selectAnalyticsTarget.value !== 'student');
    hideAnalyticsInputs();
    selectAnalyticsType.value = '';
  };
  selectAnalyticsType.onchange = () => {
    hideAnalyticsInputs();
    if (selectAnalyticsType.value === 'date')     $('analyticsDate').classList.remove('hidden');
    if (selectAnalyticsType.value === 'month')    $('analyticsMonth').classList.remove('hidden');
    if (selectAnalyticsType.value === 'semester') {$('semesterStart').classList.remove('hidden'); $('semesterEnd').classList.remove('hidden');}
    if (selectAnalyticsType.value === 'year')     $('yearStart').classList.remove('hidden');
    btnResetAnalytics.classList.remove('hidden');
  };
  btnResetAnalytics.onclick = e => { e.preventDefault(); hideAnalyticsInputs(); selectAnalyticsType.value = ''; };
  btnLoadAnalytics.onclick = e => {
    e.preventDefault();
    let from, to;
    if (selectAnalyticsType.value === 'date') {
      if (!inputAnalyticsDate.value) return alert('Pick a date');
      from = to = inputAnalyticsDate.value;
    } else if (selectAnalyticsType.value === 'month') {
      if (!inputAnalyticsMonth.value) return alert('Pick a month');
      const [y,m] = inputAnalyticsMonth.value.split('-').map(Number);
      from = `${inputAnalyticsMonth.value}-01`;
      to   = `${inputAnalyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (selectAnalyticsType.value === 'semester') {
      if (!inputSemesterStart.value || !inputSemesterEnd.value) return alert('Pick semester range');
      const [sy,sm] = inputSemesterStart.value.split('-').map(Number);
      const [ey,em] = inputSemesterEnd.value.split('-').map(Number);
      from = `${inputSemesterStart.value}-01`;
      to   = `${inputSemesterEnd.value}-${new Date(ey,em,0).getDate()}`;
    } else if (selectAnalyticsType.value === 'year') {
      if (!inputAnalyticsYear.value) return alert('Pick year');
      from = `${inputAnalyticsYear.value}-01-01`;
      to   = `${inputAnalyticsYear.value}-12-31`;
    } else {
      return alert('Select period');
    }

    const stats = filteredStudents().map(s => ({ name: s.name, roll: s.roll, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    Object.entries(attendanceData).forEach(([d, recs]) => {
      const cd = new Date(d), fD = new Date(from), tD = new Date(to);
      if (cd >= fD && cd <= tD) {
        stats.forEach(st => {
          const code = recs[st.roll] || 'A';
          st[code]++; st.total++;
        });
      }
    });

    // build table
    let html = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s => {
      const pct = s.total ? ((s.P / s.total) * 100).toFixed(1) : '0.0';
      html += `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
    });
    html += '</tbody></table>';
    divAnalyticsTable.innerHTML = html;
    divAnalyticsTable.classList.remove('hidden');

    divInstructions.textContent = selectAnalyticsTarget.value === 'student'
      ? `Adm#: ${admAnalyticsInput.value.trim()} | Report: ${from} to ${to}`
      : `Report: ${from} to ${to}`;
    divInstructions.classList.remove('hidden');

    // charts
    const labels = stats.map(s => s.name);
    const dataPct = stats.map(s => s.total ? (s.P / s.total) * 100 : 0);
    if (chartBar) chartBar.destroy();
    chartBar = new Chart(ctxBar, {
      type: 'bar',
      data: { labels, datasets: [{ label: '% Present', data: dataPct }] },
      options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
    });

    const agg = stats.reduce((a, s) => { ['P','A','Lt','HD','L'].forEach(c => a[c] += s[c]); return a; }, { P:0, A:0, Lt:0, HD:0, L:0 });
    if (chartPie) chartPie.destroy();
    chartPie = new Chart(ctxPie, {
      type: 'pie',
      data: { labels:['Present','Absent','Late','Half Day','Leave'], datasets:[{ data: Object.values(agg) }] },
      options: { responsive: true }
    });

    divGraphs.classList.remove('hidden');
    $('analyticsActions').classList.remove('hidden');
  };

  btnShareAnalytics.onclick = e => {
    e.preventDefault();
    const parts = divInstructions.textContent.split('|');
    const period = parts.pop().trim();
    const header = `*Attendance Report*\\nPeriod: ${period}\\nSchool: ${schoolInput.value}\\nClass: ${classSelect.value}\\nSection: ${sectionSelect.value}`;
    const rows = Array.from(divAnalyticsTable.querySelectorAll('tbody tr')).map(r => {
      const td = Array.from(r.querySelectorAll('td')).map(c => c.textContent);
      return `${td[0]} P:${td[1]} A:${td[2]} Lt:${td[3]} HD:${td[4]} L:${td[5]} Total:${td[6]} %:${td[7]}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\\n\\n' + rows.join('\\n'))}`, '_blank');
  };

  btnDownloadAnalytics.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica','bold'); doc.setFontSize(16);
    doc.text('Attendance Report', 10, 10);
    doc.setFont('helvetica','normal'); doc.setFontSize(12);
    const period = divInstructions.textContent.split('|').pop().trim();
    doc.text(`Period: ${period}`, 10, 20);
    doc.text(`School: ${schoolInput.value}`, 10, 26);
    doc.text(`Class: ${classSelect.value} | Section: ${sectionSelect.value}`, 10, 32);
    doc.autoTable({
      head:[['Name','P','A','Lt','HD','L','Total','%']],
      body: Array.from(divAnalyticsTable.querySelectorAll('tbody tr')).map(r =>
        Array.from(r.querySelectorAll('td')).map(c => c.textContent)
      ), startY: 38
    });
    const y = doc.lastAutoTable.finalY + 10;
    doc.addImage(chartBar.toBase64Image(), 'PNG', 10, y, 80, 60);
    doc.addImage(chartPie.toBase64Image(), 'PNG', 100, y, 80, 60);
    doc.save('attendance_analytics.pdf');
  };

  // --- ATTENDANCE REGISTER ---
  const generateRegisterHeader = days => {
    headerRegRowEl.innerHTML = '<th>Sr#</th><th>Adm#</th><th>Name</th>';
    for (let d = 1; d <= days; d++) {
      const th = document.createElement('th');
      th.textContent = d;
      headerRegRowEl.appendChild(th);
    }
  };
  btnLoadReg.onclick = e => {
    e.preventDefault();
    if (!monthInput.value) return alert('Select month');
    const [y, m] = monthInput.value.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();

    generateRegisterHeader(days);
    tbodyReg.innerHTML = '';
    tbodyRegSum.innerHTML = '';

    filteredStudents().forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d = 1; d <= days; d++) {
        const dateStr = `${monthInput.value}-${String(d).padStart(2,'0')}`;
        const code = (attendanceData[dateStr]||{})[s.roll] || 'A';
        const td = document.createElement('td');
        td.textContent = code;
        td.style.background = colors[code];
        td.style.color = '#fff';
        tr.appendChild(td);
      }
      tbodyReg.appendChild(tr);
    });

    filteredStudents().forEach(s => {
      const stat = { P:0, A:0, Lt:0, HD:0, L:0, total:0 };
      for (let d = 1; d <= days; d++) {
        const dateStr = `${monthInput.value}-${String(d).padStart(2,'0')}`;
        const code = (attendanceData[dateStr]||{})[s.roll] || 'A';
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
    const hdr = `*Attendance Report*\\nRegister for ${monthInput.value}\\nSchool: ${schoolInput.value}\\nClass: ${classSelect.value}\\nSection: ${sectionSelect.value}`;
    const lines = Array.from(tbodyRegSum.querySelectorAll('tr')).map(r => {
      const [name,p,a,lt,hd,l,pct] = Array.from(r.querySelectorAll('td')).map(td => td.textContent);
      return `${name}: P:${p}, A:${a}, Lt:${lt}, HD:${hd}, L:${l}, %:${pct}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\\n\\n' + lines.join('\\n'))}`, '_blank');
  };

  btnDownloadReg2.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    doc.setFont('helvetica','bold'); doc.setFontSize(16);
    doc.text('Attendance Report', 10, 10);
    doc.setFont('helvetica','normal'); doc.setFontSize(12);
    doc.text(`Month: ${monthInput.value}`, 10, 20);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 10, 26);
    doc.text(`School: ${schoolInput.value}`, 10, 32);
    doc.text(`Class: ${classSelect.value} | Section: ${sectionSelect.value}`, 10, 38);
    doc.autoTable({ html: '#registerTable', startY: 44, styles: { fontSize: 6 }, columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 15 }, 2: { cellWidth: 30 } } });
    doc.autoTable({ html: '#registerSummarySection table', startY: doc.lastAutoTable.finalY + 10, styles: { fontSize: 8 } });
    doc.save('attendance_register.pdf');
  };

  // --- SERVICE WORKER ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.error('SW failed:', err));
    });
  }
});
