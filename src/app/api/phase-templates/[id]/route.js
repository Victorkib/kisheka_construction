/**
 * Single Phase Template API Route
 * GET: Get single template
 * PATCH: Update template
 * DELETE: Delete template
 * 
 * GET /api/phase-templates/[id]
 * PATCH /api/phase-templates/[id]
 * DELETE /api/phase-templates/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validatePhaseTemplate, TEMPLATE_TYPES } from '@/lib/schemas/phase-template-schema';

/**
 * GET /api/phase-templates/[id]
 * Returns a single phase template
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
      return errorResponse('Invalid template ID', 400);
    }

    const db = await getDatabase();
    const template = await db.collection('phase_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!template) {
      return errorResponse('Phase template not found', 404);
    }

    return successResponse(template, 'Phase template retrieved successfully');
  } catch (error) {
    console.error('Get phase template error:', error);
    return errorResponse('Failed to retrieve phase template', 500);
  }
}

/**
 * PATCH /api/phase-templates/[id]
 * Updates a phase template
 * Auth: PM, OWNER only
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const canUpdate = await hasPermission(user.id, 'edit_phase');
    if (!canUpdate) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can update phase templates.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid template ID', 400);
    }

    const body = await request.json();
    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);

    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const existingTemplate = await db.collection('phase_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!existingTemplate) {
      return errorResponse('Phase template not found', 404);
    }

    // Merge with existing template for validation
    const updatedTemplate = { ...existingTemplate, ...body };
    delete updatedTemplate._id;
    delete updatedTemplate.createdBy;
    delete updatedTemplate.createdAt;
    delete updatedTemplate.usageCount;
    delete updatedTemplate.lastUsedAt;

    // Validate
    const validation = validatePhaseTemplate(updatedTemplate);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Update template
    const updateData = { ...body };
    updateData.updatedAt = new Date();

    const result = await db.collection('phase_templates').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Failed to update phase template', 500);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'PHASE_TEMPLATE',
      entityId: id,
      changes: { old: existingTemplate, new: result.value }
    });

    return successResponse(result.value, 'Phase template updated successfully');
  } catch (error) {
    console.error('Update phase template error:', error);
    return errorResponse(error.message || 'Failed to update phase template', 500);
  }
}

/**
 * DELETE /api/phase-templates/[id]
 * Soft delete phase template
 * Auth: OWNER only
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can delete
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    if (userRole !== 'owner') {
      return errorResponse('Insufficient permissions. Only OWNER can delete phase templates.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid template ID', 400);
    }

    const db = await getDatabase();

    const existingTemplate = await db.collection('phase_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!existingTemplate) {
      return errorResponse('Phase template not found', 404);
    }

    const result = await db.collection('phase_templates').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { deletedAt: new Date(), updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Failed to delete phase template', 500);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'PHASE_TEMPLATE',
      entityId: id,
      changes: { deleted: existingTemplate }
    });

    return successResponse(null, 'Phase template deleted successfully');
  } catch (error) {
    console.error('Delete phase template error:', error);
    return errorResponse('Failed to delete phase template', 500);
  }
}


