// app.js
window.addEventListener('DOMContentLoaded', async () => {
  const { get, set } = window.idbKeyval;
  const $ = id => document.getElementById(id);

  // State
  let students = await get('students') || [];
  let attendanceData = await get('attendanceData') || {};
  let chartBar, chartPie;

  // Helpers
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };
  function saveStudents()       { return set('students', students); }
  function saveAttendance()     { return set('attendanceData', attendanceData); }
  function getCurrentClassSection() {
    return { cls: $('teacherClassSelect')?.value, sec: $('teacherSectionSelect')?.value };
  }
  function filteredStudents() {
    const { cls, sec } = getCurrentClassSection();
    return students.filter(s => s.cls === cls && s.sec === sec);
  }
  function updateTotals() {
    $('totalSchoolCount').textContent  = students.length;
    $('totalClassCount').textContent   = students.filter(s=>s.cls=== $('teacherClassSelect')?.value).length;
    $('totalSectionCount').textContent = filteredStudents().length;
  }

  // RENDER STUDENTS
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

  // BIND SELECTION
  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => cb.onchange = toggleActionButtons);
    const all = $('selectAllStudents');
    if (all) all.onchange = e => boxes.forEach(cb => cb.checked = e.target.checked) & toggleActionButtons();
  }
  function toggleActionButtons() {
    const any = !!document.querySelectorAll('.sel:checked').length;
    ['editSelected','deleteSelected'].forEach(id => $(id).disabled = !any);
  }

  // ADD STUDENT
  $('addStudent').onclick = async () => {
    const name = $('studentName').value.trim(),
          adm  = $('admissionNo').value.trim(),
          par  = $('parentName').value.trim(),
          cont = $('parentContact').value.trim(),
          occ  = $('parentOccupation').value.trim(),
          addr = $('parentAddress').value.trim();
    if (!name||!adm||!par||!cont||!occ||!addr) return alert('All fields required');
    const { cls, sec } = getCurrentClassSection();
    students.push({ name, adm, parent:par, contact:cont, occupation:occ, address:addr, cls, sec });
    await saveStudents();
    renderStudents();
  };

  // EDIT SELECTED
  $('editSelected').onclick = () => {
    const checked = Array.from(document.querySelectorAll('.sel:checked'));
    if (!checked.length) return alert('Select a row first');
    checked.forEach(cb => {
      const tr = cb.closest('tr');
      ['name','adm','parent','contact','occupation','address'].forEach((key,idx) => {
        const td = tr.children[idx+2];
        td.contentEditable = true;
        td.classList.add('editing');
        td.onblur = async () => {
          const i = +cb.dataset.index;
          students[i][key] = td.textContent.trim();
          await saveStudents();
        };
      });
    });
  };

  // DELETE SELECTED
  $('deleteSelected').onclick = async () => {
    const checked = Array.from(document.querySelectorAll('.sel:checked'));
    if (!checked.length) return alert('Select a row first');
    if (!confirm('Delete selected?')) return;
    const indexes = checked.map(cb=>+cb.dataset.index).sort((a,b)=>b-a);
    indexes.forEach(i=>students.splice(i,1));
    await saveStudents();
    renderStudents();
  };

  // SAVE REGISTRATION
  $('saveRegistration').onclick = () => {
    ['editSelected','deleteSelected','saveRegistration','selectAllStudents'].forEach(id=>$(id)?.classList.add('d-none'));
    ['editRegistration','shareRegistration','downloadRegistrationPDF'].forEach(id=>$(id)?.classList.remove('d-none'));
  };
  $('editRegistration').onclick = () => {
    ['editSelected','deleteSelected','saveRegistration','selectAllStudents'].forEach(id=>$(id)?.classList.remove('d-none'));
    ['editRegistration','shareRegistration','downloadRegistrationPDF'].forEach(id=>$(id)?.classList.add('d-none'));
  };

  // SHARE / DOWNLOAD REGISTRATION
  $('shareRegistration').onclick = () => {
    const msg = filteredStudents().map(s=>`${s.name} (${s.adm})`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  };
  $('downloadRegistrationPDF').onclick = () => {
    if (!window.jspdf) return alert('PDF library not loaded');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Student Registration',10,10);
    filteredStudents().forEach((s,i)=> doc.text(`${i+1}. ${s.name} (${s.adm})`,10,20 + i*6));
    doc.save('registration.pdf');
  };

  // MARK ATTENDANCE
  $('loadAttendance').onclick = () => {
    const d = $('dateInput').value;
    if (!d) return alert('Pick a date');
    const list = $('attendanceList');
    list.innerHTML = '';
    filteredStudents().forEach(s=>{
      const row = document.createElement('div'); row.textContent = s.name;
      const actions = document.createElement('div'); actions.className='attendance-actions d-flex gap-1';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const btn = document.createElement('button');
        btn.type='button'; btn.textContent=code; btn.className='btn btn-sm';
        btn.onclick = () => actions.querySelectorAll('button').forEach(b=>b.classList.remove('active')) & btn.classList.add('active');
        actions.appendChild(btn);
      });
      list.append(row,actions);
    });
    $('saveAttendance').classList.remove('d-none');
  };
  $('saveAttendance').onclick = async () => {
    const d = $('dateInput').value;
    attendanceData[d] = {};
    document.querySelectorAll('.attendance-actions').forEach((actions,i)=>{
      const sel = actions.querySelector('button.active');
      attendanceData[d][filteredStudents()[i].adm] = sel?sel.textContent:'A';
    });
    await saveAttendance();
    $('attendance-result').classList.remove('d-none');
    const body = $('summaryBody');
    body.innerHTML = `<tr><td colspan="3"><em>Date: ${d}</em></td></tr>`;
    filteredStudents().forEach(s=>{
      const code = attendanceData[d][s.adm]||'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      body.innerHTML += `<tr><td>${s.name}</td><td>${status}</td><td><button class="btn btn-sm btn-primary">Send</button></td></tr>`;
    });
  };
  $('resetAttendance').onclick = () => {
    $('attendance-result').classList.add('d-none');
    $('attendanceList').innerHTML = '';
    $('saveAttendance').classList.add('d-none');
  };
  $('shareAttendanceSummary').onclick = () => {
    const d = $('dateInput').value;
    const lines = filteredStudents().map(s=>{
      const code = attendanceData[d][s.adm]||'A';
      return `${s.name}: ${ {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code] }`;
    }).join('\n');
    const hdr = `Date: ${d}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines)}`);
  };
  $('downloadAttendancePDF').onclick = () => {
    if (!window.jspdf) return alert('PDF lib not loaded');
    const d = $('dateInput').value, { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Daily Attendance',10,10);
    filteredStudents().forEach((s,i)=> doc.text(`${s.name}: ${(attendanceData[d][s.adm]||'A')}`,10,20+i*6));
    doc.save('attendance.pdf');
  };

  // ANALYTICS
  function hideAnalyticsInputs() {
    ['studentAdmInput','analyticsDate','analyticsMonth','semesterStart','semesterEnd','yearStart','instructions','analyticsContainer','graphs','analyticsActions2']
      .forEach(id => { const el=$(id); if(el) el.classList.add('d-none'); });
  }
  $('analyticsTarget').onchange = () => {
    const sel = $('analyticsTarget').value==='student';
    $('studentAdmInput')?.classList.toggle('d-none',!sel);
    $('analyticsType').value = '';
    hideAnalyticsInputs();
  };
  $('analyticsType').onchange = () => {
    hideAnalyticsInputs();
    const t = $('analyticsType').value;
    if (t==='date') $('analyticsDate')?.classList.remove('d-none');
    if (t==='month') $('analyticsMonth')?.classList.remove('d-none');
    if (t==='semester') { $('semesterStart')?.classList.remove('d-none'); $('semesterEnd')?.classList.remove('d-none'); }
    if (t==='year') $('yearStart')?.classList.remove('d-none');
    $('resetAnalytics')?.classList.remove('d-none');
  };
  $('resetAnalytics').onclick = () => {
    $('analyticsType').value = '';
    hideAnalyticsInputs();
  };
  $('loadAnalytics').onclick = () => {
    const t = $('analyticsType').value;
    let from,to;
    if (t==='date') {
      from=to=$('analyticsDate').value; if(!from) return alert('Pick a date');
    } else if (t==='month') {
      const m=$('analyticsMonth').value; if(!m) return alert('Pick month');
      const [y,mm]=m.split('-').map(Number);
      from=`${m}-01`; to=`${m}-${new Date(y,mm,0).getDate()}`;
    } else if (t==='semester') {
      const s=$('semesterStart').value,e=$('semesterEnd').value;
      if(!s||!e) return alert('Pick semester');
      from=`${s}-01`; const [ey,em]=e.split('-').map(Number);
      to=`${e}-${new Date(ey,em,0).getDate()}`;
    } else if (t==='year') {
      const y=$('yearStart').value; if(!y) return alert('Pick year');
      from=`${y}-01-01`; to=`${y}-12-31`;
    } else return alert('Select type');
    const instr=$('instructions'); instr.textContent=`Period: ${from} → ${to}`; instr.classList.remove('d-none');
    const data = filteredStudents().map(s=>({name:s.name,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,rec])=>{
      if(d>=from&&d<=to) data.forEach(st=>{
        const c=rec[filteredStudents().find(x=>x.name===st.name)?.adm]||'A';
        st[c]++; st.total++;
      });
    });
    const cont=$('analyticsContainer');
    let html='<table class="table"><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    data.forEach(st=>{
      const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      html+=`<tr><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${pct}</td></tr>`;
    });
    html+='</tbody></table>'; cont.innerHTML=html; cont.classList.remove('d-none');
    const labels=data.map(s=>s.name), values=data.map(s=>s.total?((s.P/s.total)*100):0);
    const graphs=$('graphs'); graphs.classList.remove('d-none');
    chartBar?.destroy(); chartBar=new Chart($('barChart').getContext('2d'),{type:'bar',data:{labels,datasets:[{label:'% Present',data:values}]},options:{scales:{y:{beginAtZero:true,max:100}}}});
    const agg=data.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    chartPie?.destroy(); chartPie=new Chart($('pieChart').getContext('2d'),{type:'pie',data:{labels:['Present','Absent','Late','Half Day','Leave'],datasets:[{data:Object.values(agg)}]}});
    $('analyticsActions2').classList.remove('d-none');
    $('shareAnalytics').onclick = () => {
      const rows = data.map(s=>`${s.name}: P:${s.P} A:${s.A} Lt:${s.Lt} HD:${s.HD} L:${s.L}`);
      window.open(`https://wa.me/?text=${encodeURIComponent(instr.textContent + '\n' + rows.join('\n'))}`);
    };
    $('downloadAnalytics').onclick = () => {
      if(!window.jspdf) return alert('PDF lib missing');
      const { jsPDF }=window.jspdf; const doc=new jsPDF();
      doc.text('Attendance Analytics',10,10); doc.text(instr.textContent,10,20);
      doc.autoTable({ html:'.table', startY:30 });
      doc.save('analytics.pdf');
    };
  };

  // ATTENDANCE REGISTER
  $('loadRegister').onclick = () => {
    const m=$('registerMonth').value; if(!m) return alert('Pick month');
    const [y,mm]=m.split('-').map(Number), days=new Date(y,mm,0).getDate();
    const head=$('#registerTable thead tr'); head.innerHTML='<th>Sr#</th><th>Adm#</th><th>Name</th>';
    for(let d=1;d<=days;d++) head.innerHTML+=`<th>${d}</th>`;
    const body=$('registerBody'), sum=$('registerSummaryBody');
    body.innerHTML=''; sum.innerHTML='';
    filteredStudents().forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=days;d++){
        const ds=`${m}-${String(d).padStart(2,'0')}`, code=(attendanceData[ds]?.[s.adm]||'A');
        tr.innerHTML+=`<td style="background:${colors[code]};color:#fff">${code}</td>`;
      }
      body.appendChild(tr);
      // summary
      const stats={P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for(let d=1;d<=days;d++){
        const code=(attendanceData[`${m}-${String(d).padStart(2,'0')}`]?.[s.adm]||'A');
        stats[code]++; stats.total++;
      }
      const pct=stats.total?((stats.P/stats.total)*100).toFixed(1):'0.0';
      sum.innerHTML+=`<tr><td>${s.name}</td><td>${stats.P}</td><td>${stats.A}</td><td>${stats.Lt}</td><td>${stats.HD}</td><td>${stats.L}</td><td>${pct}</td></tr>`;
    });
    $('registerTableWrapper').classList.remove('d-none');
    $('registerSummarySection').classList.remove('d-none');
    $('loadRegister').classList.add('d-none');
    $('changeRegister').classList.remove('d-none');
  };
  $('changeRegister').onclick = () => {
    $('registerTableWrapper').classList.add('d-none');
    $('registerSummarySection').classList.add('d-none');
    $('changeRegister').classList.add('d-none');
    $('loadRegister').classList.remove('d-none');
  };
  $('shareRegister').onclick = () => {
    const m=$('registerMonth').value;
    const hdr=`Register ${m}`;
    const lines=Array.from($('registerSummaryBody').rows).map(r=>`${r.cells[0].textContent}: %${r.cells[6].textContent}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+lines.join('\n'))}`);
  };
  $('downloadRegisterPDF').onclick = () => {
    if(!window.jspdf) return alert('PDF lib missing');
    const { jsPDF }=window.jspdf; const doc=new jsPDF('landscape');
    doc.text('Attendance Register',10,10);
    doc.autoTable({ html:'#registerTable', startY:20, styles:{fontSize:6} });
    doc.autoTable({ html:'#registerSummarySection table', startY:doc.lastAutoTable.finalY+10 });
    doc.save('register.pdf');
  };

  // SERVICE WORKER
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(()=>{});

  // INIT
  renderStudents();
  updateTotals();
  hideAnalyticsInputs();
});
