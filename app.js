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
  let analyticsFilterOptions = ['all'], analyticsDownloadMode = 'combined';
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

  // --- 4. DOWNLOAD & SHARE HANDLERS ---

  // 4.1 Student List PDF
  $('downloadRegistrationPDF').onclick = async () => {
    const doc = new jspdf.jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split('T')[0];

    doc.setFontSize(18);
    doc.text('Student List', 14, 16);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.text(`Date: ${today}`, w - 14, 24, { align: 'right' });
    doc.autoTable({ startY: 32, html: '#studentsTable' });

    const blob = doc.output('blob');
    doc.save('registration.pdf');
    await sharePdf(blob, 'registration.pdf', 'Student List');
  };
  $('shareRegistration').onclick = () => {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students.filter(s => s.cls === cl && s.sec === sec).map(s => {
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => { if (rec[s.adm]) stats[rec[s.adm]]++; });
      const totalMarked = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const totalFine   = stats.A * fineRates.A + stats.Lt * fineRates.Lt + stats.L * fineRates.L + stats.HD * fineRates.HD;
      const paid        = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const outstanding = totalFine - paid;
      const pct         = totalMarked ? (stats.P/totalMarked)*100 : 0;
      const status      = (outstanding>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';
      return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: PKR ${outstanding}\nStatus: ${status}`;
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // 4.2 Attendance Summary PDF
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

  downloadAttendanceBtn.onclick = async () => {
    if (!attendanceSummaryDiv.innerHTML.trim()) {
      alert('No attendance to download. Please generate a report first.');
      return;
    }
    const doc = new jspdf.jsPDF();
    const w = doc.internal.pageSize.getWidth();
    const dt = dateInput.value;

    doc.setFontSize(18);
    doc.text('Attendance Report', 14, 16);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.text(`Date: ${dt}`, w - 14, 24, { align: 'right' });
    doc.autoTable({ startY: 32, html: '#attendanceSummary table' });

    const blob = doc.output('blob');
    doc.save(`attendance_${dt}.pdf`);
    await sharePdf(blob, `attendance_${dt}.pdf`, 'Attendance Report');
  };
  shareAttendanceBtn.onclick = () => {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const dt = dateInput.value;
    const header = `*Attendance Report*\nClass ${cl} Section ${sec} - ${dt}`;
    const lines = Array.from(attendanceSummaryDiv.querySelectorAll('table tbody tr'))
      .map(tr => `*${tr.children[0].textContent}*: ${tr.children[1].textContent}`)
      .join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // 4.3 Attendance Register PDF
  $('downloadRegister').onclick = async () => {
    const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    const w = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split('T')[0];

    doc.setFontSize(18);
    doc.text('Attendance Register', 14, 20);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 36);
    doc.text(`Date: ${today}`, w - 14, 36, { align:'right' });
    doc.autoTable({ startY:50, html:'#registerTable', tableWidth:'auto', styles:{fontSize:10} });

    const blob = doc.output('blob');
    doc.save('attendance_register.pdf');
    await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
  };
  $('shareRegister').onclick = () => {
    const header = `Attendance Register\n${$('setupText').textContent}`;
    const rows = Array.from($('registerBody').children)
      .map(tr => Array.from(tr.children).map(td => td.textContent).join(' '))
      .join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows)}`, '_blank');
  };

  // --- 5. SETTINGS: Fines & Eligibility ---
  const formDiv      = $('financialForm'),
        saveSettings = $('saveSettings'),
        inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map(id => $(id)),
        settingsCard = document.createElement('div'),
        editSettings = document.createElement('button');
  settingsCard.id = 'settingsCard'; settingsCard.className = 'card hidden';
  editSettings.id = 'editSettings'; editSettings.className = 'btn no-print hidden'; editSettings.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard); formDiv.parentNode.appendChild(editSettings);

  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveSettings.onclick = async () => {
    fineRates = {
      A : Number($('fineAbsent').value)   || 0,
      Lt: Number($('fineLate').value)     || 0,
      L : Number($('fineLeave').value)    || 0,
      HD: Number($('fineHalfDay').value)  || 0,
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

  // --- 6. SETUP: School, Class & Section ---
  async function loadSetup() {
    const [sc,cl,sec] = await Promise.all([ get('schoolName'), get('teacherClass'), get('teacherSection') ]);
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
    const sc  = $('schoolNameInput').value.trim(),
          cl  = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    if (!sc||!cl||!sec) { alert('Complete setup'); return; }
    await Promise.all([ save('schoolName', sc), save('teacherClass', cl), save('teacherSection', sec) ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- 7. COUNTERS & UTILS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target; let count = 0; const step = Math.max(1, target/100);
      (function upd(){ count+=step; span.textContent = count<target?Math.ceil(count):target; if(count<target) requestAnimationFrame(upd); })();
    });
  }
  function updateCounters() {
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
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
  $('teacherClassSelect').onchange   = ()=>{ renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = ()=>{ renderStudents(); updateCounters(); resetViews(); };

  // --- 8. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value, tbody=$('studentsBody');
    tbody.innerHTML=''; let idx=0;
    students.forEach((s,i)=>{
      if(s.cls!==cl||s.sec!==sec) return; idx++;
      // original fine/attendance logic
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(rec=>{ if(rec[s.adm]) stats[rec[s.adm]]++; });
      const totalMarked=stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const totalFine=stats.A*fineRates.A+stats.Lt*fineRates.Lt+stats.L*fineRates.L+stats.HD*fineRates.HD;
      const paid=(paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const outstanding=totalFine-paid;
      const pct=totalMarked?(stats.P/totalMarked)*100:0;
      const status=(outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr=document.createElement('tr'); tr.dataset.index=i;
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td>
        <td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${outstanding}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked=false; toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }
  function toggleButtons() {
    const any=!!document.querySelector('.sel:checked');
    $('editSelected').disabled=!any; $('deleteSelected').disabled=!any;
  }
  $('studentsBody').addEventListener('change',e=>e.target.classList.contains('sel')&&toggleButtons());
  $('selectAllStudents').onclick=()=>{ document.querySelectorAll('.sel').forEach(c=>c.checked=$('selectAllStudents').checked); toggleButtons(); };

  // Registration/edit/delete/save flows unchanged...

  // --- 9. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('payAdm').textContent=adm; $('paymentAmount').value=''; show($('paymentModal'));
  }
  $('paymentModalClose').onclick=()=>hide($('paymentModal'));
  $('savePayment').onclick=async()=>{
    const adm=$('payAdm').textContent, amt=Number($('paymentAmount').value)||0;
    paymentsData[adm]=(paymentsData[adm]||[]); paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
    await save('paymentsData', paymentsData); hide($('paymentModal')); renderStudents();
  };
  $('cancelPayment').onclick=()=>hide($('paymentModal'));

  // --- 10. MARK ATTENDANCE ---
  loadAttendanceBtn.onclick=()=>{ /* unchanged */ };
  saveAttendanceBtn.onclick=async()=>{ /* unchanged */ };
  resetAttendanceBtn.onclick=()=>{ /* unchanged */ };

  // --- 11. ANALYTICS & CHARTS ---
  const atg=$('analyticsTarget'), asel=$('analyticsSectionSelect'), atype=$('analyticsType'),
        adate=$('analyticsDate'), amonth=$('analyticsMonth'), sems=$('semesterStart'),
        seme=$('semesterEnd'), ayear=$('yearStart'), asearch=$('analyticsSearch'),
        loadA=$('loadAnalytics'), resetA=$('resetAnalytics'),
        instr=$('instructions'), acont=$('analyticsContainer'),
        graphs=$('graphs'), aacts=$('analyticsActions'),
        barCtx=$('barChart').getContext('2d'), pieCtx=$('pieChart').getContext('2d');
  let barChart, pieChart;
  const analyticsStatusNames={P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'};
  const analyticsStatusColors={
    P:getComputedStyle(document.documentElement).getPropertyValue('--success').trim(),
    A:getComputedStyle(document.documentElement).getPropertyValue('--danger').trim(),
    Lt:getComputedStyle(document.documentElement).getPropertyValue('--warning').trim(),
    HD:'#FF9800',L:getComputedStyle(document.documentElement).getPropertyValue('--info').trim()
  };

  $('analyticsFilterBtn').onclick=()=>show($('analyticsFilterModal'));
  $('analyticsFilterClose').onclick=()=>hide($('analyticsFilterModal'));
  $('applyAnalyticsFilter').onclick=()=>{/* unchanged */};

  atg.onchange=()=>{/* unchanged */};
  atype.onchange=()=>{/* unchanged */};
  resetA.onclick=e=>{/* unchanged */};

  loadA.onclick=()=>{/* compute stats and call renderAnalytics */};

  function renderAnalytics(stats, from, to) {
    // build & filter table, draw charts (unchanged)...
    lastAnalyticsShare=/* unchanged string prep */;

    // DOWNLOAD: combined vs individual
    $('downloadAnalytics').onclick=async()=>{
      if(!stats.length){ alert('No analytics to download. Generate first.'); return; }
      if(analyticsDownloadMode==='combined'){
        const doc=new jspdf.jsPDF();
        doc.setFontSize(18); doc.text('Analytics Report',14,16);
        doc.setFontSize(12); doc.text(`Period: ${from} to ${to}`,14,24);
        doc.autoTable({ startY:32, html:'#analyticsTable' });
        const blob=doc.output('blob');
        doc.save('analytics_report.pdf');
        await sharePdf(blob,'analytics_report.pdf','Analytics Report');
      } else {
        const doc=new jspdf.jsPDF();
        stats.forEach((st,i)=>{
          if(i>0) doc.addPage();
          doc.setFontSize(18);
          doc.text(`Analytics - ${st.name}`,14,16);
          doc.setFontSize(12);
          doc.text(`Adm#: ${st.adm}`,14,24);
          doc.text(`Period: ${from} to ${to}`,14,30);
          doc.autoTable({
            startY:40,
            head:[['P','A','Lt','HD','L','Total','%','Outstanding','Status']],
            body:[[
              st.P, st.A, st.Lt, st.HD, st.L,
              st.total,
              st.total?((st.P/st.total)*100).toFixed(1)+'%':'0.0%',
              'PKR '+st.outstanding,
              st.status
            ]]
          });
        });
        const blob=doc.output('blob');
        doc.save('analytics_individual.pdf');
        await sharePdf(blob,'analytics_individual.pdf','Analytics Reports');
      }
    };

    $('shareAnalytics').onclick=()=>{/* unchanged */};
  }

  // --- 12. ATTENDANCE REGISTER ---
  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value;
    if (!m) { alert('Pick month'); return; }
    const [y, mm] = m.split('-').map(Number);
    const days = new Date(y, mm, 0).getDate();

    // build header: #, Adm#, Name, 1..days
    $('registerHeader').innerHTML =
      `<th>#</th><th>Adm#</th><th>Name</th>` +
      [...Array(days)].map((_, i) => `<th>${i + 1}</th>`).join('');

    // clear previous
    $('registerBody').innerHTML = '';

    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;

    // for each student in class/section
    students
      .filter(s => s.cls === cl && s.sec === sec)
      .forEach((s, i) => {
        let row = `<td>${i + 1}</td><td>${s.adm}</td><td>${s.name}</td>`;
        for (let d = 1; d <= days; d++) {
          const key = `${m}-${String(d).padStart(2, '0')}`;
          const c   = (attendanceData[key] || {})[s.adm] || 'A';
          const style = c === 'A'
            ? ''
            : `style="background:${
                c === 'P'  ? 'var(--success)' :
                c === 'Lt' ? 'var(--warning)' :
                c === 'HD' ? '#FF9800' :
                c === 'L'  ? 'var(--info)' :
                             'var(--danger)'
              };color:#fff"`;
          row += `<td class="reg-cell" ${style}><span class="status-text">${c}</span></td>`;
        }
        const tr = document.createElement('tr');
        tr.innerHTML = row;
        $('registerBody').appendChild(tr);
      });

    // make each cell clickable to cycle status
    document.querySelectorAll('.reg-cell').forEach(cell => {
      cell.onclick = () => {
        const span = cell.querySelector('.status-text');
        const codes = ['A','P','Lt','HD','L'];
        const idx = (codes.indexOf(span.textContent) + 1) % codes.length;
        const c = codes[idx];
        span.textContent = c;
        if (c === 'A') {
          cell.style.background = '';
          cell.style.color = '';
        } else {
          const color = 
            c === 'P'  ? 'var(--success)' :
            c === 'Lt' ? 'var(--warning)' :
            c === 'HD' ? '#FF9800' :
            c === 'L'  ? 'var(--info)' :
                         'var(--danger)';
          cell.style.background = color;
          cell.style.color = '#fff';
        }
      };
    });

    show($('registerTableWrapper'), $('saveRegister'));
    hide($('loadRegister'), $('changeRegister'), $('downloadRegister'), $('shareRegister'));
  };

  $('saveRegister').onclick = async () => {
    const m = $('registerMonth').value;
    const [y, mm] = m.split('-').map(Number);
    const days = new Date(y, mm, 0).getDate();

    // persist each day's status
    Array.from($('registerBody').children).forEach(tr => {
      const adm = tr.children[1].textContent;
      for (let d = 1; d <= days; d++) {
        const code = tr.children[3 + d - 1].querySelector('.status-text').textContent;
        const key  = `${m}-${String(d).padStart(2, '0')}`;
        attendanceData[key] = attendanceData[key] || {};
        attendanceData[key][adm] = code;
      }
    });

    await save('attendanceData', attendanceData);

    hide($('saveRegister'));
    show($('changeRegister'), $('downloadRegister'), $('shareRegister'));
  };

  $('changeRegister').onclick = () => {
    hide($('registerTableWrapper'), $('changeRegister'), $('downloadRegister'), $('shareRegister'), $('saveRegister'));
    $('registerHeader').innerHTML = '';
    $('registerBody').innerHTML   = '';
    show($('loadRegister'));
  };

  // --- 13. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
