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
  let fineMode        = await get('fineMode')        || 'advance';
  let holidayDates    = await get('holidayDates')    || [];

  let analyticsFilterOptions = ['all'];
  let analyticsDownloadMode  = 'combined';
  let lastAnalyticsShare     = '';

  let barChart, pieChart;
  const barCtx = document.getElementById('barChart')?.getContext('2d');
  const pieCtx = document.getElementById('pieChart')?.getContext('2d');

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 3. DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- 4. SETTINGS: Fines, Eligibility & Holidays ---
  const formDiv      = $('financialForm');
  const saveSettings = $('saveSettings');
  const inputs       = ['fineAbsent','fineLate','fineLeave','fineHalfDay','eligibilityPct']
    .map(id => $(id));

  // settings summary & edit button
  const settingsCard = $('settingsCard');
  const editSettings = $('editSettings');

  // initialize inputs
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;
  formDiv.querySelectorAll('input[name="fineMode"]').forEach(r=> r.checked = r.value===fineMode);
  $('holidayDatesInput').value = holidayDates.join(',');

  saveSettings.onclick = async () => {
    fineRates = {
      A : Number($('fineAbsent').value)||0,
      Lt: Number($('fineLate').value)||0,
      L : Number($('fineLeave').value)||0,
      HD: Number($('fineHalfDay').value)||0,
    };
    eligibilityPct = Number($('eligibilityPct').value)||0;
    fineMode = formDiv.querySelector('input[name="fineMode"]:checked').value;
    holidayDates = $('holidayDatesInput').value
      .split(',').map(s=>s.trim())
      .filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s));
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct),
      save('fineMode', fineMode),
      save('holidayDates', holidayDates)
    ]);
    settingsCard.innerHTML = `
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half-Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility % (≥):</strong> ${eligibilityPct}%</p>
        <p><strong>Mode:</strong> ${fineMode==='advance'?'Advance':'Pro-Rata'}</p>
        <p><strong>Holidays:</strong> ${holidayDates.join(', ')||'None'}</p>
      </div>`;
    hide(formDiv, saveSettings);
    show(settingsCard, editSettings);
  };

  editSettings.onclick = () => {
    hide(settingsCard, editSettings);
    show(formDiv, saveSettings);
  };

  // --- 5. SETUP ---
  async function loadSetup() {
    const name = await get('schoolName')||'';
    $('setupText').textContent = name;
    const classes = await get('classes')||[];
    const sections = await get('sections')||{};
    const clsSel = $('teacherClassSelect');
    clsSel.innerHTML = `<option disabled>-- Select Class --</option>`+
      classes.map(c=>`<option>${c}</option>`).join('');
    clsSel.onchange = () => {
      const secSel = $('teacherSectionSelect');
      secSel.innerHTML = `<option disabled>-- Select Section --</option>`+
        (sections[clsSel.value]||[]).map(s=>`<option>${s}</option>`).join('');
      renderStudents(); updateCounters();
    };
    $('saveSetup').onclick = async () => {
      const nm = prompt('School name?',name);
      const cls = prompt('Classes (CSV)',classes.join(','))||'';
      const sec = prompt('Sections JSON','{}')||'{}';
      await Promise.all([
        save('schoolName', nm),
        save('classes', cls.split(',').map(s=>s.trim())),
        save('sections', JSON.parse(sec))
      ]);
      loadSetup();
    };
  }
  await loadSetup();

  // --- 6. COUNTERS & UTIL ---
  function updateCounters() {
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const total = students.filter(s=>s.cls===cl&&s.sec===sec).length;
    const paidUp = students.filter(s=>{
      if(s.cls!==cl||s.sec!==sec) return false;
      const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      return paid>=fineRates.A;
    }).length;
    $('sectionCount').textContent = total;
    $('classCount').textContent   = students.filter(s=>s.cls===cl).length;
    $('schoolCount').textContent  = students.length;
  }

  // --- 7. STUDENT REGISTRATION ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody');
    tbody.innerHTML='';
    let idx=0;
    students.forEach((s,i)=>{
      if(s.cls!==cl||s.sec!==sec) return;
      idx++;
      const stats = {P:0,A:0,Lt:0,HD:0,L:0};
      Object.entries(attendanceData).forEach(([d,recs])=>{
        if(holidayDates.includes(d)) return;
        const c = recs[s.adm]||'A';
        stats[c]++;
      });
      if(fineMode==='advance') {
        const today=new Date(), y=today.getFullYear(), m=today.getMonth();
        const daysInMonth=new Date(y,m+1,0).getDate();
        const holCount = holidayDates.filter(d=>{
          const dt=new Date(d);
          return dt.getFullYear()===y&&dt.getMonth()===m;
        }).length;
        const expected = daysInMonth-holCount;
        const present = stats.P+stats.Lt+stats.L+stats.HD;
        stats.A = Math.max(0, expected-present);
      }
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt +
                        stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const outstanding = totalFine - paid;
      const totalDays = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct = totalDays ? (stats.P/totalDays)*100 : 0;
      const status = (outstanding>0 || pct<eligibilityPct)?'Debarred':'Eligible';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td>
        <td>${s.name}</td>
        <td>${s.adm}</td>
        <td>${s.parent}</td>
        <td>${s.contact}</td>
        <td>${s.occupation}</td>
        <td>${s.address}</td>
        <td>${stats.P}</td>
        <td>${stats.Lt}</td>
        <td>${stats.L}</td>
        <td>${stats.HD}</td>
        <td>${stats.A}</td>
        <td>${totalDays}</td>
        <td>${pct.toFixed(1)}%</td>
        <td>PKR ${outstanding}</td>
        <td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    document.querySelectorAll('.sel').forEach(cb=>cb.onchange=toggleButtons);
    document.querySelectorAll('.add-payment-btn')
      .forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
    updateCounters();
  }
  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  }

  $('addRegistration').onclick = () => {
    show($('saveRegistration'));
  };
  $('saveRegistration').onclick = async () => {
    const name = $('studentName').value.trim();
    if(!name) return alert('Name required');
    const adm = await genAdmNo();
    const obj = {
      name, adm,
      parent: $('parentName').value.trim(),
      contact: $('parentContact').value.trim(),
      occupation: $('parentOccupation').value.trim(),
      address: $('parentAddress').value.trim(),
      cls: $('teacherClassSelect').value,
      sec: $('teacherSectionSelect').value
    };
    students.push(obj);
    await save('students', students);
    $('studentName').value = $('parentName').value = '';
    renderStudents();
  };

  // --- 8. PAYMENT MODAL ---
  const pm = $('paymentModal'), pam = $('paymentAdm'),
        pamt = $('paymentAmount'), pdate = $('paymentDate');
  $('closePayment').onclick = () => hide(pm);
  function openPaymentModal(adm) {
    pam.textContent = adm;
    pamt.value = '';
    pdate.value = new Date().toISOString().slice(0,10);
    show(pm);
  }
  $('savePayment').onclick = async () => {
    const adm = pam.textContent;
    const arr = paymentsData[adm]||[];
    arr.push({amount:Number(pamt.value)||0, date:pdate.value});
    paymentsData[adm] = arr;
    await save('paymentsData', paymentsData);
    hide(pm);
    renderStudents();
  };

  // --- 9. MARK ATTENDANCE ---
  $('loadAttendance').onclick = () => {
    const date = $('attendanceDate').value;
    const tbody = $('attendanceBody');
    tbody.innerHTML = '';
    students.forEach(s=>{
      if(s.cls!==$('teacherClassSelect').value ||
         s.sec!==$('teacherSectionSelect').value) return;
      tbody.innerHTML += `
        <div class="row-inline">
          <span>${s.name}</span>
          <label><input type="radio" name="status-${s.adm}" value="P">P</label>
          <label><input type="radio" name="status-${s.adm}" value="Lt">Lt</label>
          <label><input type="radio" name="status-${s.adm}" value="L">L</label>
          <label><input type="radio" name="status-${s.adm}" value="HD">HD</label>
          <label><input type="radio" name="status-${s.adm}" value="A" checked>A</label>
        </div>`;
    });
    show($('saveAttendance'));
  };
  $('saveAttendance').onclick = async () => {
    const date = $('attendanceDate').value;
    const recs = {};
    document.querySelectorAll('[name^="status-"]').forEach(radio=>{
      if(radio.checked) {
        const adm = radio.name.split('-')[1];
        recs[adm] = radio.value;
      }
    });
    attendanceData[date] = Object.assign(attendanceData[date]||{}, recs);
    await save('attendanceData', attendanceData);
    alert('Attendance saved');
    renderStudents();
  };

  // --- 10. ANALYTICS ---
  $('loadAnalytics').onclick = () => {
    const from = $('analyticsFrom').value;
    const to   = $('analyticsTo').value;
    const stats = [];
    Object.entries(attendanceData).forEach(([d,recs])=>{
      if(d<from||d>to) return;
      if(holidayDates.includes(d)) return;
      Object.entries(recs).forEach(([adm,status])=>{
        let st = stats.find(x=>x.adm===adm);
        if(!st) {
          const stu = students.find(s=>s.adm===adm)||{};
          st = {adm, name:stu.name||adm, P:0,A:0,Lt:0,HD:0,L:0};
          stats.push(st);
        }
        st[status]++;
      });
    });
    stats.forEach(st=>{
      st.total = st.P+st.A+st.Lt+st.HD+st.L;
      const fineTotal = st.A*fineRates.A + st.Lt*fineRates.Lt +
                        st.L*fineRates.L + st.HD*fineRates.HD;
      const paid = (paymentsData[st.adm]||[]).reduce((a,p)=>a+p.amount,0);
      st.outstanding = fineTotal - paid;
      st.status = (st.outstanding>0 ||
                   (st.total?(st.P/st.total*100):0)<eligibilityPct)
                   ?'Debarred':'Eligible';
    });
    // Render table
    const thead = $('analyticsTable').querySelector('thead tr');
    thead.innerHTML = ['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']
      .map(h=>`<th>${h}</th>`).join('');
    const tbody = $('analyticsBody');
    tbody.innerHTML = '';
    stats.forEach((st,i)=>{
      const pct = st.total?((st.P/st.total)*100).toFixed(1)+'%':'0.0%';
      tbody.innerHTML += `
        <tr>
          <td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td>
          <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td>
          <td>${st.total}</td><td>${pct}</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>
        </tr>`;
    });
    $('instructions').textContent = `Period: ${from} to ${to}`;
    show($('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'));
    // Charts
    if(barChart) barChart.destroy();
    barChart = new Chart(barCtx,{ type:'bar',
      data:{
        labels:stats.map(s=>s.name),
        datasets:[{label:'% Present',data:stats.map(s=>s.total? s.P/s.total*100:0)}]
      },
      options:{ scales:{ y:{beginAtZero:true, max:100}}}
    });
    if(pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx,{ type:'pie',
      data:{ labels:stats.map(s=>s.name),
        datasets:[{ data:stats.map(s=>s.outstanding)}]
      }
    });
    lastAnalyticsShare = stats.map((st,i)=>
      `${i+1}. ${st.adm} ${st.name}: ${(st.total?st.P/st.total*100:0).toFixed(1)}% / PKR ${st.outstanding}`
    ).join('\n');
  };

  // --- 11. ATTENDANCE REGISTER ---
  $('loadRegister').onclick = () => {
    const ym = $('registerMonth').value; // "YYYY-MM"
    const [y,m] = ym.split('-').map(Number);
    const days = new Date(y,m,0).getDate();
    const header = document.getElementById('registerHeader');
    header.innerHTML = `<th>Adm#</th><th>Name</th>` +
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    const body = $('registerBody');
    body.innerHTML = '';
    students.forEach(s=>{
      if(s.cls!==$('teacherClassSelect').value||
         s.sec!==$('teacherSectionSelect').value) return;
      let row = `<td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=days;d++){
        const ds = `${ym}-${String(d).padStart(2,'0')}`;
        const rec = attendanceData[ds]?.[s.adm]||'A';
        const cls = holidayDates.includes(ds)?'holiday':rec;
        row += `<td>${cls}</td>`;
      }
      body.innerHTML += `<tr>${row}</tr>`;
    });
    show($('registerTableWrapper'), $('changeRegister'));
  };
  $('changeRegister').onclick = () => hide($('registerTableWrapper'), $('changeRegister'));

  // --- 12. Service Worker ---
  if('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }

  // initial render
  renderStudents();
});
