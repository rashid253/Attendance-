// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- 0. Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- 1. IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) { console.error('idb-keyval not found'); return; }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // --- 2. State & Defaults ---
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

  // --- 3. DOM Helpers ---
  const $    = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e?.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e?.classList.add('hidden'));

  // --- 4. SETTINGS: Fines & Eligibility ---
  const saveSettings = $('saveSettings');
  const inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map(id => $(id));

  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveSettings.onclick = async () => {
    fineRates = {
      A : +$('fineAbsent').value   || 0,
      Lt: +$('fineLate').value     || 0,
      L : +$('fineLeave').value    || 0,
      HD: +$('fineHalfDay').value  || 0
    };
    eligibilityPct = +$('eligibilityPct').value || 0;
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);
    hide(...inputs, saveSettings);
    show($('settingsCard'), $('editSettings'));
  };

  $('editSettings').onclick = () => {
    hide($('settingsCard'), $('editSettings'));
    show(...inputs, saveSettings);
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
      $('setupText').textContent      = `${sc} | Class: ${cl} | Section: ${sec}`;
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
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- 6. COUNTERS & UTILS ---
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
    const els = [
      'attendanceBody','saveAttendance','resetAttendance','attendanceSummary',
      'downloadAttendancePDF','shareAttendanceSummary','instructions','analyticsContainer',
      'graphs','analyticsActions','registerTableWrapper','changeRegister',
      'saveRegister','downloadRegister','shareRegister'
    ].map(id => $(id));
    hide(...els);
    show($('loadRegister'));
  }
  $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- 7. STUDENT REGISTRATION & FINE/STATUS ---
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
      Object.entries(attendanceData).forEach(([d, recs]) => {
        const code = recs[s.adm] || 'A';
        stats[code]++;
      });
      const totalDays = Object.values(stats).reduce((a, b) => a + b, 0);
      const pct       = totalDays ? (stats.P / totalDays) * 100 : 0;
      const totalFine = stats.A * fineRates.A
                      + stats.Lt * fineRates.Lt
                      + stats.L  * fineRates.L
                      + stats.HD * fineRates.HD;
      const paid       = (paymentsData[s.adm] || []).reduce((sum, p) => sum + p.amount, 0);
      const outstanding= totalFine - paid;
      const status     = (outstanding > 0 || pct < eligibilityPct) ? 'Debarred' : 'Eligible';

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
  $('selectAllStudents').onclick   = () => {
    document.querySelectorAll('.sel').forEach(c => c.checked = $('selectAllStudents').checked);
    toggleButtons();
  };
  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n   = $('studentName').value.trim(),
          p   = $('parentName').value.trim(),
          c   = $('parentContact').value.trim(),
          o   = $('parentOccupation').value.trim(),
          a   = $('parentAddress').value.trim(),
          cl  = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    if (!n||!p||!c||!o||!a) { alert('All fields required'); return; }
    if (!/^\d{7,15}$/.test(c)) { alert('Contact 7–15 digits'); return; }
    const adm = await genAdmNo();
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec });
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id => $(id).value = '');
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
    hide($('editSelected'));
    show($('doneEditing'));
  };
  $('doneEditing').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach(tr => {
      const inputs = tr.querySelectorAll('input:not(.sel)');
      if (inputs.length === 5) {
        const [n,p,c,o,a] = Array.from(inputs).map(i => i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(x => x.adm === adm);
        if (idx > -1) students[idx] = { ...students[idx], name:n, parent:p, contact:c, occupation:o, address:a };
      }
    });
    await save('students', students);
    hide($('doneEditing'));
    show($('editSelected'), $('deleteSelected'));
    renderStudents(); updateCounters();
  };
  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete?')) return;
    const toDel = Array.from(document.querySelectorAll('.sel:checked'))
                       .map(cb => +cb.closest('tr').dataset.index);
    students = students.filter((_, i) => !toDel.includes(i));
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
  };

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('paymentModalClose').onclick = () => hide($('paymentModal'));
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

  // --- 9. MARK ATTENDANCE ---
  const dateInput              = $('dateInput'),
        loadAttendanceBtn      = $('loadAttendance'),
        saveAttendanceBtn      = $('saveAttendance'),
        resetAttendanceBtn     = $('resetAttendance'),
        downloadAttendanceBtn  = $('downloadAttendancePDF'),
        shareAttendanceBtn     = $('shareAttendanceSummary'),
        attendanceBodyDiv      = $('attendanceBody'),
        attendanceSummaryDiv   = $('attendanceSummary');
  const statusNames  = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' };
  const statusColors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = '';
    attendanceSummaryDiv.innerHTML = '';
    const roster = students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value);
    roster.forEach((stu, i) => {
      const row     = document.createElement('div'); row.className = 'attendance-row';
      const nameDiv = document.createElement('div'); nameDiv.className = 'attendance-name'; nameDiv.textContent = stu.name;
      const btnsDiv = document.createElement('div'); btnsDiv.className = 'attendance-buttons';
      Object.keys(statusNames).forEach(code => {
        const btn = document.createElement('button');
        btn.className = 'att-btn';
        btn.textContent = code;
        btn.onclick = () => {
          btnsDiv.querySelectorAll('.att-btn').forEach(b => { b.classList.remove('selected'); b.style.background = ''; b.style.color = ''; });
          btn.classList.add('selected');
          btn.style.background = statusColors[code];
          btn.style.color      = '#fff';
        };
        btnsDiv.appendChild(btn);
      });
      row.append(nameDiv, btnsDiv);
      attendanceBodyDiv.appendChild(row);
    });
    show(attendanceBodyDiv, saveAttendanceBtn);
  };

  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert('Pick a date'); return; }
    attendanceData[date] = {};
    const roster = students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value);
    roster.forEach((s, i) => {
      const btn = attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = btn ? btn.textContent : 'A';
    });
    await save('attendanceData', attendanceData);

    // summary
    attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement('table');
    tbl.innerHTML = `<tr><th>Name</th><th>Status</th><th>Share</th></tr>`;
    roster.forEach(s => {
      const code = attendanceData[date][s.adm];
      tbl.innerHTML += `
        <tr>
          <td>${s.name}</td>
          <td>${statusNames[code]}</td>
          <td><i class="fas fa-share-alt share-indiv" data-adm="${s.adm}"></i></td>
        </tr>`;
    });
    attendanceSummaryDiv.appendChild(tbl);
    attendanceSummaryDiv.querySelectorAll('.share-indiv').forEach(ic => {
      ic.onclick = () => {
        const adm = ic.dataset.adm;
        const st  = students.find(x => x.adm === adm);
        const msg = `Your child was ${statusNames[attendanceData[date][adm]]} on ${date}`;
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

  // --- PDF Preview & Share Utility ---
  async function previewAndSharePDF(doc, filename='report.pdf') {
    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    const modal = $('pdfPreviewModal');
    $('pdfPreviewFrame').src = url;
    modal.classList.remove('hidden');

    $('closePreview').onclick = () => {
      modal.classList.add('hidden');
      URL.revokeObjectURL(url);
    };
    $('downloadFromPreview').onclick = () => {
      const a = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
    };
    $('shareFromPreview').onclick = async () => {
      const file = new File([blob], filename, { type:'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files:[file] })) {
        try {
          await navigator.share({ files:[file], title:filename, text:'Sharing PDF' });
          return;
        } catch {}
      }
      window.open(`https://wa.me/?text=${encodeURIComponent('Download PDF: '+url)}`, '_blank');
    };
  }

  // --- 10. ANALYTICS (Download) ---
  $('downloadAnalytics').onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Analytics Report', 14, 16);
    doc.setFontSize(12); doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 32, html: '#analyticsTable' });
    previewAndSharePDF(doc, 'analytics_report.pdf');
  };

  // --- 11. ATTENDANCE REGISTER (dynamic days) ---
  const loadReg     = $('loadRegister'),
        changeReg   = $('changeRegister'),
        saveReg     = $('saveRegister'),
        dlReg       = $('downloadRegister'),
        shReg       = $('shareRegister'),
        rm          = $('registerMonth'),
        rh          = $('registerHeader'),
        rb          = $('registerBody');
  const regCodes    = ['A','P','Lt','HD','L'],
        regColors   = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  loadReg.onclick = () => {
    const m = rm.value;
    if (!m) { alert('Pick month'); return; }
    const dates = Object.keys(attendanceData).filter(d => d.startsWith(m+'-')).sort();
    if (!dates.length) { alert('No attendance recorded'); return; }

    rh.innerHTML = '<th>#</th><th>Adm#</th><th>Name</th>' +
      dates.map(d => `<th>${d.split('-')[2]}</th>`).join('');
    rb.innerHTML = '';

    students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value)
      .forEach((s,i) => {
        let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
        dates.forEach(date => {
          const c = (attendanceData[date]||{})[s.adm] || 'A';
          const style = c==='A' ? '' : `style="background:${regColors[c]};color:#fff"`;
          row += `<td class="reg-cell" ${style}><span class="status-text">${c}</span></td>`;
        });
        const tr = document.createElement('tr');
        tr.dataset.dates = JSON.stringify(dates);
        tr.innerHTML = row;
        rb.appendChild(tr);
      });

    rb.querySelectorAll('.reg-cell').forEach(cell => {
      cell.onclick = () => {
        const span = cell.querySelector('.status-text');
        let idx = regCodes.indexOf(span.textContent);
        idx = (idx + 1) % regCodes.length;
        const c = regCodes[idx];
        span.textContent = c;
        if (c==='A') {
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

  saveReg.onclick = async () => {
    Array.from(rb.children).forEach(tr => {
      const dates = JSON.parse(tr.dataset.dates);
      const adm   = tr.children[1].textContent;
      dates.forEach((d,i) => {
        const c = tr.children[3+i].querySelector('.status-text').textContent;
        attendanceData[d] = attendanceData[d] || {};
        attendanceData[d][adm] = c;
      });
    });
    await save('attendanceData', attendanceData);
    hide(saveReg);
    show(changeReg, dlReg, shReg);
  };

  changeReg.onclick = () => {
    hide($('registerTableWrapper'), changeReg, dlReg, shReg, saveReg);
    rh.innerHTML = ''; rb.innerHTML = '';
    show($('loadRegister'));
  };

  dlReg.onclick = () => {
    const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    doc.setFontSize(18); doc.text('Attendance Register',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#registerTable', tableWidth:'auto', styles:{ fontSize:10 } });
    previewAndSharePDF(doc, 'attendance_register.pdf');
  };

  shReg.onclick = () => {
    const header = `Attendance Register\n${$('setupText').textContent}`;
    const rows   = Array.from(rb.children).map(tr =>
      Array.from(tr.children)
        .map(td => td.querySelector('.status-text')?.textContent || td.textContent)
        .join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows.join('\n'))}`, '_blank');
  };

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
