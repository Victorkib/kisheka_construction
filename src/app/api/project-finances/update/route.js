/**
 * Project Finances Update API Route
 * POST: Trigger manual update of project finances
 * Recalculates all financial data
 * 
 * POST /api/project-finances/update?projectId=xxx
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { calculateProjectTotals } from '@/lib/investment-allocation';
import {
  EXPENSE_APPROVED_STATUSES,
  MATERIAL_APPROVED_STATUSES,
  INITIAL_EXPENSE_APPROVED_STATUSES,
} from '@/lib/status-constants';
import { recalculateProjectFinances } from '@/lib/financial-helpers';

/**
 * POST /api/project-finances/update
 * Triggers manual recalculation of project finances
 * Auth: OWNER only
 * Query params: projectId (optional, if not provided updates all projects)
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canUpdate = await hasPermission(user.id, 'update_project_finances');
    if (!canUpdate) {
      return errorResponse('Permission denied. Only OWNER can update project finances.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const db = await getDatabase();

    // Determine which projects to update
    let projectsToUpdate = [];
    if (projectId && ObjectId.isValid(projectId)) {
      const project = await db
        .collection('projects')
        .findOne({ _id: new ObjectId(projectId) });
      if (project) {
        projectsToUpdate = [project];
      }
    } else {
      // Update all projects
      projectsToUpdate = await db.collection('projects').find({}).toArray();
    }

    const updatedProjects = [];

    for (const project of projectsToUpdate) {
      // Use recalculateProjectFinances which includes all new fields
      const updatedFinances = await recalculateProjectFinances(project._id.toString());

      updatedProjects.push({
        projectId: project._id,
        projectName: project.projectName,
        totalUsed: updatedFinances.totalUsed,
        committedCost: updatedFinances.committedCost,
        estimatedCost: updatedFinances.estimatedCost,
        availableCapital: updatedFinances.availableCapital,
        capitalBalance: updatedFinances.capitalBalance,
      });
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id,
      action: 'UPDATE_PROJECT_FINANCES',
      resourceType: 'project_finances',
      resourceId: projectId ? new ObjectId(projectId) : null,
      details: {
        projectsUpdated: updatedProjects.length,
        projectIds: updatedProjects.map((p) => p.projectId.toString()),
      },
    });

    // Calculate overall totals from all projects
    const allProjectFinances = await db
      .collection('project_finances')
      .find({})
      .toArray();
    
    const overallTotals = allProjectFinances.reduce(
      (acc, pf) => {
        acc.totalInvested += pf.totalInvested || 0;
        acc.totalLoans += pf.totalLoans || 0;
        acc.totalEquity += pf.totalEquity || 0;
        acc.totalUsed += pf.totalUsed || 0;
        return acc;
      },
      { totalInvested: 0, totalLoans: 0, totalEquity: 0, totalUsed: 0 }
    );

    return successResponse(
      {
        updated: updatedProjects.length,
        projects: updatedProjects,
        totals: overallTotals,
      },
      'Project finances updated successfully'
    );
  } catch (error) {
    console.error('Update project finances error:', error);
    return errorResponse('Failed to update project finances', 500);
  }
}

