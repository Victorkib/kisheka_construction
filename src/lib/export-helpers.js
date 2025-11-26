/**
 * Export Helper Functions
 * Provides utilities for exporting wastage analytics data to PDF, Excel, and CSV
 */

import jsPDF from 'jspdf';
import ExcelJS from 'exceljs';

/**
 * Formats currency amount
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats date
 */
function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Exports wastage analytics to PDF
 * @param {Object} data - Analytics data
 * @param {string} projectName - Project name
 */
export async function exportToPDF(data, projectName = 'All Projects') {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;
    const margin = 20;
    const lineHeight = 7;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Wastage & Loss Analytics Report', margin, yPos);
    yPos += lineHeight * 2;

    // Project name
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Project: ${projectName}`, margin, yPos);
    yPos += lineHeight;

    // Date
    doc.text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, margin, yPos);
    yPos += lineHeight * 2;

    // Summary Section
    if (data.summary) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', margin, yPos);
      yPos += lineHeight * 1.5;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const summaryData = [
        ['Materials with Issues', `${data.summary.materialsWithIssues} / ${data.summary.totalMaterials}`],
        ['Total Variance Cost', formatCurrency(data.summary.metrics.totalVarianceCost)],
        ['Total Loss Cost', formatCurrency(data.summary.metrics.totalLossCost)],
        ['Total Discrepancy Cost', formatCurrency(data.summary.metrics.totalDiscrepancyCost)],
      ];

      summaryData.forEach(([label, value]) => {
        doc.text(`${label}:`, margin, yPos);
        doc.text(value, margin + 80, yPos);
        yPos += lineHeight;
      });

      yPos += lineHeight;

      // Severity Breakdown
      if (data.summary.severityBreakdown) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Severity Breakdown', margin, yPos);
        yPos += lineHeight * 1.5;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const severityData = [
          ['Critical', data.summary.severityBreakdown.critical],
          ['High', data.summary.severityBreakdown.high],
          ['Medium', data.summary.severityBreakdown.medium],
          ['Low', data.summary.severityBreakdown.low],
        ];

        severityData.forEach(([label, value]) => {
          doc.text(`${label}: ${value}`, margin, yPos);
          yPos += lineHeight;
        });

        yPos += lineHeight;
      }
    }

    // Check if we need a new page
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 20;
    }

    // Top Discrepancies Table
    if (data.discrepancies && data.discrepancies.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Top Discrepancies', margin, yPos);
      yPos += lineHeight * 1.5;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');

      // Table header
      doc.setFont('helvetica', 'bold');
      doc.text('Material', margin, yPos);
      doc.text('Variance', margin + 50, yPos);
      doc.text('Loss', margin + 80, yPos);
      doc.text('Cost', margin + 110, yPos);
      doc.text('Severity', margin + 150, yPos);
      yPos += lineHeight;

      doc.setFont('helvetica', 'normal');
      const topDiscrepancies = data.discrepancies.slice(0, 15); // Limit to 15 for PDF

      topDiscrepancies.forEach((d) => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }

        const materialName = d.materialName.length > 20 ? d.materialName.substring(0, 17) + '...' : d.materialName;
        doc.text(materialName, margin, yPos);
        doc.text(`${d.metrics.variance.toFixed(1)}`, margin + 50, yPos);
        doc.text(`${d.metrics.loss.toFixed(1)}`, margin + 80, yPos);
        doc.text(formatCurrency(d.metrics.totalDiscrepancyCost), margin + 110, yPos);
        doc.text(d.severity, margin + 150, yPos);
        yPos += lineHeight;
      });
    }

    // Save PDF
    const fileName = `wastage-analytics-${projectName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw new Error('Failed to export to PDF');
  }
}

/**
 * Exports wastage analytics to Excel
 * @param {Object} data - Analytics data
 * @param {string} projectName - Project name
 */
