/**
 * Phase Quality Checkpoints API Route
 * GET: Get quality checkpoints for a phase
 * POST: Create new quality checkpoint for a phase
 * 
 * GET /api/phases/[id]/quality-checkpoints
 * POST /api/phases/[id]/quality-checkpoints
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createQualityCheckpoint, validateQualityCheckpoint } from '@/lib/quality-checkpoint-helpers';

/**
 * GET /api/phases/[id]/quality-checkpoints
 * Returns quality checkpoints for a phase
 * Auth: All authenticated users
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

    const checkpoints = phase.qualityCheckpoints || [];

    return successResponse(checkpoints, 'Quality checkpoints retrieved successfully');
  } catch (error) {
    console.error('Get quality checkpoints error:', error);
    return errorResponse('Failed to retrieve quality checkpoints', 500);
  }
}

/**
 * POST /api/phases/[id]/quality-checkpoints
 * Creates a new quality checkpoint for a phase
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
      return errorResponse('Insufficient permissions. Only PM and OWNER can create quality checkpoints.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const body = await request.json();
    const {
      name,
      description,
      required,
      photos
    } = body;

    // Validate
    const validation = validateQualityCheckpoint({
      name,
      photos
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

    // Create quality checkpoint
    const checkpoint = createQualityCheckpoint({
      name,
      description,
      required: required !== false, // Default to true
      photos: photos || []
    });

    // Add checkpoint to phase
    const checkpoints = [...(phase.qualityCheckpoints || []), checkpoint];

    const result = await db.collection('phases').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          qualityCheckpoints: checkpoints,
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
      entityType: 'QUALITY_CHECKPOINT',
      entityId: checkpoint.checkpointId.toString(),
      projectId: phase.projectId.toString(),
      changes: { created: checkpoint },
    });

    return successResponse(checkpoint, 'Quality checkpoint created successfully', 201);
  } catch (error) {
    console.error('Create quality checkpoint error:', error);
    return errorResponse('Failed to create quality checkpoint', 500);
  }
}


