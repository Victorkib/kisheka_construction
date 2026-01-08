/**
 * Expense Detail API Route
 * GET: Get single expense
 * PATCH: Update expense (with restrictions)
 * DELETE: Soft delete expense (OWNER only)
 * 
 * GET /api/expenses/[id]
 * PATCH /api/expenses/[id]
 * DELETE /api/expenses/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { recalculateProjectFinances } from '@/lib/financial-helpers';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';
import { updateIndirectCostsSpending } from '@/lib/indirect-costs-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/expenses/[id]
 * Returns a single expense by ID with full details
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
      return errorResponse('Invalid expense ID', 400);
    }

    const db = await getDatabase();
    const expense = await db.collection('expenses').findOne({
      _id: new ObjectId(id),
      deletedAt: null, // Exclude soft-deleted expenses
    });

    if (!expense) {
      return errorResponse('Expense not found', 404);
    }

    // Get approval history from approvals collection
    const approvals = await db
      .collection('approvals')
      .find({
        relatedId: new ObjectId(id),
        relatedModel: 'EXPENSE',
      })
      .sort({ timestamp: -1 })
      .toArray();

    // Get audit logs for this expense
    const auditLogs = await db
      .collection('audit_logs')
      .find({
        entityType: 'EXPENSE',
        entityId: new ObjectId(id),
      })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    return successResponse(
      {
        ...expense,
        approvalHistory: approvals,
        activityLog: auditLogs,
      },
      'Expense retrieved successfully'
    );
  } catch (error) {
    console.error('Get expense error:', error);
    return errorResponse('Failed to retrieve expense', 500);
  }
}

/**
 * PATCH /api/expenses/[id]
 * Updates expense (with restrictions based on status)
 * Auth: CLERK, PM, ACCOUNTANT (with restrictions), OWNER
 * Restrictions: Cannot edit after approved without PM/OWNER override
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasEditPermission = await hasPermission(user.id, 'edit_expense');
    if (!hasEditPermission) {
      return errorResponse('Insufficient permissions. Only CLERK, PM, ACCOUNTANT, and OWNER can edit expenses.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid expense ID', 400);
    }

    const body = await request.json();
    const {
      amount,
      category,
      description,
      vendor,
      date,
      paymentMethod,
      referenceNumber,
      receiptFileUrl,
      notes,
      status,
      phaseId,
      isIndirectCost, // NEW: Update indirect cost flag
      indirectCostCategory, // NEW: Update indirect cost category
    } = body;

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);

    // Get existing expense
    const existingExpense = await db.collection('expenses').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingExpense) {
      return errorResponse('Expense not found', 404);
    }

    // Check if expense can be edited
    const canEditStatuses = ['PENDING', 'REJECTED'];
    const userRole = userProfile?.role?.toLowerCase();
    const isOwnerOrPM = ['owner', 'pm', 'project_manager'].includes(userRole);

    if (!canEditStatuses.includes(existingExpense.status) && !isOwnerOrPM) {
      return errorResponse(
        `Cannot edit expense with status "${existingExpense.status}". Only expenses with status PENDING or REJECTED can be edited.`,
        403
      );
    }

    // Build update object
    const updateData = {
      updatedAt: new Date(),
    };
    const changes = {};

    // Track changes for audit log
    if (amount !== undefined && amount !== existingExpense.amount) {
      updateData.amount = parseFloat(amount);
      changes.amount = { oldValue: existingExpense.amount, newValue: parseFloat(amount) };
    }

    if (category !== undefined && category !== existingExpense.category) {
      updateData.category = category.trim();
      changes.category = { oldValue: existingExpense.category, newValue: category.trim() };
    }

    if (description !== undefined && description !== existingExpense.description) {
      updateData.description = description.trim();
      changes.description = { oldValue: existingExpense.description, newValue: description.trim() };
    }

    if (vendor !== undefined && vendor !== existingExpense.vendor) {
      updateData.vendor = vendor.trim();
      changes.vendor = { oldValue: existingExpense.vendor, newValue: vendor.trim() };
    }

    if (date !== undefined) {
      const newDate = new Date(date);
      if (newDate.getTime() !== existingExpense.date.getTime()) {
        updateData.date = newDate;
        changes.date = { oldValue: existingExpense.date, newValue: newDate };
      }
    }

    if (paymentMethod !== undefined && paymentMethod !== existingExpense.paymentMethod) {
      updateData.paymentMethod = paymentMethod;
      changes.paymentMethod = { oldValue: existingExpense.paymentMethod, newValue: paymentMethod };
    }

    if (referenceNumber !== undefined && referenceNumber !== existingExpense.referenceNumber) {
      updateData.referenceNumber = referenceNumber?.trim() || null;
      changes.referenceNumber = { oldValue: existingExpense.referenceNumber, newValue: referenceNumber?.trim() || null };
    }

    if (receiptFileUrl !== undefined && receiptFileUrl !== existingExpense.receiptFileUrl) {
      updateData.receiptFileUrl = receiptFileUrl || null;
      changes.receiptFileUrl = { oldValue: existingExpense.receiptFileUrl, newValue: receiptFileUrl || null };
    }

    if (notes !== undefined && notes !== existingExpense.notes) {
      updateData.notes = notes?.trim() || '';
      changes.notes = { oldValue: existingExpense.notes, newValue: notes?.trim() || '' };
    }

    if (status !== undefined && status !== existingExpense.status && isOwnerOrPM) {
      updateData.status = status;
      changes.status = { oldValue: existingExpense.status, newValue: status };
    }

    // Handle phaseId update
    const oldPhaseId = existingExpense.phaseId;
    if (phaseId !== undefined) {
      if (phaseId === null || phaseId === '') {
        updateData.phaseId = null;
        changes.phaseId = {
          oldValue: oldPhaseId,
          newValue: null,
        };
      } else if (ObjectId.isValid(phaseId)) {
        // Validate phase exists and belongs to same project
        const phase = await db.collection('phases').findOne({
          _id: new ObjectId(phaseId),
          deletedAt: null,
        });

        if (!phase) {
          return errorResponse(`Phase not found: ${phaseId}`, 404);
        }

        if (phase.projectId.toString() !== existingExpense.projectId.toString()) {
          return errorResponse('Phase does not belong to the same project as the expense', 400);
        }

        updateData.phaseId = new ObjectId(phaseId);
        changes.phaseId = {
          oldValue: oldPhaseId,
          newValue: phaseId,
        };
      } else {
        return errorResponse('Invalid phaseId format', 400);
      }
    }
    
    // Handle isIndirectCost and indirectCostCategory updates
    if (isIndirectCost !== undefined) {
      updateData.isIndirectCost = isIndirectCost === true;
      changes.isIndirectCost = {
        oldValue: existingExpense.isIndirectCost || false,
        newValue: isIndirectCost === true,
      };
      
      // If setting to indirect cost, validate category
      if (isIndirectCost === true) {
        const validIndirectCategories = ['utilities', 'siteOverhead', 'transportation', 'safetyCompliance'];
        const finalCategory = indirectCostCategory || existingExpense.indirectCostCategory;
        
        if (!finalCategory || !validIndirectCategories.includes(finalCategory)) {
          return errorResponse(
            `Invalid indirectCostCategory. Must be one of: ${validIndirectCategories.join(', ')} when isIndirectCost is true`,
            400
          );
        }
        
        updateData.indirectCostCategory = finalCategory;
        changes.indirectCostCategory = {
          oldValue: existingExpense.indirectCostCategory || null,
          newValue: finalCategory,
        };
      } else {
        // If setting to direct cost, clear indirectCostCategory
        updateData.indirectCostCategory = null;
        changes.indirectCostCategory = {
          oldValue: existingExpense.indirectCostCategory || null,
          newValue: null,
        };
      }
    } else if (indirectCostCategory !== undefined && existingExpense.isIndirectCost) {
      // Only allow updating category if already an indirect cost
      const validIndirectCategories = ['utilities', 'siteOverhead', 'transportation', 'safetyCompliance'];
      if (!validIndirectCategories.includes(indirectCostCategory)) {
        return errorResponse(
          `Invalid indirectCostCategory. Must be one of: ${validIndirectCategories.join(', ')}`,
          400
        );
      }
      updateData.indirectCostCategory = indirectCostCategory;
      changes.indirectCostCategory = {
        oldValue: existingExpense.indirectCostCategory || null,
        newValue: indirectCostCategory,
      };
    }

    // Only update if there are changes
    if (Object.keys(updateData).length === 1) {
      return errorResponse('No valid fields provided for update', 400);
    }

    // Update expense
    const result = await db.collection('expenses').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Expense not found or update failed', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'EXPENSE',
      entityId: id,
      projectId: existingExpense.projectId ? existingExpense.projectId.toString() : null,
      changes,
    });

    // Recalculate project finances if amount changed
    if (updateData.amount !== undefined) {
      try {
        const projectIdStr = existingExpense.projectId?.toString();
        if (projectIdStr) {
          await recalculateProjectFinances(projectIdStr);
        }
      } catch (error) {
        console.error('Error recalculating project finances:', error);
      }
    }

    // Update indirect costs if isIndirectCost or indirectCostCategory changed
    const finalIsIndirectCost = updateData.isIndirectCost !== undefined 
      ? updateData.isIndirectCost 
      : existingExpense.isIndirectCost || false;
    const finalIndirectCategory = updateData.indirectCostCategory !== undefined
      ? updateData.indirectCostCategory
      : existingExpense.indirectCostCategory;
    
    if ((updateData.isIndirectCost !== undefined || updateData.indirectCostCategory !== undefined) && 
        finalIsIndirectCost && finalIndirectCategory && existingExpense.status === 'APPROVED') {
      try {
        // If changing to indirect cost or updating category, update indirect costs spending
        await updateIndirectCostsSpending(
          existingExpense.projectId.toString(),
          finalIndirectCategory,
          existingExpense.amount || 0
        );
      } catch (error) {
        console.error('Error updating indirect costs:', error);
      }
    }
    
    // Recalculate phase spending if phaseId changed (ONLY for direct costs)
    // CRITICAL: Indirect costs are NOT included in phase spending
    if (phaseId !== undefined && oldPhaseId?.toString() !== updateData.phaseId?.toString() && !finalIsIndirectCost) {
      try {
        // Recalculate old phase if it exists
        if (oldPhaseId && ObjectId.isValid(oldPhaseId)) {
          await recalculatePhaseSpending(oldPhaseId.toString());
        }
        // Recalculate new phase if it exists
        if (updateData.phaseId && ObjectId.isValid(updateData.phaseId)) {
          await recalculatePhaseSpending(updateData.phaseId.toString());
        }
      } catch (error) {
        // Log error but don't fail the update
        console.error('Error recalculating phase spending:', error);
      }
    }

    // Recalculate phase spending if status changed and expense is linked to a phase (ONLY for direct costs)
    if (updateData.status !== undefined && updateData.status !== existingExpense.status && !finalIsIndirectCost) {
      const currentPhaseId = updateData.phaseId || existingExpense.phaseId;
      if (currentPhaseId && ObjectId.isValid(currentPhaseId)) {
        try {
          await recalculatePhaseSpending(currentPhaseId.toString());
        } catch (error) {
          // Log error but don't fail the update
          console.error('Error recalculating phase spending after status change:', error);
        }
      }
    }

    return successResponse(result.value, 'Expense updated successfully');
  } catch (error) {
    console.error('Update expense error:', error);
    return errorResponse('Failed to update expense', 500);
  }
}

/**
 * DELETE /api/expenses/[id]
 * Permanently deletes an expense with project finance recalculation
 * Auth: OWNER only
 * 
 * Query params:
 * - force: boolean - If true, bypasses amount check (use with caution)
 * 
 * Handles:
 * - Hard deletes expense
 * - Recalculates project finances if expense was approved/paid and had amount
 * 
 * Note: For archiving (soft delete), use POST /api/expenses/[id]/archive
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasDeletePermission = await hasPermission(user.id, 'delete_expense');
    if (!hasDeletePermission) {
      return errorResponse('Insufficient permissions. Only OWNER can delete expenses.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid expense ID', 400);
    }

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // Get existing expense
    const existingExpense = await db.collection('expenses').findOne({
      _id: new ObjectId(id),
    });

    if (!existingExpense) {
      return errorResponse('Expense not found', 404);
    }

    // Check if expense is already archived
    if (existingExpense.deletedAt || existingExpense.status === 'ARCHIVED') {
      return errorResponse('Expense is already archived. Use restore endpoint to restore it first.', 400);
    }

    // Check if expense has amount and force is not set, recommend archive
    const hasAmount = existingExpense.amount > 0;
    const isApproved = ['APPROVED', 'PAID'].includes(existingExpense.status);
    
    if (hasAmount && isApproved && !force) {
      return errorResponse(
        {
          message: 'Expense has amount and is approved. Archive recommended instead of permanent delete.',
          recommendation: 'archive',
          amount: existingExpense.amount,
          status: existingExpense.status,
        },
        `This expense has an amount of KES ${existingExpense.amount.toLocaleString()} and is ${existingExpense.status}. We recommend archiving instead of permanently deleting to preserve records. Use POST /api/expenses/${id}/archive to archive, or add ?force=true to proceed with permanent deletion.`,
        400
      );
    }

    // Delete Cloudinary assets before deleting database record
    try {
      const { deleteExpenseCloudinaryAssets } = await import('@/lib/cloudinary-cleanup');
      const cleanupResult = await deleteExpenseCloudinaryAssets(existingExpense);
      console.log(`🗑️ Cloudinary cleanup for expense ${id}: ${cleanupResult.success} deleted, ${cleanupResult.failed} failed`);
    } catch (cleanupError) {
      // Log error but don't fail the delete operation
      console.error(`⚠️ Error cleaning up Cloudinary assets for expense ${id}:`, cleanupError);
    }

    // Hard delete expense
    const result = await db.collection('expenses').deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return errorResponse('Expense not found or delete failed', 404);
    }

    // Recalculate project finances if expense was approved/paid and had amount
    if (
      existingExpense.projectId &&
      ObjectId.isValid(existingExpense.projectId) &&
      isApproved &&
      hasAmount
    ) {
      try {
        const projectIdStr = existingExpense.projectId.toString();
        await recalculateProjectFinances(projectIdStr);
        console.log(`✅ Project finances recalculated after expense deletion for project ${projectIdStr}`);
      } catch (error) {
        console.error(`❌ Error recalculating project finances after expense deletion:`, error);
        console.error('Error details:', {
          projectId: projectIdStr,
          expenseId: id,
          expenseAmount: existingExpense.amount,
          expenseStatus: existingExpense.status,
          errorMessage: error.message,
          errorStack: error.stack,
        });
        // Log error but don't fail the delete operation
        // The expense is already deleted, so we can't rollback
        // This should be investigated manually
      }
    }

    // Recalculate phase spending if expense had a phase (ONLY for direct costs)
    // CRITICAL: Indirect costs are NOT included in phase spending
    if (existingExpense.phaseId && ObjectId.isValid(existingExpense.phaseId) && 
        isApproved && hasAmount && !existingExpense.isIndirectCost) {
      try {
        await recalculatePhaseSpending(existingExpense.phaseId.toString());
        console.log(`✅ Phase spending recalculated after expense deletion for phase ${existingExpense.phaseId}`);
      } catch (error) {
        // Log error but don't fail the delete operation
        console.error(`❌ Error recalculating phase spending after expense deletion:`, error);
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED_PERMANENTLY',
      entityType: 'EXPENSE',
      entityId: id,
      projectId: existingExpense.projectId ? existingExpense.projectId.toString() : null,
      changes: {
        status: { oldValue: existingExpense.status, newValue: 'DELETED' },
      },
    });

    let message = 'Expense permanently deleted successfully.';
    if (isApproved && hasAmount) {
      message += ' Project finances have been recalculated.';
    }

    return successResponse(
      {
        expenseId: id,
        deleted: true,
        hadAmount: hasAmount,
        wasApproved: isApproved,
      },
      message
    );
  } catch (error) {
    console.error('Delete expense error:', error);
    return errorResponse('Failed to delete expense', 500);
  }
}

