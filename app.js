window.addEventListener('DOMContentLoaded', async () => {
  // --- Universal PDF/share helper ---
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

  // --- DOWNLOAD & SHARE BUTTONS with PDF table‐width fixes ---
  const btnDownloadAnalytics = $('downloadAnalytics');
  if (btnDownloadAnalytics) {
    btnDownloadAnalytics.onclick = async () => {
      const doc = new jspdf.jsPDF();
      doc.setFontSize(18);
      doc.text('Analytics Report', 14, 16);
      doc.setFontSize(12);
      doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 24);
      doc.autoTable({
        startY: 32,
        html: '#analyticsTable',
        tableWidth: 'auto',
        styles: { fontSize: 8, cellWidth: 'wrap' },
        margin: { left: 14, right: 14 }
      });
      const blob = doc.output('blob');
      doc.save('analytics_report.pdf');
      await sharePdf(blob, 'analytics_report.pdf', 'Analytics Report');
    };
  }

  const btnDownloadRegister = $('downloadRegister');
  if (btnDownloadRegister) {
    btnDownloadRegister.onclick = async () => {
      const doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(18);
      doc.text('Attendance Register', 14, 16);
      doc.setFontSize(12);
      doc.text($('setupText').textContent, 14, 24);
      doc.autoTable({
        startY: 32,
        html: '#registerTable',
        tableWidth: 'auto',
        styles: { fontSize: 6, cellWidth: 'wrap' },
        margin: { left: 10, right: 10 }
      });
      const blob = doc.output('blob');
      doc.save('attendance_register.pdf');
      await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
    };
  }

  const btnDownloadRegPDF = $('downloadRegistrationPDF');
  if (btnDownloadRegPDF) {
    btnDownloadRegPDF.onclick = async () => {
      const doc = new jspdf.jsPDF();
      doc.setFontSize(18);
      doc.text('Student List', 14, 16);
      doc.setFontSize(12);
      doc.text($('setupText').textContent, 14, 24);
      doc.autoTable({ startY: 32, html: '#studentsTable', tableWidth: 'auto', styles: { cellWidth: 'wrap' }, margin: { left:14, right:14 } });
      const blob = doc.output('blob');
      doc.save('registration.pdf');
      await sharePdf(blob, 'registration.pdf', 'Student List');
    };
  }

  const btnShareAnalytics = $('shareAnalytics');
  if (btnShareAnalytics) {
    btnShareAnalytics.onclick = () => {
      if (!lastAnalyticsShare) { alert('No analytics to share. Generate a report first.'); return; }
      window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank`);
    };
  }

  // --- SETTINGS: Fines & Eligibility ---
  const formDiv      = $('financialForm');
  const saveSettings = $('saveSettings');
  if (formDiv && saveSettings) {
    const inputs = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map(id => $(id));
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
  }

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
  const btnSaveSetup = $('saveSetup');
  if (btnSaveSetup) {
    btnSaveSetup.onclick = async e => {
      e.preventDefault();
      const sc = $('schoolNameInput').value.trim(),
            cl = $('teacherClassSelect').value,
            sec= $('teacherSectionSelect').value;
      if (!sc || !cl || !sec) { alert('Complete setup'); return; }
      await Promise.all([ save('schoolName', sc), save('teacherClass', cl), save('teacherSection', sec) ]);
      await loadSetup();
    };
  }
  const btnEditSetup = $('editSetup');
  if (btnEditSetup) {
    btnEditSetup.onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  }
  await loadSetup();

  // --- COUNTERS & UTILS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target, step = Math.max(1, target / 100);
      let count = 0;
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

  // --- STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value, tbody = $('studentsBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    let idx = 0;
    students.forEach((s,i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      const stats = { P:0,A:0,Lt:0,HD:0,L:0 };
      Object.entries(attendanceData).forEach(([d,r]) => stats[r[s.adm]||'A']++);
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const outstanding = totalFine - paid;
      const totalDays = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const pct = totalDays ? (stats.P/totalDays)*100 : 0;
      const status = (outstanding>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${outstanding}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false; toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b => b.onclick = () => openPaymentModal(b.dataset.adm));
  }
  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }
  const sb = $('studentsBody');
  if (sb) sb.addEventListener('change', e => { if (e.target.classList.contains('sel')) toggleButtons(); });
  const sal = $('selectAllStudents');
  if (sal) sal.onclick = () => {
    document.querySelectorAll('.sel').forEach(c => c.checked = sal.checked);
    toggleButtons();
  };

  // ... PAYMENT MODAL, ADD/EDIT/DELETE, SAVE REGISTRATION omitted for brevity ...
  // (They remain unchanged, wrapped similarly in guards.)

  // --- MARK ATTENDANCE omitted for brevity ---

  // --- ANALYTICS omitted for brevity (loadAnalytics/renderAnalytics remain same) ---

  // --- Analytics Filter UI fix: disable/enable checkboxes ---
  const filterForm = document.getElementById('analyticsFilterForm');
  if (filterForm) {
    const allRadio        = filterForm.querySelector('input[type="radio"][value="all"]');
    const individualRadio = filterForm.querySelector('input[type="radio"][value="individual"]');
    const filterCheckboxes = Array.from(filterForm.querySelectorAll('input[type="checkbox"]'));

    function updateFilterState() {
      const isAll = allRadio && allRadio.checked;
      filterCheckboxes.forEach(cb => cb.disabled = isAll);
    }
    if (allRadio) {
      allRadio.addEventListener('change', () => {
        if (allRadio.checked) filterCheckboxes.forEach(cb => cb.checked = false);
        updateFilterState();
      });
    }
    if (individualRadio) {
      individualRadio.addEventListener('change', updateFilterState);
    }
    filterCheckboxes.forEach(cb => cb.addEventListener('change', () => {
      if (cb.checked && individualRadio) individualRadio.checked = true;
      updateFilterState();
    }));
  }

  // --- ATTENDANCE REGISTER UI ---
  const loadReg   = $('loadRegister'),
        saveReg   = $('saveRegister'),
        changeReg = $('changeRegister'),
        dlReg     = $('downloadRegister'),
        shReg     = $('shareRegister'),
        rm        = $('registerMonth'),
        rh        = $('registerHeader'),
        rb        = $('registerBody');
  if (loadReg && saveReg && changeReg && dlReg && shReg && rm && rh && rb) {
    const regCodes  = ['A','P','Lt','HD','L'],
          regColors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

    loadReg.onclick = () => {
      const m = rm.value; if (!m) { alert('Pick month'); return; }
      const [y, mm] = m.split('-').map(Number),
            days    = new Date(y, mm, 0).getDate();
      rh.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
        [...Array(days)].map((_,i)=>`<th>${i+1}</th>`).join('');
      rb.innerHTML = '';
      const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
      students.filter(s=>s.cls===cls&&s.sec===sec).forEach((s, idx) => {
        let row = `<td>${idx+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
        for (let d=1; d<=days; d++) {
          const key  = `${m}-${String(d).padStart(2,'0')}`,
                code = (attendanceData[key]||{})[s.adm]||'A',
                style= code==='A'?'':`style="background:${regColors[code]};color:#fff"`;
          row += `<td class="reg-cell" ${style}><span class="status-text">${code}</span></td>`;
        }
        const tr = document.createElement('tr');
        tr.innerHTML = row;
        rb.appendChild(tr);
      });
      rb.querySelectorAll('.reg-cell').forEach(cell => {
        cell.onclick = () => {
          const span = cell.querySelector('.status-text'),
                next = (regCodes.indexOf(span.textContent)+1)%regCodes.length,
                c    = regCodes[next];
          span.textContent = c;
          if (c==='A') { cell.style.background=''; cell.style.color=''; }
          else         { cell.style.background=regColors[c]; cell.style.color='#fff'; }
        };
      });
      show($('registerTableWrapper'), saveReg);
      hide(loadReg, changeReg, dlReg, shReg);
    };

    saveReg.onclick = async () => {
      const m = rm.value, [y,mm] = m.split('-').map(Number),
            days = new Date(y,mm,0).getDate();
      Array.from(rb.children).forEach(tr => {
        const adm = tr.children[1].textContent;
        for (let d=1; d<=days; d++) {
          const code = tr.children[3+d-1].querySelector('.status-text').textContent,
                key  = `${m}-${String(d).padStart(2,'0')}`;
          attendanceData[key] = attendanceData[key]||{};
          attendanceData[key][adm] = code;
        }
      });
      await save('attendanceData', attendanceData);
      hide(saveReg);
      show(changeReg, dlReg, shReg);
    };

    changeReg.onclick = () => {
      hide($('registerTableWrapper'), changeReg, dlReg, shReg, saveReg);
      rh.innerHTML = ''; rb.innerHTML = '';
      show(loadReg);
    };

    dlReg.onclick = async () => {
      const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
      doc.setFontSize(18); doc.text('Attendance Register',14,16);
      doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
      doc.autoTable({ startY:32, html:'#registerTable', tableWidth:'auto', styles:{fontSize:6, cellWidth:'wrap'}, margin:{left:10,right:10} });
      const blob = doc.output('blob');
      doc.save('attendance_register.pdf');
      await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
    };

    shReg.onclick = () => {
      const header = `Attendance Register\n${$('setupText').textContent}`;
      const rows   = Array.from(rb.children).map(tr=>Array.from(tr.children).map(td=>{
        const span = td.querySelector('.status-text');
        return span?span.textContent:td.textContent;
      }).join(' '));
      window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+rows.join('\n'))}`, '_blank');
    };
  }

  // --- Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
