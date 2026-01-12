/**
 * Professional Services Report API Route
 * GET: Get professional services report
 * 
 * GET /api/labour/reports/professional-services
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/labour/reports/professional-services
 * Get professional services report
 * Query params: projectId, phaseId, profession, serviceType, dateFrom, dateTo
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
    const projectId = searchParams.get('projectId');
    const phaseId = searchParams.get('phaseId');
    const profession = searchParams.get('profession');
    const serviceType = searchParams.get('serviceType');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const db = await getDatabase();

    // Build match criteria
    const matchCriteria = {
      workerType: 'professional',
      status: { $in: ['approved', 'paid'] },
      deletedAt: null,
    };

    if (projectId && ObjectId.isValid(projectId)) {
      matchCriteria.projectId = new ObjectId(projectId);
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      matchCriteria.phaseId = new ObjectId(phaseId);
    }

    if (serviceType) {
      matchCriteria.serviceType = serviceType;
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

    // Aggregate by profession
    const byProfession = await db.collection('labour_entries').aggregate([
      {
        $match: matchCriteria,
      },
      {
        $lookup: {
          from: 'worker_profiles',
          localField: 'workerId',
          foreignField: 'userId',
          as: 'workerProfile',
        },
      },
      {
        $unwind: {
          path: '$workerProfile',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: '$workerProfile.profession' || 'unknown',
          totalHours: { $sum: '$totalHours' },
          totalCost: { $sum: '$totalCost' },
          entryCount: { $sum: 1 },
          workers: { $addToSet: '$workerName' },
        },
      },
      {
        $sort: { totalCost: -1 },
      },
    ]).toArray();

    // Aggregate by service type
    const byServiceType = await db.collection('labour_entries').aggregate([
      {
        $match: matchCriteria,
      },
      {
        $group: {
          _id: '$serviceType' || 'unknown',
          totalHours: { $sum: '$totalHours' },
          totalCost: { $sum: '$totalCost' },
          entryCount: { $sum: 1 },
        },
      },
      {
        $sort: { totalCost: -1 },
      },
    ]).toArray();

    // Aggregate by project/phase
    const byProjectPhase = await db.collection('labour_entries').aggregate([
      {
        $match: matchCriteria,
      },
      {
        $group: {
          _id: {
            projectId: '$projectId',
            phaseId: '$phaseId',
          },
          totalHours: { $sum: '$totalHours' },
          totalCost: { $sum: '$totalCost' },
          entryCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'projects',
          localField: '_id.projectId',
          foreignField: '_id',
          as: 'project',
        },
      },
      {
        $lookup: {
          from: 'phases',
          localField: '_id.phaseId',
          foreignField: '_id',
          as: 'phase',
        },
      },
      {
        $unwind: {
          path: '$project',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: '$phase',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: { totalCost: -1 },
      },
    ]).toArray();

    // Calculate totals
    const totals = await db.collection('labour_entries').aggregate([
      {
        $match: matchCriteria,
      },
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$totalHours' },
          totalCost: { $sum: '$totalCost' },
          entryCount: { $sum: 1 },
          uniqueWorkers: { $addToSet: '$workerName' },
        },
      },
    ]).toArray();

    const summary = totals[0] || {
      totalHours: 0,
      totalCost: 0,
      entryCount: 0,
      uniqueWorkers: [],
    };

    return successResponse(
      {
        summary: {
          totalHours: summary.totalHours,
          totalCost: summary.totalCost,
          entryCount: summary.entryCount,
          uniqueWorkers: summary.uniqueWorkers?.length || 0,
        },
        byProfession: byProfession.map((item) => ({
          profession: item._id,
          totalHours: item.totalHours,
          totalCost: item.totalCost,
          entryCount: item.entryCount,
          workerCount: item.workers?.length || 0,
        })),
        byServiceType: byServiceType.map((item) => ({
          serviceType: item._id,
          totalHours: item.totalHours,
          totalCost: item.totalCost,
          entryCount: item.entryCount,
        })),
        byProjectPhase: byProjectPhase.map((item) => ({
          projectId: item._id.projectId?.toString(),
          projectName: item.project?.projectName || 'Unknown',
          phaseId: item._id.phaseId?.toString(),
          phaseName: item.phase?.phaseName || 'Unknown',
          totalHours: item.totalHours,
          totalCost: item.totalCost,
          entryCount: item.entryCount,
        })),
        filters: {
          projectId,
          phaseId,
          profession,
          serviceType,
          dateFrom,
          dateTo,
        },
      },
      'Professional services report generated successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/reports/professional-services error:', error);
    return errorResponse('Failed to generate professional services report', 500);
  }
}

