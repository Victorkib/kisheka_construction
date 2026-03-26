/**
 * Operator Assignments API Route
 * GET: List operator assignments for equipment
 * POST: Create new operator assignment
 *
 * GET /api/equipment/[id]/operators/assignments?status=active
 * POST /api/equipment/[id]/operators/assignments
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  createOperatorAssignment,
  validateOperatorAssignment,
  checkAssignmentConflicts
} from '@/lib/schemas/operator-assignment-schema';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/equipment/[id]/operators/assignments
 * List operator assignments for equipment
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
      return errorResponse('Invalid equipment ID', 400);
    }

    const db = await getDatabase();
    const { searchParams } = new URL(request.url);
    
    // Build query
    const query = {
      equipmentId: new ObjectId(id),
      deletedAt: null
    };

    // Filter by status
    const status = searchParams.get('status');
    if (status && ['active', 'completed', 'cancelled', 'scheduled'].includes(status)) {
      query.status = status;
    }

    // Get assignments
    const assignments = await db.collection('operator_assignments')
      .find(query)
      .sort({ startDate: -1 })
      .toArray();

    return successResponse({
      assignments,
      count: assignments.length
    }, 'Operator assignments retrieved successfully');
  } catch (error) {
    console.error('Get operator assignments error:', error);
    return errorResponse('Failed to retrieve operator assignments', 500);
  }
}

/**
 * POST /api/equipment/[id]/operators/assignments
 * Create new operator assignment
 */
export async function POST(request, { params }) {
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

    const hasCreatePermission = await hasPermission(user.id, 'create_equipment');
    if (!hasCreatePermission) {
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['owner', 'pm', 'project_manager'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse('Insufficient permissions. Only PM and OWNER can create operator assignments.', 403);
      }
    }

    const { id: equipmentId } = await params;

    if (!ObjectId.isValid(equipmentId)) {
      return errorResponse('Invalid equipment ID', 400);
    }

    const body = await request.json();
    const {
      workerId,
      workerName,
      startDate,
      endDate,
      dailyRate,
      expectedHours,
      notes
    } = body;

    const db = await getDatabase();

    // Verify equipment exists
    const equipment = await db.collection('equipment').findOne({
      _id: new ObjectId(equipmentId),
      deletedAt: null
    });

    if (!equipment) {
      return errorResponse('Equipment not found', 404);
    }

    // Verify worker exists if workerId provided
    if (workerId && ObjectId.isValid(workerId)) {
      const worker = await db.collection('worker_profiles').findOne({
        _id: new ObjectId(workerId),
        deletedAt: null
      });
      if (!worker) {
        return errorResponse('Worker not found', 400);
      }
      
      // Validate worker status
      if (worker.status === 'terminated') {
        return errorResponse('Cannot assign terminated worker to equipment', 400);
      }
      
      if (worker.status === 'on_leave') {
        // Add warning but allow assignment
        console.log('Warning: Worker is on leave');
      }
      
      // Validate rate against worker's default rate
      if (worker.defaultHourlyRate && dailyRate) {
        const assignmentHourlyRate = dailyRate / (expectedHours || 8);
        const rateDeviation = Math.abs(assignmentHourlyRate - worker.defaultHourlyRate) / worker.defaultHourlyRate;
        
        if (rateDeviation > 0.3) {
          // More than 30% deviation - add warning
          console.log(`Warning: Assignment rate differs from worker's default rate by ${Math.round(rateDeviation * 100)}%`);
        }
      }
    }

    // Prepare assignment data
    const assignmentData = {
      ...body,
      equipmentId,
      projectId: equipment.projectId
    };

    // Validate
    const validation = validateOperatorAssignment(assignmentData);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Check for conflicts
    const existingAssignments = await db.collection('operator_assignments')
      .find({
        equipmentId: new ObjectId(equipmentId),
        deletedAt: null
      })
      .toArray();

    const conflictCheck = checkAssignmentConflicts(
      existingAssignments,
      new ObjectId(equipmentId),
      new ObjectId(workerId),
      new Date(startDate),
      new Date(endDate)
    );

    if (conflictCheck.hasConflict) {
      return errorResponse({
        message: 'Assignment conflicts detected',
        conflicts: conflictCheck.conflicts
      }, 409);
    }

    // Additional check: Look for existing labour entries for this worker during the period
    const existingLabourEntries = await db.collection('labour_entries').find({
      workerId: { $in: [new ObjectId(workerId)] },
      entryDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      status: { $in: ['approved', 'submitted', 'paid'] },
      deletedAt: null
    }).toArray();

    if (existingLabourEntries.length > 0) {
      // Add warning to response (don't block, just inform)
      console.log('Worker already has labour entries for this period:', existingLabourEntries.length);
    }

    // Create assignment
    const assignment = createOperatorAssignment(assignmentData, userProfile._id);

    const result = await db.collection('operator_assignments').insertOne(assignment);

    // Update equipment operator notes if needed
    if (!equipment.operatorNotes || !equipment.operatorNotes.includes(workerName)) {
      await db.collection('equipment').updateOne(
        { _id: new ObjectId(equipmentId) },
        {
          $set: {
            operatorNotes: equipment.operatorNotes
              ? `${equipment.operatorNotes}, ${workerName} assigned`
              : `${workerName} assigned`,
            updatedAt: new Date()
          }
        }
      );
    }

    return successResponse({
      assignment: { ...assignment, _id: result.insertedId }
    }, 'Operator assignment created successfully', 201);
  } catch (error) {
    console.error('Create operator assignment error:', error);
    if (error.message?.includes('conflicts')) {
      return errorResponse(error.message, 409);
    }
    return errorResponse('Failed to create operator assignment', 500);
  }
}
