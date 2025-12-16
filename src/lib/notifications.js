/**
 * Notification Helper Functions
 * Creates and manages in-app notifications for users
 * 
 * Notifications are used to alert users about important events:
 * - Approval requests
 * - Budget alerts
 * - Discrepancy alerts (variance, loss, wastage)
 * - System events
 */

import { getDatabase } from './mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Creates a notification for a user
 * @param {Object} params - Notification parameters
 * @param {string} params.userId - MongoDB user ID (ObjectId string)
 * @param {string} params.type - Notification type (approval_needed, approval_status, budget_alert, discrepancy_alert, item_received, task_assigned, comment, role_changed, invitation_sent, bulk_request_created, bulk_request_approved, bulk_po_created, template_used, bulk_materials_created)
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} [params.projectId] - MongoDB project ID (ObjectId string)
 * @param {string} [params.relatedModel] - Related model type (MATERIAL, EXPENSE, etc.)
 * @param {string} [params.relatedId] - Related entity ID (ObjectId string)
 * @param {string} [params.createdBy] - User who triggered the notification (ObjectId string)
 * @returns {Promise<Object>} Created notification entry
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  projectId = null,
  relatedModel = null,
  relatedId = null,
  createdBy = null,
}) {
  try {
    const db = await getDatabase();
    
    const notification = {
      userId: new ObjectId(userId),
      type,
      title,
      message,
      isRead: false,
      readAt: null,
      createdAt: new Date(),
      ...(projectId && { projectId: new ObjectId(projectId) }),
      ...(relatedModel && { relatedModel }),
      ...(relatedId && { relatedId: new ObjectId(relatedId) }),
      ...(createdBy && { createdBy: new ObjectId(createdBy) }),
    };
    
    const result = await db.collection('notifications').insertOne(notification);
    
    return { ...notification, _id: result.insertedId };
  } catch (error) {
    console.error('Error creating notification:', error);
    // Don't throw - notification creation should not break the main flow
    return null;
  }
}

/**
 * Creates notifications for multiple users
 * @param {Array<Object>} notifications - Array of notification objects (each with userId and other params)
 * @returns {Promise<Array>} Array of created notification entries
 */
export async function createNotifications(notifications) {
  try {
    const db = await getDatabase();
    
    const notificationDocs = notifications.map(({ userId, ...rest }) => ({
      userId: new ObjectId(userId),
      ...rest,
      isRead: false,
      readAt: null,
      createdAt: new Date(),
      ...(rest.projectId && { projectId: new ObjectId(rest.projectId) }),
      ...(rest.relatedId && { relatedId: new ObjectId(rest.relatedId) }),
      ...(rest.createdBy && { createdBy: new ObjectId(rest.createdBy) }),
    }));
    
    const result = await db.collection('notifications').insertMany(notificationDocs);
    
    return notificationDocs.map((doc, index) => ({
      ...doc,
      _id: result.insertedIds[index],
    }));
  } catch (error) {
    console.error('Error creating notifications:', error);
    return [];
  }
}

/**
 * Marks a notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (to verify ownership)
 * @returns {Promise<boolean>} True if successfully marked as read
 */
