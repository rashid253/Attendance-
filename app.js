window.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'var(--orange)', L:'var(--info)' };

  // SETUP
  const schoolIn = $('schoolNameInput'),
        classSel = $('teacherClassSelect'),
        secSel   = $('teacherSectionSelect'),
        saveSet  = $('saveSetup'),
        formSet  = $('setupForm'),
        dispSet  = $('setupDisplay'),
        txtSet   = $('setupText'),
        editSet  = $('editSetup');
  saveSet.onclick = e => {
    e.preventDefault();
    if (!schoolIn.value || !classSel.value || !secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  };
  editSet.onclick = e => { e.preventDefault(); formSet.classList.remove('hidden'); dispSet.classList.add('hidden'); };
  function loadSetup(){
    const s=localStorage.getItem('schoolName'),
          c=localStorage.getItem('teacherClass'),
          e=localStorage.getItem('teacherSection');
    if(s&&c&&e){
      schoolIn.value=s; classSel.value=c; secSel.value=e;
      txtSet.textContent = `${s} 🏫 | Class: ${c} | Section: ${e}`;
      formSet.classList.add('hidden'); dispSet.classList.remove('hidden');
    }
  }
  loadSetup();

  // STUDENT REGISTRATION (unchanged from prior)

  // ... code for registration omitted for brevity ...
  // ATTENDANCE
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');
  const dateIn     = $('dateInput'),
        loadAttBtn = $('loadAttendance'),
        attList    = $('attendanceList'),
        saveAttBtn = $('saveAttendance');
  const resSec         = $('attendance-result'),
        summaryBody    = $('summaryBody'),
        resetAttBtn    = $('resetAttendance'),
        shareAttBtn    = $('shareAttendanceSummary'),
        downloadAttBtn = $('downloadAttendancePDF');

  loadAttBtn.onclick = ev => {
    ev.preventDefault();
    if (!dateIn.value) return alert('Pick a date');
    attList.innerHTML = '';
    students.forEach(s=>{
      const row = document.createElement('div'), btns = document.createElement('div');
      row.className='attendance-item'; row.textContent=s.name;
      btns.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button');
        b.type='button'; b.className='att-btn'; b.dataset.code=code; b.textContent=code;
        if(attendanceData[dateIn.value]?.[s.roll]===code){
          b.style.background=colors[code]; b.style.color='#fff';
        }
        b.onclick = e2 => {
          e2.preventDefault();
          btns.querySelectorAll('.att-btn').forEach(x=>{ x.style.background=''; x.style.color='var(--dark)'; });
          b.style.background=colors[code]; b.style.color='#fff';
        };
        btns.append(b);
      });
      attList.append(row,btns);
    });
    saveAttBtn.classList.remove('hidden');
  };

  saveAttBtn.onclick = ev => {
    ev.preventDefault();
    const d=dateIn.value; attendanceData[d]={};
    Array.from(attList.querySelectorAll('.attendance-actions')).forEach((btns,i)=>{
      const sel=btns.querySelector('.att-btn[style*="background"]');
      attendanceData[d][students[i].roll] = sel?sel.dataset.code:'Not marked';
    });
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    $('attendance-section').classList.add('hidden');
    resSec.classList.remove('hidden');
    summaryBody.innerHTML = '';

    const setup = `School: ${localStorage.getItem('schoolName')}\nClass: ${localStorage.getItem('teacherClass')}, Section: ${localStorage.getItem('teacherSection')}\nDate: ${d}\n\nAttendance:`;
    summaryBody.insertAdjacentHTML('beforebegin', `<tr><td colspan="3"><em>${setup.replace(/\n/g,'<br>')}</em></td></tr>`);

    // build message lines and summary counts
    let present=0, absent=0, late=0, hd=0, leave=0;
    const lines = students.map(s=>{
      const code = attendanceData[d][s.roll];
      let txt = '';
      switch(code){
        case 'P': txt='Present'; present++; break;
        case 'A': txt='Absent'; absent++; break;
        case 'Lt': txt='Late'; late++; break;
        case 'HD': txt='Half Day'; hd++; break;
        case 'L': txt='Leave'; leave++; break;
        default: txt='Not marked';
      }
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${txt}</td><td><button type="button" class="send">Send</button></td>`;
      tr.querySelector('.send').onclick = e2 => {
        e2.preventDefault();
        const msg = `${setup}\n${s.name}: ${txt}`;
        window.open(`https://wa.me/${s.contact}?text=${encodeURIComponent(msg)}`, '_blank');
      };
      summaryBody.appendChild(tr);
      return `${s.name}: ${txt}`;
    });
    const summaryLine = `\nSummary:\nPresent: ${present}, Absent: ${absent}, Late: ${late}, Half Day: ${hd}, Leave: ${leave}`;

    // store for share
    shareAttBtn.dataset.msg = setup + '\n' + lines.join('\n') + summaryLine;
  };

  shareAttBtn.onclick = ev => {
    ev.preventDefault();
    const text = shareAttBtn.dataset.msg || '';
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  downloadAttBtn.onclick = ev => {
    ev.preventDefault();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    doc.autoTable({
      head:[['Name','Status']],
      body:Array.from(summaryBody.querySelectorAll('tr')).slice(1).map(r=>{
        const [n,s] = r.querySelectorAll('td');
        return [n.textContent, s.textContent];
      }),
      startY:40,margin:{left:40,right:40},styles:{fontSize:10}
    });
    doc.save('attendance_summary.pdf');
  };

  resetAttBtn.onclick = ev => {
    ev.preventDefault();
    resSec.classList.add('hidden');
    $('attendance-section').classList.remove('hidden');
    attList.innerHTML=''; saveAttBtn.classList.add('hidden'); summaryBody.innerHTML='';
  };

  // ... Analytics unchanged ...
});
