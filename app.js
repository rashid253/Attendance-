window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };

  // SETUP
  const schoolIn = $('schoolNameInput');
  const classSel = $('teacherClassSelect');
  const secSel = $('teacherSectionSelect');
  const saveSetupBtn = $('saveSetup');
  const setupForm = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText = $('setupText');
  const editSetupBtn = $('editSetup');

  function loadSetup() {
    const school = localStorage.getItem('schoolName');
    const cls = localStorage.getItem('teacherClass');
    const sec = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetupBtn.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };

  editSetupBtn.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };

  loadSetup();

  // STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const studentNameIn = $('studentName');
  const admissionNoIn = $('admissionNo');
  const parentNameIn = $('parentName');
  const parentContactIn = $('parentContact');
  const parentOccupationIn = $('parentOccupation');
  const parentAddressIn = $('parentAddress');
  const addStudentBtn = $('addStudent');
  const studentsBody = $('studentsBody');

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = [
        `<td><input type="checkbox" class="sel" data-index="${i}"></td>`,
        `<td>${s.name}</td>`,
        `<td>${s.adm}</td>`,
        `<td>${s.parentName}</td>`,
        `<td>${s.contact}</td>`,
        `<td>${s.occupation}</td>`,
        `<td>${s.address}</td>`,
        `<td><button class="share-one" data-index="${i}">Share</button></td>`
      ].join('');
      studentsBody.appendChild(tr);
    });
    document.querySelectorAll('.share-one').forEach(btn => {
      btn.onclick = ev => {
        const idx = +btn.dataset.index;
        const s = students[idx];
        const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
        const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parentName}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      };
    });
  }

  addStudentBtn.onclick = ev => {
    ev.preventDefault();
    const name = studentNameIn.value.trim();
    const adm = admissionNoIn.value.trim();
    const parentName = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occupation = parentOccupationIn.value.trim();
    const address = parentAddressIn.value.trim();

    if (!name || !adm || !parentName || !contact || !occupation || !address) {
      return alert('All fields are required.');
    }
    if (!/^[0-9]+$/.test(adm)) {
      return alert('Admission number must be numeric.');
    }
    if (students.some(s => s.adm === adm)) {
      return alert('Admission number already exists.');
    }
    if (!/^\d{7,15}$/.test(contact)) {
      return alert('Contact must be 7–15 digits.');
    }

    students.push({ name, adm, parentName, contact, occupation, address });
    saveStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccupationIn, parentAddressIn].forEach(i => i.value = '');
  };

  renderStudents();

  // ATTENDANCE
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
  const dateInput = $('dateInput');
  const loadAttBtn = $('loadAttendance');
  const attList = $('attendanceList');
  const saveAttBtn = $('saveAttendance');

  loadAttBtn.onclick = ev => {
    ev.preventDefault();
    if (!dateInput.value) return alert('Pick a date');
    attList.innerHTML = '';
    students.forEach(s => {
      const row = document.createElement('div');
      row.className = 'attendance-item';
      row.textContent = s.name;
      const btns = document.createElement('div'); btns.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'att-btn'; b.dataset.code = code; b.textContent = code;
        if (attendanceData[dateInput.value]?.[s.adm] === code) {
          b.style.background = colors[code]; b.style.color = '#fff';
        }
        b.onclick = () => {
          btns.querySelectorAll('.att-btn').forEach(x => { x.style.background = ''; x.style.color = 'var(--dark)'; });
          b.style.background = colors[code]; b.style.color = '#fff';
        };
        btns.append(b);
      });
      attList.append(row, btns);
    });
    saveAttBtn.classList.remove('hidden');
  };

  saveAttBtn.onclick = ev => {
    ev.preventDefault();
    const d = dateInput.value;
    attendanceData[d] = {};
    attList.querySelectorAll('.attendance-actions').forEach((btns,i) => {
      const sel = btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].adm] = sel ? sel.dataset.code : 'A';
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    document.getElementById('attendance-section').classList.add('hidden');
    $('attendance-result').classList.remove('hidden');
    // build summary table
    const summaryBody = $('summaryBody'); summaryBody.innerHTML = '';
    const hdr = `Date: ${d}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    students.forEach(s => {
      const code = attendanceData[d][s.adm] || 'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick = () => {
        const msg = `${hdr}\n\nName: ${s.name}\nStatus: ${status}`;
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      };
      summaryBody.append(tr);
    });
  };

  $('resetAttendance').onclick = ev => {
    ev.preventDefault();
    $('attendance-section').classList.remove('hidden');
    $('attendance-result').classList.add('hidden');
    attList.innerHTML = '';
    saveAttBtn.classList.add('hidden');
  };

  // ANALYTICS
  const analyticsType = $('analyticsType');
  const analyticsDate = $('analyticsDate');
  const analyticsMonth = $('analyticsMonth');
  const semesterStart = $('semesterStart');
  const semesterEnd = $('semesterEnd');
  const yearStart = $('yearStart');
  const loadAnalyticsBtn = $('loadAnalytics');
  const resetAnalyticsBtn = $('resetAnalytics');
  const instructionsEl = $('instructions');
  const analyticsContainer = $('analyticsContainer');
  const graphsEl = $('graphs');
  const shareAnalyticsBtn = $('shareAnalytics');
  const downloadAnalyticsBtn = $('downloadAnalytics');
  let barChart, pieChart;

  analyticsType.onchange = () => {
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart, instructionsEl, analyticsContainer, graphsEl, shareAnalyticsBtn, downloadAnalyticsBtn, resetAnalyticsBtn]
      .forEach(el => el.classList.add('hidden'));
    if (analyticsType.value === 'date') analyticsDate.classList.remove('hidden');
    if (analyticsType.value === 'month') analyticsMonth.classList.remove('hidden');
    if (analyticsType.value === 'semester') { semesterStart.classList.remove('hidden'); semesterEnd.classList.remove('hidden'); }
    if (analyticsType.value === 'year') yearStart.classList.remove('hidden');
  };

  resetAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    analyticsType.value = '';
    analyticsType.dispatchEvent(new Event('change'));
  };

  loadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    let from, to;
    const t = analyticsType.value;
    if (t==='date') { if(!analyticsDate.value) return alert('Pick a date'); from=to=analyticsDate.value; }
    else if (t==='month') { if(!analyticsMonth.value) return alert('Pick a month'); const [y,m]=analyticsMonth.value.split('-'); from=`${y}-${m}-01`; to=`${y}-${m}-${new Date(y,m,0).getDate()}`; }
    else if (t==='semester') { if(!semesterStart.value||!semesterEnd.value) return alert('Pick range'); const [ys,ms]=semesterStart.value.split('-'); const [ye,me]=semesterEnd.value.split('-'); if(semesterStart.value>semesterEnd.value) return alert('Start must be ≤ end'); from=`${ys}-${ms}-01`; to=`${ye}-${me}-${new Date(ye,me,0).getDate()}`; }
    else if (t==='year') { if(!yearStart.value) return alert('Pick a year'); from=`${yearStart.value}-01-01`; to=`${yearStart.value}-12-31`; }
    else return;

    // compute stats
    const stats = students.map(s=>({ name: s.name, adm: s.adm, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    Object.entries(attendanceData).forEach(([d,recs])=>{ if(d>=from&&d<=to) stats.forEach(st=>{ const c=recs[st.adm]||'A'; st[c]++; st.total++; }); });

    // build table
    let html = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
    stats.forEach(s=>{ const pct=s.total?((s.P/s.total)*100).toFixed(1):'0.0'; html+=`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`; });
    html+='</tbody></table>';
    analyticsContainer.innerHTML=html;
    analyticsContainer.classList.remove('hidden');
    instructionsEl.textContent=`Report: ${from} to ${to}`;
    instructionsEl.classList.remove('hidden');
    resetAnalyticsBtn.classList.remove('hidden');

    // charts
    const labels=stats.map(s=>s.name);
    const dataPct=stats.map(s=>s.total?s.P/s.total*100:0);
    if(barChart) barChart.destroy();
    barChart=new Chart($('barChart'),{type:'bar',data:{labels,datasets:[{label:'% Present',data:dataPct}]}});
    const agg=stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]); return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    if(pieChart) pieChart.destroy();
    pieChart=new Chart($('pieChart'),{type:'pie',data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg)}]}});
    graphsEl.classList.remove('hidden');
  };

  shareAnalyticsBtn.onclick = () => {
    const period = instructionsEl.textContent.replace('Report: ','');
    const hdr = `Date Range: ${period}\nSchool: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const rows = Array.from(analyticsContainer.querySelectorAll('tbody tr')).map(r=>Array.from(r.cells).slice(0,8).map(td=>td.textContent).join(' ')).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows)}`,'_blank');
  };

  downloadAnalyticsBtn.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    doc.autoTable({ html: analyticsContainer.querySelector('table'), startY: 40 });
    doc.save('analytics_report.pdf');
  };
});
