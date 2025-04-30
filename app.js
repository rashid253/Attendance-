// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // --- 1. IndexedDB helpers (idb-keyval) ---
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // --- 2. Application state & defaults ---
  let students        = await get('students')        || [];
  let attendanceData  = await get('attendanceData')  || {};
  let paymentsData    = await get('paymentsData')    || {};
  let lastAdmNo       = await get('lastAdmissionNo') || 0;
  let fineRates       = await get('fineRates')       || { A:50, Lt:20, L:10, HD:0 };
  let eligibilityPct  = await get('eligibilityPct')  || 75;

  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // --- 3. DOM helpers ---
  const $ = id => document.getElementById(id);
  const show = (...els) => els.forEach(e => e && e.classList.remove('hidden'));
  const hide = (...els) => els.forEach(e => e && e.classList.add('hidden'));

  // --- 4. Setup (school name, class, section) ---
  $('saveSetup').onclick = async e => {
    e.preventDefault();
    const sc = $('schoolNameInput').value.trim();
    const cl = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    if (!sc || !cl || !sec) return alert('Complete all setup fields');
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    init();
  };
  $('editSetup').onclick = () => { show($('setupForm')); hide($('setupDisplay')); };

  async function init() {
    const [sc, cl, sec] = await Promise.all([
      get('schoolName'), get('teacherClass'), get('teacherSection')
    ]);
    if (sc && cl && sec) {
      $('setupText').textContent = `${sc} | Class ${cl} | Section ${sec}`;
      hide($('setupForm'));
      show($('setupDisplay'));
      updateCounters();
      renderStudents();
      resetViews();
    }
  }
  await init();

  // --- 5. Fines & eligibility settings ---
  $('fineAbsent').value     = fineRates.A;
  $('fineLate').value       = fineRates.Lt;
  $('fineLeave').value      = fineRates.L;
  $('fineHalfDay').value    = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;
  $('saveSettings').onclick = async () => {
    fineRates = {
      A : +$('fineAbsent').value || 0,
      Lt: +$('fineLate').value   || 0,
      L : +$('fineLeave').value  || 0,
      HD: +$('fineHalfDay').value|| 0
    };
    eligibilityPct = +$('eligibilityPct').value || 0;
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);
    renderStudents();
  };

  // --- 6. Counters animation ---
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let count = 0;
      const step = Math.max(1, target / 100);
      (function update() {
        count += step;
        span.textContent = count < target ? Math.ceil(count) : target;
        if (count < target) requestAnimationFrame(update);
      })();
    });
  }
  function updateCounters() {
    const cl  = $('teacherClassSelect').value;
    const sec = $('teacherSectionSelect').value;
    $('sectionCount').dataset.target = students.filter(s => s.cls===cl && s.sec===sec).length;
    $('classCount').dataset.target   = students.filter(s => s.cls===cl).length;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  $('teacherClassSelect').onchange = $('teacherSectionSelect').onchange = () => {
    renderStudents(); updateCounters(); resetViews();
  };

  // --- 7. Reset view sections ---
  function resetViews(){
    hide(
      $('attendanceBody'), $('saveAttendance'), $('resetAttendance'),
      $('attendanceSummary'), $('shareAttendanceSummary'), $('downloadAttendancePDF'),
      $('analyticsContainer'), $('graphs'), $('analyticsActions'),
      $('registerTableWrapper'), $('changeRegister'), $('saveRegister'),
      $('downloadRegister'), $('shareRegister')
    );
    show($('loadRegister'));
  }

  // --- 8. Compute outstanding & status ---
  function calcOut(s){
    const stats={P:0,A:0,Lt:0,HD:0,L:0};
    Object.values(attendanceData).forEach(r=>stats[r[s.adm]||'A']++);
    const fine=stats.A*fineRates.A + stats.Lt*fineRates.Lt + stats.L*fineRates.L + stats.HD*fineRates.HD;
    const paid=(paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0);
    return fine-paid;
  }
  function statusText(s){
    const out=calcOut(s), total=Object.values(attendanceData).length;
    const pres= total?Object.values(attendanceData).filter(r=>r[s.adm]==='P').length:0;
    const pct= total?pres/total*100:0;
    return (out>0||pct<eligibilityPct)?'Debarred':'Eligible';
  }

  // --- 9. Render students table with share & payment ---
  function renderStudents(){
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const tb=$('studentsBody'); tb.innerHTML='';
    students.forEach((s,i)=>{
      if(s.cls!==cl||s.sec!==sec) return;
      const out=calcOut(s), st=statusText(s);
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${i+1}</td>
        <td>${s.name}</td><td>${s.adm}</td>
        <td>₨ ${out}</td><td>${st}</td>
        <td>
          <button class="share-student" data-adm="${s.adm}"><i class="fas fa-share-alt"></i></button>
          <button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button>
        </td>`;
      tb.appendChild(tr);
    });
    document.querySelectorAll('.share-student').forEach(b=>b.onclick=()=>{
      const adm=b.dataset.adm, s=students.find(x=>x.adm===adm);
      const msg=`*${s.name}* (Adm# ${adm})\nOutstanding: ₨${calcOut(s)}\nStatus: ${statusText(s)}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
    });
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
  }

  // --- 10. Add student ---
  $('addStudent').onclick=async e=>{
    e.preventDefault();
    const n=$('studentName').value.trim(), p=$('parentName').value.trim(),
          c=$('parentContact').value.trim(), o=$('parentOccupation').value.trim(),
          a=$('parentAddress').value.trim();
    if(!n||!p||!c||!o||!a) return alert('All fields required');
    const adm=await genAdmNo();
    students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls:$('teacherClassSelect').value,sec:$('teacherSectionSelect').value});
    await save('students',students);
    renderStudents(); updateCounters(); resetViews();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };

  // --- 11. Payment modal ---
  function openPaymentModal(adm){
    $('payAdm').textContent=adm; $('paymentAmount').value=''; show($('paymentModal'));
  }
  $('savePayment').onclick=async()=>{
    const adm=$('payAdm').textContent, amt=+$('paymentAmount').value||0;
    paymentsData[adm]=paymentsData[adm]||[]; paymentsData[adm].push({date:new Date().toISOString().split('T')[0],amount:amt});
    await save('paymentsData',paymentsData); hide($('paymentModal')); renderStudents();
  };
  $('cancelPayment').onclick=()=>hide($('paymentModal'));

  // --- 12. Attendance marking ---
  $('loadAttendance').onclick=()=>{
    const date=$('dateInput').value; if(!date) return alert('Pick a date');
    const body=$('attendanceBody'); body.innerHTML='';
    const roster=students.filter(s=>s.cls===$('teacherClassSelect').value&&s.sec===$('teacherSectionSelect').value);
    roster.forEach(stu=>{
      const row=document.createElement('div'); row.className='attendance-row';
      const nm=document.createElement('div'); nm.className='attendance-name'; nm.textContent=stu.name;
      const btns=document.createElement('div'); btns.className='attendance-buttons';
      ['P','A','Lt','HD','L'].forEach(code=>{
        const b=document.createElement('button'); b.className='att-btn'; b.textContent=code;
        b.onclick=()=>{ btns.querySelectorAll('.att-btn').forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); };
        btns.appendChild(b);
      });
      row.append(nm,btns); body.appendChild(row);
    });
    show(body,$('saveAttendance')); hide($('resetAttendance'),$('attendanceSummary'),$('shareAttendanceSummary'),$('downloadAttendancePDF'));
  };
  $('saveAttendance').onclick=async()=>{
    const date=$('dateInput').value; attendanceData[date]={};
    document.querySelectorAll('.attendance-row').forEach((row,i)=>{
      const adm=students.filter(s=>s.cls===$('teacherClassSelect').value&&s.sec===$('teacherSectionSelect').value)[i].adm;
      const sel=row.querySelector('.att-btn.selected'); attendanceData[date][adm]=sel?sel.textContent:'A';
    });
    await save('attendanceData',attendanceData);
    const sum=$('attendanceSummary'); sum.innerHTML=`<h3>Report ${$('dateInput').value}</h3>`;
    const tbl=document.createElement('table'); tbl.innerHTML='<tr><th>Name</th><th>Status</th><th>Share</th></tr>';
    Object.entries(attendanceData[$('dateInput').value]).forEach(([adm,code])=>{
      const s=students.find(x=>x.adm===adm);
      tbl.innerHTML+=`<tr><td>${s.name}</td><td>${code}</td><td><i class="fas fa-share-alt share-individual" data-adm="${adm}"></i></td></tr>`;
    });
    sum.appendChild(tbl);
    sum.querySelectorAll('.share-individual').forEach(ic=>ic.onclick=()=>{
      const adm=ic.dataset.adm, code=attendanceData[$('dateInput').value][adm];
      const msg=`Your child was ${code} on ${$('dateInput').value}`;
      window.open(`https://wa.me/${students.find(x=>x.adm===adm).contact}?text=${encodeURIComponent(msg)}`,'_blank');
    });
    show(sum,$('shareAttendanceSummary'),$('downloadAttendancePDF')); hide($('attendanceBody'),$('saveAttendance'));
  };
  $('resetAttendance').onclick=()=>{ show($('attendanceBody'),$('saveAttendance')); hide($('attendanceSummary'),$('shareAttendanceSummary'),$('downloadAttendancePDF')); };

  // --- 13. Analytics ---
  const atg=$('analyticsTarget'), asel=$('analyticsSectionSelect'), atype=$('analyticsType'),
        adate=$('analyticsDate'), amonth=$('analyticsMonth'),
        sems=$('semesterStart'), seme=$('semesterEnd'), ayear=$('yearStart'),
        search=$('analyticsSearch'), loadA=$('loadAnalytics'), resetA=$('resetAnalytics'),
        instr=$('instructions'), acont=$('analyticsContainer'),
        graphs=$('graphs'), aacts=$('analyticsActions'),
        barCtx=$('barChart').getContext('2d'), pieCtx=$('pieChart').getContext('2d');
  let barChart, pieChart, lastAnalyticsShare='';

  atg.onchange=()=>{ atype.disabled=false; [asel,search].forEach(x=>x.classList.add('hidden')); [acont,graphs,aacts].forEach(x=>x.classList.add('hidden')); if(atg.value==='section') asel.classList.remove('hidden'); if(atg.value==='student') search.classList.remove('hidden'); };
  atype.onchange=()=>{ [adate,amonth,sems,seme,ayear].forEach(x=>x.classList.add('hidden')); [instr,acont,graphs,aacts].forEach(x=>x.classList.add('hidden')); resetA.classList.remove('hidden'); if(atype.value==='date') adate.classList.remove('hidden'); if(atype.value==='month') amonth.classList.remove('hidden'); if(atype.value==='semester'){sems.classList.remove('hidden');seme.classList.remove('hidden');} if(atype.value==='year') ayear.classList.remove('hidden'); };
  resetA.onclick=e=>{ e.preventDefault(); atype.value=''; [adate,amonth,sems,seme,ayear,instr,acont,graphs,aacts].forEach(x=>x.classList.add('hidden')); resetA.classList.add('hidden'); };
  loadA.onclick=()=>{
    let from,to;
    if(atype.value==='date'){from=to=adate.value;}
    else if(atype.value==='month'){ const [y,m]=amonth.value.split('-').map(Number); from=`${amonth.value}-01`; to=`${amonth.value}-${new Date(y,m,0).getDate()}`; }
    else if(atype.value==='semester'){ const [sy,sm]=sems.value.split('-').map(Number), [ey,em]=seme.value.split('-').map(Number); from=`${sems.value}-01`; to=`${seme.value}-${new Date(ey,em,0).getDate()}`; }
    else if(atype.value==='year'){ from=`${ayear.value}-01-01`; to=`${ayear.value}-12-31`; }
    else return alert('Select period');
    const cls=$('teacherClassSelect').value, sec=$('teacherSectionSelect').
value;
    let pool=students.filter(s=>s.cls===cls&&s.sec===sec);
    if(atg.value==='section') pool=pool.filter(s=>s.sec===asel.value);
    if(atg.value==='student'){ const q=search.value.trim().toLowerCase(); pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q)); }
    const stats=pool.map(s=>({adm:s.adm,name:s.name,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([d,recs])=>{ if(d<from||d>to) return; stats.forEach(st=>{ const c=recs[st.adm]||'A'; st[c]++; st.total++; }); });
    stats.forEach(st=>{ const tf=st.A*fineRates.A+st.Lt*fineRates.Lt+st.L*fineRates.L+st.HD*fineRates.HD; const tp=(paymentsData[st.adm]||[]).reduce((a,p)=>a+p.amount,0); st.outstanding=tf-tp; const pct=st.total?st.P/st.total*100:0; st.status=(st.outstanding>0||pct<eligibilityPct)?'Debarred':'Eligible'; });
    const thead=$('analyticsTable').querySelector('thead tr'); thead.innerHTML=['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding (₨)','Status'].map(h=>`<th>${h}</th>`).join('');
    const tbody=$('analyticsBody'); tbody.innerHTML=''; stats.forEach((st,i)=>{ const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0'; const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${st.adm}</td><td>${st.name}</td><td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td><td>${st.total}</td><td>${pct}%</td><td>₨ ${st.outstanding}</td><td>${st.status}</td>`; tbody.appendChild(tr); });
    instr.textContent=`Period: ${from} to ${to}`; show(instr,acont,graphs,aacts);
    barChart?.destroy(); barChart=new Chart(barCtx,{type:'bar',data:{labels:stats.map(st=>st.name),datasets:[{label:'% Present',data:stats.map(st=>st.total?st.P/st.total*100:0)}]},options:{scales:{y:{beginAtZero:true,max:100}}}});
    const agg=stats.reduce((a,st)=>a+st.outstanding,0); pieChart?.destroy(); pieChart=new Chart(pieCtx,{type:'pie',data:{labels:['Outstanding Fine'],datasets:[{data:[agg]}]}});
    lastAnalyticsShare=`Analytics (${from} to ${to})\n`+stats.map((st,i)=>`${i+1}. ${st.adm} ${st.name}: ${((st.P||0)/(st.total||1)*100).toFixed(1)}% / ₨${st.outstanding}`).join('\n');
  };
  $('shareAnalytics').onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(lastAnalyticsShare)}`,'_blank');
  $('downloadAnalytics').onclick=()=>{
    const doc=new jspdf.jsPDF({orientation:'landscape'}); doc.setFontSize(18); doc.text('Analytics Report',14,16); doc.autoTable({startY:24,html:'#analyticsTable'}); const url=doc.output('bloburl'); window.open(url,'_blank'); doc.save('analytics_landscape.pdf');
  };

  // --- 14. Attendance Register ---
  const loadR=$('loadRegister'), saveR=$('saveRegister'), changeR=$('changeRegister'),
        dlR=$('downloadRegister'), shR=$('shareRegister'),
        rm=$('registerMonth'), rh=$('registerHeader'), rb=$('registerBody'), rw=$('registerTableWrapper');
  const codes=['A','P','Lt','HD','L'], colors={P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};

  loadR.onclick=()=>{
    const m=rm.value; if(!m) return alert('Pick month');
    const [y,mm]=m.split('-').map(Number), days=new Date(y,mm,0).getDate();
    rh.innerHTML=`<th>#</th><th>Adm#</th><th>Name</th>`+Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    rb.innerHTML=''; const roster=students.filter(s=>s.cls===$('teacherClassSelect').value&&s.sec===$('teacherSectionSelect').value);
    roster.forEach((s,i)=>{
      let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=days;d++){ const key=`${m}-${String(d).padStart(2,'0')}`, c=(attendanceData[key]||{})[s.adm]||'A'; const style=c==='A'?'':` style="background:${colors[c]};color:#fff"`; row+=`<td class="reg-cell"${style}><span class="status-text">${c}</span></td>`; }
      const tr=document.createElement('tr'); tr.innerHTML=row; rb.appendChild(tr);
    });
    rb.querySelectorAll('.reg-cell').forEach(cell=>cell.onclick=()=>{
      const span=cell.querySelector('.status-text'), idx=(codes.indexOf(span.textContent)+1)%codes.length, c=codes[idx];
      span.textContent=c; if(c==='A'){cell.style.background='';cell.style.color='';}else{cell.style.background=colors[c];cell.style.color='#fff';}
    });
    show(rw,saveR); hide(loadR,changeR,dlR,shR);
  };
  saveR.onclick=async()=>{
    const m=rm.value, [y,mm]=m.split('-').map(Number), days=new Date(y,mm,0).getDate();
    Array.from(rb.children).forEach(tr=>{
      const adm=tr.children[1].textContent;
      for(let d=1;d<=days;d++){ const code=tr.children[3+d-1].querySelector('.status-text').textContent; const key=`${m}-${String(d).padStart(2,'0')}`; attendanceData[key]=attendanceData[key]||{}; attendanceData[key][adm]=code; }
    });
    await save('attendanceData',attendanceData);
    hide(saveR); show(changeR,dlR,shR);
  };
  changeR.onclick=()=>{ hide(changeR,dlR,shR); show(saveR); };
  dlR.onclick=()=>{
    const doc=new jspdf.jsPDF({orientation:'landscape'}); doc.setFontSize(18); doc.text('Attendance Register',14,16); doc.autoTable({startY:24,html:'#registerTable'}); doc.save('register_landscape.pdf');
  };
  shR.onclick=()=>{
    const header=`Attendance Register\n${$('setupText').textContent}`, rows=Array.from(rb.children).map(tr=>Array.from(tr.children).map(td=>td.querySelector('.status-text')?td.querySelector('.status-text').textContent:td.textContent).join(' '));
    window.open(`https://wa.me/?text=${encodeURIComponent(header+'\n'+rows.join('\n'))}`,'_blank');
  };

  // --- 15. Service Worker ---
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(console.error);
});
