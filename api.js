// api.js
// -------------------------------------------------------------------------------------------------
// Centralized wrappers for signup requests, role-based redirects, and admin approvals.

import {
  auth,
  database,
  dbRef,
  dbSet,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  app
} from './firebase.js';
import { get } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-functions.js';

// Initialize Cloud Functions in asia-south1
const functions = getFunctions(app, 'asia-south1');
const deleteUserFn = httpsCallable(functions, 'deleteUser');
const setCustomClaimFn = httpsCallable(functions, 'setCustomClaim');

// 1. Request signup (writes to Realtime DB `/approvals/${uid}`)
export async function requestSignup(uid, role, meta = {}) {
  const newReqRef = dbRef(database, `approvals/${uid}`);
  await dbSet(newReqRef, {
    uid,
    role,
    meta,
    status: 'pending',
    requestedAt: Date.now()
  });
}

// 2. Redirect after login based on custom claim
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

// 3. Fetch all pending approvals once
export async function fetchPendingApprovals() {
  const snap = await get(dbRef(database, 'approvals'));
  console.log('Raw approvals snapshot:', snap.val());
  if (!snap.exists()) return [];
  const data = snap.val();
  const pending = Object.entries(data)
    .filter(([uid, req]) => req.status === 'pending')
    .map(([uid, req]) => ({
      uid,
      role: req.role,
      meta: req.meta || {},
      requestedAt: req.requestedAt,
      email: req.meta?.email || ''
    }));
  console.log('Filtered pending approvals:', pending);
  return pending;
}

// 4. Approve or reject a request using callable functions
export async function handleApproval(uid, approve, role) {
  const statusRef = dbRef(database, `approvals/${uid}/status`);
  if (approve) {
    // Set custom claim 'role'
    const result = await setCustomClaimFn({ uid, claimKey: 'role', claimValue: role });
    console.log('setCustomClaim result:', result);
    await dbSet(statusRef, 'approved');
  } else {
    // Delete user
    const result = await deleteUserFn({ uid });
    console.log('deleteUser result:', result);
    await dbSet(statusRef, 'rejected');
  }
}

// 5. Init auth listener for redirects
export function initAuthListener() {
  onAuthStateChanged(auth, async user => {
    if (!user) return;
    const token = await user.getIdTokenResult();
    if (token.claims.role) {
      redirectBasedOnRole(token.claims.role);
    }
  });
}