export async function markNotificationAsRead(notificationId, userId) {
  try {
    const db = await getDatabase();
    
    const result = await db.collection('notifications').updateOne(
      {
        _id: new ObjectId(notificationId),
        userId: new ObjectId(userId),
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );
    
    return result.modifiedCount > 0;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

/**
 * Marks all notifications as read for a user
 * @param {string} userId - User ID
 * @param {string} [projectId] - Optional project ID to filter by
 * @returns {Promise<number>} Number of notifications marked as read
 */
export async function markAllNotificationsAsRead(userId, projectId = null) {
  try {
    const db = await getDatabase();
    
    const query = {
      userId: new ObjectId(userId),
      isRead: false,
    };
    
    if (projectId) {
      query.projectId = new ObjectId(projectId);
    }
    
    const result = await db.collection('notifications').updateMany(
      query,
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );
    
    return result.modifiedCount;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return 0;
  }
}

/**
 * Gets unread notifications for a user
 * @param {string} userId - User ID
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=50] - Maximum number of notifications to return
 * @param {string} [options.projectId] - Optional project ID to filter by
 * @param {string} [options.type] - Optional notification type to filter by
 * @returns {Promise<Array>} Array of notification entries
 */
export async function getUnreadNotifications(userId, options = {}) {
  try {
    const db = await getDatabase();
    const { limit = 50, projectId, type } = options;
    
    const query = {
      userId: new ObjectId(userId),
      isRead: false,
    };
    
    if (projectId) {
      query.projectId = new ObjectId(projectId);
    }
    
    if (type) {
      query.type = type;
    }
    
    const notifications = await db
      .collection('notifications')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    
    return notifications;
  } catch (error) {
    console.error('Error getting unread notifications:', error);
    return [];
  }
}

/**
 * Creates a bulk request creation notification
 * @param {Object} params - Notification parameters
 * @param {string} params.batchId - Batch ID
 * @param {string} params.batchNumber - Batch number
 * @param {string} params.projectId - Project ID
 * @param {string} params.createdBy - User ID who created the batch
 * @param {number} params.materialCount - Number of materials in the batch
 * @returns {Promise<Array>} Created notifications
 */
export async function createBulkRequestNotifications({ batchId, batchNumber, projectId, createdBy, materialCount }) {
  const db = await getDatabase();
  
  // Get approvers (PM, OWNER)
  const approvers = await db.collection('users').find({
    role: { $in: ['pm', 'project_manager', 'owner'] },
    status: 'active',
  }).toArray();

  const notifications = approvers.map((approver) => ({
    userId: approver._id.toString(),
    type: 'bulk_request_created',
    title: 'New Bulk Material Request',
    message: `A bulk material request (${batchNumber}) with ${materialCount} material(s) requires your approval.`,
    projectId,
    relatedModel: 'MATERIAL_REQUEST_BATCH',
    relatedId: batchId,
    createdBy,
  }));

  return await createNotifications(notifications);
}

/**
 * Creates bulk request approval notifications
 * @param {Object} params - Notification parameters
 * @param {string} params.batchId - Batch ID
 * @param {string} params.batchNumber - Batch number
 * @param {string} params.projectId - Project ID
 * @param {string} params.approvedBy - User ID who approved
 * @param {string} params.requesterId - User ID who created the request
 * @param {number} params.approvedCount - Number of approved requests
 * @returns {Promise<Array>} Created notifications
 */
export async function createBulkApprovalNotifications({ batchId, batchNumber, projectId, approvedBy, requesterId, approvedCount }) {
  const notifications = [
    {
      userId: requesterId,
      type: 'bulk_request_approved',
      title: 'Bulk Material Request Approved',
      message: `Your bulk material request (${batchNumber}) with ${approvedCount} material(s) has been approved.`,
      projectId,
      relatedModel: 'MATERIAL_REQUEST_BATCH',
      relatedId: batchId,
      createdBy: approvedBy,
    },
  ];

  return await createNotifications(notifications);
}

/**
 * Creates bulk PO creation notifications
 * @param {Object} params - Notification parameters
 * @param {Array<string>} params.poIds - Array of purchase order IDs
 * @param {string} params.batchId - Batch ID
 * @param {string} params.batchNumber - Batch number
 * @param {string} params.projectId - Project ID
 * @param {string} params.createdBy - User ID who created the POs
 * @param {Array<string>} params.supplierIds - Array of supplier IDs
 * @returns {Promise<Array>} Created notifications
 */
export async function createBulkPONotifications({ poIds, batchId, batchNumber, projectId, createdBy, supplierIds }) {
  const db = await getDatabase();
  
  // Get unique suppliers
  const uniqueSupplierIds = [...new Set(supplierIds)];
  
  const notifications = uniqueSupplierIds.map((supplierId) => ({
    userId: supplierId,
    type: 'bulk_po_created',
    title: 'New Bulk Purchase Order',
    message: `A bulk purchase order from batch ${batchNumber} has been created. Please review and respond.`,
    projectId,
    relatedModel: 'PURCHASE_ORDER',
    relatedId: poIds[0] || batchId, // Use first PO ID or batch ID
    createdBy,
  }));

  return await createNotifications(notifications);
}

/**
 * Creates template usage notification
 * @param {Object} params - Notification parameters
 * @param {string} params.templateId - Template ID
 * @param {string} params.templateName - Template name
 * @param {string} params.batchId - Batch ID created from template
 * @param {string} params.projectId - Project ID
 * @param {string} params.createdBy - User ID who used the template
 * @returns {Promise<Object>} Created notification
 */
export async function createTemplateUsageNotification({ templateId, templateName, batchId, projectId, createdBy }) {
  return await createNotification({
    userId: createdBy,
    type: 'template_used',
    title: 'Template Used Successfully',
    message: `Material template "${templateName}" was used to create a new bulk request.`,
    projectId,
    relatedModel: 'MATERIAL_TEMPLATE',
    relatedId: templateId,
    createdBy,
  });
}

/**
 * Gets all notifications for a user
 * @param {string} userId - User ID
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=100] - Maximum number of notifications to return
 * @param {string} [options.projectId] - Optional project ID to filter by
 * @param {boolean} [options.isRead] - Optional read status filter
 * @param {string} [options.type] - Optional notification type filter
 * @returns {Promise<Array>} Array of notification entries
 */
export async function getUserNotifications(userId, options = {}) {
  try {
    const db = await getDatabase();
    const { limit = 100, projectId, isRead, type } = options;
    
    const query = {
      userId: new ObjectId(userId),
    };
    
    if (projectId) {
      query.projectId = new ObjectId(projectId);
    }
    
    if (typeof isRead === 'boolean') {
      query.isRead = isRead;
    }
    
    if (type) {
      query.type = type;
    }
    
    const notifications = await db
      .collection('notifications')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    
    return notifications;
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return [];
  }
}

/**
 * Gets notification count for a user
 * @param {string} userId - User ID
 * @param {string} [projectId] - Optional project ID to filter by
 * @returns {Promise<number>} Number of unread notifications
 */
export async function getUnreadNotificationCount(userId, projectId = null) {
  try {
    const db = await getDatabase();
    
    const query = {
      userId: new ObjectId(userId),
      isRead: false,
    };
    
    if (projectId) {
      query.projectId = new ObjectId(projectId);
    }
    
    const count = await db.collection('notifications').countDocuments(query);
    
    return count;
  } catch (error) {
    console.error('Error getting notification count:', error);
    return 0;
  }
}

