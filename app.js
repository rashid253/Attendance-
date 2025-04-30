// app.js

window.addEventListener('DOMContentLoaded', async () => {
  console.debug('App initialized');

  // 0. Debug console via Eruda
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => { console.debug('Eruda loaded'); eruda.init(); };
  document.body.appendChild(erudaScript);

  // 1. idb-keyval helpers
  if (!window.idbKeyval) { console.error('idb-keyval not found'); return; }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // 2. State & defaults
  let students       = await get('students')        || [];
  let attendanceData = await get('attendanceData')  || {};
  let paymentsData   = await get('paymentsData')    || {};
  let lastAdmNo      = await get('lastAdmissionNo') || 0;
  let fineRates      = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct = await get('eligibilityPct')  || 75;

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // 3. DOM helpers
  const $    = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // 4. Financial Settings UI
  const formSettings    = $('financialForm'),
        btnSaveSettings = $('saveSettings'),
        inputsSettings  = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map($),
        cardSettings    = document.createElement('div'),
        btnEditSettings = document.createElement('button');

  cardSettings.id = 'settingsCard';
  cardSettings.className = 'card hidden';
  btnEditSettings.id = 'editSettings';
  btnEditSettings.className = 'btn no-print hidden';
  btnEditSettings.textContent = 'Edit Settings';
  formSettings.parentNode.append(cardSettings, btnEditSettings);

  inputsSettings[0].value = fineRates.A;
  inputsSettings[1].value = fineRates.Lt;
  inputsSettings[2].value = fineRates.L;
  inputsSettings[3].value = fineRates.HD;
  inputsSettings[4].value = eligibilityPct;

  btnSaveSettings.onclick = async () => {
    fineRates = {
      A : +inputsSettings[0].value || 0,
      Lt: +inputsSettings[1].value || 0,
      L : +inputsSettings[2].value || 0,
      HD: +inputsSettings[3].value || 0,
    };
    eligibilityPct = +inputsSettings[4].value || 0;
    await save('fineRates', fineRates);
    await save('eligibilityPct', eligibilityPct);
    cardSettings.innerHTML = `
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
      </div>`;
    hide(formSettings, btnSaveSettings, ...inputsSettings);
    show(cardSettings, btnEditSettings);
  };

  btnEditSettings.onclick = () => {
    hide(cardSettings, btnEditSettings);
    show(formSettings, btnSaveSettings, ...inputsSettings);
  };

  // 5. Teacher & School Setup
  const formSetup     = $('setupForm'),
        displaySetup  = $('setupDisplay'),
        inpSchool     = $('schoolNameInput'),
        selClass      = $('teacherClassSelect'),
        selSection    = $('teacherSectionSelect'),
        txtSetup      = $('setupText'),
        btnSaveSetup  = $('saveSetup'),
        btnEditSetup  = $('editSetup');

  btnSaveSetup.onclick = async e => {
    e.preventDefault();
    if (!inpSchool.value.trim() || !selClass.value || !selSection.value) {
      return alert('Complete setup');
    }
    await save('schoolName', inpSchool.value.trim());
    await save('teacherClass', selClass.value);
    await save('teacherSection', selSection.value);
    loadSetup();
  };

  btnEditSetup.onclick = e => {
    e.preventDefault();
    show(formSetup);
    hide(displaySetup);
  };

  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([
      get('schoolName'), get('teacherClass'), get('teacherSection')
    ]);
    if (sc && cl && sec) {
      inpSchool.value   = sc;
      selClass.value    = cl;
      selSection.value  = sec;
      txtSetup.textContent = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide(formSetup);
      show(displaySetup);
      renderStudents();
      updateCounters();
      resetViews();
    }
  }
  await loadSetup();

  // 6. Counters & View Management
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target / 100);
      (function upd() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(upd);
      })();
    });
  }

  function updateCounters() {
    const cl = selClass.value, sec = selSection.value;
    $('sectionCount').dataset.target = students.filter(s => s.cls === cl && s.sec === sec).length;
    $('classCount').dataset.target   = students.filter(s => s.cls === cl).length;
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

  selClass.onchange = () => { renderStudents(); updateCounters(); resetViews(); };
  selSection.onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // 7. Student Registration & Actions
  const tbodyStudents    = $('studentsBody'),
        cbSelectAll      = $('selectAllStudents'),
        btnEditSelected  = $('editSelected'),
        btnDeleteSelected= $('deleteSelected');

  function renderStudents() {
    tbodyStudents.innerHTML = '';
    let idx = 0;
    const cl = selClass.value, sec = selSection.value;
    students.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(r => stats[r[s.adm] || 'A']++);
      const fineTotal = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paidTotal = (paymentsData[s.adm] || []).reduce((sum,p) => sum + p.amount, 0);
      const outstanding = fineTotal - paidTotal;
      const totalDays = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct = totalDays ? (stats.P/totalDays)*100 : 0;
      const status = (outstanding>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';

      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td>
        <td>${s.name}</td>
        <td>${s.adm}</td>
        <td>${s.parent}</td>
        <td>${s.contact}</td>
        <td>${s.occupation}</td>
        <td>${s.address}</td>
        <td>PKR ${outstanding}</td>
        <td>${status}</td>`;
      tbodyStudents.appendChild(tr);
    });
    cbSelectAll.checked = false;
    btnEditSelected.disabled = true;
    btnDeleteSelected.disabled = true;
  }

  tbodyStudents.addEventListener('change', e => {
    if (e.target.classList.contains('sel')) {
      const any = !!tbodyStudents.querySelector('.sel:checked');
      btnEditSelected.disabled   = !any;
      btnDeleteSelected.disabled = !any;
    }
  });

  cbSelectAll.onclick = () => {
    tbodyStudents.querySelectorAll('.sel').forEach(cb => cb.checked = cbSelectAll.checked);
    const any = cbSelectAll.checked;
    btnEditSelected.disabled   = !any;
    btnDeleteSelected.disabled = !any;
  };

  $('addStudent').onclick = async () => {
    const name = $('studentName').value.trim(),
          parent = $('parentName').value.trim(),
          contact = $('parentContact').value.trim(),
          occupation = $('parentOccupation').value.trim(),
          address = $('parentAddress').value.trim();
    if (![name,parent,contact,occupation,address].every(v=>v)) {
      return alert('All fields required');
    }
    if (!/^\d{7,15}$/.test(contact)) {
      return alert('Contact must be 7–15 digits');
    }
    const adm = await genAdmNo();
    students.push({ name, adm, parent, contact, occupation, address, cls: selClass.value, sec: selSection.value });
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
  };

  btnDeleteSelected.onclick = async () => {
    const toDelete = [...tbodyStudents.querySelectorAll('.sel:checked')]
      .map(cb => +cb.closest('tr').dataset.index);
    students = students.filter((_,i) => !toDelete.includes(i));
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
  };

  btnEditSelected.onclick = () => {
    alert('Inline edit UI not implemented—click a row and repopulate the form manually.');
  };

  // 8. Payment Modal
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('studentsBody').addEventListener('click', e => {
    if (e.target.matches('.add-payment-btn')) openPaymentModal(e.target.dataset.adm);
  });

  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent;
    const amt = +$('paymentAmount').value || 0;
    paymentsData[adm] = paymentsData[adm] || [];
    paymentsData[adm].push({ date: new Date().toISOString().split('T')[0], amount: amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));

  // 9. Mark Attendance
  const dateInput       = $('dateInput'),
        btnLoadAtt      = $('loadAttendance'),
        btnSaveAtt      = $('saveAttendance'),
        btnResetAtt     = $('resetAttendance'),
        attBody         = $('attendanceBody'),
        attSummary      = $('attendanceSummary'),
        btnDownloadAtt  = $('downloadAttendancePDF'),
        btnShareAtt     = $('shareAttendanceSummary');

  btnLoadAtt.onclick = () => {
    const date = dateInput.value;
    if (!date) return alert('Select a date');
    attBody.innerHTML = '';
    const table = document.createElement('table'),
          thead = document.createElement('thead'),
          tbody = document.createElement('tbody');
    thead.innerHTML = '<tr><th>#</th><th>Name</th><th>Adm#</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th></tr>';
    table.append(thead, tbody);
    let idx = 0;
    students.filter(s=>s.cls===selClass.value&&s.sec===selSection.value)
      .forEach(s => {
        idx++;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${idx}</td>
          <td>${s.name}</td>
          <td>${s.adm}</td>
          <td><button data-status="P" class="att-btn">P</button></td>
          <td><button data-status="A" class="att-btn">A</button></td>
          <td><button data-status="Lt" class="att-btn">Lt</button></td>
          <td><button data-status="HD" class="att-btn">HD</button></td>
          <td><button data-status="L" class="att-btn">L</button></td>`;
        const prev = attendanceData[date]?.[s.adm];
        if (prev) row.querySelector(`.att-btn[data-status="${prev}"]`).classList.add('selected');
        row.querySelectorAll('.att-btn').forEach(btn => {
          btn.onclick = () => {
            row.querySelectorAll('.att-btn').forEach(b=>b.classList.remove('selected'));
            btn.classList.add('selected');
          };
        });
        tbody.appendChild(row);
      });
    attBody.appendChild(table);
    show(btnSaveAtt, btnResetAtt);
    hide(attSummary, btnDownloadAtt, btnShareAtt);
  };

  btnSaveAtt.onclick = async () => {
    const date = dateInput.value;
    attendanceData[date] = {};
    attBody.querySelectorAll('tbody tr').forEach(row => {
      const adm = row.children[2].textContent;
      const sel = row.querySelector('.att-btn.selected');
      attendanceData[date][adm] = sel?.dataset.status || 'A';
    });
    await save('attendanceData', attendanceData);
    renderAttendanceSummary(date);
    show(attSummary, btnDownloadAtt, btnShareAtt);
  };

  btnResetAtt.onclick = () => btnLoadAtt.click();

  function renderAttendanceSummary(date) {
    const recs = attendanceData[date] || {};
    const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
    Object.values(recs).forEach(v => stats[v]++);
    attSummary.innerHTML = `
      <p><strong>Summary for ${date}</strong></p>
      <p>Present: ${stats.P}</p>
      <p>Absent: ${stats.A}</p>
      <p>Late: ${stats.Lt}</p>
      <p>Half-Day: ${stats.HD}</p>
      <p>Leave: ${stats.L}</p>`;
  }

  btnDownloadAtt.onclick = () => {
    const date = dateInput.value;
    const doc = new jspdf.jsPDF();
    doc.text(`Attendance – ${date}`, 20, 20);
    const body = Object.entries(attendanceData[date]||{}).map(([adm,st]) => [adm, st]);
    doc.autoTable({ head:[['Adm#','Status']], body });
    doc.save(`attendance-${date}.pdf`);
  };

  btnShareAtt.onclick = () => {
    const date = dateInput.value;
    let txt = `Attendance for ${date}\n`;
    Object.entries(attendanceData[date]||{}).forEach(([adm,st]) => { txt += `${adm}: ${st}\n`; });
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
  };

  // 10. Analytics & PDF Download
  const atg             = $('analyticsTarget'),
        asel            = $('analyticsSectionSelect'),
        atype           = $('analyticsType'),
        adate           = $('analyticsDate'),
        amonth          = $('analyticsMonth'),
        sems            = $('semesterStart'),
        seme            = $('semesterEnd'),
        ayear           = $('yearStart'),
        asearch         = $('analyticsSearch'),
        btnLoadA        = $('loadAnalytics'),
        btnResetA       = $('resetAnalytics'),
        instr           = $('instructions'),
        contAnalytics   = $('analyticsContainer'),
        tblHeadRow      = $('analyticsTable').querySelector('thead tr'),
        tblBody         = $('analyticsBody'),
        graphs          = $('graphs'),
        barCtx          = $('barChart').getContext('2d'),
        pieCtx          = $('pieChart').getContext('2d'),
        btnShareA       = $('shareAnalytics'),
        btnDownloadA    = $('downloadAnalytics');

  let stats = [], analyticsFrom = '', analyticsTo = '', barChart, pieChart;

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearch].forEach(el => el.classList.add('hidden'));
    [instr, contAnalytics, graphs, btnShareA, btnDownloadA, btnResetA].forEach(el => el.classList.add('hidden'));
    if (atg.value === 'section') show(asel);
    if (atg.value === 'student') show(asearch);
  };

  atype.onchange = () => {
    [adate, amonth, sems, seme, ayear].forEach(el => el.classList.add('hidden'));
    [instr, contAnalytics, graphs, btnShareA, btnDownloadA, btnResetA].forEach(el => el.classList.add('hidden'));
    btnResetA.classList.remove('hidden');
    if (atype.value === 'date') show(adate);
    if (atype.value === 'month') show(amonth);
    if (atype.value === 'semester') show(sems, seme);
    if (atype.value === 'year') show(ayear);
  };

  btnResetA.onclick = e => {
    e.preventDefault();
    atype.value = '';
    [adate, amonth, sems, seme, ayear, instr, contAnalytics, graphs, btnShareA, btnDownloadA, btnResetA]
      .forEach(el => el.classList.add('hidden'));
  };

  btnLoadA.onclick = () => {
    if (!atype.value)      return alert('Select a period');
    if (atg.value==='section' && !asel.value) return alert('Select a section');
    if (atg.value==='student' && !asearch.value.trim()) return alert('Enter Adm# or Name');

    // determine date range
    if (atype.value === 'date') {
      analyticsFrom = analyticsTo = adate.value;
    } else if (atype.value === 'month') {
      const [y,m] = amonth.value.split('-').map(Number);
      analyticsFrom = `${amonth.value}-01`;
      analyticsTo   = `${amonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (atype.value === 'semester') {
      const [sy,sm] = sems.value.split('-').map(Number);
      const [ey,em] = seme.value.split('-').map(Number);
      analyticsFrom = `${sems.value}-01`;
      analyticsTo   = `${seme.value}-${new Date(ey,em,0).getDate()}`;
    } else {
      analyticsFrom = `${ayear.value}-01-01`;
      analyticsTo   = `${ayear.value}-12-31`;
    }

    // filter pool
    let pool = students.filter(s=>s.cls===selClass.value && s.sec===selSection.value);
    if (atg.value==='section') pool = pool.filter(s=>s.sec===asel.value);
    if (atg.value==='student') {
      const q = asearch.value.trim().toLowerCase();
      pool = pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));
    }

    // build stats
    stats = pool.map(s=>({ adm:s.adm, name:s.name, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    for (const [d,recs] of Object.entries(attendanceData)) {
      if (d < analyticsFrom || d > analyticsTo) continue;
      stats.forEach(st => {
        const code = recs[st.adm] || 'A';
        st[code]++; st.total++;
      });
    }
    stats.forEach(st => {
      const ft = st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
      const pt = (paymentsData[st.adm] || []).reduce((a,p)=>a+p.amount,0);
      st.outstanding = ft - pt;
      const pct = st.total ? (st.P/st.total)*100 : 0;
      st.status = (st.outstanding>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';
    });

    // render table view & charts
    tblHeadRow.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>
                            <th>% Present</th><th>Outstanding</th><th>Status</th>`;
    tblBody.innerHTML = '';
    stats.forEach((st,i) => {
      const pct = st.total ? ((st.P/st.total)*100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td>
        <td>${pct}%</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>`;
      tblBody.appendChild(tr);
    });

    show(instr, contAnalytics, graphs, btnShareA, btnDownloadA);

    if (window.barChart) window.barChart.destroy();
    if (window.pieChart) window.pieChart.destroy();

    window.barChart = new Chart(barCtx, {
      type:'bar',
      data:{ labels: stats.map(s=>s.adm),
             datasets:[{ label:'% Present', data: stats.map(s=>s.total?(s.P/s.total)*100:0) }] },
      options:{ responsive:true, scales:{ y:{ beginAtZero:true, max:100 } } }
    });

    const first = stats[0] || { P:0,A:0,Lt:0,HD:0,L:0 };
    window.pieChart = new Chart(pieCtx, {
      type:'pie',
      data:{ labels:['P','A','Lt','HD','L'], datasets:[{ data:[first.P,first.A,first.Lt,first.HD,first.L] }] },
      options:{ responsive:true }
    });
  };

  btnShareA.onclick = () => {
    let txt = `Analytics (${analyticsFrom} to ${analyticsTo})\n`;
    stats.forEach((st,i) => {
      const pct = st.total ? ((st.P/st.total)*100).toFixed(1) : '0.0';
      txt += `${i+1}. ${st.adm} ${st.name}: ${pct}% / PKR ${st.outstanding}\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
  };

  // 10b. Download Analytics PDF with Summary Page + Detailed Page
  btnDownloadA.onclick = () => {
    // Summary page in portrait
    let doc = new jspdf.jsPDF({ orientation:'portrait', unit:'pt', format:'a4' });
    doc.setFontSize(16);
    doc.text('Analytics Summary', 40, 40);
    doc.setFontSize(12);
    doc.text(`School & Class : ${txtSetup.textContent}`, 40, 70);
    doc.text(`Time Period    : ${analyticsFrom} – ${analyticsTo}`, 40, 90);
    doc.text(`Target         : ${atg.value.toUpperCase()}`, 40, 110);
    if (atg.value === 'section')  doc.text(`Section        : ${asel.value}`, 40, 130);
    if (atg.value === 'student')  doc.text(`Student Query  : ${asearch.value}`, 40, 130);
    doc.text(`Eligibility ≥   : ${eligibilityPct}%`, 40, 150);
    doc.text(
      `Fine Rates     : Absent PKR ${fineRates.A}, Late PKR ${fineRates.Lt}, ` +
      `Leave PKR ${fineRates.L}, Half-Day PKR ${fineRates.HD}`,
      40, 170
    );

    // Detailed page in landscape
    doc.addPage('a4', 'landscape');
    doc.setFontSize(14);
    doc.text('Detailed Analytics', 40, 40);
    doc.setFontSize(10);
    doc.text(`Period: ${analyticsFrom} – ${analyticsTo}`, 40, 60);
    doc.autoTable({
      startY: 80,
      head: [['#','Adm#','Name','% Present','Outstanding','Status']],
      body: stats.map((st,i) => [
        i+1,
        st.adm,
        st.name,
        st.total ? ((st.P/st.total)*100).toFixed(1) + '%' : '0.0%',
        'PKR ' + st.outstanding,
        st.status
      ]),
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 }
    });

    doc.save(`analytics_${analyticsFrom}_to_${analyticsTo}.pdf`);
  };

  // 11. Attendance Register
  const inpRegisterMonth  = $('registerMonth'),
        btnLoadRegister   = $('loadRegister'),
        btnChangeRegister = $('changeRegister'),
        btnSaveRegister   = $('saveRegister'),
        btnDownloadRegister = $('downloadRegister'),
        btnShareRegister  = $('shareRegister'),
        hdrRegister       = $('registerHeader'),
        bodyRegister      = $('registerBody');

  btnLoadRegister.onclick = () => {
    const ym = inpRegisterMonth.value;
    if (!ym) return alert('Select month');
    hdrRegister.innerHTML = '<th>#</th><th>Name</th><th>Adm#</th>';
    bodyRegister.innerHTML = '';
    const [y,m] = ym.split('-').map(Number);
    const days = new Date(y,m,0).getDate();
    for (let d=1; d<=days; d++) {
      const th = document.createElement('th');
      th.textContent = d;
      hdrRegister.appendChild(th);
    }
    let idx=0;
    students.filter(s=>s.cls===selClass.value&&s.sec===selSection.value)
      .forEach(s=>{
        idx++;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>`;
        for (let d=1; d<=days; d++){
          const dateKey = `${ym}-${String(d).padStart(2,'0')}`;
          const btn = document.createElement('button');
          btn.className = 'att-btn';
          const prev = attendanceData[dateKey]?.[s.adm];
          btn.textContent = prev || 'A';
          if (prev && prev!=='A') btn.classList.add('selected');
          btn.onclick = () => {
            const cycle = ['P','A','Lt','HD','L'];
            const cur = btn.textContent;
            const nxt = cycle[(cycle.indexOf(cur)+1)%cycle.length];
            btn.textContent = nxt;
            btn.classList.toggle('selected', nxt!=='A');
          };
          const td = document.createElement('td');
          td.appendChild(btn);
          tr.appendChild(td);
        }
        bodyRegister.appendChild(tr);
      });
    show(btnChangeRegister, btnSaveRegister);
    hide(btnLoadRegister, btnDownloadRegister, btnShareRegister);
  };

  btnChangeRegister.onclick = () => {
    hdrRegister.innerHTML = '';
    bodyRegister.innerHTML = '';
    hide(btnChangeRegister, btnSaveRegister, btnDownloadRegister, btnShareRegister);
    show(btnLoadRegister);
  };

  btnSaveRegister.onclick = async () => {
    const ym = inpRegisterMonth.value;
    const [y,m] = ym.split('-').map(Number);
    const days = new Date(y,m,0).getDate();
    bodyRegister.querySelectorAll('tr').forEach(tr => {
      const adm = tr.children[2].textContent;
      for (let i=0; i<days; i++){
        const btn = tr.children[3+i].firstChild;
        const status = btn.textContent;
        const dateKey = `${ym}-${String(i+1).padStart(2,'0')}`;
        attendanceData[dateKey] = attendanceData[dateKey] || {};
        attendanceData[dateKey][adm] = status;
      }
    });
    await save('attendanceData', attendanceData);
    show(btnDownloadRegister, btnShareRegister);
    hide(btnChangeRegister, btnSaveRegister);
  };

  btnDownloadRegister.onclick = () => {
    const ym = inpRegisterMonth.value;
    const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    doc.text(`Attendance Register – ${ym}`, 30, 20);
    const header = Array.from(hdrRegister.children).map(th=>th.textContent);
    const body   = Array.from(bodyRegister.children).map(tr => Array.from(tr.children).map(td=>td.textContent));
    doc.autoTable({ head:[header], body, margin:{ left:30, right:30 }, styles:{ fontSize:8 } });
    doc.save(`register-${ym}.pdf`);
  };

  btnShareRegister.onclick = () => {
    const ym = inpRegisterMonth.value;
    let txt = `Register for ${ym}\n`;
    bodyRegister.querySelectorAll('tr').forEach(tr => {
      const adm = tr.children[2].textContent;
      const statuses = Array.from(tr.children).slice(3).map(td=>td.textContent).join('');
      txt += `${adm}: ${statuses}\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
  };

  // 12. Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.debug('SW registered', reg))
      .catch(err => console.error('SW failed', err));
  }

}); // end DOMContentLoaded
