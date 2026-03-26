/**
 * Equipment Edit Page
 * Dedicated page for editing equipment with all fields
 *
 * Route: /equipment/[id]/edit
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { ConfirmationModal } from '@/components/modals';
import {
  EQUIPMENT_TYPES,
  ACQUISITION_TYPES,
} from '@/lib/constants/equipment-constants';
import { EquipmentImageGallery } from '@/components/equipment/EquipmentImageGallery';
import { EquipmentDocumentsManager } from '@/components/equipment/EquipmentDocumentsManager';
import { EquipmentSpecificationsForm } from '@/components/equipment/EquipmentSpecificationsForm';
import { OperatorRequirementSelector } from '@/components/equipment/OperatorRequirementSelector';

export default function EquipmentEditPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const { canAccess, user } = usePermissions();
  
  const [equipment, setEquipment] = useState(null);
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [floors, setFloors] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showExitModal, setShowExitModal] = useState(false);
  
  const [formData, setFormData] = useState({
    equipmentName: '',
    equipmentType: '',
    acquisitionType: '',
    supplierId: '',
    startDate: '',
    endDate: '',
    dailyRate: '',
    estimatedHours: '',
    status: 'assigned',
    notes: '',
    // New fields
    serialNumber: '',
    assetTag: '',
    images: [],
    documents: [],
    specifications: null,
    operatorRequired: null,
    operatorType: null,
    operatorNotes: '',
  });

  useEffect(() => {
    fetchEquipment();
    fetchProjects();
    fetchSuppliers();
  }, [params.id]);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/equipment/${params.id}`, {
        cache: 'no-store',
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch equipment');
      }

      const eq = data.data;
      setEquipment(eq);
      
      // Populate form data
      setFormData({
        equipmentName: eq.equipmentName || '',
        equipmentType: eq.equipmentType || '',
        acquisitionType: eq.acquisitionType || '',
        supplierId: eq.supplierId?.toString() || '',
        startDate: eq.startDate ? new Date(eq.startDate).toISOString().split('T')[0] : '',
        endDate: eq.endDate ? new Date(eq.endDate).toISOString().split('T')[0] : '',
        dailyRate: eq.dailyRate?.toString() || '',
        estimatedHours: eq.utilization?.estimatedHours?.toString() || '',
        status: eq.status || 'assigned',
        notes: eq.notes || '',
        serialNumber: eq.serialNumber || '',
        assetTag: eq.assetTag || '',
        images: eq.images || [],
        documents: eq.documents || [],
        specifications: eq.specifications || null,
        operatorRequired: eq.operatorRequired,
        operatorType: eq.operatorType || '',
        operatorNotes: eq.operatorNotes || '',
      });

      // Fetch phases if project exists
      if (eq.projectId) {
        fetchPhases(eq.projectId);
        fetchFloors(eq.projectId);
      }
    } catch (err) {
      setError(err.message);
      toast.showError('Failed to load equipment');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects/accessible', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (data.success) {
        setProjects(Array.isArray(data.data) ? data.data : []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchPhases = async (projectId) => {
    try {
      const response = await fetch(`/api/phases?projectId=${projectId}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      if (data.success) {
        setPhases(Array.isArray(data.data) ? data.data : []);
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
    }
  };

  const fetchFloors = async (projectId) => {
    try {
      const response = await fetch(`/api/floors?projectId=${projectId}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      if (data.success) {
        setFloors(Array.isArray(data.data) ? data.data : []);
      }
    } catch (err) {
      console.error('Error fetching floors:', err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers?status=active&limit=100', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (data.success) {
        setSuppliers(Array.isArray(data.data.suppliers) ? data.data.suppliers : []);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const updateData = {
        ...formData,
        estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : null,
        dailyRate: formData.dailyRate ? parseFloat(formData.dailyRate) : null,
        supplierId: formData.supplierId?.trim() || null,
      };

      const response = await fetch(`/api/equipment/${params.id}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update equipment');
      }

      toast.showSuccess('Equipment updated successfully!');
      router.push(`/equipment/${params.id}`);
    } catch (err) {
      setError(err.message);
      toast.showError(err.message || 'Failed to update equipment');
    } finally {
      setSaving(false);
    }
  };

  const handleExit = () => {
    setShowExitModal(true);
  };

  const confirmExit = () => {
    router.push(`/equipment/${params.id}`);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (error && !equipment) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
          <Link href="/equipment" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Equipment
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={handleExit}
              className="ds-text-accent-primary hover:ds-text-accent-hover font-medium"
            >
              ← Back
            </button>
            <Link
              href={`/equipment/${params.id}`}
              className="ds-text-accent-primary hover:ds-text-accent-hover font-medium"
            >
              View Details
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold ds-text-primary">
            Edit Equipment
          </h1>
          <p className="text-sm ds-text-secondary mt-1">
            Update equipment details, specifications, and documents
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-6">
          {/* Basic Information */}
          <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6 space-y-6">
            <h2 className="text-lg font-bold ds-text-primary border-b ds-border-subtle pb-3">
              Basic Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Equipment Name */}
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Equipment Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="equipmentName"
                  value={formData.equipmentName}
                  onChange={handleChange}
                  required
                  minLength={2}
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                />
              </div>

              {/* Equipment Type */}
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Equipment Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="equipmentType"
                  value={formData.equipmentType}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                >
                  <option value="">Select Type</option>
                  {EQUIPMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              {/* Acquisition Type */}
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Acquisition Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="acquisitionType"
                  value={formData.acquisitionType}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                >
                  {ACQUISITION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/\b\w/g, (l) => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              {/* Supplier */}
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Supplier
                </label>
                <select
                  name="supplierId"
                  value={formData.supplierId}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                >
                  <option value="">No Supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.supplierName || supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                >
                  {['assigned', 'in_use', 'returned', 'maintenance'].map((status) => (
                    <option key={status} value={status}>
                      {status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Equipment Identification */}
          <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6 space-y-6">
            <h2 className="text-lg font-bold ds-text-primary border-b ds-border-subtle pb-3">
              Equipment Identification
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Serial Number */}
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Serial Number
                </label>
                <input
                  type="text"
                  name="serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                  placeholder="e.g., CAT-320-2023-001"
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                />
              </div>

              {/* Asset Tag */}
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Asset Tag
                </label>
                <input
                  type="text"
                  name="assetTag"
                  value={formData.assetTag}
                  onChange={(e) => setFormData(prev => ({ ...prev, assetTag: e.target.value }))}
                  placeholder="e.g., EQ-EXC-001"
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                />
              </div>
            </div>
          </div>

          {/* Duration & Costs */}
          <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6 space-y-6">
            <h2 className="text-lg font-bold ds-text-primary border-b ds-border-subtle pb-3">
              Duration & Costs
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Start Date */}
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                />
              </div>

              {/* Daily Rate */}
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Daily Rate (KES)
                </label>
                <input
                  type="number"
                  name="dailyRate"
                  value={formData.dailyRate}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                />
              </div>

              {/* Estimated Hours */}
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Estimated Hours
                </label>
                <input
                  type="number"
                  name="estimatedHours"
                  value={formData.estimatedHours}
                  onChange={handleChange}
                  min="0"
                  step="0.5"
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                />
              </div>
            </div>
          </div>

          {/* Technical Specifications */}
          <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6">
            <EquipmentSpecificationsForm
              specifications={formData.specifications}
              onChange={(specs) => setFormData(prev => ({ ...prev, specifications: specs }))}
            />
          </div>

          {/* Operator Requirements */}
          <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6">
            <OperatorRequirementSelector
              operatorRequired={formData.operatorRequired}
              operatorType={formData.operatorType}
              operatorNotes={formData.operatorNotes}
              onChange={({ operatorRequired, operatorType, operatorNotes }) =>
                setFormData(prev => ({ ...prev, operatorRequired, operatorType, operatorNotes }))
              }
            />
          </div>

          {/* Equipment Images */}
          <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6">
            <EquipmentImageGallery
              equipmentId={params.id}
              projectId={equipment?.projectId?.toString()}
              images={formData.images}
              onImagesChange={(images) => setFormData(prev => ({ ...prev, images }))}
            />
          </div>

          {/* Equipment Documents */}
          <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6">
            <EquipmentDocumentsManager
              equipmentId={params.id}
              projectId={equipment?.projectId?.toString()}
              documents={formData.documents}
              onDocumentsChange={(documents) => setFormData(prev => ({ ...prev, documents }))}
            />
          </div>

          {/* Notes */}
          <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6">
            <h2 className="text-lg font-bold ds-text-primary mb-4">
              Additional Notes
            </h2>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              placeholder="Add any additional information about this equipment..."
              className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
            />
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t ds-border-subtle">
            <button
              type="button"
              onClick={handleExit}
              disabled={saving}
              className="flex-1 px-6 py-3 ds-bg-surface-muted ds-text-primary font-bold rounded-lg hover:ds-bg-surface transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              loading={saving}
              className="flex-1 px-6 py-3 ds-bg-accent-primary text-white font-bold rounded-lg hover:ds-bg-accent-hover disabled:opacity-50"
            >
              Save Changes
            </LoadingButton>
          </div>
        </form>
      </div>

      {/* Exit Confirmation Modal */}
      <ConfirmationModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirm={confirmExit}
        title="Exit Without Saving?"
        message="Any unsaved changes will be lost. Are you sure you want to exit?"
        confirmText="Exit"
        cancelText="Stay"
        variant="danger"
      />
    </AppLayout>
  );
}
