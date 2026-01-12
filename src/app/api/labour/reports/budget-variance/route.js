/**
 * Budget Variance Report API Route
 * GET: Get budget variance report
 * 
 * GET /api/labour/reports/budget-variance
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/labour/reports/budget-variance
 * Get budget variance report
 * Query params: projectId, phaseId, dateFrom, dateTo
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
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!projectId && !phaseId) {
      return errorResponse('Either projectId or phaseId is required', 400);
    }

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

    let varianceData = [];

    if (phaseId) {
      // Phase-level variance
      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(phaseId),
        deletedAt: null,
      });

      if (!phase) {
        return errorResponse('Phase not found', 404);
      }

      // Get actual spending
      const actualSpending = await db.collection('labour_entries').aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: null,
            totalCost: { $sum: '$totalCost' },
            totalHours: { $sum: '$totalHours' },
          },
        },
      ]).toArray();

      const actual = actualSpending[0] || { totalCost: 0, totalHours: 0 };
      const budget = phase.budgetAllocation?.labour || {};
      const budgetAllocated =
        (budget.skilled || 0) +
        (budget.unskilled || 0) +
        (budget.supervisory || 0) +
        (budget.specialized || 0);

      const variance = actual.totalCost - budgetAllocated;
      const variancePercentage = budgetAllocated > 0 ? (variance / budgetAllocated) * 100 : 0;

      varianceData = [
        {
          level: 'phase',
          id: phase._id.toString(),
          name: phase.phaseName,
          code: phase.phaseCode,
          budgetAllocated,
          actualSpending: actual.totalCost,
          variance,
          variancePercentage,
          hours: actual.totalHours,
          budgetUtilization: budgetAllocated > 0 ? (actual.totalCost / budgetAllocated) * 100 : 0,
        },
      ];
    } else if (projectId) {
      // Project-level variance (by phase)
      const project = await db.collection('projects').findOne({
        _id: new ObjectId(projectId),
        deletedAt: null,
      });

      if (!project) {
        return errorResponse('Project not found', 404);
      }

      // Get all phases for project
      const phases = await db.collection('phases')
        .find({
          projectId: new ObjectId(projectId),
          deletedAt: null,
        })
        .toArray();

      // Calculate variance for each phase
      for (const phase of phases) {
        const phaseMatchCriteria = {
          ...matchCriteria,
          phaseId: phase._id,
        };

        const actualSpending = await db.collection('labour_entries').aggregate([
          { $match: phaseMatchCriteria },
          {
            $group: {
              _id: null,
              totalCost: { $sum: '$totalCost' },
              totalHours: { $sum: '$totalHours' },
            },
          },
        ]).toArray();

        const actual = actualSpending[0] || { totalCost: 0, totalHours: 0 };
        const budget = phase.budgetAllocation?.labour || {};
        const budgetAllocated =
          (budget.skilled || 0) +
          (budget.unskilled || 0) +
          (budget.supervisory || 0) +
          (budget.specialized || 0);

        const variance = actual.totalCost - budgetAllocated;
        const variancePercentage = budgetAllocated > 0 ? (variance / budgetAllocated) * 100 : 0;

        varianceData.push({
          level: 'phase',
          id: phase._id.toString(),
          name: phase.phaseName,
          code: phase.phaseCode,
          budgetAllocated,
          actualSpending: actual.totalCost,
          variance,
          variancePercentage,
          hours: actual.totalHours,
          budgetUtilization: budgetAllocated > 0 ? (actual.totalCost / budgetAllocated) * 100 : 0,
        });
      }

      // Calculate project total
      const projectBudget = project.budgetAllocation?.labour || {};
      const projectBudgetAllocated =
        (projectBudget.skilled || 0) +
        (projectBudget.unskilled || 0) +
        (projectBudget.supervisory || 0) +
        (projectBudget.specialized || 0);

      const projectActual = varianceData.reduce(
        (sum, item) => sum + item.actualSpending,
        0
      );
      const projectVariance = projectActual - projectBudgetAllocated;
      const projectVariancePercentage =
        projectBudgetAllocated > 0 ? (projectVariance / projectBudgetAllocated) * 100 : 0;

      varianceData.push({
        level: 'project',
        id: project._id.toString(),
        name: project.projectName,
        code: project.projectCode,
        budgetAllocated: projectBudgetAllocated,
        actualSpending: projectActual,
        variance: projectVariance,
        variancePercentage: projectVariancePercentage,
        hours: varianceData.reduce((sum, item) => sum + item.hours, 0),
        budgetUtilization:
          projectBudgetAllocated > 0 ? (projectActual / projectBudgetAllocated) * 100 : 0,
      });
    }

    // Sort by variance (worst first)
    varianceData.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

    return successResponse(
      {
        period: {
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        },
        varianceData,
        summary: {
          totalBudget: varianceData.reduce((sum, item) => sum + item.budgetAllocated, 0),
          totalActual: varianceData.reduce((sum, item) => sum + item.actualSpending, 0),
          totalVariance: varianceData.reduce((sum, item) => sum + item.variance, 0),
          overBudgetCount: varianceData.filter((item) => item.variance > 0).length,
          underBudgetCount: varianceData.filter((item) => item.variance < 0).length,
          onBudgetCount: varianceData.filter((item) => item.variance === 0).length,
        },
      },
      'Budget variance report generated successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/reports/budget-variance error:', error);
    return errorResponse('Failed to generate budget variance report', 500);
  }
}

