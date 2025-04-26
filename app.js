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
    return String(next).padStart(4, '0');
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
      { id: 'classCount',   val: totalClass },
      { id: 'schoolCount',  val: totalSchool }
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

  // --- BIND & RENDER FUNCTIONS (unchanged) ---
  const bindRowSelection = () => { /* ... */ };
  const renderStudents = () => { /* ... */ updateTotals(); };

  // --- SETUP ---
  const loadSetup = async () => { /* ... */ renderStudents(); };
  btnSaveSetup.onclick = async e => { /* ... */ };
  btnEditSetup.onclick = e => { /* ... */ };
  await loadSetup();

  // --- ADD STUDENT ---
  btnAddStudent.onclick = async e => { /* ... */ };

  // --- INLINE EDIT, DELETE, SAVE/EDIT REGISTRATION (unchanged) ---
  btnEditSel.onclick = e => { /* ... */ };
  btnDeleteSel.onclick = async e => { /* ... */ };
  btnSaveReg.onclick = e => { /* ... */ };
  btnEditReg.onclick = e => { /* ... */ };

  // --- SHARE REGISTRATION (WhatsApp) ---
  btnShareReg.onclick = e => {
    e.preventDefault();
    const hdr = `*Attendance Report*\nSchool: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
    const lines = filteredStudents().map(s =>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines)}`, '_blank');
  };

  // --- DOWNLOAD STUDENT REGISTRATION PDF ---
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
        b.classList.add('att-btn');              // transparent styling
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

  btnSaveAtt.onclick = async e => { /* unchanged */ };

  btnResetAtt.onclick = () => { /* unchanged */ };

  // --- SHARE ATTENDANCE SUMMARY (WhatsApp) ---
  btnShareAtt.onclick = () => {
    const d = dateInput.value;
    const hdr = `*Attendance Report*\nDate: ${d}\nSchool: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
    const lines = filteredStudents().map(s => {
      const code = attendanceData[d][s.roll] || 'A';
      const statusMap = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' };
      return `${s.name}: ${statusMap[code]}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines.join('\n'))}`, '_blank');
  };

  // --- DOWNLOAD ATTENDANCE PDF ---
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
  selectAnalyticsTarget.onchange = () => { /* unchanged */ };
  selectAnalyticsType.onchange = () => { /* unchanged */ };
  btnResetAnalytics.onclick = e => { /* unchanged */ };
  btnLoadAnalytics.onclick = e => { /* unchanged analytics rendering */ };

  // --- SHARE ANALYTICS (WhatsApp) ---
  btnShareAnalytics.onclick = e => {
    e.preventDefault();
    const parts = divInstructions.textContent.split('|');
    const period = parts.pop().trim();
    const header = `*Attendance Report*\nPeriod: ${period}\nSchool: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
    const rows = Array.from(divAnalyticsTable.querySelectorAll('tbody tr')).map(r => {
      const td = Array.from(r.querySelectorAll('td')).map(c => c.textContent);
      return `${td[0]} P:${td[1]} A:${td[2]} Lt:${td[3]} HD:${td[4]} L:${td[5]} Total:${td[6]} %:${td[7]}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + rows.join('\
'))}`, '_blank');
  };

  // --- DOWNLOAD ANALYTICS PDF ---
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
      ),
      startY: 38
    });
    const y = doc.lastAutoTable.finalY + 10;
    doc.addImage(chartBar.toBase64Image(), 'PNG', 10, y, 80, 60);
    const yPie = y + 70;
    doc.addImage(chartPie.toBase64Image(), 'PNG', 10, yPie, 80, 60);
    doc.save('attendance_analytics.pdf');
  };

  // --- ATTENDANCE REGISTER ---
  const generateRegisterHeader = days => { /* unchanged */ };
  btnLoadReg.onclick = e => { /* unchanged rendering */ };
  btnChangeReg.onclick = e => { /* unchanged */ };

  // --- SHARE REGISTER SUMMARY (WhatsApp) ---
  btnShareReg2.onclick = e => {
    e.preventDefault();
    const hdr = `*Attendance Report*\nRegister for ${monthInput.value}\nSchool: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
    const lines = Array.from(tbodyRegSum.querySelectorAll('tr')).map(r => {
      const [name,p,a,lt,hd,l,pct] = Array.from(r.querySelectorAll('td')).map(td => td.textContent);
      return `${name}: P:${p}, A:${a}, Lt:${lt}, HD:${hd}, L:${l}, %:${pct}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines.join('\n'))}`, '_blank');
  };

  // --- DOWNLOAD REGISTER PDF ---
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
