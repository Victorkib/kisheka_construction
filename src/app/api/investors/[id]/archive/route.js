/**
 * Archive Investor API Route
 * POST /api/investors/[id]/archive
 * Archives an investor (soft delete)
 * Auth: OWNER only
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can archive investors
    const canManage = await hasPermission(user.id, 'manage_investors');
    if (!canManage) {
      return errorResponse('Permission denied. Only OWNER can archive investors.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid investor ID', 400);
    }

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);

    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Check if investor exists
    const existingInvestor = await db
      .collection('investors')
      .findOne({ _id: new ObjectId(id) });

    if (!existingInvestor) {
      return errorResponse('Investor not found', 404);
    }

    // Check if investor is already archived
    if (existingInvestor.status === 'ARCHIVED') {
      return errorResponse('Investor is already archived', 400);
    }

    // Get allocations count for summary
    const allocationsCount = (existingInvestor.projectAllocations || []).length;

    // Archive investor (soft delete)
    const result = await db
      .collection('investors')
      .updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'ARCHIVED',
            updatedAt: new Date(),
          },
        }
      );

    if (result.matchedCount === 0) {
      return errorResponse('Investor not found or archive failed', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'ARCHIVED',
      entityType: 'INVESTOR',
      entityId: id,
      changes: {
        status: {
          oldValue: existingInvestor.status,
          newValue: 'ARCHIVED',
        },
      },
    });

    return successResponse(
      {
        investorId: id,
        archived: true,
        allocationsCount,
      },
      'Investor archived successfully. All allocations and financial records have been preserved.'
    );
  } catch (error) {
    console.error('Archive investor error:', error);
    return errorResponse('Failed to archive investor', 500);
  }
}

