/**
 * Phase Floors API Route
 * GET: Get floor-level breakdown for a phase
 *
 * GET /api/phases/[id]/floors
 * Auth: All authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { MATERIAL_APPROVED_STATUSES } from '@/lib/status-constants';

const getFloorGroup = (floorNumber) => {
  if (floorNumber === undefined || floorNumber === null) return 'unknown';
  return floorNumber < 0 ? 'basement' : 'superstructure';
};

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

    const db = await getDatabase();
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    const projectId = phase.projectId;
    const floors = await db.collection('floors').find({
      projectId: new ObjectId(projectId),
      deletedAt: null,
    }).sort({ floorNumber: 1 }).toArray();

    const floorMap = {};
    floors.forEach((floor) => {
      floorMap[floor._id.toString()] = {
        floorId: floor._id.toString(),
        floorNumber: floor.floorNumber,
        floorName: floor.name || `Floor ${floor.floorNumber}`,
        group: getFloorGroup(floor.floorNumber),
        totals: {
          materials: 0,
          materialRequests: 0,
          purchaseOrders: 0,
          labour: 0,
          workItems: 0,
        },
        counts: {
          materials: 0,
          materialRequests: 0,
          purchaseOrders: 0,
          labour: 0,
          workItems: 0,
        },
      };
    });

    const unassigned = {
      totals: {
        materials: 0,
        materialRequests: 0,
        purchaseOrders: 0,
        labour: 0,
        workItems: 0,
      },
      counts: {
        materials: 0,
        materialRequests: 0,
        purchaseOrders: 0,
        labour: 0,
        workItems: 0,
      },
    };

    const phaseId = new ObjectId(id);

    const [
      materialsAgg,
      materialsUnassigned,
      requestsAgg,
      requestsUnassigned,
      ordersAgg,
      ordersUnassigned,
      labourAgg,
      labourUnassigned,
      workItemsAgg,
      workItemsUnassigned,
    ] = await Promise.all([
      db.collection('materials').aggregate([
        {
          $match: {
            phaseId,
            deletedAt: null,
            status: { $in: MATERIAL_APPROVED_STATUSES },
            floor: { $ne: null },
          },
        },
        { $group: { _id: '$floor', total: { $sum: '$totalCost' }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('materials').aggregate([
        {
          $match: {
            phaseId,
            deletedAt: null,
            status: { $in: MATERIAL_APPROVED_STATUSES },
            $or: [{ floor: { $exists: false } }, { floor: null }],
          },
        },
        { $group: { _id: null, total: { $sum: '$totalCost' }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('material_requests').aggregate([
        {
          $match: {
            phaseId,
            deletedAt: null,
            floorId: { $ne: null },
          },
        },
        { $group: { _id: '$floorId', total: { $sum: '$estimatedCost' }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('material_requests').aggregate([
        {
          $match: {
            phaseId,
            deletedAt: null,
            $or: [{ floorId: { $exists: false } }, { floorId: null }],
          },
        },
        { $group: { _id: null, total: { $sum: '$estimatedCost' }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('purchase_orders').aggregate([
        {
          $match: {
            phaseId,
            deletedAt: null,
            floorId: { $ne: null },
            status: { $nin: ['order_rejected', 'cancelled'] },
          },
        },
        { $group: { _id: '$floorId', total: { $sum: '$totalCost' }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('purchase_orders').aggregate([
        {
          $match: {
            phaseId,
            deletedAt: null,
            status: { $nin: ['order_rejected', 'cancelled'] },
            $or: [{ floorId: { $exists: false } }, { floorId: null }],
          },
        },
        { $group: { _id: null, total: { $sum: '$totalCost' }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('labour_entries').aggregate([
        {
          $match: {
            phaseId,
            deletedAt: null,
            floorId: { $ne: null },
            status: { $in: ['approved', 'paid'] },
          },
        },
        { $group: { _id: '$floorId', total: { $sum: '$totalCost' }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('labour_entries').aggregate([
        {
          $match: {
            phaseId,
            deletedAt: null,
            status: { $in: ['approved', 'paid'] },
            $or: [{ floorId: { $exists: false } }, { floorId: null }],
          },
        },
        { $group: { _id: null, total: { $sum: '$totalCost' }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('work_items').aggregate([
        {
          $match: {
            phaseId,
            deletedAt: null,
            floorId: { $ne: null },
          },
        },
        {
          $addFields: {
            resolvedCost: {
              $cond: [
                { $gt: ['$actualCost', 0] },
                '$actualCost',
                '$estimatedCost',
              ],
            },
          },
        },
        { $group: { _id: '$floorId', total: { $sum: '$resolvedCost' }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('work_items').aggregate([
        {
          $match: {
            phaseId,
            deletedAt: null,
            $or: [{ floorId: { $exists: false } }, { floorId: null }],
          },
        },
        {
          $addFields: {
            resolvedCost: {
              $cond: [
                { $gt: ['$actualCost', 0] },
                '$actualCost',
                '$estimatedCost',
              ],
            },
          },
        },
        { $group: { _id: null, total: { $sum: '$resolvedCost' }, count: { $sum: 1 } } },
      ]).toArray(),
    ]);

    const applyAgg = (agg, key) => {
      agg.forEach((row) => {
        const floorId = row._id?.toString?.();
        if (floorId && floorMap[floorId]) {
          floorMap[floorId].totals[key] = row.total || 0;
          floorMap[floorId].counts[key] = row.count || 0;
        }
      });
    };

    applyAgg(materialsAgg, 'materials');
    applyAgg(requestsAgg, 'materialRequests');
    applyAgg(ordersAgg, 'purchaseOrders');
    applyAgg(labourAgg, 'labour');
    applyAgg(workItemsAgg, 'workItems');

    if (materialsUnassigned[0]) {
      unassigned.totals.materials = materialsUnassigned[0].total || 0;
      unassigned.counts.materials = materialsUnassigned[0].count || 0;
    }
    if (requestsUnassigned[0]) {
      unassigned.totals.materialRequests = requestsUnassigned[0].total || 0;
      unassigned.counts.materialRequests = requestsUnassigned[0].count || 0;
    }
    if (ordersUnassigned[0]) {
      unassigned.totals.purchaseOrders = ordersUnassigned[0].total || 0;
      unassigned.counts.purchaseOrders = ordersUnassigned[0].count || 0;
    }
    if (labourUnassigned[0]) {
      unassigned.totals.labour = labourUnassigned[0].total || 0;
      unassigned.counts.labour = labourUnassigned[0].count || 0;
    }
    if (workItemsUnassigned[0]) {
      unassigned.totals.workItems = workItemsUnassigned[0].total || 0;
      unassigned.counts.workItems = workItemsUnassigned[0].count || 0;
    }

    const floorsWithTotals = Object.values(floorMap);

    return successResponse({
      phaseId: id,
      projectId: projectId.toString(),
      floors: floorsWithTotals,
      unassigned,
    }, 'Phase floor breakdown retrieved successfully');
  } catch (error) {
    console.error('Get phase floors error:', error);
    return errorResponse('Failed to retrieve phase floor breakdown', 500);
  }
}
