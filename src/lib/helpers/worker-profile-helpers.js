/**
 * Worker Profile Helper Functions
 * Utilities for creating and managing worker profiles from labour entries
 */

import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb/connection';
import { createWorkerProfile, validateWorkerProfile } from '@/lib/schemas/worker-profile-schema';
import { generateEmployeeId } from '@/lib/generators/employee-id-generator';

/**
 * Create or get worker profile from labour entry data
 * If worker profile doesn't exist, creates it automatically
 * 
 * @param {Object} entryData - Labour entry data
 * @param {ObjectId} createdBy - User ID who created the entry
 * @param {Object} options - Options object
 * @param {Object} options.session - MongoDB session for transaction support
 * @param {Object} options.db - Database instance (if provided, uses this instead of getting new one)
 * @returns {Promise<Object>} Worker profile object with _id
 */
export async function createOrGetWorkerProfileFromEntry(entryData, createdBy, options = {}) {
  const { session, db: providedDb } = options;
  const db = providedDb || await getDatabase();
  
  const {
    workerId,
    workerName,
    workerType = 'internal',
    workerRole = 'skilled',
    skillType,
    hourlyRate,
    dailyRate,
  } = entryData;

  // If workerId is provided and valid, try to find existing profile
  if (workerId && ObjectId.isValid(workerId)) {
    const existingProfile = await db.collection('worker_profiles').findOne(
      {
        $or: [
          { _id: new ObjectId(workerId) },
          { userId: new ObjectId(workerId) },
        ],
        deletedAt: null,
      },
      session ? { session } : {}
    );

    if (existingProfile) {
      return existingProfile;
    }
  }

  // If no workerId or not found, check by worker name
  if (!workerName || workerName.trim().length < 2) {
    throw new Error('workerName is required and must be at least 2 characters');
  }

  const trimmedName = workerName.trim();
  
  // Check if worker profile exists by name (case-insensitive)
  const existingByName = await db.collection('worker_profiles').findOne(
    {
      workerName: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      deletedAt: null,
    },
    session ? { session } : {}
  );

  if (existingByName) {
    return existingByName;
  }

  // Worker profile doesn't exist, create it
  // Generate employee ID
  const employeeId = await generateEmployeeId({ session, db });

  // Prepare worker profile data from entry
  const workerProfileData = {
    employeeId,
    workerName: trimmedName,
    workerType: workerType || 'internal',
    skillTypes: skillType ? [skillType] : [],
    defaultHourlyRate: parseFloat(hourlyRate) || 0,
    defaultDailyRate: dailyRate ? parseFloat(dailyRate) : null,
    overtimeMultiplier: 1.5,
    employmentType: 'casual', // Default for auto-created workers
    status: 'active',
    // Optional fields that might be in entry
    phoneNumber: entryData.phoneNumber || null,
    email: entryData.email || null,
    nationalId: entryData.nationalId || null,
  };

  // Validate worker profile data
  const validation = validateWorkerProfile(workerProfileData);
  if (!validation.isValid) {
    throw new Error(`Worker profile validation failed: ${validation.errors.join(', ')}`);
  }

  // Create worker profile object
  const workerProfile = createWorkerProfile(workerProfileData);
  
  // Add createdBy timestamp (for tracking)
  workerProfile.createdBy = createdBy;
  workerProfile.createdAt = new Date();
  workerProfile.updatedAt = new Date();

  // Insert worker profile
  const insertOptions = session ? { session } : {};
  const result = await db.collection('worker_profiles').insertOne(workerProfile, insertOptions);

  const createdProfile = { ...workerProfile, _id: result.insertedId };

  return createdProfile;
}

/**
 * Get worker profile by ID or name
 * @param {string|ObjectId} workerId - Worker ID or userId
 * @param {string} workerName - Worker name (fallback)
 * @param {Object} options - Options object
 * @param {Object} options.session - MongoDB session
 * @param {Object} options.db - Database instance
 * @returns {Promise<Object|null>} Worker profile or null
 */
export async function getWorkerProfile(workerId, workerName = null, options = {}) {
  const { session, db: providedDb } = options;
  const db = providedDb || await getDatabase();

  const findOptions = session ? { session } : {};

  // Try by ID first
  if (workerId && ObjectId.isValid(workerId)) {
    const byId = await db.collection('worker_profiles').findOne(
      {
        $or: [
          { _id: new ObjectId(workerId) },
          { userId: new ObjectId(workerId) },
        ],
        deletedAt: null,
      },
      findOptions
    );

    if (byId) {
      return byId;
    }
  }

  // Try by name
  if (workerName && workerName.trim().length >= 2) {
    const byName = await db.collection('worker_profiles').findOne(
      {
        workerName: { $regex: new RegExp(`^${workerName.trim()}$`, 'i') },
        deletedAt: null,
      },
      findOptions
    );

    if (byName) {
      return byName;
    }
  }

  return null;
}
