// admin.js

import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { 
  getDatabase, 
  ref as dbRef, 
  get as dbGet, 
  update as dbUpdate, 
  child as dbChild 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Because app.js already calls initializeApp, just grab auth and database:
const auth = getAuth();
const database = getDatabase();

// DOM elements
const pendingUsersTbody = document.querySelector("#pendingUsersTable tbody");
const userApprovalError = document.getElementById("userApprovalError");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

// 1) LOGOUT BUTTON HANDLER
adminLogoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

// 2) AUTH STATE LISTENER: Ensure only an approved “admin” sees this page
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // No one is logged in → send to login page
    window.location.href = "login.html";
    return;
  }

  // Fetch this user’s record from the database
  const userSnapshot = await dbGet(dbRef(database, `users/${user.uid}`));
  if (!userSnapshot.exists()) {
    alert("Account data not found. You must log in again.");
    await signOut(auth);
    window.location.href = "login.html";
    return;
  }

  const userData = userSnapshot.val();

  // Only allow if role === "admin" and approved === true
  if (userData.role !== "admin" || userData.approved !== true) {
    alert("Access denied. This page is for administrators only.");
    await signOut(auth);
    window.location.href = "login.html";
    return;
  }

  // At this point, an approved “admin” is logged in → load pending users
  loadPendingUsers();
});

// 3) FUNCTION: Load all users where approved === false
async function loadPendingUsers() {
  pendingUsersTbody.innerHTML = "";     // Clear any existing rows
  userApprovalError.textContent = "";   // Clear error message

  try {
    // Read every record under “users/”
    const usersSnapshot = await dbGet(dbRef(database, "users"));
    if (!usersSnapshot.exists()) {
      pendingUsersTbody.innerHTML = `
        <tr><td colspan="7" style="text-align: center;">No users found.</td></tr>
      `;
      return;
    }

    const usersObj = usersSnapshot.val();
    // Convert object to [uid, userData] pairs and filter approved === false
    const pendingEntries = Object.entries(usersObj)
      .filter(([, data]) => data.approved === false);

    if (pendingEntries.length === 0) {
      pendingUsersTbody.innerHTML = `
        <tr><td colspan="7" style="text-align: center;">No pending approvals.</td></tr>
      `;
      return;
    }

    // Build table rows
    pendingEntries.forEach(([uid, data], index) => {
      const tr = document.createElement("tr");

      // Format “Requested On” as a readable date/time
      const requestedOn = new Date(data.createdAt).toLocaleString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      });

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${data.fullName || "(no name)"}</td>
        <td>${data.email}</td>
        <td>${data.role}</td>
        <td>${data.school || "-"}</td>
        <td>${requestedOn}</td>
        <td>
          <button class="approveBtn" data-uid="${uid}">Approve</button>
          <button class="rejectBtn" data-uid="${uid}">Reject</button>
        </td>
      `;
      pendingUsersTbody.appendChild(tr);
    });

    // Attach event listeners to the newly created buttons:
    document.querySelectorAll(".approveBtn").forEach(btn => {
      btn.addEventListener("click", () => handleUserApproval(btn.dataset.uid, true));
    });
    document.querySelectorAll(".rejectBtn").forEach(btn => {
      btn.addEventListener("click", () => handleUserApproval(btn.dataset.uid, false));
    });

  } catch (error) {
    console.error("Error loading pending users:", error);
    userApprovalError.textContent = "Failed to load pending users. Check console for details.";
  }
}

// 4) FUNCTION: Approve or reject a single user
async function handleUserApproval(uid, isApproved) {
  try {
    if (isApproved) {
      // Set approved: true
      await dbUpdate(dbRef(database, `users/${uid}`), { approved: true });
    } else {
      // Option A: Simply leave approved false (no change), or set a “rejected” flag.
      // Option B: Delete the entire user record: 
      // await dbSet(dbRef(database, `users/${uid}`), null);
      // For now, we’ll keep them and leave approved = false.
    }
    // Reload the table so that this user disappears from the pending list
    loadPendingUsers();
  } catch (error) {
    console.error("Error updating user approval:", error);
    userApprovalError.textContent = "Failed to update approval. Check console for details.";
  }
}
