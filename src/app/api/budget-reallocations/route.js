/**
 * Budget Reallocation API Route
 * GET: List all budget reallocation requests
 * POST: Create new budget reallocation request
 * 
 * GET /api/budget-reallocations
 * POST /api/budget-reallocations
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { 
  createBudgetReallocation, 
  validateBudgetReallocation,
  REALLOCATION_STATUSES,
  REALLOCATION_TYPES
} from '@/lib/schemas/budget-reallocation-schema';
import { getBudgetTotal } from '@/lib/schemas/budget-schema';
import { calculateAvailableBudget } from '@/lib/schemas/budget-reallocation-schema';

/**
 * GET /api/budget-reallocations
 * Returns budget reallocation requests with filtering
 * Auth: All authenticated users
 * Query params: projectId, phaseId, status, page, limit
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
    const phaseId = searchParams.get('phaseId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const db = await getDatabase();

    // Build query
    const query = { deletedAt: null };

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      query.$or = [
        { fromPhaseId: new ObjectId(phaseId) },
        { toPhaseId: new ObjectId(phaseId) }
      ];
    }

    if (status) {
      query.status = status;
    }

    // Execute query
    const skip = (page - 1) * limit;
    const reallocations = await db
      .collection('budget_reallocations')
      .find(query)
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('budget_reallocations').countDocuments(query);

    // Populate user names
    const userIds = new Set();
    reallocations.forEach(req => {
      if (req.requestedBy) userIds.add(req.requestedBy);
      if (req.approvedBy) userIds.add(req.approvedBy);
      if (req.rejectedBy) userIds.add(req.rejectedBy);
    });

    const users = await db
      .collection('users')
      .find({ _id: { $in: Array.from(userIds).map(id => new ObjectId(id)) } })
      .toArray();

    const usersMap = {};
    users.forEach(u => {
      usersMap[u._id.toString()] = {
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        email: u.email
      };
    });

    // Enrich reallocations with user names
    const enrichedReallocations = reallocations.map(req => ({
      ...req,
      requestedByName: usersMap[req.requestedBy?.toString()]?.name || 'Unknown',
      approvedByName: usersMap[req.approvedBy?.toString()]?.name || null,
      rejectedByName: usersMap[req.rejectedBy?.toString()]?.name || null
    }));

    return successResponse(
      {
        reallocations: enrichedReallocations,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      'Budget reallocations retrieved successfully'
    );
  } catch (error) {
    console.error('Get budget reallocations error:', error);
    return errorResponse('Failed to retrieve budget reallocations', 500);
  }
}

/**
 * POST /api/budget-reallocations
 * Creates a new budget reallocation request
 * Auth: PM, OWNER, ACCOUNTANT
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasCreatePermission = await hasPermission(user.id, 'create_budget_reallocation');
    if (!hasCreatePermission) {
      return errorResponse('Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can create budget reallocation requests.', 403);
    }

    const body = await request.json();
    const {
      projectId,
      fromPhaseId,
      toPhaseId,
      reallocationType,
      amount,
      reason,
      budgetBreakdown
    } = body;

    // Validation
    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    if (!amount || amount <= 0) {
      return errorResponse('Amount must be greater than 0', 400);
    }

    if (!reason || reason.trim().length === 0) {
      return errorResponse('Reason is required', 400);
    }

    if (!reallocationType || !Object.values(REALLOCATION_TYPES).includes(reallocationType)) {
      return errorResponse(`Invalid reallocation type. Must be one of: ${Object.values(REALLOCATION_TYPES).join(', ')}`, 400);
    }

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      deletedAt: null
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Validate phases based on reallocation type
    if (reallocationType === REALLOCATION_TYPES.PHASE_TO_PHASE) {
      if (!fromPhaseId || !ObjectId.isValid(fromPhaseId)) {
        return errorResponse('Source phase ID is required for phase-to-phase reallocation', 400);
      }
      if (!toPhaseId || !ObjectId.isValid(toPhaseId)) {
        return errorResponse('Target phase ID is required for phase-to-phase reallocation', 400);
      }
      if (fromPhaseId === toPhaseId) {
        return errorResponse('Source and target phases cannot be the same', 400);
      }

      // Verify phases exist and belong to project
      const [fromPhase, toPhase] = await Promise.all([
        db.collection('phases').findOne({ _id: new ObjectId(fromPhaseId), projectId: new ObjectId(projectId), deletedAt: null }),
        db.collection('phases').findOne({ _id: new ObjectId(toPhaseId), projectId: new ObjectId(projectId), deletedAt: null })
      ]);

      if (!fromPhase) {
        return errorResponse('Source phase not found or does not belong to project', 404);
      }
      if (!toPhase) {
        return errorResponse('Target phase not found or does not belong to project', 404);
      }

      // Check available budget in source phase
      const sourceAllocation = fromPhase.budgetAllocation?.total || 0;
      const sourceActual = fromPhase.actualSpending?.total || 0;
      const sourceCommitted = fromPhase.financialStates?.committed || 0;
      const sourceAvailable = calculateAvailableBudget(sourceAllocation, sourceActual, sourceCommitted);

      if (amount > sourceAvailable) {
        return errorResponse(
          `Insufficient budget in source phase. Available: ${sourceAvailable.toLocaleString()}, Requested: ${amount.toLocaleString()}`,
          400
        );
      }
    } else if (reallocationType === REALLOCATION_TYPES.PROJECT_TO_PHASE) {
      if (fromPhaseId) {
        return errorResponse('Source phase ID should not be provided for project-to-phase reallocation', 400);
      }
      if (!toPhaseId || !ObjectId.isValid(toPhaseId)) {
        return errorResponse('Target phase ID is required for project-to-phase reallocation', 400);
      }

      // Verify target phase exists
      const toPhase = await db.collection('phases').findOne({
        _id: new ObjectId(toPhaseId),
        projectId: new ObjectId(projectId),
        deletedAt: null
      });

      if (!toPhase) {
        return errorResponse('Target phase not found or does not belong to project', 404);
      }

      // Check available project budget
      const projectBudgetTotal = getBudgetTotal(project.budget);
      const allPhases = await db.collection('phases').find({
        projectId: new ObjectId(projectId),
        deletedAt: null
      }).toArray();

      const totalAllocated = allPhases.reduce((sum, phase) => sum + (phase.budgetAllocation?.total || 0), 0);
      const projectAvailable = projectBudgetTotal - totalAllocated;

      if (amount > projectAvailable) {
        return errorResponse(
          `Insufficient project budget. Available: ${projectAvailable.toLocaleString()}, Requested: ${amount.toLocaleString()}`,
          400
        );
      }
    } else if (reallocationType === REALLOCATION_TYPES.PHASE_TO_PROJECT) {
      if (!fromPhaseId || !ObjectId.isValid(fromPhaseId)) {
        return errorResponse('Source phase ID is required for phase-to-project reallocation', 400);
      }
      if (toPhaseId) {
        return errorResponse('Target phase ID should not be provided for phase-to-project reallocation', 400);
      }

      // Verify source phase exists
      const fromPhase = await db.collection('phases').findOne({
        _id: new ObjectId(fromPhaseId),
        projectId: new ObjectId(projectId),
        deletedAt: null
      });

      if (!fromPhase) {
        return errorResponse('Source phase not found or does not belong to project', 404);
      }

      // Check available budget in source phase
      const sourceAllocation = fromPhase.budgetAllocation?.total || 0;
      const sourceActual = fromPhase.actualSpending?.total || 0;
      const sourceCommitted = fromPhase.financialStates?.committed || 0;
      const sourceAvailable = calculateAvailableBudget(sourceAllocation, sourceActual, sourceCommitted);

      if (amount > sourceAvailable) {
        return errorResponse(
          `Insufficient budget in source phase. Available: ${sourceAvailable.toLocaleString()}, Requested: ${amount.toLocaleString()}`,
          400
        );
      }
    }

    // Create reallocation request
    const reallocationData = {
      projectId: new ObjectId(projectId),
      fromPhaseId: fromPhaseId ? new ObjectId(fromPhaseId) : null,
      toPhaseId: toPhaseId ? new ObjectId(toPhaseId) : null,
      reallocationType,
      amount: parseFloat(amount),
      reason: reason.trim(),
      requestedBy: new ObjectId(userProfile._id),
      budgetBreakdown: budgetBreakdown || {}
    };

    const reallocation = createBudgetReallocation(reallocationData);

    // Insert reallocation request
    const result = await db.collection('budget_reallocations').insertOne(reallocation);

    const insertedReallocation = { ...reallocation, _id: result.insertedId };

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'BUDGET_REALLOCATION',
      entityId: result.insertedId.toString(),
      projectId: projectId,
      changes: {
        amount: reallocation.amount,
        type: reallocation.reallocationType,
        reason: reallocation.reason
      },
    });

    return successResponse(
      insertedReallocation,
      'Budget reallocation request created successfully'
    );
  } catch (error) {
    console.error('Create budget reallocation error:', error);
    return errorResponse(error.message || 'Failed to create budget reallocation request', 500);
  }
}



