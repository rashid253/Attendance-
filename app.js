// app.js

// ——— 1. DOM Helpers ———
const $ = id => document.getElementById(id);
const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

// ——— 2. Firebase SDK & Init ———
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
  getFirestore, collection, addDoc,
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
// 🔧 DOM-selector helper
const $ = id => document.getElementById(id);

const firebaseConfig = {
  apiKey: "AIzaSyBsx5pWhYGh1bJ9gL2bmC68gVc6EpICEzA",
  authDomain: "attandace-management.firebaseapp.com",
  projectId: "attandace-management",
  storageBucket: "attandace-management.firebasestorage.app",
  messagingSenderId: "222685278846",
  appId: "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B"
};
initializeApp(firebaseConfig);
const db = getFirestore();

// ——— 3. Attendance Save Function ———
async function saveAttendance(name, status) {
  try {
    const ref = await addDoc(collection(db, "attendance"), {
      name, status, timestamp: new Date()
    });
    console.log("✅ Attendance saved with ID:", ref.id);
    alert("✅ Attendance saved!");
  } catch (e) {
    console.error("❌ Error saving attendance:", e);
    alert("❌ Error: " + e.message);
  }
}
window.saveAttendance = saveAttendance;

// ——— 4. IndexedDB (idb-keyval) Setup ———
if (!window.idbKeyval) console.error('idb-keyval missing');
const { get, set, clear } = window.idbKeyval;
const save = (k, v) => set(k, v);

