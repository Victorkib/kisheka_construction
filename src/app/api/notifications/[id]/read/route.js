/**
 * Notification Read API Route
 * PATCH: Mark a notification as read
 * 
 * PATCH /api/notifications/[id]/read
 * Auth: All authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth-helpers';
import { markNotificationAsRead } from '@/lib/notifications';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * PATCH /api/notifications/[id]/read
 * Marks a notification as read
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

    const marked = await markNotificationAsRead(id, userProfile._id.toString());

    if (!marked) {
      return errorResponse('Notification not found or already read', 404);
    }

    return successResponse(
      { notificationId: id },
      'Notification marked as read'
    );
  } catch (error) {
    console.error('Mark notification as read error:', error);
    return errorResponse('Failed to mark notification as read', 500);
  }
}

