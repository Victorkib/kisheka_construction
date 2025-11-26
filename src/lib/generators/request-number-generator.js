/**
 * Material Request Number Generator
 * Generates unique request numbers in format: REQ-YYYYMMDD-001
 */

import { getDatabase } from '@/lib/mongodb/connection';

/**
 * Generate unique material request number
 * Format: REQ-YYYYMMDD-001
 * @returns {Promise<string>} Unique request number
 */
export async function generateRequestNumber() {
  const db = await getDatabase();
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `REQ-${dateStr}-`;
  
  // Find last request number for today
  const lastRequest = await db.collection('material_requests')
    .findOne(
      { requestNumber: { $regex: `^${prefix}` } },
      { sort: { requestNumber: -1 } }
    );
  
  let sequence = 1;
  if (lastRequest) {
    const lastSeq = parseInt(lastRequest.requestNumber.slice(-3));
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }
  
  return `${prefix}${sequence.toString().padStart(3, '0')}`;
}

/**
 * Validate request number format
 * @param {string} requestNumber - Request number to validate
 * @returns {boolean} True if valid format
 */
export function isValidRequestNumber(requestNumber) {
  const pattern = /^REQ-\d{8}-\d{3}$/;
  return pattern.test(requestNumber);
}

