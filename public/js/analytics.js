// File: src/js/analytics.js
import Chart from 'chart.js/auto';
import { get } from 'idb-keyval';
const $ = id => document.getElementById(id);

export async function initAnalytics() {
  const attendanceData = await get('attendanceData')||{};
  const paymentsData   = await get('paymentsData')||{};
  const fineRates      = await get('fineRates')||{A:50,Lt:20,L:10,HD:30};
  const eligibilityPct = await get('eligibilityPct')||75;

  const target    = $('analyticsTarget');
  const typeSel   = $('analyticsType');
  const dateInput = $('analyticsDate');
  const loadBtn   = $('loadAnalytics');
  const barCtx    = $('barChart').getContext('2d');
  const pieCtx    = $('pieChart').getContext('2d');

  loadBtn.onclick = () => {
    // determine from/to based on typeSel & dateInput...
    // build stats array
    const labels = stats.map(s=>s.name);
    const presPerc = stats.map(s=> s.total? s.P/s.total*100:0 );
    new Chart(barCtx, { type:'bar', data:{labels,datasets:[{label:'% Present',data:presPerc}]}});
    const totals = stats.reduce((a,s)=>{ a.P+=s.P; a.A+=s.A; return a; },{P:0,A:0});
    new Chart(pieCtx, { type:'pie', data:{labels:['Present','Absent'],datasets:[{data:[totals.P,totals.A]}]}});
  };
}
