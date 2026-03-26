/**
 * Phase Finishing Works API Route
 *
 * GET /api/phases/[id]/finishing-works
 *  - Returns all finishing-phase work items for a phase, grouped by floor,
 *    plus a financial summary.
 *
 * NOTE:
 *  - Read-only aggregation on top of existing work_items + floors + subcontractors.
 *  - Creation and editing of work items still goes through /api/work-items.
 */

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
 * GET /api/phases/[id]/finishing-works
 * Returns finishing work items and summary for a specific finishing phase.
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
      return errorResponse('Invalid phase ID', 400);
    }

    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const db = await getDatabase();

    // Load phase and ensure it is a finishing phase
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    if (phase.phaseType !== PHASE_TYPES.FINISHING) {
      // For non-finishing phases, we simply return an empty payload to keep API predictable
      return successResponse(
        {
          phaseId: id,
          projectId: phase.projectId?.toString() || null,
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
            byFloor: {},
          },
        },
        'Phase finishing works retrieved successfully',
      );
    }

    const projectId = phase.projectId;
    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Phase has no valid associated project', 400);
    }

    // Optional filters
    const floorIdFilter = searchParams.get('floorId');
    const executionModelFilter = searchParams.get('executionModel');
    const categoryFilter = searchParams.get('category');

    const workItemQuery = {
      projectId: new ObjectId(projectId),
      phaseId: new ObjectId(id),
      deletedAt: null,
    };

    if (floorIdFilter && ObjectId.isValid(floorIdFilter)) {
      workItemQuery.floorId = new ObjectId(floorIdFilter);
    }

    if (categoryFilter) {
      workItemQuery.category = categoryFilter;
    }

    // Fetch work items for this finishing phase
    const workItems = await db
      .collection('work_items')
      .find(workItemQuery)
      .sort({ priority: 1, createdAt: 1 })
      .toArray();

    if (workItems.length === 0) {
      return successResponse(
        {
          phaseId: id,
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
            byFloor: {},
          },
        },
        'Phase finishing works retrieved successfully',
      );
    }

    // Load floors for floor metadata
    const floorIds = [
      ...new Set(
        workItems
          .map((item) => item.floorId?.toString())
          .filter((v) => v && ObjectId.isValid(v)),
      ),
    ];

    let floorMap = {};
    if (floorIds.length > 0) {
      const floors = await db
        .collection('floors')
        .find({
          _id: { $in: floorIds.map((fid) => new ObjectId(fid)) },
          deletedAt: null,
        })
        .toArray();

      floorMap = floors.reduce((acc, floor) => {
        acc[floor._id.toString()] = {
          _id: floor._id,
          name: floor.name,
          floorNumber: floor.floorNumber,
        };
        return acc;
      }, {});
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

      try {
        const { calculateTotalPaid } = await import('@/lib/constants/subcontractor-constants');

        subcontractorMap = subcontractors.reduce((acc, sub) => {
          const totalPaid =
            sub.paymentSchedule && Array.isArray(sub.paymentSchedule)
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
      } catch (err) {
        // If subcontractor helpers fail for any reason, log and continue without payment details
        console.error('Error loading subcontractor financial helpers:', err);
        subcontractorMap = subcontractors.reduce((acc, sub) => {
          acc[sub._id.toString()] = {
            _id: sub._id,
            subcontractorName: sub.subcontractorName,
            subcontractorType: sub.subcontractorType,
            status: sub.status,
            contractValue: sub.contractValue,
            contractType: sub.contractType,
            totalPaid: 0,
            paymentProgress: 0,
          };
          return acc;
        }, {});
      }
    }

    // Prepare summary aggregations
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
      byFloor: {},
    };

    const items = workItems
      .map((item) => {
        const executionModel = inferExecutionModel(item);

        // Filter by executionModel if provided
        if (
          executionModelFilter &&
          FINISHING_EXECUTION_MODELS.includes(executionModelFilter) &&
          executionModel !== executionModelFilter
        ) {
          return null;
        }

        const floorInfo = item.floorId
          ? floorMap[item.floorId.toString()] || null
          : null;
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

        const floorKey = item.floorId ? item.floorId.toString() : 'unassigned';
        if (!summary.byFloor[floorKey]) {
          summary.byFloor[floorKey] = {
            floorId: item.floorId ? item.floorId.toString() : null,
            floorName: floorInfo?.name || null,
            floorNumber: floorInfo?.floorNumber ?? null,
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
            itemCount: 0,
          };
        }

        summary.byFloor[floorKey].totalEstimatedCost += estimated;
        summary.byFloor[floorKey].totalActualCost += actual;
        summary.byFloor[floorKey].itemCount += 1;

        if (executionModel === 'contract_based') {
          summary.byFloor[floorKey].contractBased.estimatedCost += estimated;
          summary.byFloor[floorKey].contractBased.actualCost += actual;
        } else {
          summary.byFloor[floorKey].directLabour.estimatedCost += estimated;
          summary.byFloor[floorKey].directLabour.actualCost += actual;
        }

        return {
          ...item,
          executionModel,
          floor: floorInfo,
          subcontractor: subcontractorInfo,
        };
      })
      .filter(Boolean);

    return successResponse(
      {
        phaseId: id,
        projectId: projectId.toString(),
        items,
        summary,
      },
      'Phase finishing works retrieved successfully',
    );
  } catch (error) {
    console.error('Get phase finishing works error:', error);
    return errorResponse('Failed to retrieve phase finishing works', 500);
  }
}

