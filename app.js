window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'var(--orange)', L:'var(--info)' };

  // SETUP
  const schoolIn = $('schoolNameInput'),
        classSel = $('teacherClassSelect'),
        secSel   = $('teacherSectionSelect'),
        saveSet  = $('saveSetup'),
        formSet  = $('setupForm'),
        dispSet  = $('setupDisplay'),
        txtSet   = $('setupText'),
        editSet  = $('editSetup');
  function loadSetup() {
    const s = localStorage.getItem('schoolName'),
          c = localStorage.getItem('teacherClass'),
          e = localStorage.getItem('teacherSection');
    if (s && c && e) {
      schoolIn.value = s; classSel.value = c; secSel.value = e;
      txtSet.textContent = `${s} 🏫 | Class: ${c} | Section: ${e}`;
      formSet.classList.add('hidden');
      dispSet.classList.remove('hidden');
    }
  }
  saveSet.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };
  editSet.onclick = e => {
    e.preventDefault();
    formSet.classList.remove('hidden');
    dispSet.classList.add('hidden');
  };
  loadSetup();

  // STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students')||'[]');
  const inputs = ['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress'].map($);
  const addBtn           = $('addStudent'),
        tblBody          = $('studentsBody'),
        selectAll        = $('selectAllStudents'),
        editSelected     = $('editSelected'),
        deleteSelected   = $('deleteSelected'),
        saveRegBtn       = $('saveRegistration'),
        shareRegBtn      = $('shareRegistration'),
        editRegBtn       = $('editRegistration'),
        downloadRegPDF   = $('downloadRegistrationPDF');
  let regSaved = false, inlineEdit = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }
  function renderStudents() {
    tblBody.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-i="${i}" ${regSaved?'disabled':''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved?'<button class="share-one">Share</button>':''}</td>`;
      if (regSaved) {
        tr.querySelector('.share-one').onclick = ev => {
          ev.preventDefault();
          const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
          const m = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(m)}`, '_blank');
        };
      }
      tblBody.appendChild(tr);
    });
    bindSelection();
  }
  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x=>x.checked);
        editSelected.disabled = deleteSelected.disabled = !any;
      };
    });
    selectAll.disabled = regSaved;
    selectAll.onchange = () => {
      if (!regSaved) boxes.forEach(cb => { cb.checked = selectAll.checked; cb.onchange(); });
    };
  }
  addBtn.onclick = ev => {
    ev.preventDefault();
    const vals = inputs.map(i=>i.value.trim());
    if (vals.some(v=>!v)) return alert('All fields required');
    if (!/^\d+$/.test(vals[1])) return alert('Adm# numeric');
    if (!/^\d{7,15}$/.test(vals[3])) return alert('Contact 7–15 digits');
    const [name, adm, parent, contact, occupation, address] = vals;
    students.push({name,adm,parent,contact,occupation,address,roll:Date.now()});
    saveStudents(); renderStudents(); inputs.forEach(i=>i.value='');
  };
  function onBlur(e) {
    const td = e.target, tr = td.closest('tr'), idx = +tr.querySelector('.sel').dataset.i;
    const ci = [...tr.children].indexOf(td), keys=['name','adm','parent','contact','occupation','address'];
    if(ci>0 && ci<7) {
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  }
  editSelected.onclick = ev => {
    ev.preventDefault();
    const sel = [...document.querySelectorAll('.sel:checked')];
    if (!sel.length) return;
    inlineEdit = !inlineEdit;
    editSelected.textContent = inlineEdit ? 'Done Editing' : 'Edit Selected';
    sel.forEach(cb => {
      [...cb.closest('tr').querySelectorAll('td')].forEach((td,ci) => {
        if(ci>0 && ci<7) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit ? td.addEventListener('blur', onBlur) : td.removeEventListener('blur', onBlur);
        }
      });
    });
  };
  deleteSelected.onclick = ev => {
    ev.preventDefault();
    if(!confirm('Delete selected?')) return;
    [...document.querySelectorAll('.sel:checked')]
      .map(cb=>+cb.dataset.i).sort((a,b)=>b-a).forEach(i=>students.splice(i,1));
    saveStudents(); renderStudents(); selectAll.checked = false;
  };
  saveRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegPDF.classList.remove('hidden');
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };
  editRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegPDF.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };
  shareRegBtn.onclick = ev => {
    ev.preventDefault();
    const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s => 
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOcc: ${s.occupation}\nAddr: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines)}`, '_blank');
  };
  downloadRegPDF.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    doc.autoTable({
      head: [['Name','Adm#','Parent','Contact','Occ','Addr']],
      body: students.map(s => [s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY: 40, margin: { left:40, right:40 }, styles:{ fontSize:10 }
    });
    doc.save('students_registration.pdf');
  };
  renderStudents();

  // ATTENDANCE
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');
  const dateIn        = $('dateInput'),
        loadAttBtn    = $('loadAttendance'),
        attList       = $('attendanceList'),
        saveAttBtn    = $('saveAttendance'),
        resSec        = $('attendance-result'),
        summaryBody   = $('summaryBody'),
        resetAttBtn   = $('resetAttendance'),
        shareAttBtn   = $('shareAttendanceSummary'),
        downloadAttBtn= $('downloadAttendancePDF');

  loadAttBtn.onclick = ev => {
    ev.preventDefault();
    if (!dateIn.value) return alert('Pick a date');
    attList.innerHTML = '';
    students.forEach(s => {
      const row = document.createElement('div'), btns = document.createElement('div');
      row.className = 'attendance-item'; row.textContent = s.name;
      btns.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button');
        b.type='button'; b.className='att-btn'; b.dataset.code=code; b.textContent=code;
        if(attendanceData[dateIn.value]?.[s.roll]===code) {
          b.style.background=colors[code]; b.style.color='#fff';
        }
        b.onclick = e2 => {
          e2.preventDefault();
          [...btns.children].forEach(x=>{ x.style.background=''; x.style.color='var(--dark)'; });
          b.style.background=colors[code]; b.style.color='#fff';
        };
        btns.append(b);
      });
      attList.append(row, btns);
    });
    saveAttBtn.classList.remove('hidden');
  };
  saveAttBtn.onclick = ev => {
    ev.preventDefault();
    const d = dateIn.value;
    attendanceData[d] = {};
    [...attList.querySelectorAll('.attendance-actions')].forEach((btns,i) => {
      const sel = btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll] = sel ? sel.dataset.code : 'A';
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    $('attendance-section').classList.add('hidden');
    resSec.classList.remove('hidden');
    summaryBody.innerHTML = '';
    const hdr = `Date: ${d}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    summaryBody.insertAdjacentHTML('beforebegin', `<tr><td colspan="3"><em>${hdr}</em></td></tr>`);
    students.forEach(s => {
      const code = attendanceData[d][s.roll] || 'A';
      const st = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${st}</td><td><button class="send">Send</button></td>`;
      tr.querySelector('.send').onclick = e2 => {
        e2.preventDefault();
        const m = `${hdr}\n\nName: ${s.name}\nStatus: ${st}`;
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(m)}`, '_blank');
      };
      summaryBody.appendChild(tr);
    });
  };
  resetAttBtn.onclick = ev => {
    ev.preventDefault();
    resSec.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    attList.innerHTML = '';
    saveAttBtn.classList.add('hidden');
    summaryBody.innerHTML = '';
  };
  shareAttBtn.onclick = ev => {
    ev.preventDefault();
    const d      = dateIn.value;
    const school = localStorage.getItem('schoolName');
    const cls    = localStorage.getItem('teacherClass');
    const sec    = localStorage.getItem('teacherSection');
    const hdr    = `Date: ${d}\nSchool: ${school}\nClass: ${cls}\nSection: ${sec}`;
    const remarkMap = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'};
    const lines = students.map(s => {
      const code = attendanceData[d][s.roll] || 'A';
      return `${s.name}: ${remarkMap[code]}`;
    });
    const total = students.length;
    const pres  = students.reduce((a,s)=> a + (attendanceData[d][s.roll]==='P'?1:0), 0);
    const pct   = total ? ((pres/total)*100).toFixed(1) : '0.0';
    const clsRemark = pct==100 ? 'Best' : pct>=75 ? 'Good' : pct>=50 ? 'Fair' : 'Poor';
    const summary = `Overall Attendance: ${pct}% | ${clsRemark}`;
    const msg     = [hdr, '', ...lines, '', summary].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  downloadAttBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    // Header
    const d      = dateIn.value;
    const school = localStorage.getItem('schoolName');
    const cls    = localStorage.getItem('teacherClass');
    const sec    = localStorage.getItem('teacherSection');
    doc.setFontSize(14);
    doc.text(school, 40, 30);
    doc.setFontSize(12);
    doc.text(`Class: ${cls} | Section: ${sec}`, 40, 45);
    doc.text(`Date: ${d}`, 40, 60);
    // Table
    doc.autoTable({
      head: [['Name','Status']],
      body: students.map(s => {
        const code = attendanceData[d][s.roll] || 'A';
        return [s.name, {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]];
      }),
      startY: 75,
      margin: { left:40, right:40 },
      styles: { fontSize:10 }
    });
  };

  // ANALYTICS
  const analyticsType    = $('analyticsType'),
        analyticsDate    = $('analyticsDate'),
        analyticsMonth   = $('analyticsMonth'),
        semesterStart    = $('semesterStart'),
        semesterEnd      = $('semesterEnd'),
        yearStart        = $('yearStart'),
        loadAnalyticsBtn = $('loadAnalytics'),
        resetAnalyticsBtn= $('resetAnalytics'),
        instructionsEl   = $('instructions'),
        analyticsContainer = $('analyticsContainer'),
        graphsEl         = $('graphs'),
        analyticsActionsEl= $('analyticsActions'),
        shareAnalyticsBtn= $('shareAnalytics'),
        downloadAnalyticsBtn= $('downloadAnalytics'),
        barCtx           = document.getElementById('barChart').getContext('2d'),
        pieCtx           = document.getElementById('pieChart').getContext('2d');
  let barChart, pieChart;

  analyticsType.onchange = () => {
    [analyticsDate,analyticsMonth,semesterStart,semesterEnd,yearStart,
     instructionsEl,analyticsContainer,graphsEl,analyticsActionsEl,resetAnalyticsBtn]
      .forEach(el=>el.classList.add('hidden'));
    if (analyticsType.value==='date') analyticsDate.classList.remove('hidden');
    if (analyticsType.value==='month') analyticsMonth.classList.remove('hidden');
    if (analyticsType.value==='semester') {
      semesterStart.classList.remove('hidden');
      semesterEnd.classList.remove('hidden');
    }
    if (analyticsType.value==='year') yearStart.classList.remove('hidden');
  };
  resetAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    analyticsType.value = '';
    [analyticsDate,analyticsMonth,semesterStart,semesterEnd,yearStart,
     instructionsEl,analyticsContainer,graphsEl,analyticsActionsEl,resetAnalyticsBtn]
      .forEach(el=>el.classList.add('hidden'));
  };
  loadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    let from, to;
    if (analyticsType.value==='date') {
      if(!analyticsDate.value) return alert('Pick a date');
      from = to = analyticsDate.value;
    } else if (analyticsType.value==='month') {
      if(!analyticsMonth.value) return alert('Pick a month');
      from = analyticsMonth.value+'-01'; to = analyticsMonth.value+'-31';
    } else if (analyticsType.value==='semester') {
      if(!semesterStart.value||!semesterEnd.value) return alert('Pick range');
      from = semesterStart.value+'-01'; to = semesterEnd.value+'-31';
    } else if (analyticsType.value==='year') {
      if(!yearStart.value) return alert('Pick a year');
      from = yearStart.value+'-01-01'; to = yearStart.value+'-12-31';
    } else return;

    const stats = students.map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      if(d>=from && d<=to) {
        stats.forEach(st => {
          const code = recs[st.roll]||'A';
          if(st.hasOwnProperty(code)) st[code]++;
          st.total++;
        });
      }
    });
    let html = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s=>{
      const pct = s.total ? ((s.P/s.total)*100).toFixed(1) : '0.0';
      html += `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
    });
    html += '</tbody></table>';
    analyticsContainer.innerHTML = html;
    analyticsContainer.classList.remove('hidden');
    instructionsEl.textContent = `Report: ${from} to ${to}`;
    instructionsEl.classList.remove('hidden');
    resetAnalyticsBtn.classList.remove('hidden');

    const labels = stats.map(s=>s.name),
          dataPct = stats.map(s=> s.total ? s.P/s.total*100 : 0);
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, { type:'bar', data:{ labels, datasets:[{ label:'% Present', data:dataPct }] }, options:{ maintainAspectRatio:true } });
    const agg = stats.reduce((a,s)=>{ ['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]); return a; }, {P:0,A:0,Lt:0,HD:0,L:0});
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, { type:'pie', data:{ labels:['P','A','Lt','HD','L'], datasets:[{ data:Object.values(agg) }] }, options:{ maintainAspectRatio:true } });
    graphsEl.classList.remove('hidden');
    analyticsActionsEl.classList.remove('hidden');
  };

  downloadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    // header
    const school = localStorage.getItem('schoolName'),
          cls    = localStorage.getItem('teacherClass'),
          sec    = localStorage.getItem('teacherSection'),
          period = instructionsEl.textContent.replace('Report: ','Period: ');
    doc.setFontSize(14);
    doc.text(school, 40, 30);
    doc.setFontSize(12);
    doc.text(`Class: ${cls} | Section: ${sec}`, 40, 45);
    doc.text(period, 40, 60);
    // table
    doc.autoTable({
      head:[['Name','P','A','Lt','HD','L','Total','%']],
      body: Array.from(analyticsContainer.querySelectorAll('tbody tr')).map(r=>
        Array.from(r.querySelectorAll('td')).map(td=>td.textContent)
      ),
      startY: 75,
      margin:{ left:40, right:40 },
      styles:{ fontSize:8 }
    });
    // charts side by side below table
    const ypos = doc.lastAutoTable.finalY + 15,
          w    = 260, h = 120;
    const barImg = barChart.toBase64Image(),
          pieImg = pieChart.toBase64Image();
    doc.addImage(barImg, 'PNG', 40, ypos, w, h);
    doc.addImage(pieImg, 'PNG', 40 + w + 10, ypos, w, h);
    doc.save('analytics_report.pdf');
  };
});
