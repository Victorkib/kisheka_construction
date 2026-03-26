/**
 * Floor Bulk Operations API
 * POST: Bulk update floors (status, progress, capital allocation)
 *
 * POST /api/floors/bulk/update
 * Body: {
 *   floorIds: string[],
 *   projectId: string,
 *   updates: {
 *     status?: string,
 *     completionPercentage?: number,
 *     milestoneNotes?: string,
 *     capitalAllocation?: { total?: number, byPhase?: object }
 *   }
 * }
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/floors/bulk/update
 * Bulk update multiple floors
 */
export async function POST(request) {
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
    const allowedRoles = ['owner', 'pm', 'project_manager', 'accountant'];
    if (!allowedRoles.includes(userRole)) {
      return errorResponse('Insufficient permissions. Only OWNER, PM, and ACCOUNTANT can perform bulk floor updates.', 403);
    }

    const body = await request.json();
    const { floorIds, projectId, updates } = body;

    // Validation
    if (!floorIds || !Array.isArray(floorIds) || floorIds.length === 0) {
      return errorResponse('floorIds array is required and must not be empty', 400);
    }

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    if (!updates || typeof updates !== 'object') {
      return errorResponse('updates object is required', 400);
    }

    // Validate update fields
    const allowedUpdates = ['status', 'completionPercentage', 'milestoneNotes', 'capitalAllocation', 'totalBudget'];
    const providedUpdates = Object.keys(updates);
    const invalidUpdates = providedUpdates.filter(key => !allowedUpdates.includes(key));
    
    if (invalidUpdates.length > 0) {
      return errorResponse(`Invalid update fields: ${invalidUpdates.join(', ')}. Allowed: ${allowedUpdates.join(', ')}`, 400);
    }

    // Validate status if provided
    if (updates.status) {
      const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];
      if (!validStatuses.includes(updates.status)) {
        return errorResponse(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
      }
    }

    // Validate completionPercentage if provided
    if (updates.completionPercentage !== undefined) {
      const percentage = parseFloat(updates.completionPercentage);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        return errorResponse('completionPercentage must be a number between 0 and 100', 400);
      }
    }

    const db = await getDatabase();
    const projectObjectId = new ObjectId(projectId);

    // Verify all floor IDs belong to the project
    const floorObjectIds = floorIds
      .filter(id => ObjectId.isValid(id))
      .map(id => new ObjectId(id));

    if (floorObjectIds.length !== floorIds.length) {
      return errorResponse('Some floor IDs are invalid', 400);
    }

    const existingFloors = await db.collection('floors').find({
      _id: { $in: floorObjectIds },
      projectId: projectObjectId,
      deletedAt: null
    }).toArray();

    if (existingFloors.length !== floorObjectIds.length) {
      const foundIds = new Set(existingFloors.map(f => f._id.toString()));
      const missingIds = floorIds.filter(id => !foundIds.has(id));
      return errorResponse(`Floors not found or don't belong to this project: ${missingIds.join(', ')}`, 400);
    }

    // Build update object
    const updateData = {};
    const changes = {};

    if (updates.status !== undefined) {
      updateData.status = updates.status;
      changes.status = { newValue: updates.status };
    }

    if (updates.completionPercentage !== undefined) {
      updateData['progress.completionPercentage'] = parseFloat(updates.completionPercentage);
      changes.completionPercentage = { newValue: parseFloat(updates.completionPercentage) };
    }

    if (updates.milestoneNotes !== undefined) {
      updateData['progress.milestoneNotes'] = updates.milestoneNotes.trim();
      changes.milestoneNotes = { newValue: updates.milestoneNotes.trim() };
    }

    if (updates.totalBudget !== undefined) {
      const budget = parseFloat(updates.totalBudget);
      if (isNaN(budget) || budget < 0) {
        return errorResponse('totalBudget must be a non-negative number', 400);
      }
      updateData.totalBudget = budget;
      updateData['budgetAllocation.total'] = budget;
      changes.totalBudget = { newValue: budget };
    }

    // Handle capital allocation separately (requires validation)
    let capitalUpdateResult = null;
    if (updates.capitalAllocation) {
      const { total, byPhase, strategy = 'proportional' } = updates.capitalAllocation;
      
      if (total !== undefined) {
        const capitalAmount = parseFloat(total);
        if (isNaN(capitalAmount) || capitalAmount < 0) {
          return errorResponse('capitalAllocation.total must be a non-negative number', 400);
        }

        // Get project finances to validate available capital
        const projectFinances = await db.collection('project_finances').findOne({
          projectId: projectObjectId,
          deletedAt: null
        });

        const availableCapital = projectFinances?.capitalBalance || 0;
        const totalCapitalNeeded = capitalAmount * floorObjectIds.length;

        if (totalCapitalNeeded > availableCapital) {
          return errorResponse(
            `Insufficient capital. Available: ${formatCurrency(availableCapital)}, Needed for all floors: ${formatCurrency(totalCapitalNeeded)}`,
            400
          );
        }

        // Update capital for each floor
        const capitalUpdates = [];
        for (const floor of existingFloors) {
          const existingCapital = floor.capitalAllocation || { total: 0, byPhase: {}, used: 0, committed: 0 };
          
          let newCapitalByPhase = byPhase || existingCapital.byPhase || {};
          
          // If no byPhase provided, distribute proportionally based on floor budget
          if (!byPhase && floor.budgetAllocation?.byPhase) {
            const floorBudgetTotal = floor.budgetAllocation.total || 0;
            const projectBudgetTotal = existingFloors.reduce((sum, f) => sum + (f.budgetAllocation?.total || 0), 0);
            
            if (projectBudgetTotal > 0) {
              newCapitalByPhase = {};
              Object.keys(floor.budgetAllocation.byPhase).forEach(phaseCode => {
                const phaseBudget = floor.budgetAllocation.byPhase[phaseCode]?.total || 0;
                const phaseShare = phaseBudget / projectBudgetTotal;
                newCapitalByPhase[phaseCode] = {
                  total: capitalAmount * phaseShare,
                  used: existingCapital.used * phaseShare,
                  committed: existingCapital.committed * phaseShare,
                  remaining: capitalAmount * phaseShare - (existingCapital.used * phaseShare) - (existingCapital.committed * phaseShare)
                };
              });
            }
          }

          const newCapitalAllocation = {
            total: capitalAmount,
            byPhase: newCapitalByPhase,
            used: existingCapital.used,
            committed: existingCapital.committed,
            remaining: capitalAmount - existingCapital.used - existingCapital.committed
          };

          capitalUpdates.push({
            updateOne: {
              filter: { _id: floor._id },
              update: {
                $set: {
                  capitalAllocation: newCapitalAllocation,
                  updatedAt: new Date()
                }
              }
            }
          });

          // Create audit log for capital update
          await createAuditLog({
            userId: userProfile._id.toString(),
            action: 'CAPITAL_ALLOCATED_BULK',
            entityType: 'FLOOR',
            entityId: floor._id.toString(),
            projectId,
            changes: {
              oldCapital: existingCapital.total,
              newCapital: capitalAmount,
              strategy
            },
            description: `Bulk capital allocation: ${formatCurrency(capitalAmount)} allocated to floor ${floor.name || `Floor ${floor.floorNumber}`}`
          });
        }

        if (capitalUpdates.length > 0) {
          await db.collection('floors').bulkWrite(capitalUpdates);
          capitalUpdateResult = { updated: capitalUpdates.length, totalAllocated: capitalAmount * capitalUpdates.length };
        }
      }
    }

    // Apply updates to all floors (excluding capital which was handled separately)
    const nonCapitalUpdates = Object.keys(updateData).length > 0;
    let updateResult = { modifiedCount: 0 };

    if (nonCapitalUpdates) {
      updateData.updatedAt = new Date();
      
      const result = await db.collection('floors').updateMany(
        { _id: { $in: floorObjectIds } },
        { $set: updateData }
      );
      
      updateResult = { modifiedCount: result.modifiedCount };

      // Create audit logs
      for (const floor of existingFloors) {
        await createAuditLog({
          userId: userProfile._id.toString(),
          action: 'FLOOR_BULK_UPDATED',
          entityType: 'FLOOR',
          entityId: floor._id.toString(),
          projectId,
          changes,
          description: `Bulk update: Floor ${floor.name || `Floor ${floor.floorNumber}`} updated with: ${Object.keys(updateData).join(', ')}`
        });
      }
    }

    return successResponse({
      updatedFloors: nonCapitalUpdates ? updateResult.modifiedCount : existingFloors.length,
      capitalAllocated: capitalUpdateResult,
      floors: existingFloors.map(f => ({
        _id: f._id.toString(),
        name: f.name || `Floor ${f.floorNumber}`,
        floorNumber: f.floorNumber
      }))
    }, `Successfully updated ${nonCapitalUpdates ? updateResult.modifiedCount : existingFloors.length} floor(s)`);
  } catch (error) {
    console.error('Bulk floor update error:', error);
    return errorResponse('Failed to perform bulk floor update', 500);
  }
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}
