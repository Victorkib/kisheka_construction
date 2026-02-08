/**
 * Bulk Order Analytics API Route
 * GET: Get analytics for bulk material orders
 * 
 * GET /api/analytics/bulk-orders
 * Auth: OWNER, PM, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/analytics/bulk-orders
 * Returns analytics for bulk material orders
 * Query params: projectId, startDate, endDate, groupBy (month, week, day)
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

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
      return errorResponse(
        'Insufficient permissions. Only OWNER, PM, and ACCOUNTANT can view analytics.',
        403
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'month'; // 'month', 'week', 'day'

    const db = await getDatabase();

    // Build query
    const query = { deletedAt: null };
    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    // Date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Get all batches
    const batches = await db.collection('material_request_batches').find(query).toArray();

    // Calculate summary
    const totalBatches = batches.length;
    let totalMaterials = 0;
    let totalCost = 0;

    batches.forEach((batch) => {
      totalMaterials += batch.totalMaterials || 0;
      totalCost += batch.totalEstimatedCost || 0;
    });

    const averageMaterialsPerBatch =
      totalBatches > 0 ? Math.round((totalMaterials / totalBatches) * 100) / 100 : 0;
    const averageCostPerBatch = totalBatches > 0 ? Math.round((totalCost / totalBatches) * 100) / 100 : 0;

    // Calculate trends
    const trends = [];
    const periodMap = {};

    batches.forEach((batch) => {
      const date = new Date(batch.createdAt);
      let period;

      switch (groupBy) {
        case 'day':
          period = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          period = `${weekStart.getFullYear()}-W${Math.ceil((weekStart.getDate() + 6) / 7)}`;
          break;
        case 'month':
        default:
          period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
          break;
      }

      if (!periodMap[period]) {
        periodMap[period] = {
          period,
          batchCount: 0,
          materialCount: 0,
          totalCost: 0,
        };
      }

      periodMap[period].batchCount += 1;
      periodMap[period].materialCount += batch.totalMaterials || 0;
      periodMap[period].totalCost += batch.totalEstimatedCost || 0;
    });

    // Convert to array and sort by period
    Object.values(periodMap).forEach((trend) => {
      trends.push(trend);
    });
    trends.sort((a, b) => a.period.localeCompare(b.period));

    // Compare bulk vs individual orders
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    const individualQuery = {
      deletedAt: null,
      batchId: { $exists: false }, // Individual requests (not in a batch)
      ...(projectId && ObjectId.isValid(projectId) && { projectId: new ObjectId(projectId) }),
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    };

    const individualRequests = await db.collection('material_requests').find(individualQuery).toArray();
    const individualOrders = individualRequests.length;
    const bulkOrders = totalBatches;

    const totalOrders = bulkOrders + individualOrders;
    const bulkPercentage = totalOrders > 0 ? Math.round((bulkOrders / totalOrders) * 100 * 100) / 100 : 0;

    // Get top materials in bulk orders
    const materialCounts = {};
    batches.forEach((batch) => {
      if (batch.materialRequestIds && batch.materialRequestIds.length > 0) {
        // We'll need to fetch material requests to get material names
        // For now, we'll use a simplified approach
      }
    });

    // Fetch material requests for batches to get top materials
    const batchIds = batches.map((b) => b._id);
    const materialRequests = await db
      .collection('material_requests')
      .find({
        batchId: { $in: batchIds },
        deletedAt: null,
      })
      .toArray();

    const topMaterials = {};
    materialRequests.forEach((req) => {
      const materialName = req.materialName || 'Unknown';
      if (!topMaterials[materialName]) {
        topMaterials[materialName] = {
          name: materialName,
          count: 0,
          totalQuantity: 0,
          totalCost: 0,
        };
      }
      topMaterials[materialName].count += 1;
      topMaterials[materialName].totalQuantity += req.quantityNeeded || 0;
      topMaterials[materialName].totalCost += req.estimatedCost || 0;
    });

    const topMaterialsArray = Object.values(topMaterials)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Supplier performance on bulk orders
    const supplierPerformance = {};
    const purchaseOrders = await db
      .collection('purchase_orders')
      .find({
        batchId: { $in: batchIds },
        deletedAt: null,
      })
      .toArray();

    purchaseOrders.forEach((po) => {
      const supplierId = po.supplierId?.toString();
      const supplierName = po.supplierName || 'Unknown Supplier';

      if (!supplierPerformance[supplierId]) {
        supplierPerformance[supplierId] = {
          supplierId,
          supplierName,
          orderCount: 0,
          totalCost: 0,
          materialCount: 0,
          averageResponseTime: null,
          acceptanceRate: 0,
        };
      }

      supplierPerformance[supplierId].orderCount += 1;
      supplierPerformance[supplierId].totalCost += po.totalCost || 0;
      supplierPerformance[supplierId].materialCount += po.materials?.length || 1;

      // Calculate acceptance rate (simplified - assumes accepted if status is not 'rejected')
      if (po.status && po.status !== 'rejected') {
        supplierPerformance[supplierId].acceptanceRate += 1;
      }
    });

    // Calculate acceptance rate percentage
    Object.values(supplierPerformance).forEach((supplier) => {
      supplier.acceptanceRate =
        supplier.orderCount > 0
          ? Math.round((supplier.acceptanceRate / supplier.orderCount) * 100 * 100) / 100
          : 0;
    });

    const supplierPerformanceArray = Object.values(supplierPerformance).sort(
      (a, b) => b.totalCost - a.totalCost
    );

    return successResponse({
      summary: {
        totalBatches,
        totalMaterials,
        totalCost,
        averageMaterialsPerBatch,
        averageCostPerBatch,
      },
      trends,
      comparison: {
        bulkVsIndividual: {
          bulkOrders,
          individualOrders,
          bulkPercentage,
        },
      },
      topMaterials: topMaterialsArray,
      supplierPerformance: supplierPerformanceArray,
    });
  } catch (error) {
    console.error('Bulk order analytics error:', error);
    return errorResponse('Failed to retrieve bulk order analytics', 500);
  }
}

