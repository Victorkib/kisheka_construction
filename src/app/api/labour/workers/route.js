/**
 * Worker Profiles API Route
 * GET: List all worker profiles with filters
 * POST: Create new worker profile
 * 
 * GET /api/labour/workers
 * POST /api/labour/workers
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createWorkerProfile, validateWorkerProfile } from '@/lib/schemas/worker-profile-schema';

/**
 * GET /api/labour/workers
 * Returns worker profiles with filtering, sorting, and pagination
 * Auth: All authenticated users
 * Query params: workerType, status, skillType, search, page, limit, sortBy, sortOrder
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const workerType = searchParams.get('workerType');
    const status = searchParams.get('status');
    const skillType = searchParams.get('skillType');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const db = await getDatabase();

    // Build query - exclude soft-deleted workers
    const query = {
      deletedAt: null, // Exclude soft-deleted workers
    };

    if (workerType) {
      query.workerType = workerType;
    }

    if (status) {
      query.status = status;
    }

    if (skillType) {
      query.skillTypes = skillType;
    }

    // Search filter
    if (search) {
      query.$or = [
        { workerName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const skip = (page - 1) * limit;
    const workers = await db
      .collection('worker_profiles')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const total = await db.collection('worker_profiles').countDocuments(query);

    // Calculate statistics for each worker
    const workersWithStats = await Promise.all(
      workers.map(async (worker) => {
        // Get labour entry statistics
        const workerIdMatches = [];
        if (worker.userId) {
          workerIdMatches.push(worker.userId);
        }
        workerIdMatches.push(worker._id);

        const stats = await db.collection('labour_entries').aggregate([
          {
            $match: {
              workerId: { $in: workerIdMatches },
              status: { $in: ['approved', 'paid'] },
              deletedAt: null,
            },
          },
          {
            $group: {
              _id: null,
              totalHours: { $sum: '$totalHours' },
              totalEarned: { $sum: '$totalCost' },
              entryCount: { $sum: 1 },
              averageRating: { $avg: '$qualityRating' },
            },
          },
        ]).toArray();

        const workerStats = stats[0] || {
          totalHours: 0,
          totalEarned: 0,
          entryCount: 0,
          averageRating: 0,
        };

        return {
          ...worker,
          statistics: {
            totalHoursWorked: workerStats.totalHours,
            totalEarned: workerStats.totalEarned,
            entryCount: workerStats.entryCount,
            averageRating: workerStats.averageRating || 0,
          },
        };
      })
    );

    return successResponse(
      {
        workers: workersWithStats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Worker profiles retrieved successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/workers error:', error);
    return errorResponse('Failed to retrieve worker profiles', 500);
  }
}

/**
 * POST /api/labour/workers
 * Creates a new worker profile
 * Auth: OWNER only
 */
export async function POST(request) {
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

    const hasAccess = await hasPermission(user.id, 'create_worker_profile');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to create worker profiles.', 403);
    }

    const body = await request.json();

    // Validate worker profile data
    const validation = validateWorkerProfile(body);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Create worker profile object
    const workerProfile = createWorkerProfile(body);

    const db = await getDatabase();

    // Check if employeeId already exists
    const existing = await db.collection('worker_profiles').findOne({
      employeeId: workerProfile.employeeId,
    });

    if (existing) {
      return errorResponse('Worker with this employee ID already exists', 400);
    }

    // Check if userId already has a profile (if userId provided)
    if (workerProfile.userId) {
      const existingUserProfile = await db.collection('worker_profiles').findOne({
        userId: workerProfile.userId,
      });

      if (existingUserProfile) {
        return errorResponse('User already has a worker profile', 400);
      }
    }

    // Insert worker profile
    const result = await db.collection('worker_profiles').insertOne(workerProfile);

    const createdProfile = { ...workerProfile, _id: result.insertedId };

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'WORKER_PROFILE',
      entityId: result.insertedId.toString(),
      projectId: null,
      changes: {
        created: createdProfile,
      },
    });

    return successResponse(createdProfile, 'Worker profile created successfully');
  } catch (error) {
    console.error('POST /api/labour/workers error:', error);
    return errorResponse(error.message || 'Failed to create worker profile', 500);
  }
}

