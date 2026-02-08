/**
 * Approve Supervisor Submission API Route
 * POST: Approve submission and create labour batch
 * 
 * POST /api/labour/supervisor-submissions/[id]/approve
 * 
 * CRITICAL: Same financial validation and atomic transactions as direct entry
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createLabourEntry } from '@/lib/schemas/labour-entry-schema';
import { createLabourBatch, generateBatchNumber } from '@/lib/schemas/labour-batch-schema';
import {
  validatePhaseLabourBudget,
  updatePhaseLabourSpending,
  updateProjectLabourSpending,
} from '@/lib/labour-financial-helpers';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';
import {
  updateWorkItemLabour,
  updateWorkItemStatusFromCompletion,
} from '@/lib/work-item-labour-helpers';
import {
  updateEquipmentOperatorHours,
} from '@/lib/equipment-operator-helpers';
import { updateLabourCostSummary } from '@/lib/labour-financial-helpers';

/**
 * POST /api/labour/supervisor-submissions/[id]/approve
 * Approve submission and create labour batch
 * Auth: OWNER only
 * 
 * CRITICAL: All budget updates are atomic
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
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

    const hasAccess = await hasPermission(user.id, 'approve_supervisor_submission');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to approve supervisor submissions.', 403);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid submission ID is required', 400);
    }

    const body = await request.json();
    const { notes } = body || {};

    const db = await getDatabase();

    // Get submission
    const submission = await db.collection('supervisor_submissions').findOne({
      _id: new ObjectId(id),
    });

    if (!submission) {
      return errorResponse('Supervisor submission not found', 404);
    }

    if (submission.status !== 'pending_review') {
      return errorResponse('Submission is not pending review', 400);
    }

    if (!submission.labourEntries || submission.labourEntries.length === 0) {
      return errorResponse('Submission has no labour entries', 400);
    }

    const hasMissingWorkItems =
      !submission.workItemId &&
      submission.labourEntries.some((entry) => !entry.workItemId);
    if (hasMissingWorkItems) {
      return errorResponse('Work item is required before approval', 400);
    }

    // Convert submission entries to labour entries
    const labourEntries = submission.labourEntries.map((entry) =>
      createLabourEntry(
        {
          projectId: submission.projectId,
          phaseId: submission.phaseId,
          floorId: submission.floorId,
          categoryId: submission.categoryId,
          workItemId: entry.workItemId || submission.workItemId || null,
          workerName: entry.workerName,
          workerType: entry.workerType || 'internal',
          workerRole: entry.workerRole || 'skilled',
          skillType: entry.skillType || 'general_worker',
          entryDate: submission.entryDate,
          totalHours: entry.hours || 0,
          hourlyRate: entry.hourlyRate || 0,
          taskDescription: entry.taskDescription || '',
        },
        userProfile._id
      )
    );

    // Calculate total cost
    const totalCost = labourEntries.reduce((sum, entry) => sum + entry.totalCost, 0);

    // CRITICAL: Validate budget BEFORE approval
    const budgetValidation = await validatePhaseLabourBudget(
      submission.phaseId.toString(),
      totalCost
    );

    if (!budgetValidation.isValid) {
      return errorResponse(
        `Budget validation failed: ${budgetValidation.message}`,
        400
      );
    }

    // Generate batch number
    const batchNumber = await generateBatchNumber(new Date(submission.entryDate));

    // Create batch object
    const batchData = {
      batchName: `From ${submission.submissionChannel} submission ${submission.submissionNumber}`,
      projectId: submission.projectId,
      defaultPhaseId: submission.phaseId,
      defaultFloorId: submission.floorId,
      defaultCategoryId: submission.categoryId,
      defaultDate: submission.entryDate,
      entryType: 'time_based',
      defaultWorkerRole: 'skilled',
      labourEntries,
      status: 'approved',
    };

    const labourBatch = createLabourBatch(
      batchData,
      userProfile._id,
      `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email
    );

    labourBatch.batchNumber = batchNumber;
    labourBatch.autoApproved = true;
    labourBatch.approvedBy = userProfile._id;
    labourBatch.approvedAt = new Date();
    labourBatch.approvalNotes = `Approved from supervisor submission ${submission.submissionNumber}. ${notes || ''}`;

    console.log('[POST /api/labour/supervisor-submissions/[id]/approve] Starting transaction for atomic approval');

    // CRITICAL: Wrap all operations in transaction
    const transactionResult = await withTransaction(async ({ db: transactionDb, session }) => {
      // STEP 1: Insert labour batch (atomic)
      const batchResult = await transactionDb.collection('labour_batches').insertOne(
        labourBatch,
        { session }
      );

      const insertedBatch = { ...labourBatch, _id: batchResult.insertedId };

      // STEP 2: Create all labour entries (atomic)
      const entriesWithBatchId = labourEntries.map((entry) => ({
        ...entry,
        batchId: batchResult.insertedId,
        batchNumber: batchNumber,
        status: 'approved',
      }));

      const entryResults = await transactionDb.collection('labour_entries').insertMany(
        entriesWithBatchId,
        { session }
      );

      const entryIds = Object.values(entryResults.insertedIds);

      // STEP 3: Update batch with entry IDs (atomic)
      await transactionDb.collection('labour_batches').updateOne(
        { _id: batchResult.insertedId },
        {
          $set: {
            labourEntryIds: entryIds,
            totalEntries: entryIds.length,
            updatedAt: new Date(),
          },
        },
        { session }
      );

      // STEP 4: Update phase budget (atomic)
      await updatePhaseLabourSpending(
        submission.phaseId.toString(),
        totalCost,
        'add',
        session
      );

      // STEP 5: Update project budget (atomic)
      await updateProjectLabourSpending(
        submission.projectId.toString(),
        totalCost,
        'add',
        session
      );

      // STEP 5.5: Update work items if linked (atomic)
      const workItemUpdates = {};
      labourEntries.forEach((entry) => {
        if (entry.workItemId && ObjectId.isValid(entry.workItemId)) {
          const workItemId = entry.workItemId.toString();
          if (!workItemUpdates[workItemId]) {
            workItemUpdates[workItemId] = { hours: 0, cost: 0 };
          }
          workItemUpdates[workItemId].hours += entry.totalHours || 0;
          workItemUpdates[workItemId].cost += entry.totalCost;
        }
      });

      for (const [workItemId, updates] of Object.entries(workItemUpdates)) {
        await updateWorkItemLabour(
          workItemId,
          updates.hours,
          updates.cost,
          'add',
          session
        );

        // Update work item status based on completion (async, non-blocking)
        setImmediate(async () => {
          try {
            await updateWorkItemStatusFromCompletion(workItemId);
          } catch (error) {
            console.error(`Error updating work item ${workItemId} status:`, error);
            // Don't throw - status update is non-critical
          }
        });
      }

      // STEP 5.6: Update equipment utilization if operators (atomic)
      const equipmentUpdates = {};
      labourEntries.forEach((entry) => {
        if (entry.equipmentId && ObjectId.isValid(entry.equipmentId)) {
          const equipmentId = entry.equipmentId.toString();
          if (!equipmentUpdates[equipmentId]) {
            equipmentUpdates[equipmentId] = { hours: 0 };
          }
          equipmentUpdates[equipmentId].hours += entry.totalHours || 0;
        }
      });

      for (const [equipmentId, updates] of Object.entries(equipmentUpdates)) {
        await updateEquipmentOperatorHours(
          equipmentId,
          updates.hours,
          'add',
          session
        );
      }

      // STEP 6: Update submission status (atomic)
      await transactionDb.collection('supervisor_submissions').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'approved',
            reviewedBy: new ObjectId(userProfile._id),
            reviewedAt: new Date(),
            reviewNotes: notes || null,
            labourBatchId: batchResult.insertedId,
            labourBatchNumber: batchNumber,
            updatedAt: new Date(),
          },
        },
        { session }
      );

      // STEP 7: Create audit log (atomic)
      await createAuditLog(
        {
          userId: userProfile._id.toString(),
          action: 'APPROVED',
          entityType: 'SUPERVISOR_SUBMISSION',
          entityId: id,
          projectId: submission.projectId.toString(),
          changes: {
            submission: submission.submissionNumber,
            batchCreated: batchNumber,
            totalCost,
            entryCount: entryIds.length,
            phaseBudgetImpact: {
              before: budgetValidation.currentSpending,
              after: budgetValidation.currentSpending + totalCost,
              budget: budgetValidation.budget,
            },
            reviewNotes: notes,
          },
        },
        { session }
      );

      return {
        batchId: batchResult.insertedId,
        batch: insertedBatch,
        entryIds,
        totalCost,
      };
    });

    console.log('[POST /api/labour/supervisor-submissions/[id]/approve] Transaction completed successfully');

    // After transaction: Recalculate phase spending
    await recalculatePhaseSpending(submission.phaseId.toString());

    // Update labour cost summaries (async, non-blocking)
    setImmediate(async () => {
      try {
        await updateLabourCostSummary(
          submission.projectId.toString(),
          submission.phaseId.toString(),
          'phase_total'
        );
        await updateLabourCostSummary(
          submission.projectId.toString(),
          null,
          'project_total'
        );
      } catch (error) {
        console.error('Error updating labour cost summaries:', error);
        // Don't throw - summary update is non-critical
      }
    });

    // Get updated submission
    const updatedSubmission = await db.collection('supervisor_submissions').findOne({
      _id: new ObjectId(id),
    });

    // Get created batch
    const createdBatch = await db.collection('labour_batches').findOne({
      _id: transactionResult.batchId,
    });

    return successResponse(
      {
        submission: updatedSubmission,
        batch: createdBatch,
        totalCost: transactionResult.totalCost,
        entryCount: transactionResult.entryIds.length,
        budgetValidation: {
          available: budgetValidation.available - totalCost,
          used: budgetValidation.currentSpending + totalCost,
          budget: budgetValidation.budget,
        },
      },
      'Supervisor submission approved and labour batch created successfully'
    );
  } catch (error) {
    console.error('POST /api/labour/supervisor-submissions/[id]/approve error:', error);
    return errorResponse(error.message || 'Failed to approve supervisor submission', 500);
  }
}

