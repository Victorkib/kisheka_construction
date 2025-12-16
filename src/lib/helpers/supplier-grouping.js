/**
 * Supplier Grouping Helper Functions
 * Groups material requests by supplier for purchase order creation
 */

/**
 * Group material requests by supplier
 * @param {Array<Object>} assignments - Array of assignment objects with supplierId and materialRequestIds
 * @returns {Object} Grouped assignments by supplier
 */
export function groupRequestsBySupplier(assignments) {
  const grouped = {};

  assignments.forEach((assignment) => {
    const supplierId = assignment.supplierId?.toString();
    if (!supplierId) return;

    if (!grouped[supplierId]) {
      grouped[supplierId] = {
        supplierId: assignment.supplierId,
        materialRequestIds: [],
        deliveryDate: assignment.deliveryDate,
        terms: assignment.terms,
        notes: assignment.notes,
        materialOverrides: [],
      };
    }

    // Add material request IDs
    if (Array.isArray(assignment.materialRequestIds)) {
      grouped[supplierId].materialRequestIds.push(...assignment.materialRequestIds);
    } else if (assignment.materialRequestId) {
      grouped[supplierId].materialRequestIds.push(assignment.materialRequestId);
    }

    // Merge material overrides if provided
    if (Array.isArray(assignment.materialOverrides)) {
      grouped[supplierId].materialOverrides.push(...assignment.materialOverrides);
    }
  });

  // Remove duplicates from materialRequestIds
  Object.keys(grouped).forEach((supplierId) => {
    grouped[supplierId].materialRequestIds = [
      ...new Set(grouped[supplierId].materialRequestIds.map((id) => id.toString())),
    ];
  });

  return grouped;
}

/**
 * Convert multiple supplier assignments to grouped format
 * @param {Array<Object>} assignments - Array of per-material assignments
 * @returns {Array<Object>} Grouped assignments by supplier
 */
export function convertToSupplierGroups(assignments) {
  const grouped = {};

  assignments.forEach((assignment) => {
    const supplierId = assignment.supplierId?.toString();
    if (!supplierId) return;

    if (!grouped[supplierId]) {
      grouped[supplierId] = {
        supplierId: assignment.supplierId,
        materialRequestIds: [],
        deliveryDate: assignment.deliveryDate || '',
        terms: assignment.terms || '',
        notes: assignment.notes || '',
        materialOverrides: [],
      };
    }

    // Add material request ID
    if (assignment.materialRequestId) {
      grouped[supplierId].materialRequestIds.push(assignment.materialRequestId.toString());
    }

    // Add material override if unit cost or notes provided
    if (assignment.unitCost || assignment.notes) {
      grouped[supplierId].materialOverrides.push({
        materialRequestId: assignment.materialRequestId?.toString(),
        unitCost: assignment.unitCost ? parseFloat(assignment.unitCost) : undefined,
        notes: assignment.notes || undefined,
      });
    }
  });

  return Object.values(grouped);
}

/**
 * Validate supplier assignments
 * @param {Array<Object>} assignments - Array of assignments
 * @returns {{isValid: boolean, errors: Array<string>}}
 */
export function validateSupplierAssignments(assignments) {
  const errors = [];

  if (!Array.isArray(assignments) || assignments.length === 0) {
    errors.push('No assignments provided');
    return { isValid: false, errors };
  }

  assignments.forEach((assignment, index) => {
    if (!assignment.supplierId) {
      errors.push(`Assignment ${index + 1}: Supplier is required`);
    }
    if (!assignment.deliveryDate) {
      errors.push(`Assignment ${index + 1}: Delivery date is required`);
    }
    if (
      !assignment.materialRequestIds ||
      (Array.isArray(assignment.materialRequestIds) && assignment.materialRequestIds.length === 0)
    ) {
      errors.push(`Assignment ${index + 1}: At least one material request is required`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

