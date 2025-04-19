// app.js
// — your original app.js up here —

// (Everything from student registration through analytics stays unchanged)


// 6. Traditional Monthly Register
const colors = { P: 'var(--success)', A: 'var(--danger)', Lt: 'var(--warning)', HD: 'var(--orange)', L: 'var(--info)' };
const loadRegisterBtn = document.getElementById('loadRegister');
const regMonthIn      = document.getElementById('regMonth');
const regTable        = document.getElementById('registerTable');
const summaryEl       = document.getElementById('registerSummary');
const graphEl         = document.getElementById('registerGraph');
const shareBtn        = document.getElementById('shareRegister');
const downloadBtn     = document.getElementById('downloadRegisterPDF');
let regChart;

function daysInMonth(m, y) {
  return new Date(y, m, 0).getDate();
}

loadRegisterBtn.onclick = () => {
  const val = regMonthIn.value;
  if (!val) return alert('Pick month & year');
  const [year, month] = val.split('-').map(Number);
  const days = daysInMonth(month, year);

  // build header
  let html = '<thead><tr><th>Sr#</th><th>Reg#</th><th>Name</th>';
  for (let d = 1; d <= days; d++) html += `<th>${d}</th>`;
  html += '</tr></thead><tbody>';

  const students       = JSON.parse(localStorage.getItem('students')||'[]');
  const attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');
  let totalPresent = 0, totalEntries = 0;

  students.forEach((s,i) => {
    html += `<tr><td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
    for (let d = 1; d <= days; d++) {
      const dd   = String(d).padStart(2,'0');
      const date = `${year}-${String(month).padStart(2,'0')}-${dd}`;
      const code = attendanceData[date]?.[s.roll] || 'A';
      totalEntries++;
      if (code === 'P') totalPresent++;
      html += `<td style="background:${colors[code]};color:#fff">${code}</td>`;
    }
    html += '</tr>';
  });
  html += '</tbody>';
  regTable.innerHTML = html;

  // summary
  const pct    = totalEntries ? ((totalPresent/totalEntries)*100).toFixed(1) : '0.0';
  const remark = pct==100 ? 'Excellent' : pct>=75 ? 'Good' : pct>=50 ? 'Fair' : 'Poor';
  summaryEl.innerHTML = `<p><strong>Overall Attendance:</strong> ${pct}% | <em>${remark}</em></p>`;
  summaryEl.classList.remove('hidden');

  // graph
  const ctx = document.getElementById('registerChart').getContext('2d');
  const presentCounts = [];
  for (let d = 1; d <= days; d++) {
    const dd   = String(d).padStart(2,'0');
    const date = `${year}-${String(month).padStart(2,'0')}-${dd}`;
    const recs = attendanceData[date] || {};
    presentCounts.push(students.reduce((sum,s) => sum + (recs[s.roll]==='P'?1:0), 0));
  }
  if (regChart) regChart.destroy();
  regChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({length: days}, (_,i) => i+1),
      datasets: [{ label: 'Present Count', data: presentCounts }]
    },
    options: { maintainAspectRatio: true }
  });
  graphEl.classList.remove('hidden');
  shareBtn.classList.remove('hidden');
  downloadBtn.classList.remove('hidden');
};

shareBtn.onclick = () => {
  const monthYear = regMonthIn.value;
  const students       = JSON.parse(localStorage.getItem('students')||'[]');
  const attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');
  let text = `Register for ${monthYear}\n`;
  const days = daysInMonth(...regMonthIn.value.split('-').map(Number));
  students.forEach((s,i) => {
    text += `${i+1}. ${s.adm} ${s.name}: `;
    for (let d = 1; d <= days; d++) {
      const dd   = String(d).padStart(2,'0');
      const date = `${regMonthIn.value}-${dd}`;
      text += attendanceData[date]?.[s.roll] || 'A';
    }
    text += '\n';
  });
  text += summaryEl.textContent;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

downloadBtn.onclick = () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p','pt','a4');
  doc.text(`Register: ${regMonthIn.value}`, 40, 30);
  doc.autoTable({
    html: '#registerTable',
    startY: 40,
    styles: { fontSize: 8 }
  });
  const y = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.text(summaryEl.textContent, 40, y);
  const chartImg = regChart.toBase64Image();
  doc.addImage(chartImg, 'PNG', 40, y + 20, 500, 200);
  doc.save('monthly_register.pdf');
};
