/**
 * Phase-Level Labour Report API Route
 * GET: Get labour report for a phase
 * 
 * GET /api/labour/reports/by-phase
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getCombinedLabourSummary } from '@/lib/subcontractor-labour-helpers';

/**
 * GET /api/labour/reports/by-phase
 * Get phase-level labour report
 * Query params: phaseId, dateFrom, dateTo, groupBy (worker|skill|floor|category)
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
    const phaseId = searchParams.get('phaseId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const groupBy = searchParams.get('groupBy') || 'worker'; // worker, skill, floor, category

    if (!phaseId || !ObjectId.isValid(phaseId)) {
      return errorResponse('Valid phaseId is required', 400);
    }

    const db = await getDatabase();

    // Verify phase exists
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(phaseId),
      deletedAt: null,
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    // Get project info
    const project = await db.collection('projects').findOne({
      _id: phase.projectId,
      deletedAt: null,
    });

    // Build match criteria
    const matchCriteria = {
      phaseId: new ObjectId(phaseId),
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

    if (groupBy === 'worker') {
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
        { $sort: { totalCost: -1 } },
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
        { $sort: { totalCost: -1 } },
      ]).toArray();

      groupedData = groupedData.map((item) => ({
        skillType: item._id,
        skillTypeLabel: item._id?.replace(/_/g, ' '),
        totalHours: item.totalHours,
        totalCost: item.totalCost,
        entryCount: item.entryCount,
        workerCount: item.uniqueWorkers?.length || 0,
      }));
    } else if (groupBy === 'floor') {
      groupedData = await db.collection('labour_entries').aggregate([
        { $match: { ...matchCriteria, floorId: { $ne: null } } },
        {
          $group: {
            _id: '$floorId',
            totalHours: { $sum: '$totalHours' },
            totalCost: { $sum: '$totalCost' },
            entryCount: { $sum: 1 },
            uniqueWorkers: { $addToSet: '$workerName' },
          },
        },
        {
          $lookup: {
            from: 'floors',
            localField: '_id',
            foreignField: '_id',
            as: 'floor',
          },
        },
        {
          $unwind: {
            path: '$floor',
            preserveNullAndEmptyArrays: true,
          },
        },
        { $sort: { totalCost: -1 } },
      ]).toArray();

      groupedData = groupedData.map((item) => ({
        floorId: item._id?.toString(),
        floorName: item.floor?.floorName || 'Unknown',
        floorNumber: item.floor?.floorNumber || 0,
        totalHours: item.totalHours,
        totalCost: item.totalCost,
        entryCount: item.entryCount,
        workerCount: item.uniqueWorkers?.length || 0,
      }));
    } else if (groupBy === 'category') {
      groupedData = await db.collection('labour_entries').aggregate([
        { $match: { ...matchCriteria, categoryId: { $ne: null } } },
        {
          $group: {
            _id: '$categoryId',
            totalHours: { $sum: '$totalHours' },
            totalCost: { $sum: '$totalCost' },
            entryCount: { $sum: 1 },
            uniqueWorkers: { $addToSet: '$workerName' },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category',
          },
        },
        {
          $unwind: {
            path: '$category',
            preserveNullAndEmptyArrays: true,
          },
        },
        { $sort: { totalCost: -1 } },
      ]).toArray();

      groupedData = groupedData.map((item) => ({
        categoryId: item._id?.toString(),
        categoryName: item.category?.categoryName || 'Unknown',
        totalHours: item.totalHours,
        totalCost: item.totalCost,
        entryCount: item.entryCount,
        workerCount: item.uniqueWorkers?.length || 0,
      }));
    }

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

    // Get phase budget
    const phaseBudget = phase.budgetAllocation?.labour || {};
    const budgetAllocated = phaseBudget.skilled || 0 + phaseBudget.unskilled || 0 + phaseBudget.supervisory || 0 + phaseBudget.specialized || 0;

    // Get direct vs subcontractor breakdown
    const labourBreakdown = await getCombinedLabourSummary(projectId, phaseId, dateFrom, dateTo);

    return successResponse(
      {
        project: project
          ? {
              projectId: project._id.toString(),
              projectName: project.projectName,
              projectCode: project.projectCode,
            }
          : null,
        phase: {
          phaseId: phase._id.toString(),
          phaseName: phase.phaseName,
          phaseCode: phase.phaseCode,
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
      'Phase labour report generated successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/reports/by-phase error:', error);
    return errorResponse('Failed to generate phase labour report', 500);
  }
}

