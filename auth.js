// auth.js
// Exports simple role‐checking utilities for use inside app.js and other modules.
//
// NOTE: `firebase-config.js` must be imported before any Auth or Firestore calls.

import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Grab the initialized Auth & Firestore instances from firebase-config.js
// (By importing firebase-config.js first, initializeApp(...) has already run.)
const auth = getAuth();
const db   = getFirestore();

// Returns a Promise that resolves to an object { role, name, assignedSchool?, assignedClass?, assignedSection? }
// or rejects if not found.
export async function fetchUserProfile(uid) {
  const userDocRef = doc(db, "users", uid);
  const snap = await getDoc(userDocRef);
  if (!snap.exists()) {
    return null;
  }
  return snap.data();
}

// Synchronous checks (once window.currentUserRole is set)
export function isAdmin() {
  return window.currentUserRole === "admin";
}

export function isPrincipal() {
  return window.currentUserRole === "principal";
}

export function isTeacher() {
  return window.currentUserRole === "teacher";
}
