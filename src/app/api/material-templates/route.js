/**
 * Material Templates API Route
 * GET: List all templates with filtering
 * POST: Create new template
 * 
 * GET /api/material-templates
 * POST /api/material-templates
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { validateMaterialTemplate, calculateTemplateTotalCost, TEMPLATE_STATUS } from '@/lib/schemas/material-template-schema';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/material-templates
 * Returns templates with filtering, sorting, and pagination
 * Auth: All authenticated users
 * Query params: createdBy, isPublic, search, page, limit, sortBy, sortOrder
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

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
    const templateCategory = searchParams.get('templateCategory');
    const templateType = searchParams.get('templateType');
    const projectPhase = searchParams.get('projectPhase');
    const applicableFloor = searchParams.get('applicableFloor');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'usageCount';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);

    // Build query
    const query = { deletedAt: null };
    const andConditions = [];

    // Filter by creator
    if (createdBy && ObjectId.isValid(createdBy)) {
      query.createdBy = new ObjectId(createdBy);
    } else if (createdBy === 'me' && userProfile) {
      query.createdBy = new ObjectId(userProfile._id);
    }

    // Filter by public/private
    if (isPublic === 'true') {
      query.isPublic = true;
    } else if (isPublic === 'false' && userProfile) {
      // Show user's own templates or public ones
      andConditions.push({
        $or: [
          { createdBy: new ObjectId(userProfile._id) },
          { isPublic: true },
        ],
      });
    } else if (userProfile) {
      // Default: show user's templates and public templates
      andConditions.push({
        $or: [
          { createdBy: new ObjectId(userProfile._id) },
          { isPublic: true },
        ],
      });
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by template category
    if (templateCategory) {
      query.templateCategory = templateCategory;
    }

    // Filter by template type
    if (templateType) {
      query.templateType = templateType;
    }

    // Filter by project phase
    if (projectPhase) {
      query.projectPhase = projectPhase;
    }

    // Filter by applicable floor
    if (applicableFloor !== null && applicableFloor !== undefined) {
      const floorNum = parseInt(applicableFloor, 10);
      if (!isNaN(floorNum)) {
        query.$or = [
          { applicableFloors: floorNum },
          { applicableFloors: 'all' },
          { applicableFloors: { $exists: false } }, // Templates without floor restriction
        ];
      }
    }

    // Search filter (enhanced to include tags)
    if (search) {
      const searchConditions = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { templateType: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
      andConditions.push({ $or: searchConditions });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get total count
    const total = await db.collection('material_templates').countDocuments(query);

    // Get paginated results
    const skip = (page - 1) * limit;
    const templates = await db
      .collection('material_templates')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

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
    console.error('Get material templates error:', error);
    return errorResponse('Failed to retrieve templates', 500);
  }
}

/**
 * POST /api/material-templates
 * Creates a new material template
 * Auth: OWNER, PM
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canCreate = await hasPermission(user.id, 'create_material_template');
    if (!canCreate) {
      return errorResponse(
        'Insufficient permissions. Only OWNER and PM can create material templates.',
        403
      );
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const { 
      name, 
      description, 
      isPublic, 
      materials, 
      defaultProjectSettings, 
      batchId,
      status,
      templateCategory,
      templateType,
      tags,
      projectPhase,
      applicableFloors,
      expiresAt,
    } = body;

    // If batchId provided, fetch materials from batch
    let templateMaterials = materials;
    if (batchId && ObjectId.isValid(batchId)) {
      const db = await getDatabase();
      const batch = await db.collection('material_request_batches').findOne({
        _id: new ObjectId(batchId),
        deletedAt: null,
      });

      if (!batch) {
        return errorResponse('Batch not found', 404);
      }

      const materialRequests = await db
        .collection('material_requests')
        .find({
          _id: { $in: batch.materialRequestIds },
          deletedAt: null,
        })
        .toArray();

      templateMaterials = materialRequests.map((req) => ({
        name: req.materialName,
        quantityNeeded: req.quantityNeeded,
        unit: req.unit,
        categoryId: req.categoryId,
        category: req.category,
        estimatedUnitCost: req.estimatedUnitCost,
        estimatedCost: req.estimatedCost,
        description: req.description,
        libraryMaterialId: req.libraryMaterialId,
      }));
    }

    // Validate template
    const validation = validateMaterialTemplate({
      name,
      materials: templateMaterials,
    });

    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    const db = await getDatabase();

    // Calculate total cost
    const estimatedTotalCost = calculateTemplateTotalCost(templateMaterials);

    // Determine default status
    const defaultStatus = isPublic ? TEMPLATE_STATUS.COMMUNITY : TEMPLATE_STATUS.PRIVATE;

    // Build template document
    const template = {
      name: name.trim(),
      description: description?.trim() || '',
      isPublic: isPublic || false,
      status: status || defaultStatus,
      templateCategory: templateCategory || null,
      templateType: templateType || null,
      tags: Array.isArray(tags) ? tags.filter(t => t && t.trim()).map(t => t.trim()) : [],
      projectPhase: projectPhase || null,
      applicableFloors: applicableFloors === 'all' ? 'all' : (Array.isArray(applicableFloors) ? applicableFloors.map(f => parseInt(f, 10)).filter(f => !isNaN(f)) : null),
      createdBy: new ObjectId(userProfile._id),
      createdByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      validatedBy: null,
      validatedAt: null,
      lastValidatedAt: null,
      validationStatus: null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      materials: templateMaterials.map((m) => ({
        name: m.name.trim(),
        quantityNeeded: parseFloat(m.quantityNeeded),
        quantityPerUnit: m.quantityPerUnit ? parseFloat(m.quantityPerUnit) : null,
        unit: m.unit.trim(),
        categoryId: m.categoryId && ObjectId.isValid(m.categoryId) ? new ObjectId(m.categoryId) : null,
        category: m.category || '',
        estimatedUnitCost: m.estimatedUnitCost ? parseFloat(m.estimatedUnitCost) : null,
        estimatedCost: m.estimatedCost ? parseFloat(m.estimatedCost) : null,
        description: m.description?.trim() || '',
        specifications: m.specifications?.trim() || '',
        libraryMaterialId: m.libraryMaterialId && ObjectId.isValid(m.libraryMaterialId) ? new ObjectId(m.libraryMaterialId) : null,
        isScalable: m.isScalable || false,
        scalingFactor: m.scalingFactor || 'fixed',
      })),
      defaultProjectSettings: {
        defaultUrgency: defaultProjectSettings?.defaultUrgency || 'medium',
        defaultReason: defaultProjectSettings?.defaultReason || '',
        defaultCategoryId: defaultProjectSettings?.defaultCategoryId && ObjectId.isValid(defaultProjectSettings.defaultCategoryId) 
          ? new ObjectId(defaultProjectSettings.defaultCategoryId) 
          : null,
        defaultFloorId: defaultProjectSettings?.defaultFloorId && ObjectId.isValid(defaultProjectSettings.defaultFloorId)
          ? new ObjectId(defaultProjectSettings.defaultFloorId)
          : null,
      },
      estimatedTotalCost: estimatedTotalCost > 0 ? estimatedTotalCost : null,
      costLastUpdated: estimatedTotalCost > 0 ? new Date() : null,
      usageCount: 0,
      lastUsedAt: null,
      lastUsedBy: null,
      parentTemplateId: null,
      variantType: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Insert template
    const result = await db.collection('material_templates').insertOne(template);

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'MATERIAL_TEMPLATE',
      entityId: result.insertedId.toString(),
      changes: { created: template },
    });

    return successResponse(
      { ...template, _id: result.insertedId },
      'Template created successfully',
      201
    );
  } catch (error) {
    console.error('Create material template error:', error);
    return errorResponse('Failed to create template', 500);
  }
}

