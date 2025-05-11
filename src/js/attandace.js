// File: src/js/attendance.js
import { set, get } from 'idb-keyval';
const $ = id => document.getElementById(id);

let attendanceData = {};

export async function initAttendance() {
  attendanceData = await get('attendanceData')||{};

  const dateInput               = $('dateInput');
  const loadBtn                 = $('loadAttendance');
  const saveBtn                 = $('saveAttendance');
  const resetBtn                = $('resetAttendance');
  const downloadBtn             = $('downloadAttendancePDF');
  const shareBtn                = $('shareAttendanceSummary');
  const bodyDiv                 = $('attendanceBody');
  const summaryDiv              = $('attendanceSummary');
  const statusNames             = {P:'Present',A:'Absent',Lt:'Late',HD:'Half-Day',L:'Leave'};
  const statusColors            = {P:'#28a745',A:'#dc3545',Lt:'#ffc107',HD:'#fd7e14',L:'#17a2b8'};

  loadBtn.onclick = () => {
    bodyDiv.innerHTML=''; summaryDiv.innerHTML='';
    const cl = $('teacherClassSelect').value;
    const sec= $('teacherSectionSelect').value;
    const students = await get('students')||[];
    students.filter(s=>s.cls===cl&&s.sec===sec).forEach((stu,i)=>{
      const row = document.createElement('div');
      row.className='attendance-row';
      row.innerHTML = `<strong>${i+1}. ${stu.name} (${stu.adm})</strong>`;
      const btns = document.createElement('div');
      Object.keys(statusNames).forEach(code=>{
        const b=document.createElement('button');
        b.textContent=code;
        b.onclick=()=> {
          btns.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));
          b.classList.add('selected');
          b.style.background=statusColors[code]; b.style.color='#fff';
        };
        btns.append(b);
      });
      row.append(btns);
      bodyDiv.append(row);
    });
    bodyDiv.classList.remove('hidden');
    saveBtn.classList.remove('hidden');
    resetBtn.classList.add('hidden');
    downloadBtn.classList.add('hidden');
    shareBtn.classList.add('hidden');
  };

  saveBtn.onclick = async () => {
    const date = dateInput.value; if(!date) return alert('Pick date');
    attendanceData[date]={};
    const students = await get('students')||[];
    bodyDiv.querySelectorAll('.attendance-row').forEach((row,i)=>{
      const adm = students[i].adm;
      const sel = row.querySelector('.selected');
      attendanceData[date][adm] = sel? sel.textContent : 'A';
    });
    await set('attendanceData', attendanceData);

    // render summary table
    let html=`<table id="attendanceSummaryTable"><tr>
      <th>#</th><th>Adm#</th><th>Name</th><th>Status</th><th>Share</th>
    </tr>`;
    students.filter(s=>s.cls===cl&&s.sec===sec).forEach((s,i)=>{
      const st = attendanceData[date][s.adm];
      html+=`<tr>
        <td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>
        <td>${statusNames[st]}</td>
        <td><button class="share-ind" data-adm="${s.adm}">WA</button></td>
      </tr>`;
    });
    html+='</table>';
    summaryDiv.innerHTML=html;

    summaryDiv.classList.remove('hidden');
    bodyDiv.classList.add('hidden');
    saveBtn.classList.add('hidden');
    resetBtn.classList.remove('hidden');
    downloadBtn.classList.remove('hidden');
    shareBtn.classList.remove('hidden');

    // attach share-ind handlers
    summaryDiv.querySelectorAll('.share-ind').forEach(btn=>{
      btn.onclick=()=> {
        const adm = btn.dataset.adm;
        const msg = `Your child (Adm#: ${adm}) was ${statusNames[attendanceData[date][adm]]} on ${date}.`;
        window.open(`https://wa.me/${adm}?text=${encodeURIComponent(msg)}`);
      };
    });
  };

  resetBtn.onclick=()=>loadBtn.onclick();
  downloadBtn.onclick=()=>{/* same jsPDF code as before */};
  shareBtn.onclick=()=>{/* WhatsApp summary share */};
}
