window.addEventListener('DOMContentLoaded', ()=>{
  const $=id=>document.getElementById(id);
  const THRESHOLD=75;
  const colors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'var(--orange)',L:'var(--info)'};

  // Setup
  const schoolIn=$('schoolNameInput'), classSel=$('teacherClassSelect'), secSel=$('teacherSectionSelect');
  const saveSet=$('saveSetup'), formSet=$('setupForm'), dispSet=$('setupDisplay'), txtSet=$('setupText'), editSet=$('editSetup');
  saveSet.onclick=()=>{ if(!schoolIn.value||!classSel.value||!secSel.value) return alert('Complete setup'); localStorage.setItem('schoolName',schoolIn.value); localStorage.setItem('teacherClass',classSel.value); localStorage.setItem('teacherSection',secSel.value); loadSetup(); };
  editSet.onclick=()=>{ formSet.classList.remove('hidden'); dispSet.classList.add('hidden'); document.getElementById('studentTableWrapper').classList.remove('saved'); };
  function loadSetup(){ const s=localStorage.getItem('schoolName'),c=localStorage.getItem('teacherClass'),e=localStorage.getItem('teacherSection'); if(s&&c&&e){ schoolIn.value=s;classSel.value=c;secSel.value=e; txtSet.textContent=`${s} 🏫 | Class: ${c} | Section: ${e}`; formSet.classList.add('hidden'); dispSet.classList.remove('hidden'); }}
  loadSetup();

  // Student Registration
  let students=JSON.parse(localStorage.getItem('students')||'[]');
  const inputs=['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress'].map($);
  const addBtn=$('addStudent'),tblBody=$('studentsBody'),wrapper=$('studentTableWrapper');
  const selectAll=$('selectAllStudents'), editSelected=$('editSelected'), deleteSelected=$('deleteSelected');

  function saveStudents(){ localStorage.setItem('students',JSON.stringify(students)); }

  function renderStudents(){
    tblBody.innerHTML='';
    students.forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=
        `<td><input type="checkbox" class="selectStudent" data-index="${i}"></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>`+
        `<td class="actions"><button class="edit">Edit</button><button class="delete">Delete</button><button class="share">Share</button></td>`;

      // single-row actions
      tr.querySelector('.edit').onclick=()=>{
        ['name','adm','parent','contact','occupation','address'].forEach((key,idx)=>{
          s[key]=prompt(key,s[key])||s[key];
        }); saveStudents(); renderStudents();
      };
      tr.querySelector('.delete').onclick=()=>{
        if(confirm('Delete this student?')){ students.splice(i,1); saveStudents(); renderStudents(); }
      };
      tr.querySelector('.share').onclick=()=>{
        const setup=`School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
        const msg=`${setup}\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
      };

      tblBody.appendChild(tr);
    });
    bindSelection();
  }

  // selection logic
  function bindSelection(){
    const checkboxes=[...document.querySelectorAll('.selectStudent')];
    checkboxes.forEach(cb=>{
      cb.onchange=()=>{
        const tr=cb.closest('tr');
        if(cb.checked) tr.classList.add('selected'); else tr.classList.remove('selected');
        const anySel=checkboxes.some(x=>x.checked);
        editSelected.disabled=!anySel;
        deleteSelected.disabled=!anySel;
      };
    });
    selectAll.onchange=()=>{
      checkboxes.forEach(cb=>{ cb.checked=selectAll.checked; cb.dispatchEvent(new Event('change')); });
    };
  }

  // batch delete
  deleteSelected.onclick=()=>{
    if(!confirm('Delete selected students?')) return;
    const toDel=[...document.querySelectorAll('.selectStudent:checked')].map(cb=>+cb.dataset.index);
    toDel.sort((a,b)=>b-a).forEach(idx=>students.splice(idx,1));
    saveStudents(); renderStudents(); selectAll.checked=false;
  };

  // batch edit
  editSelected.onclick=()=>{
    [...document.querySelectorAll('.selectStudent:checked')].forEach(cb=>{
      const i=+cb.dataset.index;
      ['name','adm','parent','contact','occupation','address'].forEach((key)=>{
        students[i][key]=prompt(`Edit ${key}`, students[i][key])||students[i][key];
      });
    }); saveStudents(); renderStudents(); selectAll.checked=false;
  };

  addBtn.onclick=()=>{
    const vals=inputs.map(i=>i.value.trim());
    if(!vals[0]||!vals[1]) return alert('Name & Adm# required');
    const [name,adm,parent,contact,occupation,address]=vals;
    students.push({name,adm,parent,contact,occupation,address,roll:Date.now()});
    saveStudents(); renderStudents(); inputs.forEach(i=>i.value='');
  };

  renderStudents();

  // Attendance
  let attendanceData=JSON.parse(localStorage.getItem('attendanceData')||'{}');
  const dateIn=$('dateInput'),loadAtt=$('loadAttendance'),attList=$('attendanceList'),saveAtt=$('saveAttendance');
  const resSec=$('attendance-result'),summaryBody=$('summaryBody'),resetAtt=$('resetAttendance');

  loadAtt.onclick=()=>{
    if(!dateIn.value) return alert('Pick date');
    attList.innerHTML='';
    students.forEach((s,i)=>{
      const nameRow=document.createElement('div'); nameRow.className='attendance-item'; nameRow.textContent=s.name;
      const btnRow=document.createElement('div'); btnRow.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button'); b.className='att-btn'; b.dataset.code=code; b.textContent=code;
        const saved=attendanceData[dateIn.value]?.[s.roll];
        if(saved===code){ b.style.background=colors[code]; b.style.color='#fff'; }
        b.onclick=()=>{[...btnRow.children].forEach(x=>{ x.style.background='transparent'; x.style.color='var(--dark)'; }); b.style.background=colors[code]; b.style.color='#fff';};
        btnRow.append(b);
      });
      attList.append(nameRow,btnRow);
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick=()=>{
    const d=dateIn.value; attendanceData[d]={};
    attList.querySelectorAll('.attendance-actions').forEach((row,i)=>{
      const btn=row.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll]=btn?btn.dataset.code:'Not marked';
    });
    localStorage.setItem('attendanceData',JSON.stringify(attendanceData));
    $('attendance-section').classList.add('hidden'); resSec.classList.remove('hidden'); summaryBody.innerHTML='';
    students.forEach(s=>{
      const st=attendanceData[d][s.roll];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${st}</td><td><button class="send">Send</button></td>`;
      tr.querySelector('.send').onclick=()=>{
        const remark={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[st]||'';
        const setup=`School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
        const msg=`${setup}\nDate: ${d}\nName: ${s.name}\nStatus: ${st}\nRemark: ${remark}`;
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`,'_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  resetAtt.onclick=()=>{ resSec.classList.add('hidden'); $('attendance-section').classList.remove('hidden'); attList.innerHTML=''; saveAtt.classList.add('hidden'); };

  // Summary share & download
  $('shareAttendanceSummary').onclick=()=>{
    const lines=[...summaryBody.querySelectorAll('tr')].map(r=>{
      const [name,status]=r.children;
      return `Name: ${name.textContent}\nStatus: ${status.textContent}`;
    }).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`,'_blank');
  };

  $('downloadAttendanceSummary').onclick=()=>{
    const{jsPDF}=window.jspdf; const doc=new jsPDF('p','pt','a4'); let y=20;
    doc.setFontSize(12);
    doc.text(`Attendance Summary - ${dateIn.value}`,20,y); y+=20;
    doc.autoTable({ html: summaryBody.closest('table'), startY: y, margin:{left:20,right:20} });
    doc.save(`Attendance_Summary_${dateIn.value}.pdf`);
  };

  // Analytics (unchanged)
  const typeSel=$('analyticsType'),aDate=$('analyticsDate'),aMonth=$('analyticsMonth'),semStart=$('semesterStart'),semEnd=$('semesterEnd'),yrStart=$('yearStart');
  const loadAnalytics=$('loadAnalytics'),resetAnalytics=$('resetAnalytics'),instr=$('instructions'),contA=$('analyticsContainer'),graphs=$('graphs');
  const shareAnalytics=$('shareAnalytics'),downloadAnalytics=$('downloadAnalytics');
  const barCtx=$('barChart').getContext('2d'),pieCtx=$('pieChart').getContext('2d'); let chartBar,chartPie, summaryData=[];

  function toggleInputs(){ [aDate,aMonth,semStart,semEnd,yrStart].forEach(el=>el.classList.add('hidden')); const v=typeSel.value; if(v==='date') aDate.classList.remove('hidden'); if(v==='month') aMonth.classList.remove('hidden'); if(v==='semester'){ semStart.classList.remove('hidden'); semEnd.classList.remove('hidden'); } if(v==='year') yrStart.classList.remove('hidden'); }
  typeSel.onchange=toggleInputs;
  function buildDates(){ const v=typeSel.value,arr=[],push=(s,e)=>{let c=new Date(s);while(c<=e){arr.push(c.toISOString().slice(0,10));c.setDate(c.getDate()+1);} };
    if(v==='date'){const d=new Date(aDate.value);if(!isNaN(d))arr.push(d.toISOString().slice(0,10));}
    if(v==='month'){const [y,m]=aMonth.value.split('-');push(new Date(y,m-1,1),new Date(y,m,0));}
    if(v==='semester'){const [ys,ms]=semStart.value.split('-'),[ye,me]=semEnd.value.split('-');push(new Date(ys,ms-1,
