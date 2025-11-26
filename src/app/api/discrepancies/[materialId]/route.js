/**
 * Discrepancy Management API Route
 * GET: Get discrepancy record for a material
 * PUT: Update discrepancy status and resolution
 * 
 * GET/PUT /api/discrepancies/[materialId]
 * Auth: PM, OWNER, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit-log';

/**
 * GET /api/discrepancies/[materialId]
 * Gets discrepancy record for a material
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasViewPermission = await hasPermission(user.id, 'view_reports');
    if (!hasViewPermission) {
      return errorResponse('Insufficient permissions to view discrepancies', 403);
    }

    const { materialId } = await params;

    if (!ObjectId.isValid(materialId)) {
      return errorResponse('Invalid material ID', 400);
    }

    const db = await getDatabase();
    const discrepancy = await db.collection('discrepancies').findOne({
      materialId: new ObjectId(materialId),
      isActive: true,
    });

    if (!discrepancy) {
      return successResponse({ discrepancy: null, message: 'No active discrepancy found' });
    }

    return successResponse({ discrepancy });
  } catch (error) {
    console.error('Get discrepancy error:', error);
    return errorResponse('Failed to retrieve discrepancy', 500);
  }
}

/**
 * PUT /api/discrepancies/[materialId]
 * Updates discrepancy status and resolution
 */
export async function PUT(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasViewPermission = await hasPermission(user.id, 'view_reports');
    if (!hasViewPermission) {
      return errorResponse('Insufficient permissions to update discrepancies', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { materialId } = await params;

    if (!ObjectId.isValid(materialId)) {
      return errorResponse('Invalid material ID', 400);
    }

    const body = await request.json();
    const { status, resolutionNotes } = body;

    if (!status || !['open', 'investigating', 'resolved', 'false_positive'].includes(status)) {
      return errorResponse('Valid status is required (open, investigating, resolved, false_positive)', 400);
    }

    const db = await getDatabase();

    // Get existing discrepancy or create new one
    let discrepancy = await db.collection('discrepancies').findOne({
      materialId: new ObjectId(materialId),
      isActive: true,
    });

    const updateData = {
      status,
      resolutionNotes: resolutionNotes || '',
      updatedAt: new Date(),
      updatedBy: new ObjectId(userProfile._id),
    };

    // If resolving or marking as false positive, set resolvedAt
    if (status === 'resolved' || status === 'false_positive') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = new ObjectId(userProfile._id);
      updateData.isActive = false;
    }

    if (discrepancy) {
      // Update existing discrepancy
      const oldStatus = discrepancy.status;
      await db.collection('discrepancies').findOneAndUpdate(
        { _id: discrepancy._id },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      // Add to resolution history
      await db.collection('discrepancies').findOneAndUpdate(
        { _id: discrepancy._id },
        {
          $push: {
            resolutionHistory: {
              status,
              resolutionNotes: resolutionNotes || '',
              updatedBy: new ObjectId(userProfile._id),
              updatedAt: new Date(),
            },
          },
        }
      );

      // Create audit log
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'DISCREPANCY_STATUS_UPDATED',
        entityType: 'DISCREPANCY',
        entityId: discrepancy._id.toString(),
        changes: {
          status: { oldValue: oldStatus, newValue: status },
          resolutionNotes: resolutionNotes || '',
        },
        projectId: discrepancy.projectId?.toString(),
      });
    } else {
      // Create new discrepancy record (shouldn't normally happen, but handle it)
      const material = await db.collection('materials').findOne({
        _id: new ObjectId(materialId),
      });

      if (!material) {
        return errorResponse('Material not found', 404);
      }

      const newDiscrepancy = {
        materialId: new ObjectId(materialId),
        projectId: material.projectId ? new ObjectId(material.projectId) : null,
        status,
        resolutionNotes: resolutionNotes || '',
        isActive: status !== 'resolved' && status !== 'false_positive',
        resolutionHistory: [
          {
            status,
            resolutionNotes: resolutionNotes || '',
            updatedBy: new ObjectId(userProfile._id),
            updatedAt: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: new ObjectId(userProfile._id),
        updatedBy: new ObjectId(userProfile._id),
        ...(status === 'resolved' || status === 'false_positive' ? {
          resolvedAt: new Date(),
          resolvedBy: new ObjectId(userProfile._id),
        } : {}),
      };

      await db.collection('discrepancies').insertOne(newDiscrepancy);
    }

    return successResponse({
      message: 'Discrepancy status updated successfully',
      status,
    });
  } catch (error) {
    console.error('Update discrepancy error:', error);
    return errorResponse('Failed to update discrepancy', 500);
  }
}

