/**
 * Users by Role API Route
 * GET: List users with specific role (including workers)
 *
 * GET /api/users/by-role/worker
 * GET /api/users/by-role/pm
 * GET /api/users/by-role/owner
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/users/by-role/[role]
 * Returns users with specific role
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const hasViewPermission = await hasPermission(user.id, 'view_users');
    if (!hasViewPermission) {
      // Allow workers to view other workers
      if (userProfile.role !== 'worker') {
        return errorResponse('Permission denied', 403);
      }
    }

    const { role } = await params;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status') || 'active';
    const limit = parseInt(searchParams.get('limit') || '100');

    const db = await getDatabase();

    // Build query based on role
    const query = {};
    
    if (role === 'worker') {
      // For workers, also include worker_profiles
      const workerProfilesQuery = {
        deletedAt: null,
        status: status || 'active'
      };

      if (search) {
        workerProfilesQuery.$or = [
          { workerName: { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      // Get worker profiles
      const workerProfiles = await db.collection('worker_profiles')
        .find(workerProfilesQuery)
        .limit(limit)
        .toArray();

      // Enrich with user data if userId exists
      const enrichedWorkers = await Promise.all(
        workerProfiles.map(async (worker) => {
          if (worker.userId) {
            const userData = await db.collection('users').findOne({
              _id: worker.userId
            });
            return {
              ...worker,
              user: userData ? {
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName
              } : null
            };
          }
          return worker;
        })
      );

      return successResponse({
        workers: enrichedWorkers,
        count: enrichedWorkers.length
      }, 'Workers retrieved successfully');
    } else {
      // For other roles, query users collection
      if (role) {
        query.role = { $in: [role, role.toUpperCase()] };
      }

      if (status) {
        query.status = status;
      }

      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      const users = await db.collection('users')
        .find(query)
        .limit(limit)
        .toArray();

      // Remove sensitive data
      const formattedUsers = users.map(u => {
        const { password, ...safeUser } = u;
        return safeUser;
      });

      return successResponse({
        users: formattedUsers,
        count: formattedUsers.length
      }, 'Users retrieved successfully');
    }
  } catch (error) {
    console.error('Get users by role error:', error);
    return errorResponse('Failed to retrieve users', 500);
  }
}
