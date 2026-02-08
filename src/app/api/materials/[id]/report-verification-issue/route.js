/**
 * Material Report Verification Issue API Route
 * POST /api/materials/[id]/report-verification-issue
 * Report a verification issue with delivered materials
 * Auth: CLERK, SUPERVISOR, PM, OWNER
 * 
 * Sends SMS to supplier about verification issues (quantity, quality, specification, damage, etc.)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { sendSMS, formatPhoneNumber, generateMaterialVerificationSMS } from '@/lib/sms-service';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/materials/[id]/report-verification-issue
 * Report a verification issue with delivered materials
 * Auth: CLERK, SUPERVISOR, PM, OWNER
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

    // Check permission
    const canReport = await hasPermission(user.id, 'create_material') || 
                      await hasPermission(user.id, 'view_materials') ||
                      await hasPermission(user.id, 'manage_materials');
    if (!canReport) {
      return errorResponse('Insufficient permissions to report verification issues.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid material ID', 400);
    }

    const body = await request.json();
    const { 
      issueType, // 'quantity', 'quality', 'specification', 'damage', 'missing', 'other'
      issueDescription,
      expectedQuantity = null,
      actualQuantity = null,
      actionRequired = null,
      contactPhone = null
    } = body || {};

    if (!issueType) {
      return errorResponse('Issue type is required', 400);
    }

    if (!issueDescription || !issueDescription.trim()) {
      return errorResponse('Issue description is required', 400);
    }

    const validIssueTypes = ['quantity', 'quality', 'specification', 'damage', 'missing', 'other'];
    if (!validIssueTypes.includes(issueType)) {
      return errorResponse(`Invalid issue type. Must be one of: ${validIssueTypes.join(', ')}`, 400);
    }

    const db = await getDatabase();

    // Get existing material
    const material = await db.collection('materials').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!material) {
      return errorResponse('Material not found', 404);
    }

    // Get purchase order and supplier information
    let purchaseOrder = null;
    let supplier = null;

    if (material.purchaseOrderId) {
      purchaseOrder = await db.collection('purchase_orders').findOne({
        _id: material.purchaseOrderId,
        deletedAt: null,
      });

      if (purchaseOrder && purchaseOrder.supplierId) {
        supplier = await db.collection('suppliers').findOne({
          _id: purchaseOrder.supplierId,
          status: 'active',
          deletedAt: null,
        });
      }
    }

    if (!supplier) {
      return errorResponse('Supplier not found for this material', 404);
    }

    // Send SMS to supplier
    let smsSent = false;
    let smsError = null;

    if (supplier.smsEnabled && supplier.phone) {
      try {
        const formattedPhone = formatPhoneNumber(supplier.phone);
        const expectedQty = expectedQuantity !== null 
          ? expectedQuantity 
          : (material.quantityDelivered || material.quantityPurchased || material.quantity);
        const actualQty = actualQuantity !== null ? actualQuantity : null;

        const verificationSMS = generateMaterialVerificationSMS({
          purchaseOrderNumber: purchaseOrder?.purchaseOrderNumber || 'N/A',
          materialName: material.name || material.materialName,
          issueType: issueType,
          issueDescription: issueDescription.trim(),
          expectedQuantity: expectedQty,
          actualQuantity: actualQty,
          actionRequired: actionRequired || 'Please contact us to resolve this issue',
          contactPhone: contactPhone,
          supplier: supplier
        });

        await sendSMS({
          to: formattedPhone,
          message: verificationSMS,
        });

        smsSent = true;
        console.log(`[Report Verification Issue] SMS sent to ${formattedPhone} for material ${id}`);
      } catch (error) {
        console.error('[Report Verification Issue] Failed to send SMS:', error);
        smsError = error.message;
        // Continue even if SMS fails
      }
    }

    // Update material notes with issue report
    const issueNote = `[Verification Issue - ${new Date().toISOString()}]\nType: ${issueType}\nDescription: ${issueDescription}\nReported by: ${userProfile.firstName || userProfile.email}`;
    const updatedNotes = material.notes 
      ? `${material.notes}\n\n${issueNote}`
      : issueNote;

    await db.collection('materials').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          notes: updatedNotes,
          updatedAt: new Date(),
        },
        $push: {
          verificationIssues: {
            issueType,
            issueDescription: issueDescription.trim(),
            expectedQuantity,
            actualQuantity,
            actionRequired,
            reportedBy: {
              userId: new ObjectId(userProfile._id),
              name: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
              email: userProfile.email,
            },
            reportedAt: new Date(),
            smsSent,
            smsError,
          },
        },
      }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'REPORTED_VERIFICATION_ISSUE',
      entityType: 'MATERIAL',
      entityId: id,
      projectId: material.projectId?.toString(),
      changes: {
        issueType,
        issueDescription: issueDescription.trim(),
        expectedQuantity,
        actualQuantity,
        smsSent,
      },
    });

    // Create notification for PM/OWNER
    const managers = await db.collection('users').find({
      role: { $in: ['pm', 'project_manager', 'owner'] },
      status: 'active',
    }).toArray();

    if (managers.length > 0) {
      const notifications = managers.map(manager => ({
        userId: manager._id.toString(),
        type: 'material_verification_issue',
        title: 'Material Verification Issue Reported',
        message: `Verification issue reported for ${material.name || material.materialName} (${issueType}). Supplier has been notified.`,
        projectId: material.projectId?.toString(),
        relatedModel: 'MATERIAL',
        relatedId: id,
        createdBy: userProfile._id.toString(),
      }));

      const { createNotifications } = await import('@/lib/notifications');
      await createNotifications(notifications);
    }

    return successResponse(
      {
        materialId: id,
        issueType,
        smsSent,
        smsError,
      },
      'Verification issue reported successfully' + (smsSent ? ' and supplier notified' : '')
    );
  } catch (error) {
    console.error('Report verification issue error:', error);
    return errorResponse('Failed to report verification issue', 500);
  }
}

