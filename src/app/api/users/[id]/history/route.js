/**
 * User Role History API Route
 * GET: Get role change history for a user
 * 
 * GET /api/users/[id]/history
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/users/[id]/history
 * Returns role change history for a user
 * Auth: OWNER only
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canView = await hasPermission(user.id, 'view_users');
    if (!canView) {
      return errorResponse('Permission denied. Only OWNER can view user history.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid user ID', 400);
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const db = await getDatabase();

    // Verify user exists
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(id) });

    if (!userDoc) {
      return errorResponse('User not found', 404);
    }

    // Get role change history
    const roleHistory = await db
      .collection('role_changes')
      .find({ userId: new ObjectId(id) })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    // Get user details for changedBy fields
    const changedByIds = [...new Set(roleHistory.map((change) => change.changedBy).filter(Boolean))];
    const changers = await db
      .collection('users')
      .find({ supabaseId: { $in: changedByIds } })
      .toArray();

    const changerMap = changers.reduce((acc, changer) => {
      acc[changer.supabaseId] = changer;
      return acc;
    }, {});

    // Format response
    const formattedHistory = roleHistory.map((change) => {
      const changer = changerMap[change.changedBy];
      return {
        id: change._id?.toString(),
        userId: change.userId?.toString(),
        oldRole: change.oldRole,
        newRole: change.newRole,
        reason: change.reason,
        timestamp: change.timestamp,
        changedBy: changer
          ? {
              id: changer._id?.toString(),
              name: `${changer.firstName || ''} ${changer.lastName || ''}`.trim() || changer.email,
              email: changer.email,
            }
          : null,
      };
    });

    return successResponse({
      history: formattedHistory,
      total: formattedHistory.length,
    });
  } catch (error) {
    console.error('Error fetching user history:', error);
    return errorResponse('Failed to fetch user history', 500);
  }
}



