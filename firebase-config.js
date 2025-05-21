// firebase-config.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";

const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "https://<YOUR_DB>.firebaseio.com",
  projectId: "...",
  // باقی فیلڈز
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}
