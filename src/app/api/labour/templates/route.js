/**
 * Labour Templates API Route
 * GET: List all templates with filtering
 * POST: Create new template
 * 
 * GET /api/labour/templates
 * POST /api/labour/templates
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
  TEMPLATE_STATUS,
} from '@/lib/schemas/labour-template-schema';

/**
 * GET /api/labour/templates
 * Returns templates with filtering, sorting, and pagination
 * Auth: All authenticated users
 * Query params: createdBy, isPublic, status, search, page, limit, sortBy, sortOrder
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const createdBy = searchParams.get('createdBy');
    const isPublic = searchParams.get('isPublic');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'usageCount';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const db = await getDatabase();

    // Build query
    const query = {
      deletedAt: null, // Exclude soft-deleted templates
    };

    if (createdBy && ObjectId.isValid(createdBy)) {
      query.createdBy = new ObjectId(createdBy);
    }

    if (isPublic !== null) {
      query.isPublic = isPublic === 'true';
    }

    if (status) {
      query.status = status;
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const skip = (page - 1) * limit;
    const templates = await db
      .collection('labour_templates')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const total = await db.collection('labour_templates').countDocuments(query);

    return successResponse(
      {
        templates,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Labour templates retrieved successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/templates error:', error);
    return errorResponse('Failed to retrieve labour templates', 500);
  }
}

/**
 * POST /api/labour/templates
 * Creates a new labour template
 * Auth: OWNER only (in single-user mode)
 */
export async function POST(request) {
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

    const hasAccess = await hasPermission(user.id, 'create_labour_template');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to create labour templates.', 403);
    }

    const body = await request.json();
    const {
      name,
      description,
      isPublic,
      status,
      templateCategory,
      templateType,
      tags,
      projectPhase,
      applicableFloors,
      labourEntries,
      defaultProjectSettings,
      expiresAt,
      batchId, // Optional: create template from existing batch
    } = body;

    // If batchId provided, fetch entries from batch
    let templateEntries = labourEntries;
    if (batchId && ObjectId.isValid(batchId)) {
      const db = await getDatabase();
      const batch = await db.collection('labour_batches').findOne({
        _id: new ObjectId(batchId),
        deletedAt: null,
      });

      if (!batch) {
        return errorResponse('Batch not found', 404);
      }

      // Get entries from batch
      if (batch.labourEntryIds && batch.labourEntryIds.length > 0) {
        const entries = await db.collection('labour_entries').find({
          _id: { $in: batch.labourEntryIds.map((id) => new ObjectId(id)) },
          deletedAt: null,
        }).toArray();

        templateEntries = entries.map((entry) => ({
          workerName: entry.workerName,
          workerType: entry.workerType,
          workerRole: entry.workerRole,
          skillType: entry.skillType,
          totalHours: entry.totalHours,
          overtimeHours: entry.overtimeHours,
          hourlyRate: entry.hourlyRate,
          dailyRate: entry.dailyRate,
          taskDescription: entry.taskDescription,
          breakDuration: entry.breakDuration,
          quantityCompleted: entry.quantityCompleted,
          unitOfMeasure: entry.unitOfMeasure,
          unitRate: entry.unitRate,
          serviceType: entry.serviceType,
          visitPurpose: entry.visitPurpose,
          deliverables: entry.deliverables,
        }));
      }
    }

    // Validate template data
    const validation = validateLabourTemplate({
      name,
      createdBy: userProfile._id.toString(),
      labourEntries: templateEntries,
      status,
    });

    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Create template object
    const template = createLabourTemplate(
      {
        name,
        description,
        isPublic,
        status,
        templateCategory,
        templateType,
        tags,
        projectPhase,
        applicableFloors,
        labourEntries: templateEntries,
        defaultProjectSettings,
        expiresAt,
      },
      userProfile._id,
      `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email
    );

    const db = await getDatabase();

    // Insert template
    const result = await db.collection('labour_templates').insertOne(template);

    const createdTemplate = { ...template, _id: result.insertedId };

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'LABOUR_TEMPLATE',
      entityId: result.insertedId.toString(),
      projectId: null,
      changes: {
        created: createdTemplate,
      },
    });

    return successResponse(createdTemplate, 'Labour template created successfully');
  } catch (error) {
    console.error('POST /api/labour/templates error:', error);
    return errorResponse(error.message || 'Failed to create labour template', 500);
  }
}

