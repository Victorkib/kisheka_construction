/**
 * Bulk Worker Creation API Route
 * POST: Create multiple worker profiles at once
 * 
 * POST /api/labour/workers/bulk
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createWorkerProfile, validateWorkerProfile } from '@/lib/schemas/worker-profile-schema';
import { generateEmployeeId } from '@/lib/generators/employee-id-generator';

/**
 * POST /api/labour/workers/bulk
 * Creates multiple worker profiles at once
 * Auth: OWNER only
 * Body: { workers: Array<WorkerProfileData> }
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const session = null; // We'll use transactions if needed
  let db = null;

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
    const { workers } = body;

    if (!Array.isArray(workers) || workers.length === 0) {
      return errorResponse('Workers array is required and must not be empty', 400);
    }

    if (workers.length > 100) {
      return errorResponse('Cannot create more than 100 workers at once', 400);
    }

    db = await getDatabase();

    const created = [];
    const failed = [];

    // Process each worker
    for (let i = 0; i < workers.length; i++) {
      const workerData = workers[i];
      
      try {
        // Auto-generate employeeId if not provided
        if (!workerData.employeeId || workerData.employeeId.trim() === '') {
          workerData.employeeId = await generateEmployeeId({ session, db });
        }

        // Validate worker profile data
        const validation = validateWorkerProfile(workerData);
        if (!validation.isValid) {
          failed.push({
            index: i,
            workerName: workerData.workerName || workerData.employeeId,
            employeeId: workerData.employeeId,
            error: `Validation failed: ${validation.errors.join(', ')}`,
          });
          continue;
        }

        // Create worker profile object
        const workerProfile = createWorkerProfile(workerData);

        // Check if employeeId already exists
        const existing = await db.collection('worker_profiles').findOne({
          employeeId: workerProfile.employeeId,
          deletedAt: null,
        });

        if (existing) {
          failed.push({
            index: i,
            workerName: workerData.workerName || workerData.employeeId,
            employeeId: workerData.employeeId,
            error: 'Worker with this employee ID already exists',
          });
          continue;
        }

        // Check if userId already has a profile (if userId provided)
        if (workerProfile.userId) {
          const existingUserProfile = await db.collection('worker_profiles').findOne({
            userId: workerProfile.userId,
            deletedAt: null,
          });

          if (existingUserProfile) {
            failed.push({
              index: i,
              workerName: workerData.workerName || workerData.employeeId,
              employeeId: workerData.employeeId,
              error: 'User already has a worker profile',
            });
            continue;
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

        created.push({
          _id: result.insertedId,
          workerName: createdProfile.workerName,
          employeeId: createdProfile.employeeId,
        });
      } catch (error) {
        console.error(`Error creating worker ${i + 1}:`, error);
        failed.push({
          index: i,
          workerName: workerData.workerName || workerData.employeeId || `Worker ${i + 1}`,
          employeeId: workerData.employeeId || 'N/A',
          error: error.message || 'Unknown error',
        });
      }
    }

    return successResponse(
      {
        created,
        failed,
        total: workers.length,
        successCount: created.length,
        failedCount: failed.length,
      },
      `Successfully created ${created.length} of ${workers.length} worker profile${workers.length !== 1 ? 's' : ''}`
    );
  } catch (error) {
    console.error('POST /api/labour/workers/bulk error:', error);
    return errorResponse(error.message || 'Failed to create worker profiles', 500);
  }
}
