// app.js
window.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const show = el => el && el.classList.remove('hidden');
  const hide = el => el && el.classList.add('hidden');

  // idb-keyval
  const { get, set } = window.idbKeyval;
  const save = (k, v) => set(k, v);

  // State & defaults
  let students       = await get('students')       || [];
  let attendanceData = await get('attendanceData')|| {};
  let paymentsData   = await get('paymentsData')  || {};
  let lastAdmNo      = await get('lastAdmissionNo')|| 0;
  let fineRates      = await get('fineRates')     || { A:50, Lt:20, L:10, HD:0 };
  let eligibilityPct = await get('eligibilityPct')|| 75;

  // Generate admission #
  async function genAdmNo() {
    lastAdmNo++;
    await save('lastAdmissionNo', lastAdmNo);
    return String(lastAdmNo).padStart(4, '0');
  }

  // Load setup
  async function loadSetup() {
    const [sc, cl, sec] = await Promise.all([
      get('schoolName'), get('teacherClass'), get('teacherSection')
    ]);
    if (sc && cl && sec) {
      $('setupText').textContent = `${sc} | Class: ${cl} | Sec: ${sec}`;
      hide($('setupForm')); show($('setupDisplay'));
      $('teacherClassSelect').value = cl;
      $('teacherSectionSelect').value = sec;
      renderStudents(); updateCounters(); resetViews();
    }
  }

  // Save setup
  $('saveSetup').onclick = async () => {
    const sc = $('schoolNameInput').value.trim();
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    if (!sc||!cl||!sec) return alert('Complete setup');
    await Promise.all([
      save('schoolName', sc),
      save('teacherClass', cl),
      save('teacherSection', sec)
    ]);
    loadSetup();
  };
  $('editSetup').onclick = () => {
    show($('setupForm')); hide($('setupDisplay'));
  };
  await loadSetup();

  // Populate fines inputs
  $('fineAbsent').value  = fineRates.A;
  $('fineLate').value    = fineRates.Lt;
  $('fineLeave').value   = fineRates.L;
  $('fineHalfDay').value = fineRates.HD;
  $('eligibilityPct').value = eligibilityPct;

  // Save fines & eligibility
  $('saveSettings').onclick = async () => {
    fineRates = {
      A : Number($('fineAbsent').value)||0,
      Lt: Number($('fineLate').value)||0,
      L : Number($('fineLeave').value)||0,
      HD: Number($('fineHalfDay').value)||0
    };
    eligibilityPct = Number($('eligibilityPct').value)||0;
    await Promise.all([
      save('fineRates', fineRates),
      save('eligibilityPct', eligibilityPct)
    ]);
    alert('Settings saved');
    renderStudents();
  };

  // Counters
  function updateCounters() {
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    const secCount   = students.filter(s=>s.cls===cl&&s.sec===sec).length;
    const classCount = students.filter(s=>s.cls===cl).length;
    $('sectionCount').dataset.target = secCount;
    $('classCount').dataset.target   = classCount;
    $('schoolCount').dataset.target  = students.length;
    animateCounters();
  }
  function animateCounters() {
    document.querySelectorAll('.number').forEach(span => {
      const target = +span.dataset.target;
      let c = 0, step = Math.ceil(target/100);
      const iv = setInterval(()=>{
        c += step;
        if (c>=target) { span.textContent=target; clearInterval(iv); }
        else span.textContent = c;
      }, 10);
    });
  }
  $('teacherClassSelect').onchange = ()=>{ renderStudents(); updateCounters(); resetViews(); };
  $('teacherSectionSelect').onchange =()=>{ renderStudents(); updateCounters(); resetViews(); };

  function resetViews() {
    [
      'attendanceBody','saveAttendance','resetAttendance','attendanceSummary',
      'downloadAttendancePDF','shareAttendanceSummary','instructions',
      'analyticsContainer','graphs','analyticsActions','registerTableWrapper',
      'changeRegister','saveRegister','downloadRegister','shareRegister'
    ].forEach(id=>hide($(id)));
  }

  // Render student table
  function renderStudents() {
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    const tbody = $('studentsBody');
    tbody.innerHTML = '';
    let idx=1;
    students.forEach((s,i)=>{
      if (s.cls!==cl||s.sec!==sec) return;
      // attendance stats
      const stats={P:0,A:0,Lt:0,L:0,HD:0};
      Object.values(attendanceData).forEach(rec=>stats[rec[s.adm]||'A']++);
      // fines
      const totalFine = stats.A*fineRates.A + stats.Lt*fineRates.Lt
                      + stats.L*fineRates.L + stats.HD*fineRates.HD;
      const paid = (paymentsData[s.adm]||[]).reduce((sum,p)=>sum+p.amount,0);
      const out = totalFine - paid;
      // pct
      const days = Object.values(stats).reduce((a,b)=>a+b,0);
      const pct = days? (stats.P/days)*100 : 0;
      const status = (out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      tbody.innerHTML += `
        <tr data-idx="${i}">
          <td><input type="checkbox" class="sel"></td>
          <td>${idx++}</td><td>${s.name}</td><td>${s.adm}</td>
          <td>${s.parent}</td><td>${s.contact}</td><td>${s.occupation}</td>
          <td>${s.address}</td>
          <td>₨ ${out}</td><td>${status}</td>
          <td><button class="add-payment-btn" data-adm="${s.adm}"><i class="fas fa-coins"></i></button></td>
        </tr>`;
    });
    // payment buttons
    document.querySelectorAll('.add-payment-btn')
      .forEach(btn=>btn.onclick=()=>openPaymentModal(btn.dataset.adm));
  }

  // Add Student
  $('addStudent').onclick = async () => {
    const n = $('studentName').value.trim();
    const p = $('parentName').value.trim();
    const c = $('parentContact').value.trim();
    const o = $('parentOccupation').value.trim();
    const a = $('parentAddress').value.trim();
    if (!n||!p||!c||!o||!a) return alert('All fields required');
    if (!/^\d{7,15}$/.test(c)) return alert('Invalid contact');
    const adm = await genAdmNo();
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    students.push({name:n,adm,parent:p,contact:c,occupation:o,address:a,cls:cl,sec});
    await save('students', students);
    $('studentName').value='';$('parentName').value='';
    $('parentContact').value='';$('parentOccupation').value='';
    $('parentAddress').value='';
    renderStudents(); updateCounters();
  };

  // Payment Modal
  function openPaymentModal(adm) {
    $('payAdm').textContent = adm;
    $('paymentAmount').value = '';
    show($('paymentModal'));
  }
  $('savePayment').onclick = async () => {
    const adm = $('payAdm').textContent;
    const amt = Number($('paymentAmount').value)||0;
    paymentsData[adm] = paymentsData[adm]||[];
    paymentsData[adm].push({date:new Date().toISOString().split('T')[0],amount:amt});
    await save('paymentsData', paymentsData);
    hide($('paymentModal')); renderStudents();
  };
  $('cancelPayment').onclick = ()=>hide($('paymentModal'));

  // MARK ATTENDANCE
  const statusNames = {P:'Present',A:'Absent',Lt:'Late',HD:'Half Day',L:'Leave'};
  const statusColors= {P:'var(--success)',A:'var(--danger)',Lt:'var(--warning)',HD:'#FF9800',L:'var(--info)'};

  $('loadAttendance').onclick = () => {
    const date = $('dateInput').value;
    if (!date) return alert('Pick a date');
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    const container = $('attendanceBody');
    container.innerHTML = '';
    roster.forEach(s=>{
      const row = document.createElement('div');
      row.className='attendance-row';
      const nameDiv = document.createElement('div');
      nameDiv.textContent=s.name;
      nameDiv.className='attendance-name';
      const btns = document.createElement('div');
      btns.className='attendance-buttons';
      Object.keys(statusNames).forEach(code=>{
        const b=document.createElement('button');
        b.textContent=code; b.className='att-btn';
        b.onclick=()=>{
          btns.querySelectorAll('.att-btn').forEach(x=>{x.classList.remove('selected'); x.style='';});
          b.classList.add('selected');
          b.style.background=statusColors[code]; b.style.color='#fff';
        };
        btns.appendChild(b);
      });
      row.append(nameDiv,btns);
      container.appendChild(row);
    });
    show(container,$('saveAttendance')); hide($('resetAttendance'),$('downloadAttendancePDF'),$('shareAttendanceSummary'),$('attendanceSummary'));
  };

  $('saveAttendance').onclick = async () => {
    const date = $('dateInput').value;
    attendanceData[date] = attendanceData[date]||{};
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    const roster = students.filter(s=>s.cls===cl&&s.sec===sec);
    roster.forEach((s,i)=>{
      const sel = $('attendanceBody').children[i].querySelector('.att-btn.selected');
      attendanceData[date][s.adm] = sel? sel.textContent : 'A';
    });
    await save('attendanceData', attendanceData);

    // build summary
    const sum = $('attendanceSummary');
    sum.innerHTML = `<h3>Attendance for ${date}</h3>`;
    const tbl = document.createElement('table');
    tbl.innerHTML = `<tr><th>Name</th><th>Status</th></tr>`;
    roster.forEach(s=>{
      const code = attendanceData[date][s.adm];
      tbl.innerHTML += `<tr><td>${s.name}</td><td>${statusNames[code]}</td></tr>`;
    });
    sum.appendChild(tbl);
    hide($('attendanceBody'),$('saveAttendance'));
    show($('attendanceSummary'),$('resetAttendance'),$('downloadAttendancePDF'),$('shareAttendanceSummary'));
  };

  $('resetAttendance').onclick = () => {
    hide($('attendanceSummary'),$('resetAttendance'),$('downloadAttendancePDF'),$('shareAttendanceSummary'));
    show($('attendanceBody'),$('saveAttendance'));
  };
  $('downloadAttendancePDF').onclick = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report',14,16);
    doc.autoTable({ startY:24, html:'#attendanceSummary table' });
    doc.save(`attendance_${$('dateInput').value}.pdf`);
  };
  $('shareAttendanceSummary').onclick = () => {
    const cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value,date=$('dateInput').value;
    const header=`Attendance ${date} Class ${cl}-${sec}`;
    let text = header+'\n';
    Object.entries(attendanceData[date]).forEach(([adm,code])=>{
      const s = students.find(x=>x.adm===adm);
      text += `${s.name}: ${statusNames[code]}\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank');
  };

  // ANALYTICS
  const atg=$('analyticsTarget'), asel=$('analyticsSectionSelect'),
        aty=$('analyticsType'), adt=$('analyticsDate'),
        amn=$('analyticsMonth'), ss=$('semesterStart'),
        se=$('semesterEnd'), yr=$('yearStart'),
        asr=$('analyticsSearch'),
        loadA=$('loadAnalytics'), resetA=$('resetAnalytics'),
        instr=$('instructions'), acont=$('analyticsContainer'),
        graphs=$('graphs'), aacts=$('analyticsActions'),
        barCtx=$('barChart').getContext('2d'),
        pieCtx=$('pieChart').getContext('2d');
  let barChart, pieChart, lastShare='';

  atg.onchange = ()=>{ aty.disabled=false; asel.classList.add('hidden'); asr.classList.add('hidden'); instr.classList.add('hidden'); acont.classList.add('hidden'); graphs.classList.add('hidden'); aacts.classList.add('hidden'); resetA.classList.add('hidden'); if(atg.value==='section') asel.classList.remove('hidden'); if(atg.value==='student') asr.classList.remove('hidden'); };
  aty.onchange = ()=>{ [adt,amn,ss,se,yr].forEach(x=>x.classList.add('hidden')); instr.classList.add('hidden'); acont.classList.add('hidden'); graphs.classList.add('hidden'); aacts.classList.add('hidden'); resetA.classList.remove('hidden'); if(aty.value==='date') adt.classList.remove('hidden'); if(aty.value==='month') amn.classList.remove('hidden'); if(aty.value==='semester'){ ss.classList.remove('hidden'); se.classList.remove('hidden'); } if(aty.value==='year') yr.classList.remove('hidden'); };

  resetA.onclick=()=>{
    aty.value=''; [adt,amn,ss,se,yr,instr,acont,graphs,aacts].forEach(x=>x.classList.add('hidden')); resetA.classList.add('hidden');
  };

  loadA.onclick=()=>{
    if(atg.value==='student' && !asr.value.trim()) return alert('Enter Adm# or Name');
    let from, to;
    if(aty.value==='date'){ from=to=adt.value; }
    else if(aty.value==='month'){ const [y,m]=amn.value.split('-'); from=`${amn.value}-01`; to=`${amn.value}-${new Date(y,m,0).getDate()}`; }
    else if(aty.value==='semester'){ const [sy,sm]=ss.value.split('-'); const [ey,em]=se.value.split('-'); from=`${ss.value}-01`; to=`${se.value}-${new Date(ey,em,0).getDate()}`; }
    else if(aty.value==='year'){ from=`${yr.value}-01-01`; to=`${yr.value}-12-31`; }
    else return alert('Select period');

    const cls=$('teacherClassSelect').value, secv=$('teacherSectionSelect').value;
    let pool=students.filter(s=>s.cls===cls&&s.sec===secv);
    if(atg.value==='section') pool=pool.filter(s=>s.sec===asel.value);
    if(atg.value==='student'){ const q=asr.value.toLowerCase(); pool=pool.filter(s=>s.adm===q||s.name.toLowerCase().includes(q)); }
    const stats=pool.map(s=>({adm:s.adm,name:s.name,P:0,A:0,Lt:0,HD:0,L:0,total:0}));
    Object.entries(attendanceData).forEach(([day,rec])=>{
      if(day<from||day>to) return;
      stats.forEach(st=>{ const c=rec[st.adm]||'A'; st[c]++; st.total++; });
    });

    // render table
    const thead=$('analyticsTable').querySelector('thead tr');
    thead.innerHTML=['#','Adm#','Name','P','A','Lt','HD','L','Total','%','Outstanding (₨)','Status']
      .map(h=>`<th>${h}</th>`).join('');
    const tbody=$('analyticsBody'); tbody.innerHTML='';
    let idx=1; stats.forEach(st=>{
      const pct=st.total?((st.P/st.total)*100).toFixed(1):'0.0';
      const totalFine=st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
      const paid=(paymentsData[st.adm]||[]).reduce((s,p)=>s+p.amount,0);
      const out=totalFine-paid;
      const status=(out>0||pct<eligibilityPct)?'Debarred':'Eligible';
      tbody.innerHTML+=`<tr>
        <td>${idx++}</td><td>${st.adm}</td><td>${st.name}</td>
        <td>${st.P}</td><td>${st.A}</td><td>${st.Lt}</td><td>${st.HD}</td><td>${st.L}</td>
        <td>${st.total}</td><td>${pct}%</td><td>₨ ${out}</td><td>${status}</td>
      </tr>`;
    });

    instr.textContent=`Period: ${from} to ${to}`; show(instr,acont,graphs,aacts);

    // bar chart
    barChart?.destroy();
    barChart=new Chart(barCtx,{type:'bar',data:{
      labels:stats.map(s=>s.name),
      datasets:[{label:'% Present',data:stats.map(s=>s.total? (s.P/s.total)*100:0)}]
    },options:{scales:{y:{beginAtZero:true,max:100}}}});

    // pie chart of total outstanding
    const agg=stats.reduce((sum,st)=>{
      const tf=st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
      const pd=(paymentsData[st.adm]||[]).reduce((s,p)=>s+p.amount,0);
      return sum + (tf-pd);
    },0);
    pieChart?.destroy();
    pieChart=new Chart(pieCtx,{type:'pie',data:{labels:['Outstanding'],datasets:[{data:[agg]}]}});

    // share text
    lastShare=`Analytics ${from} to ${to}\n`;
    stats.forEach((st,i)=>{
      const tf=st.A*fineRates.A + st.Lt*fineRates.Lt + st.L*fineRates.L + st.HD*fineRates.HD;
      const pd=(paymentsData[st.adm]||[]).reduce((s,p)=>s+p.amount,0);
      const out=tf-pd;
      lastShare+=`${i+1}. ${st.adm} ${st.name}: ${((st.P||0)/(st.total||1)*100).toFixed(1)}% / ₨${out}\n`;
    });
  };

  $('shareAnalytics').onclick = ()=> window.open(`https://wa.me/?text=${encodeURIComponent(lastShare)}`,'_blank');
  $('downloadAnalytics').onclick = ()=>{
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Analytics Report',14,16);
    doc.setFontSize(12); doc.text($('setupText').textContent,14,24);
    doc.autoTable({startY:32,html:'#analyticsTable'});
    doc.save('analytics_report.pdf');
  };

  // ATTENDANCE REGISTER
  $('loadRegister').onclick = ()=>{
    const m=$('registerMonth').value;
    if(!m) return alert('Pick month');
    const [y,mm]=m.split('-').map(Number);
    const days=new Date(y,mm,0).getDate();
    const hdr=[`<th>#</th><th>Adm#</th><th>Name</th>`];
    for(let d=1;d<=days;d++) hdr.push(`<th>${d}</th>`);
    $('registerHeader').innerHTML=hdr.join('');
    const cl=$('teacherClassSelect').value,sec=$('teacherSectionSelect').value;
    const roster=students.filter(s=>s.cls===cl&&s.sec===sec);
    const bodyHTML=roster.map((s,i)=>{
      let row=`<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for(let d=1;d<=days;d++){
        const key=`${m}-${String(d).padStart(2,'0')}`;
        const c=(attendanceData[key]||{})[s.adm]||'A';
        const bg=c==='A'?'':'background:'+statusColors[c]+';color:#fff';
        row+=`<td class="reg-cell" style="${bg}">${c}</td>`;
      }
      return `<tr>${row}</tr>`;
    }).join('');
    $('registerBody').innerHTML=bodyHTML;
    // toggle cell on click
    document.querySelectorAll('.reg-cell').forEach(cell=>{
      cell.onclick=()=>{
        const codes=['A','P','Lt','HD','L'];
        let i=codes.indexOf(cell.textContent);
        i=(i+1)%codes.length;
        const c=codes[i];
        cell.textContent=c;
        if(c==='A'){ cell.style=''; } else { cell.style=`background:${statusColors[c]};color:#fff`; }
      };
    });
    show($('registerTableWrapper'),$('saveRegister'));
    hide($('loadRegister'),$('changeRegister'),$('downloadRegister'),$('shareRegister'));
  };
  $('saveRegister').onclick=async ()=>{
    const m=$('registerMonth').value;
    const [y,mm]=m.split('-').map(Number);
    const days=new Date(y,mm,0).getDate();
    document.querySelectorAll('#registerBody tr').forEach(tr=>{
      const adm=tr.children[1].textContent;
      for(let d=1;d<=days;d++){
        const c=tr.children[3+d-1].textContent;
        const key=`${m}-${String(d).padStart(2,'0')}`;
        attendanceData[key]=attendanceData[key]||{};
        attendanceData[key][adm]=c;
      }
    });
    await save('attendanceData', attendanceData);
    show($('changeRegister'),$('downloadRegister'),$('shareRegister'));
    hide($('saveRegister'));
  };
  $('changeRegister').onclick=()=>{ show($('saveRegister')); hide($('changeRegister'),$('downloadRegister'),$('shareRegister')); };
  $('downloadRegister').onclick=()=>{
    const doc=new jspdf.jsPDF();
    doc.setFontSize(18); doc.text('Attendance Register',14,16);
    doc.autoTable({startY:24,html:'#registerTable'});
    doc.save('attendance_register.pdf');
  };
  $('shareRegister').onclick=()=>{
    let txt='Attendance Register\n'+$('setupText').textContent+'\n';
    document.querySelectorAll('#registerBody tr').forEach(tr=>{
      const vals=Array.from(tr.children).map(td=>td.textContent).join(' ');
      txt+=vals+'\n';
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`,'_blank');
  };

  // Service Worker
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');
});
