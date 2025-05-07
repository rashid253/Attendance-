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

  // --- 4. SETTINGS: Fines & Eligibility ---
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
      hide($('setupForm')); show($('setupDisplay'));
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
      (function upd() { count+=step; span.textContent = count<target?Math.ceil(count):target; if(count<target) requestAnimationFrame(upd); })();
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
    hide($('attendanceBody'),$('saveAttendance'),$('resetAttendance'),
         $('attendanceSummary'),$('downloadAttendancePDF'),$('shareAttendanceSummary'),
         $('instructions'),$('analyticsContainer'),$('graphs'),$('analyticsActions'),
         $('registerTableWrapper'),$('changeRegister'),
         $('saveRegister'),$('downloadRegister'),$('shareRegister'));
    show($('loadRegister'));
  }
  $('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- 7. STUDENT REGISTRATION & FINE/STATUS ---
  function renderStudents() {
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value, tbody=$('studentsBody');
    tbody.innerHTML=''; let idx=0;
    students.forEach(s=>{
      if(s.cls!==cl||s.sec!==sec) return;
      idx++;
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(rec=>{ if(rec[s.adm]) stats[rec[s.adm]]++; });
      const total=stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const fine=stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid=(paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0), out=fine-paid;
      const pct= total? (stats.P/total)*100:0, status=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const row=`<tr data-index="${idx-1}">
        <td>${idx}</td><td>${s.adm}</td><td>${s.name}</td><td>PKR ${out}</td><td>${status}</td>
        <td><button onclick="openPaymentModal('${s.adm}')">Pay</button></td>
      </tr>`;
      tbody.insertAdjacentHTML('beforeend',row);
    });
  }

  // --- 8. PAYMENT MODAL ---
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm; $('paymentAmount').value=''; show($('paymentModal'));
  }
  $('paymentModalClose').onclick = () => hide($('paymentModal'));
  $('savePayment').onclick = async () => {
    const adm=$('payAdm').textContent, amt=Number($('paymentAmount').value)||0;
    paymentsData[adm]=paymentsData[adm]||[]; paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
    await save('paymentsData', paymentsData); hide($('paymentModal')); renderStudents();
  };
  $('cancelPayment').onclick = () => hide($('paymentModal'));

  // --- DOWNLOAD & SHARE: Registration PDF ---
  $('downloadRegistrationPDF').onclick = async () => {
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18).text('Student List',14,16);
    const today=new Date().toISOString().split('T')[0], w=doc.internal.pageSize.getWidth();
    doc.setFontSize(12).text(today, w-14,16,{align:'right'});
    doc.text($('setupText').textContent,14,24);
    doc.autoTable({startY:32,html:'#studentsTable'});
    const blob=doc.output('blob'); doc.save('registration.pdf'); await sharePdf(blob,'registration.pdf','Student List');
  };
  $('shareRegistration').onclick = () => {
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const header=`*Students List*\nClass ${cl} Section ${sec}`;
    const lines=students.filter(s=>s.cls===cl&&s.sec===sec).map(s=>`*${s.name}* - Adm#: ${s.adm}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines.join('\n'))}`,'_blank');
  };

  // --- 9. ATTENDANCE: Load/Save/Download/Share ---
  const dateInput=$('dateInput'), loadAttendanceBtn=$('loadAttendance'), saveAttendanceBtn=$('saveAttendance'),
        downloadAttendanceBtn=$('downloadAttendancePDF'), shareAttendanceBtn=$('shareAttendanceSummary'),
        attendanceBodyDiv=$('attendanceBody'), attendanceSummaryDiv=$('attendanceSummary'),
        statusNames={P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'},
        statusColors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};

  loadAttendanceBtn.onclick=()=>{
    attendanceBodyDiv.innerHTML=''; attendanceSummaryDiv.innerHTML='';
    students.filter(s=>s.cls===$('teacherClassSelect').value&&s.sec===$('teacherSectionSelect').value)
      .forEach(stu=>{
        const row=document.createElement('div'), nameDiv=document.createElement('div'), btnsDiv=document.createElement('div');
        row.className='attendance-row'; nameDiv.className='attendance-name'; nameDiv.textContent=stu.name;
        btnsDiv.className='attendance-buttons';
        Object.keys(statusNames).forEach(code=>{
          const btn=document.createElement('button'); btn.className='att-btn'; btn.textContent=code;
          btn.onclick=()=>{ btnsDiv.querySelectorAll('.att-btn').forEach(b=>{b.classList.remove('selected');b.style='';});
                           btn.classList.add('selected'); btn.style.background=statusColors[code]; btn.style.color='#fff'; };
          btnsDiv.appendChild(btn);
        });
        row.append(nameDiv,btnsDiv); attendanceBodyDiv.appendChild(row);
      });
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  saveAttendanceBtn.onclick=async()=>{
    const dt=dateInput.value; if(!dt){alert('Pick a date');return;}
    attendanceData[dt]={};
    students.filter(s=>s.cls===$('teacherClassSelect').value&&s.sec===$('teacherSectionSelect').value)
      .forEach((s,i)=>{
        const sel=attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
        attendanceData[dt][s.adm]=sel?sel.textContent:'A';
      });
    await save('attendanceData',attendanceData);
    attendanceSummaryDiv.innerHTML=`<h3>Attendance Report: ${dt}</h3>`;
    show(attendanceSummaryDiv, downloadAttendanceBtn, shareAttendanceBtn);
  };

  downloadAttendanceBtn.onclick=async()=>{
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18).text('Attendance Report',14,16);
    const w=doc.internal.pageSize.getWidth(), dt=dateInput.value;
    doc.setFontSize(12).text(dt, w-14,16,{align:'right'});
    doc.text($('setupText').textContent,14,24);
    doc.autoTable({startY:32,html:'#attendanceSummary table'});
    const blob=doc.output('blob'), fn=`attendance_${dt}.pdf`;
    doc.save(fn); await sharePdf(blob,fn,'Attendance Report');
  };

  shareAttendanceBtn.onclick=()=>{
    const dt=dateInput.value, cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const header=`*Attendance Report*\nClass ${cl} Section ${sec} - ${dt}`;
    const lines=students.filter(s=>s.cls===cl&&s.sec===sec)
      .map(s=>`*${s.name}*: ${statusNames[attendanceData[dt][s.adm]]}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n\n'+lines.join('\n'))}`,'_blank');
  };

  // --- 11. ATTENDANCE REGISTER: Download & Share ---
  (function(){
    const loadBtn=$('loadRegister'), saveBtn=$('saveRegister'),
          downloadBtn=$('downloadRegister'), shareBtn=$('shareRegister'),
          headerRow=$('registerHeader'), bodyTbody=$('registerBody');

    downloadBtn.onclick=async()=>{
      const doc=new jspdf.jsPDF({orientation:'landscape',unit:'pt',format:'a4'});
      doc.setFontSize(18).text('Attendance Register',14,20);
      const today=new Date().toISOString().split('T')[0], pw=doc.internal.pageSize.getWidth();
      doc.setFontSize(12).text(today,pw-14,20,{align:'right'});
      doc.text($('setupText').textContent,14,36);
      doc.autoTable({startY:50,html:'#registerTable',tableWidth:'auto',styles:{fontSize:10}});
      const blob=doc.output('blob'); doc.save('attendance_register.pdf'); await sharePdf(blob,'attendance_register.pdf','Attendance Register');
    };

    shareBtn.onclick=()=>{
      const header=`Attendance Register\n${$('setupText').textContent}`;
      const rows=Array.from(bodyTbody.children).map(tr=>Array.from(tr.children)
        .map(td=>td.querySelector('.status-text')?.textContent||td.textContent).join(' '));
      window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+rows.join('\n'))}`,'_blank');
    };
  })();

  // --- 12. Service Worker ---
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(console.error);
});
