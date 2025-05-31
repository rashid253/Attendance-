// app.js (fully self-contained: embeds initialData, avoids fetch errors, and matches index.html IDs)
// -------------------------------------------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref as dbRef,
  set as dbSet,
  get as dbGet,
  onValue,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// IndexedDB helpers (idb-keyval IIFE must be loaded in your HTML before this script)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// ----------------------
// Embed initialData directly to avoid fetch errors
// ----------------------
const initialData = {
  "Users": {
    "admin_master": {
      "role": "admin"
    },
    "principal_alpha_school": {
      "role": "principal",
      "school": "Alpha School"
    },
    "teacher_alpha_school": {
      "role": "teacher",
      "school": "Alpha School",
      "class": "Class One",
      "section": "A"
    },
    "principal_beta_school": {
      "role": "principal",
      "school": "Beta School"
    },
    "teacher_beta_school": {
      "role": "teacher",
      "school": "Beta School",
      "class": "Class Two",
      "section": "B"
    },
    "principal_gamma_school": {
      "role": "principal",
      "school": "Gamma School"
    },
    "teacher_gamma_school": {
      "role": "teacher",
      "school": "Gamma School",
      "class": "Class Three",
      "section": "C"
    },
    "principal_delta_school": {
      "role": "principal",
      "school": "Delta School"
    },
    "teacher_delta_school": {
      "role": "teacher",
      "school": "Delta School",
      "class": "Nursery",
      "section": "A"
    },
    "principal_epsilon_school": {
      "role": "principal",
      "school": "Epsilon School"
    },
    "teacher_epsilon_school": {
      "role": "teacher",
      "school": "Epsilon School",
      "class": "KG",
      "section": "B"
    },
    "principal_zeta_school": {
      "role": "principal",
      "school": "Zeta School"
    },
    "teacher_zeta_school": {
      "role": "teacher",
      "school": "Zeta School",
      "class": "Class Four",
      "section": "C"
    },
    "principal_eta_school": {
      "role": "principal",
      "school": "Eta School"
    },
    "teacher_eta_school": {
      "role": "teacher",
      "school": "Eta School",
      "class": "Class Five",
      "section": "A"
    },
    "principal_theta_school": {
      "role": "principal",
      "school": "Theta School"
    },
    "teacher_theta_school": {
      "role": "teacher",
      "school": "Theta School",
      "class": "Class Six",
      "section": "B"
    },
    "principal_iota_school": {
      "role": "principal",
      "school": "Iota School"
    },
    "teacher_iota_school": {
      "role": "teacher",
      "school": "Iota School",
      "class": "Class Seven",
      "section": "C"
    },
    "principal_kappa_school": {
      "role": "principal",
      "school": "Kappa School"
    },
    "teacher_kappa_school": {
      "role": "teacher",
      "school": "Kappa School",
      "class": "Class Eight",
      "section": "A"
    },
    "principal_lambda_school": {
      "role": "principal",
      "school": "Lambda School"
    },
    "teacher_lambda_school": {
      "role": "teacher",
      "school": "Lambda School",
      "class": "Class Nine",
      "section": "B"
    },
    "principal_mu_school": {
      "role": "principal",
      "school": "Mu School"
    },
    "teacher_mu_school": {
      "role": "teacher",
      "school": "Mu School",
      "class": "Class Ten",
      "section": "C"
    },
    "principal_nu_school": {
      "role": "principal",
      "school": "Nu School"
    },
    "teacher_nu_school": {
      "role": "teacher",
      "school": "Nu School",
      "class": "Play Group",
      "section": "A"
    },
    "principal_xi_school": {
      "role": "principal",
      "school": "Xi School"
    },
    "teacher_xi_school": {
      "role": "teacher",
      "school": "Xi School",
      "class": "Nursery",
      "section": "B"
    },
    "principal_omicron_school": {
      "role": "principal",
      "school": "Omicron School"
    },
    "teacher_omicron_school": {
      "role": "teacher",
      "school": "Omicron School",
      "class": "KG",
      "section": "C"
    }
  },
  "Schools": {
    "Alpha School": {
      "classes": {
        "Play Group": ["A", "B", "C"],
        "Nursery": ["A", "B", "C"],
        "KG": ["A", "B", "C"],
        "Class One": ["A", "B", "C"],
        "Class Two": ["A", "B", "C"],
        "Class Three": ["A", "B", "C"],
        "Class Four": ["A", "B", "C"],
        "Class Five": ["A", "B", "C"],
        "Class Six": ["A", "B", "C"],
        "Class Seven": ["A", "B", "C"],
        "Class Eight": ["A", "B", "C"],
        "Class Nine": ["A", "B", "C"],
        "Class Ten": ["A", "B", "C"]
      },
      "principal": "principal_alpha_school",
      "teachers": {
        "teacher_alpha_school": {
          "class": "Class One",
          "section": "A"
        }
      }
    },
    "Beta School": {
      "classes": {
        "Play Group": ["A", "B", "C"],
        "Nursery": ["A", "B", "C"],
        "KG": ["A", "B", "C"],
        "Class One": ["A", "B", "C"],
        "Class Two": ["A", "B", "C"],
        "Class Three": ["A", "B", "C"],
        "Class Four": ["A", "B", "C"],
        "Class Five": ["A", "B", "C"],
        "Class Six": ["A", "B", "C"],
        "Class Seven": ["A", "B", "C"],
        "Class Eight": ["A", "B", "C"],
        "Class Nine": ["A", "B", "C"],
        "Class Ten": ["A", "B", "C"]
      },
      "principal": "principal_beta_school",
      "teachers": {
        "teacher_beta_school": {
          "class": "Class Two",
          "section": "B"
        }
      }
    },
    "Gamma School": {
      "classes": {
        "Play Group": ["A", "B", "C"],
        "Nursery": ["A", "B", "C"],
        "KG": ["A", "B", "C"],
        "Class One": ["A", "B", "C"],
        "Class Two": ["A", "B", "C"],
        "Class Three": ["A", "B", "C"],
        "Class Four": ["A", "B", "C"],
        "Class Five": ["A", "B", "C"],
        "Class Six": ["A", "B", "C"],
        "Class Seven": ["A", "B", "C"],
        "Class Eight": ["A", "B", "C"],
        "Class Nine": ["A", "B", "C"],
        "Class Ten": ["A", "B", "C"]
      },
      "principal": "principal_gamma_school",
      "teachers": {
        "teacher_gamma_school": {
          "class": "Class Three",
          "section": "C"
        }
      }
    },
    "Delta School": {
      "classes": {
        "Play Group": ["A", "B", "C"],
        "Nursery": ["A", "B", "C"],
        "KG": ["A", "B", "C"],
        "Class One": ["A", "B", "C"],
        "Class Two": ["A", "B", "C"],
        "Class Three": ["A", "B", "C"],
        "Class Four": ["A", "B", "C"],
        "Class Five": ["A", "B", "C"],
        "Class Six": ["A", "B", "C"],
        "Class Seven": ["A", "B", "C"],
        "Class Eight": ["A", "B", "C"],
        "Class Nine": ["A", "B", "C"],
        "Class Ten": ["A", "B", "C"]
      },
      "principal": "principal_delta_school",
      "teachers": {
        "teacher_delta_school": {
          "class": "Nursery",
          "section": "A"
        }
      }
    },
    "Epsilon School": {
      "classes": {
        "Play Group": ["A", "B", "C"],
        "Nursery": ["A", "B", "C"],
        "KG": ["A", "B", "C"],
        "Class One": ["A", "B", "C"],
        "Class Two": ["A", "B", "C"],
        "Class Three": ["A", "B", "C"],
        "Class Four": ["A", "B", "C"],
        "Class Five": ["A", "B", "C"],
        "Class Six": ["A", "B", "C"],
        "Class Seven": ["A", "B", "C"],
        "Class Eight": ["A", "B", "C"],
        "Class Nine": ["A", "B", "C"],
        "Class Ten": ["A", "B", "C"]
      },
      "principal": "principal_epsilon_school",
      "teachers": {
        "teacher_epsilon_school": {
          "class": "KG",
          "section": "B"
        }
      }
    },
    "Zeta School": {
      "classes": {
        "Play Group": ["A", "B", "C"],
        "Nursery": ["A", "B", "C"],
        "KG": ["A", "B", "C"],
        "Class One": ["A", "B", "C"],
        "Class Two": ["A", "B", "C"],
        "Class Three": ["A", "B", "C"],
        "Class Four": ["A", "B", "C"],
        "Class Five": ["A", "B", "C"],
        "Class Six": ["A", "B", "C"],
        "Class Seven": ["A", "B", "C"],
        "Class Eight": ["A", "B", "C"],
        "Class Nine": ["A", "B", "C"],
        "Class Ten": ["A", "B", "C"]
      },
      "principal": "principal_zeta_school",
      "teachers": {
        "teacher_zeta_school": {
          "class": "Class Four",
          "section": "C"
        }
      }
    },
    "Eta School": {
      "classes": {
        "Play Group": ["A", "B", "C"],
        "Nursery": ["A", "B", "C"],
        "KG": ["A", "B", "C"],
        "Class One": ["A", "B", "C"],
        "Class Two": ["A", "B", "C"],
        "Class Three": ["A", "B", "C"],
        "Class Four": ["A", "B", "C"],
        "Class Five": ["A", "B", "C"],
        "Class Six": ["A", "B", "C"],
        "Class Seven": ["A", "B", "C"],
        "Class Eight": ["A", "B", "C"],
        "Class Nine": ["A", "B", "C"],
        "Class Ten": ["A", "B", "C"]
      },
      "principal": "principal_eta_school",
      "teachers": {
        "teacher_eta_school": {
          "class": "Class Five",
          "section": "A"
        }
      }
    },
    "Theta School": {
      "classes": {
        "Play Group": ["A", "B", "C"],
        "Nursery": ["A", "B", "C"],
        "KG": ["A", "B", "C"],
        "Class One": ["A", "B", "C"],
        "Class Two": ["A", "B", "C"],
        "Class Three": ["A", "B", "C"],
        "Class Four": ["A", "B", "C"],
        "Class Five": ["A", "B", "C"],
        "Class Six": ["A", "B", "C"],
        "Class Seven": ["A", "B", "C"],
        "Class Eight": ["A", "B", "C"],
        "Class Nine": ["A", "B", "C"],
        "Class Ten": ["A", "B", "C"]
      },
      "principal": "principal_theta_school",
      "teachers": {
        "teacher_theta_school": {
          "class": "Class Six",
          "section": "B"
        }
      }
    },
    "Iota School": {
      "classes": {
        "Play Group": ["A", "B", "C"],
        "Nursery": ["A", "B", "C"],
        "KG": ["A", "B", "C"],
        "Class One": ["A", "B", "C"],
        "Class Two": ["A", "B", "C"],
        "Class Three": ["A", "B", "C"],
        "Class Four": ["A", "B", "C"],
        "Class Five": ["A", "B", "C"],
        "Class Six": ["A", "B", "C"],
        "Class Seven": ["A", "B", "C"],
        "Class Eight": ["A", "B", "C"],
        "Class Nine": ["A", "B", "C"],
        "Class Ten": ["A", "B", "C"]
      },
      "principal": "principal_iota_school",
      "teachers": {
        "teacher_iota_school": {
          "class": "Class Seven",
          "section": "C"
        }
      }
    },
    "Kappa School": {
      "classes": {
        "Play Group": ["A", "B", "C"],
        "Nursery": ["A", "B", "C"],
        "KG": ["A", "B", "C"],
        "Class One": ["A", "B", "C"],
        "Class Two": ["A", "B", "C"],
        "Class Three": ["A", "B", "C"],
        "Class Four": ["A", "B", "C"],
        "Class Five": ["A", "B", "C"],
        "Class Six": ["A", "B", "C"],
        "Class Seven": ["A", "B", "C"],
        "Class Eight": ["A", "B", "C"],
        "Class Nine": ["A", "B", "C"],
        "Class Ten": ["A", "B", "C"]
      },
      "principal": "principal_kappa_school",
      "teachers": {
        "teacher_kappa_school": {
          "class": "Class Eight",
          "section": "A"
        }
      }
    },
    "Lambda School": {
      "classes": {
        "Play Group": ["A", "B", "C"],
        "Nursery": ["A", "B", "C"],
        "KG": ["A", "B", "C"],
        "Class One": ["A", "B", "C"],
        "Class Two": ["A", "B", "C"],
        "Class Three": ["A", "B", "C"],
        "Class Four": ["A", "B", "C"],
        "Class Five": ["A", "B", "C"],
        "Class Six": ["A", "B", "C"],
        "Class Seven": ["A", "B", "C"],
        "Class Eight": ["A", "B", "C"],
        "Class Nine": ["A", "B", "C"],
        "Class Ten": ["A", "B", "C"]
      },
      "principal": "principal_lambda_school",
      "teachers": {
        "teacher_lambda_school": {
          "class": "Class Nine",
          "section": "B"
        }
      }
    },
    "Mu School": {
      "classes": {
        "Play Group": ["A", "B", "C"],
        "Nursery": ["A", "B", "C"],
        "KG": ["A", "B", "C"],
        "Class One": ["A", "B", "C"],
        "Class Two": ["A", "B", "C"],
        "Class Three": ["A", "B", "C"],
        "Class Four": ["A", "B", "C"],
        "Class Five": ["A", "B", "C"],
        "Class Six": ["A", "B", "C"],
        "Class Seven": ["A", "B", "C"],
        "Class Eight": ["A", "B", "C"],
        "Class Nine": ["A", "B", "C"],
        "Class Ten": ["A", "B", "C"]
      },
      "principal": "principal_mu_school",
      "teachers": {
        "teacher_mu_school": {
          "class": "Class Ten",
          "section": "C"
        }
      }
    },
    "Nu School": {
      "classes": {
        "Play Group": ["A", "B", "C"],
        "Nursery": ["A", "B", "C"],
        "KG": ["A", "B", "C"],
        "Class One": ["A", "B", "C"],
        "Class Two": ["A", "B", "C"],
        "Class Three": ["A", "B", "C"],
        "Class Four": ["A", "B", "C"],
        "Class Five": ["A", "B", "C"],
        "Class Six": ["A", "B", "C"],
        "Class Seven": ["A", "B", "C"],
        "Class Eight": ["A", "B", "C"],
        "Class Nine": ["A", "B", "C"],
        "Class Ten": ["A", "B", "C"]
      },
      "principal": "principal_nu_school",
      "teachers": {
        "teacher_nu_school": {
          "class": "Play Group",
          "section": "A"
        }
      }
    },
    "Xi School": {
      "classes": {
        "Play Group": ["A", "B", "C"],
        "Nursery": ["A", "B", "C"],
        "KG": ["A", "B", "C"],
        "Class One": ["A", "B", "C"],
        "Class Two": ["A", "B", "C"],
        "Class Three": ["A", "B", "C"],
        "Class Four": ["A", "B", "C"],
        "Class Five": ["A", "B", "C"],
        "Class Six": ["A", "B", "C"],
        "Class Seven": ["A", "B", "C"],
        "Class Eight": ["A", "B", "C"],
        "Class Nine": ["A", "B", "C"],
        "Class Ten": ["A", "B", "C"]
      },
      "principal": "principal_xi_school",
      "teachers": {
        "teacher_xi_school": {
          "class": "Nursery",
          "section": "B"
        }
      }
    },
    "Omicron School": {
      "classes": {
        "Play Group": ["A", "B", "C"],
        "Nursery": ["A", "B", "C"],
        "KG": ["A", "B", "C"],
        "Class One": ["A", "B", "C"],
        "Class Two": ["A", "B", "C"],
        "Class Three": ["A", "B", "C"],
        "Class Four": ["A", "B", "C"],
        "Class Five": ["A", "B", "C"],
        "Class Six": ["A", "B", "C"],
        "Class Seven": ["A", "B", "C"],
        "Class Eight": ["A", "B", "C"],
        "Class Nine": ["A", "B", "C"],
        "Class Ten": ["A", "B", "C"]
      },
      "principal": "principal_omicron_school",
      "teachers": {
        "teacher_omicron_school": {
          "class": "KG",
          "section": "C"
        }
      }
    }
  }
};

