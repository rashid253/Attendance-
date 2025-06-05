// firebase-config.js
// ------------------
// Initializes Firebase (Auth + Realtime Database) using the same config
// that was previously embedded in app.js. Exports `auth` and `db` so that
// other modules (auth.js, app.js, setup.js) can import these and avoid
// re-declaring the config inline.

// 1. Import Firebase core and products
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// 2. Paste the exact firebaseConfig object from your original app.js
//    (Replace if these values ever change in your Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyBsx…EpICEzA",
  authDomain: "attandace-management.firebaseapp.com",
  projectId: "attandace-management",
  storageBucket: "attandace-management.appspot.com",
  messagingSenderId: "222685278846",
  appId: "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B",
  databaseURL: "https://attandace-management-default-rtdb.firebaseio.com"
};

// 3. Initialize the Firebase App
const app = initializeApp(firebaseConfig);

// 4. Initialize and export Realtime Database and Auth
const db = getDatabase(app);
const auth = getAuth(app);

export { auth, db };
