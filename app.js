// app.js
window.addEventListener('DOMContentLoaded', ()=>{
  const $ = id => document.getElementById(id);
  const THRESHOLD = 75;
  const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'var(--orange)', L:'var(--info)' };

  // --- Setup ---
  const schoolIn = $('schoolNameInput'), classSel = $('teacherClassSelect'), secSel = $('teacherSectionSelect');
  const saveSet = $('saveSetup'), formSet = $('setupForm'), dispSet = $('setupDisplay'), txtSet = $('setupText'), editSet = $('editSetup');
  saveSet.onclick = ()=>{
    if(!schoolIn.value||!classSel.value||!secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };
  editSet.onclick = ()=>{ formSet.classList.remove('hidden'); dispSet.classList.add('hidden'); };
  function loadSetup(){
    const s = localStorage.getItem('schoolName'), c = localStorage.getItem('teacherClass'), e = localStorage.getItem('teacherSection');
    if(s&&c&&e){
      schoolIn.value = s; classSel.value = c; secSel.value = e;
      txtSet.textContent = `${s} 🏫 | Class: ${c} | Section: ${e}`;
      formSet.classList.add('hidden'); dispSet.classList.remove('hidden');
    }
  }
  loadSetup();

  // --- Student Registration ---
  let students = JSON.parse(localStorage.getItem('students')||'[]');
  const inputs = ['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress'].map($);
  const addBtn = $('addStudent'), tblBody = $('studentsBody');
  const wrapper = $('studentTableWrapper');
  function saveStudents(){ localStorage.setItem('students', JSON.stringify(students)); }
  function renderStudents(){
    tblBody.innerHTML = '';
    students.forEach((s,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td>`+
        `<td>${s.occupation}</td><td>${s.address}</td>`+
        `<td class="actions">`+
          `<button class="edit">Edit</button>`+
          `<button class="delete">Delete</button>`+
          `<button class="share">Share</button>`+
        `</td>`;
      tr.querySelector('.edit').onclick = ()=>{
        // restore shape
        wrapper.classList.remove('saved');
        inputs.forEach(i=>i.disabled=false);
        ['name','adm','parent','contact','occupation','address'].forEach((key,idx)=>{
          s[key] = prompt(key, s[key])||s[key];
        });
        saveStudents(); renderStudents();
      };
      tr.querySelector('.delete').onclick = ()=>{
        if(confirm('Delete?')){ students.splice(i,1); saveStudents(); renderStudents(); }
      };
      tr.querySelector('.share').onclick = ()=>{
        window.open(`https://wa.me/?text=${encodeURIComponent(`Student: ${s.name}\nAdm#: ${s.adm}`)}`,'_blank');
      };
      tblBody.appendChild(tr);
    });
  }
  addBtn.onclick = ()=>{
    const vals = inputs.map(i=>i.value.trim());
    if(!vals[0]||!vals[1]) return alert('Name & Adm# required');
    const [name,adm,parent,contact,occupation,address] = vals;
    students.push({ name, adm, parent, contact, occupation, address, roll: Date.now() });
    saveStudents(); renderStudents();
    inputs.forEach(i=>i.value='');
  };
  $('shareAll').onclick = ()=>{
    window.open(`https://wa.me/?text=${encodeURIComponent(students.map(s=>`${s.name} (${s.adm})`).join('\n'))}`,'_blank');
  };
  $('saveAll').onclick = ()=>{
    // toggle saved state
    wrapper.classList.add('saved');
    inputs.forEach(i=>i.disabled=true);
  };
  renderStudents();

  // --- Attendance ---
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');
  const dateIn = $('dateInput'), loadAtt = $('loadAttendance'), attList = $('attendanceList'), saveAtt = $('saveAttendance');
  const resSec = $('attendance-result'), summaryBody = $('summaryBody'), resetAtt = $('resetAttendance');

  loadAtt.onclick = ()=>{
    if(!dateIn.value) return alert('Pick date');
    attList.innerHTML = '';
    students.forEach((s,i)=>{
      const row = document.createElement('div'); row.className='attendance-item';
      row.innerHTML = `<span>${s.name}</span><div class="attendance-actions">`+
        ['P','A','Lt','HD','L'].map(c=>`<button class="att-btn" data-code="${c}">${c}</button>`).join('')+
        `</div>`;
      const saved = attendanceData[dateIn.value]?.[s.roll];
      if(saved){
        const b = row.querySelector(`[data-code="${saved}"]`);
        b.style.background = colors[saved]; b.style.color='#fff';
      }
      row.querySelectorAll('.att-btn').forEach(btn=>btn.onclick = ()=>{
        row.querySelectorAll('.att-btn').forEach(b=>{ b.style.background='transparent'; b.style.color=''; });
        const c = btn.dataset.code;
        btn.style.background = colors[c]; btn.style.color = '#fff';
      });
      attList.appendChild(row);
    });
    saveAtt.classList.remove('hidden');
  };
  saveAtt.onclick = ()=>{
    const d = dateIn.value; attendanceData[d] = {};
    attList.querySelectorAll('.attendance-item').forEach((r,i)=>{
      const b = r.querySelector('.att-btn[style*=background]');
      attendanceData[d][students[i].roll] = b? b.dataset.code : 'Not marked';
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    $('attendance-section').classList.add('hidden'); resSec.classList.remove('hidden');
    summaryBody.innerHTML = '';
    students.forEach(s=>{
      const st = attendanceData[d][s.roll];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${st}</td><td><button class="share">Share</button></td>`;
      tr.querySelector('.share').onclick = ()=>{
        window.open(`https://wa.me/?text=${encodeURIComponent(`Attendance for ${s.name} on ${d}: ${st}`)}`,'_blank');
      };
      summaryBody.appendChild(tr);
    });
  };
  resetAtt.onclick = ()=>{
    resSec.classList.add('hidden'); $('attendance-section').classList.remove('hidden'); attList.innerHTML=''; saveAtt.classList.add('hidden');
  };

  // --- Analytics ---
  const typeSel = $('analyticsType'), aDate = $('analyticsDate'), aMonth = $('analyticsMonth'), semStart = $('semesterStart'), semEnd = $('semesterEnd'), yrStart = $('yearStart');
  const loadAnalytics = $('loadAnalytics'), resetAnalytics = $('resetAnalytics'), instr = $('instructions'), contA = $('analyticsContainer'), graphs = $('graphs');
  const shareAnalytics = $('shareAnalytics'), downloadAnalytics = $('downloadAnalytics');
  const barCtx = $('barChart')?.getContext('2d'), pieCtx = $('pieChart')?.getContext('2d'); let chartBar, chartPie;
  function toggleInputs(){ [aDate,aMonth,semStart,semEnd,yrStart].forEach(el=>el.classList.add('hidden')); const v = typeSel.value;
    if(v==='date') aDate.classList.remove('hidden'); if(v==='month') aMonth.classList.remove('hidden'); if(v==='semester'){semStart.classList.remove('hidden'); semEnd.classList.remove('hidden');} if(v==='year') yrStart.classList.remove('hidden'); }
  typeSel.onchange = toggleInputs;
  function buildDates(){ const v = typeSel.value, arr = [], push = (s,e)=>{ let c=new Date(s); while(c<=e){ arr.push(c.toISOString().slice(0,10)); c.setDate(c.getDate()+1);} };
    if(v==='date'){ const d=new Date(aDate.value); if(!isNaN(d)) arr.push(d.toISOString().slice(0,10)); }
    if(v==='month'){ const [y,m]=aMonth.value.split('-'); push(new Date(y,m-1,1), new Date(y,m,0)); }
    if(v==='semester'){ const [ys,ms]=semStart.value.split('-'), [ye,me]=semEnd.value.split('-'); push(new Date(ys,ms-1,1), new Date(ye,me,0)); }
    if(v==='year'){ const [ys,ms]=yrStart.value.split('-'); const s=new Date(ys,ms-1,1), e=new Date(s); e.setMonth(e.getMonth()+11); e.setDate(0); push(s,e);} return arr; }
  loadAnalytics.onclick = ()=>{
    const dates = buildDates(); if(!dates.length) return alert('Select period');
    resetAnalytics.classList.remove('hidden'); instr.classList.remove('hidden'); contA.classList.remove('hidden'); graphs.classList.remove('hidden');
    instr.innerHTML = `<h3>Instructions</h3><p>Attendance % = (P+Lt+HD)/TotalDays ×100</p><p>Threshold: ${THRESHOLD}%</p>`;
    const dataA = JSON.parse(localStorage.getItem('attendanceData')||'{}');
    const summary = students.map(s=>{ const cnt={P:0,A:0,Lt:0,HD:0,L:0}; dates.forEach(d=>{ const st=(dataA[d]||{})[s.roll]||''; if(st) cnt[st]++;}); const pct=Math.round((cnt.P+cnt.Lt+cnt.HD)/dates.length*100); return {name:s.name,...cnt,pct}; });
    contA.innerHTML=''; const tbl=document.createElement('table'); tbl.border=1; tbl.style.width='100%'; tbl.innerHTML=`<tr><th>Name</th><th>P</th><th>Lt</th><th>HD</th><th>L</th><th>A</th><th>%</th><th>Elig</th></tr>`+summary.map(r=>`<tr><td>${r.name}</td><td>${r.P}</td><td>${r.Lt}</td><td>${r.HD}</td><td>${r.L}</td><td>${r.A}</td><td>${r.pct}%</td><td>${r.pct>=THRESHOLD?'✓':'✗'}</td></tr>`).join(''); contA.appendChild(tbl);
    if(barCtx){ if(chartBar) chartBar.destroy(); chartBar=new Chart(barCtx,{type:'bar',data:{labels:summary.map(r=>r.name),datasets:[{label:'%',data:summary.map(r=>r.pct)}]},options:{responsive:true}}); }
    if(pieCtx){ if(chartPie) chartPie.destroy(); chartPie=new Chart(pieCtx,{type:'pie',data:{labels:summary.map(r=>r.name),datasets:[{data:summary.map(r=>r.pct)}]},options:{responsive:true}}); }
  };
  resetAnalytics.onclick=()=>{ toggleInputs(); typeSel.value=''; resetAnalytics.classList.add('hidden'); instr.classList.add('hidden'); contA.classList.add('hidden'); graphs.classList.add('hidden'); };
  shareAnalytics.onclick=()=>{ const txt = instr.innerText+'\n\n'+contA.innerText; if(navigator.share) navigator.share({title:'Attendance Summary',text:txt}); else alert('Share not supported'); };
  downloadAnalytics.onclick=()=>{ const{jsPDF}=window.jspdf; const doc=new jsPDF('p','pt','a4'); let y=20; doc.setFontSize(12); instr.querySelectorAll('p').forEach(p=>{ doc.text(p.innerText,20,y); y+=15; }); y+=10; doc.autoTable({html:contA.querySelector('table'),startY:y,margin:{left:20,right:20}}); y=doc.lastAutoTable.finalY+20; doc.text('Bar Chart',20,y); y+=10; doc.addImage($('barChart').toDataURL(),'PNG',20,y,550,200); y+=210; doc.text('Pie Chart',20,y); y+=10; doc.addImage($('pieChart').toDataURL(),'PNG',20,y,300,200); doc.save('Attendance_Report.pdf'); };
});
