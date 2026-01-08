/**
 * Material Request Detail API Route
 * GET: Get single material request
 * PATCH: Update material request
 * DELETE: Soft delete material request
 * 
 * GET /api/material-requests/[id]
 * PATCH /api/material-requests/[id]
 * DELETE /api/material-requests/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { VALID_REQUEST_STATUSES } from '@/lib/schemas/material-request-schema';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/material-requests/[id]
 * Get single material request by ID
 * Auth: CLERK, PM, OWNER, SUPERVISOR, ACCOUNTANT
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canView = await hasPermission(user.id, 'view_material_requests');
    if (!canView) {
      return errorResponse('Insufficient permissions to view material requests', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid request ID', 400);
    }

    const db = await getDatabase();

    const materialRequest = await db.collection('material_requests').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!materialRequest) {
      return errorResponse('Material request not found', 404);
    }

    // Role-based access check
    const userRole = userProfile.role?.toLowerCase();
    if (userRole === 'clerk' || userRole === 'supervisor') {
      // CLERK/SUPERVISOR can only see their own requests
      if (materialRequest.requestedBy.toString() !== userProfile._id.toString()) {
        return errorResponse('Insufficient permissions to view this request', 403);
      }
    }

    // Populate related data
    const project = await db.collection('projects').findOne({
      _id: materialRequest.projectId,
    });

    const requester = await db.collection('users').findOne({
      _id: materialRequest.requestedBy,
    });

    let approver = null;
    if (materialRequest.approvedBy) {
      approver = await db.collection('users').findOne({
        _id: materialRequest.approvedBy,
      });
    }

    let purchaseOrder = null;
    if (materialRequest.linkedPurchaseOrderId) {
      purchaseOrder = await db.collection('purchase_orders').findOne({
        _id: materialRequest.linkedPurchaseOrderId,
      });
    }

    return successResponse({
      ...materialRequest,
      project: project ? {
        _id: project._id.toString(),
        projectCode: project.projectCode,
        projectName: project.projectName,
      } : null,
      requester: requester ? {
        _id: requester._id.toString(),
        name: `${requester.firstName || ''} ${requester.lastName || ''}`.trim() || requester.email,
        email: requester.email,
      } : null,
      approver: approver ? {
        _id: approver._id.toString(),
        name: `${approver.firstName || ''} ${approver.lastName || ''}`.trim() || approver.email,
        email: approver.email,
      } : null,
      purchaseOrder: purchaseOrder ? {
        _id: purchaseOrder._id.toString(),
        purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
        status: purchaseOrder.status,
      } : null,
    });
  } catch (error) {
    console.error('Get material request error:', error);
    return errorResponse('Failed to retrieve material request', 500);
  }
}

/**
 * PATCH /api/material-requests/[id]
 * Update material request (only if status allows)
 * Auth: CLERK, PM, OWNER, SUPERVISOR (only their own requests)
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canEdit = await hasPermission(user.id, 'edit_material_request');
    if (!canEdit) {
      return errorResponse('Insufficient permissions to edit material requests', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid request ID', 400);
    }

    const body = await request.json();
    const db = await getDatabase();

    // Get existing request
    const existingRequest = await db.collection('material_requests').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingRequest) {
      return errorResponse('Material request not found', 404);
    }

    // Check if status allows editing
    const editableStatuses = ['requested', 'pending_approval'];
    if (!editableStatuses.includes(existingRequest.status)) {
      return errorResponse(`Cannot edit request with status: ${existingRequest.status}`, 400);
    }

    // Role-based access check
    const userRole = userProfile.role?.toLowerCase();
    if (userRole === 'clerk' || userRole === 'supervisor') {
      // CLERK/SUPERVISOR can only edit their own requests
      if (existingRequest.requestedBy.toString() !== userProfile._id.toString()) {
        return errorResponse('Insufficient permissions to edit this request', 403);
      }
    }

    // Build update object (only allow updating certain fields)
    const allowedFields = [
      'materialName',
      'description',
      'quantityNeeded',
      'unit',
      'urgency',
      'estimatedCost',
      'estimatedUnitCost',
      'reason',
      'notes',
      'floorId',
      'categoryId',
      'category',
    ];

    const updateData = {
      updatedAt: new Date(),
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'floorId' && body[field] && ObjectId.isValid(body[field])) {
          updateData[field] = new ObjectId(body[field]);
        } else if (field === 'categoryId' && body[field] && ObjectId.isValid(body[field])) {
          updateData[field] = new ObjectId(body[field]);
        } else if (field === 'materialName' || field === 'description' || field === 'reason' || field === 'notes' || field === 'category') {
          updateData[field] = body[field]?.trim() || '';
        } else if (field === 'quantityNeeded' || field === 'estimatedCost' || field === 'estimatedUnitCost') {
          updateData[field] = parseFloat(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // Validate urgency if provided
    if (updateData.urgency && !['low', 'medium', 'high', 'critical'].includes(updateData.urgency)) {
      return errorResponse('Invalid urgency level', 400);
    }

    // Phase Budget Validation: Check if updated estimated cost fits within phase material budget
    const phaseId = existingRequest.phaseId;
    const newEstimatedCost = updateData.estimatedCost !== undefined ? updateData.estimatedCost : existingRequest.estimatedCost;
    
    if (phaseId && newEstimatedCost && newEstimatedCost > 0) {
      const { validatePhaseMaterialBudget } = await import('@/lib/phase-helpers');
      const budgetValidation = await validatePhaseMaterialBudget(phaseId.toString(), newEstimatedCost, id);
      
      if (!budgetValidation.isValid) {
        return errorResponse(
          `Phase material budget exceeded. ${budgetValidation.message}. ` +
          `Phase material budget: ${budgetValidation.materialBudget.toLocaleString()}, ` +
          `Available: ${budgetValidation.available.toLocaleString()}, ` +
          `Required: ${budgetValidation.required.toLocaleString()}`,
          400
        );
      }
    }

    // Update request
    await db.collection('material_requests').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Get updated request
    const updatedRequest = await db.collection('material_requests').findOne({
      _id: new ObjectId(id),
    });

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'MATERIAL_REQUEST',
      entityId: id,
      projectId: existingRequest.projectId.toString(),
      changes: { before: existingRequest, after: updatedRequest },
    });

    return successResponse(updatedRequest, 'Material request updated successfully');
  } catch (error) {
    console.error('Update material request error:', error);
    return errorResponse('Failed to update material request', 500);
  }
}

/**
 * DELETE /api/material-requests/[id]
 * Soft delete material request (only if status allows)
 * Auth: PM, OWNER
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canDelete = await hasPermission(user.id, 'delete_material_request');
    if (!canDelete) {
      return errorResponse('Insufficient permissions to delete material requests', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid request ID', 400);
    }

    const db = await getDatabase();

    // Get existing request
    const existingRequest = await db.collection('material_requests').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingRequest) {
      return errorResponse('Material request not found', 404);
    }

    // Check if status allows deletion
    const deletableStatuses = ['requested', 'pending_approval', 'rejected', 'cancelled'];
    if (!deletableStatuses.includes(existingRequest.status)) {
      return errorResponse(`Cannot delete request with status: ${existingRequest.status}`, 400);
    }

    // Check if linked to purchase order
    if (existingRequest.linkedPurchaseOrderId) {
      return errorResponse('Cannot delete request that has been converted to purchase order', 400);
    }

    // Soft delete
    await db.collection('material_requests').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'MATERIAL_REQUEST',
      entityId: id,
      projectId: existingRequest.projectId.toString(),
      changes: { deleted: existingRequest },
    });

    return successResponse(null, 'Material request deleted successfully');
  } catch (error) {
    console.error('Delete material request error:', error);
    return errorResponse('Failed to delete material request', 500);
  }
}

