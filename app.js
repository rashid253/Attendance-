// app.js
window.addEventListener('DOMContentLoaded', async () => {
  const { get, set } = idbKeyval;
  const $ = id => document.getElementById(id);

  // --- STORAGE & HELPERS ---
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData') || {};

  async function saveStudents() {
    await set('students', students);
  }
  async function saveAttendanceData() {
    await set('attendanceData', attendanceData);
  }

  // --- ADM# GENERATOR (school-wide) ---
  async function getLastAdmNo() {
    return await get('lastAdmissionNo') || 0;
  }
  async function setLastAdmNo(n) {
    await set('lastAdmissionNo', n);
  }
  async function generateAdmNo() {
    const last = await getLastAdmNo();
    const next = last + 1;
    await setLastAdmNo(next);
    return String(next).padStart(4, '0'); // "0001", "0002", ...
  }

  // --- CURRENT CLASS/SECTION FILTERS ---
  function getCurrentClassSection() {
    return {
      cls: $('teacherClassSelect').value,
      sec: $('teacherSectionSelect').value
    };
  }
  function filteredStudents() {
    const { cls, sec } = getCurrentClassSection();
    return students.filter(s => s.cls === cls && s.sec === sec);
  }

  // --- ANIMATED COUNTERS ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target / 100);
      function update() {
        count += step;
        if (count < target) {
          span.textContent = Math.ceil(count);
          requestAnimationFrame(update);
        } else {
          span.textContent = target;
        }
      }
      requestAnimationFrame(update);
    });
  }

  function updateTotals() {
    const totalSchool  = students.length;
    const totalClass   = students.filter(s => s.cls === getCurrentClassSection().cls).length;
    const totalSection = filteredStudents().length;
    [
      { id: 'schoolCount',  val: totalSchool },
      { id: 'classCount',   val: totalClass },
      { id: 'sectionCount', val: totalSection }
    ].forEach(o => {
      const el = document.getElementById(o.id);
      el.dataset.target = o.val;
    });
    animateCounters();
  }

  // --- DOM ELEMENTS ---
  const schoolInput    = $('schoolNameInput');
  const classSelect    = $('teacherClassSelect');
  const sectionSelect  = $('teacherSectionSelect');
  const btnSaveSetup   = $('saveSetup');
  const setupForm      = $('setupForm');
  const setupDisplay   = $('setupDisplay');
  const setupText      = $('setupText');
  const btnEditSetup   = $('editSetup');

  const nameInput      = $('studentName');
  const parentInput    = $('parentName');
  const contactInput   = $('parentContact');
  const occInput       = $('parentOccupation');
  const addrInput      = $('parentAddress');
  const btnAddStudent  = $('addStudent');
  const tbodyStudents  = $('studentsBody');
  const chkAllStudents = $('selectAllStudents');
  const btnEditSel     = $('editSelected');
  const btnDeleteSel   = $('deleteSelected');
  const btnSaveReg     = $('saveRegistration');
  const btnShareReg    = $('shareRegistration');
  const btnEditReg     = $('editRegistration');
  const btnDownloadReg = $('downloadRegistrationPDF');

  const dateInput      = $('dateInput');
  const btnLoadAtt     = $('loadAttendance');
  const divAttList     = $('attendanceList');
  const btnSaveAtt     = $('saveAttendance');
  const sectionResult  = $('attendance-result');
  const tbodySummary   = $('summaryBody');
  const btnResetAtt    = $('resetAttendance');
  const btnShareAtt    = $('shareAttendanceSummary');
  const btnDownloadAtt = $('downloadAttendancePDF');

  const selectAnalyticsTarget = $('analyticsTarget');
  const admAnalyticsInput     = $('studentAdmInput');
  const selectAnalyticsType   = $('analyticsType');
  const inputAnalyticsDate    = $('analyticsDate');
  const inputAnalyticsMonth   = $('analyticsMonth');
  const inputSemesterStart    = $('semesterStart');
  const inputSemesterEnd      = $('semesterEnd');
  const inputAnalyticsYear    = $('yearStart');
  const btnLoadAnalytics      = $('loadAnalytics');
  const btnResetAnalytics     = $('resetAnalytics');
  const divInstructions       = $('instructions');
  const divAnalyticsTable     = $('analyticsContainer');
  const divGraphs             = $('graphs');
  const btnShareAnalytics     = $('shareAnalytics');
  const btnDownloadAnalytics  = $('downloadAnalytics');
  const ctxBar                = $('barChart').getContext('2d');
  const ctxPie                = $('pieChart').getContext('2d');
  let chartBar, chartPie;

  const monthInput       = $('registerMonth');
  const btnLoadReg       = $('loadRegister');
  const btnChangeReg     = $('changeRegister');
  const divRegTable      = $('registerTableWrapper');
  const tbodyReg         = $('registerBody');
  const divRegSummary    = $('registerSummarySection');
  const tbodyRegSum      = $('registerSummaryBody');
  const btnShareReg2     = $('shareRegister');
  const btnDownloadReg2  = $('downloadRegisterPDF');
  const headerRegRowEl   = document.querySelector('#registerTable thead tr');

  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // --- SETUP LOGIC ---
  async function loadSetup() {
    const school = await get('schoolName'),
          cls    = await get('teacherClass'),
          sec    = await get('teacherSection');
    if (school && cls && sec) {
      schoolInput.value   = school;
      classSelect.value   = cls;
      sectionSelect.value = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
      renderStudents();
    }
    updateTotals();
  }
  btnSaveSetup.onclick = async e => {
    e.preventDefault();
    if (!schoolInput.value || !classSelect.value || !sectionSelect.value) {
      return alert('Complete setup');
    }
    await set('schoolName', schoolInput.value);
    await set('teacherClass', classSelect.value);
    await set('teacherSection', sectionSelect.value);
    await loadSetup();
  };
  btnEditSetup.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };
  await loadSetup();

  // --- STUDENT REGISTRATION LOGIC ---
  let registrationSaved = false, inlineEditing = false;

  function bindRowSelection() {
    const boxes = Array.from(tbodyStudents.querySelectorAll('.sel'));
    boxes.forEach(cb => {
      cb.onchange = () => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any = boxes.some(x => x.checked);
        btnEditSel.disabled = btnDeleteSel.disabled = !any;
      };
    });
    chkAllStudents.disabled = registrationSaved;
    chkAllStudents.onchange = () => boxes.forEach(cb => {
      cb.checked = chkAllStudents.checked;
      cb.dispatchEvent(new Event('change'));
    });
  }

  function renderStudents() {
    const list = filteredStudents();
    tbodyStudents.innerHTML = '';
    list.forEach((st, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="sel" data-index="${idx}" ${registrationSaved?'disabled':''}></td>
        <td>${idx+1}</td>
        <td>${st.name}</td><td>${st.adm}</td><td>${st.parent}</td>
        <td>${st.contact}</td><td>${st.occupation}</td><td>${st.address}</td>
        <td>${registrationSaved?'<button class="share-one">Share</button>':''}</td>
      `;
      if (registrationSaved) {
        tr.querySelector('.share-one').onclick = () => {
          const hdr = `School: ${schoolInput.value}\nClass: ${classSelect.value}\nSection: ${sectionSelect.value}`;
          const msg = [
            hdr,
            `Name: ${st.name}`,
            `Adm#: ${st.adm}`,
            `Parent: ${st.parent}`,
            `Contact: ${st.contact}`,
            `Occupation: ${st.occupation}`,
            `Address: ${st.address}`
          ].join('\n');
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      tbodyStudents.appendChild(tr);
    });
    bindRowSelection();
    updateTotals();
  }

  btnAddStudent.onclick = async e => {
    e.preventDefault();
    const name   = nameInput.value.trim(),
          parent = parentInput.value.trim(),
          cont   = contactInput.value.trim(),
          occ    = occInput.value.trim(),
          addr   = addrInput.value.trim();
    if (!name||!parent||!cont||!occ||!addr) {
      return alert('All fields required');
    }
    if (!/^\d{7,15}$/.test(cont)) {
      return alert('Contact must be 7–15 digits');
    }
    const adm = await generateAdmNo();
    students.push({
      name, adm,
      parent, contact: cont,
      occupation: occ, address: addr,
      roll: Date.now(),
      cls: classSelect.value,
      sec: sectionSelect.value
    });
    await saveStudents();
    renderStudents();
    [nameInput, parentInput, contactInput, occInput, addrInput].forEach(i=>i.value='');
  };

  function handleInlineBlur(e) {
    const td = e.target,
          tr = td.closest('tr'),
          idx= +tr.querySelector('.sel').dataset.index,
          keys=['name','adm','parent','contact','occupation','address'],
          ci = Array.from(tr.children).indexOf(td),
          val=td.textContent.trim(),
          list=filteredStudents(),
          stu=list[idx];
    if (ci===2 && !/^\d+$/.test(val)) {
      alert('Adm# numeric'); renderStudents(); return;
    }
    if (ci===2 && students.some(s=>s.adm===val && s.roll!==stu.roll)) {
      alert('Duplicate Adm#'); renderStudents(); return;
    }
    if (ci>=1 && ci<=6) {
      stu[keys[ci-1]] = val;
      students = students.map(s=>s.roll===stu.roll?stu:s);
      saveStudents();
    }
  }

  btnEditSel.onclick = e => {
    e.preventDefault();
    const checked = Array.from(tbodyStudents.querySelectorAll('.sel:checked'));
    if (!checked.length) return;
    inlineEditing = !inlineEditing;
    btnEditSel.textContent = inlineEditing ? 'Done Editing' : 'Edit Selected';
    checked.forEach(cb => {
      cb.closest('tr').querySelectorAll('td').forEach((td,ci)=>{
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineEditing;
          td.classList.toggle('editing', inlineEditing);
          inlineEditing
            ? td.addEventListener('blur', handleInlineBlur)
            : td.removeEventListener('blur', handleInlineBlur);
        }
      });
    });
  };

  btnDeleteSel.onclick = async e => {
    e.preventDefault();
    if (!confirm('Delete selected?')) return;
    const toRemove = Array.from(tbodyStudents.querySelectorAll('.sel:checked'))
      .map(cb=>filteredStudents()[+cb.dataset.index].roll);
    students = students.filter(s=>!toRemove.includes(s.roll));
    await saveStudents(); renderStudents();
  };

  btnSaveReg.onclick = e => {
    e.preventDefault();
    registrationSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
      .forEach(id=>$
