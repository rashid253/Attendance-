// app.js
// ------------------------------------------------------
// 1) Firebase initialization (Auth + Firestore)
// 2) Signup Wizard (Owner/Admin creates school, branches, classes, sections)
// 3) Login (Owner/Teacher) & auth-state listener
// 4) Owner Dashboard: view/edit school info, add teachers, view teacher list, counters
// 5) Teacher Dashboard: view assigned classes/sections, register students, mark attendance, counters
// ------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ----------------------
// 1. FIREBASE INITIALIZATION
// ----------------------
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_APIKEY",
  authDomain: "YOUR_FIREBASE_AUTHDOMAIN",
  projectId: "YOUR_FIREBASE_PROJECTID",
  storageBucket: "YOUR_FIREBASE_STORAGEBUCKET",
  messagingSenderId: "YOUR_FIREBASE_MSGSENDERID",
  appId: "YOUR_FIREBASE_APPID",
  measurementId: "YOUR_FIREBASE_MEASUREMENTID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ----------------------
// 2. SELECTORS
// ----------------------
const views = {
  signup: document.getElementById("signupContainer"),
  login: document.getElementById("loginContainer"),
  ownerDash: document.getElementById("ownerDashboard"),
  teacherDash: document.getElementById("teacherDashboard"),
};

const signupSteps = {
  step1: document.getElementById("signupStep1"),
  step2: document.getElementById("signupStep2"),
  step3: document.getElementById("signupStep3"),
  step4: document.getElementById("signupStep4"),
};

// Step1 fields
const ownerNameInput     = document.getElementById("ownerName");
const ownerEmailInput    = document.getElementById("ownerEmail");
const ownerPasswordInput = document.getElementById("ownerPassword");
const toStep2Btn         = document.getElementById("toStep2");
const backToStep1Btn     = document.getElementById("backToStep1");

// Step2 fields
const instituteNameInput = document.getElementById("instituteName");
const branchesContainer  = document.getElementById("branchesContainer");
const toStep3Btn         = document.getElementById("toStep3");
const backToStep2Btn     = document.getElementById("backToStep2");

// Step3 fields
const classesContainer   = document.getElementById("classesContainer");
const toStep4Btn         = document.getElementById("toStep4");
const backToStep3Btn     = document.getElementById("backToStep3");

// Step4 fields
const sectionsContainer  = document.getElementById("sectionsContainer");
const signupFinishBtn    = document.getElementById("signupFinish");

// Signup error display
const signupErrorP = document.getElementById("signupError");

// Login fields
const loginForm       = document.getElementById("loginForm");
const loginEmailInput = document.getElementById("loginEmail");
const loginPwdInput   = document.getElementById("loginPassword");
const loginErrorP     = document.getElementById("loginError");
const showSignupBtn   = document.getElementById("showSignup");

// Owner dashboard
const ownerDisplayName      = document.getElementById("ownerDisplayName");
const infoInstituteName     = document.getElementById("infoInstituteName");
const infoBranchesSpan      = document.getElementById("infoBranches");
const infoClassesSectionsUL = document.getElementById("infoClassesSections");
const addTeacherForm        = document.getElementById("addTeacherForm");
const teacherNameInput      = document.getElementById("teacherName");
const teacherEmailInput     = document.getElementById("teacherEmail");
const teacherPwdInput       = document.getElementById("teacherPassword");
const assignmentsContainer  = document.getElementById("assignmentsContainer");
const addAssignmentRowBtn   = document.getElementById("addAssignmentRow");
const addTeacherErrorP      = document.getElementById("addTeacherError");
const teacherTableBody      = document.querySelector("#teacherTable tbody");
const ownerBranchCountSpan  = document.getElementById("ownerBranchCount");
const ownerClassCountSpan   = document.getElementById("ownerClassCount");
const ownerTeacherCountSpan = document.getElementById("ownerTeacherCount");
const ownerStudentCountSpan = document.getElementById("ownerStudentCount");
const ownerLogoutBtn        = document.getElementById("ownerLogoutBtn");

