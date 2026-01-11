/**
 * Equipment Detail API Route
 * GET: Get single equipment
 * PATCH: Update equipment (PM, OWNER only)
 * DELETE: Soft delete equipment (OWNER only)
 * 
 * GET /api/equipment/[id]
 * PATCH /api/equipment/[id]
 * DELETE /api/equipment/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateEquipment, EQUIPMENT_TYPES, EQUIPMENT_STATUSES, ACQUISITION_TYPES, calculateEquipmentCost } from '@/lib/schemas/equipment-schema';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';
import { recalculateEquipmentCost, updateEquipmentUtilization } from '@/lib/equipment-helpers';

/**
 * GET /api/equipment/[id]
 * Returns a single equipment by ID
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
      return errorResponse('Invalid equipment ID', 400);
    }

    const db = await getDatabase();
    const equipment = await db.collection('equipment').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!equipment) {
      return errorResponse('Equipment not found', 404);
    }

    return successResponse(equipment, 'Equipment retrieved successfully');
  } catch (error) {
    console.error('Get equipment error:', error);
    return errorResponse('Failed to retrieve equipment', 500);
  }
}

/**
 * PATCH /api/equipment/[id]
 * Updates equipment details, status, dates, or utilization
 * Auth: PM, OWNER only
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const hasEditPermission = await hasPermission(user.id, 'edit_equipment');
    if (!hasEditPermission) {
      // Fallback to role check for backward compatibility and safety
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['owner', 'pm', 'project_manager'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse('Insufficient permissions. Only PM and OWNER can edit equipment.', 403);
      }
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid equipment ID', 400);
    }

    const body = await request.json();
    const {
      equipmentName,
      equipmentType,
      acquisitionType,
      supplierId,
      startDate,
      endDate,
      dailyRate,
      status,
      notes,
      actualHours,
      estimatedHours
    } = body;

    const db = await getDatabase();

    // Get existing equipment
    const existingEquipment = await db.collection('equipment').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!existingEquipment) {
      return errorResponse('Equipment not found', 404);
    }

    // Build update object
    const updateData = {
      updatedAt: new Date()
    };

    if (equipmentName !== undefined) {
      if (!equipmentName || equipmentName.trim().length < 2) {
        return errorResponse('Equipment name cannot be empty and must be at least 2 characters', 400);
      }
      updateData.equipmentName = equipmentName.trim();
    }

    if (equipmentType !== undefined) {
      if (!EQUIPMENT_TYPES.includes(equipmentType)) {
        return errorResponse(`Invalid equipment type. Must be one of: ${EQUIPMENT_TYPES.join(', ')}`, 400);
      }
      updateData.equipmentType = equipmentType;
    }

    if (acquisitionType !== undefined) {
      if (!ACQUISITION_TYPES.includes(acquisitionType)) {
        return errorResponse(`Invalid acquisition type. Must be one of: ${ACQUISITION_TYPES.join(', ')}`, 400);
      }
      updateData.acquisitionType = acquisitionType;
    }

    if (supplierId !== undefined) {
      if (supplierId === null || supplierId === '') {
        updateData.supplierId = null;
      } else if (ObjectId.isValid(supplierId)) {
        // Verify supplier exists
        const supplier = await db.collection('suppliers').findOne({
          _id: new ObjectId(supplierId),
          deletedAt: null
        });
        if (!supplier) {
          return errorResponse('Supplier not found', 400);
        }
        updateData.supplierId = new ObjectId(supplierId);
      } else {
        return errorResponse('Invalid supplier ID format', 400);
      }
    }

    if (startDate !== undefined) {
      updateData.startDate = new Date(startDate);
      // Recalculate total cost if dates changed
      const newEndDate = endDate !== undefined ? new Date(endDate) : existingEquipment.endDate;
      const newDailyRate = dailyRate !== undefined ? parseFloat(dailyRate) : existingEquipment.dailyRate;
      updateData.totalCost = calculateEquipmentCost(updateData.startDate, newEndDate, newDailyRate);
    }

    if (endDate !== undefined) {
      if (endDate === null || endDate === '') {
        updateData.endDate = null;
      } else {
        updateData.endDate = new Date(endDate);
        // Validate end date is after start date
        const start = startDate ? new Date(startDate) : existingEquipment.startDate;
        if (updateData.endDate <= start) {
          return errorResponse('End date must be after start date', 400);
        }
        // Recalculate total cost
        const newStartDate = startDate !== undefined ? new Date(startDate) : existingEquipment.startDate;
        const newDailyRate = dailyRate !== undefined ? parseFloat(dailyRate) : existingEquipment.dailyRate;
        updateData.totalCost = calculateEquipmentCost(newStartDate, updateData.endDate, newDailyRate);
      }
    }

    if (dailyRate !== undefined) {
      if (isNaN(dailyRate) || dailyRate < 0) {
        return errorResponse('Daily rate must be >= 0', 400);
      }
      updateData.dailyRate = parseFloat(dailyRate);
      // Recalculate total cost
      const start = startDate !== undefined ? new Date(startDate) : existingEquipment.startDate;
      const end = endDate !== undefined ? (endDate ? new Date(endDate) : null) : existingEquipment.endDate;
      updateData.totalCost = calculateEquipmentCost(start, end, updateData.dailyRate);
    }

    if (status !== undefined) {
      if (!EQUIPMENT_STATUSES.includes(status)) {
        return errorResponse(`Invalid status. Must be one of: ${EQUIPMENT_STATUSES.join(', ')}`, 400);
      }
      updateData.status = status;
    }

    if (notes !== undefined) {
      updateData.notes = notes?.trim() || '';
    }

    // Handle utilization updates
    if (actualHours !== undefined || estimatedHours !== undefined) {
      const newActualHours = actualHours !== undefined ? parseFloat(actualHours) : (existingEquipment.utilization?.actualHours || 0);
      const newEstimatedHours = estimatedHours !== undefined ? parseFloat(estimatedHours) : (existingEquipment.utilization?.estimatedHours || 0);
      
      const utilizationPercentage = newEstimatedHours > 0 
        ? Math.min(100, (newActualHours / newEstimatedHours) * 100)
        : 0;
      
      updateData.utilization = {
        actualHours: newActualHours,
        estimatedHours: newEstimatedHours,
        utilizationPercentage: utilizationPercentage
      };
    }

    // Update equipment
    const result = await db.collection('equipment').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return errorResponse('Equipment not found', 404);
    }

    const updatedEquipment = result.value;

    // Recalculate phase spending if cost-related fields changed
    if (startDate !== undefined || endDate !== undefined || dailyRate !== undefined || status !== undefined) {
      try {
        await recalculatePhaseSpending(existingEquipment.phaseId.toString());
      } catch (phaseError) {
        console.error('Error recalculating phase spending after equipment update:', phaseError);
        // Don't fail the request, just log the error
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'EQUIPMENT',
      entityId: id,
      projectId: existingEquipment.projectId.toString(),
      changes: updateData,
    });

    return successResponse(updatedEquipment, 'Equipment updated successfully');
  } catch (error) {
    console.error('Update equipment error:', error);
    return errorResponse('Failed to update equipment', 500);
  }
}

/**
 * DELETE /api/equipment/[id]
 * Soft deletes an equipment assignment
 * Auth: OWNER only
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can delete
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    if (userRole !== 'owner') {
      return errorResponse('Insufficient permissions. Only OWNER can delete equipment.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid equipment ID', 400);
    }

    const db = await getDatabase();

    // Get existing equipment
    const existingEquipment = await db.collection('equipment').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!existingEquipment) {
      return errorResponse('Equipment not found', 404);
    }

    // Soft delete
    const result = await db.collection('equipment').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          deletedAt: new Date(),
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return errorResponse('Equipment not found', 404);
    }

    // Recalculate phase spending
    try {
      await recalculatePhaseSpending(existingEquipment.phaseId.toString());
    } catch (phaseError) {
      console.error('Error recalculating phase spending after equipment deletion:', phaseError);
      // Don't fail the request, just log the error
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'EQUIPMENT',
      entityId: id,
      projectId: existingEquipment.projectId.toString(),
      changes: { deleted: true },
    });

    return successResponse(result.value, 'Equipment deleted successfully');
  } catch (error) {
    console.error('Delete equipment error:', error);
    return errorResponse('Failed to delete equipment', 500);
  }
}


