/**
 * Work Item Detail API Route
 * GET: Get single work item
 * PATCH: Update work item (PM, OWNER only)
 * DELETE: Soft delete work item (OWNER only)
 * 
 * GET /api/work-items/[id]
 * PATCH /api/work-items/[id]
 * DELETE /api/work-items/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateWorkItem, WORK_ITEM_STATUSES, WORK_ITEM_PRIORITIES } from '@/lib/schemas/work-item-schema';
import { validateWorkItemDependencies, calculatePhaseCompletionFromWorkItems, canWorkItemStart } from '@/lib/work-item-helpers';
import { CATEGORY_TYPES } from '@/lib/constants/category-constants';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

const resolveWorkItemCategory = async (db, { categoryId, category }) => {
  let resolvedCategoryId = null;
  let resolvedCategory = category?.trim() || '';

  if (categoryId && ObjectId.isValid(categoryId)) {
    const categoryDoc = await db.collection('categories').findOne({
      _id: new ObjectId(categoryId),
      type: CATEGORY_TYPES.WORK_ITEMS,
    });
    if (categoryDoc) {
      resolvedCategoryId = categoryDoc._id;
      resolvedCategory = categoryDoc.name;
      return { resolvedCategoryId, resolvedCategory };
    }
  }

  if (resolvedCategory) {
    const categoryDoc = await db.collection('categories').findOne({
      name: { $regex: new RegExp(`^${resolvedCategory}$`, 'i') },
      type: CATEGORY_TYPES.WORK_ITEMS,
    });
    if (categoryDoc) {
      resolvedCategoryId = categoryDoc._id;
      resolvedCategory = categoryDoc.name;
    }
  }

  return { resolvedCategoryId, resolvedCategory };
};

/**
 * GET /api/work-items/[id]
 * Returns a single work item by ID
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
      return errorResponse('Invalid work item ID', 400);
    }

    const db = await getDatabase();
    const workItem = await db.collection('work_items').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!workItem) {
      return errorResponse('Work item not found', 404);
    }

    // Populate assigned workers
    const assignedWorkerIds = [];
    if (workItem.assignedTo) {
      if (Array.isArray(workItem.assignedTo)) {
        workItem.assignedTo.forEach(id => {
          if (id) assignedWorkerIds.push(id.toString());
        });
      } else {
        assignedWorkerIds.push(workItem.assignedTo.toString());
      }
    }

    const assignedWorkers = assignedWorkerIds.length > 0
      ? await db.collection('worker_profiles').find({
          $or: [
            { _id: { $in: assignedWorkerIds.map(id => new ObjectId(id)) } },
            { userId: { $in: assignedWorkerIds.map(id => new ObjectId(id)) } }
          ],
          deletedAt: null
        }).toArray()
      : [];

    const workerMap = {};
    assignedWorkers.forEach(worker => {
      const id = worker._id.toString();
      const userId = worker.userId?.toString();
      workerMap[id] = {
        _id: worker._id,
        workerName: worker.workerName || worker.name || 'Unknown Worker',
        employeeId: worker.employeeId,
        workerType: worker.workerType,
        skillType: worker.skillType
      };
      if (userId) {
        workerMap[userId] = workerMap[id];
      }
    });

    // Get all unique user IDs from assignment history
    const assignedByUserIds = [...new Set((workItem.assignmentHistory || [])
      .map(entry => entry.assignedBy)
      .filter(Boolean))];

    // Fetch user profiles for assignedBy
    const userProfiles = assignedByUserIds.length > 0
      ? await db.collection('user_profiles').find({
          _id: { $in: assignedByUserIds.map(id => new ObjectId(id)) }
        }).toArray()
      : [];

    const userMap = {};
    userProfiles.forEach(user => {
      userMap[user._id.toString()] = user.name || user.email || 'Unknown User';
    });

    // Populate assignment history with worker names and user names
    const populatedHistory = (workItem.assignmentHistory || []).map(entry => {
      const previousWorkers = (entry.previousWorkers || []).map(id => {
        if (typeof id === 'string') {
          return workerMap[id] || { _id: id, workerName: 'Unknown Worker' };
        }
        return id;
      });
      const assignedWorkers = (entry.assignedWorkers || []).map(id => {
        if (typeof id === 'string') {
          return workerMap[id] || { _id: id, workerName: 'Unknown Worker' };
        }
        return id;
      });
      
      // Get assignedBy user name
      const assignedByName = entry.assignedBy 
        ? (userMap[entry.assignedBy.toString()] || 'Unknown User')
        : 'Unknown User';
      
      return {
        ...entry,
        previousWorkersDetails: previousWorkers,
        assignedWorkersDetails: assignedWorkers,
        assignedByName: assignedByName
      };
    });

    const populatedWorkItem = {
      ...workItem,
      assignedWorkers: assignedWorkerIds.map(id => workerMap[id]).filter(Boolean),
      assignedWorkersCount: assignedWorkerIds.length,
      assignmentHistory: populatedHistory
    };

    return successResponse(populatedWorkItem, 'Work item retrieved successfully');
  } catch (error) {
    console.error('Get work item error:', error);
    return errorResponse('Failed to retrieve work item', 500);
  }
}

/**
 * PATCH /api/work-items/[id]
 * Updates work item details, status, hours, cost, or dependencies
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

    const hasEditPermission = await hasPermission(user.id, 'edit_work_item');
    if (!hasEditPermission) {
      // Fallback to role check for backward compatibility and safety
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['owner', 'pm', 'project_manager'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse('Insufficient permissions. Only PM and OWNER can edit work items.', 403);
      }
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid work item ID', 400);
    }

    const body = await request.json();
    const {
      name,
      description,
      category,
      status,
      assignedTo,
      estimatedHours,
      actualHours,
      estimatedCost,
      actualCost,
      startDate,
      plannedEndDate,
      actualEndDate,
      dependencies,
      floorId,
      categoryId,
      priority,
      notes
    } = body;

    const db = await getDatabase();

    // Get existing work item
    const existingWorkItem = await db.collection('work_items').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!existingWorkItem) {
      return errorResponse('Work item not found', 404);
    }

    // Build update object
    const updateData = {
      updatedAt: new Date()
    };

    if (name !== undefined) {
      if (!name || name.trim().length < 2) {
        return errorResponse('Work item name cannot be empty and must be at least 2 characters', 400);
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || '';
    }

    if (category !== undefined || categoryId !== undefined) {
      const { resolvedCategoryId, resolvedCategory } = await resolveWorkItemCategory(db, {
        categoryId,
        category,
      });
      if (!resolvedCategory || resolvedCategory.trim().length === 0) {
        return errorResponse('Category cannot be empty', 400);
      }
      updateData.category = resolvedCategory.trim();
      updateData.categoryId = resolvedCategoryId || null;
    }

    if (status !== undefined) {
      if (!WORK_ITEM_STATUSES.includes(status)) {
        return errorResponse(`Invalid status. Must be one of: ${WORK_ITEM_STATUSES.join(', ')}`, 400);
      }
      
      // If changing to in_progress, check if dependencies are met
      if (status === 'in_progress' && existingWorkItem.status !== 'in_progress') {
        const canStart = await canWorkItemStart(id);
        if (!canStart.canStart) {
          return errorResponse(`Cannot start work item: ${canStart.reason}`, 400);
        }
      }
      
      // If changing to completed, set actual end date
      if (status === 'completed' && existingWorkItem.status !== 'completed') {
        updateData.actualEndDate = new Date();
      }
      
      updateData.status = status;
    }

    if (assignedTo !== undefined) {
      // Handle assignedTo as array (support multiple workers)
      let newAssignedTo = [];
      if (assignedTo !== null && assignedTo !== '') {
        if (Array.isArray(assignedTo)) {
          newAssignedTo = assignedTo
            .filter(id => id && ObjectId.isValid(id))
            .map(id => new ObjectId(id));
        } else if (ObjectId.isValid(assignedTo)) {
          // Backward compatibility: single worker ID
          newAssignedTo = [new ObjectId(assignedTo)];
        } else {
          return errorResponse('Invalid assignedTo ID format', 400);
        }
      }
      
      // Get existing assigned workers (handle both array and single ObjectId for backward compatibility)
      const existingAssignedTo = existingWorkItem.assignedTo || [];
      const existingIds = Array.isArray(existingAssignedTo)
        ? existingAssignedTo.map(id => id?.toString()).filter(Boolean).sort()
        : existingAssignedTo
        ? [existingAssignedTo.toString()].sort()
        : [];
      
      const newIds = newAssignedTo.map(id => id.toString()).sort();
      
      // Check if assignment changed
      const assignmentChanged = JSON.stringify(existingIds) !== JSON.stringify(newIds);
      
      if (assignmentChanged) {
        updateData.assignedTo = newAssignedTo;
        
        // Track assignment history
        const existingHistory = existingWorkItem.assignmentHistory || [];
        const historyEntry = {
          previousWorkers: existingIds,
          assignedWorkers: newIds,
          assignedBy: userProfile._id.toString(),
          assignedAt: new Date(),
          action: newIds.length === 0 ? 'unassigned' : (existingIds.length === 0 ? 'assigned' : 'reassigned')
        };
        
        updateData.assignmentHistory = [...existingHistory, historyEntry];
      }
    }

    if (estimatedHours !== undefined) {
      if (isNaN(estimatedHours) || estimatedHours < 0) {
        return errorResponse('Estimated hours must be >= 0', 400);
      }
      updateData.estimatedHours = parseFloat(estimatedHours);
    }

    if (actualHours !== undefined) {
      if (isNaN(actualHours) || actualHours < 0) {
        return errorResponse('Actual hours must be >= 0', 400);
      }
      updateData.actualHours = parseFloat(actualHours);
    }

    if (estimatedCost !== undefined) {
      if (isNaN(estimatedCost) || estimatedCost < 0) {
        return errorResponse('Estimated cost must be >= 0', 400);
      }
      updateData.estimatedCost = parseFloat(estimatedCost);
    }

    if (actualCost !== undefined) {
      if (isNaN(actualCost) || actualCost < 0) {
        return errorResponse('Actual cost must be >= 0', 400);
      }
      updateData.actualCost = parseFloat(actualCost);
    }

    if (startDate !== undefined) {
      updateData.startDate = startDate ? new Date(startDate) : null;
    }

    if (plannedEndDate !== undefined) {
      if (plannedEndDate === null || plannedEndDate === '') {
        updateData.plannedEndDate = null;
      } else {
        updateData.plannedEndDate = new Date(plannedEndDate);
        // Validate end date is after start date
        const start = startDate ? new Date(startDate) : existingWorkItem.startDate;
        if (start && updateData.plannedEndDate <= start) {
          return errorResponse('Planned end date must be after start date', 400);
        }
      }
    }

    if (actualEndDate !== undefined) {
      updateData.actualEndDate = actualEndDate ? new Date(actualEndDate) : null;
    }

    if (dependencies !== undefined) {
      if (!Array.isArray(dependencies)) {
        return errorResponse('Dependencies must be an array', 400);
      }
      
      // Validate dependencies
      const depValidation = await validateWorkItemDependencies(id, dependencies, existingWorkItem.phaseId.toString());
      if (!depValidation.isValid) {
        return errorResponse(`Dependency validation failed: ${depValidation.errors.join(', ')}`, 400);
      }
      
      updateData.dependencies = dependencies
        .filter(depId => ObjectId.isValid(depId))
        .map(depId => new ObjectId(depId));
    }

    if (floorId !== undefined) {
      updateData.floorId = floorId && ObjectId.isValid(floorId) ? new ObjectId(floorId) : null;
    }

    if (categoryId !== undefined) {
      updateData.categoryId = categoryId && ObjectId.isValid(categoryId)
        ? new ObjectId(categoryId)
        : updateData.categoryId ?? null;
    }

    if (priority !== undefined) {
      if (!WORK_ITEM_PRIORITIES.includes(parseInt(priority))) {
        return errorResponse('Priority must be between 1 and 5', 400);
      }
      updateData.priority = parseInt(priority);
    }

    if (notes !== undefined) {
      updateData.notes = notes?.trim() || '';
    }

    // Update work item
    const result = await db.collection('work_items').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return errorResponse('Work item not found', 404);
    }

    const updatedWorkItem = result.value;

    // Recalculate phase completion if status changed
    if (status !== undefined) {
      try {
        const completionPercentage = await calculatePhaseCompletionFromWorkItems(existingWorkItem.phaseId.toString());
        await db.collection('phases').updateOne(
          { _id: new ObjectId(existingWorkItem.phaseId) },
          {
            $set: {
              completionPercentage: completionPercentage,
              updatedAt: new Date()
            }
          }
        );
      } catch (phaseError) {
        console.error('Error recalculating phase completion after work item update:', phaseError);
        // Don't fail the request, just log the error
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'WORK_ITEM',
      entityId: id,
      projectId: existingWorkItem.projectId.toString(),
      changes: updateData,
    });

    return successResponse(updatedWorkItem, 'Work item updated successfully');
  } catch (error) {
    console.error('Update work item error:', error);
    return errorResponse('Failed to update work item', 500);
  }
}

/**
 * DELETE /api/work-items/[id]
 * Soft deletes a work item
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
      return errorResponse('Insufficient permissions. Only OWNER can delete work items.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid work item ID', 400);
    }

    const db = await getDatabase();

    // Get existing work item
    const existingWorkItem = await db.collection('work_items').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!existingWorkItem) {
      return errorResponse('Work item not found', 404);
    }

    // Soft delete
    const result = await db.collection('work_items').findOneAndUpdate(
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
      return errorResponse('Work item not found', 404);
    }

    // Recalculate phase completion
    try {
      const completionPercentage = await calculatePhaseCompletionFromWorkItems(existingWorkItem.phaseId.toString());
      await db.collection('phases').updateOne(
        { _id: new ObjectId(existingWorkItem.phaseId) },
        {
          $set: {
            completionPercentage: completionPercentage,
            updatedAt: new Date()
          }
        }
      );
    } catch (phaseError) {
      console.error('Error recalculating phase completion after work item deletion:', phaseError);
      // Don't fail the request, just log the error
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'WORK_ITEM',
      entityId: id,
      projectId: existingWorkItem.projectId.toString(),
      changes: { deleted: true },
    });

    return successResponse(result.value, 'Work item deleted successfully');
  } catch (error) {
    console.error('Delete work item error:', error);
    return errorResponse('Failed to delete work item', 500);
  }
}