// Teacher dashboard
const teacherDisplayName     = document.getElementById("teacherDisplayName");
const teacherAssignmentsDisp = document.getElementById("teacherAssignmentsDisplay");
const teacherStudentCount    = document.getElementById("teacherStudentCount");
const teacherAttendanceCount = document.getElementById("teacherAttendanceCount");
const teacherOutstandingCount= document.getElementById("teacherOutstandingCount");
const studentRegForm         = document.getElementById("studentRegForm");
const stuNameInput           = document.getElementById("stuName");
const stuAdmInput            = document.getElementById("stuAdm");
const stuParentInput         = document.getElementById("stuParent");
const stuContactInput        = document.getElementById("stuContact");
const stuAddressInput        = document.getElementById("stuAddress");
const studentTableBody       = document.querySelector("#studentTable tbody");
const attendanceDateInput    = document.getElementById("attendanceDate");
const loadAttendanceBtn      = document.getElementById("loadAttendance");
const attendanceListDiv      = document.getElementById("attendanceList");
const saveAttendanceBtn      = document.getElementById("saveAttendance");
const teacherLogoutBtn       = document.getElementById("teacherLogoutBtn");

// ----------------------
// 3. APPLICATION STATE
// ----------------------
let currentUser        = null;    // firebase.Auth user object
let currentProfile     = null;    // our Firestore “users/{uid}” doc data
let currentSchoolData  = null;    // Firestore “schools/{schoolId}” doc data
let signupData         = {
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  instituteName: "",
  branches: [],
  classes: [],
  sections: {}
};

// ----------------------
// 4. UTILITY FUNCTIONS
// ----------------------
function showView(viewEl) {
  Object.values(views).forEach(v => v.classList.add("hidden"));
  viewEl.classList.remove("hidden");
}
function showSignupStep(stepEl) {
  Object.values(signupSteps).forEach(s => s.classList.add("hidden"));
  stepEl.classList.remove("hidden");
}
function clearError(el) {
  el.textContent = "";
}
function showError(el, msg) {
  el.textContent = msg;
}

// Auto-expanding inputs:
// Whenever the last input in .auto-list is nonempty, clone a new blank input below it.
function setupAutoExpand(containerSelector) {
  containerSelector.addEventListener("input", (evt) => {
    const inputListDiv = evt.currentTarget.querySelector(".auto-list");
    const inputs = Array.from(inputListDiv.querySelectorAll(".auto-input"));
    const last = inputs[inputs.length - 1];
    if (last.value.trim() !== "") {
      const newInput = last.cloneNode();
      newInput.value = "";
      newInput.placeholder = last.placeholder;
      inputListDiv.appendChild(newInput);
    }
  });
}

// Remove trailing blank entries from an auto-list, return array of non-blank strings
function collectAutoList(containerDiv) {
  const inputs = Array.from(containerDiv.querySelectorAll(".auto-input"));
  return inputs.map(i => i.value.trim()).filter(v => v !== "");
}

// Clear all children of a DOM node
function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// ----------------------
// 5. SIGNUP WIZARD LOGIC
// ----------------------
toStep2Btn.addEventListener("click", () => {
  clearError(signupErrorP);
  const name  = ownerNameInput.value.trim();
  const email = ownerEmailInput.value.trim();
  const pwd   = ownerPasswordInput.value;
  if (!name || !email || !pwd) {
    showError(signupErrorP, "All fields are required.");
    return;
  }
  signupData.ownerName = name;
  signupData.ownerEmail = email;
  signupData.ownerPassword = pwd;
  showSignupStep(signupSteps.step2);
});

backToStep1Btn.addEventListener("click", () => {
  clearError(signupErrorP);
  showSignupStep(signupSteps.step1);
});

