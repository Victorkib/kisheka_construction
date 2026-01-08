/**
 * Push Notification Service
 * Handles Web Push API subscriptions and notifications
 * 
 * Requirements:
 * - npm install web-push
 * - VAPID keys must be generated and set in environment variables
 * 
 * To generate VAPID keys:
 * npx web-push generate-vapid-keys
 */

let webpush = null;

// Lazy load web-push to avoid errors if not installed
async function getWebPush() {
  if (webpush) {
    return webpush;
  }

  try {
    const webPushModule = await import('web-push');
    webpush = webPushModule.default || webPushModule;
    
    // Initialize VAPID keys
    const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
    const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@kisheka.com';

    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    } else {
      console.warn('VAPID keys not configured. Push notifications will not work.');
    }

    return webpush;
  } catch (error) {
    console.error('Failed to load web-push module:', error);
    console.error('Please install web-push: npm install web-push');
    throw new Error('web-push module not available. Please install: npm install web-push');
  }
}

/**
 * Send push notification
 * @param {Object} subscription - Push subscription object with endpoint and keys
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Array} actions - Action buttons (optional)
 * @param {Object} data - Additional data to pass with notification
 * @returns {Promise<Object>} Send result
 */
export async function sendPushNotification({ subscription, title, message, actions, data }) {
  try {
    const push = await getWebPush();
    
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new Error('Invalid subscription object');
    }

    const payload = JSON.stringify({
      title: title || 'Doshaki Construction',
      message: message || '',
      actions: actions || [],
      data: data || {},
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      timestamp: Date.now()
    });

    const options = {
      TTL: parseInt(process.env.PUSH_NOTIFICATION_TTL || '86400'), // 24 hours default
      urgency: 'high'
    };

    await push.sendNotification(subscription, payload, options);
    
    return {
      success: true,
      sentAt: new Date()
    };
  } catch (error) {
    console.error('Push notification error:', error);
    
    // Handle specific error codes
    if (error.statusCode === 410) {
      // Subscription expired or no longer valid
      return {
        success: false,
        error: 'Subscription expired',
        statusCode: 410
      };
    } else if (error.statusCode === 404) {
      // Subscription not found
      return {
        success: false,
        error: 'Subscription not found',
        statusCode: 404
      };
    }
    
    throw error;
  }
}

/**
 * Send push notification to supplier
 * @param {Object} options - Notification options
 * @param {string} options.supplierId - Supplier ID
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {Array} options.actions - Action buttons
 * @param {Object} options.data - Additional data
 * @returns {Promise<Array>} Array of send results
 */
export async function sendPushToSupplier({ supplierId, title, message, actions, data }) {
  const { getDatabase } = await import('@/lib/mongodb/connection');
  const { ObjectId } = await import('mongodb');
  
  const db = await getDatabase();
  const subscriptions = await db.collection('push_subscriptions').find({
    supplierId: new ObjectId(supplierId),
    userType: 'supplier',
    status: 'active'
  }).toArray();

  if (subscriptions.length === 0) {
    console.log(`No active push subscriptions found for supplier ${supplierId}`);
    return [];
  }

  const results = [];
  for (const sub of subscriptions) {
    try {
      // Include subscription endpoint in data for response handling
      const notificationData = {
        ...data,
        subscriptionEndpoint: sub.endpoint
      };

      const result = await sendPushNotification({
        subscription: {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth
          }
        },
        title,
        message,
        actions,
        data: notificationData
      });

      // Update last active timestamp
      if (result.success) {
        await db.collection('push_subscriptions').updateOne(
          { _id: sub._id },
          { $set: { lastActiveAt: new Date() } }
        );
      } else if (result.statusCode === 410 || result.statusCode === 404) {
        // Mark subscription as inactive if expired or not found
        await db.collection('push_subscriptions').updateOne(
          { _id: sub._id },
          { $set: { status: 'inactive', updatedAt: new Date() } }
        );
      }

      results.push({
        success: result.success,
        endpoint: sub.endpoint,
        error: result.error || null
      });
    } catch (error) {
      console.error(`Error sending push to subscription ${sub.endpoint}:`, error);
      results.push({
        success: false,
        endpoint: sub.endpoint,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Send push notification to user (PM/OWNER)
 * @param {Object} options - Notification options
 * @param {string} options.userId - User ID
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {Array} options.actions - Action buttons
 * @param {Object} options.data - Additional data
 * @returns {Promise<Array>} Array of send results
 */
export async function sendPushToUser({ userId, title, message, actions, data }) {
  const { getDatabase } = await import('@/lib/mongodb/connection');
  const { ObjectId } = await import('mongodb');
  
  const db = await getDatabase();
  const subscriptions = await db.collection('push_subscriptions').find({
    userId: new ObjectId(userId),
    userType: 'user',
    status: 'active'
  }).toArray();

  if (subscriptions.length === 0) {
    console.log(`No active push subscriptions found for user ${userId}`);
    return [];
  }

  const results = [];
  for (const sub of subscriptions) {
    try {
      // Include subscription endpoint in data for response handling
      const notificationData = {
        ...data,
        subscriptionEndpoint: sub.endpoint
      };

      const result = await sendPushNotification({
        subscription: {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth
          }
        },
        title,
        message,
        actions,
        data: notificationData
      });

      // Update last active timestamp
      if (result.success) {
        await db.collection('push_subscriptions').updateOne(
          { _id: sub._id },
          { $set: { lastActiveAt: new Date() } }
        );
      } else if (result.statusCode === 410 || result.statusCode === 404) {
        // Mark subscription as inactive if expired or not found
        await db.collection('push_subscriptions').updateOne(
          { _id: sub._id },
          { $set: { status: 'inactive', updatedAt: new Date() } }
        );
      }

      results.push({
        success: result.success,
        endpoint: sub.endpoint,
        error: result.error || null
      });
    } catch (error) {
      console.error(`Error sending push to subscription ${sub.endpoint}:`, error);
      results.push({
        success: false,
        endpoint: sub.endpoint,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Generate VAPID keys (utility function)
 * Run this once to generate keys: node -e "require('web-push').generateVAPIDKeys().then(console.log)"
 * Or use: npx web-push generate-vapid-keys
 */
export async function generateVAPIDKeys() {
  try {
    const push = await getWebPush();
    const vapidKeys = push.generateVAPIDKeys();
    return {
      publicKey: vapidKeys.publicKey,
      privateKey: vapidKeys.privateKey
    };
  } catch (error) {
    console.error('Error generating VAPID keys:', error);
    throw error;
  }
}

