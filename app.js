// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const THRESHOLD = 75;
  const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'var(--orange)', L:'var(--info)' };

  // --- SETUP ---
  const schoolIn = $('schoolNameInput'),
        classSel = $('teacherClassSelect'),
        secSel   = $('teacherSectionSelect'),
        saveSet  = $('saveSetup'),
        formSet  = $('setupForm'),
        dispSet  = $('setupDisplay'),
        txtSet   = $('setupText'),
        editSet  = $('editSetup');

  saveSet.onclick = () => {
    if (!schoolIn.value || !classSel.value || !secSel.value)
      return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };
  editSet.onclick = () => {
    formSet.classList.remove('hidden');
    dispSet.classList.add('hidden');
  };
  function loadSetup() {
    const s = localStorage.getItem('schoolName'),
          c = localStorage.getItem('teacherClass'),
          e = localStorage.getItem('teacherSection');
    if (s && c && e) {
      schoolIn.value = s;
      classSel.value = c;
      secSel.value   = e;
      txtSet.textContent = `${s} 🏫 | Class: ${c} | Section: ${e}`;
      formSet.classList.add('hidden');
      dispSet.classList.remove('hidden');
    }
  }
  loadSetup();

  // --- STUDENT REGISTRATION ---
  let students = JSON.parse(localStorage.getItem('students')||'[]');
  const inputs     = ['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress'].map($),
        addBtn     = $('addStudent'),
        tblBody    = $('studentsBody'),
        selectAll  = $('selectAllStudents'),
        editSel    = $('editSelected'),
        delSel     = $('deleteSelected'),
        saveReg    = $('saveRegistration'),
        shareReg   = $('shareRegistration'),
        editReg    = $('editRegistration'),
        downloadReg= $('downloadRegistrationPDF');
  let savedReg=false, inlineMode=false;

  function saveStudents(){ localStorage.setItem('students', JSON.stringify(students)); }
  function renderStudents(){
    tblBody.innerHTML='';
    students.forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=
        `<td class="select-col" style="${savedReg?'display:none':''}"><input type="checkbox" class="selStu" data-i="${i}"></td>`+
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>`+
        `<td>${savedReg?'<button class="sRow">Share</button>':''}</td>`;
      if(savedReg){
        tr.querySelector('.sRow').onclick=()=>{
          const hdr=`School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
          const msg=`${hdr}\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
        };
      }
      tblBody.appendChild(tr);
    });
    bindSel();
  }
  function bindSel(){
    const boxes=[...document.querySelectorAll('.selStu')];
    boxes.forEach(cb=>cb.onchange=()=>{
      const tr=cb.closest('tr');
      cb.checked?tr.classList.add('selected'):tr.classList.remove('selected');
      const any=boxes.some(x=>x.checked);
      editSel.disabled=delSel.disabled=!any||savedReg;
    });
    selectAll.disabled=savedReg;
    selectAll.onchange=()=>{
      if(savedReg) return;
      boxes.forEach(cb=>{cb.checked=selectAll.checked;cb.dispatchEvent(new Event('change'));});
    };
  }
  delSel.onclick=()=>{
    if(!confirm('Delete?'))return;
    [...document.querySelectorAll('.selStu:checked')].map(cb=>+cb.dataset.i).sort((a,b)=>b-a)
      .forEach(idx=>students.splice(idx,1));
    saveStudents();renderStudents();selectAll.checked=false;
  };
  function onBlur(e){
    const td=e.target,tr=td.closest('tr'),i=+tr.querySelector('.selStu').dataset.i;
    const keys=['name','adm','parent','contact','occupation','address'],ci=[...tr.children].indexOf(td);
    if(ci>=1&&ci<=6){students[i][keys[ci-1]]=td.textContent.trim();saveStudents();}
  }
  editSel.onclick=()=>{
    if(savedReg) return;
    const sel=[...document.querySelectorAll('.selStu:checked')];if(!sel.length)return;
    inlineMode=!inlineMode; editSel.textContent=inlineMode?'Done Editing':'Edit Selected';
    sel.forEach(cb=>{
      const tr=cb.closest('tr');
      [...tr.querySelectorAll('td')].forEach((td,ci)=>{
        if(ci>=1&&ci<=6){
          td.contentEditable=inlineMode;td.classList.toggle('editing',inlineMode);
          inlineMode?td.addEventListener('blur',onBlur):td.removeEventListener('blur',onBlur);
        }
      });
    });
  };
  saveReg.onclick=()=>{
    savedReg=true;
    [editSel,delSel,selectAll,saveReg].forEach(b=>b.style.display='none');
    shareReg.classList.remove('hidden');
    editReg.classList.remove('hidden');
    downloadReg.classList.remove('hidden');
    renderStudents();
  };
  editReg.onclick=()=>{
    savedReg=false;
    [editSel,delSel,selectAll,saveReg].forEach(b=>b.style.display='');
    shareReg.classList.add('hidden');
    editReg.classList.add('hidden');
    downloadReg.classList.add('hidden');
    renderStudents();
  };
  shareReg.onclick=()=>{
    const hdr=`School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    const data=students.map(s=>`Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+data)}`,'_blank');
  };
  addBtn.onclick=()=>{
    if(savedReg) return;
    const vs=inputs.map(i=>i.value.trim());if(!vs[0]||!vs[1]) return alert('Name & Adm# required');
    students.push({name:vs[0],adm:vs[1],parent:vs[2],contact:vs[3],occupation:vs[4],address:vs[5],roll:Date.now()});
    saveStudents();renderStudents();inputs.forEach(i=>i.value='');
  };
  renderStudents();

  // --- ATTENDANCE MARKING & SUMMARY ---
  let attendanceData=JSON.parse(localStorage.getItem('attendanceData')||'{}');
  const dateIn=$('dateInput'),loadAtt=$('loadAttendance'),attList=$('attendanceList'),saveAtt=$('saveAttendance');
  const resSec=$('attendance-result'),summaryBody=$('summaryBody'),resetAtt=$('resetAttendance');

  loadAtt.onclick=()=>{
    if(!dateIn.value)return alert('Pick date');
    attList.innerHTML='';
    students.forEach((s,i)=>{
      const nr=document.createElement('div');nr.className='attendance-item';nr.textContent=s.name;
      const br=document.createElement('div');br.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button');b.className='att-btn';b.dataset.code=code;b.textContent=code;
        if(attendanceData[dateIn.value]?.[s.roll]===code){b.style.background=colors[code];b.style.color='#fff'}
        b.onclick=()=>{[...br.children].forEach(x=>{x.style.background='transparent';x.style.color='var(--dark)'});b.style.background=colors[code];b.style.color='#fff'};
        br.append(b);
      });
      attList.append(nr,br);
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick=()=>{
    const d=dateIn.value;attendanceData[d]={};
    attList.querySelectorAll('.attendance-actions').forEach((row,i)=>{
      const b=row.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll]=b?b.dataset.code:'Not marked';
    });
    localStorage.setItem('attendanceData',JSON.stringify(attendanceData));
    $('attendance-section').classList.add('hidden');resSec.classList.remove('hidden');summaryBody.innerHTML='';
    summaryBody.insertAdjacentHTML('beforebegin',`<tr><td colspan="3"><em>School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')} | Date: ${d}</em></td></tr>`);
    students.forEach(s=>{
      const st=attendanceData[d][s.roll];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${st}</td><td><button class="send">Send</button></td>`;
      tr.querySelector('.send').onclick=()=>{
        const rm={'P':'Good attendance—keep it up!','A':'Please ensure regular attendance.','Lt':'Remember to arrive on time.','HD':'Submit permission note for half‑day.','L':'Attend when possible.'}[st]||'';
        const msg=[`Date: ${d}`,`School: ${localStorage.getItem('schoolName')}`,`Class: ${localStorage.getItem('teacherClass')}`,`Section: ${localStorage.getItem('teacherSection')}`,'',`Name: ${s.name}`,`Status: ${st}`,`Remarks: ${rm}`].join('\n');
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`,'_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  resetAtt.onclick=()=>{
    resSec.classList.add('hidden');$('attendance-section').classList.remove('hidden');attList.innerHTML='';saveAtt.classList.add('hidden');summaryBody.innerHTML='';
  };

  $('downloadAttendancePDF').onclick=()=>{
    const {jsPDF}=window.jspdf;const doc=new jsPDF('p','pt','a4');let y=20;
    const hdr=[`School: ${localStorage.getItem('schoolName')}` ,`Class: ${localStorage.getItem('teacherClass')}`,`Section: ${localStorage.getItem('teacherSection')}`,`Date: ${$('dateInput').value}`].join(' | ');
    doc.setFontSize(14);doc.text(hdr,20,y);y+=20;
    doc.autoTable({html:document.querySelector('#attendanceSummaryTable'),startY:y,theme:'grid',headStyles:{fillColor:[41,128,185],textColor:255,fontStyle:'bold'},styles:{fontSize:10,cellPadding:4}});
    doc.save(`Attendance_Summary_${$('dateInput').value}.pdf`);
  };

  // --- ANALYTICS ---
  const typeSel=$('analyticsType'),aDate=$('analyticsDate'),aMonth=$('analyticsMonth'),semS=$('semesterStart'),semE=$('semesterEnd'),yr=$('yearStart'),loadA=$('loadAnalytics'),resetA=$('resetAnalytics'),instr=$('instructions'),contA=$('analyticsContainer'),graphs=$('graphs'),shareA=$('shareAnalytics'),downloadA=$('downloadAnalytics'),barCtx=$('barChart').getContext('2d'),pieCtx=$('pieChart').getContext('2d');
  window.summaryData=[];

  function toggleI(){[aDate,aMonth,semS,semE,yr].forEach(el=>el.classList.add('hidden'));const v=typeSel.value;if(v==='date')aDate.classList.remove('hidden');if(v==='month')aMonth.classList.remove('hidden');if(v==='semester'){semS.classList.remove('hidden');semE.classList.remove('hidden')}if(v==='year')yr.classList.remove('hidden');}
  typeSel.onchange=toggleI;
  function buildDates(){const v=typeSel.value,arr=[],pr=(s,e)=>{let d=new Date(s);while(d<=e){arr.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1)}};if(v==='date'){let d=new Date(aDate.value);if(!isNaN(d))arr.push(d.toISOString().slice(0,10))}if(v==='month'){let [y,m]=aMonth.value.split('-');pr(new Date(y,m-1,1),new Date(y,m,0))}if(v==='semester'){let [ys,ms]=semS.value.split('-'),[ye,me]=semE.value.split('-');pr(new Date(ys,ms-1,1),new Date(ye,me,0))}if(v==='year'){let y=+yr.value;pr(new Date(y,0,1),new Date(y,11,31))}return arr;}

  loadA.onclick=()=>{
    const dates=buildDates();if(!dates.length)return alert('Select period');
    resetA.classList.remove('hidden');instr.classList.remove('hidden');contA.classList.remove('hidden');graphs.classList.remove('hidden');
    instr.innerHTML=`<h3>Instructions</h3><p>Attendance % = (P+Lt+HD)/TotalDays ×100</p><p>Threshold: ${THRESHOLD}%</p>`;
    const dataA=JSON.parse(localStorage.getItem('attendanceData')||'{}');
    const summary=students.map(s=>{const cnt={P:0,A:0,Lt:0,HD:0,L:0};dates.forEach(d=>{const st=(dataA[d]||{})[s.roll]||'';if(st)cnt[st]++});const total=dates.length;const pct=Math.round((cnt.P+cnt.Lt+cnt.HD)/total*100);return {name:s.name,...cnt,total,pct}});
    window.summaryData=summary;
    contA.innerHTML='';const tbl=document.createElement('table');tbl.border=1;tbl.style.width='100%';tbl.innerHTML=`<tr><th>Name</th><th>P</th><th>Lt</th><th>HD</th><th>L</th><th>A</th><th>Total</th><th>%</th><th>Elig</th></tr>`+summary.map(r=>`<tr><td>${r.name}</td><td>${r.P}</td><td>${r.Lt}</td><td>${r.HD}</td><td>${r.L}</td><td>${r.A}</td><td>${r.total}</td><td>${r.pct}%</td><td>${r.pct>=THRESHOLD?'✓':'✗'}</td></tr>`).join('');
    contA.appendChild(tbl);
    if(window.chartBar)window.chartBar.destroy();window.chartBar=new Chart(barCtx,{type:'bar',data:{labels:summary.map(r=>r.name),datasets:[{label:'%',data:summary.map(r=>r.pct)}]},options:{responsive:true}});
    if(window.chartPie)window.chartPie.destroy();window.chartPie=new Chart(pieCtx,{type:'pie',data:{labels:summary.map(r=>r.name),datasets:[{data:summary.map(r=>r.pct)}]},options:{responsive:true}});
    $('analyticsActions').classList.remove('hidden');
  };

  resetA.onclick=()=>{typeSel.value='';toggleI();resetA.classList.add('hidden');instr.classList.add('hidden');contA.classList.add('hidden');graphs.classList.add('hidden');$('analyticsActions').classList.add('hidden')};

  shareA.onclick=()=>{
    const dates=buildDates();if(!dates.length)return alert('Select period');
    const header=[`Date Range: ${dates[0]} to ${dates[dates.length-1]}`,`School: ${localStorage.getItem('schoolName')}`,`Class: ${localStorage.getItem('teacherClass')}`,`Section: ${localStorage.getItem('teacherSection')}`,''].join('\n');
    const blocks=window.summaryData.map(r=>{const remark=r.pct>=THRESHOLD?'Good attendance—keep it up!':'Attendance below threshold.';return [`*${r.name}*`,`P:${r.P} A:${r.A} Lt:${r.Lt} HD:${r.HD} L:${r.L}` ,`Total: ${r.total}  %: ${r.pct}%`,`Remarks: ${remark}`, ''].join('\n')}).join('\n');
    const avg=window.summaryData.reduce((s,r)=>s+r.pct,0)/window.summaryData.length;const avgRem=avg>=THRESHOLD?'Overall attendance is good.':'Overall attendance needs improvement.';const footer=[`Class Average: ${avg.toFixed(1)}%`,`Remarks: ${avgRem}`].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+blocks+'\n'+footer)}`,'_blank');
  };

  downloadA.onclick=()=>{
    const {jsPDF}=window.jspdf;const doc=new jsPDF('p','pt','a4');let y=20;
    const dates=buildDates();const hdrLine=[`Date Range: ${dates[0]} to ${dates[dates.length-1]}`,`School: ${localStorage.getItem('schoolName')}`,`Class: ${localStorage.getItem('teacherClass')}`,`Section: ${localStorage.getItem('teacherSection')}`].join(' | ');
    doc.setFontSize(14);doc.text(hdrLine,20,y);y+=20;
    doc.autoTable({html:contA.querySelector('table'),startY:y,theme:'grid',headStyles:{fillColor:[41,128,185],textColor:255,fontStyle:'bold'},styles:{fontSize:10,cellPadding:4}});
    doc.save('Attendance_Analytics.pdf');
  };
});
