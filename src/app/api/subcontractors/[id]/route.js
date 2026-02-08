/**
 * Subcontractor Detail API Route
 * GET: Get single subcontractor
 * PATCH: Update subcontractor (PM, OWNER only)
 * DELETE: Soft delete subcontractor (OWNER only)
 * 
 * GET /api/subcontractors/[id]
 * PATCH /api/subcontractors/[id]
 * DELETE /api/subcontractors/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateSubcontractor, SUBCONTRACTOR_TYPES, SUBCONTRACTOR_STATUSES, CONTRACT_TYPES } from '@/lib/schemas/subcontractor-schema';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';

/**
 * GET /api/subcontractors/[id]
 * Returns a single subcontractor by ID
 * Auth: All authenticated users
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid subcontractor ID', 400);
    }

    const db = await getDatabase();
    const subcontractor = await db.collection('subcontractors').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!subcontractor) {
      return errorResponse('Subcontractor not found', 404);
    }

    return successResponse(subcontractor, 'Subcontractor retrieved successfully');
  } catch (error) {
    console.error('Get subcontractor error:', error);
    return errorResponse('Failed to retrieve subcontractor', 500);
  }
}

/**
 * PATCH /api/subcontractors/[id]
 * Updates subcontractor details, status, payments, or performance
 * Auth: PM, OWNER only
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const hasEditPermission = await hasPermission(user.id, 'edit_subcontractor');
    if (!hasEditPermission) {
      // Fallback to role check for backward compatibility and safety
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['owner', 'pm', 'project_manager'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse('Insufficient permissions. Only PM and OWNER can edit subcontractors.', 403);
      }
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid subcontractor ID', 400);
    }

    const body = await request.json();
    const {
      subcontractorName,
      subcontractorType,
      contactPerson,
      phone,
      email,
      contractValue,
      contractType,
      startDate,
      endDate,
      paymentSchedule,
      status,
      performance,
      notes
    } = body;

    const db = await getDatabase();

    // Get existing subcontractor
    const existingSubcontractor = await db.collection('subcontractors').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!existingSubcontractor) {
      return errorResponse('Subcontractor not found', 404);
    }

    // Build update object
    const updateData = {
      updatedAt: new Date()
    };

    if (subcontractorName !== undefined) {
      if (!subcontractorName || subcontractorName.trim().length < 2) {
        return errorResponse('Subcontractor name cannot be empty and must be at least 2 characters', 400);
      }
      updateData.subcontractorName = subcontractorName.trim();
    }

    if (subcontractorType !== undefined) {
      if (!SUBCONTRACTOR_TYPES.includes(subcontractorType)) {
        return errorResponse(`Invalid subcontractor type. Must be one of: ${SUBCONTRACTOR_TYPES.join(', ')}`, 400);
      }
      updateData.subcontractorType = subcontractorType;
    }

    if (contactPerson !== undefined) {
      updateData.contactPerson = contactPerson?.trim() || '';
    }

    if (phone !== undefined) {
      updateData.phone = phone?.trim() || '';
    }

    if (email !== undefined) {
      updateData.email = email?.trim() || '';
    }

    if (contractValue !== undefined) {
      if (isNaN(contractValue) || contractValue <= 0) {
        return errorResponse('Contract value must be greater than 0', 400);
      }
      updateData.contractValue = parseFloat(contractValue);
    }

    if (contractType !== undefined) {
      if (!CONTRACT_TYPES.includes(contractType)) {
        return errorResponse(`Invalid contract type. Must be one of: ${CONTRACT_TYPES.join(', ')}`, 400);
      }
      updateData.contractType = contractType;
    }

    if (startDate !== undefined) {
      updateData.startDate = new Date(startDate);
    }

    if (endDate !== undefined) {
      if (endDate === null || endDate === '') {
        updateData.endDate = null;
      } else {
        updateData.endDate = new Date(endDate);
        // Validate end date is after start date
        const start = startDate ? new Date(startDate) : existingSubcontractor.startDate;
        if (updateData.endDate <= start) {
          return errorResponse('End date must be after start date', 400);
        }
      }
    }

    if (paymentSchedule !== undefined) {
      if (!Array.isArray(paymentSchedule)) {
        return errorResponse('Payment schedule must be an array', 400);
      }
      // Validate payment schedule
      for (let i = 0; i < paymentSchedule.length; i++) {
        const payment = paymentSchedule[i];
        if (!payment.milestone || payment.milestone.trim().length === 0) {
          return errorResponse(`Payment ${i + 1}: milestone name is required`, 400);
        }
        if (payment.amount === undefined || payment.amount === null || payment.amount <= 0) {
          return errorResponse(`Payment ${i + 1}: amount must be greater than 0`, 400);
        }
        if (!payment.dueDate) {
          return errorResponse(`Payment ${i + 1}: due date is required`, 400);
        }
      }
      updateData.paymentSchedule = paymentSchedule.map(p => ({
        milestone: p.milestone?.trim() || '',
        amount: parseFloat(p.amount) || 0,
        dueDate: p.dueDate ? new Date(p.dueDate) : null,
        paid: p.paid === true,
        paidDate: p.paidDate ? new Date(p.paidDate) : null,
        paymentReference: p.paymentReference?.trim() || ''
      }));
    }

    if (status !== undefined) {
      if (!SUBCONTRACTOR_STATUSES.includes(status)) {
        return errorResponse(`Invalid status. Must be one of: ${SUBCONTRACTOR_STATUSES.join(', ')}`, 400);
      }
      updateData.status = status;
    }

    if (performance !== undefined) {
      const perf = {};
      ['quality', 'timeliness', 'communication'].forEach(field => {
        if (performance[field] !== undefined && performance[field] !== null) {
          const rating = parseFloat(performance[field]);
          if (isNaN(rating) || rating < 1 || rating > 5) {
            return errorResponse(`Performance ${field} must be between 1 and 5`, 400);
          }
          perf[field] = rating;
        }
      });
      updateData.performance = { ...existingSubcontractor.performance, ...perf };
    }

    if (notes !== undefined) {
      updateData.notes = notes?.trim() || '';
    }

    // Update subcontractor
    const result = await db.collection('subcontractors').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return errorResponse('Subcontractor not found', 404);
    }

    const updatedSubcontractor = result.value;

    // Recalculate phase spending if cost-related fields changed
    if (contractValue !== undefined || paymentSchedule !== undefined || status !== undefined) {
      try {
        await recalculatePhaseSpending(existingSubcontractor.phaseId.toString());
      } catch (phaseError) {
        console.error('Error recalculating phase spending after subcontractor update:', phaseError);
        // Don't fail the request, just log the error
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'SUBCONTRACTOR',
      entityId: id,
      projectId: existingSubcontractor.projectId.toString(),
      changes: updateData,
    });

    return successResponse(updatedSubcontractor, 'Subcontractor updated successfully');
  } catch (error) {
    console.error('Update subcontractor error:', error);
    return errorResponse('Failed to update subcontractor', 500);
  }
}

/**
 * DELETE /api/subcontractors/[id]
 * Soft deletes a subcontractor assignment
 * Auth: OWNER only
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can delete
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    if (userRole !== 'owner') {
      return errorResponse('Insufficient permissions. Only OWNER can delete subcontractors.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid subcontractor ID', 400);
    }

    const db = await getDatabase();

    // Get existing subcontractor
    const existingSubcontractor = await db.collection('subcontractors').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!existingSubcontractor) {
      return errorResponse('Subcontractor not found', 404);
    }

    // Soft delete
    const result = await db.collection('subcontractors').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          deletedAt: new Date(),
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return errorResponse('Subcontractor not found', 404);
    }

    // Recalculate phase spending
    try {
      await recalculatePhaseSpending(existingSubcontractor.phaseId.toString());
    } catch (phaseError) {
      console.error('Error recalculating phase spending after subcontractor deletion:', phaseError);
      // Don't fail the request, just log the error
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'SUBCONTRACTOR',
      entityId: id,
      projectId: existingSubcontractor.projectId.toString(),
      changes: { deleted: true },
    });

    return successResponse(result.value, 'Subcontractor deleted successfully');
  } catch (error) {
    console.error('Delete subcontractor error:', error);
    return errorResponse('Failed to delete subcontractor', 500);
  }
}


