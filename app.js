/* style.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

:root {
  --font-family: 'Inter', sans-serif;
  --color-bg: #f8f9fa;
  --color-surface: #ffffff;
  --color-primary: #0052cc;
  --color-text: #343a40;
  --color-border: #dee2e6;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --radius-md: 0.5rem;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-family: var(--font-family);
  background: var(--color-bg);
  color: var(--color-text);
}

body {
  padding: var(--space-md);
}

.hidden {
  display: none !important;
}

/* Material Icons */
.material-icons {
  font-family: 'Material Icons';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
}
.md-36 {
  font-size: 36px;
}

/* Cards */
.card {
  background: var(--color-surface);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--space-lg);
}

/* Hero */
.hero {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  background: var(--color-primary);
  color: #fff;
  padding: var(--space-md);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}
.hero h1 {
  font-size: 1.5rem;
}

/* Summary Line */
.summary-line {
  display: flex;
  justify-content: space-around;
  gap: 1rem;
  font-weight: 600;
}
.summary-line span strong {
  color: var(--color-primary);
}

/* Section Titles */
.card h2 {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 1.25rem;
  margin-bottom: var(--space-md);
}

/* Layout Helpers */
.row-inline {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  align-items: center;
  margin-bottom: var(--space-md);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}
.save {
  background: #198754;
  color: #fff;
}
.secondary {
  background: #00b4d8;
  color: #fff;
}
.delete {
  background: #dc3545;
  color: #fff;
}
.share {
  background: #00b4d8;
  color: #fff;
}
.download {
  background: #ffc107;
  color: #212529;
}
.small {
  font-size: 0.875rem;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Tables */
.table-wrapper {
  overflow-x: auto;
  margin-top: var(--space-md);
}
table {
  width: 100%;
  border-collapse: collapse;
}
thead th, tbody td {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  text-align: left;
}
.select-col {
  width: 2.5rem;
  text-align: center;
}

/* Graph containers */
.graph-container {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  margin-top: var(--space-md);
}
canvas {
  flex: 1;
  max-width: 100%;
  height: auto;
}

/* Mobile */
@media (max-width: 600px) {
  .hero { flex-direction: column; text-align: center; }
  .summary-line { flex-direction: column; }
  .row-inline { flex-direction: column; }
  .btn { width: 100%; justify-content: center; }
}
