/**
 * Automated Reminder Service
 * Sends reminders to suppliers for pending purchase orders
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { sendSMS, formatPhoneNumber, generateDeliveryReminderSMS, generateReminderSMS, getSupplierLanguage } from './sms-service';
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

    // Build reminder message using enhanced SMS generation
    let message;
    if (customMessage) {
      message = customMessage;
    } else {
      // Use enhanced reminder SMS generation with language support
      const db = await getDatabase();
      const materialRequest = purchaseOrder.materialRequestId 
        ? await db.collection('material_requests').findOne({ _id: purchaseOrder.materialRequestId })
        : null;

      message = await generateReminderSMS({
        purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
        materialName: purchaseOrder.materialName || materialRequest?.materialName || 'Materials',
        quantity: purchaseOrder.quantityOrdered || 0,
        unit: purchaseOrder.unit || materialRequest?.unit || '',
        totalCost: purchaseOrder.totalCost || 0,
        shortLink: purchaseOrder.responseToken 
          ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.kisheka.com'}/purchase-orders/respond/${purchaseOrder.responseToken}`
          : null,
        reminderType,
        daysSinceSent,
        supplier: supplier,
        projectId: purchaseOrder.projectId?.toString()
      });
    }

    // Send SMS to supplier
    let smsSent = false;
    let smsError = null;
    
    if (supplier.smsEnabled && supplier.phone) {
      try {
        const formattedPhone = formatPhoneNumber(supplier.phone);
        await sendSMS({
          to: formattedPhone,
          message: message
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

/**
 * Send delivery reminder to supplier for accepted purchase order
 * @param {Object} purchaseOrder - Purchase order document
 * @param {Object} supplier - Supplier document
 * @param {Object} options - Reminder options
 * @returns {Promise<Object>} Result of reminder send
 */