// ----------------------
// Firebase configuration (replace with your actual config)
// ----------------------
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

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const appDataRef = dbRef(database, "appData");

// ----------------------
// Utility: document.getElementById shortcut
// ----------------------
function $(id) {
  return document.getElementById(id);
}

// ----------------------
// Local application state (per-school mappings)
// ----------------------
let studentsBySchool       = {}; // { schoolName: [ { name, adm, parent, contact, occupation, address, cls, sec, fine, status } ] }
let attendanceDataBySchool = {}; // { schoolName: { "YYYY-MM-DD": { adm: "P"/"A"/"Lt"/... } } }
let paymentsDataBySchool   = {}; // { schoolName: { adm: [ { date: "YYYY-MM-DD", amount: number }, ... ] } }
let lastAdmNoBySchool      = {}; // { schoolName: numeric last admission number }
let fineRates              = { A:50, Lt:20, L:10, HD:30 };
let eligibilityPct         = 75;
let schools                = [];    // array of school names (strings)
let currentSchool          = null;  // selected school name
let teacherClass           = null;  // selected class (e.g. "Class One")
let teacherSection         = null;  // selected section (e.g. "A")
let currentUserKey         = null;
let currentUserRole        = null;
let currentUserSchool      = null;
let currentUserClass       = null;
let currentUserSection     = null;
let lastAdmNo              = 0;     // for the currently selected school
let lastAnalyticsShare     = "";    // for Web Share API

