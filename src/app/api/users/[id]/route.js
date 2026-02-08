/**
 * User Detail API Route
 * GET: Get user details (OWNER only)
 * PATCH: Update user (role, status, etc.) (OWNER only)
 * DELETE: Soft delete user (OWNER only)
 * 
 * GET /api/users/[id]
 * PATCH /api/users/[id]
 * DELETE /api/users/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { sendRoleChangeEmail } from '@/lib/email-service';
import { createNotification } from '@/lib/notifications';
import { createAuditLog } from '@/lib/audit-log';

import { VALID_ROLES } from '@/lib/role-constants';
import { normalizeRole } from '@/lib/role-normalizer';

/**
 * GET /api/users/[id]
 * Returns user details
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
      return errorResponse('Permission denied. Only OWNER can view users.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid user ID', 400);
    }

    const db = await getDatabase();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(id) });

    if (!userDoc) {
      return errorResponse('User not found', 404);
    }

    // Get role change history
    const roleHistory = await db
      .collection('role_changes')
      .find({ userId: new ObjectId(id) })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    // Get user activity (recent logins, etc.)
    const recentActivity = await db
      .collection('audit_logs')
      .find({ userId: userDoc.supabaseId })
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    // Remove sensitive data
    const { password, ...safeUser } = userDoc;

    return successResponse({
      ...safeUser,
      id: safeUser._id?.toString(),
      _id: undefined,
      roleHistory: roleHistory.map((change) => ({
        ...change,
        id: change._id?.toString(),
        _id: undefined,
        userId: change.userId?.toString(),
      })),
      recentActivity: recentActivity.map((activity) => ({
        ...activity,
        id: activity._id?.toString(),
        _id: undefined,
      })),
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return errorResponse('Failed to fetch user', 500);
  }
}

/**
 * PATCH /api/users/[id]
 * Updates user (role, status, etc.)
 * Auth: OWNER only
 * Body: { role, status, firstName, lastName }
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'manage_users');
    if (!canManage) {
      return errorResponse('Permission denied. Only OWNER can update users.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid user ID', 400);
    }

    const body = await request.json();
    const { role, status, firstName, lastName } = body;

    const db = await getDatabase();

    // Get existing user
    const existingUser = await db.collection('users').findOne({ _id: new ObjectId(id) });

    if (!existingUser) {
      return errorResponse('User not found', 404);
    }

    // Prevent changing owner role (security measure)
    if (existingUser.role?.toLowerCase() === 'owner' && role && role.toLowerCase() !== 'owner') {
      return errorResponse('Cannot change owner role', 403);
    }

    // Prevent assigning owner role (only one owner should exist)
    if (role && role.toLowerCase() === 'owner' && existingUser.role?.toLowerCase() !== 'owner') {
      const ownerCount = await db.collection('users').countDocuments({ role: 'owner', _id: { $ne: new ObjectId(id) } });
      if (ownerCount > 0) {
        return errorResponse('Cannot assign owner role. An owner already exists.', 403);
      }
    }

    // Validate role
    if (role && !VALID_ROLES.includes(role.toLowerCase())) {
      return errorResponse(`Invalid role. Valid roles are: ${VALID_ROLES.join(', ')}`, 400);
    }

    // Validate status
    if (status && !['active', 'inactive', 'suspended'].includes(status)) {
      return errorResponse('Invalid status. Valid statuses are: active, inactive, suspended', 400);
    }

    // Build update object
    const updateData = {
      updatedAt: new Date(),
    };

    if (role !== undefined) {
      // Normalize role using utility function
      const normalizedRole = normalizeRole(role);
      updateData.role = normalizedRole;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    if (firstName !== undefined) {
      updateData.firstName = firstName.trim();
    }

    if (lastName !== undefined) {
      updateData.lastName = lastName.trim();
    }

    // Update user
    await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Get updated user before processing role change
    const updatedUser = await db.collection('users').findOne({ _id: new ObjectId(id) });

    // Log role change if role was changed
    if (role) {
      const oldRole = normalizeRole(existingUser.role) || 'unknown';
      const newRole = normalizeRole(role);
      
      if (oldRole !== newRole) {
        const changerProfile = await getUserProfile(user.id);
        const changerName = changerProfile
          ? `${changerProfile.firstName || ''} ${changerProfile.lastName || ''}`.trim() || changerProfile.email
          : 'System Administrator';

        // Log to role_changes collection
        await db.collection('role_changes').insertOne({
          userId: new ObjectId(id),
          oldRole,
          newRole,
          changedBy: user.id,
          reason: body.reason || 'Role updated by owner',
          timestamp: new Date(),
        });

        // Create audit log entry
        try {
          await createAuditLog({
            userId: id,
            action: 'ROLE_CHANGED',
            entityType: 'USER',
            entityId: id,
            changes: {
              role: {
                oldValue: oldRole,
                newValue: newRole,
              },
            },
            status: 'SUCCESS',
          });
        } catch (auditError) {
          console.error('Failed to create audit log:', auditError);
        }

        // Create in-app notification for the user
        try {
          const roleDisplay = (r) => {
            const map = {
              owner: 'Owner',
              investor: 'Investor',
              pm: 'Project Manager',
              supervisor: 'Supervisor',
              site_clerk: 'Clerk',
              accountant: 'Accountant',
              supplier: 'Supplier',
            };
            return map[r] || r;
          };

          await createNotification({
            userId: id,
            type: 'role_changed',
            title: 'Your Role Has Been Updated',
            message: `Your role has been changed from ${roleDisplay(oldRole)} to ${roleDisplay(newRole)} by ${changerName}.${body.reason ? ` Reason: ${body.reason}` : ''}`,
            relatedModel: 'USER',
            relatedId: id,
            createdBy: changerProfile?._id?.toString(),
          });
        } catch (notificationError) {
          console.error('Failed to create notification:', notificationError);
        }

        // Send notification email to user about role change
        try {
          await sendRoleChangeEmail({
            email: updatedUser.email,
            userName: `${updatedUser.firstName || ''} ${updatedUser.lastName || ''}`.trim() || updatedUser.email,
            oldRole,
            newRole,
            changedBy: changerName,
            reason: body.reason,
          });
        } catch (emailError) {
          console.error('Failed to send role change email:', emailError);
          // Don't fail the request if email fails
        }
      }
    }

    const { password, ...safeUser } = updatedUser;

    return successResponse(
      {
        ...safeUser,
        id: safeUser._id?.toString(),
        _id: undefined,
      },
      'User updated successfully'
    );
  } catch (error) {
    console.error('Error updating user:', error);
    return errorResponse('Failed to update user', 500);
  }
}

/**
 * DELETE /api/users/[id]
 * Soft delete user (sets status to inactive)
 * Auth: OWNER only
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'revoke_access');
    if (!canManage) {
      return errorResponse('Permission denied. Only OWNER can delete users.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid user ID', 400);
    }

    const db = await getDatabase();

    // Get existing user
    const existingUser = await db.collection('users').findOne({ _id: new ObjectId(id) });

    if (!existingUser) {
      return errorResponse('User not found', 404);
    }

    // Prevent deleting owner
    if (existingUser.role?.toLowerCase() === 'owner') {
      return errorResponse('Cannot delete owner account', 403);
    }

    // Soft delete - set status to inactive
    await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'inactive',
          updatedAt: new Date(),
          deletedAt: new Date(),
        },
      }
    );

    // Log the deletion
    await db.collection('role_changes').insertOne({
      userId: new ObjectId(id),
      oldRole: existingUser.role,
      newRole: 'inactive',
      changedBy: user.id,
      reason: 'User deactivated by owner',
      timestamp: new Date(),
    });

    return successResponse(null, 'User deactivated successfully');
  } catch (error) {
    console.error('Error deleting user:', error);
    return errorResponse('Failed to delete user', 500);
  }
}

