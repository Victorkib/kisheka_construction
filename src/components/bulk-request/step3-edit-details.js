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
  const [expandedMobileRows, setExpandedMobileRows] = useState(new Set());
  const [showAdvancedColumns, setShowAdvancedColumns] = useState(true);
  const [categories, setCategories] = useState([]);
  const [floors, setFloors] = useState([]);
  const [phases, setPhases] = useState([]);
  const [applicableFloorsMap, setApplicableFloorsMap] = useState({}); // phaseId -> applicable floors
  const [phaseInfoMap, setPhaseInfoMap] = useState({}); // phaseId -> phase info
  const [editingRow, setEditingRow] = useState(null);

  useEffect(() => {
    const materialsFromWizard = wizardData.materials || [];
    // Auto-populate missing defaults from Step 1
    const materialsWithDefaults = materialsFromWizard.map((material) => ({
      ...material,
      // Only set defaults if not already present
      floorId: material.floorId || wizardData.defaultFloorId || '',
      phaseId: material.phaseId || wizardData.defaultPhaseId || '',
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
             m.phaseId !== original?.phaseId ||
             m.categoryId !== original?.categoryId ||
             m.urgency !== original?.urgency ||
             m.reason !== original?.reason;
    })) {
      onUpdate({ materials: materialsWithDefaults });
    }
  }, [wizardData.materials, wizardData.defaultFloorId, wizardData.defaultPhaseId, wizardData.defaultCategoryId, wizardData.defaultUrgency, wizardData.defaultReason, onUpdate]);

  useEffect(() => {
    fetchCategories();
    if (wizardData.projectId) {
      fetchFloors(wizardData.projectId);
      fetchPhases(wizardData.projectId);
    }
  }, [wizardData.projectId]);

  useEffect(() => {
    // Validate all materials
    // Check that each material has: name (min 2 chars), quantity (> 0), unit, and phaseId
    // Support both 'name' and 'materialName' fields for backward compatibility
    // Phase Enforcement: Each material must have phaseId (either from default or per-material)
    const isValid = materials.length > 0 && materials.every((m) => {
      const materialName = m.name || m.materialName || '';
      const hasName = materialName && typeof materialName === 'string' && materialName.trim().length >= 2;
      const quantity = parseFloat(m.quantityNeeded || m.quantity || 0);
      const hasQuantity = !isNaN(quantity) && quantity > 0;
      const hasUnit = (m.unit && m.unit.trim().length > 0);
      // Phase Enforcement: Material must have phaseId (from default or per-material)
      const hasPhaseId = !!(m.phaseId || wizardData.defaultPhaseId);
      
      // Debug logging for first invalid material
      if (!hasName || !hasQuantity || !hasUnit || !hasPhaseId) {
        console.log('[Step3 Validation] Invalid material:', {
          material: m,
          hasName,
          hasQuantity,
          hasUnit,
          hasPhaseId,
          phaseId: m.phaseId,
          defaultPhaseId: wizardData.defaultPhaseId,
          name: materialName,
          quantity: quantity,
          unit: m.unit
        });
      }
      
      return hasName && hasQuantity && hasUnit && hasPhaseId;
    });
    
    console.log('[Step3 Validation] Overall validation result:', isValid, 'for', materials.length, 'materials');
    onValidationChange(isValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials, wizardData.defaultPhaseId]); // onValidationChange is stable (memoized in parent)

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
      const response = await fetch(`/api/floors?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setFloors(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching floors:', err);
    }
  };

  const fetchPhases = async (projectId) => {
    try {
      const response = await fetch(`/api/phases?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
        // Pre-fetch applicable floors for all phases
        const phasesList = data.data || [];
        for (const phase of phasesList) {
          await fetchApplicableFloorsForPhase(phase._id, projectId);
        }
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
    }
  };

  const fetchApplicableFloorsForPhase = async (phaseId, projectId) => {
    if (!phaseId || !projectId) return;
    try {
      const response = await fetch(`/api/phases/${phaseId}/applicable-floors?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        const applicable = data.data.applicableFloors || [];
        const allFloors = floors.length > 0 ? floors : (data.data.allFloors || []);
        // Normalize IDs to strings for consistent comparison
        const applicableIds = new Set(applicable.map(f => {
          const id = f._id?.toString() || f.toString();
          return id;
        }));
        const applicableFloorsList = allFloors.filter(f => {
          const id = f._id?.toString() || f.toString();
          return applicableIds.has(id);
        });
        
        setApplicableFloorsMap(prev => ({
          ...prev,
          [phaseId]: applicableFloorsList
        }));
        setPhaseInfoMap(prev => ({
          ...prev,
          [phaseId]: {
            phaseCode: data.data.phaseCode,
            phaseName: data.data.phaseName
          }
        }));
      }
    } catch (err) {
      console.error(`Error fetching applicable floors for phase ${phaseId}:`, err);
    }
  };

  const handleMaterialUpdate = async (index, field, value) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    
    // If phase changed, fetch applicable floors for the new phase
    if (field === 'phaseId' && value && wizardData.projectId) {
      await fetchApplicableFloorsForPhase(value, wizardData.projectId);
      // CRITICAL FIX: Wait for fetch to complete, then check if current floor is applicable
      // Normalize IDs to strings for proper comparison
      const currentFloorId = updated[index].floorId;
      if (currentFloorId) {
        // Get applicable floors from the map (should be populated after fetch)
        const applicableFloors = applicableFloorsMap[value] || [];
        const currentFloorIdStr = currentFloorId.toString();
        const isCurrentFloorApplicable = applicableFloors.some(f => {
          const floorIdStr = f._id?.toString() || f.toString();
          return floorIdStr === currentFloorIdStr;
        });
        // Only clear if floor is NOT applicable AND there are applicable floors available
        // If floor IS applicable, keep it - don't clear it
        if (!isCurrentFloorApplicable && applicableFloors.length > 0) {
          updated[index].floorId = '';
        }
        // If floor IS applicable or no applicable floors yet, keep the selection
      }
    }
    
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

  const toggleMobileRowExpanded = (index) => {
    setExpandedMobileRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getFloorDisplay = (floorNumber, name) => {
    if (name) return name;
    if (floorNumber === undefined || floorNumber === null) return 'N/A';
    if (floorNumber < 0) return `Basement ${Math.abs(floorNumber)}`;
    if (floorNumber === 0) return 'Ground Floor';
    return `Floor ${floorNumber}`;
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
        <p className="ds-text-secondary">No materials to edit</p>
        <p className="text-sm ds-text-muted mt-2">Go back to Step 2 to add materials</p>
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
    const hasPhase = !!(m.phaseId || wizardData.defaultPhaseId);
    return { hasName, hasQuantity, hasUnit, hasPhase, isValid: hasName && hasQuantity && hasUnit && hasPhase };
  });
  const allValid = validationStatus.every((v) => v.isValid);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold ds-text-primary mb-4">Edit Material Details</h2>
        <p className="text-sm ds-text-secondary mb-6">
          Review and edit details for each material. You can modify quantities, costs, categories, and other fields.
        </p>
        {!allValid && materials.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-400/60 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800 font-medium mb-2">
              ⚠️ Please complete all required fields (Material Name, Quantity, Unit, Phase) for all materials to proceed.
            </p>
            <div className="text-xs text-yellow-700">
              {validationStatus.map((v, idx) => 
                !v.isValid && (
                  <div key={idx} className="mt-1">
                    Material #{idx + 1}: Missing {!v.hasName && 'Name'} {!v.hasQuantity && 'Quantity'} {!v.hasUnit && 'Unit'} {!v.hasPhase && 'Phase'}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedRows.size > 0 && (
        <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-4">
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

      {/* View Controls */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <p className="text-xs ds-text-secondary">
          Sticky primary columns keep material name and quantity visible while scrolling.
        </p>
        <button
          type="button"
          onClick={() => setShowAdvancedColumns((prev) => !prev)}
          className="px-3 py-2 text-xs font-medium rounded-lg border ds-border-subtle ds-text-secondary hover:ds-bg-surface-muted"
        >
          {showAdvancedColumns ? 'Hide Advanced Columns' : 'Show Advanced Columns'}
        </button>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {materials.map((material, index) => {
          const materialName = material.name || material.materialName || '';
          const quantity = material.quantityNeeded || material.quantity || '';
          const isExpanded = expandedMobileRows.has(index);
          const materialPhaseId = material.phaseId || wizardData.defaultPhaseId || '';
          const applicableFloors = materialPhaseId ? (applicableFloorsMap[materialPhaseId] || []) : [];
          const nonApplicableFloors = materialPhaseId
            ? floors.filter((f) => {
                const floorIdStr = f._id?.toString() || f.toString();
                return !applicableFloors.some((af) => {
                  const afIdStr = af._id?.toString() || af.toString();
                  return afIdStr === floorIdStr;
                });
              })
            : [];

          return (
            <div key={index} className="ds-bg-surface rounded-lg border ds-border-subtle p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold ds-text-secondary">Material #{index + 1}</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleDuplicate(index)}
                    className="text-xs ds-text-accent-primary font-medium"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="text-xs ds-text-danger font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs ds-text-secondary mb-1">Material Name</label>
                <input
                  type="text"
                  value={materialName}
                  onChange={(e) => handleMaterialUpdate(index, 'name', e.target.value)}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:ds-text-muted"
                  placeholder="Material name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs ds-text-secondary mb-1">Quantity</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => handleMaterialUpdate(index, 'quantityNeeded', e.target.value)}
                    min="0.01"
                    step="0.01"
                    className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs ds-text-secondary mb-1">Unit</label>
                  <select
                    value={material.unit || 'piece'}
                    onChange={(e) => handleMaterialUpdate(index, 'unit', e.target.value)}
                    className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {VALID_UNITS.map((unit) => (
                      <option key={unit} value={unit} className="ds-text-primary">
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs ds-text-secondary mb-1">Unit Cost</label>
                  <input
                    type="number"
                    value={material.estimatedUnitCost || ''}
                    onChange={(e) => handleMaterialUpdate(index, 'estimatedUnitCost', e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:ds-text-muted"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs ds-text-secondary mb-1">Total</label>
                  <div className="px-3 py-2 border ds-border-subtle rounded text-sm font-medium ds-text-primary">
                    {formatCurrency(material.estimatedCost || (material.estimatedUnitCost && quantity ? material.estimatedUnitCost * quantity : 0))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toggleMobileRowExpanded(index)}
                className="text-xs ds-text-accent-primary font-medium"
              >
                {isExpanded ? 'Hide Advanced Fields' : 'Show Advanced Fields'}
              </button>

              {isExpanded && (
                <div className="space-y-3 pt-1 border-t ds-border-subtle">
                  <div>
                    <label className="block text-xs ds-text-secondary mb-1">Category</label>
                    <select
                      value={material.categoryId || ''}
                      onChange={(e) => {
                        const category = categories.find((c) => c._id === e.target.value);
                        handleMaterialUpdate(index, 'categoryId', e.target.value);
                        if (category) {
                          handleMaterialUpdate(index, 'category', category.name);
                        }
                      }}
                      className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="" className="ds-text-primary">None</option>
                      {categories.map((cat) => (
                        <option key={cat._id} value={cat._id} className="ds-text-primary">
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs ds-text-secondary mb-1">
                      Phase <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={material.phaseId || wizardData.defaultPhaseId || ''}
                      onChange={(e) => handleMaterialUpdate(index, 'phaseId', e.target.value)}
                      className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        !material.phaseId && !wizardData.defaultPhaseId
                          ? 'border-red-400/60 bg-red-50'
                          : 'ds-border-subtle'
                      }`}
                    >
                      <option value="" className="ds-text-primary">
                        {wizardData.defaultPhaseId ? 'Use default' : 'Select phase (required)'}
                      </option>
                      {phases.map((phase) => (
                        <option key={phase._id} value={phase._id} className="ds-text-primary">
                          {phase.phaseName || phase.name} {phase.status ? `(${phase.status.replace('_', ' ')})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs ds-text-secondary mb-1">Floor</label>
                    <select
                      value={material.floorId || ''}
                      onChange={(e) => handleMaterialUpdate(index, 'floorId', e.target.value)}
                      className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="" className="ds-text-primary">None</option>
                      {applicableFloors.map((floor) => (
                        <option key={floor._id} value={floor._id} className="ds-text-primary">
                          {getFloorDisplay(floor.floorNumber, floor.floorName || floor.name)} ✓
                        </option>
                      ))}
                      {materialPhaseId && nonApplicableFloors.map((floor) => (
                        <option key={floor._id} value={floor._id} disabled className="ds-text-muted italic">
                          {getFloorDisplay(floor.floorNumber, floor.floorName || floor.name)} ✗
                        </option>
                      ))}
                      {!materialPhaseId && floors.map((floor) => (
                        <option key={floor._id} value={floor._id} className="ds-text-primary">
                          {getFloorDisplay(floor.floorNumber, floor.floorName || floor.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs ds-text-secondary mb-1">Urgency</label>
                    <select
                      value={material.urgency || wizardData.defaultUrgency || 'medium'}
                      onChange={(e) => handleMaterialUpdate(index, 'urgency', e.target.value)}
                      className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="low" className="ds-text-primary">Low</option>
                      <option value="medium" className="ds-text-primary">Medium</option>
                      <option value="high" className="ds-text-primary">High</option>
                      <option value="critical" className="ds-text-primary">Critical</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop / Tablet Table */}
      <div className="hidden md:block ds-bg-surface rounded-lg border ds-border-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full divide-y divide-ds-border-subtle ${showAdvancedColumns ? 'min-w-[1400px]' : 'min-w-[950px]'}`}>
            <thead className="ds-bg-surface-muted">
              <tr>
                <th className="px-4 py-3 text-left sticky left-0 z-30 ds-bg-surface-muted">
                  <input
                    type="checkbox"
                    checked={selectedRows.size > 0 && selectedRows.size === materials.length}
                    onChange={handleSelectAll}
                    className="rounded ds-border-subtle text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold ds-text-secondary uppercase min-w-[320px] sticky left-[52px] z-30 ds-bg-surface-muted">Material</th>
                <th className="px-4 py-3 text-left text-xs font-semibold ds-text-secondary uppercase sticky left-[372px] z-30 ds-bg-surface-muted">Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold ds-text-secondary uppercase">Unit</th>
                {showAdvancedColumns && <th className="px-4 py-3 text-left text-xs font-semibold ds-text-secondary uppercase">Category</th>}
                {showAdvancedColumns && <th className="px-4 py-3 text-left text-xs font-semibold ds-text-secondary uppercase">Floor</th>}
                {showAdvancedColumns && (
                  <th className="px-4 py-3 text-left text-xs font-semibold ds-text-secondary uppercase">
                    Phase <span className="text-red-500">*</span>
                  </th>
                )}
                {showAdvancedColumns && <th className="px-4 py-3 text-left text-xs font-semibold ds-text-secondary uppercase">Urgency</th>}
                <th className="px-4 py-3 text-left text-xs font-semibold ds-text-secondary uppercase">Unit Cost</th>
                <th className="px-4 py-3 text-left text-xs font-semibold ds-text-secondary uppercase">Total Cost</th>
                <th className="px-4 py-3 text-left text-xs font-semibold ds-text-secondary uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
              {materials.map((material, index) => {
                const materialName = material.name || material.materialName || '';
                const hasName = materialName && typeof materialName === 'string' && materialName.trim().length >= 2;
                const quantity = parseFloat(material.quantityNeeded || material.quantity || 0);
                const hasQuantity = !isNaN(quantity) && quantity > 0;
                const hasUnit = (material.unit && material.unit.trim().length > 0);
                const isValid = hasName && hasQuantity && hasUnit;
                const materialPhaseId = material.phaseId || wizardData.defaultPhaseId || '';
                const applicableFloors = materialPhaseId ? (applicableFloorsMap[materialPhaseId] || []) : [];
                const nonApplicableFloors = materialPhaseId
                  ? floors.filter((f) => {
                      const floorIdStr = f._id?.toString() || f.toString();
                      return !applicableFloors.some((af) => {
                        const afIdStr = af._id?.toString() || af.toString();
                        return afIdStr === floorIdStr;
                      });
                    })
                  : [];

                return (
                  <tr key={index} className={`hover:ds-bg-surface-muted ${!isValid ? 'bg-yellow-50' : ''}`}>
                    <td className="px-4 py-3 sticky left-0 z-20 ds-bg-surface">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(index)}
                        onChange={() => handleSelectRow(index)}
                        className="rounded ds-border-subtle text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 min-w-[320px] align-top sticky left-[52px] z-20 ds-bg-surface">
                      <input
                        type="text"
                        value={materialName}
                        onChange={(e) => handleMaterialUpdate(index, 'name', e.target.value)}
                        className="w-full min-w-[280px] px-2 py-1 ds-bg-surface ds-text-primary border ds-border-subtle rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:ds-text-muted"
                        placeholder="Material name"
                      />
                    </td>
                    <td className="px-4 py-3 sticky left-[372px] z-20 ds-bg-surface">
                      <input
                        type="number"
                        value={material.quantityNeeded || ''}
                        onChange={(e) => handleMaterialUpdate(index, 'quantityNeeded', e.target.value)}
                        min="0.01"
                        step="0.01"
                        className="w-20 px-2 py-1 ds-bg-surface ds-text-primary border ds-border-subtle rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={material.unit || 'piece'}
                        onChange={(e) => handleMaterialUpdate(index, 'unit', e.target.value)}
                        className="w-24 px-2 py-1 ds-bg-surface ds-text-primary border ds-border-subtle rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {VALID_UNITS.map((unit) => (
                          <option key={unit} value={unit} className="ds-text-primary">
                            {unit}
                          </option>
                        ))}
                      </select>
                    </td>
                    {showAdvancedColumns && (
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
                          className="w-36 px-2 py-1 ds-bg-surface ds-text-primary border ds-border-subtle rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="" className="ds-text-primary">None</option>
                          {categories.map((cat) => (
                            <option key={cat._id} value={cat._id} className="ds-text-primary">
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    {showAdvancedColumns && (
                      <td className="px-4 py-3">
                        <select
                          value={material.floorId || ''}
                          onChange={(e) => handleMaterialUpdate(index, 'floorId', e.target.value)}
                          className="w-36 px-2 py-1 ds-bg-surface ds-text-primary border ds-border-subtle rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="" className="ds-text-primary">None</option>
                          {applicableFloors.map((floor) => (
                            <option key={floor._id} value={floor._id} className="ds-text-primary">
                              {getFloorDisplay(floor.floorNumber, floor.floorName || floor.name)} ✓
                            </option>
                          ))}
                          {materialPhaseId && nonApplicableFloors.map((floor) => (
                            <option key={floor._id} value={floor._id} disabled className="ds-text-muted italic">
                              {getFloorDisplay(floor.floorNumber, floor.floorName || floor.name)} ✗
                            </option>
                          ))}
                          {!materialPhaseId && floors.map((floor) => (
                            <option key={floor._id} value={floor._id} className="ds-text-primary">
                              {getFloorDisplay(floor.floorNumber, floor.floorName || floor.name)}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    {showAdvancedColumns && (
                      <td className="px-4 py-3">
                        <select
                          value={material.phaseId || wizardData.defaultPhaseId || ''}
                          onChange={(e) => handleMaterialUpdate(index, 'phaseId', e.target.value)}
                          required
                          className={`w-44 px-2 py-1 ds-bg-surface ds-text-primary border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            !material.phaseId && !wizardData.defaultPhaseId
                              ? 'border-red-400/60 bg-red-50'
                              : 'ds-border-subtle'
                          }`}
                        >
                          <option value="" className="ds-text-primary">
                            {wizardData.defaultPhaseId ? 'Use default' : 'Select phase (required)'}
                          </option>
                          {phases.map((phase) => (
                            <option key={phase._id} value={phase._id} className="ds-text-primary">
                              {phase.phaseName || phase.name} {phase.status ? `(${phase.status.replace('_', ' ')})` : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    {showAdvancedColumns && (
                      <td className="px-4 py-3">
                        <select
                          value={material.urgency || wizardData.defaultUrgency || 'medium'}
                          onChange={(e) => handleMaterialUpdate(index, 'urgency', e.target.value)}
                          className="w-24 px-2 py-1 ds-bg-surface ds-text-primary border ds-border-subtle rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="low" className="ds-text-primary">Low</option>
                          <option value="medium" className="ds-text-primary">Medium</option>
                          <option value="high" className="ds-text-primary">High</option>
                          <option value="critical" className="ds-text-primary">Critical</option>
                        </select>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={material.estimatedUnitCost || ''}
                        onChange={(e) => handleMaterialUpdate(index, 'estimatedUnitCost', e.target.value)}
                        min="0"
                        step="0.01"
                        className="w-24 px-2 py-1 ds-bg-surface ds-text-primary border ds-border-subtle rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:ds-text-muted"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm ds-text-primary">
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
      <div className="ds-bg-surface-muted rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm ds-text-secondary">Total Materials</p>
            <p className="text-2xl font-bold ds-text-primary">{totals.totalMaterials}</p>
          </div>
          <div>
            <p className="text-sm ds-text-secondary">Total Estimated Cost</p>
            <p className="text-2xl font-bold ds-text-primary">{formatCurrency(totals.totalCost)}</p>
          </div>
          <div>
            <p className="text-sm ds-text-secondary">Average Cost per Material</p>
            <p className="text-2xl font-bold ds-text-primary">
              {formatCurrency(totals.totalMaterials > 0 ? totals.totalCost / totals.totalMaterials : 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

