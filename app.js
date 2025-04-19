// app.js - Complete Attendance System
document.addEventListener('DOMContentLoaded', function() {
  // Utility function
  const $ = id => document.getElementById(id);

  // Color coding for attendance statuses
  const statusColors = {
    P: '#28a745',  // Present (green)
    A: '#dc3545',  // Absent (red)
    Lt: '#ffc107', // Late (yellow)
    HD: '#fd7e14', // Half Day (orange)
    L: '#17a2b8'   // Leave (blue)
  };

  // ====================
  // 1. SCHOOL SETUP
  // ====================
  function initSchoolSetup() {
    const setupForm = $('setupForm');
    const setupDisplay = $('setupDisplay');
    const setupText = $('setupText');

    function loadSetup() {
      const school = localStorage.getItem('schoolName');
      const cls = localStorage.getItem('teacherClass');
      const sec = localStorage.getItem('teacherSection');
      
      if (school && cls && sec) {
        $('schoolNameInput').value = school;
        $('teacherClassSelect').value = cls;
        $('teacherSectionSelect').value = sec;
        setupText.textContent = `${school} | Class: ${cls} | Section: ${sec}`;
        setupForm.classList.add('d-none');
        setupDisplay.classList.remove('d-none');
      }
    }

    $('saveSetup').addEventListener('click', function(e) {
      e.preventDefault();
      const school = $('schoolNameInput').value.trim();
      const cls = $('teacherClassSelect').value;
      const sec = $('teacherSectionSelect').value;
      
      if (!school || !cls || !sec) {
        alert('Please complete all setup fields');
        return;
      }
      
      localStorage.setItem('schoolName', school);
      localStorage.setItem('teacherClass', cls);
      localStorage.setItem('teacherSection', sec);
      loadSetup();
    });

    $('editSetup').addEventListener('click', function(e) {
      e.preventDefault();
      setupForm.classList.remove('d-none');
      setupDisplay.classList.add('d-none');
    });

    loadSetup();
  }

  // ====================
  // 2. STUDENT MANAGEMENT
  // ====================
  function initStudentManagement() {
    let students = JSON.parse(localStorage.getItem('students') || [];
    let regSaved = false;

    function saveStudents() {
      localStorage.setItem('students', JSON.stringify(students));
    }

    function renderStudents() {
      const tbody = $('studentsBody');
      tbody.innerHTML = '';
      
      students.sort((a, b) => a.name.localeCompare(b.name)).forEach((student, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><input type="checkbox" class="form-check-input student-checkbox" data-index="${index}" ${regSaved ? 'disabled' : ''}></td>
          <td>${student.name}</td>
          <td>${student.adm}</td>
          <td>${student.parent}</td>
          <td>${student.contact}</td>
          <td>${student.occupation}</td>
          <td>${student.address}</td>
          <td>${regSaved ? '<button class="btn btn-sm btn-outline-primary share-btn">Share</button>' : ''}</td>
        `;
        
        if (regSaved) {
          tr.querySelector('.share-btn').addEventListener('click', () => shareStudent(student));
        }
        
        tbody.appendChild(tr);
      });
      
      bindCheckboxes();
    }

    function bindCheckboxes() {
      const checkboxes = document.querySelectorAll('.student-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
          this.closest('tr').classList.toggle('table-primary', this.checked);
          updateActionButtons();
        });
      });

      $('selectAllStudents').addEventListener('change', function() {
        if (regSaved) return;
        document.querySelectorAll('.student-checkbox').forEach(cb => {
          cb.checked = this.checked;
          cb.dispatchEvent(new Event('change'));
        });
      });
    }

    function updateActionButtons() {
      const anySelected = document.querySelectorAll('.student-checkbox:checked').length > 0;
      $('editSelected').disabled = !anySelected || regSaved;
      $('deleteSelected').disabled = !anySelected || regSaved;
    }

    function shareStudent(student) {
      const school = localStorage.getItem('schoolName');
      const cls = localStorage.getItem('teacherClass');
      const sec = localStorage.getItem('teacherSection');
      const message = `Student Details\n\nSchool: ${school}\nClass: ${cls}\nSection: ${sec}\n\nName: ${student.name}\nAdmission No: ${student.adm}\nParent: ${student.parent}\nContact: ${student.contact}\nOccupation: ${student.occupation}\nAddress: ${student.address}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }

    // Form submission
    $('studentForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const formData = new FormData(this);
      const student = {
        name: formData.get('studentName').trim(),
        adm: formData.get('admissionNo').trim(),
        parent: formData.get('parentName').trim(),
        contact: formData.get('parentContact').trim(),
        occupation: formData.get('parentOccupation').trim(),
        address: formData.get('parentAddress').trim(),
        roll: Date.now()
      };

      // Validation
      if (!student.name || !student.adm || !student.parent || !student.contact) {
        alert('Please fill all required fields');
        return;
      }
      if (!/^\d+$/.test(student.adm)) {
        alert('Admission number must contain only digits');
        return;
      }
      if (students.some(s => s.adm === student.adm)) {
        alert(`Student with admission number ${student.adm} already exists`);
        return;
      }
      if (!/^\d{7,15}$/.test(student.contact)) {
        alert('Contact number must be 7-15 digits');
        return;
      }

      students.push(student);
      saveStudents();
      renderStudents();
      this.reset();
    });

    // Action buttons
    $('editSelected').addEventListener('click', function() {
      const selected = Array.from(document.querySelectorAll('.student-checkbox:checked'));
      if (selected.length === 0) return;

      selected.forEach(checkbox => {
        const index = checkbox.dataset.index;
        const row = checkbox.closest('tr');
        
        Array.from(row.children).forEach((cell, i) => {
          if (i >= 1 && i <= 6) { // Skip checkbox and action columns
            cell.contentEditable = true;
            cell.classList.add('editable');
            
            cell.addEventListener('blur', function() {
              const newValue = this.textContent.trim();
              const property = ['name', 'adm', 'parent', 'contact', 'occupation', 'address'][i-1];
              
              // Validate admission number
              if (property === 'adm') {
                if (!/^\d+$/.test(newValue)) {
                  alert('Admission number must contain only digits');
                  renderStudents();
                  return;
                }
                if (students.some((s, idx) => s.adm === newValue && idx != index)) {
                  alert(`Admission number ${newValue} already exists`);
                  renderStudents();
                  return;
                }
              }
              
              students[index][property] = newValue;
              saveStudents();
            });
          }
        });
      });
      
      alert('Click on any field to edit. Press Enter or click outside to save.');
    });

    $('deleteSelected').addEventListener('click', function() {
      const selected = Array.from(document.querySelectorAll('.student-checkbox:checked'))
        .map(cb => parseInt(cb.dataset.index))
        .sort((a, b) => b - a);
      
      if (selected.length === 0 || !confirm(`Delete ${selected.length} selected student(s)?`)) {
        return;
      }
      
      selected.forEach(index => students.splice(index, 1));
      saveStudents();
      renderStudents();
      $('selectAllStudents').checked = false;
    });

    $('saveRegistration').addEventListener('click', function() {
      regSaved = true;
      saveStudents();
      renderStudents();
      toggleRegistrationMode();
    });

    $('editRegistration').addEventListener('click', function() {
      regSaved = false;
      renderStudents();
      toggleRegistrationMode();
    });

    function toggleRegistrationMode() {
      $('studentTable').classList.toggle('registration-saved', regSaved);
      $('saveRegistration').classList.toggle('d-none', regSaved);
      $('editRegistration').classList.toggle('d-none', !regSaved);
      $('shareRegistration').classList.toggle('d-none', !regSaved);
      $('downloadRegistrationPDF').classList.toggle('d-none', !regSaved);
      $('selectAllStudents').disabled = regSaved;
    }

    $('shareRegistration').addEventListener('click', function() {
      const school = localStorage.getItem('schoolName');
      const cls = localStorage.getItem('teacherClass');
      const sec = localStorage.getItem('teacherSection');
      const header = `Student List\n\nSchool: ${school}\nClass: ${cls}\nSection: ${sec}\n\n`;
      const studentList = students.map(s => 
        `Name: ${s.name}\nAdm: ${s.adm}\nParent: ${s.parent}\nContact: ${s.contact}\nOccupation: ${s.occupation}\nAddress: ${s.address}`
      ).join('\n\n---\n\n');
      
      window.open(`https://wa.me/?text=${encodeURIComponent(header + studentList)}`, '_blank');
    });

    $('downloadRegistrationPDF').addEventListener('click', function() {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      // Add header
      doc.setFontSize(16);
      doc.text('Student Registration', 105, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`School: ${localStorage.getItem('schoolName')}`, 14, 25);
      doc.text(`Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`, 14, 32);
      
      // Add table
      doc.autoTable({
        head: [['Name', 'Adm No', 'Parent', 'Contact', 'Occupation', 'Address']],
        body: students.map(s => [s.name, s.adm, s.parent, s.contact, s.occupation, s.address]),
        startY: 40,
        margin: { left: 10 },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 15 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 40 }
        }
      });
      
      doc.save('student_registration.pdf');
    });

    // Initial render
    renderStudents();
  }

  // ====================
  // 3. ATTENDANCE MARKING
  // ====================
  function initAttendance() {
    let attendance = JSON.parse(localStorage.getItem('attendanceData') || {};

    function saveAttendance() {
      localStorage.setItem('attendanceData', JSON.stringify(attendance));
    }

    $('loadAttendance').addEventListener('click', function() {
      const date = $('dateInput').value;
      if (!date) {
        alert('Please select a date');
        return;
      }

      const students = JSON.parse(localStorage.getItem('students') || '[]');
      if (students.length === 0) {
        alert('No students registered');
        return;
      }

      $('attendanceList').innerHTML = '';
      students.forEach(student => {
        const div = document.createElement('div');
        div.className = 'attendance-item';
        div.textContent = student.name;

        const btnGroup = document.createElement('div');
        btnGroup.className = 'btn-group btn-group-sm';
        
        ['P', 'A', 'Lt', 'HD', 'L'].forEach(code => {
          const btn = document.createElement('button');
          btn.className = 'btn att-btn';
          btn.textContent = code;
          btn.dataset.code = code;
          btn.style.backgroundColor = attendance[date]?.[student.roll] === code ? statusColors[code] : '';
          btn.style.color = attendance[date]?.[student.roll] === code ? 'white' : '';
          
          btn.addEventListener('click', function() {
            // Clear all buttons in group
            btnGroup.querySelectorAll('.att-btn').forEach(b => {
              b.style.backgroundColor = '';
              b.style.color = '';
            });
            
            // Set selected button
            this.style.backgroundColor = statusColors[code];
            this.style.color = 'white';
          });
          
          btnGroup.appendChild(btn);
        });

        $('attendanceList').appendChild(div);
        $('attendanceList').appendChild(btnGroup);
      });

      $('saveAttendance').classList.remove('d-none');
    });

    $('saveAttendance').addEventListener('click', function() {
      const date = $('dateInput').value;
      if (!date) return;

      const students = JSON.parse(localStorage.getItem('students') || '[]');
      const btnGroups = $('attendanceList').querySelectorAll('.btn-group');
      
      attendance[date] = {};
      students.forEach((student, index) => {
        const selectedBtn = btnGroups[index].querySelector('.att-btn[style*="background-color"]');
        attendance[date][student.roll] = selectedBtn ? selectedBtn.dataset.code : 'A';
      });

      saveAttendance();
      showAttendanceResults(date);
    });

    function showAttendanceResults(date) {
      const students = JSON.parse(localStorage.getItem('students') || '[]');
      const results = $('attendanceResults');
      results.innerHTML = '';

      // Add header
      const header = document.createElement('h5');
      header.className = 'mb-3';
      header.textContent = `Attendance for ${date}`;
      results.appendChild(header);

      // Add summary table
      const table = document.createElement('table');
      table.className = 'table table-bordered';
      table.innerHTML = `
        <thead class="table-light">
          <tr>
            <th>Student</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      
      const tbody = table.querySelector('tbody');
      students.forEach(student => {
        const code = attendance[date]?.[student.roll] || 'A';
        const statusText = {
          P: 'Present',
          A: 'Absent',
          Lt: 'Late',
          HD: 'Half Day',
          L: 'Leave'
        }[code];
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${student.name}</td>
          <td style="color: ${statusColors[code]}">${statusText}</td>
          <td><button class="btn btn-sm btn-outline-primary notify-btn">Notify</button></td>
        `;
        
        row.querySelector('.notify-btn').addEventListener('click', function() {
          const message = `Attendance Notification\n\nDate: ${date}\nStudent: ${student.name}\nStatus: ${statusText}\n\n${localStorage.getItem('schoolName')}`;
          window.open(`https://wa.me/${student.contact}?text=${encodeURIComponent(message)}`, '_blank');
        });
        
        tbody.appendChild(row);
      });
      
      results.appendChild(table);
      $('attendanceSection').classList.add('d-none');
      results.classList.remove('d-none');
      
      // Show summary actions
      $('attendanceActions').classList.remove('d-none');
    }

    $('resetAttendance').addEventListener('click', function() {
      $('attendanceResults').classList.add('d-none');
      $('attendanceSection').classList.remove('d-none');
      $('attendanceList').innerHTML = '';
      $('saveAttendance').classList.add('d-none');
      $('attendanceActions').classList.add('d-none');
    });

    $('shareAttendanceSummary').addEventListener('click', function() {
      const date = $('dateInput').value;
      if (!date || !attendance[date]) {
        alert('No attendance data for selected date');
        return;
      }

      const students = JSON.parse(localStorage.getItem('students') || '[]');
      const present = students.filter(s => attendance[date][s.roll] === 'P').length;
      const percentage = ((present / students.length) * 100).toFixed(1);
      const remark = percentage >= 90 ? 'Excellent' : 
                    percentage >= 75 ? 'Good' : 
                    percentage >= 50 ? 'Fair' : 'Poor';

      let message = `Attendance Summary - ${date}\n\n`;
      message += `School: ${localStorage.getItem('schoolName')}\n`;
      message += `Class: ${localStorage.getItem('teacherClass')}\n`;
      message += `Section: ${localStorage.getItem('teacherSection')}\n\n`;
      
      students.forEach(student => {
        const code = attendance[date][student.roll] || 'A';
        message += `${student.name}: ${code}\n`;
      });

      message += `\nPresent: ${present}/${students.length} (${percentage}%) - ${remark}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    });

    $('downloadAttendancePDF').addEventListener('click', function() {
      const date = $('dateInput').value;
      if (!date || !attendance[date]) {
        alert('No attendance data for selected date');
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      // Add header
      doc.setFontSize(16);
      doc.text(`Attendance - ${date}`, 105, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`School: ${localStorage.getItem('schoolName')}`, 14, 25);
      doc.text(`Class: ${localStorage.getItem('teacherClass')} | Section: ${localStorage.getItem('teacherSection')}`, 14, 32);
      
      // Add table
      const students = JSON.parse(localStorage.getItem('students') || '[]');
      const data = students.map(student => {
        const code = attendance[date][student.roll] || 'A';
        return [
          student.name,
          {
            P: 'Present',
            A: 'Absent',
            Lt: 'Late',
            HD: 'Half Day',
            L: 'Leave'
          }[code]
        ];
      });

      doc.autoTable({
        head: [['Name', 'Status']],
        body: data,
        startY: 40,
        margin: { left: 10 },
        styles: { fontSize: 10 }
      });
      
      doc.save(`attendance_${date.replace(/-/g, '')}.pdf`);
    });
  }

  // ====================
  // 4. ATTENDANCE ANALYTICS
  // ====================
  function initAnalytics() {
    const attendance = JSON.parse(localStorage.getItem('attendanceData') || '{}');
    let barChart, pieChart;

    $('analyticsTarget').addEventListener('change', function() {
      $('studentAdmInput').classList.toggle('d-none', this.value === 'class');
    });

    $('analyticsType').addEventListener('change', function() {
      // Hide all period inputs
      ['date', 'month', 'semester', 'year'].forEach(type => {
        $(`${type}Input`).classList.add('d-none');
      });

      // Show selected input
      if (this.value) {
        $(`${this.value}Input`).classList.remove('d-none');
      }
    });

    $('loadAnalytics').addEventListener('click', function() {
      const target = $('analyticsTarget').value;
      const type = $('analyticsType').value;
      
      if (!type) {
        alert('Please select an analytics type');
        return;
      }

      // Get date range based on type
      let fromDate, toDate;
      const now = new Date();

      switch(type) {
        case 'date':
          if (!$('analyticsDate').value) {
            alert('Please select a date');
            return;
          }
          fromDate = new Date($('analyticsDate').value);
          toDate = new Date($('analyticsDate').value);
          break;
        
        case 'month':
          if (!$('analyticsMonth').value) {
            alert('Please select a month');
            return;
          }
          const [year, month] = $('analyticsMonth').value.split('-').map(Number);
          fromDate = new Date(year, month - 1, 1);
          toDate = new Date(year, month, 0);
          break;
        
        case 'semester':
          if (!$('semesterStart').value || !$('semesterEnd').value) {
            alert('Please select semester range');
            return;
          }
          const [startYear, startMonth] = $('semesterStart').value.split('-').map(Number);
          const [endYear, endMonth] = $('semesterEnd').value.split('-').map(Number);
          fromDate = new Date(startYear, startMonth - 1, 1);
          toDate = new Date(endYear, endMonth, 0);
          break;
        
        case 'year':
          if (!$('yearStart').value) {
            alert('Please select a year');
            return;
          }
          fromDate = new Date($('yearStart').value, 0, 1);
          toDate = new Date($('yearStart').value, 11, 31);
          break;
      }

      // Filter students if individual student selected
      let students = JSON.parse(localStorage.getItem('students') || []);
      if (target === 'student') {
        const admNo = $('studentAdmInput').value.trim();
        if (!admNo) {
          alert('Please enter admission number');
          return;
        }
        const student = students.find(s => s.adm === admNo);
        if (!student) {
          alert(`No student found with admission number ${admNo}`);
          return;
        }
        students = [student];
      }

      // Calculate statistics
      const stats = students.map(student => ({
        name: student.name,
        roll: student.roll,
        P: 0, A: 0, Lt: 0, HD: 0, L: 0,
        total: 0
      }));

      // Process attendance records
      Object.entries(attendance).forEach(([dateStr, records]) => {
        const date = new Date(dateStr);
        if (date >= fromDate && date <= toDate) {
          stats.forEach(stat => {
            const code = records[stat.roll] || 'A';
            stat[code]++;
            stat.total++;
          });
        }
      });

      // Display results
      displayAnalyticsResults(stats, fromDate, toDate);
    });

    function displayAnalyticsResults(stats, fromDate, toDate) {
      // Format date range
      const fromStr = fromDate.toLocaleDateString();
      const toStr = toDate.toLocaleDateString();
      const rangeStr = fromStr === toStr ? fromStr : `${fromStr} to ${toStr}`;

      // Update results table
      const tbody = $('analyticsTable').querySelector('tbody');
      tbody.innerHTML = '';
      
      stats.forEach(stat => {
        const percentage = stat.total ? (stat.P / stat.total * 100).toFixed(1) : 0;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${stat.name}</td>
          <td>${stat.P}</td>
          <td>${stat.A}</td>
          <td>${stat.Lt}</td>
          <td>${stat.HD}</td>
          <td>${stat.L}</td>
          <td>${stat.total}</td>
          <td>${percentage}%</td>
        `;
        tbody.appendChild(row);
      });

      // Update charts
      updateCharts(stats);

      // Show results section
      $('analyticsInstructions').textContent = `Analytics for ${rangeStr}`;
      $('analyticsResults').classList.remove('d-none');
      $('analyticsActions').classList.remove('d-none');
    }

    function updateCharts(stats) {
      // Destroy existing charts
      if (barChart) barChart.destroy();
      if (pieChart) pieChart.destroy();

      // Bar Chart (Attendance Percentage)
      const labels = stats.map(stat => stat.name);
      const percentages = stats.map(stat => stat.total ? (stat.P / stat.total * 100) : 0);
      
      barChart = new Chart($('barChart'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Attendance Percentage',
            data: percentages,
            backgroundColor: '#28a745',
            borderColor: '#218838',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              title: {
                display: true,
                text: 'Percentage (%)'
              }
            }
          }
        }
      });

      // Pie Chart (Status Distribution)
      const overall = stats.reduce((acc, stat) => {
        acc.P += stat.P;
        acc.A += stat.A;
        acc.Lt += stat.Lt;
        acc.HD += stat.HD;
        acc.L += stat.L;
        return acc;
      }, { P: 0, A: 0, Lt: 0, HD: 0, L: 0 });

      pieChart = new Chart($('pieChart'), {
        type: 'pie',
        data: {
          labels: ['Present', 'Absent', 'Late', 'Half Day', 'Leave'],
          datasets: [{
            data: [overall.P, overall.A, overall.Lt, overall.HD, overall.L],
            backgroundColor: [
              statusColors.P,
              statusColors.A,
              statusColors.Lt,
              statusColors.HD,
              statusColors.L
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true
        }
      });
    }

    $('resetAnalytics').addEventListener('click', function() {
      $('analyticsForm').reset();
      $('analyticsResults').classList.add('d-none');
      $('analyticsActions').classList.add('d-none');
      $('studentAdmInput').classList.add('d-none');
      ['date', 'month', 'semester', 'year'].forEach(type => {
        $(`${type}Input`).classList.add('d-none');
      });
      
      if (barChart) barChart.destroy();
      if (pieChart) pieChart.destroy();
    });

    $('shareAnalytics').addEventListener('click', function() {
      const rows = $('analyticsTable').querySelectorAll('tbody tr');
      if (rows.length === 0) {
        alert('No analytics data to share');
        return;
      }

      let message = $('analyticsInstructions').textContent + '\n\n';
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        message += `${cells[0].textContent}: ${cells[7].textContent} (P:${cells[1].textContent}, A:${cells[2].textContent})\n`;
      });

      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    });

    $('downloadAnalytics').addEventListener('click', function() {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(16);
      doc.text('Attendance Analytics', 105, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text($('analyticsInstructions').textContent, 14, 25);
      
      // Add table
      const headers = [];
      const data = [];
      
      // Get headers
      $('analyticsTable').querySelectorAll('thead th').forEach(th => {
        headers.push(th.textContent);
      });
      
      // Get data rows
      $('analyticsTable').querySelectorAll('tbody tr').forEach(tr => {
        const row = [];
        tr.querySelectorAll('td').forEach(td => {
          row.push(td.textContent);
        });
        data.push(row);
      });
      
      doc.autoTable({
        head: [headers],
        body: data,
        startY: 35,
        margin: { left: 10 },
        styles: { fontSize: 9 }
      });
      
      doc.save('attendance_analytics.pdf');
    });
  }

  // ====================
  // 5. ATTENDANCE REGISTER
  // ====================
  function initRegister() {
    const attendance = JSON.parse(localStorage.getItem('attendanceData') || {});

    $('loadRegister').addEventListener('click', function() {
      const fromDate = new Date($('registerDateFrom').value);
      const toDate = new Date($('registerDateTo').value);
      
      if (!fromDate || !toDate) {
        alert('Please select date range');
        return;
      }
      if (fromDate > toDate) {
        alert('Invalid date range');
        return;
      }
      
      const students = JSON.parse(localStorage.getItem('students') || []);
      if (students.length === 0) {
        alert('No students registered');
        return;
      }

      // Generate all dates in range
      const dates = [];
      for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      // Build table header
      let header = '<thead><tr><th>Student</th>';
      dates.forEach(date => {
        header += `<th>${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</th>`;
      });
      header += '</tr></thead>';
      
      // Build table body
      let body = '<tbody>';
      students.forEach(student => {
        body += `<tr><td>${student.name}</td>`;
        dates.forEach(date => {
          const code = attendance[date]?.[student.roll] || '';
          body += `<td style="color:${statusColors[code] || 'inherit'}">${code}</td>`;
        });
        body += '</tr>';
      });
      body += '</tbody>';
      
      $('registerTable').innerHTML = header + body;
      $('registerResults').classList.remove('d-none');
      $('registerActions').classList.remove('d-none');
    });

    $('downloadRegisterPDF').addEventListener('click', function() {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape');
      
      // Add title
      doc.setFontSize(16);
      doc.text('Attendance Register', 145, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`${$('registerDateFrom').value} to ${$('registerDateTo').value}`, 145, 25, { align: 'center' });
      
      // Add table
      const headers = [];
      const data = [];
      
      // Get headers
      $('registerTable').querySelectorAll('thead th').forEach(th => {
        headers.push(th.textContent);
      });
      
      // Get data rows
      $('registerTable').querySelectorAll('tbody tr').forEach(tr => {
        const row = [];
        tr.querySelectorAll('td').forEach(td => {
          row.push(td.textContent);
        });
        data.push(row);
      });
      
      doc.autoTable({
        head: [headers],
        body: data,
        startY: 35,
        margin: { left: 10 },
        styles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 40 } // Fixed width for student names
        }
      });
      
      doc.save('attendance_register.pdf');
    });

    $('shareRegister').addEventListener('click', function() {
      const from = $('registerDateFrom').value;
      const to = $('registerDateTo').value;
      const rows = $('registerTable').querySelectorAll('tbody tr');
      
      if (rows.length === 0) {
        alert('No register data to share');
        return;
      }
      
      let message = `Attendance Register\n${from} to ${to}\n\n`;
      message += `School: ${localStorage.getItem('schoolName')}\n`;
      message += `Class: ${localStorage.getItem('teacherClass')}\n`;
      message += `Section: ${localStorage.getItem('teacherSection')}\n\n`;
      
      rows.forEach(row => {
        const name = row.querySelector('td').textContent;
        const dates = Array.from(row.querySelectorAll('td')).slice(1).map(td => td.textContent || '-');
        message += `${name}: ${dates.join(', ')}\n`;
      });
      
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    });
  }

  // ====================
  // 6. DATA MANAGEMENT
  // ====================
  function initDataManagement() {
    $('backupData').addEventListener('click', function() {
      const data = {
        school: localStorage.getItem('schoolName'),
        class: localStorage.getItem('teacherClass'),
        section: localStorage.getItem('teacherSection'),
        students: JSON.parse(localStorage.getItem('students') || []),
        attendance: JSON.parse(localStorage.getItem('attendanceData') || {}),
        timestamp: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    $('restoreData').addEventListener('click', function() {
      $('restoreFile').click();
    });

    $('restoreFile').addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = JSON.parse(e.target.result);
          
          if (!confirm('Restore this backup? Current data will be replaced.')) {
            return;
          }
          
          localStorage.setItem('schoolName', data.school || '');
          localStorage.setItem('teacherClass', data.class || '');
          localStorage.setItem('teacherSection', data.section || '');
          localStorage.setItem('students', JSON.stringify(data.students || []));
          localStorage.setItem('attendanceData', JSON.stringify(data.attendance || {}));
          
          alert('Data restored successfully! Page will reload.');
          location.reload();
        } catch (err) {
          alert('Error restoring backup: Invalid file format');
        }
      };
      reader.readAsText(file);
    });

    $('resetAllData').addEventListener('click', function() {
      if (confirm('WARNING: This will delete ALL data permanently. Continue?')) {
        localStorage.clear();
        alert('All data has been reset. Page will reload.');
        location.reload();
      }
    });
  }

  // ====================
  // 7. INITIALIZATION
  // ====================
  function initialize() {
    // Set default dates
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    // Attendance date
    $('dateInput').value = `${year}-${month}-${day}`;
    $('analyticsDate').value = `${year}-${month}-${day}`;
    
    // Register dates (current month)
    $('registerDateFrom').value = `${year}-${month}-01`;
    $('registerDateTo').value = `${year}-${month}-${day}`;
    
    // Semester defaults (Jan-Jun or Jul-Dec)
    const semester = today.getMonth() < 6 ? 1 : 2;
    $('semesterStart').value = `${year}-${semester === 1 ? '01' : '07'}`;
    $('semesterEnd').value = `${year}-${semester === 1 ? '06' : '12'}`;
    
    // Month and year defaults
    $('analyticsMonth').value = `${year}-${month}`;
    $('yearStart').value = year;

    // Initialize all modules
    initSchoolSetup();
    initStudentManagement();
    initAttendance();
    initAnalytics();
    initRegister();
    initDataManagement();
  }

  // Start the application
  initialize();
});
