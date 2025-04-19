// app.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  // … all your existing setup, registration, attendance & analytics code …

  //
  // 6. Traditional Attendance Register
  //
  const registerMonth       = $('registerMonth');
  const loadRegisterBtn     = $('loadRegister');
  const resetRegisterBtn    = $('resetRegister');
  const registerWrapper     = $('registerWrapper');
  const registerTable       = $('registerTable');
  const registerSummary     = $('registerSummary');
  const registerSummaryTbody= $('registerSummaryTable').querySelector('tbody');
  const shareRegisterBtn    = $('shareRegister');
  const downloadRegisterPDF = $('downloadRegisterPDF');

  loadRegisterBtn.onclick = ev => {
    ev.preventDefault();
    if (!registerMonth.value) return alert('Pick a month');
    const [year, mon] = registerMonth.value.split('-').map(Number);
    // days in month
    const daysInMonth = new Date(year, mon, 0).getDate();
    // Build header
    let html = '<thead><tr><th>Sr#</th><th>Adm#</th><th>Name</th>';
    for (let d = 1; d <= daysInMonth; d++) {
      html += `<th>${d}</th>`;
    }
    html += '</tr></thead><tbody>';
    // Rows
    students.forEach((s, i) => {
      html += `<tr><td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const dd = String(d).padStart(2,'0');
        const key = `${registerMonth.value}-${dd}`;
        const code = (attendanceData[key]||{})[s.roll] || '';
        html += `<td>${code}</td>`;
      }
      html += '</tr>';
    });
    html += '</tbody>';
    registerTable.innerHTML = html;
    registerWrapper.classList.remove('hidden');
    resetRegisterBtn.classList.remove('hidden');

    // Build summary
    registerSummaryTbody.innerHTML = '';
    students.forEach(s => {
      const stats = {P:0,A:0,Lt:0,HD:0,L:0,total:0};
      for (let d = 1; d <= daysInMonth; d++) {
        const dd = String(d).padStart(2,'0');
        const key = `${registerMonth.value}-${dd}`;
        const c = (attendanceData[key]||{})[s.roll] || 'A';
        stats[c]++; stats.total++;
      }
      const pct = stats.total ? ((stats.P/stats.total)*100).toFixed(1) : '0.0';
      registerSummaryTbody.innerHTML +=
        `<tr>
           <td>${s.name}</td>
           <td>${stats.P}</td><td>${stats.A}</td><td>${stats.Lt}</td><td>${stats.HD}</td><td>${stats.L}</td>
           <td>${stats.total}</td><td>${pct}</td>
         </tr>`;
    });
    registerSummary.classList.remove('hidden');
    shareRegisterBtn.classList.remove('hidden');
    downloadRegisterPDF.classList.remove('hidden');
  };

  resetRegisterBtn.onclick = ev => {
    ev.preventDefault();
    registerMonth.value = '';
    registerWrapper.classList.add('hidden');
    registerSummary.classList.add('hidden');
    shareRegisterBtn.classList.add('hidden');
    downloadRegisterPDF.classList.add('hidden');
    resetRegisterBtn.classList.add('hidden');
  };

  shareRegisterBtn.onclick = ev => {
    ev.preventDefault();
    const header = `Month: ${registerMonth.value}`;
    const lines = students.map(s => {
      const cells = Array.from(registerTable.querySelectorAll(`tr:nth-child(${students.indexOf(s)+2}) td`));
      const present = cells.slice(3).filter(td => td.textContent==='P').length;
      return `${s.adm} ${s.name}: ${present}/${cells.length-3}`;
    });
    const msg = [header, '', ...lines].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  downloadRegisterPDF.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    // Title
    doc.setFontSize(14);
    doc.text(`Traditional Register – ${registerMonth.value}`, 40, 30);
    // Table
    doc.autoTable({
      html: '#registerTable',
      startY: 50,
      styles: { fontSize: 8 }
    });
    doc.save(`register_${registerMonth.value}.pdf`);
  };

  // … end of DOMContentLoaded …
});
