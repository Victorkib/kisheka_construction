/**
 * Supplier Detail API Route
 * GET: Get single supplier
 * PATCH: Update supplier
 * DELETE: Soft delete supplier
 * 
 * GET /api/suppliers/[id]
 * PATCH /api/suppliers/[id]
 * DELETE /api/suppliers/[id]
 * Auth: OWNER, PM only
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/suppliers/[id]
 * Get single supplier by ID
 * Auth: OWNER, PM only
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Check permission
    const canView = await hasPermission(user.id, 'view_suppliers');
    if (!canView) {
      return errorResponse('Insufficient permissions', 403);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid supplier ID', 400);
    }

    const db = await getDatabase();
    const supplier = await db.collection('suppliers').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!supplier) {
      return errorResponse('Supplier not found', 404);
    }

    // Get purchase orders for this supplier
    const purchaseOrders = await db.collection('purchase_orders')
      .find({
        supplierId: new ObjectId(id),
        deletedAt: null
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    return successResponse({
      supplier,
      recentOrders: purchaseOrders,
      orderCount: await db.collection('purchase_orders').countDocuments({
        supplierId: new ObjectId(id),
        deletedAt: null
      })
    }, 'Supplier retrieved successfully');
  } catch (error) {
    console.error('Get supplier error:', error);
    return errorResponse('Failed to retrieve supplier', 500);
  }
}

/**
 * PATCH /api/suppliers/[id]
 * Update supplier
 * Auth: OWNER, PM only
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Check permission
    const canEdit = await hasPermission(user.id, 'edit_supplier');
    if (!canEdit) {
      return errorResponse('Insufficient permissions. Only OWNER and PM can edit suppliers.', 403);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid supplier ID', 400);
    }

    const body = await request.json();
    const {
      name,
      contactPerson,
      email,
      phone,
      alternatePhone,
      alternateEmail,
      businessType,
      taxId,
      address,
      preferredContactMethod,
      emailEnabled,
      smsEnabled,
      pushNotificationsEnabled,
      specialties,
      rating,
      notes,
      status
    } = body;

    const db = await getDatabase();

    // Check if supplier exists
    const existing = await db.collection('suppliers').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!existing) {
      return errorResponse('Supplier not found', 404);
    }

    // If email is being changed, check for conflicts
    if (email && email.toLowerCase().trim() !== existing.email) {
      const emailConflict = await db.collection('suppliers').findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: new ObjectId(id) },
        deletedAt: null
      });

      if (emailConflict) {
        return errorResponse('Another supplier with this email already exists', 409);
      }
    }

    // Build update object (only include fields that are provided)
    const updateData = {
      updatedAt: new Date()
    };

    if (name !== undefined) updateData.name = name.trim();
    if (contactPerson !== undefined) updateData.contactPerson = contactPerson?.trim() || null;
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return errorResponse('Invalid email format', 400);
      }
      updateData.email = email.toLowerCase().trim();
    }
    if (phone !== undefined) updateData.phone = phone.trim();
    if (alternatePhone !== undefined) updateData.alternatePhone = alternatePhone?.trim() || null;
    if (alternateEmail !== undefined) updateData.alternateEmail = alternateEmail?.toLowerCase().trim() || null;
    if (businessType !== undefined) updateData.businessType = businessType || null;
    if (taxId !== undefined) updateData.taxId = taxId?.trim() || null;
    if (address !== undefined) updateData.address = address || null;
    if (preferredContactMethod !== undefined) updateData.preferredContactMethod = preferredContactMethod;
    if (emailEnabled !== undefined) updateData.emailEnabled = emailEnabled;
    if (smsEnabled !== undefined) updateData.smsEnabled = smsEnabled;
    if (pushNotificationsEnabled !== undefined) updateData.pushNotificationsEnabled = pushNotificationsEnabled;
    if (specialties !== undefined) updateData.specialties = Array.isArray(specialties) ? specialties : [];
    if (rating !== undefined) updateData.rating = rating || null;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (status !== undefined) updateData.status = status;

    await db.collection('suppliers').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    const updated = await db.collection('suppliers').findOne({
      _id: new ObjectId(id)
    });

    return successResponse(updated, 'Supplier updated successfully');
  } catch (error) {
    console.error('Update supplier error:', error);
    return errorResponse('Failed to update supplier', 500);
  }
}

/**
 * DELETE /api/suppliers/[id]
 * Soft delete supplier
 * Auth: OWNER only
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Check permission - only OWNER can delete
    const canDelete = await hasPermission(user.id, 'delete_supplier');
    if (!canDelete) {
      return errorResponse('Insufficient permissions. Only OWNER can delete suppliers.', 403);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid supplier ID', 400);
    }

    const db = await getDatabase();

    // Check if supplier exists
    const existing = await db.collection('suppliers').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!existing) {
      return errorResponse('Supplier not found', 404);
    }

    // Check if supplier has active purchase orders
    const activeOrders = await db.collection('purchase_orders').countDocuments({
      supplierId: new ObjectId(id),
      status: { $in: ['order_sent', 'order_accepted', 'ready_for_delivery'] },
      deletedAt: null
    });

    if (activeOrders > 0) {
      return errorResponse(
        `Cannot delete supplier with ${activeOrders} active purchase order(s). Please complete or cancel all orders first.`,
        400
      );
    }

    // Soft delete
    await db.collection('suppliers').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          deletedAt: new Date(),
          updatedAt: new Date(),
          status: 'inactive'
        }
      }
    );

    return successResponse(null, 'Supplier deleted successfully');
  } catch (error) {
    console.error('Delete supplier error:', error);
    return errorResponse('Failed to delete supplier', 500);
  }
}

