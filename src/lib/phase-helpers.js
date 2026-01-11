/**
 * Phase Helper Functions
 * Utilities for phase management and initialization
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { createPhase, DEFAULT_PHASES, PHASE_TYPES } from '@/lib/schemas/phase-schema';
import { getBudgetTotal, isEnhancedBudget } from '@/lib/schemas/budget-schema';
import { MATERIAL_APPROVED_STATUSES } from '@/lib/status-constants';
import { calculatePhaseEquipmentCost, calculatePhaseEquipmentCommittedCost } from '@/lib/equipment-helpers';
import { calculatePhaseSubcontractorCost, calculatePhaseSubcontractorCommittedCost } from '@/lib/subcontractor-helpers';
import { calculatePhaseCompletionFromWorkItems } from '@/lib/work-item-helpers';

/**
 * Get all phase IDs affected by a purchase order
 * Used to update phase committed costs after PO acceptance/rejection
 * @param {Object} purchaseOrder - Purchase order document
 * @returns {Promise<Array<string>>} Array of phase IDs
 */
export async function getPhaseIdsFromPurchaseOrder(purchaseOrder) {
  const db = await getDatabase();
  const phaseIds = new Set();
  
  // Strategy 1: PO has phaseId directly
  if (purchaseOrder.phaseId && ObjectId.isValid(purchaseOrder.phaseId)) {
    phaseIds.add(purchaseOrder.phaseId.toString());
  }
  
  // Strategy 2: Get phaseId from material requests
  if (purchaseOrder.isBulkOrder && purchaseOrder.materialRequestIds && Array.isArray(purchaseOrder.materialRequestIds)) {
    // Bulk order: get phaseIds from all material requests
    const materialRequests = await db.collection('material_requests').find({
      _id: { $in: purchaseOrder.materialRequestIds.map(id => new ObjectId(id)) },
      deletedAt: null
    }).toArray();
    
    for (const req of materialRequests) {
      if (req.phaseId && ObjectId.isValid(req.phaseId)) {
        phaseIds.add(req.phaseId.toString());
      }
    }
  } else if (purchaseOrder.materialRequestId && ObjectId.isValid(purchaseOrder.materialRequestId)) {
    // Single order: get phaseId from material request
    const materialRequest = await db.collection('material_requests').findOne({
      _id: purchaseOrder.materialRequestId,
      deletedAt: null
    });
    
    if (materialRequest?.phaseId && ObjectId.isValid(materialRequest.phaseId)) {
      phaseIds.add(materialRequest.phaseId.toString());
    }
  }
  
  return Array.from(phaseIds);
}

/**
 * Update phase committed costs for all phases affected by a purchase order
 * This should be called after updateCommittedCost() to keep phase financials in sync
 * @param {Object} purchaseOrder - Purchase order document
 * @returns {Promise<void>}
 */
export async function updatePhaseCommittedCostsForPO(purchaseOrder) {
  try {
    // Edge case: If purchaseOrder is null or undefined, skip
    if (!purchaseOrder) {
      console.warn('[updatePhaseCommittedCostsForPO] Purchase order is null or undefined, skipping phase update');
      return;
    }

    const phaseIds = await getPhaseIdsFromPurchaseOrder(purchaseOrder);
    
    // Edge case: If no phaseIds found, log but don't error (PO might not have phaseId yet)
    if (phaseIds.length === 0) {
      console.warn(`[updatePhaseCommittedCostsForPO] No phase IDs found for PO ${purchaseOrder._id || purchaseOrder.purchaseOrderNumber || 'unknown'}. PO may not have phaseId set.`);
      return;
    }
    
    // Recalculate spending for each affected phase
    // This updates committed cost, actual spending, and remaining budget
    await Promise.all(
      phaseIds.map(phaseId =>
        recalculatePhaseSpending(phaseId).catch((error) => {
          console.error(`[updatePhaseCommittedCostsForPO] Phase recalculation failed for phase ${phaseId}:`, error);
          // Don't throw - continue with other phases
        })
      )
    );
  } catch (error) {
    console.error('[updatePhaseCommittedCostsForPO] Error updating phase committed costs:', error);
    // Don't throw - this is non-critical for PO acceptance
  }
}

/**
 * Initialize default phases for a project
 * @param {string} projectId - Project ID
 * @param {Object} project - Project object (optional, will fetch if not provided)
 * @returns {Promise<Array>} Array of created phases
 */
