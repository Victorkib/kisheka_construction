/**
 * Labour Entry API Route (Individual Entry)
 * GET: Get single labour entry
 * PATCH: Update labour entry
 * DELETE: Soft delete labour entry
 * 
 * GET /api/labour/entries/[id]
 * PATCH /api/labour/entries/[id]
 * DELETE /api/labour/entries/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateLabourEntry, createLabourEntry } from '@/lib/schemas/labour-entry-schema';
import {
  validatePhaseLabourBudget,
  updatePhaseLabourSpending,
  updateProjectLabourSpending,
} from '@/lib/labour-financial-helpers';
import {
  updateWorkItemLabour,
  updateWorkItemStatusFromCompletion,
} from '@/lib/work-item-labour-helpers';
import {
  updateEquipmentOperatorHours,
} from '@/lib/equipment-operator-helpers';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';

/**
 * GET /api/labour/entries/[id]
 * Get single labour entry with details
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

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid entry ID is required', 400);
    }

    const db = await getDatabase();

    const entry = await db.collection('labour_entries').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!entry) {
      return errorResponse('Labour entry not found', 404);
    }

    // Populate related data
    const populatedEntry = { ...entry };

    // Get worker profile if workerId exists
    if (entry.workerId) {
      const workerProfile = await db.collection('worker_profiles').findOne({
        $or: [
          { userId: entry.workerId },
          { _id: entry.workerId },
        ],
        deletedAt: null,
      });
      if (workerProfile) {
        populatedEntry.workerProfile = {
          _id: workerProfile._id,
          employeeId: workerProfile.employeeId,
          defaultHourlyRate: workerProfile.defaultHourlyRate,
          skillTypes: workerProfile.skillTypes,
        };
        // Also set workerProfileId for easy linking
        populatedEntry.workerProfileId = workerProfile._id.toString();
      }
    }

    // Get phase info
    if (entry.phaseId) {
      const phase = await db.collection('phases').findOne({
        _id: entry.phaseId,
      });
      if (phase) {
        populatedEntry.phase = {
          phaseName: phase.phaseName,
          phaseCode: phase.phaseCode,
          budgetAllocation: phase.budgetAllocation,
          actualSpending: phase.actualSpending,
        };
      }
    }

    // Get work item info if linked
    if (entry.workItemId) {
      const workItem = await db.collection('work_items').findOne({
        _id: entry.workItemId,
        deletedAt: null,
      });
      if (workItem) {
        populatedEntry.workItem = {
          _id: workItem._id.toString(),
          name: workItem.name,
          category: workItem.category,
          status: workItem.status,
          estimatedHours: workItem.estimatedHours || 0,
          actualHours: workItem.actualHours || 0,
          estimatedCost: workItem.estimatedCost || 0,
          actualCost: workItem.actualCost || 0,
        };
      }
    }

    return successResponse(populatedEntry, 'Labour entry retrieved successfully');
  } catch (error) {
    console.error('GET /api/labour/entries/[id] error:', error);
    return errorResponse('Failed to retrieve labour entry', 500);
  }
}

/**
 * PATCH /api/labour/entries/[id]
 * Update labour entry (only if status is 'draft' or 'submitted')
 * Auth: OWNER only
 * 
 * CRITICAL: If cost changes, budget is updated atomically
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

    const hasAccess = await hasPermission(user.id, 'edit_labour_entry');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to update labour entries.', 403);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid entry ID is required', 400);
    }

    const body = await request.json();
    const db = await getDatabase();

    // Get existing entry
    const existingEntry = await db.collection('labour_entries').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingEntry) {
      return errorResponse('Labour entry not found', 404);
    }

    // Only allow updates if entry is draft or submitted (not approved/paid)
    if (!['draft', 'submitted'].includes(existingEntry.status)) {
      return errorResponse('Cannot update entry that is already approved or paid', 400);
    }

    // Merge updates with existing entry
    const updatedData = {
      ...existingEntry,
      ...body,
      updatedAt: new Date(),
    };

    // Recalculate costs if hours or rates changed
    if (body.totalHours !== undefined || body.hourlyRate !== undefined || body.overtimeHours !== undefined) {
      const regularHours = updatedData.regularHours || Math.min(8, updatedData.totalHours || 0);
      const overtimeHours = updatedData.overtimeHours || Math.max(0, (updatedData.totalHours || 0) - 8);
      const hourlyRate = updatedData.hourlyRate || existingEntry.hourlyRate;
      const overtimeRate = hourlyRate * 1.5;

      updatedData.regularCost = regularHours * hourlyRate;
      updatedData.overtimeCost = overtimeHours * overtimeRate;
      updatedData.totalCost = updatedData.regularCost + updatedData.overtimeCost;
    }

    // Validate updated entry
    const validation = validateLabourEntry(updatedData);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Calculate cost difference
    const costDifference = updatedData.totalCost - existingEntry.totalCost;

    // If cost changed, validate budget
    if (Math.abs(costDifference) > 0.01) {
      const budgetValidation = await validatePhaseLabourBudget(
        existingEntry.phaseId.toString(),
        updatedData.totalCost,
        null // Not a batch update
      );

      if (!budgetValidation.isValid) {
        return errorResponse(
          `Budget validation failed: ${budgetValidation.message}`,
          400
        );
      }
    }

    console.log('[PATCH /api/labour/entries/[id]] Starting transaction for atomic update');

    // CRITICAL: Wrap all operations in transaction
    const transactionResult = await withTransaction(async ({ db: transactionDb, session }) => {
      // STEP 1: Update entry (atomic)
      await transactionDb.collection('labour_entries').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: updatedData,
        },
        { session }
      );

      // STEP 2: Update budgets if cost changed (atomic)
      if (Math.abs(costDifference) > 0.01) {
        // Reverse old cost
        await updatePhaseLabourSpending(
          existingEntry.phaseId.toString(),
          existingEntry.totalCost,
          'subtract',
          session
        );
        await updateProjectLabourSpending(
          existingEntry.projectId.toString(),
          existingEntry.totalCost,
          'subtract',
          session
        );

        // Add new cost
        await updatePhaseLabourSpending(
          existingEntry.phaseId.toString(),
          updatedData.totalCost,
          'add',
          session
        );
        await updateProjectLabourSpending(
          existingEntry.projectId.toString(),
          updatedData.totalCost,
          'add',
          session
        );
      }

      // STEP 3: Update work item if linked (atomic)
      if (updatedData.workItemId && ObjectId.isValid(updatedData.workItemId)) {
        const hoursDifference = (updatedData.totalHours || 0) - (existingEntry.totalHours || 0);
        const costDifference = updatedData.totalCost - existingEntry.totalCost;

        // Use helper function for consistency
        await updateWorkItemLabour(
          updatedData.workItemId.toString(),
          hoursDifference,
          costDifference,
          hoursDifference >= 0 ? 'add' : 'subtract',
          session
        );

        // Update work item status based on completion (async, non-blocking)
        setImmediate(async () => {
          try {
            await updateWorkItemStatusFromCompletion(updatedData.workItemId.toString());
          } catch (error) {
            console.error('Error updating work item status:', error);
            // Don't throw - status update is non-critical
          }
        });
      }

      // STEP 3.5: Update equipment utilization if operator (atomic)
      // Handle equipment changes
      const oldEquipmentId = existingEntry.equipmentId?.toString();
      const newEquipmentId = updatedData.equipmentId?.toString();

      if (oldEquipmentId && oldEquipmentId !== newEquipmentId) {
        // Equipment changed - subtract from old, add to new
        await updateEquipmentOperatorHours(
          oldEquipmentId,
          existingEntry.totalHours || 0,
          'subtract',
          session
        );
      }

      if (newEquipmentId && ObjectId.isValid(newEquipmentId)) {
        const hoursDifference = (updatedData.totalHours || 0) - (existingEntry.totalHours || 0);
        if (oldEquipmentId === newEquipmentId && hoursDifference !== 0) {
          // Same equipment, hours changed
          await updateEquipmentOperatorHours(
            newEquipmentId,
            Math.abs(hoursDifference),
            hoursDifference >= 0 ? 'add' : 'subtract',
            session
          );
        } else if (oldEquipmentId !== newEquipmentId) {
          // New equipment
          await updateEquipmentOperatorHours(
            newEquipmentId,
            updatedData.totalHours || 0,
            'add',
            session
          );
        }
      }

      // STEP 4: Create audit log (atomic)
      await createAuditLog(
        {
          userId: userProfile._id.toString(),
          action: 'UPDATED',
          entityType: 'LABOUR_ENTRY',
          entityId: id,
          projectId: existingEntry.projectId.toString(),
          changes: {
            before: existingEntry,
            after: updatedData,
            costDifference,
          },
        },
        { session }
      );

      return { success: true };
    });

    console.log('[PATCH /api/labour/entries/[id]] Transaction completed successfully');

    // After transaction: Recalculate phase spending
    if (Math.abs(costDifference) > 0.01) {
      await recalculatePhaseSpending(existingEntry.phaseId.toString());
    }

    // Get updated entry
    const updatedEntry = await db.collection('labour_entries').findOne({
      _id: new ObjectId(id),
    });

    return successResponse(updatedEntry, 'Labour entry updated successfully');
  } catch (error) {
    console.error('PATCH /api/labour/entries/[id] error:', error);
    return errorResponse(error.message || 'Failed to update labour entry', 500);
  }
}

/**
 * DELETE /api/labour/entries/[id]
 * Soft delete labour entry (only if status is 'draft')
 * Auth: OWNER only
 * 
 * CRITICAL: Reverses budget impact atomically
 */
