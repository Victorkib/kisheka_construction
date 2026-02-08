/**
 * Professional Activities API Route
 * GET: List all professional activities with filtering and pagination
 * POST: Create new professional activity
 * 
 * GET /api/professional-activities
 * POST /api/professional-activities
 * Auth: All authenticated users (GET), OWNER/PM/CLERK (POST)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  validateProfessionalActivity,
  ACTIVITY_STATUSES,
  generateActivityCode,
} from '@/lib/schemas/professional-activities-schema';
import { normalizeUserRole, isRole } from '@/lib/role-constants';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/professional-activities
 * Returns professional activities with filtering, sorting, and pagination
 * Query params: professionalServiceId, projectId, phaseId, activityType, status, search, page, limit, sortBy, sortOrder
 * Auth: All authenticated users
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const professionalServiceId = searchParams.get('professionalServiceId');
    const projectId = searchParams.get('projectId');
    const phaseId = searchParams.get('phaseId');
    const activityType = searchParams.get('activityType');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'activityDate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const db = await getDatabase();

    // Build query
    const query = { deletedAt: null };

    if (professionalServiceId && ObjectId.isValid(professionalServiceId)) {
      query.professionalServiceId = new ObjectId(professionalServiceId);
    }

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      query.phaseId = new ObjectId(phaseId);
    }

    if (activityType) {
      query.activityType = activityType;
    }

    if (status && ACTIVITY_STATUSES.includes(status)) {
      query.status = status;
    }

    // Text search
    if (search && search.trim()) {
      query.$or = [
        { activityCode: { $regex: search.trim(), $options: 'i' } },
        { notes: { $regex: search.trim(), $options: 'i' } },
        { observations: { $regex: search.trim(), $options: 'i' } },
        { recommendations: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const skip = (page - 1) * limit;
    const activities = await db.collection('professional_activities')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Populate related data
    const activitiesWithDetails = await Promise.all(
      activities.map(async (activity) => {
        const professionalService = await db.collection('professional_services').findOne({
          _id: activity.professionalServiceId,
        });

        const library = activity.libraryId
          ? await db.collection('professional_services_library').findOne({
              _id: activity.libraryId,
            })
          : null;

        const project = await db.collection('projects').findOne({
          _id: activity.projectId,
        });

        const phase = activity.phaseId
          ? await db.collection('phases').findOne({
              _id: activity.phaseId,
            })
          : null;

        return {
          ...activity,
          professionalService: professionalService
            ? {
                _id: professionalService._id.toString(),
                professionalCode: professionalService.professionalCode,
                type: professionalService.type,
              }
            : null,
          library: library
            ? {
                _id: library._id.toString(),
                name: library.name,
                type: library.type,
              }
            : null,
          project: project
            ? {
                _id: project._id.toString(),
                projectCode: project.projectCode,
                projectName: project.projectName,
              }
            : null,
          phase: phase
            ? {
                _id: phase._id.toString(),
                phaseName: phase.phaseName,
                phaseCode: phase.phaseCode,
              }
            : null,
        };
      })
    );

    const total = await db.collection('professional_activities').countDocuments(query);

    return successResponse({
      activities: activitiesWithDetails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get professional activities error:', error);
    return errorResponse('Failed to retrieve professional activities', 500);
  }
}

/**
 * POST /api/professional-activities
 * Creates a new professional activity
 * Auth: OWNER/PM/CLERK
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - OWNER, PM, CLERK can create activities
    const canCreate = await hasPermission(user.id, 'create_professional_activity');
    if (!canCreate) {
      return errorResponse('Insufficient permissions. Only OWNER, PM, and CLERK can create professional activities.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.professionalServiceId || !ObjectId.isValid(body.professionalServiceId)) {
      return errorResponse('Valid professionalServiceId is required', 400);
    }

    if (!body.projectId || !ObjectId.isValid(body.projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    if (!body.activityType) {
      return errorResponse('Activity type is required', 400);
    }

    if (!body.activityDate) {
      return errorResponse('Activity date is required', 400);
    }

    const db = await getDatabase();

    // Verify professional service assignment exists
    const professionalService = await db.collection('professional_services').findOne({
      _id: new ObjectId(body.professionalServiceId),
      projectId: new ObjectId(body.projectId),
      deletedAt: null,
    });

    if (!professionalService) {
      return errorResponse('Professional service assignment not found or does not belong to this project', 404);
    }

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(body.projectId),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Verify phase if provided
    if (body.phaseId) {
      if (!ObjectId.isValid(body.phaseId)) {
        return errorResponse('Valid phaseId is required if provided', 400);
      }
      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(body.phaseId),
        projectId: new ObjectId(body.projectId),
      });
      if (!phase) {
        return errorResponse('Phase not found or does not belong to this project', 404);
      }
    }

    // Verify template if provided
    if (body.templateId) {
      if (!ObjectId.isValid(body.templateId)) {
        return errorResponse('Valid templateId is required if provided', 400);
      }
      const template = await db.collection('activity_templates').findOne({
        _id: new ObjectId(body.templateId),
        deletedAt: null,
      });
      if (!template) {
        return errorResponse('Activity template not found', 404);
      }
    }

    // Validate activity data
    const validation = validateProfessionalActivity(body, professionalService);
    if (!validation.isValid) {
      return errorResponse(validation.errors.join(', '), 400);
    }

    // Generate activity code
    const existingCount = await db.collection('professional_activities').countDocuments({
      professionalServiceId: new ObjectId(body.professionalServiceId),
      deletedAt: null,
    });

    const activityCode = generateActivityCode(
      professionalService.type,
      existingCount + 1
    );

    // Build activity document
    const requestedRequiresApproval = body.requiresApproval !== undefined ? body.requiresApproval : true;
    const requestedStatus = body.status || (requestedRequiresApproval ? 'pending_approval' : 'approved');
    const userRole = normalizeUserRole(userProfile.role);
    const canAutoApprove = isRole(userRole, 'owner') || isRole(userRole, 'pm') || isRole(userRole, 'project_manager');
    const shouldAutoApprove = canAutoApprove && requestedStatus === 'pending_approval';

    const activity = {
      professionalServiceId: new ObjectId(body.professionalServiceId),
      libraryId: professionalService.libraryId,
      projectId: new ObjectId(body.projectId),
      phaseId: body.phaseId && ObjectId.isValid(body.phaseId) ? new ObjectId(body.phaseId) : null,
      floorId: body.floorId && ObjectId.isValid(body.floorId) ? new ObjectId(body.floorId) : null,
      templateId: body.templateId && ObjectId.isValid(body.templateId) ? new ObjectId(body.templateId) : null,
      activityCode,
      activityType: body.activityType,
      activityDate: new Date(body.activityDate),
      visitPurpose: body.visitPurpose || null,
      visitDuration: body.visitDuration ? parseFloat(body.visitDuration) : null,
      attendees: Array.isArray(body.attendees) ? body.attendees.filter(a => a && a.trim()).map(a => a.trim()) : [],
      revisionNumber: body.revisionNumber || null,
      revisionReason: body.revisionReason || null,
      affectedAreas: Array.isArray(body.affectedAreas) ? body.affectedAreas.filter(a => a && a.trim()).map(a => a.trim()) : [],
      previousRevisionId: body.previousRevisionId && ObjectId.isValid(body.previousRevisionId) ? new ObjectId(body.previousRevisionId) : null,
      inspectionType: body.inspectionType || null,
      areasInspected: Array.isArray(body.areasInspected) ? body.areasInspected.filter(a => a && a.trim()).map(a => a.trim()) : [],
      inspectionDuration: body.inspectionDuration ? parseFloat(body.inspectionDuration) : null,
      complianceStatus: body.complianceStatus || null,
      codeCompliance: body.codeCompliance !== undefined ? body.codeCompliance : null,
      designCompliance: body.designCompliance !== undefined ? body.designCompliance : null,
      qualityStandards: body.qualityStandards !== undefined ? body.qualityStandards : null,
      issuesFound: Array.isArray(body.issuesFound) ? body.issuesFound.map(issue => ({
        issueId: issue.issueId && ObjectId.isValid(issue.issueId) ? new ObjectId(issue.issueId) : null,
        description: issue.description || '',
        severity: issue.severity || 'minor',
        location: issue.location || null,
        status: issue.status || 'identified',
        resolutionDate: issue.resolutionDate ? new Date(issue.resolutionDate) : null,
        resolutionNotes: issue.resolutionNotes || null,
        materialId: issue.materialId && ObjectId.isValid(issue.materialId) ? new ObjectId(issue.materialId) : null,
      })) : [],
      materialTests: Array.isArray(body.materialTests) ? body.materialTests.map(test => ({
        materialId: test.materialId && ObjectId.isValid(test.materialId) ? new ObjectId(test.materialId) : null,
        materialName: test.materialName || '',
        testType: test.testType || 'quality',
        testResult: test.testResult || 'pending',
        testReportUrl: test.testReportUrl || null,
        testDate: test.testDate ? new Date(test.testDate) : new Date(),
      })) : [],
      documents: Array.isArray(body.documents) ? body.documents.map(doc => ({
        documentType: doc.documentType || 'other',
        documentName: doc.documentName || '',
        documentUrl: doc.documentUrl || '',
        documentVersion: doc.documentVersion || null,
        uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
        uploadedBy: doc.uploadedBy && ObjectId.isValid(doc.uploadedBy) ? new ObjectId(doc.uploadedBy) : new ObjectId(userProfile._id),
        description: doc.description || null,
      })) : [],
      feesCharged: body.feesCharged ? parseFloat(body.feesCharged) : 0,
      expensesIncurred: body.expensesIncurred ? parseFloat(body.expensesIncurred) : 0,
      paymentStatus: body.paymentStatus || null,
      feeId: body.feeId && ObjectId.isValid(body.feeId) ? new ObjectId(body.feeId) : null,
      notes: body.notes || null,
      observations: body.observations || null,
      recommendations: body.recommendations || null,
      followUpRequired: body.followUpRequired || false,
      followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
      status: shouldAutoApprove ? 'approved' : requestedStatus,
      requiresApproval: shouldAutoApprove ? false : requestedRequiresApproval,
      approvedBy: shouldAutoApprove ? new ObjectId(userProfile._id) : null,
      approvedAt: shouldAutoApprove ? new Date() : null,
      approvalNotes: shouldAutoApprove ? 'Auto-approved by Owner/PM at creation' : null,
      approvalChain: shouldAutoApprove ? [{
        approverId: new ObjectId(userProfile._id),
        approverName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
        status: 'approved',
        notes: 'Auto-approved by Owner/PM at creation',
        approvedAt: new Date(),
      }] : [],
      createdBy: new ObjectId(userProfile._id),
      createdByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Insert activity
    const result = await db.collection('professional_activities').insertOne(activity);

    // Update professional service assignment statistics
    const updateStats = {
      $inc: {
        totalActivities: 1,
      },
      $set: {
        lastActivityDate: activity.activityDate,
        updatedAt: new Date(),
      },
    };

    // Update type-specific stats
    if (activity.activityType === 'site_visit' || activity.activityType === 'client_meeting') {
      updateStats.$inc.totalSiteVisits = 1;
    }

    if (activity.activityType === 'inspection' || activity.activityType === 'quality_check') {
      updateStats.$inc.totalInspections = 1;
    }

    if (activity.activityType === 'design_revision') {
      updateStats.$inc.revisionsMade = 1;
    }

    if (activity.issuesFound && activity.issuesFound.length > 0) {
      updateStats.$inc.issuesIdentified = activity.issuesFound.length;
    }

    if (activity.documents && activity.documents.length > 0) {
      updateStats.$inc.documentsUploaded = activity.documents.length;
    }

    await db.collection('professional_services').findOneAndUpdate(
      { _id: new ObjectId(body.professionalServiceId) },
      updateStats
    );

    // Create notifications for approvers if approval is required
    if (activity.requiresApproval && activity.status === 'pending_approval') {
      const { createNotifications } = await import('@/lib/notifications');
      
      // Get approvers (PM, OWNER)
      const approvers = await db.collection('users').find({
        role: { $in: ['pm', 'project_manager', 'owner'] },
        status: 'active',
      }).toArray();

      if (approvers.length > 0) {
        const notifications = approvers.map(approver => ({
          userId: approver._id.toString(),
          type: 'approval_needed',
          title: 'New Professional Activity',
          message: `${activity.createdByName} created a ${activity.activityType.replace('_', ' ')} activity (${activity.activityCode}) that requires approval`,
          projectId: activity.projectId.toString(),
          relatedModel: 'PROFESSIONAL_ACTIVITY',
          relatedId: result.insertedId.toString(),
          createdBy: userProfile._id.toString(),
        }));

        await createNotifications(notifications);
      }
    }

    // Create audit log
    const { createAuditLog } = await import('@/lib/audit-log');
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'PROFESSIONAL_ACTIVITY',
      entityId: result.insertedId.toString(),
      projectId: body.projectId,
      changes: { created: activity },
    });

    // Populate response with related data
    const responseActivity = {
      ...activity,
      _id: result.insertedId,
      professionalService: {
        _id: professionalService._id.toString(),
        professionalCode: professionalService.professionalCode,
        type: professionalService.type,
      },
      project: {
        _id: project._id.toString(),
        projectCode: project.projectCode,
        projectName: project.projectName,
      },
    };

    return successResponse(
      responseActivity,
      'Professional activity created successfully',
      201
    );
  } catch (error) {
    console.error('Create professional activity error:', error);
    return errorResponse('Failed to create professional activity', 500);
  }
}

