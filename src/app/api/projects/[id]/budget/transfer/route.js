/**
 * Budget Transfer API Route
 * POST: Create a new budget transfer request
 * GET: Get budget transfer history
 * 
 * POST /api/projects/[id]/budget/transfer
 * GET /api/projects/[id]/budget/transfer
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotification } from '@/lib/notifications';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  createBudgetTransfer,
  validateBudgetTransfer,
  getBudgetTransferHistory,
  getBudgetTransferSummary,
} from '@/lib/budget-transfer-helpers';

/**
 * GET /api/projects/[id]/budget/transfer
 * Returns budget transfer history for a project
 * Auth: All authenticated users with project access
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Get transfer history
    const transfers = await getBudgetTransferHistory(id);
    const summary = await getBudgetTransferSummary(id);

    // Populate user information for requestedBy and approvedBy
    const userIds = new Set();
    transfers.forEach(transfer => {
      if (transfer.requestedBy) userIds.add(transfer.requestedBy.toString());
      if (transfer.approvedBy) userIds.add(transfer.approvedBy.toString());
    });

    const users = await db.collection('user_profiles').find({
      _id: { $in: Array.from(userIds).map(id => new ObjectId(id)) },
    }).toArray();

    const userMap = {};
    users.forEach(user => {
      userMap[user._id.toString()] = {
        _id: user._id.toString(),
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        email: user.email,
      };
    });

    const transfersWithUsers = transfers.map(transfer => ({
      ...transfer,
      _id: transfer._id.toString(),
      projectId: transfer.projectId.toString(),
      requestedBy: transfer.requestedBy ? userMap[transfer.requestedBy.toString()] || null : null,
      approvedBy: transfer.approvedBy ? userMap[transfer.approvedBy?.toString()] || null : null,
    }));

    return successResponse({
      transfers: transfersWithUsers,
      summary,
    });
  } catch (error) {
    console.error('Get budget transfers error:', error);
    return errorResponse('Failed to retrieve budget transfers', 500);
  }
}

/**
 * POST /api/projects/[id]/budget/transfer
 * Creates a new budget transfer request
 * Auth: PM, OWNER
 */
export async function POST(request, { params }) {
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

    // Check permission
    const canRequest = await hasPermission(user.id, 'request_budget_transfer');
    if (!canRequest) {
      // Fallback to role check
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['pm', 'project_manager', 'owner'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse(
          'Insufficient permissions. Only PM and OWNER can request budget transfers.',
          403
        );
      }
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const body = await request.json();
    const {
      fromCategory,
      toCategory,
      amount,
      reason,
    } = body;

    // Validation
    if (!fromCategory || !toCategory) {
      return errorResponse('fromCategory and toCategory are required', 400);
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return errorResponse('Valid amount is required', 400);
    }

    if (!reason || reason.trim().length === 0) {
      return errorResponse('Reason is required', 400);
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Validate budget transfer
    const validation = await validateBudgetTransfer(id, fromCategory, toCategory, amount);

    if (!validation.isValid) {
      return errorResponse(validation.message, 400);
    }

    // Create budget transfer request
    const transfer = await createBudgetTransfer(
      {
        fromCategory,
        toCategory,
        amount,
        reason,
      },
      id,
      userProfile._id.toString()
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'BUDGET_TRANSFER',
      entityId: transfer._id.toString(),
      projectId: id,
      changes: { created: transfer },
    });

    // Notify owners about pending budget transfer request
    const owners = await db.collection('user_profiles').find({
      role: { $in: ['owner'] },
      deletedAt: null,
    }).toArray();

    for (const owner of owners) {
      if (owner._id.toString() !== userProfile._id.toString()) {
        await createNotification({
          userId: owner._id.toString(),
          type: 'budget_transfer_request',
          title: 'New Budget Transfer Request',
          message: `${userProfile.firstName || userProfile.email} requested a budget transfer of ${amount.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} from ${fromCategory} to ${toCategory} for ${project.projectName}. Reason: ${reason}`,
          projectId: id,
          relatedModel: 'BUDGET_TRANSFER',
          relatedId: transfer._id.toString(),
          createdBy: userProfile._id.toString(),
        });
      }
    }

    return successResponse(
      transfer,
      'Budget transfer request created successfully',
      201
    );
  } catch (error) {
    console.error('Create budget transfer error:', error);
    return errorResponse('Failed to create budget transfer request', 500);
  }
}
