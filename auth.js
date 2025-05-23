// auth.js

// Import necessary Firebase functions
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

import {
  getDatabase,
  ref as dbRef,
  set as dbSet
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Since app.js already initializes Firebase (initializeApp), just grab auth and database
const auth = getAuth();
const database = getDatabase();

/**
 * 1) LOGIN FLOW
 */
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
      // onAuthStateChanged listener in this file will handle redirection
    } catch (err) {
      errorDiv.textContent = err.message;
    }
  });
}

/**
 * 2) SIGN-UP FLOW
 */
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  const roleSelect = document.getElementById("roleSelect");
  const teacherFields = document.getElementById("teacherFields");

  // Show/hide teacher-specific fields
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

    // Simple password validation
    if (password !== confirmPassword) {
      errorDiv.textContent = "Passwords do not match.";
      return;
    }
    if (password.length < 6) {
      errorDiv.textContent = "Password must be at least 6 characters long.";
      return;
    }

    try {
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Set displayName to fullName
      await updateProfile(user, { displayName: fullName });

      // Send email verification
      await sendEmailVerification(user);

      // Write user record to Realtime Database under users/{uid}
      const uid = user.uid;
      const userData = {
        fullName,
        email,
        role,
        approved: false,             // Admin must later change this to true
        createdAt: new Date().toISOString()
      };

      // If the role is “teacher,” include school/class/section
      if (role === "teacher") {
        userData.school = document.getElementById("teacherSchool").value.trim();
        userData.cls = document.getElementById("teacherClass").value.trim();
        userData.section = document.getElementById("teacherSection").value.trim();
      }

      await dbSet(dbRef(database, `users/${uid}`), userData);

      alert("Sign-up successful! Please verify your email, then wait for admin approval.");
      await signOut(auth);
      window.location.href = "login.html";
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        errorDiv.textContent = "This email is already in use. Please use a different email.";
      } else {
        errorDiv.textContent = err.message;
      }
    }
  });
}

/**
 * 3) AUTH STATE LISTENER
 *
 * Once a user signs in (and email is verified + approved flag is set to true),
 * redirect them to index.html. Otherwise, show an appropriate alert and log out.
 */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Fetch this user’s data from Realtime Database
    const userRef = dbRef(database, `users/${user.uid}`);
    const snapshot = await userRef.get();
    if (!snapshot.exists()) {
      alert("No account data found. Please sign up again.");
      await signOut(auth);
      window.location.href = "login.html";
      return;
    }

    const userData = snapshot.val();

    // 1) Ensure email is verified
    if (!user.emailVerified) {
      alert("Please verify your email address before logging in.");
      await signOut(auth);
      window.location.href = "login.html";
      return;
    }

    // 2) Ensure admin has approved this account
    if (!userData.approved) {
      alert("Your account is not yet approved by the administrator. Please wait.");
      await signOut(auth);
      window.location.href = "login.html";
      return;
    }

    // 3) All good → Redirect to the main app
    // index.html contains your Attendance Management UI
    window.location.href = "index.html";
  } else {
    // No user is logged in
    // (If you’re already on login.html or signup.html, do nothing)
    console.log("No user logged in");
  }
});
