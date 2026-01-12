/**
 * Project-Level Labour Report API Route
 * GET: Get labour report for a project
 * 
 * GET /api/labour/reports/by-project
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getCombinedLabourSummary } from '@/lib/subcontractor-labour-helpers';

/**
 * GET /api/labour/reports/by-project
 * Get project-level labour report
 * Query params: projectId, dateFrom, dateTo, groupBy (phase|worker|skill)
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
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const groupBy = searchParams.get('groupBy') || 'phase'; // phase, worker, skill

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      deletedAt: null,
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Build match criteria
    const matchCriteria = {
      projectId: new ObjectId(projectId),
      status: { $in: ['approved', 'paid'] },
      deletedAt: null,
    };

    if (dateFrom || dateTo) {
      matchCriteria.entryDate = {};
      if (dateFrom) {
        matchCriteria.entryDate.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        matchCriteria.entryDate.$lte = new Date(dateTo);
      }
    }

    // Aggregate based on groupBy
    let groupedData = [];
    let summary = {};

    if (groupBy === 'phase') {
      // Group by phase
      groupedData = await db.collection('labour_entries').aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: '$phaseId',
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
        {
          $sort: { totalCost: -1 },
        },
      ]).toArray();

      // Calculate summary
      summary = await db.collection('labour_entries').aggregate([
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

      groupedData = groupedData.map((item) => ({
        phaseId: item._id?.toString(),
        phaseName: item.phase?.phaseName || 'Unknown',
        phaseCode: item.phase?.phaseCode || '',
        totalHours: item.totalHours,
        totalCost: item.totalCost,
        regularHours: item.regularHours,
        overtimeHours: item.overtimeHours,
        regularCost: item.regularCost,
        overtimeCost: item.overtimeCost,
        entryCount: item.entryCount,
        workerCount: item.uniqueWorkers?.length || 0,
      }));
    } else if (groupBy === 'worker') {
      // Group by worker
      groupedData = await db.collection('labour_entries').aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: '$workerName',
            totalHours: { $sum: '$totalHours' },
            totalCost: { $sum: '$totalCost' },
            regularHours: { $sum: { $subtract: ['$totalHours', { $ifNull: ['$overtimeHours', 0] }] } },
            overtimeHours: { $sum: { $ifNull: ['$overtimeHours', 0] } },
            entryCount: { $sum: 1 },
            skillTypes: { $addToSet: '$skillType' },
          },
        },
        {
          $sort: { totalCost: -1 },
        },
      ]).toArray();

      summary = await db.collection('labour_entries').aggregate([
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

      groupedData = groupedData.map((item) => ({
        workerName: item._id,
        totalHours: item.totalHours,
        totalCost: item.totalCost,
        regularHours: item.regularHours,
        overtimeHours: item.overtimeHours,
        entryCount: item.entryCount,
        skillTypes: item.skillTypes,
      }));
    } else if (groupBy === 'skill') {
      // Group by skill type
      groupedData = await db.collection('labour_entries').aggregate([
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
        {
          $sort: { totalCost: -1 },
        },
      ]).toArray();

      summary = await db.collection('labour_entries').aggregate([
        { $match: matchCriteria },
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

      groupedData = groupedData.map((item) => ({
        skillType: item._id,
        skillTypeLabel: item._id?.replace(/_/g, ' '),
        totalHours: item.totalHours,
        totalCost: item.totalCost,
        entryCount: item.entryCount,
        workerCount: item.uniqueWorkers?.length || 0,
      }));
    }

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

    // Get project budget info
    const projectBudget = project.budgetAllocation?.labour || {};
    const budgetAllocated = projectBudget.skilled || 0 + projectBudget.unskilled || 0 + projectBudget.supervisory || 0 + projectBudget.specialized || 0;

    // Get direct vs subcontractor breakdown
    const labourBreakdown = await getCombinedLabourSummary(projectId, null, dateFrom, dateTo);

    return successResponse(
      {
        project: {
          projectId: project._id.toString(),
          projectName: project.projectName,
          projectCode: project.projectCode,
        },
        period: {
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        },
        groupBy,
        summary: {
          totalHours: summaryData.totalHours,
          totalCost: summaryData.totalCost,
          regularHours: summaryData.regularHours || 0,
          overtimeHours: summaryData.overtimeHours || 0,
          regularCost: summaryData.regularCost || 0,
          overtimeCost: summaryData.overtimeCost || 0,
          entryCount: summaryData.entryCount,
          uniqueWorkers: summaryData.uniqueWorkers?.length || 0,
          budgetAllocated,
          budgetUsed: summaryData.totalCost,
          budgetRemaining: budgetAllocated - summaryData.totalCost,
          budgetUtilization: budgetAllocated > 0 ? (summaryData.totalCost / budgetAllocated) * 100 : 0,
        },
        labourBreakdown: {
          direct: labourBreakdown.direct,
          subcontractor: labourBreakdown.subcontractor,
          total: labourBreakdown.total,
        },
        groupedData,
      },
      'Project labour report generated successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/reports/by-project error:', error);
    return errorResponse('Failed to generate project labour report', 500);
  }
}