// 🔧 Load persisted schools list (IndexedDB)
let schools = (await get('schools')) || [];
// ——— 5. State & Defaults ———
let students       = await get('students')        || [];
let attendanceData = await get('attendanceData')  || {};
let paymentsData   = await get('paymentsData')    || {};
let lastAdmNo      = await get('lastAdmissionNo') || 0;
let fineRates      = await get('fineRates')       || { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct = await get('eligibilityPct')  || 75;
let analyticsFilterOptions = ['all'], analyticsDownloadMode = 'combined';
let lastAnalyticsStats = [], lastAnalyticsRange = { from:null, to:null }, lastAnalyticsShare = '';

// ——— 6. Schools → Classes → Sections Setup ———
const setupRef     = doc(db, "setup", "config");
const setupForm    = $('setupForm');
const setupDisplay = $('setupDisplay');
const schoolInput  = $('schoolInput');
const schoolSelect = $('schoolSelect');
const classSelect  = $('teacherClassSelect');
const sectionSelect= $('teacherSectionSelect');
const setupText    = $('setupText');
const saveSetupBtn = $('saveSetup');
const editSetupBtn = $('editSetup');

let setupData = { schools:[], currentSchool:null, teacherClass:null, teacherSection:null };

async function loadSetupData() {
  try {
    const snap = await getDoc(setupRef);
    if (snap.exists()) setupData = snap.data();
  } catch {
    const local = await get('setup') || {};
    setupData = { ...setupData, ...local };
  }
}
async function saveSetupData() {
  try {
    await setDoc(setupRef, setupData);
  } catch {
    await save('setup', setupData);
  }
}
function renderSchoolList() {
  const list = $('schoolList');
  list.innerHTML = "";
  setupData.schools.forEach((name,i) => {
    list.insertAdjacentHTML('beforeend', `
      <div class="row-inline">
        <span>${name}</span>
        <button data-idx="${i}" class="edit-school no-print">✎</button>
        <button data-idx="${i}" class="delete-school no-print">🗑</button>
      </div>`);
  });
  list.querySelectorAll('.edit-school').forEach(btn => {
    btn.onclick = async () => {
      const i = +btn.dataset.idx;
      const n = prompt('Edit School Name:', setupData.schools[i]);
      if (!n?.trim()) return;
      setupData.schools[i] = n.trim();
      await saveSetupData();
      await loadSetup();
    };
  });
  list.querySelectorAll('.delete-school').forEach(btn => {
    btn.onclick = async () => {
      const i = +btn.dataset.idx;
      if (!confirm(`Delete "${setupData.schools[i]}"?`)) return;
      const [removed] = setupData.schools.splice(i,1);
      if (setupData.currentSchool === removed) {
        setupData.currentSchool = setupData.teacherClass = setupData.teacherSection = null;
      }
      await saveSetupData();
      await loadSetup();
    };
  });
}
async function loadSetup() {
  await loadSetupData();
  // populate dropdown
  schoolSelect.innerHTML = ['<option disabled selected>-- Select School --</option>']
    .concat(setupData.schools.map(s=>`<option value="${s}">${s}</option>`))
    .join('');
  if (setupData.currentSchool) schoolSelect.value = setupData.currentSchool;
  renderSchoolList();
  const [cs,cc,csn] = await Promise.all([
    get('currentSchool'), get('teacherClass'), get('teacherSection')
  ]);
  if (cs && cc && csn) {
    classSelect.value   = cc;
    sectionSelect.value = csn;
    setupText.textContent = `${cs} 🏫 | Class: ${cc} | Section: ${csn}`;
    show($('setupDisplay')); hide($('setupForm'));
  } else {
    show($('setupForm')); hide($('setupDisplay'));
  }
}
saveSetupBtn.onclick = async e => {
  e.preventDefault();
  const name = schoolInput.value.trim();
  if (name) {
    if (!setupData.schools.includes(name)) setupData.schools.push(name);
    schoolInput.value = '';
    await saveSetupData();
    return loadSetup();
  }
  const s = schoolSelect.value, c = classSelect.value, h = sectionSelect.value;
  if (!s||!c||!h) return alert('Select school, class & section.');
  await Promise.all([ save('currentSchool',s), save('teacherClass',c), save('teacherSection',h) ]);
  await loadSetup();
};
editSetupBtn.onclick = e => {
  e.preventDefault();
  show($('setupForm')); hide($('setupDisplay'));
};
await loadSetup();

// ——— 7. Counters & Helpers ———
function animateCounters() {
  document.querySelectorAll('.number').forEach(span => {
    const target = +span.dataset.target; let count=0; const step=Math.max(1,target/100);
    (function upd(){ count+=step; span.textContent = count<target?Math.ceil(count):target;
      if(count<target) requestAnimationFrame(upd);
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
function resetViews() {
  hide(
    $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
    $('attendanceSummary'), $('downloadAttendancePDF'), $('shareAttendanceSummary'),
    $('instructions'), $('analyticsContainer'), $('graphs'), $('analyticsActions'),
    $('registerTableWrapper'), $('changeRegister'),
    $('saveRegistration'), $('downloadRegister'), $('shareRegister')
  );
  show($('loadRegister'));
}
$('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };
$('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

// ——— 8. Student Registration & Payment Modal ———

// Generate new admission number
async function genAdmNo() {
  lastAdmNo++;
  await save('lastAdmissionNo', lastAdmNo);
  return String(lastAdmNo).padStart(4, '0');
}

// Render students table for registration
function renderStudents() {
  const cl = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;
  const tbody = $('studentsBody');
  tbody.innerHTML = '';
  let idx = 0;

  students.forEach((s, i) => {
    if (s.cls !== cl || s.sec !== sec) return;
    idx++;
    const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
    Object.values(attendanceData).forEach(rec => {
      if (rec[s.adm]) stats[rec[s.adm]]++;
    });
    const total = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
    const fine = stats.A * fineRates.A + stats.Lt * fineRates.Lt + stats.L * fineRates.L + stats.HD * fineRates.HD;
    const paid = (paymentsData[s.adm] || []).reduce((sum, p) => sum + p.amount, 0);
    const outstanding = fine - paid;
    const pct = total ? (stats.P / total) * 100 : 0;
    const status = (outstanding > 0 || pct < eligibilityPct) ? 'Debarred' : 'Eligible';

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
      <td>PKR ${outstanding}</td>
      <td>${status}</td>
      <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
    `;
    tbody.appendChild(tr);
  });

  // Select-all checkbox
  $('selectAllStudents').checked = false;
  toggleButtons();

  // Payment button handlers
  document.querySelectorAll('.add-payment-btn').forEach(btn => {
    btn.onclick = () => openPaymentModal(btn.dataset.adm);
  });
}

// Enable/disable bulk-action buttons
function toggleButtons() {
  const any = !!document.querySelector('.sel:checked');
  $('editSelected').disabled = !any;
  $('deleteSelected').disabled = !any;
}
$('studentsBody').addEventListener('change', e => {
  if (e.target.classList.contains('sel')) toggleButtons();
});
$('selectAllStudents').onclick = () => {
  document.querySelectorAll('.sel').forEach(cb => {
    cb.checked = $('selectAllStudents').checked;
  });
  toggleButtons();
};

// Add new student
$('addStudent').onclick = async e => {
  e.preventDefault();
  const name = $('studentName').value.trim();
  const parent = $('parentName').value.trim();
  const contact = $('parentContact').value.trim();
  const occupation = $('parentOccupation').value.trim();
  const address = $('parentAddress').value.trim();
  const cl = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;

  if (!name || !parent || !contact || !occupation || !address) {
    return alert('All fields required');
  }
  if (!/^[0-9]{7,15}$/.test(contact)) {
    return alert('Parent contact must be 7–15 digits');
  }

  const adm = await genAdmNo();
  students.push({ name, adm, parent, contact, occupation, address, cls: cl, sec });
  await save('students', students);

  renderStudents();
  updateCounters();
  resetViews();

  // clear form
  ['studentName','parentName','parentContact','parentOccupation','parentAddress']
    .forEach(id => $(id).value = '');
};

// Open payment modal
function openPaymentModal(adm) {
  $('payAdm').textContent = adm;
  $('paymentAmount').value = '';
  show($('paymentModal'));
}
$('paymentModalClose').onclick = () => hide($('paymentModal'));

// Save payment record
$('savePayment').onclick = async () => {
  const adm = $('payAdm').textContent;
  const amt = Number($('paymentAmount').value) || 0;
  paymentsData[adm] = paymentsData[adm] || [];
  paymentsData[adm].push({ date: new Date().toISOString().split('T')[0], amount: amt });
  await save('paymentsData', paymentsData);
  hide($('paymentModal'));
  renderStudents();
};
$('cancelPayment').onclick = () => hide($('paymentModal'));
// ——— 9. Mark Attendance & Show Summary ———

// Elements
const dateInput             = $('dateInput');
const loadAttendanceBtn     = $('loadAttendance');
const saveAttendanceBtn     = $('saveAttendance');
const resetAttendanceBtn    = $('resetAttendance');
const downloadAttendanceBtn = $('downloadAttendancePDF');
const shareAttendanceBtn    = $('shareAttendanceSummary');
const attendanceBodyDiv     = $('attendanceBody');
const attendanceSummaryDiv  = $('attendanceSummary');
const statusNames           = { P:'Present', A:'Absent', Lt:'Late', HD:'Half-Day', L:'Leave' };
const statusColors          = {
  P: 'var(--success)',
  A: 'var(--danger)',
  Lt: 'var(--warning)',
  HD: '#FF9800',
  L: 'var(--info)'
};

// 9.1 Load Attendance UI
loadAttendanceBtn.onclick = () => {
  attendanceBodyDiv.innerHTML = '';
  attendanceSummaryDiv.innerHTML = '';
  const cl  = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;

  attendanceBodyDiv.style.overflowX = 'auto';

  // Build each student row with buttons
  students
    .filter(s => s.cls === cl && s.sec === sec)
    .forEach((stu, i) => {
      const row = document.createElement('div');
      row.className = 'attendance-row';

      // Header
      const header = document.createElement('div');
      header.className = 'attendance-header';
      header.textContent = `${i + 1}. ${stu.name} (${stu.adm})`;

      // Buttons
      const btns = document.createElement('div');
      btns.className = 'attendance-buttons';
      Object.keys(statusNames).forEach(code => {
        const btn = document.createElement('button');
        btn.className = 'att-btn';
        btn.textContent = code;
        btn.onclick = () => {
          btns.querySelectorAll('.att-btn').forEach(b => {
            b.classList.remove('selected');
            b.removeAttribute('style');
          });
          btn.classList.add('selected');
          btn.style.background = statusColors[code];
          btn.style.color = '#fff';
        };
        btns.appendChild(btn);
      });

      row.append(header, btns);
      attendanceBodyDiv.appendChild(row);
    });

  show(attendanceBodyDiv, saveAttendanceBtn);
  hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
};

// 9.2 Save Attendance & Build Summary
saveAttendanceBtn.onclick = async () => {
  const date = dateInput.value;
  if (!date) return alert('Please pick a date');

  // Reset for this date
  attendanceData[date] = {};

  const cl  = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;

  // Store each student’s chosen status
  students
    .filter(s => s.cls === cl && s.sec === sec)
    .forEach((s, i) => {
      const sel = attendanceBodyDiv.children[i]
        .querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = sel ? sel.textContent : 'A';
    });
  await save('attendanceData', attendanceData);

  // Build summary table
  attendanceSummaryDiv.innerHTML = `<h3>Attendance Report: ${date}</h3>`;
  const tbl = document.createElement('table');
  tbl.id = 'attendanceSummaryTable';
  tbl.innerHTML = `
    <tr>
      <th>Sr#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th>
    </tr>`;

  students
    .filter(s => s.cls === cl && s.sec === sec)
    .forEach((s, i) => {
      const code = attendanceData[date][s.adm];
      tbl.innerHTML += `
        <tr>
          <td>${i + 1}</td>
          <td>${s.adm}</td>
          <td>${s.name}</td>
          <td>${statusNames[code]}</td>
          <td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td>
        </tr>`;
    });

  attendanceSummaryDiv.appendChild(tbl);

  // Hook up individual share icons
  attendanceSummaryDiv.querySelectorAll('.share-individual').forEach(ic => {
    ic.onclick = () => {
      const adm = ic.dataset.adm;
      const st  = students.find(x => x.adm === adm);
      const msg = `Dear Parent, your child (Adm#: ${adm}) was ${statusNames[attendanceData[date][adm]]} on ${date}.`;
      window.open(`https://wa.me/${st.contact}?text=${encodeURIComponent(msg)}`, '_blank');
    };
  });

  hide(attendanceBodyDiv, saveAttendanceBtn);
  show(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
};

// 9.3 Reset Attendance View
resetAttendanceBtn.onclick = () => {
  show(attendanceBodyDiv, saveAttendanceBtn);
  hide(resetAttendanceBtn, downloadAttendanceBtn, shareAttendanceBtn, attendanceSummaryDiv);
};
// ——— 10. PDF Download & WhatsApp Share ———

// 10.1 Download Attendance PDF
$('downloadAttendancePDF').onclick = async () => {
  const date = $('dateInput').value;
  if (!date) return alert('No date selected');
  const doc = new jspdf.jsPDF();
  const w   = doc.internal.pageSize.getWidth();
  const today = new Date().toISOString().split('T')[0];

  doc.setFontSize(18);
  doc.text('Attendance Report', 14, 16);
  doc.setFontSize(10);
  doc.text(`Date: ${today}`, w - 14, 16, { align: 'right' });
  doc.setFontSize(12);
  doc.text($('setupText').textContent, 14, 24);

  doc.autoTable({ startY: 30, html: '#attendanceSummaryTable' });
  const fileName = `attendance_${date}.pdf`;
  const blob     = doc.output('blob');
  doc.save(fileName);
  await sharePdf(blob, fileName, 'Attendance Report');
};

// 10.2 Share Attendance Summary via WhatsApp
$('shareAttendanceSummary').onclick = () => {
  const date = $('dateInput').value;
  if (!date) return alert('No date selected');
  const cl = $('teacherClassSelect').value;
  const sec = $('teacherSectionSelect').value;

  const header = `*Attendance Report*\nClass ${cl} Section ${sec} — ${date}\n`;
  const rows = students
    .filter(s => s.cls === cl && s.sec === sec)
    .map((s, i) => {
      const code = attendanceData[date][s.adm];
      return `${i + 1}. ${s.name} (Adm#: ${s.adm}) — ${statusNames[code]}`;
    }).join('\n');

  const text = encodeURIComponent(header + '\n' + rows);
  window.open(`https://wa.me/?text=${text}`, '_blank');
};
// ——— 11. Attendance Register View & Actions ———
(() => {
  const loadBtn     = $('loadRegister');
  const saveBtn     = $('saveRegister');
  const changeBtn   = $('changeRegister');
  const downloadBtn = $('downloadRegister');
  const shareBtn    = $('shareRegister');
  const tableWrap   = $('registerTableWrapper');
  const headerRow   = $('registerHeader');
  const bodyTbody   = $('registerBody');

  function bindRegisterActions() {
    // Download PDF of register
    downloadBtn.onclick = async () => {
      const doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const today = new Date().toISOString().split('T')[0];
      doc.setFontSize(18);
      doc.text('Attendance Register', 14, 20);
      doc.setFontSize(10);
      doc.text(`Date: ${today}`, pageWidth - 14, 20, { align: 'right' });
      doc.setFontSize(12);
      doc.text($('setupText').textContent, 14, 36);
      doc.autoTable({
        startY: 60,
        html: '#registerTable',
        tableWidth: 'auto',
        styles: { fontSize: 10 }
      });
      const blob = doc.output('blob');
      doc.save(`register_${$('registerMonth').value}.pdf`);
      await sharePdf(blob, `register_${$('registerMonth').value}.pdf`, 'Attendance Register');
    };

    // Share register via WhatsApp
    shareBtn.onclick = () => {
      const header = `*Attendance Register*\n${$('setupText').textContent}`;
      const rows = Array.from(bodyTbody.children).map(tr =>
        Array.from(tr.children)
          .map(td => td.querySelector('.status-text')?.textContent || td.textContent)
          .join(' ')
      );
      window.open(`https://wa.me/?text=${encodeURIComponent(header + '\n' + rows.join('\n'))}`, '_blank');
    };
  }

  // Load the register table for chosen month
  loadBtn.onclick = () => {
    const m = $('registerMonth').value;
    if (!m) return alert('Please pick a month');
    const dateKeys = Object.keys(attendanceData)
      .filter(d => d.startsWith(m + '-'))
      .sort();
    if (!dateKeys.length) return alert('No attendance for this month');

    headerRow.innerHTML =
      `<th>#</th><th>Adm#</th><th>Name</th>` +
      dateKeys.map(d => `<th>${d.split('-')[2]}</th>`).join('');

    bodyTbody.innerHTML = '';
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    students
      .filter(s => s.cls === cl && s.sec === sec)
      .forEach((s, i) => {
        let rowHtml = `<td>${i + 1}</td><td>${s.adm}</td><td>${s.name}</td>`;
        dateKeys.forEach(key => {
          const code = attendanceData[key]?.[s.adm] || '';
          const color = code === 'P' ? 'var(--success)'
                      : code === 'Lt' ? 'var(--warning)'
                      : code === 'HD' ? '#FF9800'
                      : code === 'L'  ? 'var(--info)'
                      : 'var(--danger)';
          const style = code ? `style="background:${color};color:#fff"` : '';
          rowHtml += `<td class="reg-cell" ${style}><span class="status-text">${code}</span></td>`;
        });
        const tr = document.createElement('tr');
        tr.innerHTML = rowHtml;
        bodyTbody.appendChild(tr);
      });

    // Allow toggling statuses
    document.querySelectorAll('.reg-cell').forEach(cell => {
      cell.onclick = () => {
        const span = cell.querySelector('.status-text');
        const codes = ['', 'P', 'Lt', 'HD', 'L', 'A'];
        const idx = (codes.indexOf(span.textContent) + 1) % codes.length;
        span.textContent = codes[idx];
        if (!codes[idx]) {
          cell.removeAttribute('style');
        } else {
          const col = codes[idx] === 'P' ? 'var(--success)'
                    : codes[idx] === 'Lt' ? 'var(--warning)'
                    : codes[idx] === 'HD' ? '#FF9800'
                    : codes[idx] === 'L'  ? 'var(--info)'
                    : 'var(--danger)';
          cell.style.background = col;
          cell.style.color = '#fff';
        }
      };
    });

    show(tableWrap, saveBtn);
    hide(loadBtn, changeBtn, downloadBtn, shareBtn);
  };

  // Save updated register back to IndexedDB
  saveBtn.onclick = async () => {
    const m = $('registerMonth').value;
    const dateKeys = Object.keys(attendanceData)
      .filter(d => d.startsWith(m + '-'))
      .sort();

    Array.from(bodyTbody.children).forEach(tr => {
      const adm = tr.children[1].textContent;
      dateKeys.forEach((key, idx) => {
        const code = tr.children[3 + idx].querySelector('.status-text').textContent;
        if (code) {
          attendanceData[key] = attendanceData[key] || {};
          attendanceData[key][adm] = code;
        } else if (attendanceData[key]) {
          delete attendanceData[key][adm];
        }
      });
    });

    await save('attendanceData', attendanceData);
    hide(saveBtn); show(changeBtn, downloadBtn, shareBtn);
    bindRegisterActions();
  };

  // Change month / clear table
  changeBtn.onclick = () => {
    hide(tableWrap, changeBtn, downloadBtn, shareBtn, saveBtn);
    headerRow.innerHTML = '';
    bodyTbody.innerHTML = '';
    show(loadBtn);
  };

  bindRegisterActions();
})();
// ——— 12. File System Backups & Restore ———

// Elements
const chooseBackupBtn = $('chooseBackupFolder');
const restoreBtn      = $('restoreData');
const fileInput       = $('restoreFile');
const resetBtn        = $('resetData');

let backupHandle = null;
let backupInterval = null;

// Write backup JSON to selected folder
async function writeBackup() {
  try {
    if (!backupHandle) throw new Error('No backup folder chosen');
    // Gather all data
    const data = {
      students,
      attendanceData,
      paymentsData,
      fineRates,
      eligibilityPct,
      lastAdmNo,
      setupData
    };
    // Create/Access subfolder & file
    const dir = await backupHandle.getDirectoryHandle('Attendance Backup', { create: true });
    const file = await dir.getFileHandle('attendance-backup.json', { create: true });
    const writable = await file.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    console.log('✅ Backup written');
  } catch (err) {
    console.error('⚠️ Backup failed:', err);
  }
}

// Initialize auto-backup on load
(async () => {
  try {
    const saved = await get('backupParentHandle');
    if (saved) {
      backupHandle = saved;
      await writeBackup();
      backupInterval = setInterval(writeBackup, 5 * 60 * 1000);
      console.log('Auto-backup started');
    }
  } catch (e) {
    console.warn('Auto-backup init failed', e);
  }
})();

// Choose folder button
chooseBackupBtn.onclick = async () => {
  try {
    if (backupHandle) {
      if (!confirm('Change backup folder?')) return;
      clearInterval(backupInterval);
    }
    alert('Select folder for backups');
    backupHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await save('backupParentHandle', backupHandle);
    await writeBackup();
    backupInterval = setInterval(writeBackup, 5 * 60 * 1000);
    alert('✅ Backup folder set; auto-backup every 5 min');
  } catch (e) {
    console.error('Backup folder selection failed:', e);
  }
};

// Restore data from JSON
restoreBtn.onclick = () => {
  alert('Select your attendance-backup.json file');
  fileInput.click();
};
fileInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const obj = JSON.parse(text);
    await Promise.all([
      save('students', obj.students),
      save('attendanceData', obj.attendanceData),
      save('paymentsData', obj.paymentsData),
      save('fineRates', obj.fineRates),
      save('eligibilityPct', obj.eligibilityPct),
      save('lastAdmissionNo', obj.lastAdmNo),
      save('setup', obj.setupData)
    ]);
    alert('✅ Data restored; reloading…');
    location.reload();
  } catch {
    alert('❌ Invalid backup file');
  }
});

// Factory reset (clear all)
resetBtn.onclick = async () => {
  if (!confirm('DELETE all data? Cannot undo.')) return;
  try {
    await clear();
    alert('✅ All data cleared; reloading…');
    location.reload();
  } catch (e) {
    console.error('Reset failed', e);
    alert('❌ Reset error');
  }
});
// ——— 13. Service Worker ———
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .then(() => console.log('Service Worker registered'))
    .catch(console.error);
}
