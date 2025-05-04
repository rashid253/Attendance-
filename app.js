// app.js
window.addEventListener('DOMContentLoaded', async () => {
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
  let students        = await get('students')        || [];
  let attendanceData  = await get('attendanceData')  || {};
  let paymentsData    = await get('paymentsData')    || {};
  let lastAdmNo       = await get('lastAdmissionNo') || 0;
  let fineRates       = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct  = await get('eligibilityPct')  || 75;
  let analyticsStats  = [], analyticsRange = {}, analyticsFilter = ['all'], analyticsDownload = 'combined';

  // --- 3. Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));
  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }
  function getFineMode() {
    return document.querySelector('input[name="fineMode"]:checked')?.value || 'advance';
  }
  function renderAll() {
    renderRegistrationTable();
    renderSettingsCard();
    updateCounters();
    resetViews();
  }

  // --- 4. Fines & Eligibility ---
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  function renderSettingsCard() {
    $('settingsCard').innerHTML = `
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
      </div>`;
  }

  $('saveSettings').onclick = async () => {
    fineRates = {
      A : +$('fineAbsent').value   || 0,
      Lt: +$('fineLate').value     || 0,
      L : +$('fineLeave').value    || 0,
      HD: +$('fineHalfDay').value  || 0
    };
    eligibilityPct = +$('eligibilityPct').value || 0;
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);
    renderSettingsCard();
    hide($('financialForm'), $('saveSettings'));
    show($('settingsCard'), $('editSettings'));
  };
  $('editSettings').onclick = () => {
    hide($('settingsCard'), $('editSettings'));
    show($('financialForm'), $('saveSettings'));
  };

  // --- 5. Setup ---
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
    if (!sc||!cl||!sec) { alert('Complete setup'); return; }
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    loadSetup();
  };
  $('editSetup').onclick = e => {
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };
  await loadSetup();

  // --- 6. Counters & Views ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target/100);
      (function update(){
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

  // --- 7. Student Registration ---
  function clearRegistrationForm() {
    ['studentName','parentName','parentContact','parentOccupation','parentAddress','admissionDate']
      .forEach(id=>$(id).value='');
  }
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
    if (!n||!p||!c||!o||!a) { alert('All fields required'); return; }
    if (!/^\d{7,15}$/.test(c)) { alert('Contact 7–15 digits'); return; }
    const adm = await genAdmNo();
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec, admissionDate:admDate });
    await save('students', students);
    clearRegistrationForm();
    renderRegistrationTable();
    updateCounters();
    resetViews();
  };

  function renderRegistrationTable() {
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    students.forEach((s,i)=>{
      if (s.cls!==cl||s.sec!==sec) return;
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${i+1}</td>
        <td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>
        <td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    toggleRegButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }
  function toggleRegButtons() {
    const any = !!document.querySelector('#studentsBody .sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
    $('saveRegistration').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) toggleRegButtons();
  });
  $('selectAllStudents').onclick = () => {
    const c = $('selectAllStudents').checked;
    document.querySelectorAll('.sel').forEach(cb=>cb.checked=c);
    toggleRegButtons();
  };
  $('editSelected').onclick = () => {
    document.querySelectorAll('.sel:checked').forEach(cb=>{
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
        <td colspan="2"></td>
      `;
    });
    hide($('editSelected'), $('deleteSelected'), $('selectAllStudents'));
    show($('saveRegistration'));
  };
  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected?')) return;
    const toDel = [...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students = students.filter((_,i)=>!toDel.includes(i));
    await save('students', students);
    renderRegistrationTable();
  };
  $('saveRegistration').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach(tr=>{
      const inputs = [...tr.querySelectorAll('input')].filter(i=>!i.classList.contains('sel'));
      if (inputs.length===5) {
        const [n,p,c,o,a] = inputs.map(i=>i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(s=>s.adm===adm);
        students[idx] = { ...students[idx], name:n, parent:p, contact:c, occupation:o, address:a };
      }
    });
    await save('students', students);
    hide($('saveRegistration'));
    show($('editSelected'), $('deleteSelected'), $('selectAllStudents'));
    renderRegistrationTable();
  };

  // --- 8. Payment Modal ---
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent, amt = +$('paymentAmount').value || 0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderAll();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));
  $('paymentModalClose').onclick = () => hide($('paymentModal'));

  // --- 9. Mark Attendance ---
  $('loadAttendance').onclick    = loadAttendance;
  $('saveAttendance').onclick    = saveAttendance;
  $('resetAttendance').onclick   = resetAttendance;
  $('downloadAttendancePDF').onclick    = downloadAttendancePDF;
  $('shareAttendanceSummary').onclick  = shareAttendanceSummary;

  function loadAttendance() {
    const ab = $('attendanceBody'); ab.innerHTML = '';
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((s,i)=>{
      const row = document.createElement('div'); row.className='attendance-row';
      const nameDiv = document.createElement('div'); nameDiv.className='attendance-name'; nameDiv.textContent=s.name;
      const btns = document.createElement('div'); btns.className='attendance-buttons';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const btn = document.createElement('button'); btn.className='att-btn'; btn.textContent=code;
        btn.onclick = ()=>{
          btns.querySelectorAll('.att-btn').forEach(b=>{b.classList.remove('selected');b.style.background='';b.style.color='';});
          btn.classList.add('selected');
          btn.style.background = {'P':'var(--success)','A':'var(--danger)','Lt':'var(--warning)','HD':'#FF9800','L':'var(--info)'}[code];
          btn.style.color = '#fff';
        };
        btns.appendChild(btn);
      });
      row.append(nameDiv, btns); ab.appendChild(row);
    });
    show(ab, $('saveAttendance'));
    hide($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), $('attendanceSummary'));
  }

  async function saveAttendance() {
    const date = $('dateInput').value; if (!date) { alert('Pick date'); return; }
    attendanceData[date] = {};
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((s,i)=> {
      const btn = $('attendanceBody').children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = btn ? btn.textContent : 'A';
    });
    await save('attendanceData', attendanceData);
    const summary = $('attendanceSummary');
    summary.innerHTML = `<h3>Attendance Report: ${date}</h3><table id="attendanceSummaryTable"><tr><th>Name</th><th>Status</th><th>Share</th></tr>`;
    roster.forEach(s=>{
      const code = attendanceData[date][s.adm];
      const label = {P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'}[code];
      summary.innerHTML += `<tr><td>${s.name}</td><td>${label}</td><td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td></tr>`;
    });
    summary.innerHTML += '</table>';
    summary.querySelectorAll('.share-individual').forEach(ic=>ic.onclick=()=>{
      const adm = ic.dataset.adm, st = students.find(x=>x.adm===adm);
      const code = attendanceData[date][adm], label = {P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'}[code];
      window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(`Dear Parent, your child was ${label} on ${date}.`)}`,'_blank');
    });
    hide($('attendanceBody'), $('saveAttendance'));
    show($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), summary);
  }

  function resetAttendance() {
    show($('attendanceBody'), $('saveAttendance'));
    hide($('resetAttendance'), $('downloadAttendancePDF'), $('shareAttendanceSummary'), $('attendanceSummary'));
  }

  function downloadAttendancePDF() {
    const date = $('dateInput').value;
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report', 14, 16);
    doc.setFontSize(12); doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 32, html: '#attendanceSummaryTable' });
    doc.save(`attendance_${date}.pdf`);
  }

  function shareAttendanceSummary() {
    const date = $('dateInput').value;
    const cl   = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `Attendance Report\nClass ${cl} Section ${sec} - ${date}`;
    const lines = students.filter(s=>s.cls===cl&&s.sec===sec).map(s=>{
      const code = attendanceData[date][s.adm];
      const label = {P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'}[code];
      return `*${s.name}*: ${label}`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  }

  // --- 10. Analytics & Charts ---
  $('loadAnalytics').onclick = () => {
    if ($('analyticsTarget').value === 'student' && !$('analyticsSearch').value.trim()) {
      return alert('Enter Adm# or Name');
    }
    let from, to, type = $('analyticsType').value;
    if (type === 'date') {
      from = to = $('analyticsDate').value;
    } else if (type === 'month') {
      const m = $('analyticsMonth').value, [y, mm] = m.split('-').map(Number);
      from = `${m}-01`;
      to   = `${m}-${String(new Date(y, mm, 0).getDate()).padStart(2,'0')}`;
    } else if (type === 'semester') {
      const s = $('semesterStart').value, e = $('semesterEnd').value;
      const [sy, sm] = s.split('-').map(Number), [ey, em] = e.split('-').map(Number);
      from = `${s}-01`;
      to   = `${e}-${String(new Date(ey, em, 0).getDate()).padStart(2,'0')}`;
    } else if (type === 'year') {
      const y = $('yearStart').value;
      from = `${y}-01-01`;
      to   = `${y}-12-31}`;
    } else {
      return alert('Select a period');
    }
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    let pool = students.filter(s=>s.cls===cl&&s.sec===sec);
    if ($('analyticsTarget').value==='section') {
      pool = pool.filter(s=>s.sec===$('analyticsSectionSelect').value);
    }
    if ($('analyticsTarget').value==='student') {
      const q = $('analyticsSearch').value.trim().toLowerCase();
      pool = pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));
    }
    analyticsStats = pool.map(s=>{ const st = calcStats(s); return { adm:s.adm, name:s.name, ...st }; });
    analyticsRange = { from, to };
    renderAnalytics(analyticsStats, from, to);
  };

  function calcStats(s) {
    const dates = Object.keys(attendanceData).filter(d=>!s.admissionDate||d>=s.admissionDate);
    const stats = { P:0, A:0, Lt:0, HD:0, L:0, total:0 };
    dates.forEach(d=>{
      const code = (attendanceData[d]||{})[s.adm]||'A';
      stats[code]++; stats.total++;
    });
    const auto = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
    const fine = getFineMode()==='advance'
      ? dates.length*fineRates.A - auto
      : auto;
    const paid = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
    const out  = fine - paid, pct = stats.total ? (stats.P/stats.total*100) : 0;
    return { ...stats, outstanding:out, pct, status:(out>0||pct<eligibilityPct)?'Debarred':'Eligible' };
  }

  function renderAnalytics(stats, from, to) {
    const tbody = $('analyticsBody');
    tbody.innerHTML = '';
    stats.forEach((st,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td>
        <td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td>
        <td>${st.pct.toFixed(1)}%</td><td>PKR ${st.outstanding.toFixed(0)}</td><td>${st.status}</td>
      `;
      tbody.appendChild(tr);
    });
    $('instructions').textContent = `Period: ${from} to ${to}`;
    show($('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'));
    if (window.barChart) window.barChart.destroy();
    window.barChart = new Chart($('barChart').getContext('2d'), {
      type:'bar',
      data:{ labels:stats.map(s=>s.name), datasets:[{ label:'% Present', data:stats.map(s=>s.total?s.P/s.total*100:0) }] },
      options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
    });
    if (window.pieChart) window.pieChart.destroy();
    window.pieChart = new Chart($('pieChart').getContext('2d'), {
      type:'pie',
      data:{ labels:['Outstanding'], datasets:[{ data:[stats.reduce((sum,s)=>sum+s.outstanding,0)] }] }
    });
  }

  $('downloadAnalytics').onclick = () => {
    // combined or individual as earlier...
  };
  $('shareAnalytics').onclick = () => {
    // share logic as earlier...
  };

  // --- 11. Attendance Register ---
  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value; if (!m) { alert('Pick month'); return; }
    const [y,mm] = m.split('-').map(Number), days = new Date(y,mm,0).getDate();
    const rh = $('registerHeader'), rb = $('registerBody');
    rh.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>${[...Array(days)].map((_,i)=>`<th>${i+1}</th>`).join('')}`;
    rb.innerHTML = '';
    const cl = $('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((s,i)=>{
      let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=days;d++){
        const key=`${m}-${String(d).padStart(2,'0')}`;
        const code=(attendanceData[key]||{})[s.adm]||'A';
        const colors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};
        const style=code==='A'?'':`style="background:${colors[code]};color:#fff"`;
        row+=`<td class="reg-cell"${style}><span class="status-text">${code}</span></td>`;
      }
      const tr=document.createElement('tr'); tr.innerHTML=row; rb.appendChild(tr);
    });
    rb.querySelectorAll('.reg-cell').forEach(cell=>{
      cell.onclick = () => {
        const span=cell.querySelector('.status-text'), codes=['A','P','Lt','HD','L'];
        let idx=codes.indexOf(span.textContent); idx=(idx+1)%codes.length;
        const c=codes[idx], colors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};
        span.textContent=c; if(c==='A'){ cell.style.background=''; cell.style.color=''; }
        else { cell.style.background=colors[c]; cell.style.color='#fff'; }
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
      for(let d=1;d<=days;d++){
        const code=tr.children[3+d-1].querySelector('.status-text').textContent;
        const key=`${m}-${String(d).padStart(2,'0')}`;
        attendanceData[key]=attendanceData[key]||{};
        attendanceData[key][adm]=code;
      }
    });
    await save('attendanceData', attendanceData);
    hide($('saveRegister'));
    show($('changeRegister'), $('downloadRegister'), $('shareRegister'));
  };
  $('changeRegister').onclick = () => {
    hide($('registerTableWrapper'), $('changeRegister'), $('downloadRegister'), $('shareRegister'), $('saveRegister'));
    show($('loadRegister'));
  };
  $('downloadRegister').onclick = () => {
    const doc=new jspdf.jsPDF({orientation:'landscape',unit:'pt',format:'a4'});
    doc.setFontSize(18); doc.text('Attendance Register',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({startY:32,html:'#registerTable',tableWidth:'auto',styles:{fontSize:10}});
    doc.save('attendance_register.pdf');
  };
  $('shareRegister').onclick = () => {
    const header=`Attendance Register\n${$('setupText').textContent}`;
    const rows=Array.from($('registerBody').children).map(tr=>
      Array.from(tr.children).map(td=>td.querySelector('.status-text')?td.querySelector('.status-text').textContent:td.textContent).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+rows.join('\n'))}`,'_blank');
  };

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }

  // Initial render
  renderRegistrationTable();
  renderSettingsCard();
  renderAll();
});
