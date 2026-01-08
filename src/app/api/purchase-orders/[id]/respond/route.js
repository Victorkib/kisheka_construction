/**
 * Purchase Order Response API Route
 * POST: Process supplier response via secure token link
 * 
 * POST /api/purchase-orders/[id]/respond
 * Auth: None (public, token-based)
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { updateCommittedCost, recalculateProjectFinances, validateCapitalAvailability } from '@/lib/financial-helpers';
import { createMaterialFromPurchaseOrder } from '@/lib/material-helpers';
import { sendPushToUser } from '@/lib/push-service';
import { createAuditLog } from '@/lib/audit-log';
import { assessRetryability, formatRejectionReason } from '@/lib/rejection-reasons';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/[id]/respond
 * Process supplier response (via secure link)
 * Body: { action: 'accept'|'reject'|'modify', token, ... }
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { 
      action, 
      token, 
      supplierNotes, 
      finalUnitCost, 
      quantityOrdered, 
      deliveryDate, 
      notes, 
      rejectionReason, 
      rejectionSubcategory,
      isPartialResponse,
      materialResponses
    } = body;

    console.log('[POST /api/purchase-orders/[id]/respond] Request received:', {
      id,
      action,
      hasToken: !!token,
      tokenLength: token?.length
    });

    if (!id || !ObjectId.isValid(id)) {
      console.error('[POST /api/purchase-orders/[id]/respond] Invalid ID:', id);
      return errorResponse('Invalid purchase order ID', 400);
    }

    if (!action || !['accept', 'reject', 'modify'].includes(action)) {
      console.error('[POST /api/purchase-orders/[id]/respond] Invalid action:', action);
      return errorResponse('Invalid action. Must be "accept", "reject", or "modify"', 400);
    }

    if (!token) {
      console.error('[POST /api/purchase-orders/[id]/respond] Missing token');
      return errorResponse('Response token is required', 400);
    }

    const db = await getDatabase();

    // Get purchase order
    const purchaseOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!purchaseOrder) {
      return errorResponse('Purchase order not found', 404);
    }

    // Validate token
    if (purchaseOrder.responseToken !== token) {
      return errorResponse('Invalid response token', 401);
    }

    // Check if token is expired
    if (purchaseOrder.responseTokenExpiresAt && new Date() > new Date(purchaseOrder.responseTokenExpiresAt)) {
      return errorResponse('Response token has expired', 410);
    }

    // Check if token has already been used
    if (purchaseOrder.responseTokenUsedAt) {
      return errorResponse('This response link has already been used. Please contact the buyer if you need to make changes.', 410);
    }

    // Check if order can be responded to
    if (purchaseOrder.status !== 'order_sent' && purchaseOrder.status !== 'order_modified') {
      return errorResponse(`Cannot respond to order with status: ${purchaseOrder.status}`, 400);
    }

    // Handle partial responses for bulk orders
    if (isPartialResponse && materialResponses && Array.isArray(materialResponses) && materialResponses.length > 0) {
      return await handlePartialResponse({
        db,
        purchaseOrder,
        id,
        token,
        materialResponses,
        supplierNotes,
        poCreator: await db.collection('users').findOne({ _id: purchaseOrder.createdBy, status: 'active' })
      });
    }

    if (action === 'accept') {
      // Calculate final cost (may differ from original)
      let finalTotalCost = purchaseOrder.totalCost;
      let unitCostToUse = purchaseOrder.unitCost;

      // Handle bulk orders differently
      if (purchaseOrder.isBulkOrder && purchaseOrder.materials && Array.isArray(purchaseOrder.materials)) {
        // For bulk orders, if finalUnitCost is provided, we can't apply it to all materials
        // Instead, we use the original totalCost or recalculate from materials array
        if (finalUnitCost !== undefined && finalUnitCost >= 0) {
          // If supplier provides a new unit cost, we need to recalculate from materials
          // But since different materials have different costs, we'll use a weighted average
          // For now, we'll keep the original totalCost and log a warning
          console.warn('[PO Response] Bulk order: finalUnitCost provided but cannot be applied uniformly to all materials. Using original totalCost.');
          // Keep original totalCost for bulk orders
          finalTotalCost = purchaseOrder.totalCost;
        } else {
          // Use original totalCost
          finalTotalCost = purchaseOrder.totalCost;
        }
        // For bulk orders, unitCost is not applicable (set to 0)
        unitCostToUse = 0;
      } else {
        // Single material order - can apply finalUnitCost if provided
        if (finalUnitCost !== undefined && finalUnitCost >= 0) {
          unitCostToUse = parseFloat(finalUnitCost);
          finalTotalCost = purchaseOrder.quantityOrdered * unitCostToUse;
        }
      }

      // Validate capital availability
      const capitalValidation = await validateCapitalAvailability(
        purchaseOrder.projectId.toString(),
        finalTotalCost
      );

      if (!capitalValidation.isValid) {
        return errorResponse(
          `Insufficient capital. Available: ${capitalValidation.available.toLocaleString()}, Required: ${finalTotalCost.toLocaleString()}`,
          400
        );
      }

      // Update order status and invalidate token (one-time use)
      const updateData = {
        status: 'order_accepted',
        supplierResponse: 'accept',
        supplierResponseDate: new Date(),
        supplierNotes: supplierNotes?.trim() || null,
        unitCost: unitCostToUse,
        totalCost: finalTotalCost,
        financialStatus: 'committed',
        committedAt: new Date(),
        responseTokenUsedAt: new Date(), // Invalidate token - one-time use
        updatedAt: new Date()
      };

      await db.collection('purchase_orders').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      // Increase committedCost
      await updateCommittedCost(
        purchaseOrder.projectId.toString(),
        finalTotalCost,
        'add'
      );

      // Trigger financial recalculation
      await recalculateProjectFinances(purchaseOrder.projectId.toString());

      // Get PM/OWNER for notifications
      const poCreator = await db.collection('users').findOne({
        _id: purchaseOrder.createdBy,
        status: 'active'
      });

      // Auto-create material if configured
      // Materials created from POs are automatically approved for immediate financial state accuracy
      let materialCreated = false;
      if (process.env.AUTO_CREATE_MATERIAL_ON_CONFIRM === 'true' && poCreator) {
        try {
          await createMaterialFromPurchaseOrder({
            purchaseOrderId: id,
            creatorUserProfile: poCreator,
            actualQuantityReceived: purchaseOrder.quantityOrdered,
            actualUnitCost: unitCostToUse,
            notes: supplierNotes || 'Accepted via secure link',
            isAutomatic: true
          });
          materialCreated = true;
        } catch (materialError) {
          console.error('Auto-create material error:', materialError);
        }
      }

      // Notify PM/OWNER
      if (poCreator) {
        try {
          await sendPushToUser({
            userId: poCreator._id.toString(),
            title: 'Purchase Order Accepted',
            message: `${purchaseOrder.supplierName} accepted PO ${purchaseOrder.purchaseOrderNumber}${materialCreated ? ' - Material entry created' : ''}`,
            data: {
              url: `/purchase-orders/${id}`,
              purchaseOrderId: id
            }
          });
        } catch (pushError) {
          console.error('Push notification failed:', pushError);
        }
      }

      // Create audit log
      await createAuditLog({
        userId: null,
        action: 'ACCEPTED',
        entityType: 'PURCHASE_ORDER',
        entityId: id,
        projectId: purchaseOrder.projectId.toString(),
        changes: {
          before: purchaseOrder,
          after: { ...purchaseOrder, ...updateData },
          confirmationMethod: 'token_link',
          materialCreated
        }
      });

      return successResponse({
        orderId: id,
        status: 'order_accepted',
        materialCreated
      }, 'Purchase order accepted successfully');
    } else if (action === 'reject') {
      if (!supplierNotes || !supplierNotes.trim()) {
        return errorResponse('Rejection reason is required', 400);
      }

      // Validate rejection reason if provided
      if (rejectionReason) {
        const validReasons = [
          'price_too_high', 'unavailable', 'timeline', 'specifications',
          'quantity', 'business_policy', 'external_factors', 'other'
        ];
        if (!validReasons.includes(rejectionReason)) {
          return errorResponse('Invalid rejection reason', 400);
        }
      }

      // Assess retryability and generate recommendations
      let retryabilityAssessment = { retryable: false, recommendation: 'Manual review required' };
      if (rejectionReason) {
        retryabilityAssessment = assessRetryability(rejectionReason, rejectionSubcategory);
      }

      // Update order status and invalidate token (one-time use)
      const updateData = {
        status: 'order_rejected',
        supplierResponse: 'reject',
        supplierResponseDate: new Date(),
        supplierNotes: supplierNotes.trim(),
        rejectionReason: rejectionReason || null,
        rejectionSubcategory: rejectionSubcategory || null,
        isRetryable: retryabilityAssessment.retryable,
        retryRecommendation: retryabilityAssessment.recommendation,
        rejectionMetadata: {
          assessedAt: new Date(),
          reasonCategory: rejectionReason,
          subcategory: rejectionSubcategory,
          priority: retryabilityAssessment.priority,
          confidence: retryabilityAssessment.confidence,
          formattedReason: rejectionReason ? formatRejectionReason(rejectionReason, rejectionSubcategory) : null,
          userAgent: request.headers.get('user-agent') || null,
          responseMethod: 'token_link',
        },
        responseTokenUsedAt: new Date(), // Invalidate token - one-time use
        updatedAt: new Date()
      };

      await db.collection('purchase_orders').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      // Notify PM/OWNER
      const poCreator = await db.collection('users').findOne({
        _id: purchaseOrder.createdBy,
        status: 'active'
      });

      if (poCreator) {
        try {
          const formattedReason = rejectionReason ? formatRejectionReason(rejectionReason, rejectionSubcategory) : 'No category specified';
          const retryInfo = retryabilityAssessment.retryable ? 
            ` (Retryable: ${retryabilityAssessment.recommendation})` : 
            ' (Not retryable)';
        
          await sendPushToUser({
            userId: poCreator._id.toString(),
            title: 'Purchase Order Rejected',
            message: `${purchaseOrder.supplierName} rejected PO ${purchaseOrder.purchaseOrderNumber}. Reason: ${formattedReason}${retryInfo}`,
            data: {
              url: `/purchase-orders/${id}`,
              purchaseOrderId: id,
              rejectionReason,
              rejectionSubcategory,
              isRetryable: retryabilityAssessment.retryable,
              retryRecommendation: retryabilityAssessment.recommendation,
            }
          });
        } catch (pushError) {
          console.error('Push notification failed:', pushError);
        }
      }

      // Create audit log
      await createAuditLog({
        userId: null,
        action: 'REJECTED',
        entityType: 'PURCHASE_ORDER',
        entityId: id,
        projectId: purchaseOrder.projectId.toString(),
        changes: {
          before: purchaseOrder,
          after: { ...purchaseOrder, ...updateData },
          confirmationMethod: 'token_link'
        }
      });

      // Mark order as needing reassignment if retryable
      if (retryabilityAssessment.retryable) {
        await db.collection('purchase_orders').updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              needsReassignment: true,
              reassignmentSuggestedAt: new Date(),
              updatedAt: new Date()
            }
          }
        );
      }

      return successResponse({
        orderId: id,
        status: 'order_rejected',
        isRetryable: retryabilityAssessment.retryable,
        needsReassignment: retryabilityAssessment.retryable
      }, 'Purchase order rejected');
    } else if (action === 'modify') {
      // Update order with modifications (requires PM/OWNER approval)
      const modifications = {
        ...(quantityOrdered && { quantityOrdered: parseFloat(quantityOrdered) }),
        ...(finalUnitCost !== undefined && { unitCost: parseFloat(finalUnitCost) }),
        ...(deliveryDate && { deliveryDate: new Date(deliveryDate) }),
        ...(notes && { notes: notes.trim() })
      };

      // Calculate new total if cost changed
      let newTotalCost = purchaseOrder.totalCost;
      const newQuantity = modifications.quantityOrdered || purchaseOrder.quantityOrdered;
      const newUnitCost = modifications.unitCost || purchaseOrder.unitCost;
      newTotalCost = newQuantity * newUnitCost;

      const updateData = {
        status: 'order_modified',
        supplierResponse: 'modify',
        supplierResponseDate: new Date(),
        supplierNotes: notes?.trim() || null,
        supplierModifications: modifications,
        modificationApproved: false,
        unitCost: newUnitCost,
        quantityOrdered: newQuantity,
        totalCost: newTotalCost,
        ...(modifications.deliveryDate && { deliveryDate: modifications.deliveryDate }),
        responseTokenUsedAt: new Date(), // Invalidate token - one-time use
        updatedAt: new Date()
      };

      await db.collection('purchase_orders').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      // Notify PM/OWNER
      const poCreator = await db.collection('users').findOne({
        _id: purchaseOrder.createdBy,
        status: 'active'
      });

      if (poCreator) {
        try {
          await sendPushToUser({
            userId: poCreator._id.toString(),
            title: 'Purchase Order Modification Request',
            message: `${purchaseOrder.supplierName} requested modifications to PO ${purchaseOrder.purchaseOrderNumber}`,
            data: {
              url: `/purchase-orders/${id}`,
              purchaseOrderId: id
            }
          });
        } catch (pushError) {
          console.error('Push notification failed:', pushError);
        }
      }

      // Create audit log
      await createAuditLog({
        userId: null,
        action: 'MODIFIED',
        entityType: 'PURCHASE_ORDER',
        entityId: id,
        projectId: purchaseOrder.projectId.toString(),
        changes: {
          before: purchaseOrder,
          after: { ...purchaseOrder, ...updateData },
          confirmationMethod: 'token_link'
        }
      });

      return successResponse({
        orderId: id,
        status: 'order_modified',
        note: 'Modification request submitted. PM/OWNER will review and approve or reject.'
      }, 'Purchase order modification requested');
    }
  } catch (error) {
    console.error('Process response error:', error);
    return errorResponse('Failed to process supplier response', 500);
  }
}

/**
 * Handle partial response for bulk orders (material-level responses)
 */
