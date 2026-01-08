/**
 * Automated Reminder Service
 * Sends reminders to suppliers for pending purchase orders
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { sendSMS } from './sms-service';
import { sendPushToUser } from './push-service';
import { ObjectId } from 'mongodb';

/**
 * Send reminder to supplier for pending purchase order
 * @param {Object} purchaseOrder - Purchase order document
 * @param {Object} supplier - Supplier document
 * @param {Object} options - Reminder options
 * @returns {Promise<Object>} Result of reminder send
 */
export async function sendPurchaseOrderReminder(purchaseOrder, supplier, options = {}) {
  try {
    const {
      reminderType = 'standard', // 'standard', 'urgent', 'final'
      daysSinceSent = 0,
      customMessage = null
    } = options;

    if (!purchaseOrder || !supplier) {
      throw new Error('Purchase order and supplier are required');
    }

    // Check if reminder was already sent recently (within last 24 hours)
    const lastReminder = purchaseOrder.lastReminderSentAt;
    if (lastReminder) {
      const hoursSinceLastReminder = (new Date() - new Date(lastReminder)) / (1000 * 60 * 60);
      if (hoursSinceLastReminder < 24) {
        return {
          sent: false,
          reason: 'Reminder sent recently (within 24 hours)',
          lastReminderAt: lastReminder
        };
      }
    }

    // Build reminder message
    let message;
    if (customMessage) {
      message = customMessage;
    } else {
      const urgencyText = reminderType === 'urgent' ? 'URGENT: ' : 
                         reminderType === 'final' ? 'FINAL REMINDER: ' : '';
      
      message = `${urgencyText}Reminder: Please respond to Purchase Order ${purchaseOrder.purchaseOrderNumber}. `;
      
      if (purchaseOrder.isBulkOrder) {
        message += `${purchaseOrder.materials?.length || 0} materials pending response. `;
      } else {
        message += `Material: ${purchaseOrder.materialName}. `;
      }
      
      message += `Total: KES ${(purchaseOrder.totalCost || 0).toLocaleString()}. `;
      
      if (purchaseOrder.responseToken) {
        // Include response link if available
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.kisheka.com';
        const responseUrl = `${baseUrl}/purchase-orders/respond/${purchaseOrder.responseToken}`;
        message += `Respond: ${responseUrl}`;
      } else {
        message += 'Please contact us to respond.';
      }
    }

    // Send SMS to supplier
    let smsSent = false;
    let smsError = null;
    
    if (supplier.phone) {
      try {
        await sendSMS({
          to: supplier.phone,
          message: message.substring(0, 160), // SMS character limit
        });
        smsSent = true;
      } catch (smsErr) {
        console.error('[Reminder Service] SMS send failed:', smsErr);
        smsError = smsErr.message;
      }
    }

    // Update purchase order with reminder tracking
    const db = await getDatabase();
    const reminderEntry = {
      sentAt: new Date(),
      type: reminderType,
      daysSinceSent,
      smsSent,
      smsError: smsError || null,
      message: message.substring(0, 500), // Store truncated message
    };

    await db.collection('purchase_orders').updateOne(
      { _id: purchaseOrder._id },
      {
        $set: {
          lastReminderSentAt: new Date(),
          reminderCount: (purchaseOrder.reminderCount || 0) + 1,
          updatedAt: new Date()
        },
        $push: {
          reminders: reminderEntry
        }
      }
    );

    // Notify PM/OWNER that reminder was sent
    if (purchaseOrder.createdBy) {
      try {
        const poCreator = await db.collection('users').findOne({
          _id: purchaseOrder.createdBy,
          status: 'active'
        });

        if (poCreator) {
          await sendPushToUser({
            userId: poCreator._id.toString(),
            title: 'Reminder Sent',
            message: `Reminder sent to ${supplier.name} for PO ${purchaseOrder.purchaseOrderNumber}`,
            data: {
              url: `/purchase-orders/${purchaseOrder._id.toString()}`,
              purchaseOrderId: purchaseOrder._id.toString()
            }
          });
        }
      } catch (pushError) {
        console.error('[Reminder Service] Push notification failed:', pushError);
      }
    }

    return {
      sent: true,
      smsSent,
      smsError,
      reminderType,
      reminderCount: (purchaseOrder.reminderCount || 0) + 1
    };
  } catch (error) {
    console.error('[Reminder Service] Error sending reminder:', error);
    throw error;
  }
}

/**
 * Get purchase orders that need reminders
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Purchase orders needing reminders
 */
