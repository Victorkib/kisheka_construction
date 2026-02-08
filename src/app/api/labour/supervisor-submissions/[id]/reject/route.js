/**
 * Reject Supervisor Submission API Route
 * POST: Reject submission
 * 
 * POST /api/labour/supervisor-submissions/[id]/reject
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/labour/supervisor-submissions/[id]/reject
 * Reject submission
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

    const hasAccess = await hasPermission(user.id, 'reject_supervisor_submission');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to reject supervisor submissions.', 403);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid submission ID is required', 400);
    }

    const body = await request.json();
    const { rejectionReason } = body;

    if (!rejectionReason || rejectionReason.trim().length < 5) {
      return errorResponse('Rejection reason is required and must be at least 5 characters', 400);
    }

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

    // Update submission status
    await db.collection('supervisor_submissions').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'rejected',
          reviewedBy: new ObjectId(userProfile._id),
          reviewedAt: new Date(),
          reviewNotes: rejectionReason,
          updatedAt: new Date(),
        },
      }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'REJECTED',
      entityType: 'SUPERVISOR_SUBMISSION',
      entityId: id,
      projectId: submission.projectId.toString(),
      changes: {
        submission: submission.submissionNumber,
        rejectionReason,
      },
    });

    // TODO: Notify supervisor of rejection

    // Get updated submission
    const updatedSubmission = await db.collection('supervisor_submissions').findOne({
      _id: new ObjectId(id),
    });

    return successResponse(updatedSubmission, 'Supervisor submission rejected');
  } catch (error) {
    console.error('POST /api/labour/supervisor-submissions/[id]/reject error:', error);
    return errorResponse(error.message || 'Failed to reject supervisor submission', 500);
  }
}

