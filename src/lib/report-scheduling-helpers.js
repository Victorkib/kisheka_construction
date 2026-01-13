/**
 * Report Scheduling Helpers
 * Functions for managing scheduled report generation
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Create a scheduled report
 * @param {Object} scheduleData - Schedule data
 * @param {string} projectId - Project ID
 * @param {string} createdBy - User ID who created the schedule
 * @returns {Promise<Object>} Created schedule record
 */
export async function createScheduledReport(scheduleData, projectId, createdBy) {
  const db = await getDatabase();
  
  const {
    reportType,
    frequency,
    dayOfWeek,
    dayOfMonth,
    time,
    recipients,
    options,
  } = scheduleData;

  const schedule = {
    projectId: new ObjectId(projectId),
    reportType,
    frequency, // 'daily', 'weekly', 'monthly'
    dayOfWeek: dayOfWeek || null, // 0-6 for weekly
    dayOfMonth: dayOfMonth || null, // 1-31 for monthly
    time: time || '09:00', // HH:MM format
    recipients: Array.isArray(recipients) ? recipients.map(r => r.trim()).filter(r => r) : [],
    options: options || {},
    isActive: true,
    lastRun: null,
    nextRun: calculateNextRun(frequency, dayOfWeek, dayOfMonth, time),
    createdBy: new ObjectId(createdBy),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const result = await db.collection('scheduled_reports').insertOne(schedule);
  return { ...schedule, _id: result.insertedId };
}

/**
 * Calculate next run time for a schedule
 * @param {string} frequency - 'daily', 'weekly', 'monthly'
 * @param {number} dayOfWeek - Day of week (0-6) for weekly
 * @param {number} dayOfMonth - Day of month (1-31) for monthly
 * @param {string} time - Time in HH:MM format
 * @returns {Date} Next run date
 */
function calculateNextRun(frequency, dayOfWeek, dayOfMonth, time) {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  
  let nextRun = new Date();
  nextRun.setHours(hours, minutes, 0, 0);

  if (frequency === 'daily') {
    // If time has passed today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
  } else if (frequency === 'weekly') {
    // Find next occurrence of dayOfWeek
    const currentDay = now.getDay();
    let daysUntilNext = (dayOfWeek - currentDay + 7) % 7;
    if (daysUntilNext === 0 && nextRun <= now) {
      daysUntilNext = 7; // Next week
    }
    nextRun.setDate(nextRun.getDate() + daysUntilNext);
  } else if (frequency === 'monthly') {
    // Find next occurrence of dayOfMonth
    nextRun.setDate(dayOfMonth);
    if (nextRun <= now) {
      nextRun.setMonth(nextRun.getMonth() + 1);
      nextRun.setDate(dayOfMonth);
    }
  }

  return nextRun;
}

/**
 * Get scheduled reports for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Array of scheduled reports
 */
export async function getScheduledReports(projectId) {
  const db = await getDatabase();
  
  const schedules = await db.collection('scheduled_reports').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).sort({ createdAt: -1 }).toArray();

  return schedules;
}

/**
 * Update scheduled report
 * @param {string} scheduleId - Schedule ID
 * @param {Object} updateData - Update data
 * @returns {Promise<Object>} Updated schedule
 */
export async function updateScheduledReport(scheduleId, updateData) {
  const db = await getDatabase();
  
  const update = {
    ...updateData,
    updatedAt: new Date(),
  };

  // Recalculate nextRun if frequency/time changed
  if (updateData.frequency || updateData.dayOfWeek !== undefined || updateData.dayOfMonth !== undefined || updateData.time) {
    const existing = await db.collection('scheduled_reports').findOne({
      _id: new ObjectId(scheduleId),
    });
    
    if (existing) {
      update.nextRun = calculateNextRun(
        updateData.frequency || existing.frequency,
        updateData.dayOfWeek !== undefined ? updateData.dayOfWeek : existing.dayOfWeek,
        updateData.dayOfMonth !== undefined ? updateData.dayOfMonth : existing.dayOfMonth,
        updateData.time || existing.time
      );
    }
  }

  const result = await db.collection('scheduled_reports').findOneAndUpdate(
    { _id: new ObjectId(scheduleId) },
    { $set: update },
    { returnDocument: 'after' }
  );

  return result.value;
}

/**
 * Delete scheduled report
 * @param {string} scheduleId - Schedule ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteScheduledReport(scheduleId) {
  const db = await getDatabase();
  
  await db.collection('scheduled_reports').updateOne(
    { _id: new ObjectId(scheduleId) },
    {
      $set: {
        deletedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      },
    }
  );

  return true;
}
