/**
 * Multiple Supplier Assignment Component
 * Assigns materials to different suppliers
 */

'use client';

import { useState, useEffect } from 'react';

export function MultiSupplierAssignment({
  materialRequests = [],
  suppliers = [],
  onAssignmentChange,
  initialData = null,
}) {
  const [assignments, setAssignments] = useState(() => {
    if (initialData && Array.isArray(initialData)) {
      return initialData;
    }
    // Initialize with empty assignments for each material
    return materialRequests.map((req) => ({
      materialRequestId: req._id?.toString() || req.id?.toString(),
      supplierId: '',
      unitCost: req.estimatedUnitCost || '',
      deliveryDate: '',
      notes: '',
    }));
  });

  useEffect(() => {
    // Notify parent of changes
    onAssignmentChange(assignments);
  }, [assignments, onAssignmentChange]);

  const handleAssignmentChange = (index, field, value) => {
    setAssignments((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleGroupBySupplier = () => {
    // Group materials by supplier and set common delivery date
    const grouped = {};
    assignments.forEach((assignment) => {
      if (assignment.supplierId) {
        if (!grouped[assignment.supplierId]) {
          grouped[assignment.supplierId] = {
            supplierId: assignment.supplierId,
            deliveryDate: assignment.deliveryDate || '',
            materials: [],
          };
        }
        grouped[assignment.supplierId].materials.push(assignment);
      }
    });

    // Set common delivery date for all materials in each group
    setAssignments((prev) => {
      return prev.map((assignment) => {
        if (assignment.supplierId && grouped[assignment.supplierId]) {
          return {
            ...assignment,
            deliveryDate: grouped[assignment.supplierId].deliveryDate || assignment.deliveryDate,
          };
        }
        return assignment;
      });
    });
  };

  const handleClearAll = () => {
    setAssignments(
      materialRequests.map((req) => ({
        materialRequestId: req._id?.toString() || req.id?.toString(),
        supplierId: '',
        unitCost: req.estimatedUnitCost || '',
        deliveryDate: '',
        notes: '',
      }))
    );
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getMaterialName = (requestId) => {
    const request = materialRequests.find(
      (r) => (r._id?.toString() || r.id?.toString()) === requestId
    );
    return request?.materialName || 'Unknown Material';
  };

  const isValid = assignments.every((a) => a.supplierId && a.deliveryDate);

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Assign suppliers to each material. All materials must have a supplier and delivery date.
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGroupBySupplier}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Group by Supplier
          </button>
          <button
            onClick={handleClearAll}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Validation Status */}
      {!isValid && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ Please assign a supplier and delivery date for all materials before proceeding.
          </p>
        </div>
      )}

      {/* Assignment Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Material
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Quantity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Supplier <span className="text-red-500">*</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Unit Cost
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Delivery Date <span className="text-red-500">*</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assignments.map((assignment, index) => {
                const material = materialRequests.find(
                  (r) => (r._id?.toString() || r.id?.toString()) === assignment.materialRequestId
                );
                const hasSupplier = !!assignment.supplierId;
                const hasDeliveryDate = !!assignment.deliveryDate;

                return (
                  <tr
                    key={assignment.materialRequestId}
                    className={`hover:bg-gray-50 ${
                      !hasSupplier || !hasDeliveryDate ? 'bg-yellow-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {material?.materialName || 'Unknown'}
                      </div>
                      {material?.description && (
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {material.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {material?.quantityNeeded} {material?.unit}
                    </td>
                    <td className="px-4 py-3">
                      {suppliers.length === 0 ? (
                        <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-300 rounded p-2">
                          No suppliers available. Add suppliers using the button above.
                        </div>
                      ) : (
                        <select
                          value={assignment.supplierId}
                          onChange={(e) => handleAssignmentChange(index, 'supplierId', e.target.value)}
                          required
                          className={`w-full px-2 py-1 bg-white text-gray-900 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            !hasSupplier ? 'border-yellow-300 bg-yellow-50' : 'border-gray-300'
                          }`}
                        >
                          <option value="" className="text-gray-900">Select supplier</option>
                          {suppliers.map((supplier) => {
                            const supplierId = supplier._id?.toString() || supplier.id?.toString() || '';
                            const displayName = supplier.name || supplier.contactPerson || supplier.email || 'Unknown Supplier';
                            return (
                              <option key={supplierId} value={supplierId} className="text-gray-900">
                                {displayName}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={assignment.unitCost}
                        onChange={(e) => handleAssignmentChange(index, 'unitCost', e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="w-24 px-2 py-1 bg-white text-gray-900 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={assignment.deliveryDate}
                        onChange={(e) => handleAssignmentChange(index, 'deliveryDate', e.target.value)}
                        required
                        min={new Date().toISOString().split('T')[0]}
                        className={`w-full px-2 py-1 bg-white text-gray-900 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                          !hasDeliveryDate ? 'border-yellow-300 bg-yellow-50' : 'border-gray-300'
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={assignment.notes}
                        onChange={(e) => handleAssignmentChange(index, 'notes', e.target.value)}
                        placeholder="Optional notes"
                        className="w-full px-2 py-1 bg-white text-gray-900 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary by Supplier */}
      {assignments.some((a) => a.supplierId) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Summary by Supplier</h4>
          <div className="space-y-2">
            {Object.entries(
              assignments.reduce((acc, assignment) => {
                if (assignment.supplierId) {
                  const supplier = suppliers.find(
                    (s) => (s._id?.toString() || s.id?.toString()) === assignment.supplierId
                  );
                  const supplierName = supplier?.name || supplier?.contactPerson || 'Unknown Supplier';
                  if (!acc[supplierName]) {
                    acc[supplierName] = [];
                  }
                  acc[supplierName].push(assignment);
                }
                return acc;
              }, {})
            ).map(([supplierName, materials]) => (
              <div key={supplierName} className="text-sm text-gray-700">
                <strong>{supplierName}:</strong> {materials.length} material(s)
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

