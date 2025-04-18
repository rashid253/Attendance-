// app.js
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const THRESHOLD = 75;

  // --- Setup ---
  const schoolIn  = $('schoolNameInput'),
        classSel  = $('teacherClassSelect'),
        secSel    = $('teacherSectionSelect'),
        saveSet   = $('saveSetup'),
        formSet   = $('setupForm'),
        dispSet   = $('setupDisplay'),
        txtSet    = $('setupText'),
        editSet   = $('editSetup');

  function loadSetup(){
    const s=localStorage.getItem('schoolName'),
          c=localStorage.getItem('teacherClass'),
          e=localStorage.getItem('teacherSection');
    if(s&&c&&e){
      schoolIn.value=s; classSel.value=c; secSel.value=e;
      txtSet.textContent=`${s} 🏫 | Class: ${c} | Section: ${e}`;
      formSet.classList.add('hidden'); dispSet.classList.remove('hidden');
    }
  }
  saveSet.onclick=()=>{
    const s=schoolIn.value.trim(), c=classSel.value, e=secSel.value;
    if(!s||!c||!e) return alert('Complete setup');
    localStorage.setItem('schoolName',s);
    localStorage.setItem('teacherClass',c);
    localStorage.setItem('teacherSection',e);
    loadSetup();
  };
  editSet.onclick=()=>{
    dispSet.classList.add('hidden'); formSet.classList.remove('hidden');
  };
  loadSetup();

  // --- Student Registration ---
  let students = JSON.parse(localStorage.getItem('students')||'[]');
  const sName   = $('studentName'),
        admNo   = $('admissionNo'),
        pName   = $('parentName'),
        pContact= $('parentContact'),
        pOcc    = $('parentOccupation'),
        pAddr   = $('parentAddress'),
        addStu  = $('addStudent'),
        delAll  = $('deleteAllStudents'),
        stuList = $('students');

  function renderStudents(){
    stuList.innerHTML='';
    students.forEach((s,i)=>{
      const li=document.createElement('li'),
            info=document.createElement('span');
      info.textContent=`${s.name} | Adm#: ${s.adm||'-'} | Parent: ${s.parent} (${s.contact}) | ${s.occupation} | ${s.address}`;
      li.append(info);
      const edt=document.createElement('button'); edt.textContent='Edit';
      edt.onclick=()=>{
        const name=prompt('Name',s.name); if(name) s.name=name.trim();
        s.adm=prompt('Adm No',s.adm)||'';
        s.parent=prompt('Parent Name',s.parent)||'';
        s.contact=prompt('Parent Contact',s.contact)||'';
        s.occupation=prompt('Occupation',s.occupation)||'';
        s.address=prompt('Address',s.address)||'';
        localStorage.setItem('students',JSON.stringify(students));
        renderStudents();
      };
      const del=document.createElement('button'); del.textContent='Delete';
      del.onclick=()=>{
        if(confirm('Delete?')){ students.splice(i,1); localStorage.setItem('students',JSON.stringify(students)); renderStudents(); }
      };
      li.append(edt,del);
      stuList.append(li);
    });
  }
  addStu.onclick=()=>{
    const name=sName.value.trim(), adm=admNo.value.trim(),
          parent=prompt('Parent Name'), contact=prompt('Parent Contact'),
          occupation=prompt('Occupation'), address=prompt('Address');
    if(!name) return alert('Enter name');
    students.push({name,adm,parent,contact,occupation,address,roll:Date.now()});
    localStorage.setItem('students',JSON.stringify(students));
    sName.value=admNo.value=''; renderStudents();
  };
  delAll.onclick=()=>{
    if(confirm('Delete all students?')){ students=[]; localStorage.setItem('students','[]'); renderStudents(); }
  };
  renderStudents();

  // --- Attendance Marking ---
  const dateIn   = $('dateInput'),
        loadAtt  = $('loadAttendance'),
        attList  = $('attendanceList'),
        saveAtt  = $('saveAttendance'),
        sumSec   = $('attendance-result'),
        sumList  = $('attendanceResultList'),
        shareWA  = $('shareWhatsApp'),
        resetAtt = $('resetAttendance');

  loadAtt.onclick=()=>{
    const d=dateIn.value; if(!d) return alert('Pick date');
    attList.innerHTML='';
    students.forEach(s=>{
      const div=document.createElement('div');div.className='attendance-item';
      const nm=document.createElement('div');nm.className='att-name';nm.textContent=s.name;
      const actions=document.createElement('div');actions.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const btn=document.createElement('button');btn.className='att-btn';btn.textContent=code;
        btn.onclick=()=>{
          actions.querySelectorAll('button').forEach(b=>b.classList.remove('selected'));
          btn.classList.add('selected');
        };
        actions.append(btn);
      });
      div.append(nm,actions); attList.append(div);
    });
    saveAtt.classList.remove('hidden');
  };
  saveAtt.onclick=()=>{
    const d=dateIn.value,
          data=JSON.parse(localStorage.getItem('attendanceData')||'{}');
    data[d]={};
    attList.querySelectorAll('.attendance-item').forEach((div,i)=>{
      const sel=div.querySelector('.attendance-actions .selected');
      data[d][students[i].roll]=sel?sel.textContent:'';
    });
    localStorage.setItem('attendanceData',JSON.stringify(data));
    sumList.innerHTML='';
    Object.entries(data[d]).forEach(([roll,status])=>{
      const s=students.find(x=>x.roll==roll);
      const li=document.createElement('li');
      li.textContent=`${s.name}: ${status||'Not marked'}`;
      sumList.append(li);
    });
    sumSec.classList.remove('hidden');
  };
  shareWA.onclick=()=>{
    const texts = Array.from(sumList.children).map(li=>li.textContent).join('\n');
    const url = `https://wa.me/?text=${encodeURIComponent(texts)}`;
    window.open(url,'_blank');
  };
  resetAtt.onclick=()=>{
    attList.innerHTML=''; saveAtt.classList.add('hidden'); sumSec.classList.add('hidden'); sumList.innerHTML='';
  };

  // --- Analytics ---
  const typeSel      = $('analyticsType'),
        aDate         = $('analyticsDate'),
        aMonth        = $('analyticsMonth'),
        semStart      = $('semesterStart'),
        semEnd        = $('semesterEnd'),
        yrStart       = $('yearStart'),
        loadA         = $('loadAnalytics'),
        resetA        = $('resetAnalytics'),
        instr         = $('instructions'),
        contA         = $('analyticsContainer'),
        graphs        = $('graphs'),
        barCtx        = $('barChart').getContext('2d'),
        pieCtx        = $('pieChart').getContext('2d'),
        shareA        = $('shareAnalytics'),
        downloadA     = $('downloadAnalytics');
  let chartBar, chartPie;

  function toggleInputs(){
    [aDate,aMonth,semStart,semEnd,yrStart].forEach(el=>el.classList.add('hidden'));
    const v=typeSel.value;
    if(v==='date')     aDate.classList.remove('hidden');
    if(v==='month')    aMonth.classList.remove('hidden');
    if(v==='semester'){ semStart.classList.remove('hidden'); semEnd.classList.remove('hidden'); }
    if(v==='year')     yrStart.classList.remove('hidden');
  }
  typeSel.onchange=toggleInputs;

  function buildDates(){
    const v=typeSel.value, arr=[], push=(s,e)=>{
      let c=new Date(s);
      while(c<=e){
        arr.push(c.toISOString().slice(0,10));
        c.setDate(c.getDate()+1);
      }
    };
    if(v==='date'){
      const d=new Date(aDate.value); if(!isNaN(d)) arr.push(d.toISOString().slice(0,10));
    }
    if(v==='month'){
      const [y,m]=aMonth.value.split('-');
      push(new Date(y,m-1,1), new Date(y,m,0));
    }
    if(v==='semester'){
      const [ys,ms]=semStart.value.split('-'),
            [ye,me]=semEnd.value.split('-');
      push(new Date(ys,ms-1,1), new Date(ye,me,0));
    }
    if(v==='year'){
      const [ys,ms]=yrStart.value.split('-');
      const s=new Date(ys,ms-1,1), e=new Date(s);
      e.setMonth(e.getMonth()+11); e.setDate(0);
      push(s,e);
    }
    return arr;
  }

  loadA.onclick=()=>{
    const dates=buildDates();
    if(!dates.length) return alert('Select period');
    resetA.classList.remove('hidden');
    instr.classList.remove('hidden');
    contA.classList.remove('hidden');
    graphs.classList.remove('hidden');
    shareA.classList.remove('hidden');
    downloadA.classList.remove('hidden');

    instr.innerHTML=`
      <h3>Instructions</h3>
      <p>Attendance % = (P+Lt+HD)/TotalDays ×100</p>
      <p>Threshold: ${THRESHOLD}% for eligibility</p>
    `;

    const dataA=JSON.parse(localStorage.getItem('attendanceData')||'{}');
    const summary=students.map(s=>{
      const cnt={P:0,A:0,Lt:0,HD:0,L:0};
      dates.forEach(d=>{
        const st=(dataA[d]||{})[s.roll]||'';
        if(st) cnt[st]++;
      });
      const pct=Math.round((cnt.P+cnt.Lt+cnt.HD)/dates.length*100);
      return { name:s.name, ...cnt, pct };
    });

    // Table
    contA.innerHTML='';
    const tbl=document.createElement('table');
    tbl.border=1; tbl.style.width='100%';
    tbl.innerHTML=`
      <tr><th>Name</th><th>P</th><th>Lt</th><th>HD</th><th>L</th><th>A</th><th>%</th><th>Elig</th></tr>
      ${summary.map(r=>`
        <tr>
          <td>${r.name}</td>
          <td>${r.P}</td><td>${r.Lt}</td><td>${r.HD}</td><td>${r.L}</td><td>${r.A}</td>
          <td>${r.pct}%</td><td>${r.pct>=THRESHOLD?'✓':'✗'}</td>
        </tr>
      `).join('')}
    `;
    contA.append(tbl);

    // Bar Chart
    const labels=summary.map(r=>r.name), data=summary.map(r=>r.pct);
    if(chartBar) chartBar.destroy();
    chartBar=new Chart(barCtx,{type:'bar',data:{labels,datasets:[{label:'%',data}]},options:{responsive:true}});

    // Pie Chart
    if(chartPie) chartPie.destroy();
    chartPie=new Chart(pieCtx,{type:'pie',data:{labels,datasets:[{data}]},options:{responsive:true}});
  };

  resetA.onclick=()=>{
    [aDate,aMonth,semStart,semEnd,yrStart].forEach(el=>el.classList.add('hidden'));
    typeSel.value='';
    resetA.classList.add('hidden');
    instr.classList.add('hidden');
    contA.classList.add('hidden');
    graphs.classList.add('hidden');
    shareA.classList.add('hidden');
    downloadA.classList.add('hidden');
    contA.innerHTML='';
  };

  shareA.onclick=()=>{
    let txt=instr.innerText+'\n\n'+contA.innerText;
    if(navigator.share) navigator.share({title:'Attendance Summary',text:txt});
    else alert('Share not supported');
  };

  downloadA.onclick=()=>{
    const { jsPDF }=window.jspdf, doc=new jsPDF('p','pt','a4');
    let y=20;
    doc.setFontSize(12);
    instr.querySelectorAll('p').forEach(p=>{ doc.text(p.innerText,20,y); y+=15; });
    y+=10;
    doc.autoTable({html: contA.querySelector('table'), startY:y, margin:{left:20,right:20}});
    y = doc.lastAutoTable.finalY + 20;
    doc.text('Bar Chart',20,y); y+=10;
    doc.addImage($('barChart').toDataURL(),'PNG',20,y,550,200); y+=210;
    doc.text('Pie Chart',20,y); y+=10;
    doc.addImage($('pieChart').toDataURL(),'PNG',20,y,300,200);
    doc.save('Attendance_Report.pdf');
  };
});
