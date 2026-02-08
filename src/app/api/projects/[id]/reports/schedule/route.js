/**
 * Report Scheduling API Route
 * GET: Get scheduled reports
 * POST: Create a scheduled report
 * 
 * GET /api/projects/[id]/reports/schedule
 * POST /api/projects/[id]/reports/schedule
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
  createScheduledReport,
  getScheduledReports,
  updateScheduledReport,
  deleteScheduledReport,
} from '@/lib/report-scheduling-helpers';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/reports/schedule
 * Returns scheduled reports for a project
 * Auth: All authenticated users with project access
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
      return errorResponse('Invalid project ID', 400);
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Get scheduled reports
    const schedules = await getScheduledReports(id);

    const schedulesWithIds = schedules.map(schedule => ({
      ...schedule,
      _id: schedule._id.toString(),
      projectId: schedule.projectId.toString(),
      createdBy: schedule.createdBy.toString(),
    }));

    return successResponse({ schedules: schedulesWithIds });
  } catch (error) {
    console.error('Get scheduled reports error:', error);
    return errorResponse('Failed to retrieve scheduled reports', 500);
  }
}

/**
 * POST /api/projects/[id]/reports/schedule
 * Creates a new scheduled report
 * Auth: PM, OWNER
 */
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

    // Check permission
    const canSchedule = await hasPermission(user.id, 'schedule_reports');
    if (!canSchedule) {
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['pm', 'project_manager', 'owner'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse(
          'Insufficient permissions. Only PM and OWNER can schedule reports.',
          403
        );
      }
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const body = await request.json();
    const {
      reportType,
      frequency,
      dayOfWeek,
      dayOfMonth,
      time,
      recipients,
      options,
    } = body;

    // Validation
    if (!reportType || !['financial', 'summary', 'phases'].includes(reportType)) {
      return errorResponse('Valid reportType is required (financial, summary, or phases)', 400);
    }

    if (!frequency || !['daily', 'weekly', 'monthly'].includes(frequency)) {
      return errorResponse('Valid frequency is required (daily, weekly, or monthly)', 400);
    }

    if (frequency === 'weekly' && (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6)) {
      return errorResponse('dayOfWeek (0-6) is required for weekly frequency', 400);
    }

    if (frequency === 'monthly' && (dayOfMonth === undefined || dayOfMonth < 1 || dayOfMonth > 31)) {
      return errorResponse('dayOfMonth (1-31) is required for monthly frequency', 400);
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Create scheduled report
    const schedule = await createScheduledReport(
      {
        reportType,
        frequency,
        dayOfWeek,
        dayOfMonth,
        time: time || '09:00',
        recipients: recipients || [],
        options: options || {},
      },
      id,
      userProfile._id.toString()
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'SCHEDULED_REPORT',
      entityId: schedule._id.toString(),
      projectId: id,
      changes: { created: schedule },
    });

    return successResponse(
      { ...schedule, _id: schedule._id.toString() },
      'Scheduled report created successfully',
      201
    );
  } catch (error) {
    console.error('Create scheduled report error:', error);
    return errorResponse('Failed to create scheduled report', 500);
  }
}