export async function sendDeliveryReminder(purchaseOrder, supplier, options = {}) {
  try {
    const {
      daysBeforeDelivery = 1, // Default: send reminder 1 day before delivery
      customMessage = null
    } = options;

    if (!purchaseOrder || !supplier) {
      throw new Error('Purchase order and supplier are required');
    }

    // Only send for accepted orders with delivery dates
    if (purchaseOrder.status !== 'order_accepted' && purchaseOrder.status !== 'ready_for_delivery') {
      return {
        sent: false,
        reason: `Order status is ${purchaseOrder.status}, not accepted or ready for delivery`
      };
    }

    if (!purchaseOrder.deliveryDate) {
      return {
        sent: false,
        reason: 'No delivery date set for this order'
      };
    }

    // Check if delivery reminder was already sent recently (within last 24 hours)
    const lastDeliveryReminder = purchaseOrder.lastDeliveryReminderSentAt;
    if (lastDeliveryReminder) {
      const hoursSinceLastReminder = (new Date() - new Date(lastDeliveryReminder)) / (1000 * 60 * 60);
      if (hoursSinceLastReminder < 24) {
        return {
          sent: false,
          reason: 'Delivery reminder sent recently (within 24 hours)',
          lastReminderAt: lastDeliveryReminder
        };
      }
    }

    // Check if delivery date is in the past
    const deliveryDate = new Date(purchaseOrder.deliveryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deliveryDate.setHours(0, 0, 0, 0);

    if (deliveryDate < today) {
      return {
        sent: false,
        reason: 'Delivery date is in the past'
      };
    }

    // Calculate days until delivery
    const daysUntilDelivery = Math.ceil((deliveryDate - today) / (1000 * 60 * 60 * 24));

    // Only send if within the reminder window
    if (daysUntilDelivery > daysBeforeDelivery + 1) {
      return {
        sent: false,
        reason: `Delivery is more than ${daysBeforeDelivery + 1} days away`
      };
    }

    // Build delivery reminder message
    let message;
    if (customMessage) {
      message = customMessage;
    } else {
      const db = await getDatabase();
      const materialRequest = purchaseOrder.materialRequestId 
        ? await db.collection('material_requests').findOne({ _id: purchaseOrder.materialRequestId })
        : null;

      // Use delivery reminder SMS generation
      message = generateDeliveryReminderSMS({
        purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
        materialName: purchaseOrder.materialName || materialRequest?.materialName || 'Materials',
        quantity: purchaseOrder.quantityOrdered || 0,
        unit: purchaseOrder.unit || materialRequest?.unit || '',
        deliveryDate: purchaseOrder.deliveryDate,
        supplier: supplier
      });
    }

    // Send SMS to supplier
    let smsSent = false;
    let smsError = null;
    
    if (supplier.smsEnabled && supplier.phone) {
      try {
        const formattedPhone = formatPhoneNumber(supplier.phone);
        await sendSMS({
          to: formattedPhone,
          message: message
        });
        smsSent = true;
      } catch (smsErr) {
        console.error('[Reminder Service] Delivery reminder SMS send failed:', smsErr);
        smsError = smsErr.message;
      }
    }

    // Update purchase order with delivery reminder tracking
    const db = await getDatabase();
    const reminderEntry = {
      sentAt: new Date(),
      type: 'delivery',
      daysUntilDelivery,
      daysBeforeDelivery,
      smsSent,
      smsError: smsError || null,
      message: message.substring(0, 500), // Store truncated message
    };

    await db.collection('purchase_orders').updateOne(
      { _id: purchaseOrder._id },
      {
        $set: {
          lastDeliveryReminderSentAt: new Date(),
          deliveryReminderCount: (purchaseOrder.deliveryReminderCount || 0) + 1,
          updatedAt: new Date()
        },
        $push: {
          deliveryReminders: reminderEntry
        }
      }
    );

    return {
      sent: true,
      smsSent,
      smsError,
      daysUntilDelivery,
      deliveryReminderCount: (purchaseOrder.deliveryReminderCount || 0) + 1
    };
  } catch (error) {
    console.error('[Reminder Service] Error sending delivery reminder:', error);
    throw error;
  }
}

/**
 * Get purchase orders that need delivery reminders
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Purchase orders needing delivery reminders
 */
export async function getOrdersNeedingDeliveryReminders(options = {}) {
  try {
    const {
      projectId = null,
      daysBeforeDelivery = 1, // Default: send reminder 1 day before
      maxReminders = 2 // Maximum number of delivery reminders to send
    } = options;

    const db = await getDatabase();

    // Calculate date range for delivery reminders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const reminderDate = new Date(today);
    reminderDate.setDate(reminderDate.getDate() + daysBeforeDelivery);
    reminderDate.setHours(23, 59, 59, 999);

    // Build query - orders accepted/ready for delivery with delivery dates in the reminder window
    const query = {
      status: { $in: ['order_accepted', 'ready_for_delivery'] },
      deletedAt: null,
      deliveryDate: {
        $gte: today,
        $lte: reminderDate
      },
      $or: [
        { lastDeliveryReminderSentAt: { $exists: false } }, // Never sent reminder
        { 
          lastDeliveryReminderSentAt: { 
            $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last reminder was at least 24 hours ago
          } 
        }
      ]
    };

    // Limit reminder count
    query.$or.push(
      { deliveryReminderCount: { $exists: false } },
      { deliveryReminderCount: { $lt: maxReminders } }
    );

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    // Get orders
    const orders = await db.collection('purchase_orders')
      .find(query)
      .toArray();

    // Calculate days until delivery for each order
    return orders.map(order => {
      const deliveryDate = new Date(order.deliveryDate);
      deliveryDate.setHours(0, 0, 0, 0);
      const daysUntilDelivery = Math.ceil((deliveryDate - today) / (1000 * 60 * 60 * 24));
      
      return {
        ...order,
        daysUntilDelivery
      };
    });
  } catch (error) {
    console.error('[Reminder Service] Error getting orders needing delivery reminders:', error);
    throw error;
  }
}

/**
 * Send delivery reminders for all orders that need them
 * @param {Object} options - Reminder options
 * @returns {Promise<Object>} Summary of reminders sent
 */
export async function sendPendingDeliveryReminders(options = {}) {
  try {
    const {
      projectId = null,
      daysBeforeDelivery = 1,
      maxReminders = 2,
      dryRun = false // If true, don't actually send, just return what would be sent
    } = options;

    const orders = await getOrdersNeedingDeliveryReminders({
      projectId,
      daysBeforeDelivery,
      maxReminders
    });

    const db = await getDatabase();
    const results = {
      attempted: 0,
      sent: 0,
      failed: 0,
      errors: []
    };

    for (const order of orders) {
      try {
        results.attempted++;
        
        if (dryRun) {
          results.sent++;
          continue;
        }

        const supplier = await db.collection('suppliers').findOne({
          _id: order.supplierId,
          status: 'active',
          deletedAt: null
        });

        if (!supplier) {
          results.failed++;
          results.errors.push({
            orderId: order._id.toString(),
            orderNumber: order.purchaseOrderNumber,
            reason: 'Supplier not found'
          });
          continue;
        }

        const result = await sendDeliveryReminder(order, supplier, {
          daysBeforeDelivery,
          customMessage: null
        });

        if (result.sent) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push({
            orderId: order._id.toString(),
            orderNumber: order.purchaseOrderNumber,
            reason: result.reason || 'Failed to send'
          });
        }
      } catch (error) {
        results.failed++;
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
        totalAttempted: results.attempted,
        totalSent: results.sent,
        totalFailed: results.failed
      },
      details: results,
      dryRun
    };
  } catch (error) {
    console.error('[Reminder Service] Error sending pending delivery reminders:', error);
    throw error;
  }
}












