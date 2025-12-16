/**
 * Purchase Order Response Token API Route
 * GET: Get purchase order details by response token
 * 
 * GET /api/purchase-orders/respond/[token]
 * Auth: None (public, token-based)
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/purchase-orders/respond/[token]
 * Get purchase order details by response token
 * Auth: None (public, token-based)
 */
export async function GET(request, { params }) {
  try {
    const { token } = await params;

    if (!token) {
      return errorResponse('Response token is required', 400);
    }

    const db = await getDatabase();

    // Find purchase order by token
    const purchaseOrder = await db.collection('purchase_orders').findOne({
      responseToken: token,
      deletedAt: null
    });

    if (!purchaseOrder) {
      return errorResponse('Invalid or expired response token', 404);
    }

    // Check if token has already been used (one-time use)
    if (purchaseOrder.responseTokenUsedAt) {
      return errorResponse('This response link has already been used. Please contact the buyer if you need to make changes.', 410);
    }

    // Check if token is expired
    if (purchaseOrder.responseTokenExpiresAt && new Date() > new Date(purchaseOrder.responseTokenExpiresAt)) {
      return errorResponse('Response token has expired', 410);
    }

    // Get supplier details
    const supplier = await db.collection('suppliers').findOne({
      _id: purchaseOrder.supplierId,
      deletedAt: null
    });

    // Get project details
    const project = await db.collection('projects').findOne({
      _id: purchaseOrder.projectId,
      deletedAt: null
    });

    // Get batch information if it's a bulk order
    let batch = null;
    if (purchaseOrder.isBulkOrder && purchaseOrder.batchId) {
      batch = await db.collection('material_request_batches').findOne({
        _id: purchaseOrder.batchId,
        deletedAt: null
      });
    }

    // Get material requests if it's a bulk order
    let materialRequests = [];
    if (purchaseOrder.isBulkOrder && purchaseOrder.materialRequestIds && Array.isArray(purchaseOrder.materialRequestIds)) {
      materialRequests = await db
        .collection('material_requests')
        .find({
          _id: { $in: purchaseOrder.materialRequestIds.map((id) => new ObjectId(id)) },
        })
        .toArray();
    }

    // Build purchase order response
    const poResponse = {
      _id: purchaseOrder._id.toString(),
      purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
      isBulkOrder: purchaseOrder.isBulkOrder || false,
      quantityOrdered: purchaseOrder.quantityOrdered,
      unit: purchaseOrder.unit,
      unitCost: purchaseOrder.unitCost,
      totalCost: purchaseOrder.totalCost,
      deliveryDate: purchaseOrder.deliveryDate,
      terms: purchaseOrder.terms,
      notes: purchaseOrder.notes,
      status: purchaseOrder.status,
      supplierName: purchaseOrder.supplierName,
      projectName: project?.projectName || null,
    };

    // Add single order fields for backward compatibility
    if (!purchaseOrder.isBulkOrder) {
      poResponse.materialName = purchaseOrder.materialName;
      poResponse.description = purchaseOrder.description;
    } else {
      // Add bulk order fields
      poResponse.materials = purchaseOrder.materials || [];
      poResponse.batch = batch ? {
        _id: batch._id.toString(),
        batchNumber: batch.batchNumber,
        batchName: batch.batchName,
      } : null;
      poResponse.materialRequests = materialRequests.map((req) => ({
        _id: req._id.toString(),
        requestNumber: req.requestNumber,
        materialName: req.materialName,
        quantityNeeded: req.quantityNeeded,
        unit: req.unit,
      }));
    }

    // Return purchase order with related data (sanitized for public access)
    return successResponse({
      purchaseOrder: poResponse,
      supplier: supplier ? {
        name: supplier.name,
        contactPerson: supplier.contactPerson
      } : null,
      tokenValid: true,
      tokenExpiresAt: purchaseOrder.responseTokenExpiresAt
    }, 'Purchase order retrieved successfully');
  } catch (error) {
    console.error('Get purchase order by token error:', error);
    return errorResponse('Failed to retrieve purchase order', 500);
  }
}

