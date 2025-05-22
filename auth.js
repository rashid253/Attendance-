// auth.js
import "./firebase-config.js";
import {
  getDatabase,
  ref as dbRef,
  push,
  get
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
const { get: idbGet, set: idbSet } = window.idbKeyval;

const db = getDatabase();
const usersRef   = dbRef(db, 'users');
const pendingRef = dbRef(db, 'pendingUsers');
const schoolsRef = dbRef(db, 'appData/schools');

// Elements
const loginForm   = document.getElementById('loginForm');
const signupForm  = document.getElementById('signupForm');
const signupRole  = document.getElementById('signupRole');
const classFields = document.getElementById('classSectionFields');

// Toggle class/section inputs
signupRole.addEventListener('change', () => {
  classFields.classList.toggle('hidden', signupRole.value !== 'Teacher');
});

// Sign Up
signupForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name   = signupForm.name.value.trim();
  const role   = signupRole.value;
  const school = signupForm.school.value.trim();
  const uid    = signupForm.userId.value.trim();
  const key    = signupForm.key.value.trim();
  const cls    = role==='Teacher' ? signupForm.cls.value : null;
  const sec    = role==='Teacher' ? signupForm.sec.value : null;
  if (!name||!role||!school||!uid||!key||(role==='Teacher'&&(!cls||!sec))) {
    return alert('تمام فیلڈز بھر دیں۔');
  }
  await push(pendingRef, { name, role, school, userId: uid, key, cls, sec, active: false });
  alert('درخواست بھیج دی گئی۔ Admin کی منظوری پھ انتظار کریں۔');
  signupForm.reset();
  classFields.classList.add('hidden');
});

// Login
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const userId = loginForm.userId.value.trim();
  const key    = loginForm.key.value.trim();
  if (!userId||!key) return alert('User ID اور Key دونوں داخل کریں۔');
  const snap = await get(dbRef(db, `users/${userId}`));
  if (!snap.exists()||snap.val().key!==key||!snap.val().active) {
    return alert('Invalid credentials یا approve نہیں ہوئے۔');
  }
  const u = snap.val();
  const sess = { userId, role: u.role, school: u.school, cls: u.cls, sec: u.sec };
  await idbSet('session', sess);
  showSetup(sess);
});

// Auto-login
(async()=>{
  const sess = await idbGet('session');
  if (sess) showSetup(sess);
})();

// Show Setup
async function showSetup(sess) {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('signupSection').classList.add('hidden');
  const setup = document.getElementById('teacher-setup');
  setup.classList.remove('hidden');

  // Schools dropdown
  const snap = await get(schoolsRef);
  const opts = snap.exists()?Object.values(snap.val()):[];
  const ss = document.getElementById('schoolSelect');
  ss.innerHTML = '<option disabled selected>-- Select School --</option>';
  opts.forEach(s=>ss.append(new Option(s,s)));

  // Role-based fields
  const inpNew = document.getElementById('schoolInput');
  const selCls = document.getElementById('classSelect');
  const selSec = document.getElementById('sectionSelect');
  if (sess.role==='Admin') {
    inpNew.classList.remove('hidden');
    selCls.classList.remove('hidden');
    selSec.classList.remove('hidden');
  } else if (sess.role==='Principal') {
    inpNew.classList.add('hidden');
    disable('schoolSelect',sess.school);
    selCls.classList.remove('hidden');
    selSec.classList.add('hidden');
  } else {
    inpNew.classList.add('hidden');
    disable('schoolSelect',sess.school);
    selCls.innerHTML='';
    disable('classSelect',sess.cls);
    selSec.classList.remove('hidden');
    selSec.innerHTML='';
    disable('sectionSelect',sess.sec);
  }
}

// Save Setup
document.getElementById('saveSetup').addEventListener('click',async()=>{
  const school = document.getElementById('schoolSelect').value;
  const cls    = document.getElementById('classSelect').value;
  const sec    = document.getElementById('sectionSelect').value||null;
  const sess   = await idbGet('session');
  if (!school||!cls||(sess.role==='Teacher'&&!sec)) {
    return alert('تمام ضروری فیلڈز مکمل کریں۔');
  }
  await idbSet('setup',{school,cls,sec});
  document.getElementById('teacher-setup').classList.add('hidden');
  document.getElementById('appHeader').classList.remove('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
});

function disable(id,val){
  const e=document.getElementById(id);
  e.append(new Option(val,val));
  e.value=val;
  e.disabled=true;
}
