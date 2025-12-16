/**
 * Batch Number Generator
 * Generates unique batch numbers in format: BATCH-YYYYMMDD-001
 */

import { getDatabase } from '@/lib/mongodb/connection';

/**
 * Generate unique batch number
 * Format: BATCH-YYYYMMDD-001
 * @returns {Promise<string>} Unique batch number
 */
export async function generateBatchNumber() {
  const db = await getDatabase();
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `BATCH-${dateStr}-`;
  
  // Find last batch number for today
  const lastBatch = await db.collection('material_request_batches')
    .findOne(
      { batchNumber: { $regex: `^${prefix}` } },
      { sort: { batchNumber: -1 } }
    );
  
  let sequence = 1;
  if (lastBatch) {
    const lastSeq = parseInt(lastBatch.batchNumber.slice(-3));
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }
  
  return `${prefix}${sequence.toString().padStart(3, '0')}`;
}

/**
 * Validate batch number format
 * @param {string} batchNumber - Batch number to validate
 * @returns {boolean} True if valid format
 */
export function validateBatchNumber(batchNumber) {
  if (!batchNumber || typeof batchNumber !== 'string') {
    return false;
  }
  const pattern = /^BATCH-\d{8}-\d{3}$/;
  return pattern.test(batchNumber);
}

