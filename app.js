// app.js (Top Half: Initialization, Setup & Registration with Multiple Schools)

window.addEventListener('DOMContentLoaded', async () => {
  // --- Universal PDF share helper (must come first) ---
  async function sharePdf(blob, fileName, title) {
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })) {
      try {
        await navigator.share({ title, files: [new File([blob], fileName, { type: 'application/pdf' })] });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share failed', err);
      }
    }
  }

  // --- IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) { console.error('idb-keyval not found'); return; }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // --- State & Defaults (now including schools) ---
  let schools         = await get('schools')        || [];
  let students        = await get('students')       || [];
  let attendanceData  = await get('attendanceData') || {};
  let paymentsData    = await get('paymentsData')   || {};
  let lastAdmNo       = await get('lastAdmissionNo')|| 0;
  let fineRates       = await get('fineRates')      || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct  = await get('eligibilityPct') || 75;
  let lastAnalyticsStats = [], lastAnalyticsRange = { from: null, to: null }, lastAnalyticsShare = '';

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- 1. SETUP: Manage Multiple Schools, Classes & Sections ---
  async function loadSetup() {
    const [schList, curSchool, curClass, curSection] = await Promise.all([
      get('schools'), get('currentSchool'), get('teacherClass'), get('teacherSection')
    ]);

    // Populate school dropdown
    schools = schList || [];
    $('schoolSelect').innerHTML = schools.map(s => `<option>${s}</option>`).join('');
    if (curSchool) $('schoolSelect').value = curSchool;

    if (curSchool && curClass && curSection) {
      $('teacherClassSelect').value   = curClass;
      $('teacherSectionSelect').value = curSection;
      $('setupText').textContent      = `${curSchool} 🏫 | Class: ${curClass} | Section: ${curSection}`;
      hide($('setupForm')); show($('setupDisplay'));
      renderStudents(); updateCounters(); resetViews();
    }
  }

  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const newSchool = $('schoolInput').value.trim();
    if (newSchool) {
      if (!schools.includes(newSchool)) {
        schools.push(newSchool);
        await save('schools', schools);
      }
      $('schoolInput').value = '';
      return loadSetup();
    }
    const selSchool = $('schoolSelect').value,
          selClass  = $('teacherClassSelect').value,
          selSection= $('teacherSectionSelect').value;
    if (!selSchool || !selClass || !selSection) { alert('Complete setup'); return; }
    await Promise.all([
      save('currentSchool', selSchool),
      save('teacherClass', selClass),
      save('teacherSection', selSection)
    ]);
    await loadSetup();
  };

  $('editSetup').onclick = () => {
    show($('setupForm')); hide($('setupDisplay'));
  };

  await loadSetup();

  // --- 2. Counters & Utilities (filtering by school) ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target / 100);
      (function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
      })();
    });
  }

  function updateCounters() {
    const sc = $('schoolSelect').value,
          cl = $('teacherClassSelect').value,
          sec= $('teacherSectionSelect').value;
    const bySchool = students.filter(s => s.school === sc);
    $('schoolCount').dataset.target  = bySchool.length;
    $('classCount').dataset.target   = bySchool.filter(s => s.cls === cl).length;
    $('sectionCount').dataset.target = bySchool.filter(s => s.cls === cl && s.sec === sec).length;
    animateCounters();
  }

  function resetViews() {
    // hide all views except loadRegister
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'),
      $('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'),
      $('registerTableWrapper'), $('changeRegister'),
      $('saveRegister'), $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }

  ['schoolSelect','teacherClassSelect','teacherSectionSelect'].forEach(id => {
    $(id).onchange = () => { renderStudents(); updateCounters(); resetViews(); };
  });

  // --- 3. Student Registration & Listing (attach & filter by school) ---
  function renderStudents() {
    const sc = $('schoolSelect').value,
          cl = $('teacherClassSelect').value,
          sec= $('teacherSectionSelect').value,
          tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx = 0;
    students.forEach((s,i) => {
      if (s.school !== sc || s.cls !== cl || s.sec !== sec) return;
      idx++;
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(rec => {
        if (rec[s.adm]) stats[rec[s.adm]]++;
      });
      const total = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const fine  = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid  = (paymentsData[s.adm] || []).reduce((acc,p) => acc + p.amount, 0);
      const out   = fine - paid;
      const pct   = total ? (stats.P / total) * 100 : 0;
      const status= (out>0 || pct<eligibilityPct) ? 'Debarred' : 'Eligible';

      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td>
        <td>${s.name}</td>
        <td>${s.adm}</td>
        <td>${s.parent}</td>
        <td>${s.contact}</td>
        <td>${s.occupation}</td>
        <td>${s.address}</td>
        <td>PKR ${out}</td>
        <td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked = false;
    document.querySelectorAll('.add-payment-btn').forEach(b => b.onclick = () => openPaymentModal(b.dataset.adm));
  }

  $('addStudent').onclick = async e => {
    e.preventDefault();
    const name    = $('studentName').value.trim(),
          parent  = $('parentName').value.trim(),
          contact = $('parentContact').value.trim(),
          occ     = $('parentOccupation').value.trim(),
          addr    = $('parentAddress').value.trim(),
          sc      = $('schoolSelect').value,
          cl      = $('teacherClassSelect').value,
          sec     = $('teacherSectionSelect').value;
    if (!name||!parent||!contact||!occ||!addr) { alert('All fields required'); return; }
    if (!/^\d{7,15}$/.test(contact)) { alert('Contact must be 7–15 digits'); return; }
    const adm = await genAdmNo();
    students.push({ name, adm, parent, contact, occupation: occ, address: addr, school: sc, cls: cl, sec });
    await save('students', students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id => $(id).value = '');
  };
  // app.js (Bottom Half: Payments, Attendance, Analytics, Register & Service Worker)

// --- 4. Payment Modal & Data Persistence ---
function closePaymentModal() {
  hide($('paymentModal'));
  $('paymentAmount').value = '';
}

$('closePayment').onclick = closePaymentModal;

$('savePayment').onclick = async () => {
  const adm  = $('paymentAdm').value;
  const amt  = +$('paymentAmount').value;
  if (!amt || amt < 0) { alert('Enter a valid amount'); return; }
  const date = new Date().toLocaleDateString();
  paymentsData[adm] = paymentsData[adm] || [];
  paymentsData[adm].push({ amount: amt, date });
  await save('paymentsData', paymentsData);
  closePaymentModal();
  renderStudents();
  updateCounters();
};

// --- 5. Attendance Handlers ---
$('loadAttendance').onclick = () => {
  const sc = $('schoolSelect').value,
        cl = $('teacherClassSelect').value,
        sec= $('teacherSectionSelect').value;
  const tbody = $('attendanceBody');
  tbody.innerHTML = '';
  const today = new Date().toISOString().slice(0,10);
  students
    .filter(s => s.school===sc && s.cls===cl && s.sec===sec)
    .forEach((stu, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${stu.name}</td>
        ${['P','A','Lt','HD','L'].map(k =>
          `<td>
             <input type="radio" name="${stu.adm}" value="${k}"
               ${attendanceData[today] && attendanceData[today][stu.adm]===k?'checked':''}>
           </td>`
        ).join('')}
      `;
      tbody.appendChild(tr);
    });
  show($('attendanceSection'));
};

$('saveAttendance').onclick = async () => {
  const today = new Date().toISOString().slice(0,10);
  attendanceData[today] = {};
  document.querySelectorAll('#attendanceBody input[type=radio]').forEach(r => {
    if (r.checked) attendanceData[today][r.name] = r.value;
  });
  await save('attendanceData', attendanceData);
  alert('Attendance saved for ' + today);
};

$('resetAttendance').onclick = () => {
  const today = new Date().toISOString().slice(0,10);
  delete attendanceData[today];
  Array.from(document.querySelectorAll('#attendanceBody input[type=radio]')).forEach(r => r.checked = false);
};

// --- 6. Attendance Summary PDF & Share ---
$('attendanceSummaryBtn').onclick = () => {
  const from = $('attFrom').value, to = $('attTo').value;
  if (!from || !to || from > to) { alert('Select valid date range'); return; }
  const sc = $('schoolSelect').value,
        cl = $('teacherClassSelect').value,
        sec= $('teacherSectionSelect').value;
  const pool = students.filter(s => s.school===sc && s.cls===cl && s.sec===sec);
  const dates = Object.keys(attendanceData).filter(d => d>=from && d<=to).sort();
  let html = `<h3>Attendance Summary (${from} to ${to})</h3><table border="1"><tr>
                <th>#</th><th>Name</th><th>Adm</th>${dates.map(d=>`<th>${d}</th>`).join('')}
              </tr>`;
  pool.forEach((s,i) => {
    html += `<tr><td>${i+1}</td><td>${s.name}</td><td>${s.adm}</td>`;
    dates.forEach(d => {
      const mark = attendanceData[d][s.adm] || '';
      html += `<td>${mark}</td>`;
    });
    html += `</tr>`;
  });
  html += `</table>`;
  $('attendanceSummary').innerHTML = html;
  show($('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'));
};

$('downloadAttendancePDF').onclick = () => {
  html2pdf().from($('attendanceSummary')).save(`Attendance_${$('attFrom').value}_${$('attTo').value}.pdf`);
};

$('shareAttendanceSummary').onclick = () => {
  html2pdf().from($('attendanceSummary')).outputPdf('blob')
    .then(blob => sharePdf(blob, `Attendance_${$('attFrom').value}_${$('attTo').value}.pdf`, 'Attendance Summary'));
};

// --- 7. Analytics: Load, Download & Share ---
$('loadAnalytics').onclick = () => {
  const sc = $('schoolSelect').value,
        cl = $('teacherClassSelect').value,
        sec= $('teacherSectionSelect').value;
  const from = $('anaFrom').value, to = $('anaTo').value;
  if (!from||!to||from>to) { alert('Select valid date range'); return; }
  const pool = students.filter(s => s.school===sc && s.cls===cl && s.sec===sec);
  const dates = Object.keys(attendanceData).filter(d=>d>=from&&d<=to).sort();
  let html = `<h3>Analytics (${from} to ${to})</h3><table border="1"><tr>
                <th>#</th><th>Name</th><th>Adm</th>
                <th>Present%</th><th>Absent</th><th>Late</th><th>Half-Day</th><th>Leave</th>
              </tr>`;
  pool.forEach((s,i) => {
    let stats = {P:0,A:0,Lt:0,HD:0,L:0}, total=0;
    dates.forEach(d => {
      const m = attendanceData[d][s.adm];
      if (m) { stats[m]++; total++; }
    });
    const pct = total ? ((stats.P/total)*100).toFixed(1) : '0.0';
    html += `<tr>
        <td>${i+1}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${pct}%</td><td>${stats.A}</td><td>${stats.Lt}</td>
        <td>${stats.HD}</td><td>${stats.L}</td>
      </tr>`;
  });
  html += `</table>`;
  $('analyticsTable').innerHTML = html;
  show($('downloadAnalytics'), $('shareAnalytics'));
};

$('downloadAnalytics').onclick = () => {
  html2pdf().from($('analyticsTable')).save(`Analytics_${$('anaFrom').value}_${$('anaTo').value}.pdf`);
};

$('shareAnalytics').onclick = () => {
  html2pdf().from($('analyticsTable')).outputPdf('blob')
    .then(blob => sharePdf(blob, `Analytics_${$('anaFrom').value}_${$('anaTo').value}.pdf`, 'Attendance Analytics'));
};

// --- 8. Register View: Load, Download & Share ---
$('loadRegister').onclick = () => {
  const sc = $('schoolSelect').value,
        cl = $('teacherClassSelect').value,
        sec= $('teacherSectionSelect').value;
  const tbody = $('registerTable');
  tbody.innerHTML = '';
  students
    .filter(s => s.school===sc && s.cls===cl && s.sec===sec)
    .forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.name}</td><td>${s.adm}</td>`;
      tbody.appendChild(tr);
    });
  show($('downloadRegister'), $('shareRegister'));
};

$('downloadRegister').onclick = () => {
  html2pdf().from($('registerTable')).save(`Register_${$('schoolSelect').value}_${$('teacherClassSelect').value}_${$('teacherSectionSelect').value}.pdf`);
};

$('shareRegister').onclick = () => {
  html2pdf().from($('registerTable')).outputPdf('blob')
    .then(blob => sharePdf(blob, `Register_${$('schoolSelect').value}.pdf`, 'Student Register'));
};

// --- 9. Service Worker Registration ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(console.error);
}
