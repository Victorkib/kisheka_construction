/**
 * Subcontractor Payment Management API Route
 * POST: Record a payment for a subcontractor
 * GET: Get payment history for a subcontractor
 * PATCH: Update payment status
 * 
 * POST /api/subcontractors/[id]/payments
 * GET /api/subcontractors/[id]/payments
 * PATCH /api/subcontractors/[id]/payments
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { recordSubcontractorPayment } from '@/lib/subcontractor-helpers';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';

/**
 * POST /api/subcontractors/[id]/payments
 * Records a payment for a subcontractor milestone
 * Auth: PM, OWNER, ACCOUNTANT only
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    const allowedRoles = ['owner', 'pm', 'project_manager', 'accountant'];
    if (!allowedRoles.includes(userRole)) {
      return errorResponse('Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can record payments.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid subcontractor ID', 400);
    }

    const body = await request.json();
    const { milestone, amount, paymentReference } = body;

    if (!milestone) {
      return errorResponse('Milestone name is required', 400);
    }

    if (!amount || amount <= 0) {
      return errorResponse('Payment amount is required and must be greater than 0', 400);
    }

    // Record payment using helper
    const updatedSubcontractor = await recordSubcontractorPayment(
      id,
      milestone,
      parseFloat(amount),
      paymentReference
    );

    // Recalculate phase spending
    try {
      await recalculatePhaseSpending(updatedSubcontractor.phaseId.toString());
    } catch (phaseError) {
      console.error('Error recalculating phase spending after payment:', phaseError);
      // Don't fail the request, just log the error
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'PAYMENT_RECORDED',
      entityType: 'SUBCONTRACTOR',
      entityId: id,
      projectId: updatedSubcontractor.projectId.toString(),
      changes: { payment: { milestone, amount, paymentReference } },
    });

    return successResponse(updatedSubcontractor, 'Payment recorded successfully');
  } catch (error) {
    console.error('Record payment error:', error);
    return errorResponse(error.message || 'Failed to record payment', 500);
  }
}

/**
 * GET /api/subcontractors/[id]/payments
 * Returns payment history for a subcontractor
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
      return errorResponse('Invalid subcontractor ID', 400);
    }

    const db = await getDatabase();
    const subcontractor = await db.collection('subcontractors').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!subcontractor) {
      return errorResponse('Subcontractor not found', 404);
    }

    const paymentSchedule = subcontractor.paymentSchedule || [];
    
    // Separate paid and unpaid payments
    const paidPayments = paymentSchedule.filter(p => p.paid === true);
    const unpaidPayments = paymentSchedule.filter(p => p.paid !== true);

    return successResponse({
      paymentSchedule: paymentSchedule,
      paidPayments: paidPayments,
      unpaidPayments: unpaidPayments,
      totalPaid: paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
      totalUnpaid: unpaidPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
      contractValue: subcontractor.contractValue || 0
    }, 'Payment history retrieved successfully');
  } catch (error) {
    console.error('Get payment history error:', error);
    return errorResponse('Failed to retrieve payment history', 500);
  }
}


