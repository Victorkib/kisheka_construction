/**
 * Initialize Default Floors for Project
 * POST: Creates default floors for a project
 *
 * POST /api/projects/[id]/floors/initialize
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/projects/[id]/floors/initialize
 * Initializes default floors for a project
 * Auth: PM, OWNER only
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
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

    const userRole = userProfile.role?.toLowerCase();
    const canCreate = ['owner', 'pm', 'project_manager'].includes(userRole);
    if (!canCreate) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can initialize floors.', 403);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const db = await getDatabase();

    // Get project
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Check if floors already exist
    const existingFloors = await db.collection('floors').countDocuments({
      projectId: new ObjectId(id),
    });

    if (existingFloors > 0) {
      return errorResponse('Floors already exist for this project. Use manual floor creation instead.', 400);
    }

    const body = await request.json().catch(() => ({}));
    const {
      floorCount,
      includeBasements = false,
      basementCount = 0,
    } = body || {};

    // Build floor templates
    const defaultFloors = [];
    const requestedFloorCount = floorCount !== undefined ? parseInt(floorCount) : 10; // Default: 10
    const maxFloors = Math.min(Math.max(0, requestedFloorCount), 50); // Cap at 50 floors, minimum 0
    const requestedBasementCount = includeBasements
      ? Math.min(Math.max(0, parseInt(basementCount) || 0), 10)
      : 0; // Cap at 10 basements

    if (requestedBasementCount > 0) {
      for (let i = requestedBasementCount; i >= 1; i--) {
        defaultFloors.push({
          projectId: new ObjectId(id),
          floorNumber: -i,
          name: `Basement ${i}`,
          description: `Basement ${i} of ${project.projectName || 'the building'}`,
          status: 'NOT_STARTED',
          startDate: null,
          completionDate: null,
          totalBudget: 0,
          actualCost: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    if (maxFloors > 0) {
      defaultFloors.push({
        projectId: new ObjectId(id),
        floorNumber: 0,
        name: 'Ground Floor',
        description: `Ground Floor of ${project.projectName || 'the building'}`,
        status: 'NOT_STARTED',
        startDate: null,
        completionDate: null,
        totalBudget: 0,
        actualCost: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      for (let i = 1; i <= maxFloors - 1; i++) {
        defaultFloors.push({
          projectId: new ObjectId(id),
          floorNumber: i,
          name: `Floor ${i}`,
          description: `Floor ${i} of ${project.projectName || 'the building'}`,
          status: 'NOT_STARTED',
          startDate: null,
          completionDate: null,
          totalBudget: 0,
          actualCost: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    if (defaultFloors.length === 0) {
      return errorResponse('No floors requested. Increase floor or basement count.', 400);
    }

    const insertResult = await db.collection('floors').insertMany(defaultFloors);

    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'FLOORS_INITIALIZED',
      entityType: 'PROJECT',
      entityId: id,
      projectId: id,
      changes: {
        floorsCreated: insertResult?.insertedCount || defaultFloors.length,
        floorCount: maxFloors,
        basementCount: requestedBasementCount,
      },
    });

    return successResponse(
      {
        floors: defaultFloors,
        count: insertResult?.insertedCount || defaultFloors.length,
      },
      `Successfully initialized ${insertResult?.insertedCount || defaultFloors.length} floors`,
      201
    );
  } catch (error) {
    console.error('Initialize floors error:', error);
    return errorResponse(`Failed to initialize floors: ${error.message}`, 500);
  }
}
