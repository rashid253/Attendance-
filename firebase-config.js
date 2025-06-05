// firebase-config.js
// ------------------
// Initializes Firebase (Auth + Realtime Database).
// Export `auth` and `db` for use in other modules.

// 1. Import Firebase core and products
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// 2. Your Firebase project’s configuration
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXX-abcdefghijklmnopqrstuvwxyz",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456",
  databaseURL: "https://your-project-id-default-rtdb.firebaseio.com"
};

// 3. Initialize the Firebase App
const app = initializeApp(firebaseConfig);

// 4. Initialize and export Realtime Database and Auth
const db = getDatabase(app);
const auth = getAuth(app);

export { auth, db };
