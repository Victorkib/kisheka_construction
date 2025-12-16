/**
 * Notification Unread API Route
 * PATCH: Mark a notification as unread
 * 
 * PATCH /api/notifications/[id]/unread
 * Auth: All authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth-helpers';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * PATCH /api/notifications/[id]/unread
 * Marks a notification as unread
 */
export async function PATCH(request, { params }) {
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

    // Verify ownership and mark as unread
    const result = await db.collection('notifications').updateOne(
      {
        _id: new ObjectId(id),
        userId: new ObjectId(userProfile._id),
      },
      {
        $set: {
          isRead: false,
          readAt: null,
        },
      }
    );

    if (result.matchedCount === 0) {
      return errorResponse('Notification not found or access denied', 404);
    }

    return successResponse(
      { notificationId: id },
      'Notification marked as unread'
    );
  } catch (error) {
    console.error('Mark notification as unread error:', error);
    return errorResponse('Failed to mark notification as unread', 500);
  }
}







