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
      updateData.budget = {
        ...existingProject.budget,
        ...budget,
      };
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

    return successResponse(responseData, warning ? `Project updated successfully. Warning: ${warning}` : 'Project updated successfully');
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

    // Check if project is already archived or deleted
    if (existingProject.status === 'archived') {
      return errorResponse('Project is already archived. Use restore endpoint to restore it first.', 400);
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // Get project finances to check spending
    const projectFinances = await db
      .collection('project_finances')
      .findOne({ projectId: new ObjectId(id) });

    const totalUsed = projectFinances?.totalUsed || await getCurrentTotalUsed(id);
    const totalInvested = projectFinances?.totalInvested || 0;
    const capitalBalance = totalInvested - totalUsed;
    const hasSpending = totalUsed > 0;

    // Check dependencies
    const materialsCount = await db.collection('materials').countDocuments({
      projectId: new ObjectId(id),
      deletedAt: null,
    });

    const expensesCount = await db.collection('expenses').countDocuments({
      projectId: new ObjectId(id),
      deletedAt: null,
    });

    const initialExpensesCount = await db.collection('initial_expenses').countDocuments({
      projectId: new ObjectId(id),
      status: { $ne: 'deleted' },
    });

    const floorsCount = await db.collection('floors').countDocuments({
      projectId: new ObjectId(id),
    });

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
      investorAllocations: allocationsCount,
      totalUsed,
      totalInvested,
      capitalBalance,
    };

    // If project has spending and force is not set, recommend archive instead
    if (hasSpending && !force) {
      return errorResponse(
        {
          message: 'Project has spending. Archive recommended instead of permanent delete.',
          recommendation: 'archive',
          totalUsed,
          totalInvested,
          capitalBalance,
          dependencies: dependencySummary,
        },
        `This project has KES ${totalUsed.toLocaleString()} in spending. We strongly recommend archiving instead of permanently deleting to preserve financial records. Use POST /api/projects/${id}/archive to archive, or add ?force=true to proceed with permanent deletion.`,
        400
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
          .find({ projectId: new ObjectId(id) })
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
          .find({ projectId: new ObjectId(id) })
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
          .find({ projectId: new ObjectId(id) })
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
        projectId: new ObjectId(id),
      });
    }

    // Hard delete expenses
    if (expensesCount > 0) {
      await db.collection('expenses').deleteMany({
        projectId: new ObjectId(id),
      });
    }

    // Hard delete initial expenses
    if (initialExpensesCount > 0) {
      await db.collection('initial_expenses').deleteMany({
        projectId: new ObjectId(id),
      });
    }

    // Step 5: Delete floors (hard delete as they're project-specific)
    if (floorsCount > 0) {
      await db.collection('floors').deleteMany({
        projectId: new ObjectId(id),
      });
    }

    // Step 6: Delete project finances record
    await db.collection('project_finances').deleteOne({
      projectId: new ObjectId(id),
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

