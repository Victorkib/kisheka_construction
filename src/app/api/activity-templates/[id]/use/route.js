/**
 * Activity Template Use API Route
 * POST /api/activity-templates/[id]/use
 * Uses a template to create a professional activity
 * Auth: OWNER/PM/CLERK
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { generateActivityCode, validateProfessionalActivity } from '@/lib/schemas/professional-activities-schema';

/**
 * POST /api/activity-templates/[id]/use
 * Use a template to create a professional activity
 * Auth: OWNER/PM/CLERK
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canUse = await hasPermission(user.id, 'use_activity_template');
    if (!canUse) {
      return errorResponse('Insufficient permissions. Only OWNER, PM, and CLERK can use activity templates.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid template ID', 400);
    }

    const body = await request.json();
    const {
      professionalServiceId,
      projectId,
      phaseId,
      floorId,
      activityDate,
      overrideData = {}, // Allow overriding template defaults
    } = body;

    // Validate required fields
    if (!professionalServiceId || !ObjectId.isValid(professionalServiceId)) {
      return errorResponse('Valid professionalServiceId is required', 400);
    }

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    if (!activityDate) {
      return errorResponse('Activity date is required', 400);
    }

    const db = await getDatabase();

    // Get template
    const template = await db.collection('activity_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!template) {
      return errorResponse('Activity template not found', 404);
    }

    // Get professional service assignment
    const professionalService = await db.collection('professional_services').findOne({
      _id: new ObjectId(professionalServiceId),
      projectId: new ObjectId(projectId),
      deletedAt: null,
    });

    if (!professionalService) {
      return errorResponse('Professional service assignment not found or does not belong to this project', 404);
    }

    // Verify template type matches professional type
    const professionalType = professionalService.type; // 'architect' or 'engineer'
    const expectedTemplateType = professionalType === 'architect' 
      ? 'architect_activity' 
      : 'engineer_activity';
    
    if (template.type !== expectedTemplateType) {
      return errorResponse(`Template type '${template.type}' does not match professional type '${professionalType}'`, 400);
    }

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Verify phase if provided
    if (phaseId) {
      if (!ObjectId.isValid(phaseId)) {
        return errorResponse('Valid phaseId is required if provided', 400);
      }
      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(phaseId),
        projectId: new ObjectId(projectId),
      });
      if (!phase) {
        return errorResponse('Phase not found or does not belong to this project', 404);
      }
    }

    // Verify floor if provided
    if (floorId) {
      if (!ObjectId.isValid(floorId)) {
        return errorResponse('Valid floorId is required if provided', 400);
      }
      const floor = await db.collection('floors').findOne({
        _id: new ObjectId(floorId),
        projectId: new ObjectId(projectId),
      });
      if (!floor) {
        return errorResponse('Floor not found or does not belong to this project', 404);
      }
    }

    // Generate activity code
    const existingCount = await db.collection('professional_activities').countDocuments({
      professionalServiceId: new ObjectId(professionalServiceId),
      deletedAt: null,
    });

    const activityCode = generateActivityCode(
      professionalType,
      existingCount + 1
    );

    // Build activity from template with overrides
    const activity = {
      professionalServiceId: new ObjectId(professionalServiceId),
      libraryId: professionalService.libraryId,
      projectId: new ObjectId(projectId),
      phaseId: phaseId && ObjectId.isValid(phaseId) ? new ObjectId(phaseId) : null,
      floorId: floorId && ObjectId.isValid(floorId) ? new ObjectId(floorId) : null,
      templateId: new ObjectId(id),
      activityCode,
      activityType: overrideData.activityType || template.activityType,
      activityDate: new Date(activityDate),
      visitPurpose: overrideData.visitPurpose || template.defaultData?.visitPurpose || null,
      visitDuration: overrideData.visitDuration !== undefined ? parseFloat(overrideData.visitDuration) : (template.defaultData?.visitDuration || null),
      attendees: overrideData.attendees || template.defaultData?.attendees || [],
      revisionNumber: overrideData.revisionNumber || null,
      revisionReason: overrideData.revisionReason || template.defaultData?.revisionReason || null,
      affectedAreas: overrideData.affectedAreas || template.defaultData?.affectedAreas || [],
      inspectionType: overrideData.inspectionType || template.defaultData?.inspectionType || null,
      areasInspected: overrideData.areasInspected || template.defaultData?.areasInspected || [],
      inspectionDuration: overrideData.inspectionDuration !== undefined ? parseFloat(overrideData.inspectionDuration) : (template.defaultData?.inspectionDuration || null),
      complianceStatus: overrideData.complianceStatus || template.defaultData?.complianceStatus || null,
      codeCompliance: overrideData.codeCompliance !== undefined ? overrideData.codeCompliance : null,
      designCompliance: overrideData.designCompliance !== undefined ? overrideData.designCompliance : null,
      qualityStandards: overrideData.qualityStandards !== undefined ? overrideData.qualityStandards : null,
      issuesFound: overrideData.issuesFound || [],
      materialTests: overrideData.materialTests || [],
      documents: overrideData.documents || [],
      feesCharged: overrideData.feesCharged !== undefined ? parseFloat(overrideData.feesCharged) : (template.defaultFeeAmount || null),
      expensesIncurred: overrideData.expensesIncurred !== undefined ? parseFloat(overrideData.expensesIncurred) : (template.defaultExpenseAmount || null),
      paymentStatus: 'pending',
      feeId: null,
      notes: overrideData.notes || template.defaultData?.notes || null,
      observations: overrideData.observations || template.defaultData?.observations || null,
      recommendations: overrideData.recommendations || template.defaultData?.recommendations || null,
      followUpRequired: overrideData.followUpRequired || false,
      followUpDate: overrideData.followUpDate ? new Date(overrideData.followUpDate) : null,
      status: 'draft',
      requiresApproval: overrideData.requiresApproval !== undefined ? overrideData.requiresApproval : true,
      approvedBy: null,
      approvedAt: null,
      approvalNotes: null,
      approvalChain: [],
      createdBy: new ObjectId(userProfile._id),
      createdByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Validate activity data
    const validation = validateProfessionalActivity(activity, professionalService);
    if (!validation.isValid) {
      return errorResponse(validation.errors.join(', '), 400);
    }

    // Insert activity
    const result = await db.collection('professional_activities').insertOne(activity);

    // Update template usage
    await db.collection('activity_templates').updateOne(
      { _id: new ObjectId(id) },
      {
        $inc: { usageCount: 1 },
        $set: {
          lastUsedAt: new Date(),
          lastUsedBy: new ObjectId(userProfile._id),
          lastUsedInProject: new ObjectId(projectId),
          updatedAt: new Date(),
        },
      }
    );

    // Update professional service assignment statistics
    await db.collection('professional_services').findOneAndUpdate(
      { _id: new ObjectId(professionalServiceId) },
      {
        $inc: {
          totalActivities: 1,
          totalSiteVisits: activity.activityType === 'site_visit' ? 1 : 0,
          totalInspections: activity.activityType === 'inspection' ? 1 : 0,
          totalDesignRevisions: activity.activityType === 'design_revision' ? 1 : 0,
        },
        $set: {
          lastActivityDate: activity.activityDate,
          updatedAt: new Date(),
        },
      }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'PROFESSIONAL_ACTIVITY',
      entityId: result.insertedId.toString(),
      projectId: projectId,
      changes: {
        created: activity,
        templateUsed: id,
      },
    });

    return successResponse({
      activity: { ...activity, _id: result.insertedId },
      template: {
        _id: template._id,
        name: template.name,
      },
    }, 'Activity created from template successfully', 201);
  } catch (error) {
    console.error('Use activity template error:', error);
    return errorResponse('Failed to create activity from template', 500);
  }
}

