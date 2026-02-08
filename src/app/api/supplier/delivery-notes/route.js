/**
 * Supplier Delivery Notes API Route
 * GET: List materials awaiting delivery notes (for this supplier)
 * POST: Upload delivery note for material
 * 
 * GET /api/supplier/delivery-notes
 * POST /api/supplier/delivery-notes
 * Auth: SUPPLIER role only
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/supplier/delivery-notes
 * Returns materials supplied by this supplier that need delivery notes
 * Query params: status, page, limit
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only suppliers can access
    const hasViewPermission = await hasPermission(user.id, 'view_supplier_materials');
    if (!hasViewPermission) {
      return errorResponse('Insufficient permissions. Only SUPPLIER role can access this endpoint.', 403);
    }

    // Get user profile to identify supplier name
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Determine supplier name from user profile
    // Try: company name, firstName + lastName, or email domain
    const supplierName = userProfile.company || 
                        `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() ||
                        userProfile.email?.split('@')[0] ||
                        userProfile.email;

    if (!supplierName) {
      return errorResponse('Supplier name not found in user profile', 400);
    }

    // Normalize supplier name for matching (trim and lowercase for comparison)
    const normalizedSupplierName = supplierName.trim().toLowerCase();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Filter by material status
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const db = await getDatabase();

    // Build query - find materials where supplierName matches exactly (case-insensitive)
    // Use $or to check both supplierName and supplier fields (backward compatibility)
    // Escape special regex characters in supplier name
    const escapedSupplierName = supplierName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const supplierMatch = {
      $or: [
        // Exact match on supplierName (case-insensitive)
        { supplierName: { $regex: `^${escapedSupplierName}$`, $options: 'i' } },
        // Backward compatibility: also check supplier field
        { supplier: { $regex: `^${escapedSupplierName}$`, $options: 'i' } },
      ],
    };

    const query = {
      deletedAt: null,
      ...supplierMatch,
    };

    // Optionally filter by status
    if (status) {
      query.status = status;
    }

    // Optionally filter to only materials without delivery notes
    const needsDeliveryNote = searchParams.get('needsDeliveryNote');
    if (needsDeliveryNote === 'true') {
      query.$and = [
        supplierMatch,
        {
          $or: [
            { deliveryNoteFileUrl: { $exists: false } },
            { deliveryNoteFileUrl: null },
            { deliveryNoteFileUrl: '' },
          ],
        },
      ];
      // Remove the top-level $or since we're using $and now
      delete query.$or;
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const materials = await db
      .collection('materials')
      .find(query)
      .sort({ datePurchased: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('materials').countDocuments(query);

    return successResponse({
      materials,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      supplierName,
    });
  } catch (error) {
    console.error('Get supplier delivery notes error:', error);
    return errorResponse('Failed to retrieve materials', 500);
  }
}

/**
 * POST /api/supplier/delivery-notes
 * Uploads a delivery note for a material
 * Body: { materialId, deliveryNoteFileUrl }
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only suppliers can upload
    const hasUploadPermission = await hasPermission(user.id, 'upload_delivery_note');
    if (!hasUploadPermission) {
      return errorResponse('Insufficient permissions. Only SUPPLIER role can upload delivery notes.', 403);
    }

    // Get user profile
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Determine supplier name
    const supplierName = userProfile.company || 
                        `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() ||
                        userProfile.email?.split('@')[0] ||
                        userProfile.email;

    // Normalize supplier name for matching
    const normalizedSupplierName = supplierName.trim().toLowerCase();

    const body = await request.json();
    const { materialId, deliveryNoteFileUrl } = body;

    // Validation
    if (!materialId || !ObjectId.isValid(materialId)) {
      return errorResponse('Valid material ID is required', 400);
    }

    if (!deliveryNoteFileUrl || deliveryNoteFileUrl.trim().length === 0) {
      return errorResponse('Delivery note file URL is required', 400);
    }

    const db = await getDatabase();

    // Get material and verify it belongs to this supplier
    const material = await db.collection('materials').findOne({
      _id: new ObjectId(materialId),
      deletedAt: null,
    });

    if (!material) {
      return errorResponse('Material not found', 404);
    }

    // Verify supplier name matches exactly (case-insensitive, trimmed)
    const materialSupplierName = (material.supplierName || material.supplier || '').trim().toLowerCase();
    if (!materialSupplierName || materialSupplierName !== normalizedSupplierName) {
      return errorResponse('This material does not belong to your supplier account', 403);
    }

    // Update material with delivery note
    const result = await db.collection('materials').findOneAndUpdate(
      { _id: new ObjectId(materialId) },
      {
        $set: {
          deliveryNoteFileUrl: deliveryNoteFileUrl.trim(),
          dateDelivered: new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Failed to update material', 500);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'MATERIAL',
      entityId: materialId,
      changes: {
        deliveryNoteFileUrl: {
          oldValue: material.deliveryNoteFileUrl || null,
          newValue: deliveryNoteFileUrl,
        },
        dateDelivered: {
          oldValue: material.dateDelivered || null,
          newValue: new Date(),
        },
      },
    });

    return successResponse(
      result.value,
      'Delivery note uploaded successfully',
      200
    );
  } catch (error) {
    console.error('Upload delivery note error:', error);
    return errorResponse('Failed to upload delivery note', 500);
  }
}

