// File: auth.js
// -------------------------------------------------------------------------------------------------

import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from './firebase.js';

import { requestSignup, initAuthListener } from './api.js';

// ----------------------------
// 1. Auto-redirect based on login
initAuthListener();

// ----------------------------
// 2. Login Form Handler
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.loginEmail.value;
  const password = e.target.loginPassword.value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    // Auth listener handles redirection
  } catch (err) {
    alert('Login failed: ' + err.message);
  }
});

// ----------------------------
// 3. Principal Signup Request
document.getElementById('signupPrincipalForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.principalEmail.value;
  const password = e.target.principalPassword.value;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await requestSignup(cred.user.uid, 'principal');
    alert('Signup request sent. Wait for admin approval.');
    signOut(auth);
  } catch (err) {
    alert('Signup failed: ' + err.message);
  }
});

// ----------------------------
// 4. Teacher Signup Request
document.getElementById('signupTeacherForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.teacherEmail.value;
  const password = e.target.teacherPassword.value;
  const school = e.target.teacherSchool.value;
  const className = e.target.teacherClass.value;
  const section = e.target.teacherSection.value;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await requestSignup(cred.user.uid, 'teacher', { school, className, section });
    alert('Signup request sent. Wait for admin approval.');
    signOut(auth);
  } catch (err) {
    alert('Signup failed: ' + err.message);
  }
});
