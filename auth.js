// auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  get,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
const { get: idbGet, set: idbSet } = window.idbKeyval;

// ——— Firebase init ———
const firebaseConfig = { /* your config here */ };
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const usersRef = dbRef(db, 'users');
const schoolsRef = dbRef(db, 'appData/schools');

// ——— on load: try auto-login ———
(async function tryAutoLogin() {
  const sess = await idbGet('session');
  if (sess) {
    showSetup(sess);
  }
})();

// ——— LOGIN handler ———
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const userId = e.target.userId.value.trim();
  const key    = e.target.key.value.trim();
  if (!userId || !key) return alert('Enter both User ID & Key.');

  const snap = await get(dbRef(db, `users/${userId}`));
  if (!snap.exists() || snap.val().key !== key || !snap.val().active) {
    return alert('Invalid credentials or not yet approved.');
  }

  const u = snap.val();
  const sess = {
    userId,
    role:   u.role,
    school: u.school,
    cls:    u.cls,
    sec:    u.sec
  };
  await idbSet('session', sess);
  showSetup(sess);
});

// ——— SHOW & CONFIGURE SETUP pane ———
async function showSetup(sess) {
  // hide auth forms
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('signupSection').classList.add('hidden');

  // show setup section
  const setup = document.getElementById('teacher-setup');
  setup.classList.remove('hidden');

  // load schools dropdown
  const snap = await get(schoolsRef);
  const schools = snap.exists() ? Object.values(snap.val()) : [];
  const schoolSelect = document.getElementById('schoolSelect');
  schoolSelect.innerHTML = `<option disabled selected>-- Select School --</option>`;
  schools.forEach(s => addOption(schoolSelect, s));

  // role-based visibility
  const inpNewSchool = document.getElementById('schoolInput');
  const selClass     = document.getElementById('classSelect');
  const selSection   = document.getElementById('sectionSelect');

  if (sess.role === 'Admin') {
    // Admin: full control
    inpNewSchool.classList.remove('hidden');
    selClass.classList.remove('hidden');
    selSection.classList.remove('hidden');

  } else if (sess.role === 'Principal') {
    // Principal: no new-school, only own school & all its classes
    inpNewSchool.classList.add('hidden');
    disableSelect(schoolSelect, sess.school);

    selClass.classList.remove('hidden');
    selSection.classList.add('hidden');

  } else {
    // Teacher: only own class/section fixed
    inpNewSchool.classList.add('hidden');
    disableSelect(schoolSelect, sess.school);

    // preload & lock class
    selClass.innerHTML = '';
    addOption(selClass, sess.cls);
    selClass.value = sess.cls;
    selClass.disabled = true;

    // show & lock only own section
    selSection.classList.remove('hidden');
    selSection.innerHTML = '';
    addOption(selSection, sess.sec);
    selSection.value = sess.sec;
    selSection.disabled = true;
  }
}

// ——— SAVE setup & LAUNCH app ———
document.getElementById('saveSetup').addEventListener('click', async () => {
  const school = document.getElementById('schoolSelect').value;
  const cls    = document.getElementById('classSelect').value;
  const sec    = document.getElementById('sectionSelect').value || null;

  if (!school || !cls || ( !sec && (await idbGet('session')).role === 'Teacher')) {
    return alert('Please complete all required fields.');
  }

  await idbSet('setup', { school, cls, sec });

  // reveal the real app
  document.getElementById('teacher-setup').classList.add('hidden');
  document.getElementById('appHeader').classList.remove('hidden');
  document.getElementById('mainApp').classList.remove('hidden');

  // now your app.js can pick up setup from IndexedDB and proceed
});

// ——— Helpers ———
function addOption(selectElem, text) {
  const o = document.createElement('option');
  o.value = o.text = text;
  selectElem.append(o);
}
function disableSelect(selectElem, value) {
  addOption(selectElem, value);
  selectElem.value = value;
  selectElem.disabled = true;
}