export async function initializeDefaultPhases(projectId, project = null) {
  const db = await getDatabase();
  
  // Get project if not provided
  if (!project) {
    project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      deletedAt: null
    });
  }
  
  if (!project) {
    throw new Error('Project not found');
  }
  
  // Check if phases already exist
  const existingPhases = await db.collection('phases').countDocuments({
    projectId: new ObjectId(projectId),
    deletedAt: null
  });
  
  if (existingPhases > 0) {
    // Phases already exist, return existing ones
    return await db.collection('phases').find({
      projectId: new ObjectId(projectId),
      deletedAt: null
    }).sort({ sequence: 1 }).toArray();
  }
  
  // Get project budget for allocation
  const projectBudget = project.budget || {};
  
  // CRITICAL FIX: Only allocate Direct Construction Costs (DCC) to phases
  // Pre-construction, indirect costs, and contingency are NOT allocated to phases
  const { isEnhancedBudget } = await import('@/lib/schemas/budget-schema');
  let dccBudget = 0;
  
  if (isEnhancedBudget(projectBudget)) {
    // Enhanced budget: Use directConstructionCosts
    dccBudget = projectBudget.directConstructionCosts || 0;
  } else {
    // Legacy budget: Estimate DCC (total - estimated pre-construction - indirect - contingency)
    const totalBudget = getBudgetTotal(projectBudget);
    const estimatedPreConstruction = totalBudget * 0.05; // 5% estimate
    const estimatedIndirect = totalBudget * 0.05; // 5% estimate
    const estimatedContingency = projectBudget.contingency || (totalBudget * 0.05); // 5% estimate
    dccBudget = Math.max(0, totalBudget - estimatedPreConstruction - estimatedIndirect - estimatedContingency);
  }
  
  // Validate DCC budget exists and is positive
  if (dccBudget <= 0) {
    throw new Error(
      'Cannot initialize phases: Direct Construction Costs (DCC) is zero or not set. ' +
      'Please set a project budget with Direct Construction Costs before initializing phases, or initialize phases manually after setting the budget.'
    );
  }
  
  // Calculate phase allocations based on typical construction percentages
  // ONLY allocate DCC to phases (pre-construction tracked separately via initial_expenses)
  // Percentages sum to 100% of DCC
  const phaseAllocations = {
    basement: dccBudget * 0.15,            // 15% of DCC for basement
    superstructure: dccBudget * 0.65,      // 65% of DCC for superstructure
    finishing: dccBudget * 0.15,           // 15% of DCC for finishing
    finalSystems: dccBudget * 0.05         // 5% of DCC for final systems
    // Total: 100% of DCC
  };
  
  // Validate that phase allocations sum correctly (should be 100% = dccBudget)
  const totalPhaseAllocations = Object.values(phaseAllocations).reduce((sum, val) => sum + val, 0);
  const allocationTolerance = 0.01; // Allow 1 cent tolerance for floating point errors
  
  if (Math.abs(totalPhaseAllocations - dccBudget) > allocationTolerance) {
    // Adjust allocations proportionally to ensure they sum to exactly dccBudget
    const adjustmentFactor = dccBudget / totalPhaseAllocations;
    Object.keys(phaseAllocations).forEach(key => {
      phaseAllocations[key] = phaseAllocations[key] * adjustmentFactor;
    });
    
    // Recalculate to verify
    const recalculatedTotal = Object.values(phaseAllocations).reduce((sum, val) => sum + val, 0);
    if (Math.abs(recalculatedTotal - dccBudget) > allocationTolerance) {
      throw new Error(
        `Phase budget allocation error: Total phase allocations (${recalculatedTotal.toLocaleString()}) ` +
        `do not match Direct Construction Costs (DCC) (${dccBudget.toLocaleString()}). ` +
        `Difference: ${Math.abs(recalculatedTotal - dccBudget).toLocaleString()}`
      );
    }
  }
  
  // Validate that no single phase allocation exceeds DCC budget
  for (const [phaseName, allocation] of Object.entries(phaseAllocations)) {
    if (allocation > dccBudget) {
      throw new Error(
        `Phase budget validation failed: ${phaseName} allocation (${allocation.toLocaleString()}) ` +
        `exceeds Direct Construction Costs (DCC) (${dccBudget.toLocaleString()})`
      );
    }
  }
  
  // Create phases from templates
  const createdPhases = [];
  
  for (const template of DEFAULT_PHASES) {
    // Map template to allocation
    // NOTE: Phase 0 (Pre-Construction) removed - pre-construction tracked via initial_expenses
    let allocation = 0;
    if (template.phaseCode === 'PHASE-01') {
      allocation = phaseAllocations.basement;
    } else if (template.phaseCode === 'PHASE-02') {
      allocation = phaseAllocations.superstructure;
    } else if (template.phaseCode === 'PHASE-03') {
      allocation = phaseAllocations.finishing;
    } else if (template.phaseCode === 'PHASE-04') {
      allocation = phaseAllocations.finalSystems;
    }
    
    // Validate individual phase allocation
    if (allocation < 0) {
      throw new Error(
        `Invalid phase allocation for ${template.phaseName || template.phaseCode}: ` +
        `allocation cannot be negative (${allocation})`
      );
    }
    
    // Create phase with budget allocation
    const phaseData = {
      ...template,
      projectId: new ObjectId(projectId),
      budgetAllocation: {
        total: Math.round(allocation * 100) / 100, // Round to 2 decimal places
        materials: Math.round(allocation * 0.65 * 100) / 100,      // Estimate 65% materials
        labour: Math.round(allocation * 0.25 * 100) / 100,         // Estimate 25% labour
        equipment: Math.round(allocation * 0.05 * 100) / 100,      // Estimate 5% equipment
        subcontractors: Math.round(allocation * 0.03 * 100) / 100, // Estimate 3% subcontractors
        contingency: 0  // Contingency NOT allocated to phases - stays at project level
      }
    };
    
    const phase = createPhase(phaseData, new ObjectId(projectId));
    
    // Insert phase
    const result = await db.collection('phases').insertOne(phase);
    createdPhases.push({ ...phase, _id: result.insertedId });
  }
  
  // Final validation: Verify total phase budgets match DCC budget (not total project budget)
  const totalCreatedPhaseBudgets = createdPhases.reduce((sum, p) => sum + (p.budgetAllocation?.total || 0), 0);
  if (Math.abs(totalCreatedPhaseBudgets - dccBudget) > allocationTolerance) {
    // Log warning but don't fail - phases are already created
    console.warn(
      `Phase budget validation warning: Total created phase budgets (${totalCreatedPhaseBudgets.toLocaleString()}) ` +
      `do not exactly match Direct Construction Costs (DCC) (${dccBudget.toLocaleString()}). ` +
      `Difference: ${Math.abs(totalCreatedPhaseBudgets - dccBudget).toLocaleString()}`
    );
  }
  
  return createdPhases;
}

