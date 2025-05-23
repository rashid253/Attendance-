// auth.js
import { auth, db } from './app.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

// Sign up (principal or teacher)
export async function signup(email, pass, role, extra = {}) {
  const { user } = await createUserWithEmailAndPassword(auth, email, pass);
  await setDoc(doc(db, 'users', user.uid), { uid: user.uid, email, role, status: 'pending', ...extra });
  return user;
}

// Login
export function login(email, pass) {
  return signInWithEmailAndPassword(auth, email, pass);
}

// Logout
export function logout() {
  return signOut(auth);
}

// Listen to auth changes
export function onUserStateChanged(cb) {
  return onAuthStateChanged(auth, cb);
}
