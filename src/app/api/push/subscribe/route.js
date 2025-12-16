/**
 * Push Subscription API Route
 * POST: Register push notification subscription
 * 
 * POST /api/push/subscribe
 * Auth: Token-based (for suppliers) or authenticated (for users)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/push/subscribe
 * Register push notification subscription
 * Body: { subscription: { endpoint, keys }, userType: 'user'|'supplier', userId/supplierId, token? }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { subscription, userType, userId, supplierId, token } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return errorResponse('Invalid subscription object', 400);
    }

    if (!userType || !['user', 'supplier'].includes(userType)) {
      return errorResponse('Invalid userType. Must be "user" or "supplier"', 400);
    }

    const db = await getDatabase();

    // Declare finalSupplierId outside the if block for use later
    let finalSupplierId = supplierId;

    // For users: require authentication
    if (userType === 'user') {
      if (!userId) {
        return errorResponse('userId is required for user subscriptions', 400);
      }

      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return errorResponse('Unauthorized', 401);
      }

      const userProfile = await getUserProfile(user.id);
      if (!userProfile) {
        return errorResponse('User profile not found', 404);
      }

      // Verify userId matches authenticated user
      if (userProfile._id.toString() !== userId) {
        return errorResponse('userId does not match authenticated user', 403);
      }
    }

    // For suppliers: require token validation
    if (userType === 'supplier') {
      let resolvedSupplierId = supplierId;
      
      // Validate token if provided (for enhanced security)
      if (token) {
        // Verify token is valid and not expired
        const purchaseOrder = await db.collection('purchase_orders').findOne({
          responseToken: token,
          responseTokenExpiresAt: { $gt: new Date() },
          deletedAt: null,
        });
        
        if (!purchaseOrder) {
          return errorResponse('Invalid or expired token', 401);
        }
        
        // Link subscription to supplier from PO
        if (purchaseOrder.supplierId) {
          resolvedSupplierId = purchaseOrder.supplierId.toString();
        }
      }
      
      if (!resolvedSupplierId) {
        return errorResponse('supplierId is required for supplier subscriptions', 400);
      }

      // Verify supplier exists
      const supplier = await db.collection('suppliers').findOne({
        _id: new ObjectId(resolvedSupplierId),
        status: 'active',
        deletedAt: null
      });

      if (!supplier) {
        return errorResponse('Supplier not found', 404);
      }
      
      // Use resolved supplier ID
      finalSupplierId = resolvedSupplierId;
    }

    // Check if subscription already exists
    const existing = await db.collection('push_subscriptions').findOne({
      endpoint: subscription.endpoint
    });

    if (existing) {
      // Update existing subscription
      const updateData = {
        keys: subscription.keys,
        userType,
        ...(userType === 'user' && { userId: new ObjectId(userId) }),
        ...(userType === 'supplier' && { supplierId: new ObjectId(finalSupplierId) }),
        status: 'active',
        lastActiveAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('push_subscriptions').updateOne(
        { endpoint: subscription.endpoint },
        { $set: updateData }
      );

      return successResponse(
        { subscriptionId: existing._id.toString(), updated: true },
        'Push subscription updated successfully'
      );
    }

    // Create new subscription
    const subscriptionDoc = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      },
      userType,
      ...(userType === 'user' && { userId: new ObjectId(userId) }),
      ...(userType === 'supplier' && { supplierId: new ObjectId(finalSupplierId) }),
      status: 'active',
      subscribedAt: new Date(),
      lastActiveAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('push_subscriptions').insertOne(subscriptionDoc);

    return successResponse(
      { subscriptionId: result.insertedId.toString() },
      'Push subscription registered successfully',
      201
    );
  } catch (error) {
    console.error('Subscribe push error:', error);
    return errorResponse('Failed to register push subscription', 500);
  }
}

