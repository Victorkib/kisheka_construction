/**
 * Material Request Number Generator
 * Generates unique request numbers in format: REQ-YYYYMMDD-001
 */

import { getDatabase } from '@/lib/mongodb/connection';

/**
 * Generate unique material request number
 * Format: REQ-YYYYMMDD-001
 * Uses atomic findOneAndUpdate to prevent race conditions
 * @param {Object} options - Options object
 * @param {Object} options.session - MongoDB session for transaction support
 * @param {Object} options.db - Database instance (if provided, uses this instead of getting new one)
 * @returns {Promise<string>} Unique request number
 */
export async function generateRequestNumber(options = {}) {
  const { session, db: providedDb } = options;
  const db = providedDb || await getDatabase();
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `REQ-${dateStr}-`;
  
  // Use atomic findOneAndUpdate with upsert to prevent race conditions
  // This ensures thread-safe sequence generation
  const counterCollection = db.collection('request_number_counters');
  const counterKey = `request_${dateStr}`;
  
  const updateOptions = session ? { session } : {};
  
  const result = await counterCollection.findOneAndUpdate(
    { _id: counterKey },
    { $inc: { sequence: 1 } },
    {
      upsert: true,
      returnDocument: 'after',
      ...updateOptions,
    }
  );
  
  let sequence = 1;
  if (result && result.sequence) {
    sequence = result.sequence;
  } else {
    // Fallback: if counter doesn't exist yet, find the last request number
    const lastRequest = await db.collection('material_requests')
      .findOne(
        { requestNumber: { $regex: `^${prefix}` } },
        { sort: { requestNumber: -1 }, ...updateOptions }
      );
    
    if (lastRequest) {
      const lastSeq = parseInt(lastRequest.requestNumber.slice(-3));
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
    // Initialize counter
    await counterCollection.updateOne(
      { _id: counterKey },
      { $set: { sequence: 2 } },
      { upsert: true, ...updateOptions }
    );
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

