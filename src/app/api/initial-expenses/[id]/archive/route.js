/**
 * Archive Initial Expense API Route
 * POST /api/initial-expenses/[id]/archive
 * Archives an initial expense (soft delete)
 * Auth: OWNER only
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
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

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (userProfile.role?.toLowerCase() !== 'owner') {
      return errorResponse('Insufficient permissions. Only OWNER can archive initial expenses.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid initial expense ID', 400);
    }

    const db = await getDatabase();
    const existingExpense = await db
      .collection('initial_expenses')
      .findOne({ _id: new ObjectId(id), status: { $ne: 'deleted' } });

    if (!existingExpense) {
      return errorResponse('Initial expense not found or already archived', 404);
    }

    const result = await db
      .collection('initial_expenses')
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { status: 'deleted', updatedAt: new Date() } },
        { returnDocument: 'after' }
      );

    if (!result.value) {
      return errorResponse('Initial expense not found or archive failed', 404);
    }

    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'ARCHIVED',
      entityType: 'INITIAL_EXPENSE',
      entityId: id,
      projectId: existingExpense.projectId ? existingExpense.projectId.toString() : null,
      changes: {
        status: { oldValue: existingExpense.status, newValue: 'deleted' },
      },
    });

    return successResponse(
      { expenseId: id, archived: true },
      'Initial expense archived successfully. Financial records have been preserved.'
    );
  } catch (error) {
    console.error('Archive initial expense error:', error);
    return errorResponse('Failed to archive initial expense', 500);
  }
}

