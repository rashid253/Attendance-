// app.js
window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const { get, set } = window.idbKeyval;
  let students = await get('students') || [];
  let attendanceData = await get('attendanceData') || {};
  let pieChart;

  // Helpers
  function saveStudents() { return set('students', students); }
  function saveAttendance() { return set('attendanceData', attendanceData); }
  function getClassSection() {
    return { cls: $('teacherClassSelect')?.value, sec: $('teacherSectionSelect')?.value };
  }
  function filteredStudents() {
    const { cls, sec } = getClassSection(); 
    return students.filter(s => s.cls===cls && s.sec===sec);
  }
  function updateTotals() {
    $('totalSchoolCount').textContent = students.length;
    $('totalClassCount').textContent = students.filter(s=>s.cls=== $('teacherClassSelect')?.value).length;
    $('totalSectionCount').textContent = filteredStudents().length;
  }

  // Render Registration
  function renderStudents() {
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    filteredStudents().forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" data-index="${i}"></td>
        <td>${i+1}</td><td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>
        <td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td><td></td>
      `;
      tbody.appendChild(tr);
    });
    bindSelection();
    updateTotals();
  }

  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => cb.onchange = toggleActions);
    $('selectAllStudents')?.addEventListener('change', e => {
      boxes.forEach(cb => cb.checked = e.target.checked);
      toggleActions();
    });
  }
  function toggleActions() {
    const any = !!document.querySelectorAll('.sel:checked').length;
    $('editSelected').disabled = $('deleteSelected').disabled = !any;
  }

  // Add Student
  $('addStudent').onclick = async () => {
    const name = $('studentName').value.trim(),
          adm  = $('admissionNo').value.trim(),
          par  = $('parentName').value.trim(),
          cont = $('parentContact').value.trim(),
          occ  = $('parentOccupation').value.trim(),
          addr = $('parentAddress').value.trim();
    if (!name||!adm||!par||!cont||!occ||!addr) return alert('All fields required');
    if (students.some(s=>s.adm===adm && s.cls===getClassSection().cls && s.sec===getClassSection().sec))
      return alert('Duplicate Adm#');
    const { cls, sec } = getClassSection();
    students.push({ name, adm, parent:par, contact:cont, occupation:occ, address:addr, cls, sec });
    await saveStudents();
    renderStudents();
    ['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress']
      .forEach(id=>$(id).value='');
  };

  // Edit Selected
  $('editSelected').onclick = () => {
    if (!document.querySelectorAll('.sel:checked').length) return alert('Select a row');
    $('editSelected').textContent = 'Done';
    document.querySelectorAll('.sel:checked').forEach(cb => {
      const tr = cb.closest('tr');
      Array.from(tr.cells).slice(2,8).forEach(td => {
        td.contentEditable = true; td.classList.add('editing');
        td.onblur = async () => {
          const idx = +cb.dataset.index;
          const keys = ['name','adm','parent','contact','occupation','address'];
          students[idx][keys[td.cellIndex-2]] = td.textContent.trim();
          await saveStudents();
        };
      });
    });
    $('editSelected').onclick = async () => {
      Array.from(document.querySelectorAll('.sel:checked')).forEach(cb => {
        const tr = cb.closest('tr');
        Array.from(tr.cells).slice(2,8).forEach(td => {
          td.contentEditable = false; td.classList.remove('editing'); td.onblur = null;
        });
      });
      $('editSelected').textContent = 'Edit';
      $('editSelected').onclick = arguments.callee.__proto__; // restore
    };
  };

  // Delete Selected
  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected?')) return;
    const toDel = Array.from(document.querySelectorAll('.sel:checked'))
                       .map(cb=>+cb.dataset.index).sort((a,b)=>b-a);
    toDel.forEach(i=>students.splice(i,1));
    await saveStudents();
    renderStudents();
  };

  // Save Registration
  $('saveRegistration').onclick = () => {
    ['editSelected','deleteSelected','saveRegistration','selectAllStudents']
      .forEach(id=>$(id)?.classList.add('d-none'));
    ['editRegistration','shareRegistration','downloadRegistrationPDF']
      .forEach(id=>$(id)?.classList.remove('d-none'));
  };
  $('editRegistration').onclick = () => {
    ['editSelected','deleteSelected','saveRegistration','selectAllStudents']
      .forEach(id=>$(id)?.classList.remove('d-none'));
    ['editRegistration','shareRegistration','downloadRegistrationPDF']
      .forEach(id=>$(id)?.classList.add('d-none'));
  };
  $('shareRegistration').onclick = () => {
    const msg = filteredStudents().map(s=>`${s.name} (${s.adm})`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  };
  $('downloadRegistrationPDF').onclick = () => {
    if (!window.jspdf) return alert('PDF lib not loaded');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Student Registration',10,10);
    filteredStudents().forEach((s,i)=>doc.text(`${i+1}. ${s.name} (${s.adm})`,10,20+i*6));
    doc.save('registration.pdf');
  };

  // Mark Attendance
  $('loadAttendance').onclick = () => {
    const d = $('dateInput').value;
    if (!d) return alert('Pick a date');
    const list = $('attendanceList'); list.innerHTML='';
    filteredStudents().forEach(s=>{
      const wrapper = document.createElement('div');
      wrapper.className = 'd-flex align-items-center gap-2';
      wrapper.innerHTML = `<span>${s.name}</span>`;
      ['P','A','Lt','HD','L'].forEach(code=>{
        const btn = document.createElement('button');
        btn.type='button'; btn.className='btn btn-light btn-sm border';
        btn.textContent=code;
        btn.onclick = () => wrapper.querySelectorAll('button').forEach(b=>b.classList.remove('active')) & btn.classList.add('active');
        wrapper.appendChild(btn);
      });
      list.appendChild(wrapper);
    });
    $('saveAttendance').classList.remove('d-none');
  };
  $('saveAttendance').onclick = async () => {
    const d = $('dateInput').value; attendanceData[d]={};
    document.querySelectorAll('#attendanceList > div').forEach((row,i)=>{
      const s = filteredStudents()[i];
      const sel = row.querySelector('button.active')?.textContent || 'A';
      attendanceData[d][s.adm] = sel;
    });
    await saveAttendance();
    $('attendance-result').classList.remove('d-none');
    const body = $('summaryBody'); body.innerHTML=`<tr><td colspan="3"><em>Date: ${$('dateInput').value}</em></td></tr>`;
    filteredStudents().forEach(s=>{
      const code=attendanceData[$('dateInput').value][s.adm]||'A';
      const status={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      body.innerHTML+=`<tr><td>${s.name}</td><td>${status}</td><td><button class="btn btn-primary btn-sm">Send</button></td></tr>`;
    });
  };
  $('resetAttendance').onclick = () => {
    $('attendance-result').classList.add('d-none');
    $('attendanceList').innerHTML='';
    $('saveAttendance').classList.add('d-none');
  };
  $('shareAttendanceSummary').onclick = () => {
    const d=$('dateInput').value;
    const lines = filteredStudents().map(s=>{
      const code=attendanceData[d][s.adm]||'A';
      return `${s.name}: ${ {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code] }`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(`Date: ${d}\n`+lines)}`);
  };
  $('downloadAttendancePDF').onclick = () => {
    if (!window.jspdf) return alert('PDF lib missing');
    const d=$('dateInput').value, { jsPDF }=window.jspdf;
    const doc=new jsPDF(); doc.text('Attendance Summary',10,10);
    filteredStudents().forEach((s,i)=>doc.text(`${s.name}: ${(attendanceData[d][s.adm]||'A')}`,10,20+i*6));
    doc.save('attendance.pdf');
  };

  // Analytics
  function hideAnalytics() {
    ['studentAdmInput','analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart','instructions','analyticsContainer','graphs','analyticsActions2']
      .forEach(id=>$(id)?.classList.add('d-none'));
  }
  $('analyticsTarget').onchange = () => {
    const show = $('analyticsTarget').value==='student';
    $('studentAdmInput')?.classList.toggle('d-none',!show);
    $('analyticsType').value=''; hideAnalytics();
  };
  $('analyticsType').onchange = () => {
    hideAnalytics(); $('resetAnalytics').classList.remove('d-none');
    const t=$('analyticsType').value;
    if(t==='date') $('analyticsDate').classList.remove('d-none');
    if(t==='month') $('analyticsMonth').classList.remove('d-none');
    if(t==='semester') $('semesterStart','semesterEnd').forEach(id=>$(id)?.classList.remove('d-none'));
    if(t==='year') $('yearStart').classList.remove('d-none');
  };
  $('resetAnalytics').onclick = () => { $('analyticsType').value=''; hideAnalytics(); };
  $('loadAnalytics').onclick = () => {
    const t=$('analyticsType').value;
    let from,to; if(t==='date'){ from=to=$('analyticsDate').value; if(!from) return alert('Pick a date'); }
    else if(t==='month'){ const m=$('analyticsMonth').value; if(!m) return alert('Pick month'); const [y,mm]=m.split('-').map(Number);
      from=`${m}-01`; to=`${m}-${new Date(y,mm,0).getDate()}`;}
    else if(t==='semester'){ const s=$('semesterStart').value,e=$('semesterEnd').value; if(!s||!e) return alert('Pick semester');
      from=`${s}-01`; const [ey,em]=e.split('-').map(Number); to=`${e}-${new Date(ey,em,0).getDate()}`;}
    else if(t==='year'){ const y=$('yearStart').value; if(!y) return alert('Pick year'); from=`${y}-01-01`; to=`${y}-12-31`;}
    else return alert('Select type');
    $('instructions').textContent=`Period: ${from} → ${to}`; $('instructions').classList.remove('d-none');
    const stats=filteredStudents().map(s=>({name:s.name,P:0,A:0,Lt:0,HD:0,L:0}));
    Object.entries(attendanceData).forEach(([d,rec])=>{
      if(d>=from&&d<=to) stats.forEach(st=>{ const code=rec[filteredStudents().find(x=>x.name===st.name)?.adm]||'A'; st[code]++; });
    });
    const cont=$('analyticsContainer');
    cont.innerHTML='<ul class="list-group">' + stats.map(st=>`<li class="list-group-item">${st.name}: P:${st.P} A:${st.A} Lt:${st.Lt} HD:${st.HD} L:${st.L}</li>`).join('') + '</ul>';
    cont.classList.remove('d-none');
    const data=stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]); return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    $('graphs').classList.remove('d-none');
    pieChart?.destroy();
    pieChart=new Chart($('pieChart'),{type:'pie',data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(data)}]}}); 
    $('analyticsActions2').classList.remove('d-none');
    $('shareAnalytics').onclick = () => {
      const rows = stats.map(s=>`${s.name}: P:${s.P} A:${s.A} Lt:${s.Lt} HD:${s.HD} L:${s.L}`);
      window.open(`https://wa.me/?text=${encodeURIComponent($('instructions').textContent+'\n'+rows.join('\n'))}`);
    };
    $('downloadAnalytics').onclick = () => {
      if(!window.jspdf) return alert('PDF lib missing');
      const { jsPDF }=window.jspdf; const doc=new jsPDF(); doc.text('Analytics',10,10); doc.text($('instructions').textContent,10,20);
      doc.autoTable({ html:'.list-group', startY:30 });
      doc.save('analytics.pdf');
    };
  };

  // Register
  $('loadRegister').onclick = () => {
    const m=$('registerMonth').value; if(!m) return alert('Pick month');
    const [y,mm]=m.split('-').map(Number), days=new Date(y,mm,0).getDate();
    const head=$('#registerTable thead tr'); head.innerHTML='<th>Sr#</th><th>Adm#</th><th>Name</th>';
    for(let d=1;d<=days;d++) head.innerHTML+=`<th>${d}</th>`;
    const body=$('registerBody'), sum=$('registerSummaryBody'); body.innerHTML=''; sum.innerHTML='';
    filteredStudents().forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
        Array.from({length:days},(_,d)=>{ const ds=`${m}-${String(d+1).padStart(2,'0')}`; const c=attendanceData[ds]?.[s.adm]||'A';
          return `<td style="background:${colors[c]};color:#fff">${c}</td>`;}).join('');
      body.appendChild(tr);
      const stats={P:0,A:0,Lt:0,HD:0,L:0};
      for(let d=1;d<=days;d++){ const ds=`${m}-${String(d).padStart(2,'0')}`; stats[attendanceData[ds]?.[s.adm]||'A']++; }
      const pct = ((stats.P/days)*100).toFixed(1);
      sum.innerHTML+=`<tr><td>${s.name}</td><td>${stats.P}</td><td>${stats.A}</td><td>${stats.Lt}</td><td>${stats.HD}</td><td>${stats.L}</td><td>${pct}</td></tr>`;
    });
    $('registerTableWrapper').classList.remove('d-none');
    $('registerSummarySection').classList.remove('d-none');
    $('loadRegister').classList.add('d-none');
    $('changeRegister').classList.remove('d-none');
  };
  $('changeRegister').onclick = () => {
    $('registerTableWrapper','registerSummarySection').forEach(id=>$(id).classList.add('d-none'));
    $('changeRegister').classList.add('d-none');
    $('loadRegister').classList.remove('d-none');
  };
  $('shareRegister').onclick = () => {
    const m=$('registerMonth').value, rows=Array.from($('registerSummaryBody').rows).map(r=>`${r.cells[0].textContent}: %${r.cells[6].textContent}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(`Register ${m}\n`+rows.join('\n'))}`);
  };
  $('downloadRegisterPDF').onclick = () => {
    if(!window.jspdf) return alert('PDF lib missing');
    const { jsPDF }=window.jspdf; const doc=new jsPDF('landscape');
    doc.text('Attendance Register',10,10);
    doc.autoTable({ html:'#registerTable', startY:20, styles:{fontSize:6} });
    doc.autoTable({ html:'#registerSummarySection table', startY:doc.lastAutoTable.finalY+10 });
    doc.save('register.pdf');
  };

  // Init
  renderStudents(); updateTotals(); hideAnalytics();
});
