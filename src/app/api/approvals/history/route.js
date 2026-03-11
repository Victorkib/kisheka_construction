/**
 * Approval History API Route
 * GET: Get approval history for a specific item
 * 
 * GET /api/approvals/history?relatedId={id}&relatedModel={MODEL}
 * Auth: PM, OWNER, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/approvals/history
 * Returns approval history for a specific item
 * 
 * Query Parameters:
 * - relatedId (required): ID of the item
 * - relatedModel (required): Model type (MATERIAL, EXPENSE, etc.)
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission to view approvals
    const canViewApprovals = await hasPermission(user.id, 'view_approvals');
    if (!canViewApprovals) {
      return errorResponse('Insufficient permissions. You do not have permission to view approvals.', 403);
    }

    const { searchParams } = new URL(request.url);
    const relatedId = searchParams.get('relatedId');
    const relatedModel = searchParams.get('relatedModel');

    if (!relatedId || !relatedModel) {
      return errorResponse('relatedId and relatedModel are required', 400);
    }

    if (!ObjectId.isValid(relatedId)) {
      return errorResponse('Invalid relatedId format', 400);
    }

    const db = await getDatabase();
    const relatedObjectId = new ObjectId(relatedId);

    // Get approval history from approvals collection
    const approvals = await db
      .collection('approvals')
      .find({
        relatedId: relatedObjectId,
        relatedModel: relatedModel.toUpperCase(),
      })
      .sort({ timestamp: -1 })
      .toArray();

    // Also try to get approvalChain from the item itself
    const modelCollectionMap = {
      MATERIAL: 'materials',
      EXPENSE: 'expenses',
      INITIAL_EXPENSE: 'initial_expenses',
      MATERIAL_REQUEST: 'material_requests',
      LABOUR_ENTRY: 'labour_entries',
      PROFESSIONAL_FEE: 'professional_fees',
      PROFESSIONAL_ACTIVITY: 'professional_activities',
      BUDGET_REALLOCATION: 'budget_reallocations',
      PURCHASE_ORDER: 'purchase_orders',
      CONTINGENCY_DRAW: 'contingency_draws',
    };

    const collectionName = modelCollectionMap[relatedModel.toUpperCase()];
    let itemApprovalChain = [];

    if (collectionName) {
      const item = await db.collection(collectionName).findOne({
        _id: relatedObjectId,
      });

      if (item) {
        itemApprovalChain = item.approvalChain || item.approvalHistory || [];
      }
    }

    // Merge and deduplicate approvals
    const allApprovals = [...approvals];
    
    // Add approvalChain entries that aren't already in approvals collection
    itemApprovalChain.forEach((chainEntry) => {
      const exists = approvals.some(
        (approval) =>
          approval.approverId?.toString() === chainEntry.approverId?.toString() &&
          new Date(approval.timestamp).getTime() === new Date(chainEntry.approvedAt || chainEntry.timestamp).getTime()
      );
      
      if (!exists) {
        allApprovals.push({
          action: chainEntry.status === 'approved' ? 'APPROVED' : chainEntry.status === 'rejected' ? 'REJECTED' : 'PENDING',
          status: chainEntry.status,
          approverId: chainEntry.approverId,
          approverName: chainEntry.approverName,
          approvedByName: chainEntry.approverName,
          notes: chainEntry.notes,
          approvalNotes: chainEntry.notes,
          reason: chainEntry.reason,
          timestamp: chainEntry.approvedAt || chainEntry.timestamp || chainEntry.createdAt,
          approvedAt: chainEntry.approvedAt,
          approvalDate: chainEntry.approvedAt,
        });
      }
    });

    // Sort by timestamp descending
    allApprovals.sort((a, b) => {
      const aTime = new Date(a.timestamp || a.approvedAt || a.approvalDate || 0).getTime();
      const bTime = new Date(b.timestamp || b.approvedAt || b.approvalDate || 0).getTime();
      return bTime - aTime;
    });

    return successResponse(
      {
        approvals: allApprovals,
        count: allApprovals.length,
      },
      'Approval history retrieved successfully'
    );
  } catch (error) {
    console.error('Get approval history error:', error);
    return errorResponse('Failed to retrieve approval history', 500);
  }
}
