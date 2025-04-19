// ----- ATTENDANCE MARKING & SUMMARY -----
(() => {
  const students = JSON.parse(localStorage.getItem('students') || '[]');
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');

  const dateInput           = document.getElementById('dateInput');
  const loadAttBtn          = document.getElementById('loadAttendance');
  const attList             = document.getElementById('attendanceList');
  const saveAttBtn          = document.getElementById('saveAttendance');
  const attendanceSection   = document.getElementById('attendance-section');
  const resultSection       = document.getElementById('attendance-result');
  const summaryBody         = document.getElementById('summaryBody');
  const resetAttBtn         = document.getElementById('resetAttendance');
  const shareAttBtn         = document.getElementById('shareAttendanceSummary');
  const downloadAttPDFBtn   = document.getElementById('downloadAttendancePDF');
  const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };

  loadAttBtn.addEventListener('click', e => {
    e.preventDefault();
    if (!dateInput.value) return alert('Pick a date');
    attList.innerHTML = '';
    students.forEach(s => {
      const row = document.createElement('div');
      row.className = 'attendance-item';
      row.textContent = s.name;
      const btns = document.createElement('div');
      btns.className = 'attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'att-btn';
        b.textContent = code;
        b.dataset.code = code;
        // restore previous
        if (attendanceData[dateInput.value]?.[s.roll] === code) {
          b.style.background = colors[code];
          b.style.color = '#fff';
        }
        b.addEventListener('click', () => {
          btns.querySelectorAll('.att-btn').forEach(x => {
            x.style.background = '';
            x.style.color = 'var(--dark)';
          });
          b.style.background = colors[code];
          b.style.color = '#fff';
        });
        btns.append(b);
      });
      attList.append(row, btns);
    });
    saveAttBtn.classList.remove('hidden');
  });

  saveAttBtn.addEventListener('click', e => {
    e.preventDefault();
    const d = dateInput.value;
    attendanceData[d] = {};
    attList.querySelectorAll('.attendance-actions').forEach((btns, i) => {
      const sel = btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll] = sel ? sel.dataset.code : 'A';
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    attendanceSection.classList.add('hidden');
    resultSection.classList.remove('hidden');
    summaryBody.innerHTML = '';
    // header row
    summaryBody.insertAdjacentHTML('beforebegin',
      `<tr><td colspan="3"><em>
         Date: ${d} | School: ${localStorage.getItem('schoolName')} |
         Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}
       </em></td></tr>`);
    students.forEach(s => {
      const code   = attendanceData[d][s.roll] || 'A';
      const status = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' }[code];
      const tr     = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${status}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').addEventListener('click', () => {
        const msg = `Date: ${d}\nName: ${s.name}\nStatus: ${status}\nClass: ${localStorage.getItem('teacherClass')}`;
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      });
      summaryBody.appendChild(tr);
    });
  });

  resetAttBtn.addEventListener('click', e => {
    e.preventDefault();
    resultSection.classList.add('hidden');
    attendanceSection.classList.remove('hidden');
    attList.innerHTML = '';
    saveAttBtn.classList.add('hidden');
    summaryBody.innerHTML = '';
  });

  shareAttBtn.addEventListener('click', e => {
    e.preventDefault();
    const d = dateInput.value;
    const hdr = `Date: ${d} | School: ${localStorage.getItem('schoolName')}`;
    const remap = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' };
    const lines = students.map(s => `${s.name}: ${remap[attendanceData[d]?.[s.roll]||'A']}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n' + lines)}`, '_blank');
  });

  downloadAttPDFBtn.addEventListener('click', e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    doc.autoTable({
      head: [['Name','Status']],
      body: students.map(s => {
        const code = attendanceData[dateInput.value]?.[s.roll] || 'A';
        return [s.name, {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[code]];
      }),
      startY: 40,
      margin: { left:40, right:40 },
      styles: { fontSize: 10 }
    });
    doc.save('attendance_summary.pdf');
  });
})();
