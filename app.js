// Sample data for attendance register
const attendanceData = {
  '123': {
    name: 'Ali Khan',
    attendance: {
      '2024-04-01': 'Present',
      '2024-04-02': 'Absent',
      '2024-04-03': 'Present'
    }
  },
  '124': {
    name: 'Sara Ahmed',
    attendance: {
      '2024-04-01': 'Present',
      '2024-04-02': 'Present',
      '2024-04-03': 'Present'
    }
  }
};

// Load Attendance Register
document.getElementById('loadRegister').addEventListener('click', function () {
  const month = document.getElementById('registerMonth').value;
  const registerBody = document.getElementById('registerBody');
  registerBody.innerHTML = '';

  const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();

  for (let roll in attendanceData) {
    const student = attendanceData[roll];
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    nameTd.textContent = `${roll} - ${student.name}`;
    tr.appendChild(nameTd);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${month}-${String(day).padStart(2, '0')}`;
      const status = student.attendance[dateStr] || '';
      const td = document.createElement('td');
      td.textContent = status;
      tr.appendChild(td);
    }

    registerBody.appendChild(tr);
  }
});

// Share Analytics
document.getElementById('shareAnalytics').addEventListener('click', function () {
  const report = 'Attendance Analytics Report for April:\n\nAli Khan: 2 Present, 1 Absent\nSara Ahmed: 3 Present';
  if (navigator.share) {
    navigator.share({
      title: 'Attendance Analytics',
      text: report
    }).then(() => console.log('Shared successfully'))
      .catch(error => console.log('Error sharing:', error));
  } else {
    alert('Web Share API not supported in this browser.');
  }
});

// Download Analytics
document.getElementById('downloadAnalytics').addEventListener('click', function () {
  const report = 'Attendance Analytics Report for April:\n\nAli Khan: 2 Present, 1 Absent\nSara Ahmed: 3 Present';
  const blob = new Blob([report], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'Attendance_Analytics_Report.txt';
  link.click();
});
