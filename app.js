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
  let analyticsDownloadMode = 'combined';
  let lastAnalyticsStats = [], lastAnalyticsRange = { from: null, to: null }, lastAnalyticsShare = '';

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 3. DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- DOWNLOAD & SHARE HANDLERS ---
  // Student Registration PDF
  $('downloadRegistrationPDF').onclick = async () => {
    const doc = new jspdf.jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split('T')[0];

    doc.setFontSize(18);
    doc.text('Registered Students', 14, 16);
    doc.setFontSize(10);
    doc.text(`Date: ${today}`, pageWidth - 14, 16, { align: 'right' });
    const setupText = $('setupText').textContent;
    doc.setFontSize(12);
    doc.text(setupText, 14, 24);

    doc.autoTable({ startY: 30, html: '#studentsTable' });
    const blob = doc.output('blob');
    doc.save('registration.pdf');
    await sharePdf(blob, 'registration.pdf', 'Registered Students');
  };

  $('shareRegistration').onclick = () => {
    const header = `*Students List*\n${$('setupText').textContent}`;
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const lines = students.filter(s => s.cls === cl && s.sec === sec).map(s => {
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => { if (rec[s.adm]) stats[rec[s.adm]]++; });
      const totalMarked = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const outstanding = totalFine - paid;
      const pct = totalMarked ? (stats.P/totalMarked)*100 : 0;
      const status = (outstanding>0||pct<eligibilityPct) ? 'Debarred' : 'Eligible';
      return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: PKR ${outstanding}\nStatus: ${status}`;
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // --- 4. SETTINGS: Fines & Eligibility ---
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
    fineRates = { A:Number($('fineAbsent').value)||0, Lt:Number($('fineLate').value)||0, L:Number($('fineLeave').value)||0, HD:Number($('fineHalfDay').value)||0 };
    eligibilityPct = Number($('eligibilityPct').value)||0;
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

  // --- 5. SETUP: School, Class & Section ---
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
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc = $('schoolNameInput').value.trim(), cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    if (!sc||!cl||!sec) { alert('Complete setup'); return; }
    await Promise.all([ save('schoolName', sc), save('teacherClass', cl), save('teacherSection', sec) ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- 6. COUNTERS & UTILS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target; let count = 0; const step = Math.max(1, target/100);
      (function upd(){ count+=step; span.textContent = count<target?Math.ceil(count):target; if(count<target) requestAnimationFrame(upd); })();
    });
  }
  function updateCounters() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  function resetViews() {
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'),
      $('registerTableWrapper'), $('changeRegister'),
      $('saveRegister'), $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }
  $('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- 7. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value, tbody = $('studentsBody');
    tbody.innerHTML = ''; let idx = 0;
    students.forEach((s,i) => {
      if (s.cls!==cl||s.sec!==sec) return;
      idx++;
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(rec=>{ if(rec[s.adm]) stats[rec[s.adm]]++; });
      const total = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const fine = stats.A*fineRates.A+stats.Lt*fineRates.Lt+stats.L*fineRates.L+stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out = fine-paid;
      const pct = total? (stats.P/total)*100:0;
      const status = (out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr = document.createElement('tr'); tr.dataset.index=i;
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td><td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${out}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked=false; toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }
  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e=> e.target.classList.contains('sel') && toggleButtons());
  $('selectAllStudents').onclick = ()=>{ document.querySelectorAll('.sel').forEach(c=>c.checked=$('selectAllStudents').checked); toggleButtons(); };

  $('addStudent').onclick = async e=>{
    e.preventDefault();
    const n=$('studentName').value.trim(),p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(),o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim(),cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a){alert('All fields required');return;}
    if(!/^\d{7,15}$/.test(c)){alert('Contact 7–15 digits');return;}
    const adm=await genAdmNo();
    students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls:cl,sec});
    await save('students',students); renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };

  $('editSelected').onclick = ()=>{
    document.querySelectorAll('.sel:checked').forEach(cb=>{
      const tr=cb.closest('tr'),i=+tr.dataset.index,s=students[i];
      tr.innerHTML=`
        <td><input type="checkbox" class="sel" checked></td><td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"></td><td>${s.adm}</td>
        <td><input value="${s.parent}"></td><td><input value="${s.contact}"></td>
        <td><input value="${s.occupation}"></td><td><input value="${s.address}"></td><td colspan="3"></td>
      `;
    });
    hide($('editSelected')); show($('doneEditing'));
  };
  $('doneEditing').onclick=async()=>{
    document.querySelectorAll('#studentsBody tr').forEach(tr=>{
      const inps=[...tr.querySelectorAll('input:not(.sel)')];
      if(inps.length===5){
        const [n,p,c,o,a]=inps.map(i=>i.value.trim()), adm=tr.children[3].textContent;
        const idx=students.findIndex(x=>x.adm===adm);
        if(idx>-1) students[idx]={...students[idx],name:n,parent:p,contact:c,occupation:o,address:a};
      }
    });
    await save('students',students);
    hide($('doneEditing')); show($('editSelected'),$('deleteSelected'),$('saveRegistration'));
    renderStudents(); updateCounters();
  };
  $('deleteSelected').onclick=async()=>{
    if(!confirm('Delete?'))return;
    const toDel=[...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students=students.filter((_,i)=>!toDel.includes(i));
    await save('students',students); renderStudents(); updateCounters(); resetViews();
  };
  $('saveRegistration').onclick=async()=>{
    if(!$('doneEditing').classList.contains('hidden')){alert('Finish editing');return;}
    await save('students',students);
    hide(document.querySelector('#student-registration .row-inline'),$('editSelected'),$('deleteSelected'),$('selectAllStudents'),$('saveRegistration'));
    show($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  $('editRegistration').onclick=()=>{
    show(document.querySelector('#student-registration .row-inline'),$('selectAllStudents'),$('editSelected'),$('deleteSelected'),$('saveRegistration'));
    hide($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm){
    $('payAdm').textContent=adm; $('paymentAmount').value=''; show($('paymentModal'));
  }
  $('paymentModalClose').onclick=()=>hide($('paymentModal'));
  $('savePayment').onclick=async()=>{
    const adm=$('payAdm').textContent, amt=Number($('paymentAmount').value)||0;
    paymentsData[adm]=paymentsData[adm]||[];
    paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
    await save('paymentsData',paymentsData); hide($('paymentModal')); renderStudents();
  };
  $('cancelPayment').onclick=()=>hide($('paymentModal'));

  // --- 9. MARK ATTENDANCE ---
  const dateInput             = $('dateInput');
  const loadAttendanceBtn     = $('loadAttendance');
  const saveAttendanceBtn     = $('saveAttendance');
  const resetAttendanceBtn    = $('resetAttendance');
  const downloadAttendanceBtn = $('downloadAttendancePDF');
  const shareAttendanceBtn    = $('shareAttendanceSummary');
  const attendanceBodyDiv     = $('attendanceBody');
  const attendanceSummaryDiv  = $('attendanceSummary');
  const statusNames           = { P: 'Present', A: 'Absent', Lt: 'Late', HD: 'Half-Day', L: 'Leave' };
  const statusColors          = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: '#FF9800', L: 'var(--info)' };

  loadAttendanceBtn.onclick = () => {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const date = dateInput.value;
    if (!date) { alert('Select a date'); return; }
    attendanceBodyDiv.innerHTML = '';
    students.filter(s => s.cls === cl && s.sec === sec).forEach((s,i) => {
      const row = document.createElement('div'); row.className = 'attendance-row';
      const label = document.createElement('span'); label.textContent = `${i+1}. ${s.name}`;
      const select = document.createElement('select');
      Object.entries(statusNames).forEach(([code,name]) => {
        const opt = document.createElement('option'); opt.value = code; opt.textContent = name;
        if (attendanceData[date] && attendanceData[date][s.adm] === code) opt.selected = true;
        select.appendChild(opt);
      });
      select.onchange = () => {
        attendanceData[date] = attendanceData[date] || {};
        attendanceData[date][s.adm] = select.value;
      };
      row.append(label, select);
      attendanceBodyDiv.appendChild(row);
    });
    show(attendanceBodyDiv, saveAttendanceBtn, resetAttendanceBtn); hide(loadAttendanceBtn, attendanceSummaryDiv);
  };

  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    await save('attendanceData', attendanceData);
    alert('Attendance saved');
    renderAttendanceSummary();
  };

  resetAttendanceBtn.onclick = () => {
    const date = dateInput.value;
    if (confirm('Clear attendance for this date?')) {
      delete attendanceData[date];
      save('attendanceData', attendanceData);
      attendanceBodyDiv.innerHTML = '';
      hide(saveAttendanceBtn, resetAttendanceBtn);
      show(loadAttendanceBtn);
    }
  };

  function renderAttendanceSummary() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const dates = Object.keys(attendanceData).sort();
    let html = '<table id="attendanceSummaryTable" class="striped"><thead><tr><th>Date</th><th>Present</th><th>Absent</th><th>Late</th><th>Half-Day</th><th>Leave</th></tr></thead><tbody>';
    dates.forEach(d => {
      let stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      students.filter(s => s.cls === cl && s.sec === sec).forEach(s => {
        const code = attendanceData[d] && attendanceData[d][s.adm] || 'A';
        stats[code]++;
      });
      html += `<tr><td>${d}</td><td>${stats.P}</td><td>${stats.A}</td><td>${stats.Lt}</td><td>${stats.HD}</td><td>${stats.L}</td></tr>`;
    });
    html += '</tbody></table>';
    attendanceSummaryDiv.innerHTML = html;
    lastAnalyticsRange = { from: dates[0]||'', to: dates[dates.length-1]||'' };
    show(attendanceSummaryDiv, downloadAttendanceBtn, shareAttendanceBtn);
  }

  downloadAttendanceBtn.onclick = async () => {
    if (!Object.keys(attendanceData).length) { alert('No attendance to download'); return; }
    const doc = new jspdf.jsPDF();
    const setup = $('setupText').textContent;
    doc.setFontSize(18);
    doc.text('Attendance Summary', 14, 16);
    doc.setFontSize(12);
    doc.text(setup, 14, 24);
    doc.autoTable({ startY: 32, html: '#attendanceSummaryTable' });
    const blob = doc.output('blob');
    doc.save('attendance_summary.pdf');
    await sharePdf(blob, 'attendance_summary.pdf', 'Attendance Summary');
  };

  shareAttendanceBtn.onclick = () => {
    const tableText = Array.from(document.querySelectorAll('#attendanceSummaryTable tr')).map(row =>
      Array.from(row.cells).map(cell => cell.textContent).join('\t')
    ).join('\n');
    const message = `Attendance Summary\n${$('setupText').textContent}\n\n${tableText}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  // --- 10. ANALYTICS PDF ---
  // Helper to write header & subheader on each page
  function writeHeader(doc) {
    doc.setFontSize(18);
    doc.text('Attendance Analytics Report', 14, 16);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
  }

  $('downloadAnalytics').onclick = async () => {
    if (!lastAnalyticsStats.length) {
      alert('No analytics to download. Generate report first.');
      return;
    }

    if (analyticsDownloadMode === 'combined' || analyticsDownloadMode === 'table') {
      const doc = new jspdf.jsPDF();
      writeHeader(doc);
      doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 32);
      doc.autoTable({ startY: 40, html: '#analyticsTable' });
      const blob = doc.output('blob');
      doc.save('analytics_report.pdf');
      await sharePdf(blob, 'analytics_report.pdf', 'Attendance Analytics Report');

    } else {
      const doc = new jspdf.jsPDF();
      lastAnalyticsStats.forEach((st, i) => {
        if (i > 0) doc.addPage();
        writeHeader(doc);
        doc.text('Individual Attendance Analytics Report', 14, 32);
        doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 40);

        doc.setFontSize(14);
        doc.text(`Name: ${st.name}`,   14, 56);
        doc.text(`Adm#: ${st.adm}`,    14, 72);
        doc.text(`Present: ${st.P}`,   14, 88);
        doc.text(`Absent: ${st.A}`,    14, 104);
        doc.text(`Late: ${st.Lt}`,     14, 120);
        doc.text(`Half-Day: ${st.HD}`, 14, 136);
        doc.text(`Leave: ${st.L}`,     14, 152);
        doc.text(`Total: ${st.total}`, 14, 168);
        const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : '0.0';
        doc.text(`% Present: ${pct}%`, 14, 184);
        doc.text(`Outstanding: PKR ${st.outstanding}`, 14, 200);
        doc.text(`Status: ${st.status}`, 14, 216);
      });
      const blob = doc.output('blob');
      doc.save('analytics_report.pdf');
      await sharePdf(blob, 'analytics_report.pdf', 'Individual Attendance Analytics Report');
    }
  };

  $('shareAnalytics').onclick = () => {
    if (!lastAnalyticsShare) {
      alert('No analytics to share. Generate report first.');
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');
  };

  // --- 11. ATTENDANCE REGISTER ---
  let registerDates = [], registerFrom = '', registerTo = '';
  const fromInput   = $('regFromDate');
  const toInput     = $('regToDate');
  const loadRegBtn  = $('loadRegister');
  const changeRegBtn    = $('changeRegister');
  const downloadRegBtn  = $('downloadRegister');
  const shareRegBtn     = $('shareRegister');
  const registerWrapper = $('registerTableWrapper');

  function formatDate(d) {
    return d.toISOString().split('T')[0];
  }

  loadRegBtn.onclick = () => {
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const from = fromInput.value;
    const to   = toInput.value;
    if (!from || !to) { alert('Select both From and To dates'); return; }
    const start = new Date(from), end = new Date(to);
    if (start > end) { alert('From must be before To'); return; }

    registerDates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      registerDates.push(formatDate(d));
    }
    registerFrom = formatDate(start);
    registerTo   = formatDate(end);

    const headerCols = registerDates.map(d => `<th>${d}</th>`).join('');
    const rows = students
      .filter(s => s.cls === cl && s.sec === sec)
      .map(s => {
        const cells = registerDates.map(d => {
          const st = attendanceData[d] && attendanceData[d][s.adm];
          const code = st || 'A';
          const name = statusNames[code];
          const color = statusColors[code];
          return `<td style="color:${color}">${name}</td>`;
        }).join('');
        return `<tr><td>${s.name}</td>${cells}</tr>`;
      }).join('');

    registerWrapper.innerHTML = `
      <table id="registerTable" class="striped">
        <thead><tr><th>Student</th>${headerCols}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    show(registerWrapper, changeRegBtn, downloadRegBtn, shareRegBtn);
    hide(loadRegBtn);
  };

  changeRegBtn.onclick = () => {
    registerWrapper.innerHTML = '';
    registerDates = [];
    registerFrom = registerTo = '';
    hide(registerWrapper, changeRegBtn, downloadRegBtn, shareRegBtn);
    show(loadRegBtn);
  };

  downloadRegBtn.onclick = async () => {
    if (!registerDates.length) {
      alert('No register to download. Load it first.');
      return;
    }
    const doc = new jspdf.jsPDF();
    const setup = $('setupText').textContent;

    doc.setFontSize(18);
    doc.text('Attendance Register', 14, 16);
    doc.setFontSize(12);
    doc.text(setup, 14, 24);
    doc.text(`Period: ${registerFrom} to ${registerTo}`, 14, 32);

    doc.autoTable({ startY: 40, html: '#registerTable' });

    const blob = doc.output('blob');
    doc.save('attendance_register.pdf');
    await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
  };

  shareRegBtn.onclick = () => {
    if (!registerDates.length) {
      alert('No register to share. Load it first.');
      return;
    }
    const setup = $('setupText').textContent;
    let text = `*Attendance Register*\n${setup}\nPeriod: ${registerFrom} to ${registerTo}\n\n`;
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    students.filter(s => s.cls === cl && s.sec === sec).forEach(s => {
      const line = registerDates.map(d => {
        const code = attendanceData[d] && attendanceData[d][s.adm] || 'A';
        return statusNames[code][0];
      }).join('');
      text += `${s.name}: ${line}\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
