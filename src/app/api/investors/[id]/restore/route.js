/**
 * Restore Investor API Route
 * POST /api/investors/[id]/restore
 * Restores an archived investor
 * Auth: OWNER only
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { recalculateProjectFinances } from '@/lib/financial-helpers';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can restore investors
    const canManage = await hasPermission(user.id, 'manage_investors');
    if (!canManage) {
      return errorResponse('Permission denied. Only OWNER can restore investors.', 403);
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

    // Check if investor is archived
    if (existingInvestor.status !== 'ARCHIVED') {
      return errorResponse('Investor is not archived', 400);
    }

    // Restore investor
    const result = await db
      .collection('investors')
      .updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'ACTIVE',
            updatedAt: new Date(),
          },
        }
      );

    if (result.matchedCount === 0) {
      return errorResponse('Investor not found or restore failed', 404);
    }

    // Recalculate project finances for all projects this investor has allocations to
    const allocations = existingInvestor.projectAllocations || [];
    const projectIds = new Set();
    
    for (const allocation of allocations) {
      if (allocation.projectId) {
        const projectIdStr = allocation.projectId.toString ? allocation.projectId.toString() : String(allocation.projectId);
        if (projectIdStr && ObjectId.isValid(projectIdStr)) {
          projectIds.add(projectIdStr);
        }
      }
    }

    // Recalculate finances for each affected project (async, non-blocking)
    projectIds.forEach((projectId) => {
      recalculateProjectFinances(projectId)
        .then(() => {
          console.log(`✅ Project finances updated for project ${projectId} after investor restore`);
        })
        .catch((error) => {
          console.error(`❌ Error updating project finances for project ${projectId}:`, error);
        });
    });

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'RESTORED',
      entityType: 'INVESTOR',
      entityId: id,
      changes: {
        status: {
          oldValue: 'ARCHIVED',
          newValue: 'ACTIVE',
        },
      },
    });

    return successResponse(
      {
        investorId: id,
        restored: true,
        allocationsCount: allocations.length,
      },
      'Investor restored successfully. Project finances have been recalculated for all affected projects.'
    );
  } catch (error) {
    console.error('Restore investor error:', error);
    return errorResponse('Failed to restore investor', 500);
  }
}

