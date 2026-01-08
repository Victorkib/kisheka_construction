/**
 * Equipment Detail Page
 * Displays equipment details, utilization, and allows editing
 * 
 * Route: /equipment/[id]
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

export default function EquipmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const { canAccess, user } = usePermissions();
  const [equipment, setEquipment] = useState(null);
  const [phase, setPhase] = useState(null);
  const [project, setProject] = useState(null);
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
    notes: ''
  });

  useEffect(() => {
    fetchEquipment();
  }, [params.id]);

  useEffect(() => {
    if (user) {
      const role = user.role?.toLowerCase();
      setCanEdit(['owner', 'pm', 'project_manager'].includes(role));
      setCanDelete(role === 'owner');
    }
  }, [user]);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/equipment/${params.id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch equipment');
      }

      setEquipment(data.data);
      
      // Populate form data
      setFormData({
        equipmentName: data.data.equipmentName || '',
        equipmentType: data.data.equipmentType || '',
        acquisitionType: data.data.acquisitionType || '',
        supplierId: data.data.supplierId?.toString() || '',
        startDate: data.data.startDate ? new Date(data.data.startDate).toISOString().split('T')[0] : '',
        endDate: data.data.endDate ? new Date(data.data.endDate).toISOString().split('T')[0] : '',
        dailyRate: data.data.dailyRate || '',
        estimatedHours: data.data.utilization?.estimatedHours || '',
        status: data.data.status || 'assigned',
        notes: data.data.notes || ''
      });
      
      // Fetch phase
      if (data.data.phaseId) {
        const phaseResponse = await fetch(`/api/phases/${data.data.phaseId}`);
        const phaseData = await phaseResponse.json();
        if (phaseData.success) {
          setPhase(phaseData.data);
          
          // Fetch project
          if (phaseData.data.projectId) {
            const projectResponse = await fetch(`/api/projects/${phaseData.data.projectId}`);
            const projectData = await projectResponse.json();
            if (projectData.success) {
              setProject(projectData.data);
            }
          }
        }
      }

      // Fetch supplier if exists
      if (data.data.supplierId) {
        const supplierResponse = await fetch(`/api/suppliers/${data.data.supplierId}`);
        const supplierData = await supplierResponse.json();
        if (supplierData.success) {
          setSupplier(supplierData.data);
        }
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch equipment error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/equipment/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update equipment');
      }

      toast.showSuccess('Equipment updated successfully');
      setShowEditModal(false);
      fetchEquipment();
    } catch (err) {
      setError(err.message);
      toast.showError(err.message || 'Failed to update equipment');
      console.error('Update equipment error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/equipment/${params.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete equipment');
      }

      toast.showSuccess('Equipment deleted successfully');
      router.push('/equipment');
    } catch (err) {
      toast.showError(err.message || 'Failed to delete equipment');
      console.error('Delete equipment error:', err);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'assigned': 'bg-blue-100 text-blue-800',
      'in_use': 'bg-green-100 text-green-800',
      'returned': 'bg-gray-100 text-gray-800',
      'maintenance': 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  if (error || !equipment) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Equipment not found'}
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/equipment" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Equipment
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{equipment.equipmentName}</h1>
              <p className="text-gray-600 mt-1">
                {equipment.equipmentType?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Equipment'}
              </p>
              {project && phase && (
                <div className="mt-2 space-x-4 text-sm">
                  <Link 
                    href={`/projects/${project._id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Project: {project.projectName}
                  </Link>
                  <span className="text-gray-400">•</span>
                  <Link 
                    href={`/phases/${phase._id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Phase: {phase.phaseName}
                  </Link>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {canEdit && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Status</p>
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(equipment.status)}`}>
              {equipment.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
            </span>
            <p className="text-sm text-gray-600 mt-4">Acquisition Type</p>
            <p className="text-lg font-semibold text-gray-900">
              {equipment.acquisitionType?.replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Total Cost</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(equipment.totalCost || 0)}
            </p>
            <p className="text-sm text-gray-600 mt-4">Daily Rate</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(equipment.dailyRate || 0)}/day
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Period</p>
            <p className="text-sm text-gray-900">
              Start: {formatDate(equipment.startDate)}<br />
              {equipment.endDate ? (
                <>End: {formatDate(equipment.endDate)}</>
              ) : (
                <span className="text-blue-600">Ongoing</span>
              )}
            </p>
            {equipment.startDate && equipment.endDate && (
              <p className="text-xs text-gray-500 mt-2">
                Duration: {Math.ceil((new Date(equipment.endDate) - new Date(equipment.startDate)) / (1000 * 60 * 60 * 24))} days
              </p>
            )}
          </div>
        </div>

        {/* Utilization */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Utilization</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Estimated Hours</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {equipment.utilization?.estimatedHours || 0} hrs
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Actual Hours</p>
              <p className="text-xl font-bold text-blue-600 mt-1">
                {equipment.utilization?.actualHours || 0} hrs
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Utilization</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {equipment.utilization?.utilizationPercentage?.toFixed(1) || 0}%
              </p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, equipment.utilization?.utilizationPercentage || 0)}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Supplier Info */}
        {supplier && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Supplier</h2>
            <div className="flex items-center justify-between">
              <div>
                <Link
                  href={`/suppliers/${supplier._id}`}
                  className="text-lg font-semibold text-blue-600 hover:text-blue-800"
                >
                  {supplier.supplierName || supplier.name}
                </Link>
                {supplier.contactPhone && (
                  <p className="text-sm text-gray-600 mt-1">{supplier.contactPhone}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {equipment.notes && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{equipment.notes}</p>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && canEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Edit Equipment</h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                  </div>
                )}

                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Equipment Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="equipmentName"
                      value={formData.equipmentName}
                      onChange={(e) => setFormData({ ...formData, equipmentName: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Equipment Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="equipmentType"
                        value={formData.equipmentType}
                        onChange={(e) => setFormData({ ...formData, equipmentType: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Type</option>
                        {['excavator', 'crane', 'concrete_mixer', 'concrete_pump', 'scaffolding', 'compactor', 'loader', 'bulldozer', 'generator', 'welding_equipment', 'other'].map((type) => (
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
                        onChange={(e) => setFormData({ ...formData, acquisitionType: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Type</option>
                        <option value="rental">Rental</option>
                        <option value="purchase">Purchase</option>
                        <option value="owned">Owned</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Daily Rate <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="dailyRate"
                        value={formData.dailyRate}
                        onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
                        required
                        min="0"
                        step="0.01"
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
                        onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                        min="0"
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="assigned">Assigned</option>
                      <option value="in_use">In Use</option>
                      <option value="returned">Returned</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex justify-end gap-4 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <LoadingButton
                      type="submit"
                      loading={saving}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Save Changes
                    </LoadingButton>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Delete Equipment"
          message={`Are you sure you want to delete "${equipment.equipmentName}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          confirmColor="red"
          isLoading={deleting}
        />
      </div>
    </AppLayout>
  );
}


