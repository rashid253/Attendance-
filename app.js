// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // Debug console (eruda)
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // IndexedDB helpers (idb-keyval)
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // State & Defaults
  let students        = await get('students')        || [];
  let attendanceData  = await get('attendanceData')  || {};
  let paymentsData    = await get('paymentsData')    || {};
  let lastAdmNo       = await get('lastAdmissionNo') || 0;
  let fineRates       = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct  = await get('eligibilityPct')  || 75;
  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // DOM helpers
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e=>e&&e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e=>e&&e.classList.add('hidden'));

  // SETTINGS: fines & eligibility
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
      HD: +$('fineHalfDay').value  || 0,
    };
    eligibilityPct = +$('eligibilityPct').value || 0;
    await save('fineRates', fineRates);
    await save('eligibilityPct', eligibilityPct);
    $('settingsCard').innerHTML = `
      <p>Fine – Absent: PKR ${fineRates.A}</p>
      <p>Fine – Late: PKR ${fineRates.Lt}</p>
      <p>Fine – Leave: PKR ${fineRates.L}</p>
      <p>Fine – Half-Day: PKR ${fineRates.HD}</p>
      <p>Eligibility %: ${eligibilityPct}%</p>`;
    hide($('financialForm'));
    show($('settingsCard'), $('editSettings'));
  };
  $('editSettings').onclick = () => {
    show($('financialForm'));
    hide($('settingsCard'), $('editSettings'));
  };

  // SETUP: school/class/section
  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([
      get('schoolName'),
      get('teacherClass'),
      get('teacherSection')
    ]);
    if (sc && cl && sec) {
      $('schoolNameInput').value = sc;
      $('teacherClassSelect').value = cl;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${sc} | Class: ${cl} | Section: ${sec}`;
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
          sec= $('teacherSectionSelect').value;
    if (!sc || !cl || !sec) { alert('Complete setup'); return; }
    await save('schoolName', sc);
    await save('teacherClass', cl);
    await save('teacherSection', sec);
    loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // COUNTERS & UTILS
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
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  function resetViews() {
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'), $('attendanceSummary'),
      $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('analyticsContainer'), $('graphs'),
      $('downloadReports'), $('closeFilterDialog'),
      $('registerTableWrapper'), $('changeRegister'), $('saveRegister'),
      $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }
  $('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // STUDENT REGISTRATION
  function renderStudents() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody'); tbody.innerHTML = ''; let idx=0;
    students.forEach((s,i)=>{
      if (s.cls!==cl||s.sec!==sec) return; idx++;
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(r=>stats[r[s.adm]||'A']++);
      const fine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out = fine-paid;
      const totalDays = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct = totalDays?stats.P/totalDays*100:0;
      const status = (out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr=document.createElement('tr'); tr.dataset.index=i;
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>
        <td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${out}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>`;
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
  $('studentsBody').addEventListener('change', e=>{ if(e.target.classList.contains('sel')) toggleButtons(); });
  $('selectAllStudents').onclick = () => {
    document.querySelectorAll('.sel').forEach(c=>c.checked=$('selectAllStudents').checked);
    toggleButtons();
  };
  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n=$('studentName').value.trim(), p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(), o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim(), cl=$('teacherClassSelect').value,
          sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a){alert('All fields required');return;}
    if(!/^\d{7,15}$/.test(c)){alert('Contact 7–15 digits');return;}
    const adm=await genAdmNo();
    students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls:cl,sec});
    await save('students',students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };
  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach(cb=>{
      const tr=cb.closest('tr'), i=+tr.dataset.index, s=students[i];
      tr.innerHTML=`
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
    renderStudents(); updateCounters();
  };
  $('deleteSelected').onclick = async () => {
    if(!confirm('Delete selected?')) return;
    const toDel=[...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students=students.filter((_,i)=>!toDel.includes(i));
    await save('students',students);
    renderStudents(); updateCounters(); resetViews();
  };
  $('saveRegistration').onclick = async () => {
    if(!$('doneEditing').classList.contains('hidden')){alert('Finish editing');return;}
    await save('students',students);
    hide(document.querySelector('#student-registration .row-inline'),$('editSelected'),$('deleteSelected'),$('selectAllStudents'),$('saveRegistration'));
    show($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  $('editRegistration').onclick = () => {
    show(document.querySelector('#student-registration .row-inline'),$('selectAllStudents'),$('editSelected'),$('deleteSelected'),$('saveRegistration'));
    hide($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF'));
    renderStudents(); updateCounters();
  };
  $('shareRegistration').onclick = () => {
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const header=`Students List\nClass ${cl} Section ${sec}`;
    const lines=students.filter(s=>s.cls===cl&&s.sec===sec).map(s=>{
      const out=(stats=>stats.A*fineRates.A+stats.Lt*fineRates.Lt+stats.L* fineRates.L+stats.HD*fineRates.HD - (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0))
        (Object.values(attendanceData).reduce((acc,r)=>{acc[r[s.adm]||'A']++;return acc;},{P:0,A:0,Lt:0,HD:0,L:0}));
      const status=(out>0)?'Debarred':'Eligible';
      return `${s.name} (Adm#${s.adm}): Outstanding PKR ${out}, ${status}`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+lines)}`,'_blank');
  };
  $('downloadRegistrationPDF').onclick = () => {
    const doc=new jspdf.jsPDF();
    doc.text('Student List',14,16);
    doc.autoTable({startY:24,html:'#studentsTable'});
    doc.save('registration.pdf');
  };

  // PAYMENT modal
  function openPaymentModal(adm){ $('payAdm').textContent=adm; $('paymentAmount').value=''; show($('paymentModal')); }
  $('savePayment').onclick = async () => {
    const adm=$('payAdm').textContent, amt=+$('paymentAmount').value||0;
    paymentsData[adm]=paymentsData[adm]||[]; paymentsData[adm].push({date:new Date().toISOString().split('T')[0],amount:amt});
    await save('paymentsData',paymentsData); hide($('paymentModal')); renderStudents();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));

  // MARK ATTENDANCE
  $('loadAttendance').onclick = () => {
    const date=$('dateInput').value; if(!date){alert('Pick date');return;}
    $('attendanceBody').innerHTML=''; $('attendanceSummary').innerHTML='';
    const roster=students.filter(s=>s.cls===$('teacherClassSelect').value&&s.sec===$('teacherSectionSelect').value);
    roster.forEach((stu,i)=>{
      const row=document.createElement('div'), nameDiv=document.createElement('div'), btnsDiv=document.createElement('div');
      row.className='attendance-row'; nameDiv.className='attendance-name'; btnsDiv.className='attendance-buttons';
      nameDiv.textContent=stu.name;
      ['P','A','Lt','HD','L'].forEach(code=>{
        const btn=document.createElement('button'); btn.className='att-btn'; btn.textContent=code;
        btn.onclick=()=>{
          btnsDiv.querySelectorAll('.att-btn').forEach(b=>{b.classList.remove('selected');b.style='';});
          btn.classList.add('selected'); btn.style.background={'P':'#4caf50','A':'#f44336','Lt':'#ffeb3b','HD':'#ff9800','L':'#2196f3'}[code]; btn.style.color='#fff';
        };
        btnsDiv.appendChild(btn);
      });
      row.append(nameDiv,btnsDiv); $('attendanceBody').appendChild(row);
    });
    show($('attendanceBody'),$('saveAttendance')); hide($('resetAttendance'),$('downloadAttendancePDF'),$('shareAttendanceSummary'),$('attendanceSummary'));
  };
  $('saveAttendance').onclick = async () => {
    const date=$('dateInput').value; attendanceData[date]={};
    const roster=students.filter(s=>s.cls===$('teacherClassSelect').value&&s.sec===$('teacherSectionSelect').value);
    roster.forEach((s,i)=>{ const btn=$('attendanceBody').children[i].querySelector('.att-btn.selected'); attendanceData[date][s.adm]=btn?btn.textContent:'A'; });
    await save('attendanceData',attendanceData);
    const sum=$('attendanceSummary'); sum.innerHTML=`<h3>Attendance ${date}</h3><table><tr><th>Name</th><th>Status</th></tr>`+
      roster.map(s=>`<tr><td>${s.name}</td><td>${{'P':'Present','A':'Absent','Lt':'Late','HD':'Half-Day','L':'Leave'}[attendanceData[date][s.adm]]}</td></tr>`).join('')+'</table>';
    hide($('attendanceBody'),$('saveAttendance')); show($('resetAttendance'),$('downloadAttendancePDF'),$('shareAttendanceSummary'),sum);
  };
  $('resetAttendance').onclick = () => { show($('attendanceBody'),$('saveAttendance')); hide($('resetAttendance'),$('downloadAttendancePDF'),$('shareAttendanceSummary'),$('attendanceSummary')); };
  $('downloadAttendancePDF').onclick = () => {
    const doc=new jspdf.jsPDF(); doc.text('Attendance Report',14,16); doc.autoTable({startY:24,html:'#attendanceSummary table'}); doc.save(`attendance_${$('dateInput').value}.pdf`);
  };
  $('shareAttendanceSummary').onclick = () => {
    const date=$('dateInput').value; const header=`Attendance ${date}`;
    const lines=students.filter(s=>s.cls===$('teacherClassSelect').value&&s.sec===$('teacherSectionSelect').value)
      .map(s=>`${s.name}: ${attendanceData[date][s.adm]}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+lines.join('\n'))}`,'_blank');
  };

  
// In app.js, add or replace the following Analytics & Filters code

// 1. Grab all controls
const atg          = document.getElementById('analyticsTarget'),
      asel         = document.getElementById('analyticsSectionSelect'),
      atype        = document.getElementById('analyticsType'),
      adate        = document.getElementById('analyticsDate'),
      amonth       = document.getElementById('analyticsMonth'),
      sems         = document.getElementById('semesterStart'),
      seme         = document.getElementById('semesterEnd'),
      ayear        = document.getElementById('yearStart'),
      asearch      = document.getElementById('analyticsSearch'),
      loadA        = document.getElementById('loadAnalytics'),
      resetA       = document.getElementById('resetAnalytics'),
      instr        = document.getElementById('instructions'),
      acont        = document.getElementById('analyticsContainer'),
      graphs       = document.getElementById('graphs'),
      filterBtn    = document.getElementById('analyticsFilterBtn'),
      filterPanel  = document.getElementById('analyticsFilterPanel'),
      filterChecks = document.querySelectorAll('.analytics-filter'),
      clearFilters = document.getElementById('clearFilters'),
      downloadBtn  = document.getElementById('downloadReports'),
      barCtx       = document.getElementById('barChart').getContext('2d'),
      pieCtx       = document.getElementById('pieChart').getContext('2d');

let barChart, pieChart, lastAnalyticsShare = '';

// 2. Open/close filter panel
filterBtn.addEventListener('click', () => filterPanel.classList.toggle('hidden'));
clearFilters.addEventListener('click', () => {
  filterChecks.forEach(cb => cb.checked = false);
  applyAnalyticsFilters();
});

// 3. Apply filters on change
filterChecks.forEach(cb => cb.addEventListener('change', applyAnalyticsFilters));

function applyAnalyticsFilters() {
  const active = Array.from(filterChecks).filter(cb => cb.checked).map(cb => cb.value);
  document.querySelectorAll('#analyticsBody tr').forEach(row => {
    const status      = row.cells[11].textContent.trim().toLowerCase();
    const outstanding = parseFloat(row.cells[10].textContent.replace(/[^0-9.]/g, '')) || 0;
    let show = active.length === 0;
    if (active.includes('eligible')    && status === 'eligible')    show = true;
    if (active.includes('debarred')    && status === 'debarred')    show = true;
    if (active.includes('outstanding') && outstanding > 0)          show = true;
    if (active.includes('clears')      && outstanding <= 0)         show = true;
    row.style.display = show ? '' : 'none';
  });
  document.getElementById('student-registration').style.display = active.includes('registration') ? '' : 'none';
  document.getElementById('attendance-section').style.display   = active.includes('attendanceReport') ? '' : 'none';
}

// 4. Unified Download button
downloadBtn.addEventListener('click', () => {
  const mode = document.querySelector('input[name="downloadMode"]:checked').value;
  if (mode === 'filtered') {
    const doc = new jspdf.jsPDF();
    doc.text('Filtered Analytics Report', 10, 10);
    doc.autoTable({ startY: 20, html: '#analyticsTable', includeHiddenRows: false });
    doc.save('analytics_filtered.pdf');
  } else {
    const rows = Array.from(document.querySelectorAll('#analyticsBody tr'))
                      .filter(r => r.style.display !== 'none');
    if (!rows.length) { alert('No records to download'); return; }
    const doc = new jspdf.jsPDF();
    rows.forEach((row, i) => {
      const cells = Array.from(row.children).map(td => td.textContent.trim());
      doc.text(`Report for ${cells[2]} (Adm#: ${cells[1]})`, 10, 20);
      doc.autoTable({
        startY: 30,
        head: [['P','A','Lt','HD','L','Total','%','Outstanding','Status']],
        body: [[cells[3],cells[4],cells[5],cells[6],cells[7],cells[8],cells[9],cells[10],cells[11]]]
      });
      if (i < rows.length - 1) doc.addPage();
    });
    doc.save('analytics_all_reports.pdf');
  }
  filterPanel.classList.add('hidden');
});

// 5. Generate Analytics Report
loadA.addEventListener('click', () => {
  if (atg.value === 'student' && !asearch.value.trim()) {
    alert('Please enter an admission number or name');
    return;
  }
  let from, to;
  if (atype.value === 'date') {
    from = to = adate.value;
  } else if (atype.value === 'month') {
    const [y,m] = amonth.value.split('-').map(Number);
    from = `${amonth.value}-01`;
    to   = `${amonth.value}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
  } else if (atype.value === 'semester') {
    const [sy,sm] = sems.value.split('-').map(Number);
    const [ey,em] = seme.value.split('-').map(Number);
    from = `${sems.value}-01`;
    to   = `${seme.value}-${String(new Date(ey,em,0).getDate()).padStart(2,'0')}`;
  } else if (atype.value === 'year') {
    from = `${ayear.value}-01-01`;
    to   = `${ayear.value}-12-31`;
  } else {
    alert('Select a period');
    return;
  }

  // build pool
  let pool = students.filter(s => s.cls === $('teacherClassSelect').value && s.sec === $('teacherSectionSelect').value);
  if (atg.value === 'section') pool = pool.filter(s => s.sec === asel.value);
  if (atg.value === 'student') {
    const q = asearch.value.trim().toLowerCase();
    pool = pool.filter(s => s.adm === q || s.name.toLowerCase().includes(q));
  }

  // compute stats
  const stats = pool.map(s => ({ adm:s.adm, name:s.name, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
  Object.entries(attendanceData).forEach(([d, recs]) => {
    if (d < from || d > to) return;
    stats.forEach(st => {
      const c = recs[st.adm]||'A'; st[c]++; st.total++;
    });
  });
  stats.forEach(st => {
    const tf = st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
    const tp = (paymentsData[st.adm]||[]).reduce((a,p)=>a+p.amount,0);
    st.outstanding = tf - tp;
  });

  // render table
  const thead = $('analyticsTable').querySelector('thead tr');
  thead.innerHTML = ['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']
    .map(h=>`<th>${h}</th>`).join('');
  const tbody = $('analyticsBody'); tbody.innerHTML = '';
  stats.forEach((st,i) => {
    const pct = st.total ? ((st.P/st.total)*100).toFixed(1) : '0.0';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td>
      <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td>
      <td>${st.total}</td><td>${pct}%</td><td>PKR ${st.outstanding}</td>
      <td>${(st.outstanding>0)?'Debarred':'Eligible'}</td>`;
    tbody.appendChild(tr);
  });

  instr.textContent = `Period: ${from} to ${to}`;
  show(instr, acont, graphs, downloadBtn);

  // charts
  barChart?.destroy();
  barChart = new Chart(barCtx, {
    type: 'bar',
    data: { labels: stats.map(s=>s.name), datasets:[{ label:'% Present', data: stats.map(s=>s.total?s.P/s.total*100:0) }] },
    options: { scales:{ y:{ beginAtZero:true, max:100 } } }
  });
  pieChart?.destroy();
  pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: { labels:['Outstanding'], datasets:[{ data:[ stats.reduce((sum,s)=>sum+s.outstanding,0) ] }] }
  );

  lastAnalyticsShare = `Analytics (${from} to ${to})\n` +
    stats.map((st,i)=>`${i+1}. ${st.adm} ${st.name}: ${((st.P/st.total)*100).toFixed(1)}% / PKR ${st.outstanding}`).join('\n');
});

  // ATTENDANCE REGISTER
  $('loadRegister').onclick=()=>{
    const m=$('registerMonth').value; if(!m){alert('Pick month');return;}
    const [y,mm]=m.split('-').map(Number),days=new Date(y,mm,0).getDate();
    $('registerHeader').innerHTML='<th>#</th><th>Adm#</th><th>Name</th>'+[...Array(days)].map((_,i)=>`<th>${i+1}</th>`).join('');
    $('registerBody').innerHTML='';
    students.filter(s=>s.cls===$('teacherClassSelect').value&&s.sec===$('teacherSectionSelect').value).forEach((s,i)=>{
      let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=days;d++){const key=`${m}-${String(d).padStart(2,'0')}`,c=(attendanceData[key]||{})[s.adm]||'A';const style=c==='A'?'':`style="background:${{'P':'#4caf50','A':'#f44336','Lt':'#ffeb3b','HD':'#ff9800','L':'#2196f3'}[c]};color:#fff"`;row+=`<td class="reg-cell"${style}><span class="status-text">${c}</span></td>`;}
      const tr=document.createElement('tr');tr.innerHTML=row;$('registerBody').appendChild(tr);
    });
    document.querySelectorAll('.reg-cell').forEach(cell=>cell.onclick=()=>{
      const span=cell.querySelector('.status-text'),codes=['A','P','Lt','HD','L'];let idx=codes.indexOf(span.textContent),next=codes[(idx+1)%codes.length];span.textContent=next;
      cell.style.background=next==='A'?'':{'P':'#4caf50','A':'#f44336','Lt':'#ffeb3b','HD':'#ff9800','L':'#2196f3'}[next];
      cell.style.color=next==='A'?'':'#fff';
    });
    show($('registerTableWrapper'),$('saveRegister'));hide($('loadRegister'),$('changeRegister'),$('downloadRegister'),$('shareRegister'));
  };
  $('saveRegister').onclick=async()=>{
    const m=$('registerMonth').value,[y,mm]=m.split('-').map(Number),days=new Date(y,mm,0).getDate();
    Array.from($('registerBody').children).forEach(tr=>{
      const adm=tr.children[1].textContent;
      for(let d=1;d<=days;d++){const code=tr.children[3+d-1].querySelector('.status-text').textContent;const key=`${m}-${String(d).padStart(2,'0')}`;attendanceData[key]=attendanceData[key]||{};attendanceData[key][adm]=code;}
    });
    await save('attendanceData',attendanceData);hide($('saveRegister'));show($('changeRegister'),$('downloadRegister'),$('shareRegister'));
  };
  $('changeRegister').onclick=()=>{hide($('changeRegister'),$('downloadRegister'),$('shareRegister'));show($('saveRegister'));};
  $('downloadRegister').onclick=()=>{
    const doc=new jspdf.jsPDF({orientation:'landscape',unit:'pt',format:'a4'});doc.text('Attendance Register',14,16);doc.autoTable({startY:24,html:'#registerTable',styles:{fontSize:10}});doc.save('register.pdf');
  };
  $('shareRegister').onclick=()=>{
    const header=`Register\n${$('setupText').textContent}`,rows=Array.from($('registerBody').children).map(tr=>Array.from(tr.children).map(td=>td.querySelector('.status-text')?td.querySelector('.status-text').textContent:td.textContent).join(' '));window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+rows.join('\n'))}`,'_blank');
  };

  // Service worker
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(console.error);
});
