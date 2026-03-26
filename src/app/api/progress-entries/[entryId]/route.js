/**
 * Single Progress Entry API
 *
 * DELETE /api/progress-entries/[entryId]
 *
 * Auth: authenticated
 * Permissions: OWNER / PM / project_manager can delete
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { successResponse, errorResponse } from '@/lib/api-response';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const role = userProfile.role?.toLowerCase();
    const allowedRoles = ['owner', 'pm', 'project_manager'];
    if (!allowedRoles.includes(role)) {
      return errorResponse('Insufficient permissions. Only OWNER and PM can delete evidence entries.', 403);
    }

    const { entryId } = await params;
    if (!ObjectId.isValid(entryId)) {
      return errorResponse('Invalid entry ID', 400);
    }

    const db = await getDatabase();

    const entry = await db.collection('progress_entries').findOne({
      _id: new ObjectId(entryId),
      deletedAt: null,
    });

    if (!entry) {
      return errorResponse('Progress entry not found', 404);
    }

    const now = new Date();
    await db.collection('progress_entries').updateOne(
      { _id: new ObjectId(entryId) },
      {
        $set: {
          deletedAt: now,
          updatedAt: now,
          updatedBy: userProfile._id,
        },
      }
    );

    return successResponse(
      { _id: entry._id, deletedAt: now },
      'Progress entry deleted successfully'
    );
  } catch (error) {
    console.error('Delete progress entry error:', error);
    return errorResponse('Failed to delete progress entry', 500);
  }
}

