/**
 * Subcontractor Labour API Route
 * GET: Get labour entries for a subcontractor
 * 
 * GET /api/subcontractors/[id]/labour
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getSubcontractorLabourEntries, getSubcontractorLabourSummary } from '@/lib/subcontractor-labour-helpers';

/**
 * GET /api/subcontractors/[id]/labour
 * Get labour entries for a subcontractor
 * Query params: dateFrom, dateTo
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
      return errorResponse('Valid subcontractor ID is required', 400);
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const db = await getDatabase();

    // Verify subcontractor exists
    const subcontractor = await db.collection('subcontractors').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!subcontractor) {
      return errorResponse('Subcontractor not found', 404);
    }

    // Get labour summary
    const summary = await getSubcontractorLabourSummary(
      subcontractor.projectId?.toString(),
      subcontractor.phaseId?.toString(),
      id,
      dateFrom,
      dateTo
    );

    // Get labour entries
    const entries = await getSubcontractorLabourEntries(id, dateFrom, dateTo);

    // Group by worker
    const byWorker = await db.collection('labour_entries').aggregate([
      {
        $match: {
          subcontractorId: new ObjectId(id),
          status: { $in: ['approved', 'paid'] },
          deletedAt: null,
          ...(dateFrom || dateTo
            ? {
                entryDate: {
                  ...(dateFrom ? { $gte: new Date(dateFrom) } : {}),
                  ...(dateTo ? { $lte: new Date(dateTo) } : {}),
                },
              }
            : {}),
        },
      },
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

    // Daily breakdown
    const dailyBreakdown = await db.collection('labour_entries').aggregate([
      {
        $match: {
          subcontractorId: new ObjectId(id),
          status: { $in: ['approved', 'paid'] },
          deletedAt: null,
          ...(dateFrom || dateTo
            ? {
                entryDate: {
                  ...(dateFrom ? { $gte: new Date(dateFrom) } : {}),
                  ...(dateTo ? { $lte: new Date(dateTo) } : {}),
                },
              }
            : {}),
        },
      },
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
      { $limit: 30 }, // Last 30 days
    ]).toArray();

    return successResponse(
      {
        subcontractor: {
          subcontractorId: subcontractor._id.toString(),
          subcontractorName: subcontractor.subcontractorName,
          contractValue: subcontractor.contractValue || 0,
          contractType: subcontractor.contractType,
        },
        summary: {
          totalHours: summary.summary.totalHours,
          totalCost: summary.summary.totalCost,
          regularHours: summary.summary.regularHours || 0,
          overtimeHours: summary.summary.overtimeHours || 0,
          regularCost: summary.summary.regularCost || 0,
          overtimeCost: summary.summary.overtimeCost || 0,
          entryCount: summary.summary.entryCount,
          uniqueWorkers: summary.summary.uniqueWorkers?.length || 0,
          contractUtilization:
            subcontractor.contractValue > 0
              ? (summary.summary.totalCost / subcontractor.contractValue) * 100
              : 0,
        },
        labourEntries: entries.map((entry) => ({
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
        dailyBreakdown: dailyBreakdown.map((item) => ({
          date: item._id,
          totalHours: item.totalHours,
          totalCost: item.totalCost,
          entryCount: item.entryCount,
        })),
      },
      'Subcontractor labour data retrieved successfully'
    );
  } catch (error) {
    console.error('GET /api/subcontractors/[id]/labour error:', error);
    return errorResponse('Failed to retrieve subcontractor labour data', 500);
  }
}

