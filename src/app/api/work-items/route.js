/**
 * Work Items API Route
 * GET: List work items (optionally filtered by project, phase, status, assignedTo)
 * POST: Create new work item (PM, OWNER only)
 * 
 * GET /api/work-items?projectId=xxx&phaseId=xxx&floorId=xxx&status=xxx&assignedTo=xxx
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
import { CATEGORY_TYPES } from '@/lib/constants/category-constants';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

const resolveWorkItemCategory = async (db, { categoryId, category }) => {
  let resolvedCategoryId = null;
  let resolvedCategory = category?.trim() || '';

  if (categoryId && ObjectId.isValid(categoryId)) {
    const categoryDoc = await db.collection('categories').findOne({
      _id: new ObjectId(categoryId),
      type: CATEGORY_TYPES.WORK_ITEMS,
    });
    if (categoryDoc) {
      resolvedCategoryId = categoryDoc._id;
      resolvedCategory = categoryDoc.name;
      return { resolvedCategoryId, resolvedCategory };
    }
  }

  if (resolvedCategory) {
    const categoryDoc = await db.collection('categories').findOne({
      name: { $regex: new RegExp(`^${resolvedCategory}$`, 'i') },
      type: CATEGORY_TYPES.WORK_ITEMS,
    });
    if (categoryDoc) {
      resolvedCategoryId = categoryDoc._id;
      resolvedCategory = categoryDoc.name;
    }
  }

  return { resolvedCategoryId, resolvedCategory };
};

/**
 * GET /api/work-items
 * Returns work items, optionally filtered by projectId, phaseId, status, assignedTo
 * Auth: All authenticated users
 * Query params: projectId (optional), phaseId (optional), floorId (optional), status (optional), assignedTo (optional), category (optional), page (optional), limit (optional)
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
    const floorId = searchParams.get('floorId');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      query.phaseId = new ObjectId(phaseId);
    }

    if (floorId === 'unassigned' || floorId === 'none' || floorId === 'missing') {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [{ floorId: { $exists: false } }, { floorId: null }],
      });
    } else if (floorId && ObjectId.isValid(floorId)) {
      query.floorId = new ObjectId(floorId);
    }

    if (status && WORK_ITEM_STATUSES.includes(status)) {
      query.status = status;
    }

    // Handle assignedTo filter - support both single worker and array
    if (assignedTo) {
      if (ObjectId.isValid(assignedTo)) {
        // Filter work items where this worker is in the assignedTo array
        query.assignedTo = { $in: [new ObjectId(assignedTo)] };
      }
    }
    
    // Support unassigned filter
    const unassigned = searchParams.get('unassigned');
    if (unassigned === 'true') {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { assignedTo: { $exists: false } },
          { assignedTo: { $eq: [] } },
          { assignedTo: null }
        ]
      });
    }

    // Support search filter
    if (search && search.trim()) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: search.trim(), $options: 'i' } },
          { description: { $regex: search.trim(), $options: 'i' } },
          { category: { $regex: search.trim(), $options: 'i' } }
        ]
      });
    }

    if (category) {
      query.category = category;
    }

    // Clean up $and if empty (MongoDB doesn't like empty $and arrays)
    if (query.$and && query.$and.length === 0) {
      delete query.$and;
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

    // Populate assigned workers
    const allAssignedWorkerIds = [];
    workItems.forEach(item => {
      if (item.assignedTo && Array.isArray(item.assignedTo)) {
        item.assignedTo.forEach(workerId => {
          if (workerId && !allAssignedWorkerIds.includes(workerId.toString())) {
            allAssignedWorkerIds.push(workerId.toString());
          }
        });
      } else if (item.assignedTo && !Array.isArray(item.assignedTo)) {
        // Backward compatibility: handle single ObjectId
        const workerIdStr = item.assignedTo.toString();
        if (!allAssignedWorkerIds.includes(workerIdStr)) {
          allAssignedWorkerIds.push(workerIdStr);
        }
      }
    });

    const workers = allAssignedWorkerIds.length > 0
      ? await db.collection('worker_profiles').find({
          $or: [
            { _id: { $in: allAssignedWorkerIds.map(id => new ObjectId(id)) } },
            { userId: { $in: allAssignedWorkerIds.map(id => new ObjectId(id)) } }
          ],
          deletedAt: null
        }).toArray()
      : [];

    const workerMap = {};
    workers.forEach(worker => {
      const id = worker._id.toString();
      const userId = worker.userId?.toString();
      workerMap[id] = {
        _id: worker._id,
        workerName: worker.workerName || worker.name || 'Unknown Worker',
        employeeId: worker.employeeId,
        workerType: worker.workerType,
        skillType: worker.skillType
      };
      if (userId) {
        workerMap[userId] = workerMap[id];
      }
    });

    // Add phase names and assigned workers to work items
    const workItemsWithPhases = workItems.map(item => {
      const assignedWorkers = [];
      if (item.assignedTo) {
        if (Array.isArray(item.assignedTo)) {
          item.assignedTo.forEach(workerId => {
            const workerIdStr = workerId?.toString();
            if (workerIdStr && workerMap[workerIdStr]) {
              assignedWorkers.push(workerMap[workerIdStr]);
            }
          });
        } else {
          // Backward compatibility
          const workerIdStr = item.assignedTo?.toString();
          if (workerIdStr && workerMap[workerIdStr]) {
            assignedWorkers.push(workerMap[workerIdStr]);
          }
        }
      }
      
      return {
        ...item,
        phaseName: item.phaseId ? phaseMap[item.phaseId.toString()] : 'Unknown',
        assignedWorkers: assignedWorkers,
        assignedWorkersCount: assignedWorkers.length
      };
    });

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

    const { resolvedCategoryId, resolvedCategory } = await resolveWorkItemCategory(db, {
      categoryId,
      category,
    });

    // Prepare work item data for validation
    const workItemData = {
      projectId,
      phaseId,
      name,
      description,
      category: resolvedCategory || category,
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
      categoryId: resolvedCategoryId
        ? resolvedCategoryId.toString()
        : (categoryId && ObjectId.isValid(categoryId) ? categoryId : null),
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
        category: resolvedCategory || category,
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
        categoryId: resolvedCategoryId
          ? resolvedCategoryId.toString()
          : (categoryId && ObjectId.isValid(categoryId) ? categoryId : null),
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

