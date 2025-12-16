/**
 * Custom Material Input Component
 * Allows adding custom materials manually or via bulk paste
 */

'use client';

import { useState } from 'react';
import { VALID_UNITS } from '@/lib/schemas/material-library-schema';

export function CustomMaterialInput({ onAddMaterial }) {
  const [mode, setMode] = useState('single'); // 'single' or 'bulk'
  const [singleMaterial, setSingleMaterial] = useState({
    name: '',
    quantityNeeded: '',
    unit: 'piece',
    customUnit: '',
    estimatedUnitCost: '',
  });
  const [bulkText, setBulkText] = useState('');

  const handleSingleSubmit = (e) => {
    e.preventDefault();
    
    if (!singleMaterial.name.trim()) {
      alert('Material name is required');
      return;
    }
    
    if (!singleMaterial.quantityNeeded || parseFloat(singleMaterial.quantityNeeded) <= 0) {
      alert('Valid quantity is required');
      return;
    }

    const unit = singleMaterial.unit === 'others' ? singleMaterial.customUnit.trim() : singleMaterial.unit;
    if (!unit) {
      alert('Unit is required');
      return;
    }

    const material = {
      name: singleMaterial.name.trim(),
      quantityNeeded: parseFloat(singleMaterial.quantityNeeded),
      unit: unit,
      estimatedUnitCost: singleMaterial.estimatedUnitCost ? parseFloat(singleMaterial.estimatedUnitCost) : null,
    };

    onAddMaterial(material);
    
    // Reset form
    setSingleMaterial({
      name: '',
      quantityNeeded: '',
      unit: 'piece',
      customUnit: '',
      estimatedUnitCost: '',
    });
  };

  const handleBulkParse = () => {
    if (!bulkText.trim()) {
      alert('Please enter materials to parse');
      return;
    }

    const lines = bulkText.split('\n').filter((line) => line.trim().length > 0);
    const parsedMaterials = [];

    for (const line of lines) {
      // Try to parse: Material Name, Quantity, Unit, Cost (optional)
      // Examples:
      // "Cement, 500, bag, 850"
      // "Rebars 12mm, 600, piece"
      // "Sand, 20, lorry"
      
      const parts = line.split(',').map((p) => p.trim());
      
      if (parts.length >= 2) {
        const name = parts[0];
        const quantity = parseFloat(parts[1]);
        const unit = parts[2] || 'piece';
        const cost = parts[3] ? parseFloat(parts[3]) : null;

        if (name && !isNaN(quantity) && quantity > 0) {
          parsedMaterials.push({
            name,
            quantityNeeded: quantity,
            unit: unit.toLowerCase(),
            estimatedUnitCost: cost,
          });
        }
      }
    }

    if (parsedMaterials.length === 0) {
      alert('Could not parse any materials. Please use format: Material Name, Quantity, Unit, Cost (optional)');
      return;
    }

    // Add all parsed materials
    parsedMaterials.forEach((material) => onAddMaterial(material));
    
    // Clear bulk text
    setBulkText('');
    alert(`Added ${parsedMaterials.length} material(s)`);
  };

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            mode === 'single'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Single Entry
        </button>
        <button
          type="button"
          onClick={() => setMode('bulk')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            mode === 'bulk'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Bulk Paste
        </button>
      </div>

      {mode === 'single' ? (
        <form onSubmit={handleSingleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Material Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={singleMaterial.name}
                onChange={(e) => setSingleMaterial((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Cement (50kg bag)"
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={singleMaterial.quantityNeeded}
                onChange={(e) => setSingleMaterial((prev) => ({ ...prev, quantityNeeded: e.target.value }))}
                placeholder="e.g., 500"
                min="0.01"
                step="0.01"
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Unit <span className="text-red-500">*</span>
              </label>
              <select
                value={singleMaterial.unit}
                onChange={(e) => setSingleMaterial((prev) => ({ ...prev, unit: e.target.value }))}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {VALID_UNITS.map((unit) => (
                  <option key={unit} value={unit} className="text-gray-900">
                    {unit.charAt(0).toUpperCase() + unit.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            {singleMaterial.unit === 'others' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Custom Unit <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={singleMaterial.customUnit}
                  onChange={(e) => setSingleMaterial((prev) => ({ ...prev, customUnit: e.target.value }))}
                  placeholder="Enter custom unit"
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Estimated Unit Cost (KES)
              </label>
              <input
                type="number"
                value={singleMaterial.estimatedUnitCost}
                onChange={(e) => setSingleMaterial((prev) => ({ ...prev, estimatedUnitCost: e.target.value }))}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Add Material
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Paste Materials (One per line)
            </label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`Format: Material Name, Quantity, Unit, Cost (optional)\n\nExample:\nCement, 500, bag, 850\nRebars 12mm, 600, piece\nSand, 20, lorry`}
              rows={10}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm placeholder:text-gray-400"
            />
            <p className="mt-1 text-xs text-gray-600">
              Format: Material Name, Quantity, Unit, Cost (optional). One material per line.
            </p>
          </div>
          <button
            type="button"
            onClick={handleBulkParse}
            className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Parse & Add Materials
          </button>
        </div>
      )}
    </div>
  );
}

