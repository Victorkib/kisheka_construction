/**
 * Apply Labour Template API Route
 * POST: Apply template to create labour batch
 * 
 * POST /api/labour/templates/[id]/apply
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { applyLabourTemplate } from '@/lib/schemas/labour-template-schema';

/**
 * POST /api/labour/templates/[id]/apply
 * Apply template to create labour batch
 * Auth: OWNER only
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

    const hasAccess = await hasPermission(user.id, 'apply_labour_template');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to apply labour templates.', 403);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid template ID is required', 400);
    }

    const body = await request.json();
    const { overrides = {}, workerMap = {} } = body;

    const db = await getDatabase();

    // Get template
    const template = await db.collection('labour_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!template) {
      return errorResponse('Labour template not found', 404);
    }

    // Apply template to generate entries
    const labourEntries = applyLabourTemplate(template, overrides, workerMap);

    // Update template usage stats
    await db.collection('labour_templates').updateOne(
      { _id: new ObjectId(id) },
      {
        $inc: { usageCount: 1 },
        $set: {
          lastUsedAt: new Date(),
          lastUsedBy: new ObjectId(userProfile._id),
          updatedAt: new Date(),
        },
      }
    );

    // Create audit log
    const { createAuditLog } = await import('@/lib/audit-log');
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'APPLIED',
      entityType: 'LABOUR_TEMPLATE',
      entityId: id,
      projectId: overrides.projectId || null,
      changes: {
        applied: {
          templateName: template.name,
          entriesGenerated: labourEntries.length,
          overrides,
        },
      },
    });

    return successResponse(
      {
        template: {
          _id: template._id,
          name: template.name,
        },
        labourEntries,
        entryCount: labourEntries.length,
      },
      'Template applied successfully. Use these entries to create a batch.'
    );
  } catch (error) {
    console.error('POST /api/labour/templates/[id]/apply error:', error);
    return errorResponse(error.message || 'Failed to apply labour template', 500);
  }
}

