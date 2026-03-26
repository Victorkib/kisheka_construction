/**
 * Professional Rates Helpers
 * Utilities for calculating fees, contract values, and validating rates
 * Used across assignments, activities, and fees
 */

/**
 * Calculate months between two dates
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {number} Number of months (rounded up)
 */
export function calculateMonthsBetween(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (end <= start) return 0;
  
  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  const dayDiff = end.getDate() - start.getDate();
  
  let months = yearDiff * 12 + monthDiff;
  
  // If end date is later in the month, count as full month
  if (dayDiff > 0) {
    months += 1;
  }
  
  return Math.max(1, months); // Minimum 1 month
}

/**
 * Get visits per month based on visit frequency
 * @param {string} visitFrequency - Visit frequency (weekly, bi_weekly, monthly, etc.)
 * @returns {number} Number of visits per month
 */
export function getVisitsPerMonth(visitFrequency) {
  if (!visitFrequency) return 0;
  
  const frequencyMap = {
    weekly: 4, // ~4 weeks per month
    bi_weekly: 2, // Every 2 weeks = 2 per month
    monthly: 1,
    milestone_based: 0, // Variable, can't calculate
    as_needed: 0, // Variable, can't calculate
  };
  
  return frequencyMap[visitFrequency] || 0;
}

/**
 * Estimate hours for contract based on type and duration
 * @param {string} contractType - Contract type
 * @param {Date|string} startDate - Contract start date
 * @param {Date|string} endDate - Contract end date
 * @param {string} visitFrequency - Visit frequency (for engineers)
 * @returns {number} Estimated hours
 */
export function estimateHoursForContract(contractType, startDate, endDate, visitFrequency = null) {
  if (!startDate || !endDate) return 0;
  
  const months = calculateMonthsBetween(startDate, endDate);
  
  // Base hours per month by contract type
  const hoursPerMonthMap = {
    // Architect contracts
    full_service: 40, // Full-time equivalent
    consultation: 20, // Part-time
    oversight_only: 15, // Occasional oversight
    design_only: 30, // Design work
    
    // Engineer contracts
    inspection_only: 8, // ~2 hours per inspection, 4 per month
    full_oversight: 40, // Full-time equivalent
    quality_control: 20, // Regular quality checks
    consultation: 15, // Occasional consultation
  };
  
  const hoursPerMonth = hoursPerMonthMap[contractType] || 20; // Default 20 hours/month
  
  // For engineers with visit frequency, adjust
  if (visitFrequency) {
    const visitsPerMonth = getVisitsPerMonth(visitFrequency);
    if (visitsPerMonth > 0) {
      // Estimate 2-4 hours per visit depending on contract type
      const hoursPerVisit = contractType === 'inspection_only' ? 2 : 4;
      return visitsPerMonth * hoursPerVisit * months;
    }
  }
  
  return hoursPerMonth * months;
}

/**
 * Calculate contract value estimate based on rates and payment schedule
 * @param {Object} params - Calculation parameters
 * @param {number|null} params.hourlyRate - Hourly rate
 * @param {number|null} params.perVisitRate - Per-visit rate
 * @param {number|null} params.perFloorRate - Per-floor rate
 * @param {number|null} params.monthlyRetainer - Monthly retainer
 * @param {string} params.paymentSchedule - Payment schedule
 * @param {string} params.contractType - Contract type
 * @param {Date|string} params.contractStartDate - Contract start date
 * @param {Date|string} params.contractEndDate - Contract end date (optional)
 * @param {string|null} params.visitFrequency - Visit frequency (for engineers)
 * @param {number|null} params.floorsCount - Optional floors count (for per-floor schedule estimate)
 * @returns {Object} Calculation result with suggested value and breakdown
 */
