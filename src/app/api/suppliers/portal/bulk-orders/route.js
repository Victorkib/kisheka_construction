/**
 * Supplier Portal Bulk Orders API Route
 * GET: Get bulk orders for a supplier (via token or supplier ID)
 * 
 * GET /api/suppliers/portal/bulk-orders?token=xxx
 * GET /api/suppliers/portal/bulk-orders?supplierId=xxx (if authenticated)
 * Auth: Token-based or SUPPLIER role
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/suppliers/portal/bulk-orders
 * Get bulk purchase orders for a supplier
 * Can be accessed via token (public) or supplier ID (authenticated)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const supplierId = searchParams.get('supplierId');

    const db = await getDatabase();
    let targetSupplierId = null;

    // If token provided, find supplier from purchase order
    if (token) {
      const purchaseOrder = await db.collection('purchase_orders').findOne({
        responseToken: token,
        deletedAt: null,
      });

      if (!purchaseOrder) {
        return errorResponse('Invalid or expired token', 404);
      }

      // Check if token is expired
      if (purchaseOrder.responseTokenExpiresAt && new Date() > new Date(purchaseOrder.responseTokenExpiresAt)) {
        return errorResponse('Token has expired', 410);
      }

      targetSupplierId = purchaseOrder.supplierId;
    } else if (supplierId) {
      // If supplierId provided, check authentication
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return errorResponse('Unauthorized', 401);
      }

      const userProfile = await getUserProfile(user.id);
      if (!userProfile) {
        return errorResponse('User profile not found', 404);
      }

      // Verify user is a supplier and matches the supplierId
      const userRole = userProfile.role?.toLowerCase();
      if (userRole !== 'supplier') {
        return errorResponse('Only suppliers can access this endpoint', 403);
      }

      if (userProfile._id.toString() !== supplierId) {
        return errorResponse('You can only view your own orders', 403);
      }

      targetSupplierId = new ObjectId(supplierId);
    } else {
      return errorResponse('Token or supplierId is required', 400);
    }

    if (!targetSupplierId) {
      return errorResponse('Supplier not found', 404);
    }

    // Get all bulk purchase orders for this supplier
    const bulkOrders = await db.collection('purchase_orders').find({
      supplierId: targetSupplierId,
      isBulkOrder: true,
      deletedAt: null,
    }).sort({ createdAt: -1 }).toArray();

    // Get batch information for each bulk order
    const ordersWithDetails = await Promise.all(
      bulkOrders.map(async (order) => {
        let batch = null;
        if (order.batchId) {
          batch = await db.collection('material_request_batches').findOne({
            _id: order.batchId,
            deletedAt: null,
          });
        }

        // Get material requests
        let materialRequests = [];
        if (order.materialRequestIds && Array.isArray(order.materialRequestIds)) {
          materialRequests = await db
            .collection('material_requests')
            .find({
              _id: { $in: order.materialRequestIds.map((id) => new ObjectId(id)) },
            })
            .toArray();
        }

        // Get project
        const project = await db.collection('projects').findOne({
          _id: order.projectId,
        });

        return {
          _id: order._id.toString(),
          purchaseOrderNumber: order.purchaseOrderNumber,
          status: order.status,
          totalCost: order.totalCost,
          deliveryDate: order.deliveryDate,
          terms: order.terms,
          notes: order.notes,
          materials: order.materials || [],
          materialCount: order.materials?.length || materialRequests.length || 0,
          batch: batch ? {
            _id: batch._id.toString(),
            batchNumber: batch.batchNumber,
            batchName: batch.batchName,
            status: batch.status,
          } : null,
          project: project ? {
            _id: project._id.toString(),
            projectName: project.projectName,
            projectCode: project.projectCode,
          } : null,
          createdAt: order.createdAt,
          responseToken: order.responseToken, // Include token for response links
        };
      })
    );

    return successResponse({
      bulkOrders: ordersWithDetails,
      total: ordersWithDetails.length,
    });
  } catch (error) {
    console.error('Get bulk orders error:', error);
    return errorResponse('Failed to retrieve bulk orders', 500);
  }
}

