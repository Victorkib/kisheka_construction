/**
 * Investment Allocation Utilities
 * 
 * Handles project-specific investment allocation logic
 * Allows investors to allocate their investments across multiple projects
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Get investment allocations for an investor
 * @param {string} investorId - Investor ID
 * @returns {Promise<Array>} Array of allocation objects
 */
export async function getInvestorAllocations(investorId) {
  const db = await getDatabase();
  
  const investor = await db
    .collection('investors')
    .findOne({ _id: new ObjectId(investorId) });
  
  if (!investor) {
    return [];
  }
  
  // Allocations are stored in the investor document
  return investor.projectAllocations || [];
}

/**
 * Get total allocated amount for an investor across all projects
 * @param {string} investorId - Investor ID
 * @returns {Promise<number>} Total allocated amount
 */
export async function getTotalAllocatedAmount(investorId) {
  const allocations = await getInvestorAllocations(investorId);
  return allocations.reduce((sum, alloc) => sum + (alloc.amount || 0), 0);
}

/**
 * Get unallocated amount for an investor
 * @param {string} investorId - Investor ID
 * @returns {Promise<number>} Unallocated amount
 */
export async function getUnallocatedAmount(investorId) {
  const db = await getDatabase();
  
  const investor = await db
    .collection('investors')
    .findOne({ _id: new ObjectId(investorId) });
  
  if (!investor) {
    return 0;
  }
  
  const totalInvested = investor.totalInvested || 0;
  const totalAllocated = await getTotalAllocatedAmount(investorId);
  
  return Math.max(0, totalInvested - totalAllocated);
}

/**
 * Get investment allocations for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Array of allocation objects with investor info
 */
export async function getProjectAllocations(projectId) {
  const db = await getDatabase();
  
  // Normalize projectId to ObjectId for consistent comparison
  const targetProjectId = projectId instanceof ObjectId ? projectId : new ObjectId(projectId);
  const targetProjectIdString = targetProjectId.toString();
  
  const investors = await db
    .collection('investors')
    .find({ status: 'ACTIVE' })
    .toArray();
  
  const allocations = [];
  
  for (const investor of investors) {
    const investorAllocations = investor.projectAllocations || [];
    
    // Find allocation matching this project with robust ObjectId comparison
    const projectAllocation = investorAllocations.find((alloc) => {
      if (!alloc.projectId) return false;
      
      // Handle both ObjectId instances and string formats
      let allocProjectIdString;
      if (alloc.projectId instanceof ObjectId) {
        allocProjectIdString = alloc.projectId.toString();
      } else if (ObjectId.isValid(alloc.projectId)) {
        allocProjectIdString = new ObjectId(alloc.projectId).toString();
      } else {
        // If it's already a string, use it directly
        allocProjectIdString = String(alloc.projectId);
      }
      
      return allocProjectIdString === targetProjectIdString;
    });
    
    if (projectAllocation) {
      allocations.push({
        investorId: investor._id,
        investorName: investor.name,
        investorEmail: investor.email,
        amount: projectAllocation.amount || 0,
        percentage: projectAllocation.percentage || 0,
        allocatedAt: projectAllocation.allocatedAt || investor.createdAt,
        notes: projectAllocation.notes || null,
      });
    }
  }
  
  return allocations;
}

/**
 * Calculate project-specific totals from allocations
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Totals object with totalInvested, totalLoans, totalEquity
 */
export async function calculateProjectTotals(projectId) {
  const db = await getDatabase();
  
  // Normalize projectId to ObjectId for consistent comparison
  const targetProjectId = projectId instanceof ObjectId ? projectId : new ObjectId(projectId);
  const targetProjectIdString = targetProjectId.toString();
  
  const investors = await db
    .collection('investors')
    .find({ status: 'ACTIVE' })
    .toArray();
  
  let totalInvested = 0;
  let totalLoans = 0;
  let totalEquity = 0;
  
  for (const investor of investors) {
    const investorAllocations = investor.projectAllocations || [];
    
    // Find allocation matching this project with robust ObjectId comparison
    const projectAllocation = investorAllocations.find((alloc) => {
      if (!alloc.projectId) return false;
      
      // Handle both ObjectId instances and string formats
      let allocProjectIdString;
      if (alloc.projectId instanceof ObjectId) {
        allocProjectIdString = alloc.projectId.toString();
      } else if (ObjectId.isValid(alloc.projectId)) {
        allocProjectIdString = new ObjectId(alloc.projectId).toString();
      } else {
        // If it's already a string, use it directly
        allocProjectIdString = String(alloc.projectId);
      }
      
      return allocProjectIdString === targetProjectIdString;
    });
    
    if (projectAllocation) {
      const allocatedAmount = projectAllocation.amount || 0;
      totalInvested += allocatedAmount;
      
      // Calculate loans and equity based on investment type
      if (investor.investmentType === 'LOAN') {
        totalLoans += allocatedAmount;
      } else if (investor.investmentType === 'EQUITY') {
        totalEquity += allocatedAmount;
      } else if (investor.investmentType === 'MIXED') {
        // For MIXED, use the allocation percentage if provided, otherwise 50/50
        const loanPercentage = projectAllocation.loanPercentage || 0.5;
        totalLoans += allocatedAmount * loanPercentage;
        totalEquity += allocatedAmount * (1 - loanPercentage);
      }
    }
  }
  
  return {
    totalInvested,
    totalLoans,
    totalEquity,
  };
}

/**
 * Validate allocation amounts
 * @param {string} investorId - Investor ID
 * @param {Array} allocations - Array of allocation objects
 * @returns {Promise<Object>} Validation result with isValid and errors
 */
export async function validateAllocations(investorId, allocations) {
  const db = await getDatabase();
  
  const investor = await db
    .collection('investors')
    .findOne({ _id: new ObjectId(investorId) });
  
  if (!investor) {
    return {
      isValid: false,
      errors: ['Investor not found'],
    };
  }
  
  const totalInvested = investor.totalInvested || 0;
  const totalAllocated = allocations.reduce((sum, alloc) => sum + (alloc.amount || 0), 0);
  
  const errors = [];
  
  if (totalAllocated > totalInvested) {
    errors.push(
      `Total allocated amount (${totalAllocated.toLocaleString()}) exceeds total invested (${totalInvested.toLocaleString()})`
    );
  }
  
  // Validate project IDs exist
  for (const allocation of allocations) {
    if (!allocation.projectId || !ObjectId.isValid(allocation.projectId)) {
      errors.push(`Invalid project ID: ${allocation.projectId}`);
      continue;
    }
    
    const project = await db
      .collection('projects')
      .findOne({ _id: new ObjectId(allocation.projectId) });
    
    if (!project) {
      errors.push(`Project not found: ${allocation.projectId}`);
    }
    
    if (allocation.amount < 0) {
      errors.push(`Allocation amount cannot be negative for project ${allocation.projectId}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    totalInvested,
    totalAllocated,
    unallocated: totalInvested - totalAllocated,
  };
}