export function calculateContractValueEstimate({
  hourlyRate,
  perVisitRate,
  perFloorRate,
  monthlyRetainer,
  paymentSchedule,
  contractType,
  contractStartDate,
  contractEndDate,
  visitFrequency,
  floorsCount,
}) {
  if (!contractStartDate) {
    return {
      suggestedValue: null,
      calculation: null,
      breakdown: null,
      error: 'Contract start date is required',
    };
  }
  
  // If no end date, estimate 12 months
  const endDate = contractEndDate || (() => {
    const start = new Date(contractStartDate);
    start.setMonth(start.getMonth() + 12);
    return start;
  })();
  
  const months = calculateMonthsBetween(contractStartDate, endDate);
  
  let suggestedValue = null;
  let calculation = null;
  let breakdown = null;
  
  // Calculate based on payment schedule
  switch (paymentSchedule) {
    case 'monthly':
    case 'retainer':
      if (monthlyRetainer && monthlyRetainer > 0) {
        suggestedValue = monthlyRetainer * months;
        calculation = {
          method: 'monthly_retainer',
          rate: monthlyRetainer,
          months,
          formula: `${monthlyRetainer.toLocaleString()} × ${months} = ${suggestedValue.toLocaleString()}`,
        };
        breakdown = {
          monthlyRetainer,
          months,
          total: suggestedValue,
        };
      }
      break;
      
    case 'per_visit':
      if (perVisitRate && perVisitRate > 0) {
        const visitsPerMonth = getVisitsPerMonth(visitFrequency);
        if (visitsPerMonth > 0) {
          const totalVisits = visitsPerMonth * months;
          suggestedValue = perVisitRate * totalVisits;
          calculation = {
            method: 'per_visit',
            rate: perVisitRate,
            visitsPerMonth,
            totalVisits,
            months,
            formula: `${perVisitRate.toLocaleString()} × ${visitsPerMonth} visits/month × ${months} months = ${suggestedValue.toLocaleString()}`,
          };
          breakdown = {
            perVisitRate,
            visitsPerMonth,
            totalVisits,
            months,
            total: suggestedValue,
          };
        } else {
          // Can't calculate without visit frequency
          return {
            suggestedValue: null,
            calculation: null,
            breakdown: null,
            error: 'Visit frequency is required for per-visit payment schedule',
          };
        }
      }
      break;

    case 'per_floor':
      if (perFloorRate && perFloorRate > 0) {
        const floors = Number(floorsCount);
        if (!floors || Number.isNaN(floors) || floors <= 0) {
          return {
            suggestedValue: null,
            calculation: null,
            breakdown: null,
            error: 'Floors count is required for per-floor payment schedule',
          };
        }

        suggestedValue = perFloorRate * floors;
        calculation = {
          method: 'per_floor',
          rate: perFloorRate,
          floors,
          formula: `${perFloorRate.toLocaleString()} × ${floors} floors = ${suggestedValue.toLocaleString()}`,
        };
        breakdown = {
          perFloorRate,
          floors,
          total: suggestedValue,
        };
      }
      break;
      
    case 'lump_sum':
      // Lump sum is manually set, can't calculate from rates
      return {
        suggestedValue: null,
        calculation: null,
        breakdown: null,
        error: 'Lump sum contracts require manual contract value entry',
      };
      
    case 'milestone':
      // Milestone payments are manually set
      return {
        suggestedValue: null,
        calculation: null,
        breakdown: null,
        error: 'Milestone payments require manual contract value entry',
      };
      
    case 'percentage':
      // Percentage of project value, can't calculate from rates
      return {
        suggestedValue: null,
        calculation: null,
        breakdown: null,
        error: 'Percentage-based contracts require manual contract value entry',
      };
      
    default:
      // Try hourly rate as fallback
      if (hourlyRate && hourlyRate > 0) {
        const estimatedHours = estimateHoursForContract(contractType, contractStartDate, endDate, visitFrequency);
        if (estimatedHours > 0) {
          suggestedValue = hourlyRate * estimatedHours;
          calculation = {
            method: 'hourly_rate',
            rate: hourlyRate,
            estimatedHours,
            months,
            formula: `${hourlyRate.toLocaleString()}/hr × ${estimatedHours} hours = ${suggestedValue.toLocaleString()}`,
          };
          breakdown = {
            hourlyRate,
            estimatedHours,
            hoursPerMonth: estimatedHours / months,
            months,
            total: suggestedValue,
          };
        }
      }
  }
  
  if (!suggestedValue) {
    return {
      suggestedValue: null,
      calculation: null,
      breakdown: null,
      error: 'No applicable rates found for the selected payment schedule',
    };
  }
  
  return {
    suggestedValue,
    calculation,
    breakdown,
    error: null,
  };
}

/**
 * Calculate fee from activity using assignment rates
 * @param {Object} activity - Activity object
 * @param {Object} assignment - Assignment object with rates
 * @returns {Object} Calculation result
 */
