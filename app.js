// app.js (Part 1 of 2)

window.addEventListener('DOMContentLoaded', async () => {
  // --- 1. Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- 2. IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) {
    console.error('idb-keyval not found');
    return;
  }
  const { get, set } = window.idbKeyval;
  const save = (key, val) => set(key, val);

  // --- 3. State & Defaults ---
  let students        = await get('students')        || [];
  let attendanceData  = await get('attendanceData')  || {};
  let finesData       = await get('finesData')       || {};
  let paymentsData    = await get('paymentsData')    || {};
  let lastAdmNo       = await get('lastAdmissionNo') || 0;
  let fineRates       = await get('fineRates')       || { A:50, Lt:20, L:10, HD:0 };
  let eligibilityPct  = await get('eligibilityPct')  || 75;

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 4. DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- 5. SETTINGS: Fines & Eligibility ---
  $('fineAbsent').value      = fineRates.A;
  $('fineLate').value        = fineRates.Lt;
  $('fineLeave').value       = fineRates.L;
  $('fineHalfDay').value     = fineRates.HD;
  $('eligibilityPct').value  = eligibilityPct;
  $('saveSettings').onclick  = async () => {
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
    alert('Fines & eligibility settings saved');
  };

  // --- 6. SETUP: School, Class & Section ---
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
    if (!sc || !cl || !sec) {
      alert('Please complete the setup form');
      return;
    }
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = () => {
    show($('setupForm'));
    hide($('setupDisplay'));
  };
  await loadSetup();

  // --- 7. COUNTERS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target / 100);
      (function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
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
  $('teacherClassSelect').onchange   =
    $('teacherSectionSelect').onchange = () => {
      renderStudents();
      updateCounters();
      resetViews();
    };

  function resetViews() {
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('analyticsContainer'), $('graphs'), $('analyticsActions'),
      $('registerTableWrapper'), $('changeRegister'), $('saveRegister'),
      $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }

  // --- 8. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx = 0;

    students.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      // attendance stats
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(recs =>
        stats[recs[s.adm]||'A']++);
      // compute fines
      const totalFine   = stats.A*fineRates.A + stats.Lt*fineRates.Lt
                        + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const totalPaid   = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      const outstanding = totalFine - totalPaid;
      const totalDays   = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pctPresent  = totalDays ? (stats.P/totalDays)*100 : 0;
      const status = (outstanding>0 || pctPresent<eligibilityPct) ? 'Debarred' : 'Eligible';

      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td>
        <td>${s.occupation}</td><td>${s.address}</td>
        <td>₨ ${outstanding}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });

    $('selectAllStudents').checked = false;
    toggleButtons();
    document.querySelectorAll('.add-payment-btn')
      .forEach(btn => btn.onclick = () => openPaymentModal(btn.dataset.adm));
  }
  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }

  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleButtons();
  });
  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(cb => cb.checked = $('selectAllStudents').checked);
    toggleButtons();
  };

  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n  = $('studentName').value.trim();
    const p  = $('parentName').value.trim();
    const c  = $('parentContact').value.trim();
    const o  = $('parentOccupation').value.trim();
    const a  = $('parentAddress').value.trim();
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    if (!n||!p||!c||!o||!a) { alert('All fields required'); return; }
    if (!/^\d{7,15}$/.test(c)) { alert('Contact must be 7–15 digits'); return; }
    const adm = await genAdmNo();
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec });
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress']
      .forEach(id=>$(id).value='');
  };

  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach(cb => {
      const tr = cb.closest('tr'), i = +tr.dataset.index, s = students[i];
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" checked></td>
        <td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"></td><td>${s.adm}</td>
        <td><input value="${s.parent}"></td>
        <td><input value="${s.contact}"></td>
        <td><input value="${s.occupation}"></td>
        <td><input value="${s.address}"></td><td colspan="3"></td>
      `;
    });
    hide($('editSelected'));
    show($('doneEditing'));
  };

  $('doneEditing').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach(tr => {
      const inputs = [...tr.querySelectorAll('input:not(.sel)')];
      if (inputs.length===5) {
        const [n,p,c,o,a] = inputs.map(i=>i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(s=>s.adm===adm);
        if (idx>-1) students[idx] = { ...students[idx], name:n,parent:p,contact:c,occupation:o,address:a };
      }
    });
    await save('students', students);
    hide($('doneEditing'));
    show($('editSelected'),$('deleteSelected'),$('saveRegistration'));
    renderStudents(); updateCounters();
  };

  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected?')) return;
    const toDel = [...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students = students.filter((_,i)=>!toDel.includes(i));
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
  };

  $('saveRegistration').onclick = async () => {
    if (!$('doneEditing').classList.contains('hidden')) { alert('Finish editing'); return; }
    await save('students', students);
    hide($('#student-registration .row-inline'), $('editSelected'), $('deleteSelected'), $('selectAllStudents'), $('saveRegistration'));
    show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };

  $('editRegistration').onclick = () => {
    show($('#student-registration .row-inline'), $('selectAllStudents'), $('editSelected'), $('deleteSelected'), $('saveRegistration'));
    hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  
  // --- 9. MARK ATTENDANCE ---
  let currentDate = null;
  $('loadAttendance').onclick = () => {
    currentDate = $('dateInput').value;
    if (!currentDate) { alert('Select a date'); return; }
    renderAttendance(currentDate);
    show($('saveAttendance'), $('resetAttendance'));
  };

  function renderAttendance(date) {
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const recs = attendanceData[date] || {};
    const container = $('attendanceBody');
    container.innerHTML = '';
    students.filter(s => s.cls === cl && s.sec === sec).forEach(s => {
      const row = document.createElement('div');
      row.classList.add('attendance-row');
      row.innerHTML = `
        <span class="att-name">${s.name}</span>
        ${['P','A','Lt','HD','L'].map(code =>
          `<button class="att-btn" data-adm="${s.adm}" data-code="${code}">${code}</button>`
        ).join('')}
      `;
      container.appendChild(row);
      row.querySelectorAll('.att-btn').forEach(btn => {
        if (recs[s.adm] === btn.dataset.code) btn.classList.add('selected');
        btn.onclick = () => {
          row.querySelectorAll('.att-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          recs[s.adm] = btn.dataset.code;
          updateAttendanceSummary();
        };
      });
    });
    show($('attendanceBody'), $('attendanceSummary'));
    updateAttendanceSummary();
  }

  function updateAttendanceSummary() {
    const recs = attendanceData[currentDate] || {};
    const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
    Object.values(recs).forEach(c => stats[c]++);
    const summary = `Attendance Summary (${currentDate}):\nPresent: ${stats.P}\nAbsent: ${stats.A}\nLate: ${stats.Lt}\nHalf-Day: ${stats.HD}\nLeave: ${stats.L}`;
    $('attendanceSummary').textContent = summary;
    show($('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'));
  }

  $('saveAttendance').onclick = async () => {
    if (!currentDate) return;
    const recs = attendanceData[currentDate] || {};
    students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value)
      .forEach(s => { if (!recs[s.adm]) recs[s.adm] = 'A'; });
    attendanceData[currentDate] = recs;
    await save('attendanceData', attendanceData);
    alert('Attendance saved');
  };

  $('resetAttendance').onclick = () => {
    if (currentDate) renderAttendance(currentDate);
  };

  $('downloadAttendancePDF').onclick = () => {
    if (!currentDate) return;
    const doc = new jspdf.jsPDF();
    doc.text(`Attendance – ${currentDate}`, 14, 20);
    const head = [['Name','Status']];
    const body = [];
    const recs = attendanceData[currentDate] || {};
    students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value)
      .forEach(s => body.push([s.name, recs[s.adm] || 'A']));
    doc.autoTable({ head, body, startY: 30 });
    doc.save(`Attendance_${currentDate}.pdf`);
  };

  $('shareAttendanceSummary').onclick = () => {
    navigator.clipboard.writeText($('attendanceSummary').textContent)
      .then(() => alert('Attendance summary copied'));
  };

  // --- 10. ANALYTICS ---
  let barChart, pieChart;
  $('loadAnalytics').onclick = () => {
    // filter records
    const tgt = $('analyticsTarget').value;
    const type = $('analyticsType').value;
    let records = Object.entries(attendanceData).flatMap(([date,recs]) =>
      Object.entries(recs).map(([adm,code]) => {
        const s = students.find(x => x.adm === adm);
        if (!s) return null;
        if (tgt==='class' && s.cls!==$('teacherClassSelect').value) return null;
        if (tgt==='section' && s.sec!==$('analyticsSectionSelect').value) return null;
        return { date, adm, name: s.name, code };
      })
    ).filter(x=>x);
    // period filter
    if (type==='date') {
      const d = $('analyticsDate').value;
      records = records.filter(r=>r.date===d);
    } else if (type==='month') {
      const m = $('analyticsMonth').value;
      records = records.filter(r=>r.date.startsWith(m));
    } else if (type==='semester') {
      const start = $('semesterStart').value;
      const end = $('semesterEnd').value;
      records = records.filter(r=>r.date>=start && r.date<=end);
    } else if (type==='year') {
      const y = $('yearStart').value;
      records = records.filter(r=>r.date.startsWith(y));
    }
    if (tgt==='student') {
      const q = $('analyticsSearch').value.trim().toLowerCase();
      records = records.filter(r=>r.adm===q || r.name.toLowerCase().includes(q));
    }
    // build table
    const thead = document.querySelector('#analyticsTable thead tr');
    const tbody = $('analyticsBody');
    thead.innerHTML = '<th>Date</th><th>Adm#</th><th>Name</th><th>Status</th>';
    tbody.innerHTML = '';
    records.forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.date}</td><td>${r.adm}</td><td>${r.name}</td><td>${r.code}</td>`;
      tbody.appendChild(tr);
    });
    // stats for chart
    const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
    records.forEach(r=>stats[r.code]++);
    // render charts
    const bctx = document.getElementById('barChart').getContext('2d');
    if (barChart) barChart.destroy();
    barChart = new Chart(bctx,{ type:'bar', data:{
      labels:['P','A','Lt','HD','L'],
      datasets:[{ label:'Count', data:[stats.P,stats.A,stats.Lt,stats.HD,stats.L] }]
    }, options:{ responsive:true, maintainAspectRatio:false }});
    const pctx = document.getElementById('pieChart').getContext('2d');
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pctx,{ type:'pie', data:{
      labels:['P','A','Lt','HD','L'],
      datasets:[{ data:[stats.P,stats.A,stats.Lt,stats.HD,stats.L] }]
    }, options:{ responsive:true, maintainAspectRatio:false }});
    show($('analyticsContainer'), $('graphs'), $('analyticsActions'));
  };

  $('downloadAnalytics').onclick = () => {
    const doc = new jspdf.jsPDF();
    const head = [['Date','Adm#','Name','Status']];
    const body = Array.from(document.querySelectorAll('#analyticsBody tr')).map(tr =>
      [...tr.children].map(td=>td.textContent)
    );
    doc.autoTable({ head, body, startY:20 });
    let y = doc.lastAutoTable.finalY + 10;
    const barImg = document.getElementById('barChart').toDataURL('image/png');
    doc.addImage(barImg,'PNG',14,y,180,60);
    y += 65;
    const pieImg = document.getElementById('pieChart').toDataURL('image/png');
    doc.addImage(pieImg,'PNG',14,y,90,60);
    doc.save('Analytics_Report.pdf');
  };

  $('shareAnalytics').onclick = () => {
    const rows = Array.from(document.querySelectorAll('#analyticsBody tr')).map(tr =>
      [...tr.children].map(td=>td.textContent).join(' | ')
    ).join('\n');
    const header = 'Date | Adm# | Name | Status';
    navigator.clipboard.writeText(header+'\n'+rows)
      .then(()=>alert('Analytics data copied'));
  };

  // --- 11. ATTENDANCE REGISTER ---
  $('loadRegister').onclick = () => {
    const month = $('registerMonth').value;
    if (!month) { alert('Select month'); return; }
    const [year,mon] = month.split('-').map(Number);
    const days = new Date(year,mon,0).getDate();
    const headerRow = $('registerHeader');
    headerRow.innerHTML = '<th>Name</th>';
    for (let d=1; d<=days; d++){
      const th = document.createElement('th'); th.textContent = d;
      headerRow.appendChild(th);
    }
    const body = $('registerBody'); body.innerHTML = '';
    students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value)
      .forEach(s=>{
        const tr = document.createElement('tr');
        let cells = `<td>${s.name}</td>`;
        for (let d=1; d<=days; d++){
          const date = `${month}-${String(d).padStart(2,'0')}`;
          const code = attendanceData[date]?.[s.adm]||'-';
          cells += `<td>${code}</td>`;
        }
        tr.innerHTML = cells; body.appendChild(tr);
      });
    show($('registerTableWrapper'), $('changeRegister'), $('downloadRegister'), $('shareRegister'));
    hide($('loadRegister'));
  };

  $('downloadRegister').onclick = () => {
    const doc = new jspdf.jsPDF('l','pt','A4');
    doc.text('Attendance Register',40,50);
    const head = [Array.from(document.querySelectorAll('#registerHeader th')).map(th=>th.textContent)];
    const body = Array.from(document.querySelectorAll('#registerBody tr')).map(tr=>
      [...tr.children].map(td=>td.textContent)
    );
    doc.autoTable({ head, body, startY:70, styles:{ fontSize:8 }});
    doc.save('Attendance_Register.pdf');
  };

  $('shareRegister').onclick = () => {
    const headers = Array.from(document.querySelectorAll('#registerHeader th')).map(th=>th.textContent);
    const rows = Array.from(document.querySelectorAll('#registerBody tr')).map(tr=>
      [...tr.children].map(td=>td.textContent).join(' | ')
    );
    navigator.clipboard.writeText(headers.join(' | ')+'\n'+rows.join('\n'))
      .then(()=>alert('Register copied'));
  };

  // --- 12. PAYMENT MODAL ---
  window.openPaymentModal = adm => {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
    $('savePayment').dataset.adm = adm;
  };
  $('savePayment').onclick = async () => {
    const adm = $('savePayment').dataset.adm;
    const amt = Number($('paymentAmount').value);
    if (!amt) { alert('Enter amount'); return; }
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
    alert('Payment recorded');
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));

}); // end DOMContentLoaded
                        
