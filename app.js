// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const THRESHOLD = 75;
  const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'var(--orange)', L:'var(--info)' };

  // --- SETUP ---
  const schoolIn = $('schoolNameInput'),
        classSel = $('teacherClassSelect'),
        secSel   = $('teacherSectionSelect'),
        saveSet  = $('saveSetup'),
        formSet  = $('setupForm'),
        dispSet  = $('setupDisplay'),
        txtSet   = $('setupText'),
        editSet  = $('editSetup');

  saveSet.onclick = () => {
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };
  editSet.onclick = () => {
    formSet.classList.remove('hidden');
    dispSet.classList.add('hidden');
  };
  function loadSetup() {
    const s = localStorage.getItem('schoolName'),
          c = localStorage.getItem('teacherClass'),
          e = localStorage.getItem('teacherSection');
    if (s && c && e) {
      schoolIn.value = s;
      classSel.value = c;
      secSel.value   = e;
      txtSet.textContent = `${s} 🏫 | Class: ${c} | Section: ${e}`;
      formSet.classList.add('hidden');
      dispSet.classList.remove('hidden');
    }
  }
  loadSetup();

  // --- STUDENT REGISTRATION ---
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const inputs        = ['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress'].map($),
        addBtn        = $('addStudent'),
        tblBody       = $('studentsBody'),
        selectAll     = $('selectAllStudents'),
        editSelected  = $('editSelected'),
        deleteSelected= $('deleteSelected'),
        saveReg       = $('saveRegistration'),
        shareReg      = $('shareRegistration'),
        editReg       = $('editRegistration');
  let registrationSaved = false, inlineEditMode = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function renderStudents() {
    tblBody.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td class="select-col" style="${registrationSaved?'display:none':''}"><input type="checkbox" class="selectStudent" data-index="${i}"></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${registrationSaved?'<button class="share-row">Share</button>':''}</td>`;
      if (registrationSaved) {
        tr.querySelector('.share-row').onclick = () => {
          const header = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
          const msg = `${header}\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      tblBody.appendChild(tr);
    });
    bindSelection();
  }

  function bindSelection() {
    const boxes = [...document.querySelectorAll('.selectStudent')];
    boxes.forEach(cb => cb.onchange = () => {
      const tr = cb.closest('tr');
      cb.checked ? tr.classList.add('selected') : tr.classList.remove('selected');
      const any = boxes.some(x => x.checked);
      editSelected.disabled = !any || registrationSaved;
      deleteSelected.disabled = !any || registrationSaved;
    });
    selectAll.disabled = registrationSaved;
    selectAll.onchange = () => {
      if (registrationSaved) return;
      boxes.forEach(cb => { cb.checked = selectAll.checked; cb.dispatchEvent(new Event('change')); });
    };
  }

  deleteSelected.onclick = () => {
    if (!confirm('Delete selected students?')) return;
    [...document.querySelectorAll('.selectStudent:checked')]
      .map(cb => +cb.dataset.index).sort((a,b)=>b-a)
      .forEach(idx => students.splice(idx,1));
    saveStudents(); renderStudents(); selectAll.checked = false;
  };

  function onCellBlur(e) {
    const td = e.target,
          tr = td.closest('tr'),
          idx = +tr.querySelector('.selectStudent').dataset.index,
          keys = ['name','adm','parent','contact','occupation','address'],
          ci = Array.from(tr.children).indexOf(td);
    if (ci>=1 && ci<=6) {
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  }

  editSelected.onclick = () => {
    if (registrationSaved) return;
    const sel = [...document.querySelectorAll('.selectStudent:checked')];
    if (!sel.length) return;
    inlineEditMode = !inlineEditMode;
    editSelected.textContent = inlineEditMode ? 'Done Editing' : 'Edit Selected';
    sel.forEach(cb => {
      const tr = cb.closest('tr');
      [...tr.querySelectorAll('td')].forEach((td,ci) => {
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineEditMode;
          td.classList.toggle('editing', inlineEditMode);
          if (inlineEditMode) td.addEventListener('blur', onCellBlur);
          else td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  saveReg.onclick = () => {
    registrationSaved = true;
    editSelected.style.display = 'none';
    deleteSelected.style.display = 'none';
    selectAll.style.display = 'none';
    saveReg.style.display = 'none';
    shareReg.classList.remove('hidden');
    editReg.classList.remove('hidden');
    renderStudents();
  };

  editReg.onclick = () => {
    registrationSaved = false;
    editSelected.style.display = '';
    deleteSelected.style.display = '';
    selectAll.style.display = '';
    saveReg.style.display = '';
    shareReg.classList.add('hidden');
    editReg.classList.add('hidden');
    renderStudents();
  };

  shareReg.onclick = () => {
    const header = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s =>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  addBtn.onclick = () => {
    if (registrationSaved) return;
    const vals = inputs.map(i=>i.value.trim());
    if (!vals[0]||!vals[1]) return alert('Name & Adm# required');
    students.push({ name: vals[0], adm: vals[1], parent: vals[2], contact: vals[3], occupation: vals[4], address: vals[5], roll: Date.now() });
    saveStudents(); renderStudents(); inputs.forEach(i=>i.value='');
  };

  renderStudents();

  // --- ATTENDANCE MARKING & SUMMARY ---
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');
  const dateIn = $('dateInput'),
        loadAtt = $('loadAttendance'),
        attList = $('attendanceList'),
        saveAtt = $('saveAttendance'),
        resSec  = $('attendance-result'),
        summaryBody = $('summaryBody'),
        resetAtt    = $('resetAttendance');

  loadAtt.onclick = () => {
    if (!dateIn.value) return alert('Pick date');
    attList.innerHTML = '';
    students.forEach((s,i) => {
      const nameRow = document.createElement('div'); nameRow.className='attendance-item'; nameRow.textContent=s.name;
      const btnRow  = document.createElement('div'); btnRow.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button'); b.className='att-btn'; b.dataset.code=code; b.textContent=code;
        if (attendanceData[dateIn.value]?.[s.roll]===code) { b.style.background=colors[code]; b.style.color='#fff'; }
        b.onclick = () => {
          [...btnRow.children].forEach(x=>{ x.style.background='transparent'; x.style.color='var(--dark)'; });
          b.style.background=colors[code]; b.style.color='#fff';
        };
        btnRow.append(b);
      });
      attList.append(nameRow, btnRow);
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick = () => {
    const d = dateIn.value; attendanceData[d] = {};
    attList.querySelectorAll('.attendance-actions').forEach((row,i) => {
      const b = row.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll] = b ? b.dataset.code : 'Not marked';
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    $('attendance-section').classList.add('hidden');
    resSec.classList.remove('hidden');
    summaryBody.innerHTML = '';
    summaryBody.insertAdjacentHTML('beforebegin',
      `<tr><td colspan="3"><em>School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')} | Date: ${d}</em></td></tr>`
    );
    students.forEach(s => {
      const st = attendanceData[d][s.roll];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${st}</td><td><button class="send">Send</button></td>`;
      tr.querySelector('.send').onclick = () => {
        const remarkMap = {
          P:  'Good attendance—keep it up!',
          A:  'Please ensure regular attendance.',
          Lt: 'Remember to arrive on time.',
          HD: 'Submit permission note for half-day.',
          L:  'Attend when possible.'};
        const remark = remarkMap[st] || '';
        const msg = [
          `Date: ${d}`,
          `School: ${localStorage.getItem('schoolName')}`,
          `Class: ${localStorage.getItem('teacherClass')}`,
          `Section: ${localStorage.getItem('teacherSection')}`,
          '',
          `Name: ${s.name}`,
          `Status: ${st}`,
          `Remarks: ${remark}`
        ].join('\n');
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  resetAtt.onclick = () => {
    resSec.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    attList.innerHTML = '';
    saveAtt.classList.add('hidden');
    summaryBody.innerHTML = '';
  };

  $('downloadAttendanceSummary').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    let y = 20;
    const header = [
      `School: ${localStorage.getItem('schoolName')}`,
      `Class: ${localStorage.getItem('teacherClass')}`,
      `Section: ${localStorage.getItem('teacherSection')}`,
      `Date: ${$('dateInput').value}`
    ].join(' | ')
    ;
    doc.setFontSize(14);
    doc.text(header, 20, y);
    y += 20;
    doc.autoTable({
      html: document.querySelector('#attendance-result table'),
      startY: y,
      theme: 'grid',
      headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4 }
    });
    doc.save(`Attendance_Summary_${$('dateInput').value}.pdf`);
  };

  // --- ANALYTICS ---
  const typeSel    = $('analyticsType'),
        aDate      = $('analyticsDate'),
        aMonth     = $('analyticsMonth'),
        semStart   = $('semesterStart'),
        semEnd     = $('semesterEnd'),
        yrStart    = $('yearStart'),
        loadAnalytics = $('loadAnalytics'),
        resetAnalytics= $('resetAnalytics'),
        instr         = $('instructions'),
        contA         = $('analyticsContainer'),
        graphs        = $('graphs'),
        shareAnalytics= $('shareAnalytics'),
        downloadAnalytics = $('downloadAnalytics'),
        barCtx        = $('barChart').getContext('2d'),
        pieCtx        = $('pieChart').getContext('2d');
  window.summaryData = [];

  function toggleInputs() {
    [aDate,aMonth,semStart,semEnd,yrStart].forEach(el=>el.classList.add('hidden'));
    const v = typeSel.value;
    if (v==='date')      aDate.classList.remove('hidden');
    if (v==='month')     aMonth.classList.remove('hidden');
    if (v==='semester')  { semStart.classList.remove('hidden'); semEnd.classList.remove('hidden'); }
    if (v==='year')      yrStart.classList.remove('hidden');
  }
  typeSel.onchange = toggleInputs;

  function buildDates() {
    const v = typeSel.value, arr = [];
    const pushRange = (s,e) => {
      let d = new Date(s);
      while (d <= e) {
        arr.push(d.toISOString().slice(0,10));
        d.setDate(d.getDate()+1);
      }
    };
    if (v==='date') {
      let d = new Date(aDate.value);
      if (!isNaN(d)) arr.push(d.toISOString().slice(0,10));
    }
    if (v==='month') {
      let [y,m] = aMonth.value.split('-');
      pushRange(new Date(y,m-1,1), new Date(y,m,0));
    }
    if (v==='semester') {
      let [ys,ms] = semStart.value.split('-'),
          [ye,me] = semEnd.value.split('-');
      pushRange(new Date(ys,ms-1,1), new Date(ye,me,0));
    }
    if (v==='year') {
      let y = +yrStart.value;
      pushRange(new Date(y,0,1), new Date(y,11,31));
    }
    return arr;
  }

  loadAnalytics.onclick = () => {
    const dates = buildDates();
    if (!dates.length) return alert('Select period');
    resetAnalytics.classList.remove('hidden');
    instr.classList.remove('hidden');
    contA.classList.remove('hidden');
    graphs.classList.remove('hidden');
    instr.innerHTML = `<h3>Instructions</h3><p>Attendance % = (P+Lt+HD)/TotalDays ×100</p><p>Threshold: ${THRESHOLD}%</p>`;
    const dataA = JSON.parse(localStorage.getItem('attendanceData')||'{}');
    const summary = students.map(s => {
      const cnt = {P:0,A:0,Lt:0,HD:0,L:0};
      dates.forEach(d => {
        const st = (dataA[d]||{})[s.roll]||'';
        if (st) cnt[st]++;
      });
      const total = dates.length;
      const pct   = Math.round((cnt.P+cnt.Lt+cnt.HD)/total*100);
      return { name: s.name, ...cnt, total, pct };
    });
    window.summaryData = summary;

    contA.innerHTML = '';
    const tbl = document.createElement('table');
    tbl.border = 1; tbl.style.width='100%';
    tbl.innerHTML = `<tr><th>Name</th><th>P</th><th>Lt</th><th>HD</th><th>L</th><th>A</th><th>Total</th><th>%</th><th>Elig</th></tr>` +
      summary.map(r => `<tr><td>${r.name}</td><td>${r.P}</td><td>${r.Lt}</td><td>${r.HD}</td><td>${r.L}</td><td>${r.A}</td><td>${r.total}</td><td>${r.pct}%</td><td>${r.pct>=THRESHOLD?'✓':'✗'}</td></tr>`).join('');
    contA.appendChild(tbl);

    if (window.chartBar) window.chartBar.destroy();
    window.chartBar = new Chart(barCtx, { type:'bar', data:{ labels:summary.map(r=>r.name), datasets:[{ label:'%', data:summary.map(r=>r.pct) }] }, options:{ responsive:true } });
    if (window.chartPie) window.chartPie.destroy();
    window.chartPie = new Chart(pieCtx, { type:'pie', data:{ labels:summary.map(r=>r.name), datasets:[{ data:summary.map(r=>r.pct) }] }, options:{ responsive:true } });

    $('analyticsActions').classList.remove('hidden');
  };

  resetAnalytics.onclick = () => {
    typeSel.value = '';
    toggleInputs();
    resetAnalytics.classList.add('hidden');
    instr.classList.add('hidden');
    contA.classList.add('hidden');
    graphs.classList.add('hidden');
    $('analyticsActions').classList.add('hidden');
  };

  // —— UPDATED HANDLERS ——  
  document.getElementById('shareAttendanceSummary').onclick = () => {
    const date = $('dateInput').value;
    const header = [
      `Date: ${date}`,
      `School: ${localStorage.getItem('schoolName')}`,
      `Class: ${localStorage.getItem('teacherClass')}`,
      `Section: ${localStorage.getItem('teacherSection')}`,
      ''
    ].join('\n');

    const rows = Array.from(document.querySelectorAll('#summaryBody tr'));
    const blocks = rows.map(tr => {
      const name   = tr.children[0].textContent;
      const status = tr.children[1].textContent;
      const remarks = {
        P:  'Good attendance—keep it up!',
        A:  'Please ensure regular attendance.',
        Lt: 'Remember to arrive on time.',
        HD: 'Submit permission note for half‑day.',
        L:  'Attend when possible.'
      }[status] || '';
      return [
        `*Name:* ${name}`,
        `*Status:* ${status}`,
        `*Remarks:* ${remarks}`,
        ''
      ].join('\n');
    }).join('\n');

    const stats = { P:0,A:0,Lt:0,HD:0,L:0 };
    rows.forEach(tr => { const st = tr.children[1].textContent; stats[st] = (stats[st]||0) + 1; });
    const totalCount = rows.length;
    const avgPct = ((stats.P + stats.Lt + stats.HD)/totalCount)*100;
    const avgRemark = avgPct >= THRESHOLD
      ? 'Overall attendance is good.'
      : 'Overall attendance needs improvement.';
    const footer = [
      `Class Average: ${avgPct.toFixed(1)}%`,
      `Remarks: ${avgRemark}`
    ].join('\n');

    const msg = [header, blocks, footer].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  document.getElementById('shareAnalytics').onclick = () => {
    const dates = buildDates();
    if (!dates.length) return alert('Select period');

    const header = [
      `Date Range: ${dates[0]} to ${dates[dates.length-1]}`,
      `School: ${localStorage.getItem('schoolName')}`,
      `Class: ${localStorage.getItem('teacherClass')}`,
      `Section: ${localStorage.getItem('teacherSection')}`,
      ''
    ].join('\n');

    const blocks = (window.summaryData || []).map(r => {
      const remark = r.pct >= THRESHOLD
        ? 'Good attendance—keep it up!'
        : 'Attendance below threshold.';
      return [
        `*${r.name}*`,
        `P:${r.P} A:${r.A} Lt:${r.Lt} HD:${r.HD} L:${r.L}`,
        `Total: ${r.total}  %: ${r.pct}%`,
        `Remarks: ${remark}`,
        ''
      ].join('\n');
    }).join('\n');

    const average = (window.summaryData || []).reduce((s,r)=>s+r.pct,0) / (window.summaryData.length||1);
    const avgRemark = average >= THRESHOLD
      ? 'Overall attendance is good.'
      : 'Overall attendance needs improvement.';
    const footer = [
      `Class Average: ${average.toFixed(1)}%`,
      `Remarks: ${avgRemark}`
    ].join('\n');

    const msg = [header, blocks, footer].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  $('downloadAnalytics').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    let y = 20;
    const dates = buildDates();
    const headerLine = [
      `Date Range: ${dates[0]} to ${dates[dates.length-1]}`,
      `School: ${localStorage.getItem('schoolName')}`,
      `Class: ${localStorage.getItem('teacherClass')}`,
      `Section: ${localStorage.getItem('teacherSection')}`
    ].join(' | ');
    doc.setFontSize(14);
    doc.text(headerLine, 20, y);
    y += 20;
    doc.autoTable({
      html: contA.querySelector('table'),
      startY: y,
      theme: 'grid',
      headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4 }
    });
    y = doc.lastAutoTable.finalY + 20;
    doc.text('Bar Chart', 20, y); y += 10;
    doc.addImage(window.chartBar.toDataURL(), 'PNG', 20, y, 550, 200); y += 210;
    doc.text('Pie Chart', 20, y); y += 10;
    doc.addImage(window.chartPie.toDataURL(), 'PNG', 20, y, 300, 200);
    doc.save('Attendance_Analytics.pdf');
  };
});
