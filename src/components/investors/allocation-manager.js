/**
 * Investment Allocation Manager Component
 * 
 * Allows managing project-specific investment allocations for an investor
 * 
 * @component
 * @param {string} investorId - Investor ID
 * @param {number} totalInvested - Total invested amount
 * @param {function} onUpdate - Callback when allocations are updated
 */

'use client';

import { useState, useEffect } from 'react';
import { LoadingButton, LoadingOverlay } from '@/components/loading';

const normalizeId = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return normalizeId(value[0]);
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$oid) return value.$oid;
  if (typeof value === 'object' && value._id) return normalizeId(value._id);
  return value.toString?.() || '';
};

export function AllocationManager({ investorId, totalInvested, onUpdate }) {
  const [allocations, setAllocations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, [investorId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch allocations and projects in parallel
      const [allocationsRes, projectsRes] = await Promise.all([
        fetch(`/api/investors/${investorId}/allocations`),
        fetch('/api/projects'),
      ]);

      const allocationsData = await allocationsRes.json();
      const projectsData = await projectsRes.json();

      if (!allocationsData.success) {
        throw new Error(allocationsData.error || 'Failed to fetch allocations');
      }

      if (!projectsData.success) {
        throw new Error(projectsData.error || 'Failed to fetch projects');
      }

      const normalizedAllocations = (allocationsData.data.allocations || []).map((alloc) => ({
        ...alloc,
        projectId: normalizeId(alloc.projectId),
      }));
      const normalizedProjects = (projectsData.data || []).map((project) => ({
        ...project,
        _id: normalizeId(project._id),
      }));

      setAllocations(normalizedAllocations);
      setProjects(normalizedProjects);
    } catch (err) {
      setError(err.message || 'Failed to load data');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllocation = () => {
    setAllocations([
      ...allocations,
      {
        projectId: '',
        amount: 0,
        notes: '',
      },
    ]);
  };

  const handleRemoveAllocation = (index) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const handleAllocationChange = (index, field, value) => {
    const updated = [...allocations];
    updated[index] = {
      ...updated[index],
      [field]: field === 'amount' ? parseFloat(value) || 0 : value,
    };
    setAllocations(updated);
  };

  const calculateTotalAllocated = () => {
    return allocations.reduce((sum, alloc) => sum + (alloc.amount || 0), 0);
  };

  const getUnallocated = () => {
    return Math.max(0, totalInvested - calculateTotalAllocated());
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Filter out empty allocations
      const validAllocations = allocations
        .filter((alloc) => alloc.projectId && alloc.amount > 0)
        .map((alloc) => ({
          projectId: normalizeId(alloc.projectId),
          amount: parseFloat(alloc.amount) || 0,
          notes: alloc.notes || null,
        }));

      const response = await fetch(`/api/investors/${investorId}/allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations: validAllocations }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save allocations');
      }

      setSuccess(true);
      const updatedAllocations = (data.data.allocations || []).map((alloc) => ({
        ...alloc,
        projectId: normalizeId(alloc.projectId),
      }));
      setAllocations(updatedAllocations);
      
      if (onUpdate) {
        onUpdate(data.data);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save allocations');
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const totalAllocated = calculateTotalAllocated();
  const unallocated = getUnallocated();
  const isValid = unallocated >= 0 && allocations.every((alloc) => {
    if (!alloc.projectId) return true; // Empty rows are OK
    return alloc.amount > 0;
  });

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4 relative">
      <LoadingOverlay 
        isLoading={saving} 
        message="Saving allocations and recalculating finances..." 
        fullScreen={false} 
      />
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Investment Allocations</h3>
          <p className="text-sm text-gray-600 mt-1">
            Allocate investments to specific projects
          </p>
        </div>
        <button
          onClick={handleAddAllocation}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
        >
          + Add Project
        </button>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-3 gap-4">
        <div>
          <div className="text-sm text-gray-600">Total Invested</div>
          <div className="text-lg font-semibold text-gray-900">{formatCurrency(totalInvested)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Total Allocated</div>
          <div className="text-lg font-semibold text-blue-600">{formatCurrency(totalAllocated)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Unallocated</div>
          <div className={`text-lg font-semibold ${unallocated > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {formatCurrency(unallocated)}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          <p className="font-medium">Success</p>
          <p className="text-sm mt-1">Allocations saved successfully!</p>
        </div>
      )}

      {/* Validation Warning */}
      {unallocated < 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          <p className="font-medium">Warning</p>
          <p className="text-sm mt-1">
            Total allocated amount exceeds total invested. Please adjust allocations.
          </p>
        </div>
      )}

      {/* Allocations Table */}
      {allocations.length === 0 ? (
        <div className="text-center text-gray-600 py-8">
          <p>No allocations yet. Click "Add Project" to allocate investments.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                  Project
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                  Notes
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allocations.map((allocation, index) => (
                <tr key={index}>
                  <td className="px-4 py-3">
                    <select
                      value={allocation.projectId || ''}
                      onChange={(e) => handleAllocationChange(index, 'projectId', e.target.value)}
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Project</option>
                      {projects.map((project) => (
                        <option key={project._id} value={project._id}>
                          {project.projectCode} - {project.projectName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={allocation.amount || ''}
                      onChange={(e) => handleAllocationChange(index, 'amount', e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={allocation.notes || ''}
                      onChange={(e) => handleAllocationChange(index, 'notes', e.target.value)}
                      placeholder="Optional notes"
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleRemoveAllocation(index)}
                      className="text-red-600 hover:text-red-800 transition"
                      aria-label="Remove allocation"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <LoadingButton
          onClick={handleSave}
          isLoading={saving}
          loadingText="Saving..."
          disabled={!isValid || saving}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Save Allocations
        </LoadingButton>
      </div>
    </div>
  );
}

