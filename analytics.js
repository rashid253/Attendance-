// analytics.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const students = window.students;
  const attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');

  const analyticsTarget      = $('analyticsTarget');
  const admInput             = $('studentAdmInput');
  const analyticsType        = $('analyticsType');
  const analyticsDate        = $('analyticsDate');
  const analyticsMonth       = $('analyticsMonth');
  const semesterStartInput   = $('semesterStart');
  const semesterEndInput     = $('semesterEnd');
  const yearStart            = $('yearStart');
  const loadAnalyticsBtn     = $('loadAnalytics');
  const resetAnalyticsBtn    = $('resetAnalytics');
  const instructionsEl       = $('instructions');
  const analyticsContainer   = $('analyticsContainer');
  const graphsEl             = $('graphs');
  const analyticsActionsEl   = $('analyticsActions');
  const shareAnalyticsBtn    = $('shareAnalytics');
  const downloadAnalyticsBtn = $('downloadAnalytics');
  const barCtx               = $('barChart').getContext('2d');
  const pieCtx               = $('pieChart').getContext('2d');
  let barChart, pieChart;

  analyticsTarget.onchange = ()=> admInput.classList.toggle('hidden',analyticsTarget.value==='class');
  function hideAllAnalytics() {
    [admInput,analyticsDate,analyticsMonth,semesterStartInput,semesterEndInput,yearStart,instructionsEl,analyticsContainer,graphsEl,analyticsActionsEl,resetAnalyticsBtn]
      .forEach(el=>el.classList.add('hidden'));
  }
  analyticsType.onchange = ()=>{
    hideAllAnalytics();
    if(analyticsTarget.value==='student') admInput.classList.remove('hidden');
    if(analyticsType.value==='date') analyticsDate.classList.remove('hidden');
    if(analyticsType.value==='month') analyticsMonth.classList.remove('hidden');
    if(analyticsType.value==='semester'){ semesterStartInput.classList.remove('hidden'); semesterEndInput.classList.remove('hidden'); }
    if(analyticsType.value==='year') yearStart.classList.remove('hidden');
    resetAnalyticsBtn.classList.remove('hidden');
  };
  resetAnalyticsBtn.onclick = ev=>{ev.preventDefault(); analyticsType.value=''; analyticsTarget.value='class'; admInput.value=''; hideAllAnalytics();};

  loadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    let from,to;
    if(analyticsType.value==='date'){ if(!analyticsDate.value)return alert('Pick a date'); from=to=analyticsDate.value; }
    else if(analyticsType.value==='month'){ if(!analyticsMonth.value)return alert('Pick a month'); const [y,m]=analyticsMonth.value.split('-').map(Number); from=`${analyticsMonth.value}-01`; to=`${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;}
    else if(analyticsType.value==='semester'){ if(!semesterStartInput.value||!semesterEndInput.value)return alert('Pick semester range'); from=`${semesterStartInput.value}-01`; to=`${semesterEndInput.value}-${new Date(...semesterEndInput.value.split('-').map(Number),0).getDate()}`;}
    else if(analyticsType.value==='year'){ if(!yearStart.value)return alert('Pick a year'); from=`${yearStart.value}-01-01`; to=`${yearStart.value}-12-31`;}
    else return alert('Select a period');

    const fromDate=new Date(from), toDate=new Date(to);
    let stats = analyticsTarget.value==='class'
      ? students.map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}))
      : (()=>{ const adm=admInput.value.trim(); if(!adm)return alert('Enter Adm#'); const stud=students.find(s=>s.adm===adm); if(!stud)return alert(`No student with Adm#: ${adm}`); return [{name:stud.name,roll:stud.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}]; })();

    Object.entries(attendanceData).forEach(([d,recs])=>{
      const cur=new Date(d);
      if(cur>=fromDate&&cur<=toDate) stats.forEach(st=>{ const code=recs[st.roll]||'A'; st[code]++; st.total++; });
    });

    let html='<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s=>{ const pct=s.total?((s.P/s.total)*100).toFixed(1):'0.0'; html+=`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`; });
    html+='</tbody></table>';
    analyticsContainer.innerHTML=html; analyticsContainer.classList.remove('hidden');
    instructionsEl.textContent=`Report: ${from} to ${to}`; instructionsEl.classList.remove('hidden');

    const labels=stats.map(s=>s.name), dataPct=stats.map(s=>s.total?(s.P/s.total)*100:0);
    if(barChart)barChart.destroy();
    barChart=new Chart(barCtx,{type:'bar',data:{labels,datasets:[{label:'% Present',data:dataPct}]},options:{maintainAspectRatio:true}});
    const agg=stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    if(pieChart)pieChart.destroy();
    pieChart=new Chart(pieCtx,{type:'pie',data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg)}]},options:{maintainAspectRatio:true,aspectRatio:1}});
    graphsEl.classList.remove('hidden'); analyticsActionsEl.classList.remove('hidden');
  };

  shareAnalyticsBtn.onclick = ev=> {
    ev.preventDefault();
    const period = instructionsEl.textContent.replace('Report: ','');
    const hdr = `Period: ${period}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const rows = Array.from(analyticsContainer.querySelectorAll('tbody tr')).map(r=>{
      const td = r.querySelectorAll('td');
      return `${td[0].textContent} P:${td[1].textContent} A:${td[2].textContent} Lt:${td[3].textContent} HD:${td[4].textContent} L:${td[5].textContent} Total:${td[6].textContent} %:${td[7].textContent}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+rows.join('\n'))}`, '_blank');
  };

  downloadAnalyticsBtn.onclick = ev=> {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    doc.setFontSize(14); doc.text(localStorage.getItem('schoolName'),40,30);
    doc.setFontSize(12); doc.text(`Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`,40,45);
    doc.text(instructionsEl.textContent,40,60);
    doc.autoTable({
      head:[['Name','P','A','Lt','HD','L','Total','%']],
      body:Array.from(analyticsContainer.querySelectorAll('tbody tr')).map(r=>Array.from(r.querySelectorAll('td')).map(td=>td.textContent)),
      startY:75, margin:{left:40,right:40}, styles:{fontSize:8}
    });
    const y = doc.lastAutoTable.finalY + 10, w=120, h=80;
    doc.addImage(barChart.toBase64Image(),'PNG',40,y,w,h);
    doc.addImage(pieChart.toBase64Image(),'PNG',40+w+20,y,w,h);
    doc.save('analytics_report.pdf');
  };
});
