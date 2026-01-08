/**
 * Phase Schema Definition
 * Defines construction phases and their structure
 */

/**
 * Phase Schema
 * @typedef {Object} PhaseSchema
 * @property {ObjectId} _id - Phase ID
 * @property {ObjectId} projectId - Project ID (required, indexed)
 * @property {string} phaseName - Phase name (e.g., "Basement/Substructure")
 * @property {string} phaseCode - Phase code (e.g., "PHASE-01")
 * @property {string} phaseType - Phase type: 'construction', 'finishing', 'final' (pre_construction removed - tracked via initial_expenses)
 * @property {number} sequence - Order of execution (required)
 * @property {Object} budgetAllocation - Budget allocation for this phase
 * @property {Object} actualSpending - Actual spending for this phase
 * @property {Object} financialStates - Financial states (estimated, committed, actual)
 * @property {string} status - Phase status: 'not_started', 'in_progress', 'completed', 'on_hold'
 * @property {Date} startDate - Phase start date
 * @property {Date} plannedEndDate - Planned completion date
 * @property {Date} actualEndDate - Actual completion date
 * @property {number} completionPercentage - Completion percentage (0-100)
 * @property {Array<number>|string} applicableFloors - Floors this phase applies to
 * @property {Array<ObjectId>} applicableCategories - Category IDs relevant to this phase
 * @property {Array<Object>} milestones - Phase milestones
 * @property {Array<ObjectId>} dependsOn - Array of phase IDs this phase depends on (Phase 2: Dependencies)
 * @property {Date} canStartAfter - Earliest date this phase can start based on dependencies (calculated)
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} deletedAt - Soft delete timestamp
 */

/**
 * Valid phase types
 */
export const PHASE_TYPES = {
  // PRE_CONSTRUCTION removed - pre-construction costs tracked via initial_expenses
  CONSTRUCTION: 'construction',
  FINISHING: 'finishing',
  FINAL: 'final'
};

/**
 * Valid phase statuses
 */
export const PHASE_STATUSES = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
  CANCELLED: 'cancelled'
};

/**
 * Default phase definitions
 * NOTE: Phase 0 (Pre-Construction) removed - pre-construction costs tracked via initial_expenses collection
 */
export const DEFAULT_PHASES = [
  {
    phaseName: 'Basement/Substructure',
    phaseCode: 'PHASE-01',
    phaseType: PHASE_TYPES.CONSTRUCTION,
    sequence: 1,
    description: 'Foundation, basement, and substructure work',
    applicableFloors: 'basement',
    applicableCategories: []
  },
  {
    phaseName: 'Superstructure',
    phaseCode: 'PHASE-02',
    phaseType: PHASE_TYPES.CONSTRUCTION,
    sequence: 2,
    description: 'Main structure construction (floors 1-10)',
    applicableFloors: 'all',
    applicableCategories: []
  },
  {
    phaseName: 'Finishing Works',
    phaseCode: 'PHASE-03',
    phaseType: PHASE_TYPES.FINISHING,
    sequence: 3,
    description: 'Electrical, plumbing, joinery, paintwork, tiling',
    applicableFloors: 'all',
    applicableCategories: []
  },
  {
    phaseName: 'Final Systems',
    phaseCode: 'PHASE-04',
    phaseType: PHASE_TYPES.FINAL,
    sequence: 4,
    description: 'Lift installation, testing, commissioning, handover',
    applicableFloors: 'all',
    applicableCategories: []
  }
];

/**
 * Create phase object
 * @param {Object} input - Phase input data
 * @param {ObjectId} projectId - Project ID
 * @returns {Object} Phase object
 */
export function createPhase(input, projectId) {
  const {
    phaseName,
    phaseCode,
    phaseType,
    sequence,
    description,
    applicableFloors,
    applicableCategories = [],
    budgetAllocation = {},
    startDate,
    plannedEndDate,
    dependsOn = [] // Phase 2: Dependencies
  } = input;
  
  return {
    projectId: typeof projectId === 'string' ? projectId : projectId,
    phaseName: phaseName || '',
    phaseCode: phaseCode || `PHASE-${String(sequence).padStart(2, '0')}`,
    phaseType: phaseType || PHASE_TYPES.CONSTRUCTION,
    sequence: sequence || 0,
    description: description || '',
    
    // Budget allocation
    budgetAllocation: {
      total: budgetAllocation.total || 0,
      materials: budgetAllocation.materials || 0,
      labour: budgetAllocation.labour || 0,
      equipment: budgetAllocation.equipment || 0,
      subcontractors: budgetAllocation.subcontractors || 0,
      contingency: budgetAllocation.contingency || 0
    },
    
    // Actual spending (initialize to 0)
    actualSpending: {
      materials: 0,
      labour: 0,
      equipment: 0,
      subcontractors: 0,
      total: 0
    },
    
    // Financial states
    financialStates: {
      estimated: 0,
      committed: 0,
      actual: 0,
      remaining: budgetAllocation.total || 0
    },
    
    // Status
    status: PHASE_STATUSES.NOT_STARTED,
    startDate: startDate ? new Date(startDate) : null,
    plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
    actualEndDate: null,
    completionPercentage: 0,
    
    // Associations
    applicableFloors: applicableFloors === 'all' ? 'all' : (Array.isArray(applicableFloors) ? applicableFloors : []),
    applicableCategories: Array.isArray(applicableCategories) ? applicableCategories : [],
    
    // Milestones (Phase 7: Enhanced)
    milestones: [], // Array of milestone objects with enhanced structure
    
    // Quality Checkpoints (Phase 7: New)
    qualityCheckpoints: [], // Array of quality checkpoint objects
    
    // Phase 2: Dependencies & Sequencing
    dependsOn: Array.isArray(dependsOn) ? dependsOn : [],
    canStartAfter: null, // Will be calculated based on dependencies
    
    // Timestamps
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  };
}

