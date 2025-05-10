// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- Universal PDF share helper (must come first) ---
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
  let analyticsDownloadMode = 'combined';
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

  // --- 1. SETTINGS: Fines & Eligibility ---
  const formDiv      = $('financialForm'),
        saveSettings = $('saveSettings'),
        inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map(id => $(id)),
        settingsCard = document.createElement('div'),
        editSettings = document.createElement('button');
  settingsCard.id = 'settingsCard';
  settingsCard.className = 'card hidden';
  editSettings.id = 'editSettings';
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
      A:  Number($('fineAbsent').value)   || 0,
      Lt: Number($('fineLate').value)     || 0,
      L:  Number($('fineLeave').value)    || 0,
      HD: Number($('fineHalfDay').value)  || 0
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);
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

  // --- 2. SETUP: School, Class & Section ---
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
    const sc = $('schoolNameInput').value.trim(),
          cl = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    if (!sc || !cl || !sec) {
      alert('Complete setup'); return;
    }
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => {
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };
  await loadSetup();

  // --- 3. COUNTERS & UTILS ---
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
    const cl = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s => s.cls === cl && s.sec === sec).length;
    $('classCount').dataset.target   = students.filter(s => s.cls === cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  function resetViews() {
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('instructions'), $('analyticsContainer'), $('analyticsActions'),
      $('registerTableWrapper'), $('changeRegister'),
      $('downloadRegisterPDF'), $('shareRegister')
    );
    show($('loadRegister'));
  }
  $('teacherClassSelect').onchange = () => {
    renderStudents(); updateCounters(); resetViews();
  };
  $('teacherSectionSelect').onchange = () => {
    renderStudents(); updateCounters(); resetViews();
  };

  // --- 4. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value,
          tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx = 0;
    students.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      // tally attendance
      Object.entries(attendanceData).forEach(([date, rec]) => {
        const v = rec[s.adm];
        if (v && stats.hasOwnProperty(v)) stats[v]++;
      });
      const total = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const fine  = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid  = (paymentsData[s.adm] || []).reduce((a, p) => a + p.amount, 0);
      const out   = fine - paid;
      const pct   = total ? (stats.P / total) * 100 : 0;
      const status= (out > 0 || pct < eligibilityPct) ? 'Debarred' : 'Eligible';

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
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleButtons();
  });
  $('selectAllStudents').onclick = () => {
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
    if (!n || !p || !c || !o || !a) {
      alert('All fields required'); return;
    }
    if (!/^\d{7,15}$/.test(c)) {
      alert('Contact 7–15 digits'); return;
    }
    const adm = await genAdmNo();
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec });
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress']
      .forEach(id => $(id).value = '');
  };

  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach(cb => {
      const tr = cb.closest('tr'),
            i  = +tr.dataset.index,
            s  = students[i];
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
      const idx    = +tr.dataset.index,
            inputs = tr.querySelectorAll('input');
      if (inputs.length > 1) {
        students[idx].name       = inputs[1].value;
        students[idx].parent     = inputs[2].value;
        students[idx].contact    = inputs[3].value;
        students[idx].occupation = inputs[4].value;
        students[idx].address    = inputs[5].value;
      }
    });
    await save('students', students);
    renderStudents();
    hide($('doneEditing'));
    show($('editSelected'));
  };
  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected?')) return;
    students = students.filter((s, i) => !document.querySelector(`tr[data-index="${i}"] .sel`).checked);
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
  };

  // --- 5. Attendance Recording ---
  $('loadRegister').onclick = async () => {
    hide($('loadRegister'));
    renderAttendance();
    show($('attendanceBody'), $('saveAttendance'), $('resetAttendance'));
  };
  function renderAttendance() {
    const cl      = $('teacherClassSelect').value,
          sec     = $('teacherSectionSelect').value,
          tbody   = $('attendanceBody'),
          dateVal = $('attendanceDate').value;
    if (!dateVal) { alert('Select a date'); return; }
    const dateKey = new Date(dateVal).toISOString().split('T')[0];
    const rec     = attendanceData[dateKey] || {};
    tbody.innerHTML = '';
    students.forEach(s => {
      if (s.cls !== cl || s.sec !== sec) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${s.adm}</td>`;
      ['P','A','Lt','HD','L'].forEach(st => {
        tr.innerHTML += `<td><input type="radio" name="${s.adm}" value="${st}" ${rec[s.adm]===st?'checked':''}></td>`;
      });
      tbody.appendChild(tr);
    });
  }
  $('saveAttendance').onclick = async () => {
    const dateVal = $('attendanceDate').value;
    if (!dateVal) { alert('Select a date'); return; }
    const dateKey = new Date(dateVal).toISOString().split('T')[0];
    const rec     = {};
    document.querySelectorAll('#attendanceBody tr').forEach(tr => {
      const adm = tr.children[1].textContent;
      const sel = tr.querySelector('input:checked');
      if (sel) rec[adm] = sel.value;
    });
    attendanceData[dateKey] = rec;
    await save('attendanceData', attendanceData);
    alert('Attendance saved');
  };
  $('resetAttendance').onclick = () => {
    document.querySelectorAll('#attendanceBody input').forEach(i => i.checked = false);
  };

  // --- 6. Analytics Generation ---
  $('generateAnalytics').onclick = () => showAnalytics();
  function showAnalytics() {
    const fromVal = $('analyticsFrom').value,
          toVal   = $('analyticsTo').value;
    if (!fromVal || !toVal) { alert('Select a date range'); return; }
    lastAnalyticsRange = { from: fromVal, to: toVal };
    const dates = [];
    let d = new Date(fromVal), end = new Date(toVal);
    while (d <= end) {
      dates.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
    const stats = [];
    students.forEach(s => {
      let P=0, A=0, Lt=0, HD=0, L=0;
      dates.forEach(dt => {
        const rec = attendanceData[dt] || {};
        const v = rec[s.adm];
        if (v==='P') P++;
        if (v==='A') A++;
        if (v==='Lt') Lt++;
        if (v==='HD') HD++;
        if (v==='L') L++;
      });
      const total = P + A + Lt + HD + L;
      const fine  = A*fineRates.A + Lt*fineRates.Lt + L*fineRates.L + HD*fineRates.HD;
      const paid  = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out   = fine - paid;
      const pct   = total ? (P/total)*100 : 0;
      const status= (out>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';
      stats.push({ name:s.name, adm:s.adm, P, A, Lt, HD, L, total, outstanding:out, status });
    });
    lastAnalyticsStats = stats;
    renderAnalyticsTable(stats);
    show($('analyticsContainer'), $('analyticsActions'));
  }
  function renderAnalyticsTable(stats) {
    const tbl = $('analyticsTable');
    tbl.innerHTML = `
      <thead>
        <tr>
          <th>Name</th><th>Adm#</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>Outstanding</th><th>Status</th>
        </tr>
      </thead>`;
    const body = stats.map(st => `
      <tr>
        <td>${st.name}</td><td>${st.adm}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td>
        <td>${st.total}</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>
      </tr>
    `).join('');
    tbl.innerHTML += `<tbody>${body}</tbody>`;
  }

  // --- 7. PDF Download & Share Handlers ---
  $('downloadRegistrationPDF').onclick = async () => {
    const doc = new jspdf.jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split('T')[0];
    doc.setFontSize(18);
    doc.text('Registered Students', 14, 16);
    doc.setFontSize(10);
    doc.text(`Date: ${today}`, w-14, 16, { align:'right' });
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY:30, html:'#studentsTable' });
    const blob = doc.output('blob');
    doc.save('registration.pdf');
    await sharePdf(blob,'registration.pdf','Registered Students');
  };
  $('shareRegistration').onclick = () => {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students.filter(s=>s.cls===cl&&s.sec===sec).map(s=>{
      const stats = { P:0,A:0,Lt:0,HD:0,L:0 };
      Object.entries(attendanceData).forEach(([d,rec])=>{
        const v=rec[s.adm]; if(v && stats.hasOwnProperty(v)) stats[v]++;
      });
      const total = Object.values(stats).reduce((a,b)=>a+b,0);
      const fine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out  = fine - paid;
      const pct  = total? (stats.P/total)*100 : 0;
      const status = (out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: PKR ${out}\nStatus: ${status}`;
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`,'_blank');
  };
  $('downloadAnalytics').onclick = async () => {
    if (!lastAnalyticsStats.length) { alert('No analytics to download'); return; }
    const doc = new jspdf.jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split('T')[0];
    doc.setFontSize(18);
    doc.text('Attendance Analytics Report', 14, 16);
    doc.setFontSize(10);
    doc.text(`Date: ${today}`, w-14, 16, { align:'right' });
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 32);
    doc.autoTable({ startY:40, html:'#analyticsTable' });
    const blob = doc.output('blob');
    doc.save('analytics_report.pdf');
    await sharePdf(blob,'analytics_report.pdf','Attendance Analytics Report');
  };
  $('shareAnalytics').onclick = () => {
    if (!lastAnalyticsShare) {
      // rebuild share text
      lastAnalyticsShare = `Attendance ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}\n` +
        lastAnalyticsStats.map(st=>`${st.name}: P:${st.P}, A:${st.A}, %:${((st.total?st.P/st.total:0)*100).toFixed(1)}%`).join('\n');
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`,'_blank');
  };

  // --- 8. Payments Modal ---
  const paymentModal = $('paymentModal'),
        paymentForm  = $('paymentForm'),
        paymentList  = $('paymentList'),
        closePayment = $('closePayment');
  function openPaymentModal(adm) {
    paymentModal.classList.remove('hidden');
    paymentList.innerHTML = '';
    (paymentsData[adm] || []).forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.date}: PKR ${p.amount}`;
      paymentList.appendChild(li);
    });
    paymentForm.onsubmit = async e => {
      e.preventDefault();
      const amount = Number($('paymentAmount').value),
            date   = new Date().toISOString().split('T')[0];
      paymentsData[adm] = paymentsData[adm] || [];
      paymentsData[adm].push({ amount, date });
      await save('paymentsData', paymentsData);
      openPaymentModal(adm);
    };
  }
  closePayment.onclick = () => paymentModal.classList.add('hidden');

  // --- 9. Register Import/Export ---
  (function(){
    const tableWrapper = $('registerTableWrapper'),
          loadBtn      = $('loadRegisterFile'),
          changeBtn    = $('changeRegister'),
          saveBtn      = $('downloadRegister'),
          downloadBtn  = $('downloadRegisterPDF'),
          shareBtn     = $('shareRegister'),
          fileInput    = $('registerFile');
    loadBtn.onclick = async () => {
      const [file] = fileInput.files;
      if (!file) return;
      const text = await file.text();
      const [hdr, ...rows] = text.trim().split('\n');
      students = rows.map(r => {
        const [name,adm,parent,contact,occupation,address,cls,sec] = r.split(',');
        return { name, adm, parent, contact, occupation, address, cls, sec };
      });
      await save('students', students);
      renderStudents(); updateCounters(); resetViews();
      tableWrapper.innerHTML = `
        <table id="studentsTable">
          <thead>
            <tr>
              <th>Name</th><th>Adm#</th><th>Parent</th><th>Contact</th>
              <th>Occupation</th><th>Address</th><th>Class</th><th>Section</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(s => `
              <tr>
                <td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>
                <td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
                <td>${s.cls}</td><td>${s.sec}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      hide(loadBtn);
      show(changeBtn, saveBtn, downloadBtn, shareBtn);
    };
    changeBtn.onclick = () => {
      tableWrapper.innerHTML = '';
      hide(changeBtn, saveBtn, downloadBtn, shareBtn);
      show(loadBtn);
    };
  })();

  // --- 10. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
