/**
 * Approve Site Report API
 * POST: Approve report and optionally create labour batch
 *
 * POST /api/labour/site-reports/[id]/approve
 */

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
  updateLabourCostSummary,
} from '@/lib/labour-financial-helpers';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';
import {
  updateWorkItemLabour,
  updateWorkItemStatusFromCompletion,
} from '@/lib/work-item-labour-helpers';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const hasAccess = await hasPermission(user.id, 'approve_site_report');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid report ID is required', 400);
    }

    const { notes } = await request.json();
    const db = await getDatabase();
    const report = await db.collection('site_reports').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!report) {
      return errorResponse('Site report not found', 404);
    }

    if (!['submitted', 'draft'].includes(report.status)) {
      return errorResponse('Report is not in an approvable state', 400);
    }

    const hasEntries = Array.isArray(report.labourEntries) && report.labourEntries.length > 0;
    if (!hasEntries) {
      await db.collection('site_reports').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'approved',
            reviewedBy: userProfile._id,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'APPROVED',
        entityType: 'SITE_REPORT',
        entityId: id,
        projectId: report.projectId?.toString(),
        phaseId: report.phaseId?.toString(),
        changes: { approved: true },
      });

      return successResponse({ ...report, status: 'approved' }, 'Site report approved');
    }

    const missingWorkItem = report.labourEntries.some((entry) => !entry.workItemId);
    if (missingWorkItem) {
      return errorResponse('Labour entries must be linked to work items before approval', 400);
    }

    // Convert report entries into labour entries
    const labourEntries = report.labourEntries.map((entry) =>
      createLabourEntry(
        {
          projectId: report.projectId,
          phaseId: report.phaseId,
          floorId: report.floorId,
          categoryId: entry.categoryId || null,
          workItemId: entry.workItemId,
          workerId: entry.workerId || null,
          workerName: entry.workerName,
          workerType: entry.workerType || 'internal',
          workerRole: entry.workerRole || 'skilled',
          skillType: entry.skillType || 'general_worker',
          entryDate: report.entryDate,
          totalHours: entry.hours || 0,
          hourlyRate: entry.hourlyRate || 0,
          taskDescription: entry.taskDescription || report.summary || '',
        },
        userProfile._id
      )
    );

    const totalCost = labourEntries.reduce((sum, entry) => sum + entry.totalCost, 0);
    const budgetValidation = await validatePhaseLabourBudget(
      report.phaseId.toString(),
      totalCost
    );

    // Only block if budget is set AND exceeded
    // If budget is not set (budgetNotSet = true), allow the operation
    if (!budgetValidation.isValid && !budgetValidation.budgetNotSet) {
      return errorResponse(`Budget validation failed: ${budgetValidation.message}`, 400);
    }
    // If budget is not set, operation is allowed (isValid = true, budgetNotSet = true)
    // Spending will still be tracked regardless

    const batchNumber = await generateBatchNumber(new Date(report.entryDate));
    const batchData = {
      batchName: `From site report ${report.reportNumber}`,
      projectId: report.projectId,
      defaultPhaseId: report.phaseId,
      defaultFloorId: report.floorId,
      defaultCategoryId: report.categoryId || null,
      defaultDate: report.entryDate,
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
    labourBatch.approvalNotes = `Approved from site report ${report.reportNumber}. ${notes || ''}`;

    const transactionResult = await withTransaction(async ({ db: transactionDb, session }) => {
      const batchResult = await transactionDb.collection('labour_batches').insertOne(
        labourBatch,
        { session }
      );

      const entriesWithBatchId = labourEntries.map((entry) => ({
        ...entry,
        batchId: batchResult.insertedId,
        batchNumber,
        status: 'approved',
      }));

      const entryResults = await transactionDb.collection('labour_entries').insertMany(
        entriesWithBatchId,
        { session }
      );

      const entryIds = Object.values(entryResults.insertedIds);

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

      await updatePhaseLabourSpending(
        report.phaseId.toString(),
        totalCost,
        'add',
        session
      );

      await updateProjectLabourSpending(
        report.projectId.toString(),
        totalCost,
        'add',
        session
      );

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

        setImmediate(async () => {
          try {
            await updateWorkItemStatusFromCompletion(workItemId);
          } catch (error) {
            console.error(`Error updating work item ${workItemId} status:`, error);
          }
        });
      }

      await transactionDb.collection('site_reports').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'converted',
            labourBatchId: batchResult.insertedId,
            labourBatchNumber: batchNumber,
            reviewedBy: userProfile._id,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { session }
      );

      return {
        batchId: batchResult.insertedId,
        batchNumber,
      };
    });

    setImmediate(async () => {
      try {
        await recalculatePhaseSpending(report.phaseId.toString());
        await updateLabourCostSummary(report.projectId.toString(), report.phaseId.toString());
      } catch (error) {
        console.error('Post-approval recalculation error:', error);
      }
    });

    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'APPROVED',
      entityType: 'SITE_REPORT',
      entityId: id,
      projectId: report.projectId?.toString(),
      phaseId: report.phaseId?.toString(),
      changes: { convertedToLabourBatch: transactionResult.batchId.toString() },
    });

    return successResponse(
      {
        reportId: id,
        batch: {
          _id: transactionResult.batchId,
          batchNumber: transactionResult.batchNumber,
        },
      },
      'Site report approved and converted to labour batch'
    );
  } catch (error) {
    console.error('POST /api/labour/site-reports/[id]/approve error:', error);
    return errorResponse(error.message || 'Failed to approve site report', 500);
  }
}