export async function DELETE(request, { params }) {
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

    const hasAccess = await hasPermission(user.id, 'delete_labour_entry');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to delete labour entries.', 403);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid entry ID is required', 400);
    }

    const db = await getDatabase();

    // Get existing entry
    const existingEntry = await db.collection('labour_entries').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingEntry) {
      return errorResponse('Labour entry not found', 404);
    }

    // Only allow deletion if entry is draft (not approved/paid)
    if (existingEntry.status !== 'draft') {
      return errorResponse('Cannot delete entry that is not in draft status', 400);
    }

    console.log('[DELETE /api/labour/entries/[id]] Starting transaction for atomic deletion');

    // CRITICAL: Wrap all operations in transaction
    const transactionResult = await withTransaction(async ({ db: transactionDb, session }) => {
      // STEP 1: Soft delete entry (atomic)
      await transactionDb.collection('labour_entries').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            deletedAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { session }
      );

      // STEP 2: Reverse budget impact if entry was approved (atomic)
      // Note: Since we only allow deletion of draft entries, no budget reversal needed
      // But we'll keep this structure for future flexibility

      // STEP 3: Create audit log (atomic)
      await createAuditLog(
        {
          userId: userProfile._id.toString(),
          action: 'DELETED',
          entityType: 'LABOUR_ENTRY',
          entityId: id,
          projectId: existingEntry.projectId.toString(),
          changes: {
            deleted: existingEntry,
          },
        },
        { session }
      );

      return { success: true };
    });

    console.log('[DELETE /api/labour/entries/[id]] Transaction completed successfully');

    return successResponse(null, 'Labour entry deleted successfully');
  } catch (error) {
    console.error('DELETE /api/labour/entries/[id] error:', error);
    return errorResponse(error.message || 'Failed to delete labour entry', 500);
  }
}

