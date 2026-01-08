/**
 * New Equipment Page
 * Form to create a new equipment assignment
 * 
 * Route: /equipment/new
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { EQUIPMENT_TYPES, ACQUISITION_TYPES } from '@/lib/constants/equipment-constants';

export default function NewEquipmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { canAccess } = usePermissions();
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const projectIdFromUrl = searchParams.get('projectId');
  const phaseIdFromUrl = searchParams.get('phaseId');
  
  const [formData, setFormData] = useState({
    projectId: projectIdFromUrl || '',
    phaseId: phaseIdFromUrl || '',
    equipmentName: '',
    equipmentType: '',
    acquisitionType: 'rental',
    supplierId: '',
    startDate: '',
    endDate: '',
    dailyRate: '',
    estimatedHours: '',
    status: 'assigned',
    notes: ''
  });

  useEffect(() => {
    fetchProjects();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (formData.projectId) {
      fetchPhases(formData.projectId);
    } else {
      setPhases([]);
    }
  }, [formData.projectId]);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data.projects || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchPhases = async (projectId) => {
    try {
      setLoadingPhases(true);
      const response = await fetch(`/api/phases?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
    } finally {
      setLoadingPhases(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      const response = await fetch('/api/suppliers?status=active&limit=100');
      const data = await response.json();
      if (data.success) {
        setSuppliers(data.data.suppliers || []);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create equipment');
      }

      toast.showSuccess('Equipment created successfully');
      router.push(`/equipment/${data.data._id}`);
    } catch (err) {
      setError(err.message);
      toast.showError(err.message || 'Failed to create equipment');
      console.error('Create equipment error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/equipment" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Equipment
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">New Equipment Assignment</h1>
          <p className="text-gray-600 mt-1">Create a new equipment assignment for a phase</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project <span className="text-red-500">*</span>
              </label>
              <select
                name="projectId"
                value={formData.projectId}
                onChange={handleChange}
                required
                disabled={loadingProjects}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Select Project</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectName}
                  </option>
                ))}
              </select>
            </div>

            {/* Phase Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phase <span className="text-red-500">*</span>
              </label>
              <select
                name="phaseId"
                value={formData.phaseId}
                onChange={handleChange}
                required
                disabled={loadingPhases || !formData.projectId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">{formData.projectId ? 'Select Phase' : 'Select Project First'}</option>
                {phases.map((phase) => (
                  <option key={phase._id} value={phase._id}>
                    {phase.phaseName} ({phase.phaseCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Equipment Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Equipment Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="equipmentName"
                value={formData.equipmentName}
                onChange={handleChange}
                required
                minLength={2}
                placeholder="e.g., Excavator CAT 320"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Equipment Type and Acquisition Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Equipment Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="equipmentType"
                  value={formData.equipmentType}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Type</option>
                  {EQUIPMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Acquisition Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="acquisitionType"
                  value={formData.acquisitionType}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ACQUISITION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Supplier (if rental or purchase) */}
            {(formData.acquisitionType === 'rental' || formData.acquisitionType === 'purchase') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <select
                  name="supplierId"
                  value={formData.supplierId}
                  onChange={handleChange}
                  required
                  disabled={loadingSuppliers}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.supplierName || supplier.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  min={formData.startDate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Daily Rate and Estimated Hours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Daily Rate (KES) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="dailyRate"
                  value={formData.dailyRate}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Hours
                </label>
                <input
                  type="number"
                  name="estimatedHours"
                  value={formData.estimatedHours}
                  onChange={handleChange}
                  min="0"
                  step="0.1"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="assigned">Assigned</option>
                <option value="in_use">In Use</option>
                <option value="returned">Returned</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                placeholder="Additional notes about this equipment assignment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Link
                href="/equipment"
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </Link>
              <LoadingButton
                type="submit"
                isLoading={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Equipment
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}

