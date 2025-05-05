// app.js
window.addEventListener('DOMContentLoaded', async () => {
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
  const save = (key, val) => set(key, val);

  // --- 2. State & Defaults ---
  let students        = await get('students')        || [];
  let attendanceData  = await get('attendanceData')  || {};
  let paymentsData    = await get('paymentsData')    || {};
  let lastAdmNo       = await get('lastAdmissionNo') || 0;
  let fineRates       = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct  = await get('eligibilityPct')  || 75;
  let financialDisplay = null;

  let analyticsStats    = [];
  let analyticsRange    = { from: null, to: null };
  let analyticsFilter   = ['all'];
  let analyticsDownload = 'combined';

  // --- 3. Helpers ---
  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }
  const $    = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));
  function getFineMode() {
    return document.querySelector('input[name="fineMode"]:checked')?.value || 'advance';
  }

  // --- 4. SETTINGS: Fines & Eligibility ---
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;
  $('saveSettings').onclick = async () => {
    fineRates = {
      A : +$('fineAbsent').value || 0,
      Lt: +$('fineLate').value   || 0,
      L : +$('fineLeave').value  || 0,
      HD: +$('fineHalfDay').value|| 0,
    };
    eligibilityPct = +$('eligibilityPct').value || 0;
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);
    renderAll();

    // hide inputs, show summary card
    hide($('financialForm'), $('fineModeFieldset'));
    if (!financialDisplay) {
      financialDisplay = document.createElement('div');
      financialDisplay.id = 'financialDisplay';
      financialDisplay.className = 'summary-box';
      document.getElementById('financial-settings').appendChild(financialDisplay);
    }
    financialDisplay.innerHTML = `
      <h3><i class="fas fa-wallet"></i> Fines & Eligibility</h3>
      <p>Absent Fine: PKR ${fineRates.A}</p>
      <p>Late Fine: PKR ${fineRates.Lt}</p>
      <p>Leave Fine: PKR ${fineRates.L}</p>
      <p>Half‑Day Fine: PKR ${fineRates.HD}</p>
      <p>Eligibility Threshold: ${eligibilityPct}%</p>
      <button id="editSettings" class="no-print"><i class="fas fa-edit"></i> Edit</button>
    `;
    show(financialDisplay);
    $('editSettings').onclick = () => {
      show($('financialForm'), $('fineModeFieldset'));
      financialDisplay.remove();
      financialDisplay = null;
    };
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
      $('setupText').textContent      = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderAll();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc  = $('schoolNameInput').value.trim();
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!sc||!cl||!sec){ alert('Complete setup'); return; }
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

  // --- 6. COUNTERS & UTILS ---
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
      $('registerTableWrapper'), $('changeRegister'), $('saveRegister'),
      $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }
  $('teacherClassSelect').onchange   = renderAll;
  $('teacherSectionSelect').onchange = renderAll;

  // --- 7. STUDENT REGISTRATION ---
  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n       = $('studentName').value.trim();
    const p       = $('parentName').value.trim();
    const c       = $('parentContact').value.trim();
    const o       = $('parentOccupation').value.trim();
    const a       = $('parentAddress').value.trim();
    const cl      = $('teacherClassSelect').value;
    const sec     = $('teacherSectionSelect').value;
    const admDate = $('admissionDate').value || null;
    if (!n||!p||!c||!o||!a){ alert('All fields required'); return; }
    const adm = await genAdmNo();
    students.push({ name: n, adm, parent: p, contact: c, occupation: o, address: a, cls: cl, sec, admissionDate: admDate });
    await save('students', students);
    renderAll();
    // clear form
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
    $('admissionDate').value = '';
  };

  $('selectAllStudents').onclick = () => {
    const checked = $('selectAllStudents').checked;
    document.querySelectorAll('#studentsBody .sel').forEach(c => c.checked = checked);
    toggleRegButtons();
  };
  function toggleRegButtons() {
    const any = !!document.querySelector('#studentsBody .sel:checked');
    $('editSelected').disabled       = !any;
    $('deleteSelected').disabled     = !any;
    $('saveRegistration').disabled   = !any;
  }
  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleRegButtons();
  });
  $('editSelected').onclick = () => {
    // placeholder for row-edit logic
  };
  $('deleteSelected').onclick = async () => {
    const toDelete = Array.from(document.querySelectorAll('#studentsBody .sel:checked'))
                         .map(cb=>cb.closest('tr').children[3].textContent);
    students = students.filter(s=>!toDelete.includes(s.adm));
    await save('students', students);
    renderAll();
  };
  $('saveRegistration').onclick = async () => {
    // no in-place edit implemented; simply switch to static view
    hide($('editSelected'), $('deleteSelected'), $('saveRegistration'));
    show($('downloadRegistrationPDF'));
    // inject share & edit buttons
    const actions = document.querySelector('#student-registration .table-actions');
    if (!$('shareStudents')) {
      const shareBtn = document.createElement('button');
      shareBtn.id = 'shareStudents'; shareBtn.className='no-print';
      shareBtn.innerHTML = '<i class="fas fa-share-alt"></i> Share';
      actions.appendChild(shareBtn);
      shareBtn.onclick = () => {
        const msg = students.map((s,i)=>`${i+1}. ${s.adm} ${s.name}`).join('\n');
        window.open(`https://wa.me/?text=${encodeURIComponent('Student List\n'+msg)}`, '_blank');
      };
      const editBtn = document.createElement('button');
      editBtn.id='editRegistration'; editBtn.className='no-print';
      editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
      actions.appendChild(editBtn);
      editBtn.onclick = () => {
        show($('editSelected'), $('deleteSelected'), $('saveRegistration'));
        hide($('downloadRegistrationPDF'), shareBtn, editBtn);
      };
    }
  };
  $('downloadRegistrationPDF').onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Students',14,16);
    doc.setFontSize(12);
    const body = students.map((s,i)=>[i+1, s.adm, s.name, s.parent, s.contact]);
    doc.autoTable({ head:[['#','Adm#','Name','Parent','Contact']], body, startY:24 });
    doc.save('students.pdf');
  };

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent;
    const amt = +$('paymentAmount').value || 0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ date: new Date().toISOString().split('T')[0], amount: amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderAll();
  };
  $('cancelPayment').onclick     = () => hide($('paymentModal'));
  $('paymentModalClose').onclick = () => hide($('paymentModal'));

  // --- 9. MARK ATTENDANCE ---
  $('loadAttendance').onclick = () => {
    const roster = students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
    const container = $('attendanceBody');
    container.innerHTML='';
    roster.forEach((stu,i)=>{
      const row = document.createElement('div'); row.className='attendance-row';
      const nameDiv = document.createElement('div'); nameDiv.className='attendance-name'; nameDiv.textContent=stu.name;
      const btns = document.createElement('div'); btns.className='attendance-buttons';
      const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };
      ['P','A','Lt','HD','L'].forEach(code=>{
        const btn=document.createElement('button');
        btn.className='att-btn'; btn.textContent=code;
        btn.onclick=()=>{
          btns.querySelectorAll('.att-btn').forEach(b=>{b.classList.remove('selected');b.style.background='';b.style.color='';});
          btn.classList.add('selected'); btn.style.background=colors[code]; btn.style.color='#fff';
        };
        btns.appendChild(btn);
      });
      row.append(nameDiv, btns);
      container.appendChild(row);
    });
    show($('attendanceBody'), $('saveAttendance'));
    hide($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), $('attendanceSummary'));
  };
  $('saveAttendance').onclick = async () => {
    const date = $('dateInput').value; if (!date){ alert('Pick a date'); return; }
    attendanceData[date]={};
    const roster = students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
    roster.forEach((s,i)=>{
      const sel = $('attendanceBody').children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = sel ? sel.textContent : 'A';
    });
    await save('attendanceData', attendanceData);
    const summary = $('attendanceSummary'); summary.innerHTML=`<h3>Attendance: ${date}</h3>`;
    const tbl = document.createElement('table');
    tbl.innerHTML='<tr><th>Name</th><th>Status</th><th>Share</th></tr>';
    roster.forEach(s=>{
      const code=attendanceData[date][s.adm], label={P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'}[code];
      tbl.innerHTML+=`<tr><td>${s.name}</td><td>${label}</td><td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td></tr>`;
    });
    summary.appendChild(tbl);
    summary.querySelectorAll('.share-individual').forEach(ic=>{
      ic.onclick=()=>{
        const adm=ic.dataset.adm, st=students.find(x=>x.adm===adm);
        const code=attendanceData[date][adm], label={P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'}[code];
        const msg=`Dear Parent, your child was ${label} on ${date}.`;
        window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`,'_blank');
      };
    });
    hide($('attendanceBody'), $('saveAttendance'));
    show($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), summary);
  };
  $('resetAttendance').onclick = () => {
    show($('attendanceBody'), $('saveAttendance'));
    hide($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), $('attendanceSummary'));
  };
  $('downloadAttendancePDF').onclick = () => {
    const date=$('dateInput').value;
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#attendanceSummary table' });
    doc.save(`attendance_${date}.pdf`);
  };
  $('shareAttendanceSummary').onclick = () => {
    const date=$('dateInput').value;
    const header=`Attendance Report\n${$('setupText').textContent} - ${date}`;
    const lines=students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value)
      .map(s=>`*${s.name}*: ${attendanceData[date][s.adm]||'A'}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`,'_blank');
  };

  // --- 10. Analytics Helpers ---
  function calcStats(s) {
    const allDates=Object.keys(attendanceData).filter(d=>!s.admissionDate||d>=s.admissionDate);
    const stats={P:0,A:0,Lt:0,HD:0,L:0,total:0};
    allDates.forEach(date=>{
      const rec=attendanceData[date]||{}, code=rec[s.adm]||'A';
      stats[code]++; stats.total++;
    });
    const autoFine=stats.A*fineRates.A+stats.Lt*fineRates.Lt+stats.L*fineRates.L+stats.HD*fineRates.HD;
    let fine=getFineMode()==='advance'
      ? (allDates.length*fineRates.A-autoFine)
      : autoFine;
    const paid=(paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
    const outstanding=fine-paid;
    const pct=stats.total?(stats.P/stats.total)*100:0;
    const status=(outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
    return {...stats,fine,outstanding,pct,status};
  }

  // --- 11. Rendering ---
  function renderStudents() {
    updateCounters();
    const tbody=$('studentsBody'); tbody.innerHTML='';
    const roster=students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
    roster.forEach((s,i)=>{
      const st=calcStats(s);
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td>
        <td>${i+1}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${st.outstanding.toFixed(0)}</td><td>${st.status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    document.querySelectorAll('.add-payment-btn').forEach(btn=>btn.onclick=()=>openPaymentModal(btn.dataset.adm));
  }
  function renderAnalytics(stats, from, to) {
    const tbody=$('analyticsBody'); tbody.innerHTML='';
    stats.forEach((st,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td>
        <td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td>
        <td>${st.pct.toFixed(1)}%</td><td>PKR ${st.outstanding.toFixed(0)}</td><td>${st.status}</td>
      `;
      tbody.appendChild(tr);
    });
    $('instructions').textContent=`Period: ${from} to ${to}`;
    show($('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'));
    if (window.barChart) window.barChart.destroy();
    window.barChart=new Chart($('barChart').getContext('2d'),{
      type:'bar',
      data:{ labels:stats.map(s=>s.name), datasets:[{ label:'% Present', data:stats.map(s=>s.total?s.P/s.total*100:0) }] },
      options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
    });
    if (window.pieChart) window.pieChart.destroy();
    window.pieChart=new Chart($('pieChart').getContext('2d'),{
      type:'pie',
      data:{ labels:['Outstanding'], datasets:[{ data:[stats.reduce((sum,s)=>sum+s.outstanding,0)] }] }
    });
  }
  function renderRegister() {
    // identical to original loadRegister+saveRegister flow
  }
  function renderAll() {
    renderStudents();
    resetViews();
  }

  // --- 12. Analytics controls ---
  $('analyticsFilterBtn').onclick   = () => show($('analyticsFilterModal'));
  $('analyticsFilterClose').onclick = () => hide($('analyticsFilterModal'));
  $('applyAnalyticsFilter').onclick = () => {
    analyticsFilter = Array.from(document.querySelectorAll('#analyticsFilterForm input[type="checkbox"]:checked')).map(cb=>cb.value)||['all'];
    analyticsDownload = document.querySelector('#analyticsFilterForm input[name="downloadMode"]:checked').value;
    hide($('analyticsFilterModal'));
    if (analyticsStats.length) renderAnalytics(analyticsStats, analyticsRange.from, analyticsRange.to);
  };
  $('loadAnalytics').onclick = () => {
    if ($('analyticsTarget').value==='student' && !$('analyticsSearch').value.trim()) { alert('Enter adm# or name'); return; }
    let from, to, type=$('analyticsType').value;
    if (type==='date') {
      from=to=$('analyticsDate').value;
    } else if (type==='month') {
      const m=$('analyticsMonth').value, [y,mm]=m.split('-').map(Number);
      from=`${m}-01`; to=`${m}-${String(new Date(y,mm,0).getDate()).padStart(2,'0')}`;
    } else if (type==='semester') {
      const s=$('semesterStart').value, e=$('semesterEnd').value;
      const [sy,sm]=s.split('-').map(Number), [ey,em]=e.split('-').map(Number);
      from=`${s}-01`; to=`${e}-${String(new Date(ey,em,0).getDate()).padStart(2,'0')}`;
    } else if (type==='year') {
      const y=$('yearStart').value;
      from=`${y}-01-01`; to=`${y}-12-31`;
    } else { alert('Select period'); return; }
    let pool=students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
    if ($('analyticsTarget').value==='section') pool=pool.filter(s=>s.sec===$('analyticsSectionSelect').value);
    if ($('analyticsTarget').value==='student') {
      const q=$('analyticsSearch').value.trim().toLowerCase();
      pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));
    }
    analyticsStats=pool.map(s=>({ adm:s.adm, name:s.name, ...calcStats(s) }));
    analyticsRange={ from, to };
    renderAnalytics(analyticsStats, from, to);
  };
  $('downloadAnalytics').onclick = () => {
    const filtered=analyticsStats.filter(st=>{
      if (analyticsFilter.includes('all')) return true;
      return analyticsFilter.some(opt=>{
        switch(opt) {
          case 'registered': return true;
          case 'attendance':  return st.total>0;
          case 'fine':        return st.A>0||st.Lt>0||st.L>0||st.HD>0;
          case 'cleared':     return st.outstanding===0;
          case 'debarred':    return st.status==='Debarred';
          case 'eligible':    return st.status==='Eligible';
          default:            return false;
        }
      });
    });
    if (analyticsDownload==='combined') {
      const doc=new jspdf.jsPDF();
      doc.setFontSize(18); doc.text('Analytics Report',14,16);
      doc.setFontSize(12); doc.text(`Period: ${analyticsRange.from} to ${analyticsRange.to}`,14,24);
      const body=filtered.map((st,i)=>[
        i+1,st.adm,st.name,st.P,st.A,st.Lt,st.HD,st.L,st.total,`${st.pct.toFixed(1)}%`,`PKR ${st.outstanding.toFixed(0)}`,st.status
      ]);
      doc.autoTable({ startY:32, head:[['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']], body, styles:{fontSize:10} });
      doc.save('analytics_report.pdf');
    } else {
      filtered.forEach(st=>{
        const doc=new jspdf.jsPDF();
        doc.setFontSize(16); doc.text(`Report for ${st.name} (${st.adm})`,14,16);
        doc.setFontSize(12);
        const rows=[
          ['Present',st.P],['Absent',st.A],['Late',st.Lt],
          ['Half-Day',st.HD],['Leave',st.L],['Total',st.total],
          ['% Present',`${st.pct.toFixed(1)}%`],['Outstanding',`PKR ${st.outstanding.toFixed(0)}`],
          ['Status',st.status]
        ];
        doc.autoTable({ startY:24, head:[['Metric','Value']], body:rows, styles:{fontSize:10} });
        doc.save(`report_${st.adm}.pdf`);
      });
    }
  };
  $('shareAnalytics').onclick = () => {
    const text=analyticsStats.map((st,i)=>`${i+1}. ${st.adm} ${st.name}: ${st.pct.toFixed(1)}% / PKR ${st.outstanding.toFixed(0)}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent('Analytics Report\n'+text)}`,'_blank');
  };

  // --- 13. ATTENDANCE REGISTER ---
  $('loadRegister').onclick = () => {
    const m=$('registerMonth').value; if (!m){ alert('Pick month'); return; }
    const [y,mm]=m.split('-').map(Number), days=new Date(y,mm,0).getDate();
    const rh=$('registerHeader'), rb=$('registerBody');
    rh.innerHTML=`<th>#</th><th>Adm#</th><th>Name</th>` + [...Array(days)].map((_,i)=>`<th>${i+1}</th>`).join('');
    rb.innerHTML='';
    const roster=students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
    roster.forEach((s,i)=>{
      let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1;d<=days;d++){
        const key=`${m}-${String(d).padStart(2,'0')}`;
        const code=(attendanceData[key]||{})[s.adm]||'A';
        const colors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};
        const style=code==='A'?'':`style="background:${colors[code]};color:#fff"`;
        row+=`<td class="reg-cell" ${style}><span class="status-text">${code}</span></td>`;
      }
      const tr=document.createElement('tr'); tr.innerHTML=row; rb.appendChild(tr);
    });
    rb.querySelectorAll('.reg-cell').forEach(cell=>{
      cell.onclick=()=>{
        const span=cell.querySelector('.status-text');
        const codes=['A','P','Lt','HD','L'];
        const idx=(codes.indexOf(span.textContent)+1)%codes.length;
        const code=codes[idx];
        span.textContent=code;
        if (code==='A'){ cell.style.background=''; cell.style.color=''; }
        else { const colors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'}; cell.style.background=colors[code]; cell.style.color='#fff'; }
      };
    });
    show($('registerTableWrapper'), $('saveRegister'));
    hide($('loadRegister'), $('changeRegister'), $('downloadRegister'), $('shareRegister'));
  };
  $('saveRegister').onclick = async () => {
    const m=$('registerMonth').value, [y,mm]=m.split('-').map(Number), days=new Date(y,mm,0).getDate();
    const rb=$('registerBody');
    Array.from(rb.children).forEach(tr=>{
      const adm=tr.children[1].textContent;
      for (let d=1;d<=days;d++){
        const code=tr.children[3+d-1].querySelector('.status-text').textContent;
        const key=`${m}-${String(d).padStart(2,'0')}`;
        attendanceData[key]=attendanceData[key]||{};
        attendanceData[key][adm]=code;
      }
    });
    await save('attendanceData', attendanceData);
    show($('changeRegister'), $('downloadRegister'), $('shareRegister'));
    hide($('saveRegister'));
  };
  $('changeRegister').onclick = () => {
    hide($('registerTableWrapper'), $('changeRegister'), $('downloadRegister'), $('shareRegister'));
    show($('loadRegister'));
  };
  $('downloadRegister').onclick = () => {
    const doc=new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    doc.setFontSize(18); doc.text('Attendance Register',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#registerTable', tableWidth:'auto', styles:{fontSize:10} });
    doc.save('attendance_register.pdf');
  };
  $('shareRegister').onclick = () => {
    const header=`Attendance Register\n${$('setupText').textContent}`;
    const rows=Array.from($('registerBody').children).map(tr=>
      Array.from(tr.children).map(td=>
        td.querySelector('.status-text')?td.querySelector('.status-text').textContent:td.textContent
      ).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+rows.join('\n'))}`,'_blank');
  };

  // --- 14. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }

  // Initial render
  renderAll();
});
