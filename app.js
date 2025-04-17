// app.js
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // Refs
  const schoolIn     = $('schoolNameInput');
  const classSel     = $('teacherClassSelect');
  const sectionSel   = $('teacherSectionSelect');
  const saveSetup    = $('saveSetup');
  const editSetup    = $('editSetup');
  const setupForm    = $('setupForm');
  const setupDisp    = $('setupDisplay');
  const dispSchool   = $('dispSchool');
  const dispClass    = $('dispClass');
  const dispSection  = $('dispSection');

  const nameIn       = $('studentName');
  const admIn        = $('admissionNo');
  const contactIn    = $('parentContact');
  const addStud      = $('addStudent');
  const studentsUl   = $('students');
  const delAllStud   = $('deleteAllStudents');

  const dateIn       = $('dateInput');
  const loadAtt      = $('loadAttendance');
  const attList      = $('attendanceList');
  const saveAtt      = $('saveAttendance');

  const attResultSec = $('attendance-result');
  const attResultUl  = $('attendanceResultList');
  const editAtt      = $('editAttendanceBtn');
  const shareAtt     = $('shareAttendanceBtn');
  const downloadAtt  = $('downloadAttendanceBtn');

  const analyticsType    = $('analyticsType');
  const analyticsDateIn  = $('analyticsDate');
  const analyticsMonthIn = $('analyticsMonth');
  const studentFilter    = $('studentFilter');
  const repType          = $('representationType');
  const loadAnalyticsBtn = $('loadAnalytics');
  const resetAnalytics   = $('resetAnalyticsBtn');
  const analyticsCont    = $('analyticsContainer');

  // State
  let schoolName   = localStorage.getItem('schoolName')     || '';
  let cls          = localStorage.getItem('teacherClass')   || '';
  let sec          = localStorage.getItem('teacherSection') || '';
  let students     = JSON.parse(localStorage.getItem('students'))       || [];
  let attendance   = JSON.parse(localStorage.getItem('attendanceData')) || {};
  let analyticsChart= null;
  let isEditing    = false, editRoll = null;

  // Setup
  function initSetup(){
    if(!schoolName||!cls||!sec) return;
    dispSchool.textContent  = schoolName;
    dispClass.textContent   = cls;
    dispSection.textContent = sec;
    setupForm.classList.add('hidden');
    setupDisp.classList.remove('hidden');
    renderStudents();
    populateFilter();
  }
  saveSetup.onclick = () => {
    const s = schoolIn.value.trim(), c = classSel.value, se = sectionSel.value;
    if(!s||!c||!se) return alert('Enter school, class & section');
    schoolName = s; cls = c; sec = se;
    localStorage.setItem('schoolName', schoolName);
    localStorage.setItem('teacherClass', cls);
    localStorage.setItem('teacherSection', sec);
    initSetup();
  };
  editSetup.onclick = () => {
    setupDisp.classList.add('hidden');
    setupForm.classList.remove('hidden');
    schoolIn.value   = schoolName;
    classSel.value   = cls;
    sectionSel.value = sec;
  };

  // Students
  function renderStudents(){
    studentsUl.innerHTML = '';
    students.filter(s=>s.class===cls&&s.section===sec)
      .forEach(s=>{
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = `${s.roll}. ${s.name}`;
        const grp = document.createElement('div');
        grp.className = 'button-group';

        const eBtn = document.createElement('button');
        eBtn.className='small'; eBtn.textContent='Edit';
        eBtn.onclick = ()=>{
          isEditing=true; editRoll=s.roll;
          nameIn.value=s.name; admIn.value=s.admissionNo; contactIn.value=s.parentContact;
          addStud.textContent='Update';
        };

        const dBtn = document.createElement('button');
        dBtn.className='small'; dBtn.textContent='Delete';
        dBtn.onclick = ()=>{
          if(!confirm('Delete?')) return;
          students = students.filter(x=>!(x.roll===s.roll&&x.class===cls&&x.section===sec));
          localStorage.setItem('students', JSON.stringify(students));
          renderStudents();
        };

        grp.append(eBtn,dBtn); li.append(span,grp); studentsUl.append(li);
      });
  }
  addStud.onclick = () => {
    const nm=nameIn.value.trim();
    if(!nm||!cls) return alert('Enter name & save setup');
    const ad=admIn.value.trim(), pc=contactIn.value.trim();
    if(isEditing){
      const stu=students.find(s=>s.roll===editRoll&&s.class===cls&&s.section===sec);
      stu.name=nm; stu.admissionNo=ad; stu.parentContact=pc;
      isEditing=false; addStud.textContent='Add';
    } else {
      const rl=students.filter(s=>s.class===cls&&s.section===sec).length+1;
      students.push({roll:rl,name:nm,admissionNo:ad,class:cls,section:sec,parentContact:pc});
    }
    localStorage.setItem('students', JSON.stringify(students));
    nameIn.value=admIn.value=contactIn.value='';
    renderStudents();
  };
  delAllStud.onclick = () => {
    if(!cls) return alert('Save setup first');
    if(!confirm('Delete all?')) return;
    students = students.filter(s=>!(s.class===cls&&s.section===sec));
    localStorage.setItem('students', JSON.stringify(students));
    renderStudents();
  };
  function populateFilter(){
    studentFilter.innerHTML = '<option value="">All Students</option>';
    students.filter(s=>s.class===cls&&s.section===sec)
      .forEach(s=>{
        const o=document.createElement('option');
        o.value=s.roll; o.textContent=s.name;
        studentFilter.append(o);
      });
  }

  // Attendance
  loadAtt.onclick = () => {
    const d = dateIn.value; if(!d) return alert('Pick date');
    renderAttendance(d);
  };
  function renderAttendance(d){
    attList.innerHTML = '';
    attendance[d] = attendance[d]||{};
    const day=attendance[d];
    students.filter(s=>s.class===cls&&s.section===sec)
      .forEach(s=>{
        const div=document.createElement('div'); div.className='attendance-item';
        const nd=document.createElement('div'); nd.className='att-name';
        nd.textContent=`${s.roll}. ${s.name}`;
        const act=document.createElement('div'); act.className='attendance-actions';
        const btns=document.createElement('div'); btns.className='attendance-buttons';
        ['P','A','Lt','L','HD'].forEach(code=>{
          const b=document.createElement('button');
          b.className='att-btn'+(day[s.roll]===code?` selected ${code}`:'');
          b.textContent=code;
          b.onclick=()=>{
            day[s.roll]=code;
            btns.querySelectorAll('button').forEach(x=>x.className='att-btn');
            b.classList.add('selected',code);
          };
          btns.append(b);
        });
        const send=document.createElement('button');
        send.className='send-btn'; send.textContent='Send';
        send.onclick=()=>showSummary(d);
        act.append(btns,send); div.append(nd,act); attList.append(div);
      });
  }
  saveAtt.onclick = () => {
    const d=dateIn.value; if(!d) return alert('Pick date');
    localStorage.setItem('attendanceData', JSON.stringify(attendance));
    showSummary(d);
  };

  // Summary
  function showSummary(d){
    attResultUl.innerHTML='';
    const day=attendance[d]||{};
    students.filter(s=>s.class===cls&&s.section===sec)
      .forEach(s=>{
        const li=document.createElement('li');
        li.textContent=`${s.name}: ${day[s.roll]||'Not marked'}`;
        attResultUl.append(li);
      });
    $('attendance-section').classList.add('hidden');
    attResultSec.classList.remove('hidden');
    editAtt.onclick=()=>{
      attResultSec.classList.add('hidden');
      $('attendance-section').classList.remove('hidden');
    };
    shareAtt.onclick=()=>shareSummary(d);
    downloadAtt.onclick=()=>downloadSummary(d);
  }
  function shareSummary(d){
    const day=attendance[d]||{};
    const lines=students.filter(s=>s.class===cls&&s.section===sec)
      .map(s=>`${s.name}: ${day[s.roll]||'Not marked'}`);
    const txt=`${schoolName}\nClass‑Section: ${cls}-${sec}\nDate: ${d}\n\n`+lines.join('\n');
    if(navigator.share) navigator.share({title:schoolName,text:txt});
    else alert('Share not supported');
  }
  function downloadSummary(d){
    const { jsPDF }=window.jspdf;
    const doc=new jsPDF();
    doc.text(schoolName,10,10);
    doc.text(`Class‑Section: ${cls}-${sec}`,10,20);
    doc.text(`Date: ${d}`,10,30);
    const body=students.filter(s=>s.class===cls&&s.section===sec)
      .map(s=>[s.name, attendance[d]?.[s.roll]||'Not marked']);
    doc.autoTable({head:[['Name','Status']],body,startY:40});
    doc.save(`Summary_${d}.pdf`);
  }

  // Analytics
  analyticsType.onchange = e=>{
    analyticsDateIn.classList.toggle('hidden', e.target.value!=='date');
    analyticsMonthIn.classList.toggle('hidden', e.target.value!=='month');
  };
  loadAnalyticsBtn.onclick = renderAnalytics;
  resetAnalytics.onclick = ()=>{
    [analyticsType,analyticsDateIn,analyticsMonthIn,studentFilter,repType,loadAnalyticsBtn]
      .forEach(el=>el.disabled=false);
    resetAnalytics.classList.add('hidden');
    analyticsCont.innerHTML='';
  };

  function renderAnalytics(){
    const type=analyticsType.value;
    const period= type==='date'? analyticsDateIn.value : analyticsMonthIn.value;
    if(!period) return alert('Select period');
    [analyticsType,analyticsDateIn,analyticsMonthIn,studentFilter,repType,loadAnalyticsBtn]
      .forEach(el=>el.disabled=true);
    resetAnalytics.classList.remove('hidden');

    // build date list
    let dates = [];
    const nowYear = new Date().getFullYear();
    if(type==='date') dates=[period];
    else if(type==='month'){
      const [y,mo]=period.split('-');
      const days = new Date(y,mo,0).getDate();
      for(let d=1;d<=days;d++){
        dates.push(`${y}-${mo}-${String(d).padStart(2,'0')}`);
      }
    } else if(type==='year'){
      for(let mo=1;mo<=12;mo++){
        const mm=String(mo).padStart(2,'0');
        const days=new Date(period,mo,0).getDate();
        for(let d=1;d<=days;d++){
          dates.push(`${period}-${mm}-${String(d).padStart(2,'0')}`);
        }
      }
    } else { // semester or sixmonths
      const [start,end]=type==='semester'? [1,6]: [7,12];
      for(let mo=start;mo<=end;mo++){
        const mm=String(mo).padStart(2,'0');
        const days=new Date(nowYear,mo,0).getDate();
        for(let d=1;d<=days;d++){
          dates.push(`${nowYear}-${mm}-${String(d).padStart(2,'0')}`);
        }
      }
    }

    // filter & compute
    const selStud = studentFilter.value;
    const data = students.filter(s=>s.class===cls&&s.section===sec)
      .filter(s=>!selStud||s.roll==selStud)
      .map(s=>{
        const cnt={P:0,A:0,Lt:0,L:0,HD:0};
        dates.forEach(d=>{
          const st=attendance[d]?.[s.roll];
          if(st) cnt[st]++;
        });
        const pct=Math.round((cnt.P+cnt.Lt+cnt.HD)/dates.length*100);
        return {name:s.name,cnt,pct};
      });

    analyticsCont.innerHTML='';

    // TABLE
    if(repType.value==='table'||repType.value==='all'){
      const tbl=document.createElement('table');
      tbl.border=1; tbl.style.width='100%';
      if(type==='month'){
        const days=dates.map(d=>d.split('-')[2]);
        const head=['Name',...days];
        docTable(tbl,head,students.filter(s=>s.class===cls&&s.section===sec)
          .map(s=>[s.name,...dates.map(d=>attendance[d]?.[s.roll]||'–')]));
      } else {
        const head=['Name','P','Lt','HD','L','A','%'];
        docTable(tbl,head,data.map(r=>[r.name,r.cnt.P,r.cnt.Lt,r.cnt.HD,r.cnt.L,r.cnt.A,r.pct+'%']));
      }
      const wrap=document.createElement('div'); wrap.className='table-container';
      wrap.append(tbl); analyticsCont.append(wrap);
    }

    // SUMMARY
    if(repType.value==='summary'||repType.value==='all'){
      data.forEach(r=>{
        const p=document.createElement('p');
        p.textContent=`${r.name}: ${r.cnt.P}P,${r.cnt.Lt}Lt,${r.cnt.HD}H,${r.cnt.L}L,${r.cnt.A}A — ${r.pct}%`;
        analyticsCont.append(p);
      });
    }

    // GRAPH
    if(repType.value==='graph'||repType.value==='all'){
      const canvas=document.createElement('canvas');
      analyticsCont.append(canvas);
      if(analyticsChart) analyticsChart.destroy();
      analyticsChart=new Chart(canvas.getContext('2d'),{
        type:'bar',
        data:{labels:data.map(r=>r.name),datasets:[{label:'%',data:data.map(r=>r.pct)}]},
        options:{responsive:true}
      });
      const btn=document.createElement('button');
      btn.className='small'; btn.textContent='Download Graph';
      btn.onclick=()=>{
        const url=analyticsChart.toBase64Image();
        const a=document.createElement('a');
        a.href=url; a.download=`Chart_${period}.png`; a.click();
      };
      analyticsCont.append(btn);
    }

    // SHARE / DOWNLOAD
    if(repType.value!=='all'){
      const wrap=document.createElement('div');
      wrap.className='row-inline';
      const shareB=document.createElement('button');
      shareB.className='small'; shareB.textContent='Share';
      shareB.onclick=()=>{
        let txt=`${schoolName}\nClass‑Section:${cls}-${sec}\nPeriod:${type} ${period}\n\n`;
        if(type==='month'){
          students.filter(s=>s.class===cls&&s.section===sec)
            .forEach(s=>{
              const codes=dates.map(d=>attendance[d]?.[s.roll]||'–').join(' ');
              txt+=`${s.name}: ${codes}\n`;
            });
        } else {
          data.forEach(r=>{txt+=`${r.name}: ${r.pct}%\n`;});
        }
        if(navigator.share) navigator.share({title:schoolName,text:txt});
        else alert('Share not supported');
      };
      const dlB=document.createElement('button');
      dlB.className='small'; dlB.textContent='Download';
      dlB.onclick=()=>{
        const { jsPDF }=window.jspdf;
        const doc=new jsPDF(type==='month'?'l':'p','pt','a4');
        doc.text(schoolName,20,20);
        if(type==='month'){
          const head=['Name',...dates.map(d=>d.split('-')[2])];
          const rows=students.filter(s=>s.class===cls&&s.section===sec)
            .map(s=>[s.name,...dates.map(d=>attendance[d]?.[s.roll]||'–')]);
          doc.autoTable({head:[head],body:rows,startY:40,styles:{fontSize:8},headStyles:{fillColor:[33,150,243]}});
          doc.save(`Register_${period}.pdf`);
        } else {
          const rows=data.map(r=>[r.name,r.pct+'%']);
          doc.autoTable({head:[['Name','%']],body:rows,startY:40});
          doc.save(`Report_${period}.pdf`);
        }
      };
      wrap.append(shareB,dlB); analyticsCont.append(wrap);
    }
  }

  function docTable(tbl, head, rows){
    const tr=document.createElement('tr');
    head.forEach(h=>{const th=document.createElement('th');th.textContent=h;tr.append(th);});
    tbl.append(tr);
    rows.forEach(r=>{const tr2=document.createElement('tr');r.forEach(c=>{const td=document.createElement('td');td.textContent=c;tr2.append(td);});tbl.append(tr2);});
  }

  // Init
  initSetup();
});
