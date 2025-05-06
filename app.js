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
  let analyticsFilterOptions = ['all'], lastAnalyticsStats = [], lastAnalyticsRange = { from: null, to: null }, lastAnalyticsShare = '';

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- DOWNLOAD & SHARE BUTTONS ---
  $('downloadRegistrationPDF').onclick = async () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text('Student List', 14, 16);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 32, html: '#studentsTable' });
    const blob = doc.output('blob');
    doc.save('registration.pdf');
    await sharePdf(blob, 'registration.pdf', 'Student List');
  };
  $('downloadAnalytics').onclick = async () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text('Analytics Report', 14, 16);
    doc.setFontSize(12);
    doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 24);
    doc.autoTable({ startY: 32, html: '#analyticsTable' });
    const blob = doc.output('blob');
    doc.save('analytics_report.pdf');
    await sharePdf(blob, 'analytics_report.pdf', 'Analytics Report');
  };
  $('shareAnalytics').onclick = () => {
    if (!lastAnalyticsShare) { alert('No analytics to share. Generate a report first.'); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');
  };
  $('downloadRegister').onclick = async () => {
    const doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(18);
    doc.text('Attendance Register', 14, 16);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 32, html: '#registerTable', tableWidth: 'auto', styles: { fontSize: 10 } });
    const blob = doc.output('blob');
    doc.save('attendance_register.pdf');
    await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
  };

  // --- SETTINGS: Fines & Eligibility ---
  const formDiv      = $('financialForm');
  const saveSettings = $('saveSettings');
  const inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map(id=>$(id));
  const settingsCard = document.createElement('div');
  settingsCard.id    = 'settingsCard'; settingsCard.className = 'card hidden';
  const editSettings = document.createElement('button');
  editSettings.id    = 'editSettings'; editSettings.className = 'btn no-print hidden';
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
      A : +$('fineAbsent').value,
      Lt: +$('fineLate').value,
      L : +$('fineLeave').value,
      HD: +$('fineHalfDay').value,
    };
    eligibilityPct = +$('eligibilityPct').value;
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

  // --- SETUP: School, Class & Section ---
  async function loadSetup() {
    const [sc,cl,sec] = await Promise.all([ get('schoolName'), get('teacherClass'), get('teacherSection') ]);
    if (sc && cl && sec) {
      $('schoolNameInput').value      = sc;
      $('teacherClassSelect').value   = cl;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent      = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderStudents(); updateCounters(); resetViews();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc = $('schoolNameInput').value.trim(),
          cl = $('teacherClassSelect').value,
          sec= $('teacherSectionSelect').value;
    if (!sc||!cl||!sec) { alert('Complete setup'); return; }
    await Promise.all([ save('schoolName', sc), save('teacherClass', cl), save('teacherSection', sec) ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- COUNTERS & UTILS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span=>{
      const target = +span.dataset.target, step = Math.max(1, target/100);
      let count = 0;
      (function upd(){
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(upd);
      })();
    });
  }
  function updateCounters() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
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

  // --- STUDENT REGISTRATION & PAYMENT MODAL omitted for brevity ---

  // --- MARK ATTENDANCE omitted for brevity ---

  // --- ANALYTICS ---
  const atg = $('analyticsTarget'),
        asel = $('analyticsSectionSelect'),
        atype = $('analyticsType'),
        adate = $('analyticsDate'),
        amonth = $('analyticsMonth'),
        sems = $('semesterStart'),
        seme = $('semesterEnd'),
        ayear = $('yearStart'),
        asearch = $('analyticsSearch'),
        loadA = $('loadAnalytics'),
        resetA = $('resetAnalytics'),
        instr = $('instructions'),
        acont = $('analyticsContainer'),
        graphs = $('graphs'),
        aacts = $('analyticsActions'),
        barCtx = $('barChart').getContext('2d'),
        pieCtx = $('pieChart').getContext('2d');
  let barChart, pieChart;

  // --- Simplified “All” vs. individual filter logic ---
  const filterForm    = $('analyticsFilterForm');
  const allCb         = filterForm.querySelector('input[type="checkbox"][value="all"]');
  const individualCbs = Array.from(filterForm.querySelectorAll('input[type="checkbox"]'))
                            .filter(cb => cb.value !== 'all');

  allCb.addEventListener('change', () => {
    individualCbs.forEach(cb => cb.checked = allCb.checked);
  });
  individualCbs.forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        allCb.checked = false;
      } else {
        if (!individualCbs.some(i => i.checked)) {
          allCb.checked = true;
        }
      }
    });
  });

  $('analyticsFilterBtn').onclick = () => show($('analyticsFilterModal'));
  $('analyticsFilterClose').onclick = () => hide($('analyticsFilterModal'));
  $('applyAnalyticsFilter').onclick = () => {
    analyticsFilterOptions = Array.from(individualCbs)
      .filter(cb => cb.checked)
      .map(cb => cb.value);
    // if none checked, default to ['all']
    if (analyticsFilterOptions.length === 0) analyticsFilterOptions = ['all'];
    hide($('analyticsFilterModal'));
    if (lastAnalyticsStats.length) renderAnalytics(lastAnalyticsStats, lastAnalyticsRange.from, lastAnalyticsRange.to);
  };

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearch].forEach(x => x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
    if (atg.value === 'section') asel.classList.remove('hidden');
    if (atg.value === 'student') asearch.classList.remove('hidden');
  };

  atype.onchange = () => {
    [adate, amonth, sems, seme, ayear].forEach(x => x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
    resetA.classList.remove('hidden');
    if (atype.value === 'date')      adate.classList.remove('hidden');
    if (atype.value === 'month')     amonth.classList.remove('hidden');
    if (atype.value === 'semester') { sems.classList.remove('hidden'); seme.classList.remove('hidden'); }
    if (atype.value === 'year')      ayear.classList.remove('hidden');
  };

  resetA.onclick = e => {
    e.preventDefault();
    atype.value = '';
    [adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
    resetA.classList.add('hidden');
  };

  loadA.onclick = () => {
    if (atg.value === 'student' && !asearch.value.trim()) {
      alert('Please enter admission no. or name'); return;
    }
    let from, to;
    if (atype.value === 'date') {
      from = to = adate.value;
    } else if (atype.value === 'month') {
      const [y,m] = amonth.value.split('-').map(Number);
      from = `${amonth.value}-01`;
      to   = `${amonth.value}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
    } else if (atype.value === 'semester') {
      const [sy,sm] = sems.value.split('-').map(Number);
      const [ey,em] = seme.value.split('-').map(Number);
      from = `${sems.value}-01`;
      to   = `${seme.value}-${String(new Date(ey,em,0).getDate()).padStart(2,'0')}`;
    } else if (atype.value === 'year') {
      from = `${ayear.value}-01-01`;
      to   = `${ayear.value}-12-31`;
    } else {
      alert('Select a period'); return;
    }
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    let pool = students.filter(s=>s.cls===cls&&s.sec===sec);
    if (atg.value === 'section') pool = pool.filter(s=>s.sec===asel.value);
    if (atg.value === 'student') {
      const q = asearch.value.trim().toLowerCase();
      pool = pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));
    }

    const stats = pool.map(s=>({ adm:s.adm, name:s.name, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    Object.entries(attendanceData).forEach(([d,r])=>{
      if (d<from||d>to) return;
      stats.forEach(st=>{
        const c = r[st.adm]||'A';
        st[c]++; st.total++;
      });
    });
    stats.forEach(st=>{
      const tf = st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
      const tp = (paymentsData[st.adm]||[]).reduce((a,p)=>a+p.amount,0);
      st.outstanding = tf - tp;
      const pct = st.total?(st.P/st.total)*100:0;
      st.status = (st.outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
    });

    lastAnalyticsStats   = stats;
    lastAnalyticsRange  = { from, to };
    renderAnalytics(stats, from, to);
  };

  function renderAnalytics(stats, from, to) {
    let filtered = stats;
    if (!analyticsFilterOptions.includes('all')) {
      filtered = stats.filter(st=>analyticsFilterOptions.some(opt=>{
        switch(opt){
          case 'registered': return true;
          case 'attendance': return st.total>0;
          case 'fine':       return st.A>0||st.Lt>0||st.L>0||st.HD>0;
          case 'cleared':    return st.outstanding===0;
          case 'debarred':   return st.status==='Debarred';
          case 'eligible':   return st.status==='Eligible';
        }
      }));
    }
    const thead = $('analyticsTable').querySelector('thead tr');
    thead.innerHTML = ['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']
      .map(h=>`<th>${h}</th>`).join('');
    const tbody = $('analyticsBody');
    tbody.innerHTML = '';
    filtered.forEach((st,i)=>{
      const pct = st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td>
        <td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td>
        <td>${pct}%</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>`;
      tbody.appendChild(tr);
    });
    instr.textContent = `Period: ${from} to ${to}`;
    show(instr, acont, graphs, aacts);

    barChart?.destroy();
    barChart = new Chart(barCtx,{
      type:'bar',
      data:{ labels:filtered.map(st=>st.name), datasets:[{ label:'% Present', data:filtered.map(st=>st.total?(st.P/st.total)*100:0) }] },
      options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
    });
    pieChart?.destroy();
    pieChart = new Chart(pieCtx,{ type:'pie', data:{ labels:['Outstanding'], datasets:[{ data:[filtered.reduce((a,st)=>a+st.outstanding,0)] }] } });

    lastAnalyticsShare = `Analytics (${from} to ${to})\n` +
      filtered.map((st,i)=>`${i+1}. ${st.adm} ${st.name}: ${((st.P/st.total)*100).toFixed(1)}% / PKR ${st.outstanding}`).join('\n');
  }

  // --- 11. ATTENDANCE REGISTER ---
  const loadReg   = $('loadRegister'),
        changeReg = $('changeRegister'),
        saveReg   = $('saveRegister'),
        dlReg     = $('downloadRegister'),
        shReg     = $('shareRegister'),
        rm        = $('registerMonth'),
        rh        = $('registerHeader'),
        rb        = $('registerBody');

  const regCodes  = ['A','P','Lt','HD','L'],
        regColors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  // Load register for selected month
  loadReg.onclick = () => {
    const m = rm.value;
    if (!m) { alert('Please pick a month'); return; }
    const [y, mm] = m.split('-').map(Number),
          days    = new Date(y, mm, 0).getDate();

    // Build table header
    rh.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
      [...Array(days)].map((_, i) => `<th>${i+1}</th>`).join('');
    rb.innerHTML = '';

    // Populate rows
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    students
      .filter(s => s.cls === cls && s.sec === sec)
      .forEach((s, idx) => {
        let row = `<td>${idx+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
        for (let d = 1; d <= days; d++) {
          const key   = `${m}-${String(d).padStart(2,'0')}`,
                code  = (attendanceData[key] || {})[s.adm] || 'A',
                style = code === 'A' ? '' : `style="background:${regColors[code]};color:#fff"`;
          row += `<td class="reg-cell" ${style}><span class="status-text">${code}</span></td>`;
        }
        const tr = document.createElement('tr');
        tr.innerHTML = row;
        rb.appendChild(tr);
      });

    // Make cells clickable to cycle status
    rb.querySelectorAll('.reg-cell').forEach(cell => {
      cell.onclick = () => {
        const span = cell.querySelector('.status-text'),
              next = (regCodes.indexOf(span.textContent) + 1) % regCodes.length,
              c    = regCodes[next];
        span.textContent = c;
        if (c === 'A') {
          cell.style.background = '';
          cell.style.color = '';
        } else {
          cell.style.background = regColors[c];
          cell.style.color = '#fff';
        }
      };
    });

    show($('registerTableWrapper'), saveReg);
    hide(loadReg, changeReg, dlReg, shReg);
  };

  // Save register edits back into storage
  saveReg.onclick = async () => {
    const m = rm.value,
          [y, mm] = m.split('-').map(Number),
          days    = new Date(y, mm, 0).getDate();

    Array.from(rb.children).forEach(tr => {
      const adm = tr.children[1].textContent;
      for (let d = 1; d <= days; d++) {
        const code = tr.children[3 + d - 1].querySelector('.status-text').textContent,
              key  = `${m}-${String(d).padStart(2,'0')}`;
        attendanceData[key] = attendanceData[key] || {};
        attendanceData[key][adm] = code;
      }
    });

    await save('attendanceData', attendanceData);
    hide(saveReg);
    show(changeReg, dlReg, shReg);
  };

  // Switch back to “pick month” view
  changeReg.onclick = () => {
    hide($('registerTableWrapper'), changeReg, dlReg, shReg, saveReg);
    rh.innerHTML = '';
    rb.innerHTML = '';
    show(loadReg);
  };

  // Download the register as PDF
  dlReg.onclick = async () => {
    const doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(18);
    doc.text('Attendance Register', 14, 16);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 32, html: '#registerTable', tableWidth: 'auto', styles: { fontSize: 10 } });
    const blob = doc.output('blob');
    doc.save('attendance_register.pdf');
    await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
  };

  // Share the register via WhatsApp
  shReg.onclick = () => {
    const header = `Attendance Register\n${$('setupText').textContent}`;
    const rows   = Array.from(rb.children).map(tr =>
      Array.from(tr.children)
        .map(td => {
          const span = td.querySelector('.status-text');
          return span ? span.textContent : td.textContent;
        })
        .join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows.join('\n'))}`, '_blank');
  };

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
