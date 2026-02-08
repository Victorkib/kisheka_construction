/**
 * Phase Cloning API Route
 * Clones a phase to another project or within the same project
 * 
 * POST /api/phases/[id]/clone
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/phases/[id]/clone
 * Clone a phase
 * Auth: PM, OWNER only
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const canClone = await hasPermission(user.id, 'edit_phase');
    if (!canClone) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can clone phases.', 403);
    }

    const { id } = await params;
    const body = await request.json();
    const { projectId, phaseName } = body;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);

    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Get original phase
    const originalPhase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!originalPhase) {
      return errorResponse('Phase not found', 404);
    }

    // Verify target project exists
    const targetProject = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      deletedAt: null
    });

    if (!targetProject) {
      return errorResponse('Target project not found', 404);
    }

    // Generate new phase code
    const existingPhases = await db.collection('phases').countDocuments({
      projectId: new ObjectId(projectId),
      deletedAt: null
    });
    const newPhaseCode = `PHASE-${String(existingPhases + 1).padStart(2, '0')}`;

    // Create cloned phase
    const clonedPhase = {
      projectId: new ObjectId(projectId),
      phaseName: phaseName || `${originalPhase.phaseName} (Copy)`,
      phaseCode: newPhaseCode,
      phaseType: originalPhase.phaseType,
      sequence: originalPhase.sequence,
      description: originalPhase.description || '',
      budgetAllocation: { ...originalPhase.budgetAllocation },
      actualSpending: {
        materials: 0,
        labour: 0,
        equipment: 0,
        subcontractors: 0,
        total: 0
      },
      financialStates: {
        estimated: 0,
        committed: 0,
        actual: 0,
        remaining: originalPhase.budgetAllocation?.total || 0
      },
      status: 'not_started',
      completionPercentage: 0,
      startDate: null,
      plannedEndDate: null,
      actualEndDate: null,
      applicableFloors: originalPhase.applicableFloors || 'all',
      applicableCategories: originalPhase.applicableCategories || [],
      dependsOn: [], // Reset dependencies
      canStartAfter: null,
      milestones: (originalPhase.milestones || []).map(m => ({
        ...m,
        milestoneId: new ObjectId(),
        status: 'pending',
        actualDate: null,
        signOffBy: null,
        signOffDate: null,
        signOffNotes: '',
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      qualityCheckpoints: (originalPhase.qualityCheckpoints || []).map(q => ({
        ...q,
        checkpointId: new ObjectId(),
        status: 'pending',
        inspectedBy: null,
        inspectedAt: null,
        notes: '',
        photos: [],
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    };

    const phaseResult = await db.collection('phases').insertOne(clonedPhase);
    const clonedPhaseId = phaseResult.insertedId;

    // Clone work items if they exist
    const workItems = await db.collection('work_items').find({
      phaseId: new ObjectId(id),
      deletedAt: null
    }).toArray();

    if (workItems.length > 0) {
      // Create a map of old work item IDs to new IDs for dependency resolution
      const workItemIdMap = new Map();
      const clonedWorkItems = workItems.map(item => {
        const newId = new ObjectId();
        workItemIdMap.set(item._id.toString(), newId);
        
        return {
          ...item,
          _id: newId,
          phaseId: clonedPhaseId,
          projectId: new ObjectId(projectId),
          status: 'not_started',
          actualHours: 0,
          actualCost: 0,
          startDate: null,
          actualEndDate: null,
          dependencies: [], // Reset dependencies initially
          createdBy: new ObjectId(userProfile._id),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null
        };
      });

      // Update dependencies to use new work item IDs
      clonedWorkItems.forEach(item => {
        if (item.dependencies && Array.isArray(item.dependencies)) {
          item.dependencies = item.dependencies
            .map(depId => {
              const oldIdStr = depId.toString();
              return workItemIdMap.get(oldIdStr);
            })
            .filter(id => id !== undefined);
        }
      });

      await db.collection('work_items').insertMany(clonedWorkItems);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CLONED',
      entityType: 'PHASE',
      entityId: clonedPhaseId.toString(),
      projectId: projectId,
      changes: { 
        clonedFrom: originalPhase._id.toString(),
        originalPhaseName: originalPhase.phaseName,
        newPhaseName: clonedPhase.phaseName
      }
    });

    return successResponse({
      phase: {
        _id: clonedPhaseId,
        phaseName: clonedPhase.phaseName,
        phaseCode: clonedPhase.phaseCode,
        projectId: projectId
      },
      workItemsCloned: workItems.length
    }, 'Phase cloned successfully', 201);
  } catch (error) {
    console.error('Clone phase error:', error);
    return errorResponse(error.message || 'Failed to clone phase', 500);
  }
}


