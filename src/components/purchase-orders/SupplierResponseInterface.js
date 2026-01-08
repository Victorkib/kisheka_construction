/**
 * Enhanced Supplier Response Interface Component
 * Provides comprehensive UI for suppliers to respond to purchase orders
 * with improved UX, validation, and feedback
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/toast';
import { LoadingSpinner } from '@/components/loading';
import { AlertCircle, CheckCircle, Clock, DollarSign, Package, Calendar, MessageSquare, AlertTriangle } from 'lucide-react';

export function SupplierResponseInterface({ order, token, onResponse }) {
  const toast = useToast();
  const [action, setAction] = useState('accept');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    supplierNotes: '',
    finalUnitCost: '',
    quantityOrdered: '',
    deliveryDate: '',
    rejectionReason: '',
    rejectionSubcategory: '',
    notes: ''
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  
  // Material-level responses for bulk orders
  const isBulkOrder = order?.supportsPartialResponse || order?.isBulkOrder || false;
  const materials = order?.materials || order?.materialRequests || [];
  const [materialResponses, setMaterialResponses] = useState(() => {
    // Initialize material responses for bulk orders
    if (isBulkOrder && materials.length > 0) {
      return materials.map((material, index) => ({
        materialRequestId: material.materialRequestId?.toString() || material._id?.toString() || `material-${index}`,
        action: 'pending', // 'pending', 'accept', 'reject', 'modify'
        status: 'pending',
        notes: '',
        rejectionReason: '',
        rejectionSubcategory: '',
        modifications: {
          unitCost: null,
          quantityOrdered: null,
          deliveryDate: null
        }
      }));
    }
    return [];
  });

  // Rejection reason options with subcategories
  const rejectionReasons = {
    price_too_high: {
      label: 'Price Too High',
      subcategories: {
        market_rates: 'Market rates have changed',
        volume_discount: 'Expected volume discount not met',
        material_cost: 'Raw material costs increased',
        other_price: 'Other pricing issue'
      }
    },
    unavailable: {
      label: 'Material Unavailable',
      subcategories: {
        out_of_stock: 'Currently out of stock',
        discontinued: 'Product discontinued',
        seasonal: 'Seasonal unavailability',
        supply_chain: 'Supply chain disruption'
      }
    },
    timeline: {
      label: 'Timeline Issues',
      subcategories: {
        too_soon: 'Delivery date too soon',
        production_time: 'Production time insufficient',
        logistics: 'Logistics constraints',
        other_timeline: 'Other timeline issue'
      }
    },
    specifications: {
      label: 'Specification Issues',
      subcategories: {
        unclear_specs: 'Specifications unclear',
        not_available: 'Specified grade not available',
        alternative_needed: 'Alternative specification available',
        other_specs: 'Other specification issue'
      }
    },
    quantity: {
      label: 'Quantity Issues',
      subcategories: {
        minimum_order: 'Below minimum order quantity',
        maximum_capacity: 'Exceeds production capacity',
        packaging: 'Quantity packaging issues',
        other_quantity: 'Other quantity issue'
      }
    },
    business_policy: {
      label: 'Business Policy',
      subcategories: {
        payment_terms: 'Payment terms unacceptable',
        delivery_terms: 'Delivery terms issue',
        contract_terms: 'Contract terms conflict',
        other_policy: 'Other policy issue'
      }
    },
    external_factors: {
      label: 'External Factors',
      subcategories: {
        weather: 'Weather conditions',
        transportation: 'Transportation issues',
        regulations: 'Regulatory changes',
        other_external: 'Other external factor'
      }
    },
    other: {
      label: 'Other Reasons',
      subcategories: {
        unspecified: 'Unspecified reason',
        custom: 'Custom reason'
      }
    }
  };

  useEffect(() => {
    if (order) {
      setFormData(prev => ({
        ...prev,
        finalUnitCost: order.unitCost?.toString() || '',
        quantityOrdered: order.quantityOrdered?.toString() || '',
        deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toISOString().split('T')[0] : ''
      }));
    }
  }, [order]);

  const validateForm = () => {
    const errors = {};

    // For bulk orders, validate material-level responses
    if (isBulkOrder && materials.length > 0) {
      const hasAnyResponse = materialResponses.some(mr => mr.action !== 'pending');
      if (!hasAnyResponse) {
        errors.materialResponses = 'Please respond to at least one material';
      }
      
      // Validate each material response
      materialResponses.forEach((mr, index) => {
        if (mr.action === 'reject') {
          if (!mr.notes?.trim()) {
            errors[`material_${index}_notes`] = 'Rejection reason is required';
          }
          if (!mr.rejectionReason) {
            errors[`material_${index}_rejectionReason`] = 'Please select a rejection reason';
          }
        }
        if (mr.action === 'modify') {
          if (!mr.notes?.trim()) {
            errors[`material_${index}_notes`] = 'Modification notes are required';
          }
          if (mr.modifications.unitCost !== null && parseFloat(mr.modifications.unitCost) < 0) {
            errors[`material_${index}_unitCost`] = 'Unit cost must be positive';
          }
          if (mr.modifications.quantityOrdered !== null && parseFloat(mr.modifications.quantityOrdered) <= 0) {
            errors[`material_${index}_quantity`] = 'Quantity must be positive';
          }
        }
      });
    } else {
      // Single order validation (existing logic)
      if (action === 'reject') {
        if (!formData.supplierNotes?.trim()) {
          errors.supplierNotes = 'Rejection reason is required';
        }
        if (!formData.rejectionReason) {
          errors.rejectionReason = 'Please select a rejection reason';
        }
      }

      if (action === 'modify') {
        if (formData.finalUnitCost && parseFloat(formData.finalUnitCost) < 0) {
          errors.finalUnitCost = 'Unit cost must be positive';
        }
        if (formData.quantityOrdered && parseFloat(formData.quantityOrdered) <= 0) {
          errors.quantityOrdered = 'Quantity must be positive';
        }
        if (formData.deliveryDate && new Date(formData.deliveryDate) <= new Date()) {
          errors.deliveryDate = 'Delivery date must be in the future';
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.showError('Please correct the errors before submitting');
      return;
    }

    setLoading(true);
    try {
      let payload;
      
      if (isBulkOrder && materials.length > 0) {
        // Bulk order with material-level responses
        const respondedMaterials = materialResponses.filter(mr => mr.action !== 'pending');
        
        // Determine overall action based on material responses
        const allAccepted = respondedMaterials.every(mr => mr.action === 'accept');
        const allRejected = respondedMaterials.every(mr => mr.action === 'reject');
        const hasModify = respondedMaterials.some(mr => mr.action === 'modify');
        const hasMixed = !allAccepted && !allRejected;
        
        let overallAction = 'modify'; // Default to modify for mixed responses
        if (allAccepted && !hasModify) overallAction = 'accept';
        else if (allRejected && !hasModify) overallAction = 'reject';
        else if (hasMixed || hasModify) overallAction = 'modify';
        
        payload = {
          action: overallAction,
          token,
          isPartialResponse: true,
          materialResponses: respondedMaterials.map(mr => ({
            materialRequestId: mr.materialRequestId,
            action: mr.action,
            notes: mr.notes,
            rejectionReason: mr.rejectionReason || undefined,
            rejectionSubcategory: mr.rejectionSubcategory || undefined,
            modifications: mr.action === 'modify' ? {
              unitCost: mr.modifications.unitCost !== null ? parseFloat(mr.modifications.unitCost) : undefined,
              quantityOrdered: mr.modifications.quantityOrdered !== null ? parseFloat(mr.modifications.quantityOrdered) : undefined,
              deliveryDate: mr.modifications.deliveryDate || undefined
            } : undefined
          })),
          supplierNotes: formData.supplierNotes || undefined
        };
      } else {
        // Single order (existing logic)
        payload = {
          action,
          token,
          supplierNotes: formData.supplierNotes,
          ...action === 'accept' && {
            finalUnitCost: formData.finalUnitCost ? parseFloat(formData.finalUnitCost) : undefined
          },
          ...action === 'modify' && {
            finalUnitCost: formData.finalUnitCost ? parseFloat(formData.finalUnitCost) : undefined,
            quantityOrdered: formData.quantityOrdered ? parseFloat(formData.quantityOrdered) : undefined,
            deliveryDate: formData.deliveryDate || undefined,
            notes: formData.notes
          },
          ...action === 'reject' && {
            rejectionReason: formData.rejectionReason,
            rejectionSubcategory: formData.rejectionSubcategory
          }
        };
      }

      await onResponse(payload);
      toast.showSuccess(`Response submitted successfully`);
    } catch (error) {
      toast.showError(`Failed to submit response: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle material-level response change
  const handleMaterialResponseChange = (materialIndex, field, value) => {
    setMaterialResponses(prev => {
      const updated = [...prev];
      if (field === 'action') {
        updated[materialIndex] = {
          ...updated[materialIndex],
          action: value,
          status: value === 'pending' ? 'pending' : value,
          // Reset fields when action changes
          notes: value === 'pending' ? '' : updated[materialIndex].notes,
          rejectionReason: value !== 'reject' ? '' : updated[materialIndex].rejectionReason,
          rejectionSubcategory: value !== 'reject' ? '' : updated[materialIndex].rejectionSubcategory,
          modifications: value !== 'modify' ? {
            unitCost: null,
            quantityOrdered: null,
            deliveryDate: null
          } : updated[materialIndex].modifications
        };
      } else if (field.startsWith('modifications.')) {
        const modField = field.replace('modifications.', '');
        updated[materialIndex] = {
          ...updated[materialIndex],
          modifications: {
            ...updated[materialIndex].modifications,
            [modField]: value
          }
        };
      } else {
        updated[materialIndex] = {
          ...updated[materialIndex],
          [field]: value
        };
      }
      return updated;
    });
  };

  const calculateNewTotal = () => {
    const unitCost = parseFloat(formData.finalUnitCost) || 0;
    const quantity = parseFloat(formData.quantityOrdered) || order.quantityOrdered || 0;
    return unitCost * quantity;
  };

  const renderOrderSummary = () => {
    if (isBulkOrder && materials.length > 0) {
      // Bulk order summary
      return (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Bulk Order Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">Total Materials:</span>
              <span className="font-medium">{materials.length}</span>
            </div>
            <div className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">Total Value:</span>
              <span className="font-medium text-lg">KES {order.totalCost?.toLocaleString() || '0'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">Delivery:</span>
              <span className="font-medium">{new Date(order.deliveryDate).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">Total Quantity:</span>
              <span className="font-medium">{order.quantityOrdered} {order.unit || 'units'}</span>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> You can respond to each material individually. Accept some materials and reject others as needed.
            </p>
          </div>
        </div>
      );
    }
    
    // Single order summary (existing)
    return (
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Package className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Material:</span>
            <span className="font-medium">{order.materialName}</span>
          </div>
          <div className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Original Cost:</span>
            <span className="font-medium">KES {order.unitCost?.toLocaleString() || '0'}/unit</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-600">Quantity:</span>
            <span className="font-medium">{order.quantityOrdered} {order.unit || 'units'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Delivery:</span>
            <span className="font-medium">{new Date(order.deliveryDate).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center space-x-2 md:col-span-2">
            <DollarSign className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Total Value:</span>
            <span className="font-medium text-lg">KES {order.totalCost?.toLocaleString() || '0'}</span>
          </div>
        </div>
      </div>
    );
  };
  
  // Render material-level response interface for bulk orders
  const renderMaterialResponses = () => {
    if (!isBulkOrder || materials.length === 0) return null;
    
    return (
      <div className="space-y-4">
        <div className="border-b border-gray-200 pb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Respond to Each Material
          </h2>
          <p className="text-sm text-gray-600">
            Select an action for each material. You can accept some, reject others, or request modifications.
          </p>
        </div>
        
        <div className="space-y-6">
          {materials.map((material, index) => {
            const materialResponse = materialResponses[index] || { action: 'pending' };
            const materialRequestId = material.materialRequestId?.toString() || material._id?.toString() || `material-${index}`;
            const materialName = material.materialName || material.name || `Material ${index + 1}`;
            const quantity = material.quantity || material.quantityNeeded || 0;
            const unit = material.unit || '';
            const unitCost = material.unitCost || 0;
            const totalCost = quantity * unitCost;
            
            return (
              <div key={materialRequestId} className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{materialName}</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Quantity: {quantity} {unit}</p>
                      <p>Unit Cost: KES {unitCost.toLocaleString()}</p>
                      <p>Total: KES {totalCost.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    materialResponse.action === 'accept' ? 'bg-green-100 text-green-800' :
                    materialResponse.action === 'reject' ? 'bg-red-100 text-red-800' :
                    materialResponse.action === 'modify' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {materialResponse.action === 'accept' ? 'Accepted' :
                     materialResponse.action === 'reject' ? 'Rejected' :
                     materialResponse.action === 'modify' ? 'Modify Request' :
                     'Pending'}
                  </div>
                </div>
                
                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => handleMaterialResponseChange(index, 'action', 'accept')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      materialResponse.action === 'accept'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMaterialResponseChange(index, 'action', 'reject')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      materialResponse.action === 'reject'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMaterialResponseChange(index, 'action', 'modify')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      materialResponse.action === 'modify'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Modify
                  </button>
                  {materialResponse.action !== 'pending' && (
                    <button
                      type="button"
                      onClick={() => handleMaterialResponseChange(index, 'action', 'pending')}
                      className="px-3 py-1.5 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                
                {/* Reject form */}
                {materialResponse.action === 'reject' && (
                  <div className="mt-4 space-y-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rejection Reason *
                      </label>
                      <select
                        value={materialResponse.rejectionReason}
                        onChange={(e) => handleMaterialResponseChange(index, 'rejectionReason', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                      >
                        <option value="">Select a reason...</option>
                        {Object.entries(rejectionReasons).map(([key, reason]) => (
                          <option key={key} value={key}>{reason.label}</option>
                        ))}
                      </select>
                    </div>
                    {materialResponse.rejectionReason && rejectionReasons[materialResponse.rejectionReason] && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Specific Reason *
                        </label>
                        <select
                          value={materialResponse.rejectionSubcategory}
                          onChange={(e) => handleMaterialResponseChange(index, 'rejectionSubcategory', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                        >
                          <option value="">Select specific reason...</option>
                          {Object.entries(rejectionReasons[materialResponse.rejectionReason].subcategories).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Explanation *
                      </label>
                      <textarea
                        value={materialResponse.notes}
                        onChange={(e) => handleMaterialResponseChange(index, 'notes', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                        placeholder="Explain why this material is rejected..."
                      />
                    </div>
                  </div>
                )}
                
                {/* Modify form */}
                {materialResponse.action === 'modify' && (
                  <div className="mt-4 space-y-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          New Unit Cost
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={materialResponse.modifications.unitCost || ''}
                          onChange={(e) => handleMaterialResponseChange(index, 'modifications.unitCost', e.target.value || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                          placeholder={unitCost.toString()}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          New Quantity
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={materialResponse.modifications.quantityOrdered || ''}
                          onChange={(e) => handleMaterialResponseChange(index, 'modifications.quantityOrdered', e.target.value || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                          placeholder={quantity.toString()}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        New Delivery Date
                      </label>
                      <input
                        type="date"
                        value={materialResponse.modifications.deliveryDate || ''}
                        onChange={(e) => handleMaterialResponseChange(index, 'modifications.deliveryDate', e.target.value || null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Modification Notes *
                      </label>
                      <textarea
                        value={materialResponse.notes}
                        onChange={(e) => handleMaterialResponseChange(index, 'notes', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                        placeholder="Explain the modifications needed..."
                      />
                    </div>
                  </div>
                )}
                
                {/* Accept form */}
                {materialResponse.action === 'accept' && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes (Optional)
                      </label>
                      <textarea
                        value={materialResponse.notes}
                        onChange={(e) => handleMaterialResponseChange(index, 'notes', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                        placeholder="Add any notes or confirmations..."
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {validationErrors.materialResponses && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{validationErrors.materialResponses}</p>
          </div>
        )}
      </div>
    );
  };

  const renderActionButtons = () => (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <button
        type="button"
        onClick={() => setAction('accept')}
        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
          action === 'accept'
            ? 'bg-green-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <CheckCircle className="w-5 h-5 inline mr-2" />
        Accept Order
      </button>
      <button
        type="button"
        onClick={() => setAction('modify')}
        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
          action === 'modify'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <MessageSquare className="w-5 h-5 inline mr-2" />
        Request Modifications
      </button>
      <button
        type="button"
        onClick={() => setAction('reject')}
        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
          action === 'reject'
            ? 'bg-red-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <AlertCircle className="w-5 h-5 inline mr-2" />
        Reject Order
      </button>
    </div>
  );

  const renderAcceptForm = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Final Unit Cost (Optional)
        </label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="number"
            step="0.01"
            value={formData.finalUnitCost}
            onChange={(e) => setFormData(prev => ({ ...prev, finalUnitCost: e.target.value }))}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder={order.unitCost?.toFixed(2) || '0.00'}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Leave empty to use original unit cost
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes (Optional)
        </label>
        <textarea
          value={formData.supplierNotes}
          onChange={(e) => setFormData(prev => ({ ...prev, supplierNotes: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          placeholder="Add any notes or confirmations..."
        />
      </div>

      {formData.finalUnitCost && parseFloat(formData.finalUnitCost) !== order.unitCost && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-800">
              New total: ${calculateNewTotal().toFixed(2)} 
              {calculateNewTotal() > order.totalCost && ` (+$${(calculateNewTotal() - order.totalCost).toFixed(2)})`}
              {calculateNewTotal() < order.totalCost && ` (-$${(order.totalCost - calculateNewTotal()).toFixed(2)})`}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  const renderModifyForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Unit Cost
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="number"
              step="0.01"
              value={formData.finalUnitCost}
              onChange={(e) => setFormData(prev => ({ ...prev, finalUnitCost: e.target.value }))}
              className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.finalUnitCost ? 'border-red-300' : 'border-gray-300'
              }`}
            />
          </div>
          {validationErrors.finalUnitCost && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.finalUnitCost}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quantity
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.quantityOrdered}
            onChange={(e) => setFormData(prev => ({ ...prev, quantityOrdered: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors.quantityOrdered ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {validationErrors.quantityOrdered && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.quantityOrdered}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Delivery Date
        </label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={formData.deliveryDate}
            onChange={(e) => setFormData(prev => ({ ...prev, deliveryDate: e.target.value }))}
            className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors.deliveryDate ? 'border-red-300' : 'border-gray-300'
            }`}
          />
        </div>
        {validationErrors.deliveryDate && (
          <p className="text-red-500 text-xs mt-1">{validationErrors.deliveryDate}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Modification Notes *
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Please explain the modifications needed..."
          required
        />
      </div>

      {(formData.finalUnitCost || formData.quantityOrdered) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              Proposed new total: ${calculateNewTotal().toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  const renderRejectForm = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Rejection Reason *
        </label>
        <select
          value={formData.rejectionReason}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            rejectionReason: e.target.value,
            rejectionSubcategory: '' // Reset subcategory when reason changes
          }))}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
            validationErrors.rejectionReason ? 'border-red-300' : 'border-gray-300'
          }`}
        >
          <option value="">Select a reason...</option>
          {Object.entries(rejectionReasons).map(([key, reason]) => (
            <option key={key} value={key}>{reason.label}</option>
          ))}
        </select>
        {validationErrors.rejectionReason && (
          <p className="text-red-500 text-xs mt-1">{validationErrors.rejectionReason}</p>
        )}
      </div>

      {formData.rejectionReason && rejectionReasons[formData.rejectionReason] && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Specific Reason *
          </label>
          <select
            value={formData.rejectionSubcategory}
            onChange={(e) => setFormData(prev => ({ ...prev, rejectionSubcategory: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="">Select specific reason...</option>
            {Object.entries(rejectionReasons[formData.rejectionReason].subcategories).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Detailed Explanation *
        </label>
        <textarea
          value={formData.supplierNotes}
          onChange={(e) => setFormData(prev => ({ ...prev, supplierNotes: e.target.value }))}
          rows={4}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
            validationErrors.supplierNotes ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="Please provide detailed explanation for the rejection..."
          required
        />
        {validationErrors.supplierNotes && (
          <p className="text-red-500 text-xs mt-1">{validationErrors.supplierNotes}</p>
        )}
      </div>
    </div>
  );

  if (!order) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Respond to Purchase Order</h1>
          <p className="text-gray-600 mt-1">PO #{order.purchaseOrderNumber}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {renderOrderSummary()}
          
          {isBulkOrder && materials.length > 0 ? (
            // Bulk order: Show material-level responses
            <div className="border-t border-gray-200 pt-6">
              {renderMaterialResponses()}
              
              {/* General notes for bulk order */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  General Notes (Optional)
                </label>
                <textarea
                  value={formData.supplierNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplierNotes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add any general notes about the order..."
                />
              </div>
            </div>
          ) : (
            // Single order: Show action buttons and forms
            <>
              {renderActionButtons()}
              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {action === 'accept' && 'Accept Order Details'}
                  {action === 'modify' && 'Modification Request'}
                  {action === 'reject' && 'Rejection Details'}
                </h2>

                {action === 'accept' && renderAcceptForm()}
                {action === 'modify' && renderModifyForm()}
                {action === 'reject' && renderRejectForm()}
              </div>
            </>
          )}

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {showPreview ? 'Hide' : 'Show'} Preview
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
            >
              {loading && <LoadingSpinner size="sm" />}
              <span>Submit Response</span>
            </button>
          </div>
        </form>
      </div>

      {showPreview && (
        <div className="mt-6 bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Response Preview</h3>
          <div className="text-sm space-y-2">
            <p><strong>Action:</strong> {action}</p>
            {formData.supplierNotes && <p><strong>Notes:</strong> {formData.supplierNotes}</p>}
            {formData.finalUnitCost && <p><strong>Unit Cost:</strong> ${formData.finalUnitCost}</p>}
            {formData.quantityOrdered && <p><strong>Quantity:</strong> {formData.quantityOrdered}</p>}
            {formData.deliveryDate && <p><strong>Delivery Date:</strong> {new Date(formData.deliveryDate).toLocaleDateString()}</p>}
            {formData.rejectionReason && (
              <p><strong>Rejection Reason:</strong> {rejectionReasons[formData.rejectionReason]?.label}</p>
            )}
            {formData.rejectionSubcategory && (
              <p><strong>Specific Reason:</strong> {rejectionReasons[formData.rejectionReason]?.subcategories[formData.rejectionSubcategory]}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