/**
 * Validate phase data
 * @param {Object} phase - Phase object to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validatePhase(phase) {
  const errors = [];
  
  if (!phase) {
    return { isValid: false, errors: ['Phase is required'] };
  }
  
  if (!phase.projectId) {
    errors.push('Project ID is required');
  }
  
  if (!phase.phaseName || phase.phaseName.trim().length === 0) {
    errors.push('Phase name is required');
  }
  
  if (phase.sequence === undefined || phase.sequence === null) {
    errors.push('Sequence is required');
  }
  
  if (phase.sequence < 0) {
    errors.push('Sequence must be non-negative');
  }
  
  if (!Object.values(PHASE_TYPES).includes(phase.phaseType)) {
    errors.push(`Invalid phase type. Must be one of: ${Object.values(PHASE_TYPES).join(', ')}`);
  }
  
  if (!Object.values(PHASE_STATUSES).includes(phase.status)) {
    errors.push(`Invalid phase status. Must be one of: ${Object.values(PHASE_STATUSES).join(', ')}`);
  }
  
  if (phase.completionPercentage < 0 || phase.completionPercentage > 100) {
    errors.push('Completion percentage must be between 0 and 100');
  }
  
  // Phase 2: Validate dependencies
  if (phase.dependsOn && Array.isArray(phase.dependsOn)) {
    for (const depId of phase.dependsOn) {
      // Check if it's a valid ObjectId format (string or ObjectId)
      const isValidObjectId = (id) => {
        if (typeof id === 'string') {
          return /^[0-9a-fA-F]{24}$/.test(id);
        }
        return id && typeof id === 'object' && id.toString && /^[0-9a-fA-F]{24}$/.test(id.toString());
      };
      
      if (!isValidObjectId(depId)) {
        errors.push(`Invalid dependency phase ID: ${depId}`);
      }
    }
    
    // Check for duplicate dependencies
    const uniqueDeps = new Set(phase.dependsOn.map(id => id.toString()));
    if (uniqueDeps.size !== phase.dependsOn.length) {
      errors.push('Duplicate dependencies found in dependsOn array');
    }
    
    // Note: Circular dependency check will be done in phase-dependency-helpers.js
    // to avoid circular imports and allow async database queries
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calculate phase financial summary
 * @param {Object} phase - Phase object
 * @returns {Object} Financial summary
 */
export function calculatePhaseFinancialSummary(phase) {
  if (!phase) {
    return {
      budgetTotal: 0,
      actualTotal: 0,
      committedTotal: 0,
      estimatedTotal: 0,
      remaining: 0,
      variance: 0,
      variancePercentage: 0,
      utilizationPercentage: 0
    };
  }
  
  const budgetTotal = phase.budgetAllocation?.total || 0;
  const actualTotal = phase.actualSpending?.total || phase.financialStates?.actual || 0;
  const committedTotal = phase.financialStates?.committed || 0;
  const estimatedTotal = phase.financialStates?.estimated || 0;
  
  const variance = actualTotal - budgetTotal;
  const variancePercentage = budgetTotal > 0 ? (variance / budgetTotal) * 100 : 0;
  const utilizationPercentage = budgetTotal > 0 ? (actualTotal / budgetTotal) * 100 : 0;
  const remaining = Math.max(0, budgetTotal - actualTotal - committedTotal);
  
  return {
    budgetTotal,
    actualTotal,
    committedTotal,
    estimatedTotal,
    remaining,
    variance,
    variancePercentage: parseFloat(variancePercentage.toFixed(2)),
    utilizationPercentage: parseFloat(utilizationPercentage.toFixed(2))
  };
}

/**
 * Update phase spending
 * @param {Object} phase - Phase object to update
 * @param {Object} spending - Spending data
 * @returns {Object} Updated phase
 */
export function updatePhaseSpending(phase, spending) {
  if (!phase) return phase;
  
  const updated = { ...phase };
  
  // Update actual spending
  updated.actualSpending = {
    materials: (updated.actualSpending?.materials || 0) + (spending.materials || 0),
    labour: (updated.actualSpending?.labour || 0) + (spending.labour || 0),
    equipment: (updated.actualSpending?.equipment || 0) + (spending.equipment || 0),
    subcontractors: (updated.actualSpending?.subcontractors || 0) + (spending.subcontractors || 0),
    total: (updated.actualSpending?.total || 0) + (spending.total || 0)
  };
  
  // Update financial states
  updated.financialStates = {
    ...updated.financialStates,
    actual: updated.actualSpending.total,
    remaining: Math.max(0, (updated.budgetAllocation?.total || 0) - updated.actualSpending.total - (updated.financialStates?.committed || 0))
  };
  
  updated.updatedAt = new Date();
  
  return updated;
}

export const PHASE_SCHEMA = {
  PHASE_TYPES,
  PHASE_STATUSES,
  DEFAULT_PHASES
};



