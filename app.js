// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // 1. SETUP
  const schoolIn = $('schoolNameInput'),
        classSel = $('teacherClassSelect'),
        secSel   = $('teacherSectionSelect'),
        saveSetup = $('saveSetup'),
        setupForm = $('setupForm'),
        setupDisplay = $('setupDisplay'),
        setupText = $('setupText'),
        editSetup = $('editSetup');
  function loadSetup() {
    const s = localStorage.getItem('schoolName'),
          c = localStorage.getItem('teacherClass'),
          e = localStorage.getItem('teacherSection');
    if (s && c && e) {
      schoolIn.value=s; classSel.value=c; secSel.value=e;
      setupText.textContent = `${s} 🏫 | Class: ${c} | Section: ${e}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }
  saveSetup.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value||!classSel.value||!secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };
  editSetup.onclick = e => { e.preventDefault(); setupForm.classList.remove('hidden'); setupDisplay.classList.add('hidden'); };
  loadSetup();

  // 2. STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students')||'[]');
  const studentNameIn = $('studentName'),
        admissionNoIn = $('admissionNo'),
        parentNameIn = $('parentName'),
        parentContactIn = $('parentContact'),
        parentOccIn = $('parentOccupation'),
        parentAddrIn = $('parentAddress'),
        addStudentBtn = $('addStudent'),
        studentsBody = $('studentsBody'),
        selectAll = $('selectAllStudents'),
        editSelBtn = $('editSelected'),
        deleteSelBtn = $('deleteSelected'),
        saveRegBtn = $('saveRegistration'),
        shareRegBtn = $('shareRegistration'),
        editRegBtn = $('editRegistration'),
        downloadRegBtn = $('downloadRegistrationPDF');

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }
  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb=>{
      cb.onchange = ()=>{
        cb.closest('tr').classList.toggle('selected', cb.checked);
        const any=boxes.some(x=>x.checked);
        editSelBtn.disabled=deleteSelBtn.disabled=!any;
      };
    });
    selectAll.disabled = !!localStorage.getItem('studentsSaved');
    selectAll.onchange = ()=>{ boxes.forEach(cb=>{ cb.checked=selectAll.checked; cb.dispatchEvent(new Event('change')); }); };
  }
  function renderStudents() {
    studentsBody.innerHTML='';
    students.forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML =
        `<td><input type="checkbox" class="sel" data-index="${i}" ${localStorage.getItem('studentsSaved')?'disabled':''}></td>`+
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>`+
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>`+
        `<td>${localStorage.getItem('studentsSaved')?'<button class="share-one">Share</button>':''}</td>`;
      if (localStorage.getItem('studentsSaved')) {
        tr.querySelector('.share-one').onclick = ev=>{
          ev.preventDefault();
          const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
          const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }

  addStudentBtn.onclick = ev=>{
    ev.preventDefault();
    const name=studentNameIn.value.trim(),
          adm=admissionNoIn.value.trim(),
          parent=parentNameIn.value.trim(),
          contact=parentContactIn.value.trim(),
          occ=parentOccIn.value.trim(),
          addr=parentAddrIn.value.trim();
    if(!name||!adm||!parent||!contact||!occ||!addr) return alert('All fields required');
    if(!/^\d+$/.test(adm)) return alert('Adm# must be numeric');
    if(students.some(s=>s.adm===adm)) return alert('Admission# already exists');
    if(!/^\d{7,15}$/.test(contact)) return alert('Contact must be 7-15 digits');
    students.push({name,adm,parent,contact,occupation:occ,address:addr,roll:Date.now()});
    saveStudents(); renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn].forEach(i=>i.value='');
  };

  editSelBtn.onclick = ev=>{
    ev.preventDefault();
    // inline edit logic...
  };
  deleteSelBtn.onclick = ev=>{
    ev.preventDefault();
    if(!confirm('Delete selected?')) return;
    Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb=>+cb.dataset.index).sort((a,b)=>b-a).forEach(i=>students.splice(i,1));
    saveStudents(); renderStudents(); selectAll.checked=false;
  };

  saveRegBtn.onclick = ev=>{
    ev.preventDefault();
    localStorage.setItem('studentsSaved','1');
    renderStudents();
    saveRegBtn.classList.add('hidden');
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$ (id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegBtn.classList.remove('hidden');
  };
  editRegBtn.onclick = ev=>{
    ev.preventDefault();
    localStorage.removeItem('studentsSaved');
    renderStudents();
    saveRegBtn.classList.remove('hidden');
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$ (id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegBtn.classList.add('hidden');
  };

  // ** FIXED: share and download for registration **
  shareRegBtn.onclick = ev=>{
    ev.preventDefault();
    const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s=>`Name: ${s.name}, Adm#: ${s.adm}, Parent: ${s.parent}, Contact: ${s.contact}, Occupation: ${s.occupation}, Address: ${s.address}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`, '_blank');
  };
  downloadRegBtn.onclick = ev=>{
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Student Registration',10,10);
    doc.setFontSize(12);
    const date = new Date().toLocaleDateString();
    doc.text(`Date: ${date}`,10,20);
    doc.text(`School: ${localStorage.getItem('schoolName')}`,10,26);
    doc.text(`Class: ${localStorage.getItem('teacherClass')}`,10,32);
    doc.text(`Section: ${localStorage.getItem('teacherSection')}`,10,38);
    doc.autoTable({
      head:[['Name','Adm#','Parent','Contact','Occupation','Address']],
      body:students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]),
      startY:44
    });
    doc.save('student_registration.pdf');
  };

  renderStudents();

  // 3. ATTENDANCE MARKING & SUMMARY
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');
  const dateInput = $('dateInput'),
        loadAtt = $('loadAttendance'),
        attList = $('attendanceList'),
        saveAtt = $('saveAttendance'),
        resultSec = $('attendance-result'),
        summaryBody = $('summaryBody'),
        shareAttendanceSummary = $('shareAttendanceSummary'),
        downloadAttendancePDF = $('downloadAttendancePDF');

  loadAtt.onclick = ev=>{
    ev.preventDefault();
    if(!dateInput.value) return alert('Pick a date');
    attList.innerHTML='';
    students.forEach(s=>{
      const row = document.createElement('div');
      row.textContent = s.name; row.className='attendance-item';
      const btns = document.createElement('div'); btns.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b = document.createElement('button');
        b.textContent=code; b.className='att-btn';
        if(attendanceData[dateInput.value]?.[s.roll]===code) {
          b.style.background=colors[code]; b.style.color='#fff';
        }
        b.onclick = ()=>{ btns.querySelectorAll('.att-btn').forEach(x=>{x.style.background='';x.style.color='#333';}); b.style.background=colors[code]; b.style.color='#fff'; };
        btns.append(b);
      });
      attList.append(row, btns);
    });
    saveAtt.classList.remove('hidden');
  };
  saveAtt.onclick = ev=>{
    ev.preventDefault();
    const d = dateInput.value;
    attendanceData[d] = {};
    attList.querySelectorAll('.attendance-actions').forEach((btns,i)=>{
      const sel = btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll] = sel ? sel.textContent : 'A';
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    resultSec.classList.remove('hidden');
    summaryBody.innerHTML='';
    const hdr = `Date: ${d}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    students.forEach(s=>{
      const code = attendanceData[d][s.roll]||'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick = ()=>{
        window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+s.name+': '+status)}`, '_blank');
      };
      summaryBody.appendChild(tr);
    });
  };
  // ** FIXED: share & download attendance summary **
  shareAttendanceSummary.onclick = ev=>{
    ev.preventDefault();
    const d = dateInput.value;
    const hdr = `Date: ${d}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s=>{
      const code = attendanceData[d][s.roll]||'A';
      const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
      return `${s.name}: ${status}`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`, '_blank');
  };
  downloadAttendancePDF.onclick = ev=>{
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const d = dateInput.value;
    doc.setFontSize(16); doc.text('Attendance Summary',10,10);
    doc.setFontSize(12);
    const formatted = new Date(d).toLocaleDateString();
    doc.text(`Date: ${formatted}`,10,20);
    doc.text(`School: ${localStorage.getItem('schoolName')}`,10,26);
    doc.text(`Class: ${localStorage.getItem('teacherClass')}`,10,32);
    doc.text(`Section: ${localStorage.getItem('teacherSection')}`,10,38);
    doc.autoTable({
      head:[['Name','Status']],
      body: students.map(s=>{
        const code = attendanceData[d][s.roll]||'A';
        const status = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code];
        return [s.name, status];
      }),
      startY:44
    });
    doc.save('attendance_summary.pdf');
  };

  // 4. ANALYTICS (leave share/download to similar pattern)
  const shareAnalyticsBtn = $('shareAnalytics'),
        downloadAnalyticsBtn = $('downloadAnalytics');
  shareAnalyticsBtn.onclick = ev=>{
    ev.preventDefault();
    const instr = $('instructions').textContent;
    const hdr = instr + `\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const rows = Array.from($('analyticsContainer').querySelectorAll('tbody tr')).map(tr=>{
      const tds = tr.querySelectorAll('td');
      return `${tds[0].textContent} P:${tds[1].textContent} A:${tds[2].textContent} Lt:${tds[3].textContent} HD:${tds[4].textContent} L:${tds[5].textContent} %:${tds[7].textContent}`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+rows)}`, '_blank');
  };
  downloadAnalyticsBtn.onclick = ev=>{
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Attendance Analytics',10,10);
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`,10,20);
    const hdr = $('instructions').textContent;
    doc.text(`Period: ${hdr.replace(/^.*\| /,'')}`,10,26);
    doc.text(`School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`,10,32);
    doc.autoTable({ html:'#analyticsContainer table', startY:38 });
    doc.save('attendance_analytics.pdf');
  };

  // 5. ATTENDANCE REGISTER
  const shareRegister2 = $('shareRegister'),
        downloadRegister2 = $('downloadRegisterPDF');
  shareRegister2.onclick = ev=>{
    ev.preventDefault();
    const month = $('registerMonth').value;
    const hdr = `Register for ${month}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const rows = Array.from($('registerSummaryBody').querySelectorAll('tr')).map(tr=>{
      const tds = tr.querySelectorAll('td');
      return `${tds[0].textContent}: P:${tds[1].textContent} A:${tds[2].textContent} Lt:${tds[3].textContent} HD:${tds[4].textContent} L:${tds[5].textContent} %:${tds[6].textContent}`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+rows)}`, '_blank');
  };
  downloadRegister2.onclick = ev=>{
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    doc.setFontSize(16); doc.text('Monthly Attendance Register',10,10);
    doc.setFontSize(12);
    const month = $('registerMonth').value;
    doc.text(`Month: ${month}`,10,20);
    doc.text(`School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`,10,26);
    doc.autoTable({ html:'#registerTable', startY:32, styles:{fontSize:6} });
    doc.autoTable({ html:'.table-wrapper table', startY:doc.lastAutoTable.finalY+10, styles:{fontSize:8} });
    doc.save('attendance_register.pdf');
  };

  // Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', ()=> navigator.serviceWorker.register('service-worker.js'));
  }
});
