/**
 * Activate User API Route
 * POST: Activate a deactivated user
 * 
 * POST /api/users/[id]/activate
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/users/[id]/activate
 * Activates a deactivated user
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
    const canManage = await hasPermission(user.id, 'manage_users');
    if (!canManage) {
      return errorResponse('Permission denied. Only OWNER can activate users.', 403);
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

    if (existingUser.status === 'active') {
      return errorResponse('User is already active', 400);
    }

    // Activate user
    await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'active',
          updatedAt: new Date(),
          deletedAt: null,
        },
      }
    );

    // Log the activation
    await db.collection('role_changes').insertOne({
      userId: new ObjectId(id),
      oldRole: existingUser.status || 'inactive',
      newRole: 'active',
      changedBy: user.id,
      reason: 'User activated by owner',
      timestamp: new Date(),
    });

    return successResponse(null, 'User activated successfully');
  } catch (error) {
    console.error('Error activating user:', error);
    return errorResponse('Failed to activate user', 500);
  }
}



