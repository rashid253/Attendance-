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
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students.filter(s => s.cls === cl && s.sec === sec).map(s => {
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => { if (rec[s.adm]) stats[rec.adm]++; });
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

  // Analytics PDF
  $('downloadAnalytics').onclick = async () => {
    if (!lastAnalyticsStats.length) { alert('No analytics to download. Generate report first.'); return; }
    if (analyticsDownloadMode === 'combined') {
      const doc = new jspdf.jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const today = new Date().toISOString().split('T')[0];

      doc.setFontSize(18);
      doc.text('Attendance Analytics Report', 14, 16);
      doc.setFontSize(10);
      doc.text(`Date: ${today}`, pageWidth - 14, 16, { align: 'right' });
      doc.setFontSize(12);
      doc.text($('setupText').textContent, 14, 24);
      doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 32);

      doc.autoTable({ startY: 40, html: '#analyticsTable' });
      const blob = doc.output('blob');
      doc.save('analytics_report.pdf');
      await sharePdf(blob, 'analytics_report.pdf', 'Attendance Analytics Report');
    } else {
      const doc = new jspdf.jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const today = new Date().toISOString().split('T')[0];

      doc.setFontSize(18);
      doc.text('Individual Attendance Analytics Report', 14, 16);
      doc.setFontSize(10);
      doc.text(`Date: ${today}`, pageWidth - 14, 16, { align: 'right' });
      doc.setFontSize(12);
      doc.text($('setupText').textContent, 14, 24);
      doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 32);

      lastAnalyticsStats.forEach((st, i) => {
        if (i > 0) doc.addPage();
        doc.setFontSize(14);
        doc.text(`Name: ${st.name}`, 14, 40);
        doc.text(`Adm#: ${st.adm}`, 14, 60);
        doc.text(`Present: ${st.P}`, 14, 80);
        doc.text(`Absent: ${st.A}`, 14, 100);
        doc.text(`Late: ${st.Lt}`, 14, 120);
        doc.text(`Half-Day: ${st.HD}`, 14, 140);
        doc.text(`Leave: ${st.L}`, 14, 160);
        doc.text(`Total: ${st.total}`, 14, 180);
        const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : '0.0';
        doc.text(`% Present: ${pct}%`, 14, 200);
        doc.text(`Outstanding: PKR ${st.outstanding}`, 14, 220);
        doc.text(`Status: ${st.status}`, 14, 240);
      });
      const blob = doc.output('blob');
      doc.save('individual_analytics_book.pdf');
      await sharePdf(blob, 'individual_analytics_book.pdf', 'Individual Attendance Analytics');
    }
  };

  $('shareAnalytics').onclick = () => {
    if (!lastAnalyticsShare) { alert('No analytics to share. Generate report first.'); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');
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
      Object.values(attendanceData).forEach(rec=>{ if(rec[s.adm]) stats[s.adm]++; });
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
    document.querySelectorAll('tbody tr').forEach(async tr=>{
      const idx=+tr.dataset.index;
      const inputs=tr.querySelectorAll('input');
      if(inputs.length>1){
        students[idx].name=inputs[1].value;
        students[idx].parent=inputs[2].value;
        students[idx].contact=inputs[3].value;
        students[idx].occupation=inputs[4].value;
        students[idx].address=inputs[5].value;
      }
    });
    await save('students',students);
    renderStudents(); hide($('doneEditing')); show($('editSelected'));
  };
  $('deleteSelected').onclick=async()=>{
    if(!confirm('Delete selected?'))return;
    students=students.filter((s,i)=>!document.querySelector(`tbody tr[data-index="${i}"] .sel`).checked);
    await save('students',students);
    renderStudents(); updateCounters(); resetViews();
  };

  // --- 8. Attendance Recording ---
  $('loadRegister').onclick = async()=>{
    hide($('loadRegister'));
    renderAttendance();
    show($('attendanceBody'), $('saveAttendance'), $('resetAttendance'), $('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'));
  };
  function renderAttendance() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value, tbody = $('attendanceBody');
    const dateKey = new Date($('#attendanceDate').value).toISOString().split('T')[0];
    const rec = attendanceData[dateKey] || {};
    tbody.innerHTML='';
    students.forEach((s,i)=>{
      if(s.cls!==cl||s.sec!==sec) return;
      const tr=document.createElement('tr');
      ['P','A','Lt','HD','L'].forEach(st=>{
        tr.innerHTML+=`<td><input type="radio" name="${s.adm}" value="${st}" ${rec[s.adm]===st?'checked':''}></td>`;
      });
      tr.innerHTML=`<td>${s.name}</td><td>${s.adm}</td>`+tr.innerHTML;
      tbody.appendChild(tr);
    });
  }
  $('saveAttendance').onclick=async()=>{
    const dateKey=new Date($('#attendanceDate').value).toISOString().split('T')[0];
    const rec={};
    document.querySelectorAll('#attendanceBody tr').forEach(tr=>{
      const adm=tr.querySelector('td:nth-child(2)').textContent;
      const sel=tr.querySelector('input:checked');
      if(sel) rec[adm]=sel.value;
    });
    attendanceData[dateKey]=rec;
    await save('attendanceData',attendanceData);
    alert('Saved');
  };
  $('resetAttendance').onclick=()=>{
    document.querySelectorAll('#attendanceBody input').forEach(i=>i.checked=false);
  };

  // --- 9. Attendance Summary & Analytics generation ---
  $('generateAnalytics').onclick=()=>{ showAnalytics('all'); };
  function showAnalytics(filter) {
    analyticsFilterOptions = filter==='all'? ['all'] : [filter];
    const from = $('#analyticsFrom').value, to = $('#analyticsTo').value;
    lastAnalyticsRange = { from, to };
    const dates = [];
    let d=new Date(from);
    const end=new Date(to);
    while(d<=end){ dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate()+1); }
    const stats=[];
    students.forEach(s=>{
      if(analyticsFilterOptions[0]!=='all' && s.cls+':'+s.sec !== analyticsFilterOptions[0]) return;
      let P=0,A=0,Lt=0,HD=0,L=0;
      dates.forEach(date=>{
        const rec=attendanceData[date]||{};
        const v=rec[s.adm];
        if(v) { if(v==='P') P++; if(v==='A') A++; if(v==='Lt') Lt++; if(v==='HD') HD++; if(v==='L') L++; }
      });
      const total=P+A+Lt+HD+L;
      const fine=A*fineRates.A+Lt*fineRates.Lt+L*fineRates.L+HD*fineRates.HD;
      const paid=(paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const outstanding=fine-paid;
      const pct=total? (P/total)*100:0;
      const status=(outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible';
      stats.push({ name:s.name, adm:s.adm, P,A,Lt,HD,L,total,fine,paid,outstanding,status });
    });
    lastAnalyticsStats=stats;
    renderAnalyticsTable(stats);
    renderFilterOptions();
    show($('analyticsContainer'), $('analyticsActions'));
    buildShareText(stats);
  }
  function renderAnalyticsTable(stats){
    const table=$('analyticsTable');
    table.innerHTML=`<thead><tr><th>Name</th><th>Adm#</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>Outstanding</th><th>Status</th></tr></thead>`;
    const body=stats.map(st=>`<tr><td>${st.name}</td><td>${st.adm}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>PKR ${st.outstanding}</td><td>${st.status}</td></tr>`).join('');
    table.innerHTML+=`<tbody>${body}</tbody>`;
  }
  function renderFilterOptions(){
    const sel=$('analyticsClassSection');
    sel.innerHTML='<option value="all">All</option>';
    [...new Set(students.map(s=>s.cls+':'+s.sec))].forEach(opt=>{
      sel.innerHTML+=`<option value="${opt}">${opt.replace(':',' Section ')}</option>`;
    });
    sel.onchange=e=>showAnalytics(e.target.value);
  }
  function buildShareText(stats){
    const header=`Attendance Report ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`;
    lastAnalyticsShare=header+'\n'+stats.map(st=>`${st.name}: P:${st.P}, A:${st.A}, % Present: ${((st.total?st.P/st.total:0)*100).toFixed(1)}%`).join('\n');
  }

  // --- 10. Payments Modal ---
  const paymentModal=$('paymentModal'), paymentForm=$('paymentForm'), paymentList=$('paymentList'), closePayment=$('closePayment');
  function openPaymentModal(adm){
    paymentModal.classList.remove('hidden');
    paymentList.innerHTML='';
    (paymentsData[adm]||[]).forEach(p=>{
      const li=document.createElement('li');
      li.textContent=`${p.date}: PKR ${p.amount}`;
      paymentList.appendChild(li);
    });
    paymentForm.onsubmit=async e=>{
      e.preventDefault();
      const amount=Number($('paymentAmount').value), date=new Date().toISOString().split('T')[0];
      paymentsData[adm]=paymentsData[adm]||[];
      paymentsData[adm].push({ amount, date });
      await save('paymentsData',paymentsData);
      openPaymentModal(adm);
    };
  }
  closePayment.onclick=()=>paymentModal.classList.add('hidden');

  // --- 11. Register Import/Export (unchanged) ---
  (async function(){
    const tableWrapper=$('registerTableWrapper'), loadBtn=$('loadRegisterFile'),
          changeBtn=$('changeRegister'), saveBtn=$('downloadRegister'),
          downloadBtn=$('downloadRegisterPDF'), shareBtn=$('shareRegister');
    function bindRegisterActions(){
      loadBtn.onclick=async()=>{
        const [file] = await $('registerFile').files;
        if(!file)return;
        const text=await file.text();
        const [hdr,...rows]=text.trim().split('\n');
        students=rows.map(r=>{
          const [name,adm,parent,contact,occupation,address,cls,sec]=r.split(',');
          return { name,adm,parent,contact,occupation,address,cls,sec };
        });
        await save('students',students);
        renderStudents(); updateCounters(); resetViews();
        tableWrapper.innerHTML=`<table id="studentsTable"><thead><tr><th>Name</th><th>Adm#</th><th>Parent</th><th>Contact</th><th>Occupation</th><th>Address</th><th>Class</th><th>Section</th></tr></thead><tbody>${students.map(s=>`<tr><td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td><td>${s.cls}</td><td>${s.sec}</td></tr>`).join('')}</tbody></table>`;
        hide(loadBtn); show(changeBtn,saveBtn,downloadBtn,shareBtn);
      };
    }
    changeBtn.onclick=()=>{
      hide(tableWrapper,changeBtn,downloadBtn,shareBtn,saveBtn);
      headerRow.innerHTML=''; bodyTbody.innerHTML=''; show(loadBtn);
    };

    bindRegisterActions();
  })();

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
});
