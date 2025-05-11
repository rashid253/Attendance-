// app.js — Multi‐School / Auth / Backup & Full Original Logic

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
async function startApp() {
  // hide login; show header actions
  hide($('loginSection'));
  show($('authActions'));

  // after login, we still allow Setup; show or hide based on saved state
  const { school, cls, sec } = JSON.parse(localStorage.getItem(CRED_KEY));
  $('schoolNameInput').value    = school;
  $('teacherClassSelect').value = cls;
  $('teacherSectionSelect').value = sec;
  $('setupText').textContent    = `${school} | ${cls} | Section ${sec}`;

  // if setup already saved, show display; else show form
  const saved = await idbKeyval.get('schoolName');
  if (saved) {
    hide($('setupForm'));
    show($('setupDisplay'));
  } else {
    show($('setupForm'));
    hide($('setupDisplay'));
  }

  // now reveal the main app container
  show($('app'));

  // invoke original logic
  await initOriginalApp();
}

// 6) Setup Save/Edit
$('saveSetup').onclick = async () => {
  const s = $('schoolNameInput').value.trim();
  const c = $('teacherClassSelect').value;
  const t = $('teacherSectionSelect').value;
  if (!s || !c || !t) {
    return alert('Please fill all setup fields');
  }
  await idbKeyval.set('schoolName', s);
  await idbKeyval.set('teacherClass', c);
  await idbKeyval.set('teacherSection', t);
  $('setupText').textContent = `${s} | ${c} | Section ${t}`;
  hide($('setupForm'));
  show($('setupDisplay'));
};
$('editSetup').onclick = () => {
  hide($('setupDisplay'));
  show($('setupForm'));
};

// 7) Original App Code (now async)
async function initOriginalApp() {
  // --- Universal PDF share helper ---
  async function sharePdf(blob, fileName, title) {
    if (navigator.canShare && navigator.canShare({
      files: [new File([blob], fileName, { type: 'application/pdf' })]
    })) {
      try {
        await navigator.share({ title, files: [new File([blob], fileName, { type: 'application/pdf' })] });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share failed', err);
      }
    }
  }

  // --- Debug console (optional) ---
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // --- Load stored state ---
  let lastAdmNo = parseInt(await idbKeyval.get('lastAdmissionNo') || '0', 10);
  let students = JSON.parse(await idbKeyval.get('students') || '[]');
  let attendance = JSON.parse(await idbKeyval.get('attendance') || '{}');
  const feeAmount = await idbKeyval.get('feeAmount');
  const storedFrom = await idbKeyval.get('fromDate');
  const storedTo   = await idbKeyval.get('toDate');

  // --- DOM Helpers ---
  function createEl(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    });
    children.forEach(c => el.append(typeof c === 'string' ? document.createTextNode(c) : c));
    return el;
  }

  // --- Admission No gen & initial render ---
  function genAdmNo() {
    lastAdmNo++;
    idbKeyval.set('lastAdmissionNo', lastAdmNo.toString());
    return lastAdmNo;
  }
  $('admNoInput').value = students.length ? students[students.length-1].adm + 1 : genAdmNo();

  // --- Fee Settings init & handler ---
  if (feeAmount) $('feeInput').value = feeAmount;
  $('saveFee').onclick = async () => {
    const f = $('feeInput').value;
    if (!f) return alert('Enter fee amount');
    await idbKeyval.set('feeAmount', f);
    alert('Fee saved');
  };

  // --- Date Range init & handler ---
  if (storedFrom) $('fromDate').value = storedFrom;
  if (storedTo) $('toDate').value = storedTo;
  $('loadRange').onclick = async () => {
    const from = $('fromDate').value, to = $('toDate').value;
    if (!from || !to) return alert('Select both dates');
    await idbKeyval.set('fromDate', from);
    await idbKeyval.set('toDate', to);
    renderAttendance();
    renderAnalytics();
  };

  // --- Student Registration ---
  function renderStudentTable() {
    const old = document.querySelector('#student-register table');
    if (old) old.remove();
    const tbl = createEl('table', {},
      createEl('thead', {}, createEl('tr', {},
        createEl('th', {}, 'No'), createEl('th', {}, 'Name')
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
  $('saveStudent').onclick = async () => {
    const name = $('studentNameInput').value.trim();
    const adm  = parseInt($('admNoInput').value, 10);
    if (!name) return alert('Enter student name');
    students.push({ name, adm });
    await idbKeyval.set('students', JSON.stringify(students));
    $('studentNameInput').value = '';
    $('admNoInput').value = genAdmNo();
    renderStudentTable();
  };
  renderStudentTable();

  // --- Attendance ---
  function renderAttendance() {
    const from = $('fromDate').value, to = $('toDate').value;
    const container = $('attendanceList');
    container.innerHTML = '';
    for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate()+1)) {
      const date = d.toISOString().slice(0,10);
      const div = createEl('div', { class: 'attendance-day' }, date);
      students.forEach(s => {
        const cb = createEl('input', {
          type: 'checkbox',
          checked: (attendance[date]||[]).includes(s.adm)
        });
        div.append(cb, createEl('span', {}, s.name));
      });
      container.append(div);
    }
  }
  $('saveAttendance').onclick = async () => {
    document.querySelectorAll('#attendanceList .attendance-day').forEach(div => {
      const date = div.childNodes[0].textContent;
      attendance[date] = Array.from(div.querySelectorAll('input:checked'))
        .map((cb,i) => students[i].adm);
    });
    await idbKeyval.set('attendance', JSON.stringify(attendance));
    alert('Attendance saved');
    renderAnalytics();
  };
  renderAttendance();

  // --- Analytics ---
  function renderAnalytics() {
    const from = $('fromDate').value, to = $('toDate').value;
    const labels = [], data = [];
    for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate()+1)) {
      const date = d.toISOString().slice(0,10);
      labels.push(date);
      data.push((attendance[date]||[]).length);
    }
    const ctx = $('attendanceChart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Present', data }] },
      options: { responsive: true }
    });
  }
  $('downloadChart').onclick = () => {
    const img = $('attendanceChart').toDataURL('image/png');
    const pdf = new jspdf.jsPDF();
    pdf.addImage(img, 'PNG', 10, 10, 180, 80);
    pdf.save('attendance-chart.pdf');
  };
  $('shareChart').onclick = () => {
    $('attendanceChart').toBlob(blob => sharePdf(blob, 'chart.pdf', 'Attendance Chart'));
  };
  renderAnalytics();

  // --- CSV Export / Import ---
  $('exportCsv').onclick = () => {
    const header = 'Admission,Name\n';
    const rows = students.map(s => `${s.adm},${s.name}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
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
      const lines = fr.result.trim().split('\n').slice(1);
      students = lines.map(l => {
        const [adm, name] = l.split(',');
        return { adm: parseInt(adm,10), name };
      });
      await idbKeyval.set('students', JSON.stringify(students));
      renderStudentTable();
    };
    fr.readAsText(file);
  };

  // --- Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
}

// 8) DOMContentLoaded → Entry Point
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem(CRED_KEY)) {
    startApp();
  } else {
    hide($('app'), $('authActions'));
    show($('loginSection'));
  }
});
