/**
 * Productivity Report API Route
 * GET: Get productivity report
 * 
 * GET /api/labour/reports/productivity
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/labour/reports/productivity
 * Get productivity report
 * Query params: projectId, phaseId, dateFrom, dateTo, groupBy (worker|skill|phase)
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
    const projectId = searchParams.get('projectId');
    const phaseId = searchParams.get('phaseId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const groupBy = searchParams.get('groupBy') || 'worker'; // worker, skill, phase

    const db = await getDatabase();

    // Build match criteria
    const matchCriteria = {
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

    let productivityData = [];

    if (groupBy === 'worker') {
      // Group by worker
      productivityData = await db.collection('labour_entries').aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: '$workerName',
            totalHours: { $sum: '$totalHours' },
            totalCost: { $sum: '$totalCost' },
            entryCount: { $sum: 1 },
            averageRating: { $avg: '$qualityRating' },
            productivityRating: { $avg: '$productivityRating' },
            quantityCompleted: { $sum: { $ifNull: ['$quantityCompleted', 0] } },
            skillTypes: { $addToSet: '$skillType' },
          },
        },
        { $sort: { totalHours: -1 } },
      ]).toArray();

      productivityData = productivityData.map((item) => ({
        workerName: item._id,
        totalHours: item.totalHours,
        totalCost: item.totalCost,
        entryCount: item.entryCount,
        averageRating: item.averageRating || null,
        productivityRating: item.productivityRating || null,
        quantityCompleted: item.quantityCompleted || 0,
        skillTypes: item.skillTypes,
        hoursPerEntry: item.entryCount > 0 ? item.totalHours / item.entryCount : 0,
        costPerHour: item.totalHours > 0 ? item.totalCost / item.totalHours : 0,
      }));
    } else if (groupBy === 'skill') {
      // Group by skill type
      productivityData = await db.collection('labour_entries').aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: '$skillType',
            totalHours: { $sum: '$totalHours' },
            totalCost: { $sum: '$totalCost' },
            entryCount: { $sum: 1 },
            uniqueWorkers: { $addToSet: '$workerName' },
            averageRating: { $avg: '$qualityRating' },
            productivityRating: { $avg: '$productivityRating' },
            quantityCompleted: { $sum: { $ifNull: ['$quantityCompleted', 0] } },
          },
        },
        { $sort: { totalHours: -1 } },
      ]).toArray();

      productivityData = productivityData.map((item) => ({
        skillType: item._id,
        skillTypeLabel: item._id?.replace(/_/g, ' '),
        totalHours: item.totalHours,
        totalCost: item.totalCost,
        entryCount: item.entryCount,
        workerCount: item.uniqueWorkers?.length || 0,
        averageRating: item.averageRating || null,
        productivityRating: item.productivityRating || null,
        quantityCompleted: item.quantityCompleted || 0,
        hoursPerEntry: item.entryCount > 0 ? item.totalHours / item.entryCount : 0,
        costPerHour: item.totalHours > 0 ? item.totalCost / item.totalHours : 0,
      }));
    } else if (groupBy === 'phase') {
      // Group by phase
      productivityData = await db.collection('labour_entries').aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: '$phaseId',
            totalHours: { $sum: '$totalHours' },
            totalCost: { $sum: '$totalCost' },
            entryCount: { $sum: 1 },
            uniqueWorkers: { $addToSet: '$workerName' },
            averageRating: { $avg: '$qualityRating' },
            productivityRating: { $avg: '$productivityRating' },
            quantityCompleted: { $sum: { $ifNull: ['$quantityCompleted', 0] } },
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
        { $sort: { totalHours: -1 } },
      ]).toArray();

      productivityData = productivityData.map((item) => ({
        phaseId: item._id?.toString(),
        phaseName: item.phase?.phaseName || 'Unknown',
        phaseCode: item.phase?.phaseCode || '',
        totalHours: item.totalHours,
        totalCost: item.totalCost,
        entryCount: item.entryCount,
        workerCount: item.uniqueWorkers?.length || 0,
        averageRating: item.averageRating || null,
        productivityRating: item.productivityRating || null,
        quantityCompleted: item.quantityCompleted || 0,
        hoursPerEntry: item.entryCount > 0 ? item.totalHours / item.entryCount : 0,
        costPerHour: item.totalHours > 0 ? item.totalCost / item.totalHours : 0,
      }));
    }

    // Calculate summary
    const summary = await db.collection('labour_entries').aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$totalHours' },
          totalCost: { $sum: '$totalCost' },
          entryCount: { $sum: 1 },
          uniqueWorkers: { $addToSet: '$workerName' },
          averageRating: { $avg: '$qualityRating' },
          productivityRating: { $avg: '$productivityRating' },
          quantityCompleted: { $sum: { $ifNull: ['$quantityCompleted', 0] } },
        },
      },
    ]).toArray();

    const summaryData = summary[0] || {
      totalHours: 0,
      totalCost: 0,
      entryCount: 0,
      uniqueWorkers: [],
      averageRating: null,
      productivityRating: null,
      quantityCompleted: 0,
    };

    return successResponse(
      {
        period: {
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        },
        groupBy,
        summary: {
          totalHours: summaryData.totalHours,
          totalCost: summaryData.totalCost,
          entryCount: summaryData.entryCount,
          uniqueWorkers: summaryData.uniqueWorkers?.length || 0,
          averageRating: summaryData.averageRating || null,
          productivityRating: summaryData.productivityRating || null,
          quantityCompleted: summaryData.quantityCompleted || 0,
          averageHoursPerEntry:
            summaryData.entryCount > 0 ? summaryData.totalHours / summaryData.entryCount : 0,
          averageCostPerHour:
            summaryData.totalHours > 0 ? summaryData.totalCost / summaryData.totalHours : 0,
        },
        productivityData,
      },
      'Productivity report generated successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/reports/productivity error:', error);
    return errorResponse('Failed to generate productivity report', 500);
  }
}

