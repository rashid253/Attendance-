// firebase-config.js

// 1. Firebase Core + Auth + Database کے CDN Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase }    from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// 2. اپنا Firebase Console سے ملا Configuration Paste کریں
const firebaseConfig = {
  apiKey: "AIzaSyBsx5pWhYGh1bJ9gL2bmC68gVc6EpICEzA",
  authDomain: "attandace-management.firebaseapp.com",
  databaseURL: "https://attandace-management-default-rtdb.firebaseio.com",
  projectId: "attandace-management",
  storageBucket: "attandace-management.appspot.com",
  messagingSenderId: "222685278846",
  appId: "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B"
};

// 3. Initialize Firebase App
const app = initializeApp(firebaseConfig);

// 4. Auth اور Database انسٹینسز حاصل کر کے Export کریں
export const auth     = getAuth(app);
export const database = getDatabase(app);
