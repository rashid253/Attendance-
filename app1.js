window.addEventListener('DOMContentLoaded', async () => {
  // --- 0. Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- 1. IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) {
    console.error('idb-keyval not found');
    return;
  }
  const { get, set } = window.idbKeyval;
  const save = (key, val) => set(key, val);

  // --- 2. State & Defaults ---
  let students        = await get('students')        || [];
  let attendanceData  = await get('attendanceData')  || {};
  let paymentsData    = await get('paymentsData')    || {};
  let lastAdmNo       = await get('lastAdmissionNo') || 0;
  let fineRates       = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct  = await get('eligibilityPct')  || 75;

  let analyticsFilterOptions = ['all'];
  let analyticsDownloadMode  = 'combined';
  let lastAnalyticsStats     = [];
  let lastAnalyticsRange     = { from: null, to: null };
  let lastAnalyticsShare     = '';

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
  const formDiv      = $('financialForm');
  const saveSettings = $('saveSettings');
  const inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct']
    .map(id => $(id));
  const settingsCard = document.createElement('div');
  settingsCard.id    = 'settingsCard';
  settingsCard.className = 'card hidden';
  const editSettings = document.createElement('button');
  editSettings.id    = 'editSettings';
  editSettings.className = 'btn no-print hidden';
  editSettings.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editSettings);

  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveSettings.onclick = async () => {
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
    hide(formDiv, saveSettings, ...inputs);
    show(settingsCard, editSettings);
  };

  editSettings.onclick = () => {
    hide(settingsCard, editSettings);
    show(formDiv, saveSettings, ...inputs);
  };

  // --- 5. SETUP: School, Class & Section ---
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
      renderStudents();
      updateCounters();
      resetViews();
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
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- 6. COUNTERS & UTILS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target/100);
      (function upd(){
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(upd);
      })();
    });
  }
  function updateCounters() {
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  function resetViews() {
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'),
      $('registerTableWrapper'), $('changeRegister'), $('saveRegister'),
      $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }
  $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- 7. STUDENT REGISTRATION & FINE/STATUS ---
  // ... (unchanged code for registration/editing/deletion) ...

  // --- 8. PAYMENT MODAL ---
  // ... (unchanged payment modal code) ...

  // --- 9. MARK ATTENDANCE ---
  // ... (unchanged attendance marking code) ...

  // --- 10. ANALYTICS ---
  // ... (unchanged analytics code) ...

  // --- 11. ATTENDANCE REGISTER ---
  // ... (unchanged register code) ...

  // --- 12. DOWNLOAD & SHARE PDF HANDLERS ---
  async function sharePdf(blob, fileName, title) {
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })) {
      try {
        await navigator.share({
          title,
          files: [new File([blob], fileName, { type: 'application/pdf' })]
        });
      } catch (err) {
        console.error('Share failed', err);
      }
    } else {
      console.warn('Web Share API not supported or cannot share files.');
    }
  }

  $('downloadRegistrationPDF').onclick = async () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Student List',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#studentsTable' });
    const blob = doc.output('blob');
    doc.save('registration.pdf');
    await sharePdf(blob, 'registration.pdf', 'Student List');
  };

  $('downloadAttendancePDF').onclick = async () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#attendanceSummary table' });
    const fileName = `attendance_${dateInput.value}.pdf`;
    const blob = doc.output('blob');
    doc.save(fileName);
    await sharePdf(blob, fileName, 'Attendance Report');
  };

  $('downloadAnalytics').onclick = async () => {
    if (analyticsDownloadMode === 'combined') {
      const doc = new jspdf.jsPDF();
      doc.setFontSize(18); doc.text('Analytics Report',14,16);
      doc.setFontSize(12); doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`,14,24);
      const body = lastAnalyticsStats.filter(st => {
        if (analyticsFilterOptions.includes('all')) return true;
        return analyticsFilterOptions.some(opt => {
          switch(opt) {
            case 'registered': return true;
            case 'attendance':  return st.total>0;
            case 'fine':        return (st.A>0||st.Lt>0||st.L>0||st.HD>0);
            case 'cleared':     return st.outstanding===0;
            case 'debarred':    return st.status==='Debarred';
            case 'eligible':    return st.status==='Eligible';
            default:            return false;
          }
        });
      }).map((st,i) => [
        i+1, st.adm, st.name, st.P, st.A, st.Lt, st.HD, st.L,
        st.total, `${((st.P/st.total)*100).toFixed(1)}%`, `PKR ${st.outstanding}`, st.status
      ]);
      doc.autoTable({ startY:32, head:[['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']], body, styles:{fontSize:10} });
      const blob = doc.output('blob');
      doc.save('analytics_report.pdf');
      await sharePdf(blob, 'analytics_report.pdf', 'Analytics Report');
    } else {
      lastAnalyticsStats.filter(st => {
        if (analyticsFilterOptions.includes('all')) return true;
        return analyticsFilterOptions.some(opt => {
          switch(opt) {
            case 'registered': return true;
            case 'attendance':  return st.total>0;
            case 'fine':        return (st.A>0||st.Lt>0||st.L>0||st.HD>0);
            case 'cleared':     return st.outstanding===0;
            case 'debarred':    return st.status==='Debarred';
            case 'eligible':    return st.status==='Eligible';
            default:            return false;
          }
        });
      }).forEach(async st => {
        const doc = new jspdf.jsPDF();
        doc.setFontSize(16); doc.text(`Report for ${st.name} (${st.adm})`,14,16);
        doc.setFontSize(12);
        const rows = [
          ['Present',st.P],['Absent',st.A],['Late',st.Lt],
          ['Half-Day',st.HD],['Leave',st.L],['Total',st.total],
          ['% Present',`${((st.P/st.total)*100).toFixed(1)}%`],
          ['Outstanding',`PKR ${st.outstanding}`],['Status',st.status]
        ];
        doc.autoTable({ startY:24, head:[['Metric','Value']], body:rows, styles:{fontSize:10} });
        const fileName = `report_${st.adm}.pdf`;
        const blob = doc.output('blob');
        doc.save(fileName);
        await sharePdf(blob, fileName, `Report for ${st.name}`);
      });
    }
  };

  $('downloadRegister').onclick = async () => {
    const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    doc.setFontSize(18); doc.text('Attendance Register',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#registerTable', tableWidth:'auto', styles:{fontSize:10} });
    const blob = doc.output('blob');
    doc.save('attendance_register.pdf');
    await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
  };

  // --- 13. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
