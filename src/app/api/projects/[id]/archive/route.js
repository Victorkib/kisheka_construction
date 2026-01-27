/**
 * Archive Project API Route
 * POST /api/projects/[id]/archive
 * Archives a project (soft delete)
 * Auth: OWNER only
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { supportsTransactions, withTransactionOrFallback } from '@/lib/mongodb/transaction-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can archive projects
    const hasArchivePermission = await hasPermission(user.id, 'delete_project');
    if (!hasArchivePermission) {
      return errorResponse('Insufficient permissions. Only OWNER can archive projects.', 403);
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

    // Check if project is already archived
    if (existingProject.status === 'archived') {
      return errorResponse('Project is already archived', 400);
    }

    // Check dependencies for summary
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
      db.collection('project_memberships').countDocuments({ projectId: projectObjectId, status: 'active' }),
      db.collection('project_teams').countDocuments({ projectId: projectObjectId }),
      db.collection('notifications').countDocuments({ projectId: projectObjectId }),
    ]);

    const investorsWithAllocations = await db
      .collection('investors')
      .find({
        status: 'ACTIVE',
        'projectAllocations.projectId': projectObjectId,
      })
      .toArray();

    const allocationsCount = investorsWithAllocations.length;

    const now = new Date();
    const archiveMeta = {
      archivedAt: now,
      archivedBy: new ObjectId(userProfile._id),
      updatedAt: now,
    };
    const softDeleteMeta = {
      ...archiveMeta,
      deletedAt: now,
    };

    const transactionsSupported = await supportsTransactions();
    if (!transactionsSupported) {
      return errorResponse(
        'Project archive requires database transactions. Enable a replica set to proceed.',
        503
      );
    }

    const result = await withTransactionOrFallback(
      async ({ db: transactionDb, session }) => {
        const updateOptions = session ? { session } : {};

        await transactionDb.collection('materials').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('expenses').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: { ...softDeleteMeta, status: 'ARCHIVED' } },
          updateOptions
        );

        await transactionDb.collection('initial_expenses').updateMany(
          { projectId: projectObjectId, status: { $ne: 'deleted' } },
          { $set: { ...archiveMeta, status: 'deleted', deletedAt: now } },
          updateOptions
        );

        await transactionDb.collection('floors').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('phases').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('work_items').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('labour_entries').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('labour_batches').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('labour_cost_summaries').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('site_reports').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('supervisor_submissions').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('material_requests').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('material_request_batches').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('purchase_orders').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('equipment').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('subcontractors').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('professional_services').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('professional_fees').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('professional_activities').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('budget_reallocations').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('budget_adjustments').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('budget_transfers').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('contingency_draws').updateMany(
          { projectId: projectObjectId, deletedAt: null },
          { $set: softDeleteMeta },
          updateOptions
        );

        await transactionDb.collection('approvals').updateMany(
          { projectId: projectObjectId },
          { $set: archiveMeta },
          updateOptions
        );

        await transactionDb.collection('project_memberships').updateMany(
          { projectId: projectObjectId, status: 'active' },
          { $set: { ...archiveMeta, status: 'archived', removedAt: now } },
          updateOptions
        );

        await transactionDb.collection('project_teams').updateMany(
          { projectId: projectObjectId },
          { $set: archiveMeta },
          updateOptions
        );

        const projectUpdate = await transactionDb.collection('projects').findOneAndUpdate(
          { _id: projectObjectId },
          { $set: { ...archiveMeta, status: 'archived', deletedAt: now } },
          { returnDocument: 'after', ...updateOptions }
        );

        return projectUpdate;
      },
      async () => {},
      { maxTimeMS: 60000 }
    );

    if (!result.value) {
      return errorResponse('Project not found or archive failed', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'ARCHIVED',
      entityType: 'PROJECT',
      entityId: id,
      changes: {
        status: {
          oldValue: existingProject.status,
          newValue: 'archived',
        },
        deletedAt: {
          oldValue: null,
          newValue: now,
        },
      },
    });

    return successResponse(
      {
        projectId: id,
        archived: true,
        dependencies: {
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
          investorAllocations: allocationsCount,
        },
      },
      'Project archived successfully. All financial records and dependencies have been preserved.'
    );
  } catch (error) {
    console.error('Archive project error:', error);
    return errorResponse('Failed to archive project', 500);
  }
}

