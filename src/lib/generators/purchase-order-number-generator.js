/**
 * Purchase Order Number Generator
 * Generates unique purchase order numbers in format: PO-YYYYMMDD-001
 */

import { getDatabase } from '@/lib/mongodb/connection';

/**
 * Generate unique purchase order number
 * Format: PO-YYYYMMDD-001
 * @returns {Promise<string>} Unique purchase order number
 */
export async function generatePurchaseOrderNumber() {
  const db = await getDatabase();
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `PO-${dateStr}-`;
  
  // Find last purchase order number for today
  const lastOrder = await db.collection('purchase_orders')
    .findOne(
      { purchaseOrderNumber: { $regex: `^${prefix}` } },
      { sort: { purchaseOrderNumber: -1 } }
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

/**
 * Validate purchase order number format
 * @param {string} purchaseOrderNumber - Purchase order number to validate
 * @returns {boolean} True if valid format
 */
export function isValidPurchaseOrderNumber(purchaseOrderNumber) {
  const pattern = /^PO-\d{8}-\d{3}$/;
  return pattern.test(purchaseOrderNumber);
}

