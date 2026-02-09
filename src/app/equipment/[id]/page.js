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
import { EquipmentOperatorTracking } from '@/components/equipment/operator-tracking';

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
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
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

      const response = await fetch(`/api/equipment/${params.id}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
        const response = await fetch(`/api/phases/${data.data.phaseId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const phaseData = await phaseResponse.json();
        if (phaseData.success) {
          setPhase(phaseData.data);
          
          // Fetch project
          if (phaseData.data.projectId) {
            const response = await fetch(`/api/projects/${phaseData.data.projectId}`, {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
              },
            });
            const projectData = await projectResponse.json();
            if (projectData.success) {
              setProject(projectData.data);
            }
          }
        }
      }

      // Fetch supplier if exists
      if (data.data.supplierId) {
        const response = await fetch(`/api/suppliers/${data.data.supplierId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
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
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
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
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
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
          <Link href="/equipment" className="text-blue-600 hover:text-blue-800 mb-4 inline-block font-medium">
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
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-2.5 rounded-lg hover:from-red-700 hover:to-red-800 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Information Card */}
        <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 rounded-xl border-2 border-green-200 p-4 sm:p-5 mb-6 shadow-lg transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-sm sm:text-base font-bold text-gray-900">Equipment Assignment Details</h3>
                <button
                  onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                  className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-white/80 hover:bg-white border border-green-300 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  aria-label={isInfoExpanded ? 'Collapse information' : 'Expand information'}
                  aria-expanded={isInfoExpanded}
                >
                  <svg 
                    className={`w-4 h-4 sm:w-5 sm:h-5 text-green-600 transition-transform duration-300 ${isInfoExpanded ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              
              {isInfoExpanded ? (
                <p className="text-xs sm:text-sm text-gray-700 leading-relaxed mt-1 animate-fadeIn">
                  This equipment assignment tracks machinery, tools, or vehicles used in your construction phase. Monitor utilization, costs, supplier information, and ensure efficient resource allocation.
                </p>
              ) : (
                <p className="text-xs text-gray-500 italic mt-1 animate-fadeIn">
                  Click to expand
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-200">
            <p className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Status</p>
            <span className={`inline-block px-4 py-2 text-sm font-bold rounded-full ${getStatusColor(equipment.status)}`}>
              {equipment.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
            </span>
            <p className="text-sm font-semibold text-gray-600 mt-6 mb-2 uppercase tracking-wide">Acquisition Type</p>
            <p className="text-lg font-bold text-gray-900">
              {equipment.acquisitionType?.replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg border border-blue-200 p-6 hover:shadow-xl transition-shadow duration-200">
            <p className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Total Cost</p>
            <p className="text-3xl font-bold text-blue-700 mb-4">
              {formatCurrency(equipment.totalCost || 0)}
            </p>
            <p className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Daily Rate</p>
            <p className="text-xl font-bold text-gray-900">
              {formatCurrency(equipment.dailyRate || 0)}<span className="text-base font-normal text-gray-600">/day</span>
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-200">
            <p className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Period</p>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">
                <span className="font-semibold">Start:</span> {formatDate(equipment.startDate)}
              </p>
              {equipment.endDate ? (
                <p className="text-sm font-medium text-gray-900">
                  <span className="font-semibold">End:</span> {formatDate(equipment.endDate)}
                </p>
              ) : (
                <p className="text-sm font-semibold text-blue-600">Ongoing</p>
              )}
            </div>
            {equipment.startDate && equipment.endDate && (
              <p className="text-xs font-medium text-gray-600 mt-4 bg-gray-100 px-3 py-1.5 rounded-lg inline-block">
                Duration: {Math.ceil((new Date(equipment.endDate) - new Date(equipment.startDate)) / (1000 * 60 * 60 * 24))} days
              </p>
            )}
          </div>
        </div>

        {/* Utilization */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Utilization
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Estimated Hours</p>
              <p className="text-2xl font-bold text-gray-900">
                {equipment.utilization?.estimatedHours || 0} <span className="text-base font-normal text-gray-600">hrs</span>
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Actual Hours</p>
              <p className="text-2xl font-bold text-blue-700">
                {equipment.utilization?.actualHours || 0} <span className="text-base font-normal text-blue-600">hrs</span>
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <p className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Utilization</p>
              <p className="text-2xl font-bold text-green-700 mb-3">
                {equipment.utilization?.utilizationPercentage?.toFixed(1) || 0}%
              </p>
              <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500 shadow-sm"
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
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Supplier
            </h2>
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div>
                <Link
                  href={`/suppliers/${supplier._id}`}
                  className="text-lg font-bold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {supplier.supplierName || supplier.name}
                </Link>
                {supplier.contactPhone && (
                  <p className="text-sm font-medium text-gray-700 mt-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {supplier.contactPhone}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {equipment.notes && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Notes
            </h2>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-gray-900 whitespace-pre-wrap font-medium leading-relaxed">{equipment.notes}</p>
            </div>
          </div>
        )}

        {/* Operator Tracking */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Operator Tracking
          </h2>
          <EquipmentOperatorTracking equipmentId={params.id} />
        </div>

        {/* Edit Modal */}
        {showEditModal && canEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
              <div className="p-8">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Equipment
                  </h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 border-2 border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6 font-medium">
                    {error}
                  </div>
                )}

                <form onSubmit={handleEditSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Equipment Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      name="equipmentName"
                      value={formData.equipmentName}
                      onChange={(e) => setFormData({ ...formData, equipmentName: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Equipment Type <span className="text-red-600">*</span>
                      </label>
                      <select
                        name="equipmentType"
                        value={formData.equipmentType}
                        onChange={(e) => setFormData({ ...formData, equipmentType: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
                      >
                        <option value="" className="text-gray-500">Select Type</option>
                        {['excavator', 'crane', 'concrete_mixer', 'concrete_pump', 'scaffolding', 'compactor', 'loader', 'bulldozer', 'generator', 'welding_equipment', 'other'].map((type) => (
                          <option key={type} value={type} className="text-gray-900">
                            {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Acquisition Type <span className="text-red-600">*</span>
                      </label>
                      <select
                        name="acquisitionType"
                        value={formData.acquisitionType}
                        onChange={(e) => setFormData({ ...formData, acquisitionType: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
                      >
                        <option value="" className="text-gray-500">Select Type</option>
                        <option value="rental" className="text-gray-900">Rental</option>
                        <option value="purchase" className="text-gray-900">Purchase</option>
                        <option value="owned" className="text-gray-900">Owned</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Start Date <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        End Date <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                      </label>
                      <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Daily Rate (KES) <span className="text-red-600">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">KES</span>
                        <input
                          type="number"
                          name="dailyRate"
                          value={formData.dailyRate}
                          onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
                          required
                          min="0"
                          step="0.01"
                          className="w-full pl-12 pr-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Estimated Hours <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">hrs</span>
                        <input
                          type="number"
                          name="estimatedHours"
                          value={formData.estimatedHours}
                          onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                          min="0"
                          step="0.1"
                          className="w-full px-4 pr-16 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
                    >
                      <option value="assigned" className="text-gray-900">Assigned</option>
                      <option value="in_use" className="text-gray-900">In Use</option>
                      <option value="returned" className="text-gray-900">Returned</option>
                      <option value="maintenance" className="text-gray-900">Maintenance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Notes <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={4}
                      placeholder="Additional notes about this equipment..."
                      className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all duration-200 font-medium resize-y"
                    />
                  </div>

                  <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="px-6 py-2.5 border-2 border-gray-300 rounded-lg text-gray-900 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <LoadingButton
                      type="submit"
                      loading={saving}
                      className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
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


