// app.js
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const THRESHOLD = 75;

  // --- Setup ---
  // (unchanged from original)
  const schoolIn  = $('schoolNameInput'), classSel=$('teacherClassSelect'), secSel=$('teacherSectionSelect');
  const saveSet=$('saveSetup'), formSet=$('setupForm'), dispSet=$('setupDisplay'), txtSet=$('setupText'), editSet=$('editSetup');
  function loadSetup(){
    const s=localStorage.getItem('schoolName'),c=localStorage.getItem('teacherClass'),e=localStorage.getItem('teacherSection');
    if(s&&c&&e){ schoolIn.value=s; classSel.value=c; secSel.value=e;
      txtSet.textContent=`${s} 🏫 | Class: ${c} | Section: ${e}`;
      formSet.classList.add('hidden'); dispSet.classList.remove('hidden');
    }
  }
  saveSet.onclick=()=>{ const s=schoolIn.value.trim(),c=classSel.value,e=secSel.value; if(!s||!c||!e) return alert('Complete setup');
    localStorage.setItem('schoolName',s); localStorage.setItem('teacherClass',c); localStorage.setItem('teacherSection',e); loadSetup(); };
  editSet.onclick=()=>{ dispSet.classList.add('hidden'); formSet.classList.remove('hidden'); };
  loadSetup();

  // --- Student Registration ---
  let students = JSON.parse(localStorage.getItem('students')||'[]');
  const sName=$('studentName'), admIn=$('admissionNo'), pNameIn=$('parentName'), pConIn=$('parentContact'), pOccIn=$('parentOccupation'), pAddrIn=$('parentAddress');
  const addBtn=$('addStudent'), tblBody=$('studentsTable').querySelector('tbody');
  const shareAll=$('shareAll'), saveAll=$('saveAll');

  function renderStudents(){
    tblBody.innerHTML='';
    students.forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td class="actions">
          <button class="edit"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M...edit-icon..."/></svg></button>
          <button class="delete"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M...trash-icon..."/></svg></button>
          <button class="share"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M...share-icon..."/></svg></button>
        </td>`;
      // Edit
      tr.querySelector('.edit').onclick = () => {
        s.name = prompt('Name', s.name).trim() || s.name;
        s.adm = prompt('Adm No', s.adm).trim() || s.adm;
        s.parent = prompt('Parent Name', s.parent).trim() || s.parent;
        s.contact = prompt('Parent Contact', s.contact).trim() || s.contact;
        s.occupation = prompt('Occupation', s.occupation).trim() || s.occupation;
        s.address = prompt('Address', s.address).trim() || s.address;
        localStorage.setItem('students', JSON.stringify(students)); renderStudents();
      };
      // Delete
      tr.querySelector('.delete').onclick = () => {
        if(confirm('Delete this student?')){ students.splice(i,1); localStorage.setItem('students',JSON.stringify(students)); renderStudents(); }
      };
      // Share
      tr.querySelector('.share').onclick = () => {
        const msg = `Student: ${s.name}\nAdm#: ${s.adm}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
      };
      tblBody.appendChild(tr);
    });
  }

  addBtn.onclick = () => {
    const name=sName.value.trim(),adm=admIn.value.trim();
    if(!name||!adm) return alert('Enter name and admission number');
    const student={ name, adm,
      parent: pNameIn.value.trim(), contact: pConIn.value.trim(),
      occupation: pOccIn.value.trim(), address: pAddrIn.value.trim(), roll:Date.now()
    };
    students.push(student);
    localStorage.setItem('students',JSON.stringify(students));
    sName.value=admIn.value=pNameIn.value=pConIn.value=pOccIn.value=pAddrIn.value='';
    renderStudents();
  };

  shareAll.onclick = () => {
    const text=students.map(s=>`${s.name} (${s.adm})`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank');
  };
  saveAll.onclick = () => alert('All student data is saved locally.');

  renderStudents();

  // --- Attendance Marking ---
  const dateIn=$('dateInput'), loadA=$('loadAttendance'), attList=$('attendanceList'), saveA=$('saveAttendance');
  const resSec=$('attendance-result'), resBody=$('attendanceSummaryTable').querySelector('tbody'), resetA=$('resetAttendance');
  let attendanceData=JSON.parse(localStorage.getItem('attendanceData')||'{}');

  loadA.onclick = () => {
    if(!dateIn.value) return alert('Pick date');
    attList.innerHTML='';
    students.forEach(s => {
      const div=document.createElement('div'); div.className='attendance-item';
      div.innerHTML = `<span>${s.name}</span><div class="attendance-actions">
        ${['P','A','Lt','HD','L'].map(code=>`<button class="att-btn">${code}</button>`).join('')}
      </div>`;
      div.querySelectorAll('.att-btn').forEach(btn=>btn.onclick=()=>{ div.querySelectorAll('.att-btn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); });
      attList.appendChild(div);
    });
    saveA.classList.remove('hidden');
  };

  saveA.onclick = () => {
    document.getElementById('attendance-section').classList.add('hidden');
    resSec.classList.remove('hidden');
    const d=dateIn.value; attendanceData[d]={};
    attList.querySelectorAll('.attendance-item').forEach((div,i)=>{
      const sel=div.querySelector('.selected'); attendanceData[d][students[i].roll]=sel?sel.textContent:'Not marked';
    });
    localStorage.setItem('attendanceData',JSON.stringify(attendanceData));
    resBody.innerHTML='';
    students.forEach(s=>{
      const status=attendanceData[d][s.roll];
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class="wa"><i class="fab fa-whatsapp"></i></button></td>`;
      tr.querySelector('.wa').onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(`Attendance for ${s.name} on ${d}: ${status}`)}`,'_blank');
      resBody.appendChild(tr);
    });
  };
  resetA.onclick = () => {
    resSec.classList.add('hidden'); document.getElementById('attendance-section').classList.remove('hidden');
    attList.innerHTML=''; saveA.classList.add('hidden');
  };

  // --- Analytics ---
  /* Restored original analytics code unchanged */
  const typeSel=$('analyticsType'), aDate=$('analyticsDate'), aMonth=$('analyticsMonth'), semStart=$('semesterStart'), semEnd=$('semesterEnd'), yrStart=$('yearStart');
  const loadAnalytics=$('loadAnalytics'), resetAnalytics=$('resetAnalytics'), instr=$('instructions'), contA=$('analyticsContainer'), graphs=$('graphs');
  const barCtx=$('barChart').getContext('2d'), pieCtx=$('pieChart').getContext('2d');
  let chartBar, chartPie;
  function toggleInputs(){ [aDate,aMonth,semStart,semEnd,yrStart].forEach(el=>el.classList.add('hidden')); const v=typeSel.value;
    if(v==='date') aDate.classList.remove('hidden'); if(v==='month') aMonth.classList.remove('hidden');
    if(v==='semester'){ semStart.classList.remove('hidden'); semEnd.classList.remove('hidden'); }
    if(v==='year') yrStart.classList.remove('hidden');
  }
  typeSel.onchange=toggleInputs;
  function buildDates(){ const v=typeSel.value, arr=[], push=(s,e)=>{ let c=new Date(s); while(c<=e){ arr.push(c.toISOString().slice(0,10)); c.setDate(c.getDate()+1);} };
    if(v==='date'){ const d=new Date(aDate.value); if(!isNaN(d)) arr.push(d.toISOString().slice(0,10)); }
    if(v==='month'){ const [y,m]=aMonth.value.split('-'); push(new Date(y,m-1,1), new Date(y,m,0)); }
    if(v==='semester'){ const [ys,ms]=semStart.value.split('-'),[ye,me]=semEnd.value.split('-'); push(new Date(ys,ms-1,1), new Date(ye,me,0)); }
    if(v==='year'){ const [ys,ms]=yrStart.value.split('-'); const s=new Date(ys,ms-1,1), e=new Date(s); e.setMonth(e.getMonth()+11); e.setDate(0); push(s,e); }
    return arr;
  }
  loadAnalytics.onclick=()=>{
    const dates=buildDates(); if(!dates.length) return alert('Select period');
    resetAnalytics.classList.remove('hidden'); instr.classList.remove('hidden'); contA.classList.remove('hidden'); graphs.classList.remove('hidden');
    instr.innerHTML=`<h3>Instructions</h3><p>Attendance % = (P+Lt+HD)/TotalDays ×100</p><p>Threshold: ${THRESHOLD}% for eligibility</p>`;
    const dataA=JSON.parse(localStorage.getItem('attendanceData')||'{}');
    const summary=students.map(s=>{ const cnt={P:0,A:0,Lt:0,HD:0,L:0}; dates.forEach(d=>{ const st=(dataA[d]||{})[s.roll]||''; if(st) cnt[st]++; }); const pct=Math.round((cnt.P+cnt.Lt+cnt.HD)/dates.length*100); return {name:s.name,...cnt,pct}; });
    contA.innerHTML=''; const tbl=document.createElement('table'); tbl.border=1; tbl.style.width='100%';
    tbl.innerHTML=`<tr><th>Name</th><th>P</th><th>Lt</th><th>HD</th><th>L</th><th>A</th><th>%</th><th>Elig</th></tr>${summary.map(r=>`<tr><td>${r.name}</td><td>${r.P}</td><td>${r.Lt}</td><td>${r.HD}</td><td>${r.L}</td><td>${r.A}</td><td>${r.pct}%</td><td>${r.pct>=THRESHOLD?'✓':'✗'}</td></tr>`).join('')}`;
    contA.appendChild(tbl);
    const labels=summary.map(r=>r.name), data=summary.map(r=>r.pct);
    if(chartBar) chartBar.destroy(); chartBar=new Chart(barCtx,{type:'bar',data:{labels,datasets:[{label:'%',data}]},options:{responsive:true}});
    if(chartPie) chartPie.destroy(); chartPie=new Chart(pieCtx,{type:'pie',data:{labels,datasets:[{data}]},options:{responsive:true}});
  };
  resetAnalytics.onclick=()=>{ toggleInputs(); typeSel.value=''; resetAnalytics.classList.add('hidden'); instr.classList.add('hidden'); contA.classList.add('hidden'); graphs.classList.add('hidden'); }
});
