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
  if (!window.idbKeyval) {
    console.error('idb-keyval not found');
    return;
  }
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

    doc.setFontSize(18);
    doc.text('Registered Students', 14, 16);
    doc.setFontSize(10);
    doc.text(`Date: ${today}`, pageWidth - 14, 16, { align: 'right' });
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 30, html: '#studentsTable' });
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
  const formDiv      = $('financialForm'), saveSettings = $('saveSettings'),
        inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map(id => $(id)),
        settingsCard = document.createElement('div'), editSettings = document.createElement('button');
  settingsCard.id = 'settingsCard'; settingsCard.className = 'card hidden';
  editSettings.id = 'editSettings'; editSettings.className = 'btn no-print hidden'; editSettings.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard); formDiv.parentNode.appendChild(editSettings);

  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveSettings.onclick = async () => {
    fineRates = { A: Number($('fineAbsent').value) || 0, Lt: Number($('fineLate').value) || 0,
                  L:  Number($('fineLeave').value)  || 0, HD: Number($('fineHalfDay').value)|| 0 };
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
      hide($('setupForm')); show($('setupDisplay'));
      renderStudents(); updateCounters(); resetViews();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc  = $('schoolNameInput').value.trim();
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!sc||!cl||!sec) { alert('Complete setup'); return; }
    await Promise.all([ save('schoolName', sc), save('teacherClass', cl), save('teacherSection', sec) ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- 4. COUNTERS & UTILS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target/100);
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
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('instructions'), $('analyticsContainer'), $('graphs'),
      $('analyticsActions'), $('registerTableWrapper'),
      $('changeRegister'), $('saveRegister'), $('downloadRegister'), $('shareRegister')
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
    students.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => rec[s.adm] && stats[rec.adm]++);
      const total    = Object.values(stats).reduce((a,b)=>a+b,0);
      const totalFine= stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid     = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out      = totalFine - paid;
      const pct      = total ? stats.P/total*100 : 0;
      const status   = (out>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';

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
  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(c => c.checked = $('selectAllStudents').checked);
    toggleButtons();
  };

  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n   = $('studentName').value.trim();
    const p   = $('parentName').value.trim();
    const c   = $('parentContact').value.trim();
    const o   = $('parentOccupation').value.trim();
    const a   = $('parentAddress').value.trim();
    const cl  = $('teacherClassSelect').value;
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
    const toDel = [...document.querySelectorAll('.sel:checked')]
      .map(cb => +cb.closest('tr').dataset.index);
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
        statusNames           = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' },
        statusColors          = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  attendanceBodyDiv.classList.add('attendance-container');

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = ''; attendanceSummaryDiv.innerHTML = '';
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    students.filter(s => s.cls===cl && s.sec===sec).forEach((stu, i) => { ... });
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  saveAttendanceBtn.onclick = async () => { ... };
  resetAttendanceBtn.onclick = () => { ... };
  downloadAttendanceBtn.onclick = async () => { ... };
  shareAttendanceBtn.onclick = () => { ... };

  // --- 7. ANALYTICS ---
  const atg    = $('analyticsTarget'),
        asel   = $('analyticsSectionSelect'),
        atype  = $('analyticsType');
  const adate  = $('analyticsDate'),
        amonth = $('analyticsMonth'),
        sems   = $('semesterStart'),
        seme   = $('semesterEnd'),
        ayear  = $('yearStart'),
        asearch= $('analyticsSearch');
  const loadA  = $('loadAnalytics'),
        resetA = $('resetAnalytics');
  const instr  = $('instructions'),
        acont  = $('analyticsContainer');
  const graphs = $('graphs'),
        aacts  = $('analyticsActions');
  const barCtx = $('barChart').getContext('2d'),
        pieCtx = $('pieChart').getContext('2d');
  let barChart, pieChart;

  $('analyticsFilterBtn').onclick   = () => show($('analyticsFilterModal'));
  $('analyticsFilterClose').onclick = () => hide($('analyticsFilterModal'));

  atg.onchange = () => { ... };
  atype.onchange = () => { ... };
  loadA.onclick = () => { ... };
  $('applyAnalyticsFilter').onclick = () => { ... };

  function renderAnalytics(stats, from, to) { ... }

  $('downloadAnalytics').onclick = async () => { ... };
  $('shareAnalytics').onclick = () => { ... };

  // --- 8. ATTENDANCE REGISTER ---
  (function(){
    const loadBtn     = $('loadRegister'),
          saveBtn     = $('saveRegister'),
          changeBtn   = $('changeRegister'),
          downloadBtn = $('downloadRegister'),
          shareBtn    = $('shareRegister'),
          headerRow   = $('registerHeader'),
          bodyTbody   = $('registerBody'),
          tableWrapper= $('registerTableWrapper');

    function bindRegisterActions(){
      downloadBtn.onclick = async () => {
        const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const today = new Date().toISOString().split('T')[0];
        doc.setFontSize(18); doc.text('Attendance Register', 14, 20);
        doc.setFontSize(10); doc.text(`Date: ${today}`, pageWidth - 14, 20, { align: 'right' });
        doc.setFontSize(12); doc.text($('setupText').textContent, 14, 36);
        doc.autoTable({ startY:60, html:'#registerTable', tableWidth:'auto', styles:{ fontSize:10 } });
        const blob = doc.output('blob');
        doc.save('attendance_register.pdf');
        await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
      };

      shareBtn.onclick = () => {
        const header = `Attendance Register\n${$('setupText').textContent}`;
        const rows = Array.from(bodyTbody.children).map(tr =>
          Array.from(tr.children).map(td => td.textContent.trim()).join(' ')
        );
        window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows.join('\n'))}`, '_blank');
      };
    }

    loadBtn.onclick = () => {
      const m = $('registerMonth').value;
      if (!m) { alert('Pick month'); return; }
      const keys = Object.keys(attendanceData).filter(d => d.startsWith(m+'-')).sort();
      if (!keys.length) { alert('No attendance marked this month.'); return; }

      headerRow.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
        keys.map(k => `<th>${k.split('-')[2]}</th>`).join('');
      bodyTbody.innerHTML = '';

      const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
      students.filter(s => s.cls===cls && s.sec===sec).forEach((s,i) => {
        let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
        keys.forEach(key => {
          const c = attendanceData[key][s.adm] || '';
          const color = c==='P' ? 'var(--success)' :
                        c==='Lt'? 'var(--warning)' :
                        c==='HD'? '#FF9800' :
                        c==='L'? 'var(--info)' : 'var(--danger)';
          const style = c ? `background:${color};color:#fff` : '';
          row += `<td class="reg-cell" style="${style}"><span class="status-text">${c}</span></td>`;
        });
        const tr = document.createElement('tr');
        tr.innerHTML = row;
        bodyTbody.appendChild(tr);
      });

      document.querySelectorAll('.reg-cell').forEach(cell => {
        cell.onclick = () => {
          const span = cell.querySelector('.status-text');
          const codes = ['', 'P', 'Lt', 'HD', 'L', 'A'];
          const idx = (codes.indexOf(span.textContent) + 1) % codes.length;
          const c = codes[idx];
          span.textContent = c;
          if (!c) {
            cell.style.background = '';
            cell.style.color = '';
          } else {
            const col = c==='P'?'var(--success)':
                        c==='Lt'?'var(--warning)':
                        c==='HD'?'#FF9800':
                        c==='L'?'var(--info)':'var(--danger)';
            cell.style.background = col;
            cell.style.color = '#fff';
          }
        };
      });

      show(tableWrapper, saveBtn);
      hide(loadBtn, changeBtn, downloadBtn, shareBtn);
    };

    saveBtn.onclick = async () => {
      const m = $('registerMonth').value;
      const keys = Object.keys(attendanceData).filter(d => d.startsWith(m+'-')).sort();
      Array.from(bodyTbody.children).forEach(tr => {
        const adm = tr.children[1].textContent;
        keys.forEach((key, idx) => {
          const code = tr.children[3+idx].querySelector('.status-text').textContent;
          if (code) {
            attendanceData[key] = attendanceData[key] || {};
            attendanceData[key][adm] = code;
          } else {
            if (attendanceData[key]) delete attendanceData[key][adm];
          }
        });
      });
      await save('attendanceData', attendanceData);
      hide(saveBtn);
      show(changeBtn, downloadBtn, shareBtn);
      bindRegisterActions();
    };

    changeBtn.onclick = () => {
      hide(tableWrapper, changeBtn, downloadBtn, shareBtn, saveBtn);
      headerRow.innerHTML = '';
      bodyTbody.innerHTML = '';
      show(loadBtn);
    };

    bindRegisterActions();
  })();

  // --- 9. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
