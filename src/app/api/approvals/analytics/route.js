/**
 * Approval Analytics API Route
 * GET: Get approval metrics, trends, and bottleneck analysis
 * 
 * GET /api/approvals/analytics?projectId=...&startDate=...&endDate=...
 * Auth: PM, OWNER, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getPendingApprovalStatuses } from '@/lib/status-constants';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/approvals/analytics
 * Get approval analytics for a project
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canView = await hasPermission(user.id, 'view_approvals');
    if (!canView) {
      return errorResponse('Insufficient permissions', 403);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    const db = await getDatabase();
    const projectObjectId = new ObjectId(projectId);

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    // Get all approval types data
    const approvalTypes = [
      { name: 'materials', collection: 'materials', titleField: 'name', amountField: 'totalCost', dateField: 'createdAt' },
      { name: 'expenses', collection: 'expenses', titleField: 'description', amountField: 'amount', dateField: 'createdAt' },
      { name: 'initial_expenses', collection: 'initial_expenses', titleField: 'itemName', amountField: 'amount', dateField: 'createdAt' },
      { name: 'material_requests', collection: 'material_requests', titleField: 'materialName', amountField: 'estimatedCost', dateField: 'requestedAt' },
      { name: 'labour_entries', collection: 'labour_entries', titleField: 'taskDescription', amountField: 'totalCost', dateField: 'entryDate' },
      { name: 'professional_fees', collection: 'professional_fees', titleField: 'description', amountField: 'amount', dateField: 'createdAt' },
      { name: 'professional_activities', collection: 'professional_activities', titleField: 'activityType', amountField: 'feesCharged', dateField: 'activityDate' },
      { name: 'budget_reallocations', collection: 'budget_reallocations', titleField: 'reason', amountField: 'amount', dateField: 'createdAt' },
      { name: 'purchase_order_modifications', collection: 'purchase_orders', titleField: 'orderNumber', amountField: 'totalCost', dateField: 'modifiedAt' },
      { name: 'contingency_draws', collection: 'contingency_draws', titleField: 'reason', amountField: 'amount', dateField: 'requestedAt' },
    ];

    // Fetch pending approvals
    const pendingData = {};
    const allPendingItems = [];

    for (const type of approvalTypes) {
      const pendingStatuses = getPendingApprovalStatuses(type.name);
      const query = {
        projectId: projectObjectId,
        status: { $in: pendingStatuses },
        ...(Object.keys(dateFilter).length > 0 && { [type.dateField]: dateFilter }),
      };

      const items = await db.collection(type.collection).find(query).toArray();
      
      pendingData[type.name] = {
        count: items.length,
        totalAmount: items.reduce((sum, item) => sum + (item[type.amountField] || 0), 0),
        items: items.map(item => ({
          id: item._id.toString(),
          title: item[type.titleField] || 'N/A',
          amount: item[type.amountField] || 0,
          date: item[type.dateField] || item.createdAt,
          status: item.status,
        })),
      };

      allPendingItems.push(...items.map(item => ({
        type: type.name,
        id: item._id.toString(),
        date: item[type.dateField] || item.createdAt,
        amount: item[type.amountField] || 0,
      })));
    }

    // Calculate overall metrics
    const totalPending = Object.values(pendingData).reduce((sum, data) => sum + data.count, 0);
    const totalPendingValue = Object.values(pendingData).reduce((sum, data) => sum + data.totalAmount, 0);

    // Calculate average pending age
    const now = new Date();
    const pendingAges = allPendingItems
      .map(item => {
        const itemDate = item.date ? new Date(item.date) : now;
        return Math.floor((now - itemDate) / (1000 * 60 * 60 * 24)); // days
      })
      .filter(age => age >= 0);

    const averagePendingAge = pendingAges.length > 0
      ? Math.round(pendingAges.reduce((sum, age) => sum + age, 0) / pendingAges.length * 10) / 10
      : 0;

    // Identify bottlenecks (items pending > 7 days)
    const bottlenecks = allPendingItems
      .filter(item => {
        const itemDate = item.date ? new Date(item.date) : now;
        const daysPending = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
        return daysPending > 7;
      })
      .map(item => ({
        ...item,
        daysPending: Math.floor((now - (item.date ? new Date(item.date) : now)) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a, b) => b.daysPending - a.daysPending)
      .slice(0, 10); // Top 10 bottlenecks

    // Calculate trends (last 30 days by default, or based on date range)
    const trendDays = endDate && startDate
      ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
      : 30;

    const trends = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayItems = allPendingItems.filter(item => {
        const itemDate = item.date ? new Date(item.date) : null;
        return itemDate && itemDate >= date && itemDate < nextDate;
      });

      trends.push({
        date: date.toISOString().split('T')[0],
        count: dayItems.length,
        totalValue: dayItems.reduce((sum, item) => sum + (item.amount || 0), 0),
      });
    }

    // Calculate approval rate (if we have historical data)
    // This would require querying approved items - simplified for now
    const approvalRate = null; // Would need to query approved items to calculate

    return successResponse({
      metrics: {
        totalPending,
        totalPendingValue,
        averagePendingAge,
        byType: pendingData,
      },
      trends,
      bottlenecks: {
        count: bottlenecks.length,
        items: bottlenecks,
      },
      summary: {
        projectId,
        period: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Approval analytics error:', error);
    return errorResponse('Failed to fetch approval analytics', 500);
  }
}