toStep3Btn.addEventListener("click", () => {
  clearError(signupErrorP);
  const inst = instituteNameInput.value.trim();
  const branches = collectAutoList(branchesContainer);
  if (!inst) {
    showError(signupErrorP, "Institute name is required.");
    return;
  }
  if (branches.length === 0) {
    showError(signupErrorP, "At least one branch is required.");
    return;
  }
  signupData.instituteName = inst;
  signupData.branches = branches;
  showSignupStep(signupSteps.step3);
});

backToStep2Btn.addEventListener("click", () => {
  clearError(signupErrorP);
  showSignupStep(signupSteps.step2);
});

toStep4Btn.addEventListener("click", () => {
  clearError(signupErrorP);
  const classes = collectAutoList(classesContainer);
  if (classes.length === 0) {
    showError(signupErrorP, "At least one class is required.");
    return;
  }
  signupData.classes = classes;
  // Build the UI blocks for sections per class
  clearChildren(sectionsContainer);
  signupData.sections = {};
  classes.forEach((cls) => {
    const wrapper = document.createElement("div");
    wrapper.className = "class‐section-block";
    wrapper.innerHTML = `
      <p><strong>${cls}</strong> – Sections:</p>
      <div class="auto-list">
        <input type="text" class="auto-input" placeholder="Section name (e.g. A)" required />
      </div>
    `;
    sectionsContainer.appendChild(wrapper);
    // Setup auto-expand in this block
    const autoListDiv = wrapper.querySelector(".auto-list");
    autoListDiv.addEventListener("input", (evt) => {
      const inputs = Array.from(evt.currentTarget.querySelectorAll(".auto-input"));
      const last = inputs[inputs.length - 1];
      if (last.value.trim() !== "") {
        const newInp = last.cloneNode();
        newInp.value = "";
        newInp.placeholder = last.placeholder;
        evt.currentTarget.appendChild(newInp);
      }
    });
  });
  showSignupStep(signupSteps.step4);
});

backToStep3Btn.addEventListener("click", () => {
  clearError(signupErrorP);
  showSignupStep(signupSteps.step3);
});

signupFinishBtn.addEventListener("click", async () => {
  clearError(signupErrorP);
  // Gather sections data
  const clsBlocks = Array.from(sectionsContainer.querySelectorAll(".class‐section-block"));
  let valid = true;
  clsBlocks.forEach(block => {
    const clsName = block.querySelector("p strong").textContent;
    const secs = Array.from(block.querySelectorAll(".auto-input"))
      .map(i => i.value.trim())
      .filter(v => v !== "");
    if (secs.length === 0) valid = false;
    signupData.sections[clsName] = secs;
  });
  if (!valid) {
    showError(signupErrorP, "Each class must have at least one section.");
    return;
  }

  // Now we have signupData fully populated
  // 1. Create Auth user (owner)
  try {
    const userCred = await createUserWithEmailAndPassword(
      auth,
      signupData.ownerEmail,
      signupData.ownerPassword
    );
    const uid = userCred.user.uid;

    // 2. Create Firestore docs: schools/{uid} and users/{uid}
    const schoolDocRef = doc(db, "schools", uid);
    await setDoc(schoolDocRef, {
      name: signupData.instituteName,
      branches: signupData.branches,
      classes: signupData.classes,
      sections: signupData.sections,
      createdAt: new Date()
    });

    const userDocRef = doc(db, "users", uid);
    await setDoc(userDocRef, {
      name: signupData.ownerName,
      email: signupData.ownerEmail,
      role: "owner",
      schoolId: uid,
      assigned: [],  // owner can view everything
      createdAt: new Date()
    });

    // Clear signup fields & show login
    ownerNameInput.value = "";
    ownerEmailInput.value = "";
    ownerPasswordInput.value = "";
    instituteNameInput.value = "";
    // Reset auto-lists
    clearChildren(branchesContainer.querySelector(".auto-list"));
    branchesContainer.querySelector(".auto-list").appendChild(
      document.createElement("input")
    );
    clearChildren(classesContainer.querySelector(".auto-list"));
    classesContainer.querySelector(".auto-list").appendChild(
      document.createElement("input")
    );
    clearChildren(sectionsContainer);

    showView(views.login);
    alert("Signup successful! Please log in.");
  } catch (err) {
    console.error(err);
    showError(signupErrorP, err.message);
  }
});

