/**
 * Labour Entry Validation
 * Context-aware validation based on entry mode
 */

import { LABOUR_ENTRY_MODES, getEntryModeConfig } from '@/lib/constants/labour-entry-modes';
import { VALID_WORKER_TYPES, VALID_WORKER_ROLES, VALID_SKILL_TYPES } from '@/lib/constants/labour-constants';
import { VALID_SERVICE_TYPES } from '@/lib/constants/labour-constants';

/**
 * Validate labour entry based on entry mode
 * @param {Object} formData - Form data to validate
 * @param {string} entryMode - Entry mode
 * @returns {Object} { isValid: boolean, errors: string[], warnings: string[] }
 */
export function validateLabourEntry(formData, entryMode = LABOUR_ENTRY_MODES.GENERAL) {
  const errors = [];
  const warnings = [];
  const config = getEntryModeConfig(entryMode);
  
  // ========== ALWAYS REQUIRED (Universal) ==========
  if (!formData.workerId && !formData.workerName) {
    errors.push('Worker is required (select existing worker or enter name)');
  }
  
  if (!formData.entryDate) {
    errors.push('Entry date is required');
  } else {
    const entryDate = new Date(formData.entryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (entryDate > today) {
      warnings.push('Entry date is in the future');
    }
  }
  
  if (!formData.totalHours || formData.totalHours <= 0) {
    errors.push('Total hours must be greater than 0');
  } else if (formData.totalHours > 24) {
    errors.push('Total hours cannot exceed 24 hours in a day');
  }
  
  if (!formData.hourlyRate || formData.hourlyRate < 0) {
    errors.push('Hourly rate is required and must be >= 0');
  }
  
  // ========== ENTRY MODE SPECIFIC VALIDATION ==========
  
  if (entryMode === LABOUR_ENTRY_MODES.GENERAL) {
    // General direct labour - work item required
    if (!formData.workItemId && !formData.isIndirectLabour) {
      errors.push('Work item is required for direct labour');
    }
    
    if (!formData.phaseId) {
      errors.push('Phase is required for budget tracking');
    }
    
    if (!formData.projectId) {
      errors.push('Project is required');
    }
  }
  
  if (entryMode === LABOUR_ENTRY_MODES.WORK_ITEM) {
    // Work item mode - workItemId should be pre-filled
    if (!formData.workItemId) {
      errors.push('Work item is missing. Please navigate from a work item page.');
    }
  }
  
  if (entryMode === LABOUR_ENTRY_MODES.EQUIPMENT_OPERATOR) {
    // Equipment operator - equipment required, work item NOT required
    if (!formData.equipmentId) {
      errors.push('Equipment is required for operator labour');
    }
    
    // Work item is OPTIONAL for equipment operator
    if (!formData.workItemId) {
      // This is OK for equipment operator
      warnings.push('Consider linking to a work item for better budget tracking');
    }
    
    // Validate rate against equipment if available
    if (formData.equipmentDailyRate && formData.dailyRate) {
      const equipmentDailyRate = parseFloat(formData.equipmentDailyRate);
      const operatorDailyRate = parseFloat(formData.dailyRate);
      
      if (operatorDailyRate > equipmentDailyRate * 0.5) {
        warnings.push('Operator rate seems high compared to equipment rental rate');
      }
    }
  }
  
  if (entryMode === LABOUR_ENTRY_MODES.INDIRECT) {
    // Indirect labour - indirect cost category required, work item NOT required
    if (!formData.indirectCostCategory) {
      errors.push('Indirect cost category is required');
    }
    
    const validCategories = ['utilities', 'siteOverhead', 'transportation', 'safetyCompliance', 'other'];
    if (formData.indirectCostCategory && !validCategories.includes(formData.indirectCostCategory)) {
      errors.push(`Invalid indirect cost category. Must be one of: ${validCategories.join(', ')}`);
    }
  }
  
  if (entryMode === LABOUR_ENTRY_MODES.SUBCONTRACTOR) {
    // Subcontractor labour
    if (!formData.subcontractorId) {
      errors.push('Subcontractor is required');
    }
  }
  
  if (entryMode === LABOUR_ENTRY_MODES.PROFESSIONAL) {
    // Professional services
    if (!formData.serviceType) {
      errors.push('Service type is required for professional services');
    }
    
    if (formData.serviceType && !VALID_SERVICE_TYPES.includes(formData.serviceType)) {
      errors.push(`Invalid service type. Must be one of: ${VALID_SERVICE_TYPES.join(', ')}`);
    }
    
    // Professional rates are typically higher
    if (formData.hourlyRate && parseFloat(formData.hourlyRate) < 1000) {
      warnings.push('Professional rates are typically higher than KES 1,000/hour');
    }
  }
  
  // ========== RATE VALIDATION ==========
  if (formData.hourlyRate && formData.dailyRate) {
    const impliedDailyRate = parseFloat(formData.hourlyRate) * parseFloat(formData.totalHours);
    const statedDailyRate = parseFloat(formData.dailyRate);
    const deviation = Math.abs(impliedDailyRate - statedDailyRate) / impliedDailyRate;
    
    if (deviation > 0.2) {
      warnings.push(`Daily rate (KES ${statedDailyRate}) differs significantly from hourly calculation (KES ${impliedDailyRate.toFixed(2)})`);
    }
  }
  
  // ========== OVERTIME VALIDATION ==========
  if (formData.overtimeHours && formData.overtimeHours > 0) {
    if (!formData.overtimeRate || formData.overtimeRate <= 0) {
      warnings.push('Overtime hours specified but no overtime rate provided');
    }
    
    const totalHours = parseFloat(formData.totalHours) || 0;
    const overtimeHours = parseFloat(formData.overtimeHours) || 0;
    
    if (overtimeHours > totalHours) {
      errors.push('Overtime hours cannot exceed total hours');
    }
    
    if (overtimeHours > 4) {
      warnings.push('Overtime exceeds 4 hours - ensure compliance with labour laws');
    }
  }
  
  // ========== WORKER TYPE VALIDATION ==========
  if (formData.workerType && !VALID_WORKER_TYPES.includes(formData.workerType)) {
    errors.push(`Invalid worker type. Must be one of: ${VALID_WORKER_TYPES.join(', ')}`);
  }
  
  if (formData.workerRole && !VALID_WORKER_ROLES.includes(formData.workerRole)) {
    errors.push(`Invalid worker role. Must be one of: ${VALID_WORKER_ROLES.join(', ')}`);
  }
  
  if (formData.skillType && !VALID_SKILL_TYPES.includes(formData.skillType)) {
    errors.push(`Invalid skill type. Must be one of: ${VALID_SKILL_TYPES.join(', ')}`);
  }
  
  // ========== DATE/TIME VALIDATION ==========
  if (formData.clockInTime && formData.clockOutTime) {
    const clockIn = new Date(`2000-01-01T${formData.clockInTime}`);
    const clockOut = new Date(`2000-01-01T${formData.clockOutTime}`);
    
    if (clockOut <= clockIn) {
      errors.push('Clock out time must be after clock in time');
    }
    
    const calculatedHours = (clockOut - clockIn) / (1000 * 60 * 60);
    const breakHours = (parseFloat(formData.breakDuration) || 0) / 60;
    const netHours = calculatedHours - breakHours;
    
    if (Math.abs(netHours - formData.totalHours) > 1) {
      warnings.push(`Calculated hours (${netHours.toFixed(1)}) differs from entered hours (${formData.totalHours})`);
    }
  }
  
  // ========== BUDGET VALIDATION (Warnings Only) ==========
  if (formData.totalHours && formData.hourlyRate) {
    const totalCost = parseFloat(formData.totalHours) * parseFloat(formData.hourlyRate);
    
    if (totalCost > 100000) {
      warnings.push(`High labour cost: KES ${totalCost.toLocaleString()}. Ensure budget availability.`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Get validation rules for specific field based on entry mode
 * @param {string} fieldName - Field name
 * @param {string} entryMode - Entry mode
 * @returns {Object} Field validation rules
 */
export function getFieldValidationRules(fieldName, entryMode) {
  const config = getEntryModeConfig(entryMode);
  
  const isRequired = config.required.includes(fieldName);
  const isHidden = config.hidden.includes(fieldName);
  const isOptional = config.optional.includes(fieldName);
  
  return {
    required: isRequired,
    hidden: isHidden,
    optional: isOptional,
    show: !isHidden,
  };
}

export default {
  validateLabourEntry,
  getFieldValidationRules,
};
