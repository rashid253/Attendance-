// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // —— 0. libraries & storage helpers ——
  if (!window.idbKeyval) {
    console.error('idb-keyval missing');
    return;
  }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // —— 1. state & defaults ——
  let students        = await get('students')        || [];
  let attendanceData  = await get('attendanceData')  || {};
  let paymentsData    = await get('paymentsData')    || {};
  let lastAdmNo       = await get('lastAdmissionNo') || 0;
  let fineRates       = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct  = await get('eligibilityPct')  || 75;

  // —— 2. DOM helpers ——
  const $ = id => document.getElementById(id);
  function bind(id, event, fn) {
    const el = $(id);
    if (el) el[event] = fn;
  }
  function show(id) { const e=$(id); if(e)e.classList.remove('hidden'); }
  function hide(id) { const e=$(id); if(e)e.classList.add('hidden'); }

  // —— 3. Utility ——
  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4,'0');
  }
  function downloadAndShare(doc, filename, title) {
    const blob = doc.output('blob');
    doc.save(filename);
    if (navigator.canShare && navigator.canShare({ files:[new File([blob],filename,{type:'application/pdf'})] })) {
      navigator.share({ files:[new File([blob],filename,{type:'application/pdf'})], title });
    }
  }

  // —— 4. SETUP section ——
  bind('saveSetup','onclick', async () => {
    const school = $('schoolNameInput')?.value;
    const cls    = $('teacherClassSelect')?.value;
    const sec    = $('teacherSectionSelect')?.value;
    if (!school||!cls||!sec) return alert('Fill all setup fields');
    const text = `${school} — ${cls} [Section ${sec}]`;
    $('setupText').textContent = text;
    show('setupDisplay'); hide('setupForm');
    await save('setup', { school, cls, sec });
  });
  bind('editSetup','onclick', () => {
    show('setupForm'); hide('setupDisplay');
  });
  // load saved setup
  const savedSetup = await get('setup');
  if (savedSetup) {
    $('setupText').textContent = `${savedSetup.school} — ${savedSetup.cls} [Section ${savedSetup.sec}]`;
    show('setupDisplay'); hide('setupForm');
  }

  // —— 5. FINANCIAL settings ——
  bind('financialForm','onsubmit', async e => {
    e.preventDefault();
    fineRates = {
      A : parseFloat($('fineAbsent').value)||0,
      Lt: parseFloat($('fineLate').value)||0,
      L : parseFloat($('fineLeave').value)||0,
      HD: parseFloat($('fineHalfDay').value)||0
    };
    eligibilityPct = parseFloat($('eligibilityPct').value)||0;
    await save('fineRates', fineRates);
    await save('eligibilityPct', eligibilityPct);
    alert('Financial settings saved');
  });

  // —— 6. COUNTERS animation ——
  function animateCounter(id, target) {
    const el = $(id);
    if (!el) return;
    let count = 0, step = Math.max(1, Math.floor(target/50));
    const iv = setInterval(() => {
      count += step;
      if (count >= target) { el.textContent = target; clearInterval(iv); }
      else el.textContent = count;
    }, 10);
  }
  function updateCounters() {
    animateCounter('sectionCount', students.length);
    animateCounter('classCount',   students.length);
    animateCounter('schoolCount',  students.length);
  }

  // —— 7. STUDENT REGISTRATION ——
  function renderStudents() {
    const body = $('studentsBody');
    if (!body) return;
    body.innerHTML = '';
    students.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" data-adm="${s.adm}"></td>
        <td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent||''}</td><td>${s.contact||''}</td>
        <td>${s.occupation||''}</td><td>${s.address||''}</td>
        <td>${paymentsData[s.adm]||0}</td><td>-</td>
        <td><button data-action="pay" data-adm="${s.adm}" class="no-print"><i class="fas fa-money-bill"></i></button></td>`;
      body.appendChild(tr);
    });
    updateCounters();
  }
  bind('addStudent','onclick', async () => {
    const name = $('studentName')?.value.trim();
    if (!name) return alert('Enter student name');
    const adm = await genAdmNo();
    students.push({
      adm, name,
      parent: $('parentName')?.value,
      contact: $('parentContact')?.value,
      occupation: $('parentOccupation')?.value,
      address: $('parentAddress')?.value
    });
    await save('students', students);
    renderStudents();
  });
  // payment modal handlers
  document.body.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action="pay"]');
    if (!btn) return;
    const adm = btn.dataset.adm;
    $('payAdm').textContent = adm;
    show('paymentModal');
  });
  bind('cancelPayment','onclick', () => hide('paymentModal'));
  bind('savePayment','onclick', async () => {
    const adm = $('payAdm').textContent;
    const amt = parseFloat($('paymentAmount').value)||0;
    paymentsData[adm] = (paymentsData[adm]||0) + amt;
    await save('paymentsData', paymentsData);
    hide('paymentModal');
    renderStudents();
  });

  // Registration PDF & share
  bind('downloadRegistrationPDF','onclick', () => {
    const doc = new jspdf.jsPDF();
    doc.text('Student List',14,16);
    doc.autoTable({
      startY:24,
      head:[['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: students.map(s => [s.name,s.adm,s.parent||'',s.contact||'',s.occupation||'',s.address||''])
    });
    downloadAndShare(doc,'registration.pdf','Student Registration');
  });
  bind('shareRegistration','onclick', () => $('downloadRegistrationPDF').click());

  renderStudents();

  // —— 8. ATTENDANCE ——
  bind('loadAttendance','onclick', () => {
    const date = $('dateInput').value;
    if (!date) return alert('Select a date');
    const container = $('attendanceBody');
    container.innerHTML = '';
    students.forEach(s => {
      const row = document.createElement('div');
      row.innerHTML = `
        <label>${s.adm} ${s.name}:
          <select id="att_${s.adm}">
            <option value="P">P</option><option value="A">A</option>
            <option value="Lt">Lt</option><option value="HD">HD</option><option value="L">L</option>
          </select>
        </label>`;
      container.appendChild(row);
      if (attendanceData[date] && attendanceData[date][s.adm]) {
        container.querySelector(`#att_${s.adm}`).value = attendanceData[date][s.adm];
      }
    });
    show('saveAttendance'); show('resetAttendance'); show('downloadAttendancePDF'); show('shareAttendanceSummary');
  });
  bind('saveAttendance','onclick', async () => {
    const date = $('dateInput').value;
    attendanceData[date] = {};
    students.forEach(s => {
      attendanceData[date][s.adm] = $(`att_${s.adm}`).value;
    });
    await save('attendanceData', attendanceData);
    alert('Attendance saved');
    renderAttendanceSummary();
  });
  bind('resetAttendance','onclick', () => $('attendanceBody').innerHTML = '');

  function renderAttendanceSummary() {
    const sum = $('attendanceSummary');
    sum.innerHTML = '';
    Object.keys(attendanceData).forEach(d => {
      const rec = attendanceData[d];
      const P = Object.values(rec).filter(v=>v==='P').length;
      const A = Object.values(rec).filter(v=>v==='A').length;
      sum.innerHTML += `<div>${d}: P=${P}, A=${A}</div>`;
    });
    show('attendanceSummary');
  }
  bind('downloadAttendancePDF','onclick', () => {
    const doc = new jspdf.jsPDF();
    doc.text('Attendance Report',14,16);
    const rows = Object.keys(attendanceData).map(d => {
      const rec = attendanceData[d];
      const P = Object.values(rec).filter(v=>v==='P').length;
      const A = Object.values(rec).filter(v=>v==='A').length;
      return [d,P,A];
    });
    doc.autoTable({ startY:24, head:[['Date','P','A']], body:rows });
    downloadAndShare(doc,'attendance.pdf','Attendance Report');
  });
  bind('shareAttendanceSummary','onclick', () => $('downloadAttendancePDF').click());

  // —— 9. ANALYTICS ——
  bind('loadAnalytics','onclick', () => {
    const from = $('analyticsFrom').value, to = $('analyticsTo').value;
    if (!from||!to) return alert('Select range');
    const stats = students.map(s => {
      let P=0,A=0,Lt=0,HD=0,L=0;
      Object.keys(attendanceData).forEach(d => {
        if (d>=from && d<=to) {
          const v = attendanceData[d][s.adm];
          if (v==='P') P++; if (v==='A') A++; if (v==='Lt') Lt++;
          if (v==='HD') HD++; if (v==='L') L++;
        }
      });
      const total = P+A+Lt+HD+L;
      const pct = total ? ((P/total)*100).toFixed(1) : '0.0';
      const out = Math.max(0, total * fineRates.A - (paymentsData[s.adm]||0));
      const status = (parseFloat(pct)>=eligibilityPct && out===0) ? 'Eligible'
                     : (out>0 ? 'Debarred' : 'At Risk');
      return { adm:s.adm, name:s.name, P,A,Lt,HD,L,total,pct,out,status };
    });
    window.analyticsStats = stats;
    renderAnalyticsTable(stats);
    renderCharts(stats);
    show('analyticsContainer'); show('analyticsActions');
  });
  function renderAnalyticsTable(stats) {
    const tb = $('analyticsBody');
    tb.innerHTML = '';
    stats.forEach(st => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${st.adm}</td><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td>
        <td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td>
        <td>${st.pct}%</td><td>${st.out}</td><td>${st.status}</td>`;
      tb.appendChild(tr);
    });
  }
  bind('downloadAnalytics','onclick', () => {
    const doc = new jspdf.jsPDF();
    doc.text('Analytics Report',14,16);
    const body = window.analyticsStats.map(s => [
      s.adm,s.name,s.P,s.A,s.Lt,s.HD,s.L,s.total,`${s.pct}%`,s.out,s.status
    ]);
    doc.autoTable({ startY:24, head:[['Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']], body });
    downloadAndShare(doc,'analytics.pdf','Analytics Report');
  });
  bind('shareAnalytics','onclick', () => $('downloadAnalytics').click());

  // —— 10. REGISTER view ——
  bind('loadRegister','onclick', () => {
    const m = $('registerMonth').value;
    if (!m) return alert('Select month');
    const [year,month] = m.split('-');
    const days = new Date(year,month,0).getDate();
    const hdr = $('registerHeader'); hdr.innerHTML = '<th>Adm#</th><th>Name</th>' +
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    const body = $('registerBody'); body.innerHTML = '';
    students.forEach(s => {
      let row = `<td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1; d<=days; d++) {
        const key = `${m}-${String(d).padStart(2,'0')}`;
        const v = attendanceData[key]?.[s.adm]||'';
        row += `<td>${v}</td>`;
      }
      const tr = document.createElement('tr'); tr.innerHTML = row;
      body.appendChild(tr);
    });
    show('registerTableWrapper'); show('downloadRegister'); show('shareRegister');
  });
  bind('downloadRegister','onclick', () => {
    const doc = new jspdf.jsPDF({ orientation:'landscape' });
    doc.text('Attendance Register',14,16);
    doc.autoTable({ html:'#registerTable', startY:24, styles:{fontSize:8} });
    downloadAndShare(doc,'register.pdf','Attendance Register');
  });
  bind('shareRegister','onclick', () => $('downloadRegister').click());

  // —— 11. Service Worker registration ——  
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered', reg))
        .catch(err => console.error('SW failed', err));
    });
  }

  // —— 12. Chart rendering ——  
  function renderCharts(stats) {
    const barEl = $('barChart'), pieEl = $('pieChart');
    if (barEl && window.Chart) {
      new Chart(barEl, {
        type: 'bar',
        data: { labels: stats.map(s=>s.adm), datasets:[{ label:'% Present', data: stats.map(s=>parseFloat(s.pct)) }] },
        options: { responsive:true }
      });
    }
    if (pieEl && window.Chart) {
      new Chart(pieEl, {
        type: 'pie',
        data: {
          labels:['Eligible','At Risk','Debarred'],
          datasets:[{ data:[
            stats.filter(s=>s.status==='Eligible').length,
            stats.filter(s=>s.status==='At Risk').length,
            stats.filter(s=>s.status==='Debarred').length
          ]}]
        },
        options: { responsive:true }
      });
    }
  }

}); // end DOMContentLoaded
