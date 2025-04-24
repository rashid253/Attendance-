// app.js
window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const colors = { P: '#4CAF50', A: '#f44336', Lt: '#FFEB3B', HD: '#FF9800', L: '#03a9f4' };
  
  // Initialize IndexedDB
  const dbName = 'AttendanceDB';
  const dbVersion = 1;
  let db;
  
  const initDB = new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('setup')) {
        db.createObjectStore('setup', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('students')) {
        db.createObjectStore('students', { keyPath: 'roll' });
      }
      if (!db.objectStoreNames.contains('attendance')) {
        db.createObjectStore('attendance', { keyPath: 'date' });
      }
    };
    
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
    
    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
  });
  
  // Helper functions for IndexedDB operations
  const dbGet = (storeName, key) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = key ? store.get(key) : store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };
  
  const dbPut = (storeName, data) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };
  
  const dbDelete = (storeName, key) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };
  
  // Initialize the app after DB is ready
  try {
    db = await initDB;
    console.log('IndexedDB initialized successfully');
    mainApp();
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error);
    alert('Failed to initialize database. Please refresh the page.');
  }
  
  function mainApp() {
    // 1. SETUP
    const schoolIn = $('schoolNameInput');
    const classSel = $('teacherClassSelect');
    const secSel = $('teacherSectionSelect');
    const saveSetup = $('saveSetup');
    const setupForm = $('setupForm');
    const setupDisplay = $('setupDisplay');
    const setupText = $('setupText');
    const editSetup = $('editSetup');

    async function loadSetup() {
      try {
        const setup = await dbGet('setup', 1);
        if (setup) {
          schoolIn.value = setup.school;
          classSel.value = setup.class;
          secSel.value = setup.section;
          setupText.textContent = `${setup.school} 🏫 | Class: ${setup.class} | Section: ${setup.section}`;
          setupForm.classList.add('hidden');
          setupDisplay.classList.remove('hidden');
        }
      } catch (error) {
        console.error('Error loading setup:', error);
      }
    }

    saveSetup.onclick = async e => {
      e.preventDefault();
      if (!schoolIn.value || !classSel.value || !secSel.value)
        return alert('Complete setup');
      
      try {
        await dbPut('setup', {
          id: 1,
          school: schoolIn.value,
          class: classSel.value,
          section: secSel.value
        });
        loadSetup();
      } catch (error) {
        console.error('Error saving setup:', error);
        alert('Failed to save setup');
      }
    };

    editSetup.onclick = e => {
      e.preventDefault();
      setupForm.classList.remove('hidden');
      setupDisplay.classList.add('hidden');
    };

    loadSetup();

    // 2. STUDENT REGISTRATION
    let students = [];
    const studentNameIn    = $('studentName');
    const admissionNoIn    = $('admissionNo');
    const parentNameIn     = $('parentName');
    const parentContactIn  = $('parentContact');
    const parentOccIn      = $('parentOccupation');
    const parentAddrIn     = $('parentAddress');
    const addStudentBtn    = $('addStudent');
    const studentsBody     = $('studentsBody');
    const selectAll        = $('selectAllStudents');
    const editSelBtn       = $('editSelected');
    const deleteSelBtn     = $('deleteSelected');
    const saveRegBtn       = $('saveRegistration');
    const shareRegBtn      = $('shareRegistration');
    const editRegBtn       = $('editRegistration');
    const downloadRegBtn   = $('downloadRegistrationPDF');
    let regSaved = false, inlineEdit = false;

    async function loadStudents() {
      try {
        students = await dbGet('students');
        renderStudents();
      } catch (error) {
        console.error('Error loading students:', error);
      }
    }

    function renderStudents() {
      studentsBody.innerHTML = '';
      students.forEach((s, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          `<td><input type="checkbox" class="sel" data-index="${i}" ${regSaved ? 'disabled' : ''}></td>` +
          `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>` +
          `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
          `<td>${regSaved ? '<button class="share-one">Share</button>' : ''}</td>`;
        if (regSaved) {
          tr.querySelector('.share-one').onclick = async ev => {
            ev.preventDefault();
            const setup = await dbGet('setup', 1);
            const hdr = `School: ${setup?.school || ''}\nClass: ${setup?.class || ''}\nSection: ${setup?.section || ''}`;
            const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
          };
        }
        studentsBody.appendChild(tr);
      });
      bindSelection();
    }

    function bindSelection() {
      const boxes = Array.from(document.querySelectorAll('.sel'));
      boxes.forEach(cb => {
        cb.onchange = () => {
          cb.closest('tr').classList.toggle('selected', cb.checked);
          const any = boxes.some(x => x.checked);
          editSelBtn.disabled = deleteSelBtn.disabled = !any;
        };
      });
      selectAll.disabled = regSaved;
      selectAll.onchange = () => {
        if (!regSaved) boxes.forEach(cb => {
          cb.checked = selectAll.checked;
          cb.dispatchEvent(new Event('change'));
        });
      };
    }

    addStudentBtn.onclick = async ev => {
      ev.preventDefault();
      const name    = studentNameIn.value.trim();
      const adm     = admissionNoIn.value.trim();
      const parent  = parentNameIn.value.trim();
      const contact = parentContactIn.value.trim();
      const occ     = parentOccIn.value.trim();
      const addr    = parentAddrIn.value.trim();
      if (!name || !adm || !parent || !contact || !occ || !addr)
        return alert('All fields required');
      if (!/^\d+$/.test(adm)) return alert('Adm# must be numeric');
      if (students.some(s => s.adm === adm))
        return alert(`Admission# ${adm} already exists`);
      if (!/^\d{7,15}$/.test(contact))
        return alert('Contact must be 7-15 digits');
      
      const student = {
        name, adm, parent, contact,
        occupation: occ, address: addr,
        roll: Date.now()
      };
      
      try {
        await dbPut('students', student);
        students.push(student);
        renderStudents();
        [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn].forEach(i => i.value = '');
      } catch (error) {
        console.error('Error adding student:', error);
        alert('Failed to add student');
      }
    };

    function onCellBlur(e) {
      const td = e.target, tr = td.closest('tr');
      const idx = +tr.querySelector('.sel').dataset.index;
      const ci  = Array.from(tr.children).indexOf(td);
      const keys = ['name','adm','parent','contact','occupation','address'];
      const val = td.textContent.trim();
      if (ci === 2) {
        if (!/^\d+$/.test(val)) { alert('Adm# must be numeric'); renderStudents(); return; }
        if (students.some((s,i2) => s.adm===val && i2!==idx)) {
          alert('Duplicate Adm# not allowed'); renderStudents(); return;
        }
      }
      if (ci>=1 && ci<=6) {
        const student = {...students[idx], [keys[ci-1]]: val};
        dbPut('students', student)
          .then(() => {
            students[idx] = student;
          })
          .catch(error => {
            console.error('Error updating student:', error);
            renderStudents();
          });
      }
    }

    editSelBtn.onclick = ev => {
      ev.preventDefault();
      const sel = Array.from(document.querySelectorAll('.sel:checked'));
      if (!sel.length) return;
      inlineEdit = !inlineEdit;
      editSelBtn.textContent = inlineEdit ? 'Done Editing' : 'Edit Selected';
      sel.forEach(cb => {
        cb.closest('tr').querySelectorAll('td').forEach((td,ci) => {
          if (ci>=1 && ci<=6) {
            td.contentEditable = inlineEdit;
            td.classList.toggle('editing', inlineEdit);
            inlineEdit
              ? td.addEventListener('blur', onCellBlur)
              : td.removeEventListener('blur', onCellBlur);
          }
        });
      });
    };

    deleteSelBtn.onclick = async ev => {
      ev.preventDefault();
      if (!confirm('Delete selected?')) return;
      
      const toDelete = Array.from(document.querySelectorAll('.sel:checked'))
        .map(cb => students[+cb.dataset.index]);
      
      try {
        await Promise.all(toDelete.map(s => dbDelete('students', s.roll)));
        students = students.filter(s => !toDelete.includes(s));
        renderStudents(); 
        selectAll.checked = false;
      } catch (error) {
        console.error('Error deleting students:', error);
        alert('Failed to delete students');
      }
    };

    saveRegBtn.onclick = ev => {
      ev.preventDefault();
      regSaved = true;
      ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
        .forEach(id=>$(id).classList.add('hidden'));
      shareRegBtn.classList.remove('hidden');
      editRegBtn.classList.remove('hidden');
      downloadRegBtn.classList.remove('hidden');
      $('studentTableWrapper').classList.add('saved');
      renderStudents();
    };

    editRegBtn.onclick = ev => {
      ev.preventDefault();
      regSaved = false;
      ['editSelected','deleteSelected','selectAllStudents','saveRegistration']
        .forEach(id=>$(id).classList.remove('hidden'));
      shareRegBtn.classList.add('hidden');
      editRegBtn.classList.add('hidden');
      downloadRegBtn.classList.add('hidden');
      $('studentTableWrapper').classList.remove('saved');
      renderStudents();
    };

    shareRegBtn.onclick = async ev => {
      ev.preventDefault();
      const setup = await dbGet('setup', 1);
      const hdr = `School: ${setup?.school || ''}\nClass: ${setup?.class || ''}\nSection: ${setup?.section || ''}`;
      const lines = students.map(s =>
        `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
      ).join('\n---\n');
      window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines)}`, '_blank');
    };

    // 2a. STUDENT REGISTRATION PDF
    downloadRegBtn.onclick = async ev => {
      ev.preventDefault();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const setup = await dbGet('setup', 1);
      
      doc.setFontSize(16); doc.text('Student Registration', 10, 10);
      doc.setFontSize(12);
      const currentDate = new Date().toLocaleDateString();
      doc.text(`Date: ${currentDate}`,10,20);
      doc.text(`School: ${setup?.school || ''}`,10,26);
      doc.text(`Class: ${setup?.class || ''}`,10,32);
      doc.text(`Section: ${setup?.section || ''}`,10,38);
      doc.autoTable({
        head: [['Name','Adm#','Parent','Contact','Occupation','Address']],
        body: students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
        startY:44
      });
      doc.save('student_registration.pdf');
    };

    loadStudents();

    // 3. ATTENDANCE MARKING
    let attendanceData = {};
    const dateInput   = $('dateInput');
    const loadAtt     = $('loadAttendance');
    const attList     = $('attendanceList');
    const saveAtt     = $('saveAttendance');
    const resultSection = $('attendance-result');
    const summaryBody   = $('summaryBody');
    const resetAtt      = $('resetAttendance');
    const shareAtt      = $('shareAttendanceSummary');
    const downloadAttPDF= $('downloadAttendancePDF');

    async function loadAttendanceData() {
      try {
        const allAttendance = await dbGet('attendance');
        attendanceData = allAttendance.reduce((acc, item) => {
          acc[item.date] = item.records;
          return acc;
        }, {});
      } catch (error) {
        console.error('Error loading attendance data:', error);
        attendanceData = {};
      }
    }

    loadAtt.onclick = async ev => {
      ev.preventDefault();
      if (!dateInput.value) return alert('Pick a date');
      await loadAttendanceData();
      attList.innerHTML = '';
      students.forEach(s=>{
        const row = document.createElement('div');
        row.className='attendance-item';
        row.textContent=s.name;
        const btns=document.createElement('div');
        btns.className='attendance-actions';
        ['P','A','Lt','HD','L'].forEach(code=>{
          const b=document.createElement('button');
          b.type='button'; b.className='att-btn'; b.dataset.code=code; b.textContent=code;
          if(attendanceData[dateInput.value]?.[s.roll]===code){
            b.style.background=colors[code]; b.style.color='#fff';
          }
          b.onclick=e2=>{
            e2.preventDefault();
            btns.querySelectorAll('.att-btn').forEach(x=>{
              x.style.background=''; x.style.color='#333';
            });
            b.style.background=colors[code]; b.style.color='#fff';
          };
          btns.append(b);
        });
        attList.append(row,btns);
      });
      saveAtt.classList.remove('hidden');
    };

    saveAtt.onclick = async ev=>{
      ev.preventDefault();
      const d=dateInput.value;
      const records = {};
      attList.querySelectorAll('.attendance-actions').forEach((btns,i)=>{
        const sel=btns.querySelector('.att-btn[style*="background"]');
        records[students[i].roll]=sel?sel.dataset.code:'A';
      });
      
      try {
        await dbPut('attendance', { date: d, records });
        attendanceData[d] = records;
        $('attendance-section').classList.add('hidden');
        resultSection.classList.remove('hidden');
        summaryBody.innerHTML='';
        
        const setup = await dbGet('setup', 1);
        const hdr=`Date: ${d}\nSchool: ${setup?.school || ''}\nClass: ${setup?.class || ''}\nSection: ${setup?.section || ''}`;
        summaryBody.insertAdjacentHTML('beforebegin',`<tr><td colspan="3"><em>${hdr}</em></td></tr>`);
        
        students.forEach(s=>{
          const code=records[s.roll]||'A';
          const status={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
          const tr=document.createElement('tr');
          tr.innerHTML=`<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
          tr.querySelector('.send-btn').onclick=e2=>{
            e2.preventDefault();
            const msg=`${hdr}\n\nName: ${s.name}\nStatus: ${status}`;
            window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`,'_blank');
          };
          summaryBody.appendChild(tr);
        });
      } catch (error) {
        console.error('Error saving attendance:', error);
        alert('Failed to save attendance');
      }
    };

    resetAtt.onclick=ev=>{
      ev.preventDefault();
      resultSection.classList.add('hidden');
      $('attendance-section').classList.remove('hidden');
      attList.innerHTML='';
      saveAtt.classList.add('hidden');
      summaryBody.innerHTML='';
    };

    shareAtt.onclick=async ev=>{
      ev.preventDefault();
      const d=dateInput.value;
      const setup = await dbGet('setup', 1);
      const hdr=`Date: ${d}\nSchool: ${setup?.school || ''}\nClass: ${setup?.class || ''}\nSection: ${setup?.section || ''}`;
      const lines=students.map(s=>{
        const code=(attendanceData[d]||{})[s.roll]||'A';
        return `${s.name}: ${ {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code] }`;
      });
      const total=students.length;
      const pres=students.reduce((sum,s)=>(sum+((attendanceData[d]||{})[s.roll]==='P'?1:0)),0);
      const pct= total?((pres/total)*100).toFixed(1):'0.0';
      const remark= pct==100?'Best':pct>=75?'Good':pct>=50?'Fair':'Poor';
      const summary=`Overall Attendance: ${pct}% | ${remark}`;
      window.open(`https://wa.me/?text=${encodeURIComponent([hdr,'',...lines,'',summary].join('\n'))}`,'_blank');
    };

    // 3a. DAILY ATTENDANCE PDF
    downloadAttPDF.onclick=async ev=>{
      ev.preventDefault();
      const { jsPDF }=window.jspdf;
      const doc=new jsPDF();
      const setup = await dbGet('setup', 1);
      
      doc.setFontSize(16); doc.text('Daily Attendance Report',10,10);
      doc.setFontSize(12);
      const selDate=dateInput.value;
      const formatted=new Date(selDate).toLocaleDateString();
      doc.text(`Date: ${formatted}`,10,20);
      doc.text(`School: ${setup?.school || ''}`,10,26);
      doc.text(`Class: ${setup?.class || ''}`,10,32);
      doc.text(`Section: ${setup?.section || ''}`,10,38);
      doc.autoTable({
        head:[['Name','Status']],
        body:students.map(s=>{
          const code=(attendanceData[dateInput.value]||{})[s.roll]||'A';
          const status={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
          return [s.name,status];
        }),
        startY:44
      });
      doc.save('attendance_summary.pdf');
    };

    // 4. ANALYTICS
    const analyticsTarget    = $('analyticsTarget');
    const studentAdmInput    = $('studentAdmInput');
    const analyticsType      = $('analyticsType');
    const analyticsDate      = $('analyticsDate');
    const analyticsMonth     = $('analyticsMonth');
    const semesterStartInput = $('semesterStart');
    const semesterEndInput   = $('semesterEnd');
    const yearStart          = $('yearStart');
    const loadAnalyticsBtn   = $('loadAnalytics');
    const resetAnalyticsBtn  = $('resetAnalytics');
    const instructionsEl     = $('instructions');
    const analyticsContainer = $('analyticsContainer');
    const graphsEl           = $('graphs');
    const analyticsActionsEl = $('analyticsActions');
    const shareAnalyticsBtn  = $('shareAnalytics');
    const downloadAnalyticsBtn = $('downloadAnalytics');
    const barCtx             = $('barChart').getContext('2d');
    const pieCtx             = $('pieChart').getContext('2d');
    let barChart, pieChart;

    function hideAllAnalytics() {
      [analyticsDate, analyticsMonth, semesterStartInput,
       semesterEndInput, yearStart, instructionsEl,
       analyticsContainer, graphsEl, analyticsActionsEl,
       resetAnalyticsBtn].forEach(el => el.classList.add('hidden'));
    }

    analyticsTarget.onchange = () => {
      if (analyticsTarget.value === 'student') {
        studentAdmInput.classList.remove('hidden');
      } else {
        studentAdmInput.classList.add('hidden');
      }
      hideAllAnalytics();
      analyticsType.value = '';
    };

    analyticsType.onchange = () => {
      hideAllAnalytics();
      if (analyticsType.value === 'date') analyticsDate.classList.remove('hidden');
      if (analyticsType.value === 'month') analyticsMonth.classList.remove('hidden');
      if (analyticsType.value === 'semester') {
        semesterStartInput.classList.remove('hidden');
        semesterEndInput.classList.remove('hidden');
      }
      if (analyticsType.value === 'year') yearStart.classList.remove('hidden');
      resetAnalyticsBtn.classList.remove('hidden');
    };

    resetAnalyticsBtn.onclick = ev => {
      ev.preventDefault();
      hideAllAnalytics();
      analyticsType.value = '';
    };

    loadAnalyticsBtn.onclick = async ev => {
      ev.preventDefault();
      // determine period
      let from, to;
      if (analyticsType.value === 'date') {
        if (!analyticsDate.value) return alert('Pick a date');
        from = to = analyticsDate.value;
      } else if (analyticsType.value === 'month') {
        if (!analyticsMonth.value) return alert('Pick a month');
        const [y,m] = analyticsMonth.value.split('-').map(Number);
        from = `${analyticsMonth.value}-01`;
        to   = `${analyticsMonth.value}-${new Date(y,m,0).getDate()}`;
      } else if (analyticsType.value === 'semester') {
        if (!semesterStartInput.value || !semesterEndInput.value)
          return alert('Pick semester range');
        from = `${semesterStartInput.value}-01`;
        const [ey,em] = semesterEndInput.value.split('-').map(Number);
        to   = `${semesterEndInput.value}-${new Date(ey,em,0).getDate()}`;
      } else if (analyticsType.value === 'year') {
        if (!yearStart.value) return alert('Pick year');
        from = `${yearStart.value}-01-01`;
        to   = `${yearStart.value}-12-31`;
      } else {
        return alert('Select period');
      }

      // build stats
      let stats = [];
      if (analyticsTarget.value === 'student') {
        const adm = studentAdmInput.value.trim();
        if (!adm) return alert('Enter Admission #');
        const stu = students.find(s=>s.adm===adm);
        if (!stu) return alert(`No student with Admission# ${adm}`);
        stats = [{ name: stu.name, roll: stu.roll, P:0,A:0,Lt:0,HD:0,L:0,total:0 }];
      } else {
        stats = students.map(s=>({ name:s.name, roll:s.roll, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
      }

      // aggregate
      try {
        const allAttendance = await dbGet('attendance');
        const fromDate=new Date(from), toDate=new Date(to);
        
        allAttendance.forEach(({date, records}) => {
          const cur=new Date(date);
          if (cur>=fromDate && cur<=toDate) {
            stats.forEach(st=>{
              const code = records[st.roll]||'A';
              st[code]++; st.total++;
            });
          }
        });

        // render table
        let html='<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
        stats.forEach(s=>{
          const pct = s.total?((s.P/s.total)*100).toFixed(1):'0.0';
          html+=`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
        });
        html+='</tbody></table>';
        analyticsContainer.innerHTML=html;
        analyticsContainer.classList.remove('hidden');

        // header
        if (analyticsTarget.value==='student') {
          instructionsEl.textContent=`Admission#: ${studentAdmInput.value.trim()} | Report: ${from} to ${to}`;
        } else {
          instructionsEl.textContent=`Report: ${from} to ${to}`;
        }
        instructionsEl.classList.remove('hidden');

                // bar chart
        const labels = stats.map(s=>s.name);
        const dataPct = stats.map(s=> s.total? (s.P/s.total)*100 : 0 );
        if (barChart) barChart.destroy();
        barChart = new Chart(barCtx,{
          type:'bar',
          data:{ labels, datasets:[{ label:'% Present', data:dataPct }]},
          options:{ responsive:true, scales:{ y:{ beginAtZero:true, max:100 } } }
        });

        // pie chart
        const agg = stats.reduce((a,s)=>{
          ['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);
          return a;
        },{ P:0,A:0,Lt:0,HD:0,L:0 });
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(pieCtx,{
          type:'pie',
          data:{ labels:['Present','Absent','Late','Half Day','Leave'], datasets:[{ data: Object.values(agg) }]},
          options:{ responsive:true }
        });

        graphsEl.classList.remove('hidden');
        analyticsActionsEl.classList.remove('hidden');
      } catch (error) {
        console.error('Error generating analytics:', error);
        alert('Failed to load analytics');
      }
    };

    // 4a. ATTENDANCE ANALYTICS PDF
    downloadAnalyticsBtn.onclick = async ev => {
      ev.preventDefault();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const setup = await dbGet('setup', 1);
      
      doc.setFontSize(16); doc.text('Attendance Analytics',10,10);
      doc.setFontSize(12);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`,10,20);
      const period = instructionsEl.textContent.replace(/^.*\|\s*/,'');
      doc.text(`Period: ${period}`,10,26);
      doc.text(`School: ${setup?.school || ''}`,10,32);
      doc.text(`Class: ${setup?.class || ''} | Section: ${setup?.section || ''}`,10,38);
      doc.autoTable({
        head:[['Name','P','A','Lt','HD','L','Total','%']],
        body:Array.from(analyticsContainer.querySelectorAll('tbody tr')).map(r=>
          Array.from(r.querySelectorAll('td')).map(td=>td.textContent)
        ),
        startY:44
      });
      const y = doc.lastAutoTable.finalY + 10;
      doc.addImage(barChart.toBase64Image(),'PNG',10,y,80,60);
      doc.addImage(pieChart.toBase64Image(),'PNG',100,y,80,60);
      doc.save('attendance_analytics.pdf');
    };

    // 5. ATTENDANCE REGISTER
    const regMonthIn    = $('registerMonth');
    const loadReg      = $('loadRegister');
    const changeReg    = $('changeRegister');
    const regTableWrapper = $('registerTableWrapper');
    const regTable     = $('registerTable');
    const regBody      = $('registerBody');
    const regSummarySec= $('registerSummarySection');
    const regSummaryBody= $('registerSummaryBody');
    const shareReg2    = $('shareRegister');
    const downloadReg2 = $('downloadRegisterPDF');
    const headerRow    = regTable.querySelector('thead tr');

    function generateRegisterHeader(daysInMonth) {
      headerRow.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>`;
      for (let d=1; d<=daysInMonth; d++) {
        const th=document.createElement('th');
        th.textContent=d;
        headerRow.appendChild(th);
      }
    }

    loadReg.onclick = async e => {
      e.preventDefault();
      if (!regMonthIn.value) return alert('Select month');
      const [y,m]=regMonthIn.value.split('-').map(Number);
      const daysInMonth=new Date(y,m,0).getDate();
      generateRegisterHeader(daysInMonth);
      regBody.innerHTML='';
      regSummaryBody.innerHTML='';

      try {
        const allAttendance = await dbGet('attendance');
        const attendanceData = allAttendance.reduce((acc, item) => {
          acc[item.date] = item.records;
          return acc;
        }, {});

        students.forEach((s,i)=>{
          const tr=document.createElement('tr');
          tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
          for(let day=1; day<=daysInMonth; day++){
            const dateStr=`${regMonthIn.value}-${String(day).padStart(2,'0')}`;
            const code=(attendanceData[dateStr]||{})[s.roll]||'A';
            const td=document.createElement('td');
            td.textContent=code;
            td.style.background=colors[code];
            td.style.color='#fff';
            tr.appendChild(td);
          }
          regBody.appendChild(tr);
        });

        students.forEach(s=>{
          const st={P:0,A:0,Lt:0,HD:0,L:0,total:0};
          for(let d=1; d<=daysInMonth; d++){
            const dateStr=`${regMonthIn.value}-${String(d).padStart(2,'0')}`;
            const code=(attendanceData[dateStr]||{})[s.roll]||'A';
            st[code]++; st.total++;
          }
          const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0';
          const tr=document.createElement('tr');
          tr.innerHTML=`<td>${s.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${pct}</td>`;
          regSummaryBody.appendChild(tr);
        });

        regTableWrapper.classList.remove('hidden');
        regSummarySec.classList.remove('hidden');
        loadReg.classList.add('hidden');
        changeReg.classList.remove('hidden');
      } catch (error) {
        console.error('Error loading register:', error);
        alert('Failed to load attendance register');
      }
    };

    changeReg.onclick = e => {
      e.preventDefault();
      regTableWrapper.classList.add('hidden');
      regSummarySec.classList.add('hidden');
      loadReg.classList.remove('hidden');
      changeReg.classList.add('hidden');
    };

    shareReg2.onclick = async e=>{
      e.preventDefault();
      const setup = await dbGet('setup', 1);
      const hdr=`Register for ${regMonthIn.value}\nSchool: ${setup?.school || ''}\nClass: ${setup?.class || ''}\nSection: ${setup?.section || ''}`;
      const lines=Array.from(regSummaryBody.querySelectorAll('tr')).map(r=>{
        const tds=r.querySelectorAll('td');
        return `${tds[0].textContent}: P:${tds[1].textContent}, A:${tds[2].textContent}, Lt:${tds[3].textContent}, HD:${tds[4].textContent}, L:${tds[5].textContent}, %:${tds[6].textContent}`;
      });
      window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines.join('\n'))}`, '_blank');
    };

    // 5a. MONTHLY ATTENDANCE REGISTER PDF
    downloadReg2.onclick = async ev=>{
      ev.preventDefault();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape');
      const setup = await dbGet('setup', 1);
      
      doc.setFontSize(16); doc.text('Monthly Attendance Register',10,10);
      doc.setFontSize(12);
      doc.text(`Month: ${regMonthIn.value}`,10,20);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`,10,26);
      doc.text(`School: ${setup?.school || ''}`,10,32);
      doc.text(`Class: ${setup?.class || ''} | Section: ${setup?.section || ''}`,10,38);
      doc.autoTable({
        html: '#registerTable',
        startY:44,
        styles:{ fontSize:6 },
        columnStyles:{ 0:{cellWidth:10},1:{cellWidth:15},2:{cellWidth:30} }
      });
      doc.autoTable({
        html: '#registerSummarySection table',
        startY: doc.lastAutoTable.finalY + 10,
        styles:{ fontSize:8 }
      });
      doc.save('attendance_register.pdf');
    };
  }); // end of mainApp
});
