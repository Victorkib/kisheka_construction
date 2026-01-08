/**
 * Material Requests API Route
 * GET: List all material requests with filters
 * POST: Create new material request
 * 
 * GET /api/material-requests
 * POST /api/material-requests
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotification, createNotifications } from '@/lib/notifications';
import { generateRequestNumber } from '@/lib/generators/request-number-generator';
import { validateMaterialRequest, VALID_URGENCY_LEVELS } from '@/lib/schemas/material-request-schema';
import { validateCapitalAvailability } from '@/lib/financial-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getProjectContext, createProjectFilter } from '@/lib/middleware/project-context';

/**
 * GET /api/material-requests
 * Returns material requests with filtering, sorting, and pagination
 * Auth: CLERK, PM, OWNER, SUPERVISOR, ACCOUNTANT
 * Query params: projectId, status, urgency, search, page, limit, sortBy, sortOrder
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canView = await hasPermission(user.id, 'view_material_requests');
    if (!canView) {
      return errorResponse('Insufficient permissions to view material requests', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const urgency = searchParams.get('urgency');
    const phaseId = searchParams.get('phaseId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Get and validate project context
    const projectContext = await getProjectContext(request, user.id);
    
    // If projectId is provided, validate access
    if (projectContext.projectId && !projectContext.hasAccess) {
      return errorResponse(projectContext.error || 'Access denied to this project', 403);
    }

    const db = await getDatabase();

    // Build query with project filter
    const query = createProjectFilter(projectContext.projectId, { deletedAt: null });
    const andConditions = [];

    // Role-based filtering
    const userRole = userProfile.role?.toLowerCase();
    if (userRole === 'clerk' || userRole === 'supervisor') {
      // CLERK/SUPERVISOR can only see their own requests
      query.requestedBy = new ObjectId(userProfile._id);
    }
    // PM, OWNER, ACCOUNTANT can see all requests

    if (status) {
      // Special handling for "ready_to_order" filter
      // This means: approved or converted_to_order but not yet linked to a purchase order
      // Supports both workflows:
      // 1. Direct PO creation (status = 'approved')
      // 2. Convert-first workflow (status = 'converted_to_order', no PO yet)
      if (status === 'ready_to_order') {
        query.status = { $in: ['approved', 'converted_to_order'] };
        query.linkedPurchaseOrderId = { $exists: false };
      } else {
        query.status = status;
      }
    }

    if (urgency && VALID_URGENCY_LEVELS.includes(urgency)) {
      query.urgency = urgency;
    }

    // Phase Management: Add phaseId filter
    if (phaseId && ObjectId.isValid(phaseId)) {
      query.phaseId = new ObjectId(phaseId);
    }

    // Search filter
    if (search) {
      const searchConditions = [
        { materialName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { requestNumber: { $regex: search, $options: 'i' } },
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
    const total = await db.collection('material_requests').countDocuments(query);

    // Get paginated results
    const skip = (page - 1) * limit;
    const requests = await db
      .collection('material_requests')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Enrich requests with batch information if they belong to a batch
    const requestsWithBatchInfo = await Promise.all(
      requests.map(async (request) => {
        if (request.batchId) {
          const batch = await db.collection('material_request_batches').findOne({
            _id: request.batchId,
            deletedAt: null,
          });
          if (batch) {
            return {
              ...request,
              batchNumber: batch.batchNumber,
              batchName: batch.batchName,
            };
          }
        }
        return request;
      })
    );

    return successResponse({
      requests: requestsWithBatchInfo,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get material requests error:', error);
    return errorResponse('Failed to retrieve material requests', 500);
  }
}

/**
 * POST /api/material-requests
 * Creates a new material request
 * Auth: CLERK, PM, OWNER, SUPERVISOR
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canCreate = await hasPermission(user.id, 'create_material_request');
    if (!canCreate) {
      return errorResponse('Insufficient permissions. Only CLERK, PM, OWNER, and SUPERVISOR can create material requests.', 403);
    }

    const body = await request.json();
    const {
      projectId,
      floorId,
      categoryId,
      category,
      phaseId,
      materialName,
      description,
      quantityNeeded,
      unit,
      urgency,
      estimatedCost,
      estimatedUnitCost,
      reason,
      notes,
    } = body;

    // Validate required fields
    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    if (!materialName || materialName.trim().length < 2) {
      return errorResponse('Material name is required and must be at least 2 characters', 400);
    }

    if (!quantityNeeded || quantityNeeded <= 0) {
      return errorResponse('Quantity needed must be greater than 0', 400);
    }

    if (!unit || unit.trim().length === 0) {
      return errorResponse('Unit is required', 400);
    }

    if (!urgency || !VALID_URGENCY_LEVELS.includes(urgency)) {
      return errorResponse(`Urgency is required and must be one of: ${VALID_URGENCY_LEVELS.join(', ')}`, 400);
    }

    // Validate optional fields
    if (estimatedCost !== undefined && estimatedCost < 0) {
      return errorResponse('Estimated cost must be >= 0', 400);
    }

    if (estimatedUnitCost !== undefined && estimatedUnitCost < 0) {
      return errorResponse('Estimated unit cost must be >= 0', 400);
    }

    // Get user profile
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // DUPLICATE DETECTION: Check for existing active requests for the same material and project
    if (materialName && projectId && ObjectId.isValid(projectId)) {
      const existingRequest = await db.collection('material_requests').findOne({
        materialName: { $regex: new RegExp(`^${materialName.trim()}$`, 'i') },
        projectId: new ObjectId(projectId),
        status: { $in: ['requested', 'pending_approval', 'approved', 'converted_to_order'] },
        deletedAt: null,
      });
      
      if (existingRequest) {
        return errorResponse(
          `A material request for "${materialName}" already exists for this project with status "${existingRequest.status}". ` +
          `Please check request ${existingRequest.requestNumber} or wait for it to be processed.`,
          400
        );
      }
    }

    // Verify floor exists if provided
    if (floorId && ObjectId.isValid(floorId)) {
      const floor = await db.collection('floors').findOne({
        _id: new ObjectId(floorId),
      });
      if (!floor) {
        return errorResponse('Floor not found', 404);
      }
    }

    // Verify category exists if provided
    if (categoryId && ObjectId.isValid(categoryId)) {
      const categoryDoc = await db.collection('categories').findOne({
        _id: new ObjectId(categoryId),
      });
      if (!categoryDoc) {
        return errorResponse('Category not found', 404);
      }
    }

    // Build material request data for validation
    const materialRequestData = {
      requestedBy: userProfile._id.toString(),
      projectId,
      materialName,
      quantityNeeded,
      unit,
      urgency,
      estimatedCost,
      estimatedUnitCost,
      phaseId,
      floorId,
      categoryId,
      status: 'requested',
    };

    // PhaseId is now required - validate using centralized helper
    const { validatePhaseForMaterialRequest } = await import('@/lib/phase-validation-helpers');
    const phaseValidation = await validatePhaseForMaterialRequest(phaseId, projectId);
    
    if (!phaseValidation.isValid) {
      return errorResponse(phaseValidation.error, phaseValidation.phase ? 400 : 404);
    }
    
    const phase = phaseValidation.phase;

    // Validate using schema validation (includes phaseId validation)
    const validation = validateMaterialRequest(materialRequestData);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Phase Budget Validation: Check if estimated cost fits within phase material budget
    if (estimatedCost && estimatedCost > 0) {
      const { validatePhaseMaterialBudget } = await import('@/lib/phase-helpers');
      const budgetValidation = await validatePhaseMaterialBudget(phaseId, estimatedCost);
      
      if (!budgetValidation.isValid) {
        return errorResponse(
          `Phase material budget exceeded. ${budgetValidation.message}. ` +
          `Phase material budget: ${budgetValidation.materialBudget.toLocaleString()}, ` +
          `Available: ${budgetValidation.available.toLocaleString()}, ` +
          `Required: ${budgetValidation.required.toLocaleString()}`,
          400
        );
      }
    }

    // Check capital availability (warning only, don't block request creation)
    let capitalWarning = null;
    try {
      const requestAmount = estimatedCost || 0;
      
      if (requestAmount > 0) {
        const capitalCheck = await validateCapitalAvailability(
          projectId.toString(),
          requestAmount
        );
        
        if (!capitalCheck.isValid) {
          capitalWarning = {
            message: `Insufficient capital. Available: ${capitalCheck.available.toLocaleString()}, Required: ${requestAmount.toLocaleString()}, Shortfall: ${(requestAmount - capitalCheck.available).toLocaleString()}`,
            available: capitalCheck.available,
            required: requestAmount,
            shortfall: requestAmount - capitalCheck.available,
          };
        }
      } else if (estimatedCost === undefined || estimatedCost === null) {
        // If no estimated cost provided, show info message
        capitalWarning = {
          message: 'No estimated cost provided. Capital validation will occur when converting to purchase order.',
          type: 'info',
        };
      }
    } catch (capitalError) {
      // Don't fail request creation if capital check fails
      console.error('Capital check error during material request creation:', capitalError);
    }

    // Generate request number
    const requestNumber = await generateRequestNumber();

    // Build material request document
    const materialRequest = {
      requestNumber,
      requestedBy: new ObjectId(userProfile._id),
      requestedByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      projectId: new ObjectId(projectId),
      ...(floorId && ObjectId.isValid(floorId) && { floorId: new ObjectId(floorId) }),
      ...(categoryId && ObjectId.isValid(categoryId) && { categoryId: new ObjectId(categoryId) }),
      ...(category && { category: category.trim() }),
      phaseId: new ObjectId(phaseId), // Required - validated above
      materialName: materialName.trim(),
      description: description?.trim() || '',
      quantityNeeded: parseFloat(quantityNeeded),
      unit: unit.trim(),
      urgency,
      ...(estimatedCost !== undefined && { estimatedCost: parseFloat(estimatedCost) }),
      ...(estimatedUnitCost !== undefined && { estimatedUnitCost: parseFloat(estimatedUnitCost) }),
      reason: reason?.trim() || '',
      status: 'pending_approval', // Default status
      submittedAt: new Date(),
      notes: notes?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Insert material request
    const result = await db.collection('material_requests').insertOne(materialRequest);

    const insertedRequest = { ...materialRequest, _id: result.insertedId };

    // Collect warnings (from validation and capital check)
    const warnings = [];
    if (validation.warnings && validation.warnings.length > 0) {
      warnings.push(...validation.warnings);
    }
    if (capitalWarning) {
      warnings.push(capitalWarning.message);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'MATERIAL_REQUEST',
      entityId: result.insertedId.toString(),
      projectId: projectId,
      changes: { created: insertedRequest },
    });

    // Create notifications for approvers (PM/OWNER)
    const approvers = await db.collection('users').find({
      role: { $in: ['pm', 'project_manager', 'owner'] },
      status: 'active',
    }).toArray();

    if (approvers.length > 0) {
      const notifications = approvers.map(approver => ({
        userId: approver._id.toString(),
        type: 'approval_needed',
        title: 'New Material Request',
        message: `${materialRequest.requestedByName} requested ${quantityNeeded} ${unit} of ${materialName} (${urgency} urgency)`,
        projectId: projectId,
        relatedModel: 'MATERIAL_REQUEST',
        relatedId: result.insertedId.toString(),
        createdBy: userProfile._id.toString(),
      }));

      await createNotifications(notifications);
    }

    // Include warnings in response if present
    const responseData = { ...insertedRequest };
    if (warnings.length > 0) {
      responseData.warnings = warnings;
    }
    if (capitalWarning) {
      responseData.capitalWarning = capitalWarning;
    }

    return successResponse(responseData, 'Material request created successfully', 201);
  } catch (error) {
    console.error('Create material request error:', error);
    return errorResponse('Failed to create material request', 500);
  }
}

