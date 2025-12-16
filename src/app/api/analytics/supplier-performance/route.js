/**
 * Supplier Performance Analytics API Route
 * GET: Get supplier performance metrics for bulk orders
 * 
 * GET /api/analytics/supplier-performance
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
 * GET /api/analytics/supplier-performance
 * Returns supplier performance metrics for bulk orders
 * Query params: projectId, startDate, endDate, supplierId
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
      return errorResponse(
        'Insufficient permissions. Only OWNER, PM, and ACCOUNTANT can view analytics.',
        403
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const supplierId = searchParams.get('supplierId');

    const db = await getDatabase();

    // Build query for purchase orders from bulk batches
    const poQuery = {
      deletedAt: null,
      isBulkOrder: true, // Only bulk orders
    };

    if (projectId && ObjectId.isValid(projectId)) {
      poQuery.projectId = new ObjectId(projectId);
    }

    if (supplierId && ObjectId.isValid(supplierId)) {
      poQuery.supplierId = new ObjectId(supplierId);
    }

    // Date filter
    if (startDate || endDate) {
      poQuery.createdAt = {};
      if (startDate) {
        poQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        poQuery.createdAt.$lte = new Date(endDate);
      }
    }

    // Get purchase orders
    const purchaseOrders = await db.collection('purchase_orders').find(poQuery).toArray();

    // Group by supplier
    const supplierMap = {};

    purchaseOrders.forEach((po) => {
      const sid = po.supplierId?.toString();
      if (!sid) return;

      if (!supplierMap[sid]) {
        supplierMap[sid] = {
          supplierId: sid,
          supplierName: po.supplierName || 'Unknown Supplier',
          supplierEmail: po.supplierEmail || '',
          orderCount: 0,
          totalCost: 0,
          totalMaterials: 0,
          acceptedOrders: 0,
          rejectedOrders: 0,
          pendingOrders: 0,
          fulfilledOrders: 0,
          responseTimes: [],
          fulfillmentTimes: [],
          averageUnitCost: 0,
        };
      }

      const supplier = supplierMap[sid];
      supplier.orderCount += 1;
      supplier.totalCost += po.totalCost || 0;
      supplier.totalMaterials += po.materials?.length || 1;

      // Track status
      switch (po.status) {
        case 'order_accepted':
          supplier.acceptedOrders += 1;
          break;
        case 'order_rejected':
          supplier.rejectedOrders += 1;
          break;
        case 'ready_for_delivery':
        case 'delivered':
          supplier.fulfilledOrders += 1;
          break;
        default:
          supplier.pendingOrders += 1;
      }

      // Calculate response time (time from sent to accepted/rejected)
      if (po.sentAt && (po.status === 'order_accepted' || po.status === 'order_rejected')) {
        const responseDate = po.respondedAt || po.updatedAt || new Date();
        const responseTime = (new Date(responseDate) - new Date(po.sentAt)) / (1000 * 60 * 60); // hours
        if (responseTime > 0) {
          supplier.responseTimes.push(responseTime);
        }
      }

      // Calculate fulfillment time (time from accepted to ready_for_delivery)
      if (po.status === 'ready_for_delivery' && po.fulfilledAt) {
        const acceptedDate = po.acceptedAt || po.respondedAt || po.sentAt;
        if (acceptedDate) {
          const fulfillmentTime =
            (new Date(po.fulfilledAt) - new Date(acceptedDate)) / (1000 * 60 * 60 * 24); // days
          if (fulfillmentTime > 0) {
            supplier.fulfillmentTimes.push(fulfillmentTime);
          }
        }
      }
    });

    // Calculate metrics for each supplier
    const suppliers = Object.values(supplierMap).map((supplier) => {
      const acceptanceRate =
        supplier.orderCount > 0
          ? Math.round((supplier.acceptedOrders / supplier.orderCount) * 100 * 100) / 100
          : 0;

      const averageResponseTime =
        supplier.responseTimes.length > 0
          ? Math.round(
              (supplier.responseTimes.reduce((sum, t) => sum + t, 0) / supplier.responseTimes.length) * 100
            ) / 100
          : null;

      const averageFulfillmentTime =
        supplier.fulfillmentTimes.length > 0
          ? Math.round(
              (supplier.fulfillmentTimes.reduce((sum, t) => sum + t, 0) / supplier.fulfillmentTimes.length) *
                100
            ) / 100
          : null;

      const averageUnitCost =
        supplier.totalMaterials > 0
          ? Math.round((supplier.totalCost / supplier.totalMaterials) * 100) / 100
          : 0;

      return {
        ...supplier,
        acceptanceRate,
        averageResponseTime,
        averageFulfillmentTime,
        averageUnitCost,
        totalResponseTime: supplier.responseTimes.reduce((sum, t) => sum + t, 0),
        totalFulfillmentTime: supplier.fulfillmentTimes.reduce((sum, t) => sum + t, 0),
      };
    });

    // Sort by total cost (descending)
    suppliers.sort((a, b) => b.totalCost - a.totalCost);

    // Calculate overall statistics
    const totalOrders = purchaseOrders.length;
    const totalCost = purchaseOrders.reduce((sum, po) => sum + (po.totalCost || 0), 0);
    const totalAccepted = suppliers.reduce((sum, s) => sum + s.acceptedOrders, 0);
    const totalRejected = suppliers.reduce((sum, s) => sum + s.rejectedOrders, 0);
    const overallAcceptanceRate =
      totalOrders > 0 ? Math.round((totalAccepted / totalOrders) * 100 * 100) / 100 : 0;

    const allResponseTimes = suppliers.flatMap((s) => s.responseTimes);
    const overallAverageResponseTime =
      allResponseTimes.length > 0
        ? Math.round((allResponseTimes.reduce((sum, t) => sum + t, 0) / allResponseTimes.length) * 100) / 100
        : null;

    const allFulfillmentTimes = suppliers.flatMap((s) => s.fulfillmentTimes);
    const overallAverageFulfillmentTime =
      allFulfillmentTimes.length > 0
        ? Math.round(
            (allFulfillmentTimes.reduce((sum, t) => sum + t, 0) / allFulfillmentTimes.length) * 100
          ) / 100
        : null;

    return successResponse({
      suppliers,
      summary: {
        totalSuppliers: suppliers.length,
        totalOrders,
        totalCost,
        totalAccepted,
        totalRejected,
        overallAcceptanceRate,
        overallAverageResponseTime,
        overallAverageFulfillmentTime,
      },
    });
  } catch (error) {
    console.error('Supplier performance analytics error:', error);
    return errorResponse('Failed to retrieve supplier performance analytics', 500);
  }
}

