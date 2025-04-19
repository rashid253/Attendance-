// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // ---------------- SETUP ----------------
  const schoolIn    = $('schoolNameInput');
  const classSel    = $('teacherClassSelect');
  const secSel      = $('teacherSectionSelect');
  const saveSetup   = $('saveSetup');
  const setupForm   = $('setupForm');
  const setupDisp   = $('setupDisplay');
  const setupText   = $('setupText');
  const editSetup   = $('editSetup');

  function loadSetup() {
    const school = localStorage.getItem('schoolName');
    const cls    = localStorage.getItem('teacherClass');
    const sec    = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value   = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisp.classList.remove('hidden');
    }
  }
  saveSetup.addEventListener('click', e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  });
  editSetup.addEventListener('click', e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisp.classList.add('hidden');
  });
  loadSetup();


  // ------------- STUDENT REGISTRATION -------------
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const studentNameIn = $('studentName'),
        admissionNo  = $('admissionNo'),
        parentName   = $('parentName'),
        parentContact= $('parentContact'),
        parentOcc    = $('parentOccupation'),
        parentAddr   = $('parentAddress'),
        addStudent   = $('addStudent'),
        studentsBody = $('studentsBody'),
        selectAll    = $('selectAllStudents'),
        editSelBtn   = $('editSelected'),
        delSelBtn    = $('deleteSelected'),
        saveRegBtn   = $('saveRegistration'),
        shareRegBtn  = $('shareRegistration'),
        editRegBtn   = $('editRegistration'),
        downloadRegPDF = $('downloadRegistrationPDF');
  let regSaved = false, inlineEdit = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }
  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelBtn.disabled = delSelBtn.disabled = !any;
      };
    });
    selectAll.disabled = regSaved;
    selectAll.onchange = () => {
      if (!regSaved) boxes.forEach(cb => { cb.checked = selectAll.checked; cb.dispatchEvent(new Event('change')); });
    };
  }
  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" data-index="${i}" ${regSaved?'disabled':''}></td>
        <td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>
        <td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>${regSaved?'<button class="share-one">Share</button>':''}</td>`;
      if (regSaved) tr.querySelector('.share-one').onclick = ev => {
        ev.preventDefault();
        const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
        const msg = `${hdr}\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      };
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }
  addStudent.addEventListener('click', e => {
    e.preventDefault();
    const name = studentNameIn.value.trim(),
          adm  = admissionNo.value.trim(),
          par  = parentName.value.trim(),
          con  = parentContact.value.trim(),
          occ  = parentOcc.value.trim(),
          addr = parentAddr.value.trim();
    if (!name||!adm||!par||!con||!occ||!addr) return alert('All fields required');
    if (!/^\d+$/.test(adm)) return alert('Adm# numeric');
    if (!/^\d{7,15}$/.test(con)) return alert('Contact format');
    students.push({ name, adm, parent: par, contact: con, occupation: occ, address: addr, roll: Date.now() });
    saveStudents();
    renderStudents();
    [studentNameIn, admissionNo, parentName, parentContact, parentOcc, parentAddr].forEach(i=>i.value='');
  });
  let onCellBlur = e => {
    const td = e.target, tr = td.closest('tr'),
          idx = +tr.querySelector('.sel').dataset.index,
          ci  = Array.from(tr.children).indexOf(td),
          keys= ['name','adm','parent','contact','occupation','address'];
    if (ci>=1&&ci<=6) {
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  };
  editSelBtn.addEventListener('click', e => {
    e.preventDefault();
    const boxes = Array.from(document.querySelectorAll('.sel:checked'));
    if (!boxes.length) return;
    inlineEdit = !inlineEdit;
    editSelBtn.textContent = inlineEdit?'Done Editing':'Edit Selected';
    boxes.forEach(cb => {
      const tds = cb.closest('tr').querySelectorAll('td');
      tds.forEach((td, ci) => {
        if (ci>=1&&ci<=6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit?td.addEventListener('blur', onCellBlur):td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  });
  delSelBtn.addEventListener('click', e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb=>+cb.dataset.index).sort((a,b)=>b-a)
      .forEach(i=>students.splice(i,1));
    saveStudents(); renderStudents(); selectAll.checked=false;
  });
  saveRegBtn.addEventListener('click', e => {
    e.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegPDF.classList.remove('hidden');
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  });
  editRegBtn.addEventListener('click', e => {
    e.preventDefault();
    regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegPDF.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  });
  shareRegBtn.addEventListener('click', e => {
    e.preventDefault();
    const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s=>`Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+"\n\n"+lines)}`, '_blank');
  });
  downloadRegPDF.addEventListener('click', e=>{
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    doc.autoTable({ head:[['Name','Adm#','Parent','Contact','Occupation','Address']], body: students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]), startY:40, margin:{left:40,right:40}, styles:{fontSize:10} });
    doc.save('students_registration.pdf');
  });
  renderStudents();


  // ------------- ATTENDANCE MARKING & SUMMARY -------------
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
  const dateInput     = $('dateInput'),
        loadAtt       = $('loadAttendance'),
        attList       = $('attendanceList'),
        saveAtt       = $('saveAttendance'),
        attSection    = $('attendance-section'),
        resSection    = $('attendance-result'),
        summaryBody   = $('summaryBody'),
        resetAtt      = $('resetAttendance'),
        shareAtt      = $('shareAttendanceSummary'),
        downloadAtt   = $('downloadAttendancePDF');
  const colors       = { P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'var(--orange)',L:'var(--info)' };

  loadAtt.addEventListener('click', e=>{
    e.preventDefault();
    if (!dateInput.value) return alert('Pick a date');
    attList.innerHTML = '';
    students.forEach(s=>{
      const row = document.createElement('div'); row.className='attendance-item'; row.textContent=s.name;
      const btns= document.createElement('div'); btns.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button');
        b.type='button'; b.className='att-btn'; b.textContent=code; b.dataset.code=code;
        if (attendanceData[dateInput.value]?.[s.roll]===code) {
          b.style.background=colors[code]; b.style.color='#fff';
        }
        b.addEventListener('click',()=> {
          btns.querySelectorAll('.att-btn').forEach(x=>{x.style.background='';x.style.color='var(--dark)';});
          b.style.background=colors[code]; b.style.color='#fff';
        });
        btns.append(b);
      });
      attList.append(row,btns);
    });
    saveAtt.classList.remove('hidden');
  });

  saveAtt.addEventListener('click', e=>{
    e.preventDefault();
    const d = dateInput.value;
    attendanceData[d]={};
    attList.querySelectorAll('.attendance-actions').forEach((btns,i)=>{
      const sel=btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll]= sel? sel.dataset.code:'A';
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    attSection.classList.add('hidden');
    resSection.classList.remove('hidden');
    summaryBody.innerHTML = '';
    summaryBody.insertAdjacentHTML('beforebegin',
      `<tr><td colspan="3"><em>
        Date: ${d} | School: ${localStorage.getItem('schoolName')} |
        Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}
      </em></td></tr>`);
    students.forEach(s=>{
      const code = attendanceData[d][s.roll]||'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').addEventListener('click',()=>{
        const msg=`Date: ${d}\nName: ${s.name}\nStatus: ${status}`;
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`,'_blank');
      });
      summaryBody.appendChild(tr);
    });
  });

  resetAtt.addEventListener('click', e=>{
    e.preventDefault();
    resSection.classList.add('hidden');
    attSection.classList.remove('hidden');
    attList.innerHTML=''; saveAtt.classList.add('hidden'); summaryBody.innerHTML='';
  });

  shareAtt.addEventListener('click',e=>{
    e.preventDefault();
    const d=dateInput.value;
    const hdr=`Date: ${d} | School: ${localStorage.getItem('schoolName')}`;
    const remap={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'};
    const lines=students.map(s=>`${s.name}: ${remap[attendanceData[d]?.[s.roll]||'A']}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines)}`,'_blank');
  });

  downloadAtt.addEventListener('click', e=>{
    e.preventDefault();
    const { jsPDF }=window.jspdf;
    const doc=new jsPDF('p','pt','a4');
    doc.autoTable({ head:[['Name','Status']], body: students.map(s=>{
      const code=attendanceData[dateInput.value]?.[s.roll]||'A';
      return [s.name,{P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]];
    }), startY:40, margin:{left:40,right:40}, styles:{fontSize:10} });
    doc.save('attendance_summary.pdf');
  });


  // ---------------- ANALYTICS ----------------
  const typeSel    = $('analyticsType'),
        datePick   = $('analyticsDate'),
        monthPick  = $('analyticsMonth'),
        semStart   = $('semesterStart'),
        semEnd     = $('semesterEnd'),
        yearPick   = $('yearStart'),
        loadBtn    = $('loadAnalytics'),
        resetBtn   = $('resetAnalytics'),
        instr      = $('instructions'),
        graphWrap  = $('graphs'),
        actionsDiv = $('analyticsActions'),
        barCtx     = $('barChart').getContext('2d'),
        pieCtx     = $('pieChart').getContext('2d'),
        shareAnal  = $('shareAnalytics'),
        downloadAnal = $('downloadAnalytics');
  let analyticsCounts = {};

  function getPeriodText() {
    if (typeSel.value==='date') return `Date: ${datePick.value}`;
    if (typeSel.value==='month') return `Month: ${monthPick.value}`;
    if (typeSel.value==='semester') return `Semester: ${semStart.value} to ${semEnd.value}`;
    if (typeSel.value==='year') return `Year: ${yearPick.value}`;
    return '';
  }

  typeSel.addEventListener('change',()=>{
    [datePick,monthPick,semStart,semEnd,yearPick].forEach(el=>el.classList.add('hidden'));
    if (typeSel.value==='date') datePick.classList.remove('hidden');
    if (typeSel.value==='month') monthPick.classList.remove('hidden');
    if (typeSel.value==='semester') { semStart.classList.remove('hidden'); semEnd.classList.remove('hidden'); }
    if (typeSel.value==='year') yearPick.classList.remove('hidden');
  });

  loadBtn.addEventListener('click',e=>{
    e.preventDefault();
    if (!typeSel.value) return alert('Select period');
    let dates = [];
    if (typeSel.value==='date') {
      if (!datePick.value) return alert('Pick date');
      dates=[datePick.value];
    }
    else if (typeSel.value==='month') {
      if (!monthPick.value) return alert('Pick month');
      const [y,m]=monthPick.value.split('-').map(Number), last=new Date(y,m,0).getDate();
      for(let d=1;d<=last;d++) dates.push(`${monthPick.value}-${String(d).padStart(2,'0')}`);
    }
    else if (typeSel.value==='semester') {
      if (!semStart.value||!semEnd.value) return alert('Pick semester');
      let start=new Date(semStart.value+'-01'), end=new Date(semEnd.value+'-01');
      for(let dt=new Date(start);dt<=end;dt.setMonth(dt.getMonth()+1)) {
        const ym=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`,
              last=new Date(dt.getFullYear(),dt.getMonth()+1,0).getDate();
        for(let d=1;d<=last;d++) dates.push(`${ym}-${String(d).padStart(2,'0')}`);
      }
    }
    else if (typeSel.value==='year') {
      if (!yearPick.value) return alert('Pick year');
      const yr=Number(yearPick.value);
      for(let m=1;m<=12;m++){
        const ym=`${yr}-${String(m).padStart(2,'0')}`, last=new Date(yr,m,0).getDate();
        for(let d=1;d<=last;d++) dates.push(`${ym}-${String(d).padStart(2,'0')}`);
      }
    }
    const counts={P:0,A:0,Lt:0,HD:0,L:0};
    dates.forEach(d=>Object.values(attendanceData[d]||{}).forEach(c=>counts[c]++));
    analyticsCounts = counts;
    instr.classList.add('hidden');
    graphWrap.classList.remove('hidden');
    actionsDiv.classList.remove('hidden');
    shareAnal.classList.remove('hidden');
    downloadAnal.classList.remove('hidden');
    new Chart(barCtx,{type:'bar',data:{labels:Object.keys(counts),datasets:[{label:'Count',data:Object.values(counts)}]}});
    new Chart(pieCtx,{type:'pie',data:{labels:Object.keys(counts),datasets:[{data:Object.values(counts)}]}});
  });

  resetBtn.addEventListener('click',e=>{
    e.preventDefault();
    typeSel.value='';
    [datePick,monthPick,semStart,semEnd,yearPick].forEach(el=>el.classList.add('hidden'));
    graphWrap.classList.add('hidden');
    actionsDiv.classList.add('hidden');
    shareAnal.classList.add('hidden');
    downloadAnal.classList.add('hidden');
    instr.classList.remove('hidden');
  });

  shareAnal.addEventListener('click', e => {
    e.preventDefault();
    const period = getPeriodText();
    const lines = Object.entries(analyticsCounts)
      .map(([k,v]) => `*${k}*: ${v}`)
      .join('\n');
    const msg = `${period}\n${lines}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  });

  downloadAnal.addEventListener('click', e => {
    e.preventDefault();
    const period = getPeriodText();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    doc.text(period, 40, 40);
    doc.autoTable({
      head: [['Status','Count']],
      body: Object.entries(analyticsCounts),
      startY: 60,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 10 }
    });
    doc.save('analytics_report.pdf');
  });


  // ------------ TRADITIONAL REGISTER ------------
  const loadReg    = $('loadRegister'),
        resetReg   = $('resetRegister'),
        monthReg   = $('registerMonth'),
        wrapReg    = $('registerWrapper'),
        tableReg   = $('registerTable'),
        sumReg     = $('registerSummary'),
        sumBody    = document.querySelector('#registerSummaryTable tbody'),
        shareTrad  = $('shareRegister'),
        downloadTrad = $('downloadRegisterPDF');

  loadReg.addEventListener('click',e=>{
    e.preventDefault();
    if (!monthReg.value) return alert('Pick month');
    const [y,m]=monthReg.value.split('-').map(Number), last=new Date(y,m,0).getDate();
    let html=`<thead><tr><th>Sr#</th><th>Adm#</th><th>Name</th>`;
    for(let d=1;d<=last;d++) html+=`<th>${d}</th>`;
    html+='</tr></thead><tbody>';
    sumBody.innerHTML = '';
    students.forEach((s,i)=>{
      let p=0,a=0,lt=0,hd=0,l=0;
      html+=`<tr><td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=last;d++){
        const key=`${monthReg.value}-${String(d).padStart(2,'0')}`;
        const c=(attendanceData[key]||{})[s.roll]||'A';
        html+=`<td>${c}</td>`;
        if(c==='P')p++; if(c==='A')a++; if(c==='Lt')lt++; if(c==='HD')hd++; if(c==='L')l++;
      }
      html+='</tr>';
      sumBody.insertAdjacentHTML('beforeend',
        `<tr><td>${s.name}</td><td>${p}</td><td>${a}</td><td>${lt}</td><td>${hd}</td><td>${l}</td>
         <td>${p+a+lt+hd+l}</td><td>${((p/(p+a+lt+hd+l))*100).toFixed(1)}%</td></tr>`);
    });
    html+='</tbody>';
    tableReg.innerHTML=html;
    wrapReg.classList.remove('hidden');
    sumReg.classList.remove('hidden');
    resetReg.classList.remove('hidden');
    shareTrad.classList.remove('hidden');
    downloadTrad.classList.remove('hidden');
  });

  resetReg.addEventListener('click',e=>{
    e.preventDefault();
    tableReg.innerHTML=''; sumBody.innerHTML='';
    wrapReg.classList.add('hidden');
    sumReg.classList.add('hidden');
    resetReg.classList.add('hidden');
    shareTrad.classList.add('hidden');
    downloadTrad.classList.add('hidden');
    monthReg.value='';
  });

  shareTrad.addEventListener('click', e => {
    e.preventDefault();
    const lines = Array.from(sumBody.querySelectorAll('tr')).map(tr => {
      const cells = tr.children;
      return `${cells[0].textContent}: P=${cells[1].textContent}, A=${cells[2].textContent}, Lt=${cells[3].textContent}, HD=${cells[4].textContent}, L=${cells[5].textContent}, Total=${cells[6].textContent}, %=${cells[7].textContent}`;
    }).join('\n');
    const msg = `Month: ${monthReg.value}\n${lines}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  });

  downloadTrad.addEventListener('click', e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    doc.text(`Register Summary - ${monthReg.value}`, 40, 40);
    const head = [['Name','P','A','Lt','HD','L','Total','%']];
    const body = Array.from(sumBody.querySelectorAll('tr'))
      .map(tr => Array.from(tr.children).map(td => td.textContent));
    doc.autoTable({ head, body, startY: 60, margin:{left:40,right:40}, styles:{fontSize:10} });
    doc.save('traditional_register_summary.pdf');
  });

});
