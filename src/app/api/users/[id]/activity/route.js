/**
 * User Activity API Route
 * GET: Get user activity history (logins, actions, etc.)
 * 
 * GET /api/users/[id]/activity
 * Auth: OWNER only
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/users/[id]/activity
 * Returns user activity history
 * Auth: OWNER only
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

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
      return errorResponse('Permission denied. Only OWNER can view user activity.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid user ID', 400);
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const type = searchParams.get('type'); // 'all', 'logins', 'actions', 'role_changes'

    const db = await getDatabase();

    // Verify user exists
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(id) });

    if (!userDoc) {
      return errorResponse('User not found', 404);
    }

    const activities = [];

    // Get login history (from user metadata)
    if (!type || type === 'all' || type === 'logins') {
      // Track login history - we'll need to update this when user logs in
      // For now, we can use lastLogin and metadata
      if (userDoc.lastLogin) {
        activities.push({
          type: 'login',
          timestamp: userDoc.lastLogin,
          description: 'User logged in',
          metadata: {
            loginCount: userDoc.metadata?.loginCount || 0,
          },
        });
      }

      // Add created date as first activity
      if (userDoc.createdAt) {
        activities.push({
          type: 'account_created',
          timestamp: userDoc.createdAt,
          description: 'Account created',
        });
      }
    }

    // Get role changes
    if (!type || type === 'all' || type === 'role_changes') {
      const roleChanges = await db
        .collection('role_changes')
        .find({ userId: new ObjectId(id) })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      for (const change of roleChanges) {
        const changer = change.changedBy
          ? await db.collection('users').findOne({ supabaseId: change.changedBy })
          : null;

        activities.push({
          type: 'role_change',
          timestamp: change.timestamp,
          description: `Role changed from ${change.oldRole || 'N/A'} to ${change.newRole}`,
          metadata: {
            oldRole: change.oldRole,
            newRole: change.newRole,
            reason: change.reason,
            changedBy: changer
              ? `${changer.firstName || ''} ${changer.lastName || ''}`.trim() || changer.email
              : 'System',
          },
        });
      }
    }

    // Get audit logs (user actions)
    if (!type || type === 'all' || type === 'actions') {
      const auditLogs = await db
        .collection('audit_logs')
        .find({ userId: new ObjectId(id) })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      for (const log of auditLogs) {
        activities.push({
          type: 'action',
          timestamp: log.timestamp,
          description: `${log.action} ${log.entityType}`,
          metadata: {
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId?.toString(),
            status: log.status,
            changes: log.changes,
          },
        });
      }
    }

    // Get notifications sent to this user
    if (!type || type === 'all') {
      const notifications = await db
        .collection('notifications')
        .find({ userId: new ObjectId(id) })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();

      for (const notif of notifications) {
        activities.push({
          type: 'notification',
          timestamp: notif.createdAt,
          description: notif.title,
          metadata: {
            notificationType: notif.type,
            message: notif.message,
            isRead: notif.isRead,
            readAt: notif.readAt,
          },
        });
      }
    }

    // Sort all activities by timestamp (newest first)
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit results
    const limitedActivities = activities.slice(0, limit);

    // Format response
    const formattedActivities = limitedActivities.map((activity) => ({
      id: activity.id || `${activity.type}-${activity.timestamp.getTime()}`,
      type: activity.type,
      timestamp: activity.timestamp,
      description: activity.description,
      metadata: activity.metadata || {},
    }));

    // Get summary statistics
    const stats = {
      totalLogins: userDoc.metadata?.loginCount || 0,
      lastLogin: userDoc.lastLogin,
      totalRoleChanges: await db.collection('role_changes').countDocuments({ userId: new ObjectId(id) }),
      totalActions: await db.collection('audit_logs').countDocuments({ userId: new ObjectId(id) }),
      totalNotifications: await db.collection('notifications').countDocuments({ userId: new ObjectId(id) }),
      unreadNotifications: await db.collection('notifications').countDocuments({
        userId: new ObjectId(id),
        isRead: false,
      }),
    };

    return successResponse({
      activities: formattedActivities,
      stats,
      total: formattedActivities.length,
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    return errorResponse('Failed to fetch user activity', 500);
  }
}

