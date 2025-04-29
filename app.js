// app.js

window.addEventListener('DOMContentLoaded', async () => {
  // ... (setup, counters, registration, attendance, analytics code unchanged) ...

  // --- 6. ATTENDANCE REGISTER (FIXED) ---
  const loadRegisterBtn   = document.getElementById('loadRegister');
  const changeRegisterBtn = document.getElementById('changeRegister');
  const downloadRegister  = document.getElementById('downloadRegister');
  const shareRegister     = document.getElementById('shareRegister');
  const monthInput        = document.getElementById('registerMonth');
  const registerHeader    = document.getElementById('registerHeader');
  const registerBody      = document.getElementById('registerBody');

  const regCodes   = ['A','P','Lt','HD','L'];
  const regColors  = {
    P: 'var(--success)',
    A: 'var(--danger)',
    Lt: 'var(--warning)',
    HD: '#FF9800',
    L: 'var(--info)'
  };

  // Ensure the Load button is active
  loadRegisterBtn.addEventListener('click', () => {
    const m = monthInput.value;
    if (!m) {
      alert('Please select a month');
      return;
    }
    const [y, mm] = m.split('-').map(Number);
    const days = new Date(y, mm, 0).getDate();

    // Build header
    registerHeader.innerHTML =
      '<th>#</th><th>Adm#</th><th>Name</th>' +
      Array.from({ length: days }, (_, i) => `<th>${i+1}</th>`).join('');

    // Build body
    registerBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      let row = `<td>${i+1}</td><td>${s.adm}</td><td>${s.name}</td>`;
      for (let d = 0; d < days; d++) {
        row += `<td class="reg-cell"><span class="status-text">A</span></td>`;
      }
      tr.innerHTML = row;
      registerBody.appendChild(tr);
    });

    // Attach click handlers to cycle status
    document.querySelectorAll('.reg-cell').forEach(cell => {
      const span = cell.querySelector('.status-text');
      cell.addEventListener('click', () => {
        let idx = regCodes.indexOf(span.textContent);
        idx = (idx + 1) % regCodes.length;
        span.textContent = regCodes[idx];
        if (regCodes[idx] === 'A') {
          cell.style.background = '';
          cell.style.color = '';
        } else {
          cell.style.background = regColors[regCodes[idx]];
          cell.style.color = '#fff';
        }
      });
    });

    // Show/Hide controls
    document.getElementById('registerTableWrapper').classList.remove('hidden');
    changeRegisterBtn.classList.remove('hidden');
    downloadRegister.classList.remove('hidden');
    shareRegister.classList.remove('hidden');
    loadRegisterBtn.classList.add('hidden');
  });

  changeRegisterBtn.addEventListener('click', () => {
    document.getElementById('registerTableWrapper').classList.add('hidden');
    changeRegisterBtn.classList.add('hidden');
    downloadRegister.classList.add('hidden');
    shareRegister.classList.add('hidden');
    loadRegisterBtn.classList.remove('hidden');
  });

  downloadRegister.addEventListener('click', () => {
    const doc = new jsPDF();
    doc.autoTable({ html: '#registerTable' });
    doc.save('attendance_register.pdf');
  });

  shareRegister.addEventListener('click', () => {
    const hdr = `Attendance Register: ${monthInput.value}`;
    const rows = Array.from(registerBody.querySelectorAll('tr')).map(tr =>
      Array.from(tr.querySelectorAll('td')).map(td => {
        const st = td.querySelector('.status-text');
        return st ? st.textContent.trim() : td.textContent.trim();
      }).join(' ')
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(hdr + '\n' + rows.join('\n'))}`, '_blank');
  });

  // ... (rest of service worker registration, etc.) ...

});
