/**
 * Professional Services Helpers
 * Utilities for professional services statistics and financial calculations
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Calculate professional services statistics for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Professional services statistics
 */
export async function calculateProjectProfessionalServicesStats(projectId) {
  const db = await getDatabase();

  // Get all professional service assignments for this project
  const assignments = await db.collection('professional_services').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).toArray();

  // Get all professional fees for this project
  const fees = await db.collection('professional_fees').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).toArray();

  // Get all professional activities for this project
  const activities = await db.collection('professional_activities').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).toArray();

  // Calculate totals
  const totalAssignments = assignments.length;
  const architectsCount = assignments.filter(a => a.type === 'architect').length;
  const engineersCount = assignments.filter(a => a.type === 'engineer').length;
  
  const activeFees = fees.filter((fee) => !['REJECTED', 'ARCHIVED'].includes(fee.status));
  const totalFees = activeFees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
  const paidFees = activeFees
    .filter(fee => fee.status === 'PAID')
    .reduce((sum, fee) => sum + (fee.amount || 0), 0);
  const pendingFees = activeFees
    .filter(fee => fee.status === 'PENDING' || fee.status === 'APPROVED')
    .reduce((sum, fee) => sum + (fee.amount || 0), 0);

  const totalActivities = activities.length;
  const siteVisits = activities.filter(a => a.activityType === 'site_visit').length;
  const inspections = activities.filter(a => a.activityType === 'inspection').length;
  const designRevisions = activities.filter(a => a.activityType === 'design_revision').length;

  // Calculate fees by professional type
  const architectFees = activeFees
    .filter(fee => {
      const assignment = assignments.find(a => a._id.toString() === fee.professionalServiceId?.toString());
      return assignment?.type === 'architect';
    })
    .reduce((sum, fee) => sum + (fee.amount || 0), 0);

  const engineerFees = activeFees
    .filter(fee => {
      const assignment = assignments.find(a => a._id.toString() === fee.professionalServiceId?.toString());
      return assignment?.type === 'engineer';
    })
    .reduce((sum, fee) => sum + (fee.amount || 0), 0);

  return {
    totalAssignments,
    architectsCount,
    engineersCount,
    totalFees,
    paidFees,
    pendingFees,
    totalActivities,
    siteVisits,
    inspections,
    designRevisions,
    architectFees,
    engineerFees,
  };
}

/**
 * Calculate professional services spending for a phase
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Object>} Professional services spending breakdown
 */
