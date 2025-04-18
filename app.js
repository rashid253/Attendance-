// app.js
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const THRESHOLD = 75;

  // --- Setup ---
  /* unchanged */

  // --- Student Registration ---
  let students = JSON.parse(localStorage.getItem('students')||'[]');
  const sName = $('studentName'), admNo = $('admissionNo');
  const addStu = $('addStudent');
  const studentsTableBody = $('studentsTable').querySelector('tbody');
  const shareAllBtn = $('shareAll'), saveAllBtn = $('saveAll');

  function renderStudents() {
    studentsTableBody.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.name}</td>
        <td>${s.adm||'-'}</td>
        <td>${s.parent||''}</td>
        <td>${s.contact||''}</td>
        <td>${s.occupation||''}</td>
        <td>${s.address||''}</td>
        <td class="actions">
          <button class="edit">✏️</button>
          <button class="delete">🗑️</button>
          <button class="share">🔗</button>
        </td>
      `;
      // Edit
      tr.querySelector('.edit').onclick = () => {
        const name = prompt('Name', s.name);
        if (name) s.name = name.trim();
        s.adm = prompt('Adm No', s.adm)||'';
        s.parent = prompt('Parent Name', s.parent)||'';
        s.contact = prompt('Parent Contact', s.contact)||'';
        s.occupation = prompt('Occupation', s.occupation)||'';
        s.address = prompt('Address', s.address)||'';
        localStorage.setItem('students', JSON.stringify(students));
        renderStudents();
      };
      // Delete
      tr.querySelector('.delete').onclick = () => {
        if (confirm('Delete this student?')) {
          students.splice(i,1);
          localStorage.setItem('students', JSON.stringify(students));
          renderStudents();
        }
      };
      // Share
      tr.querySelector('.share').onclick = () => {
        const msg = `Student: ${s.name}\nAdm#: ${s.adm}`;
        const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(url,'_blank');
      };
      studentsTableBody.appendChild(tr);
    });
  }

  addStu.onclick = () => {
    const name = sName.value.trim(), adm = admNo.value.trim();
    if (!name) return alert('Enter name');
    // prompt for other info
    const parent = prompt('Parent Name')||'';
    const contact = prompt('Parent Contact')||'';
    const occupation = prompt('Occupation')||'';
    const address = prompt('Address')||'';
    students.push({ name, adm, parent, contact, occupation, address, roll: Date.now() });
    localStorage.setItem('students', JSON.stringify(students));
    sName.value = admNo.value = '';
    renderStudents();
  };

  shareAllBtn.onclick = () => {
    let texts = students.map(s => `${s.name} (${s.adm})`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(texts)}`,'_blank');
  };
  saveAllBtn.onclick = () => {
    // Example: save to localStorage (already saved on every op) or export
    alert('All student data is already saved locally.');
  };

  renderStudents();

  // --- Attendance Marking ---
  const dateIn = $('dateInput'), loadAtt = $('loadAttendance');
  const attList = $('attendanceList'), saveAtt = $('saveAttendance');
  const attResultSec = $('attendance-result'), attSummaryBody = $('attendanceSummaryTable').querySelector('tbody');
  const resetAtt = $('resetAttendance');

  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');

  loadAtt.onclick = () => {
    if (!dateIn.value) return alert('Pick date');
    attList.innerHTML = '';
    students.forEach(s => {
      const div = document.createElement('div'); div.className='attendance-item';
      div.innerHTML = `<span>${s.name}</span><div class="attendance-actions">
        ${['P','A','Lt','HD','L'].map(code => `<button class="att-btn">${code}</button>`).join('')}
      </div>`;
      // toggle selection
      div.querySelectorAll('.att-btn').forEach(btn => {
        btn.onclick = () => {
          div.querySelectorAll('.att-btn').forEach(b=>b.classList.remove('selected'));
          btn.classList.add('selected');
        };
      });
      attList.append(div);
    });
    saveAtt.classList.remove('hidden');
  };

  saveAtt.onclick = () => {
    // hide marking UI
    document.getElementById('attendance-section').classList.add('hidden');
    attResultSec.classList.remove('hidden');

    const d = dateIn.value;
    attendanceData[d] = {};
    const rows = attList.querySelectorAll('.attendance-item');
    rows.forEach((div,i)=>{
      const sel = div.querySelector('.attendance-actions .selected');
      const status = sel ? sel.textContent : '';
      attendanceData[d][students[i].roll] = status;
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));

    // populate summary table
    attSummaryBody.innerHTML = '';
    students.forEach(s => {
      const status = attendanceData[d][s.roll] || 'Not marked';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.name}</td>
        <td>${status}</td>
        <td><button class="wa">📱</button></td>
      `;
      tr.querySelector('.wa').onclick = () => {
        const msg = `Attendance for ${s.name} on ${d}: ${status}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
      };
      attSummaryBody.appendChild(tr);
    });
  };

  resetAtt.onclick = () => {
    attResultSec.classList.add('hidden');
    document.getElementById('attendance-section').classList.remove('hidden');
    attList.innerHTML = '';
    saveAtt.classList.add('hidden');
  };

  // --- Analytics (unchanged) ---
});
