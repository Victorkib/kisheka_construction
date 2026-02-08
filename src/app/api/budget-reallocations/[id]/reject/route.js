/**
 * Budget Reallocation Reject API Route
 * POST: Reject a budget reallocation request
 * 
 * POST /api/budget-reallocations/[id]/reject
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { REALLOCATION_STATUSES } from '@/lib/schemas/budget-reallocation-schema';

/**
 * POST /api/budget-reallocations/[id]/reject
 * Rejects a budget reallocation request
 * Auth: PM, OWNER, ACCOUNTANT
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
    const hasRejectPermission = await hasPermission(user.id, 'reject_budget_reallocation');
    if (!hasRejectPermission) {
      return errorResponse('Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can reject budget reallocations.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid reallocation ID', 400);
    }

    const body = await request.json();
    const { rejectionReason } = body;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return errorResponse('Rejection reason is required', 400);
    }

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Get reallocation request
    const reallocation = await db.collection('budget_reallocations').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!reallocation) {
      return errorResponse('Budget reallocation request not found', 404);
    }

    if (reallocation.status !== REALLOCATION_STATUSES.PENDING) {
      return errorResponse(`Cannot reject reallocation with status: ${reallocation.status}`, 400);
    }

    // Update reallocation request
    const updatedReallocation = await db.collection('budget_reallocations').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: REALLOCATION_STATUSES.REJECTED,
          rejectedBy: new ObjectId(userProfile._id),
          rejectionReason: rejectionReason.trim(),
          rejectedAt: new Date(),
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'REJECTED',
      entityType: 'BUDGET_REALLOCATION',
      entityId: id,
      projectId: reallocation.projectId.toString(),
      changes: {
        status: { oldValue: REALLOCATION_STATUSES.PENDING, newValue: REALLOCATION_STATUSES.REJECTED },
        rejectedBy: userProfile._id.toString(),
        rejectionReason: rejectionReason.trim()
      },
    });

    return successResponse(
      updatedReallocation,
      'Budget reallocation rejected successfully'
    );
  } catch (error) {
    console.error('Reject budget reallocation error:', error);
    return errorResponse(error.message || 'Failed to reject budget reallocation', 500);
  }
}



