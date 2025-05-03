// app.js
(() => {
  // ── Shared Helpers & State ─────────────────────────────────────
  const $    = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  window.addEventListener('DOMContentLoaded', async () => {
    // 1. IndexedDB setup (idb-keyval)
    const { get, set } = window.idbKeyval || {};
    if (!get) { console.error('idb-keyval not found'); return; }
    const save = (k, v) => set(k, v);

    // 2. Initialize state from IndexedDB
    let students       = await get('students')        || [];
    let attendanceData = await get('attendanceData')  || {};
    let paymentsData   = await get('paymentsData')    || {};
    let lastAdmNo      = await get('lastAdmissionNo') || 0;
    let fineRates      = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
    let eligibilityPct = await get('eligibilityPct')  || 75;

    // Admission number generator
    async function genAdmNo() {
      lastAdmNo++;
      await save('lastAdmissionNo', lastAdmNo);
      return String(lastAdmNo).padStart(4, '0');
    }

    // 3. Search & Filter UI Setup
    let searchTerm = '';
    let filterOptions = { time: null, info: [], bulkReports: false };

    const globalSearch = $('globalSearch');
    const filterBtn    = $('filterBtn');
    const filterDialog = $('filterDialog');
    const closeFilter  = $('closeFilter');
    const applyFilter  = $('applyFilter');
    const timeChecks   = Array.from(filterDialog.querySelectorAll('input[name="timeFilter"]'));
    const pickers      = {
      'date-day': $('picker-date'),
      'month':    $('picker-month'),
      'semester': $('picker-semester'),
      'year':     $('picker-year'),
    };

    // time‐picker toggles
    timeChecks.forEach(chk => chk.onchange = () => {
      timeChecks.forEach(c => { if (c !== chk) c.checked = false; });
      Object.entries(pickers).forEach(([val, el]) => {
        el.classList.toggle('hidden', !(chk.checked && chk.value === val));
      });
      $('timePickers').classList.toggle('hidden', !chk.checked);
    });

    // search filter
    globalSearch.oninput = () => {
      searchTerm = globalSearch.value.trim().toLowerCase();
      renderStudents();
    };

    // open/close filter dialog
    filterBtn.onclick   = () => show(filterDialog);
    closeFilter.onclick = () => hide(filterDialog);

    // apply filter logic
    applyFilter.onclick = () => {
      // 1) time range
      const t = timeChecks.find(c => c.checked)?.value;
      let range = null;
      if (t === 'date-day') {
        const d = $('filterDate').value;
        range = { from: d, to: d };
      } else if (t === 'month') {
        const m = $('filterMonth').value;
        const [y, mm] = m.split('-').map(Number);
        range = { from: `${m}-01`, to: `${m}-${new Date(y, mm, 0).getDate()}` };
      } else if (t === 'semester') {
        const s1 = $('filterSemStart').value, s2 = $('filterSemEnd').value;
        const [sy, sm] = s1.split('-').map(Number), [ey, em] = s2.split('-').map(Number);
        range = { from: `${s1}-01`, to: `${s2}-${new Date(ey, em, 0).getDate()}` };
      } else if (t === 'year') {
        const y = $('filterYear').value;
        range = { from: `${y}-01-01`, to: `${y}-12-31` };
      }

      // 2) info filters
      const info = Array.from(filterDialog.querySelectorAll('input[name="infoFilter"]:checked'))
                        .map(i => i.value);
      const bulk = info.includes('bulkReports');
      filterOptions = { time: range, info, bulkReports: bulk };

      if (bulk) {
        const roster = students.filter(s =>
          s.cls === $('teacherClassSelect').value &&
          s.sec === $('teacherSectionSelect').value
        );
        roster.forEach(s => generateStudentReport(s));
        hide(filterDialog);
        return;
      }

      renderStudents();
      hide(filterDialog);
    };

    // 4. Financial Settings
    const formDiv      = $('financialForm');
    const saveSettings = $('saveSettings');
    const fInputs      = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map($);
    const settingsCard = $('settingsCard');
    const editSettings = $('editSettings');

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
        HD: +$('fineHalfDay').value  || 0,
      };
      eligibilityPct = +$('eligibilityPct').value || 0;
      await save('fineRates', fineRates);
      await save('eligibilityPct', eligibilityPct);
      settingsCard.innerHTML = `
        <p>Fine–Absent: PKR ${fineRates.A}</p>
        <p>Fine–Late: PKR ${fineRates.Lt}</p>
        <p>Fine–Leave: PKR ${fineRates.L}</p>
        <p>Fine–Half-Day: PKR ${fineRates.HD}</p>
        <p>Elig % ≥ ${eligibilityPct}</p>`;
      hide(formDiv, ...fInputs, saveSettings);
      show(settingsCard, editSettings);
    };
    editSettings.onclick = () => {
      hide(settingsCard, editSettings);
      show(formDiv, ...fInputs, saveSettings);
    };

    // 5. Teacher Setup
    async function loadSetup() {
      const [sc, cls, sec] = await Promise.all([
        get('schoolName'), get('teacherClass'), get('teacherSection')
      ]);
      if (sc && cls && sec) {
        $('schoolNameInput').value      = sc;
        $('teacherClassSelect').value   = cls;
        $('teacherSectionSelect').value = sec;
        $('setupText').textContent      = `${sc} | Class ${cls} Sec ${sec}`;
        hide($('setupForm')); show($('setupDisplay'));
        renderStudents(); updateCounters(); // do not reset views
      }
    }
    $('saveSetup').onclick = async e => {
      e.preventDefault();
      const sc  = $('schoolNameInput').value.trim();
      const cls = $('teacherClassSelect').value;
      const sec = $('teacherSectionSelect').value;
      if (!sc||!cls||!sec) return alert('Complete setup');
      await save('schoolName', sc);
      await save('teacherClass', cls);
      await save('teacherSection', sec);
      loadSetup();
    };
    $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
    await loadSetup();

    // 6. Initial render & counters
    renderStudents();
    updateCounters();

    // 7. Counters & Utilities
    function animateCounters() {
      document.querySelectorAll('.number').forEach(span => {
        const target = +span.dataset.target;
        let count = 0, step = Math.max(1, target/100);
        (function update() {
          count += step;
          span.textContent = count < target ? Math.ceil(count) : target;
          if (count < target) requestAnimationFrame(update);
        })();
      });
    }
    function updateCounters() {
      const cls = $('teacherClassSelect').value;
      const sec = $('teacherSectionSelect').value;
      $('sectionCount').dataset.target = students.filter(s=>s.cls===cls&&s.sec===sec).length;
      $('classCount').dataset.target   = students.filter(s=>s.cls===cls).length;
      $('schoolCount').dataset.target  = students.length;
      animateCounters();
    }
    $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); };
    $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); };

    // 8. Render Students Table
    function renderStudents() {
      const cls = $('teacherClassSelect').value;
      const sec = $('teacherSectionSelect').value;
      const tbody = $('studentsBody');
      tbody.innerHTML = '';

      students
        .filter(s => s.cls === cls && s.sec === sec)
        .filter(s => {
          if (!searchTerm) return true;
          return s.name.toLowerCase().includes(searchTerm) || s.adm.includes(searchTerm);
        })
        .filter(s => {
          if (filterOptions.bulkReports) return true;
          if (!filterOptions.info.length) return true;
          // compute status/outstanding once
          const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
          Object.values(attendanceData).forEach(rec => stats[rec[s.adm]||'A']++);
          const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
          const paid = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
          const out = totalFine - paid;
          const totalDays = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
          const pct = totalDays ? stats.P/totalDays*100 : 0;
          const status = (out>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';

          return filterOptions.info.some(opt => {
            if (opt==='debarred')    return status==='Debarred';
            if (opt==='eligible')    return status==='Eligible';
            if (opt==='outstanding') return out>0;
            if (opt==='clear')       return out<=0;
            return false;
          });
        })
        .forEach((s,i) => {
          const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
          Object.values(attendanceData).forEach(rec => stats[rec[s.adm]||'A']++);
          const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
          const paid = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
          const out = totalFine - paid;
          const totalDays = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
          const pct = totalDays ? stats.P/totalDays*100 : 0;
          const status = (out>0||pct<eligibilityPct) ? 'Debarred':'Eligible';

          const tr = document.createElement('tr');
          tr.dataset.index = i;
          tr.innerHTML = `
            <td><input type="checkbox" class="sel"></td>
            <td>${i+1}</td>
            <td>${s.name}</td>
            <td>${s.adm}</td>
            <td>${s.parent}</td>
            <td>${s.contact}</td>
            <td>${s.occupation}</td>
            <td>${s.address}</td>
            <td>PKR ${out}</td>
            <td>${status}</td>
            <td><button class="add-payment-btn" data-adm="${s.adm}">
                  <i class="fas fa-coins"></i></button></td>`;
          tbody.appendChild(tr);
        });

      // wire up payment buttons
      document.querySelectorAll('.add-payment-btn')
        .forEach(b => b.onclick = () => openPaymentModal(b.dataset.adm));
      // update selection buttons
      $('selectAllStudents').checked = false;
      $('editSelected').disabled = $('deleteSelected').disabled = true;
    }

    // selection toggles
    $('studentsBody').addEventListener('change', e => {
      if (e.target.classList.contains('sel')) {
        const any = !!document.querySelector('.sel:checked');
        $('editSelected').disabled = $('deleteSelected').disabled = !any;
      }
    });
    $('selectAllStudents').onclick = () => {
      const chk = $('selectAllStudents').checked;
      document.querySelectorAll('.sel').forEach(c => c.checked = chk);
      $('editSelected').disabled = $('deleteSelected').disabled = !chk;
    };

    // 9. Registration CRUD
    $('addStudent').onclick = async e => {
      e.preventDefault();
      const n = $('studentName').value.trim();
      const p = $('parentName').value.trim();
      const c = $('parentContact').value.trim();
      const o = $('parentOccupation').value.trim();
      const a = $('parentAddress').value.trim();
      const cls = $('teacherClassSelect').value;
      const sec = $('teacherSectionSelect').value;
      if (!n||!p||!c||!o||!a) return alert('All fields required');
      if (!/^\d{7,15}$/.test(c)) return alert('Contact 7–15 digits');
      const adm = await genAdmNo();
      students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls, sec });
      await save('students', students);
      renderStudents(); updateCounters();
      ['studentName','parentName','parentContact','parentOccupation','parentAddress']
        .forEach(id => $(id).value = '');
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
          <td colspan="3"></td>`;
      });
      hide($('editSelected')); show($('doneEditing'));
    };

    $('doneEditing').onclick = async () => {
      document.querySelectorAll('#studentsBody tr').forEach(tr => {
        const inputs = [...tr.querySelectorAll('input:not(.sel)')];
        if (inputs.length === 5) {
          const [n,p,c,o,a] = inputs.map(i=>i.value.trim());
          const adm = tr.children[3].textContent;
          const idx = students.findIndex(s=>s.adm===adm);
          if (idx>-1) students[idx] = { ...students[idx], name:n, parent:p, contact:c, occupation:o, address:a };
        }
      });
      await save('students', students);
      hide($('doneEditing')); show($('editSelected'), $('deleteSelected'), $('saveRegistration'));
      renderStudents(); updateCounters();
    };

    $('deleteSelected').onclick = async () => {
      if (!confirm('Delete selected?')) return;
      const toDel = [...document.querySelectorAll('.sel:checked')]
        .map(cb => +cb.closest('tr').dataset.index);
      students = students.filter((_,i)=>!toDel.includes(i));
      await save('students', students);
      renderStudents(); updateCounters();
    };

    $('saveRegistration').onclick = async () => {
      if (!$('doneEditing').classList.contains('hidden')) return alert('Finish editing');
      await save('students', students);
      hide(
        document.querySelector('#student-registration .row-inline'),
        $('selectAllStudents'), $('editSelected'),
        $('deleteSelected'), $('saveRegistration')
      );
      show($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
    };

    $('editRegistration').onclick = () => {
      show(
        document.querySelector('#student-registration .row-inline'),
        $('selectAllStudents'), $('editSelected'),
        $('deleteSelected'), $('saveRegistration')
      );
      hide($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
      renderStudents(); updateCounters();
    };

    // 10. Payment Modal
    function openPaymentModal(adm) {
      $('payAdm').textContent = adm;
      $('paymentAmount').value = '';
      show($('paymentModal'));
    }
    $('savePayment').onclick = async () => {
      const adm = $('payAdm').textContent;
      const amt = Number($('paymentAmount').value) || 0;
      paymentsData[adm] = paymentsData[adm] || [];
      paymentsData[adm].push({
        date: new Date().toISOString().split('T')[0],
        amount: amt
      });
      await save('paymentsData', paymentsData);
      hide($('paymentModal'));
      renderStudents();
    };
    $('cancelPayment').onclick = () => hide($('paymentModal'));

    // 11. Attendance Marking
    const dateInput             = $('dateInput');
    const loadAttendanceBtn     = $('loadAttendance');
    const saveAttendanceBtn     = $('saveAttendance');
    const resetAttendanceBtn    = $('resetAttendance');
    const downloadAttendanceBtn = $('downloadAttendancePDF');
    const shareAttendanceBtn    = $('shareAttendanceSummary');
    const attendanceBodyDiv     = $('attendanceBody');
    const attendanceSummaryDiv  = $('attendanceSummary');
    const statusNames           = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' };
    const statusColors          = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

    loadAttendanceBtn.onclick = () => {
      attendanceBodyDiv.innerHTML = '';
      attendanceSummaryDiv.innerHTML = '';
      students
        .filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value)
        .forEach(stu => {
          const row = document.createElement('div');
          row.className = 'attendance-row';
          const nameDiv = document.createElement('div');
          nameDiv.className = 'attendance-name';
          nameDiv.textContent = stu.name;
          const btnsDiv = document.createElement('div');
          btnsDiv.className = 'attendance-buttons';
          Object.keys(statusNames).forEach(code => {
            const btn = document.createElement('button');
            btn.className = 'att-btn';
            btn.textContent = code;
            btn.onclick = () => {
              btnsDiv.querySelectorAll('.att-btn').forEach(b => {
                b.classList.remove('selected');
                b.style.background = ''; b.style.color = '';
              });
              btn.classList.add('selected');
              btn.style.background = statusColors[code];
              btn.style.color = '#fff';
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
      if (!date) { alert('Pick date'); return; }
      attendanceData[date] = {};
      students
        .filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value)
        .forEach((s,i) => {
          const btn = attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
          attendanceData[date][s.adm] = btn ? btn.textContent : 'A';
        });
      await save('attendanceData', attendanceData);

      // summary
      attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
      const tbl = document.createElement('table');
      tbl.innerHTML = `<tr><th>Name</th><th>Status</th><th>Share</th></tr>`;
      students
        .filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value)
        .forEach(s => {
          const code = attendanceData[date][s.adm];
          tbl.innerHTML += `
            <tr>
              <td>${s.name}</td>
              <td>${statusNames[code]}</td>
              <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
            </tr>`;
        });
      attendanceSummaryDiv.appendChild(tbl);
      attendanceSummaryDiv.querySelectorAll('.share-individual').forEach(ic => {
        ic.onclick = () => {
          const adm = ic.dataset.adm;
          const student = students.find(x => x.adm === adm);
          const code = attendanceData[date][adm];
          const msg  = `Dear Parent, your child was ${statusNames[code]} on ${date}.`;
          window.open(`https://wa.me/${student.contact}?text=${encodeURIComponent(msg)}`, '_blank');
        };
      });

      hide(attendanceBodyDiv, saveAttendanceBtn);
      show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
    };

    resetAttendanceBtn.onclick = () => {
      show(attendanceBodyDiv, saveAttendanceBtn);
      hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
    };

    downloadAttendanceBtn.onclick = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFontSize(18); doc.text('Attendance Report',14,16);
      doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
      doc.autoTable({ startY:32, html:'#attendanceSummary table' });
      doc.save(`attendance_${dateInput.value}.pdf`);
    };

    shareAttendanceBtn.onclick = () => {
      const date = dateInput.value;
      const header = `*Attendance Report* ${$('setupText').textContent} - ${date}`;
      const lines = students
        .filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value)
        .map(s => `*${s.name}*: ${statusNames[attendanceData[date][s.adm]]}`)
        .join('\n');
      window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
    };

    // 12. Analytics & Fine Reports
    const analyticsSection = $('analytics-section');
    const atg    = $('analyticsTarget');
    const asel   = $('analyticsSectionSelect');
    const atype  = $('analyticsType');
    const adate  = $('analyticsDate');
    const amonth = $('analyticsMonth');
    const sems   = $('semesterStart');
    const seme   = $('semesterEnd');
    const ayear  = $('yearStart');
    const loadA  = $('loadAnalytics');
    const resetA = $('resetAnalytics');
    const graphs = $('graphs');
    const aacts  = $('analyticsActions');
    const barCtx = $('barChart').getContext('2d');
    const pieCtx = $('pieChart').getContext('2d');
    let barChart, pieChart, lastStats;

    function computePeriod(type) {
      let from, to;
      if (type==='date') {
        from = to = adate.value;
      } else if (type==='month') {
        const m = amonth.value; const [y,mo]=m.split('-').map(Number);
        from = `${m}-01`; to = `${m}-${String(new Date(y,mo,0).getDate()).padStart(2,'0')}`;
      } else if (type==='semester') {
        const s1=sems.value,s2=seme.value;
        const [sy,sm]=s1.split('-').map(Number),[ey,em]=s2.split('-').map(Number);
        from = `${s1}-01`; to = `${s2}-${String(new Date(ey,em,0).getDate()).padStart(2,'0')}`;
      } else if (type==='year') {
        const y=ayear.value; from = `${y}-01-01`; to = `${y}-12-31`;
      }
      return { from, to };
    }

    async function fetchAnalyticsData(target, period, specificAdm) {
      const roster = students.filter(s => {
        if (target==='section')
          return s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value;
        if (target==='student')
          return s.adm === specificAdm;
        return true;
      });
      const stats = roster.map(s => {
        const recs = Object.entries(attendanceData)
          .filter(([d]) => d >= period.from && d <= period.to)
          .map(([d,rec]) => rec[s.adm] || 'A');
        const counts = { P:0, A:0, Lt:0, HD:0, L:0 };
        recs.forEach(c => counts[c]++);
        const total = recs.length;
        const pctPresent = total ? counts.P/total*100 : 0;
        const fine = counts.A*fineRates.A + counts.Lt*fineRates.Lt + counts.L*fineRates.L + counts.HD*fineRates.HD;
        const paid = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
        return {
          adm: s.adm, name: s.name,
          present: counts.P, absent: counts.A, late: counts.Lt,
          halfDay: counts.HD, leave: counts.L,
          attendancePct: pctPresent,
          outstandingFine: fine - paid
        };
      });
      return stats;
    }

    function renderBarChart(ctx, stats) {
      const labels = stats.map(s => s.name);
      const data   = stats.map(s => Math.round(s.attendancePct));
      return new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Attendance %', data }] },
        options: { responsive: true }
      });
    }

    function renderPieChart(ctx, stats) {
      const eligible = stats.filter(s => s.attendancePct >= eligibilityPct && s.outstandingFine <= 0).length;
      const debarred = stats.length - eligible;
      return new Chart(ctx, {
        type: 'pie',
        data: { labels: ['Eligible','Debarred'], datasets: [{ data: [eligible,debarred] }] },
        options: { responsive: true }
      });
    }

    loadA.onclick = async () => {
      if (!atype.value) { alert('Select analytics type'); return; }
      const period = computePeriod(atype.value);
      const adm    = (atg.value==='student') ? asearch.value.trim() : null;
      const stats  = await fetchAnalyticsData(atg.value, period, adm);
      lastStats    = stats;

      show(analyticsSection, graphs, aacts);
      if (barChart) barChart.destroy();
      barChart = renderBarChart(barCtx, stats);
      if (pieChart) pieChart.destroy();
      pieChart = renderPieChart(pieCtx, stats);
    };

    resetA.onclick = e => {
      e.preventDefault();
      hide(graphs, aacts);
      atype.value = '';
      resetA.classList.add('hidden');
    };

    $('downloadAnalyticsPDF').onclick = () => {
      if (!lastStats) return alert('Generate analytics first');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFontSize(16); doc.text('Attendance Analytics',14,20);
      doc.autoTable({
        head: [['Adm#','Name','% Present','Outstanding Fine']],
        body: lastStats.map(s=>[
          s.adm, s.name,
          `${s.attendancePct.toFixed(1)}%`,
          `PKR ${s.outstandingFine}`
        ]),
        startY: 30
      });
      doc.save(`analytics_${atype.value}_${Date.now()}.pdf`);
    };

    // 13. Attendance Register
    const registerSection = $('register-section');
    const loadReg   = $('loadRegister');
    const changeReg = $('changeRegister');
    const saveReg   = $('saveRegister');
    const dlReg     = $('downloadRegister');
    const shReg     = $('shareRegister');
    const rm        = $('registerMonth');
    const rh        = $('registerHeader');
    const rb        = $('registerBody');
    const rw        = $('registerTableWrapper');
    const regCodes  = ['A','P','Lt','HD','L'];
    const regColors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

    loadReg.onclick = () => {
      const m = rm.value; if (!m) return alert('Pick month');
      show(registerSection, rw, saveReg);

      const [y,mm] = m.split('-').map(Number);
      const days = new Date(y,mm,0).getDate();
      rh.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
        Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');

      rb.innerHTML = '';
      students
        .filter(s=>s.cls===$('teacherClassSelect').value && s.sec===$('teacherSectionSelect').value)
        .forEach((s,i)=>{
          let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
          for (let d=1; d<=days; d++){
            const key = `${m}-${String(d).padStart(2,'0')}`;
            const c   = (attendanceData[key]||{})[s.adm]||'A';
            const style = c==='A'?'':` style="background:${regColors[c]};color:#fff"`;
            row += `<td class="reg-cell"${style}><span class="status-text">${c}</span></td>`;
          }
          const tr = document.createElement('tr'); tr.innerHTML = row; rb.appendChild(tr);
        });

      rb.querySelectorAll('.reg-cell').forEach(cell=>{
        cell.onclick = () => {
          const span = cell.querySelector('.status-text');
          let idx = (regCodes.indexOf(span.textContent) + 1) % regCodes.length;
          const c = regCodes[idx];
          span.textContent = c;
          if (c==='A'){ cell.style.background=''; cell.style.color=''; }
          else       { cell.style.background=regColors[c]; cell.style.color='#fff'; }
        };
      });
    };

    saveReg.onclick = async () => {
      const m = rm.value; const [y,mm] = m.split('-').map(Number);
      const days = new Date(y,mm,0).getDate();
      Array.from(rb.children).forEach(tr=>{
        const adm = tr.children[1].textContent;
        for (let d=1; d<=days; d++){
          const code = tr.children[3+d-1].querySelector('.status-text').textContent;
          const key = `${m}-${String(d).padStart(2,'0')}`;
          attendanceData[key] = attendanceData[key]||{};
          attendanceData[key][adm] = code;
        }
      });
      await save('attendanceData', attendanceData);
      hide(saveReg); show(changeReg, dlReg, shReg);
    };

    changeReg.onclick = () => { hide(changeReg, dlReg, shReg); show(saveReg); };

    dlReg.onclick = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
      doc.setFontSize(18); doc.text('Attendance Register',14,16);
      doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
      doc.autoTable({ startY:32, html:'#registerTable', tableWidth:'auto', styles:{fontSize:10} });
      doc.save('attendance_register.pdf');
    };

    shReg.onclick = () => {
      const header = `Attendance Register\n${$('setupText').textContent}`;
      const rows = Array.from(rb.children).map(tr =>
        Array.from(tr.children).map(td =>
          td.querySelector('.status-text')
            ? td.querySelector('.status-text').textContent
            : td.textContent
        ).join(' ')
      );
      window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+rows.join('\n'))}`, '_blank');
    };

    // 14. Individual Student Report generator
    async function generateStudentReport(student) {
      const adm = student.adm;
      const recs = Object.entries(attendanceData)
        .filter(([d]) => {
          if (filterOptions.time) {
            return d >= filterOptions.time.from && d <= filterOptions.time.to;
          }
          return true;
        })
        .map(([d,rec]) => ({ date: d, status: rec[adm] || 'A' }));

      const counts = { P:0, A:0, Lt:0, HD:0, L:0 };
      recs.forEach(r => counts[r.status]++);
      const total = recs.length;
      const pctPresent = total ? (counts.P/total)*100 : 0;
      const totalFine = counts.A*fineRates.A + counts.Lt*fineRates.Lt + counts.L*fineRates.L + counts.HD*fineRates.HD;
      const paid = (paymentsData[adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      const outstanding = totalFine - paid;

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Report for ${student.name} (Adm# ${adm})`, 14, 20);
      doc.setFontSize(12);
      doc.text(`Class ${student.cls} Sec ${student.sec}`, 14, 30);
      doc.text(`Attendance %: ${pctPresent.toFixed(1)}%`, 14, 40);
      doc.text(`Outstanding Fine: PKR ${outstanding}`, 14, 50);
      doc.autoTable({
        head: [['Date','Status']],
        body: recs.map(r => [r.date, r.status]),
        startY: 60,
        styles: { fontSize: 10 }
      });
      doc.save(`report_${adm}.pdf`);
    }

    // 15. Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(console.error);
    }
  });
})();