// Initialize auto-expanding on Step2 & Step3
setupAutoExpand(branchesContainer);
setupAutoExpand(classesContainer);

// Initially show Step1
showSignupStep(signupSteps.step1);

// Show signup when clicking “Don’t have an account?”
showSignupBtn.addEventListener("click", () => {
  clearError(loginErrorP);
  showView(views.signup);
  showSignupStep(signupSteps.step1);
});

// ----------------------
// 6. LOGIN FLOW
// ----------------------
loginForm.addEventListener("submit", async (evt) => {
  evt.preventDefault();
  clearError(loginErrorP);
  const email = loginEmailInput.value.trim();
  const pwd   = loginPwdInput.value;
  try {
    await signInWithEmailAndPassword(auth, email, pwd);
    loginEmailInput.value = "";
    loginPwdInput.value = "";
  } catch (err) {
    console.error(err);
    showError(loginErrorP, "Invalid credentials.");
  }
});

// ----------------------
// 7. AUTH STATE LISTENER
// ----------------------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    // Fetch user profile from Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) {
      // No profile? Log out
      await signOut(auth);
      return;
    }
    currentProfile = userDoc.data();
    const { role, schoolId, name } = currentProfile;

    // Fetch school data
    const schoolDoc = await getDoc(doc(db, "schools", schoolId));
    if (!schoolDoc.exists()) {
      await signOut(auth);
      return;
    }
    currentSchoolData = schoolDoc.data();
    currentSchoolData.id = schoolId; // attach ID

    if (role === "owner" || role === "admin") {
      // Show Owner Dashboard
      renderOwnerDashboard(name);
      showView(views.ownerDash);
    } else if (role === "teacher") {
      // Show Teacher Dashboard
      renderTeacherDashboard(name);
      showView(views.teacherDash);
    } else {
      // Other roles (staff) treated like teacher
      renderTeacherDashboard(name);
      showView(views.teacherDash);
    }
  } else {
    // Not logged in → show login
    renderLogoutViews();
    showView(views.login);
  }
});

// ----------------------
// 8. RENDER OWNER DASHBOARD
// ----------------------
async function renderOwnerDashboard(ownerName) {
  ownerDisplayName.textContent = ownerName;

  // Display institute info
  infoInstituteName.textContent = currentSchoolData.name;
  infoBranchesSpan.textContent = currentSchoolData.branches.join(", ");
  // Build classes & sections display
  clearChildren(infoClassesSectionsUL);
  currentSchoolData.classes.forEach(cls => {
    const li = document.createElement("li");
    li.textContent = `${cls}: ${currentSchoolData.sections[cls].join(", ")}`;
    infoClassesSectionsUL.appendChild(li);
  });

  // Populate teacher assignments “Add Teacher” form’s dropdowns
  rebuildAssignmentRows();

  // List existing teachers
  await loadTeacherList();

  // Update counters
  const branchCount = currentSchoolData.branches.length;
  const classCount  = currentSchoolData.classes.length;

  // Teachers count → query “users” where role==“teacher” && schoolId==currentSchoolData.id
  const teacherQ = query(
    collection(db, "users"),
    where("schoolId", "==", currentSchoolData.id),
    where("role", "==", "teacher")
  );
  const teacherSnap = await getDocs(teacherQ);
  const teacherCount = teacherSnap.size;

  // Students count → query subcollection “students” under schools/{schoolId}
  const studentColRef = collection(db, "schools", currentSchoolData.id, "students");
  const studentSnap = await getDocs(studentColRef);
  const studentCount = studentSnap.size;

  ownerBranchCountSpan.textContent  = branchCount;
  ownerClassCountSpan.textContent   = classCount;
  ownerTeacherCountSpan.textContent = teacherCount;
  ownerStudentCountSpan.textContent = studentCount;
}

