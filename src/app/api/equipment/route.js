/**
 * Equipment API Route
 * GET: List equipment (optionally filtered by project, phase, status, type)
 * POST: Create new equipment assignment (PM, OWNER only)
 * 
 * GET /api/equipment?projectId=xxx&phaseId=xxx&status=xxx&equipmentType=xxx
 * POST /api/equipment
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createEquipment, validateEquipment, EQUIPMENT_TYPES, EQUIPMENT_STATUSES } from '@/lib/schemas/equipment-schema';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';
import { validateEquipmentBudgetAndCapital } from '@/lib/equipment-helpers';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/equipment
 * Returns equipment, optionally filtered by projectId, phaseId, status, equipmentType
 * Auth: All authenticated users
 * Query params: projectId (optional), phaseId (optional), status (optional), equipmentType (optional), page (optional), limit (optional)
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
    const projectId = searchParams.get('projectId');
    const phaseId = searchParams.get('phaseId');
    const floorId = searchParams.get('floorId');
    const status = searchParams.get('status');
    const equipmentType = searchParams.get('equipmentType');
    const acquisitionType = searchParams.get('acquisitionType');
    const search = searchParams.get('search');

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      query.phaseId = new ObjectId(phaseId);
    }

    if (floorId && ObjectId.isValid(floorId)) {
      query.floorId = new ObjectId(floorId);
    }

    if (status && EQUIPMENT_STATUSES.includes(status)) {
      query.status = status;
    }

    if (equipmentType && EQUIPMENT_TYPES.includes(equipmentType)) {
      query.equipmentType = equipmentType;
    }

    if (acquisitionType && ['rental', 'purchase', 'owned'].includes(acquisitionType)) {
      query.acquisitionType = acquisitionType;
    }

    // Search functionality
    if (search && search.trim().length > 0) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { equipmentName: searchRegex },
        { serialNumber: searchRegex },
        { assetTag: searchRegex }
      ];
    }

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Sorting
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;
    const validSortFields = ['createdAt', 'updatedAt', 'equipmentName', 'dailyRate', 'totalCost', 'startDate'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const equipment = await db.collection('equipment')
      .find(query)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Populate phase names for better display
    const phaseIds = [...new Set(equipment.map(eq => eq.phaseId?.toString()).filter(Boolean))];
    const phases = phaseIds.length > 0 
      ? await db.collection('phases').find({
          _id: { $in: phaseIds.map(id => new ObjectId(id)) },
          deletedAt: null
        }).toArray()
      : [];
    
    const phaseMap = {};
    phases.forEach(phase => {
      phaseMap[phase._id.toString()] = phase.phaseName || phase.name || 'Unknown';
    });

    // Add phase names to equipment
    const equipmentWithPhases = equipment.map(eq => ({
      ...eq,
      phaseName: eq.phaseId ? phaseMap[eq.phaseId.toString()] : 'Unknown'
    }));

    const total = await db.collection('equipment').countDocuments(query);

    return successResponse({
      equipment: equipmentWithPhases,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Equipment retrieved successfully');
  } catch (error) {
    console.error('Get equipment error:', error);
    return errorResponse('Failed to retrieve equipment', 500);
  }
}

/**
 * POST /api/equipment
 * Creates a new equipment assignment for a phase
 * Auth: PM, OWNER only
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

    const hasCreatePermission = await hasPermission(user.id, 'create_equipment');
    if (!hasCreatePermission) {
      // Fallback to role check for backward compatibility and safety
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['owner', 'pm', 'project_manager'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse('Insufficient permissions. Only PM and OWNER can create equipment assignments.', 403);
      }
    }

    const body = await request.json();
    const {
      projectId,
      phaseId,
      phaseIds,
      floorId,
      equipmentName,
      equipmentType,
      acquisitionType,
      equipmentScope,
      supplierId,
      startDate,
      endDate,
      dailyRate,
      estimatedHours,
      status,
      notes,
      costSplit,
      // New fields
      serialNumber,
      assetTag,
      images,
      documents,
      specifications,
      operatorRequired,
      operatorType,
      operatorNotes
    } = body;

    // Validation
    if (!projectId) {
      return errorResponse('Project ID is required', 400);
    }

    if (!ObjectId.isValid(projectId)) {
      return errorResponse('Invalid project ID', 400);
    }

    // Determine equipment scope
    const scope = equipmentScope || 'phase_specific';

    // Validate based on scope
    const db = await getDatabase();
    
    if (scope === 'phase_specific') {
      if (!phaseId) {
        return errorResponse('Phase ID is required for phase-specific equipment', 400);
      }
      if (!ObjectId.isValid(phaseId)) {
        return errorResponse('Invalid phase ID', 400);
      }
      // Verify phase exists
      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(phaseId),
        projectId: new ObjectId(projectId),
        deletedAt: null
      });
      if (!phase) {
        return errorResponse('Phase not found or does not belong to this project', 400);
      }
    } else if (scope === 'floor_specific') {
      if (!phaseId) {
        return errorResponse('Phase ID is required for floor-specific equipment', 400);
      }
      if (!floorId) {
        return errorResponse('Floor ID is required for floor-specific equipment', 400);
      }
      if (!ObjectId.isValid(phaseId) || !ObjectId.isValid(floorId)) {
        return errorResponse('Invalid phase ID or floor ID', 400);
      }
      // Verify phase and floor exist
      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(phaseId),
        projectId: new ObjectId(projectId),
        deletedAt: null
      });
      if (!phase) {
        return errorResponse('Phase not found or does not belong to this project', 400);
      }
    } else if (scope === 'multi_phase') {
      if (!phaseIds || !Array.isArray(phaseIds) || phaseIds.length === 0) {
        return errorResponse('phaseIds array is required for multi-phase equipment', 400);
      }
      // Verify all phases exist and belong to project
      for (const pid of phaseIds) {
        if (!ObjectId.isValid(pid)) {
          return errorResponse(`Invalid phase ID: ${pid}`, 400);
        }
        const phase = await db.collection('phases').findOne({
          _id: new ObjectId(pid),
          projectId: new ObjectId(projectId),
          deletedAt: null
        });
        if (!phase) {
          return errorResponse(`Phase ${pid.toString().slice(-4)} not found or does not belong to this project`, 400);
        }
      }
      // Validate costSplit if provided
      if (costSplit && costSplit.type === 'percentage' && costSplit.percentages) {
        const total = Object.values(costSplit.percentages).reduce((sum, val) => sum + val, 0);
        if (Math.abs(total - 100) > 0.1) {
          return errorResponse(`costSplit.percentages must sum to 100 (current: ${total})`, 400);
        }
      }
    }
    // site_wide doesn't require phaseId

    // Phase-Floor Applicability Validation (if floorId is provided)
    if (floorId && ObjectId.isValid(floorId) && phaseId) {
      const { validatePhaseFloorApplicability } = await import('@/lib/phase-floor-validation-helpers');
      const applicability = await validatePhaseFloorApplicability(phaseId, floorId, projectId);
      if (!applicability.isValid) {
        return errorResponse(applicability.error || 'Floor is not applicable to the selected phase', 400);
      }
    }

    // Verify supplier exists if provided
    if (supplierId && ObjectId.isValid(supplierId)) {
      const supplier = await db.collection('suppliers').findOne({
        _id: new ObjectId(supplierId),
        deletedAt: null
      });

      if (!supplier) {
        return errorResponse('Supplier not found', 400);
      }
    }

    // Prepare equipment data for validation
    const equipmentData = {
      projectId,
      phaseId: scope === 'site_wide' || scope === 'multi_phase' ? null : phaseId,
      phaseIds: scope === 'multi_phase' ? phaseIds : [],
      floorId: floorId || null,
      equipmentName,
      equipmentType,
      acquisitionType,
      equipmentScope: scope,
      costSplit: costSplit || null,
      supplierId,
      serialNumber,
      assetTag,
      images: Array.isArray(images) ? images : [],
      documents: Array.isArray(documents) ? documents : [],
      specifications: specifications || null,
      operatorRequired: operatorRequired !== undefined ? operatorRequired : null,
      operatorType: operatorType || null,
      operatorNotes: operatorNotes?.trim() || null,
      startDate,
      endDate,
      dailyRate,
      status: status || 'assigned',
      notes
    };

    // Validate using schema
    const validation = validateEquipment(equipmentData);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Create equipment object
    const equipment = createEquipment(
      {
        equipmentName,
        equipmentType,
        acquisitionType,
        equipmentScope: scope,
        floorId: floorId || null,
        phaseIds: scope === 'multi_phase' ? phaseIds : [],
        costSplit: costSplit || null,
        supplierId,
        serialNumber,
        assetTag,
        images: Array.isArray(images) ? images : [],
        documents: Array.isArray(documents) ? documents : [],
        specifications: specifications || null,
        operatorRequired,
        operatorType,
        operatorNotes,
        startDate,
        endDate,
        dailyRate,
        estimatedHours,
        status: status || 'assigned',
        notes
      },
      projectId,
      scope === 'site_wide' || scope === 'multi_phase' ? null : phaseId,
      userProfile._id
    );

    // ========== BUDGET & CAPITAL VALIDATION ==========
    const budgetCapitalValidation = await validateEquipmentBudgetAndCapital({
      projectId,
      equipmentScope: scope,
      phaseId: scope === 'site_wide' ? null : phaseId,
      floorId: floorId || null,
      totalCost: equipment.totalCost,
      costSplit: equipmentData.costSplit,
      phaseIds: equipmentData.phaseIds
    });

    // Handle validation results based on scenario
    if (!budgetCapitalValidation.isValid) {
      // Has errors - block the operation
      const errorMessages = budgetCapitalValidation.errors.map(e => e.message).join('; ');
      return errorResponse(`Equipment validation failed: ${errorMessages}`, 400);
    }

    // Prepare response with warnings if any
    let warnings = [];
    let infoMessage = 'Equipment created successfully';

    if (budgetCapitalValidation.warnings.length > 0) {
      warnings = budgetCapitalValidation.warnings.map(w => ({
        type: w.type,
        message: w.message,
        severity: w.severity
      }));

      // Set appropriate info message based on scenario
      if (budgetCapitalValidation.budgetNotSet && budgetCapitalValidation.capitalNotSet) {
        infoMessage = 'Equipment created: No budget or capital set. Spending will be tracked.';
      } else if (budgetCapitalValidation.budgetNotSet) {
        infoMessage = 'Equipment created: No budget set. Capital validated successfully.';
      } else if (budgetCapitalValidation.capitalNotSet) {
        infoMessage = 'Equipment created: No capital set. Budget validated successfully. Add capital to enable capital tracking.';
      }
    }

    // Insert equipment
    const result = await db.collection('equipment').insertOne(equipment);

    const insertedEquipment = { ...equipment, _id: result.insertedId };

    // Recalculate phase spending (only for phase-specific equipment)
    // Site-wide equipment is charged to indirect costs, not phase budget
    if (scope === 'phase_specific' && phaseId) {
      try {
        await recalculatePhaseSpending(phaseId);
      } catch (phaseError) {
        console.error('Error recalculating phase spending after equipment creation:', phaseError);
        // Don't fail the request, just log the error
      }
    } else if (scope === 'site_wide') {
      // Site-wide equipment should be tracked as indirect cost
      // This will be handled separately - equipment costs are typically tracked differently
      // For now, we'll just log that it's site-wide
      console.log('Site-wide equipment created - should be tracked as indirect cost');
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'EQUIPMENT',
      entityId: result.insertedId.toString(),
      projectId: projectId,
      changes: { 
        created: insertedEquipment,
        validation: {
          budgetNotSet: budgetCapitalValidation.budgetNotSet,
          capitalNotSet: budgetCapitalValidation.capitalNotSet,
          warnings: budgetCapitalValidation.warnings
        }
      },
    });

    return successResponse({
      equipment: insertedEquipment,
      warnings,
      validation: {
        budgetNotSet: budgetCapitalValidation.budgetNotSet,
        capitalNotSet: budgetCapitalValidation.capitalNotSet,
        details: budgetCapitalValidation.validationDetails
      }
    }, infoMessage, 201);
  } catch (error) {
    console.error('Create equipment error:', error);
    return errorResponse('Failed to create equipment', 500);
  }
}

