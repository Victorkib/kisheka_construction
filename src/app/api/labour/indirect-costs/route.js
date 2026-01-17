/**
 * Indirect Labour Costs API Route
 * GET: Get indirect labour costs breakdown by category
 * 
 * GET /api/labour/indirect-costs
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/labour/indirect-costs
 * Get indirect labour costs breakdown by category
 * Query params: projectId, startDate, endDate
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

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

    // Build query for indirect labour entries
    const query = {
      projectId: new ObjectId(projectId),
      deletedAt: null,
      isIndirectLabour: true,
      indirectCostCategory: { $exists: true, $ne: null },
      status: { $in: ['approved', 'paid', 'APPROVED', 'PAID'] }
    };

    // Add date filters if provided
    if (startDate || endDate) {
      query.entryDate = {};
      if (startDate) {
        query.entryDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.entryDate.$lte = new Date(endDate);
      }
    }

    // Get labour entries grouped by category
    const labourByCategory = await db.collection('labour_entries').aggregate([
      { $match: query },
      {
        $group: {
          _id: '$indirectCostCategory',
          total: { $sum: '$totalCost' },
          count: { $sum: 1 },
          entries: {
            $push: {
              _id: '$_id',
              workerName: '$workerName',
              totalHours: '$totalHours',
              totalCost: '$totalCost',
              entryDate: '$entryDate',
              taskDescription: '$taskDescription'
            }
          }
        }
      },
      { $sort: { total: -1 } }
    ]).toArray();

    // Get total indirect labour costs
    const totalLabourResult = await db.collection('labour_entries').aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalCost' },
          totalHours: { $sum: '$totalHours' },
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const totalLabour = totalLabourResult[0] || { total: 0, totalHours: 0, count: 0 };

    // Initialize all categories
    const categoriesData = {
      utilities: { total: 0, count: 0, entries: [] },
      siteOverhead: { total: 0, count: 0, entries: [] },
      transportation: { total: 0, count: 0, entries: [] },
      safetyCompliance: { total: 0, count: 0, entries: [] }
    };

    // Fill in actual data
    labourByCategory.forEach(cat => {
      if (categoriesData.hasOwnProperty(cat._id)) {
        categoriesData[cat._id] = {
          total: cat.total,
          count: cat.count,
          entries: cat.entries
        };
      }
    });

    return successResponse({
      project: {
        _id: project._id.toString(),
        projectCode: project.projectCode,
        projectName: project.projectName,
      },
      summary: {
        totalCost: totalLabour.total,
        totalHours: totalLabour.totalHours,
        entryCount: totalLabour.count,
      },
      byCategory: categoriesData,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null
      }
    }, 'Indirect labour costs retrieved successfully');
  } catch (error) {
    console.error('Get indirect labour costs error:', error);
    return errorResponse('Failed to retrieve indirect labour costs', 500);
  }
}
