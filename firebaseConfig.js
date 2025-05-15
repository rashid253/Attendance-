// firebaseConfig.js

import { initializeApp } from "firebase/app";
import { getFirestore }   from "firebase/firestore";
import { getAuth }        from "firebase/auth";
import { getAnalytics }   from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBsx5pWhYGh1bJ9gL2bmC68gVc6EpICEzA",
  authDomain: "attandace-management.firebaseapp.com",
  projectId: "attandace-management",
  storageBucket: "attandace-management.firebasestorage.app",
  messagingSenderId: "222685278846",
  appId: "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B"
};

const app       = initializeApp(firebaseConfig);
const db        = getFirestore(app);
const auth      = getAuth(app);
const analytics = getAnalytics(app);

export { app, db, auth, analytics };
