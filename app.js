// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- IndexedDB helpers ---
  const { get, set } = window.idbKeyval;
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;

  const saveStudents       = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);
  const saveLastAdmNo      = () => set('lastAdmissionNo', lastAdmNo);

  async function generateAdmNo() {
    lastAdmNo++;
    await saveLastAdmNo();
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- DOM helpers ---
  const $ = id => document.getElementById(id);
  function show(el){ el.classList.remove('hidden'); }
  function hide(el){ el.classList.add('hidden'); }

  // --- SETUP ---
  async function loadSetup(){
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if(school && cls && sec){
      $('schoolNameInput').value      = school;
      $('teacherClassSelect').value   = cls;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent      = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderStudents();
      updateCounters();
    }
  }
  $('saveSetup').onclick = async e=>{
    e.preventDefault();
    const school = $('schoolNameInput').value.trim(),
          cls    = $('teacherClassSelect').value,
          sec    = $('teacherSectionSelect').value;
    if(!school||!cls||!sec) return alert('Complete setup');
    await set('schoolName', school);
    await set('teacherClass', cls);
    await set('teacherSection', sec);
    await loadSetup();
  };
  $('editSetup').onclick = e=>{
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };
  await loadSetup();

  // --- COUNTERS ---
  function animateCounters(){
    document.querySelectorAll('.number').forEach(span=>{
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target/100);
      (function update(){
        count += step;
        span.textContent = count<target ? Math.ceil(count): target;
        if(count<target) requestAnimationFrame(update);
      })();
    });
  }
  function updateCounters(){
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value;
    const secCount = students.filter(s=>s.cls===cls&&s.sec===sec).length;
    $('sectionCount').dataset.target = secCount;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cls).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  $('teacherClassSelect').onchange   = ()=>{ renderStudents(); updateCounters(); };
  $('teacherSectionSelect').onchange = ()=>{ renderStudents(); updateCounters(); };

  // --- STUDENT REGISTRATION ---
  function renderStudents(){
    const cls = $('teacherClassSelect').value,
          sec = $('teacherSectionSelect').value,
          tbody = $('studentsBody');
    tbody.innerHTML = '';
    students.filter(s=>s.cls===cls&&s.sec===sec)
      .forEach((stu,i)=>{
        const tr = document.createElement('tr');
        tr.dataset.index = i;
        tr.innerHTML = `
          <td><input type="checkbox" class="sel"></td>
          <td>${i+1}</td>
          <td>${stu.name}</td>
          <td>${stu.adm}</td>
          <td>${stu.parent}</td>
          <td>${stu.contact}</td>
          <td>${stu.occupation}</td>
          <td>${stu.address}</td>
        `;
        tbody.appendChild(tr);
      });
    $('selectAllStudents').checked = false;
    toggleEditDelete();
  }
  $('addStudent').onclick = async e=>{
    e.preventDefault();
    const name       = $('studentName').value.trim(),
          parent     = $('parentName').value.trim(),
          contact    = $('parentContact').value.trim(),
          occupation = $('parentOccupation').value.trim(),
          address    = $('parentAddress').value.trim(),
          cls        = $('teacherClassSelect').value,
          sec        = $('teacherSectionSelect').value;
    if(!name||!parent||!contact||!occupation||!address)
      return alert('All fields required');
    if(!/^\d{7,15}$/.test(contact))
      return alert('Contact must be 7–15 digits');
    const adm = await generateAdmNo();
    students.push({ name, adm, parent, contact, occupation, address, cls, sec });
    renderStudents();
  };
  function toggleEditDelete(){
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled   = !any;
    $('deleteSelected').disabled = !any;
  }
  $('studentsBody').addEventListener('change',e=>{
    if(e.target.classList.contains('sel')) toggleEditDelete();
  });
  $('selectAllStudents').onclick = ()=>{
    document.querySelectorAll('.sel').forEach(cb=>cb.checked=$('selectAllStudents').checked);
    toggleEditDelete();
  };
  $('saveRegistration').onclick = async ()=>{
    await saveStudents();
    hide($('editSelected')); hide($('deleteSelected'));
    hide($('selectAllStudents')); hide($('saveRegistration'));
    show($('shareRegistration')); show($('editRegistration'));
    show($('downloadRegistrationPDF'));
  };
  $('downloadRegistrationPDF').onclick = ()=>{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html:'#studentsTable' });
    doc.save('registration.pdf');
  };
  $('shareRegistration').onclick = ()=>{
    const cls = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const hdr = `*Students List* Class:${cls} Section:${sec}`;
    const lines = students.filter(s=>s.cls===cls&&s.sec===sec).map(s=>`${s.adm}: ${s.name}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`,'_blank');
  };
  $('editRegistration').onclick = e=>{
    e.preventDefault();
    show($('editSelected')); show($('deleteSelected'));
    show($('selectAllStudents')); show($('saveRegistration'));
    hide($('shareRegistration')); hide($('editRegistration'));
    hide($('downloadRegistrationPDF'));
  };
  $('deleteSelected').onclick = e=>{
    e.preventDefault();
    if(!confirm('Delete selected?')) return;
    students = students.filter((_,i)=>
      !Array.from(document.querySelectorAll('.sel')).some(cb=>cb.checked && +cb.closest('tr').dataset.index===i)
    );
    renderStudents();
  };

  // --- ATTENDANCE SECTION ---
  $('loadAttendance').onclick = ()=>{
    const tbody = $('attendanceBody');
    tbody.innerHTML = '';
    students.forEach(stu=>{
      const tr = document.createElement('tr');
      tr.dataset.roll = stu.roll;
      tr.innerHTML = `
        <td>${stu.name}</td>
        <td><select class="statusSelect">
          <option value="P">Present</option>
          <option value="A">Absent</option>
          <option value="Lt">Late</option>
          <option value="HD">Half Day</option>
          <option value="L">Leave</option>
        </select></td>`;
      tbody.appendChild(tr);
    });
    show($('saveAttendance'));
  };
  $('saveAttendance').onclick = async ()=>{
    const date = $('dateInput').value;
    if(!date) return alert('Pick date');
    attendanceData[date] = {};
    document.querySelectorAll('#attendanceBody tr').forEach(tr=>{
      attendanceData[date][tr.dataset.roll] = tr.querySelector('.statusSelect').value;
    });
    await saveAttendanceData();
    show($('shareAttendanceSummary')); show($('downloadAttendancePDF'));
  };
  $('downloadAttendancePDF').onclick = ()=>{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html:'#attendanceTable' });
    doc.save('attendance.pdf');
  };
  $('shareAttendanceSummary').onclick = ()=>{
    const date = $('dateInput').value;
    const hdr = `*Attendance* Date:${date}`;
    const lines = students.map(s=>`${s.name}: ${attendanceData[date]?.[s.roll]||'A'}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`,'_blank');
  };

  // --- ANALYTICS SECTION ---
  const analyticsTarget    = $('analyticsTarget');
  const analyticsSection   = $('analyticsSectionSelect');
  const analyticsFilter    = $('analyticsFilter');
  const analyticsStudent   = $('analyticsStudentInput');
  const analyticsType      = $('analyticsType');
  const analyticsDate      = $('analyticsDate');
  const analyticsMonth     = $('analyticsMonth');
  const semesterStart      = $('semesterStart');
  const semesterEnd        = $('semesterEnd');
  const yearStart          = $('yearStart');
  const loadAnalyticsBtn   = $('loadAnalytics');
  const resetAnalyticsBtn  = $('resetAnalytics');
  const instructionsEl     = $('instructions');
  const analyticsContainer = $('analyticsContainer');
  const graphsEl           = $('graphs');
  const analyticsActions   = $('analyticsActions');
  const shareAnalyticsBtn  = $('shareAnalytics');
  const downloadAnalyticsBtn = $('downloadAnalytics');
  const barCtx = $('barChart').getContext('2d');
  const pieCtx = $('pieChart').getContext('2d');
  let chartBar, chartPie;

  analyticsTarget.onchange = ()=>{
    analyticsType.disabled = false;
    hide(analyticsSection); hide($('labelSection'));
    hide(analyticsFilter); hide($('labelFilter'));
    hide(analyticsStudent);
    hide(instructionsEl); hide(analyticsContainer);
    hide(graphsEl); hide(analyticsActions); hide(resetAnalyticsBtn);
    if(analyticsTarget.value==='section'){
      show($('labelSection')); show(analyticsSection);
    }
    if(analyticsTarget.value==='student'){
      show($('labelFilter')); show(analyticsFilter);
    }
  };
  analyticsFilter.onchange = ()=>{
    analyticsStudent.innerHTML = '<option disabled selected>-- Pick --</option>'
      + students.map(s=>`<option value="${s.roll}">${s.name} (${s.adm})</option>`).join('');
    show(analyticsStudent);
  };
  analyticsType.onchange = ()=>{
    [analyticsDate,analyticsMonth,semesterStart,semesterEnd,yearStart].forEach(hide);
    hide(analyticsContainer); hide(graphsEl); hide(analyticsActions);
    show(resetAnalyticsBtn);
    if(analyticsType.value==='date') show(analyticsDate);
    if(analyticsType.value==='month') show(analyticsMonth);
    if(analyticsType.value==='semester'){ show(semesterStart); show(semesterEnd); }
    if(analyticsType.value==='year') show(yearStart);
  };
  resetAnalyticsBtn.onclick = e=>{
    e.preventDefault();
    hide(analyticsContainer); hide(graphsEl); hide(analyticsActions);
    [analyticsDate,analyticsMonth,semesterStart,semesterEnd,yearStart].forEach(hide);
    analyticsType.value = '';
  };
  loadAnalyticsBtn.onclick = ()=>{
    const tgt = analyticsTarget.value;
    const typ = analyticsType.value;
    let from,to;
    if(typ==='date'){ from=to=analyticsDate.value; }
    else if(typ==='month'){
      const [y,m]=analyticsMonth.value.split('-').map(Number);
      from=`${analyticsMonth.value}-01`;
      to=`${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    }
    else if(typ==='semester'){
      const [sy,sm]=semesterStart.value.split('-').map(Number);
      const [ey,em]=semesterEnd.value.split('-').map(Number);
      from=`${semesterStart.value}-01`;
      to=`${semesterEnd.value}-${new Date(ey,em,0).getDate()}`;
    }
    else if(typ==='year'){ from=`${yearStart.value}-01-01`; to=`${yearStart.value}-12-31`; }
    else return alert('Select period');

    let pool=students.slice();
    if(tgt==='section') pool=pool.filter(s=>s.sec===analyticsSection.value);
    if(tgt==='student') pool=pool.filter(s=>String(s.roll)===analyticsStudent.value);

    const stats = pool.map(s=>({ name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      if(d<from||d>to) return;
      stats.forEach(st=>{
        const c=recs[st.roll]||'A';
        st[c]++; st.total++;
      });
    });

    // build summary table
    const thead = $('analyticsTable').querySelector('thead tr');
    thead.innerHTML = '<th>Sr#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th>';
    const tbody = $('analyticsBody');
    tbody.innerHTML = '';
    stats.forEach((st,i)=>{
      const pct = st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td>`
                   + `<td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${pct}%</td>`;
      tbody.appendChild(tr);
    });

    instructionsEl.textContent = `Period: ${from} to ${to}`;
    show(instructionsEl); show(analyticsContainer);
    show(graphsEl); show(analyticsActions); show(resetAnalyticsBtn);

    // render charts
    const labels = stats.map(s=>s.name);
    const dataPct = stats.map(s=>s.total? s.P/s.total*100:0);
    chartBar?.destroy();
    chartBar = new Chart(barCtx,{ type:'bar', data:{ labels, datasets:[{ label:'% Present', data:dataPct }]}, options:{ scales:{ y:{ beginAtZero:true, max:100 }}}});
    const agg = stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    chartPie?.destroy();
    chartPie = new Chart(pieCtx,{ type:'pie', data:{ labels:['P','A','Lt','HD','L'], datasets:[{ data:Object.values(agg) }]}});
  };
  shareAnalyticsBtn.onclick = ()=>{
    const hdr=instructionsEl.textContent;
    const rows=Array.from($('analyticsBody').children).map(tr=>tr.textContent.trim());
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`,'_blank');
  };
  downloadAnalyticsBtn.onclick = ()=>{
    const { jsPDF } = window.jspdf;
    const doc=new jsPDF();
    doc.autoTable({ html:'#analyticsTable' });
    doc.save('analytics.pdf');
  };

  // --- ATTENDANCE REGISTER ---
  $('loadRegister').onclick = ()=>{
    const m=$('registerMonth').value;
    if(!m) return alert('Pick month');
    const [y,mm]=m.split('-').map(Number);
    const days=new Date(y,mm,0).getDate();
    const head=$('registerTable thead tr');
    head.innerHTML='<th>Sr#</th><th>Adm#</th><th>Name</th>'+
      Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    const tb=$('registerBody'); tb.innerHTML='';
    students.forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`+
        Array.from({length:days},(_,d)=>{
          const k=`${m}-${String(d+1).padStart(2,'0')}`;
          return `<td>${attendanceData[k]?.[s.roll]||'A'}</td>`;
        }).join('');
      tb.appendChild(tr);
    });
    show($('registerTableWrapper'));
  };

});
