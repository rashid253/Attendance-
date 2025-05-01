// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // IndexedDB helpers
  const { get, set } = window.idbKeyval;
  const save = (k,v)=>set(k,v);

  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData')|| {};
  let paymentsData   = await get('paymentsData')   || {};
  let fineRates      = await get('fineRates')      || { A:50,Lt:20,L:10,HD:30 };
  let eligibilityPct = await get('eligibilityPct') || 75;
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;

  // DOM helpers
  const $ = id=>document.getElementById(id);
  const show=(...els)=>els.forEach(e=>e.classList.remove('hidden'));
  const hide=(...els)=>els.forEach(e=>e.classList.add('hidden'));

  async function genAdmNo(){
    lastAdmNo++; await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4,'0');
  }

  // 1. SETTINGS (unchanged) ...
  // 2. SETUP (unchanged) ...
  // 3. COUNTERS (unchanged) ...

  // 4. STUDENT REGISTRATION
  function renderStudents(){
    const tbody = $('studentsBody'); tbody.innerHTML='';
    const cl = $('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    let idx=0;
    students.forEach((s,i)=>{
      if(s.cls!==cl||s.sec!==sec) return;
      idx++;
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(r=>stats[r[s.adm]||'A']++);
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      const out = totalFine - paid;
      const totalDays=stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct = totalDays?(stats.P/totalDays)*100:0;
      const status = (out>0||pct<eligibilityPct)?'Debarred':'Eligible';

      const tr=document.createElement('tr');
      tr.dataset.index=i;
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>PKR ${out}</td><td>${status}</td>
        <td><i class="fas fa-minus-circle adjust-icon" data-adm="${s.adm}"></i></td>
        <td class="details-cell">
          <i class="fas fa-chevron-right details-icon"></i>
          <div class="hidden-info">
            <span class="cell-content">Contact: ${s.contact}</span><br>
            <span class="cell-content">Occupation: ${s.occupation}</span><br>
            <span class="cell-content">Address: ${s.address}</span>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // toggle details
    document.querySelectorAll('.details-icon').forEach(icon=>{
      icon.onclick=()=>{
        const div=icon.closest('td').querySelector('.hidden-info');
        div.querySelectorAll('.cell-content').forEach(span=>span.classList.toggle('visible'));
        icon.classList.toggle('fa-rotate-90');
      };
    });

    // adjust fine
    document.querySelectorAll('.adjust-icon').forEach(ic=>{
      ic.onclick=async()=>{
        const adm=ic.dataset.adm;
        let amt=prompt('Enter amount to deduct:');
        amt=parseFloat(amt);
        if(!amt||isNaN(amt)||amt<=0) return alert('Invalid');
        paymentsData[adm]=paymentsData[adm]||[];
        paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
        await save('paymentsData', paymentsData);
        renderStudents();
      };
    });

    // row selection handlers (unchanged) …
    $('selectAllStudents').checked=false; toggleButtons();
  }

  function toggleButtons(){
    const any=!!document.querySelector('.sel:checked');
    $('editSelected').disabled=!any;
    $('deleteSelected').disabled=!any;
  }

  // global downloads
  $('downloadOverallFine').onclick=()=>{
    const { jsPDF }=window.jspdf;
    const doc=new jsPDF();
    doc.setFontSize(16);
    doc.text('Fine & Eligibility - All Students',14,16);
    const body=students.map(s=>{
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      Object.values(attendanceData).forEach(r=>stats[r[s.adm]||'A']++);
      const totalFine=stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid=(paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      const out=totalFine-paid;
      const totalDays=stats.P+stats.A+stats.Lt+stats.HD+stats.L;
      const pct=totalDays?(stats.P/totalDays)*100:0;
      const status=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      return [s.adm,s.name,`${pct.toFixed(1)}%`,`PKR ${out}`,status];
    });
    doc.autoTable({ head:[['Adm#','Name','% Present','Outstanding','Status']], body });
    doc.save('all_fine_report.pdf');
  };

  $('downloadOverallInfo').onclick=()=>{
    const { jsPDF }=window.jspdf;
    const doc=new jsPDF();
    doc.setFontSize(16);
    doc.text('All Students - Full Info',14,16);
    const body=students.map(s=>[s.adm,s.name,s.contact,s.occupation,s.address]);
    doc.autoTable({ head:[['Adm#','Name','Contact','Occupation','Address']], body });
    doc.save('all_students_info.pdf');
  };
        
  // --- 9. MARK ATTENDANCE ---
  const dateInput             = $('dateInput');
  const loadAttendanceBtn     = $('loadAttendance');
  const saveAttendanceBtn     = $('saveAttendance');
  const resetAttendanceBtn    = $('resetAttendance');
  const downloadAttendanceBtn = $('downloadAttendancePDF');
  const shareAttendanceBtn    = $('shareAttendanceSummary');
  const attendanceBodyDiv     = $('attendanceBody');
  const attendanceSummaryDiv  = $('attendanceSummary');
  const statusNames           = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' };
  const statusColors          = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  loadAttendanceBtn.onclick = () => {
    attendanceBodyDiv.innerHTML = '';
    attendanceSummaryDiv.innerHTML = '';
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s => s.cls === cl && s.sec === sec);

    roster.forEach((stu, i) => {
      const row    = document.createElement('div');
      row.className = 'attendance-row';
      const nameDiv = document.createElement('div');
      nameDiv.className = 'attendance-name';
      nameDiv.textContent = stu.name;
      const btnsDiv = document.createElement('div');
      btnsDiv.className = 'attendance-buttons';

      Object.keys(statusNames).forEach(code => {
        const btn = document.createElement('button');
        btn.className = 'att-btn';
        btn.textContent = code;
        btn.onclick = () => {
          btnsDiv.querySelectorAll('.att-btn').forEach(b => {
            b.classList.remove('selected');
            b.style.background = '';
            b.style.color = '';
          });
          btn.classList.add('selected');
          btn.style.background = statusColors[code];
          btn.style.color = '#fff';
        };
        btnsDiv.appendChild(btn);
      });

      row.append(nameDiv, btnsDiv);
      attendanceBodyDiv.appendChild(row);
    });

    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  saveAttendanceBtn.onclick = async () => {
    const date = dateInput.value;
    if (!date) { alert('Please pick a date'); return; }
    attendanceData[date] = {};
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s => s.cls === cl && s.sec === sec);

    roster.forEach((s, i) => {
      const btn = attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = btn ? btn.textContent : 'A';
    });

    await save('attendanceData', attendanceData);

    attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
    const tbl = document.createElement('table');
    tbl.innerHTML = `<tr><th>Name</th><th>Status</th><th>Share</th></tr>`;

    roster.forEach(s => {
      const code = attendanceData[date][s.adm];
      tbl.innerHTML += `
        <tr>
          <td>${s.name}</td>
          <td>${statusNames[code]}</td>
          <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
        </tr>`;
    });

    attendanceSummaryDiv.appendChild(tbl);

    attendanceSummaryDiv.querySelectorAll('.share-individual')
      .forEach(ic => ic.onclick = () => {
        const adm     = ic.dataset.adm;
        const student = students.find(x => x.adm === adm);
        const code    = attendanceData[date][adm];
        const msg     = `Dear Parent, your child was ${statusNames[code]} on ${date}.`;
        window.open(`https://wa.me/${student.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      });

    hide(attendanceBodyDiv, saveAttendanceBtn);
    show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  resetAttendanceBtn.onclick = () => {
    show(attendanceBodyDiv, saveAttendanceBtn);
    hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
  };

  downloadAttendanceBtn.onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text('Attendance Report', 14, 16);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 32, html: '#attendanceSummary table' });
    doc.save(`attendance_${dateInput.value}.pdf`);
  };

  shareAttendanceBtn.onclick = () => {
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const date = dateInput.value;
    const header = `*Attendance Report*\nClass ${cl} Section ${sec} - ${date}`;
    const lines  = students.filter(s => s.cls === cl && s.sec === sec)
      .map(s => `*${s.name}*: ${statusNames[attendanceData[date][s.adm]]}`)
      .join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // --- 10. ANALYTICS ---
  const atg   = $('analyticsTarget');
  const asel  = $('analyticsSectionSelect');
  const atype = $('analyticsType');
  const adate = $('analyticsDate');
  const amonth= $('analyticsMonth');
  const sems  = $('semesterStart');
  const seme  = $('semesterEnd');
  const ayear = $('yearStart');
  const asearch = $('analyticsSearch');
  const loadA   = $('loadAnalytics');
  const resetA  = $('resetAnalytics');
  const instr   = $('instructions');
  const acont   = $('analyticsContainer');
  const graphs  = $('graphs');
  const aacts   = $('analyticsActions');
  const barCtx  = $('barChart').getContext('2d');
  const pieCtx  = $('pieChart').getContext('2d');
  let barChart, pieChart, lastAnalyticsShare = '';

  atg.onchange = () => {
    atype.disabled = false;
    hide(asel, asearch, instr, acont, graphs, aacts);
    if (atg.value === 'section') show(asel);
    if (atg.value === 'student') show(asearch);
  };

  atype.onchange = () => {
    hide(adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts);
    show(resetA);
    switch (atype.value) {
      case 'date':     show(adate); break;
      case 'month':    show(amonth); break;
      case 'semester': show(sems, seme); break;
      case 'year':     show(ayear); break;
    }
  };

  resetA.onclick = e => {
    e.preventDefault();
    atype.value = '';
    hide(adate, amonth, sems, seme, ayear, instr, acont, graphs, aacts, resetA);
  };

  loadA.onclick = () => {
    if (!atype.value) { alert('Select a period'); return; }
    let from, to;
    if (atype.value === 'date') {
      from = to = adate.value;
    } else if (atype.value === 'month') {
      const [y,m] = amonth.value.split('-').map(Number);
      from = `${amonth.value}-01`;
      to   = `${amonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (atype.value === 'semester') {
      const [sy,sm] = sems.value.split('-').map(Number);
      const [ey,em] = seme.value.split('-').map(Number);
      from = `${sems.value}-01`;
      to   = `${seme.value}-${new Date(ey,em,0).getDate()}`;
    } else {
      from = `${ayear.value}-01-01`;
      to   = `${ayear.value}-12-31`;
    }

    const cls = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    let pool = students.filter(s => s.cls === cls && s.sec === sec);
    if (atg.value === 'section') pool = pool.filter(s => s.sec === asel.value);
    if (atg.value === 'student') {
      const q = asearch.value.trim().toLowerCase();
      pool = pool.filter(s => s.adm === q || s.name.toLowerCase().includes(q));
    }

    const stats = pool.map(s => ({ adm: s.adm, name: s.name, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    Object.entries(attendanceData).forEach(([d, recs]) => {
      if (d < from || d > to) return;
      stats.forEach(st => {
        const c = recs[st.adm] || 'A';
        st[c]++; st.total++;
      });
    });

    stats.forEach(st => {
      const tf = st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
      const tp = (paymentsData[st.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      st.outstanding = tf - tp;
      const pct = st.total ? (st.P/st.total)*100 : 0;
      st.status = (st.outstanding > 0 || pct < eligibilityPct) ? 'Debarred' : 'Eligible';
    });

    // render table
    const thead = $('analyticsTable').querySelector('thead tr');
    thead.innerHTML = ['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding','Status']
      .map(h => `<th>${h}</th>`).join('');
    const tbody = $('analyticsBody');
    tbody.innerHTML = '';
    stats.forEach((st,i) => {
      const pct = st.total ? ((st.P/st.total)*100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td>
        <td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td>
        <td>${pct}%</td><td>PKR ${st.outstanding}</td><td>${st.status}</td>
      `;
      tbody.appendChild(tr);
    });

    instr.textContent = `Period: ${from} to ${to}`;
    show(instr, acont, graphs, aacts);

    // bar chart
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: stats.map(st => st.name),
        datasets: [{ label: '% Present', data: stats.map(st => st.total ? (st.P/st.total)*100 : 0) }]
      },
      options: { scales: { y: { beginAtZero:true, max:100 } } }
    });

    // pie chart
    const aggFine = stats.reduce((sum, st) => sum + st.outstanding, 0);
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: { labels: ['Outstanding'], datasets: [{ data: [aggFine] }] }
    });

    lastAnalyticsShare = `Analytics (${from} to ${to})\n` +
      stats.map((st,i) => `${i+1}. ${st.adm} ${st.name}: ${((st.P/st.total)*100).toFixed(1)}% / PKR ${st.outstanding}`)
           .join('\n');
  };

  $('shareAnalytics').onclick = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');

  $('downloadAnalytics').onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Analytics Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#analyticsTable' });
    doc.save('analytics_report.pdf');
  };

  // --- 11. ATTENDANCE REGISTER ---
  const loadReg     = $('loadRegister');
  const changeReg   = $('changeRegister');
  const saveReg     = $('saveRegister');
  const dlReg       = $('downloadRegister');
  const shReg       = $('shareRegister');
  const rm          = $('registerMonth');
  const rh          = $('registerHeader');
  const rb          = $('registerBody');
  const rw          = $('registerTableWrapper');
  const regCodes    = ['A','P','Lt','HD','L'];
  const regColors   = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

  loadReg.onclick = () => {
    const m = rm.value;
    if (!m) { alert('Pick month'); return; }
    const [y, mm] = m.split('-').map(Number);
    const days = new Date(y, mm, 0).getDate();

    rh.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
      [...Array(days)].map((_,i)=>`<th>${i+1}</th>`).join('');

    rb.innerHTML = '';
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((s,i) => {
      let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1; d<=days; d++) {
        const key = `${m}-${String(d).padStart(2,'0')}`;
        const c = (attendanceData[key]||{})[s.adm] || 'A';
        const style = c==='A' ? '' : ` style="background:${regColors[c]};color:#fff"`;
        row += `<td class="reg-cell"${style}><span class="status-text">${c}</span></td>`;
      }
      const tr = document.createElement('tr');
      tr.innerHTML = row;
      rb.appendChild(tr);
    });

    rb.querySelectorAll('.reg-cell').forEach(cell => {
      cell.onclick = () => {
        const span = cell.querySelector('.status-text');
        let idx = regCodes.indexOf(span.textContent);
        idx = (idx+1) % regCodes.length;
        const c = regCodes[idx];
        span.textContent = c;
        if (c==='A') { cell.style.background=''; cell.style.color=''; }
        else        { cell.style.background=regColors[c]; cell.style.color='#fff'; }
      };
    });

    show(rw, saveReg);
    hide(loadReg, changeReg, dlReg, shReg);
  };

  saveReg.onclick = async () => {
    const m = rm.value, [y, mm] = m.split('-').map(Number);
    const days = new Date(y, mm, 0).getDate();
    Array.from(rb.children).forEach(tr => {
      const adm = tr.children[1].textContent;
      for (let d=1; d<=days; d++) {
        const code = tr.children[3 + d - 1].querySelector('.status-text').textContent;
        const key = `${m}-${String(d).padStart(2,'0')}`;
        attendanceData[key] = attendanceData[key] || {};
        attendanceData[key][adm] = code;
      }
    });
    await save('attendanceData', attendanceData);
    hide(saveReg);
    show(changeReg, dlReg, shReg);
  };

  changeReg.onclick = () => {
    hide(changeReg, dlReg, shReg);
    show(saveReg);
  };

  dlReg.onclick = () => {
    const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    doc.setFontSize(18);
    doc.text('Attendance Register', 14, 16);
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY:32, html:'#registerTable', tableWidth:'auto', styles:{ fontSize:10 } });
    doc.save('attendance_register.pdf');
  };

  shReg.onclick = () => {
    const header = `Attendance Register\n${$('setupText').textContent}`;
    const rows = Array.from(rb.children).map(tr =>
      Array.from(tr.children).map(td =>
        td.querySelector('.status-text') ? td.querySelector('.status-text').textContent : td.textContent
      ).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows.join('\n'))}`, '_blank');
  };

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
  renderstudents();
});
