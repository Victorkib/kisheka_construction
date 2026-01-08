/**
 * Multiple Supplier Assignment Component
 * Assigns materials to different suppliers
 */

'use client';

import { useState, useEffect, useRef } from 'react';

export function MultiSupplierAssignment({
  materialRequests = [],
  suppliers = [],
  onAssignmentChange,
  initialData = null,
}) {
  const [assignments, setAssignments] = useState(() => {
    // Initialize as empty - will be populated by useEffect when materialRequests loads
    return [];
  });

  // Use ref to store callback to avoid infinite loops
  const onAssignmentChangeRef = useRef(onAssignmentChange);
  
  // Update ref when callback changes (but don't trigger effect)
  useEffect(() => {
    onAssignmentChangeRef.current = onAssignmentChange;
  }, [onAssignmentChange]);

  // Use ref to track previous assignments to prevent unnecessary updates
  const prevAssignmentsRef = useRef([]);
  
  // Use ref to track previous materialRequests to prevent unnecessary syncs
  const prevMaterialRequestsRef = useRef([]);

  // CRITICAL FIX: Sync assignments when materialRequests changes
  // This handles the case where materialRequests loads asynchronously
  useEffect(() => {
    // If materialRequests is empty, don't initialize yet (still loading)
    if (!materialRequests || materialRequests.length === 0) {
      setAssignments([]);
      prevMaterialRequestsRef.current = [];
      return;
    }

    // Check if materialRequests actually changed (by comparing IDs)
    const currentRequestIds = materialRequests
      .map((req) => req._id?.toString() || req.id?.toString())
      .sort()
      .join(',');
    const prevRequestIds = prevMaterialRequestsRef.current
      .map((req) => req._id?.toString() || req.id?.toString())
      .sort()
      .join(',');
    
    // If materialRequests didn't actually change, don't re-sync
    // (This prevents sync when only initialData changes from parent updates)
    if (currentRequestIds === prevRequestIds && prevRequestIds !== '') {
      return;
    }
    
    // Update ref with current materialRequests
    prevMaterialRequestsRef.current = materialRequests;

    // If we have initialData and it's valid, validate and merge it
    if (initialData && Array.isArray(initialData) && initialData.length > 0) {
      // Validate initialData against current materialRequests
      // Only keep assignments for materials that still exist
      const validAssignments = initialData.filter((assignment) => {
        return materialRequests.some((req) => {
          const reqId = req._id?.toString() || req.id?.toString();
          return reqId === assignment.materialRequestId;
        });
      });

      // Get IDs of materials that already have assignments
      const existingIds = new Set(validAssignments.map((a) => a.materialRequestId));

      // Add new assignments for materials not in initialData
      const newAssignments = materialRequests
        .filter((req) => {
          const reqId = req._id?.toString() || req.id?.toString();
          return !existingIds.has(reqId);
        })
        .map((req) => ({
          materialRequestId: req._id?.toString() || req.id?.toString(),
          supplierId: '',
          unitCost: req.estimatedUnitCost || '',
          deliveryDate: '',
          notes: '',
        }));

      // Merge valid assignments with new ones
      const mergedAssignments = [...validAssignments, ...newAssignments];
      
      // Ensure all assignments have required fields
      const completeAssignments = mergedAssignments.map((assignment) => ({
        materialRequestId: assignment.materialRequestId || '',
        supplierId: assignment.supplierId || '',
        unitCost: assignment.unitCost || assignment.unitCost === 0 ? assignment.unitCost : '',
        deliveryDate: assignment.deliveryDate || '',
        notes: assignment.notes || '',
      }));

      setAssignments(completeAssignments);
      return;
    }

    // No initialData or invalid initialData - initialize from materialRequests
    const newAssignments = materialRequests.map((req) => ({
      materialRequestId: req._id?.toString() || req.id?.toString(),
      supplierId: '',
      unitCost: req.estimatedUnitCost || '',
      deliveryDate: '',
      notes: '',
    }));

    setAssignments(newAssignments);
  }, [materialRequests]); // ✅ Only depend on materialRequests, not initialData
  // Note: initialData is handled inside the effect, but we don't want to re-sync
  // when parent updates initialData (which would cause loops)

  // Notify parent of assignment changes
  // CRITICAL FIX: Use ref to avoid infinite loop from unstable callback reference
  useEffect(() => {
    // Only notify if assignments actually changed meaningfully
    const assignmentsChanged = 
      assignments.length !== prevAssignmentsRef.current.length ||
      JSON.stringify(assignments) !== JSON.stringify(prevAssignmentsRef.current);
    
    if (assignments.length > 0 && assignmentsChanged) {
      onAssignmentChangeRef.current(assignments);
      prevAssignmentsRef.current = assignments;
    }
  }, [assignments]); // ✅ Only depend on assignments, not the callback

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
    if (!materialRequests || materialRequests.length === 0) {
      return; // Nothing to clear
    }
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
    if (!requestId || !materialRequests || materialRequests.length === 0) {
      return 'Unknown Material';
    }
    const request = materialRequests.find(
      (r) => (r._id?.toString() || r.id?.toString()) === requestId
    );
    return request?.materialName || 'Unknown Material';
  };

  const isValid = assignments.length > 0 && assignments.every((a) => a.supplierId && a.deliveryDate);

  // Loading state: Show when materialRequests is empty (data still loading)
  if (!materialRequests || materialRequests.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full blur-lg opacity-50 animate-pulse" />
              <div className="relative animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
            </div>
            <p className="text-gray-600 font-medium">Loading materials...</p>
            <p className="text-sm text-gray-500 mt-2">Please wait while we fetch the material requests</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state: Show when assignments is empty but materialRequests exists
  // This shouldn't happen normally, but handle it gracefully
  if (assignments.length === 0 && materialRequests.length > 0) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-semibold text-yellow-800 mb-1">No Materials to Assign</h3>
              <p className="text-sm text-yellow-700">
                There are no material requests in this batch to assign suppliers to. Please check the batch details.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="text-sm text-gray-600">
          Assign suppliers to each material. All materials must have a supplier and delivery date.
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={handleGroupBySupplier}
            className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200"
          >
            Group by Supplier
          </button>
          <button
            onClick={handleClearAll}
            className="flex-1 sm:flex-none px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 text-sm font-medium shadow-sm hover:shadow transition-all duration-200"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Validation Status */}
      {!isValid && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-sm text-yellow-800 font-medium">
              Please assign a supplier and delivery date for all materials before proceeding.
            </p>
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-br from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Material
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Supplier <span className="text-red-500">*</span>
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Unit Cost
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Delivery Date <span className="text-red-500">*</span>
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <svg className="h-16 w-16 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-sm font-semibold text-gray-700">No materials to assign</p>
                      <p className="text-xs mt-1 text-gray-500">Please check the batch details</p>
                    </div>
                  </td>
                </tr>
              ) : (
                assignments.map((assignment, index) => {
                const material = materialRequests.find(
                  (r) => (r._id?.toString() || r.id?.toString()) === assignment.materialRequestId
                );
                const hasSupplier = !!assignment.supplierId;
                const hasDeliveryDate = !!assignment.deliveryDate;

                return (
                  <tr
                    key={assignment.materialRequestId}
                    className={`transition-colors duration-150 ${
                      !hasSupplier || !hasDeliveryDate 
                        ? 'bg-gradient-to-r from-yellow-50 to-orange-50 hover:from-yellow-100 hover:to-orange-100' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {material?.materialName || 'Unknown'}
                      </div>
                      {material?.description && (
                        <div className="text-xs text-gray-500 truncate max-w-xs mt-1">
                          {material.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-800">
                        {material?.quantityNeeded} {material?.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {suppliers.length === 0 ? (
                        <div className="text-xs text-yellow-700 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-2.5">
                          No suppliers available. Add suppliers using the button above.
                        </div>
                      ) : (
                        <select
                          value={assignment.supplierId}
                          onChange={(e) => handleAssignmentChange(index, 'supplierId', e.target.value)}
                          required
                          className={`w-full min-w-[180px] px-3 py-2 bg-white text-gray-900 border-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                            !hasSupplier 
                              ? 'border-yellow-400 bg-yellow-50 shadow-sm' 
                              : 'border-gray-300 hover:border-gray-400'
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
                    <td className="px-6 py-4">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">KES</span>
                        <input
                          type="number"
                          value={assignment.unitCost}
                          onChange={(e) => handleAssignmentChange(index, 'unitCost', e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-32 pl-10 pr-3 py-2 bg-white text-gray-900 border-2 border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-all placeholder:text-gray-400"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="date"
                        value={assignment.deliveryDate}
                        onChange={(e) => handleAssignmentChange(index, 'deliveryDate', e.target.value)}
                        required
                        min={new Date().toISOString().split('T')[0]}
                        className={`w-full min-w-[160px] px-3 py-2 bg-white text-gray-900 border-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                          !hasDeliveryDate 
                            ? 'border-yellow-400 bg-yellow-50 shadow-sm' 
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={assignment.notes}
                        onChange={(e) => handleAssignmentChange(index, 'notes', e.target.value)}
                        placeholder="Optional notes"
                        className="w-full min-w-[200px] px-3 py-2 bg-white text-gray-900 border-2 border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-all placeholder:text-gray-400"
                      />
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile/Tablet Card View */}
      <div className="lg:hidden space-y-4">
        {assignments.length === 0 ? (
          <div className="bg-white rounded-xl border-2 border-gray-200 p-8 text-center shadow-sm">
            <div className="flex flex-col items-center justify-center text-gray-500">
              <svg className="h-16 w-16 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm font-semibold text-gray-700">No materials to assign</p>
              <p className="text-xs mt-1 text-gray-500">Please check the batch details</p>
            </div>
          </div>
        ) : (
          assignments.map((assignment, index) => {
            const material = materialRequests.find(
              (r) => (r._id?.toString() || r.id?.toString()) === assignment.materialRequestId
            );
            const hasSupplier = !!assignment.supplierId;
            const hasDeliveryDate = !!assignment.deliveryDate;

            return (
              <div
                key={assignment.materialRequestId}
                className={`bg-white rounded-xl border-2 shadow-md overflow-hidden transition-all ${
                  !hasSupplier || !hasDeliveryDate
                    ? 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-orange-50'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-lg'
                }`}
              >
                <div className="p-4 space-y-4">
                  {/* Material Header */}
                  <div className="border-b border-gray-200 pb-3">
                    <h3 className="text-base font-bold text-gray-900 mb-1">
                      {material?.materialName || 'Unknown'}
                    </h3>
                    {material?.description && (
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {material.description}
                      </p>
                    )}
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-800">
                        {material?.quantityNeeded} {material?.unit}
                      </span>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="space-y-3">
                    {/* Supplier Selection */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Supplier <span className="text-red-500">*</span>
                      </label>
                      {suppliers.length === 0 ? (
                        <div className="text-xs text-yellow-700 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-2.5">
                          No suppliers available. Add suppliers using the button above.
                        </div>
                      ) : (
                        <select
                          value={assignment.supplierId}
                          onChange={(e) => handleAssignmentChange(index, 'supplierId', e.target.value)}
                          required
                          className={`w-full px-3 py-2.5 bg-white text-gray-900 border-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                            !hasSupplier
                              ? 'border-yellow-400 bg-yellow-50 shadow-sm'
                              : 'border-gray-300'
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
                    </div>

                    {/* Unit Cost and Delivery Date Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Unit Cost
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">KES</span>
                          <input
                            type="number"
                            value={assignment.unitCost}
                            onChange={(e) => handleAssignmentChange(index, 'unitCost', e.target.value)}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            className="w-full pl-10 pr-3 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-gray-400"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          Delivery Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={assignment.deliveryDate}
                          onChange={(e) => handleAssignmentChange(index, 'deliveryDate', e.target.value)}
                          required
                          min={new Date().toISOString().split('T')[0]}
                          className={`w-full px-3 py-2.5 bg-white text-gray-900 border-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                            !hasDeliveryDate
                              ? 'border-yellow-400 bg-yellow-50 shadow-sm'
                              : 'border-gray-300'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={assignment.notes}
                        onChange={(e) => handleAssignmentChange(index, 'notes', e.target.value)}
                        placeholder="Optional notes"
                        className="w-full px-3 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary by Supplier */}
      {assignments.some((a) => a.supplierId) && (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-5 shadow-md">
          <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Summary by Supplier
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
              <div 
                key={supplierName} 
                className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 truncate">{supplierName}</span>
                  <span className="ml-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                    {materials.length}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">material{materials.length !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

