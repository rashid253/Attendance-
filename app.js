// app.js
document.addEventListener('DOMContentLoaded', function() {
    // IndexedDB keys
    const STUDENTS_KEY = 'students';
    const RECORDS_KEY = 'attendanceRecords';

    // State
    let students = [];
    let attendanceRecords = [];
    let editingActive = true; // Controls edit/delete visibility in registration

    // DOM Elements - Registration
    const studentFormGroup = document.getElementById('studentFormGroup');
    const studentNameInput = document.getElementById('studentName');
    const addStudentBtn = document.getElementById('addStudent');
    const studentsTableBody = document.getElementById('studentsTableBody');
    const saveTableBtn = document.getElementById('saveTable');
    const shareTableBtn = document.getElementById('shareTable');
    const downloadTableBtn = document.getElementById('downloadTable');
    const editTableBtn = document.getElementById('editTable');

    // DOM Elements - Attendance
    const attendanceContainer = document.getElementById('attendanceContainer');
    const attendanceSummaryDiv = document.getElementById('attendanceSummary');
    const attendanceSummaryList = document.getElementById('attendanceSummaryList');
    const shareAttendanceBtn = document.getElementById('shareAttendance');
    const downloadAttendanceBtn = document.getElementById('downloadAttendance');

    // DOM Elements - Register
    const attendanceRecordsContainer = document.getElementById('attendanceRecordsContainer');

    // Helper: Save students array to IndexedDB
    function saveStudentsToDB() {
        idbKeyval.set(STUDENTS_KEY, students);
    }
    // Helper: Save attendance records to IndexedDB
    function saveRecordsToDB() {
        idbKeyval.set(RECORDS_KEY, attendanceRecords);
    }

    // Render student table based on 'students' array
    function renderStudentTable() {
        studentsTableBody.innerHTML = '';
        students.forEach((student, index) => {
            const tr = document.createElement('tr');
            tr.dataset.id = student.admission;
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${student.admission}</td>
                <td class="student-name">${student.name}</td>
                <td>
                    ${editingActive ? 
                        `<button class="btn btn-link p-0 edit-btn" title="Edit"><i class="fa fa-pencil"></i></button>
                         <button class="btn btn-link p-0 delete-btn text-danger" title="Delete"><i class="fa fa-trash"></i></button>`
                        : ''}
                </td>`;
            studentsTableBody.appendChild(tr);
        });
    }

    // Render attendance marking form/table
    function renderAttendanceForm() {
        attendanceContainer.innerHTML = '';
        attendanceSummaryDiv.classList.add('d-none');
        if (students.length === 0) {
            // No students message
            const msg = document.createElement('p');
            msg.className = 'text-muted';
            msg.textContent = 'No students registered. Please add students first.';
            attendanceContainer.appendChild(msg);
            return;
        }
        // Create table of students with checkboxes
        const table = document.createElement('table');
        table.className = 'table table-striped';
        table.innerHTML = `
            <thead class="table-dark"><tr>
                <th>Sr#</th><th>Name</th><th>Present</th>
            </tr></thead>
            <tbody id="attendanceTableBody"></tbody>`;
        attendanceContainer.appendChild(table);

        const tbody = table.querySelector('#attendanceTableBody');
        students.forEach((student, idx) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${idx + 1}</td>
                <td>${student.name}</td>
                <td><input type="checkbox" class="form-check-input attendance-checkbox"></td>`;
            tbody.appendChild(row);
        });
        // Add Save Attendance button
        const saveBtn = document.createElement('button');
        saveBtn.id = 'saveAttendance';
        saveBtn.className = 'btn btn-primary';
        saveBtn.textContent = 'Save Attendance';
        attendanceContainer.appendChild(saveBtn);

        // Event listener for save attendance
        saveBtn.addEventListener('click', function() {
            const checkboxes = tbody.querySelectorAll('input.attendance-checkbox');
            const summaryList = [];
            checkboxes.forEach((cb, i) => {
                const status = cb.checked ? 'Present' : 'Absent';
                summaryList.push({ name: students[i].name, status: status });
            });
            // Hide form and show summary
            attendanceContainer.innerHTML = '';
            attendanceSummaryDiv.classList.remove('d-none');
            attendanceSummaryList.innerHTML = '';
            summaryList.forEach(item => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                const span = document.createElement('span');
                span.textContent = item.status;
                span.className = item.status === 'Present' ? 'text-success' : 'text-danger';
                li.textContent = `${item.name} - `;
                li.appendChild(span);
                attendanceSummaryList.appendChild(li);
            });
            // Save record with timestamp
            const now = new Date();
            const timestamp = now.toLocaleString();
            attendanceRecords.push({ date: timestamp, list: summaryList });
            saveRecordsToDB();
            // Re-render register section
            renderAttendanceRecords();
        });
    }

    // Render attendance records (Attendance Register section)
    function renderAttendanceRecords() {
        attendanceRecordsContainer.innerHTML = '';
        if (attendanceRecords.length === 0) {
            const msg = document.createElement('p');
            msg.className = 'text-muted';
            msg.textContent = 'No attendance records available.';
            attendanceRecordsContainer.appendChild(msg);
            return;
        }
        attendanceRecords.forEach((record, index) => {
            const card = document.createElement('div');
            card.className = 'card mb-3';
            let listItems = '';
            record.list.forEach(item => {
                listItems += `<li class="list-group-item">
                    ${item.name} - <span class="${item.status === 'Present' ? 'text-success' : 'text-danger'}">${item.status}</span>
                </li>`;
            });
            card.innerHTML = `
                <div class="card-body">
                    <h5 class="card-title">Attendance on: ${record.date}</h5>
                    <ul class="list-group mb-2">
                        ${listItems}
                    </ul>
                    <button class="btn btn-info btn-sm share-record" data-index="${index}"><i class="fa fa-share-alt"></i> Share</button>
                    <button class="btn btn-secondary btn-sm download-record" data-index="${index}"><i class="fa fa-download"></i> Download</button>
                </div>`;
            attendanceRecordsContainer.appendChild(card);
        });
    }

    // Share or download a record PDF
    function generateAttendancePDF(record, actionType) {
        // record: { date, list: [ {name, status} ] }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        // Title
        doc.text(`Attendance Record: ${record.date}`, 14, 15);
        // Prepare table data
        const body = record.list.map((item, i) => [
            i + 1, item.name, item.status
        ]);
        doc.autoTable({
            head: [['Sr#', 'Name', 'Status']],
            body: body,
            startY: 20,
            styles: { halign: 'center' },
            headStyles: { fillColor: [40, 40, 40] }
        });
        const filename = `Attendance_${record.date.replace(/[, ]/g, '_')}.pdf`;
        if (actionType === 'share' && navigator.canShare && navigator.canShare({ files: [] })) {
            doc.save(filename); // fallback if no file share support
            try {
                const blob = doc.output('blob');
                const file = new File([blob], filename, { type: 'application/pdf' });
                navigator.share({ files: [file], title: filename });
            } catch (err) {
                console.error('Share failed:', err);
            }
        } else {
            doc.save(filename);
        }
    }

    // Event delegation for share/download in Attendance Register
    attendanceRecordsContainer.addEventListener('click', function(e) {
        const shareBtn = e.target.closest('button.share-record');
        const downloadBtn = e.target.closest('button.download-record');
        if (shareBtn) {
            const idx = parseInt(shareBtn.dataset.index, 10);
            generateAttendancePDF(attendanceRecords[idx], 'share');
        }
        if (downloadBtn) {
            const idx = parseInt(downloadBtn.dataset.index, 10);
            generateAttendancePDF(attendanceRecords[idx], 'download');
        }
    });

    // Event listeners for Student Registration section
    addStudentBtn.addEventListener('click', function() {
        if (!editingActive) return; // do nothing if table is saved
        const name = studentNameInput.value.trim();
        if (name === '') return;
        // Compute next admission number
        const maxAdm = students.reduce((max, s) => Math.max(max, s.admission), 0);
        const admissionNo = maxAdm + 1;
        const newStudent = { admission: admissionNo, name: name };
        students.push(newStudent);
        saveStudentsToDB();
        renderStudentTable();
        studentNameInput.value = '';
        renderAttendanceForm();
    });

    saveTableBtn.addEventListener('click', function() {
        editingActive = false;
        studentFormGroup.classList.add('d-none');
        saveTableBtn.classList.add('d-none');
        shareTableBtn.classList.remove('d-none');
        downloadTableBtn.classList.remove('d-none');
        editTableBtn.classList.remove('d-none');
        renderStudentTable();
    });

    editTableBtn.addEventListener('click', function() {
        editingActive = true;
        studentFormGroup.classList.remove('d-none');
        saveTableBtn.classList.remove('d-none');
        shareTableBtn.classList.add('d-none');
        downloadTableBtn.classList.add('d-none');
        editTableBtn.classList.add('d-none');
        renderStudentTable();
    });

    // Share student list PDF
    shareTableBtn.addEventListener('click', function() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text('Student List', 14, 15);
        const body = students.map((s, idx) => [
            idx + 1, s.admission, s.name
        ]);
        doc.autoTable({
            head: [['Sr#', 'Admission No.', 'Name']],
            body: body,
            startY: 20,
            styles: { halign: 'center' },
            headStyles: { fillColor: [40, 40, 40] }
        });
        const filename = 'Student_List.pdf';
        if (navigator.canShare && navigator.canShare({ files: [] })) {
            doc.save(filename); // fallback
            try {
                const blob = doc.output('blob');
                const file = new File([blob], filename, { type: 'application/pdf' });
                navigator.share({ files: [file], title: filename });
            } catch (err) {
                console.error('Share failed:', err);
            }
        } else {
            doc.save(filename);
        }
    });

    // Download student list PDF
    downloadTableBtn.addEventListener('click', function() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text('Student List', 14, 15);
        const body = students.map((s, idx) => [
            idx + 1, s.admission, s.name
        ]);
        doc.autoTable({
            head: [['Sr#', 'Admission No.', 'Name']],
            body: body,
            startY: 20,
            styles: { halign: 'center' },
            headStyles: { fillColor: [40, 40, 40] }
        });
        doc.save('Student_List.pdf');
    });

    // Handle edit/delete in student table (event delegation)
    studentsTableBody.addEventListener('click', function(e) {
        const tr = e.target.closest('tr');
        if (!tr) return;
        const id = parseInt(tr.dataset.id, 10);
        // Edit student
        if (e.target.closest('.edit-btn')) {
            // If already editing a row, do nothing
            if (tr.classList.contains('editing')) return;
            tr.classList.add('editing');
            const nameTd = tr.querySelector('.student-name');
            const currentName = nameTd.textContent;
            // Store original name
            tr.dataset.originalName = currentName;
            // Replace name with input
            nameTd.innerHTML = `<input type="text" class="form-control form-control-sm" value="${currentName}">`;
            // Replace edit/delete with save/cancel
            const actionTd = tr.querySelector('td:last-child');
            actionTd.innerHTML = `
                <button class="btn btn-link p-0 save-btn" title="Save"><i class="fa fa-check text-success"></i></button>
                <button class="btn btn-link p-0 cancel-btn" title="Cancel"><i class="fa fa-times text-danger"></i></button>`;
        }
        // Save edited student
        if (e.target.closest('.save-btn')) {
            const nameInput = tr.querySelector('input');
            const newName = nameInput.value.trim();
            if (newName === '') return;
            // Update array and DB
            const student = students.find(s => s.admission === id);
            if (student) {
                student.name = newName;
                saveStudentsToDB();
            }
            // Restore row display
            const nameTd = tr.querySelector('.student-name');
            nameTd.textContent = newName;
            tr.classList.remove('editing');
            // Restore action buttons
            const actionTd = tr.querySelector('td:last-child');
            actionTd.innerHTML = `
                <button class="btn btn-link p-0 edit-btn" title="Edit"><i class="fa fa-pencil"></i></button>
                <button class="btn btn-link p-0 delete-btn text-danger" title="Delete"><i class="fa fa-trash"></i></button>`;
            renderAttendanceForm();
        }
        // Cancel editing
        if (e.target.closest('.cancel-btn')) {
            const originalName = tr.dataset.originalName;
            // Restore name cell
            const nameTd = tr.querySelector('.student-name');
            nameTd.textContent = originalName;
            tr.classList.remove('editing');
            // Restore action buttons
            const actionTd = tr.querySelector('td:last-child');
            actionTd.innerHTML = `
                <button class="btn btn-link p-0 edit-btn" title="Edit"><i class="fa fa-pencil"></i></button>
                <button class="btn btn-link p-0 delete-btn text-danger" title="Delete"><i class="fa fa-trash"></i></button>`;
        }
        // Delete student
        if (e.target.closest('.delete-btn')) {
            if (!confirm('Are you sure you want to delete this student?')) return;
            students = students.filter(s => s.admission !== id);
            saveStudentsToDB();
            renderStudentTable();
            renderAttendanceForm();
        }
    });

    // Initial load: fetch from IndexedDB
    idbKeyval.get(STUDENTS_KEY).then(stored => {
        students = stored || [];
        renderStudentTable();
        renderAttendanceForm();
    });
    idbKeyval.get(RECORDS_KEY).then(records => {
        attendanceRecords = records || [];
        renderAttendanceRecords();
    });
});
