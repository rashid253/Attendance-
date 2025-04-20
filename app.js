/* style.css */
:root {
  --primary: #2196F3;
  --success: #4CAF50;
  --danger: #f44336;
  --warning: #FFEB3B;
  --orange: #FF9800;
  --info: #03a9f4;
  --light: #f2f2f2;
  --dark: #333;
}

* {
  -webkit-tap-highlight-color: transparent;
  outline: none;
}

body {
  font-family: Arial, sans-serif;
  color: var(--dark);
  padding: 10px;
}

header {
  background: var(--primary);
  color: #fff;
  padding: 15px;
  text-align: center;
  margin-bottom: 10px;
}

section {
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 6px;
  margin-bottom: 20px;
  padding: 15px;
}

.row-inline {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 10px;
}

label {
  font-weight: bold;
}

input,
select,
button {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

button {
  background: var(--primary);
  color: #fff;
  cursor: pointer;
}

button:hover {
  opacity: 0.9;
}

button.save {
  background: var(--success);
}

button.small {
  background: var(--info);
  padding: 4px 8px;
  font-size: 0.9em;
}

.hidden {
  display: none;
}

.table-wrapper {
  overflow-x: auto;
  margin-top: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.table-wrapper.saved {
  border: 2px solid var(--success);
  background: var(--light);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border: 1px solid #ccc;
  padding: 8px;
  white-space: nowrap;
  text-align: left;
}

th {
  background: var(--light);
}

.table-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.attendance-item {
  font-weight: bold;
  margin-bottom: 5px;
}

.attendance-item + .attendance-actions {
  display: flex;
  gap: 5px;
  margin-bottom: 15px;
}

.att-btn {
  flex: 1;
  padding: 8px;
  border: 1px solid #ccc;
  background: transparent;
  color: var(--dark);
  font-weight: bold;
}

.table-container {
  overflow-x: auto;
  margin-top: 15px;
}

.summary-block {
  margin-top: 15px;
}

.graph-container {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-top: 15px;
}

canvas {
  flex: 1 1 300px;
  max-width: 100%;
}

.selected {
  background: var(--light);
}

.editing {
  outline: 2px dashed var(--info);
}

.select-col {
  width: 40px;
}

#registerTableWrapper {
  overflow-x: auto;
  margin-top: 10px;
}

#registerTable thead th {
  position: sticky;
  top: 0;
  background: var(--light);
  z-index: 1;
}

#register-section .row-inline > * {
  margin-right: 8px;
}

.attendance-actions .att-btn {
  flex: 1;
  padding: 8px;
  border: 1px solid #ccc;
  background: transparent;
  color: var(--dark);
  font-weight: bold;
  font-size: 1em;
}

#pieChart {
  aspect-ratio: 1 / 1;
}

/* Toast notifications */
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 12px 24px;
  border-radius: 4px;
  color: white;
  z-index: 1000;
  animation: fadeInOut 3s ease-in-out;
}
.toast-info { background-color: var(--info); }
.toast-success { background-color: var(--success); }
.toast-warning { background-color: var(--warning); color: #333; }
.toast-error { background-color: var(--danger); }
@keyframes fadeInOut {
  0%, 100% { opacity: 0; transform: translateY(20px); }
  10%, 90% { opacity: 1; transform: translateY(0); }
}

/* Attendance stats */
.attendance-stats {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  margin: 15px 0;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
}
.stat-present { color: var(--success); font-weight: bold; }
.stat-absent { color: var(--danger); font-weight: bold; }
.stat-late { color: var(--warning); font-weight: bold; }
.stat-halfday { color: var(--orange); font-weight: bold; }
.stat-leave { color: var(--info); font-weight: bold; }

.danger {
  background-color: var(--danger);
}

@media (max-width: 600px) {
  .row-inline input,
  .row-inline select,
  .row-inline button {
    flex: 1 1 100%;
  }
  
  .attendance-stats {
    gap: 8px;
    font-size: 0.9em;
  }
  
  .row-inline {
    flex-direction: column;
    align-items: stretch;
  }
  
  .row-inline > * {
    margin-bottom: 8px;
  }
}
