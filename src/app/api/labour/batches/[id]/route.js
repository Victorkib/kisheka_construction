/**
 * Labour Batch API Route (Individual Batch)
 * GET: Get single labour batch with entries
 * PATCH: Update labour batch
 * DELETE: Soft delete labour batch
 * 
 * GET /api/labour/batches/[id]
 * PATCH /api/labour/batches/[id]
 * DELETE /api/labour/batches/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  validatePhaseLabourBudget,
  updatePhaseLabourSpending,
  updateProjectLabourSpending,
} from '@/lib/labour-financial-helpers';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';

/**
 * GET /api/labour/batches/[id]
 * Get single labour batch with all entries
 * Auth: All authenticated users
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid batch ID is required', 400);
    }

    const db = await getDatabase();

    const batch = await db.collection('labour_batches').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!batch) {
      return errorResponse('Labour batch not found', 404);
    }

    // Get all entries for this batch
    const entries = await db.collection('labour_entries').find({
      batchId: new ObjectId(id),
      deletedAt: null,
    }).sort({ entryDate: -1 }).toArray();

    // Populate worker profile IDs for entries
    const workerIds = [...new Set(entries.map((e) => e.workerId).filter(Boolean))];
    const workerProfiles = await db.collection('worker_profiles').find({
      $or: [
        { userId: { $in: workerIds.map((id) => new ObjectId(id)) } },
        { _id: { $in: workerIds.map((id) => new ObjectId(id)) } },
      ],
      deletedAt: null,
    }).toArray();

    const workerProfileMap = {};
    workerProfiles.forEach((profile) => {
      if (profile.userId) {
        workerProfileMap[profile.userId.toString()] = profile._id.toString();
      }
      workerProfileMap[profile._id.toString()] = profile._id.toString();
    });

    // Add workerProfileId to entries
    const entriesWithWorkerProfiles = entries.map((entry) => ({
      ...entry,
      workerProfileId: entry.workerId ? workerProfileMap[entry.workerId.toString()] : null,
    }));

    // Get phase info
    const phaseIds = [...new Set(entries.map((e) => e.phaseId?.toString()).filter(Boolean))];
    const phases = await db.collection('phases').find({
      _id: { $in: phaseIds.map((id) => new ObjectId(id)) },
    }).toArray();

    const phaseMap = {};
    phases.forEach((phase) => {
      phaseMap[phase._id.toString()] = {
        phaseName: phase.phaseName,
        phaseCode: phase.phaseCode,
        budgetAllocation: phase.budgetAllocation,
        actualSpending: phase.actualSpending,
      };
    });

    // Calculate summary by phase
    const summaryByPhase = {};
    entriesWithWorkerProfiles.forEach((entry) => {
      const phaseId = entry.phaseId?.toString();
      if (phaseId) {
        if (!summaryByPhase[phaseId]) {
          summaryByPhase[phaseId] = {
            phaseId,
            phase: phaseMap[phaseId],
            totalHours: 0,
            totalCost: 0,
            entryCount: 0,
          };
        }
        summaryByPhase[phaseId].totalHours += entry.totalHours || 0;
        summaryByPhase[phaseId].totalCost += entry.totalCost || 0;
        summaryByPhase[phaseId].entryCount += 1;
      }
    });

    const populatedBatch = {
      ...batch,
      entries: entriesWithWorkerProfiles,
      summaryByPhase: Object.values(summaryByPhase),
      totalEntries: entriesWithWorkerProfiles.length,
      totalHours: entriesWithWorkerProfiles.reduce((sum, e) => sum + (e.totalHours || 0), 0),
      totalCost: entriesWithWorkerProfiles.reduce((sum, e) => sum + (e.totalCost || 0), 0),
    };

    return successResponse(populatedBatch, 'Labour batch retrieved successfully');
  } catch (error) {
    console.error('GET /api/labour/batches/[id] error:', error);
    return errorResponse('Failed to retrieve labour batch', 500);
  }
}

/**
 * PATCH /api/labour/batches/[id]
 * Update labour batch (only if status is 'draft')
 * Auth: OWNER only
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

    const hasAccess = await hasPermission(user.id, 'edit_labour_batch');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to update labour batches.', 403);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid batch ID is required', 400);
    }

    const body = await request.json();
    const db = await getDatabase();

    // Get existing batch
    const existingBatch = await db.collection('labour_batches').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingBatch) {
      return errorResponse('Labour batch not found', 404);
    }

    // Only allow updates if batch is draft
    if (existingBatch.status !== 'draft') {
      return errorResponse('Cannot update batch that is not in draft status', 400);
    }

    // Update batch
    const updatedData = {
      ...existingBatch,
      ...body,
      updatedAt: new Date(),
    };

    await db.collection('labour_batches').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: updatedData,
      }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'LABOUR_BATCH',
      entityId: id,
      projectId: existingBatch.projectId.toString(),
      changes: {
        before: existingBatch,
        after: updatedData,
      },
    });

    // Get updated batch
    const updatedBatch = await db.collection('labour_batches').findOne({
      _id: new ObjectId(id),
    });

    return successResponse(updatedBatch, 'Labour batch updated successfully');
  } catch (error) {
    console.error('PATCH /api/labour/batches/[id] error:', error);
    return errorResponse(error.message || 'Failed to update labour batch', 500);
  }
}

/**
 * DELETE /api/labour/batches/[id]
 * Soft delete labour batch (only if status is 'draft')
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

    const hasAccess = await hasPermission(user.id, 'delete_labour_batch');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to delete labour batches.', 403);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid batch ID is required', 400);
    }

    const db = await getDatabase();

    // Get existing batch
    const existingBatch = await db.collection('labour_batches').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingBatch) {
      return errorResponse('Labour batch not found', 404);
    }

    // Only allow deletion if batch is draft
    if (existingBatch.status !== 'draft') {
      return errorResponse('Cannot delete batch that is not in draft status', 400);
    }

    // Get all entries in this batch
    const entries = await db.collection('labour_entries').find({
      batchId: new ObjectId(id),
      deletedAt: null,
    }).toArray();

    console.log('[DELETE /api/labour/batches/[id]] Starting transaction for atomic deletion');

    // CRITICAL: Wrap all operations in transaction
    const transactionResult = await withTransaction(async ({ db: transactionDb, session }) => {
      // STEP 1: Soft delete batch (atomic)
      await transactionDb.collection('labour_batches').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            deletedAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { session }
      );

      // STEP 2: Soft delete all entries (atomic)
      if (entries.length > 0) {
        await transactionDb.collection('labour_entries').updateMany(
          { batchId: new ObjectId(id) },
          {
            $set: {
              deletedAt: new Date(),
              updatedAt: new Date(),
            },
          },
          { session }
        );
      }

      // STEP 3: Create audit log (atomic)
      await createAuditLog(
        {
          userId: userProfile._id.toString(),
          action: 'DELETED',
          entityType: 'LABOUR_BATCH',
          entityId: id,
          projectId: existingBatch.projectId.toString(),
          changes: {
            deleted: existingBatch,
            entriesDeleted: entries.length,
          },
        },
        { session }
      );

      return { success: true };
    });

    console.log('[DELETE /api/labour/batches/[id]] Transaction completed successfully');

    return successResponse(null, 'Labour batch deleted successfully');
  } catch (error) {
    console.error('DELETE /api/labour/batches/[id] error:', error);
    return errorResponse(error.message || 'Failed to delete labour batch', 500);
  }
}

