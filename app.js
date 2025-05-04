// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // Helpers
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // IndexedDB via idb-keyval
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // State with defaults
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};
  let paymentsData   = await get('paymentsData')   || {};
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;
  let fineRates      = await get('fineRates')      || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct = await get('eligibilityPct') || 75;
  let fineMode       = await get('fineMode')       || 'advance';
  let holidayDates   = await get('holidayDates')   || [];

  let barChart, pieChart;
  const barCtx = $('barChart').getContext('2d');
  const pieCtx = $('pieChart').getContext('2d');

  function genAdmNo() {
    lastAdmNo++;
    save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // 1. SETUP: school name, classes & sections
  async function loadSetup() {
    const schoolName = await get('schoolName') || '';
    $('setupText').textContent = schoolName;
    const classes  = await get('classes')  || ['Class One'];
    const sections = await get('sections') || { 'Class One': ['A'] };

    $('teacherClassSelect').innerHTML =
      `<option disabled>-- Select Class --</option>` +
      classes.map(c => `<option>${c}</option>`).join('');
    $('teacherClassSelect').onchange = () => {
      const cls = $('teacherClassSelect').value;
      $('teacherSectionSelect').innerHTML =
        `<option disabled>-- Select Section --</option>` +
        (sections[cls] || []).map(s => `<option>${s}</option>`).join('');
      renderStudents();
      updateCounters();
    };

    $('saveSetup').onclick = async () => {
      const nm  = prompt('School name?', schoolName) || schoolName;
      const cls = prompt('Classes (CSV)', classes.join(',')) || classes.join(',');
      const sec = prompt('Sections as JSON', JSON.stringify(sections)) ||
                  JSON.stringify(sections);
      await save('schoolName', nm);
      await save('classes', cls.split(',').map(s=>s.trim()));
      await save('sections', JSON.parse(sec));
      loadSetup();
    };

    $('editSetup').onclick = () => {
      hide($('setupDisplay'));
      show($('setupForm'));
    };

    // initial
    hide($('setupDisplay'));
    show($('setupForm'));
    $('teacherClassSelect').dispatchEvent(new Event('change'));
  }
  await loadSetup();

  // 2. FINANCIAL SETTINGS UI initial values
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;
  document.querySelectorAll('input[name="fineMode"]').forEach(r => {
    r.checked = r.value === fineMode;
  });
  $('holidayPickers').innerHTML = '';
  holidayDates.forEach(date => {
    const inp = document.createElement('input');
    inp.type = 'date';
    inp.value = date;
    inp.className = 'holidayDate';
    $('holidayPickers').appendChild(inp);
  });
  if (holidayDates.length) show($('holidayPickers'));

  $('addHolidayDate').onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'date';
    inp.className = 'holidayDate';
    $('holidayPickers').appendChild(inp);
    show($('holidayPickers'));
  };
  $('addHolidayMonth').onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'month';
    inp.className = 'holidayMonth';
    $('holidayPickers').appendChild(inp);
    show($('holidayPickers'));
  };

  $('saveSettings').onclick = async () => {
    fineRates = {
      A : +$('fineAbsent').value,
      Lt: +$('fineLate').value,
      L : +$('fineLeave').value,
      HD: +$('fineHalfDay').value
    };
    eligibilityPct = +$('eligibilityPct').value;
    fineMode = document.querySelector('input[name="fineMode"]:checked').value;

    // collect all holiday dates; expand months into month's days
    const dates = [];
    document.querySelectorAll('.holidayDate').forEach(i => {
      if (i.value) dates.push(i.value);
    });
    document.querySelectorAll('.holidayMonth').forEach(i => {
      if (!i.value) return;
      const [y,m] = i.value.split('-').map(n=>+n);
      const days = new Date(y, m, 0).getDate();
      for(let d=1; d<=days; d++){
        dates.push(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
      }
    });
    holidayDates = Array.from(new Set(dates)).sort();

    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct),
      save('fineMode', fineMode),
      save('holidayDates', holidayDates)
    ]);

    // render summary
    $('settingsCard').innerHTML = `
      <div><strong>Fine Absent:</strong> ${fineRates.A}</div>
      <div><strong>Fine Late:</strong> ${fineRates.Lt}</div>
      <div><strong>Fine Leave:</strong> ${fineRates.L}</div>
      <div><strong>Fine ½Day:</strong> ${fineRates.HD}</div>
      <div><strong>Elig % ≥ :</strong> ${eligibilityPct}%</div>
      <div><strong>Mode:</strong> ${fineMode}</div>
      <div><strong>Holidays:</strong> ${holidayDates.join(', ')}</div>
    `;
    hide($('financialForm'), $('addHolidayDate'), $('addHolidayMonth'));
    show($('settingsCard'), $('editSettings'));
  };

  $('editSettings').onclick = () => {
    hide($('settingsCard'), $('editSettings'));
    show($('financialForm'), $('addHolidayDate'), $('addHolidayMonth'));
  };

  // 3. Render & update counters
  function updateCounters() {
    const cls = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const sectionCount = students.filter(s=>s.cls===cls && s.sec===sec).length;
    $('sectionCount').textContent = sectionCount;
    $('classCount').textContent   = students.filter(s=>s.cls===cls).length;
    $('schoolCount').textContent  = students.length;
  }

  // 4. STUDENT REGISTRATION
  function renderStudents() {
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    $('studentsBody').innerHTML = '';
    let idx = 0;
    students.forEach(s => {
      if (s.cls!==cls || s.sec!==sec) return;
      idx++;
      const tr = document.createElement('tr');
      // compute stats per student...
      const stats = {P:0,A:0,Lt:0,HD:0,L:0};
      Object.entries(attendanceData).forEach(([d, recs])=>{
        if (holidayDates.includes(d)) return;
        const c = recs[s.adm] || 'A';
        stats[c]++;
      });
      if (fineMode==='advance') {
        const now = new Date(), y=now.getFullYear(), m=now.getMonth();
        const daysInMonth = new Date(y, m+1, 0).getDate();
        const holCount = holidayDates.filter(d=>{
          const D=new Date(d); return D.getFullYear()===y&&D.getMonth()===m;
        }).length;
        const expected = daysInMonth - holCount;
        const present = stats.P+stats.Lt+stats.L+stats.HD;
        stats.A = Math.max(0, expected - present);
      }
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt +
                        stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const outstanding = totalFine - paid;
      const totalDays = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct = totalDays ? (stats.P/totalDays*100).toFixed(1) : '0.0';
      const status = (outstanding>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';

      tr.innerHTML = `
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
        <td>${pct}%</td>
        <td>PKR ${outstanding}</td>
        <td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      $('studentsBody').appendChild(tr);
    });
    document.querySelectorAll('.add-payment-btn').forEach(btn=>{
      btn.onclick = ()=> openPaymentModal(btn.dataset.adm);
    });
    updateCounters();
  }

  $('addRegistration').onclick = () => {
    const name = $('studentName').value.trim();
    if (!name) return alert('Enter student name');
    const adm = genAdmNo();
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
    save('students', students).then(() => {
      $('studentName').value = $('parentName').value = '';
      renderStudents();
    });
  };

  // 5. PAYMENT MODAL
  function openPaymentModal(adm) {
    $('paymentAdm').textContent = adm;
    $('paymentAmount').value = '';
    $('paymentDate').value = new Date().toISOString().slice(0,10);
    show($('paymentModal'));
  }
  $('closePayment').onclick = () => hide($('paymentModal'));
  $('savePayment').onclick = async () => {
    const adm = $('paymentAdm').textContent;
    const amt = +$('paymentAmount').value;
    const dt  = $('paymentDate').value;
    paymentsData[adm] = paymentsData[adm] || [];
    paymentsData[adm].push({ amount: amt, date: dt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };

  // 6. MARK ATTENDANCE
  $('loadAttendance').onclick = () => {
    const date = $('attendanceDate').value;
    $('attendanceBody').innerHTML = '';
    students.forEach(s => {
      if (s.cls!==$('teacherClassSelect').value ||
          s.sec!==$('teacherSectionSelect').value) return;
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
      $('attendanceBody').appendChild(div);
    });
    show($('saveAttendance'));
  };
  $('saveAttendance').onclick = async () => {
    const date = $('attendanceDate').value;
    const recs = {};
    document.querySelectorAll('[name^="att-"]').forEach(radio => {
      if (radio.checked) recs[radio.name.split('-')[1]] = radio.value;
    });
    attendanceData[date] = { ...(attendanceData[date]||{}), ...recs };
    await save('attendanceData', attendanceData);
    renderStudents();
    alert('Attendance saved');
  };

  // 7. ANALYTICS
  $('loadAnalytics').onclick = () => {
    const from = $('analyticsFrom').value, to = $('analyticsTo').value;
    const stats = [];
    Object.entries(attendanceData).forEach(([d, recs]) => {
      if (d < from || d > to) return;
      if (holidayDates.includes(d)) return;
      Object.entries(recs).forEach(([adm, st]) => {
        let row = stats.find(x=>x.adm===adm);
        if (!row) {
          const stud = students.find(s=>s.adm===adm) || {};
          row = { adm, name: stud.name||adm, P:0,A:0,Lt:0,HD:0,L:0 };
          stats.push(row);
        }
        row[st]++;
      });
    });
    stats.forEach(r=>{
      r.total = r.P+r.A+r.Lt+r.HD+r.L;
      const fineTotal = r.A*fineRates.A + r.Lt*fineRates.Lt +
                        r.L*fineRates.L + r.HD*fineRates.HD;
      const paid = (paymentsData[r.adm]||[]).reduce((a,p)=>a+p.amount,0);
      r.outstanding = fineTotal - paid;
      r.status = (r.outstanding>0 || (r.total? r.P/r.total*100 : 0) < eligibilityPct)
                  ? 'Debarred' : 'Eligible';
    });

    // render table
    const head = $('analyticsTable').querySelector('thead tr');
    head.innerHTML = ['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Fine','Status']
      .map(h=>`<th>${h}</th>`).join('');
    const body = $('analyticsBody'); body.innerHTML = '';
    stats.forEach((r,i)=>{
      const pct = r.total? (r.P/r.total*100).toFixed(1)+'%' : '0.0%';
      body.innerHTML += `
        <tr>
          <td>${i+1}</td><td>${r.adm}</td><td>${r.name}</td>
          <td>${r.P}</td><td>${r.A}</td><td>${r.Lt}</td>
          <td>${r.HD}</td><td>${r.L}</td><td>${r.total}</td>
          <td>${pct}</td><td>PKR ${r.outstanding}</td><td>${r.status}</td>
        </tr>`;
    });
    $('instructions').textContent = `Period: ${from} to ${to}`;
    show($('instructions'), $('analyticsTable'), $('barChart'), $('pieChart'));

    // charts
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: { labels: stats.map(r=>r.name),
              datasets:[{ label:'% Present', data: stats.map(r=>r.total? r.P/r.total*100:0) }]},
      options:{ scales:{ y:{ beginAtZero:true, max:100 }}}
    });
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: { labels: stats.map(r=>r.name),
              datasets:[{ data: stats.map(r=>r.outstanding) }] }
    });
  };

  // 8. REGISTER (monthly)
  $('loadRegister').onclick = () => {
    const ym = $('registerMonth').value; // "YYYY-MM"
    const [Y,M] = ym.split('-').map(n=>+n);
    const days = new Date(Y, M, 0).getDate();
    $('registerHeader').innerHTML =
      `<th>Adm#</th><th>Name</th>` +
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    $('registerBody').innerHTML = students
      .filter(s=>s.cls===$('teacherClassSelect').value && s.sec===$('teacherSectionSelect').value)
      .map(s => {
        let row = `<td>${s.adm}</td><td>${s.name}</td>`;
        for (let d=1; d<=days; d++){
          const dd = `${ym}-${String(d).padStart(2,'0')}`;
          const c = attendanceData[dd]?.[s.adm] || 'A';
          row += `<td${holidayDates.includes(dd)?' class="holiday"':''}>${c}</td>`;
        }
        return `<tr>${row}</tr>`;
      }).join('');
    show($('registerTableWrapper'));
  };
  $('changeRegister').onclick = () => hide($('registerTableWrapper'));

  // 9. Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }

  // Initial render
  renderStudents();
  updateCounters();
});
