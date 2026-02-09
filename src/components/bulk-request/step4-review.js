/**
 * Step 4: Review & Submit Component
 * Final review before submission
 */

'use client';

import { useState, useEffect } from 'react';
import { normalizeUserRole, isRole } from '@/lib/role-constants';

export function Step4Review({ wizardData, user, onValidationChange }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (wizardData.projectId) {
      fetchProject();
    }
  }, [wizardData.projectId]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${wizardData.projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProject(data.data);
      }
    } catch (err) {
      console.error('Error fetching project:', err);
    } finally {
      setLoading(false);
    }
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
    const materials = wizardData.materials || [];
    const totalMaterials = materials.length;
    const totalCost = materials.reduce((sum, m) => {
      const cost = m.estimatedCost || (m.estimatedUnitCost && m.quantityNeeded ? m.estimatedUnitCost * m.quantityNeeded : 0);
      return sum + cost;
    }, 0);
    return { totalMaterials, totalCost };
  };

  const totals = calculateTotals();
  const materials = wizardData.materials || [];
  const userRole = normalizeUserRole(user?.role);
  const willAutoApprove = isRole(userRole, 'owner');

  // Validate and notify parent (Step 4 is always valid if we reached it, but check materials anyway)
  useEffect(() => {
    if (onValidationChange) {
      // Step 4 is valid if all materials are valid
      const isValid = materials.length > 0 && materials.every((m) => {
        const materialName = m.name || m.materialName || '';
        const hasName = materialName && typeof materialName === 'string' && materialName.trim().length >= 2;
        const quantity = parseFloat(m.quantityNeeded || m.quantity || 0);
        const hasQuantity = !isNaN(quantity) && quantity > 0;
        const hasUnit = (m.unit && m.unit.trim().length > 0);
        return hasName && hasQuantity && hasUnit;
      });
      onValidationChange(isValid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Loading review...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Review & Submit</h2>
        <p className="text-sm text-gray-600 mb-6">
          Review all details before submitting. {willAutoApprove && 'As OWNER, this request will be auto-approved.'}
        </p>
      </div>

      {/* Project & Settings Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project & Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Project</p>
            <p className="font-medium text-gray-900">
              {project ? `${project.projectCode} - ${project.projectName}` : 'Loading...'}
            </p>
          </div>
          {wizardData.batchName && (
            <div>
              <p className="text-sm text-gray-600">Batch Name</p>
              <p className="font-medium text-gray-900">{wizardData.batchName}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Default Urgency</p>
            <p className="font-medium text-gray-900 capitalize">{wizardData.defaultUrgency || 'medium'}</p>
          </div>
          {wizardData.defaultReason && (
            <div>
              <p className="text-sm text-gray-600">Default Reason</p>
              <p className="font-medium text-gray-900">{wizardData.defaultReason}</p>
            </div>
          )}
        </div>
      </div>

      {/* Materials Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Materials Summary</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {materials.map((material, index) => {
            const cost = material.estimatedCost || (material.estimatedUnitCost && material.quantityNeeded ? material.estimatedUnitCost * material.quantityNeeded : 0);
            return (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{material.name}</p>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Quantity: </span>
                        <span className="font-medium text-gray-900">{material.quantityNeeded} {material.unit}</span>
                      </div>
                      {material.category && (
                        <div>
                          <span className="text-gray-600">Category: </span>
                          <span className="font-medium text-gray-900">{material.category}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-600">Urgency: </span>
                        <span className="font-medium text-gray-900 capitalize">{material.urgency || wizardData.defaultUrgency || 'medium'}</span>
                      </div>
                      {material.estimatedUnitCost && (
                        <div>
                          <span className="text-gray-600">Unit Cost: </span>
                          <span className="font-medium text-gray-900">{formatCurrency(material.estimatedUnitCost)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(cost)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Totals */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-blue-700">Total Materials</p>
            <p className="text-3xl font-bold text-blue-900">{totals.totalMaterials}</p>
          </div>
          <div>
            <p className="text-sm text-blue-700">Total Estimated Cost</p>
            <p className="text-3xl font-bold text-blue-900">{formatCurrency(totals.totalCost)}</p>
          </div>
          <div>
            <p className="text-sm text-blue-700">Average Cost per Material</p>
            <p className="text-3xl font-bold text-blue-900">
              {formatCurrency(totals.totalMaterials > 0 ? totals.totalCost / totals.totalMaterials : 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Auto-approval Notice */}
      {willAutoApprove && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-green-900">Auto-Approval Enabled</p>
              <p className="text-sm text-green-700 mt-1">
                As OWNER, this bulk request will be automatically approved and ready for supplier assignment.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

