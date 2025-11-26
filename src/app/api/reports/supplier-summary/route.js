/**
 * Supplier Summary Report API Route
 * GET: Get summary of all suppliers with spending totals
 * 
 * GET /api/reports/supplier-summary
 * Auth: OWNER, PM, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/reports/supplier-summary
 * Returns summary of all suppliers with total spent, item count, etc.
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

    // Build query
    const query = {
      deletedAt: null,
      status: { $in: ['approved', 'received'] },
      $or: [
        { supplierName: { $exists: true, $ne: '' } },
        { supplier: { $exists: true, $ne: '' } },
      ],
    };

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (startDate || endDate) {
      query.datePurchased = {};
      if (startDate) query.datePurchased.$gte = new Date(startDate);
      if (endDate) query.datePurchased.$lte = new Date(endDate);
    }

    // Aggregate by supplier
    const supplierSummary = await db
      .collection('materials')
      .aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              $ifNull: ['$supplierName', '$supplier'],
            },
            totalSpent: { $sum: '$totalCost' },
            itemCount: { $sum: 1 },
            avgPrice: { $avg: '$unitCost' },
            firstPurchase: { $min: '$datePurchased' },
            lastPurchase: { $max: '$datePurchased' },
          },
        },
        { $sort: { totalSpent: -1 } },
      ])
      .toArray();

    const suppliers = supplierSummary.map((item) => ({
      name: item._id || 'Unknown Supplier',
      totalSpent: item.totalSpent,
      itemCount: item.itemCount,
      avgPrice: parseFloat((item.avgPrice || 0).toFixed(2)),
      firstPurchase: item.firstPurchase,
      lastPurchase: item.lastPurchase,
    }));

    return successResponse({
      suppliers,
      totalSuppliers: suppliers.length,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    console.error('Get supplier summary error:', error);
    return errorResponse('Failed to retrieve supplier summary', 500);
  }
}

