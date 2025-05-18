// js/utils.js
import { dbSet, dbRef } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { database }     from "./firebase-config.js";

// IndexedDB shortcuts (idb-keyval کا IIFE پہلے index.html میں لوڈ ہونا چاہیے)
const { get: idbGet, set: idbSet, clear: idbClear } = window.idbKeyval;

// 1) Generate Admission Number اور Firebase Sync کے لیے
export async function genAdmNo() {
  let last = (await idbGet("lastAdmissionNo")) || 0;
  last++;
  await idbSet("lastAdmissionNo", last);
  // Firebase پر بھی sync کرنا پڑے گا—وہ کام مخصوص modules میں کرنا بہتر ہے
  return String(last).padStart(4, "0");
}

// 2) PDF Share Helper
export async function sharePdf(blob, fileName, title) {
  if (
    navigator.canShare &&
    navigator.canShare({ files: [new File([blob], fileName, { type: "application/pdf" })] })
  ) {
    try {
      await navigator.share({ title, files: [new File([blob], fileName, { type: "application/pdf" })] });
    } catch (err) {
      if (err.name !== "AbortError") console.error("Share failed", err);
    }
  }
}

// 3) Common show/hide utilities (optional)
export function show(...els) {
  els.forEach(e => e && e.classList.remove("hidden"));
}
export function hide(...els) {
  els.forEach(e => e && e.classList.add("hidden"));
}

// 4) Local IndexedDB state initializer
export async function initLocalState() {
  const students       = (await idbGet("students"))       || [];
  const attendanceData = (await idbGet("attendanceData")) || {};
  const paymentsData   = (await idbGet("paymentsData"))   || {};
  const lastAdmNo      = (await idbGet("lastAdmissionNo"))|| 0;
  const fineRates      = (await idbGet("fineRates"))      || { A:50, Lt:20, L:10, HD:30 };
  const eligibilityPct = (await idbGet("eligibilityPct")) || 75;
  const schools        = (await idbGet("schools"))        || [];
  const currentSchool  = (await idbGet("currentSchool"))  || null;
  const teacherClass   = (await idbGet("teacherClass"))   || null;
  const teacherSection = (await idbGet("teacherSection")) || null;
  return {
    students,
    attendanceData,
    paymentsData,
    lastAdmNo,
    fineRates,
    eligibilityPct,
    schools,
    currentSchool,
    teacherClass,
    teacherSection
  };
}

// 5) Sync to Firebase helper (جب کہیں بھی لکھنا ہو)
export async function syncToFirebase(localState) {
  const payload = localState; // assume it’s an object with all fields
  try {
    await dbSet(dbRef(database, "appData"), payload);
    console.log("✅ Synced data to Firebase");
  } catch(err) {
    console.error("Firebase sync failed:", err);
  }
}

export { idbGet, idbSet, idbClear }

// آپ یہاں مزید helper functions بھی ڈال سکتے ہیں (مثلاً date formatting وغیرہ)
