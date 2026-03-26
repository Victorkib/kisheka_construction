/**
 * Professional Services Stats Helpers (Server-Only)
 *
 * NOTE: This module imports MongoDB and should only be used in server-side code
 * (API routes, server helpers). Client components must NOT import this file.
 */

import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb/connection';

export async function calculateProjectProfessionalServicesStats(projectId) {
  const db = await getDatabase();

  const projectObjectId = new ObjectId(projectId);

  const assignments = await db.collection('professional_services').find({
    projectId: projectObjectId,
    deletedAt: null,
  }).toArray();

  const fees = await db.collection('professional_fees').find({
    projectId: projectObjectId,
    deletedAt: null,
  }).toArray();

  const activities = await db.collection('professional_activities').find({
    projectId: projectObjectId,
    deletedAt: null,
  }).toArray();

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

export async function calculatePhaseProfessionalServicesSpending(phaseId) {
  const db = await getDatabase();

  const phaseObjectId = new ObjectId(phaseId);

  const fees = await db.collection('professional_fees').aggregate([
    {
      $match: {
        phaseId: phaseObjectId,
        deletedAt: null,
        status: { $in: ['APPROVED', 'PAID'] },
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

  const activitiesCount = await db.collection('professional_activities').countDocuments({
    phaseId: phaseObjectId,
    deletedAt: null,
    status: { $in: ['approved', 'pending_approval'] },
  });

  const allFees = await db.collection('professional_fees').find({
    phaseId: phaseObjectId,
    deletedAt: null,
    status: { $in: ['APPROVED', 'PAID'] },
  }).toArray();

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

  const projectObjectId = new ObjectId(projectId);

  const assignments = await db.collection('professional_services').find({
    projectId: projectObjectId,
    deletedAt: null,
  }).toArray();

  const breakdown = await Promise.all(
    assignments.map(async (assignment) => {
      const library = await db.collection('professional_services_library').findOne({
        _id: assignment.libraryId,
      });

      const activitiesCount = await db.collection('professional_activities').countDocuments({
        professionalServiceId: assignment._id,
        deletedAt: null,
      });

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
        library: library
          ? {
              _id: library._id,
              name: library.name,
              type: library.type,
            }
          : null,
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

  const assignments = await db.collection('professional_services').find({
    projectId: new ObjectId(projectId),
    status: 'active',
    deletedAt: null,
  }).toArray();

  let totalCommitted = 0;

  for (const assignment of assignments) {
    const contractValue = assignment.contractValue || 0;
    const totalFees = assignment.totalFees || 0;
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

  const phaseObjectId = new ObjectId(phaseId);

  const phase = await db.collection('phases').findOne({
    _id: phaseObjectId,
    deletedAt: null,
  });

  if (!phase) {
    return 0;
  }

  const assignments = await db.collection('professional_services').find({
    phaseId: phaseObjectId,
    status: 'active',
    deletedAt: null,
  }).toArray();

  let totalCommitted = 0;

  for (const assignment of assignments) {
    const contractValue = assignment.contractValue || 0;
    const totalFees = assignment.totalFees || 0;
    const remainingCommitment = Math.max(0, contractValue - totalFees);
    totalCommitted += remainingCommitment;
  }

  return totalCommitted;
}


