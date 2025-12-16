/**
 * Export Helper Functions
 * Functions for exporting batches and material library to CSV/Excel
 */

/**
 * Export batch to CSV
 * @param {Object} batch - Batch document
 * @param {Array<Object>} materialRequests - Array of material request documents
 * @returns {string} CSV content
 */
export function exportBatchToCSV(batch, materialRequests) {
  const headers = [
    'Request Number',
    'Material Name',
    'Description',
    'Quantity',
    'Unit',
    'Category',
    'Urgency',
    'Estimated Unit Cost (KES)',
    'Estimated Total Cost (KES)',
    'Reason',
    'Notes',
    'Status',
  ];

  const rows = materialRequests.map((req) => [
    req.requestNumber || '',
    req.materialName || '',
    req.description || '',
    req.quantityNeeded || 0,
    req.unit || '',
    req.category || '',
    req.urgency || '',
    req.estimatedUnitCost || 0,
    req.estimatedCost || 0,
    req.reason || '',
    req.notes || '',
    req.status || '',
  ]);

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return csvContent;
}

/**
 * Export batch to Excel (returns CSV for now, can be enhanced with Excel library)
 * @param {Object} batch - Batch document
 * @param {Array<Object>} materialRequests - Array of material request documents
 * @returns {Promise<string>} CSV content (can be enhanced to return Excel buffer)
 */
export async function exportBatchToExcel(batch, materialRequests) {
  // For now, return CSV format
  // Can be enhanced with a library like 'xlsx' or 'exceljs' for actual Excel format
  return exportBatchToCSV(batch, materialRequests);
}

/**
 * Export material library to CSV
 * @param {Array<Object>} materials - Array of material library documents
 * @returns {string} CSV content
 */
export function exportLibraryToCSV(materials) {
  const headers = [
    'Name',
    'Description',
    'Category',
    'Default Unit',
    'Default Unit Cost (KES)',
    'Material Code',
    'Brand',
    'Specifications',
    'Usage Count',
    'Is Common',
    'Is Active',
  ];

  const rows = materials.map((material) => [
    material.name || '',
    material.description || '',
    material.category || '',
    material.defaultUnit || '',
    material.defaultUnitCost || 0,
    material.materialCode || '',
    material.brand || '',
    material.specifications || '',
    material.usageCount || 0,
    material.isCommon ? 'Yes' : 'No',
    material.isActive ? 'Yes' : 'No',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return csvContent;
}

/**
 * Download CSV file
 * @param {string} content - CSV content
 * @param {string} filename - Filename for download
 */
export function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

