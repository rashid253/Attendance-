// app.js — Multi-School / Auth / Backup & Full Original Logic

// 1) Credentials & Namespacing
const CRED_KEY = 'credentials';
const { get: _get, set: _set, entries, clear } = idbKeyval;

function namespacedKey(key) {
  const cred = JSON.parse(localStorage.getItem(CRED_KEY)) || {};
  return `${cred.school}::${cred.cls}::${cred.sec}::${key}`;
}

// Override idbKeyval to use namespaced keys
idbKeyval.get = k => _get(namespacedKey(k));
idbKeyval.set = (k, v) => _set(namespacedKey(k), v);

// 2) Show / Hide Helpers
const $ = id => document.getElementById(id);
const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

// 3) LOGIN / LOGOUT Flow
async function doLogin() {
  const school = $('loginSchool').value.trim();
  const cls    = $('loginClass').value;
  const sec    = $('loginSectionSelect').value;
  if (!school || !cls || !sec) {
    alert('Please complete School, Class and Section.');
    return;
  }
  localStorage.setItem(CRED_KEY, JSON.stringify({ school, cls, sec }));
  startApp();
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
  const text = await file.text();
  const data = JSON.parse(text);
  await clear();
  for (const [k, v] of Object.entries(data)) {
    await _set(k, v);
  }
  alert('Restore complete. Reloading…');
  location.reload();
};

// 5) Start the App After Login
function startApp() {
  hide($('loginSection'));
  show($('app'), $('authActions'));

  // Display Setup Summary
  const { school, cls, sec } = JSON.parse(localStorage.getItem(CRED_KEY));
  $('setupText').textContent = `${school} | ${cls} | Section ${sec}`;
  hide($('setupForm'));
  show($('setupDisplay'));

  // Now invoke the original app logic
  initOriginalApp();
}

