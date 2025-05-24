// File: api.js
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
  signOut
} from './firebase.js';
import { get } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';

// Base URL for your functions
const FUNC_BASE = 'https://asia-south1-attandace-management.cloudfunctions.net';

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

// helper to call Cloud Function with auth
async function callFn(path, body) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  const resp = await fetch(`${FUNC_BASE}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || resp.statusText);
  }
  return resp.json();
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

// 4. Approve or reject a request
export async function handleApproval(uid, approve, role) {
  const statusRef = dbRef(database, `approvals/${uid}/status`);
  if (approve) {
    await callFn('setCustomClaim', { uid, role });
    await dbSet(statusRef, 'approved');
  } else {
    await callFn('deleteUser', { uid });
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
