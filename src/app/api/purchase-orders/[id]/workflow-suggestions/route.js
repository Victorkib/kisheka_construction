/**
 * Purchase Order Workflow Suggestions API Route
 * GET /api/purchase-orders/[id]/workflow-suggestions
 * Get intelligent workflow suggestions based on order status
 * Auth: PM, OWNER
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { 
  getPostRejectionActions, 
  getModificationWorkflowSuggestions,
  needsImmediateAttention,
  getNextSteps
} from '@/lib/workflow-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/purchase-orders/[id]/workflow-suggestions
 * Get workflow suggestions for a purchase order
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canView = await hasPermission(user.id, 'view_purchase_orders');
    if (!canView) {
      return errorResponse('Insufficient permissions to view purchase orders', 403);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid order ID', 400);
    }

    const db = await getDatabase();

    // Get order
    const order = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!order) {
      return errorResponse('Purchase order not found', 404);
    }

    // Get suggestions based on order status
    let suggestions = {};
    let actions = {};
    let attention = {};
    let nextSteps = [];

    if (order.status === 'order_rejected') {
      actions = await getPostRejectionActions(order);
    } else if (order.status === 'order_modified') {
      suggestions = await getModificationWorkflowSuggestions(order);
    }

    attention = needsImmediateAttention(order);
    nextSteps = await getNextSteps(order);

    return successResponse({
      orderId: id,
      orderStatus: order.status,
      suggestions,
      actions,
      attention,
      nextSteps,
      timestamp: new Date()
    }, 'Workflow suggestions retrieved successfully');

  } catch (error) {
    console.error('Get workflow suggestions error:', error);
    return errorResponse('Failed to get workflow suggestions', 500);
  }
}