async function handlePartialResponse({ db, purchaseOrder, id, token, materialResponses, supplierNotes, poCreator }) {
  try {
    console.log('[PO Response] Processing partial response for bulk order');
    
    // Validate that this is a bulk order
    if (!purchaseOrder.isBulkOrder || !purchaseOrder.supportsPartialResponse) {
      return errorResponse('Partial responses are only supported for bulk orders', 400);
    }

    if (!purchaseOrder.materials || !Array.isArray(purchaseOrder.materials) || purchaseOrder.materials.length === 0) {
      return errorResponse('Bulk order has no materials', 400);
    }

    // Process each material response
    const processedResponses = [];
    const acceptedMaterials = [];
    const rejectedMaterials = [];
    const modifiedMaterials = [];
    let totalAcceptedCost = 0;
    let totalRejectedCost = 0;

    for (const materialResponse of materialResponses) {
      const materialRequestId = new ObjectId(materialResponse.materialRequestId);
      const material = purchaseOrder.materials.find(
        m => (m.materialRequestId?.toString() === materialResponse.materialRequestId) ||
             (m._id?.toString() === materialResponse.materialRequestId)
      );

      if (!material) {
        console.warn(`[PO Response] Material not found: ${materialResponse.materialRequestId}`);
        continue;
      }

      const quantity = material.quantity || material.quantityNeeded || 0;
      const unitCost = material.unitCost || 0;
      const materialTotalCost = quantity * unitCost;

      const processedResponse = {
        materialRequestId: materialResponse.materialRequestId,
        action: materialResponse.action,
        status: materialResponse.action, // 'accept', 'reject', 'modify'
        notes: materialResponse.notes || '',
        rejectionReason: materialResponse.rejectionReason || null,
        rejectionSubcategory: materialResponse.rejectionSubcategory || null,
        modifications: materialResponse.modifications || null,
        respondedAt: new Date()
      };

      processedResponses.push(processedResponse);

      if (materialResponse.action === 'accept') {
        acceptedMaterials.push(material);
        totalAcceptedCost += materialTotalCost;
      } else if (materialResponse.action === 'reject') {
        rejectedMaterials.push({ ...material, rejectionReason: materialResponse.rejectionReason });
        totalRejectedCost += materialTotalCost;
      } else if (materialResponse.action === 'modify') {
        modifiedMaterials.push({ ...material, modifications: materialResponse.modifications });
      }
    }

    // Determine overall order status
    let overallStatus = 'order_modified'; // Default for mixed responses
    let overallAction = 'modify';
    
    if (rejectedMaterials.length === 0 && modifiedMaterials.length === 0) {
      // All accepted
      overallStatus = 'order_accepted';
      overallAction = 'accept';
    } else if (acceptedMaterials.length === 0 && modifiedMaterials.length === 0) {
      // All rejected
      overallStatus = 'order_rejected';
      overallAction = 'reject';
    } else {
      // Mixed: some accepted, some rejected/modified
      overallStatus = 'order_partially_responded';
      overallAction = 'modify';
    }

    // Update purchase order with material responses
    const updateData = {
      status: overallStatus,
      supplierResponse: overallAction,
      supplierResponseDate: new Date(),
      supplierNotes: supplierNotes?.trim() || null,
      materialResponses: processedResponses,
      responseTokenUsedAt: new Date(),
      updatedAt: new Date()
    };

    // If all accepted, commit financially
    if (overallStatus === 'order_accepted') {
      updateData.financialStatus = 'committed';
      updateData.committedAt = new Date();
      
      // Validate capital availability
      const capitalValidation = await validateCapitalAvailability(
        purchaseOrder.projectId.toString(),
        totalAcceptedCost
      );

      if (!capitalValidation.isValid) {
        return errorResponse(
          `Insufficient capital for accepted materials. Available: ${capitalValidation.available.toLocaleString()}, Required: ${totalAcceptedCost.toLocaleString()}`,
          400
        );
      }

      // Increase committedCost
      await updateCommittedCost(
        purchaseOrder.projectId.toString(),
        totalAcceptedCost,
        'add'
      );
    }

    await db.collection('purchase_orders').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Trigger financial recalculation
    await recalculateProjectFinances(purchaseOrder.projectId.toString());

    // Notify PM/OWNER
    if (poCreator) {
      try {
        const summary = [];
        if (acceptedMaterials.length > 0) summary.push(`${acceptedMaterials.length} accepted`);
        if (rejectedMaterials.length > 0) summary.push(`${rejectedMaterials.length} rejected`);
        if (modifiedMaterials.length > 0) summary.push(`${modifiedMaterials.length} modified`);
        
        await sendPushToUser({
          userId: poCreator._id.toString(),
          title: 'Purchase Order Partially Responded',
          message: `${purchaseOrder.supplierName} responded to PO ${purchaseOrder.purchaseOrderNumber}: ${summary.join(', ')}`,
          data: {
            url: `/purchase-orders/${id}`,
            purchaseOrderId: id,
            isPartialResponse: true,
            acceptedCount: acceptedMaterials.length,
            rejectedCount: rejectedMaterials.length,
            modifiedCount: modifiedMaterials.length
          }
        });
      } catch (pushError) {
        console.error('Push notification failed:', pushError);
      }
    }

    // Create audit log
    await createAuditLog({
      userId: null,
      action: 'PARTIALLY_RESPONDED',
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      projectId: purchaseOrder.projectId.toString(),
      changes: {
        before: purchaseOrder,
        after: { ...purchaseOrder, ...updateData },
        confirmationMethod: 'token_link',
        materialResponses: processedResponses,
        acceptedCount: acceptedMaterials.length,
        rejectedCount: rejectedMaterials.length,
        modifiedCount: modifiedMaterials.length
      }
    });

    // Create separate POs for rejected materials if any
    const createdReassignmentPOs = [];
    if (rejectedMaterials.length > 0 && poCreator) {
      try {
        // Get batch information
        let batch = null;
        if (purchaseOrder.batchId) {
          batch = await db.collection('material_request_batches').findOne({
            _id: purchaseOrder.batchId,
            deletedAt: null
          });
        }

        // Group rejected materials by supplier (if we want to batch reassignments)
        // For now, mark them for manual reassignment
        for (const rejectedMaterial of rejectedMaterials) {
          const materialRequestId = rejectedMaterial.materialRequestId || rejectedMaterial._id;
          
          // Mark material request as needing reassignment
          await db.collection('material_requests').updateOne(
            { _id: new ObjectId(materialRequestId) },
            {
              $set: {
                needsReassignment: true,
                reassignmentReason: rejectedMaterial.rejectionReason || 'Material rejected by supplier',
                reassignmentSuggestedAt: new Date(),
                updatedAt: new Date()
              }
            }
          );

          // Create audit log for material request
          await createAuditLog({
            userId: null,
            action: 'NEEDS_REASSIGNMENT',
            entityType: 'MATERIAL_REQUEST',
            entityId: materialRequestId.toString(),
            projectId: purchaseOrder.projectId.toString(),
            changes: {
              reason: 'Material rejected in bulk order',
              originalPO: purchaseOrder.purchaseOrderNumber,
              rejectionReason: rejectedMaterial.rejectionReason
            }
          });
        }

        // Notify PM/OWNER about rejected materials needing reassignment
        if (poCreator) {
          try {
            await sendPushToUser({
              userId: poCreator._id.toString(),
              title: 'Materials Need Reassignment',
              message: `${rejectedMaterials.length} material(s) from PO ${purchaseOrder.purchaseOrderNumber} were rejected and need reassignment`,
              data: {
                url: `/purchase-orders/${id}`,
                purchaseOrderId: id,
                rejectedCount: rejectedMaterials.length
              }
            });
          } catch (pushError) {
            console.error('Push notification failed:', pushError);
          }
        }
      } catch (reassignmentError) {
        console.error('[PO Response] Error processing rejected materials for reassignment:', reassignmentError);
        // Don't fail the whole response if reassignment processing fails
      }
    }

    return successResponse({
      orderId: id,
      status: overallStatus,
      materialResponses: processedResponses,
      acceptedCount: acceptedMaterials.length,
      rejectedCount: rejectedMaterials.length,
      modifiedCount: modifiedMaterials.length,
      rejectedMaterialsNeedReassignment: rejectedMaterials.length > 0,
      createdReassignmentPOs: createdReassignmentPOs.length,
      note: rejectedMaterials.length > 0 
        ? `${rejectedMaterials.length} material(s) rejected and marked for reassignment. Please create new purchase orders for these materials.`
        : 'Partial response processed successfully.'
    }, 'Partial response processed successfully');
  } catch (error) {
    console.error('[PO Response] Error processing partial response:', error);
    throw error;
  }
}

