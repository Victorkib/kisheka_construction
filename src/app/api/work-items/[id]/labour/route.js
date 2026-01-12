/**
 * Work Item Labour API Route
 * GET: Get labour entries for a work item
 * 
 * GET /api/work-items/[id]/labour
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/work-items/[id]/labour
 * Get labour entries for a work item
 * Query params: status, dateFrom, dateTo
 * Auth: All authenticated users
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid work item ID is required', 400);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const db = await getDatabase();

    // Verify work item exists
    const workItem = await db.collection('work_items').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!workItem) {
      return errorResponse('Work item not found', 404);
    }

    // Build match criteria
    const matchCriteria = {
      workItemId: new ObjectId(id),
      deletedAt: null,
    };

    if (status) {
      matchCriteria.status = status;
    } else {
      // Default to approved/paid entries
      matchCriteria.status = { $in: ['approved', 'paid'] };
    }

    if (dateFrom || dateTo) {
      matchCriteria.entryDate = {};
      if (dateFrom) {
        matchCriteria.entryDate.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        matchCriteria.entryDate.$lte = new Date(dateTo);
      }
    }

    // Get labour entries
    const labourEntries = await db.collection('labour_entries')
      .find(matchCriteria)
      .sort({ entryDate: -1 })
      .toArray();

    // Calculate summary
    const summary = await db.collection('labour_entries').aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$totalHours' },
          totalCost: { $sum: '$totalCost' },
          regularHours: { $sum: { $subtract: ['$totalHours', { $ifNull: ['$overtimeHours', 0] }] } },
          overtimeHours: { $sum: { $ifNull: ['$overtimeHours', 0] } },
          regularCost: { $sum: '$regularCost' },
          overtimeCost: { $sum: '$overtimeCost' },
          entryCount: { $sum: 1 },
          uniqueWorkers: { $addToSet: '$workerName' },
        },
      },
    ]).toArray();

    const summaryData = summary[0] || {
      totalHours: 0,
      totalCost: 0,
      regularHours: 0,
      overtimeHours: 0,
      regularCost: 0,
      overtimeCost: 0,
      entryCount: 0,
      uniqueWorkers: [],
    };

    // Group by worker
    const byWorker = await db.collection('labour_entries').aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: '$workerName',
          totalHours: { $sum: '$totalHours' },
          totalCost: { $sum: '$totalCost' },
          entryCount: { $sum: 1 },
          skillTypes: { $addToSet: '$skillType' },
        },
      },
      { $sort: { totalCost: -1 } },
    ]).toArray();

    // Group by skill type
    const bySkill = await db.collection('labour_entries').aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: '$skillType',
          totalHours: { $sum: '$totalHours' },
          totalCost: { $sum: '$totalCost' },
          entryCount: { $sum: 1 },
          uniqueWorkers: { $addToSet: '$workerName' },
        },
      },
      { $sort: { totalCost: -1 } },
    ]).toArray();

    // Daily breakdown
    const dailyBreakdown = await db.collection('labour_entries').aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$entryDate' },
          },
          totalHours: { $sum: '$totalHours' },
          totalCost: { $sum: '$totalCost' },
          entryCount: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]).toArray();

    return successResponse(
      {
        workItem: {
          workItemId: workItem._id.toString(),
          workItemName: workItem.name,
          estimatedHours: workItem.estimatedHours || 0,
          estimatedCost: workItem.estimatedCost || 0,
          actualHours: workItem.actualHours || 0,
          actualCost: workItem.actualCost || 0,
        },
        summary: {
          totalHours: summaryData.totalHours,
          totalCost: summaryData.totalCost,
          regularHours: summaryData.regularHours || 0,
          overtimeHours: summaryData.overtimeHours || 0,
          regularCost: summaryData.regularCost || 0,
          overtimeCost: summaryData.overtimeCost || 0,
          entryCount: summaryData.entryCount,
          uniqueWorkers: summaryData.uniqueWorkers?.length || 0,
          hoursVariance: (workItem.estimatedHours || 0) - summaryData.totalHours,
          costVariance: (workItem.estimatedCost || 0) - summaryData.totalCost,
          hoursUtilization:
            (workItem.estimatedHours || 0) > 0
              ? (summaryData.totalHours / workItem.estimatedHours) * 100
              : 0,
          costUtilization:
            (workItem.estimatedCost || 0) > 0
              ? (summaryData.totalCost / workItem.estimatedCost) * 100
              : 0,
        },
        labourEntries: labourEntries.map((entry) => ({
          _id: entry._id.toString(),
          workerName: entry.workerName,
          skillType: entry.skillType,
          entryDate: entry.entryDate,
          totalHours: entry.totalHours,
          hourlyRate: entry.hourlyRate,
          totalCost: entry.totalCost,
          taskDescription: entry.taskDescription,
          status: entry.status,
        })),
        byWorker: byWorker.map((item) => ({
          workerName: item._id,
          totalHours: item.totalHours,
          totalCost: item.totalCost,
          entryCount: item.entryCount,
          skillTypes: item.skillTypes,
        })),
        bySkill: bySkill.map((item) => ({
          skillType: item._id,
          skillTypeLabel: item._id?.replace(/_/g, ' '),
          totalHours: item.totalHours,
          totalCost: item.totalCost,
          entryCount: item.entryCount,
          workerCount: item.uniqueWorkers?.length || 0,
        })),
        dailyBreakdown: dailyBreakdown.map((item) => ({
          date: item._id,
          totalHours: item.totalHours,
          totalCost: item.totalCost,
          entryCount: item.entryCount,
        })),
      },
      'Work item labour data retrieved successfully'
    );
  } catch (error) {
    console.error('GET /api/work-items/[id]/labour error:', error);
    return errorResponse('Failed to retrieve work item labour data', 500);
  }
}

