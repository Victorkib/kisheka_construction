/**
 * Phase Dashboard API Route
 * Returns comprehensive dashboard data for a phase
 * 
 * GET /api/phases/[id]/dashboard
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { calculatePhaseFinancialSummary } from '@/lib/schemas/phase-schema';
import { MATERIAL_APPROVED_STATUSES } from '@/lib/status-constants';
import { getPhaseWorkItemStatistics } from '@/lib/work-item-helpers';
import { getMilestoneStatistics } from '@/lib/milestone-helpers';
import { getQualityCheckpointStatistics } from '@/lib/quality-checkpoint-helpers';

/**
 * GET /api/phases/[id]/dashboard
 * Returns comprehensive dashboard data for a phase
 * Auth: All authenticated users
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

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
    
    // Get all dashboard data in parallel
    const [
      materials,
      expenses,
      workItemsStats,
      equipment,
      subcontractors,
      professionalServices,
      milestones,
      qualityCheckpoints
    ] = await Promise.all([
      // Materials count and cost
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
            _id: null,
            count: { $sum: 1 },
            totalCost: { $sum: '$totalCost' }
          }
        }
      ]).toArray(),
      
      // Expenses count and cost
      db.collection('expenses').aggregate([
        {
          $match: {
            phaseId: new ObjectId(id),
            deletedAt: null,
            status: 'APPROVED'
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalCost: { $sum: '$amount' }
          }
        }
      ]).toArray(),
      
      // Work items statistics
      getPhaseWorkItemStatistics(id),
      
      // Equipment count and cost
      db.collection('equipment').aggregate([
        {
          $match: {
            phaseId: new ObjectId(id),
            deletedAt: null,
            status: { $in: ['assigned', 'in_use'] }
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalCost: { $sum: '$totalCost' }
          }
        }
      ]).toArray(),
      
      // Subcontractors count and cost
      db.collection('subcontractors').aggregate([
        {
          $match: {
            phaseId: new ObjectId(id),
            deletedAt: null,
            status: { $in: ['active', 'completed'] }
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalCost: { $sum: '$contractValue' }
          }
        }
      ]).toArray(),
      
      // Professional services
      db.collection('professional_services').find({
        phaseId: new ObjectId(id),
        deletedAt: null,
        status: 'active'
      }).toArray(),
      
      // Milestones (from phase)
      Promise.resolve(phase.milestones || []),
      
      // Quality checkpoints (from phase)
      Promise.resolve(phase.qualityCheckpoints || [])
    ]);
    
    // Calculate milestone statistics
    const milestoneStats = getMilestoneStatistics(milestones || []);
    
    // Calculate quality checkpoint statistics
    const qualityStats = getQualityCheckpointStatistics(qualityCheckpoints || []);
    
    // Calculate financial summary
    let financialSummary;
    try {
      financialSummary = calculatePhaseFinancialSummary(phase);
    } catch (err) {
      console.error('Error calculating financial summary:', err);
      // Provide default financial summary if calculation fails
      financialSummary = {
        budgetTotal: phase.budgetAllocation?.total || 0,
        actualTotal: phase.actualSpending?.total || 0,
        committedTotal: phase.committedSpending?.total || 0,
        remaining: 0,
        variance: 0,
        variancePercentage: 0,
        utilizationPercentage: 0
      };
    }
    
    // Get recent activity (last 20 items)
    const recentActivity = await db.collection('audit_logs').find({
      projectId: phase.projectId,
      $or: [
        { 'changes.phaseId': id },
        { entityType: { $in: ['MATERIAL', 'EXPENSE', 'WORK_ITEM', 'EQUIPMENT', 'SUBCONTRACTOR', 'MILESTONE', 'QUALITY_CHECKPOINT'] } }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();
    
    // Get project info
    const project = await db.collection('projects').findOne({
      _id: phase.projectId,
      deletedAt: null
    });
    
    return successResponse({
      phase: {
        _id: phase._id,
        phaseName: phase.phaseName,
        phaseCode: phase.phaseCode,
        status: phase.status,
        completionPercentage: phase.completionPercentage || 0,
        startDate: phase.startDate,
        plannedEndDate: phase.plannedEndDate,
        actualEndDate: phase.actualEndDate,
        description: phase.description
      },
      project: project ? {
        _id: project._id,
        projectName: project.projectName,
        projectCode: project.projectCode
      } : null,
      financialSummary,
      statistics: {
        materials: {
          count: materials[0]?.count || 0,
          totalCost: materials[0]?.totalCost || 0
        },
        expenses: {
          count: expenses[0]?.count || 0,
          totalCost: expenses[0]?.totalCost || 0
        },
        workItems: {
          byStatus: workItemsStats.byStatus || {},
          total: workItemsStats.total || 0,
          completionPercentage: workItemsStats.completionPercentage || 0,
          totalEstimatedHours: workItemsStats.totalEstimatedHours || 0,
          totalActualHours: workItemsStats.totalActualHours || 0,
          totalEstimatedCost: workItemsStats.totalEstimatedCost || 0,
          totalActualCost: workItemsStats.totalActualCost || 0
        },
        equipment: {
          count: equipment[0]?.count || 0,
          totalCost: equipment[0]?.totalCost || 0
        },
        subcontractors: {
          count: subcontractors[0]?.count || 0,
          totalCost: subcontractors[0]?.totalCost || 0
        },
        professionalServices: {
          count: professionalServices.length,
          totalCost: professionalServices.reduce((sum, ps) => sum + (ps.totalFees || 0), 0)
        },
        milestones: {
          total: milestoneStats.total,
          completed: milestoneStats.completed,
          pending: milestoneStats.pending,
          overdue: milestoneStats.overdue,
          completionPercentage: milestoneStats.completionPercentage
        },
        qualityCheckpoints: {
          total: qualityStats.total,
          passed: qualityStats.passed,
          failed: qualityStats.failed,
          pending: qualityStats.pending,
          waived: qualityStats.waived,
          passRate: qualityStats.passRate
        }
      },
      recentActivity: recentActivity.map(activity => ({
        _id: activity._id,
        action: activity.action,
        entityType: activity.entityType,
        entityId: activity.entityId,
        userId: activity.userId,
        createdAt: activity.createdAt,
        changes: activity.changes
      }))
    }, 'Dashboard data retrieved successfully');
  } catch (error) {
    console.error('Get phase dashboard error:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(
      error.message || 'Failed to retrieve phase dashboard',
      500
    );
  }
}