/**
 * Get phases for a project with financial summaries
 * @param {string} projectId - Project ID
 * @param {boolean} includeFinancials - Include financial summaries
 * @returns {Promise<Array>} Array of phases
 */
export async function getProjectPhases(projectId, includeFinancials = true) {
  const db = await getDatabase();
  
  const phases = await db.collection('phases').find({
    projectId: new ObjectId(projectId),
    deletedAt: null
  }).sort({ sequence: 1 }).toArray();
  
  if (includeFinancials) {
    const { calculatePhaseFinancialSummary } = await import('@/lib/schemas/phase-schema');
    
    // Calculate actual spending for each phase
    for (const phase of phases) {
      // Get materials spending
      const materialsSpending = await db.collection('materials').aggregate([
        {
          $match: {
            phaseId: phase._id,
            deletedAt: null,
            status: { $in: ['APPROVED', 'RECEIVED', 'USED'] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalCost' }
          }
        }
      ]).toArray();
      
      // Get expenses spending
      const expensesSpending = await db.collection('expenses').aggregate([
        {
          $match: {
            phaseId: phase._id,
            deletedAt: null,
            status: { $in: ['APPROVED'] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]).toArray();
      
      // Calculate professional services spending for this phase
      const { calculatePhaseProfessionalServicesSpending } = await import('@/lib/professional-services-helpers');
      const professionalServicesSpending = await calculatePhaseProfessionalServicesSpending(phase._id.toString());
      
      // TODO: Add labour spending when labour system is implemented
      const labourSpending = 0;
      
      // TODO: Add equipment spending when equipment system is implemented
      const equipmentSpending = 0;
      
      // TODO: Add subcontractor spending when subcontractor system is implemented
      const subcontractorSpending = 0;
      
      // Update phase with actual spending (professional fees are tracked separately for visibility)
      phase.actualSpending = {
        materials: materialsSpending[0]?.total || 0,
        expenses: expensesSpending[0]?.total || 0,
        professionalServices: professionalServicesSpending.total || 0, // Tracked separately for visibility
        labour: labourSpending,
        equipment: equipmentSpending,
        subcontractors: subcontractorSpending,
        total: (materialsSpending[0]?.total || 0) + 
               (expensesSpending[0]?.total || 0) + 
               (professionalServicesSpending.total || 0) + 
               labourSpending + 
               equipmentSpending + 
               subcontractorSpending
      };
      
      // Add professional services breakdown
      phase.professionalServices = {
        totalFees: professionalServicesSpending.total || 0,
        activitiesCount: professionalServicesSpending.activitiesCount || 0,
        architectFees: professionalServicesSpending.architectFees || 0,
        engineerFees: professionalServicesSpending.engineerFees || 0,
      };
      
      phase.financialStates = {
        ...phase.financialStates,
        actual: phase.actualSpending.total,
        remaining: Math.max(0, (phase.budgetAllocation?.total || 0) - phase.actualSpending.total - (phase.financialStates?.committed || 0))
      };
      
      // Calculate financial summary
      phase.financialSummary = calculatePhaseFinancialSummary(phase);
    }
  }
  
  return phases;
}

/**
 * Calculate estimated cost for a phase
 * Estimated costs are from approved material requests that haven't been converted to purchase orders yet
 * @param {string} phaseId - Phase ID
 * @returns {Promise<number>} Estimated cost amount
 */
export async function calculatePhaseEstimatedCost(phaseId) {
  const db = await getDatabase();
  
  // Get phase to get projectId
  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null
  });
  
  if (!phase) {
    return 0;
  }
  
  // Phase Management: Find approved material requests for this phase that haven't been converted to POs
  // Filter by phaseId directly from material request for accuracy
  const approvedRequests = await db.collection('material_requests').find({
    projectId: phase.projectId,
    phaseId: new ObjectId(phaseId), // Filter by phaseId for accurate phase-level estimated costs
    status: 'approved', // Only 'approved', not 'converted_to_order'
    deletedAt: null,
    estimatedCost: { $exists: true, $ne: null, $gt: 0 }
  }).toArray();
  
  let estimatedCost = 0;
  
  // For each approved request, check if it's been converted to PO
  // If not converted, include in estimated cost
  for (const request of approvedRequests) {
    // Check if request has been converted to PO
    if (request.linkedPurchaseOrderId) {
      continue; // Already converted, skip
    }
    
    // Check if any materials exist for this request with this phaseId
    // If materials exist, the request is no longer estimated (it's actual)
    const materialCount = await db.collection('materials').countDocuments({
      materialRequestId: request._id,
      phaseId: new ObjectId(phaseId),
      deletedAt: null,
      status: { $in: MATERIAL_APPROVED_STATUSES }
    });
    
    // If no materials exist and not converted to PO, this request is still in estimated state
    if (materialCount === 0) {
      estimatedCost += request.estimatedCost || 0;
    }
  }
  
  return estimatedCost;
}

/**
 * Calculate committed cost for a phase
 * Committed costs are from purchase orders that are accepted but not yet fulfilled (no materials created)
 * AND from professional service contracts (remaining contract commitments)
 * 
 * Note: Materials created from POs are automatically approved, so once a material exists with status 'approved',
 * the PO is considered fulfilled and excluded from committed cost.
 * 
 * @param {string} phaseId - Phase ID
 * @returns {Promise<number>} Committed cost amount
 */
export async function calculatePhaseCommittedCost(phaseId) {
  const db = await getDatabase();
  
  // Get phase to get projectId
  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null
  });
  
  if (!phase) {
    return 0;
  }
  
  // Phase Management: Find purchase orders for this phase
  // Filter by phaseId directly from PO for accuracy (when phaseId exists on PO)
  // Also include POs without phaseId for backward compatibility (will be filtered by material phaseId)
  const committedPOs = await db.collection('purchase_orders').find({
    projectId: phase.projectId,
    $or: [
      { phaseId: new ObjectId(phaseId) }, // POs with this phaseId
      { phaseId: { $exists: false } }, // POs without phaseId (backward compatibility)
      { phaseId: null } // POs with null phaseId
    ],
    status: { $in: ['order_accepted', 'ready_for_delivery'] },
    deletedAt: null
  }).toArray();
  
  let committedCost = 0;
  
  // Get professional services committed cost for this phase
  const { calculatePhaseProfessionalServicesCommittedCost } = await import('@/lib/professional-services-helpers');
  const professionalServicesCommitted = await calculatePhaseProfessionalServicesCommittedCost(phaseId);
  committedCost += professionalServicesCommitted;
  
  // Phase 4: Add equipment committed costs
  const equipmentCommitted = await calculatePhaseEquipmentCommittedCost(phaseId);
  committedCost += equipmentCommitted;
  
  // Phase 5: Add subcontractor committed costs
  const subcontractorCommitted = await calculatePhaseSubcontractorCommittedCost(phaseId);
  committedCost += subcontractorCommitted;
  
  // For each PO, check if it's linked to materials with this phaseId
  // If no materials exist yet, the PO is still committed
  for (const po of committedPOs) {
    // If PO has phaseId, only process if it matches this phase
    if (po.phaseId && po.phaseId.toString() !== phaseId) {
      continue; // Skip POs for other phases
    }
    
    let isFulfilled = false;
    
    if (po.isBulkOrder && po.materialRequestIds) {
      // Bulk order: check if any materials exist from this PO with this phaseId
      const materialCount = await db.collection('materials').countDocuments({
        linkedPurchaseOrderId: po._id,
        phaseId: new ObjectId(phaseId),
        deletedAt: null,
        status: { $in: MATERIAL_APPROVED_STATUSES }
      });
      
      if (materialCount > 0) {
        isFulfilled = true;
      }
    } else if (po.linkedMaterialId) {
      // Single order: check if the linked material has this phaseId
      const material = await db.collection('materials').findOne({
        _id: po.linkedMaterialId,
        phaseId: new ObjectId(phaseId),
        deletedAt: null,
        status: { $in: MATERIAL_APPROVED_STATUSES }
      });
      
      if (material) {
        isFulfilled = true;
      }
    } else {
      // Check if any materials exist with this PO and phaseId
      const materialCount = await db.collection('materials').countDocuments({
        linkedPurchaseOrderId: po._id,
        phaseId: new ObjectId(phaseId),
        deletedAt: null,
        status: { $in: MATERIAL_APPROVED_STATUSES }
      });
      
      if (materialCount > 0) {
        isFulfilled = true;
      }
    }
    
    // If not fulfilled, add to committed cost
    if (!isFulfilled) {
      // For bulk orders, we need to check which material requests belong to this phase
      if (po.isBulkOrder && po.materialRequestIds) {
        // Get material requests for this PO
        const materialRequests = await db.collection('material_requests').find({
          _id: { $in: po.materialRequestIds.map(id => new ObjectId(id)) },
          deletedAt: null
        }).toArray();
        
        // Check if any of these requests have this phaseId
        const phaseRequests = materialRequests.filter(req => 
          req.phaseId && req.phaseId.toString() === phaseId
        );
        
        // If no requests for this phase, skip
        if (phaseRequests.length === 0) {
          continue;
        }
        
        // CRITICAL FIX: Calculate phase portion of committed cost
        // For bulk orders, split cost proportionally based on material costs per phase
        if (po.materials && Array.isArray(po.materials) && po.materials.length > 0) {
          // Calculate total cost for materials in this phase
          let phaseCost = 0;
          for (const material of po.materials) {
            // Find corresponding material request
            const materialRequest = materialRequests.find(req => 
              req._id.toString() === (material.materialRequestId?.toString() || material._id?.toString())
            );
            
            // If this material belongs to this phase, add its cost
            if (materialRequest && materialRequest.phaseId && materialRequest.phaseId.toString() === phaseId) {
              const materialTotalCost = (material.totalCost || 0) || 
                                       ((material.unitCost || 0) * (material.quantity || 0));
              phaseCost += materialTotalCost;
            }
          }
          
          // Add phase portion to committed cost
          committedCost += phaseCost;
        } else {
          // Fallback: If materials array not available, use proportional allocation
          // This is less accurate but better than including full cost
          const phaseProportion = phaseRequests.length / materialRequests.length;
          const estimatedPhaseCost = (po.totalCost || 0) * phaseProportion;
          committedCost += estimatedPhaseCost;
        }
      } else {
        // Single order - check if material request has this phaseId
        if (po.materialRequestId) {
          const materialRequest = await db.collection('material_requests').findOne({
            _id: po.materialRequestId,
            deletedAt: null
          });
          
          // If material request has this phaseId, or PO has this phaseId, include in committed cost
          if ((materialRequest?.phaseId && materialRequest.phaseId.toString() === phaseId) || 
              (po.phaseId && po.phaseId.toString() === phaseId)) {
            committedCost += po.totalCost || 0;
          }
        } else if (po.phaseId && po.phaseId.toString() === phaseId) {
          // PO has phaseId matching this phase
          committedCost += po.totalCost || 0;
        }
      }
    }
  }
  
  return committedCost;
}