export async function getOrdersNeedingReminders(options = {}) {
  try {
    const {
      projectId = null,
      daysSinceSent = 3, // Default: send reminder after 3 days
      maxReminders = 3, // Maximum number of reminders to send
      includeUrgent = true,
      includeFinal = true
    } = options;

    const db = await getDatabase();

    // Calculate date threshold
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysSinceSent);

    // Build query
    const query = {
      status: 'order_sent', // Only pending orders
      deletedAt: null,
      sentAt: { $lte: thresholdDate }, // Sent at least X days ago
      supplierResponse: { $exists: false }, // No response yet
      $or: [
        { lastReminderSentAt: { $exists: false } }, // Never sent reminder
        { lastReminderSentAt: { $lte: thresholdDate } } // Last reminder was X days ago
      ]
    };

    // Limit reminder count
    query.$or.push(
      { reminderCount: { $exists: false } },
      { reminderCount: { $lt: maxReminders } }
    );

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    // Get orders
    const orders = await db.collection('purchase_orders')
      .find(query)
      .toArray();

    // Categorize by urgency
    const categorized = {
      standard: [],
      urgent: [],
      final: []
    };

    for (const order of orders) {
      const daysSinceOrderSent = Math.floor((new Date() - new Date(order.sentAt)) / (1000 * 60 * 60 * 24));
      const reminderCount = order.reminderCount || 0;

      if (reminderCount >= maxReminders - 1 && includeFinal) {
        categorized.final.push({ ...order, daysSinceSent: daysSinceOrderSent });
      } else if (daysSinceOrderSent >= 7 && includeUrgent) {
        categorized.urgent.push({ ...order, daysSinceSent: daysSinceOrderSent });
      } else {
        categorized.standard.push({ ...order, daysSinceSent: daysSinceOrderSent });
      }
    }

    return categorized;
  } catch (error) {
    console.error('[Reminder Service] Error getting orders needing reminders:', error);
    throw error;
  }
}

/**
 * Send reminders for all orders that need them
 * @param {Object} options - Reminder options
 * @returns {Promise<Object>} Summary of reminders sent
 */
export async function sendPendingReminders(options = {}) {
  try {
    const {
      projectId = null,
      daysSinceSent = 3,
      maxReminders = 3,
      dryRun = false // If true, don't actually send, just return what would be sent
    } = options;

    const categorized = await getOrdersNeedingReminders({
      projectId,
      daysSinceSent,
      maxReminders,
      includeUrgent: true,
      includeFinal: true
    });

    const db = await getDatabase();
    const results = {
      standard: { attempted: 0, sent: 0, failed: 0 },
      urgent: { attempted: 0, sent: 0, failed: 0 },
      final: { attempted: 0, sent: 0, failed: 0 },
      errors: []
    };

    // Send standard reminders
    for (const order of categorized.standard) {
      try {
        results.standard.attempted++;
        
        if (dryRun) {
          results.standard.sent++;
          continue;
        }

        const supplier = await db.collection('suppliers').findOne({
          _id: order.supplierId
        });

        if (!supplier) {
          results.standard.failed++;
          results.errors.push({
            orderId: order._id.toString(),
            orderNumber: order.purchaseOrderNumber,
            reason: 'Supplier not found'
          });
          continue;
        }

        const result = await sendPurchaseOrderReminder(order, supplier, {
          reminderType: 'standard',
          daysSinceSent: order.daysSinceSent
        });

        if (result.sent) {
          results.standard.sent++;
        } else {
          results.standard.failed++;
          results.errors.push({
            orderId: order._id.toString(),
            orderNumber: order.purchaseOrderNumber,
            reason: result.reason || 'Failed to send'
          });
        }
      } catch (error) {
        results.standard.failed++;
        results.errors.push({
          orderId: order._id.toString(),
          orderNumber: order.purchaseOrderNumber,
          reason: error.message
        });
      }
    }

    // Send urgent reminders
    for (const order of categorized.urgent) {
      try {
        results.urgent.attempted++;
        
        if (dryRun) {
          results.urgent.sent++;
          continue;
        }

        const supplier = await db.collection('suppliers').findOne({
          _id: order.supplierId
        });

        if (!supplier) {
          results.urgent.failed++;
          continue;
        }

        const result = await sendPurchaseOrderReminder(order, supplier, {
          reminderType: 'urgent',
          daysSinceSent: order.daysSinceSent
        });

        if (result.sent) {
          results.urgent.sent++;
        } else {
          results.urgent.failed++;
        }
      } catch (error) {
        results.urgent.failed++;
        results.errors.push({
          orderId: order._id.toString(),
          orderNumber: order.purchaseOrderNumber,
          reason: error.message
        });
      }
    }

    // Send final reminders
    for (const order of categorized.final) {
      try {
        results.final.attempted++;
        
        if (dryRun) {
          results.final.sent++;
          continue;
        }

        const supplier = await db.collection('suppliers').findOne({
          _id: order.supplierId
        });

        if (!supplier) {
          results.final.failed++;
          continue;
        }

        const result = await sendPurchaseOrderReminder(order, supplier, {
          reminderType: 'final',
          daysSinceSent: order.daysSinceSent
        });

        if (result.sent) {
          results.final.sent++;
        } else {
          results.final.failed++;
        }
      } catch (error) {
        results.final.failed++;
        results.errors.push({
          orderId: order._id.toString(),
          orderNumber: order.purchaseOrderNumber,
          reason: error.message
        });
      }
    }

    return {
      success: true,
      summary: {
        totalAttempted: results.standard.attempted + results.urgent.attempted + results.final.attempted,
        totalSent: results.standard.sent + results.urgent.sent + results.final.sent,
        totalFailed: results.standard.failed + results.urgent.failed + results.final.failed
      },
      details: results,
      dryRun
    };
  } catch (error) {
    console.error('[Reminder Service] Error sending pending reminders:', error);
    throw error;
  }
}