export async function exportToExcel(data, projectName = 'All Projects') {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Wastage Analytics');

    // Title row
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'Wastage & Loss Analytics Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.getCell('A2').value = 'Project:';
    worksheet.getCell('B2').value = projectName;
    worksheet.getCell('A3').value = 'Generated:';
    worksheet.getCell('B3').value = new Date().toLocaleDateString('en-KE');

    let currentRow = 5;

    // Summary Section
    if (data.summary) {
      worksheet.getCell(`A${currentRow}`).value = 'Summary';
      worksheet.getCell(`A${currentRow}`).font = { size: 14, bold: true };
      currentRow++;

      const summaryData = [
        ['Materials with Issues', `${data.summary.materialsWithIssues} / ${data.summary.totalMaterials}`],
        ['Total Variance Cost', data.summary.metrics.totalVarianceCost],
        ['Total Loss Cost', data.summary.metrics.totalLossCost],
        ['Total Discrepancy Cost', data.summary.metrics.totalDiscrepancyCost],
      ];

      summaryData.forEach(([label, value]) => {
        worksheet.getCell(`A${currentRow}`).value = label;
        worksheet.getCell(`B${currentRow}`).value = typeof value === 'number' ? value : value;
        if (typeof value === 'number') {
          worksheet.getCell(`B${currentRow}`).numFmt = '#,##0.00';
        }
        currentRow++;
      });

      currentRow++;

      // Severity Breakdown
      if (data.summary.severityBreakdown) {
        worksheet.getCell(`A${currentRow}`).value = 'Severity Breakdown';
        worksheet.getCell(`A${currentRow}`).font = { size: 12, bold: true };
        currentRow++;

        const severityData = [
          ['Critical', data.summary.severityBreakdown.critical],
          ['High', data.summary.severityBreakdown.high],
          ['Medium', data.summary.severityBreakdown.medium],
          ['Low', data.summary.severityBreakdown.low],
        ];

        severityData.forEach(([label, value]) => {
          worksheet.getCell(`A${currentRow}`).value = label;
          worksheet.getCell(`B${currentRow}`).value = value;
          currentRow++;
        });

        currentRow += 2;
      }
    }

    // Discrepancies Table
    if (data.discrepancies && data.discrepancies.length > 0) {
      worksheet.getCell(`A${currentRow}`).value = 'Top Discrepancies';
      worksheet.getCell(`A${currentRow}`).font = { size: 14, bold: true };
      currentRow++;

      // Table headers
      const headers = ['Material', 'Supplier', 'Variance (units)', 'Variance (%)', 'Loss (units)', 'Loss (%)', 'Cost Impact', 'Severity'];
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(currentRow, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
      });
      currentRow++;

      // Table data
      data.discrepancies.forEach((d) => {
        worksheet.getCell(currentRow, 1).value = d.materialName;
        worksheet.getCell(currentRow, 2).value = d.supplierName || 'N/A';
        worksheet.getCell(currentRow, 3).value = d.metrics.variance;
        worksheet.getCell(currentRow, 4).value = d.metrics.variancePercentage;
        worksheet.getCell(currentRow, 5).value = d.metrics.loss;
        worksheet.getCell(currentRow, 6).value = d.metrics.lossPercentage;
        worksheet.getCell(currentRow, 7).value = d.metrics.totalDiscrepancyCost;
        worksheet.getCell(currentRow, 7).numFmt = '#,##0.00';
        worksheet.getCell(currentRow, 8).value = d.severity;
        currentRow++;
      });

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      });
    }

    // Supplier Performance Sheet
    if (data.suppliers && data.suppliers.length > 0) {
      const supplierSheet = workbook.addWorksheet('Supplier Performance');
      currentRow = 1;

      supplierSheet.getCell(`A${currentRow}`).value = 'Supplier Performance';
      supplierSheet.getCell(`A${currentRow}`).font = { size: 16, bold: true };
      currentRow += 2;

      const supplierHeaders = ['Supplier', 'Total Materials', 'Total Purchased', 'Total Delivered', 'Total Variance', 'Variance Cost', 'Delivery Accuracy (%)'];
      supplierHeaders.forEach((header, index) => {
        const cell = supplierSheet.getCell(currentRow, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
      });
      currentRow++;

      data.suppliers.forEach((supplier) => {
        supplierSheet.getCell(currentRow, 1).value = supplier.supplierName || 'Unknown';
        supplierSheet.getCell(currentRow, 2).value = supplier.totalMaterials;
        supplierSheet.getCell(currentRow, 3).value = supplier.totalPurchased;
        supplierSheet.getCell(currentRow, 4).value = supplier.totalDelivered;
        supplierSheet.getCell(currentRow, 5).value = supplier.totalVariance;
        supplierSheet.getCell(currentRow, 6).value = supplier.totalVarianceCost;
        supplierSheet.getCell(currentRow, 6).numFmt = '#,##0.00';
        supplierSheet.getCell(currentRow, 7).value = supplier.deliveryAccuracy;
        currentRow++;
      });

      // Auto-fit columns
      supplierSheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      });
    }

    // Save Excel file
    const fileName = `wastage-analytics-${projectName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw new Error('Failed to export to Excel');
  }
}

/**
 * Exports wastage analytics to CSV
 * @param {Object} data - Analytics data
 * @param {string} projectName - Project name
 */
export async function exportToCSV(data, projectName = 'All Projects') {
  try {
    let csvContent = 'Wastage & Loss Analytics Report\n';
    csvContent += `Project: ${projectName}\n`;
    csvContent += `Generated: ${new Date().toLocaleDateString('en-KE')}\n\n`;

    // Summary
    if (data.summary) {
      csvContent += 'Summary\n';
      csvContent += `Materials with Issues,${data.summary.materialsWithIssues} / ${data.summary.totalMaterials}\n`;
      csvContent += `Total Variance Cost,${data.summary.metrics.totalVarianceCost}\n`;
      csvContent += `Total Loss Cost,${data.summary.metrics.totalLossCost}\n`;
      csvContent += `Total Discrepancy Cost,${data.summary.metrics.totalDiscrepancyCost}\n\n`;

      if (data.summary.severityBreakdown) {
        csvContent += 'Severity Breakdown\n';
        csvContent += `Critical,${data.summary.severityBreakdown.critical}\n`;
        csvContent += `High,${data.summary.severityBreakdown.high}\n`;
        csvContent += `Medium,${data.summary.severityBreakdown.medium}\n`;
        csvContent += `Low,${data.summary.severityBreakdown.low}\n\n`;
      }
    }

    // Discrepancies
    if (data.discrepancies && data.discrepancies.length > 0) {
      csvContent += 'Top Discrepancies\n';
      csvContent += 'Material,Supplier,Variance (units),Variance (%),Loss (units),Loss (%),Cost Impact,Severity\n';

      data.discrepancies.forEach((d) => {
        csvContent += `"${d.materialName}","${d.supplierName || 'N/A'}",${d.metrics.variance},${d.metrics.variancePercentage},${d.metrics.loss},${d.metrics.lossPercentage},${d.metrics.totalDiscrepancyCost},${d.severity}\n`;
      });
    }

    // Supplier Performance
    if (data.suppliers && data.suppliers.length > 0) {
      csvContent += '\nSupplier Performance\n';
      csvContent += 'Supplier,Total Materials,Total Purchased,Total Delivered,Total Variance,Variance Cost,Delivery Accuracy (%)\n';

      data.suppliers.forEach((supplier) => {
        csvContent += `"${supplier.supplierName || 'Unknown'}",${supplier.totalMaterials},${supplier.totalPurchased},${supplier.totalDelivered},${supplier.totalVariance},${supplier.totalVarianceCost},${supplier.deliveryAccuracy}\n`;
      });
    }

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `wastage-analytics-${projectName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    throw new Error('Failed to export to CSV');
  }
}

