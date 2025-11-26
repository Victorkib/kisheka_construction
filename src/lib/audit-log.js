/**
 * Audit Log Helper Functions
 * Creates audit trail entries for all system actions
 * 
 * All actions in the system should be logged for compliance and accountability
 */

import { getDatabase } from './mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Creates an audit log entry
 * @param {Object} params - Audit log parameters
 * @param {string} params.userId - MongoDB user ID (ObjectId string)
 * @param {string} params.action - Action type (CREATED, UPDATED, DELETED, APPROVED, REJECTED, VIEWED, etc.)
 * @param {string} params.entityType - Entity type (MATERIAL, EXPENSE, LABOUR_LOG, USER, APPROVAL, etc.)
 * @param {string} params.entityId - MongoDB entity ID (ObjectId string)
 * @param {Object} [params.changes] - Object containing field changes { fieldName: { oldValue, newValue } }
 * @param {string} [params.projectId] - MongoDB project ID (ObjectId string)
 * @param {string} [params.ipAddress] - IP address of the request
 * @param {string} [params.userAgent] - User agent string
 * @param {string} [params.status] - Status (SUCCESS, FAILED) - defaults to SUCCESS
 * @param {string} [params.errorMessage] - Error message if status is FAILED
 * @returns {Promise<Object>} Created audit log entry
 */
export async function createAuditLog({
  userId,
  action,
  entityType,
  entityId,
  changes = {},
  projectId = null,
  ipAddress = null,
  userAgent = null,
  status = 'SUCCESS',
  errorMessage = null,
}) {
  try {
    const db = await getDatabase();
    
    const auditLog = {
      userId: new ObjectId(userId),
      action,
      entityType,
      entityId: new ObjectId(entityId),
      changes,
      timestamp: new Date(),
      status,
      ...(projectId && { projectId: new ObjectId(projectId) }),
      ...(ipAddress && { ipAddress }),
      ...(userAgent && { userAgent }),
      ...(errorMessage && { errorMessage }),
    };
    
    const result = await db.collection('audit_logs').insertOne(auditLog);
    
    return { ...auditLog, _id: result.insertedId };
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw - audit logging should not break the main flow
    return null;
  }
}

/**
 * Gets audit logs for a specific entity
 * @param {string} entityType - Entity type
 * @param {string} entityId - Entity ID
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=50] - Maximum number of logs to return
 * @returns {Promise<Array>} Array of audit log entries
 */
export async function getEntityAuditLogs(entityType, entityId, options = {}) {
  try {
    const db = await getDatabase();
    const { limit = 50 } = options;
    
    const logs = await db
      .collection('audit_logs')
      .find({
        entityType,
        entityId: new ObjectId(entityId),
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    return logs;
  } catch (error) {
    console.error('Error getting audit logs:', error);
    return [];
  }
}

/**
 * Gets audit logs for a specific user
 * @param {string} userId - User ID
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=100] - Maximum number of logs to return
 * @param {Date} [options.startDate] - Start date filter
 * @param {Date} [options.endDate] - End date filter
 * @returns {Promise<Array>} Array of audit log entries
 */
export async function getUserAuditLogs(userId, options = {}) {
  try {
    const db = await getDatabase();
    const { limit = 100, startDate, endDate } = options;
    
    const query = {
      userId: new ObjectId(userId),
    };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }
    
    const logs = await db
      .collection('audit_logs')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    return logs;
  } catch (error) {
    console.error('Error getting user audit logs:', error);
    return [];
  }
}

