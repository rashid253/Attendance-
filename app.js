// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- IndexedDB via idb-keyval ---
  if (!window.idbKeyval) {
    console.error('idb-keyval not found');
    return;
  }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // --- State & Defaults ---
  let students        = await get('students')        || [];
  let attendanceData  = await get('attendanceData')  || {};
  let paymentsData    = await get('paymentsData')    || {};
  let lastAdmNo       = await get('lastAdmissionNo') || 0;
  let fineRates       = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct  = await get('eligibilityPct')  || 75;

  let barChart, pieChart;
  const barCtx = $('barChart')?.getContext('2d');
  const pieCtx = $('pieChart')?.getContext('2d');

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 1. SETUP ---
  async function loadSetup() {
    const schoolName = await get('schoolName') || '';
    $('setupText').textContent = schoolName;

    const classes  = await get('classes')  || ['Class One'];
    const sections = await get('sections') || { 'Class One': ['A'] };

    $('teacherClassSelect').innerHTML =
      `<option disabled selected>-- Select Class --</option>` +
      classes.map(c => `<option>${c}</option>`).join('');
    $('teacherClassSelect').onchange = () => {
      const cls = $('teacherClassSelect').value;
      $('teacherSectionSelect').innerHTML =
        `<option disabled selected>-- Select Section --</option>` +
        (sections[cls] || []).map(s => `<option>${s}</option>`).join('');
      renderStudents();
      updateCounters();
    };

    $('saveSetup').onclick = async () => {
      const nm  = prompt('School name?', schoolName) || schoolName;
      const cls = prompt('Classes (comma-separated)', classes.join(',')) || classes.join(',');
      const sec = prompt('Sections as JSON', JSON.stringify(sections)) ||
                  JSON.stringify(sections);
      await Promise.all([
        save('schoolName', nm),
        save('classes', cls.split(',').map(s => s.trim())),
        save('sections', JSON.parse(sec))
      ]);
      loadSetup();
    };

    $('editSetup').onclick = () => {
      hide($('setupDisplay'));
      show($('setupForm'));
    };

    hide($('setupDisplay'));
    show($('setupForm'));
  }
  await loadSetup();

  // --- 2. FINANCIAL SETTINGS UI init ---
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  $('saveSettings').onclick = async () => {
    fineRates = {
      A : +$('fineAbsent').value,
      Lt: +$('fineLate').value,
      L : +$('fineLeave').value,
      HD: +$('fineHalfDay').value
    };
    eligibilityPct = +$('eligibilityPct').value;

    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);

    $('settingsCard').innerHTML = `
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
      </div>`;
    hide($('financialForm'), $('saveSettings'));
    show($('settingsCard'), $('editSettings'));
  };

  $('editSettings').onclick = () => {
    hide($('settingsCard'), $('editSettings'));
    show($('financialForm'), $('saveSettings'));
  };

  // --- 3. COUNTERS ---
  function updateCounters() {
    const cls = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const sectionCount = students.filter(s => s.cls === cls && s.sec === sec).length;
    $('sectionCount').textContent = sectionCount;
    $('classCount').textContent   = students.filter(s => s.cls === cls).length;
    $('schoolCount').textContent  = students.length;
  }

  // --- 4. STUDENT REGISTRATION & STATUS/FINE CALCULATION ---
  function renderStudents() {
    const cls = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx = 0;

    students.forEach(s => {
      if (s.cls !== cls || s.sec !== sec) return;
      idx++;
      // count only days teacher marked attendance
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.entries(attendanceData).forEach(([date, recs]) => {
        if (!(s.adm in recs)) return;          // skip if no record
        const code = recs[s.adm];
        stats[code] = (stats[code] || 0) + 1;
      });
      const totalDays = stats.P + stats.A + stats.Lt + stats.H + stats.HD + stats.L || 0;
      // calculate total fine
      const totalFine =
        stats.A  * fineRates.A   +
        stats.Lt * fineRates.Lt  +
        stats.L  * fineRates.L   +
        stats.HD * fineRates.HD;
      // subtract payments
      const paid = (paymentsData[s.adm] || [])
        .reduce((sum, p) => sum + p.amount, 0);
      const outstanding = totalFine - paid;
      // attendance percentage
      const pct = totalDays ? (stats.P / totalDays) * 100 : 0;
      const status = (outstanding > 0 || pct < eligibilityPct) ? 'Debarred' : 'Eligible';

      const tr = document.createElement('tr');
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

    document.querySelectorAll('.add-payment-btn')
      .forEach(btn => btn.onclick = () => openPaymentModal(btn.dataset.adm));

    updateCounters();
  }

  // registration handlers
  $('addRegistration').onclick = () => {
    // show/hide registration form controls as needed...
  };
  $('saveRegistration').onclick = async () => {
    const name = $('studentName').value.trim();
    if (!name) return alert('Name required');
    const adm = await genAdmNo();
    const obj = {
      name, adm,
      parent: $('parentName').value.trim(),
      contact: $('parentContact').value.trim(),
      occupation: $('parentOccupation').value.trim(),
      address: $('parentAddress').value.trim(),
      cls: $('teacherClassSelect').value,
      sec: $('teacherSectionSelect').value
    };
    students.push(obj);
    await save('students', students);
    renderStudents();
  };

  // --- 5. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('paymentAdm').textContent = adm;
    $('paymentAmount').value = '';
    $('paymentDate').value = new Date().toISOString().slice(0,10);
    show($('paymentModal'));
  }
  $('closePayment').onclick = () => hide($('paymentModal'));
  $('savePayment').onclick = async () => {
    const adm = $('paymentAdm').textContent;
    const amount = +$('paymentAmount').value;
    const date = $('paymentDate').value;
    paymentsData[adm] = paymentsData[adm] || [];
    paymentsData[adm].push({ amount, date });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };

  // --- 6. MARK ATTENDANCE ---
  $('loadAttendance').onclick = () => {
    const date = $('attendanceDate').value;
    const container = $('attendanceBody');
    container.innerHTML = '';
    students.forEach(s => {
      if (s.cls !== $('teacherClassSelect').value ||
          s.sec !== $('teacherSectionSelect').value) return;
      const recs = attendanceData[date] || {};
      const sel = recs[s.adm] || 'A';
      const div = document.createElement('div');
      div.className = 'row-inline';
      div.innerHTML = `
        <span>${s.name}</span>
        <label><input type="radio" name="att-${s.adm}" value="P" ${sel==='P'?'checked':''}/>P</label>
        <label><input type="radio" name="att-${s.adm}" value="Lt" ${sel==='Lt'?'checked':''}/>Lt</label>
        <label><input type="radio" name="att-${s.adm}" value="L" ${sel==='L'?'checked':''}/>L</label>
        <label><input type="radio" name="att-${s.adm}" value="HD" ${sel==='HD'?'checked':''}/>HD</label>
        <label><input type="radio" name="att-${s.adm}" value="A" ${sel==='A'?'checked':''}/>A</label>
      `;
      container.appendChild(div);
    });
    show($('saveAttendance'));
  };
  $('saveAttendance').onclick = async () => {
    const date = $('attendanceDate').value;
    const recs = {};
    document.querySelectorAll('[name^="att-"]').forEach(radio => {
      if (radio.checked) {
        const adm = radio.name.split('-')[1];
        recs[adm] = radio.value;
      }
    });
    attendanceData[date] = recs;
    await save('attendanceData', attendanceData);
    renderStudents();
  };

  // --- 7. ANALYTICS ---
  $('loadAnalytics').onclick = () => {
    const from = $('analyticsFrom').value;
    const to   = $('analyticsTo').value;
    const stats = [];
    Object.entries(attendanceData).forEach(([d, recs]) => {
      if (d < from || d > to) return;
      Object.entries(recs).forEach(([adm, st]) => {
        let row = stats.find(x => x.adm === adm);
        if (!row) {
          const stu = students.find(s => s.adm === adm) || {};
          row = { adm, name: stu.name||adm, P:0, A:0, Lt:0, HD:0, L:0 };
          stats.push(row);
        }
        row[st]++;
      });
    });
    // compute totals and fines
    stats.forEach(r => {
      r.total = r.P + r.A + r.Lt + r.HD + r.L;
      const fineTotal = r.A*fineRates.A + r.Lt*fineRates.Lt + r.L*fineRates.L + r.HD*fineRates.HD;
      const paid = (paymentsData[r.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      r.outstanding = fineTotal - paid;
      const pct = r.total ? (r.P/r.total)*100 : 0;
      r.status = (r.outstanding>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';
    });
    // render table
    const thead = $('analyticsTable').querySelector('thead tr');
    thead.innerHTML = ['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Fine','Status']
      .map(h => `<th>${h}</th>`).join('');
    const tbody = $('analyticsBody');
    tbody.innerHTML = '';
    stats.forEach((r,i) => {
      const pct = r.total?((r.P/r.total)*100).toFixed(1)+'%':'0.0%';
      tbody.innerHTML += `
        <tr>
          <td>${i+1}</td><td>${r.adm}</td><td>${r.name}</td>
          <td>${r.P}</td><td>${r.A}</td><td>${r.Lt}</td><td>${r.HD}</td><td>${r.L}</td>
          <td>${r.total}</td><td>${pct}</td><td>PKR ${r.outstanding}</td><td>${r.status}</td>
        </tr>`;
    });
    // charts
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: stats.map(r => r.name),
        datasets: [{ label: '% Present', data: stats.map(r => r.total?r.P/r.total*100:0) }]
      },
      options: { scales: { y: { beginAtZero:true, max:100 } } }
    });
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: stats.map(r => r.name),
        datasets: [{ data: stats.map(r => r.outstanding) }]
      }
    });
    show($('instructions'), $('analyticsTable'), $('barChart'), $('pieChart'));
  };

  // --- 8. ATTENDANCE REGISTER ---
  $('loadRegister').onclick = () => {
    const ym = $('registerMonth').value.split('-');
    const y = +ym[0], m = +ym[1];
    const days = new Date(y, m, 0).getDate();
    $('registerHeader').innerHTML =
      `<th>Adm#</th><th>Name</th>` +
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    $('registerBody').innerHTML = students
      .filter(s=>s.cls===$('teacherClassSelect').value && s.sec===$('teacherSectionSelect').value)
      .map(s => {
        let row = `<td>${s.adm}</td><td>${s.name}</td>`;
        for (let d=1; d<=days; d++){
          const dd = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const c = attendanceData[dd]?.[s.adm] || '';
          row += `<td>${c}</td>`;
        }
        return `<tr>${row}</tr>`;
      }).join('');
    show($('registerTableWrapper'));
  };
  $('changeRegister').onclick = () => hide($('registerTableWrapper'));

  // --- 9. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }

  // initial render
  renderStudents();
  updateCounters();
});