/**
 * Update phase spending when material/expense is created/updated/deleted
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Object>} Updated phase
 */
export async function recalculatePhaseSpending(phaseId) {
  const db = await getDatabase();
  
  // Get phase
  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null
  });
  
  if (!phase) {
    throw new Error('Phase not found');
  }
  
  // Calculate actual spending from materials
  const materialsSpending = await db.collection('materials').aggregate([
    {
      $match: {
        phaseId: new ObjectId(phaseId),
        deletedAt: null,
        status: { $in: MATERIAL_APPROVED_STATUSES }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalCost' }
      }
    }
  ]).toArray();
  
  // Calculate actual spending from expenses (ONLY direct costs - exclude indirect costs)
  // CRITICAL: Indirect costs are charged to project-level indirect costs budget, not phase budget
  const expensesSpending = await db.collection('expenses').aggregate([
    {
      $match: {
        phaseId: new ObjectId(phaseId),
        deletedAt: null,
        status: { $in: ['APPROVED'] },
        isIndirectCost: { $ne: true } // EXCLUDE indirect costs from phase spending
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]).toArray();
  
  // Calculate professional services spending for this phase
  const { calculatePhaseProfessionalServicesSpending } = await import('@/lib/professional-services-helpers');
  const professionalServicesSpending = await calculatePhaseProfessionalServicesSpending(phaseId.toString());
  
  // Calculate committed cost
  const committedCost = await calculatePhaseCommittedCost(phaseId);
  
  // Calculate estimated cost
  const estimatedCost = await calculatePhaseEstimatedCost(phaseId);
  
  // TODO: Add labour spending when labour system is implemented
  const labourSpending = 0;
  
  // Phase 4: Calculate equipment spending
  const equipmentSpending = await calculatePhaseEquipmentCost(phaseId);
  
  // Phase 5: Calculate subcontractor spending
  const subcontractorSpending = await calculatePhaseSubcontractorCost(phaseId);
  
  const actualSpending = {
    materials: materialsSpending[0]?.total || 0,
    expenses: expensesSpending[0]?.total || 0,
    professionalServices: professionalServicesSpending.total || 0,
    labour: labourSpending,
    equipment: equipmentSpending,
    subcontractors: subcontractorSpending,
    total: (materialsSpending[0]?.total || 0) + 
           (expensesSpending[0]?.total || 0) + 
           (professionalServicesSpending.total || 0) + 
           labourSpending + 
           equipmentSpending + 
           subcontractorSpending
  };
  
  // Update phase with actual spending, committed cost, and estimated cost
  const updatedPhase = await db.collection('phases').findOneAndUpdate(
    { _id: new ObjectId(phaseId) },
    {
      $set: {
        actualSpending,
        'financialStates.actual': actualSpending.total,
        'financialStates.committed': committedCost,
        'financialStates.estimated': estimatedCost,
        'financialStates.remaining': Math.max(0, (phase.budgetAllocation?.total || 0) - actualSpending.total - committedCost),
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );
  
  return updatedPhase;
}

/**
 * Validate if material request estimated cost fits within phase material budget
 * @param {string} phaseId - Phase ID
 * @param {number} estimatedCost - Estimated cost of the material request
 * @param {string} excludeRequestId - Optional: Material request ID to exclude from calculation (for updates)
 * @returns {Promise<Object>} { isValid: boolean, available: number, required: number, shortfall: number, message: string }
 */
export async function validatePhaseMaterialBudget(phaseId, estimatedCost, excludeRequestId = null) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return {
      isValid: false,
      available: 0,
      required: estimatedCost || 0,
      shortfall: estimatedCost || 0,
      message: 'Invalid phase ID'
    };
  }
  
  if (!estimatedCost || estimatedCost <= 0) {
    // No cost provided - allow but warn
    return {
      isValid: true,
      available: 0,
      required: 0,
      shortfall: 0,
      message: 'No estimated cost provided. Budget validation will occur when converting to purchase order.'
    };
  }
  
  // Get phase with budget allocation
  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null
  });
  
  if (!phase) {
    return {
      isValid: false,
      available: 0,
      required: estimatedCost,
      shortfall: estimatedCost,
      message: 'Phase not found'
    };
  }
  
  // Get material budget allocation for this phase
  const materialBudget = phase.budgetAllocation?.materials || 0;
  
  // Calculate current material spending (actual + committed)
  const actualMaterialSpending = phase.actualSpending?.materials || 0;
  
  // Calculate committed material costs (from POs that are accepted but not fulfilled)
  const committedPOs = await db.collection('purchase_orders').find({
    phaseId: new ObjectId(phaseId),
    status: { $in: ['order_accepted', 'ready_for_delivery'] },
    deletedAt: null
  }).toArray();
  
  let committedMaterialCost = 0;
  for (const po of committedPOs) {
    // Check if PO is fulfilled (has linked materials)
    if (po.isBulkOrder && po.materialRequestIds) {
      const materialCount = await db.collection('materials').countDocuments({
        linkedPurchaseOrderId: po._id,
        phaseId: new ObjectId(phaseId),
        deletedAt: null,
        status: { $in: MATERIAL_APPROVED_STATUSES }
      });
      if (materialCount === 0) {
        committedMaterialCost += po.totalCost || 0;
      }
    } else if (!po.linkedMaterialId) {
      committedMaterialCost += po.totalCost || 0;
    }
  }
  
  // Calculate estimated material costs from approved requests (excluding current request if updating)
  const approvedRequestsQuery = {
    phaseId: new ObjectId(phaseId),
    status: 'approved',
    deletedAt: null,
    estimatedCost: { $exists: true, $ne: null, $gt: 0 }
  };
  
  if (excludeRequestId && ObjectId.isValid(excludeRequestId)) {
    approvedRequestsQuery._id = { $ne: new ObjectId(excludeRequestId) };
  }
  
  const approvedRequests = await db.collection('material_requests').find(approvedRequestsQuery).toArray();
  
  let estimatedMaterialCost = 0;
  for (const request of approvedRequests) {
    // Only count if request hasn't been converted to PO yet
    if (!request.linkedPurchaseOrderId) {
      estimatedMaterialCost += request.estimatedCost || 0;
    }
  }
  
  // Calculate available material budget
  const totalUsed = actualMaterialSpending + committedMaterialCost + estimatedMaterialCost;
  const available = Math.max(0, materialBudget - totalUsed);
  
  // Check if new request would exceed budget
  const required = estimatedCost;
  const shortfall = Math.max(0, required - available);
  const isValid = required <= available;
  
  return {
    isValid,
    available,
    required,
    shortfall,
    materialBudget,
    totalUsed,
    actualMaterialSpending,
    committedMaterialCost,
    estimatedMaterialCost,
    message: isValid
      ? `Budget validation passed. Available: ${available.toLocaleString()}, Required: ${required.toLocaleString()}`
      : `Insufficient phase material budget. Available: ${available.toLocaleString()}, Required: ${required.toLocaleString()}, Shortfall: ${shortfall.toLocaleString()}`
  };
}

