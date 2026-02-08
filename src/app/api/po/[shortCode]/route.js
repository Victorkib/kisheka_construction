/**
 * Short URL Resolver API Route
 * Resolves short code to full purchase order response token
 * 
 * GET /api/po/[shortCode]
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { redirect } from 'next/navigation';

/**
 * GET /api/po/[shortCode]
 * Resolves short code to full response token and redirects
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { shortCode } = await params;

    if (!shortCode || shortCode.length !== 8) {
      return NextResponse.json(
        { success: false, error: 'Invalid short code' },
        { status: 400 }
      );
    }

    const db = await getDatabase();

    // Find purchase order by short code (first 8 chars of responseToken)
    const purchaseOrder = await db.collection('purchase_orders').findOne({
      responseToken: { $regex: `^${shortCode}` },
      deletedAt: null,
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { success: false, error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Check if token is expired
    if (purchaseOrder.responseTokenExpiresAt && new Date() > new Date(purchaseOrder.responseTokenExpiresAt)) {
      return NextResponse.json(
        { success: false, error: 'This link has expired' },
        { status: 410 }
      );
    }

    // Redirect to full response page with full token
    const fullToken = purchaseOrder.responseToken;
    const responseUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/purchase-orders/respond/${fullToken}`;
    
    return NextResponse.redirect(responseUrl, { status: 302 });
  } catch (error) {
    console.error('Short URL resolve error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to resolve short URL' },
      { status: 500 }
    );
  }
}

