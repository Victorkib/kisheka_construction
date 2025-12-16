/**
 * Purchase Order PDF Download API Route
 * GET: Download purchase order as PDF
 * 
 * GET /api/purchase-orders/[id]/download?token=[responseToken]
 * Auth: None (public, token-based)
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { generatePurchaseOrderPDF } from '@/lib/generators/purchase-order-pdf-generator';
import { ObjectId } from 'mongodb';
import { errorResponse } from '@/lib/api-response';

/**
 * GET /api/purchase-orders/[id]/download
 * Download purchase order as PDF (token-based)
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid purchase order ID', 400);
    }

    if (!token) {
      return errorResponse('Response token is required', 400);
    }

    const db = await getDatabase();

    // Get purchase order
    const purchaseOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!purchaseOrder) {
      return errorResponse('Purchase order not found', 404);
    }

    // Validate token
    if (purchaseOrder.responseToken !== token) {
      return errorResponse('Invalid response token', 401);
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

    // Generate PDF
    const pdfBuffer = generatePurchaseOrderPDF({
      purchaseOrder,
      supplier,
      project,
      batch
    });

    // Generate filename
    const poNumber = purchaseOrder.purchaseOrderNumber.replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Purchase_Order_${poNumber}_${dateStr}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Purchase order PDF download error:', error);
    return errorResponse('Failed to generate PDF', 500);
  }
}



