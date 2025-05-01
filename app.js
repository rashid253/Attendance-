// app.js
window.addEventListener('DOMContentLoaded', async () => {
  // Utility
  const $ = id => document.getElementById(id);
  const { get, set } = window.idbKeyval;
  const save = (k,v) => set(k,v);

  // Load persisted
  let students       = (await get('students'))       || [];
  let attendanceData = (await get('attendanceData')) || {};
  let paymentsData   = (await get('paymentsData'))   || {};
  let fineRates      = (await get('fineRates'))      || { A:0, Lt:0, L:0, HD:0 };
  let eligibilityPct = (await get('eligibilityPct')) || 0;

  // Show/hide helpers
  const show = el => el && el.classList.remove('hidden');
  const hide = el => el && el.classList.add('hidden');

  // 1) SETUP
  const setupForm    = $('setupForm'), setupDisplay = $('setupDisplay'), setupText = $('setupText');
  $('saveSetup').onclick = async () => {
    const sc = $('schoolNameInput').value, cl = $('teacherClassSelect').value, sec = $('teacherSectionSelect').value;
    if (!sc||!cl||!sec) { alert('Complete all'); return; }
    await Promise.all([ save('schoolName',sc), save('teacherClass',cl), save('teacherSection',sec) ]);
    setupText.textContent = `${sc} | Class: ${cl} | Sect: ${sec}`;
    hide(setupForm); show(setupDisplay);
    renderStudents(); updateCounters(); resetViews();
  };
  $('editSetup').onclick = () => { show(setupForm); hide(setupDisplay); };
  // load if exists
  const sc0 = await get('schoolName'), cl0 = await get('teacherClass'), sec0 = await get('teacherSection');
  if (sc0&&cl0&&sec0) {
    $('schoolNameInput').value=sc0; $('teacherClassSelect').value=cl0; $('teacherSectionSelect').value=sec0;
    setupText.textContent = `${sc0} | Class: ${cl0} | Sect: ${sec0}`;
    hide(setupForm); show(setupDisplay);
  }

  // 2) FINANCIAL SETTINGS
  const finForm = $('financialForm');
  $('fineAbsent').value=fineRates.A; $('fineLate').value=fineRates.Lt;
  $('fineLeave').value=fineRates.L; $('fineHalfDay').value=fineRates.HD;
  $('eligibilityPct').value=eligibilityPct;
  $('saveSettings').onclick = async () => {
    fineRates = { A:+$('fineAbsent').value, Lt:+$('fineLate').value, L:+$('fineLeave').value, HD:+$('fineHalfDay').value };
    eligibilityPct = +$('eligibilityPct').value;
    await Promise.all([ save('fineRates',fineRates), save('eligibilityPct',eligibilityPct) ]);
    renderCriteria();
    hide(finForm); $('editSettings')?.classList.remove('hidden');
  };

  // 3) COUNTERS
  function updateCounters() {
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    const total=students.filter(s=>s.cls===cl&&s.sec===sec).length;
    $('sectionCount').dataset.target=total;
    animateCounters();
  }
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span=>{
      const target=+span.dataset.target; let c=0; const step=Math.ceil(target/50);
      (function tick(){ c+=step; span.textContent=c<target?c:target; if(c<target) requestAnimationFrame(tick); })();
    });
  }
  updateCounters();

  // 4) STUDENT REGISTRATION
  function renderStudents() {
    const tbody=$('studentsBody'); tbody.innerHTML='';
    const cl=$('teacherClassSelect').value, sec=$('teacherSectionSelect').value;
    let idx=0;
    students.forEach((s,i)=>{
      if(s.cls!==cl||s.sec!==sec)return;
      idx++;
      // compute stats
      let P=0,A=0,Lt=0,HD=0,L=0;
      Object.values(attendanceData).forEach(rec=>{ const c=rec[s.adm]||'A'; if(c==='P')P++; if(c==='A')A++; if(c==='Lt')Lt++; if(c==='HD')HD++; if(c==='L')L++; });
      const totalDays=P+A+Lt+HD+L, pct= totalDays?((P/totalDays)*100).toFixed(1):0;
      const totalFine=A*fineRates.A+Lt*fineRates.Lt+L*fineRates.L+HD*fineRates.HD;
      const paid=(paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0), out=totalFine-paid;
      const status=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      const tr=document.createElement('tr'); tr.dataset.index=i;
      tr.innerHTML=`<td><input type="checkbox" class="sel"></td><td>${idx}</td><td>${s.name}</td><td>${s.adm}</td><td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td><td>${s.address}</td><td>PKR ${out}</td><td>${status}</td><td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-money-bill-wave"></i></button></td>`;
      tbody.appendChild(tr);
    });
    setupRowActions();
  }
  function setupRowActions() {
    $('selectAllStudents').checked=false;
    document.querySelectorAll('.add-payment-btn').forEach(b=>b.onclick=()=>openPaymentModal(b.dataset.adm));
    document.querySelectorAll('.sel').forEach(cb=>cb.onchange=toggleButtons);
    toggleButtons();
  }
  function toggleButtons(){
    const any=!!document.querySelector('.sel:checked');
    $('editSelected').disabled=!any; $('deleteSelected').disabled=!any;
  }
  $('selectAllStudents').onclick=()=>{
    document.querySelectorAll('.sel').forEach(c=>c.checked=$('selectAllStudents').checked);
    toggleButtons();
  };
  $('addStudent').onclick=async()=>{
    const n=$('studentName').value,p=$('parentName').value,c=$('parentContact').value,o=$('parentOccupation').value,a=$('parentAddress').value,cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    if(!n||!p||!c||!o||!a){alert('All fields');return;}
    const adm=Date.now().toString().slice(-6);
    students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls:cl,sec});
    await save('students',students); renderStudents(); updateCounters();
    ['studentName','parentName','parentContact','parentOccupation','parentAddress'].forEach(id=>$(id).value='');
  };
  $('editSelected').onclick=()=>{
    document.querySelectorAll('.sel:checked').forEach(cb=>{
      const tr=cb.closest('tr'), i=+tr.dataset.index,s=students[i];
      tr.innerHTML=`<td></td><td>${tr.children[1].textContent}</td><td><input value="${s.name}"></td><td>${s.adm}</td><td><input value="${s.parent}"></td><td><input value="${s.contact}"></td><td><input value="${s.occupation}"></td><td><input value="${s.address}"></td><td>${tr.children[8].textContent}</td><td>${tr.children[9].textContent}</td><td></td>`;
    });
    hide($('editSelected'),$('deleteSelected')); show($('doneEditing'));
  };
  $('doneEditing').onclick=async()=>{
    document.querySelectorAll('#studentsBody tr').forEach(tr=>{
      const inputs=[...tr.querySelectorAll('input:not(.sel)')];
      if(inputs.length===5){
        const [n,p,c,o,a]=inputs.map(i=>i.value), adm=tr.children[3].textContent;
        const idx=students.findIndex(s=>s.adm===adm);
        students[idx]={...students[idx],name:n,parent:p,contact:c,occupation:o,address:a};
      }
    });
    await save('students',students); renderStudents(); updateCounters();
    hide($('doneEditing')); show($('editSelected'),$('deleteSelected'));
  };
  $('deleteSelected').onclick=async()=>{
    if(!confirm('Delete?'))return;
    const toDel=[...document.querySelectorAll('.sel:checked')].map(cb=>+cb.closest('tr').dataset.index);
    students=students.filter((_,i)=>!toDel.includes(i));
    await save('students',students); renderStudents(); updateCounters();
  };

  // 5) PAYMENT MODAL
  function openPaymentModal(adm){ $('payAdm').textContent=adm; $('paymentAmount').value=''; show($('paymentModal')); }
  $('savePayment').onclick=async()=>{
    const adm=$('payAdm').textContent, amt=+$('paymentAmount').value;
    paymentsData[adm]=paymentsData[adm]||[]; paymentsData[adm].push({date:new Date().toISOString().split('T')[0],amount:amt});
    await save('paymentsData',paymentsData); hide($('paymentModal')); renderStudents();
  };
  $('cancelPayment').onclick=()=>hide($('paymentModal'));

  // 6) ATTENDANCE
  $('loadAttendance').onclick=()=>{
    const date=$('dateInput').value; if(!date){alert('Pick date');return;}
    const cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    const roster=students.filter(s=>s.cls===cl&&s.sec===sec);
    const body=$('attendanceBody'); body.innerHTML='';
    roster.forEach(stu=>{
      const row=document.createElement('div');row.className='attendance-row';
      const nameDiv=document.createElement('div');nameDiv.textContent=stu.name;row.appendChild(nameDiv);
      const btnsDiv=document.createElement('div');['P','A','Lt','HD','L'].forEach(code=>{
        const btn=document.createElement('button');btn.textContent=code;btn.onclick=()=>{
          attendanceData[date]=attendanceData[date]||{}; attendanceData[date][stu.adm]=code;
          Array.from(btnsDiv.children).forEach(b=>b.classList.remove('selected'));
          btn.classList.add('selected');
        };btnsDiv.appendChild(btn);
      });
      row.appendChild(btnsDiv); body.appendChild(row);
    });
    show($('saveAttendance'),$('resetAttendance'));
  };
  $('saveAttendance').onclick=async()=>{await save('attendanceData',attendanceData); alert('Saved');};
  $('resetAttendance').onclick=()=>location.reload();

  // 7) ANALYTICS
  function renderCriteria(){
    $('criteriaList').innerHTML=`
      <li>Absent: PKR ${fineRates.A}/day</li>
      <li>Late: PKR ${fineRates.Lt}/instance</li>
      <li>Leave: PKR ${fineRates.L}/day</li>
      <li>Half-Day: PKR ${fineRates.HD}/half-day</li>
      <li>Eligibility: ≥${eligibilityPct}% & no outstanding fines</li>`;
  }
  renderCriteria();

  function fetchAnalytics(){
    const from=$('analyticsFrom').value, to=$('analyticsTo').value;
    if(!from||!to){alert('Select both dates');return[];}
    const start=new Date(from), end=new Date(to); const stats=[];
    const cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    students.filter(s=>s.cls===cl&&s.sec===sec).forEach(s=>{
      let P=0,A=0,Lt=0,HD=0,L=0;
      Object.entries(attendanceData).forEach(([d,rec])=>{
        const dt=new Date(d); if(dt<start||dt>end)return;
        const c=rec[s.adm]||'A'; if(c==='P')P++; if(c==='A')A++; if(c==='Lt')Lt++; if(c==='HD')HD++; if(c==='L')L++;
      });
      const total=P+A+Lt+HD+L, pct= total?((P/total)*100).toFixed(1):0;
      const fine=A*fineRates.A+Lt*fineRates.Lt+L*fineRates.L+HD*fineRates.HD;
      const paid=(paymentsData[s.adm]||[]).reduce((a,p)=>a+p.amount,0), out=fine-paid;
      const status=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      stats.push({adm:s.adm,name:s.name,P,A,Lt,HD,L,total,pct,outstandingValue:out,outstanding:`PKR ${out}`,status});
    });
    return stats;
  }
  function renderKPIs(data){
    const total=data.length,debarred=data.filter(s=>s.status==='Debarred').length;
    const sumOut=data.reduce((sum,s)=>sum+s.outstandingValue,0).toFixed(0);
    const avg=data.reduce((sum,s)=>sum+parseFloat(s.pct),0)/total||0;
    $('kpiTotal').textContent=total; $('kpiDebarred').textContent=debarred;
    $('kpiOutstanding').textContent=`PKR ${sumOut}`; $('kpiAvgPct').textContent=`${avg.toFixed(1)}%`;
  }
  function renderChart(data){
    const ctx=$('analyticsChart').getContext('2d');
    new Chart(ctx,{type:'bar',data:{labels:data.map(s=>s.name),datasets:[{label:'% Attendance',data:data.map(s=>parseFloat(s.pct))},{label:'Outstanding',data:data.map(s=>s.outstandingValue)}]},options:{responsive:true}});
  }
  function renderAnalytics(data){
    const tb=$('analyticsTable').querySelector('tbody'); tb.innerHTML='';
    data.forEach((s,i)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td><td>${s.P}</td><td>${s.A}</td><td>${s.Lt}</td><td>${s.HD}</td><td>${s.L}</td><td>${s.total}</td><td>${s.pct}%</td><td>${s.outstanding}</td><td>${s.status}</td>`; tb.appendChild(tr); });
    renderKPIs(data); renderChart(data);
  }
  $('loadAnalytics').onclick=()=>{ const d=fetchAnalytics(); if(d.length) renderAnalytics(d); };
  $('resetAnalytics').onclick=()=>{ $('analyticsFrom').value=''; $('analyticsTo').value=''; $('analyticsTable').querySelector('tbody').innerHTML=''; };

  // 8) CSV & PDF & filter
  $('downloadCSV').onclick=()=>{
    const rows=Array.from(document.querySelectorAll('#analyticsTable tr'));
    const csv=rows.map(r=>Array.from(r.cells).map(c=>`"${c.textContent}"`).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='analytics.csv';a.click();
  };
  function makePDF(title, includeStatus){
    const doc=new jspdf.jsPDF(); doc.setFontSize(18); doc.text(title,14,16);
    doc.setFontSize(10); doc.text([`• Absent: PKR ${fineRates.A}/day`,`• Late: PKR ${fineRates.Lt}`,`• Leave: PKR ${fineRates.L}`],14,24);
    const head=['Adm#','Name','Outstanding'].concat(includeStatus?['Status']:[]);
    const body=Array.from(document.querySelectorAll('#analyticsTable tbody tr')).map(tr=>{ const base=[tr.cells[1].textContent,tr.cells[2].textContent,tr.cells[10].textContent]; return includeStatus?base.concat(tr.cells[11].textContent):base; });
    doc.autoTable({head:[head],body, startY:70}); doc.save(title.toLowerCase().replace(/ /g,'_')+'.pdf');
  }
  $('generateFineReport').onclick=()=>makePDF('Fine Report',true);
  $('downloadAnalytics').onclick=()=>makePDF('Analytics Report',true);
  $('statusFilter').onchange=e=>{ const v=e.target.value; document.querySelectorAll('#analyticsTable tbody tr').forEach(r=>r.style.display=(v==='all'||r.cells[11].textContent.toLowerCase()===v)?'':'' ); };

  // 9) ATTENDANCE REGISTER
  $('loadRegister').onclick=()=>{
    const m=$('registerMonth').value; if(!m){alert('Pick month');return;}
    const [y,mo]=m.split('-').map(Number), days=new Date(y,mo,0).getDate();
    const head=`<th>#</th><th>Adm#</th><th>Name</th>`+Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('');
    $('registerHeader').innerHTML=head; $('registerBody').innerHTML='';
    students.filter(s=>s.cls===$('teacherClassSelect').value&&s.sec===$('teacherSectionSelect').value).forEach((s,i)=>{
      const tr=document.createElement('tr');
      let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=days;d++){
        const key=`${m}-${String(d).padStart(2,'0')}`, code=(attendanceData[key]||{})[s.adm]||'A';
        row+=`<td>${code}</td>`;
      }
      tr.innerHTML=row; $('registerBody').appendChild(tr);
    });
    show($('registerTableWrapper'),$('saveRegister'));
  };
  $('saveRegister').onclick=async()=>{ await save('attendanceData',attendanceData); alert('Register saved'); };

  // 10) Service worker
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');
});
