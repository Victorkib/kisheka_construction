/**
 * Reports Summary API Route
 * GET: Get executive summary with key metrics
 * 
 * GET /api/reports/summary
 * Auth: OWNER, INVESTOR, PM, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/reports/summary
 * Returns executive summary with total expenses, category breakdown, floor breakdown, etc.
 * Query params: projectId, startDate, endDate
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
      return errorResponse('Insufficient permissions. Only OWNER, INVESTOR, PM, and ACCOUNTANT can view reports.', 403);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const db = await getDatabase();

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    // Build base query for materials
    const materialsBaseQuery = {
      deletedAt: null,
      status: { $in: ['approved', 'received'] },
    };

    // Build base query for expenses
    const expensesBaseQuery = {
      deletedAt: null,
      status: { $in: ['APPROVED', 'PAID'] },
    };

    // Build base query for initial expenses
    const initialExpensesBaseQuery = {
      status: { $in: ['approved'] },
    };

    if (projectId && ObjectId.isValid(projectId)) {
      materialsBaseQuery.projectId = new ObjectId(projectId);
      expensesBaseQuery.projectId = new ObjectId(projectId);
      initialExpensesBaseQuery.projectId = new ObjectId(projectId);
    }

    if (Object.keys(dateFilter).length > 0) {
      materialsBaseQuery.datePurchased = dateFilter;
      expensesBaseQuery.date = dateFilter;
      initialExpensesBaseQuery.datePaid = dateFilter;
    }

    // Get total from materials
    const totalMaterialsResult = await db
      .collection('materials')
      .aggregate([
        { $match: materialsBaseQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalCost' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const totalMaterialsCost = totalMaterialsResult[0]?.total || 0;
    const totalMaterialsItems = totalMaterialsResult[0]?.count || 0;

    // Get total from expenses
    const totalExpensesResult = await db
      .collection('expenses')
      .aggregate([
        { $match: expensesBaseQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const totalExpensesCost = totalExpensesResult[0]?.total || 0;
    const totalExpensesItems = totalExpensesResult[0]?.count || 0;

    // Get total from initial expenses
    const totalInitialExpensesResult = await db
      .collection('initial_expenses')
      .aggregate([
        { $match: initialExpensesBaseQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const totalInitialExpensesCost = totalInitialExpensesResult[0]?.total || 0;
    const totalInitialExpensesItems = totalInitialExpensesResult[0]?.count || 0;

    // Get professional services fees (from expenses where category is construction_services)
    const professionalServicesFeesResult = await db
      .collection('expenses')
      .aggregate([
        {
          $match: {
            ...expensesBaseQuery,
            category: 'construction_services', // Professional fees are converted to expenses with this category
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const totalProfessionalServicesFees = professionalServicesFeesResult[0]?.total || 0;
    const totalProfessionalServicesItems = professionalServicesFeesResult[0]?.count || 0;

    // Combined totals (materials + expenses + initial expenses)
    // Note: Professional services fees are already included in expenses, so we don't double-count
    const totalExpenses = totalMaterialsCost + totalExpensesCost + totalInitialExpensesCost;
    const totalItems = totalMaterialsItems + totalExpensesItems + totalInitialExpensesItems;

    // Category breakdown from materials
    const materialsCategoryBreakdown = await db
      .collection('materials')
      .aggregate([
        { $match: materialsBaseQuery },
        {
          $group: {
            _id: '$category',
            total: { $sum: '$totalCost' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Category breakdown from expenses
    const expensesCategoryBreakdown = await db
      .collection('expenses')
      .aggregate([
        { $match: expensesBaseQuery },
        {
          $group: {
            _id: '$category',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Category breakdown from initial expenses
    const initialExpensesCategoryBreakdown = await db
      .collection('initial_expenses')
      .aggregate([
        { $match: initialExpensesBaseQuery },
        {
          $group: {
            _id: '$category',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Combine category breakdowns
    const categoryMap = {};
    
    materialsCategoryBreakdown.forEach((item) => {
      const category = item._id || 'Uncategorized';
      if (!categoryMap[category]) {
        categoryMap[category] = { total: 0, count: 0 };
      }
      categoryMap[category].total += item.total;
      categoryMap[category].count += item.count;
    });

    expensesCategoryBreakdown.forEach((item) => {
      const category = item._id || 'Uncategorized';
      if (!categoryMap[category]) {
        categoryMap[category] = { total: 0, count: 0 };
      }
      categoryMap[category].total += item.total;
      categoryMap[category].count += item.count;
    });

    initialExpensesCategoryBreakdown.forEach((item) => {
      const category = `Initial: ${item._id || 'Uncategorized'}`;
      if (!categoryMap[category]) {
        categoryMap[category] = { total: 0, count: 0 };
      }
      categoryMap[category].total += item.total;
      categoryMap[category].count += item.count;
    });

    const categoryBreakdown = Object.entries(categoryMap)
      .map(([category, data]) => ({
        _id: category,
        total: data.total,
        count: data.count,
      }))
      .sort((a, b) => b.total - a.total);

    // Floor breakdown (materials only, expenses don't have floors)
    const floorBreakdown = await db
      .collection('materials')
      .aggregate([
        {
          $match: {
            ...materialsBaseQuery,
            floor: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$floor',
            total: { $sum: '$totalCost' },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ])
      .toArray();

    // Get floor names
    const floorIds = floorBreakdown.map((f) => f._id);
    const floors = await db
      .collection('floors')
      .find({ _id: { $in: floorIds } })
      .toArray();

    const floorMap = {};
    floors.forEach((floor) => {
      floorMap[floor._id.toString()] = floor;
    });

    const floorBreakdownWithNames = floorBreakdown.map((item) => ({
      floorId: item._id,
      floorNumber: floorMap[item._id.toString()]?.floorNumber || null,
      floorName: floorMap[item._id.toString()]?.name || null,
      total: item.total,
      count: item.count,
    }));

    // Approval stats for materials
    const materialsApprovalStats = await db
      .collection('materials')
      .aggregate([
        { $match: { ...materialsBaseQuery, deletedAt: null } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Approval stats for expenses
    const expensesApprovalStats = await db
      .collection('expenses')
      .aggregate([
        { $match: { ...expensesBaseQuery, deletedAt: null } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Approval stats for initial expenses
    const initialExpensesApprovalStats = await db
      .collection('initial_expenses')
      .aggregate([
        { $match: initialExpensesBaseQuery },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const approvalStatsMap = {};
    materialsApprovalStats.forEach((stat) => {
      approvalStatsMap[`MATERIAL_${stat._id}`] = stat.count;
    });
    expensesApprovalStats.forEach((stat) => {
      approvalStatsMap[`EXPENSE_${stat._id}`] = stat.count;
    });
    initialExpensesApprovalStats.forEach((stat) => {
      approvalStatsMap[`INITIAL_EXPENSE_${stat._id}`] = stat.count;
    });

    // Calculate daily burn rate (if date range provided)
    let dailyBurnRate = 0;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
      dailyBurnRate = totalExpenses / days;
    }

    // Get professional services statistics
    let professionalServicesStats = null;
    if (projectId && ObjectId.isValid(projectId)) {
      try {
        const { calculateProjectProfessionalServicesStats } = await import('@/lib/professional-services-helpers');
        professionalServicesStats = await calculateProjectProfessionalServicesStats(projectId);
      } catch (err) {
        console.error('Error calculating professional services stats:', err);
      }
    }

    return successResponse({
      // Combined totals
      totalExpenses,
      totalItems,
      // Breakdown by source
      materialsTotal: totalMaterialsCost,
      materialsCount: totalMaterialsItems,
      expensesTotal: totalExpensesCost,
      expensesCount: totalExpensesItems,
      initialExpensesTotal: totalInitialExpensesCost,
      professionalServices: {
        total: totalProfessionalServicesFees,
        count: totalProfessionalServicesItems,
        statistics: professionalServicesStats, // Detailed stats if projectId provided
      },
      initialExpensesCount: totalInitialExpensesItems,
      // Category breakdown (combined from materials and expenses)
      categoryBreakdown: categoryBreakdown.map((item) => ({
        category: item._id || 'Uncategorized',
        total: item.total,
        count: item.count,
        percentage: totalExpenses > 0 ? ((item.total / totalExpenses) * 100).toFixed(2) : 0,
      })),
      // Floor breakdown (materials only)
      floorBreakdown: floorBreakdownWithNames,
      // Approval stats (separated by type)
      approvalStats: approvalStatsMap,
      dailyBurnRate: parseFloat(dailyBurnRate.toFixed(2)),
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    console.error('Get reports summary error:', error);
    return errorResponse('Failed to retrieve reports summary', 500);
  }
}

