// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- Universal PDF share helper ---
  async function sharePdf(blob, fileName, title) {
    if (
      navigator.canShare &&
      navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })
    ) {
      try {
        await navigator.share({ title, files: [new File([blob], fileName, { type: 'application/pdf' })] });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share failed', err);
      }
    }
  }

  // --- Debug console (eruda) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- IndexedDB helpers (idb-keyval) ---
  if (!window.idbKeyval) {
    console.error('idb-keyval not found');
    return;
  }
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // --- State & Defaults ---
  let students       = (await get('students'))        || [];
  let attendanceData = (await get('attendanceData'))  || {};
  let paymentsData   = (await get('paymentsData'))    || {};
  let lastAdmNo      = (await get('lastAdmissionNo')) || 0;
  let fineRates      = (await get('fineRates'))       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct = (await get('eligibilityPct'))  || 75;
  let analyticsFilterOptions = ['all'];
  let analyticsDownloadMode  = 'combined';
  let lastAnalyticsStats     = [];
  let lastAnalyticsRange     = { from: null, to: null };
  let lastAnalyticsShare     = '';

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- DOM Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- Setup Load & Save ---
  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([
      get('schoolName'),
      get('teacherClass'),
      get('teacherSection')
    ]);
    if (sc && cl && sec) {
      $('schoolNameInput').value      = sc;
      $('teacherClassSelect').value   = cl;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderStudents();
      updateCounters();
      resetViews();
    }
  }

  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc = $('schoolNameInput').value.trim();
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!sc || !cl || !sec) {
      alert('Complete setup');
      return;
    }
    await save('schoolName', sc);
    await save('teacherClass', cl);
    await save('teacherSection', sec);
    await loadSetup();
  };

  $('editSetup').onclick = e => {
    e.preventDefault();
    show($('setupForm'));
    hide($('setupDisplay'));
  };

  // --- Settings: Fines & Eligibility ---
  const formDiv      = $('financialForm');
  const saveSettings = $('saveSettings');
  const settingsCard = document.createElement('div');
  settingsCard.id    = 'settingsCard';
  settingsCard.className = 'card hidden';
  const editSettings = document.createElement('button');
  editSettings.id    = 'editSettings';
  editSettings.className = 'btn no-print hidden';
  editSettings.textContent = 'Edit Settings';
  formDiv.parentNode.appendChild(settingsCard);
  formDiv.parentNode.appendChild(editSettings);

  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  saveSettings.onclick = async () => {
    fineRates = {
      A : Number($('fineAbsent').value)   || 0,
      Lt: Number($('fineLate').value)     || 0,
      L : Number($('fineLeave').value)    || 0,
      HD: Number($('fineHalfDay').value)  || 0,
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;
    await save('fineRates', fineRates);
    await save('eligibilityPct', eligibilityPct);
    settingsCard.innerHTML = `
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility:</strong> ${eligibilityPct}%</p>
      </div>`;
    hide(formDiv);
    show(editSettings, settingsCard);
  };

  editSettings.onclick = () => {
    show(formDiv);
    hide(settingsCard, editSettings);
  };

  // --- Utility: Counters & Views ---
  function updateCounters() {
    const cl = $('teacherClassSelect').value;
    $('classCount').textContent  = students.filter(s => s.cls === cl).length;
    $('schoolCount').textContent = students.length;
  }

  function resetViews() {
    hide(
      $('attendanceBody'),
      $('saveAttendance'),
      $('resetAttendance'),
      $('analyticsContainer'),
      $('analyticsActions')
    );
    show($('loadRegister'));
  }

  // --- Student Registration & Management ---
  function renderStudents() {
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx = 0;

    students.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      idx++;
      const stats = { P:0, A:0, Lt:0, L:0, HD:0 };
      Object.entries(attendanceData).forEach(([d, r]) => {
        stats[r[s.adm] || 'A']++;
      });
      const totalFine = stats.A * fineRates.A
        + stats.Lt * fineRates.Lt
        + stats.L * fineRates.L
        + stats.HD * fineRates.HD;
      const paid = paymentsData[s.adm]?.paid || 0;
      const outstanding = totalFine - paid;
      const status = (stats.P / (stats.P + stats.A + stats.L + stats.Lt + stats.HD) * 100) >= eligibilityPct
        ? 'Eligible' : 'Debarred';

      const tr = document.createElement('tr');
      tr.dataset.index = i;
      tr.innerHTML = `
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td>
        <td>${s.name}</td>
        <td>${s.adm}</td>
        <td>${stats.P}</td>
        <td>${stats.A}</td>
        <td>${stats.Lt}</td>
        <td>${stats.L}</td>
        <td>${stats.HD}</td>
        <td>PKR ${outstanding}</td>
        <td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>`;
      tbody.appendChild(tr);
    });

    $('selectAllStudents').checked = false;
    document.querySelectorAll('.sel').forEach(cb => cb.onchange = toggleButtons);
    toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b => b.onclick = () => openPaymentModal(b.dataset.adm));
  }

  function toggleButtons() {
    const any = !!document.querySelector('.sel:checked');
    $('editSelected').disabled   = !any;
    $('deleteSelected').disabled = !any;
  }

  $('selectAllStudents').onclick = () => {
    const on = $('selectAllStudents').checked;
    document.querySelectorAll('.sel').forEach(cb => cb.checked = on);
    toggleButtons();
  };

  $('addStudent').onclick = async e => {
    e.preventDefault();
    const n = $('studentName').value.trim();
    const p = $('parentName').value.trim();
    const c = $('parentContact').value.trim();
    const o = $('parentOccupation').value.trim();
    const a = $('parentAddress').value.trim();
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!n || !p || !c || !o || !a) { alert('All fields required'); return; }
    if (!/^\d{7,15}$/.test(c)) { alert('Contact must be 7–15 digits'); return; }
    const adm = await genAdmNo();
    students.push({ name:n, parent:p, contact:c, occupation:o, address:a, cls:cl, sec, adm });
    await save('students', students);
    renderStudents();
    updateCounters();
    resetViews();
  };

  $('editSelected').onclick = () => {
    // Implement bulk edit UI if desired
  };

  $('deleteSelected').onclick = async () => {
    if (!confirm('Delete selected students?')) return;
    const toDel = [...document.querySelectorAll('.sel:checked')].map(cb => +cb.closest('tr').dataset.index);
    students = students.filter((_, i) => !toDel.includes(i));
    await save('students', students);
    renderStudents();
    updateCounters();
    resetViews();
  };

  // --- Attendance Register Section ---
  $('loadRegister').onclick = () => {
    const tbody = $('registerTable').querySelector('tbody');
    tbody.innerHTML = '';
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    students.filter(s => s.cls === cl && s.sec === sec).forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.adm}</td>
        <td>${s.name}</td>
        <td>
          <select data-adm="${s.adm}">
            <option value="P">P</option>
            <option value="A">A</option>
            <option value="Lt">Lt</option>
            <option value="L">L</option>
            <option value="HD">HD</option>
          </select>
        </td>`;
      tbody.appendChild(tr);
    });
    hide($('loadRegister'));
    show($('attendanceBody'), $('saveAttendance'), $('resetAttendance'));
  };

  $('saveAttendance').onclick = async () => {
    const date = $('attendanceDate').value;
    if (!date) { alert('Select date'); return; }
    attendanceData[date] = {};
    document.querySelectorAll('#registerTable select').forEach(sel => {
      attendanceData[date][sel.dataset.adm] = sel.value;
    });
    await save('attendanceData', attendanceData);
    alert('Attendance saved for ' + date);
    resetViews();
  };

  $('resetAttendance').onclick = () => {
    document.querySelectorAll('#registerTable select').forEach(sel => sel.value = 'A');
  };

  // --- Download & Share for Attendance Register ---
  $('downloadRegister').onclick = async () => {
    const doc = new jspdf.jsPDF({ orientation:'landscape', unit:'pt', format:'a4' });
    doc.setFontSize(18);
    doc.text('Attendance Register',14,16);
    doc.setFontSize(12);
    doc.text($('setupText').textContent,14,24);
    doc.autoTable({ startY:32, html:'#registerTable', tableWidth:'auto', styles:{ fontSize:10 } });
    const blob = doc.output('blob');
    doc.save('attendance_register.pdf');
    await sharePdf(blob,'attendance_register.pdf','Attendance Register');
  };

  $('shareRegister').onclick = () => {
    const header = `Attendance Register\n${$('setupText').textContent}`;
    const rows = Array.from(document.querySelectorAll('#registerTable tbody tr')).map(tr =>
      Array.from(tr.children).map(td =>
        td.querySelector('select') ? td.querySelector('select').value : td.textContent
      ).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows.join('\n'))}`, '_blank');
  };

  // --- Analytics Generation & Rendering ---
  $('generateAnalytics').onclick = () => {
    const from = $('analyticsFrom').value;
    const to   = $('analyticsTo').value;
    if (!from || !to) { alert('Select range'); return; }
    lastAnalyticsRange = { from, to };
    const dates = Object.keys(attendanceData).filter(d => d >= from && d <= to);
    lastAnalyticsStats = students.map(s => {
      const stats = { P:0, A:0, Lt:0, L:0, HD:0 };
      dates.forEach(d => {
        const r = attendanceData[d][s.adm] || 'A';
        stats[r]++;
      });
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = paymentsData[s.adm]?.paid || 0;
      const outstanding = totalFine - paid;
      const status = (stats.P/(stats.P+stats.A+stats.L+stats.Lt+stats.HD)*100) >= eligibilityPct ? 'Eligible' : 'Debarred';
      return { adm:s.adm, name:s.name, ...stats, outstanding, total:dates.length, status };
    });
    const tbody = $('analyticsTable').querySelector('tbody');
    tbody.innerHTML = '';
    lastAnalyticsShare = `Analytics (${from} to ${to}):\n`;
    lastAnalyticsStats.forEach(st => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${st.adm}</td>
        <td>${st.name}</td>
        <td>${st.P}</td>
        <td>${st.A}</td>
        <td>${st.Lt}</td>
        <td>${st.L}</td>
        <td>${st.HD}</td>
        <td>PKR ${st.outstanding}</td>
        <td>${st.status}</td>`;
      tbody.appendChild(tr);
      lastAnalyticsShare += `${st.adm}-${st.name}: P${st.P}, A${st.A}, O${st.outstanding}, ${st.status}\n`;
    });
    show($('analyticsContainer'), $('analyticsActions'));
  };

  // --- Download & Share for Analytics ---
  $('downloadAnalytics').onclick = async () => {
    const filtered = lastAnalyticsStats.filter(st =>
      analyticsFilterOptions.includes('all') || analyticsFilterOptions.some(opt => {
        switch(opt) {
          case 'registered': return st.total > 0;
          case 'attendance': return st.P > 0;
          case 'fine':       return st.outstanding > 0;
          case 'cleared':    return st.outstanding <= 0;
          case 'debarred':   return st.status === 'Debarred';
          case 'eligible':   return st.status === 'Eligible';
          default:           return true;
        }
      })
    );
    if (analyticsDownloadMode === 'combined') {
      const doc = new jspdf.jsPDF();
      doc.setFontSize(18);
      doc.text('Analytics Report',14,16);
      doc.setFontSize(12);
      doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`,14,24);
      doc.autoTable({ startY:32, html:'#analyticsTable' });
      const blob = doc.output('blob');
      doc.save('analytics_report.pdf');
      await sharePdf(blob,'analytics_report.pdf','Analytics Report');
    } else {
      for (const st of filtered) {
        const doc = new jspdf.jsPDF();
        doc.setFontSize(18);
        doc.text(`Analytics for ${st.name}`,14,16);
        doc.setFontSize(12);
        doc.text(`Adm#: ${st.adm}`,14,24);
        doc.text(`Present: ${st.P}`,14,32);
        doc.text(`Absent: ${st.A}`,14,40);
        doc.text(`Late: ${st.Lt}`,14,48);
        doc.text(`Leave: ${st.L}`,14,56);
        doc.text(`Half Days: ${st.HD}`,14,64);
        doc.text(`Outstanding: PKR ${st.outstanding}`,14,72);
        const fileName = `analytics_${st.adm}_${st.name}.pdf`;
        const blob = doc.output('blob');
        doc.save(fileName);
        await sharePdf(blob,fileName,`Analytics: ${st.name}`);
      }
    }
  };

  $('shareAnalytics').onclick = () => {
    if (!lastAnalyticsShare) { alert('Generate analytics first'); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`, '_blank');
  };

  // --- Service Worker Registration ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }

  // Initial load
  await loadSetup();
});


// service-worker.js
const CACHE_NAME = 'attendance-app-v1';
const urlsToCache = [
  '/', '/index.html', '/app.js', '/styles.css',
  'https://cdn.jsdelivr.net/npm/jspdf@latest/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/idb-keyval.iife.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
    ))
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(resp => resp || fetch(e.request)));
});
