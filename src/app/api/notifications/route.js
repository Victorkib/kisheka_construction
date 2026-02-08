/**
 * Notifications API Route
 * GET: Get user notifications
 * PATCH: Mark notifications as read
 * 
 * GET /api/notifications
 * PATCH /api/notifications
 * Auth: All authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth-helpers';
import {
  getUserNotifications,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
} from '@/lib/notifications';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * Returns user notifications
 * Query params: projectId (optional), isRead (optional), limit (optional)
 */
export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const isRead = searchParams.get('isRead');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');

    let notifications = await getUserNotifications(userProfile._id.toString(), {
      projectId: projectId || undefined,
      isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
      type: type || undefined,
      limit,
    });

    // Apply search filter if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      notifications = notifications.filter(
        (notif) =>
          notif.title?.toLowerCase().includes(searchLower) ||
          notif.message?.toLowerCase().includes(searchLower)
      );
    }

    const unreadCount = await getUnreadNotificationCount(
      userProfile._id.toString(),
      projectId || undefined
    );

    return successResponse({
      notifications,
      unreadCount,
      total: notifications.length,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return errorResponse('Failed to retrieve notifications', 500);
  }
}

/**
 * PATCH /api/notifications
 * Marks all notifications as read
 * Body: { projectId?: string }
 */
export async function PATCH(request) {
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

    const body = await request.json().catch(() => ({}));
    const { projectId } = body;

    const markedCount = await markAllNotificationsAsRead(
      userProfile._id.toString(),
      projectId || undefined
    );

    return successResponse({
      markedCount,
      message: `Marked ${markedCount} notification(s) as read`,
    });
  } catch (error) {
    console.error('Mark notifications as read error:', error);
    return errorResponse('Failed to mark notifications as read', 500);
  }
}

