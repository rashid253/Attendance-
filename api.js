// File: api.js
// -------------------------------------------------------------------------------------------------
// Centralized wrappers for signup requests, role-based redirects, and admin approvals.

// Import shared Firebase exports
import {
  auth,
  database,
  appDataRef,
  dbRef,
  dbSet,
  onValue,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from './firebase.js';

// Import callable function for setting custom claims
const functions = (await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-functions.js')).getFunctions(undefined, 'asia-south1');
const setCustomClaim = (await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-functions.js')).httpsCallable(functions, 'setCustomClaim');

// 1. Request signup (writes to Realtime DB “approvals” node)
export async function requestSignup(uid, role, meta = {}) {
  const approvalsRef = dbRef(database, 'approvals');
  const newReqRef = dbRef(database, `approvals/${uid}`);  // use uid as key
  await dbSet(newReqRef, {
    uid,
    role,
    meta,
    status:      'pending',
    requestedAt: Date.now()
  });
}

// 2. Redirect user after login based on custom claim
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
      // Invalid role → sign out
      await signOut(auth);
      alert('Unauthorized role. Signed out.');
      window.location.href = 'index.html';
  }
}

// 3. Listen for admin approval actions (to be used in admin.html)
export async function fetchPendingApprovals() {
  const snap = await onValue(dbRef(database, 'approvals'), { onlyOnce: true });
  const data = snap.val() || {};
  // Filter only pending
  return Object.values(data).filter(req => req.status === 'pending');
}

// 4. Approve or reject a request (admin-only action)
//    - approve=true: set custom claim, update status
//    - approve=false: remove user and mark rejected
export async function handleApproval(uid, approve, role) {
  if (approve) {
    // grant custom claim via Cloud Function
    await setCustomClaim({ uid, role });
    // update request status
    await dbSet(dbRef(database, `approvals/${uid}/status`), 'approved');
  } else {
    // you’d need a callable Cloud Function to delete the user
    const deleteUserFn = (await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-functions.js')).httpsCallable(functions, 'deleteUser');
    await deleteUserFn({ uid });
    await dbSet(dbRef(database, `approvals/${uid}/status`), 'rejected');
  }
}

// 5. Utility: listen to auth state + redirect automatically
export function initAuthListener() {
  onAuthStateChanged(auth, async user => {
    if (!user) return;
    const token = await user.getIdTokenResult();
    if (token.claims.role) {
      redirectBasedOnRole(token.claims.role);
    }
  });
}
