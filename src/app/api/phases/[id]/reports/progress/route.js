/**
 * Phase Progress Report API Route
 * Returns detailed progress report data for a phase
 * 
 * GET /api/phases/[id]/reports/progress
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getPhaseWorkItemStatistics } from '@/lib/work-item-helpers';
import { getMilestoneStatistics } from '@/lib/milestone-helpers';
import { getQualityCheckpointStatistics } from '@/lib/quality-checkpoint-helpers';

/**
 * GET /api/phases/[id]/reports/progress
 * Returns detailed progress report data
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

    // Get work items statistics
    const workItemsStats = await getPhaseWorkItemStatistics(id);
    
    // Get work items by category
    const workItemsByCategory = await db.collection('work_items').aggregate([
      {
        $match: {
          phaseId: new ObjectId(id),
          deletedAt: null
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
          },
          notStarted: {
            $sum: { $cond: [{ $eq: ['$status', 'not_started'] }, 1, 0] }
          },
          blocked: {
            $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] }
          }
        }
      },
      { $sort: { total: -1 } }
    ]).toArray();

    // Get milestone statistics
    const milestoneStats = getMilestoneStatistics(phase.milestones || []);
    
    // Get quality checkpoint statistics
    const qualityStats = getQualityCheckpointStatistics(phase.qualityCheckpoints || []);

    // Calculate timeline adherence
    const now = new Date();
    const startDate = phase.startDate ? new Date(phase.startDate) : null;
    const plannedEndDate = phase.plannedEndDate ? new Date(phase.plannedEndDate) : null;
    const actualEndDate = phase.actualEndDate ? new Date(phase.actualEndDate) : null;
    
    let timelineAdherence = {
      onSchedule: false,
      aheadOfSchedule: false,
      behindSchedule: false,
      daysAhead: 0,
      daysBehind: 0,
      completionDate: null
    };

    if (startDate && plannedEndDate) {
      const totalPlannedDays = Math.ceil((plannedEndDate - startDate) / (1000 * 60 * 60 * 24));
      const elapsedDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
      const expectedProgress = (elapsedDays / totalPlannedDays) * 100;
      const actualProgress = phase.completionPercentage || 0;
      
      if (actualEndDate) {
        // Phase completed
        const actualDays = Math.ceil((actualEndDate - startDate) / (1000 * 60 * 60 * 24));
        const daysDifference = totalPlannedDays - actualDays;
        timelineAdherence = {
          onSchedule: Math.abs(daysDifference) <= 3,
          aheadOfSchedule: daysDifference > 3,
          behindSchedule: daysDifference < -3,
          daysAhead: daysDifference > 0 ? daysDifference : 0,
          daysBehind: daysDifference < 0 ? Math.abs(daysDifference) : 0,
          completionDate: actualEndDate
        };
      } else {
        // Phase in progress
        const progressDifference = actualProgress - expectedProgress;
        const daysDifference = Math.round((progressDifference / 100) * totalPlannedDays);
        timelineAdherence = {
          onSchedule: Math.abs(progressDifference) <= 5,
          aheadOfSchedule: progressDifference > 5,
          behindSchedule: progressDifference < -5,
          daysAhead: daysDifference > 0 ? daysDifference : 0,
          daysBehind: daysDifference < 0 ? Math.abs(daysDifference) : 0,
          completionDate: null
        };
      }
    }

    // Get work items timeline data
    const workItemsTimeline = await db.collection('work_items').find({
      phaseId: new ObjectId(id),
      deletedAt: null
    }, {
      projection: {
        name: 1,
        status: 1,
        startDate: 1,
        plannedEndDate: 1,
        actualEndDate: 1,
        category: 1,
        priority: 1
      }
    }).sort({ priority: 1, createdAt: 1 }).toArray();

    return successResponse({
      phase: {
        _id: phase._id,
        phaseName: phase.phaseName,
        phaseCode: phase.phaseCode,
        status: phase.status,
        completionPercentage: phase.completionPercentage || 0,
        startDate: phase.startDate,
        plannedEndDate: phase.plannedEndDate,
        actualEndDate: phase.actualEndDate
      },
      overallProgress: {
        completionPercentage: phase.completionPercentage || 0,
        status: phase.status,
        startDate: phase.startDate,
        plannedEndDate: phase.plannedEndDate,
        actualEndDate: phase.actualEndDate
      },
      workItems: {
        statistics: workItemsStats,
        byCategory: workItemsByCategory.map(item => ({
          category: item._id || 'Other',
          total: item.total,
          completed: item.completed,
          inProgress: item.inProgress,
          notStarted: item.notStarted,
          blocked: item.blocked,
          completionPercentage: item.total > 0 
            ? Math.round((item.completed / item.total) * 100)
            : 0
        })),
        timeline: workItemsTimeline
      },
      milestones: {
        statistics: milestoneStats,
        list: phase.milestones || []
      },
      qualityCheckpoints: {
        statistics: qualityStats,
        list: phase.qualityCheckpoints || []
      },
      timelineAdherence
    }, 'Progress report data retrieved successfully');
  } catch (error) {
    console.error('Get progress report error:', error);
    return errorResponse('Failed to retrieve progress report', 500);
  }
}


