/**
 * Create Material Request Page
 * Form for creating new material requests
 * 
 * Route: /material-requests/new
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';

function NewMaterialRequestPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [floors, setFloors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [availableCapital, setAvailableCapital] = useState(null);
  const [loadingCapital, setLoadingCapital] = useState(false);

  const [formData, setFormData] = useState({
    projectId: '',
    floorId: '',
    categoryId: '',
    category: '',
    materialName: '',
    description: '',
    quantityNeeded: '',
    unit: 'piece',
    urgency: 'medium',
    estimatedCost: '',
    estimatedUnitCost: '',
    reason: '',
    notes: '',
  });

  // Fetch data on mount
  useEffect(() => {
    fetchProjects();
    fetchCategories();
  }, []);

  // Handle URL parameters
  useEffect(() => {
    const projectIdFromUrl = searchParams.get('projectId');
    const floorIdFromUrl = searchParams.get('floorId');
    const materialIdFromUrl = searchParams.get('materialId');
    const quantityFromUrl = searchParams.get('quantity');
    const quantityNeededFromUrl = searchParams.get('quantityNeeded');
    const materialNameFromUrl = searchParams.get('materialName');
    const categoryFromUrl = searchParams.get('category');
    const categoryIdFromUrl = searchParams.get('categoryId');
    const urgencyFromUrl = searchParams.get('urgency');
    const unitFromUrl = searchParams.get('unit');

    if (projectIdFromUrl) {
      setFormData((prev) => ({ ...prev, projectId: projectIdFromUrl }));
    }
    if (floorIdFromUrl) {
      setFormData((prev) => ({ ...prev, floorId: floorIdFromUrl }));
    }
    if (quantityFromUrl || quantityNeededFromUrl) {
      setFormData((prev) => ({ ...prev, quantityNeeded: quantityNeededFromUrl || quantityFromUrl }));
    }
    if (materialNameFromUrl) {
      setFormData((prev) => ({ ...prev, materialName: materialNameFromUrl }));
    }
    if (categoryFromUrl) {
      setFormData((prev) => ({ ...prev, category: categoryFromUrl }));
    }
    if (categoryIdFromUrl) {
      setFormData((prev) => ({ ...prev, categoryId: categoryIdFromUrl }));
    }
    if (urgencyFromUrl) {
      setFormData((prev) => ({ ...prev, urgency: urgencyFromUrl }));
    }
    if (unitFromUrl) {
      setFormData((prev) => ({ ...prev, unit: unitFromUrl }));
    }
    if (materialIdFromUrl) {
      fetchMaterialDetails(materialIdFromUrl);
    }
  }, [searchParams]);

  // Fetch floors when projectId changes
  useEffect(() => {
    if (formData.projectId) {
      fetchFloors(formData.projectId);
      fetchAvailableCapital(formData.projectId);
    } else {
      setFloors([]);
      setAvailableCapital(null);
    }
  }, [formData.projectId]);

  // Fetch available capital when estimated cost changes
  useEffect(() => {
    if (formData.projectId && formData.estimatedCost) {
      fetchAvailableCapital(formData.projectId);
    }
  }, [formData.estimatedCost, formData.projectId]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
        // Auto-select first project if only one exists and not set from URL
        if (data.data && data.data.length === 1 && !formData.projectId) {
          setFormData((prev) => ({ ...prev, projectId: data.data[0]._id }));
        }
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchFloors = async (projectId) => {
    try {
      if (!projectId) {
        setFloors([]);
        return;
      }
      const response = await fetch(`/api/floors?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setFloors(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching floors:', err);
      setFloors([]);
    }
  };

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

  const fetchMaterialDetails = async (materialId) => {
    try {
      const response = await fetch(`/api/materials/${materialId}`);
      const data = await response.json();
      if (data.success && data.data) {
        const material = data.data;
        setFormData((prev) => ({
          ...prev,
          materialName: material.name || material.materialName || '',
          description: material.description || '',
          unit: material.unit || 'piece',
          categoryId: material.categoryId || '',
          category: material.category || '',
          projectId: material.projectId || prev.projectId,
          floorId: material.floor || prev.floorId,
        }));
      }
    } catch (err) {
      console.error('Error fetching material details:', err);
    }
  };

  const fetchAvailableCapital = async (projectId) => {
    if (!canAccess('view_financing')) return; // Only show if user has permission

    try {
      setLoadingCapital(true);
      const response = await fetch(`/api/project-finances?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setAvailableCapital(data.data.availableCapital || data.data.capitalBalance || 0);
      }
    } catch (err) {
      console.error('Error fetching available capital:', err);
    } finally {
      setLoadingCapital(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Clear floor selection when project changes
      if (name === 'projectId') {
        updated.floorId = '';
      }
      // Handle category selection
      if (name === 'categoryId') {
        const selectedCategory = categories.find((cat) => cat._id === value);
        updated.category = selectedCategory ? selectedCategory.name : '';
      }
      return updated;
    });
  };

  const calculateEstimatedCost = () => {
    if (formData.estimatedUnitCost && formData.quantityNeeded) {
      const cost = parseFloat(formData.estimatedUnitCost) * parseFloat(formData.quantityNeeded);
      setFormData((prev) => ({ ...prev, estimatedCost: cost.toFixed(2) }));
    } else if (formData.estimatedCost) {
      // If total cost is provided, calculate unit cost
      if (formData.quantityNeeded) {
        const unitCost = parseFloat(formData.estimatedCost) / parseFloat(formData.quantityNeeded);
        setFormData((prev) => ({ ...prev, estimatedUnitCost: unitCost.toFixed(2) }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.projectId) {
      setError('Project is required');
      return;
    }
    if (!formData.materialName || formData.materialName.trim().length < 2) {
      setError('Material name is required and must be at least 2 characters');
      return;
    }
    if (!formData.quantityNeeded || parseFloat(formData.quantityNeeded) <= 0) {
      setError('Quantity needed must be greater than 0');
      return;
    }
    if (!formData.unit || formData.unit.trim().length === 0) {
      setError('Unit is required');
      return;
    }
    if (!formData.urgency) {
      setError('Urgency is required');
      return;
    }

    // Check financial warning if estimated cost exceeds available capital
    if (formData.estimatedCost && availableCapital !== null) {
      const estimatedCostNum = parseFloat(formData.estimatedCost);
      if (estimatedCostNum > availableCapital) {
        const proceed = confirm(
          `Warning: Estimated cost (KES ${estimatedCostNum.toLocaleString()}) exceeds available capital (KES ${availableCapital.toLocaleString()}). Do you want to proceed?`
        );
        if (!proceed) {
          return;
        }
      }
    }

    setLoading(true);
    try {
      const payload = {
        projectId: formData.projectId,
        materialName: formData.materialName.trim(),
        description: formData.description?.trim() || '',
        quantityNeeded: parseFloat(formData.quantityNeeded),
        unit: formData.unit.trim(),
        urgency: formData.urgency,
        reason: formData.reason?.trim() || '',
        notes: formData.notes?.trim() || '',
        ...(formData.floorId && { floorId: formData.floorId }),
        ...(formData.categoryId && { categoryId: formData.categoryId }),
        ...(formData.category && { category: formData.category }),
        ...(formData.estimatedCost && { estimatedCost: parseFloat(formData.estimatedCost) }),
        ...(formData.estimatedUnitCost && { estimatedUnitCost: parseFloat(formData.estimatedUnitCost) }),
      };

      const response = await fetch('/api/material-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        toast.showSuccess('Material request created successfully!');
        router.push(`/material-requests/${data.data._id}`);
      } else {
        setError(data.error || 'Failed to create material request');
        toast.showError(data.error || 'Failed to create material request');
      }
    } catch (err) {
      setError(err.message || 'Failed to create material request');
      toast.showError(err.message || 'Failed to create material request');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return '0.00';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/material-requests"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Material Requests
          </Link>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Create Material Request</h1>
          <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Request materials needed for your project</p>
        </div>

        {/* Financial Warning */}
        {formData.estimatedCost && availableCapital !== null && parseFloat(formData.estimatedCost) > availableCapital && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">⚠️ Financial Warning</p>
            <p className="text-sm mt-1">
              Estimated cost ({formatCurrency(parseFloat(formData.estimatedCost))}) exceeds available capital ({formatCurrency(availableCapital)}).
              This is just an estimate and will not block approval, but please review carefully.
            </p>
          </div>
        )}

        {/* Available Capital Display */}
        {formData.projectId && availableCapital !== null && canAccess('view_financing') && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6">
            <p className="text-sm">
              <span className="font-semibold">Available Capital:</span> {formatCurrency(availableCapital)}
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
          <div className="space-y-6">
            {/* Project Selection */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Project <span className="text-red-500">*</span>
              </label>
              <select
                name="projectId"
                value={formData.projectId}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectName} {project.projectCode && `(${project.projectCode})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Floor Selection (Optional) */}
            {formData.projectId && floors.length > 0 && (
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Floor (Optional)
                </label>
                <select
                  name="floorId"
                  value={formData.floorId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a floor</option>
                  {floors.map((floor) => (
                    <option key={floor._id} value={floor._id}>
                      {floor.name || `Floor ${floor.floorNumber}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category Selection (Optional) */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Category (Optional)
              </label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Material Name */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Material Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="materialName"
                value={formData.materialName}
                onChange={handleChange}
                required
                minLength={2}
                placeholder="e.g., Cement, Steel Bars, etc."
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Description (Optional)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Additional details about the material..."
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
              />
            </div>

            {/* Quantity and Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Quantity Needed <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="quantityNeeded"
                  value={formData.quantityNeeded}
                  onChange={handleChange}
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Unit <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  required
                  placeholder="e.g., bags, kg, pieces"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Urgency */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Urgency <span className="text-red-500">*</span>
              </label>
              <select
                name="urgency"
                value={formData.urgency}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {/* Estimated Cost (Optional) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Estimated Unit Cost (Optional)
                </label>
                <input
                  type="number"
                  name="estimatedUnitCost"
                  value={formData.estimatedUnitCost}
                  onChange={(e) => {
                    handleChange(e);
                    setTimeout(calculateEstimatedCost, 100);
                  }}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Estimated Total Cost (Optional)
                </label>
                <input
                  type="number"
                  name="estimatedCost"
                  value={formData.estimatedCost}
                  onChange={(e) => {
                    handleChange(e);
                    setTimeout(calculateEstimatedCost, 100);
                  }}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Reason for Request (Optional)
              </label>
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                rows={3}
                placeholder="Why is this material needed?"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Additional Notes (Optional)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Any additional information..."
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
              <Link
                href="/material-requests"
                className="px-6 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition"
              >
                Cancel
              </Link>
              <LoadingButton
                type="submit"
                loading={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
              >
                Create Request
              </LoadingButton>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewMaterialRequestPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    }>
      <NewMaterialRequestPageContent />
    </Suspense>
  );
}

