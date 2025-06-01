// firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase }    from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
export const auth     = getAuth(app);
export const database = getDatabase(app);
