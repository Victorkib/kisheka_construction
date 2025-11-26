/**
 * PDF Statement Generator
 * Generates professional PDF statements for investors
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
 * Generates a PDF statement for an investor
 * @param {Object} statementData - Statement data object
 * @returns {Buffer} PDF buffer
 */
export function generatePDFStatement(statementData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Colors
  const primaryColor = [0, 51, 102]; // Dark blue
  const secondaryColor = [0, 102, 204]; // Blue
  const textColor = [51, 51, 51]; // Dark gray
  const lightGray = [240, 240, 240];

  // Header Section
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Kisheka Construction', margin, 25);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Investment Statement', margin, 35);
  
  doc.setTextColor(...textColor);
  yPosition = 60;

  // Investor Information Section
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Investor Information', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const investor = statementData.investor;
  doc.text(`Name: ${investor.name}`, margin, yPosition);
  yPosition += 7;
  
  if (investor.email) {
    doc.text(`Email: ${investor.email}`, margin, yPosition);
    yPosition += 7;
  }
  
  if (investor.phone) {
    doc.text(`Phone: ${investor.phone}`, margin, yPosition);
    yPosition += 7;
  }
  
  doc.text(`Investment Type: ${investor.investmentType}`, margin, yPosition);
  yPosition += 7;
  
  doc.text(`Status: ${investor.status}`, margin, yPosition);
  yPosition += 15;

  // Period Information
  if (statementData.period.startDate || statementData.period.endDate) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Statement Period', margin, yPosition);
    yPosition += 8;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    if (statementData.period.startDate) {
      doc.text(`From: ${formatDate(statementData.period.startDate)}`, margin, yPosition);
      yPosition += 7;
    }
    if (statementData.period.endDate) {
      doc.text(`To: ${formatDate(statementData.period.endDate)}`, margin, yPosition);
      yPosition += 7;
    }
    yPosition += 10;
  }

  // Summary Section
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Investment Summary', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const capitalUsage = statementData.capitalUsage;
  
  doc.text(`Total Invested: ${formatCurrency(capitalUsage.totalInvested)}`, margin, yPosition);
  yPosition += 7;
  
  doc.text(`Capital Used: ${formatCurrency(capitalUsage.capitalUsed)}`, margin, yPosition);
  yPosition += 7;
  
  doc.text(`Remaining Balance: ${formatCurrency(capitalUsage.capitalBalance)}`, margin, yPosition);
  yPosition += 7;
  
  doc.text(`Usage Percentage: ${capitalUsage.usagePercentage}%`, margin, yPosition);
  yPosition += 15;

  // Contributions Section
  const contributions = statementData.contributions.list;
  if (contributions.length > 0) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Contributions', margin, yPosition);
    yPosition += 10;

    // Table Header
    doc.setFillColor(...lightGray);
    doc.rect(margin, yPosition - 5, pageWidth - (margin * 2), 8, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Date', margin + 2, yPosition);
    doc.text('Amount', margin + 50, yPosition);
    doc.text('Type', margin + 90, yPosition);
    doc.text('Notes', margin + 120, yPosition);
    yPosition += 10;

    // Table Rows
    doc.setFont('helvetica', 'normal');
    contributions.forEach((contrib, index) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = margin;
      }

      // Alternate row colors
      if (index % 2 === 0) {
        doc.setFillColor(...lightGray);
        doc.rect(margin, yPosition - 5, pageWidth - (margin * 2), 7, 'F');
      }

      doc.setFontSize(9);
      doc.text(formatDate(contrib.date), margin + 2, yPosition);
      doc.text(formatCurrency(contrib.amount), margin + 50, yPosition);
      doc.text(contrib.type || 'N/A', margin + 90, yPosition);
      
      // Truncate notes if too long
      const notes = (contrib.notes || '-').substring(0, 30);
      doc.text(notes, margin + 120, yPosition);
      
      yPosition += 7;
    });

    yPosition += 10;

    // Contribution Totals
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const totals = statementData.contributions.totals;
    doc.text('Contribution Totals:', margin, yPosition);
    yPosition += 7;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Total: ${formatCurrency(totals.total)}`, margin + 10, yPosition);
    yPosition += 7;
    doc.text(`Equity: ${formatCurrency(totals.equity)}`, margin + 10, yPosition);
    yPosition += 7;
    doc.text(`Loan: ${formatCurrency(totals.loan)}`, margin + 10, yPosition);
    yPosition += 15;
  }

  // Loan Terms Section (if applicable)
  if (statementData.loanTerms) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Loan Terms', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const loanTerms = statementData.loanTerms;
    
    if (loanTerms.interestRate) {
      doc.text(`Interest Rate: ${loanTerms.interestRate}%`, margin, yPosition);
      yPosition += 7;
    }
    
    if (loanTerms.repaymentPeriod) {
      doc.text(`Repayment Period: ${loanTerms.repaymentPeriod} months`, margin, yPosition);
      yPosition += 7;
    }
    
    if (loanTerms.repaymentSchedule) {
      doc.text(`Repayment Schedule: ${loanTerms.repaymentSchedule}`, margin, yPosition);
      yPosition += 7;
    }
    
    if (loanTerms.startDate) {
      doc.text(`Start Date: ${formatDate(loanTerms.startDate)}`, margin, yPosition);
      yPosition += 7;
    }
    
    if (loanTerms.endDate) {
      doc.text(`End Date: ${formatDate(loanTerms.endDate)}`, margin, yPosition);
      yPosition += 7;
    }
    
    yPosition += 15;
  }

  // Footer
  const footerY = pageHeight - 15;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Generated on: ${formatDate(statementData.period.generatedAt)}`,
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

