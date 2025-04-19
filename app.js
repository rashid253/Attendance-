// AttendanceRegister.jsx
import React from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const AttendanceRegister = ({ students = [] }) => {
  const generatePDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    // Generate days 1–31 as strings
    const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

    // Build table header: "Student Name" + days
    const head = [['Student Name', ...days]];

    // Build table body: one row per student with blank attendance cells
    const body = students.map(name => [name, ...Array(31).fill('')]);

    // AutoTable configuration for a traditional school register style
    doc.autoTable({
      head,
      body,
      startY: 60,
      margin: { left: 40, right: 40 },
      styles: {
        fontSize: 8,
        cellPadding: 4,
        valign: 'middle',
        halign: 'center',
        lineColor: 200,
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: 0,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 140, halign: 'left' },
        // Uniform small width for all date columns to fit two-digit dates
        ...days.reduce((acc, _, idx) => {
          acc[idx + 1] = { cellWidth: 20 };
          return acc;
        }, {}),
      },
    });

    // Add title
    doc.setFontSize(14);
    doc.text('Attendance Register', doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });

    // Add footer with generation date
    doc.setFontSize(10);
    const dateStr = new Date().toLocaleDateString();
    doc.text(`Generated on: ${dateStr}`, 40, doc.internal.pageSize.getHeight() - 20);

    // Save PDF
    doc.save('Attendance_Register.pdf');
  };

  return (
    <div>
      <button onClick={generatePDF} style={{
        padding: '8px 16px',
        fontSize: '14px',
        cursor: 'pointer',
        borderRadius: '4px',
        backgroundColor: '#007bff',
        color: '#fff',
        border: 'none'
      }}>
        Download Attendance Register
      </button>
    </div>
  );
};

export default AttendanceRegister;
