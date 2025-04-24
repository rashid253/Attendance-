// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P: '#4CAF50', A: '#f44336', Lt: '#FFEB3B', HD: '#FF9800', L: '#03a9f4' };

  // 1. SETUP
  const schoolIn = $('schoolNameInput');
  const classSel = $('teacherClassSelect');
  const secSel = $('teacherSectionSelect');
  const saveSetup = $('saveSetup');
  const setupForm = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText = $('setupText');
  const editSetup = $('editSetup');

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
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetup.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value)
      return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };

  editSetup.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };

  loadSetup();

  // 2. STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const studentNameIn    = $('studentName');
  const admissionNoIn    = $('admissionNo');
  const parentNameIn     = $('parentName');
  const parentContactIn  = $('parentContact');
  const parentOccIn      = $('parentOccupation');
  const parentAddrIn     = $('parentAddress');
  const addStudentBtn    = $('addStudent');
  const studentsBody     = $('studentsBody');
  const selectAll        = $('selectAllStudents');
  const editSelBtn       = $('editSelected');
  const deleteSelBtn     = $('deleteSelected');
  const saveRegBtn       = $('saveRegistration');
  const shareRegBtn      = $('shareRegistration');
  const editRegBtn       = $('editRegistration');
  const downloadRegBtn   = $('downloadRegistrationPDF');
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
        editSelBtn.disabled = deleteSelBtn.disabled = !any;
      };
    });
    selectAll.disabled = regSaved;
    selectAll.onchange = () => {
      if (!regSaved) boxes.forEach(cb => {
        cb.checked = selectAll.checked;
        cb.dispatchEvent(new Event('change'));
      });
    };
  }

  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved ? 'disabled' : ''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
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
    bindSelection();
  }

  addStudentBtn.onclick = ev => {
    ev.preventDefault();
    const name    = studentNameIn.value.trim();
    const adm     = admissionNoIn.value.trim();
    const parent  = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occ     = parentOccIn.value.trim();
    const addr    = parentAddrIn.value.trim();
    if (!name || !adm || !parent || !contact || !occ || !addr)
      return alert('All fields required');
    if (!/^\d+$/.test(adm)) return alert('Adm# must be numeric');
    if (students.some(s => s.adm === adm))
      return alert(`Admission# ${adm} already exists`);
    if (!/^\d{7,15}$/.test(contact))
      return alert('Contact must be 7-15 digits');
    students.push({
      name, adm, parent, contact,
      occupation: occ, address: addr,
      roll: Date.now()
    });
    saveStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn].forEach(i => i.value = '');
  };

  function onCellBlur(e) {
    const td = e.target, tr = td.closest('tr');
    const idx = +tr.querySelector('.sel').dataset.index;
    const ci  = Array.from(tr.children).indexOf(td);
    const keys = ['name','adm','parent','contact','occupation','address'];
    const val = td.textContent.trim();
    if (ci === 2) {
      if (!/^\d+$/.test(val)) { alert('Adm# must be numeric'); renderStudents(); return; }
      if (students.some((s,i2) => s.adm===val && i2!==idx)) {
        alert('Duplicate Adm# not allowed'); renderStudents(); return;
      }
    }
    if (ci>=1 && ci<=6) {
      students[idx][keys[ci-1]] = val;
      saveStudents();
    }
  }

  editSelBtn.onclick = ev => {
    ev.preventDefault();
    const sel = Array.from(document.querySelectorAll('.sel:checked'));
    if (!sel.length) return;
    inlineEdit = !inlineEdit;
    editSelBtn.textContent = inlineEdit ? 'Done Editing' : 'Edit Selected';
    sel.forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td,ci) => {
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit
            ? td.addEventListener('blur', onCellBlur)
            : td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  deleteSelBtn.onclick = ev => {
    ev.preventDefault();
    if (!confirm('Delete selected?')) return;
    Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb => +cb.dataset.index)
      .sort((a,b) => b-a)
      .forEach(i => students.splice(i,1));
    saveStudents(); renderStudents(); selectAll.checked = false;
  };

  saveRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegBtn.classList.remove('hidden');
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  editRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegBtn.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick = ev => {
    ev.preventDefault();
    const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s =>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines)}`, '_blank');
  };

  downloadRegBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Student Registration', 10, 10);
    doc.setFontSize(12);
    const currentDate = new Date().toLocaleDateString();
    doc.text(`Date: ${currentDate}`,10,20);
    doc.text(`School: ${localStorage.getItem('schoolName')}`,10,26);
    doc.text(`Class: ${localStorage.getItem('teacherClass')}`,10,32);
    doc.text(`Section: ${localStorage.getItem('teacherSection')}`,10,38);
    doc.autoTable({
      head: [['Name','Adm#','Parent','Contact','Occupation','Address']],
      body: students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY:44
    });
    alert('PDF generation complete. Starting download...');
    doc.save('student_registration.pdf');
  };

  renderStudents();

  // 3. ATTENDANCE MARKING
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');
  const dateInput   = $('dateInput');
  const loadAtt     = $('loadAttendance');
  const attList     = $('attendanceList');
  const saveAtt     = $('saveAttendance');
  const resultSection = $('attendance-result');
  const summaryBody   = $('summaryBody');

  loadAtt.onclick = ev => {
    ev.preventDefault();
    if (!dateInput.value) return alert('Pick a date');
    attList.innerHTML = '';
    students.forEach(s => {
      const row = document.createElement('div');
      row.className='attendance-item'; row.textContent=s.name;
      const btns=document.createElement('div'); btns.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button');
        b.textContent=code; b.className='att-btn'; b.dataset.code=code;
        if(attendanceData[dateInput.value]?.[s.roll]===code){
          b.style.background=colors[code]; b.style.color='#fff';
        }
        b.onclick=e2=>{
          btns.querySelectorAll('.att-btn').forEach(x=>{ x.style.background=''; x.style.color='#333'; });
          b.style.background=colors[code]; b.style.color='#fff';
        };
        btns.append(b);
      });
      attList.append(row,btns);
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick = ev=>{
    ev.preventDefault();
    const d=dateInput.value;
    attendanceData[d]={};
    attList.querySelectorAll('.attendance-actions').forEach((btns,i)=>{
      const sel=btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll]=sel?sel.dataset.code:'A';
    });
    localStorage.setItem('attendanceData',JSON.stringify(attendanceData));
    $('attendance-section').classList.add('hidden');
    resultSection.classList.remove('hidden');
    summaryBody.innerHTML='';
    const hdr=`Date: ${d}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    summaryBody.insertAdjacentHTML('beforebegin',`<tr><td colspan="3"><em>${hdr}</em></td></tr>`);
    students.forEach(s=>{
      const code=attendanceData[d][s.roll]||'A';
      const status={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick=e2=>{
        const msg=`${hdr}\n\nName: ${s.name}\nStatus: ${status}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  // 4. ANALYTICS
  const analyticsTarget    = $('analyticsTarget');
  const studentAdmInput    = $('studentAdmInput');
  const analyticsType      = $('analyticsType');
  const analyticsDate      = $('analyticsDate');
  const analyticsMonth     = $('analyticsMonth');
  const semesterStartInput = $('semesterStart');
  const semesterEndInput   = $('semesterEnd');
  const yearStart          = $('yearStart');
  const loadAnalyticsBtn   = $('loadAnalytics');
  const resetAnalyticsBtn  = $('resetAnalytics');
  const instructionsEl     = $('instructions');
  const analyticsContainer = $('analyticsContainer');
  const graphsEl           = $('graphs');
  const shareAnalyticsBtn  = $('shareAnalytics');
  const downloadAnalyticsBtn = $('downloadAnalytics');
  let barChart, pieChart;

  function hideAllAnalytics() {
    [analyticsDate, analyticsMonth, semesterStartInput, semesterEndInput, yearStart,
     instructionsEl, analyticsContainer, graphsEl, resetAnalyticsBtn].forEach(el => el.classList.add('hidden'));
  }

  analyticsTarget.onchange = () => {
    studentAdmInput.classList.toggle('hidden', analyticsTarget.value!=='student');
    hideAllAnalytics();
    analyticsType.value = '';
  };

  analyticsType.onchange = () => {
    hideAllAnalytics();
    if (analyticsType.value === 'date') analyticsDate.classList.remove('hidden');
    if (analyticsType.value === 'month') analyticsMonth.classList.remove('hidden');
    if (analyticsType.value === 'semester') {
      semesterStartInput.classList.remove('hidden');
      semesterEndInput.classList.remove('hidden');
    }
    if (analyticsType.value === 'year') yearStart.classList.remove('hidden');
    resetAnalyticsBtn.classList.remove('hidden');
  };

  resetAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    hideAllAnalytics();
    analyticsType.value = '';
  };

  loadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    let from, to;
    if (analyticsType.value === 'date') {
      if (!analyticsDate.value) return alert('Pick a date');
      from = to = analyticsDate.value;
    } else if (analyticsType.value === 'month') {
      if (!analyticsMonth.value) return alert('Pick a month');
      const [y,m] = analyticsMonth.value.split('-').map(Number);
      from = `${analyticsMonth.value}-01`;
      to   = `${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (analyticsType.value === 'semester') {
      if (!semesterStartInput.value || !semesterEndInput.value) return alert('Pick semester range');
      from = `${semesterStartInput.value}-01`;
      const [ey,em] = semesterEndInput.value.split('-').map(Number);
      to   = `${semesterEndInput.value}-${new Date(ey,em,0).getDate()}`;
    } else if (analyticsType.value === 'year') {
      if (!yearStart.value) return alert('Pick year');
      from = `${yearStart.value}-01-01`;
      to   = `${yearStart.value}-12-31`;
    } else {
      return alert('Select period');
    }

    let stats = [];
    if (analyticsTarget.value === 'student') {
      const adm = studentAdmInput.value.trim();
      if (!adm) return alert('Enter Admission #');
      const stu = students.find(s=>s.adm===adm);
      if (!stu) return alert(`No student with Admission# ${adm}`);
      stats = [{ name: stu.name, roll: stu.roll, P:0,A:0,Lt:0,HD:0,L:0,total:0 }];
    } else {
      stats = students.map(s=>({ name:s.name, roll:s.roll, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    }

    const fromDate=new Date(from), toDate=new Date(to);
    Object.entries(attendanceData).forEach(([d,recs])=>{
      const cur=new Date(d);
      if (cur>=fromDate && cur<=toDate) {
        stats.forEach(st=>{
          const code = recs[st.roll]||'A';
          st[code]++; st.total++;
        });
      }
    });

    let html='<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s=>{
      const pct = s.total?((s.P/s.total)*100).toFixed(1):'0.0';
      html+=`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
    });
    html+='</tbody></table>';
    analyticsContainer.innerHTML=html;
    analyticsContainer.classList.remove('hidden');

    if (analyticsTarget.value==='student') {
      instructionsEl.textContent=`Admission#: ${studentAdmInput.value.trim()} | Report: ${from} to ${to}`;
    } else {
      instructionsEl.textContent=`Report: ${from} to ${to}`;
    }
    instructionsEl.classList.remove('hidden');

    const labels = stats.map(s=>s.name);
    const dataPct = stats.map(s=> s.total? (s.P/s.total)*100 : 0 );
    if (barChart) barChart.destroy();
    barChart = new Chart($('barChart').getContext('2d'),{
      type:'bar',
      data:{ labels, datasets:[{ label:'% Present', data:dataPct }]},
      options:{ responsive:true, scales:{ y:{ beginAtZero:true, max:100 } } }
    });

    const agg = stats.reduce((a,s)=>{
      ['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);
      return a;
    },{ P:0,A:0,Lt:0,HD:0,L:0 });
    if (pieChart) pieChart.destroy();
    pieChart = new Chart($('pieChart').getContext('2d'),{
      type:'pie',
      data:{ labels:['Present','Absent','Late','Half Day','Leave'], datasets:[{ data: Object.values(agg) }]},
      options:{ responsive:true }
    });

    graphsEl.classList.remove('hidden');
  };

  // 5. ATTENDANCE REGISTER
  const regMonthIn    = $('registerMonth');
  const loadReg      = $('loadRegister');
  const changeReg    = $('changeRegister');
  const regTableWrapper = $('registerTableWrapper');
  const regBody      = $('registerBody');
  const regSummarySec= $('registerSummarySection');
  const regSummaryBody= $('registerSummaryBody');

  function generateRegisterHeader(daysInMonth) {
    const headerRow = document.querySelector('#registerTable thead tr');
    headerRow.innerHTML = `<th>Sr#</th><th>Adm#</th><th>Name</th>`;
    for (let d=1; d<=daysInMonth; d++) {
      headerRow.innerHTML += `<th>${d}</th>`;
    }
  }

  loadReg.onclick = e => {
    e.preventDefault();
    if (!regMonthIn.value) return alert('Select month');
    const [y,m]=regMonthIn.value.split('-').map(Number);
    const daysInMonth=new Date(y,m,0).getDate();
    generateRegisterHeader(daysInMonth);
    regBody.innerHTML=''; regSummaryBody.innerHTML='';

    students.forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let day=1; day<=daysInMonth; day++){
        const dateStr=`${regMonthIn.value}-${String(day).padStart(2,'0')}`;
        const code=(attendanceData[dateStr]||{})[s.roll]||'A';
        const td=document.createElement('td');
        td.textContent=code; td.style.background=colors[code]; td.style.color='#fff';
        tr.appendChild(td);
      }
      regBody.appendChild(tr);
    });

    students.forEach(s=>{
      const st={P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for(let d=1; d<=daysInMonth; d++){
        const dateStr=`${regMonthIn.value}-${String(d).padStart(2,'0')}`;
        const code=(attendanceData[dateStr]||{})[s.roll]||'A';
        st[code]++; st.total++;
      }
      const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${pct}</td>`;
      regSummaryBody.appendChild(tr);
    });

    regTableWrapper.classList.remove('hidden');
    regSummarySec.classList.remove('hidden');
    loadReg.classList.add('hidden');
    changeReg.classList.remove('hidden');
  };

  changeReg.onclick = e => {
    e.preventDefault();
    regTableWrapper.classList.add('hidden');
    regSummarySec.classList.add('hidden');
    loadReg.classList.remove('hidden');
    changeReg.classList.add('hidden');
  };

  // Service Worker registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('service-worker.js')
        .then(reg => console.log('ServiceWorker registered:', reg.scope))
        .catch(err => console.error('ServiceWorker registration failed:', err));
    });
  }
});