export async function calculatePhaseProfessionalServicesSpending(phaseId) {
  const db = await getDatabase();

  // Get professional fees for this phase (approved fees that have been converted to expenses)
  const fees = await db.collection('professional_fees').aggregate([
    {
      $match: {
        phaseId: new ObjectId(phaseId),
        deletedAt: null,
        status: { $in: ['APPROVED', 'PAID'] }, // Only approved/paid fees are converted to expenses
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  // Get professional activities count for this phase
  const activitiesCount = await db.collection('professional_activities').countDocuments({
    phaseId: new ObjectId(phaseId),
    deletedAt: null,
    status: { $in: ['approved', 'pending_approval'] },
  });

  // Get fees by professional type
  const allFees = await db.collection('professional_fees').find({
    phaseId: new ObjectId(phaseId),
    deletedAt: null,
    status: { $in: ['APPROVED', 'PAID'] },
  }).toArray();

  // Get assignments to determine types
  const assignmentIds = [...new Set(allFees.map(f => f.professionalServiceId?.toString()).filter(Boolean))];
  const assignments = assignmentIds.length > 0
    ? await db.collection('professional_services').find({
        _id: { $in: assignmentIds.map(id => new ObjectId(id)) },
      }).toArray()
    : [];

  const architectFees = allFees
    .filter(fee => {
      const assignment = assignments.find(a => a._id.toString() === fee.professionalServiceId?.toString());
      return assignment?.type === 'architect';
    })
    .reduce((sum, fee) => sum + (fee.amount || 0), 0);

  const engineerFees = allFees
    .filter(fee => {
      const assignment = assignments.find(a => a._id.toString() === fee.professionalServiceId?.toString());
      return assignment?.type === 'engineer';
    })
    .reduce((sum, fee) => sum + (fee.amount || 0), 0);

  return {
    total: fees[0]?.total || 0,
    count: fees[0]?.count || 0,
    activitiesCount,
    architectFees,
    engineerFees,
  };
}

/**
 * Get professional services breakdown for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Array of professional service assignments with statistics
 */
export async function getProjectProfessionalServicesBreakdown(projectId) {
  const db = await getDatabase();

  const assignments = await db.collection('professional_services').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).toArray();

  const breakdown = await Promise.all(
    assignments.map(async (assignment) => {
      // Get library entry
      const library = await db.collection('professional_services_library').findOne({
        _id: assignment.libraryId,
      });

      // Get activities count
      const activitiesCount = await db.collection('professional_activities').countDocuments({
        professionalServiceId: assignment._id,
        deletedAt: null,
      });

      // Get fees statistics
      const fees = await db.collection('professional_fees').find({
        professionalServiceId: assignment._id,
        deletedAt: null,
      }).toArray();

      const activeFees = fees.filter((fee) => !['REJECTED', 'ARCHIVED'].includes(fee.status));
      const totalFees = activeFees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
      const paidFees = activeFees
        .filter(fee => fee.status === 'PAID')
        .reduce((sum, fee) => sum + (fee.amount || 0), 0);

      return {
        ...assignment,
        library: library ? {
          _id: library._id,
          name: library.name,
          type: library.type,
        } : null,
        statistics: {
          activitiesCount,
          totalFees,
          paidFees,
          pendingFees: activeFees
            .filter((fee) => ['PENDING', 'APPROVED'].includes(fee.status))
            .reduce((sum, fee) => sum + (fee.amount || 0), 0),
        },
      };
    })
  );

  return breakdown;
}

/**
 * Calculate professional services committed cost for a project
 * Returns remaining contract commitments (contractValue - totalFees)
 * Only includes active assignments that haven't been fully paid
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Total remaining professional services commitments
 */
export async function calculateProfessionalServicesCommittedCost(projectId) {
  const db = await getDatabase();
  
  // Get all active professional service assignments
  const assignments = await db.collection('professional_services').find({
    projectId: new ObjectId(projectId),
    status: 'active', // Only active assignments count as commitments
    deletedAt: null,
  }).toArray();
  
  let totalCommitted = 0;
  
  for (const assignment of assignments) {
    const contractValue = assignment.contractValue || 0;
    const totalFees = assignment.totalFees || 0;
    
    // Remaining commitment = contract value minus fees already paid/committed
    // If totalFees >= contractValue, no remaining commitment
    const remainingCommitment = Math.max(0, contractValue - totalFees);
    totalCommitted += remainingCommitment;
  }
  
  return totalCommitted;
}

/**
 * Calculate professional services committed cost for a phase
 * Returns remaining contract commitments for assignments linked to this phase
 * @param {string} phaseId - Phase ID
 * @returns {Promise<number>} Total remaining professional services commitments for this phase
 */
export async function calculatePhaseProfessionalServicesCommittedCost(phaseId) {
  const db = await getDatabase();
  
  // Get phase to verify it exists
  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null,
  });
  
  if (!phase) {
    return 0;
  }
  
  // Get all active professional service assignments for this phase
  const assignments = await db.collection('professional_services').find({
    phaseId: new ObjectId(phaseId),
    status: 'active', // Only active assignments count as commitments
    deletedAt: null,
  }).toArray();
  
  let totalCommitted = 0;
  
  for (const assignment of assignments) {
    const contractValue = assignment.contractValue || 0;
    const totalFees = assignment.totalFees || 0;
    
    // Remaining commitment = contract value minus fees already paid/committed
    const remainingCommitment = Math.max(0, contractValue - totalFees);
    totalCommitted += remainingCommitment;
  }
  
  return totalCommitted;
}

