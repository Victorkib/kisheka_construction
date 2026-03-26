/**
 * Capital Allocation Requests API
 * POST: Create capital allocation request
 * GET: Get pending requests for approval
 * PATCH: Approve/reject request
 *
 * POST /api/capital/requests
 * GET /api/capital/requests?projectId=xxx&status=pending
 * PATCH /api/capital/requests/[id]
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { checkCapitalAuthorization, CAPITAL_OPERATION_TYPES } from '@/lib/capital-authorization';
import { getProjectFinances } from '@/lib/financial-helpers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/capital/requests
 * Create a capital allocation request (with authorization check)
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
    const body = await request.json();
    
    const {
      projectId,
      floorId,
      amount,
      operationType = CAPITAL_OPERATION_TYPES.ALLOCATION,
      description,
      metadata = {} // Additional data like phase breakdown, etc.
    } = body;

    // Validation
    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId required', 400);
    }

    if (!amount || amount <= 0) {
      return errorResponse('Amount must be greater than 0', 400);
    }

    const db = await getDatabase();

    // Check project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      deletedAt: null
    });

    if (!project) {
      return errorResponse('Project not found', 400);
    }

    // Check available capital
    const projectFinances = await getProjectFinances(projectId);
    const availableCapital = projectFinances?.capitalBalance || 0;

    if (amount > availableCapital) {
      return errorResponse(
        `Insufficient capital. Available: ${formatCurrency(availableCapital)}, Requested: ${formatCurrency(amount)}`,
        400
      );
    }

    // Check authorization level
    const auth = checkCapitalAuthorization(userRole, amount);

    // Determine request status
    let status = 'pending';
    if (auth.canAutoApprove && !auth.requiresApproval) {
      status = 'auto_approved';
    }

    // Create capital allocation request
    const capitalRequest = {
      projectId: new ObjectId(projectId),
      floorId: floorId ? new ObjectId(floorId) : null,
      requestedBy: userProfile._id,
      requestedByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      requestedByRole: userProfile.role,
      amount,
      operationType,
      description: description?.trim() || '',
      metadata,
      status,
      authLevel: auth.authLevel.name,
      requiresApproval: auth.requiresApproval,
      autoApproved: status === 'auto_approved',
      createdAt: new Date(),
      updatedAt: new Date(),
      approvedAt: status === 'auto_approved' ? new Date() : null,
      approvedBy: status === 'auto_approved' ? userProfile._id : null,
      executedAt: status === 'auto_approved' ? new Date() : null,
      executedBy: status === 'auto_approved' ? userProfile._id : null,
      rejectionReason: null,
      projectFinancesSnapshot: {
        availableCapital,
        totalInvested: projectFinances?.totalInvested || 0
      }
    };

    const result = await db.collection('capital_allocation_requests').insertOne(capitalRequest);

    // If auto-approved, execute immediately
    if (status === 'auto_approved') {
      await executeCapitalAllocation(db, capitalRequest, userProfile._id.toString());
      
      capitalRequest.executedAt = new Date();
      capitalRequest.executedBy = userProfile._id;
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: status === 'auto_approved' ? 'CAPITAL_ALLOCATED' : 'CAPITAL_REQUESTED',
      entityType: 'CAPITAL_ALLOCATION_REQUEST',
      entityId: result.insertedId.toString(),
      projectId,
      changes: {
        amount,
        floorId,
        operationType,
        status,
        authLevel: auth.authLevel.name
      },
      description: `Capital ${operationType.replace('_', ' ')}: ${formatCurrency(amount)} ${status === 'auto_approved' ? 'approved and executed' : 'pending approval'}`
    });

    return successResponse({
      requestId: result.insertedId.toString(),
      status,
      requiresApproval: auth.requiresApproval,
      requiresConfirmation: auth.requiresConfirmation,
      authLevel: auth.authLevel.name,
      message: auth.message,
      request: {
        ...capitalRequest,
        _id: result.insertedId.toString()
      }
    }, status === 'auto_approved' ? 'Capital allocated successfully' : 'Capital allocation request submitted for approval');
  } catch (error) {
    console.error('Create capital request error:', error);
    return errorResponse('Failed to create capital allocation request', 500);
  }
}

/**
 * GET /api/capital/requests
 * Get capital allocation requests (filtered by project and status)
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
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status') || 'pending';

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId required', 400);
    }

    // Check if user can view requests (Owner, PM, Accountant)
    const canViewRequests = ['owner', 'pm', 'project_manager', 'accountant'].includes(userRole);
    if (!canViewRequests) {
      return errorResponse('Insufficient permissions to view capital requests', 403);
    }

    const db = await getDatabase();

    const query = {
      projectId: new ObjectId(projectId),
      deletedAt: null
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    const requests = await db.collection('capital_allocation_requests')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Enrich with floor names
    const enrichedRequests = await Promise.all(
      requests.map(async (req) => {
        let floorName = null;
        if (req.floorId) {
          const floor = await db.collection('floors').findOne({
            _id: req.floorId,
            deletedAt: null
          });
          floorName = floor?.name || `Floor ${floor?.floorNumber}`;
        }

        return {
          ...req,
          _id: req._id.toString(),
          projectId: req.projectId.toString(),
          floorId: req.floorId?.toString() || null,
          requestedBy: req.requestedBy.toString(),
          approvedBy: req.approvedBy?.toString(),
          executedBy: req.executedBy?.toString(),
          floorName
        };
      })
    );

    return successResponse({
      requests: enrichedRequests,
      count: enrichedRequests.length,
      canApprove: ['owner', 'pm', 'project_manager'].includes(userRole)
    }, 'Capital requests retrieved successfully');
  } catch (error) {
    console.error('Get capital requests error:', error);
    return errorResponse('Failed to retrieve capital requests', 500);
  }
}

/**
 * PATCH /api/capital/requests/[id]
 * Approve or reject a capital allocation request
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
      return errorResponse('Insufficient permissions to approve capital requests', 403);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid request ID', 400);
    }

    const body = await request.json();
    const { action, rejectionReason } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return errorResponse('Invalid action. Must be "approve" or "reject"', 400);
    }

    const db = await getDatabase();

    const capitalRequest = await db.collection('capital_allocation_requests').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!capitalRequest) {
      return errorResponse('Capital request not found', 404);
    }

    if (capitalRequest.status !== 'pending') {
      return errorResponse(`Request already ${capitalRequest.status}`, 400);
    }

    // Update request status
    const updateData = {
      updatedAt: new Date(),
      approvedAt: new Date(),
      approvedBy: userProfile._id,
      status: action === 'approve' ? 'approved' : 'rejected'
    };

    if (action === 'reject') {
      updateData.rejectionReason = rejectionReason?.trim() || '';
    }

    await db.collection('capital_allocation_requests').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // If approved, execute the allocation
    let executionResult = null;
    if (action === 'approve') {
      executionResult = await executeCapitalAllocation(
        db,
        capitalRequest,
        userProfile._id.toString()
      );

      await db.collection('capital_allocation_requests').updateOne(
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
      action: action === 'approve' ? 'CAPITAL_REQUEST_APPROVED' : 'CAPITAL_REQUEST_REJECTED',
      entityType: 'CAPITAL_ALLOCATION_REQUEST',
      entityId: id,
      projectId: capitalRequest.projectId.toString(),
      changes: {
        amount: capitalRequest.amount,
        action,
        rejectionReason: rejectionReason || null
      },
      description: `Capital allocation ${action}d: ${formatCurrency(capitalRequest.amount)} for ${capitalRequest.operationType.replace('_', ' ')}`
    });

    return successResponse({
      requestId: id,
      status: action === 'approve' ? 'approved' : 'rejected',
      executed: action === 'approve',
      executionResult
    }, action === 'approve' ? 'Capital allocation approved and executed' : 'Capital allocation rejected');
  } catch (error) {
    console.error('Capital request approval error:', error);
    return errorResponse('Failed to process approval', 500);
  }
}

/**
 * Execute capital allocation
 * Updates floor/project capital based on request
 */
