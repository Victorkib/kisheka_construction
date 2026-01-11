/**
 * Alternative Suppliers API Route
 * GET /api/purchase-orders/[id]/alternatives
 * POST /api/purchase-orders/[id]/send-alternatives
 * 
 * Find and send orders to alternative suppliers when original supplier rejects
 * Auth: PM, OWNER
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotifications } from '@/lib/notifications';
import { sendPurchaseOrderEmail } from '@/lib/email-templates/purchase-order-templates';
import { sendSMS, generatePurchaseOrderSMS, generateAlternativeOrderSMS, formatPhoneNumber } from '@/lib/sms-service';
import { sendPushToSupplier } from '@/lib/push-service';
import { generateShortUrl } from '@/lib/generators/url-shortener';
import { 
  findSimpleAlternativeSuppliers,
  calculateSupplierDataQuality,
  selectRecommendedMode,
  findAlternativeSuppliers, 
  getSmartSupplierSuggestions 
} from '@/lib/supplier-finding';
import { createPOFromSupplierGroup } from '@/lib/helpers/bulk-po-helpers';
import { generatePurchaseOrderNumber } from '@/lib/generators/purchase-order-number-generator';
import { generateResponseToken, getTokenExpirationDate } from '@/lib/generators/response-token-generator';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/purchase-orders/[id]/alternatives
 * Find alternative suppliers for a rejected purchase order
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
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

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid order ID', 400);
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'simple'; // Default to simple mode
    const searchQuery = searchParams.get('search') || null;
    let limit = parseInt(searchParams.get('limit')) || (mode === 'simple' ? 50 : 10);
    const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')) : null;
    const requiredBy = searchParams.get('requiredBy') ? new Date(searchParams.get('requiredBy')) : null;

    // Validate mode parameter
    if (!['simple', 'hybrid', 'smart'].includes(mode)) {
      return errorResponse('Invalid mode parameter. Must be "simple", "hybrid", or "smart"', 400);
    }

    // Validate and sanitize limit
    if (isNaN(limit) || limit < 1) {
      limit = mode === 'simple' ? 50 : 10;
    }
    if (limit > 100) {
      limit = 100; // Cap at 100 for performance
    }

    // Validate and sanitize search query
    let sanitizedSearchQuery = null;
    if (searchQuery) {
      const trimmed = searchQuery.trim();
      if (trimmed.length > 0 && trimmed.length <= 100) {
        sanitizedSearchQuery = trimmed;
      } else if (trimmed.length > 100) {
        return errorResponse('Search query too long. Maximum 100 characters.', 400);
      }
    }

    // Validate maxPrice if provided
    if (maxPrice !== null && (isNaN(maxPrice) || maxPrice < 0)) {
      return errorResponse('Invalid maxPrice parameter. Must be a positive number.', 400);
    }

    // Validate requiredBy date if provided
    if (requiredBy && (isNaN(requiredBy.getTime()) || requiredBy < new Date())) {
      return errorResponse('Invalid requiredBy date. Must be a valid future date.', 400);
    }

    const db = await getDatabase();

    // Get existing order
    const purchaseOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!purchaseOrder) {
      return errorResponse('Purchase order not found', 404);
    }

    // Only allow finding alternatives for rejected or partially responded orders
    const isRejected = purchaseOrder.status === 'order_rejected';
    const isPartiallyResponded = purchaseOrder.status === 'order_partially_responded';
    
    if (!isRejected && !isPartiallyResponded) {
      return errorResponse(`Cannot find alternatives for order with status: ${purchaseOrder.status}. Only rejected or partially responded orders can have alternatives.`, 400);
    }

    // Detect bulk order
    const isBulkOrder = purchaseOrder.isBulkOrder === true || purchaseOrder.supportsPartialResponse === true;
    
    // Get rejected materials for bulk orders
    let rejectedMaterials = [];
    if (isBulkOrder && purchaseOrder.materials && Array.isArray(purchaseOrder.materials)) {
      // Check materialResponses to find rejected materials
      if (purchaseOrder.materialResponses && Array.isArray(purchaseOrder.materialResponses)) {
        const rejectedMaterialIds = purchaseOrder.materialResponses
          .filter(mr => mr.action === 'reject')
          .map(mr => mr.materialRequestId?.toString());
        
        rejectedMaterials = purchaseOrder.materials.filter(m => {
          const materialRequestId = m.materialRequestId?.toString() || m._id?.toString();
          return rejectedMaterialIds.includes(materialRequestId);
        });
      } else if (isRejected) {
        // If full rejection and no materialResponses, all materials are rejected
        rejectedMaterials = purchaseOrder.materials;
      }
    }

    // Get material request(s) for context (needed for data quality calculation)
    let materialRequest = null;
    if (isBulkOrder && rejectedMaterials.length > 0) {
      // For bulk orders, use first rejected material for data quality calculation
      const firstRejectedMaterial = rejectedMaterials[0];
      const materialRequestId = firstRejectedMaterial.materialRequestId || firstRejectedMaterial._id;
      if (materialRequestId) {
        materialRequest = await db.collection('material_requests').findOne({
          _id: new ObjectId(materialRequestId),
        });
      }
    } else if (purchaseOrder.materialRequestId) {
      // Single order
      materialRequest = await db.collection('material_requests').findOne({
        _id: purchaseOrder.materialRequestId,
      });
    }

    let alternatives = [];
    let dataQuality = { total: 0, recommendedMode: 'simple', factors: {} };
    let message = '';
    let simpleList = []; // Declare at function scope for hybrid mode reuse

    if (mode === 'simple') {
      // Simple mode: Just return all active suppliers (excluding current)
      alternatives = await findSimpleAlternativeSuppliers({
        currentSupplierId: purchaseOrder.supplierId.toString(),
        limit,
        searchQuery: sanitizedSearchQuery
      });

      // Calculate data quality for first supplier as sample (if available)
      if (alternatives.length > 0 && materialRequest) {
        try {
          dataQuality = await calculateSupplierDataQuality(
            alternatives[0],
            materialRequest,
            db
          );
        } catch (error) {
          console.error('Error calculating data quality:', error);
          // Continue with defaults
        }
      }

      message = `Found ${alternatives.length} active supplier${alternatives.length !== 1 ? 's' : ''}`;
      if (sanitizedSearchQuery) {
        message += ` matching "${sanitizedSearchQuery}"`;
      }
    } else if (mode === 'hybrid' || mode === 'smart') {
      // Hybrid/Smart mode: Use algorithm if data available
      let smartSuggestions = [];
      let hasSmartSuggestions = false;

      // Always get simple list for hybrid mode
      simpleList = await findSimpleAlternativeSuppliers({
        currentSupplierId: purchaseOrder.supplierId.toString(),
        limit: 100 // Get more for algorithm processing
      });

      // Apply search filter to simple list if provided
      if (sanitizedSearchQuery && simpleList.length > 0) {
        const queryLower = sanitizedSearchQuery.toLowerCase();
        simpleList = simpleList.filter(supplier => 
          supplier.name?.toLowerCase().includes(queryLower) ||
          supplier.email?.toLowerCase().includes(queryLower) ||
          supplier.phone?.includes(sanitizedSearchQuery) ||
          supplier.contactPerson?.toLowerCase().includes(queryLower)
        );
      }

      // Calculate data quality for first supplier as sample
      if (simpleList.length > 0 && materialRequest) {
        try {
          dataQuality = await calculateSupplierDataQuality(
            simpleList[0],
            materialRequest,
            db
          );
        } catch (error) {
          console.error('Error calculating data quality:', error);
        }
      }

      // If data quality is sufficient, try to get smart suggestions
      if (dataQuality.total >= 30) {
        try {
          const rawAlternatives = await findAlternativeSuppliers({
            materialRequestId: purchaseOrder.materialRequestId,
            currentSupplierId: purchaseOrder.supplierId,
            rejectionReason: purchaseOrder.rejectionReason,
            quantity: purchaseOrder.quantityOrdered,
            maxPrice,
            requiredBy,
            limit: mode === 'smart' ? limit : Math.min(limit * 2, 20) // Get more for hybrid
          });

          smartSuggestions = await getSmartSupplierSuggestions({
            suppliers: rawAlternatives,
            materialRequest: {
              materialName: purchaseOrder.materialName,
              _id: purchaseOrder.materialRequestId
            },
            projectId: purchaseOrder.projectId,
            rejectionReason: purchaseOrder.rejectionReason,
            db
          });

          // Apply search filter to smart suggestions if provided
          if (sanitizedSearchQuery && smartSuggestions.length > 0) {
            const queryLower = sanitizedSearchQuery.toLowerCase();
            smartSuggestions = smartSuggestions.filter(supplier => 
              supplier.name?.toLowerCase().includes(queryLower) ||
              supplier.email?.toLowerCase().includes(queryLower) ||
              supplier.phone?.includes(sanitizedSearchQuery) ||
              supplier.contactPerson?.toLowerCase().includes(queryLower)
            );
          }

          hasSmartSuggestions = smartSuggestions.length > 0;
        } catch (error) {
          console.error('Error using algorithm, will use simple list only:', error);
          // Continue with simple list only
        }
      }

      // For hybrid mode, return both lists; for smart mode, prefer smart suggestions
      if (mode === 'hybrid') {
        // Hybrid mode: return both lists
        if (hasSmartSuggestions) {
          alternatives = smartSuggestions.slice(0, limit);
          message = `Found ${smartSuggestions.length} recommended supplier${smartSuggestions.length !== 1 ? 's' : ''} and ${simpleList.length} total supplier${simpleList.length !== 1 ? 's' : ''}`;
        } else {
          alternatives = simpleList.slice(0, limit);
          message = `Found ${alternatives.length} supplier${alternatives.length !== 1 ? 's' : ''} (not enough data for recommendations)`;
        }
      } else {
        // Smart mode: prefer smart suggestions, fallback to simple
        if (hasSmartSuggestions) {
          alternatives = smartSuggestions.slice(0, limit);
          message = `Found ${alternatives.length} recommended supplier${alternatives.length !== 1 ? 's' : ''}`;
        } else {
          alternatives = simpleList.slice(0, limit);
          message = `Found ${alternatives.length} supplier${alternatives.length !== 1 ? 's' : ''} (using simple mode - not enough data for smart suggestions)`;
        }
      }
    }

    // Ensure alternatives is always an array
    if (!Array.isArray(alternatives)) {
      console.error('Alternatives is not an array:', alternatives);
      alternatives = [];
    }

    // Format response consistently - filter out invalid suppliers first
    const validAlternatives = alternatives.filter(supplier => 
      supplier && (supplier._id || supplier.id) && supplier.name
    );

    const formattedAlternatives = validAlternatives.map(supplier => {
      const base = {
        id: supplier._id || supplier.id,
        name: supplier.name || 'Unknown Supplier',
        email: supplier.email || null,
        phone: supplier.phone || null,
        communicationChannels: supplier.communicationChannels || {
          email: supplier.emailEnabled !== false,
          sms: supplier.smsEnabled !== false,
          push: supplier.pushNotificationsEnabled !== false
        }
      };

      // Add algorithm-specific fields if available
      if (mode !== 'simple' && supplier.priority !== undefined) {
        base.priority = supplier.priority;
        base.recommendationReasons = supplier.recommendationReasons || [];
        base.estimatedPrice = supplier.estimatedPrice || null;
        base.estimatedDelivery = supplier.estimatedDelivery || null;
        base.score = supplier.score || null;
      }

      // Add simple mode fields
      if (mode === 'simple') {
        base.contactPerson = supplier.contactPerson || null;
        base.specialties = supplier.specialties || [];
        base.rating = supplier.rating || null;
      }

      return base;
    });

    // Final validation - ensure we have valid data
    const finalAlternatives = formattedAlternatives.filter(alt => alt && alt.id && alt.name);
    
    // For hybrid mode, also format and return simple list
    let formattedSimpleList = [];
    if (mode === 'hybrid' || mode === 'smart') {
      // Get simple list if we have it (for hybrid mode display)
      try {
        const simpleListForResponse = await findSimpleAlternativeSuppliers({
          currentSupplierId: purchaseOrder.supplierId.toString(),
          limit: 100,
          searchQuery: sanitizedSearchQuery
        });
        
        formattedSimpleList = simpleListForResponse
          .filter(supplier => supplier && supplier.id && supplier.name)
          .map(supplier => ({
            id: supplier.id || supplier._id,
            name: supplier.name || 'Unknown Supplier',
            email: supplier.email || null,
            phone: supplier.phone || null,
            contactPerson: supplier.contactPerson || null,
            communicationChannels: supplier.communicationChannels || {
              email: supplier.emailEnabled !== false,
              sms: supplier.smsEnabled !== false,
              push: supplier.pushNotificationsEnabled !== false
            },
            specialties: supplier.specialties || [],
            rating: supplier.rating || null
          }))
          .slice(0, 100); // Limit for response size
      } catch (error) {
        console.error('Error getting simple list for hybrid mode:', error);
      }
    }
    
    // Format rejected materials for response
    const formattedRejectedMaterials = rejectedMaterials.map(m => ({
      materialRequestId: (m.materialRequestId || m._id)?.toString(),
      materialName: m.materialName || m.name || 'Unknown Material',
      quantity: m.quantity || m.quantityOrdered || 0,
      unit: m.unit || '',
      unitCost: m.unitCost || 0,
      totalCost: m.totalCost || (m.quantity || 0) * (m.unitCost || 0),
      description: m.description || '',
      rejectionReason: purchaseOrder.materialResponses?.find(
        mr => (mr.materialRequestId?.toString() || '') === ((m.materialRequestId || m._id)?.toString() || '')
      )?.rejectionReason || purchaseOrder.rejectionReason,
      rejectionSubcategory: purchaseOrder.materialResponses?.find(
        mr => (mr.materialRequestId?.toString() || '') === ((m.materialRequestId || m._id)?.toString() || '')
      )?.rejectionSubcategory || purchaseOrder.rejectionSubcategory,
    }));

    return successResponse({
      mode,
      dataQuality: dataQuality.total || 0,
      recommendedMode: dataQuality.recommendedMode || selectRecommendedMode(dataQuality.total || 0),
      isBulkOrder,
      originalOrder: {
        id: purchaseOrder._id,
        purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
        materialName: purchaseOrder.materialName,
        quantityOrdered: purchaseOrder.quantityOrdered,
        unitCost: purchaseOrder.unitCost,
        totalCost: purchaseOrder.totalCost,
        currentSupplier: purchaseOrder.supplierName,
        rejectionReason: purchaseOrder.rejectionReason,
        rejectionSubcategory: purchaseOrder.rejectionSubcategory,
        supplierNotes: purchaseOrder.supplierNotes,
        status: purchaseOrder.status,
      },
      // Include rejected materials for bulk orders
      ...(isBulkOrder && formattedRejectedMaterials.length > 0 ? {
        rejectedMaterials: formattedRejectedMaterials,
        totalRejectedMaterials: formattedRejectedMaterials.length,
      } : {}),
      alternatives: finalAlternatives,
      // Include simple list for hybrid mode
      ...(mode === 'hybrid' && formattedSimpleList.length > 0 ? { simpleList: formattedSimpleList } : {}),
      searchCriteria: {
        materialRequestId: purchaseOrder.materialRequestId,
        quantity: purchaseOrder.quantityOrdered,
        maxPrice,
        requiredBy,
        limit,
        searchQuery: sanitizedSearchQuery
      }
    }, finalAlternatives.length > 0 ? message : 'No suppliers found matching criteria');

  } catch (error) {
    console.error('Find alternative suppliers error:', error);
    return errorResponse('Failed to find alternative suppliers', 500);
  }
}

/**
 * POST /api/purchase-orders/[id]/send-alternatives
 * Send purchase order to selected alternative suppliers
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canCreate = await hasPermission(user.id, 'create_purchase_order');
    if (!canCreate) {
      return errorResponse('Insufficient permissions to create purchase orders', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid order ID', 400);
    }

    const body = await request.json();
    const { 
      selectedSuppliers, // For single orders (backward compatible)
      materialAssignments, // For bulk orders: [{ materialRequestId, suppliers: [{ supplierId, quantity?, adjustments }] }]
      adjustments = {}, // For single orders (backward compatible)
      notes = '',
      communicationChannels = ['email'],
      sendImmediately = true 
    } = body || {};

    // Validate communication channels
    const validChannels = ['email', 'sms', 'push'];
    const invalidChannels = communicationChannels.filter(channel => !validChannels.includes(channel));
    if (invalidChannels.length > 0) {
      return errorResponse(`Invalid communication channels: ${invalidChannels.join(', ')}`, 400);
    }

    const db = await getDatabase();

    // Get existing order
    const purchaseOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!purchaseOrder) {
      return errorResponse('Purchase order not found', 404);
    }

    // Only allow sending alternatives for rejected or partially responded orders
    const isRejected = purchaseOrder.status === 'order_rejected';
    const isPartiallyResponded = purchaseOrder.status === 'order_partially_responded';
    
    if (!isRejected && !isPartiallyResponded) {
      return errorResponse(`Cannot send alternatives for order with status: ${purchaseOrder.status}. Only rejected or partially responded orders can have alternatives.`, 400);
    }

    // Detect if this is a bulk order
    const isBulkOrder = purchaseOrder.isBulkOrder === true || purchaseOrder.supportsPartialResponse === true;

    // Validate based on order type
    if (isBulkOrder) {
      // Bulk order: require materialAssignments
      if (!materialAssignments || !Array.isArray(materialAssignments) || materialAssignments.length === 0) {
        return errorResponse('Material assignments are required for bulk orders', 400);
      }

      // Validate material assignments
      for (const assignment of materialAssignments) {
        if (!assignment.materialRequestId || !ObjectId.isValid(assignment.materialRequestId)) {
          return errorResponse('Invalid materialRequestId in assignment', 400);
        }
        if (!assignment.suppliers || !Array.isArray(assignment.suppliers) || assignment.suppliers.length === 0) {
          return errorResponse(`At least one supplier must be assigned for material ${assignment.materialRequestId}`, 400);
        }
        for (const supplierAssignment of assignment.suppliers) {
          if (!supplierAssignment.supplierId || !ObjectId.isValid(supplierAssignment.supplierId)) {
            return errorResponse(`Invalid supplierId in assignment for material ${assignment.materialRequestId}`, 400);
          }
        }
      }
    } else {
      // Single order: require selectedSuppliers (backward compatible)
      if (!selectedSuppliers || !Array.isArray(selectedSuppliers) || selectedSuppliers.length === 0) {
        return errorResponse('At least one supplier must be selected', 400);
      }

      if (selectedSuppliers.length > 5) {
        return errorResponse('Cannot send to more than 5 suppliers at once', 400);
      }

      // Validate supplier IDs
      for (const supplierId of selectedSuppliers) {
        if (!ObjectId.isValid(supplierId)) {
          return errorResponse(`Invalid supplier ID: ${supplierId}`, 400);
        }
      }
    }

    // Handle single vs bulk orders
    const createdOrders = [];
    const communicationResults = [];
    let materialRequest = null; // For single orders

    if (isBulkOrder) {
      // BULK ORDER HANDLING
      // Get rejected materials from the order
      let rejectedMaterials = [];
      if (purchaseOrder.materials && Array.isArray(purchaseOrder.materials)) {
        if (purchaseOrder.materialResponses && Array.isArray(purchaseOrder.materialResponses)) {
          const rejectedMaterialIds = purchaseOrder.materialResponses
            .filter(mr => mr.action === 'reject')
            .map(mr => mr.materialRequestId?.toString());
          
          rejectedMaterials = purchaseOrder.materials.filter(m => {
            const materialRequestId = (m.materialRequestId || m._id)?.toString();
            return rejectedMaterialIds.includes(materialRequestId);
          });
        } else if (isRejected) {
          // Full rejection - all materials are rejected
          rejectedMaterials = purchaseOrder.materials;
        }
      }

      if (rejectedMaterials.length === 0) {
        return errorResponse('No rejected materials found in this bulk order', 400);
      }

      // Get all unique supplier IDs from assignments
      const allSupplierIds = new Set();
      materialAssignments.forEach(assignment => {
        assignment.suppliers.forEach(s => allSupplierIds.add(s.supplierId));
      });

      // Get all suppliers
      const suppliers = await db.collection('suppliers').find({
        _id: { $in: Array.from(allSupplierIds).map(id => new ObjectId(id)) },
        status: 'active'
      }).toArray();

      if (suppliers.length === 0) {
        return errorResponse('No active suppliers found with the provided IDs', 404);
      }

      if (suppliers.length !== allSupplierIds.size) {
        return errorResponse('Some suppliers were not found or are not active', 404);
      }

      // Get material requests for rejected materials
      const materialRequestIds = rejectedMaterials.map(m => new ObjectId(m.materialRequestId || m._id));
      const materialRequests = await db.collection('material_requests').find({
        _id: { $in: materialRequestIds }
      }).toArray();

      if (materialRequests.length !== materialRequestIds.length) {
        return errorResponse('Some material requests were not found', 404);
      }

      // Create a map of materialRequestId -> material request for quick lookup
      const materialRequestMap = new Map();
      materialRequests.forEach(mr => {
        materialRequestMap.set(mr._id.toString(), mr);
      });

      // Group material assignments by supplier
      const supplierGroups = new Map(); // supplierId -> { supplier, materials: [{ materialRequest, quantity?, adjustments }] }

      for (const assignment of materialAssignments) {
        const materialRequestId = assignment.materialRequestId.toString();
        const materialRequest = materialRequestMap.get(materialRequestId);
        
        if (!materialRequest) {
          continue; // Skip if material request not found
        }

        // Find the material data from rejected materials
        const materialData = rejectedMaterials.find(m => 
          (m.materialRequestId || m._id)?.toString() === materialRequestId
        );

        if (!materialData) {
          continue; // Skip if material not in rejected list
        }

        // Process each supplier assignment for this material
        for (const supplierAssignment of assignment.suppliers) {
          const supplierId = supplierAssignment.supplierId.toString();
          const supplier = suppliers.find(s => s._id.toString() === supplierId);
          
          if (!supplier) {
            continue; // Skip if supplier not found
          }

          if (!supplierGroups.has(supplierId)) {
            supplierGroups.set(supplierId, {
              supplier,
              materials: []
            });
          }

          const group = supplierGroups.get(supplierId);
          
          // Calculate quantity (use split quantity if provided, otherwise use full quantity)
          const quantity = supplierAssignment.quantity !== undefined && supplierAssignment.quantity !== null
            ? parseFloat(supplierAssignment.quantity)
            : (materialData.quantity || materialData.quantityOrdered || materialRequest.quantityNeeded);

          // Apply adjustments
          const materialAdjustments = supplierAssignment.adjustments || {};
          const unitCost = materialAdjustments.unitCost !== undefined 
            ? parseFloat(materialAdjustments.unitCost) 
            : (materialData.unitCost || materialRequest.estimatedUnitCost || 0);
          
          const deliveryDate = materialAdjustments.deliveryDate 
            ? new Date(materialAdjustments.deliveryDate)
            : (purchaseOrder.deliveryDate ? new Date(purchaseOrder.deliveryDate) : new Date());

          // Validate
          if (unitCost < 0) {
            return errorResponse(`Unit cost cannot be negative for material ${materialRequest.materialName}`, 400);
          }
          if (quantity <= 0) {
            return errorResponse(`Quantity must be greater than 0 for material ${materialRequest.materialName}`, 400);
          }
          if (deliveryDate <= new Date()) {
            return errorResponse(`Delivery date must be in the future for material ${materialRequest.materialName}`, 400);
          }

          group.materials.push({
            materialRequest,
            materialRequestId: materialRequest._id,
            materialName: materialRequest.materialName,
            quantity,
            unit: materialRequest.unit,
            unitCost,
            totalCost: quantity * unitCost,
            deliveryDate,
            terms: materialAdjustments.terms || purchaseOrder.terms || '',
            notes: materialAdjustments.notes || notes || '',
            description: materialRequest.description || '',
          });
        }
      }

      // Create POs for each supplier group
      // If a supplier has multiple materials, create a bulk PO
      // If a supplier has one material, create a single PO
      for (const [supplierId, group] of supplierGroups.entries()) {
        try {
          if (group.materials.length === 0) {
            continue; // Skip empty groups
          }

          if (group.materials.length === 1) {
            // Single material PO
            const material = group.materials[0];
            const purchaseOrderNumber = await generatePurchaseOrderNumber({ db });
            const responseToken = generateShortUrl(`${group.supplier._id}-${Date.now()}`);
            const responseTokenExpiresAt = getTokenExpirationDate(
              parseInt(process.env.PO_RESPONSE_TOKEN_EXPIRY_DAYS || '7', 10)
            );

            const newOrderData = {
              purchaseOrderNumber,
              materialRequestId: material.materialRequestId,
              supplierId: group.supplier._id,
              supplierName: group.supplier.name,
              supplierEmail: group.supplier.email,
              projectId: purchaseOrder.projectId,
              floorId: purchaseOrder.floorId,
              categoryId: purchaseOrder.categoryId,
              category: purchaseOrder.category,
              materialName: material.materialName,
              description: material.description,
              quantityOrdered: material.quantity,
              unit: material.unit,
              unitCost: material.unitCost,
              totalCost: material.totalCost,
              deliveryDate: material.deliveryDate,
              terms: material.terms,
              notes: material.notes,
              status: 'order_sent',
              sentAt: new Date(),
              responseToken,
              responseTokenExpiresAt,
              createdBy: userProfile._id,
              createdByName: userProfile.name || userProfile.email,
              financialStatus: 'not_committed',
              createdAt: new Date(),
              updatedAt: new Date(),
              originalOrderId: purchaseOrder._id,
              originalOrderNumber: purchaseOrder.purchaseOrderNumber,
              originalRejectionReason: purchaseOrder.rejectionReason,
              originalRejectionSubcategory: purchaseOrder.rejectionSubcategory,
              isAlternativeOrder: true,
            };

            const result = await db.collection('purchase_orders').insertOne(newOrderData);
            const newOrder = { ...newOrderData, _id: result.insertedId };
            createdOrders.push(newOrder);

            // Send communications (will be handled below)
          } else {
            // Bulk PO - multiple materials to same supplier
            // Use createPOFromSupplierGroup helper
            // But we need to adapt it for alternative orders (no batch)
            // For now, create individual POs for each material in bulk scenario
            // TODO: Consider creating actual bulk PO if needed
            
            // Create individual POs for each material (simpler for now)
            for (const material of group.materials) {
              const purchaseOrderNumber = await generatePurchaseOrderNumber({ db });
              const responseToken = generateShortUrl(`${group.supplier._id}-${Date.now()}-${material.materialRequestId}`);
              const responseTokenExpiresAt = getTokenExpirationDate(
                parseInt(process.env.PO_RESPONSE_TOKEN_EXPIRY_DAYS || '7', 10)
              );

              const newOrderData = {
                purchaseOrderNumber,
                materialRequestId: material.materialRequestId,
                supplierId: group.supplier._id,
                supplierName: group.supplier.name,
                supplierEmail: group.supplier.email,
                projectId: purchaseOrder.projectId,
                floorId: purchaseOrder.floorId,
                categoryId: purchaseOrder.categoryId,
                category: purchaseOrder.category,
                materialName: material.materialName,
                description: material.description,
                quantityOrdered: material.quantity,
                unit: material.unit,
                unitCost: material.unitCost,
                totalCost: material.totalCost,
                deliveryDate: material.deliveryDate,
                terms: material.terms,
                notes: material.notes,
                status: 'order_sent',
                sentAt: new Date(),
                responseToken,
                responseTokenExpiresAt,
                createdBy: userProfile._id,
                createdByName: userProfile.name || userProfile.email,
                financialStatus: 'not_committed',
                createdAt: new Date(),
                updatedAt: new Date(),
                originalOrderId: purchaseOrder._id,
                originalOrderNumber: purchaseOrder.purchaseOrderNumber,
                originalRejectionReason: purchaseOrder.rejectionReason,
                originalRejectionSubcategory: purchaseOrder.rejectionSubcategory,
                isAlternativeOrder: true,
              };

              const result = await db.collection('purchase_orders').insertOne(newOrderData);
              const newOrder = { ...newOrderData, _id: result.insertedId };
              createdOrders.push(newOrder);
            }
          }
        } catch (error) {
          console.error(`Error creating order(s) for supplier ${group.supplier._id}:`, error);
          // Continue with other suppliers
        }
      }

      // Send communications for bulk orders
      if (sendImmediately && communicationChannels.length > 0 && createdOrders.length > 0) {
        // Get all unique suppliers from created orders
        const supplierIds = [...new Set(createdOrders.map(o => o.supplierId.toString()))];
        const allSuppliers = await db.collection('suppliers').find({
          _id: { $in: supplierIds.map(id => new ObjectId(id)) }
        }).toArray();

        const supplierMap = new Map();
        allSuppliers.forEach(s => supplierMap.set(s._id.toString(), s));

        // Get material requests for communication
        const materialRequestIds = createdOrders.map(o => o.materialRequestId);
        const materialRequests = await db.collection('material_requests').find({
          _id: { $in: materialRequestIds.map(id => new ObjectId(id)) }
        }).toArray();

        const materialRequestMap = new Map();
        materialRequests.forEach(mr => materialRequestMap.set(mr._id.toString(), mr));

        // Send communications for each created order
        for (const newOrder of createdOrders) {
          const supplier = supplierMap.get(newOrder.supplierId.toString());
          const materialRequest = materialRequestMap.get(newOrder.materialRequestId.toString());
          
          if (!supplier || !materialRequest) {
            continue; // Skip if supplier or material request not found
          }

          const responseUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/purchase-orders/respond/${newOrder.responseToken}`;
          const shortLink = generateShortUrl(newOrder.responseToken);

          const supplierCommunicationResults = [];

          for (const channel of communicationChannels) {
            try {
              let result = { channel, success: false, error: null };

              if (channel === 'email') {
                if (!supplier.emailEnabled || !supplier.email) {
                  result.error = 'Email not enabled or no email address';
                } else {
                  const emailResult = await sendPurchaseOrderEmail({
                    supplier,
                    purchaseOrder: newOrder,
                    responseToken: newOrder.responseToken,
                    isAlternative: true,
                    originalOrderNumber: purchaseOrder.purchaseOrderNumber,
                  });
                  result.success = true;
                  result.messageId = emailResult.messageId;
                }
              } else if (channel === 'sms') {
                if (!supplier.smsEnabled || !supplier.phone) {
                  result.error = 'SMS not enabled or no phone number';
                } else {
                  const formattedPhone = formatPhoneNumber(supplier.phone);
                  
                  // Use alternative order SMS with context
                  const smsMessage = generateAlternativeOrderSMS({
                    purchaseOrderNumber: newOrder.purchaseOrderNumber,
                    originalPONumber: purchaseOrder.purchaseOrderNumber,
                    originalRejectionReason: purchaseOrder.rejectionReason || purchaseOrder.rejectionSubcategory || 'Not specified',
                    alternativeType: null, // Can be enhanced to detect type based on differences
                    supplier: supplier // Pass supplier for language detection
                  });

                  const smsResult = await sendSMS({
                    to: formattedPhone,
                    message: smsMessage,
                  });

                  result.success = smsResult.success;
                  result.messageId = smsResult.messageId;
                  if (!smsResult.success) {
                    result.error = smsResult.error;
                  }
                }
              } else if (channel === 'push') {
                if (!supplier.pushNotificationsEnabled) {
                  result.error = 'Push notifications not enabled';
                } else {
                  const pushActions = [
                    { action: 'accept', title: 'Accept' },
                    { action: 'reject', title: 'Reject' },
                    { action: 'view', title: 'View Details' },
                  ];

                  const pushData = {
                    purchaseOrderId: newOrder._id.toString(),
                    token: newOrder.responseToken,
                    url: responseUrl,
                    isAlternative: true,
                    originalOrderNumber: purchaseOrder.purchaseOrderNumber,
                  };

                  const pushResults = await sendPushToSupplier({
                    supplierId: supplier._id.toString(),
                    title: `New Purchase Order: ${newOrder.purchaseOrderNumber}`,
                    message: `${newOrder.materialName} - ${newOrder.quantityOrdered} ${newOrder.unit} - ${newOrder.totalCost.toLocaleString()} KES`,
                    actions: pushActions,
                    data: pushData,
                  });

                  const successfulPushes = pushResults.filter((r) => r.success);
                  result.success = successfulPushes.length > 0;
                  result.subscriptionCount = successfulPushes.length;
                  result.totalSubscriptions = pushResults.length;
                  if (!result.success) {
                    result.error = 'All push notifications failed';
                  }
                }
              }

              supplierCommunicationResults.push(result);

              // Track communication in order
              await db.collection('purchase_orders').updateOne(
                { _id: newOrder._id },
                {
                  $push: {
                    communications: {
                      channel,
                      sentAt: new Date(),
                      status: result.success ? 'sent' : 'failed',
                      messageId: result.messageId || null,
                      error: result.error || null,
                      isAlternative: true,
                    },
                  },
                }
              );

            } catch (error) {
              supplierCommunicationResults.push({
                channel,
                success: false,
                error: error.message,
              });

              // Track failed communication
              await db.collection('purchase_orders').updateOne(
                { _id: newOrder._id },
                {
                  $push: {
                    communications: {
                      channel,
                      sentAt: new Date(),
                      status: 'failed',
                      error: error.message,
                      isAlternative: true,
                    },
                  },
                }
              );
            }
          }

          communicationResults.push({
            supplierId: supplier._id,
            supplierName: supplier.name,
            orderId: newOrder._id,
            orderNumber: newOrder.purchaseOrderNumber,
            results: supplierCommunicationResults
          });
        }
      }

    } else {
      // SINGLE ORDER HANDLING (existing logic)
      // Get selected suppliers
      const suppliers = await db.collection('suppliers').find({
        _id: { $in: selectedSuppliers.map(id => new ObjectId(id)) },
        status: 'active'
      }).toArray();

      if (suppliers.length === 0) {
        return errorResponse('No active suppliers found with the provided IDs', 404);
      }

      if (suppliers.length !== selectedSuppliers.length) {
        return errorResponse('Some suppliers were not found or are not active', 404);
      }

      // Get material request for details
      materialRequest = await db.collection('material_requests').findOne({
        _id: purchaseOrder.materialRequestId,
      });

      if (!materialRequest) {
        return errorResponse('Material request not found', 404);
      }

      // Apply adjustments to create new order data
      const alternativeOrderData = {
        ...purchaseOrder,
        unitCost: adjustments.unitCost !== undefined ? parseFloat(adjustments.unitCost) : purchaseOrder.unitCost,
        quantityOrdered: adjustments.quantityOrdered !== undefined ? parseFloat(adjustments.quantityOrdered) : purchaseOrder.quantityOrdered,
        deliveryDate: adjustments.deliveryDate ? new Date(adjustments.deliveryDate) : purchaseOrder.deliveryDate,
        terms: adjustments.terms || purchaseOrder.terms,
        notes: adjustments.notes || purchaseOrder.notes,
        totalCost: 0, // Will be recalculated
      };

      // Recalculate total cost
      alternativeOrderData.totalCost = alternativeOrderData.quantityOrdered * alternativeOrderData.unitCost;

      // Validate the alternative order data
      if (alternativeOrderData.unitCost < 0) {
        return errorResponse('Unit cost cannot be negative', 400);
      }
      if (alternativeOrderData.quantityOrdered <= 0) {
        return errorResponse('Quantity must be greater than 0', 400);
      }
      if (new Date(alternativeOrderData.deliveryDate) <= new Date()) {
        return errorResponse('Delivery date must be in the future', 400);
      }

      // Create new purchase orders for each selected supplier
      for (const supplier of suppliers) {
      try {
        // Generate new PO number
        const purchaseOrderNumber = await generatePurchaseOrderNumber({ db });

        // Generate response token
        const responseToken = generateShortUrl(`${supplier._id}-${Date.now()}`);
        const responseTokenExpiresAt = new Date();
        responseTokenExpiresAt.setDate(responseTokenExpiresAt.getDate() + 7); // 7 days expiry

        // Create new purchase order
        const newOrderData = {
          purchaseOrderNumber,
          materialRequestId: purchaseOrder.materialRequestId,
          supplierId: supplier._id,
          supplierName: supplier.name,
          supplierEmail: supplier.email,
          projectId: purchaseOrder.projectId,
          floorId: purchaseOrder.floorId,
          categoryId: purchaseOrder.categoryId,
          category: purchaseOrder.category,
          materialName: alternativeOrderData.materialName,
          description: alternativeOrderData.description,
          quantityOrdered: alternativeOrderData.quantityOrdered,
          unit: alternativeOrderData.unit,
          unitCost: alternativeOrderData.unitCost,
          totalCost: alternativeOrderData.totalCost,
          deliveryDate: alternativeOrderData.deliveryDate,
          terms: alternativeOrderData.terms,
          notes: alternativeOrderData.notes,
          status: 'order_sent',
          sentAt: new Date(),
          responseToken,
          responseTokenExpiresAt,
          createdBy: userProfile._id,
          createdByName: userProfile.name || userProfile.email,
          financialStatus: 'not_committed',
          createdAt: new Date(),
          updatedAt: new Date(),
          // Link to original rejected order
          originalOrderId: purchaseOrder._id,
          originalOrderNumber: purchaseOrder.purchaseOrderNumber,
          originalRejectionReason: purchaseOrder.rejectionReason,
          originalRejectionSubcategory: purchaseOrder.rejectionSubcategory,
          isAlternativeOrder: true,
        };

        const result = await db.collection('purchase_orders').insertOne(newOrderData);
        const newOrder = { ...newOrderData, _id: result.insertedId };
        createdOrders.push(newOrder);

        // Send communications if requested
        if (sendImmediately && communicationChannels.length > 0) {
          const responseUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/purchase-orders/respond/${responseToken}`;
          const shortLink = generateShortUrl(responseToken);

          const supplierCommunicationResults = [];

          for (const channel of communicationChannels) {
            try {
              let result = { channel, success: false, error: null };

              if (channel === 'email') {
                if (!supplier.emailEnabled || !supplier.email) {
                  result.error = 'Email not enabled or no email address';
                } else {
                  const emailResult = await sendPurchaseOrderEmail({
                    supplier,
                    purchaseOrder: newOrder,
                    responseToken,
                    isAlternative: true,
                    originalOrderNumber: purchaseOrder.purchaseOrderNumber,
                  });
                  result.success = true;
                  result.messageId = emailResult.messageId;
                }
              } else if (channel === 'sms') {
                if (!supplier.smsEnabled || !supplier.phone) {
                  result.error = 'SMS not enabled or no phone number';
                } else {
                  const formattedPhone = formatPhoneNumber(supplier.phone);
                  const smsMessage = await generatePurchaseOrderSMS({
                    purchaseOrderNumber: newOrder.purchaseOrderNumber,
                    materialName: materialRequest.materialName,
                    quantity: alternativeOrderData.quantityOrdered,
                    unit: materialRequest.unit,
                    totalCost: alternativeOrderData.totalCost,
                    shortLink,
                    deliveryDate: alternativeOrderData.deliveryDate,
                    unitCost: alternativeOrderData.unitCost || null,
                    supplier: supplier, // Pass supplier for language detection
                    projectId: newOrder.projectId?.toString() || null,
                    enablePersonalization: true
                  });

                  const smsResult = await sendSMS({
                    to: formattedPhone,
                    message: smsMessage,
                  });

                  result.success = smsResult.success;
                  result.messageId = smsResult.messageId;
                  if (!smsResult.success) {
                    result.error = smsResult.error;
                  }
                }
              } else if (channel === 'push') {
                if (!supplier.pushNotificationsEnabled) {
                  result.error = 'Push notifications not enabled';
                } else {
                  const pushActions = [
                    { action: 'accept', title: 'Accept' },
                    { action: 'reject', title: 'Reject' },
                    { action: 'view', title: 'View Details' },
                  ];

                  const pushData = {
                    purchaseOrderId: newOrder._id.toString(),
                    token: responseToken,
                    url: responseUrl,
                    isAlternative: true,
                    originalOrderNumber: purchaseOrder.purchaseOrderNumber,
                  };

                  const pushResults = await sendPushToSupplier({
                    supplierId: supplier._id.toString(),
                    title: `New Purchase Order: ${newOrder.purchaseOrderNumber}`,
                    message: `${materialRequest.materialName} - ${alternativeOrderData.quantityOrdered} ${materialRequest.unit} - ${alternativeOrderData.totalCost.toLocaleString()} KES`,
                    actions: pushActions,
                    data: pushData,
                  });

                  const successfulPushes = pushResults.filter((r) => r.success);
                  result.success = successfulPushes.length > 0;
                  result.subscriptionCount = successfulPushes.length;
                  result.totalSubscriptions = pushResults.length;
                  if (!result.success) {
                    result.error = 'All push notifications failed';
                  }
                }
              }

              supplierCommunicationResults.push(result);

              // Track communication in order
              await db.collection('purchase_orders').updateOne(
                { _id: newOrder._id },
                {
                  $push: {
                    communications: {
                      channel,
                      sentAt: new Date(),
                      status: result.success ? 'sent' : 'failed',
                      messageId: result.messageId || null,
                      error: result.error || null,
                      isAlternative: true,
                    },
                  },
                }
              );

            } catch (error) {
              supplierCommunicationResults.push({
                channel,
                success: false,
                error: error.message,
              });

              // Track failed communication
              await db.collection('purchase_orders').updateOne(
                { _id: newOrder._id },
                {
                  $push: {
                    communications: {
                      channel,
                      sentAt: new Date(),
                      status: 'failed',
                      error: error.message,
                      isAlternative: true,
                    },
                  },
                }
              );
            }
          }

          communicationResults.push({
            supplierId: supplier._id,
            supplierName: supplier.name,
            results: supplierCommunicationResults
          });
        }

      } catch (error) {
        console.error(`Error creating order for supplier ${supplier._id}:`, error);
        // Continue with other suppliers even if one fails
      }
      }
    }

    // Update original order to mark that alternatives were sent
    await db.collection('purchase_orders').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          alternativesSentAt: new Date(),
          alternativesSentBy: userProfile._id,
          alternativeOrderIds: createdOrders.map(order => order._id),
          status: 'alternatives_sent', // New status to track this state
          updatedAt: new Date(),
        }
      }
    );

    // Update each alternative order to link back to original
    for (const newOrder of createdOrders) {
      await db.collection('purchase_orders').updateOne(
        { _id: newOrder._id },
        {
          $set: {
            originalOrderId: purchaseOrder._id,
            originalOrderNumber: purchaseOrder.purchaseOrderNumber,
            originalRejectionReason: purchaseOrder.rejectionReason,
            originalRejectionSubcategory: purchaseOrder.rejectionSubcategory,
            updatedAt: new Date(),
          }
        }
      );
    }

    // Cancel original rejected order to prevent duplicate tracking
    await db.collection('purchase_orders').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: userProfile._id,
          cancelReason: 'Alternative orders created',
          updatedAt: new Date(),
        }
      }
    );

    // Create notifications for PM/OWNER
    const managers = await db.collection('users').find({
      role: { $in: ['pm', 'project_manager', 'owner'] },
      status: 'active',
    }).toArray();

    // Get unique suppliers for notifications
    const uniqueSupplierIds = [...new Set(createdOrders.map(o => o.supplierId.toString()))];
    const allSuppliersForNotification = await db.collection('suppliers').find({
      _id: { $in: uniqueSupplierIds.map(id => new ObjectId(id)) }
    }).toArray();

    if (managers.length > 0) {
      const materialName = isBulkOrder 
        ? `${createdOrders.length} material(s)` 
        : (materialRequest?.materialName || purchaseOrder.materialName);
      
      const supplierNames = allSuppliersForNotification.map(s => s.name).join(', ');

      const notifications = managers.map(manager => ({
        userId: manager._id.toString(),
        type: 'alternatives_sent',
        title: 'Alternative Orders Sent',
        message: `Sent ${createdOrders.length} alternative purchase order${createdOrders.length !== 1 ? 's' : ''} for ${materialName} to ${supplierNames}`,
        projectId: purchaseOrder.projectId.toString(),
        relatedModel: 'PURCHASE_ORDER',
        relatedId: id,
        createdBy: userProfile._id.toString(),
        metadata: {
          originalOrderId: id,
          alternativeOrderIds: createdOrders.map(order => order._id.toString()),
          suppliers: allSuppliersForNotification.map(s => ({ id: s._id, name: s.name })),
          communicationResults,
          isBulkOrder,
        }
      }));

      await createNotifications(notifications);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'SENT_ALTERNATIVES',
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      projectId: purchaseOrder.projectId.toString(),
      changes: {
        alternativesSent: createdOrders.length,
        suppliers: allSuppliersForNotification.map(s => ({ id: s._id, name: s.name })),
        ...(isBulkOrder ? {
          materialAssignments,
          isBulkOrder: true,
        } : {
          adjustments,
        }),
        communicationChannels,
        communicationResults,
      },
      metadata: {
        originalOrder: purchaseOrder,
        alternativeOrders: createdOrders,
        isBulkOrder,
      }
    });

    return successResponse({
      originalOrderId: id,
      alternativeOrders: createdOrders,
      suppliers: allSuppliersForNotification.map(supplier => ({
        id: supplier._id,
        name: supplier.name,
        email: supplier.email,
        communicationResults: communicationResults.filter(cr => 
          cr.supplierId.toString() === supplier._id.toString()
        ).map(cr => cr.results).flat() || []
      })),
      communicationResults,
      isBulkOrder,
    }, `Successfully sent ${createdOrders.length} alternative purchase order${createdOrders.length !== 1 ? 's' : ''}`);

  } catch (error) {
    console.error('Send alternative orders error:', error);
    return errorResponse('Failed to send alternative orders', 500);
  }
}
