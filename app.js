// app.js
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const THRESHOLD = 75;

  // --- Setup ---
  const schoolIn = $('schoolNameInput'),
        classSel = $('teacherClassSelect'),
        secSel   = $('teacherSectionSelect'),
        saveSet  = $('saveSetup'),
        formSet  = $('setupForm'),
        dispSet  = $('setupDisplay'),
        txtSet   = $('setupText'),
        editSet  = $('editSetup');

  function loadSetup() {
    const s = localStorage.getItem('schoolName'),
          c = localStorage.getItem('teacherClass'),
          e = localStorage.getItem('teacherSection');
    if (s && c && e) {
      schoolIn.value = s;
      classSel.value = c;
      secSel.value   = e;
      txtSet.textContent = `${s} 🏫 | Class: ${c} | Section: ${e}`;
      formSet.classList.add('hidden');
      dispSet.classList.remove('hidden');
    }
  }
  saveSet.onclick = () => {
    const s = schoolIn.value.trim(),
          c = classSel.value,
          e = secSel.value;
    if (!s || !c || !e) return alert('Complete setup');
    localStorage.setItem('schoolName', s);
    localStorage.setItem('teacherClass', c);
    localStorage.setItem('teacherSection', e);
    loadSetup();
  };
  editSet.onclick = () => {
    dispSet.classList.add('hidden');
    formSet.classList.remove('hidden');
  };
  loadSetup();

  // --- Student Registration ---
  let students = JSON.parse(localStorage.getItem('students')||'[]');
  const sName  = $('studentName'),
        admNo  = $('admissionNo'),
        fName  = $('fatherName'),
        mName  = $('motherName'),
        contact= $('contact'),
        addStu = $('addStudent'),
        delAll = $('deleteAllStudents'),
        stuTbl = $('studentsTable'),
        stuBody= stuTbl.querySelector('tbody'),
        shareAllStu = $('shareAllStudents'),
        dlAllStu    = $('downloadAllStudents');

  function renderStudents() {
    if (!students.length) {
      stuTbl.classList.add('hidden');
      return;
    }
    stuTbl.classList.remove('hidden');
    stuBody.innerHTML = '';
    students.forEach((s,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.name}</td>
        <td>${s.adm}</td>
        <td>${s.father}</td>
        <td>${s.mother}</td>
        <td>${s.contact}</td>
        <td>
          <button class="edit">Edit</button>
          <button class="delete">Delete</button>
        </td>`;
      tr.querySelector('.edit').onclick = () => {
        const name = prompt('Student Name', s.name);
        if (!name) return;
        s.name = name.trim();
        s.adm = prompt('Admission No', s.adm) || '';
        s.father = prompt('Father Name', s.father) || '';
        s.mother = prompt('Mother Name', s.mother) || '';
        s.contact = prompt('Contact', s.contact) || '';
        localStorage.setItem('students', JSON.stringify(students));
        renderStudents();
      };
      tr.querySelector('.delete').onclick = () => {
        if (!confirm('Delete this student?')) return;
        students.splice(i,1);
        localStorage.setItem('students', JSON.stringify(students));
        renderStudents();
      };
      stuBody.append(tr);
    });
  }
  addStu.onclick = () => {
    const name = sName.value.trim(),
          adm  = admNo.value.trim(),
          father = fName.value.trim(),
          mother = mName.value.trim(),
          cont   = contact.value.trim();
    if (!name||!father||!mother||!cont) return alert('All fields except Admission No are required');
    students.push({name,adm,father,mother,contact:cont,roll:Date.now()});
    localStorage.setItem('students', JSON.stringify(students));
    sName.value = admNo.value = fName.value = mName.value = contact.value = '';
    renderStudents();
  };
  delAll.onclick = () => {
    if (!confirm('Delete all students?')) return;
    students = [];
    localStorage.setItem('students','[]');
    renderStudents();
  };
  renderStudents();

  shareAllStu.onclick = () => {
    const text = students.map(s=>`${s.name} | Adm#: ${s.adm} | Father: ${s.father} | Mother: ${s.mother} | Contact: ${s.contact}`).join('\n');
    if (navigator.share) navigator.share({ title:'All Students', text });
    else alert('Share not supported');
  };
  dlAllStu.onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.autoTable({ head:[['Name','Adm#','Father','Mother','Contact']], body: students.map(s=>[s.name,s.adm,s.father,s.mother,s.contact]) });
    doc.save('Students.pdf');
  };

  // --- Attendance Marking ---
  const dateIn = $('dateInput'),
        loadAtt = $('loadAttendance'),
        attTbl  = $('attendanceTable'),
        attBody = attTbl.querySelector('tbody'),
        saveAtt = $('saveAttendance'),
        shareAllA = $('shareAllAttendance'),
        sumSec = $('attendance-result'),
        sumList= $('attendanceResultList'),
        resetAtt = $('resetAttendance');

  loadAtt.onclick = () => {
    const d = dateIn.value; if(!d) return alert('Pick a date');
    if(!students.length) return alert('No students');
    attTbl.classList.remove('hidden');
    attBody.innerHTML = '';
    students.forEach(s=>{
      const tr = document.createElement('tr');
      tr.style.background='transparent';
      tr.innerHTML = `
        <td>${s.name}</td>
        <td><button>P</button></td>
        <td><button>A</button></td>
        <td><button>Lt</button></td>
        <td><button>HD</button></td>
        <td><button>L</button></td>`;
      ['P','A','Lt','HD','L'].forEach((code,idx)=>{
        tr.cells[idx+1].firstChild.onclick = () => {
          tr.style.background = {P:'#c8e6c9',A:'#ffcdd2',Lt:'#bbdefb',HD:'#ffe0b2',L:'#d1c4e9'}[code];
          tr.dataset.status = code;
        };
      });
      attBody.append(tr);
    });
    saveAtt.classList.remove('hidden');
    shareAllA.classList.remove('hidden');
  };

  saveAtt.onclick = () => {
    const d = dateIn.value, data = JSON.parse(localStorage.getItem('attendanceData')||'{}');
    data[d] = {};
    attBody.querySelectorAll('tr').forEach((tr,i)=>{
      data[d][students[i].roll] = tr.dataset.status||'';
    });
    localStorage.setItem('attendanceData', JSON.stringify(data));
    sumList.innerHTML = '';
    Object.entries(data[d]).forEach(([roll,status])=>{
      const s = students.find(x=>x.roll==roll);
      const li = document.createElement('li');
      li.textContent = `${s.name}: ${status||'N/M'}`;
      sumList.append(li);
    });
    sumSec.classList.remove('hidden');
  };

  shareAllA.onclick = () => {
    const items = Array.from(sumList.children).map(li=>li.textContent).join('\n');
    const url = `https://wa.me/?text=${encodeURIComponent(items)}`;
    window.open(url,'_blank');
  };

  resetAtt.onclick = () => {
    attTbl.classList.add('hidden');
    saveAtt.classList.add('hidden');
    shareAllA.classList.add('hidden');
    sumSec.classList.add('hidden');
    sumList.innerHTML='';
  };

  // --- Analytics ---
  const typeSel   = $('analyticsType'),
        aDate     = $('analyticsDate'),
        aMonth    = $('analyticsMonth'),
        semStart  = $('semesterStart'),
        semEnd    = $('semesterEnd'),
        yrStart   = $('yearStart'),
        loadA     = $('loadAnalytics'),
        resetA    = $('resetAnalytics'),
        instr     = $('instructions'),
        contA     = $('analyticsContainer'),
        graphs    = $('graphs'),
        barCtx    = $('barChart').getContext('2d'),
        pieCtx    = $('pieChart').getContext('2d'),
        shareA    = $('shareAnalytics'),
        downloadA = $('downloadAnalytics');
  let chartBar, chartPie;

  function toggleInputs() {
    [aDate,aMonth,semStart,semEnd,yrStart].forEach(el=>el.classList.add('hidden'));
    const v = typeSel.value;
    if(v==='date')     aDate.classList.remove('hidden');
    if(v==='month')    aMonth.classList.remove('hidden');
    if(v==='semester'){ semStart.classList.remove('hidden'); semEnd.classList.remove('hidden'); }
    if(v==='year')     yrStart.classList.remove('hidden');
  }
  typeSel.onchange = toggleInputs;

  function buildDates() {
    const v=typeSel.value, arr=[], push=(s,e)=>{
      let c=new Date(s);
      while(c<=e){
        arr.push(c.toISOString().slice(0,10));
        c.setDate(c.getDate()+1);
      }
    };
    if(v==='date'){
      const d=new Date(aDate.value); if(!isNaN(d)) arr.push(d.toISOString().slice(0,10));
    }
    if(v==='month'){
      const [y,m]=aMonth.value.split('-');
      push(new Date(y,m-1,1), new Date(y,m,0));
    }
    if(v==='semester'){
      const [ys,ms]=semStart.value.split('-'),
            [ye,me]=semEnd.value.split('-');
      push(new Date(ys,ms-1,1), new Date(ye,me,0));
    }
    if(v==='year'){
      const [ys,ms]=yrStart.value.split('-');
      const s=new Date(ys,ms-1,1), e=new Date(s);
      e.setMonth(e.getMonth()+11); e.setDate(0);
      push(s,e);
    }
    return arr;
  }

  loadA.onclick = () => {
    const dates = buildDates();
    if(!dates.length) return alert('Select period');
    resetA.classList.remove('hidden');
    instr.classList.remove('hidden');
    contA.classList.remove('hidden');
    graphs.classList.remove('hidden');
    shareA.classList.remove('hidden');
    downloadA.classList.remove('hidden');

    instr.innerHTML = `
      <h3>Instructions & Formulas</h3>
      <p>Attendance % = (P+Lt+HD)/TotalDays × 100</p>
      <p>Threshold: ${THRESHOLD}%</p>
    `;

    const dataA = JSON.parse(localStorage.getItem('attendanceData')||'{}');
    const summary = students.map(s=>{
      const cnt={P:0,A:0,Lt:0,HD:0,L:0};
      dates.forEach(d=>{
        const st=(dataA[d]||{})[s.roll]||'';
        if(st) cnt[st]++;
      });
      const pct = Math.round((cnt.P+cnt.Lt+cnt.HD)/dates.length*100);
      return { name:s.name, ...cnt, pct };
    });

    contA.innerHTML = '';
    const tbl = document.createElement('table');
    tbl.border=1; tbl.style.width='100%';
    tbl.innerHTML = `
      <tr><th>Name</th><th>P</th><th>Lt</th><th>HD</th><th>L</th><th>A</th><th>%</th><th>Elig</th></tr>
      ${summary.map(r=>`
        <tr>
          <td>${r.name}</td>
          <td>${r.P}</td><td>${r.Lt}</td><td>${r.HD}</td><td>${r.L}</td><td>${r.A}</td>
          <td>${r.pct}%</td><td>${r.pct>=THRESHOLD?'✓':'✗'}</td>
        </tr>`).join('')}
    `;
    contA.append(tbl);

    const labels = summary.map(r=>r.name),
          data = summary.map(r=>r.pct);
    if(chartBar) chartBar.destroy();
    chartBar = new Chart(barCtx, { type:'bar', data:{labels,datasets:[{label:'%',data}]}, options:{responsive:true} });
    if(chartPie) chartPie.destroy();
    chartPie = new Chart(pieCtx, { type:'pie', data:{labels,datasets:[{data}]}, options:{responsive:true} });
  };

  resetA.onclick = () => {
    [aDate,aMonth,semStart,semEnd,yrStart].forEach(el=>el.classList.add('hidden'));
    typeSel.value='';
    resetA.classList.add('hidden');
    instr.classList.add('hidden');
    contA.classList.add('hidden');
    graphs.classList.add('hidden');
    shareA.classList.add('hidden');
    downloadA.classList.add('hidden');
    contA.innerHTML='';
  };

  shareA.onclick = () => {
    const txt = instr.innerText + '\n\n' + contA.innerText;
    if(navigator.share) navigator.share({ title:'Analytics Summary', text:txt });
    else alert('Share not supported');
  };

  downloadA.onclick = () => {
    const { jsPDF } = window.jspdf, doc = new jsPDF('p','pt','a4');
    let y=20; doc.setFontSize(12);
    instr.querySelectorAll('p').forEach(p=>{ doc.text(p.innerText,20,y); y+=15; });
    y+=10;
    doc.autoTable({ html:contA.querySelector('table'), startY:y, margin:{left:20,right:20} });
    y = doc.lastAutoTable.finalY + 20;
    doc.text('Bar Chart',20,y); y+=10;
    doc.addImage($('barChart').toDataURL(),'PNG',20,y,550,200); y+=210;
    doc.text('Pie Chart',20,y); y+=10;
    doc.addImage($('pieChart').toDataURL(),'PNG',20,y,300,200);
    doc.save('Analytics_Report.pdf');
  };

});