// 6) Original App Code (verbatim from your uploaded app.js)
function initOriginalApp() {
  // --- Universal PDF share helper (must come first) ---
  async function sharePdf(blob, fileName, title) {
    if (navigator.canShare && navigator.canShare({
      files: [new File([blob], fileName, { type: 'application/pdf' })]
    })) {
      try {
        await navigator.share({
          title,
          files: [new File([blob], fileName, { type: 'application/pdf' })]
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

  // --- 1. Load stored setup, fee, dates, students, attendance, analytics ---
  let lastAdmNo = parseInt(await idbKeyval.get('lastAdmissionNo') || '0', 10);
  let lastAnalyticsStats = [], lastAnalyticsRange = { from: null, to: null }, lastAnalyticsShare = '';

  // --- 2. generate Admission No ---
  function genAdmNo() {
    lastAdmNo++;
    idbKeyval.set('lastAdmissionNo', lastAdmNo.toString());
    return lastAdmNo;
  }

  // --- 3. DOM Helpers ---
  function createEl(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    }
    children.forEach(c => el.append(typeof c === 'string' ? document.createTextNode(c) : c));
    return el;
  }

  // --- 4. Upgrade Helpers & Buttons ---
  $('saveSetup').onclick = async () => {
    const s = $('schoolNameInput').value.trim();
    const c = $('teacherClassSelect').value;
    const t = $('teacherSectionSelect').value;
    if (!s || !c || !t) {
      alert('Please fill all setup fields');
      return;
    }
    await idbKeyval.set('schoolName', s);
    await idbKeyval.set('teacherClass', c);
    await idbKeyval.set('teacherSection', t);
    $('setupText').textContent = `${s} | ${c} | Section ${t}`;
    hide($('setupForm')); show($('setupDisplay'));
  };
  $('editSetup').onclick = () => {
    hide($('setupDisplay')); show($('setupForm'));
  };

  // --- 5. Fee Settings ---
  (async () => {
    const fee = await idbKeyval.get('feeAmount');
    if (fee) $('feeInput').value = fee;
  })();
  $('saveFee').onclick = async () => {
    const f = $('feeInput').value;
    if (!f) return alert('Enter fee amount');
    await idbKeyval.set('feeAmount', f);
    alert('Fee saved');
  };

  // --- 6. Date Range & Counters ---
  $('loadRange').onclick = async () => {
    const from = $('fromDate').value, to = $('toDate').value;
    if (!from || !to) return alert('Select both dates');
    await idbKeyval.set('fromDate', from);
    await idbKeyval.set('toDate', to);
    renderAttendance(); renderAnalytics();
  };
  (async () => {
    const from = await idbKeyval.get('fromDate'), to = await idbKeyval.get('toDate');
    if (from) $('fromDate').value = from;
    if (to) $('toDate').value = to;
  })();

  // --- 7. Student Registration ---
  let students = [];
  async function loadStudents() {
    students = JSON.parse(await idbKeyval.get('students') || '[]');
    $('admNoInput').value = students.length ? students[students.length - 1].adm + 1 : 1;
    renderStudentTable();
  }
  async function saveStudent() {
    const name = $('studentNameInput').value.trim();
    const adm  = parseInt($('admNoInput').value, 10);
    if (!name) return alert('Enter student name');
    students.push({ name, adm });
    await idbKeyval.set('students', JSON.stringify(students));
    $('studentNameInput').value = '';
    $('admNoInput').value = genAdmNo();
    renderStudentTable();
  }
  $('saveStudent').onclick = saveStudent;

  function renderStudentTable() {
    const tbl = createEl('table', { class: 'table' },
      createEl('thead', {}, createEl('tr', {},
        'No,Name'.split(',').map(h => createEl('th', {}, h))
      )),
      createEl('tbody', {},
        ...students.map(s => createEl('tr', {},
          createEl('td', {}, s.adm.toString()),
          createEl('td', {}, s.name)
        ))
      )
    );
    $('student-register').append(tbl);
  }

  // --- 8. Attendance ---
  let attendance = {};
  function renderAttendance() {
    attendance = JSON.parse(await idbKeyval.get('attendance') || '{}');
    const from = $('fromDate').value, to = $('toDate').value;
    const dates = [];
    for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
    const list = dates.map(date => {
      const div = createEl('div', { class: 'attendance-day' }, date);
      students.forEach(s => {
        const cb = createEl('input', { type: 'checkbox', checked: attendance[date]?.includes(s.adm) });
        div.append(cb, createEl('span', {}, s.name));
      });
      return div;
    });
    const container = $('attendanceList');
    container.innerHTML = '';
    list.forEach(el => container.append(el));
  }
  $('saveAttendance').onclick = async () => {
    const list = document.querySelectorAll('#attendanceList .attendance-day');
    list.forEach(div => {
      const date = div.childNodes[0].textContent;
      const checked = Array.from(div.querySelectorAll('input:checked')).map((cb,i) => students[i].adm);
      attendance[date] = checked;
    });
    await idbKeyval.set('attendance', JSON.stringify(attendance));
    alert('Attendance saved');
    renderAnalytics();
  };

  // --- 9. Analytics ---
  function renderAnalytics() {
    const from = $('fromDate').value, to = $('toDate').value;
    const dates = [], counts = [];
    for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
      const dd = d.toISOString().slice(0,10);
      dates.push(dd);
      counts.push((attendance[dd] || []).length);
    }
    const ctx = $('attendanceChart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: { labels: dates, datasets: [{ label: 'Present', data: counts }] },
      options: { responsive: true }
    });
  }
  $('downloadChart').onclick = () => {
    const canvas = $('attendanceChart');
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jspdf.jsPDF();
    pdf.addImage(imgData, 'PNG', 10, 10, 180, 80);
    pdf.save('attendance-chart.pdf');
  };
  $('shareChart').onclick = async () => {
    const canvas = $('attendanceChart');
    canvas.toBlob(blob => sharePdf(blob, 'chart.pdf', 'Attendance Chart'));
  };

  // --- 10. CSV Export / Import ---
  $('exportCsv').onclick = () => {
    let csv = 'Admission,Name\n' + students.map(s => `${s.adm},${s.name}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'students.csv';
    a.click();
  };
  $('importCsv').onclick = () => $('csvFile').click();
  $('csvFile').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = async () => {
      const lines = fr.result.split('\n').slice(1);
      students = lines.filter(l => l).map(l => {
        const [adm, name] = l.split(',');
        return { adm: parseInt(adm,10), name };
      });
      await idbKeyval.set('students', JSON.stringify(students));
      renderStudentTable();
    };
    fr.readAsText(file);
  };

  // --- 11. Init on load ---
  (async () => {
    await loadStudents();
    renderAttendance();
    renderAnalytics();
  })();

  // --- 12. Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
}

// 7) DOMContentLoaded → Show login or start
window.addEventListener('DOMContentLoaded', () => {
  // Bind login button
  $('loginBtn').onclick = doLogin;

  // If already logged in, start immediately
  if (localStorage.getItem(CRED_KEY)) {
    startApp();
  } else {
    hide($('app'), $('authActions'));
    show($('loginSection'));
  }
});