export function calculateFeeFromActivity(activity, assignment) {
  if (!activity || !assignment) {
    return {
      calculatedFee: null,
      calculation: null,
      error: 'Activity and assignment are required',
    };
  }
  
  const activityType = activity.activityType;
  const hourlyRate = assignment.hourlyRate || assignment.ratesSnapshot?.hourlyRate;
  const perVisitRate = assignment.perVisitRate || assignment.ratesSnapshot?.perVisitRate;
  const monthlyRetainer = assignment.monthlyRetainer || assignment.ratesSnapshot?.monthlyRetainer;
  
  let calculatedFee = null;
  let calculation = null;
  
  // Site visits and client meetings
  if (activityType === 'site_visit' || activityType === 'client_meeting') {
    // Prefer per-visit rate if available
    if (perVisitRate && perVisitRate > 0) {
      calculatedFee = perVisitRate;
      calculation = {
        method: 'per_visit_rate',
        rate: perVisitRate,
        formula: `Per-visit rate: ${perVisitRate.toLocaleString()} KES`,
      };
    } 
    // Fallback to hourly if duration provided
    else if (hourlyRate && hourlyRate > 0 && activity.visitDuration && activity.visitDuration > 0) {
      calculatedFee = hourlyRate * activity.visitDuration;
      calculation = {
        method: 'hourly_rate',
        rate: hourlyRate,
        duration: activity.visitDuration,
        formula: `${hourlyRate.toLocaleString()}/hr × ${activity.visitDuration} hours = ${calculatedFee.toLocaleString()} KES`,
      };
    }
  }
  
  // Inspections and quality checks
  else if (activityType === 'inspection' || activityType === 'quality_check') {
    // Use hourly rate × duration if available
    if (hourlyRate && hourlyRate > 0 && activity.inspectionDuration && activity.inspectionDuration > 0) {
      calculatedFee = hourlyRate * activity.inspectionDuration;
      calculation = {
        method: 'hourly_rate',
        rate: hourlyRate,
        duration: activity.inspectionDuration,
        formula: `${hourlyRate.toLocaleString()}/hr × ${activity.inspectionDuration} hours = ${calculatedFee.toLocaleString()} KES`,
      };
    }
    // Fallback to per-visit rate
    else if (perVisitRate && perVisitRate > 0) {
      calculatedFee = perVisitRate;
      calculation = {
        method: 'per_visit_rate',
        rate: perVisitRate,
        formula: `Per-visit rate: ${perVisitRate.toLocaleString()} KES`,
      };
    }
  }
  
  // Design revisions
  else if (activityType === 'design_revision') {
    // Default to 2 hours if no duration specified
    const hours = activity.revisionDuration || 2;
    if (hourlyRate && hourlyRate > 0) {
      calculatedFee = hourlyRate * hours;
      calculation = {
        method: 'hourly_rate',
        rate: hourlyRate,
        duration: hours,
        formula: `${hourlyRate.toLocaleString()}/hr × ${hours} hours = ${calculatedFee.toLocaleString()} KES`,
      };
    }
  }
  
  if (!calculatedFee) {
    return {
      calculatedFee: null,
      calculation: null,
      error: 'No applicable rates found for this activity type',
    };
  }
  
  return {
    calculatedFee,
    calculation,
    error: null,
  };
}

/**
 * Get suggested fee amount based on fee type and assignment rates
 * @param {string} feeType - Fee type
 * @param {Object} assignment - Assignment object with rates
 * @returns {Object} Suggested fee amount and calculation
 */
