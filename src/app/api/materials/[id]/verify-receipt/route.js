/**
 * Material Verify Receipt API Route
 * POST /api/materials/[id]/verify-receipt
 * CLERK verifies receipt of materials on site
 * Auth: CLERK, SUPERVISOR
 * 
 * Updates material status to 'received', sets receivedBy, and updates linked purchase order status
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotification, createNotifications } from '@/lib/notifications';
import { sendSMS, formatPhoneNumber, generateMaterialVerificationSMS, getSupplierLanguage } from '@/lib/sms-service';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/materials/[id]/verify-receipt
 * CLERK verifies receipt of materials on site
 * Auth: CLERK, SUPERVISOR
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - CLERK and SUPERVISOR can verify receipt
    const canVerify = await hasPermission(user.id, 'create_material') || await hasPermission(user.id, 'view_materials');
    if (!canVerify) {
      return errorResponse('Insufficient permissions. Only CLERK and SUPERVISOR can verify material receipt.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Check if user is CLERK or SUPERVISOR
    const userRole = userProfile.role?.toLowerCase();
    const allowedRoles = ['clerk', 'site_clerk', 'supervisor'];
    if (!allowedRoles.includes(userRole)) {
      return errorResponse('Only CLERK and SUPERVISOR can verify material receipt.', 403);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid material ID', 400);
    }

    const body = await request.json();
    const { actualQuantityReceived, notes, hasIssue = false, issueType = null, issueDescription = null } = body || {};

    const db = await getDatabase();

    // Get existing material
    const existingMaterial = await db.collection('materials').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingMaterial) {
      return errorResponse('Material not found', 404);
    }

    // Check if material can be verified (must be approved or pending_receipt)
    const verifiableStatuses = ['approved', 'pending_receipt'];
    if (!verifiableStatuses.includes(existingMaterial.status)) {
      return errorResponse(
        `Cannot verify receipt for material with status "${existingMaterial.status}". Material must be approved or pending receipt.`,
        400
      );
    }

    // Build update data
    const updateData = {
      status: 'received',
      receivedBy: {
        userId: new ObjectId(userProfile._id),
        name: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
        email: userProfile.email,
        verifiedAt: new Date(),
      },
      dateDelivered: existingMaterial.dateDelivered || new Date(),
      updatedAt: new Date(),
    };

    // If actual quantity received is provided and differs from delivered, update it
    let quantityIssue = false;
    let quantityIssueDescription = null;
    
    if (actualQuantityReceived !== undefined && actualQuantityReceived !== null) {
      const actualQty = parseFloat(actualQuantityReceived);
      const purchased = existingMaterial.quantityPurchased || existingMaterial.quantity || 0;
      const delivered = existingMaterial.quantityDelivered || purchased;
      
      if (actualQty < 0) {
        return errorResponse('Actual quantity received cannot be negative', 400);
      }
      
      if (actualQty > purchased) {
        return errorResponse(
          `Actual quantity received (${actualQty}) cannot exceed purchased quantity (${purchased})`,
          400
        );
      }

      updateData.quantityDelivered = actualQty;
      updateData.quantityRemaining = actualQty - (existingMaterial.quantityUsed || 0);
      
      // Check for quantity discrepancy
      if (Math.abs(actualQty - delivered) > 0.01) { // Allow small floating point differences
        quantityIssue = true;
        const difference = actualQty - delivered;
        if (difference < 0) {
          quantityIssueDescription = `Shortage: Expected ${delivered}, received ${actualQty} (${Math.abs(difference)} ${existingMaterial.unit || 'units'} missing)`;
        } else {
          quantityIssueDescription = `Excess: Expected ${delivered}, received ${actualQty} (${difference} ${existingMaterial.unit || 'units'} extra)`;
        }
      }
    }

    if (notes) {
      updateData.notes = `${existingMaterial.notes || ''}\n[Receipt Verification: ${notes.trim()}]`.trim();
    }

    // Update material
    const result = await db.collection('materials').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    const updatedMaterial = result.value;

    // If material is linked to a purchase order, update order status to 'delivered'
    if (existingMaterial.purchaseOrderId) {
      const purchaseOrder = await db.collection('purchase_orders').findOne({
        _id: existingMaterial.purchaseOrderId,
        deletedAt: null,
      });

      if (purchaseOrder && purchaseOrder.status !== 'delivered') {
        await db.collection('purchase_orders').updateOne(
          { _id: existingMaterial.purchaseOrderId },
          {
            $set: {
              status: 'delivered',
              updatedAt: new Date(),
            },
          }
        );

        // Create notification for PM/OWNER
        const managers = await db.collection('users').find({
          role: { $in: ['pm', 'project_manager', 'owner'] },
          status: 'active',
        }).toArray();

        if (managers.length > 0) {
          const notifications = managers.map(manager => ({
            userId: manager._id.toString(),
            type: 'item_received',
            title: 'Material Received on Site',
            message: `${existingMaterial.name || existingMaterial.materialName} has been verified as received on site by ${userProfile.firstName || userProfile.email}. Purchase order ${purchaseOrder.purchaseOrderNumber} marked as delivered.`,
            projectId: existingMaterial.projectId?.toString(),
            relatedModel: 'MATERIAL',
            relatedId: id,
            createdBy: userProfile._id.toString(),
          }));

          await createNotifications(notifications);
        }
      }
    }

    // Send SMS to supplier if there's a verification issue
    if (hasIssue || quantityIssue) {
      // Get purchase order and supplier information
      if (existingMaterial.purchaseOrderId) {
        const purchaseOrder = await db.collection('purchase_orders').findOne({
          _id: existingMaterial.purchaseOrderId,
          deletedAt: null,
        });

        if (purchaseOrder && purchaseOrder.supplierId) {
          const supplier = await db.collection('suppliers').findOne({
            _id: purchaseOrder.supplierId,
            status: 'active',
            deletedAt: null,
          });

          if (supplier && supplier.smsEnabled && supplier.phone) {
            try {
              const formattedPhone = formatPhoneNumber(supplier.phone);
              const verificationIssueType = issueType || (quantityIssue ? 'quantity' : 'other');
              const verificationIssueDescription = issueDescription || quantityIssueDescription || 'Material verification issue detected';
              const expectedQty = existingMaterial.quantityDelivered || existingMaterial.quantityPurchased || existingMaterial.quantity;
              const actualQty = actualQuantityReceived !== undefined && actualQuantityReceived !== null 
                ? parseFloat(actualQuantityReceived) 
                : null;

              const verificationSMS = generateMaterialVerificationSMS({
                purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
                materialName: existingMaterial.name || existingMaterial.materialName,
                issueType: verificationIssueType,
                issueDescription: verificationIssueDescription,
                expectedQuantity: expectedQty,
                actualQuantity: actualQty,
                actionRequired: 'Please contact us to resolve this issue',
                contactPhone: null, // Could add PM/OWNER contact
                supplier: supplier
              });

              await sendSMS({
                to: formattedPhone,
                message: verificationSMS,
              });

              console.log(`[Verify Receipt] Verification issue SMS sent to ${formattedPhone} for ${purchaseOrder.purchaseOrderNumber}`);
            } catch (smsError) {
              console.error('[Verify Receipt] Failed to send verification issue SMS:', smsError);
              // Don't fail the verification if SMS fails
            }
          }
        }
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'VERIFIED_RECEIPT',
      entityType: 'MATERIAL',
      entityId: id,
      projectId: existingMaterial.projectId?.toString(),
      changes: {
        before: existingMaterial,
        after: updatedMaterial,
        verifiedBy: {
          userId: userProfile._id.toString(),
          name: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
        },
        hasIssue: hasIssue || quantityIssue,
        issueType: issueType || (quantityIssue ? 'quantity' : null),
        issueDescription: issueDescription || quantityIssueDescription,
      },
    });

    return successResponse(
      {
        material: updatedMaterial,
        purchaseOrderUpdated: !!existingMaterial.purchaseOrderId,
        issueReported: hasIssue || quantityIssue,
      },
      'Material receipt verified successfully' + (hasIssue || quantityIssue ? ' (issue reported to supplier)' : '')
    );
  } catch (error) {
    console.error('Verify receipt error:', error);
    return errorResponse('Failed to verify material receipt', 500);
  }
}



























