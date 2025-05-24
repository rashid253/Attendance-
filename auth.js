// File: auth.js
// -------------------------------------------------------------------------------------------------
// Handles UI interactions: login, principal/teacher signup, and redirects.

import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from './firebase.js';

import { requestSignup, redirectBasedOnRole } from './api.js';

// 1. Redirect based on role when auth state changes
onAuthStateChanged(auth, async user => {
  if (!user) return;
  try {
    const token = await user.getIdTokenResult();
    if (token.claims.role) {
      redirectBasedOnRole(token.claims.role);
    }
  } catch (err) {
    console.error('Auth state change error:', err);
    await signOut(auth);
    window.location = 'index.html';
  }
});

// 2. Login handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = loginForm.loginEmail.value.trim();
    const password = loginForm.loginPassword.value;
    if (!email || !password) return alert('Enter email & password.');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error('Login error:', err);
      alert('Login failed: ' + err.message);
    }
  });
}

// 3. Principal signup
const princForm = document.getElementById('signupPrincipalForm');
if (princForm) {
  princForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = princForm.principalEmail.value.trim();
    const password = princForm.principalPassword.value;
    if (!email || !password) return alert('Enter email & password.');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // include email in meta
      await requestSignup(cred.user.uid, 'principal', { email });
      alert('Signup request submitted. Await admin approval.');
      princForm.reset();
      await signOut(auth);
      document.getElementById('backToLoginFromPrincipal').click();
    } catch (err) {
      console.error('Principal signup error:', err);
      alert('Signup failed: ' + err.message);
    }
  });
}

// 4. Teacher signup
const teachForm = document.getElementById('signupTeacherForm');
if (teachForm) {
  teachForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = teachForm.teacherEmail.value.trim();
    const password = teachForm.teacherPassword.value;
    const school = teachForm.teacherSchool.value.trim();
    const clazz = teachForm.teacherClass.value;
    const section = teachForm.teacherSection.value;
    if (!email || !password || !school || !clazz || !section) {
      return alert('Fill out all fields.');
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // include email in meta *alongside* school/clazz/section
      await requestSignup(cred.user.uid, 'teacher', {
        email,
        school,
        clazz,
        section
      });
      alert('Signup request submitted. Await admin approval.');
      teachForm.reset();
      await signOut(auth);
      document.getElementById('backToLoginFromTeacher').click();
    } catch (err) {
      console.error('Teacher signup error:', err);
      alert('Signup failed: ' + err.message);
    }
  });
}

// 5. Logout button (if present)
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location = 'index.html';
  });
}
