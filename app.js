// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };

  // 1. SETUP
  const schoolIn       = $('schoolNameInput');
  const classSel       = $('teacherClassSelect');
  const secSel         = $('teacherSectionSelect');
  const saveSetupBtn   = $('saveSetup');
  const setupForm      = $('setupForm');
  const setupDisplay   = $('setupDisplay');
  const setupText      = $('setupText');
  const editSetupBtn   = $('editSetup');

  function loadSetup() {
    const school = localStorage.getItem('schoolName');
    const cls    = localStorage.getItem('teacherClass');
    const sec    = localStorage.getItem('teacherSection');
    if (school && cls && sec) {
      schoolIn.value = school;
      classSel.value = cls;
      secSel.value   = sec;
      setupText.textContent = `${school} 🏫 | Class: ${cls} | Section: ${sec}`;
      setupForm.classList.add('hidden');
      setupDisplay.classList.remove('hidden');
    }
  }

  saveSetupBtn.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };

  editSetupBtn.onclick = e => {
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisplay.classList.add('hidden');
  };

  loadSetup();

  // 2. STUDENT REGISTRATION
  let students = JSON.parse(localStorage.getItem('students') || '[]');
  window.students = students;
  renderStudents();  // assumes renderStudents is defined elsewhere

  // 3. ATTENDANCE MARKING
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
  window.attendanceData = attendanceData;

  // 4. ANALYTICS
  const analyticsType       = $('analyticsType');
  const analyticsDate       = $('analyticsDate');
  const analyticsMonth      = $('analyticsMonth');
  const semesterStart       = $('semesterStart');
  const semesterEnd         = $('semesterEnd');
  const yearStart           = $('yearStart');
  const loadAnalyticsBtn    = $('loadAnalytics');
  const resetAnalyticsBtn   = $('resetAnalytics');
  const instructionsEl      = $('instructions');
  const analyticsContainer  = $('analyticsContainer');
  const graphsEl            = $('graphs');
  const analyticsActionsEl  = $('analyticsActions');
  const shareAnalyticsBtn   = $('shareAnalytics');
  const downloadAnalyticsBtn= $('downloadAnalytics');
  const barCtx              = document.getElementById('barChart').getContext('2d');
  const pieCtx              = document.getElementById('pieChart').getContext('2d');
  let barChart, pieChart;

  function hideAllAnalytics() {
    [analyticsDate, analyticsMonth, semesterStart, semesterEnd, yearStart,
     instructionsEl, analyticsContainer, graphsEl, analyticsActionsEl, resetAnalyticsBtn]
      .forEach(el => el.classList.add('hidden'));
  }

  analyticsType.onchange = () => {
    hideAllAnalytics();
    if (analyticsType.value === 'date')      analyticsDate.classList.remove('hidden');
    if (analyticsType.value === 'month')     analyticsMonth.classList.remove('hidden');
    if (analyticsType.value === 'semester')  { semesterStart.classList.remove('hidden'); semesterEnd.classList.remove('hidden'); }
    if (analyticsType.value === 'year')       yearStart.classList.remove('hidden');
  };

  resetAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    analyticsType.value = '';
    hideAllAnalytics();
  };

  loadAnalyticsBtn.onclick = ev => {
    ev.preventDefault();
    // existing analytics computing code goes here

    // render charts
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, { /* ... */ });

    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: { /* ... */ },
      options: { maintainAspectRatio: true, aspectRatio: 1 }
    });

    graphsEl.classList.remove('hidden');
    analyticsActionsEl.classList.remove('hidden');
  };

  // 5. ATTENDANCE REGISTER
  const regMonthIn        = $('registerMonth');
  const loadRegBtn        = $('loadRegister');
  const changeRegBtn      = $('changeRegister');
  const regTableWrapper   = $('registerTableWrapper');
  const regTable          = $('registerTable');
  const regBody           = $('registerBody');
  const regSummarySection = $('registerSummarySection');
  const regSummaryBody    = $('registerSummaryBody');
  const shareRegBtn2      = $('shareRegister');
  const downloadRegBtn2   = $('downloadRegisterPDF');

  // build 1–31 headers once
  const regHeaderRow = regTable.querySelector('thead tr');
  for (let d = 1; d <= 31; d++) {
    const th = document.createElement('th');
    th.textContent = d;
    regHeaderRow.append(th);
  }

  loadRegBtn.onclick = e => {
    e.preventDefault();
    if (!regMonthIn.value) return alert('Select month');
    const [yr, mo] = regMonthIn.value.split('-').map(Number);
    const dim = new Date(yr, mo, 0).getDate();

    regBody.innerHTML = '';
    regSummaryBody.innerHTML = '';

    // render register rows
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d = 1; d <= dim; d++) {
        const key  = `${regMonthIn.value}-${String(d).padStart(2,'0')}`;
        const code = (attendanceData[key] || {})[s.roll] || 'A';
        const td   = document.createElement('td');
        td.textContent      = code;
        td.style.background = colors[code];
        td.style.color      = '#fff';
        tr.append(td);
      }
      regBody.append(tr);
    });

    // build stats with roll and name
    const stats = students.map(s => ({
      roll: s.roll,
      name: s.name,
      P: 0, A: 0, Lt: 0, HD: 0, L: 0,
      total: 0
    }));

    stats.forEach(st => {
      for (let d = 1; d <= dim; d++) {
        const key = `${regMonthIn.value}-${String(d).padStart(2,'0')}`;
        const rec = attendanceData[key] || {};
        const code = rec[st.roll] || 'A';
        st[code]++;
        st.total++;
      }
      const pct = st.total ? ((st.P / st.total) * 100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${st.name}</td>
        <td>${st.P}</td>
        <td>${st.A}</td>
        <td>${st.Lt}</td>
        <td>${st.HD}</td>
        <td>${st.L}</td>
        <td>${pct}</td>
      `;
      regSummaryBody.append(tr);
    });

    regTableWrapper.classList.remove('hidden');
    regSummarySection.classList.remove('hidden');
    loadRegBtn.classList.add('hidden');
    changeRegBtn.classList.remove('hidden');
  };

  changeRegBtn.onclick = e => {
    e.preventDefault();
    regTableWrapper.classList.add('hidden');
    regSummarySection.classList.add('hidden');
    loadRegBtn.classList.remove('hidden');
    changeRegBtn.classList.add('hidden');
  };

  shareRegBtn2.onclick = e => {
    e.preventDefault();
    const hdr = `Register for ${regMonthIn.value}\nSchool: ${localStorage.getItem('schoolName')} | Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`;
    const lines = Array.from(regSummaryBody.querySelectorAll('tr')).map(r => {
      const td = r.querySelectorAll('td');
      return `${td[0].textContent}: P:${td[1].textContent}, A:${td[2].textContent}, Lt:${td[3].textContent}, HD:${td[4].textContent}, L:${td[5].textContent}, %:${td[6].textContent}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n\n' + lines.join('\n'))}`, '_blank');
  };

  downloadRegBtn2.onclick = e => {
    e.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    const school = localStorage.getItem('schoolName');
    const cls    = localStorage.getItem('teacherClass');
    const sec    = localStorage.getItem('teacherSection');

    doc.setFontSize(14);
    doc.text(school, 40, 30);
    doc.setFontSize(12);
    doc.text(`Class: ${cls} | Section: ${sec}`, 40, 45);
    doc.setFontSize(12);
    doc.text(`Attendance Register: ${regMonthIn.value}`, 40, 60);

    doc.autoTable({
      html: '#registerTable',
      startY: 75,
      theme: 'grid',
      headStyles: { fillColor: [33,150,243], textColor: 255 },
      styles: {
        fontSize: 6,
        cellPadding: 2,
        halign: 'center',
        valign: 'middle',
        overflow: 'linebreak',
      },
      didParseCell: data => {
        if (data.section === 'body' && data.column.index >= 3) {
          data.cell.styles.cellWidth = 10;
        }
      }
    });

    doc.autoTable({
      html: '#registerSummarySection table',
      startY: doc.lastAutoTable.finalY + 10,
      theme: 'grid',
      headStyles: { fillColor: [33,150,243], textColor: 255 },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        halign: 'center',
      }
    });

    if (window.barChart && window.pieChart) {
      const y = doc.lastAutoTable.finalY + 10;
      const w = 120, h = 80;
      doc.addImage(window.barChart.toBase64Image(), 'PNG', 40, y, w, h);
      doc.addImage(window.pieChart.toBase64Image(), 'PNG', 40 + w + 20, y, w, h);
    }

    doc.save('attendance_register.pdf');
  };
});
