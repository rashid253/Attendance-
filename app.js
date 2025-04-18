window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };

  // --- SETUP ---
  const schoolIn = $('schoolNameInput'), classSel = $('teacherClassSelect'), secSel = $('teacherSectionSelect');
  const saveSet = $('saveSetup'), formSet = $('setupForm'), dispSet = $('setupDisplay'), txtSet = $('setupText'), editSet = $('editSetup');
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
    const s = localStorage.getItem('schoolName'), c = localStorage.getItem('teacherClass'), e = localStorage.getItem('teacherSection');
    if (s && c && e) {
      schoolIn.value = s; classSel.value = c; secSel.value = e;
      txtSet.textContent = `${s} 🏫 | Class: ${c} | Section: ${e}`;
      formSet.classList.add('hidden');
      dispSet.classList.remove('hidden');
    }
  }
  loadSetup();

  // --- STUDENT REGISTRATION ---
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const inputs = ['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress'].map($);
  const addBtn = $('addStudent'), tblBody = $('studentsBody');
  const selectAll = $('selectAllStudents'), editSelected = $('editSelected'), deleteSelected = $('deleteSelected');
  const saveRegistration = $('saveRegistration'), shareRegistration = $('shareRegistration'), editRegistration = $('editRegistration');
  let registrationSaved = false, inlineEditMode = false;

  function saveStudents() { localStorage.setItem('students', JSON.stringify(students)); }
  function renderStudents() {
    tblBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td class="select-col"><input type="checkbox" class="selectStudent" data-index="${i}" ${registrationSaved?'disabled':''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${registrationSaved?'<button class="share">Share</button>':''}</td>`;
      if (registrationSaved) {
        tr.querySelector('.share').onclick = () => {
          const setup = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
          const msg = `${setup}\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      tblBody.appendChild(tr);
    });
    bindSelection();
  }

  function bindSelection() {
    const boxes = [...document.querySelectorAll('.selectStudent')];
    boxes.forEach(cb => {
      cb.onchange = () => {
        const tr = cb.closest('tr');
        tr.classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelected.disabled = !any;
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

  deleteSelected.onclick = () => {
    if (!confirm('Delete selected students?')) return;
    [...document.querySelectorAll('.selectStudent:checked')]
      .map(cb => +cb.dataset.index)
      .sort((a, b) => b - a)
      .forEach(idx => students.splice(idx, 1));
    saveStudents(); renderStudents(); selectAll.checked = false;
  };

  function onCellBlur(e) {
    const td = e.target, tr = td.closest('tr');
    const idx = +tr.querySelector('.selectStudent').dataset.index;
    const ci = Array.from(tr.children).indexOf(td);
    const keys = ['name','adm','parent','contact','occupation','address'];
    if (ci >= 1 && ci <= 6) {
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  }

  editSelected.onclick = () => {
    const selected = [...document.querySelectorAll('.selectStudent:checked')];
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

  saveRegistration.onclick = () => {
    registrationSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.add('hidden'));
    $('shareRegistration').classList.remove('hidden');
    $('editRegistration').classList.remove('hidden');
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  editRegistration.onclick = () => {
    registrationSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.remove('hidden'));
    $('shareRegistration').classList.add('hidden');
    $('editRegistration').classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegistration.onclick = () => {
    const setup = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s =>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(setup + '\n\n' + lines)}`, '_blank');
  };

  addBtn.onclick = () => {
    if (registrationSaved) return;
    const vals = inputs.map(i => i.value.trim());
    if (!vals[0] || !vals[1]) return alert('Name & Adm# required');
    const [name, adam, parent, contact, occupation, address] = vals;
    students.push({ name, adm: adam, parent, contact, occupation, address, roll: Date.now() });
    saveStudents(); renderStudents(); inputs.forEach(i => i.value = '');
  };

  renderStudents();

  // --- ATTENDANCE MARKING & SUMMARY ---
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
  const dateIn = $('dateInput'), loadAtt = $('loadAttendance'), attList = $('attendanceList'), saveAtt = $('saveAttendance');
  const resSec = $('attendance-result'), summaryBody = $('summaryBody'), resetAtt = $('resetAttendance');
  const shareSum = $('shareAttendanceSummary'), downloadSum = $('downloadAttendanceSummary');

  loadAtt.onclick = () => {
    if (!dateIn.value) return alert('Pick date');
    attList.innerHTML = '';
    students.forEach((s, i) => {
      const nameRow = document.createElement('div'); nameRow.className = 'attendance-item'; nameRow.textContent = s.name;
      const btnRow = document.createElement('div'); btnRow.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button'); b.className = 'att-btn'; b.dataset.code = code; b.textContent = code;
        if (attendanceData[dateIn.value]?.[s.roll] === code) {
          b.style.background = colors[code]; b.style.color = '#fff';
        }
        b.onclick = () => {
          Array.from(btnRow.children).forEach(x => { x.style.background=''; x.style.color='var(--dark)'; });
          b.style.background = colors[code]; b.style.color = '#fff';
        };
        btnRow.append(b);
      });
      attList.append(nameRow, btnRow);
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick = () => {
    const d = dateIn.value; attendanceData[d] = {};
    Array.from(attList.children).reduce((rowIdx, el) => {
      if (el.classList.contains('attendance-actions')) {
        const btn = el.querySelector('.att-btn[style*="background"]');
        attendanceData[d][students[rowIdx].roll] = btn ? btn.dataset.code : 'Not marked';
        return rowIdx + 1;
      }
      return rowIdx;
    }, 0);
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    $('attendance-section').classList.add('hidden');
    resSec.classList.remove('hidden');
    summaryBody.innerHTML = '';
    const setup = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    summaryBody.insertAdjacentHTML('beforebegin', `<tr><td colspan="3"><em>${setup} | Date: ${d}</em></td></tr>`);
    students.forEach(s => {
      const st = attendanceData[d][s.roll] || 'Not marked';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${st}</td><td><button class="send">Send</button></td>`;
      tr.querySelector('.send').onclick = () => {
        const remark = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[st]||'';
        const msg = `${setup}\nDate: ${d}\nName: ${s.name}\nStatus: ${st}\nRemark: ${remark}`;
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

  shareSum.onclick = () => {
    const rows = Array.from(summaryBody.querySelectorAll('tr')).map(r => r.textContent.trim()).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(rows)}`, '_blank');
  };

  downloadSum.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html: 'table', startY: 20 });
    doc.save('attendance_summary.pdf');
  };

  // --- ANALYTICS ---
  const analyticsType = $('analyticsType'),
        analyticsDate = $('analyticsDate'),
        analyticsMonth = $('analyticsMonth'),
        semesterStart = $('semesterStart'),
        semesterEnd = $('semesterEnd'),
        yearStart = $('yearStart'),
        loadAnalytics = $('loadAnalytics'),
        resetAnalytics = $('resetAnalytics'),
        instructions = $('instructions'),
        analyticsContainer = $('analyticsContainer'),
        graphs = $('graphs'),
        analyticsActions = $('analyticsActions'),
        shareAnalytics = $('shareAnalytics'),
        downloadAnalytics = $('downloadAnalytics'),
        barCtx = document.getElementById('barChart').getContext('2d'),
        pieCtx = document.getElementById('pieChart').getContext('2d');
  let barChart, pieChart;

  analyticsType.onchange = () => {
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart].forEach(el => el.classList.add('hidden'));
    resetAnalytics.classList.add('hidden');
    instructions.textContent = '';
    analyticsContainer.classList.add('hidden');
    graphs.classList.add('hidden');
    analyticsActions.classList.add('hidden');
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

  resetAnalytics.onclick = () => {
    analyticsType.value = '';
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart].forEach(el => el.classList.add('hidden'));
    resetAnalytics.classList.add('hidden');
    instructions.classList.add('hidden');
    analyticsContainer.classList.add('hidden');
    graphs.classList.add('hidden');
    analyticsActions.classList.add('hidden');
  };

  loadAnalytics.onclick = () => {
    // determine date range
    let from, to;
    if (analyticsType.value === 'date') {
      if (!analyticsDate.value) return alert('Pick a date');
      from = to = analyticsDate.value;
    } else if (analyticsType.value === 'month') {
      if (!analyticsMonth.value) return alert('Pick a month');
      from = analyticsMonth.value + '-01';
      to = analyticsMonth.value + '-31';
    } else if (analyticsType.value === 'semester') {
      if (!semesterStart.value || !semesterEnd.value) return alert('Pick semester range');
      from = semesterStart.value + '-01';
      to = semesterEnd.value + '-31';
    } else if (analyticsType.value === 'year') {
      if (!yearStart.value) return alert('Pick a year');
      from = yearStart.value + '-01-01';
      to = yearStart.value + '-12-31';
    } else return;

    // collect stats
    const stats = students.map(s => ({ name: s.name, P:0, A:0, Lt:0, HD:0, L:0, total:0 }));
    Object.entries(attendanceData).forEach(([date, recs]) => {
      if (date >= from && date <= to) {
        stats.forEach(st => {
          const code = recs[students.find(x=>x.name===st.name).roll];
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
    analyticsContainer.innerHTML = html;
    analyticsContainer.classList.remove('hidden');
    instructions.textContent = `Showing ${analyticsType.value} analytics from ${from} to ${to}`;
    instructions.classList.remove('hidden');
    resetAnalytics.classList.remove('hidden');

    // charts
    const labels = stats.map(s => s.name);
    const dataPct = stats.map(s => s.total? (s.P/s.total*100).toFixed(1):0);
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, { type:'bar', data:{ labels, datasets:[{ label:'% Present', data:dataPct }] } });
    const agg = stats.reduce((a, s) => { ['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]); return a; }, {P:0,A:0,Lt:0,HD:0,L:0});
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, { type:'pie', data:{ labels:['P','A','Lt','HD','L'], datasets:[{ data:Object.values(agg) }] } });
    graphs.classList.remove('hidden');
    analyticsActions.classList.remove('hidden');
  };

  shareAnalytics.onclick = () => {
    const text = Array.from(analyticsContainer.querySelectorAll('table tr')).map(r=>r.textContent.trim()).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  downloadAnalytics.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(instructions.textContent, 10, 10);
    doc.autoTable({ html: '#analyticsContainer table', startY: 20 });
    doc.save('analytics.pdf');
  };
});
