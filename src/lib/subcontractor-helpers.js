/**
 * Subcontractor Helper Functions
 * Utilities for subcontractor management and calculations
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { calculateTotalPaid, calculateTotalUnpaid } from '@/lib/schemas/subcontractor-schema';

/**
 * Calculate subcontractor cost for a phase (paid amounts)
 * @param {string} phaseId - Phase ID
 * @returns {Promise<number>} Total subcontractor cost (paid amounts)
 */
export async function calculatePhaseSubcontractorCost(phaseId) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return 0;
  }
  
  const subcontractors = await db.collection('subcontractors').find({
    phaseId: new ObjectId(phaseId),
    deletedAt: null,
    status: { $in: ['active', 'completed'] }
  }).toArray();
  
  let totalPaid = 0;
  
  for (const sub of subcontractors) {
    if (sub.paymentSchedule && Array.isArray(sub.paymentSchedule)) {
      totalPaid += calculateTotalPaid(sub.paymentSchedule);
    }
  }
  
  return totalPaid;
}

/**
 * Calculate committed subcontractor cost (scheduled but not paid)
 * @param {string} phaseId - Phase ID
 * @returns {Promise<number>} Committed cost
 */
export async function calculatePhaseSubcontractorCommittedCost(phaseId) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return 0;
  }
  
  const subcontractors = await db.collection('subcontractors').find({
    phaseId: new ObjectId(phaseId),
    deletedAt: null,
    status: { $in: ['pending', 'active'] }
  }).toArray();
  
  let totalCommitted = 0;
  
  for (const sub of subcontractors) {
    if (sub.paymentSchedule && Array.isArray(sub.paymentSchedule) && sub.paymentSchedule.length > 0) {
      totalCommitted += calculateTotalUnpaid(sub.paymentSchedule);
    } else {
      // If no payment schedule, use contract value as committed
      totalCommitted += sub.contractValue || 0;
    }
  }
  
  return totalCommitted;
}

/**
 * Get subcontractor statistics for a phase
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Object>} Subcontractor statistics
 */
export async function getPhaseSubcontractorStatistics(phaseId) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return {
      total: 0,
      totalContractValue: 0,
      totalPaid: 0,
      totalUnpaid: 0,
      byStatus: {},
      byType: {},
      averagePerformance: 0
    };
  }
  
  const subcontractors = await db.collection('subcontractors').find({
    phaseId: new ObjectId(phaseId),
    deletedAt: null
  }).toArray();
  
  const stats = {
    total: subcontractors.length,
    totalContractValue: 0,
    totalPaid: 0,
    totalUnpaid: 0,
    byStatus: {},
    byType: {},
    totalPerformance: 0,
    performanceCount: 0,
    averagePerformance: 0
  };
  
  subcontractors.forEach(sub => {
    // Contract value
    stats.totalContractValue += sub.contractValue || 0;
    
    // Payments
    if (sub.paymentSchedule && Array.isArray(sub.paymentSchedule)) {
      stats.totalPaid += calculateTotalPaid(sub.paymentSchedule);
      stats.totalUnpaid += calculateTotalUnpaid(sub.paymentSchedule);
    }
    
    // By status
    const status = sub.status || 'unknown';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    
    // By type
    const type = sub.subcontractorType || 'other';
    stats.byType[type] = (stats.byType[type] || 0) + 1;
    
    // Performance
    if (sub.performance) {
      const ratings = [sub.performance.quality, sub.performance.timeliness, sub.performance.communication]
        .filter(r => r && r > 0);
      if (ratings.length > 0) {
        const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
        stats.totalPerformance += avg;
        stats.performanceCount++;
      }
    }
  });
  
  // Calculate average performance
  if (stats.performanceCount > 0) {
    stats.averagePerformance = stats.totalPerformance / stats.performanceCount;
  }
  
  return stats;
}

/**
 * Record a payment for a subcontractor
 * @param {string} subcontractorId - Subcontractor ID
 * @param {string} milestone - Milestone name
 * @param {number} amount - Payment amount
 * @param {string} paymentReference - Payment reference
 * @returns {Promise<Object>} Updated subcontractor
 */
export async function recordSubcontractorPayment(subcontractorId, milestone, amount, paymentReference) {
  const db = await getDatabase();
  
  if (!subcontractorId || !ObjectId.isValid(subcontractorId)) {
    throw new Error('Invalid subcontractor ID');
  }
  
  const subcontractor = await db.collection('subcontractors').findOne({
    _id: new ObjectId(subcontractorId),
    deletedAt: null
  });
  
  if (!subcontractor) {
    throw new Error('Subcontractor not found');
  }
  
  // Find the payment milestone
  const paymentSchedule = subcontractor.paymentSchedule || [];
  const paymentIndex = paymentSchedule.findIndex(p => 
    p.milestone === milestone && p.paid !== true
  );
  
  if (paymentIndex === -1) {
    throw new Error(`Payment milestone "${milestone}" not found or already paid`);
  }
  
  // Update payment
  paymentSchedule[paymentIndex] = {
    ...paymentSchedule[paymentIndex],
    paid: true,
    paidDate: new Date(),
    paymentReference: paymentReference || paymentSchedule[paymentIndex].paymentReference
  };
  
  const updated = await db.collection('subcontractors').findOneAndUpdate(
    { _id: new ObjectId(subcontractorId) },
    {
      $set: {
        paymentSchedule: paymentSchedule,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );
  
  return updated.value;
}


