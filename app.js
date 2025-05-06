// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // --- Helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e=>e&&e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e=>e&&e.classList.add('hidden'));

  async function sharePdf(blob, fileName, title) {
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, {type:'application/pdf'})] })) {
      try { await navigator.share({ title, files:[ new File([blob], fileName, {type:'application/pdf'}) ] }); }
      catch(err){ if (err.name!=='AbortError') console.error(err); }
    }
  }

  // --- IndexedDB via idb-keyval ---
  if (!window.idbKeyval) { console.error('idb-keyval missing'); return; }
  const { get, set } = window.idbKeyval;
  const save = (k,v) => set(k,v);

  // --- State & Defaults ---
  let students       = (await get('students'))        || [];
  let attendanceData = (await get('attendanceData'))  || {};
  let paymentsData   = (await get('paymentsData'))    || {};
  let lastAdmNo      = (await get('lastAdmissionNo')) || 0;
  let fineRates      = (await get('fineRates'))       || { A:50, Lt:20, L:10, HD:30 };
  let eligibilityPct = (await get('eligibilityPct'))  || 75;
  let analyticsFilterOptions = ['all'], analyticsDownloadMode='combined';
  let lastAnalyticsStats = [], lastAnalyticsRange={from:null,to:null}, lastAnalyticsShare='';

  async function genAdmNo() {
    lastAdmNo++; await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4,'0');
  }

  // --- SETUP Section ---
  async function loadSetup() {
    const [sc,cl,sec] = await Promise.all([ get('schoolName'), get('teacherClass'), get('teacherSection') ]);
    if (sc&&cl&&sec) {
      $('schoolNameInput').value = sc;
      $('teacherClassSelect').value = cl;
      $('teacherSectionSelect').value = sec;
      $('setupText').textContent = `${sc} 🏫 | Class: ${cl} | Section: ${sec}`;
      hide($('setupForm')); show($('setupDisplay'));
      renderStudents(); updateCounters(); resetViews();
    }
  }
  $('saveSetup').onclick = async e=>{
    e.preventDefault();
    const sc=$('schoolNameInput').value.trim(), cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    if(!sc||!cl||!sec){alert('Complete setup');return;}
    await save('schoolName',sc); await save('teacherClass',cl); await save('teacherSection',sec);
    await loadSetup();
  };
  $('editSetup').onclick = e=>{ e.preventDefault(); show($('setupForm')); hide($('setupDisplay')); };

  // --- FINES & ELIGIBILITY ---
  const formDiv=$('financialForm'), saveSettingsBtn=$('saveSettings');
  const settingsCard=document.createElement('div'); settingsCard.id='settingsCard'; settingsCard.className='card hidden';
  const editSettingsBtn=document.createElement('button'); editSettingsBtn.id='editSettings'; editSettingsBtn.className='btn no-print hidden'; editSettingsBtn.textContent='Edit Settings';
  formDiv.parentNode.appendChild(settingsCard); formDiv.parentNode.appendChild(editSettingsBtn);

  $('fineAbsent').value=fineRates.A; $('fineLate').value=fineRates.Lt;
  $('fineLeave').value=fineRates.L; $('fineHalfDay').value=fineRates.HD;
  $('eligibilityPct').value=eligibilityPct;

  saveSettingsBtn.onclick = async ()=>{
    fineRates = {
      A:Number($('fineAbsent').value)||0,
      Lt:Number($('fineLate').value)||0,
      L:Number($('fineLeave').value)||0,
      HD:Number($('fineHalfDay').value)||0
    };
    eligibilityPct=Number($('eligibilityPct').value)||0;
    await Promise.all([ save('fineRates',fineRates), save('eligibilityPct',eligibilityPct) ]);
    settingsCard.innerHTML=`
      <div class="card-content">
        <p><strong>Fine – Absent:</strong> PKR ${fineRates.A}</p>
        <p><strong>Fine – Late:</strong> PKR ${fineRates.Lt}</p>
        <p><strong>Fine – Leave:</strong> PKR ${fineRates.L}</p>
        <p><strong>Fine – Half Day:</strong> PKR ${fineRates.HD}</p>
        <p><strong>Eligibility:</strong> ${eligibilityPct}%</p>
      </div>`;
    hide(formDiv); show(settingsCard, editSettingsBtn);
  };
  editSettingsBtn.onclick = ()=>{ show(formDiv); hide(settingsCard, editSettingsBtn); };

  // --- UTILS: Counters & View Reset ---
  function updateCounters(){
    const cl=$('teacherClassSelect').value;
    $('classCount').textContent=students.filter(s=>s.cls===cl).length;
    $('schoolCount').textContent=students.length;
  }
  function resetViews(){
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('analyticsContainer'), $('analyticsActions'),
      $('registerTableWrapper'), $('saveRegister'), $('changeRegister'),
      $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }
  $('teacherClassSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange = () => { renderStudents(); updateCounters(); resetViews(); };

  // --- STUDENT REGISTRATION & MANAGEMENT ---
  function renderStudents(){
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const tbody=$('studentsBody'); tbody.innerHTML='';
    let idx=0;
    students.forEach((s,i)=>{
      if(s.cls!==cl||s.sec!==sec) return;
      idx++;
      const stats={P:0,A:0,Lt:0,L:0,HD:0};
      Object.entries(attendanceData).forEach(([d,r])=>stats[r[s.adm]||'A']++);
      const totalFine=stats.A*fineRates.A+stats.Lt*fineRates.Lt+stats.L*fineRates.L+stats.HD*fineRates.HD;
      const paid=paymentsData[s.adm]?.paid||0, outstanding=totalFine-paid;
      const totalDays=stats.P+stats.A+stats.L+stats.Lt+stats.HD;
      const status=(stats.P/totalDays*100>=eligibilityPct?'Eligible':'Debarred');
      const tr=document.createElement('tr'); tr.dataset.index=i;
      tr.innerHTML=`
        <td><input type="checkbox" class="sel"></td>
        <td>${idx}</td><td>${s.name}</td><td>${s.adm}</td>
        <td>${stats.P}</td><td>${stats.A}</td><td>${stats.Lt}</td>
        <td>${stats.L}</td><td>${stats.HD}</td>
        <td>PKR ${outstanding}</td><td>${status}</td>
        <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>`;
      tbody.appendChild(tr);
    });
    $('selectAllStudents').checked=false;
    document.querySelectorAll('.sel').forEach(c=>c.onchange=toggleButtons);
    toggleButtons();
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }
  function toggleButtons(){
    const any=!!document.querySelector('.sel:checked');
    $('editSelected').disabled=!any;
    $('deleteSelected').disabled=!any;
  }
  $('selectAllStudents').onclick = ()=>{
    const on=$('selectAllStudents').checked;
    document.querySelectorAll('.sel').forEach(c=>c.checked=on);
    toggleButtons();
  };
  $('addStudent').onclick=async e=>{
    e.preventDefault();
    const n=$('studentName').value.trim(), p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(), o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim(), cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a){ alert('All fields'); return; }
    if(!/^\d{7,15}$/.test(c)){ alert('Contact digits'); return; }
    const adm=await genAdmNo();
    students.push({name:n,parent:p,contact:c,occupation:o,address:a,cls:cl,sec,adm});
    await save('students',students);
    renderStudents(); updateCounters(); resetViews();
  };
  $('deleteSelected').onclick=async ()=>{
    if(!confirm('Delete?'))return;
    const toDel=[...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students=students.filter((_,i)=>!toDel.includes(i));
    await save('students',students);
    renderStudents(); updateCounters(); resetViews();
  };

  // --- ATTENDANCE REGISTER (Monthly) ---
  const loadRegister = $('loadRegister'), changeRegister = $('changeRegister'),
        saveRegister = $('saveRegister'), downloadRegister = $('downloadRegister'),
        shareRegister = $('shareRegister'),
        registerMonth = $('registerMonth'),
        registerHeader = $('registerHeader'),
        registerBody = $('registerBody');

  const codes=['A','P','Lt','HD','L'], colors={P:'green',A:'red',Lt:'orange',HD:'#FF9800',L:'blue'};

  loadRegister.onclick = ()=>{
    const m=registerMonth.value; if(!m){ alert('Pick month'); return; }
    const [y,mm]=m.split('-').map(Number), days=new Date(y,mm,0).getDate();
    registerHeader.innerHTML = `<th>#</th><th>Adm#</th><th>Name</th>${[...Array(days)].map((_,i)=>`<th>${i+1}</th>`).join('')}`;
    registerBody.innerHTML='';
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    students.filter(s=>s.cls===cl&&s.sec===sec).forEach((s,i)=>{
      let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1; d<=days; d++){
        const key=`${m}-${String(d).padStart(2,'0')}`;
        const c=(attendanceData[key]||{})[s.adm]||'A';
        const style=c==='A'?'':`style="background:${colors[c]};color:#fff"`;
        row+=`<td class="reg-cell" ${style}><span>${c}</span></td>`;
      }
      const tr=document.createElement('tr'); tr.innerHTML=row; registerBody.appendChild(tr);
    });
    registerBody.querySelectorAll('.reg-cell').forEach(cell=>{
      cell.onclick=()=>{
        const span=cell.querySelector('span');
        const idx=(codes.indexOf(span.textContent)+1)%codes.length, c=codes[idx];
        span.textContent=c;
        if(c==='A'){ cell.style.background=''; cell.style.color=''; }
        else { cell.style.background=colors[c]; cell.style.color='#fff'; }
      };
    });
    show($('registerTableWrapper'), saveRegister); hide(loadRegister, changeRegister, downloadRegister, shareRegister);
  };

  saveRegister.onclick=async ()=>{
    const m=registerMonth.value, [y,mm]=m.split('-').map(Number), days=new Date(y,mm,0).getDate();
    Array.from(registerBody.children).forEach(tr=>{
      const adm=tr.children[1].textContent;
      for(let d=1; d<=days; d++){
        const code=tr.children[3+d-1].querySelector('span').textContent;
        const key=`${m}-${String(d).padStart(2,'0')}`;
        attendanceData[key]=attendanceData[key]||{};
        attendanceData[key][adm]=code;
      }
    });
    await save('attendanceData',attendanceData);
    hide(saveRegister); show(changeRegister, downloadRegister, shareRegister);
  };

  changeRegister.onclick=()=>{
    hide($('registerTableWrapper'), changeRegister, downloadRegister, shareRegister, saveRegister);
    registerHeader.innerHTML=''; registerBody.innerHTML=''; show(loadRegister);
  };

  // --- PDF & Share for Attendance Register ---
  downloadRegister.onclick = async ()=>{
    const doc=new jspdf.jsPDF({orientation:'landscape',unit:'pt',format:'a4'});
    doc.setFontSize(18); doc.text('Attendance Register',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({startY:32,html:'#registerTable',tableWidth:'auto',styles:{fontSize:10}});
    const blob=doc.output('blob');
    doc.save('attendance_register.pdf');
    await sharePdf(blob,'attendance_register.pdf','Attendance Register');
  };
  shareRegister.onclick = ()=>{
    const hdr=`Attendance Register\n${$('setupText').textContent}`;
    const rows=Array.from(registerBody.children).map(tr=>
      Array.from(tr.children).map(td=>td.querySelector('span')?td.querySelector('span').textContent:td.textContent).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr+'\n'+rows.join('\n'))}`,'_blank');
  };

  // --- ANALYTICS Section ---
  document.querySelectorAll('#analyticsFilterForm input[type="checkbox"]').forEach(cb=>cb.onchange=()=> {
    const ch=Array.from(document.querySelectorAll('#analyticsFilterForm input[type="checkbox"]:checked')).map(x=>x.value);
    analyticsFilterOptions=ch.length?ch:['all'];
  });
  document.querySelectorAll('#analyticsFilterForm input[name="downloadMode"]').forEach(r=>r.onchange=()=> {
    analyticsDownloadMode=document.querySelector('#analyticsFilterForm input[name="downloadMode"]:checked').value;
  });

  $('generateAnalytics').onclick=()=>{
    const from=$('analyticsFrom').value, to=$('analyticsTo').value;
    if(!from||!to){alert('Select range');return;}
    lastAnalyticsRange={from,to};
    const dates=Object.keys(attendanceData).filter(d=>d>=from&&d<=to);
    lastAnalyticsStats=students.map(s=>{
      const st={adm:s.adm,name:s.name,P:0,A:0,Lt:0,L:0,HD:0,total:dates.length};
      dates.forEach(d=>{ const c=(attendanceData[d]||{})[s.adm]||'A'; st[c]++; });
      const fine=st.A*fineRates.A+st.Lt*fineRates.Lt+st.L*fineRates.L+st.HD*fineRates.HD;
      const paid=paymentsData[s.adm]?.paid||0;
      const out=fine-paid;
      const status=(st.P/st.total*100>=eligibilityPct?'Eligible':'Debarred');
      return {...st,outstanding:out,status};
    });
    const tbody=$('analyticsTable').querySelector('tbody'); tbody.innerHTML='';
    lastAnalyticsShare=`Analytics (${from} to ${to}):\n`;
    lastAnalyticsStats.forEach(st=>{
      tbody.innerHTML+=`
        <tr>
          <td>${st.adm}</td><td>${st.name}</td><td>${st.P}</td>
          <td>${st.A}</td><td>${st.Lt}</td><td>${st.L}</td><td>${st.HD}</td>
          <td>PKR ${st.outstanding}</td><td>${st.status}</td>
        </tr>`;
      lastAnalyticsShare+=`${st.adm}-${st.name}: P${st.P}, A${st.A}, O${st.outstanding}, ${st.status}\n`;
    });
    show($('analyticsContainer'),$('analyticsActions'));
  };

  $('downloadAnalytics').onclick=async()=>{
    const filtered=lastAnalyticsStats.filter(st=>analyticsFilterOptions.includes('all')||analyticsFilterOptions.includes('attendance')?st.P>0:true);
    if(analyticsDownloadMode==='combined'){
      const doc=new jspdf.jsPDF();
      doc.setFontSize(18); doc.text('Analytics Report',14,16);
      doc.setFontSize(12); doc.text(`Period: ${lastAnalyticsRange.from} to ${lastAnalyticsRange.to}`,14,24);
      doc.autoTable({startY:32,html:'#analyticsTable'});
      const blob=doc.output('blob');
      doc.save('analytics_report.pdf');
      await sharePdf(blob,'analytics_report.pdf','Analytics Report');
    } else {
      for(const st of filtered){
        const doc=new jspdf.jsPDF();
        doc.setFontSize(18); doc.text(`Analytics for ${st.name}`,14,16);
        doc.setFontSize(12);
        doc.text(`Adm#: ${st.adm}`,14,24);
        doc.text(`P: ${st.P}`,14,32);
        doc.text(`A: ${st.A}`,14,40);
        doc.text(`Lt: ${st.Lt}`,14,48);
        doc.text(`L: ${st.L}`,14,56);
        doc.text(`HD: ${st.HD}`,14,64);
        doc.text(`O: PKR ${st.outstanding}`,14,72);
        const fn=`analytics_${st.adm}.pdf`, blob=doc.output('blob');
        doc.save(fn); await sharePdf(blob,fn,`Analytics: ${st.name}`);
      }
    }
  };
  $('shareAnalytics').onclick=()=>{
    if(!lastAnalyticsShare){alert('Generate analytics first');return;}
    window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`,'_blank');
  };

  // --- SERVICE WORKER ---
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(console.error);

  // initial load
  await loadSetup();
});
