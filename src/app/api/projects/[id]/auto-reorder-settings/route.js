/**
 * Project Auto-Reorder Settings API Route
 * GET: Get auto-reorder settings for a project
 * PATCH: Update auto-reorder settings for a project
 * 
 * GET /api/projects/[id]/auto-reorder-settings
 * PATCH /api/projects/[id]/auto-reorder-settings
 * Auth: OWNER, PM
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/projects/[id]/auto-reorder-settings
 * Returns auto-reorder settings for a project
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

    // Get project
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Get or return default settings
    const settings = project.autoReorderSettings || {
      enabled: false,
      threshold: 20,
      urgency: 'medium',
      defaultReason: 'Low stock - automated reorder',
      floorId: null,
      categoryId: null,
      autoApprove: false,
    };

    return successResponse(settings);
  } catch (error) {
    console.error('Get auto-reorder settings error:', error);
    return errorResponse('Failed to retrieve auto-reorder settings', 500);
  }
}

/**
 * PATCH /api/projects/[id]/auto-reorder-settings
 * Updates auto-reorder settings for a project
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'manage_project_settings');
    if (!canManage) {
      return errorResponse(
        'Insufficient permissions. Only OWNER and PM can manage auto-reorder settings.',
        403
      );
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const { enabled, threshold, urgency, defaultReason, floorId, categoryId, autoApprove } = body;

    const db = await getDatabase();

    // Get existing project
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Build update data
    const updateData = {
      'autoReorderSettings.enabled': enabled !== undefined ? enabled : false,
      'autoReorderSettings.threshold': threshold !== undefined ? Math.max(0, Math.min(100, threshold)) : 20,
      'autoReorderSettings.urgency': urgency || 'medium',
      'autoReorderSettings.defaultReason': defaultReason || 'Low stock - automated reorder',
      'autoReorderSettings.floorId': floorId && ObjectId.isValid(floorId) ? new ObjectId(floorId) : null,
      'autoReorderSettings.categoryId': categoryId && ObjectId.isValid(categoryId) ? new ObjectId(categoryId) : null,
      'autoReorderSettings.autoApprove': autoApprove !== undefined ? autoApprove : false,
      updatedAt: new Date(),
    };

    // Update project
    await db.collection('projects').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'PROJECT',
      entityId: id,
      projectId: id,
      changes: {
        autoReorderSettings: {
          before: project.autoReorderSettings || {},
          after: {
            enabled: updateData['autoReorderSettings.enabled'],
            threshold: updateData['autoReorderSettings.threshold'],
            urgency: updateData['autoReorderSettings.urgency'],
            defaultReason: updateData['autoReorderSettings.defaultReason'],
            floorId: updateData['autoReorderSettings.floorId'],
            categoryId: updateData['autoReorderSettings.categoryId'],
            autoApprove: updateData['autoReorderSettings.autoApprove'],
          },
        },
      },
    });

    return successResponse(updateData, 'Auto-reorder settings updated successfully');
  } catch (error) {
    console.error('Update auto-reorder settings error:', error);
    return errorResponse('Failed to update auto-reorder settings', 500);
  }
}

