// auth.js
import "./firebase-config.js"; // initializes Firebase only once
import {
  getDatabase,
  ref as dbRef,
  get,
  push
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
const { get: idbGet, set: idbSet } = window.idbKeyval;

// Database refs
const db = getDatabase();
const usersRef   = dbRef(db, 'users');
const pendingRef = dbRef(db, 'pendingUsers');
const schoolsRef = dbRef(db, 'appData/schools');

// Elements
const loginForm   = document.getElementById('loginForm');
const signupForm  = document.getElementById('signupForm');
const signupRole  = document.getElementById('signupRole');
const classFields = document.getElementById('classSectionFields');

// Toggle class-section fields on role change
signupRole.addEventListener('change', () => {
  classFields.classList.toggle('hidden', signupRole.value !== 'Teacher');
});

// Sign Up Handler
signupForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name   = signupForm.name.value.trim();
  const role   = signupRole.value;
  const school = signupForm.school.value.trim();
  const uid    = signupForm.userId.value.trim();
  const key    = signupForm.key.value.trim();
  const cls    = role === 'Teacher' ? signupForm.cls.value : null;
  const sec    = role === 'Teacher' ? signupForm.sec.value : null;

  if (!name || !role || !school || !uid || !key || (role === 'Teacher' && (!cls || !sec))) {
    alert('تمام فیلڈز بھر دیں۔');
    return;
  }

  // Push to pendingUsers
  await push(pendingRef, { name, role, school, userId: uid, key, cls, sec, active: false });
  alert('درخواست بھیج دی گئی۔ Admin کی منظوری کا انتظار کریں۔');
  signupForm.reset();
  classFields.classList.add('hidden');
});

// Login Handler
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const userId = loginForm.userId.value.trim();
  const key    = loginForm.key.value.trim();

  if (!userId || !key) {
    alert('User ID اور Key دونوں داخل کریں۔');
    return;
  }

  const snap = await get(dbRef(db, `users/${userId}`));
  if (!snap.exists() || snap.val().key !== key || !snap.val().active) {
    alert('Invalid credentials یا ابھی approve نہیں ہوئے۔');
    return;
  }

  const u = snap.val();
  const sess = { userId, role: u.role, school: u.school, cls: u.cls, sec: u.sec };
  await idbSet('session', sess);
  showSetup(sess);
});

// Auto-login on load
(async () => {
  const sess = await idbGet('session');
  if (sess) showSetup(sess);
})();

// Show Setup Section
async function showSetup(sess) {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('signupSection').classList.add('hidden');

  const setup = document.getElementById('teacher-setup');
  setup.classList.remove('hidden');

  // Populate schools
  const snap = await get(schoolsRef);
  const schools = snap.exists() ? Object.values(snap.val()) : [];
  const ss = document.getElementById('schoolSelect');
  ss.innerHTML = '<option disabled selected>-- Select School --</option>';
  schools.forEach(s => ss.append(new Option(s, s)));

  // Role-based UI
  const inpNewSchool = document.getElementById('schoolInput');
  const selClass     = document.getElementById('classSelect');
  const selSection   = document.getElementById('sectionSelect');

  if (sess.role === 'Admin') {
    inpNewSchool.classList.remove('hidden');
    selClass.classList.remove('hidden');
    selSection.classList.remove('hidden');
  } else if (sess.role === 'Principal') {
    inpNewSchool.classList.add('hidden');
    disableAndSelect('schoolSelect', sess.school);
    selClass.classList.remove('hidden');
    selSection.classList.add('hidden');
  } else {
    inpNewSchool.classList.add('hidden');
    disableAndSelect('schoolSelect', sess.school);
    selClass.innerHTML = '';
    disableAndSelect('classSelect', sess.cls);
    selSection.classList.remove('hidden');
    selSection.innerHTML = '';
    disableAndSelect('sectionSelect', sess.sec);
  }
}

// Save Setup and Reveal App
document.getElementById('saveSetup').addEventListener('click', async () => {
  const school = document.getElementById('schoolSelect').value;
  const cls    = document.getElementById('classSelect').value;
  const sec    = document.getElementById('sectionSelect').value || null;
  const sess   = await idbGet('session');

  if (!school || !cls || (sess.role === 'Teacher' && !sec)) {
    alert('تمام ضروری فیلڈز مکمل کریں۔');
    return;
  }

  await idbSet('setup', { school, cls, sec });
  document.getElementById('teacher-setup').classList.add('hidden');
  document.getElementById('appHeader').classList.remove('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
});

// Helper to disable and select a value
function disableAndSelect(id, value) {
  const sel = document.getElementById(id);
  sel.append(new Option(value, value));
  sel.value = value;
  sel.disabled = true;
}
