/**
 * Capital Rebalancing API
 * POST: Request capital transfer between floors
 * GET: Get pending rebalancing requests
 * PATCH: Approve/reject rebalancing request
 *
 * POST /api/floors/rebalance
 * GET /api/floors/rebalance/requests
 * PATCH /api/floors/rebalance/[id]
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/floors/rebalance
 * Request capital transfer from one floor to another
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    const allowedRoles = ['owner', 'pm', 'project_manager', 'accountant'];
    if (!allowedRoles.includes(userRole)) {
      return errorResponse('Insufficient permissions to request capital rebalancing', 403);
    }

    const body = await request.json();
    const {
      fromFloorId,
      toFloorId,
      amount,
      projectId,
      reason,
      priority = 'normal' // 'low', 'normal', 'high', 'urgent'
    } = body;

    // Validation
    if (!fromFloorId || !toFloorId || !amount || !projectId) {
      return errorResponse('Missing required fields: fromFloorId, toFloorId, amount, projectId', 400);
    }

    if (!ObjectId.isValid(fromFloorId) || !ObjectId.isValid(toFloorId) || !ObjectId.isValid(projectId)) {
      return errorResponse('Invalid ID format', 400);
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return errorResponse('Amount must be a positive number', 400);
    }

    const db = await getDatabase();

    // Get floors
    const fromFloor = await db.collection('floors').findOne({
      _id: new ObjectId(fromFloorId),
      projectId: new ObjectId(projectId),
      deletedAt: null
    });

    const toFloor = await db.collection('floors').findOne({
      _id: new ObjectId(toFloorId),
      projectId: new ObjectId(projectId),
      deletedAt: null
    });

    if (!fromFloor || !toFloor) {
      return errorResponse('One or both floors not found', 404);
    }

    // Validate capital availability on source floor
    const fromCapital = fromFloor.capitalAllocation || { total: 0, remaining: 0 };
    const fromRemaining = fromCapital.remaining !== undefined ? fromCapital.remaining : fromCapital.total;

    if (transferAmount > fromRemaining) {
      return errorResponse(
        `Insufficient capital on source floor. Available: ${formatCurrency(fromRemaining)}, Requested: ${formatCurrency(transferAmount)}`,
        400
      );
    }

    // Check if this would cause negative remaining
    const newFromRemaining = fromRemaining - transferAmount;
    const toCapital = toFloor.capitalAllocation || { total: 0, remaining: 0 };
    const toRemaining = toCapital.remaining !== undefined ? toCapital.remaining : toCapital.total;
    const newToRemaining = toRemaining + transferAmount;

    // Auto-approve for OWNER/PM, require approval for others
    const canAutoApprove = ['owner', 'pm', 'project_manager'].includes(userRole);
    const status = canAutoApprove ? 'approved' : 'pending';

    // Create rebalancing request
    const rebalanceRequest = {
      fromFloorId: new ObjectId(fromFloorId),
      fromFloorName: fromFloor.name || `Floor ${fromFloor.floorNumber}`,
      toFloorId: new ObjectId(toFloorId),
      toFloorName: toFloor.name || `Floor ${toFloor.floorNumber}`,
      amount: transferAmount,
      projectId: new ObjectId(projectId),
      requestedBy: userProfile._id,
      requestedByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim(),
      reason: reason?.trim() || '',
      priority,
      status,
      fromFloorBefore: {
        total: fromCapital.total || 0,
        remaining: fromRemaining
      },
      toFloorBefore: {
        total: toCapital.total || 0,
        remaining: toRemaining
      },
      fromFloorAfter: {
        total: fromCapital.total || 0,
        remaining: newFromRemaining
      },
      toFloorAfter: {
        total: toCapital.total || 0,
        remaining: newToRemaining
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      approvedAt: canAutoApprove ? new Date() : null,
      approvedBy: canAutoApprove ? userProfile._id : null,
      executedAt: null,
      executedBy: null
    };

    const result = await db.collection('capital_rebalance_requests').insertOne(rebalanceRequest);

    // If auto-approved, execute the transfer immediately
    if (canAutoApprove) {
      await executeCapitalTransfer(db, fromFloorId, toFloorId, transferAmount, userProfile._id.toString(), result.insertedId.toString());
      
      rebalanceRequest.executedAt = new Date();
      rebalanceRequest.executedBy = userProfile._id;
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: canAutoApprove ? 'CAPITAL_REBALANCED' : 'CAPITAL_REBALANCE_REQUESTED',
      entityType: 'CAPITAL_REBALANCE',
      entityId: result.insertedId.toString(),
      projectId,
      changes: {
        fromFloor: fromFloor.name || `Floor ${fromFloor.floorNumber}`,
        toFloor: toFloor.name || `Floor ${toFloor.floorNumber}`,
        amount: transferAmount,
        status
      },
      description: `Capital rebalancing: ${formatCurrency(transferAmount)} from ${fromFloor.name || `Floor ${fromFloor.floorNumber}`} to ${toFloor.name || `Floor ${toFloor.floorNumber}`} - ${status === 'approved' ? 'Executed' : 'Pending approval'}`
    });

    return successResponse({
      requestId: result.insertedId.toString(),
      status,
      message: canAutoApprove 
        ? 'Capital rebalancing executed successfully' 
        : 'Capital rebalancing request submitted for approval',
      rebalanceRequest: {
        ...rebalanceRequest,
        _id: result.insertedId.toString()
      }
    }, canAutoApprove ? 'Capital rebalanced successfully' : 'Rebalancing request submitted');
  } catch (error) {
    console.error('Capital rebalance request error:', error);
    return errorResponse('Failed to process capital rebalancing request', 500);
  }
}

/**
 * GET /api/floors/rebalance/requests
 * Get pending rebalancing requests for approval
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    const canApprove = ['owner', 'pm', 'project_manager'].includes(userRole);

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status') || 'pending';

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId required', 400);
    }

    const db = await getDatabase();

    const query = {
      projectId: new ObjectId(projectId),
      deletedAt: null
    };

    if (status) {
      query.status = status;
    }

    const requests = await db.collection('capital_rebalance_requests')
      .find(query)
      .sort({ priority: -1, createdAt: -1 })
      .toArray();

    // Enrich with floor details
    const enrichedRequests = await Promise.all(
      requests.map(async (req) => {
        const fromFloor = await db.collection('floors').findOne({
          _id: req.fromFloorId,
          deletedAt: null
        });
        const toFloor = await db.collection('floors').findOne({
          _id: req.toFloorId,
          deletedAt: null
        });

        return {
          ...req,
          _id: req._id.toString(),
          fromFloorId: req.fromFloorId.toString(),
          toFloorId: req.toFloorId.toString(),
          projectId: req.projectId.toString(),
          requestedBy: req.requestedBy.toString(),
          approvedBy: req.approvedBy?.toString(),
          currentFromRemaining: fromFloor?.capitalAllocation?.remaining || fromFloor?.capitalAllocation?.total || 0,
          currentToRemaining: toFloor?.capitalAllocation?.remaining || toFloor?.capitalAllocation?.total || 0
        };
      })
    );

    return successResponse({
      requests: enrichedRequests,
      canApprove,
      count: enrichedRequests.length
    }, 'Rebalancing requests retrieved successfully');
  } catch (error) {
    console.error('Get rebalance requests error:', error);
    return errorResponse('Failed to retrieve rebalancing requests', 500);
  }
}

/**
 * PATCH /api/floors/rebalance/[id]
 * Approve or reject a rebalancing request
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    const canApprove = ['owner', 'pm', 'project_manager'].includes(userRole);

    if (!canApprove) {
      return errorResponse('Insufficient permissions to approve capital rebalancing', 403);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid request ID', 400);
    }

    const body = await request.json();
    const { action, rejectionReason } = body; // action: 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return errorResponse('Invalid action. Must be "approve" or "reject"', 400);
    }

    const db = await getDatabase();

    const rebalanceRequest = await db.collection('capital_rebalance_requests').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!rebalanceRequest) {
      return errorResponse('Rebalancing request not found', 404);
    }

    if (rebalanceRequest.status !== 'pending') {
      return errorResponse(`Request already ${rebalanceRequest.status}`, 400);
    }

    const updateData = {
      updatedAt: new Date(),
      approvedAt: new Date(),
      approvedBy: userProfile._id,
      status: action === 'approve' ? 'approved' : 'rejected'
    };

    if (action === 'reject') {
      updateData.rejectionReason = rejectionReason?.trim() || '';
    }

    await db.collection('capital_rebalance_requests').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // If approved, execute the transfer
    let executionResult = null;
    if (action === 'approve') {
      executionResult = await executeCapitalTransfer(
        db,
        rebalanceRequest.fromFloorId.toString(),
        rebalanceRequest.toFloorId.toString(),
        rebalanceRequest.amount,
        userProfile._id.toString(),
        id
      );

      await db.collection('capital_rebalance_requests').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            executedAt: new Date(),
            executedBy: userProfile._id
          }
        }
      );
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: action === 'approve' ? 'CAPITAL_REBALANCE_APPROVED' : 'CAPITAL_REBALANCE_REJECTED',
      entityType: 'CAPITAL_REBALANCE',
      entityId: id,
      projectId: rebalanceRequest.projectId.toString(),
      changes: {
        fromFloor: rebalanceRequest.fromFloorName,
        toFloor: rebalanceRequest.toFloorName,
        amount: rebalanceRequest.amount,
        action,
        rejectionReason: rejectionReason || null
      },
      description: `Capital rebalancing ${action}d: ${formatCurrency(rebalanceRequest.amount)} from ${rebalanceRequest.fromFloorName} to ${rebalanceRequest.toFloorName}`
    });

    return successResponse({
      requestId: id,
      status: action === 'approve' ? 'approved' : 'rejected',
      executed: action === 'approve',
      executionResult
    }, action === 'approve' ? 'Capital rebalancing approved and executed' : 'Capital rebalancing rejected');
  } catch (error) {
    console.error('Rebalance request approval error:', error);
    return errorResponse('Failed to process approval', 500);
  }
}

/**
 * Execute capital transfer between floors
 */
