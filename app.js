// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // Eruda (optional)
  const erudaScript=document.createElement('script');
  erudaScript.src='https://cdn.jsdelivr.net/npm/eruda';
  erudaScript.onload=()=>eruda.init();
  document.body.appendChild(erudaScript);

  // IndexedDB
  if(!window.idbKeyval) return console.error('idb-keyval?');
  const {get,set}=window.idbKeyval;

  // State
  let students       =await get('students')       || [];
  let attendanceData =await get('attendanceData') || {};
  let finesData      =await get('finesData')      || {};
  let paymentsData   =await get('paymentsData')   || {};
  let lastAdmNo      =await get('lastAdmissionNo')|| 0;
  let fineRates      =await get('fineRates')      || {A:50,Lt:20,L:10,HD:0};
  let eligibilityPct =await get('eligibilityPct') || 75;

  const save=(k,v)=>set(k,v);
  async function genAdmNo(){
    lastAdmNo++; await save('lastAdmissionNo',lastAdmNo);
    return String(lastAdmNo).padStart(4,'0');
  }

  const $=id=>document.getElementById(id);
  const show=(...e)=>e.forEach(x=>x?.classList.remove('hidden'));
  const hide=(...e)=>e.forEach(x=>x?.classList.add('hidden'));

  // Cache
  const regForm=document.querySelector('#student-registration .row-inline');

  // 1. Settings
  $('fineAbsent').value   =fineRates.A;
  $('fineLate').value     =fineRates.Lt;
  $('fineLeave').value    =fineRates.L;
  $('fineHalfDay').value  =fineRates.HD;
  $('eligibilityPct').value=eligibilityPct;
  $('saveSettings').onclick=async()=>{
    fineRates={
      A: Number($('fineAbsent').value)||0,
      Lt:Number($('fineLate').value)||0,
      L: Number($('fineLeave').value)||0,
      HD:Number($('fineHalfDay').value)||0
    };
    eligibilityPct=Number($('eligibilityPct').value)||0;
    await Promise.all([save('fineRates',fineRates),save('eligibilityPct',eligibilityPct)]);
    alert('Saved');
  };

  // 2. Setup
  async function loadSetup(){
    const [sc,cl,sec]=await Promise.all([get('schoolName'),get('teacherClass'),get('teacherSection')]);
    if(sc&&cl&&sec){
      $('schoolNameInput').value=sc;
      $('teacherClassSelect').value=cl;
      $('teacherSectionSelect').value=sec;
      $('setupText').textContent=`${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm')); show($('setupDisplay'));
      renderStudents(); updateCounters(); resetViews();
    }
  }
  $('saveSetup').onclick=async e=>{
    e.preventDefault();
    const sc=$('schoolNameInput').value.trim(),
          cl=$('teacherClassSelect').value,
          sec=$('teacherSectionSelect').value;
    if(!sc||!cl||!sec)return alert('Complete');
    await Promise.all([save('schoolName',sc),save('teacherClass',cl),save('teacherSection',sec)]);
    await loadSetup();
  };
  $('editSetup').onclick=e=>{e.preventDefault();show($('setupForm'));hide($('setupDisplay'));};
  await loadSetup();

  // 3. Counters
  function animate(){
    document.querySelectorAll('.number').forEach(span=>{
      const tgt=+span.dataset.target; let c=0,step=Math.max(1,tgt/100);
      (function up(){c+=step;span.textContent=c<tgt?Math.ceil(c):tgt;if(c<tgt)requestAnimationFrame(up);}());
    });
  }
  function updateCounters(){
    const cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    $('sectionCount').dataset.target=students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('classCount').dataset.target=students.filter(s=>s.cls===cl).length;
    $('schoolCount').dataset.target=students.length;
    animate();
  }
  $('teacherClassSelect').onchange=()=>{renderStudents();updateCounters();resetViews();};
  $('teacherSectionSelect').onchange=()=>{renderStudents();updateCounters();resetViews();};

  function resetViews(){
    hide(
      $('attendanceBody'),$('saveAttendance'),$('resetAttendance'),
      $('attendanceSummary'),$('downloadAttendancePDF'),$('shareAttendanceSummary'),
      $('instructions'),$('analyticsContainer'),$('graphs'),$('analyticsActions'),
      $('registerTableWrapper'),$('changeRegister'),$('saveRegister'),
      $('downloadRegister'),$('shareRegister')
    );
    show($('loadRegister'));
  }

  // 4. Student Reg
  function renderStudents(){
    const cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    const tbody=$('studentsBody');tbody.innerHTML='';let idx=0;
    students.forEach((s,i)=>{
      if(s.cls!==cl||s.sec!==sec)return;
      idx++;
      const tf=(finesData[s.adm]||[]).reduce((a,f)=>a+f.amount,0),
            tp=(paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0),
            out=tf-tp,
            days=Object.keys(attendanceData).length,
            pres=Object.values(attendanceData).filter(r=>r[s.adm]==='P').length,
            pct=days?pres/days*100:0,
            status=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr=document.createElement('tr');tr.dataset.index=i;
      tr.innerHTML=`
        <td><input class="sel" type="checkbox"/></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td>
        <td>₹ ${out}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>`;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked=false;toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }
  function toggleButtons(){
    const any=!!document.querySelector('.sel:checked');
    $('editSelected').disabled=!any; $('deleteSelected').disabled=!any;
  }
  $('studentsBody').addEventListener('change',e=>{if(e.target.classList.contains('sel'))toggleButtons();});
  $('selectAllStudents').onclick=()=>{document.querySelectorAll('.sel').forEach(cb=>cb.checked=$('selectAllStudents').checked);toggleButtons();};

  $('addStudent').onclick=async e=>{
    e.preventDefault();
    const n=$('studentName').value.trim(),p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(),o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim(),cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a)return alert('All required');
    if(!/^\d{7,15}$/.test(c))return alert('Contact 7–15 digits');
    const adm=await genAdmNo();
    students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls:cl,sec});
    await save('students',students);
    renderStudents();updateCounters();resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };

  $('editSelected').onclick=()=>{
    document.querySelectorAll('.sel:checked').forEach(cb=>{
      const tr=cb.closest('tr'),i=+tr.dataset.index,s=students[i];
      tr.innerHTML=`
        <td><input class="sel" type="checkbox" checked/></td>
        <td>${tr.children[1].textContent}</td>
        <td><input value="${s.name}"/></td>
        <td>${s.adm}</td>
        <td><input value="${s.parent}"/></td>
        <td><input value="${s.contact}"/></td>
        <td><input value="${s.occupation}"/></td>
        <td><input value="${s.address}"/></td>
        <td colspan="3"></td>`;
    });
    hide($('editSelected'));show($('doneEditing'));
  };
  $('doneEditing').onclick=async()=>{
    document.querySelectorAll('#studentsBody tr').forEach(tr=>{
      const inp=[...tr.querySelectorAll('input:not(.sel)')];
      if(inp.length===5){
        const [n,p,c,o,a]=inp.map(i=>i.value.trim());
        const adm=tr.children[3].textContent,idx=students.findIndex(s=>s.adm===adm);
        if(idx>-1)students[idx]={...students[idx],name:n,parent:p,contact:c,occupation:o,address:a};
      }
    });
    await save('students',students);
    hide($('doneEditing'));show($('editSelected'),$('deleteSelected'),$('saveRegistration'));
    renderStudents();updateCounters();
  };

  $('deleteSelected').onclick=async()=>{
    if(!confirm('Delete?'))return;
    const toDel=[...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students=students.filter((_,i)=>!toDel.includes(i));
    await save('students',students);
    renderStudents();updateCounters();resetViews();
  };

  $('saveRegistration').onclick=async()=>{
    if(!$('doneEditing').classList.contains('hidden'))return alert('Finish editing');
    await save('students',students);
    hide(regForm,$('editSelected'),$('deleteSelected'),$('selectAllStudents'),$('saveRegistration'));
    show($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF'));
    renderStudents();updateCounters();
  };
  $('editRegistration').onclick=()=>{
    show(regForm,$('selectAllStudents'),$('editSelected'),$('deleteSelected'),$('saveRegistration'));
    hide($('editRegistration'),$('shareRegistration'),$('downloadRegistrationPDF'));
    renderStudents();updateCounters();
  };

  $('shareRegistration').onclick=()=>{
    const cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    const hdr=`*Students List*\nClass ${cl} Sec ${sec}`;
    const lines=students.filter(s=>s.cls===cl&&s.sec===sec).map(s=>{
      const tf=(finesData[s.adm]||[]).reduce((a,f)=>a+f.amount,0);
      const tp=(paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
      const out=tf-tp;const days=Object.keys(attendanceData).length;
      const pres=Object.values(attendanceData).filter(r=>r[s.adm]==='P').length;
      const pct=days?pres/days*100:0;
      const st=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      return `*${s.name}*\nAdm#: ${s.adm}\nOut: ₹${out}\nStatus: ${st}`;
    }).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`,'_blank');
  };
  $('downloadRegistrationPDF').onclick=()=>{
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18);doc.text('Student List',14,16);
    doc.setFontSize(12);doc.text($('setupText').textContent,14,24);
    doc.autoTable({startY:32,html:'#studentsTable'});
    const u=doc.output('bloburl');window.open(u,'_blank');doc.save('registration.pdf');
  };

  // 7. MARK ATTENDANCE
  const dateIn=$('dateInput'),loadAtt=$('loadAttendance'),
        saveAtt=$('saveAttendance'),resetAtt=$('resetAttendance'),
        dlAtt=$('downloadAttendancePDF'),
        shareAtt=$('shareAttendanceSummary'),
        attBody=$('attendanceBody'),
        attSum=$('attendanceSummary');
  const sNames={P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'};
  const sCols={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};

  loadAtt.onclick=()=>{
    attBody.innerHTML='';attSum.innerHTML='';
    const cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    const roster=students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((stu,i)=>{
      const row=document.createElement('div');row.className='attendance-row';
      const nd=document.createElement('div');nd.className='attendance-name';nd.textContent=stu.name;
      const btns=document.createElement('div');btns.className='attendance-buttons';
      for(const code in sNames){
        const btn=document.createElement('button');btn.className='att-btn';btn.textContent=code;
        btn.onclick=()=>{
          btns.querySelectorAll('.att-btn').forEach(b=>{b.classList.remove('selected');b.style='';});
          btn.classList.add('selected');btn.style.background=sCols[code];btn.style.color='#fff';
        };
        btns.append(btn);
      }
      row.append(nd,btns);attBody.append(row);
    });
    show(attBody,saveAtt);hide(resetAtt,dlAtt,shareAtt,attSum);
  };
  saveAtt.onclick=async()=>{
    const date=dateIn.value; if(!date)return alert('Pick date');
    attendanceData[date]={};
    const cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    const roster=students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((s,i)=>{
      const btn=attBody.children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm]=btn?btn.textContent:'A';
    });
    await save('attendanceData',attendanceData);
    attSum.innerHTML=`<h3>Attendance: ${date}</h3>`;
    const tbl=document.createElement('table');tbl.innerHTML='<tr><th>Name</th><th>Status</th><th>Share</th></tr>';
    roster.forEach(s=>{
      const c=attendanceData[date][s.adm];
      tbl.innerHTML+=`<tr><td>${s.name}</td><td>${sNames[c]}</td><td><i class="fas fa-share-alt share-individual" data-adm="${s.adm}"></i></td></tr>`;
    });
    attSum.append(tbl);
    attSum.querySelectorAll('.share-individual').forEach(ic=>ic.onclick=()=>{
      const adm=ic.dataset.adm, stu=students.find(x=>x.adm===adm), c=attendanceData[date][adm];
      const msg=`Dear Parent, your child was ${sNames[c]} on ${date}.`;
      window.open(`https://wa.me/${stu.contact}?text=${encodeURIComponent(msg)}`,'_blank');
    });
    hide(saveAtt,attBody);show(resetAtt,dlAtt,shareAtt,attSum);
  };
  resetAtt.onclick=()=>{show(attBody,saveAtt);hide(resetAtt,dlAtt,shareAtt,attSum);};
  dlAtt.onclick=()=>{
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18);doc.text(`Attendance - ${$('setupText').textContent}`,14,16);
    doc.setFontSize(12);doc.text(`Date: ${dateIn.value}`,14,24);
    doc.autoTable({startY:32,html:'#attendanceSummary table'});
    const u=doc.output('bloburl');window.open(u,'_blank');doc.save(`attendance_${dateIn.value}.pdf`);
  };
  shareAtt.onclick=()=>{
    const cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value,date=dateIn.value;
    const hdr=`*Attendance*\nClass ${cl} Sec ${sec} - ${date}`;
    const lines=students.filter(s=>s.cls===cl&&s.sec===sec)
      .map(s=>`*${s.name}*: ${sNames[attendanceData[date][s.adm]]}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n\n'+lines)}`,'_blank');
  };

  // 8. ANALYTICS
  const atg=$('analyticsTarget'), asel=$('analyticsSectionSelect'),
        atype=$('analyticsType'), adate=$('analyticsDate'),
        amonth=$('analyticsMonth'), sems=$('semesterStart'),
        seme=$('semesterEnd'), ayear=$('yearStart'),
        asearch=$('analyticsSearch'),
        loadA=$('loadAnalytics'), resetA=$('resetAnalytics'),
        instr=$('instructions'), acont=$('analyticsContainer'),
        graphs=$('graphs'), aacts=$('analyticsActions'),
        barCtx=$('barChart').getContext('2d'), pieCtx=$('pieChart').getContext('2d');
  let barC,pieC,lastAnalyticsShare='';
  atg.onchange=()=>{
    acont.classList.add('hidden');graphs.classList.add('hidden');aacts.classList.add('hidden');
    atype.disabled=false;
    asearch.classList.add('hidden');asel.classList.add('hidden');
    if(atg.value==='section') asel.classList.remove('hidden');
    if(atg.value==='student')asearch.classList.remove('hidden');
  };
  atype.onchange=()=>{
    [adate,amonth,sems,seme,ayear].forEach(x=>x.classList.add('hidden'));
    instr.classList.add('hidden');acont.classList.add('hidden');graphs.classList.add('hidden');aacts.classList.add('hidden');
    resetA.classList.remove('hidden');
    if(atype.value==='date')adate.classList.remove('hidden');
    if(atype.value==='month')amonth.classList.remove('hidden');
    if(atype.value==='semester'){sems.classList.remove('hidden');seme.classList.remove('hidden');}
    if(atype.value==='year')ayear.classList.remove('hidden');
  };
  resetA.onclick=e=>{e.preventDefault();atype.value='';resetA.classList.add('hidden');[adate,amonth,sems,seme,ayear,instr,acont,graphs,aacts].forEach(x=>x.classList.add('hidden'));};
  loadA.onclick=()=>{
    if(atg.value==='student'&&!asearch.value.trim())return alert('Enter query');
    let from,to; const typ=atype.value;
    if(typ==='date'){from=to=adate.value;}
    else if(typ==='month'){const [y,m]=amonth.value.split('-').map(Number);from=`${amonth.value}-01`;to=`${amonth.value}-${new Date(y,m,0).getDate()}`;}
    else if(typ==='semester'){const [sy,sm]=sems.value.split('-').map(Number),[ey,em]=seme.value.split('-').map(Number);from=`${sems.value}-01`;to=`${seme.value}-${new Date(ey,em,0).getDate()}`;}
    else if(typ==='year'){from=`${ayear.value}-01-01`;to=`${ayear.value}-12-31`;}
    else return alert('Select period');
    const cls=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    let pool=students.filter(s=>s.cls===cls&&s.sec===sec);
    if(atg.value==='section')pool=pool.filter(s=>s.sec===asel.value);
    if(atg.value==='student'){const q=asearch.value.trim().toLowerCase();pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q));}
    const stats=pool.map(s=>({adm:s.adm,name:s.name,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs])=>{
      if(d<from||d>to)return;stats.forEach(st=>{const c=recs[st.adm]||'A';st[c]++;st.total++;});
    });
    const thead=$('analyticsTable').querySelector('thead tr');
    thead.innerHTML='<th>#</th><th>Adm#</th><th>Name</th><th>P</th><th>A</th><th>Lt</th><th>HD</th><th>L</th><th>Total</th><th>%</th>';
    const tbody=$('analyticsBody');tbody.innerHTML='';
    stats.forEach((st,i)=>{const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0';const tr=document.createElement('tr');
      tr.innerHTML=`<td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${pct}%</td>`;
      tbody.append(tr);
    });
    instr.textContent=`Period: ${from} to ${to}`;show(instr,acont,graphs,aacts);
    barC?.destroy();barC=new Chart(barCtx,{type:'bar',data:{labels:stats.map(s=>s.name),datasets:[{label:'% Present',data:stats.map(s=>s.total?s.P/s.total*100:0)}]},options:{scales:{y:{beginAtZero:true,max:100}}}});
    const agg=stats.reduce((a,s)=>{['P','A','Lt','HD','L'].forEach(k=>a[k]+=s[k]);return a;},{P:0,A:0,Lt:0,HD:0,L:0});
    pieC?.destroy();pieC=new Chart(pieCtx,{type:'pie',data:{labels:['P','A','Lt','HD','L'],datasets:[{data:Object.values(agg)}]}});
    lastAnalyticsShare=`Analytics (${from} to ${to})\n`+stats.map((st,i)=>`${i+1}. ${st.adm} ${st.name}: ${((st.P||0)/(st.total||1)*100).toFixed(1)}%`).join('\n');
  };
  $('shareAnalytics').onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`,'_blank');
  $('downloadAnalytics').onclick=()=>{
    const doc=new jspdf.jsPDF();doc.setFontSize(18);doc.text('Attendance Report',14,16);doc.setFontSize(12);doc.text($('setupText').textContent,14,24);doc.autoTable({startY:32,html:'#analyticsTable'});const url=doc.output('bloburl');window.open(url,'_blank');doc.save('analytics_report.pdf');
  };

  // 9. ATTENDANCE REGISTER
  const loadReg=$('loadRegister'),changeReg=$('changeRegister'),saveReg=$('saveRegister'),
        dlReg=$('downloadRegister'),shReg=$('shareRegister'),
        rm=$('registerMonth'),rh=$('registerHeader'),rb=$('registerBody'),rw=$('registerTableWrapper');
  const codes=['A','P','Lt','HD','L'],colors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};
  changeReg?.classList.add('hidden');saveReg?.classList.add('hidden');dlReg?.classList.add('hidden');shReg?.classList.add('hidden');
  loadReg.onclick=()=>{
    const m=rm.value; if(!m)return alert('Pick month');
    const [y,mm]=m.split('-').map(Number),days=new Date(y,mm,0).getDate();
    rh.innerHTML='<th>#</th><th>Adm#</th><th>Name</th>'+[...Array(days)].map((_,i)=>`<th>${i+1}</th>`).join('');
    rb.innerHTML='';const cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    const roster=students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((s,i)=>{
      let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=days;d++){
        const key=`${m}-${String(d).padStart(2,'0')}`,c=(attendanceData[key]||{})[s.adm]||'A',style=c==='A'?'':` style="background:${colors[c]};color:#fff"`;
        row+=`<td class="reg-cell"${style}><span class="status-text">${c}</span></td>`;
      }
      const tr=document.createElement('tr');tr.innerHTML=row;rb.append(tr);
    });
    rb.querySelectorAll('.reg-cell').forEach(cell=>{
      cell.onclick=()=>{
        const stxt=cell.querySelector('.status-text');let idx=codes.indexOf(stxt.textContent);
        idx=(idx+1)%codes.length;const c=codes[idx];stxt.textContent=c;
        if(c==='A'){cell.style.background='';cell.style.color='';}else{cell.style.background=colors[c];cell.style.color='#fff';}
      };
    });
    show(rw,saveReg);hide(loadReg,changeReg,dlReg,shReg);
  };
  saveReg.onclick=async()=>{
    const m=rm.value,[y,mm]=m.split('-').map(Number),days=new Date(y,mm,0).getDate();
    [...rb.children].forEach(tr=>{
      const adm=tr.children[1].textContent;
      for(let d=1;d<=days;d++){
        const c=tr.children[2+d].querySelector('.status-text').textContent;
        const key=`${m}-${String(d).padStart(2,'0')}`;
        attendanceData[key]=attendanceData[key]||{};
        attendanceData[key][adm]=c;
      }
    });
    await save('attendanceData',attendanceData);
    hide(saveReg);show(changeReg,dlReg,shReg);
  };
  changeReg.onclick=()=>{hide(changeReg,dlReg,shReg);show(saveReg);};
  dlReg.onclick=()=>{
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18);doc.text('Attendance Register',14,16);
    doc.setFontSize(12);doc.text($('setupText').textContent,14,24);
    doc.autoTable({startY:32,html:'#registerTable'});
    const u=doc.output('bloburl');window.open(u,'_blank');doc.save('attendance_register.pdf');
  };
  shReg.onclick=()=>{
    const hdr=`Register\n${$('setupText').textContent}`,rows=[...rb.children].map(tr=>[...tr.children].map(td=>td.querySelector('.status-text')?td.querySelector('.status-text').textContent:td.textContent).join(' '));
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`,'_blank');
  };

  // Payment modal
  function openPaymentModal(adm){ $('payAdm').textContent=adm; $('paymentAmount').value=''; show($('paymentModal')); }
  $('savePayment').onclick=async()=>{ const adm=$('payAdm').textContent,amt=Number($('paymentAmount').value)||0; paymentsData[adm]=paymentsData[adm]||[]; paymentsData[adm].push({date:new Date().toISOString().split('T')[0],amount:amt}); await save('paymentsData',paymentsData); hide($('paymentModal')); renderStudents(); };
  $('cancelPayment').onclick=()=>hide($('paymentModal'));

  // Service worker
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(()=>{});
});
