/**
 * Send Delivery Reminders API Route
 * POST: Manually trigger delivery reminder sending for accepted purchase orders
 * 
 * POST /api/purchase-orders/reminders/delivery/send
 * Auth: PM, OWNER
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendPendingDeliveryReminders } from '@/lib/reminder-service';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/reminders/delivery/send
 * Send delivery reminders for accepted purchase orders with upcoming delivery dates
 * Body: { projectId?: string, daysBeforeDelivery?: number, maxReminders?: number, dryRun?: boolean }
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'manage_purchase_orders');
    if (!canManage) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can send delivery reminders.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const {
      projectId = null,
      daysBeforeDelivery = 1, // Default: send reminder 1 day before delivery
      maxReminders = 2, // Default: max 2 delivery reminders
      dryRun = false
    } = body;

    // Validate parameters
    if (daysBeforeDelivery < 0 || daysBeforeDelivery > 7) {
      return errorResponse('daysBeforeDelivery must be between 0 and 7', 400);
    }

    if (maxReminders < 1 || maxReminders > 5) {
      return errorResponse('maxReminders must be between 1 and 5', 400);
    }

    // Send delivery reminders
    const result = await sendPendingDeliveryReminders({
      projectId,
      daysBeforeDelivery,
      maxReminders,
      dryRun
    });

    return successResponse(result, dryRun ? 'Delivery reminders preview generated' : 'Delivery reminders sent successfully');
  } catch (error) {
    console.error('Send delivery reminders error:', error);
    return errorResponse('Failed to send delivery reminders', 500);
  }
}

