/**
 * Site Report Detail API Route
 * GET: Get a single report
 * PATCH: Update report (draft/submitted)
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateSiteReport } from '@/lib/schemas/site-report-schema';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const hasAccess = await hasPermission(user.id, 'view_site_reports');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions', 403);
    }

    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid report ID is required', 400);
    }

    const db = await getDatabase();
    const report = await db.collection('site_reports').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!report) {
      return errorResponse('Site report not found', 404);
    }

    // Populate work items and phase/project names
    const [project, phase, workItems] = await Promise.all([
      db.collection('projects').findOne({ _id: report.projectId }),
      db.collection('phases').findOne({ _id: report.phaseId }),
      report.workItemIds?.length
        ? db.collection('work_items').find({
          _id: { $in: report.workItemIds },
          deletedAt: null,
        }).toArray()
        : [],
    ]);

    const workItemMap = {};
    (workItems || []).forEach((item) => {
      workItemMap[item._id.toString()] = item.name;
    });

    const labourEntries = (report.labourEntries || []).map((entry) => ({
      ...entry,
      workItemName: entry.workItemId ? workItemMap[entry.workItemId.toString()] || null : null,
    }));

    return successResponse(
      {
        ...report,
        labourEntries,
        projectName: project?.projectName || null,
        phaseName: phase?.phaseName || null,
        workItems: (workItems || []).map((item) => ({
          workItemId: item._id.toString(),
          workItemName: item.name,
          workItemStatus: item.status,
        })),
      },
      'Site report retrieved successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/site-reports/[id] error:', error);
    return errorResponse('Failed to retrieve site report', 500);
  }
}

export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const hasAccess = await hasPermission(user.id, 'edit_site_report');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { id } = await params;
    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid report ID is required', 400);
    }

    const db = await getDatabase();
    const existing = await db.collection('site_reports').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existing) {
      return errorResponse('Site report not found', 404);
    }

    if (!['draft', 'submitted'].includes(existing.status)) {
      return errorResponse('Only draft or submitted reports can be edited', 400);
    }

    const body = await request.json();
    const updatedReport = {
      ...existing,
      ...body,
      updatedAt: new Date(),
    };

    // Ensure labour entries reference valid work items
    if (updatedReport.workItemIds && updatedReport.labourEntries) {
      const workItemIds = updatedReport.workItemIds.map((id) => id.toString());
      const invalidEntry = updatedReport.labourEntries.some((entry) => {
        if (!entry.workItemId) return false;
        return !workItemIds.includes(entry.workItemId.toString());
      });
      if (invalidEntry) {
        return errorResponse('Labour entries must reference selected work items', 400);
      }
    }

    const validation = validateSiteReport(updatedReport);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    await db.collection('site_reports').updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedReport }
    );

    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'SITE_REPORT',
      entityId: id,
      projectId: existing.projectId?.toString(),
      phaseId: existing.phaseId?.toString(),
      changes: {
        before: existing,
        after: updatedReport,
      },
    });

    return successResponse(updatedReport, 'Site report updated successfully');
  } catch (error) {
    console.error('PATCH /api/labour/site-reports/[id] error:', error);
    return errorResponse(error.message || 'Failed to update site report', 500);
  }
}