// Build initial assignment row for “Add Teacher”
function rebuildAssignmentRows() {
  clearChildren(assignmentsContainer);
  addAssignmentRow(); // one default row
}

// Add a new “(Class, Section, [remove])” row
function addAssignmentRow() {
  const rowDiv = document.createElement("div");
  rowDiv.className = "assignment-row";

  const classSelect = document.createElement("select");
  classSelect.className = "class-select";
  currentSchoolData.classes.forEach(cls => {
    const opt = document.createElement("option");
    opt.value = cls;
    opt.textContent = cls;
    classSelect.appendChild(opt);
  });

  const sectionSelect = document.createElement("select");
  sectionSelect.className = "section-select";
  // populate based on initial class
  const firstCls = currentSchoolData.classes[0];
  currentSchoolData.sections[firstCls].forEach(sec => {
    const opt = document.createElement("option");
    opt.value = sec;
    opt.textContent = sec;
    sectionSelect.appendChild(opt);
  });

  // When classSelect changes, update sectionSelect options
  classSelect.addEventListener("change", () => {
    const cls = classSelect.value;
    clearChildren(sectionSelect);
    currentSchoolData.sections[cls].forEach(sec => {
      const opt = document.createElement("option");
      opt.value = sec;
      opt.textContent = sec;
      sectionSelect.appendChild(opt);
    });
  });

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "removeAssignment";
  removeBtn.innerHTML = `<i class="fas fa-trash"></i>`;
  removeBtn.addEventListener("click", () => {
    assignmentsContainer.removeChild(rowDiv);
  });

  rowDiv.appendChild(classSelect);
  rowDiv.appendChild(sectionSelect);
  rowDiv.appendChild(removeBtn);
  assignmentsContainer.appendChild(rowDiv);
}

// “Add Another Assignment” button
addAssignmentRowBtn.addEventListener("click", () => {
  addAssignmentRow();
});

// Handle “Create Teacher Account”
addTeacherForm.addEventListener("submit", async (evt) => {
  evt.preventDefault();
  clearError(addTeacherErrorP);
  const tName  = teacherNameInput.value.trim();
  const tEmail = teacherEmailInput.value.trim();
  const tPwd   = teacherPwdInput.value;
  if (!tName || !tEmail || !tPwd) {
    showError(addTeacherErrorP, "All fields are required.");
    return;
  }
  // Gather assignments
  const assignRows = Array.from(assignmentsContainer.querySelectorAll(".assignment-row"));
  const assignedArr = assignRows.map(row => {
    const cls = row.querySelector(".class-select").value;
    const sec = row.querySelector(".section-select").value;
    return { class: cls, section: sec };
  });
  if (assignedArr.length === 0) {
    showError(addTeacherErrorP, "Assign at least one (Class, Section).");
    return;
  }

  try {
    // 1) Create Auth user for teacher
    const teacherCred = await createUserWithEmailAndPassword(auth, tEmail, tPwd);
    const tUid = teacherCred.user.uid;
    // 2) Create Firestore doc: users/{tUid}
    await setDoc(doc(db, "users", tUid), {
      name: tName,
      email: tEmail,
      role: "teacher",
      schoolId: currentSchoolData.id,
      assigned: assignedArr,
      createdAt: new Date()
    });
    // 3) Clear form
    teacherNameInput.value = "";
    teacherEmailInput.value = "";
    teacherPwdInput.value = "";
    rebuildAssignmentRows();
    // 4) Reload teacher list & counters
    await loadTeacherList();
    const teacherQ2 = query(
      collection(db, "users"),
      where("schoolId", "==", currentSchoolData.id),
      where("role", "==", "teacher")
    );
    const teacherSnap2 = await getDocs(teacherQ2);
    ownerTeacherCountSpan.textContent = teacherSnap2.size;
  } catch (err) {
    console.error(err);
    showError(addTeacherErrorP, err.message);
  }
});

