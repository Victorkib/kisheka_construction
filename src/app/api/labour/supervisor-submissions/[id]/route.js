/**
 * Supervisor Submission API Route (Individual Submission)
 * GET: Get single submission with details
 * PATCH: Edit parsed data (owner only)
 * 
 * GET /api/labour/supervisor-submissions/[id]
 * PATCH /api/labour/supervisor-submissions/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateSupervisorSubmission } from '@/lib/schemas/supervisor-submission-schema';

/**
 * GET /api/labour/supervisor-submissions/[id]
 * Get single submission with all details
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
      return errorResponse('Valid submission ID is required', 400);
    }

    const db = await getDatabase();

    const submission = await db.collection('supervisor_submissions').findOne({
      _id: new ObjectId(id),
    });

    if (!submission) {
      return errorResponse('Supervisor submission not found', 404);
    }

    // Calculate totals for display
    const totals = submission.labourEntries.reduce(
      (acc, entry) => {
        const hours = parseFloat(entry.hours) || 0;
        const rate = parseFloat(entry.hourlyRate) || 0;
        const cost = hours * rate;

        return {
          totalHours: acc.totalHours + hours,
          totalCost: acc.totalCost + cost,
          entryCount: acc.entryCount + 1,
        };
      },
      { totalHours: 0, totalCost: 0, entryCount: 0 }
    );

    // Get phase info for budget validation
    const phase = await db.collection('phases').findOne({
      _id: submission.phaseId,
    });

    // Fetch work items linked to submission or entries
    const workItemIds = new Set();
    if (submission.workItemId) {
      workItemIds.add(submission.workItemId.toString());
    }
    (submission.labourEntries || []).forEach((entry) => {
      if (entry.workItemId) {
        workItemIds.add(entry.workItemId.toString());
      }
    });

    const workItems = workItemIds.size > 0
      ? await db.collection('work_items').find({
        _id: { $in: Array.from(workItemIds).map((id) => new ObjectId(id)) },
        deletedAt: null,
      }).toArray()
      : [];

    const workItemMap = {};
    workItems.forEach((item) => {
      workItemMap[item._id.toString()] = {
        workItemName: item.name,
        workItemStatus: item.status,
      };
    });

    const labourEntriesWithWorkItem = (submission.labourEntries || []).map((entry) => ({
      ...entry,
      workItemName: entry.workItemId
        ? workItemMap[entry.workItemId.toString()]?.workItemName || null
        : null,
    }));

    const populatedSubmission = {
      ...submission,
      labourEntries: labourEntriesWithWorkItem,
      totals,
      phase: phase
        ? {
            phaseName: phase.phaseName,
            phaseCode: phase.phaseCode,
            budgetAllocation: phase.budgetAllocation,
            actualSpending: phase.actualSpending,
          }
        : null,
      workItem: submission.workItemId
        ? {
            workItemId: submission.workItemId.toString(),
            workItemName: workItemMap[submission.workItemId.toString()]?.workItemName || null,
            workItemStatus: workItemMap[submission.workItemId.toString()]?.workItemStatus || null,
          }
        : null,
    };

    return successResponse(populatedSubmission, 'Supervisor submission retrieved successfully');
  } catch (error) {
    console.error('GET /api/labour/supervisor-submissions/[id] error:', error);
    return errorResponse('Failed to retrieve supervisor submission', 500);
  }
}

/**
 * PATCH /api/labour/supervisor-submissions/[id]
 * Edit parsed data (owner only)
 * Only allowed if status is 'pending_review' or 'draft'
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

    const hasAccess = await hasPermission(user.id, 'edit_supervisor_submission');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to edit supervisor submissions.', 403);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid submission ID is required', 400);
    }

    const body = await request.json();
    const db = await getDatabase();

    // Get existing submission
    const existingSubmission = await db.collection('supervisor_submissions').findOne({
      _id: new ObjectId(id),
    });

    if (!existingSubmission) {
      return errorResponse('Supervisor submission not found', 404);
    }

    // Only allow edits if pending review or draft
    if (!['pending_review', 'draft'].includes(existingSubmission.status)) {
      return errorResponse('Cannot edit submission that is not pending review', 400);
    }

    // Track corrections
    const corrections = existingSubmission.corrections || [];
    if (body.labourEntries && Array.isArray(body.labourEntries)) {
      // Compare and track changes
      body.labourEntries.forEach((newEntry, index) => {
        const oldEntry = existingSubmission.labourEntries[index];
        if (oldEntry) {
          if (oldEntry.workerName !== newEntry.workerName) {
            corrections.push({
              field: `entry_${index}_workerName`,
              originalValue: oldEntry.workerName,
              correctedValue: newEntry.workerName,
            });
          }
          if (oldEntry.hours !== newEntry.hours) {
            corrections.push({
              field: `entry_${index}_hours`,
              originalValue: oldEntry.hours.toString(),
              correctedValue: newEntry.hours.toString(),
            });
          }
          if (oldEntry.hourlyRate !== newEntry.hourlyRate) {
            corrections.push({
              field: `entry_${index}_hourlyRate`,
              originalValue: oldEntry.hourlyRate.toString(),
              correctedValue: newEntry.hourlyRate.toString(),
            });
          }
        }
      });
    }

    // Update submission
    const updatedData = {
      ...existingSubmission,
      ...body,
      corrections,
      updatedAt: new Date(),
    };

    // Validate updated submission
    const validation = validateSupervisorSubmission(updatedData);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    await db.collection('supervisor_submissions').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: updatedData,
      }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'SUPERVISOR_SUBMISSION',
      entityId: id,
      projectId: existingSubmission.projectId.toString(),
      changes: {
        before: existingSubmission,
        after: updatedData,
        corrections: corrections.slice(existingSubmission.corrections?.length || 0),
      },
    });

    // Get updated submission
    const updatedSubmission = await db.collection('supervisor_submissions').findOne({
      _id: new ObjectId(id),
    });

    return successResponse(updatedSubmission, 'Supervisor submission updated successfully');
  } catch (error) {
    console.error('PATCH /api/labour/supervisor-submissions/[id] error:', error);
    return errorResponse(error.message || 'Failed to update supervisor submission', 500);
  }
}

