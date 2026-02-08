/**
 * Worker-Level Labour Report API Route
 * GET: Get labour report for a specific worker
 * 
 * GET /api/labour/reports/by-worker
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/labour/reports/by-worker
 * Get worker-level labour report
 * Query params: workerId, workerName, projectId, phaseId, dateFrom, dateTo
 * Auth: All authenticated users
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const workerId = searchParams.get('workerId');
    const workerName = searchParams.get('workerName');
    const projectId = searchParams.get('projectId');
    const phaseId = searchParams.get('phaseId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!workerId && !workerName) {
      return errorResponse('Either workerId or workerName is required', 400);
    }

    const db = await getDatabase();

    // Build match criteria
    const matchCriteria = {
      status: { $in: ['approved', 'paid'] },
      deletedAt: null,
    };

    if (workerId && ObjectId.isValid(workerId)) {
      matchCriteria.workerId = new ObjectId(workerId);
    }

    if (workerName) {
      matchCriteria.workerName = workerName;
    }

    if (projectId && ObjectId.isValid(projectId)) {
      matchCriteria.projectId = new ObjectId(projectId);
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      matchCriteria.phaseId = new ObjectId(phaseId);
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

    // Get summary
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
          averageHourlyRate: { $avg: '$hourlyRate' },
          skillTypes: { $addToSet: '$skillType' },
        },
      },
    ]).toArray();

    // Group by project
    const byProject = await db.collection('labour_entries').aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: '$projectId',
          totalHours: { $sum: '$totalHours' },
          totalCost: { $sum: '$totalCost' },
          entryCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'projects',
          localField: '_id',
          foreignField: '_id',
          as: 'project',
        },
      },
      {
        $unwind: {
          path: '$project',
          preserveNullAndEmptyArrays: true,
        },
      },
      { $sort: { totalCost: -1 } },
    ]).toArray();

    // Group by phase
    const byPhase = await db.collection('labour_entries').aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: '$phaseId',
          totalHours: { $sum: '$totalHours' },
          totalCost: { $sum: '$totalCost' },
          entryCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'phases',
          localField: '_id',
          foreignField: '_id',
          as: 'phase',
        },
      },
      {
        $unwind: {
          path: '$phase',
          preserveNullAndEmptyArrays: true,
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
      { $limit: 30 }, // Last 30 days
    ]).toArray();

    const summaryData = summary[0] || {
      totalHours: 0,
      totalCost: 0,
      regularHours: 0,
      overtimeHours: 0,
      regularCost: 0,
      overtimeCost: 0,
      entryCount: 0,
      averageHourlyRate: 0,
      skillTypes: [],
    };

    // Get worker profile if workerId provided
    let workerProfile = null;
    if (workerId) {
      workerProfile = await db.collection('worker_profiles').findOne({
        userId: new ObjectId(workerId),
        status: 'active',
      });
    }

    return successResponse(
      {
        worker: {
          workerId: workerId || null,
          workerName: workerName || workerProfile?.workerName || 'Unknown',
          profile: workerProfile
            ? {
                employeeId: workerProfile.employeeId,
                workerType: workerProfile.workerType,
                skillTypes: workerProfile.skillTypes,
                defaultHourlyRate: workerProfile.defaultHourlyRate,
              }
            : null,
        },
        period: {
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        },
        summary: {
          totalHours: summaryData.totalHours,
          totalCost: summaryData.totalCost,
          regularHours: summaryData.regularHours || 0,
          overtimeHours: summaryData.overtimeHours || 0,
          regularCost: summaryData.regularCost || 0,
          overtimeCost: summaryData.overtimeCost || 0,
          entryCount: summaryData.entryCount,
          averageHourlyRate: summaryData.averageHourlyRate || 0,
          skillTypes: summaryData.skillTypes || [],
        },
        byProject: byProject.map((item) => ({
          projectId: item._id?.toString(),
          projectName: item.project?.projectName || 'Unknown',
          totalHours: item.totalHours,
          totalCost: item.totalCost,
          entryCount: item.entryCount,
        })),
        byPhase: byPhase.map((item) => ({
          phaseId: item._id?.toString(),
          phaseName: item.phase?.phaseName || 'Unknown',
          totalHours: item.totalHours,
          totalCost: item.totalCost,
          entryCount: item.entryCount,
        })),
        bySkill: bySkill.map((item) => ({
          skillType: item._id,
          skillTypeLabel: item._id?.replace(/_/g, ' '),
          totalHours: item.totalHours,
          totalCost: item.totalCost,
          entryCount: item.entryCount,
        })),
        dailyBreakdown: dailyBreakdown.map((item) => ({
          date: item._id,
          totalHours: item.totalHours,
          totalCost: item.totalCost,
          entryCount: item.entryCount,
        })),
      },
      'Worker labour report generated successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/reports/by-worker error:', error);
    return errorResponse('Failed to generate worker labour report', 500);
  }
}

