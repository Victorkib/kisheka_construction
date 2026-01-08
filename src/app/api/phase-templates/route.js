/**
 * Phase Templates API Route
 * GET: List all phase templates
 * POST: Create new phase template
 * 
 * GET /api/phase-templates
 * POST /api/phase-templates
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createPhaseTemplate, validatePhaseTemplate, TEMPLATE_TYPES } from '@/lib/schemas/phase-template-schema';

/**
 * GET /api/phase-templates
 * Returns all phase templates
 * Auth: All authenticated users
 * Query params: templateType (optional), search (optional)
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const db = await getDatabase();

    const query = { deletedAt: null };

    // Filters
    const templateType = searchParams.get('templateType');
    const search = searchParams.get('search');

    if (templateType && TEMPLATE_TYPES.includes(templateType)) {
      query.templateType = templateType;
    }

    if (search) {
      query.$or = [
        { templateName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const templates = await db.collection('phase_templates')
      .find(query)
      .sort({ usageCount: -1, createdAt: -1 })
      .toArray();

    return successResponse(templates, 'Phase templates retrieved successfully');
  } catch (error) {
    console.error('Get phase templates error:', error);
    return errorResponse('Failed to retrieve phase templates', 500);
  }
}

/**
 * POST /api/phase-templates
 * Create new phase template
 * Auth: PM, OWNER only
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const canCreate = await hasPermission(user.id, 'edit_phase');
    if (!canCreate) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can create phase templates.', 403);
    }

    const body = await request.json();
    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);

    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Validate
    const validation = validatePhaseTemplate(body);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Create template
    const template = createPhaseTemplate(body, userProfile._id);

    const result = await db.collection('phase_templates').insertOne(template);
    const insertedTemplate = { ...template, _id: result.insertedId };

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'PHASE_TEMPLATE',
      entityId: result.insertedId.toString(),
      changes: { created: insertedTemplate }
    });

    return successResponse(insertedTemplate, 'Phase template created successfully', 201);
  } catch (error) {
    console.error('Create phase template error:', error);
    return errorResponse(error.message || 'Failed to create phase template', 500);
  }
}


