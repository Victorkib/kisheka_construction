/**
 * Scheduled Report Management API Route
 * PUT: Update scheduled report
 * DELETE: Delete scheduled report
 * 
 * PUT /api/projects/[id]/reports/schedule/[scheduleId]
 * DELETE /api/projects/[id]/reports/schedule/[scheduleId]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  updateScheduledReport,
  deleteScheduledReport,
} from '@/lib/report-scheduling-helpers';

/**
 * PUT /api/projects/[id]/reports/schedule/[scheduleId]
 * Updates a scheduled report
 * Auth: PM, OWNER
 */
export async function PUT(request, { params }) {
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

    // Check permission
    const canSchedule = await hasPermission(user.id, 'schedule_reports');
    if (!canSchedule) {
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['pm', 'project_manager', 'owner'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse(
          'Insufficient permissions. Only PM and OWNER can manage scheduled reports.',
          403
        );
      }
    }

    const { id, scheduleId } = await params;

    if (!ObjectId.isValid(id) || !ObjectId.isValid(scheduleId)) {
      return errorResponse('Invalid project ID or schedule ID', 400);
    }

    const body = await request.json();
    const {
      frequency,
      dayOfWeek,
      dayOfMonth,
      time,
      recipients,
      options,
      isActive,
    } = body;

    const db = await getDatabase();

    // Verify schedule exists and belongs to project
    const existingSchedule = await db.collection('scheduled_reports').findOne({
      _id: new ObjectId(scheduleId),
      projectId: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingSchedule) {
      return errorResponse('Scheduled report not found', 404);
    }

    // Build update data
    const updateData = {};
    if (frequency !== undefined) updateData.frequency = frequency;
    if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek;
    if (dayOfMonth !== undefined) updateData.dayOfMonth = dayOfMonth;
    if (time !== undefined) updateData.time = time;
    if (recipients !== undefined) updateData.recipients = Array.isArray(recipients) ? recipients : [];
    if (options !== undefined) updateData.options = options;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update schedule
    const updatedSchedule = await updateScheduledReport(scheduleId, updateData);

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'SCHEDULED_REPORT',
      entityId: scheduleId,
      projectId: id,
      changes: { updated: updateData },
    });

    return successResponse(
      { ...updatedSchedule, _id: updatedSchedule._id.toString() },
      'Scheduled report updated successfully'
    );
  } catch (error) {
    console.error('Update scheduled report error:', error);
    return errorResponse('Failed to update scheduled report', 500);
  }
}

/**
 * DELETE /api/projects/[id]/reports/schedule/[scheduleId]
 * Deletes a scheduled report
 * Auth: PM, OWNER
 */
export async function DELETE(request, { params }) {
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

    // Check permission
    const canSchedule = await hasPermission(user.id, 'schedule_reports');
    if (!canSchedule) {
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['pm', 'project_manager', 'owner'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse(
          'Insufficient permissions. Only PM and OWNER can manage scheduled reports.',
          403
        );
      }
    }

    const { id, scheduleId } = await params;

    if (!ObjectId.isValid(id) || !ObjectId.isValid(scheduleId)) {
      return errorResponse('Invalid project ID or schedule ID', 400);
    }

    const db = await getDatabase();

    // Verify schedule exists and belongs to project
    const existingSchedule = await db.collection('scheduled_reports').findOne({
      _id: new ObjectId(scheduleId),
      projectId: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingSchedule) {
      return errorResponse('Scheduled report not found', 404);
    }

    // Delete schedule
    await deleteScheduledReport(scheduleId);

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'SCHEDULED_REPORT',
      entityId: scheduleId,
      projectId: id,
      changes: { deleted: existingSchedule },
    });

    return successResponse(null, 'Scheduled report deleted successfully');
  } catch (error) {
    console.error('Delete scheduled report error:', error);
    return errorResponse('Failed to delete scheduled report', 500);
  }
}
