/**
 * Activity Templates API Route (by ID)
 * GET: Get single activity template
 * PATCH: Update activity template
 * DELETE: Delete activity template (soft delete)
 * 
 * GET /api/activity-templates/[id]
 * PATCH /api/activity-templates/[id]
 * DELETE /api/activity-templates/[id]
 * Auth: All authenticated users (GET), OWNER/PM (PATCH), OWNER only (DELETE)
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
  validateActivityTemplate,
  TEMPLATE_STATUS,
  TEMPLATE_PROFESSIONAL_TYPES,
} from '@/lib/schemas/activity-template-schema';

/**
 * GET /api/activity-templates/[id]
 * Get single activity template by ID
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
      return errorResponse('Invalid activity template ID', 400);
    }

    const db = await getDatabase();
    const template = await db.collection('activity_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!template) {
      return errorResponse('Activity template not found', 404);
    }

    return successResponse(template);
  } catch (error) {
    console.error('Get activity template error:', error);
    return errorResponse('Failed to retrieve activity template', 500);
  }
}

/**
 * PATCH /api/activity-templates/[id]
 * Update activity template
 * Auth: OWNER/PM
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canEdit = await hasPermission(user.id, 'manage_activity_templates');
    if (!canEdit) {
      return errorResponse('Insufficient permissions. Only OWNER and PM can edit activity templates.', 403);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid activity template ID', 400);
    }

    const body = await request.json();
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();

    // Get existing template
    const existing = await db.collection('activity_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existing) {
      return errorResponse('Activity template not found', 404);
    }

    // Build update data
    const updateData = {
      updatedAt: new Date(),
    };

    const changes = {};

    // Update name
    if (body.name !== undefined) {
      if (!body.name || body.name.trim().length < 2) {
        return errorResponse('Template name must be at least 2 characters', 400);
      }
      updateData.name = body.name.trim();
      changes.name = { oldValue: existing.name, newValue: updateData.name };
    }

    // Update description
    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || '';
      changes.description = { oldValue: existing.description, newValue: updateData.description };
    }

    // Update type (only if not used)
    if (body.type !== undefined) {
      if (!Object.values(TEMPLATE_PROFESSIONAL_TYPES).includes(body.type)) {
        return errorResponse(`Invalid type. Must be one of: ${Object.values(TEMPLATE_PROFESSIONAL_TYPES).join(', ')}`, 400);
      }
      if (existing.usageCount > 0) {
        return errorResponse('Cannot change type of a template that has been used', 400);
      }
      updateData.type = body.type;
      changes.type = { oldValue: existing.type, newValue: body.type };
    }

    // Update activity type
    if (body.activityType !== undefined) {
      updateData.activityType = body.activityType;
      changes.activityType = { oldValue: existing.activityType, newValue: body.activityType };
    }

    // Update isPublic
    if (body.isPublic !== undefined) {
      updateData.isPublic = body.isPublic;
      // Auto-update status based on isPublic
      if (body.isPublic && existing.status === TEMPLATE_STATUS.PRIVATE) {
        updateData.status = TEMPLATE_STATUS.COMMUNITY;
      } else if (!body.isPublic && existing.status === TEMPLATE_STATUS.COMMUNITY) {
        updateData.status = TEMPLATE_STATUS.PRIVATE;
      }
      changes.isPublic = { oldValue: existing.isPublic, newValue: body.isPublic };
    }

    // Update status
    if (body.status !== undefined) {
      if (!Object.values(TEMPLATE_STATUS).includes(body.status)) {
        return errorResponse(`Invalid status. Must be one of: ${Object.values(TEMPLATE_STATUS).join(', ')}`, 400);
      }
      updateData.status = body.status;
      changes.status = { oldValue: existing.status, newValue: body.status };
    }

    // Update template category
    if (body.templateCategory !== undefined) {
      updateData.templateCategory = body.templateCategory || null;
      changes.templateCategory = { oldValue: existing.templateCategory, newValue: updateData.templateCategory };
    }

    // Update template type
    if (body.templateType !== undefined) {
      updateData.templateType = body.templateType || null;
      changes.templateType = { oldValue: existing.templateType, newValue: updateData.templateType };
    }

    // Update tags
    if (body.tags !== undefined) {
      updateData.tags = Array.isArray(body.tags) ? body.tags.filter(t => t && t.trim()).map(t => t.trim()) : [];
      changes.tags = { oldValue: existing.tags, newValue: updateData.tags };
    }

    // Update project phase
    if (body.projectPhase !== undefined) {
      updateData.projectPhase = body.projectPhase || null;
      changes.projectPhase = { oldValue: existing.projectPhase, newValue: updateData.projectPhase };
    }

    // Update applicable floors
    if (body.applicableFloors !== undefined) {
      updateData.applicableFloors = body.applicableFloors === 'all' ? 'all' : (Array.isArray(body.applicableFloors) ? body.applicableFloors.map(f => parseInt(f, 10)).filter(f => !isNaN(f)) : null);
      changes.applicableFloors = { oldValue: existing.applicableFloors, newValue: updateData.applicableFloors };
    }

    // Update default data
    if (body.defaultData !== undefined) {
      updateData.defaultData = {
        visitPurpose: body.defaultData?.visitPurpose || null,
        visitDuration: body.defaultData?.visitDuration ? parseFloat(body.defaultData.visitDuration) : null,
        inspectionType: body.defaultData?.inspectionType || null,
        areasInspected: Array.isArray(body.defaultData?.areasInspected) ? body.defaultData.areasInspected : [],
        complianceStatus: body.defaultData?.complianceStatus || null,
        notes: body.defaultData?.notes || null,
        observations: body.defaultData?.observations || null,
        recommendations: body.defaultData?.recommendations || null,
        attendees: Array.isArray(body.defaultData?.attendees) ? body.defaultData.attendees : [],
        affectedAreas: Array.isArray(body.defaultData?.affectedAreas) ? body.defaultData.affectedAreas : [],
        revisionReason: body.defaultData?.revisionReason || null,
      };
      changes.defaultData = { oldValue: existing.defaultData, newValue: updateData.defaultData };
    }

    // Update default fee amount
    if (body.defaultFeeAmount !== undefined) {
      updateData.defaultFeeAmount = body.defaultFeeAmount ? parseFloat(body.defaultFeeAmount) : null;
      changes.defaultFeeAmount = { oldValue: existing.defaultFeeAmount, newValue: updateData.defaultFeeAmount };
    }

    // Update default expense amount
    if (body.defaultExpenseAmount !== undefined) {
      updateData.defaultExpenseAmount = body.defaultExpenseAmount ? parseFloat(body.defaultExpenseAmount) : null;
      changes.defaultExpenseAmount = { oldValue: existing.defaultExpenseAmount, newValue: updateData.defaultExpenseAmount };
    }

    // Update expiresAt
    if (body.expiresAt !== undefined) {
      updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
      changes.expiresAt = { oldValue: existing.expiresAt, newValue: updateData.expiresAt };
    }

    // Validate updated template
    const templateToValidate = { ...existing, ...updateData };
    const validation = validateActivityTemplate(templateToValidate);
    if (!validation.isValid) {
      return errorResponse(validation.errors.join(', '), 400);
    }

    // Update
    const result = await db.collection('activity_templates').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Activity template not found', 404);
    }

    // Create audit log
    if (Object.keys(changes).length > 0) {
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'UPDATED',
        entityType: 'ACTIVITY_TEMPLATE',
        entityId: id,
        changes,
      });
    }

    return successResponse(result.value, 'Activity template updated successfully');
  } catch (error) {
    console.error('Update activity template error:', error);
    return errorResponse('Failed to update activity template', 500);
  }
}

/**
 * DELETE /api/activity-templates/[id]
 * Delete activity template (soft delete)
 * Auth: OWNER only
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - OWNER only
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    if (userRole !== 'owner') {
      return errorResponse('Insufficient permissions. Only OWNER can delete activity templates.', 403);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid activity template ID', 400);
    }

    const db = await getDatabase();

    // Check if template exists
    const existing = await db.collection('activity_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existing) {
      return errorResponse('Activity template not found', 404);
    }

    // Soft delete
    const result = await db.collection('activity_templates').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          deletedAt: new Date(),
          updatedAt: new Date(),
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Activity template not found', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'ACTIVITY_TEMPLATE',
      entityId: id,
      changes: { deleted: result.value },
    });

    return successResponse(null, 'Activity template deleted successfully');
  } catch (error) {
    console.error('Delete activity template error:', error);
    return errorResponse('Failed to delete activity template', 500);
  }
}





