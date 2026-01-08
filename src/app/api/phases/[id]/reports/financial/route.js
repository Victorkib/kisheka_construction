/**
 * Phase Financial Report API Route
 * Returns detailed financial report data for a phase
 * 
 * GET /api/phases/[id]/reports/financial
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { calculatePhaseFinancialSummary } from '@/lib/schemas/phase-schema';
import { MATERIAL_APPROVED_STATUSES } from '@/lib/status-constants';
import { calculatePhaseEquipmentCost } from '@/lib/equipment-helpers';
import { calculatePhaseSubcontractorCost } from '@/lib/subcontractor-helpers';

/**
 * GET /api/phases/[id]/reports/financial
 * Returns detailed financial report data
 * Auth: All authenticated users
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const db = await getDatabase();
    
    // Get phase
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });
    
    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    // Get financial breakdown by category
    const [
      materialsBreakdown,
      expensesBreakdown,
      equipmentBreakdown,
      subcontractorsBreakdown,
      professionalServicesBreakdown
    ] = await Promise.all([
      // Materials breakdown
      db.collection('materials').aggregate([
        {
          $match: {
            phaseId: new ObjectId(id),
            deletedAt: null,
            status: { $in: MATERIAL_APPROVED_STATUSES }
          }
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalCost: { $sum: '$totalCost' }
          }
        },
        { $sort: { totalCost: -1 } }
      ]).toArray(),

      // Expenses breakdown by category (exclude indirect costs)
      db.collection('expenses').aggregate([
        {
          $match: {
            phaseId: new ObjectId(id),
            deletedAt: null,
            status: 'APPROVED',
            $or: [
              { isIndirectCost: { $exists: false } },
              { isIndirectCost: false }
            ]
          }
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalCost: { $sum: '$amount' }
          }
        },
        { $sort: { totalCost: -1 } }
      ]).toArray(),

      // Equipment breakdown by type
      db.collection('equipment').aggregate([
        {
          $match: {
            phaseId: new ObjectId(id),
            deletedAt: null
          }
        },
        {
          $group: {
            _id: '$equipmentType',
            count: { $sum: 1 },
            totalCost: { $sum: '$totalCost' }
          }
        },
        { $sort: { totalCost: -1 } }
      ]).toArray(),

      // Subcontractors breakdown by type
      db.collection('subcontractors').aggregate([
        {
          $match: {
            phaseId: new ObjectId(id),
            deletedAt: null
          }
        },
        {
          $group: {
            _id: '$subcontractorType',
            count: { $sum: 1 },
            totalCost: { $sum: '$contractValue' }
          }
        },
        { $sort: { totalCost: -1 } }
      ]).toArray(),

      // Professional services breakdown
      db.collection('professional_services').aggregate([
        {
          $match: {
            phaseId: new ObjectId(id),
            deletedAt: null
          }
        },
        {
          $group: {
            _id: '$serviceType',
            count: { $sum: 1 },
            totalCost: { $sum: '$totalFees' }
          }
        },
        { $sort: { totalCost: -1 } }
      ]).toArray()
    ]);

    // Calculate financial summary
    const financialSummary = calculatePhaseFinancialSummary(phase);

    // Get cost trends (monthly breakdown)
    const materialsByMonth = await db.collection('materials').aggregate([
      {
        $match: {
          phaseId: new ObjectId(id),
          deletedAt: null,
          status: { $in: MATERIAL_APPROVED_STATUSES }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalCost: { $sum: '$totalCost' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]).toArray();

    const expensesByMonth = await db.collection('expenses').aggregate([
      {
        $match: {
          phaseId: new ObjectId(id),
          deletedAt: null,
          status: 'APPROVED'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalCost: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]).toArray();

    return successResponse({
      phase: {
        _id: phase._id,
        phaseName: phase.phaseName,
        phaseCode: phase.phaseCode
      },
      financialSummary,
      budgetAllocation: phase.budgetAllocation || {},
      breakdown: {
        materials: {
          total: financialSummary.actualTotal - (financialSummary.actualTotal - (phase.actualSpending?.materials || 0)),
          byCategory: materialsBreakdown.map(item => ({
            category: item._id || 'Uncategorized',
            count: item.count,
            totalCost: item.totalCost,
            percentage: financialSummary.actualTotal > 0 
              ? ((item.totalCost / financialSummary.actualTotal) * 100).toFixed(2)
              : 0
          }))
        },
        expenses: {
          total: phase.actualSpending?.expenses || 0,
          byCategory: expensesBreakdown.map(item => ({
            category: item._id || 'Uncategorized',
            count: item.count,
            totalCost: item.totalCost,
            percentage: financialSummary.actualTotal > 0 
              ? ((item.totalCost / financialSummary.actualTotal) * 100).toFixed(2)
              : 0
          }))
        },
        equipment: {
          total: phase.actualSpending?.equipment || 0,
          byType: equipmentBreakdown.map(item => ({
            type: item._id || 'Unknown',
            count: item.count,
            totalCost: item.totalCost,
            percentage: financialSummary.actualTotal > 0 
              ? ((item.totalCost / financialSummary.actualTotal) * 100).toFixed(2)
              : 0
          }))
        },
        subcontractors: {
          total: phase.actualSpending?.subcontractors || 0,
          byType: subcontractorsBreakdown.map(item => ({
            type: item._id || 'Unknown',
            count: item.count,
            totalCost: item.totalCost,
            percentage: financialSummary.actualTotal > 0 
              ? ((item.totalCost / financialSummary.actualTotal) * 100).toFixed(2)
              : 0
          }))
        },
        professionalServices: {
          total: phase.actualSpending?.professionalServices || 0,
          byType: professionalServicesBreakdown.map(item => ({
            type: item._id || 'Unknown',
            count: item.count,
            totalCost: item.totalCost,
            percentage: financialSummary.actualTotal > 0 
              ? ((item.totalCost / financialSummary.actualTotal) * 100).toFixed(2)
              : 0
          }))
        }
      },
      trends: {
        materials: materialsByMonth.map(item => ({
          period: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
          totalCost: item.totalCost,
          count: item.count
        })),
        expenses: expensesByMonth.map(item => ({
          period: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
          totalCost: item.totalCost,
          count: item.count
        }))
      },
      variance: {
        byCategory: {
          materials: {
            budgeted: phase.budgetAllocation?.materials || 0,
            actual: phase.actualSpending?.materials || 0,
            variance: (phase.actualSpending?.materials || 0) - (phase.budgetAllocation?.materials || 0),
            variancePercentage: (phase.budgetAllocation?.materials || 0) > 0
              ? (((phase.actualSpending?.materials || 0) - (phase.budgetAllocation?.materials || 0)) / (phase.budgetAllocation?.materials || 0) * 100).toFixed(2)
              : 0
          },
          expenses: {
            budgeted: phase.budgetAllocation?.expenses || 0,
            actual: phase.actualSpending?.expenses || 0,
            variance: (phase.actualSpending?.expenses || 0) - (phase.budgetAllocation?.expenses || 0),
            variancePercentage: (phase.budgetAllocation?.expenses || 0) > 0
              ? (((phase.actualSpending?.expenses || 0) - (phase.budgetAllocation?.expenses || 0)) / (phase.budgetAllocation?.expenses || 0) * 100).toFixed(2)
              : 0
          },
          equipment: {
            budgeted: phase.budgetAllocation?.equipment || 0,
            actual: phase.actualSpending?.equipment || 0,
            variance: (phase.actualSpending?.equipment || 0) - (phase.budgetAllocation?.equipment || 0),
            variancePercentage: (phase.budgetAllocation?.equipment || 0) > 0
              ? (((phase.actualSpending?.equipment || 0) - (phase.budgetAllocation?.equipment || 0)) / (phase.budgetAllocation?.equipment || 0) * 100).toFixed(2)
              : 0
          },
          subcontractors: {
            budgeted: phase.budgetAllocation?.subcontractors || 0,
            actual: phase.actualSpending?.subcontractors || 0,
            variance: (phase.actualSpending?.subcontractors || 0) - (phase.budgetAllocation?.subcontractors || 0),
            variancePercentage: (phase.budgetAllocation?.subcontractors || 0) > 0
              ? (((phase.actualSpending?.subcontractors || 0) - (phase.budgetAllocation?.subcontractors || 0)) / (phase.budgetAllocation?.subcontractors || 0) * 100).toFixed(2)
              : 0
          }
        }
      }
    }, 'Financial report data retrieved successfully');
  } catch (error) {
    console.error('Get financial report error:', error);
    return errorResponse('Failed to retrieve financial report', 500);
  }
}


