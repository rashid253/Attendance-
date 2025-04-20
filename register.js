// register.js
window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'var(--orange)', L:'var(--info)' };
  const students = window.students;
  const attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');

  const regMonthIn      = $('registerMonth');
  const loadReg         = $('loadRegister');
  const changeReg       = $('changeRegister');
  const regTableWrapper = $('registerTableWrapper');
  const regTable        = $('registerTable');
  const regBody         = $('registerBody');
  const regSummarySec   = $('registerSummarySection');
  const regSummaryBody  = $('registerSummaryBody');
  const shareReg2       = $('shareRegister');
  const downloadReg2    = $('downloadRegisterPDF');

  // append day headers once
  const headerRow = regTable.querySelector('thead tr');
  for (let d=1; d<=31; d++){
    const th = document.createElement('th'); th.textContent = d; headerRow.append(th);
  }

  loadReg.onclick = e => {
    e.preventDefault();
    if(!regMonthIn.value) return alert('Select month');
    const data = attendanceData;
    const [y,m] = regMonthIn.value.split('-').map(Number);
    const dim   = new Date(y,m,0).getDate();
    regBody.innerHTML=''; regSummaryBody.innerHTML='';

    students.forEach((s,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let day=1; day<=dim; day++){
        const key = `${regMonthIn.value}-${String(day).padStart(2,'0')}`;
        const code= (data[key]||{})[s.roll]||'A';
        const td = document.createElement('td');
        td.textContent=code; td.style.background=colors[code]; td.style.color='#fff';
        tr.append(td);
      }
      regBody.append(tr);
    });

    const stats = students.map(s=>({name:s.name,roll:s.roll,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    stats.forEach(st=>{
      for(let day=1; day<=dim; day++){
        const key = `${regMonthIn.value}-${String(day).padStart(2,'0')}`;
        const code= (data[key]||{})[st.roll]||'A';
        st[code]++; st.total++;
      }
      const pct = st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${pct}</td>`;
      regSummaryBody.append(tr);
    });

    regTableWrapper.classList.remove('hidden');
    regSummarySec.classList.remove('hidden');
    loadReg.classList.add('hidden');
    changeReg.classList.remove('hidden');
  };

  changeReg.onclick = e => {
    e.preventDefault();
    regTableWrapper.classList.add('hidden');
    regSummarySec.classList.add('hidden');
    loadReg.classList.remove('hidden');
    changeReg.classList.add('hidden');
  };

  shareReg2.onclick = e => {
    e.preventDefault();
    const hdr = `Register for ${regMonthIn.value}\nSchool: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}\nSection: ${localStorage.getItem('teacherSection')}`;
    const lines = Array.from(regSummaryBody.querySelectorAll('tr')).map(r=>{
      const td = r.querySelectorAll('td');
      return `${td[0].textContent}: P:${td[1].textContent}, A:${td[2].textContent}, Lt:${td[3].textContent}, HD:${td[4].textContent}, L:${td[5].textContent}, %:${td[6].textContent}`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines.join('\n'))}`, '_blank');
  };

  downloadReg2.onclick = e => {
    e.preventDefault();
    const { jsPDF }=window.jspdf, doc=new jsPDF('l','pt','a4');
    doc.text(localStorage.getItem('schoolName'),40,30);
    doc.text(`Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`,40,45);
    doc.text(`Register for ${regMonthIn.value}`,40,60);
    doc.autoTable({ html:'#registerTable', startY:75, styles:{fontSize:8} });
    doc.autoTable({ html:'#registerSummarySection table', startY:doc.lastAutoTable.finalY+10, styles:{fontSize:8} });
    doc.save('attendance_register.pdf');
  };
});
