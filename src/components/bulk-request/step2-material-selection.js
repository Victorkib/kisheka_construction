/**
 * Step 2: Material Selection Component
 * Two modes: Library Mode and Custom Mode
 */

'use client';

import { useState, useEffect } from 'react';
import { LibraryMaterialSelector } from './library-material-selector';
import { CustomMaterialInput } from './custom-material-input';
import { TemplateSelector } from './template-selector';

export function Step2MaterialSelection({ wizardData, onUpdate, onValidationChange }) {
  const [activeTab, setActiveTab] = useState('library'); // 'library', 'custom', or 'template'

  // Validate and notify parent
  const materials = wizardData.materials || [];
  
  // Validate that all materials have required fields: name, quantity, unit
  const isValid = materials.length > 0 && materials.every((m) => {
    const materialName = m.name || m.materialName || '';
    const hasName = materialName && typeof materialName === 'string' && materialName.trim().length >= 2;
    const quantity = parseFloat(m.quantityNeeded || m.quantity || 0);
    const hasQuantity = !isNaN(quantity) && quantity > 0;
    const hasUnit = (m.unit && m.unit.trim().length > 0);
    return hasName && hasQuantity && hasUnit;
  });

  // Notify parent of validation state
  // Only depend on the actual value, not the callback function
  useEffect(() => {
    onValidationChange(isValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid]); // onValidationChange is stable (memoized in parent)

  const handleAddMaterials = (newMaterials) => {
    const currentMaterials = wizardData.materials || [];
    // Apply defaults from Step 1 to new materials
    const materialsWithDefaults = newMaterials.map((material) => ({
      ...material,
      // Only set defaults if not already present
      floorId: material.floorId || wizardData.defaultFloorId || '',
      categoryId: material.categoryId || wizardData.defaultCategoryId || '',
      category: material.category || '',
      urgency: material.urgency || wizardData.defaultUrgency || 'medium',
      reason: material.reason || wizardData.defaultReason || '',
    }));
    onUpdate({ materials: [...currentMaterials, ...materialsWithDefaults] });
  };

  const handleAddMaterial = (newMaterial) => {
    const currentMaterials = wizardData.materials || [];
    // Apply defaults from Step 1 to new material
    const materialWithDefaults = {
      ...newMaterial,
      // Only set defaults if not already present
      floorId: newMaterial.floorId || wizardData.defaultFloorId || '',
      categoryId: newMaterial.categoryId || wizardData.defaultCategoryId || '',
      category: newMaterial.category || '',
      urgency: newMaterial.urgency || wizardData.defaultUrgency || 'medium',
      reason: newMaterial.reason || wizardData.defaultReason || '',
    };
    onUpdate({ materials: [...currentMaterials, materialWithDefaults] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Materials</h2>
        <p className="text-sm text-gray-600 mb-6">
          Add materials to your bulk request. You can select from the library or add custom materials.
          You can add materials from both modes.
        </p>
      </div>

      {/* Materials Count */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">
              {materials.length} material{materials.length !== 1 ? 's' : ''} added
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Continue adding materials or proceed to edit details
            </p>
          </div>
          {materials.length > 0 && (
            <button
              onClick={() => {
                // Scroll to materials list or show summary
                const totalCost = materials.reduce((sum, m) => {
                  const cost = m.estimatedUnitCost && m.quantityNeeded
                    ? m.estimatedUnitCost * m.quantityNeeded
                    : 0;
                  return sum + cost;
                }, 0);
                alert(`Total Materials: ${materials.length}\nEstimated Total Cost: ${totalCost.toLocaleString()} KES`);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              View Summary
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'library'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📚 Library Mode
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'custom'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ✏️ Custom Mode
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('template')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'template'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📋 Templates
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'library' ? (
          <LibraryMaterialSelector
            onAddMaterials={handleAddMaterials}
            selectedLibraryIds={wizardData.selectedLibraryMaterials || []}
          />
        ) : activeTab === 'custom' ? (
          <CustomMaterialInput onAddMaterial={handleAddMaterial} />
        ) : (
          <TemplateSelector
            onTemplateSelected={(templateData) => {
              // Add template materials to wizard
              if (templateData.materials && Array.isArray(templateData.materials)) {
                handleAddMaterials(templateData.materials);
                
                // Update default settings if provided
                if (templateData.defaultSettings) {
                  onUpdate({
                    defaultUrgency: templateData.defaultSettings.defaultUrgency || wizardData.defaultUrgency,
                    defaultReason: templateData.defaultSettings.defaultReason || wizardData.defaultReason,
                    defaultCategoryId: templateData.defaultSettings.defaultCategoryId || wizardData.defaultCategoryId,
                    defaultFloorId: templateData.defaultSettings.defaultFloorId || wizardData.defaultFloorId,
                  });
                }
              }
            }}
            currentProjectId={wizardData.projectId}
            currentFloorId={wizardData.defaultFloorId}
            currentCategoryId={wizardData.defaultCategoryId}
          />
        )}
      </div>

      {/* Validation Warning */}
      {materials.length > 0 && !isValid && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800 font-medium mb-2">
            ⚠️ Some materials are incomplete. Please ensure all materials have:
          </p>
          <ul className="text-xs text-yellow-700 list-disc list-inside space-y-1">
            <li>Material name (at least 2 characters)</li>
            <li>Quantity (greater than 0)</li>
            <li>Unit</li>
          </ul>
          <div className="mt-3 text-xs text-yellow-700">
            {materials.map((m, idx) => {
              const materialName = m.name || m.materialName || '';
              const hasName = materialName && typeof materialName === 'string' && materialName.trim().length >= 2;
              const quantity = parseFloat(m.quantityNeeded || m.quantity || 0);
              const hasQuantity = !isNaN(quantity) && quantity > 0;
              const hasUnit = (m.unit && m.unit.trim().length > 0);
              const isMaterialValid = hasName && hasQuantity && hasUnit;
              
              if (!isMaterialValid) {
                return (
                  <div key={idx} className="mt-1">
                    Material #{idx + 1}: Missing {!hasName && 'Name'} {!hasQuantity && 'Quantity'} {!hasUnit && 'Unit'}
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}

      {/* Added Materials Preview */}
      {materials.length > 0 && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Added Materials Preview</h3>
          <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            <div className="space-y-2">
              {materials.map((material, index) => {
                const materialName = material.name || material.materialName || '';
                const quantity = material.quantityNeeded || material.quantity || 0;
                const unit = material.unit || '';
                const materialNameValid = materialName && typeof materialName === 'string' && materialName.trim().length >= 2;
                const quantityValid = parseFloat(quantity) > 0;
                const unitValid = unit && unit.trim().length > 0;
                const isMaterialValid = materialNameValid && quantityValid && unitValid;
                
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between bg-white p-3 rounded border ${
                      isMaterialValid ? 'border-gray-200' : 'border-yellow-300 bg-yellow-50'
                    }`}
                  >
                    <div className="flex-1">
                      <p className={`font-medium text-sm ${isMaterialValid ? 'text-gray-900' : 'text-yellow-800'}`}>
                        {materialName || 'Missing name'}
                      </p>
                      <p className={`text-xs mt-1 ${isMaterialValid ? 'text-gray-600' : 'text-yellow-700'}`}>
                        {quantityValid && unitValid ? `${quantity} ${unit}` : 'Missing quantity/unit'}
                        {material.estimatedUnitCost && (
                          <span className="ml-2">
                            @ {material.estimatedUnitCost.toLocaleString()} KES
                          </span>
                        )}
                      </p>
                      {!isMaterialValid && (
                        <p className="text-xs text-yellow-600 mt-1">
                          ⚠️ Incomplete - will need to be fixed in Step 3
                        </p>
                      )}
                    </div>
                  <button
                    onClick={() => {
                      const updated = materials.filter((_, i) => i !== index);
                      onUpdate({ materials: updated });
                    }}
                    className="ml-4 text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

