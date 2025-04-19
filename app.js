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
    const head = [[ 'Student Name', ...days ]];

    // Build table body: one row per student with blank attendance cells
    const body = students.map(name => [ name, ...Array(31).fill('') ]);

    // AutoTable configuration for a traditional school register style
    doc.autoTable({
      head,
      body,
      startY: 40,
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
        0: { cellWidth: 120, halign: 'left' },
        // Uniform small width for date columns to fit two-digit dates
        ...days.reduce((acc, _, idx) => {
          acc[idx + 1] = { cellWidth: 20 };
          return acc;
        }, {}),
      }
    });

    // Add title and footer
    doc.setFontSize(14);
    doc.text('Attendance Register', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    const dateStr = new Date().toLocaleDateString();
    doc.text(`Generated on: ${dateStr}`, 40, doc.internal.pageSize.getHeight() - 20);

    // Save PDF
    doc.save('Attendance_Register.pdf');
  };

  return (
    <div>
      <button onClick={generatePDF} className="btn btn-primary">
        Download Attendance Register
      </button>
    </div>
  );
};

export default AttendanceRegister;
