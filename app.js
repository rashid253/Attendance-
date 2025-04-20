// app.js
window.addEventListener('DOMContentLoaded', () => {
  // jsPDF constructor from UMD bundle
  const { jsPDF } = window.jspdf;

  // Helper to fetch element by ID
  const $ = id => document.getElementById(id);

  // Color mapping for attendance codes
  const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };

  // 1. SETUP
  const schoolIn = $('schoolNameInput');
  const classSel = $('teacherClassSelect');
  const secSel = $('teacherSectionSelect');
  const saveSetup = $('saveSetup');
  const setupForm = $('setupForm');
  const setupDisplay = $('setupDisplay');
  const setupText = $('setupText');
  const editSetup = $('editSetup');

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

  saveSetup.addEventListener('click', e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) {
      alert('Complete setup first');
      return;
    }
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  });

  editSetup.addEventListener('click', e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  });

  loadSetup();

  // 2. STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const studentNameIn = $('studentName');
  const admissionNoIn = $('admissionNo');
  const parentNameIn = $('parentName');
  const parentContactIn = $('parentContact');
  const parentOccIn = $('parentOccupation');
  const parentAddrIn = $('parentAddress');
  const addStudentBtn = $('addStudent');
  const studentsBody = $('studentsBody');
  const selectAll = $('selectAllStudents');
  const editSelBtn = $('editSelected');
  const deleteSelBtn = $('deleteSelected');
  const saveRegBtn = $('saveRegistration');
  const shareRegBtn = $('shareRegistration');
  const editRegBtn = $('editRegistration');
  const downloadRegBtn = $('downloadRegistrationPDF');
  const studentTableWrapper = $('studentTableWrapper');
  let regSaved = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function bindSelection() {
    const boxes = Array.from(document.querySelectorAll('.sel'));
    boxes.forEach(cb => cb.onchange = () => {
      cb.closest('tr').classList.toggle('selected', cb.checked);
      const any = boxes.some(x => x.checked);
      editSelBtn.disabled = deleteSelBtn.disabled = !any;
    });
    selectAll.disabled = regSaved;
    selectAll.onchange = () => {
      if (!regSaved) boxes.forEach(cb => (cb.checked = selectAll.checked, cb.onchange()));
    };
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
        tr.querySelector('.share-one').onclick = e => {
          e.preventDefault();
          const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
          const msg = `${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
        };
      }
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }

  addStudentBtn.addEventListener('click', e => {
    e.preventDefault();
    const name = studentNameIn.value.trim();
    const adm = admissionNoIn.value.trim();
    const parent = parentNameIn.value.trim();
    const contact = parentContactIn.value.trim();
    const occ = parentOccIn.value.trim();
    const addr = parentAddrIn.value.trim();
    if (!name || !adm || !parent || !contact || !occ || !addr) { alert('All fields are required'); return; }
    if (!/^[0-9]+$/.test(adm)) { alert('Admission No must be numeric'); return; }
    if (students.some(s => s.adm === adm)) { alert('Admission No already exists'); return; }
    if (!/^[0-9]{7,15}$/.test(contact)) { alert('Contact must be 7-15 digits'); return; }
    students.push({ name, adm, parent, contact, occupation: occ, address: addr, roll: Date.now() });
    saveStudents(); renderStudents();
    [studentNameIn, admissionNoIn, parentNameIn, parentContactIn, parentOccIn, parentAddrIn].forEach(i => i.value = '');
  });

  saveRegBtn.addEventListener('click', e => {
    e.preventDefault(); regSaved = true;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.add('hidden'));
    shareRegBtn.classList.remove('hidden');
    editRegBtn.classList.remove('hidden');
    downloadRegBtn.classList.remove('hidden');
    studentTableWrapper.classList.add('saved'); renderStudents();
  });

  editRegBtn.addEventListener('click', e => {
    e.preventDefault(); regSaved = false;
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id => $(id).classList.remove('hidden'));
    shareRegBtn.classList.add('hidden');
    editRegBtn.classList.add('hidden');
    downloadRegBtn.classList.add('hidden');
    studentTableWrapper.classList.remove('saved'); renderStudents();
  });

  shareRegBtn.addEventListener('click', e => {
    e.preventDefault();
    const hdr = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = students.map(s => `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines.join('\n---\n'))}`);
  });

  downloadRegBtn.addEventListener('click', e => {
    e.preventDefault();
    const doc = new jsPDF('p','pt','a4');
    doc.autoTable({ 
      head: [['Name','Adm#','Parent','Contact','Occupation','Address']], 
      body: students.map(s => [s.name,s.adm,s.parent,s.contact,s.occupation,s.address]), 
      startY: 40, 
      margin: {left: 40, right: 40}, 
      styles: {fontSize: 10} 
    });
    doc.save('students_registration.pdf');
  });

  renderStudents();

  // 3. MARK ATTENDANCE - Fixed section
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
  const dateInput = $('dateInput');
  const loadAtt = $('loadAttendance');
  const attList = $('attendanceList');
  const saveAtt = $('saveAttendance');
  const resetAtt = $('resetAttendance');
  const summaryBody = $('summaryBody');

  loadAtt.addEventListener('click', e => {
    e.preventDefault();
    if (!dateInput.value) { 
      alert('Select a date'); 
      return; 
    }
    if (students.length === 0) {
      alert('No students registered yet');
      return;
    }
    
    attList.innerHTML = '';
    students.forEach(s => {
      const row = document.createElement('div');
      row.className = 'attendance-item';
      row.textContent = s.name;
      
      const btns = document.createElement('div');
      btns.className = 'attendance-actions';
      
      ['P','A','Lt','HD','L'].forEach(code => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'att-btn';
        btn.dataset.code = code;
        btn.textContent = code;
        
        // Set initial state if attendance exists
        if (attendanceData[dateInput.value]?.[s.roll] === code) {
          btn.style.background = colors[code];
          btn.style.color = '#fff';
        }
        
        btn.addEventListener('click', () => {
          // Reset all buttons in this group
          btns.querySelectorAll('.att-btn').forEach(b => {
            b.style.background = '';
            b.style.color = 'var(--dark)';
          });
          // Set selected button style
          btn.style.background = colors[code];
          btn.style.color = '#fff';
        });
        
        btns.appendChild(btn);
      });
      
      attList.appendChild(row);
      attList.appendChild(btns);
    });
    
    saveAtt.classList.remove('hidden');
  });

  saveAtt.addEventListener('click', e => {
    e.preventDefault();
    const date = dateInput.value;
    attendanceData[date] = {};
    
    // Get all attendance action groups
    const actionGroups = document.querySelectorAll('.attendance-actions');
    
    actionGroups.forEach((group, index) => {
      const selectedBtn = group.querySelector('.att-btn[style*="background"]');
      const status = selectedBtn ? selectedBtn.dataset.code : 'A';
      attendanceData[date][students[index].roll] = status;
    });
    
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    
    // Show summary
    $('attendance-section').classList.add('hidden');
    $('attendance-result').classList.remove('hidden');
    
    // Populate summary table
    summaryBody.innerHTML = '';
    const statusMap = { P: 'Present', A: 'Absent', Lt: 'Late', HD: 'Half Day', L: 'Leave' };
    
    students.forEach((student, index) => {
      const status = attendanceData[date]?.[student.roll] || 'A';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${student.name}</td>
        <td>${statusMap[status]}</td>
        <td><button class="share-one" data-index="${index}">Send</button></td>
      `;
      summaryBody.appendChild(tr);
      
      // Add click handler for share buttons
      tr.querySelector('.share-one').addEventListener('click', () => {
        const msg = `Date: ${date}\nStudent: ${student.name}\nStatus: ${statusMap[status]}\nSchool:
          // 5. ATTENDANCE REGISTER (continued)
  loadRegister.addEventListener('click', e => {
    e.preventDefault();
    if (!registerMonth.value) { 
      alert('Please select a month'); 
      return; 
    }
    if (students.length === 0) {
      alert('No students registered yet');
      return;
    }

    const [year, month] = registerMonth.value.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Clear existing header cells except the first three (Sr#, Adm#, Name)
    const headerRow = document.querySelector('#registerTable thead tr');
    while (headerRow.children.length > 3) {
      headerRow.removeChild(headerRow.lastChild);
    }

    // Add day columns to header
    for (let day = 1; day <= daysInMonth; day++) {
      const th = document.createElement('th');
      th.textContent = day;
      headerRow.appendChild(th);
    }

    // Populate student rows
    registerBody.innerHTML = '';
    students.forEach((student, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${student.adm}</td>
        <td>${student.name}</td>
      `;

      // Add attendance cells for each day
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${registerMonth.value}-${day.toString().padStart(2, '0')}`;
        const status = attendanceData[dateStr]?.[student.roll] || '';
        const cell = document.createElement('td');
        cell.textContent = status;
        
        // Apply styling if status exists
        if (status) {
          cell.style.backgroundColor = colors[status];
          cell.style.color = '#fff';
        }
        
        row.appendChild(cell);
      }

      registerBody.appendChild(row);
    });

    // Calculate and display summary
    registerSummaryBody.innerHTML = '';
    students.forEach(student => {
      const stats = { P: 0, A: 0, Lt: 0, HD: 0, L: 0 };
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${registerMonth.value}-${day.toString().padStart(2, '0')}`;
        const status = attendanceData[dateStr]?.[student.roll] || 'A';
        stats[status]++;
      }

      const totalDays = daysInMonth;
      const percentage = totalDays > 0 ? ((stats.P / totalDays) * 100).toFixed(1) : '0.0';

      const summaryRow = document.createElement('tr');
      summaryRow.innerHTML = `
        <td>${student.name}</td>
        <td>${stats.P}</td>
        <td>${stats.A}</td>
        <td>${stats.Lt}</td>
        <td>${stats.HD}</td>
        <td>${stats.L}</td>
        <td>${percentage}%</td>
      `;
      registerSummaryBody.appendChild(summaryRow);
    });

    // Show the tables
    registerTableWrapper.classList.remove('hidden');
    $('registerSummarySection').classList.remove('hidden');
    changeRegister.classList.remove('hidden');
    loadRegister.classList.add('hidden');
  });

  changeRegister.addEventListener('click', e => {
    e.preventDefault();
    registerTableWrapper.classList.add('hidden');
    $('registerSummarySection').classList.add('hidden');
    changeRegister.classList.add('hidden');
    loadRegister.classList.remove('hidden');
    registerMonth.value = '';
  });

  shareRegister.addEventListener('click', e => {
    e.preventDefault();
    if (!registerMonth.value) {
      alert('Please load a register first');
      return;
    }

    const summaryLines = [];
    const rows = document.querySelectorAll('#registerSummaryBody tr');
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      summaryLines.push(
        `${cells[0].textContent}: P ${cells[1].textContent}, A ${cells[2].textContent}, ` +
        `Lt ${cells[3].textContent}, HD ${cells[4].textContent}, L ${cells[5].textContent}, ` +
        `Attendance % ${cells[6].textContent}`
      );
    });

    const message = `Attendance Register for ${registerMonth.value}\n` +
                   `School: ${localStorage.getItem('schoolName')}\n` +
                   `Class: ${localStorage.getItem('teacherClass')}, Section: ${localStorage.getItem('teacherSection')}\n\n` +
                   summaryLines.join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);
  });

  downloadRegisterPDF.addEventListener('click', e => {
    e.preventDefault();
    if (!registerMonth.value) {
      alert('Please load a register first');
      return;
    }

    const doc = new jsPDF('landscape', 'pt', 'a4');
    
    // Add header
    doc.setFontSize(16);
    doc.text(`Attendance Register - ${registerMonth.value}`, 40, 40);
    doc.setFontSize(12);
    doc.text(`School: ${localStorage.getItem('schoolName')}`, 40, 60);
    doc.text(`Class: ${localStorage.getItem('teacherClass')}, Section: ${localStorage.getItem('teacherSection')}`, 40, 80);

    // Get all day headers
    const dayHeaders = Array.from(document.querySelectorAll('#registerTable thead th'))
      .slice(3) // Skip Sr#, Adm#, Name
      .map(th => th.textContent);

    // Prepare register data
    const registerData = Array.from(document.querySelectorAll('#registerTable tbody tr')).map(row => {
      const cells = Array.from(row.cells);
      return [
        cells[0].textContent, // Sr#
        cells[1].textContent, // Adm#
        cells[2].textContent, // Name
        ...dayHeaders.map((_, i) => cells[i + 3].textContent) // Attendance
      ];
    });

    // Create register table
    doc.autoTable({
      head: [['Sr#', 'Adm#', 'Name', ...dayHeaders]],
      body: registerData,
      startY: 100,
      margin: { left: 20, right: 20 },
      styles: { fontSize: 6 },
      columnStyles: {
        0: { cellWidth: 20 }, // Sr#
        1: { cellWidth: 30 }, // Adm#
        2: { cellWidth: 60 }, // Name
        ...dayHeaders.reduce((styles, _, index) => {
          styles[index + 3] = { cellWidth: 10 }; // Day columns
          return styles;
        }, {})
      }
    });

    // Add summary table on a new page
    doc.addPage();
    doc.setFontSize(16);
    doc.text('Attendance Summary', 40, 40);
    
    const summaryData = Array.from(document.querySelectorAll('#registerSummaryBody tr')).map(row => {
      const cells = Array.from(row.cells);
      return [
        cells[0].textContent, // Name
        cells[1].textContent, // P
        cells[2].textContent, // A
        cells[3].textContent, // Lt
        cells[4].textContent, // HD
        cells[5].textContent, // L
        cells[6].textContent  // %
      ];
    });

    doc.autoTable({
      head: [['Name', 'Present', 'Absent', 'Late', 'Half Day', 'Leave', 'Attendance %']],
      body: summaryData,
      startY: 60,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 10 }
    });

    doc.save(`attendance_register_${registerMonth.value}.pdf`);
  });
});
