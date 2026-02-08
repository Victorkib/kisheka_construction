/**
 * Archive Expense API Route
 * POST /api/expenses/[id]/archive
 * Archives an expense (soft delete)
 * Auth: OWNER only
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const hasArchivePermission = await hasPermission(user.id, 'delete_expense');
    if (!hasArchivePermission) {
      return errorResponse('Insufficient permissions. Only OWNER can archive expenses.', 403);
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
      deletedAt: null,
    });

    if (!existingExpense) {
      return errorResponse('Expense not found or already archived', 404);
    }

    const now = new Date();

    const result = await db.collection('expenses').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          deletedAt: now,
          status: 'ARCHIVED',
          updatedAt: now,
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Expense not found or archive failed', 404);
    }

    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'ARCHIVED',
      entityType: 'EXPENSE',
      entityId: id,
      projectId: existingExpense.projectId ? existingExpense.projectId.toString() : null,
      changes: {
        status: {
          oldValue: existingExpense.status,
          newValue: 'ARCHIVED',
        },
        deletedAt: {
          oldValue: null,
          newValue: now,
        },
      },
    });

    return successResponse(
      { expenseId: id, archived: true },
      'Expense archived successfully. Financial records have been preserved.'
    );
  } catch (error) {
    console.error('Archive expense error:', error);
    return errorResponse('Failed to archive expense', 500);
  }
}

