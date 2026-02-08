/**
 * Professional Activities API Route (by ID)
 * GET: Get single professional activity
 * PATCH: Update professional activity
 * DELETE: Delete professional activity (soft delete)
 * 
 * GET /api/professional-activities/[id]
 * PATCH /api/professional-activities/[id]
 * DELETE /api/professional-activities/[id]
 * Auth: All authenticated users (GET), OWNER/PM/CLERK (PATCH), OWNER only (DELETE)
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
  validateProfessionalActivity,
  ACTIVITY_STATUSES,
} from '@/lib/schemas/professional-activities-schema';
import {
  ACTIVITY_TYPES,
  VISIT_PURPOSES,
  INSPECTION_TYPES,
  COMPLIANCE_STATUSES,
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  TEST_TYPES,
  TEST_RESULTS,
  DOCUMENT_TYPES,
} from '@/lib/constants/professional-activities-constants';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/professional-activities/[id]
 * Get single professional activity by ID
 * Auth: All authenticated users
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
      return errorResponse('Invalid professional activity ID', 400);
    }

    const db = await getDatabase();
    const activity = await db.collection('professional_activities').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!activity) {
      return errorResponse('Professional activity not found', 404);
    }

    // Populate related data
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

    // Get linked fee if exists
    const fee = activity.feeId
      ? await db.collection('professional_fees').findOne({
          _id: activity.feeId,
        })
      : null;

    return successResponse({
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
      fee: fee
        ? {
            _id: fee._id.toString(),
            feeCode: fee.feeCode,
            amount: fee.amount,
            status: fee.status,
          }
        : null,
    });
  } catch (error) {
    console.error('Get professional activity error:', error);
    return errorResponse('Failed to retrieve professional activity', 500);
  }
}

/**
 * PATCH /api/professional-activities/[id]
 * Update professional activity
 * Auth: OWNER/PM/CLERK
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canEdit = await hasPermission(user.id, 'edit_professional_activity');
    if (!canEdit) {
      return errorResponse('Insufficient permissions. Only OWNER, PM, and CLERK can edit professional activities.', 403);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid professional activity ID', 400);
    }

    const body = await request.json();
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();

    // Get existing activity
    const existing = await db.collection('professional_activities').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existing) {
      return errorResponse('Professional activity not found', 404);
    }

    // Cannot edit if already approved (unless OWNER)
    const userRole = userProfile.role?.toLowerCase();
    const isOwner = userRole === 'owner';
    if (existing.status === 'approved' && !isOwner) {
      return errorResponse('Cannot edit approved activity. Only OWNER can edit approved activities.', 403);
    }

    // Get professional service for validation
    const professionalService = await db.collection('professional_services').findOne({
      _id: existing.professionalServiceId,
    });

    if (!professionalService) {
      return errorResponse('Professional service assignment not found', 404);
    }

    // Build update data
    const updateData = {
      updatedAt: new Date(),
    };

    const changes = {};

    // Update activity date
    if (body.activityDate !== undefined) {
      updateData.activityDate = new Date(body.activityDate);
      changes.activityDate = { oldValue: existing.activityDate, newValue: updateData.activityDate };
    }

    // Update activity type (validate)
    if (body.activityType !== undefined) {
      if (!ACTIVITY_TYPES.ALL.includes(body.activityType)) {
        return errorResponse(`Activity type must be one of: ${ACTIVITY_TYPES.ALL.join(', ')}`, 400);
      }
      updateData.activityType = body.activityType;
      changes.activityType = { oldValue: existing.activityType, newValue: body.activityType };
    }

    // Update visit-specific fields
    if (body.visitPurpose !== undefined) {
      if (body.visitPurpose && !VISIT_PURPOSES.includes(body.visitPurpose)) {
        return errorResponse(`Visit purpose must be one of: ${VISIT_PURPOSES.join(', ')}`, 400);
      }
      updateData.visitPurpose = body.visitPurpose || null;
      changes.visitPurpose = { oldValue: existing.visitPurpose, newValue: updateData.visitPurpose };
    }

    if (body.visitDuration !== undefined) {
      const duration = body.visitDuration ? parseFloat(body.visitDuration) : null;
      if (duration !== null && duration < 0) {
        return errorResponse('Visit duration must be >= 0', 400);
      }
      updateData.visitDuration = duration;
      changes.visitDuration = { oldValue: existing.visitDuration, newValue: duration };
    }

    if (body.attendees !== undefined) {
      updateData.attendees = Array.isArray(body.attendees) ? body.attendees.filter(a => a && a.trim()).map(a => a.trim()) : [];
      changes.attendees = { oldValue: existing.attendees, newValue: updateData.attendees };
    }

    // Update inspection-specific fields
    if (body.inspectionType !== undefined) {
      if (body.inspectionType && !INSPECTION_TYPES.includes(body.inspectionType)) {
        return errorResponse(`Inspection type must be one of: ${INSPECTION_TYPES.join(', ')}`, 400);
      }
      updateData.inspectionType = body.inspectionType || null;
      changes.inspectionType = { oldValue: existing.inspectionType, newValue: updateData.inspectionType };
    }

    if (body.areasInspected !== undefined) {
      updateData.areasInspected = Array.isArray(body.areasInspected) ? body.areasInspected.filter(a => a && a.trim()).map(a => a.trim()) : [];
      changes.areasInspected = { oldValue: existing.areasInspected, newValue: updateData.areasInspected };
    }

    if (body.inspectionDuration !== undefined) {
      const duration = body.inspectionDuration ? parseFloat(body.inspectionDuration) : null;
      if (duration !== null && duration < 0) {
        return errorResponse('Inspection duration must be >= 0', 400);
      }
      updateData.inspectionDuration = duration;
      changes.inspectionDuration = { oldValue: existing.inspectionDuration, newValue: duration };
    }

    // Update compliance fields
    if (body.complianceStatus !== undefined) {
      if (body.complianceStatus && !COMPLIANCE_STATUSES.includes(body.complianceStatus)) {
        return errorResponse(`Compliance status must be one of: ${COMPLIANCE_STATUSES.join(', ')}`, 400);
      }
      updateData.complianceStatus = body.complianceStatus || null;
      changes.complianceStatus = { oldValue: existing.complianceStatus, newValue: updateData.complianceStatus };
    }

    if (body.codeCompliance !== undefined) {
      updateData.codeCompliance = body.codeCompliance;
      changes.codeCompliance = { oldValue: existing.codeCompliance, newValue: body.codeCompliance };
    }

    if (body.designCompliance !== undefined) {
      updateData.designCompliance = body.designCompliance;
      changes.designCompliance = { oldValue: existing.designCompliance, newValue: body.designCompliance };
    }

    if (body.qualityStandards !== undefined) {
      updateData.qualityStandards = body.qualityStandards;
      changes.qualityStandards = { oldValue: existing.qualityStandards, newValue: body.qualityStandards };
    }

    // Update revision fields
    if (body.revisionNumber !== undefined) {
      updateData.revisionNumber = body.revisionNumber || null;
      changes.revisionNumber = { oldValue: existing.revisionNumber, newValue: updateData.revisionNumber };
    }

    if (body.revisionReason !== undefined) {
      updateData.revisionReason = body.revisionReason || null;
      changes.revisionReason = { oldValue: existing.revisionReason, newValue: updateData.revisionReason };
    }

    if (body.affectedAreas !== undefined) {
      updateData.affectedAreas = Array.isArray(body.affectedAreas) ? body.affectedAreas.filter(a => a && a.trim()).map(a => a.trim()) : [];
      changes.affectedAreas = { oldValue: existing.affectedAreas, newValue: updateData.affectedAreas };
    }

    // Update issues
    if (body.issuesFound !== undefined) {
      if (Array.isArray(body.issuesFound)) {
        // Validate issues
        for (let i = 0; i < body.issuesFound.length; i++) {
          const issue = body.issuesFound[i];
          if (!issue.description || issue.description.trim().length < 1) {
            return errorResponse(`Issue ${i + 1}: description is required`, 400);
          }
          if (!issue.severity || !ISSUE_SEVERITIES.includes(issue.severity)) {
            return errorResponse(`Issue ${i + 1}: severity must be one of: ${ISSUE_SEVERITIES.join(', ')}`, 400);
          }
        }
        updateData.issuesFound = body.issuesFound.map(issue => ({
          issueId: issue.issueId && ObjectId.isValid(issue.issueId) ? new ObjectId(issue.issueId) : null,
          description: issue.description || '',
          severity: issue.severity || 'minor',
          location: issue.location || null,
          status: issue.status || 'identified',
          resolutionDate: issue.resolutionDate ? new Date(issue.resolutionDate) : null,
          resolutionNotes: issue.resolutionNotes || null,
          materialId: issue.materialId && ObjectId.isValid(issue.materialId) ? new ObjectId(issue.materialId) : null,
        }));
      } else {
        updateData.issuesFound = [];
      }
      changes.issuesFound = { oldValue: existing.issuesFound, newValue: updateData.issuesFound };
    }

    // Update material tests
    if (body.materialTests !== undefined) {
      if (Array.isArray(body.materialTests)) {
        // Validate tests
        for (let i = 0; i < body.materialTests.length; i++) {
          const test = body.materialTests[i];
          if (!test.materialName || test.materialName.trim().length < 1) {
            return errorResponse(`Material test ${i + 1}: material name is required`, 400);
          }
          if (!test.testType || !TEST_TYPES.includes(test.testType)) {
            return errorResponse(`Material test ${i + 1}: test type must be one of: ${TEST_TYPES.join(', ')}`, 400);
          }
          if (!test.testResult || !TEST_RESULTS.includes(test.testResult)) {
            return errorResponse(`Material test ${i + 1}: test result must be one of: ${TEST_RESULTS.join(', ')}`, 400);
          }
        }
        updateData.materialTests = body.materialTests.map(test => ({
          materialId: test.materialId && ObjectId.isValid(test.materialId) ? new ObjectId(test.materialId) : null,
          materialName: test.materialName || '',
          testType: test.testType || 'quality',
          testResult: test.testResult || 'pending',
          testReportUrl: test.testReportUrl || null,
          testDate: test.testDate ? new Date(test.testDate) : new Date(),
        }));
      } else {
        updateData.materialTests = [];
      }
      changes.materialTests = { oldValue: existing.materialTests, newValue: updateData.materialTests };
    }

    // Update documents
    if (body.documents !== undefined) {
      if (Array.isArray(body.documents)) {
        // Validate documents
        for (let i = 0; i < body.documents.length; i++) {
          const doc = body.documents[i];
          if (!doc.documentType || !DOCUMENT_TYPES.includes(doc.documentType)) {
            return errorResponse(`Document ${i + 1}: document type must be one of: ${DOCUMENT_TYPES.join(', ')}`, 400);
          }
          if (!doc.documentName || doc.documentName.trim().length < 1) {
            return errorResponse(`Document ${i + 1}: document name is required`, 400);
          }
          if (!doc.documentUrl || doc.documentUrl.trim().length < 1) {
            return errorResponse(`Document ${i + 1}: document URL is required`, 400);
          }
        }
        updateData.documents = body.documents.map(doc => ({
          documentType: doc.documentType || 'other',
          documentName: doc.documentName || '',
          documentUrl: doc.documentUrl || '',
          documentVersion: doc.documentVersion || null,
          uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
          uploadedBy: doc.uploadedBy && ObjectId.isValid(doc.uploadedBy) ? new ObjectId(doc.uploadedBy) : new ObjectId(userProfile._id),
          description: doc.description || null,
        }));
      } else {
        updateData.documents = [];
      }
      changes.documents = { oldValue: existing.documents, newValue: updateData.documents };
    }

    // Update financial fields
    if (body.feesCharged !== undefined) {
      const fees = parseFloat(body.feesCharged);
      if (isNaN(fees) || fees < 0) {
        return errorResponse('Fees charged must be >= 0', 400);
      }
      updateData.feesCharged = fees;
      changes.feesCharged = { oldValue: existing.feesCharged, newValue: fees };
    }

    if (body.expensesIncurred !== undefined) {
      const expenses = parseFloat(body.expensesIncurred);
      if (isNaN(expenses) || expenses < 0) {
        return errorResponse('Expenses incurred must be >= 0', 400);
      }
      updateData.expensesIncurred = expenses;
      changes.expensesIncurred = { oldValue: existing.expensesIncurred, newValue: expenses };
    }

    // Update notes and observations
    if (body.notes !== undefined) {
      updateData.notes = body.notes || null;
      changes.notes = { oldValue: existing.notes, newValue: updateData.notes };
    }

    if (body.observations !== undefined) {
      updateData.observations = body.observations || null;
      changes.observations = { oldValue: existing.observations, newValue: updateData.observations };
    }

    if (body.recommendations !== undefined) {
      updateData.recommendations = body.recommendations || null;
      changes.recommendations = { oldValue: existing.recommendations, newValue: updateData.recommendations };
    }

    // Update follow-up
    if (body.followUpRequired !== undefined) {
      updateData.followUpRequired = body.followUpRequired;
      changes.followUpRequired = { oldValue: existing.followUpRequired, newValue: body.followUpRequired };
    }

    if (body.followUpDate !== undefined) {
      updateData.followUpDate = body.followUpDate ? new Date(body.followUpDate) : null;
      changes.followUpDate = { oldValue: existing.followUpDate, newValue: updateData.followUpDate };
    }

    // Update status (only if not approved, or if OWNER)
    if (body.status !== undefined && (existing.status !== 'approved' || isOwner)) {
      if (!ACTIVITY_STATUSES.includes(body.status)) {
        return errorResponse(`Status must be one of: ${ACTIVITY_STATUSES.join(', ')}`, 400);
      }
      updateData.status = body.status;
      changes.status = { oldValue: existing.status, newValue: body.status };
    }

    // Cannot update: professionalServiceId, projectId, activityCode, createdBy, approval fields (use approve/reject endpoints)

    // Update
    const result = await db.collection('professional_activities').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Professional activity not found', 404);
    }

    // Create audit log
    if (Object.keys(changes).length > 0) {
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'UPDATED',
        entityType: 'PROFESSIONAL_ACTIVITY',
        entityId: id,
        projectId: existing.projectId.toString(),
        changes,
      });
    }

    return successResponse(result.value, 'Professional activity updated successfully');
  } catch (error) {
    console.error('Update professional activity error:', error);
    return errorResponse('Failed to update professional activity', 500);
  }
}

/**
 * DELETE /api/professional-activities/[id]
 * Delete professional activity (soft delete)
 * Auth: OWNER only
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - OWNER only
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    if (userRole !== 'owner') {
      return errorResponse('Insufficient permissions. Only OWNER can delete professional activities.', 403);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid professional activity ID', 400);
    }

    const db = await getDatabase();

    // Check if activity exists
    const existing = await db.collection('professional_activities').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existing) {
      return errorResponse('Professional activity not found', 404);
    }

    // Check if linked to approved fee
    if (existing.feeId) {
      const fee = await db.collection('professional_fees').findOne({
        _id: existing.feeId,
        status: { $in: ['APPROVED', 'PAID'] },
      });
      if (fee) {
        return errorResponse('Cannot delete activity linked to approved or paid fee. Please handle the fee first.', 400);
      }
    }

    // Soft delete
    const result = await db.collection('professional_activities').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          deletedAt: new Date(),
          updatedAt: new Date(),
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Professional activity not found', 404);
    }

    // Update professional service assignment statistics
    await db.collection('professional_services').findOneAndUpdate(
      { _id: existing.professionalServiceId },
      {
        $inc: {
          totalActivities: -1,
          ...(existing.activityType === 'site_visit' || existing.activityType === 'client_meeting' ? { totalSiteVisits: -1 } : {}),
          ...(existing.activityType === 'inspection' || existing.activityType === 'quality_check' ? { totalInspections: -1 } : {}),
          ...(existing.activityType === 'design_revision' ? { revisionsMade: -1 } : {}),
          ...(existing.issuesFound && existing.issuesFound.length > 0 ? { issuesIdentified: -existing.issuesFound.length } : {}),
          ...(existing.documents && existing.documents.length > 0 ? { documentsUploaded: -existing.documents.length } : {}),
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'PROFESSIONAL_ACTIVITY',
      entityId: id,
      projectId: existing.projectId.toString(),
      changes: { deleted: result.value },
    });

    return successResponse(null, 'Professional activity deleted successfully');
  } catch (error) {
    console.error('Delete professional activity error:', error);
    return errorResponse('Failed to delete professional activity', 500);
  }
}

