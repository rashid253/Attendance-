// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- Universal PDF share helper ---
  async function sharePdf(blob, fileName, title) {
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })) {
      try {
        await navigator.share({ title, files: [new File([blob], fileName, { type: 'application/pdf' })] });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share failed', err);
      }
    }
  }

  // --- IndexedDB helpers (idb-keyval) ---
  const { get, set } = window.idbKeyval || {};
  if (!get) return console.error('idb-keyval not found');
  const save = (k, v) => set(k, v);

  // --- State & Defaults ---
  let students       = await get('students')        || [];
  let attendanceData = await get('attendanceData')  || {};
  let paymentsData   = await get('paymentsData')    || {};
  let lastAdmNo      = await get('lastAdmissionNo') || 0;
  let fineRates      = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct = await get('eligibilityPct')  || 75;
  let analyticsDownloadMode = 'combined';
  let lastAnalyticsStats = [], lastAnalyticsRange = { from:null, to:null };

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e=>e?.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e=>e?.classList.add('hidden'));
  const statusNames = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' };

  // --- Setup: School, Class, Section ---
  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([ get('schoolName'), get('teacherClass'), get('teacherSection') ]);
    if (sc && cl && sec) {
      $('schoolNameInput').value = sc;
      $('teacherClassSelect').value = cl;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm')); show($('setupDisplay'));
      renderStudents(); updateCounters(); resetViews();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc = $('schoolNameInput').value.trim(),
          cl = $('teacherClassSelect').value,
          sec= $('teacherSectionSelect').value;
    if(!sc||!cl||!sec) return alert('Complete setup');
    await Promise.all([ save('schoolName',sc), save('teacherClass',cl), save('teacherSection',sec) ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- Fines & Eligibility ---
  $('fineAbsent').value   = fineRates.A;
  $('fineLate').value     = fineRates.Lt;
  $('fineLeave').value    = fineRates.L;
  $('fineHalfDay').value  = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;
  $('saveSettings').onclick = async () => {
    fineRates = {
      A: Number($('fineAbsent').value)||0,
      Lt: Number($('fineLate').value)||0,
      L: Number($('fineLeave').value)||0,
      HD: Number($('fineHalfDay').value)||0
    };
    eligibilityPct = Number($('eligibilityPct').value)||0;
    await Promise.all([ save('fineRates',fineRates), save('eligibilityPct',eligibilityPct) ]);
    hide($('financialForm')); show($('settingsCard'));
  };
  $('editSettings').onclick = () => { hide($('settingsCard')); show($('financialForm')); };

  // --- Student Registration & Status ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value,
          sec= $('teacherSectionSelect').value,
          tbody = $('studentsBody');
    tbody.innerHTML = ''; let idx=0;
    students.forEach((s,i) => {
      if (s.cls!==cl||s.sec!==sec) return;
      idx++;
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(rec => { if(rec[s.adm]) stats[rec[s.adm]]++; });
      const totalDays = Object.values(stats).reduce((a,b)=>a+b,0);
      const fine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out  = fine - paid;
      const pct  = totalDays? (stats.P/totalDays)*100 : 0;
      const status = (out>0 || pct<eligibilityPct)? 'Debarred':'Eligible';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" data-idx="${i}"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${out}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}">Add</button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked=false;
  }
  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n=$('studentName').value.trim(), p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(), o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim(), cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a) return alert('All fields required');
    if(!/^\d{7,15}$/.test(c)) return alert('Contact invalid');
    const adm = await genAdmNo();
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec });
    await save('students',students); renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };

  // --- Attendance Marking ---
  $('loadAttendance').onclick = () => {
    if (!$('dateInput').value) return alert('Select date');
    renderAttendanceTable($('dateInput').value);
    show($('attendanceBody'), $('saveAttendance'), $('resetAttendance'), $('attendanceSummary'), $('analyticsContainer'));
    hide($('loadAttendance'));
  };
  function renderAttendanceTable(date) {
    const tbody = $('attendanceTableBody');
    tbody.innerHTML = '';
    const cl = $('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const rec = attendanceData[date]||{};
    let idx=0;
    students.forEach(s=>{
      if(s.cls!==cl||s.sec!==sec) return;
      idx++;
      const code = rec[s.adm]||'P';
      const sel = `<select data-adm="${s.adm}">` +
        Object.entries(statusNames).map(([k,v])=>`<option value="${k}" ${k===code?'selected':''}>${v}</option>`).join('') +
        `</select>`;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${idx}</td><td>${s.name}</td><td>${s.adm}</td><td>${sel}</td>`;
      tbody.appendChild(tr);
    });
  }
  $('saveAttendance').onclick = async () => {
    const date = $('dateInput').value;
    attendanceData[date] = {};
    document.querySelectorAll('#attendanceTableBody select').forEach(s=>attendanceData[date][s.dataset.adm]=s.value);
    await save('attendanceData',attendanceData);
    alert('Saved');
    show($('downloadAttendancePDF'), $('shareAttendanceSummary'), $('loadRegister'));
    hide($('saveAttendance'), $('resetAttendance'));
    generateAttendanceSummary(date);
  };
  $('resetAttendance').onclick = () => renderAttendanceTable($('dateInput').value);
  function generateAttendanceSummary(date) {
    const rec = attendanceData[date]||{};
    const lines = Object.entries(statusNames).map(([k,v])=>`${v}: ${Object.values(rec).filter(x=>x===k).length}`);
    $('attendanceSummaryText').textContent = `Attendance ${date}\n` + lines.join(' | ');
  }

  // --- Attendance Register ---
  $('loadRegister').onclick = () => {
    renderAttendanceRegister();
    show($('registerTableWrapper'), $('changeRegister'), $('downloadRegister'), $('shareRegister'));
    hide($('loadRegister'));
  };
  $('changeRegister').onclick = () => {
    hide($('registerTableWrapper'), $('changeRegister'), $('downloadRegister'), $('shareRegister'));
    show($('loadRegister'));
  };
  function renderAttendanceRegister() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const dates = Object.keys(attendanceData).sort();
    // header
    const thead = $('registerTableHead');
    thead.innerHTML = `<tr><th>#</th><th>Name</th><th>Adm#</th>` + dates.map(d=>`<th>${d}</th>`).join('') + `</tr>`;
    // body
    const tbody = $('registerTableBody');
    tbody.innerHTML = '';
    let idx=0;
    students.forEach(s=>{
      if(s.cls!==cl||s.sec!==sec) return;
      idx++;
      const cells = dates.map(d=>{
        const code = (attendanceData[d]||{})[s.adm]||'P';
        return `<td>${statusNames[code]}</td>`;
      }).join('');
      tbody.innerHTML += `<tr><td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>${cells}</tr>`;
    });
  }

  // --- Downloads & Shares ---
  $('downloadAttendancePDF').onclick = async () => {
    const date = $('dateInput').value;
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text(`Attendance ${date}`,14,16);
    doc.autoTable({ startY:24, html:'#attendanceTable' });
    const blob = doc.output('blob');
    doc.save(`attendance_${date}.pdf`);
    await sharePdf(blob, `attendance_${date}.pdf`, `Attendance ${date}`);
  };
  $('shareAttendanceSummary').onclick = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent($('attendanceSummaryText').textContent)}`, '_blank');
  };
  $('downloadRegister').onclick = async () => {
    const doc = new jspdf.jsPDF({ orientation:'landscape' });
    doc.setFontSize(18); doc.text('Attendance Register',14,16);
    doc.autoTable({ startY:24, html:'#registerTable', styles:{ fontSize:8 } });
    const blob = doc.output('blob');
    doc.save('attendance_register.pdf');
    await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
  };
  $('shareRegister').onclick = () => {
    const cl = $('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const dates = Object.keys(attendanceData).sort();
    let text = `Register: Class ${cl} Sec ${sec}\n${dates.join(' | ')}\n`;
    students.forEach(s=>{
      if(s.cls!==cl||s.sec!==sec) return;
      const row = dates.map(d=>statusNames[(attendanceData[d]||{})[s.adm]||'P']).join(' | ');
      text += `\n${s.name} (${s.adm}): ${row}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- Analytics (periodic report) ---
  $('generateAnalytics').onclick = () => {
    const from = $('analyticsFrom').value, to = $('analyticsTo').value;
    if(!from||!to||from>to) return alert('Valid range');
    lastAnalyticsRange={from,to};
    computeAnalytics(from,to);
    show($('analyticsActions'), $('graphs'));
  };
  function computeAnalytics(from,to) {
    const dates = Object.keys(attendanceData).filter(d=>d>=from&&d<=to).sort();
    lastAnalyticsStats = students
      .filter(s=>s.cls===$('teacherClassSelect').value&&s.sec===$('teacherSectionSelect').value)
      .map(s=>{
        const recs = dates.map(d=>attendanceData[d][s.adm]||'P');
        const counts={P:0,A:0,Lt:0,HD:0,L:0};
        recs.forEach(c=>counts[c]++);
        const total = recs.length;
        const fine  = counts.A*fineRates.A + counts.Lt*fineRates.Lt + counts.L*fineRates.L + counts.HD*fineRates.HD;
        const paid  = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
        const out   = fine - paid;
        const pct   = total? counts.P/total*100 : 0;
        const status=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
        return { name:s.name, adm:s.adm, ...counts, total, outstanding:out, status };
      });
    renderAnalyticsTable();
  }
  function renderAnalyticsTable() {
    const tbody = $('analyticsTableBody');
    tbody.innerHTML = '';
    lastAnalyticsStats.forEach(st => {
      tbody.innerHTML += `
        <tr>
          <td><input type="checkbox"></td>
          <td>${st.name}</td><td>${st.adm}</td>
          <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td>
          <td>${st.total}</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>
        </tr>`;
    });
  }
  $('downloadAnalytics').onclick = async () => {
    if (!lastAnalyticsStats.length) return alert('No analytics');
    const doc = new jspdf.jsPDF();
    if (analyticsDownloadMode === 'combined') {
      doc.setFontSize(18); doc.text('Attendance Analytics',14,16);
      doc.autoTable({ startY:24, html:'#analyticsTable' });
      const blob = doc.output('blob');
      doc.save('analytics.pdf');
      await sharePdf(blob,'analytics.pdf','Analytics');
    } else {
      doc.setFontSize(18); doc.text('Individual Analytics',14,16);
      let y=24;
      lastAnalyticsStats.forEach((st,i)=>{
        if (i) { doc.addPage(); y=24; }
        doc.setFontSize(14); doc.text(`${st.name} (${st.adm})`,14,y); y+=16;
        doc.setFontSize(12);
        ['P','A','Lt','HD','L'].forEach(code => { doc.text(`${code}: ${st[code]}`,14,y); y+=14; });
        doc.text(`Total: ${st.total}`,14,y); y+=14;
        doc.text(`Outstanding: PKR ${st.outstanding}`,14,y); y+=14;
        doc.text(`Status: ${st.status}`,14,y);
      });
      const blob = doc.output('blob');
      doc.save('individual_analytics.pdf');
      await sharePdf(blob,'individual_analytics.pdf','Individual Analytics');
    }
  };
  $('shareAnalytics').onclick = () => {
    if (!lastAnalyticsStats.length) return alert('No analytics');
    let text = `Analytics ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}\n`;
    lastAnalyticsStats.forEach(st => {
      text += `\n${st.name} (${st.adm}): %P ${(st.P/st.total*100).toFixed(1)}%, PKR ${st.outstanding}, ${st.status}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };
  $('resetAnalytics').onclick = () => {
    hide($('analyticsActions'), $('graphs'));
    $('analyticsFrom').value = $('analyticsTo').value = '';
    $('analyticsTableBody').innerHTML = '';
    lastAnalyticsStats = [];
  };

  // --- Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }

  // --- Utility: Counters & Views ---
  function updateCounters() {
    const cl = $('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    $('sectionCount').textContent = students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').textContent   = students.filter(s=>s.cls===cl).length;
    $('schoolCount').textContent  = students.length;
  }
  function resetViews() {
    hide($('attendanceBody'), $('saveAttendance'), $('resetAttendance'), $('downloadAttendancePDF'),
         $('shareAttendanceSummary'), $('analyticsContainer'), $('registerTableWrapper'),
         $('changeRegister'), $('downloadRegister'), $('shareRegister'));
    show($('loadAttendance'), $('loadRegister'));
  }
  $('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // Initial render
  renderStudents();
  updateCounters();
});
