/**
 * Restore Initial Expense API Route
 * POST /api/initial-expenses/[id]/restore
 * Restores an archived initial expense
 * Auth: OWNER only
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
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

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (userProfile.role?.toLowerCase() !== 'owner') {
      return errorResponse('Insufficient permissions. Only OWNER can restore initial expenses.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid initial expense ID', 400);
    }

    const db = await getDatabase();
    const existingExpense = await db
      .collection('initial_expenses')
      .findOne({ _id: new ObjectId(id), status: 'deleted' });

    if (!existingExpense) {
      return errorResponse('Initial expense not found or not archived', 404);
    }

    const result = await db
      .collection('initial_expenses')
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { status: 'pending', updatedAt: new Date() } },
        { returnDocument: 'after' }
      );

    if (!result.value) {
      return errorResponse('Initial expense not found or restore failed', 404);
    }

    if (
      existingExpense.projectId &&
      ObjectId.isValid(existingExpense.projectId) &&
      existingExpense.status === 'approved' &&
      existingExpense.amount > 0
    ) {
      try {
        await recalculateProjectFinances(existingExpense.projectId.toString());
      } catch (error) {
        console.error('Error recalculating project finances after initial expense restore:', error);
      }
    }

    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'RESTORED',
      entityType: 'INITIAL_EXPENSE',
      entityId: id,
      projectId: existingExpense.projectId ? existingExpense.projectId.toString() : null,
      changes: {
        status: { oldValue: 'deleted', newValue: 'pending' },
      },
    });

    return successResponse(
      { expenseId: id, restored: true },
      'Initial expense restored successfully. Project finances have been recalculated if applicable.'
    );
  } catch (error) {
    console.error('Restore initial expense error:', error);
    return errorResponse('Failed to restore initial expense', 500);
  }
}