// ----------------------
// INITIAL DATA IMPORT (only once if appData is empty)
// ----------------------
let initialDataImported = false;

async function importInitialDataIfEmpty() {
  if (initialDataImported) return;
  const snapshot = await dbGet(appDataRef);
  if (!snapshot.exists()) {
    try {
      await dbSet(appDataRef, initialData);
    } catch (err) {
      console.error("Error writing initialData:", err);
    }
  }
  initialDataImported = true;
}

// ----------------------
// LOGIN BY KEY (no Firebase Auth, just read from appData/Users/<key>)
// ----------------------
function setupLogin() {
  const loginSection = $("loginSection");
  const mainContent  = $("mainContent");
  const loginBtn     = $("loginBtn");
  const logoutBtn    = $("logoutBtn");

  if (!loginBtn || !logoutBtn || !loginSection || !mainContent) {
    console.error("Login or mainContent elements not found in DOM.");
    return;
  }

  loginBtn.addEventListener("click", async () => {
    // Ensure initialData is imported before checking user key
    await importInitialDataIfEmpty();

    const keyInput = $("userKeyInput").value.trim();
    if (!keyInput) {
      alert("Please enter your user key.");
      return;
    }
    currentUserKey = keyInput;
    const userRef = dbRef(database, `appData/Users/${currentUserKey}`);
    const userSnap = await dbGet(userRef);
    if (!userSnap.exists()) {
      alert("Invalid user key. Please try again.");
      return;
    }
    const userData = userSnap.val();
    currentUserRole    = userData.role;
    currentUserSchool  = userData.school   || null;
    currentUserClass   = userData.class    || null;
    currentUserSection = userData.section  || null;

    // Hide login, show main UI
    loginSection.classList.add("hidden");
    mainContent.classList.remove("hidden");

    // Load initial data & setup UI based on role
    await loadSetup();

    // Initialize the rest of the app (registration, attendance, analytics)
    initAfterSetup();
  });

  logoutBtn.addEventListener("click", () => {
    window.location.reload();
  });
}

