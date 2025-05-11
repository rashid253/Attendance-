// app.js — Multi-School Login / Setup / Backup-Restore + Full Original Logic

// 1) Credentials & Namespacing
const CRED_KEY = 'credentials';
const { get: _get, set: _set, entries, clear } = idbKeyval;
function namespacedKey(k) {
  const cred = JSON.parse(localStorage.getItem(CRED_KEY)) || {};
  return `${cred.school}::${cred.cls}::${cred.sec}::${k}`;
}
idbKeyval.get = k => _get(namespacedKey(k));
idbKeyval.set = (k, v) => _set(namespacedKey(k), v);

// 2) Show/Hide Helpers
const $ = id => document.getElementById(id);
const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

// 3) Login / Logout Flow
async function doLogin() {
  const school = $('loginSchool').value.trim();
  const cls    = $('loginClass').value;
  const sec    = $('loginSectionSelect').value;
  if (!school || !cls || !sec) {
    alert('Please complete School, Class, and Section.');
    return;
  }
  localStorage.setItem(CRED_KEY, JSON.stringify({ school, cls, sec }));
  await startApp();
}
$('loginBtn').onclick = doLogin;
$('logoutBtn').onclick = () => {
  localStorage.removeItem(CRED_KEY);
  location.reload();
};

// 4) Backup & Restore
$('backupBtn').onclick = async () => {
  const all = await entries();
  const blob = new Blob([JSON.stringify(Object.fromEntries(all), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `attendance-backup-${Date.now()}.json`;
  a.click();
};
$('restoreBtn').onclick = () => $('restoreFile').click();
$('restoreFile').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  const data = JSON.parse(await file.text());
  await clear();
  for (const [k, v] of Object.entries(data)) {
    await _set(k, v);
  }
  alert('Restore complete. Reloading…');
  location.reload();
};

// 5) Start App After Login
async function startApp() {
  hide($('loginSection'));
  show($('authActions'));

  const { school, cls, sec } = JSON.parse(localStorage.getItem(CRED_KEY));
  $('schoolNameInput').value      = school;
  $('teacherClassSelect').value   = cls;
  $('teacherSectionSelect').value = sec;
  $('setupText').textContent      = `${school} | ${cls} | Section ${sec}`;

  const saved = await idbKeyval.get('schoolName');
  if (saved) {
    hide($('setupForm')); show($('setupDisplay'));
  } else {
    show($('setupForm')); hide($('setupDisplay'));
  }

  show($('app'));
  await initOriginalApp();
}

// 6) Setup Save / Edit
$('saveSetup').onclick = async () => {
  const sc = $('schoolNameInput').value.trim();
  const cl = $('teacherClassSelect').value;
  const se = $('teacherSectionSelect').value;
  if (!sc || !cl || !se) {
    alert('Please complete setup fields');
    return;
  }
  await Promise.all([
    idbKeyval.set('schoolName', sc),
    idbKeyval.set('teacherClass', cl),
    idbKeyval.set('teacherSection', se)
  ]);
  $('setupText').textContent = `${sc} | ${cl} | Section ${se}`;
  hide($('setupForm')); show($('setupDisplay'));
};
$('editSetup').onclick = e => {
  e.preventDefault();
  show($('setupForm'));
  hide($('setupDisplay'));
};

// 7) Original App Logic
async function initOriginalApp() {
  // --- Universal PDF share helper (must come first) ---
  async function sharePdf(blob, fileName, title) {
    if (navigator.canShare && navigator.canShare({
      files: [ new File([blob], fileName, { type: 'application/pdf' }) ]
    })) {
      try {
        await navigator.share({
          title,
          files: [ new File([blob], fileName, { type: 'application/pdf' }) ]
        });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share failed', err);
      }
    }
  }

  // --- 0. Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- 1. IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) { console.error('idb-keyval not found'); return; }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // --- 2. State & Defaults ---
  let students       = await get('students')        || [];
  let attendanceData = await get('attendanceData')  || {};
  let paymentsData   = await get('paymentsData')    || {};
  let lastAdmNo      = await get('lastAdmissionNo') || 0;
  let fineRates      = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct = await get('eligibilityPct')  || 75;
  let analyticsFilterOptions = ['all'], analyticsDownloadMode = 'combined';
  let lastAnalyticsStats = [], lastAnalyticsRange = { from:null, to:null }, lastAnalyticsShare = '';

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 3. DOM Helpers ---
  const $  = id => document.getElementById(id);
  const show_ = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide_ = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- 4. Registration PDF & WhatsApp share handlers ---
  $('downloadRegistrationPDF').onclick = async () => {
    const doc = new jspdf.jsPDF();
    const w   = doc.internal.pageSize.getWidth();
    const today = new Date().toISOString().split('T')[0];
    doc.setFontSize(18);
    doc.text('Registered Students', 14, 16);
    doc.setFontSize(10);
    doc.text(`Date: ${today}`, w - 14, 16, { align: 'right' });
    doc.setFontSize(12);
    doc.text($('setupText').textContent, 14, 24);
    doc.autoTable({ startY: 30, html: '#studentsTable' });
    const blob = doc.output('blob');
    doc.save('registration.pdf');
    await sharePdf(blob, 'registration.pdf', 'Registered Students');
  };
  $('shareRegistration').onclick = () => {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    const header = `*Students List*\nClass ${cl} Section ${sec}`;
    const lines = students
      .filter(s => s.cls === cl && s.sec === sec)
      .map(s => {
        const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
        Object.values(attendanceData).forEach(rec => {
          if (rec[s.adm]) stats[rec[s.adm]]++;
        });
        const total = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
        const fine  = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
        const paid  = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
        const out   = fine - paid;
        const pct   = total ? (stats.P/total)*100 : 0;
        const status = (out>0||pct<eligibilityPct)? 'Debarred' : 'Eligible';
        return `*${s.name}*\nAdm#: ${s.adm}\nOutstanding: PKR ${out}\nStatus: ${status}`;
      }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines)}`, '_blank');
  };

  // --- 5. Financial Settings ---
  (async () => {
    const fr = await get('fineRates');
    if (fr) {
      fineRates = fr;
      $('fineAbsent').value  = fr.A;
      $('fineLate').value    = fr.Lt;
      $('fineLeave').value   = fr.L;
      $('fineHalfDay').value = fr.HD;
    }
    const ep = await get('eligibilityPct');
    if (ep) $('eligibilityPct').value = ep;
  })();
  $('saveSettings').onclick = async () => {
    fineRates = {
      A: Number($('fineAbsent').value),
      Lt: Number($('fineLate').value),
      L:  Number($('fineLeave').value),
      HD: Number($('fineHalfDay').value)
    };
    eligibilityPct = Number($('eligibilityPct').value);
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);
    alert('Settings saved');
  };

  // --- 6. Animated Counters ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0, step = Math.max(1, target/100);
      (function upd() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(upd);
      })();
    });
  }
  function updateCounters() {
    const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s=>s.cls===cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  $('teacherClassSelect').onchange = updateCounters;
  $('teacherSectionSelect').onchange = updateCounters;
  updateCounters();

  // --- 7. Student Registration, Edit/Delete, Payment Modal, etc. ---
  (async () => {
    // Admission number generation & initial rendering
    const selAll = $('selectAllStudents');
    function renderStudents() {
      const tbody = $('studentsBody');
      tbody.innerHTML = '';
      let idx = 0;
      students.forEach((s,i) => {
        if (s.cls !== $('teacherClassSelect').value || s.sec !== $('teacherSectionSelect').value) return;
        idx++;
        const stats = { P:0,A:0,Lt:0,HD:0,L:0 };
        Object.values(attendanceData).forEach(rec => rec[s.adm] && stats[rec[s.adm]]++);
        const total = stats.P+stats.A+stats.Lt+stats.HD+stats.L;
        const fine  = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
        const paid  = (paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
        const out   = fine - paid;
        const pct   = total ? (stats.P/total)*100 : 0;
        const status = (out>0||pct<eligibilityPct) ? 'Debarred' : 'Eligible';

        const tr = document.createElement('tr');
        tr.dataset.index = i;
        tr.innerHTML = `
          <td><input type="checkbox" class="sel"></td>
          <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
          <td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
          <td>PKR ${out}</td><td>${status}</td>
          <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
        `;
        tbody.appendChild(tr);
      });
      selAll.checked = false;
      toggleButtons();
      document.querySelectorAll('.add-payment-btn').forEach(b => b.onclick = () => openPaymentModal(b.dataset.adm));
    }
    function toggleButtons() {
      const any = !!document.querySelector('.sel:checked');
      $('editSelected').disabled = !any;
      $('deleteSelected').disabled = !any;
    }
    $('studentsBody').addEventListener('change', e => {
      if (e.target.classList.contains('sel')) toggleButtons();
    });
    selAll.onclick = () => {
      document.querySelectorAll('.sel').forEach(c => c.checked = selAll.checked);
      toggleButtons();
    };

    $('addStudent').onclick = async () => {
      const n = $('studentName').value.trim(),
            p = $('parentName').value.trim(),
            c = $('parentContact').value.trim(),
            o = $('parentOccupation').value.trim(),
            a = $('parentAddress').value.trim(),
            cl= $('teacherClassSelect').value,
            se= $('teacherSectionSelect').value;
      if (!n||!p||!c||!o||!a) { alert('All fields required'); return; }
      if (!/^\d{7,15}$/.test(c)) { alert('Contact 7–15 digits'); return; }
      const adm = await genAdmNo();
      students.push({ name:n, adm, parent:p, contact:c, occupation:o, address:a, cls:cl, sec:se });
      await save('students', students);
      renderStudents(); updateCounters(); resetViews();
      ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
    };

    $('editSelected').onclick = () => {
      document.querySelectorAll('.sel:checked').forEach(cb => {
        const tr = cb.closest('tr'), i = +tr.dataset.index, s = students[i];
        tr.innerHTML = `
          <td><input type="checkbox" class="sel" checked></td>
          <td>${tr.children[1].textContent}</td>
          <td><input value="${s.name}"></td><td>${s.adm}</td>
          <td><input value="${s.parent}"></td><td><input value="${s.contact}"></td>
          <td><input value="${s.occupation}"></td><td><input value="${s.address}"></td>
          <td colspan="3"></td>
        `;
      });
      hide_($('editSelected')); show_($('doneEditing'));
    };
    $('doneEditing').onclick = async () => {
      document.querySelectorAll('#studentsBody tr').forEach(tr => {
        const inps = [...tr.querySelectorAll('input:not(.sel)')];
        if (inps.length === 5) {
          const [n,p,c,o,a] = inps.map(i => i.value.trim());
          const adm = tr.children[3].textContent;
          const idx = students.findIndex(x => x.adm === adm);
          if (idx > -1) students[idx] = { ...students[idx], name:n, parent:p, contact:c, occupation:o, address:a };
        }
      });
      await save('students', students);
      hide_($('doneEditing')); show_($('editSelected'), $('deleteSelected'), $('saveRegistration'));
      renderStudents(); updateCounters();
    };
    $('deleteSelected').onclick = async () => {
      if (!confirm('Delete?')) return;
      const toDel = [...document.querySelectorAll('.sel:checked')].map(cb => +cb.closest('tr').dataset.index);
      students = students.filter((_,i) => !toDel.includes(i));
      await save('students', students); renderStudents(); updateCounters(); resetViews();
    };
    $('saveRegistration').onclick = async () => {
      if (!$('doneEditing').classList.contains('hidden')) { alert('Finish editing'); return; }
      await save('students', students);
      hide_(
        document.querySelector('#student-registration .row-inline'),
        $('editSelected'), $('deleteSelected'), $('selectAllStudents'), $('saveRegistration')
      );
      show_($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
      renderStudents(); updateCounters();
    };
    $('editRegistration').onclick = () => {
      show_(
        document.querySelector('#student-registration .row-inline'),
        $('selectAllStudents'), $('editSelected'), $('deleteSelected'), $('saveRegistration')
      );
      hide_($('editRegistration'), $('shareRegistration'), $('downloadRegistrationPDF'));
      renderStudents(); updateCounters();
    };

    // --- 8. PAYMENT MODAL ---
    function openPaymentModal(adm){
      $('payAdm').textContent = adm;
      $('paymentAmount').value = '';
      show_($('paymentModal'));
    }
    $('paymentModalClose').onclick = () => hide_($('paymentModal'));
    $('savePayment').onclick = async () => {
      const adm = $('payAdm').textContent, amt = Number($('paymentAmount').value) || 0;
      paymentsData[adm] = paymentsData[adm]||[];
      paymentsData[adm].push({ date:new Date().toISOString().split('T')[0], amount:amt });
      await save('paymentsData', paymentsData); hide_($('paymentModal')); renderStudents();
    };
    $('cancelPayment').onclick = () => hide_($('paymentModal'));

    // --- 9. MARK ATTENDANCE ---
    const dateInput             = $('dateInput');
    const loadAttendanceBtn     = $('loadAttendance');
    const saveAttendanceBtn     = $('saveAttendance');
    const resetAttendanceBtn    = $('resetAttendance');
    const downloadAttendanceBtn = $('downloadAttendancePDF');
    const shareAttendanceBtn    = $('shareAttendanceSummary');
    const attendanceBodyDiv     = $('attendanceBody');
    const attendanceSummaryDiv  = $('attendanceSummary');
    const statusNames           = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' };
    const statusColors          = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'#FF9800', L:'var(--info)' };

    loadAttendanceBtn.onclick = () => {
      attendanceBodyDiv.innerHTML = '';
      attendanceSummaryDiv.innerHTML = '';
      const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
      attendanceBodyDiv.style.overflowX = 'auto';

      students.filter(s => s.cls===cl&&s.sec===sec).forEach((stu,i) => {
        const row = document.createElement('div');
        row.className = 'attendance-row';
        const headerDiv = document.createElement('div');
        headerDiv.className = 'attendance-header';
        headerDiv.textContent = `${i+1}. ${stu.name} (${stu.adm})`;
        const btnsDiv = document.createElement('div');
        btnsDiv.className = 'attendance-buttons';
        Object.keys(statusNames).forEach(code => {
          const btn = document.createElement('button');
          btn.className = 'att-btn'; btn.textContent = code;
          btn.onclick = () => {
            btnsDiv.querySelectorAll('.att-btn').forEach(b => { b.classList.remove('selected'); b.style=''; });
            btn.classList.add('selected');
            btn.style.background = statusColors[code];
            btn.style.color = '#fff';
          };
          btnsDiv.appendChild(btn);
        });
        row.append(headerDiv, btnsDiv);
        attendanceBodyDiv.appendChild(row);
      });
      show_(attendanceBodyDiv, saveAttendanceBtn);
      hide_(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
    };

    saveAttendanceBtn.onclick = async () => {
      const date = dateInput.value;
      if (!date) { alert('Pick date'); return; }
      attendanceData[date] = {};
      const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
      students.filter(s=>s.cls===cl&&s.sec===sec).forEach((s,i) => {
        const selBtn = attendanceBodyDiv.children[i].querySelector('.att-btn.selected');
        attendanceData[date][s.adm] = selBtn ? selBtn.textContent : 'A';
      });
      await save('attendanceData', attendanceData);

      attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
      const tbl = document.createElement('table');
      tbl.id = 'attendanceSummaryTable';
      tbl.innerHTML = `<tr><th>Sr#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th></tr>`;
      students.filter(s=>s.cls===cl&&s.sec===sec).forEach((s,i) => {
        tbl.innerHTML += `
          <tr>
            <td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>
            <td>${statusNames[attendanceData[date][s.adm]]}</td>
            <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
          </tr>`;
      });
      attendanceSummaryDiv.appendChild(tbl);
      attendanceSummaryDiv.querySelectorAll('.share-individual').forEach(ic => {
        ic.onclick = () => {
          const adm = ic.dataset.adm;
          const st  = students.find(x=>x.adm===adm);
          const msg = `Dear Parent, your child (Adm#: ${adm}) was ${statusNames[attendanceData[date][adm]]} on ${date}.`;
          window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`, '_blank');
        };
      });
      hide_(attendanceBodyDiv, saveAttendanceBtn);
      show_(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
    };

    resetAttendanceBtn.onclick = () => {
      show_(attendanceBodyDiv, saveAttendanceBtn);
      hide_(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
    };

    downloadAttendanceBtn.onclick = async () => {
      const doc = new jspdf.jsPDF();
      const w   = doc.internal.pageSize.getWidth();
      const today = new Date().toISOString().split('T')[0];
      doc.setFontSize(18); doc.text('Attendance Report', 14, 16);
      doc.setFontSize(10); doc.text(`Date: ${today}`, w - 14, 16, { align: 'right' });
      doc.setFontSize(12); doc.text($('setupText').textContent, 14, 24);
      doc.autoTable({ startY: 30, html: '#attendanceSummaryTable' });
      const fileName = `attendance_${dateInput.value}.pdf`;
      const blob     = doc.output('blob');
      doc.save(fileName);
      await sharePdf(blob, fileName, 'Attendance Report');
    };

    shareAttendanceBtn.onclick = () => {
      const cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value, date = dateInput.value;
      const header = `*Attendance Report*\nClass ${cl} Sec ${sec} - ${date}`;
      const lines  = students.filter(s=>s.cls===cl&&s.sec===sec)
        .map((s,i)=>`${i+1}. ${s.name} (Adm#: ${s.adm}): ${statusNames[attendanceData[date][s.adm]]}`);
      window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n\n' + lines.join('\n'))}`, '_blank');
    };

    // --- 11. ATTENDANCE REGISTER ---
  (function(){
    const loadBtn    = $('loadRegister'),
          saveBtn    = $('saveRegister'),
          changeBtn  = $('changeRegister'),
          downloadBtn= $('downloadRegister'),
          shareBtn   = $('shareRegister'),
          tableWrap  = $('registerTableWrapper'),
          headerRow  = $('registerHeader'),
          bodyTbody  = $('registerBody');

    function bindRegisterActions(){
      downloadBtn.onclick = async () => {
        const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
        const pw  = doc.internal.pageSize.getWidth(),
              today = new Date().toISOString().split('T')[0];
        doc.setFontSize(18); doc.text('Attendance Register',14,20);
        doc.setFontSize(10); doc.text(`Date: ${today}`, pw-14,20,{align:'right'});
        doc.setFontSize(12); doc.text($('setupText').textContent,14,36);
        doc.autoTable({
          startY: 60,
          html: '#registerTable',
          tableWidth:'auto', styles:{ fontSize:10 }
        });
        const blob = doc.output('blob');
        doc.save('attendance_register.pdf');
        await sharePdf(blob, 'attendance_register.pdf', 'Attendance Register');
      };
      shareBtn.onclick = () => {
        const header = `Attendance Register\n${$('setupText').textContent}`;
        const rows   = Array.from(bodyTbody.children).map(tr =>
          Array.from(tr.children).map(td =>
            td.querySelector('.status-text')?.textContent || td.textContent
          ).join(' ')
        );
        window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows.join('\n'))}`, '_blank');
      };
    }

    loadBtn.onclick = () => {
      const m = $('registerMonth').value;
      if (!m) { alert('Pick month'); return; }
      const dateKeys = Object.keys(attendanceData)
        .filter(d=>d.startsWith(m+'-')).sort();
      if (!dateKeys.length) { alert('No attendance marked this month.'); return; }

      headerRow.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>` +
        dateKeys.map(k=>`<th>${k.split('-')[2]}</th>`).join('');
      bodyTbody.innerHTML = '';

      const cls = $('teacherClassSelect').value,
            sec = $('teacherSectionSelect').value;
      students.filter(s=>s.cls===cls&&s.sec===sec).forEach((s,i) => {
        let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
        dateKeys.forEach(key => {
          const c = attendanceData[key][s.adm]||'';
          const color = c==='P'?'var(--success)':
                        c==='Lt'?'var(--warning)':
                        c==='HD'?'#FF9800':
                        c==='L'?'var(--info)':'var(--danger)';
          const style = c ? `style="background:${color};color:#fff"` : '';
          row += `<td class="reg-cell" ${style}><span class="status-text">${c}</span></td>`;
        });
        const tr = document.createElement('tr');
        tr.innerHTML = row;
        bodyTbody.appendChild(tr);
      });

      document.querySelectorAll('.reg-cell').forEach(cell => {
        cell.onclick = () => {
          const span = cell.querySelector('.status-text');
          const codes = ['', 'P', 'Lt', 'HD', 'L', 'A'];
          const idx = (codes.indexOf(span.textContent) + 1) % codes.length;
          const c = codes[idx];
          span.textContent = c;
          if (!c) {
            cell.style.background = ''; cell.style.color = '';
          } else {
            const col = c==='P'?'var(--success)':
                        c==='Lt'?'var(--warning)':
                        c==='HD'?'#FF9800':
                        c==='L'?'var(--info)':'var(--danger)';
            cell.style.background = col; cell.style.color = '#fff';
          }
        };
      });

      show(tableWrap, changeBtn, saveBtn, downloadBtn, shareBtn);
    };

    changeBtn.onclick = () => {
      hide(saveBtn, downloadBtn, shareBtn);
      show(loadBtn);
    };

    saveBtn.onclick = async () => {
      const m = $('registerMonth').value;
      const dateKeys = Object.keys(attendanceData)
        .filter(d=>d.startsWith(m+'-')).sort();
      dateKeys.forEach((key,di) => {
        const cls = $('teacherClassSelect').value,
              sec = $('teacherSectionSelect').value,
              rows = bodyTbody.children;
        attendanceData[key] = {};
        Array.from(rows).forEach((tr,ri) => {
          const st = students.filter(s=>s.cls===cls&&s.sec===sec)[ri];
          const c = tr.querySelector('.status-text').textContent || 'A';
          attendanceData[key][st.adm] = c;
        });
      });
      await save('attendanceData', attendanceData);
      alert('Register saved');
    };

    bindRegisterActions();
  })();
    // --- Final: Service Worker Registration ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }

} // end of initOriginalApp()

// 8) Bootstrap on page load
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem(CRED_KEY)) {
    startApp();
  } else {
    hide($('app'), $('authActions'));
    show($('loginSection'));
  }
});
