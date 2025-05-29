// admin.js

// 1) Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  onValue,
  update as dbUpdate,
  get as dbGet
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// --------------------------------------------------------------
// 2) Firebase Configuration (copy from your existing app.js)
// --------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBsx…EpICEzA",
  authDomain: "attandace-management.firebaseapp.com",
  projectId: "attandace-management",
  storageBucket: "attandace-management.appspot.com",
  messagingSenderId: "222685278846",
  appId: "1:222685278846:web:aa3e37a42b76befb6f5e2f",
  measurementId: "G-V2MY85R73B",
  databaseURL: "https://attandace-management-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// --------------------------------------------------------------
// 3) Globals to hold data
// --------------------------------------------------------------
let allSchools = [];   // [ { id: "...", name: "..." }, ... ]
let allRequests = {};  // { requestId: { teacherName, teacherEmail, schoolId, className, sectionName, status, requestedAt, ... } }

// --------------------------------------------------------------
// 4) Load all schools once (so we can show names instead of IDs)
// --------------------------------------------------------------
async function loadAllSchools() {
  const snap = await dbGet(dbRef(database, "schools"));
  allSchools = [];
  if (snap.exists()) {
    snap.forEach(childSnap => {
      allSchools.push({ id: childSnap.key, name: childSnap.val().name });
    });
  }
  populateSchoolFilterDropdown();
}

// Populate “All Schools” filter dropdown
function populateSchoolFilterDropdown() {
  const filterEl = document.getElementById("filterSchool");
  filterEl.innerHTML = '<option value="">All Schools</option>';
  allSchools.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    filterEl.appendChild(opt);
  });
}

// --------------------------------------------------------------
// 5) Listen for changes under “requests/” and re-render table
// --------------------------------------------------------------
function listenForRequests() {
  const reqRef = dbRef(database, "requests");
  onValue(reqRef, snapshot => {
    allRequests = snapshot.exists() ? snapshot.val() : {};
    renderRequestsTable();
  });
}

// --------------------------------------------------------------
// 6) Render the requests table, applying any filters
// --------------------------------------------------------------
function renderRequestsTable() {
  const tbody = document.querySelector("#requestsTable tbody");
  tbody.innerHTML = "";

  const filterSchool = document.getElementById("filterSchool").value;
  const filterStatus = document.getElementById("filterStatus").value;

  // Loop through each request in allRequests
  for (let reqId in allRequests) {
    const req = allRequests[reqId];

    // Apply filters (if a filter value is set, skip non-matching requests)
    if (filterSchool && req.schoolId !== filterSchool) continue;
    if (filterStatus && req.status !== filterStatus) continue;

    // Determine school name from allSchools
    const schoolObj = allSchools.find(s => s.id === req.schoolId);
    const schoolName = schoolObj ? schoolObj.name : req.schoolId;

    // Build a table row
    const tr = document.createElement("tr");

    // Teacher Name
    const tdName = document.createElement("td");
    tdName.textContent = req.teacherName;
    tr.appendChild(tdName);

    // Email
    const tdEmail = document.createElement("td");
    tdEmail.textContent = req.teacherEmail;
    tr.appendChild(tdEmail);

    // School
    const tdSchool = document.createElement("td");
    tdSchool.textContent = schoolName;
    tr.appendChild(tdSchool);

    // Class
    const tdClass = document.createElement("td");
    tdClass.textContent = req.className;
    tr.appendChild(tdClass);

    // Section
    const tdSection = document.createElement("td");
    tdSection.textContent = req.sectionName;
    tr.appendChild(tdSection);

    // Requested At (formatted)
    const tdRequestedAt = document.createElement("td");
    const dateObj = new Date(req.requestedAt);
    tdRequestedAt.textContent = dateObj.toLocaleString("en-US");
    tr.appendChild(tdRequestedAt);

    // Status
    const tdStatus = document.createElement("td");
    tdStatus.textContent = req.status;
    tr.appendChild(tdStatus);

    // Actions
    const tdActions = document.createElement("td");
    tdActions.classList.add("text-center");

    // If the request is still pending, show Accept & Reject buttons
    if (req.status === "pending") {
      const btnAccept = document.createElement("button");
      btnAccept.className = "btn btn-sm btn-success action-btn";
      btnAccept.innerHTML = '<i class="fas fa-check"></i>';
      btnAccept.title = "Accept";
      btnAccept.onclick = () => handleAcceptRequest(reqId, req);
      tdActions.appendChild(btnAccept);

      const btnReject = document.createElement("button");
      btnReject.className = "btn btn-sm btn-danger action-btn";
      btnReject.innerHTML = '<i class="fas fa-times"></i>';
      btnReject.title = "Reject";
      btnReject.onclick = () => handleRejectRequest(reqId);
      tdActions.appendChild(btnReject);
    }

    // If not already blocked, show a Block button
    if (req.status !== "blocked") {
      const btnBlock = document.createElement("button");
      btnBlock.className = "btn btn-sm btn-warning action-btn";
      btnBlock.innerHTML = '<i class="fas fa-ban"></i>';
      btnBlock.title = "Block";
      btnBlock.onclick = () => handleBlockRequest(reqId);
      tdActions.appendChild(btnBlock);
    }

    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  }
}

