/**
 * Individual Operator Assignment API Route
 * GET: Get single assignment
 * PUT: Update assignment
 * DELETE: Soft delete assignment
 *
 * GET /api/equipment/[id]/operators/assignments/[assignmentId]
 * PUT /api/equipment/[id]/operators/assignments/[assignmentId]
 * DELETE /api/equipment/[id]/operators/assignments/[assignmentId]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateOperatorAssignment, checkAssignmentConflicts } from '@/lib/schemas/operator-assignment-schema';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/equipment/[id]/operators/assignments/[assignmentId]
 * Get single operator assignment
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id: equipmentId, assignmentId } = await params;

    if (!ObjectId.isValid(equipmentId) || !ObjectId.isValid(assignmentId)) {
      return errorResponse('Invalid ID', 400);
    }

    const db = await getDatabase();
    const assignment = await db.collection('operator_assignments').findOne({
      _id: new ObjectId(assignmentId),
      equipmentId: new ObjectId(equipmentId),
      deletedAt: null
    });

    if (!assignment) {
      return errorResponse('Assignment not found', 404);
    }

    return successResponse(assignment, 'Assignment retrieved successfully');
  } catch (error) {
    console.error('Get assignment error:', error);
    return errorResponse('Failed to retrieve assignment', 500);
  }
}

/**
 * PUT /api/equipment/[id]/operators/assignments/[assignmentId]
 * Update operator assignment
 */
export async function PUT(request, { params }) {
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

    const hasEditPermission = await hasPermission(user.id, 'edit_equipment');
    if (!hasEditPermission) {
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['owner', 'pm', 'project_manager'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse('Insufficient permissions. Only PM and OWNER can update operator assignments.', 403);
      }
    }

    const { id: equipmentId, assignmentId } = await params;

    if (!ObjectId.isValid(equipmentId) || !ObjectId.isValid(assignmentId)) {
      return errorResponse('Invalid ID', 400);
    }

    const db = await getDatabase();

    // Get existing assignment
    const existingAssignment = await db.collection('operator_assignments').findOne({
      _id: new ObjectId(assignmentId),
      equipmentId: new ObjectId(equipmentId),
      deletedAt: null
    });

    if (!existingAssignment) {
      return errorResponse('Assignment not found', 404);
    }

    const body = await request.json();
    const {
      workerId,
      workerName,
      startDate,
      endDate,
      dailyRate,
      expectedHours,
      status,
      notes
    } = body;

    // Build update data
    const updateData = {
      updatedAt: new Date()
    };

    if (workerId !== undefined && ObjectId.isValid(workerId)) {
      updateData.workerId = new ObjectId(workerId);
    }

    if (workerName !== undefined) {
      updateData.workerName = workerName?.trim() || '';
    }

    if (startDate !== undefined) {
      updateData.startDate = new Date(startDate);
    }

    if (endDate !== undefined) {
      updateData.endDate = new Date(endDate);
    }

    if (dailyRate !== undefined) {
      updateData.dailyRate = parseFloat(dailyRate);
    }

    if (expectedHours !== undefined) {
      updateData.expectedHours = parseFloat(expectedHours);
    }

    if (status !== undefined) {
      if (!['active', 'completed', 'cancelled', 'scheduled'].includes(status)) {
        return errorResponse('Invalid status', 400);
      }
      updateData.status = status;
    }

    if (notes !== undefined) {
      updateData.notes = notes?.trim() || null;
    }

    // Validate updated data
    const updatedAssignment = { ...existingAssignment, ...updateData };
    const validation = validateOperatorAssignment(updatedAssignment);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Check for conflicts if dates or worker changed
    if (startDate || endDate || workerId) {
      const existingAssignments = await db.collection('operator_assignments')
        .find({
          equipmentId: new ObjectId(equipmentId),
          deletedAt: null
        })
        .toArray();

      const conflictCheck = checkAssignmentConflicts(
        existingAssignments,
        new ObjectId(equipmentId),
        new ObjectId(workerId || existingAssignment.workerId),
        new Date(startDate || existingAssignment.startDate),
        new Date(endDate || existingAssignment.endDate),
        new ObjectId(assignmentId) // Exclude current assignment
      );

      if (conflictCheck.hasConflict) {
        return errorResponse({
          message: 'Update would create conflicts',
          conflicts: conflictCheck.conflicts
        }, 409);
      }
    }

    // Update assignment
    const result = await db.collection('operator_assignments').findOneAndUpdate(
      { _id: new ObjectId(assignmentId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return successResponse(result.value, 'Assignment updated successfully');
  } catch (error) {
    console.error('Update assignment error:', error);
    if (error.message?.includes('conflicts')) {
      return errorResponse(error.message, 409);
    }
    return errorResponse('Failed to update assignment', 500);
  }
}

/**
 * DELETE /api/equipment/[id]/operators/assignments/[assignmentId]
 * Soft delete operator assignment
 */
export async function DELETE(request, { params }) {
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

    const hasDeletePermission = await hasPermission(user.id, 'edit_equipment');
    if (!hasDeletePermission) {
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['owner', 'pm', 'project_manager'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse('Insufficient permissions. Only PM and OWNER can delete operator assignments.', 403);
      }
    }

    const { id: equipmentId, assignmentId } = await params;

    if (!ObjectId.isValid(equipmentId) || !ObjectId.isValid(assignmentId)) {
      return errorResponse('Invalid ID', 400);
    }

    const db = await getDatabase();

    // Verify assignment exists
    const assignment = await db.collection('operator_assignments').findOne({
      _id: new ObjectId(assignmentId),
      equipmentId: new ObjectId(equipmentId),
      deletedAt: null
    });

    if (!assignment) {
      return errorResponse('Assignment not found', 404);
    }

    // Soft delete
    await db.collection('operator_assignments').updateOne(
      { _id: new ObjectId(assignmentId) },
      {
        $set: {
          deletedAt: new Date(),
          status: 'cancelled',
          updatedAt: new Date()
        }
      }
    );

    return successResponse(null, 'Assignment deleted successfully');
  } catch (error) {
    console.error('Delete assignment error:', error);
    return errorResponse('Failed to delete assignment', 500);
  }
}