// ----------------------
// Ensure data structures exist for a given school
// ----------------------
function ensureSchoolData(schoolName) {
  if (!schools.includes(schoolName)) {
    schools.push(schoolName);
    studentsBySchool[schoolName]       = [];
    attendanceDataBySchool[schoolName] = {};
    paymentsDataBySchool[schoolName]   = {};
    lastAdmNoBySchool[schoolName]      = 0;
  }
}

// ----------------------
// LOAD SETUP (reads appData from Firebase, populates UI based on role)
// ----------------------
async function loadSetup() {
  const snapshot = await dbGet(appDataRef);
  if (!snapshot.exists()) return;
  const appData = snapshot.val();

  // Populate local schools array
  const dbSchools = appData.Schools || {};
  schools = Object.keys(dbSchools);
  schools.forEach(s => ensureSchoolData(s));

  const schoolInput     = $("schoolInput");
  const schoolSelect    = $("schoolSelect");
  const classSelect     = $("teacherClassSelect");
  const sectionSelect   = $("teacherSectionSelect");
  const setupForm       = $("setupForm");
  const saveSetupBtn    = $("saveSetup");
  const schoolListDiv   = $("schoolList");

  if (!schoolInput || !schoolSelect || !classSelect || !sectionSelect || !setupForm || !saveSetupBtn || !schoolListDiv) {
    console.error("One or more setup elements not found in DOM.");
    return;
  }

  // Clear previous
  schoolSelect.innerHTML = `<option disabled selected>-- Select School --</option>`;
  schoolListDiv.innerHTML = "";

  if (currentUserRole === "admin") {
    schoolInput.disabled = false;
    // populate dropdown with all schools
    schools.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s; opt.textContent = s;
      schoolSelect.appendChild(opt);
    });
    setupForm.classList.remove("hidden");
  }
  else if (currentUserRole === "principal") {
    schoolInput.disabled = true;
    schoolInput.value = "";
    if (currentUserSchool) {
      const opt = document.createElement("option");
      opt.value = currentUserSchool;
      opt.textContent = currentUserSchool;
      schoolSelect.appendChild(opt);
      schoolSelect.value = currentUserSchool;
    }
    setupForm.classList.remove("hidden");
  }
  else { // teacher
    setupForm.classList.add("hidden");
  }

  // Display list of schools (Admin sees all; Principal only theirs)
  if (currentUserRole === "admin" || currentUserRole === "principal") {
    schools.forEach(s => {
      if (currentUserRole === "principal" && s !== currentUserSchool) return;
      const row = document.createElement("div");
      row.textContent = s;
      schoolListDiv.appendChild(row);
    });
  }

  // Setup Save button
  saveSetupBtn.onclick = async () => {
    const newSchool = schoolInput.value.trim();
    let chosenSchool = schoolSelect.value;

    if (currentUserRole === "admin") {
      if (newSchool) {
        chosenSchool = newSchool;
        const newSchoolObj = {
          classes: {
            "Play Group": ["A", "B", "C"],
            "Nursery": ["A", "B", "C"],
            "KG": ["A", "B", "C"],
            "Class One": ["A", "B", "C"],
            "Class Two": ["A", "B", "C"],
            "Class Three": ["A", "B", "C"],
            "Class Four": ["A", "B", "C"],
            "Class Five": ["A", "B", "C"],
            "Class Six": ["A", "B", "C"],
            "Class Seven": ["A", "B", "C"],
            "Class Eight": ["A", "B", "C"],
            "Class Nine": ["A", "B", "C"],
            "Class Ten": ["A", "B", "C"],
          },
          principal: null,
          teachers: {},
        };
        await dbSet(dbRef(database, `appData/Schools/${chosenSchool}`), newSchoolObj);
        alert(`New school "${chosenSchool}" created.`);
        return loadSetup();
      } else {
        alert("To create a new school, enter its name. Otherwise select an existing school.");
        return;
      }
    }
    else if (currentUserRole === "principal") {
      chosenSchool = currentUserSchool;
      // Assign this principal to the school in Firebase
      await dbSet(dbRef(database, `appData/Schools/${chosenSchool}/principal`), currentUserKey);
      await dbSet(dbRef(database, `appData/Users/${currentUserKey}/school`), chosenSchool);
      alert(`You (${currentUserKey}) are now principal of ${chosenSchool}`);
      return;
    }
    // Teachers never see this button
  };

  // FINANCIAL SETTINGS (Admin & Principal only)
  const fineAbsentInput   = $("fineAbsent");
  const fineLateInput     = $("fineLate");
  const fineLeaveInput    = $("fineLeave");
  const fineHalfDayInput  = $("fineHalfDay");
  const eligibilityInput  = $("eligibilityPct");
  const saveFinancialBtn  = $("saveFinancial");

  if (!fineAbsentInput || !fineLateInput || !fineLeaveInput || !fineHalfDayInput || !eligibilityInput || !saveFinancialBtn) {
    console.error("One or more financial elements not found in DOM.");
  } else {
    if (currentUserRole === "admin" || currentUserRole === "principal") {
      idbGet("fineRates").then(rates => {
        if (rates) {
          fineAbsentInput.value  = rates.A;
          fineLateInput.value    = rates.Lt;
          fineLeaveInput.value   = rates.L;
          fineHalfDayInput.value = rates.HD;
        } else {
          fineAbsentInput.value  = fineRates.A;
          fineLateInput.value    = fineRates.Lt;
          fineLeaveInput.value   = fineRates.L;
          fineHalfDayInput.value = fineRates.HD;
        }
      });
      idbGet("eligibilityPct").then(pct => {
        if (pct !== undefined) eligibilityInput.value = pct;
        else eligibilityInput.value = eligibilityPct;
      });
      saveFinancialBtn.onclick = () => {
        fineRates.A   = Number(fineAbsentInput.value);
        fineRates.Lt  = Number(fineLateInput.value);
        fineRates.L   = Number(fineLeaveInput.value);
        fineRates.HD  = Number(fineHalfDayInput.value);
        eligibilityPct = Number(eligibilityInput.value);
        idbSet("fineRates", fineRates);
        idbSet("eligibilityPct", eligibilityPct);
        alert("Financial settings saved.");
      };
    } else {
      $("financial-settings")?.classList.add("hidden");
    }
  }

  // After setup & financial, set currentSchool/class/section based on role
  if (currentUserRole === "admin") {
    $("schoolSelect").onchange = () => {
      currentSchool = $("schoolSelect").value;
      lastAdmNo = lastAdmNoBySchool[currentSchool] || 0;
    };
  }
  else if (currentUserRole === "principal") {
    currentSchool = currentUserSchool;
    lastAdmNo = lastAdmNoBySchool[currentSchool] || 0;
    // Populate class dropdown
    const classesObj = appData.Schools[currentSchool]?.classes || {};
    classSelect.innerHTML = `<option disabled selected>-- Select Class --</option>`;
    Object.keys(classesObj).forEach(cn => {
      const opt = document.createElement("option");
      opt.value = cn; opt.textContent = cn;
      classSelect.appendChild(opt);
    });
    classSelect.onchange = () => {
      teacherClass = classSelect.value;
      sectionSelect.innerHTML = `<option disabled selected>-- Select Section --</option>`;
      classesObj[teacherClass].forEach(letter => {
        const opt = document.createElement("option");
        opt.value = letter; opt.textContent = letter;
        sectionSelect.appendChild(opt);
      });
    };
    sectionSelect.onchange = () => {
      teacherSection = sectionSelect.value;
    };
  }
  else if (currentUserRole === "teacher") {
    currentSchool   = currentUserSchool;
    teacherClass    = currentUserClass;
    teacherSection  = currentUserSection;
    lastAdmNo       = lastAdmNoBySchool[currentSchool] || 0;
  }
}

