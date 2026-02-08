/**
 * Floor-Level Labour Report API Route
 * GET: Get labour report for a floor
 * 
 * GET /api/labour/reports/by-floor
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/labour/reports/by-floor
 * Get floor-level labour report
 * Query params: floorId, projectId, phaseId, dateFrom, dateTo
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
    const floorId = searchParams.get('floorId');
    const projectId = searchParams.get('projectId');
    const phaseId = searchParams.get('phaseId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!floorId || !ObjectId.isValid(floorId)) {
      return errorResponse('Valid floorId is required', 400);
    }

    const db = await getDatabase();

    // Verify floor exists
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(floorId),
      deletedAt: null,
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    // Build match criteria
    const matchCriteria = {
      floorId: new ObjectId(floorId),
      status: { $in: ['approved', 'paid'] },
      deletedAt: null,
    };

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
          uniqueWorkers: { $addToSet: '$workerName' },
        },
      },
    ]).toArray();

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

    // Group by skill
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

    return successResponse(
      {
        floor: {
          floorId: floor._id.toString(),
          floorName: floor.floorName,
          floorNumber: floor.floorNumber,
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
          uniqueWorkers: summaryData.uniqueWorkers?.length || 0,
        },
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
      },
      'Floor labour report generated successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/reports/by-floor error:', error);
    return errorResponse('Failed to generate floor labour report', 500);
  }
}

