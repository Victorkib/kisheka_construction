/**
 * Employee ID Generator
 * Generates unique employee IDs in format: WRK-YYYYMMDD-001
 */

import { getDatabase } from '@/lib/mongodb/connection';

/**
 * Generate unique employee ID
 * Format: WRK-YYYYMMDD-001
 * Uses atomic findOneAndUpdate to prevent race conditions
 * @param {Object} options - Options object
 * @param {Object} options.session - MongoDB session for transaction support
 * @param {Object} options.db - Database instance (if provided, uses this instead of getting new one)
 * @returns {Promise<string>} Unique employee ID
 */
export async function generateEmployeeId(options = {}) {
  const { session, db: providedDb } = options;
  const db = providedDb || await getDatabase();
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `WRK-${dateStr}-`;
  
  // Use atomic findOneAndUpdate with upsert to prevent race conditions
  // This ensures thread-safe sequence generation
  const counterCollection = db.collection('employee_id_counters');
  const counterKey = `employee_${dateStr}`;
  
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
    // Fallback: if counter doesn't exist yet, find the last employee ID
    const lastWorker = await db.collection('worker_profiles')
      .findOne(
        { employeeId: { $regex: `^${prefix}` }, deletedAt: null },
        { sort: { employeeId: -1 }, ...updateOptions }
      );
    
    if (lastWorker) {
      const lastSeq = parseInt(lastWorker.employeeId.slice(-3));
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
 * Validate employee ID format
 * @param {string} employeeId - Employee ID to validate
 * @returns {boolean} True if valid format
 */
export function isValidEmployeeIdFormat(employeeId) {
  if (!employeeId || typeof employeeId !== 'string') {
    return false;
  }
  // Format: WRK-YYYYMMDD-001
  const pattern = /^WRK-\d{8}-\d{3}$/;
  return pattern.test(employeeId);
}
