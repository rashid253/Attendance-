// File: auth.js

import { auth } from './firebase.js';
import { requestSignup, redirectBasedOnRole } from './api.js';

// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = loginForm['loginEmail'].value;
    const password = loginForm['loginPassword'].value;
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      alert(err.message);
    }
  });
}

// Principal signup handler
const signupPrincipalForm = document.getElementById('signupPrincipalForm');
if (signupPrincipalForm) {
  signupPrincipalForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = signupPrincipalForm['principalEmail'].value;
    const password = signupPrincipalForm['principalPassword'].value;
    try {
      const { user } = await auth.createUserWithEmailAndPassword(email, password);
      await requestSignup(user.uid, 'principal', {});
      alert('Signup request submitted. Await admin approval.');
      signupPrincipalForm.reset();
    } catch (err) {
      alert(err.message);
    }
  });
}

// Teacher signup handler
const signupTeacherForm = document.getElementById('signupTeacherForm');
if (signupTeacherForm) {
  signupTeacherForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = signupTeacherForm['teacherEmail'].value;
    const password = signupTeacherForm['teacherPassword'].value;
    const school = signupTeacherForm['teacherSchool'].value;
    const clazz = signupTeacherForm['teacherClass'].value;
    const section = signupTeacherForm['teacherSection'].value;
    try {
      const { user } = await auth.createUserWithEmailAndPassword(email, password);
      await requestSignup(user.uid, 'teacher', { school, clazz, section });
      alert('Signup request submitted. Await admin approval.');
      signupTeacherForm.reset();
    } catch (err) {
      alert(err.message);
    }
  });
}

// Auth state & route-guard
auth.onAuthStateChanged(async user => {
  if (!user) return;
  const idToken = await user.getIdTokenResult();
  if (idToken.claims.role) {
    redirectBasedOnRole(idToken.claims.role);
  }
});

// Sign-out helper
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => auth.signOut());
}
