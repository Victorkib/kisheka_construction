/**
 * Time Period Labour Report API Route
 * GET: Get labour report for a time period
 * 
 * GET /api/labour/reports/by-time-period
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/labour/reports/by-time-period
 * Get time period labour report
 * Query params: dateFrom, dateTo, projectId, phaseId, groupBy (day|week|month)
 * Auth: All authenticated users
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const projectId = searchParams.get('projectId');
    const phaseId = searchParams.get('phaseId');
    const groupBy = searchParams.get('groupBy') || 'day'; // day, week, month

    if (!dateFrom || !dateTo) {
      return errorResponse('dateFrom and dateTo are required', 400);
    }

    const db = await getDatabase();

    // Build match criteria
    const matchCriteria = {
      entryDate: {
        $gte: new Date(dateFrom),
        $lte: new Date(dateTo),
      },
      status: { $in: ['approved', 'paid'] },
      deletedAt: null,
    };

    if (projectId && ObjectId.isValid(projectId)) {
      matchCriteria.projectId = new ObjectId(projectId);
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      matchCriteria.phaseId = new ObjectId(phaseId);
    }

    // Determine date format based on groupBy
    let dateFormat = '%Y-%m-%d'; // Default: day
    if (groupBy === 'week') {
      dateFormat = '%Y-W%V'; // ISO week
    } else if (groupBy === 'month') {
      dateFormat = '%Y-%m'; // Year-Month
    }

    // Group by time period
    const timePeriodData = await db.collection('labour_entries').aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: '$entryDate' },
          },
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
      { $sort: { _id: 1 } },
    ]).toArray();

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
          averageDailyCost: {
            $avg: {
              $sum: '$totalCost',
            },
          },
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
      averageDailyCost: 0,
    };

    // Calculate period length in days
    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    return successResponse(
      {
        period: {
          dateFrom,
          dateTo,
          periodDays,
          groupBy,
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
          averageDailyCost: summaryData.totalCost / periodDays,
          averageDailyHours: summaryData.totalHours / periodDays,
        },
        timePeriodData: timePeriodData.map((item) => ({
          period: item._id,
          totalHours: item.totalHours,
          totalCost: item.totalCost,
          regularHours: item.regularHours,
          overtimeHours: item.overtimeHours,
          regularCost: item.regularCost,
          overtimeCost: item.overtimeCost,
          entryCount: item.entryCount,
          workerCount: item.uniqueWorkers?.length || 0,
        })),
      },
      'Time period labour report generated successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/reports/by-time-period error:', error);
    return errorResponse('Failed to generate time period labour report', 500);
  }
}

