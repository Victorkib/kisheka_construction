/**
 * Project Thresholds API Route
 * GET: Get wastage thresholds for a project
 * PUT: Update wastage thresholds for a project
 * 
 * GET/PUT /api/projects/[id]/thresholds
 * Auth: PM, OWNER only
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { DEFAULT_THRESHOLDS } from '@/lib/discrepancy-detection';

/**
 * GET /api/projects/[id]/thresholds
 * Gets wastage thresholds for a project
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

    // Check permission
    const hasViewPermission = await hasPermission(user.id, 'view_reports');
    if (!hasViewPermission) {
      return errorResponse('Insufficient permissions to view thresholds', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const db = await getDatabase();
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Return project thresholds or defaults
    const thresholds = project.wastageThresholds || DEFAULT_THRESHOLDS;

    return successResponse({
      projectId: id,
      thresholds,
      isDefault: !project.wastageThresholds,
    });
  } catch (error) {
    console.error('Get thresholds error:', error);
    return errorResponse('Failed to retrieve thresholds', 500);
  }
}

/**
 * PUT /api/projects/[id]/thresholds
 * Updates wastage thresholds for a project
 */
export async function PUT(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - Only PM and OWNER can update thresholds
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    const canUpdate = ['owner', 'pm', 'project_manager'].includes(userRole);
    if (!canUpdate) {
      return errorResponse('Insufficient permissions. Only OWNER and PM can update thresholds.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const body = await request.json();
    const { thresholds } = body;

    if (!thresholds || typeof thresholds !== 'object') {
      return errorResponse('Thresholds object is required', 400);
    }

    // Validate threshold values
    const validatedThresholds = {
      variancePercentage: Math.max(0, Math.min(100, parseFloat(thresholds.variancePercentage) || DEFAULT_THRESHOLDS.variancePercentage)),
      varianceAmount: Math.max(0, parseFloat(thresholds.varianceAmount) || DEFAULT_THRESHOLDS.varianceAmount),
      lossPercentage: Math.max(0, Math.min(100, parseFloat(thresholds.lossPercentage) || DEFAULT_THRESHOLDS.lossPercentage)),
      lossAmount: Math.max(0, parseFloat(thresholds.lossAmount) || DEFAULT_THRESHOLDS.lossAmount),
      wastagePercentage: Math.max(0, Math.min(100, parseFloat(thresholds.wastagePercentage) || DEFAULT_THRESHOLDS.wastagePercentage)),
    };

    const db = await getDatabase();

    // Check if project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Update project with thresholds
    await db.collection('projects').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          wastageThresholds: validatedThresholds,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    return successResponse({
      projectId: id,
      thresholds: validatedThresholds,
      message: 'Thresholds updated successfully',
    });
  } catch (error) {
    console.error('Update thresholds error:', error);
    return errorResponse('Failed to update thresholds', 500);
  }
}

