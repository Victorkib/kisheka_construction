/**
 * Financial Rollback Utilities
 * 
 * Handles financial rollback operations when entities are permanently deleted
 * Returns unused capital to investors and recalculates financial data
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { recalculateProjectFinances } from './financial-helpers';
import { getTotalAllocatedAmount } from './investment-allocation';
import { createAuditLog } from './audit-log';

/**
 * Return unused capital to investors when project is permanently deleted
 * @param {string} projectId - Project ID
 * @param {number} capitalBalance - Unused capital to return
 * @param {string} userId - User ID performing the action (for audit log)
 * @returns {Promise<Object>} Rollback summary
 */
export async function returnCapitalToInvestors(projectId, capitalBalance, userId) {
  if (!projectId || !ObjectId.isValid(projectId)) {
    throw new Error('Invalid project ID');
  }

  if (capitalBalance <= 0) {
    return {
      returned: 0,
      investorsUpdated: 0,
      summary: 'No unused capital to return',
    };
  }

  const db = await getDatabase();

  // Get project info
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
  });

  if (!project) {
    throw new Error('Project not found');
  }

  // Get all investors with allocations to this project
  const investors = await db
    .collection('investors')
    .find({
      status: 'ACTIVE',
      'projectAllocations.projectId': new ObjectId(projectId),
    })
    .toArray();

  if (investors.length === 0) {
    return {
      returned: 0,
      investorsUpdated: 0,
      summary: 'No investors with allocations to this project',
    };
  }

  // Calculate total allocated to this project
  let totalAllocatedToProject = 0;
  const investorAllocations = [];

  for (const investor of investors) {
    const allocation = (investor.projectAllocations || []).find(
      (alloc) => alloc.projectId && alloc.projectId.toString() === projectId.toString()
    );

    if (allocation && allocation.amount > 0) {
      totalAllocatedToProject += allocation.amount;
      investorAllocations.push({
        investor,
        allocation,
        amount: allocation.amount,
      });
    }
  }

  if (totalAllocatedToProject === 0) {
    return {
      returned: 0,
      investorsUpdated: 0,
      summary: 'No allocations found for this project',
    };
  }

  // Return capital proportionally based on allocation percentages
  const rollbackSummary = {
    returned: 0,
    investorsUpdated: 0,
    details: [],
  };

  for (const { investor, allocation, amount } of investorAllocations) {
    // Calculate proportional return
    const allocationPercentage = amount / totalAllocatedToProject;
    const returnAmount = capitalBalance * allocationPercentage;

    // Update investor: record a return entry but keep totalInvested unchanged
    const currentTotalInvested = investor.totalInvested || 0;
    const returnEntry = {
      amount: -returnAmount,
      date: new Date(),
      type: 'RETURN',
      notes: `Capital returned after project deletion (${project.projectName || 'project'}).`,
      receiptUrl: null,
      relatedProjectId: new ObjectId(projectId),
    };
    const updatedContributions = [...(investor.contributions || []), returnEntry];

    // Calculate new unallocated amount (for audit only)
    const remainingAllocations = (investor.projectAllocations || []).filter(
      (alloc) => alloc.projectId && alloc.projectId.toString() !== projectId.toString()
    );
    const remainingAllocated = remainingAllocations.reduce(
      (sum, alloc) => sum + (alloc.amount || 0),
      0
    );
    const newUnallocated = Math.max(0, currentTotalInvested - remainingAllocated);

    await db.collection('investors').updateOne(
      { _id: investor._id },
      {
        $set: {
          totalInvested: currentTotalInvested,
          contributions: updatedContributions,
          updatedAt: new Date(),
        },
      }
    );

    // Create audit log for capital return
    await createAuditLog({
      userId,
      action: 'RETURNED_CAPITAL',
      entityType: 'INVESTOR',
      entityId: investor._id.toString(),
      projectId: projectId.toString(),
      changes: {
        returnAmount: {
          oldValue: 0,
          newValue: returnAmount,
        },
        totalInvested: {
          oldValue: currentTotalInvested,
          newValue: currentTotalInvested,
        },
        unallocated: {
          oldValue: currentTotalInvested - (await getTotalAllocatedAmount(investor._id.toString())),
          newValue: newUnallocated,
        },
        contribution: {
          oldValue: null,
          newValue: {
            amount: returnEntry.amount,
            type: returnEntry.type,
            date: returnEntry.date,
            relatedProjectId: returnEntry.relatedProjectId,
          },
        },
        reason: {
          oldValue: null,
          newValue: 'Project permanently deleted',
        },
      },
    });

    rollbackSummary.returned += returnAmount;
    rollbackSummary.investorsUpdated += 1;
    rollbackSummary.details.push({
      investorId: investor._id.toString(),
      investorName: investor.name,
      returnAmount,
      allocationPercentage: (allocationPercentage * 100).toFixed(2) + '%',
    });
  }

  return {
    ...rollbackSummary,
    summary: `Returned KES ${rollbackSummary.returned.toLocaleString()} to ${rollbackSummary.investorsUpdated} investor(s)`,
  };
}

/**
 * Recalculate unallocated amount for an investor
 * Called after allocations are removed or updated
 * @param {string} investorId - Investor ID
 * @returns {Promise<number>} New unallocated amount
 */
export async function recalculateInvestorUnallocated(investorId) {
  if (!investorId || !ObjectId.isValid(investorId)) {
    throw new Error('Invalid investor ID');
  }

  const db = await getDatabase();

  const investor = await db.collection('investors').findOne({
    _id: new ObjectId(investorId),
  });

  if (!investor) {
    throw new Error('Investor not found');
  }

  const totalInvested = investor.totalInvested || 0;
  const totalAllocated = await getTotalAllocatedAmount(investorId);
  const unallocated = Math.max(0, totalInvested - totalAllocated);

  // Note: We don't update the investor document here because unallocated is calculated on-the-fly
  // But we return it for use in other functions
  return unallocated;
}

/**
 * Recalculate unallocated amounts for all investors
 * Useful after bulk allocation changes
 * @returns {Promise<Object>} Summary of recalculations
 */
export async function recalculateAllInvestorUnallocated() {
  const db = await getDatabase();

  const investors = await db
    .collection('investors')
    .find({ status: 'ACTIVE' })
    .toArray();

  const summary = {
    investorsProcessed: 0,
    errors: [],
  };

  for (const investor of investors) {
    try {
      await recalculateInvestorUnallocated(investor._id.toString());
      summary.investorsProcessed += 1;
    } catch (error) {
      summary.errors.push({
        investorId: investor._id.toString(),
        investorName: investor.name,
        error: error.message,
      });
    }
  }

  return summary;
}