async function executeCapitalAllocation(db, request, userId) {
  const { projectId, floorId, amount, metadata } = request;

  if (!floorId) {
    // Project-level allocation (not implemented yet)
    return { success: false, message: 'Project-level allocation not implemented' };
  }

  // Update floor capital
  const floor = await db.collection('floors').findOne({
    _id: new ObjectId(floorId),
    deletedAt: null
  });

  if (!floor) {
    throw new Error(`Floor ${floorId} not found`);
  }

  const existingCapital = floor.capitalAllocation || {
    total: 0,
    byPhase: {},
    used: 0,
    committed: 0,
    remaining: 0
  };

  // Build new capital allocation
  const newCapitalAllocation = {
    total: existingCapital.total + amount,
    byPhase: existingCapital.byPhase || {},
    used: existingCapital.used || 0,
    committed: existingCapital.committed || 0,
    remaining: (existingCapital.remaining || 0) + amount
  };

  // If metadata has byPhase breakdown, use it
  if (metadata.byPhase) {
    Object.keys(metadata.byPhase).forEach(phaseCode => {
      newCapitalAllocation.byPhase[phaseCode] = {
        ...(newCapitalAllocation.byPhase[phaseCode] || {}),
        total: (newCapitalAllocation.byPhase[phaseCode]?.total || 0) + metadata.byPhase[phaseCode]
      };
    });
  }

  await db.collection('floors').updateOne(
    { _id: new ObjectId(floorId) },
    {
      $set: {
        capitalAllocation: newCapitalAllocation,
        updatedAt: new Date()
      }
    }
  );

  return {
    success: true,
    floorId: floorId.toString(),
    previousCapital: existingCapital.total,
    newCapital: newCapitalAllocation.total,
    amountAdded: amount
  };
}

/**
 * Format currency helper
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}
