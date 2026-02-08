/**
 * Category/Skill-Level Labour Report API Route
 * GET: Get labour report by category or skill type
 * 
 * GET /api/labour/reports/by-category
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/labour/reports/by-category
 * Get category/skill-level labour report
 * Query params: categoryId, skillType, projectId, phaseId, dateFrom, dateTo
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
    const categoryId = searchParams.get('categoryId');
    const skillType = searchParams.get('skillType');
    const projectId = searchParams.get('projectId');
    const phaseId = searchParams.get('phaseId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!categoryId && !skillType) {
      return errorResponse('Either categoryId or skillType is required', 400);
    }

    const db = await getDatabase();

    // Build match criteria
    const matchCriteria = {
      status: { $in: ['approved', 'paid'] },
      deletedAt: null,
    };

    if (categoryId && ObjectId.isValid(categoryId)) {
      matchCriteria.categoryId = new ObjectId(categoryId);
    }

    if (skillType) {
      matchCriteria.skillType = skillType;
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
        },
      },
      { $sort: { totalCost: -1 } },
    ]).toArray();

    // Group by phase (if categoryId provided)
    let byPhase = [];
    if (categoryId) {
      byPhase = await db.collection('labour_entries').aggregate([
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
    }

    const summaryData = summary[0] || {
      totalHours: 0,
      totalCost: 0,
      regularHours: 0,
      overtimeHours: 0,
      entryCount: 0,
      uniqueWorkers: [],
    };

    // Get category info if provided
    let categoryInfo = null;
    if (categoryId) {
      const category = await db.collection('categories').findOne({
        _id: new ObjectId(categoryId),
        deletedAt: null,
      });
      if (category) {
        categoryInfo = {
          categoryId: category._id.toString(),
          categoryName: category.categoryName,
        };
      }
    }

    return successResponse(
      {
        category: categoryInfo,
        skillType: skillType || null,
        period: {
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        },
        summary: {
          totalHours: summaryData.totalHours,
          totalCost: summaryData.totalCost,
          regularHours: summaryData.regularHours || 0,
          overtimeHours: summaryData.overtimeHours || 0,
          entryCount: summaryData.entryCount,
          uniqueWorkers: summaryData.uniqueWorkers?.length || 0,
        },
        byWorker: byWorker.map((item) => ({
          workerName: item._id,
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
      },
      'Category/Skill labour report generated successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/reports/by-category error:', error);
    return errorResponse('Failed to generate category/skill labour report', 500);
  }
}

