/**
 * Professional Services (Project Assignments) API Route (by ID)
 * GET: Get single professional service assignment
 * PATCH: Update professional service assignment
 * DELETE: Terminate professional service assignment (soft delete)
 * 
 * GET /api/professional-services/[id]
 * PATCH /api/professional-services/[id]
 * DELETE /api/professional-services/[id]
 * Auth: All authenticated users (GET), OWNER/PM only (PATCH, DELETE)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { deleteProfessionalServiceCloudinaryAssets } from '@/lib/cloudinary-cleanup';
import {
  validateProfessionalServices,
} from '@/lib/schemas/professional-services-schema';
import {
  PROFESSIONAL_SERVICE_STATUSES,
  PAYMENT_STATUSES,
  CONTRACT_TYPES,
  PAYMENT_SCHEDULES,
  VISIT_FREQUENCIES,
} from '@/lib/constants/professional-services-constants';

const normalizeIdParam = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return normalizeIdParam(value[0]);
  if (typeof value === 'string') {
    const trimmed = decodeURIComponent(value).trim();
    if (trimmed.startsWith('ObjectId(') && trimmed.endsWith(')')) {
      return trimmed.slice(9, -1).replace(/['"]/g, '');
    }
    return trimmed;
  }
  if (typeof value === 'object' && value.$oid) return value.$oid;
  return value.toString?.() || '';
};

const buildAssignmentIdQuery = (id) => {
  const rawId = normalizeIdParam(id);
  if (!rawId) return null;
  if (ObjectId.isValid(rawId)) {
    return { $or: [{ _id: new ObjectId(rawId) }, { _id: rawId }] };
  }
  return { _id: rawId };
};

const activeAssignmentFilter = {
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};

/**
 * GET /api/professional-services/[id]
 * Get single professional service assignment by ID
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
    const assignmentIdQuery = buildAssignmentIdQuery(id);
    if (!assignmentIdQuery) {
      return errorResponse('Invalid professional service assignment ID', 400);
    }

    const db = await getDatabase();
    const assignment = await db.collection('professional_services').findOne({
      ...assignmentIdQuery,
      ...activeAssignmentFilter,
    });

    if (!assignment) {
      return errorResponse('Professional service assignment not found', 404);
    }

    // Populate library, project, and phase data
    const library = await db.collection('professional_services_library').findOne({
      _id: assignment.libraryId,
    });

    const project = await db.collection('projects').findOne({
      _id: assignment.projectId,
    });

    const phase = assignment.phaseId
      ? await db.collection('phases').findOne({
          _id: assignment.phaseId,
        })
      : null;

    // Get activity statistics
    const activitiesCount = await db.collection('professional_activities').countDocuments({
      professionalServiceId: new ObjectId(id),
      deletedAt: null,
    });

    // Get fees statistics
    const fees = await db.collection('professional_fees').find({
      professionalServiceId: new ObjectId(id),
      deletedAt: null,
    }).toArray();

    const activeFees = fees.filter((fee) => !['REJECTED', 'ARCHIVED'].includes(fee.status));
    const totalFees = activeFees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
    const paidFees = activeFees
      .filter((fee) => fee.status === 'PAID')
      .reduce((sum, fee) => sum + (fee.amount || 0), 0);
    const pendingFees = activeFees
      .filter((fee) => ['PENDING', 'APPROVED'].includes(fee.status))
      .reduce((sum, fee) => sum + (fee.amount || 0), 0);

    return successResponse({
      ...assignment,
      library: library
        ? {
            _id: library._id.toString(),
            name: library.name,
            type: library.type,
            companyName: library.companyName,
            firstName: library.firstName,
            lastName: library.lastName,
            email: library.email,
            phone: library.phone,
            specialization: library.specialization,
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
      statistics: {
        activitiesCount,
        feesCount: fees.length,
        totalFees,
        paidFees,
        pendingFees,
      },
    });
  } catch (error) {
    console.error('Get professional service assignment error:', error);
    return errorResponse('Failed to retrieve professional service assignment', 500);
  }
}

/**
 * PATCH /api/professional-services/[id]
 * Update professional service assignment
 * Auth: OWNER/PM only
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canEdit = await hasPermission(user.id, 'edit_professional_service_assignment');
    if (!canEdit) {
      return errorResponse('Insufficient permissions. Only OWNER and PM can edit professional service assignments.', 403);
    }

    const { id } = await params;
    const assignmentIdQuery = buildAssignmentIdQuery(id);
    if (!assignmentIdQuery) {
      return errorResponse('Invalid professional service assignment ID', 400);
    }

    const body = await request.json();
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();

    // Get existing assignment
    const existing = await db.collection('professional_services').findOne({
      ...assignmentIdQuery,
      ...activeAssignmentFilter,
    });

    if (!existing) {
      return errorResponse('Professional service assignment not found', 404);
    }

    // Get library entry for validation
    const libraryEntry = await db.collection('professional_services_library').findOne({
      _id: existing.libraryId,
    });

    if (!libraryEntry) {
      return errorResponse('Professional library entry not found', 404);
    }

    // Build update data
    const updateData = {
      updatedAt: new Date(),
    };

    const changes = {};

    // Update service category
    if (body.serviceCategory !== undefined) {
      if (!['preconstruction', 'construction'].includes(body.serviceCategory)) {
        return errorResponse('Service category must be either "preconstruction" or "construction"', 400);
      }
      updateData.serviceCategory = body.serviceCategory;
      changes.serviceCategory = { oldValue: existing.serviceCategory, newValue: body.serviceCategory };
    }

    // Update assigned date
    if (body.assignedDate !== undefined) {
      if (!body.assignedDate) {
        return errorResponse('Assigned date is required', 400);
      }
      const assignedDate = new Date(body.assignedDate);
      if (Number.isNaN(assignedDate.getTime())) {
        return errorResponse('Assigned date must be a valid date', 400);
      }
      updateData.assignedDate = assignedDate;
      changes.assignedDate = { oldValue: existing.assignedDate, newValue: assignedDate };
    }

    // Update contract type
    if (body.contractType !== undefined) {
      if (!CONTRACT_TYPES.ALL.includes(body.contractType)) {
        return errorResponse(`Contract type must be one of: ${CONTRACT_TYPES.ALL.join(', ')}`, 400);
      }
      updateData.contractType = body.contractType;
      changes.contractType = { oldValue: existing.contractType, newValue: body.contractType };
    }

    // Update contract value
    if (body.contractValue !== undefined) {
      const value = parseFloat(body.contractValue);
      if (isNaN(value) || value <= 0) {
        return errorResponse('Contract value must be greater than 0', 400);
      }
      updateData.contractValue = value;
      changes.contractValue = { oldValue: existing.contractValue, newValue: value };
    }

    // Update payment schedule
    if (body.paymentSchedule !== undefined) {
      if (!PAYMENT_SCHEDULES.includes(body.paymentSchedule)) {
        return errorResponse(`Payment schedule must be one of: ${PAYMENT_SCHEDULES.join(', ')}`, 400);
      }
      updateData.paymentSchedule = body.paymentSchedule;
      changes.paymentSchedule = { oldValue: existing.paymentSchedule, newValue: body.paymentSchedule };
    }

    // Update visit frequency (for engineers)
    if (body.visitFrequency !== undefined) {
      if (body.visitFrequency && !VISIT_FREQUENCIES.includes(body.visitFrequency)) {
        return errorResponse(`Visit frequency must be one of: ${VISIT_FREQUENCIES.join(', ')}`, 400);
      }
      updateData.visitFrequency = body.visitFrequency || null;
      changes.visitFrequency = { oldValue: existing.visitFrequency, newValue: body.visitFrequency };
    }

    // Update contract dates
    if (body.contractStartDate !== undefined) {
      if (!body.contractStartDate) {
        return errorResponse('Contract start date is required', 400);
      }
      const contractStartDate = new Date(body.contractStartDate);
      if (Number.isNaN(contractStartDate.getTime())) {
        return errorResponse('Contract start date must be a valid date', 400);
      }
      updateData.contractStartDate = contractStartDate;
      changes.contractStartDate = { oldValue: existing.contractStartDate, newValue: contractStartDate };
    }

    if (body.contractEndDate !== undefined) {
      if (!body.contractEndDate) {
        updateData.contractEndDate = null;
        changes.contractEndDate = { oldValue: existing.contractEndDate, newValue: null };
      } else {
        const contractEndDate = new Date(body.contractEndDate);
        if (Number.isNaN(contractEndDate.getTime())) {
          return errorResponse('Contract end date must be a valid date', 400);
        }
        updateData.contractEndDate = contractEndDate;
        changes.contractEndDate = { oldValue: existing.contractEndDate, newValue: contractEndDate };
      }
    }

    // Validate end date is after start date
    if (updateData.contractStartDate && updateData.contractEndDate) {
      if (updateData.contractEndDate <= updateData.contractStartDate) {
        return errorResponse('Contract end date must be after contract start date', 400);
      }
    }

    // Update contract document (with Cloudinary cleanup if replacing)
    if (body.contractDocumentUrl !== undefined) {
      const oldUrl = existing.contractDocumentUrl;
      const newUrl = body.contractDocumentUrl || null;
      
      // If replacing with a new URL, delete the old one from Cloudinary
      if (oldUrl && newUrl && oldUrl !== newUrl) {
        try {
          await deleteProfessionalServiceCloudinaryAssets({ contractDocumentUrl: oldUrl });
        } catch (cleanupError) {
          console.error('Error cleaning up old contract document:', cleanupError);
          // Continue with update even if cleanup fails
        }
      }
      // If removing document (setting to null/empty), delete from Cloudinary
      else if (oldUrl && !newUrl) {
        try {
          await deleteProfessionalServiceCloudinaryAssets({ contractDocumentUrl: oldUrl });
        } catch (cleanupError) {
          console.error('Error cleaning up contract document:', cleanupError);
          // Continue with update even if cleanup fails
        }
      }
      
      updateData.contractDocumentUrl = newUrl;
      changes.contractDocumentUrl = { oldValue: oldUrl, newValue: newUrl };
    }

    // Update payment terms
    if (body.paymentTerms !== undefined) {
      updateData.paymentTerms = body.paymentTerms || null;
      changes.paymentTerms = { oldValue: existing.paymentTerms, newValue: updateData.paymentTerms };
    }

    // Update milestone payments
    if (body.milestonePayments !== undefined) {
      if (Array.isArray(body.milestonePayments)) {
        // Validate milestone payments
        for (let i = 0; i < body.milestonePayments.length; i++) {
          const milestone = body.milestonePayments[i];
          if (!milestone.milestoneName || milestone.milestoneName.trim().length < 1) {
            return errorResponse(`Milestone ${i + 1}: milestone name is required`, 400);
          }
          if (!milestone.milestoneDate) {
            return errorResponse(`Milestone ${i + 1}: milestone date is required`, 400);
          }
          if (!milestone.paymentAmount || milestone.paymentAmount <= 0) {
            return errorResponse(`Milestone ${i + 1}: payment amount must be greater than 0`, 400);
          }
          if (milestone.paymentStatus && !PAYMENT_STATUSES.includes(milestone.paymentStatus)) {
            return errorResponse(`Milestone ${i + 1}: payment status must be one of: ${PAYMENT_STATUSES.join(', ')}`, 400);
          }
        }
        updateData.milestonePayments = body.milestonePayments;
      } else {
        updateData.milestonePayments = [];
      }
      changes.milestonePayments = { oldValue: existing.milestonePayments, newValue: updateData.milestonePayments };
    }

    // Update phase
    if (body.phaseId !== undefined) {
      if (body.phaseId && !ObjectId.isValid(body.phaseId)) {
        return errorResponse('Valid phaseId is required if provided', 400);
      }
      if (body.phaseId) {
        // Verify phase belongs to project
        const phase = await db.collection('phases').findOne({
          _id: new ObjectId(body.phaseId),
          projectId: existing.projectId,
        });
        if (!phase) {
          return errorResponse('Phase not found or does not belong to this project', 404);
        }
      }
      updateData.phaseId = body.phaseId && ObjectId.isValid(body.phaseId) ? new ObjectId(body.phaseId) : null;
      changes.phaseId = { oldValue: existing.phaseId, newValue: updateData.phaseId };
    }

    // Update status
    if (body.status !== undefined) {
      if (!PROFESSIONAL_SERVICE_STATUSES.includes(body.status)) {
        return errorResponse(`Status must be one of: ${PROFESSIONAL_SERVICE_STATUSES.join(', ')}`, 400);
      }
      updateData.status = body.status;
      updateData.isActive = body.status === 'active';
      changes.status = { oldValue: existing.status, newValue: body.status };
    }

    // Update committed cost when status or contract value changes
    if (existing.contractValue && existing.contractValue > 0) {
      const currentStatus = existing.status;
      const nextStatus = updateData.status ?? existing.status;
      const currentContractValue = existing.contractValue || 0;
      const nextContractValue = updateData.contractValue !== undefined ? updateData.contractValue : currentContractValue;
      const totalFees = existing.totalFees || 0;
      const currentRemaining = Math.max(0, currentContractValue - totalFees);
      const nextRemaining = Math.max(0, nextContractValue - totalFees);

      try {
        const { updateCommittedCost } = await import('@/lib/financial-helpers');
        if (currentStatus === 'active' && nextStatus !== 'active') {
          if (currentRemaining > 0) {
            await updateCommittedCost(existing.projectId.toString(), currentRemaining, 'subtract');
          }
        } else if (currentStatus !== 'active' && nextStatus === 'active') {
          if (nextRemaining > 0) {
            await updateCommittedCost(existing.projectId.toString(), nextRemaining, 'add');
          }
        } else if (currentStatus === 'active' && nextStatus === 'active' && updateData.contractValue !== undefined) {
          const delta = nextRemaining - currentRemaining;
          if (delta !== 0) {
            await updateCommittedCost(
              existing.projectId.toString(),
              Math.abs(delta),
              delta > 0 ? 'add' : 'subtract'
            );
          }
        }
      } catch (financialError) {
        console.error('Error updating committed cost after assignment change:', financialError);
      }
    }

    // Update notes
    if (body.notes !== undefined) {
      updateData.notes = body.notes || null;
      changes.notes = { oldValue: existing.notes, newValue: updateData.notes };
    }

    // Cannot update: libraryId, projectId, professionalCode, createdBy, usage statistics (auto-tracked)

    // Update
    const result = await db.collection('professional_services').findOneAndUpdate(
      assignmentIdQuery,
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Professional service assignment not found', 404);
    }

    // Create audit log
    if (Object.keys(changes).length > 0) {
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'UPDATED',
        entityType: 'PROFESSIONAL_SERVICES',
        entityId: id,
        changes,
      });
    }

    return successResponse(result.value, 'Professional service assignment updated successfully');
  } catch (error) {
    console.error('Update professional service assignment error:', error);
    return errorResponse('Failed to update professional service assignment', 500);
  }
}

/**
 * DELETE /api/professional-services/[id]
 * Terminate professional service assignment (soft delete)
 * Auth: OWNER only
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canTerminate = await hasPermission(user.id, 'terminate_professional_service');
    if (!canTerminate) {
      return errorResponse('Insufficient permissions. Only OWNER can terminate professional service assignments.', 403);
    }

    const { id } = await params;
    const assignmentIdQuery = buildAssignmentIdQuery(id);
    if (!assignmentIdQuery) {
      return errorResponse('Invalid professional service assignment ID', 400);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();

    // Check if assignment exists
    const existing = await db.collection('professional_services').findOne({
      ...assignmentIdQuery,
      ...activeAssignmentFilter,
    });

    if (!existing) {
      return errorResponse('Professional service assignment not found', 404);
    }

    // Check if there are pending fees
    const pendingFees = await db.collection('professional_fees').countDocuments({
      professionalServiceId: new ObjectId(id),
      status: { $in: ['PENDING', 'APPROVED'] },
      deletedAt: null,
    });

    if (pendingFees > 0) {
      return errorResponse(
        `Cannot terminate assignment with ${pendingFees} pending fee(s). Please resolve fees first.`,
        400
      );
    }

    // Soft delete (terminate) - Cleanup Cloudinary assets first
    // Delete Cloudinary assets before soft delete
    try {
      await deleteProfessionalServiceCloudinaryAssets(existing);
    } catch (cleanupError) {
      console.error('Error cleaning up Cloudinary assets:', cleanupError);
      // Continue with deletion even if cleanup fails
    }

    // Calculate remaining commitment to remove from committed costs
    // Only remove if assignment was active (was counting as commitment)
    let remainingCommitmentToRemove = 0;
    if (existing.status === 'active' && existing.contractValue) {
      const contractValue = existing.contractValue || 0;
      const totalFees = existing.totalFees || 0;
      remainingCommitmentToRemove = Math.max(0, contractValue - totalFees);
    }

    const result = await db.collection('professional_services').findOneAndUpdate(
      assignmentIdQuery,
      { 
        $set: { 
          status: 'terminated',
          isActive: false,
          deletedAt: new Date(),
          updatedAt: new Date(),
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Professional service assignment not found', 404);
    }

    // Remove remaining commitment from committed costs
    if (remainingCommitmentToRemove > 0) {
      try {
        const { updateCommittedCost } = await import('@/lib/financial-helpers');
        await updateCommittedCost(
          existing.projectId.toString(),
          remainingCommitmentToRemove,
          'subtract'
        );
      } catch (financialError) {
        console.error('Error updating committed cost after assignment termination:', financialError);
        // Don't fail the request, just log the error
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'PROFESSIONAL_SERVICES',
      entityId: id,
      changes: { terminated: result.value },
    });

    return successResponse(null, 'Professional service assignment terminated successfully');
  } catch (error) {
    console.error('Terminate professional service assignment error:', error);
    return errorResponse('Failed to terminate professional service assignment', 500);
  }
}

