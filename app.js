// app.js window.addEventListener('DOMContentLoaded', () => { const $ = id => document.getElementById(id);

// Shared color mapping const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };

// ----------------------------- // 1. SETUP // ----------------------------- const schoolIn     = $('schoolNameInput'); const classSel     = $('teacherClassSelect'); const secSel       = $('teacherSectionSelect'); const saveSetup    = $('saveSetup'); const setupForm    = $('setupForm'); const setupDisplay = $('setupDisplay'); const setupText    = $('setupText'); const editSetup    = $('editSetup');

function loadSetup() { const school = localStorage.getItem('schoolName'); const cls    = localStorage.getItem('teacherClass'); const sec    = localStorage.getItem('teacherSection'); if (school && cls && sec) { schoolIn.value = school; classSel.value = cls; secSel.value   = sec; setupText.textContent = ${school} 🏫 | Class: ${cls} | Section: ${sec}; setupForm.classList.add('hidden'); setupDisplay.classList.remove('hidden'); } }

saveSetup.addEventListener('click', e => { e.preventDefault(); if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup'); localStorage.setItem('schoolName', schoolIn.value); localStorage.setItem('teacherClass', classSel.value); localStorage.setItem('teacherSection', secSel.value); loadSetup(); });

editSetup.addEventListener('click', e => { e.preventDefault(); setupForm.classList.remove('hidden'); setupDisplay.classList.add('hidden'); });

loadSetup();

// ----------------------------- // 2. STUDENT REGISTRATION (unchanged) // ----------------------------- let students = JSON.parse(localStorage.getItem('students') || '[]'); window.students = students; // ... registration code remains exactly as before ...

// ----------------------------- // 3. ATTENDANCE MARKING (unchanged) // ----------------------------- let attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}'); window.attendanceData = attendanceData; // ... attendance marking code remains exactly as before ...

// ----------------------------- // 4. ANALYTICS (with load button visibility fix) // ----------------------------- const analyticsTarget      = $('analyticsTarget'); const admInput             = $('studentAdmInput'); const analyticsType        = $('analyticsType'); const analyticsDate        = $('analyticsDate'); const analyticsMonth       = $('analyticsMonth'); const semesterStartInput   = $('semesterStart'); const semesterEndInput     = $('semesterEnd'); const yearStart            = $('yearStart'); const loadAnalyticsBtn     = $('loadAnalytics'); const resetAnalyticsBtn    = $('resetAnalytics'); const instructionsEl       = $('instructions'); const analyticsContainer   = $('analyticsContainer'); const graphsEl             = $('graphs'); const analyticsActionsEl   = $('analyticsActions'); const shareAnalyticsBtn    = $('shareAnalytics'); const downloadAnalyticsBtn = $('downloadAnalytics'); const barCtx               = $('barChart').getContext('2d'); const pieCtx               = $('pieChart').getContext('2d'); let barChart, pieChart;

function hideAllAnalytics() { [analyticsDate, analyticsMonth, semesterStartInput, semesterEndInput, yearStart, admInput, instructionsEl, analyticsContainer, graphsEl, analyticsActionsEl, resetAnalyticsBtn, loadAnalyticsBtn] .forEach(el => el.classList.add('hidden')); }

// Initial hide on load hideAllAnalytics();

analyticsTarget.addEventListener('change', () => { admInput.classList.toggle('hidden', analyticsTarget.value === 'class'); });

analyticsType.addEventListener('change', () => { hideAllAnalytics(); if (analyticsTarget.value === 'student') admInput.classList.remove('hidden'); if (analyticsType.value === 'date')      analyticsDate.classList.remove('hidden'); if (analyticsType.value === 'month')     analyticsMonth.classList.remove('hidden'); if (analyticsType.value === 'semester') { semesterStartInput.classList.remove('hidden'); semesterEndInput.classList.remove('hidden'); } if (analyticsType.value === 'year')      yearStart.classList.remove('hidden');

// Show load and reset buttons after period set
loadAnalyticsBtn.classList.remove('hidden');
resetAnalyticsBtn.classList.remove('hidden');

});

resetAnalyticsBtn.addEventListener('click', ev => { ev.preventDefault(); analyticsType.value   = ''; analyticsTarget.value = 'class'; admInput.value        = ''; hideAllAnalytics(); });

loadAnalyticsBtn.addEventListener('click', ev => { ev.preventDefault(); let from, to;

if (analyticsType.value === 'date') {
  if (!analyticsDate.value) return alert('Pick a date');
  from = to = analyticsDate.value;
} else if (analyticsType.value === 'month') {
  if (!analyticsMonth.value) return alert('Pick a month');
  const [y, m] = analyticsMonth.value.split('-').map(Number);
  from = `${analyticsMonth.value}-01`;
  to   = `${analyticsMonth.value}-${new Date(y, m, 0).getDate()}`;
} else if (analyticsType.value === 'semester') {
  if (!semesterStartInput.value || !semesterEndInput.value) 
    return alert('Pick semester range');
  const [startYear, startMonth] = semesterStartInput.value.split('-').map(Number);
  const [endYear,   endMonth  ] = semesterEndInput.value.split('-').map(Number);
  from = `${startYear}-${String(startMonth).padStart(2,'0')}-01`;
  const lastDay = new Date(endYear, endMonth, 0).getDate();
  to   = `${endYear}-${String(endMonth).padStart(2,'0')}-${lastDay}`;
} else if (analyticsType.value === 'year') {
  if (!yearStart.value) return alert('Pick a year');
  from = `${yearStart.value}-01-01`;
  to   = `${yearStart.value}-12-31`;
} else {
  return alert('Select a period');
}

const fromDate = new Date(from);
const toDate   = new Date(to);

// Build stats
let stats = (analyticsTarget.value === 'class')
  ? students.map(s => ({ name: s.name, roll: s.roll, P:0, A:0, Lt:0, HD:0, L:0, total:0 }))
  : (() => {
      const adm = admInput.value.trim();
      if (!adm) return alert('Enter Admission #');
      const stud = students.find(s => s.adm === adm);
      if (!stud) return alert(`No student with Adm#: ${adm}`);
      return [{ name: stud.name, roll: stud.roll, P:0, A:0, Lt:0, HD:0, L:0, total:0 }];
    })();

Object.entries(attendanceData).forEach(([d, recs]) => {
  const cur = new Date(d);
  if (cur >= fromDate && cur <= toDate) {
    stats.forEach(st => {
      const code = recs[st.roll] || 'A'; st[code]++; st.total++;
    });
  }
});

// Render table
let html = '<table><thead><tr>' +
           '<th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th>' +
           '</tr></thead><tbody>';
stats.forEach(s => {
  const pct = s.total ? ((s.P/s.total)*100).toFixed(1) : '0.0';
  html += `<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td>` +
          `<td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td>` +
          `<td>${s.total}</td><td>${pct}</td></tr>`;
});
html += '</tbody></table>';

analyticsContainer.innerHTML = html;
instructionsEl.textContent    = `Report: ${from} to ${to}`;

analyticsContainer.classList.remove('hidden');
instructionsEl.classList.remove('hidden');

// Charts
const labels  = stats.map(s => s.name);
const dataPct = stats.map(s => s.total ? (s.P/s.total)*100 : 0);
if (barChart) barChart.destroy();
barChart = new Chart(barCtx, { type: 'bar', data: { labels, datasets: [{ label: '% Present', data: dataPct }] }, options: { maintainAspectRatio: true } });

const agg = stats.reduce((a, s) => { ['P','A','Lt','HD','L'].forEach(c => a[c]+=s[c]); return a; }, { P:0, A:0, Lt:0, HD:0, L:0 });
if (pieChart) pieChart.destroy();
pieChart = new Chart(pieCtx, { type: 'pie', data: { labels: ['P','A','Lt','HD','L'], datasets: [{ data: Object.values(agg) }] }, options: { maintainAspectRatio: true, aspectRatio: 1 } });

graphsEl.classList.remove('hidden');
analyticsActionsEl.classList.remove('hidden');

});

// 5. ATTENDANCE REGISTER (unchanged) // ... existing register code ... });

