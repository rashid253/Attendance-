// auth.js
// =========
// This file exports utilities for your existing app.js to check the current user’s role
// and enforce the role‐based setup restrictions (Admin, Principal, Teacher).

export function isAdmin() {
  return window.currentUserRole === "admin";
}

export function isPrincipal() {
  return window.currentUserRole === "principal";
}

export function isTeacher() {
  return window.currentUserRole === "teacher";
}

// Usage example inside app.js (at top of your logic):
// import { isAdmin, isPrincipal, isTeacher } from "./auth.js";
// Then conditionally show/hide buttons or dropdowns based on these functions.
