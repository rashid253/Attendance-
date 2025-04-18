window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };

  // SETUP
  const schoolIn = $('schoolNameInput'),
        classSel = $('teacherClassSelect'),
        secSel   = $('teacherSectionSelect'),
        saveSet  = $('saveSetup'),
        formSet  = $('setupForm'),
        dispSet  = $('setupDisplay'),
        txtSet   = $('setupText'),
        editSet  = $('editSetup');

  saveSet.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) {
      return alert('Complete setup');
    }
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

  // STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const inputs = ['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress'].map($);
  const addBtn              = $('addStudent'),
        tblBody             = $('studentsBody'),
        selectAll           = $('selectAllStudents'),
        editSelected        = $('editSelected'),
        deleteSelected      = $('deleteSelected'),
        saveRegistration    = $('saveRegistration'),
        shareRegistration   = $('shareRegistration'),
        editRegistration    = $('editRegistration'),
        downloadRegPDF      = $('downloadRegistrationPDF');
  let registrationSaved = false,
      inlineEditMode    = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function renderStudents() {
    tblBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td class="select-col"><input type="checkbox" class="selectStudent" data-index="${i}" ${registrationSaved ? 'disabled' : ''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${registrationSaved ? '<button type="button" class="share">Share</button>' : ''}</td>`;
      if (registrationSaved) {
        tr.querySelector('.share').onclick = ev => {
          ev.preventDefault();
          const setup = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
          const msg = `${setup}
Name: ${s.name}
Adm#: ${s.adm}
Parent: ${s.parent}
Contact: ${s.contact}
Occupation: ${s.occupation}
Address: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      tblBody.appendChild(tr);
    });
    bindSelection();
  }

  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.selectStudent'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        const tr = cb.closest('tr');
        tr.classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelected.disabled   = !any;
        deleteSelected.disabled = !any;
      };
    });
    selectAll.disabled = registrationSaved;
    selectAll.onchange = () => {
      if (!registrationSaved) {
        boxes.forEach(cb => { cb.checked = selectAll.checked; cb.dispatchEvent(new Event('change')); });
      }
    };
  }

  deleteSelected.onclick = ev => {
    ev.preventDefault();
    if (!confirm('Delete selected students?')) return;
    Array.from(document.querySelectorAll('.selectStudent:checked'))
      .map(cb => +cb.dataset.index)
      .sort((a, b) => b - a)
      .forEach(idx => students.splice(idx, 1));
    saveStudents();
    renderStudents();
    selectAll.checked = false;
  };

  function onCellBlur(e) {
    const td = e.target,
          tr = td.closest('tr'),
          idx = +tr.querySelector('.selectStudent').dataset.index,
          ci  = Array.from(tr.children).indexOf(td),
          keys = ['name','adm','parent','contact','occupation','address'];
    if (ci >= 1 && ci <= 6) {
      students[idx][keys[ci - 1]] = td.textContent.trim();
      saveStudents();
    }
  }

  editSelected.onclick = ev => {
    ev.preventDefault();
    const selected = Array.from(document.querySelectorAll('.selectStudent:checked'));
    if (!selected.length) return;
    inlineEditMode = !inlineEditMode;
    editSelected.textContent = inlineEditMode ? 'Done Editing' : 'Edit Selected';
    selected.forEach(cb => {
      const tr = cb.closest('tr');
      Array.from(tr.querySelectorAll('td')).forEach((td, ci) => {
        if (ci >= 1 && ci <= 6) {
          td.contentEditable = inlineEditMode;
          td.classList.toggle('editing', inlineEditMode);
          inlineEditMode ? td.addEventListener('blur', onCellBlur) : td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  saveRegistration.onclick = ev => {
    ev.preventDefault();
    registrationSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.add('hidden'));
    shareRegistration.classList.remove('hidden');
    editRegistration.classList.remove('hidden');
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  editRegistration.onclick = ev => {
    ev.preventDefault();
    registrationSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id => $(id).classList.remove('hidden'));
    shareRegistration.classList.add('hidden');
    editRegistration.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegistration.onclick = ev => {
    ev.preventDefault();
    const setup = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s =>
      `Name: ${s.name}
Adm#: ${s.adm}
Parent: ${s.parent}
Contact: ${s.contact}
Occupation: ${s.occupation}
Address: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(setup + '\n\n' + lines)}`, '_blank');
  };

  addBtn.onclick = ev => {
    ev.preventDefault();
    if (registrationSaved) return;
    const vals = inputs.map(i => i.value.trim());
    if (!vals[0] || !vals[1]) return alert('Name & Adm# required');
    const [name, adm, parent, contact, occupation, address] = vals;
    students.push({ name, adm, parent, contact, occupation, address, roll: Date.now() });
    saveStudents();
    renderStudents();
    inputs.forEach(i => i.value = '');
  };

  downloadRegPDF.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html: '#studentTable', startY: 20 });
    doc.save('students_registration.pdf');
  };

  renderStudents();

  // ATTENDANCE MARKING & SUMMARY
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
  const dateIn          = $('dateInput'),
        loadAtt         = $('loadAttendance'),
        attList         = $('attendanceList'),
        saveAtt         = $('saveAttendance'),
        resSec          = $('attendance-result'),
        summaryBody     = $('summaryBody'),
        resetAtt        = $('resetAttendance'),
        shareSum        = $('shareAttendanceSummary'),
        downloadAttPDF  = $('downloadAttendancePDF');

  loadAtt.onclick = ev => {
    ev.preventDefault();
    if (!dateIn.value) return alert('Pick date');
    attList.innerHTML = '';
    students.forEach((s, i) => {
      const nameRow = document.createElement('div');
      nameRow.className = 'attendance-item';
      nameRow.textContent = s.name;
      const btnRow = document.createElement('div');
      btnRow.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'att-btn';
        b.dataset.code = code;
        b.textContent = code;
        if (attendanceData[dateIn.value]?.[s.roll] === code) {
          b.style.background = colors[code];
          b.style.color = '#fff';
        }
        b.onclick = ev2 => {
          ev2.preventDefault();
          Array.from(btnRow.children).forEach(x => {
            x.style.background = '';
            x.style.color = 'var(--dark)';
          });
          b.style.background = colors[code];
          b.style.color = '#fff';
        };
        btnRow.append(b);
      });
      attList.append(nameRow, btnRow);
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick = ev => {
    ev.preventDefault();
    const d = dateIn.value;
    attendanceData[d] = {};
    let idx = 0;
    attList.querySelectorAll('.attendance-actions').forEach(row => {
      const btn = row.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[idx].roll] = btn ? btn.dataset.code : 'Not marked';
      idx++;
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));

    $('attendance-section').classList.add('hidden');
    resSec.classList.remove('hidden');
    summaryBody.innerHTML = '';

    const setup = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    summaryBody.insertAdjacentHTML('beforebegin', `<tr><td colspan="3"><em>${setup} | Date: ${d}</em></td></tr>`);
    students.forEach(s => {
      const st = attendanceData[d][s.roll] || 'Not marked';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${st}</td><td><button type="button" class="send">Send</button></td>`;
      tr.querySelector('.send').onclick = ev2 => {
        ev2.preventDefault();
        const remark = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[st] || '';
        const msg = `${setup}
Date: ${d}
Name: ${s.name}
Status: ${st}
Remark: ${remark}`;
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      };
      summaryBody.appendChild(tr);
    });
  };

  resetAtt.onclick = ev => {
    ev.preventDefault();
    resSec.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    attList.innerHTML = '';
    saveAtt.classList.add('hidden');
    summaryBody.innerHTML = '';
  };

  shareSum.onclick = ev => {
    ev.preventDefault();
    const rows = Array.from(summaryBody.querySelectorAll('tr'))
      .map(r => r.textContent.trim()).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(rows)}`, '_blank');
  };

  downloadAttPDF.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html: '#attendanceSummaryTable', startY: 20 });
    doc.save('attendance_summary.pdf');
  };

  // ANALYTICS
  const analyticsType        = $('analyticsType'),
        analyticsDate        = $('analyticsDate'),
        analyticsMonth       = $('analyticsMonth'),
        semesterStart        = $('semesterStart'),
        semesterEnd          = $('semesterEnd'),
        yearStart            = $('yearStart'),
        loadAnalyticsBtn     = $('loadAnalytics'),
        resetAnalyticsBtn    = $('resetAnalytics'),
        instructionsEl       = $('instructions'),
        analyticsContainerEl = $('analyticsContainer'),
        graphsEl             = $('graphs'),
        analyticsActionsEl   = $('analyticsActions'),
        shareAnalyticsBtn    = $('shareAnalytics'),
        downloadAnalyticsBtn = $('downloadAnalytics'),
        barCtx               = document.getElementById('barChart').getContext('2d'),
        pieCtx               = document.getElementById('pieChart').getContext('2d');
  let barChart, pieChart;

  analyticsType.onchange = () => {
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart]
      .forEach(el => el.classList.add('hidden'));
    [instructionsEl, analyticsContainerEl, graphsEl, analyticsActionsEl, resetAnalyticsBtn]
      .forEach(el => el.classList.add('hidden'));

    switch (analyticsType.value) {
      case 'date': analyticsDate.classList.remove('hidden'); break;
      case 'month': analyticsMonth.classList.remove('hidden'); break;
      case 'semester':
        semesterStart.classList.remove('hidden');
        semesterEnd.classList.remove('hidden');
        break;
      case 'year': yearStart.classList.remove('hidden'); break;
    }
  };

  resetAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    analyticsType.value = '';
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart,
     instructionsEl, analyticsContainerEl, graphsEl, analyticsActionsEl, resetAnalyticsBtn]
      .forEach(el => el.classList.add('hidden'));
  };

  loadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    let from, to;
    if (analyticsType.value === 'date') {
      if (!analyticsDate.value) return alert('Pick a date');
      from = to = analyticsDate.value;
    } else if (analyticsType.value === 'month') {
      if (!analyticsMonth.value) return alert('Pick a month');
      from = analyticsMonth.value + '-01';
      to   = analyticsMonth.value + '-31';
    } else if (analyticsType.value === 'semester') {
      if (!semesterStart.value || !semesterEnd.value) return alert('Pick range');
      from = semesterStart.value + '-01';
      to   = semesterEnd.value + '-31';
    } else if (analyticsType.value === 'year') {
      if (!yearStart.value) return alert('Pick a year');
      from = yearStart.value + '-01-01';
      to   = yearStart.value + '-12-31';
    } else return;

    const stats = students.map(s => ({ name: s.name, P:0,A:0,Lt:0,HD:0,L:0, total:0 }));
    Object.entries(attendanceData).forEach(([date, recs]) => {
      if (date >= from && date <= to) {
        stats.forEach(st => {
          const code = recs[students.find(x => x.name === st.name).roll];
          if (code && st.hasOwnProperty(code)) st[code]++;
          st.total++;
        });
      }
    });

    // render table
    let html = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(st => {
      const pct = st.total ? ((st.P/st.total)*100).toFixed(1) : '0.0';
      html += `<tr><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${pct}</td></tr>`;
    });
    html += '</tbody></table>';
    analyticsContainerEl.innerHTML = html;
    analyticsContainerEl.classList.remove('hidden');
    instructionsEl.textContent = `Analytics from ${from} to ${to}`;
    instructionsEl.classList.remove('hidden');
    resetAnalyticsBtn.classList.remove('hidden');

    // charts
    const labels = stats.map(s => s.name);
    const dataPct = stats.map(s => s.total ? (s.P/s.total*100).toFixed(1) : 0);
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: { labels, datasets: [{ label: '% Present', data: dataPct }] },
      options: { responsive: true, maintainAspectRatio: true }
    });
    const agg = stats.reduce((a, s) => {
      ['P','A','Lt','HD','L'].forEach(c => a[c] += s[c]);
      return a;
    }, {P:0,A:0,Lt:0,HD:0,L:0});
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: { labels: ['P','A','Lt','HD','L'], datasets: [{ data: Object.values(agg) }] },
      options: { responsive: true, maintainAspectRatio: true }
    });
    graphsEl.classList.remove('hidden');
    analyticsActionsEl.classList.remove('hidden');
  };

  shareAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    const text = Array.from(analyticsContainerEl.querySelectorAll('table tr'))
      .map(r => r.textContent.trim()).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  downloadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(instructionsEl.textContent, 14, 20);
    doc.autoTable({ html: '#analyticsContainer table', startY: 40 });
    // embed charts on new pages without slant
    const barImg = barChart.toBase64Image();
    doc.addPage();
    doc.text('Attendance Bar Chart', 14, 20);
    doc.addImage(barImg, 'PNG', 14, 40, 550, 300);
    const pieImg = pieChart.toBase64Image();
    doc.addPage();
    doc.text('Attendance Pie Chart', 14, 20);
    doc.addImage(pieImg, 'PNG', 14, 40, 550, 300);
    doc.save('analytics_report.pdf');
  };
});
