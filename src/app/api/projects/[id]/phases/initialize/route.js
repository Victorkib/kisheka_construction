/**
 * Initialize Default Phases for Project
 * POST: Creates default phases for a project
 * 
 * POST /api/projects/[id]/phases/initialize
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { initializeDefaultPhases } from '@/lib/phase-helpers';

/**
 * POST /api/projects/[id]/phases/initialize
 * Initializes default phases for a project
 * Auth: PM, OWNER only
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

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

    const hasCreatePermission = await hasPermission(user.id, 'create_phase');
    if (!hasCreatePermission) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can initialize phases.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const db = await getDatabase();

    // Get project
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Check if phases already exist
    const existingPhases = await db.collection('phases').countDocuments({
      projectId: new ObjectId(id),
      deletedAt: null
    });

    if (existingPhases > 0) {
      return errorResponse('Phases already exist for this project. Use individual phase creation instead.', 400);
    }

    // Initialize default phases
    const createdPhases = await initializeDefaultPhases(id, project);

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'PHASES_INITIALIZED',
      entityType: 'PROJECT',
      entityId: id,
      projectId: id,
      changes: {
        phasesCreated: createdPhases.length,
        phaseNames: createdPhases.map(p => p.phaseName)
      },
    });

    return successResponse({
      phases: createdPhases,
      count: createdPhases.length
    }, `Successfully initialized ${createdPhases.length} default phases`, 201);
  } catch (error) {
    console.error('Initialize phases error:', error);
    return errorResponse(`Failed to initialize phases: ${error.message}`, 500);
  }
}



