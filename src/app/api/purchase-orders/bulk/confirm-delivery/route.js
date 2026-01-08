/**
 * Bulk Purchase Order Delivery Confirmation API Route
 * POST /api/purchase-orders/bulk/confirm-delivery
 * Owner/PM confirms delivery for multiple purchase orders and automatically creates materials
 * Auth: OWNER, PM
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createMaterialFromPurchaseOrder } from '@/lib/material-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';

/**
 * POST /api/purchase-orders/bulk/confirm-delivery
 * Confirm delivery for multiple purchase orders
 * Auth: OWNER, PM
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canConfirm = await hasPermission(user.id, 'confirm_delivery') || 
                      await hasPermission(user.id, 'create_material_from_order');
    if (!canConfirm) {
      return errorResponse('Insufficient permissions. Only Owner and PM can confirm delivery.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Verify user is Owner or PM
    const userRole = userProfile.role?.toLowerCase();
    if (!['owner', 'pm', 'project_manager'].includes(userRole)) {
      return errorResponse('Only Owner and Project Managers can confirm delivery', 403);
    }

    const body = await request.json();
    const { purchaseOrderIds } = body || {};

    if (!purchaseOrderIds || !Array.isArray(purchaseOrderIds) || purchaseOrderIds.length === 0) {
      return errorResponse('purchaseOrderIds array is required', 400);
    }

    // Validate all IDs
    const validIds = purchaseOrderIds.filter(id => ObjectId.isValid(id));
    if (validIds.length === 0) {
      return errorResponse('No valid purchase order IDs provided', 400);
    }

    const db = await getDatabase();

    // Get all purchase orders
    const purchaseOrders = await db.collection('purchase_orders').find({
      _id: { $in: validIds.map(id => new ObjectId(id)) },
      deletedAt: null,
    }).toArray();

    if (purchaseOrders.length === 0) {
      return errorResponse('No purchase orders found', 404);
    }

    // Filter to only orders that can be confirmed (status = 'order_accepted' and no materials created)
    const confirmableOrders = purchaseOrders.filter(po => {
      if (po.status !== 'order_accepted') {
        return false;
      }
      if (po.linkedMaterialId) {
        return false;
      }
      // For bulk orders, check if any materials exist
      if (po.isBulkOrder) {
        // We'll check this in the transaction
        return true;
      }
      return true;
    });

    if (confirmableOrders.length === 0) {
      return errorResponse('No purchase orders can be confirmed. All orders must have status "order_accepted" and no materials created.', 400);
    }

    const results = {
      confirmed: [],
      failed: [],
      skipped: [],
    };

    // Process each order
    for (const purchaseOrder of confirmableOrders) {
      try {
        // For bulk orders, check if materials already exist
        if (purchaseOrder.isBulkOrder) {
          const existingMaterials = await db.collection('materials').countDocuments({
            linkedPurchaseOrderId: purchaseOrder._id,
            deletedAt: null,
          });
          if (existingMaterials > 0) {
            results.skipped.push({
              purchaseOrderId: purchaseOrder._id.toString(),
              purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
              reason: 'Materials already created',
            });
            continue;
          }
        }

        // Confirm delivery and create materials
        // Materials created from POs are automatically approved for immediate financial state accuracy
        const materialResult = await createMaterialFromPurchaseOrder({
          purchaseOrderId: purchaseOrder._id.toString(),
          creatorUserProfile: userProfile,
          notes: 'Bulk delivery confirmation by Owner/PM',
          isAutomatic: false,
          // Note: allowFromAccepted parameter is deprecated but kept for backward compatibility
          // Materials from POs are now always auto-approved
        });

        results.confirmed.push({
          purchaseOrderId: purchaseOrder._id.toString(),
          purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
          materialIds: materialResult.materialIds?.map(id => id.toString()) || [],
          materialCount: materialResult.createdMaterials?.length || 0,
        });

        // Create audit log
        await createAuditLog({
          userId: userProfile._id.toString(),
          action: 'DELIVERY_CONFIRMED',
          entityType: 'PURCHASE_ORDER',
          entityId: purchaseOrder._id.toString(),
          projectId: purchaseOrder.projectId.toString(),
          changes: {
            before: purchaseOrder,
            after: { ...purchaseOrder, status: 'delivered', financialStatus: 'fulfilled' },
            materialCreated: true,
            materialIds: materialResult.materialIds?.map(id => id.toString()) || [],
            confirmationMethod: 'owner_pm_bulk',
          },
        });
      } catch (error) {
        console.error(`Error confirming delivery for PO ${purchaseOrder.purchaseOrderNumber}:`, error);
        results.failed.push({
          purchaseOrderId: purchaseOrder._id.toString(),
          purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
          error: error.message || 'Unknown error',
        });
      }
    }

    // Return summary
    return successResponse({
      total: confirmableOrders.length,
      confirmed: results.confirmed.length,
      failed: results.failed.length,
      skipped: results.skipped.length,
      results: {
        confirmed: results.confirmed,
        failed: results.failed,
        skipped: results.skipped,
      },
    }, `Bulk delivery confirmation completed: ${results.confirmed.length} confirmed, ${results.failed.length} failed, ${results.skipped.length} skipped`, 200);
  } catch (error) {
    console.error('Bulk confirm delivery error:', error);
    return errorResponse('Failed to confirm deliveries', 500);
  }
}



