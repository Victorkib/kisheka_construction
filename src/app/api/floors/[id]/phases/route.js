/**
 * Floor Phase Breakdown API
 * Returns comprehensive phase breakdown for a floor including materials, labour, equipment, etc.
 * 
 * Route: /api/floors/[id]/phases
 * Method: GET
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { calculateFloorActualSpending, calculateFloorCommittedCosts } from '@/lib/floor-financial-helpers';
import { MATERIAL_APPROVED_STATUSES } from '@/lib/status-constants';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/floors/[id]/phases
 * Returns comprehensive phase breakdown for a floor
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

    if (phases.length === 0) {
      return successResponse({
        floorId: id,
        phases: [],
        message: 'No phases found for this project'
      }, 'Floor phase breakdown retrieved successfully');
    }

    // Get floor budget allocation
    const floorBudgetAllocation = floor.budgetAllocation || { total: floor.totalBudget || 0, byPhase: {} };
    const byPhase = floorBudgetAllocation.byPhase || {};

    // Get actual spending and committed costs with phase breakdown
    const actualSpending = await calculateFloorActualSpending(id, true);
    const committedCosts = await calculateFloorCommittedCosts(id, true);

    // Get phase-specific items
    const phaseBreakdown = await Promise.all(
      phases.map(async (phase) => {
        const phaseCode = phase.phaseCode;
        const phaseId = phase._id.toString();
        const phaseBudget = byPhase[phaseCode] || { total: 0, materials: 0, labour: 0, equipment: 0, subcontractors: 0 };
        const phaseActual = actualSpending.byPhase?.[phaseCode] || { total: 0, materials: 0, labour: 0, equipment: 0, subcontractors: 0 };
        const phaseCommitted = committedCosts.byPhase?.[phaseCode] || { total: 0, materialRequests: 0, purchaseOrders: 0 };
        const phaseRemaining = Math.max(0, phaseBudget.total - phaseActual.total - phaseCommitted.total);
        const phaseUtilization = phaseBudget.total > 0 ? (phaseActual.total / phaseBudget.total) * 100 : 0;

        // Get materials for this phase on this floor
        const materials = await db.collection('materials').find({
          floor: new ObjectId(id),
          phaseId: new ObjectId(phaseId),
          deletedAt: null,
          status: { $in: MATERIAL_APPROVED_STATUSES }
        }).sort({ createdAt: -1 }).limit(50).toArray();

        // Get material requests for this phase on this floor
        const materialRequests = await db.collection('material_requests').find({
          floorId: new ObjectId(id),
          phaseId: new ObjectId(phaseId),
          deletedAt: null
        }).sort({ createdAt: -1 }).limit(50).toArray();

        // Get labour entries for this phase on this floor
        const labourEntries = await db.collection('labour_entries').find({
          floorId: new ObjectId(id),
          phaseId: new ObjectId(phaseId),
          deletedAt: null,
          isIndirectLabour: { $ne: true }
        }).sort({ entryDate: -1 }).limit(50).toArray();

        // Get work items for this phase on this floor
        const workItems = await db.collection('work_items').find({
          floorId: new ObjectId(id),
          phaseId: new ObjectId(phaseId),
          deletedAt: null
        }).sort({ createdAt: -1 }).limit(50).toArray();

        // Get equipment for this phase (linked via work items or directly)
        const workItemIds = workItems.map(wi => wi._id);
        const equipment = await db.collection('equipment').find({
          phaseId: new ObjectId(phaseId),
          deletedAt: null,
          $or: [
            { workItemId: { $in: workItemIds } },
            { floorId: new ObjectId(id) } // If equipment has direct floor linkage
          ]
        }).sort({ createdAt: -1 }).limit(50).toArray();

        // Calculate phase status based on progress
        let phaseStatus = 'NOT_STARTED';
        if (phaseActual.total > 0 || phaseCommitted.total > 0) {
          phaseStatus = 'IN_PROGRESS';
        }
        // Check if phase is completed (all work items completed or budget fully utilized)
        const allWorkItemsCompleted = workItems.length > 0 && workItems.every(wi => 
          wi.status === 'COMPLETED' || wi.completionPercentage === 100
        );
        if (allWorkItemsCompleted && phaseUtilization >= 95) {
          phaseStatus = 'COMPLETED';
        }

        // Calculate progress percentage
        let progress = 0;
        if (workItems.length > 0) {
          const totalProgress = workItems.reduce((sum, wi) => sum + (wi.completionPercentage || 0), 0);
          progress = totalProgress / workItems.length;
        } else if (phaseBudget.total > 0) {
          // Use budget utilization as progress indicator if no work items
          progress = Math.min(100, phaseUtilization);
        }

        return {
          phaseId: phaseId,
          phaseCode: phaseCode,
          phaseName: phase.phaseName || phase.name || phaseCode,
          budget: {
            total: phaseBudget.total || 0,
            materials: phaseBudget.materials || 0,
            labour: phaseBudget.labour || 0,
            equipment: phaseBudget.equipment || 0,
            subcontractors: phaseBudget.subcontractors || 0
          },
          actual: {
            total: phaseActual.total || 0,
            materials: phaseActual.materials || 0,
            labour: phaseActual.labour || 0,
            equipment: phaseActual.equipment || 0,
            subcontractors: phaseActual.subcontractors || 0
          },
          committed: {
            total: phaseCommitted.total || 0,
            materialRequests: phaseCommitted.materialRequests || 0,
            purchaseOrders: phaseCommitted.purchaseOrders || 0
          },
          remaining: phaseRemaining,
          utilization: phaseUtilization,
          variance: phaseActual.total - phaseBudget.total,
          status: phaseStatus,
          progress: Math.round(progress),
          items: {
            materials: materials.map(m => ({
              _id: m._id.toString(),
              name: m.name || m.materialName,
              quantityPurchased: m.quantityPurchased || 0,
              unit: m.unit,
              totalCost: m.totalCost || 0,
              createdAt: m.createdAt
            })),
            materialRequests: materialRequests.map(mr => ({
              _id: mr._id.toString(),
              requestNumber: mr.requestNumber,
              materialName: mr.materialName,
              quantityNeeded: mr.quantityNeeded || 0,
              unit: mr.unit,
              estimatedCost: mr.estimatedCost || 0,
              status: mr.status,
              createdAt: mr.createdAt
            })),
            labour: labourEntries.map(le => ({
              _id: le._id.toString(),
              workerName: le.workerName,
              skillType: le.skillType,
              totalHours: le.totalHours || 0,
              totalCost: le.totalCost || 0,
              entryDate: le.entryDate,
              status: le.status
            })),
            equipment: equipment.map(eq => ({
              _id: eq._id.toString(),
              equipmentName: eq.equipmentName || eq.name,
              equipmentType: eq.equipmentType,
              totalCost: eq.totalCost || 0,
              startDate: eq.startDate,
              endDate: eq.endDate
            })),
            workItems: workItems.map(wi => ({
              _id: wi._id.toString(),
              name: wi.name,
              description: wi.description,
              estimatedCost: wi.estimatedCost || 0,
              actualCost: wi.actualCost || 0,
              status: wi.status,
              completionPercentage: wi.completionPercentage || 0,
              createdAt: wi.createdAt
            }))
          },
          counts: {
            materials: materials.length,
            materialRequests: materialRequests.length,
            labour: labourEntries.length,
            equipment: equipment.length,
            workItems: workItems.length
          }
        };
      })
    );

    return successResponse({
      floorId: id,
      floorNumber: floor.floorNumber,
      floorName: floor.name || `Floor ${floor.floorNumber}`,
      projectId: projectId.toString(),
      phases: phaseBreakdown,
      summary: {
        totalPhases: phases.length,
        phasesWithBudget: phaseBreakdown.filter(p => p.budget.total > 0).length,
        phasesInProgress: phaseBreakdown.filter(p => p.status === 'IN_PROGRESS').length,
        phasesCompleted: phaseBreakdown.filter(p => p.status === 'COMPLETED').length,
        totalBudget: floorBudgetAllocation.total || 0,
        totalActual: actualSpending.total || 0,
        totalCommitted: committedCosts.total || 0,
        totalRemaining: Math.max(0, (floorBudgetAllocation.total || 0) - actualSpending.total - committedCosts.total)
      }
    }, 'Floor phase breakdown retrieved successfully');
  } catch (error) {
    console.error('Get floor phase breakdown error:', error);
    return errorResponse('Failed to get floor phase breakdown', 500);
  }
}
