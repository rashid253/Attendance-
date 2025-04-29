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
  let fineRates       = await get('fineRates')       || { A:50, Lt:20, L:10, HD:0 };
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
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;
  $('saveSettings').onclick = async () => {
    fineRates = {
      A : Number($('fineAbsent').value)   || 0,
      Lt: Number($('fineLate').value)     || 0,
      L : Number($('fineLeave').value)    || 0,
      HD: Number($('fineHalfDay').value)  || 0,
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);
    alert('Fines & eligibility settings saved');
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
    const sc = $('schoolNameInput').value.trim();
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    if (!sc || !cl || !sec) {
      return alert('Please complete the setup form');
    }
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- 6. COUNTERS ---
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
    $('sectionCount').dataset.target = students.filter(s => s.cls===cl && s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s => s.cls===cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

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

  // --- 7. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx = 0;
    students.forEach((s,i) => {
      if (s.cls!==cl || s.sec!==sec) return;
      idx++;
      // attendance summary
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(r => stats[r[s.adm]||'A']++);
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid      = (paymentsData[s.adm]||[]).reduce((a,x)=>a+x.amount,0);
      const out       = totalFine - paid;
      const days      = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct       = days? (stats.P/days)*100 : 0;
      const status    = (out>0 || pct<eligibilityPct)? 'Debarred':'Eligible';

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
        <td>₨ ${out}</td>
        <td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleRegButtons();
  }

  function toggleRegButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }

  // Delegate checkbox change
  document.querySelector('#studentsTable').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleRegButtons();
  });
  $('selectAllStudents').onclick = () => {
    const checked = $('selectAllStudents').checked;
    document.querySelectorAll('.sel').forEach(cb => cb.checked = checked);
    toggleRegButtons();
  };

  // Add Student
  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n = $('studentName'), p = $('parentName'),
          c = $('parentContact'), o = $('parentOccupation'),
          a = $('parentAddress');
    if (![n,p,c,o,a].every(i => i.value.trim())) {
      return alert('All fields are required');
    }
    if (!/^\d{7,15}$/.test(c.value.trim())) {
      return alert('Contact must be 7–15 digits');
    }
    const adm = await genAdmNo();
    students.push({
      name: n.value.trim(),
      parent: p.value.trim(),
      contact: c.value.trim(),
      occupation: o.value.trim(),
      address: a.value.trim(),
      adm,
      cls: $('teacherClassSelect').value,
      sec: $('teacherSectionSelect').value
    });
    await save('students', students);
    [n,p,c,o,a].forEach(i=>i.value='');
    renderStudents(); updateCounters(); resetViews();
  };

  // Edit Selected
  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach(cb => {
      const tr = cb.closest('tr'), idx = +tr.dataset.index, s = students[idx];
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

  // Done Editing
  $('doneEditing').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach(tr => {
      const inputs = tr.querySelectorAll('td input:not(.sel)');
      if (inputs.length===5) {
        const [n,p,c,o,a] = Array.from(inputs).map(i=>i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(s=>s.adm===adm);
        students[idx] = { ...students[idx], name:n, parent:p, contact:c, occupation:o, address:a };
      }
    });
    await save('students', students);
    hide($('doneEditing'));
    show($('editSelected'), $('deleteSelected'));
    renderStudents(); updateCounters(); resetViews();
  };

  // Delete Selected
  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected students?')) return;
    const toDel = Array.from(document.querySelectorAll('.sel:checked'))
                       .map(cb => +cb.closest('tr').dataset.index);
    students = students.filter((_,i)=>!toDel.includes(i));
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
  };

  // Save Registration (lock)
  $('saveRegistration').onclick = async () => {
    if (!$('doneEditing').classList.contains('hidden')) {
      return alert('Finish editing first');
    }
    await save('students', students);
    ['addStudent','selectAllStudents','editSelected','deleteSelected','saveRegistration']
      .forEach(id=>hide($(id)));
    ['editRegistration','shareRegistration','downloadRegistrationPDF']
      .forEach(id=>show($(id)));
  };

  // Re-enable Registration Editing
  $('editRegistration').onclick = () => {
    ['addStudent','selectAllStudents','editSelected','deleteSelected','saveRegistration']
      .forEach(id=>show($(id)));
    ['editRegistration','shareRegistration','downloadRegistrationPDF']
      .forEach(id=>hide($(id)));
  };

  // Share and Download Registration (unchanged)
  $('shareRegistration').onclick = () => {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students.filter(s=>s.cls===cl&&s.sec===sec).map(s => {
      const tf = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      const out = tf - tf; // placeholder, actual fine logic can be re-added
      return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: ₨${out}`;
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`, '_blank');
  };
  $('downloadRegistrationPDF').onclick = () => {
    const doc = new jspdf.jsPDF({ orientation: 'landscape', format: 'a4' });
    doc.setFontSize(18); doc.text('Student List', 14, 16);
    doc.setFontSize(12); doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 32, html: '#studentsTable', styles:{ fontSize:7 } });
    doc.save('registration.pdf');
  };

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent;
    const amt = Number($('paymentAmount').value) || 0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));

  // --- 9. MARK ATTENDANCE ---
  const statusNames  = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' };
  const statusColors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  $('loadAttendance').onclick = () => {
    const roster = students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
    const c = $('attendanceBody'); c.innerHTML = '';
    roster.forEach(stu=>{
      const row = document.createElement('div'); row.className='attendance-row';
      const name = document.createElement('div'); name.className='attendance-name'; name.textContent=stu.name;
      const btns = document.createElement('div'); btns.className='attendance-buttons';
      Object.keys(statusNames).forEach(code=>{
        const b = document.createElement('button'); b.className='att-btn'; b.textContent=code;
        b.onclick = ()=>{
          btns.querySelectorAll('.att-btn').forEach(x=>{ x.classList.remove('selected'); x.style=''; });
          b.classList.add('selected'); b.style.background=statusColors[code]; b.style.color='#fff';
        };
        btns.appendChild(b);
      });
      row.append(name, btns); c.appendChild(row);
    });
    show($('attendanceBody'), $('saveAttendance'));
    hide($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), $('attendanceSummary'));
  };

  $('saveAttendance').onclick = async () => {
    const date = $('dateInput').value;
    if (!date) return alert('Please pick a date');
    attendanceData[date] = {};
    const roster = students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
    roster.forEach((s,i)=>{
      const sel = $('attendanceBody').children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = sel? sel.textContent : 'A';
    });
    await save('attendanceData', attendanceData);

    const sum = $('attendanceSummary'); sum.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement('table');
    tbl.innerHTML = `<tr><th>Name</th><th>Status</th><th>Share</th></tr>`;
    roster.forEach(s=>{
      const code = attendanceData[date][s.adm];
      tbl.innerHTML += `<tr>
        <td>${s.name}</td>
        <td>${statusNames[code]}</td>
        <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
      </tr>`;
    });
    sum.append(tbl);
    sum.querySelectorAll('.share-individual').forEach(ic=>{
      ic.onclick = ()=>{
        const adm = ic.dataset.adm, stu = students.find(x=>x.adm===adm);
        const code = attendanceData[date][adm];
        const msg = `Dear Parent, your child was ${statusNames[code]} on ${date}.`;
        window.open(`https://wa.me/${stu.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      };
    });

    hide($('attendanceBody'), $('saveAttendance'));
    show($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), $('attendanceSummary'));
  };

  $('resetAttendance').onclick = () => {
    show($('attendanceBody'), $('saveAttendance'));
    hide($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), $('attendanceSummary'));
  };

  $('downloadAttendancePDF').onclick = () => {
    const date = $('dateInput').value;
    const doc = new jspdf.jsPDF({ orientation:'portrait', format:'a4' });
    doc.setFontSize(18); doc.text('Attendance Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#attendanceSummary table', styles:{fontSize:8} });
    doc.save(`attendance_${date}.pdf`);
  };

  $('shareAttendanceSummary').onclick = () => {
    const date = $('dateInput').value;
    const roster = students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
    const header = `*Attendance Report*\nClass ${$('teacherClassSelect').value} Section ${$('teacherSectionSelect').value} - ${date}`;
    const lines = roster.map(s=>`*${s.name}*: ${statusNames[attendanceData[date][s.adm]]}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`, '_blank');
  };

  // --- 10. ANALYTICS ---
  const atg    = $('analyticsTarget'), asel   = $('analyticsSectionSelect'),
        atype  = $('analyticsType'),     adate  = $('analyticsDate'),
        amonth = $('analyticsMonth'),    sems   = $('semesterStart'),
        seme   = $('semesterEnd'),       ayear  = $('yearStart'),
        asearch= $('analyticsSearch'),   loadA  = $('loadAnalytics'),
        resetA = $('resetAnalytics'),    instr  = $('instructions'),
        acont  = $('analyticsContainer'),graphs = $('graphs'),
        aacts  = $('analyticsActions'),  barCtx = $('barChart').getContext('2d'),
        pieCtx = $('pieChart').getContext('2d');
  let barChart, pieChart, lastAnalyticsShare = '';

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearch, instr, acont, graphs, aacts].forEach(x=>x.classList.add('hidden'));
    if (atg.value==='section') asel.classList.remove('hidden');
    if (atg.value==='student') asearch.classList.remove('hidden');
  };

  atype.onchange = () => {
    [adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts].forEach(x=>x.classList.add('hidden'));
    resetA.classList.remove('hidden');
    if (atype.value==='date')     adate.classList.remove('hidden');
    if (atype.value==='month')    amonth.classList.remove('hidden');
    if (atype.value==='semester'){ sems.classList.remove('hidden'); seme.classList.remove('hidden'); }
    if (atype.value==='year')     ayear.classList.remove('hidden');
  };

  resetA.onclick = e => {
    e.preventDefault();
    atype.value=''; [adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts].forEach(x=>x.classList.add('hidden'));
    resetA.classList.add('hidden');
  };

  loadA.onclick = () => {
    let from, to;
    if (atype.value==='date') {
      from = to = adate.value;
    } else if (atype.value==='month') {
      const [y,m] = amonth.value.split('-').map(Number);
      from = `${amonth.value}-01`;
      to   = `${amonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (atype.value==='semester') {
      const [sy,sm] = sems.value.split('-').map(Number);
      const [ey,em] = seme.value.split('-').map(Number);
      from = `${sems.value}-01`;
      to   = `${seme.value}-${new Date(ey,em,0).getDate()}`;
    } else if (atype.value==='year') {
      from = `${ayear.value}-01-01`;
      to   = `${ayear.value}-12-31`;
    } else return alert('Select a period');

    let pool = students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
    if (atg.value==='section') pool = pool.filter(s=>s.sec=== asel.value);
    if (atg.value==='student') {
      const q = asearch.value.trim().toLowerCase();
      pool = pool.filter(s=>s.adm===q || s.name.toLowerCase().includes(q));
    }

    const stats = pool.map(s=>({ adm:s.adm, name:s.name, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      if (d<from||d>to) return;
      stats.forEach(st=>{
        const c = recs[st.adm]||'A';
        st[c]++; st.total++;
      });
    });

    stats.forEach(st=>{
      const tf = st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
      const tp = (paymentsData[st.adm]||[]).reduce((s,p)=>s+p.amount,0);
      st.outstanding = tf - tp;
      const pct = st.total? (st.P/st.total)*100 : 0;
      st.status = (st.outstanding>0 || pct<eligibilityPct)? 'Debarred':'Eligible';
    });

    const thead = $('analyticsTable').querySelector('thead tr');
    thead.innerHTML = ['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding (₨)','Status']
      .map(h=>`<th>${h}</th>`).join('');
    const tbody = $('analyticsBody'); tbody.innerHTML = '';
    stats.forEach((st,i)=>{
      const pct = st.total? ((st.P/st.total)*100).toFixed(1):'0.0';
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
        <td>₨ ${st.outstanding}</td>
        <td>${st.status}</td>
      `;
      tbody.appendChild(tr);
    });

    instr.textContent = `Period: ${from} to ${to}`;
    show(instr, acont, graphs, aacts);

    barChart?.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: stats.map(st=>st.name),
        datasets: [{ label: '% Present', data: stats.map(st=>st.total? (st.P/st.total)*100 : 0) }]
      },
      options: { scales: { y: { beginAtZero:true, max:100 } } }
    });

    pieChart?.destroy();
    const aggFine = stats.reduce((a,st)=>a+st.outstanding,0);
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: ['Outstanding'],
        datasets:[{ data:[aggFine] }]
      }
    });

    lastAnalyticsShare = stats.map((st,i)=>
      `${i+1}. ${st.adm} ${st.name}: ${((st.P||0)/(st.total||1)*100).toFixed(1)}% / ₨${st.outstanding}`
    ).join('\n');
  };

  $('shareAnalytics').onclick = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent("Analytics Report\n" + lastAnalyticsShare)}`, '_blank');
  };
  $('downloadAnalytics').onclick = () => {
    const doc = new jspdf.jsPDF({ orientation:'portrait', format:'a4' });
    doc.setFontSize(18); doc.text('Analytics Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#analyticsTable', styles:{fontSize:8} });
    doc.save('analytics_report.pdf');
  };

  // --- 11. ATTENDANCE REGISTER ---
  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value; if (!m) return alert('Pick month');
    const [y,mm] = m.split('-').map(Number);
    const days   = new Date(y,mm,0).getDate();
    const header = ['<th>#</th>','<th>Adm#</th>','<th>Name</th>']
      .concat(Array.from({ length:days },(_,i)=>`<th>${i+1}</th>`)).join('');
    $('registerHeader').innerHTML = header;
    const roster = students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
    $('registerBody').innerHTML = '';
    roster.forEach((s,i)=>{
      let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1; d<=days; d++){
        const key = `${m}-${String(d).padStart(2,'0')}`;
        const c = (attendanceData[key]||{})[s.adm]||'A';
        const style = c==='A'?'':
          ` style="background:${ statusColors[c] || 'var(--danger)' };color:#fff"`;
        row += `<td class="reg-cell"${style}><span class="status-text">${c}</span></td>`;
      }
      const tr = document.createElement('tr'); tr.innerHTML = row;
      $('registerBody').appendChild(tr);
    });
    $('registerBody').querySelectorAll('.reg-cell').forEach(cell=>{
      cell.onclick = ()=>{
        const span = cell.querySelector('.status-text');
        const codes = ['A','P','Lt','HD','L'];
        let idx = codes.indexOf(span.textContent);
        idx = (idx+1)%codes.length; span.textContent = codes[idx];
        if (codes[idx]==='A') { cell.style.background=''; cell.style.color=''; }
        else { cell.style.background = statusColors[codes[idx]]; cell.style.color='#fff'; }
      };
    });
    show($('registerTableWrapper'), $('saveRegister'));
    hide($('loadRegister'), $('changeRegister'), $('downloadRegister'), $('shareRegister'));
  };

  $('saveRegister').onclick = async () => {
    const m = $('registerMonth').value;
    const [y,mm] = m.split('-').map(Number);
    const days   = new Date(y,mm,0).getDate();
    Array.from($('registerBody').children).forEach(tr=>{
      const adm = tr.children[1].textContent;
      for (let d=1; d<=days; d++){
        const code = tr.children[3+d-1].querySelector('.status-text').textContent;
        const key = `${m}-${String(d).padStart(2,'0')}`;
        attendanceData[key] = attendanceData[key]||{};
        attendanceData[key][adm] = code;
      }
    });
    await save('attendanceData', attendanceData);
    show($('changeRegister'), $('downloadRegister'), $('shareRegister'));
    hide($('saveRegister'));
  };

  $('changeRegister').onclick = () => {
    show($('saveRegister'));
    hide($('changeRegister'), $('downloadRegister'), $('shareRegister'));
  };

  $('downloadRegister').onclick = () => {
    const doc = new jspdf.jsPDF({ orientation:'landscape', format:'a4' });
    doc.setFontSize(18); doc.text('Attendance Register',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#registerTable', styles:{fontSize:7} });
    doc.save('attendance_register.pdf');
  };

  $('shareRegister').onclick = () => {
    const header = `Attendance Register\n${$('setupText').textContent}`;
    const rows = Array.from($('registerBody').children).map(tr =>
      Array.from(tr.children).map(td =>
        td.querySelector('.status-text')? td.querySelector('.status-text').textContent : td.textContent
      ).join(' ')
    ).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+rows)}`, '_blank');
  };

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
