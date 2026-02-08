/**
 * Professional Services Reports Export API Route
 * GET: Export professional services reports to Excel or PDF
 * 
 * GET /api/reports/professional-services/export
 * Auth: OWNER, PM, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { errorResponse } from '@/lib/api-response';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';

/**
 * Format currency
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

/**
 * GET /api/reports/professional-services/export
 * Exports professional services report to Excel or PDF
 * Query params: projectId, startDate, endDate, type, format (excel|pdf)
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasViewPermission = await hasPermission(user.id, 'view_reports');
    if (!hasViewPermission) {
      return errorResponse('Insufficient permissions. Only OWNER, PM, and ACCOUNTANT can export reports.', 403);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type') || 'all';
    const format = searchParams.get('format') || 'excel'; // 'excel' or 'pdf'

    // Fetch report data (reuse logic from main report endpoint)
    const reportUrl = new URL('/api/reports/professional-services', request.url);
    if (projectId) reportUrl.searchParams.set('projectId', projectId);
    if (startDate) reportUrl.searchParams.set('startDate', startDate);
    if (endDate) reportUrl.searchParams.set('endDate', endDate);
    if (type) reportUrl.searchParams.set('type', type);

    const reportResponse = await fetch(reportUrl.toString(), {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    });

    if (!reportResponse.ok) {
      return errorResponse('Failed to fetch report data', 500);
    }

    const reportData = await reportResponse.json();
    if (!reportData.success) {
      return errorResponse(reportData.error || 'Failed to fetch report data', 500);
    }

    const data = reportData.data;
    const db = await getDatabase();
    let projectName = 'All Projects';

    if (projectId && ObjectId.isValid(projectId)) {
      const project = await db.collection('projects').findOne({
        _id: new ObjectId(projectId),
      });
      if (project) {
        projectName = project.projectName || project.projectCode || 'Unknown Project';
      }
    }

    if (format === 'excel') {
      return await exportToExcel(data, projectName, type, startDate, endDate);
    } else if (format === 'pdf') {
      return await exportToPDF(data, projectName, type, startDate, endDate);
    } else {
      return errorResponse(`Unsupported format "${format}". Supported formats: excel, pdf`, 400);
    }
  } catch (error) {
    console.error('Export error:', error);
    return errorResponse('Failed to export report', 500);
  }
}

/**
 * Export to Excel
 */
