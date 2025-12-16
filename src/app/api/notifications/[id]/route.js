/**
 * Notification Delete API Route
 * DELETE: Delete a notification
 * 
 * DELETE /api/notifications/[id]
 * Auth: All authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth-helpers';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * DELETE /api/notifications/[id]
 * Deletes a notification
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid notification ID', 400);
    }

    const db = await getDatabase();

    // Verify ownership and delete
    const result = await db.collection('notifications').deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userProfile._id),
    });

    if (result.deletedCount === 0) {
      return errorResponse('Notification not found or access denied', 404);
    }

    return successResponse(
      { notificationId: id },
      'Notification deleted successfully'
    );
  } catch (error) {
    console.error('Delete notification error:', error);
    return errorResponse('Failed to delete notification', 500);
  }
}







