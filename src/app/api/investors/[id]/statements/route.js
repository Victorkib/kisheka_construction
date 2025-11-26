/**
 * Investor Statements API Route
 * GET: Generate investor statement (returns data, can be extended to PDF/Excel)
 * 
 * GET /api/investors/[id]/statements
 * Query params: startDate, endDate, format (json|pdf|excel)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission, ROLES } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { generatePDFStatement } from '@/lib/statements/pdf-generator';
import { generateExcelStatement } from '@/lib/statements/excel-generator';
import { calculateCommittedCost } from '@/lib/financial-helpers';

/**
 * GET /api/investors/[id]/statements
 * Generates an investor statement
 * Auth: OWNER, INVESTOR (own data only)
 * Query params: startDate, endDate, format
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid investor ID', 400);
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'json';

    const db = await getDatabase();

    // Get investor
    const investor = await db
      .collection('investors')
      .findOne({ _id: new ObjectId(id) });

    if (!investor) {
      return errorResponse('Investor not found', 404);
    }

    // INVESTOR role can only see their own data
    if (userProfile.role?.toLowerCase() === ROLES.INVESTOR.toLowerCase()) {
      // Check by userId first (preferred), then fallback to email/name matching
      const isOwnData =
        (investor.userId && investor.userId.toString() === userProfile._id.toString()) ||
        investor.email === userProfile.email ||
        investor.name?.toLowerCase().includes(userProfile.name?.toLowerCase() || '');
      if (!isOwnData) {
        return errorResponse('Access denied. You can only view your own statements.', 403);
      }
    }

    // Filter contributions by date range if provided
    let contributions = investor.contributions || [];
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      contributions = contributions.filter((contrib) => {
        const contribDate = new Date(contrib.date);
        if (start && contribDate < start) return false;
        if (end && contribDate > end) return false;
        return true;
      });
    }

    // Sort contributions by date (newest first)
    contributions = contributions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate totals
    const totals = contributions.reduce(
      (acc, contrib) => {
        acc.total += contrib.amount || 0;
        if (contrib.type === 'EQUITY' || contrib.type === 'MIXED') {
          acc.equity += contrib.amount || 0;
        }
        if (contrib.type === 'LOAN' || contrib.type === 'MIXED') {
          acc.loan += contrib.amount || 0;
        }
        return acc;
      },
      { total: 0, equity: 0, loan: 0 }
    );

    // Get investor's project allocations
    const investorAllocations = investor.projectAllocations || [];
    
    let investorCapitalUsed = 0;
    let investorTotalAllocated = 0;
    const projectBreakdown = [];

    if (investorAllocations.length > 0) {
      // Calculate based on project-specific allocations - REAL-TIME from actual spending
      for (const allocation of investorAllocations) {
        if (allocation.projectId && ObjectId.isValid(allocation.projectId)) {
          const projectId = new ObjectId(allocation.projectId);
          const allocatedAmount = allocation.amount || 0;
          investorTotalAllocated += allocatedAmount;
          
          // Get project details
          const project = await db
            .collection('projects')
            .findOne({ _id: projectId });
          
          // Calculate REAL-TIME total used from actual spending (not cached)
          // Get total from expenses (approved only)
          const expensesTotal = await db
            .collection('expenses')
            .aggregate([
              {
                $match: {
                  projectId: projectId,
                  deletedAt: null,
                  status: { $in: ['APPROVED', 'PAID'] },
                },
              },
              {
                $group: {
                  _id: null,
                  total: { $sum: '$amount' },
                },
              },
            ])
            .toArray();

          // Get total from materials (approved only)
          const materialsTotal = await db
            .collection('materials')
            .aggregate([
              {
                $match: {
                  projectId: projectId,
                  deletedAt: null,
                  status: { $in: ['approved', 'received'] },
                },
              },
              {
                $group: {
                  _id: null,
                  total: { $sum: '$totalCost' },
                },
              },
            ])
            .toArray();

          // Get total from initial expenses (approved only)
          const initialExpensesTotal = await db
            .collection('initial_expenses')
            .aggregate([
              {
                $match: {
                  projectId: projectId,
                  deletedAt: null,
                  approved: true,
                },
              },
              {
                $group: {
                  _id: null,
                  total: { $sum: '$amount' },
                },
              },
            ])
            .toArray();

          // Calculate real-time total used
          const projectTotalUsed = 
            (expensesTotal[0]?.total || 0) +
            (materialsTotal[0]?.total || 0) +
            (initialExpensesTotal[0]?.total || 0);

          // NEW: Calculate committed cost from accepted purchase orders
          const projectCommittedCost = await calculateCommittedCost(projectId.toString());

          // Get project total invested (from allocations)
          const { calculateProjectTotals } = await import('@/lib/investment-allocation');
          const projectTotals = await calculateProjectTotals(projectId.toString());
          const projectTotalInvested = projectTotals.totalInvested || 0;

          // Calculate investor's share of capital used and committed for this project
          let projectCapitalUsed = 0;
          let projectCapitalCommitted = 0;
          if (projectTotalInvested > 0) {
            const projectShare = allocatedAmount / projectTotalInvested;
            projectCapitalUsed = projectTotalUsed * projectShare;
            projectCapitalCommitted = projectCommittedCost * projectShare;
            investorCapitalUsed += projectCapitalUsed;
          }
          
          projectBreakdown.push({
            projectId: allocation.projectId,
            projectName: project?.projectName || 'Unknown Project',
            projectCode: project?.projectCode || null,
            allocatedAmount,
            capitalUsed: projectCapitalUsed,
            capitalCommitted: projectCapitalCommitted, // NEW
            capitalBalance: allocatedAmount - projectCapitalUsed - projectCapitalCommitted, // Updated to include committed
            projectTotalUsed, // Real-time calculated
            projectCommittedCost, // NEW
            projectTotalInvested, // Real-time calculated
            lastUpdated: new Date(), // Mark as real-time
          });
        }
      }
    } else {
      // Fallback: Use proportional calculation across all projects (backward compatibility)
      // Calculate REAL-TIME from actual spending
      const allProjects = await db
        .collection('projects')
        .find({})
        .toArray();

      let totalInvested = 0;
      let totalUsed = 0;

      for (const project of allProjects) {
        const projectId = project._id;
        const projectTotals = await (await import('@/lib/investment-allocation')).calculateProjectTotals(projectId.toString());
        const projectInvested = projectTotals.totalInvested || 0;
        totalInvested += projectInvested;

        // Calculate real-time used
        const expensesTotal = await db
          .collection('expenses')
          .aggregate([
            {
              $match: {
                projectId: projectId,
                deletedAt: null,
                status: { $in: ['APPROVED', 'PAID'] },
              },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ])
          .toArray();

        const materialsTotal = await db
          .collection('materials')
          .aggregate([
            {
              $match: {
                projectId: projectId,
                deletedAt: null,
                status: { $in: ['approved', 'received'] },
              },
            },
            { $group: { _id: null, total: { $sum: '$totalCost' } } },
          ])
          .toArray();

        const initialExpensesTotal = await db
          .collection('initial_expenses')
          .aggregate([
            {
              $match: {
                projectId: projectId,
                deletedAt: null,
                approved: true,
              },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ])
          .toArray();

        totalUsed += 
          (expensesTotal[0]?.total || 0) +
          (materialsTotal[0]?.total || 0) +
          (initialExpensesTotal[0]?.total || 0);
      }

      const investorShare = totalInvested > 0 ? (investor.totalInvested / totalInvested) : 0;
      investorCapitalUsed = totalUsed * investorShare;
      investorTotalAllocated = investor.totalInvested;
    }

    // Build statement
    const statement = {
      investor: {
        _id: investor._id,
        name: investor.name,
        email: investor.email,
        phone: investor.phone,
        investmentType: investor.investmentType,
        status: investor.status,
      },
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
        generatedAt: new Date(),
      },
      contributions: {
        list: contributions,
        totals,
        count: contributions.length,
      },
      capitalUsage: {
        totalInvested: investor.totalInvested,
        totalAllocated: investorTotalAllocated || investor.totalInvested,
        unallocated: Math.max(0, investor.totalInvested - (investorTotalAllocated || investor.totalInvested)),
        capitalUsed: investorCapitalUsed,
        // NEW: Calculate total committed across all projects
        capitalCommitted: projectBreakdown.reduce((sum, proj) => sum + (proj.capitalCommitted || 0), 0),
        capitalBalance: (investorTotalAllocated || investor.totalInvested) - investorCapitalUsed - projectBreakdown.reduce((sum, proj) => sum + (proj.capitalCommitted || 0), 0), // Updated to include committed
        available: (investorTotalAllocated || investor.totalInvested) - investorCapitalUsed - projectBreakdown.reduce((sum, proj) => sum + (proj.capitalCommitted || 0), 0), // Available = Allocated - Used - Committed
        usagePercentage: (investorTotalAllocated || investor.totalInvested) > 0 
          ? ((investorCapitalUsed / (investorTotalAllocated || investor.totalInvested)) * 100).toFixed(2)
          : 0,
        projectBreakdown: projectBreakdown.length > 0 ? projectBreakdown : undefined,
      },
      loanTerms: investor.loanTerms || null,
    };

    // Handle different output formats
    if (format === 'json') {
      return successResponse(statement);
    } else if (format === 'pdf') {
      try {
        const pdfBuffer = generatePDFStatement(statement);
        const investorName = investor.name.replace(/[^a-zA-Z0-9]/g, '_');
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `Investor_Statement_${investorName}_${dateStr}.pdf`;

        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': pdfBuffer.byteLength.toString(),
          },
        });
      } catch (error) {
        console.error('PDF generation error:', error);
        return errorResponse('Failed to generate PDF statement', 500);
      }
    } else if (format === 'excel' || format === 'xlsx') {
      try {
        const excelBuffer = await generateExcelStatement(statement);
        const investorName = investor.name.replace(/[^a-zA-Z0-9]/g, '_');
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `Investor_Statement_${investorName}_${dateStr}.xlsx`;

        return new NextResponse(excelBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': excelBuffer.byteLength.toString(),
          },
        });
      } catch (error) {
        console.error('Excel generation error:', error);
        return errorResponse('Failed to generate Excel statement', 500);
      }
    } else {
      return errorResponse(`Unsupported format "${format}". Supported formats: json, pdf, excel, xlsx`, 400);
    }
  } catch (error) {
    console.error('Generate statement error:', error);
    return errorResponse('Failed to generate statement', 500);
  }
}

