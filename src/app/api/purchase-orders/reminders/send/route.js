/**
 * Send Purchase Order Reminders API Route
 * POST: Manually trigger reminder sending for pending purchase orders
 * 
 * POST /api/purchase-orders/reminders/send
 * Auth: PM, OWNER
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendPendingReminders } from '@/lib/reminder-service';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/reminders/send
 * Send reminders for pending purchase orders
 * Body: { projectId?: string, daysSinceSent?: number, maxReminders?: number, dryRun?: boolean }
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
      return errorResponse('Insufficient permissions. Only PM and OWNER can send reminders.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const {
      projectId = null,
      daysSinceSent = 3,
      maxReminders = 3,
      dryRun = false
    } = body;

    // Validate parameters
    if (daysSinceSent < 0 || daysSinceSent > 30) {
      return errorResponse('daysSinceSent must be between 0 and 30', 400);
    }

    if (maxReminders < 1 || maxReminders > 10) {
      return errorResponse('maxReminders must be between 1 and 10', 400);
    }

    // Send reminders
    const result = await sendPendingReminders({
      projectId,
      daysSinceSent,
      maxReminders,
      dryRun
    });

    return successResponse(result, dryRun 
      ? 'Reminder preview generated successfully' 
      : 'Reminders sent successfully');
  } catch (error) {
    console.error('Send reminders error:', error);
    return errorResponse('Failed to send reminders', 500);
  }
}













