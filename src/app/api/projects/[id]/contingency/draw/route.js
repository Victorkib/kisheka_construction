/**
 * Contingency Draw API Route
 * POST: Create a new contingency draw request
 * 
 * POST /api/projects/[id]/contingency/draw
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
import { createContingencyDraw, validateContingencyDraw } from '@/lib/contingency-helpers';

/**
 * POST /api/projects/[id]/contingency/draw
 * Creates a new contingency draw request
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
    const canRequest = await hasPermission(user.id, 'request_contingency_draw');
    if (!canRequest) {
      // Fallback to role check
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['pm', 'project_manager', 'owner'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse(
          'Insufficient permissions. Only PM and OWNER can request contingency draws.',
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
      drawType,
      amount,
      reason,
      linkedTo,
    } = body;

    // Validation
    if (!drawType) {
      return errorResponse('Draw type is required', 400);
    }

    const validDrawTypes = ['design', 'construction', 'owners_reserve'];
    if (!validDrawTypes.includes(drawType)) {
      return errorResponse(`Invalid draw type. Must be one of: ${validDrawTypes.join(', ')}`, 400);
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

    // Validate contingency draw
    const validation = await validateContingencyDraw(id, amount, drawType);

    // If budget validation fails, return error (unless it's just a warning)
    if (!validation.isValid) {
      return errorResponse(validation.message, 400);
    }

    // If budget validation shows a warning, we'll still allow creation but log it
    if (validation.warning) {
      console.warn(`Contingency draw warning for project ${id}:`, validation.message);
    }

    // Create contingency draw
    const draw = await createContingencyDraw(
      {
        drawType,
        amount,
        reason,
        linkedTo,
      },
      id,
      userProfile._id.toString()
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'CONTINGENCY_DRAW',
      entityId: draw._id.toString(),
      projectId: id,
      changes: { created: draw },
    });

    // Notify owners/PMs about pending contingency draw request
    const ownersAndPMs = await db.collection('user_profiles').find({
      role: { $in: ['owner', 'pm', 'project_manager'] },
      deletedAt: null,
    }).toArray();

    for (const approver of ownersAndPMs) {
      if (approver._id.toString() !== userProfile._id.toString()) {
        await createNotification({
          userId: approver._id.toString(),
          type: 'contingency_draw_request',
          title: 'New Contingency Draw Request',
          message: `${userProfile.firstName || userProfile.email} requested a contingency draw of ${amount.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} for ${project.projectName}. Reason: ${reason}`,
          projectId: id,
          relatedModel: 'CONTINGENCY_DRAW',
          relatedId: draw._id.toString(),
          createdBy: userProfile._id.toString(),
        });
      }
    }

    return successResponse(
      draw,
      'Contingency draw request created successfully',
      201
    );
  } catch (error) {
    console.error('Create contingency draw error:', error);
    return errorResponse('Failed to create contingency draw request', 500);
  }
}
