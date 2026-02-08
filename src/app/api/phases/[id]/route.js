/**
 * Phase Detail API Route
 * GET: Get single phase
 * PATCH: Update phase (PM, OWNER only)
 * DELETE: Soft delete phase (OWNER only)
 * 
 * GET /api/phases/[id]
 * PATCH /api/phases/[id]
 * DELETE /api/phases/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validatePhase, calculatePhaseFinancialSummary, PHASE_STATUSES, PHASE_TYPES } from '@/lib/schemas/phase-schema';
import { validatePhaseDependencies, calculatePhaseStartDate, canPhaseStart } from '@/lib/phase-dependency-helpers';

/**
 * GET /api/phases/[id]
 * Returns a single phase by ID with financial summary
 * Auth: All authenticated users
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const { searchParams } = new URL(request.url);
    const includeFinancials = searchParams.get('includeFinancials') !== 'false'; // Default true

    const db = await getDatabase();
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    // Calculate financial summary
    let phaseWithFinancials = phase;
    if (includeFinancials) {
      const financialSummary = calculatePhaseFinancialSummary(phase);
      phaseWithFinancials = {
        ...phase,
        financialSummary
      };
    }

    return successResponse(phaseWithFinancials, 'Phase retrieved successfully');
  } catch (error) {
    console.error('Get phase error:', error);
    return errorResponse('Failed to retrieve phase', 500);
  }
}

/**
 * PATCH /api/phases/[id]
 * Updates phase details, status, budget, or dates
 * Auth: PM, OWNER only
 */
