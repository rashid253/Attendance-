// auth.js
// ----------------------
// Authentication & Approval Layer for Attendance App
// ----------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  push,
  onValue,
  remove,
  update,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
const { get: idbGet, set: idbSet } = window.idbKeyval;

// Firebase config (same as in app.js)
const firebaseConfig = {
  apiKey: "AIzaSyBsx…EpICEzA",
  authDomain: "attandace-management.firebaseapp.com",
  projectId: "attandace-management",
  storageBucket: "attandace-management.appspot.com",
  messagingSenderId: "222685278846",
  appId: "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B",
  databaseURL: "https://attandace-management-default-rtdb.firebaseio.com",
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const usersRef       = dbRef(db, 'users');
const pendingRef     = dbRef(db, 'pendingUsers');

// UI elements
const loginForm      = document.getElementById('loginForm');
const signupForm     = document.getElementById('signupForm');
const pendingList    = document.getElementById('pendingList');
const logoutBtn      = document.getElementById('logoutBtn');

// --- SIGNUP FLOW ---
signupForm.addEventListener('submit', async e => {
  e.preventDefault();
  const role    = signupForm.role.value;
  const userId  = signupForm.userId.value.trim();
  const key     = signupForm.key.value.trim();
  const name    = signupForm.name.value.trim();
  const school  = signupForm.school.value;
  const cls     = role === 'Teacher' ? signupForm.cls.value : null;
  const sec     = role === 'Teacher' ? signupForm.sec.value : null;

  if (!userId || !key || !name || !school) {
    return alert('تمام فیلڈز بھریں۔');
  }
  // push to pendingUsers
  await push(pendingRef, { userId, key, name, role, school, cls, sec, active: false });
  alert('آپ کی درخواست جمع ہو گئی۔ ایڈمن کی منظوری کا انتظار کریں۔');
  signupForm.reset();
});

// --- PENDING APPROVAL (Admin) ---
function renderPending() {
  pendingList.innerHTML = '';
  onValue(pendingRef, snapshot => {
    pendingList.innerHTML = '';
    snapshot.forEach(child => {
      const req = child.val();
      const li = document.createElement('li');
      li.textContent = `${req.name} (${req.role}) → ${req.school}` +
        (req.role==='Teacher'? ` – Class ${req.cls} Sec ${req.sec}` : '');
      const approveBtn = document.createElement('button');
      const rejectBtn  = document.createElement('button');
      approveBtn.textContent = 'Approve'; rejectBtn.textContent = 'Reject';
      approveBtn.onclick = async () => {
        const newUserRef = dbRef(db, `users/${req.userId}`);
        await update(newUserRef, { ...req, active: true });
        await remove(dbRef(db, `pendingUsers/${child.key}`));
      };
      rejectBtn.onclick = async () => {
        await remove(dbRef(db, `pendingUsers/${child.key}`));
      };
      li.append(approveBtn, rejectBtn);
      pendingList.append(li);
    });
  });
}

// --- LOGIN FLOW ---
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const userId = loginForm.userId.value.trim();
  const key    = loginForm.key.value.trim();
  if (!userId || !key) {
    return alert('User ID اور Key درج کریں۔');
  }
  onValue(dbRef(db, `users/${userId}`), async snap => {
    if (!snap.exists() || snap.val().key !== key || !snap.val().active) {
      return alert('Invalid credentials یا اکاؤنٹ deactivated۔');
    }
    const user = snap.val();
    // save session
    await idbSet('session', { userId, role: user.role, school: user.school, cls: user.cls, sec: user.sec });
    // redirect to setup/app
    window.location.reload();
  }, { onlyOnce: true });
});

// --- AUTO-LOGIN OFFLINE SUPPORT ---
(async function tryAutoLogin() {
  const sess = await idbGet('session');
  if (sess && sess.userId) {
    // hide auth UI
    document.getElementById('authContainer').classList.add('hidden');
    // show teacher-setup (or full app if already setup)
    document.getElementById('teacher-setup').classList.remove('hidden');
    // prefill selects
    if (sess.role === 'Teacher') {
      document.getElementById('schoolSelect').value = sess.school;
      document.getElementById('teacherClassSelect').value = sess.cls;
      document.getElementById('teacherSectionSelect').value = sess.sec;
    }
    // If Admin/Principal, skip class/section
  }
})();

// --- LOGOUT ---
logoutBtn.addEventListener('click', async () => {
  await idbSet('session', null);
  window.location.href = './';  // or reload
});

// --- INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
  renderPending();
});
