// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- Universal PDF share helper (must come first) ---
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

  // --- 0. Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- 1. IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) {
    console.error('idb-keyval not found');
    return;
  }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // --- 2. State & Defaults ---
  let students = (await get('students')) || [];
  let attendanceData = (await get('attendanceData')) || {};
  let paymentsData = (await get('paymentsData')) || {};
  let lastAdmNo = (await get('lastAdmissionNo')) || 0;
  let fineRates = (await get('fineRates')) || { A: 50, Lt: 20, L: 10, HD: 30 };
  let eligibilityPct = (await get('eligibilityPct')) || 75;
  let analyticsFilterOptions = ['all'],
      analyticsDownloadMode = 'combined';
  let lastAnalyticsStats = [],
      lastAnalyticsRange = { from: null, to: null },
      lastAnalyticsShare = '';

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
    const cl = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students
      .filter(s => s.cls === cl && s.sec === sec)
      .map(s => {
        const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
        Object.values(attendanceData).forEach(rec => rec[s.adm] && stats[rec[s.adm]]++);
        const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
        const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
        const out = totalFine - paid;
        const pct = (Object.values(stats).reduce((a,b)=>a+b,0)) ? (stats.P/Object.values(stats).reduce((a,b)=>a+b,0))*100 : 0;
        const status = (out>0||pct<eligibilityPct) ? 'Debarred' : 'Eligible';
        return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: PKR ${out}\nStatus: ${status}`;
      }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // --- 4. SETTINGS: Fines & Eligibility ---
  const formDiv = $('financialForm'),
        saveSettings = $('saveSettings'),
        inputs = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map(id => $(id)),
        settingsCard = document.createElement('div'),
        editSettings = document.createElement('button');
  settingsCard.id = 'settingsCard'; settingsCard.className = 'card hidden';
  editSettings.id = 'editSettings'; editSettings.className = 'btn no-print hidden'; editSettings.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard); formDiv.parentNode.appendChild(editSettings);

  $('fineAbsent').value = fineRates.A;
  $('fineLate').value = fineRates.Lt;
  $('fineLeave').value = fineRates.L;
  $('fineHalfDay').value = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveSettings.onclick = async () => {
    fineRates = {
      A: Number($('fineAbsent').value) || 0,
      Lt: Number($('fineLate').value) || 0,
      L: Number($('fineLeave').value) || 0,
      HD: Number($('fineHalfDay').value) || 0
    };
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
  editSettings.onclick = () => { hide(settingsCard, editSettings); show(formDiv, saveSettings, ...inputs); };

  // --- 5. SETUP: School, Class & Section ---
  async function loadSetup() {
    const [sc,cl,sec] = await Promise.all([ get('schoolName'), get('teacherClass'), get('teacherSection') ]);
    if (sc && cl && sec) {
      $('schoolNameInput').value = sc;
      $('teacherClassSelect').value = cl;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm')); show($('setupDisplay'));
      renderStudents(); updateCounters(); resetViews();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc = $('schoolNameInput').value.trim(),
          cl = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    if (!sc||!cl||!sec) return alert('Complete setup');
    await Promise.all([ save('schoolName',sc), save('teacherClass',cl), save('teacherSection',sec) ]);
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
    tbody.innerHTML = ''; let idx=0;
    students.forEach((s,i)=>{
      if(s.cls!==cl||s.sec!==sec) return;
      idx++;
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(rec=>rec[s.adm]&&stats[rec[s.adm]]++);
      const total = Object.values(stats).reduce((a,b)=>a+b,0);
      const fine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out = fine-paid;
      const pct = total ? (stats.P/total)*100 : 0;
      const status = (out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr = document.createElement('tr'); tr.dataset.index=i;
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
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
    if(!n||!p||!c||!o||!a) return alert('All fields required');
    if(!/^\d{7,15}$/.test(c)) return alert('Contact 7–15 digits');
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
    if(!confirm('Delete?')) return;
    const toDel=[...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students=students.filter((_,i)=>!toDel.includes(i));
    await save('students',students); renderStudents(); updateCounters(); resetViews();
  };
  $('saveRegistration').onclick=async()=>{
    if(!$('doneEditing').classList.contains('hidden')) return alert('Finish editing');
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
  const dateInput               = $('dateInput'),
        loadAttendanceBtn       = $('loadAttendance'),
        saveAttendanceBtn       = $('saveAttendance'),
        resetAttendanceBtn      = $('resetAttendance'),
        downloadAttendanceBtn   = $('downloadAttendancePDF'),
        shareAttendanceBtn      = $('shareAttendanceSummary'),
        attendanceBodyDiv       = $('attendanceBody'),
        attendanceSummaryDiv    = $('attendanceSummary'),
        statusNames             = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' };

  loadAttendanceBtn.onclick = () => {
    if (!dateInput.value) return alert('Select date');
    renderAttendanceTable(dateInput.value);
    show(attendanceBodyDiv, saveAttendanceBtn, resetAttendanceBtn, attendanceSummaryDiv);
    hide(loadAttendanceBtn);
  };

  function renderAttendanceTable(date) {
    const tbody = $('attendanceTableBody');
    tbody.innerHTML = '';
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const rec = attendanceData[date] || {};
    let idx = 0;
    students.forEach(s=>{
      if(s.cls!==cl||s.sec!==sec) return;
      idx++;
      const status = rec[s.adm] || 'P';
      const tr = document.createElement('tr');
      tr.innerHTML=`
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>
          <select data-adm="${s.adm}">
            ${Object.entries(statusNames).map(([code,label])=>`<option value="${code}" ${code===status?'selected':''}>${label}</option>`).join('')}
          </select>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    attendanceData[date] = {};
    attendanceBodyDiv.querySelectorAll('select[data-adm]').forEach(sel=>{
      attendanceData[date][sel.dataset.adm] = sel.value;
    });
    await save('attendanceData',attendanceData);
    alert('Attendance saved');
    show(downloadAttendanceBtn, shareAttendanceBtn, $('analyticsContainer'));
    hide(saveAttendanceBtn, resetAttendanceBtn);
    generateAttendanceSummary(date);
  };

  resetAttendanceBtn.onclick = () => renderAttendanceTable(dateInput.value);

  function generateAttendanceSummary(date) {
    const rec = attendanceData[date] || {};
    const lines = Object.entries(statusNames).map(([code,label])=>{
      const count = Object.values(rec).filter(v=>v===code).length;
      return `${label}: ${count}`;
    });
    $('attendanceSummaryText').textContent = `Attendance for ${date}\n` + lines.join(' | ');
  }

  downloadAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text(`Attendance - ${date}`,14,16);
    doc.autoTable({ startY:24, html:'#attendanceTable' });
    const blob = doc.output('blob');
    doc.save(`attendance_${date}.pdf`);
    await sharePdf(blob, `attendance_${date}.pdf`, `Attendance ${date}`);
  };

  shareAttendanceBtn.onclick = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent($('attendanceSummaryText').textContent)}`,'_blank');
  };

  // --- 10. ANALYTICS: Charts & Summaries ---
  $('generateAnalytics').onclick = () => {
    const from = $('analyticsFrom').value, to = $('analyticsTo').value;
    if (!from || !to || from > to) return alert('Select valid range');
    lastAnalyticsRange = { from, to };
    computeAnalytics(from, to);
    show($('analyticsActions'), $('graphs'));
  };

  function computeAnalytics(from, to) {
    const dates = Object.keys(attendanceData).filter(d=>d>=from&&d<=to).sort();
    const stats = students.filter(s=>s.cls===$('teacherClassSelect').value&&s.sec===$('teacherSectionSelect').value)
      .map(s=>{
        const recs = dates.map(d=>attendanceData[d][s.adm]||'P');
        const counts={P:0,A:0,Lt:0,HD:0,L:0};
        recs.forEach(c=>counts[c]++);
        const total = recs.length;
        const fine = counts.A*fineRates.A + counts.Lt*fineRates.Lt + counts.L*fineRates.L + counts.HD*fineRates.HD;
        const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
        const outstanding = fine - paid;
        const pct = total ? (counts.P/total)*100 : 0;
        const status = (outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
        return { name:s.name, adm:s.adm, ...counts, total, outstanding, status };
      });
    lastAnalyticsStats = stats;
    renderAnalyticsTable(stats);
  }

  function renderAnalyticsTable(stats) {
    const tbody = $('analyticsTableBody');
    tbody.innerHTML = '';
    stats.forEach(st=>{
      const tr = document.createElement('tr');
      tr.innerHTML=`
        <td><input type="checkbox" class="analytics-select" data-adm="${st.adm}"></td>
        <td>${st.name}</td><td>${st.adm}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td>
        <td>${st.total}</td><td>${st.outstanding}</td><td>${st.status}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Placeholder for charts
  function renderAnalyticsCharts(stats, dates) { /* implement as needed */ }

  // Download/Share mode
  $('analyticsDownloadMode').onchange = e => analyticsDownloadMode = e.target.value;
  $('downloadAnalytics').onclick = async () => {
    if (!lastAnalyticsStats.length) return alert('No analytics to download');
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18);
    if (analyticsDownloadMode === 'combined') {
      doc.text('Attendance Analytics Report',14,16);
      doc.setFontSize(12);
      doc.text($('setupText').textContent,14,24);
      doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`,14,32);
      doc.autoTable({ startY:40, html:'#analyticsTable' });
      const blob = doc.output('blob');
      doc.save('analytics_report.pdf');
      await sharePdf(blob,'analytics_report.pdf','Attendance Analytics Report');
    } else {
      doc.text('Individual Attendance Analytics Report',14,16);
      doc.setFontSize(12);
      doc.text($('setupText').textContent,14,24);
      doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`,14,32);
      let y=48;
      lastAnalyticsStats.forEach((st,i)=>{
        if(i>0){ doc.addPage(); y=48; }
        doc.setFontSize(14);
        doc.text(`Name: ${st.name}`,14,y); y+=16;
        doc.text(`Adm#: ${st.adm}`,14,y); y+=16;
        doc.setFontSize(12);
        ['P','A','Lt','HD','L'].forEach(code=>{
          doc.text(`${code}: ${st[code]}`,14,y); y+=14;
        });
        doc.text(`Total: ${st.total}`,14,y); y+=16;
        doc.text(`Outstanding: PKR ${st.outstanding}`,14,y); y+=16;
        doc.text(`Status: ${st.status}`,14,y); y+=20;
      });
      const blob = doc.output('blob');
      doc.save('individual_analytics_book.pdf');
      await sharePdf(blob,'individual_analytics_book.pdf','Individual Attendance Analytics');
    }
  };
  $('shareAnalytics').onclick = () => {
    if (!lastAnalyticsStats.length) return alert('No analytics to share');
    const header = `Analytics ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`;
    const lines = lastAnalyticsStats.map(st=>
      `${st.name} (${st.adm}) - %Present: ${((st.P/st.total)*100).toFixed(1)}%, Fine: PKR ${st.outstanding}, ${st.status}`
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+lines.join('\n'))}`,'_blank');
  };
  $('resetAnalytics').onclick = () => {
    hide($('analyticsActions'),$('graphs'));
    $('analyticsFrom').value=''; $('analyticsTo').value='';
    lastAnalyticsStats = [];
    $('analyticsTableBody').innerHTML='';
  };
  // --- 10. ATTENDANCE REGISTER (missing section) ---
  const loadRegisterBtn       = $('loadRegister'),
        registerTableWrapper  = $('registerTableWrapper'),
        registerTableBody     = $('registerTableBody'),
        changeRegisterBtn     = $('changeRegister'),
        downloadRegisterBtn   = $('downloadRegister'),
        shareRegisterBtn      = $('shareRegister');

  loadRegisterBtn.onclick = () => {
    renderAttendanceRegister();
    show(registerTableWrapper, changeRegisterBtn, downloadRegisterBtn, shareRegisterBtn);
    hide(loadRegisterBtn);
  };

  changeRegisterBtn.onclick = () => {
    hide(registerTableWrapper, changeRegisterBtn, downloadRegisterBtn, shareRegisterBtn);
    show(loadRegisterBtn);
  };

  function renderAttendanceRegister() {
    const cl = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    const dates = Object.keys(attendanceData)
                        .filter(d => attendanceData[d])
                        .sort();
    // build header row
    const thead = $('registerTableHead');
    thead.innerHTML = '';
    let trHead = document.createElement('tr');
    trHead.innerHTML = `<th>#</th><th>Name</th><th>Adm#</th>` +
                       dates.map(d => `<th>${d}</th>`).join('');
    thead.appendChild(trHead);

    // build body rows
    registerTableBody.innerHTML = '';
    let idx = 0;
    students.forEach(s => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      const tr = document.createElement('tr');
      const cells = dates.map(d => {
        const code = (attendanceData[d] || {})[s.adm] || 'P';
        return `<td>${statusNames[code] || code}</td>`;
      }).join('');
      tr.innerHTML = `<td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>${cells}`;
      registerTableBody.appendChild(tr);
    });
  }

  // Download Attendance Register PDF
  downloadRegisterBtn.onclick = async () => {
    const doc = new jspdf.jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18);
    doc.text('Attendance Register', 14, 16);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({
      startY: 32,
      html: '#registerTable',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [240,240,240] }
    });
    const blob = doc.output('blob');
    doc.save('attendance_register.pdf');
    await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
  };

  // Share Attendance Register via WhatsApp (as plain text)
  shareRegisterBtn.onclick = () => {
    const cl = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    const dates = Object.keys(attendanceData).sort();
    let text = `Register: Class ${cl} Section ${sec}\nDates: ${dates.join(', ')}\n\n`;
    students.forEach(s => {
      if (s.cls !== cl || s.sec !== sec) return;
      const row = dates.map(d => {
        const code = (attendanceData[d] || {})[s.adm] || 'P';
        return statusNames[code] || code;
      }).join(' | ');
      text += `${s.name} (${s.adm}): ${row}\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- 11. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});```
