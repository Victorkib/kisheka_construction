/**
 * Materials API Route
 * GET: List all materials with filters
 * POST: Create new material
 * 
 * GET /api/materials
 * POST /api/materials
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { calculateTotalCost } from '@/lib/calculations';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateCapitalAvailability } from '@/lib/financial-helpers';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';
import { recalculateFloorSpending } from '@/lib/material-helpers';
import { getProjectContext, createProjectFilter } from '@/lib/middleware/project-context';
import { normalizeUserRole, isRole } from '@/lib/role-constants';
import { incrementLibraryUsage } from '@/lib/helpers/material-library-helpers';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/materials
 * Returns materials with filtering, sorting, and pagination
 * Auth: All authenticated users
 * Query params: projectId, category, floor, phaseId, status, supplier, search, page, limit, sortBy, sortOrder
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const floor = searchParams.get('floor');
    const phaseId = searchParams.get('phaseId');
    const status = searchParams.get('status');
    const supplier = searchParams.get('supplier');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Get and validate project context
    const projectContext = await getProjectContext(request, user.id);
    
    // If projectId is provided, validate access
    if (projectContext.projectId && !projectContext.hasAccess) {
      return errorResponse(projectContext.error || 'Access denied to this project', 403);
    }

    const db = await getDatabase();

    // Build query with project filter
    const query = createProjectFilter(projectContext.projectId, {});
    const orConditions = [];

    if (category) {
      if (ObjectId.isValid(category)) {
        query.categoryId = new ObjectId(category);
      } else {
        query.category = category;
      }
    }

    if (floor === 'unassigned' || floor === 'none' || floor === 'missing') {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [{ floor: { $exists: false } }, { floor: null }],
      });
    } else if (floor && ObjectId.isValid(floor)) {
      query.floor = new ObjectId(floor);
    }

    if (phaseId && ObjectId.isValid(phaseId)) {
      query.phaseId = new ObjectId(phaseId);
    }

    if (status) {
      query.status = status;
    }

    // Archive filter: if archived=true, show only archived; if archived=false or not set, exclude archived
    const archived = searchParams.get('archived');
    if (archived === 'true') {
      query.deletedAt = { $ne: null };
    } else if (archived === 'false' || !archived) {
      // Default: exclude archived materials
      query.deletedAt = null;
    }

    // Build supplier filter
    if (supplier) {
      orConditions.push(
        { supplierName: { $regex: supplier, $options: 'i' } },
        { supplier: { $regex: supplier, $options: 'i' } }
      );
    }

    // Build search filter
    if (search) {
      const searchConditions = [
        { name: { $regex: search, $options: 'i' } },
        // Backward compatibility: also search materialName if it exists
        { materialName: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
        // Backward compatibility: also search supplier if it exists
        { supplier: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
      
      // If supplier filter exists, combine with $and
      if (orConditions.length > 0) {
        query.$and = [
          { $or: orConditions }, // Supplier filter
          { $or: searchConditions } // Search filter
        ];
      } else {
        query.$or = searchConditions;
      }
    } else if (orConditions.length > 0) {
      // Only supplier filter, no search
      query.$or = orConditions;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const skip = (page - 1) * limit;
    const materials = await db
      .collection('materials')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Populate category names for materials that have categoryId
    const categoryIds = materials
      .map(m => m.categoryId)
      .filter(id => id && ObjectId.isValid(id))
      .map(id => new ObjectId(id));
    
    let categoriesMap = {};
    if (categoryIds.length > 0) {
      const categories = await db
        .collection('categories')
        .find({ _id: { $in: categoryIds } })
        .toArray();
      categoriesMap = categories.reduce((acc, cat) => {
        acc[cat._id.toString()] = cat;
        return acc;
      }, {});
    }

    // Populate material request details for materials that have materialRequestId
    const materialRequestIds = materials
      .map(m => m.materialRequestId)
      .filter(id => id && ObjectId.isValid(id))
      .map(id => new ObjectId(id));
    
    let materialRequestsMap = {};
    if (materialRequestIds.length > 0) {
      const materialRequests = await db
        .collection('material_requests')
        .find({ _id: { $in: materialRequestIds } })
        .toArray();
      materialRequestsMap = materialRequests.reduce((acc, req) => {
        acc[req._id.toString()] = req;
        return acc;
      }, {});
    }

    // Populate purchase order details for materials that have purchaseOrderId or linkedPurchaseOrderId
    const purchaseOrderIds = materials
      .map(m => m.purchaseOrderId || m.linkedPurchaseOrderId)
      .filter(id => id && ObjectId.isValid(id))
      .map(id => new ObjectId(id));
    
    let purchaseOrdersMap = {};
    if (purchaseOrderIds.length > 0) {
      const purchaseOrders = await db
        .collection('purchase_orders')
        .find({ _id: { $in: purchaseOrderIds } })
        .toArray();
      purchaseOrdersMap = purchaseOrders.reduce((acc, po) => {
        acc[po._id.toString()] = po;
        return acc;
      }, {});
    }

    // Enrich materials with category, material request, and purchase order details
    const enrichedMaterials = materials.map(material => {
      let enriched = { ...material };
      
      // Add category details
      if (material.categoryId && categoriesMap[material.categoryId.toString()]) {
        enriched.categoryDetails = categoriesMap[material.categoryId.toString()];
        enriched.category = material.category || categoriesMap[material.categoryId.toString()].name;
      }
      
      // Add material request details
      if (material.materialRequestId) {
        const requestId = material.materialRequestId.toString();
        if (materialRequestsMap[requestId]) {
          enriched.materialRequest = materialRequestsMap[requestId];
          enriched.materialRequestNumber = materialRequestsMap[requestId].requestNumber;
          enriched.materialRequestStatus = materialRequestsMap[requestId].status;
        }
      }
      
      // Add purchase order details
      const poId = (material.purchaseOrderId || material.linkedPurchaseOrderId);
      if (poId) {
        const poIdStr = poId.toString();
        if (purchaseOrdersMap[poIdStr]) {
          enriched.purchaseOrder = purchaseOrdersMap[poIdStr];
          enriched.purchaseOrderNumber = purchaseOrdersMap[poIdStr].purchaseOrderNumber;
          enriched.purchaseOrderStatus = purchaseOrdersMap[poIdStr].status;
          enriched.isBulkOrder = purchaseOrdersMap[poIdStr].isBulkOrder || false;
        }
      }
      
      return enriched;
    });

    const total = await db.collection('materials').countDocuments(query);

    return successResponse(
      {
        materials: enrichedMaterials,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
      'Materials retrieved successfully'
    );
  } catch (error) {
    console.error('Get materials error:', error);
    return errorResponse('Failed to retrieve materials', 500);
  }
}

/**
 * POST /api/materials
 * Creates a new material entry
 * Auth: CLERK, PM, OWNER
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasCreatePermission = await hasPermission(user.id, 'create_material');
    if (!hasCreatePermission) {
      return errorResponse('Insufficient permissions. Only CLERK, PM, and OWNER can create materials.', 403);
    }

    const body = await request.json();
    const {
      projectId,
      name,
      materialName,
      description,
      category,
      categoryId,
      floor,
      phaseId,
      quantity,
      quantityPurchased,
      unit,
      unitCost,
      estimatedUnitCost,
      supplierName,
      supplier,
      paymentMethod,
      invoiceNumber,
      invoiceDate,
      datePurchased,
      notes,
      libraryMaterialId,
      // File uploads
      receiptFileUrl,
      receiptUrl,
      invoiceFileUrl,
      deliveryNoteFileUrl,
      // Finishing details (Module 3)
      finishingDetails,
      // Dual Workflow fields
      entryType,
      materialRequestId,
      purchaseOrderId,
      orderFulfillmentDate,
      retroactiveNotes,
      originalPurchaseDate,
      documentationStatus,
      costStatus,
      costVerified,
    } = body;

    // Validation
    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    const db = await getDatabase();

    // Verify project exists and is not deleted
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Validate category if provided
    if (categoryId && ObjectId.isValid(categoryId)) {
      const category = await db.collection('categories').findOne({
        _id: new ObjectId(categoryId),
      });

      if (!category) {
        return errorResponse(`Category not found: ${categoryId}`, 404);
      }
    }

    // Validate floor if provided
    if (floor && ObjectId.isValid(floor)) {
      const floorDoc = await db.collection('floors').findOne({
        _id: new ObjectId(floor),
      });

      if (!floorDoc) {
        return errorResponse(`Floor not found: ${floor}`, 404);
      }

      // Verify floor belongs to the same project
      if (floorDoc.projectId.toString() !== projectId) {
        return errorResponse('Floor does not belong to the selected project', 400);
      }
    }

    // Validate phase if provided
    if (phaseId && ObjectId.isValid(phaseId)) {
      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(phaseId),
      });

      if (!phase) {
        return errorResponse(`Phase not found: ${phaseId}`, 404);
      }

      // Verify phase belongs to the same project
      if (phase.projectId.toString() !== projectId) {
        return errorResponse('Phase does not belong to the selected project', 400);
      }
    }

    // Determine entry type (default to retroactive for backward compatibility)
    const materialEntryType = entryType || 'retroactive_entry';
    
    // Validate entry type specific requirements
    if (materialEntryType === 'new_procurement') {
      // For new procurement, must have purchaseOrderId
      if (!purchaseOrderId || !ObjectId.isValid(purchaseOrderId)) {
        return errorResponse('Purchase order ID required for new procurement entries', 400);
      }
    }

    // Get user profile
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // For new procurement, validate purchase order exists and is fulfilled
    if (materialEntryType === 'new_procurement') {
      const purchaseOrder = await db.collection('purchase_orders').findOne({
        _id: new ObjectId(purchaseOrderId),
        status: 'ready_for_delivery',
        deletedAt: null,
      });
      
      if (!purchaseOrder) {
        return errorResponse('Purchase order not found or not ready for delivery', 400);
      }
      
      // Use data from purchase order if not provided
      if (!name && !materialName) {
        body.name = purchaseOrder.materialName;
        body.materialName = purchaseOrder.materialName;
      }
      if (!quantity && !quantityPurchased) {
        body.quantity = purchaseOrder.quantityOrdered;
        body.quantityPurchased = purchaseOrder.quantityOrdered;
      }
      if (!unitCost && purchaseOrder.unitCost) {
        body.unitCost = purchaseOrder.unitCost;
      }
      if (!supplierName && !supplier && purchaseOrder.supplierName) {
        body.supplierName = purchaseOrder.supplierName;
        body.supplier = purchaseOrder.supplierName;
      }
      if (!deliveryNoteFileUrl && purchaseOrder.deliveryNoteFileUrl) {
        body.deliveryNoteFileUrl = purchaseOrder.deliveryNoteFileUrl;
      }
      // Set order fulfillment date
      body.orderFulfillmentDate = new Date();
    }

    // Now get values after potential purchase order data merge
    const itemName = name || materialName;
    if (!itemName || itemName.trim().length === 0) {
      return errorResponse('Material name is required', 400);
    }

    const qty = quantity || quantityPurchased;
    if (!qty || qty <= 0) {
      return errorResponse('Quantity must be greater than 0', 400);
    }

    const parsedUnitCost = unitCost !== undefined && unitCost !== null ? parseFloat(unitCost) : null;
    const parsedEstimatedUnitCost =
      estimatedUnitCost !== undefined && estimatedUnitCost !== null ? parseFloat(estimatedUnitCost) : null;

    // CRITICAL FIX: Validate unitCost based on entry type
    // For new_procurement entries, unitCost must be > 0
    // For retroactive entries, allow missing and support estimated unit cost
    if (materialEntryType === 'new_procurement') {
      if (parsedUnitCost === null || isNaN(parsedUnitCost) || parsedUnitCost <= 0) {
        return errorResponse(
          'Unit cost is required and must be greater than 0 for new procurement entries. ' +
          'Please provide a valid unit cost when creating the material.',
          400
        );
      }
    } else {
      if (parsedUnitCost !== null && (isNaN(parsedUnitCost) || parsedUnitCost < 0)) {
        return errorResponse('Unit cost must be non-negative', 400);
      }
      if (parsedEstimatedUnitCost !== null && (isNaN(parsedEstimatedUnitCost) || parsedEstimatedUnitCost < 0)) {
        return errorResponse('Estimated unit cost must be non-negative', 400);
      }
    }

    let finalUnitCost = parsedUnitCost || 0;
    let resolvedCostStatus = costStatus || null;

    if (materialEntryType === 'retroactive_entry' && (!parsedUnitCost || parsedUnitCost === 0)) {
      if (parsedEstimatedUnitCost && parsedEstimatedUnitCost > 0) {
        finalUnitCost = parsedEstimatedUnitCost;
        if (!resolvedCostStatus || resolvedCostStatus === 'missing') {
          resolvedCostStatus = 'estimated';
        }
      } else {
        finalUnitCost = 0;
        if (!resolvedCostStatus) {
          resolvedCostStatus = 'missing';
        }
      }
    }

    // For retroactive entries, validate supplier if supplierId provided
    let supplierNameValue = supplierName || supplier || 'Unknown';
    
    if (materialEntryType === 'retroactive_entry') {
      // Check if supplierId is provided and validate it
      const supplierIdFromBody = body.supplierId;
      if (supplierIdFromBody && ObjectId.isValid(supplierIdFromBody)) {
        const supplierDoc = await db.collection('suppliers').findOne({
          _id: new ObjectId(supplierIdFromBody),
          status: 'active',
          deletedAt: null,
        });

        if (!supplierDoc) {
          return errorResponse('Supplier not found or inactive', 404);
        }

        // Use supplier name from suppliers collection
        supplierNameValue = supplierDoc.name;
        body.supplierName = supplierDoc.name;
        body.supplier = supplierDoc.name;
      } else if (!supplierName && !supplier) {
        // No supplier provided, set default
        body.supplierName = 'Unknown';
        body.supplier = 'Unknown';
        supplierNameValue = 'Unknown';
      }
      
      if (materialEntryType === 'retroactive_entry') {
        const calculatedTotal = calculateTotalCost(qty, finalUnitCost);
        body.costStatus = resolvedCostStatus || (calculatedTotal > 0 ? 'actual' : 'missing');
        if (!documentationStatus) {
          body.documentationStatus = (receiptFileUrl || receiptUrl || invoiceFileUrl) ? 'complete' : 'missing';
        }
      }
    }
    // Only require supplier for new procurement
    if (materialEntryType === 'new_procurement' && (!supplierNameValue || supplierNameValue.trim().length === 0)) {
      return errorResponse('Supplier name is required for new procurement entries', 400);
    }

    // Calculate total cost
    const totalCost = calculateTotalCost(qty, finalUnitCost);

    // Check capital availability (warning only, don't block material creation)
    // Optional: Block material creation if no capital (configurable)
    let capitalWarning = null;
    try {
      const materialAmount = totalCost || 0;
      
      if (materialAmount > 0) {
        const capitalCheck = await validateCapitalAvailability(
          projectId.toString(),
          materialAmount
        );
        
        if (!capitalCheck.isValid) {
          capitalWarning = {
            message: `Insufficient capital. Available: ${capitalCheck.available.toLocaleString()}, Required: ${materialAmount.toLocaleString()}, Shortfall: ${(materialAmount - capitalCheck.available).toLocaleString()}`,
            available: capitalCheck.available,
            required: materialAmount,
            shortfall: materialAmount - capitalCheck.available,
          };
          
          // Optional: Block material creation if no capital (configurable)
          if (process.env.BLOCK_MATERIAL_CREATION_NO_CAPITAL === 'true') {
            if (capitalWarning.available === 0) {
              return errorResponse(
                'Cannot create material: Project has no capital allocated. Please allocate capital first.',
                400
              );
            }
          }
        }
      }
    } catch (capitalError) {
      // Don't fail material creation if capital check fails
      console.error('Capital check error during material creation:', capitalError);
    }

    const userRole = normalizeUserRole(userProfile.role);
    const canAutoReceiveRetroactive =
      materialEntryType === 'retroactive_entry' &&
      (isRole(userRole, 'owner') || isRole(userRole, 'pm') || isRole(userRole, 'project_manager'));

    const retroactiveDeliveryDate = originalPurchaseDate
      ? new Date(originalPurchaseDate)
      : (datePurchased ? new Date(datePurchased) : new Date());

    const materialStatus = materialEntryType === 'retroactive_entry'
      ? (canAutoReceiveRetroactive ? 'received' : 'submitted')
      : 'draft';

    const approvalChain = canAutoReceiveRetroactive ? [{
      approverId: new ObjectId(userProfile._id),
      approverName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      status: 'approved',
      notes: 'Auto-approved for retroactive entry',
      approvedAt: new Date(),
    }] : [];

    // Build material document (using standard field names only)
    const material = {
      projectId: new ObjectId(projectId),
      name: itemName.trim(), // Standard field name
      description: description?.trim() || '',
      category: category || 'other', // Keep for queries, categoryId is primary
      ...(categoryId && ObjectId.isValid(categoryId) && { categoryId: new ObjectId(categoryId) }),
      ...(floor && ObjectId.isValid(floor) && { floor: new ObjectId(floor) }),
      ...(phaseId && ObjectId.isValid(phaseId) && { phaseId: new ObjectId(phaseId) }),
      quantityPurchased: parseFloat(qty), // Standard field name
      quantityDelivered: materialEntryType === 'retroactive_entry' ? parseFloat(qty) : 0,
      quantityUsed: 0,
      quantityRemaining: parseFloat(qty), // Initially same as purchased
      wastage: 0,
      unit: unit || 'piece',
      unitCost: parseFloat(finalUnitCost),
      totalCost, // Standard field name
      supplierName: supplierNameValue.trim(), // Standard field name
      paymentMethod: paymentMethod || 'CASH',
      invoiceNumber: invoiceNumber?.trim() || '',
      invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
      datePurchased: datePurchased ? new Date(datePurchased) : new Date(),
      dateDelivered: materialEntryType === 'retroactive_entry' ? retroactiveDeliveryDate : null,
      dateUsed: null,
      receiptFileUrl: receiptFileUrl || receiptUrl || null, // Standard field name (backward compatible for reading)
      invoiceFileUrl: invoiceFileUrl || null,
      deliveryNoteFileUrl: deliveryNoteFileUrl || null,
      receiptUploadedAt: (receiptFileUrl || receiptUrl) ? new Date() : null,
      status: materialStatus,
      submittedBy: {
        userId: new ObjectId(userProfile._id),
        name: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
        email: userProfile.email,
      },
      enteredBy: new ObjectId(userProfile._id),
      receivedBy: canAutoReceiveRetroactive ? new ObjectId(userProfile._id) : null,
      approvedBy: canAutoReceiveRetroactive ? new ObjectId(userProfile._id) : null,
      verifiedBy: null,
      approvalChain: approvalChain,
      notes: notes?.trim() || '',
      approvalNotes: canAutoReceiveRetroactive ? 'Auto-approved for retroactive entry' : '',
      // Finishing details (Module 3) - optional field for finishing stage materials
      ...(finishingDetails && { finishingDetails }),
      ...(libraryMaterialId && ObjectId.isValid(libraryMaterialId) && { libraryMaterialId: new ObjectId(libraryMaterialId) }),
      // Dual Workflow fields
      entryType: materialEntryType,
      isRetroactiveEntry: materialEntryType === 'retroactive_entry',
      materialRequestId: materialRequestId && ObjectId.isValid(materialRequestId) ? new ObjectId(materialRequestId) : null,
      purchaseOrderId: purchaseOrderId && ObjectId.isValid(purchaseOrderId) ? new ObjectId(purchaseOrderId) : null,
      orderFulfillmentDate: orderFulfillmentDate ? new Date(orderFulfillmentDate) : null,
      retroactiveNotes: retroactiveNotes?.trim() || null,
      originalPurchaseDate: originalPurchaseDate ? new Date(originalPurchaseDate) : null,
      documentationStatus: documentationStatus || body.documentationStatus || null,
      costStatus: resolvedCostStatus || body.costStatus || 'actual',
      costVerified: costVerified || false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Insert material
    const result = await db.collection('materials').insertOne(material);

    const insertedMaterial = { ...material, _id: result.insertedId };

    // Increment library usage if material was selected from library (non-critical)
    if (libraryMaterialId && ObjectId.isValid(libraryMaterialId)) {
      try {
        await incrementLibraryUsage(libraryMaterialId, userProfile._id.toString());
      } catch (libraryError) {
        console.error('Library usage increment failed:', libraryError);
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'MATERIAL',
      entityId: result.insertedId.toString(),
      projectId: projectId,
      changes: { created: insertedMaterial },
    });

    // Recalculate phase spending if phaseId is provided
    if (phaseId && ObjectId.isValid(phaseId)) {
      try {
        await recalculatePhaseSpending(phaseId);
      } catch (phaseError) {
        console.error('Error recalculating phase spending after material creation:', phaseError);
        // Don't fail the request, just log the error
      }
    }

    // Recalculate floor spending if floorId is provided
    const floorId = insertedMaterial.floor;
    if (floorId && ObjectId.isValid(floorId)) {
      try {
        await recalculateFloorSpending(floorId.toString());
      } catch (floorError) {
        console.error('Error recalculating floor spending after material creation:', floorError);
        // Don't fail the request, just log the error
      }
    }

    // Include capital warning in response if present
    const responseData = { ...insertedMaterial };
    if (capitalWarning) {
      responseData.capitalWarning = capitalWarning;
    }

    return successResponse(responseData, 'Material created successfully', 201);
  } catch (error) {
    console.error('Create material error:', error);
    return errorResponse('Failed to create material', 500);
  }
}

