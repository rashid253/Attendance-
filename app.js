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

  const THRESHOLD = 75; // exam eligibility % cut-off

  let schoolName = localStorage.getItem('schoolName') || '';
  let cls        = localStorage.getItem('teacherClass') || '';
  let sec        = localStorage.getItem('teacherSection') || '';
  let students   = JSON.parse(localStorage.getItem('students')) || [];
  let attendance = JSON.parse(localStorage.getItem('attendanceData')) || {};
  let chart;

  // Setup save
  $('#saveSetup').addEventListener('click', () => {
    schoolName = $('#schoolNameInput').value;
    cls = $('#teacherClassSelect').value;
    sec = $('#teacherSectionSelect').value;
    localStorage.setItem('schoolName', schoolName);
    localStorage.setItem('teacherClass', cls);
    localStorage.setItem('teacherSection', sec);
    $('#dispSchool').textContent = schoolName;
    $('#dispClass').textContent = cls;
    $('#dispSection').textContent = sec;
    $('#setupForm').classList.add('hidden');
    $('#setupDisplay').classList.remove('hidden');
  });

  // Add student
  $('#addStudent').addEventListener('click', () => {
    const name = $('#studentName').value;
    if (!name) return alert('Enter name');
    const newStudent = { name, roll: Date.now(), class: cls, section: sec };
    students.push(newStudent);
    localStorage.setItem('students', JSON.stringify(students));
    const li = document.createElement('li');
    li.textContent = `${name} (${newStudent.roll})`;
    $('#students').append(li);
  });

  // Toggle analytics inputs
  analyticsType.addEventListener('change', () => {
    [analyticsDateIn, analyticsMonthIn, analyticsSemester, analyticsYearIn]
      .forEach(el => el.classList.add('hidden'));
    const v = analyticsType.value;
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
    const yearNow = new Date().getFullYear();
    const blocks = [];
    if (type==='date') {
      const d = analyticsDateIn.value;
      if (d) blocks.push({ label: `Date: ${d}`, dates: [d] });
    }
    if (type==='month') {
      const [y,m] = analyticsMonthIn.value.split('-');
      const days = new Date(y,m,0).getDate();
      blocks.push({
        label: `Month: ${y}-${m}`,
        dates: Array.from({length:days},(_,i)=>`${y}-${m}-${String(i+1).padStart(2,'0')}`)
      });
    }
    if (type==='semester') {
      const sem = analyticsSemester.value;
      const start = sem==='1'?7:1, end = sem==='1'?12:6;
      for (let mo=start; mo<=end; mo++) {
        const mm = String(mo).padStart(2,'0');
        const days = new Date(yearNow,mo,0).getDate();
        blocks.push({ label: `Sem ${sem} Month ${mm}`, dates:
          Array.from({length:days},(_,i)=>`${yearNow}-${mm}-${String(i+1).padStart(2,'0')}`)
        });
      }
    }
    if (type==='year') {
      const y = analyticsYearIn.value;
      for (let mo=7; mo<=18; mo++) {
        const date = new Date(y, mo%12, 1);
        const mm = String((date.getMonth()+1)).padStart(2,'0');
        const days = new Date(date.getFullYear(), date.getMonth()+1,0).getDate();
        blocks.push({ label: `Year ${y}-${parseInt(y)+1} Month ${mm}`, dates:
          Array.from({length:days},(_,i)=>`${date.getFullYear()}-${mm}-${String(i+1).padStart(2,'0')}`)
        });
      }
    }
    return blocks;
  }

  function renderAnalytics() {
    const type = analyticsType.value;
    if (!type) return alert('Please select a period');
    [analyticsType, analyticsDateIn, analyticsMonthIn, analyticsSemester, analyticsYearIn, studentFilter, repType, loadBtn]
      .forEach(el => el.disabled = true);
    resetBtn.classList.remove('hidden');
    actions.classList.remove('hidden');
    container.innerHTML = '';

    const blocks = getBlocks(type);
    if (!blocks.length) return alert('Invalid period');
    const roster = students.filter(s => s.class===cls && s.section===sec)
                           .filter(s => !studentFilter.value || s.roll==studentFilter.value);
    const overall = roster.map(s => ({ name:s.name, cnt:{P:0,A:0,Lt:0,HD:0,L:0} }));

    // Instructions & formula
    const info = document.createElement('div');
    info.innerHTML = `<p>Formula: Attendance % = (P + Lt + HD) / TotalDays * 100</p>
                      <p>Eligibility Threshold: ${THRESHOLD}%</p>`;
    container.appendChild(info);

    // Per-block render
    blocks.forEach((blk,bi) => {
      const h3 = document.createElement('h3'); h3.textContent = blk.label; container.appendChild(h3);

      // Table
      if (repType.value==='table'||repType.value==='all') {
        const tbl = document.createElement('table'); tbl.border=1; tbl.style.width='100%';
        const hdr=['Roll','Name',...blk.dates.map(d=>d.split('-')[2])];
        tbl.innerHTML=`<tr>${hdr.map(h=>`<th>${h}</th>`).join('')}</tr>`;
        roster.forEach((s,i)=>{
          const row=[s.roll,s.name,...blk.dates.map(d=>{
            const st=attendance[d]?.[s.roll]||'';
            if(st) overall[i].cnt[st]++;
            return st;
          })];
          tbl.innerHTML+=`<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`;
        });
        container.appendChild(tbl);
      }

      // Summary
      if(repType.value==='summary'||repType.value==='all'){
        const sum=document.createElement('div');sum.className='summary-block';
        sum.innerHTML=`<h4>Summary for ${blk.label}</h4>`+
          roster.map((s,i)=>{
            const cnt=blk.dates.reduce((a,d)=>{
              const st=attendance[d]?.[s.roll];
              if(st) a[st]=(a[st]||0)+1;
              return a;
            },{P:0,A:0,Lt:0,HD:0,L:0});
            const pct=Math.round((cnt.P+cnt.Lt+cnt.HD)/blk.dates.length*100);
            return `<p>${s.name}: P:${cnt.P}, Lt:${cnt.Lt}, HD:${cnt.HD}, L:${cnt.L}, A:${cnt.A} — ${pct}% <span class="eligibility">${pct>=THRESHOLD?'Eligible':'Not Eligible'}</span></p>`;
          }).join('');
        container.appendChild(sum);
      }

      // Graph
      if(repType.value==='graph'||repType.value==='all'){
        const c=document.createElement('canvas');container.appendChild(c);
        if(chart)chart.destroy();
        const data=roster.map((s,i)=>{
          const cnt=blk.dates.reduce((a,d)=>{
            const st=attendance[d]?.[s.roll];if(st)a[st]=(a[st]||0)+1;return a;
          },{P:0,Lt:0,HD:0});
          return Math.round((cnt.P+cnt.Lt+cnt.HD)/blk.dates.length*100);
        });
        chart=new Chart(c.getContext('2d'),{type:'line',data:{labels:roster.map(s=>s.name),datasets:[{label:'% Present',data}]},options:{responsive:true}});
      }
    });

    // Overall table
    const ovTbl=document.createElement('table');ovTbl.border=1;ovTbl.style.width='100%';
    ovTbl.innerHTML='<tr><th>Name</th><th>P</th><th>Lt</th><th>HD</th><th>L</th><th>A</th><th>%</th><th>Eligibility</th></tr>'+
      overall.map(o=>{
        const totalDays=blocks.reduce((sum,b)=>sum+b.dates.length,0);
        const pct=Math.round((o.cnt.P+o.cnt.Lt+o.cnt.HD)/totalDays*100);
        return `<tr><td>${o.name}</td><td>${o.cnt.P}</td><td>${o.cnt.Lt}</td><td>${o.cnt.HD}</td><td>${o.cnt.L}</td><td>${o.cnt.A}</td><td>${pct}%</td><td>${pct>=THRESHOLD?'Eligible':'Not Eligible'}</td></tr>`;
      }).join('');
    container.appendChild(ovTbl);

    // Overall graph
    const oc=document.createElement('canvas');container.appendChild(oc);
    if(chart)chart.destroy();
    const odata=overall.map(o=>Math.round((o.cnt.P+o.cnt.Lt+o.cnt.HD)/blocks.reduce((s,b)=>s+b.dates.length,0)*100));
    new Chart(oc.getContext('2d'),{type:'bar',data:{labels:overall.map(o=>o.name),datasets:[{label:'Overall %',data:odata}]},options:{responsive:true}});

    // Share
    shareBtn.onclick=()=>{
      let text=`${schoolName} | ${cls}-${sec}\n`+blocks.map(b=>b.label).join(' | ')+'\n\n';
      text+=ovTbl.innerText;
      if(navigator.share)navigator.share({title:'Attendance Summary',text});else alert('Share not supported');
    };

    // Download
    downloadBtn.onclick=()=>{
      const { jsPDF }=window.jspdf;const doc=new jsPDF('p','pt','a4');let y=20;
      doc.text(`${schoolName} | Class: ${cls} | Sec: ${sec}`,20,y);y+=20;
      blocks.forEach(b=>{doc.text(b.label,20,y);y+=15;if(repType.value==='table'||repType.value==='all'){const tbl=container.querySelector('table');doc.autoTable({html:tbl,startY:y,margin:{left:20,right:20}});y=doc.lastAutoTable.finalY+10;}});
      doc.text('Overall Summary',20,y);y+=15;
      overall.forEach(o=>{const pct=Math.round((o.cnt.P+o.cnt.Lt+o.cnt.HD)/blocks.reduce((s,b)=>s+b.dates.length,0)*100);doc.text(`${o.name}: ${pct}%`,20,y);y+=12;});
      doc.save(`Attendance_Report_${type}.pdf`);
    };
  }
});
