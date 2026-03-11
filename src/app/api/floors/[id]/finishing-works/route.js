/**
 * Floor Finishing Works API Route
 *
 * GET  /api/floors/[id]/finishing-works
 *  - Returns all finishing-phase work items for a floor, plus a financial summary.
 *
 * NOTE:
 *  - This route is read-only and relies on the existing work_items + subcontractors infra.
 *  - Creation and editing of work items still goes through /api/work-items for now.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { successResponse, errorResponse } from '@/lib/api-response';
import { ObjectId } from 'mongodb';
import { PHASE_TYPES } from '@/lib/schemas/phase-schema';
import { FINISHING_EXECUTION_MODELS } from '@/lib/constants/finishing-work-constants';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * Infer execution model for a work item when not explicitly set.
 * - If subcontractorId is present -> contract_based
 * - Otherwise -> direct_labour
 */
function inferExecutionModel(workItem) {
  if (workItem.executionModel && FINISHING_EXECUTION_MODELS.includes(workItem.executionModel)) {
    return workItem.executionModel;
  }
  if (workItem.subcontractorId) {
    return 'contract_based';
  }
  return 'direct_labour';
}

/**
 * GET /api/floors/[id]/finishing-works
 * Returns finishing work items and summary for a specific floor.
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid floor ID', 400);
    }

    const db = await getDatabase();

    // Load floor
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    const projectId = floor.projectId;
    if (!projectId) {
      return errorResponse('Floor has no associated project', 400);
    }

    // Get all finishing phases for this project
    const finishingPhases = await db
      .collection('phases')
      .find({
        projectId: new ObjectId(projectId),
        phaseType: PHASE_TYPES.FINISHING,
        deletedAt: null,
      })
      .toArray();

    if (finishingPhases.length === 0) {
      return successResponse(
        {
          floorId: id,
          projectId: projectId.toString(),
          items: [],
          summary: {
            totalEstimatedCost: 0,
            totalActualCost: 0,
            directLabour: {
              estimatedCost: 0,
              actualCost: 0,
            },
            contractBased: {
              estimatedCost: 0,
              actualCost: 0,
            },
            byCategory: {},
          },
          message: 'No finishing phases found for this project',
        },
        'Floor finishing works retrieved successfully',
      );
    }

    const finishingPhaseIds = finishingPhases.map((p) => p._id);

    // Fetch work items that:
    //  - belong to this project
    //  - belong to any finishing phase
    //  - are linked to this floor
    const workItems = await db
      .collection('work_items')
      .find({
        projectId: new ObjectId(projectId),
        phaseId: { $in: finishingPhaseIds },
        floorId: new ObjectId(id),
        deletedAt: null,
      })
      .sort({ priority: 1, createdAt: 1 })
      .toArray();

    if (workItems.length === 0) {
      return successResponse(
        {
          floorId: id,
          projectId: projectId.toString(),
          items: [],
          summary: {
            totalEstimatedCost: 0,
            totalActualCost: 0,
            directLabour: {
              estimatedCost: 0,
              actualCost: 0,
            },
            contractBased: {
              estimatedCost: 0,
              actualCost: 0,
            },
            byCategory: {},
          },
          message: 'No finishing work items found for this floor',
        },
        'Floor finishing works retrieved successfully',
      );
    }

    // Load subcontractors for any linked subcontractorIds
    const subcontractorIds = [
      ...new Set(
        workItems
          .map((item) => item.subcontractorId?.toString())
          .filter((v) => v && ObjectId.isValid(v)),
      ),
    ];

    let subcontractorMap = {};
    if (subcontractorIds.length > 0) {
      const subcontractors = await db
        .collection('subcontractors')
        .find({
          _id: { $in: subcontractorIds.map((sid) => new ObjectId(sid)) },
          deletedAt: null,
        })
        .toArray();

      // Import calculateTotalPaid for payment tracking
      const { calculateTotalPaid } = await import('@/lib/constants/subcontractor-constants');
      
      subcontractorMap = subcontractors.reduce((acc, sub) => {
        const totalPaid = sub.paymentSchedule && Array.isArray(sub.paymentSchedule)
          ? calculateTotalPaid(sub.paymentSchedule)
          : 0;
        
        acc[sub._id.toString()] = {
          _id: sub._id,
          subcontractorName: sub.subcontractorName,
          subcontractorType: sub.subcontractorType,
          status: sub.status,
          contractValue: sub.contractValue,
          contractType: sub.contractType,
          totalPaid: totalPaid,
          paymentProgress: sub.contractValue > 0 ? (totalPaid / sub.contractValue) * 100 : 0,
        };
        return acc;
      }, {});
    }

    // Attach phase and subcontractor metadata + compute summary
    const phaseMap = finishingPhases.reduce((acc, phase) => {
      acc[phase._id.toString()] = {
        _id: phase._id,
        phaseName: phase.phaseName,
        phaseCode: phase.phaseCode,
      };
      return acc;
    }, {});

    const summary = {
      totalEstimatedCost: 0,
      totalActualCost: 0,
      directLabour: {
        estimatedCost: 0,
        actualCost: 0,
      },
      contractBased: {
        estimatedCost: 0,
        actualCost: 0,
      },
      byCategory: {},
    };

    const items = workItems.map((item) => {
      const executionModel = inferExecutionModel(item);
      const phaseInfo = phaseMap[item.phaseId?.toString()] || null;
      const subcontractorInfo = item.subcontractorId
        ? subcontractorMap[item.subcontractorId.toString()] || null
        : null;

      const estimated = Number(item.estimatedCost || 0);
      const actual = Number(item.actualCost || 0);

      summary.totalEstimatedCost += estimated;
      summary.totalActualCost += actual;

      if (executionModel === 'contract_based') {
        summary.contractBased.estimatedCost += estimated;
        summary.contractBased.actualCost += actual;
      } else {
        summary.directLabour.estimatedCost += estimated;
        summary.directLabour.actualCost += actual;
      }

      const categoryKey = (item.category || 'other').toLowerCase();
      if (!summary.byCategory[categoryKey]) {
        summary.byCategory[categoryKey] = {
          estimatedCost: 0,
          actualCost: 0,
          items: 0,
        };
      }
      summary.byCategory[categoryKey].estimatedCost += estimated;
      summary.byCategory[categoryKey].actualCost += actual;
      summary.byCategory[categoryKey].items += 1;

      return {
        ...item,
        executionModel,
        phase: phaseInfo,
        subcontractor: subcontractorInfo,
      };
    });

    return successResponse(
      {
        floorId: id,
        projectId: projectId.toString(),
        items,
        summary,
      },
      'Floor finishing works retrieved successfully',
    );
  } catch (error) {
    console.error('Get floor finishing works error:', error);
    return errorResponse('Failed to retrieve floor finishing works', 500);
  }
}

