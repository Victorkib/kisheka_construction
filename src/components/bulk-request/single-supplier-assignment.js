/**
 * Single Supplier Assignment Component
 * Assigns all materials to a single supplier
 */

'use client';

import { useState, useEffect, useRef } from 'react';

export function SingleSupplierAssignment({
  materialRequests = [],
  suppliers = [],
  onAssignmentChange,
  initialData = null,
}) {
  const [assignment, setAssignment] = useState({
    supplierId: initialData?.supplierId || '',
    deliveryDate: initialData?.deliveryDate || '',
    terms: initialData?.terms || '',
    notes: initialData?.notes || '',
  });

  // Use ref to store callback to avoid infinite loops
  const onAssignmentChangeRef = useRef(onAssignmentChange);
  
  // Update ref when callback changes (but don't trigger effect)
  useEffect(() => {
    onAssignmentChangeRef.current = onAssignmentChange;
  }, [onAssignmentChange]);

  // Use ref to track previous assignment to prevent unnecessary updates
  const prevAssignmentRef = useRef(null);

  useEffect(() => {
    // Only notify if assignment actually changed meaningfully
    const assignmentChanged = 
      JSON.stringify(assignment) !== JSON.stringify(prevAssignmentRef.current);
    
    if ((assignment.supplierId || assignment.deliveryDate || assignment.terms || assignment.notes) && assignmentChanged) {
      onAssignmentChangeRef.current(assignment);
      prevAssignmentRef.current = assignment;
    }
  }, [assignment]); // ✅ Only depend on assignment, not the callback

  const handleChange = (field, value) => {
    setAssignment((prev) => ({ ...prev, [field]: value }));
  };

  const selectedSupplier = suppliers.find((s) => s._id?.toString() === assignment.supplierId);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          All <strong>{materialRequests.length} material(s)</strong> will be ordered from a single supplier.
          One purchase order will be created.
        </p>
      </div>

      <div className="space-y-4">
        {/* Supplier Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Supplier <span className="text-red-500">*</span>
          </label>
          <select
            value={assignment.supplierId}
            onChange={(e) => handleChange('supplierId', e.target.value)}
            required
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="" className="text-gray-900">Select a supplier</option>
            {suppliers.map((supplier) => {
              const supplierId = supplier._id?.toString() || supplier.id?.toString() || '';
              const displayName = supplier.name || supplier.contactPerson || supplier.email || 'Unknown Supplier';
              const contactInfo = supplier.contactPerson ? ` - ${supplier.contactPerson}` : '';
              return (
                <option key={supplierId} value={supplierId} className="text-gray-900">
                  {displayName}{contactInfo} {supplier.email ? `(${supplier.email})` : ''}
                </option>
              );
            })}
          </select>
          {selectedSupplier && (
            <div className="mt-2 text-sm text-gray-600">
              <p>Contact: {selectedSupplier.email || 'N/A'}</p>
              {selectedSupplier.phone && <p>Phone: {selectedSupplier.phone}</p>}
            </div>
          )}
        </div>

        {/* Delivery Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Delivery Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={assignment.deliveryDate}
            onChange={(e) => handleChange('deliveryDate', e.target.value)}
            required
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Terms */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Payment/Delivery Terms (Optional)
          </label>
          <textarea
            value={assignment.terms}
            onChange={(e) => handleChange('terms', e.target.value)}
            placeholder="e.g., Net 30, FOB, etc."
            rows={3}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Notes (Optional)
          </label>
          <textarea
            value={assignment.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Additional notes for this purchase order..."
            rows={3}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Preview */}
      {assignment.supplierId && selectedSupplier && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Preview</h4>
          <p className="text-sm text-gray-700">
            Purchase order will be created for <strong>{selectedSupplier.name || selectedSupplier.contactPerson}</strong> with{' '}
            <strong>{materialRequests.length} material(s)</strong>.
          </p>
          {assignment.deliveryDate && (
            <p className="text-sm text-gray-700 mt-1">
              Delivery Date: <strong>{new Date(assignment.deliveryDate).toLocaleDateString('en-KE')}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