// Load and display all teachers for this school
async function loadTeacherList() {
  clearChildren(teacherTableBody);
  const q = query(
    collection(db, "users"),
    where("schoolId", "==", currentSchoolData.id),
    where("role", "==", "teacher")
  );
  const snap = await getDocs(q);
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const tr = document.createElement("tr");
    const assignedText = data.assigned
      .map(a => `${a.class}–${a.section}`)
      .join(", ");

    tr.innerHTML = `
      <td>${data.name}</td>
      <td>${data.email}</td>
      <td>${assignedText}</td>
      <td><button class="deleteTeacherBtn">Delete</button></td>
    `;
    // Attach delete handler
    tr.querySelector(".deleteTeacherBtn").addEventListener("click", async () => {
      if (!confirm(`Delete teacher ${data.name}?`)) return;
      try {
        // Delete Firestore user doc:
        await deleteDoc(doc(db, "users", docSnap.id));
        // Note: Deleting the Auth account itself requires a Cloud Function or manual step.
        await loadTeacherList();
        const teacherQ2 = query(
          collection(db, "users"),
          where("schoolId", "==", currentSchoolData.id),
          where("role", "==", "teacher")
        );
        const teacherSnap2 = await getDocs(teacherQ2);
        ownerTeacherCountSpan.textContent = teacherSnap2.size;
      } catch (err) {
        console.error(err);
      }
    });

    teacherTableBody.appendChild(tr);
  });
}

// Owner logout
ownerLogoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// ----------------------
// 9. RENDER TEACHER DASHBOARD
// ----------------------
async function renderTeacherDashboard(teacherName) {
  teacherDisplayName.textContent = teacherName;

  // Display teacher assignments
  const assignedList = currentProfile.assigned
    .map(a => `${a.class}–${a.section}`)
    .join(", ");
  teacherAssignmentsDisp.textContent = assignedList;

  // Count students (for all assigned Class/Sections)
  let stuCount = 0;
  for (const asn of currentProfile.assigned) {
    const q = query(
      collection(db, "schools", currentSchoolData.id, "students"),
      where("cls", "==", asn.class),
      where("sec", "==", asn.section)
    );
    const snap = await getDocs(q);
    stuCount += snap.size;
  }
  teacherStudentCount.textContent = stuCount;

  // Count attendance records (just total attendance docs for this school)
  const attCol = collection(db, "schools", currentSchoolData.id, "attendance");
  const attSnap = await getDocs(attCol);
  teacherAttendanceCount.textContent = attSnap.size;

  // Count outstanding fines (for simplicity, show 0)
  teacherOutstandingCount.textContent = 0;

  // Populate student table
  await loadTeacherStudentTable();
}