/**
 * Validate bulk material request budget across multiple phases
 * Groups materials by phase and validates each phase's budget
 * @param {Array} materials - Array of material objects with phaseId and estimatedCost
 * @param {string} defaultPhaseId - Optional default phaseId for materials without phaseId
 * @returns {Promise<Object>} { isValid: boolean, errors: string[], results: Object[] }
 */
export async function validateBulkMaterialRequestBudget(materials, defaultPhaseId = null) {
  if (!Array.isArray(materials) || materials.length === 0) {
    return {
      isValid: true,
      errors: [],
      results: []
    };
  }

  // Group materials by phaseId
  const materialsByPhase = new Map();
  
  for (const material of materials) {
    const phaseId = material.phaseId && ObjectId.isValid(material.phaseId)
      ? material.phaseId.toString()
      : (defaultPhaseId && ObjectId.isValid(defaultPhaseId) ? defaultPhaseId.toString() : null);
    
    if (!phaseId) {
      return {
        isValid: false,
        errors: [`Material "${material.name || material.materialName || 'Unknown'}" does not have a phaseId and no defaultPhaseId provided`],
        results: []
      };
    }

    if (!materialsByPhase.has(phaseId)) {
      materialsByPhase.set(phaseId, []);
    }
    
    const estimatedCost = material.estimatedCost || 0;
    if (estimatedCost > 0) {
      materialsByPhase.get(phaseId).push({
        materialName: material.name || material.materialName || 'Unknown',
        estimatedCost
      });
    }
  }

  // Validate budget for each phase
  const results = [];
  const errors = [];
  let isValid = true;
  const db = await getDatabase();

  for (const [phaseId, phaseMaterials] of materialsByPhase.entries()) {
    const totalCost = phaseMaterials.reduce((sum, m) => sum + m.estimatedCost, 0);
    
    if (totalCost > 0) {
      // Get phase name for better error messages
      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(phaseId),
        deletedAt: null
      });
      const phaseName = phase?.phaseName || phase?.name || phaseId;
      
      const budgetValidation = await validatePhaseMaterialBudget(phaseId, totalCost);
      
      results.push({
        phaseId,
        phaseName,
        materialCount: phaseMaterials.length,
        totalCost,
        ...budgetValidation
      });

      if (!budgetValidation.isValid) {
        isValid = false;
        errors.push(
          `Phase budget exceeded for phase "${phaseName}": ` +
          `Available: ${budgetValidation.available.toLocaleString()}, ` +
          `Required: ${budgetValidation.required.toLocaleString()}, ` +
          `Shortfall: ${budgetValidation.shortfall.toLocaleString()}`
        );
      }
    }
  }

  return {
    isValid,
    errors,
    results
  };
}

