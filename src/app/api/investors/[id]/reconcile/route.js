/**
 * Investor Reconcile API Route
 * POST /api/investors/[id]/reconcile
 * Repairs contribution history to match totalInvested
 * Auth: OWNER only
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const canManage = await hasPermission(user.id, 'manage_investors');
    if (!canManage) {
      return errorResponse('Permission denied. Only OWNER can reconcile investors.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid investor ID', 400);
    }

    const db = await getDatabase();
    const investor = await db.collection('investors').findOne({ _id: new ObjectId(id) });
    if (!investor) {
      return errorResponse('Investor not found', 404);
    }

    const contributions = investor.contributions || [];
    const contributionsTotal = contributions
      .filter((entry) => entry.type !== 'RETURN')
      .reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const totalInvested = investor.totalInvested || 0;
    const delta = totalInvested - contributionsTotal;

    if (Math.abs(delta) < 0.01) {
      return successResponse(
        { reconciled: false, delta: 0 },
        'No reconciliation needed. Totals already match.'
      );
    }

    const adjustmentEntry = {
      amount: delta,
      date: new Date(),
      type: delta < 0 ? 'RETURN' : 'ADJUSTMENT',
      notes: delta < 0
        ? 'Capital return reconciliation to match totalInvested.'
        : 'Contribution reconciliation to match totalInvested.',
      receiptUrl: null,
    };

    const updatedContributions = [...contributions, adjustmentEntry];

    await db.collection('investors').updateOne(
      { _id: investor._id },
      {
        $set: {
          contributions: updatedContributions,
          updatedAt: new Date(),
        },
      }
    );

    await createAuditLog({
      userId: userProfile._id,
      action: 'RECONCILED_INVESTOR_CONTRIBUTIONS',
      resourceType: 'investor',
      resourceId: new ObjectId(id),
      details: {
        contributionDelta: delta,
        totalInvested,
        contributionsTotal,
      },
    });

    return successResponse(
      {
        reconciled: true,
        delta,
        totalInvested,
        contributionsTotal,
      },
      'Investor contributions reconciled successfully.'
    );
  } catch (error) {
    console.error('Reconcile investor error:', error);
    return errorResponse('Failed to reconcile investor contributions', 500);
  }
}
