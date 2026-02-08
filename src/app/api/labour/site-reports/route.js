/**
 * Site Reports API Route
 * GET: List site reports with filters
 * POST: Create new site report
 *
 * GET /api/labour/site-reports
 * POST /api/labour/site-reports
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  createSiteReport,
  validateSiteReport,
  generateSiteReportNumber,
} from '@/lib/schemas/site-report-schema';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const phaseId = searchParams.get('phaseId');
    const status = searchParams.get('status');
    const reportedBy = searchParams.get('reportedBy');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const db = await getDatabase();
    const query = { deletedAt: null };

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      query.phaseId = new ObjectId(phaseId);
    }

    if (status) {
      query.status = status;
    }

    if (reportedBy) {
      query.reportedByName = { $regex: reportedBy, $options: 'i' };
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const skip = (page - 1) * limit;

    const reports = await db
      .collection('site_reports')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    const projectIds = [...new Set(reports.map((r) => r.projectId?.toString()).filter(Boolean))];
    const phaseIds = [...new Set(reports.map((r) => r.phaseId?.toString()).filter(Boolean))];

    const projects = projectIds.length > 0
      ? await db.collection('projects').find({
        _id: { $in: projectIds.map((id) => new ObjectId(id)) },
      }).toArray()
      : [];
    const phases = phaseIds.length > 0
      ? await db.collection('phases').find({
        _id: { $in: phaseIds.map((id) => new ObjectId(id)) },
      }).toArray()
      : [];

    const projectMap = {};
    projects.forEach((project) => {
      projectMap[project._id.toString()] = project.projectName;
    });
    const phaseMap = {};
    phases.forEach((phase) => {
      phaseMap[phase._id.toString()] = phase.phaseName;
    });

    const reportsWithNames = reports.map((report) => ({
      ...report,
      projectName: report.projectId ? projectMap[report.projectId.toString()] || null : null,
      phaseName: report.phaseId ? phaseMap[report.phaseId.toString()] || null : null,
    }));

    const total = await db.collection('site_reports').countDocuments(query);

    return successResponse(
      {
        reports: reportsWithNames,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Site reports retrieved successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/site-reports error:', error);
    return errorResponse('Failed to retrieve site reports', 500);
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const hasAccess = await hasPermission(user.id, 'create_site_report');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const {
      projectId,
      phaseId,
      floorId,
      workItemIds = [],
      entryDate,
      submissionChannel = 'in_person',
      reportedByName,
      summary,
      notes,
      labourEntries = [],
      attachments = [],
      status = 'submitted',
    } = body;

    const db = await getDatabase();

    // Verify project and phase
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      deletedAt: null,
    });
    if (!project) {
      return errorResponse('Project not found', 404);
    }

    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(phaseId),
      projectId: new ObjectId(projectId),
      deletedAt: null,
    });
    if (!phase) {
      return errorResponse('Phase not found for this project', 404);
    }

    // Validate work items
    const validWorkItemIds = Array.isArray(workItemIds)
      ? workItemIds.filter((id) => ObjectId.isValid(id))
      : [];
    if (validWorkItemIds.length > 0) {
      const workItems = await db.collection('work_items').find({
        _id: { $in: validWorkItemIds.map((id) => new ObjectId(id)) },
        projectId: new ObjectId(projectId),
        phaseId: new ObjectId(phaseId),
        deletedAt: null,
      }).toArray();

      if (workItems.length !== validWorkItemIds.length) {
        return errorResponse('One or more work items are invalid for this phase', 400);
      }
    }

    // Ensure labour entries link to work items
    const normalizedEntries = Array.isArray(labourEntries)
      ? labourEntries.map((entry) => ({
        ...entry,
        workItemId: entry.workItemId || null,
      }))
      : [];
    const missingWorkItem = normalizedEntries.some(
      (entry) => entry.workItemId && !ObjectId.isValid(entry.workItemId)
    );
    if (missingWorkItem) {
      return errorResponse('Labour entries must include valid workItemId values', 400);
    }

    const workItemSet = new Set(validWorkItemIds);
    const entryOutsideSet = normalizedEntries.some(
      (entry) => entry.workItemId && !workItemSet.has(entry.workItemId)
    );
    if (entryOutsideSet) {
      return errorResponse('Labour entries must reference selected work items', 400);
    }

    const reportNumber = await generateSiteReportNumber(new Date(entryDate));
    const reportData = createSiteReport({
      reportNumber,
      projectId,
      phaseId,
      floorId,
      workItemIds: validWorkItemIds,
      entryDate,
      submissionChannel,
      reportedByUserId: userProfile._id,
      reportedByName: reportedByName || `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      reportedByRole: userProfile.role,
      summary,
      notes,
      labourEntries: normalizedEntries,
      attachments,
      status,
    });

    const validation = validateSiteReport(reportData);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    const result = await db.collection('site_reports').insertOne(reportData);

    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'SITE_REPORT',
      entityId: result.insertedId.toString(),
      projectId: projectId.toString(),
      phaseId: phaseId.toString(),
      changes: { created: reportData },
    });

    return successResponse(
      { ...reportData, _id: result.insertedId },
      'Site report created successfully',
      201
    );
  } catch (error) {
    console.error('POST /api/labour/site-reports error:', error);
    return errorResponse(error.message || 'Failed to create site report', 500);
  }
}
