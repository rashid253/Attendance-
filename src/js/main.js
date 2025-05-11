// File: src/js/main.js
import { initSetup }      from './setup.js';
import { initStudents }   from './students.js';
import { initAttendance } from './attendance.js';
import { initAnalytics }  from './analytics.js';

document.addEventListener('DOMContentLoaded', () => {
  initSetup();
  initStudents();
  initAttendance();
  initAnalytics();
});