async function exportToExcel(data, projectName, type, startDate, endDate) {
  const workbook = new ExcelJS.Workbook();
  
  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary');
  let row = 1;

  // Title
  summarySheet.mergeCells(`A${row}:D${row}`);
  summarySheet.getCell(`A${row}`).value = 'Professional Services Report';
  summarySheet.getCell(`A${row}`).font = { size: 16, bold: true };
  summarySheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
  row++;

  summarySheet.getCell(`A${row}`).value = 'Project:';
  summarySheet.getCell(`B${row}`).value = projectName;
  row++;

  if (startDate || endDate) {
    summarySheet.getCell(`A${row}`).value = 'Date Range:';
    summarySheet.getCell(`B${row}`).value = `${startDate || 'N/A'} to ${endDate || 'N/A'}`;
    row++;
  }

  summarySheet.getCell(`A${row}`).value = 'Type:';
  summarySheet.getCell(`B${row}`).value = type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1);
  row++;

  summarySheet.getCell(`A${row}`).value = 'Generated:';
  summarySheet.getCell(`B${row}`).value = new Date().toLocaleDateString('en-KE');
  row += 2;

  // Summary Statistics
  if (data.summary) {
    summarySheet.getCell(`A${row}`).value = 'Summary Statistics';
    summarySheet.getCell(`A${row}`).font = { size: 14, bold: true };
    row++;

    const summaryRows = [
      ['Total Assignments', data.summary.totalAssignments],
      ['Architects', data.summary.architectsCount],
      ['Engineers', data.summary.engineersCount],
      ['Total Activities', data.summary.totalActivities],
      ['Site Visits', data.summary.siteVisits],
      ['Inspections', data.summary.inspections],
      ['Design Revisions', data.summary.designRevisions],
      ['Quality Checks', data.summary.qualityChecks],
      ['Total Fees', data.summary.totalFees],
      ['Paid Fees', data.summary.paidFees],
      ['Pending Fees', data.summary.pendingFees],
      ['Architect Fees', data.summary.architectFees],
      ['Engineer Fees', data.summary.engineerFees],
    ];

    summaryRows.forEach(([label, value]) => {
      summarySheet.getCell(`A${row}`).value = label;
      summarySheet.getCell(`B${row}`).value = typeof value === 'number' && label.includes('Fee') ? value : value;
      if (typeof value === 'number' && label.includes('Fee')) {
        summarySheet.getCell(`B${row}`).numFmt = '#,##0.00';
      }
      row++;
    });
  }

  // Activities by Month Sheet
  if (data.activitiesByMonth && data.activitiesByMonth.length > 0) {
    const activitiesSheet = workbook.addWorksheet('Activities by Month');
    row = 1;

    activitiesSheet.getCell(`A${row}`).value = 'Month';
    activitiesSheet.getCell(`B${row}`).value = 'Total';
    activitiesSheet.getCell(`C${row}`).value = 'Site Visits';
    activitiesSheet.getCell(`D${row}`).value = 'Inspections';
    activitiesSheet.getCell(`E${row}`).value = 'Design Revisions';
    [activitiesSheet.getCell(`A${row}`), activitiesSheet.getCell(`B${row}`), activitiesSheet.getCell(`C${row}`), activitiesSheet.getCell(`D${row}`), activitiesSheet.getCell(`E${row}`)].forEach(cell => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    });
    row++;

    data.activitiesByMonth.forEach(item => {
      activitiesSheet.getCell(`A${row}`).value = item.month;
      activitiesSheet.getCell(`B${row}`).value = item.count;
      activitiesSheet.getCell(`C${row}`).value = item.siteVisits;
      activitiesSheet.getCell(`D${row}`).value = item.inspections;
      activitiesSheet.getCell(`E${row}`).value = item.designRevisions;
      row++;
    });

    activitiesSheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const length = cell.value ? cell.value.toString().length : 10;
        if (length > maxLength) maxLength = length;
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    });
  }

  // Fees by Month Sheet
  if (data.feesByMonth && data.feesByMonth.length > 0) {
    const feesSheet = workbook.addWorksheet('Fees by Month');
    row = 1;

    feesSheet.getCell(`A${row}`).value = 'Month';
    feesSheet.getCell(`B${row}`).value = 'Total';
    feesSheet.getCell(`C${row}`).value = 'Paid';
    feesSheet.getCell(`D${row}`).value = 'Pending';
    [feesSheet.getCell(`A${row}`), feesSheet.getCell(`B${row}`), feesSheet.getCell(`C${row}`), feesSheet.getCell(`D${row}`)].forEach(cell => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    });
    row++;

    data.feesByMonth.forEach(item => {
      feesSheet.getCell(`A${row}`).value = item.month;
      feesSheet.getCell(`B${row}`).value = item.total;
      feesSheet.getCell(`B${row}`).numFmt = '#,##0.00';
      feesSheet.getCell(`C${row}`).value = item.paid;
      feesSheet.getCell(`C${row}`).numFmt = '#,##0.00';
      feesSheet.getCell(`D${row}`).value = item.pending;
      feesSheet.getCell(`D${row}`).numFmt = '#,##0.00';
      row++;
    });

    feesSheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const length = cell.value ? cell.value.toString().length : 10;
        if (length > maxLength) maxLength = length;
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    });
  }

  // Breakdown Sheet
  if (data.breakdown && data.breakdown.length > 0) {
    const breakdownSheet = workbook.addWorksheet('Assignment Breakdown');
    row = 1;

    const headers = ['Professional Code', 'Type', 'Name', 'Activities', 'Total Fees', 'Paid Fees', 'Status'];
    headers.forEach((header, index) => {
      const cell = breakdownSheet.getCell(row, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    });
    row++;

    data.breakdown.forEach(item => {
      breakdownSheet.getCell(row, 1).value = item.professionalCode;
      breakdownSheet.getCell(row, 2).value = item.type;
      breakdownSheet.getCell(row, 3).value = item.library?.name || 'N/A';
      breakdownSheet.getCell(row, 4).value = item.activitiesCount;
      breakdownSheet.getCell(row, 5).value = item.totalFees;
      breakdownSheet.getCell(row, 5).numFmt = '#,##0.00';
      breakdownSheet.getCell(row, 6).value = item.paidFees;
      breakdownSheet.getCell(row, 6).numFmt = '#,##0.00';
      breakdownSheet.getCell(row, 7).value = item.status;
      row++;
    });

    breakdownSheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const length = cell.value ? cell.value.toString().length : 10;
        if (length > maxLength) maxLength = length;
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    });
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `professional-services-report-${projectName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Export to PDF
 */
async function exportToPDF(data, projectName, type, startDate, endDate) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;
  const margin = 20;
  const lineHeight = 7;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Professional Services Report', margin, yPos);
  yPos += lineHeight * 2;

  // Project info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${projectName}`, margin, yPos);
  yPos += lineHeight;

  if (startDate || endDate) {
    doc.text(`Date Range: ${startDate || 'N/A'} to ${endDate || 'N/A'}`, margin, yPos);
    yPos += lineHeight;
  }

  doc.text(`Type: ${type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}`, margin, yPos);
  yPos += lineHeight;

  doc.text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, margin, yPos);
  yPos += lineHeight * 2;

  // Summary
  if (data.summary) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary Statistics', margin, yPos);
    yPos += lineHeight * 1.5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryData = [
      ['Total Assignments', data.summary.totalAssignments],
      ['Architects', data.summary.architectsCount],
      ['Engineers', data.summary.engineersCount],
      ['Total Activities', data.summary.totalActivities],
      ['Site Visits', data.summary.siteVisits],
      ['Inspections', data.summary.inspections],
      ['Design Revisions', data.summary.designRevisions],
      ['Total Fees', formatCurrency(data.summary.totalFees)],
      ['Paid Fees', formatCurrency(data.summary.paidFees)],
      ['Pending Fees', formatCurrency(data.summary.pendingFees)],
    ];

    summaryData.forEach(([label, value]) => {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(`${label}:`, margin, yPos);
      doc.text(String(value), margin + 80, yPos);
      yPos += lineHeight;
    });
    yPos += lineHeight;
  }

  // Generate PDF buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  const filename = `professional-services-report-${projectName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}