// ----------------------
// After login & setup, initialize registration, attendance, analytics
// ----------------------
function initAfterSetup() {
  // Utility: format dates
  function formatDate(dt) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // 0) Load from IndexedDB (sync local state)
  idbGet("studentsBySchool").then(val => {
    if (val) studentsBySchool = val;
  });
  idbGet("attendanceDataBySchool").then(val => {
    if (val) attendanceDataBySchool = val;
  });
  idbGet("paymentsDataBySchool").then(val => {
    if (val) paymentsDataBySchool = val;
  });
  idbGet("lastAdmNoBySchool").then(val => {
    if (val) lastAdmNoBySchool = val;
    if (currentSchool && lastAdmNoBySchool[currentSchool] !== undefined) {
      lastAdmNo = lastAdmNoBySchool[currentSchool];
    }
  });

  // Sync to Firebase (overwrite appData under currentSchool)
  async function syncToFirebase() {
    if (!currentSchool) return;
    const schoolNode = `appData/Schools/${currentSchool}`;
    const obj = {
      students: studentsBySchool[currentSchool] || [],
      attendance: attendanceDataBySchool[currentSchool] || {},
      payments: paymentsDataBySchool[currentSchool] || {},
    };
    await dbSet(dbRef(database, `${schoolNode}/data`), obj);
  }

  // Generate Admission Number
  async function genAdmNo() {
    lastAdmNo++;
    lastAdmNoBySchool[currentSchool] = lastAdmNo;
    await idbSet("lastAdmNoBySchool", lastAdmNoBySchool);
    await syncToFirebase();
    return String(lastAdmNo).padStart(4, "0");
  }

  // ----------------------
  // 3. STUDENT REGISTRATION
  // ----------------------
  const studentNameInput      = $("studentName");
  const studentAdmInput       = $("studentAdm");
  const studentParentInput    = $("studentParent");
  const parentContactInput    = $("parentContact");
  const parentOccupationInput = $("parentOccupation");
  const parentAddressInput    = $("parentAddress");
  const addStudentBtn         = $("addStudent");
  const studentsBody          = $("studentsBody");
  const selectAllStudentsChk  = $("selectAllStudents");
  const editSelectedBtn       = $("editSelected");
  const doneEditingBtn        = $("doneEditing");
  const deleteSelectedBtn     = $("deleteSelected");
  const saveRegistrationBtn   = $("saveRegistration");
  const editRegistrationBtn   = $("editRegistration");
  const shareRegistrationBtn  = $("shareRegistration");
  const downloadRegistrationPDFBtn = $("downloadRegistrationPDF");

  function renderStudentsTable() {
    if (!currentSchool) return;
    const arr = studentsBySchool[currentSchool] || [];
    studentsBody.innerHTML = "";
    arr.forEach((stu, idx) => {
      if (currentUserRole === "teacher") {
        if (stu.cls !== teacherClass || stu.sec !== teacherSection) return;
      }
      const tr = document.createElement("tr");
      tr.dataset.index = idx;
      tr.innerHTML = `
        <td><input type="checkbox" class="stuChk"/></td>
        <td>${idx + 1}</td>
        <td>${stu.name}</td>
        <td>${stu.adm}</td>
        <td>${stu.parent}</td>
        <td>${stu.contact}</td>
        <td>${stu.occupation}</td>
        <td>${stu.address}</td>
        <td>${stu.fine || 0}</td>
        <td>${stu.status || ""}</td>
        <td><button class="editStuBtn"><i class="fas fa-edit"></i></button></td>`;
      studentsBody.appendChild(tr);
    });
  }

  function clearRegistrationForm() {
    studentNameInput.value      = "";
    studentAdmInput.value       = "";
    studentParentInput.value    = "";
    parentContactInput.value    = "";
    parentOccupationInput.value = "";
    parentAddressInput.value    = "";
  }

  addStudentBtn?.addEventListener("click", async () => {
    if (!currentSchool) {
      alert("Select a school (and class/section if required).");
      return;
    }
    const name      = studentNameInput.value.trim();
    let adm         = studentAdmInput.value.trim();
    const parent    = studentParentInput.value.trim();
    const contact   = parentContactInput.value.trim();
    const occupation= parentOccupationInput.value.trim();
    const address   = parentAddressInput.value.trim();
    const cls       = currentUserRole === "teacher" ? teacherClass : $("teacherClassSelect")?.value;
    const sec       = currentUserRole === "teacher" ? teacherSection : $("teacherSectionSelect")?.value;

    if (!name || !parent || !contact || !cls || !sec) {
      alert("Fill in Name, Parent, Contact, Class & Section.");
      return;
    }
    if (!adm) {
      adm = await genAdmNo();
    }
    const newStu = { name, adm, parent, contact, occupation, address, cls, sec, fine: 0, status: "" };
    if (!studentsBySchool[currentSchool]) studentsBySchool[currentSchool] = [];
    studentsBySchool[currentSchool].push(newStu);
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    clearRegistrationForm();
    renderStudentsTable();
  });

  selectAllStudentsChk?.addEventListener("change", () => {
    const chks = document.querySelectorAll(".stuChk");
    chks.forEach(cb => cb.checked = selectAllStudentsChk.checked);
    editSelectedBtn.disabled = !selectAllStudentsChk.checked;
    deleteSelectedBtn.disabled = !selectAllStudentsChk.checked;
  });

  studentsBody?.addEventListener("click", e => {
    if (e.target.closest(".stuChk")) {
      const anyChecked = Array.from(document.querySelectorAll(".stuChk")).some(cb => cb.checked);
      editSelectedBtn.disabled   = !anyChecked;
      deleteSelectedBtn.disabled = !anyChecked;
    }
    if (e.target.closest(".editStuBtn")) {
      const idx = e.target.closest("tr").dataset.index;
      const stu = studentsBySchool[currentSchool][idx];
      studentNameInput.value      = stu.name;
      studentAdmInput.value       = stu.adm;
      studentParentInput.value    = stu.parent;
      parentContactInput.value    = stu.contact;
      parentOccupationInput.value = stu.occupation;
      parentAddressInput.value    = stu.address;
      studentsBySchool[currentSchool].splice(idx, 1);
      renderStudentsTable();
    }
  });

  deleteSelectedBtn?.addEventListener("click", async () => {
    const chks = document.querySelectorAll(".stuChk:checked");
    const idxs = Array.from(chks).map(cb => Number(cb.closest("tr").dataset.index));
    studentsBySchool[currentSchool] = studentsBySchool[currentSchool].filter((_, i) => !idxs.includes(i));
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    renderStudentsTable();
    selectAllStudentsChk.checked = false;
    editSelectedBtn.disabled      = true;
    deleteSelectedBtn.disabled    = true;
  });

  editSelectedBtn?.addEventListener("click", () => {
    const cb = document.querySelector(".stuChk:checked");
    if (!cb) return;
    const idx = Number(cb.closest("tr").dataset.index);
    const stu = studentsBySchool[currentSchool][idx];
    studentNameInput.value      = stu.name;
    studentAdmInput.value       = stu.adm;
    studentParentInput.value    = stu.parent;
    parentContactInput.value    = stu.contact;
    parentOccupationInput.value = stu.occupation;
    parentAddressInput.value    = stu.address;
    studentsBySchool[currentSchool].splice(idx, 1);
    renderStudentsTable();
    selectAllStudentsChk.checked = false;
    editSelectedBtn.disabled     = true;
    deleteSelectedBtn.disabled   = true;
  });

  saveRegistrationBtn?.addEventListener("click", async () => {
    await idbSet("studentsBySchool", studentsBySchool);
    await syncToFirebase();
    alert("Student list saved.");
  });

  editRegistrationBtn?.addEventListener("click", () => {
    renderStudentsTable();
  });

  shareRegistrationBtn?.addEventListener("click", async () => {
    const arr = studentsBySchool[currentSchool] || [];
    let text = `Students of ${currentSchool}:\n`;
    arr.forEach((stu, i) => {
      text += `${i + 1}. ${stu.adm} ${stu.name} (${stu.cls}-${stu.sec})\n`;
    });
    try {
      await navigator.share({ title: `Students: ${currentSchool}`, text });
    } catch (err) {
      console.error("Share failed", err);
    }
  });

  downloadRegistrationPDFBtn?.addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const arr = studentsBySchool[currentSchool] || [];
    doc.autoTable({
      head: [[ "#", "Adm#", "Name", "Class", "Section", "Parent", "Contact", "Occupation", "Address" ]],
      body: arr.map((stu, i) => [
        i + 1, stu.adm, stu.name, stu.cls, stu.sec, stu.parent, stu.contact, stu.occupation, stu.address
      ])
    });
    doc.save(`${currentSchool}_students.pdf`);
  });

  renderStudentsTable();

  // ----------------------
  // 4. MARK ATTENDANCE
  // ----------------------
  const attendanceDateInput    = $("attendanceDate");
  const loadAttendanceBtn      = $("loadAttendance");
  const attendanceTableWrapper = $("attendanceTableWrapper");
  const attendanceBody         = $("attendanceBody");
  const saveAttendanceBtn      = $("saveAttendance");
  const resetAttendanceBtn     = $("resetAttendance");
  const downloadAttendancePDFBtn = $("downloadAttendancePDF");
  const shareAttendanceSummaryBtn = $("shareAttendanceSummary");

  async function loadAttendanceForDate() {
    const dateVal = attendanceDateInput.value;
    if (!dateVal) {
      alert("Select a date.");
      return;
    }
    if (!attendanceDataBySchool[currentSchool]) attendanceDataBySchool[currentSchool] = {};
    if (!attendanceDataBySchool[currentSchool][dateVal]) {
      const arr = studentsBySchool[currentSchool] || [];
      attendanceDataBySchool[currentSchool][dateVal] = {};
      arr.forEach(stu => {
        if (currentUserRole === "teacher") {
          if (stu.cls !== teacherClass || stu.sec !== teacherSection) return;
        }
        attendanceDataBySchool[currentSchool][dateVal][stu.adm] = "P";
      });
      await idbSet("attendanceDataBySchool", attendanceDataBySchool);
      await syncToFirebase();
    }
    // Render table
    attendanceBody.innerHTML = "";
    const arr = studentsBySchool[currentSchool] || [];
    arr.forEach((stu, idx) => {
      if (currentUserRole === "teacher") {
        if (stu.cls !== teacherClass || stu.sec !== teacherSection) return;
      }
      const status = attendanceDataBySchool[currentSchool][dateVal][stu.adm];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${stu.name}</td>
        <td>${stu.adm}</td>
        <td><input type="radio" name="att_${stu.adm}" value="P" ${status === "P" ? "checked" : ""}/></td>
        <td><input type="radio" name="att_${stu.adm}" value="Lt" ${status === "Lt" ? "checked" : ""}/></td>
        <td><input type="radio" name="att_${stu.adm}" value="A" ${status === "A" ? "checked" : ""}/></td>
      `;
      attendanceBody.appendChild(tr);
    });
    attendanceTableWrapper.classList.remove("hidden");
    saveAttendanceBtn.classList.remove("hidden");
    resetAttendanceBtn.classList.remove("hidden");
    downloadAttendancePDFBtn.classList.remove("hidden");
    shareAttendanceSummaryBtn.classList.remove("hidden");
  }

  loadAttendanceBtn?.addEventListener("click", loadAttendanceForDate);

  saveAttendanceBtn?.addEventListener("click", async () => {
    const dateVal = attendanceDateInput.value;
    const rows = attendanceBody.querySelectorAll("tr");
    rows.forEach(tr => {
      const adm = tr.cells[2].textContent;
      const radios = tr.querySelectorAll(`input[name="att_${adm}"]`);
      radios.forEach(r => {
        if (r.checked) {
          attendanceDataBySchool[currentSchool][dateVal][adm] = r.value;
        }
      });
    });
    await idbSet("attendanceDataBySchool", attendanceDataBySchool);
    await syncToFirebase();
    alert("Attendance saved.");
  });

  resetAttendanceBtn?.addEventListener("click", () => {
    attendanceTableWrapper.classList.add("hidden");
    attendanceBody.innerHTML = "";
    saveAttendanceBtn.classList.add("hidden");
    resetAttendanceBtn.classList.add("hidden");
    downloadAttendancePDFBtn.classList.add("hidden");
    shareAttendanceSummaryBtn.classList.add("hidden");
  });

  downloadAttendancePDFBtn?.addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const dateVal = attendanceDateInput.value;
    const arr = studentsBySchool[currentSchool] || [];
    const body = [];
    arr.forEach((stu, i) => {
      if (currentUserRole === "teacher") {
        if (stu.cls !== teacherClass || stu.sec !== teacherSection) return;
      }
      const status = attendanceDataBySchool[currentSchool][dateVal][stu.adm] || "";
      body.push([i + 1, stu.adm, stu.name, status]);
    });
    doc.autoTable({
      head: [[ "#", "Adm#", "Name", "Status" ]],
      body,
    });
    doc.save(`${currentSchool}_attendance_${dateVal}.pdf`);
  });

  shareAttendanceSummaryBtn?.addEventListener("click", () => {
    const dateVal = attendanceDateInput.value;
    let text = `Attendance for ${currentSchool} on ${dateVal}:\n`;
    const arr = studentsBySchool[currentSchool] || [];
    arr.forEach((stu, i) => {
      if (currentUserRole === "teacher") {
        if (stu.cls !== teacherClass || stu.sec !== teacherSection) return;
      }
      const status = attendanceDataBySchool[currentSchool][dateVal]?.[stu.adm] || "";
      text += `${i + 1}. ${stu.adm} ${stu.name}: ${status}\n`;
    });
    navigator.share({ title: `Attendance: ${currentSchool} ${dateVal}`, text });
  });

  // ----------------------
  // 5. ANALYTICS
  // ----------------------
  const analyticsFilterBtn     = $("analyticsFilterBtn");
  const analyticsTargetSelect  = $("analyticsTarget");
  const analyticsSectionSelect = $("analyticsSectionSelect");
  const analyticsTypeSelect    = $("analyticsType");
  const analyticsFiltersDiv    = $("analyticsFilters");
  const analyticsDateInput     = $("analyticsDate");
  const analyticsMonthSelect   = $("analyticsMonth");
  const analyticsSemesterSelect= $("analyticsSemester");
  const applyAnalyticsFilterBtn= $("applyAnalyticsFilter");
  const analyticsTable         = $("analyticsTable");
  const analyticsBody          = $("analyticsBody");
  const analyticsContainer     = $("analyticsContainer");
  const instructionsDiv        = $("instructions");
  const graphsDiv              = $("graphs");
  const barChartCanvas         = $("barChart");
  const pieChartCanvas         = $("pieChart");
  const downloadAnalyticsBtn   = $("downloadAnalytics");
  const shareAnalyticsBtn      = $("shareAnalytics");

  let barChartInstance, pieChartInstance;

  analyticsTargetSelect?.addEventListener("change", () => {
    const val = analyticsTargetSelect.value;
    if (val === "class" || val === "section") {
      analyticsSectionSelect.classList.remove("hidden");
    } else {
      analyticsSectionSelect.classList.add("hidden");
    }
    analyticsTypeSelect.disabled = false;
  });

  analyticsTypeSelect?.addEventListener("change", () => {
    analyticsFiltersDiv.classList.remove("hidden");
    const type = analyticsTypeSelect.value;
    analyticsDateInput.classList.add("hidden");
    analyticsMonthSelect.classList.add("hidden");
    analyticsSemesterSelect.classList.add("hidden");
    if (type === "date") analyticsDateInput.classList.remove("hidden");
    if (type === "month") analyticsMonthSelect.classList.remove("hidden");
    if (type === "semester") analyticsSemesterSelect.classList.remove("hidden");
  });

  async function computeAnalytics() {
    const target = analyticsTargetSelect.value; // "class"/"section"/"student"
    const sectionFilter = analyticsSectionSelect.value;
    const periodType = analyticsTypeSelect.value; // "date"/"month"/"semester"
    let from, to;
    if (periodType === "date") {
      if (!analyticsDateInput.value) {
        alert("Select a date.");
        return;
      }
      from = to = analyticsDateInput.value;
    }
    if (periodType === "month") {
      if (!analyticsMonthSelect.value) {
        alert("Select a month.");
        return;
      }
      const [year, month] = analyticsMonthSelect.value.split("-");
      from = `${year}-${month}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      to = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
    }
    if (periodType === "semester") {
      if (!analyticsSemesterSelect.value) {
        alert("Select a semester.");
        return;
      }
      const sem = analyticsSemesterSelect.value;
      const year = new Date().getFullYear();
      if (sem === "1") {
        from = `${year}-01-01`;
        to = `${year}-06-30`;
      } else {
        from = `${year}-07-01`;
        to = `${year}-12-31`;
      }
    }
    // Build a list of student stats
    const arr = studentsBySchool[currentSchool] || [];
    const stats = [];
    arr.forEach(stu => {
      if (target === "section" && stu.sec !== sectionFilter) return;
      if (target === "class" && stu.cls !== sectionFilter) return;
      if (target === "student") {
        if (stu.adm !== analyticsSectionSelect.value) return;
      }
      let P=0, A=0, Lt=0, HD=0, L=0, total=0;
      let outstanding = 0;
      const attendances = attendanceDataBySchool[currentSchool] || {};
      Object.keys(attendances).forEach(dateKey => {
        if (dateKey >= from && dateKey <= to) {
          const status = attendances[dateKey][stu.adm];
          if (status === "P") P++;
          if (status === "A") A++;
          if (status === "Lt") Lt++;
          if (status === "HD") HD++;
          if (status === "L") L++;
          total++;
        }
      });
      const pays = paymentsDataBySchool[currentSchool]?.[stu.adm] || [];
      pays.forEach(pay => outstanding += pay.amount);
      const attendancePct = total ? (P / total) * 100 : 0;
      const statusLabel = attendancePct >= eligibilityPct && outstanding === 0 ? "Eligible"
                        : attendancePct < eligibilityPct ? "Debarred"
                        : "Pending";
      stats.push({
        adm: stu.adm, name: stu.name, P, A, Lt, HD, L, total,
        pct: attendancePct.toFixed(1), outstanding, status: statusLabel
      });
    });
    // Render table
    analyticsBody.innerHTML = "";
    stats.forEach((st, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${st.adm}</td>
        <td>${st.name}</td>
        <td>${st.P}</td>
        <td>${st.A}</td>
        <td>${st.Lt}</td>
        <td>${st.HD}</td>
        <td>${st.L}</td>
        <td>${st.total}</td>
        <td>${st.pct}%</td>
        <td>${st.outstanding}</td>
        <td>${st.status}</td>
      `;
      analyticsBody.appendChild(tr);
    });
    analyticsContainer.classList.remove("hidden");
    graphsDiv.classList.remove("hidden");
    renderAnalyticsCharts(stats);

    // Prepare share text
    lastAnalyticsShare = `Attendance Analytics (${from} to ${to})\n` +
      stats.map((st, i) => `${i+1}. ${st.adm} ${st.name}: ${st.pct}% / PKR ${st.outstanding}`).join("\n");
  }

  function renderAnalyticsCharts(stats) {
    const labels = stats.map(st => st.adm);
    const Pdata = stats.map(st => st.P);
    const Adata = stats.map(st => st.A);
    const Ltdata= stats.map(st => st.Lt);
    // Bar chart: Present vs Absent vs Late
    if (barChartInstance) {
      barChartInstance.destroy();
    }
    barChartInstance = new Chart(barChartCanvas.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Present", data: Pdata },
          { label: "Absent", data: Adata },
          { label: "Late", data: Ltdata }
        ]
      }
    });
    // Pie chart: distribution of statuses
    const statusCounts = stats.reduce((acc, st) => {
      acc[st.status] = (acc[st.status] || 0) + 1;
      return acc;
    }, {});
    const pieLabels = Object.keys(statusCounts);
    const pieData   = pieLabels.map(l => statusCounts[l]);
    if (pieChartInstance) {
      pieChartInstance.destroy();
    }
    pieChartInstance = new Chart(pieChartCanvas.getContext("2d"), {
      type: "pie",
      data: {
        labels: pieLabels,
        datasets: [{ data: pieData }]
      }
    });
  }

  analyticsFilterBtn?.addEventListener("click", () => {
    $("analyticsFilterModal")?.classList.remove("hidden");
  });
  $("analyticsFilterClose")?.addEventListener("click", () => {
    $("analyticsFilterModal")?.classList.add("hidden");
  });
  applyAnalyticsFilterBtn?.addEventListener("click", () => {
    $("analyticsFilterModal")?.classList.add("hidden");
    computeAnalytics();
  });

  downloadAnalyticsBtn?.addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const rows = [];
    const theadRow = analyticsTable.querySelector("thead tr");
    const headers = Array.from(theadRow.cells).map(th => th.textContent);
    const trs = analyticsTable.querySelectorAll("tbody tr");
    trs.forEach(tr => {
      const row = Array.from(tr.cells).map(td => td.textContent);
      rows.push(row);
    });
    doc.autoTable({ head: [headers], body: rows });
    doc.save(`${currentSchool}_analytics.pdf`);
  });

  shareAnalyticsBtn?.addEventListener("click", async () => {
    try {
      await navigator.share({ title: `Analytics: ${currentSchool}`, text: lastAnalyticsShare });
    } catch (err) {
      console.error("Share failed", err);
    }
  });

  // ----------------------
  // 6. ATTENDANCE REGISTER
  // ----------------------
  const registerMonthInput  = $("registerMonth");
  const loadRegisterBtn     = $("loadRegister");
  const registerTableWrapper= $("registerTableWrapper");
  const registerHeader      = $("registerHeader");
  const registerBody        = $("registerBody");

  loadRegisterBtn?.addEventListener("click", () => {
    const ym = registerMonthInput.value;
    if (!ym) {
      alert("Select a month.");
      return;
    }
    const [year, month] = ym.split("-");
    // Build header: first column Adm#, then one column per day
    const daysInMonth = new Date(year, month, 0).getDate();
    registerHeader.innerHTML = `<th>Adm#</th>`;
    for (let d = 1; d <= daysInMonth; d++) {
      registerHeader.innerHTML += `<th>${String(d).padStart(2, "0")}</th>`;
    }
    registerBody.innerHTML = "";
    const arr = studentsBySchool[currentSchool] || [];
    arr.forEach(stu => {
      if (currentUserRole === "teacher") {
        if (stu.cls !== teacherClass || stu.sec !== teacherSection) return;
      }
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${stu.adm}</td>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const status = attendanceDataBySchool[currentSchool]?.[dateKey]?.[stu.adm] || "";
        tr.innerHTML += `<td>${status}</td>`;
      }
      registerBody.appendChild(tr);
    });
    registerTableWrapper.classList.remove("hidden");
  });

  // ----------------------
  // 7. PAYMENT MODAL
  // ----------------------
  const paymentModal       = $("paymentModal");
  const paymentClose       = $("paymentClose");
  const paymentDateInput   = $("paymentDate");
  const paymentAmountInput = $("paymentAmount");
  const savePaymentBtn     = $("savePayment");
  const cancelPaymentBtn   = $("cancelPayment");
  let currentPaymentAdm    = null;

  studentsBody?.addEventListener("click", e => {
    if (e.target.tagName === "TD" && e.target.cellIndex === 1) {
      const idx = e.target.closest("tr").dataset.index;
      const stu = studentsBySchool[currentSchool][idx];
      currentPaymentAdm = stu.adm;
      paymentModal.classList.remove("hidden");
    }
  });

  paymentClose?.addEventListener("click", () => {
    paymentModal.classList.add("hidden");
  });
  cancelPaymentBtn?.addEventListener("click", () => {
    paymentModal.classList.add("hidden");
  });
  savePaymentBtn?.addEventListener("click", async () => {
    const dateVal = paymentDateInput.value;
    const amt     = Number(paymentAmountInput.value);
    if (!dateVal || !amt) {
      alert("Enter date and amount.");
      return;
    }
    if (!paymentsDataBySchool[currentSchool]) paymentsDataBySchool[currentSchool] = {};
    if (!paymentsDataBySchool[currentSchool][currentPaymentAdm]) paymentsDataBySchool[currentSchool][currentPaymentAdm] = [];
    paymentsDataBySchool[currentSchool][currentPaymentAdm].push({ date: dateVal, amount: amt });
    await idbSet("paymentsDataBySchool", paymentsDataBySchool);
    await syncToFirebase();
    paymentModal.classList.add("hidden");
    paymentDateInput.value   = "";
    paymentAmountInput.value = "";
    alert("Payment recorded.");
  });

  // ----------------------
  // Final: make countersContainer scrollable if present
  // ----------------------
  const countersContainer = $("countersContainer");
  if (countersContainer) {
    countersContainer.style.display = "flex";
    countersContainer.style.overflowX = "auto";
    countersContainer.style.whiteSpace = "nowrap";
  }
}

// ----------------------
// Initialize login & import on page load
// ----------------------
window.addEventListener("load", () => {
  setupLogin();
  importInitialDataIfEmpty();
});
