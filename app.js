// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // ===== Helpers =====
  const $ = id => document.getElementById(id);
  const show = el => el && el.classList.remove('hidden');
  const hide = el => el && el.classList.add('hidden');

  // ===== IndexedDB via idb-keyval =====
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // ===== State =====
  let students       = await get('students')        || [];
  let attendanceData = await get('attendanceData')  || {};
  let paymentsData   = await get('paymentsData')    || {};
  let lastAdm        = await get('lastAdm')         || 0;
  let fineRates      = await get('fineRates')       || { absent:50, late:20, leave:10, halfDay:30 };
  let eligibilityPct = await get('eligibilityPct')  || 75;
  let schoolName     = await get('schoolName')      || '';
  let teacherClass   = await get('teacherClass')    || '';
  let teacherSection = await get('teacherSection')  || '';

  function genAdm() {
    lastAdm++; save('lastAdm', lastAdm);
    return String(lastAdm).padStart(4, '0');
  }

  // ===== 1. SETUP =====
  async function loadSetup() {
    schoolName     = await get('schoolName')      || '';
    teacherClass   = await get('teacherClass')    || '';
    teacherSection = await get('teacherSection')  || '';
    if (schoolName && teacherClass && teacherSection) {
      $('setupText').textContent = `${schoolName} | ${teacherClass} | ${teacherSection}`;
      hide($('setupForm')); show($('setupDisplay'));
      show($('financial-settings'));
      show($('counters'));
      show($('student-registration'));
      show($('attendance-section'));
      show($('register-section'));
      show($('analytics-section'));
      renderSettingsCard();
      renderCounters();
      renderStudents();
    } else {
      show($('setupForm')); hide($('setupDisplay'));
      hide($('financial-settings'),
           $('counters'),
           $('student-registration'),
           $('attendance-section'),
           $('register-section'),
           $('analytics-section'));
    }
  }

  $('saveSetup').onclick = async () => {
    const sc = $('schoolNameInput').value.trim();
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    if (!sc || !cl || !sec) return alert('Complete setup');
    await save('schoolName', sc);
    await save('teacherClass', cl);
    await save('teacherSection', sec);
    await loadSetup();
  };
  $('editSetup').onclick = () => {
    hide($('setupDisplay'));
    show($('setupForm'));
  };

  // ===== 2. FINANCIAL SETTINGS =====
  function renderSettingsCard() {
    $('fineAbsent').value     = fineRates.absent;
    $('fineLate').value       = fineRates.late;
    $('fineLeave').value      = fineRates.leave;
    $('fineHalfDay').value    = fineRates.halfDay;
    $('eligibilityPct').value = eligibilityPct;
    $('settingsCard').innerHTML = `
      <div>Fine Absent: PKR ${fineRates.absent}</div>
      <div>Fine Late: PKR ${fineRates.late}</div>
      <div>Fine Leave: PKR ${fineRates.leave}</div>
      <div>Fine Half-Day: PKR ${fineRates.halfDay}</div>
      <div>Eligibility %: ${eligibilityPct}%</div>
    `;
  }
  $('saveSettings').onclick = async () => {
    fineRates = {
      absent:  Number($('fineAbsent').value)   || 0,
      late:    Number($('fineLate').value)     || 0,
      leave:   Number($('fineLeave').value)    || 0,
      halfDay: Number($('fineHalfDay').value)  || 0
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;
    await save('fineRates', fineRates);
    await save('eligibilityPct', eligibilityPct);
    renderSettingsCard();
    hide($('financialForm'));
    show($('settingsCard'), $('editSettings'));
  };
  $('editSettings').onclick = () => {
    show($('financialForm'));
    hide($('settingsCard'), $('editSettings'));
  };

  // ===== 3. COUNTERS =====
  function renderCounters() {
    const secCount = students.filter(s => s.cls===teacherClass && s.sec===teacherSection).length;
    const clsCount = students.filter(s => s.cls===teacherClass).length;
    const schCount = students.length;
    $('sectionCount').textContent = secCount;
    $('classCount').textContent   = clsCount;
    $('schoolCount').textContent  = schCount;
  }

  // ===== 4. STUDENT REGISTRATION =====
  function renderStudents() {
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    students
      .filter(s => s.cls===teacherClass && s.sec===teacherSection)
      .forEach((s,i) => {
        const tr = document.createElement('tr');
        tr.dataset.idx = i;
        tr.innerHTML = `
          <td><input type="checkbox" class="sel"></td>
          <td>${i+1}</td>
          <td>${s.adm}</td>
          <td>${s.name}</td>
          <td>${s.parent}</td>
          <td>${s.contact}</td>
          <td>${s.occ}</td>
          <td>${s.addr}</td>
        `;
        tbody.appendChild(tr);
      });
    $('selectAllStudents').checked = false;
    $('editSelected').disabled = true;
    $('deleteSelected').disabled = true;
  }

  $('addStudentBtn').onclick = async () => {
    const name   = $('stuName').value.trim();
    if (!name) return alert('Name required');
    const s = {
      adm:     genAdm(),
      name,
      parent:  $('stuParent').value.trim(),
      contact: $('stuContact').value.trim(),
      occ:     $('stuOcc').value.trim(),
      addr:    $('stuAddr').value.trim(),
      cls:     teacherClass,
      sec:     teacherSection
    };
    students.push(s);
    await save('students', students);
    renderStudents();
    renderCounters();
    $('stuForm').reset();
  };

  $('studentsBody').addEventListener('change', e => {
    if (e.target.classList.contains('sel')) {
      const any = !!document.querySelector('.sel:checked');
      $('editSelected').disabled = !any;
      $('deleteSelected').disabled = !any;
    }
  });
  $('selectAllStudents').onclick = () => {
    const checked = $('selectAllStudents').checked;
    document.querySelectorAll('.sel').forEach(cb => cb.checked = checked);
    const any = checked;
    $('editSelected').disabled = !any;
    $('deleteSelected').disabled = !any;
  };
  $('deleteSelected').onclick = async () => {
    const toDel = Array.from(document.querySelectorAll('.sel:checked'))
      .map(cb => +cb.closest('tr').dataset.idx);
    students = students.filter((_,i) => !toDel.includes(i));
    await save('students', students);
    renderStudents();
    renderCounters();
  };

  // ===== 5. MARK ATTENDANCE =====
  $('loadAttendance').onclick = () => {
    const date = $('dateInput').value;
    if (!date) return alert('Pick date');
    const body = $('attendanceBody');
    body.innerHTML = `<table id="attendanceTable">
      <thead><tr><th>Adm#</th><th>Name</th><th>Status</th></tr></thead><tbody></tbody></table>`;
    const tbody = body.querySelector('tbody');
    students
      .filter(s => s.cls===teacherClass && s.sec===teacherSection)
      .forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${s.adm}</td>
          <td>${s.name}</td>
          <td>
            <select data-adm="${s.adm}" class="att">
              <option value="">--</option>
              <option value="P">P</option>
              <option value="A">A</option>
            </select>
          </td>
        `;
        tbody.appendChild(tr);
      });
    show($('saveAttendance'), $('resetAttendance'));
  };
  $('saveAttendance').onclick = async () => {
    const date = $('dateInput').value;
    document.querySelectorAll('.att').forEach(sel => {
      const adm = sel.dataset.adm, val = sel.value;
      attendanceData[date] = attendanceData[date] || {};
      attendanceData[date][adm] = val;
    });
    await save('attendanceData', attendanceData);
    alert('Attendance saved');
  };
  $('resetAttendance').onclick = () => {
    $('attendanceBody').innerHTML = '';
    hide($('saveAttendance'), $('resetAttendance'));
  };

  // ===== 6. ATTENDANCE REGISTER =====
  $('loadRegister').onclick = () => {
    const m = $('registerMonth').value;
    if (!m) return alert('Pick month');
    const [year, mo] = m.split('-');
    const days = new Date(year, mo, 0).getDate();
    const hdr = $('headerRow');
    hdr.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
      Array.from({ length: days }, (_,i) => `<th>${i+1}</th>`).join('');
    const body = $('bodyTbody');
    body.innerHTML = '';
    students
      .filter(s => s.cls===teacherClass && s.sec===teacherSection)
      .forEach((s, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>` +
          Array.from({ length: days }, (_,d) => {
            const key = `${m}-${String(d+1).padStart(2,'0')}`;
            return `<td>${(attendanceData[key]||{})[s.adm]||''}</td>`;
          }).join('');
        body.appendChild(tr);
      });
    show($('registerTableWrapper'), $('changeRegister'));
  };
  $('changeRegister').onclick = () => {
    hide($('registerTableWrapper'), $('changeRegister'));
    $('headerRow').innerHTML = '';
    $('bodyTbody').innerHTML = '';
    $('registerMonth').value = '';
  };

  // ===== 7. PAYMENTS =====
  document.body.addEventListener('click', e => {
    if (e.target.matches('.pay-btn')) {
      const adm = e.target.closest('tr').dataset.idx;
      $('payAdm').textContent = students[adm].adm;
      show($('paymentModal'));
    }
  });
  $('paymentModalClose').onclick = () => hide($('paymentModal'));
  $('cancelPayment').onclick      = () => hide($('paymentModal'));
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent;
    const amt = Number($('paymentAmount').value) || 0;
    paymentsData[adm] = paymentsData[adm] || [];
    paymentsData[adm].push({ date: new Date().toISOString().split('T')[0], amount: amt });
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    alert('Payment recorded');
  };

  // ===== 8. ANALYTICS (stubs) =====
  $('downloadAnalytics').onclick = () => alert('Download analytics (not implemented)');
  $('shareAnalytics').onclick    = () => alert('Share analytics (not implemented)');

  // ===== Init =====
  await loadSetup();
});
// ===== 9. REGISTRATION PDF & SHARE =====
  $('downloadRegistrationPDF').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Registered Students — ${schoolName} | ${teacherClass} | ${teacherSection}`, 14, 16);
    doc.autoTable({ html: '#studentsBody', startY: 24 });
    doc.save('registration.pdf');
  };

  $('shareRegistration').onclick = () => {
    const rows = Array.from(document.querySelectorAll('#studentsBody tr')).map(tr => {
      const cells = tr.querySelectorAll('td');
      return `${cells[1].textContent} ${cells[2].textContent}`;
    }).join('\n');
    const text = `Students List\n${schoolName} | ${teacherClass}-${teacherSection}\n\n${rows}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`);
  };

  // ===== 10. ATTENDANCE PDF & SHARE =====
  $('downloadAttendancePDF').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    doc.text(`Attendance — ${$('dateInput').value}`, 14, 16);
    doc.autoTable({ html: '#attendanceTable', startY: 24 });
    doc.save('attendance.pdf');
  };

  $('shareAttendanceSummary').onclick = () => {
    const date = $('dateInput').value;
    let text = `Attendance ${date}\n`;
    document.querySelectorAll('#attendanceTable tbody tr').forEach(tr => {
      const adm = tr.children[0].textContent;
      const name= tr.children[1].textContent;
      const st = tr.querySelector('select').value || '-';
      text += `${adm} ${name}: ${st}\n`;
    });
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`);
  };

  // ===== 11. REGISTER PDF & SHARE =====
  $('downloadRegister').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    doc.text(`Register — ${$('registerMonth').value}`, 14, 16);
    doc.autoTable({ html: '#registerTable', startY: 24 });
    doc.save('register.pdf');
  };

  $('shareRegister').onclick = () => {
    const month = $('registerMonth').value;
    let text = `Register ${month}\n`;
    const headers = Array.from(document.querySelectorAll('#headerRow th')).map(th => th.textContent);
    const rows = Array.from(document.querySelectorAll('#bodyTbody tr')).map(tr =>
      Array.from(tr.children).map(td => td.textContent).join(' ')
    );
    text += headers.join(' ') + '\n' + rows.join('\n');
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`);
  };

  // ===== 12. Analytics Download & Share =====
  $('downloadAnalytics').onclick = () => {
    alert('Analytics PDF export not yet implemented.');
  };
  $('shareAnalytics').onclick = () => {
    alert('Analytics sharing not yet implemented.');
  };

  // ===== 13. Initialize =====
  await loadSetup();
});
// ===== 14. SERVICE WORKER =====
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('service-worker.js')
      .catch(err => console.error('SW registration failed:', err));
  }

  // ===== END =====
});
