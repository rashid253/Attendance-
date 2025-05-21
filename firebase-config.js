// firebase-config.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";

// Firebase configuration — replace only if yours is different
const firebaseConfig = {
  apiKey: "AIzaSyBsx…EpICEzA",
  authDomain: "attandace-management.firebaseapp.com",
  databaseURL: "https://attandace-management-default-rtdb.firebaseio.com",
  projectId: "attandace-management",
  storageBucket: "attandace-management.appspot.com",
  messagingSenderId: "222685278846",
  appId: "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B"
};

// Prevent duplicate initialization
if (!getApps().length) {
  initializeApp(firebaseConfig);
}
