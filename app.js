// auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  push,
  get
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
const { get: idbGet, set: idbSet } = window.idbKeyval;

// ——— Firebase init ———
const firebaseConfig = { /* your config here */ };
initializeApp(firebaseConfig);
const db = getDatabase();
const usersRef    = dbRef(db, 'users');
const pendingRef  = dbRef(db, 'pendingUsers');
const schoolsRef  = dbRef(db, 'appData/schools');

// ——— ELEMENTS ———
const loginForm   = document.getElementById('loginForm');
const signupForm  = document.getElementById('signupForm');
const signupRole  = document.getElementById('signupRole');
const classFields = document.getElementById('classSectionFields');

// ——— SHOW/HIDE Class-Section on Role change ———
signupRole.addEventListener('change', () => {
  if (signupRole.value === 'Teacher') {
    classFields.classList.remove('hidden');
  } else {
    classFields.classList.add('hidden');
  }
});

// ——— SIGN-UP handler ———
signupForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name   = document.getElementById('signupName').value.trim();
  const role   = signupRole.value;
  const school = document.getElementById('signupSchool').value.trim();
  const uid    = document.getElementById('signupUserId').value.trim();
  const key    = document.getElementById('signupKey').value.trim();
  const cls    = (role==='Teacher') ? document.getElementById('signupClass').value : null;
  const sec    = (role==='Teacher') ? document.getElementById('signupSection').value : null;

  if (!name||!role||!school||!uid||!key || (role==='Teacher' && (!cls||!sec))) {
    return alert('تمام فیلڈز بھر دیں۔');
  }

  // push to pendingUsers
  await push(pendingRef, { name, role, school, userId: uid, key, cls, sec, active: false });
  alert('درخواست بھیج دی گئی ہے۔ Admin کی منظوری کا انتظار کریں۔');
  signupForm.reset();
  classFields.classList.add('hidden');
});

// ——— LOGIN handler ———
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const userId = document.getElementById('loginUserId').value.trim();
  const key    = document.getElementById('loginKey').value.trim();
  if (!userId||!key) return alert('User ID اور Key دونوں داخل کریں۔');

  const snap = await get(dbRef(db, `users/${userId}`));
  if (!snap.exists() || snap.val().key!==key || !snap.val().active) {
    return alert('Invalid credentials یا ابھی approve نہیں ہوئے۔');
  }

  const u = snap.val();
  const sess = { userId, role: u.role, school: u.school, cls: u.cls, sec: u.sec };
  await idbSet('session', sess);
  showSetup(sess);
});

// ——— AUTO-LOGIN on page load ———
(async function(){
  const sess = await idbGet('session');
  if (sess) showSetup(sess);
})();

// ——— SHOW SETUP (same as before) ———
async function showSetup(sess) {
  // hide auth
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('signupSection').classList.add('hidden');
  // show setup
  const setup = document.getElementById('teacher-setup');
  setup.classList.remove('hidden');

  // load schools into #schoolSelect...
  const snap = await get(schoolsRef);
  const opts = snap.exists() ? Object.values(snap.val()) : [];
  const ss   = document.getElementById('schoolSelect');
  ss.innerHTML = '<option disabled selected>-- Select School --</option>';
  opts.forEach(s=> ss.append(new Option(s,s)));

  // role-based fields (Admin/Principal/Teacher)...
  // (same logic as previously provided)
}
