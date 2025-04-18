// app.js
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // --- Setup ---
  const schoolIn = $('schoolNameInput'),
        classSel = $('teacherClassSelect'),
        secSel   = $('teacherSectionSelect'),
        saveSetup= $('saveSetup'),
        formSetup= $('setupForm'),
        dispSetup= $('setupDisplay'),
        txtSetup = $('setupText'),
        editSetup= $('editSetup');

  function loadSetup() {
    const s = localStorage.getItem('schoolName'),
          c = localStorage.getItem('teacherClass'),
          e = localStorage.getItem('teacherSection');
    if (s && c && e) {
      schoolIn.value=s; classSel.value=c; secSel.value=e;
      txtSetup.textContent = `${s} 🏫 | Class: ${c} | Section: ${e}`;
      formSetup.classList.add('hidden');
      dispSetup.classList.remove('hidden');
    }
  }
  saveSetup.addEventListener('click', () => {
    const s=schoolIn.value.trim(), c=classSel.value, e=secSel.value;
    if (!s||!c||!e) return alert('Complete setup');
    localStorage.setItem('schoolName',s);
    localStorage.setItem('teacherClass',c);
    localStorage.setItem('teacherSection',e);
    loadSetup();
  });
  editSetup.addEventListener('click', ()=>{
    dispSetup.classList.add('hidden');
    formSetup.classList.remove('hidden');
  });
  loadSetup();

  // --- Students ---
  let students = JSON.parse(localStorage.getItem('students')||'[]');
  const stuName  = $('studentName'),
        admNo    = $('admissionNo'),
        parentCt = $('parentContact'),
        addStu   = $('addStudent'),
        delAll   = $('deleteAllStudents'),
        stuList  = $('students');

  function renderStudents() {
    stuList.innerHTML='';
    students.forEach((s,i)=>{
      const li=document.createElement('li'),
            span=document.createElement('span');
      span.textContent=`${s.name} | Adm#: ${s.adm||'-'} | Parent: ${s.parent||'-'}`;
      li.append(span);
      const editBtn=document.createElement('button');
      editBtn.textContent='Edit';
      editBtn.onclick=()=>{
        const name=prompt('Name',s.name);
        if (!name) return;
        s.name=name.trim();
        s.adm=prompt('Admission No',s.adm)||'';
        s.parent=prompt('Parent Contact',s.parent)||'';
        localStorage.setItem('students',JSON.stringify(students));
        renderStudents();
      };
      const delBtn=document.createElement('button');
      delBtn.textContent='Delete';
      delBtn.onclick=()=>{
        if(!confirm('Delete?'))return;
        students.splice(i,1);
        localStorage.setItem('students',JSON.stringify(students));
        renderStudents();
      };
      li.append(editBtn,delBtn);
      stuList.append(li);
    });
  }
  addStu.addEventListener('click',()=>{
    const n=stuName.value.trim();
    if(!n) return alert('Enter name');
    students.push({name:n,adm:admNo.value.trim(),parent:parentCt.value.trim(),roll:Date.now()});
    localStorage.setItem('students',JSON.stringify(students));
    stuName.value=''; admNo.value=''; parentCt.value='';
    renderStudents();
  });
  delAll.addEventListener('click',()=>{
    if(!confirm('Delete all?'))return;
    students=[]; localStorage.setItem('students','[]'); renderStudents();
  });
  renderStudents();

  // --- Attendance ---
  const dateIn   = $('dateInput'),
        loadAtt  = $('loadAttendance'),
        attList  = $('attendanceList'),
        saveAtt  = $('saveAttendance'),
        sumSec   = $('attendance-result'),
        sumList  = $('attendanceResultList'),
        resetAtt = $('resetAttendance');

  loadAtt.addEventListener('click',()=>{
    const d=dateIn.value; if(!d) return alert('Pick a date');
    attList.innerHTML='';
    students.forEach(s=>{
      const div=document.createElement('div');div.className='attendance-item';
      const nm=document.createElement('div');nm.className='att-name';nm.textContent=s.name;
      const actions=document.createElement('div');actions.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const btn=document.createElement('button');
        btn.className='att-btn'; btn.textContent=code;
        btn.onclick=()=>{actions.querySelectorAll('button').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');};
        actions.append(btn);
      });
      div.append(nm,actions); attList.append(div);
    });
    saveAtt.classList.remove('hidden');
  });
  saveAtt.addEventListener('click',()=>{
    const d=dateIn.value;
    const data=JSON.parse(localStorage.getItem('attendanceData')||'{}');
    data[d]={};
    attList.querySelectorAll('.attendance-item').forEach((div,i)=>{
      const sel=div.querySelector('.attendance-actions .selected');
      data[d][students[i].roll]=sel?sel.textContent:'';
    });
    localStorage.setItem('attendanceData',JSON.stringify(data));
    // summary
    sumList.innerHTML='';
    Object.entries(data[d]).forEach(([roll,status])=>{
      const s=students.find(x=>x.roll==roll);
      const li=document.createElement('li');
      li.textContent=`${s?.name||roll}: ${status||'Not marked'}`;
      sumList.append(li);
    });
    sumSec.classList.remove('hidden');
  });
  resetAtt.onclick=()=>{
    attList.innerHTML=''; saveAtt.classList.add('hidden');
    sumSec.classList.add('hidden'); sumList.innerHTML='';
  };

  // --- Analytics ---
  const THRESHOLD=75;
  let chartBar, chartPie;
  const typeSel    = $('analyticsType'),
        dateA      = $('analyticsDate'),
        monA       = $('analyticsMonth'),
        semS       = $('semesterStart'),
        semE       = $('semesterEnd'),
        yrS        = $('yearStart'),
        loadA      = $('loadAnalytics'),
        resetA     = $('resetAnalyticsBtn'),
        instr      = $('instructions'),
        contA      = $('analyticsContainer'),
        graphs     = $('graphs'),
        shareA     = $('shareAnalytics'),
        downloadA  = $('downloadAnalytics');

  function toggleInputs(){
    [dateA,monA,semS,semE,yrS].forEach(el=>el.classList.add('hidden'));
    const v=typeSel.value;
    if(v==='date')     dateA.classList.remove('hidden');
    if(v==='month')    monA.classList.remove('hidden');
    if(v==='semester'){ semS.classList.remove('hidden'); semE.classList.remove('hidden'); }
    if(v==='year')     yrS.classList.remove('hidden');
  }
  typeSel.addEventListener('change',toggleInputs);

  function buildDates(){
    const v=typeSel.value, arr=[], pushRange=(a,b)=>{
      let cur=new Date(a);
      while(cur<=b){
        arr.push(cur.toISOString().slice(0,10));
        cur.setDate(cur.getDate()+1);
      }
    };
    if(v==='date'){
      const d=new Date(dateA.value); if(d.toString()!=='Invalid Date') arr.push(d.toISOString().slice(0,10));
    }
    if(v==='month'){
      const [y,m]=monA.value.split('-');
      const s=new Date(y,m-1,1),
            e=new Date(y,m,0);
      pushRange(s,e);
    }
    if(v==='semester'){
      const [ys,ms]=semS.value.split('-'),
            [ye,me]=semE.value.split('-');
      pushRange(new Date(ys,ms-1,1),new Date(ye,me,0));
    }
    if(v==='year'){
      const [ys,ms]=yrS.value.split('-');
      const s=new Date(ys,ms-1,1),
            e=new Date(s); e.setMonth(e.getMonth()+11); e.setDate(0);
      pushRange(s,e);
    }
    return arr;
  }

  loadA.addEventListener('click',()=>{
    const dates=buildDates();
    if(!dates.length) return alert('Select valid period');
    resetA.classList.remove('hidden');
    instr.classList.remove('hidden');
    contA.classList.remove('hidden');
    graphs.classList.remove('hidden');
    shareA.classList.remove('hidden');
    downloadA.classList.remove('hidden');

    // instructions
    instr.innerHTML=`
      <h3>Instructions & Formulas</h3>
      <p><strong>Attendance %</strong> = (P + Lt + HD) / TotalDays × 100</p>
      <p><strong>Eligibility Threshold</strong>: ${THRESHOLD}%</p>
    `;

    // summary
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

    // render table
    contA.innerHTML='';
    const tbl=document.createElement('table');
    tbl.border=1;tbl.style.width='100%';
    tbl.innerHTML=`
      <tr><th>Name</th><th>P</th><th>Lt</th><th>HD</th><th>L</th><th>A</th><th>%</th><th>Elig</th></tr>
      ${summary.map(r=>`
        <tr>
          <td>${r.name}</td><td>${r.P}</td><td>${r.Lt}</td>
          <td>${r.HD}</td><td>${r.L}</td><td>${r.A}</td>
          <td>${r.pct}%</td>
          <td>${r.pct>=THRESHOLD?'✓':'✗'}</td>
        </tr>`).join('')}
    `;
    contA.append(tbl);

    // charts
    const labels=summary.map(r=>r.name),
          data  =summary.map(r=>r.pct);
    if(chartBar) chartBar.destroy();
    chartBar=new Chart($('barChart').getContext('2d'),{
      type:'bar',
      data:{labels,datasets:[{label:'%',data}]},
      options:{responsive:true}
    });
    if(chartPie) chartPie.destroy();
    chartPie=new Chart($('pieChart').getContext('2d'),{
      type:'pie',
      data:{labels,datasets:[{data}]},
      options:{responsive:true}
    });
  });

  resetA.addEventListener('click',()=>{
    [dateA,monA,semS,semE,yrS].forEach(el=>el.classList.add('hidden'));
    typeSel.value='';
    resetA.classList.add('hidden');
    instr.classList.add('hidden');
    contA.classList.add('hidden');
    graphs.classList.add('hidden');
    shareA.classList.add('hidden');
    downloadA.classList.add('hidden');
    contA.innerHTML='';
  });

  shareA.addEventListener('click',()=>{
    let txt=instr.innerText+'\n\n'+contA.innerText;
    if(navigator.share) navigator.share({title:'Attendance Summary',text:txt});
    else alert('Share not supported');
  });

  downloadA.addEventListener('click',()=>{
    const { jsPDF }=window.jspdf;
    const doc=new jsPDF('p','pt','a4');
    let y=20;
    doc.setFontSize(12);
    instr.querySelectorAll('p').forEach(p=>{
      doc.text(p.innerText,20,y); y+=15;
    });
    y+=10;
    doc.autoTable({html:contA.querySelector('table'),startY:y,margin:{left:20,right:20}});
    y=doc.lastAutoTable.finalY+20;
    doc.text('Bar Chart',20,y); y+=10;
    const barImg=$('barChart').toDataURL('image/png');
    doc.addImage(barImg,'PNG',20,y,550,200); y+=210;
    doc.text('Pie Chart',20,y); y+=10;
    const pieImg=$('pieChart').toDataURL('image/png');
    doc.addImage(pieImg,'PNG',20,y,300,200);
    doc.save('Attendance_Report.pdf');
  });

});
