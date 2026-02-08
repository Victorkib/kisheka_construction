/**
 * Floors API Route
 * GET: List floors (optionally filtered by project)
 * POST: Create new floor (PM, OWNER only)
 * 
 * GET /api/floors?projectId=xxx
 * POST /api/floors
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/floors
 * Returns floors, optionally filtered by projectId
 * Auth: All authenticated users
 * Query params: projectId (optional)
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const db = await getDatabase();
    
    // Build query - floors are now project-specific
    const query = { deletedAt: null };
    if (projectId) {
      if (!ObjectId.isValid(projectId)) {
        return errorResponse('Invalid project ID', 400);
      }
      query.projectId = new ObjectId(projectId);
    }

    const floors = await db
      .collection('floors')
      .find(query)
      .sort({ floorNumber: 1 })
      .toArray();

    // Add usage counts for each floor (materials, requests, POs)
    const floorsWithUsage = await Promise.all(
      floors.map(async (floor) => {
        const [materialsCount, requestsCount, purchaseOrdersCount] = await Promise.all([
          db.collection('materials').countDocuments({
            floor: floor._id,
            deletedAt: null,
          }),
          db.collection('material_requests').countDocuments({
            floorId: floor._id,
            deletedAt: null,
          }),
          db.collection('purchase_orders').countDocuments({
            floorId: floor._id,
            deletedAt: null,
          }),
        ]);
        return {
          ...floor,
          usageCount: materialsCount,
          materialsCount,
          requestsCount,
          purchaseOrdersCount,
        };
      })
    );

    return successResponse(floorsWithUsage, 'Floors retrieved successfully');
  } catch (error) {
    console.error('Get floors error:', error);
    return errorResponse('Failed to retrieve floors', 500);
  }
}

/**
 * POST /api/floors
 * Creates a new floor for a project
 * Auth: PM, OWNER only
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

    const userRole = userProfile.role?.toLowerCase();
    const canCreate = ['owner', 'pm', 'project_manager'].includes(userRole);
    if (!canCreate) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can create floors.', 403);
    }

    const body = await request.json();
    const {
      projectId,
      floorNumber,
      name,
      description = '',
      status = 'NOT_STARTED',
      totalBudget = 0,
      actualCost = 0,
      startDate = null,
      completionDate = null,
    } = body;

    // Validation
    if (!projectId) {
      return errorResponse('Project ID is required', 400);
    }

    if (!ObjectId.isValid(projectId)) {
      return errorResponse('Invalid project ID', 400);
    }

    if (floorNumber === undefined || floorNumber === null) {
      return errorResponse('Floor number is required', 400);
    }

    if (typeof floorNumber !== 'number' || floorNumber < -10 || floorNumber > 100) {
      return errorResponse('Floor number must be between -10 (Basement 10) and 100', 400);
    }

    if (!name || name.trim().length === 0) {
      return errorResponse('Floor name is required', 400);
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Check if floor number already exists for this project
    const existing = await db.collection('floors').findOne({
      projectId: new ObjectId(projectId),
      floorNumber: floorNumber,
    });

    if (existing) {
      return errorResponse(`Floor ${floorNumber} already exists for this project`, 400);
    }

    // Validate status
    const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];
    if (status && !validStatuses.includes(status)) {
      return errorResponse(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    // Create floor
    const floor = {
      projectId: new ObjectId(projectId),
      floorNumber: floorNumber,
      name: name.trim(),
      description: description?.trim() || '',
      status: status || 'NOT_STARTED',
      totalBudget: parseFloat(totalBudget) || 0,
      actualCost: parseFloat(actualCost) || 0,
      startDate: startDate ? new Date(startDate) : null,
      completionDate: completionDate ? new Date(completionDate) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('floors').insertOne(floor);

    const insertedFloor = { ...floor, _id: result.insertedId };

    return successResponse(insertedFloor, 'Floor created successfully', 201);
  } catch (error) {
    console.error('Create floor error:', error);
    return errorResponse('Failed to create floor', 500);
  }
}

