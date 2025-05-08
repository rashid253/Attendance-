// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- Universal PDF share helper ---
  async function sharePdf(blob, fileName, title) {
    if (
      navigator.canShare &&
      navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })
    ) {
      try {
        await navigator.share({ title, files: [new File([blob], fileName, { type: 'application/pdf' })] });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share failed', err);
      }
    }
  }

  // --- Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) { console.error('idb-keyval not found'); return; }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // --- State & Defaults ---
  let students       = await get('students')        || [];
  let attendanceData = await get('attendanceData')  || {};
  let paymentsData   = await get('paymentsData')    || {};
  let lastAdmNo      = await get('lastAdmissionNo') || 0;
  let fineRates      = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct = await get('eligibilityPct')  || 75;
  let analyticsFilterOptions = ['all'], analyticsDownloadMode = 'combined';
  let lastAnalyticsStats = [], lastAnalyticsRange = { from: null, to: null }, lastAnalyticsShare = '';

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- 1. DOWNLOAD & SHARE REGISTRATION ---
  $('downloadRegistrationPDF').onclick = async () => {
    const doc = new jspdf.jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split('T')[0];
    const margin = 14;

    doc.setFontSize(18);
    doc.text('Registered Students', margin, 20);
    doc.setFontSize(10);
    doc.text(`Date: ${today}`, pageWidth - margin, 20, { align: 'right' });
    doc.setFontSize(12);
    doc.text($('setupText').textContent, margin, 28);

    doc.autoTable({ startY: 36, html: '#studentsTable', margin: { left: margin, right: margin } });
    const blob = doc.output('blob');
    doc.save('registration.pdf');
    await sharePdf(blob, 'registration.pdf', 'Registered Students');
  };

  $('shareRegistration').onclick = () => {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students
      .filter(s => s.cls === cl && s.sec === sec)
      .map(s => {
        const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
        Object.values(attendanceData).forEach(rec => rec[s.adm] && stats[rec.adm]++);
        const total = Object.values(stats).reduce((a,b) => a+b,0);
        const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
        const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
        const outstanding = totalFine - paid;
        const pct = total ? (stats.P/total)*100 : 0;
        const status = (outstanding>0||pct<eligibilityPct) ? 'Debarred' : 'Eligible';
        return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: PKR ${outstanding}\nStatus: ${status}`;
      })
      .join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // --- 2. SETTINGS: Fines & Eligibility ---
  const formDiv      = $('financialForm'),
        saveSettings = $('saveSettings'),
        inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map(id => $(id)),
        settingsCard = document.createElement('div'),
        editSettings = document.createElement('button');
  settingsCard.id = 'settingsCard';
  settingsCard.className = 'card hidden';
  editSettings.id = 'editSettings';
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
      A:  Number($('fineAbsent').value)   || 0,
      Lt: Number($('fineLate').value)     || 0,
      L:  Number($('fineLeave').value)    || 0,
      HD: Number($('fineHalfDay').value)  || 0
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;
    await Promise.all([ save('fineRates', fineRates), save('eligibilityPct', eligibilityPct) ]);
    settingsCard.innerHTML = `
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
      </div>`;
    hide(formDiv, saveSettings, ...inputs);
    show(settingsCard, editSettings);
  };

  editSettings.onclick = () => {
    hide(settingsCard, editSettings);
    show(formDiv, saveSettings, ...inputs);
  };

  // --- 3. SETUP: School, Class & Section ---
  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([ get('schoolName'), get('teacherClass'), get('teacherSection') ]);
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
    await Promise.all([ save('schoolName', sc), save('teacherClass', cl), save('teacherSection', sec) ]);
    await loadSetup();
  };

  $('editSetup').onclick = e => {
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };
  await loadSetup();

  // --- 4. COUNTERS & UTILS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target / 100);
      (function upd() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(upd);
      })();
    });
  }

  function updateCounters() {
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s => s.cls===cl && s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s => s.cls===cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }

  function resetViews() {
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'), $('attendanceSummary'),
      $('downloadAttendancePDF'), $('shareAttendanceSummary'), $('instructions'),
      $('analyticsContainer'), $('graphs'), $('analyticsActions'),
      $('registerTableWrapper'), $('changeRegister'), $('saveRegister'), $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }

  $('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- 5. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody'); tbody.innerHTML = '';
    let idx = 0;
    students.forEach((s,i) => {
      if (s.cls!==cl || s.sec!==sec) return;
      idx++;
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => rec[s.adm] && stats[rec.adm]++);
      const total    = Object.values(stats).reduce((a,b)=>a+b,0);
      const totalFine= stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid     = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out      = totalFine - paid;
      const pct      = total ? stats.P/total*100 : 0;
      const status   = (out>0||pct<eligibilityPct) ? 'Debarred' : 'Eligible';

      const tr = document.createElement('tr'); tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td>
        <td>${s.name}</td>
        <td>${s.adm}</td>
        <td>${s.parent}</td>
        <td>${s.contact}</td>
        <td>${s.occupation}</td>
        <td>${s.address}</td>
        <td>PKR ${out}</td>
        <td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b => b.onclick = () => openPaymentModal(b.dataset.adm));
  }

  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled   = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => e.target.classList.contains('sel') && toggleButtons());
  $('selectAllStudents').onclick = () => { document.querySelectorAll('.sel').forEach(c => c.checked = $('selectAllStudents').checked); toggleButtons(); };

  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n = $('studentName').value.trim();
    const p = $('parentName').value.trim();
    const c = $('parentContact').value.trim();
    const o = $('parentOccupation').value.trim();
    const a = $('parentAddress').value.trim();
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!n||!p||!c||!o||!a) { alert('All fields required'); return; }
    if (!/^\d{7,15}$/.test(c)) { alert('Contact 7–15 digits'); return; }
    const adm = await genAdmNo();
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec });
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id => $(id).value='');
  };

  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach(cb => {
      const tr = cb.closest('tr'), i = +tr.dataset.index, s = students[i];
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" checked></td>
        <td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"></td>
        <td>${s.adm}</td>
        <td><input value="${s.parent}"></td>
        <td><input value="${s.contact}"></td>
        <td><input value="${s.occupation}"></td>
        <td><input value="${s.address}"></td>
        <td colspan="3"></td>
      `;
    });
    hide($('editSelected')); show($('doneEditing'));
  };

  $('doneEditing').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach(tr => {
      const inps = [...tr.querySelectorAll('input:not(.sel)')];
      if (inps.length === 5) {
        const [n,p,c,o,a] = inps.map(i => i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(x => x.adm === adm);
        if (idx > -1) {
          students[idx] = { ...students[idx], name:n, parent:p, contact:c, occupation:o, address:a };
        }
      }
    });
    await save('students', students);
    hide($('doneEditing')); show($('editSelected'), $('deleteSelected'), $('saveRegistration'));
    renderStudents(); updateCounters();
  };

  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete?')) return;
    const toDel = [...document.querySelectorAll('.sel:checked')].map(cb => +cb.closest('tr').dataset.index);
    students = students.filter((_, i) => !toDel.includes(i));
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
  };

  $('saveRegistration').onclick = async () => {
    if (!$('doneEditing').classList.contains('hidden')) { alert('Finish editing'); return; }
    await save('students', students);
    hide(
      document.querySelector('#student-registration .row-inline'),
      $('editSelected'), $('deleteSelected'), $('selectAllStudents'), $('saveRegistration')
    );
    show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };

  $('editRegistration').onclick = () => {
    show(
      document.querySelector('#student-registration .row-inline'),
      $('selectAllStudents'), $('editSelected'), $('deleteSelected'), $('saveRegistration')
    );
    hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };

  // --- 6. MARK ATTENDANCE ---
  const dateInput             = $('dateInput'),
        loadAttendanceBtn     = $('loadAttendance'),
        saveAttendanceBtn     = $('saveAttendance'),
        resetAttendanceBtn    = $('resetAttendance'),
        downloadAttendanceBtn = $('downloadAttendancePDF'),
        shareAttendanceBtn    = $('shareAttendanceSummary'),
        attendanceBodyDiv     = $('attendanceBody'),
        attendanceSummaryDiv  = $('attendanceSummary'),
        statusNames           = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' };

  attendanceBodyDiv.classList.add('attendance-container');

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = ''; attendanceSummaryDiv.innerHTML = '';
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    students.filter(s => s.cls===cl && s.sec===sec).forEach((stu, i) => {
      const studentContainer = document.createElement('div'); studentContainer.className = 'attendance-student-container';
      const infoRow = document.createElement('div'); infoRow.className = 'attendance-info-row';
      const sr = document.createElement('span'); sr.className = 'sr-num'; sr.textContent = `#${i+1}`;
      const admEl = document.createElement('span'); admEl.className = 'adm-num'; admEl.textContent = `(${stu.adm})`;
      const name = document.createElement('span'); name.className = 'student-name'; name.textContent = stu.name;
      infoRow.append(sr, admEl, name);
      const btnsDiv = document.createElement('div'); btnsDiv.className = 'attendance-buttons';
      Object.keys(statusNames).forEach(code => {
        const btn = document.createElement('button'); btn.className = 'att-btn'; btn.textContent = code;
        btn.onclick = () => {
          btnsDiv.querySelectorAll('.att-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        };
        btnsDiv.append(btn);
      });
      studentContainer.append(infoRow, btnsDiv);
      attendanceBodyDiv.append(studentContainer);
    });
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert('Pick date'); return; }
    attendanceData[date] = {};
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    students.filter(s => s.cls===cl && s.sec===sec).forEach((s,i) => {
      const btn = attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = btn ? btn.textContent : 'A';
    });
    await save('attendanceData', attendanceData);
    attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement('table');
    tbl.innerHTML = `<tr><th>Name</th><th>Status</th><th>Share</th></tr>`;
    students.filter(s => s.cls===cl && s.sec===sec).forEach(s => {
      const code = attendanceData[date][s.adm];
      tbl.innerHTML += `
        <tr>
          <td>${s.name}</td>
          <td>${statusNames[code]}</td>
          <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
        </tr>`;
    });
    attendanceSummaryDiv.append(tbl);
    attendanceSummaryDiv.querySelectorAll('.share-individual').forEach(ic => {
      ic.onclick = () => {
        const adm = ic.dataset.adm, st = students.find(x => x.adm===adm);
        const msg = `Dear Parent, your child was ${statusNames[attendanceData[date][adm]]} on ${date}.`;
        window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      };
    });
    hide(attendanceBodyDiv, saveAttendanceBtn);
    show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  resetAttendanceBtn.onclick = () => {
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  downloadAttendanceBtn.onclick = async () => {
    const doc = new jspdf.jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth(), today = new Date().toISOString().split('T')[0], margin = 14;
    doc.setFontSize(18); doc.text('Attendance Report', margin, 20);
    doc.setFontSize(10); doc.text(`Date: ${today}`, pageWidth - margin, 20, { align: 'right' });
    doc.autoTable({ startY: 28, html: '#attendanceSummary table', margin: { left: margin, right: margin } });
    const blob = doc.output('blob');
    doc.save(`attendance_${today}.pdf`);
    await sharePdf(blob, `attendance_${today}.pdf`, 'Attendance Report');
  };

  shareAttendanceBtn.onclick = () => {
    const date = dateInput.value;
    if (!date) { alert('Pick date'); return; }
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    let text = `Attendance Report – ${date}\n\n`;
    students.filter(s => s.cls===cl && s.sec===sec).forEach(s => {
      const code = attendanceData[date][s.adm];
      text += `${s.name} (${s.adm}): ${statusNames[code]}\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- 7. ANALYTICS ---
  const atg    = $('analyticsTarget'),
        asel   = $('analyticsSectionSelect'),
        atype  = $('analyticsType'),
        adate  = $('analyticsDate'),
        amonth = $('analyticsMonth'),
        sems   = $('semesterStart'),
        seme   = $('semesterEnd'),
        ayear  = $('yearStart'),
        asearch= $('analyticsSearch'),
        loadA  = $('loadAnalytics'),
        resetA = $('resetAnalytics'),
        instr  = $('instructions'),
        acont  = $('analyticsContainer'),
        graphs = $('graphs'),
        aacts  = $('analyticsActions'),
        barCtx = $('barChart').getContext('2d'),
        pieCtx = $('pieChart').getContext('2d');
  let barChart, pieChart;

  $('analyticsFilterBtn').onclick   = () => show($('analyticsFilterModal'));
  $('analyticsFilterClose').onclick = () => hide($('analyticsFilterModal'));

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearch].forEach(x => x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
    if (atg.value==='section') asel.classList.remove('hidden');
    if (atg.value==='student') asearch.classList.remove('hidden');
  };

  atype.onchange = () => {
    [adate, amonth, sems, seme, ayear].forEach(x => x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
    resetA.classList.remove('hidden');
    if (atype.value==='date') adate.classList.remove('hidden');
    if (atype.value==='month') amonth.classList.remove('hidden');
    if (atype.value==='semester') { sems.classList.remove('hidden'); seme.classList.remove('hidden'); }
    if (atype.value==='year') ayear.classList.remove('hidden');
  };

  loadA.onclick = () => {
    if (atype.value==='student' && !asearch.value.trim()) { alert('Enter admission number or name'); return; }
    let from, to;
    if (atype.value==='date') { from=to=adate.value; }
    else if (atype.value==='month') {
      const [y,m]=amonth.value.split('-').map(Number);
      from=`${amonth.value}-01`;
      to=`${amonth.value}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
    }
    else if (atype.value==='semester') {
      const [sy,sm]=sems.value.split('-').map(Number);
      const [ey,em]=seme.value.split('-').map(Number);
      from=`${sems.value}-01`;
      to=`${seme.value}-${String(new Date(ey,em,0).getDate()).padStart(2,'0')}`;
    }
    else if (atype.value==='year') { from=`${ayear.value}-01-01`; to=`${ayear.value}-12-31`; }
    else { alert('Select period'); return; }

    const cls = $('teacherClassSelect').value;
    let pool = students.filter(s=>s.cls===cls);
    if (atg.value==='section') pool=pool.filter(s=>s.sec===asel.value);
    if (atg.value==='student') {
      const q=asearch.value.trim().toLowerCase();
      pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));
    }
    const stats=pool.map(s=>({adm:s.adm,name:s.name,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,rec])=>{
      if (d<from||d>to) return;
      stats.forEach(st=>{ if(rec[st.adm]){st[rec[st.adm]]++; st.total++;}});
    });
    stats.forEach(st=>{
      const totalFine=st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
      const paid=(paymentsData[st.adm]||[]).reduce((a,p)=>a+p.amount,0);
      st.outstanding=totalFine-paid;
      const pct=st.total?st.P/st.total*100:0;
      st.status=(st.outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
    });
    lastAnalyticsStats=stats;
    lastAnalyticsRange={from,to};
    renderAnalytics(stats,from,to);
  };

  $('applyAnalyticsFilter').onclick = () => {
    analyticsFilterOptions=Array.from(document.querySelectorAll('#analyticsFilterForm input[type="checkbox"]:checked')).map(cb=>cb.value);
    if(!analyticsFilterOptions.length) analyticsFilterOptions=['all'];
    analyticsDownloadMode=document.querySelector('#analyticsFilterForm input[name="downloadMode"]:checked').value;
    hide($('analyticsFilterModal'));
    if(!lastAnalyticsStats.length) alert('Please Load a report first.');
    else renderAnalytics(lastAnalyticsStats,lastAnalyticsRange.from,lastAnalyticsRange.to);
  };

  function renderAnalytics(stats,from,to){
    const filters=analyticsFilterOptions;
    const filtered=filters.includes('all')?stats:stats.filter(st=>filters.some(opt=>{
      switch(opt){
        case 'registered': return true;
        case 'attendance': return st.total>0;
        case 'fine': return st.A>0||st.Lt>0||st.L>0||st.HD>0;
        case 'cleared': return st.outstanding===0;
        case 'debarred': return st.status==='Debarred';
        case 'eligible': return st.status==='Eligible';
        default: return false;
      }
    }));
    const thead=$('analyticsTable').querySelector('thead tr');
    thead.innerHTML=['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status'].map(h=>`<th>${h}</th>`).join('');
    const tbody=$('analyticsBody'); tbody.innerHTML='';
    filtered.forEach((st,i)=>{
      const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td>
        <td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td>
        <td>${pct}%</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>`;
      tbody.appendChild(tr);
    });
    $('instructions').textContent=`Period: ${from} to ${to}`;
    show($('instructions'),$('analyticsContainer'),$('graphs'),$('analyticsActions'));
  }

  // --- 8. ATTENDANCE REGISTER ---
  (function(){
    const loadRegisterBtn=$('loadRegister'), registerWrapper=$('registerTableWrapper'),
          changeRegisterBtn=$('changeRegister'), saveRegisterBtn=$('saveRegister'),
          downloadRegisterBtn=$('downloadRegister'), shareRegisterBtn=$('shareRegister'),
          datePicker=$('dateInput');
    loadRegisterBtn.onclick=()=>{
      const date=datePicker.value; if(!date){alert('Pick a date');return;}
      registerWrapper.innerHTML='';
      const table=document.createElement('table'); table.id='registerTable';
      table.innerHTML=`
        <thead><tr><th>#</th><th>Name</th><th>Adm#</th><th>Status</th></tr></thead>
        <tbody>${students.filter(s=>s.cls===$('teacherClassSelect').value&&s.sec=== $('teacherSectionSelect').value).map((s,i)=>{
          const code=attendanceData[date]?.[s.adm]||'A';
          return`<tr><td>${i+1}</td><td>${s.name}</td><td>${s.adm}</td><td>${statusNames[code]}</td></tr>`;
        }).join('')}</tbody>`;
      registerWrapper.appendChild(table);
      show(registerWrapper,changeRegisterBtn);
      hide(loadRegisterBtn,saveRegisterBtn,downloadRegisterBtn,shareRegisterBtn);
    };
    changeRegisterBtn.onclick=()=>{
      const date=datePicker.value;
      registerWrapper.querySelectorAll('tbody tr').forEach((tr,i)=>{
        const adm=tr.children[2].textContent, cur=attendanceData[date]?.[adm]||'A';
        tr.children[3].innerHTML=`<select>${Object.entries(statusNames).map(([k,v])=>`<option value="${k}"${k===cur?' selected':''}>${v}</option>`).join('')}</select>`;
      });
      show(saveRegisterBtn,downloadRegisterBtn,shareRegisterBtn);
      hide(changeRegisterBtn);
    };
    saveRegisterBtn.onclick=async()=>{
      const date=datePicker.value; if(!date){alert('Pick a date');return;}
      if(!attendanceData[date])attendanceData[date]={};
      registerWrapper.querySelectorAll('tbody tr').forEach(tr=>{
        const adm=tr.children[2].textContent, sel=tr.querySelector('select').value;
        attendanceData[date][adm]=sel;
      });
      await save('attendanceData',attendanceData);
      alert('Register saved'); changeRegisterBtn.click();
    };
    downloadRegisterBtn.onclick=()=>{
      const date=datePicker.value; if(!date){alert('Pick a date');return;}
      const doc=new jspdf.jsPDF(),margin=14,pw=doc.internal.pageSize.getWidth();
      doc.setFontSize(18);doc.text('Attendance Register',margin,20);
      doc.setFontSize(10);doc.text(`Date: ${date}`,pw-margin,20,{align:'right'});
      doc.autoTable({startY:28,html:'#registerTable',margin:{left:margin,right:margin}});
      doc.save(`register_${date}.pdf`);
    };
    shareRegisterBtn.onclick=()=>{
      const date=datePicker.value; if(!date){alert('Pick a date');return;}
      let text=`Attendance Register – ${date}\n\n`;
      registerWrapper.querySelectorAll('tbody tr').forEach(tr=>{
        const name=tr.children[1].textContent, adm=tr.children[2].textContent;
        const status=tr.children[3].querySelector('select')?tr.children[3].querySelector('select').selectedOptions[0].textContent:tr.children[3].textContent;
        text+=`${name} (${adm}): ${status}\n`;
      });
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank');
    };
  })();

  // --- 9. Service Worker ---
  if('serviceWorker' in navigator)navigator.serviceWorker.register('service-worker.js').catch(console.error);
});