export function getSuggestedFeeAmount(feeType, assignment) {
  if (!feeType || !assignment) {
    return {
      suggestedAmount: null,
      calculation: null,
      error: 'Fee type and assignment are required',
    };
  }
  
  const hourlyRate = assignment.hourlyRate || assignment.ratesSnapshot?.hourlyRate;
  const perVisitRate = assignment.perVisitRate || assignment.ratesSnapshot?.perVisitRate;
  const perFloorRate = assignment.perFloorRate || assignment.ratesSnapshot?.perFloorRate;
  const monthlyRetainer = assignment.monthlyRetainer || assignment.ratesSnapshot?.monthlyRetainer;
  
  let suggestedAmount = null;
  let calculation = null;
  
  // Map fee types to rate suggestions
  const isPerFloor = assignment.paymentSchedule === 'per_floor';

  const feeTypeMap = {
    site_visit: (isPerFloor ? perFloorRate : perVisitRate) || hourlyRate,
    inspection_fee: hourlyRate || perVisitRate,
    design_fee: hourlyRate ? hourlyRate * 2 : null, // Default 2 hours
    revision_fee: hourlyRate ? hourlyRate * 2 : null, // Default 2 hours
    retainer: monthlyRetainer,
    milestone_payment: null, // Manual entry
    lump_sum: null, // Manual entry
  };
  
  suggestedAmount = feeTypeMap[feeType];
  
  if (suggestedAmount) {
    if (feeType === 'site_visit' && isPerFloor && perFloorRate) {
      calculation = {
        method: 'per_floor_rate',
        rate: perFloorRate,
        formula: `Per-floor rate: ${perFloorRate.toLocaleString()} KES`,
      };
    } else if (feeType === 'site_visit' && perVisitRate) {
      calculation = {
        method: 'per_visit_rate',
        rate: perVisitRate,
        formula: `Per-visit rate: ${perVisitRate.toLocaleString()} KES`,
      };
    } else if (feeType === 'design_fee' || feeType === 'revision_fee') {
      calculation = {
        method: 'hourly_rate_estimate',
        rate: hourlyRate,
        estimatedHours: 2,
        formula: `${hourlyRate.toLocaleString()}/hr × 2 hours (estimated) = ${suggestedAmount.toLocaleString()} KES`,
      };
    } else if (feeType === 'retainer') {
      calculation = {
        method: 'monthly_retainer',
        rate: monthlyRetainer,
        formula: `Monthly retainer: ${monthlyRetainer.toLocaleString()} KES`,
      };
    } else {
      calculation = {
        method: 'hourly_rate',
        rate: hourlyRate,
        formula: `Hourly rate: ${hourlyRate.toLocaleString()}/hr`,
      };
    }
  }
  
  return {
    suggestedAmount,
    calculation,
    error: suggestedAmount ? null : 'No applicable rate found for this fee type',
  };
}

/**
 * Validate fee amount against contract value
 * @param {number} feeAmount - Fee amount to validate
 * @param {Object} assignment - Assignment object
 * @param {number} existingFees - Existing fees total (optional)
 * @returns {Object} Validation result
 */
export function validateFeeAmount(feeAmount, assignment, existingFees = 0) {
  if (!feeAmount || feeAmount <= 0) {
    return {
      isValid: false,
      warning: null,
      error: 'Fee amount must be greater than 0',
    };
  }
  
  if (!assignment || !assignment.contractValue) {
    return {
      isValid: true,
      warning: null,
      error: null,
    };
  }
  
  const contractValue = assignment.contractValue || 0;
  const totalFees = (assignment.totalFees || 0) + (existingFees || 0);
  const newTotal = totalFees + feeAmount;
  
  // Check if exceeds contract value
  if (newTotal > contractValue) {
    const excess = newTotal - contractValue;
    return {
      isValid: false,
      warning: `This fee would exceed the contract value by ${excess.toLocaleString()} KES`,
      error: `Total fees (${newTotal.toLocaleString()} KES) exceeds contract value (${contractValue.toLocaleString()} KES)`,
    };
  }
  
  // Check if approaching limit (within 10%)
  const remaining = contractValue - totalFees;
  const percentageUsed = (totalFees / contractValue) * 100;
  const newPercentageUsed = (newTotal / contractValue) * 100;
  
  if (newPercentageUsed > 90) {
    return {
      isValid: true,
      warning: `Warning: This fee will use ${newPercentageUsed.toFixed(1)}% of the contract value. Only ${remaining.toLocaleString()} KES remaining.`,
      error: null,
    };
  }
  
  return {
    isValid: true,
    warning: null,
    error: null,
  };
}

/**
 * Get rates from assignment (with fallback to library)
 * @param {Object} assignment - Assignment object
 * @param {Object} library - Library object (optional, for fallback)
 * @returns {Object} Rates object
 */
export function getRatesFromAssignment(assignment, library = null) {
  // Prefer rates from assignment (denormalized)
  if (assignment && (assignment.hourlyRate || assignment.perVisitRate || assignment.monthlyRetainer)) {
    return {
      hourlyRate: assignment.hourlyRate || assignment.ratesSnapshot?.hourlyRate || null,
      perVisitRate: assignment.perVisitRate || assignment.ratesSnapshot?.perVisitRate || null,
      monthlyRetainer: assignment.monthlyRetainer || assignment.ratesSnapshot?.monthlyRetainer || null,
      source: 'assignment',
    };
  }
  
  // Fallback to library
  if (library) {
    return {
      hourlyRate: library.defaultHourlyRate || null,
      perVisitRate: library.defaultPerVisitRate || null,
      monthlyRetainer: library.defaultMonthlyRetainer || null,
      source: 'library',
    };
  }
  
  return {
    hourlyRate: null,
    perVisitRate: null,
    monthlyRetainer: null,
    source: null,
  };
}
