/**
 * Phase Milestones API Route
 * GET: Get milestones for a phase
 * POST: Create new milestone for a phase
 * 
 * GET /api/phases/[id]/milestones
 * POST /api/phases/[id]/milestones
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createMilestone, validateMilestone, updateMilestoneStatuses } from '@/lib/milestone-helpers';

/**
 * GET /api/phases/[id]/milestones
 * Returns milestones for a phase
 * Auth: All authenticated users
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const db = await getDatabase();
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    // Update milestone statuses based on current dates
    const milestones = updateMilestoneStatuses(phase.milestones || []);

    return successResponse(milestones, 'Milestones retrieved successfully');
  } catch (error) {
    console.error('Get milestones error:', error);
    return errorResponse('Failed to retrieve milestones', 500);
  }
}

/**
 * POST /api/phases/[id]/milestones
 * Creates a new milestone for a phase
 * Auth: PM, OWNER only
 */
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

    const hasEditPermission = await hasPermission(user.id, 'edit_phase');
    if (!hasEditPermission) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can create milestones.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const body = await request.json();
    const {
      name,
      description,
      targetDate,
      completionCriteria,
      signOffRequired
    } = body;

    // Validate
    const validation = validateMilestone({
      name,
      targetDate,
      completionCriteria
    });

    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    const db = await getDatabase();

    // Verify phase exists
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    // Create milestone
    const milestone = createMilestone({
      name,
      description,
      targetDate,
      completionCriteria: completionCriteria || [],
      signOffRequired: signOffRequired === true
    });

    // Add milestone to phase
    const milestones = [...(phase.milestones || []), milestone];

    const result = await db.collection('phases').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          milestones: milestones,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return errorResponse('Phase not found', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'MILESTONE',
      entityId: milestone.milestoneId.toString(),
      projectId: phase.projectId.toString(),
      changes: { created: milestone },
    });

    return successResponse(milestone, 'Milestone created successfully', 201);
  } catch (error) {
    console.error('Create milestone error:', error);
    return errorResponse('Failed to create milestone', 500);
  }
}


