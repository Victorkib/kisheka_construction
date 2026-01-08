/**
 * Purchase Order Number Generator
 * Generates unique purchase order numbers in format: PO-YYYYMMDD-001
 * Uses atomic counter pattern to prevent race conditions
 */

import { getDatabase } from '@/lib/mongodb/connection';

/**
 * Generate unique purchase order number
 * Format: PO-YYYYMMDD-001
 * Uses atomic findOneAndUpdate to prevent race conditions
 * @param {Object} options - Options object
 * @param {Object} options.session - MongoDB session for transaction support
 * @param {Object} options.db - Database instance (if provided, uses this instead of getting new one)
 * @returns {Promise<string>} Unique purchase order number
 */
export async function generatePurchaseOrderNumber(options = {}) {
  const { session, db: providedDb } = options;
  const db = providedDb || await getDatabase();
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `PO-${dateStr}-`;
  
  // Use atomic findOneAndUpdate with upsert to prevent race conditions
  // This ensures thread-safe sequence generation
  const counterCollection = db.collection('purchase_order_number_counters');
  const counterKey = `po_${dateStr}`;
  
  const updateOptions = session ? { session } : {};
  
  try {
    const result = await counterCollection.findOneAndUpdate(
      { _id: counterKey },
      { $inc: { sequence: 1 } },
      {
        upsert: true,
        returnDocument: 'after',
        ...updateOptions,
      }
    );
    
    // If result exists and has sequence, use it (atomic increment succeeded)
    if (result && result.sequence) {
      return `${prefix}${result.sequence.toString().padStart(3, '0')}`;
    }
    
    // Fallback: if counter doesn't exist yet or result is null, find the last purchase order number
    // This handles the case where upsert didn't return a document (shouldn't happen, but safety first)
    const lastOrder = await db.collection('purchase_orders')
      .findOne(
        { purchaseOrderNumber: { $regex: `^${prefix}` } },
        { sort: { purchaseOrderNumber: -1 }, ...updateOptions }
      );
    
    let sequence = 1;
    if (lastOrder) {
      const lastSeq = parseInt(lastOrder.purchaseOrderNumber.slice(-3));
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
        // Initialize counter with the next sequence
        await counterCollection.updateOne(
          { _id: counterKey },
          { $set: { sequence: sequence + 1 } },
          { upsert: true, ...updateOptions }
        );
        return `${prefix}${sequence.toString().padStart(3, '0')}`;
      }
    }
    // Initialize counter for first PO of the day
    await counterCollection.updateOne(
      { _id: counterKey },
      { $set: { sequence: 2 } },
      { upsert: true, ...updateOptions }
    );
    return `${prefix}001`;
  } catch (error) {
    // If counter operation fails, fallback to old method (for backward compatibility)
    console.warn('[generatePurchaseOrderNumber] Counter operation failed, using fallback:', error.message);
    
    const lastOrder = await db.collection('purchase_orders')
      .findOne(
        { purchaseOrderNumber: { $regex: `^${prefix}` } },
        { sort: { purchaseOrderNumber: -1 }, ...updateOptions }
      );
    
    let sequence = 1;
    if (lastOrder) {
      const lastSeq = parseInt(lastOrder.purchaseOrderNumber.slice(-3));
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }
    
    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  }
}

/**
 * Validate purchase order number format
 * @param {string} purchaseOrderNumber - Purchase order number to validate
 * @returns {boolean} True if valid format
 */
export function isValidPurchaseOrderNumber(purchaseOrderNumber) {
  const pattern = /^PO-\d{8}-\d{3}$/;
  return pattern.test(purchaseOrderNumber);
}

