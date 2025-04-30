// app.js (Full Continuous Code)
window.addEventListener('DOMContentLoaded', async () => {
  // Debug console
  const erudaScript = document.createElement('script');
  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload = () => eruda.init();
  document.body.appendChild(erudaScript);

  // IndexedDB setup
  if (!window.idbKeyval) return;
  const { get, set } = window.idbKeyval;
  const save = (key, val) => set(key, val);

  // State initialization
  let students = await get('students') || [];
  let attendanceData = await get('attendanceData') || {};
  let paymentsData = await get('paymentsData') || {};
  let lastAdmNo = await get('lastAdmissionNo') || 0;
  let fineRates = await get('fineRates') || { A:50, Lt:20, L:10, HD:0 };
  let eligibilityPct = await get('eligibilityPct') || 75;

  // DOM helpers
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e?.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e?.classList.add('hidden'));

  // ============== Settings Section ==============
  $('fineAbsent').value = fineRates.A;
  $('fineLate').value = fineRates.Lt;
  $('fineLeave').value = fineRates.L;
  $('fineHalfDay').value = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  $('saveSettings').onclick = async () => {
    fineRates = {
      A: Number($('fineAbsent').value) || 0,
      Lt: Number($('fineLate').value) || 0,
      L: Number($('fineLeave').value) || 0,
      HD: Number($('fineHalfDay').value) || 0
    };
    eligibilityPct = Number($('eligibilityPct').value) || 0;
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);
    alert('Settings saved!');
  };

  // ============== School Setup ==============
  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([
      get('schoolName'),
      get('teacherClass'),
      get('teacherSection')
    ]);
    if (sc && cl && sec) {
      $('schoolNameInput').value = sc;
      $('teacherClassSelect').value = cl;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      renderStudents();
      updateCounters();
    }
  }

  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc = $('schoolNameInput').value.trim();
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!sc || !cl || !sec) return alert('Complete setup form!');
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    await loadSetup();
  };

  $('editSetup').onclick = () => {
    show($('setupForm'));
    hide($('setupDisplay'));
  };
  await loadSetup();

  // ============== Counters ==============
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target / 100);
      const update = () => {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
      };
      update();
    });
  }

  function updateCounters() {
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s => s.cls === cl && s.sec === sec).length;
    $('classCount').dataset.target = students.filter(s => s.cls === cl).length;
    $('schoolCount').dataset.target = students.length;
    animateCounters();
  }

  // ============== Student Registration ==============
  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  function renderStudents() {
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    
    students.forEach((s, i) => {
      if (s.cls !== cl || s.sec !== sec) return;
      
      // Calculate stats
      const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
      Object.values(attendanceData).forEach(recs => {
        const status = recs[s.adm] || 'A';
        stats[status]++;
      });

      // Calculate financials
      const totalFine = stats.A * fineRates.A + 
                       stats.Lt * fineRates.Lt + 
                       stats.L * fineRates.L + 
                       stats.HD * fineRates.HD;
      const totalPaid = (paymentsData[s.adm] || []).reduce((sum, p) => sum + p.amount, 0);
      const outstanding = totalFine - totalPaid;
      const totalDays = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
      const pctPresent = totalDays ? (stats.P / totalDays * 100) : 0;
      const status = (outstanding > 0 || pctPresent < eligibilityPct) ? 'Debarred' : 'Eligible';

      // Build row
      const row = `
        <tr data-index="${i}">
          <td><input type="checkbox" class="sel"></td>
          <td>${i+1}</td>
          <td>${s.name}</td>
          <td>${s.adm}</td>
          <td>${s.parent}</td>
          <td>${s.contact}</td>
          <td>${s.occupation}</td>
          <td>${s.address}</td>
          <td>PKR ${outstanding}</td>
          <td>${status}</td>
          <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
        </tr>
      `;
      tbody.innerHTML += row;
    });

    // Add payment handlers
    document.querySelectorAll('.add-payment-btn').forEach(btn => {
      btn.onclick = () => openPaymentModal(btn.dataset.adm);
    });
  }

  $('addStudent').onclick = async e => {
    e.preventDefault();
    const student = {
      name: $('studentName').value.trim(),
      parent: $('parentName').value.trim(),
      contact: $('parentContact').value.trim(),
      occupation: $('parentOccupation').value.trim(),
      address: $('parentAddress').value.trim(),
      cls: $('teacherClassSelect').value,
      sec: $('teacherSectionSelect').value,
      adm: await genAdmNo()
    };
    
    if (!student.name || !student.parent || !student.contact) {
      return alert('Required fields missing!');
    }
    
    students.push(student);
    await save('students', students);
    renderStudents();
    updateCounters();
  };

  // ============== Payments ==============
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }

  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent;
    const amount = Number($('paymentAmount').value) || 0;
    
    if (!amount) return alert('Enter amount!');
    
    paymentsData[adm] = paymentsData[adm] || [];
    paymentsData[adm].push({
      date: new Date().toISOString().split('T')[0],
      amount: amount
    });
    
    await save('paymentsData', paymentsData);
    hide($('paymentModal'));
    renderStudents();
  };

  $('cancelPayment').onclick = () => hide($('paymentModal'));

  // ============== Attendance ==============
  const statusMap = { P:'Present', A:'Absent', Lt:'Late', HD:'Half Day', L:'Leave' };
  
  $('loadAttendance').onclick = () => {
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s => s.cls === cl && s.sec === sec);
    
    $('attendanceBody').innerHTML = roster.map(s => `
      <div class="attendance-row">
        <div class="attendance-name">${s.name}</div>
        <div class="attendance-buttons">
          ${Object.entries(statusMap).map(([code, label]) => `
            <button class="att-btn" data-code="${code}">${code}</button>
          `).join('')}
        </div>
      </div>
    `).join('');

    // Add button handlers
    document.querySelectorAll('.att-btn').forEach(btn => {
      btn.onclick = () => {
        btn.parentNode.querySelectorAll('.att-btn').forEach(b => 
          b.classList.remove('selected')
        );
        btn.classList.add('selected');
      };
    });
    
    show($('attendanceBody'), $('saveAttendance'));
    hide($('attendanceSummary'));
  };

  $('saveAttendance').onclick = async () => {
    const date = $('dateInput').value;
    if (!date) return alert('Select date!');
    
    const attendance = {};
    document.querySelectorAll('.attendance-row').forEach(row => {
      const name = row.querySelector('.attendance-name').textContent;
      const code = row.querySelector('.att-btn.selected')?.dataset.code || 'A';
      const student = students.find(s => s.name === name);
      if (student) attendance[student.adm] = code;
    });
    
    attendanceData[date] = attendance;
    await save('attendanceData', attendanceData);
    alert('Attendance saved!');
    renderStudents();
  };

  // ============== Analytics ==============
  let barChart, pieChart;
  $('loadAnalytics').onclick = async () => {
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    const roster = students.filter(s => s.cls === cl && s.sec === sec);
    
    // Destroy existing charts
    if(barChart) barChart.destroy();
    if(pieChart) pieChart.destroy();

    // Bar Chart
    barChart = new Chart($('barChart'), {
      type: 'bar',
      data: {
        labels: roster.map(s => s.name),
        datasets: [{
          label: 'Attendance %',
          data: roster.map(s => {
            const stats = calculateAttendanceStats(s.adm);
            return stats.totalDays ? (stats.P / stats.totalDays * 100) : 0;
          }),
          backgroundColor: 'rgba(33, 150, 243, 0.5)'
        }]
      }
    });

    // Pie Chart
    pieChart = new Chart($('pieChart'), {
      type: 'pie',
      data: {
        labels: ['Present', 'Absent', 'Late', 'Half Day', 'Leave'],
        datasets: [{
          data: Object.values(roster.reduce((acc, s) => {
            const stats = calculateAttendanceStats(s.adm);
            acc.P += stats.P;
            acc.A += stats.A;
            acc.Lt += stats.Lt;
            acc.HD += stats.HD;
            acc.L += stats.L;
            return acc;
          }, {P:0, A:0, Lt:0, HD:0, L:0})),
          backgroundColor: [
            '#4CAF50', '#F44336', '#FFEB3B', '#FF9800', '#03A9F4'
          ]
        }]
      }
    });

    show($('graphs'));
  };

  function calculateAttendanceStats(adm) {
    const stats = { P:0, A:0, Lt:0, HD:0, L:0 };
    Object.values(attendanceData).forEach(recs => {
      const status = recs[adm] || 'A';
      stats[status]++;
    });
    stats.totalDays = stats.P + stats.A + stats.Lt + stats.HD + stats.L;
    return stats;
  }

  // ============== Attendance Register ==============
  $('loadRegister').onclick = () => {
    const month = $('registerMonth').value;
    const [year, m] = month.split('-');
    const days = new Date(year, m, 0).getDate();
    
    // Build header
    $('registerHeader').innerHTML = 
      `<th>#</th><th>Adm#</th><th>Name</th>` + 
      Array.from({length: days}, (_,i) => `<th>${i+1}</th>`).join('');

    // Build body
    $('registerBody').innerHTML = students.map((s, i) => {
      let cells = '';
      for(let d=1; d<=days; d++) {
        const date = `${month}-${d.toString().padStart(2,'0')}`;
        const status = attendanceData[date]?.[s.adm] || 'A';
        cells += `<td class="reg-cell" style="background:${getStatusColor(status)}">${status}</td>`;
      }
      return `<tr><td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>${cells}</tr>`;
    }).join('');

    show($('registerTableWrapper'));
  };

  function getStatusColor(status) {
    return {
      P: '#4CAF50', 
      A: '#F44336', 
      Lt: '#FFEB3B', 
      HD: '#FF9800', 
      L: '#03A9F4'
    }[status];
  }

  // ============== PDF Export ==============
  $('downloadAnalytics').onclick = () => {
    const doc = new jspdf.jsPDF('p', 'pt', 'a4');
    
    // Add header
    doc.setFontSize(18).text('Analytics Report', 40, 40);
    doc.setFontSize(12).text($('setupText').textContent, 40, 60);
    
    // Add charts
    const barCanvas = $('barChart');
    const pieCanvas = $('pieChart');
    doc.addImage(barCanvas, 'PNG', 40, 80, 240, 160);
    doc.addImage(pieCanvas, 'PNG', 300, 80, 240, 160);
    
    // Add table
    doc.autoTable({
      startY: 280,
      html: '#analyticsTable',
      styles: { fontSize: 8 }
    });
    
    doc.save('analytics_report.pdf');
  };

  $('downloadRegister').onclick = () => {
    const doc = new jspdf.jsPDF('landscape');
    doc.setFontSize(18).text('Attendance Register', 14, 16);
    doc.setFontSize(12).text($('setupText').textContent, 14, 24);
    doc.autoTable({
      startY: 32,
      html: '#registerTable',
      styles: { fontSize: 6 },
      columnStyles: { 0: { cellWidth: 20 } }
    });
    doc.save('attendance_register.pdf');
  };

  // ============== Final Initialization ==============
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }
  renderStudents();
  updateCounters();
});
