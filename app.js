// app.js
// Full analytics overhaul: date, month, semester, year breakdowns + eligibility + share/download exactly as shown

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  const analyticsType     = $('analyticsType');
  const analyticsDateIn   = $('analyticsDate');
  const analyticsMonthIn  = $('analyticsMonth');
  const analyticsSemester = $('analyticsSemester');
  const analyticsYearIn   = $('analyticsYear');
  const studentFilter     = $('studentFilter');
  const repType           = $('representationType');
  const loadAnalyticsBtn  = $('loadAnalytics');
  const resetBtn          = $('resetAnalyticsBtn');
  const container         = $('analyticsContainer');

  const ELIGIBILITY_THRESHOLD = 75; // percent

  let schoolName = localStorage.getItem('schoolName') || '';
  let cls        = localStorage.getItem('teacherClass') || '';
  let sec        = localStorage.getItem('teacherSection') || '';
  let students   = JSON.parse(localStorage.getItem('students')) || [];
  let attendance = JSON.parse(localStorage.getItem('attendanceData')) || {};
  let chart = null;

  // dynamic input toggles
  analyticsType.addEventListener('change', e => {
    [analyticsDateIn, analyticsMonthIn, analyticsSemester, analyticsYearIn]
      .forEach(el => el.classList.add('hidden'));
    const v = e.target.value;
    if (v === 'date')     analyticsDateIn.classList.remove('hidden');
    if (v === 'month')    analyticsMonthIn.classList.remove('hidden');
    if (v === 'semester') analyticsSemester.classList.remove('hidden');
    if (v === 'year')     analyticsYearIn.classList.remove('hidden');
  });

  loadAnalyticsBtn.addEventListener('click', render);
  resetBtn.addEventListener('click', () => {
    [analyticsType, analyticsDateIn, analyticsMonthIn, analyticsSemester, analyticsYearIn, studentFilter, repType, loadAnalyticsBtn]
      .forEach(el => { el.disabled = false; el.classList.remove('hidden'); });
    resetBtn.classList.add('hidden');
    container.innerHTML = '';
  });

  function getDateBlocks(type) {
    const blocks = []; // array of { label, dates[] }
    const year = new Date().getFullYear();

    if (type === 'date') {
      blocks.push({ label: analyticsDateIn.value, dates: [analyticsDateIn.value] });
    }
    else if (type === 'month') {
      const [y,m] = analyticsMonthIn.value.split('-');
      const days = new Date(y,m,0).getDate();
      const dates = Array.from({length:days}, (_,i)=>
        `${y}-${m}-${String(i+1).padStart(2,'0')}`);
      blocks.push({ label: `${y}-${m}`, dates });
    }
    else if (type === 'semester') {
      const sem = analyticsSemester.value;
      const start = sem==='1'?1:7, end = sem==='1'?6:12;
      for (let mo=start; mo<=end; mo++) {
        const mm = String(mo).padStart(2,'0');
        const days = new Date(year,mo,0).getDate();
        const dates = Array.from({length:days}, (_,i)=>
          `${year}-${mm}-${String(i+1).padStart(2,'0')}`);
        blocks.push({ label: mm, dates });
      }
    }
    else if (type === 'year') {
      const y = analyticsYearIn.value;
      for (let mo=1; mo<=12; mo++) {
        const mm = String(mo).padStart(2,'0');
        const days = new Date(y,mo,0).getDate();
        const dates = Array.from({length:days}, (_,i)=>
          `${y}-${mm}-${String(i+1).padStart(2,'0')}`);
        blocks.push({ label: mm, dates });
      }
    }

    return blocks;
  }

  function render() {
    const type = analyticsType.value;
    if (!type) return alert('Select a period');
    [analyticsType, analyticsDateIn, analyticsMonthIn, analyticsSemester, analyticsYearIn, studentFilter, repType, loadAnalyticsBtn]
      .forEach(el => el.disabled = true);
    resetBtn.classList.remove('hidden');
    container.innerHTML = '';

    const blocks = getDateBlocks(type);
    if (!blocks.length) return alert('Invalid period');

    const selRoll = studentFilter.value;
    const roster = students.filter(s => s.class===cls && s.section===sec)
                           .filter(s => !selRoll || s.roll==selRoll);

    // for each block (single date / each month)
    blocks.forEach(({label, dates}) => {
      const title = document.createElement('h3');
      title.textContent = type==='date'? `Date: ${label}` : (type==='month'? `Month: ${label}` : `Period: ${label}`);
      container.appendChild(title);

      // register table if needed
      if (repType.value==='table' || repType.value==='all') {
        const tbl = document.createElement('table');
        tbl.border=1; tbl.style.width='100%';
        const head = ['Roll','Name', ...dates.map(d=>d.split('-')[2])];
        tbl.innerHTML = `<tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr>`;
        roster.forEach(s=>{
          const row = [s.roll, s.name, ...dates.map(d=>attendance[d]?.[s.roll]||'')];
          tbl.innerHTML += `<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`;
        });
        container.appendChild(tbl);
      }

      // summary per block
      if (repType.value==='summary' || repType.value==='all') {
        const div = document.createElement('div');
        div.innerHTML = `<h4>Summary (${label})</h4>`+
          roster.map(s => {
            const cnt={P:0,A:0,Lt:0,HD:0,L:0};
            dates.forEach(d=>{ const st=attendance[d]?.[s.roll]; if(st)cnt[st]++; });
            const pct = Math.round((cnt.P+cnt.Lt+cnt.HD)/dates.length*100);
            const eligible = pct>=ELIGIBILITY_THRESHOLD?'Eligible':'Not Eligible';
            return `<p>${s.name}: P:${cnt.P}, Lt:${cnt.Lt}, HD:${cnt.HD}, L:${cnt.L}, A:${cnt.A} — ${pct}%`
                 + `<span class="eligibility">${eligible}</span></p>`;
          }).join('');
        container.appendChild(div);
      }

      // graph per block
      if (repType.value==='graph' || repType.value==='all') {
        const c = document.createElement('canvas');
        container.appendChild(c);
        if (chart) chart.destroy();
        const data = roster.map(s=>{
          const cnt={P:0,A:0,Lt:0,HD:0,L:0};
          dates.forEach(d=>{ const st=attendance[d]?.[s.roll]; if(st)cnt[st]++; });
          return Math.round((cnt.P+cnt.Lt+cnt.HD)/dates.length*100);
        });
        chart = new Chart(c.getContext('2d'), {
          type:'bar',
          data:{ labels:roster.map(s=>s.name), datasets:[{label:'% Present',data}] },
          options:{responsive:true}
        });
      }

      // share & download buttons for each block
      ['Share','Download'].forEach(mode=>{
        const btn = document.createElement('button');
        btn.className='small';
        btn.textContent = mode;
        btn.onclick = ()=> {
          // capture only this block's innerHTML/text/chart
          if (mode==='Share') {
            const text = `${schoolName} | ${cls}-${sec} | ${label}\n\n`+container.innerText;
            navigator.share
              ? navigator.share({title:`${mode}: ${label}`,text})
              : alert('Share not supported');
          } else {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p','pt','a4');
            doc.text(`${schoolName} | ${cls}-${sec} | ${label}`,20,20);
            doc.autoTable({ html: tbl, startY:40 });
            doc.save(`Analytics_${label}.pdf`);
          }
        };
        container.appendChild(btn);
      });

      container.appendChild(document.createElement('hr'));
    });
  }

});
