// api.js
// -------------------------------------------------------------------------------------------------
// Centralized wrappers for signup requests, role-based redirects, and admin approvals.

import {
  app,
  auth,
  database,
  dbRef,
  dbSet,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from './firebase.js';
import { get } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-functions.js';

// — Initialize the Functions client (asia-south1) —
const functions        = getFunctions(app, 'asia-south1');
const deleteUserFn     = httpsCallable(functions, 'deleteUser');
const setCustomClaimFn = httpsCallable(functions, 'setCustomClaim');

// 1️⃣ Request signup (writes to RTDB `/approvals/${uid}`)
export async function requestSignup(uid, role, meta = {}) {
  const ref = dbRef(database, `approvals/${uid}`);
  await dbSet(ref, { uid, role, meta, status: 'pending', requestedAt: Date.now() });
}

// 2️⃣ Redirect after login based on custom claim
export async function redirectBasedOnRole(role) {
  switch (role) {
    case 'admin':
      window.location.href = 'admin.html';
      break;
    case 'principal':
      window.location.href = 'principal.html';
      break;
    case 'teacher':
      window.location.href = 'teacher.html';
      break;
    default:
      await signOut(auth);
      alert('Unauthorized role. Signed out.');
      window.location.href = 'index.html';
  }
}

// 3️⃣ Fetch all pending approvals once
export async function fetchPendingApprovals() {
  const snap = await get(dbRef(database, 'approvals'));
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.entries(data)
    .filter(([_, req]) => req.status === 'pending')
    .map(([uid, req]) => ({
      uid,
      role: req.role,
      meta: req.meta || {},
      requestedAt: req.requestedAt,
      email: req.meta?.email || ''
    }));
}

// 4️⃣ Approve or reject a request using HTTPS callables  
export async function handleApproval(uid, approve, role) {
  const statusRef = dbRef(database, `approvals/${uid}/status`);
  try {
    if (approve) {
      // Pass the new role as `claimValue`
      const res = await setCustomClaimFn({ uid, claimValue: role });
      console.log('setCustomClaim:', res);
      await dbSet(statusRef, 'approved');
    } else {
      const res = await deleteUserFn({ uid });
      console.log('deleteUser:', res);
      await dbSet(statusRef, 'rejected');
    }
  } catch (err) {
    console.error('Approval error:', err.code, err.message);
    alert(`Error (${err.code}): ${err.message}`);
  }
}

// 5️⃣ Init auth listener for role-based redirect
export function initAuthListener() {
  onAuthStateChanged(auth, async user => {
    if (!user) return;
    const token = await user.getIdTokenResult();
    if (token.claims.role) redirectBasedOnRole(token.claims.role);
  });
}
