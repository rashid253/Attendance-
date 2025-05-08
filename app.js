// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- Universal PDF share helper ---
  async function sharePdf(blob, fileName, title) {
    if (
      navigator.canShare &&
      navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })
    ) {
      try {
        await navigator.share({ title, files: [new File([blob], fileName, { type: 'application/pdf' })] });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share failed', err);
      }
    }
  }

  // --- Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) { console.error('idb-keyval not found'); return; }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // --- State & Defaults ---
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

  // --- DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // [ ... registration, setup, counters, attendance code unchanged ... ]

  // --- 7. ANALYTICS SETUP ---
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
  let barChart, pieChart;

  $('analyticsFilterBtn').onclick   = () => show($('analyticsFilterModal'));
  $('analyticsFilterClose').onclick = () => hide($('analyticsFilterModal'));

  atg.onchange = () => {
    atype.disabled = false;
    [asel, asearch].forEach(x => x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
    if (atg.value === 'section') asel.classList.remove('hidden');
    if (atg.value === 'student') asearch.classList.remove('hidden');
  };
  atype.onchange = () => {
    [adate, amonth, sems, seme, ayear].forEach(x => x.classList.add('hidden'));
    [instr, acont, graphs, aacts].forEach(x => x.classList.add('hidden'));
    resetA.classList.remove('hidden');
    if      (atype.value==='date')    adate.classList.remove('hidden');
    else if (atype.value==='month')   amonth.classList.remove('hidden');
    else if (atype.value==='semester'){ sems.classList.remove('hidden'); seme.classList.remove('hidden'); }
    else if (atype.value==='year')    ayear.classList.remove('hidden');
  };

  loadA.onclick = () => {
    if (atype.value==='student' && !asearch.value.trim()) {
      alert('Enter admission number or name'); return;
    }
    // determine from/to...
    let from, to;
    if      (atype.value==='date')     from = to = adate.value;
    else if (atype.value==='month')    {
      const [y,m] = amonth.value.split('-').map(Number);
      from = `${amonth.value}-01`;
      to   = `${amonth.value}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
    }
    else if (atype.value==='semester'){
      const [sy,sm] = sems.value.split('-').map(Number);
      const [ey,em] = seme.value.split('-').map(Number);
      from = `${sems.value}-01`;
      to   = `${seme.value}-${String(new Date(ey,em,0).getDate()).padStart(2,'0')}`;
    }
    else if (atype.value==='year')     {
      from = `${ayear.value}-01-01`;
      to   = `${ayear.value}-12-31`;
    } else { alert('Select period'); return; }

    // build pool
    const cls = $('teacherClassSelect').value;
    let pool = students.filter(s => s.cls===cls);
    if (atg.value==='section') pool = pool.filter(s=>s.sec===asel.value);
    if (atg.value==='student') {
      const q=asearch.value.trim().toLowerCase();
      pool = pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));
    }

    // compute stats
    const stats = pool.map(s=>({ adm:s.adm, name:s.name, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    Object.entries(attendanceData).forEach(([d,rec])=>{
      if (d<from||d>to) return;
      stats.forEach(st=>{ if (rec[st.adm]) { st[rec[st.adm]]++; st.total++; } });
    });
    stats.forEach(st=>{
      const totalFine = st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
      const paid = (paymentsData[st.adm]||[]).reduce((a,p)=>a+p.amount,0);
      st.outstanding = totalFine - paid;
      const pct = st.total ? (st.P/st.total)*100 : 0;
      st.status = (st.outstanding>0||pct<eligibilityPct) ? 'Debarred' : 'Eligible';
    });

    lastAnalyticsStats = stats;
    lastAnalyticsRange = { from, to };
    renderAnalytics(stats, from, to);
  };

  $('applyAnalyticsFilter').onclick = () => {
    analyticsFilterOptions = Array.from(
      document.querySelectorAll('#analyticsFilterForm input[type="checkbox"]:checked')
    ).map(cb=>cb.value);
    if (!analyticsFilterOptions.length) analyticsFilterOptions=['all'];
    analyticsDownloadMode = document.querySelector(
      '#analyticsFilterForm input[name="downloadMode"]:checked'
    ).value;
    hide($('analyticsFilterModal'));
    if (!lastAnalyticsStats.length) {
      alert('Please Load a report first.');
    } else {
      renderAnalytics(lastAnalyticsStats, lastAnalyticsRange.from, lastAnalyticsRange.to);
    }
  };

  // --- renderAnalytics with filter logic ---
  function renderAnalytics(stats, from, to) {
    const filters = analyticsFilterOptions;
    const filtered = filters.includes('all')
      ? stats
      : stats.filter(st =>
          filters.some(opt=>{
            switch(opt) {
              case 'registered': return true;
              case 'attendance': return st.total>0;
              case 'fine':       return st.A>0||st.Lt>0||st.L>0||st.HD>0;
              case 'cleared':    return st.outstanding===0;
              case 'debarred':   return st.status==='Debarred';
              case 'eligible':   return st.status==='Eligible';
            }
          })
        );
    // populate table & charts (unchanged)...
    // set lastAnalyticsShare as before...
  }

  // --- 8. DOWNLOAD & SHARE ANALYTICS ---
  $('downloadAnalytics').onclick = async () => {
    if (!lastAnalyticsStats.length) { alert('Load a report first'); return; }
    // filter stats same as renderAnalytics
    const filters = analyticsFilterOptions;
    const filtered = filters.includes('all')
      ? lastAnalyticsStats
      : lastAnalyticsStats.filter(st =>
          filters.some(opt=>{
            switch(opt) {
              case 'registered': return true;
              case 'attendance': return st.total>0;
              case 'fine':       return st.A>0||st.Lt>0||st.L>0||st.HD>0;
              case 'cleared':    return st.outstanding===0;
              case 'debarred':   return st.status==='Debarred';
              case 'eligible':   return st.status==='Eligible';
            }
          })
        );

    if (analyticsDownloadMode === 'individual') {
      // generate one PDF per student
      for (const st of filtered) {
        const doc = new jspdf.jsPDF();
        const today = new Date().toISOString().split('T')[0];
        doc.setFontSize(18);
        doc.text(`Report: ${st.name}`, 14, 16);
        doc.setFontSize(10);
        doc.text(`Adm#: ${st.adm}`, 14, 24);
        doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`, 14, 32);
        doc.setFontSize(12);
        // build a mini-table
        const headers = ['P','A','Lt','HD','L','Total','%','Outstanding','Status'];
        const row = [
          st.P, st.A, st.Lt, st.HD, st.L, st.total,
          st.total ? ((st.P/st.total)*100).toFixed(1)+'%' : '0.0%',
          'PKR '+st.outstanding, st.status
        ];
        doc.autoTable({
          startY: 40,
          head: [headers],
          body: [row]
        });
        const filename = `analytics_${st.adm}_${st.name.replace(/\s+/g,'_')}.pdf`;
        doc.save(filename);
        await sharePdf(doc.output('blob'), filename, `Report: ${st.name}`);
      }
    } else {
      // combined single PDF
      const doc = new jspdf.jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const { from, to } = lastAnalyticsRange;
      doc.setFontSize(18);
      doc.text('Attendance Analytics', 14, 16);
      doc.setFontSize(10);
      doc.text(`Period: ${from} to ${to}`, pageWidth - 14, 16, { align: 'right' });
      doc.setFontSize(12);
      doc.text($('setupText').textContent, 14, 24);
      doc.autoTable({ startY: 30, html: '#analyticsTable' });
      const blob = doc.output('blob');
      doc.save('analytics.pdf');
      await sharePdf(blob, 'analytics.pdf', 'Attendance Analytics');
    }
  };

  $('shareAnalytics').onclick = () => {
    if (!lastAnalyticsShare) { alert('Load a report first'); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');
  };

  // --- 8. ATTENDANCE REGISTER ---
  (function(){
    const loadBtn       = $('loadRegister'),
          saveBtn       = $('saveRegister'),
          changeBtn     = $('changeRegister'),
          downloadBtn   = $('downloadRegister'),
          shareBtn      = $('shareRegister'),
          headerRow     = $('registerHeader'),
          bodyTbody     = $('registerBody'),
          tableWrapper  = $('registerTableWrapper');

    function bindRegisterActions(){
      // Download full register as PDF
      downloadBtn.onclick = async () => {
        const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const today = new Date().toISOString().split('T')[0];
        doc.setFontSize(18); 
        doc.text('Attendance Register', 14, 20);
        doc.setFontSize(10); 
        doc.text(`Date: ${today}`, pageWidth - 14, 20, { align: 'right' });
        doc.setFontSize(12); 
        doc.text($('setupText').textContent, 14, 36);
        doc.autoTable({
          startY: 60,
          html: '#registerTable',
          tableWidth: 'auto',
          styles: { fontSize: 10 }
        });
        const blob = doc.output('blob');
        doc.save('attendance_register.pdf');
        await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
      };

      // Share register via WhatsApp
      shareBtn.onclick = () => {
        const header = `Attendance Register\n${$('setupText').textContent}`;
        const rows = Array.from(bodyTbody.children).map(tr =>
          Array.from(tr.children).map(td => td.textContent.trim()).join(' ')
        );
        window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows.join('\n'))}`, '_blank');
      };
    }

    // Load monthly register into table
    loadBtn.onclick = () => {
      const month = $('registerMonth').value;
      if (!month) { alert('Pick month'); return; }
      const keys = Object.keys(attendanceData)
        .filter(d => d.startsWith(month + '-'))
        .sort();
      if (!keys.length) { alert('No attendance marked this month.'); return; }

      // Build header row
      headerRow.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
        keys.map(k => `<th>${k.split('-')[2]}</th>`).join('');

      // Build body rows
      bodyTbody.innerHTML = '';
      const cl = $('teacherClassSelect').value;
      const sec = $('teacherSectionSelect').value;
      students
        .filter(s => s.cls === cl && s.sec === sec)
        .forEach((s, i) => {
          let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
          keys.forEach(key => {
            const code = attendanceData[key][s.adm] || '';
            const color = code === 'P' ? 'var(--success)'
                        : code === 'Lt'? 'var(--warning)'
                        : code === 'HD'? '#FF9800'
                        : code === 'L'? 'var(--info)'
                        : 'var(--danger)';
            const style = code ? `style="background:${color};color:#fff"` : '';
            row += `<td class="reg-cell" ${style}>
                      <span class="status-text">${code}</span>
                    </td>`;
          });
          const tr = document.createElement('tr');
          tr.innerHTML = row;
          bodyTbody.appendChild(tr);
        });

      // Make cells clickable to cycle status
      document.querySelectorAll('.reg-cell').forEach(cell => {
        cell.onclick = () => {
          const span = cell.querySelector('.status-text');
          const codes = ['', 'P', 'Lt', 'HD', 'L', 'A'];
          const idx = (codes.indexOf(span.textContent) + 1) % codes.length;
          const c = codes[idx];
          span.textContent = c;
          if (!c) {
            cell.style.background = '';
            cell.style.color = '';
          } else {
            const col = c==='P'? 'var(--success)'
                      : c==='Lt'? 'var(--warning)'
                      : c==='HD'? '#FF9800'
                      : c==='L'? 'var(--info)'
                      : 'var(--danger)';
            cell.style.background = col;
            cell.style.color = '#fff';
          }
        };
      });

      show(tableWrapper, saveBtn);
      hide(loadBtn, changeBtn, downloadBtn, shareBtn);
    };

    // Save modified register back to storage
    saveBtn.onclick = async () => {
      const month = $('registerMonth').value;
      const keys = Object.keys(attendanceData)
        .filter(d => d.startsWith(month + '-'))
        .sort();
      Array.from(bodyTbody.children).forEach(tr => {
        const adm = tr.children[1].textContent;
        keys.forEach((key, idx) => {
          const code = tr.children[3 + idx].querySelector('.status-text').textContent;
          if (code) {
            attendanceData[key] = attendanceData[key] || {};
            attendanceData[key][adm] = code;
          } else {
            if (attendanceData[key]) delete attendanceData[key][adm];
          }
        });
      });
      await save('attendanceData', attendanceData);
      hide(saveBtn);
      show(changeBtn, downloadBtn, shareBtn);
      bindRegisterActions();
    };

    // Reset register view
    changeBtn.onclick = () => {
      hide(tableWrapper, changeBtn, downloadBtn, shareBtn, saveBtn);
      headerRow.innerHTML = '';
      bodyTbody.innerHTML = '';
      show(loadBtn);
    };

    bindRegisterActions();
  })();

  // --- 9. Service Worker Registration ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('service-worker.js')
      .catch(console.error);
  }
});
