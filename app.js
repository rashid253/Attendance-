// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- 0. Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- 1. IndexedDB (idb-keyval) ---
  if (!window.idbKeyval) return console.error('idb-keyval missing');
  const { get, set } = window.idbKeyval;
  const save = (key, val) => set(key, val);

  // --- 2. PDF helper: landscape A4 for all downloads ---
  const PDF_OPTS = { orientation: 'landscape', format: 'a4' };
  function generatePDF({ title, subtitle, tableSelector, fileName }) {
    const doc = new jspdf.jsPDF(PDF_OPTS);
    doc.setFontSize(18);
    doc.text(title, 14, 16);
    doc.setFontSize(12);
    if (subtitle) doc.text(subtitle, 14, 24);
    doc.autoTable({
      startY: subtitle ? 32 : 24,
      html: tableSelector,
      styles: { fontSize: 8 }
    });
    doc.save(fileName);
  }

  // --- 3. State & Defaults ---
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

  // --- 4. SETTINGS: Fines & Eligibility ---
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;
  $('saveSettings').onclick = async () => {
    fineRates = {
      A : +$('fineAbsent').value   || 0,
      Lt: +$('fineLate').value     || 0,
      L : +$('fineLeave').value    || 0,
      HD: +$('fineHalfDay').value  || 0
    };
    eligibilityPct = +$('eligibilityPct').value || 0;
    await save('fineRates', fineRates);
    await save('eligibilityPct', eligibilityPct);
    alert('Fines & eligibility saved');
  };

  // --- 5. SETUP ---
  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([
      get('schoolName'), get('teacherClass'), get('teacherSection')
    ]);
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
    const sc = $('schoolNameInput').value.trim();
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    if (!sc||!cl||!sec) return alert('Complete setup');
    await save('schoolName', sc);
    await save('teacherClass', cl);
    await save('teacherSection', sec);
    await loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- 6. COUNTERS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target/100);
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
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cl).length;
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
  const tbodyReg = $('studentsBody'),
        editSel = $('editSelected'),
        delSel  = $('deleteSelected'),
        doneEd  = $('doneEditing'),
        selectAll = $('selectAllStudents');

  function renderStudents() {
    tbodyReg.innerHTML = '';
    const cl = $('teacherClassSelect').value,
          sec= $('teacherSectionSelect').value;
    let idxVisible = 0;
    students.forEach((s,i) => {
      if (s.cls!==cl||s.sec!==sec) return;
      idxVisible++;
      const stats = { P:0,A:0,Lt:0,HD:0,L:0 };
      Object.values(attendanceData).forEach(rec => stats[rec[s.adm]||'A']++);
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid      = (paymentsData[s.adm]||[]).reduce((a,x)=>a+x.amount,0);
      const out       = totalFine - paid;
      const days      = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct       = days? (stats.P/days)*100:0;
      const status    = (out>0||pct<eligibilityPct)? 'Debarred':'Eligible';
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idxVisible}</td>
        <td>${s.name}</td>
        <td>${s.adm}</td>
        <td>${s.parent}</td>
        <td>${s.contact}</td>
        <td>${s.occupation}</td>
        <td>${s.address}</td>
        <td>₨ ${out}</td>
        <td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>`;
      tbodyReg.appendChild(tr);
    });
    selectAll.checked = false;
    toggleReg();
  }

  function toggleReg() {
    const any = !!tbodyReg.querySelector('.sel:checked');
    editSel.disabled = !any;
    delSel.disabled  = !any;
  }

  tbodyReg.addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleReg();
  });
  selectAll.onclick = () => {
    const chk = selectAll.checked;
    tbodyReg.querySelectorAll('.sel').forEach(cb=>cb.checked=chk);
    toggleReg();
  };

  // Add student
  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n=$('studentName'), p=$('parentName'),
          c=$('parentContact'), o=$('parentOccupation'),
          a=$('parentAddress');
    if (![n,p,c,o,a].every(i=>i.value.trim())) return alert('All fields required');
    if (!/^\d{7,15}$/.test(c.value.trim())) return alert('Contact 7–15 digits');
    const adm = await genAdmNo();
    students.push({
      name:n.value.trim(), parent:p.value.trim(), contact:c.value.trim(),
      occupation:o.value.trim(), address:a.value.trim(),
      adm, cls:$('teacherClassSelect').value, sec:$('teacherSectionSelect').value
    });
    await save('students', students);
    [n,p,c,o,a].forEach(i=>i.value='');
    renderStudents(); updateCounters(); resetViews();
  };

  // Edit selected
  editSel.onclick = () => {
    tbodyReg.querySelectorAll('.sel:checked').forEach(cb=>{
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
        <td colspan="3"></td>`;
    });
    hide(editSel); show(doneEd);
  };

  // Done editing
  doneEd.onclick = async () => {
    tbodyReg.querySelectorAll('tr').forEach(tr => {
      const inputs = tr.querySelectorAll('td input:not(.sel)');
      if (inputs.length===5) {
        const [n,p,c,o,a] = Array.from(inputs).map(i=>i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(s=>s.adm===adm);
        students[idx] = {...students[idx], name:n, parent:p, contact:c, occupation:o, address:a};
      }
    });
    await save('students', students);
    hide(doneEd); show(editSel, delSel);
    renderStudents(); updateCounters(); resetViews();
  };

  // Delete selected
  delSel.onclick = async () => {
    if (!confirm('Delete selected?')) return;
    const toDel = Array.from(tbodyReg.querySelectorAll('.sel:checked'))
                       .map(cb=>+cb.closest('tr').dataset.index);
    students = students.filter((_,i)=>!toDel.includes(i));
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
  };

  // Save registration
  $('saveRegistration').onclick = async () => {
    if (!doneEd.classList.contains('hidden')) return alert('Finish editing first');
    await save('students', students);
    ['addStudent', 'selectAllStudents', 'editSelected', 'deleteSelected', 'saveRegistration']
      .forEach(id=>hide($(id)));
    ['editRegistration','shareRegistration','downloadRegistrationPDF']
      .forEach(id=>show($(id)));
  };

  // Edit registration
  $('editRegistration').onclick = () => {
    ['addStudent', 'selectAllStudents', 'editSelected', 'deleteSelected', 'saveRegistration']
      .forEach(id=>show($(id)));
    ['editRegistration','shareRegistration','downloadRegistrationPDF']
      .forEach(id=>hide($(id)));
  };

  // Share & download registration
  $('shareRegistration').onclick = () => {
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const header=`*Students List*\nClass ${cl} Section ${sec}`;
    const lines=students.filter(s=>s.cls===cl&&s.sec===sec).map(s=>{
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(r=>stats[r[s.adm]||'A']++);
      const totalFine=stats.A*fineRates.A+stats.Lt*fineRates.Lt+stats.L*fineRates.L+stats.HD*fineRates.HD;
      const paid=(paymentsData[s.adm]||[]).reduce((a,x)=>a+x.amount,0);
      const out=totalFine-paid; const days=stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct=days?(stats.P/days)*100:0; const status=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      return `*${s.name}*\nAdm#: ${s.adm}\nOut: ₨${out}\nStatus: ${status}`;
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`, '_blank');
  };
  $('downloadRegistrationPDF').onclick = () => {
    generatePDF({
      title: 'Student List',
      subtitle: $('setupText').textContent,
      tableSelector: '#studentsTable',
      fileName: 'registration.pdf'
    });
  };

  // --- 8. PAYMENT MODAL ---
  function openPay(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent;
    const amt = +$('paymentAmount').value||0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));
  document.body.addEventListener('click', e => {
    if (e.target.classList.contains('add-payment-btn')) openPay(e.target.dataset.adm);
  });

  // --- 9. MARK ATTENDANCE ---
  const statusNames  = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' },
        statusColors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  $('loadAttendance').onclick = () => {
    const roster = students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
    const body = $('attendanceBody'); body.innerHTML='';
    roster.forEach(stu => {
      const row = document.createElement('div'); row.className='attendance-row';
      const nameDiv = document.createElement('div'); nameDiv.className='attendance-name'; nameDiv.textContent=stu.name;
      const btnsDiv = document.createElement('div'); btnsDiv.className='attendance-buttons';
      Object.entries(statusNames).forEach(([code,label]) => {
        const btn = document.createElement('button'); btn.className='att-btn'; btn.textContent=code;
        btn.onclick = () => {
          btnsDiv.querySelectorAll('.att-btn').forEach(b=>{ b.classList.remove('selected'); b.style=''; });
          btn.classList.add('selected');
          btn.style.background = statusColors[code];
          btn.style.color = '#fff';
        };
        btnsDiv.appendChild(btn);
      });
      row.append(nameDiv, btnsDiv);
      body.appendChild(row);
    });
    show($('attendanceBody'), $('saveAttendance'));
    hide($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), $('attendanceSummary'));
  };

  $('saveAttendance').onclick = async () => {
    const date = $('dateInput').value; if (!date) return alert('Pick a date');
    attendanceData[date] = {};
    const roster = students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
    roster.forEach((s,i) => {
      const sel = $('attendanceBody').children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = sel?sel.textContent:'A';
    });
    await save('attendanceData', attendanceData);

    const sum = $('attendanceSummary'); sum.innerHTML=`<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement('table'); tbl.innerHTML=`<tr><th>Name</th><th>Status</th><th>Share</th></tr>`;
    roster.forEach(s => {
      const code = attendanceData[date][s.adm];
      tbl.innerHTML += `<tr>
        <td>${s.name}</td>
        <td>${statusNames[code]}</td>
        <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
      </tr>`;
    });
    sum.append(tbl);
    sum.querySelectorAll('.share-individual').forEach(ic => {
      ic.onclick = () => {
        const adm = ic.dataset.adm, stu = students.find(x=>x.adm===adm), code = attendanceData[date][adm];
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
    generatePDF({
      title: 'Attendance Report',
      subtitle: $('setupText').textContent + ` — ${$('dateInput').value}`,
      tableSelector: '#attendanceSummary table',
      fileName: `attendance_${$('dateInput').value}.pdf`
    });
  };

  $('shareAttendanceSummary').onclick = () => {
    const date = $('dateInput').value;
    const roster = students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
    const header = `*Attendance Report*\nClass ${$('teacherClassSelect').value} Section ${$('teacherSectionSelect').value} - ${date}`;
    const lines = roster.map(s=>`*${s.name}*: ${statusNames[attendanceData[date][s.adm]]}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines)}`, '_blank');
  };

  // --- 10. ANALYTICS ---
  const atg    = $('analyticsTarget'),
        asel   = $('analyticsSectionSelect'),
        atype  = $('analyticsType'),
        adate  = $('analyticsDate'),
        amonth = $('analyticsMonth'),
        sems   = $('semesterStart'),
        seme   = $('semesterEnd'),
        ayear  = $('yearStart'),
        asearch= $('analyticsSearch'),
        loadA  = $('loadAnalytics'),
        resetA = $('resetAnalytics'),
        instr  = $('instructions'),
        acont  = $('analyticsContainer'),
        graphs = $('graphs'),
        aacts  = $('analyticsActions'),
        barCtx = $('barChart').getContext('2d'),
        pieCtx = $('pieChart').getContext('2d');
  let barChart, pieChart, lastAnalyticsShare = '';

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearch, instr, acont, graphs, aacts].forEach(hide);
    if (atg.value==='section') show(asel);
    if (atg.value==='student') show(asearch);
  };

  atype.onchange = () => {
    [adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts].forEach(hide);
    show(resetA);
    if (atype.value==='date')     show(adate);
    if (atype.value==='month')    show(amonth);
    if (atype.value==='semester') show(sems, seme);
    if (atype.value==='year')     show(ayear);
  };

  resetA.onclick = e => {
    e.preventDefault();
    atype.value = '';
    [adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts].forEach(hide);
    hide(resetA);
  };

  loadA.onclick = () => {
    let from, to;
    if (atype.value==='date') {
      from=to=adate.value;
    } else if (atype.value==='month') {
      const [y,m] = amonth.value.split('-').map(Number);
      from=`${amonth.value}-01`;
      to=`${amonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (atype.value==='semester') {
      const [sy,sm]=sems.value.split('-').map(Number);
      const [ey,em]=seme.value.split('-').map(Number);
      from=`${sems.value}-01`;
      to=`${seme.value}-${new Date(ey,em,0).getDate()}`;
    } else if (atype.value==='year') {
      from=`${ayear.value}-01-01`; to=`${ayear.value}-12-31`;
    } else return alert('Select a period');

    let pool = students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
    if (atg.value==='section') pool = pool.filter(s=>s.sec===asel.value);
    if (atg.value==='student') {
      const q=asearch.value.trim().toLowerCase();
      pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));
    }

    const stats = pool.map(s=>({adm:s.adm,name:s.name,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      if (d<from||d>to) return;
      stats.forEach(st=>{ const c=recs[st.adm]||'A'; st[c]++; st.total++; });
    });
    stats.forEach(st=>{
      const tf=st.A*fineRates.A+st.Lt*fineRates.Lt+st.L*fineRates.L+st.HD*fineRates.HD;
      const tp=(paymentsData[st.adm]||[]).reduce((a,p)=>a+p.amount,0);
      st.outstanding=tf-tp;
      const pct=st.total?(st.P/st.total)*100:0;
      st.status=(st.outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
    });

    const thead=$('analyticsTable').querySelector('thead tr');
    thead.innerHTML=['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding (₨)','Status']
      .map(h=>`<th>${h}</th>`).join('');
    const tbodyA=$('analyticsBody'); tbodyA.innerHTML='';
    stats.forEach((st,i)=>{
      const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td>
        <td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td>
        <td>${pct}%</td><td>₨ ${st.outstanding}</td><td>${st.status}</td>`;
      tbodyA.appendChild(tr);
    });

    instr.textContent=`Period: ${from} to ${to}`;
    show(instr, acont, graphs, aacts);
    barChart?.destroy();
    barChart=new Chart(barCtx,{
      type:'bar',
      data:{labels:stats.map(st=>st.name),datasets:[{label:'% Present',data:stats.map(st=>st.total? (st.P/st.total)*100:0)}]},
      options:{scales:{y:{beginAtZero:true,max:100}}}
    });
    pieChart?.destroy();
    const agg=stats.reduce((a,st)=>a+st.outstanding,0);
    pieChart=new Chart(pieCtx,{
      type:'pie',
      data:{labels:['Outstanding'],datasets:[{data:[agg]}]}
    });
    lastAnalyticsShare=stats.map((st,i)=>`${i+1}. ${st.adm} ${st.name}: ${((st.P||0)/(st.total||1)*100).toFixed(1)}% / ₨${st.outstanding}`).join('\n');
  };

  $('shareAnalytics').onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent("Analytics\n"+lastAnalyticsShare)}`, '_blank');
  $('downloadAnalytics').onclick=()=>generatePDF({
    title:'Analytics Report',
    subtitle:$('setupText').textContent,
    tableSelector:'#analyticsTable',
    fileName:'analytics_report.pdf'
  });

  // --- 11. ATTENDANCE REGISTER ---
  $('loadRegister').onclick=()=>{
    const m=$('registerMonth').value; if(!m)return alert('Pick month');
    const [y,mm]=m.split('-').map(Number), days=new Date(y,mm,0).getDate();
    $('registerHeader').innerHTML=['<th>#</th>','<th>Adm#</th>','<th>Name</th>']
      .concat(Array.from({length:days},(_,i)=>`<th>${i+1}</th>`)).join('');
    const roster=students.filter(s=>s.cls=== $('teacherClassSelect').value && s.sec=== $('teacherSectionSelect').value);
    $('registerBody').innerHTML='';
    roster.forEach((s,i)=>{
      let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=days;d++){
        const key=`${m}-${String(d).padStart(2,'0')}`;
        const c=(attendanceData[key]||{})[s.adm]||'A';
        const color=c==='A'?'':(c==='P'?'var(--success)':(c==='Lt'||c==='HD'?'var(--warning)':'var(--danger)'));
        row+=`<td class="reg-cell"${color?` style="background:${color};color:#fff"`:''}><span class="status-text">${c}</span></td>`;
      }
      const tr=document.createElement('tr'); tr.innerHTML=row; $('registerBody').appendChild(tr);
    });
    $('registerBody').querySelectorAll('.reg-cell').forEach(cell=>{
      cell.onclick=()=>{
        const span=cell.querySelector('.status-text');
        const codes=['A','P','Lt','HD','L']; let idx=codes.indexOf(span.textContent);
        idx=(idx+1)%codes.length; span.textContent=codes[idx];
        if(codes[idx]==='A'){ cell.style.background=''; cell.style.color=''; }
        else{
          const clr=codes[idx]==='P'?'var(--success)':(codes[idx]==='Lt'||codes[idx]==='HD'?'var(--warning)':'var(--danger)');
          cell.style.background=clr; cell.style.color='#fff';
        }
      };
    });
    show($('registerTableWrapper'),$('saveRegister'));
    hide($('loadRegister'),$('changeRegister'),$('downloadRegister'),$('shareRegister'));
  };

  $('saveRegister').onclick=async()=>{
    const m=$('registerMonth').value,[y,mm]=m.split('-').map(Number),days=new Date(y,mm,0).getDate();
    Array.from($('registerBody').children).forEach(tr=>{
      const adm=tr.children[1].textContent;
      for(let d=1;d<=days;d++){
        const code=tr.children[3+d-1].querySelector('.status-text').textContent;
        const key=`${m}-${String(d).padStart(2,'0')}`;
        attendanceData[key]=attendanceData[key]||{};
        attendanceData[key][adm]=code;
      }
    });
    await save('attendanceData', attendanceData);
    show($('changeRegister'),$('downloadRegister'),$('shareRegister'));
    hide($('saveRegister'));
  };

  $('changeRegister').onclick=()=>{ show($('saveRegister')); hide($('changeRegister'),$('downloadRegister'),$('shareRegister')); };
  $('downloadRegister').onclick=()=>generatePDF({
    title:'Attendance Register',
    subtitle:$('setupText').textContent,
    tableSelector:'#registerTable',
    fileName:'attendance_register.pdf'
  });
  $('shareRegister').onclick=()=>{
    const header=`Attendance Register\n${$('setupText').textContent}`;
    const rows=Array.from($('registerBody').children).map(tr=>Array.from(tr.children).map(td=>
      td.querySelector('.status-text')?td.querySelector('.status-text').textContent:td.textContent
    ).join(' ')).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+rows)}`, '_blank');
  };

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
