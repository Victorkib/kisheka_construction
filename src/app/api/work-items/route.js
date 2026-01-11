/**
 * Work Items API Route
 * GET: List work items (optionally filtered by project, phase, status, assignedTo)
 * POST: Create new work item (PM, OWNER only)
 * 
 * GET /api/work-items?projectId=xxx&phaseId=xxx&status=xxx&assignedTo=xxx
 * POST /api/work-items
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createWorkItem, validateWorkItem, WORK_ITEM_STATUSES } from '@/lib/schemas/work-item-schema';
import { validateWorkItemDependencies } from '@/lib/work-item-helpers';
import { calculatePhaseCompletionFromWorkItems } from '@/lib/work-item-helpers';

/**
 * GET /api/work-items
 * Returns work items, optionally filtered by projectId, phaseId, status, assignedTo
 * Auth: All authenticated users
 * Query params: projectId (optional), phaseId (optional), status (optional), assignedTo (optional), category (optional), page (optional), limit (optional)
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const db = await getDatabase();

    const query = { deletedAt: null };

    // Filters
    const projectId = searchParams.get('projectId');
    const phaseId = searchParams.get('phaseId');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const category = searchParams.get('category');

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      query.phaseId = new ObjectId(phaseId);
    }

    if (status && WORK_ITEM_STATUSES.includes(status)) {
      query.status = status;
    }

    if (assignedTo && ObjectId.isValid(assignedTo)) {
      query.assignedTo = new ObjectId(assignedTo);
    }

    if (category) {
      query.category = category;
    }

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Sort
    const sortBy = searchParams.get('sortBy') || 'priority';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const sort = sortBy === 'priority' 
      ? { priority: sortOrder === 'asc' ? 1 : -1, createdAt: 1 }
      : { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const workItems = await db.collection('work_items')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Populate phase names for better display
    const phaseIds = [...new Set(workItems.map(item => item.phaseId?.toString()).filter(Boolean))];
    const phases = phaseIds.length > 0 
      ? await db.collection('phases').find({
          _id: { $in: phaseIds.map(id => new ObjectId(id)) },
          deletedAt: null
        }).toArray()
      : [];
    
    const phaseMap = {};
    phases.forEach(phase => {
      phaseMap[phase._id.toString()] = phase.phaseName || phase.name || 'Unknown';
    });

    // Add phase names to work items
    const workItemsWithPhases = workItems.map(item => ({
      ...item,
      phaseName: item.phaseId ? phaseMap[item.phaseId.toString()] : 'Unknown'
    }));

    const total = await db.collection('work_items').countDocuments(query);

    return successResponse({
      workItems: workItemsWithPhases,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Work items retrieved successfully');
  } catch (error) {
    console.error('Get work items error:', error);
    return errorResponse('Failed to retrieve work items', 500);
  }
}

/**
 * POST /api/work-items
 * Creates a new work item for a phase
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

    const hasCreatePermission = await hasPermission(user.id, 'create_work_item');
    if (!hasCreatePermission) {
      // Fallback to role check for backward compatibility and safety
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['owner', 'pm', 'project_manager'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse('Insufficient permissions. Only PM and OWNER can create work items.', 403);
      }
    }

    const body = await request.json();
    const {
      projectId,
      phaseId,
      name,
      description,
      category,
      status,
      assignedTo,
      estimatedHours,
      actualHours,
      estimatedCost,
      actualCost,
      startDate,
      plannedEndDate,
      actualEndDate,
      dependencies,
      floorId,
      categoryId,
      priority,
      notes
    } = body;

    // Validation
    if (!projectId) {
      return errorResponse('Project ID is required', 400);
    }

    if (!ObjectId.isValid(projectId)) {
      return errorResponse('Invalid project ID', 400);
    }

    if (!phaseId) {
      return errorResponse('Phase ID is required', 400);
    }

    if (!ObjectId.isValid(phaseId)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const db = await getDatabase();

    // Verify phase exists and belongs to project
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(phaseId),
      projectId: new ObjectId(projectId),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found or does not belong to this project', 400);
    }

    // Prepare work item data for validation
    const workItemData = {
      projectId,
      phaseId,
      name,
      description,
      category,
      status: status || 'not_started',
      assignedTo,
      estimatedHours,
      actualHours,
      estimatedCost,
      actualCost,
      startDate,
      plannedEndDate,
      actualEndDate,
      dependencies: dependencies || [],
      floorId,
      categoryId,
      priority,
      notes
    };

    // Validate using schema
    const validation = validateWorkItem(workItemData);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Validate dependencies
    if (dependencies && dependencies.length > 0) {
      const depValidation = await validateWorkItemDependencies(null, dependencies, phaseId);
      if (!depValidation.isValid) {
        return errorResponse(`Dependency validation failed: ${depValidation.errors.join(', ')}`, 400);
      }
    }

    // Create work item object
    const workItem = createWorkItem(
      {
        name,
        description,
        category,
        status: status || 'not_started',
        assignedTo,
        estimatedHours,
        actualHours,
        estimatedCost,
        actualCost,
        startDate,
        plannedEndDate,
        actualEndDate,
        dependencies: dependencies || [],
        floorId,
        categoryId,
        priority,
        notes
      },
      projectId,
      phaseId,
      userProfile._id
    );

    // Insert work item
    const result = await db.collection('work_items').insertOne(workItem);

    const insertedWorkItem = { ...workItem, _id: result.insertedId };

    // Recalculate phase completion
    try {
      const completionPercentage = await calculatePhaseCompletionFromWorkItems(phaseId);
      await db.collection('phases').updateOne(
        { _id: new ObjectId(phaseId) },
        {
          $set: {
            completionPercentage: completionPercentage,
            updatedAt: new Date()
          }
        }
      );
    } catch (phaseError) {
      console.error('Error recalculating phase completion after work item creation:', phaseError);
      // Don't fail the request, just log the error
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'WORK_ITEM',
      entityId: result.insertedId.toString(),
      projectId: projectId,
      changes: { created: insertedWorkItem },
    });

    return successResponse(insertedWorkItem, 'Work item created successfully', 201);
  } catch (error) {
    console.error('Create work item error:', error);
    return errorResponse('Failed to create work item', 500);
  }
}

