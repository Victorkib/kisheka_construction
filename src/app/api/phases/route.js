/**
 * Phases API Route
 * GET: List phases (optionally filtered by project)
 * POST: Create new phase (PM, OWNER only)
 * 
 * GET /api/phases?projectId=xxx
 * POST /api/phases
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getProjectContext, createProjectFilter } from '@/lib/middleware/project-context';
import { createPhase, validatePhase, DEFAULT_PHASES, PHASE_TYPES, PHASE_STATUSES } from '@/lib/schemas/phase-schema';
import { validatePhaseDependencies, calculatePhaseStartDate } from '@/lib/phase-dependency-helpers';

/**
 * GET /api/phases
 * Returns phases, optionally filtered by projectId
 * Auth: All authenticated users
 * Query params: projectId (optional), status (optional), phaseType (optional)
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const phaseType = searchParams.get('phaseType');
    const includeFinancials = searchParams.get('includeFinancials') === 'true';

    // Get and validate project context
    const projectContext = await getProjectContext(request, user.id);
    
    // If projectId is provided, validate access
    if (projectContext.projectId && !projectContext.hasAccess) {
      return errorResponse(projectContext.error || 'Access denied to this project', 403);
    }

    const db = await getDatabase();
    
    // Build query with project filter
    const query = createProjectFilter(projectContext.projectId, { deletedAt: null });
    
    if (status) {
      query.status = status;
    }
    
    if (phaseType) {
      query.phaseType = phaseType;
    }

    const phases = await db
      .collection('phases')
      .find(query)
      .sort({ sequence: 1, createdAt: 1 })
      .toArray();

    // Calculate financial summaries if requested
    let phasesWithFinancials = phases;
    if (includeFinancials) {
      const { calculatePhaseFinancialSummary } = await import('@/lib/schemas/phase-schema');
      
      phasesWithFinancials = phases.map(phase => {
        const financialSummary = calculatePhaseFinancialSummary(phase);
        return {
          ...phase,
          financialSummary
        };
      });
    }

    return successResponse(phasesWithFinancials, 'Phases retrieved successfully');
  } catch (error) {
    console.error('Get phases error:', error);
    return errorResponse('Failed to retrieve phases', 500);
  }
}

/**
 * POST /api/phases
 * Creates a new phase for a project
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

    const hasCreatePermission = await hasPermission(user.id, 'create_phase');
    if (!hasCreatePermission) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can create phases.', 403);
    }

    const body = await request.json();
    const {
      projectId,
      phaseName,
      phaseCode,
      phaseType,
      sequence,
      description = '',
      budgetAllocation = {},
      applicableFloors = 'all',
      applicableCategories = [],
      startDate = null,
      plannedEndDate = null,
      useTemplate = false,
      templateName = null,
      dependsOn = [] // Phase 2: Dependencies
    } = body;

    // Validation
    if (!projectId) {
      return errorResponse('Project ID is required', 400);
    }

    if (!ObjectId.isValid(projectId)) {
      return errorResponse('Invalid project ID', 400);
    }

    if (!phaseName || phaseName.trim().length === 0) {
      return errorResponse('Phase name is required', 400);
    }

    if (sequence === undefined || sequence === null) {
      return errorResponse('Sequence is required', 400);
    }

    if (typeof sequence !== 'number' || sequence < 0) {
      return errorResponse('Sequence must be a non-negative number', 400);
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      deletedAt: null
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Phase 2: Validate dependencies if provided
    if (dependsOn && Array.isArray(dependsOn) && dependsOn.length > 0) {
      const depValidation = await validatePhaseDependencies(
        null, // New phase, no ID yet
        dependsOn,
        projectId
      );
      
      if (!depValidation.isValid) {
        return errorResponse(`Dependency validation failed: ${depValidation.errors.join(', ')}`, 400);
      }
    }

    // Check if using template
    let phaseData = {
      projectId,
      phaseName: phaseName.trim(),
      phaseCode: phaseCode || null,
      phaseType: phaseType || PHASE_TYPES.CONSTRUCTION,
      sequence,
      description: description?.trim() || '',
      budgetAllocation: {
        total: budgetAllocation.total || 0,
        materials: budgetAllocation.materials || 0,
        labour: budgetAllocation.labour || 0,
        equipment: budgetAllocation.equipment || 0,
        subcontractors: budgetAllocation.subcontractors || 0,
        contingency: budgetAllocation.contingency || 0
      },
      applicableFloors,
      applicableCategories: Array.isArray(applicableCategories) 
        ? applicableCategories.map(id => new ObjectId(id))
        : [],
      startDate: startDate ? new Date(startDate) : null,
      plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
      dependsOn: Array.isArray(dependsOn) ? dependsOn : [] // Phase 2: Dependencies
    };

    // If using template, find and apply template
    if (useTemplate && templateName) {
      const template = DEFAULT_PHASES.find(p => p.phaseName === templateName || p.phaseCode === templateName);
      if (template) {
        phaseData = {
          ...template,
          ...phaseData,
          projectId,
          phaseName: phaseData.phaseName || template.phaseName,
          sequence: phaseData.sequence !== undefined ? phaseData.sequence : template.sequence
        };
      }
    }

    // Create phase using schema function
    const phase = createPhase(phaseData, new ObjectId(projectId));

    // Validate phase
    const validation = validatePhase(phase);
    if (!validation.isValid) {
      return errorResponse(`Invalid phase data: ${validation.errors.join(', ')}`, 400);
    }

    // Phase 2: Calculate canStartAfter date based on dependencies
    // Convert dependsOn to ObjectIds for storage
    if (phase.dependsOn && phase.dependsOn.length > 0) {
      phase.dependsOn = phase.dependsOn
        .filter(id => ObjectId.isValid(id))
        .map(id => new ObjectId(id));
      
      // Calculate canStartAfter after phase is created (we'll update it after insertion)
      // For now, set to null - will be calculated after phase exists
      phase.canStartAfter = null;
    }

    // Check if phase code already exists for this project (if provided)
    if (phase.phaseCode) {
      const existingByCode = await db.collection('phases').findOne({
        projectId: new ObjectId(projectId),
        phaseCode: phase.phaseCode,
        deletedAt: null
      });

      if (existingByCode) {
        return errorResponse(`Phase with code ${phase.phaseCode} already exists for this project`, 400);
      }
    }

    // Check if sequence already exists for this project
    const existingBySequence = await db.collection('phases').findOne({
      projectId: new ObjectId(projectId),
      sequence: phase.sequence,
      deletedAt: null
    });

    if (existingBySequence) {
      return errorResponse(`Phase with sequence ${phase.sequence} already exists for this project`, 400);
    }

    // Insert phase
    const result = await db.collection('phases').insertOne(phase);

    const insertedPhase = { ...phase, _id: result.insertedId };

    // Phase 2: Calculate and update canStartAfter date if dependencies exist
    if (insertedPhase.dependsOn && insertedPhase.dependsOn.length > 0) {
      const canStartAfter = await calculatePhaseStartDate(result.insertedId.toString());
      if (canStartAfter) {
        await db.collection('phases').updateOne(
          { _id: result.insertedId },
          { $set: { canStartAfter } }
        );
        insertedPhase.canStartAfter = canStartAfter;
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'PHASE',
      entityId: result.insertedId.toString(),
      projectId: projectId,
      changes: { created: insertedPhase },
    });

    return successResponse(insertedPhase, 'Phase created successfully', 201);
  } catch (error) {
    console.error('Create phase error:', error);
    return errorResponse('Failed to create phase', 500);
  }
}



