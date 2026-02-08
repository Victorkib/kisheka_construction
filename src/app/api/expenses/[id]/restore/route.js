/**
 * Restore Expense API Route
 * POST /api/expenses/[id]/restore
 * Restores an archived expense
 * Auth: OWNER only
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { recalculateProjectFinances } from '@/lib/financial-helpers';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const hasRestorePermission = await hasPermission(user.id, 'delete_expense');
    if (!hasRestorePermission) {
      return errorResponse('Insufficient permissions. Only OWNER can restore expenses.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid expense ID', 400);
    }

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);

    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const existingExpense = await db.collection('expenses').findOne({
      _id: new ObjectId(id),
      status: 'ARCHIVED',
    });

    if (!existingExpense) {
      return errorResponse('Expense not found or not archived', 404);
    }

    const result = await db.collection('expenses').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $unset: { deletedAt: '' },
        $set: {
          status: 'PENDING',
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Expense not found or restore failed', 404);
    }

    if (
      existingExpense.projectId &&
      ObjectId.isValid(existingExpense.projectId) &&
      ['APPROVED', 'PAID'].includes(existingExpense.status) &&
      existingExpense.amount > 0
    ) {
      try {
        await recalculateProjectFinances(existingExpense.projectId.toString());
      } catch (error) {
        console.error('Error recalculating project finances after expense restore:', error);
      }
    }

    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'RESTORED',
      entityType: 'EXPENSE',
      entityId: id,
      projectId: existingExpense.projectId ? existingExpense.projectId.toString() : null,
      changes: {
        status: { oldValue: 'ARCHIVED', newValue: 'PENDING' },
        deletedAt: { oldValue: existingExpense.deletedAt, newValue: null },
      },
    });

    return successResponse(
      { expenseId: id, restored: true },
      'Expense restored successfully. Project finances have been recalculated if applicable.'
    );
  } catch (error) {
    console.error('Restore expense error:', error);
    return errorResponse('Failed to restore expense', 500);
  }
}

