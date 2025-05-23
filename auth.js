// File: auth.js
// -------------------------------------------------------------------------------------------------
// Handles UI interactions for login, signup (Principal & Teacher), and redirects based on role.

import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from './firebase.js';

import {
  requestSignup,
  redirectBasedOnRole
} from './api.js';

// 1. Listen for auth state changes and redirect users
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const idToken = await user.getIdTokenResult();
    if (idToken.claims.role) {
      redirectBasedOnRole(idToken.claims.role);
    }
  } catch (err) {
    console.error('Error getting token claims:', err);
    await signOut(auth);
    alert('Authentication error. Please sign in again.');
    window.location.href = 'index.html';
  }
});

// 2. Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.loginEmail.value.trim();
    const password = loginForm.loginPassword.value;
    if (!email || !password) {
      return alert('Please enter both email and password.');
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will redirect on success
    } catch (err) {
      console.error('Login failed:', err);
      alert('Login failed: ' + err.message);
    }
  });
}

// 3. Principal signup handler
const princForm = document.getElementById('signupPrincipalForm');
if (princForm) {
  princForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = princForm.principalEmail.value.trim();
    const password = princForm.principalPassword.value;
    if (!email || !password) {
      return alert('Please provide both email and password.');
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await requestSignup(cred.user.uid, 'principal');
      alert('Principal signup request submitted. Await admin approval.');
      princForm.reset();
      // Force sign-out so user cannot access until approved
      await signOut(auth);
      // Show login form again
      document.getElementById('backToLoginFromPrincipal').click();
    } catch (err) {
      console.error('Principal signup failed:', err);
      alert('Signup failed: ' + err.message);
    }
  });
}

// 4. Teacher signup handler
const teachForm = document.getElementById('signupTeacherForm');
if (teachForm) {
  teachForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email   = teachForm.teacherEmail.value.trim();
    const password= teachForm.teacherPassword.value;
    const school  = teachForm.teacherSchool.value.trim();
    const clazz   = teachForm.teacherClass.value;
    const section = teachForm.teacherSection.value;
    if (!email || !password || !school || !clazz || !section) {
      return alert('Please fill out all teacher signup fields.');
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await requestSignup(cred.user.uid, 'teacher', { school, clazz, section });
      alert('Teacher signup request submitted. Await admin approval.');
      teachForm.reset();
      await signOut(auth);
      document.getElementById('backToLoginFromTeacher').click();
    } catch (err) {
      console.error('Teacher signup failed:', err);
      alert('Signup failed: ' + err.message);
    }
  });
}

// 5. Sign-out button (if you have one in your UI)
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

// 6. Optional: Toggle password visibility for all password inputs
document.querySelectorAll('input[type="password"]').forEach((input) => {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = '👁️';
  toggle.style.marginLeft = '0.5em';
  input.after(toggle);
  toggle.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});
