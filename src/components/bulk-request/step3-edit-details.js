/**
 * Step 3: Edit Details Component
 * Editable table for editing material details
 */

'use client';

import { useState, useEffect } from 'react';
import { VALID_UNITS } from '@/lib/schemas/material-library-schema';

export function Step3EditDetails({ wizardData, onUpdate, onValidationChange }) {
  const [materials, setMaterials] = useState(wizardData.materials || []);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [categories, setCategories] = useState([]);
  const [floors, setFloors] = useState([]);
  const [editingRow, setEditingRow] = useState(null);

  useEffect(() => {
    const materialsFromWizard = wizardData.materials || [];
    // Auto-populate missing defaults from Step 1
    const materialsWithDefaults = materialsFromWizard.map((material) => ({
      ...material,
      // Only set defaults if not already present
      floorId: material.floorId || wizardData.defaultFloorId || '',
      categoryId: material.categoryId || wizardData.defaultCategoryId || '',
      category: material.category || '',
      urgency: material.urgency || wizardData.defaultUrgency || 'medium',
      reason: material.reason || wizardData.defaultReason || '',
    }));
    setMaterials(materialsWithDefaults);
    // Update wizard data if defaults were applied
    if (materialsWithDefaults.some((m, idx) => {
      const original = materialsFromWizard[idx];
      return m.floorId !== original?.floorId || 
             m.categoryId !== original?.categoryId ||
             m.urgency !== original?.urgency ||
             m.reason !== original?.reason;
    })) {
      onUpdate({ materials: materialsWithDefaults });
    }
  }, [wizardData.materials, wizardData.defaultFloorId, wizardData.defaultCategoryId, wizardData.defaultUrgency, wizardData.defaultReason, onUpdate]);

  useEffect(() => {
    fetchCategories();
    if (wizardData.projectId) {
      fetchFloors(wizardData.projectId);
    }
  }, [wizardData.projectId]);

  useEffect(() => {
    // Validate all materials
    // Check that each material has: name (min 2 chars), quantity (> 0), and unit
    // Support both 'name' and 'materialName' fields for backward compatibility
    const isValid = materials.length > 0 && materials.every((m) => {
      const materialName = m.name || m.materialName || '';
      const hasName = materialName && typeof materialName === 'string' && materialName.trim().length >= 2;
      const quantity = parseFloat(m.quantityNeeded || m.quantity || 0);
      const hasQuantity = !isNaN(quantity) && quantity > 0;
      const hasUnit = (m.unit && m.unit.trim().length > 0);
      
      // Debug logging for first invalid material
      if (!hasName || !hasQuantity || !hasUnit) {
        console.log('[Step3 Validation] Invalid material:', {
          material: m,
          hasName,
          hasQuantity,
          hasUnit,
          name: materialName,
          quantity: quantity,
          unit: m.unit
        });
      }
      
      return hasName && hasQuantity && hasUnit;
    });
    
    console.log('[Step3 Validation] Overall validation result:', isValid, 'for', materials.length, 'materials');
    onValidationChange(isValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials]); // onValidationChange is stable (memoized in parent)

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchFloors = async (projectId) => {
    try {
      const response = await fetch(`/api/floors?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setFloors(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching floors:', err);
    }
  };

  const handleMaterialUpdate = (index, field, value) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate total cost if unit cost or quantity changes
    if (field === 'estimatedUnitCost' || field === 'quantityNeeded') {
      const unitCost = field === 'estimatedUnitCost' ? parseFloat(value) : updated[index].estimatedUnitCost;
      const quantity = field === 'quantityNeeded' ? parseFloat(value) : updated[index].quantityNeeded;
      if (unitCost && quantity) {
        updated[index].estimatedCost = unitCost * quantity;
      } else {
        updated[index].estimatedCost = null;
      }
    }
    
    setMaterials(updated);
    onUpdate({ materials: updated });
  };

  const handleRemove = (index) => {
    const updated = materials.filter((_, i) => i !== index);
    setMaterials(updated);
    onUpdate({ materials: updated });
    setSelectedRows((prev) => {
      const newSet = new Set();
      prev.forEach((idx) => {
        if (idx < index) newSet.add(idx);
        else if (idx > index) newSet.add(idx - 1);
      });
      return newSet;
    });
  };

  const handleDuplicate = (index) => {
    const material = { ...materials[index] };
    const updated = [...materials];
    updated.splice(index + 1, 0, material);
    setMaterials(updated);
    onUpdate({ materials: updated });
  };

  const handleSelectRow = (index) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedRows.size === materials.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(materials.map((_, i) => i)));
    }
  };

  const handleBulkRemove = () => {
    const updated = materials.filter((_, i) => !selectedRows.has(i));
    setMaterials(updated);
    onUpdate({ materials: updated });
    setSelectedRows(new Set());
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateTotals = () => {
    const totalMaterials = materials.length;
    const totalCost = materials.reduce((sum, m) => {
      const cost = m.estimatedCost || (m.estimatedUnitCost && m.quantityNeeded ? m.estimatedUnitCost * m.quantityNeeded : 0);
      return sum + cost;
    }, 0);
    return { totalMaterials, totalCost };
  };

  const totals = calculateTotals();

  if (materials.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No materials to edit</p>
        <p className="text-sm text-gray-500 mt-2">Go back to Step 2 to add materials</p>
      </div>
    );
  }

  // Check validation status for display
  const validationStatus = materials.map((m) => {
    const materialName = m.name || m.materialName || '';
    const hasName = materialName && typeof materialName === 'string' && materialName.trim().length >= 2;
    const quantity = parseFloat(m.quantityNeeded || m.quantity || 0);
    const hasQuantity = !isNaN(quantity) && quantity > 0;
    const hasUnit = (m.unit && m.unit.trim().length > 0);
    return { hasName, hasQuantity, hasUnit, isValid: hasName && hasQuantity && hasUnit };
  });
  const allValid = validationStatus.every((v) => v.isValid);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Material Details</h2>
        <p className="text-sm text-gray-600 mb-6">
          Review and edit details for each material. You can modify quantities, costs, categories, and other fields.
        </p>
        {!allValid && materials.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800 font-medium mb-2">
              ⚠️ Please complete all required fields (Material Name, Quantity, Unit) for all materials to proceed.
            </p>
            <div className="text-xs text-yellow-700">
              {validationStatus.map((v, idx) => 
                !v.isValid && (
                  <div key={idx} className="mt-1">
                    Material #{idx + 1}: Missing {!v.hasName && 'Name'} {!v.hasQuantity && 'Quantity'} {!v.hasUnit && 'Unit'}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedRows.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedRows.size} material(s) selected
            </span>
            <button
              onClick={handleBulkRemove}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              Remove Selected
            </button>
          </div>
        </div>
      )}

      {/* Materials Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size > 0 && selectedRows.size === materials.length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Material</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Unit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Floor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Urgency</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Unit Cost</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Total Cost</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {materials.map((material, index) => {
                const materialName = material.name || material.materialName || '';
                const hasName = materialName && typeof materialName === 'string' && materialName.trim().length >= 2;
                const quantity = parseFloat(material.quantityNeeded || material.quantity || 0);
                const hasQuantity = !isNaN(quantity) && quantity > 0;
                const hasUnit = (material.unit && material.unit.trim().length > 0);
                const isValid = hasName && hasQuantity && hasUnit;
                
                return (
                <tr key={index} className={`hover:bg-gray-50 ${!isValid ? 'bg-yellow-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(index)}
                      onChange={() => handleSelectRow(index)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={material.name || material.materialName || ''}
                      onChange={(e) => handleMaterialUpdate(index, 'name', e.target.value)}
                      className="w-full px-2 py-1 bg-white text-gray-900 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
                      placeholder="Material name"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={material.quantityNeeded || ''}
                      onChange={(e) => handleMaterialUpdate(index, 'quantityNeeded', e.target.value)}
                      min="0.01"
                      step="0.01"
                      className="w-24 px-2 py-1 bg-white text-gray-900 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={material.unit || 'piece'}
                      onChange={(e) => handleMaterialUpdate(index, 'unit', e.target.value)}
                      className="w-32 px-2 py-1 bg-white text-gray-900 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {VALID_UNITS.map((unit) => (
                        <option key={unit} value={unit} className="text-gray-900">
                          {unit}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={material.categoryId || ''}
                      onChange={(e) => {
                        const category = categories.find((c) => c._id === e.target.value);
                        handleMaterialUpdate(index, 'categoryId', e.target.value);
                        if (category) {
                          handleMaterialUpdate(index, 'category', category.name);
                        }
                      }}
                      className="w-40 px-2 py-1 bg-white text-gray-900 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="" className="text-gray-900">None</option>
                      {categories.map((cat) => (
                        <option key={cat._id} value={cat._id} className="text-gray-900">
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={material.floorId || ''}
                      onChange={(e) => handleMaterialUpdate(index, 'floorId', e.target.value)}
                      className="w-32 px-2 py-1 bg-white text-gray-900 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="" className="text-gray-900">None</option>
                      {floors.map((floor) => {
                        const getFloorDisplay = (floorNumber, name) => {
                          if (name) return name;
                          if (floorNumber === undefined || floorNumber === null) return 'N/A';
                          if (floorNumber < 0) return `Basement ${Math.abs(floorNumber)}`;
                          if (floorNumber === 0) return 'Ground Floor';
                          return `Floor ${floorNumber}`;
                        };
                        return (
                          <option key={floor._id} value={floor._id} className="text-gray-900">
                            {getFloorDisplay(floor.floorNumber, floor.floorName || floor.name)}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={material.urgency || wizardData.defaultUrgency || 'medium'}
                      onChange={(e) => handleMaterialUpdate(index, 'urgency', e.target.value)}
                      className="w-28 px-2 py-1 bg-white text-gray-900 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="low" className="text-gray-900">Low</option>
                      <option value="medium" className="text-gray-900">Medium</option>
                      <option value="high" className="text-gray-900">High</option>
                      <option value="critical" className="text-gray-900">Critical</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={material.estimatedUnitCost || ''}
                      onChange={(e) => handleMaterialUpdate(index, 'estimatedUnitCost', e.target.value)}
                      min="0"
                      step="0.01"
                      className="w-24 px-2 py-1 bg-white text-gray-900 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatCurrency(material.estimatedCost || (material.estimatedUnitCost && material.quantityNeeded ? material.estimatedUnitCost * material.quantityNeeded : 0))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDuplicate(index)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                        title="Duplicate"
                      >
                        📋
                      </button>
                      <button
                        onClick={() => handleRemove(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                        title="Remove"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Materials</p>
            <p className="text-2xl font-bold text-gray-900">{totals.totalMaterials}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Estimated Cost</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.totalCost)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Average Cost per Material</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(totals.totalMaterials > 0 ? totals.totalCost / totals.totalMaterials : 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

