// File: firebase.js
// -------------------------------------------------------------------------------------------------

// 1. Import & initialize Firebase App
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';

// 2. Import Realtime Database functions
import {
  getDatabase,
  ref as dbRef,
  set as dbSet,
  onValue
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js';

// 3. Import Auth functions
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';

// 4. Your Firebase project configuration (from your original app.js) 
const firebaseConfig = {
  apiKey:      "YOUR_FULL_API_KEY_HERE",
  authDomain:  "attandace-management.firebaseapp.com",
  databaseURL: "https://attandace-management-default-rtdb.firebaseio.com",
  projectId:   "attandace-management",
  storageBucket: "attandace-management.appspot.com",
  messagingSenderId: "222685278846",
  appId:       "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B"
};

// 5. Initialize App & Services
const app    = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth     = getAuth(app);

// 6. Reference to your top-level data node
export const appDataRef = dbRef(database, 'appData');

// 7. Re-export the DB helpers so other modules don’t need the SDK URLs
export { dbRef, dbSet, onValue };

// 8. Re-export Auth helpers for auth.js / api.js
export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
};
