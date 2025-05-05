// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- 1. IndexedDB helpers ---
  if (!window.idbKeyval) return console.error('idb-keyval missing');
  const { get, set } = window.idbKeyval;
  const save = (k,v) => set(k,v);

  // --- 2. State & Defaults ---
  let students       = await get('students')        || [];
  let attendanceData = await get('attendanceData')  || {};
  let paymentsData   = await get('paymentsData')    || {};
  let lastAdmNo      = await get('lastAdmissionNo') || 0;
  let fineRates      = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct = await get('eligibilityPct')  || 75;

  async function genAdmNo() {
    lastAdmNo++; await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4,'0');
  }

  // --- 3. DOM Helpers ---
  const $    = id => document.getElementById(id);
  const show = (...els) => els.forEach(e=>e?.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e=>e?.classList.add('hidden'));

  // --- 4. Setup ---
  async function loadSetup() {
    const [sc,cl,sec] = await Promise.all([
      get('schoolName'), get('teacherClass'), get('teacherSection')
    ]);
    if (sc && cl && sec) {
      $('teacherClassSelect').value = cl;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${sc} | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderStudents(); updateCounters(); resetViews();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc = prompt('School name?','My School');
    if (!sc) return alert('Enter school name');
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    if (!cl||!sec) return alert('Pick class & section');
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    await loadSetup();
  };
  $('editSetup').onclick = () => { show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // --- 5. Fines & Eligibility ---
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;
  $('saveSettings').onclick = async () => {
    fineRates = {
      A: +$('fineAbsent').value, Lt: +$('fineLate').value,
      L: +$('fineLeave').value, HD: +$('fineHalfDay').value
    };
    eligibilityPct = +$('eligibilityPct').value;
    await Promise.all([ save('fineRates',fineRates), save('eligibilityPct',eligibilityPct) ]);
    hide($('saveSettings'));
    show($('settingsCard'), $('editSettings'));
    $('settingsCard').innerHTML = `
      <p>Fine/Absent: ${fineRates.A}</p>
      <p>Fine/Late: ${fineRates.Lt}</p>
      <p>Fine/Leave: ${fineRates.L}</p>
      <p>Fine/Half-Day: ${fineRates.HD}</p>
      <p>Eligib. % ≥ ${eligibilityPct}</p>`;
  };
  $('editSettings').onclick = () => show($('saveSettings'));

  // --- 6. Counters & Helpers ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span=>{
      const tgt = +span.dataset.target;
      let v=0, step=Math.max(1,tgt/100);
      (function f(){ v+=step; span.textContent=v<tgt?Math.ceil(v):tgt; if(v<tgt) requestAnimationFrame(f); })();
    });
  }
  function updateCounters() {
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  function resetViews() {
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('downloadAttendancePDF'),
      $('shareAttendanceSummary'), $('registerTableWrapper'),
      $('saveRegister'), $('changeRegister'),
      $('downloadRegister'), $('shareRegister')
    );
  }
  $('teacherClassSelect').onchange   = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- 7. Student Registration ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx=0;
    students.forEach((s,i)=>{
      if (s.cls!==cl||s.sec!==sec) return;
      idx++;
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.entries(attendanceData).forEach(([_, recs])=>stats[ recs[s.adm]||'A' ]++ );
      const totalDays = Object.values(stats).reduce((a,b)=>a+b,0);
      const pct = totalDays? stats.P/totalDays*100:0;
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      const out = totalFine - paid;
      const status = (out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td>
        <td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${out}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}">💰</button></td>`;
      tbody.appendChild(tr);
    });
  }
  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n=$('studentName').value.trim(), p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(), o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim(), cl=$('teacherClassSelect').value,
          sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a) return alert('All fields required');
    const adm = await genAdmNo();
    students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls:cl,sec});
    await save('students',students);
    renderStudents(); updateCounters(); resetViews();
  };

  // --- 8. Payments ---
  function openPaymentModal(adm) {
    const amt = prompt(`Pay amount for ${adm}:`, '0');
    if (amt===null) return;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({date:new Date().toISOString().split('T')[0], amount:+amt});
    save('paymentsData',paymentsData).then(renderStudents);
  }
  document.body.onclick = e => {
    if (e.target.classList.contains('add-payment-btn'))
      openPaymentModal(e.target.dataset.adm);
  };

  // --- 9. Mark Attendance ---
  const statusNames  = {P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'};
  const statusColors = {P:'#4caf50',A:'#f44336',Lt:'#ff9800',HD:'#ffb300',L:'#2196f3'};
  $('loadAttendance').onclick = () => {
    const roster=students.filter(s=>s.cls===$('teacherClassSelect').value&&s.sec===$('teacherSectionSelect').value);
    const container=$('attendanceBody');
    container.innerHTML='';
    roster.forEach((stu,i)=>{
      const row=document.createElement('div'); row.className='attendance-row';
      const nameDiv=document.createElement('div'); nameDiv.className='attendance-name'; nameDiv.textContent=stu.name;
      const btns=document.createElement('div'); btns.className='attendance-buttons';
      Object.keys(statusNames).forEach(code=>{
        const btn=document.createElement('button'); btn.textContent=code;
        btn.onclick=()=>{ btns.querySelectorAll('button').forEach(b=>b.style=''); btn.style.background=statusColors[code]; };
        btns.appendChild(btn);
      });
      row.append(nameDiv,btns);
      container.appendChild(row);
    });
    show($('saveAttendance'));
  };
  $('saveAttendance').onclick = async () => {
    const date = $('dateInput').value;
    attendanceData[date] = {};
    document.querySelectorAll('.attendance-row').forEach((row,i)=>{
      const code = row.querySelector('.attendance-buttons button[style]')?.textContent || 'A';
      const adm = students.filter(s=>s.cls===$('teacherClassSelect').value&&s.sec===$('teacherSectionSelect').value)[i].adm;
      attendanceData[date][adm] = code;
    });
    await save('attendanceData', attendanceData);
    alert('Saved');
  };

  // --- PDF Preview & Share Utility ---
  async function previewAndSharePDF(doc, filename='report.pdf') {
    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    const modal = $('pdfPreviewModal');
    $('pdfPreviewFrame').src = url;
    show(modal);
    $('closePreview').onclick = () => hide(modal);
    $('downloadFromPreview').onclick = () => {
      const a = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
    };
    $('shareFromPreview').onclick = async () => {
      const file = new File([blob], filename, {type:'application/pdf'});
      if (navigator.canShare?.({ files:[file] })) {
        await navigator.share({files:[file],title:filename});
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent('Download: '+url)}`,'_blank');
      }
    };
  }

  // --- Download Handlers ---
  $('downloadAttendancePDF').onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.text('Attendance', 14, 20);
    doc.autoTable({ html: '#attendanceBody' });
    previewAndSharePDF(doc, 'attendance.pdf');
  };
  $('downloadRegister').onclick = () => {
    const doc=new jspdf.jsPDF({orientation:'landscape'});
    doc.text('Register',14,20);
    doc.autoTable({ html:'#registerTable' });
    previewAndSharePDF(doc, 'register.pdf');
  };
  $('downloadAnalytics').onclick = () => {
    const doc=new jspdf.jsPDF();
    doc.text('Analytics',14,20);
    doc.autoTable({ html:'#analyticsTable' });
    previewAndSharePDF(doc, 'analytics.pdf');
  };

  // --- 11. Attendance Register ---
  $('loadRegister').onclick = () => {
    const m=$('registerMonth').value;
    const dates = Object.keys(attendanceData).filter(d=>d.startsWith(m+'-')).sort();
    const th = $('registerHeader'), tb=$('registerBody');
    th.innerHTML='<th>#</th><th>Adm#</th><th>Name</th>' + dates.map(d=>`<th>${d.split('-')[2]}</th>`).join('');
    tb.innerHTML='';
    students.filter(s=>s.cls===$('teacherClassSelect').value&&s.sec===$('teacherSectionSelect').value)
      .forEach((s,i)=>{
        let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
        dates.forEach(date=>{
          const c=attendanceData[date]?.[s.adm]||'A';
          row+=`<td>${c}</td>`;
        });
        tb.innerHTML+=`<tr>${row}</tr>`;
      });
    show($('downloadRegister'));
  };

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
  }
});
