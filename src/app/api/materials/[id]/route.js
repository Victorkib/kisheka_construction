/**
 * Material Detail API Route
 * GET: Get single material
 * PATCH: Update material (with restrictions)
 * DELETE: Soft delete material (OWNER only)
 * 
 * GET /api/materials/[id]
 * PATCH /api/materials/[id]
 * DELETE /api/materials/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { calculateTotalCost, calculateRemainingQuantity, calculateWastage } from '@/lib/calculations';
import { createAuditLog } from '@/lib/audit-log';
import { checkMaterialDiscrepancies, createDiscrepancyAlerts } from '@/lib/discrepancy-detection';
import { recalculateProjectFinances } from '@/lib/financial-helpers';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';
import { recalculateFloorSpending } from '@/lib/material-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/materials/[id]
 * Returns a single material by ID with full details
 * Auth: All authenticated users
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid material ID', 400);
    }

    const db = await getDatabase();
    const material = await db.collection('materials').findOne({
      _id: new ObjectId(id),
      deletedAt: null, // Exclude soft-deleted materials
    });

    if (!material) {
      return errorResponse('Material not found', 404);
    }

    // Populate category details if categoryId exists
    let categoryDetails = null;
    if (material.categoryId && ObjectId.isValid(material.categoryId)) {
      categoryDetails = await db.collection('categories').findOne({
        _id: material.categoryId,
      });
    } else if (material.category) {
      // Fallback: find category by name
      categoryDetails = await db.collection('categories').findOne({
        name: material.category,
      });
    }

    // Populate project details if projectId exists
    let projectDetails = null;
    if (material.projectId && ObjectId.isValid(material.projectId)) {
      projectDetails = await db.collection('projects').findOne({
        _id: material.projectId,
      });
    }

    // Populate floor details if floor exists
    let floorDetails = null;
    if (material.floor && ObjectId.isValid(material.floor)) {
      floorDetails = await db.collection('floors').findOne({
        _id: material.floor,
      });
    }

    // Get approval history from approvals collection
    const approvals = await db
      .collection('approvals')
      .find({
        relatedId: new ObjectId(id),
        relatedModel: 'MATERIAL',
      })
      .sort({ timestamp: -1 })
      .toArray();

    // Get audit logs for this material
    const auditLogs = await db
      .collection('audit_logs')
      .find({
        entityType: 'MATERIAL',
        entityId: new ObjectId(id),
      })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    return successResponse(
      {
        ...material,
        categoryDetails, // Populated category object
        projectDetails, // Populated project object
        floorDetails, // Populated floor object
        approvalHistory: approvals,
        activityLog: auditLogs,
      },
      'Material retrieved successfully'
    );
  } catch (error) {
    console.error('Get material error:', error);
    return errorResponse('Failed to retrieve material', 500);
  }
}

/**
 * PATCH /api/materials/[id]
 * Updates material (with restrictions based on status)
 * Auth: CLERK, PM (with restrictions), OWNER
 * Restrictions: Cannot edit after approved without PM/OWNER override
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasEditPermission = await hasPermission(user.id, 'edit_material');
    if (!hasEditPermission) {
      return errorResponse('Insufficient permissions. Only CLERK, PM, and OWNER can edit materials.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid material ID', 400);
    }

    const body = await request.json();
    const {
      quantityDelivered,
      quantityUsed,
      status,
      notes,
      description,
      unitCost,
      quantity,
      dateDelivered,
      dateUsed,
      receiptUrl,
      receiptFileUrl,
      invoiceFileUrl,
      deliveryNoteFileUrl,
      phaseId,
      // Finishing details (Module 3)
      finishingDetails,
    } = body;

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);

    // Get existing material
    const existingMaterial = await db.collection('materials').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingMaterial) {
      return errorResponse('Material not found', 404);
    }

    // Check if material can be edited
    const canEditStatuses = ['draft', 'pending_approval', 'rejected'];
    const userRole = userProfile?.role?.toLowerCase();
    const isOwnerOrPM = ['owner', 'pm', 'project_manager'].includes(userRole);

    if (!canEditStatuses.includes(existingMaterial.status) && !isOwnerOrPM) {
      return errorResponse(
        `Cannot edit material with status "${existingMaterial.status}". Only PM and OWNER can edit approved materials.`,
        400
      );
    }

    // Build update object and track changes
    const updateData = {
      updatedAt: new Date(),
    };
    const changes = {};

    if (quantityDelivered !== undefined) {
      const delivered = parseFloat(quantityDelivered) || 0;
      const purchased = existingMaterial.quantityPurchased || existingMaterial.quantity || 0;
      
      // Validation: Delivered cannot exceed purchased
      if (delivered > purchased) {
        return errorResponse(
          `Delivered quantity (${delivered}) cannot exceed purchased quantity (${purchased})`,
          400
        );
      }
      
      // Validation: Delivered cannot be negative
      if (delivered < 0) {
        return errorResponse('Delivered quantity cannot be negative', 400);
      }
      
      updateData.quantityDelivered = delivered;
      changes.quantityDelivered = {
        oldValue: existingMaterial.quantityDelivered,
        newValue: delivered,
      };

      // Recalculate remaining
      const used = existingMaterial.quantityUsed || 0;
      updateData.quantityRemaining = calculateRemainingQuantity(
        purchased,
        delivered,
        used
      );
    }

    if (quantityUsed !== undefined) {
      const used = parseFloat(quantityUsed) || 0;
      const delivered = updateData.quantityDelivered !== undefined
        ? updateData.quantityDelivered
        : existingMaterial.quantityDelivered || 0;
      const purchased = existingMaterial.quantityPurchased || existingMaterial.quantity || 0;
      
      // Validation: Used cannot exceed delivered
      if (used > delivered) {
        return errorResponse(
          `Used quantity (${used}) cannot exceed delivered quantity (${delivered})`,
          400
        );
      }
      
      // Validation: Used cannot be negative
      if (used < 0) {
        return errorResponse('Used quantity cannot be negative', 400);
      }
      
      updateData.quantityUsed = used;
      changes.quantityUsed = {
        oldValue: existingMaterial.quantityUsed,
        newValue: used,
      };

      // Recalculate remaining and wastage
      updateData.quantityRemaining = calculateRemainingQuantity(purchased, delivered, used);
      updateData.wastage = calculateWastage(purchased, delivered, used);
    }

    if (status && ['draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'received', 'archived'].includes(status)) {
      updateData.status = status;
      changes.status = {
        oldValue: existingMaterial.status,
        newValue: status,
      };
    }

    if (notes !== undefined) {
      updateData.notes = notes?.trim() || '';
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || '';
    }

    if (unitCost !== undefined) {
      const cost = parseFloat(unitCost) || 0;
      updateData.unitCost = cost;
      const qty = updateData.quantity || existingMaterial.quantity || existingMaterial.quantityPurchased;
      updateData.totalCost = calculateTotalCost(qty, cost);
      changes.unitCost = {
        oldValue: existingMaterial.unitCost,
        newValue: cost,
      };
    }

    if (quantity !== undefined) {
      const qty = parseFloat(quantity) || 0;
      updateData.quantity = qty;
      updateData.quantityPurchased = qty;
      const cost = updateData.unitCost || existingMaterial.unitCost;
      updateData.totalCost = calculateTotalCost(qty, cost);
      changes.quantity = {
        oldValue: existingMaterial.quantity || existingMaterial.quantityPurchased,
        newValue: qty,
      };
    }

    if (dateDelivered) {
      updateData.dateDelivered = new Date(dateDelivered);
    }

    if (dateUsed) {
      updateData.dateUsed = new Date(dateUsed);
    }

    if (receiptUrl || receiptFileUrl) {
      updateData.receiptUrl = receiptUrl || receiptFileUrl;
      updateData.receiptFileUrl = receiptUrl || receiptFileUrl;
      updateData.receiptUploadedAt = new Date();
    }

    if (invoiceFileUrl) {
      updateData.invoiceFileUrl = invoiceFileUrl;
    }

    if (deliveryNoteFileUrl) {
      updateData.deliveryNoteFileUrl = deliveryNoteFileUrl;
    }

    // Finishing details (Module 3) - update if provided
    if (finishingDetails !== undefined) {
      updateData.finishingDetails = finishingDetails;
      changes.finishingDetails = {
        oldValue: existingMaterial.finishingDetails || null,
        newValue: finishingDetails,
      };
    }

    // Handle phaseId update
    const oldPhaseId = existingMaterial.phaseId;
    if (phaseId !== undefined) {
      if (phaseId === null || phaseId === '') {
        updateData.phaseId = null;
        changes.phaseId = {
          oldValue: oldPhaseId,
          newValue: null,
        };
      } else if (ObjectId.isValid(phaseId)) {
        // Validate phase exists and belongs to same project
        const phase = await db.collection('phases').findOne({
          _id: new ObjectId(phaseId),
          deletedAt: null,
        });

        if (!phase) {
          return errorResponse(`Phase not found: ${phaseId}`, 404);
        }

        if (phase.projectId.toString() !== existingMaterial.projectId.toString()) {
          return errorResponse('Phase does not belong to the same project as the material', 400);
        }

        updateData.phaseId = new ObjectId(phaseId);
        changes.phaseId = {
          oldValue: oldPhaseId,
          newValue: phaseId,
        };
      } else {
        return errorResponse('Invalid phaseId format', 400);
      }
    }

    // Update material
    const result = await db.collection('materials').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    // Create audit log
    if (Object.keys(changes).length > 0) {
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'UPDATED',
        entityType: 'MATERIAL',
        entityId: id,
        projectId: existingMaterial.projectId?.toString(),
        changes,
      });
    }

    // Check for discrepancies if quantityDelivered or quantityUsed was updated
    // This runs asynchronously so it doesn't block the response
    if (
      (quantityDelivered !== undefined || quantityUsed !== undefined) &&
      result.value &&
      existingMaterial.projectId
    ) {
      // Run discrepancy check in background (don't await to avoid blocking response)
      Promise.resolve()
        .then(() => {
          const discrepancy = checkMaterialDiscrepancies(result.value);
          if (discrepancy && discrepancy.alerts.hasAnyAlert) {
            // Create alerts for this material
            return createDiscrepancyAlerts([discrepancy], existingMaterial.projectId.toString());
          }
          return 0;
        })
        .catch((error) => {
          console.error('Error checking discrepancies after material update:', error);
          // Don't throw - this is a background check
        });
    }

    // Recalculate project finances if cost changed
    if (updateData.totalCost !== undefined || updateData.status) {
      try {
        const projectIdStr = existingMaterial.projectId?.toString();
        if (projectIdStr) {
          await recalculateProjectFinances(projectIdStr);
        }
      } catch (error) {
        // Log error but don't fail the update
        console.error('Error recalculating project finances:', error);
      }
    }

    // Recalculate phase spending if phaseId changed
    if (phaseId !== undefined && oldPhaseId?.toString() !== updateData.phaseId?.toString()) {
      try {
        // Recalculate old phase if it exists
        if (oldPhaseId && ObjectId.isValid(oldPhaseId)) {
          await recalculatePhaseSpending(oldPhaseId.toString());
        }
        // Recalculate new phase if it exists
        if (updateData.phaseId && ObjectId.isValid(updateData.phaseId)) {
          await recalculatePhaseSpending(updateData.phaseId.toString());
        }
      } catch (error) {
        // Log error but don't fail the update
        console.error('Error recalculating phase spending:', error);
      }
    }

    // Recalculate phase spending if status changed and material is linked to a phase
    if (updateData.status !== undefined && updateData.status !== existingMaterial.status) {
      const currentPhaseId = updateData.phaseId || existingMaterial.phaseId;
      if (currentPhaseId && ObjectId.isValid(currentPhaseId)) {
        try {
          await recalculatePhaseSpending(currentPhaseId.toString());
        } catch (error) {
          // Log error but don't fail the update
          console.error('Error recalculating phase spending after status change:', error);
        }
      }
    }

    // Recalculate floor spending if floorId changed or cost/status changed
    const oldFloorId = existingMaterial.floor;
    const newFloorId = updateData.floor !== undefined ? updateData.floor : existingMaterial.floor;
    
    if (updateData.totalCost !== undefined || updateData.status !== undefined || 
        (oldFloorId?.toString() !== newFloorId?.toString())) {
      try {
        // Recalculate old floor if it exists and changed
        if (oldFloorId && ObjectId.isValid(oldFloorId) && oldFloorId.toString() !== newFloorId?.toString()) {
          await recalculateFloorSpending(oldFloorId.toString());
        }
        // Recalculate new floor if it exists
        if (newFloorId && ObjectId.isValid(newFloorId)) {
          await recalculateFloorSpending(newFloorId.toString());
        }
      } catch (error) {
        // Log error but don't fail the update
        console.error('Error recalculating floor spending:', error);
      }
    }

    return successResponse(result.value, 'Material updated successfully');
  } catch (error) {
    console.error('Update material error:', error);
    return errorResponse('Failed to update material', 500);
  }
}

/**
 * DELETE /api/materials/[id]
 * Permanently deletes a material with project finance recalculation
 * Auth: OWNER only
 * 
 * Query params:
 * - force: boolean - If true, bypasses cost check (use with caution)
 * 
 * Handles:
 * - Hard deletes material
 * - Recalculates project finances if material was approved/received and had cost
 * 
 * Note: For archiving (soft delete), use POST /api/materials/[id]/archive
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasDeletePermission = await hasPermission(user.id, 'delete_material');
    if (!hasDeletePermission) {
      return errorResponse('Insufficient permissions. Only OWNER can delete materials.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid material ID', 400);
    }

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // Get existing material
    const existingMaterial = await db.collection('materials').findOne({
      _id: new ObjectId(id),
    });

    if (!existingMaterial) {
      return errorResponse('Material not found', 404);
    }

    // Check if material is already archived
    if (existingMaterial.deletedAt) {
      return errorResponse('Material is already archived. Use restore endpoint to restore it first.', 400);
    }

    // Check if material has cost and force is not set, recommend archive
    const hasCost = existingMaterial.totalCost > 0;
    const isApproved = ['approved', 'received'].includes(existingMaterial.status);
    
    if (hasCost && isApproved && !force) {
      return errorResponse(
        {
          message: 'Material has cost and is approved. Archive recommended instead of permanent delete.',
          recommendation: 'archive',
          totalCost: existingMaterial.totalCost,
          status: existingMaterial.status,
        },
        `This material has a cost of KES ${existingMaterial.totalCost.toLocaleString()} and is ${existingMaterial.status}. We recommend archiving instead of permanently deleting to preserve records. Use POST /api/materials/${id}/archive to archive, or add ?force=true to proceed with permanent deletion.`,
        400
      );
    }

    // Delete Cloudinary assets before deleting database record
    try {
      const { deleteMaterialCloudinaryAssets } = await import('@/lib/cloudinary-cleanup');
      const cleanupResult = await deleteMaterialCloudinaryAssets(existingMaterial);
      console.log(`🗑️ Cloudinary cleanup for material ${id}: ${cleanupResult.success} deleted, ${cleanupResult.failed} failed`);
    } catch (cleanupError) {
      // Log error but don't fail the delete operation
      console.error(`⚠️ Error cleaning up Cloudinary assets for material ${id}:`, cleanupError);
    }

    // Hard delete material
    const result = await db.collection('materials').deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return errorResponse('Material not found or delete failed', 404);
    }

    // Recalculate project finances if material was approved/received and had cost
    // This ensures financial totals are accurate after deletion
    if (
      existingMaterial.projectId &&
      ObjectId.isValid(existingMaterial.projectId) &&
      isApproved &&
      hasCost
    ) {
      try {
        const projectIdStr = existingMaterial.projectId.toString();
        await recalculateProjectFinances(projectIdStr);
        console.log(`✅ Project finances recalculated after material deletion for project ${projectIdStr}`);
      } catch (error) {
        // Log error but don't fail the delete operation
        console.error(`❌ Error recalculating project finances after material deletion:`, error);
      }
    }

    // Recalculate phase spending if material had a phase
    if (existingMaterial.phaseId && ObjectId.isValid(existingMaterial.phaseId) && isApproved && hasCost) {
      try {
        await recalculatePhaseSpending(existingMaterial.phaseId.toString());
        console.log(`✅ Phase spending recalculated after material deletion for phase ${existingMaterial.phaseId}`);
      } catch (error) {
        // Log error but don't fail the delete operation
        console.error(`❌ Error recalculating phase spending after material deletion:`, error);
      }
    }

    // Recalculate floor spending if material had a floor
    if (existingMaterial.floor && ObjectId.isValid(existingMaterial.floor) && isApproved && hasCost) {
      try {
        await recalculateFloorSpending(existingMaterial.floor.toString());
        console.log(`✅ Floor spending recalculated after material deletion for floor ${existingMaterial.floor}`);
      } catch (error) {
        // Log error but don't fail the delete operation
        console.error(`❌ Error recalculating floor spending after material deletion:`, error);
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED_PERMANENTLY',
      entityType: 'MATERIAL',
      entityId: id,
      projectId: existingMaterial.projectId?.toString(),
      changes: {
        deletedAt: {
          oldValue: existingMaterial.deletedAt || null,
          newValue: new Date(),
        },
      },
    });

    let message = 'Material permanently deleted successfully.';
    if (isApproved && hasCost) {
      message += ' Project finances have been recalculated.';
    }

    return successResponse(
      {
        materialId: id,
        deleted: true,
        hadCost: hasCost,
        wasApproved: isApproved,
      },
      message
    );
  } catch (error) {
    console.error('Delete material error:', error);
    return errorResponse('Failed to delete material', 500);
  }
}

