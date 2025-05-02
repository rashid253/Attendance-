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
  let finesData       = await get('finesData')       || {};
  let paymentsData    = await get('paymentsData')    || {};
  let lastAdmNo       = await get('lastAdmissionNo') || 0;
  let fineRates       = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct  = await get('eligibilityPct')  || 75;

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 3. DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- 4. SETTINGS: Fines & Eligibility ---
  const formDiv     = $('financialForm');
  const saveBtn     = $('saveSettings');
  const inputs      = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct'].map($);
  const settingsCard = document.createElement('div');
  settingsCard.id    = 'settingsCard';
  settingsCard.className = 'card hidden';
  const editBtn      = document.createElement('button');
  editBtn.id         = 'editSettings';
  editBtn.className  = 'btn no-print hidden';
  editBtn.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editBtn);

  // initialize
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveBtn.onclick = async () => {
    fineRates = {
      A : Number($('fineAbsent').value)   || 0,
      Lt: Number($('fineLate').value)     || 0,
      L : Number($('fineLeave').value)    || 0,
      HD: Number($('fineHalfDay').value)  || 30,
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
      </div>
    `;
    hide(formDiv, ...inputs, saveBtn);
    show(settingsCard, editBtn);
  };

  editBtn.onclick = () => {
    hide(settingsCard, editBtn);
    show(formDiv, ...inputs, saveBtn);
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
      const target = +span.dataset.target; let count = 0;
      const step = Math.max(1, target/100);
      (function upd(){
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(upd);
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
  $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- 7. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody'); tbody.innerHTML = ''; let idx = 0;
    students.forEach((s,i)=>{
      if (s.cls!==cl||s.sec!==sec) return; idx++;
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(r=>stats[r[s.adm]||'A']++);
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid      = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out       = totalFine - paid;
      const totalDays = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct       = totalDays?(stats.P/totalDays)*100:0;
      const status    = (out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr=document.createElement('tr'); tr.dataset.index=i;
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>
        <td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${out}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false; toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }
  function toggleButtons(){
    const any=!!document.querySelector('.sel:checked');
    $('editSelected').disabled=!any; $('deleteSelected').disabled=!any;
  }
  $('studentsBody').addEventListener('change',e=>e.target.classList.contains('sel')&&toggleButtons());
  $('selectAllStudents').onclick=()=>{ document.querySelectorAll('.sel').forEach(c=>c.checked=$('selectAllStudents').checked); toggleButtons(); };

  $('addStudent').onclick=async e=>{
    e.preventDefault();
    const n=$('studentName').value.trim(),p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(),o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim(),cl=$('teacherClassSelect').value,
          sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a){alert('All fields required');return;}
    if(!/^\d{7,15}$/.test(c)){alert('Contact 7–15 digits');return;}
    const adm=await genAdmNo();
    students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls:cl,sec});
    await save('students',students);
    renderStudents();updateCounters();resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };

  $('editSelected').onclick=()=>{
    document.querySelectorAll('.sel:checked').forEach(cb=>{
      const tr=cb.closest('tr'),i=+tr.dataset.index,s=students[i];
      tr.innerHTML=`
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
  $('doneEditing').onclick=async()=>{
    document.querySelectorAll('#studentsBody tr').forEach(tr=>{
      const inputs=[...tr.querySelectorAll('input:not(.sel)')];
      if(inputs.length===5){
        const [n,p,c,o,a]=inputs.map(i=>i.value.trim());
        const adm=tr.children[3].textContent, idx=students.findIndex(s=>s.adm===adm);
        if(idx>-1) students[idx]={...students[idx],name:n,parent:p,contact:c,occupation:o,address:a};
      }
    });
    await save('students',students);
    hide($('doneEditing')); show($('editSelected'),$('deleteSelected'),$('saveRegistration'));
    renderStudents();updateCounters();
  };
  $('deleteSelected').onclick=async()=>{
    if(!confirm('Delete?')) return;
    const toDel=[...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students=students.filter((_,i)=>!toDel.includes(i));
    await save('students',students);
    renderStudents();updateCounters();resetViews();
  };
  $('saveRegistration').onclick=async()=>{
    if(!$('doneEditing').classList.contains('hidden')){alert('Finish editing');return;}
    await save('students',students);
    hide(document.querySelector('#student-registration .row-inline'),$('editSelected'),$('deleteSelected'),$('selectAllStudents'),$('saveRegistration'));
    show($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF'));
    renderStudents();updateCounters();
  };
  $('editRegistration').onclick=()=>{ show(document.querySelector('#student-registration .row-inline'),$('selectAllStudents'),$('editSelected'),$('deleteSelected'),$('saveRegistration')); hide($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF')); renderStudents();updateCounters(); };
  $('shareRegistration').onclick=()=>{
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const header=`*Students List*\nClass ${cl} Section ${sec}`;
    const lines=students.filter(s=>s.cls===cl&&s.sec===sec).map(s=>{
      const tf=(finesData[s.adm]||[]).reduce((a,f)=>a+f.amount,0);
      const tp=(paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out=tf-tp, days=Object.keys(attendanceData).length;
      const pres=Object.values(attendanceData).filter(r=>r[s.adm]==='P').length;
      const pct=days?(pres/days)*100:0, st=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: PKR ${out}\nStatus: ${st}`;
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`,'_blank');
  };
  $('downloadRegistrationPDF').onclick=()=>{
    const doc=new jspdf.jsPDF(); doc.setFontSize(18); doc.text('Student List',14,16); doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({startY:32,html:'#studentsTable'});
    const url=doc.output('bloburl'); window.open(url,'_blank'); doc.save('registration.pdf');
  };

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm){ $('payAdm').textContent=adm; $('paymentAmount').value=''; show($('paymentModal')); }
  $('savePayment').onclick=async()=>{
    const adm=$('payAdm').textContent, amt=Number($('paymentAmount').value)||0;
    paymentsData[adm]=paymentsData[adm]||[]; paymentsData[adm].push({date:new Date().toISOString().split('T')[0],amount:amt});
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
  const statusNames           = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' };
  const statusColors          = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = '';
    attendanceSummaryDiv.innerHTML = '';
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s => s.cls === cl && s.sec === sec);

    roster.forEach((stu, i) => {
      const row    = document.createElement('div');
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
            b.style.background = '';
            b.style.color = '';
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
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert('Please pick a date'); return; }
    attendanceData[date] = {};
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s => s.cls === cl && s.sec === sec);

    roster.forEach((s, i) => {
      const btn = attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = btn ? btn.textContent : 'A';
    });

    await save('attendanceData', attendanceData);

    attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement('table');
    tbl.innerHTML = `<tr><th>Name</th><th>Status</th><th>Share</th></tr>`;

    roster.forEach(s => {
      const code = attendanceData[date][s.adm];
      tbl.innerHTML += `
        <tr>
          <td>${s.name}</td>
          <td>${statusNames[code]}</td>
          <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
        </tr>`;
    });

    attendanceSummaryDiv.appendChild(tbl);

    attendanceSummaryDiv.querySelectorAll('.share-individual')
      .forEach(ic => ic.onclick = () => {
        const adm     = ic.dataset.adm;
        const student = students.find(x => x.adm === adm);
        const code    = attendanceData[date][adm];
        const msg     = `Dear Parent, your child was ${statusNames[code]} on ${date}.`;
        window.open(`https://wa.me/${student.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      });

    hide(attendanceBodyDiv, saveAttendanceBtn);
    show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  resetAttendanceBtn.onclick = () => {
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  downloadAttendanceBtn.onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text('Attendance Report', 14, 16);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 32, html: '#attendanceSummary table' });
    const url = doc.output('bloburl');
    window.open(url, '_blank');
    doc.save(`attendance_${dateInput.value}.pdf`);
  };

  shareAttendanceBtn.onclick = () => {
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const date = dateInput.value;
    const header = `*Attendance Report*\nClass ${cl} Section ${sec} - ${date}`;
    const lines  = students.filter(s => s.cls === cl && s.sec === sec)
      .map(s => `*${s.name}*: ${statusNames[attendanceData[date][s.adm]]}`)
      .join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // --- 10. ANALYTICS ---
  const atg   = $('analyticsTarget');
  const asel  = $('analyticsSectionSelect');
  const atype = $('analyticsType');
  const adate = $('analyticsDate');
  const amonth= $('analyticsMonth');
  const sems  = $('semesterStart');
  const seme  = $('semesterEnd');
  const ayear = $('yearStart');
  const asearch = $('analyticsSearch');
  const loadA   = $('loadAnalytics');
  const resetA  = $('resetAnalytics');
  const instr   = $('instructions');
  const acont   = $('analyticsContainer');
  const graphs  = $('graphs');
  const aacts   = $('analyticsActions');
  const barCtx  = $('barChart').getContext('2d');
  const pieCtx  = $('pieChart').getContext('2d');
  let barChart, pieChart, lastAnalyticsShare = '';

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearch].forEach(x => x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
    if (atg.value === 'section') asel.classList.remove('hidden');
    if (atg.value === 'student') asearch.classList.remove('hidden');
  };

  atype.onchange = () => {
    [adate, amonth, sems, seme, ayear].forEach(x => x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
    resetA.classList.remove('hidden');
    switch (atype.value) {
      case 'date':      adate.classList.remove('hidden'); break;
      case 'month':     amonth.classList.remove('hidden'); break;
      case 'semester':  sems.classList.remove('hidden'); seme.classList.remove('hidden'); break;
      case 'year':      ayear.classList.remove('hidden'); break;
    }
  };

  resetA.onclick = e => {
    e.preventDefault();
    atype.value = '';
    [adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
    resetA.classList.add('hidden');
  };

  loadA.onclick = () => {
    if (atg.value === 'student' && !asearch.value.trim()) {
      alert('Please enter an admission number or name');
      return;
    }
    let from, to;
    if (atype.value === 'date') {
      from = to = adate.value;
    } else if (atype.value === 'month') {
      const [y, m] = amonth.value.split('-').map(Number);
      from = `${amonth.value}-01`;
      to   = `${amonth.value}-${new Date(y, m, 0).getDate()}`;
    } else if (atype.value === 'semester') {
      const [sy, sm] = sems.value.split('-').map(Number);
      const [ey, em] = seme.value.split('-').map(Number);
      from = `${sems.value}-01`;
      to   = `${seme.value}-${new Date(ey, em, 0).getDate()}`;
    } else if (atype.value === 'year') {
      from = `${ayear.value}-01-01`;
      to   = `${ayear.value}-12-31`;
    } else {
      alert('Select a period');
      return;
    }

    const cls = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    let pool = students.filter(s => s.cls === cls && s.sec === sec);

    if (atg.value === 'section') pool = pool.filter(s => s.sec === asel.value);
    if (atg.value === 'student') {
      const q = asearch.value.trim().toLowerCase();
      pool = pool.filter(s => s.adm === q || s.name.toLowerCase().includes(q));
    }

    const stats = pool.map(s => ({ adm: s.adm, name: s.name, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    Object.entries(attendanceData).forEach(([d, recs]) => {
      if (d < from || d > to) return;
      stats.forEach(st => {
        const c = recs[st.adm] || 'A';
        st[c]++; st.total++;
      });
    });

    stats.forEach(st => {
      const tf = st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
      const tp = (paymentsData[st.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      st.outstanding = tf - tp;
      const pct = st.total ? (st.P/st.total)*100 : 0;
      st.status = (st.outstanding > 0 || pct < eligibilityPct) ? 'Debarred' : 'Eligible';
    });

    // render table
    const thead = $('analyticsTable').querySelector('thead tr');
    thead.innerHTML = ['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']
      .map(h => `<th>${h}</th>`).join('');
    const tbody = $('analyticsBody');
    tbody.innerHTML = '';
    stats.forEach((st, i) => {
      const pct = st.total ? ((st.P/st.total)*100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${st.adm}</td>
        <td>${st.name}</td>
        <td>${st.P}</td>
        <td>${st.A}</td>
        <td>${st.Lt}</td>
        <td>${st.HD}</td>
        <td>${st.L}</td>
        <td>${st.total}</td>
        <td>${pct}%</td>
        <td>PKR ${st.outstanding}</td>
        <td>${st.status}</td>
      `;
      tbody.appendChild(tr);
    });

    instr.textContent = `Period: ${from} to ${to}`;
    show(instr, acont, graphs, aacts);
    resetA.classList.remove('hidden');

    // bar chart
    barChart?.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: stats.map(st => st.name),
        datasets: [{ label: '% Present', data: stats.map(st => st.total ? (st.P/st.total)*100 : 0) }]
      },
      options: { scales: { y: { beginAtZero:true, max:100 } } }
    });

    // pie chart
    const aggFine = stats.reduce((sum, st) => sum + st.outstanding, 0);
    pieChart?.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: { labels: ['Outstanding'], datasets: [{ data: [aggFine] }] }
    });

    lastAnalyticsShare = `Analytics (${from} to ${to})\n` +
      stats.map((st,i) => `${i+1}. ${st.adm} ${st.name}: ${((st.P/st.total)*100).toFixed(1)}% / PKR ${st.outstanding}`)
           .join('\n');
  };

  $('shareAnalytics').onclick = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');

  $('downloadAnalytics').onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Analytics Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#analyticsTable' });
    const url = doc.output('bloburl'); window.open(url,'_blank'); doc.save('analytics_report.pdf');
  };

  // --- 11. ATTENDANCE REGISTER ---
  const loadReg     = $('loadRegister');
  const changeReg   = $('changeRegister');
  const saveReg     = $('saveRegister');
  const dlReg       = $('downloadRegister');
  const shReg       = $('shareRegister');
  const rm          = $('registerMonth');
  const rh          = $('registerHeader');
  const rb          = $('registerBody');
  const rw          = $('registerTableWrapper');
  const regCodes    = ['A','P','Lt','HD','L'];
  const regColors   = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  loadReg.onclick = () => {
    const m = rm.value;
    if (!m) { alert('Pick month'); return; }
    const [y, mm] = m.split('-').map(Number);
    const days = new Date(y, mm, 0).getDate();

    rh.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
      [...Array(days)].map((_,i)=>`<th>${i+1}</th>`).join('');

    rb.innerHTML = '';
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((s,i) => {
      let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1; d<=days; d++) {
        const key = `${m}-${String(d).padStart(2,'0')}`;
        const c = (attendanceData[key]||{})[s.adm] || 'A';
        const style = c==='A' ? '' : ` style="background:${regColors[c]};color:#fff"`;
        row += `<td class="reg-cell"${style}><span class="status-text">${c}</span></td>`;
      }
      const tr = document.createElement('tr');
      tr.innerHTML = row;
      rb.appendChild(tr);
    });

    rb.querySelectorAll('.reg-cell').forEach(cell => {
      cell.onclick = () => {
        const span = cell.querySelector('.status-text');
        let idx = regCodes.indexOf(span.textContent);
        idx = (idx+1) % regCodes.length;
        const c = regCodes[idx];
        span.textContent = c;
        if (c==='A') { cell.style.background=''; cell.style.color=''; }
        else        { cell.style.background=regColors[c]; cell.style.color='#fff'; }
      };
    });

    show(rw, saveReg);
    hide(loadReg, changeReg, dlReg, shReg);
  };

  saveReg.onclick = async () => {
    const m = rm.value, [y, mm] = m.split('-').map(Number);
    const days = new Date(y, mm, 0).getDate();
    Array.from(rb.children).forEach(tr => {
      const adm = tr.children[1].textContent;
      for (let d=1; d<=days; d++) {
        const code = tr.children[3 + d - 1].querySelector('.status-text').textContent;
        const key = `${m}-${String(d).padStart(2,'0')}`;
        attendanceData[key] = attendanceData[key] || {};
        attendanceData[key][adm] = code;
      }
    });
    await save('attendanceData', attendanceData);
    hide(saveReg);
    show(changeReg, dlReg, shReg);
  };

  changeReg.onclick = () => {
    hide(changeReg, dlReg, shReg);
    show(saveReg);
  };

  dlReg.onclick = () => {
    // Landscape & A4
    const doc = new jspdf.jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });
    doc.setFontSize(18);
    doc.text('Attendance Register', 14, 16);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({
      startY: 32,
      html: '#registerTable',
      tableWidth: 'auto',
      styles: { fontSize: 10 }
    });
    const url = doc.output('bloburl');
    window.open(url, '_blank');
    doc.save('attendance_register.pdf');
  };

  shReg.onclick = () => {
    const header = `Attendance Register\n${$('setupText').textContent}`;
    const rows = Array.from(rb.children).map(tr =>
      Array.from(tr.children).map(td =>
        td.querySelector('.status-text') ? td.querySelector('.status-text').textContent : td.textContent
      ).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows.join('\n'))}`, '_blank');
  };

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
// --- Analytics Fine Report PDF Block ---

document.addEventListener('DOMContentLoaded', () => {
  const fineReportBtn = document.getElementById('generateFineReport');
  fineReportBtn.addEventListener('click', generateFineReportPDF);
});

async function generateFineReportPDF() {
  // 1. Load settings & all data
  const fineRates      = await idbKeyval.get('fineRates')      || { A:0, Lt:0, L:0, HD:0 };
  const eligibilityPct = await idbKeyval.get('eligibilityPct') || 0;
  const attendanceData = await idbKeyval.get('attendanceData') || {};
  const students       = await idbKeyval.get('students')       || [];

  // 2. Determine period based on selection
  const type = document.getElementById('analyticsType').value;
  let fromDate, toDate;
  if (type === 'date') {
    fromDate = toDate = document.getElementById('analyticsDate').value;
  } else if (type === 'month') {
    const m = document.getElementById('analyticsMonth').value;
    const [y, mon] = m.split('-').map(Number);
    fromDate = `${m}-01`;
    const last = new Date(y, mon, 0).getDate();
    toDate   = `${m}-${String(last).padStart(2,'0')}`;
  } else if (type === 'semester') {
    const s1 = document.getElementById('semesterStart').value;
    const s2 = document.getElementById('semesterEnd').value;
    const [sy, sm] = s1.split('-').map(Number);
    const [ey, em] = s2.split('-').map(Number);
    fromDate = `${s1}-01`;
    const last2 = new Date(ey, em, 0).getDate();
    toDate   = `${s2}-${String(last2).padStart(2,'0')}`;
  } else if (type === 'year') {
    const y = document.getElementById('yearStart').value;
    fromDate = `${y}-01-01`;
    toDate   = `${y}-12-31`;
  } else {
    alert('Please select a valid period.');
    return;
  }

  // 3. Compute fines entries dynamically
  const finesEntries = [];
  for (const [date, recs] of Object.entries(attendanceData)) {
    if (date < fromDate || date > toDate) continue;
    students.forEach(s => {
      const status = recs[s.adm] || 'A';
      const amount = fineRates[status] || 0;
      if (amount > 0) {
        finesEntries.push({
          studentId: s.adm,
          name:      s.name,
          class:     s.cls,
          section:   s.sec,
          date,
          type:      status,
          amount
        });
      }
    });
  }

  // 4. Prepare PDF document
  const doc = new jspdf.jsPDF();
  let y = 10;

  // Fine & Eligibility Criteria Section
  doc.setFontSize(14).text('Fine & Eligibility Criteria', 10, y); y += 8;
  doc.setFontSize(12);
  doc.text(`Absent Fine: PKR ${fineRates.A}`,    10, y); y += 6;
  doc.text(`Late Fine: PKR ${fineRates.Lt}`,     10, y); y += 6;
  doc.text(`Leave Fine: PKR ${fineRates.L}`,     10, y); y += 6;
  doc.text(`Half-Day Fine: PKR ${fineRates.HD}`, 10, y); y += 6;
  doc.text(`Passing % Threshold: ${eligibilityPct}%`, 10, y); y += 10;

  // Detailed Fine Table
  doc.setFontSize(14).text('Detailed Fine Report', 10, y); y += 6;
  const fineTable = finesEntries.map(f => [
    f.studentId, f.name, f.class, f.section, f.date, f.type, f.amount
  ]);
  doc.autoTable({
    startY: y,
    head: [['Adm#','Name','Class','Section','Date','Type','Amount (PKR)']],
    body: fineTable,
    styles: { fontSize: 10 }
  });

  // 5. Open & save PDF
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl);
  doc.save('fine_report.pdf');
}
// ====== 3. JAVASCRIPT: FILTER + PDF BOOKLET ======
document.addEventListener('DOMContentLoaded', () => {
  // references
  const students        = await idbKeyval.get('students')       || [];
  const attendanceData  = await idbKeyval.get('attendanceData') || {};
  const fineRates       = await idbKeyval.get('fineRates')      || { A:0,Lt:0,L:0,HD:0 };
  const eligibilityPct  = await idbKeyval.get('eligibilityPct') || 0;

  const el = id => document.getElementById(id);
  const pcs = {
    filterStudent:    el('filterStudent'),
    filterPeriodType: el('filterPeriodType'),
    filterDate:       el('filterDate'),
    filterMonth:      el('filterMonth'),
    filterSemester:   el('filterSemester'),
    filterSemStart:   el('filterSemStart'),
    filterSemEnd:     el('filterSemEnd'),
    filterYear:       el('filterYear'),
    filterStatus:     el('filterStatus'),
    applyFilter:      el('applyFilter'),
    generateBooklet:  el('generateBooklet')
  };

  // show/hide period inputs
  pcs.filterPeriodType.addEventListener('change', () => {
    document.querySelectorAll('.period-input').forEach(i=>i.classList.add('hidden'));
    switch(pcs.filterPeriodType.value) {
      case 'date':     pcs.filterDate.classList.remove('hidden'); break;
      case 'month':    pcs.filterMonth.classList.remove('hidden'); break;
      case 'semester': pcs.filterSemester.classList.remove('hidden'); break;
      case 'year':     pcs.filterYear.classList.remove('hidden'); break;
    }
  });

  // applyFilter builds list of student IDs matching criteria
  pcs.applyFilter.addEventListener('click', () => {
    const nameQ = pcs.filterStudent.value.trim().toLowerCase();
    let filtered = students.filter(s =>
      !nameQ || s.adm.includes(nameQ) || s.name.toLowerCase().includes(nameQ)
    );
    // time window
    let from, to;
    switch(pcs.filterPeriodType.value) {
      case 'date':
        from = to = pcs.filterDate.value; break;
      case 'month':
        from = `${pcs.filterMonth.value}-01`;
        to   = `${pcs.filterMonth.value}-${new Date(...pcs.filterMonth.value.split('-').map(Number),0).getDate()}`;
        break;
      case 'semester':
        let [sy,sm]=pcs.filterSemStart.value.split('-');
        let [ey,em]=pcs.filterSemEnd.value.split('-');
        from = `${pcs.filterSemStart.value}-01`;
        to   = `${pcs.filterSemEnd.value}-${new Date(+ey,+em,0).getDate()}`;
        break;
      case 'year':
        from = `${pcs.filterYear.value}-01-01`;
        to   = `${pcs.filterYear.value}-12-31`;
        break;
    }
    if(from && to) {
      filtered = filtered.filter(s => {
        const recs = Object.entries(attendanceData)
          .filter(([d])=>d>=from&&d<=to)
          .map(([,r])=>r[s.adm]||'A');
        const total = recs.length;
        const pres  = recs.filter(c=>'P'===c).length;
        const out   = recs.reduce((sum,c)=>sum + (fineRates[c]||0),0)
                  - ( (await idbKeyval.get('paymentsData'))[s.adm]||[] )
                    .reduce((a,p)=>a+p.amount,0);
        // status filter
        switch(pcs.filterStatus.value) {
          case 'eligible':   return out<=0 && (total?pres/total*100:0)>=eligibilityPct;
          case 'debarred':   return out>0 || (total?pres/total*100:0)<eligibilityPct;
          case 'outstanding':return out>0;
          case 'avg':        return total?pres/total*100>=eligibilityPct:false;
        }
        return true;
      });
    }
    pcs.generateBooklet.filtered = filtered;
    alert(`${filtered.length} students matched`);
  });

  // generate PDF booklet
  pcs.generateBooklet.addEventListener('click', () => {
    const list = pcs.generateBooklet.filtered || students;
    const doc = new jspdf.jsPDF();
    list.forEach((s,i) => {
      if(i>0) doc.addPage();
      // header
      doc.setFontSize(16).text(`${s.name} (Adm# ${s.adm})`,10,20);
      // table of attendance & fines summary
      const rows = [];
      for(const [date,recs] of Object.entries(attendanceData)) {
        // filter by from/to if set...
        rows.push([
          date,
          recs[s.adm]||'A',
          fineRates[recs[s.adm]||'A']||0
        ]);
      }
      doc.autoTable({
        startY:30,
        head:[['Date','Status','Fine']],
        body:rows
      });
      // eligibility line
      doc.text(`Eligibility Threshold: ${eligibilityPct}%`,10, doc.lastAutoTable.finalY+10);
    });
    // open & save
    window.open(doc.output('bloburl'));
    doc.save('student_booklet.pdf');
  });
});
