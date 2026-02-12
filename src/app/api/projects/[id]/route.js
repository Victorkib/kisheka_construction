/**
 * Project Detail API Route
 * GET: Get single project
 * PATCH: Update project
 * 
 * GET /api/projects/[id]
 * PATCH /api/projects/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getProjectSpendingLimit, recalculateProjectFinances, getCurrentTotalUsed } from '@/lib/financial-helpers';
import { returnCapitalToInvestors } from '@/lib/financial-rollback';
import { calculateProjectTotals } from '@/lib/investment-allocation';
import { isEnhancedBudget, createEnhancedBudget, validateBudget, getBudgetTotal, convertLegacyToEnhanced } from '@/lib/schemas/budget-schema';
import { calculateTotalPhaseBudgets, rescalePhaseBudgetsForProject } from '@/lib/phase-helpers';
import { supportsTransactions } from '@/lib/mongodb/transaction-helpers';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]
 * Returns a single project by ID with summary statistics
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
      return errorResponse('Invalid project ID', 400);
    }

    const db = await getDatabase();
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Get project statistics
    const materialsCount = await db.collection('materials').countDocuments({
      projectId: new ObjectId(id),
      deletedAt: null,
    });

    const expensesCount = await db.collection('expenses').countDocuments({
      projectId: new ObjectId(id),
    });

    // Calculate total spent from materials
    const materialsSpent = await db
      .collection('materials')
      .aggregate([
        {
          $match: {
            projectId: new ObjectId(id),
            deletedAt: null,
            status: { $in: ['approved', 'received'] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalCost' },
          },
        },
      ])
      .toArray();

    const totalMaterialsSpent = materialsSpent[0]?.total || 0;

    // Get professional services statistics
    let professionalServicesStats = null;
    try {
      const { calculateProjectProfessionalServicesStats } = await import('@/lib/professional-services-helpers');
      professionalServicesStats = await calculateProjectProfessionalServicesStats(id);
    } catch (err) {
      console.error(`Error calculating professional services statistics for project ${id}:`, err);
    }

    // Calculate financial statistics from allocations
    let financialStats = {
      totalInvested: 0,
      capitalBalance: 0,
      totalUsed: 0,
      budgetVsCapitalWarning: null,
    };

    try {
      const projectTotals = await calculateProjectTotals(id);
      const totalInvested = projectTotals.totalInvested || 0;
      
      // Get project finances for accurate capital balance and total used
      const projectFinances = await db
        .collection('project_finances')
        .findOne({ projectId: new ObjectId(id) });
      
      // If project_finances exists, use it; otherwise calculate on the fly
      if (projectFinances) {
        financialStats = {
          totalInvested: projectFinances.totalInvested || totalInvested,
          capitalBalance: projectFinances.capitalBalance || (totalInvested - (projectFinances.totalUsed || 0)),
          totalUsed: projectFinances.totalUsed || 0,
          budgetVsCapitalWarning: project.budget?.total > (projectFinances.totalInvested || totalInvested) && (projectFinances.totalInvested || totalInvested) > 0
            ? `Budget (${project.budget.total.toLocaleString()}) exceeds capital (${(projectFinances.totalInvested || totalInvested).toLocaleString()})`
            : null,
        };
      } else {
        // Calculate on the fly if project_finances doesn't exist
        const totalUsed = await getCurrentTotalUsed(id);
        financialStats = {
          totalInvested,
          capitalBalance: totalInvested - totalUsed,
          totalUsed,
          budgetVsCapitalWarning: project.budget?.total > totalInvested && totalInvested > 0
            ? `Budget (${project.budget.total.toLocaleString()}) exceeds capital (${totalInvested.toLocaleString()})`
            : null,
        };
      }
    } catch (err) {
      console.error(`Error calculating financial statistics for project ${id}:`, err);
      // Use defaults if calculation fails
    }

    return successResponse({
      ...project,
      statistics: {
        materialsCount,
        expensesCount,
        totalMaterialsSpent,
        budgetRemaining: (project.budget?.total || 0) - totalMaterialsSpent,
        // Add financial statistics
        ...financialStats,
        // Add professional services statistics
        professionalServices: professionalServicesStats,
      },
    });
  } catch (error) {
    console.error('Get project error:', error);
    return errorResponse('Failed to retrieve project', 500);
  }
}

/**
 * PATCH /api/projects/[id]
 * Updates project details
 * Auth: OWNER, PM only
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const transactionsSupported = await supportsTransactions();
    if (!transactionsSupported) {
      return errorResponse(
        'Project deletion requires database transactions. Enable a replica set to proceed.',
        503
      );
    }

    const userRole = userProfile.role?.toLowerCase();
    const canEdit = ['owner', 'pm', 'project_manager'].includes(userRole);
    if (!canEdit) {
      return errorResponse('Insufficient permissions. Only OWNER and PM can edit projects.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const body = await request.json();
    const {
      projectName,
      description,
      location,
      client,
      status,
      startDate,
      plannedEndDate,
      actualEndDate,
      budget,
      siteManager,
      teamMembers,
      reallocatePhases, // Phase 2: Flag to rescale phase budgets when DCC changes
    } = body;

    const db = await getDatabase();

    // Get existing project
    const existingProject = await db.collection('projects').findOne({
      _id: new ObjectId(id),
    });

    if (!existingProject) {
      return errorResponse('Project not found', 404);
    }

    // Build update object and track changes
    const updateData = {
      updatedAt: new Date(),
    };
    const changes = {};

    if (projectName !== undefined) {
      updateData.projectName = projectName.trim();
      changes.projectName = {
        oldValue: existingProject.projectName,
        newValue: updateData.projectName,
      };
    }

    if (description !== undefined) {
      updateData.description = description.trim();
    }

    if (location !== undefined) {
      updateData.location = location.trim();
    }

    if (client !== undefined) {
      updateData.client = client.trim();
    }

    if (status && ['planning', 'active', 'paused', 'completed', 'archived'].includes(status)) {
      updateData.status = status;
      changes.status = {
        oldValue: existingProject.status,
        newValue: status,
      };
    }

    if (startDate) {
      updateData.startDate = new Date(startDate);
    }

    if (plannedEndDate) {
      updateData.plannedEndDate = new Date(plannedEndDate);
    }

    if (actualEndDate) {
      updateData.actualEndDate = new Date(actualEndDate);
    }

    if (budget) {
      // All budgets must be in enhanced structure
      // If legacy structure is provided, convert it immediately
      let enhancedBudget;
      
      if (isEnhancedBudget(budget)) {
        // Validate enhanced budget
        const validation = validateBudget(budget);
        if (!validation.isValid) {
          return errorResponse(`Invalid budget: ${validation.errors.join(', ')}`, 400);
        }
        
        // Use provided enhanced budget
        enhancedBudget = createEnhancedBudget(budget);
      } else if (budget.materials !== undefined || budget.labour !== undefined || budget.contingency !== undefined) {
        // Legacy structure detected - convert to enhanced
        // This should not happen in normal flow, but handle gracefully
        console.warn('Legacy budget structure detected during project update. Converting to enhanced structure.');
        enhancedBudget = convertLegacyToEnhanced({
          total: budget.total || 0,
          materials: budget.materials || 0,
          labour: budget.labour || 0,
          contingency: budget.contingency || 0,
          spent: 0
        });
      } else {
        // Budget object provided but not in expected format - merge with existing
        enhancedBudget = createEnhancedBudget({
          total: budget.total !== undefined ? budget.total : (existingProject.budget?.total || 0),
          directConstructionCosts: budget.directConstructionCosts !== undefined ? budget.directConstructionCosts : (existingProject.budget?.directConstructionCosts || 0),
          preConstructionCosts: budget.preConstructionCosts !== undefined ? budget.preConstructionCosts : (existingProject.budget?.preConstructionCosts || 0),
          indirectCosts: budget.indirectCosts !== undefined ? budget.indirectCosts : (existingProject.budget?.indirectCosts || 0),
          contingencyReserve: budget.contingencyReserve !== undefined ? budget.contingencyReserve : (existingProject.budget?.contingencyReserve || 0)
        });
      }
      
      // Merge with existing budget, preserving enhanced structure
      updateData.budget = {
        ...existingProject.budget,
        ...enhancedBudget,
        // Ensure all enhanced structure fields are present
        directCosts: enhancedBudget.directCosts || existingProject.budget?.directCosts,
        preConstruction: enhancedBudget.preConstruction || existingProject.budget?.preConstruction,
        indirect: enhancedBudget.indirect || existingProject.budget?.indirect,
        contingency: enhancedBudget.contingency || existingProject.budget?.contingency,
        // Maintain legacy compatibility fields for backward compatibility with existing code
        materials: enhancedBudget.directCosts?.materials?.total || enhancedBudget.materials || existingProject.budget?.materials || 0,
        labour: enhancedBudget.directCosts?.labour?.total || enhancedBudget.labour || existingProject.budget?.labour || 0,
        contingency: enhancedBudget.contingency?.total || enhancedBudget.contingencyReserve || existingProject.budget?.contingency || 0,
      };

      // Validate that total phase budgets don't exceed the new project budget
      try {
        const newProjectBudget = getBudgetTotal(updateData.budget);
        const totalPhaseBudgets = await calculateTotalPhaseBudgets(id);
        
        if (totalPhaseBudgets > newProjectBudget) {
          return errorResponse(
            `Cannot update project budget: Total phase budgets (${totalPhaseBudgets.toLocaleString()}) exceed the new project budget (${newProjectBudget.toLocaleString()}). Please reduce phase budgets first or increase the project budget.`,
            400
          );
        }
      } catch (phaseBudgetError) {
        console.error('Error validating phase budgets against project budget:', phaseBudgetError);
        // Don't fail the update if validation check fails, but log it
      }
    }

    if (siteManager && ObjectId.isValid(siteManager)) {
      updateData.siteManager = new ObjectId(siteManager);
    }

    if (teamMembers && Array.isArray(teamMembers)) {
      updateData.teamMembers = teamMembers
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));
    }

    // Update project
    const result = await db.collection('projects').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    // LATE ACTIVATION: Capture budget activation if budget is being set for the first time
    if (budget && result.value) {
      const { needsBudgetActivation, captureProjectBudgetActivation } = await import('@/lib/activation-helpers');
      if (needsBudgetActivation(existingProject, updateData.budget)) {
        try {
          await captureProjectBudgetActivation(id);
          console.log(`[Project Update] Budget activation captured for project ${id}`);
        } catch (activationError) {
          console.error('Error capturing budget activation during project update:', activationError);
          // Don't fail project update if activation capture fails
        }
      }
    }

    // PHASE 2: Rescale phase budgets if DCC changed and reallocatePhases flag is set
    let phaseRescaleResult = null;
    if (budget && reallocatePhases === true && result.value) {
      try {
        // Get old and new DCC values
        const existingBudget = existingProject.budget || {};
        const newBudget = updateData.budget || {};
        
        let oldDcc = 0;
        let newDcc = 0;
        
        if (isEnhancedBudget(existingBudget)) {
          oldDcc = existingBudget.directConstructionCosts || 0;
        } else {
          // Legacy budget - estimate DCC
          const oldTotal = getBudgetTotal(existingBudget);
          const estimatedPreConstruction = oldTotal * 0.05;
          const estimatedIndirect = oldTotal * 0.05;
          const estimatedContingency = existingBudget.contingency || (oldTotal * 0.05);
          oldDcc = Math.max(0, oldTotal - estimatedPreConstruction - estimatedIndirect - estimatedContingency);
        }
        
        if (isEnhancedBudget(newBudget)) {
          newDcc = newBudget.directConstructionCosts || 0;
        } else {
          // Legacy budget - estimate DCC
          const newTotal = getBudgetTotal(newBudget);
          const estimatedPreConstruction = newTotal * 0.05;
          const estimatedIndirect = newTotal * 0.05;
          const estimatedContingency = newBudget.contingency || (newTotal * 0.05);
          newDcc = Math.max(0, newTotal - estimatedPreConstruction - estimatedIndirect - estimatedContingency);
        }
        
        // Only rescale if DCC actually changed and both values are > 0
        if (oldDcc > 0 && newDcc > 0 && oldDcc !== newDcc) {
          phaseRescaleResult = await rescalePhaseBudgetsForProject(
            id,
            oldDcc,
            newDcc,
            userProfile._id.toString()
          );
          console.log(`[Project Update] Phase budgets rescaled for project ${id}. Rescaled ${phaseRescaleResult.rescaled} phases.`);
        }
      } catch (rescaleError) {
        console.error('Error rescaling phase budgets during project update:', rescaleError);
        // Don't fail project update if rescale fails, but log it
        // The user can manually adjust phase budgets if needed
      }
    }

    // Create audit log
    if (Object.keys(changes).length > 0) {
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'UPDATED',
        entityType: 'PROJECT',
        entityId: id,
        changes,
      });
    }

    // Check for budget vs capital warning (if budget was updated)
    let warning = null;
    if (budget && result.value) {
      try {
        const spendingLimit = await getProjectSpendingLimit(id);
        if (spendingLimit.budgetExcess > 0) {
          warning = `Budget (${spendingLimit.budget.toLocaleString()}) exceeds available capital (${spendingLimit.capital.toLocaleString()}) by ${spendingLimit.budgetExcess.toLocaleString()}. Actual spending limit is based on capital, not budget.`;
        }
      } catch (error) {
        // Don't fail the update if warning check fails
        console.error('Error checking budget vs capital:', error);
      }
    }

    const responseData = { ...result.value };
    if (warning) {
      responseData._warning = warning;
    }
    if (phaseRescaleResult) {
      responseData._phaseRescale = phaseRescaleResult;
    }

    let successMessage = 'Project updated successfully';
    if (warning) {
      successMessage += `. Warning: ${warning}`;
    }
    if (phaseRescaleResult && phaseRescaleResult.rescaled > 0) {
      successMessage += `. Phase budgets rescaled: ${phaseRescaleResult.rescaled} phases updated.`;
    }

    return successResponse(responseData, successMessage);
  } catch (error) {
    console.error('Update project error:', error);
    return errorResponse('Failed to update project', 500);
  }
}

/**
 * DELETE /api/projects/[id]
 * Permanently deletes a project with comprehensive dependency handling and financial rollback
 * Auth: OWNER only
 * 
 * Query params:
 * - force: boolean - If true, bypasses spending check (use with caution)
 * 
 * Handles:
 * - Investor allocations removal
 * - Financial rollback (returns unused capital to investors)
 * - Hard delete of related entities (materials, expenses, initial expenses)
 * - Floor deletion
 * - Project finances deletion
 * - Financial recalculation for affected projects
 * 
 * Note: For archiving (soft delete), use POST /api/projects/[id]/archive
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can delete projects
    const hasDeletePermission = await hasPermission(user.id, 'delete_project');
    if (!hasDeletePermission) {
      return errorResponse('Insufficient permissions. Only OWNER can delete projects.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);

    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Get existing project
    const existingProject = await db.collection('projects').findOne({
      _id: new ObjectId(id),
    });

    if (!existingProject) {
      return errorResponse('Project not found', 404);
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // Check if project is already archived or deleted
    if (existingProject.status === 'archived' && !force) {
      return errorResponse('Project is archived. Add ?force=true to delete permanently from archive.', 400);
    }

    // Get project finances to check spending
    const projectFinances = await db
      .collection('project_finances')
      .findOne({ projectId: new ObjectId(id) });

    const totalUsed = projectFinances?.totalUsed || await getCurrentTotalUsed(id);
    const totalInvested = projectFinances?.totalInvested || 0;
    const capitalBalance = totalInvested - totalUsed;
    const hasSpending = totalUsed > 0;

    // Check dependencies - COMPREHENSIVE: All project-related collections
    const projectObjectId = new ObjectId(id);
    const [
      materialsCount,
      expensesCount,
      initialExpensesCount,
      floorsCount,
      phasesCount,
      workItemsCount,
      labourEntriesCount,
      labourBatchesCount,
      labourCostSummariesCount,
      materialRequestsCount,
      materialRequestBatchesCount,
      purchaseOrdersCount,
      equipmentCount,
      subcontractorsCount,
      professionalServicesCount,
      professionalFeesCount,
      professionalActivitiesCount,
      siteReportsCount,
      supervisorSubmissionsCount,
      budgetReallocationsCount,
      budgetAdjustmentsCount,
      budgetTransfersCount,
      contingencyDrawsCount,
      approvalsCount,
      membershipsCount,
      teamLinksCount,
      notificationsCount,
      auditLogsCount,
      scheduledReportsCount, // CRITICAL: Added missing scheduled_reports dependency
    ] = await Promise.all([
      db.collection('materials').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('expenses').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('initial_expenses').countDocuments({ projectId: projectObjectId, status: { $ne: 'deleted' } }),
      db.collection('floors').countDocuments({ projectId: projectObjectId }),
      db.collection('phases').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('work_items').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('labour_entries').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('labour_batches').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('labour_cost_summaries').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('material_requests').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('material_request_batches').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('purchase_orders').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('equipment').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('subcontractors').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('professional_services').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('professional_fees').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('professional_activities').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('site_reports').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('supervisor_submissions').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('budget_reallocations').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('budget_adjustments').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('budget_transfers').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('contingency_draws').countDocuments({ projectId: projectObjectId, deletedAt: null }),
      db.collection('approvals').countDocuments({ projectId: projectObjectId }),
      db.collection('project_memberships').countDocuments({ projectId: projectObjectId }),
      db.collection('project_teams').countDocuments({ projectId: projectObjectId }),
      db.collection('notifications').countDocuments({ projectId: projectObjectId }),
      db.collection('audit_logs').countDocuments({ projectId: projectObjectId }),
      db.collection('scheduled_reports').countDocuments({ projectId: projectObjectId, deletedAt: null }), // CRITICAL FIX: Added missing dependency
    ]);

    // Get investors with allocations to this project
    const investorsWithAllocations = await db
      .collection('investors')
      .find({
        status: 'ACTIVE',
        'projectAllocations.projectId': new ObjectId(id),
      })
      .toArray();

    const allocationsCount = investorsWithAllocations.length;

    // Build dependency summary for audit log
    const dependencySummary = {
      materials: materialsCount,
      expenses: expensesCount,
      initialExpenses: initialExpensesCount,
      floors: floorsCount,
      phases: phasesCount,
      workItems: workItemsCount,
      labourEntries: labourEntriesCount,
      labourBatches: labourBatchesCount,
      labourCostSummaries: labourCostSummariesCount,
      materialRequests: materialRequestsCount,
      materialRequestBatches: materialRequestBatchesCount,
      purchaseOrders: purchaseOrdersCount,
      equipment: equipmentCount,
      subcontractors: subcontractorsCount,
      professionalServices: professionalServicesCount,
      professionalFees: professionalFeesCount,
      professionalActivities: professionalActivitiesCount,
      siteReports: siteReportsCount,
      supervisorSubmissions: supervisorSubmissionsCount,
      budgetReallocations: budgetReallocationsCount,
      budgetAdjustments: budgetAdjustmentsCount,
      budgetTransfers: budgetTransfersCount,
      contingencyDraws: contingencyDrawsCount,
      approvals: approvalsCount,
      projectMemberships: membershipsCount,
      projectTeams: teamLinksCount,
      notifications: notificationsCount,
      auditLogs: auditLogsCount,
      scheduledReports: scheduledReportsCount, // CRITICAL: Added missing dependency
      investorAllocations: allocationsCount,
      totalUsed,
      totalInvested,
      capitalBalance,
    };

    // If project has spending and force is not set, recommend archive instead
    if (hasSpending && !force) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project has spending. Archive recommended instead of permanent delete.',
          data: {
            message: 'Project has spending. Archive recommended instead of permanent delete.',
            recommendation: 'archive',
            totalUsed,
            totalInvested,
            capitalBalance,
            dependencies: dependencySummary,
            details: `This project has KES ${totalUsed.toLocaleString()} in spending. We strongly recommend archiving instead of permanently deleting to preserve financial records. Use POST /api/projects/${id}/archive to archive, or add ?force=true to proceed with permanent deletion.`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const hasAllocations = allocationsCount > 0;

    // Step 1: Return unused capital to investors (if any)
    let rollbackSummary = null;
    if (hasAllocations && capitalBalance > 0) {
      try {
        rollbackSummary = await returnCapitalToInvestors(
          id,
          capitalBalance,
          userProfile._id.toString()
        );
      } catch (error) {
        console.error('Error returning capital to investors:', error);
        // Continue with deletion even if rollback fails
      }
    }

    // Step 2: Remove investor allocations from all investors
    if (hasAllocations) {
      for (const investor of investorsWithAllocations) {
        // Find the allocation to be removed (for audit log) - do this before filtering
        const removedAllocation = (investor.projectAllocations || []).find(
          (alloc) => {
            const allocProjectId = alloc.projectId?.toString();
            const targetProjectId = id.toString();
            return allocProjectId === targetProjectId;
          }
        );

        // Filter out the allocation for this project
        const updatedAllocations = (investor.projectAllocations || []).filter(
          (alloc) => {
            // Handle both ObjectId and string comparisons
            const allocProjectId = alloc.projectId?.toString();
            const targetProjectId = id.toString();
            return allocProjectId !== targetProjectId;
          }
        );

        await db.collection('investors').updateOne(
          { _id: investor._id },
          {
            $set: {
              projectAllocations: updatedAllocations,
              updatedAt: new Date(),
            },
          }
        );

        // Log allocation removal
        await createAuditLog({
          userId: userProfile._id.toString(),
          action: 'REMOVED_PROJECT_ALLOCATION',
          entityType: 'INVESTOR',
          entityId: investor._id.toString(),
          projectId: id,
          changes: {
            projectAllocations: {
              oldValue: investor.projectAllocations,
              newValue: updatedAllocations,
            },
          },
        });
      }

      // Recalculate project finances for other projects that these investors have allocations to
      // Get all unique project IDs from remaining allocations
      const allInvestors = await db
        .collection('investors')
        .find({ status: 'ACTIVE' })
        .toArray();

      const affectedProjectIds = new Set();
      for (const investor of allInvestors) {
        const allocations = investor.projectAllocations || [];
        for (const alloc of allocations) {
          if (alloc.projectId) {
            // Handle both ObjectId and string projectId
            const projectIdStr = alloc.projectId.toString ? alloc.projectId.toString() : String(alloc.projectId);
            if (projectIdStr) {
              affectedProjectIds.add(projectIdStr);
            }
          }
        }
      }

      // Recalculate finances for all affected projects (async, non-blocking)
      affectedProjectIds.forEach((projectId) => {
        if (projectId !== id.toString()) {
          recalculateProjectFinances(projectId)
            .then(() => {
              console.log(`✅ Project finances updated for project ${projectId} after allocation removal`);
            })
            .catch((error) => {
              console.error(`❌ Error updating project finances for project ${projectId}:`, error);
            });
        }
      });
    }

    // Step 3: Delete Cloudinary assets from related entities before hard deleting them
    try {
      const {
        deleteMaterialCloudinaryAssets,
        deleteExpenseCloudinaryAssets,
        deleteInitialExpenseCloudinaryAssets,
        deleteProjectCloudinaryAssets,
      } = await import('@/lib/cloudinary-cleanup');

      // Delete Cloudinary assets from project documents
      const projectCleanup = await deleteProjectCloudinaryAssets(existingProject);
      console.log(`🗑️ Cloudinary cleanup for project ${id}: ${projectCleanup.success} deleted, ${projectCleanup.failed} failed`);

      // Delete Cloudinary assets from materials
      if (materialsCount > 0) {
        const materials = await db
          .collection('materials')
          .find({ projectId: projectObjectId })
          .toArray();
        
        for (const material of materials) {
          const materialCleanup = await deleteMaterialCloudinaryAssets(material);
          console.log(`🗑️ Cloudinary cleanup for material ${material._id}: ${materialCleanup.success} deleted`);
        }
      }

      // Delete Cloudinary assets from expenses
      if (expensesCount > 0) {
        const expenses = await db
          .collection('expenses')
          .find({ projectId: projectObjectId })
          .toArray();
        
        for (const expense of expenses) {
          const expenseCleanup = await deleteExpenseCloudinaryAssets(expense);
          console.log(`🗑️ Cloudinary cleanup for expense ${expense._id}: ${expenseCleanup.success} deleted`);
        }
      }

      // Delete Cloudinary assets from initial expenses
      if (initialExpensesCount > 0) {
        const initialExpenses = await db
          .collection('initial_expenses')
          .find({ projectId: projectObjectId })
          .toArray();
        
        for (const initialExpense of initialExpenses) {
          const initialExpenseCleanup = await deleteInitialExpenseCloudinaryAssets(initialExpense);
          console.log(`🗑️ Cloudinary cleanup for initial expense ${initialExpense._id}: ${initialExpenseCleanup.success} deleted`);
        }
      }
    } catch (cleanupError) {
      // Log error but don't fail the delete operation
      console.error(`⚠️ Error cleaning up Cloudinary assets for project ${id}:`, cleanupError);
    }

    // Step 4: Hard delete related entities (permanent deletion)
    // Hard delete materials
    if (materialsCount > 0) {
      await db.collection('materials').deleteMany({
        projectId: projectObjectId,
      });
    }

    // Hard delete expenses
    if (expensesCount > 0) {
      await db.collection('expenses').deleteMany({
        projectId: projectObjectId,
      });
    }

    // Hard delete initial expenses
    if (initialExpensesCount > 0) {
      await db.collection('initial_expenses').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (materialRequestsCount > 0) {
      await db.collection('material_requests').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (materialRequestBatchesCount > 0) {
      await db.collection('material_request_batches').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (purchaseOrdersCount > 0) {
      await db.collection('purchase_orders').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (labourEntriesCount > 0) {
      await db.collection('labour_entries').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (labourBatchesCount > 0) {
      await db.collection('labour_batches').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (labourCostSummariesCount > 0) {
      await db.collection('labour_cost_summaries').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (siteReportsCount > 0) {
      await db.collection('site_reports').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (supervisorSubmissionsCount > 0) {
      await db.collection('supervisor_submissions').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (equipmentCount > 0) {
      await db.collection('equipment').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (subcontractorsCount > 0) {
      await db.collection('subcontractors').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (professionalServicesCount > 0) {
      await db.collection('professional_services').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (professionalFeesCount > 0) {
      await db.collection('professional_fees').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (professionalActivitiesCount > 0) {
      await db.collection('professional_activities').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (budgetReallocationsCount > 0) {
      await db.collection('budget_reallocations').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (budgetAdjustmentsCount > 0) {
      await db.collection('budget_adjustments').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (budgetTransfersCount > 0) {
      await db.collection('budget_transfers').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (contingencyDrawsCount > 0) {
      await db.collection('contingency_draws').deleteMany({
        projectId: projectObjectId,
      });
    }

    // CRITICAL FIX: Delete scheduled reports to prevent background job errors
    if (scheduledReportsCount > 0) {
      await db.collection('scheduled_reports').deleteMany({
        projectId: projectObjectId,
      });
      console.log(`🗑️ Deleted ${scheduledReportsCount} scheduled report(s) for project ${id}`);
    }

    if (approvalsCount > 0) {
      await db.collection('approvals').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (membershipsCount > 0) {
      await db.collection('project_memberships').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (teamLinksCount > 0) {
      await db.collection('project_teams').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (notificationsCount > 0) {
      await db.collection('notifications').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (auditLogsCount > 0) {
      await db.collection('audit_logs').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (phasesCount > 0) {
      await db.collection('phases').deleteMany({
        projectId: projectObjectId,
      });
    }

    if (workItemsCount > 0) {
      await db.collection('work_items').deleteMany({
        projectId: projectObjectId,
      });
    }

    // Step 5: Delete floors (hard delete as they're project-specific)
    if (floorsCount > 0) {
      await db.collection('floors').deleteMany({
        projectId: projectObjectId,
      });
    }

    // Step 6: Delete project finances record
    await db.collection('project_finances').deleteOne({
      projectId: projectObjectId,
    });

    // Step 7: Hard delete project (permanent deletion)
    const result = await db.collection('projects').deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return errorResponse('Project not found or delete failed', 404);
    }

    // Step 8: Recalculate project finances for other projects that these investors have allocations to
    if (hasAllocations) {
      const allInvestors = await db
        .collection('investors')
        .find({ status: 'ACTIVE' })
        .toArray();

      const affectedProjectIds = new Set();
      for (const investor of allInvestors) {
        const allocations = investor.projectAllocations || [];
        for (const alloc of allocations) {
          if (alloc.projectId) {
            const projectIdStr = alloc.projectId.toString ? alloc.projectId.toString() : String(alloc.projectId);
            if (projectIdStr) {
              affectedProjectIds.add(projectIdStr);
            }
          }
        }
      }

      // Recalculate finances for all affected projects (async, non-blocking)
      affectedProjectIds.forEach((projectId) => {
        if (projectId !== id.toString()) {
          recalculateProjectFinances(projectId)
            .then(() => {
              console.log(`✅ Project finances updated for project ${projectId} after allocation removal`);
            })
            .catch((error) => {
              console.error(`❌ Error updating project finances for project ${projectId}:`, error);
            });
        }
      });
    }

    // Step 9: Create comprehensive audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED_PERMANENTLY',
      entityType: 'PROJECT',
      entityId: id,
      changes: {
        status: {
          oldValue: existingProject.status,
          newValue: 'DELETED',
        },
        deletedAt: {
          oldValue: existingProject.deletedAt || null,
          newValue: new Date(),
        },
      },
    });

    // Build response message
    let message = 'Project permanently deleted successfully.';
    if (hasAllocations) {
      message += ` Removed ${allocationsCount} investor allocation(s).`;
    }
    if (rollbackSummary && rollbackSummary.returned > 0) {
      message += ` Returned KES ${rollbackSummary.returned.toLocaleString()} unused capital to ${rollbackSummary.investorsUpdated} investor(s).`;
    }

    return successResponse(
      {
        projectId: id,
        deleted: true,
        dependencies: dependencySummary,
        rollback: rollbackSummary,
      },
      message
    );
  } catch (error) {
    console.error('Delete project error:', error);
    return errorResponse('Failed to delete project', 500);
  }
}

