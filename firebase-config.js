// firebase-config.js
// ------------------
// Initialize Firebase and export references

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref as dbRef } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Your web app's Firebase configuration (replace with actual config)
const firebaseConfig = {
  apiKey: "AIzaSyBsx…EpICEzA",
  authDomain: "attandace-management.firebaseapp.com",
  projectId: "attandace-management",
  storageBucket: "attandace-management.appspot.com",
  messagingSenderId: "222685278846",
  appId: "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B",
  databaseURL: "https://attandace-management-default-rtdb.firebaseio.com",
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
export const database = getDatabase(firebaseApp);
export const auth = getAuth(firebaseApp);
export const usersRef = dbRef(database, "users");          // /users/{uid} → { name, role, schoolId, className }
export const schoolsRef = dbRef(database, "schools");      // /schools/{schoolId} → { name }
export const classesRef = dbRef(database, "classes");      // /classes/{schoolId}/{className} → { sections: [ "A", "B", ... ] }
export const appDataRef = dbRef(database, "appData");      // /appData/{uid} → { studentsByUser, attendanceByUser, paymentsByUser, lastAdmByUser, fineRates, eligibilityPct }
