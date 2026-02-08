/**
 * Budget Adjustment API Route
 * POST: Create a new budget adjustment request
 * GET: Get budget adjustment history
 * 
 * POST /api/projects/[id]/budget/adjustment
 * GET /api/projects/[id]/budget/adjustment
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
  createBudgetAdjustment,
  validateBudgetAdjustment,
  getBudgetAdjustmentHistory,
  getBudgetAdjustmentSummary,
} from '@/lib/budget-adjustment-helpers';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/budget/adjustment
 * Returns budget adjustment history for a project
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

    // Get adjustment history
    const adjustments = await getBudgetAdjustmentHistory(id);
    const summary = await getBudgetAdjustmentSummary(id);

    // Populate user information for requestedBy and approvedBy
    const userIds = new Set();
    adjustments.forEach(adjustment => {
      if (adjustment.requestedBy) userIds.add(adjustment.requestedBy.toString());
      if (adjustment.approvedBy) userIds.add(adjustment.approvedBy.toString());
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

    const adjustmentsWithUsers = adjustments.map(adjustment => ({
      ...adjustment,
      _id: adjustment._id.toString(),
      projectId: adjustment.projectId.toString(),
      requestedBy: adjustment.requestedBy ? userMap[adjustment.requestedBy.toString()] || null : null,
      approvedBy: adjustment.approvedBy ? userMap[adjustment.approvedBy?.toString()] || null : null,
    }));

    return successResponse({
      adjustments: adjustmentsWithUsers,
      summary,
    });
  } catch (error) {
    console.error('Get budget adjustments error:', error);
    return errorResponse('Failed to retrieve budget adjustments', 500);
  }
}

/**
 * POST /api/projects/[id]/budget/adjustment
 * Creates a new budget adjustment request
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
    const canRequest = await hasPermission(user.id, 'request_budget_adjustment');
    if (!canRequest) {
      // Fallback to role check
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['pm', 'project_manager', 'owner'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse(
          'Insufficient permissions. Only PM and OWNER can request budget adjustments.',
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
      category,
      adjustmentType,
      adjustmentAmount,
      reason,
    } = body;

    // Validation
    if (!category) {
      return errorResponse('category is required', 400);
    }

    if (!adjustmentType || !['increase', 'decrease'].includes(adjustmentType)) {
      return errorResponse('adjustmentType must be either "increase" or "decrease"', 400);
    }

    if (!adjustmentAmount || typeof adjustmentAmount !== 'number' || adjustmentAmount <= 0) {
      return errorResponse('Valid adjustmentAmount is required and must be greater than 0', 400);
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

    // Validate budget adjustment
    const validation = await validateBudgetAdjustment(id, category, adjustmentAmount, adjustmentType);

    if (!validation.isValid) {
      return errorResponse(validation.message, 400);
    }

    // Create budget adjustment request
    const adjustment = await createBudgetAdjustment(
      {
        category,
        adjustmentType,
        adjustmentAmount,
        reason,
      },
      id,
      userProfile._id.toString()
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'BUDGET_ADJUSTMENT',
      entityId: adjustment._id.toString(),
      projectId: id,
      changes: { created: adjustment },
    });

    // Notify owners about pending budget adjustment request
    const owners = await db.collection('user_profiles').find({
      role: { $in: ['owner'] },
      deletedAt: null,
    }).toArray();

    for (const owner of owners) {
      if (owner._id.toString() !== userProfile._id.toString()) {
        await createNotification({
          userId: owner._id.toString(),
          type: 'budget_adjustment_request',
          title: 'New Budget Adjustment Request',
          message: `${userProfile.firstName || userProfile.email} requested a budget ${adjustmentType} of ${adjustmentAmount.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} for ${category} in ${project.projectName}. Reason: ${reason}`,
          projectId: id,
          relatedModel: 'BUDGET_ADJUSTMENT',
          relatedId: adjustment._id.toString(),
          createdBy: userProfile._id.toString(),
        });
      }
    }

    return successResponse(
      adjustment,
      'Budget adjustment request created successfully',
      201
    );
  } catch (error) {
    console.error('Create budget adjustment error:', error);
    return errorResponse('Failed to create budget adjustment request', 500);
  }
}