export async function PATCH(request, { params }) {
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

    const hasEditPermission = await hasPermission(user.id, 'edit_phase');
    if (!hasEditPermission) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can edit phases.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const body = await request.json();
    const {
      phaseName,
      phaseCode,
      phaseType,
      sequence,
      description,
      status,
      budgetAllocation,
      startDate,
      plannedEndDate,
      actualEndDate,
      completionPercentage,
      applicableFloors,
      applicableCategories,
      dependsOn // Phase 2: Dependencies
    } = body;

    const db = await getDatabase();

    // Get existing phase
    const existingPhase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!existingPhase) {
      return errorResponse('Phase not found', 404);
    }

    // Build update object
    const updateData = {
      updatedAt: new Date()
    };

    if (phaseName !== undefined) {
      if (!phaseName || phaseName.trim().length === 0) {
        return errorResponse('Phase name cannot be empty', 400);
      }
      updateData.phaseName = phaseName.trim();
    }

    if (phaseCode !== undefined) {
      // Check if phase code already exists for this project (if changed)
      if (phaseCode !== existingPhase.phaseCode) {
        const existingByCode = await db.collection('phases').findOne({
          projectId: existingPhase.projectId,
          phaseCode: phaseCode,
          _id: { $ne: new ObjectId(id) },
          deletedAt: null
        });

        if (existingByCode) {
          return errorResponse(`Phase with code ${phaseCode} already exists for this project`, 400);
        }
      }
      updateData.phaseCode = phaseCode;
    }

    if (phaseType !== undefined) {
      if (!Object.values(PHASE_TYPES).includes(phaseType)) {
        return errorResponse(`Invalid phase type. Must be one of: ${Object.values(PHASE_TYPES).join(', ')}`, 400);
      }
      updateData.phaseType = phaseType;
    }

    if (sequence !== undefined) {
      if (typeof sequence !== 'number' || sequence < 0) {
        return errorResponse('Sequence must be a non-negative number', 400);
      }
      
      // Check if sequence already exists for this project (if changed)
      if (sequence !== existingPhase.sequence) {
        const existingBySequence = await db.collection('phases').findOne({
          projectId: existingPhase.projectId,
          sequence: sequence,
          _id: { $ne: new ObjectId(id) },
          deletedAt: null
        });

        if (existingBySequence) {
          return errorResponse(`Phase with sequence ${sequence} already exists for this project`, 400);
        }
      }
      updateData.sequence = sequence;
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || '';
    }

    if (status !== undefined) {
      if (!Object.values(PHASE_STATUSES).includes(status)) {
        return errorResponse(`Invalid status. Must be one of: ${Object.values(PHASE_STATUSES).join(', ')}`, 400);
      }
      
      // Phase 2: Validate phase can start if changing to in_progress
      if (status === PHASE_STATUSES.IN_PROGRESS && existingPhase.status !== PHASE_STATUSES.IN_PROGRESS) {
        const canStart = await canPhaseStart(id);
        if (!canStart.canStart) {
          return errorResponse(`Cannot start phase: ${canStart.reason}`, 400);
        }
      }
      
      updateData.status = status;
      
      // Auto-update dates based on status
      if (status === PHASE_STATUSES.IN_PROGRESS && !existingPhase.startDate) {
        updateData.startDate = new Date();
      }
      if (status === PHASE_STATUSES.COMPLETED && !existingPhase.actualEndDate) {
        updateData.actualEndDate = new Date();
      }
    }

    if (budgetAllocation !== undefined) {
      updateData.budgetAllocation = {
        ...existingPhase.budgetAllocation,
        ...budgetAllocation
      };
      
      // Recalculate remaining budget
      const currentActual = existingPhase.actualSpending?.total || 0;
      const currentCommitted = existingPhase.financialStates?.committed || 0;
      const newTotal = updateData.budgetAllocation.total || 0;
      updateData.financialStates = {
        ...existingPhase.financialStates,
        remaining: Math.max(0, newTotal - currentActual - currentCommitted)
      };
    }

    if (startDate !== undefined) {
      updateData.startDate = startDate ? new Date(startDate) : null;
    }

    if (plannedEndDate !== undefined) {
      updateData.plannedEndDate = plannedEndDate ? new Date(plannedEndDate) : null;
    }

    if (actualEndDate !== undefined) {
      updateData.actualEndDate = actualEndDate ? new Date(actualEndDate) : null;
    }

    if (completionPercentage !== undefined) {
      if (completionPercentage < 0 || completionPercentage > 100) {
        return errorResponse('Completion percentage must be between 0 and 100', 400);
      }
      updateData.completionPercentage = completionPercentage;
    }

    if (applicableFloors !== undefined) {
      updateData.applicableFloors = applicableFloors === 'all' ? 'all' : (Array.isArray(applicableFloors) ? applicableFloors : []);
    }

    if (applicableCategories !== undefined) {
      updateData.applicableCategories = Array.isArray(applicableCategories)
        ? applicableCategories.map(catId => ObjectId.isValid(catId) ? new ObjectId(catId) : catId)
        : [];
    }

    // Phase 2: Handle dependencies update
    if (dependsOn !== undefined) {
      if (!Array.isArray(dependsOn)) {
        return errorResponse('dependsOn must be an array', 400);
      }

      // Validate dependencies
      if (dependsOn.length > 0) {
        const depValidation = await validatePhaseDependencies(
          id,
          dependsOn,
          existingPhase.projectId.toString()
        );
        
        if (!depValidation.isValid) {
          return errorResponse(`Dependency validation failed: ${depValidation.errors.join(', ')}`, 400);
        }
      }

      // Convert to ObjectIds and update
      updateData.dependsOn = dependsOn
        .filter(depId => ObjectId.isValid(depId))
        .map(depId => new ObjectId(depId));
      
      // Recalculate canStartAfter date
      const canStartAfter = updateData.dependsOn.length > 0
        ? await calculatePhaseStartDate(id)
        : null;
      updateData.canStartAfter = canStartAfter;
    }

    // Update phase
    const result = await db.collection('phases').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return errorResponse('Phase not found', 404);
    }

    const updatedPhase = result;

    // Phase 2: If status changed to completed or actualEndDate was set, recalculate canStartAfter for dependent phases
    if ((status === PHASE_STATUSES.COMPLETED || actualEndDate !== undefined) && updatedPhase) {
      try {
        const { getDependentPhases, calculatePhaseStartDate } = await import('@/lib/phase-dependency-helpers');
        const dependents = await getDependentPhases(id);
        
        // Recalculate canStartAfter for all dependent phases
        for (const dependent of dependents) {
          if (dependent.phaseId && ObjectId.isValid(dependent.phaseId)) {
            const newCanStartAfter = await calculatePhaseStartDate(dependent.phaseId);
            await db.collection('phases').updateOne(
              { _id: new ObjectId(dependent.phaseId) },
              { $set: { canStartAfter: newCanStartAfter, updatedAt: new Date() } }
            );
          }
        }
      } catch (depError) {
        // Log error but don't fail the update
        console.error('Error updating dependent phases canStartAfter:', depError);
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'PHASE',
      entityId: id,
      projectId: existingPhase.projectId.toString(),
      changes: updateData,
    });

    // Calculate financial summary for response
    const financialSummary = calculatePhaseFinancialSummary(updatedPhase);

    return successResponse({
      ...updatedPhase,
      financialSummary
    }, 'Phase updated successfully');
  } catch (error) {
    console.error('Update phase error:', error);
    return errorResponse('Failed to update phase', 500);
  }
}

/**
 * DELETE /api/phases/[id]
 * Soft deletes a phase
 * Auth: OWNER only
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can delete
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    if (userRole !== 'owner') {
      return errorResponse('Insufficient permissions. Only OWNER can delete phases.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const db = await getDatabase();

    // Get existing phase
    const existingPhase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!existingPhase) {
      return errorResponse('Phase not found', 404);
    }

    // Check if phase has associated materials or expenses
    const materialsCount = await db.collection('materials').countDocuments({
      phaseId: new ObjectId(id),
      deletedAt: null
    });

    const expensesCount = await db.collection('expenses').countDocuments({
      phaseId: new ObjectId(id),
      deletedAt: null
    });

    if (materialsCount > 0 || expensesCount > 0) {
      return errorResponse(
        `Cannot delete phase. It has ${materialsCount} material(s) and ${expensesCount} expense(s) associated with it.`,
        400
      );
    }

    // Soft delete
    const result = await db.collection('phases').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          deletedAt: new Date(),
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return errorResponse('Phase not found', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'PHASE',
      entityId: id,
      projectId: existingPhase.projectId.toString(),
      changes: { deleted: true },
    });

    return successResponse(result, 'Phase deleted successfully');
  } catch (error) {
    console.error('Delete phase error:', error);
    return errorResponse('Failed to delete phase', 500);
  }
}



