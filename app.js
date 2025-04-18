window.addEventListener('DOMContentLoaded', ()=>{
  const $=id=>document.getElementById(id);
  // Setup
  const schoolIn=$('schoolNameInput'), classSel=$('teacherClassSelect'), secSel=$('teacherSectionSelect');
  const saveSet=$('saveSetup'), formSet=$('setupForm'), dispSet=$('setupDisplay'), txtSet=$('setupText'), editSet=$('editSetup');
  saveSet.addEventListener('click', ()=>{
    if(!schoolIn.value||!classSel.value||!secSel.value) return alert('Complete setup');
    localStorage.setItem('schoolName', schoolIn.value);
    localStorage.setItem('teacherClass', classSel.value);
    localStorage.setItem('teacherSection', secSel.value);
    loadSetup();
  });
  editSet.addEventListener('click', ()=>{ formSet.classList.remove('hidden'); dispSet.classList.add('hidden'); });
  function loadSetup(){
    const s=localStorage.getItem('schoolName');
    const c=localStorage.getItem('teacherClass');
    const e=localStorage.getItem('teacherSection');
    if(s&&c&&e){
      schoolIn.value=s; classSel.value=c; secSel.value=e;
      txtSet.textContent = `${s} 🏫 | Class: ${c} | Section: ${e}`;
      formSet.classList.add('hidden'); dispSet.classList.remove('hidden');
    }
  }
  loadSetup();

  // Student Registration
  let students = JSON.parse(localStorage.getItem('students')||'[]');
  const inputs = ['studentName','admissionNo','parentName','parentContact','parentOccupation','parentAddress'].map($);
  const addBtn = $('addStudent'), tblBody = $('studentsBody');
  function saveStudents(){ localStorage.setItem('students',JSON.stringify(students)); }
  function renderStudents(){
    tblBody.innerHTML='';
    students.forEach((s,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = 
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td>`+
        `<td>${s.occupation}</td><td>${s.address}</td>`+
        `<td class="actions">`+
          `<button class="edit"><i class="fas fa-edit"></i></button>`+
          `<button class="delete"><i class="fas fa-trash-alt"></i></button>`+
          `<button class="share"><i class="fas fa-share-alt"></i></button>`+
        `</td>`;
      // Events
      tr.querySelector('.edit').onclick = ()=>{
        ['name','adm','parent','contact','occupation','address'].forEach((key,idx)=>{
          const val = prompt(key, s[key])||s[key];
          s[key]=val;
        });
        saveStudents(); renderStudents();
      };
      tr.querySelector('.delete').onclick = ()=>{
        if(confirm('Delete this student?')){
          students.splice(i,1); saveStudents(); renderStudents();
        }
      };
      tr.querySelector('.share').onclick = ()=>{
        const msg = `Student: ${s.name}\nAdm#: ${s.adm}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
      };
      tblBody.appendChild(tr);
    });
  }
  addBtn.onclick = ()=>{
    const vals = inputs.map(inp=>inp.value.trim());
    if(!vals[0]||!vals[1]) return alert('Name & Adm# required');
    const [name,adm,parent,contact,occupation,address] = vals;
    students.push({name,adm,parent,contact,occupation,address,roll:Date.now()});
    saveStudents(); renderStudents();
    inputs.forEach(inp=>inp.value='');
  };
  $('shareAll').onclick = ()=>{
    const text = students.map(s=>`${s.name} (${s.adm})`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank');
  };
  $('saveAll').onclick = ()=>alert('Student data saved locally');
  renderStudents();

  // Attendance
  const dateIn = $('dateInput'), loadAtt = $('loadAttendance'), attList = $('attendanceList'), saveAtt = $('saveAttendance');
  const resSec = $('attendance-result'), summaryBody = $('summaryBody'), resetAtt = $('resetAttendance');
  let attendanceData = JSON.parse(localStorage.getItem('attendanceData')||'{}');
  const colors = { P:'var(--success)', A:'var(--danger)', Lt:'var(--warning)', HD:'var(--orange)', L:'var(--info)' };

  loadAtt.onclick = ()=>{
    if(!dateIn.value) return alert('Pick date');
    attList.innerHTML = '';
    students.forEach((s,i)=>{
      const row = document.createElement('div'); row.className='attendance-item';
      const btns = ['P','A','Lt','HD','L'].map(code=>
        `<button class="att-btn" data-code="${code}">${code}</button>`
      ).join('');
      row.innerHTML = `<span>${s.name}</span><div class="attendance-actions">${btns}</div>`;
      // restore
      const saved = attendanceData[dateIn.value]?.[s.roll];
      if(saved){
        const b = row.querySelector(`[data-code="${saved}"]`);
        b.style.background=colors[saved]; b.style.color='#fff';
      }
      row.querySelectorAll('.att-btn').forEach(btn=>{
        btn.onclick = ()=>{
          row.querySelectorAll('.att-btn').forEach(b=>{ b.style.background='transparent'; b.style.color=''; });
          const c=btn.dataset.code;
          btn.style.background=colors[c];
          btn.style.color='#fff';
        };
      });
      attList.appendChild(row);
    });
    saveAtt.classList.remove('hidden');
  };
  saveAtt.onclick = ()=>{
    const d = dateIn.value; attendanceData[d]={};
    attList.querySelectorAll('.attendance-item').forEach((r,i)=>{
      const b = r.querySelector('.att-btn[style*=background]');
      attendanceData[d][students[i].roll] = b?b.dataset.code:'Not marked';
    });
    localStorage.setItem('attendanceData',JSON.stringify(attendanceData));
    document.getElementById('attendance-section').classList.add('hidden'); resSec.classList.remove('hidden');
    summaryBody.innerHTML='';
    students.forEach(s=>{
      const st = attendanceData[d][s.roll];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.name}</td><td>${st}</td><td>
        <button class="share"><i class="fab fa-whatsapp"></i></button>
      </td>`;
      tr.querySelector('.share').onclick = ()=>{
        window.open(`https://wa.me/?text=${encodeURIComponent(`Attendance for ${s.name} on ${d}: ${st}`)}`,'_blank');
      };
      summaryBody.appendChild(tr);
    });
  };
  resetAtt.onclick = ()=>{
    resSec.classList.add('hidden'); document.getElementById('attendance-section').classList.remove('hidden');
    attList.innerHTML=''; saveAtt.classList.add('hidden');
  };

  // Analytics: unchanged
});
