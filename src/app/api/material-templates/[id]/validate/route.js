/**
 * Template Validation API Route
 * POST: Mark template as official/validated
 * 
 * POST /api/material-templates/[id]/validate
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { TEMPLATE_STATUS } from '@/lib/schemas/material-template-schema';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/material-templates/[id]/validate
 * Validates a template (marks as official)
 * Auth: OWNER only
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can validate templates
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const isOwner = userProfile.role?.toLowerCase() === 'owner';
    if (!isOwner) {
      return errorResponse('Only OWNER can validate templates', 403);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid template ID', 400);
    }

    const body = await request.json();
    const { validationStatus, status } = body;

    const db = await getDatabase();

    // Get existing template
    const existing = await db.collection('material_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existing) {
      return errorResponse('Template not found', 404);
    }

    // Build update data
    const updateData = {
      updatedAt: new Date(),
      validatedBy: new ObjectId(userProfile._id),
      validatedAt: new Date(),
      lastValidatedAt: new Date(),
    };

    if (validationStatus) {
      updateData.validationStatus = validationStatus;
    }

    if (status) {
      updateData.status = status;
    } else if (!existing.status || existing.status === TEMPLATE_STATUS.COMMUNITY) {
      // Auto-set to official if validating
      updateData.status = TEMPLATE_STATUS.OFFICIAL;
    }

    // Update template
    const result = await db.collection('material_templates').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Failed to validate template', 500);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'VALIDATED',
      entityType: 'MATERIAL_TEMPLATE',
      entityId: id,
      changes: {
        validated: {
          validatedBy: userProfile._id.toString(),
          validatedAt: new Date(),
          status: updateData.status,
          validationStatus: updateData.validationStatus,
        },
      },
    });

    return successResponse(result.value, 'Template validated successfully');
  } catch (error) {
    console.error('Validate template error:', error);
    return errorResponse('Failed to validate template', 500);
  }
}



