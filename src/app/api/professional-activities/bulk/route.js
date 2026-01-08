/**
 * Bulk Professional Activities API Route
 * POST: Create bulk professional activities batch
 * 
 * POST /api/professional-activities/bulk
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
import { validateProfessionalActivity, generateActivityCode } from '@/lib/schemas/professional-activities-schema';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';
import { normalizeUserRole, isRole } from '@/lib/role-constants';

/**
 * POST /api/professional-activities/bulk
 * Creates multiple professional activities in a batch
 * Auth: OWNER/PM/CLERK
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canCreate = await hasPermission(user.id, 'create_professional_activity');
    if (!canCreate) {
      return errorResponse(
        'Insufficient permissions. Only OWNER, PM, and CLERK can create professional activities.',
        403
      );
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const {
      projectId,
      professionalServiceId,
      activities,
      defaultPhaseId,
      defaultFloorId,
      autoApprove = false,
    } = body;

    // Validate required fields
    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    if (!professionalServiceId || !ObjectId.isValid(professionalServiceId)) {
      return errorResponse('Valid professionalServiceId is required', 400);
    }

    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      return errorResponse('At least one activity is required', 400);
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Verify professional service assignment exists
    const professionalService = await db.collection('professional_services').findOne({
      _id: new ObjectId(professionalServiceId),
      projectId: new ObjectId(projectId),
      deletedAt: null,
    });

    if (!professionalService) {
      return errorResponse('Professional service assignment not found or does not belong to this project', 404);
    }

    // Verify phase if provided
    if (defaultPhaseId) {
      if (!ObjectId.isValid(defaultPhaseId)) {
        return errorResponse('Valid defaultPhaseId is required if provided', 400);
      }
      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(defaultPhaseId),
        projectId: new ObjectId(projectId),
      });
      if (!phase) {
        return errorResponse('Phase not found or does not belong to this project', 404);
      }
    }

    // Verify floor if provided
    if (defaultFloorId) {
      if (!ObjectId.isValid(defaultFloorId)) {
        return errorResponse('Valid defaultFloorId is required if provided', 400);
      }
      const floor = await db.collection('floors').findOne({
        _id: new ObjectId(defaultFloorId),
        projectId: new ObjectId(projectId),
      });
      if (!floor) {
        return errorResponse('Floor not found or does not belong to this project', 404);
      }
    }

    const userRole = normalizeUserRole(userProfile.role);
    const willAutoApprove = autoApprove && isRole(userRole, 'owner');
    const initialStatus = willAutoApprove ? 'approved' : 'pending_approval';

    // Create activities in transaction
    const createdActivities = await withTransaction(async ({ db: transactionDb, session }) => {
      const activityIds = [];
      const createdActivities = [];

      // Get existing count for activity code generation
      const existingCount = await transactionDb.collection('professional_activities').countDocuments({
        professionalServiceId: new ObjectId(professionalServiceId),
        deletedAt: null,
      });

      const professionalType = professionalService.type; // 'architect' or 'engineer'

      for (let i = 0; i < activities.length; i++) {
        const activity = activities[i];

        // Validate activity data
        const activityData = {
          professionalServiceId: new ObjectId(professionalServiceId),
          libraryId: professionalService.libraryId,
          projectId: new ObjectId(projectId),
          phaseId: activity.phaseId && ObjectId.isValid(activity.phaseId) 
            ? new ObjectId(activity.phaseId) 
            : (defaultPhaseId && ObjectId.isValid(defaultPhaseId) ? new ObjectId(defaultPhaseId) : null),
          floorId: activity.floorId && ObjectId.isValid(activity.floorId)
            ? new ObjectId(activity.floorId)
            : (defaultFloorId && ObjectId.isValid(defaultFloorId) ? new ObjectId(defaultFloorId) : null),
          templateId: activity.templateId && ObjectId.isValid(activity.templateId) ? new ObjectId(activity.templateId) : null,
          activityCode: generateActivityCode(professionalType, existingCount + i + 1),
          activityType: activity.activityType,
          activityDate: new Date(activity.activityDate),
          visitPurpose: activity.visitPurpose || null,
          visitDuration: activity.visitDuration ? parseFloat(activity.visitDuration) : null,
          attendees: Array.isArray(activity.attendees) ? activity.attendees : [],
          revisionNumber: activity.revisionNumber || null,
          revisionReason: activity.revisionReason || null,
          affectedAreas: Array.isArray(activity.affectedAreas) ? activity.affectedAreas : [],
          inspectionType: activity.inspectionType || null,
          areasInspected: Array.isArray(activity.areasInspected) ? activity.areasInspected : [],
          inspectionDuration: activity.inspectionDuration ? parseFloat(activity.inspectionDuration) : null,
          complianceStatus: activity.complianceStatus || null,
          codeCompliance: activity.codeCompliance !== undefined ? activity.codeCompliance : null,
          designCompliance: activity.designCompliance !== undefined ? activity.designCompliance : null,
          qualityStandards: activity.qualityStandards !== undefined ? activity.qualityStandards : null,
          issuesFound: Array.isArray(activity.issuesFound) ? activity.issuesFound : [],
          materialTests: Array.isArray(activity.materialTests) ? activity.materialTests : [],
          documents: Array.isArray(activity.documents) ? activity.documents : [],
          feesCharged: activity.feesCharged ? parseFloat(activity.feesCharged) : null,
          expensesIncurred: activity.expensesIncurred ? parseFloat(activity.expensesIncurred) : null,
          paymentStatus: 'pending',
          feeId: null,
          notes: activity.notes || null,
          observations: activity.observations || null,
          recommendations: activity.recommendations || null,
          followUpRequired: activity.followUpRequired || false,
          followUpDate: activity.followUpDate ? new Date(activity.followUpDate) : null,
          status: initialStatus,
          requiresApproval: !willAutoApprove,
          approvedBy: willAutoApprove ? new ObjectId(userProfile._id) : null,
          approvedAt: willAutoApprove ? new Date() : null,
          approvalNotes: willAutoApprove ? 'Auto-approved by OWNER in bulk creation' : null,
          approvalChain: [],
          createdBy: new ObjectId(userProfile._id),
          createdByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        // Validate activity
        const validation = validateProfessionalActivity(activityData, professionalService);
        if (!validation.isValid) {
          throw new Error(`Activity ${i + 1} validation failed: ${validation.errors.join(', ')}`);
        }

        // Insert activity
        const result = await transactionDb.collection('professional_activities').insertOne(
          activityData,
          { session }
        );

        activityIds.push(result.insertedId);
        createdActivities.push({ ...activityData, _id: result.insertedId });
      }

      // Update professional service statistics
      await transactionDb.collection('professional_services').findOneAndUpdate(
        { _id: new ObjectId(professionalServiceId) },
        {
          $inc: {
            totalActivities: activities.length,
            totalSiteVisits: activities.filter(a => a.activityType === 'site_visit').length,
            totalInspections: activities.filter(a => a.activityType === 'inspection').length,
            totalDesignRevisions: activities.filter(a => a.activityType === 'design_revision').length,
          },
          $set: {
            lastActivityDate: activities.length > 0 ? new Date(activities[activities.length - 1].activityDate) : null,
            updatedAt: new Date(),
          },
        },
        { session }
      );

      return { activityIds, createdActivities };
    });

    // Create notifications for approvers if any activities require approval
    const requiresApproval = activities.some(a => a.requiresApproval !== false);
    if (requiresApproval && !willAutoApprove) {
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
          title: 'New Bulk Professional Activities',
          message: `${userProfile.firstName || userProfile.email} created ${activities.length} professional activit${activities.length !== 1 ? 'ies' : 'y'} that require${activities.length === 1 ? 's' : ''} approval`,
          projectId: projectId,
          relatedModel: 'BULK_PROFESSIONAL_ACTIVITIES',
          relatedId: null,
          createdBy: userProfile._id.toString(),
        }));

        await createNotifications(notifications);
      }
    } else if (willAutoApprove) {
      // Notify creator that activities were auto-approved
      const { createNotification } = await import('@/lib/notifications');
      await createNotification({
        userId: userProfile._id.toString(),
        type: 'approval_status',
        title: 'Bulk Activities Auto-Approved',
        message: `Your bulk activity entry with ${activities.length} activit${activities.length !== 1 ? 'ies' : 'y'} has been auto-approved`,
        projectId: projectId,
        relatedModel: 'BULK_PROFESSIONAL_ACTIVITIES',
        relatedId: null,
        createdBy: userProfile._id.toString(),
      });
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'BULK_PROFESSIONAL_ACTIVITIES',
      entityId: null,
      projectId: projectId,
      changes: {
        created: {
          count: activities.length,
          professionalServiceId: professionalServiceId,
          activities: createdActivities.activityIds.map(id => id.toString()),
        },
      },
    });

    return successResponse({
      activities: createdActivities.createdActivities,
      activityIds: createdActivities.activityIds.map(id => id.toString()),
      totalCreated: activities.length,
      status: initialStatus,
      requiresApproval: !willAutoApprove,
    }, `Successfully created ${activities.length} professional activit${activities.length === 1 ? 'y' : 'ies'}`, 201);
  } catch (error) {
    console.error('Create bulk professional activities error:', error);
    return errorResponse(error.message || 'Failed to create bulk professional activities', 500);
  }
}

