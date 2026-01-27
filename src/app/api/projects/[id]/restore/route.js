/**
 * Restore Project API Route
 * POST /api/projects/[id]/restore
 * Restores an archived project
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
import { supportsTransactions, withTransactionOrFallback } from '@/lib/mongodb/transaction-helpers';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can restore projects
    const hasRestorePermission = await hasPermission(user.id, 'delete_project');
    if (!hasRestorePermission) {
      return errorResponse('Insufficient permissions. Only OWNER can restore projects.', 403);
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

    // Check if project is archived
    if (existingProject.status !== 'archived') {
      return errorResponse('Project is not archived', 400);
    }

    const now = new Date();
    const projectObjectId = new ObjectId(id);
    const restoreMeta = {
      restoredAt: now,
      restoredBy: new ObjectId(userProfile._id),
      updatedAt: now,
    };

    const transactionsSupported = await supportsTransactions();
    if (!transactionsSupported) {
      return errorResponse(
        'Project restore requires database transactions. Enable a replica set to proceed.',
        503
      );
    }

    const result = await withTransactionOrFallback(
      async ({ db: transactionDb, session }) => {
        const updateOptions = session ? { session } : {};

        await transactionDb.collection('materials').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('expenses').updateMany(
          { projectId: projectObjectId, status: 'ARCHIVED' },
          { $unset: { deletedAt: '' }, $set: { ...restoreMeta, status: 'PENDING' } },
          updateOptions
        );

        await transactionDb.collection('initial_expenses').updateMany(
          { projectId: projectObjectId, status: 'deleted' },
          { $set: { ...restoreMeta, status: 'pending' }, $unset: { deletedAt: '' } },
          updateOptions
        );

        await transactionDb.collection('floors').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('phases').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('work_items').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('labour_entries').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('labour_batches').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('labour_cost_summaries').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('site_reports').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('supervisor_submissions').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('material_requests').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('material_request_batches').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('purchase_orders').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('equipment').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('subcontractors').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('professional_services').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('professional_fees').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('professional_activities').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('budget_reallocations').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('budget_adjustments').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('budget_transfers').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('contingency_draws').updateMany(
          { projectId: projectObjectId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('approvals').updateMany(
          { projectId: projectObjectId, archivedAt: { $ne: null } },
          { $unset: { archivedAt: '', archivedBy: '' }, $set: restoreMeta },
          updateOptions
        );

        await transactionDb.collection('project_memberships').updateMany(
          { projectId: projectObjectId, status: 'archived' },
          { $set: { ...restoreMeta, status: 'active', removedAt: null } },
          updateOptions
        );

        await transactionDb.collection('project_teams').updateMany(
          { projectId: projectObjectId, archivedAt: { $ne: null } },
          { $unset: { archivedAt: '', archivedBy: '' }, $set: restoreMeta },
          updateOptions
        );

        const projectUpdate = await transactionDb.collection('projects').findOneAndUpdate(
          { _id: projectObjectId },
          {
            $set: { ...restoreMeta, status: 'active' },
            $unset: { deletedAt: '', archivedAt: '', archivedBy: '' },
          },
          { returnDocument: 'after', ...updateOptions }
        );

        return projectUpdate;
      },
      async () => {},
      { maxTimeMS: 60000 }
    );

    if (!result.value) {
      return errorResponse('Project not found or restore failed', 404);
    }

    // Recalculate project finances
    try {
      await recalculateProjectFinances(id);
    } catch (error) {
      console.error('Error recalculating project finances after restore:', error);
      // Don't fail the restore if finances recalculation fails
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'RESTORED',
      entityType: 'PROJECT',
      entityId: id,
      changes: {
        status: {
          oldValue: 'archived',
          newValue: 'active',
        },
        deletedAt: {
          oldValue: existingProject.deletedAt,
          newValue: null,
        },
      },
    });

    return successResponse(
      {
        projectId: id,
        restored: true,
      },
      'Project restored successfully. All dependencies have been restored.'
    );
  } catch (error) {
    console.error('Restore project error:', error);
    return errorResponse('Failed to restore project', 500);
  }
}

