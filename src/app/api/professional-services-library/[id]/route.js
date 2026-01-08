/**
 * Professional Services Library API Route (by ID)
 * GET: Get single professional from library
 * PATCH: Update professional in library
 * DELETE: Soft delete professional from library
 * 
 * GET /api/professional-services-library/[id]
 * PATCH /api/professional-services-library/[id]
 * DELETE /api/professional-services-library/[id]
 * Auth: All authenticated users (GET), OWNER only (PATCH, DELETE)
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
  PROFESSIONAL_TYPES,
  ENGINEER_SPECIALIZATIONS,
  CONTRACT_TYPES,
  PAYMENT_SCHEDULES,
  VISIT_FREQUENCIES,
} from '@/lib/constants/professional-services-constants';

/**
 * GET /api/professional-services-library/[id]
 * Get single professional from library by ID
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
      return errorResponse('Invalid professional services library ID', 400);
    }

    const db = await getDatabase();
    const professional = await db.collection('professional_services_library').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!professional) {
      return errorResponse('Professional not found in library', 404);
    }

    // Get usage statistics
    const assignmentsCount = await db.collection('professional_services').countDocuments({
      libraryId: new ObjectId(id),
      deletedAt: null,
    });

    professional.assignmentsCount = assignmentsCount;

    return successResponse(professional);
  } catch (error) {
    console.error('Get professional services library error:', error);
    return errorResponse('Failed to retrieve professional', 500);
  }
}

/**
 * PATCH /api/professional-services-library/[id]
 * Update professional in library
 * Auth: OWNER only
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'manage_professional_services_library');
    if (!canManage) {
      return errorResponse('Insufficient permissions. Only OWNER can manage professional services library.', 403);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid professional services library ID', 400);
    }

    const body = await request.json();
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();

    // Get existing professional
    const existing = await db.collection('professional_services_library').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existing) {
      return errorResponse('Professional not found in library', 404);
    }

    // Build update data (only allowed fields)
    const updateData = {
      updatedAt: new Date(),
    };

    const changes = {};

    // Validate and update name
    if (body.name !== undefined) {
      if (!body.name || body.name.trim().length < 2) {
        return errorResponse('Professional name must be at least 2 characters', 400);
      }
      if (body.name.length > 200) {
        return errorResponse('Professional name must be less than 200 characters', 400);
      }
      updateData.name = body.name.trim();
      changes.name = { oldValue: existing.name, newValue: updateData.name };
    }

    // Validate and update type (cannot change if already used)
    if (body.type !== undefined && body.type !== existing.type) {
      const assignmentsCount = await db.collection('professional_services').countDocuments({
        libraryId: new ObjectId(id),
        deletedAt: null,
      });
      if (assignmentsCount > 0) {
        return errorResponse('Cannot change professional type when already assigned to projects', 400);
      }
      if (!PROFESSIONAL_TYPES.includes(body.type)) {
        return errorResponse(`Type must be one of: ${PROFESSIONAL_TYPES.join(', ')}`, 400);
      }
      updateData.type = body.type;
      changes.type = { oldValue: existing.type, newValue: body.type };
    }

    // Update description
    if (body.description !== undefined) {
      if (body.description && body.description.length > 1000) {
        return errorResponse('Description must be less than 1000 characters', 400);
      }
      updateData.description = body.description?.trim() || '';
      changes.description = { oldValue: existing.description, newValue: updateData.description };
    }

    // Update company/individual info
    if (body.companyName !== undefined) {
      if (body.companyName && body.companyName.length > 200) {
        return errorResponse('Company name must be less than 200 characters', 400);
      }
      updateData.companyName = body.companyName?.trim() || null;
      changes.companyName = { oldValue: existing.companyName, newValue: updateData.companyName };
    }

    if (body.firstName !== undefined) {
      updateData.firstName = body.firstName?.trim() || null;
      changes.firstName = { oldValue: existing.firstName, newValue: updateData.firstName };
    }

    if (body.lastName !== undefined) {
      updateData.lastName = body.lastName?.trim() || null;
      changes.lastName = { oldValue: existing.lastName, newValue: updateData.lastName };
    }

    // Update contact info
    if (body.email !== undefined) {
      if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return errorResponse('Email must be a valid email address', 400);
      }
      updateData.email = body.email?.trim() || null;
      changes.email = { oldValue: existing.email, newValue: updateData.email };
    }

    if (body.phone !== undefined) {
      if (body.phone && body.phone.length > 20) {
        return errorResponse('Phone number must be less than 20 characters', 400);
      }
      updateData.phone = body.phone?.trim() || null;
      changes.phone = { oldValue: existing.phone, newValue: updateData.phone };
    }

    if (body.address !== undefined) {
      updateData.address = body.address?.trim() || null;
      changes.address = { oldValue: existing.address, newValue: updateData.address };
    }

    // Update professional credentials
    if (body.registrationNumber !== undefined) {
      updateData.registrationNumber = body.registrationNumber?.trim() || null;
      changes.registrationNumber = { oldValue: existing.registrationNumber, newValue: updateData.registrationNumber };
    }

    if (body.licenseNumber !== undefined) {
      updateData.licenseNumber = body.licenseNumber?.trim() || null;
      changes.licenseNumber = { oldValue: existing.licenseNumber, newValue: updateData.licenseNumber };
    }

    // Update specialization (for engineers)
    if (body.specialization !== undefined) {
      if (body.specialization && !ENGINEER_SPECIALIZATIONS.includes(body.specialization)) {
        return errorResponse(`Specialization must be one of: ${ENGINEER_SPECIALIZATIONS.join(', ')}`, 400);
      }
      updateData.specialization = body.specialization || null;
      changes.specialization = { oldValue: existing.specialization, newValue: updateData.specialization };
    }

    // Update default contract terms
    if (body.defaultContractType !== undefined) {
      if (body.defaultContractType && !CONTRACT_TYPES.ALL.includes(body.defaultContractType)) {
        return errorResponse(`Contract type must be one of: ${CONTRACT_TYPES.ALL.join(', ')}`, 400);
      }
      updateData.defaultContractType = body.defaultContractType || null;
      changes.defaultContractType = { oldValue: existing.defaultContractType, newValue: updateData.defaultContractType };
    }

    if (body.defaultPaymentSchedule !== undefined) {
      if (body.defaultPaymentSchedule && !PAYMENT_SCHEDULES.includes(body.defaultPaymentSchedule)) {
        return errorResponse(`Payment schedule must be one of: ${PAYMENT_SCHEDULES.join(', ')}`, 400);
      }
      updateData.defaultPaymentSchedule = body.defaultPaymentSchedule || null;
      changes.defaultPaymentSchedule = { oldValue: existing.defaultPaymentSchedule, newValue: updateData.defaultPaymentSchedule };
    }

    if (body.defaultVisitFrequency !== undefined) {
      if (body.defaultVisitFrequency && !VISIT_FREQUENCIES.includes(body.defaultVisitFrequency)) {
        return errorResponse(`Visit frequency must be one of: ${VISIT_FREQUENCIES.join(', ')}`, 400);
      }
      updateData.defaultVisitFrequency = body.defaultVisitFrequency || null;
      changes.defaultVisitFrequency = { oldValue: existing.defaultVisitFrequency, newValue: updateData.defaultVisitFrequency };
    }

    // Update default rates
    if (body.defaultHourlyRate !== undefined) {
      const rate = body.defaultHourlyRate ? parseFloat(body.defaultHourlyRate) : null;
      if (rate !== null && rate < 0) {
        return errorResponse('Default hourly rate must be >= 0', 400);
      }
      updateData.defaultHourlyRate = rate;
      changes.defaultHourlyRate = { oldValue: existing.defaultHourlyRate, newValue: rate };
    }

    if (body.defaultPerVisitRate !== undefined) {
      const rate = body.defaultPerVisitRate ? parseFloat(body.defaultPerVisitRate) : null;
      if (rate !== null && rate < 0) {
        return errorResponse('Default per-visit rate must be >= 0', 400);
      }
      updateData.defaultPerVisitRate = rate;
      changes.defaultPerVisitRate = { oldValue: existing.defaultPerVisitRate, newValue: rate };
    }

    if (body.defaultMonthlyRetainer !== undefined) {
      const retainer = body.defaultMonthlyRetainer ? parseFloat(body.defaultMonthlyRetainer) : null;
      if (retainer !== null && retainer < 0) {
        return errorResponse('Default monthly retainer must be >= 0', 400);
      }
      updateData.defaultMonthlyRetainer = retainer;
      changes.defaultMonthlyRetainer = { oldValue: existing.defaultMonthlyRetainer, newValue: retainer };
    }

    // Update flags
    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
      changes.isActive = { oldValue: existing.isActive, newValue: body.isActive };
    }

    if (body.isCommon !== undefined) {
      updateData.isCommon = body.isCommon;
      changes.isCommon = { oldValue: existing.isCommon, newValue: body.isCommon };
    }

    // Update tags
    if (body.tags !== undefined) {
      if (Array.isArray(body.tags)) {
        updateData.tags = body.tags.filter(t => t && t.trim()).map(t => t.trim());
      } else {
        updateData.tags = [];
      }
      changes.tags = { oldValue: existing.tags, newValue: updateData.tags };
    }

    // Cannot update: usageCount, createdBy, lastUsedAt, lastUsedBy, lastUsedInProject (auto-tracked)

    // Update
    const result = await db.collection('professional_services_library').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Professional not found in library', 404);
    }

    // Create audit log
    if (Object.keys(changes).length > 0) {
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'UPDATED',
        entityType: 'PROFESSIONAL_SERVICES_LIBRARY',
        entityId: id,
        changes,
      });
    }

    return successResponse(result.value, 'Professional library updated successfully');
  } catch (error) {
    console.error('Update professional services library error:', error);
    return errorResponse('Failed to update professional services library', 500);
  }
}

/**
 * DELETE /api/professional-services-library/[id]
 * Soft delete professional from library
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
    const canManage = await hasPermission(user.id, 'manage_professional_services_library');
    if (!canManage) {
      return errorResponse('Insufficient permissions. Only OWNER can manage professional services library.', 403);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid professional services library ID', 400);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();

    // Check if professional exists
    const existing = await db.collection('professional_services_library').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existing) {
      return errorResponse('Professional not found in library', 404);
    }

    // Check if used in active assignments
    const activeAssignments = await db.collection('professional_services').countDocuments({
      libraryId: new ObjectId(id),
      status: 'active',
      deletedAt: null,
    });

    if (activeAssignments > 0) {
      return errorResponse(
        `Cannot delete professional with ${activeAssignments} active project assignment(s). Please terminate assignments first.`,
        400
      );
    }

    // Soft delete
    const result = await db.collection('professional_services_library').findOneAndUpdate(
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
      return errorResponse('Professional not found in library', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'PROFESSIONAL_SERVICES_LIBRARY',
      entityId: id,
      changes: { deleted: result.value },
    });

    return successResponse(null, 'Professional removed from library successfully');
  } catch (error) {
    console.error('Delete professional services library error:', error);
    return errorResponse('Failed to remove professional from library', 500);
  }
}

