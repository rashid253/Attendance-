// firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  push,
  child,
  remove
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsx5pWhYGh1bJ9gL2bmC68gVc6EpICEzA",
  authDomain: "attandace-management.firebaseapp.com",
  databaseURL: "https://attandace-management-default-rtdb.firebaseio.com",
  projectId: "attandace-management",
  storageBucket: "attandace-management.firebasestorage.app",
  messagingSenderId: "222685278846",
  appId: "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B"
};

const app      = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth     = getAuth(app);

// We alias Firebase Realtime-DB functions to shorter names:
const dbRef     = ref;
const dbSet     = set;
const dbGet     = get;
const dbOnValue = onValue;
const dbPush    = push;
const dbChild   = child;
const dbRemove  = remove;

export {
  auth,
  database,
  dbRef,
  dbSet,
  dbGet,
  dbOnValue,
  dbPush,
  dbChild,
  dbRemove
};
