/**
 * Unsubscribe from Push Notifications API
 *
 * Route: POST /api/push/unsubscribe
 *
 * Removes a browser's push notification subscription
 * Called when user disables notifications from settings
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // Get request body
    const { endpoint } = await request.json();

    if (!endpoint) {
      return errorResponse('Subscription endpoint is required', 400);
    }

    // Connect to database
    const db = await getDatabase();
    const subscriptionsCollection = db.collection('push_subscriptions');

    // Mark subscription inactive (endpoint stored at root)
    const result = await subscriptionsCollection.updateOne(
      { endpoint },
      {
        $set: {
          status: 'inactive',
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return errorResponse('Subscription not found', 404);
    }

    console.log(
      `[Push Notifications] Unsubscribed endpoint: ${endpoint.substring(
        0,
        50
      )}...`
    );

    return successResponse(
      {
        message: 'Successfully unsubscribed from push notifications',
        updatedCount: result.modifiedCount,
      },
      'Unsubscribed successfully'
    );
  } catch (error) {
    console.error('[Push Notifications] Unsubscribe error:', error);
    return errorResponse('Failed to unsubscribe from push notifications', 500);
  }
}