/**
 * Calculate total budget allocated to all phases for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Total phase budgets
 */
export async function calculateTotalPhaseBudgets(projectId) {
  const db = await getDatabase();
  
  const result = await db.collection('phases').aggregate([
    {
      $match: {
        projectId: new ObjectId(projectId),
        deletedAt: null
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$budgetAllocation.total' }
      }
    }
  ]).toArray();
  
  return result[0]?.total || 0;
}

/**
 * Get phase summary for project dashboard
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Phase summary
 */
export async function getPhaseSummary(projectId) {
  const phases = await getProjectPhases(projectId, true);
  
  const summary = {
    totalPhases: phases.length,
    completedPhases: phases.filter(p => p.status === 'completed').length,
    inProgressPhases: phases.filter(p => p.status === 'in_progress').length,
    notStartedPhases: phases.filter(p => p.status === 'not_started').length,
    totalBudget: phases.reduce((sum, p) => sum + (p.budgetAllocation?.total || 0), 0),
    totalSpent: phases.reduce((sum, p) => sum + (p.actualSpending?.total || 0), 0),
    totalCommitted: phases.reduce((sum, p) => sum + (p.financialStates?.committed || 0), 0),
    phases: phases.map(p => ({
      id: p._id.toString(),
      name: p.phaseName,
      code: p.phaseCode,
      status: p.status,
      completionPercentage: p.completionPercentage,
      budget: p.budgetAllocation?.total || 0,
      spent: p.actualSpending?.total || 0,
      remaining: p.financialStates?.remaining || 0,
      variance: (p.actualSpending?.total || 0) - (p.budgetAllocation?.total || 0),
      variancePercentage: p.budgetAllocation?.total > 0
        ? (((p.actualSpending?.total || 0) - (p.budgetAllocation?.total || 0)) / p.budgetAllocation.total * 100).toFixed(2)
        : 0
    }))
  };
  
  return summary;
}

/**
 * Phase 2: Check if phase can be started (all dependencies completed)
 * Re-exported from phase-dependency-helpers for convenience
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Object>} { canStart: boolean, reason: string, blockingPhases: Array }
 */
export async function canPhaseStart(phaseId) {
  const { canPhaseStart: checkCanStart } = await import('@/lib/phase-dependency-helpers');
  
  return await checkCanStart(phaseId);
}

/**
 * Phase 6: Update phase completion percentage from work items
 * @param {string} phaseId - Phase ID
 * @returns {Promise<number>} Updated completion percentage
 */
export async function updatePhaseCompletion(phaseId) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    throw new Error('Invalid phase ID');
  }
  
  // Calculate from work items if they exist
  const workItemCompletion = await calculatePhaseCompletionFromWorkItems(phaseId);
  
  // Update phase completion percentage
  await db.collection('phases').updateOne(
    { _id: new ObjectId(phaseId) },
    {
      $set: {
        completionPercentage: workItemCompletion,
        updatedAt: new Date()
      }
    }
  );
  
  return workItemCompletion;
}
