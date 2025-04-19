// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };

  //
  // 1. SETUP
  //
  const schoolIn      = $('schoolNameInput'),
        classSel      = $('teacherClassSelect'),
        secSel        = $('teacherSectionSelect'),
        saveSetupBtn  = $('saveSetup'),
        setupForm     = $('setupForm'),
        setupDisplay  = $('setupDisplay'),
        setupText     = $('setupText'),
        editSetupBtn  = $('editSetup');

  function loadSetup() {
    const school = localStorage.getItem('schoolName'),
          cls    = localStorage.getItem('teacherClass'),
          sec    = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value        = school;
      classSel.value        = cls;
      secSel.value          = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetupBtn.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) {
      alert('Complete setup'); return;
    }
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

  //
  // 2. STUDENT REGISTRATION
  //
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const studentNameIn     = $('studentName'),
        admissionNoIn     = $('admissionNo'),
        parentNameIn      = $('parentName'),
        parentContactIn   = $('parentContact'),
        parentOccupationIn= $('parentOccupation'),
        parentAddressIn   = $('parentAddress'),
        addStudentBtn     = $('addStudent'),
        studentsBody      = $('studentsBody'),
        selectAllChk      = $('selectAllStudents'),
        editSelectedBtn   = $('editSelected'),
        deleteSelectedBtn = $('deleteSelected'),
        saveRegBtn        = $('saveRegistration'),
        shareRegBtn       = $('shareRegistration'),
        editRegBtn        = $('editRegistration'),
        downloadRegPDFBtn = $('downloadRegistrationPDF');
  let regSaved = false, inlineEdit = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function bindStudentSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        editSelectedBtn.disabled = deleteSelectedBtn.disabled = !any;
      };
    });
    selectAllChk.disabled = regSaved;
    selectAllChk.onchange = () => {
      if (!regSaved) {
        boxes.forEach(cb => {
          cb.checked = selectAllChk.checked;
          cb.dispatchEvent(new Event('change'));
        });
      }
    };
  }

  function renderStudents() {
    studentsBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved?'disabled':''}></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${regSaved?'<button class="share-one">Share</button>':''}</td>`;
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
    bindStudentSelection();
  }

  addStudentBtn.onclick = ev => {
    ev.preventDefault();
    const name       = studentNameIn.value.trim(),
          adm        = admissionNoIn.value.trim(),
          parent     = parentNameIn.value.trim(),
          contact    = parentContactIn.value.trim(),
          occupation = parentOccupationIn.value.trim(),
          address    = parentAddressIn.value.trim();
    if (!name||!adm||!parent||!contact||!occupation||!address) {
      alert('All fields required'); return;
    }
    if (!/^[0-9]+$/.test(adm)) { alert('Adm# must be numeric'); return; }
    if (!/^\d{7,15}$/.test(contact)) { alert('Contact must be 7–15 digits'); return; }
    students.push({ name, adm, parent, contact, occupation, address, roll: Date.now() });
    saveStudents();
    renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccupationIn, parentAddressIn].forEach(i=>i.value='');
  };

  function onCellBlur(e) {
    const td = e.target,
          tr = td.closest('tr'),
          idx= +tr.querySelector('.sel').dataset.index,
          ci = Array.from(tr.children).indexOf(td),
          keys = ['name','adm','parent','contact','occupation','address'];
    if (ci>=1 && ci<=6) {
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  }

  editSelectedBtn.onclick = ev => {
    ev.preventDefault();
    const sel = Array.from(document.querySelectorAll('.sel:checked'));
    if (!sel.length) return;
    inlineEdit = !inlineEdit;
    editSelectedBtn.textContent = inlineEdit?'Done Editing':'Edit Selected';
    sel.forEach(cb=>{
      cb.closest('tr').querySelectorAll('td').forEach((td,ci)=>{
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineEdit;
          td.classList.toggle('editing', inlineEdit);
          inlineEdit? td.addEventListener('blur', onCellBlur) : td.removeEventListener('blur', onCellBlur);
        }
      });
    });
  };

  deleteSelectedBtn.onclick = ev => {
    ev.preventDefault();
    if (!confirm('Delete selected?')) return;
    Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb=>+cb.dataset.index).sort((a,b)=>b-a).forEach(i=>students.splice(i,1));
    saveStudents(); renderStudents(); selectAllChk.checked=false;
  };

  saveRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegPDFBtn.classList.remove('hidden');
    $('studentTableWrapper').classList.add('saved');
    renderStudents();
  };

  editRegBtn.onclick = ev => {
    ev.preventDefault();
    regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegPDFBtn.classList.add('hidden');
    $('studentTableWrapper').classList.remove('saved');
    renderStudents();
  };

  shareRegBtn.onclick = ev => {
    ev.preventDefault();
    const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s=>`Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`, '_blank');
  };

  downloadRegPDFBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    // Header
    const registerMonth = $('registerMonth').value.split('-'),
          yr   = registerMonth[0],
          mo   = registerMonth[1],
          monthName = new Date(yr, mo-1).toLocaleString('default',{month:'long'});
    doc.setFontSize(16);
    doc.text(`Attendance Register — ${monthName} ${yr}`, doc.internal.pageSize.getWidth()/2, 40, { align: 'center' });

    // Table
    doc.autoTable({
      html: '#registerTableWrapper table',
      startY: 60,
      theme: 'grid',
      headStyles: { fillColor: [33,150,243] },
      styles: { fontSize: 8, cellPadding: 4 },
      margin: { left: 40, right: 40 }
    });

    // Summary & Charts
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Monthly Summary', 40, 50);
    doc.autoTable({
      html: '#registerSummary table',
      startY: 70,
      theme: 'grid',
      headStyles: { fillColor: [33,150,243] },
      styles: { fontSize: 10, cellPadding: 6 },
      margin: { left: 40, right: 40 }
    });

    // enlarge charts by 1cm and add 1cm padding below
    const cm = 28.35,
          chartY = doc.lastAutoTable.finalY + cm,
          availW = doc.internal.pageSize.getWidth() - 80,
          chartW = (availW/2) + cm,
          chartH = 150 + cm;
    doc.addImage(regBarChart.toBase64Image(), 'PNG', 40, chartY, chartW, chartH);
    doc.addImage(regPieChart.toBase64Image(), 'PNG', 60 + chartW, chartY, chartW, chartH);

    doc.save(`Register_${mo}-${yr}.pdf`);
  };

  renderStudents();

  //
  // 3. ATTENDANCE
  //
  // ... (your existing attendance code unchanged)
  //
  // 4. ANALYTICS
  //
  // ... (your existing analytics code unchanged)
  //
  // 5. TRADITIONAL REGISTER GENERATION
  //
  const registerMonthInput      = $('registerMonth'),
        loadRegisterBtn         = $('loadRegister'),
        registerTableWrapper    = $('registerTableWrapper'),
        registerSummary         = $('registerSummary'),
        registerGraphs          = $('registerGraphs'),
        shareRegisterBtn        = $('shareRegister'),
        downloadRegisterPDFBtn2 = $('downloadRegisterPDF'); // already bound above

  let regBarChart, regPieChart, registerStats;

  loadRegisterBtn.onclick = () => {
    if (!registerMonthInput.value) { alert('Pick a month'); return; }
    const [yr, mo] = registerMonthInput.value.split('-').map(Number);
    const daysInMonth = new Date(yr, mo, 0).getDate();

    // build register table
    let html = '<table class="register-table"><thead><tr><th>Sr#</th><th>Reg#</th><th>Name</th>';
    for (let d=1; d<=daysInMonth; d++) html += `<th>${d}</th>`;
    html += '</tr></thead><tbody>';
    students.forEach((s,i) => {
      html += `<tr><td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d=1; d<=daysInMonth; d++) {
        const dd = String(d).padStart(2,'0');
        const key = `${yr}-${String(mo).padStart(2,'0')}-${dd}`;
        const code = (attendanceData[key]||{})[s.roll] || 'A';
        html += `<td class="${code}" style="background:${colors[code]};color:${(code==='Lt'||code==='HD')?'var(--dark)':'#fff'}">${code}</td>`;
      }
      html += '</tr>';
    });
    html += '</tbody></table>';
    registerTableWrapper.innerHTML = html;
    registerTableWrapper.classList.remove('hidden');

    // summary stats
    const stats = students.map(s=>({name:s.name,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    for (let d=1; d<=daysInMonth; d++) {
      const dd = String(d).padStart(2,'0');
      const key = `${yr}-${String(mo).padStart(2,'0')}-${dd}`;
      stats.forEach((st,idx)=>{
        const code = (attendanceData[key]||{})[students[idx].roll] || 'A';
        st[code]++; st.total++;
      });
    }
    registerStats = stats;
    let sumHtml = '<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>%</th></tr></thead><tbody>';
    stats.forEach(st=>{
      const pct = st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      sumHtml += `<tr><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${pct}</td></tr>`;
    });
    sumHtml += '</tbody></table>';
    registerSummary.innerHTML = sumHtml;
    registerSummary.classList.remove('hidden');

    // charts
    const barCtx = document.getElementById('registerBarChart').getContext('2d'),
          pieCtx = document.getElementById('registerPieChart').getContext('2d'),
          labels = stats.map(s=>s.name),
          dataPct = stats.map(s=> s.total? s.P/s.total*100 : 0);
    if (regBarChart) regBarChart.destroy();
    regBarChart = new Chart(barCtx, { type:'bar', data:{labels,datasets:[{label:'% Present',data:dataPct}]}, options:{maintainAspectRatio:true}});
    const agg = stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    if (regPieChart) regPieChart.destroy();
    regPieChart = new Chart(pieCtx, { type:'pie', data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg)}]}, options:{maintainAspectRatio:true}});
    registerGraphs.classList.remove('hidden');

    shareRegisterBtn.classList.remove('hidden');
    downloadRegisterPDFBtn2.classList.remove('hidden');
  };
});
