/**
 * Import Helper Functions
 * Functions for parsing and importing materials from CSV
 */

/**
 * Parse CSV material list
 * @param {string} csvText - CSV text content
 * @returns {Array<Object>} Parsed materials array
 */
export function parseMaterialCSV(csvText) {
  const lines = csvText.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }

  // Parse header (first line)
  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());

  // Find column indices
  const nameIndex = headers.findIndex((h) => h.includes('name') || h.includes('material'));
  const quantityIndex = headers.findIndex((h) => h.includes('quantity') || h.includes('qty'));
  const unitIndex = headers.findIndex((h) => h === 'unit' || h.includes('unit'));
  const categoryIndex = headers.findIndex((h) => h.includes('category'));
  const costIndex = headers.findIndex((h) => h.includes('cost') || h.includes('price'));

  // Parse data rows
  const materials = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]
      .split(',')
      .map((v) => v.trim().replace(/^"|"$/g, ''));

    const name = nameIndex >= 0 ? values[nameIndex] : '';
    const quantity = quantityIndex >= 0 ? parseFloat(values[quantityIndex]) : 1;
    const unit = unitIndex >= 0 ? values[unitIndex] : 'piece';
    const category = categoryIndex >= 0 ? values[categoryIndex] : '';
    const cost = costIndex >= 0 ? parseFloat(values[costIndex]) : null;

    if (name && name.length >= 2 && !isNaN(quantity) && quantity > 0) {
      materials.push({
        name: name.trim(),
        quantityNeeded: quantity,
        unit: unit.trim() || 'piece',
        category: category.trim() || '',
        estimatedUnitCost: cost && !isNaN(cost) && cost >= 0 ? cost : null,
      });
    }
  }

  return materials;
}

/**
 * Validate imported materials
 * @param {Array<Object>} materials - Array of material objects
 * @returns {{isValid: boolean, errors: Array<string>, validMaterials: Array<Object>}}
 */
export function validateImportedMaterials(materials) {
  const errors = [];
  const validMaterials = [];

  materials.forEach((material, index) => {
    const materialErrors = [];

    if (!material.name || material.name.trim().length < 2) {
      materialErrors.push('Name must be at least 2 characters');
    }

    if (!material.quantityNeeded || parseFloat(material.quantityNeeded) <= 0) {
      materialErrors.push('Quantity must be greater than 0');
    }

    if (!material.unit || material.unit.trim().length === 0) {
      materialErrors.push('Unit is required');
    }

    if (material.estimatedUnitCost !== undefined && parseFloat(material.estimatedUnitCost) < 0) {
      materialErrors.push('Estimated unit cost must be >= 0');
    }

    if (materialErrors.length === 0) {
      validMaterials.push(material);
    } else {
      errors.push(`Material ${index + 1} (${material.name || 'Unknown'}): ${materialErrors.join(', ')}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    validMaterials,
  };
}

/**
 * Import materials from CSV
 * @param {string} csvText - CSV text content
 * @param {string} projectId - Project ID for defaults
 * @param {Object} defaults - Default values (urgency, reason, etc.)
 * @returns {{isValid: boolean, errors: Array<string>, materials: Array<Object>}}
 */
export async function importMaterialsFromCSV(csvText, projectId, defaults = {}) {
  try {
    // Parse CSV
    const parsedMaterials = parseMaterialCSV(csvText);

    if (parsedMaterials.length === 0) {
      return {
        isValid: false,
        errors: ['No valid materials found in CSV'],
        materials: [],
      };
    }

    // Validate
    const validation = validateImportedMaterials(parsedMaterials);

    // Apply defaults
    const materialsWithDefaults = validation.validMaterials.map((m) => ({
      ...m,
      urgency: m.urgency || defaults.defaultUrgency || 'medium',
      reason: m.reason || defaults.defaultReason || '',
      categoryId: m.categoryId || null,
      floorId: m.floorId || defaults.defaultFloorId || null,
    }));

    return {
      isValid: validation.isValid,
      errors: validation.errors,
      materials: materialsWithDefaults,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Error parsing CSV: ${error.message}`],
      materials: [],
    };
  }
}

