// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // idbKeyval is now available globally from the IIFE build
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);
  const colors = { P: '#4CAF50', A: '#f44336', Lt: '#FFEB3B', HD: '#FF9800', L: '#03a9f4' };

  // 1. SETUP
  const schoolIn       = $('schoolNameInput');
  const classSel       = $('teacherClassSelect');
  const secSel         = $('teacherSectionSelect');
  const saveSetup      = $('saveSetup');
  const setupForm      = $('setupForm');
  const setupDisplay   = $('setupDisplay');
  const setupText      = $('setupText');
  const editSetup      = $('editSetup');

  async function loadSetup() {
    const school = await get('schoolName');
    const cls    = await get('teacherClass');
    const sec    = await get('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value   = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) {
      return alert('Complete setup');
    }
    await set('schoolName', schoolIn.value);
    await set('teacherClass', classSel.value);
    await set('teacherSection', secSel.value);
    await loadSetup();
  };

  editSetup.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };

  await loadSetup();

  // 2. STUDENT REGISTRATION
  let students = await get('students') || [];
  const studentNameIn    = $('studentName');
  const admissionNoIn    = $('admissionNo');
  const parentNameIn     = $('parentName');
  const parentContactIn  = $('parentContact');
  const parentOccIn      = $('parentOccupation');
  const parentAddrIn     = $('parentAddress');
  const addStudentBtn    = $('addStudent');
  const studentsBody     = $('studentsBody');
  const selectAll        = $('selectAllStudents');
  const editSelBtn       = $('editSelected');
  const deleteSelBtn     = $('deleteSelected');
  const saveRegBtn       = $('saveRegistration');
  const shareRegBtn      = $('shareRegistration');
  const editRegBtn       = $('editRegistration');
  const downloadRegBtn   = $('downloadRegistrationPDF');
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
        `${regSaved ? '<td><button class="share-one">Share</button></td>' : ''}`;
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

  addStudentBtn.onclick = async ev => {
    ev.preventDefault();
    const name    = studentNameIn.value.trim();
    const adm     = admissionNoIn.value.trim();
    const parent  = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occ     = parentOccIn.value.trim();
    const addr    = parentAddrIn.value.trim();
    if (!name || !adm || !parent || !contact || !occ || !addr) {
      return alert('All fields required');
    }
    if (!/^\d+$/.test(adm)) {
      return alert('Adm# must be numeric');
    }
    if (students.some(s => s.adm === adm)) {
      return alert(`Admission# ${adm} already exists`);
    }
    if (!/^\d{7,15}$/.test(contact)) {
      return alert('Contact must be 7–15 digits');
    }
    students.push({ name, adm, parent, contact, occupation: occ, address: addr, roll: Date.now() });
    await saveStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn].forEach(i => i.value = '');
  };

  editSelBtn.onclick = () => {/* inline editing code omitted for brevity */};
  deleteSelBtn.onclick = () => {/* delete code omitted */};
  saveRegBtn.onclick = () => {/* save registration omitted */};
  shareRegBtn.onclick = () => {/* share registration omitted */};
  editRegBtn.onclick = () => {/* edit registration omitted */};
  downloadRegBtn.onclick = () => {/* download PDF omitted */};

  renderStudents();

  // 3. ATTENDANCE MARKING
  let attendanceData = await get('attendanceData') || {};
  const dateInput      = $('dateInput');
  const loadAtt        = $('loadAttendance');
  const attList        = $('attendanceList');
  const saveAtt        = $('saveAttendance');
  const resultSection  = $('attendance-result');
  const summaryBody    = $('summaryBody');
  const resetAtt       = $('resetAttendance');
  const shareAtt       = $('shareAttendanceSummary');
  const downloadAttPDF = $('downloadAttendancePDF');

  loadAtt.onclick = () => {/* load attendance code omitted */};
  saveAtt.onclick = () => {/* save attendance code omitted */};
  resetAtt.onclick = () => {/* reset attendance code omitted */};
  shareAtt.onclick = () => {/* share attendance code omitted */};
  downloadAttPDF.onclick = () => {/* download attendance PDF omitted */};

  // 4. ANALYTICS
  const analyticsTarget    = $('analyticsTarget');
  const studentAdmInput    = $('analyticsStudentInput');
  const analyticsType      = $('analyticsType');
  const analyticsDate      = $('analyticsDate');
  const analyticsMonth     = $('analyticsMonth');
  const semesterStart      = $('semesterStart');
  const semesterEnd        = $('semesterEnd');
  const yearStart          = $('yearStart');
  const loadAnalyticsBtn   = $('loadAnalytics');
  const resetAnalyticsBtn  = $('resetAnalytics');
  const instructionsEl     = $('instructions');
  const analyticsContainer = $('analyticsContainer');
  const graphsEl           = $('graphs');
  const analyticsActions   = $('analyticsActions');
  const shareAnalyticsBtn  = $('shareAnalytics');
  const downloadAnalyticsBtn = $('downloadAnalytics');
  const barCtx = $('barChart').getContext('2d');
  const pieCtx = $('pieChart').getContext('2d');
  let barChart, pieChart;

  function hideAnalyticsControls() {
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart,
     instructionsEl, analyticsContainer, graphsEl, analyticsActions, resetAnalyticsBtn]
      .forEach(el => el.classList.add('hidden'));
  }

  analyticsTarget.onchange = () => {
    studentAdmInput.classList.toggle('hidden', analyticsTarget.value !== 'student');
    hideAnalyticsControls();
    analyticsType.value = '';
  };

  analyticsType.onchange = () => {
    hideAnalyticsControls();
    if (analyticsType.value === 'date') analyticsDate.classList.remove('hidden');
    if (analyticsType.value === 'month') analyticsMonth.classList.remove('hidden');
    if (analyticsType.value === 'semester') {
      semesterStart.classList.remove('hidden');
      semesterEnd.classList.remove('hidden');
    }
    if (analyticsType.value === 'year') yearStart.classList.remove('hidden');
    resetAnalyticsBtn.classList.remove('hidden');
  };

  resetAnalyticsBtn.onclick = e => {
    e.preventDefault();
    hideAnalyticsControls();
    analyticsType.value = '';
  };

  loadAnalyticsBtn.onclick = e => {
    e.preventDefault();
    let from, to;
    if (analyticsType.value === 'date') {
      from = to = analyticsDate.value;
    } else if (analyticsType.value === 'month') {
      const [y,m] = analyticsMonth.value.split('-').map(Number);
      from = `${analyticsMonth.value}-01`;
      to   = `${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (analyticsType.value === 'semester') {
      const [sy,sm] = semesterStart.value.split('-').map(Number);
      const [ey,em] = semesterEnd.value.split('-').map(Number);
      from = `${semesterStart.value}-01`;
      to   = `${semesterEnd.value}-${new Date(ey,em,0).getDate()}`;
    } else if (analyticsType.value === 'year') {
      from = `${yearStart.value}-01-01`;
      to   = `${yearStart.value}-12-31`;
    } else {
      return alert('Select period');
    }

    let stats = [];
    if (analyticsTarget.value === 'student') {
      const adm = studentAdmInput.value.trim();
      const stu = students.find(s => s.adm === adm);
      if (stu) stats = [{ name: stu.name, roll: stu.roll, P:0,A:0,Lt:0,HD:0,L:0,total:0 }];
    } else {
      stats = students.map(s => ({ name: s.name, roll: s.roll, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    }

    Object.entries(attendanceData).forEach(([d,recs]) => {
      if (d >= from && d <= to) stats.forEach(st => {
        const code = recs[st.roll] || 'A';
        st[code]++; st.total++;
      });
    });

    // build full report table
    let tableHtml = '<table><thead><tr>' +
      '<th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th>' +
      '</tr></thead><tbody>';
    stats.forEach(st => {
      const pct = st.total ? ((st.P/st.total)*100).toFixed(1) : '0.0';
      tableHtml += `<tr><td>${st.name}</td>` +
        `<td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td>` +
        `<td>${st.total}</td><td>${pct}</td></tr>`;
    });
    tableHtml += '</tbody></table>';
    analyticsContainer.innerHTML = tableHtml;
    analyticsContainer.classList.remove('hidden');

    instructionsEl.textContent = analyticsTarget.value === 'student'
      ? `Admission#: ${studentAdmInput.value.trim()} | Period: ${from} to ${to}`
      : `Period: ${from} to ${to}`;
    instructionsEl.classList.remove('hidden');

    // render charts
    const labels = stats.map(s => s.name);
    const dataPct = stats.map(s => s.total ? (s.P/s.total)*100 : 0);
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, { type:'bar', data:{labels, datasets:[{label:'% Present',data:dataPct}]}, options:{scales:{y:{beginAtZero:true,max:100}}} });
    const agg = stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, { type:'pie', data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg)}]} });

    graphsEl.classList.remove('hidden');
    analyticsActions.classList.remove('hidden');
  };

  shareAnalyticsBtn.onclick = e => {
    e.preventDefault();
    const hdr = instructionsEl.textContent;
    const rows = Array.from(analyticsContainer.querySelectorAll('tbody tr')).map(r => {
      const tds = r.querySelectorAll('td');
      return `${tds[0].textContent} P:${tds[1].textContent} A:${tds[2].textContent} Lt:${tds[3].textContent} HD:${tds[4].textContent} L:${tds[5].textContent} Total:${tds[6].textContent} %:${tds[7].textContent}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n' + rows.join('\n'))}`, '_blank');
  };

  downloadAnalyticsBtn.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Attendance Analytics',10,10);
    doc.setFontSize(12);
    doc.text(instructionsEl.textContent,10,20);
    doc.autoTable({ head:[['Name','P','A','Lt','HD','L','Total','%']], body: Array.from(analyticsContainer.querySelectorAll('tbody tr')).map(r=>Array.from(r.querySelectorAll('td')).map(td=>td.textContent)), startY:30 });
    doc.save('attendance_analytics.pdf');
  };

  // 5. ATTENDANCE REGISTER
  const regMonthIn     = $('registerMonth');
  const loadReg        = $('loadRegister');
  const changeReg      = $('changeRegister');
  const regTableWrapper= $('registerTableWrapper');
  const regBody        = $('registerBody');
  const regSummarySec  = $('registerSummarySection');
  const regSummaryBody = $('registerSummaryBody');
  const shareReg2      = $('shareRegister');
  const downloadReg2   = $('downloadRegisterPDF');
  const headerRow      = document.querySelector('#registerTable thead tr');

  function generateRegisterHeader(daysInMonth) {
    headerRow.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const th = document.createElement('th');
      th.textContent = d;
      headerRow.appendChild(th);
    }
  }

  loadReg.onclick = e => {
    e.preventDefault();
    if (!regMonthIn.value) return alert('Select month');
    const [y, m] = regMonthIn.value.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    generateRegisterHeader(daysInMonth);
    regBody.innerHTML = '';
    regSummaryBody.innerHTML = '';

    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${regMonthIn.value}-${String(day).padStart(2,'0')}`;
        const code = (attendanceData[dateStr] || {})[s.roll] || 'A';
        const td = document.createElement('td');
        td.textContent = code;
        td.style.background = colors[code];
        td.style.color = '#fff';
        tr.appendChild(td);
      }
      regBody.appendChild(tr);
    });

    students.forEach(s => {
      const st = {P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${regMonthIn.value}-${String(d).padStart(2,'0')}`;
        const code = (attendanceData[dateStr] || {})[s.roll] || 'A';
        st[code]++; st.total++;
      }
      const pct = st.total ? ((st.P/st.total)*100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${pct}</td>`;
      regSummaryBody.appendChild(tr);
    });

    regTableWrapper.classList.remove('hidden');
    regSummarySec.classList.remove('hidden');
    loadReg.classList.add('hidden');
    changeReg.classList.remove('hidden');
  };

  changeReg.onclick = e => {
    e.preventDefault();
    regTableWrapper.classList.add('hidden');
    regSummarySec.classList.add('hidden');
    loadReg.classList.remove('hidden');
    changeReg.classList.add('hidden');
  };

  shareReg2.onclick = e => {
    e.preventDefault();
    const hdr = `Register for ${regMonthIn.value}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines = Array.from(regSummaryBody.querySelectorAll('tr')).map(r => {
      const tds = r.querySelectorAll('td');
      return `${tds[0].textContent}: P:${tds[1].textContent}, A:${tds[2].textContent}, Lt:${tds[3].textContent}, HD:${tds[4].textContent}, L:${tds[5].textContent}, %:${tds[6].textContent}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines.join('\n'))}`, '_blank');
  };

  downloadReg2.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text('Monthly Attendance Register', 10, 10);
    doc.setFontSize(12);
    doc.text(`Month: ${regMonthIn.value}`, 10, 20);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 10, 26);
    doc.text(`School: ${schoolIn.value}`, 10, 32);
    doc.text(`Class: ${classSel.value} | Section: ${secSel.value}`, 10, 38);
    doc.autoTable({
      html: '#registerTable',
      startY: 44,
      styles: { fontSize: 6 },
      columnStyles: { 0:{cellWidth:10}, 1:{cellWidth:15}, 2:{cellWidth:30} }
    });
    doc.autoTable({
      html: '#registerSummarySection table',
      startY: doc.lastAutoTable.finalY + 10,
      styles: { fontSize: 8 }
    });
    alert('PDF generation complete. Starting download...');
    doc.save('attendance_register.pdf');
  };

  // 6. SERVICE WORKER
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('service-worker.js')
        .then(reg => console.log('ServiceWorker registered:', reg.scope))
        .catch(err => console.error('ServiceWorker registration failed:', err));
    });
  }
});
