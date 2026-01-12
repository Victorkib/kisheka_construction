/**
 * Automatic Reassignment API Route
 * POST: Automatically find and suggest alternative suppliers for rejected purchase orders
 * 
 * POST /api/purchase-orders/[id]/auto-reassign
 * Auth: PM, OWNER
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { 
  findSimpleAlternativeSuppliers,
  findAlternativeSuppliers,
  getSmartSupplierSuggestions 
} from '@/lib/supplier-finding';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/[id]/auto-reassign
 * Automatically find alternative suppliers for rejected purchase order
 * Body: { mode: 'simple'|'hybrid'|'smart', limit: number, autoCreate: boolean }
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'manage_purchase_orders');
    if (!canManage) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can reassign orders.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid order ID', 400);
    }

    const body = await request.json();
    const mode = body.mode || 'simple'; // 'simple', 'hybrid', or 'smart'
    const limit = Math.min(parseInt(body.limit) || 5, 10); // Max 10 suggestions
    const autoCreate = body.autoCreate === true; // Whether to automatically create POs for top suggestion

    // Validate mode
    if (!['simple', 'hybrid', 'smart'].includes(mode)) {
      return errorResponse('Invalid mode. Must be "simple", "hybrid", or "smart"', 400);
    }

    const db = await getDatabase();

    // Get purchase order
    const purchaseOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!purchaseOrder) {
      return errorResponse('Purchase order not found', 404);
    }

    // Only allow reassignment for rejected orders or partially responded orders with rejections
    const isRejected = purchaseOrder.status === 'order_rejected';
    const isPartiallyResponded = purchaseOrder.status === 'order_partially_responded' && 
                                  purchaseOrder.materialResponses?.some(mr => mr.action === 'reject');
    
    if (!isRejected && !isPartiallyResponded) {
      return errorResponse(
        `Cannot reassign order with status: ${purchaseOrder.status}. Only rejected orders or orders with rejected materials can be reassigned.`,
        400
      );
    }

    // Get material request for context
    const materialRequest = await db.collection('material_requests').findOne({
      _id: purchaseOrder.materialRequestId,
    });

    if (!materialRequest) {
      return errorResponse('Material request not found', 404);
    }

    // Find alternative suppliers
    let alternatives = [];
    let message = '';

    if (mode === 'simple') {
      alternatives = await findSimpleAlternativeSuppliers({
        currentSupplierId: purchaseOrder.supplierId.toString(),
        limit,
      });
      message = `Found ${alternatives.length} alternative supplier${alternatives.length !== 1 ? 's' : ''}`;
    } else if (mode === 'hybrid') {
      alternatives = await findAlternativeSuppliers({
        materialRequestId: purchaseOrder.materialRequestId.toString(),
        currentSupplierId: purchaseOrder.supplierId.toString(),
        rejectionReason: purchaseOrder.rejectionReason,
        quantity: purchaseOrder.quantityOrdered,
        maxPrice: purchaseOrder.totalCost / purchaseOrder.quantityOrdered, // Average unit cost
        requiredBy: purchaseOrder.deliveryDate,
        limit,
      });
      message = `Found ${alternatives.length} alternative supplier${alternatives.length !== 1 ? 's' : ''} using hybrid matching`;
    } else if (mode === 'smart') {
      const suggestions = await getSmartSupplierSuggestions({
        materialRequestId: purchaseOrder.materialRequestId.toString(),
        currentSupplierId: purchaseOrder.supplierId.toString(),
        rejectionReason: purchaseOrder.rejectionReason,
        limit,
      });
      alternatives = suggestions.suppliers || [];
      message = suggestions.message || `Found ${alternatives.length} smart suggestions`;
    }

    if (alternatives.length === 0) {
      return successResponse({
        alternatives: [],
        message: 'No alternative suppliers found. You may need to create a new material request or adjust search criteria.',
        autoCreated: false
      }, 'No alternatives found');
    }

    // If autoCreate is enabled and we have alternatives, create PO for top suggestion
    let autoCreatedPO = null;
    if (autoCreate && alternatives.length > 0) {
      const topAlternative = alternatives[0];
      
      try {
        // Create new purchase order for alternative supplier
        const { createPOFromSupplierGroup } = await import('@/lib/helpers/bulk-po-helpers');
        
        // For single material orders, create a simple assignment
        const assignment = {
          supplierId: topAlternative._id.toString(),
          materialRequestIds: [purchaseOrder.materialRequestId.toString()],
          deliveryDate: purchaseOrder.deliveryDate,
          terms: purchaseOrder.terms || '',
          notes: `Auto-reassigned from rejected PO ${purchaseOrder.purchaseOrderNumber}. Original rejection reason: ${purchaseOrder.rejectionReason || 'Not specified'}`,
        };

        // Get batch if this was part of a bulk order
        let batchId = null;
        if (purchaseOrder.batchId) {
          batchId = purchaseOrder.batchId.toString();
        }

        if (batchId) {
          const newPO = await createPOFromSupplierGroup(assignment, batchId, userProfile);
          autoCreatedPO = {
            _id: newPO._id.toString(),
            purchaseOrderNumber: newPO.purchaseOrderNumber,
            supplierId: topAlternative._id.toString(),
            supplierName: topAlternative.name,
          };

          // Link to original rejected order
          await db.collection('purchase_orders').updateOne(
            { _id: newPO._id },
            {
              $set: {
                originalOrderId: purchaseOrder._id,
                originalOrderNumber: purchaseOrder.purchaseOrderNumber,
                originalRejectionReason: purchaseOrder.rejectionReason,
                isAlternativeOrder: true,
              }
            }
          );

          // Update original order to track alternative
          await db.collection('purchase_orders').updateOne(
            { _id: purchaseOrder._id },
            {
              $addToSet: {
                alternativeOrderIds: newPO._id
              },
              $set: {
                alternativesSentAt: new Date(),
                alternativesSentBy: userProfile._id,
                updatedAt: new Date()
              }
            }
          );

          // Create audit log
          await createAuditLog({
            userId: userProfile._id.toString(),
            action: 'AUTO_REASSIGNED',
            entityType: 'PURCHASE_ORDER',
            entityId: purchaseOrder._id.toString(),
            projectId: purchaseOrder.projectId.toString(),
            changes: {
              originalOrder: purchaseOrder.purchaseOrderNumber,
              newOrder: newPO.purchaseOrderNumber,
              alternativeSupplier: topAlternative.name,
              mode: mode
            }
          });

          message += `. Automatically created new PO ${newPO.purchaseOrderNumber} for ${topAlternative.name}`;
        } else {
          // Single order - create directly
          // This would require the single PO creation logic
          message += '. Auto-creation for single orders requires manual approval';
        }
      } catch (createError) {
        console.error('[Auto Reassign] Error creating alternative PO:', createError);
        message += `. Failed to auto-create PO: ${createError.message}`;
      }
    }

    return successResponse({
      alternatives: alternatives.map(alt => ({
        _id: alt._id.toString(),
        name: alt.name,
        email: alt.email,
        phone: alt.phone,
        rating: alt.rating || null,
        dataQuality: alt.dataQuality || null,
        matchScore: alt.matchScore || null,
        reason: alt.reason || null,
      })),
      message,
      autoCreated: !!autoCreatedPO,
      autoCreatedPO,
      mode,
      originalOrderId: purchaseOrder._id.toString(),
      originalOrderNumber: purchaseOrder.purchaseOrderNumber
    }, message);
  } catch (error) {
    console.error('Auto reassign error:', error);
    return errorResponse('Failed to find alternative suppliers', 500);
  }
}













