/**
 * Initial Expense Detail API Route
 * GET: Get single initial expense
 * PATCH: Update initial expense (only if draft)
 * DELETE: Soft delete initial expense (OWNER only)
 * 
 * GET /api/initial-expenses/[id]
 * PATCH /api/initial-expenses/[id]
 * DELETE /api/initial-expenses/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile, getUserById, getProjectById } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { recalculateProjectFinances } from '@/lib/financial-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/initial-expenses/[id]
 * Returns a single initial expense
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
      return errorResponse('Invalid initial expense ID', 400);
    }

    const db = await getDatabase();
    const expense = await db
      .collection('initial_expenses')
      .findOne({ _id: new ObjectId(id) });

    if (!expense) {
      return errorResponse('Initial expense not found', 404);
    }

    // Populate user and project data
    const enrichedExpense = { ...expense };

    // Populate enteredBy user
    if (expense.enteredBy) {
      const enteredByUser = await getUserById(expense.enteredBy);
      enrichedExpense.enteredByUser = enteredByUser || null;
    }

    // Populate approvedBy user
    if (expense.approvedBy) {
      const approvedByUser = await getUserById(expense.approvedBy);
      enrichedExpense.approvedByUser = approvedByUser || null;
    }

    // Populate project data
    if (expense.projectId) {
      const project = await getProjectById(expense.projectId);
      enrichedExpense.project = project || null;
    }

    return successResponse(enrichedExpense);
  } catch (error) {
    console.error('Get initial expense error:', error);
    return errorResponse('Failed to retrieve initial expense', 500);
  }
}

/**
 * PATCH /api/initial-expenses/[id]
 * Updates an initial expense (only if draft status)
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Check permission
    const canEdit = await hasPermission(user.id, 'edit_initial_expense');
    if (!canEdit) {
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['site_clerk', 'pm', 'project_manager', 'owner'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse(
          'Insufficient permissions. Only CLERK, PM, and OWNER can edit initial expenses.',
          403
        );
      }
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid initial expense ID', 400);
    }

    const body = await request.json();
    const {
      category,
      itemName,
      amount,
      supplier,
      receiptNumber,
      receiptFileUrl,
      supportingDocuments,
      datePaid,
      notes,
    } = body;

    const db = await getDatabase();
    const existingExpense = await db
      .collection('initial_expenses')
      .findOne({ _id: new ObjectId(id) });

    if (!existingExpense) {
      return errorResponse('Initial expense not found', 404);
    }

    // Only allow editing if status is draft
    if (existingExpense.status !== 'draft') {
      return errorResponse(
        'Can only edit initial expenses with draft status',
        400
      );
    }

    const updateData = { updatedAt: new Date() };
    const changes = {};

    if (category !== undefined) {
      const validCategories = [
        'land',
        'transfer_fees',
        'county_fees',
        'permits',
        'approvals',
        'boreholes',
        'electricity',
        'other',
      ];
      if (!validCategories.includes(category)) {
        return errorResponse('Invalid category', 400);
      }
      updateData.category = category;
      changes.category = {
        oldValue: existingExpense.category,
        newValue: category,
      };
    }

    if (itemName !== undefined) {
      if (itemName.trim().length === 0) {
        return errorResponse('Item name cannot be empty', 400);
      }
      updateData.itemName = itemName.trim();
      changes.itemName = {
        oldValue: existingExpense.itemName,
        newValue: updateData.itemName,
      };
    }

    if (amount !== undefined) {
      if (typeof amount !== 'number' || amount <= 0) {
        return errorResponse('Valid amount is required', 400);
      }
      updateData.amount = parseFloat(amount);
      changes.amount = {
        oldValue: existingExpense.amount,
        newValue: updateData.amount,
      };

      // Re-evaluate status based on new amount
      const APPROVAL_THRESHOLD = 100000;
      if (updateData.amount >= APPROVAL_THRESHOLD && existingExpense.status === 'approved') {
        updateData.status = 'pending_approval';
        updateData.approvedBy = null;
        updateData.approvalNotes = '';
      } else if (updateData.amount < APPROVAL_THRESHOLD && existingExpense.status === 'pending_approval') {
        updateData.status = 'approved';
        updateData.approvedBy = new ObjectId(userProfile._id);
        updateData.approvalNotes = 'Auto-approved (amount < 100k)';
      }
    }

    if (supplier !== undefined) {
      updateData.supplier = supplier?.trim() || '';
      changes.supplier = {
        oldValue: existingExpense.supplier,
        newValue: updateData.supplier,
      };
    }

    if (receiptNumber !== undefined) {
      updateData.receiptNumber = receiptNumber?.trim() || '';
      changes.receiptNumber = {
        oldValue: existingExpense.receiptNumber,
        newValue: updateData.receiptNumber,
      };
    }

    if (receiptFileUrl !== undefined) {
      updateData.receiptFileUrl = receiptFileUrl || null;
      changes.receiptFileUrl = {
        oldValue: existingExpense.receiptFileUrl,
        newValue: updateData.receiptFileUrl,
      };
    }

    if (supportingDocuments !== undefined) {
      updateData.supportingDocuments = Array.isArray(supportingDocuments)
        ? supportingDocuments
        : [];
      changes.supportingDocuments = {
        oldValue: existingExpense.supportingDocuments,
        newValue: updateData.supportingDocuments,
      };
    }

    if (datePaid !== undefined) {
      updateData.datePaid = new Date(datePaid);
      changes.datePaid = {
        oldValue: existingExpense.datePaid,
        newValue: updateData.datePaid,
      };
    }

    if (notes !== undefined) {
      updateData.notes = notes?.trim() || '';
      changes.notes = {
        oldValue: existingExpense.notes,
        newValue: updateData.notes,
      };
    }

    const result = await db
      .collection('initial_expenses')
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

    if (Object.keys(changes).length > 0) {
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'UPDATED',
        entityType: 'INITIAL_EXPENSE',
        entityId: id,
        changes,
      });
    }

    return successResponse(result.value, 'Initial expense updated successfully');
  } catch (error) {
    console.error('Update initial expense error:', error);
    return errorResponse('Failed to update initial expense', 500);
  }
}

/**
 * DELETE /api/initial-expenses/[id]
 * Permanently deletes an initial expense with project finance recalculation
 * Auth: OWNER only
 * 
 * Query params:
 * - force: boolean - If true, bypasses amount check (use with caution)
 * 
 * Handles:
 * - Hard deletes initial expense
 * - Recalculates project finances if initial expense was approved and had amount
 * 
 * Note: For archiving (soft delete), use POST /api/initial-expenses/[id]/archive
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Only OWNER can delete
    const userRole = userProfile.role?.toLowerCase();
    if (userRole !== 'owner') {
      return errorResponse(
        'Insufficient permissions. Only OWNER can delete initial expenses.',
        403
      );
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid initial expense ID', 400);
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const db = await getDatabase();
    const existingExpense = await db
      .collection('initial_expenses')
      .findOne({ _id: new ObjectId(id) });

    if (!existingExpense) {
      return errorResponse('Initial expense not found', 404);
    }

    // Check if initial expense is already archived
    if (existingExpense.status === 'deleted') {
      return errorResponse('Initial expense is already archived. Use restore endpoint to restore it first.', 400);
    }

    // Check if initial expense has amount and force is not set, recommend archive
    const hasAmount = existingExpense.amount > 0;
    const isApproved = existingExpense.status === 'approved';
    
    if (hasAmount && isApproved && !force) {
      return errorResponse(
        {
          message: 'Initial expense has amount and is approved. Archive recommended instead of permanent delete.',
          recommendation: 'archive',
          amount: existingExpense.amount,
          status: existingExpense.status,
        },
        `This initial expense has an amount of KES ${existingExpense.amount.toLocaleString()} and is ${existingExpense.status}. We recommend archiving instead of permanently deleting to preserve records. Use POST /api/initial-expenses/${id}/archive to archive, or add ?force=true to proceed with permanent deletion.`,
        400
      );
    }

    // Delete Cloudinary assets before deleting database record
    try {
      const { deleteInitialExpenseCloudinaryAssets } = await import('@/lib/cloudinary-cleanup');
      const cleanupResult = await deleteInitialExpenseCloudinaryAssets(existingExpense);
      console.log(`🗑️ Cloudinary cleanup for initial expense ${id}: ${cleanupResult.success} deleted, ${cleanupResult.failed} failed`);
    } catch (cleanupError) {
      // Log error but don't fail the delete operation
      console.error(`⚠️ Error cleaning up Cloudinary assets for initial expense ${id}:`, cleanupError);
    }

    // Hard delete initial expense
    const result = await db.collection('initial_expenses').deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return errorResponse('Initial expense not found or delete failed', 404);
    }

    // Recalculate project finances if initial expense was approved and had amount
    if (
      existingExpense.projectId &&
      ObjectId.isValid(existingExpense.projectId) &&
      isApproved &&
      hasAmount
    ) {
      try {
        const projectIdStr = existingExpense.projectId.toString();
        await recalculateProjectFinances(projectIdStr);
        console.log(`✅ Project finances recalculated after initial expense deletion for project ${projectIdStr}`);
      } catch (error) {
        console.error(`❌ Error recalculating project finances after initial expense deletion:`, error);
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED_PERMANENTLY',
      entityType: 'INITIAL_EXPENSE',
      entityId: id,
      projectId: existingExpense.projectId ? existingExpense.projectId.toString() : null,
      changes: {
        status: { oldValue: existingExpense.status, newValue: 'DELETED' },
      },
    });

    let message = 'Initial expense permanently deleted successfully.';
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
    console.error('Delete initial expense error:', error);
    return errorResponse('Failed to delete initial expense', 500);
  }
}

