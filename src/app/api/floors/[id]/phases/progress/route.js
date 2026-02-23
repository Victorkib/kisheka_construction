/**
 * Floor Phase Progress Tracking API
 * Tracks and updates phase completion status per floor
 * 
 * Route: /api/floors/[id]/phases/progress
 * Methods: GET, POST, PATCH
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { calculateFloorActualSpending, calculateFloorCommittedCosts } from '@/lib/floor-financial-helpers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/floors/[id]/phases/progress
 * Returns phase progress status for all phases on a floor
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid floor ID', 400);
    }

    const db = await getDatabase();

    // Get floor
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    const projectId = floor.projectId;
    if (!projectId) {
      return errorResponse('Floor has no associated project', 400);
    }

    // Get all phases for the project
    const phases = await db.collection('phases').find({
      projectId: new ObjectId(projectId),
      deletedAt: null
    }).sort({ sequence: 1 }).toArray();

    // Get floor budget allocation
    const floorBudgetAllocation = floor.budgetAllocation || { total: floor.totalBudget || 0, byPhase: {} };
    const byPhase = floorBudgetAllocation.byPhase || {};

    // Get actual spending and committed costs with phase breakdown
    const actualSpending = await calculateFloorActualSpending(id, true);
    const committedCosts = await calculateFloorCommittedCosts(id, true);

    // Get phase progress data (stored in floor document)
    const phaseProgress = floor.phaseProgress || {};

    // Calculate phase progress for each phase
    const phaseProgressData = await Promise.all(
      phases.map(async (phase) => {
        const phaseCode = phase.phaseCode;
        const phaseId = phase._id.toString();
        const phaseBudget = byPhase[phaseCode] || { total: 0 };
        const phaseActual = actualSpending.byPhase?.[phaseCode] || { total: 0 };
        const phaseCommitted = committedCosts.byPhase?.[phaseCode] || { total: 0 };
        
        // Get stored progress data
        const storedProgress = phaseProgress[phaseId] || phaseProgress[phaseCode] || {};
        
        // Get work items for this phase on this floor
        const workItems = await db.collection('work_items').find({
          floorId: new ObjectId(id),
          phaseId: new ObjectId(phaseId),
          deletedAt: null
        }).toArray();

        // Calculate progress percentage
        let progress = 0;
        if (workItems.length > 0) {
          const totalProgress = workItems.reduce((sum, wi) => sum + (wi.completionPercentage || 0), 0);
          progress = totalProgress / workItems.length;
        } else if (phaseBudget.total > 0) {
          // Use budget utilization as progress indicator if no work items
          const utilization = (phaseActual.total / phaseBudget.total) * 100;
          progress = Math.min(100, utilization);
        }

        // Determine phase status
        let status = storedProgress.status || 'NOT_STARTED';
        if (phaseActual.total > 0 || phaseCommitted.total > 0) {
          status = 'IN_PROGRESS';
        }
        if (storedProgress.status === 'COMPLETED') {
          status = 'COMPLETED';
        } else if (workItems.length > 0 && workItems.every(wi => 
          wi.status === 'COMPLETED' || wi.completionPercentage === 100
        ) && progress >= 95) {
          status = 'COMPLETED';
        }

        return {
          phaseId: phaseId,
          phaseCode: phaseCode,
          phaseName: phase.phaseName || phase.name || phaseCode,
          status: status,
          progress: Math.round(progress),
          budget: phaseBudget.total || 0,
          actual: phaseActual.total || 0,
          committed: phaseCommitted.total || 0,
          workItemsCount: workItems.length,
          completedWorkItems: workItems.filter(wi => wi.status === 'COMPLETED' || wi.completionPercentage === 100).length,
          startedDate: storedProgress.startedDate || null,
          completedDate: storedProgress.completedDate || null,
          notes: storedProgress.notes || null,
          lastUpdated: storedProgress.lastUpdated || null
        };
      })
    );

    return successResponse({
      floorId: id,
      floorNumber: floor.floorNumber,
      floorName: floor.name || `Floor ${floor.floorNumber}`,
      phases: phaseProgressData,
      summary: {
        totalPhases: phases.length,
        notStarted: phaseProgressData.filter(p => p.status === 'NOT_STARTED').length,
        inProgress: phaseProgressData.filter(p => p.status === 'IN_PROGRESS').length,
        completed: phaseProgressData.filter(p => p.status === 'COMPLETED').length
      }
    }, 'Phase progress retrieved successfully');
  } catch (error) {
    console.error('Get phase progress error:', error);
    return errorResponse('Failed to get phase progress', 500);
  }
}

/**
 * POST /api/floors/[id]/phases/progress
 * Update phase progress status (create or update)
 * Body: { phaseId, status, progress, notes, completedDate }
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Check permission
    const hasUpdatePermission = await hasPermission(user.id, 'update_floor');
    const userRole = userProfile.role?.toLowerCase();
    const allowedRoles = ['owner', 'pm', 'project_manager'];
    if (!hasUpdatePermission && !allowedRoles.includes(userRole)) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can update phase progress.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid floor ID', 400);
    }

    const body = await request.json();
    const { phaseId, status, progress, notes, completedDate } = body;

    if (!phaseId || !ObjectId.isValid(phaseId)) {
      return errorResponse('Valid phase ID is required', 400);
    }

    if (!status || !['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
      return errorResponse('Valid status is required (NOT_STARTED, IN_PROGRESS, COMPLETED)', 400);
    }

    const db = await getDatabase();

    // Get floor
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    // Verify phase exists and belongs to same project
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(phaseId),
      projectId: floor.projectId,
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found or does not belong to this floor\'s project', 404);
    }

    // Get or initialize phase progress
    const phaseProgress = floor.phaseProgress || {};
    const phaseIdStr = phaseId.toString();
    const phaseCode = phase.phaseCode;

    // Update progress data
    const now = new Date();
    const existingProgress = phaseProgress[phaseIdStr] || phaseProgress[phaseCode] || {};

    const updatedProgress = {
      ...existingProgress,
      phaseId: phaseIdStr,
      phaseCode: phaseCode,
      status: status,
      progress: progress !== undefined ? Math.max(0, Math.min(100, progress)) : existingProgress.progress || 0,
      notes: notes !== undefined ? notes : existingProgress.notes,
      lastUpdated: now,
      updatedBy: userProfile._id.toString()
    };

    // Set started date if transitioning to IN_PROGRESS
    if (status === 'IN_PROGRESS' && !existingProgress.startedDate) {
      updatedProgress.startedDate = now;
    }

    // Set completed date if transitioning to COMPLETED
    if (status === 'COMPLETED') {
      updatedProgress.completedDate = completedDate ? new Date(completedDate) : now;
    } else {
      // Clear completed date if not completed
      updatedProgress.completedDate = null;
    }

    // Update floor document
    phaseProgress[phaseIdStr] = updatedProgress;
    // Also store by phase code for backward compatibility
    phaseProgress[phaseCode] = updatedProgress;

    await db.collection('floors').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          phaseProgress: phaseProgress,
          updatedAt: now
        }
      }
    );

    return successResponse({
      floorId: id,
      phaseId: phaseIdStr,
      phaseCode: phaseCode,
      progress: updatedProgress
    }, 'Phase progress updated successfully');
  } catch (error) {
    console.error('Update phase progress error:', error);
    return errorResponse('Failed to update phase progress', 500);
  }
}

/**
 * PATCH /api/floors/[id]/phases/progress
 * Partial update to phase progress (e.g., just progress percentage)
 * Body: { phaseId, status?, progress?, notes? }
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Check permission
    const hasUpdatePermission = await hasPermission(user.id, 'update_floor');
    const userRole = userProfile.role?.toLowerCase();
    const allowedRoles = ['owner', 'pm', 'project_manager'];
    if (!hasUpdatePermission && !allowedRoles.includes(userRole)) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can update phase progress.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid floor ID', 400);
    }

    const body = await request.json();
    const { phaseId, status, progress, notes } = body;

    if (!phaseId || !ObjectId.isValid(phaseId)) {
      return errorResponse('Valid phase ID is required', 400);
    }

    const db = await getDatabase();

    // Get floor
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    // Verify phase exists
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(phaseId),
      projectId: floor.projectId,
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    // Get or initialize phase progress
    const phaseProgress = floor.phaseProgress || {};
    const phaseIdStr = phaseId.toString();
    const phaseCode = phase.phaseCode;
    const existingProgress = phaseProgress[phaseIdStr] || phaseProgress[phaseCode] || {};

    // Partial update
    const now = new Date();
    const updatedProgress = {
      ...existingProgress,
      phaseId: phaseIdStr,
      phaseCode: phaseCode,
      lastUpdated: now,
      updatedBy: userProfile._id.toString()
    };

    if (status !== undefined) {
      if (!['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
        return errorResponse('Invalid status', 400);
      }
      updatedProgress.status = status;
      
      // Set started date if transitioning to IN_PROGRESS
      if (status === 'IN_PROGRESS' && !existingProgress.startedDate) {
        updatedProgress.startedDate = now;
      }
      
      // Set completed date if transitioning to COMPLETED
      if (status === 'COMPLETED' && !existingProgress.completedDate) {
        updatedProgress.completedDate = now;
      } else if (status !== 'COMPLETED') {
        updatedProgress.completedDate = null;
      }
    }

    if (progress !== undefined) {
      updatedProgress.progress = Math.max(0, Math.min(100, progress));
    }

    if (notes !== undefined) {
      updatedProgress.notes = notes;
    }

    // Update floor document
    phaseProgress[phaseIdStr] = updatedProgress;
    phaseProgress[phaseCode] = updatedProgress;

    await db.collection('floors').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          phaseProgress: phaseProgress,
          updatedAt: now
        }
      }
    );

    return successResponse({
      floorId: id,
      phaseId: phaseIdStr,
      phaseCode: phaseCode,
      progress: updatedProgress
    }, 'Phase progress updated successfully');
  } catch (error) {
    console.error('Patch phase progress error:', error);
    return errorResponse('Failed to update phase progress', 500);
  }
}
