/**
 * Excel Statement Generator
 * Generates professional Excel statements for investors
 * 
 * Uses ExcelJS library for Excel generation
 */

import ExcelJS from 'exceljs';

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
 * Generates an Excel statement for an investor
 * @param {Object} statementData - Statement data object
 * @returns {Promise<Buffer>} Excel buffer
 */
export async function generateExcelStatement(statementData) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Investment Statement');

  // Set column widths
  worksheet.columns = [
    { width: 30 }, // Column A
    { width: 20 }, // Column B
    { width: 20 }, // Column C
    { width: 15 }, // Column D
    { width: 40 }, // Column E
  ];

  // Header Row
  const headerRow = worksheet.addRow(['Kisheka Construction - Investment Statement']);
  headerRow.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF003366' }, // Dark blue
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.mergeCells('A1:E1');
  headerRow.height = 30;

  // Empty row
  worksheet.addRow([]);

  // Investor Information Section
  const investorInfoTitle = worksheet.addRow(['Investor Information']);
  investorInfoTitle.font = { size: 14, bold: true };
  investorInfoTitle.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F0F0' }, // Light gray
  };

  const investor = statementData.investor;
  worksheet.addRow(['Name:', investor.name]);
  if (investor.email) {
    worksheet.addRow(['Email:', investor.email]);
  }
  if (investor.phone) {
    worksheet.addRow(['Phone:', investor.phone]);
  }
  worksheet.addRow(['Investment Type:', investor.investmentType]);
  worksheet.addRow(['Status:', investor.status]);
  worksheet.addRow([]);

  // Period Information
  if (statementData.period.startDate || statementData.period.endDate) {
    const periodTitle = worksheet.addRow(['Statement Period']);
    periodTitle.font = { size: 12, bold: true };
    periodTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' },
    };
    
    if (statementData.period.startDate) {
      worksheet.addRow(['From:', formatDate(statementData.period.startDate)]);
    }
    if (statementData.period.endDate) {
      worksheet.addRow(['To:', formatDate(statementData.period.endDate)]);
    }
    worksheet.addRow([]);
  }

  // Investment Summary Section
  const summaryTitle = worksheet.addRow(['Investment Summary']);
  summaryTitle.font = { size: 14, bold: true };
  summaryTitle.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F0F0' },
  };

  const capitalUsage = statementData.capitalUsage;
  worksheet.addRow(['Total Invested:', formatCurrency(capitalUsage.totalInvested)]);
  worksheet.addRow(['Capital Used:', formatCurrency(capitalUsage.capitalUsed)]);
  worksheet.addRow(['Remaining Balance:', formatCurrency(capitalUsage.capitalBalance)]);
  worksheet.addRow(['Usage Percentage:', `${capitalUsage.usagePercentage}%`]);
  worksheet.addRow([]);

  // Contributions Section
  const contributions = statementData.contributions.list;
  if (contributions.length > 0) {
    const contributionsTitle = worksheet.addRow(['Contributions']);
    contributionsTitle.font = { size: 14, bold: true };
    contributionsTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' },
    };
    worksheet.addRow([]);

    // Table Header
    const tableHeader = worksheet.addRow(['Date', 'Amount', 'Type', 'Notes']);
    tableHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    tableHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0066CC' }, // Blue
    };
    tableHeader.alignment = { horizontal: 'center', vertical: 'middle' };
    tableHeader.height = 25;

    // Table Data
    contributions.forEach((contrib) => {
      const row = worksheet.addRow([
        formatDate(contrib.date),
        contrib.amount || 0,
        contrib.type || 'N/A',
        contrib.notes || '-',
      ]);
      
      // Format amount column
      const amountCell = row.getCell(2);
      amountCell.numFmt = '#,##0.00';
      
      // Alternate row colors
      if (row.number % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9F9F9' },
        };
      }
    });

    worksheet.addRow([]);

    // Contribution Totals
    const totalsTitle = worksheet.addRow(['Contribution Totals']);
    totalsTitle.font = { bold: true };
    const totals = statementData.contributions.totals;
    worksheet.addRow(['Total:', formatCurrency(totals.total)]);
    worksheet.addRow(['Equity:', formatCurrency(totals.equity)]);
    worksheet.addRow(['Loan:', formatCurrency(totals.loan)]);
    worksheet.addRow([]);
  }

  // Loan Terms Section (if applicable)
  if (statementData.loanTerms) {
    const loanTermsTitle = worksheet.addRow(['Loan Terms']);
    loanTermsTitle.font = { size: 14, bold: true };
    loanTermsTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' },
    };

    const loanTerms = statementData.loanTerms;
    if (loanTerms.interestRate) {
      worksheet.addRow(['Interest Rate:', `${loanTerms.interestRate}%`]);
    }
    if (loanTerms.repaymentPeriod) {
      worksheet.addRow(['Repayment Period:', `${loanTerms.repaymentPeriod} months`]);
    }
    if (loanTerms.repaymentSchedule) {
      worksheet.addRow(['Repayment Schedule:', loanTerms.repaymentSchedule]);
    }
    if (loanTerms.startDate) {
      worksheet.addRow(['Start Date:', formatDate(loanTerms.startDate)]);
    }
    if (loanTerms.endDate) {
      worksheet.addRow(['End Date:', formatDate(loanTerms.endDate)]);
    }
    worksheet.addRow([]);
  }

  // Footer
  const footerRow = worksheet.addRow([
    `Generated on: ${formatDate(statementData.period.generatedAt)}`,
  ]);
  footerRow.font = { italic: true, color: { argb: 'FF808080' } };
  footerRow.alignment = { horizontal: 'right' };

  // Apply borders to all cells with data
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    });
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