async function executeCapitalTransfer(db, fromFloorId, toFloorId, amount, userId, requestId) {
  const fromFloorObjectId = new ObjectId(fromFloorId);
  const toFloorObjectId = new ObjectId(toFloorId);

  // Get current floor data
  const fromFloor = await db.collection('floors').findOne({ _id: fromFloorObjectId });
  const toFloor = await db.collection('floors').findOne({ _id: toFloorObjectId });

  if (!fromFloor || !toFloor) {
    throw new Error('One or both floors not found');
  }

  // Update from floor
  const fromCapital = fromFloor.capitalAllocation || { total: 0, byPhase: {}, used: 0, committed: 0, remaining: 0 };
  const newFromTotal = Math.max(0, fromCapital.total - amount);
  const newFromRemaining = Math.max(0, (fromCapital.remaining !== undefined ? fromCapital.remaining : fromCapital.total) - amount);

  await db.collection('floors').updateOne(
    { _id: fromFloorObjectId },
    {
      $set: {
        'capitalAllocation.total': newFromTotal,
        'capitalAllocation.remaining': newFromRemaining,
        updatedAt: new Date()
      }
    }
  );

  // Update to floor
  const toCapital = toFloor.capitalAllocation || { total: 0, byPhase: {}, used: 0, committed: 0, remaining: 0 };
  const newToTotal = toCapital.total + amount;
  const newToRemaining = (toCapital.remaining !== undefined ? toCapital.remaining : toCapital.total) + amount;

  await db.collection('floors').updateOne(
    { _id: toFloorObjectId },
    {
      $set: {
        'capitalAllocation.total': newToTotal,
        'capitalAllocation.remaining': newToRemaining,
        updatedAt: new Date()
      }
    }
  );

  return {
    fromFloor: {
      id: fromFloorId,
      oldTotal: fromCapital.total,
      newTotal: newFromTotal,
      oldRemaining: fromCapital.remaining !== undefined ? fromCapital.remaining : fromCapital.total,
      newRemaining: newFromRemaining
    },
    toFloor: {
      id: toFloorId,
      oldTotal: toCapital.total,
      newTotal: newToTotal,
      oldRemaining: toCapital.remaining !== undefined ? toCapital.remaining : toCapital.total,
      newRemaining: newToRemaining
    }
  };
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}
