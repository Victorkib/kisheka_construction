/**
 * Labour Template API Route (Individual Template)
 * GET: Get single template
 * PATCH: Update template
 * DELETE: Soft delete template
 * 
 * GET /api/labour/templates/[id]
 * PATCH /api/labour/templates/[id]
 * DELETE /api/labour/templates/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  validateLabourTemplate,
  calculateTemplateTotalCost,
  createLabourTemplate,
} from '@/lib/schemas/labour-template-schema';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/labour/templates/[id]
 * Get single template
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

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid template ID is required', 400);
    }

    const db = await getDatabase();

    const template = await db.collection('labour_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!template) {
      return errorResponse('Labour template not found', 404);
    }

    return successResponse(template, 'Labour template retrieved successfully');
  } catch (error) {
    console.error('GET /api/labour/templates/[id] error:', error);
    return errorResponse('Failed to retrieve labour template', 500);
  }
}

/**
 * PATCH /api/labour/templates/[id]
 * Update template
 * Auth: OWNER only
 */
export async function PATCH(request, { params }) {
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

    const hasAccess = await hasPermission(user.id, 'edit_labour_template');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to update labour templates.', 403);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid template ID is required', 400);
    }

    const body = await request.json();
    const db = await getDatabase();

    // Get existing template
    const existingTemplate = await db.collection('labour_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingTemplate) {
      return errorResponse('Labour template not found', 404);
    }

    // Merge updates
    const updatedData = {
      ...existingTemplate,
      ...body,
      updatedAt: new Date(),
    };

    // Recalculate cost if entries changed
    if (body.labourEntries) {
      updatedData.estimatedTotalCost = calculateTemplateTotalCost({ labourEntries: body.labourEntries });
      updatedData.costLastUpdated = new Date();
    }

    // Validate updated template
    const validation = validateLabourTemplate({
      name: updatedData.name,
      createdBy: existingTemplate.createdBy.toString(),
      labourEntries: updatedData.labourEntries,
      status: updatedData.status,
    });

    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Update template
    await db.collection('labour_templates').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: updatedData,
      }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'LABOUR_TEMPLATE',
      entityId: id,
      projectId: null,
      changes: {
        before: existingTemplate,
        after: updatedData,
      },
    });

    // Get updated template
    const updatedTemplate = await db.collection('labour_templates').findOne({
      _id: new ObjectId(id),
    });

    return successResponse(updatedTemplate, 'Labour template updated successfully');
  } catch (error) {
    console.error('PATCH /api/labour/templates/[id] error:', error);
    return errorResponse(error.message || 'Failed to update labour template', 500);
  }
}

/**
 * DELETE /api/labour/templates/[id]
 * Soft delete template
 * Auth: OWNER only
 */
export async function DELETE(request, { params }) {
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

    const hasAccess = await hasPermission(user.id, 'delete_labour_template');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to delete labour templates.', 403);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid template ID is required', 400);
    }

    const db = await getDatabase();

    // Get existing template
    const existingTemplate = await db.collection('labour_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingTemplate) {
      return errorResponse('Labour template not found', 404);
    }

    // Soft delete template
    await db.collection('labour_templates').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'LABOUR_TEMPLATE',
      entityId: id,
      projectId: null,
      changes: {
        deleted: existingTemplate,
      },
    });

    return successResponse(null, 'Labour template deleted successfully');
  } catch (error) {
    console.error('DELETE /api/labour/templates/[id] error:', error);
    return errorResponse(error.message || 'Failed to delete labour template', 500);
  }
}

