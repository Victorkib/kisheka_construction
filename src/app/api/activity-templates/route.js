/**
 * Activity Templates API Route
 * GET: List all activity templates with filtering and pagination
 * POST: Create new activity template
 * 
 * GET /api/activity-templates
 * POST /api/activity-templates
 * Auth: All authenticated users (GET), OWNER/PM (POST)
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
  getActivityTypesForProfessionalType,
} from '@/lib/schemas/activity-template-schema';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/activity-templates
 * Returns activity templates with filtering, sorting, and pagination
 * Query params: type, activityType, projectPhase, status, isPublic, search, page, limit, sortBy, sortOrder
 * Auth: All authenticated users
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const activityType = searchParams.get('activityType');
    const projectPhase = searchParams.get('projectPhase');
    const status = searchParams.get('status');
    const isPublic = searchParams.get('isPublic');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'usageCount';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const db = await getDatabase();

    // Build query
    const query = { deletedAt: null };

    if (type && Object.values(TEMPLATE_PROFESSIONAL_TYPES).includes(type)) {
      query.type = type;
    }

    if (activityType) {
      query.activityType = activityType;
    }

    if (projectPhase) {
      query.projectPhase = projectPhase;
    }

    if (status && Object.values(TEMPLATE_STATUS).includes(status)) {
      query.status = status;
    }

    if (isPublic !== null && isPublic !== undefined) {
      query.isPublic = isPublic === 'true';
    }

    // Text search
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { tags: { $in: [new RegExp(search.trim(), 'i')] } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const skip = (page - 1) * limit;
    const templates = await db.collection('activity_templates')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('activity_templates').countDocuments(query);

    return successResponse({
      templates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get activity templates error:', error);
    return errorResponse('Failed to retrieve activity templates', 500);
  }
}

/**
 * POST /api/activity-templates
 * Creates a new activity template
 * Auth: OWNER/PM
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canCreate = await hasPermission(user.id, 'create_activity_template');
    if (!canCreate) {
      return errorResponse('Insufficient permissions. Only OWNER and PM can create activity templates.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.name || body.name.trim().length < 2) {
      return errorResponse('Template name is required and must be at least 2 characters', 400);
    }

    if (!body.type || !Object.values(TEMPLATE_PROFESSIONAL_TYPES).includes(body.type)) {
      return errorResponse(`Type is required and must be one of: ${Object.values(TEMPLATE_PROFESSIONAL_TYPES).join(', ')}`, 400);
    }

    if (!body.activityType) {
      return errorResponse('Activity type is required', 400);
    }

    // Validate template data
    const validation = validateActivityTemplate(body);
    if (!validation.isValid) {
      return errorResponse(validation.errors.join(', '), 400);
    }

    const db = await getDatabase();

    // Determine default status
    const defaultStatus = body.isPublic ? TEMPLATE_STATUS.COMMUNITY : TEMPLATE_STATUS.PRIVATE;

    // Build template document
    const template = {
      name: body.name.trim(),
      description: body.description?.trim() || '',
      type: body.type,
      activityType: body.activityType,
      isPublic: body.isPublic || false,
      status: body.status || defaultStatus,
      templateCategory: body.templateCategory || null,
      templateType: body.templateType || null,
      tags: Array.isArray(body.tags) ? body.tags.filter(t => t && t.trim()).map(t => t.trim()) : [],
      projectPhase: body.projectPhase || null,
      applicableFloors: body.applicableFloors === 'all' ? 'all' : (Array.isArray(body.applicableFloors) ? body.applicableFloors.map(f => parseInt(f, 10)).filter(f => !isNaN(f)) : null),
      defaultData: {
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
      },
      defaultFeeAmount: body.defaultFeeAmount ? parseFloat(body.defaultFeeAmount) : null,
      defaultExpenseAmount: body.defaultExpenseAmount ? parseFloat(body.defaultExpenseAmount) : null,
      usageCount: 0,
      lastUsedAt: null,
      lastUsedBy: null,
      lastUsedInProject: null,
      validatedBy: null,
      validatedAt: null,
      validationStatus: null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      createdBy: new ObjectId(userProfile._id),
      createdByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Insert template
    const result = await db.collection('activity_templates').insertOne(template);

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'ACTIVITY_TEMPLATE',
      entityId: result.insertedId.toString(),
      changes: { created: template },
    });

    return successResponse(
      { ...template, _id: result.insertedId },
      'Activity template created successfully',
      201
    );
  } catch (error) {
    console.error('Create activity template error:', error);
    return errorResponse('Failed to create activity template', 500);
  }
}





