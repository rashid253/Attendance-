// app.js
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // Refs
  const analyticsType     = $('analyticsType');
  const analyticsDateIn   = $('analyticsDate');
  const analyticsMonthIn  = $('analyticsMonth');
  const analyticsSemester = $('analyticsSemester');
  const analyticsYearIn   = $('analyticsYear');
  const studentFilter     = $('studentFilter');
  const repType           = $('representationType');
  const loadBtn           = $('loadAnalytics');
  const resetBtn          = $('resetAnalyticsBtn');
  const container         = $('analyticsContainer');
  const actions           = $('analyticsActions');
  const shareBtn          = $('shareAnalytics');
  const downloadBtn       = $('downloadAnalytics');

  const THRESHOLD = 75;

  let schoolName = localStorage.getItem('schoolName') || '';
  let cls        = localStorage.getItem('teacherClass') || '';
  let sec        = localStorage.getItem('teacherSection') || '';
  let students   = JSON.parse(localStorage.getItem('students')) || [];
  let attendance = JSON.parse(localStorage.getItem('attendanceData')) || {};
  let chart;

  // Toggle inputs
  analyticsType.addEventListener('change', e => {
    [analyticsDateIn, analyticsMonthIn, analyticsSemester, analyticsYearIn]
      .forEach(el => el.classList.add('hidden'));
    const v = e.target.value;
    if (v==='date')     analyticsDateIn.classList.remove('hidden');
    if (v==='month')    analyticsMonthIn.classList.remove('hidden');
    if (v==='semester') analyticsSemester.classList.remove('hidden');
    if (v==='year')     analyticsYearIn.classList.remove('hidden');
  });

  loadBtn.addEventListener('click', renderAnalytics);
  resetBtn.addEventListener('click', () => {
    [analyticsType, analyticsDateIn, analyticsMonthIn, analyticsSemester, analyticsYearIn, studentFilter, repType, loadBtn]
      .forEach(el => { el.disabled = false; el.classList.remove('hidden'); });
    resetBtn.classList.add('hidden');
    actions.classList.add('hidden');
    container.innerHTML = '';
  });

  function getBlocks(type) {
    const year = new Date().getFullYear();
    const blocks = [];
    if (type==='date') {
      const d = analyticsDateIn.value;
      blocks.push({ label: d, dates: [d] });
    }
    if (type==='month') {
      const [y,m] = analyticsMonthIn.value.split('-');
      const days = new Date(y,m,0).getDate();
      blocks.push({
        label: `${y}-${m}`,
        dates: Array.from({length:days},(_,i)=>`${y}-${m}-${String(i+1).padStart(2,'0')}`)
      });
    }
    if (type==='semester') {
      const sem = analyticsSemester.value;
      const start = sem==='1'?1:7, end = sem==='1'?6:12;
      for (let mo=start; mo<=end; mo++) {
        const mm = String(mo).padStart(2,'0');
        const days = new Date(year,mo,0).getDate();
        blocks.push({
          label: mm,
          dates: Array.from({length:days},(_,i)=>`${year}-${mm}-${String(i+1).padStart(2,'0')}`)
        });
      }
    }
    if (type==='year') {
      const y = analyticsYearIn.value;
      for (let mo=1; mo<=12; mo++) {
        const mm = String(mo).padStart(2,'0');
        const days = new Date(y,mo,0).getDate();
        blocks.push({
          label: mm,
          dates: Array.from({length:days},(_,i)=>`${y}-${mm}-${String(i+1).padStart(2,'0')}`)
        });
      }
    }
    return blocks;
  }

  function renderAnalytics() {
    const type = analyticsType.value;
    if (!type) return alert('Select a period');
    [analyticsType, analyticsDateIn, analyticsMonthIn, analyticsSemester, analyticsYearIn, studentFilter, repType, loadBtn]
      .forEach(el => el.disabled = true);
    resetBtn.classList.remove('hidden');
    actions.classList.remove('hidden');
    container.innerHTML = '';

    const blocks = getBlocks(type);
    const roster = students.filter(s => s.class===cls && s.section===sec)
                           .filter(s => !studentFilter.value || s.roll==studentFilter.value);

    // For overall summary accumulation
    const overall = roster.map(s => ({ roll: s.roll, name: s.name, cnt:{P:0,A:0,Lt:0,HD:0,L:0} }));

    blocks.forEach((blk, idx) => {
      // Block heading
      const h3 = document.createElement('h3');
      h3.textContent = type==='date'?`Date: ${blk.label}`:(type==='month'?`Month: ${blk.label}`:`Period: ${blk.label}`);
      container.appendChild(h3);

      // Table
      if (repType.value==='table' || repType.value==='all') {
        const tbl = document.createElement('table');
        tbl.border=1; tbl.style.width='100%';
        const hdr = ['Roll','Name', ...blk.dates.map(d=>d.split('-')[2])];
        tbl.innerHTML = `<tr>${hdr.map(h=>`<th>${h}</th>`).join('')}</tr>`;
        roster.forEach((s,i) => {
          const row = [s.roll, s.name, ...blk.dates.map(d=>{
            const st = attendance[d]?.[s.roll]||'';
            if (st) overall[i].cnt[st]++;
            return st;
          })];
          tbl.innerHTML += `<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`;
        });
        container.appendChild(tbl);
      }

      // Summary per block
      if (repType.value==='summary' || repType.value==='all') {
        const div = document.createElement('div');
        div.className='summary-block';
        div.innerHTML = `<h4>Summary (${blk.label})</h4>` +
          roster.map((s,i) => {
            const cnt = blk.dates.reduce((acc,d)=>{
              const st = attendance[d]?.[s.roll];
              if (st) acc[st] = (acc[st]||0)+1;
              return acc;
            },{P:0,A:0,Lt:0,HD:0,L:0});
            const pct = Math.round((cnt.P+cnt.Lt+cnt.HD)/blk.dates.length*100);
            const elig = pct>=THRESHOLD?'Eligible':'Not Eligible';
            return `<p>${s.name}: P:${cnt.P}, Lt:${cnt.Lt}, HD:${cnt.HD}, L:${cnt.L}, A:${cnt.A} — ${pct}%<span class="eligibility">${elig}</span></p>`;
          }).join('');
        container.appendChild(div);
      }

      // Graph per block
      if (repType.value==='graph' || repType.value==='all') {
        const c = document.createElement('canvas');
        container.appendChild(c);
        if (chart) chart.destroy();
        const data = roster.map((s,i)=>{
          const cnt = blk.dates.reduce((a,d)=>{
            const st=attendance[d]?.[s.roll]; if(st)a[st]=(a[st]||0)+1; return a;
          },{P:0,Lt:0,HD:0});
          return Math.round((cnt.P+cnt.Lt+cnt.HD)/blk.dates.length*100);
        });
        chart = new Chart(c.getContext('2d'), {
          type:'bar',
          data:{labels:roster.map(s=>s.name),datasets:[{label:'% Present',data}]},
          options:{responsive:true}
        });
      }
    });

    // Overall summary at end
    const sumDiv = document.createElement('div');
    sumDiv.className='summary-block';
    sumDiv.innerHTML = '<h3>Overall Summary</h3>' +
      overall.map(o=>{
        const totalDates = blocks.reduce((sum,b)=>sum+b.dates.length,0);
        const pct = Math.round((o.cnt.P+o.cnt.Lt+o.cnt.HD)/totalDates*100);
        const elig = pct>=THRESHOLD?'Eligible for Exams':'Not Eligible';
        return `<p>${o.name}: P:${o.cnt.P}, Lt:${o.cnt.Lt}, HD:${o.cnt.HD}, L:${o.cnt.L}, A:${o.cnt.A} — ${pct}%<span class="eligibility">${elig}</span></p>`;
      }).join('');
    container.appendChild(sumDiv);

    // Share handler
    shareBtn.onclick = () => {
      let text = `${schoolName} | ${cls}-${sec}\n`;
      text += blocks.map(b=>`Period: ${b.label}`).join('\n') + '\n\n';
      text += sumDiv.innerText;
      if (navigator.share) navigator.share({ title:'Attendance Summary', text });
      else alert('Share not supported');
    };

    // Download handler
    downloadBtn.onclick = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p','pt','a4');
      let y = 20;
      doc.text(`${schoolName} | ${cls}-${sec}`, 20, y); y += 20;
      blocks.forEach(b=>{
        doc.text(`Period: ${b.label}`, 20, y); y += 20;
        // include first table only if visible
        if (repType.value==='table' || repType.value==='all') {
          const tbl = container.querySelector('table');
          doc.autoTable({ html: tbl, startY: y });
          y = doc.lastAutoTable.finalY + 10;
        }
      });
      // Overall summary
      doc.text('Overall Summary', 20, y); y += 20;
      overall.forEach(o=>{
        const totalDates = blocks.reduce((sum,b)=>sum+b.dates.length,0);
        const pct = Math.round((o.cnt.P+o.cnt.Lt+o.cnt.HD)/totalDates*100);
        doc.text(`${o.name}: ${pct}%`, 20, y); y += 15;
      });
      doc.save(`Analytics_${analyticsType.value}.pdf`);
    };
  }
});
