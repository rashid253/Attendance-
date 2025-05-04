// app.js
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

  // --- NEW: Fine Mode & Holidays ---
  let fineMode        = await get('fineMode')        || 'advance';
  let holidayDates    = await get('holidayDates')    || [];

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

  // --- 4. SETTINGS: Fines, Eligibility & Mode/Holidays UI ---
  const formDiv      = $('financialForm');
  const saveSettings = $('saveSettings');
  const inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct']
    .map(id => $(id));

  // Create settings card & edit button
  const settingsCard = document.createElement('div');
  settingsCard.id    = 'settingsCard';
  settingsCard.className = 'card hidden';
  const editSettings = document.createElement('button');
  editSettings.id    = 'editSettings';
  editSettings.className = 'btn no-print hidden';
  editSettings.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editSettings);

  // Inject mode radios
  const modeContainer = document.createElement('div');
  modeContainer.className = 'row-inline';
  modeContainer.innerHTML = `
    <label><input type="radio" name="fineMode" value="advance"> Advance Fine Mode</label>
    <label><input type="radio" name="fineMode" value="prorata"> Pro-Rata Fine Mode</label>
  `;
  formDiv.appendChild(modeContainer);

  // Inject holiday picker
  const holidayContainer = document.createElement('div');
  holidayContainer.className = 'row-inline';
  holidayContainer.innerHTML = `
    <label>Gazetted Holidays (YYYY-MM-DD, comma-sep):<br>
      <input id="holidayDatesInput" type="text" placeholder="e.g. 2025-05-01,2025-05-23">
    </label>
  `;
  formDiv.appendChild(holidayContainer);

  // Set initial settings values
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;
  Array.from(formDiv.querySelectorAll('input[name="fineMode"]'))
    .forEach(r => { r.checked = r.value === fineMode; });
  $('holidayDatesInput').value = holidayDates.join(',');

  saveSettings.onclick = async () => {
    // Save fine rates & eligibility
    fineRates = {
      A : Number($('fineAbsent').value)   || 0,
      Lt: Number($('fineLate').value)     || 0,
      L : Number($('fineLeave').value)    || 0,
      HD: Number($('fineHalfDay').value)  || 0,
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;

    // Save mode & holidays
    fineMode = formDiv.querySelector('input[name="fineMode"]:checked').value;
    holidayDates = $('holidayDatesInput').value
      .split(',').map(s=>s.trim())
      .filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s));

    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct),
      save('fineMode', fineMode),
      save('holidayDates', holidayDates)
    ]);

    // Update summary
    settingsCard.innerHTML = `
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
        <p><strong>Mode:</strong> ${fineMode==='advance'?'Advance Fine Mode':'Pro-Rata Fine Mode'}</p>
        <p><strong>Holidays:</strong> ${holidayDates.join(', ')||'None'}</p>
      </div>
    `;

    hide(formDiv, saveSettings, ...inputs, modeContainer, holidayContainer);
    show(settingsCard, editSettings);
  };

  editSettings.onclick = () => {
    hide(settingsCard, editSettings);
    show(formDiv, saveSettings, ...inputs, modeContainer, holidayContainer);
  };

  // --- 5. SETUP: School, Class & Section ---
  async function loadSetup() {
    const schoolName = await get('schoolName') || '';
    $('setupText').textContent = schoolName;
    const classes = await get('classes') || [];
    const sections = await get('sections') || {};
    const clsSel = $('teacherClassSelect');
    clsSel.innerHTML = classes.map(c=>`<option value="${c}">${c}</option>`).join('');
    clsSel.onchange = () => {
      const secSel = $('teacherSectionSelect');
      const secList = sections[clsSel.value]||[];
      secSel.innerHTML = secList.map(s=>`<option value="${s}">${s}</option>`).join('');
      renderStudents(); updateCounters();
    };
    $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); };
    clsSel.dispatchEvent(new Event('change'));
  }

  $('saveSetup').onclick = async () => {
    const name = prompt('School name?', $('setupText').textContent);
    const classes = prompt('Classes (comma-sep)?', '').split(',').map(s=>s.trim());
    const sectionsRaw = prompt('Sections per class as JSON?', '{}');
    await Promise.all([
      save('schoolName', name),
      save('classes', classes),
      save('sections', JSON.parse(sectionsRaw))
    ]);
    loadSetup();
  };

  // --- 6. COUNTERS & UTILS ---
  function updateCounters() {
    const total = students.length;
    const paidUp = students.filter(s=>{
      const arr = paymentsData[s.adm]||[];
      return arr.reduce((a,p)=>a+p.amount,0) >= fineRates.A;
    }).length;
    $('countTotal').textContent = total;
    $('countPaid').textContent  = paidUp;
    $('countDue').textContent   = total - paidUp;
  }

  // --- 7. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody'); tbody.innerHTML=''; let idx=0;
    students.forEach((s,i)=>{
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      const stats = {P:0,A:0,Lt:0,HD:0,L:0};
      Object.entries(attendanceData).forEach(([d,recs])=>{
        if (holidayDates.includes(d)) return;
        const c = recs[s.adm] || 'A';
        stats[c]++;
      });
      if (fineMode==='advance') {
        const today = new Date(), y = today.getFullYear(), m = today.getMonth();
        const daysInMonth = new Date(y, m+1, 0).getDate();
        const holCount = holidayDates.filter(d=>{
          const dt = new Date(d);
          return dt.getFullYear()===y && dt.getMonth()===m;
        }).length;
        const expected = daysInMonth - holCount;
        const presDays = stats.P + stats.Lt + stats.L + stats.HD;
        stats.A = Math.max(0, expected - presDays);
      }
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      const outstanding = totalFine - paid;
      const totalDays = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct = totalDays ? (stats.P/totalDays)*100 : 0;
      const status = (outstanding>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';

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
        <td>${stats.P}</td>
        <td>${stats.Lt}</td>
        <td>${stats.L}</td>
        <td>${stats.HD}</td>
        <td>${stats.A}</td>
        <td>${totalDays}</td>
        <td>${pct.toFixed(1)}%</td>
        <td>PKR ${outstanding}</td>
        <td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleButtons();
    document.querySelectorAll('.sel').forEach(cb=>cb.onchange=toggleButtons);
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }

  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }

  $('addRegistration').onclick = () => {
    show($('registrationForm'), $('saveRegistration'));
    hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
  };

  $('saveRegistration').onclick = async () => {
    const name = $('regName').value.trim();
    if (!name) return alert('Name required');
    const adm = await genAdmNo();
    const obj = {
      name: name,
      adm: adm,
      parent: $('regParent').value.trim(),
      contact: $('regContact').value.trim(),
      occupation: $('regOccupation').value.trim(),
      address: $('regAddress').value.trim(),
      cls: $('teacherClassSelect').value,
      sec: $('teacherSectionSelect').value
    };
    students.push(obj);
    await save('students', students);
    $('registrationForm').reset();
    hide($('registrationForm'), $('saveRegistration'));
    show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };

  $('editRegistration').onclick = () => {
    show(document.querySelector('#student-registration .row-inline'),
         $('editSelected'), $('deleteSelected'), $('saveRegistration'));
    hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };

  $('shareRegistration').onclick = () => {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students.filter(s=>s.cls===cl&&s.sec===sec).map(s=>
      `${s.adm} ${s.name} ${s.parent}`
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+lines.join('\n'))}`,'_blank');
  };

  $('downloadRegistrationPDF').onclick = () => {
    const header = `Attendance Register\n${$('setupText').textContent}`;
    const rows = Array.from(document.querySelectorAll('#studentsBody tr')).map(tr=>
      Array.from(tr.children).map(td=>
        td.querySelector('.status-text') ? td.querySelector('.status-text').textContent : td.textContent
      ).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+rows.join('\n'))}`,'_blank');
  };

  // --- 8. PAYMENT MODAL ---
  const paymentModal      = $('paymentModal');
  const paymentAdm        = $('paymentAdm');
  const paymentAmount     = $('paymentAmount');
  const paymentDate       = $('paymentDate');
  const savePaymentBtn    = $('savePayment');
  const closePaymentBtn   = $('closePayment');
  function openPaymentModal(adm) {
    paymentAdm.textContent    = adm;
    paymentAmount.value       = '';
    paymentDate.value         = new Date().toISOString().slice(0,10);
    show(paymentModal);
  }
  closePaymentBtn.onclick = () => hide(paymentModal);
  savePaymentBtn.onclick  = async () => {
    const adm = paymentAdm.textContent;
    const arr = paymentsData[adm]||[];
    arr.push({ amount: Number(paymentAmount.value)||0, date: paymentDate.value });
    paymentsData[adm] = arr;
    await save('paymentsData', paymentsData);
    hide(paymentModal);
    renderStudents(); updateCounters();
  };

  // --- 9. MARK ATTENDANCE ---
  $('takeAttendance').onclick = () => {
    const date = $('attendanceDate').value;
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const recs = {};
    document.querySelectorAll('#studentsBody tr').forEach(tr=>{
      const adm = tr.dataset.adm;
      recs[adm] = tr.querySelector('input[name="status-'+adm+'"]:checked').value;
    });
    attendanceData[date] = attendanceData[date] || {};
    Object.assign(attendanceData[date], recs);
    save('attendanceData', attendanceData).then(()=>alert('Saved'));
  };

  // --- 10. ANALYTICS ---
  $('showAnalytics').onclick = () => {
    const from = $('analyticsFrom').value;
    const to   = $('analyticsTo').value;
    const stats = [];
    Object.entries(attendanceData).forEach(([d,recs])=>{
      if (d < from || d > to) return;
      if (holidayDates.includes(d)) return;
      Object.keys(recs).forEach(adm=>{
        let st = stats.find(x=>x.adm===adm);
        if (!st) stats.push(st={adm, P:0,A:0,Lt:0,HD:0,L:0});
        st[recs[adm]]++;
      });
    });
    stats.forEach(st=>{
      const absDays = st.A;
      const tf = absDays*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
      const tp = (paymentsData[st.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      st.outstanding = tf - tp;
    });
    // render stats 
    function renderAnalytics(stats, from, to) {
    // Apply any active filters
    let filtered = stats;
    if (!analyticsFilterOptions.includes('all')) {
      filtered = stats.filter(st =>
        analyticsFilterOptions.some(opt => {
          switch (opt) {
            case 'registered': return true;
            case 'attendance': return st.total > 0;
            case 'fine':       return (st.A > 0 || st.Lt > 0 || st.L > 0 || st.HD > 0);
            case 'cleared':    return st.outstanding === 0;
            case 'debarred':   return st.status === 'Debarred';
            case 'eligible':   return st.status === 'Eligible';
            default:           return false;
          }
        })
      );
    }

    // Build table header
    const thead = $('analyticsTable').querySelector('thead tr');
    thead.innerHTML = [
      '#', 'Adm#', 'Name', 'P', 'A', 'Lt', 'HD', 'L', 'Total', '%', 'Outstanding', 'Status'
    ].map(h => `<th>${h}</th>`).join('');

    // Populate table body
    const tbody = $('analyticsBody');
    tbody.innerHTML = '';
    filtered.forEach((st, i) => {
      const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${st.adm}</td>
        <td>${st.name}</td>
        <td>${st.P}</td>
        <td>${st.A}</td>
        <td>${st.Lt}</td>
        <td>${st.HD}</td>
        <td>${st.L}</td>
        <td>${st.total}</td>
        <td>${pct}%</td>
        <td>PKR ${st.outstanding}</td>
        <td>${st.status}</td>
      `;
      tbody.appendChild(tr);
    });

    // Show period label
    instr.textContent = `Period: ${from} to ${to}`;
    show(instr, acont, graphs, aacts);

    // Render bar chart (% Present)
    barChart?.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: filtered.map(st => st.name),
        datasets: [{
          label: '% Present',
          data: filtered.map(st => st.total ? (st.P / st.total) * 100 : 0)
        }]
      },
      options: {
        scales: { y: { beginAtZero: true, max: 100 } }
      }
    });

    // Render pie chart (Total Outstanding)
    pieChart?.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: ['Outstanding'],
        datasets: [{
          data: [filtered.reduce((sum, st) => sum + st.outstanding, 0)]
        }]
      }
    });
      
    // Prepare share text
    lastAnalyticsShare = `Analytics (${from} to ${to})\n` +
      filtered.map((st, i) =>
        `${i + 1}. ${st.adm} ${st.name}: ${((st.P / st.total) * 100).toFixed(1)}% / PKR ${st.outstanding}`
      ).join('\n');
  }

  // --- 11. ANALYTICS DOWNLOAD/SHARE ---
  $('downloadAnalytics').onclick = () => {/* ... unchanged ... */};
  $('shareAnalytics').onclick = () => {/* ... unchanged ... */};

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
