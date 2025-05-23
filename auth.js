// auth.js

// 1) Firebase Auth اور Database کے functions امپورٹ کریں
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         onAuthStateChanged, updateProfile, sendEmailVerification, signOut }
  from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

import { getDatabase, ref as dbRef, set as dbSet }
  from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// چونکہ app.js پہلے ہی initializeApp چلا چکا ہے، ہم یہاں auth اور database لے لیں:
const auth = getAuth();
const database = getDatabase();

// ---------------------------------------
// 1) لاگ اِن (Login) کا کوڈ
// ---------------------------------------
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errorDiv = document.getElementById("loginError");
    errorDiv.textContent = "";

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // کامیاب لاگ ان پر، onAuthStateChanged کال بیک اگلے مرحلے میں ہینڈل کرے گا۔
    } catch (err) {
      errorDiv.textContent = err.message;
    }
  });
}

// ---------------------------------------
// 2) سائن اپ (Signup) کا کوڈ
// ---------------------------------------
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  const roleSelect = document.getElementById("roleSelect");
  const teacherFields = document.getElementById("teacherFields");

  // اگر Teacher منتخب ہو، تو اسکول/کلاس/سیکشن والے فیلڈز ظاہر کریں:
  roleSelect.addEventListener("change", () => {
    if (roleSelect.value === "teacher") {
      teacherFields.classList.remove("hidden");
      document.getElementById("teacherSchool").required = true;
      document.getElementById("teacherClass").required = true;
      document.getElementById("teacherSection").required = true;
    } else {
      teacherFields.classList.add("hidden");
      document.getElementById("teacherSchool").required = false;
      document.getElementById("teacherClass").required = false;
      document.getElementById("teacherSection").required = false;
    }
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const role = roleSelect.value;
    const errorDiv = document.getElementById("signupError");
    errorDiv.textContent = "";

    // پاس ورڈ میچ چیک کریں
    if (password !== confirmPassword) {
      errorDiv.textContent = "پاس ورڈ میل نہیں کھاتے۔";
      return;
    }
    if (password.length < 6) {
      errorDiv.textContent = "پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے۔";
      return;
    }

    try {
      // Firebase Auth میں نیا یوزر بنائیں
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // displayName سیٹ کریں
      await updateProfile(user, { displayName: fullName });

      // Email Verification بھیج دیں
      await sendEmailVerification(user);

      // Realtime Database میں `users/{uid}` پر یوزر کا ڈیٹا لکھیں (approval کے لیے پیشگی فیلڈ)
      const uid = user.uid;
      const userData = {
        fullName,
        email,
        role,
        approved: false,           // ابھی منظوری نہیں (بعد میں Admin کرے گا)
        createdAt: new Date().toISOString()
      };
      if (role === "teacher") {
        userData.school = document.getElementById("teacherSchool").value.trim();
        userData.cls = document.getElementById("teacherClass").value.trim();
        userData.section = document.getElementById("teacherSection").value.trim();
      }
      await dbSet(dbRef(database, `users/${uid}`), userData);

      alert("سائن اپ کامیاب! براہ کرم اپنی ای میل کی تصدیق کریں اور منتظم کی منظوری کا انتظار کریں۔");
      await signOut(auth);
      window.location.href = "login.html";
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        errorDiv.textContent = "یہ ای میل پہلے سے استعمال میں ہے۔ براہِ کرم دوسرا ای میل استعمال کریں۔";
      } else {
        errorDiv.textContent = err.message;
      }
    }
  });
}

// ---------------------------------------
// 3) onAuthStateChanged (آگے استعمال کے لیے بنیاد)
// ---------------------------------------
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("User logged in:", user.email);
    // اگلے مرحلے میں ہم `approved` چیک کر کے redirect کریں گے
  } else {
    console.log("No user logged in");
  }
});
