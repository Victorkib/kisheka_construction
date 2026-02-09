/**
 * Labour Entry Approve API Route
 * POST: Approve labour entry
 * 
 * POST /api/labour/entries/[id]/approve
 * Auth: OWNER only (auto-approval in single-user mode)
 * 
 * CRITICAL: Budget updates are atomic
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
import {
  updateWorkItemLabour,
  updateWorkItemStatusFromCompletion,
} from '@/lib/work-item-labour-helpers';
import {
  updateEquipmentOperatorHours,
} from '@/lib/equipment-operator-helpers';
import { updateLabourCostSummary } from '@/lib/labour-financial-helpers';

/**
 * POST /api/labour/entries/[id]/approve
 * Approve labour entry
 * Auth: OWNER only
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

    const hasAccess = await hasPermission(user.id, 'approve_labour_entry');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to approve labour entries.', 403);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid entry ID is required', 400);
    }

    const body = await request.json();
    const { notes } = body || {};

    const db = await getDatabase();

    // Get existing entry
    const existingEntry = await db.collection('labour_entries').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingEntry) {
      return errorResponse('Labour entry not found', 404);
    }

    // Check if already approved
    if (existingEntry.status === 'approved' || existingEntry.status === 'paid') {
      return errorResponse('Labour entry is already approved or paid', 400);
    }

    // CRITICAL: Validate budget BEFORE approval
    const budgetValidation = await validatePhaseLabourBudget(
      existingEntry.phaseId.toString(),
      existingEntry.totalCost
    );

    // Only block if budget is set AND exceeded
    // If budget is not set (budgetNotSet = true), allow the operation
    if (!budgetValidation.isValid && !budgetValidation.budgetNotSet) {
      return errorResponse(
        `Budget validation failed: ${budgetValidation.message}`,
        400
      );
    }
    // If budget is not set, operation is allowed (isValid = true, budgetNotSet = true)
    // Spending will still be tracked regardless

    console.log('[POST /api/labour/entries/[id]/approve] Starting transaction for atomic approval');

    // CRITICAL: Wrap all operations in transaction
    const transactionResult = await withTransaction(async ({ db: transactionDb, session }) => {
      // STEP 1: Update entry status to approved (atomic)
      await transactionDb.collection('labour_entries').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'approved',
            updatedAt: new Date(),
          },
        },
        { session }
      );

      // STEP 2: Update phase actual spending (atomic)
      await updatePhaseLabourSpending(
        existingEntry.phaseId.toString(),
        existingEntry.totalCost,
        'add',
        session
      );

      // STEP 3: Update project budget (atomic)
      await updateProjectLabourSpending(
        existingEntry.projectId.toString(),
        existingEntry.totalCost,
        'add',
        session
      );

      // STEP 4: Update work item if linked (atomic)
      if (existingEntry.workItemId && ObjectId.isValid(existingEntry.workItemId)) {
        await updateWorkItemLabour(
          existingEntry.workItemId.toString(),
          existingEntry.totalHours || 0,
          existingEntry.totalCost,
          'add',
          session
        );

        // Update work item status based on completion (async, non-blocking)
        setImmediate(async () => {
          try {
            await updateWorkItemStatusFromCompletion(existingEntry.workItemId.toString());
          } catch (error) {
            console.error('Error updating work item status:', error);
            // Don't throw - status update is non-critical
          }
        });
      }

      // STEP 4.5: Update equipment utilization if operator (atomic)
      if (existingEntry.equipmentId && ObjectId.isValid(existingEntry.equipmentId)) {
        await updateEquipmentOperatorHours(
          existingEntry.equipmentId.toString(),
          existingEntry.totalHours || 0,
          'add',
          session
        );
      }

      // STEP 5: Create audit log (atomic)
      await createAuditLog(
        {
          userId: userProfile._id.toString(),
          action: 'APPROVED',
          entityType: 'LABOUR_ENTRY',
          entityId: id,
          projectId: existingEntry.projectId.toString(),
          changes: {
            before: existingEntry,
            after: { ...existingEntry, status: 'approved' },
            labourCost: existingEntry.totalCost,
            phaseBudgetImpact: {
              before: budgetValidation.currentSpending,
              after: budgetValidation.currentSpending + existingEntry.totalCost,
              budget: budgetValidation.budget,
            },
            approvalNotes: notes,
          },
        },
        { session }
      );

      return { success: true };
    });

    console.log('[POST /api/labour/entries/[id]/approve] Transaction completed successfully');

    // After transaction: Recalculate phase spending
    await recalculatePhaseSpending(existingEntry.phaseId.toString());

    // Update labour cost summaries (async, non-blocking)
    setImmediate(async () => {
      try {
        await updateLabourCostSummary(
          existingEntry.projectId.toString(),
          existingEntry.phaseId.toString(),
          'phase_total'
        );
        await updateLabourCostSummary(
          existingEntry.projectId.toString(),
          null,
          'project_total'
        );
      } catch (error) {
        console.error('Error updating labour cost summaries:', error);
        // Don't throw - summary update is non-critical
      }
    });

    // Get updated entry
    const approvedEntry = await db.collection('labour_entries').findOne({
      _id: new ObjectId(id),
    });

    return successResponse(
      {
        entry: approvedEntry,
        budgetValidation: {
          available: budgetValidation.available - existingEntry.totalCost,
          used: budgetValidation.currentSpending + existingEntry.totalCost,
          budget: budgetValidation.budget,
        },
      },
      'Labour entry approved successfully'
    );
  } catch (error) {
    console.error('POST /api/labour/entries/[id]/approve error:', error);
    return errorResponse(error.message || 'Failed to approve labour entry', 500);
  }
}

