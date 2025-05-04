/* app.js - Debugged and Refactored Attendance & Payments App */

// Ensure idb-keyval is loaded before this script
window.addEventListener('DOMContentLoaded', async () => {
  // 0. Optional debug console
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // 1. IndexedDB helpers (idb-keyval)
  if (!window.idbKeyval) {
    console.error('idb-keyval not found');
    return;
  }
  const { get, set } = window.idbKeyval;
  const save = (key, val) => set(key, val);

  // 2. Load persistent state
  let students        = (await get('students'))        || [];
  let attendanceData  = (await get('attendanceData'))  || {};
  let paymentsData    = (await get('paymentsData'))    || {};
  let lastAdmNo       = (await get('lastAdmissionNo')) || 0;
  let fineRates       = (await get('fineRates'))       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct  = (await get('eligibilityPct'))  || 75;

  // 3. Utility functions
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));
  const saveSettings = () => Promise.all([ save('fineRates', fineRates), save('eligibilityPct', eligibilityPct) ]);

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  function getFineMode() {
    return document.querySelector('input[name="fineMode"]:checked')?.value || 'advance';
  }

  function calcStats(student) {
    const dates = Object.keys(attendanceData)
      .filter(d => !student.admissionDate || d >= student.admissionDate);
    const stats = { P:0, A:0, Lt:0, HD:0, L:0, total:0 };
    dates.forEach(d => {
      const code = (attendanceData[d]||{})[student.adm] || 'A';
      stats[code]++; stats.total++;
    });
    const autoFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
    let fine = (getFineMode() === 'advance')
      ? (dates.length * fineRates.A - autoFine)
      : autoFine;
    const paid = (paymentsData[student.adm]||[]).reduce((sum,p)=>sum+p.amount, 0);
    const outstanding = fine - paid;
    const pct = stats.total ? (stats.P / stats.total * 100) : 0;
    const status = (outstanding > 0 || pct < eligibilityPct) ? 'Debarred' : 'Eligible';
    return { ...stats, fine, outstanding, pct, status };
  }

  function updateCounters() {
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s => s.cls===cl && s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s => s.cls===cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }

  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target/100);
      (function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
      })();
    });
  }

  function resetViews() {
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('analyticsContainer'), $('graphs'), $('analyticsActions'),
      $('registerTableWrapper'), $('changeRegister'), $('saveRegister'),
      $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }

  function renderStudents() {
    updateCounters();
    const tbody = $('studentsBody'); tbody.innerHTML = '';
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    students.filter(s=>s.cls===cl&&s.sec===sec).forEach((s,i) => {
      const st = calcStats(s);
      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${i+1}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>PKR ${st.outstanding.toFixed(0)}</td><td>${st.status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    document.querySelectorAll('.add-payment-btn').forEach(b=> b.onclick = () => openPaymentModal(b.dataset.adm));
  }

  function renderAll() {
    renderStudents();
    resetViews();
  }

  // 4. Settings: Fines & Eligibility
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;
  $('saveSettings').onclick = async () => {
    fineRates = { A:+$('fineAbsent').value, Lt:+$('fineLate').value, L:+$('fineLeave').value, HD:+$('fineHalfDay').value };
    eligibilityPct = +$('eligibilityPct').value;
    await saveSettings();
    financialDisplayUI();
  };

  function financialDisplayUI() {
    hide($('financialForm'), $('fineModeFieldset'), $('saveSettings'));
    if ($('financialDisplay')) $('financialDisplay').remove();
    const div = document.createElement('div'); div.id = 'financialDisplay'; div.className = 'summary-box';
    div.innerHTML = `
      <h3><i class="fas fa-wallet"></i> Fines & Eligibility</h3>
      <p>Absent Fine: PKR ${fineRates.A}</p>
      <p>Late Fine: PKR ${fineRates.Lt}</p>
      <p>Leave Fine: PKR ${fineRates.L}</p>
      <p>Half‑Day Fine: PKR ${fineRates.HD}</p>
      <p>Eligibility Threshold: ${eligibilityPct}%</p>
      <button id="editSettings" class="no-print"><i class="fas fa-edit"></i> Edit</button>
    `;
    document.getElementById('financial-settings').appendChild(div);
    show(div);
    $('editSettings').onclick = () => { div.remove(); show($('financialForm'), $('fineModeFieldset'), $('saveSettings')); };
  }

  // 5. Setup: School, Class & Section
  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([ get('schoolName'), get('teacherClass'), get('teacherSection') ]);
    if (sc && cl && sec) {
      $('schoolNameInput').value = sc;
      $('teacherClassSelect').value = cl;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm')); show($('setupDisplay')); renderAll();
    }
  }
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc=$('schoolNameInput').value.trim(), cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    if (!sc||!cl||!sec) { alert('Complete setup'); return; }
    await Promise.all([ save('schoolName',sc), save('teacherClass',cl), save('teacherSection',sec) ]);
    loadSetup();
  };
  $('editSetup').onclick = e => { e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };
  await loadSetup();

  // 6. Registration actions
  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n=$('studentName').value.trim(), p=$('parentName').value.trim(), c=$('parentContact').value.trim();
    const o=$('parentOccupation').value.trim(), a=$('parentAddress').value.trim(), admDate=$('admissionDate').value||null;
    if (!n||!p||!c||!o||!a) { alert('All fields required'); return; }
    const adm = await genAdmNo();
    students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:$('teacherClassSelect').value, sec:$('teacherSectionSelect').value, admissionDate:admDate });
    await save('students', students);
    ['studentName','parentName','parentContact','parentOccupation','parentAddress','admissionDate'].forEach(id=>$(id).value='');
    renderAll();
  };

  $('selectAllStudents').onclick = () => {
    const checked = $('selectAllStudents').checked;
    document.querySelectorAll('#studentsBody .sel').forEach(cb=>cb.checked=checked);
    toggleRegButtons();
  };
  function toggleRegButtons() {
    const any = !!document.querySelector('#studentsBody .sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
    $('saveRegistration').disabled = !any;
  }
  $('studentsBody').addEventListener('change', e => { if (e.target.classList.contains('sel')) toggleRegButtons(); });

  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected?')) return;
    const toDel=[...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students = students.filter((_,i)=>!toDel.includes(i));
    await save('students', students);
    renderAll();
  };

  $('saveRegistration').onclick = async () => {
    document.querySelectorAll('#studentsBody tr').forEach(tr => {
      const inputs=[...tr.querySelectorAll('input')].filter(i=>!i.classList.contains('sel'));
      if (inputs.length===5) {
        const [n,p,c,o,a] = inputs.map(i=>i.value.trim());
        const adm = tr.children[3].textContent;
        const idx = students.findIndex(s=>s.adm===adm);
        students[idx] = { ...students[idx], name:n, parent:p, contact:c, occupation:o, address:a };
      }
    });
    await save('students', students);
    renderAll();
  };

  // 7. Payments Modal
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent, amt=+$('paymentAmount').value||0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal')); renderAll();
  };
  ['cancelPayment','paymentModalClose'].forEach(id => $(id).onclick = () => hide($('paymentModal')));

  // 8. Attendance marking
  $('loadAttendance').onclick = () => {
    const body = $('attendanceBody'); body.innerHTML='';
    students.filter(s=>s.cls===$('teacherClassSelect').value && s.sec===$('teacherSectionSelect').value)
      .forEach((stu,i)=>{
        const row=document.createElement('div'); row.className='attendance-row';
        const nameDiv=document.createElement('div'); nameDiv.className='attendance-name'; nameDiv.textContent=stu.name;
        const btns=document.createElement('div'); btns.className='attendance-buttons';
        ['P','A','Lt','HD','L'].forEach(code=>{
          const btn=document.createElement('button'); btn.className='att-btn'; btn.textContent=code;
          btn.onclick=()=>{
            btns.querySelectorAll('.att-btn').forEach(b=>b.classList.remove('selected'));
            btn.classList.add('selected');
          };
          btns.appendChild(btn);
        });
        row.append(nameDiv, btns); body.appendChild(row);
      });
    show($('attendanceBody'), $('saveAttendance'));
  };

  $('saveAttendance').onclick = async () => {
    const date = $('dateInput').value; if (!date) { alert('Please pick a date'); return; }
    attendanceData[date] = {};
    const roster = students.filter(s=>s.cls===$('teacherClassSelect').value && s.sec===$('teacherSectionSelect').value);
    roster.forEach((s,i)=>{
      const btn = $('attendanceBody').children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = btn ? btn.textContent : 'A';
    });
    await save('attendanceData', attendanceData);
    // show summary...
    renderAll();
  };

  // 9. Service Worker registration
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(console.error);

  // Initial render
  renderAll();
});
