// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const THRESHOLD = 75;
  const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'var(--orange)', L:'var(--info)' };

  // --- SETUP ---
  // ... existing setup handlers ...

  // --- STUDENT REGISTRATION ---
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  const inputs      = ['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress'].map($),
        addBtn      = $('addStudent'),
        tblBody     = $('studentsBody'),
        selectAll   = $('selectAllStudents'),
        editSel     = $('editSelected'),
        delSel      = $('deleteSelected'),
        saveReg     = $('saveRegistration'),
        shareReg    = $('shareRegistration'),
        editReg     = $('editRegistration'),
        downloadReg = $('downloadRegistrationPDF');
  let savedReg = false, inlineMode = false;

  function saveStudents() {
    localStorage.setItem('students', JSON.stringify(students));
  }

  function renderStudents() {
    tblBody.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td class="select-col" style="${savedReg?'display:none':''}"><input type="checkbox" class="selStu" data-i="${i}"></td>` +
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>` +
        `<td>${savedReg?'<button class="sRow">Share</button>':''}</td>`;
      if (savedReg) {
        tr.querySelector('.sRow').onclick = () => {
          const hdr = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
          const msg = `${hdr}\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        };
      }
      tblBody.appendChild(tr);
    });
    bindSelection();
  }

  function bindSelection() {
    const boxes = [...document.querySelectorAll('.selStu')];
    boxes.forEach(cb => cb.onchange = () => {
      const tr = cb.closest('tr');
      cb.checked ? tr.classList.add('selected') : tr.classList.remove('selected');
      const any = boxes.some(x=>x.checked);
      editSel.disabled = delSel.disabled = !any || savedReg;
    });
    selectAll.disabled = savedReg;
    selectAll.onchange = () => {
      if (savedReg) return;
      boxes.forEach(cb => { cb.checked = selectAll.checked; cb.dispatchEvent(new Event('change')); });
    };
  }

  delSel.onclick = () => {
    if (!confirm('Delete selected students?')) return;
    [...document.querySelectorAll('.selStu:checked')].map(cb=>+cb.dataset.i).sort((a,b)=>b-a)
      .forEach(idx=>students.splice(idx,1));
    saveStudents(); renderStudents(); selectAll.checked = false;
  };

  function onBlur(e) {
    const td = e.target,
          tr = td.closest('tr'),
          idx = +tr.querySelector('.selStu').dataset.i,
          keys = ['name','adm','parent','contact','occupation','address'],
          ci = Array.from(tr.children).indexOf(td);
    if (ci>=1 && ci<=6) {
      students[idx][keys[ci-1]] = td.textContent.trim();
      saveStudents();
    }
  }

  editSel.onclick = () => {
    if (savedReg) return;
    const sel = [...document.querySelectorAll('.selStu:checked')];
    if (!sel.length) return;
    inlineMode = !inlineMode;
    editSel.textContent = inlineMode ? 'Done Editing' : 'Edit Selected';
    sel.forEach(cb => {
      const tr = cb.closest('tr');
      [...tr.querySelectorAll('td')].forEach((td,ci) => {
        if (ci>=1 && ci<=6) {
          td.contentEditable = inlineMode;
          td.classList.toggle('editing', inlineMode);
          if (inlineMode) td.addEventListener('blur', onBlur);
          else td.removeEventListener('blur', onBlur);
        }
      });
    });
  };

  saveReg.onclick = () => {
    savedReg = true;
    [editSel,delSel,selectAll,saveReg].forEach(b=>b.style.display='none');
    shareReg.classList.remove('hidden');
    editReg.classList.remove('hidden');
    downloadReg.classList.remove('hidden');
    renderStudents();
  };

  editReg.onclick = () => {
    savedReg = false;
    [editSel,delSel,selectAll,saveReg].forEach(b=>b.style.display='');
    shareReg.classList.add('hidden');
    editReg.classList.add('hidden');
    downloadReg.classList.add('hidden');
    renderStudents();
  };

  shareReg.onclick = () => {
    const hdr = `School: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    const data = students.map(s =>
      `Name: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
    ).join('\n---\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+data)}`, '_blank');
  };

  addBtn.onclick = () => {
    if (savedReg) return;
    const vs = inputs.map(i=>i.value.trim());
    if (!vs[0]||!vs[1]) return alert('Name & Adm# required');
    students.push({ name: vs[0], adm: vs[1], parent: vs[2], contact: vs[3], occupation: vs[4], address: vs[5], roll: Date.now() });
    saveStudents(); renderStudents(); inputs.forEach(i=>i.value='');
  };

  renderStudents();

  // Download Registration PDF
  downloadReg.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    let y = 20;
    const header = [
      `School: ${localStorage.getItem('schoolName')}`,
      `Class: ${localStorage.getItem('teacherClass')}`,
      `Section: ${localStorage.getItem('teacherSection')}`
    ].join(' | ');
    doc.setFontSize(14);
    doc.text(header, 20, y);
    y += 20;
    doc.autoTable({
      html: document.getElementById('studentTable'),
      startY: y,
      theme: 'grid',
      headStyles: { fillColor: [41,128,185], textColor:255, fontStyle:'bold' },
      styles: { fontSize:10, cellPadding:4 }
    });
    doc.save('Student_Registration.pdf');
  };

  // --- ATTENDANCE MARKING & SUMMARY ---
  // ... existing attendance code ...

  // Share Attendance Summary
  $('shareAttendanceSummary').onclick = () => {
    const date = $('dateInput').value;
    const header = [
      `Date: ${date}`,
      `School: ${localStorage.getItem('schoolName')}`,
      `Class: ${localStorage.getItem('teacherClass')}`,
      `Section: ${localStorage.getItem('teacherSection')}`,
      ''
    ].join('\n');

    const rows = Array.from(document.querySelectorAll('#summaryBody tr'));
    const blocks = rows.map(tr => {
      const name   = tr.children[0].textContent;
      const status = tr.children[1].textContent;
      const remark = {
        P:  'Good attendance—keep it up!',
        A:  'Please ensure regular attendance.',
        Lt: 'Remember to arrive on time.',
        HD: 'Submit permission note for half‑day.',
        L:  'Attend when possible.'
      }[status] || '';
      return [
        `*Name:* ${name}`,
        `*Status:* ${status}`,
        `*Remarks:* ${remark}`,
        ''
      ].join('\n');
    }).join('\n');

    const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
    rows.forEach(tr => {
      const st = tr.children[1].textContent;
      stats[st] = (stats[st]||0) + 1;
    });
    const totalCount = rows.length;
    const avgPct = ((stats.P + stats.Lt + stats.HD) / totalCount) * 100;
    const avgRemark = avgPct >= THRESHOLD
      ? 'Overall attendance is good.'
      : 'Overall attendance needs improvement.';
    const footer = [
      `Class Average: ${avgPct.toFixed(1)}%`,
      `Remarks: ${avgRemark}`
    ].join('\n');

    const message = [header, blocks, footer].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Download Attendance PDF
  $('downloadAttendancePDF').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    let y = 20;
    const hdr = [
      `School: ${localStorage.getItem('schoolName')}`,
      `Class: ${localStorage.getItem('teacherClass')}`,
      `Section: ${localStorage.getItem('teacherSection')}`,
      `Date: ${$('dateInput').value}`
    ].join(' | ');
    doc.setFontSize(14);
    doc.text(hdr, 20, y);
    y += 20;
    doc.autoTable({
      html: $('attendanceSummaryTable'),
      startY: y,
      theme: 'grid',
      headStyles: { fillColor:[41,128,185], textColor:255, fontStyle:'bold' },
      styles: { fontSize:10, cellPadding:4 }
    });
    doc.save(`Attendance_Summary_${$('dateInput').value}.pdf`);
  };

  // ... analytics code unchanged ...
});
