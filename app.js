// app.js

// Debug: ensure idb is loaded
console.log('app.js loaded, idb=', window.idb);

// ===== IndexedDB setup =====
const dbPromise = idb.openDB('attendance-db', 1, {
  upgrade(db) {
    db.createObjectStore('settings');
    db.createObjectStore('students', { keyPath: 'adm' });
    db.createObjectStore('attendance');
  }
});

// ===== Helper functions =====
async function getSetting(key)        { return (await dbPromise).get('settings', key); }
async function setSetting(key, val)   { return (await dbPromise).put('settings', val, key); }

async function getAllStudents()       { return (await dbPromise).getAll('students'); }
async function saveStudent(s)         { return (await dbPromise).put('students', s); }
async function deleteStudent(adm)     { return (await dbPromise).delete('students', adm); }

async function getAttendance(date)    { return (await dbPromise).get('attendance', date) || {}; }
async function saveAttendance(date,data){ return (await dbPromise).put('attendance', data, date); }
async function getAllAttendanceDates(){ return (await dbPromise).getAllKeys('attendance'); }

// ===== Main application =====
window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const colors = { P:'#4CAF50', A:'#f44336', Lt:'#FFEB3B', HD:'#FF9800', L:'#03a9f4' };

  // --- 1. SETUP ---
  const schoolIn = $('schoolNameInput'),
        classSel = $('teacherClassSelect'),
        secSel   = $('teacherSectionSelect'),
        saveSetup= $('saveSetup'),
        setupForm= $('setupForm'),
        setupDisp= $('setupDisplay'),
        setupTxt = $('setupText'),
        editSetup= $('editSetup');
  async function loadSetup(){
    const s=await getSetting('schoolName'),
          c=await getSetting('teacherClass'),
          e=await getSetting('teacherSection');
    if(s&&c&&e){
      schoolIn.value=s; classSel.value=c; secSel.value=e;
      setupTxt.textContent=`${s} 🏫 | Class: ${c} | Section: ${e}`;
      setupForm.classList.add('hidden');
      setupDisp.classList.remove('hidden');
    }
  }
  saveSetup.onclick=async e=>{
    e.preventDefault();
    if(!schoolIn.value||!classSel.value||!secSel.value) return alert('Complete setup');
    await setSetting('schoolName',schoolIn.value);
    await setSetting('teacherClass',classSel.value);
    await setSetting('teacherSection',secSel.value);
    await loadSetup();
  };
  editSetup.onclick=e=>{
    e.preventDefault();
    setupForm.classList.remove('hidden');
    setupDisp.classList.add('hidden');
  };
  await loadSetup();

  // --- 2. STUDENT REGISTRATION ---
  let students = await getAllStudents(), regSaved=false, inlineEdit=false;
  const studentNameIn   = $('studentName'),
        admissionNoIn   = $('admissionNo'),
        parentNameIn    = $('parentName'),
        parentContactIn = $('parentContact'),
        parentOccIn     = $('parentOccupation'),
        parentAddrIn    = $('parentAddress'),
        addStudentBtn   = $('addStudent'),
        studentsBody    = $('studentsBody'),
        selectAllCb     = $('selectAllStudents'),
        editSelBtn      = $('editSelected'),
        deleteSelBtn    = $('deleteSelected'),
        saveRegBtn      = $('saveRegistration'),
        shareRegBtn     = $('shareRegistration'),
        editRegBtn      = $('editRegistration'),
        dlRegBtn        = $('downloadRegistrationPDF');

  function bindSelection(){
    const boxes=[...document.querySelectorAll('.sel')];
    boxes.forEach(cb=>{
      cb.onchange=()=>{
        cb.closest('tr').classList.toggle('selected',cb.checked);
        const any=boxes.some(x=>x.checked);
        editSelBtn.disabled=deleteSelBtn.disabled=!any;
      };
    });
    selectAllCb.disabled=regSaved;
    selectAllCb.onchange=()=>boxes.forEach(cb=>{
      cb.checked=selectAllCb.checked;
      cb.dispatchEvent(new Event('change'));
    });
  }

  async function renderStudents(){
    students = await getAllStudents();
    studentsBody.innerHTML='';
    students.forEach(s=>{
      const tr=document.createElement('tr');
      tr.innerHTML=
        `<td><input type="checkbox" class="sel" data-adm="${s.adm}" ${regSaved?'disabled':''}></td>`+
        `<td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td>`+
        `<td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>`+
        `<td>${regSaved?'<button class="share-one">Share</button>':''}</td>`;
      if(regSaved){
        tr.querySelector('.share-one').onclick=()=> {
          const hdr=`School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
          const msg=`${hdr}\n\nName: ${s.name}\nAdm#: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
        };
      }
      studentsBody.appendChild(tr);
    });
    bindSelection();
  }

  addStudentBtn.onclick=async ()=>{
    const obj={
      name:studentNameIn.value.trim(),
      adm:admissionNoIn.value.trim(),
      parent:parentNameIn.value.trim(),
      contact:parentContactIn.value.trim(),
      occupation:parentOccIn.value.trim(),
      address:parentAddrIn.value.trim()
    };
    if(!obj.name||!obj.adm||!obj.parent||!obj.contact||!obj.occupation||!obj.address)
      return alert('All fields required');
    if(!/^\d+$/.test(obj.adm)) return alert('Adm# numeric');
    if(students.some(x=>x.adm===obj.adm)) return alert('Adm# exists');
    if(!/^\d{7,15}$/.test(obj.contact)) return alert('Contact 7–15 digits');
    await saveStudent(obj);
    [studentNameIn,admissionNoIn,parentNameIn,parentContactIn,parentOccIn,parentAddrIn].forEach(i=>i.value='');
    await renderStudents();
  };

  saveRegBtn.onclick=e=>{
    e.preventDefault();
    regSaved=true; renderStudents();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.add('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.remove('hidden'));
  };
  editRegBtn.onclick=e=>{
    e.preventDefault();
    regSaved=false; renderStudents();
    ['editSelected','deleteSelected','selectAllStudents','saveRegistration'].forEach(id=>$(id).classList.remove('hidden'));
    ['shareRegistration','editRegistration','downloadRegistrationPDF'].forEach(id=>$(id).classList.add('hidden'));
  };
  shareRegBtn.onclick=()=>{
    const hdr=`School: ${schoolIn.value}\nClass: ${classSel.value}\nSection: ${secSel.value}`;
    const lines=students.map(s=>`${s.name} (${s.adm})`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`,'_blank');
  };
  dlRegBtn.onclick=()=>{
    const { jsPDF }=window.jspdf, doc=new jsPDF();
    doc.setFontSize(16); doc.text('Student Registration',10,10);
    doc.autoTable({ head:[['Name','Adm#','Parent','Contact','Occ','Addr']],
      body:students.map(s=>[s.name,s.adm,s.parent,s.contact,s.occupation,s.address]), startY:20 });
    doc.save('student_registration.pdf');
  };
  deleteSelBtn.onclick=async()=>{
    const toDel=[...document.querySelectorAll('.sel:checked')].map(cb=>cb.dataset.adm);
    for(let a of toDel) await deleteStudent(a);
    await renderStudents();
  };
  await renderStudents();

  // --- 3. ATTENDANCE MARKING & SUMMARY ---
  const dateIn=$('dateInput'), loadAtt=$('loadAttendance'), attList=$('attendanceList'),
        saveAtt=$('saveAttendance'), resSec=$('attendance-result'), sumBody=$('summaryBody'),
        shareAtt=$('shareAttendanceSummary'), dlAtt=$('downloadAttendancePDF');
  loadAtt.onclick=async()=>{
    if(!dateIn.value) return alert('Pick date');
    attList.innerHTML='';
    const recs=await getAttendance(dateIn.value);
    students=await getAllStudents();
    students.forEach(s=>{
      const row=document.createElement('div'); row.textContent=s.name; row.className='attendance-item';
      const btns=document.createElement('div'); btns.className='attendance-actions';
      ['P','A','Lt','HD','L'].forEach(c=>{
        const b=document.createElement('button'); b.textContent=c; b.className='att-btn';
        if(recs[s.adm]===c){ b.style.background=colors[c]; b.style.color='#fff'; }
        b.onclick=()=>{ btns.querySelectorAll('.att-btn').forEach(x=>{x.style.background='';x.style.color='#333';}); b.style.background=colors[c]; b.style.color='#fff'; };
        btns.append(b);
      });
      attList.append(row,btns);
    });
    saveAtt.classList.remove('hidden');
  };
  saveAtt.onclick=async()=>{
    const d=dateIn.value, data={};
    document.querySelectorAll('.attendance-actions').forEach((btns,i)=>{
      const sel=btns.querySelector('.att-btn[style*="background"]');
      data[students[i].adm]=sel?sel.textContent:'A';
    });
    await saveAttendance(d,data);
    resSec.classList.remove('hidden'); sumBody.innerHTML='';
    const hdr=`Date:${d}\nSchool:${schoolIn.value}`;
    students.forEach(s=>{
      const st={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'}[data[s.adm]||'A'];
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${st}</td><td><button class="send-btn">Send</button></td>`;
      tr.querySelector('.send-btn').onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+s.name+': '+st)}`,'_blank');
      sumBody.appendChild(tr);
    });
  };
  shareAtt.onclick=()=>{/* analogous to shareReg */};
  dlAtt.onclick=()=>{/* analogous to dlReg with head ['Name','Status'] */};

  // --- 4. ANALYTICS ---
  const tgt=$('analyticsTarget'), admIn=$('studentAdmInput'),
        typeIn=$('analyticsType'), dateInA=$('analyticsDate'),
        monthIn=$('analyticsMonth'), semStart=$('semesterStart'),
        semEnd=$('semesterEnd'), yearIn=$('yearStart'),
        loadA=$('loadAnalytics'), resetA=$('resetAnalytics'),
        instr=$('instructions'), cont=$('analyticsContainer'),
        graphs=$('graphs'), shareA=$('shareAnalytics'),
        dlA=$('downloadAnalytics');
  let barChart, pieChart;
  function hideA(){ [dateInA,monthIn,semStart,semEnd,yearIn,instr,cont,graphs,resetA].forEach(e=>e.classList.add('hidden')); }
  tgt.onchange=()=>{ admIn.classList.toggle('hidden',tgt.value!=='student'); hideA(); typeIn.value=''; }
  typeIn.onchange=()=>{ hideA(); if(typeIn.value==='date') dateInA.classList.remove('hidden');
    if(typeIn.value==='month') monthIn.classList.remove('hidden');
    if(typeIn.value==='semester'){ semStart.classList.remove('hidden'); semEnd.classList.remove('hidden'); }
    if(typeIn.value==='year') yearIn.classList.remove('hidden');
    resetA.classList.remove('hidden');
  };
  resetA.onclick=e=>{ e.preventDefault(); hideA(); typeIn.value=''; };
  loadA.onclick=async e=>{
    e.preventDefault();
    let from,to;
    if(typeIn.value==='date'){ if(!dateInA.value) return alert('Pick date'); from=to=dateInA.value; }
    else if(typeIn.value==='month'){ if(!monthIn.value) return alert('Pick month');
      [y,m]=monthIn.value.split('-').map(Number); from=`${monthIn.value}-01`; to=`${monthIn.value}-${new Date(y,m,0).getDate()}`;
    }
    else if(typeIn.value==='semester'){ if(!semStart.value||!semEnd.value) return alert('Pick semester');
      [sy,sm]=semStart.value.split('-').map(Number); [ey,em]=semEnd.value.split('-').map(Number);
      from=`${semStart.value}-01`; to=`${semEnd.value}-${new Date(ey,em,0).getDate()}`;
    }
    else if(typeIn.value==='year'){ if(!yearIn.value) return alert('Pick year');
      from=`${yearIn.value}-01-01`; to=`${yearIn.value}-12-31`;
    } else return alert('Select period');
    students=await getAllStudents();
    const stats = (tgt.value==='student'
      ? students.filter(s=>s.adm===admIn.value.trim())
      : students
    ).map(s=>({ name:s.name, adm:s.adm, P:0,A:0,Lt:0,HD:0,L:0,total:0 }));
    const dates = await getAllAttendanceDates();
    dates.forEach(d=>{
      if(new Date(d)>=new Date(from)&&new Date(d)<=new Date(to)){
        getAttendance(d).then(recs=>{
          stats.forEach(st=>{
            const c=recs[st.adm]||'A'; st[c]++; st.total++;
          });
        });
      }
    });
    setTimeout(()=>{ // wait for async recs
      let html='<table><thead><tr><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th></tr></thead><tbody>';
      stats.forEach(s=>{ const pct=s.total?((s.P/s.total)*100).toFixed(1):'0.0';
        html+=`<tr><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${pct}</td></tr>`;
      });
      html+='</tbody></table>';
      cont.innerHTML=html; cont.classList.remove('hidden');
      instr.textContent = tgt.value==='student'
        ? `Admission#: ${admIn.value.trim()} | ${from} to ${to}`
        : `Report: ${from} to ${to}`;
      instr.classList.remove('hidden');
      const labels=stats.map(s=>s.name), dataPct=stats.map(s=>s.total?s.P/s.total*100:0);
      if(barChart) barChart.destroy();
      barChart=new Chart($('barChart').getContext('2d'),{type:'bar',data:{labels,datasets:[{label:'% Present',data:dataPct}]},options:{responsive:true,scales:{y:{beginAtZero:true,max:100}}}});
      const agg=stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(c=>a[c]+=s[c]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
      if(pieChart) pieChart.destroy();
      pieChart=new Chart($('pieChart').getContext('2d'),{type:'pie',data:{labels:['Present','Absent','Late','Half Day','Leave'],datasets:[{data:Object.values(agg)}]},options:{responsive:true}});
      graphs.classList.remove('hidden');
    },200);

    shareA.onclick=()=>{const hdr=instr.textContent+'\nSchool:'+schoolIn.value+'\nClass:'+classSel.value+'\nSection:'+secSel.value;
      const rows=[...cont.querySelectorAll('tbody tr')].map(r=>{
        const t=[...r.querySelectorAll('td')].map(td=>td.textContent);
        return `${t[0]} P:${t[1]} A:${t[2]} Lt:${t[3]} HD:${t[4]} L:${t[5]} %:${t[7]}`;
      }).join('\n');
      window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+rows)}`,'_blank');
    };
    dlA.onclick=()=>{const {jsPDF}=window.jspdf,doc=new jsPDF();
      doc.text('Attendance Analytics',10,10);
      doc.autoTable({html:'#analyticsContainer table',startY:20});
      doc.save('attendance_analytics.pdf');
    };
  };

  // --- 5. ATTENDANCE REGISTER ---
  const regMonth=$('registerMonth'), loadReg=$('loadRegister'),
        changeReg=$('changeRegister'), regWrap=$('registerTableWrapper'),
        regBody=$('registerBody'), regSumSec=$('registerSummarySection'),
        regSumBody=$('registerSummaryBody'),
        shareReg2=$('shareRegister'), dlReg2=$('downloadRegisterPDF');
  function genRegHeader(days){
    const ths=[...document.querySelectorAll('#registerTable thead th')];
    const tr=ths[0].parentElement; tr.innerHTML='<th>Sr#</th><th>Adm#</th><th>Name</th>';
    for(let d=1;d<=days;d++) tr.innerHTML+=`<th>${d}</th>`;
  }
  loadReg.onclick=async()=>{
    if(!regMonth.value)return alert('Select month');
    const [y,m]=regMonth.value.split('-').map(Number), days=new Date(y,m,0).getDate();
    genRegHeader(days);
    regBody.innerHTML=''; regSumBody.innerHTML='';
    students=await getAllStudents();
    const dates=await getAllAttendanceDates();
    students.forEach((s,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=days;d++){
        const ds=`${regMonth.value}-${String(d).padStart(2,'0')}`;
        const recs=dates.includes(ds)?await getAttendance(ds):{};
        const c=recs[s.adm]||'A';
        tr.innerHTML+=`<td style="background:${colors[c]};color:#fff">${c}</td>`;
      }
      regBody.appendChild(tr);
    });
    students.forEach(s=>{
      let cnt={P:0,A:0,Lt:0,HD:0,L:0}, total=0;
      for(let d=1;d<=days;d++){
        const ds=`${regMonth.value}-${String(d).padStart(2,'0')}`;
        const recs=dates.includes(ds)?await getAttendance(ds):{};
        const c=recs[s.adm]||'A';
        cnt[c]++; total++;
      }
      const pct=total?((cnt.P/total)*100).toFixed(1):'0.0';
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${s.name}</td><td>${cnt.P}</td><td>${cnt.A}</td><td>${cnt.Lt}</td><td>${cnt.HD}</td><td>${cnt.L}</td><td>${pct}</td>`;
      regSumBody.appendChild(tr);
    });
    regWrap.classList.remove('hidden'); regSumSec.classList.remove('hidden');
    loadReg.classList.add('hidden'); changeReg.classList.remove('hidden');
  };
  changeReg.onclick=e=>{e.preventDefault();regWrap.classList.add('hidden');regSumSec.classList.add('hidden');loadReg.classList.remove('hidden');changeReg.classList.add('hidden');};
  shareReg2.onclick=()=>{const hdr=`Register: ${regMonth.value}\nSchool:${schoolIn.value}\nClass:${classSel.value}\nSection:${secSel.value}`;
    const rows=[...regSumBody.querySelectorAll('tr')].map(r=>{
      const t=[...r.querySelectorAll('td')].map(td=>td.textContent);
      return `${t[0]} P:${t[1]} A:${t[2]} Lt:${t[3]} HD:${t[4]} L:${t[5]} %:${t[6]}`;
    }).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+rows)}`,'_blank');
  };
  dlReg2.onclick=()=>{const {jsPDF}=window.jspdf,doc=new jsPDF('landscape');
    doc.text('Monthly Attendance Register',10,10);
    doc.autoTable({html:'#registerTable',startY:20,styles:{fontSize:6}});
    doc.autoTable({html:'#registerSummarySection table',startY:doc.lastAutoTable.finalY+10,styles:{fontSize:8}});
    doc.save('attendance_register.pdf');
  };

  // --- Service Worker ---
  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js'));
  }

});