// Teacher logout
teacherLogoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// Load and display students assigned to this teacher
async function loadTeacherStudentTable() {
  clearChildren(studentTableBody);
  for (const asn of currentProfile.assigned) {
    const q = query(
      collection(db, "schools", currentSchoolData.id, "students"),
      where("cls", "==", asn.class),
      where("sec", "==", asn.section)
    );
    const snap = await getDocs(q);
    snap.forEach(stuDoc => {
      const d = stuDoc.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.adm}</td>
        <td>${d.name}</td>
        <td>${d.parent}</td>
        <td>${d.contact}</td>
        <td>${d.address}</td>
        <td>PKR 0</td>
        <td>Eligible</td>
        <td><button class="deleteStuBtn">Delete</button></td>
      `;
      tr.querySelector(".deleteStuBtn").addEventListener("click", async () => {
        if (!confirm(`Delete student ${d.name}?`)) return;
        await deleteDoc(doc(db, "schools", currentSchoolData.id, "students", stuDoc.id));
        await loadTeacherStudentTable();
      });
      studentTableBody.appendChild(tr);
    });
  }
}

// Handle student registration form
studentRegForm.addEventListener("submit", async (evt) => {
  evt.preventDefault();
  const name   = stuNameInput.value.trim();
  const adm    = stuAdmInput.value.trim();
  const parent = stuParentInput.value.trim();
  const contact= stuContactInput.value.trim();
  const address= stuAddressInput.value.trim();
  if (!name || !adm || !parent || !contact || !address) {
    alert("All student fields are required.");
    return;
  }

  // Assign the new student to the first (class, section) in teacher’s assigned list
  const asn = currentProfile.assigned[0];
  try {
    await setDoc(
      doc(db, "schools", currentSchoolData.id, "students", adm),
      {
        name,
        adm,
        parent,
        contact,
        address,
        cls: asn.class,
        sec: asn.section,
        createdAt: new Date()
      }
    );
    stuNameInput.value = "";
    stuAdmInput.value  = "";
    stuParentInput.value = "";
    stuContactInput.value= "";
    stuAddressInput.value= "";
    await loadTeacherStudentTable();
  } catch (err) {
    console.error(err);
  }
});

// Attendance loading & saving
loadAttendanceBtn.addEventListener("click", async () => {
  clearChildren(attendanceListDiv);
  attendanceListDiv.classList.remove("hidden");
  saveAttendanceBtn.classList.remove("hidden");

  const dateVal = attendanceDateInput.value;
  if (!dateVal) {
    alert("Select a date first.");
    return;
  }

  // Fetch all assigned students
  for (const asn of currentProfile.assigned) {
    const q = query(
      collection(db, "schools", currentSchoolData.id, "students"),
      where("cls", "==", asn.class),
      where("sec", "==", asn.section)
    );
    const snap = await getDocs(q);
    snap.forEach(stuDoc => {
      const d = stuDoc.data();
      const row = document.createElement("div");
      row.className = "att-row";
      row.innerHTML = `
        <p>${d.name} (${d.adm})</p>
        <button data-code="P">P</button>
        <button data-code="A">A</button>
        <button data-code="Lt">Lt</button>
        <button data-code="HD">HD</button>
        <button data-code="L">L</button>
      `;
      // Add click handlers
      row.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
          row.querySelectorAll("button").forEach(b => {
            b.classList.remove("selected");
            b.style.background = "";
            b.style.color = "";
          });
          btn.classList.add("selected");
          btn.style.background = {
            P: "var(--success)",
            A: "var(--danger)",
            Lt: "var(--warning)",
            HD: "#FF9800",
            L: "var(--info)"
          }[btn.dataset.code];
          btn.style.color = "#fff";
        });
      });
      attendanceListDiv.appendChild(row);
    });
  }
});

saveAttendanceBtn.addEventListener("click", async () => {
  const dateVal = attendanceDateInput.value;
  if (!dateVal) {
    alert("Select a date.");
    return;
  }
  const dataObj = {};
  const rows = Array.from(attendanceListDiv.querySelectorAll(".att-row"));
  for (const row of rows) {
    const nameAdm = row.querySelector("p").textContent; // "Name (Adm#)"
    const admMatch = nameAdm.match(/(\d+)/);
    const adm = admMatch ? admMatch[1] : null;
    const selectedBtn = row.querySelector("button.selected");
    dataObj[adm] = selectedBtn ? selectedBtn.dataset.code : "A";
  }
  // Save under /schools/{schoolId}/attendance/{dateVal}
  await setDoc(
    doc(db, "schools", currentSchoolData.id, "attendance", dateVal),
    { data: dataObj }
  );
  alert("Attendance saved.");
  attendanceListDiv.classList.add("hidden");
  saveAttendanceBtn.classList.add("hidden");
});

// ----------------------
// 10. LOGOUT & VIEW RESET
// ----------------------
function renderLogoutViews() {
  currentUser = null;
  currentProfile = null;
  currentSchoolData = null;
  showView(views.login);
}
