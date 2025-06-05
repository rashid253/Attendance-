// auth.js
// -------
// Handles user authentication (sign-in, sign-out) and retrieval of custom‐claim roles.
// Other modules import from here rather than accessing Firebase Auth directly.

import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

/**
 * Sign in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import("firebase/auth").UserCredential>}
 */
export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign out the currently signed‐in user.
 * @returns {Promise<void>}
 */
export function logout() {
  return signOut(auth);
}

/**
 * Subscribe to authentication state changes.
 * @param {(user: import("firebase/auth").User | null) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onUserStateChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Fetch the current user's custom‐claim "role".
 * If no user is signed in or the claim is missing, resolves to null.
 * @returns {Promise<string|null>}
 */
export async function getCurrentUserRole() {
  const user = auth.currentUser;
  if (!user) return null;
  // Force token refresh to ensure up‐to‐date claims
  const idTokenResult = await getIdTokenResult(user, /* forceRefresh=*/ true);
  return idTokenResult.claims.role || null;
}

/**
 * Fetch additional custom claims: "school", "cls", "section" for principals/teachers.
 * If no user or no claims, resolves to an empty object.
 * @returns {Promise<{ role?: string, school?: string, cls?: string, section?: string }>}
 */
export async function getCurrentUserClaims() {
  const user = auth.currentUser;
  if (!user) return {};
  const idTokenResult = await getIdTokenResult(user, /* forceRefresh=*/ true);
  const claims = idTokenResult.claims || {};
  return {
    role:    claims.role    || null,
    school:  claims.school  || null,
    cls:     claims.cls     || null,
    section: claims.section || null
  };
}
