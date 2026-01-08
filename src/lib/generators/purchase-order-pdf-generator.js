/**
 * Purchase Order PDF Generator
 * Generates professional PDF documents for purchase orders
 * 
 * Uses jsPDF library for PDF generation
 */

import jsPDF from 'jspdf';

/**
 * Formats currency amount
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
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
 * Generates a PDF document for a purchase order
 * @param {Object} purchaseOrder - Purchase order object
 * @param {Object} supplier - Supplier object
 * @param {Object} project - Project object (optional)
 * @param {Object} batch - Batch object (optional, for bulk orders)
 * @returns {Buffer} PDF buffer
 */
export function generatePurchaseOrderPDF({ purchaseOrder, supplier, project = null, batch = null }) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Colors
  const primaryColor = [37, 99, 235]; // Blue
  const secondaryColor = [59, 130, 246]; // Light blue
  const textColor = [51, 51, 51]; // Dark gray
  const lightGray = [240, 240, 240];

  // Header Section
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Doshaki Construction', margin, 25);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Purchase Order', margin, 35);
  
  // Order Number (right aligned)
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`PO: ${purchaseOrder.purchaseOrderNumber}`, pageWidth - margin - 50, 30);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const orderDate = formatDate(purchaseOrder.createdAt || purchaseOrder.sentAt || new Date());
  doc.text(`Date: ${orderDate}`, pageWidth - margin - 50, 40);
  
  doc.setTextColor(...textColor);
  yPosition = 60;

  // Supplier Information Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Supplier Information', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  if (supplier) {
    doc.text(`Name: ${supplier.name || purchaseOrder.supplierName || 'N/A'}`, margin, yPosition);
    yPosition += 7;
    
    if (supplier.contactPerson) {
      doc.text(`Contact Person: ${supplier.contactPerson}`, margin, yPosition);
      yPosition += 7;
    }
    
    if (supplier.email || purchaseOrder.supplierEmail) {
      doc.text(`Email: ${supplier.email || purchaseOrder.supplierEmail}`, margin, yPosition);
      yPosition += 7;
    }
    
    if (supplier.phone || purchaseOrder.supplierPhone) {
      doc.text(`Phone: ${supplier.phone || purchaseOrder.supplierPhone}`, margin, yPosition);
      yPosition += 7;
    }
    
    if (supplier.address) {
      const addressLines = doc.splitTextToSize(`Address: ${supplier.address}`, pageWidth - 2 * margin);
      doc.text(addressLines, margin, yPosition);
      yPosition += addressLines.length * 7;
    }
  } else {
    doc.text(`Supplier: ${purchaseOrder.supplierName || 'N/A'}`, margin, yPosition);
    yPosition += 7;
  }
  yPosition += 5;

  // Project Information (if available)
  if (project) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Project Information', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Project: ${project.projectName || 'N/A'}`, margin, yPosition);
    yPosition += 7;
    
    if (project.location) {
      doc.text(`Location: ${project.location}`, margin, yPosition);
      yPosition += 7;
    }
    yPosition += 5;
  }

  // Batch Information (for bulk orders)
  if (purchaseOrder.isBulkOrder && batch) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Batch Information', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Batch Number: ${batch.batchNumber || 'N/A'}`, margin, yPosition);
    yPosition += 7;
    
    if (batch.batchName) {
      doc.text(`Batch Name: ${batch.batchName}`, margin, yPosition);
      yPosition += 7;
    }
    yPosition += 5;
  }

  // Order Details Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Order Details', margin, yPosition);
  yPosition += 10;

  // Check if we need a new page
  if (yPosition > pageHeight - 80) {
    doc.addPage();
    yPosition = margin;
  }

  // Materials Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  
  // Table headers
  const tableStartY = yPosition;
  const colWidths = purchaseOrder.isBulkOrder 
    ? [80, 50, 30, 40, 50] // Material, Quantity, Unit, Unit Cost, Total
    : [100, 50, 30, 40, 50];
  
  let tableX = margin;
  doc.setFillColor(...lightGray);
  doc.rect(tableX, tableStartY - 5, pageWidth - 2 * margin, 8, 'F');
  
  doc.text('Material', tableX, tableStartY);
  tableX += colWidths[0];
  doc.text('Qty', tableX, tableStartY);
  tableX += colWidths[1];
  doc.text('Unit', tableX, tableStartY);
  tableX += colWidths[2];
  doc.text('Unit Cost', tableX, tableStartY);
  tableX += colWidths[3];
  doc.text('Total', tableX, tableStartY);
  
  yPosition = tableStartY + 10;
  doc.setFont('helvetica', 'normal');

  // Materials rows
  if (purchaseOrder.isBulkOrder && purchaseOrder.materials && Array.isArray(purchaseOrder.materials)) {
    // Bulk order - show each material
    for (const material of purchaseOrder.materials) {
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = margin;
      }

      tableX = margin;
      const materialName = material.materialName || material.name || 'N/A';
      const materialNameLines = doc.splitTextToSize(materialName, colWidths[0] - 5);
      doc.text(materialNameLines, tableX, yPosition);
      
      const maxLines = Math.max(1, materialNameLines.length);
      tableX += colWidths[0];
      doc.text((material.quantity || material.quantityNeeded || 0).toString(), tableX, yPosition);
      tableX += colWidths[1];
      doc.text(material.unit || 'N/A', tableX, yPosition);
      tableX += colWidths[2];
      doc.text(formatCurrency(material.unitCost || 0), tableX, yPosition);
      tableX += colWidths[3];
      doc.text(formatCurrency(material.totalCost || 0), tableX, yPosition);
      
      yPosition += maxLines * 7 + 3;
    }
  } else {
    // Single material order
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = margin;
    }

    tableX = margin;
    const materialName = purchaseOrder.materialName || 'N/A';
    const materialNameLines = doc.splitTextToSize(materialName, colWidths[0] - 5);
    doc.text(materialNameLines, tableX, yPosition);
    
    const maxLines = Math.max(1, materialNameLines.length);
    tableX += colWidths[0];
    doc.text((purchaseOrder.quantityOrdered || 0).toString(), tableX, yPosition);
    tableX += colWidths[1];
    doc.text(purchaseOrder.unit || 'N/A', tableX, yPosition);
    tableX += colWidths[2];
    doc.text(formatCurrency(purchaseOrder.unitCost || 0), tableX, yPosition);
    tableX += colWidths[3];
    doc.text(formatCurrency(purchaseOrder.totalCost || 0), tableX, yPosition);
    
    yPosition += maxLines * 7 + 5;
  }

  // Total row
  yPosition += 5;
  if (yPosition > pageHeight - 40) {
    doc.addPage();
    yPosition = margin;
  }

  doc.setFillColor(...lightGray);
  doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL:', margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPosition);
  doc.text(formatCurrency(purchaseOrder.totalCost || 0), margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], yPosition);
  yPosition += 15;

  // Delivery and Terms Section
  if (yPosition > pageHeight - 60) {
    doc.addPage();
    yPosition = margin;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`Delivery Date: ${formatDate(purchaseOrder.deliveryDate)}`, margin, yPosition);
  yPosition += 7;

  if (purchaseOrder.terms) {
    const termsLines = doc.splitTextToSize(`Terms: ${purchaseOrder.terms}`, pageWidth - 2 * margin);
    doc.text(termsLines, margin, yPosition);
    yPosition += termsLines.length * 7;
  }

  if (purchaseOrder.notes) {
    yPosition += 3;
    const notesLines = doc.splitTextToSize(`Notes: ${purchaseOrder.notes}`, pageWidth - 2 * margin);
    doc.text(notesLines, margin, yPosition);
    yPosition += notesLines.length * 7;
  }

  // Footer
  const footerY = pageHeight - 15;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Generated on: ${formatDate(new Date())}`,
    margin,
    footerY
  );
  doc.text(
    `Page 1 of ${doc.internal.pages.length - 1}`,
    pageWidth - margin - 30,
    footerY
  );

  // Return PDF as buffer
  return doc.output('arraybuffer');
}




