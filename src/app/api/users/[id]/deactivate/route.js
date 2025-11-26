/**
 * Deactivate User API Route
 * POST: Deactivate a user (soft delete)
 * 
 * POST /api/users/[id]/deactivate
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/users/[id]/deactivate
 * Deactivates a user
 * Auth: OWNER only
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'revoke_access');
    if (!canManage) {
      return errorResponse('Permission denied. Only OWNER can deactivate users.', 403);
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

    // Prevent deactivating owner
    if (existingUser.role?.toLowerCase() === 'owner') {
      return errorResponse('Cannot deactivate owner account', 403);
    }

    if (existingUser.status === 'inactive') {
      return errorResponse('User is already inactive', 400);
    }

    // Deactivate user
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

    // Log the deactivation
    await db.collection('role_changes').insertOne({
      userId: new ObjectId(id),
      oldRole: existingUser.status || 'active',
      newRole: 'inactive',
      changedBy: user.id,
      reason: 'User deactivated by owner',
      timestamp: new Date(),
    });

    return successResponse(null, 'User deactivated successfully');
  } catch (error) {
    console.error('Error deactivating user:', error);
    return errorResponse('Failed to deactivate user', 500);
  }
}



