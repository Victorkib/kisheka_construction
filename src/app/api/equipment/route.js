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
    const status = searchParams.get('status');
    const equipmentType = searchParams.get('equipmentType');
    const acquisitionType = searchParams.get('acquisitionType');

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      query.phaseId = new ObjectId(phaseId);
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

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const equipment = await db.collection('equipment')
      .find(query)
      .sort({ createdAt: -1 })
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
      notes
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

    // Phase ID is required only for phase-specific equipment
    // Site-wide equipment doesn't need a phase
    if (scope === 'phase_specific') {
      if (!phaseId) {
        return errorResponse('Phase ID is required for phase-specific equipment', 400);
      }

      if (!ObjectId.isValid(phaseId)) {
        return errorResponse('Invalid phase ID', 400);
      }
    }

    const db = await getDatabase();

    // Verify phase exists and belongs to project (only for phase-specific)
    if (scope === 'phase_specific' && phaseId) {
      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(phaseId),
        projectId: new ObjectId(projectId),
        deletedAt: null
      });

      if (!phase) {
        return errorResponse('Phase not found or does not belong to this project', 400);
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
      phaseId: scope === 'site_wide' ? null : phaseId,
      equipmentName,
      equipmentType,
      acquisitionType,
      equipmentScope: scope,
      supplierId,
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
        supplierId,
        startDate,
        endDate,
        dailyRate,
        estimatedHours,
        status: status || 'assigned',
        notes
      },
      projectId,
      scope === 'site_wide' ? null : phaseId,
      userProfile._id
    );

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
      changes: { created: insertedEquipment },
    });

    return successResponse(insertedEquipment, 'Equipment created successfully', 201);
  } catch (error) {
    console.error('Create equipment error:', error);
    return errorResponse('Failed to create equipment', 500);
  }
}

