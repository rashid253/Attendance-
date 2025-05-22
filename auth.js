// auth.js
import "./firebase-config.js";
import {
  getDatabase,
  ref as dbRef,
  push,
  get
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

const db = getDatabase();
const USERS_PATH   = 'appData/users';    // ← correctly point here
const PENDING_PATH = 'pendingUsers';
const SCHOOLS_PATH = 'appData/schools';

// Elements
const loginForm   = document.getElementById('loginForm');
const signupForm  = document.getElementById('signupForm');
const signupRole  = document.getElementById('signupRole');
const classFields = document.getElementById('classSectionFields');

// Toggle class/section on role change
signupRole.addEventListener('change', () => {
  classFields.classList.toggle('hidden', signupRole.value !== 'Teacher');
});

// Sign-Up → push into pendingUsers
signupForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name   = signupForm.name.value.trim();
  const role   = signupRole.value;
  const school = signupForm.school.value.trim();
  const uid    = signupForm.userId.value.trim();
  const key    = signupForm.key.value.trim();
  const cls    = role === 'Teacher' ? signupForm.cls.value : null;
  const sec    = role === 'Teacher' ? signupForm.sec.value : null;

  if (!name || !role || !school || !uid || !key || (role==='Teacher' && (!cls||!sec))) {
    return alert('تمام فیلڈز بھر دیں۔');
  }

  await push(dbRef(db, PENDING_PATH), {
    name, role, school, userId: uid, key, cls, sec, active: false
  });
  alert('درخواست بھیج دی گئی۔ Admin کی منظوری پھ انتظار کریں۔');
  signupForm.reset();
  classFields.classList.add('hidden');
});

// Login → fetch from appData/users/{userId}
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const userId = loginForm.userId.value.trim();
  const key    = loginForm.key.value.trim();

  console.log('🟢 Attempting login for:', userId, '– key entered:', key);
  const snap = await get(dbRef(db, `${USERS_PATH}/${userId}`));
  console.log('🟢 snap.exists():', snap.exists());
  if (!snap.exists()) {
    return alert('Invalid credentials یا approve نہیں ہوئے۔');
  }

  const user = snap.val();
  console.log('🟢 Stored key:', user.key, 'Active:', user.active);

  if (user.key !== key) {
    return alert('Key غلط ہے۔');
  }
  if (!user.active) {
    return alert('Account ابھی pending ہے۔');
  }

  // Success → save session and show setup
  const session = {
    userId,
    role:   user.role,
    school: user.school,
    cls:    user.cls,
    sec:    user.sec
  };
  await idbSet('session', session);
  showSetup(session);
});

// Auto-login if session exists
(async () => {
  const session = await idbGet('session');
  if (session) showSetup(session);
})();

// Show post-login setup UI
async function showSetup(sess) {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('signupSection').classList.add('hidden');
  document.getElementById('teacher-setup').classList.remove('hidden');

  // Load schools
  const snap = await get(dbRef(db, SCHOOLS_PATH));
  const schools = snap.exists() ? Object.values(snap.val()) : [];
  const schoolSelect = document.getElementById('schoolSelect');
  schoolSelect.innerHTML = '<option disabled selected>-- Select School --</option>';
  schools.forEach(s => schoolSelect.append(new Option(s, s)));

  // Role-based UI...
  const inpNew = document.getElementById('schoolInput');
  const selCls = document.getElementById('teacherClassSelect');
  const selSec = document.getElementById('teacherSectionSelect');
  if (sess.role === 'Admin') {
    inpNew.classList.remove('hidden');
    selCls.classList.remove('hidden');
    selSec.classList.remove('hidden');
  } else if (sess.role === 'Principal') {
    inpNew.classList.add('hidden');
    disable('schoolSelect', sess.school);
    selCls.classList.remove('hidden');
    selSec.classList.add('hidden');
  } else {
    inpNew.classList.add('hidden');
    disable('schoolSelect', sess.school);
    disable('teacherClassSelect', sess.cls);
    selSec.classList.remove('hidden');
    disable('teacherSectionSelect', sess.sec);
  }
}

// Save setup
document.getElementById('saveSetup').addEventListener('click', async () => {
  const school = document.getElementById('schoolSelect').value;
  const cls    = document.getElementById('teacherClassSelect').value;
  const sec    = document.getElementById('teacherSectionSelect').value || null;
  const sess   = await idbGet('session');

  if (!school || !cls || (sess.role==='Teacher' && !sec)) {
    return alert('تمام ضروری فیلڈز مکمل کریں۔');
  }

  await idbSet('setup', { school, cls, sec });
  document.getElementById('teacher-setup').classList.add('hidden');
  document.getElementById('appHeader').classList.remove('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
});

// Utility to disable a select and set its value
function disable(id, val) {
  const el = document.getElementById(id);
  el.append(new Option(val, val));
  el.value = val;
  el.disabled = true;
}
