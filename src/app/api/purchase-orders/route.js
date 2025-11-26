/**
 * Purchase Orders API Route
 * GET: List all purchase orders with filters
 * POST: Create new purchase order from approved request
 * 
 * GET /api/purchase-orders
 * POST /api/purchase-orders
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotification } from '@/lib/notifications';
import { generatePurchaseOrderNumber } from '@/lib/generators/purchase-order-number-generator';
import { validatePurchaseOrder } from '@/lib/schemas/purchase-order-schema';
import { validateCapitalAvailability } from '@/lib/financial-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/purchase-orders
 * Returns purchase orders with filtering, sorting, and pagination
 * Auth: PM, OWNER, SUPPLIER, ACCOUNTANT
 * Query params: projectId, status, supplierId, search, page, limit, sortBy, sortOrder
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canView = await hasPermission(user.id, 'view_purchase_orders');
    if (!canView) {
      return errorResponse('Insufficient permissions to view purchase orders', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'sentAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const db = await getDatabase();

    // Build query
    const query = { deletedAt: null };
    const andConditions = [];

    // Role-based filtering
    const userRole = userProfile.role?.toLowerCase();
    if (userRole === 'supplier') {
      // SUPPLIER can only see their own orders
      query.supplierId = new ObjectId(userProfile._id);
    }
    // PM, OWNER, ACCOUNTANT can see all orders

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (status) {
      query.status = status;
    }

    if (supplierId && ObjectId.isValid(supplierId)) {
      query.supplierId = new ObjectId(supplierId);
    }

    // Search filter
    if (search) {
      const searchConditions = [
        { materialName: { $regex: search, $options: 'i' } },
        { purchaseOrderNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
      ];
      andConditions.push({ $or: searchConditions });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get total count
    const total = await db.collection('purchase_orders').countDocuments(query);

    // Get paginated results
    const skip = (page - 1) * limit;
    const orders = await db
      .collection('purchase_orders')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    return successResponse({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get purchase orders error:', error);
    return errorResponse('Failed to retrieve purchase orders', 500);
  }
}

/**
 * POST /api/purchase-orders
 * Creates a new purchase order from approved material request
 * Auth: PM, OWNER
 * 
 * CRITICAL: Validates capital availability before creation
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canCreate = await hasPermission(user.id, 'create_purchase_order');
    if (!canCreate) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can create purchase orders.', 403);
    }

    const body = await request.json();
    const {
      materialRequestId,
      supplierId,
      quantityOrdered,
      unitCost,
      deliveryDate,
      terms,
      notes,
    } = body;

    // Validate required fields
    if (!materialRequestId || !ObjectId.isValid(materialRequestId)) {
      return errorResponse('Valid materialRequestId is required', 400);
    }

    if (!supplierId || !ObjectId.isValid(supplierId)) {
      return errorResponse('Valid supplierId is required', 400);
    }

    if (!quantityOrdered || quantityOrdered <= 0) {
      return errorResponse('Quantity ordered must be greater than 0', 400);
    }

    if (unitCost === undefined || unitCost < 0) {
      return errorResponse('Unit cost must be >= 0', 400);
    }

    if (!deliveryDate) {
      return errorResponse('Delivery date is required', 400);
    }

    // Validate delivery date is in the future
    const deliveryDateObj = new Date(deliveryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deliveryDateObj < today) {
      return errorResponse('Delivery date must be a future date', 400);
    }

    // Calculate total cost
    const totalCost = quantityOrdered * unitCost;

    // Get user profile
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();

    // Verify material request exists and is approved
    const materialRequest = await db.collection('material_requests').findOne({
      _id: new ObjectId(materialRequestId),
      status: 'approved',
      deletedAt: null,
    });

    if (!materialRequest) {
      return errorResponse('Material request not found or not approved', 404);
    }

    // Check if request already converted to order
    if (materialRequest.linkedPurchaseOrderId) {
      return errorResponse('Material request has already been converted to a purchase order', 400);
    }

    // Verify supplier exists and is a supplier
    const supplier = await db.collection('users').findOne({
      _id: new ObjectId(supplierId),
      role: { $in: ['supplier', 'SUPPLIER'] },
      status: 'active',
    });

    if (!supplier) {
      return errorResponse('Supplier not found or inactive', 404);
    }

    // CRITICAL: Validate capital availability
    const capitalValidation = await validateCapitalAvailability(
      materialRequest.projectId.toString(),
      totalCost
    );

    if (!capitalValidation.isValid) {
      return errorResponse(
        `Insufficient capital. Available: ${capitalValidation.available.toLocaleString()}, Required: ${totalCost.toLocaleString()}, Shortfall: ${(totalCost - capitalValidation.available).toLocaleString()}`,
        400
      );
    }

    // Generate purchase order number
    const purchaseOrderNumber = await generatePurchaseOrderNumber();

    // Build purchase order document
    const purchaseOrder = {
      purchaseOrderNumber,
      materialRequestId: new ObjectId(materialRequestId),
      supplierId: new ObjectId(supplierId),
      supplierName: `${supplier.firstName || ''} ${supplier.lastName || ''}`.trim() || supplier.email,
      supplierEmail: supplier.email || null,
      projectId: materialRequest.projectId,
      ...(materialRequest.floorId && { floorId: materialRequest.floorId }),
      ...(materialRequest.categoryId && { categoryId: materialRequest.categoryId }),
      ...(materialRequest.category && { category: materialRequest.category }),
      materialName: materialRequest.materialName,
      description: materialRequest.description || '',
      quantityOrdered: parseFloat(quantityOrdered),
      unit: materialRequest.unit,
      unitCost: parseFloat(unitCost),
      totalCost: parseFloat(totalCost),
      deliveryDate: deliveryDateObj,
      terms: terms?.trim() || '',
      notes: notes?.trim() || '',
      status: 'order_sent',
      sentAt: new Date(),
      financialStatus: 'not_committed',
      createdBy: new ObjectId(userProfile._id),
      createdByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Validate purchase order
    const validation = validatePurchaseOrder(purchaseOrder);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Insert purchase order
    const result = await db.collection('purchase_orders').insertOne(purchaseOrder);

    const insertedOrder = { ...purchaseOrder, _id: result.insertedId };

    // Update material request to link to purchase order
    // If request is already marked as converted, just update the linkedPurchaseOrderId
    // If not converted yet, mark as converted and link the PO
    await db.collection('material_requests').updateOne(
      { _id: new ObjectId(materialRequestId) },
      {
        $set: {
          linkedPurchaseOrderId: result.insertedId,
          status: 'converted_to_order', // Mark as converted when PO is created
          updatedAt: new Date(),
        },
      }
    );

    // Create notification for supplier
    await createNotification({
      userId: supplierId,
      type: 'approval_needed',
      title: 'New Purchase Order',
      message: `You have received a new purchase order ${purchaseOrderNumber} for ${quantityOrdered} ${materialRequest.unit} of ${materialRequest.materialName}`,
      projectId: materialRequest.projectId.toString(),
      relatedModel: 'PURCHASE_ORDER',
      relatedId: result.insertedId.toString(),
      createdBy: userProfile._id.toString(),
    });

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'PURCHASE_ORDER',
      entityId: result.insertedId.toString(),
      projectId: materialRequest.projectId.toString(),
      changes: {
        created: insertedOrder,
        capitalValidation: {
          available: capitalValidation.available,
          required: totalCost,
          isValid: true,
        },
      },
    });

    return successResponse({
      order: insertedOrder,
      capitalInfo: {
        available: capitalValidation.available,
        required: totalCost,
        remaining: capitalValidation.available - totalCost,
      },
    }, 'Purchase order created successfully', 201);
  } catch (error) {
    console.error('Create purchase order error:', error);
    return errorResponse('Failed to create purchase order', 500);
  }
}

