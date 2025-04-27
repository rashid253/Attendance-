// app.js

// idb-keyval (global window.idbKeyval)
const { get, set } = window.idbKeyval;

window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  // STORAGE
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};
  const saveStudents       = () => set('students', students);
  const saveAttendanceData = () => set('attendanceData', attendanceData);

  // ADM# GENERATOR
  const getLastAdmNo = async () => (await get('lastAdmissionNo')) || 0;
  const setLastAdmNo = n => set('lastAdmissionNo', n);
  const generateAdmNo = async () => {
    const last = await getLastAdmNo(), next = last + 1;
    setLastAdmNo(next);
    return String(next).padStart(4, '0');
  };

  // ELEMENTS
  const schoolInput    = $('schoolNameInput'),
        classSelect    = $('teacherClassSelect'),
        sectionSelect  = $('teacherSectionSelect'),
        btnSaveSetup   = $('saveSetup'),
        setupForm      = $('setupForm'),
        setupDisplay   = $('setupDisplay'),
        setupText      = $('setupText'),
        btnEditSetup   = $('editSetup'),

        nameInput      = $('studentName'),
        parentInput    = $('parentName'),
        contactInput   = $('parentContact'),
        occInput       = $('parentOccupation'),
        addrInput      = $('parentAddress'),
        btnAddStudent  = $('addStudent'),
        tbodyStudents  = $('studentsBody'),
        chkAllStudents = $('selectAllStudents'),
        btnEditSel     = $('editSelected'),
        btnDeleteSel   = $('deleteSelected'),
        btnSaveReg     = $('saveRegistration'),
        btnShareReg    = $('shareRegistration'),
        btnEditReg     = $('editRegistration'),
        btnDownloadReg = $('downloadRegistrationPDF'),

        dateInput      = $('dateInput'),
        btnLoadAtt     = $('loadAttendance'),
        divAttList     = $('attendanceList'),
        btnSaveAtt     = $('saveAttendance'),
        sectionResult  = $('attendance-result'),
        tbodySummary   = $('summaryBody'),
        btnResetAtt    = $('resetAttendance'),
        btnShareAtt    = $('shareAttendanceSummary'),
        btnDownloadAtt = $('downloadAttendancePDF'),

        selectAnalyticsTarget  = $('analyticsTarget'),
        analyticsSectionSelect = $('analyticsSectionSelect'),
        analyticsAdmInput      = $('analyticsAdmInput'),
        selectAnalyticsType    = $('analyticsType'),
        inputAnalyticsDate     = $('analyticsDate'),
        inputAnalyticsMonth    = $('analyticsMonth'),
        inputSemesterStart     = $('semesterStart'),
        inputSemesterEnd       = $('semesterEnd'),
        inputAnalyticsYear     = $('yearStart'),
        btnLoadAnalytics       = $('loadAnalytics'),
        btnResetAnalytics      = $('resetAnalytics'),
        divInstructions        = $('instructions'),
        divAnalyticsTable      = $('analyticsContainer'),
        divGraphs              = $('graphs'),
        btnShareAnalytics      = $('shareAnalytics'),
        btnDownloadAnalytics   = $('downloadAnalytics'),
        ctxBar                 = $('barChart').getContext('2d'),
        ctxPie                 = $('pieChart').getContext('2d'),

        monthInput     = $('registerMonth'),
        btnLoadReg     = $('loadRegister'),
        btnChangeReg   = $('changeRegister'),
        divRegTable    = $('registerTableWrapper'),
        tbodyReg       = $('registerBody'),
        divRegSummary  = $('registerSummarySection'),
        tbodyRegSum    = $('registerSummaryBody'),
        btnShareReg2   = $('shareRegister'),
        btnDownloadReg2= $('downloadRegisterPDF'),
        headerRegRowEl = document.querySelector('#registerTable thead tr');

  let registrationSaved = false, chartBar, chartPie;
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // HELPERS
  const filteredStudents = () => students.filter(s => s.cls === classSelect.value && s.sec === sectionSelect.value);

  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target / 100);
      (function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
      })();
    });
  }

  function updateTotals() {
    const totalSchool  = students.length;
    const totalClass   = students.filter(s => s.cls === classSelect.value).length;
    const totalSection = filteredStudents().length;
    [['sectionCount', totalSection], ['classCount', totalClass], ['schoolCount', totalSchool]]
      .forEach(([id,val]) => $(id).dataset.target = val);
    animateCounters();
  }

  function bindRowSelection() {
    const boxes = Array.from(tbodyStudents.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        btnEditSel.disabled = btnDeleteSel.disabled = !any;
      };
    });
    chkAllStudents.onchange = () => boxes.forEach(cb => {
      cb.checked = chkAllStudents.checked;
      cb.dispatchEvent(new Event('change'));
    });
  }

  function renderStudents() {
    tbodyStudents.innerHTML = '';
    filteredStudents().forEach((s, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" data-index="${idx}" ${registrationSaved?'disabled':''}></td>
        <td>${idx+1}</td><td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>
        <td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>${registrationSaved?'<button class="share-one">Share</button>':''}</td>
      `;
      if (registrationSaved) {
        tr.querySelector('.share-one').onclick = () => {
          window.open(`https://wa.me/?text=${encodeURIComponent(`Name:${s.name}\nAdm#:${s.adm}`)}`);
        };
      }
      tbodyStudents.appendChild(tr);
    });
    bindRowSelection();
    updateTotals();
  }

  // SETUP
  async function loadSetup() {
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if (school && cls && sec) {
      schoolInput.value   = school;
      classSelect.value   = cls;
      sectionSelect.value = sec;
      setupText.textContent = `${school} | Class:${cls} | Sec:${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
      renderStudents();
    }
  }
  btnSaveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolInput.value||!classSelect.value||!sectionSelect.value) return alert('Complete setup');
    await set('schoolName', schoolInput.value);
    await set('teacherClass', classSelect.value);
    await set('teacherSection', sectionSelect.value);
    await loadSetup();
  };
  btnEditSetup.onclick = e => { e.preventDefault(); setupForm.classList.remove('hidden'); setupDisplay.classList.add('hidden'); };
  await loadSetup();

  // STUDENT REGISTRATION
  btnAddStudent.onclick = async e => {
    e.preventDefault();
    const [name,parent,cont,occ,addr] = [nameInput,parentInput,contactInput,occInput,addrInput].map(i=>i.value.trim());
    if (!name||!parent||!cont||!occ||!addr) return alert('All fields required');
    if (!/^\d{7,15}$/.test(cont)) return alert('Contact must be 7–15 digits');
    const adm = await generateAdmNo();
    students.push({name,adm,parent,contact:cont,occupation:occ,address:addr,roll:Date.now(),cls:classSelect.value,sec:sectionSelect.value});
    await saveStudents();
    renderStudents();
    [nameInput,parentInput,contactInput,occInput,addrInput].forEach(i=>i.value='');
  };

  btnEditSel.onclick = e => {
    e.preventDefault();
    Array.from(tbodyStudents.querySelectorAll('.sel:checked')).forEach(cb => {
      const tr = cb.closest('tr');
      tr.querySelectorAll('td').forEach((td,ci) => {
        if (ci>=2&&ci<=7) {
          td.contentEditable = true;
          td.onblur = () => {
            const keys = ['name','adm','parent','contact','occupation','address'];
            const idx = +cb.dataset.index, val = td.textContent.trim();
            if (ci===3 && !/^\d+$/.test(val)) return alert('Adm# numeric') && renderStudents();
            filteredStudents()[idx][keys[ci-2]] = val;
            saveStudents();
          };
        }
      });
    });
  };

  btnDeleteSel.onclick = async e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    const toRemove = Array.from(tbodyStudents.querySelectorAll('.sel:checked'))
                       .map(cb => filteredStudents()[+cb.dataset.index].roll);
    students = students.filter(s => !toRemove.includes(s.roll));
    await saveStudents();
    renderStudents();
  };

  btnSaveReg.onclick = e => {
    e.preventDefault();
    registrationSaved = true;
    ['saveRegistration','editSelected','deleteSelected','selectAllStudents']
      .forEach(id=>$(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id=>$(id).classList.remove('hidden'));
    renderStudents();
  };

  btnEditReg.onclick = e => {
    e.preventDefault();
    registrationSaved = false;
    ['saveRegistration','editSelected','deleteSelected','selectAllStudents']
      .forEach(id=>$(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF']
      .forEach(id=>$(id).classList.add('hidden'));
    renderStudents();
  };

  btnShareReg.onclick = e => {
    e.preventDefault();
    const hdr = `Students Report\nClass:${classSelect.value} Sec:${sectionSelect.value}`;
    const lines = filteredStudents().map(s=>`${s.name}(${s.adm})`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+"\n"+lines.join("\n"))}`);
  };

  btnDownloadReg.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html:'#studentTable', startY:10 });
    doc.save('registration.pdf');
  };

  // ATTENDANCE
  btnLoadAtt.onclick = e => {
    e.preventDefault();
    if (!dateInput.value) return alert('Pick a date');
    divAttList.innerHTML = '';
    filteredStudents().forEach(s => {
      const row = document.createElement('div'); row.textContent = s.name;
      const acts = document.createElement('div'); acts.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(c => {
        const b = document.createElement('button'); b.textContent = c;
        b.onclick = () => {
          acts.querySelectorAll('button').forEach(x=>{x.style='';});
          b.style.background=colors[c]; b.style.color='#fff';
        };
        acts.appendChild(b);
      });
      divAttList.append(row, acts);
    });
    btnSaveAtt.classList.remove('hidden');
  };

  btnSaveAtt.onclick = async e => {
    e.preventDefault();
    const d = dateInput.value;
    attendanceData[d] = {};
    divAttList.querySelectorAll('.attendance-actions').forEach((acts,i) => {
      const b = acts.querySelector('button[style]');
      attendanceData[d][filteredStudents()[i].roll] = b ? b.textContent : 'A';
    });
    await saveAttendanceData();
    sectionResult.classList.remove('hidden');
    tbodySummary.innerHTML = '';
    filteredStudents().forEach(s => {
      const code = attendanceData[d][s.roll],
            status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick = () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(`Name:${s.name}\nStatus:${status}`)}`);
      };
      tbodySummary.appendChild(tr);
    });
  };

  btnShareAtt.onclick = () => {
    const d = dateInput.value;
    const hdr = `*Attendance Summary*\nDate: ${d}\nClass: ${classSelect.value}-${sectionSelect.value}`;
    const lines = filteredStudents().map(s => {
      const code = attendanceData[d][s.roll] || 'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      return `${s.name}: ${status}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + "\n\n" + lines.join("\n"))}`, '_blank');
  };

  btnDownloadAtt.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({
      head: [['Name','Status']],
      body: filteredStudents().map(s => {
        const code = attendanceData[dateInput.value][s.roll],
              status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
        return [s.name, status];
      }),
      startY:10
    });
    doc.save('attendance.pdf');
  };

  // ANALYTICS
  function resetAnalyticsUI() {
    ['labelSection','analyticsSectionSelect','analyticsAdmInput']
      .forEach(id=>$(id).classList.add('hidden'));
    selectAnalyticsType.disabled = true;
    [inputAnalyticsDate,inputAnalyticsMonth,inputSemesterStart,inputSemesterEnd,inputAnalyticsYear,
     btnResetAnalytics,divAnalyticsTable,divGraphs,btnShareAnalytics,btnDownloadAnalytics]
      .forEach(el=>el.classList.add('hidden'));
    selectAnalyticsTarget.value = '';
    analyticsAdmInput.value = '';
    selectAnalyticsType.value = '';
  }
  resetAnalyticsUI();

  selectAnalyticsTarget.onchange = () => {
    resetAnalyticsUI();
    // enable period select immediately
    selectAnalyticsType.disabled = false;
    if (selectAnalyticsTarget.value === 'section') {
      $('labelSection').classList.remove('hidden');
      analyticsSectionSelect.classList.remove('hidden');
    }
    if (selectAnalyticsTarget.value === 'student') {
      analyticsAdmInput.classList.remove('hidden');
    }
  };

  selectAnalyticsType.onchange = () => {
    [inputAnalyticsDate,inputAnalyticsMonth,inputSemesterStart,inputSemesterEnd,inputAnalyticsYear]
      .forEach(i=>i.classList.add('hidden'));
    btnResetAnalytics.classList.remove('hidden');
    if (selectAnalyticsType.value === 'date')   inputAnalyticsDate.classList.remove('hidden');
    if (selectAnalyticsType.value === 'month')  inputAnalyticsMonth.classList.remove('hidden');
    if (selectAnalyticsType.value === 'semester') {
      inputSemesterStart.classList.remove('hidden');
      inputSemesterEnd.classList.remove('hidden');
    }
    if (selectAnalyticsType.value === 'year')   inputAnalyticsYear.classList.remove('hidden');
  };

  btnLoadAnalytics.onclick = e => {
    e.preventDefault();
    let from, to;
    const t = selectAnalyticsType.value;
    if (t === 'date') {
      from = to = inputAnalyticsDate.value || alert('Pick date');
    } else if (t === 'month') {
      const [y,m] = inputAnalyticsMonth.value.split('-').map(Number);
      from = `${inputAnalyticsMonth.value}-01`;
      to   = `${inputAnalyticsMonth.value}-${new Date(y,m,0).getDate()}`;
    } else if (t === 'semester') {
      const [sy,sm] = inputSemesterStart.value.split('-').map(Number);
      const [ey,em] = inputSemesterEnd.value.split('-').map(Number);
      from = `${inputSemesterStart.value}-01`;
      to   = `${inputSemesterEnd.value}-${new Date(ey,em,0).getDate()}`;
    } else if (t === 'year') {
      from = `${inputAnalyticsYear.value}-01-01`;
      to   = `${inputAnalyticsYear.value}-12-31`;
    } else {
      return alert('Select period');
    }

    let pool = [];
    if (selectAnalyticsTarget.value === 'class')   pool = students.filter(s=>s.cls===classSelect.value);
    if (selectAnalyticsTarget.value === 'section') pool = filteredStudents();
    if (selectAnalyticsTarget.value === 'student') pool = students.filter(s=>s.adm===analyticsAdmInput.value.trim());

    const stats = pool.map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs]) => {
      if (d>=from&&d<=to) stats.forEach(st=>{ const c=recs[st.roll]||'A'; st[c]++; st.total++; });
    });

    divAnalyticsTable.innerHTML = `
      <table>
        <thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>%</th></tr></thead>
        <tbody>${stats.map(s=>`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total?((s.P/s.total)*100).toFixed(1):'0.0'}</td></tr>`).join('')}</tbody>
      </table>`;
    divAnalyticsTable.classList.remove('hidden');
    divInstructions.textContent = `Report: ${from} to ${to}`;
    divInstructions.classList.remove('hidden');

    chartBar?.destroy();
    chartBar = new Chart(ctxBar, {
      type:'bar',
      data:{ labels:stats.map(s=>s.name), datasets:[{label:'% Present',data:stats.map(s=>s.total?s.P/s.total*100:0)}]},
      options:{scales:{y:{beginAtZero:true,max:100}}}
    });

    const agg = stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    chartPie?.destroy();
    chartPie = new Chart(ctxPie, {
      type:'pie',
      data:{ labels:['P','A','Lt','HD','L'], datasets:[{data:Object.values(agg)}] }
    });

    divGraphs.classList.remove('hidden');
    btnShareAnalytics.classList.remove('hidden');
    btnDownloadAnalytics.classList.remove('hidden');
  };

  btnDownloadAnalytics.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ html:'#analyticsContainer table', startY:10 });
    doc.save('analytics.pdf');
  };

  btnShareAnalytics.onclick = e => {
    e.preventDefault();
    const hdr = `Analytics Report\n${divInstructions.textContent}`;
    const rows = Array.from(divAnalyticsTable.querySelectorAll('tbody tr')).map(r =>
      Array.from(r.querySelectorAll('td')).map(td=>td.textContent).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+"\n"+rows.join("\n"))}`);
  };

  // REGISTER (unchanged)...

  // SERVICE WORKER
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  }
});
