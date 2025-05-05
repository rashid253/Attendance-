// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- 0. Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- 1. IndexedDB helpers (idb-keyval) ---
  const { get, set } = window.idbKeyval;
  const save = (key, val) => set(key, val);

  // --- 2. State & Defaults ---
  let students       = await get('students')        || [];
  let attendanceData = await get('attendanceData')  || {};
  let paymentsData   = await get('paymentsData')    || {};
  let lastAdmNo      = await get('lastAdmissionNo') || 0;
  let { A: fineA=50, Lt: fineLt=20, L: fineL=10, HD: fineHD=30 } = await get('fineRates') || {};
  let eligibilityPct = await get('eligibilityPct')  || 75;
  let analyticsFilterOptions = ['all'];
  let analyticsDownloadMode  = 'combined';

  // --- 3. Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));
  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 4. FINANCIAL SETTINGS UI setup ---
  const financialSection = $('financial-settings');
  const settingsSummary = document.createElement('div');
  settingsSummary.id = 'settingsSummary';
  settingsSummary.className = 'card hidden';
  const editSettingsBtn = document.createElement('button');
  editSettingsBtn.id = 'editSettings';
  editSettingsBtn.className = 'btn no-print hidden';
  editSettingsBtn.innerHTML = '<i class="fas fa-edit"></i> Edit Settings';
  financialSection.appendChild(settingsSummary);
  financialSection.appendChild(editSettingsBtn);

  // initialize form values
  $('fineAbsent').value    = fineA;
  $('fineLate').value      = fineLt;
  $('fineLeave').value     = fineL;
  $('fineHalfDay').value   = fineHD;
  $('eligibilityPct').value = eligibilityPct;

  $('saveSettings').onclick = async () => {
    fineA         = Number($('fineAbsent').value)   || 0;
    fineLt        = Number($('fineLate').value)     || 0;
    fineL         = Number($('fineLeave').value)    || 0;
    fineHD        = Number($('fineHalfDay').value)  || 0;
    eligibilityPct = Number($('eligibilityPct').value) || 0;
    await Promise.all([
      save('fineRates', { A: fineA, Lt: fineLt, L: fineL, HD: fineHD }),
      save('eligibilityPct', eligibilityPct)
    ]);
    hide($('financialForm'));
    settingsSummary.innerHTML = `
      <p><strong>Fine – Absent:</strong> PKR ${fineA}</p>
      <p><strong>Fine – Late:</strong> PKR ${fineLt}</p>
      <p><strong>Fine – Leave:</strong> PKR ${fineL}</p>
      <p><strong>Fine – Half-Day:</strong> PKR ${fineHD}</p>
      <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
    `;
    show(settingsSummary, editSettingsBtn);
  };

  editSettingsBtn.onclick = () => {
    hide(settingsSummary, editSettingsBtn);
    show($('financialForm'));
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
      $('setupText').textContent      = `${sc} | ${cl} – Section ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderStudents(); updateCounters(); resetViews();
    }
  }

  $('saveSetup').onclick = async () => {
    const sc  = $('schoolNameInput').value.trim();
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!sc || !cl || !sec) return alert('Please complete setup.');
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

  // --- 6. COUNTERS & VIEWS ---
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
    $('sectionCount').dataset.target = students.filter(s => s.cls === cl && s.sec === sec).length;
    $('classCount').dataset.target   = students.filter(s => s.cls === cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }

  function resetViews() {
    [
      $('attendanceBody'),
      $('saveAttendance'),
      $('resetAttendance'),
      $('attendanceSummary'),
      $('downloadAttendancePDF'),
      $('shareAttendanceSummary'),
      $('instructions'),
      $('analyticsContainer'),
      $('graphs'),
      $('analyticsActions'),
      $('registerTableWrapper'),
      $('changeRegister'),
      $('saveRegister'),
      $('downloadRegister'),
      $('shareRegister')
    ].forEach(el => hide(el));
  }

  $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- 7. STUDENT REGISTRATION & ACTIONS ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx = 0;
    students.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => {
        const c = rec[s.adm] || 'A';
        stats[c]++;
      });
      const totalFine = stats.A*fineA + stats.Lt*fineLt + stats.L*fineL + stats.HD*fineHD;
      const paid = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      const outstanding = totalFine - paid;
      const totalDays = Object.values(stats).reduce((a,b)=>a+b,0);
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
        <td>${status}</td>
        <td><button class="add-payment" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
  }

  $('addStudent').onclick = async () => {
    const n   = $('studentName').value.trim();
    const p   = $('parentName').value.trim();
    const c   = $('parentContact').value.trim();
    const o   = $('parentOccupation').value.trim();
    const a   = $('parentAddress').value.trim();
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!n||!p||!c||!o||!a) return alert('All fields are required.');
    if (!/^\d{7,15}$/.test(c)) return alert('Contact must be 7–15 digits.');
    const adm = await genAdmNo();
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec });
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress']
      .forEach(id => $(id).value = '');
  };

  // selection toggles
  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(c=>c.checked=$('selectAllStudents').checked);
  };

  // edit/delete actions
  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach(cb => {
      const tr = cb.closest('tr');
      [2,4,5,6,7].forEach(i => {
        const td = tr.children[i];
        td.innerHTML = `<input value="${td.textContent}" style="width:100%">`;
      });
    });
    hide($('editSelected'));
    show($('doneEditing'));
  };

  $('doneEditing').onclick = async () => {
    document.querySelectorAll('.sel:checked').forEach(cb => {
      const tr = cb.closest('tr');
      const idx = tr.dataset.index;
      const inputs = tr.querySelectorAll('input');
      [ 'name','parent','contact','occupation','address' ].forEach((field,i) => {
        students[idx][field] = inputs[i].value;
      });
    });
    await save('students', students);
    renderStudents(); updateCounters();
    show($('editSelected'));
    hide($('doneEditing'));
  };

  $('deleteSelected').onclick = async () => {
    const toRemove = Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb => +cb.closest('tr').dataset.index)
      .sort((a,b)=>b-a);
    toRemove.forEach(i=>students.splice(i,1));
    await save('students', students);
    renderStudents(); updateCounters();
  };

  $('saveRegistration').onclick = async () => {
    await save('students', students);
    show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
  };
  $('editRegistration').onclick = () => {
    renderStudents();
    hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
  };
  $('shareRegistration').onclick = async () => {
    // same as download but share only
    const doc = new jsPDF();
    doc.autoTable({ html: '#studentsTable' });
    const blob = doc.output('blob');
    if (navigator.canShare({ files:[new File([blob],'Registration.pdf',{type:'application/pdf'})] })) {
      await navigator.share({ files:[new File([blob],'Registration.pdf',{type:'application/pdf'})], title:'Attendance Registration' });
    }
  };

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  document.body.addEventListener('click', e => {
    if (e.target.closest('.add-payment')) {
      openPaymentModal(e.target.closest('.add-payment').dataset.adm);
    }
  });
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent;
    const amt = Number($('paymentAmount').value)||0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ amount:amt, date: new Date().toISOString() });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));
  $('paymentModalClose').onclick = () => hide($('paymentModal'));

  // --- 9. ATTENDANCE & PDF DOWNLOAD + SHARE ---
  function renderAttendance(date) {
    const container = $('attendanceBody');
    container.innerHTML = '';
    const table = document.createElement('table');
    table.id = 'attendanceTable';
    table.innerHTML = `
      <thead>
        <tr><th>#</th><th>Name</th><th>Adm#</th>
          <th>P</th><th>Lt</th><th>L</th><th>A</th><th>HD</th>
        </tr>
      </thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    let idx = 0;
    students.forEach(s=>{
      if (s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value) {
        idx++;
        const rec = attendanceData[date]||{};
        const prev = rec[s.adm]||'A';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
          ${['P','Lt','L','A','HD'].map(code=>`
            <td><input type="radio" name="att_${s.adm}" value="${code}"
              ${prev===code?'checked':''} data-adm="${s.adm}"></td>
          `).join('')}`;
        tbody.appendChild(tr);
      }
    });
    container.appendChild(table);
    show($('attendanceBody'), $('saveAttendance'), $('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'));
  }
  $('loadAttendance').onclick = () => {
    const d = $('dateInput').value;
    if (!d) return alert('Please select a date.');
    renderAttendance(d);
  };
  $('saveAttendance').onclick = async () => {
    const d = $('dateInput').value;
    attendanceData[d] = {};
    document.querySelectorAll('#attendanceTable input:checked').forEach(r=>{
      attendanceData[d][r.dataset.adm] = r.value;
    });
    await save('attendanceData', attendanceData);
    alert('Saved');
  };
  $('resetAttendance').onclick = () => {
    const d = $('dateInput').value;
    if (d) renderAttendance(d);
  };
  $('downloadAttendancePDF').onclick = async () => {
    const doc = new jsPDF();
    doc.autoTable({ html: '#attendanceTable' });
    doc.save('Attendance.pdf');
    const blob = doc.output('blob');
    if (navigator.canShare({ files:[new File([blob],'Attendance.pdf',{type:'application/pdf'})] })) {
      await navigator.share({ files:[new File([blob],'Attendance.pdf',{type:'application/pdf'})], title:'Daily Attendance' });
    }
  };
  $('shareAttendanceSummary').onclick = $('downloadAttendancePDF').onclick;

  // --- 10. ANALYTICS ---
  $('analyticsFilterBtn').onclick = () => show($('analyticsFilterModal'));
  $('analyticsFilterClose').onclick = () => hide($('analyticsFilterModal'));
  $('applyAnalyticsFilter').onclick = () => {
    analyticsFilterOptions = Array.from(document.querySelectorAll('#analyticsFilterForm input[type=checkbox]:checked')).map(cb=>cb.value);
    analyticsDownloadMode  = document.querySelector('#analyticsFilterForm input[name=downloadMode]:checked').value;
    hide($('analyticsFilterModal'));
  };
  function computeAnalytics() {
    // TODO: fill #analyticsTable, render charts in #barChart and #pieChart
  }
  $('loadAnalytics').onclick = () => {
    computeAnalytics();
    show($('analyticsContainer'), $('graphs'), $('analyticsActions'));
  };
  $('resetAnalytics').onclick = () => {
    hide($('analyticsContainer'), $('graphs'), $('analyticsActions'));
  };
  $('downloadAnalytics').onclick = async () => {
    const doc = new jsPDF();
    doc.autoTable({ html: '#analyticsTable' });
    doc.save('Analytics.pdf');
    const blob = doc.output('blob');
    if (navigator.canShare({ files:[new File([blob],'Analytics.pdf',{type:'application/pdf'})] })) {
      await navigator.share({ files:[new File([blob],'Analytics.pdf',{type:'application/pdf'})], title:'Attendance Analytics' });
    }
  };
  $('shareAnalytics').onclick = $('downloadAnalytics').onclick;

  // --- 11. MONTHLY REGISTER ---
  function loadRegister(month) {
    // TODO: populate #registerTable from attendanceData for given month
  }
  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value;
    if (!m) return alert('Please select a month.');
    loadRegister(m);
    show($('registerTableWrapper'), $('changeRegister'), $('saveRegister'));
  };
  $('changeRegister').onclick = () => {
    hide($('registerTableWrapper'), $('changeRegister'), $('saveRegister'));
  };
  $('saveRegister').onclick = async () => {
    const m = $('registerMonth').value;
    // placeholder save
    await save(`register_${m}`, {/* ... */});
    alert('Register saved');
  };
  $('downloadRegister').onclick = async () => {
    const doc = new jsPDF();
    doc.autoTable({ html: '#registerTable' });
    doc.save('MonthlyRegister.pdf');
    const blob = doc.output('blob');
    if (navigator.canShare({ files:[new File([blob],'MonthlyRegister.pdf',{type:'application/pdf'})] })) {
      await navigator.share({ files:[new File([blob],'MonthlyRegister.pdf',{type:'application/pdf'})], title:'Monthly Register' });
    }
  };
  $('shareRegister').onclick = $('downloadRegister').onclick;

});