// --------------------------------------------------------------
// 7) Handle “Accept” action: generate a new teacher key
// --------------------------------------------------------------
async function handleAcceptRequest(reqId, reqData) {
  try {
    // 7.1 Generate a unique key string, e.g. "TCHR-<timestamp>-<random>"
    const randomStr = Math.random().toString(36).substr(2, 5).toUpperCase();
    const newKey = `TCHR-${Date.now()}-${randomStr}`;

    // 7.2 Write under teachers/{newKey}
    await dbUpdate(dbRef(database, `teachers/${newKey}`), {
      schoolId:    reqData.schoolId,
      className:   reqData.className,
      sectionName: reqData.sectionName,
      isActive:    true
    });

    // 7.3 Update the request’s status to “accepted” + attach the teacherKey
    await dbUpdate(dbRef(database, `requests/${reqId}`), {
      status:     "accepted",
      teacherKey: newKey,
      processedAt: Date.now()
    });

    alert(`Request accepted.\nGenerated Key:\n${newKey}\n\nShare this with the teacher.`);
  } catch (err) {
    console.error("Error accepting request:", err);
    alert("Could not accept the request. Try again.");
  }
}

// --------------------------------------------------------------
// 8) Handle “Reject” action: set status = "rejected"
// --------------------------------------------------------------
async function handleRejectRequest(reqId) {
  try {
    await dbUpdate(dbRef(database, `requests/${reqId}`), {
      status:      "rejected",
      processedAt: Date.now()
    });
    alert("Request has been rejected.");
  } catch (err) {
    console.error("Error rejecting request:", err);
    alert("Could not reject the request. Try again.");
  }
}

// --------------------------------------------------------------
// 9) Handle “Block” action: set status = "blocked"
// --------------------------------------------------------------
async function handleBlockRequest(reqId) {
  try {
    await dbUpdate(dbRef(database, `requests/${reqId}`), {
      status:      "blocked",
      processedAt: Date.now()
    });
    alert("Request has been blocked.");
  } catch (err) {
    console.error("Error blocking request:", err);
    alert("Could not block the request. Try again.");
  }
}

// --------------------------------------------------------------
// 10) Filter button event: re-render the table with new filters
// --------------------------------------------------------------
document.getElementById("btnFilterRequests").addEventListener("click", () => {
  renderRequestsTable();
});

// --------------------------------------------------------------
// 11) Initialize admin panel: load schools, then listen for requests
// --------------------------------------------------------------
(async function initAdminPanel() {
  await loadAllSchools();
  listenForRequests();
})();
