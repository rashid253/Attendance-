let students = [];
let attendanceData = {};
let editing = false;

const studentTableBody = document.querySelector("#studentTable tbody");
const btnEditSelected = document.getElementById("btnEditSelected");
const btnDeleteSelected = document.getElementById("btnDeleteSelected");
const btnSaveTable = document.getElementById("btnSaveTable");

function loadStudents() {
  studentTableBody.innerHTML = "";
  students.forEach((student, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="row-select"></td>
      <td contenteditable="false">${index + 1}</td>
      <td contenteditable="false">${student.name}</td>
      <td contenteditable="false">${student.adm}</td>
      <td contenteditable="false">${student.parent}</td>
      <td contenteditable="false">${student.contact}</td>
      <td contenteditable="false">${student.occupation}</td>
      <td contenteditable="false">${student.address}</td>
    `;
    studentTableBody.appendChild(tr);
  });
}
loadStudents();

btnEditSelected.addEventListener("click", () => {
  const selected = document.querySelectorAll(".row-select:checked");
  if (selected.length === 0) return alert("Select rows!");

  if (!editing) {
    selected.forEach(checkbox => {
      const row = checkbox.closest("tr");
      row.querySelectorAll("td").forEach((cell, idx) => {
        if (idx !== 0) cell.contentEditable = "true";
      });
    });
    editing = true;
    btnEditSelected.textContent = "Done Editing";
  } else {
    selected.forEach(checkbox => {
      const row = checkbox.closest("tr");
      row.querySelectorAll("td").forEach((cell, idx) => {
        if (idx !== 0) cell.contentEditable = "false";
      });
    });
    editing = false;
    btnEditSelected.textContent = "Edit Selected";
    btnSaveTable.style.display = "inline-block";
  }
});

btnDeleteSelected.addEventListener("click", () => {
  const rows = document.querySelectorAll("#studentTable tbody tr");
  rows.forEach((row, index) => {
    const checkbox = row.querySelector(".row-select");
    if (checkbox && checkbox.checked) {
      students.splice(index, 1);
    }
  });
  loadStudents();
  btnSaveTable.style.display = "inline-block";
});

btnSaveTable.addEventListener("click", () => {
  btnEditSelected.style.display = "none";
  btnDeleteSelected.style.display = "none";
  btnSaveTable.style.display = "none";
  document.getElementById("shareButtons").style.display = "flex";
  loadStudents();
});

document.getElementById("btnAddStudent").addEventListener("click", () => {
  const name = document.getElementById("studentName").value;
  const adm = document.getElementById("studentAdm").value;
  const parent = document.getElementById("studentParent").value;
  const contact = document.getElementById("studentContact").value;
  const occupation = document.getElementById("studentOccupation").value;
  const address = document.getElementById("studentAddress").value;
  if (name && adm) {
    students.push({ name, adm, parent, contact, occupation, address });
    loadStudents();
  }
});

function loadAttendanceStudents() {
  const container = document.getElementById("attendanceList");
  container.innerHTML = "";
  students.forEach(student => {
    const div = document.createElement("div");
    div.className = "attendance-item";
    div.innerHTML = `
      <span>${student.name}</span>
      <div class="attendance-actions">
        <button onclick="mark('${student.adm}', 'P')">P</button>
        <button onclick="mark('${student.adm}', 'A')">A</button>
        <button onclick="mark('${student.adm}', 'L')">L</button>
      </div>
    `;
    container.appendChild(div);
  });
}
function mark(adm, status) {
  attendanceData[adm] = status;
}
document.getElementById("btnLoadAttendance").addEventListener("click", loadAttendanceStudents);

function loadSummary() {
  const tbody = document.getElementById("summaryTableBody");
  tbody.innerHTML = "";
  students.forEach(student => {
    const status = attendanceData[student.adm] || "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${student.name}</td>
      <td>${status}</td>
    `;
    tbody.appendChild(tr);
  });
}
document.getElementById("btnLoadSummary").addEventListener("click", loadSummary);

document.getElementById("reportSelect").addEventListener("change", () => {
  const value = document.getElementById("reportSelect").value;
  const filterRow = document.getElementById("filterRow");
  if (value === "individual") {
    filterRow.style.display = "block";
    document.getElementById("filterField").innerHTML = "";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Enter Admission #";
    input.id = "manualAdmInput";
    document.getElementById("filterField").appendChild(input);
  } else {
    filterRow.style.display = "none";
  }
});

document.getElementById("btnGenerateReport").addEventListener("click", () => {
  const container = document.getElementById("analyticsContainer");
  container.innerHTML = "";

  const table = document.createElement("table");
  const thead = `
    <thead>
      <tr><th>Name</th><th>Present</th><th>Absent</th><th>Leave</th></tr>
    </thead>`;
  table.innerHTML = thead;

  const tbody = document.createElement("tbody");

  students.forEach(student => {
    let p = 0, a = 0, l = 0;
    const status = attendanceData[student.adm];
    if (status === 'P') p++;
    if (status === 'A') a++;
    if (status === 'L') l++;

    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${student.name}</td><td>${p}</td><td>${a}</td><td>${l}</td>`;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);

  drawChart();
});

function drawChart() {
  const ctx = document.getElementById('pieChart').getContext('2d');
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Present', 'Absent', 'Leave'],
      datasets: [{
        data: [
          Object.values(attendanceData).filter(s => s === 'P').length,
          Object.values(attendanceData).filter(s => s === 'A').length,
          Object.values(attendanceData).filter(s => s === 'L').length
        ],
        backgroundColor: ['#4CAF50', '#f44336', '#FFEB3B']
      }]
    }
  });
}

document.getElementById("btnDownloadReport").addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.autoTable({ html: '#analyticsContainer table' });
  doc.save('report.pdf');
});
