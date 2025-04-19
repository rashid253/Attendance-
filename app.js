// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };

  // SETUP
  const schoolIn = $('schoolNameInput');
  const classSel = $('teacherClassSelect');
  const secSel = $('teacherSectionSelect');
  const saveSetupBtn = $('saveSetup');
  const setupForm = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText = $('setupText');
  const editSetupBtn = $('editSetup');

  function loadSetup() {
    const school = localStorage.getItem('schoolName');
    const cls = localStorage.getItem('teacherClass');
    const sec = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetupBtn.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };

  editSetupBtn.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };

  loadSetup();

  // STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const studentNameIn = $('studentName');
  const admissionNoIn = $('admissionNo');
  const parentNameIn = $('parentName');
  const parentContactIn = $('parentContact');
  const parentOccupationIn = $('parentOccupation');
  const parentAddressIn = $('parentAddress');
  const addStudentBtn = $('addStudent');
  const studentsBody = $('studentsBody');
  const selectAllChk = $('selectAllStudents');
  const editSelectedBtn = $('editSelected');
  const deleteSelectedBtn = $('deleteSelected');
  const saveRegBtn = $('saveRegistration');
  const shareRegBtn = $('shareRegistration');
  const editRegBtn = $('editRegistration');
  const downloadRegPDFBtn = $('downloadRegistrationPDF');
  let regSaved = false;
  let inlineEdit = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved ? 'disabled' : ''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved ? '<button class="share-one">Share</button>' : ''}</td>`;
      if (regSaved) {
        tr.querySelector('.share-one').onclick = ev => {
          ev.preventDefault();
          const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
          const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindStudentSelection();
  }

  function bindStudentSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelectedBtn.disabled = deleteSelectedBtn.disabled = !any;
      };
    });
    selectAllChk.disabled = regSaved;
    selectAllChk.onchange = () => {
      if (!regSaved) boxes.forEach(cb => { cb.checked = selectAllChk.checked; cb.dispatchEvent(new Event('change')); });
    };
  }

  addStudentBtn.onclick = ev => {
    ev.preventDefault();
    const name = studentNameIn.value.trim();
    const adm = admissionNoIn.value.trim();
    const parent = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occupation = parentOccupationIn.value.trim();
    const address = parentAddressIn.value.trim();
    if (!name || !adm || !parent || !contact || !occupation || !address) return alert('All fields required');
    if (!/^[0-9]+$/.test(adm)) return alert('Adm# must be numeric');
    if (!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7–15 digits');
    students.push({ name, adm, parent, contact, occupation, address, roll: Date.now() });
    saveStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccupationIn, parentAddressIn].forEach(i => i.value = '');
  };

  function onCellBlur(e) {
    const td = e.target;
    const tr = td.closest('tr');
    const idx = +tr.querySelector('.sel').dataset.index;
    const ci = Array.from(tr.children).indexOf(td);
    const keys = ['name','adm','parent','contact','occupation','address'];
    if (ci >=1 && ci <=6) {
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  }

  editSelectedBtn.onclick = ev => {
    ev.preventDefault();
    const sel = Array.from(document.querySelectorAll('.sel:checked'));
    if (!sel.length) return;
    inlineEdit = !inlineEdit;
    editSelectedBtn.textContent = inlineEdit?'Done Editing':'Edit Selected';
    sel.forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td,ci) => {
        if(ci>=1&&ci<=6){
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit?td.addEventListener('blur',onCellBlur):td.removeEventListener('blur',onCellBlur);
        }
      });
    });
  };

  deleteSelectedBtn.onclick = ev => {
    ev.preventDefault();
    if(!confirm('Delete selected?'))return;
    Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb=>+cb.dataset.index).sort((a,b)=>b-a)
      .forEach(i=>students.splice(i,1));
    saveStudents();
    renderStudents();
    selectAllChk.checked=false;
  };

  saveRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegPDFBtn.classList.remove('hidden');
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  editRegBtn.onclick = ev=>{
    ev.preventDefault();
    regSaved=false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegPDFBtn.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick = ev=>{
    ev.preventDefault();
    const hdr = `School: ${localStorage.getItem('schoolName')}\\nClass: ${localStorage.getItem('teacherClass')}\\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s=>
      `Name: ${s.name}\\nAdm#: ${s.adm}\\nParent: ${s.parent}\\nContact: ${s.contact}\\nOccupation: ${s.occupation}\\nAddress: ${s.address}`
    ).join('\\n---\\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\\n\\n'+lines)}`,'_blank');
  };

  downloadRegPDFBtn.onclick = ev=>{
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc=new jsPDF('p','pt','a4');
    doc.autoTable({
      head:[['Name','Adm#','Parent','Contact','Occupation','Address']],
      body:students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY:40,
      margin:{left:40,right:40},
      styles:{fontSize:10}
    });
    doc.save('students_registration.pdf');
  };

  renderStudents();

  // ATTENDANCE
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');
  const dateInput = $('dateInput');
  const loadAttBtn = $('loadAttendance');
  const attList = $('attendanceList');
  const saveAttBtn = $('saveAttendance');
  const resSection = $('attendance-result');
  const summaryBody = $('summaryBody');
  const resetAttBtn = $('resetAttendance');
  const shareAttBtn = $('shareAttendanceSummary');
  const downloadAttPDFBtn = $('downloadAttendancePDF');

  loadAttBtn.onclick = ev=>{
    ev.preventDefault();
    if(!dateInput.value)return alert('Pick a date');
    attList.innerHTML='';
    students.forEach(s=>{
      const row=document.createElement('div');
      row.className='attendance-item';row.textContent=s.name;
      const btns=document.createElement('div');
      btns.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button');
        b.type='button';b.className='att-btn';b.dataset.code=code;b.textContent=code;
        if(attendanceData[dateInput.value]?.[s.roll]===code){
          b.style.background=colors[code];b.style.color='#fff';
        }
        b.onclick=e2=>{
          e2.preventDefault();
          btns.querySelectorAll('.att-btn').forEach(x=>{x.style.background='';x.style.color='var(--dark)';});
          b.style.background=colors[code];b.style.color='#fff';
        };
        btns.append(b);
      });
      attList.append(row,btns);
    });
    saveAttBtn.classList.remove('hidden');
  };

  saveAttBtn.onclick=ev=>{
    ev.preventDefault();
    const d=dateInput.value;
    attendanceData[d]={};
    attList.querySelectorAll('.attendance-actions').forEach((btns,i)=>{
      const sel=btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll]=sel?sel.dataset.code:'A';
    });
    localStorage.setItem('attendanceData',JSON.stringify(attendanceData));
    $('attendance-section').classList.add('hidden');
    resSection.classList.remove('hidden');
    summaryBody.innerHTML='';
    const hdr=`Date: ${d}\\nSchool: ${localStorage.getItem('schoolName')}\\nClass: ${localStorage.getItem('teacherClass')}\\nSection: ${localStorage.getItem('teacherSection')}`;
    summaryBody.insertAdjacentHTML('beforebegin',`<tr><td colspan="3"><em>${hdr}</em></td></tr>`);
    students.forEach(s=>{
      const code=attendanceData[d][s.roll]||'A';
      const status={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick=e2=>{
        e2.preventDefault();
        const msg=`${hdr}\\n\\nName: ${s.name}\\nStatus: ${status}`;
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`,'_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  resetAttBtn.onclick=ev=>{
    ev.preventDefault();
    resSection.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    attList.innerHTML='';
    saveAttBtn.classList.add('hidden');
    summaryBody.innerHTML='';
  };

  shareAttBtn.onclick=ev=>{
    ev.preventDefault();
    const d=dateInput.value;
    const hdr=`Date: ${d}\\nSchool: ${localStorage.getItem('schoolName')}\\nClass: ${localStorage.getItem('teacherClass')}\\nSection: ${localStorage.getItem('teacherSection')}`;
    const remarkMap={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'};
    const lines=students.map(s=>`${s.name}: ${remarkMap[attendanceData[d][s.roll]||'A']}`);
    const total=students.length;
    const pres=students.reduce((sum,s)=>sum+(attendanceData[d][s.roll]==='P'?1:0),0);
    const pct=total?((pres/total)*100).toFixed(1):'0.0';
    const clsRemark=pct==100?'Best':pct>=75?'Good':pct>=50?'Fair':'Poor';
    const summary=`Overall Attendance: ${pct}% | ${clsRemark}`;
    const msg=[hdr,'',...lines,'',summary].join('\\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
  };

  downloadAttPDFBtn.onclick=ev=>{
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc=new jsPDF('p','pt','a4');
    doc.autoTable({
      head:[['Name','Status']],
      body:students.map(s=>{
        const code=attendanceData[dateInput.value][s.roll]||'A';
        return [s.name,{P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]];
      }),
      startY:40,
      margin:{left:40,right:40},
      styles:{fontSize:10}
    });
    doc.save('attendance_summary.pdf');
  };

  // ANALYTICS
  const analyticsTypeEl = $('analyticsType');
  const analyticsDateEl = $('analyticsDate');
  const analyticsMonthEl= $('analyticsMonth');
  const semesterStartEl= $('semesterStart');
  const semesterEndEl  = $('semesterEnd');
  const yearStartEl    = $('yearStart');
  const loadAnalyticsBtnEl   = $('loadAnalytics');
  const resetAnalyticsBtnEl  = $('resetAnalytics');
  const instructionsEl2      = $('instructions');
  const analyticsContainerEl = $('analyticsContainer');
  const graphsEl2            = $('graphs');
  const analyticsActionsEl2  = $('analyticsActions');
  const shareAnalyticsBtnEl  = $('shareAnalytics');
  const downloadAnalyticsBtnEl = $('downloadAnalytics');

  function resetAnalyticsView(){
    analyticsDateEl.classList.add('hidden');
    analyticsMonthEl.classList.add('hidden');
    semesterStartEl.classList.add('hidden');
    semesterEndEl.classList.add('hidden');
    yearStartEl.classList.add('hidden');
    instructionsEl2.classList.add('hidden');
    analyticsContainerEl.classList.add('hidden');
    graphsEl2.classList.add('hidden');
    analyticsActionsEl2.classList.add('hidden');
    resetAnalyticsBtnEl.classList.add('hidden');
  }

  analyticsTypeEl.onchange = () => {
    resetAnalyticsView();
    if(analyticsTypeEl.value==='date') analyticsDateEl.classList.remove('hidden');
    if(analyticsTypeEl.value==='month') analyticsMonthEl.classList.remove('hidden');
    if(analyticsTypeEl.value==='semester') {
      semesterStartEl.classList.remove('hidden');
      semesterEndEl.classList.remove('hidden');
    }
    if(analyticsTypeEl.value==='year') yearStartEl.classList.remove('hidden');
  };

  resetAnalyticsBtnEl.onclick = ev=>{
    ev.preventDefault();
    analyticsTypeEl.value='';
    resetAnalyticsView();
  };

  loadAnalyticsBtnEl.onclick = ev=>{
    ev.preventDefault();
    let from,to,isMonth=false;
    if(analyticsTypeEl.value==='date'){
      if(!analyticsDateEl.value)return alert('Pick a date');
      from=to=analyticsDateEl.value;
    }
    else if(analyticsTypeEl.value==='month'){
      if(!analyticsMonthEl.value)return alert('Pick a month');
      const [y,m]=analyticsMonthEl.value.split('-').map(Number);
      from=`${analyticsMonthEl.value}-01`;
      to=`${analyticsMonthEl.value}-${days=>new Date(y,m,0).getDate()}`;
      isMonth=true;
    } else if(analyticsTypeEl.value==='semester'){
      if(!semesterStartEl.value||!semesterEndEl.value)return alert('Pick range');
      from=`${semesterStartEl.value}-01`;
      to=`${semesterEndEl.value}-31`;
    } else if(analyticsTypeEl.value==='year'){
      if(!yearStartEl.value)return alert('Pick a year');
      from=`${yearStartEl.value}-01-01`;
      to=`${yearStartEl.value}-12-31`;
    } else return;

    // compute stats
    const stats = students.map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      if(d>=from&&d<=to){
        stats.forEach(st=>{ const c=recs[st.roll]||'A'; st[c]++; st.total++; });
      }
    });
    // build table
    let html='<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s=>{
      const pct=s.total?((s.P/s.total)*100).toFixed(1):'0.0';
      html+=`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
    });
    html+='</tbody></table>';
    analyticsContainerEl.innerHTML=html;
    analyticsContainerEl.classList.remove('hidden');
    instructionsEl2.textContent=`Report: ${from} to ${to}`;
    instructionsEl2.classList.remove('hidden');
    resetAnalyticsBtnEl.classList.remove('hidden');

    // charts
    const labels=stats.map(s=>s.name);
    const dataPct=stats.map(s=>s.total? s.P/s.total*100:0);
    if(barChart)barChart.destroy();
    const barCtx=document.getElementById('barChart').getContext('2d');
    barChart=new Chart(barCtx,{type:'bar',data:{labels,datasets:[{label:'% Present',data:dataPct}]},options:{maintainAspectRatio:true}});
    const agg={P:0,A:0,Lt:0,HD:0,L:0};
    stats.forEach(s=>{['P','A','Lt','HD','L'].forEach(c=>agg[c]+=s[c]);});
    if(pieChart)pieChart.destroy();
    const pieCtx=document.getElementById('pieChart').getContext('2d');
    pieChart=new Chart(pieCtx,{type:'pie',data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg)}]},options:{maintainAspectRatio:true}});
    graphsEl2.classList.remove('hidden');
    analyticsActionsEl2.classList.remove('hidden');

    // Traditional Register injection if monthly
    const analyticsRegisterEl=$('traditional-register');
    if(isMonth){
      analyticsRegisterEl.classList.remove('hidden');
      // reuse loadRegisterBtn logic
      loadRegisterBtn.click();
    } else analyticsRegisterEl.classList.add('hidden');
  };

  shareAnalyticsBtnEl.onclick = () => {
    const period = instructionsEl2.textContent.replace('Report: ','');
    const hdr = `Date Range: ${period}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const rows = Array.from(document.querySelectorAll('#analyticsContainer tbody tr')).map(r=>{
      const tds=Array.from(r.querySelectorAll('td')).map(td=>td.textContent);
      return `${tds[0]} P:${tds[1]} A:${tds[2]} Lt:${tds[3]} HD:${tds[4]} L:${tds[5]} Total:${tds[6]} %:${tds[7]}`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+rows)}`,'_blank');
  };

  downloadAnalyticsBtnEl.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc=new jsPDF('p','pt','a4');
    doc.text(localStorage.getItem('schoolName'),40,30);
    doc.text(`Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`,40,45);
    doc.text(instructionsEl2.textContent.replace('Report: ','Period: '),40,60);
    doc.autoTable({html:'#analyticsContainer table',startY:75,styles:{fontSize:8}});
    let y=doc.lastAutoTable.finalY+10;
    doc.addImage(barChart.toBase64Image(),'PNG',40,y,120,80);
    doc.addImage(pieChart.toBase64Image(),'PNG',180,y,120,80);
    y+=100;
    // include register PDF if visible
    if(!$('traditional-register').classList.contains('hidden')){
      doc.text('Traditional Register',40,y);
      doc.autoTable({html:'#registerTable',startY:y+10,styles:{fontSize:6}});
    }
    doc.save('analytics_register.pdf');
  };

  // TRADITIONAL MONTHLY REGISTER (standalone)
  const loadRegisterBtn = $('loadRegister');
  const regMonthInEl   = $('regMonth');
  const regTableEl     = $('registerTable');
  const registerSummaryEl = $('registerSummary');
  const registerGraphEl   = $('registerGraph');
  const shareRegisterBtn  = $('shareRegister');
  const downloadRegisterBtn = $('downloadRegisterPDF');
  let registerChart;

  function daysInMonth(m,y){return new Date(y,m,0).getDate();}

  loadRegisterBtn.onclick = ev=>{
    ev.preventDefault();
    const val=regMonthInEl.value;
    if(!val) return alert('Pick month & year');
    const [y,m]=val.split('-').map(Number);
    const days=daysInMonth(m,y);
    let html='<thead><tr><th>Sr#</th><th>Reg#</th><th>Name</th>';
    for(let d=1;d<=days;d++) html+=`<th>${d}</th>`;
    html+='</tr></thead><tbody>';
    students.forEach((s,i)=>{
      html+=`<tr><td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=days;d++){
        const dd=String(d).padStart(2,'0');
        const date=`${y}-${String(m).padStart(2,'0')}-${dd}`;
        const code=attendanceData[date]?.[s.roll]||'A';
        html+=`<td style="background:${colors[code]};color:#fff">${code}</td>`;
      }
      html+='</tr>';
    });
    html+='</tbody>';
    regTableEl.innerHTML=html;

    const totalEntries=students.length*days;
    const totalPresent=Array.from(regTableEl.querySelectorAll('tbody tr')).reduce((sum,tr)=>
      sum+Array.from(tr.querySelectorAll('td')).slice(3).filter(td=>td.textContent==='P').length,0);
    const pct=totalEntries?((totalPresent/totalEntries)*100).toFixed(1):'0.0';
    const remark=pct==100?'Excellent':pct>=75?'Good':pct>=50?'Fair':'Poor';
    registerSummaryEl.innerHTML=`<p><strong>Overall Attendance:</strong> ${pct}% | <em>${remark}</em></p>`;
    registerSummaryEl.classList.remove('hidden');

    const ctx=document.getElementById('registerChart').getContext('2d');
    const presentCounts=[];
    for(let d=1;d<=days;d++){
      const dd=String(d).padStart(2,'0');
      const date=`${y}-${String(m).padStart(2,'0')}-${dd}`;
      presentCounts.push(students.reduce((ct,st)=>ct+((attendanceData[date]?.[st.roll]==='P')?1:0),0));
    }
    if(registerChart) registerChart.destroy();
    registerChart=new Chart(ctx,{type:'bar',data:{labels:Array.from({length:days},(_,i)=>i+1),datasets:[{label:'Present Count',data:presentCounts}]},options:{maintainAspectRatio:true}});
    registerGraphEl.classList.remove('hidden');
    shareRegisterBtn.classList.remove('hidden');
    downloadRegisterBtn.classList.remove('hidden');
  };

  shareRegisterBtn.onclick=()=>{
    let text=`Register for ${regMonthInEl.value}\n`;
    const [y,m]=regMonthInEl.value.split('-').map(Number);
    const days=daysInMonth(m,y);
    students.forEach((s,i)=>{
      text+=`${i+1}. ${s.adm} ${s.name}: `;
      for(let d=1;d<=days;d++){
        const dd=String(d).padStart(2,'0');
        const date=`${regMonthInEl.value}-${dd}`;
        text+=attendanceData[date]?.[s.roll]||'A';
      }
      text+='\n';
    });
    text+=registerSummaryEl.textContent;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank');
  };

  downloadRegisterBtn.onclick=()=>{
    const { jsPDF }=window.jspdf;
    const doc=new jsPDF('p','pt','a4');
    doc.text(`Register: ${regMonthInEl.value}`,40,30);
    doc.autoTable({html:'#registerTable',startY:40,styles:{fontSize:8}});
    const y=doc.lastAutoTable.finalY+10;
    doc.setFontSize(12);
    doc.text(registerSummaryEl.textContent,40,y);
    const img=registerChart.toBase64Image();
    doc.addImage(img,'PNG',40,y+20,500,200);
    doc.save('monthly_register.pdf');
  };
});
